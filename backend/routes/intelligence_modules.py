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

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user

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

@router.get("/intelligence/cmo-report")
async def get_cmo_report(current_user: dict = Depends(get_current_user)):
    """Build a CMO-style intelligence report from the user's workspace data."""
    user_id = current_user["id"]
    try:
        sb = init_supabase()

        # Fetch business profile for company name
        profile_result = sb.table("business_profiles") \
            .select("company_name, industry, market_position") \
            .eq("user_id", user_id) \
            .limit(1) \
            .execute()
        profile = (profile_result.data or [{}])[0] if profile_result.data else {}

        # Fetch recent intelligence actions for report data
        actions_result = sb.table("intelligence_actions") \
            .select("source, title, description, severity, status, created_at") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(100) \
            .execute()
        actions = actions_result.data or []

        # Fetch watchtower positions for competitive data
        watchtower_data = {}
        try:
            wt_result = sb.rpc("compute_watchtower_positions", {"p_workspace_id": user_id}).execute()
            watchtower_data = wt_result.data or {}
        except Exception:
            pass

        # Fetch intelligence summary for scores
        summary_data = {}
        try:
            sum_result = sb.rpc("build_intelligence_summary", {"p_workspace_id": user_id}).execute()
            summary_data = sum_result.data or {}
        except Exception:
            pass

        # Build market position from summary
        market_intel = summary_data.get("market_intelligence", {}) if isinstance(summary_data, dict) else {}
        modules = summary_data.get("modules", {}) if isinstance(summary_data, dict) else {}

        market_position = {
            "overall": market_intel.get("market_position_score", 0) if isinstance(market_intel, dict) else 0,
            "brand": market_intel.get("brand_strength", 0) if isinstance(market_intel, dict) else 0,
            "digital": market_intel.get("digital_presence", 0) if isinstance(market_intel, dict) else 0,
            "sentiment": market_intel.get("sentiment_score", 0) if isinstance(market_intel, dict) else 0,
            "competitive": market_intel.get("competitive_position", 0) if isinstance(market_intel, dict) else 0,
        }

        # Build competitors from watchtower data
        competitors = []
        if isinstance(watchtower_data, dict):
            for comp in watchtower_data.get("competitors", []):
                if isinstance(comp, dict):
                    competitors.append({
                        "name": comp.get("name", "Unknown"),
                        "market_share": comp.get("market_share", "N/A"),
                        "strengths": comp.get("strengths", "N/A"),
                        "digital_visibility": comp.get("digital_visibility", "N/A"),
                        "threat_level": comp.get("threat_level", "low"),
                        "is_you": comp.get("is_you", False),
                    })

        # Build SWOT from intelligence actions
        swot = {"strengths": [], "weaknesses": [], "opportunities": [], "threats": []}
        for action in actions:
            sev = (action.get("severity") or "").lower()
            title = action.get("title") or ""
            if sev == "positive" or action.get("status") == "complete":
                if len(swot["strengths"]) < 5:
                    swot["strengths"].append(title)
            elif sev == "critical" or sev == "high":
                if len(swot["threats"]) < 5:
                    swot["threats"].append(title)
            elif sev == "warning" or sev == "medium":
                if len(swot["weaknesses"]) < 5:
                    swot["weaknesses"].append(title)
            elif sev == "info" or sev == "low":
                if len(swot["opportunities"]) < 5:
                    swot["opportunities"].append(title)

        # Build reviews summary
        reviews = {
            "rating": market_intel.get("review_rating", 0) if isinstance(market_intel, dict) else 0,
            "count": market_intel.get("review_count", 0) if isinstance(market_intel, dict) else 0,
            "positive_pct": market_intel.get("positive_pct", 0) if isinstance(market_intel, dict) else 0,
            "neutral_pct": market_intel.get("neutral_pct", 0) if isinstance(market_intel, dict) else 0,
            "negative_pct": market_intel.get("negative_pct", 0) if isinstance(market_intel, dict) else 0,
        }

        # Build roadmap from action plan
        action_plan = summary_data.get("action_plan", {}) if isinstance(summary_data, dict) else {}
        roadmap = {
            "quick_wins": action_plan.get("quick_wins", []) if isinstance(action_plan, dict) else [],
            "priorities": action_plan.get("priorities", []) if isinstance(action_plan, dict) else [],
            "strategic": action_plan.get("strategic", []) if isinstance(action_plan, dict) else [],
        }

        # Build geographic data
        geographic = {
            "established": market_intel.get("established_regions", []) if isinstance(market_intel, dict) else [],
            "growth": market_intel.get("growth_regions", []) if isinstance(market_intel, dict) else [],
        }

        # Compute confidence
        data_points = len(actions) + (1 if watchtower_data else 0) + (1 if summary_data else 0)
        confidence = min(95, max(10, data_points * 2))

        return {
            "company_name": profile.get("company_name", "Your Business"),
            "report_date": datetime.now(timezone.utc).strftime("%d/%m/%Y"),
            "executive_summary": f"Intelligence report for {profile.get('company_name', 'your business')} based on {len(actions)} data signals across all connected sources.",
            "market_position": market_position,
            "competitors": competitors,
            "swot": swot,
            "reviews": reviews,
            "roadmap": roadmap,
            "geographic": geographic,
            "confidence": confidence,
            "report_id": f"CMO-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{user_id[:8]}",
        }
    except Exception as e:
        logger.warning(f"CMO report generation failed: {e}")
        return {
            "company_name": "Your Business",
            "report_date": datetime.now(timezone.utc).strftime("%d/%m/%Y"),
            "executive_summary": None,
            "market_position": {"overall": 0, "brand": 0, "digital": 0, "sentiment": 0, "competitive": 0},
            "competitors": [],
            "swot": {"strengths": [], "weaknesses": [], "opportunities": [], "threats": []},
            "reviews": {"rating": 0, "count": 0, "positive_pct": 0, "neutral_pct": 0, "negative_pct": 0},
            "roadmap": {"quick_wins": [], "priorities": [], "strategic": []},
            "geographic": {"established": [], "growth": []},
            "confidence": 0,
            "report_id": "",
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
            .eq("action_type", "proactive_alert") \
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
