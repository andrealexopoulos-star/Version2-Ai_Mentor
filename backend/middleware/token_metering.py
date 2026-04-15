"""Token Metering — monthly allocation, usage recording, budget checks.

Each subscription tier gets a fixed monthly input/output token budget.
Usage is tracked per LLM call in ai_usage_log and aggregated in
token_allocations per calendar month.

All DB operations use the service-role Supabase client so they work
regardless of the calling user's RLS context.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Tier Token Allocations (monthly) ──────────────────────────────────────────
# Values are raw token counts.  -1 means unlimited.
TIER_TOKEN_LIMITS: dict[str, dict[str, int]] = {
    "free": {
        "input_allocated":  150_000,
        "output_allocated":  75_000,
    },
    "starter": {
        "input_allocated":  2_000_000,
        "output_allocated": 1_000_000,
    },
    "pro": {
        "input_allocated":  5_000_000,
        "output_allocated": 2_000_000,
    },
    "business": {
        "input_allocated":  15_000_000,
        "output_allocated":  6_000_000,
    },
    "enterprise": {
        "input_allocated":  30_000_000,
        "output_allocated": 15_000_000,
    },
    "super_admin": {
        "input_allocated":  -1,
        "output_allocated": -1,
    },
}


def _current_period() -> tuple[datetime, datetime]:
    """Return (period_start, period_end) for the current calendar month in UTC."""
    now = datetime.now(timezone.utc)
    period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # Move to 1st of next month
    if now.month == 12:
        period_end = period_start.replace(year=now.year + 1, month=1)
    else:
        period_end = period_start.replace(month=now.month + 1)
    return period_start, period_end


def _normalize_tier(tier: str | None) -> str:
    """Canonical tier string, matching deps._normalize_subscription_tier."""
    t = (tier or "free").lower().strip()
    if t in ("superadmin", "super_admin"):
        return "super_admin"
    if t in ("enterprise", "custom", "custom_build"):
        return "enterprise"
    if t == "business":
        return "business"
    if t in ("professional", "pro"):
        return "pro"
    if t in ("foundation", "growth", "starter"):
        return "starter"
    return t if t in TIER_TOKEN_LIMITS else "free"


# ─── Public API ────────────────────────────────────────────────────────────────

def get_or_create_allocation(sb, user_id: str, tier: str) -> dict | None:
    """Return the current month's token_allocations row, creating it if absent.

    Parameters
    ----------
    sb : Supabase service-role client
    user_id : UUID string
    tier : raw subscription tier (will be normalised internally)

    Returns the allocation dict or None on error.
    """
    tier = _normalize_tier(tier)
    period_start, period_end = _current_period()
    period_start_iso = period_start.isoformat()
    period_end_iso = period_end.isoformat()

    try:
        result = (
            sb.table("token_allocations")
            .select("*")
            .eq("user_id", user_id)
            .eq("period_start", period_start_iso)
            .maybe_single()
            .execute()
        )
        if result.data:
            # If tier changed mid-period, update the allocation ceilings
            row = result.data
            limits = TIER_TOKEN_LIMITS.get(tier, TIER_TOKEN_LIMITS["free"])
            if row.get("tier") != tier:
                sb.table("token_allocations").update({
                    "tier": tier,
                    "input_allocated": limits["input_allocated"],
                    "output_allocated": limits["output_allocated"],
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", row["id"]).execute()
                row["tier"] = tier
                row["input_allocated"] = limits["input_allocated"]
                row["output_allocated"] = limits["output_allocated"]
            return row

        # Create new allocation for this period
        limits = TIER_TOKEN_LIMITS.get(tier, TIER_TOKEN_LIMITS["free"])
        insert_row = {
            "user_id": user_id,
            "tier": tier,
            "period_start": period_start_iso,
            "period_end": period_end_iso,
            "input_allocated": limits["input_allocated"],
            "output_allocated": limits["output_allocated"],
            "input_used": 0,
            "output_used": 0,
            "overage_input": 0,
            "overage_output": 0,
        }
        insert_result = (
            sb.table("token_allocations")
            .upsert(insert_row, on_conflict="user_id,period_start")
            .execute()
        )
        if insert_result.data:
            return insert_result.data[0] if isinstance(insert_result.data, list) else insert_result.data
        return insert_row  # fallback: return what we tried to insert

    except Exception as exc:
        logger.error("[TokenMetering] get_or_create_allocation failed for user %s: %s", str(user_id)[:8], exc)
        return None


def record_token_usage(
    sb,
    user_id: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    feature: str = "llm_call",
    tier: str | None = None,
) -> bool:
    """Record token usage from a single LLM call.

    1. Writes a row to ai_usage_log with token counts.
    2. Increments input_used / output_used on the token_allocations row.
    3. If usage exceeds the allocation, increments overage counters.

    Returns True on success, False on (logged) error.
    """
    if input_tokens <= 0 and output_tokens <= 0:
        return True  # nothing to record

    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    key = f"{user_id}:{feature}:{today}"

    try:
        # 1 ── ai_usage_log entry
        sb.table("ai_usage_log").upsert(
            {
                "key": key,
                "user_id": user_id,
                "feature": feature,
                "date": today,
                "count": 1,
                "model_used": model,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "updated_at": now.isoformat(),
            },
            on_conflict="key",
        ).execute()
    except Exception as exc:
        logger.warning("[TokenMetering] ai_usage_log upsert failed: %s", exc)

    # 2 ── Update token_allocations
    try:
        alloc = get_or_create_allocation(sb, user_id, tier or "free")
        if alloc is None:
            return False

        alloc_id = alloc.get("id")
        if not alloc_id:
            return False

        new_input_used = int(alloc.get("input_used", 0)) + input_tokens
        new_output_used = int(alloc.get("output_used", 0)) + output_tokens

        input_cap = int(alloc.get("input_allocated", 0))
        output_cap = int(alloc.get("output_allocated", 0))

        # Calculate overage (only when cap is not unlimited / -1)
        overage_input = max(0, new_input_used - input_cap) if input_cap >= 0 else 0
        overage_output = max(0, new_output_used - output_cap) if output_cap >= 0 else 0

        sb.table("token_allocations").update({
            "input_used": new_input_used,
            "output_used": new_output_used,
            "overage_input": overage_input,
            "overage_output": overage_output,
            "updated_at": now.isoformat(),
        }).eq("id", alloc_id).execute()

        return True

    except Exception as exc:
        logger.error("[TokenMetering] allocation update failed for user %s: %s", str(user_id)[:8], exc)
        return False


def check_token_budget(sb, user_id: str, tier: str | None = None) -> dict:
    """Return remaining budget + overage status for the current month.

    Returns a dict:
        {
            "input_remaining": int,   # tokens left (-1 = unlimited)
            "output_remaining": int,
            "input_used": int,
            "output_used": int,
            "input_allocated": int,
            "output_allocated": int,
            "in_overage": bool,
            "overage_input": int,
            "overage_output": int,
            "tier": str,
        }
    """
    effective_tier = _normalize_tier(tier)

    try:
        alloc = get_or_create_allocation(sb, user_id, effective_tier)
    except Exception as exc:
        logger.error("[TokenMetering] check_token_budget failed for user %s: %s", str(user_id)[:8], exc)
        alloc = None

    if alloc is None:
        # Fail open with defaults so the user is not blocked
        limits = TIER_TOKEN_LIMITS.get(effective_tier, TIER_TOKEN_LIMITS["free"])
        return {
            "input_remaining": limits["input_allocated"],
            "output_remaining": limits["output_allocated"],
            "input_used": 0,
            "output_used": 0,
            "input_allocated": limits["input_allocated"],
            "output_allocated": limits["output_allocated"],
            "in_overage": False,
            "overage_input": 0,
            "overage_output": 0,
            "tier": effective_tier,
        }

    input_alloc = int(alloc.get("input_allocated", 0))
    output_alloc = int(alloc.get("output_allocated", 0))
    input_used = int(alloc.get("input_used", 0))
    output_used = int(alloc.get("output_used", 0))
    overage_in = int(alloc.get("overage_input", 0))
    overage_out = int(alloc.get("overage_output", 0))

    # Unlimited tiers
    if input_alloc < 0:
        input_remaining = -1
    else:
        input_remaining = max(0, input_alloc - input_used)
    if output_alloc < 0:
        output_remaining = -1
    else:
        output_remaining = max(0, output_alloc - output_used)

    return {
        "input_remaining": input_remaining,
        "output_remaining": output_remaining,
        "input_used": input_used,
        "output_used": output_used,
        "input_allocated": input_alloc,
        "output_allocated": output_alloc,
        "in_overage": overage_in > 0 or overage_out > 0,
        "overage_input": overage_in,
        "overage_output": overage_out,
        "tier": alloc.get("tier", effective_tier),
    }
