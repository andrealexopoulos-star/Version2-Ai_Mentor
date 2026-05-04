"""
CMO Report — Per-Section Evidence Contract (E6, fix/p0-marjo-e6-cmo-section-evidence)

Issued 2026-05-04 after PR #449 produced "thin" CMO reports with generic
Marketing-101 SWOT items and templated Strategic Roadmap content.

Contract (one schema, one set of states, one denylist, one provenance check):

Every CMO Report section returned to the frontend MUST be a SectionEvidence
object — never a bare string, never a missing key, never a templated
placeholder. The frontend renders one of five states based on
`SectionEvidence.state`:

    DATA_AVAILABLE     → render content + provenance pill linking to source_trace_ids
    INSUFFICIENT_SIGNAL → render the INSUFFICIENT_SIGNAL banner with sanitised reason
    DEGRADED           → render whatever evidence exists + DEGRADED banner + retry CTA
    PROCESSING         → spinner + "Deep intelligence still processing"
    DATA_UNAVAILABLE   → empty state + retry CTA

Cross-references:
    - BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2 → ExternalState enum
    - feedback_no_cheating.md                            → never copy data,
                                                            no fake fallbacks
    - feedback_ask_biqc_brand_name.md                    → "Ask BIQc" everywhere

Author: BIQc backend engineering, 2026-05-04 (E6 P0).
"""

from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Mapping, Optional

from core.response_sanitizer import ExternalState


# ─── Section identifier constants ─────────────────────────────────────────
#
# The 32 CMO Report sections per the audit contract. Order matches the
# rendered page layout. Optional sections are marked.

SECTION_IDS: tuple = (
    # Header / metadata
    "header",
    "date",
    "business_name",
    "website",
    "scan_source",
    "data_points_count",
    "confidence_score",
    # Narrative
    "chief_marketing_summary",
    "executive_summary",
    # Score dials
    "market_position_score",
    "brand_strength",
    "digital_presence",
    "customer_sentiment",
    "competitive_position",
    # Competitive landscape
    "competitive_landscape",
    "competitors_found",
    "review_sources",
    # SWOT
    "swot_strengths",
    "swot_weaknesses",
    "swot_opportunities",
    "swot_threats",
    # Reviews
    "review_intelligence",
    # Roadmap
    "strategic_roadmap",
    "seven_day_quick_wins",
    "thirty_day_priorities",
    "ninety_day_strategic_goals",
    # Footer / actions
    "pdf_download",
    "share_report",
    "business_dna_persistence",
    # Optional surfacing
    "signals",
    "products_services",
    "abn_business_identity",
)

OPTIONAL_SECTION_IDS: frozenset = frozenset({
    "signals",
    "products_services",
    "abn_business_identity",
})


# ─── Allowed states (mirror ExternalState exactly) ────────────────────────

ALLOWED_SECTION_STATES: frozenset = frozenset({
    ExternalState.DATA_AVAILABLE.value,
    ExternalState.INSUFFICIENT_SIGNAL.value,
    ExternalState.DEGRADED.value,
    ExternalState.PROCESSING.value,
    ExternalState.DATA_UNAVAILABLE.value,
})


# ─── Placeholder denylist ─────────────────────────────────────────────────
#
# Strings whose presence in a rendered section is an AUTOMATIC FAIL.
# Two layers:
#   1. EXACT_DENY  — full-string match (case-insensitive, after .strip()).
#   2. PHRASE_DENY — substring/regex match. Catches Marketing-101 templated
#                    phrases that PR #449 was producing.
#
# The denylist is enforced both at backend response-construction time
# (in build_section_evidence) and again at test time (test_cmo_section_evidence).

PLACEHOLDER_EXACT_DENYLIST: tuple = (
    "TBD",
    "Coming soon",
    "Insufficient evidence to produce report",
    "Lorem ipsum",
    "Various",
    "Strong",
    "Weak",
    "Positive",
    "Negative",
    "Average",
    "N/A",
    "TODO",
    "Placeholder",
    "Example text",
    "Sample data",
)

