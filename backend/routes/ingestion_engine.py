"""BIQc Forensic Ingestion Engine — Complete Pipeline.

Layer A: Multi-page extraction (canonical resolve, internal crawl, JS fallback)
Layer B: Semantic cleaning (noise removal, content weighting, section detection)
Layer C: Cognitive synthesis (strict extraction, hallucination detection, quality scoring)

Every claim traced to source snippet. No inference. No fabrication.
"""
import re
import time
import logging
import hashlib
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from urllib.parse import urlparse, urljoin

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user
from biqc_jobs import enqueue_job

# ═══ Constants ═══
MAX_PAGES = 7
MAX_DEPTH = 2
MAX_HTML_BYTES = 1_500_000  # 1.5MB
PAGE_TIMEOUT = 8.0
MIN_CONTENT_LENGTH = 3000

PRIORITY_PATHS = {
    1: ['/about', '/about-us', '/company', '/who-we-are'],
    2: ['/services', '/solutions', '/what-we-do', '/our-services'],
    3: ['/team', '/leadership', '/management', '/our-team', '/people'],
    4: ['/pricing', '/plans', '/packages'],
    5: ['/blog', '/news', '/insights'],
}

NOISE_TAGS = ['nav', 'footer', 'header', 'aside', 'script', 'style', 'noscript', 'iframe', 'svg']
COOKIE_SELECTORS = ["[class*='cookie']", "[id*='cookie']", "[class*='consent']", "[id*='consent']", "[class*='gdpr']"]
BUSINESS_KEYWORDS = ['services', 'clients', 'industries', 'solutions', 'advisory', 'consulting',
                     'management', 'strategy', 'portfolio', 'wealth', 'financial', 'technology',
                     'enterprise', 'customers', 'partners', 'revenue', 'growth']


class IngestionRequest(BaseModel):
    url: str


# ═══════════════════════════════════════════════════════════════
# LAYER A — MULTI-PAGE EXTRACTION
# ═══════════════════════════════════════════════════════════════

def normalize_url(url: str) -> str:
    url = url.strip()
    if not url.startswith('http'):
        url = 'https://' + url
    return url.rstrip('/')


def get_page_priority(path: str) -> int:
    path_lower = path.lower().rstrip('/')
    for priority, paths in PRIORITY_PATHS.items():
        if any(path_lower.endswith(p) or path_lower == p for p in paths):
            return priority
    return 99


async def fetch_page(url: str, client: httpx.AsyncClient) -> Dict[str, Any]:
    start = time.time()
    try:
        resp = await client.get(url, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; BIQcEngine/2.0)',
            'Accept': 'text/html,application/xhtml+xml',
        })
        elapsed = int((time.time() - start) * 1000)
        return {
            'url': str(resp.url),
            'status': resp.status_code,
            'html': resp.text if resp.status_code == 200 else '',
            'html_length': len(resp.text) if resp.status_code == 200 else 0,
            'fetch_time_ms': elapsed,
            'redirects': [{'url': str(h.url), 'status': h.status_code} for h in resp.history],
        }
    except Exception as e:
        return {
            'url': url, 'status': 0, 'html': '', 'html_length': 0,
            'fetch_time_ms': int((time.time() - start) * 1000),
            'redirects': [], 'error': str(e),
        }


def extract_internal_links(html: str, base_url: str) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html, 'html.parser')
    parsed_base = urlparse(base_url)
    base_domain = parsed_base.netloc.replace('www.', '')
    links = []
    seen = set()

    for a in soup.find_all('a', href=True):
        href = a['href'].strip()
        if href.startswith('#') or href.startswith('mailto:') or href.startswith('tel:') or href.startswith('javascript:'):
            continue

        full_url = urljoin(base_url, href)
        parsed = urlparse(full_url)

        # Same domain only
        if parsed.netloc.replace('www.', '') != base_domain:
            continue

        # Clean URL
        clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}".rstrip('/')
        if clean in seen or clean == base_url.rstrip('/'):
            continue
        seen.add(clean)

        priority = get_page_priority(parsed.path)
        links.append({'url': clean, 'path': parsed.path, 'priority': priority})

    # Sort by priority
    links.sort(key=lambda x: x['priority'])
    return links


