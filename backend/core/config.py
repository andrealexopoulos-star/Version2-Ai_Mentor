"""
Application configuration — extracted from server.py.
Middleware classes, CORS setup, and service initialization helpers.
"""
import os
import logging
import time
import hashlib
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


# ==================== REDIS RATE-LIMIT HELPERS ====================

def _get_rate_limit_redis():
    """Return the shared async Redis client for rate limiting, or None."""
    try:
        from biqc_jobs import get_redis
        return get_redis()
    except Exception:
        return None


async def _redis_sliding_window_check(redis_client, bucket_key: str, window: int, limit: int, now: float):
    """Check and record a request using Redis sorted-set sliding window.

    Returns (allowed: bool, count: int, oldest_ts: float|None).
    Raises on Redis errors so caller can fall back to in-memory.
    """
    min_score = now - window
    pipe = redis_client.pipeline()
    pipe.zremrangebyscore(bucket_key, "-inf", min_score)
    pipe.zcard(bucket_key)
    pipe.zrange(bucket_key, 0, 0, withscores=True)
    results = await pipe.execute()

    current_count = results[1]
    oldest_entry = results[2]  # list of (member, score) tuples
    oldest_ts = oldest_entry[0][1] if oldest_entry else None

    if current_count >= limit:
        return False, current_count, oldest_ts

    # Record this request — use "now:random" as member to ensure uniqueness
    member = f"{now}:{os.urandom(4).hex()}"
    pipe2 = redis_client.pipeline()
    pipe2.zadd(bucket_key, {member: now})
    pipe2.expire(bucket_key, window + 60)  # TTL slightly beyond window
    await pipe2.execute()
    return True, current_count + 1, oldest_ts

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
    "/api/auth/login": {"window": 300, "limit": 5, "detail": "Too many login attempts. Please wait a few minutes before trying again."},
    "/api/soundboard/chat": {"window": 300, "limit": 120, "detail": "Too many high-cost AI requests. Please wait a few minutes before trying again."},
    "/api/soundboard/chat/stream": {"window": 300, "limit": 120, "detail": "Too many high-cost AI requests. Please wait a few minutes before trying again."},
    "/api/boardroom/respond": {"window": 300, "limit": 20, "detail": "Too many high-cost AI requests. Please wait a few minutes before trying again."},
    "/api/voice/war-room/start": {"window": 300, "limit": 10, "detail": "Too many high-cost AI requests. Please wait a few minutes before trying again."},
    "/api/voice/war-room/respond": {"window": 300, "limit": 24, "detail": "Too many high-cost AI requests. Please wait a few minutes before trying again."},
    "/api/voice/realtime/session": {"window": 300, "limit": 8, "detail": "Too many voice session requests. Please wait a few minutes before trying again."},
    "/api/voice/realtime/negotiate": {"window": 300, "limit": 16, "detail": "Too many voice negotiation requests. Please wait a few minutes before trying again."},
}
RATE_LIMIT_BUCKETS = defaultdict(deque)  # in-memory fallback
RATE_LIMIT_LOCK = Lock()
RATE_LIMIT_REDIS_PREFIX = "biqc-ratelimit:mw:"
# Admin inbox for operational alerts (waitlist / contact form, etc.)
BIQC_ADMIN_NOTIFICATION_EMAIL = (
    os.environ.get("BIQC_ADMIN_NOTIFICATION_EMAIL") or "support@biqc.ai"
).strip()
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
RESEND_FROM_EMAIL = (
    os.environ.get("RESEND_FROM_EMAIL") or os.environ.get("BIQC_RESEND_FROM_EMAIL") or "noreply@biqc.ai"
).strip()


def _is_production_env() -> bool:
    env = (os.environ.get("ENVIRONMENT") or "").strip().lower()
    prod_flag = (os.environ.get("PRODUCTION") or "").strip().lower()
    return env == "production" or prod_flag in {"1", "true", "yes"}


# ==================== MIDDLEWARE ====================

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds security response headers to every response.

    Covers HSTS, clickjacking prevention, MIME-sniffing prevention,
    referrer policy, and permissions policy.  CSP is intentionally
    omitted — it requires careful tuning with inline styles and
    external scripts (GA4, Google Fonts, etc.).
    """

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response


class NoCacheAPIMiddleware(BaseHTTPMiddleware):
    """Forces all API responses to include explicit no-cache headers."""
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-API-Server"] = "biqc-backend"
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
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

    async def dispatch(self, request, call_next):
        rule = RATE_LIMIT_RULES.get(request.url.path)
        if not rule:
            return await call_next(request)

        now = time.time()
        bucket_key = f"{request.url.path}:{self._identifier(request)}"
        window = rule["window"]
        limit = rule["limit"]

        # --- Try Redis first (shared across instances, survives deploys) ---
        redis_client = _get_rate_limit_redis()
        if redis_client is not None:
            try:
                redis_key = f"{RATE_LIMIT_REDIS_PREFIX}{bucket_key}"
                allowed, _count, oldest_ts = await _redis_sliding_window_check(
                    redis_client, redis_key, window, limit, now,
                )
                if not allowed:
                    retry_after = max(1, int(window - (now - oldest_ts))) if oldest_ts else window
                    return JSONResponse(
                        {
                            "detail": rule.get("detail") or "Too many requests. Please wait a few minutes before trying again.",
                            "retry_after_seconds": retry_after,
                        },
                        status_code=429,
                        headers={
                            "Retry-After": str(retry_after),
                            "X-RateLimit-Limit": str(limit),
                            "X-RateLimit-Window": str(window),
                        },
                    )
                return await call_next(request)
            except Exception as exc:
                logger.debug("Redis rate-limit unavailable, falling back to in-memory: %s", exc)

        # --- In-memory fallback (original logic) ---
        with RATE_LIMIT_LOCK:
            bucket = RATE_LIMIT_BUCKETS[bucket_key]
            while bucket and bucket[0] <= now - window:
                bucket.popleft()
            if len(bucket) >= limit:
                retry_after = max(1, int(window - (now - bucket[0])))
                return JSONResponse(
                    {
                        "detail": rule.get("detail") or "Too many requests. Please wait a few minutes before trying again.",
                        "retry_after_seconds": retry_after,
                    },
                    status_code=429,
                    headers={
                        "Retry-After": str(retry_after),
                        "X-RateLimit-Limit": str(limit),
                        "X-RateLimit-Window": str(window),
                    },
                )
            bucket.append(now)

        return await call_next(request)


def _allowed_origins():
    configured = [origin.strip() for origin in (os.environ.get("CORS_ALLOW_ORIGINS") or "").split(",") if origin.strip()]
    return configured


def configure_middleware(app):
    """Register all middleware on the FastAPI app instance.

    Starlette processes middleware in reverse registration order, so the
    LAST middleware added here runs FIRST on incoming requests.  The
    order below ensures:
      SessionMiddleware → CORS → SecurityHeaders → TierGuard → RateLimit → NoCache
    """
    from middleware.tier_guard import TierGuardMiddleware

    app.add_middleware(NoCacheAPIMiddleware)
    app.add_middleware(RateLimitAPIMiddleware)
    app.add_middleware(TierGuardMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=_allowed_origins(),
        allow_origin_regex=(
            r"^https://biqc\.ai$"
            if _is_production_env()
            else r"^https://biqc\.ai$|^https://biqc-web-dev\.azurewebsites\.net$|^http://(localhost|127\.0\.0\.1):3000$"
        ),
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
