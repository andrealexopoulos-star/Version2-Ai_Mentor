"""
Shared dependencies for route modules.
Extracted from server.py — zero logic changes.

All route modules import auth deps and shared state from here.
server.py calls init_route_deps() once at startup to inject globals.
"""
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging
import os
from datetime import datetime, timezone
from collections import defaultdict, deque
from threading import Lock

logger = logging.getLogger("server")
security = HTTPBearer()

# ─── AI Model Configuration (your own API keys) ──────────────────────────────
# Set OPENAI_API_KEY and GOOGLE_API_KEY in Azure App Service environment variables

OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "")  # Your own OpenAI key
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")  # Your own Google API key

# Model routing per task type — updated to gpt-5.4-pro + gemini-3-pro
AI_MODELS = {
    # Intelligence snapshot — parallel GPT-5.4 Pro + Gemini 3 Pro
    "snapshot_primary":    "gpt-5.4-pro",        # Deep financial/risk analysis
    "snapshot_market":     "gemini-3-pro-preview", # Market intelligence layer
    "snapshot_fast":       "gemini-3-flash-preview", # Quick pre-compute

    # Soundboard
    "soundboard_thinking": "gpt-5.4",            # Thinking mode (reasoning.effort=high)
    "soundboard_pro":      "gpt-5.4-pro",        # Pro mode
    "soundboard_instant":  "gpt-5.3",            # Instant mode (fast)
    "soundboard_fast":     "gemini-3-flash-preview", # Gemini fast

    # Platform insights
    "platform_insights":   "gpt-5.3",            # Platform-wide insights
    "market_intelligence": "gemini-3-pro-preview", # Market analysis

    # Calibration (critical first impression — use good models)
    "calibration":         "gpt-5.3",
    "calibration_psych":   "gpt-5.3",

    # Boardroom / War Room
    "boardroom":           "gpt-5.4-pro",
    "war_room":            "gpt-5.4-pro",

    # SOPs, Documents, Email
    "generation":          "gpt-5.3",
    "email_priority":      "gemini-3-flash-preview",

    # Legacy fallback
    "default":             "gpt-5.3",
}

# Keep backward-compatible AI_MODEL variable
AI_MODEL = AI_MODELS["default"]
AI_MODEL_ADVANCED = AI_MODELS["snapshot_primary"]

# ─── Rate Limits — FREE vs single PAID tier (starter) ─────────────────────────
TIER_LIMITS = {
    "free": {
        "soundboard_daily":    10,
        "snapshots_daily":     1,
        "sop_monthly":         2,
        "reports_monthly":     3,
        "trinity_daily":       0,
    },
    "starter": {
        "soundboard_daily":    -1,
        "snapshots_daily":     -1,
        "sop_monthly":         -1,
        "reports_monthly":     -1,
        "trinity_daily":       -1,
    },
}

RATE_LIMIT_FEATURE_LABELS = {
    "soundboard_daily": "Soundboard",
    "trinity_daily": "Trinity Soundboard",
    "boardroom_diagnosis": "Board Room Diagnosis",
    "war_room_ask": "War Room Ask",
}

# Single paid tier: generous limits for starter (BIQc Foundation)
TIER_RATE_LIMIT_DEFAULTS = {
    "free": {
        "soundboard_daily": {"monthly_limit": 80, "burst_limit": 4, "burst_window_seconds": 300},
        "trinity_daily": {"monthly_limit": 0, "burst_limit": 0, "burst_window_seconds": 300},
        "boardroom_diagnosis": {"monthly_limit": 20, "burst_limit": 3, "burst_window_seconds": 300},
        "war_room_ask": {"monthly_limit": 40, "burst_limit": 4, "burst_window_seconds": 300},
    },
    "starter": {
        "soundboard_daily": {"monthly_limit": 900, "burst_limit": 18, "burst_window_seconds": 300},
        "trinity_daily": {"monthly_limit": 180, "burst_limit": 10, "burst_window_seconds": 300},
        "boardroom_diagnosis": {"monthly_limit": 320, "burst_limit": 16, "burst_window_seconds": 300},
        "war_room_ask": {"monthly_limit": 700, "burst_limit": 18, "burst_window_seconds": 300},
    },
    "super_admin": {
        feature: {"monthly_limit": -1, "burst_limit": -1, "burst_window_seconds": 300}
        for feature in RATE_LIMIT_FEATURE_LABELS
    },
}

