"""BIQc Cognition Contract — Single Source of Truth for All Intelligence.

/api/cognition/{tab} — calls evidence engine, instability engine,
propagation engine, decision engine, attaches automation actions,
attaches confidence, attaches evidence_refs.

Frontend must not calculate anything. This is the brain.
"""
import logging
import time
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user


# ═══════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════

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


# ═══════════════════════════════════════════════════════════════
# HELPERS — Call SQL functions via Supabase RPC
# ═══════════════════════════════════════════════════════════════

def _get_sb():
    from supabase_client import get_supabase_client
    return get_supabase_client()


def _call_rpc(sb, fn_name: str, params: dict) -> dict:
    """Call a Supabase RPC function safely."""
    try:
        result = sb.rpc(fn_name, params).execute()
        return result.data if result.data else {}
    except Exception as e:
        logger.warning(f"RPC {fn_name} failed: {e}")
        return {'status': 'error', 'error': str(e)}


def _get_automation_actions(sb, insight_categories: list) -> list:
    """Fetch automation actions relevant to the given insight categories."""
    try:
        result = sb.table('automation_actions').select('*').eq('is_active', True).execute()
        actions = result.data or []
        return [a for a in actions if a.get('insight_category') in insight_categories]
    except Exception:
        return []


def _compute_instability_deltas(sb, tenant_id: str, current_indices: dict) -> dict:
    """Compute deltas vs prior period from instability_snapshots."""
    try:
        result = sb.table('instability_snapshots').select('rvi, eds, cdr, ads, composite').eq(
            'tenant_id', tenant_id
        ).order('snapshot_date', desc=True).limit(2).execute()

        snapshots = result.data or []
        if len(snapshots) < 2:
            return {'rvi': 0, 'eds': 0, 'cdr': 0, 'ads': 0, 'composite': 0}

        prev = snapshots[1]
        return {
            'rvi': round((current_indices.get('revenue_volatility_index', 0) or 0) - (prev.get('rvi', 0) or 0), 4),
            'eds': round((current_indices.get('engagement_decay_score', 0) or 0) - (prev.get('eds', 0) or 0), 4),
            'cdr': round((current_indices.get('cash_deviation_ratio', 0) or 0) - (prev.get('cdr', 0) or 0), 4),
            'ads': round((current_indices.get('anomaly_density_score', 0) or 0) - (prev.get('ads', 0) or 0), 4),
            'composite': round((current_indices.get('composite', 0) or 0) - (prev.get('composite', 0) or 0), 4),
        }
    except Exception:
        return {'rvi': 0, 'eds': 0, 'cdr': 0, 'ads': 0, 'composite': 0}


def _determine_trajectory(deltas: dict) -> str:
    """Determine overall trajectory from deltas."""
    composite_delta = deltas.get('composite', 0)
    if composite_delta > 0.05:
        return 'worsening'
    elif composite_delta < -0.05:
        return 'improving'
    return 'stable'


