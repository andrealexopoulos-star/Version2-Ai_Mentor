from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from dateutil import parser as dateutil_parser
import jwt
import bcrypt
import re
import json
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAIChatRealtime
import httpx
from authlib.integrations.starlette_client import OAuth
from urllib.parse import quote

# Import email/calendar helpers
from supabase_email_helpers import (
    store_email_supabase,
    get_user_emails_supabase,
    count_user_emails_supabase,
    delete_user_emails_supabase,
    create_sync_job_supabase,
    get_sync_job_supabase,
    update_sync_job_supabase,
    delete_user_sync_jobs_supabase,
    find_user_sync_job_supabase,
    store_calendar_events_batch_supabase,
    delete_user_calendar_events_supabase,
    get_user_calendar_events_supabase,
    find_email_by_id_supabase
)

# Import Google Drive helpers (100% Supabase)
from supabase_drive_helpers import (
    store_merge_integration,
    get_user_merge_integrations,
    get_merge_integration_by_token,
    update_merge_integration_sync,
    store_drive_file,
    store_drive_files_batch,
    get_user_drive_files,
    count_user_drive_files,
    delete_user_drive_files,
    get_drive_file_by_id
)
from regeneration_governance import request_regeneration, record_regeneration_response

# Import document helpers
from supabase_document_helpers import (
    create_document_supabase,
    get_user_documents_supabase,
    get_document_by_id_supabase,
    update_document_supabase,
    delete_document_supabase,
    count_user_documents_supabase,
    delete_user_documents_supabase
)

# Import intelligence & support helpers
from supabase_intelligence_helpers import (
    get_email_intelligence_supabase,
    update_email_intelligence_supabase,
    get_calendar_intelligence_supabase,
    update_calendar_intelligence_supabase,
    get_priority_analysis_supabase,
    update_priority_analysis_supabase,
    create_chat_message_supabase,
    get_chat_history_supabase,
    delete_user_chats_supabase,
    get_soundboard_conversation_supabase,
    update_soundboard_conversation_supabase,
    create_soundboard_conversation_supabase,
    create_data_file_supabase,
    get_user_data_files_supabase,
    count_user_data_files_supabase,
    create_analysis_supabase,
    get_user_analyses_supabase,
    get_business_profile_supabase,
    update_business_profile_supabase
)

# Import remaining collection helpers
from supabase_remaining_helpers import (
    get_onboarding_supabase,
    update_onboarding_supabase,
    get_web_sources_supabase,
    update_web_source_supabase,
    create_sop_supabase,
    get_sops_supabase,
    count_sops_supabase,
    create_invite_supabase,
    get_invite_supabase,
    delete_invite_supabase,
    create_diagnosis_supabase,
    get_diagnoses_supabase,
    get_oac_usage_supabase,
    update_oac_usage_supabase,
    get_oac_recommendations_supabase,
    update_oac_recommendations_supabase,
    get_setting_supabase,
    update_setting_supabase,
    dismiss_notification_supabase,
    get_account_supabase,
    create_account_supabase
)

# Import Cognitive Core - SUPABASE VERSION (MIGRATED)
from cognitive_core_supabase import CognitiveCore, init_cognitive_core, get_cognitive_core
from supabase_client import init_supabase, safe_query_single

# Initialize Supabase after imports
supabase_admin = init_supabase()

import base64
import io

# Document parsing imports
try:
    import PyPDF2
    from docx import Document as DocxDocument
    import openpyxl
except ImportError:
    PyPDF2 = None
    DocxDocument = None
    openpyxl = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

SERPER_API_KEY = os.environ.get("SERPER_API_KEY")

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")

# Microsoft Azure OAuth Configuration (Unified for Auth + Outlook)
AZURE_TENANT_ID = os.environ.get("AZURE_TENANT_ID", "common")
AZURE_TENANT_URL = os.environ.get("AZURE_TENANT_URL", "https://login.microsoftonline.com/common")
AZURE_CLIENT_ID = os.environ.get("AZURE_CLIENT_ID")
AZURE_CLIENT_SECRET = os.environ.get("AZURE_CLIENT_SECRET")

