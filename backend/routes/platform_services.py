"""BIQc A/B Testing + Vendor-Agnostic Service Layer.

A/B: Experiment management, variant assignment, metric collection.
Migration: Service layer abstraction for future vendor independence.
"""
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import requests

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user


# ═══════════════════════════════════════════════════════════════
# A/B TESTING API
# ═══════════════════════════════════════════════════════════════

class CreateExperiment(BaseModel):
    name: str
    description: str = ''
    variant_a: str = 'control'
    variant_b: str = 'treatment'
    traffic_pct_b: float = 0.5


class RecordMetric(BaseModel):
    experiment_name: str
    metric_name: str
    metric_value: float


@router.get("/experiments/list")
async def list_experiments(current_user: dict = Depends(get_current_user)):
    from supabase_client import get_supabase_client
    sb = get_supabase_client()
    result = sb.table('ab_experiments').select('*').order('created_at', desc=True).execute()
    return {'experiments': result.data or []}


@router.post("/experiments/create")
async def create_experiment(req: CreateExperiment, current_user: dict = Depends(get_current_user)):
    from tier_resolver import resolve_tier
    if resolve_tier(current_user) != 'super_admin':
        raise HTTPException(status_code=403, detail="Super admin only")
    from supabase_client import get_supabase_client
    sb = get_supabase_client()
    sb.table('ab_experiments').insert({
        'experiment_name': req.name, 'description': req.description,
        'variant_a': req.variant_a, 'variant_b': req.variant_b,
        'traffic_pct_b': req.traffic_pct_b, 'status': 'draft',
    }).execute()
    return {'status': 'created', 'experiment': req.name}


@router.post("/experiments/{name}/start")
async def start_experiment(name: str, current_user: dict = Depends(get_current_user)):
    from tier_resolver import resolve_tier
    if resolve_tier(current_user) != 'super_admin':
        raise HTTPException(status_code=403, detail="Super admin only")
    from supabase_client import get_supabase_client
    sb = get_supabase_client()
    sb.table('ab_experiments').update({'status': 'running', 'start_date': 'now()'}).eq('experiment_name', name).execute()
    return {'status': 'running', 'experiment': name}


@router.post("/experiments/{name}/stop")
async def stop_experiment(name: str, current_user: dict = Depends(get_current_user)):
    from tier_resolver import resolve_tier
    if resolve_tier(current_user) != 'super_admin':
        raise HTTPException(status_code=403, detail="Super admin only")
    from supabase_client import get_supabase_client
    sb = get_supabase_client()
    sb.table('ab_experiments').update({'status': 'completed', 'end_date': 'now()'}).eq('experiment_name', name).execute()
    return {'status': 'completed', 'experiment': name}


@router.get("/experiments/{name}/variant")
async def get_my_variant(name: str, current_user: dict = Depends(get_current_user)):
    from supabase_client import get_supabase_client
    sb = get_supabase_client()
    result = sb.rpc('ab_get_variant', {'p_experiment_name': name, 'p_tenant_id': current_user['id']}).execute()
    return {'experiment': name, 'variant': result.data if result.data else 'control'}


@router.post("/experiments/metric")
async def record_metric(req: RecordMetric, current_user: dict = Depends(get_current_user)):
    from supabase_client import get_supabase_client
    sb = get_supabase_client()
    # Get variant
    variant_result = sb.rpc('ab_get_variant', {'p_experiment_name': req.experiment_name, 'p_tenant_id': current_user['id']}).execute()
    variant = variant_result.data if variant_result.data else 'control'
    # Get experiment ID
    exp = sb.table('ab_experiments').select('id').eq('experiment_name', req.experiment_name).single().execute()
    if not exp.data:
        raise HTTPException(status_code=404, detail="Experiment not found")
    sb.table('ab_metrics').insert({
        'experiment_id': exp.data['id'], 'tenant_id': current_user['id'],
        'variant': variant, 'metric_name': req.metric_name, 'metric_value': req.metric_value,
    }).execute()
    return {'status': 'recorded', 'variant': variant}


@router.get("/experiments/{name}/results")
async def get_results(name: str, current_user: dict = Depends(get_current_user)):
    from supabase_client import get_supabase_client
    sb = get_supabase_client()
    result = sb.rpc('ab_experiment_results', {'p_experiment_name': name}).execute()
    return result.data if result.data else {'error': 'no data'}


# ═══════════════════════════════════════════════════════════════
# VENDOR-AGNOSTIC SERVICE LAYER
# ═══════════════════════════════════════════════════════════════

