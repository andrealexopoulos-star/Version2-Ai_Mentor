"""
core/scoring.py — Extracted from profile.py
Business scoring and retention RAG logic.
"""
from typing import Dict, Optional

# ═══════════════════════════════════════════
# RETENTION BENCHMARKS (AU)
# ═══════════════════════════════════════════

ANZSIC_DIVISION_BENCHMARKS_AU: Dict[str, Dict[str, int]] = {
    "A": {"good": 70, "ok": 55},
    "B": {"good": 75, "ok": 60},
    "C": {"good": 65, "ok": 50},
    "D": {"good": 80, "ok": 65},
    "E": {"good": 70, "ok": 55},
    "F": {"good": 80, "ok": 65},
    "G": {"good": 70, "ok": 55},
    "H": {"good": 75, "ok": 60},
    "I": {"good": 75, "ok": 60},
    "J": {"good": 85, "ok": 70},
    "K": {"good": 85, "ok": 70},
    "L": {"good": 75, "ok": 60},
    "M": {"good": 80, "ok": 65},
    "N": {"good": 75, "ok": 60},
    "O": {"good": 75, "ok": 60},
    "P": {"good": 80, "ok": 65},
    "Q": {"good": 85, "ok": 70},
    "R": {"good": 70, "ok": 55},
    "S": {"good": 70, "ok": 55},
}

RETENTION_RANGE_MIDPOINTS: Dict[str, int] = {
    "<20%": 10,
    "20-40%": 30,
    "40-60%": 50,
    "60-80%": 70,
    ">80%": 90,
}


def compute_retention_rag(
    anzsic_division: Optional[str],
    retention_known: Optional[bool],
    retention_rate_range: Optional[str]
) -> Optional[str]:
    if not retention_known or not retention_rate_range:
        return None
    midpoint = RETENTION_RANGE_MIDPOINTS.get(retention_rate_range)
    if midpoint is None:
        return None
    division = (anzsic_division or "").strip().upper()
    bench = ANZSIC_DIVISION_BENCHMARKS_AU.get(division, {"good": 75, "ok": 60})
    if midpoint >= bench["good"]:
        return "green"
    if midpoint >= bench["ok"]:
        return "amber"
    return "red"


async def calculate_business_score(profile: dict, onboarding: dict = None, user_id: str = None, sb_client=None) -> int:
    """Calculate dynamic Business Score out of 100."""
    if not profile:
        return 0

    score = 0

    # FOUNDATION (30 points)
    if profile.get("business_stage") or (onboarding and onboarding.get("business_stage")):
        score += 5
    core_fields = ["business_name", "industry", "business_model", "target_market"]
    score += (sum(1 for f in core_fields if profile.get(f)) / len(core_fields)) * 15
    strategic = ["short_term_goals", "long_term_goals", "main_challenges"]
    score += (sum(1 for f in strategic if profile.get(f)) / len(strategic)) * 10

    # PLATFORM ENGAGEMENT (20 points) — requires sb_client
    if user_id and sb_client:
        try:
            chat_result = sb_client.table("chat_history").select("id", count="exact").eq("user_id", user_id).execute()
            score += min(5, (chat_result.count or 0) * 0.5)
        except Exception:
            pass
        try:
            analysis_result = sb_client.table("analyses").select("id", count="exact").eq("user_id", user_id).execute()
            score += min(5, (analysis_result.count or 0) * 1)
        except Exception:
            pass

    # BUSINESS DEPTH (25 points)
    products_text = profile.get("products_services") or profile.get("main_products_services") or ""
    if len(products_text) > 100:
        score += 5
    elif len(products_text) > 20:
        score += 3

    if profile.get("unique_value_proposition") and len(profile["unique_value_proposition"]) > 50:
        score += 5
    elif profile.get("unique_value_proposition"):
        score += 3

    team_fields = ["team_size", "founder_background", "team_strengths"]
    score += (sum(1 for f in team_fields if profile.get(f)) / len(team_fields)) * 5
    market_fields = ["ideal_customer_profile", "competitive_advantages", "geographic_focus"]
    score += (sum(1 for f in market_fields if profile.get(f)) / len(market_fields)) * 5
    vision_fields = ["mission_statement", "vision_statement", "growth_strategy"]
    score += (sum(1 for f in vision_fields if profile.get(f)) / len(vision_fields)) * 5

    # PERFORMANCE INDICATORS (25 points)
    if profile.get("revenue_range"):
        score += 5
        revenue = profile.get("revenue_range", "")
        if "$1M" in revenue or "$5M" in revenue or "$10M" in revenue:
            score += 3
    if profile.get("customer_count"):
        score += 2
    growth_indicators = ["growth_strategy", "growth_goals", "growth_challenge"]
    score += (sum(1 for f in growth_indicators if profile.get(f)) / len(growth_indicators)) * 5
    if profile.get("years_operating"):
        years = profile.get("years_operating", "")
        if "10+" in years or "5-10" in years:
            score += 5
        elif "2-5" in years:
            score += 3
        elif "1-2" in years:
            score += 2
    tools = profile.get("current_tools") or []
    if len(tools) >= 3:
        score += 5
    elif len(tools) >= 1:
        score += 3

    return min(100, int(score))
