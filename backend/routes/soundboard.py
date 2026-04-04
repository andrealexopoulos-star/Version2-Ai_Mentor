"""
MySoundBoard Routes — Thinking Partner
Extracted from server.py. Prompts loaded from Supabase system_prompts table.
Instrumented with Intelligence Spine LLM logging.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import asyncio
from pydantic import BaseModel
from typing import Optional, Dict, Any, List, AsyncGenerator
from datetime import datetime, timezone
import uuid
import logging
import os
import json
import re

from core.llm_router import llm_chat, llm_chat_with_usage
from core.advisor_response_style import (
    build_advisor_style_guidance,
    build_flagship_response_contract_text,
    ensure_flagship_response_sections,
    parse_flagship_response_slots,
)
from routes.deps import get_current_user, get_sb, OPENAI_KEY, AI_MODEL, logger
from routes.soundboard_contract import (
    CONTRACT_VERSION,
    build_contract_payload,
    enforce_mode_for_tier,
)
from prompt_registry import get_prompt
from auth_supabase import get_user_by_id
from supabase_intelligence_helpers import (
    get_business_profile_supabase,
    get_soundboard_conversation_supabase,
    update_soundboard_conversation_supabase,
    create_soundboard_conversation_supabase,
)
from fact_resolution import resolve_facts, build_known_facts_prompt

router = APIRouter()

SOUNDBOARD_V3_ENABLED = (os.environ.get("SOUNDBOARD_V3_ENABLED", "true").strip().lower() in {"1", "true", "yes"})
SOUNDBOARD_BOARDROOM_ORCH_ENABLED = (os.environ.get("SOUNDBOARD_BOARDROOM_ORCH_ENABLED", "true").strip().lower() in {"1", "true", "yes"})
SOUNDBOARD_HISTORY_LIMIT = int(os.environ.get("SOUNDBOARD_HISTORY_LIMIT", "50"))
SOUNDBOARD_CONTEXT_MESSAGES_LIMIT = int(os.environ.get("SOUNDBOARD_CONTEXT_MESSAGES_LIMIT", "24"))
SOUNDBOARD_BOARDROOM_CONTEXT_LIMIT = int(os.environ.get("SOUNDBOARD_BOARDROOM_CONTEXT_LIMIT", "16"))


def _call_cognition_for_soundboard(sb, user_id):
    """Fetch live cognition data for SoundBoard context."""
    try:
        result = sb.rpc('ic_generate_cognition_contract', {
            'p_tenant_id': user_id, 'p_tab': 'overview'
        }).execute()
        return result.data if result.data else None
    except Exception:
        return None


def _polish_response(text):
    """Post-process AI response to enforce quality standards."""
    import re

    # Remove lines that start with numbered lists (1. 2. 3.)
    lines = text.split('\n')
    cleaned = []
    for line in lines:
        stripped = line.strip()
        # Convert numbered list items to prose
        match = re.match(r'^(\d+)\.\s+\*\*(.+?)\*\*:?\s*(.*)', stripped)
        if match:
            title = match.group(2)
            rest = match.group(3)
            cleaned.append(f"{title}: {rest}" if rest else f"{title}.")
        elif re.match(r'^(\d+)\.\s+\*\*(.+?)\*\*', stripped):
            # Bold-only list item
            match2 = re.match(r'^(\d+)\.\s+\*\*(.+?)\*\*\s*(.*)', stripped)
            if match2:
                cleaned.append(f"{match2.group(2)} {match2.group(3)}".strip())
            else:
                cleaned.append(stripped)
        elif re.match(r'^\d+\.\s', stripped):
            # Plain numbered item
            cleaned.append(re.sub(r'^\d+\.\s+', '', stripped))
        elif re.match(r'^[-•]\s', stripped):
            # Bullet point
            cleaned.append(re.sub(r'^[-•]\s+', '', stripped))
        else:
            cleaned.append(line)

    text = '\n'.join(cleaned)

    # Remove **bold** markdown
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)

    # Remove weak/hedging phrases aggressively
    weak_phrases = [
        r'[Ww]ithout [^.]*(?:data|insight|integration|connection|access|metric|feed|source|detail|information|visibility)[^.]*\.',
        r'[Gg]iven the (?:absence|lack|limited)[^.]*\.',
        r'[Tt]o (?:give|provide|get|move|refine)[^.]*(?:precise|detailed|specific|comprehensive|actionable|deeper|better)[^.]*\.',
        r'[Ww]e\'d ideally[^.]*\.',
        r'[Ii]t\'s difficult to[^.]*(?:precise|accurate|exact|detailed|specific)[^.]*\.',
        r'[Ll]et me know[^.]*\.',
        r'[Ww]ould you like[^?]*\?',
        r'[Nn]eed a deeper dive[^?]*\?',
        r'[Ii]f you[\'d]? like to (?:dive|explore|discuss|know)[^.]*\.',
        r'[Cc]onnecting (?:\w+ )*(?:data|financial|CRM|systems)[^.]*\.',
        r'[Yy]ou should consider connecting[^.]*\.',
        r'[Ff]or (?:a )?more (?:precise|detailed|comprehensive|accurate)[^.]*\.',
        r'[Hh]ere\'s (?:a )?rough[^.]*\.',
    ]
    for pattern in weak_phrases:
        text = re.sub(pattern, '', text)

    # Clean up double newlines
    text = re.sub(r'\n{3,}', '\n\n', text).strip()

    return text


def _build_grounded_exec_fallback(*, has_crm: bool, has_accounting: bool, has_email: bool, obs_events: List[Dict[str, Any]], rev: Dict[str, Any], risk: Dict[str, Any], people: Dict[str, Any]) -> str:
    connected = []
    if has_crm:
        connected.append("CRM")
    if has_accounting:
        connected.append("Accounting")
    if has_email:
        connected.append("Email")

    top_signals = []
    for event in (obs_events or [])[:3]:
        if not isinstance(event, dict):
            continue
        sig = event.get("signal_name", "signal")
        sev = str(event.get("severity", "medium")).upper()
        dom = event.get("domain", "business")
        top_signals.append(f"- {sig} ({sev}) in {dom}")

    pipeline_total = float((rev or {}).get("pipeline_total") or 0)
    stalled_deals = int((rev or {}).get("stalled_deals") or 0)
    overdue = (rev or {}).get("overdue_invoices") or []
    overdue_total = sum(float(i.get("amount") or 0) for i in overdue if isinstance(i, dict))
    risk_level = str((risk or {}).get("overall_risk") or "moderate").upper()
    capacity = (people or {}).get("capacity")
    fatigue = (people or {}).get("fatigue")

    lines = [
        "Priority now: contain the most material cross-functional risk cluster this week.",
        f"Connected systems: {', '.join(connected) if connected else 'integration visibility limited in this turn'}.",
    ]
    if obs_events:
        lines.extend([
            "Situation: I am using materialized BIQc signal events from your connected systems to provide this summary.",
            f"Live signal events materialized: {len(obs_events or [])}.",
        ])
    else:
        lines.extend([
            "Situation: I can see your connected systems, but the materialized BIQc signal layer for this turn is still thin.",
            "Live signal events materialized: 0 in this cycle.",
        ])
    if top_signals:
        lines.append("Top signals:\n" + "\n".join(top_signals))

    lines.append("Decision: Prioritise one cross-functional containment action across revenue, execution cadence, and client response latency this week.")
    lines.append(
        "Pathways: "
        "A) Immediate containment (owner assigned in 24h, deadline this week). "
        "B) Stabilisation sprint (2-week execution with daily telemetry check-ins)."
    )
    lines.append(
        "This week:\n"
        f"- Revenue checkpoint: pipeline ${pipeline_total:,.0f}, stalled deals {stalled_deals}.\n"
        f"- Cash checkpoint: overdue invoices ${overdue_total:,.0f}.\n"
        f"- Risk checkpoint: overall risk {risk_level}."
        + (f"\n- Workforce checkpoint: capacity {capacity if capacity is not None else 'unknown'} / fatigue {fatigue if fatigue is not None else 'unknown'}." if (capacity is not None or fatigue is not None) else "")
    )
    lines.append("KPI note: Track weekly cash conversion and stalled-deal recovery rate. If KPI targets are not set, set a baseline this week.")
    lines.append("Risk if delayed: unresolved signal clusters can compound into forecast misses, slower cash conversion, and lower client confidence.")
    return "\n\n".join(lines)


def _generic_response_detected(text: str) -> bool:
    cleaned = (text or "").strip().lower()
    if not cleaned:
        return True
    generic_markers = [
        "it depends",
        "in general",
        "generally speaking",
        "every business",
        "for most businesses",
        "without more context",
        "you may want to",
        "consider improving",
    ]
    marker_hit = any(marker in cleaned for marker in generic_markers)
    digit_count = sum(ch.isdigit() for ch in cleaned)
    return marker_hit or digit_count < 2


def _ensure_flagship_contract_sections(text: str) -> str:
    return ensure_flagship_response_sections(text)


def _choose_human_opening(seed: str) -> str:
    options = [
        "You're right to focus on this now.",
        "Makes sense to prioritise this first.",
        "This is the right place to focus this week.",
        "Good instinct — this is where the leverage is.",
    ]
    idx = abs(hash(seed or "biqc")) % len(options)
    return options[idx]


def _extract_last_assistant_message(messages_history: List[Dict[str, Any]]) -> str:
    for msg in reversed(messages_history or []):
        if str(msg.get("role", "")).lower() == "assistant":
            return str(msg.get("content") or "").strip()
    return ""


def _format_history_for_prompt(messages_history: List[Dict[str, Any]], *, limit: int) -> str:
    lines = []
    for message in (messages_history or [])[-limit:]:
        role = str(message.get("role") or "user").strip().lower()
        content = str(message.get("content") or "").strip()
        if not content:
            continue
        label = "Assistant" if role == "assistant" else "User"
        lines.append(f"{label}: {content}")
    return "\n".join(lines)


def _is_report_grade_request(message: str) -> bool:
    text = str(message or "").lower()
    report_patterns = [
        r"\b(board report|board pack|board summary|performance report|monthly report|quarterly report|executive report)\b",
        r"\b(last|past)\s+(12|twelve)\s+months?\b",
        r"\b12[- ]month\b",
        r"\b(review|analyse|analyze|summari[sz]e)\b.*\b(last|past)\s+(12|twelve)\s+months?\b",
        r"\b12[- ]month\s+(review|performance|narrative|summary)\b",
        r"\bhow the business performed\b",
    ]
    return any(re.search(pattern, text, re.IGNORECASE) for pattern in report_patterns)


def _fetch_observation_signal_state(sb, user_id: str) -> tuple[int, Optional[float]]:
    live_signal_count = 0
    live_signal_age_hours = None
    try:
        obs_result = (
            sb.table("observation_events")
            .select("observed_at", count="exact")
            .eq("user_id", user_id)
            .order("observed_at", desc=True)
            .limit(1)
            .execute()
        )
        live_signal_count = obs_result.count or 0
        if obs_result.data:
            last_obs = datetime.fromisoformat(obs_result.data[0]["observed_at"].replace("Z", "+00:00"))
            live_signal_age_hours = round((datetime.now(timezone.utc) - last_obs).total_seconds() / 3600, 1)
    except Exception:
        pass
    return live_signal_count, live_signal_age_hours


async def _attempt_soundboard_signal_materialization(sb, user_id: str) -> Dict[str, Any]:
    try:
        from workspace_helpers import get_user_account
        from merge_emission_layer import get_emission_layer

        account = await get_user_account(sb, user_id)
        if not account or not account.get("id"):
            return {"attempted": False, "signals_emitted": 0, "reason": "workspace_missing"}

        emission_layer = get_emission_layer()
        result = await emission_layer.run_emission(user_id, account["id"])
        emitted = int((result or {}).get("signals_emitted") or 0)
        logger.info(f"[soundboard] signal materialization user={user_id[:8]} emitted={emitted}")
        return {"attempted": True, "signals_emitted": emitted}
    except Exception as exc:
        logger.warning(f"[soundboard] signal materialization failed for user {user_id[:8]}: {exc}")
        return {"attempted": False, "signals_emitted": 0, "reason": str(exc)[:160]}


def _has_grounded_report_facts(*, rev: Dict[str, Any], risk: Dict[str, Any], obs_events: List[Dict[str, Any]]) -> bool:
    if obs_events:
        return True
    if float((rev or {}).get("pipeline_total") or 0) > 0:
        return True
    if int((rev or {}).get("stalled_deals") or 0) > 0:
        return True
    if bool((rev or {}).get("overdue_invoices")):
        return True
    if str((risk or {}).get("overall_risk") or "").lower() not in {"", "low", "unknown", "none"}:
        return True
    return False


def _report_window_meets_target(coverage_window: Dict[str, Any], *, min_days: int = 330) -> bool:
    start_raw = (coverage_window or {}).get("coverage_start")
    end_raw = (coverage_window or {}).get("coverage_end")
    if not start_raw or not end_raw:
        return False
    try:
        start_dt = datetime.fromisoformat(str(start_raw).replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(str(end_raw).replace("Z", "+00:00"))
    except Exception:
        return False
    if end_dt < start_dt:
        return False
    return (end_dt - start_dt).days >= min_days


def _build_retrieval_contract(
    *,
    report_grade_request: bool,
    grounded_report_ready: bool,
    guardrail_status: str,
    has_connected_sources: bool,
    live_signal_count: int,
    coverage_window: Dict[str, Any],
    retrieval_depth: Dict[str, Any],
    materialization_state: Dict[str, Any],
) -> Dict[str, Any]:
    missing_periods = list((coverage_window or {}).get("missing_periods") or [])
    if report_grade_request and grounded_report_ready:
        retrieval_mode = "report_grounded_materialized"
    elif report_grade_request:
        retrieval_mode = "report_grounding_blocked"
    elif live_signal_count > 0:
        retrieval_mode = "materialized_signals"
    elif has_connected_sources:
        retrieval_mode = "connector_connected_signal_thin"
    else:
        retrieval_mode = "profile_only"

    if guardrail_status == "BLOCKED":
        answer_grade = "BLOCKED"
    elif guardrail_status == "DEGRADED":
        answer_grade = "DEGRADED"
    elif missing_periods:
        answer_grade = "PARTIAL"
    else:
        answer_grade = "FULL"

    rd = retrieval_depth or {}
    email_r = dict(rd.get("email") or {})
    calendar_r = dict(rd.get("calendar") or {})
    custom_r = dict(rd.get("custom") or {})

    return {
        "retrieval_mode": retrieval_mode,
        "answer_grade": answer_grade,
        "report_grade_request": bool(report_grade_request),
        "grounded_report_ready": bool(grounded_report_ready),
        "has_connected_sources": bool(has_connected_sources),
        "live_signal_count": int(live_signal_count or 0),
        "coverage_start": (coverage_window or {}).get("coverage_start"),
        "coverage_end": (coverage_window or {}).get("coverage_end"),
        "missing_periods_count": len(missing_periods),
        "history_truncated": bool(rd.get("history_truncated")),
        "crm_pages_fetched": int(rd.get("crm_pages_fetched") or 0),
        "accounting_pages_fetched": int(rd.get("accounting_pages_fetched") or 0),
        "email_retrieval": email_r,
        "calendar_retrieval": calendar_r,
        "custom_retrieval": custom_r,
        "materialization_attempted": bool((materialization_state or {}).get("attempted")),
        "signals_emitted_on_demand": int((materialization_state or {}).get("signals_emitted") or 0),
    }


FORENSIC_REPORT_MODE_VERSION = "forensic_report_v1"
FORENSIC_CONFIDENCE_CEILING_BY_GRADE = {
    "FULL": 0.98,
    "PARTIAL": 0.72,
    "DEGRADED": 0.55,
    "BLOCKED": 0.35,
}


def _apply_forensic_confidence_cap(
    *,
    raw_confidence: float,
    answer_grade: str,
    report_grade_request: bool,
    grounded_report_ready: bool,
) -> float:
    grade = str(answer_grade or "DEGRADED").upper()
    cap = FORENSIC_CONFIDENCE_CEILING_BY_GRADE.get(grade, 0.55)
    if report_grade_request and not grounded_report_ready:
        cap = min(cap, FORENSIC_CONFIDENCE_CEILING_BY_GRADE["DEGRADED"])
    value = float(raw_confidence or 0.0)
    return round(max(0.0, min(value, cap)), 4)


def _build_forensic_report_payload(
    *,
    evidence_pack: Dict[str, Any],
    boardroom_trace: Optional[Dict[str, Any]],
    retrieval_contract: Dict[str, Any],
    report_grade_request: bool,
    grounded_report_ready: bool,
) -> Dict[str, Any]:
    refs = []
    for idx, source in enumerate((evidence_pack or {}).get("sources") or []):
        refs.append(
            {
                "ref": f"S{idx + 1}",
                "source": source.get("source"),
                "freshness": source.get("freshness"),
                "summary": source.get("summary"),
            }
        )
    contradictions = []
    challenge = ((boardroom_trace or {}).get("challenge") or {}).get("summary")
    if challenge:
        contradictions.append(
            {
                "from": "boardroom_challenge",
                "detail": str(challenge)[:700],
            }
        )
    degraded_reason = None
    if report_grade_request and not grounded_report_ready:
        degraded_reason = "report_grounding_blocked"
    elif str(retrieval_contract.get("answer_grade") or "").upper() in {"DEGRADED", "BLOCKED"}:
        degraded_reason = "degraded_answer_grade"
    return {
        "mode_active": bool(report_grade_request),
        "version": FORENSIC_REPORT_MODE_VERSION,
        "citations_enforced": bool(report_grade_request and grounded_report_ready),
        "citations": refs[:8],
        "contradictions": contradictions,
        "degraded_reason": degraded_reason,
    }


def _build_report_grounding_block(*, connected_sources: List[str], coverage_pct: float, coverage_window: Dict[str, Any], live_signal_count: int) -> str:
    connected_label = ", ".join(connected_sources) if connected_sources else "no connected systems"
    window_start = coverage_window.get("coverage_start") or "unknown"
    window_end = coverage_window.get("coverage_end") or "unknown"
    missing = coverage_window.get("missing_periods") or []
    missing_text = f" Gaps detected: {missing[0]}" if missing else ""
    return (
        "I can't truthfully generate a board report from live connector evidence yet. "
        f"Connected systems visible in this turn: {connected_label}. "
        f"Current grounded data window: {window_start} to {window_end}. "
        f"Live signals available: {live_signal_count}.{missing_text} "
        "I need report-grade facts from the connected systems before I can produce a defensible 12-month board pack."
    )


def _limit_to_executive_length(text: str, max_sentences: int = 6) -> str:
    draft = str(text or "").strip()
    if not draft:
        return draft
    parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", draft) if p.strip()]
    if len(parts) <= max_sentences:
        return draft
    return " ".join(parts[:max_sentences]).strip()


def _humanize_contract_response(
    text: str,
    slots: Dict[str, Any],
    *,
    mode: str = "normal",
    agent_id: str = "general",
    last_assistant_message: str = "",
) -> str:
    if not isinstance(slots, dict) or not slots.get("is_complete"):
        return text

    priority = str(slots.get("priority_now") or "").strip().rstrip(".")
    decision = str(slots.get("decision") or "").strip().rstrip(".")
    pathways = str(slots.get("pathways") or "").strip().rstrip(".")
    kpi_note = str(slots.get("kpi_note") or "").strip().rstrip(".")
    risk = str(slots.get("risk_if_delayed") or "").strip().rstrip(".")

    opening = _choose_human_opening(f"{priority}:{decision}:{mode}:{agent_id}")
    if last_assistant_message:
        previous_lead = re.split(r"(?<=[.!?])\s+", last_assistant_message.strip())[0].strip().lower()
        if previous_lead and previous_lead == opening.strip().lower():
            opening = "Here's the sharpest move right now."

    if agent_id == "boardroom":
        narrative = (
            f"{opening} {priority}. "
            f"Boardroom consensus is to {decision}. "
            f"We can move two ways: {pathways}. "
            f"For control, keep this KPI front and centre: {kpi_note}. "
            f"If we delay, {risk}."
        )
    else:
        narrative = (
            f"{opening} {priority}. "
            f"My recommendation is to {decision}. "
            f"You've got two practical options: {pathways}. "
            f"Keep one KPI in view this week: {kpi_note}. "
            f"If this waits, {risk}."
        )
    return _limit_to_executive_length(narrative, max_sentences=6)


def _build_specificity_fallback(*, profile: Dict[str, Any], top_concerns: List[Dict[str, Any]], coverage_pct: float, live_signal_count: int) -> str:
    business_name = (profile or {}).get("business_name") or "your business"
    industry = (profile or {}).get("industry") or "your industry"
    top = top_concerns[0] if top_concerns else {}
    issue = top.get("issue_brief") or top.get("decision_label") or "an unresolved priority in your operating system"
    action = top.get("action_brief") or top.get("recommendation") or "assign an owner and execute one containment action this week"
    risk = top.get("if_ignored_brief") or "the issue will compound into revenue timing and delivery pressure"
    freshness = top.get("data_freshness") or "unknown"
    source_count = top.get("data_sources_count") or 1

    return (
        f"Priority now: {issue} is the most material near-term operating risk for {business_name}.\n\n"
        f"Situation: For {business_name} in {industry}, BIQc has enough evidence to isolate one immediate decision area: {issue}. "
        f"Coverage is {coverage_pct}% with {live_signal_count} live signals in this cycle.\n\n"
        f"Decision: Execute this now — {action}.\n\n"
        "Pathways: A) Fast containment this week with one accountable owner. "
        "B) Structured recovery plan with a 14-day checkpoint.\n\n"
        f"This week: Assign one owner, lock a deadline, and review measurable movement within 48 hours. "
        f"Current evidence footprint: {source_count} source stream(s), freshness {freshness}.\n\n"
        "KPI note: Track one KPI tied to this issue this week. If KPI configuration is missing, set the baseline and owner now.\n\n"
        f"Risk if delayed: {risk}."
    )


def _build_boardroom_fallback(
    *,
    profile: Dict[str, Any],
    coverage_pct: float,
    live_signal_count: int,
    has_crm: bool,
    has_accounting: bool,
    has_email: bool,
) -> str:
    business_name = (profile or {}).get("business_name") or "your business"
    connected = [name for name, enabled in [("CRM", has_crm), ("Accounting", has_accounting), ("Email", has_email)] if enabled]
    connected_label = ", ".join(connected) if connected else "no live connectors yet"
    return (
        f"Priority now: tighten one operating decision this week for {business_name}, starting with the strongest available signal.\n\n"
        f"Decision: use boardroom triage despite limited telemetry — assign one accountable owner and set a 48-hour checkpoint.\n\n"
        f"Pathways: A) Fast boardroom containment using current context ({connected_label}). "
        "B) Full boardroom pass after connecting live systems for deeper diagnosis.\n\n"
        f"KPI note: with coverage at {coverage_pct}% and {live_signal_count} live signals, set a baseline KPI this week (owner + target + review date).\n\n"
        "Risk if delayed: low-visibility decisions drift, and small execution misses compound into cash and delivery pressure."
    )


def _soundboard_contract_meta(*, has_crm: bool, has_accounting: bool, has_email: bool, live_signal_count: int, live_signal_age_hours: Optional[float], coverage_pct: float, top_concerns: List[Dict[str, Any]]) -> Dict[str, Any]:
    data_sources_count = int(has_crm) + int(has_accounting) + int(has_email)
    if live_signal_count > 0:
        data_sources_count += 1
    if top_concerns:
        data_sources_count += 1

    freshness = "unknown"
    if live_signal_age_hours is not None:
        freshness = f"{int(round(live_signal_age_hours * 60))}m" if live_signal_age_hours < 1 else f"{int(round(live_signal_age_hours))}h"

    confidence = 0.28 + (0.12 * int(has_crm)) + (0.12 * int(has_accounting)) + (0.1 * int(has_email))
    confidence += 0.12 if live_signal_count > 0 else 0
    confidence += 0.16 * min(1.0, float(coverage_pct or 0) / 100.0)
    confidence = max(0.2, min(0.98, confidence))

    return {
        "confidence_score": round(confidence, 4),
        "data_sources_count": max(1, data_sources_count),
        "data_freshness": freshness,
        "lineage": {
            "engine": "soundboard_v3",
            "coverage_pct": coverage_pct,
            "live_signals_count": live_signal_count,
            "connected_sources": {
                "crm": has_crm,
                "accounting": has_accounting,
                "email": has_email,
            },
            "connected_sources_list": [
                source
                for source, enabled in (
                    ("crm", has_crm),
                    ("accounting", has_accounting),
                    ("email", has_email),
                    ("signals", live_signal_count > 0),
                )
                if enabled
            ],
            "top_concern_ids": [c.get("concern_id") for c in (top_concerns or []) if isinstance(c, dict)],
        },
    }


def _build_evidence_pack(
    *,
    profile: Dict[str, Any],
    has_crm: bool,
    has_accounting: bool,
    has_email: bool,
    live_signal_count: int,
    live_signal_age_hours: Optional[float],
    top_concerns: List[Dict[str, Any]],
    intent_domain: str,
    intent_action: str,
) -> Dict[str, Any]:
    has_recent_live_signals = bool(live_signal_count and live_signal_count > 0)
    connector_freshness = "live" if has_recent_live_signals else "connected"
    sources = []
    if profile:
        sources.append(
            {
                "id": "calibration",
                "source": "calibration",
                "freshness": "profile",
                "confidence": 0.82,
                "summary": "Business DNA profile and calibration context",
            }
        )
    if has_crm:
        sources.append(
            {
                "id": "crm",
                "source": "crm",
                "freshness": connector_freshness,
                "confidence": 0.88,
                "summary": "CRM pipeline and opportunity telemetry",
            }
        )
    if has_accounting:
        sources.append(
            {
                "id": "accounting",
                "source": "accounting",
                "freshness": connector_freshness,
                "confidence": 0.9,
                "summary": "Accounting invoices, cash timing, and revenue traces",
            }
        )
    if has_email:
        sources.append(
            {
                "id": "email",
                "source": "email",
                "freshness": connector_freshness,
                "confidence": 0.76,
                "summary": "Inbox/sent communication signal patterns",
            }
        )
    if live_signal_count > 0:
        age = "unknown"
        if live_signal_age_hours is not None:
            age = f"{int(round(live_signal_age_hours * 60))}m" if live_signal_age_hours < 1 else f"{int(round(live_signal_age_hours))}h"
        sources.append(
            {
                "id": "signals",
                "source": "platform_signals",
                "freshness": age,
                "confidence": 0.84,
                "summary": f"{live_signal_count} live signal events in current cycle",
            }
        )
    if top_concerns:
        concern = top_concerns[0] or {}
        sources.append(
            {
                "id": "brain",
                "source": "business_brain",
                "freshness": str(concern.get("data_freshness") or "unknown"),
                "confidence": 0.81,
                "summary": str(concern.get("issue_brief") or concern.get("decision_label") or "Top concern available"),
            }
        )

    return {
        "contract_version": CONTRACT_VERSION,
        "intent": {"domain": intent_domain, "action": intent_action},
        "source_count": len(sources),
        "sources": sources,
    }


# ─── Strategic Advisor System Prompt (Sprint 4 Enhanced) ───
_SOUNDBOARD_FALLBACK = """\
You are {user_first_name}'s BIQc Unified Intelligence Assistant — the world's most capable AI advisor for small and medium-sized businesses. You combine live integration data, strategic intelligence snapshots, and deep user calibration to deliver insights that are precise, actionable, and grounded in real business data.

