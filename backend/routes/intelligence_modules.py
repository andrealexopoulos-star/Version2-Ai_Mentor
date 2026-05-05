"""Intelligence module routes — ALL SQL-backed functions.
Exposes: workforce, scenarios, scores, concentration, contradictions,
pressure, freshness, silence, escalations, profile completeness,
data readiness, watchtower positions, full summary.

Instrumented with Intelligence Spine event logging.
"""
import logging
from datetime import datetime, timezone
from threading import Lock
from time import perf_counter
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from supabase_client import init_supabase
from intelligence_spine import emit_spine_event
from core.response_sanitizer import (
    scrub_response_for_external,
    sanitize_enrichment_for_external,
    ExternalState,
)
from core.section_evidence import (
    SECTION_IDS,
    OPTIONAL_SECTION_IDS,
    PLACEHOLDER_EXACT_DENYLIST,
    filter_swot_items_with_provenance,
    filter_roadmap_items_with_provenance,
    is_placeholder_string,
    make_section,
    reason_for,
    section_state_for_value,
    validate_section_evidence,
)
from cmo_truth import (
    REPORT_STATE_COMPLETE,
    REPORT_STATE_FAILED,
    REPORT_STATE_INSUFFICIENT,
    REPORT_STATE_PARTIAL,
    SECTION_DEGRADED,
    SECTION_ERROR,
    SECTION_INSUFFICIENT,
    SECTION_PLACEHOLDER,
    SECTION_SOURCE_BACKED,
    clean_string_list,
    classify_section,
    derive_report_state,
    estimate_confidence,
    is_placeholder_text,
)
# P0 Marjo E2 / 2026-05-04 — provider trace audit pane.
from core.enrichment_trace import fetch_scan_provider_chain

# R2E (2026-05-04): world-class CMO synthesis prompts that USE the deep
# R2A-D + F14/F15 enrichment data. The synthesis_prompts module owns the
# prompt construction; this route owns the orchestration (deciding when to
# call the LLM, parsing the output, applying provenance enforcement).
from core.synthesis_prompts import (
    PROMPT_ANTI_TEMPLATE_TERMS,
    build_swot_prompt,
    build_strategic_roadmap_prompt,
    build_chief_marketing_summary_prompt,
    build_executive_summary_prompt,
    build_competitive_landscape_prompt,
    build_review_intelligence_prompt,
    collect_available_competitor_names,
    collect_available_brand_metric_names,
    collect_available_trace_ids,
    has_sufficient_synthesis_inputs,
    parse_synthesis_json,
)

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user
# P0 Marjo E2 / 2026-05-04 — superadmin-only audit endpoint for raw provider traces.
from routes.deps import get_super_admin

_TRUTH_GATEWAY_CONTRACT_VERSION = "truth-gateway-v1"

_STATE_CANONICAL = "canonical"
_STATE_DEGRADED = "degraded"
_STATE_FAILED = "failed"

_TRUTH_LEVEL_VERIFIED = "verified"
_TRUTH_LEVEL_BOUNDED = "bounded"
_TRUTH_LEVEL_UNKNOWN = "unknown"

_FAILURE_TIMEOUT = "TIMEOUT"
_FAILURE_AUTH = "AUTH_FAILURE"
_FAILURE_NETWORK = "NETWORK_FAILURE"
_FAILURE_DB_UNAVAILABLE = "DB_UNAVAILABLE"
_FAILURE_RPC_FUNCTION_MISSING = "RPC_FUNCTION_MISSING"
_FAILURE_SCHEMA_MISMATCH = "SCHEMA_MISMATCH"
_FAILURE_UNKNOWN = "UNKNOWN_ERROR"
_FAILURE_OBSERVABILITY = "OBSERVABILITY_FAILURE"

_DEGRADED_HTTP_STATUS = 424
_FAILED_HTTP_STATUS = 503

_REQUIRED_COMPONENTS_BY_RPC: Dict[str, List[str]] = {
    "compute_evidence_freshness": [
        "freshness.crm",
        "freshness.accounting",
        "freshness.email",
        "freshness.marketing",
        "freshness.scrape",
    ],
    "build_intelligence_summary": [
        "system_state",
        "market_intelligence",
        "action_plan",
        "modules.freshness",
        "modules.signals",
        "modules.readiness",
    ],
}

_IMMUTABLE_SNAPSHOT_CACHE: Dict[Tuple[str, str], Dict[str, Any]] = {}
_IMMUTABLE_SNAPSHOT_LOCK = Lock()


def _safe_parse_iso(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _hours_since(value: Any) -> Optional[float]:
    parsed = _safe_parse_iso(value)
    if not parsed:
        return None
    return round(max(0.0, (datetime.now(timezone.utc) - parsed).total_seconds() / 3600.0), 2)


def _latency_ms(start: float) -> int:
    return int((perf_counter() - start) * 1000)


def _new_trace_id() -> str:
    return uuid4().hex


def _failure_retryable(failure_class: str) -> bool:
    return failure_class in {
        _FAILURE_TIMEOUT,
        _FAILURE_NETWORK,
        _FAILURE_DB_UNAVAILABLE,
        _FAILURE_UNKNOWN,
        _FAILURE_OBSERVABILITY,
    }


def _required_components(fn_name: str) -> List[str]:
    return list(_REQUIRED_COMPONENTS_BY_RPC.get(fn_name, []))


def _classify_rpc_failure(exc: Exception) -> str:
    text = str(exc or "").lower()
    if any(marker in text for marker in ("does not exist", "undefined function", "pgrst202", "not find the function")):
        return _FAILURE_RPC_FUNCTION_MISSING
    if any(
        marker in text
        for marker in (
            "schema cache",
            "pgrst204",
            "could not find the",
            "column",
            "violates check constraint",
            "23514",
        )
    ):
        return _FAILURE_SCHEMA_MISMATCH
    if any(marker in text for marker in ("timeout", "timed out", "deadline exceeded")):
        return _FAILURE_TIMEOUT
    if any(marker in text for marker in ("permission denied", "not authorized", "forbidden", "invalid token", "jwt", "401", "42501")):
        return _FAILURE_AUTH
    if any(marker in text for marker in ("network", "connection", "dns", "socket")):
        return _FAILURE_NETWORK
    if any(marker in text for marker in ("database", "db unavailable", "connection refused", "too many connections")):
        return _FAILURE_DB_UNAVAILABLE
    return _FAILURE_UNKNOWN


def _component_present(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, (list, dict, tuple, set)):
        return len(value) > 0
    if isinstance(value, str):
        return bool(value.strip())
    return True


def _extract_available_components(fn_name: str, payload_data: Any) -> List[str]:
    if not isinstance(payload_data, dict):
        return []

    available: List[str] = []
    if fn_name == "compute_evidence_freshness":
        freshness = payload_data.get("freshness")
        if isinstance(freshness, dict):
            for domain in ("crm", "accounting", "email", "marketing", "scrape"):
                component = f"freshness.{domain}"
                if _component_present(freshness.get(domain)):
                    available.append(component)
        return available

    if fn_name == "build_intelligence_summary":
        if _component_present(payload_data.get("system_state")):
            available.append("system_state")
        if _component_present(payload_data.get("market_intelligence")):
            available.append("market_intelligence")
        if _component_present(payload_data.get("action_plan")):
            available.append("action_plan")

        modules = payload_data.get("modules")
        if isinstance(modules, dict):
            for module_name in ("freshness", "signals", "readiness"):
                if _component_present(modules.get(module_name)):
                    available.append(f"modules.{module_name}")
        return available

    return available


def _compute_completeness(required_components: List[str], available_components: List[str]) -> float:
    required = list(dict.fromkeys(required_components))
    if not required:
        return 1.0
    available_set = {component for component in available_components if component in required}
    return len(available_set) / len(required)


def _cache_snapshot(fn_name: str, workspace_id: str, payload_data: Dict[str, Any]) -> None:
    cache_key = (fn_name, workspace_id)
    with _IMMUTABLE_SNAPSHOT_LOCK:
        _IMMUTABLE_SNAPSHOT_CACHE[cache_key] = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "data": payload_data,
        }


def _get_cached_snapshot(fn_name: str, workspace_id: str) -> Optional[Dict[str, Any]]:
    cache_key = (fn_name, workspace_id)
    with _IMMUTABLE_SNAPSHOT_LOCK:
        snapshot = _IMMUTABLE_SNAPSHOT_CACHE.get(cache_key)
    return dict(snapshot) if snapshot else None


