"""
Supabase Authentication Module
Handles user authentication using Supabase Auth with Google and Azure providers
"""
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
import os
from supabase_client import supabase_admin
from datetime import datetime

security = HTTPBearer()

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
    """
    try:
        # Create user record
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
        
        supabase_admin.table("cognitive_profiles").insert(cognitive_data).execute()
        
        return user_response.data[0]
        
    except Exception as e:
        print(f"Error creating user profile: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create user profile: {str(e)}")

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
                # This can happen when using multiple OAuth providers
                print(f"Found existing user by email {user.email}, updating ID mapping")
                try:
                    # Update the user record with the new OAuth provider's ID
                    supabase_admin.table("users").update({"id": user.id}).eq("email", user.email).execute()
                    db_user["id"] = user.id
                except Exception as update_error:
                    print(f"Warning: Could not update user ID: {update_error}")
                    # Continue with existing user data
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
    Get OAuth URL for Google or Azure sign-in
    """
    try:
        if provider not in ["google", "azure"]:
            raise HTTPException(status_code=400, detail="Invalid provider. Use 'google' or 'azure'")
        
        options = {}
        if redirect_to:
            options["redirectTo"] = redirect_to
        
        # Supabase handles the OAuth flow automatically
        auth_url = f"{os.environ.get('SUPABASE_URL')}/auth/v1/authorize?provider={provider}"
        
        if redirect_to:
            auth_url += f"&redirect_to={redirect_to}"
        
        return {
            "url": auth_url,
            "provider": provider
        }
        
    except Exception as e:
        print(f"OAuth URL error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate OAuth URL: {str(e)}")
