"""
Cognitive Context — Builds per-user cognitive context for AI prompt injection.
Includes intelligence snapshot retrieval from Supabase Edge Functions.
Extracted from ai_core.py for modularity.
"""
import os
import logging
from typing import Optional
import httpx
from routes.deps import get_sb, cognitive_core
from supabase_document_helpers import count_user_documents_supabase

logger = logging.getLogger(__name__)


async def get_intelligence_snapshot(user_id: str, user_access_token: str = None) -> str:
    """
    Call Supabase Edge Function "intelligence-snapshot" using USER's access token.
    Returns snapshot JSON as-is from Edge Function.
    """
    try:
        if not user_access_token:
            logger.warning("No user access token available for intelligence snapshot")
            return "Snapshot unavailable - no user token. Use Login Check-in Guardrail (Rule 4a)."

        function_url = f"{os.environ.get('SUPABASE_URL')}/functions/v1/intelligence-snapshot"
        headers = {
            "Authorization": f"Bearer {user_access_token}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(function_url, headers=headers, json={"user_id": user_id}, timeout=10.0)
            if response.status_code == 200:
                logger.info(f"Retrieved intelligence snapshot for user {user_id}")
                return str(response.json())
            elif response.status_code == 404:
                return "No integrated signals yet. Use Login Check-in Guardrail (Rule 4a)."
            else:
                return response.text or "Snapshot unavailable"
    except Exception as e:
        logger.error(f"Failed to call intelligence-snapshot: {e}")
        return "Snapshot call failed. Use Login Check-in Guardrail (Rule 4a)."


async def build_cognitive_context_for_prompt(user_id: str, agent: str) -> str:
    """
    MANDATORY PRE-FLIGHT CHECK: Load Business Reality, Owner Behaviour,
    prior Advisory Outcomes, and assess confidence before generating any response.
    """
    try:
        core_context = await cognitive_core.get_context_for_agent(user_id, agent)
        context_parts = []
        confidence_issues = []

        # 0. Memory Integrity Rules
        _add_memory_rules(context_parts)
        await _add_known_facts(context_parts, user_id)

        # Data Visibility Audit
        _add_data_visibility_audit(context_parts, core_context, user_id)
        await _check_integration_visibility(context_parts, user_id)

        # 1. Business Reality Model
        _add_reality_model(context_parts, confidence_issues, core_context)

        # 2. Owner Behaviour Model
        _add_behaviour_model(context_parts, confidence_issues, core_context)

        # 2.5 Stress Check
        history = core_context.get("history", {})
        if history.get("in_stress_period"):
            context_parts.append("\n⚠️ ═══ STRESS PERIOD DETECTED ═══")
            context_parts.append("THIS HUMAN IS UNDER PRESSURE RIGHT NOW.")
            context_parts.append("MANDATORY ADAPTATIONS:")
            context_parts.append("  → REDUCE COGNITIVE LOAD: Shorter sentences. Fewer concepts.")
            context_parts.append("  → ONE THING AT A TIME: No lists. No compound advice.")
            context_parts.append("  → ACKNOWLEDGE: 'I know things are heavy right now.'")
            context_parts.append("  → SURVIVAL OVER OPTIMIZATION: Focus on what's essential.")

        # 2.7 Escalation State
        await _add_escalation_state(context_parts, user_id)

        # 3. Prior Advisory Outcomes
        _add_advisory_outcomes(context_parts, confidence_issues, history)

        # 4. Confidence Assessment
        await _add_confidence_assessment(context_parts, confidence_issues, user_id)

        # 5. Agent-Specific Context
        await _add_agent_context(context_parts, agent, core_context, user_id)

        # Delivery preferences
        delivery = core_context.get("delivery", {})
        if any(v and v != "unknown" for v in delivery.values()):
            context_parts.append("\n═══ DELIVERY CALIBRATION ═══")
            for key, label in [("style", "Communication style"), ("pressure_sensitivity", "Pressure sensitivity"), ("depth", "Depth preference")]:
                if delivery.get(key) and delivery[key] != "unknown":
                    context_parts.append(f"{label}: {delivery[key]}")

        return "\n".join(context_parts)

    except Exception as e:
        logger.error(f"Error building cognitive context: {e}")
        return """═══ COGNITIVE CONTEXT UNAVAILABLE ═══
⚠️ Failed to load user intelligence layers.
INTERNAL DIRECTIVE: Operate with maximum conservatism. 
Do not assume. Ask before advising. Reduce certainty significantly."""


def _add_memory_rules(parts):
    parts.append("═══ MEMORY INTEGRITY RULES ═══")
    parts.append("YOU MUST NOT:")
    parts.append("  ✗ Re-ask for information already provided (see KNOWN FACTS below)")
    parts.append("  ✗ Summarise the business unless something has materially changed")
    parts.append("  ✗ Repeat explanations you've given before")
    parts.append("  ✗ Say 'As I mentioned...' or 'As you know...' - just use the knowledge")
    parts.append("")
    parts.append("REPEATED EXPLANATIONS = FAILURE TO RETAIN UNDERSTANDING")


async def _add_known_facts(parts, user_id):
    try:
        from fact_resolution import resolve_facts, build_known_facts_prompt
        resolved_facts = await resolve_facts(get_sb(), user_id)
        if resolved_facts:
            parts.append("\n" + build_known_facts_prompt(resolved_facts))
        known_info = await cognitive_core.get_known_information(user_id)
        if known_info.get("topics_discussed"):
            parts.append(f"\nTOPICS ALREADY DISCUSSED: {', '.join(known_info['topics_discussed'][:10])}")
        questions_asked = await cognitive_core.get_questions_asked(user_id)
        if questions_asked:
            parts.append("\nRECENT QUESTIONS ASKED (do not repeat):")
            for q in [q.get("question", "")[:60] for q in questions_asked[-5:]]:
                parts.append(f"  {q}...")
    except Exception as e:
        logger.warning(f"Could not load known information: {e}")


def _add_data_visibility_audit(parts, core_context, user_id):
    parts.append("\n═══ DATA VISIBILITY AUDIT ═══")
    parts.append("You must ALWAYS know what you cannot see.")
    parts.append("NEVER fabricate certainty to compensate for missing data.")

    blind_spots = []
    material_blind_spots = []
    reality = core_context.get("reality", {})

    for field, desc in {"business_type": "What type of business this is", "cashflow_sensitivity": "How sensitive they are to cash flow issues",
                        "time_scarcity": "How time-constrained they are", "revenue_model": "How they make money",
                        "team_size": "Whether they have a team or are solo"}.items():
        if not reality.get(field) or reality.get(field) == "unknown":
            blind_spots.append(f"UNKNOWN: {desc}")
            if field in ["business_type", "cashflow_sensitivity"]:
                material_blind_spots.append(desc)

    behaviour = core_context.get("behaviour", {})
    for field, desc in {"decision_velocity": "How quickly they make decisions", "follow_through": "Whether they follow through",
                        "stress_tolerance": "How they handle pressure"}.items():
        if not behaviour.get(field) or behaviour.get(field) == "unknown":
            blind_spots.append(f"UNOBSERVED: {desc}")

    if blind_spots:
        parts.append("\n⚠️ BLIND SPOTS (data you cannot see):")
        for s in blind_spots:
            parts.append(f"  ? {s}")
    if material_blind_spots:
        parts.append("\n🔴 MATERIAL BLIND SPOTS (significantly limit advice quality):")
        for s in material_blind_spots:
            parts.append(f"  🔴 {s}")
        parts.append("\n→ REDUCE ASSERTIVENESS on topics affected by these blind spots")


async def _check_integration_visibility(parts, user_id):
    integration_blind_spots = []
    try:
        outlook_tokens = get_sb().table("outlook_oauth_tokens").select("user_id").eq("user_id", user_id).execute()
        if not outlook_tokens.data:
            integration_blind_spots.append("Email patterns (no inbox connected)")
    except Exception:
        integration_blind_spots.append("Email patterns (no inbox connected)")
    docs_count = await count_user_documents_supabase(get_sb(), user_id)
    if docs_count == 0:
        integration_blind_spots.append("Business documents and SOPs")
    if integration_blind_spots:
        parts.append("\n⚠️ INTEGRATION BLIND SPOTS:")
        for s in integration_blind_spots:
            parts.append(f"  ? {s}")


def _add_reality_model(parts, issues, core_context):
    reality = core_context.get("reality", {})
    populated = sum(1 for v in reality.values() if v and v != "unknown" and not isinstance(v, list))
    populated += 1 if reality.get("constraints") else 0
    parts.append("\n═══ 1. BUSINESS REALITY MODEL ═══")
    if populated >= 3:
        for field, label in [("business_type", "Business type"), ("maturity", "Maturity"),
                             ("cashflow_sensitivity", "Cashflow sensitivity"), ("time_scarcity", "Time scarcity"),
                             ("decision_ownership", "Decision ownership")]:
            if reality.get(field) and reality[field] != "unknown":
                parts.append(f"{label}: {reality[field]}")
        if reality.get("constraints"):
            parts.append(f"Constraints: {', '.join(reality['constraints'][:3])}")
    else:
        parts.append("⚠️ INSUFFICIENT DATA")
        issues.append("Business reality model is sparse - reduce certainty in advice")


def _add_behaviour_model(parts, issues, core_context):
    behaviour = core_context.get("behaviour", {})
    populated = sum(1 for k, v in behaviour.items() if v and v != "unknown" and not isinstance(v, list))
    populated += 1 if behaviour.get("avoids") else 0
    populated += 1 if behaviour.get("repeated_concerns") else 0
    parts.append("\n═══ 2. OWNER BEHAVIOUR MODEL ═══")
    parts.append("(Adapt your response to THIS human's patterns)")
    if populated >= 2:
        velocity = behaviour.get("decision_velocity")
        if velocity and velocity != "unknown":
            parts.append(f"\nDECISION VELOCITY: {velocity.upper()}")
            adaptations = {"frozen": ["Simplify drastically. One small decision only.", "Create momentum with tiny wins."],
                           "cautious": ["Prioritize clearly. Reduce options.", "Give them time but set soft deadlines."],
                           "fast": ["Keep pace. Be direct. Don't over-explain."]}
            for a in adaptations.get(velocity, []):
                parts.append(f"  → ADAPTATION: {a}")
        follow = behaviour.get("follow_through")
        if follow and follow != "unknown":
            parts.append(f"\nFOLLOW-THROUGH: {follow.upper()}")
            if follow == "low":
                parts.append("  → ADAPTATION: Smaller commitments. More check-ins.")
        if behaviour.get("avoids"):
            parts.append(f"\nAVOIDANCE PATTERNS: {', '.join(behaviour['avoids'][:3])}")
            parts.append("  → ADAPTATION: Address consequences clearly but respectfully")
        if behaviour.get("decision_loops"):
            parts.append("\n⚠️ DECISION LOOPS:")
            for loop in behaviour['decision_loops'][:2]:
                parts.append(f"  ↻ {loop}")
        if behaviour.get("repeated_concerns"):
            parts.append(f"\nRECURRING CONCERNS: {', '.join(behaviour['repeated_concerns'][:3])}")
    else:
        parts.append("⚠️ INSUFFICIENT DATA")
        issues.append("Owner behaviour model is sparse - cannot predict reactions reliably")


async def _add_escalation_state(parts, user_id):
    try:
        escalation = await cognitive_core.calculate_escalation_state(user_id)
        level = escalation.get("level", 0)
        if level > 0:
            parts.append(f"\n═══ ESCALATION STATE: {escalation['level_name'].upper()} ═══")
            parts.append(f"Score: {escalation['score']}/10+")
            for ev in escalation.get("evidence", []):
                parts.append(f"  • {ev}")
            parts.append(f"\nTONE: {escalation['tone'].upper()}")
            parts.append(f"URGENCY: {escalation['urgency'].upper()}")
            if level >= 2:
                parts.append("\n⚠️ HIGH/CRITICAL: State consequences of inaction EXPLICITLY")
            if level == 3:
                parts.append("\n🔴 CRITICAL: Focus ONLY on business survival.")
    except Exception as e:
        logger.warning(f"Could not calculate escalation state: {e}")


def _add_advisory_outcomes(parts, issues, history):
    parts.append("\n═══ 3. PRIOR ADVISORY OUTCOMES ═══")
    available = False
    if history.get("recent_wins"):
        available = True
        parts.append("Recent wins:")
        for w in history["recent_wins"][:2]:
            if isinstance(w, dict) and w.get("summary"):
                parts.append(f"  ✓ {w['summary']}")
    if history.get("lessons"):
        available = True
        parts.append("Lessons learned:")
        for l in history["lessons"][:2]:
            if isinstance(l, dict) and l.get("lesson"):
                parts.append(f"  • {l['lesson']}")
    if history.get("deferred_decisions"):
        available = True
        parts.append("Deferred decisions:")
        for d in history["deferred_decisions"][:2]:
            if isinstance(d, dict) and d.get("decision"):
                parts.append(f"  ⏸ {d['decision']} (cost: {d.get('opportunity_cost', 'unknown')})")
    if not available:
        parts.append("⚠️ NO OUTCOME HISTORY")
        issues.append("No prior advisory outcomes")


async def _add_confidence_assessment(parts, issues, user_id):
    try:
        data = await cognitive_core.calculate_confidence(user_id)
        level = data.get("level", "low")
        score = data.get("score", 0)
        guidance = data.get("recommendation", "")
        factors = data.get("factors", [])
        limiting = data.get("limiting_factors", [])
    except Exception:
        level, score, guidance = "low", 0, "Operate with maximum caution."
        factors, limiting = [], ["Confidence calculation failed"]

    parts.append(f"\n═══ 4. CONFIDENCE ASSESSMENT ═══")
    parts.append(f"CONFIDENCE LEVEL: {level.upper()} ({score}%)")
    if factors:
        for f in factors:
            parts.append(f"  ✓ {f}")
    if limiting:
        parts.append("\n⚠️ LIMITING FACTORS:")
        for f in limiting:
            parts.append(f"  ⚠ {f}")
    parts.append(f"\n═══ CONFIDENCE DIRECTIVE ═══\n{guidance}")
    tone_map = {"high": "Direct and specific", "medium": "Balanced", "low": "Exploratory and questioning"}
    parts.append(f"\nTONE: {tone_map.get(level, 'Cautious')}")
    if issues:
        parts.append("\nAdditional data gaps:")
        for i in issues:
            parts.append(f"  - {i}")


async def _add_agent_context(parts, agent, core_context, user_id):
    if agent == "MyIntel" and core_context.get("intel_focus"):
        focus = core_context["intel_focus"]
        parts.append("\n═══ INTEL-SPECIFIC ═══")
        if focus.get("avoidance_blind_spots"):
            parts.append(f"Blind spots: {', '.join(focus['avoidance_blind_spots'][:3])}")
        if focus.get("topics_of_interest"):
            parts.append(f"Topics of interest: {', '.join(focus['topics_of_interest'][:5])}")

    elif agent == "MyAdvisor" and core_context.get("advisor_focus"):
        focus = core_context["advisor_focus"]
        parts.append("\n═══ ADVISOR-SPECIFIC ═══")
        if focus.get("action_success_rate") is not None:
            rate = int(focus['action_success_rate'] * 100)
            parts.append(f"Action rate: {rate}%")
            if rate < 40:
                parts.append("  → Low action rate: simplify recommendations")
        if focus.get("advice_outcomes"):
            for o in focus["advice_outcomes"][:2]:
                if isinstance(o, dict):
                    parts.append(f"  [{o.get('result', '?')}] {o.get('advice', '')[:50]}...")
        try:
            ignored = await cognitive_core.get_ignored_advice_for_escalation(user_id)
            if ignored:
                parts.append("\n═══ ⚠️ IGNORED ADVICE REQUIRING ESCALATION ═══")
                for a in ignored[:3]:
                    level = ["NORMAL", "ELEVATED", "CRITICAL"][a.get("escalation_level", 0)]
                    parts.append(f"  [{level}] (ignored {a.get('times_repeated', 0)}x): {a.get('recommendation', '')[:60]}...")
            recent = get_sb().table("advisory_log").select("*").eq("user_id", user_id).eq("status", "acted").order("created_at", desc=True).limit(3).execute()
            if recent.data:
                parts.append("\n═══ PAST SUCCESSFUL ADVICE ═══")
                for r in recent.data:
                    parts.append(f"  ✓ {r.get('recommendation', '')[:50]}... → {r.get('actual_outcome', '?')}")
        except Exception as e:
            logger.warning(f"Could not load advisory log: {e}")

    elif agent == "MySoundboard" and core_context.get("soundboard_focus"):
        focus = core_context["soundboard_focus"]
        parts.append("\n═══ SOUNDBOARD-SPECIFIC ═══")
        if focus.get("unresolved_loops"):
            for l in focus["unresolved_loops"][:3]:
                parts.append(f"  ↻ {l}")
        if focus.get("recent_sentiment"):
            sentiments = [s.get("sentiment") for s in focus["recent_sentiment"] if isinstance(s, dict)]
            if sentiments:
                parts.append(f"Recent sentiment: {', '.join(sentiments[-3:])}")
