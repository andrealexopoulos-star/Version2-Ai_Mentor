"""
Application configuration — extracted from server.py.
Middleware classes, CORS setup, and service initialization helpers.
"""
import os
import logging
import time
import hashlib
import json
import base64
from collections import defaultdict, deque
from threading import Lock
from pathlib import Path
from dotenv import load_dotenv

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
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
OPENAI_KEY = os.environ.get('OPENAI_API_KEY')
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY')
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY')
AI_MODEL = "gpt-5.3"
AI_MODEL_ADVANCED = "gpt-5.4-pro"
MAX_FILE_SIZE = 10 * 1024 * 1024

RATE_LIMIT_RULES = {
    "/api/auth/supabase/login": {"window": 300, "limit": 5, "detail": "Too many login attempts. Please wait a few minutes before trying again."},
    "/api/soundboard/chat": {"window": 300, "limit": 120, "detail": "Too many high-cost AI requests. Please wait a few minutes before trying again."},
    "/api/boardroom/respond": {"window": 300, "limit": 20, "detail": "Too many high-cost AI requests. Please wait a few minutes before trying again."},
    "/api/voice/war-room/start": {"window": 300, "limit": 10, "detail": "Too many high-cost AI requests. Please wait a few minutes before trying again."},
    "/api/voice/war-room/respond": {"window": 300, "limit": 24, "detail": "Too many high-cost AI requests. Please wait a few minutes before trying again."},
    "/api/voice/realtime/session": {"window": 300, "limit": 8, "detail": "Too many voice session requests. Please wait a few minutes before trying again."},
    "/api/voice/realtime/negotiate": {"window": 300, "limit": 16, "detail": "Too many voice negotiation requests. Please wait a few minutes before trying again."},
}
RATE_LIMIT_BUCKETS = defaultdict(deque)
RATE_LIMIT_LOCK = Lock()
# Master admin for rate-limit bypass; default andre@... for testing. Override with BIQC_MASTER_ADMIN_EMAIL.
MASTER_ADMIN_EMAIL = (os.environ.get("BIQC_MASTER_ADMIN_EMAIL") or "andre@thestrategysquad.com.au").strip().lower()

# Admin inbox for operational alerts (waitlist / contact form, etc.)
BIQC_ADMIN_NOTIFICATION_EMAIL = (
    os.environ.get("BIQC_ADMIN_NOTIFICATION_EMAIL") or "andre@thestrategysquad.com.au"
).strip()
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
RESEND_FROM_EMAIL = (
    os.environ.get("RESEND_FROM_EMAIL") or os.environ.get("BIQC_RESEND_FROM_EMAIL") or ""
).strip()


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
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), interest-cohort=()"
        if request.url.path.startswith("/api"):
            response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
        return response


class RateLimitAPIMiddleware(BaseHTTPMiddleware):
    """Simple in-memory throttle for high-cost AI endpoints."""

    @staticmethod
    def _identifier(request):
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            return f"token:{hashlib.sha256(token.encode()).hexdigest()[:24]}"
        # Prefer original client IP from trusted proxy headers to avoid
        # collapsing many users behind a single reverse-proxy address.
        forwarded_for = (request.headers.get("x-forwarded-for") or "").strip()
        if forwarded_for:
            client_host = forwarded_for.split(",")[0].strip()
        else:
            client_host = (
                (request.headers.get("x-real-ip") or "").strip()
                or getattr(request.client, "host", None)
                or "anonymous"
            )
        return f"ip:{client_host}"

    @staticmethod
    def _extract_email_from_token(request):
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            return None

        token = auth_header[7:]
        try:
            parts = token.split('.')
            if len(parts) < 2:
                return None
            payload_segment = parts[1]
            padding = '=' * (-len(payload_segment) % 4)
            decoded = base64.urlsafe_b64decode(payload_segment + padding)
            payload = json.loads(decoded.decode('utf-8'))
            return str(payload.get('email') or payload.get('user_metadata', {}).get('email') or '').strip().lower() or None
        except Exception:
            return None

    async def dispatch(self, request, call_next):
        rule = RATE_LIMIT_RULES.get(request.url.path)
        if not rule:
            return await call_next(request)

        email = self._extract_email_from_token(request)
        if email == MASTER_ADMIN_EMAIL:
            return await call_next(request)

        now = time.time()
        bucket_key = f"{request.url.path}:{self._identifier(request)}"
        with RATE_LIMIT_LOCK:
            bucket = RATE_LIMIT_BUCKETS[bucket_key]
            while bucket and bucket[0] <= now - rule["window"]:
                bucket.popleft()
            if len(bucket) >= rule["limit"]:
                retry_after = max(1, int(rule["window"] - (now - bucket[0])))
                return JSONResponse(
                    {
                        "detail": rule.get("detail") or "Too many requests. Please wait a few minutes before trying again.",
                        "retry_after_seconds": retry_after,
                    },
                    status_code=429,
                    headers={
                        "Retry-After": str(retry_after),
                        "X-RateLimit-Limit": str(rule["limit"]),
                        "X-RateLimit-Window": str(rule["window"]),
                    },
                )
            bucket.append(now)

        return await call_next(request)


def _allowed_origins():
    configured = [origin.strip() for origin in (os.environ.get("CORS_ALLOW_ORIGINS") or "").split(",") if origin.strip()]
    return configured


def configure_middleware(app):
    """Register all middleware on the FastAPI app instance."""
    app.add_middleware(NoCacheAPIMiddleware)
    app.add_middleware(RateLimitAPIMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=_allowed_origins(),
        allow_origin_regex=r"^https://biqc\.ai$|^http://(localhost|127\.0\.0\.1):3000$",
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
