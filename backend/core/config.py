"""
Application configuration — extracted from server.py.
Middleware classes, CORS setup, and service initialization helpers.
"""
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# ==================== ENV VARS ====================

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
AZURE_TENANT_ID = os.environ.get("AZURE_TENANT_ID", "common")
AZURE_TENANT_URL = os.environ.get("AZURE_TENANT_URL", "https://login.microsoftonline.com/common")
AZURE_CLIENT_ID = os.environ.get("AZURE_CLIENT_ID")
AZURE_CLIENT_SECRET = os.environ.get("AZURE_CLIENT_SECRET")
JWT_SECRET = os.environ['JWT_SECRET_KEY']
EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY')
OPENAI_KEY = os.environ.get('OPENAI_API_KEY')
AI_MODEL = "gpt-4o"
AI_MODEL_ADVANCED = "gpt-4o"
MAX_FILE_SIZE = 10 * 1024 * 1024


# ==================== MIDDLEWARE ====================

class NoCacheAPIMiddleware(BaseHTTPMiddleware):
    """Forces all API responses to include explicit no-cache headers."""
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-API-Server"] = "biqc-backend"
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response


def configure_middleware(app):
    """Register all middleware on the FastAPI app instance."""
    app.add_middleware(NoCacheAPIMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-API-Server"],
    )
    app.add_middleware(SessionMiddleware, secret_key=JWT_SECRET)


def configure_oauth():
    """Create and return configured OAuth instance."""
    oauth = OAuth()
    oauth.register(
        name='google',
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={'scope': 'openid email profile'}
    )
    return oauth


# ==================== SERVICE INITIALIZATION ====================

def init_services(supabase_admin):
    """Initialize all backend services. Returns dict of service instances."""
    services = {}

    # Cognitive Core
    from cognitive_core_supabase import init_cognitive_core
    services["cognitive_core"] = init_cognitive_core(supabase_admin)
    logger.info("Cognitive Core initialized with Supabase")

    # Watchtower Store
    from watchtower_store import init_watchtower_store
    services["watchtower_store"] = init_watchtower_store(supabase_admin)
    logger.info("Watchtower Store initialized")

    # Watchtower Engine
    from watchtower_engine import init_watchtower_engine
    services["watchtower_engine"] = init_watchtower_engine(supabase_admin)
    logger.info("Watchtower Engine initialized")

    # Merge Emission Layer
    try:
        from merge_client import get_merge_client
        from merge_emission_layer import init_emission_layer
        _merge = get_merge_client()
        services["emission_layer"] = init_emission_layer(supabase_admin, _merge)
        logger.info("Merge Emission Layer initialized")
    except Exception as e:
        logger.warning(f"Merge Emission Layer skipped: {e}")
        services["emission_layer"] = None

    # Escalation Memory
    from escalation_memory import init_escalation_memory
    services["escalation_memory"] = init_escalation_memory(supabase_admin)
    logger.info("Escalation Memory initialized")

    # Contradiction Engine
    from contradiction_engine import init_contradiction_engine
    services["contradiction_engine"] = init_contradiction_engine(supabase_admin)
    logger.info("Contradiction Engine initialized")

    # Snapshot Agent
    from snapshot_agent import init_snapshot_agent
    services["snapshot_agent"] = init_snapshot_agent(supabase_admin)
    logger.info("Snapshot Agent initialized")

    # Pressure Calibration
    from pressure_calibration import init_pressure_calibration
    services["pressure_calibration"] = init_pressure_calibration(supabase_admin)
    logger.info("Pressure Calibration initialized")

    # Intelligence Baseline
    from intelligence_baseline import init_intelligence_baseline
    services["intelligence_baseline"] = init_intelligence_baseline(supabase_admin)
    logger.info("Intelligence Baseline initialized")

    # Evidence Freshness
    from evidence_freshness import init_evidence_freshness
    services["evidence_freshness"] = init_evidence_freshness(supabase_admin)
    logger.info("Evidence Freshness initialized")

    return services
