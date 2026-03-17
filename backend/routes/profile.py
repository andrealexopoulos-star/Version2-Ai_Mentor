"""
Profile, Dashboard, OAC & Notifications Routes.
Extracted from server.py. Includes business profile CRUD, OAC recommendations,
dashboard stats, focus areas, and smart notifications.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
import json
import re
import logging
from intelligence_live_truth import get_recent_observation_events, build_watchtower_events

from core.llm_router import llm_chat
from routes.deps import (
    get_current_user, get_current_user_from_request,
    get_sb, OPENAI_KEY, AI_MODEL, AI_MODEL_ADVANCED, cognitive_core, logger,
)
from routes.deps import get_admin_user, get_client_admin, get_super_admin
from supabase_client import safe_query_single
from prompt_registry import get_prompt
from auth_supabase import get_user_by_id
from supabase_intelligence_helpers import (
    get_business_profile_supabase, update_business_profile_supabase,
    get_email_intelligence_supabase, get_calendar_intelligence_supabase,
    get_chat_history_supabase, get_user_data_files_supabase,
    get_user_analyses_supabase, get_soundboard_conversation_supabase,
    count_user_data_files_supabase, get_priority_analysis_supabase,
)
from supabase_remaining_helpers import (
    get_oac_usage_supabase, update_oac_usage_supabase,
    get_oac_recommendations_supabase, update_oac_recommendations_supabase,
    get_web_sources_supabase, get_setting_supabase,
    update_setting_supabase, dismiss_notification_supabase,
    get_onboarding_supabase,
)
from supabase_document_helpers import (
    get_user_documents_supabase, count_user_documents_supabase,
)
from supabase_email_helpers import count_user_emails_supabase, get_user_calendar_events_supabase
from core.helpers import fetch_website_text, compute_missing_profile_fields, serper_search
from core.ai_core import get_ai_response

router = APIRouter()

# ─── In-memory cache for dashboard stats (short TTL) ───
_dashboard_cache = {}
_CACHE_TTL = 30  # seconds


def _get_cached(key):
    """Get value from cache if not expired."""
    import time
    entry = _dashboard_cache.get(key)
    if entry and (time.time() - entry["ts"]) < _CACHE_TTL:
        return entry["val"]
    return None


def _set_cached(key, val):
    """Set value in cache."""
    import time
    _dashboard_cache[key] = {"val": val, "ts": time.time()}


# ─── Models needed by profile routes ───

class BusinessProfileAutofillRequest(BaseModel):
    business_name: Optional[str] = None
    abn: Optional[str] = None
    website_url: Optional[str] = None
    data_file_ids: Optional[List[str]] = None

class BusinessProfileAutofillResponse(BaseModel):
    patch: Dict[str, Any]
    missing_fields: List[str]
    sources: Dict[str, Any]

class BusinessProfileUpdate(BaseModel):
    business_name: Optional[str] = None
    industry: Optional[str] = None
    business_type: Optional[str] = None
    business_stage: Optional[str] = None
    year_founded: Optional[int] = None
    website: Optional[str] = None
    location: Optional[str] = None
    abn: Optional[str] = None
    acn: Optional[str] = None
    target_market: Optional[str] = None
    target_country: Optional[str] = None
    ideal_customer_profile: Optional[str] = None
    main_products_services: Optional[str] = None
    unique_value_proposition: Optional[str] = None
    employee_count: Optional[str] = None
    annual_revenue: Optional[str] = None
    business_model: Optional[str] = None
    mission_statement: Optional[str] = None
    vision_statement: Optional[str] = None
    short_term_goals: Optional[str] = None
    long_term_goals: Optional[str] = None
    main_challenges: Optional[str] = None
    growth_strategy: Optional[str] = None
    retention_known: Optional[bool] = None
    retention_rate_range: Optional[str] = None
    retention_rag: Optional[str] = None
    founder_background: Optional[str] = None
    team_size: Optional[str] = None
    years_operating: Optional[str] = None
    products_services: Optional[str] = None
    growth_goals: Optional[str] = None
    risk_profile: Optional[str] = None


# ==================== BUSINESS PROFILE ROUTES ====================

@router.get("/business-profile")
async def get_business_profile(current_user: dict = Depends(get_current_user)):
    """Get user's business profile — reads from business_profiles (authoritative).
    Falls back to users table, mapping company_name → business_name."""
    profile = await get_business_profile_supabase(get_sb(), current_user["id"])
    if not profile:
        return {
            "user_id": current_user["id"],
            "business_name": current_user.get("company_name") or current_user.get("business_name"),
            "industry": current_user.get("industry")
        }
    return profile


@router.get("/business-profile/versioned")
async def get_versioned_profile(current_user: dict = Depends(get_current_user)):
    """Get full versioned business profile with all metadata"""
    profile = await get_active_profile(current_user["id"])
    
    if not profile:
        raise HTTPException(status_code=404, detail="No business profile found")
    
    return profile


@router.get("/business-profile/history")
async def get_profile_history(current_user: dict = Depends(get_current_user)):
    """Get all profile versions (active and archived)"""
    result = get_sb().table("business_profiles_versioned").select("*").eq(
        "user_id", current_user["id"]
    ).order("created_at", desc=True).limit(100).execute()

    return result.data if result.data else []


class ProfileUpdateRequest(BaseModel):
    updated_fields: Dict[str, Any]
    change_type: str = "minor"  # "major" | "minor"
    reason_summary: str


@router.post("/business-profile/request-update")
async def request_profile_update(
    request: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Request a business profile update - creates new immutable version.
    This is the ONLY way to update a profile in the versioned system.
    """
    user_id = current_user["id"]
    
    # Get current active profile
    current_profile = await get_active_profile(user_id)
    
    # Merge current data with updates
    if current_profile:
        # Extract current flat data from domains
        current_data = {
            **current_profile["domains"]["business_identity"],
            **current_profile["domains"]["market"],
            **current_profile["domains"]["offer"],
            **current_profile["domains"]["team"],
            **current_profile["domains"]["strategy"]
        }
        # Remove metadata fields
        current_data = {k: v for k, v in current_data.items() if k not in ['confidence_level', 'completeness_percentage', 'last_updated_at']}
    else:
        current_data = {}
    
    # Merge with updates
    updated_data = {**current_data, **request.updated_fields}
    
    # Create new version
    new_profile_id = await create_profile_version(
        user_id=user_id,
        profile_data=updated_data,
        change_type=request.change_type,
        reason=request.reason_summary,
        initiated_by=user_id
    )
    
    return {
        "success": True,
        "new_profile_id": new_profile_id,
        "message": "Profile updated successfully. New version created."
    }


class BusinessProfileBuildRequest(BaseModel):
    business_name: Optional[str] = None
    abn: Optional[str] = None
    website_url: Optional[str] = None


class BusinessProfileBuildResponse(BaseModel):
    patch: Dict[str, Any]
    missing_fields: List[str]
    sources: Dict[str, Any]


@router.post("/business-profile/autofill", response_model=BusinessProfileAutofillResponse)
async def business_profile_autofill(req: BusinessProfileAutofillRequest, current_user: dict = Depends(get_current_user)):
    """Autofill business profile from uploaded docs + website URL + existing profile."""

    files_text = ""
    used_files = []
    if req.data_file_ids:
        files_result = get_sb().table("data_files").select(
            "id,filename,extracted_text,category"
        ).eq("user_id", current_user["id"]).in_("id", req.data_file_ids).execute()
        files = files_result.data if files_result.data else []
        for f in files:
            used_files.append({"id": f.get("id"), "filename": f.get("filename"), "category": f.get("category")})
            if f.get("extracted_text"):
                files_text += f"\n\n--- FILE: {f.get('filename')} ---\n{f.get('extracted_text')[:6000]}"

    website_text = ""
    if req.website_url:
        website_text = await fetch_website_text(req.website_url)
        website_text = website_text[:8000]

    existing_profile = await get_business_profile_supabase(get_sb(), current_user["id"])

    # Try DB prompt first, fall back to inline
    db_autofill = await get_prompt("profile_autofill_v1")
    if db_autofill:
        prompt = db_autofill
    else:
        prompt = f"""You are a business analyst helping autofill a structured business profile.
Return ONLY a valid JSON object with keys matching the profile schema.
Do not include markdown or commentary.

Profile schema keys (common):
- business_name (string)
- industry (ANZSIC division letter A-S or OTHER)
- business_type (AU business type string)
- website (string)
- location (string)
- target_country (string, use Australia)
- abn (string)
- acn (string)
- retention_known (boolean)
- retention_rate_range (one of: <20%, 20-40%, 40-60%, 60-80%, >80%)

User input:
- business_name: {req.business_name}
- abn: {req.abn}
- website_url: {req.website_url}

Existing profile (may be partial):
{existing_profile}

Website extracted text (if any):
{website_text}

Uploaded documents extracted text (if any):
{files_text}

Rules:
- Only include fields you have reasonable evidence for.
- If unsure, omit the field.
- Use target_country=\"Australia\" if not specified.
- Prefer business_name from user input if provided.
"""

    session_id = f"autofill_{uuid.uuid4()}"
    ai = await get_ai_response(
        prompt,
        "general",
        session_id,
        user_id=current_user["id"],
        user_data={
            "name": current_user.get("full_name") or current_user.get("name"),
            "business_name": current_user.get("company_name") or current_user.get("business_name"),
            "industry": current_user.get("industry"),
        },
        use_advanced=True,
    )

    patch: Dict[str, Any] = {}
    try:
        import json
        patch = json.loads(ai)
    except Exception:
        patch = {}

    if req.business_name:
        patch["business_name"] = req.business_name
    if req.abn:
        patch["abn"] = req.abn
    if req.website_url and not patch.get("website"):
        patch["website"] = req.website_url

    if not patch.get("target_country"):
        patch["target_country"] = "Australia"

    missing_fields = compute_missing_profile_fields(patch)

    return {
        "patch": patch,
        "missing_fields": missing_fields,
        "sources": {
            "website_url": req.website_url,
            "used_files": used_files,
            "has_existing_profile": bool(existing_profile),
        },
    }


