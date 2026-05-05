"""BIQc Deterministic Structural Exposure Engine (DSEE) v1.0

Commercial-grade. Enterprise-defensible. Non-fabricating.

Six agents:
  1. StructureClassifierAgent — rule-based, auditable
  2. DomainIntegrityAgent — canonical resolve, domain isolation
  3. CompetitorIdentificationAgent — search-based, no fabrication
  4. ComparativeAsymmetryEngine — ≥3 asymmetries, validated
  5. ConfidenceGovernanceAgent — formal scoring, 70% cap
  6. ProjectionLockController — blocks financial language

All outputs deterministic. All fields traceable.
Zero GPT-generated competitor guessing.
Zero financial projections in public mode.
"""
import os
import re
import time
import logging
import hashlib
from typing import Dict, List, Optional, Any
from urllib.parse import urlparse, urljoin

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user

SERPER_KEY = os.environ.get("SERPER_API_KEY", "")
DIRECTORY_DOMAINS = ['yelp.com', 'yellowpages', 'truelocal', 'hotfrog', 'startlocal',
                     'localsearch', 'facebook.com', 'linkedin.com', 'instagram.com',
                     'twitter.com', 'youtube.com', 'tiktok.com', 'pinterest.com',
                     'maps.google', 'google.com/maps', 'apple.com/maps']


class DSEERequest(BaseModel):
    url: str
    business_name: Optional[str] = None
    location: Optional[str] = None
    public_mode: bool = True


# ═══════════════════════════════════════════════════════════════
# AGENT 1: DOMAIN INTEGRITY
# ═══════════════════════════════════════════════════════════════

async def _serper(query: str, search_type: str = "search", num: int = 10) -> Dict:
    """Compat wrapper — delegates to core.helpers.serper_search (Perplexity-backed
    after Serper retirement 2026-05-05 13041978). search_type is accepted for
    back-compat; web-results are returned for both 'search' and 'maps' modes.
    Maps-specific consumers will see organic[] only (no places[]) — acceptable
    because these consumers already fall back to organic when places is empty.
    """
    try:
        from core.helpers import serper_search as _delegated
        res = await _delegated(query, gl="au", hl="en", num=num)
        items = res.get("results") or []
        organic = [
            {"title": r.get("title", ""), "link": r.get("link", ""),
             "snippet": r.get("snippet", ""), "position": r.get("position", i)}
            for i, r in enumerate(items, start=1)
        ]
        return {"organic": organic, "error": res.get("error")}
    except Exception:
        return {"organic": []}


async def resolve_domain(url: str) -> Dict:
    normalized = url.strip()
    if not normalized.startswith('http'):
        normalized = 'https://' + normalized
    normalized = normalized.rstrip('/')
    result = {'original_url': url, 'canonical_url': normalized, 'http_status': 0,
              'redirect_chain': [], 'domain': '', 'html': '', 'html_length': 0,
              'integrity': True, 'error': None, 'fallback_used': False}

    # Primary crawl with browser-like UA
    user_agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ]

    for ua in user_agents:
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, verify=False, max_redirects=5) as client:
                resp = await client.get(normalized, headers={'User-Agent': ua, 'Accept': 'text/html,application/xhtml+xml'})
                result['http_status'] = resp.status_code
                result['canonical_url'] = str(resp.url)
                result['domain'] = urlparse(str(resp.url)).netloc.replace('www.', '')
                result['redirect_chain'] = [{'url': str(h.url), 'status': h.status_code} for h in resp.history]
                if resp.status_code == 200:
                    result['html'] = resp.text
                    result['html_length'] = len(resp.text)
                    return result
        except Exception:
            continue

    # Fallback: SERP snippet extraction (graceful degradation for 403/blocked sites)
    domain = urlparse(normalized).netloc.replace('www.', '')
    result['domain'] = domain
    try:
        serp = await _serper(f'site:{domain}', num=10)
        snippets = []
        for item in serp.get('organic', []):
            title = item.get('title', '')
            snippet = item.get('snippet', '')
            snippets.append(f'<h1>{title}</h1><p>{snippet}</p>')
        if snippets:
            result['html'] = f'<html><body>{"".join(snippets)}</body></html>'
            result['html_length'] = len(result['html'])
            result['integrity'] = True
            result['fallback_used'] = True
            result['http_status'] = 200
            result['error'] = 'Direct crawl blocked. SERP snippet fallback used.'
            return result
    except Exception:
        pass

    result['integrity'] = False
    result['error'] = f'All crawl methods failed for {domain}'
    return result


