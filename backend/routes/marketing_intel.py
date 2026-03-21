"""BIQc Marketing Intelligence — Benchmarking, scoring, radar data.

Multi-pillar scoring: Brand Visibility, Digital Presence, Content Maturity,
Social Engagement, AI Citation Share.
Feature-flagged: marketing_benchmarks_enabled.
"""
import logging
from typing import Dict, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user
from intelligence_spine import _get_cached_flag
from biqc_jobs import enqueue_job


class BenchmarkRequest(BaseModel):
    competitors: List[str] = []  # Up to 5 competitor domains


PILLARS = ['brand_visibility', 'digital_presence', 'content_maturity', 'social_engagement', 'ai_citation_share']


async def execute_marketing_benchmark_job(payload: dict) -> dict:
    req = BenchmarkRequest(competitors=list(payload.get("competitors") or []))
    current_user = payload.get("current_user") or {"id": payload.get("user_id")}
    """Run marketing benchmark against competitors."""
    flag_enabled = _get_cached_flag('marketing_benchmarks_enabled')
    if not flag_enabled:
        logger.warning(
            "marketing_benchmarks_enabled=false — executing benchmark in compatibility mode"
        )

    from routes.dsee import resolve_domain, classify_structure, _serper, _get_review_data, _check_authority
    from routes.sdd import compute_service_density, compute_geographic_density, compute_citation_density

    # Get user's business profile
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        profile = sb.table('business_profiles') \
            .select('business_name, website, industry, location') \
            .eq('user_id', current_user['id']).single().execute()
        biz = profile.data or {}
    except Exception:
        raise HTTPException(status_code=400, detail='Business profile required')

    website = biz.get('website', '')
    name = biz.get('business_name', '')
    location = biz.get('location', '')
    industry = biz.get('industry', '')

    if not website:
        raise HTTPException(status_code=400, detail='Website URL required in business profile')

    # Resolve subject
    subject_dom = await resolve_domain(website)
    if not subject_dom['integrity']:
        return {'status': 'domain_error', 'error': subject_dom.get('error')}

    subject_struct = classify_structure(subject_dom['html'], subject_dom['domain'])
    subject_reviews = await _get_review_data(name, location)
    subject_authority = await _check_authority(name)
    subject_sd = compute_service_density(subject_dom['html'], industry.lower() if industry else 'business')
    subject_gd = compute_geographic_density(subject_dom['html'], location)
    subject_ecd = await compute_citation_density(name, subject_dom['domain'])

    # Process competitors (max 5)
    comp_scores = []
    for comp_domain in req.competitors[:5]:
        try:
            comp_dom = await resolve_domain(comp_domain)
            if not comp_dom['integrity']:
                continue
            comp_name = comp_domain.split('.')[0].title()
            comp_reviews = await _get_review_data(comp_name, location)
            comp_authority = await _check_authority(comp_name)
            comp_sd = compute_service_density(comp_dom['html'], industry.lower() if industry else 'business')
            comp_ecd = await compute_citation_density(comp_name, comp_dom['domain'])

            comp_scores.append({
                'domain': comp_domain,
                'name': comp_name,
                'brand_visibility': min((comp_authority['total'] * 10 + comp_reviews.get('reviews', 0)) / 100, 1.0),
                'digital_presence': min(comp_sd['density'] / 5.0, 1.0),
                'content_maturity': min(comp_sd['indexed_pages_estimate'] / 50, 1.0),
                'social_engagement': min(comp_reviews.get('reviews', 0) / 50, 1.0),
                'ai_citation_share': min(comp_ecd['citation_count'] / 10, 1.0),
            })
        except Exception:
            continue

    # Subject scores
    subject_scores = {
        'brand_visibility': round(min((subject_authority['total'] * 10 + subject_reviews.get('reviews', 0)) / 100, 1.0), 3),
        'digital_presence': round(min(subject_sd['density'] / 5.0, 1.0), 3),
        'content_maturity': round(min(subject_sd['indexed_pages_estimate'] / 50, 1.0), 3),
        'social_engagement': round(min(subject_reviews.get('reviews', 0) / 50, 1.0), 3),
        'ai_citation_share': round(min(subject_ecd['citation_count'] / 10, 1.0), 3),
    }

    # Radar data
    radar = {
        'labels': ['Brand Visibility', 'Digital Presence', 'Content Maturity', 'Social Engagement', 'AI Citation'],
        'subject': [subject_scores[p] for p in PILLARS],
        'competitor_avg': [
            round(sum(c.get(p, 0) for c in comp_scores) / max(len(comp_scores), 1), 3)
            for p in PILLARS
        ] if comp_scores else [0] * 5,
    }

    # Overall score
    overall = round(sum(subject_scores.values()) / len(PILLARS), 3)

    # Store benchmark
    benchmark_data = {
        'tenant_id': current_user['id'],
        'competitors': [{'domain': c['domain'], 'name': c['name']} for c in comp_scores],
        'scores': {**subject_scores, 'overall': overall},
        'summary': f'{name} scores {round(overall * 100)}% overall across 5 marketing pillars.',
        'radar_data': radar,
        'source_data': {'subject_domain': subject_dom['domain'], 'competitors_analyzed': len(comp_scores)},
        'is_current': True,
    }

    try:
        # Deactivate old benchmarks
        sb.table('marketing_benchmarks').update({'is_current': False}).eq('tenant_id', current_user['id']).execute()
        # Insert new
        sb.table('marketing_benchmarks').insert(benchmark_data).execute()
    except Exception as e:
        logger.warning(f'Benchmark storage failed: {e}')

    return {
        'status': 'complete',
        'feature_flag_enabled': flag_enabled,
        'scores': subject_scores,
        'overall': overall,
        'radar': radar,
        'competitors': comp_scores,
        'competitor_count': len(comp_scores),
    }


