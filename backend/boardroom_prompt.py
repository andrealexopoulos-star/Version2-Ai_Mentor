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
You are a human-grade strategic advisor reviewing live business telemetry.
Your job is to state what is happening before the user realises it.

CORE OPERATING RULES (ABSOLUTE):

RULE 1 — SPEAK FROM POSITION, NOT EVENTS
Never describe raw event counts in isolation. Always assert current position with causal reasoning.
Wrong: "An email delay was detected"
Wrong: "176 events were recorded"
Right: "Client communication risk is deteriorating — outbound engagement dropped 40% over the observation window while inbound urgency signals increased, compressing your response capacity."

RULE 2 — ASSERT TRAJECTORY WITH SPECIFICS
If evidence implies an outcome, state it with concrete detail. Reference specific metrics, threshold breaches, pattern progression, and timeline decay. Do not hedge. Do not soften. Do not ask permission.
Wrong: "Your financial position is concerning."
Right: "Cash burn acceleration exceeded baseline by 23% compared to prior 14-day window. Outflows increased while revenue remained flat, compressing margin from 38% to 29%."

RULE 3 — QUESTIONS ARE RESTRICTED
You may ask one question only, and only if:
- Watchtower state conflicts with user intent, or
- A decision hinge exists.
Questions must resolve authority, not gather information.

RULE 4 — SILENCE IS VALID
If all positions are STABLE: Say nothing speculative. Do not fill space. Do not prompt activity.

INITIAL BRIEFING FORMAT:
For the first response in a conversation (no prior exchange), use this compressed structure:

[Position] — Domain + state + why it reached this classification.
[Evidence] — Signal origin, pattern recognition, threshold breach, severity classification logic. Reference specific Watchtower data.
[Trajectory] — What becomes inevitable if unchanged. Include timeline decay, compounding effects, and second-order consequences.
[Decision Window] — Time remaining + what narrows if the window closes.

FOLLOW-UP PROTOCOL (WHEN PRIOR EXCHANGE EXISTS):
When the operator asks follow-up questions, you MUST adapt your response to their specific request.
Do NOT repeat the initial briefing template. Instead:

- If they ask "why" something became critical → Provide causal chain analysis. Reference prior reasoning. Introduce second-order effects. Explain what specific signal patterns tipped the classification.
- If they ask "what happens if we ignore this" → Model the consequence trajectory. Mention timeline decay, compounding effects, reputational/financial/operational impact. Offer decision framing.
- If they ask for resolution pathways → Provide structured decision options ranked by the requested criteria. Mention trade-offs, execution difficulty, and timeline. Maintain human strategic advisor tone.
- If they ask for clarification → Build deeper analysis. Do NOT restate what was already said. Reference prior reasoning and add layers of insight.

When following up, you must:
- Reference specific metrics or patterns from Watchtower data
- Explain timeline progression
- Avoid generic advisory language
- Avoid dashboard-style summaries
- Deliver executive-grade compression with human reasoning tone

You must read like a human strategic advisor — not a monitoring dashboard, not a generic AI chat tool, not a SaaS dashboard tooltip.

COGNITIVE DEPTH REQUIREMENTS:
Every response MUST include:
- Signal origin (where the data came from)
- Pattern recognition (what pattern was detected)
- Threshold breach explanation (why this crossed from normal to elevated/critical)
- Severity classification logic (why this severity, not a lower one)

EXECUTIVE OUTPUT CONTRACT (MANDATORY):
Every response must make these four outcomes explicit, even when compressed:
- WHY VISIBLE: Why BIQc surfaced this now (grounded in telemetry)
- WHY NOW: What changed in trend/threshold/trajectory
- NEXT ACTION: Specific owner-ready action to execute this cycle
- IF IGNORED: The likely compounding consequence and timeline direction

When data exists, include an evidence chain with source, signal type, severity, and timestamp.
Do not produce generic leadership platitudes or motivational filler.