def _build_tab_insights(tab: str, evidence: dict, instability: dict, propagation: list) -> list:
    """Build tab-specific intelligence from evidence pack."""
    insights = []
    pack = evidence.get('evidence', {})
    snapshot = pack.get('snapshot', {})
    integrations = pack.get('integrations', {})
    indices = instability.get('indices', {})

    if tab == 'revenue' or tab == 'money':
        # Revenue-specific insights
        if integrations.get('crm'):
            revenue = snapshot.get('revenue', {})
            if revenue.get('pipeline'):
                insights.append({
                    'type': 'metric',
                    'title': 'Pipeline Value',
                    'value': revenue.get('pipeline'),
                    'source': 'crm',
                    'evidence_refs': ['cognitive_snapshot:revenue.pipeline']
                })
            rvi = indices.get('revenue_volatility_index', 0)
            if rvi and rvi > 0.3:
                insights.append({
                    'type': 'warning',
                    'title': 'Revenue volatility elevated',
                    'detail': f'Revenue Volatility Index at {round(rvi * 100)}%. Revenue streams showing instability.',
                    'severity': 'high' if rvi > 0.6 else 'medium',
                    'source': 'instability_engine',
                    'evidence_refs': ['instability:rvi']
                })
            concentration = snapshot.get('risk', {}).get('concentration')
            if concentration:
                insights.append({
                    'type': 'risk',
                    'title': 'Revenue dependency detected',
                    'detail': concentration,
                    'severity': 'high',
                    'source': 'cognitive_snapshot',
                    'evidence_refs': ['cognitive_snapshot:risk.concentration']
                })
        if integrations.get('accounting'):
            capital = snapshot.get('capital', {})
            if capital.get('runway') and capital['runway'] < 6:
                insights.append({
                    'type': 'critical',
                    'title': f"Cash runway: {capital['runway']} months",
                    'detail': 'Runway below 6 months. Immediate cash preservation actions recommended.',
                    'severity': 'high',
                    'source': 'accounting',
                    'evidence_refs': ['cognitive_snapshot:capital.runway']
                })

    elif tab == 'operations':
        exec_data = snapshot.get('execution', {})
        if exec_data.get('bottleneck'):
            insights.append({
                'type': 'bottleneck',
                'title': 'Active delivery bottleneck',
                'detail': exec_data['bottleneck'],
                'severity': 'high',
                'source': 'cognitive_snapshot',
                'evidence_refs': ['cognitive_snapshot:execution.bottleneck']
            })
        if exec_data.get('sla_breaches') and exec_data['sla_breaches'] > 0:
            insights.append({
                'type': 'warning',
                'title': f"{exec_data['sla_breaches']} SLA breach{'es' if exec_data['sla_breaches'] > 1 else ''}",
                'detail': 'Service level agreements have been violated. Review delivery pipeline.',
                'severity': 'high' if exec_data['sla_breaches'] > 2 else 'medium',
                'source': 'cognitive_snapshot',
                'evidence_refs': ['cognitive_snapshot:execution.sla_breaches']
            })
        ads = indices.get('anomaly_density_score', 0)
        if ads and ads > 0.3:
            insights.append({
                'type': 'warning',
                'title': 'Anomaly density elevated',
                'detail': f'Anomaly Density Score at {round(ads * 100)}%. Unusual patterns in operations.',
                'severity': 'high' if ads > 0.6 else 'medium',
                'source': 'instability_engine',
                'evidence_refs': ['instability:ads']
            })

    elif tab == 'risk':
        risk = snapshot.get('risk', {})
        spofs = risk.get('spof', [])
        for spof in spofs:
            insights.append({
                'type': 'spof',
                'title': 'Single point of failure',
                'detail': spof,
                'severity': 'high',
                'source': 'cognitive_snapshot',
                'evidence_refs': ['cognitive_snapshot:risk.spof']
            })

    elif tab == 'people':
        vitals = snapshot.get('founder_vitals', {})
        if vitals.get('fatigue') == 'high':
            insights.append({
                'type': 'critical',
                'title': 'Founder fatigue level: HIGH',
                'detail': 'High fatigue detected. Risk of decision quality degradation and burnout.',
                'severity': 'high',
                'source': 'cognitive_snapshot',
                'evidence_refs': ['cognitive_snapshot:founder_vitals.fatigue']
            })
        if vitals.get('capacity_index') and vitals['capacity_index'] > 100:
            insights.append({
                'type': 'warning',
                'title': f"Capacity utilisation: {vitals['capacity_index']}%",
                'detail': 'Over capacity. Delegate or defer non-critical work.',
                'severity': 'high',
                'source': 'cognitive_snapshot',
                'evidence_refs': ['cognitive_snapshot:founder_vitals.capacity_index']
            })

    elif tab == 'market':
        mi = snapshot.get('market_intelligence', {})
        if mi.get('positioning_verdict'):
            insights.append({
                'type': 'positioning',
                'title': 'Market position',
                'detail': mi['positioning_verdict'],
                'source': 'cognitive_snapshot',
                'evidence_refs': ['cognitive_snapshot:market_intelligence.positioning_verdict']
            })
        eds = indices.get('engagement_decay_score', 0)
        if eds and eds > 0.3:
            insights.append({
                'type': 'warning',
                'title': 'Engagement decay detected',
                'detail': f'Engagement Decay Score at {round(eds * 100)}%. Client/market engagement declining.',
                'severity': 'high' if eds > 0.6 else 'medium',
                'source': 'instability_engine',
                'evidence_refs': ['instability:eds']
            })

    # Add propagation warnings
    for prop in propagation:
        target = prop.get('target_domain', '')
        if tab in [target, 'risk']:
            insights.append({
                'type': 'propagation',
                'title': f"Risk migrating from {prop.get('source_domain', '?')}",
                'detail': prop.get('mechanism', ''),
                'severity': prop.get('severity', 'medium'),
                'probability': prop.get('probability', 0),
                'time_horizon': prop.get('time_horizon', ''),
                'source': 'propagation_engine',
                'evidence_refs': prop.get('evidence_refs', [])
            })

    return insights