# Compiled exact denylist regex (anchored, case-insensitive, ignoring
# trailing punctuation).
PLACEHOLDER_EXACT_PATTERN = re.compile(
    r"^\s*(?:" + "|".join(re.escape(t) for t in PLACEHOLDER_EXACT_DENYLIST) + r")\s*[\.\!\?]?\s*$",
    re.IGNORECASE,
)

# Marketing-101 templated phrase regexes. These match generic SWOT/Roadmap
# content that has no provenance — the exact failure mode of PR #449.
PLACEHOLDER_PHRASE_PATTERNS: tuple = (
    re.compile(r"improve.{1,30}social media presence", re.IGNORECASE),
    re.compile(r"increase.{1,30}brand awareness", re.IGNORECASE),
    re.compile(r"create.{1,30}content calendar", re.IGNORECASE),
    re.compile(r"leverage.{1,30}social media", re.IGNORECASE),
    re.compile(r"engage with.{1,30}customers", re.IGNORECASE),
    re.compile(r"build.{1,30}email list", re.IGNORECASE),
    re.compile(r"expand.{1,30}market presence", re.IGNORECASE),
    re.compile(r"optimi[sz]e.{1,30}seo", re.IGNORECASE),
    re.compile(r"focus on.{1,30}customer service", re.IGNORECASE),
    re.compile(r"differentiate.{1,30}from competitors", re.IGNORECASE),
)


def is_placeholder_string(value: Any) -> bool:
    """True if `value` is a templated placeholder per the denylist.

    Catches both exact-match deny strings (TBD, Lorem ipsum, ...)
    and Marketing-101 phrase patterns (improve social media presence, ...).

    Returns False for None, non-strings, or genuinely-evidence-backed text.
    """
    if not isinstance(value, str):
        return False
    text = value.strip()
    if not text:
        return False
    if PLACEHOLDER_EXACT_PATTERN.match(text):
        return True
    for pattern in PLACEHOLDER_PHRASE_PATTERNS:
        if pattern.search(text):
            return True
    return False


def assert_no_placeholders(value: Any, *, section_id: str = "<unknown>") -> None:
    """Recursively walk `value` and raise PlaceholderViolation on any
    denylisted text. Used as the response-construction guard.

    The walker descends into dicts, lists, tuples. It deliberately ignores
    structural string keys (they are not user-visible content).
    """
    def _walk(node: Any, path: str) -> None:
        if isinstance(node, str):
            if is_placeholder_string(node):
                raise PlaceholderViolation(
                    f"section={section_id} path={path} matched placeholder denylist: {node!r}"
                )
            return
        if isinstance(node, dict):
            for k, v in node.items():
                _walk(v, f"{path}.{k}")
            return
        if isinstance(node, (list, tuple)):
            for i, v in enumerate(node):
                _walk(v, f"{path}[{i}]")
            return
        # Numbers, bools, None pass through unchanged.

    _walk(value, "$")


class PlaceholderViolation(Exception):
    """Raised when a SectionEvidence payload contains a placeholder string.

    This is a backend-internal violation — should never reach production.
    The caller is expected to either remove the offending content or flip
    the section state to INSUFFICIENT_SIGNAL with an honest reason.
    """


# ─── SectionEvidence schema ───────────────────────────────────────────────
#
# Plain dict (not Pydantic — the codebase stays dict-first to avoid the
# overhead of model serialization in the hot CMO path). Validation is
# done by `validate_section_evidence`.