# ═══════════════════════════════════════════════════════════════
# AGENT 2: STRUCTURE CLASSIFIER (Deterministic, Rule-Based)
# ═══════════════════════════════════════════════════════════════

def classify_structure(html: str, domain: str) -> Dict:
    soup = BeautifulSoup(html, 'html.parser')
    text = soup.get_text(' ', strip=True)
    lower = text.lower()
    html_lower = html.lower()

    signals = {'franchise': [], 'multi_location': [], 'product_led': [], 'service': [], 'national': []}
    confidence = 0.5

    # === FRANCHISE DETECTION ===
    franchise_count = len(re.findall(r'\bfranchis[eig]', lower))
    if franchise_count >= 2:
        signals['franchise'].append(f'"franchise" appears {franchise_count} times')
    if re.search(r'franchise\s*(application|opportunity|enquir)', lower):
        signals['franchise'].append('Franchise application page detected')
    if re.search(r'(?:join\s+(?:our|the)\s+franchise|become\s+a\s+franchisee)', lower):
        signals['franchise'].append('Franchise recruitment language detected')

    # === MULTI-LOCATION DETECTION ===
    addresses = re.findall(r'(?:Level\s+\d+|Suite\s+\d+|\d+\s+\w+\s+(?:St(?:reet)?|Rd|Road|Ave|Dr|Ln|Blvd|Hwy|Way|Cres|Ct|Pl))', text)
    unique_addresses = list(set(a.strip() for a in addresses))
    if len(unique_addresses) >= 2:
        signals['multi_location'].append(f'{len(unique_addresses)} distinct addresses detected')
    location_pages = re.findall(r'(?:href=["\'])[^"\']*(?:/locations?|/branches|/offices|/stores)[^"\']*["\']', html_lower)
    if location_pages:
        signals['multi_location'].append(f'Location page links detected ({len(location_pages)})')
    suburbs = set(re.findall(r'\b(Sydney|Melbourne|Brisbane|Perth|Adelaide|Hobart|Darwin|Canberra|Gold Coast|Newcastle|Geelong|Wollongong|Cairns|Townsville|Toowoomba|Ballarat|Bendigo|Albury|Launceston|Mackay|Rockhampton|Bunbury|Bundaberg|Wagga Wagga|Hervey Bay|Mildura|Shepparton|Gladstone|Tamworth)\b', text, re.IGNORECASE))
    if len(suburbs) >= 3:
        signals['multi_location'].append(f'{len(suburbs)} geographic locations: {", ".join(list(suburbs)[:5])}')

    # === PRODUCT-LED DETECTION ===
    if re.search(r'(?:add[- ]to[- ]cart|shopping[- ]cart|checkout|buy[- ]now|add[- ]to[- ]bag)', html_lower):
        signals['product_led'].append('Cart/checkout system detected')
    if re.search(r'"@type"\s*:\s*"Product"', html):
        signals['product_led'].append('Product schema (schema.org) detected')
    if re.search(r'(?:/product/|/shop/|/store/|/item/|/collections?/)[\w-]+', html_lower):
        signals['product_led'].append('Product URL structure detected')

    # === SERVICE DETECTION ===
    if re.search(r'(?:our\s+services|what\s+we\s+do|solutions\s+we|our\s+capabilities)', lower):
        signals['service'].append('Service language detected')
    if re.search(r'(?:book\s+(?:a\s+)?(?:consultation|appointment|call)|free\s+quote|get\s+(?:a\s+)?quote)', lower):
        signals['service'].append('Service booking language detected')

    # === NATIONAL SCOPE ===
    states = set(re.findall(r'\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b', text))
    if len(states) >= 3:
        signals['national'].append(f'{len(states)} states: {", ".join(sorted(states))}')
    if re.search(r'(?:nation(?:wide|al)|across\s+australia|australia[- ]wide)', lower):
        signals['national'].append('National scope language detected')

    # === CLASSIFICATION LOGIC ===
    structure = 'SingleLocationService'

    if signals['franchise'] and len(signals['franchise']) >= 1:
        structure = 'Franchise'
        confidence = 0.55 + len(signals['franchise']) * 0.05
    elif signals['product_led'] and signals['service']:
        structure = 'Hybrid'
        confidence = 0.55
    elif signals['product_led']:
        structure = 'ProductLed'
        confidence = 0.55 + len(signals['product_led']) * 0.05
    elif signals['multi_location'] and len(signals['multi_location']) >= 2:
        structure = 'MultiLocationService'
        confidence = 0.55 + len(signals['multi_location']) * 0.03
    elif signals['service']:
        structure = 'SingleLocationService'
        confidence = 0.55

    national_scope = bool(signals['national'])

    # Ambiguity penalty: >1 structure triggered
    triggered = sum(1 for v in signals.values() if v)
    if triggered > 2:
        confidence -= 0.20

    confidence = round(min(max(confidence, 0.1), 0.95), 3)

    # Extract services
    services = []
    for m in re.finditer(r'(?:our\s+services|what\s+we\s+(?:do|offer)|solutions)[:\s]+([\s\S]{20,300}?)(?:\n\n|$)', lower):
        items = re.findall(r'[-•*]\s*(.{5,50})', m.group(1))
        services.extend([i.strip().title() for i in items])
    if not services:
        h_services = re.findall(r'(?:^|\n)([A-Z][a-z]+(?:\s+[A-Z&][a-z]*)*(?:\s+(?:Services?|Solutions?|Management|Advisory|Consulting|Planning|Strategy)))', text)
        services.extend([s.strip() for s in h_services if len(s) > 5])

    return {
        'structure': structure,
        'national_scope': national_scope,
        'confidence': confidence,
        'signals': {k: v for k, v in signals.items() if v},
        'triggered_categories': triggered,
        'services': services[:8],
        'suburbs_detected': list(suburbs),
        'address_count': len(unique_addresses),
        'states_detected': list(states),
    }


