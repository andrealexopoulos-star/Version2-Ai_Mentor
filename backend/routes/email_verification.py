"""BIQc custom email-verification route.

Why this exists separate from Supabase's built-in email-confirm flow:
the Stripe paid-trial signup in auth_supabase.py uses
`admin.create_user(email_confirm=True)` so Supabase auth considers the
email confirmed from the moment the user's card is captured (the
sign_in_with_password step demands it). That leaves BIQc with no
independent record of whether the user ever clicked a verification
link, so we run our own gate: a random token, hashed in
public.users.email_verification_token_hash, with a 7-day expiry.
ProtectedRoute on the frontend reads `email_verified_by_user` from the
users row and routes unverified accounts through /verify-email-sent.

Endpoints:
  POST /api/auth/send-verification-email     — auth'd. Internal call.
  POST /api/auth/resend-verification-email   — auth'd. User-triggered.
  POST /api/auth/verify-email                — public. Token in body.
  GET  /api/auth/verification-status         — auth'd. Cheap poll.

Shipped 2026-04-20 as part of the P0 email sprint.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from routes.auth import get_current_user
from services.email_service import (
    make_verification_token,
    hash_token,
    send_verification_email,
    send_verified_email,
    send_password_reset_email,
    send_password_reset_confirm_email,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# 7-day expiry matches the language in tmpl_verification ("expires in 7 days").
VERIFICATION_TTL_DAYS = 7
# Floor on user-triggered resend — stop the "smash the button 40 times" case.
RESEND_COOLDOWN_SECONDS = 60


def _get_sb():
    """Service-role client. Mirrors the helper used across stripe/webhook
    routes so we have write access to public.users regardless of the
    caller's RLS context."""
    try:
        from routes.deps import get_sb
        return get_sb()
    except Exception:
        from supabase_client import init_supabase
        sb = init_supabase()
        if not sb:
            raise HTTPException(status_code=503, detail="Database is unavailable")
        return sb


# ── formatters (used by the route + the stripe webhook when it emits E5/E6/E7/E8/E9/E10/E11) ─

def plan_display_name(tier_or_slug: Optional[str]) -> str:
    if not tier_or_slug:
        return "Starter"
    slug = str(tier_or_slug).strip().lower()
    return {
        "starter": "Starter",
        "growth": "Growth",
        "pro": "Pro",
        "scale": "Scale",
        "enterprise": "Enterprise",
        "free": "Free",
    }.get(slug, slug.capitalize())


def format_date_long(iso_or_dt: Any) -> str:
    """'Saturday 4 May 2026' — long form, spelled out. Fallback to the
    input string if parsing fails (never block an email send on this)."""
    if iso_or_dt is None:
        return "—"
    try:
        if isinstance(iso_or_dt, (int, float)):
            dt = datetime.fromtimestamp(int(iso_or_dt), tz=timezone.utc)
        elif isinstance(iso_or_dt, datetime):
            dt = iso_or_dt
        else:
            dt = datetime.fromisoformat(str(iso_or_dt).replace("Z", "+00:00"))
        return dt.strftime("%A %-d %B %Y")
    except Exception:
        return str(iso_or_dt)


def format_currency(amount: Any, currency: Optional[str] = "AUD",
                    *, from_cents: bool = False) -> str:
    if amount is None:
        return "—"
    cur = (currency or "AUD").upper()
    prefix = {"AUD": "A$", "USD": "$", "GBP": "£", "EUR": "€"}.get(cur, f"{cur} ")
    try:
        val = float(amount) / 100.0 if from_cents else float(amount)
        return f"{prefix}{val:,.2f}"
    except Exception:
        return f"{prefix}{amount}"


