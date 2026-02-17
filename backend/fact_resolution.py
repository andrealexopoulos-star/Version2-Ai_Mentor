"""
Fact Resolution Engine — Global Fact Authority for BIQC.

Authoritative resolution order:
1. Supabase tables: business_profiles, users, user_operator_profile, intelligence_baseline
2. Merge-normalised integration data (confidence >= 0.75)
3. Previously confirmed facts: fact_ledger in user_operator_profile

Rules:
- If a fact exists and is confirmed → reuse silently, never re-ask
- If a fact exists but is unconfirmed → present as confirmation
- If a fact is unknown → ask once, persist immediately
- Any question generated without fact resolution → logged as system error
"""
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = 0.75

# Mapping: fact_key → (table, column) for authoritative Supabase sources
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
    "business.growth_strategy": ("business_profiles", "growth_strategy"),
    "business.growth_goals": ("business_profiles", "growth_goals"),
    "business.risk_profile": ("business_profiles", "risk_profile"),
    "business.competitive_advantages": ("business_profiles", "competitive_advantages"),
    "business.products_services": ("business_profiles", "products_services"),
    "business.team_size": ("business_profiles", "team_size"),
    "business.years_operating": ("business_profiles", "years_operating"),
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

# Integration signal types that can derive facts
INTEGRATION_FACT_DERIVATIONS = {
    "crm.contact_count": {"fact_key": "business.customer_count", "confidence": 0.85},
    "crm.pipeline_value": {"fact_key": "business.revenue_range", "confidence": 0.75},
    "finance.revenue": {"fact_key": "business.revenue_range", "confidence": 0.95},
    "finance.employee_count": {"fact_key": "business.employee_count", "confidence": 0.90},
    "calendar.team_size_inferred": {"fact_key": "business.employee_count", "confidence": 0.75},
}


async def resolve_facts(supabase_client, user_id: str) -> Dict[str, Any]:
    """
    Resolve all known facts for a user from every source in authoritative order.
    Returns: { fact_key: { value, source, confidence, confirmed, first_seen_at, last_verified_at } }
    """
    facts = {}
    now_iso = datetime.now(timezone.utc).isoformat()

    # ─── LAYER 1: Supabase authoritative tables ───

    # 1a. business_profiles
    bp = {}
    try:
        bp_result = supabase_client.table("business_profiles").select("*").eq("user_id", user_id).maybe_single().execute()
        bp = bp_result.data or {}
    except Exception:
        pass

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

    # 1b. users table
    user_data = {}
    try:
        user_result = supabase_client.table("users").select("*").eq("id", user_id).maybe_single().execute()
        user_data = user_result.data or {}
    except Exception:
        pass

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

    # 1c. user_operator_profile (onboarding data + calibration profile)
    op_profile = {}
    try:
        op_result = supabase_client.table("user_operator_profile").select(
            "operator_profile"
        ).eq("user_id", user_id).maybe_single().execute()
        if op_result.data:
            op_profile = op_result.data.get("operator_profile") or {}
    except Exception:
        pass

    # Extract from onboarding_state.data
    ob_data = (op_profile.get("onboarding_state") or {}).get("data") or {}
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

    # 1d. intelligence_baseline
    try:
        bl_result = supabase_client.table("intelligence_baseline").select("baseline").eq("user_id", user_id).maybe_single().execute()
        if bl_result.data and bl_result.data.get("baseline"):
            baseline = bl_result.data["baseline"]
            if isinstance(baseline, dict):
                for domain, config in baseline.items():
                    fk = f"baseline.{domain}"
                    if fk not in facts:
                        facts[fk] = {
                            "value": config,
                            "source": "intelligence_baseline",
                            "confidence": 1.0,
                            "confirmed": True,
                            "first_seen_at": now_iso,
                            "last_verified_at": now_iso,
                        }
    except Exception:
        pass

    # ─── LAYER 2: Merge-normalised integration data ───
    try:
        oe_result = supabase_client.table("observation_events").select(
            "signal_name, payload, confidence, source, observed_at"
        ).eq("user_id", user_id).order("observed_at", desc=True).limit(50).execute()

        for event in (oe_result.data or []):
            signal = event.get("signal_name", "")
            if signal in INTEGRATION_FACT_DERIVATIONS:
                derivation = INTEGRATION_FACT_DERIVATIONS[signal]
                fk = derivation["fact_key"]
                conf = min(
                    derivation["confidence"],
                    event.get("confidence", 0.5)
                )
                if conf >= CONFIDENCE_THRESHOLD and fk not in facts:
                    payload = event.get("payload") or {}
                    derived_value = payload.get("value") or payload.get("amount") or payload.get("count")
                    if derived_value:
                        facts[fk] = {
                            "value": derived_value,
                            "source": f"integration:{event.get('source', 'unknown')}",
                            "confidence": conf,
                            "confirmed": False,  # Integration-derived = needs confirmation
                            "first_seen_at": event.get("observed_at", now_iso),
                            "last_verified_at": now_iso,
                        }
    except Exception:
        pass

    # ─── LAYER 3: Previously confirmed facts (fact_ledger) ───
    ledger = op_profile.get("fact_ledger") or {}
    for fk, fv in ledger.items():
        if fk not in facts:
            facts[fk] = fv
        elif not facts[fk].get("confirmed") and fv.get("confirmed"):
            # Ledger confirmation overrides unconfirmed integration data
            facts[fk] = fv

    # Cross-reference boost
    if "business.name" in facts and "user.company_name" in facts:
        if facts["business.name"]["value"] == facts["user.company_name"]["value"]:
            facts["business.name"]["confidence"] = 1.0

    return facts


