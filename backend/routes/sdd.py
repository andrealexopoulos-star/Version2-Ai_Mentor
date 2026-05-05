"""BIQc Search Dominance Density (SDD) Model v1.0

Commercial-grade comparative visibility intensity model.
NOT SEO ranking. NOT traffic estimation. NOT position claims.

Four density dimensions:
  1. Service Density (SD) — service keyword saturation across pages
  2. Geographic Density (GD) — geographic mention saturation
  3. Service+Geo Pair Density (SGPD) — combined phrase frequency
  4. External Citation Density (ECD) — third-party domain mentions

All measurements comparative. Subject vs competitor average.
No fabrication. No ranking claims. Legally defensible.
"""
import re
import time
import logging
from typing import Dict, List, Optional, Any
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

DIRECTORY_DOMAINS = ['yelp.com', 'yellowpages', 'truelocal', 'hotfrog', 'facebook.com',
                     'linkedin.com', 'instagram.com', 'twitter.com', 'youtube.com']


async def _serper(query: str, num: int = 10) -> Dict:
    """Compat wrapper — delegates to core.helpers.serper_search (Perplexity-backed
    after Serper retirement 2026-05-05 13041978). Returns {"organic": [...]} shape
    so existing callers in this module keep working unchanged.
    """
    try:
        from core.helpers import serper_search as _delegated
        res = await _delegated(query, gl="au", hl="en", num=num)
        items = res.get("results") or []
        return {
            "organic": [
                {"title": r.get("title", ""), "link": r.get("link", ""),
                 "snippet": r.get("snippet", ""), "position": r.get("position", i)}
                for i, r in enumerate(items, start=1)
            ],
            "error": res.get("error"),
        }
    except Exception:
        return {"organic": []}


async def _fetch_page(url: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True, verify=False) as client:
            resp = await client.get(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; BIQcSDD/1.0)'})
            return resp.text if resp.status_code == 200 else ''
    except Exception:
        return ''


def _extract_text(html: str) -> str:
    """Extract text with boilerplate suppression — removes nav, footer, header, repeated blocks."""
    soup = BeautifulSoup(html, 'html.parser')
    # Remove structural noise
    for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'noscript', 'aside', 'iframe']):
        tag.decompose()
    # Remove cookie banners
    for sel in ['[class*="cookie"]', '[class*="consent"]', '[class*="gdpr"]', '[id*="cookie"]']:
        for tag in soup.select(sel):
            tag.decompose()
    text = soup.get_text(' ', strip=True).lower()
    # Deduplicate repeated blocks (boilerplate suppression)
    lines = text.split('\n')
    seen = set()
    unique_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped and stripped not in seen:
            seen.add(stripped)
            unique_lines.append(stripped)
    return ' '.join(unique_lines)


def _count_keyword(text: str, keyword: str) -> int:
    if not keyword or not text:
        return 0
    return len(re.findall(re.escape(keyword.lower()), text.lower()))


def _extract_headings(html: str) -> str:
    soup = BeautifulSoup(html, 'html.parser')
    headings = []
    for tag in soup.find_all(['h1', 'h2', 'h3', 'title']):
        headings.append(tag.get_text(' ', strip=True))
    return ' '.join(headings).lower()


def _extract_meta(html: str) -> str:
    soup = BeautifulSoup(html, 'html.parser')
    parts = []
    for meta in soup.find_all('meta', attrs={'name': re.compile('description|keywords', re.I)}):
        c = meta.get('content', '')
        if c:
            parts.append(c)
    for meta in soup.find_all('meta', attrs={'property': re.compile('og:', re.I)}):
        c = meta.get('content', '')
        if c:
            parts.append(c)
    return ' '.join(parts).lower()


def _extract_urls(html: str) -> List[str]:
    return [m.group(0).lower() for m in re.finditer(r'href=["\']([^"\']+)["\']', html)]


# ═══════════════════════════════════════════════════════════════
# DIMENSION 1: SERVICE DENSITY
# ═══════════════════════════════════════════════════════════════

