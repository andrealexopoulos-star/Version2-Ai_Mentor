"""Regeneration & Evolution Governance System"""
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from uuid import uuid4

from cognitive_core_supabase import CognitiveCore, get_cognitive_core


ALLOWED_REGEN_LAYERS = [
    "mission_statement",
    "vision_statement",
    "short_term_goals",
    "long_term_goals",
    "primary_challenges",
    "growth_strategy"
]

CONSTITUTION_BLOCKLIST = [
    "i've updated your strategy",
    "this is your new mission",
    "this is your new vision",
    "final version",
    "replace your strategy"
]


def _truncate(value: str, limit: int = 220) -> str:
    if not value:
        return ""
    if len(value) <= limit:
        return value
    return value[:limit].rstrip() + "…"


def _passes_constitution(statement: str) -> bool:
    lowered = statement.lower()
    return not any(phrase in lowered for phrase in CONSTITUTION_BLOCKLIST)


async def _get_strategy_profile(supabase_admin, user_id: str) -> Optional[Dict[str, Any]]:
    result = supabase_admin.table("strategy_profiles").select("*").eq("user_id", user_id).execute().data
    return result[0] if result else None


def _get_latest_calibration(supabase_admin, user_id: str) -> Optional[str]:
    result = supabase_admin.table("calibration_sessions").select("completed_at").eq(
        "user_id", user_id
    ).order("completed_at", desc=True).limit(1).execute().data
    if result:
        return result[0].get("completed_at")
    return None


def _has_recent_event(supabase_admin, account_id: str, source: str, days: int) -> bool:
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    result = supabase_admin.table("watchtower_events").select("id", count="exact").eq(
        "account_id", account_id
    ).eq("source", source).gte("created_at", since).execute()
    return (result.count or 0) > 0


def _get_strategy_drift_count(supabase_admin, account_id: str, days: int = 21) -> int:
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    result = supabase_admin.table("watchtower_events").select("id", count="exact").eq(
        "account_id", account_id
    ).eq("source", "canonical_moment_strategy_drift").gte("created_at", since).execute()
    return result.count or 0


def _has_active_regeneration(supabase_admin, account_id: str) -> bool:
    result = supabase_admin.table("watchtower_events").select("id", count="exact").eq(
        "account_id", account_id
    ).eq("source", "regeneration_proposal").eq("status", "active").execute()
    return (result.count or 0) > 0


def _strategy_drift_improved(supabase_admin, account_id: str) -> Optional[bool]:
    now = datetime.now(timezone.utc)
    recent_start = (now - timedelta(days=30)).isoformat()
    prior_start = (now - timedelta(days=60)).isoformat()

    recent = supabase_admin.table("watchtower_events").select("id", count="exact").eq(
        "account_id", account_id
    ).eq("source", "canonical_moment_strategy_drift").gte("created_at", recent_start).execute().count or 0

    prior = supabase_admin.table("watchtower_events").select("id", count="exact").eq(
        "account_id", account_id
    ).eq("source", "canonical_moment_strategy_drift").gte("created_at", prior_start).lt("created_at", recent_start).execute().count or 0

    if prior == 0:
        return None
    return recent < prior


async def _generate_layer_draft(layer: str, strategy_profile: Dict[str, Any], reason: str, user_id: str) -> str:
    from server import get_ai_response
    prompt = (
        "You are BIQC. Generate a revised draft for the requested strategic layer only. "
        "Return JSON: {\"draft\": \"...\"}. Keep it specific to the business and grounded in the raw inputs. "
        "Do not label as final.\n\n"
        f"Layer: {layer}\n"
        f"Reason: {reason}\n"
        f"Mission raw: {strategy_profile.get('raw_mission_input')}\n"
        f"Vision raw: {strategy_profile.get('raw_vision_input')}\n"
        f"Goals raw: {strategy_profile.get('raw_goals_input')}\n"
        f"Challenges raw: {strategy_profile.get('raw_challenges_input')}\n"
        f"Growth raw: {strategy_profile.get('raw_growth_input')}\n"
    )

    ai_text = await get_ai_response(prompt, "general", f"regeneration_{user_id}", user_id=user_id)
    try:
        payload = json.loads(ai_text)
        return payload.get("draft") or ""
    except Exception:
        return ""


