"""
Shared dependencies for route modules.
Extracted from server.py — zero logic changes.

All route modules import auth deps and shared state from here.
server.py calls init_route_deps() once at startup to inject globals.
"""
from __future__ import annotations  # enables `str | None` etc. on Python 3.9

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging
import os
from datetime import datetime, timezone
from collections import defaultdict, deque
from threading import Lock
from auth_supabase import MASTER_ADMIN_EMAIL
from core.config import _get_rate_limit_redis, _redis_sliding_window_check

logger = logging.getLogger("server")
security = HTTPBearer(auto_error=False)

# Dev-only: set DEV_BYPASS_AUTH=1 and optionally DEV_BYPASS_SECRET=your-secret; frontend sends X-Dev-Bypass: your-secret
# NEVER enable in production: ENVIRONMENT=production or PRODUCTION=1 forces bypass off
_env = os.environ.get("ENVIRONMENT", "").strip().lower()
_production = os.environ.get("PRODUCTION", "").strip().lower() in ("1", "true", "yes")
_dev_bypass_requested = os.environ.get("DEV_BYPASS_AUTH", "").strip().lower() in ("1", "true", "yes")
DEV_BYPASS_AUTH = _dev_bypass_requested and not (_env == "production" or _production)
DEV_BYPASS_SECRET = os.environ.get("DEV_BYPASS_SECRET", "dev-bypass-local").strip()
if DEV_BYPASS_AUTH and DEV_BYPASS_SECRET == "dev-bypass-local":
    logger.warning("[Auth] DEV_BYPASS_AUTH disabled because DEV_BYPASS_SECRET is default")
    DEV_BYPASS_AUTH = False
DEV_BYPASS_USER = {
    "id": "dev-bypass-user",
    "email": "dev@local",
    "role": "user",
    "subscription_tier": "starter",
    "full_name": "Dev User",
}

# Calibration QA bypass (optional, explicitly enabled via env)
QA_BYPASS_AUTH = os.environ.get("QA_BYPASS_AUTH", "").strip().lower() in ("1", "true", "yes")
QA_BYPASS_SECRET = os.environ.get("QA_BYPASS_SECRET", "").strip()
QA_BYPASS_USER_ID = os.environ.get("QA_BYPASS_USER_ID", "").strip()
QA_BYPASS_EMAIL = os.environ.get("QA_BYPASS_EMAIL", "").strip().lower()
QA_BYPASS_ROLE = os.environ.get("QA_BYPASS_ROLE", "admin").strip()
QA_BYPASS_TIER = os.environ.get("QA_BYPASS_TIER", "starter").strip()
if QA_BYPASS_AUTH and (not QA_BYPASS_SECRET or not (QA_BYPASS_USER_ID or QA_BYPASS_EMAIL)):
    logger.warning("[Auth] QA_BYPASS_AUTH disabled due to missing QA_BYPASS_SECRET and QA_BYPASS_USER_ID/QA_BYPASS_EMAIL")
    QA_BYPASS_AUTH = False


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
    # NOTE: the deployed Edge Function is `calibration-psych` (hyphen). The
    # underscore `calibration_psych` routing entry previously lived here as
    # an orphan — removed. Any code that requests the underscore name is
    # canonicalised to the hyphen variant in routes/integrations.py.
    "calibration":         "gpt-5.3",

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