class SectionEvidence(dict):
    """Per-section evidence envelope returned to the frontend.

    Required keys:
        state             : str in ALLOWED_SECTION_STATES
        evidence          : dict | list | None — the content the frontend
                            renders when state == DATA_AVAILABLE / DEGRADED.
        reason            : str | None — sanitised, customer-facing reason
                            shown when state != DATA_AVAILABLE. Per Contract
                            v2 must NOT mention suppliers, internal codes,
                            HTTP errors, or auth-path markers.
        source_trace_ids  : list[str] — FK references into the enrichment
                            traces / signal_id pipeline. Empty list is OK
                            for sections that are intrinsically internal
                            (e.g. report_id, scan_source).
    """

    @classmethod
    def make(
        cls,
        *,
        state: str,
        evidence: Any = None,
        reason: Optional[str] = None,
        source_trace_ids: Optional[List[str]] = None,
        section_id: str = "<unknown>",
    ) -> "SectionEvidence":
        if state not in ALLOWED_SECTION_STATES:
            raise ValueError(
                f"section={section_id} invalid state={state!r}; allowed: {sorted(ALLOWED_SECTION_STATES)}"
            )
        # When state is DATA_AVAILABLE, evidence MUST be present (truthy or
        # numeric). When state is INSUFFICIENT_SIGNAL/DATA_UNAVAILABLE,
        # reason should be a customer-facing string.
        if state == ExternalState.DATA_AVAILABLE.value:
            if evidence is None:
                raise ValueError(
                    f"section={section_id} state=DATA_AVAILABLE but evidence is None"
                )
            # Recursive denylist guard. Run only on user-visible evidence.
            assert_no_placeholders(evidence, section_id=section_id)

        # Reason text must be non-leaky per Contract v2. The check is light
        # here (defence-in-depth — scrub_response_for_external runs at the
        # outer boundary too) but catches obvious supplier-name leaks early.
        if reason is not None:
            assert_reason_is_external_safe(reason, section_id=section_id)

        return cls({
            "state": state,
            "evidence": evidence,
            "reason": reason,
            "source_trace_ids": list(source_trace_ids or []),
        })


def validate_section_evidence(
    payload: Mapping[str, Any], *, section_id: str = "<unknown>"
) -> None:
    """Raise ValueError if `payload` does not satisfy SectionEvidence shape."""
    if not isinstance(payload, Mapping):
        raise ValueError(f"section={section_id} not a mapping: {type(payload)}")
    state = payload.get("state")
    if state not in ALLOWED_SECTION_STATES:
        raise ValueError(
            f"section={section_id} invalid state={state!r}"
        )
    if "evidence" not in payload:
        raise ValueError(f"section={section_id} missing key: evidence")
    if "reason" not in payload:
        raise ValueError(f"section={section_id} missing key: reason")
    if "source_trace_ids" not in payload:
        raise ValueError(f"section={section_id} missing key: source_trace_ids")
    if not isinstance(payload["source_trace_ids"], list):
        raise ValueError(
            f"section={section_id} source_trace_ids must be a list, got {type(payload['source_trace_ids'])}"
        )
    if state == ExternalState.DATA_AVAILABLE.value and payload["evidence"] is None:
        raise ValueError(
            f"section={section_id} state=DATA_AVAILABLE but evidence is None"
        )
    if state == ExternalState.DATA_AVAILABLE.value:
        # Re-run the denylist walk at validation time too. Defence in depth.
        assert_no_placeholders(payload["evidence"], section_id=section_id)


# ─── External-safety guard for `reason` strings ───────────────────────────

# Tokens that must never appear in a customer-facing `reason` string. Mirror
# of BANNED_SUPPLIER_TOKENS / BANNED_INTERNAL_TOKENS in response_sanitizer
# but checked HERE so a section author can't accidentally write
# "browse-ai-reviews returned 0 reviews" as a reason.
_REASON_BANNED_SUBSTRINGS: tuple = (
    "semrush", "openai", "perplexity", "firecrawl", "browse.ai",
    "browse-ai", "merge.dev", "anthropic", "claude-3", "claude-4",
    "gpt-4", "gpt-5", "serper", "supabase",
    "api_key", "api key missing", "service_role",
    "http 401", "http 403", "http 500", "http 502", "http 503", "http 504",
    "edge function", "edge-function", "edge_function",
    "deep-web-recon", "calibration-business-dna", "market-analysis-ai",
    "market-signal-scorer", "browse-ai-reviews", "semrush-domain-intel",
    "social-enrichment", "competitor-monitor",
    "ai_errors", "_http_status",
    "user_jwt", "service_role", "bearer ",
    "stack trace", "traceback",
)


