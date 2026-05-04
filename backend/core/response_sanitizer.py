"""
BIQc Platform Contract v2 — centralised response sanitizer.

Issued by Andreas (CTO) 2026-04-23. Memory ref:
    BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2

Rule (non-negotiable):

    The backend is the trust boundary. Every response that LEAVES the
    backend for the frontend MUST have been through this sanitizer.
    No route handler may pass a raw edge-function response or a raw
    `business_dna_enrichment.enrichment` object to the frontend.

This module provides:
    - ExternalState         : strict enum of values allowed to appear on a
                              frontend-facing response (5 values).
    - InternalErrorType     : backend-internal error categories; maps to
                              ExternalState via TYPE_TO_STATE.
    - sanitize_error_for_external(internal)
                            : maps an internal error dict to the external
                              contract shape `{ok: False, state: "..."}`.
    - sanitize_edge_passthrough(raw_edge_response)
                            : for routes that proxy an edge call directly
                              to the frontend — strips internal codes,
                              maps to external state.
    - sanitize_enrichment_for_external(enrichment, edge_tool_statuses)
                            : transforms a `business_dna_enrichment.enrichment`
                              dict into a frontend-safe shape. Strips
                              `ai_errors`, `sources.edge_tools`, internal
                              HTTP codes, correlation ids. Adds per-section
                              state annotations based on underlying edge
                              success + field presence.
    - assert_no_banned_tokens(payload)
                            : self-check used in unit + integration tests.
                              Raises ExternalContractViolation if any
                              supplier name / internal code leaks.

Intelligence-layer language (per the contract):
    Instead of "SEO weak"                     → "Insufficient market signal to assess SEO strength"
    Instead of "0 competitors found"          → "Competitive landscape could not be reliably determined"
    Instead of "SEMRUSH_API_KEY_MISSING"      → "Market performance data unavailable for this scan"
    Instead of "HTTP 401 from supplier"       → "Market intelligence temporarily unavailable"
"""

from __future__ import annotations

import re
from enum import Enum
from typing import Any, Dict, Iterable, List, Mapping, Optional, Tuple


# ─── Enums ────────────────────────────────────────────────────────────────

class ExternalState(str, Enum):
    """The only values allowed to appear on a frontend-facing response."""
    DATA_AVAILABLE = "DATA_AVAILABLE"
    DATA_UNAVAILABLE = "DATA_UNAVAILABLE"
    INSUFFICIENT_SIGNAL = "INSUFFICIENT_SIGNAL"
    PROCESSING = "PROCESSING"
    DEGRADED = "DEGRADED"


class InternalErrorType(str, Enum):
    """Backend-internal error categories. Map to ExternalState via TYPE_TO_STATE."""
    CONFIG = "CONFIG"          # missing supplier key, missing env, bad config
    SUPPLIER = "SUPPLIER"      # upstream supplier API failure (4xx/5xx, quota, etc.)
    TIMEOUT = "TIMEOUT"        # request timeout
    VALIDATION = "VALIDATION"  # input insufficient / semantic validation failure
    PARTIAL = "PARTIAL"        # some data arrived, some failed
    PENDING = "PENDING"        # async job not yet complete
    UNKNOWN = "UNKNOWN"        # uncategorised — defaults to DEGRADED externally


TYPE_TO_STATE: Mapping[InternalErrorType, ExternalState] = {
    InternalErrorType.CONFIG: ExternalState.DATA_UNAVAILABLE,
    InternalErrorType.SUPPLIER: ExternalState.DATA_UNAVAILABLE,
    InternalErrorType.TIMEOUT: ExternalState.DATA_UNAVAILABLE,
    InternalErrorType.VALIDATION: ExternalState.INSUFFICIENT_SIGNAL,
    InternalErrorType.PARTIAL: ExternalState.DEGRADED,
    InternalErrorType.PENDING: ExternalState.PROCESSING,
    InternalErrorType.UNKNOWN: ExternalState.DEGRADED,
}


# ─── Internal → External text mapping ────────────────────────────────────

