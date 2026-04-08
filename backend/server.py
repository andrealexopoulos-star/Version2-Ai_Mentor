"""
BIQc Strategic Advisor — Application Orchestrator.
Pure routing hub: init → middleware → services → routers. No business logic.
"""
from fastapi import FastAPI, APIRouter, Depends, Request
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer
from fastapi.staticfiles import StaticFiles
import os
import logging
from contextlib import suppress

from supabase_client import init_supabase
from core.config import configure_middleware, configure_oauth, init_services, OPENAI_KEY
from core.ai_core import get_ai_response, get_system_prompt, get_business_context, build_business_knowledge_context
from core.helpers import (
    hash_password, verify_password, create_token, get_email_domain,
    fetch_website_text, compute_missing_profile_fields, serper_search,
    scrape_url_text, extract_file_content,
)
from core.models import (
    UserCreate, UserLogin, UserResponse, TokenResponse,
    ChatMessage, AccountCreate,
    InviteCreateRequest, InviteAcceptRequest, InviteResponse,
    GoogleExchangeRequest, MergeLinkTokenRequest,
    ChatRequest, ChatResponse,
    BusinessProfileAutofillRequest, BusinessProfileAutofillResponse,
    Citation, OACItemWithWhy,
    AnalysisCreate, AnalysisResponse,
    DocumentCreate, DocumentResponse,
    AdminUserUpdate, BusinessProfileUpdate, DataFileResponse,
    ConfidenceLevel, ProfileScore,
    BusinessIdentityDomain, MarketDomain, OfferDomain, TeamDomain, StrategyDomain,
    ProfileDomains, ChangeLogEntry, VersionedBusinessProfile,
)
app = FastAPI()
# ═══ LOGGING ═══
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ═══ RUNTIME STATE (LAZY INIT FOR AZURE STARTUP STABILITY) ═══
supabase_admin = None
services = {}
cognitive_core = None


def _initialize_core_runtime() -> None:
    """Initialize optional runtime services without blocking app boot."""
    global supabase_admin, services, cognitive_core

    try:
        supabase_admin = init_supabase()
    except Exception as exc:
        supabase_admin = None
        logger.warning("Supabase initialization skipped during startup: %s", exc)

    try:
        from routes.deps import init_route_deps
        init_route_deps(supabase_admin, OPENAI_KEY, None)
    except Exception as exc:
        logger.warning("Route dependency initialization skipped: %s", exc)

    if not supabase_admin:
        services = {}
        cognitive_core = None
        return

    try:
        services = init_services(supabase_admin) or {}
        cognitive_core = services.get("cognitive_core")
    except Exception as exc:
        services = {}
        cognitive_core = None
        logger.warning("Optional service initialization skipped during startup: %s", exc)

    try:
        from routes.deps import init_route_deps
        init_route_deps(supabase_admin, OPENAI_KEY, cognitive_core)
    except Exception as exc:
        logger.warning("Route dependency refresh skipped: %s", exc)

    try:
        from prompt_registry import init_prompt_registry
        init_prompt_registry(supabase_admin)
    except Exception as exc:
        logger.warning("Prompt registry initialization skipped: %s", exc)

# ═══ APP CREATION ═══
app = FastAPI(title="Strategic Advisor API")
configure_middleware(app)
oauth = configure_oauth()

api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ═══ AUTH HELPERS (kept on server for backward-compat lazy imports from routes) ═══
from routes.deps import get_current_user
from biqc_jobs import biqc_jobs
from jobs.enrichment_worker import start_enrichment_worker, stop_enrichment_worker

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    from fastapi import HTTPException
    if current_user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin access required")