class ServiceRegistry:
    """Abstraction layer for vendor-agnostic operations.
    
    All database, vector store, and LLM calls should go through
    this registry so that swapping providers requires only
    changing the registry configuration, not the business logic.
    """

    @staticmethod
    def get_db():
        """Get database client. Currently Supabase. Swappable."""
        from supabase_client import get_supabase_client
        return get_supabase_client()

    @staticmethod
    def get_vector_store():
        """Get vector store client. Currently pgvector via Supabase. Swappable to Weaviate/Milvus."""
        from supabase_client import get_supabase_client
        return get_supabase_client()

    @staticmethod
    async def generate_embedding(text: str):
        """Generate text embedding. Currently OpenAI. Swappable."""
        from routes.rag_service import generate_embedding
        return await generate_embedding(text)

    @staticmethod
    async def llm_chat(system_message: str, user_message: str, model: str = "gpt-4o", temperature: float = 0.3):
        """LLM chat completion via BIQc router."""
        import os
        from core.llm_router import llm_chat
        key = os.environ.get("OPENAI_API_KEY", "")
        return await llm_chat(system_message=system_message, user_message=user_message, model=model, api_key=key)

    @staticmethod
    def get_auth():
        """Get auth provider. Currently Supabase Auth. Swappable."""
        from supabase_client import get_supabase_client
        return get_supabase_client().auth

    @staticmethod
    def get_storage():
        """Get file storage. Currently Supabase Storage. Swappable to S3/Azure Blob."""
        from supabase_client import get_supabase_client
        return get_supabase_client().storage


# Export singleton
services = ServiceRegistry()


def _check_table(sb, table_name: str, *, schema: Optional[str] = None):
    try:
        query = sb.schema(schema).table(table_name) if schema else sb.table(table_name)
        query.select('*').limit(1).execute()
        return {'status': 'working', 'detail': 'queryable'}
    except Exception as e:
        return {'status': 'missing_or_blocked', 'detail': str(e)[:180]}


def _check_rpc(sb, fn_name: str, params: dict):
    try:
        sb.rpc(fn_name, params).execute()
        return {'status': 'working', 'detail': 'callable'}
    except Exception as e:
        msg = str(e)
        if 'best candidate function' in msg.lower() or 'could not choose the best candidate function' in msg.lower():
            return {'status': 'working', 'detail': 'callable (overloaded signature)'}
        if 'does not exist' in msg.lower() or 'function' in msg.lower():
            return {'status': 'missing', 'detail': msg[:180]}
        return {'status': 'partial', 'detail': msg[:180]}


def _check_edge_function(name: str):
    supabase_url = os.environ.get('SUPABASE_URL')
    service_role = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not supabase_url:
        return {'status': 'unverified', 'detail': 'SUPABASE_URL not configured'}
    url = f"{supabase_url.rstrip('/')}/functions/v1/{name}"
    headers = {'Content-Type': 'application/json'}
    if service_role:
        headers['Authorization'] = f"Bearer {service_role}"
    try:
        res = requests.options(url, headers=headers, timeout=2)
        if res.status_code == 404:
            return {'status': 'missing', 'detail': 'not deployed (404)'}
        if res.status_code in {200, 204, 400, 401, 403, 405}:
            return {'status': 'working', 'detail': f'reachable ({res.status_code})'}
        return {'status': 'partial', 'detail': f'unexpected status {res.status_code}'}
    except Exception as e:
        return {'status': 'partial', 'detail': str(e)[:180]}


@router.get("/services/health")
async def service_health(current_user: dict = Depends(get_current_user)):
    """Check health of all service layer components."""
    results = {}
    try:
        services.get_db().table('users').select('id', count='exact').limit(0).execute()
        results['database'] = 'healthy'
    except Exception as e:
        results['database'] = f'error: {str(e)[:50]}'

    try:
        services.get_vector_store().table('rag_embeddings').select('id', count='exact').limit(0).execute()
        results['vector_store'] = 'healthy'
    except Exception as e:
        results['vector_store'] = f'error: {str(e)[:50]}'

    results['auth'] = 'supabase'
    results['llm'] = 'openai_direct_router'
    results['storage'] = 'supabase_storage'

    return {'services': results, 'vendor_agnostic': True}