SECTION_UNCERTAINTY_MESSAGE: Mapping[str, str] = {
    # Keyed by internal field name on the enrichment object. Value is the
    # customer-facing copy to display when the section's state != DATA_AVAILABLE.
    "seo_analysis": "Organic search performance data unavailable for this scan",
    "seo_html_hygiene": "On-page SEO hygiene could not be assessed from scraped content",
    "paid_media_analysis": "Paid search activity data unavailable for this scan",
    "competitor_analysis": "Competitive landscape could not be reliably determined",
    "competitors": "Competitive landscape could not be reliably determined",
    "competitor_swot": "Competitive landscape could not be reliably determined",
    "paid_competitor_analysis": "Paid competitor landscape unavailable for this scan",
    "backlink_profile": "Domain authority + backlink data unavailable for this scan",
    "backlink_intelligence": "Domain authority + backlink data unavailable for this scan",
    "keyword_intelligence": "Keyword and top-pages intelligence unavailable for this scan",
    "advertising_intelligence": "Advertising history and budget posture unavailable for this scan",
    "social_media_analysis": "Social media footprint data unavailable for this scan",
    "swot": "Insufficient market signal to assess strategic position",
    "market_position": "Market positioning data unavailable for this scan",
    "market_trajectory": "Market trajectory data unavailable for this scan",
    "website_health": "Website health signal unavailable for this scan",
    "customer_review_intelligence": "Customer review intelligence unavailable for this scan",
    "staff_review_intelligence": "Staff review intelligence unavailable for this scan",
    "cmo_executive_brief": "Executive brief synthesis pending additional data",
    "cmo_priority_actions": "Priority action synthesis pending additional data",
    "executive_summary": "Executive summary synthesis pending additional data",
}


# ─── Banned external tokens ───────────────────────────────────────────────
#
# Anything in this list MUST NOT appear in a frontend-facing response body.
# Checked via `assert_no_banned_tokens`. This is the enforcement backbone
# of the contract — centralises what "leak" means.

BANNED_SUPPLIER_TOKENS: Tuple[str, ...] = (
    # F15 (2026-05-04): added "SEMrush" canonical spelling (capital S+E+M,
    # lowercase r-u-s-h). R-R2D's verification test caught it missing —
    # the literal "SEMrush rank {value}" was leaking through calibration.py
    # because none of {SEMRUSH, Semrush, semrush} matched the canonical
    # marketing spelling.
    "SEMRUSH", "SEMrush", "Semrush", "semrush",
    "OPENAI", "OpenAI", "openai", "gpt-4", "gpt-5", "gpt-4o",
    "ANTHROPIC", "Anthropic", "claude-3", "claude-4",
    "PERPLEXITY", "Perplexity", "perplexity", "sonar",
    "FIRECRAWL", "Firecrawl", "firecrawl",
    "BROWSE_AI", "Browse.ai", "browse.ai", "browse-ai",
    "SERPER", "Serper", "serper",
    "MERGE_API", "Merge.dev", "merge.dev",
    "supabase.auth", "supabase.co",
)

BANNED_INTERNAL_TOKENS: Tuple[str, ...] = (
    "service_role",
    "SERVICE_ROLE",
    "API_KEY_MISSING",
    "API_KEY",
    "SUPPLIER_TOTAL_FAILURE",
    "SUPPLIER_CONFIG_MISSING",
    "BACKEND_ORCHESTRATION_CONTRACT_VIOLATION",
    "EDGE_PROXY_UNAVAILABLE",
    "EDGE_FUNCTION_TIMEOUT",
    "EDGE_FUNCTION_UNAVAILABLE",
    "HTTP 401", "HTTP 403", "HTTP 500", "HTTP 502", "HTTP 503", "HTTP 504",
    "ai_errors",
    "_http_status",
    "_proxy",
    "edge_tools",
    "edge_function",
    "deep-web-recon",
    "calibration-business-dna",
    "market-analysis-ai",
    "market-signal-scorer",
    "browse-ai-reviews",
    "semrush-domain-intel",
    "social-enrichment",
    "competitor-monitor",
    "user_jwt_rejected",
    "service_role_exact",
    "service_role_jwt",
    "user_jwt_verified",
    "Bearer",
)

