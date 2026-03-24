"""BIQc Stripe Subscription Routes — launch pricing."""
import os
import logging
import stripe
from urllib.parse import urlparse
from datetime import datetime, timezone
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user

load_dotenv()
STRIPE_KEY = os.environ.get("STRIPE_API_KEY", "")
stripe.api_key = STRIPE_KEY
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

PLANS = {
    "starter": {
        "amount": 34900,
        "currency": "aud",
        "name": "BIQc Foundation",
        "tier": "starter",
        "interval": "month",
    },
    "foundation": {
        "amount": 34900,
        "currency": "aud",
        "name": "BIQc Foundation",
        "tier": "starter",
        "interval": "month",
    },
    "growth": {
        "amount": 34900,
        "currency": "aud",
        "name": "BIQc Foundation",
        "tier": "starter",
        "interval": "month",
    },
    "professional": {
        "amount": 34900,
        "currency": "aud",
        "name": "BIQc Foundation",
        "tier": "starter",
        "interval": "month",
    },
    "enterprise": {
        "amount": 34900,
        "currency": "aud",
        "name": "BIQc Foundation",
        "tier": "starter",
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
    if value in {"starter", "foundation", "growth", "professional", "enterprise", "custom", "pro"}:
        return "starter"
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
    plan_id = req.tier or req.package_id or ''
    if plan_id not in PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan. Choose from: {list(PLANS.keys())}")

    plan = PLANS[plan_id]
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
            },
        )
        logger.info(f"✅ Stripe checkout created for {user_email} → {plan['name']}")
        try:
            sb = _get_service_supabase()
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
