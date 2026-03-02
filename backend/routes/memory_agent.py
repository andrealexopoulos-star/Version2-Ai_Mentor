"""BIQc Memory Agent — Episodic, semantic, and context summary management.

Stores events, extracts knowledge triples, generates session summaries.
Feature-flagged: memory_layer_enabled.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict
from fastapi import APIRouter, Depends

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user
from intelligence_spine import _get_cached_flag


@router.post("/memory/episodic")
async def store_episodic_event(event_type: str, event_data: dict, session_id: str = '', current_user: dict = Depends(get_current_user)):
    """Store raw event in episodic memory."""
    if not _get_cached_flag('memory_layer_enabled'):
        return {'status': 'memory_disabled'}
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        sb.table('episodic_memory').insert({
            'tenant_id': current_user['id'],
            'event_type': event_type,
            'event_data': event_data,
            'session_id': session_id,
            'source_system': 'platform',
        }).execute()
        return {'status': 'stored'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}


@router.post("/memory/semantic")
async def store_semantic_triple(subject: str, predicate: str, obj: str, confidence: float = 1.0, current_user: dict = Depends(get_current_user)):
    """Store knowledge graph triple in semantic memory."""
    if not _get_cached_flag('memory_layer_enabled'):
        return {'status': 'memory_disabled'}
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        sb.table('semantic_memory').insert({
            'tenant_id': current_user['id'],
            'subject': subject,
            'predicate': predicate,
            'object': obj,
            'confidence': confidence,
        }).execute()
        return {'status': 'stored'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}


@router.get("/memory/retrieve")
async def retrieve_memory(query: str = '', limit: int = 10, current_user: dict = Depends(get_current_user)):
    """Retrieve relevant memory for context assembly."""
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()

        # Episodic: recent events
        episodes = sb.table('episodic_memory') \
            .select('event_type, event_data, created_at') \
            .eq('tenant_id', current_user['id']) \
            .order('created_at', desc=True) \
            .limit(limit).execute()

        # Semantic: knowledge triples
        triples = sb.table('semantic_memory') \
            .select('subject, predicate, object, confidence') \
            .eq('tenant_id', current_user['id']) \
            .order('created_at', desc=True) \
            .limit(limit).execute()

        # Summaries: recent context
        summaries = sb.table('context_summaries') \
            .select('summary_type, summary_text, key_outcomes, created_at') \
            .eq('tenant_id', current_user['id']) \
            .order('created_at', desc=True) \
            .limit(5).execute()

        return {
            'episodes': episodes.data or [],
            'triples': triples.data or [],
            'summaries': summaries.data or [],
        }
    except Exception:
        return {'episodes': [], 'triples': [], 'summaries': []}


@router.post("/memory/summarise")
async def summarise_session(session_id: str, summary_text: str, key_outcomes: list = None, current_user: dict = Depends(get_current_user)):
    """Store session summary in context_summaries."""
    if not _get_cached_flag('memory_layer_enabled'):
        return {'status': 'memory_disabled'}
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()

        # Get source event IDs from this session
        events = sb.table('episodic_memory') \
            .select('id') \
            .eq('tenant_id', current_user['id']) \
            .eq('session_id', session_id) \
            .execute()
        event_ids = [e['id'] for e in (events.data or [])]

        sb.table('context_summaries').insert({
            'tenant_id': current_user['id'],
            'summary_type': 'session',
            'summary_text': summary_text,
            'source_event_ids': event_ids,
            'source_count': len(event_ids),
            'key_outcomes': key_outcomes or [],
        }).execute()
        return {'status': 'stored', 'source_events': len(event_ids)}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}