# Keys that are STRUCTURAL and may appear in responses as key names without
# being a leak (e.g. a field literally called `error` is OK; what matters is
# the value). The assertion runs against serialized JSON to catch substring
# leakage regardless of key/value location.
ALL_BANNED_TOKENS: Tuple[str, ...] = BANNED_SUPPLIER_TOKENS + BANNED_INTERNAL_TOKENS


class ExternalContractViolation(Exception):
    """Raised when `assert_no_banned_tokens` finds a banned substring in a payload."""


# ─── Helpers ──────────────────────────────────────────────────────────────

def _coerce_error_type(internal_type: Any) -> InternalErrorType:
    if isinstance(internal_type, InternalErrorType):
        return internal_type
    try:
        return InternalErrorType(str(internal_type).upper())
    except (ValueError, AttributeError):
        return InternalErrorType.UNKNOWN


def _type_to_state(internal_type: Any) -> ExternalState:
    return TYPE_TO_STATE[_coerce_error_type(internal_type)]


def _section_message(section_name: str) -> str:
    """Return the customer-facing uncertainty message for a section."""
    return SECTION_UNCERTAINTY_MESSAGE.get(
        section_name,
        "Intelligence signal unavailable for this scan",
    )


def _is_empty_or_zero(value: Any) -> bool:
    """Signal-level emptiness: null/empty-string/empty-list/empty-dict/zero."""
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, (list, tuple, dict)) and len(value) == 0:
        return True
    if isinstance(value, (int, float)) and value == 0:
        return True
    return False


# ─── Sanitizers ───────────────────────────────────────────────────────────

def sanitize_error_for_external(
    internal_error: Optional[Mapping[str, Any]] = None,
    *,
    error_type: Any = InternalErrorType.UNKNOWN,
) -> Dict[str, Any]:
    """Map an internal error dict (or a standalone type) to the external shape.

    Returns only `{ok: False, state: "<ExternalState value>"}`. Never leaks
    any supplier or internal detail. See contract §4 (mapping layer).

    Args:
        internal_error: Optional internal error envelope. If it carries a
            `type` field, that wins; otherwise `error_type` is used.
        error_type: Fallback internal error type when `internal_error`
            carries no `type` key.

    Example:
        >>> sanitize_error_for_external({"type": "CONFIG", "source": "semrush"})
        {'ok': False, 'state': 'DATA_UNAVAILABLE'}
    """
    if internal_error and "type" in internal_error:
        effective_type = internal_error["type"]
    else:
        effective_type = error_type
    state = _type_to_state(effective_type)
    return {"ok": False, "state": state.value}


def sanitize_edge_passthrough(raw_edge_response: Any) -> Dict[str, Any]:
    """Sanitize a raw edge-function response before returning it to the frontend.

    Use at any `/edge/functions/{name}` style proxy route. Preserves the
    `ok: True` path (with scrubbed internal fields) and converts any
    `ok: False` path to the external error shape.

    Returns:
        On success: `{ok: True, state: "DATA_AVAILABLE", data: <scrubbed>}`
        On failure: `{ok: False, state: "<ExternalState value>"}`
    """
    if not isinstance(raw_edge_response, dict):
        return {"ok": False, "state": ExternalState.DEGRADED.value}

    http_status = int(raw_edge_response.get("_http_status") or 0)
    reported_ok = bool(raw_edge_response.get("ok", True))

    # Treat non-2xx OR explicit ok:false as failure.
    if not reported_ok or http_status >= 400:
        # Best-effort type inference for mapping to external state.
        code = str(raw_edge_response.get("code") or "").upper()
        if "TIMEOUT" in code or http_status == 504:
            err_type = InternalErrorType.TIMEOUT
        elif "UNAVAILABLE" in code or http_status in (502, 503):
            err_type = InternalErrorType.SUPPLIER
        elif "CONFIG" in code or "API_KEY" in code:
            err_type = InternalErrorType.CONFIG
        elif "CONTRACT" in code or "VALIDATION" in code:
            err_type = InternalErrorType.VALIDATION
        elif http_status in (401, 403):
            err_type = InternalErrorType.SUPPLIER
        else:
            err_type = InternalErrorType.UNKNOWN
        return {"ok": False, "state": _type_to_state(err_type).value}

    # Success path — scrub internal scaffolding, keep only data fields.
    scrubbed = _scrub_internal_keys(raw_edge_response)
    # Remove internal flags from top level.
    for k in ("ok", "_http_status", "code"):
        scrubbed.pop(k, None)
    return {"ok": True, "state": ExternalState.DATA_AVAILABLE.value, "data": scrubbed}


