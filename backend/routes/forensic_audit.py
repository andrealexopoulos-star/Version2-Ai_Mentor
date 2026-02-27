"""Forensic Ingestion Engine — 3-layer deterministic audit.

Layer 1: Extraction (HTTP fetch, redirect, DOM capture)
Layer 2: Semantic Cleaning (boilerplate removal, core content weighting)
Layer 3: Cognitive Synthesis (hallucination detection, lost signal detection)

No external assumptions. No inferred industry norms. No LLM enrichment.
"""
import re
import time
import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse, urljoin

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user


class AuditRequest(BaseModel):
    url: str
    existing_snapshot: Optional[dict] = None


# ═══════════════════════════════════════════════════════════════
# LAYER 1 — DATA EXTRACTION
# ═══════════════════════════════════════════════════════════════

async def layer1_extraction(url: str) -> dict:
    """Deterministic HTTP fetch with redirect tracking and DOM capture."""
    result = {
        "status": "pass",
        "failure_codes": [],
        "canonical_url": None,
        "final_url": None,
        "http_status": 0,
        "raw_html": "",
        "raw_html_length": 0,
        "content_length": 0,
        "fetch_time_ms": 0,
        "redirect_chain": [],
        "has_structured_data": False,
        "noise_ratio": 0.0,
        "main_content_present": False,
    }

    # Normalize URL
    parsed = urlparse(url)
    if not parsed.scheme:
        url = "https://" + url
    url = url.rstrip("/")

    start = time.time()

    try:
        async with httpx.AsyncClient(
            timeout=10.0,
            follow_redirects=True,
            verify=False,
            max_redirects=10,
        ) as client:
            response = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; BIQcAudit/1.0)",
                "Accept": "text/html,application/xhtml+xml",
            })

            result["fetch_time_ms"] = int((time.time() - start) * 1000)
            result["http_status"] = response.status_code
            result["final_url"] = str(response.url)

            # Track redirect chain
            for h in response.history:
                result["redirect_chain"].append({
                    "url": str(h.url),
                    "status": h.status_code,
                })

            if response.status_code != 200:
                result["status"] = "fail"
                result["failure_codes"].append("A4_redirect_misalignment" if response.history else "A5_partial_fetch")
                return result

            html = response.text
            result["raw_html"] = html
            result["raw_html_length"] = len(html)

    except httpx.TimeoutException:
        result["fetch_time_ms"] = int((time.time() - start) * 1000)
        result["status"] = "fail"
        result["failure_codes"].append("A5_partial_fetch")
        return result
    except Exception as e:
        result["status"] = "fail"
        result["failure_codes"].append("A5_partial_fetch")
        return result

    # Check HTML length thresholds
    if len(html) < 2000:
        result["failure_codes"].append("A5_partial_fetch")
        result["status"] = "fail"
    elif len(html) < 5000:
        result["failure_codes"].append("A5_partial_fetch_warning")

    # Parse DOM
    soup = BeautifulSoup(html, "html.parser")

    # Check for main content container
    main_selectors = ["main", "article", "[role='main']", "#content", ".content", "#main", ".main-content"]
    for sel in main_selectors:
        if soup.select_one(sel):
            result["main_content_present"] = True
            break

    if not result["main_content_present"]:
        # Check if body has substantial content
        body = soup.find("body")
        if body and len(body.get_text(strip=True)) > 500:
            result["main_content_present"] = True
        else:
            result["failure_codes"].append("A1_dom_drift")

    # Check for structured data
    json_ld = soup.find_all("script", type="application/ld+json")
    result["has_structured_data"] = len(json_ld) > 0

    # Canonical URL
    canonical = soup.find("link", rel="canonical")
    if canonical and canonical.get("href"):
        result["canonical_url"] = canonical["href"]

    # Compute noise ratio (nav/footer text vs total text)
    total_text = soup.get_text(strip=True)
    nav_footer_text = ""
    for tag in soup.find_all(["nav", "footer", "header"]):
        nav_footer_text += tag.get_text(strip=True)

    result["content_length"] = len(total_text)
    result["noise_ratio"] = round(len(nav_footer_text) / max(len(total_text), 1), 3)

    if result["noise_ratio"] > 0.35:
        result["failure_codes"].append("A3_navigation_dominance")
        if result["status"] == "pass":
            result["status"] = "warning"

    return result