# Initialize Cognitive Core with Supabase
cognitive_core = init_cognitive_core(supabase_admin)
logger = logging.getLogger(__name__)
logger.info("🧠 Cognitive Core initialized with Supabase - Per-user intelligence active")

# Initialize Watchtower Store with Supabase
from watchtower_store import init_watchtower_store
watchtower_store = init_watchtower_store(supabase_admin)
logger.info("🎯 Watchtower Store initialized - Truth Engine ready")

# Initialize Watchtower Engine (V2 — Continuous Intelligence)
from watchtower_engine import init_watchtower_engine
watchtower_engine = init_watchtower_engine(supabase_admin)
logger.info("🔭 Watchtower Engine initialized - Continuous Intelligence active")

# Initialize Merge Emission Layer
try:
    from merge_client import get_merge_client
    from merge_emission_layer import init_emission_layer
    _merge = get_merge_client()
    emission_layer = init_emission_layer(supabase_admin, _merge)
    logger.info("📡 Merge Emission Layer initialized")
except Exception as _emission_init_err:
    logger.warning(f"📡 Merge Emission Layer skipped (MERGE_API_KEY not set): {_emission_init_err}")
    emission_layer = None

# Initialize Escalation Memory
from escalation_memory import init_escalation_memory
escalation_memory = init_escalation_memory(supabase_admin)
logger.info("🧠 Escalation Memory initialized")

# Initialize Contradiction Engine
from contradiction_engine import init_contradiction_engine
contradiction_engine = init_contradiction_engine(supabase_admin)
logger.info("⚡ Contradiction Engine initialized")

# Initialize Snapshot Agent
from snapshot_agent import init_snapshot_agent
snapshot_agent = init_snapshot_agent(supabase_admin)
logger.info("📸 Snapshot Agent initialized")

# Initialize Pressure Calibration
from pressure_calibration import init_pressure_calibration
pressure_calibration = init_pressure_calibration(supabase_admin)
logger.info("🎚️ Pressure Calibration initialized")

# Initialize Intelligence Baseline
from intelligence_baseline import init_intelligence_baseline
intelligence_baseline = init_intelligence_baseline(supabase_admin)
logger.info("🎯 Intelligence Baseline initialized")

# Initialize Evidence Freshness
from evidence_freshness import init_evidence_freshness
evidence_freshness = init_evidence_freshness(supabase_admin)
logger.info("⏱️ Evidence Freshness initialized")

# JWT Configuration
JWT_SECRET = os.environ['JWT_SECRET_KEY']
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# AI Configuration - AGI Ready
EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY')
OPENAI_KEY = os.environ.get('OPENAI_API_KEY')

# Initialize route dependencies — makes supabase_admin and OPENAI_KEY available to route modules
from routes.deps import init_route_deps
init_route_deps(supabase_admin, OPENAI_KEY, cognitive_core)

# Initialize Prompt Registry — fetches prompts from Supabase system_prompts table
from prompt_registry import init_prompt_registry
init_prompt_registry(supabase_admin)

# AGI-Ready Model Configuration  
AI_MODEL = "gpt-4o"  # Latest model for regular chat
AI_MODEL_ADVANCED = "gpt-4o"  # For complex analysis tasks

# File size limit (10MB)
MAX_FILE_SIZE = 10 * 1024 * 1024

app = FastAPI(title="Strategic Advisor API")

# ═══ ROOT HEALTH CHECK (must be on app, not api_router, for K8s probes) ═══
@app.get("/health")
async def root_health():
    return {"status": "healthy"}

# ═══ ANTI-CACHING MIDDLEWARE ═══
# Forces ALL API responses to include explicit no-cache headers.
# Prevents CDN, reverse proxy, and browser from caching API responses as HTML.
from starlette.middleware.base import BaseHTTPMiddleware

class NoCacheAPIMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        # Mark every response from this backend explicitly
        response.headers["X-API-Server"] = "biqc-backend"
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

app.add_middleware(NoCacheAPIMiddleware)

