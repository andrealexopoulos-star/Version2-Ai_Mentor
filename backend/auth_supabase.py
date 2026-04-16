"""
Supabase Authentication Module
Handles user authentication using Supabase Auth with Google and Azure providers
"""
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
import os
import logging
from urllib.parse import quote, urlparse
from supabase_client import get_supabase_client, init_supabase

supabase_admin = init_supabase()
from datetime import datetime
from datetime import timezone, timedelta
import re

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)


def _is_missing_column_error(exc: Exception) -> bool:
    text = str(exc or "")
    return "PGRST204" in text or "Could not find the" in text


def _extract_missing_column_name(exc: Exception) -> str:
    text = str(exc or "")
    match = re.search(r"'([^']+)' column", text)
    return (match.group(1) if match else "").strip()


def _insert_user_row_resilient(user_data: Dict[str, Any]):
    """
    Insert a user row while tolerating schema drift across environments.
    If optional columns (e.g. company_name/industry) are missing, retry
    with a minimal payload required for auth bootstrap.
    """
    payload = dict(user_data or {})
    last_exc: Exception | None = None
    for _ in range(8):
        try:
            return supabase_admin.table("users").insert(payload).execute()
        except Exception as exc:
            last_exc = exc
            if not _is_missing_column_error(exc):
                raise
            missing_col = _extract_missing_column_name(exc)
            if not missing_col or missing_col not in payload:
                break
            payload.pop(missing_col, None)
    if last_exc:
        raise last_exc
    raise RuntimeError("Failed to insert user row")

def _is_production() -> bool:
    env = (os.environ.get("ENVIRONMENT") or "").strip().lower()
    prod_flag = (os.environ.get("PRODUCTION") or "").strip().lower()
    return env == "production" or prod_flag in {"1", "true", "yes"}


def _load_master_admin_email() -> str:
    configured = (os.environ.get("BIQC_MASTER_ADMIN_EMAIL") or "").strip().lower()
    if configured:
        return configured
    if _is_production():
        raise RuntimeError("BIQC_MASTER_ADMIN_EMAIL must be configured in production")
    return ""


# Master admin (superadmin role override). Must be explicitly configured in production.
MASTER_ADMIN_EMAIL = _load_master_admin_email()


def _is_master_admin_email(email: str | None) -> bool:
    if not MASTER_ADMIN_EMAIL:
        return False
    return str(email or "").strip().lower() == MASTER_ADMIN_EMAIL


def _apply_master_admin_overrides(user_data: Dict[str, Any], email: str | None) -> Dict[str, Any]:
    """Guarantee master account remains superadmin even if DB row was reset/purged."""
    if not _is_master_admin_email(email):
        return user_data

    patched = dict(user_data or {})
    patched["role"] = "superadmin"
    patched["is_master_account"] = True
    return patched


def get_supabase_auth_client():
    """Return a client suitable for auth token introspection.

    Prefer anon-key client. If anon key is unavailable but service-role exists,
    fall back to the admin client so token verification does not fail-closed as 401.
    """
    try:
        return get_supabase_client()
    except Exception as anon_err:
        admin_client = init_supabase()
        if admin_client is not None:
            logger.warning(
                "[Auth] SUPABASE_ANON_KEY unavailable; falling back to service-role client for token verification"
            )
            return admin_client
        raise RuntimeError(f"Supabase auth client unavailable: {anon_err}") from anon_err

# Pydantic Models
class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    company_name: Optional[str] = None
    industry: Optional[str] = None
    # Kept for backward compatibility with old clients; ignored server-side.
    role: Optional[str] = None
    # Step 13 / P1-8 — reCAPTCHA token from the browser. When reCAPTCHA is
    # configured server-side (RECAPTCHA_SECRET_KEY or the enterprise trio),
    # this field is required in production; missing/invalid tokens are
    # rejected before we create a Supabase auth user. In dev/without
    # config this is silently accepted so local flows still work.
    recaptcha_token: Optional[str] = None

class SignInRequest(BaseModel):
    email: EmailStr
    password: str

class OAuthResponse(BaseModel):
    provider: str  # 'google' or 'azure'
    access_token: str
    refresh_token: Optional[str] = None