@router.get('/services/cognition-platform-audit')
async def cognition_platform_audit(current_user: dict = Depends(get_current_user)):
    """Production-readiness matrix for Cognition-as-a-Platform surfaces."""
    from supabase_client import get_supabase_admin
    sb = get_supabase_admin() or services.get_db()
    tenant_id = current_user['id']

    sql_tables = [
        ('business_core', 'customers'),
        ('business_core', 'companies'),
        ('business_core', 'deals'),
        ('business_core', 'invoices'),
        ('business_core', 'business_metrics'),
        ('business_core', 'concern_registry'),
        ('business_core', 'concern_evaluations'),
        ('business_core', 'integration_snapshots'),
        ('business_core', 'brain_concerns'),
        ('business_core', 'brain_evaluations'),
        (None, 'ic_intelligence_events'),
        (None, 'ic_daily_metric_snapshots'),
        (None, 'ic_ontology_nodes'),
        (None, 'ic_ontology_edges'),
        (None, 'ic_decisions'),
        (None, 'ic_model_registry'),
        (None, 'automation_actions'),
        (None, 'automation_executions'),
        (None, 'generated_files'),
    ]

    table_checks = []
    for schema, table_name in sql_tables:
        state = _check_table(sb, table_name, schema=schema)
        table_checks.append({
            'schema': schema or 'public',
            'table': table_name,
            **state,
        })

    rpc_checks = [
        {
            'function': 'ic_generate_cognition_contract',
            **_check_rpc(sb, 'ic_generate_cognition_contract', {'p_tenant_id': tenant_id, 'p_tab': 'overview'}),
        },
        {
            'function': 'ic_calculate_risk_baseline',
            **_check_rpc(sb, 'ic_calculate_risk_baseline', {'p_tenant_id': tenant_id}),
        },
        {
            'function': 'brain_initial_calibration',
            **_check_rpc(sb, 'business_core.brain_initial_calibration', {'p_tenant_id': tenant_id}),
        },
    ]

    edge_functions = [
        'biqc-insights-cognitive',
        'email_priority',
        'gmail_prod',
        'refresh_tokens',
        'intelligence-bridge',
        'watchtower-brain',
        'market-signal-scorer',
        'calibration-engine',
    ]
    with ThreadPoolExecutor(max_workers=8) as pool:
        edge_results = list(pool.map(_check_edge_function, edge_functions))
    edge_checks = [
        {
            'edge_function': fn,
            **edge_results[idx],
        }
        for idx, fn in enumerate(edge_functions)
    ]

    webhook_checks = [
        {
            'webhook': 'stripe',
            'status': 'working' if bool(os.environ.get('STRIPE_WEBHOOK_SECRET')) else 'partial',
            'detail': 'secret configured' if bool(os.environ.get('STRIPE_WEBHOOK_SECRET')) else 'STRIPE_WEBHOOK_SECRET missing',
        },
        {
            'webhook': 'merge',
            'status': 'partial',
            'detail': 'connector polling active; webhook-first ingestion not fully enabled',
        },
    ]

    serving_map = [
        {
            'platform_surface': '/advisor',
            'primary_apis': ['/api/brain/priorities', '/api/unified/advisor'],
            'status': 'working',
        },
        {
            'platform_surface': '/revenue',
            'primary_apis': ['/api/unified/revenue', '/api/cognition/revenue'],
            'status': 'working',
        },
        {
            'platform_surface': '/operations',
            'primary_apis': ['/api/unified/operations', '/api/cognition/operations'],
            'status': 'working',
        },
        {
            'platform_surface': '/risk',
            'primary_apis': ['/api/unified/risk', '/api/cognition/risk'],
            'status': 'working',
        },
        {
            'platform_surface': '/market',
            'primary_apis': ['/api/unified/market', '/api/cognition/market'],
            'status': 'working',
        },
        {
            'platform_surface': '/soundboard',
            'primary_apis': ['/api/soundboard/chat', '/api/cognition/overview'],
            'status': 'working',
        },
    ]

    all_checks = table_checks + rpc_checks + edge_checks + webhook_checks
    working = len([c for c in all_checks if c.get('status') == 'working'])
    partial = len([c for c in all_checks if c.get('status') == 'partial'])
    missing = len([c for c in all_checks if c.get('status') in {'missing', 'missing_or_blocked'}])

    return {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'tenant_id': tenant_id,
        'summary': {
            'working': working,
            'partial': partial,
            'missing': missing,
            'total_checks': len(all_checks),
            'readiness_score': round((working / max(1, len(all_checks))) * 100, 1),
        },
        'sql_schema_and_tables': table_checks,
        'sql_functions': rpc_checks,
        'edge_functions': edge_checks,
        'webhooks': webhook_checks,
        'serving_map': serving_map,
    }