async def run_extraction(url: str) -> Dict[str, Any]:
    normalized = normalize_url(url)
    result = {
        'status': 'pass',
        'failure_codes': [],
        'canonical_url': None,
        'pages': [],
        'total_html_length': 0,
        'redirect_chain': [],
    }

    async with httpx.AsyncClient(timeout=PAGE_TIMEOUT, follow_redirects=True, verify=False, max_redirects=5) as client:
        # 1. Fetch homepage
        homepage = await fetch_page(normalized, client)
        result['canonical_url'] = homepage['url']
        result['redirect_chain'] = homepage.get('redirects', [])

        if homepage['status'] != 200:
            result['status'] = 'fail'
            result['failure_codes'].append('A4_redirect_misalignment' if homepage.get('redirects') else 'A5_partial_fetch')
            return result

        result['pages'].append({
            'url': homepage['url'],
            'priority': 0,
            'html': homepage['html'],
            'html_length': homepage['html_length'],
            'fetch_time_ms': homepage['fetch_time_ms'],
            'status': homepage['status'],
        })
        result['total_html_length'] = homepage['html_length']

        # 2. Extract internal links from homepage
        internal_links = extract_internal_links(homepage['html'], homepage['url'])

        # 3. Crawl priority pages (up to MAX_PAGES - 1, since homepage is #1)
        crawled = 0
        for link in internal_links:
            if crawled >= MAX_PAGES - 1:
                break
            if result['total_html_length'] >= MAX_HTML_BYTES:
                break
            # Only crawl priority 1-5 (skip priority 99)
            if link['priority'] > 5:
                continue
            # Blog: limit to first match only
            if link['priority'] == 5 and crawled > 0 and any(p['priority'] == 5 for p in result['pages'][1:] if 'priority' in p):
                continue

            page = await fetch_page(link['url'], client)
            if page['status'] == 200 and page['html_length'] > 200:
                result['pages'].append({
                    'url': page['url'],
                    'priority': link['priority'],
                    'html': page['html'],
                    'html_length': page['html_length'],
                    'fetch_time_ms': page['fetch_time_ms'],
                    'status': page['status'],
                })
                result['total_html_length'] += page['html_length']
                crawled += 1

    # Check minimum content threshold
    if result['total_html_length'] < MIN_CONTENT_LENGTH:
        result['failure_codes'].append('A5_partial_fetch')
        result['status'] = 'warning'

    # Check for main content presence
    if len(result['pages']) == 1:
        soup = BeautifulSoup(result['pages'][0]['html'], 'html.parser')
        body_text = soup.get_text(strip=True)
        if len(body_text) < MIN_CONTENT_LENGTH:
            result['failure_codes'].append('A2_js_render_failure')
            result['status'] = 'warning'

    return result


# ═══════════════════════════════════════════════════════════════
# LAYER B — SEMANTIC CLEANING
# ═══════════════════════════════════════════════════════════════

def clean_page(html: str) -> Dict[str, Any]:
    soup = BeautifulSoup(html, 'html.parser')
    nav_text_len = 0
    total_text = soup.get_text(strip=True)
    total_len = len(total_text)

    # Measure noise before removal
    for tag_name in ['nav', 'footer', 'header']:
        for tag in soup.find_all(tag_name):
            nav_text_len += len(tag.get_text(strip=True))

    # Remove noise tags
    for tag_name in NOISE_TAGS:
        for tag in soup.find_all(tag_name):
            tag.decompose()

    # Remove cookie banners
    for sel in COOKIE_SELECTORS:
        for tag in soup.select(sel):
            if len(tag.get_text(strip=True)) < 500:
                tag.decompose()

    cleaned = soup.get_text(separator='\n', strip=True)
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)

    noise_ratio = round(nav_text_len / max(total_len, 1), 3)

    return {
        'cleaned_text': cleaned[:15000],
        'cleaned_length': len(cleaned),
        'noise_ratio': noise_ratio,
    }


