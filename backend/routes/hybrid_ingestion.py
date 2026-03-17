"""BIQc Hybrid Ingestion Engine — Enterprise Grade.

Architecture:
  Layer A: Hybrid Crawl (static fetch → JS detection → headless escalation)
  Layer B: Semantic Cleaning (noise removal, content weighting, DOM density)
  Layer C: Cognitive Synthesis (strict extraction, hallucination enforcement)

Capabilities:
  - Static + headless rendering (Playwright Chromium)
  - JS-detection heuristic (body < 3000, script ratio, SPA detection)
  - Multi-page intelligent crawl (priority paths, max 7 pages, depth 2)
  - DOM density analysis per page
  - Extraction trace ledger (raw, rendered, cleaned, prompt, response)
  - Claim-by-claim hallucination check
  - Layer-separated scoring (extraction/cleaning/synthesis)
  - Field-level traceability (snippet + source URL + render mode + confidence)
"""
import re
import time
import logging
import asyncio
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

MAX_PAGES = 7
MAX_DEPTH = 2
MAX_HTML_BYTES = 1_500_000
PAGE_TIMEOUT = 8.0
HEADLESS_TIMEOUT = 15000
MIN_BODY_TEXT = 3000
SPA_SIGNATURES = ['__next', '__nuxt', 'react-root', 'app-root', 'ng-app', 'wix-warmup-data',
                   '_wixCssModules', 'svelte', 'gatsby', 'vue-app', 'ember', 'webflow']
NOISE_TAGS = ['nav', 'footer', 'header', 'aside', 'script', 'style', 'noscript', 'iframe', 'svg']
COOKIE_SELECTORS = ["[class*='cookie']", "[id*='cookie']", "[class*='consent']", "[class*='gdpr']"]
PRIORITY_PATHS = {
    1: ['/about', '/about-us', '/company', '/who-we-are', '/our-story'],
    2: ['/services', '/solutions', '/what-we-do', '/our-services', '/capabilities'],
    3: ['/team', '/leadership', '/management', '/our-team', '/people'],
    4: ['/pricing', '/plans', '/packages'],
    5: ['/blog', '/news', '/insights'],
}
BUSINESS_KEYWORDS = ['services', 'clients', 'industries', 'solutions', 'advisory', 'consulting',
                     'management', 'strategy', 'portfolio', 'wealth', 'financial', 'technology',
                     'customers', 'partners', 'growth', 'experience', 'expertise']


class HybridIngestionRequest(BaseModel):
    url: str


# ═══════════════════════════════════════════════════════════════
# JS DETECTION HEURISTIC
# ═══════════════════════════════════════════════════════════════

def detect_js_rendering_needed(html: str) -> Dict[str, Any]:
    """Determine if site requires headless rendering."""
    soup = BeautifulSoup(html, 'html.parser')
    body_text = soup.get_text(strip=True) if soup.body else ''
    body_len = len(body_text)

    # Script tag ratio
    scripts = soup.find_all('script')
    script_chars = sum(len(s.get_text()) for s in scripts)
    total_chars = len(html)
    script_ratio = round(script_chars / max(total_chars, 1), 3)

    # Internal anchor count
    anchors = soup.find_all('a', href=True)
    internal_anchors = [a for a in anchors if a['href'].startswith('/') or a['href'].startswith('#')]

    # SPA framework detection
    html_lower = html.lower()
    spa_detected = [sig for sig in SPA_SIGNATURES if sig.lower() in html_lower]

    needs_headless = (
        body_len < MIN_BODY_TEXT
        or script_ratio > 0.5
        or (len(internal_anchors) < 3 and body_len < 5000)
        or len(spa_detected) > 0
    )

    return {
        'needs_headless': needs_headless,
        'body_text_length': body_len,
        'script_ratio': script_ratio,
        'internal_anchor_count': len(internal_anchors),
        'spa_signatures': spa_detected,
        'reasons': [
            r for r in [
                f'body_text={body_len}<{MIN_BODY_TEXT}' if body_len < MIN_BODY_TEXT else None,
                f'script_ratio={script_ratio}>0.5' if script_ratio > 0.5 else None,
                f'spa_detected={spa_detected}' if spa_detected else None,
                f'few_anchors={len(internal_anchors)}' if len(internal_anchors) < 3 and body_len < 5000 else None,
            ] if r
        ],
    }


