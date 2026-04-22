"""
Calibration Routes — Status, defer, reset, init, answer, activation, brain,
lifecycle, console, enrichment, regeneration.
Extracted from server.py. Prompts loaded from Supabase system_prompts table.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
import asyncio
import uuid
import re
import json
import logging
import os
from html import unescape
from urllib.parse import urlparse, urljoin

import httpx
from scan_cache import (
    normalize_domain, get_domain_scan, set_domain_scan,
    invalidate_domain_scan, get_edge_result, set_edge_result,
)
from core.llm_router import llm_trinity_chat
from core.helpers import serper_search, scrape_url_text
from routes.deps import (
    get_current_user, get_current_user_from_request,
    get_sb, logger, cognitive_core, check_rate_limit,
)
from supabase_client import safe_query_single
from prompt_registry import get_prompt
from auth_supabase import get_user_by_id
from supabase_intelligence_helpers import get_business_profile_supabase
from regeneration_governance import request_regeneration, record_regeneration_response
from fact_resolution import resolve_facts, build_known_facts_prompt

router = APIRouter()


# ─── Models ───

class CalibrationAnswerRequest(BaseModel):
    question_id: int
    answer: str

class CalibrationBrainRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = []

class RegenerationRequestPayload(BaseModel):
    layer: Optional[str] = None
    reason: Optional[str] = None

class RegenerationResponsePayload(BaseModel):
    proposal_id: str
    action: str

class ConsoleStateSave(BaseModel):
    current_step: int
    status: str = "IN_PROGRESS"

class ReportSaveRequest(BaseModel):
    report_type: str
    title: str
    content: Dict[str, Any] = {}
    generated_at: Optional[str] = None

class RecalibrationContactRequest(BaseModel):
    name: str
    email: str
    message: str = ""
    days_since_calibration: Optional[int] = None

class WebsiteEnrichRequest(BaseModel):
    url: str
    action: str = "scan"
    bust_cache: bool = False


def _extract_abn_candidates(text: str) -> List[str]:
    if not text:
        return []
    candidates = re.findall(r"\b\d{2}\s?\d{3}\s?\d{3}\s?\d{3}\b", text)
    normalized = []
    seen = set()
    for c in candidates:
        digits = re.sub(r"\D", "", c)
        if len(digits) == 11 and digits not in seen:
            seen.add(digits)
            normalized.append(f"{digits[:2]} {digits[2:5]} {digits[5:8]} {digits[8:11]}")
    return normalized


def _extract_domain(url: str) -> str:
    if not url:
        return ""
    clean = re.sub(r"^https?://", "", url.strip(), flags=re.IGNORECASE)
    return clean.split("/")[0].strip().lower()


def _extract_internal_links(html: str, base_url: str, limit: int = 8) -> List[str]:
    if not html:
        return []
    base_domain = _extract_domain(base_url)
    if not base_domain:
        return []
    links = re.findall(r'href=["\']([^"\']+)["\']', html, re.IGNORECASE)
    out: List[str] = []
    seen = set()
    for href in links:
        h = (href or "").strip()
        if not h or h.startswith("#") or h.startswith("mailto:") or h.startswith("tel:"):
            continue
        if h.lower().startswith("javascript:"):
            continue
        full = urljoin(base_url, h)
        parsed = urlparse(full)
        domain = (parsed.netloc or "").lower()
        if not domain or base_domain not in domain:
            continue
        path = (parsed.path or "/").lower()
        # Prioritize high-information pages for marketing intel.
        if not any(k in path for k in ["/about", "/service", "/solution", "/industry", "/case", "/testimonial", "/team", "/contact", "/news", "/blog"]):
            continue
        norm = f"{parsed.scheme}://{parsed.netloc}{parsed.path}".rstrip("/")
        if norm in seen:
            continue
        seen.add(norm)
        out.append(norm)
        if len(out) >= limit:
            break
    return out


async def _fetch_html_and_text(url: str, timeout: int = 15) -> Dict[str, str]:
    raw_html = ""
    page_text = ""
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; BIQcBot/2.0)"})
            if resp.status_code < 400:
                raw_html = resp.text or ""
    except Exception:
        raw_html = ""
    try:
        page_text = await scrape_url_text(url)
    except Exception:
        page_text = ""
    return {"html": raw_html, "text": page_text}


async def _crawl_site_context(seed_url: str, seed_html: str, max_pages: int = 10) -> Dict[str, Any]:
    links = _extract_internal_links(seed_html, seed_url, limit=max_pages + 2)
    target_links = links[:max_pages]
    if not target_links:
        return {"pages": [], "text": ""}

    results = await asyncio.gather(
        *[_fetch_html_and_text(link, timeout=12) for link in target_links],
        return_exceptions=True,
    )

    crawled: List[Dict[str, Any]] = []
    texts: List[str] = []
    for i, result in enumerate(results):
        link = target_links[i]
        if isinstance(result, Exception):
            crawled.append({"url": link, "text_len": 0})
            continue
        txt = (result.get("text") or "")[:5000]
        if txt:
            texts.append(f"URL: {link}\n{txt}")
        crawled.append({"url": link, "text_len": len(txt)})
    return {"pages": crawled, "text": "\n\n".join(texts)}


_edge_client: Optional[httpx.AsyncClient] = None


def _get_edge_client() -> httpx.AsyncClient:
    global _edge_client
    if _edge_client is None or _edge_client.is_closed:
        _edge_client = httpx.AsyncClient(
            timeout=90,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
    return _edge_client


def _edge_result_failed(result: Any) -> bool:
    if not isinstance(result, dict):
        return True
    http_status = result.get("_http_status")
    try:
        status_code = int(http_status) if http_status is not None else 200
    except Exception:
        status_code = 200
    if status_code >= 400:
        return True
    if result.get("ok") is False:
        return True
    status_value = str(result.get("status") or "").strip().lower()
    if status_value == "error":
        return True
    if result.get("error"):
        return True
    if result.get("error_code"):
        return True
    # Guardrail: non-JSON edge responses are surfaced as {"raw": "..."}.
    # Never treat those as successful/cachable outputs.
    if "raw" in result and not result.get("status") and not result.get("data"):
        return True
    return False


def _normalize_edge_result(function_name: str, http_status: int, data: Any) -> Dict[str, Any]:
    payload = data if isinstance(data, dict) else {"data": data}
    payload.setdefault("_http_status", http_status)

    status_value = str(payload.get("status") or "").strip().lower()
    detail_text = str(payload.get("detail") or "").strip()
    error_text = str(payload.get("error") or "").strip()
    has_error = bool(error_text or payload.get("error_code"))
    raw_payload_only = ("raw" in payload) and not payload.get("status") and not payload.get("data")
    failed_http = http_status >= 400
    failed_flag = payload.get("ok") is False or status_value == "error"
    meaningful_keys = [k for k in payload.keys() if k not in {"_http_status", "ok", "code", "status", "detail", "error", "error_code"}]
    ambiguous_success = payload.get("ok") is None and not status_value and not payload.get("data") and not meaningful_keys

    if failed_http or failed_flag or has_error or raw_payload_only or ambiguous_success:
        payload["ok"] = False
        if not payload.get("code"):
            if raw_payload_only:
                payload["code"] = "EDGE_INVALID_PAYLOAD"
            else:
                payload["code"] = "EDGE_FUNCTION_HTTP_ERROR" if failed_http else "EDGE_FUNCTION_FAILED"
        if not error_text:
            if raw_payload_only:
                payload["error"] = f"{function_name} returned non-JSON payload"
            elif detail_text:
                payload["error"] = detail_text
            elif failed_http:
                payload["error"] = f"{function_name} returned HTTP {http_status}"
            elif status_value == "error":
                payload["error"] = f"{function_name} reported error status"
            else:
                payload["error"] = f"{function_name} reported failure"
    else:
        payload.setdefault("ok", True)
        payload.setdefault("code", "OK")

    return payload


async def _call_edge_function(function_name: str, payload: Dict[str, Any], auth_header: str = "") -> Dict[str, Any]:
    supabase_url = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
    service_role = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY") or "").strip()
    if not supabase_url or not service_role:
        return {
            "ok": False,
            "error": "supabase_not_configured",
            "code": "EDGE_PROXY_UNAVAILABLE",
            "_http_status": 503,
        }
    endpoint = f"{supabase_url}/functions/v1/{function_name}"
    outbound_auth = auth_header.strip() if auth_header else f"Bearer {service_role}"
    headers = {
        "Authorization": outbound_auth,
        "apikey": service_role,
        "Content-Type": "application/json",
    }
    client = _get_edge_client()
    for attempt in range(2):
        try:
            res = await client.post(endpoint, json=payload or {}, headers=headers)
            if res.status_code >= 500 and attempt == 0:
                await asyncio.sleep(2)
                continue
            try:
                data = res.json()
            except Exception:
                data = {"raw": (res.text or "")[:1200]}
            return _normalize_edge_result(function_name, res.status_code, data)
        except httpx.TimeoutException:
            if attempt == 0:
                await asyncio.sleep(2)
                continue
            return {
                "ok": False,
                "error": f"timeout after retry calling {function_name}",
                "code": "EDGE_FUNCTION_TIMEOUT",
                "_http_status": 504,
            }
        except Exception as e:
            return {
                "ok": False,
                "error": str(e)[:220],
                "code": "EDGE_FUNCTION_UNAVAILABLE",
                "_http_status": 502,
            }
    return {
        "ok": False,
        "error": f"exhausted retries for {function_name}",
        "code": "EDGE_FUNCTION_UNAVAILABLE",
        "_http_status": 502,
    }


def _extract_meta_content(html: str, key: str) -> str:
    if not html or not key:
        return ""
    patterns = [
        rf'<meta[^>]+property=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)',
        rf'<meta[^>]+name=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']{re.escape(key)}["\']',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']{re.escape(key)}["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            return unescape(match.group(1)).strip()
    return ""


def _extract_title(html: str) -> str:
    if not html:
        return ""
    match = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    return unescape(match.group(1)).strip() if match else ""


def _clean_business_name(candidate: str) -> str:
    value = (candidate or "").strip()
    if not value:
        return ""
    parts = [p.strip() for p in re.split(r"\||—|-", value) if p.strip()]
    generic_titles = {"business advisory services", "home", "welcome"}
    for part in parts:
        if part.lower() not in generic_titles and len(part) > 2:
            return part
    return value if value.lower() not in generic_titles else ""


def _extract_social_handles_from_html(html: str) -> Dict[str, str]:
    handles = {"linkedin": "", "instagram": "", "facebook": "", "twitter": "", "x": "", "youtube": "", "tiktok": ""}
    if not html:
        return handles
    patterns = {
        "linkedin": r"https?://(?:www\.)?linkedin\.com/[\w\-\./]+",
        "instagram": r"https?://(?:www\.)?instagram\.com/[\w\-\./]+",
        "facebook": r"https?://(?:www\.)?facebook\.com/[\w\-\./]+",
        "twitter": r"https?://(?:www\.)?(?:x|twitter)\.com/[\w\-\./]+",
        "x": r"https?://(?:www\.)?(?:x|twitter)\.com/[\w\-\./]+",
        "youtube": r"https?://(?:www\.)?youtube\.com/[\w\-\./\?=&]+",
        "tiktok": r"https?://(?:www\.)?tiktok\.com/[\w\-\./\?=&]+",
    }
    for platform, pattern in patterns.items():
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            handles[platform] = match.group(0)
    return handles


def _extract_json_candidate(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str):
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            return {}
        try:
            parsed = json.loads(match.group(0))
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}


def _extract_service_lines(text: str) -> List[str]:
    if not text:
        return []
    service_keywords = (
        "advisory", "coaching", "strategy", "marketing", "operations",
        "compliance", "regulations", "efficiency", "conflict", "mentoring",
        "growth", "sales"
    )
    services: List[str] = []
    seen = set()
    for line in text.splitlines():
        candidate = re.sub(r"\s+", " ", line).strip(" :\u2022-\t")
        if not candidate or len(candidate) < 12 or len(candidate) > 90:
            continue
        lowered = candidate.lower()
        if any(keyword in lowered for keyword in service_keywords):
            if candidate not in seen:
                seen.add(candidate)
                services.append(candidate)
        if len(services) >= 5:
            break
    return services


def _infer_target_market(text: str, description: str = "") -> str:
    lowered = f"{text}\n{description}".lower()
    segments = []
    if "startup" in lowered:
        segments.append("startups")
    if "enterprise" in lowered:
        segments.append("established enterprises")
    if "business owner" in lowered:
        segments.append("business owners")
    if "australia" in lowered or "australian" in lowered:
        segments.append("Australian businesses")
    if not segments:
        return ""
    ordered = []
    for segment in segments:
        if segment not in ordered:
            ordered.append(segment)
    return ", ".join(ordered)


# ═══════════════════════════════════════════════════════════════
# SENTINEL / META-GAP / COMPETITOR-NOISE FILTERS
# ───────────────────────────────────────────────────────────────
# These scrub LLM-emitted placeholder text and SERP noise BEFORE
# any write into `business_dna_enrichment.enrichment`, and are
# re-applied at render time in /intelligence/cmo-report as
# defense-in-depth against legacy rows that still contain junk.
# ═══════════════════════════════════════════════════════════════

# Exact sentinel strings that some earlier pipelines persisted
# verbatim as an "industry" or other scalar value.
_SENTINEL_STRINGS = frozenset({
    "unknown — insufficient website data for industry classification",
    "unknown - insufficient website data for industry classification",
    "unknown — insufficient data",
    "unknown - insufficient data",
})

# Match any "unknown — <...> classification" / "unknown — <...> data"
# pattern that slipped through. Uses em-dash OR hyphen.
_SENTINEL_PATTERN = re.compile(
    r"^\s*unknown\s*[—\-]\s*.+?(classification|data)\s*$",
    re.IGNORECASE,
)

# Meta-gap phrases that the LLM sometimes emits as a SWOT bullet
# or priority action when it couldn't determine anything real.
# Flagged case-insensitive.
_META_GAP_PATTERN = re.compile(
    r"\b(lack of|insufficient|cannot be (determined|inferred)|unable to|"
    r"not (available|provided)|classification|no (data|information))\b",
    re.IGNORECASE,
)

# If a meta-gap phrase appears but the sentence ALSO contains a
# following actionable verb, keep it — it's likely "lack of X -> do Y".
_ACTION_VERB_PATTERN = re.compile(
    r"\b("
    r"launch|develop|implement|create|build|improve|increase|optimi[sz]e|"
    r"address|invest|expand|strengthen|target|execute|deploy|drive|"
    r"prioriti[sz]e|focus|establish|deliver|measure|test|refine|"
    r"scale|reposition|pivot|accelerate|activate|audit|align|consolidate|"
    r"refresh|restructure|ship|spin up|set up|roll out"
    r")\b",
    re.IGNORECASE,
)

# Competitor-name noise words. Any candidate whose lowercased text
# contains any of these tokens as a word boundary is rejected. Also
# rejects anything ending in a year (20xx) which is almost always a
# report title, not a company.
_COMPETITOR_NOISE_PATTERN = re.compile(
    r"\b(market|analysis|report|outlook|executive summary|"
    r"research report|industry (size|growth))\b",
    re.IGNORECASE,
)
_COMPETITOR_YEAR_SUFFIX = re.compile(r"20\d{2}\s*$")


def _is_sentinel_value(text: Any) -> bool:
    """True when `text` is one of the known calibration sentinels."""
    if not isinstance(text, str):
        return False
    normalized = text.strip().lower()
    if not normalized:
        return False
    if normalized in _SENTINEL_STRINGS:
        return True
    if _SENTINEL_PATTERN.match(normalized):
        return True
    return False


def _scrub_sentinel(text: Any) -> Any:
    """Replace known sentinels with an empty string. Non-strings pass through."""
    if isinstance(text, str) and _is_sentinel_value(text):
        return ""
    return text


def _is_meta_gap_text(text: Any) -> bool:
    """
    True when `text` is a meta-gap placeholder that we should drop from
    SWOT arrays / priority actions. False when the text either has an
    action verb that makes it genuinely actionable OR is long enough
    (>80 chars) to plausibly contain real insight.

    OVERRIDE — dense meta-gap (>=2 distinct meta-gap phrases in one
    string) is always dropped, regardless of length or action verb.
    This is the pattern of the 2026-04-21 live demo bug: "Lack of
    specific industry classification sector data hinders precise
    market positioning" (87 chars + passive 'hinders', no action verb,
    but matches both 'lack of' AND 'classification' — trivially meta).
    """
    if not isinstance(text, str):
        return False
    stripped = text.strip()
    if not stripped:
        return False
    if not _META_GAP_PATTERN.search(stripped):
        return False
    # Dense meta-gap override: 2+ meta-gap phrases in one string is
    # almost always AI self-pitying about data quality, not insight.
    # Drop unconditionally.
    dense_matches = _META_GAP_PATTERN.findall(stripped)
    if len(dense_matches) >= 2:
        return True
    # Escape hatch 1: contains an action verb -> real insight like
    # "Lack of paid funnel — launch diagnostic CTA sequence".
    if _ACTION_VERB_PATTERN.search(stripped):
        return False
    # Escape hatch 2: long prose usually buries a real point even if it
    # triggers a meta-gap word in passing.
    if len(stripped) > 80:
        return False
    return True


def _filter_meta_gap_list(items: Any) -> List[Any]:
    """Return `items` with meta-gap strings stripped. Non-list -> []."""
    if not isinstance(items, list):
        return []
    return [it for it in items if not _is_meta_gap_text(it)]


def _clean_swot_dict(swot: Any) -> Dict[str, List[Any]]:
    """
    Apply meta-gap filter + sentinel scrub to each SWOT bucket.
    Returns an empty-shaped dict on malformed input.
    """
    if not isinstance(swot, dict):
        return {"strengths": [], "weaknesses": [], "opportunities": [], "threats": []}
    cleaned: Dict[str, List[Any]] = {}
    for bucket in ("strengths", "weaknesses", "opportunities", "threats"):
        raw = swot.get(bucket, [])
        scrubbed = [_scrub_sentinel(it) for it in (raw if isinstance(raw, list) else [])]
        cleaned[bucket] = [it for it in _filter_meta_gap_list(scrubbed) if it]
    # preserve any extra keys (e.g. competitor_swot stash) unmodified
    for k, v in swot.items():
        if k not in cleaned:
            cleaned[k] = v
    return cleaned


def _is_noisy_competitor(name: Any) -> bool:
    """True when `name` looks like a SERP title rather than a real competitor."""
    if not isinstance(name, str):
        return True
    stripped = name.strip()
    if not stripped or len(stripped) < 3:
        return True
    if len(stripped) > 60:
        return True
    if _COMPETITOR_YEAR_SUFFIX.search(stripped):
        return True
    if _COMPETITOR_NOISE_PATTERN.search(stripped):
        return True
    return False


def _filter_competitor_candidates(names: Any) -> List[str]:
    """Strip SERP-report titles and other noise from a competitor list."""
    if not isinstance(names, list):
        return []
    out: List[str] = []
    seen = set()
    for raw in names:
        if not isinstance(raw, str):
            continue
        cand = raw.strip()
        if _is_noisy_competitor(cand):
            continue
        key = cand.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(cand)
    return out


def _sanitize_enrichment_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Apply sentinel scrub + meta-gap filter + competitor noise filter to the
    fields we persist into `business_dna_enrichment.enrichment`. Mutates in
    place and also returns the same dict for chaining convenience.
    """
    if not isinstance(payload, dict):
        return payload

    # 1) Scalar sentinel scrub. Fields that must never contain placeholder junk.
    for scalar_field in (
        "industry", "market_position", "competitor_analysis",
        "executive_summary", "cmo_executive_brief", "unique_value_proposition",
        "target_market", "competitive_advantages", "description", "forensic_memo",
    ):
        if scalar_field in payload:
            payload[scalar_field] = _scrub_sentinel(payload.get(scalar_field))

    # 2) Meta-gap filter on SWOT + priority action arrays.
    if "swot" in payload:
        payload["swot"] = _clean_swot_dict(payload.get("swot"))
    if "cmo_priority_actions" in payload:
        payload["cmo_priority_actions"] = _filter_meta_gap_list(
            payload.get("cmo_priority_actions")
        )
    if "industry_action_items" in payload:
        payload["industry_action_items"] = _filter_meta_gap_list(
            payload.get("industry_action_items")
        )

    # 3) Competitor-noise filter.
    if "competitors" in payload:
        payload["competitors"] = _filter_competitor_candidates(payload.get("competitors"))

    # 4) Nested competitor_swot snapshots — drop whole entry when its `name`
    #    is noisy, and clean sub-SWOT arrays on survivors.
    if isinstance(payload.get("competitor_swot"), list):
        pruned = []
        for snap in payload["competitor_swot"]:
            if not isinstance(snap, dict):
                continue
            if _is_noisy_competitor(snap.get("name")):
                continue
            for sub in ("strengths", "weaknesses", "opportunities_against_them"):
                if sub in snap:
                    snap[sub] = _filter_meta_gap_list(snap.get(sub))
            pruned.append(snap)
        payload["competitor_swot"] = pruned

    return payload