# Keys that are ALWAYS internal and must be stripped from any value reaching
# the frontend, at any nesting depth.
_INTERNAL_KEYS: Tuple[str, ...] = (
    "ai_errors",
    "_http_status",
    "_proxy_request_id",
    "correlation",
    "_trace",
    "_proxy",
    "_deep_sources",
    "_social_sources",
    "_deep_recon_sources",
    "_field_provenance",
    "_sources",
    "_identity_signals",
    "raw_overview",      # SEMrush raw CSV row — leaks supplier shape
    "source",            # sub-section provenance (e.g. "semrush", "perplexity") — supplier names
    "source_fn",         # internal edge-function slug per field
    "data_sources",      # internal list of edge-tool names
    "deep_scan_sources", # nested internal provenance
    # Marjo R2A (2026-05-04) — per-edge-fn audit metadata for the 4 missed
    # scan-fanout fns. Carries internal slug/status/code; never exposed.
    "_edge_response_summary",
    # Marjo R2D (2026-05-04) — SEMrush-deep internal audit / supplier-named keys
    "semrush_data",      # raw passthrough of edge response — leaks supplier name + raw_overview + ai_errors
    "semrush_competitors",  # alias of competitor_analysis.organic_competitors — supplier-named field
    "provider_telemetry",   # backend audit only — never leaks api_units_used to UI
    "provider_traces",      # per-call sub-trace; backend audit only
)


# ─── R2D (2026-05-04): supplier-prefixed key renaming ──────────────────────
# Some legacy enrichment field names embed the supplier slug (e.g.
# `semrush_rank`). Renaming them to neutral names removes the only
# remaining banned-token leak under Contract v2 without dropping the data.
# Renames are applied in `_scrub_internal_keys` after key-strip.
_KEY_RENAMES: Dict[str, str] = {
    "semrush_rank": "authority_rank",
}


def _scrub_internal_keys(obj: Any) -> Any:
    """Recursively drop any key in `_INTERNAL_KEYS` and apply `_KEY_RENAMES`.
    Does not mutate input."""
    if isinstance(obj, dict):
        scrubbed: Dict[str, Any] = {}
        for k, v in obj.items():
            if k in _INTERNAL_KEYS:
                continue
            new_k = _KEY_RENAMES.get(k, k)
            scrubbed[new_k] = _scrub_internal_keys(v)
        return scrubbed
    if isinstance(obj, list):
        return [_scrub_internal_keys(item) for item in obj]
    return obj


def scrub_response_for_external(response: Any) -> Any:
    """Public helper for routes that build a custom response shape
    (e.g. /intelligence/cmo-report) and need to strip internal keys at
    any nesting depth before returning. Does NOT apply section-state
    annotation logic (that's what sanitize_enrichment_for_external is for).

    Use this when the endpoint's response shape differs from the raw
    enrichment object but still embeds sub-objects from enrichment.

    Restored 2026-04-23 after an accidental revert during PR #370 merge
    brought down the backend (import of this name from intelligence.py
    and intelligence_modules.py → ModuleNotFoundError → container
    crash-loop → Azure 503).
    """
    return _scrub_internal_keys(response)


# ─── Per-section state derivation ─────────────────────────────────────────
#
# Each enrichment section has its own success criteria. A section's
# external state is derived from:
#   1. Whether its upstream edge tool(s) succeeded
#   2. Whether the section's required fields are non-empty
#
# The mapping below is the canonical list. Adding a new section requires
# adding an entry here — that is a feature, not a bug (forces conscious
# decision about what counts as "available").