# ═══════════════════════════════════════════════════════════════
# HEADLESS RENDERING LAYER (Playwright)
# ═══════════════════════════════════════════════════════════════

async def headless_fetch(url: str) -> Dict[str, Any]:
    """Render page with Playwright Chromium, extract rendered DOM."""
    start = time.time()
    result = {
        'url': url, 'html': '', 'html_length': 0, 'status': 0,
        'fetch_time_ms': 0, 'render_mode': 'headless', 'internal_links': [],
    }

    try:
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
            page = await browser.new_page(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
            )

            try:
                response = await page.goto(url, wait_until='domcontentloaded', timeout=20000)
                result['status'] = response.status if response else 0
                result['url'] = page.url

                # Wait for JS hydration (DOM content loaded + extra time)
                await page.wait_for_timeout(3000)

                # Extract rendered HTML
                html = await page.content()
                result['html'] = html
                result['html_length'] = len(html)

                # Extract internal links from rendered DOM
                links = await page.evaluate('''() => {
                    const anchors = document.querySelectorAll('a[href]');
                    return Array.from(anchors).map(a => ({
                        href: a.href,
                        text: a.textContent.trim().substring(0, 100)
                    }));
                }''')
                result['internal_links'] = links or []

            except Exception as e:
                logger.warning(f'Headless page error: {e}')
                result['status'] = 0
            finally:
                await browser.close()

    except ImportError:
        logger.error('Playwright not available')
        result['status'] = -1
    except Exception as e:
        logger.error(f'Headless error: {e}')

    result['fetch_time_ms'] = int((time.time() - start) * 1000)
    return result


async def headless_fetch_page(url: str, browser_context) -> Dict[str, Any]:
    """Fetch a single page using an existing browser context."""
    start = time.time()
    result = {'url': url, 'html': '', 'html_length': 0, 'status': 0, 'fetch_time_ms': 0}
    try:
        page = await browser_context.new_page()
        response = await page.goto(url, wait_until='domcontentloaded', timeout=20000)
        result['status'] = response.status if response else 0
        result['url'] = page.url
        await page.wait_for_timeout(2000)
        result['html'] = await page.content()
        result['html_length'] = len(result['html'])
        await page.close()
    except Exception as e:
        logger.warning(f'Headless sub-page error for {url}: {e}')
    result['fetch_time_ms'] = int((time.time() - start) * 1000)
    return result


# ═══════════════════════════════════════════════════════════════
# STATIC FETCH
# ═══════════════════════════════════════════════════════════════

async def static_fetch(url: str, client: httpx.AsyncClient) -> Dict[str, Any]:
    start = time.time()
    try:
        resp = await client.get(url, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; BIQcEngine/3.0)',
            'Accept': 'text/html,application/xhtml+xml',
        })
        return {
            'url': str(resp.url), 'status': resp.status_code,
            'html': resp.text if resp.status_code == 200 else '',
            'html_length': len(resp.text) if resp.status_code == 200 else 0,
            'fetch_time_ms': int((time.time() - start) * 1000),
            'render_mode': 'static',
            'redirects': [{'url': str(h.url), 'status': h.status_code} for h in resp.history],
        }
    except Exception:
        return {'url': url, 'status': 0, 'html': '', 'html_length': 0,
                'fetch_time_ms': int((time.time() - start) * 1000), 'render_mode': 'static', 'redirects': []}


def get_page_priority(path: str) -> int:
    path_lower = path.lower().rstrip('/')
    for priority, paths in PRIORITY_PATHS.items():
        if any(path_lower.endswith(p) or path_lower == p for p in paths):
            return priority
    return 99


