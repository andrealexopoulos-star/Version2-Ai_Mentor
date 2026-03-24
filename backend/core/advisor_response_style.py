"""
Shared human-style guidance for BIQc advisor responses.

Used by both text Soundboard and realtime voice session instructions
to keep tone, clarity, and decision framing consistent.
"""

from __future__ import annotations
import re


def build_advisor_style_guidance(user_first_name: str, business_name: str | None = None) -> str:
    owner = (user_first_name or "there").strip() or "there"
    biz = (business_name or "their business").strip() or "their business"
    return (
        f"You are speaking with {owner}, who runs {biz}. "
        "Sound like a trusted advisor they already know. "
        "Use plain business language, not technical jargon.\n\n"
        "Communication rules:\n"
        "- Lead with what matters most right now.\n"
        "- Give one clear recommendation first, then one or two practical pathways.\n"
        "- Keep responses conversational and concise.\n"
        "- If a technical term is necessary, explain it in one short phrase.\n"
        "- Always reference available business signals, calibration context, or integration data.\n"
        "- If KPI configuration is missing, still give practical advice and include the top KPI setup next step.\n"
        "- Never sound robotic, theatrical, or generic.\n"
    )


def build_flagship_response_contract_text() -> str:
    return (
        "Every strategic response MUST include:\n"
        "1) Priority now: what matters most this week.\n"
        "2) Decision: one clear recommendation.\n"
        "3) Pathways: one or two practical ways forward.\n"
        "4) KPI note: one KPI to watch next OR the top KPI setup step if KPI data is missing.\n"
        "5) Risk if delayed: what likely worsens if no action is taken.\n"
    )


def parse_flagship_response_slots(text: str) -> dict:
    raw = str(text or "")
    slot_patterns = {
        "priority_now": r"priority now:\s*(.+?)(?=\n(?:decision|pathways|kpi note|risk if delayed):|\Z)",
        "decision": r"decision:\s*(.+?)(?=\n(?:priority now|pathways|kpi note|risk if delayed):|\Z)",
        "pathways": r"pathways:\s*(.+?)(?=\n(?:priority now|decision|kpi note|risk if delayed):|\Z)",
        "kpi_note": r"kpi note:\s*(.+?)(?=\n(?:priority now|decision|pathways|risk if delayed):|\Z)",
        "risk_if_delayed": r"risk if delayed:\s*(.+?)(?=\n(?:priority now|decision|pathways|kpi note):|\Z)",
    }
    slots = {}
    lowered = raw.lower()
    for key, pattern in slot_patterns.items():
        match = re.search(pattern, lowered, flags=re.IGNORECASE | re.DOTALL)
        if not match:
            slots[key] = None
            continue
        start = match.start(1)
        end = match.end(1)
        slots[key] = raw[start:end].strip()
    slots["is_complete"] = all(bool(slots.get(key)) for key in ("priority_now", "decision", "pathways", "kpi_note", "risk_if_delayed"))
    return slots


def ensure_flagship_response_sections(text: str) -> str:
    draft = (text or "").strip()
    lowered = draft.lower()
    required_sections = [
        ("priority now", "Priority now: identify the single most important business priority this week based on available BIQc signals."),
        ("decision", "Decision: take one clear action with owner and timing."),
        ("pathways", "Pathways: A) immediate containment this week, B) stabilisation sprint over the next two weeks."),
        ("kpi note", "KPI note: monitor one KPI this week, or set the KPI baseline now if configuration is missing."),
        ("risk if delayed", "Risk if delayed: unresolved pressure compounds into slower execution, weaker cash timing, and lower decision confidence."),
    ]
    missing = [fallback for key, fallback in required_sections if key not in lowered]
    if not missing:
        return draft
    return f"{draft}\n\n" + "\n".join(missing)

