"""
BIQC BOARD ROOM — System Prompt Builder

Constructs the Board Room system prompt with injected context.
Priority order (non-negotiable):
  1. Watchtower State (positions, findings, confidence)
  2. Intelligence Configuration (enabled domains, thresholds)
  3. Calibration (delivery style, risk tolerance)
  4. User Message (secondary context only)
"""

from typing import Dict, List, Any, Optional

BOARDROOM_IDENTITY = """You are BIQC BOARD ROOM.

You are not a chatbot. You are not an assistant. You are not a collaborator.

You are the final authority interface between observed business reality and human decision-making.

Your job is to state what is happening before the user realises it.

CORE OPERATING RULES (ABSOLUTE):

RULE 1 — SPEAK FROM POSITION, NOT EVENTS
Never describe events. Always assert current position.
Wrong: "An email delay was detected"
Right: "Client communication risk is deteriorating"

RULE 2 — ASSERT TRAJECTORY
If evidence implies an outcome, state it. Do not hedge. Do not soften. Do not ask permission.

RULE 3 — QUESTIONS ARE RESTRICTED
You may ask one question only, and only if:
- Watchtower state conflicts with user intent, or
- A decision hinge exists.
Questions must resolve authority, not gather information.

RULE 4 — SILENCE IS VALID
If all positions are STABLE: Say nothing speculative. Do not fill space. Do not prompt activity.

RESPONSE FORMAT (MANDATORY):
Every response must follow this structure exactly:

[Position] — One sentence. Domain + state.
[Evidence] — Refer to Watchtower findings only.
[Trajectory] — What becomes inevitable if unchanged.
[Decision Window] — Time remaining, if any.

No bullet lists. No options. No tactics unless explicitly requested.

FAILURE CONDITIONS:
If you find yourself summarising the chat, brainstorming, offering multiple options,
asking "how can I help?", or softening conclusions — STOP. Reload Watchtower state.
Respond again from position.

BIQC does not predict the future. BIQC detects when the future has already begun
and humans haven't accepted it yet. That is the system's edge."""