# ═══════════════════════════════════════════════════════════════
# UNIFIED COGNITION CONTRACT
# ═══════════════════════════════════════════════════════════════

@router.get("/cognition/{tab}")
async def cognition_contract(tab: str, current_user: dict = Depends(get_current_user)):
    """Single source of truth for all intelligence. Frontend must not compute anything."""
    start = time.time()
    sb = _get_sb()
    tenant_id = current_user['id']

    valid_tabs = ['revenue', 'money', 'operations', 'risk', 'people', 'market', 'overview']
    if tab not in valid_tabs:
        raise HTTPException(status_code=400, detail=f"Invalid tab: {tab}. Valid: {valid_tabs}")

    # 1. Assemble evidence
    evidence = _call_rpc(sb, 'fn_assemble_evidence_pack', {'p_tenant_id': tenant_id})
    integrity = evidence.get('integrity_score', 0)
    missing = evidence.get('missing_sources', [])

    # 2. Compute instability indices
    instability_raw = _call_rpc(sb, 'ic_calculate_risk_baseline', {'p_tenant_id': tenant_id})
    indices = instability_raw.get('indices', {}) if instability_raw.get('status') == 'computed' else {}
    composite = instability_raw.get('composite', {}) if instability_raw.get('status') == 'computed' else {}

    # 3. Compute deltas
    deltas = _compute_instability_deltas(sb, tenant_id, indices)
    trajectory = _determine_trajectory(deltas)

    # 4. Compute propagation map
    propagation_raw = _call_rpc(sb, 'fn_compute_propagation_map', {
        'p_tenant_id': tenant_id,
        'p_instability': indices if indices else None
    })
    propagation_map = propagation_raw.get('propagation_map', [])

    # 5. Evaluate pending decision checkpoints
    checkpoint_results = _call_rpc(sb, 'fn_evaluate_pending_checkpoints', {'p_tenant_id': tenant_id})

    # 6. Recalibrate confidence
    confidence = _call_rpc(sb, 'fn_recalibrate_confidence', {'p_tenant_id': tenant_id})

    # 7. Build tab-specific insights
    tab_insights = _build_tab_insights(tab, evidence, instability_raw, propagation_map)

    # 8. Attach relevant automation actions
    insight_categories = list(set(i.get('type', '') for i in tab_insights))
    automation_actions = _get_automation_actions(sb, insight_categories + [tab])

    # 9. Build final contract
    elapsed_ms = round((time.time() - start) * 1000)

    return {
        'tab': tab,
        'computed_at': datetime.now(timezone.utc).isoformat(),
        'computation_ms': elapsed_ms,

        'evidence_pack': {
            'integrity_score': integrity,
            'missing_sources': missing,
            'source_count': evidence.get('source_count', 0),
            'total_possible': evidence.get('total_possible', 8),
        },

        'instability': {
            'rvi': indices.get('revenue_volatility_index', 0),
            'eds': indices.get('engagement_decay_score', 0),
            'cdr': indices.get('cash_deviation_ratio', 0),
            'ads': indices.get('anomaly_density_score', 0),
            'composite': composite.get('risk_score', 0) if isinstance(composite, dict) else 0,
            'risk_band': composite.get('risk_band', 'UNKNOWN') if isinstance(composite, dict) else 'UNKNOWN',
            'deltas': deltas,
            'trajectory': trajectory,
            'model_version': instability_raw.get('model_version', 'unknown'),
            'config': instability_raw.get('config', {}),
            'weights': instability_raw.get('weights', {}),
        },

        'propagation_map': propagation_map,

        'decision_effectiveness': {
            'checkpoints_processed': checkpoint_results.get('checkpoints_processed', 0),
            'results': checkpoint_results.get('results', []),
        },

        'confidence': {
            'score': confidence.get('confidence', 0.5),
            'reason': confidence.get('reason', 'Baseline — no outcomes evaluated'),
            'trend': confidence.get('trend', 'neutral'),
            'accuracy_rate': confidence.get('accuracy_rate'),
            'decisions_evaluated': confidence.get('decisions_evaluated', 0),
        },

        'automation_actions': [
            {
                'action_type': a.get('action_type'),
                'label': a.get('action_label'),
                'secondary_label': a.get('secondary_action_label'),
                'requires_confirmation': a.get('requires_confirmation', True),
                'risk_level': a.get('risk_level', 'low'),
                'integration_required': a.get('integration_required'),
            }
            for a in automation_actions
        ],

        'tab_insights': tab_insights,

        'evidence_refs': {
            'instability': 'ic_calculate_risk_baseline',
            'propagation': 'fn_compute_propagation_map',
            'evidence': 'fn_assemble_evidence_pack',
            'confidence': 'fn_recalibrate_confidence',
        },
    }