# Map from enrichment section name → (required_field_names, edge_tools_that_power_it)
# If ANY required field is empty AND the edge tool(s) failed → DATA_UNAVAILABLE
# If ANY required field is empty AND the edge tool(s) succeeded → INSUFFICIENT_SIGNAL
# If all required fields present → DATA_AVAILABLE
SECTION_CRITERIA: Dict[str, Dict[str, Any]] = {
    "seo_analysis": {
        "required": ("organic_keywords", "top_organic_keywords"),
        "edge_tools": ("semrush_domain_intel",),
    },
    "paid_media_analysis": {
        "required": ("adwords_keywords", "top_paid_keywords"),
        "edge_tools": ("semrush_domain_intel",),
    },
    "competitor_analysis": {
        "required": ("organic_competitors",),
        "edge_tools": ("semrush_domain_intel", "competitor_monitor"),
    },
    # Contract v2 / Step 3e: Business-Plan expansion sections.
    "paid_competitor_analysis": {
        "required": ("paid_competitors",),
        "edge_tools": ("semrush_domain_intel",),
    },
    "backlink_profile": {
        "required": ("referring_domains", "total_backlinks"),
        "edge_tools": ("semrush_domain_intel",),
    },
    # ─── R2D (2026-05-04): Deep SEMrush intel sections ────────────────────
    # `keyword_intelligence` is powered by the top-100 organic keyword spread
    # (domain_organic) plus top-20 landing pages (domain_organic_pages).
    # `backlink_intelligence` is the brief's preferred alias of backlink_profile.
    # `advertising_intelligence` is powered by the 12-month domain_adwords_history
    # series. All three live under semrush_domain_intel.
    "keyword_intelligence": {
        "required": ("organic_keywords", "top_pages"),
        "edge_tools": ("semrush_domain_intel",),
    },
    "backlink_intelligence": {
        "required": ("referring_domains", "total_backlinks"),
        "edge_tools": ("semrush_domain_intel",),
    },
    "advertising_intelligence": {
        "required": ("ad_history_12m",),
        "edge_tools": ("semrush_domain_intel",),
    },
    "competitors": {
        "required": ("__self__",),  # the field itself is a list
        "edge_tools": ("deep_web_recon", "competitor_monitor"),
    },
    "swot": {
        "required": ("strengths", "weaknesses", "opportunities", "threats"),
        "edge_tools": ("deep_web_recon", "market_analysis_ai"),
    },
    "customer_review_intelligence": {
        "required": ("__self__",),
        "edge_tools": ("browse_ai_reviews",),
    },
    "staff_review_intelligence": {
        "required": ("__self__",),
        "edge_tools": ("browse_ai_reviews",),
    },
    "social_media_analysis": {
        "required": ("__self__",),
        "edge_tools": ("social_enrichment",),
    },
    "market_position": {
        "required": ("__self__",),
        "edge_tools": ("market_analysis_ai", "market_signal_scorer"),
    },
    "market_trajectory": {
        "required": ("__self__",),
        "edge_tools": ("market_analysis_ai", "market_signal_scorer"),
    },
    "cmo_priority_actions": {
        "required": ("__self__",),
        "edge_tools": ("market_analysis_ai",),
    },
    "cmo_executive_brief": {
        "required": ("__self__",),
        "edge_tools": ("market_analysis_ai", "deep_web_recon"),
    },
    "executive_summary": {
        "required": ("__self__",),
        "edge_tools": ("deep_web_recon",),
    },
    # seo_html_hygiene does NOT depend on edge tools — it's backend-derived
    # from scraped HTML. Its state is derived only from field presence.
    "seo_html_hygiene": {
        "required": ("score", "strengths", "gaps"),
        "edge_tools": (),  # purely local HTML heuristic
    },
}


def _edge_status_ok(edge_tool_statuses: Mapping[str, Any], tool_name: str) -> bool:
    """Check if a named edge tool succeeded per the backend's edge-tool summary."""
    entry = edge_tool_statuses.get(tool_name)
    if not isinstance(entry, dict):
        return False
    return bool(entry.get("ok"))


def _any_edge_ok(edge_tool_statuses: Mapping[str, Any], tools: Iterable[str]) -> bool:
    """True if ANY of the named tools succeeded (for sections powered by multiple tools)."""
    for t in tools:
        if _edge_status_ok(edge_tool_statuses, t):
            return True
    return False


def _all_edges_required(
    edge_tool_statuses: Mapping[str, Any],
    tools: Iterable[str],
) -> bool:
    """True if ALL of the named tools succeeded. Used for strict sections."""
    tools_list = list(tools)
    if not tools_list:
        return True  # no edge tools required → pass-through
    for t in tools_list:
        if not _edge_status_ok(edge_tool_statuses, t):
            return False
    return True