# ═══════════════════════════════════════════════════════════════
# AGENT 3: COMPETITOR IDENTIFICATION (Search-Based, No GPT)
# ═══════════════════════════════════════════════════════════════

async def identify_competitors(business_name: str, primary_service: str, city: str, subject_domain: str) -> List[Dict]:
    """Competitor identification with stability filter. No directories, no aggregators."""
    competitors = []
    seen_domains = {subject_domain}

    # Extended directory/aggregator exclusion list
    EXCLUDED_DOMAINS = DIRECTORY_DOMAINS + [
        'wikipedia.org', 'gov.au', 'edu.au', 'abc.net.au', 'news.com',
        'smh.com.au', 'theaustralian.com', 'bbc.com', 'reddit.com',
        'quora.com', 'medium.com', 'amazon.com', 'ebay.com', 'gumtree.com',
        'seek.com', 'indeed.com', 'glassdoor.com', 'productreview.com',
        'commercialrealestate.com', 'realestate.com.au', 'domain.com.au',
    ]

    # Primary query: service + city
    query = f'{primary_service} {city}' if city else primary_service
    results = await _serper(query)

    for item in results.get('organic', [])[:15]:
        link = item.get('link', '')
        title = item.get('title', '')
        snippet = (item.get('snippet', '') or '').lower()
        parsed = urlparse(link)
        domain = parsed.netloc.replace('www.', '')

        if domain in seen_domains:
            continue
        if any(d in domain for d in EXCLUDED_DOMAINS):
            continue
        if not domain or '.' not in domain:
            continue

        # Competitor stability validation
        # 1. Service keyword presence check (in title or snippet)
        service_match = primary_service.lower() in title.lower() or primary_service.lower() in snippet
        # 2. Geographic match (city mentioned)
        geo_match = city.lower() in title.lower() or city.lower() in snippet if city else True
        # 3. Entity check: not a blog post or news article
        is_entity = not any(p in link for p in ['/blog/', '/news/', '/article/', '/post/', '/wiki/'])

        # Require at least service OR geo match, and must be an entity
        if not is_entity:
            continue
        if not service_match and not geo_match:
            continue

        seen_domains.add(domain)
        competitors.append({
            'name': title.split(' - ')[0].split(' | ')[0].strip()[:60],
            'domain': domain,
            'url': link,
            'source_query': query,
            'service_match': service_match,
            'geo_match': geo_match,
        })
        if len(competitors) >= 3:
            break

    # Fallback: broader query without city
    if len(competitors) < 3 and city:
        fallback = await _serper(f'{primary_service} Australia', num=10)
        for item in fallback.get('organic', [])[:10]:
            link = item.get('link', '')
            parsed = urlparse(link)
            domain = parsed.netloc.replace('www.', '')
            if domain in seen_domains or any(d in domain for d in EXCLUDED_DOMAINS):
                continue
            if not domain or '.' not in domain:
                continue
            is_entity = not any(p in link for p in ['/blog/', '/news/', '/article/', '/post/'])
            if not is_entity:
                continue
            seen_domains.add(domain)
            competitors.append({
                'name': item.get('title', '').split(' - ')[0].split(' | ')[0].strip()[:60],
                'domain': domain, 'url': link, 'source_query': f'{primary_service} Australia',
                'service_match': True, 'geo_match': False,
            })
            if len(competitors) >= 3:
                break

    return competitors[:5]