def _infer_competitors_from_results(results: List[Dict[str, Any]], business_name: str, domain: str) -> List[str]:
    if not results:
        return []
    competitors: List[str] = []
    seen = set()
    business_lower = (business_name or "").lower()
    blocked_domains = (
        "linkedin.com", "facebook.com", "instagram.com", "youtube.com", "zoominfo.com",
        "crunchbase.com", "yellowpages", "productreview", "indeed.com", "glassdoor.com",
    )
    for result in results:
        link = (result.get("link") or "").lower()
        title = (result.get("title") or "").strip()
        if not title:
            continue
        if domain and domain in link:
            continue
        if any(blocked in link for blocked in blocked_domains):
            continue
        raw_name = re.split(r"\||—|-", title)[0].strip()
        if not raw_name or len(raw_name) < 3:
            continue
        lowered = raw_name.lower()
        if business_lower and business_lower in lowered:
            continue
        if lowered in seen:
            continue
        # Noise filter: reject SERP report titles / year-suffixed entries /
        # overlong strings that are clearly not company names.
        if _is_noisy_competitor(raw_name):
            continue
        seen.add(lowered)
        competitors.append(raw_name)
        if len(competitors) >= 5:
            break
    return competitors


def _extract_sentence_with_keywords(text: str, keywords: List[str]) -> str:
    if not text:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", text))
    for sentence in sentences:
        lowered = sentence.lower()
        if any(keyword in lowered for keyword in keywords) and 25 <= len(sentence) <= 220:
            return sentence.strip()
    return ""


def _extract_contact_emails(text: str, limit: int = 20) -> List[str]:
    if not text:
        return []
    emails = re.findall(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text)
    out: List[str] = []
    seen = set()
    blocked = {"example.com", "domain.com", "email.com"}
    for raw in emails:
        email = raw.strip().lower()
        if not email or any(b in email for b in blocked):
            continue
        if email in seen:
            continue
        seen.add(email)
        out.append(email)
        if len(out) >= limit:
            break
    return out


def _extract_location_mentions(text: str, limit: int = 8) -> List[str]:
    if not text:
        return []
    cleaned = re.sub(r"\s+", " ", text)
    patterns = [
        r"\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2},\s(?:NSW|VIC|QLD|WA|SA|TAS|NT|ACT))\b",
        r"\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2},\s(?:Australia|New Zealand|United Kingdom|United States|Canada|Singapore))\b",
    ]
    out: List[str] = []
    seen = set()
    for pattern in patterns:
        for match in re.findall(pattern, cleaned):
            loc = str(match).strip()
            key = loc.lower()
            if not loc or key in seen:
                continue
            seen.add(key)
            out.append(loc)
            if len(out) >= limit:
                return out
    return out


def _build_competitor_leaders(enrichment: Dict[str, Any], semrush_intel: Dict[str, Any]) -> List[Dict[str, Any]]:
    leaders: List[Dict[str, Any]] = []
    semrush_comp = (((semrush_intel or {}).get("competitor_analysis") or {}).get("organic_competitors") or [])
    for item in semrush_comp[:3]:
        if not isinstance(item, dict):
            continue
        domain = str(item.get("domain") or "").strip()
        if not domain:
            continue
        common_keywords = item.get("common_keywords") or item.get("Cr")
        leaders.append({
            "name": domain,
            "why_leading": f"Strong organic footprint with {common_keywords or 'high'} shared category keywords.",
            "what_to_learn": [
                "Publish tightly themed service pages around commercial-intent search terms.",
                "Strengthen category proof assets (case studies, quantified outcomes, named clients).",
            ],
        })
    if leaders:
        return leaders
    fallback = []
    for name in (enrichment.get("competitors") or [])[:3]:
        fallback.append({
            "name": name,
            "why_leading": "Visible in competitive search results for your category.",
            "what_to_learn": [
                "Sharpen page-level messaging by outcome and buyer segment.",
                "Benchmark offer packaging and CTA clarity against this competitor monthly.",
            ],
        })
    return fallback


def _build_industry_action_items(industry: str, seo: Dict[str, Any], paid: Dict[str, Any]) -> List[str]:
    sector = (industry or "").strip() or "your industry"
    seo_status = seo.get("status") or "mixed"
    paid_state = paid.get("maturity") or "unknown"
    return [
        f"SEO: Build a {sector}-specific topic cluster (service pages + FAQ schema + local intent pages) to improve rankings from current {seo_status} visibility.",
        f"Demand capture: Run one tightly scoped paid campaign per core offer with conversion tracking and negative-keyword control to lift performance from current {paid_state} maturity.",
    ]


def _build_customer_review_highlights(customer_intel: Dict[str, Any]) -> Dict[str, Any]:
    positives = customer_intel.get("positive_signals") or []
    negatives = customer_intel.get("negative_signals") or []
    action_plan = customer_intel.get("action_plan") or []
    best = [{"review": v, "action_item": "Amplify this proof in service pages and sales proposals."} for v in positives[:3]]
    worst = []
    for idx, value in enumerate(negatives[:3]):
        worst.append({
            "review": value,
            "action_item": action_plan[idx] if idx < len(action_plan) else "Assign an owner, root-cause the issue, and publish a fix timeline.",
        })
    return {"best_reviews": best, "worst_reviews": worst}


def _build_staff_review_highlights(staff_intel: Dict[str, Any]) -> Dict[str, Any]:
    platforms = staff_intel.get("platforms") or []
    positives = staff_intel.get("positive_signals") or []
    negatives = staff_intel.get("negative_signals") or []
    action_plan = staff_intel.get("action_plan") or []
    glassdoor_score = None
    for platform in platforms:
        if not isinstance(platform, dict):
            continue
        if str(platform.get("platform") or "").lower() == "glassdoor" and isinstance(platform.get("rating"), (int, float)):
            glassdoor_score = float(platform.get("rating"))
            break
    return {
        "glassdoor_score": glassdoor_score,
        "top_positive_reviews": positives[:3],
        "top_negative_reviews": [{"review": v, "action_item": action_plan[idx] if idx < len(action_plan) else "Address this issue with a 30-day team operations plan."} for idx, v in enumerate(negatives[:3])],
        # 2026-04-19: "free tier" retired. Message now reflects actual state (data not yet captured).
        "free_tier_message": "Data not yet captured — complete calibration to populate" if not platforms and not positives and not negatives else "",
    }


def _parse_google_reviews(search_result: dict, business_name: str) -> dict:
    """Extract star ratings, review counts, and snippets from customer review sites."""
    results = search_result.get("results") or []
    snippets = []
    star_rating = None
    review_count = None
    positive = []
    negative = []
    sources_found = []

    for r in results:
        snippet = r.get("snippet") or ""
        title = r.get("title") or ""
        link = r.get("link") or ""
        combined = f"{title} {snippet}"

        source = "Google"
        if "trustpilot" in link.lower():
            source = "Trustpilot"
        elif "productreview" in link.lower():
            source = "ProductReview"
        elif "google.com/maps" in link.lower():
            source = "Google Maps"

        rating_match = re.search(r"(\d(?:\.\d)?)\s*(?:out of\s*5|/\s*5|stars?|★|rating|score)", combined, re.IGNORECASE)
        if rating_match and star_rating is None:
            val = float(rating_match.group(1))
            if 0 < val <= 5:
                star_rating = val
                sources_found.append(source)

        count_match = re.search(r"(\d[\d,]*)\s*(?:reviews?|ratings?|google reviews?|verified)", combined, re.IGNORECASE)
        if count_match and review_count is None:
            raw_count = count_match.group(1).replace(",", "")
            if raw_count.isdigit() and int(raw_count) < 1000000:
                review_count = int(raw_count)

        if snippet and len(snippet) > 20:
            tagged = f"[{source}] {snippet[:200]}"
            snippets.append(tagged)
            neg_keywords = ["poor", "terrible", "awful", "bad experience", "worst", "horrible", "disappointed", "rude", "scam", "avoid", "slow", "unreliable"]
            if any(kw in snippet.lower() for kw in neg_keywords):
                negative.append(tagged)
            else:
                positive.append(tagged)

    return {
        "star_rating": star_rating,
        "review_count": review_count,
        "snippets": snippets[:10],
        "positive": positive[:5],
        "negative": negative[:5],
        "sources": sources_found,
        "has_data": bool(star_rating or review_count or snippets),
    }


def _parse_glassdoor_reviews(search_result: dict, business_name: str) -> dict:
    """Extract ratings and review snippets from employer review sites (Glassdoor, Indeed, Seek)."""
    results = search_result.get("results") or []
    snippets = []
    rating = None
    positive = []
    negative = []
    employer_sites = ["glassdoor", "indeed", "seek.com", "fairwork", "payscale"]

    for r in results:
        snippet = r.get("snippet") or ""
        title = r.get("title") or ""
        link = r.get("link") or ""
        combined = f"{title} {snippet}"

        is_employer_site = any(site in link.lower() or site in title.lower() for site in employer_sites)
        if not is_employer_site:
            continue

        rating_match = re.search(r"(\d(?:\.\d)?)\s*(?:out of\s*5|/\s*5|stars?|★|overall|rating)", combined, re.IGNORECASE)
        if rating_match and rating is None:
            val = float(rating_match.group(1))
            if 0 < val <= 5:
                rating = val

        if snippet and len(snippet) > 20:
            source = "Glassdoor" if "glassdoor" in link.lower() else "Indeed" if "indeed" in link.lower() else "Employer review"
            snippets.append(f"[{source}] {snippet[:200]}")
            neg_keywords = ["poor", "toxic", "bad management", "low pay", "high turnover", "overworked", "no growth", "terrible", "worst", "avoid"]
            if any(kw in snippet.lower() for kw in neg_keywords):
                negative.append(f"[{source}] {snippet[:200]}")
            else:
                positive.append(f"[{source}] {snippet[:200]}")

    return {
        "rating": rating,
        "snippets": snippets[:10],
        "positive": positive[:5],
        "negative": negative[:5],
        "has_data": bool(rating or snippets),
    }


def _aggregate_reviews(google: dict, glassdoor: dict) -> dict:
    """Combine Google and Glassdoor review signals into a single aggregation."""
    scores = []
    if google.get("star_rating"):
        scores.append(google["star_rating"])
    if glassdoor.get("rating"):
        scores.append(glassdoor["rating"])
    combined_score = round(sum(scores) / len(scores), 1) if scores else None

    all_positive = (google.get("positive") or []) + (glassdoor.get("positive") or [])
    all_negative = (google.get("negative") or []) + (glassdoor.get("negative") or [])
    all_snippets = (google.get("snippets") or []) + (glassdoor.get("snippets") or [])

    return {
        "combined_score": combined_score,
        "positive_count": len(all_positive),
        "negative_count": len(all_negative),
        "top_recent": all_snippets[:3],
        "has_data": bool(combined_score or all_snippets),
    }


def _parse_review_date_to_utc(value: str) -> Optional[datetime]:
    if not value:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    candidates = [raw]
    if raw.endswith("Z"):
        candidates.append(raw.replace("Z", "+00:00"))
    for candidate in candidates:
        try:
            parsed = datetime.fromisoformat(candidate)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except Exception:
            continue
    return None


def _derive_customer_action_plan(negative_signals: List[str]) -> List[str]:
    corpus = " ".join([(s or "").lower() for s in negative_signals])
    actions: List[str] = []

    def _append_if(condition: bool, action: str) -> None:
        if condition and action not in actions:
            actions.append(action)

    _append_if(
        bool(re.search(r"slow|wait|delay|late|delivery|shipping|turnaround", corpus)),
        "Set response and fulfilment SLAs, then review weekly breach reports with operations leads.",
    )
    _append_if(
        bool(re.search(r"quality|defect|broken|error|issue|fault|refund|return", corpus)),
        "Run a weekly root-cause quality review and track corrective actions to closure within 14 days.",
    )
    _append_if(
        bool(re.search(r"support|service|rude|unhelpful|communication|follow up", corpus)),
        "Rebuild customer support playbooks with escalation paths, QA scoring, and coaching for frontline teams.",
    )
    _append_if(
        bool(re.search(r"price|pricing|expensive|cost|value|overpriced|hidden fee", corpus)),
        "Audit pricing transparency and expectation-setting across sales, checkout, and post-sale communications.",
    )
    _append_if(
        bool(re.search(r"booking|appointment|website|checkout|payment|billing", corpus)),
        "Instrument booking and payment friction points and assign owners to reduce customer effort in the purchase journey.",
    )
    if not actions and negative_signals:
        actions.append("Convert recurring customer complaints into an operations backlog with named owners, deadlines, and monthly verification.")
    return actions[:4]


def _build_customer_review_intelligence(
    google_reviews: dict,
    review_aggregation: dict,
    browse_ai_reviews: dict,
    lookback_months: int = 12,
) -> Dict[str, Any]:
    now_utc = datetime.now(timezone.utc)
    cutoff = now_utc - timedelta(days=lookback_months * 30)
    browse_payload = browse_ai_reviews if isinstance(browse_ai_reviews, dict) else {}
    aggregated = browse_payload.get("aggregated") if isinstance(browse_payload.get("aggregated"), dict) else {}
    customer_reviews = browse_payload.get("customer_reviews") if isinstance(browse_payload.get("customer_reviews"), list) else []

    platforms: List[Dict[str, Any]] = []
    positive_signals: List[str] = []
    negative_signals: List[str] = []
    evidence: List[str] = []
    last_12_months_count = 0
    undated_count = 0
    scores: List[float] = []
    dated_events: List[Dict[str, Any]] = []
    undated_events: List[str] = []

    for platform_blob in customer_reviews:
        if not isinstance(platform_blob, dict):
            continue
        platform = str(platform_blob.get("platform") or "customer_reviews").strip().lower()
        rating = platform_blob.get("rating")
        if isinstance(rating, (int, float)) and 0 < float(rating) <= 5:
            scores.append(float(rating))
        review_items = platform_blob.get("reviews") if isinstance(platform_blob.get("reviews"), list) else []
        platform_last_12 = 0
        platform_undated = 0

        for rv in review_items:
            if not isinstance(rv, dict):
                continue
            text = str(rv.get("text") or "").strip()
            if not text:
                continue
            sentiment = str(rv.get("sentiment") or "").strip().lower()
            parsed_date = _parse_review_date_to_utc(str(rv.get("date") or ""))
            label = f"[{platform}] {text[:220]}"

            if parsed_date:
                if parsed_date < cutoff:
                    continue
                platform_last_12 += 1
                last_12_months_count += 1
                dated = parsed_date.date().isoformat()
                evidence.append(f"{label} ({dated})")
                dated_events.append({"label": label, "date": parsed_date})
            else:
                platform_undated += 1
                undated_count += 1
                evidence.append(f"{label} (date not verified)")
                undated_events.append(label)

            if sentiment == "negative":
                negative_signals.append(label)
            elif sentiment == "positive":
                positive_signals.append(label)

        review_count = platform_blob.get("review_count")
        normalized_count = int(review_count) if isinstance(review_count, (int, float)) else len(review_items)
        platforms.append({
            "platform": platform,
            "rating": float(rating) if isinstance(rating, (int, float)) else None,
            "review_count": max(0, normalized_count),
            "last_12_months_count": platform_last_12,
            "undated_count": platform_undated,
            "url": platform_blob.get("url") or "",
        })

    if not positive_signals:
        positive_signals.extend((aggregated.get("top_positive") or [])[:8])
    if not negative_signals:
        negative_signals.extend((aggregated.get("top_negative") or [])[:8])
    if not evidence:
        evidence.extend((aggregated.get("top_recent") or [])[:8])

    if not positive_signals and isinstance(google_reviews, dict):
        positive_signals.extend((google_reviews.get("positive") or [])[:6])
    if not negative_signals and isinstance(google_reviews, dict):
        negative_signals.extend((google_reviews.get("negative") or [])[:6])
    if not evidence and isinstance(google_reviews, dict):
        evidence.extend((google_reviews.get("snippets") or [])[:8])

    dedup_sources = []
    seen_sources = set()
    source_candidates = [p.get("platform") for p in platforms] + (aggregated.get("customer_sources") or []) + (google_reviews.get("sources") or [])
    for item in source_candidates:
        src = str(item or "").strip()
        if not src:
            continue
        key = src.lower()
        if key in seen_sources:
            continue
        seen_sources.add(key)
        dedup_sources.append(src)

    customer_score = round(sum(scores) / len(scores), 1) if scores else None
    if customer_score is None and isinstance(aggregated.get("customer_score"), (int, float)):
        customer_score = round(float(aggregated.get("customer_score")), 1)
    if customer_score is None and isinstance(review_aggregation, dict) and isinstance(review_aggregation.get("combined_score"), (int, float)):
        customer_score = round(float(review_aggregation.get("combined_score")), 1)
    if customer_score is None and isinstance(google_reviews, dict) and isinstance(google_reviews.get("star_rating"), (int, float)):
        customer_score = round(float(google_reviews.get("star_rating")), 1)

    positive_signals = list(dict.fromkeys([str(x).strip() for x in positive_signals if str(x).strip()]))[:10]
    negative_signals = list(dict.fromkeys([str(x).strip() for x in negative_signals if str(x).strip()]))[:10]
    evidence = list(dict.fromkeys([str(x).strip() for x in evidence if str(x).strip()]))[:12]
    dated_events = sorted(dated_events, key=lambda item: item["date"], reverse=True)
    top_recent = [f"{item['label']} ({item['date'].date().isoformat()})" for item in dated_events[:6]]
    if len(top_recent) < 6:
        top_recent.extend([f"{label} (date not verified)" for label in undated_events[: max(0, 6 - len(top_recent))]])
    if not top_recent:
        top_recent = (review_aggregation.get("top_recent") or [])[:6] if isinstance(review_aggregation, dict) else []
    top_recent = list(dict.fromkeys([str(x).strip() for x in top_recent if str(x).strip()]))[:6]

    action_plan = _derive_customer_action_plan(negative_signals)
    if isinstance(aggregated.get("customer_action_themes"), list):
        action_plan.extend([str(x).strip() for x in aggregated.get("customer_action_themes") if str(x).strip()])
    action_plan = list(dict.fromkeys(action_plan))[:5]

    review_count_total_estimate = sum(max(0, int(p.get("review_count") or 0)) for p in platforms)
    if review_count_total_estimate == 0 and isinstance(aggregated.get("customer_count"), (int, float)):
        review_count_total_estimate = max(0, int(aggregated.get("customer_count") or 0))
    if review_count_total_estimate == 0 and isinstance(google_reviews, dict) and isinstance(google_reviews.get("review_count"), (int, float)):
        review_count_total_estimate = max(0, int(google_reviews.get("review_count") or 0))

    has_data = bool(
        platforms
        or positive_signals
        or negative_signals
        or evidence
        or customer_score is not None
        or review_count_total_estimate > 0
    )
    return {
        "has_data": has_data,
        "source_truth_only": True,
        "window_months": lookback_months,
        "window_label": f"last {lookback_months} months",
        "window_start": cutoff.date().isoformat(),
        "window_end": now_utc.date().isoformat(),
        "review_count_last_12_months": last_12_months_count,
        "undated_review_count": undated_count,
        "review_count_total_estimate": review_count_total_estimate,
        "scores_available": bool(customer_score is not None),
        "customer_score": customer_score,
        "platforms": platforms[:8],
        "sources": dedup_sources[:8],
        "positive_count": len(positive_signals),
        "negative_count": len(negative_signals),
        "positive_signals": positive_signals,
        "negative_signals": negative_signals,
        "action_plan": action_plan,
        "top_recent": top_recent,
        "evidence": evidence,
    }


def _derive_staff_action_plan(negative_signals: List[str]) -> List[str]:
    corpus = " ".join([(s or "").lower() for s in negative_signals])
    actions: List[str] = []

    def _append_if(condition: bool, action: str) -> None:
        if condition and action not in actions:
            actions.append(action)

    _append_if(
        bool(re.search(r"manager|management|leadership|communication", corpus)),
        "Run a 30-day leadership cadence reset: weekly manager 1:1s, escalation SLAs, and transparent team updates.",
    )
    _append_if(
        bool(re.search(r"overwork|burnout|workload|long hours|pressure", corpus)),
        "Implement capacity planning and workload balancing to reduce burnout risk and delivery errors.",
    )
    _append_if(
        bool(re.search(r"salary|pay|underpaid|compensation|benefits", corpus)),
        "Benchmark compensation against market medians and publish progression criteria for role levels.",
    )
    _append_if(
        bool(re.search(r"culture|toxic|turnover|attrition|no growth|career", corpus)),
        "Launch a 90-day retention plan with stay interviews, growth pathways, and manager accountability metrics.",
    )
    _append_if(
        bool(re.search(r"onboarding|training|support|tools|process", corpus)),
        "Upgrade onboarding and SOP coverage so role expectations and support channels are explicit from day one.",
    )
    if not actions and negative_signals:
        actions.append("Convert recurring staff pain points into a tracked operations improvement backlog with owners and deadlines.")
    return actions[:4]