# ═══════════════════════════════════════════════════════════════
# DECISION MANAGEMENT
# ═══════════════════════════════════════════════════════════════

@router.post("/cognition/decisions")
async def create_decision(req: DecisionCreate, current_user: dict = Depends(get_current_user)):
    """Record a structured decision. Automatically creates outcome checkpoints."""
    sb = _get_sb()
    tenant_id = current_user['id']

    # Get current instability snapshot
    baseline = _call_rpc(sb, 'ic_calculate_risk_baseline', {'p_tenant_id': tenant_id})
    current_indices = baseline.get('indices', {}) if baseline.get('status') == 'computed' else {}
    current_composite = baseline.get('composite', {}).get('risk_score', 0) if baseline.get('status') == 'computed' else 0

    snapshot_at_time = {
        'rvi': current_indices.get('revenue_volatility_index', 0),
        'eds': current_indices.get('engagement_decay_score', 0),
        'cdr': current_indices.get('cash_deviation_ratio', 0),
        'ads': current_indices.get('anomaly_density_score', 0),
        'composite': current_composite,
    }

    # Insert decision
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

    result = sb.table('cognition_decisions').insert(decision_data).execute()
    decision = result.data[0] if result.data else {}
    decision_id = decision.get('id')

    if not decision_id:
        raise HTTPException(status_code=500, detail="Failed to create decision")

    # Create outcome checkpoints at 30, 60, 90 days
    now = datetime.now(timezone.utc)
    for days in [30, 60, 90]:
        scheduled = now + __import__('datetime').timedelta(days=days)
        sb.table('outcome_checkpoints').insert({
            'decision_id': decision_id,
            'tenant_id': tenant_id,
            'checkpoint_day': days,
            'scheduled_at': scheduled.isoformat(),
            'predicted_instability': req.expected_instability_change,
        }).execute()

    # Sanitize response
    if '_id' in decision:
        del decision['_id']

    return {
        'status': 'recorded',
        'decision_id': decision_id,
        'checkpoints_created': [30, 60, 90],
        'instability_at_time': snapshot_at_time,
    }


