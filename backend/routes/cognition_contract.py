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
from typing import Optional

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
    from supabase_client import get_supabase_client
    return get_supabase_client()


def _call_rpc(sb, fn_name: str, params: dict) -> dict:
    """Call Supabase RPC. Returns raw result or structured error."""
    try:
        result = sb.rpc(fn_name, params).execute()
        return result.data if result.data else {}
    except Exception as e:
        logger.warning(f"RPC {fn_name} failed: {e}")
        return {'status': 'error', 'error': str(e)}


# ═══════════════════════════════════════════════════════════════
# UNIFIED COGNITION CONTRACT — Single Endpoint
# Calls ic_generate_cognition_contract() in SQL. Zero Python logic.
# ═══════════════════════════════════════════════════════════════

@router.get("/cognition/{tab}")
async def cognition_contract(tab: str, current_user: dict = Depends(get_current_user)):
    """Single source of truth. Calls SQL master function."""
    sb = _get_sb()
    result = _call_rpc(sb, 'ic_generate_cognition_contract', {
        'p_tenant_id': current_user['id'],
        'p_tab': tab
    })

    if isinstance(result, dict) and result.get('error'):
        # SQL function doesn't exist yet — return structured error
        if 'function' in str(result.get('error', '')).lower():
            return {
                'status': 'MIGRATION_REQUIRED',
                'message': 'Cognition core SQL functions not yet deployed. Run migrations 044 + 045.',
                'tab': tab,
                'error': result.get('error'),
            }
        raise HTTPException(status_code=500, detail=result.get('error'))

    return result


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
