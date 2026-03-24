"""
Canonical Soundboard contract used by backend routes.

Keeps tier gating, mode policy, and evidence contract stable so
all Soundboard surfaces share one product behavior.
"""
from __future__ import annotations

from typing import Any, Dict, List

CONTRACT_VERSION = "soundboard_v3"

MODE_POLICY: Dict[str, Dict[str, Any]] = {
    "auto": {"min_tier": "free", "display": "BIQc Auto", "boardroom_capable": True},
    "normal": {"min_tier": "starter", "display": "Normal", "boardroom_capable": True},
    "thinking": {"min_tier": "starter", "display": "Deep Thinking", "boardroom_capable": True},
    "pro": {"min_tier": "starter", "display": "Pro Analysis", "boardroom_capable": True},
    "trinity": {"min_tier": "starter", "display": "BIQc Trinity", "boardroom_capable": True},
}

TIER_RANK = {"free": 0, "starter": 1, "super_admin": 99}
PAID_ALIASES = {"foundation", "growth", "professional", "enterprise", "custom", "pro", "starter"}


def normalize_tier(raw_tier: str | None) -> str:
    tier_value = (raw_tier or "free").strip().lower()
    if tier_value in {"super_admin", "superadmin"}:
        return "super_admin"
    if tier_value in PAID_ALIASES:
        return "starter"
    return "free"


def mode_allowed_for_tier(mode: str, tier: str, is_super_admin: bool = False) -> bool:
    if is_super_admin:
        return True
    policy = MODE_POLICY.get((mode or "auto").strip().lower(), MODE_POLICY["auto"])
    required = policy.get("min_tier", "free")
    return TIER_RANK.get(normalize_tier(tier), 0) >= TIER_RANK.get(required, 0)


def enforce_mode_for_tier(requested_mode: str | None, tier: str, is_super_admin: bool = False) -> str:
    mode = (requested_mode or "auto").strip().lower()
    if mode not in MODE_POLICY:
        mode = "auto"
    if mode_allowed_for_tier(mode, tier, is_super_admin=is_super_admin):
        return mode
    return "auto"


def normalize_connected_sources(raw_sources: Dict[str, Any] | None) -> List[str]:
    sources = raw_sources or {}
    ordered = []
    for key in ("crm", "accounting", "email", "web", "calibration", "memory", "signals"):
        if bool(sources.get(key)):
            ordered.append(key)
    return ordered


def build_contract_payload(
    *,
    tier: str,
    mode_requested: str,
    mode_effective: str,
    guardrail: str,
    coverage_pct: float,
    confidence_score: float,
    data_sources_count: int,
    data_freshness: str,
    connected_sources: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "version": CONTRACT_VERSION,
        "tier": normalize_tier(tier),
        "mode_requested": (mode_requested or "auto").strip().lower(),
        "mode_effective": (mode_effective or "auto").strip().lower(),
        "guardrail": (guardrail or "DEGRADED").upper(),
        "coverage_pct": int(round(float(coverage_pct or 0))),
        "confidence_score": float(confidence_score or 0),
        "data_sources_count": int(data_sources_count or 0),
        "data_freshness": data_freshness or "unknown",
        "connected_sources": normalize_connected_sources(connected_sources),
    }
