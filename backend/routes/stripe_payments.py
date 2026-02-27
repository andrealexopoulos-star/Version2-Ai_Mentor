"""BIQc Stripe Subscription Routes — Checkout, Status, Webhook.

Fixed packages defined server-side. No amount from frontend.
Uses emergentintegrations Stripe library.
"""
import os
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user

STRIPE_KEY = os.environ.get("STRIPE_API_KEY", "")

# Fixed subscription packages — server-side only
PACKAGES = {
    "starter": {"amount": 197.00, "currency": "aud", "name": "Starter", "tier": "starter"},
    "professional": {"amount": 497.00, "currency": "aud", "name": "Professional", "tier": "professional"},
    "enterprise": {"amount": 997.00, "currency": "aud", "name": "Enterprise", "tier": "enterprise"},
}


class CheckoutRequest(BaseModel):
    package_id: str
    origin_url: str


class StatusRequest(BaseModel):
    session_id: str


@router.post("/payments/checkout")
async def create_checkout(req: CheckoutRequest, current_user: dict = Depends(get_current_user)):
    """Create Stripe checkout session for a subscription package."""
    if req.package_id not in PACKAGES:
        raise HTTPException(status_code=400, detail=f"Invalid package. Choose from: {list(PACKAGES.keys())}")

    pkg = PACKAGES[req.package_id]
    user_id = current_user["id"]
    user_email = current_user.get("email", "")

    success_url = f"{req.origin_url}/subscribe?session_id={{CHECKOUT_SESSION_ID}}&status=success"
    cancel_url = f"{req.origin_url}/subscribe?status=cancelled"

    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest

        webhook_url = f"{req.origin_url}/api/webhook/stripe"
        stripe = StripeCheckout(api_key=STRIPE_KEY, webhook_url=webhook_url)

        checkout_req = CheckoutSessionRequest(
            amount=pkg["amount"],
            currency=pkg["currency"],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": user_id,
                "user_email": user_email,
                "package_id": req.package_id,
                "tier": pkg["tier"],
                "source": "biqc_subscribe",
            },
        )

        session = await stripe.create_checkout_session(checkout_req)

        # Store pending transaction
        try:
            from supabase_client import get_supabase_client
            sb = get_supabase_client()
            sb.table("payment_transactions").insert({
                "user_id": user_id,
                "session_id": session.session_id,
                "amount": pkg["amount"],
                "currency": pkg["currency"],
                "package_id": req.package_id,
                "tier": pkg["tier"],
                "payment_status": "initiated",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to store payment transaction: {e}")

        return {"url": session.url, "session_id": session.session_id}

    except ImportError:
        raise HTTPException(status_code=500, detail="Payment library not available")
    except Exception as e:
        logger.error(f"Checkout creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, current_user: dict = Depends(get_current_user)):
    """Check payment status and update tier if paid."""
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout

        stripe = StripeCheckout(api_key=STRIPE_KEY, webhook_url="")
        status = await stripe.get_checkout_status(session_id)

        # Update transaction and tier if paid
        if status.payment_status == "paid":
            try:
                from supabase_client import get_supabase_client
                sb = get_supabase_client()

                # Check if already processed
                existing = sb.table("payment_transactions") \
                    .select("payment_status") \
                    .eq("session_id", session_id) \
                    .execute()

                if existing.data and existing.data[0].get("payment_status") != "paid":
                    # Update transaction
                    sb.table("payment_transactions").update({
                        "payment_status": "paid",
                        "paid_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("session_id", session_id).execute()

                    # Update user tier
                    tier = status.metadata.get("tier", "starter")
                    sb.table("business_profiles").update({
                        "subscription_tier": tier,
                    }).eq("user_id", current_user["id"]).execute()

                    logger.info(f"Tier upgraded to {tier} for user {current_user['id']}")
            except Exception as e:
                logger.warning(f"Failed to update tier: {e}")

        return {
            "status": status.status,
            "payment_status": status.payment_status,
            "amount_total": status.amount_total,
            "currency": status.currency,
            "metadata": status.metadata,
        }

    except Exception as e:
        logger.error(f"Status check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout

        body = await request.body()
        sig = request.headers.get("Stripe-Signature", "")

        stripe = StripeCheckout(api_key=STRIPE_KEY, webhook_url="")
        event = await stripe.handle_webhook(body, sig)

        logger.info(f"Stripe webhook: {event.event_type} | session={event.session_id} | status={event.payment_status}")

        if event.payment_status == "paid":
            try:
                from supabase_client import get_supabase_client
                sb = get_supabase_client()

                # Update transaction
                sb.table("payment_transactions").update({
                    "payment_status": "paid",
                    "paid_at": datetime.now(timezone.utc).isoformat(),
                }).eq("session_id", event.session_id).execute()

                # Update tier
                tier = event.metadata.get("tier", "starter")
                user_id = event.metadata.get("user_id")
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