def _select_layer(trigger: str, requested_layer: Optional[str]) -> str:
    if requested_layer in ALLOWED_REGEN_LAYERS:
        return requested_layer
    if trigger == "stage_change":
        return "vision_statement"
    if trigger == "strategy_drift":
        return "short_term_goals"
    if trigger == "ineffective_strategy":
        return "primary_challenges"
    if trigger == "calibration_rerun":
        return "mission_statement"
    return "growth_strategy"


async def evaluate_regeneration(user_id: str, account_id: str, supabase_admin, watchtower_store) -> Optional[Dict[str, Any]]:
    business_profile = supabase_admin.table("business_profiles").select("id,business_stage").eq(
        "user_id", user_id
    ).execute().data
    if not business_profile:
        return None

    business_profile = business_profile[0]
    business_stage = business_profile.get("business_stage")

    if _has_active_regeneration(supabase_admin, account_id):
        return None

    if _has_recent_event(supabase_admin, account_id, "silence_intervention", 7):
        return None

    if _has_recent_event(supabase_admin, account_id, "canonical_moment_founder_strain", 7):
        return None

    strategy_profile = await _get_strategy_profile(supabase_admin, user_id)
    if not strategy_profile:
        return None

    try:
        core = get_cognitive_core()
    except Exception:
        core = CognitiveCore(supabase_admin)

    profile = await core.get_profile(user_id)
    memory = profile.get("consequence_memory", {}) or {}
    request = memory.get("regeneration_request")
    requested_layer = request.get("layer") if isinstance(request, dict) else None
    history = memory.get("regeneration_history", [])
    history_updated = False

    for entry in history:
        if entry.get("status") in {"accept", "keep"} and entry.get("performance_improved") is None:
            improved = _strategy_drift_improved(supabase_admin, account_id)
            if improved is not None:
                entry["performance_improved"] = improved
                history_updated = True

    triggers: List[str] = []
    if request:
        triggers.append("user_request")

    drift_count = _get_strategy_drift_count(supabase_admin, account_id)
    if drift_count >= 2:
        triggers.append("strategy_drift")

    stage_snapshot = memory.get("strategy_stage_snapshot")
    if stage_snapshot and business_stage and stage_snapshot != business_stage:
        triggers.append("stage_change")

    latest_calibration = _get_latest_calibration(supabase_admin, user_id)
    if latest_calibration and strategy_profile.get("updated_at"):
        try:
            calibration_dt = datetime.fromisoformat(latest_calibration.replace("Z", "+00:00"))
            strategy_dt = datetime.fromisoformat(str(strategy_profile.get("updated_at")).replace("Z", "+00:00"))
            if calibration_dt > strategy_dt:
                triggers.append("calibration_rerun")
        except Exception:
            pass

    if memory.get("strategy_effectiveness") == "declining":
        triggers.append("ineffective_strategy")

    if not triggers:
        if history_updated:
            memory["regeneration_history"] = history
            await core.observe(user_id, {
                "type": "regeneration_governance",
                "layer": "consequence_memory",
                "payload": memory
            })
        return None

    recent_negative = False
    for entry in history:
        if entry.get("status") == "accept" and entry.get("performance_improved") is False:
            created_at = entry.get("created_at")
            try:
                created_dt = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
            except Exception:
                created_dt = None
            if created_dt and (datetime.now(timezone.utc) - created_dt).days < 60:
                recent_negative = True
                break

    if recent_negative and "user_request" not in triggers:
        return None

    trigger = triggers[0]
    layer = _select_layer(trigger, requested_layer)
    if layer not in ALLOWED_REGEN_LAYERS:
        return None

    reason = (
        "Sustained signals suggest the current draft may not reflect what’s true now."
        if trigger == "strategy_drift" else
        "Business context has shifted since the last draft."
        if trigger == "stage_change" else
        "A full calibration was re-run after the last draft."
        if trigger == "calibration_rerun" else
        "Consequence memory indicates the current draft may not be effective."
        if trigger == "ineffective_strategy" else
        "You explicitly requested an updated draft."
    )

    if trigger == "user_request" and isinstance(request, dict) and request.get("reason"):
        reason = request.get("reason")

    draft_text = await _generate_layer_draft(layer, strategy_profile, reason, user_id)
    if not draft_text:
        return None

    current_value = strategy_profile.get(layer) or ""
    headline = f"Draft regeneration — {layer.replace('_', ' ')}"
    statement = (
        f"Draft (not final): {reason} "
        f"Before: {_truncate(current_value)} "
        f"After: {_truncate(draft_text)} "
        "Choices: Accept draft as current · Refine together · Keep existing version."
    )

    if not _passes_constitution(statement):
        return None

    event = {
        "id": str(uuid4()),
        "account_id": account_id,
        "type": "regeneration",
        "domain": "operations",
        "severity": "medium",
        "headline": headline,
        "statement": statement,
        "evidence_payload": {
            "proposal_id": "pending",
            "layer": layer,
            "reason": reason,
            "before": current_value,
            "after": draft_text,
            "choices": [
                "Accept draft as current",
                "Refine together",
                "Keep existing version"
            ]
        },
        "consequence_window": "evolution",
        "source": "regeneration_proposal",
        "fingerprint": f"regeneration_{user_id}_{layer}",
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await watchtower_store.create_event(event)

    history = memory.get("regeneration_history", [])
    history.append({
        "proposal_id": event["id"],
        "layer": layer,
        "reason": reason,
        "created_at": event["created_at"],
        "status": "pending"
    })

    memory.update({
        "regeneration_history": history,
        "regeneration_request": None
    })

    await core.observe(user_id, {
        "type": "regeneration_governance",
        "layer": "consequence_memory",
        "payload": memory
    })

    return event


async def request_regeneration(user_id: str, layer: Optional[str], reason: Optional[str], supabase_admin) -> Dict[str, Any]:
    try:
        core = get_cognitive_core()
    except Exception:
        core = CognitiveCore(supabase_admin)

    profile = await core.get_profile(user_id)
    memory = profile.get("consequence_memory", {}) or {}
    memory["regeneration_request"] = {
        "layer": layer,
        "reason": reason,
        "requested_at": datetime.now(timezone.utc).isoformat()
    }

    await core.observe(user_id, {
        "type": "regeneration_governance",
        "layer": "consequence_memory",
        "payload": memory
    })

    return {"status": "queued"}


async def record_regeneration_response(user_id: str, proposal_id: str, action: str, supabase_admin) -> Dict[str, Any]:
    event = supabase_admin.table("watchtower_events").select("*").eq("id", proposal_id).execute().data
    if not event:
        return {"status": "not_found"}

    event = event[0]
    payload = event.get("evidence_payload") or {}
    layer = payload.get("layer")
    draft_value = payload.get("after")

    if action == "accept" and layer in ALLOWED_REGEN_LAYERS and draft_value:
        supabase_admin.table("strategy_profiles").update({
            layer: draft_value,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("user_id", user_id).execute()

    supabase_admin.table("watchtower_events").update({
        "status": "resolved",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", proposal_id).execute()

    try:
        core = get_cognitive_core()
    except Exception:
        core = CognitiveCore(supabase_admin)

    profile = await core.get_profile(user_id)
    memory = profile.get("consequence_memory", {}) or {}
    history = memory.get("regeneration_history", [])
    for entry in history:
        if entry.get("proposal_id") == proposal_id:
            entry["status"] = action
            entry["responded_at"] = datetime.now(timezone.utc).isoformat()
            break

    memory["regeneration_history"] = history
    memory["regeneration_request"] = None

    if action == "accept":
        stage_result = supabase_admin.table("business_profiles").select("business_stage").eq(
            "user_id", user_id
        ).execute().data
        if stage_result:
            memory["strategy_stage_snapshot"] = stage_result[0].get("business_stage")

    await core.observe(user_id, {
        "type": "regeneration_governance",
        "layer": "consequence_memory",
        "payload": memory
    })

    return {"status": "recorded"}