@router.get("/cognition/decisions")
async def list_decisions(current_user: dict = Depends(get_current_user)):
    """List all active decisions with their outcome status."""
    sb = _get_sb()
    tenant_id = current_user['id']

    decisions = sb.table('cognition_decisions').select(
        'id, decision_category, decision_statement, affected_domains, '
        'expected_instability_change, expected_time_horizon, confidence_at_time, '
        'evidence_refs, instability_snapshot_at_time, status, created_at'
    ).eq('tenant_id', tenant_id).order('created_at', desc=True).limit(50).execute()

    # Get checkpoints for each decision
    decision_ids = [d['id'] for d in (decisions.data or [])]
    checkpoints = []
    if decision_ids:
        cp_result = sb.table('outcome_checkpoints').select(
            'decision_id, checkpoint_day, status, decision_effective, variance_delta, evaluated_at'
        ).in_('decision_id', decision_ids).execute()
        checkpoints = cp_result.data or []

    # Attach checkpoints to decisions
    cp_map = {}
    for cp in checkpoints:
        did = cp['decision_id']
        if did not in cp_map:
            cp_map[did] = []
        cp_map[did].append(cp)

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
    """Execute an automation action (requires confirmation)."""
    sb = _get_sb()
    tenant_id = current_user['id']

    # Verify action exists
    action = sb.table('automation_actions').select('*').eq('action_type', req.action_type).eq('is_active', True).execute()
    if not action.data:
        raise HTTPException(status_code=404, detail=f"Action '{req.action_type}' not found or inactive")

    action_data = action.data[0]

    # Check if integration is available
    if action_data.get('integration_required'):
        health = sb.table('integration_health').select('status').eq(
            'tenant_id', tenant_id
        ).eq('provider', action_data['integration_required']).execute()

        if not health.data or health.data[0].get('status') != 'CONNECTED':
            raise HTTPException(
                status_code=400,
                detail=f"Integration '{action_data['integration_required']}' not connected. Cannot execute action."
            )

    # Log execution
    exec_data = {
        'tenant_id': tenant_id,
        'action_id': action_data['id'],
        'action_type': req.action_type,
        'insight_ref': req.insight_ref,
        'evidence_refs': req.evidence_refs,
        'status': 'confirmed',
        'confirmed_at': datetime.now(timezone.utc).isoformat(),
    }

    result = sb.table('automation_executions').insert(exec_data).execute()
    execution = result.data[0] if result.data else {}

    # Sanitize
    if '_id' in execution:
        del execution['_id']

    return {
        'status': 'confirmed',
        'execution_id': execution.get('id'),
        'action_type': req.action_type,
        'action_label': action_data.get('action_label'),
        'requires_integration': action_data.get('integration_required'),
        'message': f"Action '{action_data.get('action_label')}' confirmed and logged.",
    }


@router.get("/cognition/automation/history")
async def automation_history(current_user: dict = Depends(get_current_user)):
    """Get automation execution history."""
    sb = _get_sb()
    result = sb.table('automation_executions').select(
        'id, action_type, insight_ref, status, confirmed_at, executed_at, result, created_at'
    ).eq('tenant_id', current_user['id']).order('created_at', desc=True).limit(30).execute()

    return {'executions': result.data or []}


# ═══════════════════════════════════════════════════════════════
# INTEGRATION HEALTH
# ═══════════════════════════════════════════════════════════════

@router.get("/cognition/integration-health")
async def get_integration_health(current_user: dict = Depends(get_current_user)):
    """Get current integration health status for all connections."""
    sb = _get_sb()
    tenant_id = current_user['id']

    # Run health check
    health = _call_rpc(sb, 'fn_check_integration_health', {'p_tenant_id': tenant_id})
    return health


# ═══════════════════════════════════════════════════════════════
# INSTABILITY SNAPSHOT (Store daily)
# ═══════════════════════════════════════════════════════════════

@router.post("/cognition/snapshot-instability")
async def snapshot_instability(current_user: dict = Depends(get_current_user)):
    """Store current instability indices as a daily snapshot (for delta computation)."""
    sb = _get_sb()
    tenant_id = current_user['id']

    baseline = _call_rpc(sb, 'ic_calculate_risk_baseline', {'p_tenant_id': tenant_id})
    if baseline.get('status') != 'computed':
        return {'status': 'skipped', 'reason': baseline.get('status', 'unknown')}

    indices = baseline.get('indices', {})
    composite = baseline.get('composite', {})
    config = baseline.get('config', {})

    # Get evidence integrity
    evidence = _call_rpc(sb, 'fn_assemble_evidence_pack', {'p_tenant_id': tenant_id})

    snap_data = {
        'tenant_id': tenant_id,
        'rvi': indices.get('revenue_volatility_index', 0),
        'eds': indices.get('engagement_decay_score', 0),
        'cdr': indices.get('cash_deviation_ratio', 0),
        'ads': indices.get('anomaly_density_score', 0),
        'composite': composite.get('risk_score', 0),
        'risk_band': composite.get('risk_band', 'UNKNOWN'),
        'config_name': config.get('name'),
        'industry_code': config.get('industry_code'),
        'evidence_integrity': evidence.get('integrity_score', 0),
    }

    sb.table('instability_snapshots').upsert(snap_data, on_conflict='tenant_id,snapshot_date').execute()

    return {'status': 'stored', 'snapshot': snap_data}
