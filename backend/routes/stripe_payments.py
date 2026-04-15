"""BIQc Stripe Subscription Routes — launch pricing."""
import os
import logging
import stripe
from urllib.parse import urlparse
from datetime import datetime, timezone
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, Any, Dict

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user

load_dotenv()
STRIPE_KEY = os.environ.get("STRIPE_API_KEY", "")
stripe.api_key = STRIPE_KEY
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")


def _is_stripe_production_ready() -> bool:
    """True when Stripe is configured with a live secret and a webhook secret.

    Used to harden webhook + checkout paths when the runtime is in
    production. In non-production we permit test keys (sk_test_…) so local
    dev and staging still work.
    """
    env_is_prod = (
        (os.environ.get("ENVIRONMENT") or "").strip().lower() == "production"
        or (os.environ.get("PRODUCTION") or "").strip().lower() in {"1", "true", "yes"}
    )
    if not STRIPE_KEY:
        return False
    if env_is_prod and STRIPE_KEY.startswith("sk_test_"):
        return False
    if env_is_prod and not STRIPE_WEBHOOK_SECRET:
        return False
    return True

PLANS = {
    "starter": {
        "amount": 6900,
        "currency": "aud",
        "name": "BIQc Growth",
        "tier": "starter",
        "interval": "month",
    },
    "foundation": {
        "amount": 6900,
        "currency": "aud",
        "name": "BIQc Growth",
        "tier": "starter",
        "interval": "month",
    },
    "growth": {
        "amount": 6900,
        "currency": "aud",
        "name": "BIQc Growth",
        "tier": "starter",
        "interval": "month",
    },
    "professional": {
        "amount": 19900,
        "currency": "aud",
        "name": "BIQc Professional",
        "tier": "pro",
        "interval": "month",
    },
    "pro": {
        "amount": 19900,
        "currency": "aud",
        "name": "BIQc Professional",
        "tier": "pro",
        "interval": "month",
    },
    "business": {
        "amount": 34900,
        "currency": "aud",
        "name": "BIQc Business",
        "tier": "business",
        "interval": "month",
    },
    "enterprise": {
        "amount": 0,
        "currency": "aud",
        "name": "BIQc Enterprise",
        "tier": "enterprise",
        "interval": "month",
    },
}

# Legacy mapping (keeps old package IDs working)
PACKAGES = PLANS


def _is_production() -> bool:
    env = (os.environ.get("ENVIRONMENT") or "").strip().lower()
    prod_flag = (os.environ.get("PRODUCTION") or "").strip().lower()
    return env == "production" or prod_flag in {"1", "true", "yes"}


def _is_allowed_checkout_origin(origin: str) -> bool:
    def _normalize_origin(value: str) -> str:
        raw = (value or "").strip().rstrip("/")
        if not raw:
            return ""
        if "://" not in raw:
            raw = f"https://{raw}"
        parsed = urlparse(raw)
        if not parsed.scheme or not parsed.netloc:
            return ""
        return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")

    allowed = {
        _normalize_origin(os.environ.get("FRONTEND_URL") or ""),
        _normalize_origin(os.environ.get("PUBLIC_FRONTEND_URL") or ""),
        _normalize_origin(os.environ.get("REACT_APP_FRONTEND_URL") or ""),
    }
    extra = (os.environ.get("CHECKOUT_ALLOWED_ORIGINS") or "").strip()
    if extra:
        allowed.update(_normalize_origin(item) for item in extra.split(",") if item.strip())
    allowed = {item for item in allowed if item}
    return origin in allowed


def _normalize_checkout_url(raw_url: str, *, allow_local_http: bool) -> str:
    parsed = urlparse((raw_url or "").strip())
    if not parsed.scheme or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Invalid checkout redirect URL")

    host = (parsed.hostname or "").strip().lower()
    if parsed.scheme == "https":
        pass
    elif parsed.scheme == "http" and allow_local_http and host in {"localhost", "127.0.0.1"}:
        pass
    else:
        raise HTTPException(status_code=400, detail="Checkout redirect must use https")

    origin = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
    if not _is_allowed_checkout_origin(origin):
        raise HTTPException(status_code=400, detail="Checkout redirect origin is not allowed")

    return raw_url