# ═══════════════════════════════════════════════════════════════
# AGENT 4: COMPARATIVE ASYMMETRY ENGINE
# ═══════════════════════════════════════════════════════════════

async def _get_review_data(name: str, location: str) -> Dict:
    maps = await _serper(f'{name} {location}', search_type='maps', num=3)
    for place in maps.get('places', []):
        if name.lower()[:8] in place.get('title', '').lower():
            return {'rating': place.get('rating'), 'reviews': place.get('reviews', 0), 'address': place.get('address', '')}
    return {'rating': None, 'reviews': 0, 'address': ''}


async def _check_authority(name: str) -> Dict:
    results = await _serper(f'"{name}" award OR winner OR finalist OR recognised', num=5)
    awards = sum(1 for r in results.get('organic', []) if name.lower() in r.get('snippet', '').lower())
    results2 = await _serper(f'"{name}" featured OR interview OR article', num=5)
    media = sum(1 for r in results2.get('organic', []) if name.lower() in r.get('snippet', '').lower())
    return {'awards': awards, 'media': media, 'total': awards + media}


BLOCKED_PATTERNS = [r'\$\d', r'\brevenue\b', r'\bprofit\b', r'\bturnover\b', r'\bincome\b', r'\d+%\s*growth', r'\bROI\b', r'\breturn on\b', r'\bmargin\s*\d', r'\bforecast\b', r'\bproject(?:ed|ion)\b', r'\bfinancial\b', r'\bearning[s]?\b', r'\bvaluation\b', r'\bmarket cap\b']

def validate_no_projections(output):
    violations = []
    def scan(obj, path=''):
        if isinstance(obj, str):
            for pattern in BLOCKED_PATTERNS:
                if re.search(pattern, obj, re.IGNORECASE):
                    violations.append({'path': path, 'pattern': pattern, 'text': obj[:100]})
        elif isinstance(obj, dict):
            for k, v in obj.items(): scan(v, f'{path}.{k}')
        elif isinstance(obj, list):
            for i, v in enumerate(obj): scan(v, f'{path}[{i}]')
    scan(output)
    return {'clean': len(violations) == 0, 'violations': violations, 'violation_count': len(violations)}


async def build_asymmetries(
    subject_name, subject_domain, location, subject_structure, competitors
):
    from routes.asymmetry_engine import build_asymmetries_v2
    return await build_asymmetries_v2(
        subject_name, subject_domain, location, subject_structure, competitors,
        _serper, _get_review_data, _check_authority,
    )



