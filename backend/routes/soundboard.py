"""
MySoundBoard Routes — Thinking Partner
Extracted from server.py. Prompts loaded from Supabase system_prompts table.
Instrumented with Intelligence Spine LLM logging.
"""
from fastapi import APIRouter, Depends, HTTPException
import asyncio
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import uuid
import logging
import os

from core.llm_router import llm_chat, llm_chat_with_usage
from routes.deps import get_current_user, get_sb, OPENAI_KEY, AI_MODEL, logger
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
        "Situation: I am using your connected BIQc telemetry to provide this summary.",
        f"Connected systems: {', '.join(connected) if connected else 'integration visibility limited in this turn'}.",
        f"Live signals observed: {len(obs_events or [])}.",
    ]
    if top_signals:
        lines.append("Top signals:\n" + "\n".join(top_signals))

    lines.append("Decision: Prioritise one cross-functional containment action across revenue, execution cadence, and client response latency this week.")
    lines.append(
        "This week:\n"
        f"- Revenue checkpoint: pipeline ${pipeline_total:,.0f}, stalled deals {stalled_deals}.\n"
        f"- Cash checkpoint: overdue invoices ${overdue_total:,.0f}.\n"
        f"- Risk checkpoint: overall risk {risk_level}."
        + (f"\n- Workforce checkpoint: capacity {capacity if capacity is not None else 'unknown'} / fatigue {fatigue if fatigue is not None else 'unknown'}." if (capacity is not None or fatigue is not None) else "")
    )
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
        f"Situation: For {business_name} in {industry}, BIQc has enough evidence to isolate one immediate decision area: {issue}. "
        f"Coverage is {coverage_pct}% with {live_signal_count} live signals in this cycle.\n\n"
        f"Decision: Execute this now — {action}.\n\n"
        f"This week: Assign one owner, lock a deadline, and review measurable movement within 48 hours. "
        f"Current evidence footprint: {source_count} source stream(s), freshness {freshness}.\n\n"
        f"Risk if delayed: {risk}."
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
            "engine": "soundboard_v2",
            "coverage_pct": coverage_pct,
            "live_signals_count": live_signal_count,
            "connected_sources": {
                "crm": has_crm,
                "accounting": has_accounting,
                "email": has_email,
            },
            "top_concern_ids": [c.get("concern_id") for c in (top_concerns or []) if isinstance(c, dict)],
        },
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

1. SITUATION: What is happening? Use specific numbers, names, or entity names from the data.
2. ANALYSIS: What drives it? Reference specific metrics or patterns and their sources.
3. RECOMMENDATION: One clear, concrete action with quantified impact where possible.
4. THIS WEEK: One actionable next step with who/what/by-when.
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
    for message in (messages_history or [])[-12:]:
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


