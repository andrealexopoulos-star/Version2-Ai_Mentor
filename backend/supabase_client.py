"""
Supabase Client Initialization — with SDK integrity checks.

GUARDRAILS:
- Asserts `maybe_single` method exists on query builders at startup
- Wraps queries with fail-fast error handling (no silent AttributeError)
- Pinned to supabase==2.27.2 (snake_case API: maybe_single, not maybeSingle)
"""
import os
import logging
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(ROOT_DIR / '.env', override=False)
logger = logging.getLogger(__name__)

def _env(key: str, *alt_keys: str) -> str | None:
    for k in (key,) + alt_keys:
        v = (os.environ.get(k) or "").strip()
        if v and v.lower() not in ("dummy", "placeholder", "xxx", "your-"):
            return v
    return None

SUPABASE_URL = _env("SUPABASE_URL", "REACT_APP_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = _env("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY")
SUPABASE_ANON_KEY = _env("SUPABASE_ANON_KEY", "REACT_APP_SUPABASE_ANON_KEY")


def _assert_sdk_integrity(client: Client):
    """
    RUNTIME ASSERTION: Verify the Supabase Python SDK has the expected API surface.
    If the SDK is upgraded and method names change (e.g. maybe_single → maybeSingle),
    this will fail FAST at startup instead of silently returning wrong data.
    """
    try:
        builder = client.table("users").select("id").limit(0)
        assert hasattr(builder, 'maybe_single'), (
            "FATAL: Supabase SDK missing 'maybe_single' method. "
            "Expected snake_case API (supabase>=2.x). "
            "Check requirements.txt pins: supabase==2.27.2"
        )
        assert hasattr(builder, 'eq'), "FATAL: Supabase SDK missing 'eq' method."
        assert hasattr(builder, 'execute'), "FATAL: Supabase SDK missing 'execute' method."
        logger.info("[SDK] Supabase client integrity check PASSED (maybe_single, eq, execute)")
    except AssertionError:
        raise
    except Exception as e:
        logger.warning(f"[SDK] Integrity check skipped (non-fatal): {e}")


def get_supabase_admin() -> Client:
    """Initialize Supabase client with service role key (bypasses RLS)."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def get_supabase_client() -> Client:
    """Initialize Supabase client with anon key (respects RLS)."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_ANON_KEY")
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


# Lazy initialization
supabase_admin = None


def init_supabase():
    """
    Initialize supabase_admin with SDK integrity check.
    Raises on SDK mismatch — fail fast, not silent.
    """
    global supabase_admin
    if supabase_admin is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            logger.warning(
                "[Supabase] Missing env vars — cannot initialize. "
                "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) in backend/.env or environment. "
                "Server will run without database; auth and data routes will fail."
            )
            return None
        supabase_admin = get_supabase_admin()
        _assert_sdk_integrity(supabase_admin)
        logger.info("[Supabase] Admin client initialized and verified")
    return supabase_admin


def safe_query_single(table_query):
    """
    Fail-fast wrapper for .maybe_single().execute() calls.
    If AttributeError occurs (SDK mismatch), raises RuntimeError immediately.
    Returns an object with .data attribute (None if no row found).
    """
    try:
        result = table_query.maybe_single().execute()
        if result is None:
            # maybe_single().execute() can return None for no matching row
            class _Empty:
                data = None
            return _Empty()
        return result
    except AttributeError as e:
        logger.error(
            f"[SDK MISMATCH] AttributeError in Supabase query: {e}. "
            f"This likely means the Supabase Python SDK was upgraded and "
            f"method names changed. Check requirements.txt pins."
        )
        raise RuntimeError(f"Supabase SDK method mismatch: {e}") from e