def assert_reason_is_external_safe(reason: str, *, section_id: str = "<unknown>") -> None:
    """Raise ReasonLeakViolation if `reason` contains supplier/internal markers.

    This is the contract-v2 guardrail at the section level: the `reason`
    field on a SectionEvidence is shown to customers, so it must use the
    customer-facing language in SECTION_UNCERTAINTY_MESSAGE — never raw
    internal text.
    """
    text = (reason or "").lower()
    for token in _REASON_BANNED_SUBSTRINGS:
        if token in text:
            raise ReasonLeakViolation(
                f"section={section_id} reason contains banned token {token!r}: {reason!r}"
            )


class ReasonLeakViolation(Exception):
    """Raised when a SectionEvidence.reason contains a banned token."""


# ─── Customer-facing reason copy ──────────────────────────────────────────
#
# Pre-canonicalised, sanitised, plain-language copy for INSUFFICIENT_SIGNAL
# / DATA_UNAVAILABLE / DEGRADED states. Per Contract v2 these never name
# suppliers, never expose internal codes, never use the word "API".

REASON_INSUFFICIENT_SIGNAL: Mapping[str, str] = {
    "executive_summary":
        "We don't yet have enough verified intelligence to write a complete executive summary for this business.",
    "chief_marketing_summary":
        "We don't yet have enough verified marketing intelligence to write a chief-marketing summary.",
    "market_position_score":
        "Insufficient market signal to compute a market-position score for this business.",
    "brand_strength":
        "Insufficient public signal to assess brand strength for this business.",
    "digital_presence":
        "Insufficient public web signal to assess digital presence for this business.",
    "customer_sentiment":
        "We couldn't gather enough public review data for this business to assess customer sentiment.",
    "competitive_position":
        "Competitive landscape could not be reliably determined from current public sources.",
    "competitive_landscape":
        "Competitive landscape could not be reliably determined from current public sources.",
    "competitors_found":
        "We couldn't reliably identify named competitors for this business in the current public corpus.",
    "review_sources":
        "We couldn't gather enough public review data across review platforms for this business.",
    "swot_strengths":
        "Insufficient evidence to extract evidence-backed strengths for this business.",
    "swot_weaknesses":
        "Insufficient evidence to extract evidence-backed weaknesses for this business.",
    "swot_opportunities":
        "Insufficient evidence to extract evidence-backed opportunities for this business.",
    "swot_threats":
        "Insufficient evidence to extract evidence-backed threats for this business.",
    "review_intelligence":
        "We couldn't gather enough public review data for this business to produce review intelligence.",
    "strategic_roadmap":
        "Insufficient evidence to compose an evidence-backed strategic roadmap.",
    "seven_day_quick_wins":
        "Insufficient evidence to recommend evidence-backed 7-day quick wins for this business.",
    "thirty_day_priorities":
        "Insufficient evidence to recommend evidence-backed 30-day priorities for this business.",
    "ninety_day_strategic_goals":
        "Insufficient evidence to recommend evidence-backed 90-day strategic goals for this business.",
    "signals":
        "No new high-confidence signals have been observed for this business yet.",
    "products_services":
        "We couldn't extract a reliable products/services list for this business from current public sources.",
    "abn_business_identity":
        "Business identity (ABN/registration) could not be confirmed from current public sources.",
}

REASON_PROCESSING: str = (
    "Deep intelligence is still processing. Sections will populate as signals are confirmed."
)

REASON_DATA_UNAVAILABLE: Mapping[str, str] = {
    "default":
        "Intelligence signal unavailable for this scan. Run the scan again or connect a relevant integration.",
}


def reason_for(section_id: str, state: str) -> str:
    """Return the canonical customer-facing reason text for a (section, state) pair.

    Always returns a non-leaky, plain-language string. Falls back to a
    section-agnostic default when no specific copy is registered.
    """
    if state == ExternalState.PROCESSING.value:
        return REASON_PROCESSING
    if state == ExternalState.INSUFFICIENT_SIGNAL.value:
        return REASON_INSUFFICIENT_SIGNAL.get(
            section_id,
            "Insufficient market signal to assess this dimension yet.",
        )
    if state == ExternalState.DEGRADED.value:
        return (
            "Partial intelligence — some inputs were available but the picture is incomplete. "
            "Re-run the scan once your integrations are connected for a fuller view."
        )
    if state == ExternalState.DATA_UNAVAILABLE.value:
        return REASON_DATA_UNAVAILABLE["default"]
    return ""