══════════════════════════════════════════════════════════
IDENTITY & PURPOSE
══════════════════════════════════════════════════════════
You are not a generic chatbot. You are a former McKinsey engagement manager and data scientist who now operates as {user_first_name}'s dedicated intelligence layer. You think in frameworks, speak in plain language, and ALWAYS ground every sentence in the actual data you have been given.

Your purpose: deliver data-driven insights, proactive recommendations, workflow assistance, and any other relevant business intelligence — covering finance, sales, marketing, operations, HR, risk, planning, and beyond.

══════════════════════════════════════════════════════════
CONTEXT ASSEMBLY — RUN BEFORE EVERY RESPONSE
══════════════════════════════════════════════════════════
Before generating a response, mentally assemble and validate:
1. PERSONA — {user_first_name}'s calibrated communication style, risk posture, and decision approach
2. BUSINESS PROFILE — name, industry, target market, value proposition, team size, business model
3. CONNECTED INTEGRATIONS — for each integration, whether it is connected and whether fresh data is available
4. COGNITION SNAPSHOT — system state, risk scores, revenue signals, propagation map, cash forecasts, margin analysis, and AI context graphs from ic_generate_cognition_contract
5. OBSERVATION EVENTS — recent deals, invoices, marketing campaigns, customer interactions, operational tasks
6. CONVERSATION HISTORY — condensed summary of prior turns for continuity

If any source is missing or stale, note it ONCE clearly and avoid guessing.

══════════════════════════════════════════════════════════
INTENT CLASSIFICATION — ALWAYS CLASSIFY FIRST
══════════════════════════════════════════════════════════
Before answering, classify the user's intent:
DOMAIN: finance | sales | marketing | operations | HR | risk | planning | general
ACTION: summarise | forecast | create | update | compare | explain | recommend | diagnose

This classification determines the depth and structure of your response. Do not surface the classification to the user — use it internally to route your analysis.

══════════════════════════════════════════════════════════
NON-NEGOTIABLE GUARDRAILS
══════════════════════════════════════════════════════════
NO HALLUCINATIONS: Base answers solely on the data in context. If information is absent, say so clearly and suggest how to obtain it.

NO GENERIC ADVICE: Never give recommendations without tying them to {user_first_name}'s actual data. Delete any sentence that could apply to any business.

NO INVENTED NUMBERS: Quote specific numbers, names, dates, and statuses only if they appear in the data. Otherwise state the information is unavailable and why.

NATURAL TONE: Speak plainly and professionally, matching {user_first_name}'s calibrated style. Avoid robotic phrasing.

══════════════════════════════════════════════════════════
CONVERSATION & HUMAN CONNECTION
══════════════════════════════════════════════════════════
ACKNOWLEDGE: When the user asks a question or shares a concern, briefly reflect it back in your own words before answering (e.g. "You're asking about cash flow — here's what your numbers show." or "Makes sense to focus there."). Do not repeat their words verbatim; show you understood.

VARY OPENINGS: Do not start every reply with "Based on your..." or "According to the data...". Sometimes lead with the answer, a short affirmation, or a one-line takeaway. Examples: "Short answer: your pipeline is healthy, but three deals need a nudge." / "Good question." / "The main risk right now is concentration."

CONVERSATION CONTINUITY: If there is prior turn context, reference it when it helps (e.g. "Following on from the pipeline — " or "You mentioned X; here's how that ties in."). Do not force it; use only when it adds clarity.

ONE FOLLOW-UP: When it would genuinely help, end with one short, specific follow-up question or offer (e.g. "Want me to list the three overdue invoices by name?" or "Should we look at next month's forecast?"). Do not add generic "Let me know if you have questions."

COLLEAGUE TONE: Write like a trusted senior colleague: warm but efficient. No corporate filler, no "I'd be happy to assist." Prefer "I've got that" over "I understand." Use contractions. Keep sentences varied in length; mix short punchy lines with a longer one where needed.

DATA ATTRIBUTION: When citing a fact, state its source inline — e.g. "Your HubSpot pipeline shows...", "From your Xero invoices...", "Based on your calibration data...", "Your observation signals indicate...". Never state a fact without its source.

ERROR HANDLING: If data is missing, stale, or the required integration is disconnected, explain the issue and guide the resolution: "Please connect your accounting tool to retrieve cash flow data."

══════════════════════════════════════════════════════════
SYNTHESIS LAYERS — APPLY WHERE RELEVANT
══════════════════════════════════════════════════════════
MARGIN & PROFITABILITY: Combine revenue, cost-to-serve, and overhead from accounting data to identify the "toxic 20%" of products or customers destroying margin. Surface concentration risk if 3 or fewer clients represent >50% of revenue.

SUPPLY CHAIN & RESILIENCE: Merge inventory, supplier health, and external risk feeds to highlight single points of failure. Flag dependencies on sole suppliers.

TIME-TO-VALUE & OPERATIONAL VELOCITY: Cross-reference project management timestamps with customer success milestones to find bottlenecks. Calculate time-in-stage for stalled deals.

CASH DYNAMICS: Revenue + business model + outstanding invoices = cash flow pattern. Calculate trapped working capital and runway.

AGENTIC CONTEXT: Link SOPs, real-time signals, and customer sentiment to identify which autonomous actions BIQc can execute on {user_first_name}'s behalf.

══════════════════════════════════════════════════════════
RESPONSE STRUCTURE
══════════════════════════════════════════════════════════
For strategic responses, follow this structure in flowing prose (NOT headers or bullet points unless explicitly asked):

1. PRIORITY NOW: What matters most this week in this business.
2. DECISION: One clear, concrete recommendation with quantified impact where possible.
3. PATHWAYS: One or two practical ways forward with owner and timing.
4. KPI NOTE: One KPI to monitor next OR the KPI setup step if KPI data is missing.
5. RISK IF DELAYED: What happens if they don't act? Quantify where possible.
6. NEXT ACTIONS: Offer 1-2 proactive follow-ups BIQc can execute (e.g. "Would you like me to draft reminder emails to the 3 overdue clients?", "Shall I prepare a cash flow forecast based on your Xero data?").

For simple questions (greetings, quick lookups): respond concisely and warmly without the full structure. Match their energy — a "hey" gets a brief, friendly reply; a detailed question gets a structured answer.

══════════════════════════════════════════════════════════
SYNTHESIS EXAMPLES (MANDATORY STANDARD)
══════════════════════════════════════════════════════════
EXCELLENT: "You currently have 12 open deals in HubSpot worth $150,000 total (Source: HubSpot CRM); 6 are in the Proposal stage and 3 have been open longer than 30 days. Last month's cash-flow forecast from Xero shows a potential deficit due to 4 overdue invoices totalling $42,000. Since your risk score rose from 0.3 to 0.6 (Source: BIQc cognition engine), I recommend prioritising these overdue payments. Would you like me to draft reminder emails to those 4 clients?"

UNACCEPTABLE: "Your pipeline looks healthy." (vague, unsupported)
UNACCEPTABLE: "It is recommended to diversify your revenue streams." (generic, no data reference)
UNACCEPTABLE: "I don't have that information, but maybe your business needs to improve marketing." (guessing)

══════════════════════════════════════════════════════════
INTELLIGENCE FRAMEWORK (RUN INTERNALLY EVERY TIME)
══════════════════════════════════════════════════════════
REVENUE EFFICIENCY: Revenue / team size = revenue per employee. Compare to industry benchmark for {user_first_name}'s sector.
CUSTOMER CONCENTRATION: Customer count vs revenue. Flag if top 3 clients represent >50% of revenue.
GROWTH STAGE: Revenue range + team size = growth lifecycle position and typical challenges.
MARKET POSITION: Industry + location + UVP = competitive positioning risks and opportunities.
CASH DYNAMICS: Revenue + business model + AR aging = cash flow pattern and runway estimate.
RISK PROPAGATION: Reference the propagation map — if revenue risk is at >60%, trace its cascade to cash and operations.

══════════════════════════════════════════════════════════
BANNED PHRASES
══════════════════════════════════════════════════════════
"without direct data" / "absence of data" / "data is limited" / "consider looking into" / "it might be wise" / "you might want to" / "Let me know if you want to explore" / "To get more precise analysis" / "Here's what I suggest" (followed by a generic list) / "As an AI" / "I cannot provide financial advice" (you CAN reference their actual financial data)

