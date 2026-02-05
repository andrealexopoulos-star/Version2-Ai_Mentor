"""Silence Intervention System"""
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from uuid import uuid4

from cognitive_core_supabase import CognitiveCore, get_cognitive_core

logger = logging.getLogger(__name__)

SILENCE_TEMPLATE = {
    "template_id": "silence_intervention_v1",
    "domain": "operations",
    "type": "engagement"
}

FORBIDDEN_PHRASES = [
    "logged in",
    "inactivity",
    "inactive",
    "productivity",
    "guilt",
    "lazy",
    "should",
    "must",
    "need to"
]


def _passes_constitution(statement: str) -> bool:
    lowered = statement.lower()
    if any(phrase in lowered for phrase in FORBIDDEN_PHRASES):
        return False
    if re.search(r"\b\d+\s*(day|days|hour|hours|weeks)\b", lowered):
        return False
    return True


def _tone_prefix(delivery_preference: Dict[str, Any]) -> str:
    style = (delivery_preference.get("communication_style") or "").lower()
    if style in {"direct", "decisive", "blunt"}:
        return ""
    if style in {"supportive", "gentle", "calm"}:
        return "Quietly noting: "
    return "Noting: "


def _get_week_context(supabase_admin, business_profile_id: str) -> Dict[str, Any]:
    try:
        result = supabase_admin.table("working_schedules").select("*").eq(
            "business_profile_id", business_profile_id
        ).order("week_number", desc=False).execute()
        schedules = result.data if result.data else []
    except Exception:
        schedules = []

    if not schedules:
        return {"week_number": None, "focus_area": None}

    today = datetime.now(timezone.utc).date()
    for schedule in schedules:
        start = schedule.get("week_start_date")
        end = schedule.get("week_end_date")
        try:
            start_date = datetime.fromisoformat(str(start)).date() if start else None
            end_date = datetime.fromisoformat(str(end)).date() if end else None
        except Exception:
            start_date = None
            end_date = None
        if start_date and end_date and start_date <= today <= end_date:
            return {
                "week_number": schedule.get("week_number"),
                "focus_area": schedule.get("focus_area")
            }
    return {
        "week_number": schedules[0].get("week_number"),
        "focus_area": schedules[0].get("focus_area")
    }


def _count_interactions(supabase_admin, user_id: str, start: datetime, end: datetime) -> Dict[str, Any]:
    total = 0
    last_interaction = None
    tables = ["chat_history", "soundboard_conversations", "advisory_log", "documents", "data_files"]
    for table in tables:
        try:
            result = supabase_admin.table(table).select("created_at", count="exact").eq(
                "user_id", user_id
            ).gte("created_at", start.isoformat()).lt("created_at", end.isoformat()).execute()
            total += result.count or 0
            if result.data:
                for row in result.data:
                    created = row.get("created_at")
                    try:
                        created_dt = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
                    except Exception:
                        created_dt = None
                    if created_dt and (not last_interaction or created_dt > last_interaction):
                        last_interaction = created_dt
        except Exception:
            continue
    return {"count": total, "last_interaction": last_interaction}


def _get_high_severity_events(supabase_admin, account_id: str) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    fourteen_days_ago = now - timedelta(days=14)
    three_days_ago = now - timedelta(days=3)

    def fetch_count(start: datetime, end: datetime) -> int:
        result = supabase_admin.table("watchtower_events").select("id", count="exact").eq(
            "account_id", account_id
        ).in_("severity", ["high", "critical"]).gte("created_at", start.isoformat()).lt("created_at", end.isoformat()).execute()
        return result.count or 0

    recent = fetch_count(seven_days_ago, now)
    prior = fetch_count(fourteen_days_ago, seven_days_ago)

    unack = supabase_admin.table("watchtower_events").select("id", count="exact").eq(
        "account_id", account_id
    ).in_("severity", ["high", "critical"]).lt("created_at", three_days_ago.isoformat()).eq("status", "active").execute().count or 0

    compounding = supabase_admin.table("watchtower_events").select("source").eq(
        "account_id", account_id
    ).in_("source", ["canonical_moment_revenue_risk", "canonical_moment_founder_strain", "canonical_moment_strategy_drift"]).eq("status", "active").execute().data

    compounding_sources = {row.get("source") for row in (compounding or []) if row.get("source")}

    return {
        "recent": recent,
        "prior": prior,
        "unacknowledged": unack,
        "compounding_sources": compounding_sources
    }