async def _call_gemini_with_fallback(api_key: str, system_message: str, clean_message: str, model_candidates: List[str]) -> tuple[str, str]:
    import httpx as _httpx

    if not _has_configured_key(api_key):
        raise RuntimeError("GOOGLE_API_KEY is not configured. Add a valid Google AI key to restore Gemini-powered Soundboard replies.")

    last_error = None
    async with _httpx.AsyncClient(timeout=30) as client:
        for candidate in model_candidates:
            try:
                gemini_model = candidate.replace("-preview", "")
                response = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent",
                    params={"key": api_key},
                    json={
                        "contents": [{"parts": [{"text": f"{system_message}\n\n{clean_message}"}]}],
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


async def _call_anthropic_with_fallback(api_key: str, system_message: str, clean_message: str, model_candidates: List[str]) -> tuple[str, str]:
    import httpx as _httpx

    if not _has_configured_key(api_key):
        raise RuntimeError("ANTHROPIC_API_KEY is not configured. Add a valid Anthropic key to enable Trinity reasoning.")

    payload_base = {
        "temperature": 0.45,
        "max_tokens": 1800,
        "system": system_message,
        "messages": [{"role": "user", "content": clean_message}],
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
            model_candidates=["gemini-3-pro-preview", "gemini-2.5-pro", "gemini-2.0-flash"],
        ))

    if has_anthropic:
        parallel_tasks.append(_call_anthropic_with_fallback(
            api_key=anthropic_key,
            system_message=system_message,
            clean_message=clean_message,
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
            ).eq("conversation_id", conversation["id"]).eq("user_id", user_id).order("timestamp", desc=True).limit(20).execute()
            history_rows = list(reversed(history_result.data or []))
            messages_history = [{"role": row.get("role"), "content": row.get("content")} for row in history_rows]
        except Exception:
            # Backward compatibility when soundboard_messages table is unavailable.
            messages_history = (conversation.get("messages", [])[-20:]) if isinstance(conversation.get("messages"), list) else []

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

    # Keep legacy context_fields for logging compatibility
    context_fields = sum(1 for f in ['business_name', 'industry', 'revenue_range', 'team_size', 'main_challenges', 'short_term_goals'] if profile and profile.get(f) and str(profile.get(f)) not in ('None', ''))

    # Live signal freshness check
    live_signal_count = 0
    live_signal_age_hours = None
    try:
        obs_result = sb.table('observation_events').select('observed_at', count='exact').eq('user_id', user_id).order('observed_at', desc=True).limit(1).execute()
        live_signal_count = obs_result.count or 0
        if obs_result.data:
            last_obs = datetime.fromisoformat(obs_result.data[0]['observed_at'].replace('Z', '+00:00'))
            live_signal_age_hours = round((datetime.now(timezone.utc) - last_obs).total_seconds() / 3600, 1)
    except Exception:
        pass

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

    # FIRST: Inject observation_events (cached signals from emission layer)
    try:
        obs_result = sb.table('observation_events').select(
            'signal_name,domain,severity,entity,metric,observed_at'
        ).eq('user_id', user_id).order('observed_at', desc=True).limit(30).execute()

        obs_events = obs_result.data or []
        if obs_events:
            integration_context += f"\n═══ YOUR LIVE BUSINESS SIGNALS ({len(obs_events)} detected) ═══\n"
            integration_context += "IMPORTANT: These are REAL signals from the user's connected CRM and accounting systems. You MUST reference these specific signals in your response. Do NOT say you don't have access to their data.\n\n"

            for evt in obs_events[:15]:
                entity = evt.get('entity', {})
                if isinstance(entity, str):
                    try:
                        import json as _json
                        entity = _json.loads(entity)
                    except Exception:
                        entity = {}
                metric = evt.get('metric', {})
                if isinstance(metric, str):
                    try:
                        metric = _json.loads(metric)
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
        
        # Integration status
        connected_list = [k for k, v in {'CRM': all_data['crm']['connected'], 'Accounting': all_data['accounting']['connected'], 'Email': all_data['email']['connected'], 'Marketing': all_data['marketing']['connected']}.items() if v]
        disconnected_list = [k for k, v in {'CRM': all_data['crm']['connected'], 'Accounting': all_data['accounting']['connected'], 'Email': all_data['email']['connected']}.items() if not v]
        
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

    # ═══ PERSONALIZATION GUARDRAIL: Block generic advice ═══
    if guardrail_status == "BLOCKED":
        # Build actionable list of critical missing fields
        critical_missing = [f for f in missing_fields if f["critical"]][:5]
        missing_list = ", ".join(f["label"] for f in critical_missing) if critical_missing else "business profile fields"
        logger.warning(f"[GUARDRAIL_BLOCKED] user={user_id[:8]} coverage={coverage_pct}% missing_critical={len(missing_critical)}")
        return {
            "reply": f"I need a bit more context about your business before I can give you specific advice. I'm currently working with {coverage_pct}% data coverage — not enough to deliver accurate guidance.\n\nTo unlock personalised intelligence, please complete: {missing_list}. It takes about 3 minutes and makes every response significantly more useful.",
            "guardrail": "BLOCKED",
            "coverage_pct": coverage_pct,
            "missing_fields": [{"key": f["key"], "label": f["label"], "path": f["path"], "critical": f["critical"]} for f in missing_fields[:8]],
            "context_fields": context_fields,
            "live_signals": live_signal_count,
            "conversation_id": req.conversation_id,
            **contract_meta,
        }

    # P1: Signal freshness injection
    signal_injection = ""
    if live_signal_count > 0:
        signal_injection = f"\n\n═══ LIVE SIGNAL STATUS ═══\nActive observation signals: {live_signal_count}\nLast signal: {live_signal_age_hours}h ago\nUSE THESE to ground your advice.\n"

    # P1: Response contract enforcement
    contract_injection = "\n\n═══ RESPONSE CONTRACT (MANDATORY) ═══\nEvery strategic response MUST include:\n1) SITUATION: What is happening? Use specific numbers or entity names from the data above.\n2) DECISION: One clear recommendation.\n3) THIS WEEK: One concrete action with who/what/by-when.\n4) RISK IF DELAYED: What happens if they don't act? Quantify.\nDo NOT output generic strategy. Every sentence must reference THIS business.\nDATA ATTRIBUTION: When referencing a fact, state its source inline — e.g. 'Based on your calibration data...' or 'Your HubSpot pipeline shows...' or 'From your Xero invoices...'. Never state a fact without its source.\n"
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

    system_message = soundboard_prompt + fact_block + biz_context + cognition_context + rag_context + memory_context + integration_context + marketing_context + actions_context + signal_injection + guardrail_injection + contract_injection + f"\n\nCONTEXT:\n{user_context}"

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
    mode = getattr(req, 'mode', 'auto')
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

    # Step 1: Intent classification with o4-mini (fast thinking, direct OpenAI key)
    intent_domain, intent_action, complexity = _infer_intent_heuristic(req.message)
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
    effective_agent_id = agent_id if (agent_id and agent_id != "auto") else intent_domain
    effective_agent = SOUNDBOARD_AGENTS.get(effective_agent_id) or SOUNDBOARD_AGENTS["general"]
    effective_agent_name = effective_agent.get("name", "Strategic Advisor")

    # Step 2/3: Route + Generate response
    try:
        import time as _time
        _start = _time.time()

        if mode == "trinity":
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
            response = _build_specificity_fallback(
                profile=profile or {},
                top_concerns=top_brain_concerns,
                coverage_pct=coverage_pct,
                live_signal_count=live_signal_count,
            )
            response = sanitise_output(response)

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
            {"role": "assistant", "content": response, "timestamp": now}
        ]

        # Save to Supabase (conversation header + message rows)
        if req.conversation_id and conversation:
            conversation_id = req.conversation_id
            sb.table("soundboard_conversations").update({
                "updated_at": now,
            }).eq("id", conversation_id).eq("user_id", user_id).execute()
        else:
            conversation_id = str(uuid.uuid4())
            conv_insert = sb.table("soundboard_conversations").insert({
                "id": conversation_id,
                "user_id": user_id,
                "title": conversation_title or "New Conversation",
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
            suggested_actions.append({"label": "Draft overdue invoice reminders", "action": "draft_invoice_reminders"})
            suggested_actions.append({"label": "Generate cash flow forecast", "action": "generate_cashflow_forecast"})
        elif intent_domain == "sales" and has_crm:
            suggested_actions.append({"label": "Flag stalled deals in HubSpot", "action": "flag_stalled_deals"})
            suggested_actions.append({"label": "Draft follow-up email for top deal", "action": "draft_deal_followup"})
        elif intent_domain == "marketing":
            suggested_actions.append({"label": "Run competitive benchmark", "action": "run_benchmark"})
            suggested_actions.append({"label": "Generate campaign performance summary", "action": "generate_campaign_summary"})
        elif intent_domain == "risk":
            suggested_actions.append({"label": "Generate risk report PDF", "action": "generate_risk_report"})
        elif intent_domain == "hr":
            suggested_actions.append({"label": "Generate SOP for this process", "action": "generate_sop"})
        if mailbox_requested:
            suggested_actions.append({"label": "Summarise Inbox/Sent/Deleted deltas", "action": "summarise_mailbox_deltas"})
            suggested_actions.append({"label": "Create owner response triage list", "action": "generate_response_triage"})
        if wants_integration_analytics:
            suggested_actions.append({"label": "Run cross-integration variance check", "action": "cross_integration_variance"})
            suggested_actions.append({"label": "Generate Merge analytics memo", "action": "merge_analytics_memo"})

        execution_id = str(uuid.uuid4())[:8] if suggested_actions else None

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
            "guardrail": guardrail_status,
            "coverage_pct": coverage_pct,
            "missing_fields": [{"key": f["key"], "label": f["label"], "path": f["path"], "critical": f["critical"]} for f in missing_fields[:6]] if guardrail_status == "DEGRADED" else [],
            **contract_meta,
        }

    except RuntimeError as e:
        logger.error(f"Soundboard provider error: {e}")
        fallback = _build_specificity_fallback(
            profile=profile or {},
            top_concerns=top_brain_concerns,
            coverage_pct=coverage_pct,
            live_signal_count=live_signal_count,
        )
        return {
            "reply": fallback,
            "conversation_id": req.conversation_id,
            "guardrail": guardrail_status,
            "coverage_pct": coverage_pct,
            "provider_error": str(e),
            **contract_meta,
        }
    except Exception as e:
        logger.error(f"Soundboard chat error: {e}")
        fallback = _build_specificity_fallback(
            profile=profile or {},
            top_concerns=top_brain_concerns,
            coverage_pct=coverage_pct,
            live_signal_count=live_signal_count,
        )
        return {
            "reply": fallback,
            "conversation_id": req.conversation_id,
            "guardrail": guardrail_status,
            "coverage_pct": coverage_pct,
            "runtime_error": str(e),
            **contract_meta,
        }


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
