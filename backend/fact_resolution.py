"""
Fact Resolution Engine — Global Fact Authority for BIQC.

Reads all Supabase sources, produces a unified fact map,
and persists confirmed facts in user_operator_profile.operator_profile.fact_ledger.

Rules:
- If a fact exists and is confirmed → reuse silently, never re-ask
- If a fact exists but is unconfirmed → present as confirmation
- If a fact is unknown → ask once, persist immediately
"""
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

# Mapping: fact_key → (table, column) for known sources
FACT_SOURCES = {
    # From business_profiles
    "business.name": ("business_profiles", "business_name"),
    "business.industry": ("business_profiles", "industry"),
    "business.type": ("business_profiles", "business_type"),
    "business.stage": ("business_profiles", "business_stage"),
    "business.website": ("business_profiles", "website"),
    "business.location": ("business_profiles", "location"),
    "business.year_founded": ("business_profiles", "year_founded"),
    "business.employee_count": ("business_profiles", "employee_count"),
    "business.revenue_range": ("business_profiles", "annual_revenue_range"),
    "business.target_market": ("business_profiles", "target_market"),
    "business.value_proposition": ("business_profiles", "value_proposition"),
    "business.main_challenges": ("business_profiles", "main_challenges"),
    "business.short_term_goals": ("business_profiles", "short_term_goals"),
    "business.long_term_goals": ("business_profiles", "long_term_goals"),
    "business.target_country": ("business_profiles", "target_country"),
    # From users table
    "user.full_name": ("users", "full_name"),
    "user.email": ("users", "email"),
    "user.company_name": ("users", "company_name"),
    "user.industry": ("users", "industry"),
}

# Mapping: onboarding form fields → fact_keys
ONBOARDING_FIELD_TO_FACT = {
    "business_name": "business.name",
    "industry": "business.industry",
    "business_type": "business.type",
    "business_stage": "business.stage",
    "website": "business.website",
    "location": "business.location",
    "years_operating": "business.year_founded",
    "team_size": "business.employee_count",
    "revenue_range": "business.revenue_range",
    "target_market": "business.target_market",
    "unique_value_proposition": "business.value_proposition",
    "main_challenges": "business.main_challenges",
    "short_term_goals": "business.short_term_goals",
    "long_term_goals": "business.long_term_goals",
    "products_services": "business.products_services",
    "business_model": "business.model",
    "customer_count": "business.customer_count",
    "hiring_status": "team.hiring_status",
    "pricing_model": "business.pricing_model",
    "competitive_advantages": "business.competitive_advantages",
    "growth_strategy": "business.growth_strategy",
    "advice_style": "user.advice_style",
}


async def resolve_facts(supabase_client, user_id: str) -> Dict[str, Any]:
    """
    Resolve all known facts for a user from every Supabase source.
    Returns a dict: { fact_key: { value, source, confidence, confirmed } }
    """
    facts = {}
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Read from business_profiles
    try:
        bp_result = supabase_client.table("business_profiles").select("*").eq("user_id", user_id).maybeSingle().execute()
        bp = bp_result.data if bp_result.data else {}
    except Exception:
        bp = {}

    for fact_key, (table, column) in FACT_SOURCES.items():
        if table == "business_profiles" and bp.get(column):
            facts[fact_key] = {
                "value": bp[column],
                "source": "profile",
                "confidence": 1.0,
                "confirmed": True,
                "first_seen_at": bp.get("created_at", now_iso),
                "last_verified_at": bp.get("updated_at", now_iso),
            }

    # 2. Read from users table
    try:
        user_result = supabase_client.table("users").select("*").eq("id", user_id).maybeSingle().execute()
        user_data = user_result.data if user_result.data else {}
    except Exception:
        user_data = {}

    for fact_key, (table, column) in FACT_SOURCES.items():
        if table == "users" and user_data.get(column) and fact_key not in facts:
            facts[fact_key] = {
                "value": user_data[column],
                "source": "user_account",
                "confidence": 0.9,
                "confirmed": True,
                "first_seen_at": user_data.get("created_at", now_iso),
                "last_verified_at": user_data.get("updated_at", now_iso),
            }

    # 3. Read from onboarding state (user_operator_profile)
    try:
        op_result = supabase_client.table("user_operator_profile").select(
            "operator_profile"
        ).eq("user_id", user_id).maybeSingle().execute()
        if op_result.data:
            op = op_result.data.get("operator_profile") or {}
            ob_state = op.get("onboarding_state") or {}
            ob_data = ob_state.get("data") or {}

            for form_field, fact_key in ONBOARDING_FIELD_TO_FACT.items():
                if ob_data.get(form_field) and fact_key not in facts:
                    facts[fact_key] = {
                        "value": ob_data[form_field],
                        "source": "onboarding",
                        "confidence": 1.0,
                        "confirmed": True,
                        "first_seen_at": now_iso,
                        "last_verified_at": now_iso,
                    }

            # Also read persisted fact_ledger
            ledger = op.get("fact_ledger") or {}
            for fk, fv in ledger.items():
                if fk not in facts:
                    facts[fk] = fv
    except Exception:
        pass

    # 4. Cross-reference: if users.company_name matches business.name, boost confidence
    if "business.name" in facts and "user.company_name" in facts:
        if facts["business.name"]["value"] == facts["user.company_name"]["value"]:
            facts["business.name"]["confidence"] = 1.0

    return facts


