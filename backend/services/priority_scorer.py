"""
Priority scorer for the Advisor "2 things to act on" headline.

Sprint B #15 (2026-04-22) — replaces the boolean-sum `urgentCount` on
Advisor.js that collapsed to a count of 0..3 regardless of actual risk.

Takes the `candidate_signals` list already assembled in
`/advisor/executive-surface` and returns the top-N items by a real
risk score:

    risk_score = severity_weight * recency_weight * evidence_weight
                 + action_feasibility_boost

- Severity:  critical=4 | high=3 | warn|warning=2 | info=1
- Recency:   <6h=1.5 | <24h=1.2 | <72h=1.0 | else=0.7
- Evidence:  signal.get("confidence") if present else 1.0
- Feasibility boost: +0.5 when the signal_key maps to a known playbook
  (i.e. we have a concrete, named action pattern in the card already).

Pure function — no I/O, no supabase — so it is unit-testable without
spinning up FastAPI.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Weights
# ---------------------------------------------------------------------------
SEVERITY_WEIGHTS: Dict[str, float] = {
    "critical": 4.0,
    "high": 3.0,
    "warn": 2.0,
    "warning": 2.0,
    "info": 1.0,
}

# signal_keys that already have an owner-facing action_summary + playbook
# pattern in the executive-surface endpoint today. These get a small
# feasibility boost because "can act today" > "needs more thinking".
KNOWN_PLAYBOOKS = {
    "crm-stalled-opportunities",
    "xero-overdue-invoices",
    "communications-response-delay",
    "priority-inbox-threads",
}


def _parse_ts(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _recency_weight(timestamp: Optional[str], now: Optional[datetime] = None) -> float:
    now = now or datetime.now(timezone.utc)
    parsed = _parse_ts(timestamp)
    if not parsed:
        return 0.7
    hours = max(0.0, (now - parsed).total_seconds() / 3600.0)
    if hours < 6:
        return 1.5
    if hours < 24:
        return 1.2
    if hours < 72:
        return 1.0
    return 0.7


def _severity_weight(candidate: Dict[str, Any]) -> float:
    sev = str(candidate.get("severity") or candidate.get("bucket_hint") or "").lower()
    if sev in SEVERITY_WEIGHTS:
        return SEVERITY_WEIGHTS[sev]
    # Infer severity from bucket_hint: decide_now => high, monitor => warn,
    # build_next => info. Keeps scoring meaningful when upstream didn't
    # populate severity explicitly.
    bucket = str(candidate.get("bucket_hint") or "").lower()
    if bucket == "decide_now":
        return SEVERITY_WEIGHTS["high"]
    if bucket == "monitor_this_week":
        return SEVERITY_WEIGHTS["warn"]
    if bucket == "build_next":
        return SEVERITY_WEIGHTS["info"]
    return SEVERITY_WEIGHTS["info"]


def _evidence_weight(candidate: Dict[str, Any]) -> float:
    conf = candidate.get("confidence")
    try:
        if conf is None:
            return 1.0
        return max(0.0, min(float(conf), 2.0))
    except (ValueError, TypeError):
        return 1.0


def compute_risk_score(candidate: Dict[str, Any], now: Optional[datetime] = None) -> float:
    """Return the composite risk score for a single candidate signal."""
    severity = _severity_weight(candidate)
    recency = _recency_weight(candidate.get("timestamp"), now=now)
    evidence = _evidence_weight(candidate)
    base = severity * recency * evidence
    feasibility = 0.5 if candidate.get("signal_key") in KNOWN_PLAYBOOKS else 0.0
    return round(base + feasibility, 4)


def _tie_break_recency(candidate: Dict[str, Any]) -> float:
    """Return seconds since timestamp (smaller = more recent)."""
    parsed = _parse_ts(candidate.get("timestamp"))
    if not parsed:
        return 1e12  # push undated signals last when scores tie
    return (datetime.now(timezone.utc) - parsed).total_seconds()


def compute_top_actions(candidates: List[Dict[str, Any]], n: int = 2) -> List[Dict[str, Any]]:
    """
    Score every candidate, rank by risk_score desc (ties broken by recency
    — more-recent wins), and return the top-N enriched with:

        - risk_score
        - title
        - why_this_ranks_here  (human-readable rationale)
        - action_hint          (pulled from action_summary)

    The originals are NOT mutated; returned dicts are shallow copies with
    added fields.
    """
    if not candidates:
        return []

    scored: List[Dict[str, Any]] = []
    for c in candidates:
        if not isinstance(c, dict):
            continue
        score = compute_risk_score(c)
        enriched = dict(c)
        enriched["risk_score"] = score
        enriched["title"] = c.get("signal_summary") or c.get("title") or "Signal detected"
        enriched["action_hint"] = c.get("action_summary") or ""
        enriched["why_this_ranks_here"] = _build_rationale(c, score)
        scored.append(enriched)

    scored.sort(key=lambda item: (-item["risk_score"], _tie_break_recency(item)))
    return scored[: max(0, int(n))]


def _build_rationale(candidate: Dict[str, Any], score: float) -> str:
    sev = str(candidate.get("severity") or candidate.get("bucket_hint") or "info").lower()
    recency = _recency_weight(candidate.get("timestamp"))
    parts = [f"Severity {sev}"]
    if recency >= 1.5:
        parts.append("fresh (<6h)")
    elif recency >= 1.2:
        parts.append("recent (<24h)")
    elif recency >= 1.0:
        parts.append("this week (<72h)")
    else:
        parts.append("older")
    if candidate.get("signal_key") in KNOWN_PLAYBOOKS:
        parts.append("playbook available")
    parts.append(f"risk_score {score}")
    return " · ".join(parts)