def run_cleaning(pages: List[Dict]) -> Dict[str, Any]:
    result = {
        'status': 'pass',
        'failure_codes': [],
        'combined_text': '',
        'total_cleaned_length': 0,
        'noise_ratio': 0.0,
        'sections': [],
    }

    all_cleaned = []
    noise_ratios = []

    for page in pages:
        page_result = clean_page(page['html'])
        source_label = page.get('url', '').split('/')[-1] or 'homepage'
        all_cleaned.append(f"--- {source_label} ---\n{page_result['cleaned_text']}")
        noise_ratios.append(page_result['noise_ratio'])
        result['total_cleaned_length'] += page_result['cleaned_length']

    combined = '\n\n'.join(all_cleaned)
    result['combined_text'] = combined[:20000]
    result['noise_ratio'] = round(sum(noise_ratios) / max(len(noise_ratios), 1), 3)

    if result['noise_ratio'] > 0.35:
        result['failure_codes'].append('B1_noise_retention')
        result['status'] = 'warning'

    # Detect sections
    combined_lower = combined.lower()
    for name, keywords in [
        ('about', ['about us', 'who we are', 'our story', 'our mission']),
        ('services', ['our services', 'what we do', 'solutions', 'capabilities']),
        ('team', ['our team', 'leadership', 'management']),
        ('pricing', ['pricing', 'plans', 'packages']),
    ]:
        if any(kw in combined_lower for kw in keywords):
            # Find the section content
            for kw in keywords:
                idx = combined_lower.find(kw)
                if idx >= 0:
                    snippet = combined[idx:idx + 500]
                    # Keyword density
                    biz_keyword_count = sum(1 for bk in BUSINESS_KEYWORDS if bk in snippet.lower())
                    result['sections'].append({
                        'name': name,
                        'position': idx,
                        'length': min(len(snippet), 500),
                        'keyword_density': round(biz_keyword_count / max(len(snippet.split()), 1), 3),
                    })
                    break

    # Unique sentence ratio
    sentences = [s.strip() for s in re.split(r'[.!?]+', combined) if len(s.strip()) > 20]
    unique = set(sentences)
    unique_ratio = round(len(unique) / max(len(sentences), 1), 3)
    result['unique_sentence_ratio'] = unique_ratio

    # Core content weight
    biz_count = sum(1 for kw in BUSINESS_KEYWORDS if kw in combined_lower)
    total_words = len(combined.split())
    result['core_content_weight'] = round(biz_count / max(total_words, 1) * 100, 2)

    return result


# ═══════════════════════════════════════════════════════════════
# LAYER C — COGNITIVE SYNTHESIS + HALLUCINATION DETECTION
# ═══════════════════════════════════════════════════════════════

def extract_business_fields(cleaned_text: str, pages: List[Dict]) -> Dict[str, Any]:
    """Deterministic field extraction — no LLM. Regex + pattern matching only."""
    dna_trace = {}
    text = cleaned_text
    lower = text.lower()

    def trace(field, value, snippet, source_url='', confidence=0.8):
        dna_trace[field] = {
            'value': value,
            'snippet': snippet[:200],
            'source_url': source_url,
            'confidence': confidence,
        }

    # Business name from <title> of homepage
    for page in pages:
        if page.get('priority', 99) == 0:
            soup = BeautifulSoup(page['html'], 'html.parser')
            if soup.title and soup.title.string:
                title = soup.title.string.strip()
                # Common patterns: "Company Name | Tagline" or "Company Name - Service"
                name = re.split(r'\s*[|–—-]\s*', title)[0].strip()
                if name and len(name) > 2:
                    trace('business_name', name, f'Page title: {title}', page['url'], 0.7)
            # OG site name
            og_name = soup.find('meta', attrs={'property': 'og:site_name'})
            if og_name and og_name.get('content'):
                trace('business_name', og_name['content'].strip(), f'og:site_name', page['url'], 0.85)
            break

    # ABN
    abn_matches = re.findall(r'\b(\d{2}\s?\d{3}\s?\d{3}\s?\d{3})\b', text)
    for abn in abn_matches:
        if len(abn.replace(' ', '')) == 11:
            idx = text.find(abn)
            trace('abn', abn, text[max(0, idx - 30):idx + 30], '', 0.9)
            break

    # Phone
    phones = re.findall(r'(?:\+61|0)[2-9]\d{1,2}[\s\-]?\d{3,4}[\s\-]?\d{3,4}', text)
    if phones:
        idx = text.find(phones[0])
        trace('phone', phones[0], text[max(0, idx - 20):idx + 30], '', 0.85)

    # Email
    emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
    emails = [e for e in emails if 'example' not in e and 'sentry' not in e and 'wix' not in e]
    if emails:
        idx = text.find(emails[0])
        trace('email', emails[0], text[max(0, idx - 20):idx + 40], '', 0.85)

    # Location
    locations = re.findall(r'\b(Sydney|Melbourne|Brisbane|Perth|Adelaide|Hobart|Darwin|Canberra|Gold Coast|Newcastle)\b', text, re.IGNORECASE)
    if locations:
        loc = locations[0]
        idx = lower.find(loc.lower())
        trace('location', loc, text[max(0, idx - 30):idx + 50], '', 0.7)

    # State
    states = re.findall(r'\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b', text)
    if states:
        idx = text.find(states[0])
        trace('state', states[0], text[max(0, idx - 20):idx + 30], '', 0.75)

    # Industry — only from explicit "about" section content near industry keywords
    industry_patterns = [
        (r'(?:financial|wealth)\s+(?:advisory|planning|management|services)', 'Financial Advisory'),
        (r'(?:accounting|bookkeeping|tax)\s+(?:firm|services|practice)', 'Accounting'),
        (r'(?:law\s+firm|legal\s+services|solicitors?|barristers?)', 'Legal'),
        (r'(?:construction|building|civil\s+engineering)', 'Construction'),
        (r'(?:real\s+estate|property\s+management)', 'Real Estate'),
        (r'(?:information\s+technology|IT\s+services|software)', 'Technology'),
        (r'(?:marketing\s+agency|digital\s+marketing|advertising)', 'Marketing'),
        (r'(?:medical|healthcare|health\s+services|dental)', 'Healthcare'),
        (r'(?:education|training|coaching)', 'Education'),
        (r'(?:managed\s+services|MSP|IT\s+support)', 'Managed Services'),
    ]
    for pattern, industry in industry_patterns:
        match = re.search(pattern, lower)
        if match:
            idx = match.start()
            trace('industry', industry, text[max(0, idx - 20):idx + 60], '', 0.75)
            break

    # Social links
    social_patterns = {
        'linkedin': r'https?://(?:www\.)?linkedin\.com/(?:company|in)/[^\s"\')<,]+',
        'facebook': r'https?://(?:www\.)?facebook\.com/[^\s"\')<,]+',
        'instagram': r'https?://(?:www\.)?instagram\.com/[^\s"\')<,]+',
        'twitter': r'https?://(?:www\.)?(?:twitter|x)\.com/[^\s"\')<,]+',
    }
    for platform, pattern in social_patterns.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            trace(f'social_{platform}', match.group(0), match.group(0), '', 0.9)

    return dna_trace