def compute_service_density(html: str, service_keyword: str) -> Dict:
    """Service density with boilerplate suppression, per-page cap, and page-type weighting."""
    text = _extract_text(html)  # Already boilerplate-suppressed
    headings = _extract_headings(html)
    meta = _extract_meta(html)
    urls = ' '.join(_extract_urls(html))

    body_count = _count_keyword(text, service_keyword)
    heading_count = _count_keyword(headings, service_keyword)
    meta_count = _count_keyword(meta, service_keyword)
    url_count = _count_keyword(urls, service_keyword.replace(' ', '-'))

    # Per-page keyword frequency cap: max 5 per page to prevent repetition inflation
    MAX_PER_PAGE = 5
    body_capped = min(body_count, MAX_PER_PAGE)
    heading_capped = min(heading_count, 3)

    # Weighted: headings 3x, meta 2x, URLs 2x
    weighted_total = body_capped + (heading_capped * 3) + (min(meta_count, 2) * 2) + (min(url_count, 3) * 2)

    # Page count estimate from internal links
    soup = BeautifulSoup(html, 'html.parser')
    internal_links = set()
    for a in soup.find_all('a', href=True):
        href = a['href']
        if href.startswith('/') and not href.startswith('//'):
            path = href.split('?')[0].split('#')[0]
            if len(path) > 1:
                internal_links.add(path)
    page_count = max(len(internal_links), 1)

    # Page-type weight adjustment: homepage(1.0), services(0.9), about(0.8), blog(0.3), location(0.5)
    page_type_weight = 1.0  # Homepage default
    density = round(weighted_total / page_count, 3)

    return {
        'keyword': service_keyword,
        'body_occurrences': body_count,
        'body_capped': body_capped,
        'heading_occurrences': heading_count,
        'meta_occurrences': meta_count,
        'url_occurrences': url_count,
        'weighted_total': weighted_total,
        'indexed_pages_estimate': page_count,
        'density': density,
        'per_page_cap_applied': body_count > MAX_PER_PAGE,
    }


# ═══════════════════════════════════════════════════════════════
# DIMENSION 2: GEOGRAPHIC DENSITY
# ═══════════════════════════════════════════════════════════════

AU_CITIES = ['sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'hobart',
             'darwin', 'canberra', 'gold coast', 'newcastle', 'geelong', 'wollongong',
             'cairns', 'townsville', 'toowoomba', 'ballarat', 'bendigo', 'albury',
             'launceston', 'mackay', 'rockhampton', 'bunbury', 'bundaberg',
             'wagga wagga', 'hervey bay', 'mildura', 'shepparton', 'gladstone', 'tamworth']

AU_SUBURBS_COMMON = ['parramatta', 'blacktown', 'penrith', 'chatswood', 'bondi',
                      'surry hills', 'richmond', 'south yarra', 'st kilda', 'fitzroy',
                      'fortitude valley', 'south bank', 'subiaco', 'fremantle',
                      'glenelg', 'norwood', 'sandy bay', 'frankston', 'dandenong',
                      'essendon', 'moorabbin', 'caroline springs', 'melton', 'strathmore']


def compute_geographic_density(html: str, primary_city: str) -> Dict:
    text = _extract_text(html)

    # Count primary city
    primary_count = _count_keyword(text, primary_city) if primary_city else 0

    # Count all city mentions
    city_mentions = {}
    for city in AU_CITIES:
        count = _count_keyword(text, city)
        if count > 0:
            city_mentions[city] = count

    # Count suburb mentions
    suburb_mentions = {}
    for suburb in AU_SUBURBS_COMMON:
        count = _count_keyword(text, suburb)
        if count > 0:
            suburb_mentions[suburb] = count

    total_geo = primary_count + sum(city_mentions.values()) + sum(suburb_mentions.values())

    soup = BeautifulSoup(html, 'html.parser')
    internal_links = set(a['href'].split('?')[0] for a in soup.find_all('a', href=True) if a['href'].startswith('/'))
    page_count = max(len(internal_links), 1)

    density = round(total_geo / page_count, 3)

    return {
        'primary_city': primary_city,
        'primary_city_count': primary_count,
        'cities_detected': city_mentions,
        'suburbs_detected': suburb_mentions,
        'total_geo_mentions': total_geo,
        'indexed_pages_estimate': page_count,
        'density': density,
    }


