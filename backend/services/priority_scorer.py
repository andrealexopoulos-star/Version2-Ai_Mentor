"""
Priority scorer for the Advisor "2 things to act on" headline.

Sprint B #15 (2026-04-22) — replaces the boolean-sum `urgentCount` on
Advisor.js that collapsed to a count of 0..3 regardless of actual risk.

Sprint B #16 (2026-04-22) — personalization. The scorer now accepts an
optional PersonalizationContext so user-specific preferences (risk
appetite) and accumulated user feedback (per-signal_key priority_weight
from signal_feedback) shift rankings. The core compute_risk_score stays
pure — the caller threads the context in, so the scorer itself remains
unit-testable without supabase.

    risk_score = severity_weight * recency_weight * evidence_weight
                 * personalization_severity_modifier
                 + action_feasibility_boost
                 + user_feedback_adjustment

- Severity:  critical=4 | high=3 | warn|warning=2 | info=1
- Recency:   <6h=1.5 | <24h=1.2 | <72h=1.0 | else=0.7
- Evidence:  signal.get("confidence") if present else 1.0
- Feasibility boost: +0.5 when the signal_key maps to a known playbook.
- Personalization severity modifier:
    risk_appetite=low  → info/warn * 1.2 (flag early)
    risk_appetite=high → info/warn * 0.7 (only surface real issues)
    (default / medium / unknown → 1.0 passthrough)
- User feedback adjustment: sum of priority_weight rows on signal_feedback
  matching this signal_key for this user (clamped to [-2.0, 0.0] — feedback
  can only reduce, never boost). Prevents "not_relevant" signals from
  re-surfacing.
"""
from __future__ import annotations

from dataclasses import dataclass, field
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


# Sprint B #16 — feedback adjustment guard rails.
# User feedback can only DOWN-weight a signal (never boost), and is bounded
# so a single angry user can't zero the whole priority model.
FEEDBACK_ADJUSTMENT_FLOOR = -2.0
FEEDBACK_ADJUSTMENT_CEILING = 0.0


@dataclass
class PersonalizationContext:
    """Per-user context that shifts ranking without changing the pure math.

    Threaded from the caller (backend/routes/intelligence.py top_actions)
    so the scorer itself remains side-effect-free and unit-testable.
    """
    risk_appetite: Optional[str] = None
    # signal_key → accumulated priority_weight (always <= 0). See
    # signal_feedback CHECK constraint for the key enum.
    feedback_weights: Dict[str, float] = field(default_factory=dict)


def _severity_modifier(candidate: Dict[str, Any], ctx: Optional[PersonalizationContext]) -> float:
    """Apply risk_appetite to the severity band of this signal.

    Only affects info + warn bands — critical/high are always meaningful
    regardless of appetite.
    """
    if not ctx or not ctx.risk_appetite:
        return 1.0
    appetite = (ctx.risk_appetite or "").lower()
    if appetite not in {"low", "high"}:
        return 1.0
    sev = str(candidate.get("severity") or candidate.get("bucket_hint") or "").lower()
    if sev in {"info", "warn", "warning"}:
        return 1.2 if appetite == "low" else 0.7
    return 1.0


def _feedback_adjustment(candidate: Dict[str, Any], ctx: Optional[PersonalizationContext]) -> float:
    """Down-weight signals the user has repeatedly flagged as irrelevant."""
    if not ctx or not ctx.feedback_weights:
        return 0.0
    key = candidate.get("signal_key")
    if not key:
        return 0.0
    raw = ctx.feedback_weights.get(key, 0.0)
    try:
        adj = float(raw)
    except (TypeError, ValueError):
        return 0.0
    return max(FEEDBACK_ADJUSTMENT_FLOOR, min(adj, FEEDBACK_ADJUSTMENT_CEILING))


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


def compute_risk_score(
    candidate: Dict[str, Any],
    now: Optional[datetime] = None,
    context: Optional[PersonalizationContext] = None,
) -> float:
    """Return the composite risk score for a single candidate signal.

    Sprint B #16: `context` threads per-user personalization (risk_appetite,
    accumulated feedback_weights). When `context` is None the function behaves
    identically to the pre-#16 scorer — keeping old call sites + tests valid.
    """
    severity = _severity_weight(candidate)
    recency = _recency_weight(candidate.get("timestamp"), now=now)
    evidence = _evidence_weight(candidate)
    severity_mod = _severity_modifier(candidate, context)
    base = severity * recency * evidence * severity_mod
    feasibility = 0.5 if candidate.get("signal_key") in KNOWN_PLAYBOOKS else 0.0
    feedback_adj = _feedback_adjustment(candidate, context)
    return round(base + feasibility + feedback_adj, 4)