# CRITICAL: Add CORS middleware FIRST, before any routers
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],  # Allow all origins for development
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-API-Server"],
)

# Add session middleware for OAuth
app.add_middleware(SessionMiddleware, secret_key=os.environ['JWT_SECRET_KEY'])

# Configure OAuth
oauth = OAuth()
oauth.register(
    name='google',
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    business_name: Optional[str] = None
    industry: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    business_name: Optional[str] = None
    industry: Optional[str] = None
    role: str = "user"  # Default to "user" if None
    subscription_tier: Optional[str] = None
    is_master_account: Optional[bool] = False
    is_admin: Optional[bool] = False
    features: Optional[Dict[str, bool]] = None
    created_at: str = ""  # Allow empty string

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ChatMessage(BaseModel):
    role: str
    content: str

class AccountCreate(BaseModel):
    account_name: str

class InviteCreateRequest(BaseModel):
    email: EmailStr
    name: str
    role: str = "member"  # owner|admin|member

class InviteAcceptRequest(BaseModel):
    token: str
    temp_password: str
    new_password: str

class InviteResponse(BaseModel):
    invite_link: str
    temp_password: str
    expires_at: str

class GoogleExchangeRequest(BaseModel):
    session_id: str

class MergeLinkTokenRequest(BaseModel):
    categories: Optional[List[str]] = None

# Calibration models + WATCHTOWER_BRAIN_PROMPT + QUESTIONS_TEXT moved to routes/calibration.py

class ChatRequest(BaseModel):
    message: str
    context_type: Optional[str] = "general"
    session_id: Optional[str] = None
    # Metadata for proactive messages (Advisory Intelligence Contract)
    trigger_source: Optional[str] = None
    focus_area: Optional[str] = None
    confidence_level: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str


class BusinessProfileAutofillRequest(BaseModel):
    business_name: Optional[str] = None
    abn: Optional[str] = None

class Citation(BaseModel):
    source_type: str  # web | document | data_file | chat | analysis | diagnosis
    title: Optional[str] = None
    url: Optional[str] = None
    file_id: Optional[str] = None
    doc_id: Optional[str] = None
    snippet: Optional[str] = None

class OACItemWithWhy(BaseModel):
    title: str
    reason: Optional[str] = None
    actions: List[str] = []
    why: Optional[str] = None
    confidence: Optional[str] = None  # high | medium | low
    citations: List[Citation] = []

class BusinessProfileAutofillResponse(BaseModel):
    patch: Dict[str, Any]
    missing_fields: List[str]
    sources: Dict[str, Any]

class AnalysisCreate(BaseModel):
    title: str
    analysis_type: str
    business_context: str
    content: Optional[str] = None

class AnalysisResponse(BaseModel):
    id: str
    analysis: str  # Full text response
    insights: Optional[List[Dict[str, Any]]] = None  # Structured insights with Why + Citations
    created_at: str

class DocumentCreate(BaseModel):
    title: str
    document_type: str
    content: str
    tags: List[str] = []

class DocumentResponse(BaseModel):
    id: str
    user_id: str
    title: str
    document_type: str
    content: str
    tags: List[str]
    created_at: str
    updated_at: str

class AdminUserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None

# ==================== BUSINESS PROFILE MODELS (VERSIONED) ====================

class ConfidenceLevel(BaseModel):
    business_identity: str = "low"  # low, medium, high
    market: str = "low"
    offer: str = "low"
    team: str = "low"
    strategy: str = "low"

class ProfileScore(BaseModel):
    value: int = 0  # 0-100
    calculated_at: str
    score_version: str = "v1.0"
    explanation_summary: str = ""

class BusinessIdentityDomain(BaseModel):
    business_name: Optional[str] = None
    legal_structure: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = "Australia"
    year_founded: Optional[int] = None
    location: Optional[str] = None
    website: Optional[str] = None
    abn: Optional[str] = None
    acn: Optional[str] = None
    confidence_level: str = "low"
    completeness_percentage: int = 0
    last_updated_at: Optional[str] = None

class MarketDomain(BaseModel):
    target_customer_summary: Optional[str] = None
    primary_problem_solved: Optional[str] = None
    geography: Optional[str] = None
    business_model: Optional[str] = None
    acquisition_channels: Optional[List[str]] = None
    ideal_customer_profile: Optional[str] = None
    target_market: Optional[str] = None
    confidence_level: str = "low"
    completeness_percentage: int = 0
    last_updated_at: Optional[str] = None

class OfferDomain(BaseModel):
    products_services_summary: Optional[str] = None
    pricing_model: Optional[str] = None
    sales_cycle_length: Optional[str] = None
    value_proposition: Optional[str] = None
    competitive_advantage: Optional[str] = None
    unique_value_proposition: Optional[str] = None
    confidence_level: str = "low"
    completeness_percentage: int = 0
    last_updated_at: Optional[str] = None

class TeamDomain(BaseModel):
    team_size_range: Optional[str] = None
    key_roles_present: Optional[str] = None
    capability_strengths: Optional[str] = None
    capability_gaps: Optional[str] = None
    founder_background: Optional[str] = None
    hiring_status: Optional[str] = None
    confidence_level: str = "low"
    completeness_percentage: int = 0
    last_updated_at: Optional[str] = None

class StrategyDomain(BaseModel):
    mission: Optional[str] = None
    short_term_goals: Optional[str] = None
    long_term_goals: Optional[str] = None
    current_challenges: Optional[str] = None
    growth_approach: Optional[str] = None
    vision_statement: Optional[str] = None
    confidence_level: str = "low"
    completeness_percentage: int = 0
    last_updated_at: Optional[str] = None

class ProfileDomains(BaseModel):
    business_identity: BusinessIdentityDomain
    market: MarketDomain
    offer: OfferDomain
    team: TeamDomain
    strategy: StrategyDomain

class ChangeLogEntry(BaseModel):
    change_id: str
    change_type: str  # "created" | "updated"
    affected_domains: List[str]
    initiated_by: str
    initiated_at: str
    reason_summary: str

class VersionedBusinessProfile(BaseModel):
    profile_id: str
    business_id: str
    user_id: str
    version: str  # e.g., "v1.0", "v1.1", "v2.0"
    status: str = "active"  # "active" | "archived"
    created_at: str
    created_by: str
    last_reviewed_at: Optional[str] = None
    
    confidence_summary: ConfidenceLevel
    score: ProfileScore
    domains: ProfileDomains
    change_log: List[ChangeLogEntry] = []

# Legacy model for backward compatibility (will be deprecated)
class BusinessProfileUpdate(BaseModel):
    # Basic Info
    business_name: Optional[str] = None
    industry: Optional[str] = None
    business_type: Optional[str] = None  # LLC, Corporation, Sole Prop, etc.
    business_stage: Optional[str] = None  # idea, startup, established
    year_founded: Optional[int] = None
    website: Optional[str] = None
    location: Optional[str] = None
    abn: Optional[str] = None
    acn: Optional[str] = None
    retention_known: Optional[bool] = None
    retention_rate_range: Optional[str] = None  # e.g. "60-80%"
    retention_rag: Optional[str] = None  # green | amber | red

    
    # Size & Financials
    employee_count: Optional[str] = None  # 1-5, 6-20, 21-50, 51-200, 200+
    annual_revenue: Optional[str] = None  # Range
    monthly_expenses: Optional[str] = None
    profit_margin: Optional[str] = None
    funding_stage: Optional[str] = None  # Bootstrapped, Seed, Series A, etc.
    
    # Market & Customers
    target_market: Optional[str] = None
    target_country: Optional[str] = None  # ISO country or display name; start with Australia

    ideal_customer_profile: Optional[str] = None
    customer_segments: Optional[List[str]] = None
    geographic_focus: Optional[str] = None
    customer_acquisition_channels: Optional[List[str]] = None
    average_customer_value: Optional[str] = None
    customer_retention_rate: Optional[str] = None
    
    # Products & Services
    main_products_services: Optional[str] = None
    pricing_model: Optional[str] = None  # Subscription, One-time, Hourly, etc.
    unique_value_proposition: Optional[str] = None
    competitive_advantages: Optional[str] = None
    
    # Operations
    business_model: Optional[str] = None  # B2B, B2C, B2B2C, Marketplace
    sales_cycle_length: Optional[str] = None
    key_processes: Optional[str] = None
    bottlenecks: Optional[str] = None
    
    # Team & Leadership
    founder_background: Optional[str] = None
    key_team_members: Optional[str] = None
    team_strengths: Optional[str] = None
    team_gaps: Optional[str] = None
    company_culture: Optional[str] = None
    
    # Strategy & Goals
    mission_statement: Optional[str] = None
    vision_statement: Optional[str] = None
    core_values: Optional[List[str]] = None
    short_term_goals: Optional[str] = None  # 6-12 months
    long_term_goals: Optional[str] = None  # 2-5 years
    main_challenges: Optional[str] = None
    business_goals: Optional[str] = None
    growth_strategy: Optional[str] = None
    
    # Onboarding-specific fields
    problem_statement: Optional[str] = None
    target_customer: Optional[str] = None
    unique_value: Optional[str] = None
    operating_regions: Optional[List[str]] = None
    has_competitors: Optional[str] = None
    launch_timeline: Optional[str] = None
    biggest_challenge: Optional[str] = None
    funding_status: Optional[str] = None
    time_commitment: Optional[str] = None
    current_tools: Optional[List[str]] = None
    product_description: Optional[str] = None
    has_customers: Optional[str] = None
    revenue_range: Optional[str] = None
    fundraising_status: Optional[str] = None
    launch_date: Optional[str] = None
    years_operating: Optional[str] = None
    products_services: Optional[str] = None
    customer_count: Optional[str] = None
    growth_challenge: Optional[str] = None
    growth_goals: Optional[List[str]] = None
    exit_strategy: Optional[str] = None
    team_size: Optional[str] = None
    hiring_status: Optional[str] = None
    advice_style: Optional[str] = None
    time_availability: Optional[str] = None
    
    # Tools & Technology

# ==================== PROFILE AUTOFILL HELPERS ====================

def strip_html_to_text(html: str) -> str:
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html or "", "html.parser")

    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()

    text = soup.get_text("\n")
    lines = [ln.strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]
    return "\n".join(lines)