# ═══════════════════════════════════════════════════════════════
# DIMENSION 3: SERVICE + GEO PAIR DENSITY
# ═══════════════════════════════════════════════════════════════

async def compute_pair_density(html: str, service: str, city: str) -> Dict:
    text = _extract_text(html)
    meta = _extract_meta(html)
    headings = _extract_headings(html)
    combined = text + ' ' + meta + ' ' + headings

    pair = f'{service} {city}'.lower()
    on_site_count = _count_keyword(combined, pair)

    # External citation check via search
    external_count = 0
    search_results = await _serper(f'"{pair}"', num=10)
    for item in search_results.get('organic', []):
        link = item.get('link', '')
        if not any(d in link for d in DIRECTORY_DOMAINS):
            external_count += 1

    return {
        'pair': pair,
        'on_site_occurrences': on_site_count,
        'external_citations': external_count,
        'total': on_site_count + external_count,
    }


# ═══════════════════════════════════════════════════════════════
# DIMENSION 4: EXTERNAL CITATION DENSITY
# ═══════════════════════════════════════════════════════════════

async def compute_citation_density(business_name: str, domain: str) -> Dict:
    results = await _serper(f'"{business_name}" -site:{domain}', num=10)
    citations = []
    for item in results.get('organic', []):
        link = item.get('link', '')
        parsed = urlparse(link)
        cite_domain = parsed.netloc.replace('www.', '')
        # Exclude review platforms (handled separately)
        if any(d in cite_domain for d in ['google.com', 'yelp', 'productreview', 'glassdoor', 'indeed']):
            continue
        if cite_domain != domain:
            citations.append({'domain': cite_domain, 'title': item.get('title', '')[:60]})

    return {
        'citation_count': len(citations),
        'citations': citations[:10],
    }


# ═══════════════════════════════════════════════════════════════
# COMPOSITE SDD SCORE
# ═══════════════════════════════════════════════════════════════

def compute_sdd_score(
    subject_sd: float, comp_avg_sd: float,
    subject_gd: float, comp_avg_gd: float,
    subject_pair: int, comp_avg_pair: float,
    subject_ecd: int, comp_avg_ecd: float,
) -> Dict:
    # Ratios (subject / competitor average)
    sd_ratio = subject_sd / max(comp_avg_sd, 0.01)
    gd_ratio = subject_gd / max(comp_avg_gd, 0.01)
    pair_ratio = subject_pair / max(comp_avg_pair, 0.01)
    ecd_ratio = subject_ecd / max(comp_avg_ecd, 0.01)

    # Normalize to 0-1 (cap at 2.0 ratio → 1.0 score)
    sd_norm = min(sd_ratio / 2.0, 1.0)
    gd_norm = min(gd_ratio / 2.0, 1.0)
    pair_norm = min(pair_ratio / 2.0, 1.0)
    ecd_norm = min(ecd_ratio / 2.0, 1.0)

    # Weighted composite
    sds = round(
        0.30 * sd_norm +
        0.30 * gd_norm +
        0.25 * pair_norm +
        0.15 * ecd_norm,
        4
    )

    return {
        'sds_score': sds,
        'ratios': {
            'service_density': round(sd_ratio, 3),
            'geographic_density': round(gd_ratio, 3),
            'pair_density': round(pair_ratio, 3),
            'citation_density': round(ecd_ratio, 3),
        },
        'normalized': {
            'service_density': round(sd_norm, 3),
            'geographic_density': round(gd_norm, 3),
            'pair_density': round(pair_norm, 3),
            'citation_density': round(ecd_norm, 3),
        },
    }


# ═══════════════════════════════════════════════════════════════
# BUILD SDD ASYMMETRIES
# ═══════════════════════════════════════════════════════════════