def _build_staff_review_intelligence(glassdoor_reviews: dict, browse_ai_reviews: dict, lookback_months: int = 12) -> Dict[str, Any]:
    now_utc = datetime.now(timezone.utc)
    cutoff = now_utc - timedelta(days=lookback_months * 30)
    browse_payload = browse_ai_reviews if isinstance(browse_ai_reviews, dict) else {}
    aggregated = browse_payload.get("aggregated") if isinstance(browse_payload.get("aggregated"), dict) else {}
    staff_reviews = browse_payload.get("staff_reviews") if isinstance(browse_payload.get("staff_reviews"), list) else []

    platforms: List[Dict[str, Any]] = []
    positive_signals: List[str] = []
    negative_signals: List[str] = []
    evidence: List[str] = []
    last_12_months_count = 0
    undated_count = 0
    scores: List[float] = []

    for platform_blob in staff_reviews:
        if not isinstance(platform_blob, dict):
            continue
        platform = str(platform_blob.get("platform") or "staff_reviews").strip().lower()
        rating = platform_blob.get("rating")
        if isinstance(rating, (int, float)) and 0 < float(rating) <= 5:
            scores.append(float(rating))
        review_items = platform_blob.get("reviews") if isinstance(platform_blob.get("reviews"), list) else []
        platform_last_12 = 0
        platform_undated = 0

        for rv in review_items:
            if not isinstance(rv, dict):
                continue
            text = str(rv.get("text") or "").strip()
            if not text:
                continue
            sentiment = str(rv.get("sentiment") or "").strip().lower()
            parsed_date = _parse_review_date_to_utc(str(rv.get("date") or ""))
            if parsed_date:
                if parsed_date < cutoff:
                    continue
                platform_last_12 += 1
                last_12_months_count += 1
                label = f"[{platform}] {text[:220]}"
                evidence.append(f"{label} ({parsed_date.date().isoformat()})")
                if sentiment == "negative":
                    negative_signals.append(label)
                elif sentiment == "positive":
                    positive_signals.append(label)
            else:
                platform_undated += 1
                undated_count += 1
                label = f"[{platform}] {text[:220]}"
                evidence.append(f"{label} (date not verified)")
                if sentiment == "negative":
                    negative_signals.append(label)
                elif sentiment == "positive":
                    positive_signals.append(label)

        review_count = platform_blob.get("review_count")
        normalized_count = int(review_count) if isinstance(review_count, (int, float)) else len(review_items)
        platforms.append({
            "platform": platform,
            "rating": float(rating) if isinstance(rating, (int, float)) else None,
            "review_count": max(0, normalized_count),
            "last_12_months_count": platform_last_12,
            "undated_count": platform_undated,
            "url": platform_blob.get("url") or "",
        })

    if not positive_signals:
        positive_signals.extend((aggregated.get("top_staff_positive") or [])[:5])
    if not negative_signals:
        negative_signals.extend((aggregated.get("top_staff_negative") or [])[:5])

    if not positive_signals and isinstance(glassdoor_reviews, dict):
        positive_signals.extend((glassdoor_reviews.get("positive") or [])[:4])
    if not negative_signals and isinstance(glassdoor_reviews, dict):
        negative_signals.extend((glassdoor_reviews.get("negative") or [])[:4])
    if not evidence and isinstance(glassdoor_reviews, dict):
        evidence.extend((glassdoor_reviews.get("snippets") or [])[:6])

    dedup_sources = []
    seen_sources = set()
    for item in platforms:
        src = str(item.get("platform") or "").strip()
        if not src or src in seen_sources:
            continue
        seen_sources.add(src)
        dedup_sources.append(src)

    staff_score = round(sum(scores) / len(scores), 1) if scores else None
    if staff_score is None and isinstance(aggregated.get("staff_score"), (int, float)):
        staff_score = round(float(aggregated.get("staff_score")), 1)
    if staff_score is None and isinstance(glassdoor_reviews, dict) and isinstance(glassdoor_reviews.get("rating"), (int, float)):
        staff_score = round(float(glassdoor_reviews.get("rating")), 1)

    positive_signals = list(dict.fromkeys([str(x).strip() for x in positive_signals if str(x).strip()]))[:6]
    negative_signals = list(dict.fromkeys([str(x).strip() for x in negative_signals if str(x).strip()]))[:6]
    evidence = list(dict.fromkeys([str(x).strip() for x in evidence if str(x).strip()]))[:8]
    action_plan = _derive_staff_action_plan(negative_signals)

    has_data = bool(platforms or positive_signals or negative_signals or evidence or staff_score is not None)
    return {
        "has_data": has_data,
        "source_truth_only": True,
        "window_months": lookback_months,
        "window_label": f"last {lookback_months} months",
        "window_start": cutoff.date().isoformat(),
        "window_end": now_utc.date().isoformat(),
        "review_count_last_12_months": last_12_months_count,
        "undated_review_count": undated_count,
        "scores_available": bool(staff_score is not None),
        "staff_score": staff_score,
        "platforms": platforms[:6],
        "sources": dedup_sources[:6],
        "positive_signals": positive_signals,
        "negative_signals": negative_signals,
        "action_plan": action_plan,
        "evidence": evidence,
    }


def _score_from_signal(signal: Any) -> int:
    """Deterministic 0-100 score derived from an enrichment signal dict.

    Prefers an explicit numeric score field if present; otherwise falls back
    to a "populated density" metric (fraction of non-empty keys × 100).
    Always returns an int in [0, 100]. Never fabricates data — zeros-out
    when nothing meaningful is present.
    """
    if isinstance(signal, dict):
        raw = signal.get("score") or signal.get("visibility_score") or signal.get("engagement_score")
        if isinstance(raw, (int, float)):
            return max(0, min(100, int(raw)))
        present = sum(1 for v in signal.values() if v)
        total = max(1, len(signal))
        return int(round((present / total) * 100))
    return 0


def _build_seo_analysis(raw_html: str, page_text: str, page_title: str, meta_description: str) -> Dict[str, Any]:
    html = raw_html or ""
    text = page_text or ""
    title = page_title or ""
    meta = meta_description or ""
    lowered = f"{html}\n{text}".lower()

    title_len = len(title.strip())
    meta_len = len(meta.strip())
    has_h1 = bool(re.search(r"<h1[^>]*>.*?</h1>", html, re.IGNORECASE | re.DOTALL))
    has_schema = "application/ld+json" in lowered
    has_alt = " alt=" in lowered
    has_canonical = bool(re.search(r'rel=["\']canonical["\']', html, re.IGNORECASE))
    has_robots_noindex = "noindex" in lowered and "robots" in lowered

    score = 0
    if 30 <= title_len <= 65:
        score += 20
    elif title_len > 0:
        score += 10
    if 80 <= meta_len <= 165:
        score += 20
    elif meta_len > 0:
        score += 10
    if has_h1:
        score += 15
    if has_schema:
        score += 15
    if has_alt:
        score += 10
    if has_canonical:
        score += 10
    if not has_robots_noindex:
        score += 10
    score = min(score, 100)

    gaps: List[str] = []
    if not (30 <= title_len <= 65):
        gaps.append("Title length is outside best-practice range (30-65 chars).")
    if not (80 <= meta_len <= 165):
        gaps.append("Meta description missing or outside 80-165 chars.")
    if not has_h1:
        gaps.append("No clear H1 heading detected.")
    if not has_schema:
        gaps.append("No structured data (JSON-LD) detected.")
    if not has_canonical:
        gaps.append("No canonical link detected.")

    strengths: List[str] = []
    if has_h1:
        strengths.append("Primary H1 heading detected.")
    if has_schema:
        strengths.append("Structured data markup detected.")
    if has_canonical:
        strengths.append("Canonical tag detected.")
    if has_alt:
        strengths.append("Image alt attributes detected.")

    return {
        "score": score,
        "status": "strong" if score >= 75 else "moderate" if score >= 45 else "weak",
        "strengths": strengths,
        "gaps": gaps,
        "priority_actions": [
            "Rewrite homepage title and meta description for target keywords.",
            "Add/validate one H1 per page and structured data for org/services.",
            "Publish cluster pages around key services + buyer intent terms.",
        ],
    }


def _build_paid_media_analysis(text: str) -> Dict[str, Any]:
    lowered = (text or "").lower()
    paid_tokens = ["google ads", "ppc", "facebook ads", "meta ads", "sponsored", "ad campaign", "remarketing"]
    found = [t for t in paid_tokens if t in lowered]
    return {
        "signals_detected": found,
        "maturity": "active" if found else "unknown_or_low_visibility",
        "assessment": (
            "Paid media signals are visible in public footprint."
            if found else
            "No reliable paid media signals were detected publicly; this usually means low spend, hidden strategy, or limited landing-page architecture."
        ),
        "priority_actions": [
            "Build campaign-specific landing pages tied to one service and one audience.",
            "Set conversion tracking and cost-per-qualified-lead targets before scaling.",
            "Run branded vs non-branded split to isolate true demand generation.",
        ],
    }


def _build_social_media_analysis(handles: Dict[str, str], text: str) -> Dict[str, Any]:
    handles = handles or {}
    active_channels = [k for k, v in handles.items() if v]
    lowered = (text or "").lower()
    content_tokens = ["case study", "insight", "webinar", "podcast", "newsletter", "video", "testimonial"]
    content_signals = [t for t in content_tokens if t in lowered]
    return {
        "active_channels": active_channels,
        "channel_count": len(active_channels),
        "content_signals_detected": content_signals,
        "assessment": (
            f"Social footprint detected across {', '.join(active_channels)}."
            if active_channels else
            "No strong social profile footprint detected from public signals."
        ),
        "priority_actions": [
            "Pick one primary channel aligned to ICP and publish weekly proof-led content.",
            "Repurpose one case study into 4-6 social assets with a direct CTA.",
            "Standardize profile messaging to match website UVP and offer.",
        ],
    }


def _build_swot(enrichment: Dict[str, Any], seo: Dict[str, Any], social: Dict[str, Any], paid: Dict[str, Any]) -> Dict[str, List[str]]:
    uvp = enrichment.get("unique_value_proposition") or "Clear differentiation not yet explicit."
    advantages = enrichment.get("competitive_advantages") or "Competitive edge not strongly articulated."
    target_market = enrichment.get("target_market") or "Target market definition is limited."
    competitors = enrichment.get("competitors") or []
    strengths = [
        uvp[:180],
        advantages[:180],
        f"Brand presence score indicates {seo.get('status', 'mixed')} SEO foundations.",
    ]
    weaknesses = [
        *(seo.get("gaps") or [])[:2],
        "Paid media operating model is not clearly evidenced in public footprint."
        if not paid.get("signals_detected") else "Paid media maturity requires tighter measurement discipline.",
        "Social proof and conversion architecture can be strengthened." if social.get("channel_count", 0) < 2 else "Multi-channel social presence exists but conversion messaging should be unified.",
    ]
    opportunities = [
        f"Own category language around {target_market} with high-intent service pages.",
        "Launch proof-led funnel: case study -> diagnostic CTA -> booked strategy call.",
        "Convert competitor gaps into offer positioning and ROI messaging.",
    ]
    threats = [
        f"Competitive pressure from {', '.join(competitors[:3])}." if competitors else "Competitive pressure from better-optimized category players.",
        "Weak SERP/paid visibility can compress inbound pipeline quality.",
        "Message inconsistency across web/social can reduce conversion trust.",
    ]
    return {
        "strengths": strengths[:3],
        "weaknesses": weaknesses[:4],
        "opportunities": opportunities[:3],
        "threats": threats[:3],
    }


def _build_competitor_swot(competitors: List[str], target_market: str, uvp: str, enrichment: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    enrichment = enrichment or {}
    industry = enrichment.get("industry") or "their sector"
    products = enrichment.get("main_products_services") or "core services"
    business_name = enrichment.get("business_name") or "your business"
    comp_analysis = enrichment.get("competitor_analysis") or ""

    snapshots = []
    for idx, name in enumerate((competitors or [])[:5]):
        mentioned_in_analysis = name.lower() in comp_analysis.lower() if comp_analysis else False

        strengths = []
        if mentioned_in_analysis:
            strengths.append(f"{name} has identifiable presence in {industry} based on market signals.")
        else:
            strengths.append(f"{name} competes in {industry}, likely capturing existing demand.")
        if idx == 0:
            strengths.append("Probable first-mover or category-leader positioning among discovered competitors.")
        elif idx < 3:
            strengths.append(f"Ranked #{idx+1} in competitive signal density for {target_market or 'this market'}.")

        weaknesses = [f"Public differentiation depth vs {business_name} is unclear from available signals."]
        if not mentioned_in_analysis:
            weaknesses.append("Limited data available — intelligence gap may mask real competitive capability.")
        else:
            weaknesses.append(f"Messaging appears generic relative to {business_name}'s positioning around {products}.")

        opportunities = [
            f"Out-position {name} with sharper UVP for {target_market or 'core buyers'}: {uvp[:80]}." if uvp else f"Out-position {name} with clearer value articulation for {target_market or 'core buyers'}.",
            f"Use evidence-led messaging around {products} to contrast against {name}'s generic market claims.",
        ]

        threat_level = "high" if idx == 0 else ("medium" if idx < 3 else "low")

        snapshots.append({
            "name": name,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "opportunities_against_them": opportunities,
            "threat_level": threat_level,
        })
    return snapshots


def _build_cmo_priority_actions(swot: Dict[str, List[str]], seo: Dict[str, Any], paid: Dict[str, Any], social: Dict[str, Any]) -> List[str]:
    actions = [
        "Rebuild homepage hero + service pages around one quantified value promise and one CTA.",
        "Execute SEO technical quick wins (title/meta/H1/schema/canonical) in the next 7 days.",
        "Create 3 proof assets (case study, testimonial, before/after outcome) and reuse across site + social.",
        "Launch or tighten paid funnel measurement: CPL, MQL quality, and conversion-to-sale by channel.",
        "Run monthly competitor benchmark across SEO visibility, offer messaging, and social proof depth.",
    ]
    if seo.get("status") == "weak":
        actions.insert(0, "Prioritize SEO foundation fixes before scaling paid spend.")
    if social.get("channel_count", 0) == 0:
        actions.append("Establish one primary social channel and publish weekly authority content.")
    if not paid.get("signals_detected"):
        actions.append("Pilot one tightly scoped paid campaign with conversion tracking before scale.")
    return actions[:7]


def _build_intelligence_gaps(enrichment: Dict[str, Any], crawl_pages: List[Dict[str, Any]], edge_meta: Dict[str, Any]) -> List[str]:
    gaps: List[str] = []
    if not enrichment.get("business_name"):
        gaps.append("Business legal/trading name could not be confidently resolved from public footprint.")
    if not enrichment.get("main_products_services"):
        gaps.append("Products/services copy is sparse; deeper service-page crawl or gated content access is required.")
    if not enrichment.get("competitors"):
        gaps.append("Competitor entities were not confidently extracted from search intelligence in this scan window.")
    social_handles = enrichment.get("social_handles") or {}
    if not any(v for v in social_handles.values()):
        gaps.append("No social handles were verified from website or search sources.")
    if not enrichment.get("abn"):
        gaps.append("ABN was not confidently verified from discovered public signals.")
    if not crawl_pages:
        gaps.append("Only homepage content was available; internal deep pages were inaccessible or not discoverable.")
    if edge_meta.get("market_analysis_failed"):
        gaps.append("Market analysis edge function returned no usable payload for this business context.")
    if edge_meta.get("market_scorer_failed"):
        gaps.append("Market signal scoring was unavailable, reducing confidence calibration quality.")
    return gaps


# ─── Constants ───

QUESTIONS_TEXT = {
    1: "What's the name of the business you're operating, and what industry does it sit in?",
    2: "Where would you place the business today - idea, early-stage, established, or enterprise - and roughly how long has it been operating?",
    3: "Where is the business primarily based? City and state is fine.",
    4: "Who do you primarily sell to, and what problem are they hiring you to solve?",
    5: "What do you actually sell today - and why do clients choose you over alternatives?",
    6: "How big is the team today, and where do you personally spend most of your time?",
    7: "In plain terms - why does this business exist, and what would success look like in three years?",
    8: "What are the most important goals for the next 12 months - and what's getting in the way right now?",
    9: "How do you expect the business to grow - new markets, new offers, partnerships, or scale?",
}

_WATCHTOWER_BRAIN_FALLBACK = (
    "You are BIQc-02, the Senior Strategic Architect. "
    "Extract the 17-Point Strategic Map. JSON output only."
)


# ─── Helpers ───

def _parse_business_identity(answer: str) -> Dict[str, Optional[str]]:
    if "," in answer:
        name, industry = [p.strip() for p in answer.split(",", 1)]
        return {"business_name": name, "industry": industry}
    if " in " in answer.lower():
        name, industry = [p.strip() for p in re.split(r"\s+in\s+", answer, maxsplit=1, flags=re.IGNORECASE)]
        return {"business_name": name, "industry": industry}
    return {"business_name": answer.strip(), "industry": None}

def _parse_business_stage(answer: str) -> Dict[str, Optional[str]]:
    stage_match = re.search(r"(idea|early[-\s]?stage|established|enterprise)", answer, re.IGNORECASE)
    stage = stage_match.group(1).lower().replace(" ", "-") if stage_match else None
    years_match = re.search(r"(\d+(?:\.\d+)?)", answer)
    years = years_match.group(1) if years_match else None
    return {"business_stage": stage, "years_operating": years}

def _parse_location(answer: str) -> Dict[str, Optional[str]]:
    """Parse location into a single 'location' string."""
    return {"location": answer.strip()}

def _extract_team_size(answer: str) -> Optional[int]:
    match = re.search(r"(\d+)", answer)
    return int(match.group(1)) if match else None


# ═══════════════════════════════════════════════════════════════
# ROUTE HANDLERS (extracted from server.py lines 2503-3553)
# ═══════════════════════════════════════════════════════════════

@router.get("/calibration/status")
async def get_calibration_status(current_user: dict = Depends(get_current_user)):
    """
    Calibration status — checks strategic_console_state FIRST (authoritative),
    then falls back to user_operator_profile.
    Super admins can always skip calibration.
    """
    user_id = current_user.get("id")

    try:
        user_name = None
        try:
            user_row = await get_user_by_id(user_id)
            user_name = user_row.get("full_name") if user_row else None
        except Exception:
            pass

        # SUPER ADMIN NOTE: Super admins see calibration like everyone else
        # but have skip/back buttons on the calibration page.
        # They are NOT auto-bypassed — they see everything.

        # PRIORITY 1: Check strategic_console_state (new authoritative table)
        try:
            scs = get_sb().table("strategic_console_state").select(
                "status, current_step, is_complete"
            ).eq("user_id", user_id).order("updated_at", desc=True).limit(1).execute()
            if scs.data and scs.data[0].get("is_complete"):
                logger.info(f"[calibration/status] User {user_id} COMPLETE via strategic_console_state")
                return JSONResponse(status_code=200, content={
                    "status": "COMPLETE", "user_name": user_name
                })
        except Exception:
            pass

        # PRIORITY 2: Check user_operator_profile (legacy)
        op_result = safe_query_single(
            get_sb().table("user_operator_profile").select(
                "persona_calibration_status, operator_profile"
            ).eq("user_id", user_id)
        )

        if op_result.data:
            pcs = op_result.data.get("persona_calibration_status")
            op = op_result.data.get("operator_profile") or {}
            cal_step = op.get("calibration_step", 0)

            if pcs == "complete":
                return JSONResponse(status_code=200, content={
                    "status": "COMPLETE", "user_name": user_name
                })

            if pcs in ("in_progress", "recalibrating") or cal_step > 0:
                return JSONResponse(status_code=200, content={
                    "status": "IN_PROGRESS",
                    "calibration_step": cal_step,
                    "user_name": user_name,
                    "mode": "PARTIAL"
                })

        return JSONResponse(status_code=200, content={
            "status": "NEEDS_CALIBRATION",
            "calibration_step": 0,
            "user_name": user_name,
            "mode": "NEW"
        })

    except RuntimeError as e:
        logger.error(f"FATAL: Calibration status SDK error: {e}")
        raise HTTPException(status_code=500, detail="Internal SDK error — contact support")
    except Exception as e:
        logger.error(f"Calibration status error: {e}")
        raise HTTPException(status_code=500, detail="Calibration check failed")


@router.post("/calibration/skip")
async def skip_calibration(current_user: dict = Depends(get_current_user)):
    """Super admin only — skip calibration entirely and mark as complete."""
    user_role = current_user.get("role", "user")
    user_email = (current_user.get("email") or "").strip().lower()
    # Master admin gate sourced from BIQC_MASTER_ADMIN_EMAIL env — NOT a
    # hard-coded address. Previously this hard-coded the old pre-rebrand
    # email, which meant the skip gate would have silently broken the moment
    # Andreas's account was migrated to a different identity provider.
    master_admin_email = (os.environ.get("BIQC_MASTER_ADMIN_EMAIL") or "").strip().lower()
    is_master_admin = bool(master_admin_email) and user_email == master_admin_email
    if user_role not in ("superadmin", "admin") and not is_master_admin:
        raise HTTPException(status_code=403, detail="Super admin only")
    
    user_id = current_user["id"]
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # Mark calibration complete in user_operator_profile
    try:
        existing = get_sb().table("user_operator_profile").select("user_id").eq("user_id", user_id).maybe_single().execute()
        if existing.data:
            get_sb().table("user_operator_profile").update({
                "persona_calibration_status": "complete",
                "operator_profile": {"onboarding_state": {"completed": True, "completed_at": now_iso}, "console_state": {"status": "COMPLETE", "updated_at": now_iso}},
                "updated_at": now_iso,
            }).eq("user_id", user_id).execute()
        else:
            get_sb().table("user_operator_profile").insert({
                "user_id": user_id,
                "persona_calibration_status": "complete",
                "operator_profile": {"onboarding_state": {"completed": True, "completed_at": now_iso}, "console_state": {"status": "COMPLETE", "updated_at": now_iso}},
            }).execute()
    except Exception as e:
        logger.warning(f"[calibration/skip] operator_profile write: {e}")
    
    # Mark strategic_console_state complete
    try:
        get_sb().table("strategic_console_state").upsert({
            "user_id": user_id, "status": "COMPLETE", "is_complete": True, "current_step": 17, "updated_at": now_iso
        }).execute()
    except Exception as e:
        logger.warning(f"[calibration/skip] console_state write: {e}")
    
    logger.info(f"[calibration/skip] Super admin {user_email} skipped calibration")
    return {"ok": True, "message": "Calibration skipped — super admin bypass"}



@router.post("/calibration/defer")
async def defer_calibration(request: Request):
    """Set calibration as deferred. Writes to user_operator_profile (authoritative) and business_profiles."""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        now_iso = datetime.now(timezone.utc).isoformat()

        # PRIMARY: Write to user_operator_profile
        try:
            existing_op = get_sb().table("user_operator_profile").select("user_id").eq("user_id", user_id).maybe_single().execute()
            if existing_op.data:
                get_sb().table("user_operator_profile").update({
                    "persona_calibration_status": "deferred"
                }).eq("user_id", user_id).execute()
            else:
                get_sb().table("user_operator_profile").insert({
                    "user_id": user_id,
                    "persona_calibration_status": "deferred",
                    "operator_profile": {}
                }).execute()
        except Exception as op_err:
            logger.warning(f"[calibration/defer] user_operator_profile write failed: {op_err}")

        # SECONDARY: business_profiles for backward compat
        profile = await get_business_profile_supabase(get_sb(), user_id)
        if not profile:
            profile_data = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "last_calibration_step": 0,
                "created_at": now_iso,
                "updated_at": now_iso
            }
            try:
                get_sb().table("business_profiles").insert(profile_data).execute()
            except Exception:
                # calibration_status column removed
                get_sb().table("business_profiles").insert(profile_data).execute()
        else:
            try:
                get_sb().table("business_profiles").update({
                    "last_calibration_step": 0,
                    "updated_at": now_iso
                }).eq("id", profile.get("id")).execute()
            except Exception:
                pass
        return {"ok": True}
    except Exception as e:
        logger.error(f"[calibration/defer] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to defer calibration")