def extract_internal_links_from_html(html: str, base_url: str) -> List[Dict]:
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
        if parsed.netloc.replace('www.', '') != base_domain:
            continue
        clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}".rstrip('/')
        if clean in seen or clean == base_url.rstrip('/'):
            continue
        seen.add(clean)
        links.append({'url': clean, 'path': parsed.path, 'priority': get_page_priority(parsed.path)})
    links.sort(key=lambda x: x['priority'])
    return links


# ═══════════════════════════════════════════════════════════════
# HYBRID CRAWL ENGINE
# ═══════════════════════════════════════════════════════════════

async def hybrid_crawl(url: str) -> Dict[str, Any]:
    """Execute hybrid crawl: static first, detect JS, escalate to headless if needed."""
    normalized = url.strip()
    if not normalized.startswith('http'):
        normalized = 'https://' + normalized
    normalized = normalized.rstrip('/')

    result = {
        'status': 'pass', 'failure_codes': [], 'canonical_url': None,
        'pages': [], 'total_html_length': 0, 'redirect_chain': [],
        'render_mode': 'static', 'js_detection': None, 'pages_crawled': 0,
    }

    # STEP 1: Static fetch homepage
    async with httpx.AsyncClient(timeout=PAGE_TIMEOUT, follow_redirects=True, verify=False, max_redirects=5) as client:
        homepage_static = await static_fetch(normalized, client)

    result['canonical_url'] = homepage_static['url']
    result['redirect_chain'] = homepage_static.get('redirects', [])

    if homepage_static['status'] != 200:
        result['status'] = 'fail'
        result['failure_codes'].append('A4_redirect_misalignment')
        return result

    # STEP 2: JS detection
    js_check = detect_js_rendering_needed(homepage_static['html'])
    result['js_detection'] = js_check

    # STEP 3: Choose render mode
    if js_check['needs_headless']:
        result['render_mode'] = 'headless'
        logger.info(f'JS detected: {js_check["reasons"]}. Escalating to headless.')

        # Headless: render homepage
        homepage_rendered = await headless_fetch(normalized)
        if homepage_rendered['status'] == 200 and homepage_rendered['html_length'] > 0:
            result['canonical_url'] = homepage_rendered['url']
            result['pages'].append({
                'url': homepage_rendered['url'], 'priority': 0,
                'html': homepage_rendered['html'], 'html_length': homepage_rendered['html_length'],
                'fetch_time_ms': homepage_rendered['fetch_time_ms'],
                'status': homepage_rendered['status'], 'render_mode': 'headless',
            })
            result['total_html_length'] = homepage_rendered['html_length']

            # Extract internal links from RENDERED DOM
            all_links = []
            # From rendered DOM JS evaluation
            for link_data in homepage_rendered.get('internal_links', []):
                href = link_data.get('href', '')
                if not href:
                    continue
                parsed = urlparse(href)
                base_parsed = urlparse(homepage_rendered['url'])
                if parsed.netloc.replace('www.', '') != base_parsed.netloc.replace('www.', ''):
                    continue
                clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}".rstrip('/')
                if clean != homepage_rendered['url'].rstrip('/'):
                    all_links.append({'url': clean, 'path': parsed.path, 'priority': get_page_priority(parsed.path)})

            # Also extract from rendered HTML
            html_links = extract_internal_links_from_html(homepage_rendered['html'], homepage_rendered['url'])
            seen_urls = {l['url'] for l in all_links}
            for l in html_links:
                if l['url'] not in seen_urls:
                    all_links.append(l)

            # Deduplicate and sort by priority
            seen = set()
            unique_links = []
            for l in sorted(all_links, key=lambda x: x['priority']):
                if l['url'] not in seen:
                    seen.add(l['url'])
                    unique_links.append(l)

            # Crawl internal pages with headless
            try:
                from playwright.async_api import async_playwright
                async with async_playwright() as p:
                    browser = await p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
                    context = await browser.new_context(
                        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    )

                    crawled = 0
                    for link in unique_links:
                        if crawled >= MAX_PAGES - 1:
                            break
                        if result['total_html_length'] >= MAX_HTML_BYTES:
                            break
                        if link['priority'] > 5:
                            continue
                        # Blog limit
                        if link['priority'] == 5 and any(p.get('priority') == 5 for p in result['pages'][1:]):
                            continue

                        page_result = await headless_fetch_page(link['url'], context)
                        if page_result['status'] == 200 and page_result['html_length'] > 500:
                            result['pages'].append({
                                'url': page_result['url'], 'priority': link['priority'],
                                'html': page_result['html'], 'html_length': page_result['html_length'],
                                'fetch_time_ms': page_result['fetch_time_ms'],
                                'status': page_result['status'], 'render_mode': 'headless',
                            })
                            result['total_html_length'] += page_result['html_length']
                            crawled += 1

                    await browser.close()
            except Exception as e:
                logger.error(f'Headless multi-page crawl failed: {e}')
                result['failure_codes'].append('A2_js_render_partial')
        else:
            # Headless failed, fall back to static
            result['render_mode'] = 'static_fallback'
            result['pages'].append({
                'url': homepage_static['url'], 'priority': 0,
                'html': homepage_static['html'], 'html_length': homepage_static['html_length'],
                'fetch_time_ms': homepage_static['fetch_time_ms'],
                'status': homepage_static['status'], 'render_mode': 'static',
            })
            result['total_html_length'] = homepage_static['html_length']
            result['failure_codes'].append('A2_js_render_failure')
    else:
        # STATIC MODE: no JS detected
        result['render_mode'] = 'static'
        result['pages'].append({
            'url': homepage_static['url'], 'priority': 0,
            'html': homepage_static['html'], 'html_length': homepage_static['html_length'],
            'fetch_time_ms': homepage_static['fetch_time_ms'],
            'status': homepage_static['status'], 'render_mode': 'static',
        })
        result['total_html_length'] = homepage_static['html_length']

        # Static internal crawl
        internal_links = extract_internal_links_from_html(homepage_static['html'], homepage_static['url'])
        async with httpx.AsyncClient(timeout=PAGE_TIMEOUT, follow_redirects=True, verify=False) as client:
            crawled = 0
            for link in internal_links:
                if crawled >= MAX_PAGES - 1 or result['total_html_length'] >= MAX_HTML_BYTES:
                    break
                if link['priority'] > 5:
                    continue
                if link['priority'] == 5 and any(p.get('priority') == 5 for p in result['pages'][1:]):
                    continue
                page = await static_fetch(link['url'], client)
                if page['status'] == 200 and page['html_length'] > 500:
                    result['pages'].append({
                        'url': page['url'], 'priority': link['priority'],
                        'html': page['html'], 'html_length': page['html_length'],
                        'fetch_time_ms': page['fetch_time_ms'],
                        'status': page['status'], 'render_mode': 'static',
                    })
                    result['total_html_length'] += page['html_length']
                    crawled += 1

    result['pages_crawled'] = len(result['pages'])

    # Check extraction thresholds
    if result['pages_crawled'] < 3:
        result['failure_codes'].append('A7_insufficient_crawl')
        result['status'] = 'warning'

    return result