def _derive_section_state(
    section_name: str,
    section_value: Any,
    edge_tool_statuses: Mapping[str, Any],
) -> ExternalState:
    """Derive ExternalState for a section from field presence + edge success."""
    criteria = SECTION_CRITERIA.get(section_name)
    if criteria is None:
        # Unknown section — can't assess; pass as DATA_AVAILABLE (caller's risk).
        return ExternalState.DATA_AVAILABLE

    required = criteria["required"]
    edge_tools = criteria["edge_tools"]

    # Determine field completeness.
    fields_ok = True
    if required == ("__self__",):
        fields_ok = not _is_empty_or_zero(section_value)
    elif isinstance(section_value, dict):
        for field in required:
            if _is_empty_or_zero(section_value.get(field)):
                fields_ok = False
                break
    else:
        # Section expected to be a dict but isn't — data not available.
        fields_ok = False

    # Determine edge-tool success.
    edges_ok = _any_edge_ok(edge_tool_statuses, edge_tools) if edge_tools else True

    if fields_ok and edges_ok:
        return ExternalState.DATA_AVAILABLE
    if fields_ok and not edges_ok:
        # Data is present but provenance suspect — still partial/degraded.
        return ExternalState.DEGRADED
    if not fields_ok and edges_ok:
        # Edge ran OK but field is empty — we just don't have enough signal.
        return ExternalState.INSUFFICIENT_SIGNAL
    # Neither — the supplier failed.
    return ExternalState.DATA_UNAVAILABLE


def _blank_section_for_state(section_name: str, state: ExternalState) -> Dict[str, Any]:
    """Return a customer-safe section skeleton when data is not available."""
    return {
        "state": state.value,
        "message": _section_message(section_name),
        "score": None,
        "status": None,
    }


# ─── Main enrichment sanitizer ────────────────────────────────────────────

