"""BIQc Knowledge Graph + Re-Ranking + Evaluation + Alerting.

Graph: Traverses ontology nodes/edges for relationship-based retrieval.
Re-Ranking: Cross-encoder style re-ranking after pgvector search.
Evaluation: Factuality + relevance scoring for LLM outputs.
Alerting: Latency/error spike detection from llm_call_log.
"""
import logging
import time
from typing import List, Dict, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user


# ═══════════════════════════════════════════════════════════════
# KNOWLEDGE GRAPH TRAVERSAL
# ═══════════════════════════════════════════════════════════════

@router.post("/graph/add-node")
async def add_node(node_type: str, attributes: dict, state: str = '', current_user: dict = Depends(get_current_user)):
    from supabase_client import get_supabase_client
    sb = get_supabase_client()
    result = sb.table('ic_ontology_nodes').insert({
        'tenant_id': current_user['id'], 'node_type': node_type,
        'attributes': attributes, 'current_state': state,
    }).execute()
    return {'node_id': result.data[0]['id'] if result.data else None}


@router.post("/graph/add-edge")
async def add_edge(from_node: str, to_node: str, edge_type: str, weight: float = 1.0, current_user: dict = Depends(get_current_user)):
    from supabase_client import get_supabase_client
    sb = get_supabase_client()
    result = sb.table('ic_ontology_edges').insert({
        'tenant_id': current_user['id'], 'from_node': from_node,
        'to_node': to_node, 'edge_type': edge_type, 'weight': weight,
    }).execute()
    return {'edge_id': result.data[0]['id'] if result.data else None}


@router.get("/graph/traverse/{node_id}")
async def traverse_graph(node_id: str, depth: int = 2, current_user: dict = Depends(get_current_user)):
    """Traverse knowledge graph from a node up to N depth."""
    from supabase_client import get_supabase_client
    sb = get_supabase_client()
    tid = current_user['id']

    visited = set()
    result_nodes = []
    result_edges = []
    queue = [(node_id, 0)]

    while queue:
        nid, d = queue.pop(0)
        if nid in visited or d > depth:
            continue
        visited.add(nid)

        node = sb.table('ic_ontology_nodes').select('*').eq('id', nid).eq('tenant_id', tid).execute()
        if node.data:
            result_nodes.append(node.data[0])

        edges = sb.table('ic_ontology_edges').select('*').eq('tenant_id', tid).or_(f'from_node.eq.{nid},to_node.eq.{nid}').execute()
        for edge in (edges.data or []):
            result_edges.append(edge)
            next_node = edge['to_node'] if edge['from_node'] == nid else edge['from_node']
            if next_node not in visited:
                queue.append((next_node, d + 1))

    return {'nodes': result_nodes, 'edges': result_edges, 'depth': depth, 'traversed': len(visited)}


@router.get("/graph/query")
async def query_graph(node_type: str = '', state: str = '', current_user: dict = Depends(get_current_user)):
    """Query nodes by type and/or state."""
    from supabase_client import get_supabase_client
    sb = get_supabase_client()
    query = sb.table('ic_ontology_nodes').select('*').eq('tenant_id', current_user['id'])
    if node_type:
        query = query.eq('node_type', node_type)
    if state:
        query = query.eq('current_state', state)
    result = query.order('created_at', desc=True).limit(50).execute()
    return {'nodes': result.data or []}


# ═══════════════════════════════════════════════════════════════
# RE-RANKING LAYER
# ═══════════════════════════════════════════════════════════════

