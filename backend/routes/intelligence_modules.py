"""Intelligence module routes — ALL SQL-backed functions.
Exposes: workforce, scenarios, scores, concentration, contradictions,
pressure, freshness, silence, escalations, profile completeness,
data readiness, watchtower positions, full summary.

Instrumented with Intelligence Spine event logging.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from supabase_client import init_supabase
from intelligence_spine import emit_spine_event

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user


async def _rpc(fn_name, workspace_id):
    """Call a Supabase RPC function. No synthetic Python fallback allowed."""
    try:
        sb = init_supabase()
        result = sb.rpc(fn_name, {'p_workspace_id': workspace_id}).execute()
        data = result.data if result.data else {"status": "no_data", "has_data": False}

        # Spine instrumentation
        emit_spine_event(
            tenant_id=workspace_id,
            event_type='MODEL_EXECUTED',
            model_name=fn_name,
            json_payload={'status': data.get('status', 'ok') if isinstance(data, dict) else 'ok'},
            confidence_score=data.get('confidence', 1.0) if isinstance(data, dict) else 1.0,
        )
        return data
    except Exception as e:
        logger.warning(f"RPC {fn_name} failed: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Canonical intelligence RPC unavailable: {fn_name}. Deploy the required SQL functions and retry.",
        )


# ═══ EXISTING ENDPOINTS (from 022) ═══

@router.get("/intelligence/workforce")
async def get_workforce_health(current_user: dict = Depends(get_current_user)):
    return await _rpc('compute_workforce_health', current_user['id'])


@router.get("/intelligence/scenarios")
async def get_revenue_scenarios(current_user: dict = Depends(get_current_user)):
    return await _rpc('compute_revenue_scenarios', current_user['id'])


@router.get("/intelligence/scores")
async def get_insight_scores(current_user: dict = Depends(get_current_user)):
    return await _rpc('compute_insight_scores', current_user['id'])


@router.get("/intelligence/concentration")
async def get_concentration_risk(current_user: dict = Depends(get_current_user)):
    return await _rpc('compute_concentration_risk', current_user['id'])


# ═══ NEW ENDPOINTS (from 023) ═══

@router.get("/intelligence/contradictions")
async def get_contradictions(current_user: dict = Depends(get_current_user)):
    """Detect priority mismatches, action-inaction gaps, repeated ignores."""
    return await _rpc('detect_contradictions', current_user['id'])


@router.get("/intelligence/pressure")
async def get_pressure_levels(current_user: dict = Depends(get_current_user)):
    """Compute pressure levels across all domains."""
    return await _rpc('compute_pressure_levels', current_user['id'])


@router.get("/intelligence/freshness")
async def get_evidence_freshness(current_user: dict = Depends(get_current_user)):
    """Track signal age and decay scoring per domain."""
    return await _rpc('compute_evidence_freshness', current_user['id'])


@router.get("/intelligence/silence")
async def get_silence_detection(current_user: dict = Depends(get_current_user)):
    """Detect user absence and unactioned critical signals."""
    return await _rpc('detect_silence', current_user['id'])


@router.get("/intelligence/escalations")
async def get_escalation_summary(current_user: dict = Depends(get_current_user)):
    """Get active escalation history and patterns."""
    return await _rpc('get_escalation_summary', current_user['id'])


@router.get("/intelligence/completeness")
async def get_profile_completeness(current_user: dict = Depends(get_current_user)):
    """Compute business profile completeness score."""
    return await _rpc('compute_profile_completeness', current_user['id'])


@router.get("/intelligence/readiness")
async def get_data_readiness(current_user: dict = Depends(get_current_user)):
    """Compute workspace data readiness score with checklist."""
    return await _rpc('compute_data_readiness', current_user['id'])


@router.get("/intelligence/watchtower/positions")
async def get_watchtower_positions(current_user: dict = Depends(get_current_user)):
    """Raw watchtower positions RPC (non-canonical helper endpoint)."""
    return await _rpc('compute_watchtower_positions', current_user['id'])


@router.get("/intelligence/summary")
async def get_full_summary(current_user: dict = Depends(get_current_user)):
    """Build complete intelligence summary across all modules."""
    return await _rpc('build_intelligence_summary', current_user['id'])


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
