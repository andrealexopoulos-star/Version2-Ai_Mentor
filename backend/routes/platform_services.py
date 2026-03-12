"""BIQc A/B Testing + Vendor-Agnostic Service Layer.

A/B: Experiment management, variant assignment, metric collection.
Migration: Service layer abstraction for future vendor independence.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

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