# ─── Provenance enforcement (SWOT + Roadmap) ──────────────────────────────
#
# PR #449's failure mode was generic SWOT items and Marketing-101 roadmap
# content with NO link back to a real signal. The contract is:
#
#   - Each SWOT item must either reference at least one source_trace_id
#     OR the whole SWOT section must be flipped to INSUFFICIENT_SIGNAL.
#   - Each Roadmap item must reference at least one finding (signal_id,
#     competitor name from this scan, or brand metric from this scan).

def filter_swot_items_with_provenance(
    items: Iterable[Any],
    *,
    available_trace_ids: Iterable[str] = (),
    available_competitor_names: Iterable[str] = (),
) -> List[Dict[str, Any]]:
    """Return only those SWOT items that pass provenance + denylist checks.

    Each item is normalised to {"text", "source_trace_ids", "evidence_tag"}.
    Items that match the placeholder denylist are dropped.
    Items with NO provenance pointer at all are dropped.
    Empty list result is the caller's signal to flip the section to
    INSUFFICIENT_SIGNAL.
    """
    trace_set = {str(t) for t in available_trace_ids if t}
    comp_set_lower = {str(c).lower() for c in available_competitor_names if c}
    out: List[Dict[str, Any]] = []
    for raw in items or []:
        if isinstance(raw, str):
            text = raw.strip()
            item_traces: List[str] = []
            evidence_tag: Optional[str] = None
        elif isinstance(raw, dict):
            text = str(raw.get("text") or "").strip()
            item_traces_raw = raw.get("source_trace_ids") or raw.get("trace_ids") or []
            item_traces = [str(t) for t in item_traces_raw if t]
            evidence_tag = raw.get("evidence_tag")
        else:
            continue
        if not text or is_placeholder_string(text):
            continue
        # Provenance check: at least one item_trace MUST intersect the
        # available trace set, OR the item text mentions a real competitor
        # surfaced by this scan, OR the caller marked the item with an
        # explicit evidence_tag (from our own enrichment).
        #
        # F7 P1-2 (BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2):
        # Removed `or bool(item_traces)` — that clause silently passed items
        # whose item_traces were FABRICATED (not in trace_set). Provenance
        # MUST require a real intersection — that's the whole point of the
        # check. R6 finding 13041978-flagged.
        has_trace = any(t in trace_set for t in item_traces)
        has_comp_mention = any(c and c in text.lower() for c in comp_set_lower)
        has_evidence_tag = bool(evidence_tag)
        if not (has_trace or has_comp_mention or has_evidence_tag):
            continue
        out.append({
            "text": text,
            "source_trace_ids": item_traces,
            "evidence_tag": evidence_tag,
        })
    return out