def fetch_signup_context(sb, user_id: str) -> Dict[str, Any]:
    """Single-query-ish pull of everything the E1/E2 templates need.

    Reads from public.users (email / full_name / tier / trial end) and
    from payment_transactions (amount / currency) so the email can show
    the actual amount the user agreed to.
    """
    res = sb.table("users").select(
        "email,full_name,subscription_tier,trial_ends_at,"
        "email_verified_by_user,email_verification_sent_at"
    ).eq("id", user_id).limit(1).execute()
    row: Dict[str, Any] = (res.data or [{}])[0] if res.data else {}

    amount: Optional[float] = None
    currency = "AUD"
    plan_hint: Optional[str] = None
    try:
        txn = sb.table("payment_transactions").select(
            "amount,currency,tier,package_id,created_at"
        ).eq("user_id", user_id).order("created_at", desc=True).limit(1).execute()
        if txn.data:
            t = txn.data[0]
            amount = t.get("amount")
            currency = t.get("currency") or "AUD"
            plan_hint = t.get("tier") or t.get("package_id")
    except Exception as exc:
        logger.warning("[verify] payment_transactions read failed for %s: %s", user_id, exc)

    plan_name = plan_display_name(row.get("subscription_tier") or plan_hint)

    return {
        "email": row.get("email"),
        "full_name": row.get("full_name") or "",
        "plan_name": plan_name,
        "first_charge_date": format_date_long(row.get("trial_ends_at")),
        "first_charge_amount": format_currency(amount, currency),
        "verified": bool(row.get("email_verified_by_user")),
        "last_sent_at": row.get("email_verification_sent_at"),
    }


# ── core ops (callable from routes AND from stripe_payments webhook/confirm) ─

def issue_verification_email_for_user(sb, user_id: str) -> Dict[str, Any]:
    """Generate a fresh token, persist its sha256 hash, and send E1.

    Used by:
      - POST /auth/send-verification-email     (user-facing)
      - POST /auth/resend-verification-email   (user-facing, cooldown-gated)
      - stripe_payments.confirm_trial_signup   (auto-fire after subscription creation)

    Returns a dict with `status` ∈ {"sent", "already_verified", "noop_no_email"}
    and optional `expires_at`, `resend_id`. Never raises — callers wrapped
    in user-facing request handlers translate errors to HTTP status.
    """
    ctx = fetch_signup_context(sb, user_id)
    if ctx["verified"]:
        return {"status": "already_verified"}
    if not ctx["email"]:
        return {"status": "noop_no_email"}

    raw, h = make_verification_token()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=VERIFICATION_TTL_DAYS)

    try:
        sb.table("users").update({
            "email_verification_token_hash": h,
            "email_verification_sent_at": now.isoformat(),
            "email_verification_expires_at": expires.isoformat(),
        }).eq("id", user_id).execute()
    except Exception as exc:
        logger.error("[verify] could not persist token for %s: %s", user_id, exc)
        return {"status": "persist_failed", "error": str(exc)[:200]}

    send_id = send_verification_email(
        to=ctx["email"],
        full_name=ctx["full_name"],
        token=raw,
        plan_name=ctx["plan_name"],
        first_charge_date=ctx["first_charge_date"],
        first_charge_amount=ctx["first_charge_amount"],
    )
    if not send_id:
        logger.error("[verify] Resend returned no id for user=%s email=%s", user_id, ctx["email"])
        return {"status": "send_failed"}

    return {"status": "sent", "expires_at": expires.isoformat(), "resend_id": send_id}


# ── routes ─────────────────────────────────────────────────────────────

@router.post("/auth/send-verification-email")
async def send_verification(current_user: dict = Depends(get_current_user)):
    """Generate a fresh token, persist its sha256 hash, and send E1.

    Idempotent: calling again replaces the existing token + restarts the
    7-day TTL. Returns `already_verified` if the user has already clicked
    the link at any point — we don't re-send a verification email to a
    confirmed account.
    """
    sb = _get_sb()
    result = issue_verification_email_for_user(sb, current_user["id"])
    status = result.get("status")
    if status == "already_verified":
        return result
    if status == "noop_no_email":
        raise HTTPException(status_code=400, detail="User has no email on file")
    if status == "persist_failed":
        raise HTTPException(status_code=500, detail="Could not prepare verification email")
    if status == "send_failed":
        # DB write succeeded; the remote send failed. User can retry via
        # /resend-verification-email.
        raise HTTPException(status_code=502, detail="Could not send verification email — please try resending")
    return result