# Helper Functions
async def create_user_profile(user_id: str, email: str, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Create user profile in PostgreSQL and initialize Cognitive Core
    ALWAYS uses the auth.users ID as the source of truth.
    Handles ID mismatches from OAuth re-signup gracefully.
    """
    try:
        # First check if user already exists by ID (correct way)
        existing_by_id = await get_user_by_id(user_id)
        if existing_by_id:
            if _is_master_admin_email(email) and (
                existing_by_id.get("role") != "superadmin"
                or not existing_by_id.get("is_master_account")
            ):
                try:
                    supabase_admin.table("users").update({
                        "role": "superadmin",
                        "is_master_account": True,
                        "updated_at": datetime.utcnow().isoformat(),
                    }).eq("id", user_id).execute()
                except Exception as patch_err:
                    logger.warning(f"Could not enforce master admin flags for {email}: {patch_err}")
                existing_by_id = _apply_master_admin_overrides(existing_by_id, email)
            logger.info(f"User with ID {user_id} already exists, returning existing profile")
            return existing_by_id
        
        # Check if user exists by email with DIFFERENT ID (OAuth re-signup case)
        existing_by_email = await get_user_by_email(email)
        if existing_by_email:
            old_id = existing_by_email.get("id")
            if old_id != user_id:
                logger.info(f"ID MISMATCH for {email}: DB={old_id}, Auth={user_id}. Merging.")
                
                # Strategy: Update the ID in-place (single atomic operation, avoids delete+insert RLS issues)
                try:
                    supabase_admin.table("users").update({"id": user_id, "updated_at": datetime.utcnow().isoformat()}).eq("email", email).execute()
                    logger.info(f"Updated users table ID for {email}")
                except Exception as update_err:
                    logger.warning(f"Direct ID update failed ({update_err}), trying delete+insert")
                    try:
                        supabase_admin.table("users").delete().eq("id", old_id).execute()
                        user_data = {
                            "id": user_id, "email": email,
                            "full_name": existing_by_email.get("full_name") or (metadata.get("full_name") if metadata else None),
                            "company_name": existing_by_email.get("company_name") or (metadata.get("company_name") if metadata else None),
                            "industry": existing_by_email.get("industry") or (metadata.get("industry") if metadata else None),
                            "role": "superadmin" if _is_master_admin_email(email) else (existing_by_email.get("role") or "user"),
                            "subscription_tier": existing_by_email.get("subscription_tier") or "free",
                            "is_master_account": True if _is_master_admin_email(email) else existing_by_email.get("is_master_account", False),
                            "created_at": existing_by_email.get("created_at") or datetime.utcnow().isoformat(),
                            "updated_at": datetime.utcnow().isoformat()
                        }
                        _insert_user_row_resilient(user_data)
                        logger.info(f"Delete+insert merge succeeded for {email}")
                    except Exception as di_err:
                        logger.error(f"Delete+insert also failed ({di_err}), returning existing profile as-is")
                        existing_by_email["id"] = user_id
                        return existing_by_email

                # Update foreign keys in related tables
                for table in ["cognitive_profiles", "chat_history", "onboarding", "business_profiles"]:
                    try:
                        supabase_admin.table(table).update({"user_id": user_id}).eq("user_id", old_id).execute()
                    except Exception:
                        pass

                # Return the merged profile
                merged = await get_user_by_id(user_id)
                return _apply_master_admin_overrides(merged or {**existing_by_email, "id": user_id}, email)
            else:
                return _apply_master_admin_overrides(existing_by_email, email)
        
        # No existing user - create new
        user_data = {
            "id": user_id,
            "email": email,
            "full_name": metadata.get("full_name") if metadata else None,
            "company_name": metadata.get("company_name") if metadata else None,
            "industry": metadata.get("industry") if metadata else None,
            # Never trust client-supplied signup role.
            "role": "superadmin" if _is_master_admin_email(email) else "user",
            "subscription_tier": "free",
            "is_master_account": _is_master_admin_email(email),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        user_response = _insert_user_row_resilient(user_data)
        
        if not user_response.data:
            raise HTTPException(status_code=500, detail="Failed to create user profile")
        
        # Initialize Cognitive Core
        cognitive_data = {
            "user_id": user_id,
            "immutable_reality": {},
            "behavioural_truth": {},
            "delivery_preference": {},
            "consequence_memory": {},
            "last_updated": datetime.utcnow().isoformat()
        }
        
        try:
            supabase_admin.table("cognitive_profiles").insert(cognitive_data).execute()
        except Exception as cog_error:
            logger.warning(f"Could not create cognitive profile: {cog_error}")
        
        logger.info(f"✅ Created NEW user profile for {email} with ID {user_id}")
        created_user = _apply_master_admin_overrides(user_response.data[0], email)
        try:
            supabase_admin.table("users").update({
                "trial_expires_at": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
                "trial_tier": "pro",
            }).eq("id", user_id).execute()
            created_user["trial_expires_at"] = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
            created_user["trial_tier"] = "pro"
        except Exception as trial_err:
            logger.warning(f"Could not set trial for new user: {trial_err}")
        return created_user
        
    except Exception as e:
        error_str = str(e)
        logger.error(f"❌ CRITICAL: Error creating user profile for {email}: {e}")
        
        # Handle duplicate key error - user already exists
        if "duplicate key" in error_str or "23505" in error_str or "unique constraint" in error_str:
            logger.info(f"User {email} already exists (duplicate key), fetching existing")
            existing_user = await get_user_by_email(email)
            if existing_user:
                return existing_user
        
        # CRITICAL FIX: Do NOT return in-memory profile
        # This creates "phantom users" that break all FK constraints
        # Instead: RETRY the insert or FAIL explicitly
        logger.error(f"❌ CANNOT create user profile for {email} - failing explicitly")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to create user profile in database: {str(e)}"
        )


async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """
    Get user from PostgreSQL by email
    """
    try:
        response = supabase_admin.table("users").select("*").eq("email", email).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error fetching user: {e}")
        return None

async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get user from PostgreSQL by ID
    """
    try:
        response = supabase_admin.table("users").select("*").eq("id", user_id).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"Error fetching user: {e}")
        return None