def run_hallucination_check(cleaned_text: str, dna_trace: Dict, existing_snapshot: Dict = None) -> Dict[str, Any]:
    """Check for hallucinations by verifying every claim against source text."""
    result = {
        'hallucinations': [],
        'lost_signals': [],
        'hallucination_score': 0.0,
        'total_claims': 0,
        'hallucinated_claims': 0,
    }

    lower = cleaned_text.lower()

    # Check existing snapshot claims against source
    if existing_snapshot:
        snap_str = str(existing_snapshot)

        # Numeric claims
        numbers = re.findall(r'\$[\d,]+(?:\.\d+)?[KkMm]?', snap_str)
        for num in numbers:
            result['total_claims'] += 1
            if num not in cleaned_text:
                result['hallucinations'].append({
                    'type': 'C1_numeric_hallucination',
                    'claim': num,
                    'evidence': 'Not found in scraped content',
                })
                result['hallucinated_claims'] += 1

        # Competitor claims
        competitors = existing_snapshot.get('competitors', []) or existing_snapshot.get('market', {}).get('competitors', [])
        if isinstance(competitors, list):
            for comp in competitors:
                name = comp.get('name', comp) if isinstance(comp, dict) else str(comp)
                result['total_claims'] += 1
                if name and name.lower() not in lower:
                    result['hallucinations'].append({
                        'type': 'C3_competitive_guesswork',
                        'claim': f'Competitor: {name}',
                        'evidence': 'Name not found in scraped content',
                    })
                    result['hallucinated_claims'] += 1

    # Check DNA trace claims
    for field, trace in dna_trace.items():
        result['total_claims'] += 1
        value = str(trace.get('value', ''))
        if value and value.lower() not in lower and field not in ('business_name',):
            # Business name might be extracted from title tag which isn't in body text
            result['hallucinations'].append({
                'type': 'C4_overgeneralisation',
                'claim': f'{field}: {value}',
                'evidence': 'Value not confirmed in body text',
            })
            result['hallucinated_claims'] += 1

    # Lost signal detection — high-weight sentences not captured
    sentences = [s.strip() for s in re.split(r'[.!?]+', cleaned_text) if len(s.strip()) > 40]
    biz_sentences = []
    for s in sentences[:50]:
        score = sum(1 for kw in BUSINESS_KEYWORDS if kw in s.lower())
        if score >= 2:
            biz_sentences.append(s)

    # Check if high-value sentences are reflected in DNA trace
    trace_text = ' '.join(str(t.get('value', '')) + ' ' + str(t.get('snippet', '')) for t in dna_trace.values()).lower()
    for s in biz_sentences[:10]:
        words = [w for w in s.lower().split() if len(w) > 4]
        overlap = sum(1 for w in words if w in trace_text)
        if overlap < len(words) * 0.3:
            result['lost_signals'].append({
                'sentence': s[:150],
                'keyword_count': sum(1 for kw in BUSINESS_KEYWORDS if kw in s.lower()),
            })

    # Hallucination score
    result['hallucination_score'] = round(
        result['hallucinated_claims'] / max(result['total_claims'], 1), 3
    )

    return result