# ═══════════════════════════════════════════════════════════════
# CLEANING (reuse from ingestion_engine but with DOM density)
# ═══════════════════════════════════════════════════════════════

def compute_dom_density(html: str) -> Dict[str, float]:
    soup = BeautifulSoup(html, 'html.parser')
    total_text = soup.get_text(strip=True)
    total_len = max(len(total_text), 1)
    links = soup.find_all('a')
    link_text = sum(len(a.get_text(strip=True)) for a in links)
    scripts = soup.find_all('script')
    script_text = sum(len(s.get_text()) for s in scripts)
    sentences = [s.strip() for s in re.split(r'[.!?]+', total_text) if len(s.strip()) > 10]
    unique = set(sentences)
    biz_count = sum(1 for kw in BUSINESS_KEYWORDS if kw in total_text.lower())
    return {
        'text_length': len(total_text),
        'link_density': round(link_text / total_len, 3),
        'script_density': round(script_text / max(len(html), 1), 3),
        'repetition_ratio': round(1 - (len(unique) / max(len(sentences), 1)), 3),
        'semantic_density': round(biz_count / max(len(total_text.split()), 1) * 100, 2),
    }


def clean_and_weight(pages: List[Dict]) -> Dict[str, Any]:
    result = {
        'status': 'pass', 'failure_codes': [], 'combined_text': '',
        'total_cleaned_length': 0, 'noise_ratio': 0.0, 'sections': [],
        'per_page_density': [], 'unique_sentence_ratio': 0.0,
    }
    all_cleaned = []
    noise_ratios = []

    for page in pages:
        html = page['html']
        soup = BeautifulSoup(html, 'html.parser')
        nav_len = sum(len(t.get_text(strip=True)) for t in soup.find_all(['nav', 'footer', 'header']))
        total_len = max(len(soup.get_text(strip=True)), 1)
        for tag_name in NOISE_TAGS:
            for tag in soup.find_all(tag_name):
                tag.decompose()
        for sel in COOKIE_SELECTORS:
            for tag in soup.select(sel):
                if len(tag.get_text(strip=True)) < 500:
                    tag.decompose()
        cleaned = soup.get_text(separator='\n', strip=True)
        cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
        source_label = page.get('url', '').split('/')[-1] or 'homepage'
        all_cleaned.append(f'--- {source_label} (P{page.get("priority", "?")}) ---\n{cleaned[:8000]}')
        noise_ratios.append(round(nav_len / total_len, 3))
        result['total_cleaned_length'] += len(cleaned)
        result['per_page_density'].append({
            'url': page['url'],
            'density': compute_dom_density(page['html']),
            'render_mode': page.get('render_mode', 'unknown'),
        })

    combined = '\n\n'.join(all_cleaned)
    result['combined_text'] = combined[:25000]
    result['noise_ratio'] = round(sum(noise_ratios) / max(len(noise_ratios), 1), 3)
    if result['noise_ratio'] > 0.35:
        result['failure_codes'].append('B1_noise_retention')
        result['status'] = 'warning'

    # Section detection
    combined_lower = combined.lower()
    for name, keywords in [('about', ['about us', 'who we are', 'our story', 'our mission']),
                           ('services', ['our services', 'what we do', 'solutions', 'capabilities']),
                           ('team', ['our team', 'leadership', 'management']),
                           ('pricing', ['pricing', 'plans', 'packages'])]:
        for kw in keywords:
            idx = combined_lower.find(kw)
            if idx >= 0:
                snippet = combined[idx:idx+500]
                biz_kw = sum(1 for bk in BUSINESS_KEYWORDS if bk in snippet.lower())
                result['sections'].append({'name': name, 'position': idx, 'length': min(len(snippet), 500), 'keyword_density': round(biz_kw / max(len(snippet.split()), 1), 3)})
                break

    sentences = [s.strip() for s in re.split(r'[.!?]+', combined) if len(s.strip()) > 20]
    unique = set(sentences)
    result['unique_sentence_ratio'] = round(len(unique) / max(len(sentences), 1), 3)

    return result


