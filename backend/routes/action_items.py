"""BIQc Action Items — CRUD + seed from enrichment data.

Allows users to track, assign, and schedule actions derived from
SWOT analysis, CMO priority actions, and industry recommendations.
The /seed endpoint auto-populates a 90-day action plan from the
latest calibration enrichment data.
"""
import logging
from datetime import date, timedelta, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from routes.auth import get_current_user
from supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter()


class ActionItemCreate(BaseModel):
    title: str
    description: Optional[str] = None
    source: str = 'manual'
    status: str = 'pending'
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    priority: str = 'medium'


class ActionItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None


@router.get("/action-items")
async def list_action_items(current_user: dict = Depends(get_current_user)):
    """List all action items for the current user."""
    sb = get_supabase_admin()
    res = sb.table('action_items') \
        .select('*') \
        .eq('user_id', current_user['id']) \
        .order('created_at') \
        .execute()
    return {'items': res.data or []}


@router.post("/action-items")
async def create_action_item(item: ActionItemCreate, current_user: dict = Depends(get_current_user)):
    """Create a single action item."""
    sb = get_supabase_admin()
    data = {
        'user_id': current_user['id'],
        'title': item.title,
        'source': item.source,
        'status': item.status,
        'priority': item.priority,
    }
    if item.description is not None:
        data['description'] = item.description
    if item.assigned_to is not None:
        data['assigned_to'] = item.assigned_to
    if item.due_date is not None:
        data['due_date'] = item.due_date
    res = sb.table('action_items').insert(data).execute()
    return {'item': res.data[0] if res.data else None}


@router.patch("/action-items/{item_id}")
async def update_action_item(item_id: str, update: ActionItemUpdate, current_user: dict = Depends(get_current_user)):
    """Update an action item (status, assignee, due_date, etc.)."""
    sb = get_supabase_admin()
    updates = {}
    if update.title is not None:
        updates['title'] = update.title
    if update.description is not None:
        updates['description'] = update.description
    if update.status is not None:
        updates['status'] = update.status
    if update.assigned_to is not None:
        updates['assigned_to'] = update.assigned_to
    if update.due_date is not None:
        updates['due_date'] = update.due_date
    if update.priority is not None:
        updates['priority'] = update.priority
    if not updates:
        raise HTTPException(status_code=400, detail='No fields to update')
    updates['updated_at'] = datetime.now(timezone.utc).isoformat()
    res = sb.table('action_items') \
        .update(updates) \
        .eq('id', item_id) \
        .eq('user_id', current_user['id']) \
        .execute()
    if not res.data:
        raise HTTPException(status_code=404, detail='Action item not found')
    return {'item': res.data[0]}


@router.delete("/action-items/{item_id}")
async def delete_action_item(item_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an action item."""
    sb = get_supabase_admin()
    res = sb.table('action_items') \
        .delete() \
        .eq('id', item_id) \
        .eq('user_id', current_user['id']) \
        .execute()
    return {'deleted': bool(res.data)}


@router.post("/action-items/seed")
async def seed_from_enrichment(current_user: dict = Depends(get_current_user)):
    """Auto-populate action items from the latest SWOT and CMO enrichment data.

    Spreads due dates over 90 days based on priority:
    - SWOT threats → urgent, 14-day intervals (weeks 2-6)
    - SWOT weaknesses → high, 30-day intervals (months 1-3)
    - CMO priority actions → high/medium, 15-day intervals (weeks 2-12)
    - SWOT opportunities → medium, 20-day intervals (month 2-3)
    - Industry action items → medium, 45+ day intervals (month 2-3)

    Clears previously seeded items (keeps manual ones) before re-seeding.
    """
    sb = get_supabase_admin()

    bde = sb.table('business_dna_enrichment') \
        .select('enrichment') \
        .eq('user_id', current_user['id']) \
        .order('created_at', desc=True) \
        .limit(1) \
        .maybe_single() \
        .execute()
    if not bde.data or not bde.data.get('enrichment'):
        raise HTTPException(
            status_code=404,
            detail='No enrichment data found. Complete calibration first.',
        )

    enrichment = bde.data['enrichment']
    items = []
    today = date.today()
    swot = enrichment.get('swot', {})

    # SWOT threats — urgent, early deadlines
    for i, t in enumerate(swot.get('threats', [])):
        items.append({
            'user_id': current_user['id'],
            'source': 'swot_threat',
            'title': f'Mitigate: {t}',
            'description': 'SWOT threat identified during calibration scan.',
            'priority': 'urgent',
            'due_date': str(today + timedelta(days=14 * (i + 1))),
        })

    # SWOT weaknesses — high priority, monthly intervals
    for i, w in enumerate(swot.get('weaknesses', [])):
        items.append({
            'user_id': current_user['id'],
            'source': 'swot_weakness',
            'title': f'Address: {w}',
            'description': 'SWOT weakness identified during calibration scan.',
            'priority': 'high',
            'due_date': str(today + timedelta(days=30 * (i + 1))),
        })

    # CMO priority actions — first 3 high, rest medium
    for i, action in enumerate(enrichment.get('cmo_priority_actions', [])):
        items.append({
            'user_id': current_user['id'],
            'source': 'cmo',
            'title': action,
            'description': 'CMO priority action from calibration analysis.',
            'priority': 'high' if i < 3 else 'medium',
            'due_date': str(today + timedelta(days=15 * (i + 1))),
        })

    # SWOT opportunities — medium priority
    for i, o in enumerate(swot.get('opportunities', [])):
        items.append({
            'user_id': current_user['id'],
            'source': 'swot_opportunity',
            'title': f'Pursue: {o}',
            'description': 'SWOT opportunity identified during calibration scan.',
            'priority': 'medium',
            'due_date': str(today + timedelta(days=30 + 20 * i)),
        })

    # Industry action items
    for i, action in enumerate(enrichment.get('industry_action_items', [])):
        items.append({
            'user_id': current_user['id'],
            'source': 'industry',
            'title': action,
            'description': 'Industry-specific action from calibration analysis.',
            'priority': 'medium',
            'due_date': str(today + timedelta(days=45 + 15 * i)),
        })

    if items:
        seeded_sources = [
            'swot_weakness', 'swot_opportunity', 'swot_threat', 'cmo', 'industry',
        ]
        sb.table('action_items') \
            .delete() \
            .eq('user_id', current_user['id']) \
            .in_('source', seeded_sources) \
            .execute()
        sb.table('action_items').insert(items).execute()

    return {
        'seeded': len(items),
        'sources': ['swot', 'cmo_priority_actions', 'industry_action_items'],
    }