def sanitize_enrichment_for_external(
    enrichment: Optional[Mapping[str, Any]],
    edge_tool_statuses: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    """Transform a full `business_dna_enrichment.enrichment` dict into a
    frontend-safe shape.

    - Strips ALL internal keys (`ai_errors`, `_http_status`, `correlation`,
      edge-tools status blob, proxy request ids, trace arrays, etc.).
    - Annotates each known intelligence section with `{state, message,
      score, status}` where `state ∈ ExternalState`.
    - When a section's state is not DATA_AVAILABLE, nulls out its numeric/
      text fields and attaches the contract-approved uncertainty message.
    - Scrubs the `sources` sub-tree of `edge_tools` entirely (those are
      backend audit only).
    - Never leaks a supplier name, internal code, or HTTP status.

    Args:
        enrichment: The raw enrichment dict from `business_dna_enrichment`
            or from the `/enrichment/website` live response. May be None.
        edge_tool_statuses: Optional map of `{edge_tool_snake_name: {ok:bool, ...}}`.
            Typically derived from `enrichment['sources']['edge_tools']`.
            When omitted, all edge tools are assumed failed.

    Returns:
        A new dict. The input is not mutated.
    """
    if enrichment is None:
        return {"state": ExternalState.PROCESSING.value, "enrichment": None}

    if not isinstance(enrichment, Mapping):
        return {"state": ExternalState.DEGRADED.value, "enrichment": None}

    # Derive statuses from the enrichment itself if not provided.
    if edge_tool_statuses is None:
        try:
            raw_sources = enrichment.get("sources") or {}
            if isinstance(raw_sources, Mapping):
                et = raw_sources.get("edge_tools") or {}
                if isinstance(et, Mapping):
                    edge_tool_statuses = dict(et)
                else:
                    edge_tool_statuses = {}
            else:
                edge_tool_statuses = {}
        except Exception:
            edge_tool_statuses = {}

    # Start from a deep-scrubbed copy.
    scrubbed = _scrub_internal_keys(enrichment)
    if not isinstance(scrubbed, dict):
        return {"state": ExternalState.DEGRADED.value, "enrichment": None}

    # Drop `sources` entirely from the external payload — it's backend audit.
    scrubbed.pop("sources", None)

    # For each known section, annotate with state + substitute uncertainty
    # text when not DATA_AVAILABLE.
    section_states: Dict[str, ExternalState] = {}
    for section_name in list(scrubbed.keys()):
        if section_name not in SECTION_CRITERIA:
            continue
        section_value = scrubbed.get(section_name)
        state = _derive_section_state(section_name, section_value, edge_tool_statuses)
        section_states[section_name] = state
        if state == ExternalState.DATA_AVAILABLE:
            # Keep the existing data but annotate the state.
            if isinstance(section_value, dict):
                section_value_annotated = dict(section_value)
                section_value_annotated["state"] = state.value
                scrubbed[section_name] = section_value_annotated
            # For list/primitive sections (e.g. competitors), leave as-is;
            # the outer top-level state will communicate availability.
        else:
            # Replace with the customer-safe skeleton.
            # This is intentional per the v2 contract: fabricated scores
            # (e.g. seo_analysis.score=80 when SEMrush failed) MUST NOT
            # leak through. The blank skeleton IS the contract. Frontend
            # consumers (CMO page) handle envelope detection themselves
            # via defensive rendering.
            scrubbed[section_name] = _blank_section_for_state(section_name, state)

    # Ensure any sections that SHOULD exist but are missing entirely get the
    # skeleton too.
    for section_name in SECTION_CRITERIA:
        if section_name not in scrubbed:
            state = _derive_section_state(section_name, None, edge_tool_statuses)
            section_states[section_name] = state
            if state != ExternalState.DATA_AVAILABLE:
                scrubbed[section_name] = _blank_section_for_state(section_name, state)

    # Roll up a top-level state from the sections.
    top_state = _roll_up_top_state(section_states)

    return {"state": top_state.value, "enrichment": scrubbed}


def _roll_up_top_state(section_states: Mapping[str, ExternalState]) -> ExternalState:
    """Combine per-section states into a single top-level state.

    Rules:
        - If any section is PROCESSING → top = PROCESSING
        - If all sections are DATA_AVAILABLE → top = DATA_AVAILABLE
        - If all sections are DATA_UNAVAILABLE → top = DATA_UNAVAILABLE
        - Otherwise → top = DEGRADED
    """
    if not section_states:
        return ExternalState.DEGRADED
    values = list(section_states.values())
    if any(v == ExternalState.PROCESSING for v in values):
        return ExternalState.PROCESSING
    if all(v == ExternalState.DATA_AVAILABLE for v in values):
        return ExternalState.DATA_AVAILABLE
    if all(v == ExternalState.DATA_UNAVAILABLE for v in values):
        return ExternalState.DATA_UNAVAILABLE
    return ExternalState.DEGRADED


# ─── Contract enforcement ────────────────────────────────────────────────

def _stringify(payload: Any) -> str:
    """Best-effort string serialization for banned-token scanning."""
    import json
    try:
        return json.dumps(payload, default=str)
    except Exception:
        return str(payload)


def assert_no_banned_tokens(
    payload: Any,
    *,
    banned: Iterable[str] = ALL_BANNED_TOKENS,
    source: str = "unknown",
) -> None:
    """Raise `ExternalContractViolation` if any banned token appears in `payload`.

    Use in unit tests + integration tests + (optionally) at the FastAPI
    response boundary. `source` is surfaced in the exception message to
    aid diagnosis when a violation is caught in CI.
    """
    serialized = _stringify(payload)
    violations: List[str] = []
    for token in banned:
        if token and token in serialized:
            violations.append(token)
    if violations:
        raise ExternalContractViolation(
            f"External contract violation from '{source}': "
            f"banned tokens found in payload: {violations[:8]}"
            + (f" (+{len(violations)-8} more)" if len(violations) > 8 else "")
        )


__all__ = [
    "ExternalState",
    "InternalErrorType",
    "TYPE_TO_STATE",
    "SECTION_CRITERIA",
    "SECTION_UNCERTAINTY_MESSAGE",
    "ALL_BANNED_TOKENS",
    "scrub_response_for_external",
    "ExternalContractViolation",
    "sanitize_error_for_external",
    "sanitize_edge_passthrough",
    "sanitize_enrichment_for_external",
    "assert_no_banned_tokens",
]
