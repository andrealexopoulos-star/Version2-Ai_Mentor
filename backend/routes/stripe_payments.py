"""BIQc Stripe Subscription Routes — launch pricing."""
import os
import logging
import json
import stripe
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

    # URL resolution
    base = req.origin_url or req.success_url or "https://biqc.ai"
    if base.endswith('/upgrade/success') or base.endswith('/upgrade'):
        base = base.split('/upgrade')[0]

    success_url = req.success_url or f"{base}/upgrade/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url  = req.cancel_url  or f"{base}/upgrade"

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
            from supabase_client import get_supabase_client
            sb = get_supabase_client()
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
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, current_user: dict = Depends(get_current_user)):
    """Check payment status and update tier if paid."""
    try:
        session = stripe.checkout.Session.retrieve(session_id)

        if session.payment_status == "paid":
            try:
                from supabase_client import get_supabase_client
                sb = get_supabase_client()

                existing = sb.table("payment_transactions").select("payment_status").eq("session_id", session_id).execute()
                if existing.data and existing.data[0].get("payment_status") != "paid":
                    sb.table("payment_transactions").update({
                        "payment_status": "paid",
                        "paid_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("session_id", session_id).execute()

                    tier = session.metadata.get("tier", "starter")
                    sb.table("business_profiles").update({
                        "subscription_tier": tier,
                    }).eq("user_id", current_user["id"]).execute()
                    logger.info(f"Tier upgraded to {tier} for user {current_user['id']}")
            except Exception as e:
                logger.warning(f"Failed to update tier: {e}")

        return {
            "status": session.status,
            "payment_status": session.payment_status,
            "amount_total": session.amount_total,
            "currency": session.currency,
            "metadata": dict(session.metadata or {}),
        }

    except Exception as e:
        logger.error(f"Status check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    try:
        body = await request.body()
        event = stripe.Event.construct_from(json.loads(body), stripe.api_key)

        logger.info(f"Stripe webhook: {event.type}")

        if event.type == "checkout.session.completed":
            session = event.data.object
            if session.payment_status == "paid":
                try:
                    from supabase_client import get_supabase_client
                    sb = get_supabase_client()

                    sb.table("payment_transactions").update({
                        "payment_status": "paid",
                        "paid_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("session_id", session.id).execute()

                    tier = (session.metadata or {}).get("tier", "starter")
                    user_id = (session.metadata or {}).get("user_id")
                    if user_id:
                        sb.table("business_profiles").update({
                            "subscription_tier": tier,
                        }).eq("user_id", user_id).execute()
                except Exception as e:
                    logger.warning(f"Webhook tier update failed: {e}")

        return {"received": True}

    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"received": True, "error": str(e)}