FAILURE CONDITIONS:
If you find yourself:
- Repeating the same template without adding depth
- Using generic SaaS phrasing like "Your position is concerning"
- Providing dashboard-style summaries without causal reasoning
- Failing to reference specific data when it exists
- Refusing to provide resolution pathways when explicitly requested
→ STOP. Reload Watchtower state. Reconstruct your response with human-grade reasoning.

BIQC does not predict the future. BIQC detects when the future has already begun
and humans haven't accepted it yet. That is the system's edge."""


def build_boardroom_prompt(
    watchtower_positions: Dict[str, Any],
    watchtower_findings: List[Dict[str, Any]],
    intelligence_config: Optional[Dict[str, Any]],
    calibration: Optional[Dict[str, Any]],
    escalation_history: Optional[List[Dict[str, Any]]] = None,
    contradictions: Optional[List[Dict[str, Any]]] = None,
    pressure: Optional[Dict[str, Any]] = None,
    freshness: Optional[Dict[str, Any]] = None,
    recent_signals: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """
    Build the full Board Room system prompt with context injected
    in strict priority order. Tries DB prompt first, falls back to hardcoded.
    """
    # Try DB prompt for boardroom identity
    try:
        from prompt_registry import get_prompt
        import asyncio
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # We're in an async context — can't await here (sync function)
            # Use the cached version if available
            from prompt_registry import _cache
            db_identity = _cache.get("boardroom_identity_v1")
        else:
            db_identity = None
    except Exception:
        db_identity = None
    
    identity = db_identity if db_identity else BOARDROOM_IDENTITY
    sections = [identity]

    # ─── 1. WATCHTOWER STATE (highest priority) ──────────────
    sections.append(_build_watchtower_section(watchtower_positions, watchtower_findings))

    # ─── 1.3. RAW SIGNAL TELEMETRY ───────────────────────────
    sections.append(_build_signals_section(recent_signals))

    # ─── 1.5. ESCALATION MEMORY ──────────────────────────────
    sections.append(_build_escalation_section(escalation_history))

    # ─── 1.6. CONTRADICTIONS ─────────────────────────────────
    sections.append(_build_contradiction_section(contradictions))

    # ─── 1.7. DECISION PRESSURE ──────────────────────────────
    sections.append(_build_pressure_section(pressure))

    # ─── 1.8. EVIDENCE FRESHNESS ─────────────────────────────
    sections.append(_build_freshness_section(freshness))

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


def _build_signals_section(signals: Optional[List[Dict[str, Any]]]) -> str:
    lines = ["═══ RAW SIGNAL TELEMETRY (USE FOR CAUSAL REASONING) ═══"]

    if not signals:
        lines.append("No recent signals available.")
        return "\n".join(lines)

    lines.append("These are the most recent observation events from connected systems.")
    lines.append("Use these to ground your reasoning in specific, real data points.")
    lines.append("Reference signal sources, event types, and severity when explaining causality.")
    lines.append("")

    # Group by domain for structured analysis
    domain_signals = {}
    for s in signals:
        d = s.get("domain", "unknown")
        if d not in domain_signals:
            domain_signals[d] = {"critical": 0, "warning": 0, "info": 0, "sources": set(), "types": set(), "latest": None}
        sev = s.get("severity", "info")
        domain_signals[d][sev] = domain_signals[d].get(sev, 0) + 1
        domain_signals[d]["sources"].add(s.get("source", "unknown"))
        domain_signals[d]["types"].add(s.get("event_type", "unknown"))
        if not domain_signals[d]["latest"]:
            domain_signals[d]["latest"] = s.get("created_at", "")

    for domain, data in domain_signals.items():
        total = data["critical"] + data["warning"] + data["info"]
        lines.append(f"{domain.upper()}: {total} recent signals")
        lines.append(f"  Severity breakdown: critical={data['critical']}, warning={data['warning']}, info={data['info']}")
        lines.append(f"  Signal sources: {', '.join(data['sources'])}")
        lines.append(f"  Event types: {', '.join(data['types'])}")
        lines.append(f"  Latest signal: {(data['latest'] or '')[:16]}")
        if data['critical'] > data['info'] + data['warning']:
            lines.append("  PATTERN: Critical signals dominate — systematic failure pattern, not isolated incidents.")
        lines.append("")

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


def _build_contradiction_section(contradictions: Optional[List[Dict[str, Any]]]) -> str:
    lines = ["═══ CONTRADICTIONS (EVIDENCE-BASED MISALIGNMENT) ═══"]

    if not contradictions:
        lines.append("No contradictions detected.")
        return "\n".join(lines)

    lines.append("These are factual misalignments between declared intent and observed behaviour.")
    lines.append("Use to increase pressure and shorten decision windows. Do NOT infer motivation.")
    lines.append("")

    type_labels = {
        "priority_mismatch": "PRIORITY MISMATCH — declared important but unaddressed",
        "action_inaction": "ACTION vs INACTION — deferred or ignored despite worsening state",
        "repeated_ignore": "REPEATED IGNORE — escalated multiple times without resolution",
    }

    for c in contradictions:
        domain = c.get("domain", "").upper()
        ctype = c.get("contradiction_type", "")
        label = type_labels.get(ctype, ctype)
        times = c.get("times_detected", 1)
        first = (c.get("first_detected_at") or "")[:16]
        declared = c.get("declared_priority", "")
        observed = c.get("observed_state", "")

        lines.append(f"{domain}: {label}")
        lines.append(f"  Declared: {declared}")
        lines.append(f"  Observed: {observed}")
        lines.append(f"  Times detected: {times}x (since {first})")
        lines.append("")

    return "\n".join(lines)


def _build_pressure_section(pressure: Optional[Dict[str, Any]]) -> str:
    lines = ["═══ DECISION PRESSURE (EVIDENCE-BASED) ═══"]

    if not pressure:
        lines.append("No active decision pressure.")
        return "\n".join(lines)

    lines.append("Pressure is earned through persistence, not tone.")
    lines.append("At HIGH/CRITICAL: shorten responses, remove optional framing, state narrowing choices.")
    lines.append("")

    for domain, data in pressure.items():
        level = data.get("pressure_level", "LOW")
        basis = data.get("basis") or {}
        window = basis.get("window_days_remaining")
        first = (data.get("first_applied_at") or "")[:16]

        lines.append(f"{domain.upper()}: {level}")
        lines.append(f"  Since: {first}")

        if window is not None:
            lines.append(f"  Decision window: {window} days remaining")

        if level == "HIGH":
            lines.append("  DIRECTIVE: Remove optional framing. State choices directly.")
        elif level == "CRITICAL":
            lines.append("  DIRECTIVE: Maximum brevity. One sentence per section. No hedging.")

        lines.append("")

    return "\n".join(lines)


def _build_freshness_section(freshness: Optional[Dict[str, Any]]) -> str:
    lines = ["═══ EVIDENCE FRESHNESS (CERTAINTY GOVERNANCE) ═══"]

    if not freshness:
        lines.append("No freshness data. Treat all positions with standard confidence.")
        return "\n".join(lines)

    lines.append("Confidence is earned and maintained. Stale evidence reduces certainty.")
    lines.append("")

    for domain, data in freshness.items():
        state = data.get("confidence_state", "FRESH")
        conf = data.get("current_confidence", 0)
        last = (data.get("last_evidence_at") or "")[:16]

        lines.append(f"{domain.upper()}: {state} (confidence: {conf})")
        lines.append(f"  Last evidence: {last}")

        if state == "AGING":
            lines.append("  DIRECTIVE: Soften certainty language. Qualify assertions.")
        elif state == "STALE":
            lines.append("  DIRECTIVE: State explicitly that evidence is outdated. Do NOT assert with confidence.")
            lines.append("  DIRECTIVE: Do NOT escalate pressure on stale evidence.")

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