@router.post("/auth/resend-verification-email")
async def resend_verification(current_user: dict = Depends(get_current_user)):
    """User-triggered resend button. Same persistence as send, but with
    a cooldown to blunt the 'smash the button' pattern."""
    sb = _get_sb()
    user_id = current_user["id"]
    ctx = fetch_signup_context(sb, user_id)
    if ctx["verified"]:
        return {"status": "already_verified"}

    last = ctx.get("last_sent_at")
    if last:
        try:
            last_dt = datetime.fromisoformat(str(last).replace("Z", "+00:00"))
            age = (datetime.now(timezone.utc) - last_dt).total_seconds()
            if age < RESEND_COOLDOWN_SECONDS:
                return {
                    "status": "cooldown",
                    "retry_after": int(RESEND_COOLDOWN_SECONDS - age),
                }
        except Exception:
            pass

    return await send_verification(current_user=current_user)


class VerifyEmailRequest(BaseModel):
    token: str


@router.post("/auth/verify-email")
async def verify_email(req: VerifyEmailRequest):
    """Public endpoint the /verify-email frontend page calls with the
    token it parsed out of the URL query string. Flips
    `email_verified_by_user=true` on a matching row, invalidates the
    token hash (single-use), sends E2 "you're verified" best-effort.
    """
    token = (req.token or "").strip()
    if not token or len(token) < 16:
        raise HTTPException(status_code=400, detail="Invalid verification token")

    h = hash_token(token)
    sb = _get_sb()
    try:
        res = sb.table("users").select(
            "id,email,full_name,subscription_tier,trial_ends_at,"
            "email_verified_by_user,email_verification_expires_at"
        ).eq("email_verification_token_hash", h).limit(1).execute()
    except Exception as exc:
        logger.error("[verify] token lookup failed: %s", exc)
        raise HTTPException(status_code=500, detail="Verification failed — please try again")
    row: Dict[str, Any] = (res.data or [{}])[0] if res.data else {}
    if not row.get("id"):
        # No row matches this token hash. Either it's fake, it was
        # already used (we null the hash after a successful verify), or
        # it was replaced by a fresher resend.
        raise HTTPException(status_code=404, detail="Verification link is invalid or has already been used")

    if row.get("email_verified_by_user"):
        return {"status": "already_verified"}

    expires_at = row.get("email_verification_expires_at")
    if expires_at:
        try:
            expires_dt = datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expires_dt:
                raise HTTPException(status_code=410, detail="Verification link has expired — please request a new one")
        except HTTPException:
            raise
        except Exception:
            pass

    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        sb.table("users").update({
            "email_verified_by_user": True,
            "email_verified_at": now_iso,
            # Invalidate the hash so the link can't be reused by a MITM
            # who saw the email.
            "email_verification_token_hash": None,
        }).eq("id", row["id"]).execute()
    except Exception as exc:
        logger.error("[verify] flip-verified failed for %s: %s", row.get("id"), exc)
        raise HTTPException(status_code=500, detail="Could not complete verification")

    # E2 "you're verified" — best-effort, no error to the caller if the
    # send fails.
    try:
        ctx = fetch_signup_context(sb, row["id"])
        send_verified_email(
            to=row.get("email"),
            full_name=row.get("full_name") or "",
            plan_name=ctx["plan_name"],
            first_charge_date=ctx["first_charge_date"],
            first_charge_amount=ctx["first_charge_amount"],
        )
    except Exception as exc:
        logger.warning("[verify] E2 send failed for %s: %s", row.get("id"), exc)

    return {"status": "verified"}


@router.get("/auth/verification-status")
async def verification_status(current_user: dict = Depends(get_current_user)):
    """Cheap poll used by the /verify-email-sent page so the frontend can
    auto-redirect to /advisor the moment the user clicks the link in
    another tab."""
    sb = _get_sb()
    res = sb.table("users").select(
        "email_verified_by_user,email_verified_at"
    ).eq("id", current_user["id"]).limit(1).execute()
    row = (res.data or [{}])[0] if res.data else {}
    return {
        "verified": bool(row.get("email_verified_by_user")),
        "verified_at": row.get("email_verified_at"),
    }


# ── Password reset — E3 + E4 ───────────────────────────────────────────