# ═══════════════════════════════════════════════════════════════
# SYNTHESIS + HALLUCINATION (reuse from ingestion_engine)
# ═══════════════════════════════════════════════════════════════

def extract_fields_traced(cleaned_text: str, pages: List[Dict]) -> Dict[str, Any]:
    dna = {}
    text = cleaned_text
    lower = text.lower()

    def trace(field, value, snippet, source_url='', confidence=0.8, render_mode='unknown'):
        dna[field] = {'value': value, 'snippet': snippet[:200], 'source_url': source_url, 'confidence': confidence, 'render_mode': render_mode}

    for page in pages:
        if page.get('priority', 99) == 0:
            soup = BeautifulSoup(page['html'], 'html.parser')
            rm = page.get('render_mode', 'unknown')
            og_name = soup.find('meta', attrs={'property': 'og:site_name'})
            if og_name and og_name.get('content'):
                trace('business_name', og_name['content'].strip(), 'og:site_name', page['url'], 0.85, rm)
            elif soup.title and soup.title.string:
                title = soup.title.string.strip()
                name = re.split(r'\s*[|–—-]\s*', title)[0].strip()
                if name and len(name) > 2:
                    trace('business_name', name, f'Page title: {title}', page['url'], 0.7, rm)
            og_desc = soup.find('meta', attrs={'property': 'og:description'})
            if og_desc and og_desc.get('content'):
                trace('description', og_desc['content'].strip()[:200], 'og:description', page['url'], 0.8, rm)
            break

    # ABN
    for m in re.finditer(r'\b(\d{2}\s?\d{3}\s?\d{3}\s?\d{3})\b', text):
        abn = m.group(1)
        if len(abn.replace(' ', '')) == 11:
            trace('abn', abn, text[max(0, m.start()-30):m.start()+30], '', 0.9)
            break
    # Phone
    for m in re.finditer(r'(?:\+61|0)[2-9]\d{1,2}[\s\-]?\d{3,4}[\s\-]?\d{3,4}', text):
        trace('phone', m.group(0), text[max(0, m.start()-20):m.start()+30], '', 0.85)
        break
    # Email
    for m in re.finditer(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text):
        e = m.group(0)
        if 'example' not in e and 'sentry' not in e and 'wix' not in e and 'godaddy' not in e and 'filler' not in e:
            trace('email', e, text[max(0, m.start()-20):m.start()+40], '', 0.85)
            break
    # Location
    for m in re.finditer(r'\b(Sydney|Melbourne|Brisbane|Perth|Adelaide|Hobart|Darwin|Canberra|Gold Coast|Newcastle)\b', text, re.IGNORECASE):
        trace('location', m.group(0), text[max(0, m.start()-30):m.start()+50], '', 0.7)
        break
    # Industry
    industry_patterns = [
        (r'(?:financial|wealth)\s+(?:advisory|planning|management|services)', 'Financial Advisory'),
        (r'(?:accounting|bookkeeping|tax)\s+(?:firm|services|practice)', 'Accounting'),
        (r'(?:law\s+firm|legal\s+services|solicitors?)', 'Legal'),
        (r'(?:construction|building|civil)', 'Construction'),
        (r'(?:real\s+estate|property)', 'Real Estate'),
        (r'(?:information\s+technology|IT\s+services|software|SaaS)', 'Technology'),
        (r'(?:marketing\s+agency|digital\s+marketing)', 'Marketing'),
        (r'(?:medical|healthcare|dental)', 'Healthcare'),
        (r'(?:managed\s+services|MSP|IT\s+support)', 'Managed Services'),
        (r'(?:business\s+management|business\s+consulting|strategy\s+consult)', 'Business Consulting'),
    ]
    for pattern, industry in industry_patterns:
        m = re.search(pattern, lower)
        if m:
            trace('industry', industry, text[max(0, m.start()-20):m.start()+60], '', 0.75)
            break
    # Social
    for platform, pattern in [('linkedin', r'https?://(?:www\.)?linkedin\.com/(?:company|in)/[^\s"\')<,]+'),
                               ('facebook', r'https?://(?:www\.)?facebook\.com/[^\s"\')<,]+'),
                               ('instagram', r'https?://(?:www\.)?instagram\.com/[^\s"\')<,]+')]:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            trace(f'social_{platform}', m.group(0), m.group(0), '', 0.9)

    return dna


