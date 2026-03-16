"""
Deep Research + Domain Inference Engine
POST /api/research/analyze-website

P0 Infrastructure — produces structured intelligence from website URLs.
Two paths:
  1. Live scrape → LLM synthesis → structured JSON
  2. Domain inference fallback → deterministic keyword mapping → structured JSON

Safety: NEVER claims scrape success if fallback was used.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from routes.deps import get_current_user, OPENAI_KEY, logger
from core.llm_router import llm_chat
from biqc_jobs import enqueue_job
from urllib.parse import urlparse
from bs4 import BeautifulSoup
import httpx
import re
import time
import json

router = APIRouter()


# ─── Request / Response Models ───

class AnalyzeWebsiteRequest(BaseModel):
    url: str


class WebsiteIntelligence(BaseModel):
    success: bool
    inference_level: str  # "scraped" | "domain_inferred"
    industry: str
    value_proposition: str
    target_audience: str
    tone: str
    services: List[str]
    market_maturity_signal: str
    competitive_position_signal: str
    complexity_indicator: str
    confidence: str  # "high" | "moderate"
    debug: Optional[dict] = None


# ─── Domain Keyword Map ───

DOMAIN_KEYWORD_MAP = {
    "strategy": "Strategic Consulting",
    "consult": "Consulting",
    "finance": "Financial Services",
    "capital": "Investment / Finance",
    "invest": "Investment / Finance",
    "clinic": "Healthcare",
    "health": "Healthcare",
    "medical": "Healthcare",
    "pharma": "Pharmaceutical",
    "studio": "Creative Services",
    "design": "Creative Services",
    "creative": "Creative Services",
    "tech": "Software / Technology",
    "software": "Software / Technology",
    "digital": "Digital Services",
    "cyber": "Cybersecurity",
    "data": "Data & Analytics",
    "analytics": "Data & Analytics",
    "group": "Holding / Advisory",
    "partners": "Professional Services",
    "legal": "Legal Services",
    "law": "Legal Services",
    "build": "Construction / Development",
    "construct": "Construction / Development",
    "property": "Real Estate",
    "real": "Real Estate",
    "estate": "Real Estate",
    "energy": "Energy",
    "solar": "Renewable Energy",
    "food": "Food & Beverage",
    "logistics": "Logistics & Supply Chain",
    "freight": "Logistics & Supply Chain",
    "ship": "Logistics & Supply Chain",
    "media": "Media & Communications",
    "market": "Marketing Services",
    "agency": "Marketing / Agency",
    "education": "Education",
    "learn": "Education / EdTech",
    "academy": "Education",
    "insure": "Insurance",
    "advisory": "Advisory Services",
    "wealth": "Wealth Management",
    "account": "Accounting Services",
    "tax": "Accounting / Tax Services",
    "recruit": "Recruitment / HR",
    "talent": "Recruitment / HR",
    "auto": "Automotive",
    "travel": "Travel & Hospitality",
    "hotel": "Hospitality",
    "retail": "Retail",
    "shop": "Retail / E-commerce",
    "cloud": "Cloud Services",
    "ai": "Artificial Intelligence",
    "security": "Security Services",
    "engineer": "Engineering Services",
    "manufact": "Manufacturing",
    "agri": "Agriculture",
    "farm": "Agriculture",
    "sport": "Sports & Fitness",
    "fit": "Health & Fitness",
}

# Maturity signal keywords
ESTABLISHED_KEYWORDS = {"advisory", "capital", "partners", "group", "wealth", "trust", "holdings"}
EARLY_STAGE_KEYWORDS = {"labs", "startup", "studio", "ventures", "beta", "hub"}


# ─── URL Normalization ───

def normalize_url(raw: str) -> str:
    """Normalize URL: ensure https://, strip trailing slash, validate."""
    url = raw.strip()
    if not url:
        raise ValueError("Empty URL")

    # Add scheme if missing
    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"

    # Force https
    url = url.replace("http://", "https://", 1)

    # Strip trailing slash
    url = url.rstrip("/")

    # Validate structure
    parsed = urlparse(url)
    if not parsed.netloc or "." not in parsed.netloc:
        raise ValueError(f"Invalid URL: {raw}")

    return url


# ─── Domain Token Extraction ───

def extract_domain_tokens(url: str) -> List[str]:
    """Extract meaningful tokens from domain name."""
    parsed = urlparse(url)
    domain = parsed.netloc.lower()

    # Remove www. and TLD
    domain = re.sub(r"^www\.", "", domain)
    domain = re.sub(r"\.(com|co|net|org|io|ai|dev|au|uk|us|ca|nz|de|fr|app|xyz|info|biz)(\.[a-z]{2,3})?$", "", domain)

    # Split on separators
    tokens = re.split(r"[-_.]", domain)

    # Also split camelCase
    expanded = []
    for token in tokens:
        parts = re.sub(r"([a-z])([A-Z])", r"\1 \2", token).lower().split()
        expanded.extend(parts)

    # Filter noise
    noise = {"the", "my", "our", "your", "get", "go", "pro", "app", "web", "online", "site", "hq", "co", "inc"}
    return [t for t in expanded if t and len(t) > 1 and t not in noise]


