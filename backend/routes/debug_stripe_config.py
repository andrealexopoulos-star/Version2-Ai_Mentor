"""Debug route for Stripe env-var resolution diagnosis.

2026-04-20 P0 debug: after restart + Key Vault reference "enabled"
status in Azure Portal, /stripe/signup-create-setup-intent was still
returning 503 "Stripe is not configured for production". This route
exposes (WITHOUT LEAKING SECRETS) exactly what the running Python
process sees at module import time for STRIPE_API_KEY,
STRIPE_WEBHOOK_SECRET, and ENVIRONMENT. Gated behind service-role
token so only ops can hit it.

Never returns actual secret values. Only prefixes (first 8 chars)
and booleans. Safe to log, safe to share.

Delete this route once the Stripe config issue is resolved and
verified stable — it exists only for the post-restart triage.
"""

from fastapi import APIRouter, Header, HTTPException
import os

router = APIRouter()


def _first8(s: str) -> str:
    """First 8 chars of a string, safe for empty / None. Never reveals
    a full secret — 8 chars of a Stripe key is just the prefix (sk_live_,
    sk_test_, whsec_*)."""
    if not s:
        return ""
    return s[:8]


@router.get("/debug/stripe-config")
async def debug_stripe_config(authorization: str = Header(default="")):
    """Return the Stripe-config state the running process sees.

    Authorization required — must be the Supabase service_role key OR
    the BIQc ops token (if configured). No user auth; this is an ops
    endpoint.
    """
    # Simple gate: require that the caller knows the service-role key.
    # We don't want random users probing this endpoint.
    expected_tokens = [
        (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip(),
        (os.environ.get("SUPABASE_KEY") or "").strip(),
    ]
    expected_tokens = [t for t in expected_tokens if t]

    provided = ""
    if authorization.lower().startswith("bearer "):
        provided = authorization[7:].strip()

    if not expected_tokens or provided not in expected_tokens:
        raise HTTPException(status_code=401, detail="Service-role bearer required")

    # Read what the process sees RIGHT NOW (not the module-cached values
    # in stripe_payments.py — fresh os.environ.get so we know the live
    # state independent of import ordering).
    stripe_key = (os.environ.get("STRIPE_API_KEY") or "").strip()
    webhook_secret = (os.environ.get("STRIPE_WEBHOOK_SECRET") or "").strip()
    environment = (os.environ.get("ENVIRONMENT") or "").strip()
    production_flag = (os.environ.get("PRODUCTION") or "").strip()

    # Also read what stripe_payments.py cached at import time — to
    # catch cases where the env was blank at import and got populated
    # later.
    cached_stripe_key = ""
    cached_webhook_secret = ""
    try:
        from routes import stripe_payments as sp
        cached_stripe_key = (getattr(sp, "STRIPE_KEY", "") or "").strip()
        cached_webhook_secret = (getattr(sp, "STRIPE_WEBHOOK_SECRET", "") or "").strip()
    except Exception as e:
        cached_error = str(e)[:200]
    else:
        cached_error = None

    env_is_prod = (
        environment.lower() == "production"
        or production_flag.lower() in {"1", "true", "yes"}
    )

    stripe_key_live = stripe_key.startswith("sk_live_")
    stripe_key_test = stripe_key.startswith("sk_test_")

    # Replicate the _is_stripe_production_ready() logic so we can see
    # exactly what it would return.
    is_ready = True
    reason = "ok"
    if not stripe_key:
        is_ready = False
        reason = "STRIPE_KEY is empty at runtime"
    elif env_is_prod and stripe_key_test:
        is_ready = False
        reason = "ENVIRONMENT=production but STRIPE_KEY is a test key"
    elif env_is_prod and not webhook_secret:
        is_ready = False
        reason = "ENVIRONMENT=production but STRIPE_WEBHOOK_SECRET is empty"

    return {
        # Runtime values (what os.environ.get returns right now)
        "runtime": {
            "stripe_key_present": bool(stripe_key),
            "stripe_key_prefix": _first8(stripe_key),
            "stripe_key_is_live": stripe_key_live,
            "stripe_key_is_test": stripe_key_test,
            "webhook_secret_present": bool(webhook_secret),
            "webhook_secret_prefix": _first8(webhook_secret),
            "environment_value": environment or "(empty)",
            "production_flag": production_flag or "(empty)",
        },
        # Import-time cached values in stripe_payments.py
        "import_cache": {
            "stripe_key_present": bool(cached_stripe_key),
            "stripe_key_prefix": _first8(cached_stripe_key),
            "webhook_secret_present": bool(cached_webhook_secret),
            "webhook_secret_prefix": _first8(cached_webhook_secret),
            "import_error": cached_error,
        },
        # Derived state
        "derived": {
            "is_production": env_is_prod,
            "is_stripe_production_ready": is_ready,
            "reason": reason,
        },
    }