══════════════════════════════════════════════════════════
CLOSE EVERY RESPONSE
══════════════════════════════════════════════════════════
End with the ONE thing {user_first_name} should do this week — specific, actionable, time-bound — and ONE proactive action BIQc can take on their behalf.\
"""


# ─── Multi-agent definitions (ChatGPT-style agent mode) ───
# Each agent has a persona block injected into the system prompt. "auto" = infer from intent.
SOUNDBOARD_AGENTS = {
    "auto": {
        "name": "BIQc Auto",
        "domain": None,
        "persona": "",
    },
    "general": {
        "name": "Strategic Advisor",
        "domain": "general",
        "persona": (
            "You are responding as the General Strategic Advisor. You cover the full business picture: "
            "priorities, trade-offs, and what to focus on next. Tie answers to the user's actual data and goals. "
            "If the question clearly fits a specialist (finance, sales, risk), you may say: "
            "'This is really a [X] question — switch to the [Finance/Sales/Risk] agent for the best answer,' but still give a concise answer."
        ),
    },
    "finance": {
        "name": "Finance Agent",
        "domain": "finance",
        "persona": (
            "You are responding as the Finance Agent. You focus on cash flow, revenue, margins, invoices, "
            "runway, and financial risk. Lead with numbers and dates from their data. "
            "Recommend one concrete financial action (e.g. chase overdue invoices, review burn). "
            "If the user asks about sales pipeline or marketing, briefly answer then suggest switching to the Sales or Marketing agent."
        ),
    },
    "sales": {
        "name": "Sales Agent",
        "domain": "sales",
        "persona": (
            "You are responding as the Sales Agent. You focus on pipeline, deals, leads, close rates, "
            "and CRM data. Reference specific deals, stages, and amounts. "
            "Recommend one concrete sales action (e.g. move stalled deals, follow up with a named prospect). "
            "If the question is about cash or marketing, briefly answer then suggest the Finance or Marketing agent."
        ),
    },
    "marketing": {
        "name": "Marketing Agent",
        "domain": "marketing",
        "persona": (
            "You are responding as the Marketing Agent. You focus on campaigns, channels, SEO, "
            "brand, and market positioning. Use their marketing and competitive data. "
            "Recommend one concrete marketing action. "
            "If the question is about revenue numbers or pipeline, suggest Finance or Sales agent where relevant."
        ),
    },
    "risk": {
        "name": "Risk Agent",
        "domain": "risk",
        "persona": (
            "You are responding as the Risk Agent. You focus on compliance, exposure, incidents, "
            "and operational/customer concentration risk. Use risk scores and propagation data. "
            "Recommend one concrete risk-mitigation action. "
            "If the question is purely financial or sales, suggest the Finance or Sales agent."
        ),
    },
    "operations": {
        "name": "Operations Agent",
        "domain": "operations",
        "persona": (
            "You are responding as the Operations Agent. You focus on workflow, delivery, capacity, "
            "SOPs, and process. Tie answers to their operational data and bottlenecks. "
            "Recommend one concrete ops action. Suggest other agents when the question is clearly finance or sales."
        ),
    },
    "strategy": {
        "name": "Strategy Agent",
        "domain": "planning",
        "persona": (
            "You are responding as the Strategy Agent. You focus on planning, scenarios, forecasts, "
            "and medium-term priorities. Use their goals, challenges, and intelligence snapshot. "
            "Recommend one strategic move for this quarter. Hand off to Finance/Sales/Risk for tactical detail when needed."
        ),
    },
    "boardroom": {
        "name": "Boardroom Council",
        "domain": "general",
        "persona": (
            "You are responding as the Boardroom Council: CEO, CFO, COO, CTO, HR, and CCO speaking as one coordinated team. "
            "Each answer must synthesize cross-functional viewpoints using available integrations and evidence. "
            "Prioritize the most decision-critical data for THIS specific user question, not generic dashboards. "
            "When relevant, show a short 'Boardroom Priority Stack' with 3-5 ranked signals and why each matters now. "
            "If data is missing, explicitly identify which integration/source would close the gap fastest."
        ),
    },
}


def _get_agent_persona(agent_id: Optional[str], intent_domain: str) -> str:
    """Resolve agent persona: explicit agent_id or infer from intent when agent_id is 'auto'."""
    if agent_id and agent_id != "auto":
        agent = SOUNDBOARD_AGENTS.get(agent_id) or SOUNDBOARD_AGENTS["general"]
        return agent.get("persona", "") or ""
    agent = SOUNDBOARD_AGENTS.get(intent_domain) or SOUNDBOARD_AGENTS["general"]
    return agent.get("persona", "") or ""


class SoundboardChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    intelligence_context: Optional[Dict[str, Any]] = None
    mode: Optional[str] = "auto"
    agent_id: Optional[str] = "auto"
    forensic_report_mode: Optional[bool] = None


def _has_configured_key(value: Optional[str]) -> bool:
    return bool(value and str(value).strip() and str(value).strip() not in {"CONFIGURED_IN_AZURE", "None", "null"})


def _infer_intent_heuristic(message: str) -> tuple[str, str, str]:
    text = (message or "").lower()
    domain = "general"
    mailbox_requested = any(word in text for word in ("inbox", "sent items", "sent", "deleted", "trash"))
    integration_analytics_requested = (
        "merge" in text
        or ("integration" in text and any(word in text for word in ("analytics", "analysis", "insight", "trend", "breakdown", "compare")))
        or "cross-integration" in text
    )
    if any(word in text for word in ("invoice", "cash", "margin", "profit", "revenue", "xero", "budget", "burn")):
        domain = "finance"
    elif any(word in text for word in ("deal", "pipeline", "lead", "hubspot", "close rate", "prospect")):
        domain = "sales"
    elif any(word in text for word in ("campaign", "seo", "ads", "social", "brand", "linkedin", "market")):
        domain = "marketing"
    elif any(word in text for word in ("risk", "compliance", "incident", "exposure", "audit")):
        domain = "risk"
    elif any(word in text for word in ("ops", "process", "workflow", "delivery", "capacity", "sop")):
        domain = "operations"
    elif any(word in text for word in ("team", "staff", "hiring", "people", "culture", "workforce")):
        domain = "hr"
    elif any(word in text for word in ("plan", "strategy", "forecast", "next quarter", "scenario")):
        domain = "planning"
    elif mailbox_requested:
        domain = "operations"
    elif integration_analytics_requested:
        domain = "planning"

    action = "recommend"
    if any(word in text for word in ("forecast", "predict", "runway", "projection")):
        action = "forecast"
    elif any(word in text for word in ("create", "write", "draft", "generate")):
        action = "create"
    elif any(word in text for word in ("update", "change", "revise")):
        action = "update"
    elif any(word in text for word in ("compare", "versus", "vs", "benchmark")):
        action = "compare"
    elif any(word in text for word in ("why", "explain", "what happened")):
        action = "explain"
    elif any(word in text for word in ("diagnose", "debug", "issue", "problem", "stuck")):
        action = "diagnose"
    elif any(word in text for word in ("summarise", "summarize", "recap")):
        action = "summarise"
    if mailbox_requested and action == "recommend":
        action = "diagnose"
    if integration_analytics_requested and action == "recommend":
        action = "compare"

    complexity = "medium"
    if len(text) < 50 or any(word in text for word in ("hi", "hello", "thanks", "invoice?", "quick")):
        complexity = "low"
    if len(text) > 220 or any(word in text for word in ("forecast", "scenario", "diagnose", "root cause", "board", "strategy")):
        complexity = "high"

    return domain, action, complexity


def _coerce_request_scope(req: SoundboardChatRequest, message: str) -> Dict[str, Any]:
    text = (message or "").lower()
    intelligence_ctx = req.intelligence_context or {}
    raw_scope = intelligence_ctx.get("request_scope") if isinstance(intelligence_ctx, dict) else {}
    mailbox_raw = raw_scope.get("mailbox_scope") if isinstance(raw_scope, dict) else {}
    mailbox_scope = {
        "inbox": bool((mailbox_raw or {}).get("inbox")) or "inbox" in text,
        "sent": bool((mailbox_raw or {}).get("sent")) or "sent items" in text or " sent " in f" {text} ",
        "deleted": bool((mailbox_raw or {}).get("deleted")) or "deleted" in text or "trash" in text,
    }
    wants_integration_analytics = bool((raw_scope or {}).get("wants_integration_analytics"))
    if not wants_integration_analytics:
        wants_integration_analytics = (
            "merge" in text
            or "cross-integration" in text
            or ("integration" in text and any(token in text for token in ("analytics", "analysis", "insight", "trend", "breakdown", "compare")))
        )
    return {
        "mailbox_scope": mailbox_scope,
        "wants_integration_analytics": wants_integration_analytics,
    }


def _effective_agent_key(agent_id: Optional[str], intent_domain: str) -> str:
    if agent_id and agent_id != "auto":
        return str(agent_id).lower().strip()
    return str(intent_domain or "general").lower().strip()


def _build_role_policy_guardrails(agent_id: Optional[str], intent_domain: str) -> str:
    agent_key = _effective_agent_key(agent_id, intent_domain)
    if agent_key == "finance":
        return (
            "[ROLE POLICY — CFO STRICTNESS]\n"
            "- Use numeric evidence first; do not round away material variance.\n"
            "- Mark assumptions explicitly as assumptions.\n"
            "- Do not provide legal advice; handoff legal interpretations to Risk/Legal.\n"
        )
    if agent_key in {"risk", "compliance"}:
        return (
            "[ROLE POLICY — RISK / LEGAL BOUNDARY]\n"
            "- Keep compliance guidance factual and control-oriented.\n"
            "- Do not provide definitive legal counsel language.\n"
            "- State when external legal review is required before action.\n"
        )
    if agent_key in {"strategy", "planning", "boardroom", "general"}:
        return (
            "[ROLE POLICY — CEO/BOARDROOM ABSTRACTION]\n"
            "- Keep strategic framing concise and decision-oriented.\n"
            "- Link each recommendation to measurable business outcomes.\n"
            "- Avoid over-technical implementation detail unless requested.\n"
        )
    return ""


def _is_incident_or_compliance_query(intent_domain: str, intent_action: str, message: str) -> bool:
    text = f"{intent_domain} {intent_action} {message}".lower()
    triggers = (
        "incident",
        "breach",
        "outage",
        "security",
        "compliance",
        "audit",
        "regulatory",
        "legal",
        "risk",
    )
    return any(t in text for t in triggers)


def _has_explicit_capability_gap_request(message: str) -> bool:
    text = (message or "").lower()
    patterns = (
        "upgrade",
        "tier",
        "plan",
        "pricing",
        "why can't",
        "why can’t",
        "feature limit",
        "capability gap",
        "connect integration",
        "missing integration",
    )
    return any(p in text for p in patterns)


def _enforce_conversion_guardrails(response: str, *, allow_upsell: bool) -> str:
    if not isinstance(response, str) or not response.strip():
        return response
    if allow_upsell:
        return response
    blocked_terms = (
        "upgrade",
        "plan",
        "tier",
        "subscription",
        "more features",
        "unlock",
        "biqc foundation",
        "paywall",
    )
    kept_lines: List[str] = []
    for line in response.splitlines():
        lower = line.lower()
        if any(term in lower for term in blocked_terms):
            continue
        kept_lines.append(line)
    sanitized = "\n".join(kept_lines).strip()
    return sanitized or response


def _sse_event(event_type: str, payload: Dict[str, Any]) -> str:
    body = {"type": event_type, **payload}
    return f"data: {json.dumps(body, ensure_ascii=False)}\n\n"


def _resolve_model_route(mode: str, intent_domain: str, intent_action: str, complexity: str, has_openai: bool, has_google: bool) -> tuple[str, List[str], str, str]:
    if not has_openai and not has_google:
        raise RuntimeError("AI provider keys are not configured. Add a valid OPENAI_API_KEY and/or GOOGLE_API_KEY in the backend environment to restore Soundboard replies.")

    mode = (mode or "auto").lower()
    openai_pro = ["gpt-5.4-pro", "gpt-5.2", "o3-pro", "gpt-4o"]
    openai_thinking = ["gpt-5.4", "gpt-5.2", "o3", "gpt-4o"]
    openai_fast = ["gpt-5.3", "gpt-5.2", "gpt-4o-mini", "gpt-4o"]
    gemini_pro = ["gemini-3-pro-preview", "gemini-2.5-pro", "gemini-2.0-flash"]
    gemini_fast = ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.0-flash"]

    if mode == "normal":
        if has_openai:
            return "openai", openai_fast, "Normal", "User-selected normal mode (GPT-5.3 fast path)"
        return "gemini", gemini_fast, "Normal", "User-selected normal mode routed to Gemini fallback"

    if mode == "thinking":
        return "openai", openai_thinking if has_openai else gemini_pro, "Pro Thinking", "User-selected deep reasoning mode"
    if mode == "pro":
        if has_google:
            return "gemini", gemini_pro, "Pro", "User-selected long-context analysis mode"
        return "openai", openai_pro, "Pro", "User-selected pro mode routed to OpenAI fallback"
    if mode == "fast":
        if has_google:
            return "gemini", gemini_fast, "Fast", "User-selected fast mode"
        return "openai", openai_fast, "Fast", "User-selected fast mode routed to OpenAI fallback"

    if intent_domain in ("finance", "risk", "planning") or intent_action in ("forecast", "diagnose") or complexity == "high":
        if has_openai:
            return "openai", openai_pro, "Pro Thinking", "Deep reasoning — financial/risk/strategic analysis"
        return "gemini", gemini_pro, "Pro", "Deep reasoning routed to Gemini due to OpenAI availability"

    if intent_domain == "marketing" and complexity != "low":
        if has_google:
            return "gemini", gemini_pro, "Pro", "Market intelligence & competitive research"
        return "openai", openai_fast, "Fast", "Marketing query routed to OpenAI fallback"

    if intent_domain in ("sales", "operations", "hr") or intent_action in ("create", "update"):
        if has_openai:
            return "openai", openai_fast, "Instant", "Fast structured response for operational query"
        return "gemini", gemini_fast, "Fast", "Operational query routed to Gemini fallback"

    if has_google and (complexity == "low" or intent_domain == "general"):
        return "gemini", gemini_fast, "Fast", "Quick query — Gemini Flash"
    if has_openai:
        return "openai", openai_fast, "Instant", "General query — OpenAI fast path"
    return "gemini", gemini_pro, "Pro", "Fallback to available Gemini provider"


def _is_auth_error(error_text: str) -> bool:
    text = error_text.lower()
    return any(token in text for token in (
        "incorrect api key", "invalid api key", "authentication", "unauthorized", "401", "permission denied", "api key not valid"
    ))


def _is_model_error(error_text: str) -> bool:
    text = error_text.lower()
    return any(token in text for token in (
        "model", "not found", "does not exist", "unsupported", "not available", "access", "permission", "404"
    ))


async def _call_openai_with_fallback(api_key: str, system_message: str, clean_message: str, messages_history: List[Dict[str, Any]], model_candidates: List[str], reasoning: bool = False) -> tuple[str, str]:
    import openai as _openai

    if not _has_configured_key(api_key):
        raise RuntimeError("OPENAI_API_KEY is not configured. Add a valid OpenAI key to restore Soundboard replies.")

    client = _openai.AsyncOpenAI(api_key=api_key)
    formatted_messages = [{"role": "system", "content": system_message}]
    for message in (messages_history or [])[-SOUNDBOARD_CONTEXT_MESSAGES_LIMIT:]:
        formatted_messages.append({"role": message.get("role", "user"), "content": message.get("content", "")})
    formatted_messages.append({"role": "user", "content": clean_message})

    last_error = None
    for candidate in model_candidates:
        try:
            request_kwargs = {
                "model": candidate,
                "messages": formatted_messages,
                "max_tokens": 2000,
            }
            if not any(candidate.startswith(prefix) for prefix in ("gpt-5", "o3", "o4")):
                request_kwargs["temperature"] = 0.7
            if reasoning and any(candidate.startswith(prefix) for prefix in ("gpt-5", "o3", "o4")):
                request_kwargs["reasoning_effort"] = "high"

            completion = await client.chat.completions.create(**request_kwargs)
            reply = completion.choices[0].message.content or ""
            if reply:
                return reply, candidate
            last_error = RuntimeError(f"OpenAI returned an empty response for {candidate}")
        except Exception as exc:
            last_error = exc
            error_text = str(exc)
            if _is_auth_error(error_text):
                raise RuntimeError("OpenAI rejected the configured API key. Please verify OPENAI_API_KEY in the backend environment.") from exc
            if _is_model_error(error_text):
                logger.warning(f"[SOUNDBOARD] OpenAI model fallback from {candidate}: {exc}")
                continue
            logger.warning(f"[SOUNDBOARD] OpenAI attempt failed for {candidate}: {exc}")
            continue

    raise RuntimeError(f"OpenAI chat failed across fallback models: {last_error}")


async def _call_gemini_with_fallback(api_key: str, system_message: str, clean_message: str, messages_history: List[Dict[str, Any]], model_candidates: List[str]) -> tuple[str, str]:
    import httpx as _httpx

    if not _has_configured_key(api_key):
        raise RuntimeError("GOOGLE_API_KEY is not configured. Add a valid Google AI key to restore Gemini-powered Soundboard replies.")

    last_error = None
    history_block = _format_history_for_prompt(messages_history, limit=SOUNDBOARD_CONTEXT_MESSAGES_LIMIT)
    prompt_text = f"{system_message}\n\n"
    if history_block:
        prompt_text += f"[RECENT CONVERSATION]\n{history_block}\n\n"
    prompt_text += f"[CURRENT USER MESSAGE]\n{clean_message}"
    async with _httpx.AsyncClient(timeout=30) as client:
        for candidate in model_candidates:
            try:
                gemini_model = candidate.replace("-preview", "")
                response = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent",
                    params={"key": api_key},
                    json={
                        "contents": [{"parts": [{"text": prompt_text}]}],
                        "generationConfig": {"maxOutputTokens": 2000, "temperature": 0.7},
                    },
                )
                if response.status_code == 200:
                    payload = response.json()
                    reply = payload.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    if reply:
                        return reply, candidate
                    last_error = RuntimeError(f"Gemini returned an empty response for {candidate}")
                    continue

                error_text = response.text
                last_error = RuntimeError(f"Gemini {candidate} failed with {response.status_code}: {error_text[:500]}")
                if response.status_code in (401, 403) or _is_auth_error(error_text):
                    raise RuntimeError("Google AI rejected the configured API key. Please verify GOOGLE_API_KEY in the backend environment.")
                if response.status_code in (400, 404) and _is_model_error(error_text):
                    logger.warning(f"[SOUNDBOARD] Gemini model fallback from {candidate}: {error_text[:200]}")
                    continue
                logger.warning(f"[SOUNDBOARD] Gemini attempt failed for {candidate}: {error_text[:200]}")
            except Exception as exc:
                last_error = exc
                error_text = str(exc)
                if _is_auth_error(error_text):
                    raise RuntimeError("Google AI rejected the configured API key. Please verify GOOGLE_API_KEY in the backend environment.") from exc
                if _is_model_error(error_text):
                    logger.warning(f"[SOUNDBOARD] Gemini model fallback from {candidate}: {exc}")
                    continue
                logger.warning(f"[SOUNDBOARD] Gemini attempt failed for {candidate}: {exc}")
                continue

    raise RuntimeError(f"Gemini chat failed across fallback models: {last_error}")


async def _call_anthropic_with_fallback(api_key: str, system_message: str, clean_message: str, messages_history: List[Dict[str, Any]], model_candidates: List[str]) -> tuple[str, str]:
    import httpx as _httpx

    if not _has_configured_key(api_key):
        raise RuntimeError("ANTHROPIC_API_KEY is not configured. Add a valid Anthropic key to enable Trinity reasoning.")

    history_block = _format_history_for_prompt(messages_history, limit=SOUNDBOARD_CONTEXT_MESSAGES_LIMIT)
    user_content = clean_message if not history_block else f"[RECENT CONVERSATION]\n{history_block}\n\n[CURRENT USER MESSAGE]\n{clean_message}"
    payload_base = {
        "temperature": 0.45,
        "max_tokens": 1800,
        "system": system_message,
        "messages": [{"role": "user", "content": user_content}],
    }

    last_error = ""
    for model in model_candidates:
        try:
            async with _httpx.AsyncClient(timeout=70.0) as client:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={**payload_base, "model": model},
                )
                resp.raise_for_status()
                data = resp.json()
                content = data.get("content") or []
                text = content[0].get("text", "") if content and isinstance(content[0], dict) else ""
                if text and text.strip():
                    return text.strip(), model
        except Exception as e:
            msg = str(e)
            last_error = msg
            logger.warning(f"Anthropic model '{model}' failed: {msg}")
            if _is_auth_error(msg):
                break
            continue

    raise RuntimeError(f"Anthropic chat failed across fallback models: {last_error}")


def _truncate_for_synthesis(text: str, max_chars: int = 2400) -> str:
    t = (text or "").strip()
    if len(t) <= max_chars:
        return t
    return t[:max_chars] + "\n\n[...truncated for synthesis]"


async def _call_trinity_orchestration(
    *,
    openai_key: str,
    google_key: str,
    anthropic_key: str,
    system_message: str,
    clean_message: str,
    messages_history: List[Dict[str, Any]],
) -> tuple[str, str]:
    has_openai = _has_configured_key(openai_key)
    has_google = _has_configured_key(google_key)
    has_anthropic = _has_configured_key(anthropic_key)
    if not has_openai and not has_google and not has_anthropic:
        raise RuntimeError("Trinity mode requires at least one configured provider key (OPENAI_API_KEY, GOOGLE_API_KEY, or ANTHROPIC_API_KEY).")

    parallel_tasks = []

    if has_openai:
        parallel_tasks.append(_call_openai_with_fallback(
            api_key=openai_key,
            system_message=system_message,
            clean_message=clean_message,
            messages_history=messages_history,
            model_candidates=["gpt-5.4", "gpt-5.3", "gpt-5.2"],
            reasoning=True,
        ))
        parallel_tasks.append(_call_openai_with_fallback(
            api_key=openai_key,
            system_message=system_message,
            clean_message=clean_message,
            messages_history=messages_history,
            model_candidates=["codex-5.3", "gpt-5.3", "gpt-5.2"],
            reasoning=False,
        ))

    if has_google:
        parallel_tasks.append(_call_gemini_with_fallback(
            api_key=google_key,
            system_message=system_message,
            clean_message=clean_message,
            messages_history=messages_history,
            model_candidates=["gemini-3-pro-preview", "gemini-2.5-pro", "gemini-2.0-flash"],
        ))

    if has_anthropic:
        parallel_tasks.append(_call_anthropic_with_fallback(
            api_key=anthropic_key,
            system_message=system_message,
            clean_message=clean_message,
            messages_history=messages_history,
            model_candidates=["claude-opus-4-6", "claude-sonnet-4-6", "claude-sonnet-4-5"],
        ))

    results = await asyncio.gather(*parallel_tasks, return_exceptions=True)

    model_outputs = []
    for result in results:
        if isinstance(result, Exception):
            continue
        text, model = result
        if text:
            model_outputs.append({"model": model, "text": text})

    if not model_outputs:
        raise RuntimeError("Trinity mode failed across GPT-5.4, Codex-5.3, and Gemini Pro candidates.")

    if len(model_outputs) == 1:
        only = model_outputs[0]
        return only["text"], f"trinity-degraded/{only['model']}"

    fusion_prompt = "\n\n".join(
        [f"[{m['model']}]\n{_truncate_for_synthesis(m['text'])}" for m in model_outputs]
    )
    synthesis_system = (
        "You are BIQc Trinity Fusion. Merge multi-model analyses into one operator-grade answer. "
        "Output must be concise, factual, and action-first. Include:\n"
        "1) Core diagnosis\n2) Why now\n3) Immediate action (48h)\n4) If ignored\n"
        "Do NOT mention model names or that multiple models were used."
    )
    synthesis_user = f"User query:\n{clean_message}\n\nCandidate analyses:\n{fusion_prompt}"

    if has_openai:
        fused, fused_model = await _call_openai_with_fallback(
            api_key=openai_key,
            system_message=synthesis_system,
            clean_message=synthesis_user,
            messages_history=[],
            model_candidates=["gpt-5.3", "gpt-5.2", "gpt-4o"],
            reasoning=False,
        )
        return fused, f"trinity/{fused_model}"

    fused, fused_model = await _call_gemini_with_fallback(
        api_key=google_key,
        system_message=synthesis_system,
        clean_message=synthesis_user,
        model_candidates=["gemini-3-pro-preview", "gemini-2.5-pro", "gemini-2.0-flash"],
    )
    return fused, f"trinity/{fused_model}"


async def _run_boardroom_orchestration(
    *,
    openai_key: str,
    google_key: str,
    anthropic_key: str,
    clean_message: str,
    system_message: str,
    messages_history: List[Dict[str, Any]],
) -> tuple[str, str, Dict[str, Any]]:
    """Boardroom multi-agent cycle: delegate -> challenge -> consensus."""
    personas = [
        ("ceo", "Chief Executive Officer: strategic direction and opportunity cost"),
        ("cfo", "Chief Financial Officer: cash conversion, margin, and risk-weighted economics"),
        ("coo", "Chief Operating Officer: execution bottlenecks and owner accountability"),
        ("cmo", "Chief Marketing Officer: demand quality, pipeline velocity, market narrative"),
    ]
    deliberations: List[Dict[str, str]] = []
    phase_trace = []

    # Delegation phase
    for role_key, role_desc in personas:
        role_system = (
            f"{system_message}\n\n"
            f"[BOARDROOM ROLE]\n{role_desc}\n"
            "Return exactly three sections:\n"
            "1) strongest_signal\n2) contradiction\n3) 48h_action."
        )
        try:
            if _has_configured_key(openai_key):
                role_text, role_model = await _call_openai_with_fallback(
                    api_key=openai_key,
                    system_message=role_system,
                    clean_message=clean_message,
                    messages_history=messages_history[-SOUNDBOARD_BOARDROOM_CONTEXT_LIMIT:],
                    model_candidates=["gpt-5.3", "gpt-5.2", "gpt-4o"],
                    reasoning=True,
                )
            elif _has_configured_key(anthropic_key):
                role_text, role_model = await _call_anthropic_with_fallback(
                    api_key=anthropic_key,
                    system_message=role_system,
                    clean_message=clean_message,
                    messages_history=messages_history[-SOUNDBOARD_BOARDROOM_CONTEXT_LIMIT:],
                    model_candidates=["claude-opus-4-6", "claude-sonnet-4-6", "claude-sonnet-4-5"],
                )
            else:
                role_text, role_model = await _call_gemini_with_fallback(
                    api_key=google_key,
                    system_message=role_system,
                    clean_message=clean_message,
                    messages_history=messages_history[-SOUNDBOARD_BOARDROOM_CONTEXT_LIMIT:],
                    model_candidates=["gemini-3-pro-preview", "gemini-2.5-pro", "gemini-2.0-flash"],
                )
            deliberations.append({"role": role_key, "analysis": role_text, "model": role_model})
            phase_trace.append({"phase": "delegate", "role": role_key, "status": "ok"})
        except Exception as exc:
            phase_trace.append({"phase": "delegate", "role": role_key, "status": "error", "detail": str(exc)[:180]})

    if not deliberations:
        raise RuntimeError("Boardroom delegation failed across all council roles.")

    challenge_prompt = "\n\n".join(
        [f"[{item['role'].upper()}]\n{_truncate_for_synthesis(item['analysis'], 900)}" for item in deliberations]
    )
    challenge_system = (
        "You are BIQc Contradiction Chair. Detect conflicts across council analyses and return:\n"
        "1) non_negotiables\n2) contradictions\n3) highest_leverage_decision."
    )
    if _has_configured_key(openai_key):
        challenge_text, challenge_model = await _call_openai_with_fallback(
            api_key=openai_key,
            system_message=challenge_system,
            clean_message=challenge_prompt,
            messages_history=[],
            model_candidates=["gpt-5.3", "gpt-5.2", "gpt-4o"],
            reasoning=True,
        )
    elif _has_configured_key(anthropic_key):
        challenge_text, challenge_model = await _call_anthropic_with_fallback(
            api_key=anthropic_key,
            system_message=challenge_system,
            clean_message=challenge_prompt,
            messages_history=[],
            model_candidates=["claude-opus-4-6", "claude-sonnet-4-6", "claude-sonnet-4-5"],
        )
    else:
        challenge_text, challenge_model = await _call_gemini_with_fallback(
            api_key=google_key,
            system_message=challenge_system,
            clean_message=challenge_prompt,
            messages_history=[],
            model_candidates=["gemini-3-pro-preview", "gemini-2.5-pro", "gemini-2.0-flash"],
        )
    phase_trace.append({"phase": "challenge", "status": "ok", "model": challenge_model})

    consensus_system = (
        "You are BIQc Boardroom Consensus Synthesizer.\n"
        "Output format:\n"
        "Priority now:\nDecision:\nPathways:\nKPI note:\nRisk if delayed:\nEvidence lines:"
    )
    consensus_input = (
        f"User request:\n{clean_message}\n\n"
        f"Council deliberations:\n{challenge_prompt}\n\n"
        f"Contradiction chair output:\n{challenge_text}"
    )
    if _has_configured_key(openai_key):
        final_text, final_model = await _call_openai_with_fallback(
            api_key=openai_key,
            system_message=consensus_system,
            clean_message=consensus_input,
            messages_history=[],
            model_candidates=["gpt-5.3", "gpt-5.2", "gpt-4o"],
            reasoning=True,
        )
    elif _has_configured_key(anthropic_key):
        final_text, final_model = await _call_anthropic_with_fallback(
            api_key=anthropic_key,
            system_message=consensus_system,
            clean_message=consensus_input,
            model_candidates=["claude-opus-4-6", "claude-sonnet-4-6", "claude-sonnet-4-5"],
        )
    else:
        final_text, final_model = await _call_gemini_with_fallback(
            api_key=google_key,
            system_message=consensus_system,
            clean_message=consensus_input,
            model_candidates=["gemini-3-pro-preview", "gemini-2.5-pro", "gemini-2.0-flash"],
        )
    phase_trace.append({"phase": "consensus", "status": "ok", "model": final_model})
    trace = {
        "contract_version": CONTRACT_VERSION,
        "council_size": len(deliberations),
        "deliberations": deliberations,
        "challenge": {"model": challenge_model, "summary": challenge_text[:900]},
        "phases": phase_trace,
    }
    return final_text, f"boardroom/{final_model}", trace


class ConversationRename(BaseModel):
    title: str


@router.get("/soundboard/conversations")
async def get_soundboard_conversations(current_user: dict = Depends(get_current_user)):
    sb = get_sb()
    result = sb.table("soundboard_conversations").select("*").eq(
        "user_id", current_user["id"]
    ).order("updated_at", desc=True).limit(50).execute()
    return {"conversations": result.data or []}


@router.get("/soundboard/conversations/{conversation_id}")
async def get_soundboard_conversation_detail(conversation_id: str, current_user: dict = Depends(get_current_user)):
    sb = get_sb()
    result = sb.table("soundboard_conversations").select("*").eq(
        "id", conversation_id
    ).eq("user_id", current_user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conversation = result.data[0]
    try:
        messages_result = sb.table("soundboard_messages").select(
            "role, content, timestamp"
        ).eq("conversation_id", conversation_id).eq("user_id", current_user["id"]).order("timestamp", desc=False).execute()
        messages = messages_result.data or []
    except Exception:
        # Backward compatibility for deployments storing messages in conversation JSON column.
        messages = conversation.get("messages", [])
    return {"conversation": conversation, "messages": messages}


@router.post("/soundboard/chat")
async def soundboard_chat(req: SoundboardChatRequest, current_user: dict = Depends(get_current_user)):
    """Chat with MySoundBoard — Uses Cognitive Core + Global Fact Authority + DB Prompts"""
    from routes.deps import cognitive_core
    sb = get_sb()
    user_id = current_user["id"]

    # Resolve facts
    resolved_facts = await resolve_facts(sb, user_id)
    facts_prompt = build_known_facts_prompt(resolved_facts)

    # Get or create conversation
    conversation = None
    if req.conversation_id:
        result = sb.table("soundboard_conversations").select("*").eq(
            "id", req.conversation_id
        ).eq("user_id", user_id).execute()
        if result.data:
            conversation = result.data[0]

    messages_history = []
    if conversation:
        try:
            history_result = sb.table("soundboard_messages").select(
                "role, content, timestamp"
            ).eq("conversation_id", conversation["id"]).eq("user_id", user_id).order("timestamp", desc=True).limit(SOUNDBOARD_HISTORY_LIMIT).execute()
            history_rows = list(reversed(history_result.data or []))
            messages_history = [{"role": row.get("role"), "content": row.get("content")} for row in history_rows]
        except Exception:
            # Backward compatibility when soundboard_messages table is unavailable.
            messages_history = (conversation.get("messages", [])[-SOUNDBOARD_HISTORY_LIMIT:]) if isinstance(conversation.get("messages"), list) else []

    # Cognitive Core context
    core_context = await cognitive_core.get_context_for_agent(user_id, "MySoundboard")
    await cognitive_core.observe(user_id, {
        "type": "message", "content": req.message,
        "agent": "MySoundboard", "topics": [], "is_repeated_concern": False
    })
    now_dt = datetime.now(timezone.utc)
    await cognitive_core.observe(user_id, {
        "type": "timing", "hour": now_dt.hour,
        "day": now_dt.strftime("%A"), "engagement": "high"
    })

    cognitive_context = _build_cognitive_context(req, core_context)

    # User info — extract first name
    user_profile = await get_user_by_id(user_id)
    profile = await get_business_profile_supabase(sb, user_id)
    full_name = (user_profile.get("full_name") if user_profile else None) or "there"
    user_first_name = full_name.split()[0] if full_name and full_name != "there" else "there"
    user_email = (user_profile.get("email") if user_profile else None) or ""

    # ═══ COVERAGE-BASED GUARDRAIL ═══
    from data_coverage import calculate_coverage
    try:
        int_result = sb.table("integration_accounts").select("category").eq("user_id", user_id).execute()
        has_crm = any(r.get("category") == "crm" for r in (int_result.data or []))
        has_accounting = any(r.get("category") == "accounting" for r in (int_result.data or []))
        email_res = sb.table("email_connections").select("id").eq("user_id", user_id).limit(1).execute()
        has_email = bool(email_res.data)
    except Exception:
        has_crm = has_accounting = has_email = False

    coverage = calculate_coverage(
        profile=profile or {},
        has_crm=has_crm,
        has_accounting=has_accounting,
        has_email=has_email,
    )
    coverage_pct = coverage["coverage_pct"]
    guardrail_status = coverage["guardrail_status"]
    missing_fields = coverage["missing_fields"]
    missing_critical = coverage["missing_critical"]
    request_looks_report_grade = _is_report_grade_request(str(req.message or ""))

    # Keep legacy context_fields for logging compatibility
    context_fields = sum(1 for f in ['business_name', 'industry', 'revenue_range', 'team_size', 'main_challenges', 'short_term_goals'] if profile and profile.get(f) and str(profile.get(f)) not in ('None', ''))

    # Live signal freshness check
    live_signal_count, live_signal_age_hours = _fetch_observation_signal_state(sb, user_id)
    materialization_state: Dict[str, Any] = {"attempted": False, "signals_emitted": 0}
    if live_signal_count == 0 and (request_looks_report_grade or has_crm or has_accounting or has_email):
        materialization_state = await _attempt_soundboard_signal_materialization(sb, user_id)
        if materialization_state.get("signals_emitted", 0) > 0:
            live_signal_count, live_signal_age_hours = _fetch_observation_signal_state(sb, user_id)

    logger.info(f"[GUARDRAIL] user={user_id[:8]} coverage={coverage_pct}% status={guardrail_status} critical_missing={len(missing_critical)}")

    top_brain_concerns: List[Dict[str, Any]] = []
    try:
        concern_res = (
            sb.schema("business_core")
            .table("brain_evaluations")
            .select("concern_id,priority_score,recommendation,issue_brief,why_now_brief,action_brief,if_ignored_brief,data_sources_count,data_freshness")
            .eq("tenant_id", user_id)
            .order("evaluated_at", desc=True)
            .limit(3)
            .execute()
        )
        top_brain_concerns = concern_res.data or []
    except Exception:
        top_brain_concerns = []

    contract_meta = _soundboard_contract_meta(
        has_crm=has_crm,
        has_accounting=has_accounting,
        has_email=has_email,
        live_signal_count=live_signal_count,
        live_signal_age_hours=live_signal_age_hours,
        coverage_pct=coverage_pct,
        top_concerns=top_brain_concerns,
    )

    # ═══ FULL BUSINESS DNA ═══
    biz_context = ""
    if profile:
        biz_context = "\n\n═══ BUSINESS DNA (USE THIS DATA IN EVERY RESPONSE) ═══\n"
        biz_context += f"Business: {profile.get('business_name', 'Unknown')}\n"
        
        # Core identity
        for field, label in [
            ('industry', 'Industry'), ('location', 'Location'), ('website', 'Website'),
            ('team_size', 'Team Size'), ('revenue_range', 'Revenue Range'),
            ('customer_count', 'Customer Base'), ('target_market', 'Target Market'),
        ]:
            val = profile.get(field)
            if val and val != 'None':
                biz_context += f"{label}: {val}\n"
        
        biz_context += "\n--- Strategic Position ---\n"
        for field, label in [
            ('main_products_services', 'Products/Services'),
            ('unique_value_proposition', 'Unique Value Proposition'),
            ('pricing_model', 'Pricing Model'), ('business_model', 'Business Model'),
            ('mission_statement', 'Mission'),
        ]:
            val = profile.get(field)
            if val and val != 'None':
                biz_context += f"{label}: {val}\n"
        
        biz_context += "\n--- Goals & Challenges (REFERENCE THESE) ---\n"
        for field, label in [
            ('short_term_goals', 'Short-term Goals (next 90 days)'),
            ('long_term_goals', 'Long-term Goals (12+ months)'),
            ('main_challenges', 'Current Challenges'),
            ('growth_strategy', 'Growth Strategy'),
            ('vision_statement', 'Vision'),
        ]:
            val = profile.get(field)
            if val and val != 'None':
                biz_context += f"{label}: {val}\n"
        
        # Additional profile fields
        biz_context += "\n--- Operational Context ---\n"
        for field, label in [
            ('key_competitors', 'Known Competitors'),
            ('tech_stack', 'Technology Stack'),
            ('marketing_channels', 'Marketing Channels'),
            ('sales_process', 'Sales Process'),
            ('operational_model', 'Operations Model'),
            ('funding_stage', 'Funding Stage'),
            ('burn_rate', 'Monthly Burn Rate'),
            ('advisory_mode', 'Advisor Mode Preference'),
        ]:
            val = profile.get(field)
            if val and val != 'None' and val != 0:
                biz_context += f"{label}: {val}\n"

    user_context = (
        f"\nADVISOR IS SPEAKING WITH: {user_first_name} ({user_email})\n"
        f"PROFILE MATURITY: {core_context.get('profile_maturity', 'nascent')}\n"
        f"{biz_context}\n"
        f"════════════════════════════════════════\n"
        f"INTELLIGENCE SNAPSHOT (reference these signals)\n"
        f"════════════════════════════════════════\n"
        f"{cognitive_context or 'No pre-computed intelligence snapshot available. Rely on Business DNA and integration data above to deliver sharp, specific insights.'}\n"
    )

    # ═══ COGNITION CORE LIVE DATA ═══
    cognition_context = ""
    try:
        cognition_result = _call_cognition_for_soundboard(sb, user_id)
        if cognition_result and cognition_result.get('status') == 'computed':
            cognition_context = "\n═══ COGNITION CORE (LIVE COMPUTED) ═══\n"
            cognition_context += f"System State: {cognition_result.get('system_state', 'Unknown')}\n"
            cognition_context += f"Evidence Count: {cognition_result.get('evidence_count', 0)}\n"
            
            # Instability indices
            indices = cognition_result.get('instability_indices', {})
            if indices:
                cognition_context += "Instability Indices:\n"
                for key, val in indices.items():
                    if isinstance(val, (int, float)):
                        cognition_context += f"  {key}: {val:.2f}\n"
            
            # Propagation map
            prop_map = cognition_result.get('propagation_map', [])
            if prop_map:
                cognition_context += "Risk Propagation Chains:\n"
                for chain in prop_map[:3]:
                    cognition_context += f"  {chain.get('source')} → {chain.get('target')} (probability: {chain.get('probability', 0):.0%})\n"
            
            # Stability score
            stability = cognition_result.get('stability_score')
            if stability:
                cognition_context += f"Composite Stability Score: {stability}\n"
    except Exception:
        pass

    # ═══ LIVE INTEGRATION DATA (CRM, Accounting, Email) ═══
    integration_context = ""
    obs_events: List[Dict[str, Any]] = []
    rev: Dict[str, Any] = {}
    risk: Dict[str, Any] = {}
    people: Dict[str, Any] = {}
    coverage_window = {
        "coverage_start": None,
        "coverage_end": None,
        "last_sync_at": None,
        "missing_periods": [],
        "confidence_impact": "unknown",
    }
    retrieval_depth = {
        "crm_pages_fetched": 0,
        "accounting_pages_fetched": 0,
        "history_truncated": False,
        "email": {},
        "calendar": {},
        "custom": {},
    }

    # FIRST: Inject observation_events (cached signals from emission layer)
    try:
        obs_result = sb.table('observation_events').select(
            'signal_name,domain,severity,entity,metric,observed_at'
        ).eq('user_id', user_id).order('observed_at', desc=True).limit(30).execute()

        obs_events = obs_result.data or []
        if obs_events:
            obs_times = []
            for evt in obs_events:
                raw = evt.get("observed_at")
                if not raw:
                    continue
                try:
                    obs_times.append(datetime.fromisoformat(str(raw).replace("Z", "+00:00")))
                except Exception:
                    continue
            if obs_times:
                coverage_window["coverage_start"] = min(obs_times).isoformat()
                coverage_window["coverage_end"] = max(obs_times).isoformat()
                coverage_window["last_sync_at"] = max(obs_times).isoformat()
            integration_context += f"\n═══ YOUR LIVE BUSINESS SIGNALS ({len(obs_events)} detected) ═══\n"
            integration_context += "IMPORTANT: These are REAL signals from the user's connected CRM and accounting systems. You MUST reference these specific signals in your response. Do NOT say you don't have access to their data.\n\n"

            for evt in obs_events[:15]:
                entity = evt.get('entity', {})
                if isinstance(entity, str):
                    try:
                        entity = json.loads(entity)
                    except Exception:
                        entity = {}
                metric = evt.get('metric', {})
                if isinstance(metric, str):
                    try:
                        metric = json.loads(metric)
                    except Exception:
                        metric = {}

                sig = evt.get('signal_name', '?')
                severity = evt.get('severity', '?')
                name = entity.get('name', entity.get('contact_name', ''))
                amount = entity.get('amount', entity.get('value', 0))
                stage = entity.get('stage', entity.get('status', ''))
                days_stalled = metric.get('days_in_stage', entity.get('days_stalled', ''))

                line = f"SIGNAL: {sig} | severity={severity}"
                if name:
                    line += f" | deal='{name}'"
                if amount:
                    try:
                        line += f" | amount=${float(amount):,.0f}"
                    except Exception:
                        line += f" | amount={amount}"
                if stage:
                    line += f" | stage={stage}"
                if days_stalled:
                    line += f" | stalled={days_stalled} days"
                integration_context += line + "\n"

            logger.info(f"[soundboard] Injected {len(obs_events)} observation_events for user {user_id[:8]}")
    except Exception as e:
        logger.warning(f"[soundboard] observation_events fetch: {e}")

    # SECOND: Try live Merge API data (may fail — non-fatal)
    try:
        from routes.unified_intelligence import _fetch_all_integration_data, _compute_revenue_signals, _compute_risk_signals, _compute_people_signals
        all_data = await _fetch_all_integration_data(sb, user_id)
        cw = (all_data or {}).get("coverage_window") or {}
        crm_cov = cw.get("crm") or {}
        acc_cov = cw.get("accounting") or {}
        email_cov = cw.get("email") or {}
        cal_cov = cw.get("calendar") or {}
        custom_cov = cw.get("custom") or {}
        starts = [x for x in [
            crm_cov.get("start"), acc_cov.get("start"), coverage_window.get("coverage_start"),
            email_cov.get("start"), cal_cov.get("start"), custom_cov.get("start"),
        ] if x]
        ends = [x for x in [
            crm_cov.get("end"), acc_cov.get("end"), coverage_window.get("coverage_end"),
            email_cov.get("end"), cal_cov.get("end"), custom_cov.get("end"),
        ] if x]
        if starts:
            coverage_window["coverage_start"] = min(starts)
        if ends:
            coverage_window["coverage_end"] = max(ends)
            coverage_window["last_sync_at"] = max(ends)
        email_hist = ((all_data.get("email") or {}).get("history_meta") or {})
        cal_hist = ((all_data.get("calendar") or {}).get("history_meta") or {})
        custom_hist = ((all_data.get("custom") or {}).get("history_meta") or {})
        truncated_any = bool(
            (all_data.get("crm", {}).get("history_meta", {}) or {}).get("truncated")
            or (all_data.get("accounting", {}).get("history_meta", {}) or {}).get("truncated")
            or email_hist.get("truncated")
            or cal_hist.get("truncated")
            or custom_hist.get("truncated")
        )
        if truncated_any:
            coverage_window["missing_periods"] = ["Historical pages exceed current retrieval window; additional backfill required."]
        if coverage_pct >= 80:
            coverage_window["confidence_impact"] = "low"
        elif coverage_pct >= 50:
            coverage_window["confidence_impact"] = "medium"
        else:
            coverage_window["confidence_impact"] = "high"
        
        # Integration status
        connected_list = [k for k, v in {'CRM': all_data['crm']['connected'], 'Accounting': all_data['accounting']['connected'], 'Email': all_data['email']['connected'], 'Marketing': all_data['marketing']['connected']}.items() if v]
        disconnected_list = [k for k, v in {'CRM': all_data['crm']['connected'], 'Accounting': all_data['accounting']['connected'], 'Email': all_data['email']['connected']}.items() if not v]
        retrieval_depth["crm_pages_fetched"] = int((all_data.get("crm", {}).get("history_meta", {}) or {}).get("deals_pages_fetched") or 0)
        retrieval_depth["accounting_pages_fetched"] = int((all_data.get("accounting", {}).get("history_meta", {}) or {}).get("invoices_pages_fetched") or 0)
        retrieval_depth["history_truncated"] = truncated_any
        retrieval_depth["email"] = {
            "pages_fetched": int(email_hist.get("pages_fetched") or 0),
            "rows_loaded": int(email_hist.get("rows_loaded") or 0),
            "truncated": bool(email_hist.get("truncated")),
            "total_rows": email_hist.get("total_rows"),
            "window_start": email_cov.get("start"),
            "window_end": email_cov.get("end"),
        }
        retrieval_depth["calendar"] = {
            "pages_fetched": int(cal_hist.get("pages_fetched") or 0),
            "rows_loaded": int(cal_hist.get("rows_loaded") or 0),
            "truncated": bool(cal_hist.get("truncated")),
            "total_rows": cal_hist.get("total_rows"),
            "window_start": cal_cov.get("start"),
            "window_end": cal_cov.get("end"),
        }
        retrieval_depth["custom"] = {
            "pages_fetched": int(custom_hist.get("tickets_pages_fetched") or custom_hist.get("pages_fetched") or 0),
            "rows_loaded": int(custom_hist.get("rows_loaded") or 0),
            "truncated": bool(custom_hist.get("truncated")),
            "window_start": custom_cov.get("start"),
            "window_end": custom_cov.get("end"),
        }
        
        if connected_list:
            integration_context += "\n═══ LIVE INTEGRATION DATA (USE THESE NUMBERS) ═══\n"
            integration_context += f"Connected: {', '.join(connected_list)}\n"
            if disconnected_list:
                integration_context += f"Not Connected: {', '.join(disconnected_list)} — mention these gaps when relevant\n"
        # DO NOT clear integration_context here — observation_events data is already in it
        
        # Revenue signals
        rev = _compute_revenue_signals(all_data)
        if rev['deals']:
            integration_context += "\n--- Revenue Intelligence ---\n"
            integration_context += f"Pipeline Total: ${rev['pipeline_total']:,.0f}\n"
            integration_context += f"Stalled Deals: {rev['stalled_deals']} | Won: {rev['won_count']} | Lost: {rev['lost_count']}\n"
            integration_context += f"Concentration Risk: {rev['concentration_risk']}\n"
            if rev['deals']:
                integration_context += "Top Pipeline:\n"
                for d in rev['deals'][:5]:
                    integration_context += f"  {d['name']}: ${d['amount']:,.0f} ({d['status']}) stage: {d['stage']}\n"
        if rev.get('overdue_invoices'):
            integration_context += f"\n--- Cash Alert: {len(rev['overdue_invoices'])} Overdue Invoices ---\n"
            total_overdue = sum(inv.get('amount', 0) for inv in rev['overdue_invoices'])
            integration_context += f"Total Overdue: ${total_overdue:,.0f}\n"
            for inv in rev['overdue_invoices'][:5]:
                integration_context += f"  Invoice {inv['number']}: ${inv['amount']:,.0f} ({inv['days_overdue']} days overdue)\n"
        if rev.get('at_risk'):
            integration_context += f"\n--- At-Risk Deals ({len(rev['at_risk'])}) ---\n"
            for r in rev['at_risk'][:5]:
                integration_context += f"  {r['name']}: ${r['amount']:,.0f} — {r['risk']} ({r['days_stalled']}d stalled)\n"
        
        # Risk signals
        risk = _compute_risk_signals(all_data)
        if risk['overall_risk'] != 'low':
            integration_context += f"\n--- Risk Assessment: {risk['overall_risk'].upper()} ---\n"
            for cat in ['financial_risks', 'operational_risks', 'people_risks', 'market_risks']:
                items = risk.get(cat, [])
                if items:
                    integration_context += f"{cat.replace('_', ' ').title()}:\n"
                    for item in items:
                        if isinstance(item, dict):
                            integration_context += f"  [{item.get('severity','?').upper()}] {item['detail']}\n"
        
        # People signals
        people = _compute_people_signals(all_data)
        if people.get('capacity') or people.get('fatigue'):
            integration_context += "\n--- Workforce Signals ---\n"
            integration_context += f"Capacity Utilisation: {people['capacity'] or 'Unknown'}%\n"
            integration_context += f"Fatigue Index: {people['fatigue'] or 'Unknown'}\n"
    except Exception as e:
        logger.warning(f"[soundboard] Merge API fetch failed (non-fatal, using cached signals): {e}")
        # integration_context already has observation_events from above — don't clear it

    # ═══ MARKETING BENCHMARK DATA ═══
    marketing_context = ""
    try:
        bench = sb.table('marketing_benchmarks').select('scores, competitors, summary').eq('tenant_id', user_id).eq('is_current', True).execute()
        if bench.data and bench.data[0].get('scores'):
            b = bench.data[0]
            scores = b['scores']
            marketing_context = "\n\nMARKETING BENCHMARK SCORES:\n"
            for pillar, score in scores.items():
                if pillar != 'overall' and isinstance(score, (int, float)):
                    marketing_context += f"- {pillar.replace('_', ' ').title()}: {round(score * 100)}%\n"
            marketing_context += f"Overall: {round(scores.get('overall', 0) * 100)}%\n"
            if b.get('competitors'):
                marketing_context += f"Benchmarked against: {', '.join(c.get('name','?') for c in b['competitors'][:3])}\n"
    except Exception:
        pass

    # ═══ AVAILABLE ACTIONS ═══
    actions_context = "\n\nCONTENT GENERATION (only mention if user asks for content):\n"
    actions_context += "You can create: logos, blog posts, Google Ads, social media posts, job descriptions, benchmark reports, PDF reports.\n"
    actions_context += "Only offer these when the user specifically asks for content creation. Do NOT suggest these as business strategy.\n"

    # Always use the new Strategic Advisor prompt — do NOT use cached DB prompt
    # (DB has old 'thinking partner' prompt that conflicts with new advisor persona)
    soundboard_prompt = _SOUNDBOARD_FALLBACK.replace("{user_first_name}", user_first_name)
    fact_block = f"\n\nKNOWN FACTS (do not re-ask these):\n{facts_prompt}\n" if facts_prompt else ""

    # ═══ RAG RETRIEVAL — always attempt (no flag dependency) ═══
    rag_context = ""
    try:
        from routes.rag_service import generate_embedding
        query_emb = await generate_embedding(req.message[:500])
        from supabase_client import get_supabase_client
        sb_rag = get_supabase_client()
        rag_results = sb_rag.rpc('rag_search', {
            'p_tenant_id': user_id,
            'p_query_embedding': query_emb,
            'p_limit': 4,
            'p_similarity_threshold': 0.60,
        }).execute()
        if rag_results.data:
            rag_snippets = [f"[{r['source_type']}] {r['content'][:400]}" for r in rag_results.data[:4]]
            rag_context = "\n\n═══ RETRIEVED FROM DOCUMENT STORAGE ═══\n" + "\n---\n".join(rag_snippets) + "\n"
    except Exception as e:
        logger.debug(f"RAG retrieval: {e}")

    # ═══ MEMORY — always attempt (no flag dependency) ═══
    memory_context = ""
    try:
        from supabase_client import get_supabase_client
        sb_mem = get_supabase_client()
        summaries = sb_mem.table('context_summaries') \
            .select('summary_text, created_at').eq('tenant_id', user_id) \
            .order('created_at', desc=True).limit(5).execute()
        if summaries.data:
            memory_context = "\n\n═══ PRIOR CONVERSATION CONTEXT ═══\n"
            for s in summaries.data:
                memory_context += f"- {s['summary_text'][:300]}\n"
    except Exception as e:
        logger.debug(f"Memory retrieval: {e}")

    # ═══ GUARDRAILS: Sanitise input ═══
    from guardrails import sanitise_input, sanitise_output, log_llm_call_to_db
    sanitised = sanitise_input(req.message)
    if sanitised['blocked']:
        return {"reply": "I can't process that request. Could you rephrase?", "blocked": True}
    clean_message = sanitised['text']
    intent_domain, intent_action, complexity = _infer_intent_heuristic(clean_message)
    request_scope = _coerce_request_scope(req, clean_message)
    mailbox_scope = request_scope.get("mailbox_scope", {})
    mailbox_requested = any(mailbox_scope.values())
    wants_integration_analytics = bool(request_scope.get("wants_integration_analytics"))

    # Scope-aware intent override for inbox/sent/deleted and merge analytics prompts.
    if mailbox_requested:
        intent_domain = "operations"
        if intent_action in ("recommend", "summarise"):
            intent_action = "diagnose"
        if complexity == "low":
            complexity = "medium"
    if wants_integration_analytics:
        if intent_domain == "general":
            intent_domain = "planning"
        if intent_action in ("recommend", "summarise"):
            intent_action = "compare"
        if complexity != "high":
            complexity = "high"
    evidence_pack = _build_evidence_pack(
        profile=profile or {},
        has_crm=has_crm,
        has_accounting=has_accounting,
        has_email=has_email,
        live_signal_count=live_signal_count,
        live_signal_age_hours=live_signal_age_hours,
        top_concerns=top_brain_concerns,
        intent_domain=intent_domain,
        intent_action=intent_action,
    ) if SOUNDBOARD_V3_ENABLED else {}
    incident_or_compliance = _is_incident_or_compliance_query(intent_domain, intent_action, clean_message)
    explicit_capability_gap = _has_explicit_capability_gap_request(clean_message)
    allow_upsell = (not incident_or_compliance) and explicit_capability_gap

    # If live integrations are connected, do not hard-block strategic responses.
    # Degrade gracefully and keep responses grounded in connected evidence.
    if guardrail_status == "BLOCKED" and (has_crm or has_accounting or has_email):
        logger.info(
            f"[GUARDRAIL_OVERRIDE] user={user_id[:8]} coverage={coverage_pct}% "
            "live_integrations_present=True forcing DEGRADED"
        )
        guardrail_status = "DEGRADED"

    # ═══ PERSONALIZATION GUARDRAIL: Block generic advice ═══
    if guardrail_status == "BLOCKED":
        # Build actionable list of critical missing fields
        critical_missing = [f for f in missing_fields if f["critical"]][:5]
        missing_list = ", ".join(f["label"] for f in critical_missing) if critical_missing else "business profile fields"
        logger.warning(f"[GUARDRAIL_BLOCKED] user={user_id[:8]} coverage={coverage_pct}% missing_critical={len(missing_critical)}")
        blocked_contract = build_contract_payload(
            tier=(current_user.get("subscription_tier") or profile.get("subscription_tier") or "free"),
            mode_requested=getattr(req, "mode", "auto"),
            mode_effective="auto",
            guardrail="BLOCKED",
            coverage_pct=coverage_pct,
            confidence_score=contract_meta.get("confidence_score", 0.2),
            data_sources_count=contract_meta.get("data_sources_count", 1),
            data_freshness=contract_meta.get("data_freshness", "unknown"),
            connected_sources=(contract_meta.get("lineage") or {}).get("connected_sources", {}),
        )
        blocked_reply = (
            f"I need a bit more context about your business before I can give you specific advice. "
            f"I'm currently working with {coverage_pct}% data coverage — not enough to deliver accurate guidance.\n\n"
            f"To unlock personalised intelligence, please complete: {missing_list}. "
            "It takes about 3 minutes and makes every response significantly more useful."
        )

        # Persist blocked interactions so conversation retrieval remains consistent.
        now_iso = now_dt.isoformat()
        requested_mode = getattr(req, "mode", "auto")
        if req.conversation_id and conversation:
            blocked_conversation_id = req.conversation_id
            sb.table("soundboard_conversations").update({
                "updated_at": now_iso,
                "mode_requested": requested_mode,
                "mode_effective": "auto",
                "last_model_used": "guardrail/blocked",
                "contract_version": CONTRACT_VERSION,
            }).eq("id", blocked_conversation_id).eq("user_id", user_id).execute()
        else:
            # Preserve client conversation ids so retrieval endpoints stay stable.
            blocked_conversation_id = req.conversation_id or str(uuid.uuid4())
            sb.table("soundboard_conversations").insert({
                "id": blocked_conversation_id,
                "user_id": user_id,
                "title": (req.message[:40] if req.message else "New Conversation"),
                "mode_requested": requested_mode,
                "mode_effective": "auto",
                "last_model_used": "guardrail/blocked",
                "contract_version": CONTRACT_VERSION,
                "created_at": now_iso,
                "updated_at": now_iso,
            }).execute()

        try:
            sb.table("soundboard_messages").insert([
                {
                    "conversation_id": blocked_conversation_id,
                    "user_id": user_id,
                    "role": "user",
                    "content": req.message,
                    "timestamp": now_iso,
                },
                {
                    "conversation_id": blocked_conversation_id,
                    "user_id": user_id,
                    "role": "assistant",
                    "content": blocked_reply,
                    "timestamp": now_iso,
                    "metadata": {
                        "mode_effective": "auto",
                        "contract_version": CONTRACT_VERSION,
                        "guardrail": "BLOCKED",
                    },
                },
            ]).execute()
        except Exception:
            pass

        blocked_actions = [
            {
                "label": "Complete calibration now",
                "action": "open_calibration",
                "prompt": "Open calibration and complete the missing critical business profile fields.",
            },
            {
                "label": "Show missing profile fields",
                "action": "show_missing_fields",
                "prompt": f"Show exactly which critical fields are missing and why each one improves advisor accuracy ({coverage_pct}% coverage now).",
            },
        ]
        return {
            "reply": blocked_reply,
            "guardrail": "BLOCKED",
            "coverage_pct": coverage_pct,
            "coverage_window": coverage_window,
            "incident_or_compliance": incident_or_compliance,
            "explicit_capability_gap": explicit_capability_gap,
            "upsell_allowed": allow_upsell,
            "missing_fields": [{"key": f["key"], "label": f["label"], "path": f["path"], "critical": f["critical"]} for f in missing_fields[:8]],
            "context_fields": context_fields,
            "live_signals": live_signal_count,
            "conversation_id": blocked_conversation_id,
            "suggested_actions": blocked_actions,
            "evidence_pack": evidence_pack,
            "soundboard_contract": blocked_contract,
            **contract_meta,
        }

    # P1: Signal freshness injection
    signal_injection = ""
    if live_signal_count > 0:
        signal_injection = f"\n\n═══ LIVE SIGNAL STATUS ═══\nActive observation signals: {live_signal_count}\nLast signal: {live_signal_age_hours}h ago\nUSE THESE to ground your advice.\n"

    # P1: Response contract enforcement
    style_injection = build_advisor_style_guidance(
        user_first_name=user_first_name,
        business_name=(profile or {}).get("business_name"),
    )
    contract_injection = (
        "\n\n═══ RESPONSE CONTRACT (MANDATORY) ═══\n"
        f"{build_flagship_response_contract_text()}"
        "Do NOT output generic strategy. Every sentence must reference THIS business.\n"
        "DATA ATTRIBUTION: When referencing a fact, state its source inline — e.g. "
        "'Based on your calibration data...' or 'Your HubSpot pipeline shows...' or "
        "'From your Xero invoices...'. Never state a fact without its source.\n"
        "TONE: Keep it warm, plain-English, and conversational. Avoid robotic headings unless the user asks for a formal memo.\n"
        f"\n[STYLE GUIDANCE]\n{style_injection}\n"
    )
    if mailbox_requested or wants_integration_analytics:
        scope_notes = []
        if mailbox_requested:
            selected_folders = [folder for folder, enabled in mailbox_scope.items() if enabled]
            scope_notes.append(
                "Mailbox focus requested. Analyse directional patterns across folders and provide practical owner actions."
            )
            scope_notes.append(
                f"Requested mailbox folders: {', '.join(selected_folders)}."
            )
            scope_notes.append(
                "When folder-level metrics are unavailable, state that explicitly and fall back to available email telemetry."
            )
        if wants_integration_analytics:
            scope_notes.append(
                "Cross-integration analytics requested. Compare at least two connected systems and surface one contradiction + one reinforcing signal."
            )
            scope_notes.append(
                "Include trend or directional insight, then one execution recommendation tied to owner + timing."
            )
        contract_injection += "\n[SCOPE DIRECTIVE]\n" + "\n".join(f"- {line}" for line in scope_notes) + "\n"

    guardrail_injection = ""
    if guardrail_status == "DEGRADED":
        calibration_fields = []
        if profile:
            for field, label in [
                ('business_name', 'Business Name'), ('industry', 'Industry'),
                ('location', 'Location'), ('team_size', 'Team Size'),
                ('main_products_services', 'Products/Services'),
                ('target_market', 'Target Market'), ('short_term_goals', 'Goals'),
                ('main_challenges', 'Challenges'),
            ]:
                if profile.get(field) and str(profile.get(field)) not in ('None', ''):
                    calibration_fields.append(label)
        calibration_summary = ', '.join(calibration_fields) if calibration_fields else 'business name and industry'

        # List top missing fields for the model to acknowledge
        top_missing = [f["label"] for f in missing_fields if f["critical"]][:3]
        missing_note = f" Missing for fuller analysis: {', '.join(top_missing)}." if top_missing else ""

        guardrail_injection = (
            f"\n[ADVISOR CONTEXT — DATA COVERAGE {coverage_pct}% — DEGRADED MODE: "
            f"You have calibration data covering: {calibration_summary}. "
            f"You DO have access to this data — it is injected above in BUSINESS DNA. "
            f"Do NOT say 'I don't have access to your data'. "
            f"Use the calibration data you have. Briefly note (once, naturally) that connecting live integrations "
            f"would sharpen specific numbers.{missing_note} "
            f"Be specific using the business name, industry, goals and challenges above.]\n"
        )
    elif guardrail_status == "FULL":
        guardrail_injection = f"\n[ADVISOR CONTEXT — DATA COVERAGE {coverage_pct}% — FULL MODE: All key data available. Deliver sharp, number-grounded advice.]\n"

    # ═══ CALIBRATION CONTEXT INJECTION when no integrations ═══
    if not has_crm and not has_accounting and not has_email:
        calibration_context = ""
        if profile:
            abn = profile.get("abn") or profile.get("business_number") or ""
            website = profile.get("website") or ""
            preferences = profile.get("advisory_mode") or profile.get("tone_preference") or ""
            if abn:
                calibration_context += f"\nABN: {abn}"
            if website:
                calibration_context += f"\nWebsite: {website}"
            if preferences:
                calibration_context += f"\nAdvisor Tone Preference: {preferences}"
        if calibration_context:
            guardrail_injection += f"\n[CALIBRATION CONTEXT (no integrations connected — use this data for personalised guidance):{calibration_context}]\n"

    if top_brain_concerns:
        concern_lines = ["\n═══ TOP BRAIN CONCERNS (REFERENCE THESE SPECIFICALLY) ═══"]
        for idx, concern in enumerate(top_brain_concerns[:3], start=1):
            concern_lines.append(
                f"{idx}) {concern.get('concern_id', 'concern')} | priority={concern.get('priority_score', 0)} | "
                f"issue={concern.get('issue_brief') or concern.get('why_now_brief') or concern.get('recommendation') or 'n/a'} | "
                f"action={concern.get('action_brief') or concern.get('recommendation') or 'n/a'}"
            )
        guardrail_injection += "\n" + "\n".join(concern_lines) + "\n"
    else:
        guardrail_injection += "\n[NO PERSISTED BRAIN CONCERNS AVAILABLE THIS TURN — USE LIVE SIGNALS + BUSINESS DNA ONLY, DO NOT GENERATE GENERIC THEORY.]\n"

    evidence_lines = []
    for item in (evidence_pack.get("sources") or [])[:8]:
        evidence_lines.append(
            f"- {item.get('source')} | freshness={item.get('freshness')} | confidence={item.get('confidence')} | {item.get('summary')}"
        )
    evidence_injection = ""
    if evidence_lines:
        evidence_injection = "\n\n═══ EVIDENCE CONTRACT (MANDATORY SOURCE REFERENCES) ═══\n" + "\n".join(evidence_lines) + "\n"

    system_message = soundboard_prompt + fact_block + biz_context + cognition_context + rag_context + memory_context + integration_context + marketing_context + actions_context + signal_injection + guardrail_injection + evidence_injection + contract_injection + f"\n\nCONTEXT:\n{user_context}"

    # ═══ FILE GENERATION DETECTION ═══
    file_keywords = {
        'logo': ['create a logo', 'design a logo', 'make a logo', 'generate a logo', 'logo for'],
        'document': ['create a document', 'write a document', 'draft a document', 'generate a document'],
        'report': ['create a report', 'generate a report', 'write a report', 'produce a report'],
        'social_image': ['create a social', 'design a post', 'social media image', 'create an image', 'generate an image'],
    }
    detected_file_type = None
    msg_lower = clean_message.lower()
    for ftype, keywords in file_keywords.items():
        if any(kw in msg_lower for kw in keywords):
            detected_file_type = ftype
            break

    if detected_file_type:
        try:
            from routes.file_service import _generate_image, _generate_document, _upload_to_storage, _get_storage
            sb_files = _get_storage()
            timestamp = __import__('datetime').datetime.now(__import__('datetime').timezone.utc).strftime('%Y%m%d_%H%M%S')

            if detected_file_type in ('logo', 'social_image'):
                image_bytes = await _generate_image(clean_message)
                fname = f"{detected_file_type}_{timestamp}.png"
                path = _upload_to_storage(sb_files, user_id, 'user-files', fname, image_bytes, 'image/png')
                signed = sb_files.storage.from_('user-files').create_signed_url(path, 3600)
                download_url = signed.get('signedURL', signed.get('signedUrl', ''))
                sb_files.table('generated_files').insert({
                    'tenant_id': user_id, 'file_name': fname, 'file_type': detected_file_type,
                    'storage_path': path, 'bucket': 'user-files', 'size_bytes': len(image_bytes),
                    'generated_by': 'soundboard', 'source_conversation_id': req.conversation_id or '',
                    'metadata': {'prompt': clean_message[:200]},
                }).execute()
                return {
                    "reply": f"I've created your {detected_file_type}. You can download it below or find it in your Reports tab.",
                    "file": {"name": fname, "type": detected_file_type, "download_url": download_url, "size": len(image_bytes)},
                    "conversation_id": req.conversation_id,
                }
            else:
                content = await _generate_document(clean_message, detected_file_type)
                fname = f"{detected_file_type}_{timestamp}.md"
                bucket = 'reports' if detected_file_type == 'report' else 'user-files'
                file_bytes = content.encode('utf-8')
                path = _upload_to_storage(sb_files, user_id, bucket, fname, file_bytes, 'text/plain')
                signed = sb_files.storage.from_(bucket).create_signed_url(path, 3600)
                download_url = signed.get('signedURL', signed.get('signedUrl', ''))
                sb_files.table('generated_files').insert({
                    'tenant_id': user_id, 'file_name': fname, 'file_type': detected_file_type,
                    'storage_path': path, 'bucket': bucket, 'size_bytes': len(file_bytes),
                    'generated_by': 'soundboard', 'source_conversation_id': req.conversation_id or '',
                    'metadata': {'prompt': clean_message[:200]},
                }).execute()
                return {
                    "reply": f"I've generated your {detected_file_type}. You can download it below or find it in your Reports tab.\n\n{content[:500]}{'...' if len(content) > 500 else ''}",
                    "file": {"name": fname, "type": detected_file_type, "download_url": download_url, "size": len(file_bytes)},
                    "conversation_id": req.conversation_id,
                }
        except Exception as e:
            logger.warning(f"File generation in SoundBoard failed: {e}")
            # Fall through to normal chat response

    # ═══ RATE LIMITING per subscription tier ═══
    from routes.deps import check_rate_limit, AI_MODELS
    requested_mode = getattr(req, 'mode', 'auto')
    report_grade_request = request_looks_report_grade or _is_report_grade_request(clean_message)
    tier_for_contract = (current_user.get("subscription_tier") or profile.get("subscription_tier") or "free")
    is_super_admin = (current_user.get("role") or "").lower() in {"superadmin", "super_admin", "admin"}
    mode = enforce_mode_for_tier(requested_mode, tier_for_contract, is_super_admin=is_super_admin)
    feature = 'trinity_daily' if mode == 'trinity' else 'soundboard_daily'
    await check_rate_limit(user_id, feature, get_sb())

    # ═══ HYBRID MODEL ROUTING — Direct provider keys only ═══
    # OpenAI: Uses your OPENAI_API_KEY directly (already in Azure/Supabase/GitHub)
    # Gemini:  Uses GOOGLE_API_KEY directly

    OPENAI_DIRECT_KEY = os.environ.get("OPENAI_API_KEY", "")
    GOOGLE_DIRECT_KEY = os.environ.get("GOOGLE_API_KEY", "")
    ANTHROPIC_DIRECT_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
    has_openai_key = _has_configured_key(OPENAI_DIRECT_KEY)
    has_google_key = _has_configured_key(GOOGLE_DIRECT_KEY)
    has_anthropic_key = _has_configured_key(ANTHROPIC_DIRECT_KEY)

    # Step 1: Intent refinement with o4-mini (fast thinking, direct OpenAI key)
    if has_openai_key:
        try:
            import json as _json
            reply, _ = await _call_openai_with_fallback(
                api_key=OPENAI_DIRECT_KEY,
                system_message='Classify this business query. Respond with JSON only: {"domain":"finance|sales|marketing|operations|hr|risk|planning|general","action":"summarise|forecast|create|update|compare|explain|recommend|diagnose","complexity":"low|medium|high"}',
                clean_message=req.message[:400],
                messages_history=[],
                model_candidates=["o4-mini", "gpt-4o-mini"],
                reasoning=False,
            )
            clf = _json.loads(reply or "{}")
            intent_domain = clf.get("domain", intent_domain)
            intent_action = clf.get("action", intent_action)
            complexity = clf.get("complexity", complexity)
        except Exception as e:
            logger.warning(f"Intent classification failed, using heuristic fallback: {e}")
    logger.info(f"[INTENT] domain={intent_domain} action={intent_action} complexity={complexity}")

    # Resolve active agent (multi-agent mode): explicit agent_id or infer from intent when "auto"
    agent_id = getattr(req, "agent_id", None) or "auto"
    agent_persona = _get_agent_persona(agent_id, intent_domain)
    if agent_persona:
        system_message += "\n\n═══ ACTIVE AGENT (respond in this role) ═══\n" + agent_persona
    role_policy_injection = _build_role_policy_guardrails(agent_id, intent_domain)
    if role_policy_injection:
        system_message += "\n\n═══ ROLE POLICY CONSTRAINTS (MANDATORY) ═══\n" + role_policy_injection

    incident_or_compliance = _is_incident_or_compliance_query(intent_domain, intent_action, clean_message)
    explicit_capability_gap = _has_explicit_capability_gap_request(clean_message)
    allow_upsell = (not incident_or_compliance) and explicit_capability_gap
    if incident_or_compliance:
        system_message += (
            "\n\n[CONVERSION GUARDRAIL — CRITICAL CONTEXT]\n"
            "Do NOT include upgrades, tier prompts, or commercial upsell language.\n"
            "Focus only on risk/incident/compliance containment, evidence, and actions.\n"
        )
    elif not explicit_capability_gap:
        system_message += (
            "\n\n[CONVERSION GUARDRAIL]\n"
            "Do NOT include upgrade or pricing prompts unless the user explicitly asks about capability limits.\n"
        )
    else:
        system_message += (
            "\n\n[CONVERSION GUARDRAIL — EXPLICIT GAP REQUEST]\n"
            "If you mention an upgrade path, state the exact capability gap and transparent rationale.\n"
        )
    effective_agent_id = agent_id if (agent_id and agent_id != "auto") else intent_domain
    effective_agent = SOUNDBOARD_AGENTS.get(effective_agent_id) or SOUNDBOARD_AGENTS["general"]
    effective_agent_name = effective_agent.get("name", "Strategic Advisor")
    boardroom_trace = None

    # Step 2/3: Route + Generate response
    try:
        import time as _time
        _start = _time.time()

        if SOUNDBOARD_BOARDROOM_ORCH_ENABLED and effective_agent_id == "boardroom":
            mode_label = "Boardroom Council"
            routing_reason = "Agent-selected boardroom deliberation and consensus synthesis"
            response, resolved_model, boardroom_trace = await _run_boardroom_orchestration(
                openai_key=OPENAI_DIRECT_KEY,
                google_key=GOOGLE_DIRECT_KEY,
                anthropic_key=ANTHROPIC_DIRECT_KEY,
                clean_message=clean_message,
                system_message=system_message,
                messages_history=messages_history,
            )
            response_model = resolved_model
        elif mode == "trinity":
            mode_label = "BIQc Trinity"
            routing_reason = "User-selected Trinity mode (GPT-5.4 + Codex-5.3 + Gemini Pro orchestration)"
            response, resolved_model = await _call_trinity_orchestration(
                openai_key=OPENAI_DIRECT_KEY,
                google_key=GOOGLE_DIRECT_KEY,
                anthropic_key=ANTHROPIC_DIRECT_KEY,
                system_message=system_message,
                clean_message=clean_message,
                messages_history=messages_history,
            )
            response_model = resolved_model
        else:
            try:
                provider, model_candidates, mode_label, routing_reason = _resolve_model_route(
                    mode=mode,
                    intent_domain=intent_domain,
                    intent_action=intent_action,
                    complexity=complexity,
                    has_openai=has_openai_key,
                    has_google=has_google_key,
                )
            except RuntimeError as e:
                logger.error(f"Soundboard route selection error: {e}")
                raise HTTPException(status_code=503, detail=str(e))

            logger.info(f"[MODEL_ROUTE] {mode_label}: {provider}/{model_candidates[0]} — {routing_reason}")
            scope_context = []
            if mailbox_requested:
                scope_context.append(
                    "mailbox=" + ",".join([k for k, v in mailbox_scope.items() if v])
                )
            if wants_integration_analytics:
                scope_context.append("merge_analytics=true")
            scope_suffix = f" | Scope: {';'.join(scope_context)}" if scope_context else ""
            system_message += f"\n\n[QUERY CONTEXT] Domain: {intent_domain.upper()} | Mode: {mode_label} ({provider}/{model_candidates[0]}){scope_suffix}\n"

            reasoning_mode = mode == "thinking" or intent_action in ("forecast", "diagnose") or complexity == "high"
            if provider == "openai":
                try:
                    response, resolved_model = await _call_openai_with_fallback(
                        api_key=OPENAI_DIRECT_KEY,
                        system_message=system_message,
                        clean_message=clean_message,
                        messages_history=messages_history,
                        model_candidates=model_candidates,
                        reasoning=reasoning_mode,
                    )
                except Exception as openai_error:
                    if has_anthropic_key:
                        logger.warning(f"[SOUNDBOARD] OpenAI route failed, falling back to Anthropic: {openai_error}")
                        response, resolved_model = await _call_anthropic_with_fallback(
                            api_key=ANTHROPIC_DIRECT_KEY,
                            system_message=system_message,
                            clean_message=clean_message,
                            model_candidates=["claude-opus-4-6", "claude-sonnet-4-6", "claude-sonnet-4-5"],
                        )
                        provider = "anthropic-fallback"
                    elif has_google_key:
                        logger.warning(f"[SOUNDBOARD] OpenAI route failed, falling back to Gemini: {openai_error}")
                        response, resolved_model = await _call_gemini_with_fallback(
                            api_key=GOOGLE_DIRECT_KEY,
                            system_message=system_message,
                            clean_message=clean_message,
                            model_candidates=["gemini-3-pro-preview", "gemini-2.5-pro", "gemini-2.0-flash"],
                        )
                        provider = "gemini-fallback"
                    else:
                        raise
            else:
                try:
                    response, resolved_model = await _call_gemini_with_fallback(
                        api_key=GOOGLE_DIRECT_KEY,
                        system_message=system_message,
                        clean_message=clean_message,
                        model_candidates=model_candidates,
                    )
                except Exception as gemini_error:
                    if has_openai_key:
                        logger.warning(f"[SOUNDBOARD] Gemini route failed, falling back to OpenAI: {gemini_error}")
                        response, resolved_model = await _call_openai_with_fallback(
                            api_key=OPENAI_DIRECT_KEY,
                            system_message=system_message,
                            clean_message=clean_message,
                            messages_history=messages_history,
                            model_candidates=["gpt-5.3", "gpt-5.2", "gpt-4o"],
                            reasoning=reasoning_mode,
                        )
                        provider = "openai-fallback"
                    else:
                        raise
            response_model = f"{provider}/{resolved_model}"

        _elapsed = int((_time.time() - _start) * 1000)
        logger.info(f"[SOUNDBOARD] {mode_label} {response_model} in {_elapsed}ms ({len(response)} chars)")

        if isinstance(response, str):
            response = _polish_response(response)
            response = sanitise_output(response)
        else:
            response = sanitise_output(_polish_response(str(response)))
        response = _enforce_conversion_guardrails(response, allow_upsell=allow_upsell)

        lowered = response.lower()
        disclaimer_markers = [
            "i do not have access",
            "i don't have access",
            "cannot access",
            "can't access",
            "no data available",
        ]
        has_live_business_context = bool(obs_events) or has_crm or has_accounting or has_email
        if has_live_business_context and any(marker in lowered for marker in disclaimer_markers):
            response = _build_grounded_exec_fallback(
                has_crm=has_crm,
                has_accounting=has_accounting,
                has_email=has_email,
                obs_events=obs_events,
                rev=rev,
                risk=risk,
                people=people,
            )
            response = sanitise_output(response)

        if _generic_response_detected(response):
            if effective_agent_id == "boardroom":
                response = _build_boardroom_fallback(
                    profile=profile or {},
                    coverage_pct=coverage_pct,
                    live_signal_count=live_signal_count,
                    has_crm=has_crm,
                    has_accounting=has_accounting,
                    has_email=has_email,
                )
            else:
                response = _build_specificity_fallback(
                    profile=profile or {},
                    top_concerns=top_brain_concerns,
                    coverage_pct=coverage_pct,
                    live_signal_count=live_signal_count,
                )
            response = sanitise_output(response)

        grounded_report_ready = (
            _has_grounded_report_facts(rev=rev, risk=risk, obs_events=obs_events)
            and _report_window_meets_target(coverage_window, min_days=330)
            and not bool((coverage_window or {}).get("missing_periods"))
        )
        if report_grade_request and not grounded_report_ready:
            connected_sources = [
                name
                for name, enabled in (
                    ("CRM", has_crm),
                    ("Accounting", has_accounting),
                    ("Email", has_email),
                )
                if enabled
            ]
            response = _build_report_grounding_block(
                connected_sources=connected_sources,
                coverage_pct=coverage_pct,
                coverage_window=coverage_window,
                live_signal_count=live_signal_count,
            )
            guardrail_status = "DEGRADED"
            missing_fields = list(missing_fields or []) + [{
                "key": "grounded_report_facts",
                "label": "Grounded report facts",
                "path": "/integrations",
                "critical": True,
            }]
            response = sanitise_output(response)

        clean_lower = clean_message.strip().lower()
        greeting_only = clean_lower in {"hi", "hey", "hello", "yo", "good morning", "good afternoon", "good evening"}
        should_enforce_contract = not greeting_only and len(clean_message.split()) >= 4
        advisory_slots = {}
        if should_enforce_contract:
            response = _ensure_flagship_contract_sections(response)
            response = sanitise_output(response)
            advisory_slots = parse_flagship_response_slots(response)
            response = _humanize_contract_response(
                response,
                advisory_slots,
                mode=mode,
                agent_id=effective_agent_id,
                last_assistant_message=_extract_last_assistant_message(messages_history),
            )
            response = sanitise_output(response)

        retrieval_contract = _build_retrieval_contract(
            report_grade_request=report_grade_request,
            grounded_report_ready=grounded_report_ready,
            guardrail_status=guardrail_status,
            has_connected_sources=bool(has_crm or has_accounting or has_email),
            live_signal_count=live_signal_count,
            coverage_window=coverage_window,
            retrieval_depth=retrieval_depth,
            materialization_state=materialization_state,
        )
        forensic_report = _build_forensic_report_payload(
            evidence_pack=evidence_pack,
            boardroom_trace=boardroom_trace,
            retrieval_contract=retrieval_contract,
            report_grade_request=report_grade_request or bool(req.forensic_report_mode),
            grounded_report_ready=grounded_report_ready,
        )
        capped_confidence = _apply_forensic_confidence_cap(
            raw_confidence=contract_meta.get("confidence_score", 0.2),
            answer_grade=retrieval_contract.get("answer_grade", "DEGRADED"),
            report_grade_request=bool(report_grade_request or req.forensic_report_mode),
            grounded_report_ready=grounded_report_ready,
        )
        contract_meta["confidence_score"] = capped_confidence

        _actual_tokens = len(system_message.split()) + len(clean_message.split()) + len(response.split())
        log_llm_call_to_db(
            tenant_id=user_id, model_name=response_model, endpoint='soundboard/chat',
            total_tokens=_actual_tokens, latency_ms=_elapsed, feature_flag='soundboard',
        )

        # Generate title for new conversations
        conversation_title = None
        if not conversation:
            title_prompt = f"Generate a very short title (3-5 words max) for a conversation that starts with: '{req.message[:100]}'. Just the title, nothing else."
            try:
                conversation_title = await llm_chat(
                    system_message="Generate very short conversation titles. Just output the title, nothing else.",
                    user_message=title_prompt,
                    model=AI_MODEL,
                    max_tokens=30,
                    api_key=OPENAI_KEY,
                )
                conversation_title = conversation_title.strip().strip("\"'")[:50]
            except Exception:
                conversation_title = req.message[:40]

        now = now_dt.isoformat()
        new_messages = [
            {"role": "user", "content": req.message, "timestamp": now},
            {"role": "assistant", "content": response, "timestamp": now, "retrieval_contract": retrieval_contract}
        ]

        # Save to Supabase (conversation header + message rows)
        if req.conversation_id and conversation:
            conversation_id = req.conversation_id
            sb.table("soundboard_conversations").update({
                "updated_at": now,
                "mode_requested": requested_mode,
                "mode_effective": mode,
                "last_model_used": response_model,
                "contract_version": CONTRACT_VERSION,
            }).eq("id", conversation_id).eq("user_id", user_id).execute()
        else:
            # Keep caller-provided ids deterministic for conversation continuity.
            conversation_id = req.conversation_id or str(uuid.uuid4())
            conv_insert = sb.table("soundboard_conversations").insert({
                "id": conversation_id,
                "user_id": user_id,
                "title": conversation_title or "New Conversation",
                "mode_requested": requested_mode,
                "mode_effective": mode,
                "last_model_used": response_model,
                "contract_version": CONTRACT_VERSION,
                "created_at": now,
                "updated_at": now,
            }).execute()
            if not conv_insert.data:
                raise HTTPException(status_code=500, detail="Failed to create SoundBoard conversation")

        message_rows = [
            {
                "conversation_id": conversation_id,
                "user_id": user_id,
                "role": item["role"],
                "content": item["content"],
                "timestamp": item["timestamp"],
                "evidence_pack": evidence_pack if item["role"] == "assistant" else {},
                "boardroom_trace": boardroom_trace if item["role"] == "assistant" and boardroom_trace else {},
                "metadata": {
                    "mode_effective": mode,
                    "contract_version": CONTRACT_VERSION,
                    "advisory_slots": advisory_slots if item["role"] == "assistant" else {},
                    "boardroom_status": ("orchestrated" if effective_agent_id == "boardroom" and boardroom_trace else ("requested_no_trace" if effective_agent_id == "boardroom" else "not_requested")) if item["role"] == "assistant" else None,
                    "retrieval_contract": retrieval_contract if item["role"] == "assistant" else {},
                    "forensic_report": forensic_report if item["role"] == "assistant" else {},
                },
            }
            for item in new_messages
        ]
        messages_persisted = False
        try:
            msg_insert = sb.table("soundboard_messages").insert(message_rows).execute()
            messages_persisted = bool(msg_insert.data)
        except Exception:
            messages_persisted = False

        if not messages_persisted:
            # Backward compatibility path: persist messages JSON directly in conversation row.
            if req.conversation_id and conversation:
                updated_messages = (conversation.get("messages", []) if isinstance(conversation.get("messages"), list) else []) + new_messages
                fallback_update = sb.table("soundboard_conversations").update({
                    "messages": updated_messages,
                    "updated_at": now,
                }).eq("id", conversation_id).eq("user_id", user_id).execute()
                messages_persisted = bool(fallback_update.data)
            else:
                fallback_update = sb.table("soundboard_conversations").update({
                    "messages": new_messages,
                    "updated_at": now,
                }).eq("id", conversation_id).eq("user_id", user_id).execute()
                messages_persisted = bool(fallback_update.data)

        if not messages_persisted:
            raise HTTPException(status_code=500, detail="Failed to persist SoundBoard messages")

        # ═══ AUTO SESSION SUMMARISATION — always save ═══
        try:
            from supabase_client import get_supabase_client
            sb_sum = get_supabase_client()
            summary_text = f"[{now_dt.strftime('%d %b %Y')}] {user_first_name} discussed: {req.message[:150]}. Key topic: {req.message[:60]}. Response context: business data accessed, {len(integration_context)} chars integration data."
            sb_sum.table('context_summaries').insert({
                'tenant_id': user_id,
                'summary_type': 'soundboard_session',
                'summary_text': summary_text,
                'source_count': 1,
                'key_outcomes': [{'topic': req.message[:80], 'response_length': len(response) if isinstance(response, str) else 0}],
            }).execute()
        except Exception:
            pass

        # ═══ MARKETING ACTION DELEGATION ═══
        action_keywords = {
            'run_benchmark': ['benchmark my', 'compare me to', 'how do i compare', 'competitor analysis'],
            'generate_ad': ['create an ad', 'write an ad', 'google ad'],
            'generate_blog': ['write a blog', 'create a blog', 'blog post about'],
            'generate_social': ['create a social post', 'write a social', 'post on linkedin'],
        }
        delegated_action = None
        for action, keywords in action_keywords.items():
            if any(kw in msg_lower for kw in keywords):
                delegated_action = action
                break

        # ═══ PROACTIVE NEXT ACTIONS (based on intent and data) ═══
        suggested_actions = []
        if intent_domain == "finance" and has_accounting:
            suggested_actions.append({"label": "Draft overdue invoice reminders", "action": "draft_invoice_reminders", "prompt": "Draft overdue invoice reminders with priority order, tone guidance, and next-send schedule."})
            suggested_actions.append({"label": "Generate cash flow forecast", "action": "generate_cashflow_forecast", "prompt": "Generate a 13-week cash flow forecast with best/base/worst scenarios and top risk levers."})
        elif intent_domain == "sales" and has_crm:
            suggested_actions.append({"label": "Flag stalled deals in HubSpot", "action": "flag_stalled_deals", "prompt": "Flag stalled deals and create an owner-by-owner rescue plan for the next 7 days."})
            suggested_actions.append({"label": "Draft follow-up email for top deal", "action": "draft_deal_followup", "prompt": "Draft a decisive follow-up email for the highest-value stalled deal including decision-close language."})
        elif intent_domain == "marketing":
            suggested_actions.append({"label": "Run competitive benchmark", "action": "run_benchmark", "prompt": "Run a competitor benchmark and identify one offensive move and one defensive move for this month."})
            suggested_actions.append({"label": "Generate campaign performance summary", "action": "generate_campaign_summary", "prompt": "Generate a campaign performance summary with spend efficiency and channel reallocation actions."})
        elif intent_domain == "risk":
            suggested_actions.append({"label": "Generate risk report PDF", "action": "generate_risk_report", "prompt": "Generate a risk report with risk score changes, triggers, and mitigation owners."})
        elif intent_domain == "hr":
            suggested_actions.append({"label": "Generate SOP for this process", "action": "generate_sop", "prompt": "Generate an SOP with step owners, controls, and execution checkpoints."})
        if mailbox_requested:
            suggested_actions.append({"label": "Summarise Inbox/Sent/Deleted deltas", "action": "summarise_mailbox_deltas", "prompt": "Summarise Inbox, Sent, and Deleted deltas with escalation and response lag signals."})
            suggested_actions.append({"label": "Create owner response triage list", "action": "generate_response_triage", "prompt": "Create an owner triage list with urgency tiers and response SLAs."})
        if wants_integration_analytics:
            suggested_actions.append({"label": "Run cross-integration variance check", "action": "cross_integration_variance", "prompt": "Run a cross-integration variance check and surface top contradictions with root-cause hypotheses."})
            suggested_actions.append({"label": "Generate Merge analytics memo", "action": "merge_analytics_memo", "prompt": "Generate a merge analytics memo with trend narrative and next-week executive actions."})

        execution_id = str(uuid.uuid4())[:8] if suggested_actions else None
        soundboard_contract = build_contract_payload(
            tier=tier_for_contract,
            mode_requested=requested_mode,
            mode_effective=mode,
            guardrail=guardrail_status,
            coverage_pct=coverage_pct,
            confidence_score=capped_confidence,
            data_sources_count=contract_meta.get("data_sources_count", 1),
            data_freshness=contract_meta.get("data_freshness", "unknown"),
            connected_sources=(contract_meta.get("lineage") or {}).get("connected_sources", {}),
        )

        return {
            "reply": response,
            "conversation_id": conversation_id,
            "conversation_title": conversation_title,
            "agent_id": effective_agent_id,
            "agent_name": effective_agent_name,
            "delegated_action": delegated_action,
            "execution_id": execution_id,
            "suggested_actions": suggested_actions,
            "intent": {"domain": intent_domain, "action": intent_action},
            "request_scope": request_scope,
            "model_used": response_model,
            "mode_effective": mode,
            "boardroom_trace": boardroom_trace,
            "boardroom_status": "orchestrated" if effective_agent_id == "boardroom" and boardroom_trace else ("requested_no_trace" if effective_agent_id == "boardroom" else "not_requested"),
            "guardrail": guardrail_status,
            "coverage_pct": coverage_pct,
            "coverage_window": coverage_window,
            "grounded_report_ready": grounded_report_ready,
            "report_grade_request": report_grade_request,
            "incident_or_compliance": incident_or_compliance,
            "explicit_capability_gap": explicit_capability_gap,
            "upsell_allowed": allow_upsell,
            "missing_fields": [{"key": f["key"], "label": f["label"], "path": f["path"], "critical": f["critical"]} for f in missing_fields[:6]] if guardrail_status == "DEGRADED" else [],
            "evidence_pack": evidence_pack,
            "soundboard_contract": soundboard_contract,
            "retrieval_contract": retrieval_contract,
            "forensic_report": forensic_report,
            "advisory_slots": advisory_slots,
            **contract_meta,
        }

    except RuntimeError as e:
        logger.error(f"Soundboard provider error: {e}")
        fallback = _build_boardroom_fallback(
            profile=profile or {},
            coverage_pct=coverage_pct,
            live_signal_count=live_signal_count,
            has_crm=has_crm,
            has_accounting=has_accounting,
            has_email=has_email,
        ) if effective_agent_id == "boardroom" else _build_specificity_fallback(
            profile=profile or {},
            top_concerns=top_brain_concerns,
            coverage_pct=coverage_pct,
            live_signal_count=live_signal_count,
        )
        fallback_trace = {
            "contract_version": CONTRACT_VERSION,
            "phases": [{"phase": "boardroom_orchestration", "status": "error"}],
            "error": str(e)[:240],
        } if effective_agent_id == "boardroom" else None
        fallback_slots = parse_flagship_response_slots(fallback)
        fallback_human = _humanize_contract_response(fallback, fallback_slots)
        retrieval_contract = _build_retrieval_contract(
            report_grade_request=report_grade_request,
            grounded_report_ready=False,
            guardrail_status=guardrail_status,
            has_connected_sources=bool(has_crm or has_accounting or has_email),
            live_signal_count=live_signal_count,
            coverage_window=coverage_window,
            retrieval_depth=retrieval_depth,
            materialization_state=materialization_state,
        )
        forensic_report = _build_forensic_report_payload(
            evidence_pack=evidence_pack,
            boardroom_trace=fallback_trace,
            retrieval_contract=retrieval_contract,
            report_grade_request=bool(report_grade_request or req.forensic_report_mode),
            grounded_report_ready=False,
        )
        capped_confidence = _apply_forensic_confidence_cap(
            raw_confidence=contract_meta.get("confidence_score", 0.2),
            answer_grade=retrieval_contract.get("answer_grade", "DEGRADED"),
            report_grade_request=bool(report_grade_request or req.forensic_report_mode),
            grounded_report_ready=False,
        )
        contract_meta["confidence_score"] = capped_confidence
        error_contract = build_contract_payload(
            tier=tier_for_contract,
            mode_requested=requested_mode,
            mode_effective=mode,
            guardrail=guardrail_status,
            coverage_pct=coverage_pct,
            confidence_score=capped_confidence,
            data_sources_count=contract_meta.get("data_sources_count", 1),
            data_freshness=contract_meta.get("data_freshness", "unknown"),
            connected_sources=(contract_meta.get("lineage") or {}).get("connected_sources", {}),
        )
        return {
            "reply": fallback_human,
            "conversation_id": req.conversation_id,
            "guardrail": guardrail_status,
            "coverage_pct": coverage_pct,
            "coverage_window": coverage_window,
            "incident_or_compliance": incident_or_compliance,
            "explicit_capability_gap": explicit_capability_gap,
            "upsell_allowed": allow_upsell,
            "provider_error": str(e),
            "mode_effective": mode,
            "evidence_pack": evidence_pack,
            "boardroom_trace": fallback_trace,
            "boardroom_status": "fallback_error" if effective_agent_id == "boardroom" else "not_requested",
            "soundboard_contract": error_contract,
            "retrieval_contract": retrieval_contract,
            "forensic_report": forensic_report,
            "advisory_slots": fallback_slots,
            **contract_meta,
        }
    except Exception as e:
        logger.error(f"Soundboard chat error: {e}")
        fallback = _build_boardroom_fallback(
            profile=profile or {},
            coverage_pct=coverage_pct,
            live_signal_count=live_signal_count,
            has_crm=has_crm,
            has_accounting=has_accounting,
            has_email=has_email,
        ) if effective_agent_id == "boardroom" else _build_specificity_fallback(
            profile=profile or {},
            top_concerns=top_brain_concerns,
            coverage_pct=coverage_pct,
            live_signal_count=live_signal_count,
        )
        fallback_trace = {
            "contract_version": CONTRACT_VERSION,
            "phases": [{"phase": "boardroom_orchestration", "status": "error"}],
            "error": str(e)[:240],
        } if effective_agent_id == "boardroom" else None
        fallback_slots = parse_flagship_response_slots(fallback)
        fallback_human = _humanize_contract_response(fallback, fallback_slots)
        retrieval_contract = _build_retrieval_contract(
            report_grade_request=report_grade_request,
            grounded_report_ready=False,
            guardrail_status=guardrail_status,
            has_connected_sources=bool(has_crm or has_accounting or has_email),
            live_signal_count=live_signal_count,
            coverage_window=coverage_window,
            retrieval_depth=retrieval_depth,
            materialization_state=materialization_state,
        )
        forensic_report = _build_forensic_report_payload(
            evidence_pack=evidence_pack,
            boardroom_trace=fallback_trace,
            retrieval_contract=retrieval_contract,
            report_grade_request=bool(report_grade_request or req.forensic_report_mode),
            grounded_report_ready=False,
        )
        capped_confidence = _apply_forensic_confidence_cap(
            raw_confidence=contract_meta.get("confidence_score", 0.2),
            answer_grade=retrieval_contract.get("answer_grade", "DEGRADED"),
            report_grade_request=bool(report_grade_request or req.forensic_report_mode),
            grounded_report_ready=False,
        )
        contract_meta["confidence_score"] = capped_confidence
        error_contract = build_contract_payload(
            tier=tier_for_contract,
            mode_requested=requested_mode,
            mode_effective=mode,
            guardrail=guardrail_status,
            coverage_pct=coverage_pct,
            confidence_score=capped_confidence,
            data_sources_count=contract_meta.get("data_sources_count", 1),
            data_freshness=contract_meta.get("data_freshness", "unknown"),
            connected_sources=(contract_meta.get("lineage") or {}).get("connected_sources", {}),
        )
        return {
            "reply": fallback_human,
            "conversation_id": req.conversation_id,
            "guardrail": guardrail_status,
            "coverage_pct": coverage_pct,
            "coverage_window": coverage_window,
            "incident_or_compliance": incident_or_compliance,
            "explicit_capability_gap": explicit_capability_gap,
            "upsell_allowed": allow_upsell,
            "runtime_error": str(e),
            "mode_effective": mode,
            "evidence_pack": evidence_pack,
            "boardroom_trace": fallback_trace,
            "boardroom_status": "fallback_error" if effective_agent_id == "boardroom" else "not_requested",
            "soundboard_contract": error_contract,
            "retrieval_contract": retrieval_contract,
            "forensic_report": forensic_report,
            "advisory_slots": fallback_slots,
            **contract_meta,
        }


@router.post("/soundboard/chat/stream")
async def soundboard_chat_stream(req: SoundboardChatRequest, current_user: dict = Depends(get_current_user)):
    """
    SSE stream wrapper for Soundboard replies.
    Produces delta events for progressive UI rendering, then a final event with metadata.
    """
    trace_id = str(uuid.uuid4())

    async def event_stream() -> AsyncGenerator[str, None]:
        yield _sse_event("start", {"conversation_id": req.conversation_id, "trace_id": trace_id, "stream_mode": "synthetic"})
        try:
            result = await soundboard_chat(req, current_user)
            for idx, phase in enumerate(((result.get("boardroom_trace") or {}).get("phases") or [])[:6]):
                call_id = f"phase-{idx}"
                yield _sse_event("tool_start", {"call_id": call_id, "name": phase.get("phase") or "boardroom_phase"})
                yield _sse_event(
                    "tool_result",
                    {
                        "call_id": call_id,
                        "name": phase.get("phase") or "boardroom_phase",
                        "ok": str(phase.get("status") or "ok").lower() != "error",
                        "result_preview": f"{phase.get('role') or 'agent'}:{phase.get('status') or 'ok'}",
                    },
                )
            reply = str(result.get("reply") or "")
            if reply:
                chunk_size = 20
                for i in range(0, len(reply), chunk_size):
                    chunk = reply[i : i + chunk_size]
                    yield _sse_event("delta", {"text": chunk})
                    await asyncio.sleep(0.01)
            yield _sse_event("final", {"payload": result})
        except Exception as exc:
            yield _sse_event("error", {"message": str(exc)[:240], "code": "STREAM_RUNTIME_ERROR", "trace_id": trace_id})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.patch("/soundboard/conversations/{conversation_id}")
async def rename_soundboard_conversation(
    conversation_id: str, req: ConversationRename,
    current_user: dict = Depends(get_current_user)
):
    sb = get_sb()
    result = sb.table("soundboard_conversations").update({
        "title": req.title, "updated_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", conversation_id).eq("user_id", current_user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "renamed"}


@router.delete("/soundboard/conversations/{conversation_id}")
async def delete_soundboard_conversation(conversation_id: str, current_user: dict = Depends(get_current_user)):
    sb = get_sb()
    result = sb.table("soundboard_conversations").delete().eq(
        "id", conversation_id
    ).eq("user_id", current_user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "deleted"}


@router.get("/soundboard/proactive-check")
async def proactive_signal_check(current_user: dict = Depends(get_current_user)):
    """
    Polls for new high-priority signals since last check.
    Called by frontend every 3 minutes while user is online.
    Returns proactive insights that Soundboard 'surfaces' unprompted.
    """
    from datetime import timedelta
    sb = get_sb()
    user_id = current_user["id"]
    now = datetime.now(timezone.utc)
    
    insights = []
    
    try:
        # Get latest intelligence snapshot
        snap = sb.table("intelligence_snapshots").select("summary,generated_at").eq(
            "user_id", user_id
        ).order("generated_at", desc=True).limit(1).execute()
        
        if not snap.data:
            return {"has_insight": False, "insights": []}
        
        summary = snap.data[0].get("summary", {})
        if isinstance(summary, str):
            import json as _j
            try:
                summary = _j.loads(summary)
            except Exception:
                summary = {}
        
        snap_age_mins = (now - datetime.fromisoformat(
            snap.data[0]["generated_at"].replace("Z", "+00:00")
        )).total_seconds() / 60
        
        # ── Signal detection rules ──────────────────────────────────────────
        
        # Rule 1: Risk score jumped > 20% from previous check
        resolution_q = summary.get("resolution_queue", [])
        high_priority = [r for r in resolution_q if r.get("severity") in ("critical", "high")]
        if high_priority:
            for item in high_priority[:2]:
                insights.append({
                    "type": "risk",
                    "priority": "high",
                    "title": item.get("title", "Risk detected"),
                    "message": item.get("detail", item.get("recommendation", "")),
                    "action": item.get("recommendation", "Review in Risk Intelligence"),
                    "source": item.get("domain", "BIQc Engine"),
                    "icon": "alert",
                })
        
        # Rule 2: Revenue — stalled deals from HubSpot
        revenue = summary.get("revenue", {})
        deals = revenue.get("deals", [])
        stalled = [d for d in deals if d.get("stall", 0) > 30]
        if stalled:
            deal_names = ", ".join([d.get("name", "Deal") for d in stalled[:2]])
            total_value = sum(float(d.get("value", 0)) for d in stalled)
            insights.append({
                "type": "sales",
                "priority": "high",
                "title": f"{len(stalled)} deal{'s' if len(stalled)>1 else ''} stalled 30+ days",
                "message": f"{deal_names} — total pipeline at risk: ${total_value:.0f}K. No activity in 30+ days.",
                "action": "Review these deals now and send follow-up",
                "source": "HubSpot CRM",
                "icon": "deal",
            })
        
        # Rule 3: Calendar — overloaded this week
        vitals = summary.get("founder_vitals", {})
        calendar = vitals.get("calendar", "")
        if calendar and "above average" in calendar.lower():
            insights.append({
                "type": "people",
                "priority": "medium",
                "title": "Meeting load above average this week",
                "message": calendar,
                "action": "Consider blocking focus time tomorrow morning",
                "source": "Outlook Calendar",
                "icon": "calendar",
            })
        
        # Rule 4: Email stress
        email_stress = vitals.get("email_stress", "")
        if email_stress and "high" in email_stress.lower():
            insights.append({
                "type": "communication",
                "priority": "medium",
                "title": "High email volume detected",
                "message": email_stress,
                "action": "Open Priority Inbox to triage",
                "source": "Outlook",
                "icon": "email",
            })
        
        # Rule 5: Cash / Financial risk
        capital = summary.get("capital", {})
        runway = capital.get("runway")
        if runway and isinstance(runway, (int, float)) and runway < 6:
            insights.append({
                "type": "finance",
                "priority": "critical",
                "title": f"Cash runway below 6 months ({runway} months remaining)",
                "message": capital.get("worst", "Immediate cash flow action required."),
                "action": "Review cash position and accelerate collections",
                "source": "Financial Analysis",
                "icon": "cash",
            })
        
        # Store last check time to avoid surfacing same alerts repeatedly
        sb.table("ai_usage_log").upsert({
            "key": f"{user_id}:proactive_check:last",
            "user_id": user_id,
            "feature": "proactive_check",
            "date": str(now.date()),
            "count": 1,
        }, on_conflict="key").execute()
        
        # Return top 2 most urgent insights
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        insights_sorted = sorted(insights, key=lambda x: priority_order.get(x["priority"], 9))
        
        return {
            "has_insight": len(insights_sorted) > 0,
            "insights": insights_sorted[:2],
            "snapshot_age_mins": round(snap_age_mins),
            "total_signals": len(insights),
        }
        
    except Exception as e:
        logger.error(f"[PROACTIVE_CHECK] Error: {e}")
        return {"has_insight": False, "insights": [], "error": str(e)}


def _build_cognitive_context(req: SoundboardChatRequest, core_context: dict) -> str:
    """Build cognitive context string from intelligence state + core context."""
    parts = []
    intelligence_ctx = req.intelligence_context or {}
    thresholds = intelligence_ctx.get("thresholds", {})
    integrations = intelligence_ctx.get("integrations", {})
    request_scope = intelligence_ctx.get("request_scope", {})

    threshold_met = any([
        thresholds.get("timeConsistency"),
        thresholds.get("crossSourceReinforcement"),
        thresholds.get("behaviouralReinforcement"),
    ])

    parts.append("\n═══ INTELLIGENCE STATE ═══")
    if threshold_met:
        parts.append("Pattern consistency detected. Thresholds met for deeper reasoning.")
        if thresholds.get("timeConsistency"):
            parts.append("- Time consistency: signals held across time")
        if thresholds.get("crossSourceReinforcement"):
            parts.append("- Cross-source: multiple data sources align")
        if thresholds.get("behaviouralReinforcement"):
            parts.append("- Behavioural: user focus has recurred")
        parts.append("\nYou may reason, challenge assumptions, and explore implications.")
    else:
        parts.append("Signal still forming. Lead with analysis using Business DNA data.")

    connected = [k for k, v in integrations.items() if v]
    if connected:
        parts.append(f"\nConnected sources: {', '.join(connected)}")
    if isinstance(request_scope, dict):
        mailbox_scope = request_scope.get("mailbox_scope", {}) or {}
        selected_mailboxes = [k for k, enabled in mailbox_scope.items() if enabled]
        if selected_mailboxes:
            parts.append(f"Mailbox scope requested: {', '.join(selected_mailboxes)}")
        if request_scope.get("wants_integration_analytics"):
            parts.append("Cross-integration analytics requested for this turn.")

    r = core_context.get("reality", {})
    for key, label in [("business_type", "Business type"), ("time_scarcity", "Time availability"), ("cashflow_sensitivity", "Cashflow sensitivity")]:
        if r.get(key) and r[key] != "unknown":
            parts.append(f"{label}: {r[key]}")

    b = core_context.get("behaviour", {})
    if b.get("decision_velocity") and b["decision_velocity"] != "unknown":
        parts.append(f"Decision style: {b['decision_velocity']}")
    if b.get("avoids"):
        parts.append(f"Tends to avoid: {', '.join(b['avoids'][:3])}")
    if b.get("repeated_concerns"):
        parts.append(f"Recurring concerns: {', '.join(b['repeated_concerns'][:3])}")

    d = core_context.get("delivery", {})
    if d.get("style") and d["style"] != "unknown":
        parts.append(f"Prefers {d['style']} communication")

    sf = core_context.get("soundboard_focus", {})
    if sf.get("unresolved_loops"):
        parts.append("\nUNRESOLVED DECISION LOOPS:")
        for loop in sf["unresolved_loops"][:3]:
            parts.append(f"- {loop}")

    h = core_context.get("history", {})
    if h.get("in_stress_period"):
        parts.append("\nUser appears to be in a stress period. Soften tone.")

    return "\n".join(parts)



# ═══════════════════════════════════════════════════════════════
# SCAN USAGE — Supabase-backed server-side enforcement
# ═══════════════════════════════════════════════════════════════

SCAN_COOLDOWN_DAYS = 30
FEATURES = ['exposure_scan', 'forensic_calibration']


class RecordScanRequest(BaseModel):
    feature_name: str  # 'exposure_scan' or 'forensic_calibration'


@router.get("/soundboard/scan-usage")
async def get_scan_usage(current_user: dict = Depends(get_current_user)):
    """
    Returns scan eligibility for this user from Supabase.
    - calibration_complete: bool
    - is_free_tier: bool
    - exposure_scan: { can_run, last_used_at, days_until_next }
    - forensic_calibration: { can_run, last_used_at, days_until_next }
    """
    sb = get_sb()
    user_id = current_user["id"]
    now = datetime.now(timezone.utc)

    # Check calibration status
    calibration_complete = False
    try:
        op = sb.table("user_operator_profile").select("persona_calibration_status").eq("user_id", user_id).execute()
        if op.data and op.data[0].get("persona_calibration_status") == "complete":
            calibration_complete = True
    except Exception:
        pass

    # Check subscription tier
    subscription_tier = "free"
    try:
        u = sb.table("users").select("subscription_tier").eq("id", user_id).execute()
        if u.data:
            subscription_tier = u.data[0].get("subscription_tier") or "free"
    except Exception:
        pass

    tier_rank = {"free": 0, "starter": 1, "professional": 2, "growth": 3, "enterprise": 3, "super_admin": 99}
    is_paid = tier_rank.get(subscription_tier, 0) >= 1

    # Fetch usage records from Supabase
    usage_map = {}
    try:
        result = sb.table("user_feature_usage").select("feature_name, last_used_at, use_count").eq("user_id", user_id).execute()
        for row in (result.data or []):
            usage_map[row["feature_name"]] = row
    except Exception:
        pass

    def feature_status(feature):
        row = usage_map.get(feature)
        if not row or is_paid:
            # Paid users always can run; no prior record = can run
            return {"can_run": True, "last_used_at": row["last_used_at"] if row else None, "days_until_next": 0}
        last_used = datetime.fromisoformat(row["last_used_at"].replace("Z", "+00:00")) if row.get("last_used_at") else None
        if not last_used:
            return {"can_run": True, "last_used_at": None, "days_until_next": 0}
        elapsed_days = (now - last_used).days
        if elapsed_days >= SCAN_COOLDOWN_DAYS:
            return {"can_run": True, "last_used_at": row["last_used_at"], "days_until_next": 0}
        return {
            "can_run": False,
            "last_used_at": row["last_used_at"],
            "days_until_next": SCAN_COOLDOWN_DAYS - elapsed_days,
        }

    return {
        "calibration_complete": calibration_complete,
        "subscription_tier": subscription_tier,
        "is_paid": is_paid,
        "exposure_scan": feature_status("exposure_scan"),
        "forensic_calibration": feature_status("forensic_calibration"),
    }


@router.post("/soundboard/record-scan")
async def record_scan(req: RecordScanRequest, current_user: dict = Depends(get_current_user)):
    """Record a scan being initiated. Upsert into user_feature_usage."""
    if req.feature_name not in FEATURES:
        raise HTTPException(status_code=400, detail=f"Invalid feature. Must be one of: {FEATURES}")
    sb = get_sb()
    user_id = current_user["id"]
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        existing = sb.table("user_feature_usage").select("id, use_count").eq("user_id", user_id).eq("feature_name", req.feature_name).execute()
        if existing.data:
            sb.table("user_feature_usage").update({
                "last_used_at": now_iso,
                "use_count": (existing.data[0].get("use_count") or 0) + 1,
            }).eq("user_id", user_id).eq("feature_name", req.feature_name).execute()
        else:
            sb.table("user_feature_usage").insert({
                "user_id": user_id,
                "feature_name": req.feature_name,
                "last_used_at": now_iso,
                "use_count": 1,
            }).execute()
    except Exception as e:
        logger.warning(f"record_scan failed: {e}")
        return {"status": "error", "detail": str(e)}
    return {"status": "recorded", "feature": req.feature_name, "recorded_at": now_iso}