async def persist_fact(supabase_client, user_id: str, fact_key: str, value: Any, source: str = "user_confirmed"):
    """Persist a single confirmed fact to user_operator_profile.operator_profile.fact_ledger."""
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        op_result = supabase_client.table("user_operator_profile").select(
            "operator_profile"
        ).eq("user_id", user_id).maybe_single().execute()

        if op_result.data:
            op = op_result.data.get("operator_profile") or {}
            ledger = op.get("fact_ledger") or {}

            if fact_key in ledger and ledger[fact_key].get("confirmed"):
                # Already confirmed — just refresh timestamp
                ledger[fact_key]["last_verified_at"] = now_iso
                if value is not None:
                    ledger[fact_key]["value"] = value
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


async def persist_facts_batch(supabase_client, user_id: str, fact_map: Dict[str, Any], source: str = "onboarding"):
    """Persist multiple facts at once from a form submission."""
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        op_result = supabase_client.table("user_operator_profile").select(
            "operator_profile"
        ).eq("user_id", user_id).maybe_single().execute()

        op = {}
        if op_result.data:
            op = op_result.data.get("operator_profile") or {}

        ledger = op.get("fact_ledger") or {}

        for fact_key, value in fact_map.items():
            if value is None or value == "":
                continue
            if fact_key in ledger and ledger[fact_key].get("confirmed"):
                ledger[fact_key]["last_verified_at"] = now_iso
                ledger[fact_key]["value"] = value
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

        if op_result.data:
            supabase_client.table("user_operator_profile").update({
                "operator_profile": op,
                "updated_at": now_iso
            }).eq("user_id", user_id).execute()
        else:
            supabase_client.table("user_operator_profile").insert({
                "user_id": user_id,
                "operator_profile": op,
                "persona_calibration_status": "incomplete"
            }).execute()
    except Exception as e:
        logger.error(f"[fact_resolution] persist_facts_batch failed: {e}")


def build_known_facts_prompt(facts: Dict[str, Any]) -> str:
    """Build a prompt section listing all known facts for the AI agent.
    Separates confirmed facts from unconfirmed (needs-confirmation)."""
    if not facts:
        return ""

    confirmed_lines = []
    unconfirmed_lines = []

    for fact_key, fact_data in sorted(facts.items()):
        val = fact_data.get("value", "")
        if isinstance(val, list):
            val = ", ".join(str(v) for v in val)
        elif isinstance(val, dict):
            val = str(val)
        if val and len(str(val)) > 120:
            val = str(val)[:120] + "..."
        src = fact_data.get("source", "unknown")
        conf = fact_data.get("confidence", 0)

        line = f"  {fact_key}: {val} (source: {src}, confidence: {conf:.0%})"
        if fact_data.get("confirmed"):
            confirmed_lines.append(line)
        else:
            unconfirmed_lines.append(line)

    parts = []
    if confirmed_lines:
        parts.append("CONFIRMED FACTS (DO NOT RE-ASK):")
        parts.extend(confirmed_lines)
    if unconfirmed_lines:
        parts.append("\nUNCONFIRMED FACTS (CONFIRM ONLY, DO NOT ASK RAW QUESTION):")
        parts.extend(unconfirmed_lines)

    return "\n".join(parts)


def resolve_onboarding_fields(facts: Dict[str, Any]) -> Dict[str, Any]:
    """Map resolved facts to onboarding form field names.
    Returns: { field_name: { value, source, confirmed, confidence } }"""
    resolved = {}
    for form_field, fact_key in ONBOARDING_FIELD_TO_FACT.items():
        if fact_key in facts:
            f = facts[fact_key]
            resolved[form_field] = {
                "value": f["value"],
                "source": f["source"],
                "confirmed": f.get("confirmed", False),
                "confidence": f.get("confidence", 0),
            }
    return resolved


def log_fact_resolution_violation(user_id: str, fact_key: str, context: str):
    """Log a system error when a question is asked without fact resolution."""
    logger.error(
        f"[FACT_VIOLATION] user={user_id} fact_key={fact_key} context={context} — "
        f"Question generated without checking fact resolution first"
    )