async def fetch_website_text(url: str) -> str:
    if not url:
        return ""
    url = url.strip()
    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.get(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; StrategySquadBot/1.0)"
        })
        if resp.status_code >= 400:
            return ""
        return strip_html_to_text(resp.text)


def compute_missing_profile_fields(profile_patch: Dict[str, Any]) -> List[str]:
    essentials = ["business_name", "industry", "business_type", "target_country", "retention_known"]
    missing = []
    for f in essentials:
        v = profile_patch.get(f)
        if v is None or (isinstance(v, str) and not v.strip()):
            missing.append(f)
    return missing

    key_metrics: Optional[List[str]] = None
    tools_used: Optional[List[str]] = None  # CRMs, accounting software, etc.
    tech_stack: Optional[str] = None
    automation_level: Optional[str] = None
    
    # Advisory Preferences
    communication_style: Optional[str] = None  # Direct, Detailed, Visual, etc.
    decision_making_style: Optional[str] = None  # Data-driven, Intuitive, Collaborative
    risk_tolerance: Optional[str] = None  # Conservative, Moderate, Aggressive
    time_availability: Optional[str] = None  # Hours per week for strategy
    preferred_advice_format: Optional[str] = None  # Action items, Analysis, Discussion
    
    # Integrations
    crm_system: Optional[str] = None
    accounting_system: Optional[str] = None
    project_management_tool: Optional[str] = None
    communication_tools: Optional[List[str]] = None