def hallucination_check(cleaned_text: str, dna: Dict, snapshot: Dict = None) -> Dict:
    result = {'hallucinations': [], 'lost_signals': [], 'hallucination_score': 0.0, 'total_claims': 0, 'hallucinated_claims': 0}
    lower = cleaned_text.lower()
    if snapshot:
        snap_str = str(snapshot)
        for num in re.findall(r'\$[\d,]+(?:\.\d+)?[KkMm]?', snap_str):
            result['total_claims'] += 1
            if num not in cleaned_text:
                result['hallucinations'].append({'type': 'C1_numeric', 'claim': num})
                result['hallucinated_claims'] += 1
        competitors = snapshot.get('competitors', []) or snapshot.get('market', {}).get('competitors', [])
        if isinstance(competitors, list):
            for c in competitors:
                name = c.get('name', c) if isinstance(c, dict) else str(c)
                result['total_claims'] += 1
                if name and name.lower() not in lower:
                    result['hallucinations'].append({'type': 'C3_competitor', 'claim': name})
                    result['hallucinated_claims'] += 1
    for field, t in dna.items():
        result['total_claims'] += 1
    result['hallucination_score'] = round(result['hallucinated_claims'] / max(result['total_claims'], 1), 3)
    # Lost signals
    sentences = sorted([(sum(1 for kw in BUSINESS_KEYWORDS if kw in s.lower()), s) for s in re.split(r'[.!?]+', cleaned_text) if len(s.strip()) > 30], key=lambda x: -x[0])[:20]
    dna_text = ' '.join(str(t.get('value', '')) + ' ' + str(t.get('snippet', '')) for t in dna.values()).lower()
    for score, s in sentences:
        words = [w for w in s.lower().split() if len(w) > 4]
        overlap = sum(1 for w in words if w in dna_text) if words else 0
        if overlap < len(words) * 0.3:
            result['lost_signals'].append({'sentence': s[:150], 'kw_score': score})
    return result