def _tie_break_recency(candidate: Dict[str, Any]) -> float:
    """Return seconds since timestamp (smaller = more recent)."""
    parsed = _parse_ts(candidate.get("timestamp"))
    if not parsed:
        return 1e12  # push undated signals last when scores tie
    return (datetime.now(timezone.utc) - parsed).total_seconds()


def compute_top_actions(
    candidates: List[Dict[str, Any]],
    n: int = 2,
    context: Optional[PersonalizationContext] = None,
) -> List[Dict[str, Any]]:
    """
    Score every candidate, rank by risk_score desc (ties broken by recency
    — more-recent wins), and return the top-N enriched with:

        - risk_score
        - title
        - why_this_ranks_here  (human-readable rationale)
        - action_hint          (pulled from action_summary)

    Sprint B #16: pass `context` to apply per-user personalization
    (risk_appetite, feedback weights).

    The originals are NOT mutated; returned dicts are shallow copies with
    added fields.
    """
    if not candidates:
        return []

    scored: List[Dict[str, Any]] = []
    for c in candidates:
        if not isinstance(c, dict):
            continue
        score = compute_risk_score(c, context=context)
        enriched = dict(c)
        enriched["risk_score"] = score
        enriched["title"] = c.get("signal_summary") or c.get("title") or "Signal detected"
        enriched["action_hint"] = c.get("action_summary") or ""
        enriched["why_this_ranks_here"] = _build_rationale(c, score, context=context)
        scored.append(enriched)

    scored.sort(key=lambda item: (-item["risk_score"], _tie_break_recency(item)))
    return scored[: max(0, int(n))]


# Sprint B #16 — personalization fetchers (DB-touching; unit tests mock these).
def fetch_personalization_context(sb, user_id: str) -> PersonalizationContext:
    """Build a PersonalizationContext from business_profiles + signal_feedback.

    Defensive: every query is wrapped so a missing table / row returns an empty
    PersonalizationContext (scorer falls back to non-personalized behaviour).
    """
    ctx = PersonalizationContext()
    if not sb or not user_id:
        return ctx

    # risk_appetite from business_profiles (column already exists)
    try:
        res = (
            sb.table("business_profiles")
            .select("risk_appetite")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if rows:
            ctx.risk_appetite = (rows[0] or {}).get("risk_appetite")
    except Exception:
        pass  # non-fatal — fall back to default

    # Aggregate signal_feedback per signal_key for this user.
    # Migration 122: signal_feedback.feedback_key drives a priority_weight
    # that the taxonomy endpoint exposes (see routes/signals.py
    # FEEDBACK_TAXONOMY). We recompute the mapping here rather than calling
    # the endpoint so the scorer has no HTTP dep.
    weight_map = {
        "not_relevant": -0.5,
        "already_done": -0.7,
        "incorrect": -0.9,
        "need_more_info": 0.0,
    }
    try:
        fb_res = (
            sb.table("signal_feedback")
            .select("event_id, feedback_key")
            .eq("user_id", user_id)
            .execute()
        )
        fb_rows = fb_res.data or []
    except Exception:
        fb_rows = []

    if fb_rows:
        # Feedback rows carry event_id, not signal_key — we need the JOIN.
        event_ids = [r.get("event_id") for r in fb_rows if r.get("event_id")]
        signal_key_by_event: Dict[str, str] = {}
        if event_ids:
            try:
                ev_res = (
                    sb.table("observation_events")
                    .select("id, signal_name")
                    .in_("id", event_ids)
                    .execute()
                )
                for row in (ev_res.data or []):
                    signal_key_by_event[row.get("id")] = row.get("signal_name") or ""
            except Exception:
                signal_key_by_event = {}

        for row in fb_rows:
            key = signal_key_by_event.get(row.get("event_id"))
            if not key:
                continue
            w = weight_map.get(row.get("feedback_key"), 0.0)
            if w == 0.0:
                continue
            ctx.feedback_weights[key] = ctx.feedback_weights.get(key, 0.0) + w

    return ctx


def _build_rationale(
    candidate: Dict[str, Any],
    score: float,
    context: Optional[PersonalizationContext] = None,
) -> str:
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
    # Sprint B #16: surface personalization contribution in the rationale so
    # users understand why a signal moved up or down.
    if context and context.risk_appetite:
        sev_mod = _severity_modifier(candidate, context)
        if sev_mod != 1.0:
            parts.append(
                f"tuned for {context.risk_appetite} risk appetite"
            )
    if context and context.feedback_weights:
        fb_adj = _feedback_adjustment(candidate, context)
        if fb_adj < 0:
            parts.append(f"down-weighted by your prior feedback ({fb_adj:+.1f})")
    parts.append(f"risk_score {score}")
    return " · ".join(parts)
