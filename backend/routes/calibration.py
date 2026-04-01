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
import os
import uuid
import re
import json
import logging
from html import unescape

import httpx
from core.llm_router import llm_trinity_chat
from core.helpers import serper_search, scrape_url_text
from routes.deps import (
    get_current_user, get_current_user_from_request,
    get_sb, logger, cognitive_core, _normalize_subscription_tier,
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

class WebsiteEnrichRequest(BaseModel):
    url: str
    action: str = "scan"


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
    handles = {"linkedin": "", "instagram": "", "facebook": "", "x": "", "youtube": ""}
    if not html:
        return handles
    patterns = {
        "linkedin": r"https?://(?:www\.)?linkedin\.com/[\w\-\./]+",
        "instagram": r"https?://(?:www\.)?instagram\.com/[\w\-\./]+",
        "facebook": r"https?://(?:www\.)?facebook\.com/[\w\-\./]+",
        "x": r"https?://(?:www\.)?(?:x|twitter)\.com/[\w\-\./]+",
        "youtube": r"https?://(?:www\.)?youtube\.com/[\w\-\./\?=&]+",
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


def _build_competitor_swot(competitors: List[str], target_market: str, uvp: str) -> List[Dict[str, Any]]:
    snapshots = []
    for name in (competitors or [])[:5]:
        snapshots.append({
            "name": name,
            "strengths": ["Likely category visibility and demand capture in current market."],
            "weaknesses": ["Differentiation depth unknown from public signals."],
            "opportunities_against_them": [
                f"Out-position with sharper UVP for {target_market or 'core buyers'}.",
                f"Use evidence-led messaging to contrast against generic market claims."
            ],
            "threat_level": "medium",
        })
    if not snapshots:
        snapshots.append({
            "name": "Category competitors (unresolved)",
            "strengths": ["Potentially stronger existing awareness."],
            "weaknesses": ["Unverified proposition and trust signal depth."],
            "opportunities_against_them": [
                "Run targeted competitor SERP and messaging benchmark.",
                "Differentiate on measurable outcomes and proof assets.",
            ],
            "threat_level": "medium",
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
    user_email = current_user.get("email", "")
    founder_email = (os.environ.get("BIQC_MASTER_ADMIN_EMAIL") or "").strip().lower()
    if user_role not in ("superadmin", "admin") and (not founder_email or user_email.strip().lower() != founder_email):
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

    if payload.action == "scan":
        try:
            page_text = await scrape_url_text(url)
            raw_html = ""
            try:
                async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
                    raw_resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; BIQcBot/1.0)"})
                    if raw_resp.status_code < 400:
                        raw_html = raw_resp.text
            except Exception:
                raw_html = ""

            domain = _extract_domain(url)
            page_title = _extract_title(raw_html)
            meta_description = _extract_meta_content(raw_html, "description") or _extract_meta_content(raw_html, "og:description")
            og_site_name = _extract_meta_content(raw_html, "og:site_name") or _extract_meta_content(raw_html, "twitter:title")
            business_name_hint = _clean_business_name(og_site_name) or _clean_business_name(page_title) or domain.split(".")[0].replace("-", " ").title()
            service_lines = _extract_service_lines(page_text)
            competitor_query = f'"{business_name_hint}" competitors australia {page_title or ""}'.strip()
            company_query = f"site:{domain} company profile services about"
            abn_query = f"{domain} ABN"

            company_search = await serper_search(company_query, gl="au", hl="en", num=8)
            competitor_search = await serper_search(competitor_query, gl="au", hl="en", num=8)
            abn_search = await serper_search(abn_query, gl="au", hl="en", num=5)

            combined_text = "\n\n".join([
                page_text[:12000],
                "\n".join([f"- {r.get('title')}: {r.get('snippet')}" for r in (company_search.get("results") or [])]),
                "\n".join([f"- {r.get('title')}: {r.get('snippet')}" for r in (competitor_search.get("results") or [])]),
                "\n".join([f"- {r.get('title')}: {r.get('snippet')}" for r in (abn_search.get("results") or [])]),
            ])
            abn_candidates = _extract_abn_candidates(combined_text)

            from core.ai_core import get_ai_response
            synthesis_prompt = (
                f"Analyze this business website and deep web signals for onboarding.\n"
                f"URL: {url}\n"
                "Return JSON keys: business_name, description, industry, main_products_services, target_market, "
                "unique_value_proposition, competitive_advantages, competitors, competitor_analysis, market_position, "
                "abn, social_handles, trust_signals, executive_summary, confidence, "
                "cmo_executive_brief, seo_analysis, paid_media_analysis, social_media_analysis, website_health, swot, competitor_swot, cmo_priority_actions.\n"
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
                "industry": page_title or "",
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
                "confidence": "medium",
                "cmo_executive_brief": "",
                "seo_analysis": {},
                "paid_media_analysis": {},
                "social_media_analysis": {},
                "website_health": {},
                "swot": {},
                "competitor_swot": [],
                "cmo_priority_actions": [],
                "sources": {
                    "company": company_search.get("results") or [],
                    "competitors": competitor_search.get("results") or [],
                    "abn": abn_search.get("results") or [],
                },
            }

            try:
                parsed = _extract_json_candidate(ai_json)
                if isinstance(parsed, dict):
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

            # deterministic social handle fallback extraction
            for platform, pattern in {
                "linkedin": r"https?://(?:www\.)?linkedin\.com/[\w\-/]+",
                "instagram": r"https?://(?:www\.)?instagram\.com/[\w\./-]+",
                "facebook": r"https?://(?:www\.)?facebook\.com/[\w\./-]+",
                "x": r"https?://(?:www\.)?(?:x|twitter)\.com/[\w\./-]+",
                "youtube": r"https?://(?:www\.)?youtube\.com/[\w\./?=&-]+",
            }.items():
                if not enrichment["social_handles"].get(platform):
                    m = re.search(pattern, combined_text, re.IGNORECASE)
                    if m:
                        enrichment["social_handles"][platform] = m.group(0)

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

            seo_analysis = _build_seo_analysis(raw_html, page_text, page_title, meta_description)
            paid_media_analysis = _build_paid_media_analysis(combined_text)
            social_media_analysis = _build_social_media_analysis(enrichment.get("social_handles") or {}, combined_text)
            swot = _build_swot(enrichment, seo_analysis, social_media_analysis, paid_media_analysis)
            competitor_swot = _build_competitor_swot(
                enrichment.get("competitors") or [],
                enrichment.get("target_market") or "",
                enrichment.get("unique_value_proposition") or "",
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

            return {
                "status": "draft",
                "url": url,
                "enrichment": enrichment,
                "message": "Deep scan completed. Review and continue to calibration summary.",
            }
        except Exception as e:
            logger.error(f"[enrichment/website] Scan failed: {e}")
            return {"status": "error", "message": f"Failed to scan: {str(e)[:100]}"}

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
FORENSIC_FREE_COOLDOWN_DAYS = 30


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
        tier = _normalize_subscription_tier(current_user.get("subscription_tier"))
        is_paid = tier in {"starter", "super_admin"}
        if not is_paid:
            usage = get_sb().table("user_feature_usage").select("last_used_at").eq("user_id", user_id).eq("feature_name", "forensic_calibration").maybe_single().execute()
            usage_row = usage.data if usage else None
            last_used_at = (usage_row or {}).get("last_used_at")
            if last_used_at:
                try:
                    used_at = datetime.fromisoformat(str(last_used_at).replace("Z", "+00:00"))
                    elapsed_days = (datetime.now(timezone.utc) - used_at).total_seconds() / 86400
                    if elapsed_days < FORENSIC_FREE_COOLDOWN_DAYS:
                        days_until = max(1, int(FORENSIC_FREE_COOLDOWN_DAYS - elapsed_days))
                        raise HTTPException(
                            status_code=429,
                            detail=f"Forensic calibration is available once every {FORENSIC_FREE_COOLDOWN_DAYS} days on free tier. Try again in {days_until} day(s).",
                        )
                except HTTPException:
                    raise
                except Exception:
                    pass

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

        # Record usage for free-tier cooldown enforcement and visibility in /soundboard/scan-usage.
        try:
            existing_usage = get_sb().table("user_feature_usage").select("id,total_runs").eq("user_id", user_id).eq("feature_name", "forensic_calibration").maybe_single().execute()
            usage_row = existing_usage.data if existing_usage else None
            if usage_row:
                get_sb().table("user_feature_usage").update({
                    "last_used_at": now_iso,
                    "total_runs": int(usage_row.get("total_runs") or 0) + 1,
                    "updated_at": now_iso,
                }).eq("id", usage_row["id"]).execute()
            else:
                get_sb().table("user_feature_usage").insert({
                    "user_id": user_id,
                    "feature_name": "forensic_calibration",
                    "last_used_at": now_iso,
                    "total_runs": 1,
                    "updated_at": now_iso,
                }).execute()
        except Exception as e:
            logger.warning(f"[forensic] usage write failed: {e}")

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

