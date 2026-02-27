"""Intelligence module routes — SQL-backed workforce, scenarios, scoring."""
import logging
from fastapi import APIRouter, Depends
from supabase_client import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user


@router.get("/intelligence/workforce")
async def get_workforce_health(current_user: dict = Depends(get_current_user)):
    """Compute workforce health from SQL function."""
    try:
        sb = get_supabase_client()
        result = sb.rpc('compute_workforce_health', {'p_workspace_id': current_user['id']}).execute()
        return result.data if result.data else {"status": "no_data", "has_data": False}
    except Exception as e:
        logger.warning(f"Workforce health query failed: {e}")
        return {"status": "error", "has_data": False, "message": "Workforce intelligence not yet available. Deploy SQL migration 022."}


@router.get("/intelligence/scenarios")
async def get_revenue_scenarios(current_user: dict = Depends(get_current_user)):
    """Compute revenue scenarios from SQL function."""
    try:
        sb = get_supabase_client()
        result = sb.rpc('compute_revenue_scenarios', {'p_workspace_id': current_user['id']}).execute()
        return result.data if result.data else {"status": "no_data", "has_data": False}
    except Exception as e:
        logger.warning(f"Revenue scenarios query failed: {e}")
        return {"status": "error", "has_data": False, "message": "Scenario modeling not yet available. Deploy SQL migration 022."}


@router.get("/intelligence/scores")
async def get_insight_scores(current_user: dict = Depends(get_current_user)):
    """Compute weighted insight scores from SQL function."""
    try:
        sb = get_supabase_client()
        result = sb.rpc('compute_insight_scores', {'p_workspace_id': current_user['id']}).execute()
        return result.data if result.data else {"status": "no_data", "scores": {}}
    except Exception as e:
        logger.warning(f"Insight scores query failed: {e}")
        return {"status": "error", "scores": {}, "message": "Scoring not yet available. Deploy SQL migration 022."}


@router.get("/intelligence/concentration")
async def get_concentration_risk(current_user: dict = Depends(get_current_user)):
    """Compute revenue concentration risk from SQL function."""
    try:
        sb = get_supabase_client()
        result = sb.rpc('compute_concentration_risk', {'p_workspace_id': current_user['id']}).execute()
        return result.data if result.data else {"status": "no_data", "has_data": False}
    except Exception as e:
        logger.warning(f"Concentration risk query failed: {e}")
        return {"status": "error", "has_data": False, "message": "Concentration analysis not yet available. Deploy SQL migration 022."}


@router.get("/intelligence/integration-status")
async def get_integration_status(current_user: dict = Depends(get_current_user)):
    """Get workspace integration status from workspace_integrations table."""
    try:
        sb = get_supabase_client()
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
    """Get governance events summary for the workspace."""
    try:
        sb = get_supabase_client()
        result = sb.table('governance_events') \
            .select('id, event_type, source_system, signal_reference, signal_timestamp, confidence_score') \
            .eq('workspace_id', current_user['id']) \
            .order('signal_timestamp', desc=True) \
            .limit(50) \
            .execute()
        
        events = result.data or []
        
        # Summary stats
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