# ═══════════════════════════════════════════════════════════════
# LAYER 2 — SEMANTIC CLEANING
# ═══════════════════════════════════════════════════════════════

def layer2_cleaning(raw_html: str) -> dict:
    """Rule-based content cleaning with section weighting."""
    result = {
        "status": "pass",
        "failure_codes": [],
        "cleaned_text": "",
        "nav_removed": False,
        "footer_removed": False,
        "cookie_removed": False,
        "unique_sentence_ratio": 0.0,
        "core_content_weight": 0.0,
        "sections": [],
        "top_repeated_strings": [],
    }

    soup = BeautifulSoup(raw_html, "html.parser")

    # Track what we remove
    removed_tags = []

    # Remove navigation
    for tag in soup.find_all("nav"):
        removed_tags.append(("nav", len(tag.get_text(strip=True))))
        tag.decompose()
        result["nav_removed"] = True

    # Remove footer
    for tag in soup.find_all("footer"):
        removed_tags.append(("footer", len(tag.get_text(strip=True))))
        tag.decompose()
        result["footer_removed"] = True

    # Remove header (site header, not content headings)
    for tag in soup.find_all("header"):
        removed_tags.append(("header", len(tag.get_text(strip=True))))
        tag.decompose()

    # Remove scripts, styles, iframes
    for tag in soup(["script", "style", "noscript", "iframe", "svg"]):
        tag.decompose()

    # Remove cookie banners (common patterns)
    cookie_selectors = [
        "[class*='cookie']", "[id*='cookie']",
        "[class*='consent']", "[id*='consent']",
        "[class*='gdpr']", "[id*='gdpr']",
        "[class*='banner']",
    ]
    for sel in cookie_selectors:
        for tag in soup.select(sel):
            if len(tag.get_text(strip=True)) < 500:
                tag.decompose()
                result["cookie_removed"] = True

    # Extract cleaned text
    cleaned = soup.get_text(separator="\n", strip=True)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    result["cleaned_text"] = cleaned[:12000]

    # Compute unique sentence ratio
    sentences = [s.strip() for s in re.split(r'[.!?]+', cleaned) if len(s.strip()) > 20]
    unique = list(set(sentences))
    result["unique_sentence_ratio"] = round(len(unique) / max(len(sentences), 1), 3)

    if result["unique_sentence_ratio"] < 0.5:
        result["failure_codes"].append("B1_noise_retention")
        result["status"] = "warning"

    # Find top repeated strings (potential boilerplate)
    word_chunks = {}
    for s in sentences:
        key = s[:50]
        word_chunks[key] = word_chunks.get(key, 0) + 1
    result["top_repeated_strings"] = [
        {"text": k[:100], "count": v}
        for k, v in sorted(word_chunks.items(), key=lambda x: -x[1])[:10]
        if v > 1
    ]

    # Section detection and weighting
    sections = []

    # About page content (high weight)
    about_patterns = re.findall(r'(?:about\s+us|who\s+we\s+are|our\s+story|our\s+mission)(.*?)(?=\n\n|\Z)', cleaned, re.IGNORECASE | re.DOTALL)
    if about_patterns:
        sections.append({"name": "about", "weight": 0.9, "length": sum(len(p) for p in about_patterns)})

    # Services content (high weight)
    services_patterns = re.findall(r'(?:our\s+services|what\s+we\s+do|solutions|capabilities)(.*?)(?=\n\n|\Z)', cleaned, re.IGNORECASE | re.DOTALL)
    if services_patterns:
        sections.append({"name": "services", "weight": 0.85, "length": sum(len(p) for p in services_patterns)})

    # Hero/intro content (high weight)
    hero_text = cleaned[:500] if cleaned else ""
    if hero_text:
        sections.append({"name": "hero", "weight": 0.8, "length": len(hero_text)})

    # Blog content (low weight)
    blog_patterns = re.findall(r'(?:blog|news|latest\s+posts|recent\s+articles)(.*?)(?=\n\n|\Z)', cleaned, re.IGNORECASE | re.DOTALL)
    if blog_patterns:
        sections.append({"name": "blog", "weight": 0.2, "length": sum(len(p) for p in blog_patterns)})

    result["sections"] = sections

    # Core content weight = weighted section length / total length
    total_len = max(len(cleaned), 1)
    weighted_sum = sum(s["weight"] * s["length"] for s in sections)
    result["core_content_weight"] = round(weighted_sum / total_len, 3)

    # Check for blog overweight
    blog_len = sum(s["length"] for s in sections if s["name"] == "blog")
    core_len = sum(s["length"] for s in sections if s["name"] in ("about", "services", "hero"))
    if blog_len > core_len and blog_len > 0:
        result["failure_codes"].append("B3_temporal_bias")
        result["status"] = "warning"

    return result


