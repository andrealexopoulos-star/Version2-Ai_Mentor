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
        "state": "calibrating",
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
    # Crude competitive score: fewer competitor leaders identified means
    # less pressure visible. Never fabricated — zero when we have nothing.
    comp_leaders = enr.get("competitor_leaders") or enr.get("competitors") or []
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
    nothing."""
    priority = enr.get("cmo_priority_actions") if isinstance(enr.get("cmo_priority_actions"), list) else []
    industry = enr.get("industry_action_items") if isinstance(enr.get("industry_action_items"), list) else []

    def _wrap(items: List[Any], pri: str) -> List[Dict[str, str]]:
        out = []
        for it in items:
            text = it if isinstance(it, str) else (it.get("text") if isinstance(it, dict) else None)
            if not text:
                continue
            out.append({"text": text, "priority": pri})
        return out

    # 7-day quick wins: top-of-list priority actions (first 3, tagged critical).
    # 30-day priorities: remaining priority actions (tagged high).
    # 90-day strategic: all industry action items (tagged medium).
    quick_wins = _wrap(priority[:3], "critical")
    priorities = _wrap(priority[3:8], "high")
    strategic = _wrap(industry[:5], "medium")
    return {"quick_wins": quick_wins, "priorities": priorities, "strategic": strategic}


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


@router.get("/intelligence/cmo-report")
async def get_cmo_report(current_user: dict = Depends(get_current_user)):
    """
    Build the CMO intelligence report from `business_dna_enrichment.enrichment`
    as the primary data source. Falls back to a clean "calibrating" state if
    no enrichment row exists for the user.

    Previously this endpoint read from `intelligence_actions` +
    `build_intelligence_summary` RPC — both of which return empty for new
    users, producing half-populated stubs. Rewired 2026-04-22 (Sprint A #3+#4)
    to read the deep-scan enrichment bundle that calibration actually writes.
    """
    user_id = current_user["id"]
    sb = init_supabase()

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
            enrichment_created_at = row.get("created_at") or row.get("updated_at")
    except Exception as enr_err:
        logger.warning(f"[cmo-report] business_dna_enrichment lookup failed: {enr_err}")

    # 3) No enrichment -> clean calibrating state (not a half-populated stub).
    if not enrichment:
        return _cmo_empty_shell(user_id, company)

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

    generated_at = enrichment_created_at or datetime.now(timezone.utc).isoformat()
    try:
        generated_dt = _safe_parse_iso(generated_at) or datetime.now(timezone.utc)
    except Exception:
        generated_dt = datetime.now(timezone.utc)

    # Confidence: prefer enrichment.confidence (can be string or numeric).
    conf_raw = enrichment.get("confidence")
    if isinstance(conf_raw, (int, float)):
        confidence = _coerce_score(conf_raw)
    elif isinstance(conf_raw, str):
        conf_map = {"high": 85, "medium": 60, "low": 35}
        confidence = conf_map.get(conf_raw.strip().lower(), 0)
    else:
        confidence = 0

    response: Dict[str, Any] = {
        "company_name": company_from_enrichment,
        "report_date": generated_dt.strftime("%d/%m/%Y"),
        "generated_at": generated_at,
        "executive_summary": exec_summary,
        "market_position": _derive_market_position_from_enrichment(enrichment),
        "competitors": _shape_competitors_from_enrichment(enrichment),
        "position_dots": [],  # calibration does not compute x/y yet
        "swot": enrichment.get("swot") if isinstance(enrichment.get("swot"), dict) else {
            "strengths": [], "weaknesses": [], "opportunities": [], "threats": []
        },
        "reviews": _shape_reviews_from_enrichment(enrichment),
        "review_themes": {
            "positive": (enrichment.get("customer_review_highlights", {}).get("positive_themes") or [])
                if isinstance(enrichment.get("customer_review_highlights"), dict) else [],
            "negative": (enrichment.get("customer_review_highlights", {}).get("negative_themes") or [])
                if isinstance(enrichment.get("customer_review_highlights"), dict) else [],
        },
        "review_excerpts": enrichment.get("review_excerpts") or [],
        "roadmap": _shape_roadmap_from_enrichment(enrichment),
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
        # Header meta fields.
        "engine": "BIQc Intelligence Engine",
        "scan_source": enrichment.get("website_url") or "Deep calibration scan",
        "data_points": enrichment.get("data_points") or f"{sum(1 for v in enrichment.values() if v)} signals",
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

    return response


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