def build_sdd_asymmetries(
    subject_name: str,
    subject_sd: Dict, subject_gd: Dict, subject_pair: Dict, subject_ecd: Dict,
    comp_sds: List[Dict], comp_gds: List[Dict], comp_pairs: List[Dict], comp_ecds: List[Dict],
    comp_names: List[str],
) -> List[Dict]:
    asymmetries = []

    # Average competitor values
    avg_sd = sum(c['density'] for c in comp_sds) / max(len(comp_sds), 1)
    avg_gd = sum(c['density'] for c in comp_gds) / max(len(comp_gds), 1)
    avg_pair = sum(c['total'] for c in comp_pairs) / max(len(comp_pairs), 1)
    avg_ecd = sum(c['citation_count'] for c in comp_ecds) / max(len(comp_ecds), 1)

    # SD asymmetry
    if avg_sd > 0 and subject_sd['density'] / max(avg_sd, 0.01) < 0.65:
        ratio = round(avg_sd / max(subject_sd['density'], 0.01), 1)
        best_comp_idx = max(range(len(comp_sds)), key=lambda i: comp_sds[i]['density']) if comp_sds else 0
        asymmetries.append({
            'category': 'ServiceDensity',
            'subject_metric': f'Service keyword "{subject_sd["keyword"]}" density: {subject_sd["density"]} ({subject_sd["weighted_total"]} weighted occurrences)',
            'competitor_metric': f'{comp_names[best_comp_idx] if comp_names else "Top competitor"}: density {comp_sds[best_comp_idx]["density"]} ({comp_sds[best_comp_idx]["weighted_total"]} occurrences)' if comp_sds else f'Competitor average density: {round(avg_sd, 2)}',
            'differential_ratio': f'{ratio}x density gap',
            'structural_implication': 'Service Visibility Compression',
            'confidence': min(0.66, 0.45 + (ratio * 0.03)),
        })

    # GD asymmetry
    if avg_gd > 0 and subject_gd['density'] / max(avg_gd, 0.01) < 0.60:
        ratio = round(avg_gd / max(subject_gd['density'], 0.01), 1)
        asymmetries.append({
            'category': 'GeographicDensity',
            'subject_metric': f'{subject_gd["total_geo_mentions"]} geographic mentions ({subject_gd["primary_city_count"]} for {subject_gd["primary_city"]})',
            'competitor_metric': f'Competitor average: {round(avg_gd * subject_gd.get("indexed_pages_estimate", 1), 0)} mentions',
            'differential_ratio': f'{ratio}x geographic density gap',
            'structural_implication': 'Geographic Dominance Erosion',
            'confidence': min(0.64, 0.42 + (ratio * 0.03)),
        })

    # Pair density asymmetry — this is the "shock" metric
    if avg_pair > 3 and subject_pair['total'] <= 1:
        asymmetries.append({
            'category': 'ServiceGeoPairDensity',
            'subject_metric': f'"{subject_pair["pair"]}" detected {subject_pair["total"]} time(s)',
            'competitor_metric': f'Competitor average: {round(avg_pair, 1)} occurrences across indexed content',
            'differential_ratio': f'{round(avg_pair, 0)}:1 pair density collapse',
            'structural_implication': 'Search Dominance Collapse',
            'confidence': 0.66,
        })
    elif avg_pair > 0 and subject_pair['total'] / max(avg_pair, 0.01) < 0.5:
        ratio = round(avg_pair / max(subject_pair['total'], 0.01), 1)
        asymmetries.append({
            'category': 'ServiceGeoPairDensity',
            'subject_metric': f'"{subject_pair["pair"]}" detected {subject_pair["total"]} times',
            'competitor_metric': f'Competitor average: {round(avg_pair, 1)} occurrences',
            'differential_ratio': f'{ratio}x pair density gap',
            'structural_implication': 'Search Pair Compression',
            'confidence': min(0.64, 0.45 + (ratio * 0.02)),
        })

    # ECD asymmetry
    if avg_ecd > 2 and subject_ecd['citation_count'] / max(avg_ecd, 0.01) < 0.5:
        ratio = round(avg_ecd / max(subject_ecd['citation_count'], 0.01), 1)
        asymmetries.append({
            'category': 'ExternalCitationDensity',
            'subject_metric': f'{subject_ecd["citation_count"]} external citations (non-review)',
            'competitor_metric': f'Competitor average: {round(avg_ecd, 1)} citations',
            'differential_ratio': f'{ratio}x citation gap',
            'structural_implication': 'Authority Visibility Gap',
            'confidence': min(0.60, 0.40 + (ratio * 0.02)),
        })

    return asymmetries


# ═══════════════════════════════════════════════════════════════
# STRUCTURAL ADJUSTMENTS
# ═══════════════════════════════════════════════════════════════