# ═══════════════════════════════════════════════════════════════
# LAYER 3 — COGNITIVE SYNTHESIS AUDIT
# ═══════════════════════════════════════════════════════════════

def layer3_synthesis(cleaned_text: str, snapshot: dict) -> dict:
    """Detect hallucinations, lost signals, and inference failures.
    Purely rule-based comparison — no LLM."""
    result = {
        "status": "pass",
        "failure_codes": [],
        "hallucinations": [],
        "lost_signals": [],
        "prompt_inference_flags": [],
        "traceable_claims": 0,
        "untraceable_claims": 0,
    }

    if not snapshot or not cleaned_text:
        result["status"] = "insufficient_data"
        return result

    cleaned_lower = cleaned_text.lower()

    # === HALLUCINATION DETECTION ===
    # Check numeric claims in snapshot against raw text
    snapshot_str = str(snapshot)

    # Revenue/financial claims
    money_patterns = re.findall(r'\$[\d,]+(?:\.\d+)?[KkMm]?', snapshot_str)
    for claim in money_patterns:
        if claim not in cleaned_text and claim.lower() not in cleaned_lower:
            result["hallucinations"].append({
                "type": "C1_numeric_hallucination",
                "claim": claim,
                "evidence": "Not found in raw scrape",
            })

    # Employee count claims
    employee_patterns = re.findall(r'(\d+)\s*(?:employees?|staff|team members?|people)', snapshot_str, re.IGNORECASE)
    for count in employee_patterns:
        if count not in cleaned_text:
            result["hallucinations"].append({
                "type": "C1_numeric_hallucination",
                "claim": f"{count} employees/staff",
                "evidence": "Not found in raw scrape",
            })

    # Industry classification check
    industry_fields = []
    for key in ["industry", "sector", "vertical", "market"]:
        val = snapshot.get(key) or snapshot.get("extracted_data", {}).get(key)
        if val and isinstance(val, str):
            industry_fields.append(val)

    for ind in industry_fields:
        ind_words = [w.lower() for w in ind.split() if len(w) > 3]
        found = any(w in cleaned_lower for w in ind_words)
        if not found:
            result["hallucinations"].append({
                "type": "C2_industry_assumption",
                "claim": f"Industry: {ind}",
                "evidence": "Industry terms not found in raw scrape",
            })

    # Competitor list check
    competitors = snapshot.get("competitors", []) or snapshot.get("market", {}).get("competitors", [])
    if isinstance(competitors, list):
        for comp in competitors:
            name = comp.get("name", comp) if isinstance(comp, dict) else str(comp)
            if name and name.lower() not in cleaned_lower:
                result["hallucinations"].append({
                    "type": "C3_competitive_guesswork",
                    "claim": f"Competitor: {name}",
                    "evidence": "Not mentioned in raw scrape",
                })

    # Generic SMB phrases (prompt inference)
    generic_phrases = [
        "growing business", "competitive advantage", "market leader",
        "industry standard", "best practices", "cutting edge",
        "innovative solutions", "customer-centric", "data-driven",
        "scalable solution", "enterprise grade",
    ]
    for phrase in generic_phrases:
        if phrase in snapshot_str.lower() and phrase not in cleaned_lower:
            result["prompt_inference_flags"].append({
                "type": "C5_ai_narrative_fill",
                "phrase": phrase,
                "evidence": "Generic phrase not from source content",
            })

    # === LOST SIGNAL DETECTION ===
    # Find specific facts in raw that aren't in snapshot

    # ABN/ACN
    abn_matches = re.findall(r'\b(\d{2}\s?\d{3}\s?\d{3}\s?\d{3})\b', cleaned_text)
    for abn in abn_matches:
        clean_abn = abn.replace(" ", "")
        if len(clean_abn) == 11 and clean_abn not in snapshot_str:
            result["lost_signals"].append({
                "type": "ABN",
                "value": abn,
                "evidence": "ABN found in scrape but not in snapshot",
            })

    # Phone numbers
    phones = re.findall(r'(?:\+61|0)[2-9]\d{1,2}[\s\-]?\d{3,4}[\s\-]?\d{3,4}', cleaned_text)
    for phone in phones[:3]:
        if phone not in snapshot_str:
            result["lost_signals"].append({
                "type": "phone",
                "value": phone,
                "evidence": "Phone number in scrape not captured in snapshot",
            })

    # Email
    emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', cleaned_text)
    for email in emails[:3]:
        if email not in snapshot_str and "example" not in email and "sentry" not in email:
            result["lost_signals"].append({
                "type": "email",
                "value": email,
                "evidence": "Email in scrape not captured in snapshot",
            })

    # Location mentions
    locations = re.findall(r'\b(Sydney|Melbourne|Brisbane|Perth|Adelaide|Hobart|Darwin|Canberra)\b', cleaned_text, re.IGNORECASE)
    for loc in set(locations):
        if loc.lower() not in snapshot_str.lower():
            result["lost_signals"].append({
                "type": "location",
                "value": loc,
                "evidence": "Location mentioned in scrape but not in snapshot",
            })

    # Scoring
    result["untraceable_claims"] = len(result["hallucinations"])
    result["traceable_claims"] = max(0, 10 - result["untraceable_claims"])  # Approximate

    if len(result["hallucinations"]) > 3:
        result["failure_codes"].append("C1_numeric_hallucination" if any(h["type"] == "C1_numeric_hallucination" for h in result["hallucinations"]) else "C4_overgeneralisation")
        result["status"] = "fail"
    elif len(result["hallucinations"]) > 0:
        result["status"] = "warning"

    if len(result["prompt_inference_flags"]) > 2:
        result["failure_codes"].append("C5_ai_narrative_fill")
        if result["status"] == "pass":
            result["status"] = "warning"

    return result