RATE_LIMIT_BURSTS = defaultdict(deque)
RATE_LIMIT_BURSTS_LOCK = Lock()


def _normalize_subscription_tier(tier: str | None) -> str:
    """Normalize DB subscription_tier to free | starter | super_admin. Single paid tier = starter."""
    tier_value = (tier or "free").lower().strip()
    if tier_value in ("superadmin", "super_admin"):
        return "super_admin"
    if tier_value in ("foundation", "growth", "starter", "professional", "enterprise", "custom"):
        return "starter"
    return tier_value if tier_value in TIER_RATE_LIMIT_DEFAULTS else "free"


def _merge_rate_limit_config(base_config, override_config):
    merged = {feature: dict(config) for feature, config in (base_config or {}).items()}
    for feature, override in (override_config or {}).items():
        if not isinstance(override, dict):
            continue
        merged.setdefault(feature, {})
        for field in ("monthly_limit", "burst_limit", "burst_window_seconds"):
            if override.get(field) is not None:
                merged[feature][field] = override.get(field)
    return merged


def get_user_rate_limit_state(sb, user_id: str):
    user_row = sb.table("users").select("id, email, subscription_tier").eq("id", user_id).maybe_single().execute()
    user_data = user_row.data or {}
    tier = _normalize_subscription_tier(user_data.get("subscription_tier"))
    admin_bypass = user_data.get("email") == "andre@thestrategysquad.com.au" or tier == "super_admin"

    override_config = {}
    operator_profile = {}
    try:
        operator_result = sb.table("user_operator_profile").select("operator_profile").eq("user_id", user_id).maybe_single().execute()
        operator_profile = (operator_result.data or {}).get("operator_profile") or {}
        override_config = operator_profile.get("rate_limits") or {}
    except Exception:
        pass

    base_config = TIER_RATE_LIMIT_DEFAULTS.get(tier, TIER_RATE_LIMIT_DEFAULTS["free"])
    effective_config = _merge_rate_limit_config(base_config, override_config)

    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).date().isoformat()
    usage_rows = []
    try:
        usage_result = sb.table("ai_usage_log").select("feature, count, date").eq("user_id", user_id).gte("date", month_start).execute()
        usage_rows = usage_result.data or []
    except Exception:
        usage_rows = []

    monthly_usage = {feature: 0 for feature in effective_config.keys()}
    for row in usage_rows:
        feature = row.get("feature")
        if feature not in monthly_usage:
            monthly_usage[feature] = 0
        monthly_usage[feature] += int(row.get("count") or 0)

    return {
        "user": user_data,
        "tier": tier,
        "admin_bypass": admin_bypass,
        "defaults": base_config,
        "overrides": override_config,
        "effective": effective_config,
        "monthly_usage": monthly_usage,
    }