# ─── Domain Inference (Fallback) ───

def infer_from_domain(url: str) -> WebsiteIntelligence:
    """Deterministic domain-based inference. No LLM. No scrape."""
    tokens = extract_domain_tokens(url)
    token_set = set(tokens)

    # Match industry from keyword map
    industry = "Professional Services"  # default
    for token in tokens:
        for keyword, category in DOMAIN_KEYWORD_MAP.items():
            if keyword in token:
                industry = category
                break
        if industry != "Professional Services":
            break

    # Maturity signal
    if token_set & ESTABLISHED_KEYWORDS:
        maturity = "established"
    elif token_set & EARLY_STAGE_KEYWORDS:
        maturity = "early-stage"
    else:
        maturity = "growth"

    return WebsiteIntelligence(
        success=True,
        inference_level="domain_inferred",
        industry=industry,
        value_proposition="Inferred from domain name",
        target_audience="To be confirmed",
        tone="Professional",
        services=[],
        market_maturity_signal=maturity,
        competitive_position_signal="inferred",
        complexity_indicator="medium",
        confidence="moderate",
        debug={
            "tokens": tokens,
            "matched_industry": industry,
            "maturity_signal_source": "keyword_match",
        },
    )


# ─── Website Scraper ───

async def scrape_website(url: str) -> Optional[dict]:
    """
    Fetch and extract structured content from a website.
    Returns None if scrape fails or content is insufficient.
    Hard timeout: 3 seconds.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        async with httpx.AsyncClient(timeout=3.0, follow_redirects=True, verify=False) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()

        html = response.text
        soup = BeautifulSoup(html, "html.parser")

        # Strip non-content elements
        for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "iframe", "svg"]):
            tag.decompose()

        # Extract structured fields
        title = ""
        if soup.title and soup.title.string:
            title = soup.title.string.strip()

        meta_desc = ""
        meta_tag = soup.find("meta", attrs={"name": "description"})
        if meta_tag and meta_tag.get("content"):
            meta_desc = meta_tag["content"].strip()

        # OG description fallback
        if not meta_desc:
            og_tag = soup.find("meta", attrs={"property": "og:description"})
            if og_tag and og_tag.get("content"):
                meta_desc = og_tag["content"].strip()

        headings = []
        for h in soup.find_all(["h1", "h2"]):
            text = h.get_text(strip=True)
            if text and len(text) > 2:
                headings.append(text)

        # Visible body text
        body_text = soup.get_text(separator="\n", strip=True)
        # Clean excessive whitespace
        body_text = re.sub(r"\n{3,}", "\n\n", body_text)
        body_text = body_text[:8000]

        # Quality check: insufficient content triggers fallback
        total_content = len(title) + len(meta_desc) + len(body_text)
        if total_content < 200:
            logger.info(f"[research] Scrape content too thin ({total_content} chars) for {url}")
            return None

        return {
            "title": title,
            "meta_description": meta_desc,
            "headings": headings[:20],
            "body_text": body_text,
            "content_length": total_content,
        }

    except httpx.TimeoutException:
        logger.info(f"[research] Scrape timeout for {url}")
        return None
    except httpx.HTTPStatusError as e:
        logger.info(f"[research] HTTP {e.response.status_code} for {url}")
        return None
    except Exception as e:
        logger.info(f"[research] Scrape failed for {url}: {e}")
        return None


# ─── LLM Synthesis ───

LLM_PROMPT = """You are a senior business consultant preparing for a board-level briefing.

Analyze the following website content.

Extract:

1. Exact Industry
2. Core Value Proposition
3. Primary Target Audience
4. Business Positioning Tone (Premium, Disruptive, Conservative, Advisory, Technical)
5. 3 Key Services or Offerings
6. Market Maturity Signal (early-stage | growth | established | enterprise)
7. Competitive Position Signal (emerging | challenger | leader | niche)
8. Complexity Indicator (low | medium | high)

Be precise.
Do not invent.
If uncertain, say "Inferred".
Return structured JSON only with these exact keys:
{
  "industry": "",
  "value_proposition": "",
  "target_audience": "",
  "tone": "",
  "services": [],
  "market_maturity_signal": "",
  "competitive_position_signal": "",
  "complexity_indicator": ""
}"""


async def synthesize_with_llm(content: dict) -> Optional[dict]:
    """Send scraped content to LLM for structured extraction."""
    try:
        content_block = f"""TITLE: {content['title']}
