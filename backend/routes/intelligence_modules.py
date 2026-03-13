"""Intelligence module routes — ALL SQL-backed functions.
Exposes: workforce, scenarios, scores, concentration, contradictions,
pressure, freshness, silence, escalations, profile completeness,
data readiness, watchtower positions, full summary.

Instrumented with Intelligence Spine event logging.
"""
import logging
from fastapi import APIRouter, Depends
from supabase_client import init_supabase
from intelligence_spine import emit_spine_event
from intelligence_live_truth import get_recent_observation_events, build_watchtower_events

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user


async def _python_fallback(fn_name: str, workspace_id: str):
    try:
        from routes.unified_intelligence import (
            _fetch_all_integration_data,
            _compute_revenue_signals,
            _compute_people_signals,
            _compute_risk_signals,
            _compute_operations_signals,
        )
    except Exception as e:
        return {"status": "error", "has_data": False, "message": f"Fallback import failed: {e}"}

    sb = init_supabase()
    data = await _fetch_all_integration_data(sb, workspace_id)

    if fn_name == 'compute_revenue_scenarios':
        deals = data.get('crm', {}).get('deals', [])
        open_deals = [d for d in deals if (d.get('status') or '').upper() not in ('WON', 'LOST')]
        if not open_deals:
            return {"status": "no_data", "has_data": False, "message": "Connect CRM deal data to enable revenue scenarios."}
        best_case = sum(float(d.get('amount') or 0) for d in open_deals)
        base_case = sum(float(d.get('amount') or 0) * (0.7 if (d.get('probability') or 0) >= 70 else 0.45 if (d.get('probability') or 0) >= 40 else 0.15) for d in open_deals)
        worst_case = sum(float(d.get('amount') or 0) * (0.4 if (d.get('probability') or 0) >= 70 else 0.1) for d in open_deals)
        return {
            "status": "computed",
            "has_data": True,
            "best_case": round(best_case, 2),
            "base_case": round(base_case, 2),
            "worst_case": round(worst_case, 2),
            "open_deal_count": len(open_deals),
        }

    if fn_name == 'compute_workforce_health':
        people = _compute_people_signals(data)
        has_data = bool(data.get('email', {}).get('connected') or people.get('team_risks') or people.get('capacity') is not None)
        return {"status": "computed", "has_data": has_data, "workforce": people}

    if fn_name == 'compute_insight_scores':
        revenue = _compute_revenue_signals(data)
        ops = _compute_operations_signals(data)
        risk = _compute_risk_signals(data)
        people = _compute_people_signals(data)
        scores = {
            "revenue": min(100, 40 + len(revenue.get('deals', [])) * 2 + len(revenue.get('at_risk', [])) * 3),
            "operations": min(100, 35 + len(ops.get('bottlenecks', [])) * 8 + len(ops.get('capacity_alerts', [])) * 6),
            "risk": 85 if risk.get('overall_risk') == 'high' else 60 if risk.get('overall_risk') == 'medium' else 35,
            "people": min(100, 30 + len(people.get('team_risks', [])) * 10 + (10 if people.get('fatigue') == 'high' else 0)),
        }
        return {"status": "computed", "has_data": any(v > 0 for v in scores.values()), "scores": scores}

    if fn_name == 'compute_watchtower_positions':
        observations = get_recent_observation_events(sb, workspace_id, limit=25)
        events = build_watchtower_events(observations.get('events') or [], limit=10)
        positions = {}
        for event in events:
            domain = (event.get('domain') or 'general').lower()
            sev = event.get('severity') or 'medium'
            level = 'critical' if sev == 'critical' else 'compression' if sev == 'high' else 'drift' if sev in {'medium', 'moderate'} else 'stable'
            positions[domain] = {
                'status': level.upper(),
                'severity': sev,
                'title': event.get('title'),
                'detail': event.get('detail'),
                'source': event.get('source'),
            }
        return {"status": "computed", "has_data": bool(events), "events": events, "positions": positions}

    return {"status": "error", "has_data": False, "message": f"Deploy SQL migration 023 to enable {fn_name}."}


async def _rpc(fn_name, workspace_id):
    """Call a Supabase RPC function, return result or error fallback."""
    try:
        sb = init_supabase()
        result = sb.rpc(fn_name, {'p_workspace_id': workspace_id}).execute()
        data = result.data if result.data else {"status": "no_data", "has_data": False}

        should_fallback = False
        if fn_name == 'compute_watchtower_positions':
            should_fallback = not data.get('has_data') and not data.get('events')
        elif fn_name == 'compute_workforce_health':
            should_fallback = not data.get('has_data')
        elif fn_name == 'compute_insight_scores':
            should_fallback = not data.get('has_data') or not data.get('scores')

        if should_fallback:
            fallback = await _python_fallback(fn_name, workspace_id)
            if fallback.get('has_data') or fallback.get('events') or fallback.get('scores'):
                data = fallback

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
        try:
            return await _python_fallback(fn_name, workspace_id)
        except Exception as fallback_error:
            logger.warning(f"Fallback {fn_name} failed: {fallback_error}")
            return {"status": "error", "has_data": False, "message": f"Deploy SQL migration 023 to enable {fn_name}."}


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


@router.get("/intelligence/watchtower")
async def get_watchtower_positions(current_user: dict = Depends(get_current_user)):
    """Compute domain-level positions (stable/drift/compression/critical)."""
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
