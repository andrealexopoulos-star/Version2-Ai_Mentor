"""Cognitive Core + Advisory Log Routes."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from routes.deps import get_current_user, get_sb, logger
from supabase_intelligence_helpers import get_business_profile_supabase

router = APIRouter()

def get_cognitive_core():
    from routes.deps import cognitive_core
    return cognitive_core


# ==================== COGNITIVE CORE ENDPOINTS ====================

@router.get("/cognitive/profile")
async def get_cognitive_profile(current_user: dict = Depends(get_current_user)):
    """Get the user's cognitive profile (for debugging/admin only)"""
    profile = await get_cognitive_core().get_profile(current_user["id"])
    # Remove internal fields
    if profile:
        profile.pop("_id", None)
    return {"profile": profile}


@router.post("/cognitive/sync-business-profile")
async def sync_business_to_cognitive(current_user: dict = Depends(get_current_user)):
    """Sync business profile data to cognitive core reality model"""
    user_id = current_user["id"]
    
    # Get business profile
    profile = await get_business_profile_supabase(get_sb(), user_id)
    
    if not profile:
        return {"status": "no_profile", "message": "No business profile found to sync"}
    
    # Map business profile fields to cognitive core reality model
    reality_update = {
        "type": "reality_update",
        "business_type": profile.get("business_type"),
        "industry": profile.get("industry"),
        "revenue_model": profile.get("business_model"),
        "team_size": profile.get("team_size"),
        "years_operating": profile.get("years_in_business")
    }
    
    # Infer maturity from years
    years = profile.get("years_in_business")
    if years:
        try:
            y = int(years)
            if y < 1:
                reality_update["business_maturity"] = "idea"
            elif y < 3:
                reality_update["business_maturity"] = "early"
            elif y < 7:
                reality_update["business_maturity"] = "growth"
            else:
                reality_update["business_maturity"] = "mature"
        except:
            pass
    
    # Infer cashflow sensitivity from revenue
    revenue = profile.get("annual_revenue", "")
    if revenue:
        rev_lower = revenue.lower()
        if "under" in rev_lower or "<50" in rev_lower or "0-" in rev_lower:
            reality_update["cashflow_sensitivity"] = "high"
        elif "50" in rev_lower or "100" in rev_lower:
            reality_update["cashflow_sensitivity"] = "medium"
        else:
            reality_update["cashflow_sensitivity"] = "low"
    
    # Update cognitive core
    await get_cognitive_core().observe(user_id, reality_update)
    
    return {"status": "synced", "fields_updated": [k for k, v in reality_update.items() if v is not None]}