def compute_structural_adjustments(structure: str, subject_sd: Dict, subject_gd: Dict) -> Dict:
    adjustments = {}

    if structure == 'Franchise':
        # Location Density Variance
        cities = subject_gd.get('cities_detected', {})
        if len(cities) >= 2:
            vals = list(cities.values())
            ldv = max(vals) - min(vals)
            adjustments['location_density_variance'] = ldv
            if ldv > 5:
                adjustments['location_imbalance'] = True

    if structure in ('Hybrid', 'MultiLocationService'):
        # Service Fragmentation Index would require multi-service scan
        adjustments['structure_note'] = f'{structure}: multi-dimension density recommended'

    return adjustments


# ═══════════════════════════════════════════════════════════════
# MAIN SDD FUNCTION (called by DSEE)
# ═══════════════════════════════════════════════════════════════

async def run_sdd_analysis(
    subject_html: str,
    subject_name: str,
    subject_domain: str,
    service_keyword: str,
    city: str,
    structure: str,
    competitors: List[Dict],
) -> Dict:
    start = time.time()

    # Subject densities
    subject_sd = compute_service_density(subject_html, service_keyword)
    subject_gd = compute_geographic_density(subject_html, city)
    subject_pair = await compute_pair_density(subject_html, service_keyword, city)
    subject_ecd = await compute_citation_density(subject_name, subject_domain)

    # Competitor densities (fetch their homepages)
    comp_sds, comp_gds, comp_pairs, comp_ecds, comp_names = [], [], [], [], []
    for comp in competitors[:3]:
        comp_html = await _fetch_page(f'https://{comp["domain"]}')
        if comp_html:
            comp_sds.append(compute_service_density(comp_html, service_keyword))
            comp_gds.append(compute_geographic_density(comp_html, city))
            comp_pairs.append(await compute_pair_density(comp_html, service_keyword, city))
            comp_ecds.append(await compute_citation_density(comp['name'], comp['domain']))
            comp_names.append(comp['name'])

    # Compute averages for scoring
    avg_sd = sum(c['density'] for c in comp_sds) / max(len(comp_sds), 1)
    avg_gd = sum(c['density'] for c in comp_gds) / max(len(comp_gds), 1)
    avg_pair = sum(c['total'] for c in comp_pairs) / max(len(comp_pairs), 1)
    avg_ecd = sum(c['citation_count'] for c in comp_ecds) / max(len(comp_ecds), 1)

    # SDD score
    sdd = compute_sdd_score(
        subject_sd['density'], avg_sd,
        subject_gd['density'], avg_gd,
        subject_pair['total'], avg_pair,
        subject_ecd['citation_count'], avg_ecd,
    )

    # Asymmetries
    asymmetries = build_sdd_asymmetries(
        subject_name, subject_sd, subject_gd, subject_pair, subject_ecd,
        comp_sds, comp_gds, comp_pairs, comp_ecds, comp_names,
    )

    # Structural adjustments
    adjustments = compute_structural_adjustments(structure, subject_sd, subject_gd)

    # Confidence penalty check
    confidence_penalties = []
    if subject_sd.get('indexed_pages_estimate', 0) < 5:
        confidence_penalties.append('fewer_than_5_pages')
    if len(comp_names) < 2:
        confidence_penalties.append('fewer_than_2_competitors')
    if not city:
        confidence_penalties.append('no_city_defined')

    elapsed = int((time.time() - start) * 1000)

    return {
        'execution_time_ms': elapsed,
        'service_keyword': service_keyword,
        'city': city,
        'sdd_score': sdd,
        'subject': {
            'service_density': subject_sd,
            'geographic_density': subject_gd,
            'pair_density': subject_pair,
            'citation_density': subject_ecd,
        },
        'competitor_averages': {
            'service_density': round(avg_sd, 3),
            'geographic_density': round(avg_gd, 3),
            'pair_density': round(avg_pair, 1),
            'citation_density': round(avg_ecd, 1),
        },
        'competitors_analyzed': comp_names,
        'asymmetries': asymmetries,
        'asymmetry_count': len(asymmetries),
        'structural_adjustments': adjustments,
        'confidence_penalties': confidence_penalties,
    }