async def serper_search(query: str, gl: str = "au", hl: str = "en", num: int = 5) -> Dict[str, Any]:
    """Return {results: [...], error: str|None}. Uses Serper.dev Google Web Search."""
    if not SERPER_API_KEY:
        return {"results": [], "error": "SERPER_API_KEY not configured"}

    url = "https://google.serper.dev/search"
    payload = {
        "q": query,
        "gl": gl,
        "hl": hl,
        "num": num,
    }

    headers = {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        resp = await client.post(url, json=payload, headers=headers)
        data = {}
        try:
            data = resp.json()
        except Exception:
            data = {}

        if resp.status_code != 200:
            return {"results": [], "error": data.get("message") or data.get("error") or f"Serper HTTP {resp.status_code}"}

    organic = data.get("organic") or []
    results = []
    for i, r in enumerate(organic[:num], start=1):
        results.append({
            "title": r.get("title"),
            "link": r.get("link"),
            "snippet": r.get("snippet"),
            "position": r.get("position") or i,
        })

    return {"results": results, "error": None}


async def scrape_url_text(url: str) -> str:
    return await fetch_website_text(url)


class DataFileResponse(BaseModel):
    id: str
    user_id: str
    filename: str
    file_type: str
    category: str
    description: Optional[str]
    extracted_text: Optional[str]
    file_size: int
    created_at: str

# ==================== FILE PARSING HELPERS ====================

def extract_text_from_pdf(file_content: bytes) -> str:
    """Extract text from PDF file"""
    if not PyPDF2:
        return "[PDF parsing not available]"
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages[:20]:  # Limit to first 20 pages
            text += page.extract_text() or ""
        return text[:50000]  # Limit text length
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        return "[Could not extract PDF text]"

def extract_text_from_docx(file_content: bytes) -> str:
    """Extract text from Word document"""
    if not DocxDocument:
        return "[DOCX parsing not available]"
    try:
        doc = DocxDocument(io.BytesIO(file_content))
        text = "\n".join([para.text for para in doc.paragraphs])
        return text[:50000]
    except Exception as e:
        logger.error(f"DOCX extraction error: {e}")
        return "[Could not extract DOCX text]"

def extract_text_from_xlsx(file_content: bytes) -> str:
    """Extract text from Excel file"""
    if not openpyxl:
        return "[XLSX parsing not available]"
    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_content), data_only=True)
        text = ""
        for sheet in wb.worksheets[:5]:  # Limit to first 5 sheets
            text += f"\n--- Sheet: {sheet.title} ---\n"
            for row in sheet.iter_rows(max_row=100, values_only=True):  # Limit rows
                row_text = " | ".join([str(cell) if cell else "" for cell in row])
                if row_text.strip():
                    text += row_text + "\n"
        return text[:50000]
    except Exception as e:
        logger.error(f"XLSX extraction error: {e}")
        return "[Could not extract XLSX text]"