@router.get("/cognitive/escalation")
async def get_escalation_state(
    topic: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the current escalation state for this user.
    
    Escalation is evidence-based:
    - Level 0 (Normal): Balanced tone, standard urgency
    - Level 1 (Elevated): Direct tone, reduced options
    - Level 2 (High): Firm tone, minimal options, critical focus
    - Level 3 (Critical): Urgent tone, survival focus, no options
    """
    topic_tags = [topic] if topic else None
    escalation = await get_cognitive_core().calculate_escalation_state(current_user["id"], topic_tags)
    
    return escalation


@router.post("/cognitive/observe")
async def record_observation(
    observation: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Record an observation for the cognitive core (for frontend integration)"""
    user_id = current_user["id"]
    
    # Validate observation type
    valid_types = ["message", "action", "decision", "avoidance", "outcome", "sentiment", "timing"]
    if observation.get("type") not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid observation type. Must be one of: {valid_types}")
    
    await get_cognitive_core().observe(user_id, observation)
    
    return {"status": "recorded"}


# ==================== ADVISORY LOG ENDPOINTS ====================

class RecommendationLog(BaseModel):
    situation: str
    recommendation: str
    reason: str
    expected_outcome: str
    topic_tags: Optional[List[str]] = None
    urgency: Optional[str] = "normal"
    confidence: Optional[str] = None  # high, medium, low - auto-calculated if not provided
    confidence_factors: Optional[List[str]] = None


class RecommendationOutcome(BaseModel):
    recommendation_id: str
    status: str  # acted, ignored, partially_acted
    actual_outcome: Optional[str] = None
    notes: Optional[str] = None


@router.get("/advisory/confidence")
async def get_current_confidence(
    topic: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the current confidence level for giving advice to this user.
    Confidence is based on data coverage across all cognitive layers.
    """
    topic_tags = [topic] if topic else None
    confidence = await get_cognitive_core().calculate_confidence(current_user["id"], topic_tags)
    
    return confidence


@router.post("/advisory/log")
async def log_advisory_recommendation(
    log: RecommendationLog,
    current_user: dict = Depends(get_current_user)
):
    """
    Log a recommendation with full context and confidence classification.
    Every recommendation must be internally logged with:
    - The situation it addresses
    - The reason it was recommended
    - The expected outcome
    - The confidence level
    """
    # Auto-calculate confidence if not provided
    confidence = log.confidence
    confidence_factors = log.confidence_factors or []
    
    if not confidence:
        conf_data = await get_cognitive_core().calculate_confidence(
            current_user["id"], 
            log.topic_tags
        )
        confidence = conf_data.get("level", "medium")
        confidence_factors = conf_data.get("limiting_factors", [])
    
    recommendation_id = await get_cognitive_core().log_recommendation(
        user_id=current_user["id"],
        agent="MyAdvisor",
        situation=log.situation,
        recommendation=log.recommendation,
        reason=log.reason,
        expected_outcome=log.expected_outcome,
        topic_tags=log.topic_tags,
        urgency=log.urgency,
        confidence=confidence,
        confidence_factors=confidence_factors
    )
    
    return {
        "status": "logged",
        "recommendation_id": recommendation_id,
        "confidence": confidence,
        "confidence_factors": confidence_factors
    }


@router.post("/advisory/outcome")
async def record_advisory_outcome(
    outcome: RecommendationOutcome,
    current_user: dict = Depends(get_current_user)
):
    """
    Record whether advice was acted on and what happened.
    Future guidance will consider whether similar advice succeeded or failed.
    """
    await get_cognitive_core().record_recommendation_outcome(
        recommendation_id=outcome.recommendation_id,
        status=outcome.status,
        actual_outcome=outcome.actual_outcome,
        notes=outcome.notes
    )
    
    # If ignored, check if escalation is needed
    if outcome.status == "ignored":
        new_level = await get_cognitive_core().escalate_ignored_advice(outcome.recommendation_id)
        urgency_labels = ["normal", "elevated", "critical"]
        return {
            "status": "recorded",
            "escalated": True,
            "new_urgency": urgency_labels[new_level]
        }
    
    return {"status": "recorded", "escalated": False}


@router.get("/advisory/history")
async def get_advisory_history(
    topic: Optional[str] = None,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get the advisory log for this user."""
    query = get_sb().table("advisory_log").select("*").eq("user_id", current_user["id"])

    if topic:
        query = query.contains("topic_tags", [topic])

    result = query.order("created_at", desc=True).limit(limit).execute()
    history = result.data if result.data else []
    
    # Calculate stats
    total = len(history)
    acted = sum(1 for h in history if h.get("status") == "acted")
    ignored = sum(1 for h in history if h.get("status") == "ignored")
    pending = sum(1 for h in history if h.get("status") == "pending")
    
    return {
        "history": history,
        "stats": {
            "total": total,
            "acted": acted,
            "ignored": ignored,
            "pending": pending,
            "action_rate": round(acted / (acted + ignored), 2) if (acted + ignored) > 0 else None
        }
    }


@router.get("/advisory/escalations")
async def get_escalated_advice(current_user: dict = Depends(get_current_user)):
    """
    Get advice that has been repeatedly ignored and needs attention.
    Repeatedly ignored advice must escalate in clarity or urgency.
    """
    escalations = await get_cognitive_core().get_ignored_advice_for_escalation(current_user["id"])
    
    return {
        "escalations": escalations,
        "count": len(escalations)
    }

