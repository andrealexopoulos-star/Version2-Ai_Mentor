"""
Shared auth dependencies for route modules.
Extracted from server.py — zero logic changes.
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging

logger = logging.getLogger("server")
security = HTTPBearer()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """SUPABASE-ONLY Authentication."""
    token = credentials.credentials
    try:
        from auth_supabase import verify_supabase_token
        user = await verify_supabase_token(token)
        if user:
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