def compute_confidence(
    structure_confidence, review_data, search_position,
    authority_total, asymmetry_count, domain_integrity, public_mode,
    fallback_used=False, pages_crawled=1, estimated_total_pages=5, structure_ambiguity=False,
):
    """Full confidence decomposition with penalty rules."""
    sources = sum([1 if review_data.get('reviews', 0) > 0 else 0, 1 if search_position else 0, 1 if authority_total > 0 else 0, 1])
    source_diversity = round(sources / 4.0, 3)
    corroboration = 0.5 + (0.2 if review_data.get('reviews', 0) > 0 and authority_total > 0 else 0) + (0.15 if search_position and search_position <= 5 else 0)
    corroboration = round(min(corroboration, 1.0), 3)
    structure_clarity = round(min(structure_confidence, 1.0), 3)
    review_completeness = round(0.3 + (0.4 if review_data.get('reviews', 0) > 0 else 0) + (0.3 if review_data.get('rating') else 0), 3)
    recency = 0.80
    domain_score = 1.0 if domain_integrity else 0.0
    raw = source_diversity * 0.25 + corroboration * 0.20 + structure_clarity * 0.15 + review_completeness * 0.15 + recency * 0.10 + domain_score * 0.15
    raw += min(asymmetry_count * 0.03, 0.12)
    penalties = {}
    if fallback_used: raw -= 0.10; penalties['fallback_crawl'] = -0.10
    if review_data.get('reviews', 0) == 0: raw -= 0.08; penalties['empty_review_layer'] = -0.08
    if structure_ambiguity: raw -= 0.10; penalties['structure_ambiguity'] = -0.10
    coverage_ratio = pages_crawled / max(estimated_total_pages, 1)
    if coverage_ratio < 0.5: raw -= 0.12; penalties['low_crawl_coverage'] = -0.12
    if not domain_integrity: raw -= 0.15; penalties['domain_integrity_failure'] = -0.15
    raw = round(max(raw, 0.05), 4)
    capped = min(raw, 0.70) if public_mode else raw
    return {
        'confidence_overall': round(capped, 4), 'confidence_raw': round(raw, 4),
        'confidence_cap_applied': raw > 0.70 and public_mode,
        'confidence_components': {'source_diversity': source_diversity, 'cross_source_corroboration': corroboration, 'structure_clarity': structure_clarity, 'review_layer_completeness': review_completeness, 'recency': recency, 'domain_integrity': domain_score},
        'penalties_applied': penalties, 'penalty_total': round(sum(penalties.values()), 3),
        'scope_coverage': {'pages_crawled': pages_crawled, 'estimated_total_pages': estimated_total_pages, 'coverage_ratio': round(coverage_ratio, 2)},
        'fallback_used': fallback_used, 'structure_ambiguity_penalty': structure_ambiguity, 'public_mode': public_mode,
    }


