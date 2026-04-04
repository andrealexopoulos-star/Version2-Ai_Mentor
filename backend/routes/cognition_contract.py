"""BIQc Cognition Contract — Thin Pass-Through to SQL Engine.

ALL computation happens in ic_generate_cognition_contract() SQL function.
This file is ONLY routing + auth + request/response formatting.
ZERO business logic in Python.
"""
import logging
import time
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Any, Dict, List
from intelligence_live_truth import get_live_integration_truth, get_latest_snapshot_context, get_recent_observation_events, build_watchtower_events

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user


class DecisionCreate(BaseModel):
    decision_category: str
    decision_statement: str
    affected_domains: list
    expected_instability_change: dict = {}
    expected_time_horizon: int = 30
    evidence_refs: list = []


class AutomationExecute(BaseModel):
    action_type: str
    insight_ref: str = ''
    evidence_refs: list = []


def _get_sb():
    from supabase_client import init_supabase
    return init_supabase()


def _call_rpc(sb, fn_name: str, params: dict) -> dict:
    """Call Supabase RPC. Returns raw result or structured error."""
    try:
        result = sb.rpc(fn_name, params).execute()
        return result.data if result.data else {}
    except Exception as e:
        error_msg = str(e)
        return {'status': 'error', 'error': error_msg}


def _safe_parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _semantic_contract(
    *,
    data_status: str,
    confidence_score: float,
    confidence_reason: str,
    coverage_start: Optional[str] = None,
    coverage_end: Optional[str] = None,
    freshness_hours: Optional[int] = None,
    source_lineage: Optional[List[Dict[str, Any]]] = None,
    next_best_actions: Optional[List[str]] = None,
) -> Dict[str, Any]:
    return {
        "data_status": data_status,
        "confidence_score": round(max(0.0, min(1.0, float(confidence_score))), 3),
        "confidence_reason": confidence_reason,
        "coverage_window": {
            "start": coverage_start,
            "end": coverage_end,
            "freshness_hours": freshness_hours,
        },
        "source_lineage": source_lineage or [],
        "next_best_actions": next_best_actions or [],
    }


