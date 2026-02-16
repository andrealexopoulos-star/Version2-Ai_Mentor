"""
BIQc Strategic Advisor — Application Orchestrator.
Pure routing hub: init → middleware → services → routers. No business logic.
"""
from fastapi import FastAPI, APIRouter, Depends
from fastapi.security import HTTPBearer
import os
import logging

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

# ═══ LOGGING ═══
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ═══ SUPABASE INIT ═══
supabase_admin = init_supabase()

# ═══ SERVICE INITIALIZATION ═══
services = init_services(supabase_admin)
cognitive_core = services["cognitive_core"]

# ═══ ROUTE DEPS INJECTION ═══
from routes.deps import init_route_deps
init_route_deps(supabase_admin, OPENAI_KEY, cognitive_core)

# ═══ PROMPT REGISTRY ═══
from prompt_registry import init_prompt_registry
init_prompt_registry(supabase_admin)

# ═══ APP CREATION ═══
app = FastAPI(title="Strategic Advisor API")
configure_middleware(app)
oauth = configure_oauth()

api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ═══ AUTH HELPERS (kept on server for backward-compat lazy imports from routes) ═══
from routes.deps import get_current_user

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
    return {"status": "healthy"}

@api_router.get("/")
async def api_root():
    return {"message": "Strategic Advisor API", "version": "1.0.0"}

@api_router.get("/health")
async def api_health():
    return {"status": "healthy"}


# ═══ VOICE CHAT (REALTIME) ═══
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
voice_chat = None
voice_router = APIRouter()
if OPENAI_API_KEY:
    try:
        from emergentintegrations.llm.openai import OpenAIChatRealtime
        voice_chat = OpenAIChatRealtime(api_key=OPENAI_API_KEY)
        OpenAIChatRealtime.register_openai_realtime_router(voice_router, voice_chat)
        logger.info("Voice chat initialized successfully")
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

# ═══ MOUNT ROUTERS ═══
app.include_router(api_router)
app.include_router(voice_router, prefix="/api/voice")