@router.post("/business-profile/build", response_model=BusinessProfileBuildResponse)
async def business_profile_build(req: BusinessProfileBuildRequest, current_user: dict = Depends(get_current_user)):
    """Build the business profile by searching external web + scraping top sources, plus in-app sources."""

    name = (req.business_name or "").strip() or current_user.get("business_name") or ""
    abn = (req.abn or "").strip()
    website = (req.website_url or "").strip()

    queries = []
    if name:
        queries.append(f"{name} Australia")
        queries.append(f"{name} company profile Australia")
    if abn and name:
        queries.append(f"{name} ABN {abn}")
        queries.append(f"ABN {abn} business")
    if website:
        queries.append(f"site:{website} about")
        queries.append(f"site:{website} services")

    serp_results = []
    serp_errors = []
    for q in queries[:5]:
        sr = await serper_search(q, gl="au", hl="en", num=5)
        if sr.get("error"):
            serp_errors.append(sr.get("error"))
        serp_results.extend(sr.get("results") or [])

    # Persist web sources (for "Why" citations)
    await upsert_web_sources(current_user["id"], serp_results)

    seen = set()
    top_urls = []
    for r in serp_results:
        link = (r.get("link") or "").strip()
        if not link:
            continue
        if link in seen:
            continue
        seen.add(link)
        top_urls.append(link)
        if len(top_urls) >= 6:
            break

    scraped = []
    for u in top_urls:
        txt = await scrape_url_text(u)
        if txt:
            scraped.append({"url": u, "text": txt[:6000]})

    recent_chats = await get_chat_history_supabase(get_sb(), current_user["id"], limit=6)

    recent_docs = await get_user_documents_supabase(
        get_sb(),
        current_user["id"],
        limit=6
    )

    recent_files_result = get_sb().table("data_files").select(
        "filename,extracted_text,category,created_at"
    ).eq("user_id", current_user["id"]).order("created_at", desc=True).limit(6).execute()
    recent_files = recent_files_result.data if recent_files_result.data else []

    website_text = ""
    if website:
        website_text = await fetch_website_text(website)
        website_text = website_text[:8000]

    db_build = await get_prompt("profile_build_v1")
    if db_build:
        prompt = db_build
    else:
        prompt = f"""You are building a structured Australian SMB business profile for a Personalised AI Business Advisory platform.

Return ONLY valid JSON.
Do not include markdown.

Business input:
- business_name: {name}
- abn: {abn}
- website: {website}

Internal sources:
- recent_chats: {recent_chats}
- recent_documents: {[{'title': d.get('title'), 'type': d.get('document_type')} for d in recent_docs]}
- recent_files: {[{'filename': f.get('filename'), 'category': f.get('category')} for f in recent_files]}

Website extracted text:
{website_text}

External web sources (scraped snippets):
{scraped}

Fill as many of these keys as possible, only if reasonably supported by sources:
- business_name
- abn
- acn
- website
- location
- industry (ANZSIC division letter A-S or OTHER)
- business_type (AU)
- year_founded
- mission_statement
- main_products_services
- target_customer
- key_team_members
- growth_strategy
- crm_system
- accounting_system
- project_management_tool
- communication_style
- risk_tolerance
- retention_known (boolean)
- retention_rate_range (<20%, 20-40%, 40-60%, 60-80%, >80%)
- target_country (Australia)

Rules:
- Use target_country=\"Australia\" if missing.
- If you cannot infer a value, omit it.
"""

    session_id = f"build_profile_{uuid.uuid4()}"
    ai = await get_ai_response(
        prompt,
        "general",
        session_id,
        user_id=current_user["id"],
        user_data={
            "name": current_user.get("name"),
            "business_name": name,
            "industry": current_user.get("industry"),
        },
        use_advanced=True,
    )

    patch: Dict[str, Any] = {}
    try:
        import json
        patch = json.loads(ai)
    except Exception:
        patch = {}

    if name:
        patch["business_name"] = name
    if abn:
        patch["abn"] = abn
    if website:
        patch["website"] = website

    if not patch.get("target_country"):
        patch["target_country"] = "Australia"

    missing_fields = compute_missing_profile_fields(patch)

    return {
        "patch": patch,
        "missing_fields": missing_fields,
        "sources": {
            "queries": queries[:5],
            "serp_count": len(serp_results),
            "serp_error": serp_errors[0] if serp_errors else None,
            "scraped_urls": top_urls,
        },
    }

@router.put("/business-profile")
async def update_business_profile(profile: BusinessProfileUpdate, current_user: dict = Depends(get_current_user)):
    """
    Update user's business profile - creates new immutable version.
    This maintains backward compatibility while using versioned system.
    """
    now = datetime.now(timezone.utc).isoformat()
    user_id = current_user["id"]
    
    profile_data = {k: v for k, v in profile.model_dump().items() if v is not None}

    # FIELD NORMALIZATION: map model fields to actual DB column names
    if "products_services" in profile_data:
        profile_data["main_products_services"] = profile_data.pop("products_services")
    if "annual_revenue" in profile_data:
        profile_data["annual_revenue_range"] = profile_data.pop("annual_revenue")
    if "acn" in profile_data:
        profile_data.pop("acn")  # column doesn't exist in DB
    if "retention_known" in profile_data:
        profile_data.pop("retention_known")  # not a DB column
    if "retention_rate_range" in profile_data:
        profile_data.pop("retention_rate_range")  # not a DB column

    # Compute retention score (AU baselines) if inputs are present
    computed_rag = compute_retention_rag(
        profile_data.get("industry"),
        profile_data.get("retention_known"),
        profile_data.get("retention_rate_range"),
    )
    if computed_rag:
        profile_data["retention_rag"] = computed_rag

    profile_data["user_id"] = user_id
    profile_data["updated_at"] = now
    
    # Update user's basic info
    user_updates = {}
    # Update user info in Supabase (MongoDB removed - FIX APPLIED)
    user_updates = {}
    if profile.business_name:
        user_updates["company_name"] = profile.business_name
    if profile.industry:
        user_updates["industry"] = profile.industry
    
    if user_updates:
        try:
            get_sb().table("users").update(user_updates).eq("id", user_id).execute()
            logger.info(f"✅ User profile updated in Supabase for {user_id}")
        except Exception as e:
            logger.error(f"Failed to update Supabase user: {e}")
            # Non-blocking - continue with business profile update
    
    # Update business profile in Supabase
    await update_business_profile_supabase(get_sb(), user_id, profile_data)
    
    # Create new versioned profile (non-blocking — schema may differ)
    try:
        await create_profile_version(
            user_id=user_id,
            profile_data=profile_data,
            change_type="minor",
            reason="Profile update via UI",
            initiated_by=user_id
        )
    except Exception as ver_err:
        logger.warning(f"[business-profile] Versioning failed (non-blocking): {ver_err}")
    
    return await get_business_profile(current_user)


# ═══ DATA CENTER — Extracted to routes/data_center.py ═══

# ==================== RETENTION BENCHMARKS (AU) ====================

# Extracted to core/scoring.py — import for backward compatibility
from core.scoring import (
    ANZSIC_DIVISION_BENCHMARKS_AU, RETENTION_RANGE_MIDPOINTS,
    compute_retention_rag, calculate_business_score
)


# ==================== SUBSCRIPTIONS & OAC ====================

class SubscriptionUpdate(BaseModel):
    subscription_tier: str