def _origin_from_url(raw_url: str) -> str:
    parsed = urlparse((raw_url or "").strip())
    return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")


def _normalize_tier(tier: Optional[str]) -> str:
    value = (tier or "free").strip().lower()
    if value in {"superadmin", "super_admin"}:
        return "super_admin"
    if value in {"starter", "foundation", "growth"}:
        return "starter"
    if value in {"professional", "pro"}:
        return "pro"
    if value == "enterprise":
        return "enterprise"
    if value in {"custom", "custom_build"}:
        return "custom_build"
    return "free"


def _apply_tier_upgrade(sb, user_id: str, tier: Optional[str]) -> str:
    normalized_tier = _normalize_tier(tier)
    sb.table("users").update({
        "subscription_tier": normalized_tier,
    }).eq("id", user_id).execute()
    sb.table("business_profiles").update({
        "subscription_tier": normalized_tier,
    }).eq("user_id", user_id).execute()
    return normalized_tier


def _get_service_supabase():
    try:
        from routes.deps import get_sb
        return get_sb()
    except Exception:
        from supabase_client import init_supabase
        sb = init_supabase()
        if not sb:
            raise HTTPException(status_code=503, detail="Database is unavailable")
        return sb


def _get_latest_release_approval_context(sb, plan_key: str, version: int) -> Dict[str, Any]:
    logs = (
        sb.table("pricing_audit_log")
        .select("context,created_at")
        .eq("action", "publish_pricing")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    for row in (logs.data or []):
        ctx = row.get("context") or {}
        if str(ctx.get("plan_key") or "").strip().lower() != plan_key:
            continue
        approval = ctx.get("approval_contract") or {}
        if str(approval.get("version") or "").strip() != "v1_triple_signoff":
            continue
        # Bind by explicit release version if available.
        to_version = approval.get("to_version")
        if to_version is not None and int(to_version) != int(version):
            continue
        return approval
    return {}


def _resolve_governed_plan(sb, requested_plan_id: str) -> Dict[str, Any]:
    plan_key = str(requested_plan_id or "").strip().lower()
    if plan_key in {"foundation", "growth"}:
        plan_key = "starter"
    elif plan_key == "professional":
        plan_key = "pro"

    active = (
        sb.table("pricing_plans")
        .select("*")
        .eq("plan_key", plan_key)
        .eq("is_active", True)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    if not active.data:
        return {}

    row = active.data[0]
    approval = _get_latest_release_approval_context(sb, plan_key, int(row.get("version") or 0))
    all_approvers_present = all(
        str(approval.get(key) or "").strip()
        for key in ("product_approver_user_id", "finance_approver_user_id", "legal_approver_user_id")
    )
    if not all_approvers_present:
        # Keep checkout available by falling back to static plan metadata when
        # release approvals are incomplete. This avoids a full purchase-path outage.
        fallback = PLANS.get(plan_key, {})
        if fallback:
            logger.error(
                "Pricing governance approvals missing for plan=%s version=%s; "
                "falling back to static plan pricing.",
                plan_key,
                int(row.get("version") or 0),
            )
            return {
                "amount": int(fallback.get("amount") or 0),
                "currency": str(fallback.get("currency") or "aud").strip().lower(),
                "name": str(fallback.get("name") or f"BIQc {plan_key.title()}"),
                "tier": str(fallback.get("tier") or plan_key),
                "interval": str(fallback.get("interval") or "month"),
                "governance": {
                    "plan_key": plan_key,
                    "plan_version": int(row.get("version") or 0),
                    "approval_contract": approval,
                    "source": "pricing_control_plane_fallback_static",
                    "warning": "missing_required_approvals",
                },
            }
        raise HTTPException(
            status_code=503,
            detail="Pricing governance gate: active plan is missing required product/finance/legal approvals",
        )

    currency = str(row.get("currency") or "AUD").strip().lower()
    return {
        "amount": int(row.get("monthly_price_cents") or 0),
        "currency": currency,
        "name": str(row.get("name") or f"BIQc {plan_key.title()}"),
        "tier": plan_key,
        "interval": "month",
        "governance": {
            "plan_key": plan_key,
            "plan_version": int(row.get("version") or 0),
            "approval_contract": approval,
            "source": "pricing_control_plane",
        },
    }


class CheckoutRequest(BaseModel):
    tier: Optional[str] = None
    package_id: Optional[str] = None   # legacy support
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None
    origin_url: Optional[str] = None   # legacy support


@router.post("/stripe/create-checkout-session")
@router.post("/payments/checkout")  # legacy route
async def create_checkout(req: CheckoutRequest, request: Request, current_user: dict = Depends(get_current_user)):
    """Create Stripe checkout session for a subscription plan."""
    if not _is_stripe_production_ready():
        # Fail closed instead of creating a checkout against a test/unset key.
        logger.error(
            "Checkout rejected: Stripe is not production-ready (key_present=%s, webhook_secret_present=%s)",
            bool(STRIPE_KEY), bool(STRIPE_WEBHOOK_SECRET),
        )
        raise HTTPException(status_code=503, detail="Stripe is not configured for production")

    plan_id = req.tier or req.package_id or ''
    if plan_id not in PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan. Choose from: {list(PLANS.keys())}")

    sb = _get_service_supabase()
    plan = _resolve_governed_plan(sb, plan_id) or PLANS[plan_id]
    # Reject any plan that resolved to a 0-amount (other than enterprise contact flow).
    if int(plan.get("amount") or 0) <= 0 and plan_id != "enterprise":
        logger.error("Checkout rejected: plan %s resolved to 0 amount", plan_id)
        raise HTTPException(status_code=503, detail="Pricing is not configured for this plan")
    user_id = current_user["id"]
    user_email = current_user.get("email", "")

    # URL resolution and allowlist validation (prevents open redirects).
    allow_local_http = not _is_production()
    configured_base = (os.environ.get("FRONTEND_URL") or "").strip() or "https://biqc.ai"
    base_candidate = req.origin_url or req.success_url or configured_base
    normalized_base = _normalize_checkout_url(base_candidate, allow_local_http=allow_local_http)
    base_origin = _origin_from_url(normalized_base)

    if req.success_url:
        success_url = _normalize_checkout_url(req.success_url, allow_local_http=allow_local_http)
    else:
        success_url = f"{base_origin}/upgrade/success?session_id={{CHECKOUT_SESSION_ID}}"

    if req.cancel_url:
        cancel_url = _normalize_checkout_url(req.cancel_url, allow_local_http=allow_local_http)
    else:
        cancel_url = f"{base_origin}/upgrade"

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": plan["currency"],
                    "unit_amount": plan["amount"],
                    "recurring": {"interval": plan["interval"]},
                    "product_data": {
                        "name": plan["name"],
                        "description": "Paid operating tier for visibility, revenue and operations control, marketing intelligence, Boardroom context, governance workflows, and up to 5 integrations.",
                    },
                },
                "quantity": 1,
            }],
            mode="subscription",
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=user_email,
            metadata={
                "user_id": user_id,
                "user_email": user_email,
                "tier": plan["tier"],
                "source": "biqc_upgrade",
                "pricing_source": (plan.get("governance", {}) or {}).get("source", "legacy_static"),
                "pricing_plan_key": (plan.get("governance", {}) or {}).get("plan_key", plan_id),
                "pricing_plan_version": str((plan.get("governance", {}) or {}).get("plan_version", "")),
            },
        )
        logger.info(f"✅ Stripe checkout created for {user_email} → {plan['name']}")
        try:
            sb.table("payment_transactions").insert({
                "user_id": user_id,
                "session_id": session.id,
                "amount": plan["amount"] / 100,
                "currency": plan["currency"],
                "package_id": plan_id,
                "tier": plan["tier"],
                "payment_status": "initiated",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to store payment transaction: {e}")

        return {"url": session.url, "session_id": session.id}

    except Exception as e:
        logger.error(f"Checkout creation failed: {e}")
        raise HTTPException(status_code=500, detail="Unable to create checkout session")


@router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, current_user: dict = Depends(get_current_user)):
    """Check payment status and update tier if paid."""
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        metadata = session.metadata or {}
        session_user_id = metadata.get("user_id")
        # Always require explicit ownership metadata; without it, never apply tier
        # changes from a client-side status poll.
        if not session_user_id or session_user_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Forbidden checkout session")

        if session.payment_status == "paid":
            try:
                sb = _get_service_supabase()

                existing = sb.table("payment_transactions").select("payment_status").eq("session_id", session_id).execute()
                if existing.data and existing.data[0].get("payment_status") != "paid":
                    sb.table("payment_transactions").update({
                        "payment_status": "paid",
                        "paid_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("session_id", session_id).execute()

                    tier = _apply_tier_upgrade(sb, current_user["id"], metadata.get("tier", "starter"))
                    logger.info(f"Tier upgraded to {tier} for user {current_user['id']}")
            except Exception as e:
                logger.warning(f"Failed to update tier: {e}")

        return {
            "status": session.status,
            "payment_status": session.payment_status,
            "amount_total": session.amount_total,
            "currency": session.currency,
            "metadata": dict(metadata),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Status check failed: {e}")
        raise HTTPException(status_code=500, detail="Unable to fetch payment status")


@router.post("/stripe/portal-session")
@router.post("/billing/portal")  # convenience alias
async def create_portal_session(request: Request, current_user: dict = Depends(get_current_user)):
    """Create a Stripe Customer Portal session for subscription management.

    If the user doesn't have a Stripe customer ID yet, we look up or create one
    from their email, then return the portal URL.
    """
    if not STRIPE_KEY:
        raise HTTPException(status_code=503, detail="Stripe is not configured")

    user_email = current_user.get("email", "")
    user_id = current_user["id"]

    try:
        # Try to find an existing Stripe customer by email
        customers = stripe.Customer.list(email=user_email, limit=1)
        if customers.data:
            customer_id = customers.data[0].id
        else:
            # Create a minimal customer record so the portal has something to attach to
            customer = stripe.Customer.create(
                email=user_email,
                metadata={"biqc_user_id": user_id},
            )
            customer_id = customer.id

        configured_base = (os.environ.get("FRONTEND_URL") or "").strip() or "https://biqc.ai"
        return_url = f"{configured_base}/billing"

        portal_session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )
        return {"url": portal_session.url}

    except stripe.error.InvalidRequestError as e:
        logger.error(f"Stripe portal error: {e}")
        raise HTTPException(status_code=400, detail="Unable to create billing portal session")
    except Exception as e:
        logger.error(f"Portal session creation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to open billing portal")


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    if not STRIPE_WEBHOOK_SECRET:
        logger.error("Webhook rejected: STRIPE_WEBHOOK_SECRET is not configured")
        raise HTTPException(status_code=503, detail="Stripe webhook is not configured")
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        if not signature:
            raise HTTPException(status_code=400, detail="Missing Stripe-Signature header")
        event = stripe.Webhook.construct_event(body, signature, STRIPE_WEBHOOK_SECRET)

        logger.info(f"Stripe webhook: {event.type}")

        if event.type == "checkout.session.completed":
            session = event.data.object
            if session.payment_status == "paid":
                try:
                    sb = _get_service_supabase()

                    sb.table("payment_transactions").update({
                        "payment_status": "paid",
                        "paid_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("session_id", session.id).execute()

                    user_id = (session.metadata or {}).get("user_id")
                    if user_id:
                        _apply_tier_upgrade(sb, user_id, (session.metadata or {}).get("tier", "starter"))
                except Exception as e:
                    # Keep webhook idempotent and avoid repeated Stripe retries on transient DB errors.
                    logger.error(f"Webhook tier update failed: {e}")

        return {"received": True}

    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid webhook payload")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=500, detail="Webhook processing failed")
