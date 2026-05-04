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
from services.payment_state_service import (
    apply_failed_or_action_required_outcome,
    clear_payment_required_on_success,
)
from services.topup_ledger_service import grant_topup_tokens_once
from services.topup_service import get_attempt_by_payment_intent, mark_attempt_status

load_dotenv()
STRIPE_KEY = os.environ.get("STRIPE_API_KEY", "")
stripe.api_key = STRIPE_KEY
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")


def _stripe_tax_enabled() -> bool:
    """Feature flag for Stripe Tax / GST / ABN collection (Step 7 / P1-2).

    Reads live each call so tests and hot-config reloads work. Defaults to
    FALSE — the Stripe Tax dashboard setting must be activated (registration
    + origin address configured) before flipping this on, otherwise Stripe
    rejects the checkout creation with a 400.

    Activation checklist:
      1. In Stripe dashboard → Tax → activate Australia registration.
      2. Set origin address to BIQc AU business address.
      3. Set BIQC_COMPANY_ABN env var to the registered ABN.
      4. Set STRIPE_TAX_ENABLED=1 in Azure App Service env vars.
    """
    return (os.environ.get("STRIPE_TAX_ENABLED") or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


# Company ABN for invoice / receipt footer. Empty until Andreas registers
# the entity with the ATO and sets this env var. Not a secret but set via
# env so legal metadata can be rotated without a deploy.
BIQC_COMPANY_ABN = (os.environ.get("BIQC_COMPANY_ABN") or "").strip()
BIQC_COMPANY_LEGAL_NAME = (
    os.environ.get("BIQC_COMPANY_LEGAL_NAME")
    or "Business Intelligence Quotient Centre Pty Ltd"
).strip()


def _is_stripe_production_ready() -> bool:
    """True when Stripe is configured with a usable secret and webhook secret.

    2026-04-20 correction: the previous check rejected test keys when
    ENVIRONMENT=production. That was paranoid — test keys cannot charge
    real money, so running test-mode checkout on production infra is
    harmless. The real safety concern is the opposite direction (live
    key with no webhook secret → real charges with no server-side
    confirmation), and that case is still rejected below.

    Returns True if:
      - STRIPE_KEY is set (any key — test or live), AND
      - EITHER the key is sk_test_ (safe by definition), OR the key is
        sk_live_ paired with a non-empty webhook secret.
    """
    if not STRIPE_KEY:
        return False
    # Test keys can't move real money; accept them unconditionally.
    if STRIPE_KEY.startswith("sk_test_"):
        return True
    # Live keys require a webhook secret so webhook signatures can be
    # verified. Without this, a MITM could forge subscription events.
    if not STRIPE_WEBHOOK_SECRET:
        return False
    return True

PLANS = {
    # Phase 1.9 (2026-05-05 code 13041978): Lite tier added so /api/stripe/
    # create-checkout-session accepts plan_id="lite" instead of 400-rejecting.
    # Stripe price already exists at price_1TSnBMRoX8RKDDG5akGL7RkT for
    # prod_URgYIlMeF24vrN ("BIQc Lite", $14/mo). Backend allocations now wired
    # via TIER_ALLOCATIONS["lite"] = LITE_TOKENS (150K) so paying users get
    # actual entitlement rather than fall-through to free=225K.
    "lite": {
        "amount": 1400,
        "currency": "aud",
        "name": "BIQc Lite",
        "tier": "lite",
        "interval": "month",
    },
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


# Canonical Stripe catalog mapping (product IDs are stable identifiers).
# Verified live 2026-05-03:
#   growth   prod_U8D8vKuXXK7qhO  -> price_1T9wiVRoX8RKDDG5AOSi8Cu6 ($69 AUD / month)
#   pro      prod_ULf4KFDh0UKpeR  -> price_1TMxjtRoX8RKDDG5btgRBrRu ($199 AUD / month)
#   business prod_ULfA7QJoT3Ontk  -> price_1TMxplRoX8RKDDG59IaUg7aV ($349 AUD / month)
#   lite     prod_URgYIlMeF24vrN  -> price_1TSnBMRoX8RKDDG5akGL7RkT ($14 AUD / month)
STRIPE_PRODUCT_IDS = {
    "growth": "prod_U8D8vKuXXK7qhO",
    "pro": "prod_ULf4KFDh0UKpeR",
    "business": "prod_ULfA7QJoT3Ontk",
    "lite": "prod_URgYIlMeF24vrN",
}

STRIPE_EXPECTED_MONTHLY_PRICE_IDS = {
    "growth": "price_1T9wiVRoX8RKDDG5AOSi8Cu6",
    "pro": "price_1TMxjtRoX8RKDDG5btgRBrRu",
    "business": "price_1TMxplRoX8RKDDG59IaUg7aV",
    "lite": "price_1TSnBMRoX8RKDDG5akGL7RkT",
}

_STRIPE_MONTHLY_PRICE_CACHE: dict[str, Dict[str, Any]] = {}


def _obj_get(obj: Any, key: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _canonical_product_key_for_plan(plan_id: str) -> str:
    plan = (plan_id or "").strip().lower()
    if plan in {"starter", "foundation", "growth"}:
        return "growth"
    if plan in {"professional", "pro"}:
        return "pro"
    return plan


def _price_matches_contract(price: Any, *, product_id: str, amount: int, currency: str, interval: str) -> bool:
    recurring = _obj_get(price, "recurring", {}) or {}
    recurring_interval = _obj_get(recurring, "interval", None)
    recurring_count = _obj_get(recurring, "interval_count", 1)

    price_product = _obj_get(price, "product", "")
    if isinstance(price_product, dict):
        price_product = _obj_get(price_product, "id", "")

    return bool(_obj_get(price, "active", False)) \
        and _obj_get(price, "type", "") == "recurring" \
        and recurring_interval == interval \
        and int(recurring_count or 1) == 1 \
        and str(_obj_get(price, "currency", "")).lower() == str(currency).lower() \
        and int(_obj_get(price, "unit_amount", -1) or -1) == int(amount) \
        and str(price_product) == str(product_id)


def _resolve_active_monthly_price(plan_id: str, plan: Dict[str, Any]) -> Dict[str, Any]:
    product_key = _canonical_product_key_for_plan(plan_id)
    product_id = STRIPE_PRODUCT_IDS.get(product_key)
    if not product_id:
        raise HTTPException(status_code=503, detail="Stripe product mapping is not configured for this plan")

    cache_key = f"{product_key}:{int(plan.get('amount') or 0)}:{str(plan.get('currency') or 'aud').lower()}:{str(plan.get('interval') or 'month')}"
    cached = _STRIPE_MONTHLY_PRICE_CACHE.get(cache_key)
    if cached:
        return cached

    amount = int(plan.get("amount") or 0)
    currency = str(plan.get("currency") or "aud").lower()
    interval = str(plan.get("interval") or "month").lower()
    expected_price_id = STRIPE_EXPECTED_MONTHLY_PRICE_IDS.get(product_key)

    selected_price = None
    if expected_price_id:
        try:
            candidate = stripe.Price.retrieve(expected_price_id)
            if _price_matches_contract(
                candidate,
                product_id=product_id,
                amount=amount,
                currency=currency,
                interval=interval,
            ):
                selected_price = candidate
            else:
                logger.warning(
                    "Expected Stripe price failed contract validation: plan=%s product=%s price=%s",
                    plan_id,
                    product_id,
                    expected_price_id,
                )
        except Exception as exc:
            logger.warning(
                "Expected Stripe price lookup failed: plan=%s product=%s price=%s err=%s",
                plan_id,
                product_id,
                expected_price_id,
                exc,
            )

    if selected_price is None:
        try:
            listing = stripe.Price.list(product=product_id, active=True, type="recurring", limit=100)
            iterator = listing.auto_paging_iter() if hasattr(listing, "auto_paging_iter") else (_obj_get(listing, "data", []) or [])
            matches = [
                p for p in iterator
                if _price_matches_contract(
                    p,
                    product_id=product_id,
                    amount=amount,
                    currency=currency,
                    interval=interval,
                )
            ]
        except Exception as exc:
            logger.error("Stripe price listing failed: plan=%s product=%s err=%s", plan_id, product_id, exc)
            raise HTTPException(status_code=502, detail="Stripe pricing lookup failed")

        if not matches:
            raise HTTPException(
                status_code=503,
                detail="No active monthly Stripe price matches this plan contract",
            )
        selected_price = sorted(matches, key=lambda p: int(_obj_get(p, "created", 0) or 0), reverse=True)[0]

    resolved = {
        "id": str(_obj_get(selected_price, "id", "")),
        "product_id": product_id,
        "amount": amount,
        "currency": currency,
        "interval": interval,
        "active": bool(_obj_get(selected_price, "active", False)),
    }
    _STRIPE_MONTHLY_PRICE_CACHE[cache_key] = resolved
    return resolved


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

    def _is_local_origin(value: str) -> bool:
        parsed = urlparse((value or "").strip())
        return (parsed.hostname or "").strip().lower() in {"localhost", "127.0.0.1"}

    # Keep explicit production defaults to avoid customer-facing checkout
    # regressions when env vars are temporarily absent/misconfigured.
    default_origins = {
        "https://biqc.ai",
        "https://www.biqc.ai",
        "https://biqc-web.azurewebsites.net",
    }
    if not _is_production():
        default_origins.update({
            "http://localhost:3000",
            "http://localhost:8765",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8765",
        })

    env_allowed = {
        _normalize_origin(os.environ.get("FRONTEND_URL") or ""),
        _normalize_origin(os.environ.get("PUBLIC_FRONTEND_URL") or ""),
        _normalize_origin(os.environ.get("REACT_APP_FRONTEND_URL") or ""),
    }
    if _is_production():
        env_allowed = {item for item in env_allowed if not _is_local_origin(item)}

    allowed = set(env_allowed)
    allowed.update(_normalize_origin(item) for item in default_origins)
    extra = (os.environ.get("CHECKOUT_ALLOWED_ORIGINS") or "").strip()
    if extra:
        for item in extra.split(","):
            normalized = _normalize_origin(item)
            if not normalized:
                continue
            if _is_production() and _is_local_origin(normalized):
                continue
            allowed.add(normalized)
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


def _user_calibration_complete(sb, user_id: str) -> bool:
    """Return True when calibration/onboarding is complete for routing."""
    if not user_id:
        return False
    try:
        scs = (
            sb.table("strategic_console_state")
            .select("is_complete,status")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        row = (scs.data or [{}])[0] if scs.data else {}
        if bool(row.get("is_complete")):
            return True
        if str(row.get("status") or "").strip().upper() in {"COMPLETE", "COMPLETED"}:
            return True
    except Exception:
        pass
    try:
        op = (
            sb.table("user_operator_profile")
            .select("persona_calibration_status")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        row = (op.data or [{}])[0] if op.data else {}
        return str(row.get("persona_calibration_status") or "").strip().lower() == "complete"
    except Exception:
        return False


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
        if _user_calibration_complete(sb, user_id):
            success_url = f"{base_origin}/upgrade/success?session_id={{CHECKOUT_SESSION_ID}}"
        else:
            success_url = f"{base_origin}/onboarding-decision?checkout=success&session_id={{CHECKOUT_SESSION_ID}}"

    if req.cancel_url:
        cancel_url = _normalize_checkout_url(req.cancel_url, allow_local_http=allow_local_http)
    else:
        cancel_url = f"{base_origin}/subscribe?plan={plan['tier']}"

    stripe_price = _resolve_active_monthly_price(plan_id, plan)
    trial_decision = _trial_decision_for_user(sb, user_id)
    trial_days = int(trial_decision.get("trial_days") or 0)

    # Tax / GST / ABN collection — only enabled once Stripe Tax is activated
    # in the dashboard (see _stripe_tax_enabled docstring).
    session_kwargs: Dict[str, Any] = {
        "payment_method_types": ["card"],
        "line_items": [{"price": stripe_price["id"], "quantity": 1}],
        "mode": "subscription",
        "success_url": success_url,
        "cancel_url": cancel_url,
        "customer_email": user_email,
        "metadata": {
            "user_id": user_id,
            "user_email": user_email,
            "tier": plan["tier"],
            "source": "biqc_upgrade",
            "pricing_source": (plan.get("governance", {}) or {}).get("source", "legacy_static"),
            "pricing_plan_key": (plan.get("governance", {}) or {}).get("plan_key", plan_id),
            "pricing_plan_version": str((plan.get("governance", {}) or {}).get("plan_version", "")),
            "stripe_product_id": stripe_price["product_id"],
            "stripe_price_id": stripe_price["id"],
            "trial_days": str(trial_days),
            "trial_applied": "1" if trial_days > 0 else "0",
            "trial_reason": str(trial_decision.get("reason") or "trial_not_applied"),
            "tax_enabled": "1" if _stripe_tax_enabled() else "0",
        },
    }
    if trial_days > 0:
        # First-time user/account receives the 14-day trial on the primary
        # checkout path as well (not just the signup trial endpoint).
        session_kwargs["subscription_data"] = {"trial_period_days": trial_days}

    if _stripe_tax_enabled():
        # Stripe Tax pipeline — requires Tax dashboard activation.
        # - automatic_tax: Stripe calculates GST at checkout and remits it.
        # - tax_id_collection: present the ABN field to the buyer; B2B with
        #   valid ABN triggers reverse-charge (GST exempt within AU).
        # - billing_address_collection=required: needed so Stripe knows the
        #   buyer's jurisdiction before calculating tax.
        # - customer_update: after collecting new address/name, write them
        #   back onto the Customer record so renewals keep the right data.
        # - tax_behavior=inclusive is configured on the canonical Stripe
        #   price object so advertised amounts remain GST-inclusive.
        session_kwargs["automatic_tax"] = {"enabled": True}
        session_kwargs["tax_id_collection"] = {"enabled": True}
        session_kwargs["billing_address_collection"] = "required"
        session_kwargs["customer_update"] = {"address": "auto", "name": "auto"}
        # Price-level tax_behavior is configured in Stripe Dashboard on
        # the canonical recurring price object referenced above.

    try:
        session = stripe.checkout.Session.create(**session_kwargs)
        logger.info(f"✅ Stripe checkout created for {user_email} → {plan['name']}")
        try:
            # stripe_customer_id may be None at session-create time — the Customer
            # object is attached only once the user completes checkout. We
            # enrich both stripe_customer_id and stripe_subscription_id in the
            # checkout.session.completed webhook so cancellation/dunning
            # lookups can resolve back to the user.
            sb.table("payment_transactions").insert({
                "user_id": user_id,
                "session_id": session.id,
                "amount": plan["amount"] / 100,
                "currency": plan["currency"],
                "package_id": plan_id,
                "tier": plan["tier"],
                "payment_status": "initiated",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "stripe_customer_id": getattr(session, "customer", None),
                "stripe_subscription_id": getattr(session, "subscription", None),
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


# ─── Read-only checkout confirmation (Step 4 / P0-6) ───────────────────
#
# Problem this solves: /upgrade/success?session_id=... used to fire GA4
# `purchase` and `biqc_subscription_activated` events unconditionally based
# on the URL alone. An authenticated user could navigate to
# /upgrade/success?session_id=FAKE and trigger fake conversion events,
# polluting conversion data and potentially corrupting Google Ads bidding.
#
# This endpoint lets the frontend ask the server "is this session real,
# paid, and mine?" before firing any analytics event. It is deliberately
# read-only — tier upgrades flow through the webhook, not through this
# endpoint — so there is zero risk that a forged session_id can grant
# access.
@router.get("/stripe/checkout/{session_id}/confirm")
async def confirm_checkout_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Server-side confirmation that a Stripe Checkout session is paid
    and belongs to the authenticated user.

    Return shape (always 200 on a valid, owned session):
      {
        "confirmed": bool,          # True iff Stripe says 'paid' / 'no_payment_required'
        "session_id": str,
        "payment_status": str,      # 'paid' | 'unpaid' | 'no_payment_required'
        "status": str,              # 'complete' | 'open' | 'expired'
        "amount_total": int | None, # integer cents
        "currency": str | None,
        "tier": str | None,
        "plan_name": str | None,
      }

    Error responses:
      - 403  session exists but belongs to a different user, or carries no
             user_id in metadata (we never leak whether it exists).
      - 404  Stripe reports the session does not exist.
      - 502  Stripe is reachable but returned an unexpected error.
      - 503  Stripe is not configured on this instance.
    """
    if not STRIPE_KEY:
        raise HTTPException(status_code=503, detail="Stripe is not configured")

    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.InvalidRequestError:
        # Invalid session_id — Stripe didn't find it. Don't leak internals.
        raise HTTPException(status_code=404, detail="Checkout session not found")
    except stripe.error.StripeError as exc:
        logger.error("Stripe session retrieve failed for %s: %s", session_id, exc)
        raise HTTPException(status_code=502, detail="Stripe unreachable")
    except Exception as exc:  # pragma: no cover — defensive
        logger.error("Unexpected error retrieving session %s: %s", session_id, exc)
        raise HTTPException(status_code=502, detail="Stripe unreachable")

    metadata = getattr(session, "metadata", None) or {}
    # Normalise to plain dict — Stripe SDK objects subclass dict but callers
    # sometimes mock them as plain dicts, so supporting both keeps tests sane.
    metadata = dict(metadata) if metadata else {}
    session_user_id = metadata.get("user_id")

    if not session_user_id or session_user_id != current_user.get("id"):
        # Same response for "not yours" and "no user_id metadata": never leak
        # whether an arbitrary session_id resolves. A hostile client that
        # scraped a session_id from elsewhere gets 403, not useful info.
        raise HTTPException(status_code=403, detail="Forbidden checkout session")

    payment_status = str(getattr(session, "payment_status", "") or "")
    # 'no_payment_required' covers 100%-off trials and fully-discounted
    # plans — Stripe still marks the session as complete without a PI.
    confirmed = payment_status in {"paid", "no_payment_required"}

    tier_key = metadata.get("tier") or ""
    plan_name: Optional[str] = None
    plan = PLANS.get(tier_key) if tier_key else None
    if plan is None:
        plan_key = metadata.get("pricing_plan_key") or ""
        if plan_key:
            plan = PLANS.get(plan_key)
    if plan is not None:
        plan_name = plan.get("name")

    return {
        "confirmed": confirmed,
        "session_id": getattr(session, "id", session_id),
        "payment_status": payment_status,
        "status": str(getattr(session, "status", "") or ""),
        "amount_total": getattr(session, "amount_total", None),
        "currency": getattr(session, "currency", None),
        "tier": tier_key or None,
        "plan_name": plan_name,
    }


# ─── Phase 6.11 — CC-mandatory signup (Setup Intent flow) ─────────────────
#
# Embedded card capture via Stripe Elements. Card never touches BIQc.
#
# Two-step flow after Supabase auth.signUp():
#   1. POST /stripe/signup-create-setup-intent  { plan }
#      → creates Stripe Customer + SetupIntent, returns client_secret
#   2. Frontend: stripe.confirmSetup(client_secret)  — Elements confirms
#      the card, returns payment_method_id
#   3. POST /stripe/confirm-trial-signup  { customer_id, payment_method_id, plan }
#      → creates subscription with trial_period_days=14, card saved for
#        off_session auto-charge at T+14.
#
# Trust Layer: user stays on biqc.ai throughout. Card submitted direct to
# Stripe; BIQc only ever sees the payment_method_id (an opaque handle).


def _trial_decision_for_user(sb, user_id: str, *, account_id: Optional[str] = None) -> Dict[str, Any]:
    """Return fail-closed trial decision with explicit reason metadata.

    Reasons:
      - trial_eligible_first_time
      - trial_already_used
      - trial_eligibility_unverified
    """
    PRIOR_STATUSES = {"active", "trialing", "past_due", "canceled"}
    PRIOR_TIERS = {"starter", "pro", "professional", "business", "enterprise"}
    PRIOR_TX_STATUSES = {"paid", "trialing", "active", "past_due", "canceled"}
    resolved_account_id = account_id
    eligibility_unverified = False
    failure_types: list[str] = []

    def _decision(reason: str, trial_days: int, *, account_for_log: Optional[str]) -> Dict[str, Any]:
        return {
            "trial_days": int(trial_days),
            "trial_applied": bool(trial_days > 0),
            "reason": reason,
            "eligibility_verified": reason != "trial_eligibility_unverified",
            "user_id": user_id,
            "account_id": account_for_log,
            "failure_types": list(failure_types),
        }

    try:
        u_res = (
            sb.table("users")
            .select("subscription_status,subscription_tier,account_id")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        urow = (u_res.data or [{}])[0] if u_res.data else {}
        resolved_account_id = resolved_account_id or urow.get("account_id")
        if (urow.get("subscription_status") or "").lower() in PRIOR_STATUSES:
            return _decision("trial_already_used", 0, account_for_log=resolved_account_id)
        if (urow.get("subscription_tier") or "").lower() in PRIOR_TIERS:
            return _decision("trial_already_used", 0, account_for_log=resolved_account_id)
    except Exception as exc:
        eligibility_unverified = True
        failure_types.append(f"users_lookup_failed:{type(exc).__name__}")
        logger.warning(
            "trial eligibility lookup failed (users): user_id=%s account_id=%s reason=trial_eligibility_unverified failure_type=%s",
            user_id,
            resolved_account_id,
            type(exc).__name__,
        )

    account_user_ids = [user_id]
    if resolved_account_id:
        try:
            acct_res = (
                sb.table("users")
                .select("id,subscription_status,subscription_tier")
                .eq("account_id", resolved_account_id)
                .limit(200)
                .execute()
            )
            for row in (acct_res.data or []):
                rid = str(row.get("id") or "")
                if rid:
                    account_user_ids.append(rid)
                if (row.get("subscription_status") or "").lower() in PRIOR_STATUSES:
                    return _decision("trial_already_used", 0, account_for_log=resolved_account_id)
                if (row.get("subscription_tier") or "").lower() in PRIOR_TIERS:
                    return _decision("trial_already_used", 0, account_for_log=resolved_account_id)
        except Exception as exc:
            eligibility_unverified = True
            failure_types.append(f"account_scan_failed:{type(exc).__name__}")
            logger.warning(
                "trial eligibility lookup failed (account_scan): user_id=%s account_id=%s reason=trial_eligibility_unverified failure_type=%s",
                user_id,
                resolved_account_id,
                type(exc).__name__,
            )
    account_user_ids = sorted({uid for uid in account_user_ids if uid})

    try:
        tx_res = (
            sb.table("payment_transactions")
            .select("id")
            .in_("user_id", account_user_ids)
            .in_("tier", list(PRIOR_TIERS))
            .in_("payment_status", list(PRIOR_TX_STATUSES))
            .limit(1)
            .execute()
        )
        if tx_res.data:
            return _decision("trial_already_used", 0, account_for_log=resolved_account_id)
    except Exception as exc:
        eligibility_unverified = True
        failure_types.append(f"payment_history_lookup_failed:{type(exc).__name__}")
        logger.warning(
            "trial eligibility lookup failed (payment_history): user_id=%s account_id=%s reason=trial_eligibility_unverified failure_type=%s",
            user_id,
            resolved_account_id,
            type(exc).__name__,
        )

    if eligibility_unverified:
        return _decision("trial_eligibility_unverified", 0, account_for_log=resolved_account_id)

    return _decision("trial_eligible_first_time", SIGNUP_TRIAL_DAYS, account_for_log=resolved_account_id)


def _trial_days_for_user(sb, user_id: str, *, account_id: Optional[str] = None) -> int:
    """Shared trial-days resolver for all subscription-creation paths.

    Returns SIGNUP_TRIAL_DAYS for first-time user/account only; otherwise 0.
    """
    return int(_trial_decision_for_user(sb, user_id, account_id=account_id).get("trial_days") or 0)


class SignupSetupIntentRequest(BaseModel):
    plan: str  # "starter" (Growth) | "professional" (Pro) | "business"


@router.post("/stripe/signup-create-setup-intent")
async def signup_create_setup_intent(
    req: SignupSetupIntentRequest,
    current_user: dict = Depends(get_current_user),
):
    """Step 1 of 6.11 signup. Creates Stripe Customer + SetupIntent.

    Idempotent: reuses existing stripe_customer_id if one is already
    persisted on the user row (verified live against Stripe). Rejects the
    call if the user already has an active/trialing subscription — the
    signup flow should only run once per account.
    """
    if not _is_stripe_production_ready():
        raise HTTPException(status_code=503, detail="Stripe is not configured for production")

    plan_id = (req.plan or "").lower().strip()
    if plan_id not in PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan. Choose from: {list(PLANS.keys())}")

    user_id = current_user["id"]
    user_email = current_user.get("email", "")
    sb = _get_service_supabase()

    try:
        user_res = (
            sb.table("users")
            .select("stripe_customer_id,subscription_status,account_id")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        user_row = (user_res.data or [{}])[0] if user_res.data else {}
    except Exception as exc:
        logger.warning("users lookup failed in signup flow: %s", exc)
        user_row = {}

    if user_row.get("subscription_status") in ("active", "trialing"):
        raise HTTPException(status_code=409, detail="Account already has an active or trialing subscription")

    # Revenue-leak defense: don't allow a fresh trial for a user who has
    # ever had a subscription (including canceled ones). Signup trial is a
    # one-time benefit per user_id. Cancelled users should re-subscribe
    # via /pricing (no trial), not through signup.
    setup_trial_decision = _trial_decision_for_user(sb, user_id, account_id=user_row.get("account_id"))
    if int(setup_trial_decision.get("trial_days") or 0) == 0:
        if setup_trial_decision.get("reason") == "trial_eligibility_unverified":
            raise HTTPException(
                status_code=503,
                detail="Trial eligibility could not be verified right now. Please continue from pricing without trial.",
            )
        raise HTTPException(
            status_code=409,
            detail="This account has already used its 14-day trial. Please upgrade from the pricing page instead.",
        )

    customer_id = user_row.get("stripe_customer_id")

    try:
        if customer_id:
            try:
                stripe.Customer.retrieve(customer_id)
            except stripe.error.InvalidRequestError:
                # Stale cached customer_id. Discard and recreate.
                customer_id = None

        if not customer_id:
            # Idempotency key = user_id means a concurrent retry returns
            # the same Customer rather than creating a duplicate.
            customer = stripe.Customer.create(
                email=user_email,
                metadata={"user_id": user_id, "source": "biqc_signup"},
                idempotency_key=f"biqc-signup-customer-{user_id}",
            )
            customer_id = customer.id
            try:
                sb.table("users").update({"stripe_customer_id": customer_id}).eq("id", user_id).execute()
            except Exception as exc:
                logger.warning("Could not persist stripe_customer_id for user %s: %s", user_id, exc)

        # 2026-04-20 Andreas P0: Stripe rejected confirm with
        #   "Payment details were collected through Stripe Elements using
        #    automatic payment methods and cannot be confirmed through
        #    the API configured with payment_method_types"
        # Frontend PaymentElement runs in automatic mode (to support
        # card + Apple Pay + Google Pay). This SetupIntent must match.
        # allow_redirects='never' keeps redirect-based methods (Klarna,
        # Afterpay) out since we only want card + wallets.
        setup_intent = stripe.SetupIntent.create(
            customer=customer_id,
            automatic_payment_methods={"enabled": True, "allow_redirects": "never"},
            usage="off_session",
            metadata={"user_id": user_id, "plan": plan_id, "source": "biqc_signup"},
            idempotency_key=f"biqc-signup-si-{user_id}-{plan_id}",
        )

        return {
            "customer_id": customer_id,
            "client_secret": setup_intent.client_secret,
            "setup_intent_id": setup_intent.id,
            "plan": plan_id,
        }

    except stripe.error.StripeError as exc:
        logger.error("Stripe SetupIntent creation failed for user %s: %s", user_id, exc)
        raise HTTPException(status_code=502, detail="Stripe could not create a setup intent. Please try again.")


class ConfirmTrialSignupRequest(BaseModel):
    customer_id: str
    payment_method_id: str
    plan: str
    # trial_period_days REMOVED — server-determined based on eligibility.
    # Client-controlled trial days created a revenue-leak path (Codex P1).


# Canonical signup trial length — change here to roll trials across the
# platform, not a per-request param. Must stay <= 30 to match Stripe's
# trial policy assumptions.
SIGNUP_TRIAL_DAYS = 14


@router.post("/stripe/confirm-trial-signup")
async def confirm_trial_signup(
    req: ConfirmTrialSignupRequest,
    current_user: dict = Depends(get_current_user),
):
    """Step 2 of 6.11 signup. Creates trial subscription using the card
    captured by the preceding SetupIntent.

    Verifies the customer_id is owned by this user (metadata.user_id)
    before acting. Idempotent — returns the existing subscription if the
    user already has one. Trial length is server-determined (SIGNUP_TRIAL_DAYS)
    and only granted to users who have never held a subscription.
    """
    if not _is_stripe_production_ready():
        raise HTTPException(status_code=503, detail="Stripe is not configured for production")

    plan_id = (req.plan or "").lower().strip()
    if plan_id not in PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan. Choose from: {list(PLANS.keys())}")
    plan = PLANS[plan_id]
    if int(plan.get("amount") or 0) <= 0 and plan_id != "enterprise":
        raise HTTPException(status_code=503, detail="Pricing is not configured for this plan")

    user_id = current_user["id"]
    sb = _get_service_supabase()

    # Verify the customer_id belongs to this user (anti-tamper — the
    # client sends customer_id back to us, so we must validate it matches
    # metadata.user_id on Stripe's side).
    try:
        customer = stripe.Customer.retrieve(req.customer_id)
    except stripe.error.InvalidRequestError:
        raise HTTPException(status_code=404, detail="Customer not found")

    if (customer.metadata or {}).get("user_id") != user_id:
        logger.warning(
            "Customer ownership mismatch: user=%s attempted customer=%s (owner=%s)",
            user_id, req.customer_id, (customer.metadata or {}).get("user_id"),
        )
        raise HTTPException(status_code=403, detail="Customer does not belong to this user")

    # Idempotency — return existing subscription if user already has one.
    try:
        row_res = (
            sb.table("users")
            .select("subscription_status,subscription_tier,trial_ends_at,account_id")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        existing_row = (row_res.data or [{}])[0] if row_res.data else {}
    except Exception:
        existing_row = {}
    if existing_row.get("subscription_status") in ("active", "trialing"):
        return {
            "status": existing_row.get("subscription_status"),
            "tier": existing_row.get("subscription_tier"),
            "trial_ends_at": existing_row.get("trial_ends_at"),
            "already_subscribed": True,
        }

    # Revenue-leak defense: only grant a trial to users who have never
    # held any subscription (active/trialing/past_due/canceled). Returning
    # customers must upgrade via /pricing, which uses the non-trial
    # Checkout path.
    confirm_trial_decision = _trial_decision_for_user(sb, user_id, account_id=existing_row.get("account_id"))
    trial_days = int(confirm_trial_decision.get("trial_days") or 0)
    if confirm_trial_decision.get("reason") == "trial_eligibility_unverified":
        raise HTTPException(
            status_code=503,
            detail="Trial eligibility could not be verified right now. Please continue from pricing without trial.",
        )
    if trial_days == 0:
        # Defense-in-depth: /signup-create-setup-intent should have already
        # blocked this path. If we get here, refuse rather than silently
        # creating a no-trial subscription that the user didn't consent to.
        raise HTTPException(
            status_code=409,
            detail="This account has already used its 14-day trial. Please upgrade from the pricing page instead.",
        )

    try:
        # The SetupIntent (created with customer=...) already attached the
        # payment method on client-side confirmation. We only need to set it
        # as the customer's default for off_session charges at trial-end.
        # An explicit PaymentMethod.attach here would error with "already
        # attached" — so we skip it.
        stripe.Customer.modify(
            req.customer_id,
            invoice_settings={"default_payment_method": req.payment_method_id},
        )

        stripe_price = _resolve_active_monthly_price(plan_id, plan)

        # Idempotency key — concurrent retries (double-submit, network
        # retry, two tabs) return the SAME subscription from Stripe instead
        # of racing past our pre-check and creating duplicates. Key is
        # scoped to user_id + plan_id + the payment_method so re-running
        # with a new card still works, but the same-card retry dedupes.
        # Codex P2: "concurrent retries ... can race past the pre-check".
        subscription = stripe.Subscription.create(
            customer=req.customer_id,
            items=[{"price": stripe_price["id"]}],
            trial_period_days=trial_days,
            default_payment_method=req.payment_method_id,
            metadata={
                "user_id": user_id,
                "tier": plan["tier"],
                "source": "biqc_signup",
                "trial_days": str(trial_days),
                "stripe_product_id": stripe_price["product_id"],
                "stripe_price_id": stripe_price["id"],
            },
            idempotency_key=f"biqc-signup-sub-{user_id}-{plan_id}-{req.payment_method_id[-8:]}",
        )

        trial_end_iso = None
        if getattr(subscription, "trial_end", None):
            trial_end_iso = datetime.fromtimestamp(subscription.trial_end, tz=timezone.utc).isoformat()

        # Capture current_period_end from Stripe so the app shows when the
        # next charge will happen. For a trialing subscription, Stripe returns
        # trial_end + period_start + period_end = trial_end (all coincide).
        # After the trial ends, invoice.payment_succeeded webhook refreshes
        # this each billing cycle.
        current_period_end_iso = None
        cpe = getattr(subscription, "current_period_end", None)
        if cpe:
            current_period_end_iso = datetime.fromtimestamp(cpe, tz=timezone.utc).isoformat()

        _apply_tier_upgrade(sb, user_id, plan["tier"])
        _update_subscription_lifecycle(
            sb, user_id,
            status=subscription.status,
            stripe_customer_id=req.customer_id,
            stripe_subscription_id=subscription.id,
            trial_ends_at=trial_end_iso,
            current_period_end=current_period_end_iso,
            past_due_since=None,
        )

        try:
            sb.table("payment_transactions").insert({
                "user_id": user_id,
                "session_id": subscription.id,
                "amount": plan["amount"] / 100,
                "currency": plan["currency"],
                "package_id": plan_id,
                "tier": plan["tier"],
                "payment_status": "trialing" if subscription.status == "trialing" else subscription.status,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "stripe_customer_id": req.customer_id,
                "stripe_subscription_id": subscription.id,
            }).execute()
        except Exception as exc:
            logger.warning("payment_transactions insert failed for signup: %s", exc)

        # Branch on OAuth vs email+password signup:
        #   - Email+password: E1 verification flow (user must click link)
        #   - OAuth (google/azure): E2 welcome directly, email already
        #     verified by the provider (migration 110 flips the flag at
        #     public.users insert time).
        # Both are fire-and-forget so a Resend outage never blocks the
        # user from reaching the app.
        try:
            row = sb.table("users").select(
                "email,full_name,email_verified_by_user,subscription_tier,trial_ends_at"
            ).eq("id", user_id).limit(1).execute()
            user_row = (row.data or [{}])[0] if row.data else {}
            already_verified = bool(user_row.get("email_verified_by_user"))

            if already_verified:
                # OAuth path — skip E1, send E2 welcome instead.
                from services.email_service import send_verified_email
                from routes.email_verification import (
                    plan_display_name, format_date_long, format_currency,
                )
                send_verified_email(
                    to=user_row.get("email"),
                    full_name=user_row.get("full_name") or "",
                    plan_name=plan_display_name(user_row.get("subscription_tier") or plan["tier"]),
                    first_charge_date=format_date_long(user_row.get("trial_ends_at")),
                    first_charge_amount=format_currency(plan["amount"], plan.get("currency", "AUD"), from_cents=True),
                )
                logger.info("[signup] oauth user — sent E2 welcome (no E1) user=%s", user_id)
            else:
                from routes.email_verification import issue_verification_email_for_user
                issue_result = issue_verification_email_for_user(sb, user_id)
                logger.info("[signup] verification email issue status=%s user=%s",
                            issue_result.get("status"), user_id)
        except Exception as exc:
            logger.warning("[signup] post-signup email send failed for %s: %s", user_id, exc)

        return {
            "status": subscription.status,
            "tier": plan["tier"],
            "subscription_id": subscription.id,
            "trial_ends_at": trial_end_iso,
            "already_subscribed": False,
        }

    except stripe.error.CardError as exc:
        logger.warning("Card declined at signup: %s", getattr(exc, "user_message", str(exc)))
        raise HTTPException(
            status_code=402,
            detail=f"Card declined: {getattr(exc, 'user_message', None) or 'Please try another card.'}",
        )
    except stripe.error.StripeError as exc:
        logger.error("Subscription creation failed at signup for user %s: %s", user_id, exc)
        raise HTTPException(status_code=502, detail="Could not create subscription. Please try again.")


def _resolve_stripe_customer_for_portal(sb, user_id: str, user_email: str) -> Optional[str]:
    """Return the Stripe customer_id to use for the portal session.

    Lookup order (Step 11 / P1-10 — cancelled + free users must reach
    the portal):
      1. users.stripe_customer_id — the canonical link written by
         checkout / webhooks. A cancelled user still has this populated
         so they can reach their invoice history.
      2. Stripe Customer.list(email=…) — covers the edge case where
         the webhook never linked the customer to the user row (pre-096
         data, or a signature-verification failure at checkout time).
         We cache the match back to the users row so the next portal
         hit skips the API round-trip.
      3. None — caller decides whether to create a new customer or
         return a "no billing history" signal.

    We never silently create a customer here: a free user who has
    genuinely never transacted gets an explicit message from the caller
    rather than an orphan Stripe customer row that dashboards will later
    have to clean up.
    """
    # 1. DB cache — single-row read, keyed on PK.
    try:
        res = (
            sb.table("users")
            .select("stripe_customer_id")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        rows = (getattr(res, "data", None) or [])
        cached = (rows[0] or {}).get("stripe_customer_id") if rows else None
        if cached:
            return cached
    except Exception as exc:  # pragma: no cover — DB outage falls through
        logger.warning("[Portal] users.stripe_customer_id lookup failed for %s: %s", user_id, exc)

    # 2. Email lookup in Stripe. Skip if email is empty — Stripe will
    # happily return all customers with no email filter, and picking
    # "first one" in that case is a bug waiting to happen.
    if not user_email:
        return None
    try:
        listing = stripe.Customer.list(email=user_email, limit=1)
        if listing.data:
            customer_id = listing.data[0].id
            # Cache back to users row so the next call hits path 1.
            try:
                sb.table("users").update({"stripe_customer_id": customer_id}).eq("id", user_id).execute()
            except Exception as exc:  # pragma: no cover — best-effort cache
                logger.warning("[Portal] cache of stripe_customer_id failed for %s: %s", user_id, exc)
            return customer_id
    except Exception as exc:
        logger.warning("[Portal] Stripe Customer.list failed for %s: %s", user_email, exc)

    return None


@router.post("/stripe/portal-session")
@router.post("/billing/portal")  # convenience alias
async def create_portal_session(request: Request, current_user: dict = Depends(get_current_user)):
    """Open a Stripe Customer Portal session.

    Step 11 (P1-10) — cancelled and free users must be able to reach
    the portal. A cancelled customer still needs access to past invoices
    and to reactivate; a truly-new free user gets a clear "no billing
    history yet — upgrade to start" response instead of an orphan
    Stripe customer being silently created.

    Resolution order (see `_resolve_stripe_customer_for_portal`):
      1. users.stripe_customer_id (canonical, populated by webhooks)
      2. Stripe Customer.list by email (covers pre-migration gaps)
      3. Create a new Stripe customer, cache the id back to users

    Error semantics:
      • 503 — STRIPE_API_KEY not set (misconfiguration)
      • 400 — Stripe portal not configured in the dashboard (returned
              as a clear message so ops know where to click)
      • 502 — transient Stripe outage; client should retry
    """
    if not STRIPE_KEY:
        raise HTTPException(status_code=503, detail="Stripe is not configured")

    user_email = (current_user.get("email") or "").strip()
    user_id = current_user["id"]

    # Lazy import so unit tests that stub routes.deps don't fail here.
    try:
        from routes.deps import get_sb
        sb = get_sb()
    except Exception as exc:  # pragma: no cover — dev envs without Supabase
        logger.warning("[Portal] Supabase unavailable: %s", exc)
        sb = None

    try:
        customer_id = None
        if sb is not None:
            customer_id = _resolve_stripe_customer_for_portal(sb, user_id, user_email)

        # Fallback: no DB, or no row matched and no Stripe customer exists
        # for this email. Create one so the user can add a payment method
        # for the first time. We cache back to the DB if it's reachable.
        if not customer_id:
            if not user_email:
                raise HTTPException(
                    status_code=400,
                    detail="A verified email is required to open the billing portal.",
                )
            customer = stripe.Customer.create(
                email=user_email,
                metadata={"biqc_user_id": user_id},
            )
            customer_id = customer.id
            if sb is not None:
                try:
                    sb.table("users").update({"stripe_customer_id": customer_id}).eq("id", user_id).execute()
                except Exception as exc:  # pragma: no cover — best-effort cache
                    logger.warning("[Portal] cache of new customer id failed for %s: %s", user_id, exc)

        configured_base = (os.environ.get("FRONTEND_URL") or "").strip() or "https://biqc.ai"
        return_url = f"{configured_base}/billing"

        portal_session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )
        return {"url": portal_session.url}

    except HTTPException:
        raise
    except stripe.error.InvalidRequestError as e:
        # This is what Stripe throws when the portal hasn't been
        # configured in the dashboard yet (common on a fresh account).
        # Surface a message ops can act on rather than a generic 400.
        msg = str(e) or "Billing portal is not yet configured."
        logger.error(f"[Portal] Stripe rejected session creation: {msg}")
        detail = (
            "Billing portal is not available. If you just launched, an admin must "
            "configure the Customer Portal in the Stripe dashboard. Users with no "
            "prior subscription will need to upgrade first."
        )
        raise HTTPException(status_code=400, detail=detail)
    except stripe.error.APIConnectionError as e:
        logger.error(f"[Portal] Stripe connectivity failed: {e}")
        raise HTTPException(status_code=502, detail="Stripe is temporarily unavailable. Please try again.")
    except Exception as e:
        logger.error(f"[Portal] session creation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to open billing portal")


def _try_record_webhook_event(sb, event) -> str:
    """Insert a row keyed by event_id. Return the processing_status:
       - 'duplicate_skipped' if the event was already processed (idempotent skip)
       - 'pending' if this is the first time we've seen it
       - 'failed' if the bookkeeping insert itself errored (we still process)
    """
    try:
        try:
            payload = event.to_dict() if hasattr(event, "to_dict") else dict(event)
        except Exception:
            payload = {"id": getattr(event, "id", None), "type": getattr(event, "type", None)}

        # Pull customer/subscription IDs out of the event payload if present.
        obj = (payload.get("data") or {}).get("object") or {}
        customer_id = obj.get("customer") if isinstance(obj, dict) else None
        subscription_id = (
            obj.get("subscription") if isinstance(obj, dict) and obj.get("subscription") else
            (obj.get("id") if isinstance(obj, dict) and obj.get("object") == "subscription" else None)
        )
        user_id = None
        meta = obj.get("metadata") if isinstance(obj, dict) else None
        if isinstance(meta, dict):
            user_id = meta.get("user_id") or None

        # Idempotency check: PRIMARY KEY on event_id forces a single row.
        existing = (
            sb.table("stripe_webhook_events")
            .select("event_id, processing_status")
            .eq("event_id", event.id)
            .maybe_single()
            .execute()
        )
        if existing and getattr(existing, "data", None):
            status = (existing.data or {}).get("processing_status") or "duplicate_skipped"
            if status == "processed":
                return "duplicate_skipped"

        sb.table("stripe_webhook_events").upsert(
            {
                "event_id": event.id,
                "event_type": event.type,
                "received_at": datetime.now(timezone.utc).isoformat(),
                "user_id": user_id,
                "customer_id": customer_id,
                "subscription_id": subscription_id,
                "raw_payload": payload,
                "processing_status": "pending",
            },
            on_conflict="event_id",
        ).execute()
        return "pending"
    except Exception as exc:
        logger.warning("stripe_webhook_events bookkeeping failed for %s: %s", getattr(event, "id", "?"), exc)
        return "failed"


def _mark_webhook_event(sb, event_id: str, status: str) -> None:
    try:
        sb.table("stripe_webhook_events").update({
            "processing_status": status,
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("event_id", event_id).execute()
    except Exception as exc:  # pragma: no cover - best-effort audit trail
        logger.warning("Failed to mark webhook event %s as %s: %s", event_id, status, exc)


# Sentinel to distinguish "don't touch this column" from "set it to NULL"
# in _update_subscription_lifecycle. None is a real, meaningful payload
# (e.g. past_due_since=None clears the dunning timestamp on a successful
# recurring charge); we need a third state to mean "skip".
_UNSET = object()


def _ts_from_epoch(value: Any) -> Optional[str]:
    """Convert a Stripe Unix-epoch timestamp to ISO-8601 UTC.

    Stripe emits period_end, trial_end, etc. as integer seconds since
    epoch. Postgres timestamptz wants an ISO string. Returns None on
    falsy or unparseable input so callers can pass Stripe payloads
    through defensively without a pre-guard.
    """
    if value is None:
        return None
    try:
        epoch = int(value)
    except (TypeError, ValueError):
        return None
    if epoch <= 0:
        return None
    return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat()


def _resolve_user_by_customer_id(sb, customer_id: Optional[str]) -> Optional[str]:
    """Resolve user_id from a Stripe customer id (cus_…).

    Lookup order:
      1. users.stripe_customer_id — cached on the row at checkout /
         invoice receipt, single-row primary-key-ish read.
      2. payment_transactions.stripe_customer_id — fallback for legacy
         rows written before migration 096 added the users column.

    Returns None if the customer id is blank or no row matches.
    """
    if not customer_id:
        return None
    try:
        res = (
            sb.table("users")
            .select("id")
            .eq("stripe_customer_id", customer_id)
            .limit(1)
            .execute()
        )
        rows = (res.data or []) if res is not None else []
        if rows:
            return (rows[0] or {}).get("id")
    except Exception as exc:  # pragma: no cover — lookup is best-effort
        logger.warning("users.stripe_customer_id lookup failed for %s: %s", customer_id, exc)

    try:
        res = (
            sb.table("payment_transactions")
            .select("user_id")
            .eq("stripe_customer_id", customer_id)
            .limit(1)
            .execute()
        )
        rows = (res.data or []) if res is not None else []
        if rows:
            return (rows[0] or {}).get("user_id")
    except Exception as exc:  # pragma: no cover
        logger.warning(
            "payment_transactions.stripe_customer_id lookup failed for %s: %s",
            customer_id, exc,
        )
    return None


def _update_subscription_lifecycle(
    sb,
    user_id: str,
    *,
    status: Any = _UNSET,
    current_period_end: Any = _UNSET,
    past_due_since: Any = _UNSET,
    trial_ends_at: Any = _UNSET,
    stripe_customer_id: Any = _UNSET,
    stripe_subscription_id: Any = _UNSET,
) -> None:
    """Write only the non-UNSET lifecycle fields to users.

    Pass `_UNSET` (the default) to leave a column alone; pass `None` to
    explicitly null it. This three-state contract is what stops the
    invoice.payment_succeeded path from clobbering a populated
    current_period_end when the event shape happens to omit it.
    """
    payload: Dict[str, Any] = {}
    if status is not _UNSET:
        payload["subscription_status"] = status
    if current_period_end is not _UNSET:
        payload["current_period_end"] = current_period_end
    if past_due_since is not _UNSET:
        payload["past_due_since"] = past_due_since
    if trial_ends_at is not _UNSET:
        payload["trial_ends_at"] = trial_ends_at
    if stripe_customer_id is not _UNSET:
        payload["stripe_customer_id"] = stripe_customer_id
    if stripe_subscription_id is not _UNSET:
        payload["stripe_subscription_id"] = stripe_subscription_id
    if not payload:
        return
    try:
        sb.table("users").update(payload).eq("id", user_id).execute()
    except Exception as exc:
        logger.error(
            "users lifecycle update failed for %s: %s (payload=%s)",
            user_id, exc, payload,
        )


def _get_past_due_since(sb, user_id: str) -> Optional[str]:
    """Return users.past_due_since for a user, or None. Best-effort — any
    Supabase failure returns None so callers treat it as a fresh dunning
    cycle rather than crashing the webhook."""
    try:
        res = (
            sb.table("users")
            .select("past_due_since")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        rows = (res.data or []) if res is not None else []
        return ((rows[0] or {}).get("past_due_since")) if rows else None
    except Exception:
        return None


def _read_user_snapshot_for_email(sb, user_id: str) -> Dict[str, Any]:
    """Return email + full_name + current lifecycle state for webhook email
    decisions. Used to (a) know whether the user was trialing vs active
    BEFORE we flip the status on a cancellation/suspension event, and
    (b) carry the email/name into the send_* calls.

    All reads in one query; empty dict on failure (best-effort — a webhook
    should never 500 because we couldn't read a user row for an email)."""
    if not user_id:
        return {}
    try:
        res = (
            sb.table("users")
            .select(
                "id,email,full_name,subscription_tier,subscription_status,"
                "trial_ends_at,current_period_end"
            )
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        rows = (res.data or []) if res is not None else []
        return (rows[0] or {}) if rows else {}
    except Exception as exc:
        logger.warning("[email] snapshot read failed for %s: %s", user_id, exc)
        return {}


def _downgrade_user_tier(sb, customer_id: Optional[str], subscription_id: Optional[str]) -> None:
    """On subscription cancellation, drop the user back to free tier.

    Also records subscription_status='canceled' and clears current_period_end
    / past_due_since so the dunning / period-end UI stops showing stale
    paid-state data.
    """
    if not customer_id and not subscription_id:
        return
    try:
        user_id = _resolve_user_by_customer_id(sb, customer_id)
        if not user_id and subscription_id:
            rows = (
                sb.table("payment_transactions")
                .select("user_id")
                .eq("stripe_subscription_id", subscription_id)
                .limit(1)
                .execute()
            )
            user_id = ((rows.data or [{}])[0] or {}).get("user_id")
        if not user_id:
            logger.info("subscription cancel: no user matched cust=%s sub=%s", customer_id, subscription_id)
            return
        _apply_tier_upgrade(sb, user_id, "free")
        _update_subscription_lifecycle(
            sb, user_id,
            status="canceled",
            current_period_end=None,
            past_due_since=None,
        )
        logger.info("Subscription cancelled — user %s downgraded to free", user_id)
    except Exception as exc:
        logger.error("Subscription cancellation downgrade failed: %s", exc)


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events.

    Idempotency: every event is recorded in `stripe_webhook_events` keyed by
    `event_id`. A duplicate Stripe retry will short-circuit with no side
    effects. Without this, retries can re-apply tier upgrades, double-charge
    counters, or revert a manual override.
    """
    if not STRIPE_WEBHOOK_SECRET:
        logger.error("Webhook rejected: STRIPE_WEBHOOK_SECRET is not configured")
        raise HTTPException(status_code=503, detail="Stripe webhook is not configured")
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        if not signature:
            raise HTTPException(status_code=400, detail="Missing Stripe-Signature header")
        event = stripe.Webhook.construct_event(body, signature, STRIPE_WEBHOOK_SECRET)

        logger.info("Stripe webhook: %s (%s)", event.type, event.id)

        sb = _get_service_supabase()
        bookkeeping_status = _try_record_webhook_event(sb, event)
        if bookkeeping_status == "duplicate_skipped":
            logger.info("Stripe webhook %s already processed — skipping", event.id)
            return {"received": True, "duplicate": True}

        try:
            if event.type == "checkout.session.completed":
                session = event.data.object
                if session.payment_status == "paid":
                    # Enrich the payment_transactions row with the now-known
                    # customer + subscription IDs so later cancellation /
                    # dunning webhooks can resolve the user back via these
                    # linkage columns (see migration 095).
                    update_payload = {
                        "payment_status": "paid",
                        "paid_at": datetime.now(timezone.utc).isoformat(),
                    }
                    customer_id = getattr(session, "customer", None)
                    subscription_id = getattr(session, "subscription", None)
                    if customer_id:
                        update_payload["stripe_customer_id"] = customer_id
                    if subscription_id:
                        update_payload["stripe_subscription_id"] = subscription_id
                    sb.table("payment_transactions").update(update_payload).eq(
                        "session_id", session.id
                    ).execute()

                    user_id = (session.metadata or {}).get("user_id")
                    if user_id:
                        _apply_tier_upgrade(sb, user_id, (session.metadata or {}).get("tier", "starter"))
                        # Cache the customer id on the user row + flag active
                        # so downstream webhooks (invoice.*, subscription.*)
                        # can resolve without a payment_transactions join.
                        _update_subscription_lifecycle(
                            sb, user_id,
                            status="active",
                            past_due_since=None,
                            stripe_customer_id=customer_id,
                        )

            elif event.type == "payment_intent.succeeded":
                pi = event.data.object
                pi_id = getattr(pi, "id", None)
                if not pi_id:
                    logger.warning("payment_intent.succeeded received without id")
                else:
                    attempt = get_attempt_by_payment_intent(sb, payment_intent_id=pi_id)
                    if not attempt:
                        logger.info("payment_intent.succeeded with no topup attempt match pi=%s", pi_id)
                    else:
                        status = str(attempt.get("status") or "").lower()
                        if status != "succeeded":
                            mark_attempt_status(
                                sb,
                                attempt_id=attempt["id"],
                                status="succeeded",
                                stripe_invoice_id=getattr(pi, "invoice", None),
                            )
                        attempt["stripe_invoice_id"] = getattr(pi, "invoice", None)
                        grant_topup_tokens_once(sb, attempt=attempt)
                        clear_payment_required_on_success(sb, account_id=attempt["account_id"])

            elif event.type == "payment_intent.payment_failed":
                pi = event.data.object
                pi_id = getattr(pi, "id", None)
                if not pi_id:
                    logger.warning("payment_intent.payment_failed received without id")
                else:
                    attempt = get_attempt_by_payment_intent(sb, payment_intent_id=pi_id)
                    if not attempt:
                        logger.info("payment_intent.payment_failed with no topup attempt match pi=%s", pi_id)
                    else:
                        reason = (
                            getattr(getattr(pi, "last_payment_error", None), "code", None)
                            or getattr(getattr(pi, "last_payment_error", None), "message", None)
                            or "payment_failed"
                        )
                        mark_attempt_status(
                            sb,
                            attempt_id=attempt["id"],
                            status="failed",
                            failure_reason=str(reason),
                            stripe_invoice_id=getattr(pi, "invoice", None),
                        )
                        apply_failed_or_action_required_outcome(
                            sb,
                            account_id=attempt["account_id"],
                            tier=attempt["tier"],
                            cycle_start=str(attempt["cycle_start"]),
                            cycle_end=str(attempt["cycle_end"]),
                            failure_reason=str(reason),
                        )

            elif event.type == "payment_intent.requires_action":
                pi = event.data.object
                pi_id = getattr(pi, "id", None)
                if not pi_id:
                    logger.warning("payment_intent.requires_action received without id")
                else:
                    attempt = get_attempt_by_payment_intent(sb, payment_intent_id=pi_id)
                    if not attempt:
                        logger.info("payment_intent.requires_action with no topup attempt match pi=%s", pi_id)
                    else:
                        mark_attempt_status(
                            sb,
                            attempt_id=attempt["id"],
                            status="requires_action",
                            failure_reason="requires_action",
                            stripe_invoice_id=getattr(pi, "invoice", None),
                        )
                        apply_failed_or_action_required_outcome(
                            sb,
                            account_id=attempt["account_id"],
                            tier=attempt["tier"],
                            cycle_start=str(attempt["cycle_start"]),
                            cycle_end=str(attempt["cycle_end"]),
                            failure_reason="requires_action",
                        )

            elif event.type == "invoice.payment_succeeded":
                # Recurring charge cleared. Renew the paid-for period, flag
                # status=active, and clear any dunning timestamp so the
                # "payment failed" banner disappears. We do NOT touch
                # subscription_tier here — tier is set by the checkout flow
                # and kept until an explicit cancellation event.
                inv = event.data.object
                customer_id = getattr(inv, "customer", None)
                subscription_id = getattr(inv, "subscription", None)
                period_end_ts = _ts_from_epoch(getattr(inv, "period_end", None))
                user_id = _resolve_user_by_customer_id(sb, customer_id)
                if user_id:
                    # Capture pre-update snapshot so we can tell whether this
                    # is the trial→active transition (E5) or a recurring
                    # renewal (E7).
                    before = _read_user_snapshot_for_email(sb, user_id)
                    was_trialing = (before.get("subscription_status") or "").lower() == "trialing"

                    _update_subscription_lifecycle(
                        sb, user_id,
                        status="active",
                        current_period_end=period_end_ts,
                        past_due_since=None,
                        stripe_customer_id=customer_id,
                    )
                    logger.info(
                        "invoice.payment_succeeded: user=%s cust=%s sub=%s period_end=%s (was_trialing=%s)",
                        user_id, customer_id, subscription_id, period_end_ts, was_trialing,
                    )

                    # Emit E5 or E7 — best-effort.
                    try:
                        from services.email_service import (
                            send_trial_ended_paid_email, send_payment_receipt_email,
                        )
                        from routes.email_verification import (
                            plan_display_name, format_date_long, format_currency,
                        )
                        amount_paid_cents = getattr(inv, "amount_paid", None) or getattr(inv, "amount_due", 0)
                        currency_code = (getattr(inv, "currency", None) or "aud").upper()
                        amount_str = format_currency(amount_paid_cents, currency_code, from_cents=True)
                        invoice_url = (
                            getattr(inv, "hosted_invoice_url", None)
                            or getattr(inv, "invoice_pdf", None)
                            or "https://biqc.ai/settings/billing"
                        )
                        plan_name = plan_display_name(before.get("subscription_tier"))
                        next_charge_date = format_date_long(period_end_ts)
                        to_email = before.get("email")
                        to_name = before.get("full_name") or ""

                        # amount_paid_cents == 0 indicates a $0 trial-start
                        # invoice (Stripe issues one when a subscription is
                        # created with trial_period_days). Skip the email —
                        # the E1 verification email already covers this.
                        if to_email and (amount_paid_cents or 0) > 0:
                            if was_trialing:
                                send_trial_ended_paid_email(
                                    to=to_email, full_name=to_name,
                                    amount=amount_str, plan_name=plan_name,
                                    next_charge_date=next_charge_date,
                                    invoice_url=invoice_url,
                                )
                            else:
                                invoice_number = (
                                    getattr(inv, "number", None)
                                    or f"INV-{(subscription_id or '')[-8:]}"
                                )
                                paid_date = format_date_long(
                                    _ts_from_epoch(getattr(inv, "status_transitions", {}).get("paid_at", None))
                                    if isinstance(getattr(inv, "status_transitions", None), dict)
                                    else None
                                )
                                if paid_date == "—":
                                    paid_date = format_date_long(datetime.now(timezone.utc).isoformat())
                                send_payment_receipt_email(
                                    to=to_email, full_name=to_name,
                                    amount=amount_str, plan_name=plan_name,
                                    invoice_number=invoice_number, paid_date=paid_date,
                                    next_charge_date=next_charge_date,
                                    invoice_url=invoice_url,
                                )
                    except Exception as email_exc:
                        logger.warning("[email] payment_succeeded email send failed user=%s: %s",
                                       user_id, email_exc)
                else:
                    logger.warning(
                        "invoice.payment_succeeded: no user resolved for cust=%s sub=%s — skipping lifecycle update",
                        customer_id, subscription_id,
                    )

            elif event.type == "invoice.payment_failed":
                # Dunning started. Set subscription_status=past_due and stamp
                # past_due_since on the FIRST failure only — preserving the
                # original timestamp across retries lets us measure time-in-
                # dunning and enforce a grace window before revoking tier.
                # Tier revocation stays owned by customer.subscription.deleted
                # / updated(status=unpaid|canceled|incomplete_expired).
                inv = event.data.object
                customer_id = getattr(inv, "customer", None)
                subscription_id = getattr(inv, "subscription", None)
                attempt_count = getattr(inv, "attempt_count", None)
                user_id = _resolve_user_by_customer_id(sb, customer_id)
                if user_id:
                    existing = _get_past_due_since(sb, user_id)
                    now_iso = datetime.now(timezone.utc).isoformat()
                    _update_subscription_lifecycle(
                        sb, user_id,
                        status="past_due",
                        past_due_since=(existing or now_iso),
                        stripe_customer_id=customer_id,
                    )
                    logger.warning(
                        "invoice.payment_failed: user=%s cust=%s sub=%s attempt=%s",
                        user_id, customer_id, subscription_id, attempt_count,
                    )

                    # E8 payment failed — best-effort.
                    try:
                        from services.email_service import send_payment_failed_email
                        from routes.email_verification import (
                            plan_display_name, format_date_long, format_currency,
                        )
                        before = _read_user_snapshot_for_email(sb, user_id)
                        amount_cents = getattr(inv, "amount_due", None) or getattr(inv, "amount_paid", 0)
                        currency_code = (getattr(inv, "currency", None) or "aud").upper()
                        amount_str = format_currency(amount_cents, currency_code, from_cents=True)
                        retry_ts = _ts_from_epoch(getattr(inv, "next_payment_attempt", None))
                        retry_date = format_date_long(retry_ts) if retry_ts else "the next retry date"
                        to_email = before.get("email")
                        to_name = before.get("full_name") or ""
                        if to_email:
                            send_payment_failed_email(
                                to=to_email, full_name=to_name,
                                amount=amount_str,
                                plan_name=plan_display_name(before.get("subscription_tier")),
                                retry_date=retry_date,
                            )
                    except Exception as email_exc:
                        logger.warning("[email] E8 send failed user=%s: %s", user_id, email_exc)
                else:
                    logger.warning(
                        "invoice.payment_failed: no user resolved for cust=%s sub=%s — event recorded only",
                        customer_id, subscription_id,
                    )

            elif event.type == "customer.subscription.trial_will_end":
                # Stripe fires this ~3 days before a trial ends. Refresh
                # trial_ends_at so /billing/overview can render the countdown
                # without an extra Stripe round-trip.
                sub = event.data.object
                customer_id = getattr(sub, "customer", None)
                trial_end_ts = _ts_from_epoch(getattr(sub, "trial_end", None))
                user_id = _resolve_user_by_customer_id(sb, customer_id)
                if user_id:
                    _update_subscription_lifecycle(
                        sb, user_id,
                        trial_ends_at=trial_end_ts,
                        stripe_customer_id=customer_id,
                    )
                logger.info(
                    "customer.subscription.trial_will_end: user=%s cust=%s trial_end=%s",
                    user_id, customer_id, trial_end_ts,
                )

            elif event.type == "customer.subscription.updated":
                sub = event.data.object
                status = getattr(sub, "status", "") or ""
                customer_id = getattr(sub, "customer", None)
                subscription_id = getattr(sub, "id", None)
                current_period_end_ts = _ts_from_epoch(getattr(sub, "current_period_end", None))
                trial_end_ts = _ts_from_epoch(getattr(sub, "trial_end", None))
                # Stripe's EventData is a StripeObject (dict-like); read
                # previous_attributes via both attribute + dict access so
                # API-version quirks don't silently drop plan-change info.
                prev_attrs: Dict[str, Any] = {}
                try:
                    prev_attrs = (
                        getattr(event.data, "previous_attributes", None)
                        or (event.data.get("previous_attributes") if hasattr(event.data, "get") else None)
                        or {}
                    )
                except Exception:
                    prev_attrs = {}

                if status in {"canceled", "unpaid", "incomplete_expired"}:
                    # Capture pre-downgrade state so we can decide E9 vs E10.
                    pre_user_id = _resolve_user_by_customer_id(sb, customer_id)
                    pre_snapshot = _read_user_snapshot_for_email(sb, pre_user_id) if pre_user_id else {}

                    # Terminal state → revoke tier + mark canceled.
                    _downgrade_user_tier(sb, customer_id, subscription_id)

                    # E9 account_suspended specifically for status="unpaid"
                    # (dunning exhausted). "canceled" / "incomplete_expired"
                    # fall through to customer.subscription.deleted emission
                    # (E10) so we don't double-send.
                    if status == "unpaid" and pre_snapshot.get("email"):
                        try:
                            from services.email_service import send_account_suspended_email
                            from routes.email_verification import plan_display_name
                            send_account_suspended_email(
                                to=pre_snapshot["email"],
                                full_name=pre_snapshot.get("full_name") or "",
                                plan_name=plan_display_name(pre_snapshot.get("subscription_tier")),
                            )
                        except Exception as email_exc:
                            logger.warning("[email] E9 send failed user=%s: %s", pre_user_id, email_exc)
                else:
                    # Non-terminal tick → refresh lifecycle state so the app
                    # reflects Stripe's truth (trialing→active transition,
                    # renewal period advancing, paused→active resume, etc.).
                    #
                    # 2026-04-20: use _UNSET when the event payload omits a
                    # timestamp column. Some Stripe API versions (clover) place
                    # period_start/end on items[0] instead of the root, and
                    # their absence from the root should NOT be interpreted
                    # as "clear this column". The confirm-trial-signup path
                    # has already written a valid current_period_end; the
                    # webhook must not clobber it with None.
                    user_id = _resolve_user_by_customer_id(sb, customer_id)
                    if user_id:
                        # Read snapshot BEFORE update so we can detect plan
                        # change (E11) by comparing the pre-webhook tier with
                        # what the event now advertises. Plan changes come
                        # through this branch when a user self-serves via the
                        # customer portal.
                        pre_snapshot = _read_user_snapshot_for_email(sb, user_id)

                        _update_subscription_lifecycle(
                            sb, user_id,
                            status=(status or None),
                            current_period_end=(current_period_end_ts if current_period_end_ts else _UNSET),
                            trial_ends_at=(trial_end_ts if trial_end_ts else _UNSET),
                            stripe_customer_id=customer_id,
                            stripe_subscription_id=subscription_id,
                        )

                        # E11 plan change — fire only when items[] changed.
                        # `previous_attributes.items` being present is
                        # Stripe's signal that the subscription line-items
                        # were swapped.
                        plan_changed = bool(prev_attrs.get("items") or prev_attrs.get("plan"))
                        if plan_changed and pre_snapshot.get("email"):
                            try:
                                from services.email_service import send_plan_changed_email
                                from routes.email_verification import (
                                    plan_display_name, format_date_long, format_currency,
                                )
                                # Extract new plan info from the subscription's
                                # first item. price.unit_amount is in cents,
                                # price.recurring.interval is month|year.
                                new_plan_name = "your plan"
                                new_amount_str = "—"
                                try:
                                    items = getattr(sub, "items", None)
                                    items_data = getattr(items, "data", []) if items else []
                                    if items_data:
                                        price = getattr(items_data[0], "price", None)
                                        product_id = getattr(price, "product", None) if price else None
                                        # Product lookup is best-effort — if
                                        # Stripe returns an id we ask for its
                                        # display name, otherwise fall back to
                                        # metadata.tier on the sub.
                                        try:
                                            if product_id:
                                                product = stripe.Product.retrieve(product_id)
                                                new_plan_name = plan_display_name(getattr(product, "name", None))
                                        except Exception:
                                            pass
                                        if new_plan_name == "your plan":
                                            new_plan_name = plan_display_name(
                                                (getattr(sub, "metadata", None) or {}).get("tier")
                                            )
                                        if price:
                                            new_amount_str = format_currency(
                                                getattr(price, "unit_amount", None),
                                                getattr(price, "currency", "aud") or "aud",
                                                from_cents=True,
                                            )
                                except Exception as price_exc:
                                    logger.warning("[email] E11 price parse failed: %s", price_exc)

                                send_plan_changed_email(
                                    to=pre_snapshot["email"],
                                    full_name=pre_snapshot.get("full_name") or "",
                                    old_plan=plan_display_name(pre_snapshot.get("subscription_tier")),
                                    new_plan=new_plan_name,
                                    new_amount=new_amount_str,
                                    effective_date=format_date_long(current_period_end_ts or datetime.now(timezone.utc).isoformat()),
                                )
                            except Exception as email_exc:
                                logger.warning("[email] E11 send failed user=%s: %s", user_id, email_exc)

            elif event.type == "customer.subscription.deleted":
                sub = event.data.object
                customer_id_d = getattr(sub, "customer", None)
                subscription_id_d = getattr(sub, "id", None)

                # Capture pre-delete snapshot so we can route E6 vs E10 based
                # on whether the user was trialing (never converted → E6 trial
                # cancelled) or active (was paying → E10 subscription cancelled).
                pre_user_id = _resolve_user_by_customer_id(sb, customer_id_d)
                pre_snapshot = _read_user_snapshot_for_email(sb, pre_user_id) if pre_user_id else {}
                was_trialing = (pre_snapshot.get("subscription_status") or "").lower() == "trialing"

                _downgrade_user_tier(sb, customer_id_d, subscription_id_d)

                if pre_snapshot.get("email"):
                    try:
                        from routes.email_verification import plan_display_name, format_date_long
                        plan_name = plan_display_name(pre_snapshot.get("subscription_tier"))
                        if was_trialing:
                            from services.email_service import send_trial_cancelled_email
                            send_trial_cancelled_email(
                                to=pre_snapshot["email"],
                                full_name=pre_snapshot.get("full_name") or "",
                                plan_name=plan_name,
                            )
                        else:
                            from services.email_service import send_subscription_cancelled_email
                            # When cancel_at_period_end was True, Stripe
                            # actually deletes on period_end — so the
                            # current_period_end in Stripe's object is the
                            # moment of deletion (≈ now). Fall back to the
                            # user's cached current_period_end if present.
                            access_end_ts = (
                                _ts_from_epoch(getattr(sub, "current_period_end", None))
                                or pre_snapshot.get("current_period_end")
                                or datetime.now(timezone.utc).isoformat()
                            )
                            send_subscription_cancelled_email(
                                to=pre_snapshot["email"],
                                full_name=pre_snapshot.get("full_name") or "",
                                plan_name=plan_name,
                                access_end_date=format_date_long(access_end_ts),
                            )
                    except Exception as email_exc:
                        logger.warning("[email] E6/E10 send failed user=%s: %s", pre_user_id, email_exc)

            elif event.type == "charge.refunded":
                charge = event.data.object
                customer_id = getattr(charge, "customer", None) or ""
                charge_id = getattr(charge, "id", None) or ""
                amount_refunded = getattr(charge, "amount_refunded", 0)
                fully_refunded = getattr(charge, "refunded", False)
                logger.info("charge.refunded: charge=%s customer=%s amount=%s full=%s",
                            charge_id, customer_id, amount_refunded, fully_refunded)
                if customer_id:
                    user_id = _resolve_user_by_customer_id(sb, customer_id)
                    if user_id:
                        try:
                            sb.table("payment_transactions").update({
                                "payment_status": "refunded" if fully_refunded else "partial_refund",
                            }).eq("stripe_customer_id", customer_id).eq("payment_status", "paid").execute()
                        except Exception as e:
                            logger.warning("Refund update failed: %s", e)
                        if fully_refunded:
                            subscription_id = getattr(charge, "subscription", None) or ""
                            _downgrade_user_tier(sb, customer_id, subscription_id)
                            logger.info("Full refund → tier downgraded for %s", customer_id)

            elif event.type in ("charge.dispute.created", "charge.dispute.closed"):
                dispute = event.data.object
                logger.warning("Stripe dispute %s: reason=%s status=%s amount=%s",
                               getattr(dispute, "id", ""), getattr(dispute, "reason", ""),
                               getattr(dispute, "status", ""), getattr(dispute, "amount", ""))

            else:
                # Recognised event we don't act on yet — record but no-op.
                pass

            _mark_webhook_event(sb, event.id, "processed")

        except Exception as inner_exc:
            _mark_webhook_event(sb, event.id, "failed")
            logger.error("Webhook handler failed for %s (%s): %s", event.type, event.id, inner_exc)
            # Return 200 anyway to prevent Stripe from infinitely retrying a
            # poison event — the row is now in `failed` state for admin review.

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
