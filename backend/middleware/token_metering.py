"""Token Metering — monthly allocation, usage recording, budget checks.

Each subscription tier gets a fixed monthly input/output token budget.
Usage is tracked per LLM call in ai_usage_log and aggregated in
token_allocations per calendar month.

All DB operations use the service-role Supabase client so they work
regardless of the calling user's RLS context.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

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
    # Contracted sales tier — defaults mirror enterprise. Per-customer
    # overrides should be applied via separate entitlement records if/when
    # a contract justifies it (Step 8 / P1-3 — unified with PLANS + tiers.js).
    "custom_build": {
        "input_allocated":  30_000_000,
        "output_allocated": 15_000_000,
    },
    "super_admin": {
        "input_allocated":  -1,
        "output_allocated": -1,
    },
}


# ─── Model pricing (AUD per 1M tokens) ─────────────────────────────────────────
# Used to populate ai_usage_log.cost_aud on every LLM call so Gross Profit
# views can compute margin per user per month.
# Values are best-effort; keep in sync with provider pricing pages.
# Sources: openai.com/api/pricing · anthropic.com/pricing · ai.google.dev/pricing
# Conversion assumption when provider quotes USD: 1 USD ≈ 1.52 AUD (2026-04).
MODEL_PRICING: dict[str, dict[str, float]] = {
    # OpenAI GPT-5 family
    "gpt-5.4-pro":   {"input_per_1m": 22.80, "output_per_1m": 91.20},
    "gpt-5.4":       {"input_per_1m":  3.80, "output_per_1m": 15.20},
    "gpt-5.3":       {"input_per_1m":  0.76, "output_per_1m":  3.04},
    # Trinity GPT contributor — openai.com/api/pricing verified 2026-04-22
    # ($1.75 / $14.00 USD @ 1.52 AUD). Was silently $0 until this fix.
    "gpt-5.2":       {"input_per_1m":  2.66, "output_per_1m": 21.28},
    # OpenAI reasoning models
    # o3-pro is the Trinity synthesis model — apidog + MS Foundry blog verified
    # 2026-04-22 ($20 / $80 USD @ 1.52 AUD). NOTE: MORE EXPENSIVE per-token
    # than Claude Opus 4.6 — every synthesis call was silently $0 before fix.
    "o3-pro":        {"input_per_1m": 30.40, "output_per_1m": 121.60},
    "o3":            {"input_per_1m":  3.04, "output_per_1m":  12.16},
    # OpenAI realtime / voice
    "gpt-4o-realtime-preview-2024-12-17": {"input_per_1m": 7.60, "output_per_1m": 30.40},
    # OpenAI GPT-4o family
    "gpt-4o":        {"input_per_1m":  3.80, "output_per_1m": 15.20},
    "gpt-4o-mini":   {"input_per_1m":  0.23, "output_per_1m":  0.91},
    # Google Gemini 3 — ai.google.dev/pricing re-verified 2026-04-22.
    # Prices doubled from Gemini 2.5 era; our old map was using legacy rates.
    # Gemini 3 Pro text @ ≤200k: $2/$12 USD = $3.04/$18.24 AUD
    # Gemini 3 Pro text @ >200k: $4/$18 USD = $6.08/$27.36 AUD (NOT yet modelled — flag)
    "gemini-3-pro-preview":   {"input_per_1m": 3.04, "output_per_1m": 18.24},
    "gemini-3.1-pro-preview": {"input_per_1m": 3.04, "output_per_1m": 18.24},
    # Gemini 3 Flash text: $0.50/$3.00 USD = $0.76/$4.56 AUD (was mapped at
    # Gemini 2.5 Flash legacy $0.075/$0.30 — under-reporting flash calls by 10x)
    "gemini-3-flash-preview": {"input_per_1m": 0.76, "output_per_1m":  4.56},
    # Anthropic Claude — claude.com/pricing re-verified 2026-04-22.
    # NOTE: Anthropic's live page shows Opus 4.7 as the CURRENT Opus variant.
    # Opus 4.6 may be deprecated; we still map it for any in-flight calls but
    # the new Trinity default should use claude-opus-4-7.
    # Opus:    $5/$25 USD  = $7.60/$38.00 AUD (was mapped 3x over at $15/$75)
    # Sonnet:  $3/$15 USD  = $4.56/$22.80 AUD (unchanged — verified)
    # Haiku:   $1/$5 USD   = $1.52/$7.60 AUD  (NEW)
    "claude-opus-4-7":   {"input_per_1m":  7.60, "output_per_1m":  38.00},
    "claude-opus-4-6":   {"input_per_1m":  7.60, "output_per_1m":  38.00},
    "claude-sonnet-4-6": {"input_per_1m":  4.56, "output_per_1m":  22.80},
    "claude-haiku-4-5":  {"input_per_1m":  1.52, "output_per_1m":   7.60},
    # Perplexity (Sonar) — used by edge fns: biqc-insights-cognitive,
    # market-analysis-ai, competitor-monitor, strategic-console-ai,
    # intelligence-snapshot, social-enrichment, calibration-business-dna.
    # docs.perplexity.ai/docs/getting-started/pricing verified 2026-04-22.
    # Note: sonar also has a small per-request search fee — not yet modelled.
    "sonar":         {"input_per_1m":  0.38, "output_per_1m":  3.80},  # $0.25/$2.50 USD @ 1.52 AUD
    "sonar-pro":     {"input_per_1m":  4.56, "output_per_1m": 22.80},  # $3.00/$15.00 USD @ 1.52 AUD
    # Embeddings (input-only; output tokens are always 0)
    "text-embedding-3-small": {"input_per_1m": 0.03, "output_per_1m": 0.0},
}

# One-shot log guard: warn only once per unknown model to avoid log spam.
_UNKNOWN_MODEL_WARNED: set[str] = set()


def _compute_cost_aud(model: str, input_tokens: int, output_tokens: int) -> float:
    """Return AUD cost for this call. Unknown models → 0.0 (logged once)."""
    if not model:
        return 0.0
    price = MODEL_PRICING.get(model)
    if not price:
        if model not in _UNKNOWN_MODEL_WARNED:
            _UNKNOWN_MODEL_WARNED.add(model)
            logger.warning(
                "[TokenMetering] model missing from MODEL_PRICING: %s (cost_aud=0)",
                model,
            )
        return 0.0
    try:
        cost = (
            (max(0, int(input_tokens))  / 1_000_000.0) * float(price.get("input_per_1m", 0.0)) +
            (max(0, int(output_tokens)) / 1_000_000.0) * float(price.get("output_per_1m", 0.0))
        )
    except (TypeError, ValueError):
        return 0.0
    return round(cost, 6)


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
    """Canonical tier string, matching deps._normalize_subscription_tier.

    Keep in lock-step with routes.deps._normalize_subscription_tier — in
    particular, custom_build stays distinct from enterprise (Step 8 /
    P1-3) so usage metering preserves the commercial identity.
    """
    t = (tier or "free").lower().strip()
    if t in ("superadmin", "super_admin"):
        return "super_admin"
    if t in ("custom", "custom_build"):
        return "custom_build"
    if t == "enterprise":
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

    1. Writes / accumulates a row in ai_usage_log (count, tokens, cost).
    2. Increments input_used / output_used on the token_allocations row.
    3. If usage exceeds the allocation, increments overage counters.

    Returns True on success, False on (logged) error.
    """
    if input_tokens <= 0 and output_tokens <= 0:
        return True  # nothing to record

    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    key = f"{user_id}:{feature}:{today}"
    cost_aud = _compute_cost_aud(model, input_tokens, output_tokens)

    # 1 ── ai_usage_log: ACCUMULATE across all calls in the same (user, feature, date)
    # The previous implementation overwrote the row on every upsert, erasing
    # the day's running total. Read-modify-write keeps count / tokens / cost
    # additive per key.
    try:
        existing = (
            sb.table("ai_usage_log")
            .select("count,input_tokens,output_tokens,cost_aud")
            .eq("key", key)
            .maybe_single()
            .execute()
        )
        existing_row = existing.data if existing and getattr(existing, "data", None) else {}

        new_count = int(existing_row.get("count") or 0) + 1
        new_input = int(existing_row.get("input_tokens") or 0) + int(input_tokens or 0)
        new_output = int(existing_row.get("output_tokens") or 0) + int(output_tokens or 0)
        new_cost = round(float(existing_row.get("cost_aud") or 0.0) + cost_aud, 6)

        sb.table("ai_usage_log").upsert(
            {
                "key": key,
                "user_id": user_id,
                "feature": feature,
                "date": today,
                "count": new_count,
                "model_used": model,
                "input_tokens": new_input,
                "output_tokens": new_output,
                "cost_aud": new_cost,
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


# ─── Free-tier hard-stop (Step 9 / P1-6) ───────────────────────────────────────

# Static copy for the 402 response. Kept out of detail-dict literal so callers
# (and tests) can inspect the exact wording. Frontend keys off `error` to
# choose the upgrade CTA component — the `message` is the human string shown
# inline while the CTA is loading.
FREE_TIER_QUOTA_EXHAUSTED_ERROR = "free_tier_quota_exhausted"
FREE_TIER_QUOTA_EXHAUSTED_MESSAGE = (
    "You have used your free monthly AI allowance. "
    "Upgrade to Starter to keep going — or wait until the next calendar month."
)
FREE_TIER_UPGRADE_URL = "/upgrade"


def enforce_free_tier_budget(sb, user_id: str, tier: str | None) -> None:
    """Hard-stop free-tier users at 100% of the monthly token allocation.

    Step 9 / P1-6 — before Step 9 the only quota gate on free was per-feature
    *call count* (80 soundboard/mo, 40 war-room/mo) enforced in
    routes.deps.check_rate_limit. That left a cost hole: a single free user
    can stay inside their call budget but fire pathologically long prompts,
    burning through the 150K input / 75K output token allocation on
    gpt-5.4-pro (~AUD $3.50 / 1M input tokens) and costing BIQc real money
    until the next calendar rollover.

    This enforcer closes the hole at the LLM-router chokepoint. It raises
    HTTPException 402 (Payment Required) with `{error, message, upgrade_url,
    used, allocated}` so the frontend can render a conversion CTA and the
    backend stops before paying for another provider round-trip.

    Design notes:
      - Free tier only. Paid tiers (starter/pro/business/enterprise/
        custom_build/super_admin) short-circuit — their cost is covered by
        revenue and overage is tracked for reconciliation rather than blocked.
      - Fail-open on DB outages. If the allocation lookup errors, we allow
        the call through rather than 500ing — free-tier cost containment is
        important but not worth a full outage if Supabase blips.
      - 100% is the threshold. Exactly-at-cap blocks; one-token-under does
        not. Simpler for the frontend to explain ("You've used all 150K")
        than a fractional soft-warning.
      - Either dimension exhausted triggers the stop. Input and output are
        separately metered because their $/token costs differ by 4-5x — we
        can't let either go unbounded.
    """
    # routes.deps._normalize_subscription_tier and our _normalize_tier both
    # flatten aliases (growth/foundation → starter, custom → custom_build,
    # superadmin → super_admin, None/unknown → free) so either input form
    # works. Keep normalisation inside this function so callers don't have to
    # pre-normalise.
    normalized = _normalize_tier(tier)
    if normalized != "free":
        return  # paid tiers are not hard-stopped at this gate

    if not user_id:
        # No user context (admin task, background job, health probe) — do not
        # attempt to allocate or block. Anonymous LLM use is already blocked
        # upstream by auth.
        return

    try:
        alloc = get_or_create_allocation(sb, user_id, "free")
    except Exception as exc:
        logger.warning(
            "[TokenMetering] enforce_free_tier_budget: allocation lookup failed "
            "for user %s: %s — failing open.",
            str(user_id)[:8], exc,
        )
        return

    if alloc is None:
        # get_or_create_allocation already logged; treat as fail-open.
        return

    try:
        input_used = int(alloc.get("input_used", 0) or 0)
        output_used = int(alloc.get("output_used", 0) or 0)
        input_allocated = int(alloc.get("input_allocated", 0) or 0)
        output_allocated = int(alloc.get("output_allocated", 0) or 0)
    except (TypeError, ValueError) as exc:
        logger.warning(
            "[TokenMetering] enforce_free_tier_budget: malformed allocation "
            "row for user %s: %s — failing open.",
            str(user_id)[:8], exc,
        )
        return

    # Negative allocation == unlimited (super_admin fallback row). Skip.
    input_exhausted = input_allocated >= 0 and input_used >= input_allocated
    output_exhausted = output_allocated >= 0 and output_used >= output_allocated

    if not (input_exhausted or output_exhausted):
        return

    logger.info(
        "[TokenMetering] free-tier hard-stop fired for user %s "
        "(input %d/%d, output %d/%d)",
        str(user_id)[:8], input_used, input_allocated, output_used, output_allocated,
    )
    raise HTTPException(
        status_code=402,
        detail={
            "error": FREE_TIER_QUOTA_EXHAUSTED_ERROR,
            "message": FREE_TIER_QUOTA_EXHAUSTED_MESSAGE,
            "upgrade_url": FREE_TIER_UPGRADE_URL,
            "tier": "free",
            "input_used": input_used,
            "input_allocated": input_allocated,
            "output_used": output_used,
            "output_allocated": output_allocated,
            "dimension_exhausted": "input" if input_exhausted else "output",
        },
    )
