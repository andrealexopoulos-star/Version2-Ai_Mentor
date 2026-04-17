"""
BIQc Watchtower — Server-Side Intelligence Engine
RPC-Based Cold Read (High-Performance)

Executes intelligence logic in PostgreSQL, not Python.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from uuid import uuid4

from cognitive_core_supabase import CognitiveCore, get_cognitive_core
from routes.deps import get_lookback_days, _normalize_subscription_tier

logger = logging.getLogger(__name__)

CANONICAL_TEMPLATES = {
    "revenue_risk": {
        "template_id": "canonical_revenue_risk_v1",
        "domain": "pipeline",
        "type": "risk"
    },
    "founder_strain": {
        "template_id": "canonical_founder_strain_v1",
        "domain": "operations",
        "type": "anomaly"
    },
    "strategy_drift": {
        "template_id": "canonical_strategy_drift_v1",
        "domain": "operations",
        "type": "drift"
    }
}

SENSITIVITY_THRESHOLDS = {
    "high": 14,
    "medium": 21,
    "low": 28
}

DRIFT_TOLERANCE_DAYS = 4
MAX_STATEMENT_LENGTH = 220


def _register_canonical_templates() -> Dict[str, Dict[str, str]]:
    """Register canonical templates in-process for Watchtower."""
    return CANONICAL_TEMPLATES


def _safe_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _trim_statement(statement: str) -> str:
    if len(statement) <= MAX_STATEMENT_LENGTH:
        return statement
    return statement[:MAX_STATEMENT_LENGTH].rsplit(" ", 1)[0] + "…"


def _contains_forbidden(statement: str, forbidden: List[str]) -> bool:
    lowered = statement.lower()
    return any(phrase in lowered for phrase in forbidden)


def _passes_constitution(statement: str, forbidden: List[str]) -> bool:
    if _contains_forbidden(statement, forbidden):
        return False
    if "week " not in statement.lower():
        return False
    if len(statement) > MAX_STATEMENT_LENGTH:
        return False
    if _contains_forbidden(statement, ["should", "recommend", "suggest", "next step", "action"]):
        return False
    return True


def _get_threshold_days(sensitivity: Optional[str]) -> int:
    if not sensitivity:
        return SENSITIVITY_THRESHOLDS["medium"]
    return SENSITIVITY_THRESHOLDS.get(sensitivity, SENSITIVITY_THRESHOLDS["medium"])


def _get_priority_context(supabase_admin: Any, business_profile_id: Optional[str], user_id: str) -> Dict[str, Dict[str, Any]]:
    priorities = []
    if business_profile_id:
        try:
            result = supabase_admin.table("intelligence_priorities").select("*").eq(
                "business_profile_id", business_profile_id
            ).eq("enabled", True).execute()
            priorities = result.data if result.data else []
        except Exception as e:
            logger.error(f"Priority fetch failed: {e}")

    if not priorities:
        priorities = [
            {"signal_category": "revenue_sales", "priority_rank": 1, "threshold_sensitivity": "high"},
            {"signal_category": "team_capacity", "priority_rank": 2, "threshold_sensitivity": "medium"},
            {"signal_category": "strategy_drift", "priority_rank": 3, "threshold_sensitivity": "medium"}
        ]

    return {p["signal_category"]: p for p in priorities}


def _get_schedule_context(supabase_admin: Any, business_profile_id: Optional[str]) -> Dict[str, Any]:
    if not business_profile_id:
        return {"week_number": None, "focus_area": None, "week_start_date": None, "week_end_date": None}

    try:
        result = supabase_admin.table("working_schedules").select("*").eq(
            "business_profile_id", business_profile_id
        ).order("week_number", desc=False).execute()
        schedules = result.data if result.data else []
    except Exception as e:
        logger.error(f"Schedule fetch failed: {e}")
        schedules = []

    if not schedules:
        return {"week_number": None, "focus_area": None, "week_start_date": None, "week_end_date": None}

    today = datetime.now(timezone.utc).date()
    current = None
    for schedule in schedules:
        start = _safe_datetime(schedule.get("week_start_date"))
        end = _safe_datetime(schedule.get("week_end_date"))
        if start and end and start.date() <= today <= end.date():
            current = schedule
            break

    if not current:
        current = next((s for s in schedules if s.get("status") == "in_progress"), schedules[0])

    return {
        "week_number": current.get("week_number"),
        "focus_area": current.get("focus_area"),
        "week_start_date": current.get("week_start_date"),
        "week_end_date": current.get("week_end_date")
    }


async def _get_cognitive_context(user_id: str, supabase_admin: Any) -> Dict[str, Any]:
    try:
        try:
            core = get_cognitive_core()
        except Exception:
            core = CognitiveCore(supabase_admin)
        profile = await core.get_profile(user_id)
    except Exception as e:
        logger.error(f"Cognitive context load failed: {e}")
        profile = {}

    return {
        "delivery_preference": profile.get("delivery_preference", {}) or {},
        "behavioural_truth": profile.get("behavioural_truth", {}) or {},
        "immutable_reality": profile.get("immutable_reality", {}) or {}
    }


def _tone_prefix(delivery_preference: Dict[str, Any]) -> str:
    style = (delivery_preference.get("communication_style") or "").lower()
    if style in {"direct", "decisive", "blunt"}:
        return ""
    if style in {"supportive", "gentle", "calm"}:
        return "Quietly noting: "
    return "Noting: "


def _derive_delivery_window(delivery_preference: Dict[str, Any], cadence: Optional[Dict[str, Any]]) -> str:
    support_cadence = (delivery_preference.get("support_cadence") or "").lower()
    if support_cadence in {"weekly", "biweekly", "monthly"} and cadence and cadence.get("next_check_in_date"):
        return f"next_check_in:{cadence.get('next_check_in_date')}"
    return "immediate"


def _derive_severity(priority_rank: Optional[int], intensity: int) -> str:
    if priority_rank == 1 and intensity >= 30:
        return "critical"
    if priority_rank and priority_rank <= 2:
        return "high"
    return "medium"


def _escalate_severity(severity: str) -> str:
    levels = ["low", "medium", "high", "critical"]
    if severity not in levels:
        return severity
    return levels[min(levels.index(severity) + 1, len(levels) - 1)]


def _apply_cognitive_weighting(severity: str, behaviour: Dict[str, Any], immutable: Dict[str, Any], focus: str) -> str:
    if focus == "capacity" and behaviour.get("stress_tolerance") == "low":
        return _escalate_severity(severity)
    if focus == "drift" and behaviour.get("follow_through_reliability") == "low":
        return _escalate_severity(severity)
    if focus == "revenue" and immutable.get("risk_exposure") == "high":
        return _escalate_severity(severity)
    return severity


def _calculate_avg_gap_days(dates: List[datetime]) -> Optional[int]:
    if len(dates) < 2:
        return None
    gaps = []
    for idx in range(len(dates) - 1):
        gap = (dates[idx] - dates[idx + 1]).days
        if gap > 0:
            gaps.append(gap)
    if not gaps:
        return None
    return int(sum(gaps) / len(gaps))


async def _get_contact_metadata(supabase_admin: Any, user_id: str, email: str) -> Dict[str, Any]:
    try:
        result = supabase_admin.table("outlook_emails").select(
            "from_name,from_address,received_date"
        ).eq("user_id", user_id).eq("from_address", email).order("received_date", desc=True).limit(1).execute()
        if result.data:
            return result.data[0]
    except Exception:
        pass
    return {"from_name": None, "from_address": email}


async def _get_contact_gap(supabase_admin: Any, user_id: str, email: str) -> Optional[int]:
    try:
        result = supabase_admin.table("outlook_emails").select("received_date").eq(
            "user_id", user_id
        ).eq("from_address", email).order("received_date", desc=True).limit(6).execute()
        dates = [_safe_datetime(row.get("received_date")) for row in (result.data or [])]
        dates = [d for d in dates if d]
        return _calculate_avg_gap_days(dates)
    except Exception:
        return None


def _count_calendar_events(supabase_admin: Any, user_id: str, start_dt: datetime, end_dt: datetime) -> int:
    try:
        result = supabase_admin.table("outlook_calendar_events").select(
            "id", count="exact"
        ).eq("user_id", user_id).gte("start_time", start_dt.isoformat()).lt("start_time", end_dt.isoformat()).execute()
        return result.count if result.count is not None else 0
    except Exception:
        return 0


def _is_small_team(team_size: Any) -> bool:
    if team_size is None:
        return False
    if isinstance(team_size, (int, float)):
        return team_size <= 3
    if isinstance(team_size, str):
        return any(token in team_size for token in ["1-", "2-", "3", "small"])
    return False


async def _build_revenue_risk(context: Dict[str, Any], supabase_admin: Any) -> Optional[Dict[str, Any]]:
    priority = context["priorities"].get("revenue_sales")
    if not priority or priority.get("priority_rank", 99) > 2:
        return None

    threshold = _get_threshold_days(priority.get("threshold_sensitivity"))
    # Use tier-based lookback; -1 (unlimited) maps to a large window for the RPC
    _lookback = context.get("lookback_days", 180)
    rpc_lookback = 3650 if _lookback == -1 else _lookback  # ~10 years for unlimited tiers
    try:
        response = supabase_admin.rpc('analyze_ghosted_vips', {
            'target_user_id': context["user_id"],
            'lookback_days': rpc_lookback,
            'silence_threshold_days': threshold
        }).execute()
    except Exception as e:
        logger.error(f"Revenue risk RPC failed: {e}")
        return None

    ghosts = response.data or []
    if not ghosts:
        return None

    week_number = context["week"]["week_number"] or 1
    focus_area = context["week"]["focus_area"] or "revenue focus"
    delivery_pref = context["delivery_preference"]
    tone_prefix = "From the outside, "

    for ghost in ghosts:
        contact_email = ghost.get("sender_email")
        if not contact_email:
            continue

        last_contact_dt = _safe_datetime(ghost.get("last_contact"))
        if not last_contact_dt:
            continue

        days_silent = (datetime.now(timezone.utc) - last_contact_dt).days
        avg_gap = await _get_contact_gap(supabase_admin, context["user_id"], contact_email)
        avg_gap = avg_gap or max(7, int(threshold / 2))
        deviation_days = days_silent - avg_gap

        if deviation_days < max(7, avg_gap):
            continue

        contact_meta = await _get_contact_metadata(supabase_admin, context["user_id"], contact_email)
        contact_name = contact_meta.get("from_name") or contact_email

        msg_count = int(ghost.get("msg_count") or 0)
        priority_rank = priority.get("priority_rank")

        statement = (
            f"{tone_prefix}Week {week_number} focus is {focus_area}. "
            f"{contact_name} ({contact_email}) has been quiet for {days_silent} days "
            f"vs a {avg_gap}-day rhythm across {msg_count} prior messages, "
            f"which matters for a rank-{priority_rank} revenue signal right now."
        )
        statement = _trim_statement(statement)

        if not _passes_constitution(statement, ["ghosting", "email not replied"]):
            continue

        severity = _apply_cognitive_weighting(
            _derive_severity(priority_rank, days_silent),
            context["behavioural_truth"],
            context["immutable_reality"],
            "revenue"
        )

        return {
            "id": str(uuid4()),
            "account_id": context["account_id"],
            "type": CANONICAL_TEMPLATES["revenue_risk"]["type"],
            "domain": CANONICAL_TEMPLATES["revenue_risk"]["domain"],
            "severity": severity,
            "headline": f"Revenue relationship risk: {contact_name}",
            "statement": statement,
            "evidence_payload": {
                "template_id": CANONICAL_TEMPLATES["revenue_risk"]["template_id"],
                "contact_name": contact_name,
                "contact_email": contact_email,
                "days_silent": days_silent,
                "avg_gap_days": avg_gap,
                "deviation_days": deviation_days,
                "historical_messages": msg_count,
                "priority_rank": priority_rank,
                "week_number": week_number,
                "focus_area": focus_area,
                "cognitive_weighting": {
                    "risk_exposure": context["immutable_reality"].get("risk_exposure"),
                    "decision_velocity": context["behavioural_truth"].get("decision_velocity")
                },
                "delivery_tone": delivery_pref.get("communication_style") or "advisory",
                "delivery_window": context["delivery_window"]
            },
            "consequence_window": f"Week {week_number}",
            "source": "canonical_moment_revenue_risk",
            "fingerprint": f"canonical_revenue_{contact_email[:40]}",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat()
        }

    return None


async def _build_founder_strain(context: Dict[str, Any], supabase_admin: Any) -> Optional[Dict[str, Any]]:
    priority = context["priorities"].get("team_capacity") or {}

    profile = context["business_profile"]
    immutable = context["immutable_reality"]
    behaviour = context["behavioural_truth"]

    team_size = profile.get("team_size") or immutable.get("team_size") or profile.get("team_size_range")
    team_size_label = team_size or "small team"

    founder_centrality = _is_small_team(team_size) or (profile.get("business_stage") in {"idea", "startup"})
    team_capacity_constrained = behaviour.get("time_scarcity") in {"high", "very_high"} or bool(profile.get("team_gaps"))

    if not (founder_centrality or team_capacity_constrained):
        return None

    now = datetime.now(timezone.utc)
    current_events = _count_calendar_events(supabase_admin, context["user_id"], now, now + timedelta(days=7))
    baseline_total = _count_calendar_events(supabase_admin, context["user_id"], now - timedelta(days=28), now)
    baseline_weekly = int(round(baseline_total / 4)) if baseline_total else 0
    calendar_spike = baseline_weekly and current_events >= max(3, int(baseline_weekly * 1.5))

    late_hours = 0
    try:
        burnout_response = supabase_admin.rpc('analyze_burnout_risk', {
            'target_user_id': context["user_id"]
        }).execute()
        late_hours = int(burnout_response.data or 0)
    except Exception:
        late_hours = 0

    cadence = context.get("progress_cadence") or {}
    missed_checkin = False
    checkin_overdue_days = None
    next_check = _safe_datetime(cadence.get("next_check_in_date"))
    if next_check and next_check < now - timedelta(days=2):
        missed_checkin = True
        checkin_overdue_days = (now - next_check).days

    if not any([calendar_spike, late_hours > 3, missed_checkin]):
        return None

    week_number = context["week"]["week_number"] or 1
    focus_area = context["week"]["focus_area"] or "current execution focus"
    delivery_pref = context["delivery_preference"]
    tone_prefix = _tone_prefix(delivery_pref)

    load_phrase = f"calendar load is {current_events} meetings" if current_events else "calendar load has risen"
    baseline_phrase = f"vs your ~{baseline_weekly}/week baseline" if baseline_weekly else "above your recent baseline"
    late_phrase = f"and {late_hours} late-hour sends in the last 7 days" if late_hours > 3 else ""
    checkin_phrase = f"Weekly check-in is {checkin_overdue_days} days past due" if missed_checkin else ""

    statement = (
        f"{tone_prefix}Week {week_number} focus is {focus_area}. "
        f"{load_phrase} {baseline_phrase}{late_phrase}. "
        f"With a {team_size_label} team, that load is pressing decision bandwidth this week."
    )
    if checkin_phrase:
        statement = _trim_statement(statement + f" {checkin_phrase}.")
    else:
        statement = _trim_statement(statement)

    if not _passes_constitution(statement, ["burnout", "productivity"]):
        return None

    priority_rank = priority.get("priority_rank")
    severity = _apply_cognitive_weighting(
        _derive_severity(priority_rank, max(current_events, late_hours)),
        context["behavioural_truth"],
        context["immutable_reality"],
        "capacity"
    )

    return {
        "id": str(uuid4()),
        "account_id": context["account_id"],
        "type": CANONICAL_TEMPLATES["founder_strain"]["type"],
        "domain": CANONICAL_TEMPLATES["founder_strain"]["domain"],
        "severity": severity,
        "headline": "Leader capacity pressure noted",
        "statement": statement,
        "evidence_payload": {
            "template_id": CANONICAL_TEMPLATES["founder_strain"]["template_id"],
            "calendar_events_next_7d": current_events,
            "calendar_baseline_weekly": baseline_weekly,
            "late_hour_sends_7d": late_hours,
            "checkin_overdue_days": checkin_overdue_days,
            "team_size": team_size_label,
            "priority_rank": priority_rank,
            "week_number": week_number,
            "focus_area": focus_area,
            "cognitive_weighting": {
                "stress_tolerance": context["behavioural_truth"].get("stress_tolerance"),
                "time_scarcity": context["behavioural_truth"].get("time_scarcity")
            },
            "delivery_tone": delivery_pref.get("communication_style") or "protective",
            "delivery_window": context["delivery_window"]
        },
        "consequence_window": f"Week {week_number}",
        "source": "canonical_moment_founder_strain",
        "fingerprint": f"canonical_founder_{context['user_id'][:12]}",
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }


async def _build_strategy_drift(context: Dict[str, Any], supabase_admin: Any) -> Optional[Dict[str, Any]]:
    focus_area = context["week"].get("focus_area")
    week_number = context["week"].get("week_number")
    week_start = _safe_datetime(context["week"].get("week_start_date"))

    if not focus_area or not week_number or not week_start:
        return None

    now = datetime.now(timezone.utc)
    days_into_week = (now - week_start).days
    if days_into_week < DRIFT_TOLERANCE_DAYS:
        return None

    since = (now - timedelta(days=7)).isoformat()
    activity_items = []
    activity_text = ""

    try:
        docs_result = supabase_admin.table("documents").select("title,document_type").eq(
            "user_id", context["user_id"]
        ).gte("created_at", since).order("created_at", desc=True).limit(4).execute()
        for doc in (docs_result.data or []):
            label = doc.get("title") or doc.get("document_type")
            if label:
                activity_items.append(label)
    except Exception:
        pass

    try:
        files_result = supabase_admin.table("data_files").select("filename,category").eq(
            "user_id", context["user_id"]
        ).gte("created_at", since).order("created_at", desc=True).limit(4).execute()
        for file in (files_result.data or []):
            label = file.get("category") or file.get("filename")
            if label:
                activity_items.append(label)
    except Exception:
        pass

    try:
        chats_result = supabase_admin.table("chat_history").select("message").eq(
            "user_id", context["user_id"]
        ).gte("created_at", since).order("created_at", desc=True).limit(4).execute()
        for chat in (chats_result.data or []):
            snippet = (chat.get("message") or "").split(" ")[:4]
            if snippet:
                activity_items.append(" ".join(snippet))
    except Exception:
        pass

    activity_items = [item for item in activity_items if item]
    if not activity_items:
        return None

    activity_summary = ", ".join(activity_items[:3])
    activity_text = " ".join(activity_items).lower()

    focus_keywords = [w for w in focus_area.lower().replace("/", " ").split() if len(w) >= 4]
    aligned = any(keyword in activity_text for keyword in focus_keywords)
    if aligned:
        return None

    delivery_pref = context["delivery_preference"]
    tone_prefix = _tone_prefix(delivery_pref)
    statement = (
        f"{tone_prefix}Week {week_number} focus is '{focus_area}'. "
        f"Over the last {days_into_week} days, activity has centered on {activity_summary}, "
        f"which is drifting from that focus."
    )
    statement = _trim_statement(statement)

    if not _passes_constitution(statement, ["wrong", "fix", "should"]):
        return None

    priority = context["priorities"].get("strategy_drift") or {}
    priority_rank = priority.get("priority_rank")
    severity = _apply_cognitive_weighting(
        _derive_severity(priority_rank, days_into_week),
        context["behavioural_truth"],
        context["immutable_reality"],
        "drift"
    )

    return {
        "id": str(uuid4()),
        "account_id": context["account_id"],
        "type": CANONICAL_TEMPLATES["strategy_drift"]["type"],
        "domain": CANONICAL_TEMPLATES["strategy_drift"]["domain"],
        "severity": severity,
        "headline": "Strategy focus is drifting",
        "statement": statement,
        "evidence_payload": {
            "template_id": CANONICAL_TEMPLATES["strategy_drift"]["template_id"],
            "focus_area": focus_area,
            "week_number": week_number,
            "days_into_week": days_into_week,
            "activity_summary": activity_summary,
            "priority_rank": priority_rank,
            "cognitive_weighting": {
                "follow_through_reliability": context["behavioural_truth"].get("follow_through_reliability"),
                "decision_velocity": context["behavioural_truth"].get("decision_velocity")
            },
            "delivery_tone": delivery_pref.get("communication_style") or "neutral",
            "delivery_window": context["delivery_window"]
        },
        "consequence_window": f"Week {week_number}",
        "source": "canonical_moment_strategy_drift",
        "fingerprint": f"canonical_drift_{context['user_id'][:12]}_{week_number}",
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }


async def generate_cold_read(
    user_id: str,
    account_id: str,
    supabase_admin: Any,
    watchtower_store: Any
) -> Dict[str, Any]:
    """
    Executes the Canonical Intelligence Moments using Supabase signals + calibration context.
    """
    insights = []

    _register_canonical_templates()

    try:
        profile_result = supabase_admin.table("business_profiles").select("*").eq("user_id", user_id).single().execute()
        business_profile = profile_result.data if profile_result.data else {}
    except Exception:
        business_profile = {}

    business_profile_id = business_profile.get("id")
    priorities = _get_priority_context(supabase_admin, business_profile_id, user_id)
    schedule_context = _get_schedule_context(supabase_admin, business_profile_id)

    cadence_result = None
    try:
        cadence_result = supabase_admin.table("progress_cadence").select("*").eq("user_id", user_id).single().execute()
    except Exception:
        cadence_result = None
    progress_cadence = cadence_result.data if cadence_result and cadence_result.data else {}

    cognitive_context = await _get_cognitive_context(user_id, supabase_admin)
    delivery_window = _derive_delivery_window(cognitive_context["delivery_preference"], progress_cadence)

    # Resolve user tier for lookback window
    try:
        user_row = supabase_admin.table("users").select("subscription_tier").eq("id", user_id).maybe_single().execute()
        raw_tier = (user_row.data or {}).get("subscription_tier", "free")
    except Exception:
        raw_tier = "free"
    tier = _normalize_subscription_tier(raw_tier)
    lookback_days = get_lookback_days(tier)

    context = {
        "user_id": user_id,
        "account_id": account_id,
        "business_profile": business_profile,
        "priorities": priorities,
        "week": schedule_context,
        "progress_cadence": progress_cadence,
        "delivery_preference": cognitive_context["delivery_preference"],
        "behavioural_truth": cognitive_context["behavioural_truth"],
        "immutable_reality": cognitive_context["immutable_reality"],
        "delivery_window": delivery_window,
        "tier": tier,
        "lookback_days": lookback_days,
    }

    revenue_event = await _build_revenue_risk(context, supabase_admin)
    founder_event = await _build_founder_strain(context, supabase_admin)
    drift_event = await _build_strategy_drift(context, supabase_admin)

    for event in [revenue_event, founder_event, drift_event]:
        if event:
            await watchtower_store.create_event(event)
            insights.append(event)

    if insights:
        logger.info(f"🎯 Canonical moments generated: {len(insights)}")
        return {
            "events_created": len(insights),
            "status": "complete",
            "method": "canonical_moments"
        }

    logger.info("ℹ️ Canonical moments: no qualifying signals")
    return {
        "events_created": 0,
        "status": "no_patterns",
        "method": "canonical_moments"
    }
