"""Auth Routes — Supabase signup, login, OAuth, me, check-profile."""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from routes.deps import get_current_user, get_sb, logger
from supabase_client import safe_query_single
from auth_supabase import (
    signup_with_email, signin_with_email, get_oauth_url,
    get_current_user_supabase, get_user_by_id,
    SignUpRequest, SignInRequest,
)
from supabase_intelligence_helpers import get_business_profile_supabase

router = APIRouter()


# ==================== AUTH ROUTES ====================

# ==================== SUPABASE AUTH ROUTES (NEW) ====================
# Import Supabase auth functions
from auth_supabase import (
    signup_with_email,
    signin_with_email,
    get_oauth_url,
    get_current_user_supabase,
    get_current_user_from_request,
    get_user_by_id,
    SignUpRequest,
    SignInRequest
)

@router.post("/auth/supabase/signup")
async def supabase_signup(request: SignUpRequest):
    """
    New Supabase-based signup endpoint
    """
    return await signup_with_email(request)

@router.post("/auth/supabase/login")
async def supabase_login(request: SignInRequest):
    """
    New Supabase-based login endpoint
    """
    return await signin_with_email(request)

@router.get("/auth/supabase/oauth/{provider}")
async def supabase_oauth(provider: str, redirect_to: Optional[str] = None):
    """
    Get OAuth URL for Google or Azure sign-in via Supabase
    """
    return await get_oauth_url(provider, redirect_to)

@router.get("/auth/supabase/me")
async def supabase_get_me(current_user: dict = Depends(get_current_user_supabase)):
    """
    Get current authenticated user (Supabase version)
    """
    return {
        "user": current_user,
        "message": "Authenticated via Supabase"
    }

@router.get("/auth/check-profile")
async def check_user_profile(current_user: dict = Depends(get_current_user_supabase)):
    """Calibration-first profile check used by AuthCallbackSupabase.
    Single source of truth: user_operator_profile.persona_calibration_status"""
    try:
        user_id = current_user["id"]
        user_profile = await get_user_by_id(user_id)
        business_profile = await get_business_profile_supabase(get_sb(), user_id)

        # Check calibration from user_operator_profile ONLY
        calibration_complete = False
        try:
            op_result = safe_query_single(
                get_sb().table("user_operator_profile").select(
                    "persona_calibration_status"
                ).eq("user_id", user_id)
            )
            if op_result.data and op_result.data.get("persona_calibration_status") == "complete":
                calibration_complete = True
        except RuntimeError as e:
            logger.error(f"FATAL: auth/check-profile SDK error: {e}")
            raise HTTPException(status_code=500, detail="Internal SDK error")
        except Exception:
            pass

        calibration_status = "complete" if calibration_complete else "incomplete"
        needs_onboarding = not calibration_complete
        onboarding_status = "complete" if calibration_complete else "calibration_required"

        return {
            "profile_exists": bool(user_profile),
            "needs_onboarding": needs_onboarding,
            "user": {
                "id": user_profile.get("id") if user_profile else user_id,
                "email": user_profile.get("email") if user_profile else current_user.get("email"),
                "full_name": user_profile.get("full_name", "") if user_profile else "",
                "company_name": business_profile.get("business_name") if business_profile else None,
                "account_id": business_profile.get("account_id") if business_profile else None,
                "business_profile_id": business_profile.get("id") if business_profile else None
            },
            "onboarding_status": onboarding_status,
            "calibration_status": calibration_status,
            "has_business_profile": business_profile is not None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking user profile: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check profile: {str(e)}")