def extract_text_from_csv(file_content: bytes) -> str:
    """Extract text from CSV file"""
    try:
        text = file_content.decode('utf-8', errors='ignore')
        return text[:50000]
    except Exception as e:
        logger.error(f"CSV extraction error: {e}")
        return "[Could not extract CSV text]"

def extract_text_from_txt(file_content: bytes) -> str:
    """Extract text from plain text file"""
    try:
        return file_content.decode('utf-8', errors='ignore')[:50000]
    except Exception:
        return "[Could not extract text]"

async def extract_file_content(filename: str, file_content: bytes) -> str:
    """Extract text content from various file types"""
    ext = filename.lower().split('.')[-1] if '.' in filename else ''
    
    if ext == 'pdf':
        return extract_text_from_pdf(file_content)
    elif ext in ['docx', 'doc']:
        return extract_text_from_docx(file_content)
    elif ext in ['xlsx', 'xls']:
        return extract_text_from_xlsx(file_content)
    elif ext == 'csv':
        return extract_text_from_csv(file_content)
    elif ext in ['txt', 'md', 'json']:
        return extract_text_from_txt(file_content)
    else:
        return "[Unsupported file type for text extraction]"

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify password hash - returns False if hashed is None"""
    if hashed is None:
        return False
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str, account_id: Optional[str] = None) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "account_id": account_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    SUPABASE-ONLY Authentication
    Also available as routes.deps.get_current_user for route modules.
    """
    token = credentials.credentials
    
    # Validate as Supabase token ONLY
    try:
        from auth_supabase import verify_supabase_token
        user = await verify_supabase_token(token)
        if user:
            return user
        else:
            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Supabase token validation failed: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed - please log in again")

