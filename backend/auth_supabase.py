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
from supabase_client import supabase_admin
from datetime import datetime

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

# Pydantic Models
class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    company_name: Optional[str] = None
    industry: Optional[str] = None
    role: Optional[str] = None

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
    ALWAYS uses the auth.users ID as the source of truth
    """
    try:
        # First check if user already exists by ID (correct way)
        existing_by_id = await get_user_by_id(user_id)
        if existing_by_id:
            logger.info(f"User with ID {user_id} already exists, returning existing profile")
            return existing_by_id
        
        # Check if user exists by email with DIFFERENT ID (migration/duplicate case)
        existing_by_email = await get_user_by_email(email)
        if existing_by_email:
            old_id = existing_by_email.get("id")
            if old_id != user_id:
                logger.info(f"Found existing user by email {email} with different ID, merging accounts")
                logger.info(f"  Old ID: {old_id}")
                logger.info(f"  New ID (auth.users): {user_id}")
                
                try:
                    # Update all foreign key references FIRST
                    tables_to_update = [
                        "cognitive_profiles",
                        "chat_history", 
                        "onboarding",
                        "business_profiles",
                        "outlook_oauth_tokens",
                        "outlook_emails"
                    ]
                    
                    for table in tables_to_update:
                        try:
                            supabase_admin.table(table).update({"user_id": user_id}).eq("user_id", old_id).execute()
                            logger.info(f"✅ Updated {table} user_id")
                        except Exception as table_error:
                            logger.warning(f"Could not update {table}: {table_error}")
                    
                    # Delete old user record
                    supabase_admin.table("users").delete().eq("id", old_id).execute()
                    logger.info(f"✅ Deleted old user record {old_id}")
                    
                    # Create new user record with correct ID
                    user_data = {
                        "id": user_id,
                        "email": email,
                        "full_name": existing_by_email.get("full_name") or (metadata.get("full_name") if metadata else None),
                        "company_name": existing_by_email.get("company_name") or (metadata.get("company_name") if metadata else None),
                        "industry": existing_by_email.get("industry") or (metadata.get("industry") if metadata else None),
                        "role": existing_by_email.get("role") or "user",
                        "subscription_tier": existing_by_email.get("subscription_tier") or "free",
                        "is_master_account": email == "andre@thestrategysquad.com.au",
                        "created_at": existing_by_email.get("created_at") or datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat()
                    }
                    
                    user_response = supabase_admin.table("users").insert(user_data).execute()
                    if user_response.data:
                        logger.info(f"✅ Created merged user profile with correct ID {user_id}")
                        return user_response.data[0]
                        
                except Exception as merge_error:
                    logger.error(f"❌ Account merge failed: {merge_error}")
                    # Return the existing record even if merge failed
                    return existing_by_email
            else:
                # Same ID, just return existing
                return existing_by_email
        
        # No existing user - create new
        user_data = {
            "id": user_id,
            "email": email,
            "full_name": metadata.get("full_name") if metadata else None,
            "company_name": metadata.get("company_name") if metadata else None,
            "industry": metadata.get("industry") if metadata else None,
            "role": (metadata.get("role") if metadata else None) or "user",
            "subscription_tier": "free",
            "is_master_account": email == "andre@thestrategysquad.com.au",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        user_response = supabase_admin.table("users").insert(user_data).execute()
        
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
        return user_response.data[0]
        
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
    Verify Supabase JWT token and return user data
    """
    try:
        # Get user from Supabase Auth using the access token
        user_response = supabase_admin.auth.get_user(token)
        
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        user = user_response.user
        
        # Get full user profile from PostgreSQL
        db_user = await get_user_by_id(user.id)
        
        if not db_user:
            # Try to find by email in case user exists from different OAuth provider
            db_user = await get_user_by_email(user.email)
            
            if db_user:
                # User exists with same email but different ID
                # This can happen when using multiple OAuth providers or email signup then OAuth
                print(f"Found existing user by email {user.email} with different ID, merging accounts")
                try:
                    # STEP 1: Update cognitive_profiles first (to satisfy foreign key)
                    supabase_admin.table("cognitive_profiles").update({"user_id": user.id}).eq("user_id", db_user["id"]).execute()
                    print(f"✅ Updated cognitive_profiles user_id")
                    
                    # STEP 2: Update users table ID (foreign key now satisfied)
                    supabase_admin.table("users").update({"id": user.id}).eq("email", user.email).execute()
                    print(f"✅ Updated users table ID")
                    
                    # Update local variable
                    db_user["id"] = user.id
                    print(f"✅ Successfully merged user accounts for {user.email}")
                    
                except Exception as merge_error:
                    print(f"❌ Account merge failed: {merge_error}")
                    # If merge fails, create new user profile with new OAuth ID
                    # This is safer than leaving user in broken state
                    try:
                        db_user = await create_user_profile(
                            user_id=user.id,
                            email=user.email,
                            metadata={
                                **user.user_metadata,
                                "full_name": db_user.get("full_name") or user.user_metadata.get("full_name"),
                                "company_name": db_user.get("company_name"),
                                "industry": db_user.get("industry"),
                                "role": db_user.get("role")
                            }
                        )
                        print(f"✅ Created new user profile for OAuth user {user.email}")
                    except Exception as create_error:
                        print(f"❌ Failed to create new profile: {create_error}")
                        # Return basic user data from session as last resort
                        db_user = {
                            "id": user.id,
                            "email": user.email,
                            "full_name": user.user_metadata.get("full_name"),
                            "company_name": user.user_metadata.get("company_name"),
                            "role": "user",
                            "subscription_tier": "free",
                            "is_master_account": user.email == "andre@thestrategysquad.com.au"
                        }
            else:
                # User doesn't exist at all - create new profile
                db_user = await create_user_profile(
                    user_id=user.id,
                    email=user.email,
                    metadata=user.user_metadata
                )
        
        return {
            "id": user.id,
            "email": user.email,
            "role": db_user.get("role") or "user",
            "is_master_account": db_user.get("is_master_account", False),
            "subscription_tier": db_user.get("subscription_tier", "free"),
            "full_name": db_user.get("full_name"),
            "company_name": db_user.get("company_name")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error verifying token: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication token")
async def get_current_user_supabase(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Dependency to get current authenticated user from Supabase token
    """
    token = credentials.credentials
    return await verify_supabase_token(token)

# Auth Endpoints
async def signup_with_email(request: SignUpRequest):
    """
    Sign up with email and password using Supabase Auth
    """
    try:
        # Check if user already exists
        existing_user = await get_user_by_email(request.email)
        if existing_user:
            raise HTTPException(status_code=400, detail="User with this email already exists")
        
        # Create user in Supabase Auth
        auth_response = supabase_admin.auth.sign_up({
            "email": request.email,
            "password": request.password,
            "options": {
                "data": {
                    "full_name": request.full_name,
                    "company_name": request.company_name,
                    "industry": request.industry,
                    "role": request.role
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
                "industry": request.industry,
                "role": request.role
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
        auth_response = supabase_admin.auth.sign_in_with_password({
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
        
        return {
            "message": "Login successful",
            "user": {
                "id": auth_response.user.id,
                "email": auth_response.user.email,
                "full_name": user_profile.get("full_name"),
                "company_name": user_profile.get("company_name"),
                "role": user_profile.get("role"),
                "is_master_account": user_profile.get("is_master_account", False),
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
        
        options = {}
        if redirect_to:
            options["redirectTo"] = redirect_to
        
        # Supabase handles the OAuth flow automatically
        # Add prompt=select_account to force account picker
        auth_url = f"{os.environ.get('SUPABASE_URL')}/auth/v1/authorize?provider={provider}"
        
        # CRITICAL: Add prompt=select_account to show account picker
        # This prevents auto-login with cached credentials
        auth_url += "&prompt=select_account"
        
        if redirect_to:
            auth_url += f"&redirect_to={redirect_to}"
        
        return {
            "url": auth_url,
            "provider": provider
        }
        
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
        
        # Verify token using existing function
        return await verify_supabase_token(token)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error extracting user from request: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")
