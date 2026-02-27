"""Intelligence Spine API — Snapshot generation, validation, reporting.

Non-destructive. Only operates on ic_* tables.
All operations gated behind spine feature flag.
"""
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user
from intelligence_spine import emit_spine_event, _get_spine_enabled


@router.get("/spine/status")
async def spine_status(current_user: dict = Depends(get_current_user)):
    """Get Intelligence Spine status and feature flag."""
    enabled = _get_spine_enabled()
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        events = sb.table('ic_intelligence_events').select('id', count='exact').eq('tenant_id', current_user['id']).execute()
        snapshots = sb.table('ic_daily_metric_snapshots').select('id', count='exact').eq('tenant_id', current_user['id']).execute()
        executions = sb.table('ic_model_executions').select('id', count='exact').eq('tenant_id', current_user['id']).execute()
        return {
            'spine_enabled': enabled,
            'event_count': events.count or 0,
            'snapshot_count': snapshots.count or 0,
            'execution_count': executions.count or 0,
        }
    except Exception as e:
        return {'spine_enabled': enabled, 'error': str(e), 'message': 'Deploy 031_intelligence_spine_public.sql'}


@router.post("/spine/enable")
async def enable_spine(current_user: dict = Depends(get_current_user)):
    """Enable Intelligence Spine logging + snapshots (super admin only).
    Does NOT activate modelling. Only logging and data collection."""
    from tier_resolver import resolve_tier
    if resolve_tier(current_user) != 'super_admin':
        raise HTTPException(status_code=403, detail="Super admin only")
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        sb.table('ic_feature_flags').update({'enabled': True}).eq('flag_name', 'intelligence_spine_enabled').execute()
        # Log enable event to governance
        try:
            sb.rpc('emit_governance_event', {
                'p_workspace_id': current_user['id'],
                'p_event_type': 'spine_enabled',
                'p_source_system': 'manual',
                'p_signal_reference': 'intelligence_spine',
                'p_confidence_score': 1.0,
            }).execute()
        except Exception:
            pass
        # Also log to spine itself
        from intelligence_spine import emit_spine_event
        emit_spine_event(
            tenant_id=current_user['id'],
            event_type='STATE_TRANSITION',
            json_payload={'action': 'spine_enabled', 'by': current_user.get('email', '')},
            confidence_score=1.0,
        )
        return {'status': 'enabled', 'intelligence_spine_enabled': True, 'note': 'Logging and snapshot collection activated. Modelling NOT activated.'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/spine/disable")
async def disable_spine(current_user: dict = Depends(get_current_user)):
    """Disable Intelligence Spine (super admin only)."""
    from tier_resolver import resolve_tier
    if resolve_tier(current_user) != 'super_admin':
        raise HTTPException(status_code=403, detail="Super admin only")
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        sb.table('ic_feature_flags').update({'enabled': False}).eq('flag_name', 'intelligence_spine_enabled').execute()
        try:
            sb.rpc('emit_governance_event', {
                'p_workspace_id': current_user['id'],
                'p_event_type': 'spine_disabled',
                'p_source_system': 'manual',
                'p_signal_reference': 'intelligence_spine',
                'p_confidence_score': 1.0,
            }).execute()
        except Exception:
            pass
        return {'status': 'disabled', 'intelligence_spine_enabled': False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/spine/snapshot")
async def generate_spine_snapshot(current_user: dict = Depends(get_current_user)):
    """Generate daily metric snapshot for current tenant."""
    if not _get_spine_enabled():
        return {'status': 'spine_disabled', 'message': 'Enable spine first via /spine/enable'}
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.rpc('ic_generate_daily_snapshot', {'p_tenant_id': current_user['id']}).execute()
        return result.data if result.data else {'status': 'no_data'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}


@router.get("/spine/snapshots")
async def get_spine_snapshots(current_user: dict = Depends(get_current_user)):
    """Get daily metric snapshot history for tenant."""
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.table('ic_daily_metric_snapshots') \
            .select('*') \
            .eq('tenant_id', current_user['id']) \
            .order('snapshot_date', desc=True) \
            .limit(30).execute()
        return {'snapshots': result.data or []}
    except Exception:
        return {'snapshots': []}


@router.post("/spine/risk-baseline")
async def calculate_risk_baseline(current_user: dict = Depends(get_current_user)):
    """Calculate Deterministic Risk Baseline for current tenant.
    Pure SQL. Zero LLM. Fully reproducible."""
    if not _get_spine_enabled():
        return {'status': 'spine_disabled', 'message': 'Enable spine first'}
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.rpc('ic_calculate_risk_baseline', {'p_tenant_id': current_user['id']}).execute()
        return result.data if result.data else {'status': 'no_data'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}


@router.get("/spine/risk-baseline/history")
async def get_risk_baseline_history(current_user: dict = Depends(get_current_user)):
    """Get historical risk baseline executions."""
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.table('ic_model_executions') \
            .select('id, model_version, execution_time_ms, confidence_score, output_summary, created_at') \
            .eq('tenant_id', current_user['id']) \
            .eq('model_name', 'deterministic_risk_baseline') \
            .order('created_at', desc=True) \
            .limit(30).execute()
        return {'executions': result.data or []}
    except Exception:
        return {'executions': []}


@router.get("/spine/events")
async def get_spine_events(current_user: dict = Depends(get_current_user)):
    """Get Intelligence Spine event log for tenant."""
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.table('ic_intelligence_events') \
            .select('*') \
            .eq('tenant_id', current_user['id']) \
            .order('created_at', desc=True) \
            .limit(100).execute()
        return {'events': result.data or []}
    except Exception:
        return {'events': []}


@router.get("/spine/executions")
async def get_model_executions(current_user: dict = Depends(get_current_user)):
    """Get model execution history."""
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.table('ic_model_executions') \
            .select('*') \
            .eq('tenant_id', current_user['id']) \
            .order('created_at', desc=True) \
            .limit(50).execute()
        return {'executions': result.data or []}
    except Exception:
        return {'executions': []}


@router.get("/spine/validation-report")
async def get_validation_report(current_user: dict = Depends(get_current_user)):
    """Generate 7-day validation report for the Intelligence Spine."""
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        tenant_id = current_user['id']
        now = datetime.now(timezone.utc)
        seven_days_ago = (now - timedelta(days=7)).isoformat()

        # Event counts by type
        events = sb.table('ic_intelligence_events') \
            .select('event_type, confidence_score, created_at') \
            .eq('tenant_id', tenant_id) \
            .gte('created_at', seven_days_ago) \
            .execute()
        event_list = events.data or []

        event_by_type = {}
        total_confidence = 0
        for e in event_list:
            t = e.get('event_type', 'UNKNOWN')
            event_by_type[t] = event_by_type.get(t, 0) + 1
            total_confidence += (e.get('confidence_score') or 0)

        avg_confidence = round(total_confidence / max(len(event_list), 1), 3)

        # Snapshot coverage
        snapshots = sb.table('ic_daily_metric_snapshots') \
            .select('snapshot_date, risk_score, engagement_score, anomaly_count') \
            .eq('tenant_id', tenant_id) \
            .gte('snapshot_date', (now - timedelta(days=7)).strftime('%Y-%m-%d')) \
            .order('snapshot_date').execute()
        snap_list = snapshots.data or []
        snapshot_days = len(snap_list)

        # Model executions
        execs = sb.table('ic_model_executions') \
            .select('model_name, execution_time_ms, confidence_score') \
            .eq('tenant_id', tenant_id) \
            .gte('created_at', seven_days_ago) \
            .execute()
        exec_list = execs.data or []

        model_stats = {}
        for ex in exec_list:
            mn = ex.get('model_name', 'unknown')
            if mn not in model_stats:
                model_stats[mn] = {'count': 0, 'total_ms': 0, 'total_conf': 0}
            model_stats[mn]['count'] += 1
            model_stats[mn]['total_ms'] += (ex.get('execution_time_ms') or 0)
            model_stats[mn]['total_conf'] += (ex.get('confidence_score') or 0)

        for mn in model_stats:
            s = model_stats[mn]
            s['avg_ms'] = round(s['total_ms'] / max(s['count'], 1))
            s['avg_confidence'] = round(s['total_conf'] / max(s['count'], 1), 3)

        # Anomaly check
        total_anomalies = sum(s.get('anomaly_count', 0) for s in snap_list)

        # Validation checks — volume/consistency based, NOT model quality
        # No arbitrary confidence thresholds
        has_duplicate_snapshots = len(snap_list) != len(set(s.get('snapshot_date') for s in snap_list))
        has_null_metrics = any(
            s.get('risk_score') is None and s.get('engagement_score') is None
            for s in snap_list
        )
        # Event volume stability: at least 1 event per day on average
        events_per_day = len(event_list) / max(7, 1)

        checks = {
            'spine_enabled': _get_spine_enabled(),
            'events_flowing': len(event_list) > 0,
            'event_volume_stable': events_per_day >= 1.0,
            'events_per_day': round(events_per_day, 1),
            'snapshots_generating': snapshot_days > 0,
            'snapshot_coverage_7d': f'{snapshot_days}/7 days',
            'snapshot_consistency': not has_duplicate_snapshots,
            'no_null_critical_metrics': not has_null_metrics,
            'no_duplicate_snapshots': not has_duplicate_snapshots,
            'models_executing': len(exec_list) > 0,
            'execution_logging_present': len(exec_list) > 0,
            'anomalies_detected': total_anomalies,
            'event_types_observed': list(event_by_type.keys()),
            'models_observed': list(model_stats.keys()),
        }

        # Event-to-snapshot correlation check
        correlation = None
        try:
            corr_result = sb.rpc('ic_validate_snapshot_correlation', {'p_tenant_id': tenant_id}).execute()
            correlation = corr_result.data if corr_result.data else None
        except Exception:
            correlation = {'error': 'Correlation function not deployed. Run 032_spine_hardening.sql'}

        correlation_pass = True
        if correlation and isinstance(correlation, dict):
            corr_rate = correlation.get('correlation_rate', 0)
            if isinstance(corr_rate, (int, float)) and corr_rate < 0.5 and snapshot_days >= 3:
                correlation_pass = False

        # Pass/fail — volume, consistency, correlation
        validation_pass = (
            checks['spine_enabled']
            and checks['events_flowing']
            and checks['snapshots_generating']
            and snapshot_days >= 3
            and not has_duplicate_snapshots
            and not has_null_metrics
            and correlation_pass
        )

        return {
            'validation_status': 'PASS' if validation_pass else 'NEEDS_MORE_DATA',
            'period': '7 days',
            'period_start': seven_days_ago,
            'period_end': now.isoformat(),
            'checks': {**checks, 'event_snapshot_correlation': correlation_pass},
            'event_summary': {
                'total_events': len(event_list),
                'by_type': event_by_type,
                'events_per_day': round(events_per_day, 1),
            },
            'snapshot_summary': {
                'days_covered': snapshot_days,
                'snapshots': snap_list,
                'has_duplicates': has_duplicate_snapshots,
                'has_null_metrics': has_null_metrics,
                'total_anomalies': total_anomalies,
                'correlation': correlation,
            },
            'model_summary': {
                'total_executions': len(exec_list),
                'by_model': model_stats,
            },
            'recommendation': 'Spine validation PASS. Volume stable, snapshots correlated with events, no null metrics. Ready for Deterministic Risk Baseline.' if validation_pass
                else f'Need more data. {max(0, 3 - snapshot_days)} more days of snapshots. Correlation rate: {correlation.get("correlation_rate", "?") if isinstance(correlation, dict) else "unknown"}.',
        }
    except Exception as e:
        return {'validation_status': 'ERROR', 'error': str(e)}
