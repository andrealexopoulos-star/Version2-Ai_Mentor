"""Auth Routes — Supabase signup, login, OAuth, me, check-profile."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
import json
import urllib.parse
import urllib.request
import urllib.error
from routes.deps import get_current_user, get_sb, logger
from supabase_client import safe_query_single
from auth_supabase import (
    signup_with_email, signin_with_email, get_oauth_url,
    get_user_by_id,
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
    get_current_user_from_request,
    get_user_by_id,
    SignUpRequest,
    SignInRequest
)


def _first_env(*names: str) -> str:
    """Return first non-empty environment variable value from aliases."""
    for name in names:
        value = (os.environ.get(name) or "").strip()
        if value:
            return value
    return ""


def _is_production_env() -> bool:
    env = (os.environ.get("ENVIRONMENT") or "").strip().lower()
    prod_flag = (os.environ.get("PRODUCTION") or "").strip().lower()
    return env == "production" or prod_flag in {"1", "true", "yes"}


def _is_truthy_env(name: str) -> bool:
    return (os.environ.get(name) or "").strip().lower() in {"1", "true", "yes", "on"}

@router.post("/auth/supabase/signup")
async def supabase_signup(request: SignUpRequest):
    """
    New Supabase-based signup endpoint
    """
    return await signup_with_email(request)


@router.post("/auth/signup")
async def signup_alias(request: SignUpRequest):
    """Neutral alias for signup endpoint."""
    return await signup_with_email(request)

@router.post("/auth/supabase/login")
async def supabase_login(request: SignInRequest):
    """
    New Supabase-based login endpoint
    """
    return await signin_with_email(request)


@router.post("/auth/login")
async def login_alias(request: SignInRequest):
    """Neutral alias for login endpoint."""
    return await signin_with_email(request)


class RecaptchaVerifyRequest(BaseModel):
    token: str
    expectedAction: Optional[str] = None
    siteKey: Optional[str] = None
    action: Optional[str] = None


@router.post("/auth/recaptcha/verify")
async def verify_recaptcha(request: RecaptchaVerifyRequest):
    """Verify Google reCAPTCHA token server-side (standard + enterprise)."""
    # Local/dev bypass only. Never bypass in production.
    # Supported flags:
    # - RECAPTCHA_DEV_BYPASS=true
    # - CAPTCHA_DEV_BYPASS=true
    # - RECAPTCHA_BYPASS=true
    if not _is_production_env():
        if (
            _is_truthy_env("RECAPTCHA_DEV_BYPASS")
            or _is_truthy_env("CAPTCHA_DEV_BYPASS")
            or _is_truthy_env("RECAPTCHA_BYPASS")
        ):
            return {"ok": True, "skipped": True, "reason": "captcha_dev_bypass"}

    provider = _first_env(
        "RECAPTCHA_PROVIDER",
        "REACT_APP_RECAPTCHA_PROVIDER",
    ) or "auto"
    provider = provider.lower()
    # Accept common alias names used across Azure/GCP/GitHub secrets.
    secret = _first_env(
        "RECAPTCHA_SECRET_KEY",
        "RECAPTCHA_SECRET",
        "GOOGLE_RECAPTCHA_SECRET_KEY",
        "GOOGLE_RECAPTCHA_SECRET",
        "CAPTCHA_SECRET_KEY",
    )
    enterprise_project_id = _first_env(
        "RECAPTCHA_ENTERPRISE_PROJECT_ID",
        "GOOGLE_CLOUD_PROJECT",
        "GOOGLE_CLOUD_PROJECT_ID",
        "GOOGLE_PROJECT_ID",
    )
    enterprise_api_key = _first_env(
        "RECAPTCHA_ENTERPRISE_API_KEY",
        "GOOGLE_API_KEY",
        "GOOGLE_CLOUD_API_KEY",
        "RECAPTCHA_API_KEY",
    )
    expected_action = (request.expectedAction or request.action or "").strip()
    site_key = (
        (request.siteKey or "").strip()
        or _first_env(
            "RECAPTCHA_SITE_KEY",
            "REACT_APP_RECAPTCHA_SITE_KEY",
            "GOOGLE_RECAPTCHA_SITE_KEY",
            "CAPTCHA_SITE_KEY",
        )
    )
    min_score_raw = _first_env("RECAPTCHA_MIN_SCORE") or "0.3"
    try:
        min_score = float(min_score_raw)
    except ValueError:
        min_score = 0.3

    token = (request.token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Missing captcha token")

    use_enterprise = provider == "enterprise" or (enterprise_project_id and enterprise_api_key)
    if use_enterprise and enterprise_project_id and enterprise_api_key and site_key:
        event_payload = {"token": token, "siteKey": site_key}
        if expected_action:
            event_payload["expectedAction"] = expected_action
        payload = json.dumps({"event": event_payload}).encode("utf-8")
        project = urllib.parse.quote(enterprise_project_id, safe="")
        api_key = urllib.parse.quote(enterprise_api_key, safe="")
        endpoint = f"https://recaptchaenterprise.googleapis.com/v1/projects/{project}/assessments?key={api_key}"
        try:
            req = urllib.request.Request(
                endpoint,
                data=payload,
                method="POST",
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                body = resp.read().decode("utf-8")
            data = json.loads(body)
        except urllib.error.HTTPError as exc:
            detail = "Captcha verification unavailable"
            try:
                err_body = exc.read().decode("utf-8")
                parsed = json.loads(err_body)
                detail = parsed.get("error", {}).get("message") or detail
            except Exception:
                pass
            logger.warning(f"[recaptcha enterprise] verification request failed: {detail}")
            return {"ok": False, "provider": "enterprise", "unavailable": True, "reason": "captcha_verification_unavailable"}
        except Exception as exc:
            logger.warning(f"[recaptcha enterprise] verification request failed: {exc}")
            return {"ok": False, "provider": "enterprise", "unavailable": True, "reason": "captcha_verification_unavailable"}

        token_props = data.get("tokenProperties") or {}
        if not token_props.get("valid", False):
            reason = (token_props.get("invalidReason") or "UNKNOWN").strip()
            raise HTTPException(status_code=400, detail=f"Captcha verification failed ({reason})")

        returned_action = (token_props.get("action") or "").strip()
        if expected_action and returned_action and returned_action != expected_action:
            raise HTTPException(status_code=400, detail="Captcha action mismatch")

        score = (data.get("riskAnalysis") or {}).get("score")
        if isinstance(score, (int, float)) and score < min_score:
            raise HTTPException(status_code=400, detail="Captcha score too low")

        return {"ok": True, "provider": "enterprise", "score": score, "action": returned_action or None}

    if not secret:
        is_production = _is_production_env()
        if is_production:
            raise HTTPException(status_code=503, detail="Captcha verification unavailable")
        return {"ok": True, "skipped": True, "reason": "recaptcha_secret_not_configured"}

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
        return {"ok": False, "provider": "standard", "unavailable": True, "reason": "captcha_verification_unavailable"}

    if not data.get("success"):
        raise HTTPException(status_code=400, detail="Captcha verification failed")

    returned_action = (data.get("action") or "").strip()
    if expected_action and returned_action and returned_action != expected_action:
        raise HTTPException(status_code=400, detail="Captcha action mismatch")

    score = data.get("score")
    if isinstance(score, (int, float)) and score < min_score:
        raise HTTPException(status_code=400, detail="Captcha score too low")

    return {"ok": True, "provider": "standard", "score": score, "action": returned_action or None}


# ────────────────────────────────────────────────────────────────────────────
# Step 13 / P1-8 — reCAPTCHA helpers for internal callers (signup, OAuth).
#
# The endpoint above is designed to be hit over HTTP by the browser. Server-
# side callers (e.g. signup_with_email in auth_supabase.py) need the same
# verification logic without making a loopback HTTP request. Rather than
# duplicate ~150 lines of code, we expose two small helpers:
#
#   recaptcha_is_configured()   — sync, checks env vars to decide whether
#                                 enforcement is active for this environment.
#                                 Signup uses it to decide "token required"
#                                 vs. "no token, no problem".
#
#   verify_recaptcha_token()    — async, delegates to the same core logic
#                                 as the endpoint (via RecaptchaVerifyRequest).
#                                 Returns the identical response dict so
#                                 callers can inspect ok / unavailable / skipped.
#
# Both are pure wrappers — the single source of truth for verification
# behaviour remains the `verify_recaptcha` endpoint above.
# ────────────────────────────────────────────────────────────────────────────
def recaptcha_is_configured() -> bool:
    """True when a reCAPTCHA secret or enterprise credentials are set in env.

    The signup path uses this to distinguish "captcha disabled — allow signup"
    from "captcha enabled but caller didn't provide a token — reject". It
    matches the env-var lookups used inside `verify_recaptcha` so the two
    stay in lockstep.
    """
    standard = bool(_first_env(
        "RECAPTCHA_SECRET_KEY",
        "RECAPTCHA_SECRET",
        "GOOGLE_RECAPTCHA_SECRET_KEY",
        "GOOGLE_RECAPTCHA_SECRET",
        "CAPTCHA_SECRET_KEY",
    ))
    enterprise = bool(
        _first_env(
            "RECAPTCHA_ENTERPRISE_PROJECT_ID",
            "GOOGLE_CLOUD_PROJECT",
            "GOOGLE_CLOUD_PROJECT_ID",
            "GOOGLE_PROJECT_ID",
        )
        and _first_env(
            "RECAPTCHA_ENTERPRISE_API_KEY",
            "GOOGLE_API_KEY",
            "GOOGLE_CLOUD_API_KEY",
            "RECAPTCHA_API_KEY",
        )
    )
    return standard or enterprise


async def verify_recaptcha_token(
    token: str,
    expected_action: str = "register",
    site_key: str = "",
) -> dict:
    """Verify a reCAPTCHA token in-process and return the endpoint's dict.

    Intended for server-side callers (e.g. signup). Delegates to the same
    `verify_recaptcha` endpoint handler so the verification semantics and
    failure modes are identical to what the browser sees.
    """
    return await verify_recaptcha(RecaptchaVerifyRequest(
        token=token,
        expectedAction=expected_action,
        siteKey=site_key or None,
    ))


@router.get("/auth/supabase/oauth/{provider}")
async def supabase_oauth(provider: str, redirect_to: Optional[str] = None):
    """
    Get OAuth URL for Google or Azure sign-in via Supabase
    """
    return await get_oauth_url(provider, redirect_to)


@router.get("/auth/oauth/{provider}")
async def oauth_alias(provider: str, redirect_to: Optional[str] = None):
    """Neutral alias for OAuth URL endpoint."""
    return await get_oauth_url(provider, redirect_to)

@router.get("/auth/supabase/me")
async def supabase_get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user (Supabase version). Resilient to upstream failures."""
    try:
        return {"user": current_user, "message": "Authenticated"}
    except Exception as e:
        logger.error(f"[auth/me] Unexpected error: {e}")
        return {"user": {"id": current_user.get("id", ""), "email": current_user.get("email", ""), "role": "user"}, "message": "Partial profile"}


@router.get("/auth/me")
async def get_me_alias(current_user: dict = Depends(get_current_user)):
    """Neutral alias for current user endpoint."""
    try:
        return {"user": current_user, "message": "Authenticated"}
    except Exception as e:
        logger.error(f"[auth/me alias] Unexpected error: {e}")
        return {"user": {"id": current_user.get("id", ""), "email": current_user.get("email", ""), "role": "user"}, "message": "Partial profile"}

@router.get("/auth/check-profile")
async def check_user_profile(current_user: dict = Depends(get_current_user)):
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

