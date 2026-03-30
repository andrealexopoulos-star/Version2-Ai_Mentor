"""
Intelligence Actions & Social Recon — BIQc Master Agent Directive.

Enforces:
- auth.uid() for all queries (no hardcoding)
- company_name (users) → business_name (business_profiles) mapping
- intelligence_actions table for [Read/Action/Ignore] toggles
- Attention protection: suppress if no material change
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import logging

from routes.deps import get_current_user, get_sb, OPENAI_KEY, AI_MODEL, logger
from intelligence_live_truth import get_live_integration_truth
from supabase_intelligence_helpers import get_business_profile_supabase
from auth_supabase import get_user_by_id

router = APIRouter()


# ═══ INTELLIGENCE ACTIONS (Read / Action Required / Ignore) ═══

@router.get("/intelligence/actions")
async def get_intelligence_actions(current_user: dict = Depends(get_current_user)):
    """Get all intelligence actions for the authenticated user.
    Uses auth.uid() — no hardcoded user IDs."""
    user_id = current_user["id"]
    result = get_sb().table("intelligence_actions").select("*").eq(
        "user_id", user_id
    ).order("created_at", desc=True).limit(50).execute()

    actions = result.data or []
    summary = {
        "total": len(actions),
        "unread": sum(1 for a in actions if a.get("status") == "read"),
        "action_required": sum(1 for a in actions if a.get("status") == "action_required"),
        "addressed": sum(1 for a in actions if a.get("status") == "addressed"),
        "ignored": sum(1 for a in actions if a.get("status") == "ignored"),
    }
    return {"actions": actions, "summary": summary}


class ActionStatusUpdate(BaseModel):
    status: str  # read | action_required | addressed | ignored


@router.patch("/intelligence/actions/{action_id}")
async def update_action_status(action_id: str, update: ActionStatusUpdate, current_user: dict = Depends(get_current_user)):
    """Update an intelligence action's status. Enforces ownership via user_id."""
    if update.status not in ("read", "action_required", "addressed", "ignored"):
        raise HTTPException(status_code=400, detail="Status must be: read, action_required, addressed, ignored")

    result = get_sb().table("intelligence_actions").update(
        {"status": update.status}
    ).eq("id", action_id).eq("user_id", current_user["id"]).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Action not found or not owned by user")
    return {"ok": True, "action": result.data[0]}


# ═══ BUSINESS PROFILE SEEDING (company_name → business_name) ═══