async def check_rate_limit(user_id: str, feature: str, sb=None) -> bool:
    """Tier-aware monthly quota + burst protection. Raises HTTPException if blocked."""
    if not sb:
        return True  # Skip if no DB connection
    try:
        state = get_user_rate_limit_state(sb, user_id)
        if state.get("admin_bypass"):
            return True

        config = state["effective"].get(feature) or {"monthly_limit": 120, "burst_limit": 6, "burst_window_seconds": 300}
        monthly_limit = int(config.get("monthly_limit", 120))
        burst_limit = int(config.get("burst_limit", 6))
        burst_window = int(config.get("burst_window_seconds", 300))
        feature_label = RATE_LIMIT_FEATURE_LABELS.get(feature, feature.replace("_", " ").title())

        if monthly_limit == -1:
            return True  # Unlimited

        now = datetime.now(timezone.utc).timestamp()
        bucket_key = f"{user_id}:{feature}"
        if burst_limit > 0:
            with RATE_LIMIT_BURSTS_LOCK:
                bucket = RATE_LIMIT_BURSTS[bucket_key]
                while bucket and bucket[0] <= now - burst_window:
                    bucket.popleft()
                if len(bucket) >= burst_limit:
                    retry_after = max(1, int(burst_window - (now - bucket[0])))
                    raise HTTPException(
                        status_code=429,
                        detail=f"{feature_label} is moving too fast right now. Please wait {retry_after} seconds before trying again.",
                        headers={
                            "Retry-After": str(retry_after),
                            "X-RateLimit-Limit": str(burst_limit),
                            "X-RateLimit-Window": str(burst_window),
                        },
                    )
                bucket.append(now)

        current = int(state.get("monthly_usage", {}).get(feature, 0))
        if current >= monthly_limit:
            raise HTTPException(
                status_code=429,
                detail=f"Monthly {feature_label} quota reached ({monthly_limit}). Upgrade the subscription or increase the limit in Admin.",
                headers={"X-RateLimit-Limit": str(monthly_limit), "X-RateLimit-Reset": "next_month"},
            )

        today = datetime.now(timezone.utc).date().isoformat()
        key = f"{user_id}:{feature}:{today}"
        usage_row = sb.table("ai_usage_log").select("count").eq("key", key).maybe_single().execute()
        current_day = int((usage_row.data or {}).get("count", 0))

        sb.table("ai_usage_log").upsert(
            {"key": key, "user_id": user_id, "feature": feature, "date": today, "count": current_day + 1},
            on_conflict="key"
        ).execute()
        return True
    except HTTPException:
        raise
    except Exception:
        return True  # Fail open — don't break the app if usage tracking fails


supabase_admin = None
cognitive_core = None


def init_route_deps(sb_admin, openai_key=None, cog_core=None):
    """Called once by server.py after initialization."""
    global supabase_admin, cognitive_core
    supabase_admin = sb_admin
    if cog_core is not None:
        cognitive_core = cog_core



def get_sb():
    """Get supabase_admin. Fails fast if not initialized."""
    if supabase_admin is None:
        raise RuntimeError("supabase_admin not initialized — call init_route_deps() first")
    return supabase_admin


# ─── Auth Dependencies ───

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """SUPABASE-ONLY Authentication. Checks suspended status."""
    token = credentials.credentials
    try:
        from auth_supabase import verify_supabase_token
        user = await verify_supabase_token(token)
        if user:
            # Check if user is suspended
            try:
                sb = get_sb()
                row = sb.table("users").select("role").eq("id", user.get("id")).maybe_single().execute()
                if row.data and row.data.get("role") == "suspended":
                    raise HTTPException(status_code=403, detail="Account suspended. Contact support.")
            except HTTPException:
                raise
            except Exception:
                pass  # If check fails, let user through (fail-open for auth)
            return user
        else:
            raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Supabase token validation failed: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed - please log in again")


async def get_admin_user(current_user: dict = Depends(get_current_user)):
    """Admin-only dependency. Accepts 'admin' and 'superadmin' roles."""
    if current_user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def get_super_admin(current_user: dict = Depends(get_current_user)):
    """Super-admin only. Strictest gate — for system-level operations.
    Also grants access to the master account email."""
    if current_user.get("role") != "superadmin" and current_user.get("email") != "andre@thestrategysquad.com.au":
        raise HTTPException(status_code=403, detail="Super-admin access required")
    return current_user


async def get_client_admin(current_user: dict = Depends(get_current_user)):
    """Client-admin gate — for profile/workspace management routes.
    Accepts: owner, admin, superadmin, client_admin, user_admin."""
    allowed = {"owner", "admin", "superadmin", "client_admin", "user_admin"}
    if current_user.get("role") not in allowed:
        raise HTTPException(status_code=403, detail="Insufficient permissions — admin or owner role required")
    return current_user


async def get_current_user_from_request(request: Request):
    """Extract user from raw Request object (for endpoints that don't use Depends)."""
    from auth_supabase import get_current_user_from_request as _impl
    return await _impl(request)


def require_owner_or_admin(current_user: dict = Depends(get_current_user)):
    """Gate for owner or admin roles."""
    if current_user.get("role") not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Owner/Admin access required")
    return current_user


async def get_current_account(current_user: dict = Depends(get_current_user)):
    """Get the account associated with the current user."""
    account_id = current_user.get("account_id")
    if not account_id:
        raise HTTPException(status_code=400, detail="Account not configured")
    from supabase_remaining_helpers import get_account_supabase
    account = await get_account_supabase(get_sb(), account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account
