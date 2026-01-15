"""
Supabase Client Initialization and Helper Functions
Replaces MongoDB with Supabase PostgreSQL
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

# Global admin client instance
supabase_admin: Client = get_supabase_admin()