async def verify_supabase_token(token: str) -> Dict[str, Any]:
    """
    Verify Supabase JWT token and return user data.
    Resilient: returns minimal profile if DB lookup fails.
    """
    try:
        # Validate token segments before calling Supabase
        segments = token.split('.')
        logger.debug("[Auth] Token format received with %s segments", len(segments))
        if len(segments) != 3:
            raise HTTPException(status_code=401, detail="Malformed token")

        # Get user from Supabase Auth using the access token
        try:
            auth_client = get_supabase_auth_client()
            user_response = auth_client.auth.get_user(token)
        except RuntimeError as cfg_err:
            logger.error(f"[Auth] Supabase auth client misconfigured: {cfg_err}")
            raise HTTPException(status_code=503, detail="Authentication provider is not configured")

        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        user = user_response.user

        # Get full user profile from PostgreSQL (fail-open to minimal profile)
        db_user = None
        try:
            db_user = await get_user_by_id(user.id)
            if not db_user:
                db_user = await get_user_by_email(user.email)
                if db_user:
                    logger.info(f"Token verify: ID mismatch for {user.email}, delegating to create_user_profile")
                    db_user = await create_user_profile(user_id=user.id, email=user.email, metadata=user.user_metadata)
                else:
                    db_user = await create_user_profile(user_id=user.id, email=user.email, metadata=user.user_metadata)
        except Exception as db_err:
            logger.warning(f"[Auth] DB lookup failed for {user.email}: {db_err} — returning minimal profile")
            db_user = {}
        if not isinstance(db_user, dict):
            db_user = {}

        return {
            "id": user.id,
            "email": user.email,
            "role": "superadmin" if _is_master_admin_email(user.email) else (db_user.get("role") or "user"),
            "is_master_account": True if _is_master_admin_email(user.email) else db_user.get("is_master_account", False),
            "subscription_tier": db_user.get("subscription_tier", "free"),
            "full_name": db_user.get("full_name") or user.user_metadata.get("full_name"),
            "company_name": db_user.get("company_name"),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Auth] Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication token")