# ─── Rate Limits — per-tier feature limits ─────────────────────────────────────
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
    "pro": {
        "soundboard_daily":    -1,
        "snapshots_daily":     -1,
        "sop_monthly":         -1,
        "reports_monthly":     -1,
        "trinity_daily":       -1,
    },
    "business": {
        "soundboard_daily":    -1,
        "snapshots_daily":     -1,
        "sop_monthly":         -1,
        "reports_monthly":     -1,
        "trinity_daily":       -1,
    },
    "enterprise": {
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

# Per-tier rate limits — token-aligned allocations
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
    "pro": {
        "soundboard_daily": {"monthly_limit": 1800, "burst_limit": 24, "burst_window_seconds": 300},
        "trinity_daily": {"monthly_limit": 360, "burst_limit": 14, "burst_window_seconds": 300},
        "boardroom_diagnosis": {"monthly_limit": 600, "burst_limit": 20, "burst_window_seconds": 300},
        "war_room_ask": {"monthly_limit": 1200, "burst_limit": 24, "burst_window_seconds": 300},
    },
    "business": {
        "soundboard_daily": {"monthly_limit": 3600, "burst_limit": 30, "burst_window_seconds": 300},
        "trinity_daily": {"monthly_limit": 720, "burst_limit": 20, "burst_window_seconds": 300},
        "boardroom_diagnosis": {"monthly_limit": 1200, "burst_limit": 30, "burst_window_seconds": 300},
        "war_room_ask": {"monthly_limit": 2400, "burst_limit": 30, "burst_window_seconds": 300},
    },
    "enterprise": {
        "soundboard_daily": {"monthly_limit": -1, "burst_limit": 40, "burst_window_seconds": 300},
        "trinity_daily": {"monthly_limit": -1, "burst_limit": 30, "burst_window_seconds": 300},
        "boardroom_diagnosis": {"monthly_limit": -1, "burst_limit": 40, "burst_window_seconds": 300},
        "war_room_ask": {"monthly_limit": -1, "burst_limit": 40, "burst_window_seconds": 300},
    },
    # custom_build is a contracted sales tier. Defaults mirror enterprise;
    # individual customer overrides live in user_operator_profile.rate_limits
    # and are merged on top by _merge_rate_limit_config. Kept as a distinct
    # entry so display code can tell "Custom Build" apart from generic
    # "Enterprise" (Step 8 / P1-3 — normalise across PLANS + tiers.js).
    "custom_build": {
        "soundboard_daily": {"monthly_limit": -1, "burst_limit": 40, "burst_window_seconds": 300},
        "trinity_daily": {"monthly_limit": -1, "burst_limit": 30, "burst_window_seconds": 300},
        "boardroom_diagnosis": {"monthly_limit": -1, "burst_limit": 40, "burst_window_seconds": 300},
        "war_room_ask": {"monthly_limit": -1, "burst_limit": 40, "burst_window_seconds": 300},
    },
    "super_admin": {
        feature: {"monthly_limit": -1, "burst_limit": -1, "burst_window_seconds": 300}
        for feature in RATE_LIMIT_FEATURE_LABELS
    },
}

RATE_LIMIT_BURSTS = defaultdict(deque)  # in-memory fallback
RATE_LIMIT_BURSTS_LOCK = Lock()
RATE_LIMIT_BURST_REDIS_PREFIX = "biqc-ratelimit:burst:"


def _normalize_subscription_tier(tier: str | None) -> str:
    """Normalize DB subscription_tier to canonical tier name.

    custom_build is intentionally distinct from enterprise: it is a
    contracted sales tier with the same default entitlements but a
    separate identity for display and custom entitlement overlays.
    Legacy 'custom' collapses into 'custom_build' (Step 8 / P1-3).
    """
    tier_value = (tier or "free").lower().strip()
    if tier_value in ("superadmin", "super_admin"):
        return "super_admin"
    if tier_value in ("custom", "custom_build"):
        return "custom_build"
    if tier_value == "enterprise":
        return "enterprise"
    if tier_value == "business":
        return "business"
    if tier_value in ("professional", "pro"):
        return "pro"
    if tier_value in ("foundation", "growth", "starter"):
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
    admin_bypass = user_data.get("email", "").strip().lower() == MASTER_ADMIN_EMAIL or tier == "super_admin"

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
    """Tier-aware monthly quota + burst protection. Service failures fail open."""
    try:
        if not sb:
            logger.warning("[RATE_LIMIT] Missing service for %s, allowing request", str(user_id)[:8])
            return True
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
            # --- Try Redis first (shared across instances, survives deploys) ---
            redis_client = _get_rate_limit_redis()
            used_redis = False
            if redis_client is not None:
                try:
                    redis_key = f"{RATE_LIMIT_BURST_REDIS_PREFIX}{bucket_key}"
                    allowed, _count, oldest_ts = await _redis_sliding_window_check(
                        redis_client, redis_key, burst_window, burst_limit, now,
                    )
                    if not allowed:
                        retry_after = max(1, int(burst_window - (now - oldest_ts))) if oldest_ts else burst_window
                        raise HTTPException(
                            status_code=429,
                            detail=f"{feature_label} is moving too fast right now. Please wait {retry_after} seconds before trying again.",
                            headers={
                                "Retry-After": str(retry_after),
                                "X-RateLimit-Limit": str(burst_limit),
                                "X-RateLimit-Window": str(burst_window),
                            },
                        )
                    used_redis = True
                except HTTPException:
                    raise
                except Exception as exc:
                    logger.debug("Redis burst rate-limit unavailable, falling back to in-memory: %s", exc)

            # --- In-memory fallback ---
            if not used_redis:
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
    except HTTPException as exc:
        if exc.status_code == 429:
            raise
        logger.warning("[RATE_LIMIT] Non-429 HTTP error for %s, allowing: %s", str(user_id)[:8], exc.detail)
        return True
    except Exception as exc:
        logger.warning("[RATE_LIMIT] Service unavailable for %s, allowing: %s", str(user_id)[:8], exc)
        return True


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