META DESCRIPTION: {content['meta_description']}
HEADINGS: {'; '.join(content['headings'])}
BODY CONTENT:
{content['body_text'][:6000]}"""

        response = await llm_chat(system_message=LLM_PROMPT, user_message=content_block, model="gpt-5.3", api_key=OPENAI_KEY)
        raw = response.strip()

        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)

        parsed = json.loads(raw)
        return parsed

    except json.JSONDecodeError as e:
        logger.warning(f"[research] LLM returned non-JSON: {e}")
        return None
    except Exception as e:
        logger.warning(f"[research] LLM synthesis failed: {e}")
        return None


# ─── Main Endpoint ───

async def execute_website_research_job(payload: dict) -> dict:
    """
    Deep Research + Inference Engine.
    Path 1: Scrape → LLM synthesis → structured intelligence.
    Path 2 (fallback): Domain inference → deterministic keyword mapping.
    """
    start = time.time()
    req = AnalyzeWebsiteRequest(url=str(payload.get("url") or ""))
    current_user = payload.get("current_user") or {"id": payload.get("user_id")}

    # Normalize URL
    try:
        url = normalize_url(req.url)
    except ValueError as e:
        logger.info(f"[research] Invalid URL: {req.url} — {e}")
        result = WebsiteIntelligence(
            success=False,
            inference_level="failed",
            industry="Unknown",
            value_proposition="",
            target_audience="",
            tone="",
            services=[],
            market_maturity_signal="",
            competitive_position_signal="",
            complexity_indicator="",
            confidence="low",
            debug={"error": str(e)},
        )
        return result.model_dump() if hasattr(result, 'model_dump') else result.dict()

    log_entry = {
        "url": url,
        "user_id": current_user.get("id"),
        "scrape_attempted": False,
        "scrape_success": False,
        "fallback_triggered": False,
        "response_time_ms": 0,
        "confidence_level": "",
    }

    # STEP 1: Attempt scrape
    log_entry["scrape_attempted"] = True
    scraped = await scrape_website(url)

    if scraped:
        log_entry["scrape_success"] = True

        # STEP 2: LLM synthesis
        llm_result = await synthesize_with_llm(scraped)

        if llm_result:
            elapsed = int((time.time() - start) * 1000)
            log_entry["response_time_ms"] = elapsed
            log_entry["confidence_level"] = "high"
            logger.info(f"[research] SUCCESS scraped+synthesized {url} in {elapsed}ms | {json.dumps(log_entry)}")

            result = WebsiteIntelligence(
                success=True,
                inference_level="scraped",
                industry=llm_result.get("industry", "Inferred"),
                value_proposition=llm_result.get("value_proposition", ""),
                target_audience=llm_result.get("target_audience", ""),
                tone=llm_result.get("tone", "Professional"),
                services=llm_result.get("services", []),
                market_maturity_signal=llm_result.get("market_maturity_signal", "growth"),
                competitive_position_signal=llm_result.get("competitive_position_signal", "inferred"),
                complexity_indicator=llm_result.get("complexity_indicator", "medium"),
                confidence="high",
                debug={
                    "scrape_content_length": scraped["content_length"],
                    "title": scraped["title"],
                    "headings_count": len(scraped["headings"]),
                    "response_time_ms": elapsed,
                },
            )
            return result.model_dump() if hasattr(result, 'model_dump') else result.dict()

    # STEP 3: Fallback — Domain Inference
    log_entry["fallback_triggered"] = True
    log_entry["scrape_success"] = False

    result = infer_from_domain(url)

    elapsed = int((time.time() - start) * 1000)
    log_entry["response_time_ms"] = elapsed
    log_entry["confidence_level"] = "moderate"
    logger.info(f"[research] FALLBACK domain-inferred {url} in {elapsed}ms | {json.dumps(log_entry)}")

    result.debug["response_time_ms"] = elapsed
    return result.model_dump() if hasattr(result, 'model_dump') else result.dict()


@router.post("/research/analyze-website")
async def analyze_website(req: AnalyzeWebsiteRequest, current_user: dict = Depends(get_current_user)):
    queued = await enqueue_job(
        "market-research",
        {
            "task": "research-analyze-website",
            "url": req.url,
            "user_id": current_user.get("id"),
            "workspace_id": current_user.get("id"),
            "current_user": {"id": current_user.get("id")},
        },
        company_id=current_user.get("id"),
        window_seconds=300,
    )

    if queued.get("queued"):
        return {
            "status": "queued",
            "job_type": "market-research",
            "job_id": queued.get("job_id"),
            "task": "research-analyze-website",
        }

    return WebsiteIntelligence(**(await execute_website_research_job({
        "url": req.url,
        "user_id": current_user.get("id"),
        "current_user": {"id": current_user.get("id")},
    })))