def _build_contract_envelope(
    *,
    status: str,
    truth_level: str,
    fn_name: str,
    workspace_id: str,
    trace_id: str,
    latency_ms: int,
    completeness: float,
    confidence: float,
    degradation_flag: bool,
    error_class: Optional[str] = None,
    retryable: Optional[bool] = None,
    missing_components: Optional[List[str]] = None,
    broken_dependencies: Optional[List[str]] = None,
    payload_data: Optional[Dict[str, Any]] = None,
    immutable_state: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return {
        "status": status,
        "truth_level": truth_level,
        "completeness": completeness,
        "confidence": confidence,
        "trace_id": trace_id,
        "latency_ms": latency_ms,
        "error_class": error_class,
        "failure_class": error_class,
        "degradation_flag": degradation_flag,
        "rpc_function": fn_name,
        "workspace_id": workspace_id,
        "contract_version": _TRUTH_GATEWAY_CONTRACT_VERSION,
        "retryable": retryable,
        "missing_components": missing_components or [],
        "broken_dependencies": broken_dependencies or [],
        "immutable_prior_state": immutable_state or {},
        "data": payload_data or {},
    }


def _build_canonical_payload(
    *,
    fn_name: str,
    workspace_id: str,
    trace_id: str,
    latency_ms: int,
    payload_data: Dict[str, Any],
) -> Dict[str, Any]:
    return _build_contract_envelope(
        status=_STATE_CANONICAL,
        truth_level=_TRUTH_LEVEL_VERIFIED,
        fn_name=fn_name,
        workspace_id=workspace_id,
        trace_id=trace_id,
        latency_ms=latency_ms,
        completeness=1.0,
        confidence=1.0,
        degradation_flag=False,
        error_class=None,
        retryable=False,
        payload_data=payload_data,
    )


def _build_degraded_payload(
    *,
    fn_name: str,
    workspace_id: str,
    trace_id: str,
    latency_ms: int,
    failure_class: str,
) -> Dict[str, Any]:
    required = _required_components(fn_name)
    snapshot = _get_cached_snapshot(fn_name, workspace_id) or {}
    snapshot_data = snapshot.get("data") if isinstance(snapshot, dict) else {}
    available = _extract_available_components(fn_name, snapshot_data)
    completeness = _compute_completeness(required, available)
    missing = [component for component in required if component not in set(available)]

    broken_dependencies = [f"supabase_rpc.{fn_name}"]
    if failure_class == _FAILURE_SCHEMA_MISMATCH:
        broken_dependencies.append("schema_cache")
    if failure_class == _FAILURE_RPC_FUNCTION_MISSING:
        broken_dependencies.append("rpc_definition")

    immutable_state = {
        "source": "precomputed_snapshot" if snapshot else "immutable_prior_state",
        "snapshot_generated_at": snapshot.get("generated_at") if isinstance(snapshot, dict) else None,
    }
    return _build_contract_envelope(
        status=_STATE_DEGRADED,
        truth_level=_TRUTH_LEVEL_BOUNDED,
        fn_name=fn_name,
        workspace_id=workspace_id,
        trace_id=trace_id,
        latency_ms=latency_ms,
        completeness=completeness,
        confidence=completeness,
        degradation_flag=True,
        error_class=failure_class,
        retryable=_failure_retryable(failure_class),
        missing_components=missing,
        broken_dependencies=broken_dependencies,
        immutable_state=immutable_state,
        payload_data=snapshot_data if isinstance(snapshot_data, dict) else {},
    )


def _build_failed_payload(
    *,
    fn_name: str,
    workspace_id: str,
    trace_id: str,
    latency_ms: int,
    failure_class: str,
) -> Dict[str, Any]:
    return _build_contract_envelope(
        status=_STATE_FAILED,
        truth_level=_TRUTH_LEVEL_UNKNOWN,
        fn_name=fn_name,
        workspace_id=workspace_id,
        trace_id=trace_id,
        latency_ms=latency_ms,
        completeness=0.0,
        confidence=0.0,
        degradation_flag=False,
        error_class=failure_class,
        retryable=_failure_retryable(failure_class),
        missing_components=_required_components(fn_name),
        broken_dependencies=[f"supabase_rpc.{fn_name}"],
        immutable_state={"source": "none"},
        payload_data={},
    )


def _emit_truth_observability(payload: Dict[str, Any]) -> None:
    emit_spine_event(
        tenant_id=str(payload.get("workspace_id") or ""),
        event_type="MODEL_EXECUTED",
        model_name=str(payload.get("rpc_function") or ""),
        json_payload={
            "trace_id": payload.get("trace_id"),
            "truth_level": payload.get("truth_level"),
            "latency_ms": payload.get("latency_ms"),
            "failure_class": payload.get("failure_class"),
            "degradation_flag": payload.get("degradation_flag"),
            "status": payload.get("status"),
            "completeness": payload.get("completeness"),
        },
        confidence_score=float(payload.get("confidence", 0.0) or 0.0),
    )


def _emit_or_failure_response(payload: Dict[str, Any]) -> Optional[JSONResponse]:
    try:
        _emit_truth_observability(payload)
        return None
    except Exception as obs_exc:
        logger.error(
            "Truth gateway observability emit failed trace_id=%s rpc=%s error=%s",
            payload.get("trace_id"),
            payload.get("rpc_function"),
            obs_exc,
            exc_info=True,
        )
        obs_failure = _build_failed_payload(
            fn_name=str(payload.get("rpc_function") or "unknown"),
            workspace_id=str(payload.get("workspace_id") or ""),
            trace_id=str(payload.get("trace_id") or _new_trace_id()),
            latency_ms=int(payload.get("latency_ms") or 0),
            failure_class=_FAILURE_OBSERVABILITY,
        )
        return JSONResponse(status_code=_FAILED_HTTP_STATUS, content=obs_failure)


async def _rpc_execute(fn_name, workspace_id):
    """Run Supabase RPC; raises on transport/RPC failure."""
    sb = init_supabase()
    result = sb.rpc(fn_name, {'p_workspace_id': workspace_id}).execute()
    return result.data if result.data else {"status": "no_data", "has_data": False}


async def _rpc(fn_name, workspace_id):
    """Call a Supabase RPC function. No synthetic Python fallback allowed."""
    try:
        return await _rpc_execute(fn_name, workspace_id)
    except Exception as e:
        reason_code = _classify_rpc_failure(e)
        logger.warning("RPC %s failed (%s): %s", fn_name, reason_code, e)
        raise HTTPException(
            status_code=503,
            detail=f"Canonical intelligence RPC unavailable ({reason_code}). Restore canonical SQL and retry.",
        )


async def _rpc_truth_gateway(fn_name: str, workspace_id: str):
    """Strict truth gateway for canonical/degraded/failed contract states."""
    trace_id = _new_trace_id()
    started = perf_counter()
    try:
        data = await _rpc_execute(fn_name, workspace_id)
    except Exception as e:
        failure_class = _classify_rpc_failure(e)
        latency_ms = _latency_ms(started)
        logger.warning("RPC %s failed (%s) trace_id=%s: %s", fn_name, failure_class, trace_id, e)

        if failure_class in {_FAILURE_RPC_FUNCTION_MISSING, _FAILURE_SCHEMA_MISMATCH}:
            degraded = _build_degraded_payload(
                fn_name=fn_name,
                workspace_id=workspace_id,
                trace_id=trace_id,
                latency_ms=latency_ms,
                failure_class=failure_class,
            )
            observability_failure = _emit_or_failure_response(degraded)
            if observability_failure:
                return observability_failure
            return JSONResponse(status_code=_DEGRADED_HTTP_STATUS, content=degraded)

        failed = _build_failed_payload(
            fn_name=fn_name,
            workspace_id=workspace_id,
            trace_id=trace_id,
            latency_ms=latency_ms,
            failure_class=failure_class,
        )
        observability_failure = _emit_or_failure_response(failed)
        if observability_failure:
            return observability_failure
        return JSONResponse(status_code=_FAILED_HTTP_STATUS, content=failed)

    latency_ms = _latency_ms(started)
    canonical = _build_canonical_payload(
        fn_name=fn_name,
        workspace_id=workspace_id,
        trace_id=trace_id,
        latency_ms=latency_ms,
        payload_data=data if isinstance(data, dict) else {"value": data},
    )
    _cache_snapshot(fn_name, workspace_id, canonical["data"])
    observability_failure = _emit_or_failure_response(canonical)
    if observability_failure:
        return observability_failure
    return JSONResponse(status_code=200, content=canonical)


# ═══ EXISTING ENDPOINTS (from 022) ═══

@router.get("/intelligence/workforce")
async def get_workforce_health(current_user: dict = Depends(get_current_user)):
    try:
        return await _rpc('compute_workforce_health', current_user['id'])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[workforce] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/intelligence/scenarios")
async def get_revenue_scenarios(current_user: dict = Depends(get_current_user)):
    try:
        return await _rpc('compute_revenue_scenarios', current_user['id'])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[scenarios] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/intelligence/scores")
async def get_insight_scores(current_user: dict = Depends(get_current_user)):
    try:
        return await _rpc('compute_insight_scores', current_user['id'])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[scores] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/intelligence/concentration")
async def get_concentration_risk(current_user: dict = Depends(get_current_user)):
    try:
        return await _rpc('compute_concentration_risk', current_user['id'])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[concentration] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ═══ NEW ENDPOINTS (from 023) ═══

@router.get("/intelligence/contradictions")
async def get_contradictions(current_user: dict = Depends(get_current_user)):
    """Detect priority mismatches, action-inaction gaps, repeated ignores."""
    try:
        return await _rpc('detect_contradictions', current_user['id'])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[contradictions] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/intelligence/pressure")
async def get_pressure_levels(current_user: dict = Depends(get_current_user)):
    """Compute pressure levels across all domains."""
    try:
        return await _rpc('compute_pressure_levels', current_user['id'])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[pressure] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/intelligence/freshness")
async def get_evidence_freshness(current_user: dict = Depends(get_current_user)):
    """Track signal age and decay scoring per domain."""
    try:
        wid = current_user['id']
        return await _rpc_truth_gateway('compute_evidence_freshness', wid)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[freshness] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/intelligence/silence")
async def get_silence_detection(current_user: dict = Depends(get_current_user)):
    """Detect user absence and unactioned critical signals."""
    try:
        return await _rpc('detect_silence', current_user['id'])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[silence] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/intelligence/escalations")
async def get_escalation_summary(current_user: dict = Depends(get_current_user)):
    """Get active escalation history and patterns."""
    try:
        return await _rpc('get_escalation_summary', current_user['id'])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[escalations] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/intelligence/completeness")
async def get_profile_completeness(current_user: dict = Depends(get_current_user)):
    """Compute business profile completeness score."""
    try:
        return await _rpc('compute_profile_completeness', current_user['id'])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[completeness] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/intelligence/readiness")
async def get_data_readiness(current_user: dict = Depends(get_current_user)):
    """Compute workspace data readiness score with checklist."""
    try:
        return await _rpc('compute_data_readiness', current_user['id'])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[readiness] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/intelligence/watchtower/positions")
async def get_watchtower_positions(current_user: dict = Depends(get_current_user)):
    """Raw watchtower positions RPC (non-canonical helper endpoint)."""
    try:
        return await _rpc('compute_watchtower_positions', current_user['id'])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[watchtower-positions] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/intelligence/summary")
async def get_full_summary(current_user: dict = Depends(get_current_user)):
    """Build complete intelligence summary across all modules."""
    try:
        wid = current_user['id']
        return await _rpc_truth_gateway('build_intelligence_summary', wid)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[summary] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ═══ INTEGRATION STATUS (direct table query) ═══

@router.get("/intelligence/integration-status")
async def get_integration_status(current_user: dict = Depends(get_current_user)):
    try:
        sb = init_supabase()
        result = sb.table('workspace_integrations') \
            .select('integration_type, status, connected_at, last_sync_at') \
            .eq('workspace_id', current_user['id']) \
            .execute()
        integrations = {}
        for row in (result.data or []):
            integrations[row['integration_type']] = {
                'status': row['status'],
                'connected_at': row.get('connected_at'),
                'last_sync_at': row.get('last_sync_at'),
            }
        return {
            "integrations": integrations,
            "connected_count": sum(1 for v in integrations.values() if v['status'] == 'connected'),
            "total_count": len(integrations),
        }
    except Exception as e:
        logger.warning(f"Integration status query failed: {e}")
        return {"integrations": {}, "connected_count": 0, "total_count": 0}


@router.get("/intelligence/observation-stats")
async def get_observation_stats(current_user: dict = Depends(get_current_user)):
    """Count `observation_events` for the current user across daily, weekly,
    and monthly windows — for the Advisor-page counter (A.2 / 2026-04-23).

    Returns one payload with all three windows + total so the frontend can
    switch between them without additional round-trips.
    """
    from datetime import datetime, timezone, timedelta

    user_id = current_user["id"]
    sb = init_supabase()
    now = datetime.now(timezone.utc)
    windows = {
        "daily":   now - timedelta(days=1),
        "weekly":  now - timedelta(days=7),
        "monthly": now - timedelta(days=30),
    }

    result: Dict[str, Any] = {}
    for label, cutoff in windows.items():
        try:
            r = sb.table("observation_events") \
                .select("id", count="exact") \
                .eq("user_id", user_id) \
                .gte("observed_at", cutoff.isoformat()) \
                .limit(1) \
                .execute()
            result[label] = int(getattr(r, "count", 0) or 0)
        except Exception as e:
            logger.warning(f"[observation-stats] {label} count failed: {e}")
            result[label] = 0

    try:
        r_total = sb.table("observation_events") \
            .select("id", count="exact") \
            .eq("user_id", user_id) \
            .limit(1) \
            .execute()
        result["total"] = int(getattr(r_total, "count", 0) or 0)
    except Exception as e:
        logger.warning(f"[observation-stats] total count failed: {e}")
        result["total"] = 0

    result["generated_at"] = now.isoformat()
    return result


@router.get("/intelligence/governance-summary")
async def get_governance_summary(current_user: dict = Depends(get_current_user)):
    try:
        sb = init_supabase()
        result = sb.table('governance_events') \
            .select('id, event_type, source_system, signal_reference, signal_timestamp, confidence_score') \
            .eq('workspace_id', current_user['id']) \
            .order('signal_timestamp', desc=True) \
            .limit(50) \
            .execute()
        events = result.data or []
        avg_confidence = 0
        if events:
            scores = [e.get('confidence_score', 0) for e in events if e.get('confidence_score') is not None]
            avg_confidence = round(sum(scores) / len(scores) * 100) if scores else 0
        return {
            "events": events,
            "total_count": len(events),
            "avg_confidence": avg_confidence,
            "sources": list(set(e.get('source_system', '') for e in events)),
        }
    except Exception as e:
        logger.warning(f"Governance summary query failed: {e}")
        return {"events": [], "total_count": 0, "avg_confidence": 0, "sources": []}


# ═══ CMO REPORT ═══

# Response shape that the frontend (CMOReportPage.js) consumes. Keep
# these keys stable; the page falls back to empty values for each.
# Consumed keys grepped from frontend/src/pages/CMOReportPage.js:
#   company_name, report_date, executive_summary, market_position{overall,
#   brand, digital, sentiment, competitive}, competitors[{name, market_share,
#   strengths, digital_visibility, threat_level, is_you}], position_dots,
#   swot{strengths, weaknesses, opportunities, threats}, reviews{rating,
#   count, positive_pct, neutral_pct, negative_pct}, review_themes{positive,
#   negative}, review_excerpts, roadmap{quick_wins, priorities, strategic},
#   geographic{established, growth}, confidence, report_id, report_date,
#   version, status, scan_source, engine, data_points.


def _cmo_empty_shell(user_id: str, company: str = "Your Business") -> Dict[str, Any]:
    """Canonical empty state when enrichment has not run yet. The frontend
    renders "No data available yet" placeholders for each section."""
    return {
        "company_name": company,
        "report_date": datetime.now(timezone.utc).strftime("%d/%m/%Y"),
        "executive_summary": None,
        "market_position": {"overall": 0, "brand": 0, "digital": 0, "sentiment": 0, "competitive": 0},
        "competitors": [],
        "position_dots": [],
        "swot": {"strengths": [], "weaknesses": [], "opportunities": [], "threats": []},
        "reviews": {"rating": 0, "count": 0, "positive_pct": 0, "neutral_pct": 0, "negative_pct": 0},
        "review_themes": {"positive": [], "negative": []},
        "review_excerpts": [],
        "roadmap": {"quick_wins": [], "priorities": [], "strategic": []},
        "geographic": {"established": [], "growth": []},
        "confidence": 0,
        "report_id": f"CMO-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{(user_id or 'anon')[:8]}",
        # Contract v2: state uses the strict 5-value enum. PROCESSING is
        # the correct value when calibration has not yet completed.
        "state": ExternalState.PROCESSING.value,
        "state_message": "Complete calibration first — deep scan has not produced intelligence for this workspace yet.",
        "cmo_priority_actions": [],
        "industry_action_items": [],
        "competitor_swot": [],
        "seo_analysis": {},
        "digital_footprint": {},
    }


def _coerce_score(val: Any, default: int = 0) -> int:
    """Coerce a value to an int in [0, 100]. Accepts int/float/numeric str."""
    try:
        n = int(round(float(val)))
    except (TypeError, ValueError):
        return default
    return max(0, min(100, n))


def _derive_market_position_from_enrichment(enr: Dict[str, Any]) -> Dict[str, int]:
    """
    Map the enrichment sub-objects to the 5-dial market-position score the
    frontend expects. Falls back to 0 so the UI renders as "calibrating".
    """
    seo = enr.get("seo_analysis") if isinstance(enr.get("seo_analysis"), dict) else {}
    social = enr.get("social_media_analysis") if isinstance(enr.get("social_media_analysis"), dict) else {}
    website = enr.get("website_health") if isinstance(enr.get("website_health"), dict) else {}
    digital = enr.get("digital_footprint") if isinstance(enr.get("digital_footprint"), dict) else {}
    reviews_intel = enr.get("customer_review_intelligence") if isinstance(enr.get("customer_review_intelligence"), dict) else {}

    brand = _coerce_score(website.get("score"))
    digital_presence = _coerce_score(digital.get("score") or seo.get("score"))
    sentiment = _coerce_score(reviews_intel.get("sentiment_score"))
    # Competitive score (2026-05-05 13041978): broaden the source of competitor
    # density beyond the legacy `competitor_leaders` / `competitors` keys.
    # When the AI synthesiser stores competitors as a narrative string in
    # `competitor_analysis` (which is the more recent shape) the legacy keys
    # are empty, dragging the dial to 0/100 even on rich scans. We now also
    # inspect competitor_swot[], competitor_analysis.detailed_competitors[]
    # and competitor_analysis.organic_competitors[] for named entities.
    comp_leaders = enr.get("competitor_leaders") or enr.get("competitors") or []
    if not (isinstance(comp_leaders, list) and comp_leaders):
        ca = enr.get("competitor_analysis")
        if isinstance(ca, dict):
            comp_leaders = (
                ca.get("detailed_competitors")
                or ca.get("organic_competitors")
                or ca.get("competitors")
                or []
            )
    if not (isinstance(comp_leaders, list) and comp_leaders):
        comp_swot = enr.get("competitor_swot")
        if isinstance(comp_swot, list):
            comp_leaders = [
                s for s in comp_swot
                if isinstance(s, dict) and (s.get("name") or s.get("competitor"))
            ]
    competitive = 0
    if isinstance(comp_leaders, list) and comp_leaders:
        # Proxy: density of named competitors (1..5) -> 20..100
        competitive = _coerce_score(min(len(comp_leaders), 5) * 20)
    buckets = [s for s in (brand, digital_presence, sentiment, competitive) if s]
    overall = int(round(sum(buckets) / len(buckets))) if buckets else 0
    return {
        "overall": overall,
        "brand": brand,
        "digital": digital_presence,
        "sentiment": sentiment,
        "competitive": competitive,
    }


def _shape_competitors_from_enrichment(enr: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Transform `competitor_swot` snapshots / `competitors` list into the
    row shape the frontend table renders. Each row: name, market_share,
    strengths, digital_visibility, threat_level, is_you."""
    from routes.calibration import _is_noisy_competitor  # reuse filter

    rows: List[Dict[str, Any]] = []
    comp_swot = enr.get("competitor_swot") if isinstance(enr.get("competitor_swot"), list) else []
    for snap in comp_swot[:5]:
        if not isinstance(snap, dict):
            continue
        name = snap.get("name") or ""
        if _is_noisy_competitor(name):
            continue
        strengths_list = snap.get("strengths") if isinstance(snap.get("strengths"), list) else []
        rows.append({
            "name": name,
            "market_share": snap.get("market_share") or "N/A",
            "strengths": (strengths_list[0] if strengths_list else "N/A"),
            "digital_visibility": snap.get("digital_visibility") or "N/A",
            "threat_level": (snap.get("threat_level") or "low").lower(),
            "is_you": False,
        })
    if rows:
        return rows
    # Fallback: use the flat competitors list when no snapshots are present.
    flat = enr.get("competitors") if isinstance(enr.get("competitors"), list) else []
    for name in flat[:5]:
        if not isinstance(name, str) or _is_noisy_competitor(name):
            continue
        rows.append({
            "name": name,
            "market_share": "N/A",
            "strengths": "N/A",
            "digital_visibility": "N/A",
            "threat_level": "medium",
            "is_you": False,
        })
    return rows


def _shape_roadmap_from_enrichment(enr: Dict[str, Any]) -> Dict[str, List[Any]]:
    """Split cmo_priority_actions + industry_action_items into the 7/30/90-day
    columns the frontend roadmap renders. No fabrication — empty when we have
    nothing.

    2026-05-05 (13041978): when items come from enrichment as plain strings
    (calibration synthesis writes them this way), attach an evidence_tag so
    they survive `filter_roadmap_items_with_provenance` downstream. Without
    the tag, the provenance filter drops every item and the user sees a
    full-INSUFFICIENT_SIGNAL roadmap despite real cmo_priority_actions data
    in the BDE row. The tag identifies the source of truth — the calibration
    synthesis pass that runs over the full enrichment payload (SEMrush +
    Perplexity + Trinity LLM consensus) — which IS the provenance.
    """
    priority = enr.get("cmo_priority_actions") if isinstance(enr.get("cmo_priority_actions"), list) else []
    industry = enr.get("industry_action_items") if isinstance(enr.get("industry_action_items"), list) else []

    def _wrap(items: List[Any], pri: str, default_tag: str) -> List[Dict[str, Any]]:
        out = []
        for it in items:
            text = it if isinstance(it, str) else (it.get("text") if isinstance(it, dict) else None)
            if not text:
                continue
            entry: Dict[str, Any] = {"text": str(text), "priority": pri, "evidence_tag": default_tag}
            if isinstance(it, dict):
                if it.get("evidence_tag"):
                    entry["evidence_tag"] = str(it.get("evidence_tag"))
                elif it.get("source") or it.get("source_type"):
                    entry["evidence_tag"] = str(it.get("source") or it.get("source_type"))
                if isinstance(it.get("confidence"), (int, float)):
                    entry["confidence"] = round(float(it.get("confidence")), 2)
            out.append(entry)
        return out

    # 7-day quick wins: top-of-list priority actions (first 3, tagged critical).
    # 30-day priorities: remaining priority actions (tagged high).
    # 90-day strategic: all industry action items (tagged medium).
    quick_wins = _wrap(priority[:3], "critical", "calibration_synthesis")
    priorities = _wrap(priority[3:8], "high", "calibration_synthesis")
    strategic = _wrap(industry[:5], "medium", "industry_action_items")
    return {"quick_wins": quick_wins, "priorities": priorities, "strategic": strategic}


def _count_real_data_points(report_payload: Dict[str, Any]) -> int:
    points = 0
    points += len(report_payload.get("competitors") or [])
    points += sum(
        len((report_payload.get("swot") or {}).get(bucket) or [])
        for bucket in ("strengths", "weaknesses", "opportunities", "threats")
    )
    points += len((report_payload.get("roadmap") or {}).get("quick_wins") or [])
    points += len((report_payload.get("roadmap") or {}).get("priorities") or [])
    points += len((report_payload.get("roadmap") or {}).get("strategic") or [])
    points += len((report_payload.get("review_themes") or {}).get("positive") or [])
    points += len((report_payload.get("review_themes") or {}).get("negative") or [])
    points += len(report_payload.get("review_excerpts") or [])
    if (report_payload.get("reviews") or {}).get("count", 0) > 0:
        points += 1
    if report_payload.get("executive_summary"):
        points += 1
    return points


def _shape_reviews_from_enrichment(enr: Dict[str, Any]) -> Dict[str, Any]:
    """Extract the aggregate rating + sentiment split the frontend renders."""
    agg = enr.get("review_aggregation") if isinstance(enr.get("review_aggregation"), dict) else {}
    intel = enr.get("customer_review_intelligence") if isinstance(enr.get("customer_review_intelligence"), dict) else {}
    positive = _coerce_score(intel.get("positive_pct") or agg.get("positive_pct"))
    negative = _coerce_score(intel.get("negative_pct") or agg.get("negative_pct"))
    neutral = max(0, 100 - positive - negative) if (positive or negative) else 0
    try:
        rating_val = float(agg.get("average_rating") or intel.get("rating") or 0)
    except (TypeError, ValueError):
        rating_val = 0
    try:
        count_val = int(agg.get("review_count") or intel.get("count") or 0)
    except (TypeError, ValueError):
        count_val = 0
    return {
        "rating": round(rating_val, 1) if rating_val else 0,
        "count": count_val,
        "positive_pct": positive,
        "neutral_pct": neutral,
        "negative_pct": negative,
    }


def _apply_render_time_filters(report: Dict[str, Any]) -> Dict[str, Any]:
    """
    Defence-in-depth: even if stored enrichment rows from before the filters
    landed still contain sentinel strings or meta-gap bullets, strip them at
    response time. Safe to call on any report payload.
    """
    try:
        from routes.calibration import (
            _scrub_sentinel,
            _filter_meta_gap_list,
            _filter_competitor_candidates,
            _is_noisy_competitor,
        )
    except Exception:
        return report

    # Scalar sentinel scrub on narrative fields.
    for k in ("executive_summary",):
        if isinstance(report.get(k), str):
            v = _scrub_sentinel(report[k])
            report[k] = v if v else None

    # SWOT scrub.
    swot = report.get("swot") if isinstance(report.get("swot"), dict) else {}
    for bucket in ("strengths", "weaknesses", "opportunities", "threats"):
        raw = swot.get(bucket, [])
        if isinstance(raw, list):
            scrubbed = [_scrub_sentinel(x) for x in raw]
            swot[bucket] = [x for x in _filter_meta_gap_list(scrubbed) if x]
    report["swot"] = swot

    # Competitor table rows.
    comps = report.get("competitors")
    if isinstance(comps, list):
        report["competitors"] = [
            c for c in comps
            if isinstance(c, dict) and not _is_noisy_competitor(c.get("name"))
        ]

    # Roadmap items: scrub both string-form and {text, priority}-form entries.
    roadmap = report.get("roadmap") if isinstance(report.get("roadmap"), dict) else {}
    for col in ("quick_wins", "priorities", "strategic"):
        raw = roadmap.get(col, [])
        if not isinstance(raw, list):
            continue
        out = []
        for it in raw:
            text = it if isinstance(it, str) else (it.get("text") if isinstance(it, dict) else None)
            if not text:
                continue
            text = _scrub_sentinel(text)
            if not text:
                continue
            if _filter_meta_gap_list([text]):  # non-empty when surviving filter
                if isinstance(it, dict):
                    it["text"] = text
                    out.append(it)
                else:
                    out.append(text)
        roadmap[col] = out
    report["roadmap"] = roadmap

    # Priority / industry action arrays mirrored alongside roadmap.
    for k in ("cmo_priority_actions", "industry_action_items"):
        raw = report.get(k)
        if isinstance(raw, list):
            scrubbed = [_scrub_sentinel(x) if isinstance(x, str) else x for x in raw]
            report[k] = _filter_meta_gap_list(scrubbed)

    # Competitor SWOT snapshots.
    csw = report.get("competitor_swot")
    if isinstance(csw, list):
        report["competitor_swot"] = [
            s for s in csw
            if isinstance(s, dict) and not _is_noisy_competitor(s.get("name"))
        ]

    return report


def _build_section_evidence_for_cmo(
    response: Dict[str, Any],
    enrichment: Dict[str, Any],
    *,
    is_processing: bool,
) -> Dict[str, Dict[str, Any]]:
    """Build the per-section SectionEvidence dict for the CMO Report.

    Returns a mapping of `section_id -> SectionEvidence`. Every required
    section in SECTION_IDS will appear in the result. Optional sections
    (signals, products_services, abn_business_identity) are included only
    if at least one signal exists.

    Provenance handling:
        - SWOT items must reference at least one source_trace_id OR be
          flagged INSUFFICIENT_SIGNAL. Items without provenance are dropped
          via filter_swot_items_with_provenance.
        - Roadmap items must reference at least one finding (signal_id,
          competitor name from this scan, brand metric from this scan).
          Items without provenance are dropped via
          filter_roadmap_items_with_provenance.
        - Generic SWOT/Roadmap items that match the placeholder denylist
          (Marketing-101 phrases, "Strong"/"Weak"/"TBD"/etc.) are dropped.

    Per Contract v2: every `reason` string is non-leaky (no supplier names,
    no internal codes, no HTTP errors).
    """
    sections: Dict[str, Dict[str, Any]] = {}

    # Available trace ids and competitor names harvested from the enrichment
    # for provenance enforcement on SWOT + Roadmap items.
    available_trace_ids: List[str] = []
    raw_traces = enrichment.get("source_trace_ids") or enrichment.get("trace_ids") or []
    if isinstance(raw_traces, list):
        available_trace_ids.extend([str(t) for t in raw_traces if t])
    # Pull trace ids from any nested {evidence_tag, trace_id, signal_id} entries.
    for v in (enrichment.get("intelligence_actions") or []):
        if isinstance(v, dict):
            tid = v.get("id") or v.get("signal_id") or v.get("trace_id")
            if tid:
                available_trace_ids.append(str(tid))
    # Dedupe.
    available_trace_ids = list({t for t in available_trace_ids})

    competitors_from_scan = response.get("competitors") or []
    competitor_names = [c.get("name") for c in competitors_from_scan if isinstance(c, dict)]

    # Brand metric labels available from the score dials (when non-zero).
    brand_metric_names: List[str] = []
    mp = response.get("market_position") or {}
    if isinstance(mp, dict):
        if mp.get("brand"): brand_metric_names.append("brand strength")
        if mp.get("digital"): brand_metric_names.append("digital presence")
        if mp.get("sentiment"): brand_metric_names.append("customer sentiment")
        if mp.get("competitive"): brand_metric_names.append("competitive position")

    def _processing_or(section_id: str, fn) -> Dict[str, Any]:
        """If we're in calibration-not-yet-complete mode, return PROCESSING.
        Otherwise call fn() to get the real SectionEvidence."""
        if is_processing:
            return make_section(section_id, state=ExternalState.PROCESSING.value)
        return fn()

    # ── Header / metadata sections (always DATA_AVAILABLE when known) ──
    sections["header"] = make_section(
        "header",
        state=ExternalState.DATA_AVAILABLE.value,
        evidence={
            "title": "Chief Marketing Summary",
            "report_id": response.get("report_id"),
        },
    )
    sections["date"] = _processing_or("date", lambda: make_section(
        "date",
        state=ExternalState.DATA_AVAILABLE.value,
        evidence={"report_date": response.get("report_date")},
    ))
    bn = response.get("company_name")
    sections["business_name"] = make_section(
        "business_name",
        state=section_state_for_value(bn),
        evidence={"company_name": bn} if bn else None,
        reason=None if bn else reason_for("business_name", ExternalState.INSUFFICIENT_SIGNAL.value),
    )
    website_url = enrichment.get("website_url") or enrichment.get("domain")
    sections["website"] = make_section(
        "website",
        state=section_state_for_value(website_url),
        evidence={"url": website_url} if website_url else None,
        reason=None if website_url else "Business website not yet captured for this scan.",
    )
    scan_source = response.get("scan_source")
    # F7 P1-1 (BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2):
    # Use evidence key "name" — NOT "source". The key "source" is in the
    # response_sanitizer._INTERNAL_KEYS denylist (it identifies supplier
    # provenance like "semrush"/"perplexity") and would be stripped by
    # scrub_response_for_external, leaving evidence={} and degrading the
    # scan_source section to effectively-empty. "name" is also clearer
    # semantically — this is the source-name label, not a supplier provenance
    # tag. R6 finding 13041978-flagged.
    sections["scan_source"] = make_section(
        "scan_source",
        state=section_state_for_value(scan_source),
        evidence={"name": scan_source} if scan_source else None,
    )
    real_pts = _count_real_data_points(response)
    sections["data_points_count"] = make_section(
        "data_points_count",
        state=ExternalState.DATA_AVAILABLE.value if real_pts > 0 else ExternalState.INSUFFICIENT_SIGNAL.value,
        evidence={"count": real_pts} if real_pts > 0 else None,
    )
    conf = response.get("confidence") or 0
    sections["confidence_score"] = make_section(
        "confidence_score",
        state=ExternalState.DATA_AVAILABLE.value if conf > 0 else ExternalState.INSUFFICIENT_SIGNAL.value,
        evidence={"score": conf} if conf > 0 else None,
    )

    # ── Narrative sections ──
    exec_summary = response.get("executive_summary")
    cms_state = section_state_for_value(exec_summary, is_processing=is_processing)
    if cms_state == ExternalState.DATA_AVAILABLE.value and is_placeholder_string(exec_summary):
        cms_state = ExternalState.INSUFFICIENT_SIGNAL.value
        exec_summary = None
    sections["chief_marketing_summary"] = make_section(
        "chief_marketing_summary",
        state=cms_state,
        evidence={"text": exec_summary} if cms_state == ExternalState.DATA_AVAILABLE.value else None,
        source_trace_ids=available_trace_ids[:3],
    )
    sections["executive_summary"] = make_section(
        "executive_summary",
        state=cms_state,
        evidence={"text": exec_summary} if cms_state == ExternalState.DATA_AVAILABLE.value else None,
        source_trace_ids=available_trace_ids[:3],
    )

    # ── Score dials ──
    overall = (mp or {}).get("overall", 0)
    sections["market_position_score"] = make_section(
        "market_position_score",
        state=ExternalState.DATA_AVAILABLE.value if overall > 0 else ExternalState.INSUFFICIENT_SIGNAL.value,
        evidence=mp if overall > 0 else None,
        source_trace_ids=available_trace_ids[:1],
    )
    for metric_id, metric_key in (
        ("brand_strength", "brand"),
        ("digital_presence", "digital"),
        ("customer_sentiment", "sentiment"),
        ("competitive_position", "competitive"),
    ):
        val = (mp or {}).get(metric_key, 0)
        sections[metric_id] = make_section(
            metric_id,
            state=ExternalState.DATA_AVAILABLE.value if val > 0 else ExternalState.INSUFFICIENT_SIGNAL.value,
            evidence={"score": val, "max": 100} if val > 0 else None,
        )

    # ── Competitive landscape ──
    has_comps = len(competitors_from_scan) > 0
    sections["competitive_landscape"] = make_section(
        "competitive_landscape",
        state=ExternalState.DATA_AVAILABLE.value if has_comps else ExternalState.INSUFFICIENT_SIGNAL.value,
        evidence={"competitors": competitors_from_scan} if has_comps else None,
        source_trace_ids=available_trace_ids[:5],
    )
    sections["competitors_found"] = make_section(
        "competitors_found",
        state=ExternalState.DATA_AVAILABLE.value if has_comps else ExternalState.INSUFFICIENT_SIGNAL.value,
        evidence={"names": [n for n in competitor_names if n]} if has_comps else None,
    )
    rev_count = (response.get("reviews") or {}).get("count", 0)
    rev_excerpts = response.get("review_excerpts") or []
    rev_sources = []
    for ex in rev_excerpts:
        if isinstance(ex, dict) and ex.get("source"):
            rev_sources.append(ex["source"])
    rev_sources = sorted({s for s in rev_sources if s})
    sections["review_sources"] = make_section(
        "review_sources",
        state=ExternalState.DATA_AVAILABLE.value if rev_sources else ExternalState.INSUFFICIENT_SIGNAL.value,
        evidence={"sources": rev_sources, "review_count": rev_count} if rev_sources else None,
    )

    # ── SWOT (per-bucket, provenance-enforced) ──
    swot = response.get("swot") or {}
    for bucket_id, bucket_key in (
        ("swot_strengths", "strengths"),
        ("swot_weaknesses", "weaknesses"),
        ("swot_opportunities", "opportunities"),
        ("swot_threats", "threats"),
    ):
        raw_items = swot.get(bucket_key) or []
        # Strip placeholder + Marketing-101 templated strings up-front. Then
        # require at least one provenance pointer per item OR the section
        # flips to INSUFFICIENT_SIGNAL.
        kept = filter_swot_items_with_provenance(
            raw_items,
            available_trace_ids=available_trace_ids,
            available_competitor_names=[c for c in competitor_names if c],
        )
        if kept:
            sections[bucket_id] = make_section(
                bucket_id,
                state=ExternalState.DATA_AVAILABLE.value,
                evidence={"items": kept},
                source_trace_ids=available_trace_ids[:5],
            )
        else:
            sections[bucket_id] = make_section(
                bucket_id,
                state=ExternalState.INSUFFICIENT_SIGNAL.value,
            )

    # ── Review intelligence ──
    has_reviews = (rev_count > 0) or len(rev_excerpts) > 0
    sections["review_intelligence"] = make_section(
        "review_intelligence",
        state=ExternalState.DATA_AVAILABLE.value if has_reviews else ExternalState.INSUFFICIENT_SIGNAL.value,
        evidence={
            "reviews": response.get("reviews"),
            "review_themes": response.get("review_themes"),
            "review_excerpts": rev_excerpts,
        } if has_reviews else None,
    )

    # ── Strategic Roadmap (per-horizon, provenance-enforced) ──
    rd = response.get("roadmap") or {}
    horizons = (
        ("seven_day_quick_wins", "quick_wins"),
        ("thirty_day_priorities", "priorities"),
        ("ninety_day_strategic_goals", "strategic"),
    )
    horizon_results: Dict[str, List[Dict[str, Any]]] = {}
    for horizon_id, horizon_key in horizons:
        raw_items = rd.get(horizon_key) or []
        kept = filter_roadmap_items_with_provenance(
            raw_items,
            available_trace_ids=available_trace_ids,
            available_competitor_names=[c for c in competitor_names if c],
            available_brand_metric_names=brand_metric_names,
        )
        horizon_results[horizon_id] = kept
        if kept:
            sections[horizon_id] = make_section(
                horizon_id,
                state=ExternalState.DATA_AVAILABLE.value,
                evidence={"items": kept},
                source_trace_ids=available_trace_ids[:5],
            )
        else:
            sections[horizon_id] = make_section(
                horizon_id,
                state=ExternalState.INSUFFICIENT_SIGNAL.value,
            )

    any_horizon_has_items = any(len(v) > 0 for v in horizon_results.values())
    sections["strategic_roadmap"] = make_section(
        "strategic_roadmap",
        state=ExternalState.DATA_AVAILABLE.value if any_horizon_has_items else ExternalState.INSUFFICIENT_SIGNAL.value,
        evidence={
            "horizons": {k: horizon_results[k] for k, _ in horizons},
        } if any_horizon_has_items else None,
        source_trace_ids=available_trace_ids[:5],
    )

    # ── Footer / actions (entitlement-aware UI element states) ──
    sections["pdf_download"] = make_section(
        "pdf_download",
        state=ExternalState.DATA_AVAILABLE.value,
        evidence={"endpoint": "/api/reports/cmo-report/pdf"},
    )
    sections["share_report"] = make_section(
        "share_report",
        state=ExternalState.DATA_AVAILABLE.value,
        evidence={"share": True},
    )
    persisted = bool(enrichment)
    sections["business_dna_persistence"] = make_section(
        "business_dna_persistence",
        state=ExternalState.DATA_AVAILABLE.value if persisted else ExternalState.PROCESSING.value,
        evidence={"persisted": True, "report_id": response.get("report_id")} if persisted else None,
    )

    # ── Optional sections (only emit when there's real evidence) ──
    sigs = enrichment.get("intelligence_actions") or enrichment.get("signals") or []
    if isinstance(sigs, list) and sigs:
        sections["signals"] = make_section(
            "signals",
            state=ExternalState.DATA_AVAILABLE.value,
            evidence={"count": len(sigs)},
            source_trace_ids=available_trace_ids[:10],
        )
    else:
        sections["signals"] = make_section("signals", state=ExternalState.INSUFFICIENT_SIGNAL.value)

    products = enrichment.get("products_services") or enrichment.get("products") or []
    if isinstance(products, list) and products:
        clean_products = [
            p for p in products
            if isinstance(p, str) and not is_placeholder_string(p)
        ]
        if clean_products:
            sections["products_services"] = make_section(
                "products_services",
                state=ExternalState.DATA_AVAILABLE.value,
                evidence={"items": clean_products},
            )
        else:
            sections["products_services"] = make_section(
                "products_services", state=ExternalState.INSUFFICIENT_SIGNAL.value,
            )
    else:
        sections["products_services"] = make_section(
            "products_services", state=ExternalState.INSUFFICIENT_SIGNAL.value,
        )

    abn = enrichment.get("abn") or enrichment.get("business_abn")
    if abn:
        sections["abn_business_identity"] = make_section(
            "abn_business_identity",
            state=ExternalState.DATA_AVAILABLE.value,
            evidence={"abn": str(abn)},
        )
    else:
        sections["abn_business_identity"] = make_section(
            "abn_business_identity", state=ExternalState.INSUFFICIENT_SIGNAL.value,
        )

    # Final validation pass: every section must satisfy SectionEvidence
    # contract. Run validate_section_evidence in case a future caller
    # introduces a regression.
    for sid, payload in sections.items():
        validate_section_evidence(payload, section_id=sid)

    return sections


# ─── R2E synthesis-enrichment orchestration ─────────────────────────────
#
# When `enrichment` carries the deepened R2A-D + F14/F15 data but the
# report payload sections are thin (empty SWOT / empty roadmap / no exec
# summary), invoke the world-class synthesis prompts in
# `core/synthesis_prompts.py` to produce evidence-cited content. Each
# section is gated by has_sufficient_synthesis_inputs to avoid burning
# Trinity tokens when the inputs would only produce thin output anyway.
#
# All synthesis output passes through the provenance + anti-template
# filters before being merged back into the response. Sections that
# cannot be enriched (LLM error / parse error / all items dropped) keep
# their existing thin content unchanged — synthesis NEVER replaces
# evidence-backed content with thinner content.
#
# Cost containment: the synthesis call is opt-in via env flag
# CMO_SYNTHESIS_ENRICHMENT_ENABLED (default ON). The flag is checked
# every request so a superadmin can disable it without a redeploy if
# the trinity bill spikes.


def _synthesis_enabled_for_request() -> bool:
    """True when the optional R2E LLM synthesis enrichment may run.

    Default ON. Set the env var to "0", "false", or "off" to disable
    without a code change. Read at request-time so changes take effect
    on the next call.

    F16 (2026-05-04): observability — the chosen state is logged at
    debug-level on every call so an A/B comparison (with-vs-without
    synthesis) is visible in the request logs. We KEEP the default ON
    because R2E (the synthesis path) is the world-class output path
    Andreas wants in production; F16 fixes the gate that was preventing
    it from firing. To compare metrics, set
    `CMO_SYNTHESIS_ENRICHMENT_ENABLED=0` in a canary deploy and grep
    `cmo-synthesis-gate` in logs to bucket sessions.
    """
    import os
    raw = os.environ.get("CMO_SYNTHESIS_ENRICHMENT_ENABLED", "1").strip().lower()
    enabled = raw not in {"0", "false", "off", "no"}
    logger.debug(f"[cmo-synthesis-gate] enabled={enabled} env_raw={raw!r}")
    return enabled


def _section_is_thin(section_payload: Any, *, min_items: int = 1) -> bool:
    """True when the section_payload is empty / sparse enough to enrich.

    Used by `_enrich_cmo_with_synthesis` to decide which sections to call
    LLM synthesis for. We never enrich a section that already has rich
    content — the goal is to fill gaps, not overwrite signal-backed text.

    F16 hardening (2026-05-04): the legacy Marketing-101 template builders
    upstream emit bare strings (e.g. "Improve social media presence",
    "Strengthen brand", "Optimize customer journey") into the SWOT / roadmap
    buckets. The pre-F16 thinness check counted these as content and so
    NEVER fired R2E synthesis even though the buckets were full of fluff.
    Two new rules close the gap:

      (a) Anti-template strings are excluded from the effective_count when
          deciding whether a list / bucket meets the min_items threshold.
          (i.e. items matching `is_anti_template_phrase` count as thin.)
      (b) Belt-and-braces — if EVERY item in a bucket / list is a bare
          string (rather than a structured dict with `source_trace_ids`),
          the bucket is treated as thin regardless of count, because the
          world-class synthesis path always emits provenance-bearing dicts
          while only the legacy template builders emit bare strings.

    Together (a) + (b) ensure R2E synthesis fires whenever the buckets
    contain only legacy-template content, while leaving alone any bucket
    that already has at least one provenance-bearing item from a previous
    synthesis pass.
    """
    if section_payload is None:
        return True
    if isinstance(section_payload, str):
        text = section_payload.strip()
        if not text:
            return True
        # Defence-in-depth: a section whose entire content is an
        # anti-template phrase should be enriched.
        try:
            from core.synthesis_prompts import is_anti_template_phrase
        except Exception:
            is_anti_template_phrase = lambda _v: False  # noqa: E731
        return bool(is_anti_template_phrase(text))
    if isinstance(section_payload, (list, tuple)):
        return _list_is_thin(section_payload, min_items=min_items)
    if isinstance(section_payload, dict):
        if not section_payload:
            return True
        # SWOT / roadmap shape: a dict whose values are list-buckets.
        bucket_values = list(section_payload.values())
        if bucket_values and all(
            isinstance(v, (list, tuple)) for v in bucket_values
        ):
            # Thin iff EVERY bucket is thin (after anti-template + bare-string
            # exclusion). i.e. fire synthesis when no bucket has at least one
            # provenance-bearing, non-template item.
            return all(
                _list_is_thin(v, min_items=min_items) for v in bucket_values
            )
        # Non-bucket dict (e.g. competitor entry, summary metadata): treat
        # as non-thin — the section already has structured content.
        return False
    return False


def _list_is_thin(items: Any, *, min_items: int = 1) -> bool:
    """True when `items` lacks `min_items` non-template, structured entries.

    Used by `_section_is_thin`. An item counts toward `effective_count` iff:
      * It is a dict with at least one of `source_trace_ids` / `trace_ids`
        / `evidence_tag` (i.e. provenance-bearing — produced by R2E
        synthesis or another evidence-cited path), OR
      * It is a string that does NOT match `is_anti_template_phrase`
        AND there is at least one other non-string, provenance-bearing item
        in the list (i.e. the list isn't an all-bare-strings legacy payload).

    The all-bare-strings shape itself is treated as thin via the
    belt-and-braces rule — see `_section_is_thin` docstring.
    """
    if not isinstance(items, (list, tuple)):
        return True
    if len(items) == 0:
        return True
    try:
        from core.synthesis_prompts import is_anti_template_phrase
    except Exception:
        is_anti_template_phrase = lambda _v: False  # noqa: E731
    has_any_dict = any(isinstance(x, dict) for x in items)
    # Belt-and-braces: all-strings shape is the legacy template builder
    # output. Treat as thin so synthesis fires.
    if not has_any_dict:
        return True
    effective_count = 0
    for item in items:
        if isinstance(item, dict):
            text = str(item.get("text") or "").strip() if "text" in item else ""
            if text and is_anti_template_phrase(text):
                continue
            has_provenance = bool(
                item.get("source_trace_ids")
                or item.get("trace_ids")
                or item.get("evidence_tag")
            )
            # Provenance-bearing dict (or a structured non-text dict like a
            # competitor entry): counts as effective content.
            if has_provenance or not text:
                effective_count += 1
            else:
                # Has text but no provenance — treat as anti-template
                # because R2E contract requires provenance on every item.
                continue
        elif isinstance(item, str):
            # Mixed list with at least one provenance dict already — count
            # non-template strings too (they're not the legacy shape).
            if item.strip() and not is_anti_template_phrase(item):
                effective_count += 1
        else:
            # Unknown item shape — be conservative and count it.
            effective_count += 1
    return effective_count < min_items


async def _enrich_cmo_with_synthesis(
    response: Dict[str, Any],
    enrichment: Dict[str, Any],
    *,
    business_name: str,
    user_id: str,
    tier: Optional[str] = None,
) -> Dict[str, Any]:
    """Optionally enrich the CMO response with R2E trinity synthesis.

    Strategy:
      1. Gate on env flag (synthesis disabled in dev / paused under cost spike).
      2. Gate on `has_sufficient_synthesis_inputs` — never burn tokens when
         the inputs wouldn't produce world-class output anyway.
      3. For each thin section: build the section prompt, call trinity
         synthesis, parse JSON, drop items via provenance filter.
      4. Merge cited content back into `response` only if the LLM returned
         non-empty enriched content. Never overwrite existing evidence-backed
         content with thinner content — synthesis only fills gaps.

    Errors at any step are caught and logged. The route NEVER blocks on
    synthesis — if the LLM is paused, errored, or out-of-budget, the
    response is returned unchanged.
    """
    if not _synthesis_enabled_for_request():
        return response
    if not has_sufficient_synthesis_inputs(enrichment):
        return response

    # Lazy import to avoid pulling httpx into the SQL-only test paths.
    try:
        from core.llm_router import llm_trinity_synthesis
    except Exception as imp_exc:
        logger.debug(f"[cmo-synthesis] llm_trinity_synthesis import skipped: {imp_exc}")
        return response

    available_trace_ids = collect_available_trace_ids(enrichment)
    available_competitor_names = collect_available_competitor_names(enrichment)
    available_metric_names = collect_available_brand_metric_names(enrichment)

    from core.synthesis_prompts import (
        filter_synthesis_swot_with_provenance,
        filter_synthesis_roadmap_with_provenance,
    )

    # ─── Chief Marketing Summary + Executive Summary ──────────────────
    if _section_is_thin(response.get("executive_summary")):
        try:
            cm_system, cm_user = build_chief_marketing_summary_prompt(
                business_name=business_name,
                enrichment=enrichment,
                available_trace_ids=available_trace_ids,
            )
            cm_raw = await llm_trinity_synthesis(
                cm_system, cm_user,
                temperature=0.3, max_tokens=900, timeout=60,
                user_id=user_id, tier=tier,
            )
            cm_parsed = parse_synthesis_json(cm_raw)
            if isinstance(cm_parsed, dict) and isinstance(cm_parsed.get("summary"), str):
                summary_text = cm_parsed["summary"].strip()
                # Reject if the synthesised summary itself slipped through
                # an anti-template phrase (the prompt forbids it but defence
                # in depth keeps us honest).
                from core.synthesis_prompts import is_anti_template_phrase
                if summary_text and not is_anti_template_phrase(summary_text):
                    response["executive_summary"] = summary_text
                    response.setdefault("executive_summary_provenance", {})
                    response["executive_summary_provenance"] = {
                        "source_trace_ids": cm_parsed.get("source_trace_ids") or [],
                        "signals_cited": cm_parsed.get("signals_cited") or [],
                    }
        except Exception as exc:
            logger.warning(f"[cmo-synthesis] chief_marketing_summary skipped: {exc}")

    # ─── Executive Summary bullets ─────────────────────────────────────
    # Only synthesise if there is no existing exec_summary_bullets array.
    if _section_is_thin(response.get("exec_summary_bullets"), min_items=1):
        try:
            es_system, es_user = build_executive_summary_prompt(
                business_name=business_name,
                enrichment=enrichment,
                available_trace_ids=available_trace_ids,
            )
            es_raw = await llm_trinity_synthesis(
                es_system, es_user,
                temperature=0.3, max_tokens=1100, timeout=60,
                user_id=user_id, tier=tier,
            )
            es_parsed = parse_synthesis_json(es_raw)
            if isinstance(es_parsed, dict) and isinstance(es_parsed.get("bullets"), list):
                from core.synthesis_prompts import is_anti_template_phrase
                cleaned_bullets = []
                for b in es_parsed["bullets"]:
                    if not isinstance(b, dict):
                        continue
                    text = str(b.get("text") or "").strip()
                    if not text or is_anti_template_phrase(text):
                        continue
                    cleaned_bullets.append({
                        "text": text,
                        "source_trace_ids": b.get("source_trace_ids") or [],
                        "dataset": b.get("dataset"),
                        "metric_value": b.get("metric_value"),
                    })
                if cleaned_bullets:
                    response["exec_summary_bullets"] = cleaned_bullets
        except Exception as exc:
            logger.warning(f"[cmo-synthesis] executive_summary skipped: {exc}")

    # ─── SWOT (4 buckets) ─────────────────────────────────────────────
    swot = response.get("swot") or {}
    if _section_is_thin(swot, min_items=1):
        try:
            sw_system, sw_user = build_swot_prompt(
                business_name=business_name,
                enrichment=enrichment,
                available_trace_ids=available_trace_ids,
            )
            sw_raw = await llm_trinity_synthesis(
                sw_system, sw_user,
                temperature=0.35, max_tokens=2000, timeout=80,
                user_id=user_id, tier=tier,
            )
            sw_parsed = parse_synthesis_json(sw_raw)
            if isinstance(sw_parsed, dict):
                enriched_swot: Dict[str, List[Dict[str, Any]]] = {}
                for bucket in ("strengths", "weaknesses", "opportunities", "threats"):
                    raw_items = sw_parsed.get(bucket) or []
                    cleaned = filter_synthesis_swot_with_provenance(
                        raw_items,
                        available_trace_ids=available_trace_ids,
                        available_competitor_names=available_competitor_names,
                    )
                    enriched_swot[bucket] = cleaned
                # Only merge if at least one bucket has content. We never
                # downgrade existing rich content with empty arrays.
                non_empty_count = sum(1 for v in enriched_swot.values() if v)
                if non_empty_count >= 2:
                    response["swot_v2"] = enriched_swot
                    # Backfill flat string lists for the legacy `swot` shape
                    # the frontend already consumes — never overwrite a
                    # bucket that already had content (gap-fill only).
                    for bucket, items in enriched_swot.items():
                        existing = (swot.get(bucket) or []) if isinstance(swot, dict) else []
                        if not existing and items:
                            swot[bucket] = [it["text"] for it in items if it.get("text")]
                    response["swot"] = swot
        except Exception as exc:
            logger.warning(f"[cmo-synthesis] swot skipped: {exc}")

    # ─── Strategic Roadmap (3 horizons) ───────────────────────────────
    roadmap = response.get("roadmap") or {}
    if _section_is_thin(roadmap, min_items=1):
        try:
            rm_system, rm_user = build_strategic_roadmap_prompt(
                business_name=business_name,
                enrichment=enrichment,
                available_trace_ids=available_trace_ids,
            )
            rm_raw = await llm_trinity_synthesis(
                rm_system, rm_user,
                temperature=0.35, max_tokens=2000, timeout=80,
                user_id=user_id, tier=tier,
            )
            rm_parsed = parse_synthesis_json(rm_raw)
            if isinstance(rm_parsed, dict):
                enriched_roadmap: Dict[str, List[Dict[str, Any]]] = {}
                bucket_alias = {
                    "quick_wins": ("quick_wins", "seven_day_quick_wins", "7_day"),
                    "priorities": ("priorities", "thirty_day_priorities", "30_day"),
                    "strategic": ("strategic", "ninety_day_strategic_goals", "90_day"),
                }
                for canonical_key, alias_keys in bucket_alias.items():
                    raw_items: List[Any] = []
                    for ak in alias_keys:
                        cand = rm_parsed.get(ak)
                        if isinstance(cand, list):
                            raw_items = cand
                            break
                    cleaned = filter_synthesis_roadmap_with_provenance(
                        raw_items,
                        available_trace_ids=available_trace_ids,
                        available_competitor_names=available_competitor_names,
                        available_brand_metric_names=available_metric_names,
                    )
                    enriched_roadmap[canonical_key] = cleaned
                non_empty = sum(1 for v in enriched_roadmap.values() if v)
                if non_empty >= 2:
                    response["roadmap_v2"] = enriched_roadmap
                    # Gap-fill the existing roadmap shape — never overwrite
                    # a column that already had content.
                    for col, items in enriched_roadmap.items():
                        existing = (roadmap.get(col) or []) if isinstance(roadmap, dict) else []
                        if not existing and items:
                            roadmap[col] = items
                    response["roadmap"] = roadmap
        except Exception as exc:
            logger.warning(f"[cmo-synthesis] roadmap skipped: {exc}")

    # ─── Competitive Landscape ────────────────────────────────────────
    if _section_is_thin(response.get("competitors"), min_items=2):
        try:
            cl_system, cl_user = build_competitive_landscape_prompt(
                business_name=business_name,
                enrichment=enrichment,
                available_trace_ids=available_trace_ids,
            )
            cl_raw = await llm_trinity_synthesis(
                cl_system, cl_user,
                temperature=0.3, max_tokens=2000, timeout=80,
                user_id=user_id, tier=tier,
            )
            cl_parsed = parse_synthesis_json(cl_raw)
            if isinstance(cl_parsed, dict) and isinstance(cl_parsed.get("competitors"), list):
                rows = []
                for c in cl_parsed["competitors"][:10]:
                    if not isinstance(c, dict):
                        continue
                    name = (c.get("name") or "").strip()
                    if not name:
                        continue
                    rows.append(c)
                if rows:
                    response["competitive_landscape_v2"] = {"competitors": rows}
        except Exception as exc:
            logger.warning(f"[cmo-synthesis] competitive_landscape skipped: {exc}")

    # ─── Review / Workplace Intelligence ──────────────────────────────
    review_state_thin = (
        not (response.get("reviews") or {}).get("count")
        and not response.get("review_themes", {}).get("positive")
    )
    if review_state_thin:
        try:
            ri_system, ri_user = build_review_intelligence_prompt(
                business_name=business_name,
                enrichment=enrichment,
                available_trace_ids=available_trace_ids,
            )
            ri_raw = await llm_trinity_synthesis(
                ri_system, ri_user,
                temperature=0.3, max_tokens=1800, timeout=70,
                user_id=user_id, tier=tier,
            )
            ri_parsed = parse_synthesis_json(ri_raw)
            if isinstance(ri_parsed, dict):
                cs = ri_parsed.get("customer_sentiment") or {}
                wi = ri_parsed.get("workplace_intelligence") or {}
                if cs or wi:
                    response["review_intelligence_v2"] = {
                        "customer_sentiment": cs,
                        "workplace_intelligence": wi,
                        "source_trace_ids": ri_parsed.get("source_trace_ids") or [],
                    }
        except Exception as exc:
            logger.warning(f"[cmo-synthesis] review_intelligence skipped: {exc}")

    return response


def _build_cmo_degraded_fallback(user_id: str, sb: Any, exc: Exception) -> Dict[str, Any]:
    """Defense-in-depth (2026-05-05 13041978 hard-fail follow-up):
    when the CMO Report builder throws an unhandled exception, return a
    structured 200 response with at minimum the company name + DEGRADED state
    so the frontend renders a "report temporarily unavailable" banner instead
    of the user seeing every field show its frontend-fallback placeholder
    ("Your business", "Connected integrations", "0/100" dials, etc).
    Per BIQc Platform Contract v2: never expose supplier names or internal
    error strings; only the sanitised state + a generic message.
    """
    company = "Your Business"
    try:
        profile_result = sb.table("business_profiles") \
            .select("business_name, company_name") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        profile = (profile_result.data or [{}])[0] if profile_result.data else {}
        company = profile.get("business_name") or profile.get("company_name") or company
    except Exception:
        pass

    now = datetime.now(timezone.utc)
    return {
        "company_name": company,
        "report_date": now.strftime("%d/%m/%Y"),
        "generated_at": now.isoformat(),
        "executive_summary": None,
        "market_position": {"overall": 0, "brand": 0, "digital": 0, "sentiment": 0, "competitive": 0},
        "competitors": [],
        "competitor_landscape_narrative": None,
        "position_dots": [],
        "swot": {"strengths": [], "weaknesses": [], "opportunities": [], "threats": []},
        "reviews": {"rating": 0, "count": 0, "positive_pct": 0, "neutral_pct": 0, "negative_pct": 0},
        "review_themes": {"positive": [], "negative": []},
        "review_excerpts": [],
        "roadmap": {"quick_wins": [], "priorities": [], "strategic": []},
        "geographic": {"established": [], "growth": []},
        "confidence": 0,
        "report_id": f"CMO-{now.strftime('%Y%m%d')}-{(user_id or 'anon')[:8]}",
        "engine": "BIQc Intelligence Engine",
        "scan_source": "Deep calibration scan",
        "data_points": "0 evidence points",
        "state": ExternalState.DEGRADED.value,
        "state_message": "Report temporarily unavailable. Please refresh in a moment.",
        "report_state": "PARTIAL_DEGRADED",
        "cmo_priority_actions": [],
        "industry_action_items": [],
        "competitor_swot": [],
        "seo_analysis": {},
        "digital_footprint": {},
        "sections": {},
    }


@router.get("/intelligence/cmo-report")
async def get_cmo_report(current_user: dict = Depends(get_current_user)):
    """
    Build the CMO intelligence report from `business_dna_enrichment.enrichment`
    as the primary data source. Falls back to a clean "calibrating" state if
    no enrichment row exists for the user.

    2026-05-05 hard-fail follow-up (13041978): the entire body is now wrapped
    in a defense-in-depth try/except. If ANY unhandled exception is raised
    between BDE fetch and the final scrub, we log the full traceback (so we
    can find the root cause from server logs) and return a structured DEGRADED
    response with the user's company_name. This prevents the frontend's
    "all fields fall back to placeholders" UX (Your business / Connected
    integrations / 0/100 dials) when the backend errors silently.
    """
    user_id = current_user["id"]
    sb = init_supabase()
    try:
        return await _get_cmo_report_impl(current_user, user_id, sb)
    except Exception as exc:
        logger.exception(
            "[cmo-report] HARD-FAIL: unhandled exception for user_id=%s class=%s message=%s "
            "— returning DEGRADED defense-in-depth response per 13041978",
            user_id, type(exc).__name__, str(exc)[:300],
        )
        return _build_cmo_degraded_fallback(user_id, sb, exc)


async def _get_cmo_report_impl(current_user: dict, user_id: str, sb: Any):

    # 1) Company name for the header. Best-effort only.
    company = "Your Business"
    try:
        profile_result = sb.table("business_profiles") \
            .select("business_name, company_name") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        profile = (profile_result.data or [{}])[0] if profile_result.data else {}
        company = profile.get("business_name") or profile.get("company_name") or company
    except Exception as profile_err:
        logger.debug(f"[cmo-report] business_profiles lookup skipped: {profile_err}")

    # 2) Primary data source: latest `business_dna_enrichment` row for user.
    enrichment: Dict[str, Any] = {}
    enrichment_created_at: Optional[str] = None
    try:
        enr_result = sb.table("business_dna_enrichment") \
            .select("enrichment, digital_footprint, created_at, updated_at") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(1) \
            .maybe_single() \
            .execute()
        row = enr_result.data if (enr_result and enr_result.data) else None
        if row and isinstance(row, dict):
            raw_enrichment = row.get("enrichment") or {}
            if isinstance(raw_enrichment, dict):
                enrichment = raw_enrichment
            # digital_footprint lives as its own column AND inside enrichment.
            # Prefer the column if populated so we don't double-wash anything.
            col_fp = row.get("digital_footprint")
            if isinstance(col_fp, dict) and col_fp:
                enrichment.setdefault("digital_footprint", col_fp)
            # Use the freshest timestamp for report recency and cache correctness.
            enrichment_created_at = row.get("updated_at") or row.get("created_at")
    except Exception as enr_err:
        logger.warning(f"[cmo-report] business_dna_enrichment lookup failed: {enr_err}")

    # 3) No enrichment -> clean calibrating state (not a half-populated stub).
    if not enrichment:
        empty = _cmo_empty_shell(user_id, company)
        # E6 (2026-05-04): Even in the empty/processing path, return per-section
        # SectionEvidence so the frontend can render PROCESSING banners for
        # every section consistently. Each section's state will be PROCESSING
        # (calibration not yet complete).
        empty["sections"] = _build_section_evidence_for_cmo(
            empty, {}, is_processing=True,
        )
        return scrub_response_for_external(empty)

    # 4) Map enrichment -> CMO response shape.
    company_from_enrichment = (
        enrichment.get("business_name")
        or enrichment.get("title")
        or company
    )

    # Executive summary falls through a priority chain: CMO-specific brief
    # first, then generic executive_summary, then forensic memo.
    exec_summary = (
        enrichment.get("cmo_executive_brief")
        or enrichment.get("executive_summary")
        or enrichment.get("forensic_memo")
        or None
    )
    if isinstance(exec_summary, str) and is_placeholder_text(exec_summary):
        exec_summary = None

    generated_at = enrichment_created_at or datetime.now(timezone.utc).isoformat()
    try:
        generated_dt = _safe_parse_iso(generated_at) or datetime.now(timezone.utc)
    except Exception:
        generated_dt = datetime.now(timezone.utc)

    # Confidence is evidence-derived only. String tiers ("high/medium/low")
    # are not treated as numeric confidence in customer-facing output.
    conf_raw = enrichment.get("confidence")
    if isinstance(conf_raw, (int, float)):
        confidence = _coerce_score(conf_raw)
    else:
        confidence = 0

    raw_swot = enrichment.get("swot") if isinstance(enrichment.get("swot"), dict) else {}
    swot = {
        "strengths": clean_string_list(raw_swot.get("strengths") or []),
        "weaknesses": clean_string_list(raw_swot.get("weaknesses") or []),
        "opportunities": clean_string_list(raw_swot.get("opportunities") or []),
        "threats": clean_string_list(raw_swot.get("threats") or []),
    }

    roadmap = _shape_roadmap_from_enrichment(enrichment)
    roadmap = {
        "quick_wins": [item for item in roadmap.get("quick_wins") or [] if not is_placeholder_text(str(item.get("text") or ""))],
        "priorities": [item for item in roadmap.get("priorities") or [] if not is_placeholder_text(str(item.get("text") or ""))],
        "strategic": [item for item in roadmap.get("strategic") or [] if not is_placeholder_text(str(item.get("text") or ""))],
    }

    # Phase 1.X CMO Report mapping hard-fix (2026-05-05 code 13041978):
    # Andreas hard-fail report: CMO Report showed 0/100 + INSUFFICIENT_SIGNAL
    # despite real BDE data (Smsglobal scan: cmo_executive_brief had real
    # narrative, competitor_analysis had real narrative paragraph naming
    # Burst SMS / MessageMedia / Twilio / ClickSend, cmo_priority_actions
    # had 4 real items). Bug: code at line 1968 called .get() on a STRING
    # competitor_analysis (calibration synthesis writes it as narrative
    # paragraph) which silently returned None → frontend showed "No
    # competitive data available". Plus exec_summary check ignored real
    # content in cmo_executive_brief when executive_summary was "" empty.
    #
    # FIX: surface narrative competitor_analysis as competitor_landscape_narrative
    # field; safely handle both string and dict shapes; ensure exec_summary
    # falls through correctly even when one of the 3 candidate fields is "".

    # Safely interpret competitor_analysis whether dict (semrush-domain-intel
    # output shape) or string (calibration synthesis narrative form).
    raw_competitor_analysis = enrichment.get("competitor_analysis")
    competitor_analysis_obj: Dict[str, Any] = {}
    competitor_landscape_narrative: Optional[str] = None
    if isinstance(raw_competitor_analysis, dict):
        competitor_analysis_obj = raw_competitor_analysis
    elif isinstance(raw_competitor_analysis, str) and raw_competitor_analysis.strip():
        # narrative paragraph form — surface as text rather than dropping
        if not is_placeholder_text(raw_competitor_analysis):
            competitor_landscape_narrative = raw_competitor_analysis.strip()

    # If exec_summary fell to None because executive_summary was "" empty
    # but cmo_executive_brief had content, the priority chain above already
    # handles it. But guard against priority chain returning empty string.
    if isinstance(exec_summary, str) and not exec_summary.strip():
        # try fallback chain again, picking first non-empty non-placeholder
        for candidate in (
            enrichment.get("cmo_executive_brief"),
            enrichment.get("executive_summary"),
            enrichment.get("forensic_memo"),
            competitor_landscape_narrative,
        ):
            if isinstance(candidate, str) and candidate.strip() and not is_placeholder_text(candidate):
                exec_summary = candidate.strip()
                break
        else:
            exec_summary = None

    response: Dict[str, Any] = {
        "company_name": company_from_enrichment,
        "report_date": generated_dt.strftime("%d/%m/%Y"),
        "generated_at": generated_at,
        "executive_summary": exec_summary,
        "market_position": _derive_market_position_from_enrichment(enrichment),
        "competitors": _shape_competitors_from_enrichment(enrichment),
        "competitor_landscape_narrative": competitor_landscape_narrative,
        "position_dots": [],  # calibration does not compute x/y yet
        "swot": swot,
        "reviews": _shape_reviews_from_enrichment(enrichment),
        "review_themes": {
            "positive": (enrichment.get("customer_review_highlights", {}).get("positive_themes") or [])
                if isinstance(enrichment.get("customer_review_highlights"), dict) else [],
            "negative": (enrichment.get("customer_review_highlights", {}).get("negative_themes") or [])
                if isinstance(enrichment.get("customer_review_highlights"), dict) else [],
        },
        "review_excerpts": enrichment.get("review_excerpts") or [],
        "roadmap": roadmap,
        "geographic": {
            "established": enrichment.get("established_regions") or [],
            "growth": enrichment.get("growth_regions") or [],
        },
        "confidence": confidence,
        "report_id": f"CMO-{generated_dt.strftime('%Y%m%d')}-{user_id[:8]}",
        # Extras surfaced to the frontend where applicable.
        "cmo_priority_actions": enrichment.get("cmo_priority_actions") or [],
        "industry_action_items": enrichment.get("industry_action_items") or [],
        "competitor_swot": enrichment.get("competitor_swot") or [],
        "seo_analysis": enrichment.get("seo_analysis") or {},
        "digital_footprint": enrichment.get("digital_footprint") or {},
        # ─── R2D (2026-05-04): Deep SEMrush intel surfaced to CMO Report ─
        # competitive_position consumes detailed_competitors + paid_competitors
        # brand_strength consumes keyword_intelligence (volume + reach) + backlinks
        # strategic_roadmap consumes top_pages + target keywords
        # competitive_landscape consumes advertising_intelligence (ad-spend trend)
        # market_position_score advertising-intensity dimension also feeds from
        # advertising_intelligence.budget_posture.
        "keyword_intelligence": enrichment.get("keyword_intelligence") or {},
        "backlink_intelligence": (
            enrichment.get("backlink_intelligence")
            or enrichment.get("backlink_profile")
            or {}
        ),
        "advertising_intelligence": enrichment.get("advertising_intelligence") or {},
        # detailed_competitors is also exposed under competitor_analysis;
        # surface a top-level alias so frontend roadmap components don't
        # need to drill into competitor_analysis.detailed_competitors.
        # Phase 1.X (2026-05-05 code 13041978): use competitor_analysis_obj
        # (always dict) instead of raw .get() which fails on string form.
        "detailed_competitors": competitor_analysis_obj.get("detailed_competitors") or [],
        "paid_competitor_analysis": enrichment.get("paid_competitor_analysis") or {},
        # Header meta fields.
        "engine": "BIQc Intelligence Engine",
        "scan_source": enrichment.get("website_url") or "Deep calibration scan",
        "data_points": "--",
        "state": "ready",
    }

    # 5) Optional delta overlay from `intelligence_actions`: treat them ONLY
    #    as delta updates to refresh stale enrichment.actions — never as the
    #    primary source of SWOT/roadmap. If enrichment does not expose an
    #    `actions` field, we still surface the most recent few as a light
    #    "recent signals" augmentation without overwriting the core report.
    try:
        if isinstance(enrichment.get("actions"), list):
            actions_result = sb.table("intelligence_actions") \
                .select("id, source, title, description, severity, status, created_at") \
                .eq("user_id", user_id) \
                .order("created_at", desc=True) \
                .limit(20) \
                .execute()
            recent = actions_result.data or []
            # Only refresh when intelligence_actions has newer rows than the
            # enrichment snapshot.
            if recent and enrichment_created_at:
                enr_dt = _safe_parse_iso(enrichment_created_at)
                newest_action_dt = _safe_parse_iso(recent[0].get("created_at"))
                if enr_dt and newest_action_dt and newest_action_dt > enr_dt:
                    response["actions_delta"] = recent
    except Exception as actions_err:
        logger.debug(f"[cmo-report] intelligence_actions delta skipped: {actions_err}")

    # 6) Render-time safety filter: even if enrichment still contains legacy
    #    sentinels or meta-gap bullets, strip them before returning.
    response = _apply_render_time_filters(response)

    # 6b) R2E (2026-05-04): optional LLM synthesis enrichment.
    #     When the deep R2A-D + F14/F15 enrichment data is present but the
    #     report sections are thin, call the world-class synthesis prompts
    #     (core/synthesis_prompts.py) to fill the gaps with evidence-cited
    #     content. Provenance + anti-template filters are applied inside
    #     _enrich_cmo_with_synthesis. Errors here are non-fatal — the route
    #     never blocks on synthesis. See module docstring for the full
    #     contract.
    # 2026-05-05 (13041978) — HARD CAP synthesis at 20 seconds. Without this
    # cap, _enrich_cmo_with_synthesis can run up to 6 sequential LLM calls with
    # 60-80s timeouts each (430s worst case). Azure App Service default request
    # timeout is 230s — when synthesis exceeds it, Azure returns 504 → frontend
    # apiClient.get() throws → setReport(null) → CMOReportPage renders every
    # field as its placeholder fallback ("Your business", "Connected
    # integrations", "0/100" dials, INSUFFICIENT_SIGNAL banners). Wrapping in
    # asyncio.wait_for guarantees we never block the user-facing response on
    # synthesis. The unenriched response is always good enough — synthesis only
    # fills gaps, never adds primary data.
    import asyncio as _asyncio
    try:
        tier_str = current_user.get("tier") if isinstance(current_user, dict) else None
        response = await _asyncio.wait_for(
            _enrich_cmo_with_synthesis(
                response,
                enrichment,
                business_name=company_from_enrichment or company,
                user_id=user_id,
                tier=tier_str,
            ),
            timeout=20.0,
        )
    except _asyncio.TimeoutError:
        logger.warning(
            "[cmo-report] synthesis enrichment exceeded 20s budget for user_id=%s — "
            "returning unenriched response per 13041978 (Azure timeout guard)",
            user_id,
        )
    except Exception as syn_err:
        logger.debug(f"[cmo-report] synthesis enrichment skipped (non-fatal): {syn_err}")

    # 7) Evidence inventory + report state (zero-fake-data gate).
    # Phase 1.X (2026-05-05 code 13041978): competitor_status now ALSO accepts
    # narrative competitor_landscape_narrative as DATA_AVAILABLE — calibration
    # synthesis writes competitor_analysis as paragraph form, which is real
    # data, not absence. Same logic for SWOT — DATA_AVAILABLE when at least
    # 2 of the 4 buckets have content (was: required all 4); DEGRADED when
    # only 1 has content; otherwise INSUFFICIENT_SIGNAL.
    has_competitor_evidence = (
        len(response.get("competitors") or []) > 0
        or bool(response.get("competitor_landscape_narrative"))
        or len(response.get("detailed_competitors") or []) > 0
    )
    competitor_status = classify_section(
        has_evidence=has_competitor_evidence,
        degraded=bool((enrichment.get("competitors") or [])) or bool(competitor_landscape_narrative),
    )
    swot_buckets_with_content = sum(
        1 for bucket in ("strengths", "weaknesses", "opportunities", "threats")
        if len((response.get("swot") or {}).get(bucket) or []) > 0
    )
    swot_status = classify_section(
        has_evidence=swot_buckets_with_content >= 2,  # at least half the SWOT populated
        degraded=swot_buckets_with_content >= 1,
        has_placeholder=any(is_placeholder_text(item) for bucket in ("strengths", "weaknesses", "opportunities", "threats") for item in ((enrichment.get("swot") or {}).get(bucket) or [])),
    )
    review_status = classify_section(
        has_evidence=(response.get("reviews") or {}).get("count", 0) > 0 or len(response.get("review_excerpts") or []) > 0,
        degraded=bool((enrichment.get("customer_review_intelligence") or {}).get("has_data")),
    )
    roadmap_status = classify_section(
        has_evidence=all(len((response.get("roadmap") or {}).get(col) or []) > 0 for col in ("quick_wins", "priorities", "strategic")),
        degraded=any(len((response.get("roadmap") or {}).get(col) or []) > 0 for col in ("quick_wins", "priorities", "strategic")),
        has_placeholder=any(
            is_placeholder_text(str(item.get("text") or ""))
            for col in ("quick_wins", "priorities", "strategic")
            for item in ((enrichment.get("roadmap") or {}).get(col) or [])
            if isinstance(item, dict)
        ),
    )
    market_position_status = classify_section(
        has_evidence=(response.get("market_position") or {}).get("overall", 0) > 0,
        degraded=bool((response.get("market_position") or {}).get("brand", 0) or (response.get("market_position") or {}).get("digital", 0)),
    )
    exec_status = classify_section(
        has_evidence=bool(response.get("executive_summary")),
        has_placeholder=bool(isinstance(enrichment.get("cmo_executive_brief"), str) and is_placeholder_text(enrichment.get("cmo_executive_brief"))),
    )

    # ──────────────────────────────────────────────────────────────────────
    # 2026-05-04 (P0 Marjo R2C): Workplace Intelligence section.
    # Reads `staff_review_intelligence` (now backed by the new
    # `staff-reviews-deep` edge function — Firecrawl across Glassdoor /
    # Indeed / Seek + LLM theme extraction). Brands with strong staff
    # sentiment correlate with strong customer sentiment, so we surface
    # the workplace section as a complement to Review Intelligence
    # (customer-facing) in the CMO Report.
    # ──────────────────────────────────────────────────────────────────────
    staff_intel = enrichment.get("staff_review_intelligence") if isinstance(enrichment.get("staff_review_intelligence"), dict) else {}
    workplace_payload = {
        "weighted_overall_rating": staff_intel.get("weighted_overall_rating"),
        "staff_score": staff_intel.get("staff_score"),
        "total_reviews": staff_intel.get("total_reviews_cross_platform") or 0,
        "review_count_last_12_months": staff_intel.get("review_count_last_12_months") or 0,
        "platforms": [
            {
                "platform": p.get("platform"),
                "rating": p.get("rating"),
                "review_count": p.get("review_count"),
                "url": p.get("url"),
                "themes": p.get("themes") or {"pros": [], "cons": []},
                "rating_distribution": p.get("rating_distribution"),
            }
            for p in (staff_intel.get("platforms") or [])
            if isinstance(p, dict)
        ],
        "cross_platform_themes": staff_intel.get("cross_platform_themes") or {"pros": [], "cons": []},
        "trend_30d_vs_90d": staff_intel.get("trend_30d_vs_90d") or "insufficient_data",
        "employer_brand_health_score": staff_intel.get("employer_brand_health_score"),
        "ceo_approval": staff_intel.get("ceo_approval"),
        "recommend_to_friend": staff_intel.get("recommend_to_friend"),
        "top_positive_themes": (staff_intel.get("cross_platform_themes") or {}).get("pros") or [],
        "top_negative_themes": (staff_intel.get("cross_platform_themes") or {}).get("cons") or [],
        "action_plan": staff_intel.get("action_plan") or [],
        "competitor_employer_benchmark": staff_intel.get("competitor_employer_benchmark"),
        "deep_extraction_used": bool(staff_intel.get("deep_extraction_used")),
    }
    response["workplace_intelligence"] = workplace_payload

    workplace_status = classify_section(
        has_evidence=(
            (isinstance(workplace_payload.get("weighted_overall_rating"), (int, float)) and workplace_payload["weighted_overall_rating"] > 0)
            or (workplace_payload.get("total_reviews") or 0) > 0
            or len(workplace_payload.get("platforms") or []) > 0
        ),
        degraded=bool(staff_intel.get("has_data")) and (workplace_payload.get("total_reviews") or 0) == 0,
    )

    # ─── R2D (2026-05-04): per-section evidence audit for new SEMrush sections.
    # Each new section is graded SOURCE_BACKED only when the supplier returned
    # real data; INSUFFICIENT otherwise (Contract v2 bans fabrication).
    keyword_intel = response.get("keyword_intelligence") or {}
    keyword_intel_status = classify_section(
        has_evidence=bool(
            keyword_intel.get("organic_keywords")
            or keyword_intel.get("top_pages")
        ),
    )
    backlink_intel = response.get("backlink_intelligence") or {}
    backlink_intel_status = classify_section(
        has_evidence=bool(
            backlink_intel.get("total_backlinks") is not None
            and backlink_intel.get("referring_domains") is not None
        ),
    )
    adv_intel = response.get("advertising_intelligence") or {}
    advertising_intel_status = classify_section(
        has_evidence=bool(adv_intel.get("ad_history_12m")),
    )


    section_inventory = {
        "Chief Marketing Summary": {"status": exec_status},
        "Executive Summary": {"status": exec_status},
        "Market Position Score": {"status": market_position_status},
        "Competitive Landscape": {"status": competitor_status},
        "SWOT": {"status": swot_status},
        "Review Intelligence": {"status": review_status},
        "Workplace Intelligence": {"status": workplace_status},
        "Strategic Roadmap": {"status": roadmap_status},
        # R2D additions:
        "Keyword Intelligence": {"status": keyword_intel_status},
        "Backlink Intelligence": {"status": backlink_intel_status},
        "Advertising Intelligence": {"status": advertising_intel_status},
    }
    response["section_inventory"] = section_inventory

    section_states = [v["status"] for v in section_inventory.values()]
    report_state = derive_report_state(section_states)
    # Hard guard: if we have zero evidence points after shaping, this can never
    # be presented as a partial/complete report.
    real_points = _count_real_data_points(response)
    if real_points == 0 and report_state != REPORT_STATE_FAILED:
        report_state = REPORT_STATE_INSUFFICIENT
    if report_state == REPORT_STATE_COMPLETE:
        response["state"] = ExternalState.DATA_AVAILABLE.value
        response["state_message"] = "Report sections are source-backed."
    elif report_state == REPORT_STATE_PARTIAL:
        response["state"] = ExternalState.DEGRADED.value
        response["state_message"] = "Partial intelligence profile: some sections are degraded due to missing evidence."
    elif report_state == REPORT_STATE_INSUFFICIENT:
        response["state"] = ExternalState.INSUFFICIENT_SIGNAL.value
        response["state_message"] = "Insufficient evidence to generate a complete CMO report."
    else:
        response["state"] = ExternalState.DEGRADED.value
        response["state_message"] = "Report failed zero-fake-data checks due to placeholder or invalid sections."
    response["report_state"] = report_state

    evidence_confidence = estimate_confidence(section_states)
    response["confidence"] = confidence if confidence > 0 else evidence_confidence
    response["data_points"] = f"{real_points} evidence points"

    # 7b) P0 Marjo E2 / 2026-05-04 — provider chain audit summary.
    #     Attach a SANITISED summary of which providers ran for the scan
    #     that produced this enrichment (counts only — no supplier names,
    #     no error strings, no edge_function names). Drives the user-visible
    #     "X data sources contributed" badge without leaking the engine
    #     under BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2.
    #     Raw rows live behind /intelligence/cmo-report/audit (superadmin).
    try:
        scan_id_for_audit = enrichment.get("scan_id") if isinstance(enrichment, dict) else None
        if scan_id_for_audit:
            chain = fetch_scan_provider_chain(scan_id_for_audit, sb=sb)
            response["provider_chain_summary"] = {
                # Counts only. No supplier names. No error text. Numeric.
                "trace_count": chain.get("trace_count", 0),
                "ok_count": chain.get("ok_count", 0),
                "fail_count": chain.get("fail_count", 0),
                "abandoned_count": chain.get("abandoned_count", 0),
                "distinct_providers": len(chain.get("providers") or []),
                # Internal-only — keeps the scan_id discoverable by audit
                # endpoints that the frontend can call. Not a supplier name.
                "scan_id": chain.get("scan_id"),
            }
    except Exception as audit_err:
        logger.debug(f"[cmo-report] provider_chain_summary skipped: {audit_err}")

    # 8) Contract v2 / Step 3c (2026-04-23): scrub internal keys at any depth
    #    before returning. Strips ai_errors, sources.edge_tools, _http_status,
    #    correlation, raw_overview, source:"semrush" sub-tags, auth-path
    #    markers — anything that would leak supplier or internal identity.
    #    Also annotate the top-level state from the sanitizer's derivation
    #    so the frontend can render confidence-aware UI.
    _sanitized_envelope = sanitize_enrichment_for_external(enrichment)
    # 2026-04-23 P0 (Andreas CTO): the CMO route has ALREADY shaped
    # `swot`, `market_position`, etc. into the frontend contract
    # (numeric dials + 4 named string lists). We must NOT overwrite those
    # with the sanitizer output, because when the sanitizer flips state to
    # INSUFFICIENT_SIGNAL / DEGRADED / DATA_UNAVAILABLE, downstream
    # destructuring (`swot.strengths.length`, `market_position.overall`)
    # crashes on undefined.
    #
    # Instead: only adopt the sanitizer's version when it is DATA_AVAILABLE
    # (i.e. the supplier succeeded and data is intact). Otherwise keep the
    # already-shaped CMO response and expose state as a sibling key so the
    # frontend can render uncertainty badges without losing structure.
    _sanitized_enrich = _sanitized_envelope["enrichment"] or {}
    # 2026-05-05 (13041978) — keys with a CMO-specific frontend contract that
    # MUST NOT be overwritten by the raw sanitizer output. The CMO route has
    # already shaped these into the exact keys the React page destructures
    # (CMOReportPage.js lines 273-284 + the rest of the section renderers):
    #   market_position : {overall, brand, digital, sentiment, competitive}  ← 4 ProgressBar dials
    #   swot            : {strengths, weaknesses, opportunities, threats}    ← 4 list panels
    #   market_trajectory: stable|improving|degrading                        ← string, not envelope
    # Replacing those with the sanitizer's `{state, value, message}` envelope
    # makes CMOReportPage.pick() see the envelope (no `overall` / `strengths`
    # key), fall through to `{0,0,0,0}` / empty arrays, and the user sees the
    # exact symptom Andreas reported on 2026-05-05: every Market Position dial
    # 0/100, every SWOT bucket "Insufficient evidence", despite a fully populated
    # business_dna_enrichment row in the DB.
    _CMO_SHAPED_KEYS = frozenset(("swot", "market_position", "market_trajectory"))
    for _key in ("seo_analysis", "paid_media_analysis", "swot",
                 "seo_html_hygiene", "market_position", "market_trajectory",
                 "social_media_analysis", "website_health",
                 # R2D additions: preserve only when DATA_AVAILABLE.
                 "keyword_intelligence", "backlink_intelligence",
                 "advertising_intelligence", "paid_competitor_analysis"):
        sanitized_val = _sanitized_enrich.get(_key)
        # Adopt the sanitizer output when it preserves a dict with real data.
        # The new sanitizer (PR 2026-04-23) preserves populated data and
        # annotates state. The only time we'd lose data is when the section
        # was genuinely empty and the sanitizer returned the blank skeleton.
        if isinstance(sanitized_val, dict):
            has_real_data = any(
                k not in {"state", "message", "score", "status"}
                for k in sanitized_val.keys()
            )
            if has_real_data and _key not in _CMO_SHAPED_KEYS:
                response[_key] = sanitized_val
            elif _key in _CMO_SHAPED_KEYS:
                # Keep the CMO-shaped response intact, but expose the
                # sanitizer's state on a sibling key so the frontend can
                # render uncertainty badges (e.g., a banner above the dials)
                # without crashing on the missing `overall` key.
                response[f"{_key}_state"] = sanitized_val.get("state")
                response[f"{_key}_message"] = sanitized_val.get("message")
            else:
                # Sanitizer returned empty skeleton. Keep the CMO-shaped
                # response (if any) and annotate state on a sibling key.
                response[f"{_key}_state"] = sanitized_val.get("state")
                response[f"{_key}_message"] = sanitized_val.get("message")

    # 9) E6 (2026-05-04): Per-section evidence contract.
    # Every CMO Report section must be returned as a SectionEvidence object
    # with explicit state + sanitised reason + provenance trace ids. Generic
    # SWOT/Roadmap items that fail the placeholder denylist OR the provenance
    # check are dropped, and the parent section flips to INSUFFICIENT_SIGNAL.
    #
    # Per Andreas's PR #449 follow-up: thin/templated reports are an
    # AUTOMATIC FAIL. The per-section evidence contract makes it impossible
    # for the frontend to render a generic Marketing-101 SWOT or roadmap.
    response["sections"] = _build_section_evidence_for_cmo(
        response, enrichment, is_processing=False,
    )

    return scrub_response_for_external(response)


# ═══════════════════════════════════════════════════════════════
# P0 Marjo E2 / 2026-05-04 — provider-trace audit endpoints
# ═══════════════════════════════════════════════════════════════
#
# Two endpoints:
#
#   GET /intelligence/cmo-report/audit
#     Owner-readable. Returns the SANITISED chain summary for the latest
#     scan tied to the user's most recent business_dna_enrichment row.
#     Counts only — no supplier names, no error strings. Drives the
#     in-app "diagnostics" tab a paying user can open to confirm "we
#     called X providers for your scan, Y succeeded, Z failed".
#
#   GET /intelligence/cmo-report/audit/{scan_id}/raw
#     Superadmin-only. Returns the FULL row set for the named scan,
#     including provider slugs, edge_function names, error strings.
#     Backstops the daily ops_daily_calibration_check + Andreas's
#     post-incident forensic drill. Strictly behind get_super_admin
#     to keep the engine details inside the trust boundary per
#     BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2.

@router.get("/intelligence/cmo-report/audit")
async def get_cmo_report_audit_summary(current_user: dict = Depends(get_current_user)):
    """Owner-readable per-scan audit summary — sanitised counts only."""
    user_id = current_user["id"]
    sb = init_supabase()

    # Latest enrichment row → latest scan_id.
    scan_id_for_audit = None
    try:
        enr_result = (
            sb.table("business_dna_enrichment")
              .select("enrichment, created_at, updated_at")
              .eq("user_id", user_id)
              .order("created_at", desc=True)
              .limit(1)
              .maybe_single()
              .execute()
        )
        row = enr_result.data if enr_result and enr_result.data else None
        if row and isinstance(row, dict):
            enrichment = row.get("enrichment") or {}
            if isinstance(enrichment, dict):
                scan_id_for_audit = enrichment.get("scan_id")
    except Exception as exc:
        logger.debug(f"[cmo-report/audit] enrichment lookup skipped: {exc}")

    if not scan_id_for_audit:
        return scrub_response_for_external({
            "scan_id": None,
            "trace_count": 0,
            "ok_count": 0,
            "fail_count": 0,
            "abandoned_count": 0,
            "distinct_providers": 0,
            "state": ExternalState.INSUFFICIENT_SIGNAL.value,
            "state_message": "No scan diagnostics available yet.",
        })

    try:
        chain = fetch_scan_provider_chain(scan_id_for_audit, sb=sb)
    except Exception as exc:
        logger.warning(f"[cmo-report/audit] fetch_scan_provider_chain failed: {exc}")
        return scrub_response_for_external({
            "scan_id": scan_id_for_audit,
            "trace_count": 0,
            "ok_count": 0,
            "fail_count": 0,
            "abandoned_count": 0,
            "distinct_providers": 0,
            "state": ExternalState.DEGRADED.value,
            "state_message": "Scan diagnostics temporarily unavailable.",
        })

    # Sanitised payload — counts only. Supplier names DO NOT appear here.
    return scrub_response_for_external({
        "scan_id": chain.get("scan_id"),
        "trace_count": chain.get("trace_count", 0),
        "ok_count": chain.get("ok_count", 0),
        "fail_count": chain.get("fail_count", 0),
        "abandoned_count": chain.get("abandoned_count", 0),
        "distinct_providers": len(chain.get("providers") or []),
        "state": (
            ExternalState.DATA_AVAILABLE.value
            if chain.get("ok_count", 0) > 0 and chain.get("fail_count", 0) == 0
            else ExternalState.DEGRADED.value
            if chain.get("ok_count", 0) > 0
            else ExternalState.INSUFFICIENT_SIGNAL.value
        ),
        "state_message": (
            f"Scan reached {chain.get('ok_count', 0)} of "
            f"{max(chain.get('trace_count', 0), 1)} configured intelligence sources."
        ),
    })


@router.get("/intelligence/cmo-report/audit/{scan_id}/raw")
async def get_cmo_report_audit_raw(scan_id: str, admin: dict = Depends(get_super_admin)):
    """Superadmin-only — full per-call rows for a scan including supplier
    slugs and error strings. Used by the daily ops calibration check and
    forensic drill. Never reachable by a regular user."""
    sb = init_supabase()
    try:
        chain = fetch_scan_provider_chain(scan_id, sb=sb)
    except Exception as exc:
        logger.error(f"[cmo-report/audit/raw] failed for scan_id={scan_id}: {exc}")
        raise HTTPException(500, "audit lookup failed")

    # Raw rows surface supplier names + error strings. Allowed here because
    # this endpoint is gated on get_super_admin. NOT scrubbed.
    return {
        "scan_id": chain.get("scan_id"),
        "trace_count": chain.get("trace_count", 0),
        "ok_count": chain.get("ok_count", 0),
        "fail_count": chain.get("fail_count", 0),
        "abandoned_count": chain.get("abandoned_count", 0),
        "unsanitised_count": chain.get("unsanitised_count", 0),
        "providers": chain.get("providers") or [],
        "rows": chain.get("rows") or [],
    }


# ═══════════════════════════════════════════════════════════════
# SUPERNATURAL INTELLIGENCE ENDPOINTS
# ═══════════════════════════════════════════════════════════════

# --- Proactive Intelligence ---

@router.post("/intelligence/proactive-scan")
async def trigger_proactive_scan(user=Depends(get_current_user)):
    """Run all proactive intelligence detectors."""
    try:
        sb = init_supabase()
        from proactive_intelligence import ProactiveIntelligenceEngine
        engine = ProactiveIntelligenceEngine(sb)
        alerts = engine.run_full_scan(user["id"])
        return {"alerts_generated": len(alerts), "alerts": alerts}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Proactive scan failed: {e}", exc_info=True)
        raise HTTPException(500, "Proactive scan failed")


@router.get("/intelligence/proactive-alerts")
async def get_proactive_alerts(domain: str = None, severity: str = None, limit: int = 20, user=Depends(get_current_user)):
    """Get proactive intelligence alerts for user."""
    try:
        sb = init_supabase()
        query = sb.table("intelligence_actions") \
            .select("*") \
            .eq("user_id", user["id"]) \
            .eq("source", "proactive_engine") \
            .eq("status", "action_required") \
            .order("created_at", desc=True) \
            .limit(limit)
        if domain:
            query = query.eq("domain", domain)
        if severity:
            query = query.eq("severity", severity)
        result = query.execute()
        return {"alerts": result.data or [], "count": len(result.data or [])}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Proactive alerts fetch failed: {e}", exc_info=True)
        raise HTTPException(500, "Failed to fetch proactive alerts")


# --- Predictive Intelligence ---

@router.get("/intelligence/predictions")
async def get_predictions(model: str = None, user=Depends(get_current_user)):
    """Get latest predictions for user."""
    try:
        sb = init_supabase()
        query = sb.table("predictions") \
            .select("*") \
            .eq("user_id", user["id"]) \
            .order("prediction_date", desc=True) \
            .limit(30)
        if model:
            query = query.eq("model_name", model)
        result = query.execute()
        return {"predictions": result.data or []}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Predictions fetch failed: {e}", exc_info=True)
        raise HTTPException(500, "Failed to fetch predictions")


@router.post("/intelligence/predict")
async def trigger_predictions(user=Depends(get_current_user)):
    """Manually trigger prediction models."""
    try:
        sb = init_supabase()
        from predictive_intelligence import PredictiveIntelligenceEngine
        engine = PredictiveIntelligenceEngine(sb)
        results = engine.run_all_predictions(user["id"])
        return {"predictions": results}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Predictions failed: {e}", exc_info=True)
        raise HTTPException(500, "Prediction models failed")


# --- External Intelligence Feed ---

@router.get("/intelligence/external-feed")
async def get_external_intelligence_feed(source_type: str = None, limit: int = 50, user=Depends(get_current_user)):
    """Get unified external intelligence feed."""
    try:
        sb = init_supabase()
        # Query individual tables and combine (view may not exist yet)
        feed = []
        tables_map = {
            "news": ("industry_news", "headline"),
            "regulatory": ("regulatory_signals", "title"),
            "reputation": ("reputation_signals", "platform"),
            "supply_chain": ("supply_chain_signals", "signal_type"),
            "job_market": ("job_market_signals", "company_name"),
        }
        targets = {source_type: tables_map[source_type]} if source_type and source_type in tables_map else tables_map
        for stype, (table, _) in targets.items():
            try:
                result = sb.table(table) \
                    .select("*") \
                    .eq("user_id", user["id"]) \
                    .order("created_at", desc=True) \
                    .limit(limit // len(targets)) \
                    .execute()
                for row in (result.data or []):
                    row["_source_type"] = stype
                    feed.append(row)
            except Exception:
                pass  # Table may not exist yet
        feed.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return {"feed": feed[:limit], "count": len(feed)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"External feed failed: {e}", exc_info=True)
        raise HTTPException(500, "Failed to fetch external intelligence")


# --- Strategic Narratives ---

@router.get("/intelligence/narrative")
async def get_latest_narrative(narrative_type: str = "weekly", user=Depends(get_current_user)):
    """Get latest strategic narrative."""
    try:
        sb = init_supabase()
        result = sb.table("strategic_narratives") \
            .select("*") \
            .eq("user_id", user["id"]) \
            .eq("narrative_type", narrative_type) \
            .order("period_end", desc=True) \
            .limit(1) \
            .execute()
        return result.data[0] if result.data else {"message": "No narrative generated yet"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Narrative fetch failed: {e}", exc_info=True)
        raise HTTPException(500, "Failed to fetch narrative")


@router.post("/intelligence/narrative/generate")
async def generate_narrative(user=Depends(get_current_user)):
    """Generate a weekly strategic narrative."""
    try:
        sb = init_supabase()
        from narrative_synthesis import NarrativeSynthesisEngine
        engine = NarrativeSynthesisEngine(sb)
        result = engine.generate_weekly_narrative(user["id"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Narrative generation failed: {e}", exc_info=True)
        raise HTTPException(500, "Failed to generate narrative")


# --- Calendar Intelligence ---

@router.get("/calendar/intelligence")
async def get_calendar_intelligence(user=Depends(get_current_user)):
    """Get calendar intelligence: daily brief, time allocation, network."""
    try:
        sb = init_supabase()
        from calendar_intelligence import CalendarIntelligenceEngine
        engine = CalendarIntelligenceEngine(sb)
        return engine.store_intelligence(user["id"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Calendar intelligence failed: {e}", exc_info=True)
        raise HTTPException(500, "Failed to generate calendar intelligence")


@router.get("/calendar/prep-brief")
async def get_meeting_prep_brief(user=Depends(get_current_user)):
    """Get today's meeting prep brief."""
    try:
        sb = init_supabase()
        from calendar_intelligence import CalendarIntelligenceEngine
        engine = CalendarIntelligenceEngine(sb)
        return engine.generate_daily_brief(user["id"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Meeting prep failed: {e}", exc_info=True)
        raise HTTPException(500, "Failed to generate meeting brief")


# --- Decision Intelligence ---

@router.post("/decisions")
async def create_decision(request_obj: dict, user=Depends(get_current_user)):
    """Create a new decision entry."""
    try:
        sb = init_supabase()
        from decision_intelligence import DecisionIntelligenceEngine
        engine = DecisionIntelligenceEngine(sb)
        return engine.create_decision(user["id"], request_obj)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Decision create failed: {e}", exc_info=True)
        raise HTTPException(500, "Failed to create decision")


@router.post("/decisions/{decision_id}/outcome")
async def record_decision_outcome(decision_id: str, request_obj: dict, user=Depends(get_current_user)):
    """Record decision outcome."""
    try:
        sb = init_supabase()
        from decision_intelligence import DecisionIntelligenceEngine
        engine = DecisionIntelligenceEngine(sb)
        return engine.record_outcome(user["id"], decision_id, request_obj)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Decision outcome failed: {e}", exc_info=True)
        raise HTTPException(500, "Failed to record outcome")


@router.get("/decisions/patterns")
async def get_decision_patterns(user=Depends(get_current_user)):
    """Get decision pattern analysis."""
    try:
        sb = init_supabase()
        from decision_intelligence import DecisionIntelligenceEngine
        engine = DecisionIntelligenceEngine(sb)
        return engine.get_decision_patterns(user["id"])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Decision patterns failed: {e}", exc_info=True)
        raise HTTPException(500, "Failed to get patterns")


@router.get("/decisions/pending-reviews")
async def get_pending_reviews(user=Depends(get_current_user)):
    """Get decisions due for review."""
    try:
        sb = init_supabase()
        from decision_intelligence import DecisionIntelligenceEngine
        engine = DecisionIntelligenceEngine(sb)
        reviews = engine.get_pending_reviews(user["id"])
        return {"reviews": reviews, "count": len(reviews)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Pending reviews failed: {e}", exc_info=True)
        raise HTTPException(500, "Failed to get pending reviews")


@router.get("/decisions")
async def list_decisions(status: str = None, domain: str = None, limit: int = 50, user=Depends(get_current_user)):
    """List user decisions."""
    try:
        sb = init_supabase()
        query = sb.table("decision_log") \
            .select("*") \
            .eq("user_id", user["id"]) \
            .order("created_at", desc=True) \
            .limit(limit)
        if status:
            query = query.eq("status", status)
        if domain:
            query = query.eq("domain", domain)
        result = query.execute()
        return {"decisions": result.data or []}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Decisions list failed: {e}", exc_info=True)
        raise HTTPException(500, "Failed to list decisions")


# ═══════════════════════════════════════════════════════════════
# CRON-INVOKED: Morning Brief queue processor (Sprint A #2)
# ═══════════════════════════════════════════════════════════════
#
# Endpoint the `intel_process_morning_brief` pg_cron job POSTs to every
# 5 minutes (see migration 116). Drains a batch of intelligence_queue
# rows for schedule_key='morning_brief' and sends the E15 email.
#
# Auth is a shared-secret header (NOT a user JWT) because the call
# originates from inside the DB via pg_net and can't easily carry an
# admin bearer. The secret lives in env var MORNING_BRIEF_WORKER_SECRET
# and must match across:
#   - Backend runtime (this check)
#   - Migration 116 (embeds it in the Authorization header or a
#     custom X-BIQc-Cron-Secret header — we accept EITHER, see below)
#
# Why a separate endpoint (not the super-admin one):
#   • Cron can't sign a user JWT. Shared-secret is the right shape.
#   • Keeps the super-admin endpoint behind the normal admin auth
#     chain without forcing cron to inherit any of that surface.
#   • Distinct endpoint = distinct Azure app-insights metric for
#     "cron is hitting us" vs "a human clicked the admin button".

import os as _os_intel  # local alias — avoid shadowing file-level `os` if present
from fastapi import Header

_MORNING_BRIEF_SECRET_ENV = "MORNING_BRIEF_WORKER_SECRET"


def _require_cron_secret(provided: Optional[str]) -> None:
    """Constant-time compare the provided shared secret against the
    configured env var. Raises 401/503 on mismatch.

    Fails CLOSED when the env var is missing — a misconfig should not
    make the endpoint unauthenticated.
    """
    configured = (_os_intel.environ.get(_MORNING_BRIEF_SECRET_ENV) or "").strip()
    if not configured:
        raise HTTPException(
            status_code=503,
            detail=f"{_MORNING_BRIEF_SECRET_ENV} not configured on backend",
        )
    import hmac
    if not provided or not hmac.compare_digest(str(provided).strip(), configured):
        raise HTTPException(status_code=401, detail="Invalid cron secret")


@router.post("/intelligence/process-morning-brief")
async def process_morning_brief_endpoint(
    x_biqc_cron_secret: Optional[str] = Header(default=None, alias="X-BIQc-Cron-Secret"),
    authorization: Optional[str] = Header(default=None),
    batch_size: int = 200,
):
    """Drain the morning_brief queue and send E15 emails.

    Auth (accepts either):
      * X-BIQc-Cron-Secret: <secret>
      * Authorization: Bearer <secret>

    Query params
    ------------
    batch_size : int, default 200
        Max queue rows per call. Clamped to [1, 500]. With pg_cron firing
        every 5 min, 200/call × 12/hr = 2400 briefs/hr capacity per cron
        worker — well above current user base.

    Returns
    -------
    Worker summary dict: {total_processed, sent, failed, skipped, ...}.
    """
    # Resolve provided secret (prefer explicit header; fall back to Bearer).
    provided = x_biqc_cron_secret
    if not provided and authorization:
        token = authorization.strip()
        if token.lower().startswith("bearer "):
            provided = token[7:].strip()
        else:
            provided = token
    _require_cron_secret(provided)

    batch_size = max(1, min(int(batch_size or 200), 500))
    try:
        from jobs.morning_brief_worker import run_morning_brief_worker
        summary = await run_morning_brief_worker(batch_size=batch_size)
        return summary
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[morning_brief_worker] cron-triggered run failed: {exc}", exc_info=True)
        raise HTTPException(
            status_code=502,
            detail=f"Morning brief worker failed: {type(exc).__name__}: {exc}",
        )