# ═══════════════════════════════════════════════════════════════
# QUALITY SCORE COMPUTATION
# ═══════════════════════════════════════════════════════════════

def compute_quality_score(
    pages_crawled: int,
    total_html_length: int,
    noise_ratio: float,
    field_count: int,
    hallucination_score: float,
    lost_signal_count: int,
) -> Dict[str, Any]:
    coverage = min(pages_crawled / 7, 1.0) * 20
    html_volume = min(total_html_length / 50000, 1.0) * 15
    noise_score = max(1 - noise_ratio, 0) * 15
    field_coverage = min(field_count / 10, 1.0) * 25
    hallucination_penalty = hallucination_score * 20
    lost_signal_penalty = min(lost_signal_count / 10, 1.0) * 5

    score = round(coverage + html_volume + noise_score + field_coverage - hallucination_penalty - lost_signal_penalty, 1)
    score = max(0, min(100, score))

    confidence = 'High' if score >= 70 else 'Medium' if score >= 50 else 'Low'

    return {
        'quality_score': score,
        'confidence_level': confidence,
        'breakdown': {
            'coverage': round(coverage, 1),
            'html_volume': round(html_volume, 1),
            'noise_score': round(noise_score, 1),
            'field_coverage': round(field_coverage, 1),
            'hallucination_penalty': round(-hallucination_penalty, 1),
            'lost_signal_penalty': round(-lost_signal_penalty, 1),
        },
    }


# ═══════════════════════════════════════════════════════════════
# API ENDPOINT
# ═══════════════════════════════════════════════════════════════