@router.post("/calibration/reset")
async def reset_calibration(request: Request):
    """Reset calibration — archives current persona, sets status to 'recalibrating'."""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        existing = get_sb().table("user_operator_profile").select("*").eq("user_id", user_id).maybe_single().execute()
        if existing.data:
            archived = {
                "agent_persona": existing.data.get("agent_persona"),
                "agent_instructions": existing.data.get("agent_instructions"),
                "archived_at": now_iso,
            }
            current_profile = existing.data.get("operator_profile") or {}
            archives = current_profile.get("persona_archives", [])
            archives.append(archived)
            current_profile["persona_archives"] = archives
            get_sb().table("user_operator_profile").update({
                "persona_calibration_status": "recalibrating",
                "operator_profile": current_profile,
            }).eq("user_id", user_id).execute()
        else:
            get_sb().table("user_operator_profile").insert({
                "user_id": user_id,
                "persona_calibration_status": "recalibrating",
                "operator_profile": {},
            }).execute()
        logger.info(f"[calibration/reset] Reset for {user_id}")
        return {"ok": True, "status": "recalibrating"}
    except Exception as e:
        logger.error(f"[calibration/reset] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset calibration")


@router.get("/lifecycle/state")
async def get_lifecycle_state(request: Request):
    """Returns full lifecycle state for deterministic routing."""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        calibration_complete = False
        calibration_status = "incomplete"
        console_status = "NOT_STARTED"
        console_step = 0

        # PRIORITY 1: Check strategic_console_state (authoritative)
        try:
            scs = get_sb().table("strategic_console_state").select(
                "status, current_step, is_complete"
            ).eq("user_id", user_id).order("updated_at", desc=True).limit(1).execute()
            if scs.data and scs.data[0].get("is_complete"):
                calibration_complete = True
                calibration_status = "complete"
                console_status = scs.data[0].get("status", "COMPLETED")
                console_step = scs.data[0].get("current_step", 17)
                logger.info(f"[lifecycle/state] User {user_id} resolved via strategic_console_state")
        except Exception:
            pass

        # PRIORITY 2: Check user_operator_profile (fallback)
        if not calibration_complete:
            try:
                op_result = safe_query_single(
                    get_sb().table("user_operator_profile").select(
                        "persona_calibration_status, operator_profile, agent_persona"
                    ).eq("user_id", user_id)
                )
                if op_result.data:
                    calibration_status = op_result.data.get("persona_calibration_status", "incomplete")
                    calibration_complete = calibration_status == "complete"
                    op_profile = op_result.data.get("operator_profile") or {}
                    cs = op_profile.get("console_state", {})
                    console_status = cs.get("status", "NOT_STARTED")
                    console_step = cs.get("current_step", 0)

                    if calibration_complete and console_status == "IN_PROGRESS":
                        op_profile["console_state"] = {
                            "status": "COMPLETE",
                            "current_step": 17,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                        get_sb().table("user_operator_profile").update(
                            {"operator_profile": op_profile}
                        ).eq("user_id", user_id).execute()
                        console_status = "COMPLETE"
                        console_step = 17
            except Exception:
                pass

        onboarding_complete = calibration_complete  # If calibration done, onboarding is done
        onboarding_step = 14 if calibration_complete else 0
        if not calibration_complete:
            try:
                op_result2 = safe_query_single(
                    get_sb().table("user_operator_profile").select("operator_profile").eq("user_id", user_id)
                )
                if op_result2.data:
                    ob_state = (op_result2.data.get("operator_profile") or {}).get("onboarding_state", {})
                    onboarding_complete = ob_state.get("completed", False)
                    onboarding_step = ob_state.get("current_step", 0)
            except Exception:
                pass

        integrations_connected = 0
        integration_names = []
        try:
            int_result = get_sb().table("integration_accounts").select("provider, category").eq("user_id", user_id).execute()
            if int_result.data:
                integrations_connected = len(int_result.data)
                integration_names = [r.get("provider", "") for r in int_result.data]
        except Exception:
            pass

        has_intelligence = False
        try:
            wi_result = get_sb().table("watchtower_insights").select("id").eq("user_id", user_id).limit(1).execute()
            has_intelligence = bool(wi_result.data)
        except Exception:
            pass

        domains_enabled = []
        workspace_id = None
        try:
            bp = await get_business_profile_supabase(get_sb(), user_id)
            if bp:
                ic = bp.get("intelligence_configuration", {}) or {}
                for d, cfg in (ic.get("domains", {}) or {}).items():
                    if cfg.get("enabled"):
                        domains_enabled.append(d)
        except Exception:
            pass

        try:
            from workspace_helpers import get_user_account
            account = await get_user_account(get_sb(), user_id)
            if account:
                workspace_id = account["id"]
        except Exception:
            pass

        return {
            "calibration": {"status": calibration_status, "complete": calibration_complete},
            "onboarding": {"complete": onboarding_complete, "step": onboarding_step},
            "console": {"status": console_status, "step": console_step},
            "integrations": {"count": integrations_connected, "providers": integration_names},
            "intelligence": {"has_events": has_intelligence, "domains_enabled": domains_enabled},
            "workspace_id": workspace_id,
        }
    except Exception as e:
        logger.error(f"[lifecycle/state] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get lifecycle state")


@router.post("/console/state")
async def save_console_state(request: Request, payload: ConsoleStateSave):
    """Persist console step. When status=COMPLETE, also marks authoritative routing tables."""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        existing_result = get_sb().table("user_operator_profile").select("operator_profile").eq("user_id", user_id).maybe_single().execute()
        existing_data = existing_result.data if existing_result else None
        op = (existing_data.get("operator_profile") if existing_data else None) or {}
        op["console_state"] = {"current_step": payload.current_step, "status": payload.status, "updated_at": now_iso}

        update_data = {"operator_profile": op}

        # When marking COMPLETE, also set persona_calibration_status (read by /calibration/status)
        if payload.status == "COMPLETE":
            update_data["persona_calibration_status"] = "complete"
            update_data["updated_at"] = now_iso

        if existing_data:
            get_sb().table("user_operator_profile").update(update_data).eq("user_id", user_id).execute()
        else:
            update_data["user_id"] = user_id
            get_sb().table("user_operator_profile").insert(update_data).execute()

        # When COMPLETE, also upsert strategic_console_state (authoritative for routing)
        if payload.status == "COMPLETE":
            try:
                get_sb().table("strategic_console_state").upsert({
                    "user_id": user_id,
                    "status": "COMPLETE",
                    "is_complete": True,
                    "current_step": payload.current_step,
                    "updated_at": now_iso,
                }).execute()
                logger.info(f"[console/state] Marked COMPLETE for user {user_id} in both tables")
            except Exception as e:
                logger.warning(f"[console/state] strategic_console_state upsert failed: {e}")

        return {"ok": True}
    except Exception as e:
        logger.error(f"[console/state] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save console state")


@router.post("/enrichment/website")
async def website_enrichment(request: Request, payload: WebsiteEnrichRequest):
    """Draft → Review → Commit enrichment flow."""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    url = payload.url.strip()
    if not url.startswith("http"):
        url = f"https://{url}"
    inbound_auth = request.headers.get("authorization") or ""

    if payload.action == "scan":
        try:
            scan_domain = normalize_domain(url)
            if payload.bust_cache:
                await invalidate_domain_scan(scan_domain)
                logger.info("[enrichment/website] cache BUSTED for %s (user requested)", scan_domain)
            cached = await get_domain_scan(scan_domain)
            if cached:
                logger.info("[enrichment/website] cache HIT for %s", scan_domain)

                # Apply the same sentinel / meta-gap / competitor filters to
                # cached payloads so older rows that predate the filters do
                # not leak garbage into downstream reports. Idempotent on
                # clean payloads.
                try:
                    cached = _sanitize_enrichment_payload(cached)
                except Exception as scrub_err:
                    logger.warning("[enrichment/website] cache sanitize failed: %s", scrub_err)

                # Persist cached enrichment to business_dna_enrichment so
                # Market & Position / Benchmark pages can read it for this user.
                # Without this, cache hits bypass the persistence block and the
                # user never gets enrichment data in the database.
                try:
                    if user_id:
                        profile_for_cache = await get_business_profile_supabase(get_sb(), user_id)
                        cache_profile_id = profile_for_cache.get("id") if profile_for_cache else None
                        if not cache_profile_id:
                            biz_name = cached.get("business_name") or cached.get("title") or "Business"
                            try:
                                new_p = get_sb().table("business_profiles").insert({
                                    "user_id": user_id,
                                    "business_name": biz_name,
                                    "website": url,
                                    "industry": cached.get("industry") or "",
                                }).execute()
                                if new_p.data:
                                    cache_profile_id = new_p.data[0]["id"]
                            except Exception:
                                pass
                        if cache_profile_id:
                            # Compute digital_footprint if not already in cached data
                            cached_fp = cached.get("digital_footprint") or {}
                            if not cached_fp.get("score"):
                                seo = cached.get("seo_analysis", {})
                                social = cached.get("social_media_analysis", {})
                                website = cached.get("website_health", {})
                                seo_s = seo.get("score", 0) if isinstance(seo, dict) else 0
                                social_s = social.get("channel_count", 0) * 25 if isinstance(social, dict) else 0
                                website_s = website.get("score", 0) if isinstance(website, dict) else 0
                                scores = [s for s in [seo_s, social_s, website_s] if s]
                                cached_fp = {
                                    "score": round(sum(scores) / len(scores)) if scores else 0,
                                    "seo_score": seo_s,
                                    "social_score": min(social_s, 100),
                                    "content_score": website_s,
                                    "computed_at": datetime.now(timezone.utc).isoformat(),
                                }
                                cached["digital_footprint"] = cached_fp
                            get_sb().table("business_dna_enrichment").upsert({
                                "user_id": user_id,
                                "business_profile_id": cache_profile_id,
                                "website_url": url,
                                "enrichment": cached,
                                "digital_footprint": cached_fp,
                                "updated_at": datetime.now(timezone.utc).isoformat(),
                            }, on_conflict="user_id,business_profile_id").execute()
                            logger.info("[enrichment/website] cache HIT persisted to business_dna_enrichment for user %s", user_id)
                except Exception as cache_persist_err:
                    logger.error("[enrichment/website] cache HIT persistence failed: %s", cache_persist_err)

                return {
                    "status": "draft",
                    "url": url,
                    "enrichment": cached,
                    "cached": True,
                    "message": "Cached scan result returned.",
                }

            seed_page = await _fetch_html_and_text(url, timeout=20)
            if not isinstance(seed_page, dict):
                seed_page = {"html": str(seed_page or ""), "text": str(seed_page or "")}
            page_text = seed_page.get("text") or ""
            raw_html = seed_page.get("html") or ""
            crawl_context = await _crawl_site_context(url, raw_html, max_pages=10)
            if not isinstance(crawl_context, dict):
                crawl_context = {"pages": [], "text": ""}
            crawled_pages = crawl_context.get("pages") or []
            crawled_text = crawl_context.get("text") or ""

            domain = _extract_domain(url)
            page_title = _extract_title(raw_html)
            meta_description = _extract_meta_content(raw_html, "description") or _extract_meta_content(raw_html, "og:description")
            og_site_name = _extract_meta_content(raw_html, "og:site_name") or _extract_meta_content(raw_html, "twitter:title")
            business_name_hint = _clean_business_name(og_site_name) or _clean_business_name(page_title) or domain.split(".")[0].replace("-", " ").title()
            service_lines = _extract_service_lines(f"{page_text}\n{crawled_text}")
            competitor_query = f'"{business_name_hint}" competitors australia {page_title or ""}'.strip()
            company_query = f"site:{domain} company profile services about"
            abn_query = f"{domain} ABN"
            location_query = f'"{business_name_hint}" locations office address "{domain}"'
            contact_query = f'"{business_name_hint}" contact email "{domain}"'
            review_query = f'"{business_name_hint}" reviews testimonials case study'
            review_google_query = f'site:google.com/maps OR site:trustpilot.com OR site:productreview.com.au "{business_name_hint}" reviews rating'
            review_glassdoor_query = f'site:glassdoor.com.au OR site:glassdoor.com OR site:seek.com.au "{business_name_hint}" reviews rating employees'
            review_indeed_query = f'"{business_name_hint}" employee reviews rating site:indeed.com OR site:glassdoor.com'

            (company_search, competitor_search, abn_search, location_search, contact_search, review_search,
             google_review_search, glassdoor_review_search,
             indeed_review_search) = await asyncio.gather(
                serper_search(company_query, gl="au", hl="en", num=10),
                serper_search(competitor_query, gl="au", hl="en", num=10),
                serper_search(abn_query, gl="au", hl="en", num=10),
                serper_search(location_query, gl="au", hl="en", num=10),
                serper_search(contact_query, gl="us", hl="en", num=20),
                serper_search(review_query, gl="au", hl="en", num=10),
                serper_search(review_google_query, num=10),
                serper_search(review_glassdoor_query, num=10),
                serper_search(review_indeed_query, num=10),
            )
            def _ensure_search_payload(value):
                if isinstance(value, dict):
                    return value
                if isinstance(value, list):
                    return {"results": value}
                return {"results": [], "error": f"invalid_payload:{type(value).__name__}"}

            company_search = _ensure_search_payload(company_search)
            competitor_search = _ensure_search_payload(competitor_search)
            abn_search = _ensure_search_payload(abn_search)
            location_search = _ensure_search_payload(location_search)
            contact_search = _ensure_search_payload(contact_search)
            review_search = _ensure_search_payload(review_search)
            google_review_search = _ensure_search_payload(google_review_search)
            glassdoor_review_search = _ensure_search_payload(glassdoor_review_search)
            indeed_review_search = _ensure_search_payload(indeed_review_search)
            for search_payload in (
                company_search,
                competitor_search,
                abn_search,
                location_search,
                contact_search,
                review_search,
                google_review_search,
                glassdoor_review_search,
                indeed_review_search,
            ):
                normalized_rows = []
                for row in (search_payload.get("results") or []):
                    if isinstance(row, dict):
                        normalized_rows.append(row)
                    elif isinstance(row, str):
                        normalized_rows.append({"title": "", "snippet": row, "link": ""})
                search_payload["results"] = normalized_rows

            google_reviews = _parse_google_reviews(google_review_search, business_name_hint)
            merged_employer_results = {
                "results": (glassdoor_review_search.get("results") or []) + (indeed_review_search.get("results") or []),
            }
            glassdoor_reviews = _parse_glassdoor_reviews(merged_employer_results, business_name_hint)
            review_aggregation = _aggregate_reviews(google_reviews, glassdoor_reviews)

            combined_text = "\n\n".join([
                page_text[:12000],
                crawled_text[:22000],
                "\n".join([f"- {r.get('title')}: {r.get('snippet')}" for r in (company_search.get("results") or [])]),
                "\n".join([f"- {r.get('title')}: {r.get('snippet')}" for r in (competitor_search.get("results") or [])]),
                "\n".join([f"- {r.get('title')}: {r.get('snippet')}" for r in (abn_search.get("results") or [])]),
                "\n".join([f"- {r.get('title')}: {r.get('snippet')}" for r in (location_search.get("results") or [])]),
                "\n".join([f"- {r.get('title')}: {r.get('snippet')}" for r in (contact_search.get("results") or [])]),
                "\n".join([f"- {r.get('title')}: {r.get('snippet')}" for r in (review_search.get("results") or [])]),
                "\n".join([f"- Google Review: {r.get('snippet', '')}" for r in (google_review_search.get("results") or [])]),
                "\n".join([f"- Glassdoor: {r.get('snippet', '')}" for r in (glassdoor_review_search.get("results") or [])]),
            ])
            abn_candidates = _extract_abn_candidates(combined_text)

            from core.ai_core import get_ai_response
            synthesis_prompt = (
                f"Analyze this business website and deep web signals for onboarding.\n"
                f"URL: {url}\n"
                "Return JSON keys: business_name, description, industry, main_products_services, target_market, "
                "unique_value_proposition, competitive_advantages, competitors, competitor_analysis, market_position, "
                "abn, social_handles, trust_signals, executive_summary, confidence, "
                "cmo_executive_brief, seo_analysis, paid_media_analysis, social_media_analysis, website_health, swot, competitor_swot, cmo_priority_actions, customer_review_intelligence, staff_review_intelligence, recommended_keywords, aeo_strategy.\n"
                "For customer_review_intelligence use source-verifiable customer reviews only (platform-attributed, date-bounded to last 12 months when dates are available), include positive and negative signals and operations action plan.\n"
                "For staff_review_intelligence use source-verifiable evidence only (platform-attributed, date-bounded to last 12 months when dates are available). "
                "Do not infer unpublished team dynamics.\n"
                "If unknown, return empty string. competitors must be array of names.\n\n"
                f"DATA:\n{combined_text[:18000]}"
            )
            try:
                ai_json = await get_ai_response(
                    synthesis_prompt,
                    "general",
                    f"website_scan_{user_id}",
                    user_id=user_id,
                    metadata={"force_trinity": True, "context": "onboarding_deep_scan"},
                )
            except Exception as ai_error:
                logger.warning(f"[enrichment/website] AI synthesis unavailable, falling back to deterministic scan: {ai_error}")
                ai_json = {}

            enrichment = {
                "title": page_title,
                "description": meta_description or _extract_sentence_with_keywords(page_text, ["results", "strategy", "growth", "service"]),
                "business_name": business_name_hint,
                "industry": "unknown — insufficient website data for industry classification",
                "main_products_services": "; ".join(service_lines[:4]),
                "target_market": _infer_target_market(page_text, meta_description),
                "unique_value_proposition": meta_description or _extract_sentence_with_keywords(page_text, ["measurable results", "20 years", "tailor", "holistic"]),
                "competitive_advantages": _extract_sentence_with_keywords(page_text, ["20 years", "measurable results", "tailor", "ahead of the competition"]),
                "competitors": _infer_competitors_from_results(competitor_search.get("results") or [], business_name_hint, domain),
                "competitor_analysis": "",
                "market_position": "",
                "abn": abn_candidates[0] if abn_candidates else "",
                "abn_candidates": abn_candidates,
                "social_handles": _extract_social_handles_from_html(raw_html),
                "trust_signals": [],
                "executive_summary": "",
                "confidence": "high" if (ai_json and len(str(ai_json)) > 500) else ("medium" if combined_text and len(combined_text) > 2000 else "low"),
                "cmo_executive_brief": "",
                "seo_analysis": {},
                "paid_media_analysis": {},
                "social_media_analysis": {},
                "website_health": {},
                "swot": {},
                "competitor_swot": [],
                "cmo_priority_actions": [],
                "customer_review_intelligence": {},
                "staff_review_intelligence": {},
                "google_reviews": google_reviews,
                "glassdoor_reviews": glassdoor_reviews,
                "review_aggregation": review_aggregation,
                "sources": {
                    "company": company_search.get("results") or [],
                    "competitors": competitor_search.get("results") or [],
                    "abn": abn_search.get("results") or [],
                    "locations": location_search.get("results") or [],
                    "contacts": contact_search.get("results") or [],
                    "reviews": review_search.get("results") or [],
                    "google_reviews": google_review_search.get("results") or [],
                    "glassdoor_reviews": glassdoor_review_search.get("results") or [],
                    "indeed_reviews": indeed_review_search.get("results") or [],
                    "crawled_pages": crawled_pages,
                },
            }

            try:
                parsed = _extract_json_candidate(ai_json)
                if isinstance(parsed, dict):
                    # Sanitize the LLM's JSON payload BEFORE merge so nothing
                    # that fails our sentinel / meta-gap / competitor filters
                    # reaches the stored enrichment in the first place.
                    parsed = _sanitize_enrichment_payload(parsed)
                    enrichment.update({k: parsed.get(k, enrichment.get(k)) for k in enrichment.keys() if k in parsed})
                    if isinstance(parsed.get("competitors"), list):
                        enrichment["competitors"] = parsed.get("competitors")
                    if isinstance(parsed.get("trust_signals"), list):
                        enrichment["trust_signals"] = parsed.get("trust_signals")
                    if isinstance(parsed.get("competitor_swot"), list):
                        enrichment["competitor_swot"] = parsed.get("competitor_swot")
                    if isinstance(parsed.get("cmo_priority_actions"), list):
                        enrichment["cmo_priority_actions"] = parsed.get("cmo_priority_actions")
            except Exception:
                logger.warning("[enrichment/website] Could not parse AI JSON synthesis; using deterministic fallback")

            # Final sanitize pass on the merged enrichment: the deterministic
            # seed uses the industry sentinel string as a placeholder value
            # (line ~1979 "unknown — insufficient website data..."). Scrub it
            # and anything else that snuck through before persistence.
            enrichment = _sanitize_enrichment_payload(enrichment)

            # deterministic social handle fallback extraction across crawled content + search links.
            social_patterns = {
                "linkedin": r"https?://(?:www\.)?linkedin\.com/[\w\-/]+",
                "instagram": r"https?://(?:www\.)?instagram\.com/[\w\./-]+",
                "facebook": r"https?://(?:www\.)?facebook\.com/[\w\./-]+",
                "twitter": r"https?://(?:www\.)?(?:x|twitter)\.com/[\w\./-]+",
                "youtube": r"https?://(?:www\.)?youtube\.com/[\w\./?=&-]+",
                "tiktok": r"https?://(?:www\.)?tiktok\.com/[\w\./?=&-]+",
            }
            social_link_corpus = "\n".join([
                combined_text,
                "\n".join([(r.get("link") or "") for r in (contact_search.get("results") or [])]),
            ])
            for platform, pattern in social_patterns.items():
                if not enrichment["social_handles"].get(platform):
                    m = re.search(pattern, social_link_corpus, re.IGNORECASE)
                    if m:
                        enrichment["social_handles"][platform] = m.group(0)
            # Keep legacy alias for older UI branches while providing canonical twitter key.
            if enrichment["social_handles"].get("twitter") and not enrichment["social_handles"].get("x"):
                enrichment["social_handles"]["x"] = enrichment["social_handles"]["twitter"]

            # Edge intelligence orchestration: check cache, then fire uncached tools in parallel.
            async def _cached_edge(fn_name, payload_dict, auth):
                hit = await get_edge_result(fn_name, scan_domain)
                if isinstance(hit, dict):
                    return hit
                if hit is not None:
                    logger.warning(
                        "[enrichment/website] ignoring non-dict cached edge payload for %s (%s)",
                        fn_name,
                        type(hit).__name__,
                    )
                result = await _call_edge_function(fn_name, payload_dict, auth_header=auth)
                if isinstance(result, dict) and not _edge_result_failed(result):
                    asyncio.create_task(set_edge_result(fn_name, scan_domain, result))
                return result

            deep_recon, social_enrichment, competitor_monitor, market_analysis, market_scorer, browse_ai_reviews, semrush_intel = await asyncio.gather(
                _cached_edge("deep-web-recon", {"user_id": user_id, "website": url}, inbound_auth),
                _cached_edge("social-enrichment", {"website_url": url}, inbound_auth),
                _cached_edge("competitor-monitor", {"user_id": user_id}, inbound_auth),
                _cached_edge("market-analysis-ai", {
                    "product_or_service": enrichment.get("main_products_services", ""),
                    "region": "Australia",
                    "specific_question": f"Analyse the competitive positioning and market opportunity for {enrichment.get('business_name', '')} in the {enrichment.get('industry', '')} sector",
                }, inbound_auth),
                _cached_edge("market-signal-scorer", {"tenant_id": user_id}, inbound_auth),
                _cached_edge("browse-ai-reviews", {
                    "business_name": enrichment.get("business_name", ""),
                    "domain": domain,
                    "location": enrichment.get("location") or enrichment.get("geographic_focus") or "Australia",
                }, inbound_auth),
                _cached_edge("semrush-domain-intel", {"domain": domain, "database": "us"}, inbound_auth),
                return_exceptions=True,
            )
            if isinstance(deep_recon, Exception): deep_recon = {"error": str(deep_recon)}
            if isinstance(social_enrichment, Exception): social_enrichment = {"error": str(social_enrichment)}
            if isinstance(competitor_monitor, Exception): competitor_monitor = {"error": str(competitor_monitor)}
            if isinstance(market_analysis, Exception): market_analysis = {"error": str(market_analysis)}
            if isinstance(market_scorer, Exception): market_scorer = {"error": str(market_scorer)}
            if isinstance(browse_ai_reviews, Exception): browse_ai_reviews = {"error": str(browse_ai_reviews)}
            if isinstance(semrush_intel, Exception): semrush_intel = {"error": str(semrush_intel)}
            if not isinstance(deep_recon, dict): deep_recon = {"error": f"invalid_payload:{type(deep_recon).__name__}"}
            if not isinstance(social_enrichment, dict): social_enrichment = {"error": f"invalid_payload:{type(social_enrichment).__name__}"}
            if not isinstance(competitor_monitor, dict): competitor_monitor = {"error": f"invalid_payload:{type(competitor_monitor).__name__}"}
            if not isinstance(market_analysis, dict): market_analysis = {"error": f"invalid_payload:{type(market_analysis).__name__}"}
            if not isinstance(market_scorer, dict): market_scorer = {"error": f"invalid_payload:{type(market_scorer).__name__}"}
            if not isinstance(browse_ai_reviews, dict): browse_ai_reviews = {"error": f"invalid_payload:{type(browse_ai_reviews).__name__}"}
            if not isinstance(semrush_intel, dict): semrush_intel = {"error": f"invalid_payload:{type(semrush_intel).__name__}"}

            ai_errors = []
            edge_failures = [
                ("deep-web-recon", deep_recon),
                ("social-enrichment", social_enrichment),
                ("competitor-monitor", competitor_monitor),
                ("market-analysis-ai", market_analysis),
                ("market-signal-scorer", market_scorer),
                ("browse-ai-reviews", browse_ai_reviews),
                ("semrush-domain-intel", semrush_intel),
            ]
            for edge_fn_name, edge_result in edge_failures:
                if _edge_result_failed(edge_result):
                    ai_errors.append({
                        "function": edge_fn_name,
                        "error": str((edge_result or {}).get("error") or (edge_result or {}).get("detail") or "edge_function_failed"),
                        "status": (edge_result or {}).get("_http_status"),
                    })

            edge_meta = {
                "market_analysis_failed": _edge_result_failed(market_analysis),
                "market_scorer_failed": _edge_result_failed(market_scorer),
            }

            if isinstance(browse_ai_reviews, dict) and browse_ai_reviews.get("ok"):
                enrichment["browse_ai_reviews"] = browse_ai_reviews
                agg = browse_ai_reviews.get("aggregated") or {}
                if agg.get("customer_score") and not enrichment.get("google_reviews", {}).get("star_rating"):
                    enrichment.setdefault("google_reviews", {})["star_rating"] = agg["customer_score"]
                    enrichment["google_reviews"]["has_data"] = True
                if agg.get("staff_score") and not enrichment.get("glassdoor_reviews", {}).get("rating"):
                    enrichment.setdefault("glassdoor_reviews", {})["rating"] = agg["staff_score"]
                    enrichment["glassdoor_reviews"]["has_data"] = True
                if agg.get("top_positive"):
                    enrichment.setdefault("google_reviews", {}).setdefault("positive", []).extend(agg["top_positive"][:3])
                    enrichment["google_reviews"]["has_data"] = True
                if agg.get("top_negative"):
                    enrichment.setdefault("google_reviews", {}).setdefault("negative", []).extend(agg["top_negative"][:3])
                    enrichment["google_reviews"]["has_data"] = True
                if agg.get("top_staff_positive"):
                    enrichment.setdefault("glassdoor_reviews", {}).setdefault("positive", []).extend((agg.get("top_staff_positive") or [])[:3])
                if agg.get("top_staff_negative"):
                    enrichment.setdefault("glassdoor_reviews", {}).setdefault("negative", []).extend((agg.get("top_staff_negative") or [])[:3])
                if agg.get("customer_count"):
                    enrichment.setdefault("google_reviews", {})["review_count"] = agg["customer_count"]
                if browse_ai_reviews.get("customer_reviews"):
                    all_snippets = []
                    for cr in browse_ai_reviews["customer_reviews"]:
                        if not isinstance(cr, dict):
                            continue
                        for rv in (cr.get("reviews") or [])[:5]:
                            if not isinstance(rv, dict):
                                continue
                            all_snippets.append(f"[{cr.get('platform', 'review')}] {rv.get('text', '')[:200]}")
                    enrichment.setdefault("google_reviews", {}).setdefault("snippets", []).extend(all_snippets[:5])
                    enrichment["google_reviews"]["has_data"] = True
                if browse_ai_reviews.get("staff_reviews"):
                    all_staff_snippets = []
                    for sr in browse_ai_reviews["staff_reviews"]:
                        if not isinstance(sr, dict):
                            continue
                        for rv in (sr.get("reviews") or [])[:5]:
                            if not isinstance(rv, dict):
                                continue
                            all_staff_snippets.append(f"[{sr.get('platform', 'employer')}] {rv.get('text', '')[:200]}")
                    enrichment.setdefault("glassdoor_reviews", {}).setdefault("snippets", []).extend(all_staff_snippets[:5])
                    enrichment["glassdoor_reviews"]["has_data"] = True
                enrichment.setdefault("review_aggregation", {}).update({
                    "combined_score": agg.get("customer_score"),
                    "positive_count": len(agg.get("top_positive") or []),
                    "negative_count": len(agg.get("top_negative") or []),
                    "top_recent": (agg.get("top_recent") or [])[:3] or ((agg.get("top_positive") or [])[:2] + (agg.get("top_negative") or [])[:1]),
                    "has_data": bool(
                        agg.get("customer_score")
                        or agg.get("top_positive")
                        or agg.get("top_negative")
                        or agg.get("top_recent")
                    ),
                })

            enrichment["customer_review_intelligence"] = _build_customer_review_intelligence(
                enrichment.get("google_reviews") or {},
                enrichment.get("review_aggregation") or {},
                enrichment.get("browse_ai_reviews") or {},
                lookback_months=12,
            )

            customer_intel = enrichment.get("customer_review_intelligence") if isinstance(enrichment.get("customer_review_intelligence"), dict) else {}
            if customer_intel:
                enrichment.setdefault("review_aggregation", {}).update({
                    "combined_score": customer_intel.get("customer_score"),
                    "positive_count": customer_intel.get("positive_count"),
                    "negative_count": customer_intel.get("negative_count"),
                    "top_recent": (customer_intel.get("top_recent") or [])[:3],
                    "has_data": bool(customer_intel.get("has_data")),
                })

            enrichment["staff_review_intelligence"] = _build_staff_review_intelligence(
                enrichment.get("glassdoor_reviews") or {},
                enrichment.get("browse_ai_reviews") or {},
                lookback_months=12,
            )

            contact_corpus = "\n".join([
                combined_text,
                "\n".join([str(r.get("snippet") or "") for r in (contact_search.get("results") or [])]),
                "\n".join([str(r.get("snippet") or "") for r in (company_search.get("results") or [])]),
            ])
            detected_emails = _extract_contact_emails(contact_corpus, limit=20)
            location_corpus = "\n".join([
                combined_text,
                "\n".join([str(r.get("snippet") or "") for r in (location_search.get("results") or [])]),
                "\n".join([str(r.get("snippet") or "") for r in (company_search.get("results") or [])]),
            ])
            detected_locations = _extract_location_mentions(location_corpus, limit=10)
            if not detected_locations and enrichment.get("target_market"):
                detected_locations = [str(enrichment.get("target_market"))]

            enrichment["website_scan_summary"] = {
                "domain": domain,
                "full_business_name": enrichment.get("business_name") or business_name_hint,
                "abn": enrichment.get("abn") or (abn_candidates[0] if abn_candidates else ""),
                "locations_detected": detected_locations,
                "contact_emails_detected": detected_emails,
                "pages_scanned_count": 1 + len(crawled_pages),
                "pages_scanned": [url] + [p.get("url") for p in crawled_pages if isinstance(p, dict) and p.get("url")],
                "scan_scope": "website pages + public search signals",
            }

            social_edge_handles = (social_enrichment or {}).get("social_handles") or {}
            if isinstance(social_edge_handles, dict):
                for k, v in social_edge_handles.items():
                    if v and not enrichment["social_handles"].get(k):
                        enrichment["social_handles"][k] = v
                if enrichment["social_handles"].get("twitter") and not enrichment["social_handles"].get("x"):
                    enrichment["social_handles"]["x"] = enrichment["social_handles"]["twitter"]

            deep_signals = (deep_recon or {}).get("signals") or []
            if isinstance(deep_signals, list) and deep_signals:
                enrichment["trust_signals"] = (enrichment.get("trust_signals") or []) + [
                    (
                        s.get("summary")
                        or s.get("text")
                        or s.get("evidence")
                        or ""
                    )
                    for s in deep_signals
                    if isinstance(s, dict) and (
                        s.get("summary")
                        or s.get("text")
                        or s.get("evidence")
                    )
                ]
                enrichment["deep_recon_summary"] = (deep_recon or {}).get("executive_summary", "")
                enrichment["deep_recon_signals"] = deep_signals[:8]

            if isinstance(competitor_monitor, dict) and competitor_monitor.get("ok"):
                enrichment["competitor_monitor_summary"] = (
                    f"Competitor monitor detected {competitor_monitor.get('signals', 0)} fresh movement signal(s) "
                    f"and generated {competitor_monitor.get('actions', 0)} action item(s)."
                )

            analysis_payload = (market_analysis or {}).get("analysis") if isinstance(market_analysis, dict) else None
            if isinstance(analysis_payload, dict):
                if not enrichment.get("competitor_analysis") and analysis_payload.get("competitor_landscape"):
                    enrichment["competitor_analysis"] = str(analysis_payload.get("competitor_landscape"))
                if not enrichment.get("cmo_executive_brief") and analysis_payload.get("revenue_opportunity"):
                    enrichment["cmo_executive_brief"] = str(analysis_payload.get("revenue_opportunity"))
                if not enrichment.get("swot") and analysis_payload.get("swot"):
                    enrichment["swot"] = analysis_payload.get("swot")
                if analysis_payload.get("recommendations") and not enrichment.get("cmo_priority_actions"):
                    recs = []
                    for rec in analysis_payload.get("recommendations", [])[:7]:
                        if isinstance(rec, dict) and rec.get("action"):
                            recs.append(str(rec.get("action")))
                    if recs:
                        enrichment["cmo_priority_actions"] = recs

            if isinstance(market_scorer, dict):
                enrichment["market_intelligence_score"] = ((market_scorer.get("scores") or {}).get("overall_market_score"))
                enrichment["market_trajectory"] = market_scorer.get("trajectory")
                enrichment["market_evidence"] = market_scorer.get("evidence")

            if not enrichment.get("trust_signals"):
                inferred = []
                lowered = combined_text.lower()
                for token, label in [
                    ("20 years", "20+ years experience"),
                    ("iso", "ISO / certification mention"),
                    ("award", "Awards mention"),
                    ("testimonial", "Testimonials / social proof"),
                    ("case study", "Case studies"),
                    ("partner", "Partnership mention"),
                    ("accredited", "Accreditation mention"),
                ]:
                    if token in lowered:
                        inferred.append(label)
                enrichment["trust_signals"] = inferred
            else:
                # Normalize + dedupe trust signals to keep report clean.
                seen_ts = set()
                normalized_ts = []
                for item in (enrichment.get("trust_signals") or []):
                    val = str(item).strip()
                    if not val:
                        continue
                    key = val.lower()
                    if key in seen_ts:
                        continue
                    seen_ts.add(key)
                    normalized_ts.append(val)
                enrichment["trust_signals"] = normalized_ts[:12]

            if not enrichment.get("competitor_analysis") and enrichment.get("competitors"):
                enrichment["competitor_analysis"] = (
                    f"Search results indicate competition from {', '.join((enrichment.get('competitors') or [])[:3])}. "
                    f"Site messaging differentiates through {enrichment.get('unique_value_proposition') or 'tailored advisory and measurable outcomes'}.")

            if not enrichment.get("market_position"):
                target_market = enrichment.get("target_market") or "Australian businesses"
                if enrichment.get("unique_value_proposition"):
                    enrichment["market_position"] = (
                        f"{enrichment.get('business_name') or 'This business'} positions itself for {target_market} with a focus on "
                        f"{enrichment.get('unique_value_proposition')}."
                    )

            if not enrichment.get("executive_summary"):
                enrichment["executive_summary"] = (
                    f"{enrichment.get('business_name') or 'Business'} appears positioned in {enrichment.get('industry') or 'its sector'} with "
                    f"focus on {enrichment.get('main_products_services') or 'core services'}. "
                    f"Top competitor pressure: {enrichment.get('competitor_analysis') or 'to be validated through market signals'}."
                )

            enrichment["analysis_gaps"] = _build_intelligence_gaps(
                enrichment,
                crawled_pages,
                edge_meta if 'edge_meta' in locals() else {"market_analysis_failed": True, "market_scorer_failed": True},
            )

            seo_analysis = _build_seo_analysis(raw_html, page_text, page_title, meta_description)
            paid_media_analysis = _build_paid_media_analysis(combined_text)
            social_media_analysis = _build_social_media_analysis(enrichment.get("social_handles") or {}, combined_text)
            swot = _build_swot(enrichment, seo_analysis, social_media_analysis, paid_media_analysis)
            competitor_swot = _build_competitor_swot(
                enrichment.get("competitors") or [],
                enrichment.get("target_market") or "",
                enrichment.get("unique_value_proposition") or "",
                enrichment=enrichment,
            )
            cmo_priority_actions = _build_cmo_priority_actions(swot, seo_analysis, paid_media_analysis, social_media_analysis)

            # Deterministic baseline to guarantee rich CMO output even if AI returns sparse payloads.
            if not isinstance(enrichment.get("seo_analysis"), dict) or not enrichment.get("seo_analysis"):
                enrichment["seo_analysis"] = seo_analysis
            if not isinstance(enrichment.get("paid_media_analysis"), dict) or not enrichment.get("paid_media_analysis"):
                enrichment["paid_media_analysis"] = paid_media_analysis
            if not isinstance(enrichment.get("social_media_analysis"), dict) or not enrichment.get("social_media_analysis"):
                enrichment["social_media_analysis"] = social_media_analysis
            if not isinstance(enrichment.get("website_health"), dict) or not enrichment.get("website_health"):
                enrichment["website_health"] = {
                    "score": round((seo_analysis.get("score", 0) * 0.5) + (15 * min(1, len(enrichment.get("trust_signals") or []))) + (10 * min(1, len(enrichment.get("social_handles") or {})))),
                    "status": "strong" if seo_analysis.get("score", 0) >= 75 else "moderate" if seo_analysis.get("score", 0) >= 45 else "weak",
                    "summary": "Website condition assessed from technical SEO, trust signals, and social footprint.",
                }
            if not isinstance(enrichment.get("swot"), dict) or not enrichment.get("swot"):
                enrichment["swot"] = swot
            if not isinstance(enrichment.get("competitor_swot"), list) or not enrichment.get("competitor_swot"):
                enrichment["competitor_swot"] = competitor_swot
            if not isinstance(enrichment.get("cmo_priority_actions"), list) or not enrichment.get("cmo_priority_actions"):
                enrichment["cmo_priority_actions"] = cmo_priority_actions
            if not enrichment.get("cmo_executive_brief"):
                enrichment["cmo_executive_brief"] = (
                    f"{enrichment.get('business_name') or 'Business'} has a {enrichment.get('website_health', {}).get('status', 'mixed')} digital foundation. "
                    f"Primary opportunity is to tighten positioning for {enrichment.get('target_market') or 'its core market'}, "
                    f"improve discoverability via SEO, and operationalize proof-led acquisition across owned and paid channels."
                )

            if isinstance(semrush_intel, dict) and semrush_intel.get("ok"):
                sr_seo = semrush_intel.get("seo_analysis") or {}
                if sr_seo.get("organic_keywords"):
                    enrichment["seo_analysis"] = {
                        **enrichment.get("seo_analysis", {}),
                        "semrush_rank": sr_seo.get("semrush_rank"),
                        "organic_keywords": sr_seo.get("organic_keywords"),
                        "organic_traffic": sr_seo.get("organic_traffic"),
                        "organic_cost_usd": sr_seo.get("organic_cost_usd"),
                        "featured_snippets": sr_seo.get("featured_snippets"),
                        "top_organic_keywords": sr_seo.get("top_organic_keywords", [])[:10],
                        "score": sr_seo.get("score") or enrichment.get("seo_analysis", {}).get("score"),
                        "status": sr_seo.get("status") or enrichment.get("seo_analysis", {}).get("status"),
                        "source": "semrush",
                    }
                sr_paid = semrush_intel.get("paid_media_analysis") or {}
                if sr_paid.get("adwords_keywords") is not None:
                    enrichment["paid_media_analysis"] = {
                        **enrichment.get("paid_media_analysis", {}),
                        "adwords_keywords": sr_paid.get("adwords_keywords"),
                        "adwords_traffic": sr_paid.get("adwords_traffic"),
                        "adwords_cost_usd": sr_paid.get("adwords_cost_usd"),
                        "top_paid_keywords": sr_paid.get("top_paid_keywords", [])[:10],
                        "maturity": sr_paid.get("maturity") or enrichment.get("paid_media_analysis", {}).get("maturity"),
                        "assessment": sr_paid.get("assessment") or enrichment.get("paid_media_analysis", {}).get("assessment"),
                        "source": "semrush",
                    }
                sr_comp = semrush_intel.get("competitor_analysis") or {}
                if sr_comp.get("organic_competitors"):
                    enrichment["semrush_competitors"] = sr_comp.get("organic_competitors", [])
                    sr_comp_names = [c.get("domain", "") for c in sr_comp.get("organic_competitors", []) if c.get("domain")]
                    existing = enrichment.get("competitors") or []
                    merged = list(dict.fromkeys(existing + sr_comp_names))
                    enrichment["competitors"] = merged[:10]
                enrichment["semrush_data"] = semrush_intel

            seo_current = enrichment.get("seo_analysis") or {}
            paid_current = enrichment.get("paid_media_analysis") or {}
            top_organic_keywords = seo_current.get("top_organic_keywords") or []
            top_paid_keywords = paid_current.get("top_paid_keywords") or []
            recommended_keywords = []
            for row in top_organic_keywords[:8]:
                if isinstance(row, dict):
                    kw = str(row.get("keyword") or "").strip()
                    if kw:
                        recommended_keywords.append(kw)
            if len(recommended_keywords) < 8:
                for row in top_paid_keywords[:6]:
                    if isinstance(row, dict):
                        kw = str(row.get("keyword") or "").strip()
                        if kw:
                            recommended_keywords.append(kw)
            if not recommended_keywords and enrichment.get("main_products_services"):
                recommended_keywords = [p.strip() for p in re.split(r"[;,]", str(enrichment.get("main_products_services"))) if p.strip()][:6]
            recommended_keywords = list(dict.fromkeys(recommended_keywords))[:10]

            seo_rank_summary = (
                f"SEMrush rank {seo_current.get('semrush_rank')}, ~{seo_current.get('organic_keywords') or 0} ranking keywords, "
                f"~{seo_current.get('organic_traffic') or 0} monthly organic visits."
                if seo_current.get("semrush_rank") or seo_current.get("organic_keywords") or seo_current.get("organic_traffic")
                else "SEO ranking data not yet captured — enrichment will populate on scan."
            )
            paid_rank_summary = (
                f"~{paid_current.get('adwords_keywords') or 0} paid keywords, ~{paid_current.get('adwords_traffic') or 0} monthly paid visits, "
                f"estimated spend ${paid_current.get('adwords_cost_usd') or 0}."
                if paid_current.get("adwords_keywords") is not None or paid_current.get("adwords_traffic") is not None
                else "Paid marketing ranking data not yet captured — enrichment will populate on scan."
            )

            enrichment["recommended_keywords"] = recommended_keywords
            enrichment["aeo_strategy"] = [
                "Publish service-page FAQs with concise, answer-first structure and FAQ schema markup.",
                "Create one evidence-backed answer page per high-intent keyword cluster to improve AI answer engine coverage.",
                "Use structured headings (problem -> proof -> outcome -> CTA) to improve retrieval and snippet extraction quality.",
            ]
            enrichment["seo_rank_summary"] = seo_rank_summary
            enrichment["paid_rank_summary"] = paid_rank_summary
            enrichment["industry_action_items"] = _build_industry_action_items(
                str(enrichment.get("industry") or ""),
                seo_current if isinstance(seo_current, dict) else {},
                paid_current if isinstance(paid_current, dict) else {},
            )
            enrichment["competitor_leaders"] = _build_competitor_leaders(enrichment, semrush_intel if isinstance(semrush_intel, dict) else {})
            enrichment["customer_review_highlights"] = _build_customer_review_highlights(
                enrichment.get("customer_review_intelligence") if isinstance(enrichment.get("customer_review_intelligence"), dict) else {}
            )
            enrichment["staff_review_highlights"] = _build_staff_review_highlights(
                enrichment.get("staff_review_intelligence") if isinstance(enrichment.get("staff_review_intelligence"), dict) else {}
            )
            if not enrichment.get("forensic_memo"):
                enrichment["forensic_memo"] = (
                    f"Forensic Marketing Memo: {enrichment.get('business_name') or 'This business'} appears to operate in "
                    f"{enrichment.get('industry') or 'an undefined category'} and offers {enrichment.get('main_products_services') or 'services not clearly stated'}. "
                    f"Current SEO position: {seo_rank_summary} Current paid position: {paid_rank_summary} "
                    f"Priority should focus on keyword-cluster authority, evidence-led conversion assets, and offer-page clarity."
                )

            try:
                enrichment.setdefault("sources", {})
                enrichment["sources"]["edge_tools"] = {
                    "deep_web_recon": {
                        "ok": not _edge_result_failed(deep_recon),
                        "status": (deep_recon or {}).get("_http_status"),
                    } if 'deep_recon' in locals() else {"ok": False},
                    "social_enrichment": {
                        "ok": not _edge_result_failed(social_enrichment),
                        "status": (social_enrichment or {}).get("_http_status"),
                    } if 'social_enrichment' in locals() else {"ok": False},
                    "competitor_monitor": {
                        "ok": not _edge_result_failed(competitor_monitor),
                        "status": (competitor_monitor or {}).get("_http_status"),
                    } if 'competitor_monitor' in locals() else {"ok": False},
                    "market_analysis_ai": {
                        "ok": not _edge_result_failed(market_analysis),
                        "status": (market_analysis or {}).get("_http_status"),
                    } if 'market_analysis' in locals() else {"ok": False},
                    "market_signal_scorer": {
                        "ok": not _edge_result_failed(market_scorer),
                        "status": (market_scorer or {}).get("_http_status"),
                    } if 'market_scorer' in locals() else {"ok": False},
                    "browse_ai_reviews": {
                        "ok": not _edge_result_failed(browse_ai_reviews),
                        "status": (browse_ai_reviews or {}).get("_http_status"),
                    } if 'browse_ai_reviews' in locals() else {"ok": False},
                    "semrush_domain_intel": {
                        "ok": not _edge_result_failed(semrush_intel),
                        "status": (semrush_intel or {}).get("_http_status"),
                    } if 'semrush_intel' in locals() else {"ok": False},
                }
            except Exception:
                pass

            enrichment["ai_errors"] = ai_errors

            try:
                profile = await get_business_profile_supabase(get_sb(), user_id)
                if profile and profile.get("id"):
                    profile_update = {
                        "website": url,
                        "business_name": enrichment.get("business_name") or profile.get("business_name") or "",
                        "industry": enrichment.get("industry") or profile.get("industry") or "",
                        "abn": enrichment.get("abn") or profile.get("abn") or "",
                        "location": (
                            (enrichment.get("website_scan_summary") or {}).get("locations_detected") or [profile.get("location") or ""]
                        )[0],
                        "main_products_services": enrichment.get("main_products_services") or profile.get("main_products_services") or "",
                        "target_market": enrichment.get("target_market") or profile.get("target_market") or "",
                        "social_handles": enrichment.get("social_handles") or {},
                        "executive_summary": enrichment.get("forensic_memo") or enrichment.get("cmo_executive_brief") or enrichment.get("executive_summary") or "",
                        "competitor_scan_result": json.dumps({
                            "website_scan_summary": enrichment.get("website_scan_summary"),
                            "forensic_memo": enrichment.get("forensic_memo"),
                            "seo_rank_summary": enrichment.get("seo_rank_summary"),
                            "paid_rank_summary": enrichment.get("paid_rank_summary"),
                            "recommended_keywords": enrichment.get("recommended_keywords"),
                            "aeo_strategy": enrichment.get("aeo_strategy"),
                            "industry_action_items": enrichment.get("industry_action_items"),
                            "competitor_leaders": enrichment.get("competitor_leaders"),
                            "customer_review_highlights": enrichment.get("customer_review_highlights"),
                            "staff_review_highlights": enrichment.get("staff_review_highlights"),
                            "generated_at": datetime.now(timezone.utc).isoformat(),
                        }),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                    get_sb().table("business_profiles").update(profile_update).eq("id", profile["id"]).execute()
            except Exception as profile_error:
                logger.warning(f"[enrichment/website] Could not persist scan bundle to business profile: {profile_error}")

            # ═══ DIGITAL FOOTPRINT COMPOSITE ═══
            # Derive a Market & Position footprint score from deterministic scan signals.
            # Consumed downstream by /snapshot/latest → MarketPage (and BoardRoom / CMO
            # Report via cognitive.business_dna_enrichment). Never fabricated — zeros
            # out when signals are missing so the UI can decide to show calibrating.
            try:
                seo_score = _score_from_signal(enrichment.get("seo_analysis"))
                social_score = _score_from_signal(enrichment.get("social_media_analysis"))
                content_score = _score_from_signal(enrichment.get("website_health"))
                overall = int(round((seo_score + social_score + content_score) / 3)) \
                    if (seo_score or social_score or content_score) else 0
                enrichment["digital_footprint"] = {
                    "score": overall,
                    "seo_score": seo_score,
                    "social_score": social_score,
                    "content_score": content_score,
                    "computed_at": datetime.now(timezone.utc).isoformat(),
                }
            except Exception as footprint_error:
                logger.warning(f"[enrichment/website] digital_footprint compute skipped: {footprint_error}")

            # Final defence-in-depth sanitize before any persistence. Anything
            # that added meta-gap / sentinel values after the AI merge (e.g.
            # deterministic SWOT fallback, semrush enrichment, ai_errors) is
            # still scrubbed before reaching the DB or the response body.
            enrichment = _sanitize_enrichment_payload(enrichment)

            # ═══ PERSIST ENRICHMENT TO business_dna_enrichment ═══
            # Latest-scan-wins upsert keyed on (user_id, business_profile_id). Allows
            # Market & Position / BoardRoom / CMO Report to read Deep Scan output
            # without re-scanning. Wrapped so a persistence failure never fails the
            # scan response.
            try:
                if user_id:
                    profile_for_bde = await get_business_profile_supabase(get_sb(), user_id)
                    bde_profile_id = profile_for_bde.get("id") if profile_for_bde else None

                    # If no business profile exists yet (fresh signup), create one
                    # so enrichment data is never silently lost
                    if not bde_profile_id:
                        biz_name = enrichment.get("business_name") or enrichment.get("title") or "Business"
                        industry = enrichment.get("industry") or ""
                        try:
                            new_profile = get_sb().table("business_profiles").insert({
                                "user_id": user_id,
                                "business_name": biz_name,
                                "website": url,
                                "industry": industry,
                            }).execute()
                            if new_profile.data:
                                bde_profile_id = new_profile.data[0]["id"]
                                logger.info(f"[enrichment/website] Auto-created business_profiles row {bde_profile_id} for user {user_id}")
                        except Exception as profile_create_err:
                            logger.warning(f"[enrichment/website] Could not auto-create business profile: {profile_create_err}")

                    if bde_profile_id:
                        get_sb().table("business_dna_enrichment").upsert({
                            "user_id": user_id,
                            "business_profile_id": bde_profile_id,
                            "website_url": url,
                            "enrichment": enrichment,
                            "digital_footprint": enrichment.get("digital_footprint") or {},
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        }, on_conflict="user_id,business_profile_id").execute()
                        logger.info(f"[enrichment/website] business_dna_enrichment persisted for user {user_id}")
                    else:
                        logger.error(f"[enrichment/website] CRITICAL: Could not persist enrichment — no business_profile_id for user {user_id}")
            except Exception as bde_error:
                logger.error(f"[enrichment/website] business_dna_enrichment upsert FAILED: {bde_error}")

            asyncio.create_task(set_domain_scan(scan_domain, enrichment))

            return {
                "status": "draft",
                "url": url,
                "enrichment": enrichment,
                "message": "Deep scan completed. Review and continue to calibration summary.",
            }
        except Exception as e:
            logger.error(f"[enrichment/website] Scan failed: {e}")
            fallback_domain = normalize_domain(url)
            fallback_name = fallback_domain.split(".")[0].replace("-", " ").title() if fallback_domain else "Business"
            fallback_page_text = str(locals().get("page_text") or "")
            fallback_title = str(locals().get("page_title") or "")
            fallback_description = str(locals().get("meta_description") or "")
            fallback_enrichment = {
                "business_name": str(locals().get("business_name_hint") or fallback_name),
                "title": fallback_title,
                "description": fallback_description,
                "industry": "",
                "main_products_services": _extract_sentence_with_keywords(
                    fallback_page_text,
                    ["service", "solution", "product", "advisory", "consulting", "support"],
                ),
                "target_market": "",
                "unique_value_proposition": "",
                "competitive_advantages": "",
                "competitors": [],
                "abn": "",
                "social_handles": {},
                "trust_signals": [],
                "website_scan_summary": {
                    "domain": fallback_domain,
                    "full_business_name": str(locals().get("business_name_hint") or fallback_name),
                    "abn": "",
                    "locations_detected": [],
                    "contact_emails_detected": [],
                    "pages_scanned_count": 1,
                    "pages_scanned": [url],
                    "scan_scope": "website page baseline",
                },
                "analysis_gaps": ["Deep scan partially unavailable on this run; showing baseline extraction."],
                "sources": {"errors": [{"stage": "scan", "error": str(e)[:140]}]},
            }
            return {
                "status": "draft",
                "url": url,
                "enrichment": fallback_enrichment,
                "message": "Deep scan partially unavailable; baseline website extraction returned.",
            }

    elif payload.action == "commit":
        try:
            profile = await get_business_profile_supabase(get_sb(), user_id)
            if not profile:
                raise HTTPException(status_code=404, detail="No business profile")
            get_sb().table("business_profiles").update({
                "website": url,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", profile["id"]).execute()
            return {"status": "committed", "message": "Website data saved to Business DNA."}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[enrichment/website] Commit failed: {e}")
            raise HTTPException(status_code=500, detail="Commit failed")



def _split_two_parts(answer: str) -> List[str]:
    parts = re.split(r"\s+and\s+|\s+—\s+|\s+–\s+|\s+-\s+", answer, maxsplit=1)
    return [p.strip() for p in parts if p.strip()]


def _parse_business_identity(answer: str) -> Dict[str, Optional[str]]:
    if "," in answer:
        name, industry = [p.strip() for p in answer.split(",", 1)]
        return {"business_name": name, "industry": industry}
    if " in " in answer.lower():
        name, industry = [p.strip() for p in re.split(r"\s+in\s+", answer, maxsplit=1, flags=re.IGNORECASE)]
        return {"business_name": name, "industry": industry}
    return {"business_name": answer.strip(), "industry": None}


def _parse_business_stage(answer: str) -> Dict[str, Optional[str]]:
    stage_match = re.search(r"(idea|early[-\s]?stage|established|enterprise)", answer, re.IGNORECASE)
    stage = stage_match.group(1).lower().replace(" ", "-") if stage_match else None
    years_match = re.search(r"(\d+(?:\.\d+)?)", answer)
    years = years_match.group(1) if years_match else None
    return {"business_stage": stage, "years_operating": years}


def _parse_location(answer: str) -> Dict[str, Optional[str]]:
    """Parse location into a single 'location' string."""
    return {"location": answer.strip()}


def _extract_team_size(answer: str) -> Optional[int]:
    match = re.search(r"(\d+)", answer)
    return int(match.group(1)) if match else None



@router.post("/calibration/init")
async def init_calibration_session(current_user: dict = Depends(get_current_user)):
    """
    Initialize calibration: ensure business_profile shell exists.
    Called when user clicks 'Begin Calibration' — BEFORE any answers.
    """
    user_id = current_user.get("id")
    try:
        profile = await get_business_profile_supabase(get_sb(), user_id)
        if not profile:
            profile_data = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            try:
                result = get_sb().table("business_profiles").insert(profile_data).execute()
                profile = result.data[0] if result.data else profile_data
            except Exception:
                result = get_sb().table("business_profiles").insert(profile_data).execute()
                profile = result.data[0] if result.data else profile_data
            logger.info(f"[calibration/init] Created shell business_profile for {user_id}")
        else:
            logger.info(f"[calibration/init] Profile already exists for {user_id}")
        return {"status": "ready", "profile_id": profile.get("id")}
    except Exception as e:
        logger.error(f"[calibration/init] Error: {e}")
        return JSONResponse(status_code=200, content={"status": "ready", "profile_id": None})


@router.post("/calibration/answer")
async def save_calibration_answer(request: Request, payload: CalibrationAnswerRequest):
    """Save calibration answer."""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")
    answer = payload.answer.strip()
    question_id = payload.question_id

    if not answer:
        raise HTTPException(status_code=400, detail="Answer required")

    profile = await get_business_profile_supabase(get_sb(), user_id)

    user_profile = get_sb().table("users").select("id,email,account_id,full_name").eq("id", user_id).execute().data
    user_email = user_profile[0].get("email") if user_profile else None
    account_id = user_profile[0].get("account_id") if user_profile else None

    if not profile and question_id != 1:
        raise HTTPException(status_code=400, detail="Calibration must start with question 1")

    if question_id == 1:
        identity = _parse_business_identity(answer)
        biz_name = identity.get("business_name") or answer
        industry = identity.get("industry")  # may be None — that is fine

        if not profile:
            # Build insert payload — only include columns that have values
            profile_data = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "business_name": biz_name,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            if industry:
                profile_data["industry"] = industry
            try:
                profile_data["calibration_status"] = "in_progress"
                result = get_sb().table("business_profiles").insert(profile_data).execute()
                profile = result.data[0] if result.data else profile_data
            except Exception as insert_err:
                logger.warning(f"[calibration/answer] Insert failed, retrying minimal: {insert_err}")
                # calibration_status column removed
                profile_data.pop("industry", None)
                try:
                    result = get_sb().table("business_profiles").insert(profile_data).execute()
                    profile = result.data[0] if result.data else profile_data
                except Exception as retry_err:
                    logger.error(f"[calibration/answer] Q1 insert fully failed: {retry_err}")
                    return {"status": "saved", "calibration_complete": False}

            # Account creation — non-blocking
            try:
                if biz_name and user_email:
                    from workspace_helpers import get_or_create_user_account
                    account_id = await get_or_create_user_account(get_sb(), user_id, user_email, biz_name)
                    if account_id:
                        profile_data["account_id"] = account_id
                        get_sb().table("users").update({"account_id": account_id}).eq("id", user_id).execute()
            except Exception as acct_err:
                logger.warning(f"[calibration/answer] Account creation non-critical error: {acct_err}")
        else:
            # Profile exists — update with whatever we parsed
            update_fields = {
                "business_name": biz_name,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            if industry:
                update_fields["industry"] = industry
            try:
                update_fields["calibration_status"] = "in_progress"
                get_sb().table("business_profiles").update(update_fields).eq("id", profile.get("id")).execute()
            except Exception as update_err:
                logger.warning(f"[calibration/answer] Update failed, retrying minimal: {update_err}")
                # calibration_status column removed
                update_fields.pop("industry", None)
                try:
                    get_sb().table("business_profiles").update(update_fields).eq("id", profile.get("id")).execute()
                except Exception as retry_err:
                    logger.error(f"[calibration/answer] Q1 update fully failed: {retry_err}")

            # Account creation — non-blocking
            try:
                if not profile.get("account_id") and biz_name and user_email:
                    from workspace_helpers import get_or_create_user_account
                    account_id = await get_or_create_user_account(get_sb(), user_id, user_email, biz_name)
                    if account_id:
                        get_sb().table("business_profiles").update({"account_id": account_id}).eq("id", profile.get("id")).execute()
                        get_sb().table("users").update({"account_id": account_id}).eq("id", user_id).execute()
            except Exception as acct_err:
                logger.warning(f"[calibration/answer] Account update non-critical error: {acct_err}")

    if not profile:
        raise HTTPException(status_code=500, detail="Business profile unavailable")

    business_profile_id = profile.get("id")

    # ── Q2–Q6: Structured extraction (all fail-soft) ──
    if question_id == 2:
        try:
            stage_data = _parse_business_stage(answer)
            update = {"updated_at": datetime.now(timezone.utc).isoformat()}
            if stage_data.get("business_stage"):
                update["business_stage"] = stage_data["business_stage"]
            if stage_data.get("years_operating"):
                update["years_operating"] = stage_data["years_operating"]
            try:
                update["calibration_status"] = "in_progress"
                get_sb().table("business_profiles").update(update).eq("id", business_profile_id).execute()
            except Exception:
                # calibration_status column removed
                try:
                    get_sb().table("business_profiles").update(update).eq("id", business_profile_id).execute()
                except Exception as e:
                    logger.warning(f"[calibration/answer] Q2 write failed: {e}")
        except Exception as e:
            logger.warning(f"[calibration/answer] Q2 parse/write failed: {e}")

    if question_id == 3:
        try:
            location_data = _parse_location(answer)
            update = {**location_data, "updated_at": datetime.now(timezone.utc).isoformat()}
            try:
                update["calibration_status"] = "in_progress"
                get_sb().table("business_profiles").update(update).eq("id", business_profile_id).execute()
            except Exception:
                # calibration_status column removed
                try:
                    get_sb().table("business_profiles").update(update).eq("id", business_profile_id).execute()
                except Exception as e:
                    logger.warning(f"[calibration/answer] Q3 write failed: {e}")
        except Exception as e:
            logger.warning(f"[calibration/answer] Q3 parse/write failed: {e}")

    if question_id == 4:
        try:
            parts = _split_two_parts(answer)
            market = parts[0] if parts else answer
            pain = parts[1] if len(parts) > 1 else answer
            update = {"target_market": market, "value_proposition": pain, "updated_at": datetime.now(timezone.utc).isoformat()}
            try:
                update["ideal_customer_profile"] = market
                update["calibration_status"] = "in_progress"
                get_sb().table("business_profiles").update(update).eq("id", business_profile_id).execute()
            except Exception:
                try:
                    get_sb().table("business_profiles").update({"target_market": market, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", business_profile_id).execute()
                except Exception as e:
                    logger.warning(f"[calibration/answer] Q4 write failed: {e}")
        except Exception as e:
            logger.warning(f"[calibration/answer] Q4 parse/write failed: {e}")

    if question_id == 5:
        try:
            parts = _split_two_parts(answer)
            products = parts[0] if parts else answer
            differentiation = parts[1] if len(parts) > 1 else answer
            update = {"main_products_services": products, "updated_at": datetime.now(timezone.utc).isoformat()}
            try:
                update["unique_value_proposition"] = differentiation
                update["competitive_advantages"] = differentiation
                update["calibration_status"] = "in_progress"
                get_sb().table("business_profiles").update(update).eq("id", business_profile_id).execute()
            except Exception:
                try:
                    get_sb().table("business_profiles").update({"main_products_services": products, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", business_profile_id).execute()
                except Exception as e:
                    logger.warning(f"[calibration/answer] Q5 write failed: {e}")
        except Exception as e:
            logger.warning(f"[calibration/answer] Q5 parse/write failed: {e}")

    if question_id == 6:
        try:
            team_size = _extract_team_size(answer)
            update = {"founder_background": answer, "updated_at": datetime.now(timezone.utc).isoformat()}
            if team_size:
                update["team_size"] = team_size
            try:
                update["calibration_status"] = "in_progress"
                get_sb().table("business_profiles").update(update).eq("id", business_profile_id).execute()
            except Exception:
                # calibration_status column removed
                update.pop("team_size", None)
                try:
                    get_sb().table("business_profiles").update(update).eq("id", business_profile_id).execute()
                except Exception as e:
                    logger.warning(f"[calibration/answer] Q6 write failed: {e}")
        except Exception as e:
            logger.warning(f"[calibration/answer] Q6 parse/write failed: {e}")

    # ── Q7–Q9: Strategy profiles (all fail-soft) ──
    if question_id in {7, 8, 9}:
      try:
        strategy = get_sb().table("strategy_profiles").select("*").eq("business_profile_id", business_profile_id).execute().data
        strategy_profile = strategy[0] if strategy else None
        
        if not account_id and profile.get("account_id"):
            account_id = profile.get("account_id")

        if not strategy_profile:
            strategy_profile = {
                "id": str(uuid.uuid4()),
                "business_profile_id": business_profile_id,
                "user_id": user_id,
                "account_id": account_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            get_sb().table("strategy_profiles").insert(strategy_profile).execute()

        updates = {"updated_at": datetime.now(timezone.utc).isoformat(), "source": "user", "regenerable": True}
        if question_id == 7:
            parts = _split_two_parts(answer)
            mission = parts[0] if parts else answer
            vision = parts[1] if len(parts) > 1 else answer
            if not strategy_profile.get("raw_mission_input"):
                updates["raw_mission_input"] = mission
            if not strategy_profile.get("raw_vision_input"):
                updates["raw_vision_input"] = vision

        if question_id == 8:
            parts = _split_two_parts(answer)
            goals = parts[0] if parts else answer
            challenges = parts[1] if len(parts) > 1 else answer
            if not strategy_profile.get("raw_goals_input"):
                updates["raw_goals_input"] = goals
            if not strategy_profile.get("raw_challenges_input"):
                updates["raw_challenges_input"] = challenges

        if question_id == 9:
            if not strategy_profile.get("raw_growth_input"):
                updates["raw_growth_input"] = answer

        get_sb().table("strategy_profiles").update(updates).eq("id", strategy_profile.get("id")).execute()

        if question_id == 9:
          try:
            strategy_profile = get_sb().table("strategy_profiles").select("*").eq("business_profile_id", business_profile_id).execute().data
            strategy_profile = strategy_profile[0] if strategy_profile else {}
            raw_prompt = (
                "Generate JSON with keys: mission_statement, vision_statement, short_term_goals, long_term_goals, "
                "primary_challenges, growth_strategy. Keep outputs specific and grounded. Return ONLY JSON.\n\n"
                f"Mission raw: {strategy_profile.get('raw_mission_input')}\n"
                f"Vision raw: {strategy_profile.get('raw_vision_input')}\n"
                f"Goals raw: {strategy_profile.get('raw_goals_input')}\n"
                f"Challenges raw: {strategy_profile.get('raw_challenges_input')}\n"
                f"Growth raw: {strategy_profile.get('raw_growth_input')}\n"
            )

            from core.ai_core import get_ai_response
            ai_text = await get_ai_response(
                raw_prompt,
                "general",
                f"calibration_{user_id}",
                user_id=user_id,
                metadata={"force_trinity": True, "context": "onboarding_calibration"},
            )
            ai_payload = {}
            try:
                ai_payload = json.loads(ai_text)
            except Exception:
                ai_payload = {
                    "mission_statement": strategy_profile.get("raw_mission_input"),
                    "vision_statement": strategy_profile.get("raw_vision_input"),
                    "short_term_goals": strategy_profile.get("raw_goals_input"),
                    "long_term_goals": strategy_profile.get("raw_goals_input"),
                    "primary_challenges": strategy_profile.get("raw_challenges_input"),
                    "growth_strategy": strategy_profile.get("raw_growth_input")
                }

            try:
                get_sb().table("strategy_profiles").update({
                    **ai_payload,
                    "source": "ai_generated",
                    "regenerable": True,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", strategy_profile.get("id")).execute()
            except Exception as sp_err:
                logger.warning(f"[calibration/answer] Q9 strategy_profiles AI update failed: {sp_err}")
          except Exception as q9_ai_err:
            logger.warning(f"[calibration/answer] Q9 AI generation failed: {q9_ai_err}")

          # Completion scaffolding — each part fail-soft
          if not account_id and profile.get("account_id"):
              account_id = profile.get("account_id")

          try:
            schedule_focus = [
                "Business foundation & positioning",
                "Offer clarity & pricing",
                "Pipeline build & outbound",
                "Inbound demand & content",
                "Sales conversion system",
                "Delivery quality & client success",
                "Retention & expansion",
                "Operations efficiency",
                "Team capacity & delegation",
                "Metrics & financial visibility",
                "Partnerships & channel growth",
                "Offer evolution",
                "Market expansion tests",
                "Scale systems & hiring",
                "Strategic review & next 15-week plan"
            ]

            today = datetime.now(timezone.utc).date()
            for week in range(1, 16):
                start_date = today + timedelta(days=(week - 1) * 7)
                end_date = start_date + timedelta(days=6)
                get_sb().table("working_schedules").upsert({
                    "business_profile_id": business_profile_id,
                    "user_id": user_id,
                    "account_id": account_id,
                    "week_number": week,
                    "focus_area": schedule_focus[week - 1],
                    "status": "in_progress" if week == 1 else "planned",
                    "week_start_date": start_date.isoformat(),
                    "week_end_date": end_date.isoformat()
                }, on_conflict="business_profile_id,week_number").execute()
          except Exception as sched_err:
            logger.warning(f"[calibration/answer] Q9 schedule creation failed: {sched_err}")

          try:
            default_priorities = [
                {"signal_category": "revenue_sales", "priority_rank": 1, "threshold_sensitivity": "high", "description": "Revenue and sales movement"},
                {"signal_category": "team_capacity", "priority_rank": 2, "threshold_sensitivity": "medium", "description": "Leader and team capacity"},
                {"signal_category": "strategy_drift", "priority_rank": 3, "threshold_sensitivity": "medium", "description": "Plan alignment"},
                {"signal_category": "delivery_ops", "priority_rank": 4, "threshold_sensitivity": "low", "description": "Delivery and operations"}
            ]

            for priority in default_priorities:
                get_sb().table("intelligence_priorities").upsert({
                    "business_profile_id": business_profile_id,
                    "user_id": user_id,
                    **priority
                }, on_conflict="business_profile_id,signal_category").execute()
          except Exception as prio_err:
            logger.warning(f"[calibration/answer] Q9 priorities creation failed: {prio_err}")

          try:
            get_sb().table("progress_cadence").upsert({
                "business_profile_id": business_profile_id,
                "user_id": user_id,
                "account_id": account_id,
                "cadence_type": "weekly",
                "next_check_in_date": (today + timedelta(days=7)).isoformat()
            }, on_conflict="business_profile_id").execute()
          except Exception as cad_err:
            logger.warning(f"[calibration/answer] Q9 cadence creation failed: {cad_err}")

          try:
            get_sb().table("calibration_sessions").insert({
                "business_profile_id": business_profile_id,
                "user_id": user_id,
                "questions_answered": 9,
                "completed": True,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }).execute()
          except Exception as sess_err:
            logger.warning(f"[calibration/answer] Q9 session insert failed: {sess_err}")

          now_iso = datetime.now(timezone.utc).isoformat()

          # PRIMARY: Write to user_operator_profile (authoritative)
          try:
            existing_op = get_sb().table("user_operator_profile").select("user_id").eq("user_id", user_id).maybe_single().execute()
            if existing_op.data:
                get_sb().table("user_operator_profile").update({
                    "persona_calibration_status": "complete",
                }).eq("user_id", user_id).execute()
            else:
                get_sb().table("user_operator_profile").insert({
                    "user_id": user_id,
                    "persona_calibration_status": "complete",
                    "operator_profile": {}
                }).execute()
            logger.info(f"[calibration/answer] user_operator_profile.persona_calibration_status = complete for {user_id}")
          except Exception as op_err:
            logger.error(f"[calibration/answer] user_operator_profile write failed: {op_err}")

          # SECONDARY: Also update business_profiles for backward compat
          try:
            get_sb().table("business_profiles").update({
                "last_calibration_step": 9,
                "updated_at": now_iso,
                "account_id": account_id
            }).eq("id", business_profile_id).execute()
          except Exception as comp_err:
            logger.warning(f"[calibration/answer] Q9 calibration_status=complete failed: {comp_err}")

          # LOOP-BREAKER: Write to strategic_console_state (authoritative for routing)
          try:
            get_sb().table("strategic_console_state").upsert({
                "user_id": user_id,
                "status": "COMPLETED",
                "current_step": 17,
                "is_complete": True,
                "updated_at": now_iso
            }, on_conflict="user_id").execute()
            logger.info(f"[calibration/answer] strategic_console_state = COMPLETED for {user_id}")
          except Exception as scs_err:
            logger.warning(f"[calibration/answer] strategic_console_state write failed: {scs_err}")

          return {"status": "complete", "calibration_complete": True}

      except Exception as strategy_err:
        logger.warning(f"[calibration/answer] Q{question_id} strategy block failed: {strategy_err}")
        # Still mark complete even if strategy scaffolding failed
        if question_id == 9:
          now_iso_fallback = datetime.now(timezone.utc).isoformat()
          # PRIMARY: user_operator_profile
          try:
            existing_op2 = get_sb().table("user_operator_profile").select("user_id").eq("user_id", user_id).maybe_single().execute()
            if existing_op2.data:
                get_sb().table("user_operator_profile").update({
                    "persona_calibration_status": "complete",
                }).eq("user_id", user_id).execute()
            else:
                get_sb().table("user_operator_profile").insert({
                    "user_id": user_id,
                    "persona_calibration_status": "complete",
                    "operator_profile": {}
                }).execute()
          except Exception:
            pass
          # SECONDARY: business_profiles
          try:
            get_sb().table("business_profiles").update({
                "last_calibration_step": 9,
                "updated_at": now_iso_fallback
            }).eq("id", business_profile_id).execute()
          except Exception:
            pass
          # LOOP-BREAKER: strategic_console_state (fallback path)
          try:
            get_sb().table("strategic_console_state").upsert({
                "user_id": user_id,
                "status": "COMPLETED",
                "current_step": 17,
                "is_complete": True,
                "updated_at": now_iso_fallback
            }, on_conflict="user_id").execute()
          except Exception:
            pass
          return {"status": "complete", "calibration_complete": True}

    # Generate BIQc Advisor calibration voice response
    advisor_response = None
    try:
        # Fetch from DB or use inline fallback
        _voice_fallback = (
            'You are the "BIQc Advisor" (System Name: BIQc). '
            'Your status is: FAIL-SAFE | MASTER CONNECTED. '
            'You are a strategic, executive-level AI designed to "Calibrate" the user before granting them access to the "Watchtower."\n\n'
            'TONE & STYLE:\n'
            '- Concise, cryptic but helpful, high-tech, executive, encouraging.\n'
            '- Use terminology like "Syncing...", "Vector confirmed," "Strategic alignment."\n'
            '- Do not be chatty. Be precise.\n\n'
            'CRITICAL OUTPUT FORMAT:\n'
            'You must ONLY output valid JSON. Do not output markdown blocks or plain text outside the JSON.\n'
            'Structure: {"message": "Your text response to the user goes here.", "action": null}\n'
            '- Normal reply: {"message": "Input received. Clarify your project timeline.", "action": null}\n'
            '- Do NOT set action to "COMPLETE_REDIRECT" — the system handles completion separately.\n\n'
            'Rules:\n'
            '- Maximum 2-3 sentences in the message field.\n'
            '- Acknowledge the input, reflect strategic meaning, orient toward next calibration vector.\n'
            '- Do not repeat the user answer back verbatim.\n'
            '- Do not include the next question.\n'
        )
        cal_user_msg = (
            f"Question {question_id} of 9: \"{QUESTIONS_TEXT.get(question_id, '')}\"\n"
            f"User answered: \"{answer}\"\n\n"
            "Respond with JSON only."
        )
        from core.ai_core import get_ai_response
        raw_ai = await get_ai_response(
            cal_user_msg,
            "general",
            f"calibration_{user_id}",
            user_id=user_id,
            metadata={"force_trinity": True, "context": "onboarding_calibration"},
        )
        if raw_ai:
            raw_ai = raw_ai.strip()
            # Strip markdown code fences if present
            if raw_ai.startswith("```"):
                raw_ai = raw_ai.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            try:
                parsed = json.loads(raw_ai)
                advisor_response = parsed.get("message", raw_ai)
            except Exception:
                advisor_response = raw_ai.strip().strip('"')
    except Exception as ai_err:
        logger.warning(f"[calibration/answer] AI response generation failed: {ai_err}")

    return {"status": "saved", "calibration_complete": False, "advisor_response": advisor_response}


@router.get("/calibration/activation")
async def get_calibration_activation(request: Request):
    """Generate post-calibration advisor activation: focus statement, time horizon, engagement contract, integration framing, initial observation."""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    profile = await get_business_profile_supabase(get_sb(), user_id)
    if not profile:
        return {"focus": None, "time_horizon": None, "engagement": None, "integration_framing": None, "initial_observation": None}

    biz_name = profile.get("business_name", "your business")
    industry = profile.get("industry", "")
    stage = profile.get("business_stage", "")
    team = profile.get("team_size", "")

    context_summary = f"Business: {biz_name}. Industry: {industry or 'not specified'}. Stage: {stage or 'not specified'}. Team: {team or 'not specified'}."

    try:
        _activation_fallback = (
            'You are the "BIQc Advisor" (System Name: BIQc). Status: FAIL-SAFE | MASTER CONNECTED. '
            'Calibration just completed. Generate a post-calibration activation briefing.\n\n'
            'Tone: Concise, cryptic but helpful, high-tech, executive. Use terminology like "Vectors locked", "Signal monitoring active."\n\n'
            'Generate a JSON object with exactly these keys. All values are strings:\n\n'
            '1) "focus": 3 bullet points (use bullet character) of strategic vectors you will monitor.\n\n'
            '2) "time_horizon": One short paragraph. 7-day signal window, 30-day pattern emergence.\n\n'
            '3) "engagement": 1-2 sentences. The system surfaces what matters.\n\n'
            '4) "integration_framing": 2 sentences. Why email and calendar visibility matters for THIS business.\n\n'
            '5) "initial_observation": One provisional strategic observation. Mark as provisional.\n\n'
            'Return ONLY valid JSON. No markdown. No explanation.'
        )
        db_activation = await get_prompt("calibration_activation_v1", _activation_fallback)
        activation_prompt = f"{db_activation}\n\nBusiness context: {context_summary}"
        from core.ai_core import get_ai_response
        ai_text = await get_ai_response(
            activation_prompt,
            "general",
            f"activation_{user_id}",
            user_id=user_id,
            metadata={"force_trinity": True, "context": "onboarding_calibration"},
        )
        activation = json.loads(ai_text)
        return activation
    except Exception as e:
        logger.warning(f"[calibration/activation] AI generation failed: {e}")
        return {
            "focus": "Based on what you've shared, I'll be watching:\n• financial stability and cashflow patterns\n• pressure on you as the primary operator\n• signals that it's time to systematise or delegate",
            "time_horizon": "In the next 7 days, I'll start noticing early signals. Over the next 30 days, patterns will become clearer as activity builds.",
            "engagement": "You don't need to ask me everything. I'll surface what matters when it matters — and you can correct me anytime.",
            "integration_framing": f"For {biz_name}, email and calendar help me spot early warning signs before they become problems. This isn't setup — it's giving me visibility.",
            "initial_observation": "Initial observation: Owner workload may become a constraint before revenue stabilises. I'll confirm or dismiss this once I see real activity."
        }


# ─── 17-Point Strategic Audit ───
# Maps 17 strategic dimensions to business_profiles columns
STRATEGIC_DIMENSIONS = [
    {"id": 1,  "key": "business_name",          "label": "Business Identity",        "question": "What's the name and nature of the business?"},
    {"id": 2,  "key": "business_stage",          "label": "Business Stage",           "question": "What stage is the business at?"},
    {"id": 3,  "key": "industry",                "label": "Industry Sector",          "question": "What industry does the business operate in?"},
    {"id": 4,  "key": "location",                "label": "Operating Geography",      "question": "Where is the business based?"},
    {"id": 5,  "key": "target_market",           "label": "Target Market",            "question": "Who does the business sell to?"},
    {"id": 6,  "key": "main_products_services",  "label": "Core Offering",            "question": "What products or services does the business sell?"},
    {"id": 7,  "key": "unique_value_proposition", "label": "Competitive Moat",        "question": "What differentiates the business from competitors?"},
    {"id": 8,  "key": "team_size",               "label": "Team Capacity",            "question": "How big is the team?"},
    {"id": 9,  "key": "years_operating",         "label": "Operational Maturity",     "question": "How long has the business been running?"},
    {"id": 10, "key": "short_term_goals",        "label": "12-Month Priorities",      "question": "What are the goals for the next 12 months?"},
    {"id": 11, "key": "long_term_goals",         "label": "Long-term Vision",         "question": "What does success look like in 3-5 years?"},
    {"id": 12, "key": "main_challenges",         "label": "Active Constraints",       "question": "What obstacles are blocking progress?"},
    {"id": 13, "key": "growth_strategy",         "label": "Growth Strategy",          "question": "How does the business plan to grow?"},
    {"id": 14, "key": "growth_goals",            "label": "Growth Objectives",        "question": "What are the primary growth objectives?"},
    {"id": 15, "key": "risk_profile",            "label": "Risk Profile",             "question": "What is the risk tolerance and exposure?"},
    {"id": 16, "key": "competitive_advantages",  "label": "Competitive Advantages",   "question": "What advantages does the business hold?"},
    {"id": 17, "key": "business_model",          "label": "Revenue Model",            "question": "How does the business make money?"},
]


@router.get("/calibration/strategic-audit")
async def get_strategic_audit(current_user: dict = Depends(get_current_user)):
    """
    Dynamic Gap-Filling: Audit business_profiles against the 17-point Strategic Map.
    Returns known dimensions (auto-advance) and gaps (need questioning).
    """
    user_id = current_user.get("id")
    try:
        profile = await get_business_profile_supabase(get_sb(), user_id)
        bp = profile or {}

        known = []
        gaps = []
        for dim in STRATEGIC_DIMENSIONS:
            val = bp.get(dim["key"])
            if val and str(val).strip():
                known.append({
                    "id": dim["id"],
                    "key": dim["key"],
                    "label": dim["label"],
                    "value": str(val)[:200]
                })
            else:
                gaps.append({
                    "id": dim["id"],
                    "key": dim["key"],
                    "label": dim["label"],
                    "question": dim["question"]
                })

        total = len(STRATEGIC_DIMENSIONS)
        known_count = len(known)
        completion_pct = round((known_count / total) * 100)

        return {
            "total": total,
            "known_count": known_count,
            "gap_count": len(gaps),
            "completion_pct": completion_pct,
            "known": known,
            "gaps": gaps,
            "auto_advance_to_step": known_count + 1 if known_count < total else total,
        }
    except Exception as e:
        logger.error(f"[calibration/strategic-audit] Error: {e}")
        return {"total": 17, "known_count": 0, "gap_count": 17, "completion_pct": 0, "known": [], "gaps": STRATEGIC_DIMENSIONS, "auto_advance_to_step": 1}





@router.post("/calibration/brain")
async def calibration_brain(payload: CalibrationBrainRequest, current_user: dict = Depends(get_current_user)):
    """
    Watchtower Brain — AI-driven 17-step strategic calibration.
    Replaces fixed question flow with intelligent interrogation.
    """
    user_id = current_user.get("id")
    await check_rate_limit(user_id, "soundboard_daily", get_sb())

    message = payload.message.strip()
    history = payload.history or []

    if not message:
        raise HTTPException(status_code=400, detail="Message required")

    try:
        # Resolve known facts BEFORE AI call — Guard 1: no redundant questions
        from fact_resolution import resolve_facts, build_known_facts_prompt
        resolved_facts = await resolve_facts(get_sb(), user_id)
        facts_prompt = build_known_facts_prompt(resolved_facts)

        # Build messages array matching OpenAI format
        system_with_facts = await get_prompt("watchtower_brain_v1", _WATCHTOWER_BRAIN_FALLBACK)
        if facts_prompt:
            system_with_facts += f"\n\nKNOWN BUSINESS FACTS (DO NOT ask for these again):\n{facts_prompt}\nIf you need any of these facts, use the provided values. Do not re-ask.\n"

        # Inject history as context in the user message
        context_block = ""
        if history:
            context_block = "CONVERSATION HISTORY:\n"
            for h in history:
                role = h.get("role", "user")
                content = h.get("content", "")
                context_block += f"[{role.upper()}]: {content}\n"
            context_block += "\n---\nNEW USER MESSAGE:\n"

        full_message = f"{context_block}{message}\n\nRespond with JSON only."
        raw_response = await llm_trinity_chat(
            system_message=system_with_facts,
            user_message=full_message,
            messages=history,
        )

        # Parse JSON from AI response
        cleaned = raw_response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        try:
            brain_response = json.loads(cleaned)
        except Exception:
            brain_response = {
                "message": cleaned.strip().strip('"'),
                "status": "IN_PROGRESS",
                "current_step_number": 1,
                "percentage_complete": 0
            }

        # If brain says COMPLETE, trigger calibration completion
        if brain_response.get("status") == "COMPLETE":
            now_iso = datetime.now(timezone.utc).isoformat()
            # PRIMARY: Write to user_operator_profile (authoritative)
            try:
                existing = get_sb().table("user_operator_profile").select("user_id, operator_profile").eq("user_id", user_id).maybe_single().execute()
                update_data = {
                    "persona_calibration_status": "complete",
                }
                # Auto-complete console_state AND onboarding_state when brain finishes
                if existing.data:
                    op = existing.data.get("operator_profile") or {}
                    op["console_state"] = {"status": "COMPLETE", "current_step": 17, "updated_at": now_iso}
                    op["onboarding_state"] = {"completed": True, "current_step": 14, "completed_at": now_iso}
                    update_data["operator_profile"] = op
                    get_sb().table("user_operator_profile").update(update_data).eq("user_id", user_id).execute()
                else:
                    update_data["operator_profile"] = {
                        "console_state": {"status": "COMPLETE", "current_step": 17, "updated_at": now_iso},
                        "onboarding_state": {"completed": True, "current_step": 14, "completed_at": now_iso}
                    }
                    update_data["user_id"] = user_id
                    get_sb().table("user_operator_profile").insert(update_data).execute()
                logger.info(f"[calibration/brain] calibration COMPLETE + onboarding auto-completed for {user_id}")
            except Exception as op_err:
                logger.error(f"[calibration/brain] user_operator_profile write failed: {op_err}")

            # LOOP-BREAKER: Write to strategic_console_state (authoritative for routing)
            try:
                get_sb().table("strategic_console_state").upsert({
                    "user_id": user_id,
                    "status": "COMPLETED",
                    "current_step": 17,
                    "is_complete": True,
                    "updated_at": now_iso
                }, on_conflict="user_id").execute()
                logger.info(f"[calibration/brain] strategic_console_state = COMPLETED for {user_id}")
            except Exception as scs_err:
                logger.warning(f"[calibration/brain] strategic_console_state write failed: {scs_err}")

            # SEED business_profiles from users table if no profile exists
            try:
                profile = await get_business_profile_supabase(get_sb(), user_id)
                if not profile:
                    user_data = await get_user_by_id(user_id)
                    if user_data:
                        from supabase_intelligence_helpers import update_business_profile_supabase
                        seed = {
                            "business_name": user_data.get("company_name") or user_data.get("business_name"),
                            "industry": user_data.get("industry"),
                            "target_country": "Australia",
                        }
                        seed = {k: v for k, v in seed.items() if v is not None}
                        await update_business_profile_supabase(get_sb(), user_id, seed)
                        logger.info(f"[calibration/brain] Seeded business_profiles from users table for {user_id}")
            except Exception as comp_err:
                logger.warning(f"[calibration/brain] business_profiles seed failed: {comp_err}")

        return brain_response

    except Exception as e:
        logger.error(f"[calibration/brain] Error: {e}")
        return {
            "message": "Signal interference. Retry your last input.",
            "status": "IN_PROGRESS",
            "current_step_number": 1,
            "percentage_complete": 0
        }


@router.post("/strategy/regeneration/request")
async def queue_regeneration_request(payload: RegenerationRequestPayload, current_user: dict = Depends(get_current_user)):
    return await request_regeneration(current_user["id"], payload.layer, payload.reason, get_sb())


@router.post("/strategy/regeneration/response")
async def handle_regeneration_response(payload: RegenerationResponsePayload, current_user: dict = Depends(get_current_user)):
    action = payload.action.lower()
    if action not in {"accept", "refine", "keep"}:
        raise HTTPException(status_code=400, detail="Invalid response action")
    return await record_regeneration_response(current_user["id"], payload.proposal_id, action, get_sb())


# ═══ RECALIBRATION CONTACT (SALES GATE) ═══

@router.post("/contact/recalibration")
async def recalibration_contact(payload: RecalibrationContactRequest, current_user: dict = Depends(get_current_user)):
    """Log a recalibration request and notify sales. Does NOT trigger recalibration directly."""
    user_id = current_user.get("id", "")
    try:
        sb = get_sb()
        sb.table("intelligence_actions").insert({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "source": "recalibration_request",
            "source_id": f"recal_{user_id}_{int(datetime.now(timezone.utc).timestamp())}",
            "domain": "calibration",
            "severity": "low",
            "title": f"Recalibration requested by {payload.name}",
            "description": f"Email: {payload.email}\nDays since calibration: {payload.days_since_calibration}\nMessage: {payload.message}",
            "suggested_action": "Contact user to schedule recalibration session.",
            "status": "action_required",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as exc:
        logger.warning("Failed to log recalibration contact: %s", exc)
    return {"status": "ok", "message": "Recalibration request received. Our team will contact you within 24 hours."}


# ═══ RECALIBRATION & CHECK-IN SCHEDULING ═══

class ScheduleCheckInRequest(BaseModel):
    type: str  # recalibration | video_checkin
    scheduled_for: str  # ISO datetime
    notes: Optional[str] = None

class PostponeCheckInRequest(BaseModel):
    check_in_id: str
    new_date: str  # ISO datetime


@router.get("/checkins/pending")
async def get_pending_checkins(current_user: dict = Depends(get_current_user)):
    """Get pending recalibration and video check-in alerts."""
    user_id = current_user["id"]
    now = datetime.now(timezone.utc)

    # Check last calibration date
    try:
        scs = get_sb().table("strategic_console_state").select(
            "updated_at"
        ).eq("user_id", user_id).maybe_single().execute()

        op = get_sb().table("user_operator_profile").select(
            "operator_profile"
        ).eq("user_id", user_id).maybe_single().execute()

        last_calibration = None
        if scs.data and scs.data.get("updated_at"):
            last_calibration = scs.data["updated_at"]
        elif op.data:
            console_state = (op.data.get("operator_profile") or {}).get("console_state", {})
            last_calibration = console_state.get("updated_at")
    except Exception:
        last_calibration = None

    # Check scheduled check-ins
    scheduled = []
    try:
        result = get_sb().table("calibration_schedules").select("*").eq(
            "user_id", user_id
        ).eq("status", "pending").order("scheduled_for", desc=False).execute()
        scheduled = result.data or []
    except Exception:
        pass

    # Determine if recalibration is due (every 14 days)
    recal_due = False
    recal_days_overdue = 0
    if last_calibration:
        try:
            last_dt = datetime.fromisoformat(str(last_calibration).replace("Z", "+00:00"))
            days_since = (now - last_dt).days
            recal_due = days_since >= 14
            recal_days_overdue = max(0, days_since - 14)
        except (ValueError, TypeError):
            recal_due = True

    # Determine if weekly video check-in is due
    video_due = False
    last_video = None
    for s in scheduled:
        if s.get("type") == "video_checkin" and s.get("status") == "completed":
            last_video = s.get("completed_at") or s.get("scheduled_for")

    if not last_video:
        video_due = True
    else:
        try:
            last_v_dt = datetime.fromisoformat(str(last_video).replace("Z", "+00:00"))
            video_due = (now - last_v_dt).days >= 7
        except (ValueError, TypeError):
            video_due = True

    alerts = []
    if recal_due:
        alerts.append({
            "type": "recalibration",
            "title": "Recalibration Due",
            "message": f"Your business profile was last calibrated {recal_days_overdue + 14} days ago. Recalibrate to keep insights accurate.",
            "overdue_days": recal_days_overdue,
            "severity": "high" if recal_days_overdue > 7 else "medium",
        })

    if video_due:
        alerts.append({
            "type": "video_checkin",
            "title": "Weekly Check-In Available",
            "message": "Schedule a video check-in with your BIQc advisor to review progress and priorities.",
            "severity": "low",
        })

    return {
        "alerts": alerts,
        "scheduled": scheduled,
        "last_calibration": last_calibration,
        "recalibration_due": recal_due,
        "video_checkin_due": video_due,
    }


@router.post("/checkins/schedule")
async def schedule_checkin(payload: ScheduleCheckInRequest, current_user: dict = Depends(get_current_user)):
    """Schedule a recalibration or video check-in."""
    user_id = current_user["id"]
    checkin_id = str(uuid.uuid4())

    try:
        get_sb().table("calibration_schedules").insert({
            "id": checkin_id,
            "user_id": user_id,
            "type": payload.type,
            "scheduled_for": payload.scheduled_for,
            "notes": payload.notes,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

        return {"ok": True, "check_in_id": checkin_id, "scheduled_for": payload.scheduled_for}
    except Exception as e:
        logger.error(f"[checkins/schedule] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to schedule check-in")


@router.post("/checkins/postpone")
async def postpone_checkin(payload: PostponeCheckInRequest, current_user: dict = Depends(get_current_user)):
    """Postpone a scheduled check-in to a new date."""
    try:
        get_sb().table("calibration_schedules").update({
            "scheduled_for": payload.new_date,
            "postponed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", payload.check_in_id).eq("user_id", current_user["id"]).execute()

        return {"ok": True, "new_date": payload.new_date}
    except Exception as e:
        logger.error(f"[checkins/postpone] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to postpone check-in")


@router.post("/checkins/dismiss")
async def dismiss_checkin(current_user: dict = Depends(get_current_user)):
    """Dismiss recalibration alert for 7 days."""
    user_id = current_user["id"]
    try:
        get_sb().table("calibration_schedules").insert({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "recalibration_dismissed",
            "scheduled_for": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "status": "dismissed",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        return {"ok": True, "dismissed_until": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()}
    except Exception:
        return {"ok": True}


# ═══════════════════════════════════════════════════════════════
# FORENSIC MARKET CALIBRATION — Backend Scoring Engine
# ═══════════════════════════════════════════════════════════════

FORENSIC_WEIGHTS = {
    "revenue": {"weight": 1.5, "labels": ["Maintain", "Steady Growth", "Aggressive", "Hypergrowth"]},
    "timeline": {"weight": 1.3, "labels": ["Long-term", "Medium-term", "Urgent", "Immediate"]},
    "cohort": {"weight": 1.0, "labels": ["Deepen", "Adjacent", "Diversify", "Upmarket"]},
    "risk": {"weight": 1.4, "labels": ["Conservative", "Moderate", "Aggressive", "All-in"]},
    "retention": {"weight": 1.2, "labels": ["Reactive", "Basic", "Structured", "Advanced"]},
    "pricing": {"weight": 1.1, "labels": ["Low", "Moderate", "Confident", "Data-driven"]},
    "channel": {"weight": 1.2, "labels": ["Single", "Dependent", "Diversified", "Highly Diversified"]},
}


class ForensicAnswer(BaseModel):
    answer: str
    index: int
    weight: str


class ForensicCalibrationRequest(BaseModel):
    answers: Dict[str, ForensicAnswer]


@router.post("/forensic/calibration")
async def submit_forensic_calibration(
    payload: ForensicCalibrationRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Score and persist forensic market calibration answers.
    Weighted scoring engine — replaces frontend calculation.
    """
    user_id = current_user["id"]
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        answers = payload.answers
        if not answers or len(answers) == 0:
            raise HTTPException(status_code=400, detail="No answers provided")

        # Compute weighted scores
        dimension_scores = {}
        total_weighted = 0.0
        total_weight = 0.0

        for qid, answer in answers.items():
            w_key = answer.weight
            meta = FORENSIC_WEIGHTS.get(w_key, {"weight": 1.0, "labels": []})
            idx = min(answer.index, 3)  # clamp 0-3
            normalised = idx / 3.0  # 0.0 to 1.0
            weighted = normalised * meta["weight"]
            total_weighted += weighted
            total_weight += meta["weight"]
            label = meta["labels"][idx] if idx < len(meta["labels"]) else answer.answer
            dimension_scores[w_key] = {
                "score": round(normalised * 100),
                "weighted_score": round(weighted * 100 / meta["weight"]),
                "label": label,
                "raw_index": idx,
                "answer": answer.answer,
            }

        # Composite score (0-100)
        composite = round((total_weighted / total_weight) * 100) if total_weight > 0 else 0

        # Risk profile classification
        if composite > 75:
            risk_profile = "Aggressive"
            risk_color = "#EF4444"
        elif composite > 50:
            risk_profile = "Growth-Oriented"
            risk_color = "#FF6A00"
        elif composite > 25:
            risk_profile = "Moderate"
            risk_color = "#F59E0B"
        else:
            risk_profile = "Conservative"
            risk_color = "#10B981"

        # Strategic signals
        revenue_idx = dimension_scores.get("revenue", {}).get("raw_index", 0)
        timeline_idx = dimension_scores.get("timeline", {}).get("raw_index", 0)
        risk_idx = dimension_scores.get("risk", {}).get("raw_index", 0)
        retention_idx = dimension_scores.get("retention", {}).get("raw_index", 0)
        channel_idx = dimension_scores.get("channel", {}).get("raw_index", 0)

        signals = []
        if revenue_idx >= 2 and timeline_idx >= 2:
            signals.append({"type": "warning", "text": "High growth ambition with tight timeline — monitor for execution risk."})
        if risk_idx >= 3 and retention_idx <= 1:
            signals.append({"type": "critical", "text": "Aggressive risk posture with weak retention — revenue base is vulnerable."})
        if channel_idx <= 1:
            signals.append({"type": "warning", "text": "High channel dependency — diversification recommended before scaling."})
        if retention_idx >= 2 and revenue_idx >= 2:
            signals.append({"type": "positive", "text": "Strong retention foundation supports aggressive growth trajectory."})
        if not signals:
            signals.append({"type": "info", "text": "Balanced profile — BIQc will optimise for steady growth."})

        result = {
            "composite_score": composite,
            "risk_profile": risk_profile,
            "risk_color": risk_color,
            "dimensions": dimension_scores,
            "signals": signals,
            "completed_at": now_iso,
        }

        # Persist to user_operator_profile and business_profiles
        try:
            existing = get_sb().table("user_operator_profile").select("operator_profile").eq("user_id", user_id).maybe_single().execute()
            existing_data = existing.data if existing else None
            op = (existing_data.get("operator_profile") if existing_data else None) or {}
            op["forensic_calibration"] = result
            op["forensic_calibration_raw"] = {k: {"answer": v.answer, "index": v.index, "weight": v.weight} for k, v in answers.items()}
            if existing_data:
                get_sb().table("user_operator_profile").update({"operator_profile": op, "updated_at": now_iso}).eq("user_id", user_id).execute()
            else:
                get_sb().table("user_operator_profile").insert({"user_id": user_id, "operator_profile": op}).execute()
        except Exception as e:
            logger.warning(f"[forensic] operator_profile write failed: {e}")

        # Also save to business_profiles for cognitive engine access
        try:
            bp_result = get_sb().table("business_profiles").select("id").eq("user_id", user_id).maybe_single().execute()
            bp_data = bp_result.data if bp_result else None
            if bp_data:
                get_sb().table("business_profiles").update({"forensic_calibration": result, "updated_at": now_iso}).eq("user_id", user_id).execute()
        except Exception as e:
            logger.warning(f"[forensic] business_profiles write failed: {e}")

        logger.info(f"[forensic] Scored user {user_id}: composite={composite}, risk={risk_profile}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[forensic] Scoring error: {e}")
        raise HTTPException(status_code=500, detail="Forensic calibration scoring failed")


@router.get("/forensic/calibration")
async def get_forensic_calibration(current_user: dict = Depends(get_current_user)):
    """Retrieve existing forensic calibration results for the user."""
    user_id = current_user["id"]
    try:
        result = get_sb().table("user_operator_profile").select("operator_profile").eq("user_id", user_id).maybe_single().execute()
        data = result.data if result else None
        op = (data.get("operator_profile") if data else None) or {}
        forensic = op.get("forensic_calibration")
        if forensic:
            return {"exists": True, **forensic}
        return {"exists": False}
    except Exception as e:
        logger.error(f"[forensic] Read error: {e}")
        return {"exists": False}


@router.post("/reports/save")
@router.post("/calibration/reports/save")
async def save_calibration_report(payload: ReportSaveRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id", "")
    try:
        sb = get_sb()
        sb.table("intelligence_actions").insert({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "source": f"calibration_report_{payload.report_type}",
            "source_id": f"report_{payload.report_type}_{int(datetime.now(timezone.utc).timestamp())}",
            "domain": "reports",
            "severity": "info",
            "title": payload.title,
            "description": json.dumps(payload.content, default=str)[:10000],
            "suggested_action": "Available for download in Reports section.",
            "status": "complete",
            "created_at": payload.generated_at or datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as exc:
        logger.warning("Failed to save calibration report: %s", exc)
    return {"status": "ok", "report_type": payload.report_type}