async def get_current_user_supabase(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Dependency to get current authenticated user from Supabase token
    """
    if isinstance(credentials, Request):
        auth_header = credentials.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Not authenticated")
        token = auth_header.split(" ", 1)[1]
        return await verify_supabase_token(token)

    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    return await verify_supabase_token(token)

# ────────────────────────────────────────────────────────────────────────────
# Step 13 / P1-8 — reCAPTCHA gate for the signup path.
#
# Without this gate a scripted attacker can hit POST /api/auth/supabase/signup
# directly and skip the browser-side /auth/recaptcha/verify check entirely.
# This helper runs server-side verification on the token the client submits,
# so the Supabase auth row is never created unless the captcha has passed.
#
# Behaviour matrix:
#   configured | token | prod → 400 (token required)
#   configured | token | dev  → log + allow (so local dev without a site
#                               key set doesn't break tests)
#   configured | present       → verify; 400 on fail, 503 on verifier down
#                                in prod (fail-closed)
#   not-configured               → no-op (captcha not enforced in this env)
# ────────────────────────────────────────────────────────────────────────────
async def _enforce_signup_recaptcha(request: "SignUpRequest") -> None:
    """Verify the client's reCAPTCHA token before creating an auth user.

    Imports the helpers lazily to avoid a circular import between
    auth_supabase and routes.auth at module load time.
    """
    try:
        from routes.auth import recaptcha_is_configured, verify_recaptcha_token
    except Exception as import_err:
        # If the helper module fails to import we don't want to break signup
        # entirely — log loudly and continue. In practice this only trips
        # during isolated unit tests that stub out routes.auth.
        logger.warning(f"[signup] recaptcha helpers unavailable: {import_err}")
        return

    token = (request.recaptcha_token or "").strip()
    configured = recaptcha_is_configured()

    if not token:
        if configured and _is_production():
            raise HTTPException(status_code=400, detail="Captcha token required")
        if configured:
            # Dev environments that happen to have the server-side secret
            # set but no browser site-key. Log but don't block.
            logger.warning("[signup] reCAPTCHA configured but no token provided — allowing in non-prod")
        return

    try:
        result = await verify_recaptcha_token(token, expected_action="register")
    except HTTPException:
        # 4xx / 5xx from the verifier — propagate as-is (already user-safe).
        raise
    except Exception as exc:
        logger.warning(f"[signup] unexpected recaptcha verify error: {exc}")
        if _is_production():
            raise HTTPException(status_code=503, detail="Captcha verification unavailable")
        return

    if result.get("skipped"):
        # Dev-bypass flag or missing secret in non-prod.
        return

    if not result.get("ok"):
        if result.get("unavailable"):
            # Google siteverify down or enterprise API 5xx.
            if _is_production():
                raise HTTPException(status_code=503, detail="Captcha verification unavailable")
            logger.warning("[signup] recaptcha verifier unavailable — allowing in non-prod")
            return
        raise HTTPException(status_code=400, detail="Captcha verification failed")


# Auth Endpoints
async def signup_with_email(request: SignUpRequest):
    """
    Sign up with email and password using Supabase Auth
    """
    try:
        # Step 13 / P1-8 — gate signup on reCAPTCHA before touching Supabase.
        # Runs first so invalid/bot signups don't consume Supabase auth quota
        # or create orphaned auth.users rows.
        await _enforce_signup_recaptcha(request)

        # Check if user already exists
        existing_user = await get_user_by_email(request.email)
        if existing_user:
            raise HTTPException(status_code=400, detail="User with this email already exists")
        
        # Create user in Supabase Auth
        auth_response = get_supabase_auth_client().auth.sign_up({
            "email": request.email,
            "password": request.password,
            "options": {
                "data": {
                    "full_name": request.full_name,
                    "company_name": request.company_name,
                    "industry": request.industry
                }
            }
        })
        
        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Failed to create user")
        
        # Create user profile in PostgreSQL
        user_profile = await create_user_profile(
            user_id=auth_response.user.id,
            email=request.email,
            metadata={
                "full_name": request.full_name,
                "company_name": request.company_name,
                "industry": request.industry
            }
        )
        
        return {
            "message": "User created successfully",
            "user": {
                "id": auth_response.user.id,
                "email": auth_response.user.email,
                "full_name": user_profile.get("full_name"),
                "company_name": user_profile.get("company_name")
            },
            "session": {
                "access_token": auth_response.session.access_token if auth_response.session else None,
                "refresh_token": auth_response.session.refresh_token if auth_response.session else None,
                "expires_at": auth_response.session.expires_at if auth_response.session else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Signup error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")

async def signin_with_email(request: SignInRequest):
    """
    Sign in with email and password using Supabase Auth
    """
    try:
        # Authenticate with Supabase
        auth_response = get_supabase_auth_client().auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })
        
        if not auth_response.user or not auth_response.session:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Get user profile from PostgreSQL
        user_profile = await get_user_by_id(auth_response.user.id)
        
        if not user_profile:
            # Create profile if missing
            user_profile = await create_user_profile(
                user_id=auth_response.user.id,
                email=auth_response.user.email,
                metadata=auth_response.user.user_metadata
            )

        user_profile = _apply_master_admin_overrides(user_profile or {}, auth_response.user.email)
        if _is_master_admin_email(auth_response.user.email):
            try:
                supabase_admin.table("users").update({
                    "role": "superadmin",
                    "is_master_account": True,
                    "updated_at": datetime.utcnow().isoformat(),
                }).eq("id", auth_response.user.id).execute()
            except Exception as patch_err:
                logger.warning(f"Could not persist master admin override during login: {patch_err}")
        
        return {
            "message": "Login successful",
            "user": {
                "id": auth_response.user.id,
                "email": auth_response.user.email,
                "full_name": user_profile.get("full_name"),
                "company_name": user_profile.get("company_name"),
                "role": "superadmin" if _is_master_admin_email(auth_response.user.email) else user_profile.get("role"),
                "is_master_account": True if _is_master_admin_email(auth_response.user.email) else user_profile.get("is_master_account", False),
                "subscription_tier": user_profile.get("subscription_tier", "free")
            },
            "session": {
                "access_token": auth_response.session.access_token,
                "refresh_token": auth_response.session.refresh_token,
                "expires_at": auth_response.session.expires_at
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(status_code=401, detail="Invalid email or password")

async def get_oauth_url(provider: str, redirect_to: str = None):
    """
    Get OAuth URL for Google or Azure sign-in with account picker
    """
    try:
        if provider not in ["google", "azure"]:
            raise HTTPException(status_code=400, detail="Invalid provider. Use 'google' or 'azure'")
        
        normalized_redirect = None
        if redirect_to:
            parsed = urlparse(redirect_to)
            if parsed.scheme != "https" or not parsed.netloc:
                raise HTTPException(status_code=400, detail="Invalid redirect target")

            allowed_origins = {
                (os.environ.get("FRONTEND_URL") or "").strip(),
                (os.environ.get("PUBLIC_FRONTEND_URL") or "").strip(),
                (os.environ.get("REACT_APP_FRONTEND_URL") or "").strip(),
            }
            allowed_origins = {origin.rstrip("/") for origin in allowed_origins if origin}
            redirect_origin = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
            if not allowed_origins:
                raise HTTPException(status_code=503, detail="OAuth redirect allowlist is not configured")
            if redirect_origin not in allowed_origins:
                raise HTTPException(status_code=400, detail="Redirect target not allowed")
            normalized_redirect = redirect_to
        
        # Supabase handles the OAuth flow automatically
        # Add prompt=select_account to force account picker
        auth_url = f"{os.environ.get('SUPABASE_URL')}/auth/v1/authorize?provider={provider}"
        
        # CRITICAL: Add prompt=select_account to show account picker
        # This prevents auto-login with cached credentials
        auth_url += "&prompt=select_account"
        
        if normalized_redirect:
            auth_url += f"&redirect_to={quote(normalized_redirect, safe=':/?=&%-._~')}"
        
        return {
            "url": auth_url,
            "provider": provider
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"OAuth URL error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate OAuth URL: {str(e)}")

async def get_current_user_from_request(request) -> Dict[str, Any]:
    """
    Extract user from Request object (for endpoints that don't use Depends)
    Used by calibration endpoint which needs to handle auth manually
    """
    try:
        # Extract Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        # Check Bearer format
        if not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization format")
        
        # Extract token
        token = auth_header.replace("Bearer ", "").strip()
        if not token:
            raise HTTPException(status_code=401, detail="No token provided")
        
        # Debug: log token segment count only (no token material)
        segments = token.split(".")
        logger.debug("[Auth] Request token format received with %s segments", len(segments))
        
        # Verify token using existing function
        return await verify_supabase_token(token)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error extracting user from request: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")
