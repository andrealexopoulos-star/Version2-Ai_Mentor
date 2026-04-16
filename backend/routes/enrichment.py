"""BIQc Enrichment routes — serves calibration scan data to frontend.

Returns the full enrichment payload from business_dna_enrichment so the
Market & Position page and Competitive Benchmark page can populate every
card with real scan data (SWOT, CMO actions, SEO analysis, etc.).
"""
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from routes.auth import get_current_user
from supabase_client import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/enrichment/latest")
async def get_latest_enrichment(current_user: dict = Depends(get_current_user)):
    """Return the latest enrichment data from business_dna_enrichment."""
    try:
        sb = get_supabase_client()
        res = sb.table('business_dna_enrichment') \
            .select('enrichment, digital_footprint, created_at') \
            .eq('user_id', current_user['id']) \
            .order('created_at', desc=True) \
            .limit(1) \
            .execute()

        rows = res.data or []
        if not rows:
            return {
                'has_data': False,
                'enrichment': {},
                'scanned_at': None,
                'next_update_available': None,
            }

        row = rows[0]
        enrichment = row.get('enrichment') or {}
        if not enrichment:
            return {
                'has_data': False,
                'enrichment': {},
                'scanned_at': None,
                'next_update_available': None,
            }

        # Merge top-level digital_footprint column into enrichment if present
        df_col = row.get('digital_footprint')
        if df_col and isinstance(df_col, dict) and not enrichment.get('digital_footprint'):
            enrichment['digital_footprint'] = df_col

        scanned_at = None
        fp = enrichment.get('digital_footprint')
        if isinstance(fp, dict):
            scanned_at = fp.get('computed_at')
        if not scanned_at:
            scanned_at = row.get('created_at')

        # Next update available: 30 days after last scan
        next_update = None
        if scanned_at:
            try:
                if isinstance(scanned_at, str):
                    dt = datetime.fromisoformat(scanned_at.replace('Z', '+00:00'))
                else:
                    dt = scanned_at
                next_update = (dt + timedelta(days=30)).isoformat()
            except Exception:
                pass

        return {
            'has_data': True,
            'enrichment': enrichment,
            'scanned_at': scanned_at,
            'next_update_available': next_update,
        }

    except Exception as e:
        logger.exception("Enrichment endpoint failed: %s", e)
        return {
            'has_data': False,
            'enrichment': {},
            'scanned_at': None,
            'next_update_available': None,
        }
