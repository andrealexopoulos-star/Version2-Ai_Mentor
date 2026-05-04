"""Per-scan provider-call trace persistence.

P0 Marjo E2 — created 2026-05-04 to close the audit gap surfaced in PR #449:
provider calls (Firecrawl, Perplexity, OpenAI, Anthropic, Gemini, ABR, plus
the Supabase edge functions that compose them) were not consistently traced
to a per-scan persistence layer. Without per-call rows linked to a scan_id,
the CMO Report and the daily check could not prove which provider returned
what evidence — every section became unverifiable.

Contract: every provider call during a URL scan persists a trace row to
public.enrichment_traces. Each call writes exactly TWO state transitions:

  1. begin_trace(scan_id, provider, ...) → returns trace_id, writes a
     "started" row with http_status NULL and called_at = now().
  2. complete_trace(trace_id, http_status, ...) → updates the same row
     with latency_ms, http_status, response_summary, evidence_hash, error.

If the call site crashes between (1) and (2), the orphaned "started" row is
itself the audit trail — we know we attempted the call and never returned.
The CMO audit pane and daily-check surface count rows where http_status IS
NULL AND created_at < now() - interval '5 minutes' as "abandoned".

Single-call convenience wrapper:

  record_provider_trace(
      scan_id=..., provider="firecrawl", request_summary={...},
      response_summary={...}, http_status=200, latency_ms=842,
  )

…writes one row directly when the caller already has the full result
(used by `_call_edge_function` and the LLM router post-call paths).

Design rules
------------
- Never raises. A telemetry failure must never break the scan path.
- Uses the service-role Supabase client (writes bypass RLS).
- Co-exists with `provider_tracker` (which feeds the per-PROVIDER tally
  table `provider_usage`). Both helpers can be called for the same event.
- Sanitiser-aware: callers pass `sanitiser_applied=True` after they have
  routed `response_summary` through the centralised sanitizer.
- Cites BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2 + zero-401.
"""
from __future__ import annotations

import asyncio
import contextvars
import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Mapping, Optional

logger = logging.getLogger(__name__)


# ─── Active scan context ────────────────────────────────────────────────
# ContextVar so deep helpers (serper_search, _openai_chat, _anthropic_chat,
# _gemini_chat) can read the active scan_id and user_id WITHOUT every call
# site threading them through. Set once at the top of the scan branch in
# website_enrichment(); reset on exit. Leaks across requests are prevented
# by ContextVar's per-task isolation in asyncio.
_active_scan_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "biqc_active_scan_id", default=None,
)
_active_user_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "biqc_active_user_id", default=None,
)


def get_active_scan_id() -> Optional[str]:
    """Return the scan_id set by the current request, or None."""
    try:
        return _active_scan_id.get()
    except Exception:
        return None


def get_active_user_id() -> Optional[str]:
    """Return the user_id set by the current request, or None."""
    try:
        return _active_user_id.get()
    except Exception:
        return None


def set_active_scan(scan_id: Optional[str], user_id: Optional[str] = None) -> tuple:
    """Bind scan_id (and optionally user_id) to the current async task.

    Returns the two ContextVar tokens — pass them to clear_active_scan() in
    a try/finally to restore the previous value (or None).
    """
    sid_token = _active_scan_id.set(scan_id)
    uid_token = _active_user_id.set(user_id)
    return (sid_token, uid_token)


def clear_active_scan(tokens) -> None:
    """Restore the previous ContextVar values. Safe to call with None tokens."""
    if not tokens:
        return
    try:
        sid_token, uid_token = tokens
    except Exception:
        return
    try:
        if sid_token is not None:
            _active_scan_id.reset(sid_token)
    except Exception:
        pass
    try:
        if uid_token is not None:
            _active_user_id.reset(uid_token)
    except Exception:
        pass


# ─── Provider catalogue ─────────────────────────────────────────────────
# Lower-case slugs. INTERNAL only — never echo to a frontend response.
# Add new vendors here, NOT via a migration (column is text, not enum).
ALLOWED_PROVIDERS = frozenset({
    # LLM providers
    "openai", "anthropic", "gemini",
    # Web/search/SEO providers
    "firecrawl", "perplexity", "semrush", "browse_ai", "serper",
    # Government / business identity
    "abr",
    # Integration aggregators
    "merge",
    # Platform-internal
    "supabase",
})

# Edge-function name → provider it primarily calls. Used by the calibration
# patch to derive the upstream supplier slug from the edge-function name
# without each call site having to specify both. The 7 calibration edge
# functions documented in feedback_zero_401_tolerance.md.
EDGE_FUNCTION_TO_PROVIDER: Dict[str, str] = {
    # Direct supplier proxies
    "deep-web-recon":         "perplexity",
    "social-enrichment":      "perplexity",
    "competitor-monitor":     "perplexity",
    "market-analysis-ai":     "perplexity",
    "market-signal-scorer":   "perplexity",
    "browse-ai-reviews":      "browse_ai",
    "semrush-domain-intel":   "semrush",
    "calibration-business-dna": "openai",
    "business-identity-lookup": "abr",
    "calibration-sync":       "supabase",
    "warm-cognitive-engine":  "supabase",
}