# ═══════════════════════════════════════════════════════════════
# METADATA & FRESHNESS CHECK
# ═══════════════════════════════════════════════════════════════

def check_metadata_freshness(raw_html: str, cleaned_text: str) -> dict:
    result = {
        "copyright_year": None,
        "latest_blog_date": None,
        "freshness_status": "unknown",
        "failure_codes": [],
    }

    # Copyright year
    copyright_match = re.search(r'(?:©|\bcopyright\b)\s*(\d{4})', raw_html, re.IGNORECASE)
    if copyright_match:
        result["copyright_year"] = int(copyright_match.group(1))

    # Blog dates
    date_patterns = re.findall(r'(\d{1,2})\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})', raw_html, re.IGNORECASE)
    if date_patterns:
        years = [int(y) for _, y in date_patterns]
        result["latest_blog_date"] = max(years) if years else None

    # Freshness assessment
    current_year = datetime.now().year
    if result["copyright_year"]:
        if result["copyright_year"] < current_year - 1:
            result["freshness_status"] = "stale"
            result["failure_codes"].append("D1_legacy_bias")
        elif result["copyright_year"] == current_year:
            result["freshness_status"] = "current"
        else:
            result["freshness_status"] = "recent"

    return result


# ═══════════════════════════════════════════════════════════════
# ROOT CAUSE VERDICT
# ═══════════════════════════════════════════════════════════════

