"""BIQc RAG Service — Embedding generation, storage, retrieval.

Uses OpenAI text-embedding-3-small (1536 dims) via emergentintegrations.
Stores in Supabase pgvector. Retrieves via cosine similarity.
Feature-flagged: rag_chat_enabled.
"""
import hashlib
import logging
import time
from typing import List, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user
from intelligence_spine import _get_cached_flag


class EmbedRequest(BaseModel):
    content: str
    source_type: str = 'document'
    source_id: str = ''
    source_url: str = ''
    metadata: dict = {}


class SearchRequest(BaseModel):
    query: str
    limit: int = 5
    source_types: Optional[List[str]] = None
    threshold: float = 0.7


async def generate_embedding(text: str) -> List[float]:
    """Generate embedding using OpenAI text-embedding-3-small."""
    import os
    try:
        from emergentintegrations.llm.openai import OpenAIChat
        import openai
        client = openai.AsyncOpenAI(api_key=os.environ.get('EMERGENT_LLM_KEY') or os.environ.get('OPENAI_API_KEY'))
        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=text[:8000],
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        raise


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[Dict]:
    """Split text into overlapping chunks for embedding."""
    chunks = []
    words = text.split()
    for i in range(0, len(words), chunk_size - overlap):
        chunk = ' '.join(words[i:i + chunk_size])
        if len(chunk.strip()) > 20:
            chunks.append({
                'text': chunk,
                'index': len(chunks),
                'start_word': i,
            })
    return chunks


@router.post("/rag/embed")
async def embed_content(req: EmbedRequest, current_user: dict = Depends(get_current_user)):
    """Generate embedding and store in pgvector."""
    if not _get_cached_flag('rag_chat_enabled'):
        return {'status': 'rag_disabled'}

    content_hash = hashlib.md5(req.content[:1000].encode()).hexdigest()

    try:
        embedding = await generate_embedding(req.content)

        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        sb.table('rag_embeddings').upsert({
            'tenant_id': current_user['id'],
            'content': req.content[:5000],
            'content_hash': content_hash,
            'embedding': embedding,
            'source_type': req.source_type,
            'source_id': req.source_id,
            'source_url': req.source_url,
            'metadata': req.metadata,
        }, on_conflict='tenant_id,content_hash').execute()

        return {'status': 'embedded', 'content_hash': content_hash, 'dimensions': len(embedding)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rag/embed-bulk")
async def embed_bulk(texts: List[EmbedRequest], current_user: dict = Depends(get_current_user)):
    """Embed multiple documents."""
    if not _get_cached_flag('rag_chat_enabled'):
        return {'status': 'rag_disabled'}

    results = []
    for req in texts[:20]:
        try:
            content_hash = hashlib.md5(req.content[:1000].encode()).hexdigest()
            embedding = await generate_embedding(req.content)
            from supabase_client import get_supabase_client
            sb = get_supabase_client()
            sb.table('rag_embeddings').upsert({
                'tenant_id': current_user['id'],
                'content': req.content[:5000],
                'content_hash': content_hash,
                'embedding': embedding,
                'source_type': req.source_type,
                'source_id': req.source_id,
                'metadata': req.metadata,
            }, on_conflict='tenant_id,content_hash').execute()
            results.append({'hash': content_hash, 'status': 'ok'})
        except Exception as e:
            results.append({'hash': '', 'status': 'error', 'error': str(e)[:50]})

    return {'embedded': len([r for r in results if r['status'] == 'ok']), 'total': len(texts), 'results': results}


@router.post("/rag/search")
async def search_embeddings(req: SearchRequest, current_user: dict = Depends(get_current_user)):
    """Search for similar content using vector similarity."""
    if not _get_cached_flag('rag_chat_enabled'):
        return {'status': 'rag_disabled', 'results': []}

    try:
        query_embedding = await generate_embedding(req.query)

        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.rpc('rag_search', {
            'p_tenant_id': current_user['id'],
            'p_query_embedding': query_embedding,
            'p_limit': req.limit,
            'p_source_types': req.source_types,
            'p_similarity_threshold': req.threshold,
        }).execute()

        return {'results': result.data or [], 'query': req.query[:100], 'count': len(result.data or [])}
    except Exception as e:
        return {'results': [], 'error': str(e)[:100]}


@router.get("/rag/stats")
async def get_rag_stats(current_user: dict = Depends(get_current_user)):
    """Get embedding stats for tenant."""
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.table('rag_embeddings') \
            .select('source_type') \
            .eq('tenant_id', current_user['id']).execute()
        by_type = {}
        for r in (result.data or []):
            t = r.get('source_type', 'unknown')
            by_type[t] = by_type.get(t, 0) + 1
        return {'total': len(result.data or []), 'by_source': by_type}
    except Exception:
        return {'total': 0, 'by_source': {}}


@router.post("/rag/ingest-profile")
async def ingest_business_profile(current_user: dict = Depends(get_current_user)):
    """Auto-embed the user's business profile + latest snapshot into RAG store."""
    if not _get_cached_flag('rag_chat_enabled'):
        return {'status': 'rag_disabled'}

    from supabase_client import get_supabase_client
    sb = get_supabase_client()
    embedded = 0

    # Embed business profile
    try:
        profile = sb.table('business_profiles') \
            .select('*').eq('user_id', current_user['id']).single().execute()
        if profile.data:
            p = profile.data
            profile_text = f"Business: {p.get('business_name', '')}. Industry: {p.get('industry', '')}. Location: {p.get('location', '')}. Website: {p.get('website', '')}. Services: {p.get('products_services', '')}. Mission: {p.get('mission', '')}. Target market: {p.get('target_market', '')}."
            emb = await generate_embedding(profile_text)
            sb.table('rag_embeddings').upsert({
                'tenant_id': current_user['id'],
                'content': profile_text,
                'content_hash': hashlib.md5(profile_text.encode()).hexdigest(),
                'embedding': emb,
                'source_type': 'profile',
                'metadata': {'business_name': p.get('business_name')},
            }, on_conflict='tenant_id,content_hash').execute()
            embedded += 1
    except Exception as e:
        logger.warning(f"Profile embedding failed: {e}")

    # Embed latest snapshot
    try:
        snap = sb.table('intelligence_snapshots') \
            .select('cognitive_snapshot').eq('user_id', current_user['id']) \
            .order('generated_at', desc=True).limit(1).execute()
        if snap.data and snap.data[0].get('cognitive_snapshot'):
            import json
            snap_text = json.dumps(snap.data[0]['cognitive_snapshot'])[:4000]
            emb = await generate_embedding(snap_text)
            sb.table('rag_embeddings').upsert({
                'tenant_id': current_user['id'],
                'content': snap_text,
                'content_hash': hashlib.md5(snap_text[:500].encode()).hexdigest(),
                'embedding': emb,
                'source_type': 'snapshot',
                'metadata': {'type': 'cognitive_snapshot'},
            }, on_conflict='tenant_id,content_hash').execute()
            embedded += 1
    except Exception as e:
        logger.warning(f"Snapshot embedding failed: {e}")

    return {'status': 'ingested', 'embedded': embedded}
