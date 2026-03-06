"""BIQc Stripe Subscription Routes — Direct stripe SDK. Zero emergentintegrations.

Checkout, Status, Webhook — all via official stripe-python.
"""
import os
import logging
import stripe
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user

STRIPE_KEY = os.environ.get("STRIPE_API_KEY", "")
stripe.api_key = STRIPE_KEY

PACKAGES = {
    "starter": {"amount": 75000, "currency": "aud", "name": "Foundation", "tier": "starter"},
    "professional": {"amount": 195000, "currency": "aud", "name": "Performance", "tier": "professional"},
    "enterprise": {"amount": 390000, "currency": "aud", "name": "Growth", "tier": "enterprise"},
}


class CheckoutRequest(BaseModel):
    package_id: str
    origin_url: str


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
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": pkg["currency"],
                    "unit_amount": pkg["amount"],
                    "product_data": {"name": f"BIQc {pkg['name']}"},
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=user_email,
            metadata={
                "user_id": user_id,
                "user_email": user_email,
                "package_id": req.package_id,
                "tier": pkg["tier"],
                "source": "biqc_subscribe",
            },
        )

        try:
            from supabase_client import get_supabase_client
            sb = get_supabase_client()
            sb.table("payment_transactions").insert({
                "user_id": user_id,
                "session_id": session.id,
                "amount": pkg["amount"] / 100,
                "currency": pkg["currency"],
                "package_id": req.package_id,
                "tier": pkg["tier"],
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
        event = stripe.Event.construct_from(
            stripe.util.json.loads(body), stripe.api_key
        )

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

                    tier = session.metadata.get("tier", "starter")
                    user_id = session.metadata.get("user_id")
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