class RequestPasswordResetRequest(BaseModel):
    email: str


@router.post("/auth/request-password-reset")
async def request_password_reset(req: RequestPasswordResetRequest):
    """Generate a Supabase-signed recovery link + send our branded E3
    email. Replaces the frontend's previous `resetPasswordForEmail` call
    so the user gets a BIQc-branded email instead of the generic Supabase
    default.

    Never leaks whether an account exists — always returns {status: 'sent'}
    to prevent email-address enumeration. If the email doesn't match an
    account we just no-op silently.
    """
    email = (req.email or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address")

    sb = _get_sb()

    # Look up the account to fetch full_name for the email template. If
    # the user doesn't exist, we still return 200 (anti-enumeration).
    full_name = ""
    try:
        res = sb.table("users").select("full_name").ilike("email", email).limit(1).execute()
        if res.data:
            full_name = (res.data[0] or {}).get("full_name") or ""
    except Exception as exc:
        logger.warning("[pwreset] user lookup failed for %s: %s", email, exc)

    # Generate a Supabase recovery link that will land the user on our
    # /update-password page with an auth token in the URL hash.
    import os as _os
    _app_url = (
        _os.environ.get("FRONTEND_URL")
        or _os.environ.get("PUBLIC_FRONTEND_URL")
        or "https://biqc.ai"
    ).rstrip("/")
    redirect_to = f"{_app_url}/update-password"

    recovery_url = None
    try:
        from supabase_client import init_supabase
        sb_admin = init_supabase()
        # supabase-py exposes admin.generate_link but the signature varies
        # by version; try both common shapes.
        gen = None
        try:
            gen = sb_admin.auth.admin.generate_link({
                "type": "recovery",
                "email": email,
                "options": {"redirect_to": redirect_to},
            })
        except Exception:
            # Older/newer signatures accept kwargs.
            try:
                gen = sb_admin.auth.admin.generate_link(
                    type="recovery", email=email,
                    options={"redirect_to": redirect_to},
                )
            except Exception as inner:
                logger.warning("[pwreset] generate_link failed both shapes for %s: %s", email, inner)

        if gen is not None:
            # The generated object shape varies — try common access patterns.
            props = getattr(gen, "properties", None) or (gen.get("properties") if isinstance(gen, dict) else None)
            if props:
                recovery_url = getattr(props, "action_link", None) or (props.get("action_link") if isinstance(props, dict) else None)
            if not recovery_url:
                recovery_url = getattr(gen, "action_link", None) or (gen.get("action_link") if isinstance(gen, dict) else None)
    except Exception as exc:
        logger.warning("[pwreset] generate_link call raised for %s: %s", email, exc)

    # If we could not produce a link (user doesn't exist, or Supabase
    # refused), silently succeed — do NOT tell the caller the address is
    # unregistered.
    if not recovery_url:
        return {"status": "sent"}

    send_id = send_password_reset_email(to=email, full_name=full_name, reset_url=recovery_url)
    if not send_id:
        logger.error("[pwreset] Resend returned no id for %s", email)
        # Still return 200 so the UI shows "check your email" — we don't
        # want a retry loop that floods the mail server if Resend is down.
    return {"status": "sent"}


@router.post("/auth/password-changed-notify")
async def password_changed_notify(current_user: dict = Depends(get_current_user)):
    """Send E4 (password changed confirmation). Called by the
    /update-password page after `supabase.auth.updateUser({password})`
    succeeds. Best-effort — never fails the caller on send error.
    """
    sb = _get_sb()
    try:
        res = sb.table("users").select("email,full_name").eq("id", current_user["id"]).limit(1).execute()
        row = (res.data or [{}])[0] if res.data else {}
    except Exception as exc:
        logger.warning("[pwreset] user read failed for confirm email: %s", exc)
        row = {}

    to_email = row.get("email") or current_user.get("email")
    to_name = row.get("full_name") or current_user.get("full_name") or ""
    if not to_email:
        return {"status": "skipped_no_email"}

    send_id = send_password_reset_confirm_email(to=to_email, full_name=to_name)
    return {"status": "sent" if send_id else "send_failed"}
