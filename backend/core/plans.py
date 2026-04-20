"""BIQc Plans — tier allocations, top-ups, pricing helpers.

Transitional during PR B2/B3 PR1:
  - middleware/token_metering.py:TIER_TOKEN_LIMITS (split in/out) still
    governs the 402-gate via enforce_free_tier_budget. DO NOT edit in PR1.
  - backend/core/plans.py:TIER_ALLOCATIONS (total) governs the new
    usage_ledger path. Andreas-locked future-of-record.

Locked values 2026-04-20 (pro=5M) + 2026-04-21 (4b: trial=250K/starter=1M/
business=20M; H3=b: free=225K matching legacy combined total).
"""
from __future__ import annotations

import logging
import os
from typing import Literal

from middleware.token_metering import MODEL_PRICING  # noqa: F401 — single source of truth

logger = logging.getLogger(__name__)

USD_TO_AUD: float = float(os.environ.get("AUD_USD_RATE", "1.52"))
PRICING_VERSION: str = "v1"
logger.info("[plans] USD_TO_AUD=%.4f pricing_version=%s", USD_TO_AUD, PRICING_VERSION)

TIER_ALLOCATIONS: dict[str, int] = {
    "trial":        250_000,
    "free":         225_000,
    "starter":      1_000_000,   # "Growth" plan in marketing
    "pro":          5_000_000,
    "business":     20_000_000,
    "enterprise":   20_000_000,
    "custom_build": 20_000_000,
    "super_admin":  -1,          # unmetered
}

TOPUP_TOKENS: int = 500_000
TOPUP_PRICE_AUD_CENTS: int = 2900
DEFAULT_AUTO_TOPUP_ENABLED: bool = True


def normalize_tier(tier: str | None) -> str:
    t = (tier or "free").lower().strip()
    if t in ("superadmin", "super_admin"):
        return "super_admin"
    if t in ("custom", "custom_build"):
        return "custom_build"
    if t in ("professional", "pro"):
        return "pro"
    if t in ("foundation", "growth", "starter"):
        return "starter"
    if t in ("business", "enterprise", "trial"):
        return t
    return t if t in TIER_ALLOCATIONS else "free"


def allocation_for(tier: str | None) -> int:
    return TIER_ALLOCATIONS.get(normalize_tier(tier), TIER_ALLOCATIONS["free"])


_ANTHROPIC_CACHE_WRITE_MULT = 1.25
_ANTHROPIC_CACHE_READ_MULT  = 0.10
_OPENAI_CACHED_INPUT_MULT   = 0.50


def provider_of(model: str) -> Literal["anthropic", "openai", "google", "unknown"]:
    """Infer provider from model name. Used by token_meter.emit_consume to populate
    usage_ledger.provider (required by CHECK constraint when kind='consume')."""
    m = (model or "").lower()
    if m.startswith("claude"):
        return "anthropic"
    if m.startswith("gemini"):
        return "google"
    if m.startswith("gpt") or m.startswith("text-embedding") or "openai" in m:
        return "openai"
    return "unknown"


def compute_cost_aud_micros(
    model: str,
    input_tokens: int,
    output_tokens: int,
    cached_input_tokens: int = 0,
    cache_write_tokens: int = 0,
) -> int:
    """AUD cost in integer micros for a single LLM call. Returns 0 for unknown model.
    MODEL_PRICING is already in AUD per 1M tokens. Cache bucketing is provider-aware."""
    if not model:
        return 0
    price = MODEL_PRICING.get(model)
    if not price:
        return 0

    ti = max(0, int(input_tokens or 0))
    to = max(0, int(output_tokens or 0))
    tc = max(0, int(cached_input_tokens or 0))
    tw = max(0, int(cache_write_tokens or 0))

    in_rate  = float(price.get("input_per_1m", 0.0))
    out_rate = float(price.get("output_per_1m", 0.0))
    prov = provider_of(model)

    if prov == "openai":
        non_cached = max(0, ti - tc)
        input_cost = (non_cached / 1_000_000.0) * in_rate \
                   + (tc / 1_000_000.0) * in_rate * _OPENAI_CACHED_INPUT_MULT
    elif prov == "anthropic":
        input_cost = (ti / 1_000_000.0) * in_rate \
                   + (tc / 1_000_000.0) * in_rate * _ANTHROPIC_CACHE_READ_MULT \
                   + (tw / 1_000_000.0) * in_rate * _ANTHROPIC_CACHE_WRITE_MULT
    else:
        input_cost = (ti / 1_000_000.0) * in_rate

    output_cost = (to / 1_000_000.0) * out_rate
    return max(0, int(round((input_cost + output_cost) * 1_000_000.0)))


__all__ = [
    "MODEL_PRICING",
    "USD_TO_AUD",
    "PRICING_VERSION",
    "TIER_ALLOCATIONS",
    "TOPUP_TOKENS",
    "TOPUP_PRICE_AUD_CENTS",
    "DEFAULT_AUTO_TOPUP_ENABLED",
    "normalize_tier",
    "allocation_for",
    "provider_of",
    "compute_cost_aud_micros",
]