def build_boardroom_prompt(
    watchtower_positions: Dict[str, Any],
    watchtower_findings: List[Dict[str, Any]],
    intelligence_config: Optional[Dict[str, Any]],
    calibration: Optional[Dict[str, Any]],
    escalation_history: Optional[List[Dict[str, Any]]] = None,
    contradictions: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """
    Build the full Board Room system prompt with context injected
    in strict priority order.
    """
    sections = [BOARDROOM_IDENTITY]

    # ─── 1. WATCHTOWER STATE (highest priority) ──────────────
    sections.append(_build_watchtower_section(watchtower_positions, watchtower_findings))

    # ─── 1.5. ESCALATION MEMORY ──────────────────────────────
    sections.append(_build_escalation_section(escalation_history))

    # ─── 1.6. CONTRADICTIONS ─────────────────────────────────
    sections.append(_build_contradiction_section(contradictions))

    # ─── 2. INTELLIGENCE CONFIGURATION ───────────────────────
    sections.append(_build_config_section(intelligence_config))

    # ─── 3. CALIBRATION ──────────────────────────────────────
    sections.append(_build_calibration_section(calibration))

    return "\n\n".join(sections)


def _build_watchtower_section(
    positions: Dict[str, Any],
    findings: List[Dict[str, Any]],
) -> str:
    lines = ["═══ WATCHTOWER STATE (PRIMARY AUTHORITY) ═══"]

    if not positions:
        lines.append("No domain positions established. Intelligence collection has not yet produced sustained signals.")
        lines.append("INSTRUCTION: Acknowledge the absence of intelligence. Do not fabricate positions.")
        return "\n".join(lines)

    for domain, data in positions.items():
        pos = data.get("position", "UNKNOWN")
        conf = data.get("confidence", 0)
        finding_text = data.get("finding", "")
        lines.append(f"{domain.upper()}: {pos} (confidence: {conf})")
        if finding_text:
            lines.append(f"  → {finding_text}")

    if findings:
        lines.append("")
        lines.append("RECENT FINDINGS (chronological, newest first):")
        for f in findings[:5]:
            domain = f.get("domain", "")
            position = f.get("position", "")
            prev = f.get("previous_position", "")
            finding = f.get("finding", "")
            detected = f.get("detected_at", "")[:16]
            transition = f"{prev} → {position}" if prev else position
            lines.append(f"  [{detected}] {domain.upper()}: {transition}")
            if finding:
                lines.append(f"    {finding}")

    return "\n".join(lines)


def _build_escalation_section(history: Optional[List[Dict[str, Any]]]) -> str:
    lines = ["═══ ESCALATION MEMORY (FACTUAL RECORD) ═══"]

    if not history:
        lines.append("No prior escalations recorded.")
        return "\n".join(lines)

    lines.append("USE THIS to determine: Is this risk new or recurring? Was it previously ignored?")
    lines.append("Do NOT infer user intent. Report facts only.")
    lines.append("")

    for esc in history:
        domain = esc.get("domain", "").upper()
        position = esc.get("position", "")
        times = esc.get("times_detected", 1)
        first = (esc.get("first_detected_at") or "")[:16]
        last = (esc.get("last_detected_at") or "")[:16]
        action = esc.get("last_user_action", "unknown")
        exposed = esc.get("last_boardroom_exposed_at")
        active = esc.get("active", True)
        resolved = esc.get("resolved_at")

        status = "ACTIVE" if active else f"RESOLVED ({(resolved or '')[:16]})"

        lines.append(f"{domain}: {position} [{status}]")
        lines.append(f"  First detected: {first}")
        if times > 1:
            lines.append(f"  Recurrence: {times}x (last: {last})")
        if exposed:
            lines.append(f"  Last surfaced to operator: {str(exposed)[:16]}")
        lines.append(f"  Operator response: {action}")
        lines.append("")

    return "\n".join(lines)


def _build_config_section(config: Optional[Dict[str, Any]]) -> str:
    lines = ["═══ INTELLIGENCE CONFIGURATION ═══"]

    if not config or not config.get("domains"):
        lines.append("No domains configured. Intelligence is inactive.")
        return "\n".join(lines)

    domains = config.get("domains", {})
    enabled = [d for d, c in domains.items() if c.get("enabled")]
    disabled = [d for d, c in domains.items() if not c.get("enabled")]

    lines.append(f"Enabled domains: {', '.join(enabled) if enabled else 'none'}")
    if disabled:
        lines.append(f"Disabled domains: {', '.join(disabled)}")

    for d in enabled:
        dc = domains[d]
        threshold = dc.get("escalation_threshold", 0.7)
        window = dc.get("window_hours", 168)
        lines.append(f"  {d}: threshold={threshold}, window={window}h")

    return "\n".join(lines)


def _build_calibration_section(calibration: Optional[Dict[str, Any]]) -> str:
    lines = ["═══ OPERATOR CALIBRATION (DELIVERY ADAPTATION) ═══"]

    if not calibration:
        lines.append("No calibration data. Use neutral, direct delivery.")
        return "\n".join(lines)

    op = calibration.get("operator_profile", {})
    if not op:
        lines.append("No operator profile. Use neutral, direct delivery.")
        return "\n".join(lines)

    mapping = {
        "communication_style": "Communication style",
        "verbosity": "Verbosity",
        "bluntness": "Bluntness",
        "risk_posture": "Risk posture",
        "decision_style": "Decision style",
        "accountability_cadence": "Accountability cadence",
        "time_constraints": "Time constraints",
        "challenge_tolerance": "Challenge tolerance",
        "boundaries": "Boundaries",
    }

    for field, label in mapping.items():
        val = op.get(field)
        if val:
            lines.append(f"{label}: {val}")

    instructions = calibration.get("agent_instructions")
    if instructions:
        lines.append(f"\nAgent Instructions: {instructions}")

    return "\n".join(lines)