async def evaluate_silence_intervention(user_id: str, account_id: str, supabase_admin, watchtower_store) -> Optional[Dict[str, Any]]:
    try:
        now = datetime.now(timezone.utc)
        business_profile = supabase_admin.table("business_profiles").select("id, business_stage").eq(
            "user_id", user_id
        ).execute().data
        if not business_profile:
            return None

        business_profile = business_profile[0]
        business_profile_id = business_profile.get("id")
        business_stage = business_profile.get("business_stage") or ""

        week_context = _get_week_context(supabase_admin, business_profile_id)
        week_number = week_context.get("week_number")
        focus_area = week_context.get("focus_area") or "current priorities"

        progress = supabase_admin.table("progress_cadence").select("next_check_in_date").eq(
            "user_id", user_id
        ).execute().data
        next_check = progress[0].get("next_check_in_date") if progress else None
        if isinstance(next_check, str):
            try:
                next_check = datetime.fromisoformat(next_check.replace("Z", "+00:00"))
            except Exception:
                next_check = None

        missed_checkin = bool(next_check and next_check < now)

        recent_activity = _count_interactions(supabase_admin, user_id, now - timedelta(days=7), now)
        prior_activity = _count_interactions(supabase_admin, user_id, now - timedelta(days=35), now - timedelta(days=7))
        baseline_week = prior_activity["count"] / 4 if prior_activity["count"] else 0
        usage_drop = baseline_week and recent_activity["count"] < baseline_week * 0.5

        severity_signals = _get_high_severity_events(supabase_admin, account_id)
        no_interaction_high = severity_signals["unacknowledged"] > 0 and recent_activity["count"] == 0
        behaviour_increase = severity_signals["recent"] > severity_signals["prior"] and (usage_drop or recent_activity["count"] == 0)

        silence_flags = {
            "missed_checkin": missed_checkin,
            "usage_drop": usage_drop,
            "no_interaction_high": no_interaction_high,
            "behaviour_increase": behaviour_increase,
            "compounding_sources": list(severity_signals["compounding_sources"])
        }

        risk_score = 0
        if missed_checkin:
            risk_score += 30
        if usage_drop:
            risk_score += 20
        if no_interaction_high:
            risk_score += 25
        if behaviour_increase:
            risk_score += 25
        risk_score += 10 * len(severity_signals["compounding_sources"])
        risk_score = min(100, risk_score)

        try:
            core = get_cognitive_core()
        except Exception:
            core = CognitiveCore(supabase_admin)

        profile = await core.get_profile(user_id)
        memory = profile.get("consequence_memory", {}) or {}
        interventions = memory.get("silence_interventions", [])
        interventions_updated = False

        last_interaction_at = recent_activity["last_interaction"]

        for entry in interventions:
            if not entry.get("response_received") and last_interaction_at:
                entry_created = entry.get("created_at")
                try:
                    entry_created_dt = datetime.fromisoformat(str(entry_created).replace("Z", "+00:00"))
                except Exception:
                    entry_created_dt = None
                if entry_created_dt and last_interaction_at > entry_created_dt:
                    entry["response_received"] = True
                    entry["response_at"] = last_interaction_at.isoformat()
                    entry["conditions_improved"] = risk_score < entry.get("risk_score", risk_score)
                    interventions_updated = True

        if not any([missed_checkin, usage_drop, no_interaction_high, behaviour_increase]):
            if interventions_updated:
                memory.update({
                    "silence_interventions": interventions,
                    "engagement_risk_score": risk_score,
                    "last_interaction_at": last_interaction_at.isoformat() if last_interaction_at else None
                })
                await core.observe(user_id, {
                    "type": "silence_intervention",
                    "layer": "consequence_memory",
                    "payload": memory
                })
            return None

        ignored_count = len([entry for entry in interventions if not entry.get("response_received")])

        escalation_level = 1
        if ignored_count >= 1 or risk_score >= 60 or ("canonical_moment_strategy_drift" in severity_signals["compounding_sources"] and missed_checkin):
            escalation_level = 2
        if ignored_count >= 2 or (risk_score >= 80 and severity_signals["compounding_sources"]):
            escalation_level = 3

        delivery_preference = profile.get("delivery_preference", {}) or {}
        tone_prefix = _tone_prefix(delivery_preference)

        week_label = f"Week {week_number}" if week_number else "This week"
        stage_phrase = f"{business_stage} stage" if business_stage else "current stage"

        if escalation_level == 1:
            statement = (
                f"{tone_prefix}{week_label} ({stage_phrase}) is quieter than your usual rhythm. "
                "If attention shifted elsewhere, I’m holding the thread and tracking what matters."
            )
        elif escalation_level == 2:
            statement = (
                f"{tone_prefix}{week_label} focus is {focus_area}. "
                "Signals are rising while responses stay quiet. I’m watching decision quality as the load builds."
            )
        else:
            statement = (
                f"{tone_prefix}{week_label} focus is {focus_area}. "
                "Silence alongside rising signals is now a material risk. I need to be direct so the plan stays intact."
            )

        if not _passes_constitution(statement):
            if interventions_updated:
                memory.update({
                    "silence_interventions": interventions,
                    "engagement_risk_score": risk_score,
                    "last_interaction_at": last_interaction_at.isoformat() if last_interaction_at else None
                })
                await core.observe(user_id, {
                    "type": "silence_intervention",
                    "layer": "consequence_memory",
                    "payload": memory
                })
            return None

        severity = "medium" if escalation_level == 1 else "high" if escalation_level == 2 else "critical"

        event = {
            "id": str(uuid4()),
            "account_id": account_id,
            "type": SILENCE_TEMPLATE["type"],
            "domain": SILENCE_TEMPLATE["domain"],
            "severity": severity,
            "headline": f"Silence intervention — level {escalation_level}",
            "statement": statement,
            "evidence_payload": {
                "template_id": SILENCE_TEMPLATE["template_id"],
                "engagement_risk_score": risk_score,
                "escalation_level": escalation_level,
                "week_number": week_number,
                "focus_area": focus_area,
                "business_stage": business_stage,
                "flags": silence_flags,
                "delivery_tone": delivery_preference.get("communication_style") or "calm"
            },
            "consequence_window": week_label,
            "source": "silence_intervention",
            "fingerprint": f"silence_{user_id}_{week_number or 'current'}_{escalation_level}",
            "status": "active",
            "created_at": now.isoformat()
        }

        await watchtower_store.create_event(event)

        interventions.append({
            "event_id": event["id"],
            "level": escalation_level,
            "risk_score": risk_score,
            "created_at": now.isoformat(),
            "response_received": False,
            "conditions_improved": False
        })

        memory.update({
            "silence_interventions": interventions,
            "engagement_risk_score": risk_score,
            "last_interaction_at": last_interaction_at.isoformat() if last_interaction_at else None,
            "last_silence_level": escalation_level
        })

        await core.observe(user_id, {
            "type": "silence_intervention",
            "layer": "consequence_memory",
            "payload": memory
        })

        return event

    except Exception as e:
        logger.error(f"Error in silence intervention: {e}")
        return None


async def detect_all_silence(supabase_admin, watchtower_store) -> List[Dict[str, Any]]:
    events = []
    try:
        users_result = supabase_admin.table("progress_cadence").select(
            "user_id"
        ).eq("cadence_type", "weekly").execute()

        for record in users_result.data:
            user_id = record.get("user_id")
            profile_result = supabase_admin.table("business_profiles").select(
                "account_id"
            ).eq("user_id", user_id).execute()

            if not profile_result.data:
                continue

            account_id = profile_result.data[0].get("account_id")
            if not account_id:
                continue

            event = await evaluate_silence_intervention(user_id, account_id, supabase_admin, watchtower_store)
            if event:
                events.append(event)
    except Exception as e:
        logger.error(f"Error detecting silence for all users: {e}")

    return events


async def process_silence_interventions(supabase_admin, watchtower_store):
    logger.info("Running silence intervention detection...")
    events = await detect_all_silence(supabase_admin, watchtower_store)
    logger.info(f"Silence intervention complete: {len(events)} events created")
    return events