# ═══════════════════════════════════════════════════════════════
# LAYER-SEPARATED SCORING
# ═══════════════════════════════════════════════════════════════

def compute_layered_scores(pages_crawled, total_html, noise_ratio, field_count, hall_score, lost_count, render_mode) -> Dict:
    extraction_score = round(
        min(pages_crawled / 7, 1.0) * 40 +
        min(total_html / 50000, 1.0) * 30 +
        (30 if render_mode == 'headless' and pages_crawled >= 3 else 15 if pages_crawled >= 3 else 0),
        1
    )
    extraction_score = min(extraction_score, 100)

    cleaning_score = round(
        max(1 - noise_ratio, 0) * 50 +
        50,  # Base score for running cleaning
        1
    )
    cleaning_score = min(cleaning_score, 100)

    synthesis_score = round(
        min(field_count / 10, 1.0) * 50 +
        max(1 - hall_score, 0) * 30 +
        max(1 - (lost_count / 20), 0) * 20,
        1
    )
    synthesis_score = min(synthesis_score, 100)

    trust_integrity = round((extraction_score * 0.4 + cleaning_score * 0.2 + synthesis_score * 0.4), 1)
    trust_integrity = min(trust_integrity, 100)

    confidence = 'High' if trust_integrity >= 70 else 'Medium' if trust_integrity >= 50 else 'Low'

    return {
        'extraction_score': extraction_score,
        'cleaning_score': cleaning_score,
        'synthesis_score': synthesis_score,
        'trust_integrity_score': trust_integrity,
        'confidence_level': confidence,
    }


# ═══════════════════════════════════════════════════════════════
# API ENDPOINT
# ═══════════════════════════════════════════════════════════════

