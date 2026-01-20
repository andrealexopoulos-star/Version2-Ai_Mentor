"""
Supabase Client Initialization and Helper Functions
Lazy initialization to prevent crashes when env vars not loaded
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")

def get_supabase_admin() -> Client:
    """
    Initialize Supabase client with service role key (for backend operations)
    This bypasses RLS and should be used carefully for admin operations
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment")
    
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def get_supabase_client() -> Client:
    """
    Initialize Supabase client with anon key (for user-scoped operations)
    This respects RLS policies
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment")
    
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Lazy initialization - don't create at import time
supabase_admin = None

def init_supabase():
    """
    Initialize supabase_admin - call after env vars loaded
    Returns None if Supabase not configured (graceful degradation)
    """
    global supabase_admin
    if supabase_admin is None:
        try:
            if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
                supabase_admin = get_supabase_admin()
                return supabase_admin
            else:
                # Supabase not configured - return None (app can still run without it)
                return None
        except Exception as e:
            print(f"Warning: Could not initialize Supabase: {e}")
            return None
    return supabase_admin