@router.post("/intelligence/seed-profile")
async def seed_business_profile(current_user: dict = Depends(get_current_user)):
    """Seed business_profiles from users table if no profile exists.
    Maps users.company_name → business_profiles.business_name.
    Uses auth.uid() — no hardcoding."""
    user_id = current_user["id"]

    profile = await get_business_profile_supabase(get_sb(), user_id)
    if profile:
        return {"status": "exists", "business_name": profile.get("business_name")}

    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    seed = {
        "user_id": user_id,
        "business_name": user.get("company_name") or user.get("full_name", ""),
        "industry": user.get("industry"),
        "target_country": "Australia",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    seed = {k: v for k, v in seed.items() if v is not None}

    from supabase_intelligence_helpers import update_business_profile_supabase
    success = await update_business_profile_supabase(get_sb(), user_id, seed)
    if success:
        logger.info(f"[seed-profile] Seeded business_profiles for {user_id}: company_name→business_name = {seed.get('business_name')}")
        return {"status": "seeded", "business_name": seed.get("business_name")}
    return {"status": "failed", "error": "RLS policy may be blocking INSERT — fix in Supabase Dashboard"}


# ═══ SOCIAL HANDLES MANAGEMENT ═══

class SocialHandlesUpdate(BaseModel):
    linkedin: Optional[str] = None
    twitter: Optional[str] = None
    instagram: Optional[str] = None
    facebook: Optional[str] = None
    youtube: Optional[str] = None
    tiktok: Optional[str] = None
    pinterest: Optional[str] = None


@router.put("/intelligence/social-handles")
async def update_social_handles(handles: SocialHandlesUpdate, current_user: dict = Depends(get_current_user)):
    """Update social handles for social recon crawling.
    Stored in business_profiles.social_handles JSONB column."""
    user_id = current_user["id"]
    profile = await get_business_profile_supabase(get_sb(), user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Business profile not found — seed it first via /intelligence/seed-profile")

    social = {k: v for k, v in handles.model_dump().items() if v is not None}
    get_sb().table("business_profiles").update(
        {"social_handles": social, "updated_at": datetime.now(timezone.utc).isoformat()}
    ).eq("user_id", user_id).execute()

    return {"ok": True, "social_handles": social}


@router.get("/intelligence/social-handles")
async def get_social_handles(current_user: dict = Depends(get_current_user)):
    """Get current social handles for the user."""
    profile = await get_business_profile_supabase(get_sb(), current_user["id"])
    if not profile:
        return {"social_handles": {}}
    return {"social_handles": profile.get("social_handles") or {}}


# ═══ SOCIAL RECON & SWOT GENERATION ═══

class ReconRequest(BaseModel):
    force: bool = False


@router.post("/intelligence/recon")
async def trigger_social_recon(req: ReconRequest = ReconRequest(), current_user: dict = Depends(get_current_user)):
    """Proxy to deep-web-recon Edge Function. All intelligence generation
    happens at the Edge — backend only forwards the request and returns results.
    Edge Function enforces: SWOT, [Read/Action/Ignore] signals, delta <2% suppression."""
    import os
    import httpx

    user_id = current_user["id"]

    # Get social handles + website from business_profiles
    profile = await get_business_profile_supabase(get_sb(), user_id)
    handles = (profile or {}).get("social_handles") or {}
    website = (profile or {}).get("website") or ""

    # Fallback: get handles from users table (company_name → business_name mapping)
    if not handles and not website:
        user = await get_user_by_id(user_id)
        if not user:
            return {"status": "no_data", "message": "No social handles or website configured."}

    # Build Edge Function payload
    payload = {
        "user_id": user_id,
        "website": website,
        "linkedin": handles.get("linkedin", ""),
        "twitter": handles.get("twitter", ""),
        "instagram": handles.get("instagram", ""),
        "facebook": handles.get("facebook", ""),
    }

    if not any([payload["website"], payload["linkedin"], payload["twitter"], payload["instagram"], payload["facebook"]]):
        return {"status": "no_handles", "message": "No social handles or website configured. Add them via /intelligence/social-handles."}

    # Call deep-web-recon Edge Function
    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{supabase_url}/functions/v1/deep-web-recon",
                json=payload,
                headers={
                    "Authorization": f"Bearer {service_key}",
                    "Content-Type": "application/json",
                },
                timeout=60.0,
            )

            if response.status_code == 200:
                result = response.json()
                logger.info(f"[recon] Edge Function returned: ok={result.get('ok')}, signals={result.get('signals_created', 0)}")
                return result
            else:
                error_text = response.text[:200]
                logger.error(f"[recon] Edge Function failed: {response.status_code} — {error_text}")
                return {"status": "error", "message": f"Edge Function returned {response.status_code}", "detail": error_text}

    except Exception as e:
        logger.error(f"[recon] Edge Function call failed: {e}")
        return {"status": "error", "message": str(e)}

@router.get("/intelligence/brief")
async def get_intelligence_brief(current_user: dict = Depends(get_current_user)):
    """Generate the daily intelligence brief.
    ATTENTION PROTECTION: Returns suppressed=true if no material changes detected.
    Uses intelligence_actions for interactive [Read/Action/Ignore] toggles."""
    user_id = current_user["id"]

    # Gather signals
    actions = get_sb().table("intelligence_actions").select("*").eq(
        "user_id", user_id
    ).neq("status", "ignored").order("created_at", desc=True).limit(20).execute()

    observations = get_sb().table("observation_events").select("*").eq(
        "user_id", user_id
    ).order("observed_at", desc=True).limit(10).execute()

    insights = get_sb().table("watchtower_insights").select("*").eq(
        "user_id", user_id
    ).order("detected_at", desc=True).limit(5).execute()

    action_count = len(actions.data or [])
    observation_count = len(observations.data or [])
    insight_count = len(insights.data or [])
    action_required = sum(1 for a in (actions.data or []) if a.get("status") == "action_required")
    live_truth = get_live_integration_truth(get_sb(), user_id)
    connector_truth = live_truth.get("connector_truth") or {}
    blocked_sources = [
        item for item in connector_truth.values()
        if item.get("truth_state") in {"stale", "error", "unverified"}
    ]

    # ATTENTION PROTECTION: suppress if nothing material
    if action_count == 0 and observation_count == 0 and insight_count == 0 and not blocked_sources:
        return {
            "suppressed": True,
            "reason": "No material changes detected. Your business intelligence is stable.",
            "actions": [],
            "observations": [],
            "insights": [],
            "truth_summary": connector_truth,
        }

    return {
        "suppressed": False,
        "truth_blocked": bool(blocked_sources),
        "summary": {
            "actions_pending": action_required,
            "observations_new": observation_count,
            "insights_generated": insight_count,
        },
        "actions": actions.data or [],
        "observations": observations.data or [],
        "insights": insights.data or [],
        "truth_summary": connector_truth,
        "blocked_sources": blocked_sources,
    }
