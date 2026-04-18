"""BIQc Cognitive Stats — Phase 6.13b summary endpoint.

Backs the CognitiveLearningCounter frontend component (card/strip/hero
variants) with real DB counts instead of client-side estimates.

Returns the four numbers the counter derives its display from:
  - first_scan_at      — when BIQc started learning this business
  - signals_processed  — count(observation_events)
  - snapshots_created  — count(intelligence_snapshots)
  - agents_engaged     — distinct(usage_tracking.function_name)

Security: the frontend sends `?user_id=` for API cosmetics; we ignore it
and always derive user_id from the JWT (never trust client-sent IDs).
"""
import logging
from fastapi import APIRouter, Depends
from routes.auth import get_current_user
from supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/cognitive-stats/summary")
async def cognitive_stats_summary(current_user: dict = Depends(get_current_user)):
    sb = get_supabase_admin()
    user_id = current_user['id']

    first_scan_at = None
    try:
        bp = sb.table('business_profiles') \
            .select('created_at') \
            .eq('user_id', user_id) \
            .order('created_at') \
            .limit(1) \
            .execute()
        if bp.data:
            first_scan_at = bp.data[0].get('created_at')
    except Exception as e:
        logger.warning(f"[cognitive-stats] business_profiles lookup failed: {e}")

    signals_processed = 0
    try:
        sig = sb.table('observation_events') \
            .select('id', count='exact') \
            .eq('user_id', user_id) \
            .limit(1) \
            .execute()
        signals_processed = sig.count or 0
    except Exception as e:
        logger.warning(f"[cognitive-stats] observation_events count failed: {e}")

    snapshots_created = 0
    try:
        snap = sb.table('intelligence_snapshots') \
            .select('id', count='exact') \
            .eq('user_id', user_id) \
            .limit(1) \
            .execute()
        snapshots_created = snap.count or 0
    except Exception as e:
        logger.warning(f"[cognitive-stats] intelligence_snapshots count failed: {e}")

    agents_engaged = 0
    try:
        # PostgREST has no COUNT(DISTINCT). Pull function_name column (cheap) and
        # distinct in Python. Cap at 5000 rows — ~40 edge functions exist so a
        # heavy user hits this cap only after >125 invocations per function.
        # Move to a SQL RPC if/when we cross that.
        agents = sb.table('usage_tracking') \
            .select('function_name') \
            .eq('user_id', user_id) \
            .limit(5000) \
            .execute()
        distinct_fns = {row['function_name'] for row in (agents.data or []) if row.get('function_name')}
        agents_engaged = len(distinct_fns)
    except Exception as e:
        logger.warning(f"[cognitive-stats] usage_tracking distinct failed: {e}")

    return {
        'first_scan_at': first_scan_at,
        'signals_processed': signals_processed,
        'snapshots_created': snapshots_created,
        'agents_engaged': agents_engaged,
    }