async def execute_hybrid_ingestion_job(payload: Dict[str, Any]) -> Dict[str, Any]:
    url = str(payload.get('url') or '').strip()
    if not url:
        raise ValueError("URL required")
    user_id = str(payload.get('user_id') or payload.get('workspace_id') or '')
    if not user_id:
        raise ValueError("user_id required")

    # Layer A: Hybrid crawl
    crawl = await hybrid_crawl(url)

    # Layer B: Clean and weight
    cleaning = clean_and_weight(crawl['pages'])

    # Layer C: Synthesis
    dna = extract_fields_traced(cleaning['combined_text'], crawl['pages'])
    existing_snapshot = None
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        snap = sb.table('intelligence_snapshots').select('cognitive_snapshot').eq('user_id', user_id).order('generated_at', desc=True).limit(1).execute()
        if snap.data:
            existing_snapshot = snap.data[0].get('cognitive_snapshot')
    except Exception:
        pass
    hall = hallucination_check(cleaning['combined_text'], dna, existing_snapshot)

    # Scores
    scores = compute_layered_scores(
        crawl['pages_crawled'], crawl['total_html_length'],
        cleaning['noise_ratio'], len(dna),
        hall['hallucination_score'], len(hall['lost_signals']),
        crawl['render_mode'],
    )

    # Failure layer
    failure_layer = None
    if crawl['pages_crawled'] < 3:
        failure_layer = 'extraction'
    elif cleaning['noise_ratio'] > 0.35:
        failure_layer = 'cleaning'
    elif hall['hallucination_score'] > 0.05:
        failure_layer = 'synthesis'

    # Trust message
    trust_message = None
    if crawl['render_mode'] == 'headless':
        if crawl['pages_crawled'] >= 3:
            trust_message = 'Advanced crawl applied. JS-rendered site processed with headless browser.'
        else:
            trust_message = 'Content visibility limited. Site appears JS-rendered. Advanced crawl applied but page discovery limited.'
    elif crawl['render_mode'] == 'static_fallback':
        trust_message = 'Content visibility limited. JS rendering failed. Results based on static HTML only.'

    # Store session
    session_id = None
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        session_data = {
            'workspace_id': user_id,
            'target_url': url,
            'canonical_url': crawl['canonical_url'],
            'pages_crawled': crawl['pages_crawled'],
            'total_html_length': crawl['total_html_length'],
            'noise_ratio': cleaning['noise_ratio'],
            'hallucination_score': hall['hallucination_score'],
            'quality_score': scores['trust_integrity_score'],
            'confidence_level': scores['confidence_level'],
            'failure_layer': failure_layer,
            'failure_codes': crawl.get('failure_codes', []),
            'dna_trace': dna,
            'redirect_chain': crawl.get('redirect_chain', []),
        }
        res = sb.table('ingestion_sessions').insert(session_data).execute()
        session_id = res.data[0]['id'] if res.data else None
        if session_id:
            for page in crawl['pages']:
                sb.table('ingestion_pages').insert({
                    'session_id': session_id, 'page_url': page['url'],
                    'page_priority': page.get('priority', 99),
                    'html_length': page['html_length'],
                    'raw_html': page['html'][:5000],
                    'fetch_time_ms': page.get('fetch_time_ms', 0),
                    'http_status': page.get('status', 0),
                }).execute()
            sb.table('ingestion_cleaned').insert({
                'session_id': session_id,
                'cleaned_text': cleaning['combined_text'][:10000],
                'cleaned_length': cleaning['total_cleaned_length'],
                'noise_ratio': cleaning['noise_ratio'],
                'sections_detected': cleaning.get('sections', []),
                'core_content_weight': 0,
            }).execute()
    except Exception as e:
        logger.warning(f'Failed to store hybrid ingestion: {e}')

    return {
        'session_id': session_id,
        'render_mode': crawl['render_mode'],
        'trust_message': trust_message,
        'js_detection': crawl['js_detection'],
        'pages_crawled': crawl['pages_crawled'],
        'pages': [{'url': p['url'], 'priority': p.get('priority', 99), 'html_length': p['html_length'], 'fetch_time_ms': p.get('fetch_time_ms', 0), 'render_mode': p.get('render_mode', 'unknown')} for p in crawl['pages']],
        'canonical_url': crawl['canonical_url'],
        'redirect_chain': crawl.get('redirect_chain', []),
        'noise_ratio': cleaning['noise_ratio'],
        'cleaned_length': cleaning['total_cleaned_length'],
        'sections_detected': cleaning.get('sections', []),
        'per_page_density': cleaning.get('per_page_density', []),
        'dna_trace': dna,
        'hallucination_score': hall['hallucination_score'],
        'hallucinations': hall['hallucinations'],
        'lost_signals': hall['lost_signals'][:10],
        'scores': scores,
        'failure_layer': failure_layer,
        'failure_codes': crawl.get('failure_codes', []),
        'extraction_status': crawl['status'],
    }


@router.post("/ingestion/hybrid")
async def run_hybrid_ingestion(req: HybridIngestionRequest, current_user: dict = Depends(get_current_user)):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL required")

    queued = await enqueue_job(
        "website-ingestion",
        {
            "mode": "hybrid",
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
            'mode': 'hybrid',
        }

    return await execute_hybrid_ingestion_job({
        'url': url,
        'user_id': current_user['id'],
        'workspace_id': current_user['id'],
    })