async def get_current_account(current_user: dict = Depends(get_current_user)):
    from fastapi import HTTPException
    from supabase_remaining_helpers import get_account_supabase
    account_id = current_user.get("account_id")
    if not account_id:
        raise HTTPException(status_code=400, detail="Account not configured")
    account = await get_account_supabase(supabase_admin, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account

def require_owner_or_admin(current_user: dict = Depends(get_current_user)):
    from fastapi import HTTPException
    if current_user.get("role") not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Owner/Admin access required")
    return current_user

# Keep deps.py in sync
from routes.deps import get_current_user as _deps_get_current_user


# ═══ HEALTH CHECKS ═══

@app.get("/health")
async def root_health():
    return {"status": "healthy", "legacy_status": "ok"}

@api_router.get("/")
async def api_root():
    return {"message": "Strategic Advisor API", "version": "1.0.0"}

@api_router.get("/health")
async def api_health():
    return {"status": "healthy", "legacy_status": "ok"}


@app.post("/integrations/merge/webhook")
async def merge_webhook_root_fallback(request: Request):
    """Root-level fallback for Merge webhook — no /api prefix."""
    from routes.integrations import merge_webhook_receive
    return await merge_webhook_receive(request)


@app.on_event("startup")
async def startup_core_runtime():
    _initialize_core_runtime()
    app.state.supabase_admin = supabase_admin
    app.state.services = services
    app.state.cognitive_core = cognitive_core


@app.on_event("startup")
async def startup_redis_runtime():
    """Initialize Redis client for job enqueue only. Worker runs in biqc_job_worker.py."""
    try:
        await biqc_jobs.initialize()
    except Exception as exc:
        logger.warning("Redis runtime skipped during startup: %s", exc)
    app.state.biqc_jobs = biqc_jobs


@app.on_event("shutdown")
async def shutdown_redis_runtime():
    with suppress(Exception):
        await biqc_jobs.shutdown()


@app.on_event("startup")
async def startup_enrichment_worker_runtime():
    try:
        start_enrichment_worker()
    except Exception as exc:
        logger.warning("Enrichment worker skipped during startup: %s", exc)


@app.on_event("shutdown")
async def shutdown_enrichment_worker_runtime():
    with suppress(Exception):
        await stop_enrichment_worker()


# ═══ VOICE CHAT (REALTIME) — Direct OpenAI routing ═══
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
voice_router = APIRouter()
if OPENAI_API_KEY:
    try:
        from core.llm_router import llm_realtime_session
        from core.advisor_response_style import (
            build_advisor_style_guidance,
            build_flagship_response_contract_text,
        )

        @voice_router.post("/realtime/session")
        async def create_voice_session(request: Request):
            """Create realtime session WITH business context instructions."""
            from fastapi.responses import JSONResponse
            from supabase_client import init_supabase
            import supabase_client

            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                return JSONResponse(content={"error": "Missing or invalid Authorization header"}, status_code=401)
            token = auth_header[7:]

            try:
                init_supabase()
                supabase_admin = supabase_client.supabase_admin
                user_resp = supabase_admin.auth.get_user(token)
                if not user_resp or not user_resp.user:
                    return JSONResponse(content={"error": "Invalid token"}, status_code=401)
            except Exception:
                return JSONResponse(content={"error": "Authentication failed"}, status_code=401)

            user_id = user_resp.user.id
            fallback_contract = build_flagship_response_contract_text()
            instructions = (
                "You are a Strategic Intelligence Advisor for an Australian business. "
                "Be direct, specific, and reference the user's business data. Never give generic advice.\n\n"
                f"[RESPONSE CONTRACT]\n{fallback_contract}"
            )
            try:
                profile_result = supabase_admin.table('business_profiles').select(
                    'business_name,industry,revenue_range,team_size,main_challenges,short_term_goals'
                ).eq('user_id', user_id).execute()
                profile = profile_result.data[0] if profile_result.data else None
                if profile:
                    biz_name = profile.get('business_name', 'their business')
                    first_name = (user_resp.user.user_metadata or {}).get("full_name", "").split(" ")[0] if user_resp.user.user_metadata else "there"
                    style_block = build_advisor_style_guidance(first_name, biz_name)
                    response_contract = build_flagship_response_contract_text()
                    instructions = f"""You are a Strategic Intelligence Advisor inside BIQc, speaking with the owner of {biz_name}.

Business: {biz_name}
Industry: {profile.get('industry', '')}
Revenue: {profile.get('revenue_range', '')}
Team: {profile.get('team_size', '')}
Challenges: {profile.get('main_challenges', '')}
Goals: {profile.get('short_term_goals', '')}

Rules:
- Be direct and specific. Reference their business name, numbers, and industry.
- You have access to their business intelligence platform data. Use it.
- Never say you can't access their data. You ARE their intelligence system.
- Give concrete recommendations with timeframes.
- Keep your tone conversational, practical, and familiar — like someone they trust.

[RESPONSE CONTRACT]
{response_contract}

[STYLE GUIDANCE]
{style_block}"""
            except Exception as e:
                logger.debug(f"Voice session context enrichment: {e}")

            result = await llm_realtime_session(voice="verse", instructions=instructions, api_key=OPENAI_API_KEY)
            return JSONResponse(content=result)

        @voice_router.post("/realtime/negotiate")
        async def negotiate_voice(request: Request):
            """Handles WebRTC negotiation via direct OpenAI API."""
            from core.llm_router import llm_realtime_negotiate
            from fastapi.responses import JSONResponse
            from supabase_client import init_supabase
            import supabase_client

            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                return JSONResponse(content={"error": "Missing or invalid Authorization header"}, status_code=401)
            token = auth_header[7:]

            try:
                init_supabase()
                supabase_admin = supabase_client.supabase_admin
                user_resp = supabase_admin.auth.get_user(token)
                if not user_resp or not user_resp.user:
                    return JSONResponse(content={"error": "Invalid token"}, status_code=401)
            except Exception:
                return JSONResponse(content={"error": "Authentication failed"}, status_code=401)

            sdp_offer = await request.body()
            sdp_answer = await llm_realtime_negotiate(sdp_offer.decode(), api_key=OPENAI_API_KEY)
            return JSONResponse(content={"sdp": sdp_answer})

        logger.info("Voice chat initialized (direct OpenAI routing)")
    except Exception as e:
        logger.error(f"Failed to initialize voice chat: {e}")


# ═══ ROUTER REGISTRATION ═══

from routes.auth import router as auth_router
api_router.include_router(auth_router)

from routes.cognitive import router as cognitive_router
api_router.include_router(cognitive_router)

from routes.onboarding import router as onboarding_router
api_router.include_router(onboarding_router)

from routes.facts import router as facts_router
api_router.include_router(facts_router)

from routes.generation import router as generation_router
api_router.include_router(generation_router)

from routes.profile import router as profile_router
api_router.include_router(profile_router)

from routes.integrations import router as integrations_router
api_router.include_router(integrations_router)

from routes.admin import router as admin_router
api_router.include_router(admin_router)

from routes.pricing_admin import router as pricing_admin_router
api_router.include_router(pricing_admin_router)

from routes.watchtower import router as watchtower_router
api_router.include_router(watchtower_router)

from routes.boardroom import router as boardroom_router
api_router.include_router(boardroom_router)

from routes.intelligence import router as intelligence_router
api_router.include_router(intelligence_router)

from routes.research import router as research_router
api_router.include_router(research_router)

from routes.soundboard import router as soundboard_router
api_router.include_router(soundboard_router)

from routes.data_center import router as data_center_router
api_router.include_router(data_center_router)

from routes.calibration import router as calibration_router
api_router.include_router(calibration_router)

from routes.email import router as email_router
api_router.include_router(email_router)

from routes.health import router as health_router, warmup_edge_functions
api_router.include_router(health_router)


@api_router.get("/warmup")
async def warmup_compat():
    """Backwards-compatible alias for legacy /api/warmup callers."""
    return await warmup_edge_functions()

from routes.intelligence_actions import router as intelligence_actions_router
api_router.include_router(intelligence_actions_router)

from routes.strategic_console import router as strategic_console_router
api_router.include_router(strategic_console_router)

from routes.reports import router as reports_router
api_router.include_router(reports_router)

from routes.intelligence_modules import router as intelligence_modules_router
api_router.include_router(intelligence_modules_router)

from routes.forensic_audit import router as forensic_audit_router
api_router.include_router(forensic_audit_router)

from routes.ingestion_engine import router as ingestion_engine_router
api_router.include_router(ingestion_engine_router)

from routes.hybrid_ingestion import router as hybrid_ingestion_router
api_router.include_router(hybrid_ingestion_router)

from routes.engagement_engine import router as engagement_engine_router
api_router.include_router(engagement_engine_router)

from routes.stripe_payments import router as stripe_payments_router
api_router.include_router(stripe_payments_router)

from routes.billing import router as billing_router
api_router.include_router(billing_router)

from routes.ux_feedback import router as ux_feedback_router
api_router.include_router(ux_feedback_router)

from routes.deferred_integrations import router as deferred_integrations_router
api_router.include_router(deferred_integrations_router)

from routes.scope_checkpoints import router as scope_checkpoints_router
api_router.include_router(scope_checkpoints_router)

from routes.spine_api import router as spine_api_router
api_router.include_router(spine_api_router)

from routes.dsee import router as dsee_router
api_router.include_router(dsee_router)

from routes.memory_agent import router as memory_router
api_router.include_router(memory_router)

from routes.marketing_intel import router as marketing_intel_router
api_router.include_router(marketing_intel_router)

from routes.rag_service import router as rag_router
api_router.include_router(rag_router)

from routes.marketing_automation import router as marketing_auto_router
api_router.include_router(marketing_auto_router)

from routes.platform_services import router as platform_services_router
api_router.include_router(platform_services_router)

from routes.super_admin import router as super_admin_router
api_router.include_router(super_admin_router)

from routes.file_service import router as file_service_router
api_router.include_router(file_service_router)

from routes.advanced_intelligence import router as advanced_intel_router
api_router.include_router(advanced_intel_router)

from routes.unified_intelligence import router as unified_intel_router
api_router.include_router(unified_intel_router)

from routes.cognition_contract import router as cognition_router
api_router.include_router(cognition_router)

from routes.tutorials import router as tutorials_router
api_router.include_router(tutorials_router)

from routes.business_brain import router as business_brain_router
api_router.include_router(business_brain_router)


# ═══ MOUNT ROUTERS ═══
app.include_router(api_router)
app.include_router(voice_router, prefix="/api/voice")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port)
# This part tells the brain to show the website files
if os.path.exists("frontend/build"):
    app.mount("/", StaticFiles(directory="frontend/build", html=True), name="frontend")
    @app.get("/{catchall:path}")
    async def serve_frontend(catchall: str):
        return FileResponse("frontend/build/index.html")