async def persist_fact(supabase_client, user_id: str, fact_key: str, value: Any, source: str = "user_confirmed"):
    """Persist a single fact to user_operator_profile.operator_profile.fact_ledger."""
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        op_result = supabase_client.table("user_operator_profile").select(
            "operator_profile"
        ).eq("user_id", user_id).maybeSingle().execute()

        if op_result.data:
            op = op_result.data.get("operator_profile") or {}
            ledger = op.get("fact_ledger") or {}
            
            # Don't overwrite existing confirmed facts unless source is more authoritative
            if fact_key in ledger and ledger[fact_key].get("confirmed"):
                ledger[fact_key]["last_verified_at"] = now_iso
            else:
                ledger[fact_key] = {
                    "value": value,
                    "source": source,
                    "confidence": 1.0,
                    "confirmed": True,
                    "first_seen_at": ledger.get(fact_key, {}).get("first_seen_at", now_iso),
                    "last_verified_at": now_iso,
                }

            op["fact_ledger"] = ledger
            supabase_client.table("user_operator_profile").update({
                "operator_profile": op,
                "updated_at": now_iso
            }).eq("user_id", user_id).execute()
        else:
            supabase_client.table("user_operator_profile").insert({
                "user_id": user_id,
                "operator_profile": {
                    "fact_ledger": {
                        fact_key: {
                            "value": value,
                            "source": source,
                            "confidence": 1.0,
                            "confirmed": True,
                            "first_seen_at": now_iso,
                            "last_verified_at": now_iso,
                        }
                    }
                },
                "persona_calibration_status": "incomplete"
            }).execute()
    except Exception as e:
        logger.error(f"[fact_resolution] persist_fact failed for {fact_key}: {e}")


def build_known_facts_prompt(facts: Dict[str, Any]) -> str:
    """Build a prompt section listing all known facts for the AI agent."""
    if not facts:
        return ""

    lines = ["KNOWN FACTS (DO NOT RE-ASK):"]
    for fact_key, fact_data in sorted(facts.items()):
        val = fact_data.get("value", "")
        if isinstance(val, list):
            val = ", ".join(str(v) for v in val)
        elif isinstance(val, dict):
            val = str(val)
        if val and len(str(val)) > 100:
            val = str(val)[:100] + "..."
        src = fact_data.get("source", "unknown")
        lines.append(f"  {fact_key}: {val} (source: {src})")

    return "\n".join(lines)


def resolve_onboarding_fields(facts: Dict[str, Any]) -> Dict[str, Any]:
    """Map resolved facts to onboarding form field names.
    Returns: { field_name: { value, source, confirmed } }"""
    resolved = {}
    for form_field, fact_key in ONBOARDING_FIELD_TO_FACT.items():
        if fact_key in facts:
            f = facts[fact_key]
            resolved[form_field] = {
                "value": f["value"],
                "source": f["source"],
                "confirmed": f.get("confirmed", False),
            }
    return resolved