def filter_roadmap_items_with_provenance(
    items: Iterable[Any],
    *,
    available_trace_ids: Iterable[str] = (),
    available_competitor_names: Iterable[str] = (),
    available_brand_metric_names: Iterable[str] = (),
) -> List[Dict[str, Any]]:
    """Return only those roadmap items that reference a real finding.

    Each item is normalised to:
        {"text", "priority", "evidence_tag", "source_trace_ids", "confidence"}
    Items must reference at least one of:
        - source_trace_ids that intersect available_trace_ids
        - a competitor name from this scan
        - a brand-metric name from this scan
        - an explicit evidence_tag preserved from enrichment

    Items that fail provenance OR match the placeholder denylist are dropped.
    """
    trace_set = {str(t) for t in available_trace_ids if t}
    comp_set_lower = {str(c).lower() for c in available_competitor_names if c}
    metric_set_lower = {str(m).lower() for m in available_brand_metric_names if m}
    out: List[Dict[str, Any]] = []
    for raw in items or []:
        if isinstance(raw, str):
            text = raw.strip()
            priority = "medium"
            evidence_tag: Optional[str] = None
            item_traces: List[str] = []
            confidence: Optional[float] = None
        elif isinstance(raw, dict):
            text = str(raw.get("text") or "").strip()
            priority = str(raw.get("priority") or "medium").lower()
            evidence_tag = raw.get("evidence_tag")
            traces_raw = raw.get("source_trace_ids") or raw.get("trace_ids") or []
            item_traces = [str(t) for t in traces_raw if t]
            try:
                confidence = float(raw.get("confidence")) if raw.get("confidence") is not None else None
            except (TypeError, ValueError):
                confidence = None
        else:
            continue
        if not text or is_placeholder_string(text):
            continue
        # F7 P1-2 (BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2):
        # Removed `or bool(item_traces)` — fabricated trace ids that don't
        # intersect the available_trace_ids set must NOT pass the provenance
        # check. Real intersection or competitor/metric mention or
        # evidence_tag is required.
        has_trace = any(t in trace_set for t in item_traces)
        has_comp_mention = any(c and c in text.lower() for c in comp_set_lower)
        has_metric_mention = any(m and m in text.lower() for m in metric_set_lower)
        has_evidence_tag = bool(evidence_tag)
        if not (has_trace or has_comp_mention or has_metric_mention or has_evidence_tag):
            continue
        out.append({
            "text": text,
            "priority": priority if priority in {"critical", "high", "medium", "low"} else "medium",
            "evidence_tag": evidence_tag,
            "source_trace_ids": item_traces,
            "confidence": confidence,
        })
    return out


# ─── Section builder helpers ──────────────────────────────────────────────

def make_section(
    section_id: str,
    *,
    state: str,
    evidence: Any = None,
    reason: Optional[str] = None,
    source_trace_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Convenience builder: returns a SectionEvidence-shaped dict.

    If `reason` is None and the state is non-AVAILABLE, the canonical
    customer-facing copy from REASON_INSUFFICIENT_SIGNAL is auto-filled.
    """
    if state != ExternalState.DATA_AVAILABLE.value and not reason:
        reason = reason_for(section_id, state)
    return SectionEvidence.make(
        state=state,
        evidence=evidence,
        reason=reason,
        source_trace_ids=source_trace_ids,
        section_id=section_id,
    )


def section_state_for_value(
    value: Any,
    *,
    has_upstream_failure: bool = False,
    is_processing: bool = False,
) -> str:
    """Heuristic: derive the right ExternalState for a raw value.

    Used in the CMO endpoint to convert legacy section payloads (raw lists,
    dicts, numbers) to the new SectionEvidence shape.
    """
    if is_processing:
        return ExternalState.PROCESSING.value
    if has_upstream_failure:
        return ExternalState.DATA_UNAVAILABLE.value
    if value is None:
        return ExternalState.INSUFFICIENT_SIGNAL.value
    if isinstance(value, str):
        if not value.strip() or is_placeholder_string(value):
            return ExternalState.INSUFFICIENT_SIGNAL.value
        return ExternalState.DATA_AVAILABLE.value
    if isinstance(value, (list, tuple)):
        if not value:
            return ExternalState.INSUFFICIENT_SIGNAL.value
        return ExternalState.DATA_AVAILABLE.value
    if isinstance(value, dict):
        if not value:
            return ExternalState.INSUFFICIENT_SIGNAL.value
        # Dict with only zeroes/empties -> INSUFFICIENT
        if all((v is None or v == 0 or v == "" or v == [] or v == {}) for v in value.values()):
            return ExternalState.INSUFFICIENT_SIGNAL.value
        return ExternalState.DATA_AVAILABLE.value
    if isinstance(value, (int, float)):
        if value == 0:
            return ExternalState.INSUFFICIENT_SIGNAL.value
        return ExternalState.DATA_AVAILABLE.value
    # Booleans, etc.
    return ExternalState.DATA_AVAILABLE.value