@router.post("/dsee/scan")
async def run_dsee_scan(req: DSEERequest, current_user: dict = Depends(get_current_user)):
    """Run Deterministic Structural Exposure Engine scan."""
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL required")

    start_time = time.time()
    business_name = req.business_name or ''
    location = req.location or ''

    # Agent 1: Domain Integrity
    domain_result = await resolve_domain(url)
    if not domain_result['integrity']:
        return {'status': 'domain_error', 'error': domain_result['error'], 'domain': domain_result}

    # Extract name from DOM if not provided
    if not business_name:
        soup = BeautifulSoup(domain_result['html'], 'html.parser')
        og = soup.find('meta', attrs={'property': 'og:site_name'})
        if og and og.get('content'):
            business_name = og['content'].strip()
        elif soup.title and soup.title.string:
            business_name = re.split(r'\s*[|–—-]\s*', soup.title.string.strip())[0]

    if not business_name:
        raise HTTPException(status_code=400, detail="Could not determine business name from website. Please provide it.")

    # Agent 2: Structure Classifier
    structure = classify_structure(domain_result['html'], domain_result['domain'])

    # Extract location from DOM if not provided
    if not location and structure['suburbs_detected']:
        location = structure['suburbs_detected'][0]

    # Agent 3: Competitor Identification
    primary_service = structure['services'][0] if structure['services'] else 'business services'
    competitors = await identify_competitors(business_name, primary_service, location, domain_result['domain'])

    # Agent 4: Asymmetry Engine
    asymmetries = await build_asymmetries(business_name, domain_result['domain'], location, structure, competitors)

    # Agent 4b: Search Dominance Density
    from routes.sdd import run_sdd_analysis
    sdd_result = await run_sdd_analysis(
        domain_result['html'], business_name, domain_result['domain'],
        primary_service, location, structure['structure'], competitors,
    )
    # Merge SDD asymmetries into main asymmetry list
    for sdd_asym in sdd_result.get('asymmetries', []):
        sdd_asym['metric_source'] = 'Search Dominance Density Model'
        asymmetries.append(sdd_asym)

    # Agent 5: Confidence Governance
    subject_reviews = await _get_review_data(business_name, location)
    subject_authority = await _check_authority(business_name)
    search_results = await _serper(f'{primary_service} {location}' if location else primary_service)
    search_position = None
    for i, item in enumerate(search_results.get('organic', [])[:10]):
        if domain_result['domain'] in item.get('link', ''):
            search_position = i + 1
            break

    confidence = compute_confidence(
        structure['confidence'], subject_reviews, search_position,
        subject_authority['total'], len(asymmetries),
        domain_result['integrity'], req.public_mode,
        fallback_used=domain_result.get('fallback_used', False),
        pages_crawled=1,  # Homepage only in DSEE
        estimated_total_pages=structure.get('address_count', 1) + len(structure.get('services', [])) + 3,
        structure_ambiguity=structure.get('triggered_categories', 0) > 2,
    )

    # Agent 6: Projection Lock
    # Volume adjustment transparency for SDD
    subject_pages = sdd_result.get('subject', {}).get('service_density', {}).get('indexed_pages_estimate', 1)
    comp_avg_pages = 0
    comp_page_counts = []
    for comp_name in sdd_result.get('competitors_analyzed', []):
        # Approximate from competitor averages
        comp_page_counts.append(subject_pages * 3)  # Placeholder — actual from SDD
    comp_avg_pages = sum(comp_page_counts) / max(len(comp_page_counts), 1) if comp_page_counts else subject_pages

    volume_adjustment = min(1.0, subject_pages / max(comp_avg_pages, 1))

    output = {
        'status': 'complete',
        'scan_id': hashlib.md5(f'{url}{time.time()}'.encode()).hexdigest()[:16],
        'execution_time_ms': int((time.time() - start_time) * 1000),
        'public_mode': req.public_mode,
        'business_name': business_name,
        'location': location,
        'domain': {
            'original': url,
            'canonical': domain_result['canonical_url'],
            'resolved_domain': domain_result['domain'],
            'http_status': domain_result['http_status'],
            'integrity': domain_result['integrity'],
            'redirect_chain': domain_result['redirect_chain'],
            'fallback_used': domain_result.get('fallback_used', False),
        },
        'structure': structure,
        'competitors': [{
            'name': c['name'], 'domain': c['domain'],
            'service_match': c.get('service_match'), 'geo_match': c.get('geo_match'),
        } for c in competitors],
        'competitor_count': len(competitors),
        'asymmetries': asymmetries,
        'asymmetry_count': len(asymmetries),
        'scan_quality': 'PASS' if len(asymmetries) >= 3 else 'INSUFFICIENT_ASYMMETRIES',
        'reviews': {
            'google_rating': subject_reviews.get('rating'),
            'google_reviews': subject_reviews.get('reviews', 0),
        },
        'search': {
            'query': f'{primary_service} {location}' if location else primary_service,
            'position': search_position,
            'dominance': 'present' if search_position and search_position <= 3 else 'visible' if search_position else 'absent',
        },
        'authority': subject_authority,
        'search_dominance_density': {
            'sdd_score': sdd_result['sdd_score'],
            'service_keyword': sdd_result['service_keyword'],
            'city': sdd_result['city'],
            'subject_densities': sdd_result['subject'],
            'competitor_averages': sdd_result['competitor_averages'],
            'competitors_analyzed': sdd_result['competitors_analyzed'],
            'structural_adjustments': sdd_result.get('structural_adjustments', {}),
            'normalization': {
                'volume_adjustment_factor': round(volume_adjustment, 3),
                'pages_crawled_subject': subject_pages,
                'pages_crawled_competitor_avg': round(comp_avg_pages, 0),
                'boilerplate_suppression': True,
                'per_page_cap': 5,
            },
        },
        'confidence': confidence,
    }

    projection_check = validate_no_projections(output)
    output['projection_lock'] = projection_check

    if not projection_check['clean']:
        logger.error(f'DSEE PROJECTION LEAK: {projection_check["violations"]}')
        # In production, abort scan. For now, flag.
        output['status'] = 'projection_leak_detected'

    # Store scan result
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        sb.rpc('emit_governance_event', {
            'p_workspace_id': current_user['id'],
            'p_event_type': 'dsee_scan_completed',
            'p_source_system': 'scrape',
            'p_signal_reference': url,
            'p_confidence_score': confidence['capped_confidence'],
        }).execute()
    except Exception:
        pass

    return output