def compute_verdict(l1: dict, l2: dict, l3: dict, meta: dict) -> dict:
    all_codes = l1.get("failure_codes", []) + l2.get("failure_codes", []) + l3.get("failure_codes", []) + meta.get("failure_codes", [])

    primary = "none"
    secondary = None
    confidence = 1.0

    # Determine primary failure layer
    a_codes = [c for c in all_codes if c.startswith("A")]
    b_codes = [c for c in all_codes if c.startswith("B")]
    c_codes = [c for c in all_codes if c.startswith("C")]
    d_codes = [c for c in all_codes if c.startswith("D")]

    if a_codes:
        primary = "extraction"
        confidence -= 0.1 * len(a_codes)
    elif c_codes:
        primary = "synthesis"
        confidence -= 0.1 * len(c_codes)
    elif b_codes:
        primary = "cleaning"
        confidence -= 0.1 * len(b_codes)
    elif d_codes:
        primary = "metadata"
        confidence -= 0.05 * len(d_codes)

    # Secondary
    layers = {"extraction": a_codes, "cleaning": b_codes, "synthesis": c_codes, "metadata": d_codes}
    for layer, codes in layers.items():
        if codes and layer != primary:
            secondary = layer
            break

    # Remediation
    remediation = []
    if a_codes:
        remediation.append({"layer": "extraction", "action": "Improve scraper: add JS rendering, increase timeout, handle redirects", "priority": "high"})
    if b_codes:
        remediation.append({"layer": "cleaning", "action": "Adjust parser rules: improve boilerplate detection, prioritize core content sections", "priority": "medium"})
    if c_codes:
        remediation.append({"layer": "synthesis", "action": "Tighten prompt constraints: require fact tracing, prohibit numeric invention, block competitor inference", "priority": "high"})
    if d_codes:
        remediation.append({"layer": "metadata", "action": "Add freshness checks: deprioritize stale content, flag outdated copyright", "priority": "low"})

    return {
        "primary_failure_layer": primary,
        "secondary_failure_layer": secondary,
        "failure_codes": all_codes,
        "confidence": round(max(confidence, 0), 2),
        "remediation": remediation,
    }


# ═══════════════════════════════════════════════════════════════
# API ENDPOINT
# ═══════════════════════════════════════════════════════════════

