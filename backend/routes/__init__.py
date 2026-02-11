"""
Shared dependencies for route modules.
All route files import shared state from here instead of from server.py.
This prevents circular imports while keeping a single source of initialized services.
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging

logger = logging.getLogger("server")
security = HTTPBearer()

# These will be set by server.py at startup via init_deps()
supabase_admin = None
cognitive_core = None

def init_deps(sb_admin, cog_core):
    """Called once by server.py after initialization."""
    global supabase_admin, cognitive_core
    supabase_admin = sb_admin
    cognitive_core = cog_core

def get_supabase():
    return supabase_admin

def get_cognitive_core():
    return cognitive_core