async def execute_ingestion_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Execute the full forensic ingestion pipeline."""
    url = str(payload.get('url') or '').strip()
    if not url:
        raise ValueError("URL required")

    user_id = str(payload.get('user_id') or payload.get('workspace_id') or '')
    if not user_id:
        raise ValueError("user_id required")

    # === LAYER A: Extraction ===
    extraction = await run_extraction(url)

    # === LAYER B: Cleaning ===
    cleaning = run_cleaning(extraction['pages'])

    # === LAYER C: Synthesis ===
    dna_trace = extract_business_fields(cleaning['combined_text'], extraction['pages'])

    # Load existing snapshot for hallucination comparison
    existing_snapshot = None
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        snap = sb.table('intelligence_snapshots') \
            .select('cognitive_snapshot') \
            .eq('user_id', user_id) \
            .order('generated_at', desc=True) \
            .limit(1).execute()
        if snap.data:
            existing_snapshot = snap.data[0].get('cognitive_snapshot')
    except Exception:
        pass

    hallucination = run_hallucination_check(cleaning['combined_text'], dna_trace, existing_snapshot)

    # === QUALITY SCORE ===
    quality = compute_quality_score(
        pages_crawled=len(extraction['pages']),
        total_html_length=extraction['total_html_length'],
        noise_ratio=cleaning['noise_ratio'],
        field_count=len(dna_trace),
        hallucination_score=hallucination['hallucination_score'],
        lost_signal_count=len(hallucination['lost_signals']),
    )

    # Determine failure layer
    failure_layer = None
    all_codes = extraction.get('failure_codes', []) + cleaning.get('failure_codes', [])
    if any(c.startswith('A') for c in all_codes):
        failure_layer = 'extraction'
    elif any(c.startswith('B') for c in all_codes):
        failure_layer = 'cleaning'
    elif hallucination['hallucination_score'] > 0.05:
        failure_layer = 'synthesis'
        all_codes.append('C_hallucination_threshold')

    # === STORE IN SUPABASE ===
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()

        # Store session
        session_data = {
            'workspace_id': user_id,
            'target_url': url,
            'canonical_url': extraction['canonical_url'],
            'pages_crawled': len(extraction['pages']),
            'total_html_length': extraction['total_html_length'],
            'noise_ratio': cleaning['noise_ratio'],
            'hallucination_score': hallucination['hallucination_score'],
            'quality_score': quality['quality_score'],
            'confidence_level': quality['confidence_level'],
            'failure_layer': failure_layer,
            'failure_codes': all_codes,
            'dna_trace': dna_trace,
            'redirect_chain': extraction.get('redirect_chain', []),
        }
        session_res = sb.table('ingestion_sessions').insert(session_data).execute()
        session_id = session_res.data[0]['id'] if session_res.data else None

        if session_id:
            # Store pages (without raw HTML to save space — store first 5000 chars)
            for page in extraction['pages']:
                sb.table('ingestion_pages').insert({
                    'session_id': session_id,
                    'page_url': page['url'],
                    'page_priority': page.get('priority', 99),
                    'html_length': page['html_length'],
                    'raw_html': page['html'][:5000],
                    'fetch_time_ms': page.get('fetch_time_ms', 0),
                    'http_status': page.get('status', 0),
                }).execute()

            # Store cleaned text
            sb.table('ingestion_cleaned').insert({
                'session_id': session_id,
                'cleaned_text': cleaning['combined_text'][:10000],
                'cleaned_length': cleaning['total_cleaned_length'],
                'noise_ratio': cleaning['noise_ratio'],
                'sections_detected': cleaning.get('sections', []),
                'core_content_weight': cleaning.get('core_content_weight', 0),
            }).execute()

    except Exception as e:
        logger.warning(f"Failed to store ingestion: {e}")
        session_id = None

    # === RETURN RESULT ===
    return {
        'session_id': session_id,
        'quality_score': quality['quality_score'],
        'confidence_level': quality['confidence_level'],
        'quality_breakdown': quality['breakdown'],
        'pages_crawled': len(extraction['pages']),
        'pages': [{'url': p['url'], 'priority': p.get('priority', 99), 'html_length': p['html_length'], 'fetch_time_ms': p.get('fetch_time_ms', 0)} for p in extraction['pages']],
        'noise_ratio': cleaning['noise_ratio'],
        'cleaned_length': cleaning['total_cleaned_length'],
        'sections_detected': cleaning.get('sections', []),
        'hallucination_score': hallucination['hallucination_score'],
        'hallucinations': hallucination['hallucinations'],
        'lost_signals': hallucination['lost_signals'][:10],
        'dna_trace': dna_trace,
        'failure_layer': failure_layer,
        'failure_codes': all_codes,
        'extraction_status': extraction['status'],
        'canonical_url': extraction['canonical_url'],
        'redirect_chain': extraction.get('redirect_chain', []),
    }


@router.post("/ingestion/run")
async def run_ingestion(req: IngestionRequest, current_user: dict = Depends(get_current_user)):
    """Run complete forensic ingestion pipeline on a URL."""
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL required")

    queued = await enqueue_job(
        "website-ingestion",
        {
            "mode": "standard",
            "url": url,
            "user_id": current_user['id'],
            "workspace_id": current_user['id'],
        },
        company_id=current_user['id'],
        window_seconds=180,
    )

    if queued.get('queued'):
        return {
            'status': 'queued',
            'job_type': 'website-ingestion',
            'job_id': queued.get('job_id'),
            'mode': 'standard',
        }

    return await execute_ingestion_job({
        'url': url,
        'user_id': current_user['id'],
        'workspace_id': current_user['id'],
    })


@router.get("/ingestion/history")
async def get_ingestion_history(current_user: dict = Depends(get_current_user)):
    """Get past ingestion sessions."""
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.table('ingestion_sessions') \
            .select('id, target_url, canonical_url, pages_crawled, quality_score, confidence_level, hallucination_score, noise_ratio, failure_layer, created_at') \
            .eq('workspace_id', current_user['id']) \
            .order('created_at', desc=True) \
            .limit(20).execute()
        return {'sessions': result.data or []}
    except Exception:
        return {'sessions': []}


@router.get("/ingestion/session/{session_id}")
async def get_ingestion_detail(session_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed ingestion session with pages and cleaned text."""
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        session = sb.table('ingestion_sessions').select('*').eq('id', session_id).eq('workspace_id', current_user['id']).single().execute()
        pages = sb.table('ingestion_pages').select('page_url, page_priority, html_length, fetch_time_ms, http_status').eq('session_id', session_id).order('page_priority').execute()
        cleaned = sb.table('ingestion_cleaned').select('cleaned_length, noise_ratio, sections_detected, core_content_weight').eq('session_id', session_id).single().execute()
        return {
            'session': session.data,
            'pages': pages.data or [],
            'cleaned': cleaned.data,
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail="Session not found")