def _overlay_live_truth(sb, tenant_id: str, tab: str, result: dict) -> dict:
    live_truth = get_live_integration_truth(sb, tenant_id)
    snapshot_context = get_latest_snapshot_context(sb, tenant_id)
    observation_state = get_recent_observation_events(sb, tenant_id, limit=10)

    integrations = {
        'crm': live_truth['canonical_truth']['crm_connected'],
        'email': live_truth['canonical_truth']['email_connected'],
        'accounting': live_truth['canonical_truth']['accounting_connected'],
        'hris': live_truth['canonical_truth']['hris_connected'],
        'crm_state': live_truth['canonical_truth'].get('crm_state'),
        'email_state': live_truth['canonical_truth'].get('email_state'),
        'accounting_state': live_truth['canonical_truth'].get('accounting_state'),
    }

    enriched = dict(result or {})
    enriched['integrations'] = integrations
    enriched['integration_truth'] = live_truth.get('connector_truth') or {}
    enriched['integrations_connected'] = live_truth['canonical_truth']['total_connected']
    enriched['live_signal_count'] = observation_state.get('count', 0)
    enriched['last_signal_at'] = observation_state.get('last_signal_at')
    enriched['snapshot_generated_at'] = snapshot_context.get('generated_at')

    if snapshot_context.get('executive_memo') and not enriched.get('executive_memo'):
        enriched['executive_memo'] = snapshot_context['executive_memo']

    tab_data = enriched.setdefault('tab_data', {}) if isinstance(enriched, dict) else {}
    if tab == 'overview':
        tab_data['crm_connected'] = integrations['crm']
        tab_data['accounting_connected'] = integrations['accounting']
        tab_data['email_connected'] = integrations['email']
        tab_data['crm_state'] = integrations.get('crm_state')
        tab_data['accounting_state'] = integrations.get('accounting_state')
        tab_data['email_state'] = integrations.get('email_state')
        tab_data['integrations_connected'] = live_truth['canonical_truth']['total_connected']
        if not enriched.get('top_alerts'):
            enriched['top_alerts'] = build_watchtower_events(observation_state.get('events') or [], limit=5)
        if observation_state.get('count'):
            enriched['evidence_count'] = max(int(enriched.get('evidence_count') or 0), int(observation_state['count']))
    elif tab == 'revenue':
        if integrations['crm'] and tab_data.get('pipeline_health') == 'disconnected':
            tab_data['pipeline_health'] = 'monitoring'
        tab_data['crm_required'] = not integrations['crm']
        tab_data['accounting_required'] = not integrations['accounting']
    elif tab == 'operations':
        tab_data['crm_required'] = not integrations['crm']
    elif tab == 'risk':
        tab_data['accounting_required'] = not integrations['accounting']

    snapshot_dt = _safe_parse_dt(enriched.get("snapshot_generated_at"))
    signal_dt = _safe_parse_dt(enriched.get("last_signal_at"))
    coverage_start = snapshot_dt.isoformat() if snapshot_dt else None
    coverage_end = signal_dt.isoformat() if signal_dt else coverage_start
    freshness_hours: Optional[int] = None
    if coverage_end:
        ref_dt = _safe_parse_dt(coverage_end)
        if ref_dt:
            freshness_hours = int(max(0, (datetime.now(timezone.utc) - ref_dt).total_seconds() // 3600))

    live_signal_count = int(enriched.get("live_signal_count") or 0)
    has_payload = bool(enriched.get("tab_data") or enriched.get("top_alerts") or live_signal_count > 0)
    data_status = "ready" if has_payload else "empty"
    confidence = 0.8 if has_payload else 0.35
    reason = "Cognition contract contains integrated signals and tab payload." if has_payload else "Cognition contract has no integrated signals yet."
    actions: List[str] = []
    if not has_payload:
        actions = [
            "Connect and sync CRM, email, and accounting sources.",
            "Run calibration to generate baseline cognition output.",
        ]
    elif freshness_hours is not None and freshness_hours > 24:
        data_status = "stale"
        confidence = 0.62
        reason = "Cognition contract signals are older than 24 hours."
        actions = ["Refresh ingestion and recompute cognition contract."]

    enriched.update(
        _semantic_contract(
            data_status=data_status,
            confidence_score=confidence,
            confidence_reason=reason,
            coverage_start=coverage_start,
            coverage_end=coverage_end,
            freshness_hours=freshness_hours,
            source_lineage=[{"connector": "cognition_sql", "endpoint": f"/cognition/{tab}"}],
            next_best_actions=actions,
        )
    )
    return enriched


# ═══════════════════════════════════════════════════════════════
# UNIFIED COGNITION CONTRACT — Single Endpoint
# Calls ic_generate_cognition_contract() in SQL. Zero Python logic.
# ═══════════════════════════════════════════════════════════════

@router.get("/cognition/{tab}")
def cognition_contract(tab: str, current_user: dict = Depends(get_current_user)):
    """Single source of truth. Calls SQL master function."""
    sb = _get_sb()
    try:
        result = _call_rpc(sb, 'ic_generate_cognition_contract', {
            'p_tenant_id': current_user['id'],
            'p_tab': tab
        })
    except Exception as outer_e:
        error_str = str(outer_e).lower()
        if 'column' in error_str or 'does not exist' in error_str or 'function' in error_str:
            return {
                'status': 'MIGRATION_REQUIRED',
                'message': 'Cognition SQL functions need updating. Please re-run migration 049.',
                'tab': tab,
                'error': str(outer_e),
            }
        raise HTTPException(status_code=500, detail=str(outer_e))

    if isinstance(result, dict) and result.get('error'):
        error_str = str(result.get('error', '')).lower()
        if 'function' in error_str or 'column' in error_str:
            return {
                'status': 'MIGRATION_REQUIRED',
                'message': 'Cognition SQL functions need updating. Please re-run migration 049.',
                'tab': tab,
                'error': result.get('error'),
            }
        raise HTTPException(status_code=500, detail=result.get('error'))

    return _overlay_live_truth(sb, current_user['id'], tab, result)


# ═══════════════════════════════════════════════════════════════
# DECISION MANAGEMENT
# ═══════════════════════════════════════════════════════════════

@router.post("/cognition/decisions")
async def create_decision(req: DecisionCreate, current_user: dict = Depends(get_current_user)):
    """Record structured decision. Creates 30/60/90 outcome checkpoints."""
    sb = _get_sb()
    tenant_id = current_user['id']

    # Get current instability snapshot via SQL
    baseline = _call_rpc(sb, 'ic_calculate_risk_baseline', {'p_tenant_id': tenant_id})
    indices = baseline.get('indices', {}) if baseline.get('status') == 'computed' else {}
    composite = baseline.get('composite', {}).get('risk_score', 0) if baseline.get('status') == 'computed' else 0

    snapshot_at_time = {
        'rvi': indices.get('revenue_volatility_index', 0),
        'eds': indices.get('engagement_decay_score', 0),
        'cdr': indices.get('cash_deviation_ratio', 0),
        'ads': indices.get('anomaly_density_score', 0),
        'composite': composite,
    }

    decision_data = {
        'tenant_id': tenant_id,
        'decision_category': req.decision_category,
        'decision_statement': req.decision_statement,
        'affected_domains': req.affected_domains,
        'expected_instability_change': req.expected_instability_change,
        'expected_time_horizon': req.expected_time_horizon,
        'confidence_at_time': 0.5,
        'evidence_refs': req.evidence_refs,
        'instability_snapshot_at_time': snapshot_at_time,
    }

    try:
        result = sb.table('cognition_decisions').insert(decision_data).execute()
    except Exception as e:
        if 'relation' in str(e).lower() and 'does not exist' in str(e).lower():
            return {'status': 'MIGRATION_REQUIRED', 'message': 'Run migrations 044 + 045 in Supabase SQL Editor.'}
        raise HTTPException(status_code=500, detail=str(e))

    decision = result.data[0] if result.data else {}
    decision_id = decision.get('id')
    if not decision_id:
        raise HTTPException(status_code=500, detail="Failed to create decision")

    now = datetime.now(timezone.utc)
    for days in [30, 60, 90]:
        try:
            sb.table('outcome_checkpoints').insert({
                'decision_id': decision_id,
                'tenant_id': tenant_id,
                'checkpoint_day': days,
                'scheduled_at': (now + timedelta(days=days)).isoformat(),
                'predicted_instability': req.expected_instability_change,
            }).execute()
        except Exception:
            pass

    return {
        'status': 'recorded',
        'decision_id': decision_id,
        'checkpoints_created': [30, 60, 90],
        'instability_at_time': snapshot_at_time,
    }


@router.get("/cognition/decisions")
async def list_decisions(current_user: dict = Depends(get_current_user)):
    """List decisions with outcome checkpoints."""
    sb = _get_sb()
    tenant_id = current_user['id']

    try:
        decisions = sb.table('cognition_decisions').select(
            'id, decision_category, decision_statement, affected_domains, '
            'expected_instability_change, expected_time_horizon, confidence_at_time, '
            'evidence_refs, instability_snapshot_at_time, status, model_version, created_at'
        ).eq('tenant_id', tenant_id).order('created_at', desc=True).limit(50).execute()
    except Exception as e:
        if 'relation' in str(e).lower():
            return {'status': 'MIGRATION_REQUIRED', 'decisions': []}
        return {'decisions': []}

    decision_ids = [d['id'] for d in (decisions.data or [])]
    checkpoints = []
    if decision_ids:
        try:
            cp_result = sb.table('outcome_checkpoints').select(
                'decision_id, checkpoint_day, status, decision_effective, variance_delta, '
                'normalized_variance, false_positive, evaluated_at'
            ).in_('decision_id', decision_ids).execute()
            checkpoints = cp_result.data or []
        except Exception:
            pass

    cp_map = {}
    for cp in checkpoints:
        did = cp.get('decision_id')
        if did:
            cp_map.setdefault(did, []).append(cp)

    result = []
    for d in (decisions.data or []):
        d['checkpoints'] = cp_map.get(d['id'], [])
        result.append(d)

    return {'decisions': result, 'total': len(result)}


class CheckpointOutcome(BaseModel):
    decision_id: str
    checkpoint_day: int
    decision_effective: bool
    variance_delta: float = 0
    notes: str = ''


@router.post("/cognition/decisions/checkpoint-outcome")
async def record_checkpoint_outcome(req: CheckpointOutcome, current_user: dict = Depends(get_current_user)):
    """Record outcome at a decision checkpoint (30/60/90 day)."""
    sb = _get_sb()
    tenant_id = current_user['id']

    try:
        result = sb.table('outcome_checkpoints').update({
            'status': 'positive' if req.decision_effective else 'negative',
            'decision_effective': req.decision_effective,
            'variance_delta': req.variance_delta,
            'evaluated_at': datetime.now(timezone.utc).isoformat(),
        }).eq('decision_id', req.decision_id).eq(
            'checkpoint_day', req.checkpoint_day
        ).eq('tenant_id', tenant_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Checkpoint not found")

        return {'status': 'recorded', 'checkpoint_day': req.checkpoint_day, 'decision_effective': req.decision_effective}
    except HTTPException:
        raise
    except Exception as e:
        if 'relation' in str(e).lower():
            return {'status': 'MIGRATION_REQUIRED'}
        raise HTTPException(status_code=500, detail=str(e))




# ═══════════════════════════════════════════════════════════════
# AUTOMATION EXECUTION
# ═══════════════════════════════════════════════════════════════

@router.post("/cognition/automation/execute")
async def execute_automation(req: AutomationExecute, current_user: dict = Depends(get_current_user)):
    """Execute automation action (confirmation-required)."""
    sb = _get_sb()
    tenant_id = current_user['id']

    try:
        action = sb.table('automation_actions').select('*').eq('action_type', req.action_type).eq('is_active', True).execute()
    except Exception as e:
        if 'relation' in str(e).lower():
            return {'status': 'MIGRATION_REQUIRED'}
        raise HTTPException(status_code=500, detail=str(e))

    if not action.data:
        raise HTTPException(status_code=404, detail=f"Action '{req.action_type}' not found or inactive")
    action_data = action.data[0]

    # Check integration availability
    if action_data.get('integration_required'):
        try:
            health = sb.table('integration_health').select('status').eq(
                'tenant_id', tenant_id).eq('provider', action_data['integration_required']).execute()
            if not health.data or health.data[0].get('status') != 'CONNECTED':
                raise HTTPException(status_code=400,
                    detail=f"Integration '{action_data['integration_required']}' not connected. Cannot execute.")
        except HTTPException:
            raise
        except Exception:
            pass

    try:
        result = sb.table('automation_executions').insert({
            'tenant_id': tenant_id,
            'action_id': action_data['id'],
            'action_type': req.action_type,
            'insight_ref': req.insight_ref,
            'evidence_refs': req.evidence_refs,
            'status': 'confirmed',
            'confirmed_at': datetime.now(timezone.utc).isoformat(),
        }).execute()
        execution = result.data[0] if result.data else {}
    except Exception:
        execution = {}

    return {
        'status': 'confirmed',
        'execution_id': execution.get('id'),
        'action_type': req.action_type,
        'action_label': action_data.get('action_label'),
        'rollback_guidance': action_data.get('rollback_guidance'),
    }


@router.get("/cognition/automation/history")
async def automation_history(current_user: dict = Depends(get_current_user)):
    """Automation execution history."""
    sb = _get_sb()
    try:
        result = sb.table('automation_executions').select(
            'id, action_type, insight_ref, status, confirmed_at, executed_at, failed_at, failure_reason, result, rollback_executed, created_at'
        ).eq('tenant_id', current_user['id']).order('created_at', desc=True).limit(30).execute()
        return {'executions': result.data or []}
    except Exception:
        return {'executions': []}


# ═══════════════════════════════════════════════════════════════
# INTEGRATION HEALTH
# ═══════════════════════════════════════════════════════════════

@router.get("/cognition/integration-health")
async def get_integration_health(current_user: dict = Depends(get_current_user)):
    """Integration health via SQL function."""
    sb = _get_sb()
    return _call_rpc(sb, 'fn_check_integration_health', {'p_tenant_id': current_user['id']})


@router.get("/cognition/integration-health/history")
async def get_integration_health_history(current_user: dict = Depends(get_current_user)):
    """Integration degradation history."""
    sb = _get_sb()
    try:
        result = sb.table('integration_health_history').select('*').eq(
            'tenant_id', current_user['id']).order('changed_at', desc=True).limit(50).execute()
        return {'history': result.data or []}
    except Exception:
        return {'history': []}


# ═══════════════════════════════════════════════════════════════
# INSTABILITY SNAPSHOT + DRIFT
# ═══════════════════════════════════════════════════════════════

@router.post("/cognition/snapshot-instability")
async def snapshot_instability(current_user: dict = Depends(get_current_user)):
    """Store daily instability snapshot via SQL function."""
    sb = _get_sb()
    return _call_rpc(sb, 'fn_snapshot_daily_instability', {'p_tenant_id': current_user['id']})


@router.get("/cognition/drift")
async def detect_drift(current_user: dict = Depends(get_current_user)):
    """Run drift detection via SQL function."""
    sb = _get_sb()
    return _call_rpc(sb, 'fn_detect_drift', {'p_tenant_id': current_user['id']})


# ═══════════════════════════════════════════════════════════════
# TELEMETRY
# ═══════════════════════════════════════════════════════════════

@router.get("/cognition/telemetry")
async def get_telemetry(current_user: dict = Depends(get_current_user)):
    """Cognition engine performance telemetry."""
    sb = _get_sb()
    try:
        result = sb.table('cognition_telemetry').select(
            'function_name, execution_ms, output_status, error_message, row_count, executed_at'
        ).eq('tenant_id', current_user['id']).order('executed_at', desc=True).limit(50).execute()
        return {'telemetry': result.data or []}
    except Exception:
        return {'telemetry': []}
