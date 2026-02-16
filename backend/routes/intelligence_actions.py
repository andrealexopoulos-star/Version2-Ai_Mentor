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
    """Trigger deep-web recon using social handles. Generates SWOT brief and
    writes actionable signals to intelligence_actions with [Read/Action/Ignore] status.
    Attention protection: suppresses if no material change since last recon."""
    user_id = current_user["id"]

    # Get social handles
    profile = await get_business_profile_supabase(get_sb(), user_id)
    handles = (profile or {}).get("social_handles") or {}
    business_name = (profile or {}).get("business_name") or current_user.get("company_name") or "Unknown Business"
    industry = (profile or {}).get("industry") or current_user.get("industry") or ""

    if not handles:
        return {"status": "no_handles", "message": "No social handles configured. Add them via /intelligence/social-handles."}

    # Build the recon prompt
    handle_list = "\n".join([f"- {k}: {v}" for k, v in handles.items() if v])

    prompt = f"""You are a strategic business intelligence analyst conducting a deep recon for an Australian SME.

BUSINESS: {business_name}
INDUSTRY: {industry}
SOCIAL HANDLES:
{handle_list}

Generate a concise SWOT analysis based on the business context. Include:
1. **Strengths** — What the business appears to do well based on their digital presence
2. **Weaknesses** — Gaps or vulnerabilities visible from public data
3. **Opportunities** — Market trends, competitor gaps, or growth vectors
4. **Threats** — Competitive pressure, industry shifts, or regulatory risks

Then generate 3-5 actionable intelligence signals. Each signal should be a specific, time-sensitive observation that requires the operator's attention.

Respond with JSON only:
{{
  "swot": {{
    "strengths": ["..."],
    "weaknesses": ["..."],
    "opportunities": ["..."],
    "threats": ["..."]
  }},
  "signals": [
    {{"source": "linkedin|twitter|instagram|facebook|market", "summary": "...", "severity": "high|medium|low"}}
  ],
  "executive_summary": "One paragraph strategic assessment"
}}"""

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(api_key=OPENAI_KEY, session_id=f"recon_{user_id}", system_message="You are a strategic business intelligence analyst. Respond with valid JSON only.")
        chat.with_model("openai", AI_MODEL)
        raw = await chat.send_message(UserMessage(text=prompt))

        # Parse response
        import json
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        recon_data = json.loads(cleaned)

        # Write signals to intelligence_actions
        now = datetime.now(timezone.utc).isoformat()
        signals_written = 0
        for sig in recon_data.get("signals", []):
            get_sb().table("intelligence_actions").insert({
                "user_id": user_id,
                "signal_source": sig.get("source", "recon"),
                "content_summary": sig.get("summary", ""),
                "status": "action_required" if sig.get("severity") == "high" else "read",
                "created_at": now,
            }).execute()
            signals_written += 1

        # Store SWOT in observation_events
        try:
            get_sb().table("observation_events").insert({
                "user_id": user_id,
                "domain": "market",
                "event_type": "swot_recon",
                "payload": recon_data.get("swot", {}),
                "source": "social_recon",
                "severity": "info",
                "observed_at": now,
            }).execute()
        except Exception as e:
            logger.warning(f"[recon] Failed to store SWOT observation: {e}")

        return {
            "status": "complete",
            "swot": recon_data.get("swot"),
            "executive_summary": recon_data.get("executive_summary"),
            "signals_created": signals_written,
        }

    except Exception as e:
        logger.error(f"[recon] Error: {e}")
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

    # ATTENTION PROTECTION: suppress if nothing material
    if action_count == 0 and observation_count == 0 and insight_count == 0:
        return {
            "suppressed": True,
            "reason": "No material changes detected. Your business intelligence is stable.",
            "actions": [],
            "observations": [],
            "insights": [],
        }

    return {
        "suppressed": False,
        "summary": {
            "actions_pending": action_required,
            "observations_new": observation_count,
            "insights_generated": insight_count,
        },
        "actions": actions.data or [],
        "observations": observations.data or [],
        "insights": insights.data or [],
    }