def _apply_trial_context(user_data: dict, sb) -> dict:
    payload = dict(user_data or {})
    user_id = payload.get("id")
    if not user_id or sb is None:
        payload["effective_tier"] = payload.get("subscription_tier", "free")
        payload["on_trial"] = False
        return payload

    trial_expires_at = payload.get("trial_expires_at")
    trial_tier = payload.get("trial_tier", "pro")
    if trial_expires_at:
        try:
            expiry = datetime.fromisoformat(str(trial_expires_at).replace("Z", "+00:00"))
            if expiry > datetime.now(timezone.utc):
                payload["effective_tier"] = trial_tier
                payload["on_trial"] = True
                return payload
        except Exception:
            pass

    payload["effective_tier"] = payload.get("subscription_tier", "free")
    payload["on_trial"] = False
    return payload


# ─── Auth Dependencies ───

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    """SUPABASE authentication, with optional dev bypass when DEV_BYPASS_AUTH=1."""
    # Dev bypass: only when explicitly enabled and header matches secret
    if DEV_BYPASS_AUTH:
        bypass = request.headers.get("X-Dev-Bypass", "").strip()
        if bypass and bypass == DEV_BYPASS_SECRET:
            logger.info("[Auth] Dev bypass accepted")
            return dict(DEV_BYPASS_USER)

    # Calibration QA bypass: explicit opt-in with per-environment secret.
    if QA_BYPASS_AUTH:
        qa_bypass = request.headers.get("X-QA-Bypass", "").strip()
        if qa_bypass and qa_bypass == QA_BYPASS_SECRET:
            user_id = QA_BYPASS_USER_ID
            email = QA_BYPASS_EMAIL
            if (not user_id) and email:
                try:
                    sb = get_sb()
                    row = sb.table("users").select("id,email").eq("email", email).limit(1).execute()
                    if row.data:
                        user_id = row.data[0].get("id") or ""
                        email = (row.data[0].get("email") or email).strip().lower()
                except Exception as exc:
                    logger.warning("[Auth] QA bypass email resolution failed: %s", exc)
            if user_id:
                logger.info("[Auth] Calibration QA bypass accepted")
                return {
                    "id": user_id,
                    "email": email or "qa@local",
                    "role": QA_BYPASS_ROLE,
                    "subscription_tier": QA_BYPASS_TIER,
                    "full_name": "Calibration QA",
                }
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = credentials.credentials
    try:
        from auth_supabase import verify_supabase_token
        user = await verify_supabase_token(token)
        if user:
            # Check if user is suspended
            try:
                sb = get_sb()
                if sb:
                    try:
                        user_row = sb.table("users").select("trial_expires_at,trial_tier,subscription_tier").eq("id", user.get("id")).maybe_single().execute()
                        if user_row.data:
                            user = {**user, **user_row.data}
                    except Exception as trial_ctx_err:
                        logger.debug("Trial context fetch failed for %s: %s", user.get("id"), trial_ctx_err)
                    user = _apply_trial_context(user, sb)
                    row = sb.table("users").select("role").eq("id", user.get("id")).maybe_single().execute()
                    if row.data and row.data.get("role") == "suspended":
                        raise HTTPException(status_code=403, detail="Account suspended. Contact support.")
            except HTTPException:
                raise
            except Exception as exc:
                logger.error("Suspension status check failed for user %s: %s", user.get("id"), exc)
                raise HTTPException(status_code=503, detail="Authentication check unavailable")
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
    role = (current_user.get("role") or "").strip().lower()
    if role not in {"superadmin", "super_admin"} and current_user.get("email", "").strip().lower() != MASTER_ADMIN_EMAIL:
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


