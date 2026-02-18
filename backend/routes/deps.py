"""
Shared dependencies for route modules.
Extracted from server.py — zero logic changes.

All route modules import auth deps and shared state from here.
server.py calls init_route_deps() once at startup to inject globals.
"""
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging
import os

logger = logging.getLogger("server")
security = HTTPBearer()

# ─── Globals injected by server.py at startup ───
supabase_admin = None
OPENAI_KEY = None
cognitive_core = None
AI_MODEL = "gpt-4o"
AI_MODEL_ADVANCED = "gpt-4o"


def init_route_deps(sb_admin, openai_key, cog_core=None):
    """Called once by server.py after initialization."""
    global supabase_admin, OPENAI_KEY, cognitive_core
    supabase_admin = sb_admin
    OPENAI_KEY = openai_key
    if cog_core is not None:
        cognitive_core = cog_core


def get_sb():
    """Get supabase_admin. Fails fast if not initialized."""
    if supabase_admin is None:
        raise RuntimeError("supabase_admin not initialized — call init_route_deps() first")
    return supabase_admin


# ─── Auth Dependencies ───

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """SUPABASE-ONLY Authentication. Checks suspended status."""
    token = credentials.credentials
    try:
        from auth_supabase import verify_supabase_token
        user = await verify_supabase_token(token)
        if user:
            # Check if user is suspended
            try:
                sb = get_sb()
                row = sb.table("users").select("role").eq("id", user.get("id")).maybe_single().execute()
                if row.data and row.data.get("role") == "suspended":
                    raise HTTPException(status_code=403, detail="Account suspended. Contact support.")
            except HTTPException:
                raise
            except Exception:
                pass  # If check fails, let user through (fail-open for auth)
            return user
        else:
            raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Supabase token validation failed: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed - please log in again")


async def get_admin_user(current_user: dict = Depends(get_current_user)):
    """Admin-only dependency. Accepts 'admin' and 'superadmin' roles."""
    if current_user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def get_super_admin(current_user: dict = Depends(get_current_user)):
    """Super-admin only. Strictest gate — for system-level operations."""
    if current_user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Super-admin access required")
    return current_user


async def get_client_admin(current_user: dict = Depends(get_current_user)):
    """Client-admin gate — for profile/workspace management routes.
    Accepts: owner, admin, superadmin, client_admin, user_admin."""
    allowed = {"owner", "admin", "superadmin", "client_admin", "user_admin"}
    if current_user.get("role") not in allowed:
        raise HTTPException(status_code=403, detail="Insufficient permissions — admin or owner role required")
    return current_user


async def get_current_user_from_request(request: Request):
    """Extract user from raw Request object (for endpoints that don't use Depends)."""
    from auth_supabase import get_current_user_from_request as _impl
    return await _impl(request)
