"""BIQc Enrichment routes — serves calibration scan data to frontend.

Returns the sanitized enrichment payload from business_dna_enrichment so the
Market & Position page and Competitive Benchmark page can populate every
card with real scan data (SWOT, CMO actions, SEO analysis, etc.).

Contract v2 / Step 3c (2026-04-23): every response on this router is
wrapped through sanitize_enrichment_for_external(). The DB row keeps the
full internal shape (ai_errors, sources.edge_tools, correlation ids) for
audit; the frontend only sees the contract-shaped view with per-section
state annotations and uncertainty language.
"""
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from routes.auth import get_current_user
from supabase_client import get_supabase_admin
from core.response_sanitizer import sanitize_enrichment_for_external, ExternalState

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/enrichment/latest")
async def get_latest_enrichment(current_user: dict = Depends(get_current_user)):
    """Return the latest enrichment data from business_dna_enrichment, sanitized."""
    try:
        sb = get_supabase_admin()
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
                'state': ExternalState.PROCESSING.value,
                'enrichment': {},
                'scanned_at': None,
                'next_update_available': None,
            }

        row = rows[0]
        enrichment = row.get('enrichment') or {}
        if not enrichment:
            return {
                'has_data': False,
                'state': ExternalState.PROCESSING.value,
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

        # Contract v2 / Step 3c: sanitize before returning.
        sanitized = sanitize_enrichment_for_external(enrichment)
        return {
            'has_data': True,
            'state': sanitized['state'],
            'enrichment': sanitized['enrichment'],
            'scanned_at': scanned_at,
            'next_update_available': next_update,
        }

    except Exception as e:
        logger.exception("Enrichment endpoint failed")
        # Contract v2: exceptions become external state=DEGRADED. Never
        # leak exception details to the UI.
        return {
            'has_data': False,
            'state': ExternalState.DEGRADED.value,
            'enrichment': {},
            'scanned_at': None,
            'next_update_available': None,
        }
