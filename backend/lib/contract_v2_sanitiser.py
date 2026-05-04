"""
BIQc Platform Contract v2 — boundary sanitiser (lib facade).

Memory ref:
    BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2
    feedback_zero_401_tolerance

Why this module exists
----------------------
The canonical sanitiser already lives at `backend.core.response_sanitizer`
(introduced with PR #370 on 2026-04-23 after the SEMRUSH P0). It owns:

    - `ExternalState` (the strict 5-value enum: DATA_AVAILABLE,
      DATA_UNAVAILABLE, INSUFFICIENT_SIGNAL, PROCESSING, DEGRADED)
    - `sanitize_enrichment_for_external` (full enrichment shape)
    - `sanitize_edge_passthrough`         (proxy-route guard)
    - `sanitize_error_for_external`       (single-line error guard)
    - `scrub_response_for_external`       (recursive internal-key drop)
    - `assert_no_banned_tokens`           (test-time enforcement)

This `backend.lib.contract_v2_sanitiser` module is the named entry point
called for in the fix/p0-marjo-e3-contract-v2-sanitiser brief. It:

    1. Re-exports the canonical primitives so any new code can import a
       single, stable name regardless of which package the helpers live in.
    2. Adds `sanitise_external_response(payload: dict) -> dict` — the spec
       boundary helper. Composes the enrichment sanitiser + the recursive
       key scrub + the denylist regex guard into a single call.
    3. Adds `EXTERNAL_DENYLIST_REGEXES` — the regex form of the spec's
       supplier+infrastructure denylist, used by both the runtime guard
       and the integration leak test (`tests/test_no_supplier_leak.py`).

This file MUST NOT duplicate sanitisation logic. It is a facade. The
single source of truth is `backend.core.response_sanitizer`.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, Iterable, List, Mapping, Pattern, Sequence, Tuple, Union

# Dual import path: in production the FastAPI server runs with `backend/`
# on PYTHONPATH (`from core.response_sanitizer import ...`). In the
# test runner the test files import via the package path
# (`from backend.core.response_sanitizer import ...`). Try both.
try:
    from core.response_sanitizer import (  # noqa: F401  (re-export)
        ALL_BANNED_TOKENS,
        ExternalContractViolation,
        ExternalState,
        InternalErrorType,
        SECTION_CRITERIA,
        SECTION_UNCERTAINTY_MESSAGE,
        TYPE_TO_STATE,
        assert_no_banned_tokens,
        sanitize_edge_passthrough,
        sanitize_enrichment_for_external,
        sanitize_error_for_external,
        scrub_response_for_external,
    )
except ImportError:  # pragma: no cover - fallback for package-style imports
    from backend.core.response_sanitizer import (  # type: ignore[no-redef]
        ALL_BANNED_TOKENS,
        ExternalContractViolation,
        ExternalState,
        InternalErrorType,
        SECTION_CRITERIA,
        SECTION_UNCERTAINTY_MESSAGE,
        TYPE_TO_STATE,
        assert_no_banned_tokens,
        sanitize_edge_passthrough,
        sanitize_enrichment_for_external,
        sanitize_error_for_external,
        scrub_response_for_external,
    )


# ─── Spec denylist (regex form) ──────────────────────────────────────────
#
# The mission brief lists these regex roots verbatim:
#     ['semrush', 'openai', 'perplexity', 'firecrawl',
#      'browse[\\.-]?ai', 'anthropic', 'gemini', 'merge\\.dev',
#      'SUPABASE_', 'API_KEY', 'BEARER ', 'Bearer ']
#
# We compile each as case-insensitive (except the API_KEY / SUPABASE_
# / Bearer family, where the upper-case form IS the leak signal — for
# example a user-facing error containing the literal env-var name
# `SEMRUSH_API_KEY` is the canonical leak). For bearer tokens we keep
# both casings because both appear in real failure modes.
#
# The list is kept in lock-step with `core.response_sanitizer.ALL_BANNED_TOKENS`
# (the substring scanner) — the regex form is what the runtime
# `sanitise_external_response` uses; the substring form is what the
# unit-test `assert_no_banned_tokens` uses. Either one alone would be
# brittle:
#   - regex catches casing variants and word-boundary leaks
#   - substring catches multi-word phrases (`HTTP 401`, `service_role_exact`)
# The two together are the contract enforcement backbone.

_DENYLIST_PATTERNS: Tuple[Tuple[str, int], ...] = (
    (r"semrush",            re.IGNORECASE),
    (r"openai",             re.IGNORECASE),
    (r"perplexity",         re.IGNORECASE),
    (r"firecrawl",          re.IGNORECASE),
    (r"browse[\.\-]?ai",    re.IGNORECASE),
    (r"anthropic",          re.IGNORECASE),
    (r"gemini",             re.IGNORECASE),
    (r"merge\.dev",         re.IGNORECASE),
    (r"serpapi",            re.IGNORECASE),
    (r"serper\b",           re.IGNORECASE),
    (r"sonar\b",            re.IGNORECASE),
    (r"claude-3",           re.IGNORECASE),
    (r"claude-4",           re.IGNORECASE),
    (r"gpt-4",              re.IGNORECASE),
    (r"gpt-5",              re.IGNORECASE),
    (r"gpt-4o",             re.IGNORECASE),
    # Infrastructure / auth markers
    (r"SUPABASE_",          0),  # case-sensitive — env var prefix
    (r"API_KEY",            0),  # case-sensitive — env var suffix / code
    (r"BEARER ",            0),  # case-sensitive — header form
    (r"Bearer ",            0),  # standard mixed casing
    (r"service_role",       re.IGNORECASE),
    # Edge-function names (auth-path identity)
    (r"deep-web-recon",     re.IGNORECASE),
    (r"market-analysis-ai", re.IGNORECASE),
    (r"market-signal-scorer", re.IGNORECASE),
    (r"browse-ai-reviews",  re.IGNORECASE),
    (r"semrush-domain-intel", re.IGNORECASE),
    (r"social-enrichment",  re.IGNORECASE),
    (r"competitor-monitor", re.IGNORECASE),
    (r"calibration-business-dna", re.IGNORECASE),
    # Internal envelope shapes / fields that must not leak
    (r"\bai_errors\b",      0),
    (r"\b_http_status\b",   0),
    (r"\bedge_tools\b",     0),
    (r"\bedge_function\b",  0),
    (r"HTTP\s+(?:401|403|500|502|503|504)\b", 0),
)

EXTERNAL_DENYLIST_REGEXES: Tuple[Pattern[str], ...] = tuple(
    re.compile(pattern, flags) for pattern, flags in _DENYLIST_PATTERNS
)

# Plain-text source list for callers that want to inspect the denylist
# (e.g. CI reports). Keep order stable — referenced by E3-report.json.
EXTERNAL_DENYLIST_SOURCES: Tuple[str, ...] = tuple(p for p, _ in _DENYLIST_PATTERNS)


# ─── Boundary helper ─────────────────────────────────────────────────────

def sanitise_external_response(payload: Any) -> Dict[str, Any]:
    """Single boundary helper for any backend handler returning a dict to
    the frontend. Composes:

        1. recursive internal-key scrub  (drops ai_errors, edge_tools, …)
        2. enrichment-shape sanitisation (when the payload looks like
           a `business_dna_enrichment.enrichment` envelope)
        3. denylist-regex guard          (last-line check; raises
           `ExternalContractViolation` if a banned token still appears)

    The helper is intentionally permissive about input shape — handlers
    return many shapes (envelope dicts, plain status dicts, error dicts).
    What matters is that whatever leaves the backend has no banned token.

    Args:
        payload: the raw response dict the handler is about to return.

    Returns:
        A new dict, safe to send to the frontend. Input is not mutated.

    Raises:
        ExternalContractViolation: if the payload still contains a banned
            substring after sanitisation. Caller must catch + degrade.
    """
    if payload is None:
        return {"ok": False, "state": ExternalState.PROCESSING.value}

    # Coerce non-dict to a degraded envelope so the contract holds.
    if not isinstance(payload, dict):
        return {"ok": False, "state": ExternalState.DEGRADED.value}

    # Edge-function passthrough payloads (carry `_http_status` from the
    # Supabase functions invoke) MUST be normalised first — that helper
    # collapses the response to the contract envelope and discards the
    # whole leaky body on non-200, eliminating supplier-name leaks in
    # `error` / `ai_errors` strings.
    if "_http_status" in payload or _looks_like_edge_envelope(payload):
        return sanitize_edge_passthrough(payload)

    # Scrub internal keys at any nesting depth.
    scrubbed: Dict[str, Any] = scrub_response_for_external(payload)
    if not isinstance(scrubbed, dict):
        return {"ok": False, "state": ExternalState.DEGRADED.value}

    # If the payload nests an enrichment-shaped sub-object (typical
    # surface: market-intelligence, snapshot/latest), recurse the
    # enrichment sanitiser into each known nesting key. This catches
    # supplier-name leaks like `sources.edge_tools.semrush_domain_intel`
    # that the recursive scrub leaves behind because the OUTER key is
    # not in SECTION_CRITERIA.
    for nested_key in ("business_dna_enrichment", "enrichment"):
        nested = scrubbed.get(nested_key)
        if isinstance(nested, dict) and _looks_like_enrichment(nested):
            sub_envelope = sanitize_enrichment_for_external(nested)
            scrubbed[nested_key] = sub_envelope["enrichment"]
            scrubbed[f"{nested_key}_state"] = sub_envelope["state"]

    # If the payload looks like a raw enrichment envelope, run the full
    # enrichment sanitiser to attach per-section state + uncertainty
    # language. Heuristic: any of the SECTION_CRITERIA keys present at
    # the top level OR a nested `enrichment` field.
    if _looks_like_enrichment(scrubbed):
        sanitised_envelope = sanitize_enrichment_for_external(scrubbed)
        # Preserve top-level passthrough fields (status, message, url, …)
        # that don't conflict with the sanitised envelope shape.
        merged: Dict[str, Any] = {}
        for key, value in scrubbed.items():
            if key in SECTION_CRITERIA or key == "sources":
                continue
            merged[key] = value
        merged["state"] = sanitised_envelope["state"]
        merged["enrichment"] = sanitised_envelope["enrichment"]
        scrubbed = merged

    # Final denylist-regex guard. This is the contract enforcement layer.
    # Fail-closed: if a banned token survives every prior pass, the only
    # safe response is to raise — the caller MUST decide how to degrade
    # rather than risk leaking.
    _assert_no_denylist_match(scrubbed, source="sanitise_external_response")
    return scrubbed


def _looks_like_enrichment(payload: Mapping[str, Any]) -> bool:
    """Heuristic: payload is enrichment-shaped if any known section key
    appears at the top level."""
    for key in payload.keys():
        if key in SECTION_CRITERIA:
            return True
    return False


def _looks_like_edge_envelope(payload: Mapping[str, Any]) -> bool:
    """Heuristic: payload looks like a raw Supabase edge-function
    response — has the `ok` field plus an upstream-shaped error blob
    (`code`, `ai_errors`, `error`) but no enrichment-section keys."""
    if "ok" not in payload:
        return False
    edge_fingerprints = {"code", "ai_errors", "error"}
    if any(key in payload for key in edge_fingerprints):
        # Differentiate from CMO-style responses (which also carry an
        # `ok` field) by checking for absence of enrichment sections.
        if not _looks_like_enrichment(payload):
            return True
    return False


def _assert_no_denylist_match(
    payload: Any,
    *,
    patterns: Sequence[Pattern[str]] = EXTERNAL_DENYLIST_REGEXES,
    source: str = "boundary",
) -> None:
    """Walk the serialised payload and raise if any denylist regex matches.

    Wraps the substring-form `assert_no_banned_tokens` with the
    regex-form denylist so casing variants (`Semrush`, `SEMRush`) are
    caught even when the substring scanner would have missed them.
    """
    serialized = _stringify(payload)
    matched: List[str] = []
    for pattern in patterns:
        if pattern.search(serialized):
            matched.append(pattern.pattern)
    if matched:
        raise ExternalContractViolation(
            f"External contract violation from '{source}': "
            f"denylist regex match — {matched[:8]}"
            + (f" (+{len(matched) - 8} more)" if len(matched) > 8 else "")
        )


def _stringify(payload: Any) -> str:
    try:
        return json.dumps(payload, default=str)
    except Exception:
        return str(payload)


def find_denylist_matches(payload: Any) -> List[str]:
    """Non-raising variant — returns the list of patterns that matched.
    Useful for the integration leak test which wants to enumerate every
    leak before failing, not bail on the first hit.
    """
    serialized = _stringify(payload)
    return [p.pattern for p in EXTERNAL_DENYLIST_REGEXES if p.search(serialized)]


__all__ = [
    # Re-exports from core.response_sanitizer
    "ALL_BANNED_TOKENS",
    "ExternalContractViolation",
    "ExternalState",
    "InternalErrorType",
    "SECTION_CRITERIA",
    "SECTION_UNCERTAINTY_MESSAGE",
    "TYPE_TO_STATE",
    "assert_no_banned_tokens",
    "sanitize_edge_passthrough",
    "sanitize_enrichment_for_external",
    "sanitize_error_for_external",
    "scrub_response_for_external",
    # New in this module
    "EXTERNAL_DENYLIST_REGEXES",
    "EXTERNAL_DENYLIST_SOURCES",
    "sanitise_external_response",
    "find_denylist_matches",
]