# Keep deps.py in sync — it imports the same logic
from routes.deps import get_current_user as _deps_get_current_user

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin access required")

async def get_current_account(current_user: dict = Depends(get_current_user)):
    account_id = current_user.get("account_id")
    if not account_id:
        raise HTTPException(status_code=400, detail="Account not configured")
    account = await get_account_supabase(supabase_admin, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


def get_email_domain(email: str) -> str:
    if not email or "@" not in email:
        return ""
    return email.split("@", 1)[1].lower().strip()

    return current_user

# ==================== AI HELPER ====================


def require_owner_or_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Owner/Admin access required")
    return current_user


# ═══ AI CORE — Extracted to core/ai_core.py ═══
# (get_ai_response, get_system_prompt, build_cognitive_context_for_prompt, etc.)
from core.ai_core import get_ai_response, get_system_prompt, get_business_context, build_business_knowledge_context

# ═══ VOICE CHAT (REALTIME) ═══
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
voice_chat = None
voice_router = APIRouter()
if OPENAI_API_KEY:
    try:
        voice_chat = OpenAIChatRealtime(api_key=OPENAI_API_KEY)
        OpenAIChatRealtime.register_openai_realtime_router(voice_router, voice_chat)
        logger.info("Voice chat initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize voice chat: {e}")


# ═══ AUTH — Extracted to routes/auth.py ═══
# ═══ COGNITIVE — Extracted to routes/cognitive.py ═══
# ═══ ONBOARDING — Extracted to routes/onboarding.py ═══


# ==================== FACT RESOLUTION — Extracted to routes/facts.py ====================
from routes.facts import router as facts_router
api_router.include_router(facts_router)

# ═══ API ROOT + HEALTH ═══
@api_router.get("/")
async def api_root():
    return {"message": "Strategic Advisor API", "version": "1.0.0"}

@api_router.get("/health")
async def api_health():
    return {"status": "healthy"}

# ═══ GENERATION — Extracted to routes/generation.py ═══
from routes.generation import router as generation_router
api_router.include_router(generation_router)

# ═══ PROFILE/DASHBOARD/OAC — Extracted to routes/profile.py ═══
from routes.profile import router as profile_router
api_router.include_router(profile_router)

# ═══ INTEGRATIONS — Extracted to routes/integrations.py ═══
from routes.integrations import router as integrations_router
api_router.include_router(integrations_router)

# ═══ ADMIN — Extracted to routes/admin.py ═══
from routes.admin import router as admin_router
api_router.include_router(admin_router)

# ═══ WATCHTOWER — Extracted to routes/watchtower.py ═══
from routes.watchtower import router as watchtower_router
api_router.include_router(watchtower_router)

# ═══ BOARD ROOM — Extracted to routes/boardroom.py ═══
from routes.boardroom import router as boardroom_router
api_router.include_router(boardroom_router)

# ═══ INTELLIGENCE — Extracted to routes/intelligence.py ═══
from routes.intelligence import router as intelligence_router
api_router.include_router(intelligence_router)

# ═══ RESEARCH — Extracted to routes/research.py ═══
from routes.research import router as research_router
api_router.include_router(research_router)

# ═══ SOUNDBOARD — Extracted to routes/soundboard.py ═══
from routes.soundboard import router as soundboard_router
api_router.include_router(soundboard_router)

# ═══ DATA CENTER — Extracted to routes/data_center.py ═══
from routes.data_center import router as data_center_router
api_router.include_router(data_center_router)

# ═══ CALIBRATION — Extracted to routes/calibration.py ═══
from routes.calibration import router as calibration_router
api_router.include_router(calibration_router)

# ═══ EMAIL & CALENDAR — Extracted to routes/email.py ═══
from routes.email import router as email_router
api_router.include_router(email_router)

# ═══ REGISTER ALL ROUTERS (must be AFTER all route definitions) ═══
app.include_router(api_router)
app.include_router(voice_router, prefix="/api/voice")