@router.post("/forensic/ingestion-audit")
async def run_ingestion_audit(req: AuditRequest, current_user: dict = Depends(get_current_user)):
    """Run a complete 3-layer forensic audit on a URL."""
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL required")

    # Layer 1: Extraction
    l1 = await layer1_extraction(url)

    # Layer 2: Cleaning (only if extraction succeeded)
    l2 = layer2_cleaning(l1["raw_html"]) if l1["raw_html"] else {
        "status": "skipped", "failure_codes": [], "cleaned_text": "",
        "nav_removed": False, "footer_removed": False, "cookie_removed": False,
        "unique_sentence_ratio": 0, "core_content_weight": 0, "sections": [],
        "top_repeated_strings": [],
    }

    # Layer 3: Synthesis audit (compare snapshot to raw)
    snapshot = req.existing_snapshot
    if not snapshot:
        # Try to load existing snapshot from Supabase
        try:
            from supabase_client import get_supabase_client
            sb = get_supabase_client()
            snap_res = sb.table("intelligence_snapshots") \
                .select("cognitive_snapshot") \
                .eq("user_id", current_user["id"]) \
                .order("generated_at", desc=True) \
                .limit(1).execute()
            if snap_res.data:
                snapshot = snap_res.data[0].get("cognitive_snapshot", {})
        except Exception:
            pass

    l3 = layer3_synthesis(l2["cleaned_text"], snapshot or {})

    # Metadata & Freshness
    meta = check_metadata_freshness(l1["raw_html"], l2["cleaned_text"])

    # Verdict
    verdict = compute_verdict(l1, l2, l3, meta)

    # Store audit result
    audit_record = {
        "workspace_id": current_user["id"],
        "target_url": url,
        "final_url": l1.get("final_url"),
        "http_status": l1.get("http_status"),
        "extraction_status": l1["status"],
        "raw_html_length": l1.get("raw_html_length", 0),
        "content_length": l1.get("content_length", 0),
        "noise_ratio": l1.get("noise_ratio", 0),
        "fetch_time_ms": l1.get("fetch_time_ms", 0),
        "has_structured_data": l1.get("has_structured_data", False),
        "redirect_chain": l1.get("redirect_chain", []),
        "cleaning_status": l2["status"],
        "nav_removed": l2.get("nav_removed", False),
        "footer_removed": l2.get("footer_removed", False),
        "cookie_removed": l2.get("cookie_removed", False),
        "unique_sentence_ratio": l2.get("unique_sentence_ratio", 0),
        "core_content_weight": l2.get("core_content_weight", 0),
        "sections_detected": l2.get("sections", []),
        "synthesis_status": l3["status"],
        "hallucinations": l3.get("hallucinations", []),
        "lost_signals": l3.get("lost_signals", []),
        "prompt_inference_flags": l3.get("prompt_inference_flags", []),
        "copyright_year": meta.get("copyright_year"),
        "latest_blog_date": str(meta.get("latest_blog_date")) if meta.get("latest_blog_date") else None,
        "freshness_status": meta.get("freshness_status"),
        "primary_failure_layer": verdict["primary_failure_layer"],
        "secondary_failure_layer": verdict.get("secondary_failure_layer"),
        "failure_codes": verdict["failure_codes"],
        "confidence_score": verdict["confidence"],
        "remediation": verdict["remediation"],
    }

    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        sb.table("ingestion_audits").insert(audit_record).execute()
    except Exception as e:
        logger.warning(f"Failed to store audit: {e}")

    return {
        "extraction": {
            "status": l1["status"],
            "canonical_url": l1.get("canonical_url"),
            "final_url": l1.get("final_url"),
            "http_status": l1.get("http_status"),
            "raw_html_length": l1.get("raw_html_length"),
            "content_length": l1.get("content_length"),
            "noise_ratio": l1.get("noise_ratio"),
            "fetch_time_ms": l1.get("fetch_time_ms"),
            "has_structured_data": l1.get("has_structured_data"),
            "redirect_chain": l1.get("redirect_chain"),
            "main_content_present": l1.get("main_content_present"),
            "failure_codes": l1.get("failure_codes", []),
        },
        "cleaning": {
            "status": l2["status"],
            "nav_removed": l2.get("nav_removed"),
            "footer_removed": l2.get("footer_removed"),
            "cookie_removed": l2.get("cookie_removed"),
            "unique_sentence_ratio": l2.get("unique_sentence_ratio"),
            "core_content_weight": l2.get("core_content_weight"),
            "sections": l2.get("sections", []),
            "top_repeated_strings": l2.get("top_repeated_strings", [])[:5],
            "failure_codes": l2.get("failure_codes", []),
        },
        "synthesis": {
            "status": l3["status"],
            "hallucinations": l3.get("hallucinations", []),
            "lost_signals": l3.get("lost_signals", []),
            "prompt_inference_flags": l3.get("prompt_inference_flags", []),
            "traceable_claims": l3.get("traceable_claims", 0),
            "untraceable_claims": l3.get("untraceable_claims", 0),
            "failure_codes": l3.get("failure_codes", []),
        },
        "metadata": {
            "copyright_year": meta.get("copyright_year"),
            "latest_blog_date": meta.get("latest_blog_date"),
            "freshness_status": meta.get("freshness_status"),
            "failure_codes": meta.get("failure_codes", []),
        },
        "verdict": verdict,
    }


@router.get("/forensic/ingestion-history")
async def get_ingestion_history(current_user: dict = Depends(get_current_user)):
    """Get past ingestion audit results."""
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.table("ingestion_audits") \
            .select("id, target_url, final_url, extraction_status, cleaning_status, synthesis_status, primary_failure_layer, confidence_score, noise_ratio, created_at") \
            .eq("workspace_id", current_user["id"]) \
            .order("created_at", desc=True) \
            .limit(20).execute()
        return {"audits": result.data or []}
    except Exception:
        return {"audits": []}