@router.post("/rag/rerank")
async def rerank_results(query: str, results: List[dict], current_user: dict = Depends(get_current_user)):
    """Re-rank RAG search results using LLM-based relevance scoring."""
    if not results:
        return {'results': []}

    import os
    from core.llm_router import llm_chat

    key = os.environ.get("OPENAI_API_KEY", "")

    docs_text = "\n".join([f"Doc {i+1}: {r.get('content', '')[:200]}" for i, r in enumerate(results[:10])])
    prompt = f"Query: {query}\n\nDocuments:\n{docs_text}\n\nReturn relevance scores as JSON array:"

    start = time.time()
    response = await llm_chat(system_message="You are a relevance scorer. Rate each document's relevance 0-10. Return ONLY a JSON array.", user_message=prompt, model="gpt-5.3", api_key=key)
    elapsed = int((time.time() - start) * 1000)

    import json
    try:
        scores = json.loads(response.strip())
        for i, result in enumerate(results[:len(scores)]):
            result['rerank_score'] = scores[i] if i < len(scores) else 0
        results.sort(key=lambda x: x.get('rerank_score', 0), reverse=True)
    except Exception:
        pass

    from guardrails import log_llm_call_to_db
    log_llm_call_to_db(tenant_id=current_user['id'], model_name="gpt-5.3", endpoint='rag/rerank', latency_ms=elapsed, total_tokens=(len(prompt) + len(response)) // 4)

    return {'results': results}


# ═══════════════════════════════════════════════════════════════
# EVALUATION HARNESS
# ═══════════════════════════════════════════════════════════════

@router.get("/eval/factuality")
async def evaluate_factuality(current_user: dict = Depends(get_current_user)):
    """Compute factuality metrics from recent LLM outputs."""
    from supabase_client import get_supabase_client
    sb = get_supabase_client()

    logs = sb.table('llm_call_log').select('output_valid, validation_errors, model_name, created_at') \
        .order('created_at', desc=True).limit(100).execute()
    calls = logs.data or []

    total = len(calls)
    valid = sum(1 for c in calls if c.get('output_valid') is not False)
    invalid = total - valid
    by_model = {}
    for c in calls:
        m = c.get('model_name', 'unknown')
        if m not in by_model:
            by_model[m] = {'total': 0, 'valid': 0}
        by_model[m]['total'] += 1
        if c.get('output_valid') is not False:
            by_model[m]['valid'] += 1

    return {
        'total_calls': total,
        'valid_outputs': valid,
        'invalid_outputs': invalid,
        'factuality_rate': round(valid / max(total, 1), 3),
        'by_model': {m: {**s, 'rate': round(s['valid'] / max(s['total'], 1), 3)} for m, s in by_model.items()},
    }


# ═══════════════════════════════════════════════════════════════
# ALERTING
# ═══════════════════════════════════════════════════════════════

@router.get("/alerts/check")
async def check_alerts(current_user: dict = Depends(get_current_user)):
    """Check for latency spikes, error bursts, and anomalies in LLM calls."""
    from supabase_client import get_supabase_client
    sb = get_supabase_client()

    logs = sb.table('llm_call_log').select('latency_ms, output_valid, model_name, created_at') \
        .order('created_at', desc=True).limit(50).execute()
    calls = logs.data or []

    alerts = []

    # Latency spike: avg > 5000ms
    if calls:
        avg_latency = sum(c.get('latency_ms', 0) for c in calls) / len(calls)
        if avg_latency > 5000:
            alerts.append({'type': 'latency_spike', 'severity': 'high', 'detail': f'Average latency {int(avg_latency)}ms exceeds 5s threshold'})

    # Error burst: >20% failures in last 50 calls
    failures = sum(1 for c in calls if c.get('output_valid') is False)
    if len(calls) > 10 and failures / len(calls) > 0.2:
        alerts.append({'type': 'error_burst', 'severity': 'high', 'detail': f'{failures}/{len(calls)} calls failed ({round(failures/len(calls)*100)}%)'})

    # Token anomaly: single call > 10K tokens
    high_token = sb.table('llm_call_log').select('total_tokens, endpoint, created_at') \
        .gt('total_tokens', 10000).order('created_at', desc=True).limit(5).execute()
    if high_token.data:
        alerts.append({'type': 'token_anomaly', 'severity': 'medium', 'detail': f'{len(high_token.data)} calls exceeded 10K tokens'})

    return {'alerts': alerts, 'alert_count': len(alerts), 'calls_analyzed': len(calls)}
