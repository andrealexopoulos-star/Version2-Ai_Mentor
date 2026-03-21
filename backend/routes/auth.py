"""Auth Routes — Supabase signup, login, OAuth, me, check-profile."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
import json
import urllib.parse
import urllib.request
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


class RecaptchaVerifyRequest(BaseModel):
    token: str
    action: Optional[str] = None


@router.post("/auth/recaptcha/verify")
async def verify_recaptcha(request: RecaptchaVerifyRequest):
    """Verify Google reCAPTCHA token server-side."""
    secret = os.environ.get("RECAPTCHA_SECRET_KEY") or os.environ.get("RECAPTCHA_SECRET") or ""
    if not secret:
        return {"ok": True, "skipped": True, "reason": "recaptcha_secret_not_configured"}

    token = (request.token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Missing captcha token")

    payload = urllib.parse.urlencode({
        "secret": secret,
        "response": token,
    }).encode("utf-8")

    try:
        req = urllib.request.Request(
            "https://www.google.com/recaptcha/api/siteverify",
            data=payload,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8")
        data = json.loads(body)
    except Exception as exc:
        logger.warning(f"[recaptcha] verification request failed: {exc}")
        raise HTTPException(status_code=502, detail="Captcha verification unavailable")

    if not data.get("success"):
        raise HTTPException(status_code=400, detail="Captcha verification failed")

    returned_action = (data.get("action") or "").strip()
    expected_action = (request.action or "").strip()
    if expected_action and returned_action and returned_action != expected_action:
        raise HTTPException(status_code=400, detail="Captcha action mismatch")

    score = data.get("score")
    if isinstance(score, (int, float)) and score < 0.3:
        raise HTTPException(status_code=400, detail="Captcha score too low")

    return {"ok": True, "score": score, "action": returned_action or None}

@router.get("/auth/supabase/oauth/{provider}")
async def supabase_oauth(provider: str, redirect_to: Optional[str] = None):
    """
    Get OAuth URL for Google or Azure sign-in via Supabase
    """
    return await get_oauth_url(provider, redirect_to)

@router.get("/auth/supabase/me")
async def supabase_get_me(current_user: dict = Depends(get_current_user_supabase)):
    """Get current authenticated user (Supabase version). Resilient to upstream failures."""
    try:
        return {"user": current_user, "message": "Authenticated via Supabase"}
    except Exception as e:
        logger.error(f"[auth/me] Unexpected error: {e}")
        return {"user": {"id": current_user.get("id", ""), "email": current_user.get("email", ""), "role": "user"}, "message": "Partial profile"}

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