def _is_known_provider(slug: str) -> bool:
    return isinstance(slug, str) and slug.strip().lower() in ALLOWED_PROVIDERS


def _normalise_provider(slug: str) -> str:
    return (slug or "").strip().lower()


def _hash_response(payload: Any) -> Optional[str]:
    """sha256 of canonicalised JSON for de-dup. None on any failure."""
    if payload is None:
        return None
    try:
        canonical = json.dumps(payload, sort_keys=True, default=str, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    except Exception as exc:  # pragma: no cover — telemetry must never raise
        logger.debug("[enrichment_trace] hash failed: %s", exc)
        return None


def _coerce_uuid(value: Any) -> Optional[str]:
    """Return a UUID string or None. Accepts uuid.UUID and string forms."""
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return str(value)
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        return None


def new_scan_id() -> str:
    """Mint a fresh scan_id uuid for the calibration entry point.

    Centralised so callers don't sprinkle uuid4() across the codebase and
    so we can swap the scheme later (e.g. ULID for time-orderability)
    without touching every call site.
    """
    return str(uuid.uuid4())


def _get_sb_client():
    """Return a Supabase service-role client, or None if unavailable.

    Late import — this module loads in every backend boot, but the
    supabase_client module pulls in env vars that may not exist at import
    time in tests.
    """
    try:
        from supabase_client import get_supabase_client
        return get_supabase_client()
    except Exception as exc:  # pragma: no cover
        logger.debug("[enrichment_trace] sb client unavailable: %s", exc)
        return None


def _build_payload(
    *,
    scan_id: str,
    provider: str,
    edge_function: Optional[str],
    user_id: Optional[str],
    business_profile_id: Optional[str],
    attempt: int,
    latency_ms: Optional[int],
    http_status: Optional[int],
    request_summary: Optional[Mapping[str, Any]],
    response_summary: Optional[Mapping[str, Any]],
    evidence_hash: Optional[str],
    error: Optional[str],
    sanitiser_applied: bool,
    metadata: Optional[Mapping[str, Any]],
    called_at: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Build the row dict for an insert/update. Pure function — no I/O."""
    iso = (called_at or datetime.now(timezone.utc)).isoformat()
    payload: Dict[str, Any] = {
        "scan_id": scan_id,
        "provider": _normalise_provider(provider),
        "attempt": int(attempt or 1),
        "called_at": iso,
        "sanitiser_applied": bool(sanitiser_applied),
    }
    if edge_function:
        payload["edge_function"] = str(edge_function)[:120]
    if user_id:
        payload["user_id"] = user_id
    if business_profile_id:
        payload["business_profile_id"] = business_profile_id
    if latency_ms is not None:
        payload["latency_ms"] = int(latency_ms)
    if http_status is not None:
        payload["http_status"] = int(http_status)
    if request_summary is not None:
        payload["request_summary"] = dict(request_summary)
    if response_summary is not None:
        payload["response_summary"] = dict(response_summary)
    if evidence_hash:
        payload["evidence_hash"] = str(evidence_hash)[:128]
    if error:
        payload["error"] = str(error)[:480]
    if metadata:
        payload["metadata"] = dict(metadata)
    return payload


# ─── Public API ─────────────────────────────────────────────────────────


def record_provider_trace(
    *,
    scan_id: str,
    provider: str,
    request_summary: Optional[Mapping[str, Any]] = None,
    response_summary: Optional[Mapping[str, Any]] = None,
    http_status: Optional[int] = None,
    latency_ms: Optional[int] = None,
    edge_function: Optional[str] = None,
    user_id: Optional[str] = None,
    business_profile_id: Optional[str] = None,
    attempt: int = 1,
    error: Optional[str] = None,
    sanitiser_applied: bool = False,
    evidence_payload: Any = None,
    metadata: Optional[Mapping[str, Any]] = None,
    sb=None,
) -> Optional[str]:
    """Single-call helper — write one finished trace row.

    Use when the caller already has the full result. Returns the inserted
    row's id (uuid str) on success, None on any failure (telemetry must
    never raise).

    `evidence_payload` (optional) is the raw response body used to compute
    the evidence_hash for de-dup. NOT stored — only its hash.
    """
    if not scan_id:
        logger.debug("[enrichment_trace] skipping insert — scan_id empty")
        return None
    if not _is_known_provider(provider):
        logger.warning("[enrichment_trace] unknown provider slug: %s", provider)
        return None

    client = sb if sb is not None else _get_sb_client()
    if client is None:
        return None

    evidence_hash = _hash_response(evidence_payload) if evidence_payload is not None else None

    payload = _build_payload(
        scan_id=scan_id,
        provider=provider,
        edge_function=edge_function,
        user_id=_coerce_uuid(user_id),
        business_profile_id=_coerce_uuid(business_profile_id),
        attempt=attempt,
        latency_ms=latency_ms,
        http_status=http_status,
        request_summary=request_summary,
        response_summary=response_summary,
        evidence_hash=evidence_hash,
        error=error,
        sanitiser_applied=sanitiser_applied,
        metadata=metadata,
    )

    try:
        result = client.table("enrichment_traces").insert(payload).execute()
        rows = getattr(result, "data", None) or []
        if rows and isinstance(rows, list) and isinstance(rows[0], dict):
            return rows[0].get("id")
        return None
    except Exception as exc:  # pragma: no cover — telemetry must never raise
        logger.warning(
            "[enrichment_trace] insert failed for provider=%s scan=%s: %s",
            provider, scan_id, exc,
        )
        return None


def begin_trace(
    *,
    scan_id: str,
    provider: str,
    edge_function: Optional[str] = None,
    user_id: Optional[str] = None,
    business_profile_id: Optional[str] = None,
    attempt: int = 1,
    request_summary: Optional[Mapping[str, Any]] = None,
    metadata: Optional[Mapping[str, Any]] = None,
    sb=None,
) -> Optional[str]:
    """Pre-call — write a "started" row, return its id.

    Caller MUST follow up with complete_trace(trace_id, ...). If caller
    crashes mid-flight the row remains visible with http_status NULL,
    which is itself the audit signal "we attempted but never returned".
    """
    if not scan_id:
        return None
    if not _is_known_provider(provider):
        logger.warning("[enrichment_trace] begin_trace unknown provider: %s", provider)
        return None

    client = sb if sb is not None else _get_sb_client()
    if client is None:
        return None

    payload = _build_payload(
        scan_id=scan_id,
        provider=provider,
        edge_function=edge_function,
        user_id=_coerce_uuid(user_id),
        business_profile_id=_coerce_uuid(business_profile_id),
        attempt=attempt,
        latency_ms=None,
        http_status=None,
        request_summary=request_summary,
        response_summary=None,
        evidence_hash=None,
        error=None,
        sanitiser_applied=False,
        metadata=metadata,
    )

    try:
        result = client.table("enrichment_traces").insert(payload).execute()
        rows = getattr(result, "data", None) or []
        if rows and isinstance(rows, list) and isinstance(rows[0], dict):
            return rows[0].get("id")
        return None
    except Exception as exc:  # pragma: no cover
        logger.warning(
            "[enrichment_trace] begin_trace insert failed for %s/%s: %s",
            provider, scan_id, exc,
        )
        return None


def complete_trace(
    trace_id: Optional[str],
    *,
    http_status: Optional[int],
    latency_ms: Optional[int] = None,
    response_summary: Optional[Mapping[str, Any]] = None,
    error: Optional[str] = None,
    evidence_payload: Any = None,
    sanitiser_applied: bool = False,
    sb=None,
) -> bool:
    """Post-call — update the row written by begin_trace.

    If trace_id is None (e.g. begin_trace failed), this is a no-op and
    returns False. The scan path proceeds as if telemetry succeeded.
    """
    if not trace_id:
        return False
    client = sb if sb is not None else _get_sb_client()
    if client is None:
        return False

    update: Dict[str, Any] = {
        "sanitiser_applied": bool(sanitiser_applied),
    }
    if http_status is not None:
        update["http_status"] = int(http_status)
    if latency_ms is not None:
        update["latency_ms"] = int(latency_ms)
    if response_summary is not None:
        update["response_summary"] = dict(response_summary)
    if error:
        update["error"] = str(error)[:480]
    if evidence_payload is not None:
        h = _hash_response(evidence_payload)
        if h:
            update["evidence_hash"] = h

    try:
        client.table("enrichment_traces").update(update).eq("id", trace_id).execute()
        return True
    except Exception as exc:  # pragma: no cover
        logger.warning(
            "[enrichment_trace] complete_trace update failed for id=%s: %s",
            trace_id, exc,
        )
        return False


# ─── Async wrappers ─────────────────────────────────────────────────────
# Wrap the sync helpers with run_in_executor so async call sites (the
# entire calibration scan path is async) do not block the event loop on
# the supabase HTTP round-trip.


async def arecord_provider_trace(**kwargs) -> Optional[str]:
    """Async wrapper around record_provider_trace.

    Off-loads the sync supabase call to the default executor. Never
    raises — wraps the underlying helper which already swallows.
    """
    loop = asyncio.get_event_loop()
    try:
        return await loop.run_in_executor(None, lambda: record_provider_trace(**kwargs))
    except Exception as exc:  # pragma: no cover
        logger.debug("[enrichment_trace] async wrapper failed: %s", exc)
        return None


async def abegin_trace(**kwargs) -> Optional[str]:
    """Async wrapper around begin_trace."""
    loop = asyncio.get_event_loop()
    try:
        return await loop.run_in_executor(None, lambda: begin_trace(**kwargs))
    except Exception as exc:  # pragma: no cover
        logger.debug("[enrichment_trace] async begin failed: %s", exc)
        return None


async def acomplete_trace(trace_id: Optional[str], **kwargs) -> bool:
    """Async wrapper around complete_trace."""
    loop = asyncio.get_event_loop()
    try:
        return await loop.run_in_executor(None, lambda: complete_trace(trace_id, **kwargs))
    except Exception as exc:  # pragma: no cover
        logger.debug("[enrichment_trace] async complete failed: %s", exc)
        return False


# ─── Read-side: per-scan summaries ──────────────────────────────────────


def fetch_scan_provider_chain(scan_id: str, *, sb=None) -> Dict[str, Any]:
    """Build the provider-chain audit payload for a scan.

    Returns:
      {
        "scan_id": "...",
        "trace_count": int,
        "providers": ["firecrawl","perplexity",...],   # unique slugs
        "ok_count": int,                                # rows with 2xx
        "fail_count": int,                              # rows with !=2xx
        "abandoned_count": int,                         # http_status NULL >5min
        "unsanitised_count": int,                       # sanitiser_applied=False
        "rows": [
            {
              "id":"...","provider":"...","edge_function":"...",
              "http_status":200,"latency_ms":842,
              "called_at":"...","attempt":1,
              "evidence_hash":"...","error":None,
              "request_summary":{...},"response_summary":{...},
            }, ...
        ],
      }

    The `rows` array contains raw provider names — INTERNAL only. The
    CMO Report user-facing endpoint must strip provider/edge_function/error
    via the centralised sanitizer before surfacing this to the frontend.
    The admin/audit endpoint may surface raw rows.
    """
    if not scan_id:
        return {
            "scan_id": None, "trace_count": 0, "providers": [],
            "ok_count": 0, "fail_count": 0, "abandoned_count": 0,
            "unsanitised_count": 0, "rows": [],
        }

    client = sb if sb is not None else _get_sb_client()
    if client is None:
        return {
            "scan_id": scan_id, "trace_count": 0, "providers": [],
            "ok_count": 0, "fail_count": 0, "abandoned_count": 0,
            "unsanitised_count": 0, "rows": [],
        }

    try:
        result = (
            client.table("enrichment_traces")
                  .select(
                      "id, provider, edge_function, attempt, called_at, "
                      "latency_ms, http_status, request_summary, "
                      "response_summary, evidence_hash, error, sanitiser_applied"
                  )
                  .eq("scan_id", scan_id)
                  .order("called_at", desc=False)
                  .execute()
        )
        rows = getattr(result, "data", None) or []
    except Exception as exc:  # pragma: no cover
        logger.warning("[enrichment_trace] fetch_scan_provider_chain failed: %s", exc)
        return {
            "scan_id": scan_id, "trace_count": 0, "providers": [],
            "ok_count": 0, "fail_count": 0, "abandoned_count": 0,
            "unsanitised_count": 0, "rows": [],
        }

    providers_seen: Dict[str, None] = {}
    ok_count = fail_count = abandoned_count = unsanitised = 0
    now_ts = datetime.now(timezone.utc)

    for r in rows:
        if not isinstance(r, dict):
            continue
        slug = (r.get("provider") or "").lower()
        if slug:
            providers_seen[slug] = None
        st = r.get("http_status")
        if st is None:
            # Treat as abandoned only if older than 5 minutes; otherwise
            # the call may legitimately be in flight.
            try:
                called = r.get("called_at")
                if isinstance(called, str):
                    # iso parse — fromisoformat handles +00:00 suffix
                    called_dt = datetime.fromisoformat(called.replace("Z", "+00:00"))
                    if (now_ts - called_dt).total_seconds() > 300:
                        abandoned_count += 1
            except Exception:
                pass
        elif 200 <= int(st) < 300:
            ok_count += 1
        else:
            fail_count += 1
        if not r.get("sanitiser_applied"):
            unsanitised += 1

    return {
        "scan_id": scan_id,
        "trace_count": len(rows),
        "providers": list(providers_seen.keys()),
        "ok_count": ok_count,
        "fail_count": fail_count,
        "abandoned_count": abandoned_count,
        "unsanitised_count": unsanitised,
        "rows": rows,
    }