@router.post("/marketing/benchmark")
async def run_benchmark(req: BenchmarkRequest, current_user: dict = Depends(get_current_user)):
    # Prefer synchronous execution so the UI receives immediate benchmark results.
    # If synchronous execution fails, gracefully fall back to queued background mode.
    try:
        return await execute_marketing_benchmark_job({
            'competitors': req.competitors,
            'user_id': current_user.get('id'),
            'current_user': {'id': current_user.get('id')},
        })
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Synchronous benchmark execution failed; falling back to queue: %s", exc)

    queued = await enqueue_job(
        "market-research",
        {
            "task": "marketing-benchmark",
            "competitors": req.competitors,
            "user_id": current_user.get("id"),
            "workspace_id": current_user.get("id"),
            "current_user": {"id": current_user.get("id")},
        },
        company_id=current_user.get("id"),
        window_seconds=300,
    )

    if queued.get("queued"):
        return {
            'status': 'queued',
            'job_type': 'market-research',
            'job_id': queued.get('job_id'),
            'task': 'marketing-benchmark',
        }

    return {'status': 'error', 'message': 'Unable to queue benchmark job'}


@router.get("/marketing/benchmark/latest")
async def get_latest_benchmark(current_user: dict = Depends(get_current_user)):
    """Get latest marketing benchmark for user."""
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.table('marketing_benchmarks') \
            .select('*') \
            .eq('tenant_id', current_user['id']) \
            .eq('is_current', True) \
            .single().execute()
        return result.data if result.data else {'status': 'no_benchmark'}
    except Exception:
        return {'status': 'no_benchmark'}


def _format_legacy_scores_payload(benchmark: dict) -> dict:
    if not benchmark or benchmark.get('status') == 'no_benchmark':
        return {'status': 'no_benchmark', 'scores': None}

    scores = benchmark.get('scores') or {}
    overall = scores.get('overall')
    return {
        'status': 'ok',
        'scores': scores,
        'overall_score': round(float(overall) * 100) if overall is not None else None,
        'competitors': benchmark.get('competitors') or [],
        'summary': benchmark.get('summary'),
        'updated_at': benchmark.get('updated_at') or benchmark.get('created_at'),
    }


@router.get("/competitive-benchmark/scores")
async def get_competitive_benchmark_scores(current_user: dict = Depends(get_current_user)):
    """Backward-compatible endpoint used by older clients/tests."""
    latest = await get_latest_benchmark(current_user)
    return _format_legacy_scores_payload(latest)


@router.post("/competitive-benchmark/refresh")
async def refresh_competitive_benchmark(current_user: dict = Depends(get_current_user)):
    """Backward-compatible refresh endpoint.

    Reuses last known competitor domains (if any) and forces a fresh benchmark run.
    """
    latest = await get_latest_benchmark(current_user)
    competitors = []
    if isinstance(latest, dict):
        for c in latest.get('competitors') or []:
            if isinstance(c, dict):
                domain = c.get('domain') or c.get('name')
            else:
                domain = c
            if domain:
                competitors.append(str(domain))

    # Deduplicate and cap competitor list.
    deduped = []
    for comp in competitors:
        norm = comp.strip()
        if norm and norm not in deduped:
            deduped.append(norm)
    req = BenchmarkRequest(competitors=deduped[:5])

    result = await run_benchmark(req, current_user)
    if result.get('status') in {'complete', 'queued'}:
        # Try to return latest stable score payload when available.
        refreshed = await get_latest_benchmark(current_user)
        payload = _format_legacy_scores_payload(refreshed)
        if payload.get('status') == 'ok':
            payload['refresh_status'] = result.get('status')
            return payload
    return _format_legacy_scores_payload(result if isinstance(result, dict) else {})