# Persist web sources discovered during profile build (for citations)
async def upsert_web_sources(user_id: str, serp_results: List[Dict[str, Any]]):
    if not serp_results:
        return
    now = datetime.now(timezone.utc).isoformat()
    for r in serp_results[:25]:
        url = (r.get('link') or '').strip()
        if not url:
            continue
        doc = {
            'id': str(uuid.uuid4()),
            'user_id': user_id,
            'source_type': 'web',
            'title': r.get('title'),
            'url': url,
            'snippet': r.get('snippet'),
            'created_at': now,
            'updated_at': now,
        }
        await update_web_source_supabase(get_sb(), 
            {'user_id': user_id, 'url': url},
            {'$set': doc},
            upsert=True
        )

    subscription_tier: str


def month_key(dt: datetime) -> str:
    return dt.strftime("%Y-%m")


def get_month_start(dt: datetime) -> datetime:
    return datetime(dt.year, dt.month, 1, tzinfo=timezone.utc)


def add_months(dt: datetime, months: int) -> datetime:
    year = dt.year + ((dt.month - 1 + months) // 12)
    month = ((dt.month - 1 + months) % 12) + 1
    day = min(dt.day, 28)
    return datetime(year, month, day, tzinfo=timezone.utc)


def oac_monthly_limit_for_tier(tier: str) -> int:
    t = (tier or "").lower()
    if t == "free":
        return 5
    if t == "starter":
        return 20
    if t == "professional":
        return 60
    if t == "enterprise":
        return 150
    return 5


def prorated_allowance(limit: int, started_at: datetime, now: datetime) -> int:
    # Prorate for the remainder of the current month
    month_start = get_month_start(now)
    next_month = add_months(month_start, 1)
    days_in_month = (next_month - month_start).days
    remaining_days = max((next_month.date() - now.date()).days, 0)
    # Include today as usable day
    remaining_days = min(days_in_month, remaining_days + 1)
    allowance = int((limit * remaining_days) / days_in_month)
    return max(1, allowance) if limit > 0 else 0


def parse_recommendations(text: str, max_items: int = 5) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    current: Dict[str, Any] = {}
    actions: List[str] = []

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue

        if line.lower().startswith("recommendation") or line.startswith("##"):
            continue

        # Recognize common patterns:
        # - Title lines like "1. ..." or "**1. ...**"
        # - Reason lines like "Reason: ..." or "- action"
        normalized = line.strip('*').strip()

        if normalized.lower().startswith("reason:"):
            reason_text = normalized.split(":", 1)[1].strip()
            if current and reason_text and "reason" not in current:
                current["reason"] = reason_text
            continue

        if normalized.startswith("-") or normalized.startswith("•"):
            a = normalized.lstrip("-• ").strip()
            if a:
                actions.append(a)
            continue

        # numbered item
        if normalized and normalized[0].isdigit() and "." in normalized[:4]:
            # flush previous
            if current:
                current["actions"] = actions[:]
                items.append(current)
                current = {}
                actions = []
            title = normalized.split(".", 1)[1].strip().strip('*').strip()
            current = {"title": title}
            continue

        # fallback: treat as title if none
        if not current:
            current = {"title": normalized}
        else:
            # treat as reason
            if "reason" not in current:
                current["reason"] = normalized

    if current:
        current["actions"] = actions[:]
        items.append(current)

    cleaned: List[Dict[str, Any]] = []
    for it in items:
        title = (it.get("title") or "").strip()
        if not title:
            continue
        cleaned.append({
            "title": title,
            "reason": it.get("reason"),
            "actions": (it.get("actions") or [])[:5]
        })

    # If the model didn't number items, take the first max_items anyway
    return cleaned[:max_items]



# OAC response parsing with "Why" + citations

def parse_citations_block(text: str) -> List[Dict[str, Any]]:
    citations = []
    for raw in (text or "").splitlines():
        line = raw.strip().lstrip('-').strip()
        if not line:
            continue
        # Expect formats like:
        # - [web] Title — https://...
        # - [document] "Q2 Strategy" (doc_id=...)
        source_type = None
        if line.startswith('[') and ']' in line:
            source_type = line[1:line.index(']')].strip().lower()
            rest = line[line.index(']') + 1:].strip()
        else:
            rest = line

        url = None
        if 'http://' in rest or 'https://' in rest:
            # naive url split
            parts = rest.split('http')
            url = 'http' + parts[-1].strip()
            title = rest.replace(url, '').strip(' -–—')
        else:
            title = rest

        citations.append({
            'source_type': source_type or 'unknown',
            'title': title or None,
            'url': url,
        })
    return citations[:6]


# ==================== ADVISOR BRAIN CORE ====================
# Unified system for evidence-based, personalized AI advice across all features

async def build_advisor_context(user_id: str) -> dict:
    """
    Build comprehensive context for Advisor Brain.
    Includes resolved facts from the Global Fact Authority.
    """
    from fact_resolution import resolve_facts, build_known_facts_prompt
    
    user = await get_user_by_id(user_id) # Supabase
    profile = await get_business_profile_supabase(get_sb(), user_id)
    onboarding = await get_onboarding_supabase(get_sb(), user_id)
    
    # Resolve all known facts
    facts = await resolve_facts(get_sb(), user_id)
    facts_prompt = build_known_facts_prompt(facts)
    
    # Recent activity for context
    recent_chats = await get_chat_history_supabase(get_sb(), user_id, limit=5)

    recent_docs_result = get_sb().table("data_files").select(
        "filename,category,description,extracted_text,created_at"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()
    recent_docs = recent_docs_result.data if recent_docs_result.data else []
    
    web_sources = await get_web_sources_supabase(get_sb(), user_id)
    sops = await get_sops_supabase(get_sb(), user_id)
    outlook_emails = await get_user_emails_supabase(get_sb(), user_id, limit=10)
    email_intel = await get_email_intelligence_supabase(get_sb(), user_id)
    calendar_intel = await get_calendar_intelligence_supabase(get_sb(), user_id)
    calendar_events = await get_user_calendar_events_supabase(get_sb(), user_id)
    email_priority = await get_priority_analysis_supabase(get_sb(), user_id)
    
    return {
        "user": user,
        "profile": profile or {},
        "onboarding": onboarding or {},
        "recent_chats": recent_chats,
        "recent_docs": recent_docs,
        "web_sources": web_sources,
        "sops": sops,
        "outlook_emails": outlook_emails,
        "email_intelligence": email_intel or {},
        "calendar_intelligence": calendar_intel or {},
        "calendar_events": calendar_events,
        "email_priority": email_priority or {},
        "known_facts_prompt": facts_prompt,
    }


def format_email_intelligence(email_intel: dict, recent_emails: list) -> str:
    """Format email intelligence for AI context"""
    if not email_intel and not recent_emails:
        return "Outlook not connected yet - suggest connecting to analyze client communications"
    
    intel_text = ""
    
    if email_intel:
        total_analyzed = email_intel.get("total_emails_analyzed", 0)
        top_clients = email_intel.get("top_clients", [])[:5]
        
        intel_text += f"Analyzed {total_analyzed} emails over 36 months\n"
        intel_text += f"Unique contacts: {email_intel.get('unique_contacts', 0)}\n"
        
        if top_clients:
            intel_text += "\nTop client relationships (by email frequency):\n"
            for client in top_clients:
                intel_text += f"- {client.get('email')} ({client.get('email_count')} emails, {client.get('relationship_strength')} relationship)\n"
    
    if recent_emails:
        intel_text += f"\nRecent email activity (last {len(recent_emails)} emails):\n"
        for email in recent_emails[:5]:
            from_name = email.get('from_name', email.get('from_address', 'Unknown'))
            subject = email.get('subject', 'No subject')
            intel_text += f"- From {from_name}: \"{subject[:50]}...\"\n"
    
    return intel_text if intel_text else "No email data available yet"


def format_calendar_intelligence(calendar_intel: dict, calendar_events: list) -> str:
    """Format calendar intelligence for AI context"""
    if not calendar_intel and not calendar_events:
        return "Calendar not synced yet - suggest syncing to understand their schedule and time management"
    
    cal_text = ""
    
    if calendar_intel:
        meeting_load = calendar_intel.get("meeting_load", "unknown")
        upcoming = calendar_intel.get("upcoming_meetings", 0)
        top_collaborators = calendar_intel.get("top_collaborators", [])[:5]
        
        cal_text += f"Meeting load: {meeting_load} ({upcoming} meetings in next 2 weeks)\n"
        
        if top_collaborators:
            cal_text += "Frequent meeting partners:\n"
            for collab in top_collaborators:
                cal_text += f"- {collab.get('name')} ({collab.get('meetings')} meetings)\n"
    
    if calendar_events:
        cal_text += f"\nUpcoming schedule ({len(calendar_events)} events):\n"
        for event in calendar_events[:5]:
            subject = event.get('subject', 'Untitled')
            start = event.get('start', '')[:10] if event.get('start') else 'TBD'
            attendees = ', '.join(event.get('attendees', [])[:3])
            cal_text += f"- {start}: {subject}"
            if attendees:
                cal_text += f" (with {attendees})"
            cal_text += "\n"
    
    return cal_text if cal_text else "No calendar data available yet"


def format_email_priority(email_priority: dict) -> str:
    """Format email priority insights for AI context"""
    if not email_priority or "analysis" not in email_priority:
        return "Email priority analysis not run yet - suggest running to help prioritize inbox"
    
    analysis = email_priority.get("analysis", {})
    priority_text = ""
    
    high = analysis.get("high_priority", [])
    if high:
        priority_text += f"HIGH PRIORITY EMAILS ({len(high)}):\n"
        for item in high[:3]:
            priority_text += f"- From: {item.get('from', 'Unknown')} | Subject: {item.get('subject', 'No subject')[:40]} | Action: {item.get('suggested_action', '')[:50]}\n"
    
    insights = analysis.get("strategic_insights", "")
    if insights:
        priority_text += f"\nStrategic insight: {insights[:200]}\n"
    
    return priority_text if priority_text else "No email priority data available"


async def format_advisor_brain_prompt(
    task_description: str,
    context: dict,
    output_format: str = "recommendations",
    communication_style: str = None
) -> str:
    """
    Create AI mentor prompts using resolved facts from Global Fact Authority.
    Never instructs AI to re-ask known facts.
    """
    profile = context.get("profile", {})
    user = context.get("user", {})
    onboarding = context.get("onboarding", {})
    recent_chats = context.get("recent_chats", [])
    known_facts_prompt = context.get("known_facts_prompt", "")
    
    if not communication_style:
        communication_style = profile.get("advice_style", "conversational")
    
    biz_name = profile.get("business_name") or user.get("business_name") or "your business"
    industry = profile.get("industry") or user.get("industry") or "your industry"
    stage = profile.get("business_stage") or onboarding.get("business_stage", "unknown")
    
    # Helper: return value or "Not yet known" (passive — NOT an instruction to ask)
    def v(val, fallback_key=None):
        if val:
            return val
        if fallback_key and profile.get(fallback_key):
            return profile[fallback_key]
        return "Not yet known"
    
    detailed_profile = f"""
YOUR CLIENT: {biz_name.upper()}

BUSINESS FUNDAMENTALS:
- Name: {biz_name}
- Industry: {industry}
- Stage: {stage}
- Years Operating: {v(profile.get('years_operating'))}
- Team Size: {v(profile.get('team_size') or profile.get('employee_count'))}
- Revenue: {v(profile.get('revenue_range') or profile.get('annual_revenue_range'))}
- Customers: {v(profile.get('customer_count'))}
- Location: {v(profile.get('location'))}

GOALS & CHALLENGES:
- Short-term Goals: {v(profile.get('short_term_goals'))}
- Long-term Goals: {v(profile.get('long_term_goals'))}
- Main Challenges: {v(profile.get('main_challenges'), 'growth_challenge')}

BUSINESS MODEL:
- Model: {v(profile.get('business_model'))}
- Products/Services: {v(profile.get('products_services'), 'main_products_services')}
- Unique Value: {v(profile.get('unique_value_proposition'))}
- Pricing: {v(profile.get('pricing_model'))}

STRATEGY:
- Mission: {v(profile.get('mission_statement'))}
- Vision: {v(profile.get('vision_statement'))}
- Growth Strategy: {v(profile.get('growth_strategy'))}

TOOLS: {', '.join(profile.get('current_tools', [])) if profile.get('current_tools') else 'Not yet known'}
PREFERENCES: Style={communication_style}, Time={v(profile.get('time_availability'))}

PREVIOUS CONVERSATIONS:
{chr(10).join([f"- User: '{chat.get('message', '')[:80]}...' | Response: '{chat.get('response', '')[:80]}...'" for chat in recent_chats[:3]]) if recent_chats else 'First interaction'}

UPLOADED DOCUMENTS:
{chr(10).join([f"- {doc.get('filename')} ({doc.get('category')})" for doc in context.get('recent_docs', [])[:5]]) if context.get('recent_docs') else 'None'}

EMAIL INTELLIGENCE:
{format_email_intelligence(context.get('email_intelligence', {}), context.get('outlook_emails', []))}

CALENDAR INTELLIGENCE:
{format_calendar_intelligence(context.get('calendar_intelligence', {}), context.get('calendar_events', []))}

EMAIL PRIORITY:
{format_email_priority(context.get('email_priority', {}))}
"""
    
    # Inject known facts from Global Fact Authority at the top
    fact_authority_block = ""
    if known_facts_prompt:
        fact_authority_block = f"""
GLOBAL FACT AUTHORITY (ABSOLUTE — DO NOT RE-ASK THESE):
{known_facts_prompt}

RULE: If a fact appears above, you MUST use it directly. Do NOT ask the user to confirm or repeat it.
Only ask about topics marked 'Not yet known' that are relevant to the current task.
"""
    
    style_examples = {
        "concise": "Quick, actionable bullet points with specific references",
        "detailed": "Thorough explanation with reasoning and context",
        "conversational": "Natural tone, like chatting with a business partner",
        "data-driven": "Numbers-first approach with metrics and benchmarks"
    }
    style_guide = style_examples.get(communication_style, style_examples["conversational"])
    
    # Try DB prompt, fall back to inline
    db_mentor = await get_prompt("elite_mentor_v1")
    if db_mentor:
        base_prompt = db_mentor.replace("{biz_name}", biz_name).replace("{fact_authority_block}", fact_authority_block).replace("{detailed_profile}", detailed_profile).replace("{style_guide}", style_guide).replace("{task_description}", task_description)
    else:
        base_prompt = f"""You are an ELITE AI Business Mentor for {biz_name}.

{fact_authority_block}
{detailed_profile}

RULES:
1. Use "{biz_name}" not "your business" — make it personal
2. Reference specific facts from the profile above
3. If a field says "Not yet known" and is relevant, you may ask ONCE
4. Never re-ask a fact that is already known above
5. No generic advice — every point must reference their specific situation
6. Communication style: {style_guide}

TASK: {task_description}

OUTPUT FORMAT:
Numbered items. Each must reference specific business details.
Each item: Title, Reason (cite data), Confidence (high/medium/low), Actions, Questions (only if gaps exist).
"""
    
    return base_prompt


def parse_oac_items_with_why(text: str, max_items: int = 5) -> List[Dict[str, Any]]:
    """Parse AI response with Why + Citations pattern"""
    items: List[Dict[str, Any]] = []
    current: Dict[str, Any] = {}
    actions: List[str] = []
    in_citations = False
    citations_lines: List[str] = []

    def flush():
        nonlocal current, actions, in_citations, citations_lines
        if not current:
            return
        current['actions'] = actions[:]
        if citations_lines:
            current['citations'] = parse_citations_block('\n'.join(citations_lines))
        items.append(current)
        current = {}
        actions = []
        in_citations = False
        citations_lines = []

    for raw in (text or '').splitlines():
        line = raw.strip()
        if not line:
            continue

        normalized = line.strip('*').strip()

        if normalized.lower().startswith('citations:'):
            in_citations = True
            continue

        if in_citations:
            if normalized[0].isdigit() and '.' in normalized[:4]:
                # next item
                flush()
            else:
                citations_lines.append(normalized)
                continue

        if normalized[0].isdigit() and '.' in normalized[:4]:
            flush()
            title = normalized.split('.', 1)[1].strip()
            current = {'title': title, 'citations': []}
            continue

        if normalized.lower().startswith('why:'):
            if current:
                current['why'] = normalized.split(':', 1)[1].strip()
            continue

        if normalized.lower().startswith('confidence:'):
            if current:
                current['confidence'] = normalized.split(':', 1)[1].strip().lower()
            continue

        if normalized.lower().startswith('reason:'):
            if current and 'reason' not in current:
                current['reason'] = normalized.split(':', 1)[1].strip()
            continue

        if normalized.startswith('-') or normalized.startswith('•'):
            a = normalized.lstrip('-•').strip()
            if a:
                actions.append(a)
            continue

        # fallback reason
        if current and 'reason' not in current:
            current['reason'] = normalized

    flush()

    cleaned = []
    for it in items:
        if not it.get('title'):
            continue
        cleaned.append({
            'title': it.get('title'),
            'reason': it.get('reason'),
            'actions': (it.get('actions') or [])[:6],
            'why': it.get('why'),
            'confidence': it.get('confidence'),
            'citations': (it.get('citations') or [])[:6],
        })
    return cleaned[:max_items]


def _build_oac_fallback_items(
    profile: Optional[Dict[str, Any]],
    recent_docs: List[Dict[str, Any]],
    recent_files: List[Dict[str, Any]],
    evidence_web: List[Dict[str, Any]],
    recent_chats: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    business_name = (profile or {}).get("business_name") or "the business"
    target_market = (profile or {}).get("target_market") or "core customers"
    challenges = (profile or {}).get("main_challenges") or "operational drift"

    def citation_block(*items: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        citations: List[Dict[str, Any]] = []
        for item in items:
            if not item:
                continue
            if item.get("url"):
                citations.append({
                    "source_type": "web",
                    "title": item.get("title") or item.get("url"),
                    "url": item.get("url"),
                    "snippet": item.get("snippet"),
                })
            elif item.get("title"):
                citations.append({
                    "source_type": "document",
                    "title": item.get("title"),
                })
            elif item.get("filename"):
                citations.append({
                    "source_type": "data_file",
                    "title": item.get("filename"),
                })
        return citations[:3]

    latest_doc = recent_docs[0] if recent_docs else None
    latest_file = recent_files[0] if recent_files else None
    latest_web = evidence_web[0] if evidence_web else None
    latest_chat = recent_chats[0] if recent_chats else None

    return [
        {
            "title": "Turn current priorities into one owned operating cadence",
            "reason": f"{business_name} is using BIQc for strategic guidance, but recurring priorities need a named owner and review rhythm to convert insight into execution.",
            "why": f"Without a fixed weekly cadence, {business_name} risks letting urgent recommendations disperse across the team. Anchor one owner, one checkpoint, and one deadline around the current biggest challenge: {challenges}.",
            "confidence": "medium",
            "actions": [
                "Nominate one operations owner for this week’s top recommendation.",
                "Set a 20-minute operating review with a clear agenda and due dates.",
                "Track completion status in BIQc and close one execution gap before the next cycle.",
            ],
            "citations": citation_block(latest_chat, latest_doc, latest_web),
        },
        {
            "title": "Strengthen Business DNA where evidence is still thin",
            "reason": f"The platform will produce sharper recommendations for {business_name} when core profile fields and supporting evidence stay current.",
            "why": f"When target market, value proposition, and current operating constraints are stale, recommendations get broader than they should be. Tightening these fields improves relevance for {target_market} and reduces ambiguity in future advice.",
            "confidence": "medium",
            "actions": [
                "Review Business DNA for outdated target market, offer, and challenge statements.",
                "Upload one current proposal, SOP, or strategy document to deepen evidence coverage.",
                "Re-run one analysis after the update and compare specificity.",
            ],
            "citations": citation_block(latest_doc, latest_file, latest_web),
        },
        {
            "title": "Convert recent documents into executable operating standards",
            "reason": "Recent documents and uploads are a strong signal that procedures can be turned into clearer operating playbooks.",
            "why": "Teams lose momentum when guidance exists but is not translated into who-does-what-next. Converting the latest material into explicit execution steps reduces rework and keeps delivery aligned.",
            "confidence": "medium" if (latest_doc or latest_file) else "low",
            "actions": [
                "Identify the most recent document with operational relevance.",
                "Extract 3-5 non-negotiable steps and assign accountable roles.",
                "Use SOP Generator to convert the source material into a repeatable checklist.",
            ],
            "citations": citation_block(latest_doc, latest_file),
        },
        {
            "title": "Audit customer-facing response speed against current strategy",
            "reason": f"If {business_name} is focused on growth, response quality and turnaround time should reinforce that strategy every week.",
            "why": "Growth intent breaks down when follow-up speed, proposal handling, or customer communication is inconsistent. A lightweight response audit will show where operational friction is eroding commercial momentum.",
            "confidence": "medium",
            "actions": [
                "Review the last 10 customer-facing interactions for response gaps.",
                "Flag one repeated delay pattern and define the new response standard.",
                "Escalate any high-value account with silence risk into a same-week action list.",
            ],
            "citations": citation_block(latest_chat, latest_web),
        },
        {
            "title": "Use one weekly executive checkpoint to prevent drift",
            "reason": "BIQc is surfacing strategic priorities, but execution quality improves when the owner sees one compact operating checkpoint every week.",
            "why": "The fastest way to lose value from a cognition platform is to leave recommendations unclosed. A single executive checkpoint keeps insight, ownership, and consequences connected before drift compounds.",
            "confidence": "high",
            "actions": [
                "Review open recommendations every Friday against completed actions.",
                "Archive work that is done and restate any carry-over item in one sentence.",
                "Escalate unresolved blockers into Board Room or War Room for deeper diagnosis.",
            ],
            "citations": citation_block(latest_chat, latest_doc, latest_web),
        },
    ]


def parse_advisor_brain_response(text: str) -> List[Dict[str, Any]]:
    """
    Parse AI response into structured format with Why? + Citations.
    Reusable across all Advisor Brain features.
    """
    return parse_oac_items_with_why(text, max_items=10)  # Reuse existing parser


# ==================== OAC HELPERS ====================

def tier_from_user(user: dict) -> str:
    return (user.get("subscription_tier") or "free").lower()


@router.put("/admin/users/{user_id}/subscription")
async def admin_set_subscription(user_id: str, update: SubscriptionUpdate, admin: dict = Depends(get_super_admin)):
    tier = update.subscription_tier.lower().strip()
    if tier == 'growth':
        tier = 'enterprise'  # normalise legacy alias
    if tier not in {"free", "starter", "professional", "enterprise"}:
        raise HTTPException(status_code=400, detail="Invalid subscription tier")

    now = datetime.now(timezone.utc)
    
    # Update Supabase users table (MongoDB removed - FIX APPLIED)
    try:
        get_sb().table("users").update({
            "subscription_tier": tier,
            "subscription_started_at": now.isoformat(),
            "updated_at": now.isoformat()
        }).eq("id", user_id).execute()
        
        logger.info(f"✅ Subscription updated in Supabase for {user_id}: {tier}")
    except Exception as e:
        logger.error(f"Failed to update subscription in Supabase: {e}")
        raise HTTPException(status_code=500, detail="Failed to update subscription")

    user = await get_user_by_id(user_id) # Supabase
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/oac/recommendations")
async def get_oac_recommendations(current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    mk = month_key(now)
    user_id = current_user["id"]

    # Load user + profile
    user = await get_user_by_id(user_id) # Supabase
    profile = await get_business_profile_supabase(get_sb(), user_id)

    tier = tier_from_user(user or {})
    base_limit = oac_monthly_limit_for_tier(tier)

    # prorate if started this month and not free
    limit = base_limit
    started_at_iso = (user or {}).get("subscription_started_at")
    if tier != "free" and started_at_iso:
        try:
            started_at = datetime.fromisoformat(started_at_iso)
            if month_key(started_at) == mk:
                limit = prorated_allowance(base_limit, started_at, now)
        except Exception:
            pass

    usage = await get_oac_usage_supabase(get_sb(), user_id, mk)
    used = int((usage or {}).get("used", 0))

    if used >= limit:
        return {
            "locked": True,
            "usage": {"used": used, "limit": limit, "tier": tier, "month": mk}
        }

    # cache per day
    day_key = now.strftime("%Y-%m-%d")
    cached = await get_oac_recommendations_supabase(get_sb(), user_id, day_key)
    if cached:
        return {
            "locked": False,
            "meta": {"date": day_key, "cached": True},
            "items": cached.get("items", []),
            "usage": {"used": used, "limit": limit, "tier": tier, "month": mk}
        }

    # Build context snippets
    recent_chats = await get_chat_history_supabase(get_sb(), user_id, limit=8)

    recent_docs = await get_user_documents_supabase(
        get_sb(),
        user_id,
        limit=8
    )

    recent_files_result = get_sb().table("data_files").select(
        "filename,category,description,created_at"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(8).execute()
    recent_files = recent_files_result.data if recent_files_result.data else []

    # Prompt: strict, non-generic, actionable
    biz_name = (user or {}).get("business_name") or (profile or {}).get("business_name") or "this business"
    industry = (profile or {}).get("industry") or (user or {}).get("industry")

    # Build a compact evidence list for citations
    evidence_web = await get_web_sources_supabase(get_sb(), user_id)

    # Try DB prompt, fall back to inline
    db_oac = await get_prompt("oac_recommendations_v1")
    if db_oac:
        prompt = db_oac
    else:
        prompt = f"""You are the Ops Advisory Centre (OAC) for The Strategy Squad.
Your job: produce deeply customised operational recommendations that are SPECIFIC to this business and NOT generic.

Business name: {biz_name}
Industry (ANZSIC division): {industry}
Target country: {(profile or {}).get('target_country') or 'Australia'}
Business type: {(profile or {}).get('business_type')}
ABN/ACN present: {bool((profile or {}).get('abn')) or bool((profile or {}).get('acn'))}
Customer retention known: {(profile or {}).get('retention_known')}
Customer retention range: {(profile or {}).get('retention_rate_range')}
Retention score: {(profile or {}).get('retention_rag')}

Recent AI chats (latest first):
{recent_chats}

Recent documents created (latest first):
{recent_docs}

Recent uploaded files (latest first):
{recent_files}

Recent web sources (from Build Business Profile):
{evidence_web}

CRITICAL OUTPUT RULES:
- Output ONLY 5 items. No intro, no closing text.
- Exactly 5 items, numbered 1. to 5.
- If evidence is missing for a claim, set Confidence: low and ask 1 clarifying question in the Why line.

FORMAT (repeat 5x):
1. <Short title>
Reason: <One line referencing the business context above>
Why: <2–3 lines: why this applies to THIS business; if missing info, ask 1 question>
Confidence: high|medium|low
- <Action>
- <Action>
- <Action>
Citations:
- [web] <title> — <url>
- [data_file] <filename>
- [document] <title>
"""

    session_id = f"oac_{uuid.uuid4()}"
    try:
        ai_text = await get_ai_response(prompt, "general", session_id, user_id=user_id, user_data={
            "name": (user or {}).get("name"),
            "business_name": biz_name,
            "industry": industry,
        }, use_advanced=True)
        items = parse_oac_items_with_why(ai_text, max_items=5)
    except Exception as ai_err:
        logger.warning(f"[oac/recommendations] AI generation unavailable, using deterministic fallback: {ai_err}")
        items = _build_oac_fallback_items(profile, recent_docs, recent_files, evidence_web, recent_chats)

    if not items:
        items = _build_oac_fallback_items(profile, recent_docs, recent_files, evidence_web, recent_chats)

    # persist cache + increment usage by 1 (daily batch counts as 1)
    rec_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "month_key": day_key,
        "date": day_key,
        "items": items,
        "created_at": now.isoformat()
    }
    await update_oac_recommendations_supabase(get_sb(), user_id, day_key, rec_doc)

    used_after = used + 1
    await update_oac_usage_supabase(get_sb(), user_id, mk, {"used": used_after})

    return {
        "locked": False,
        "meta": {"date": day_key, "cached": False},
        "items": items,
        "usage": {"used": used_after, "limit": limit, "tier": tier, "month": mk}
    }



# ==================== VERSIONED PROFILE HELPERS ====================

def generate_version_number(current_version: Optional[str], change_type: str) -> str:
    """Generate next version number based on change type"""
    if not current_version:
        return "v1.0"
    
    # Parse current version (e.g., "v1.2" -> major=1, minor=2)
    version_str = current_version.lstrip('v')
    parts = version_str.split('.')
    major = int(parts[0]) if len(parts) > 0 else 1
    minor = int(parts[1]) if len(parts) > 1 else 0
    
    # Major changes: new business model, pivot, major strategic shift
    # Minor changes: data updates, refinements
    if change_type == "major":
        return f"v{major + 1}.0"
    else:
        return f"v{major}.{minor + 1}"


def calculate_domain_confidence(domain_data: dict, domain_type: str) -> str:
    """Calculate confidence level for a domain based on data completeness"""
    if not domain_data:
        return "low"
    
    # Count non-empty fields
    filled_fields = sum(1 for v in domain_data.values() if v not in [None, "", [], {}])
    total_fields = len(domain_data)
    
    if total_fields == 0:
        return "low"
    
    completeness = (filled_fields / total_fields) * 100
    
    if completeness >= 70:
        return "high"
    elif completeness >= 40:
        return "medium"
    else:
        return "low"


def calculate_domain_completeness(domain_data: dict) -> int:
    """Calculate completeness percentage for a domain"""
    if not domain_data:
        return 0
    
    filled_fields = sum(1 for v in domain_data.values() if v not in [None, "", [], {}, "low"])
    total_fields = len([k for k in domain_data.keys() if k not in ['confidence_level', 'completeness_percentage', 'last_updated_at']])
    
    if total_fields == 0:
        return 0
    
    return int((filled_fields / total_fields) * 100)


async def create_profile_version(
    user_id: str,
    profile_data: dict,
    change_type: str = "minor",
    reason: str = "Profile update",
    initiated_by: str = None
) -> str:
    """Create a new immutable version of the business profile"""
    
    # Get current active profile
    current_profile_result = get_sb().table("business_profiles_versioned").select("*").eq(
        "user_id", user_id
    ).eq("status", "active").order("created_at", desc=True).limit(1).execute()
    current_profile = current_profile_result.data[0] if current_profile_result.data else None
    
    # Generate new version number
    current_version = current_profile.get("version") if current_profile else None
    new_version = generate_version_number(current_version, change_type)
    
    # Archive current profile if exists
    if current_profile:
        get_sb().table("business_profiles_versioned").update({
            "status": "archived"
        }).eq("profile_id", current_profile["profile_id"]).execute()
    
    # Build domains from profile data
    now = datetime.now(timezone.utc).isoformat()
    
    business_identity = {
        "business_name": profile_data.get("business_name"),
        "legal_structure": profile_data.get("business_type"),
        "industry": profile_data.get("industry"),
        "country": profile_data.get("target_country", "Australia"),
        "year_founded": profile_data.get("year_founded"),
        "location": profile_data.get("location"),
        "website": profile_data.get("website"),
        "abn": profile_data.get("abn"),
        "acn": profile_data.get("acn"),
        "last_updated_at": now
    }
    business_identity["confidence_level"] = calculate_domain_confidence(business_identity, "business_identity")
    business_identity["completeness_percentage"] = calculate_domain_completeness(business_identity)
    
    market = {
        "target_customer_summary": profile_data.get("ideal_customer_profile"),
        "primary_problem_solved": profile_data.get("main_challenges"),
        "geography": profile_data.get("geographic_focus"),
        "business_model": profile_data.get("business_model"),
        "acquisition_channels": profile_data.get("customer_acquisition_channels"),
        "ideal_customer_profile": profile_data.get("ideal_customer_profile"),
        "target_market": profile_data.get("target_market"),
        "last_updated_at": now
    }
    market["confidence_level"] = calculate_domain_confidence(market, "market")
    market["completeness_percentage"] = calculate_domain_completeness(market)
    
    offer = {
        "products_services_summary": profile_data.get("products_services") or profile_data.get("main_products_services"),
        "pricing_model": profile_data.get("pricing_model"),
        "sales_cycle_length": profile_data.get("sales_cycle_length"),
        "value_proposition": profile_data.get("unique_value_proposition"),
        "competitive_advantage": profile_data.get("competitive_advantages"),
        "unique_value_proposition": profile_data.get("unique_value_proposition"),
        "last_updated_at": now
    }
    offer["confidence_level"] = calculate_domain_confidence(offer, "offer")
    offer["completeness_percentage"] = calculate_domain_completeness(offer)
    
    team = {
        "team_size_range": profile_data.get("team_size"),
        "key_roles_present": profile_data.get("key_team_members"),
        "capability_strengths": profile_data.get("team_strengths"),
        "capability_gaps": profile_data.get("team_gaps"),
        "founder_background": profile_data.get("founder_background"),
        "hiring_status": profile_data.get("hiring_status"),
        "last_updated_at": now
    }
    team["confidence_level"] = calculate_domain_confidence(team, "team")
    team["completeness_percentage"] = calculate_domain_completeness(team)
    
    strategy = {
        "mission": profile_data.get("mission_statement"),
        "short_term_goals": profile_data.get("short_term_goals"),
        "long_term_goals": profile_data.get("long_term_goals"),
        "current_challenges": profile_data.get("main_challenges"),
        "growth_approach": profile_data.get("growth_strategy"),
        "vision_statement": profile_data.get("vision_statement"),
        "last_updated_at": now
    }
    strategy["confidence_level"] = calculate_domain_confidence(strategy, "strategy")
    strategy["completeness_percentage"] = calculate_domain_completeness(strategy)
    
    # Calculate overall confidence summary
    confidence_summary = {
        "business_identity": business_identity["confidence_level"],
        "market": market["confidence_level"],
        "offer": offer["confidence_level"],
        "team": team["confidence_level"],
        "strategy": strategy["confidence_level"]
    }
    
    # Calculate score
    # Get onboarding data
    onboarding = await get_onboarding_supabase(get_sb(), user_id)
    
    # Build temporary profile dict for scoring
    temp_profile = {**profile_data}
    score_value = await calculate_business_score(temp_profile, onboarding, user_id)
    
    score = {
        "value": score_value,
        "calculated_at": now,
        "score_version": "v1.0",
        "explanation_summary": f"Score based on profile completeness, business depth, platform engagement, and performance indicators"
    }
    
    # Create new profile version
    profile_id = str(uuid.uuid4())
    business_id = current_profile.get("business_id") if current_profile else str(uuid.uuid4())
    
    new_profile = {
        "profile_id": profile_id,
        "business_id": business_id,
        "user_id": user_id,
        "version": new_version,
        "status": "active",
        "created_at": now,
        "created_by": initiated_by or user_id,
        "last_reviewed_at": None,
        "confidence_summary": confidence_summary,
        "score": score,
        "domains": {
            "business_identity": business_identity,
            "market": market,
            "offer": offer,
            "team": team,
            "strategy": strategy
        },
        "change_log": [
            {
                "change_id": str(uuid.uuid4()),
                "change_type": "created" if not current_profile else "updated",
                "affected_domains": ["all"] if not current_profile else list(profile_data.keys()),
                "initiated_by": initiated_by or user_id,
                "initiated_at": now,
                "reason_summary": reason
            }
        ]
    }
    
    # Add previous change log if exists
    if current_profile and current_profile.get("change_log"):
        new_profile["change_log"] = current_profile["change_log"] + new_profile["change_log"]
    
    # Insert new version
    get_sb().table("business_profiles_versioned").insert(new_profile).execute()
    
    return profile_id


async def get_active_profile(user_id: str) -> Optional[dict]:
    """Get the active (current) business profile version"""
    result = get_sb().table("business_profiles_versioned").select("*").eq(
        "user_id", user_id
    ).eq("status", "active").order("created_at", desc=True).limit(1).execute()
    return result.data[0] if result.data else None


def calculate_profile_completeness(profile: dict) -> int:
    """Calculate profile completeness percentage"""
    if not profile:
        return 0
    
    # Core fields (weighted higher)
    core_fields = [
        "business_name",
        "industry",
        "business_type",
        "target_country",
        "retention_known",
    ]
    
    # Extended fields
    extended_fields = [
        "year_founded",
        "location",
        "website",
        "abn",
        "acn",
        "retention_rate_range",
        "average_customer_value",
        "crm_system",
        "accounting_system",
        "project_management_tool",
    ]
    
    core_filled = sum(1 for f in core_fields if profile.get(f))
    extended_filled = sum(1 for f in extended_fields if profile.get(f))
    
    # Core fields worth 60%, extended worth 40%
    core_score = (core_filled / len(core_fields)) * 60
    extended_score = (extended_filled / len(extended_fields)) * 40
    
    return int(core_score + extended_score)


def calculate_profile_strength(profile: dict, onboarding: dict = None) -> int:
    """
    DEPRECATED: Use calculate_business_score instead.
    This is kept for backward compatibility only.
    """
    return calculate_business_score(profile, onboarding)


# calculate_business_score and compute_retention_rag imported from core.scoring


@router.get("/business-profile/scores")
async def get_profile_scores(current_user: dict = Depends(get_current_user)):
    """Get profile scores — reads from business_profiles (authoritative)"""
    user_id = current_user["id"]
    cache_key = f"profile_scores_{user_id}"
    cached = _get_cached(cache_key)
    if cached:
        return cached

    profile = await get_business_profile_supabase(get_sb(), user_id)
    onboarding = await get_onboarding_supabase(get_sb(), user_id)
    files_count = await count_user_data_files_supabase(get_sb(), user_id)
    
    completeness = calculate_profile_completeness(profile) if profile else 0
    business_score = await calculate_business_score(profile, onboarding, user_id, sb_client=get_sb()) if profile else 0
    
    result = {
        "completeness": completeness,
        "strength": business_score,
        "business_score": business_score,
        "has_documents": files_count > 0,
        "document_count": files_count,
        "onboarding_completed": onboarding.get("completed", False) if onboarding else False
    }
    _set_cached(cache_key, result)
    return result


# ==================== DASHBOARD STATS ====================

@router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    cache_key = f"dashboard_stats_{user_id}"
    cached = _get_cached(cache_key)
    if cached:
        return cached

    analysis_result = get_sb().table("analyses").select("id", count="exact").eq("user_id", user_id).execute()
    analysis_count = analysis_result.count if analysis_result.count is not None else 0
    document_count = await count_user_documents_supabase(get_sb(), user_id)
    chat_result = get_sb().table("chat_history").select("session_id").eq("user_id", user_id).execute()
    session_ids = {row.get("session_id") for row in (chat_result.data or []) if row.get("session_id")}
    
    recent_analyses_result = get_sb().table("analyses").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()
    recent_analyses = recent_analyses_result.data if recent_analyses_result.data else []
    
    recent_docs_result = get_sb().table("documents").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()
    recent_documents = recent_docs_result.data if recent_docs_result.data else []
    
    result = {
        "total_analyses": analysis_count,
        "total_documents": document_count,
        "total_chat_sessions": len(session_ids),
        "recent_analyses": recent_analyses,
        "recent_documents": recent_documents
    }
    _set_cached(cache_key, result)
    return result


@router.get("/dashboard/focus")
async def get_dashboard_focus(current_user: dict = Depends(get_current_user)):
    """
    Generate ONE clear business focus for the user based on available data.
    This is the AI mentor's primary output on the dashboard.
    """
    user_id = current_user["id"]
    
    # Gather available data signals
    data_signals = {
        "has_profile": False,
        "profile_completeness": 0,
        "has_outlook": False,
        "emails_synced": 0,
        "has_calendar": False,
        "upcoming_meetings": 0,
        "has_documents": False,
        "document_count": 0,
        "has_chat_history": False,
        "recent_activity": False,
        "email_priority_high": 0,
        "days_since_last_activity": 0
    }
    
    # Check business profile
    profile = await get_business_profile_supabase(get_sb(), user_id)
    if profile:
        data_signals["has_profile"] = True
        # Calculate simple completeness
        fields = ["business_name", "industry", "business_model", "target_market", "main_challenges", "short_term_goals"]
        filled = sum(1 for f in fields if profile.get(f))
        data_signals["profile_completeness"] = int((filled / len(fields)) * 100)
    
    # Check Outlook connection
    user_doc = await get_user_by_id(user_id) # Supabase
    if user_doc and user_doc.get("outlook_access_token"):
        data_signals["has_outlook"] = True
        # Count emails using Supabase
        email_result = get_sb().table("outlook_emails").select("id", count="exact").eq("user_id", user_id).execute()
        email_count = email_result.count if hasattr(email_result, 'count') else 0
        data_signals["emails_synced"] = email_count
        
        # Check high priority emails
        priority = await get_priority_analysis_supabase(get_sb(), user_id)
        if priority and priority.get("analysis"):
            high_priority = priority["analysis"].get("high_priority", [])
            data_signals["email_priority_high"] = len(high_priority)
    
    # Check calendar
    calendar_count = 0 # Migrated to outlook_calendar_events
    if calendar_count > 0:
        data_signals["has_calendar"] = True
        data_signals["upcoming_meetings"] = calendar_count
    
    # Check documents
    doc_count = await count_user_documents_supabase(get_sb(), user_id)
    if doc_count > 0:
        data_signals["has_documents"] = True
        data_signals["document_count"] = doc_count
    
    # Check recent activity
    recent_chats_result = get_sb().table("chat_history").select("created_at").eq("user_id", user_id).order("created_at", desc=True).limit(1).execute()
    recent_chats = recent_chats_result.data if recent_chats_result.data else []
    
    if recent_chats:
        data_signals["has_chat_history"] = True
        last_activity = recent_chats[0].get("created_at")
        if last_activity:
            try:
                last_date = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))
                days_diff = (datetime.now(timezone.utc) - last_date).days
                data_signals["days_since_last_activity"] = days_diff
                data_signals["recent_activity"] = days_diff < 7
            except:
                pass
    
    # Determine focus based on available signals
    focus = await generate_focus_insight(data_signals, profile, user_doc)
    
    return focus


async def generate_focus_insight(signals: dict, profile: dict, user: dict) -> dict:
    """Generate a single, calm focus insight based on available data."""
    
    # Check what data is actually available
    has_operational_data = signals["has_outlook"] or signals["has_calendar"] or signals["has_documents"]
    has_profile_data = signals["has_profile"] and signals["profile_completeness"] > 30
    
    # Priority 1: High priority emails need attention
    if signals["email_priority_high"] > 0:
        return {
            "focus": "You have emails that need attention.",
            "context": "Recent patterns suggest these may impact important relationships or decisions.",
            "type": "action",
            "confidence": "high"
        }
    
    # Priority 2: Upcoming meetings need prep
    if signals["upcoming_meetings"] > 5:
        return {
            "focus": "Your calendar is busy. Protect your thinking time.",
            "context": "With several meetings ahead, scheduling preparation blocks will help you stay effective.",
            "type": "awareness",
            "confidence": "high"
        }
    
    # Priority 3: Profile needs attention for better insights
    if signals["has_profile"] and signals["profile_completeness"] < 50:
        return {
            "focus": "Your profile could use more detail.",
            "context": "More business context means sharper, more relevant guidance from your AI team.",
            "type": "setup",
            "confidence": "high"
        }
    
    # Priority 4: No data connected yet
    if not has_operational_data and not has_profile_data:
        return {
            "focus": "You're in the early signal phase. Clarity beats optimisation right now.",
            "context": "As you connect tools and add context, your focus will become more precise.",
            "type": "onboarding",
            "confidence": "low"
        }
    
    # Priority 5: Data exists but nothing urgent
    if has_operational_data and signals["recent_activity"]:
        return {
            "focus": "Nothing requires urgent attention right now.",
            "context": "Your available data suggests stability. This is a good time to maintain discipline.",
            "type": "stability",
            "confidence": "medium"
        }
    
    # Priority 6: User hasn't been active recently
    if signals["days_since_last_activity"] > 7:
        return {
            "focus": "Consistency creates clarity.",
            "context": "A quick check-in keeps your business intelligence fresh and relevant.",
            "type": "engagement",
            "confidence": "medium"
        }
    
    # Default: Calm reassurance
    return {
        "focus": "Everything looks stable. Stay the course.",
        "context": "No significant changes detected since your last visit.",
        "type": "stability",
        "confidence": "medium"
    }


# ==================== SMART NOTIFICATIONS ====================

@router.get("/notifications/alerts")
async def get_smart_notifications(current_user: dict = Depends(get_current_user)):
    """
    AI-powered notifications that surface important business signals.
    Analyzes emails, calendar, web data to identify material impacts.
    """
    user_id = current_user["id"]
    notifications = []
    
    # Check for high priority emails (customer complaints, urgent issues)
    priority_analysis = await get_priority_analysis_supabase(get_sb(), user_id)
    
    if priority_analysis and priority_analysis.get("analysis"):
        high_priority = priority_analysis["analysis"].get("high_priority", [])
        for email in high_priority[:3]:
            notifications.append({
                "id": f"email_{email.get('email_id', 'unknown')}",
                "type": "email",
                "severity": "high",
                "title": "Important email needs attention",
                "message": f"From {email.get('from', 'Unknown')}: {email.get('subject', 'No subject')[:50]}",
                "action": email.get("suggested_action", "Review and respond"),
                "source": "Email Intelligence",
                "timestamp": email.get("received") or datetime.now(timezone.utc).isoformat()
            })
    
    # Check recent emails for complaint keywords
    recent_emails_result = get_sb().table("outlook_emails").select(
        "subject,body_preview,from_name,from_address,received_date,id"
    ).eq("user_id", user_id).order("received_date", desc=True).limit(50).execute()
    recent_emails = recent_emails_result.data if recent_emails_result.data else []
    
    complaint_keywords = ["complaint", "unhappy", "disappointed", "refund", "cancel", "frustrated", "unacceptable", "terrible", "worst", "issue", "problem", "urgent"]
    
    for email in recent_emails:
        subject = (email.get("subject") or "").lower()
        preview = (email.get("body_preview") or "").lower()
        content = subject + " " + preview
        
        for keyword in complaint_keywords:
            if keyword in content:
                notifications.append({
                    "id": f"complaint_{email.get('id', 'unknown')}",
                    "type": "complaint",
                    "severity": "high",
                    "title": "Potential customer concern detected",
                    "message": f"Email from {email.get('from_name') or email.get('from_address', 'Unknown')}: {email.get('subject', '')[:40]}",
                    "action": "Review and respond promptly",
                    "source": "Email Analysis",
                    "timestamp": email.get("received_date") or datetime.now(timezone.utc).isoformat()
                })
                break  # Only one notification per email
    
    # Check calendar for important upcoming meetings
    calendar_events = await get_user_calendar_events_supabase(get_sb(), user_id)
    
    now = datetime.now(timezone.utc)
    important_keywords = ["review", "client", "investor", "board", "presentation", "pitch", "deadline", "important", "urgent", "critical"]
    
    for event in calendar_events:
        try:
            event_start = datetime.fromisoformat(event.get("start", "").replace("Z", "+00:00"))
            hours_until = (event_start - now).total_seconds() / 3600
            
            # Check if it's within 24 hours and has important keywords
            if 0 < hours_until < 24:
                subject = (event.get("subject") or "").lower()
                is_important = any(kw in subject for kw in important_keywords) or event.get("importance") == "high"
                
                if is_important:
                    notifications.append({
                        "id": f"meeting_{event.get('id', 'unknown')}",
                        "type": "meeting",
                        "severity": "medium",
                        "title": "Important meeting coming up",
                        "message": f"{event.get('subject', 'Meeting')} in {int(hours_until)} hours",
                        "action": "Prepare materials and review agenda",
                        "source": "Calendar",
                        "timestamp": event.get("start")
                    })
        except:
            pass
    
    # Check for operational patterns in emails
    email_intel = await get_email_intelligence_supabase(get_sb(), user_id)
    if email_intel:
        # Check for declining engagement with key clients
        top_clients = email_intel.get("top_clients", [])
        for client in top_clients[:5]:
            if client.get("trend") == "declining":
                notifications.append({
                    "id": f"client_{client.get('email', 'unknown')}",
                    "type": "relationship",
                    "severity": "medium",
                    "title": "Client engagement declining",
                    "message": f"Communication with {client.get('name', client.get('email', 'key contact'))} has decreased",
                    "action": "Consider reaching out to maintain relationship",
                    "source": "Relationship Intelligence",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
    
    # Deduplicate notifications by ID AND by title (catch same-content from different sources)
    seen_ids = set()
    seen_titles = set()
    unique_notifications = []
    
    # Filter out dismissed notifications first
    try:
        dismissed = get_sb().table("dismissed_notifications").select("notification_id").eq("user_id", user_id).execute()
        dismissed_ids = {d["notification_id"] for d in (dismissed.data or [])}
    except Exception:
        dismissed_ids = set()
    
    for notif in notifications:
        nid = notif["id"]
        title = notif.get("title", "").lower().strip()
        if nid in dismissed_ids:
            continue
        if nid in seen_ids:
            continue
        if title and title in seen_titles:
            continue
        seen_ids.add(nid)
        if title:
            seen_titles.add(title)
        unique_notifications.append(notif)
    
    # Sort by severity (high first) then by timestamp
    severity_order = {"high": 0, "medium": 1, "low": 2}
    unique_notifications.sort(key=lambda x: (severity_order.get(x["severity"], 2), x.get("timestamp", "")))
    
    # Limit to top 10 notifications
    unique_notifications = unique_notifications[:10]

    if not unique_notifications:
        try:
            observation_state = get_recent_observation_events(get_sb(), user_id, limit=15)
            fallback_events = build_watchtower_events(observation_state.get("events") or [], limit=10)
            for event in fallback_events:
                unique_notifications.append({
                    "id": f"obs_{event.get('id')}",
                    "type": event.get("domain") or "signal",
                    "severity": event.get("severity") or "medium",
                    "title": event.get("title") or "Live signal detected",
                    "message": event.get("detail") or event.get("impact") or "A live business signal needs review.",
                    "action": event.get("action") or event.get("recommendation") or "Review the signal and take corrective action.",
                    "source": event.get("source") or "Live Signals",
                    "timestamp": event.get("created_at") or datetime.now(timezone.utc).isoformat()
                })
            unique_notifications = unique_notifications[:10]
        except Exception:
            pass
    
    # Calculate summary counts
    high_count = sum(1 for n in unique_notifications if n["severity"] == "high")
    medium_count = sum(1 for n in unique_notifications if n["severity"] == "medium")
    
    return {
        "notifications": unique_notifications,
        "summary": {
            "total": len(unique_notifications),
            "high": high_count,
            "medium": medium_count,
            "low": len(unique_notifications) - high_count - medium_count
        },
        "has_alerts": len(unique_notifications) > 0
    }


@router.post("/notifications/dismiss/{notification_id}")
async def dismiss_notification(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Dismiss a notification"""
    get_sb().table("dismissed_notifications").upsert({
        "user_id": current_user["id"],
        "notification_id": notification_id,
        "dismissed_at": datetime.now(timezone.utc).isoformat()
    }, on_conflict="user_id,notification_id").execute()
    return {"status": "dismissed"}


# ==================== ROOT ====================

# ==================== PUSH NOTIFICATION DEVICE REGISTRATION ====================

class DeviceRegistration(BaseModel):
    push_token: str
    platform: str = 'ios'
    device_name: str = 'Unknown'


@router.post("/notifications/register-device")
async def register_push_device(req: DeviceRegistration, current_user: dict = Depends(get_current_user)):
    """Register a mobile device for push notifications. Token stored for backend-triggered events."""
    sb = get_sb()
    try:
        sb.table("push_devices").upsert({
            "user_id": current_user["id"],
            "push_token": req.push_token,
            "platform": req.platform,
            "device_name": req.device_name,
            "registered_at": datetime.now(timezone.utc).isoformat(),
            "active": True,
        }, on_conflict="user_id,push_token").execute()
        return {"status": "registered", "platform": req.platform}
    except Exception as e:
        # Table might not exist yet — non-fatal
        return {"status": "pending", "message": "Device registration queued. Push table not yet deployed."}

