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

# ==================== AUTH ROUTES ====================

# ==================== SUPABASE AUTH ROUTES (NEW) ====================
# Import Supabase auth functions
from auth_supabase import (
    signup_with_email,
    signin_with_email,
    get_oauth_url,
    get_current_user_supabase,
    get_current_user_from_request,
    get_user_by_id,
    SignUpRequest,
    SignInRequest
)

@api_router.post("/auth/supabase/signup")
async def supabase_signup(request: SignUpRequest):
    """
    New Supabase-based signup endpoint
    """
    return await signup_with_email(request)

@api_router.post("/auth/supabase/login")
async def supabase_login(request: SignInRequest):
    """
    New Supabase-based login endpoint
    """
    return await signin_with_email(request)

@api_router.get("/auth/supabase/oauth/{provider}")
async def supabase_oauth(provider: str, redirect_to: Optional[str] = None):
    """
    Get OAuth URL for Google or Azure sign-in via Supabase
    """
    return await get_oauth_url(provider, redirect_to)

@api_router.get("/auth/supabase/me")
async def supabase_get_me(current_user: dict = Depends(get_current_user_supabase)):
    """
    Get current authenticated user (Supabase version)
    """
    return {
        "user": current_user,
        "message": "Authenticated via Supabase"
    }

@api_router.get("/auth/check-profile")
async def check_user_profile(current_user: dict = Depends(get_current_user_supabase)):
    """Calibration-first profile check used by AuthCallbackSupabase.
    Single source of truth: user_operator_profile.persona_calibration_status"""
    try:
        user_id = current_user["id"]
        user_profile = await get_user_by_id(user_id)
        business_profile = await get_business_profile_supabase(supabase_admin, user_id)

        # Check calibration from user_operator_profile ONLY
        calibration_complete = False
        try:
            op_result = safe_query_single(
                supabase_admin.table("user_operator_profile").select(
                    "persona_calibration_status"
                ).eq("user_id", user_id)
            )
            if op_result.data and op_result.data.get("persona_calibration_status") == "complete":
                calibration_complete = True
        except RuntimeError as e:
            logger.error(f"FATAL: auth/check-profile SDK error: {e}")
            raise HTTPException(status_code=500, detail="Internal SDK error")
        except Exception:
            pass

        calibration_status = "complete" if calibration_complete else "incomplete"
        needs_onboarding = not calibration_complete
        onboarding_status = "complete" if calibration_complete else "calibration_required"

        return {
            "profile_exists": bool(user_profile),
            "needs_onboarding": needs_onboarding,
            "user": {
                "id": user_profile.get("id") if user_profile else user_id,
                "email": user_profile.get("email") if user_profile else current_user.get("email"),
                "full_name": user_profile.get("full_name", "") if user_profile else "",
                "company_name": business_profile.get("business_name") if business_profile else None,
                "account_id": business_profile.get("account_id") if business_profile else None,
                "business_profile_id": business_profile.get("id") if business_profile else None
            },
            "onboarding_status": onboarding_status,
            "calibration_status": calibration_status,
            "has_business_profile": business_profile is not None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking user profile: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check profile: {str(e)}")



# ═══ CALIBRATION — Extracted to routes/calibration.py ═══
# (12 routes: status, defer, reset, lifecycle, console, enrichment, init, answer, activation, brain, regeneration)

# ═══ EMAIL & CALENDAR — Extracted to routes/email.py ═══
# (18+ routes: outlook/gmail OAuth, email sync, intelligence, priority, calendar)




# ═══ SOUNDBOARD — Extracted to routes/soundboard.py ═══

# ==================== COGNITIVE CORE ENDPOINTS ====================

@api_router.get("/cognitive/profile")
async def get_cognitive_profile(current_user: dict = Depends(get_current_user)):
    """Get the user's cognitive profile (for debugging/admin only)"""
    profile = await cognitive_core.get_profile(current_user["id"])
    # Remove internal fields
    if profile:
        profile.pop("_id", None)
    return {"profile": profile}


@api_router.post("/cognitive/sync-business-profile")
async def sync_business_to_cognitive(current_user: dict = Depends(get_current_user)):
    """Sync business profile data to cognitive core reality model"""
    user_id = current_user["id"]
    
    # Get business profile
    profile = await get_business_profile_supabase(supabase_admin, user_id)
    
    if not profile:
        return {"status": "no_profile", "message": "No business profile found to sync"}
    
    # Map business profile fields to cognitive core reality model
    reality_update = {
        "type": "reality_update",
        "business_type": profile.get("business_type"),
        "industry": profile.get("industry"),
        "revenue_model": profile.get("business_model"),
        "team_size": profile.get("team_size"),
        "years_operating": profile.get("years_in_business")
    }
    
    # Infer maturity from years
    years = profile.get("years_in_business")
    if years:
        try:
            y = int(years)
            if y < 1:
                reality_update["business_maturity"] = "idea"
            elif y < 3:
                reality_update["business_maturity"] = "early"
            elif y < 7:
                reality_update["business_maturity"] = "growth"
            else:
                reality_update["business_maturity"] = "mature"
        except:
            pass
    
    # Infer cashflow sensitivity from revenue
    revenue = profile.get("annual_revenue", "")
    if revenue:
        rev_lower = revenue.lower()
        if "under" in rev_lower or "<50" in rev_lower or "0-" in rev_lower:
            reality_update["cashflow_sensitivity"] = "high"
        elif "50" in rev_lower or "100" in rev_lower:
            reality_update["cashflow_sensitivity"] = "medium"
        else:
            reality_update["cashflow_sensitivity"] = "low"
    
    # Update cognitive core
    await cognitive_core.observe(user_id, reality_update)
    
    return {"status": "synced", "fields_updated": [k for k, v in reality_update.items() if v is not None]}


@api_router.get("/cognitive/escalation")
async def get_escalation_state(
    topic: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the current escalation state for this user.
    
    Escalation is evidence-based:
    - Level 0 (Normal): Balanced tone, standard urgency
    - Level 1 (Elevated): Direct tone, reduced options
    - Level 2 (High): Firm tone, minimal options, critical focus
    - Level 3 (Critical): Urgent tone, survival focus, no options
    """
    topic_tags = [topic] if topic else None
    escalation = await cognitive_core.calculate_escalation_state(current_user["id"], topic_tags)
    
    return escalation


@api_router.post("/cognitive/observe")
async def record_observation(
    observation: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Record an observation for the cognitive core (for frontend integration)"""
    user_id = current_user["id"]
    
    # Validate observation type
    valid_types = ["message", "action", "decision", "avoidance", "outcome", "sentiment", "timing"]
    if observation.get("type") not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid observation type. Must be one of: {valid_types}")
    
    await cognitive_core.observe(user_id, observation)
    
    return {"status": "recorded"}


# ==================== ADVISORY LOG ENDPOINTS ====================

class RecommendationLog(BaseModel):
    situation: str
    recommendation: str
    reason: str
    expected_outcome: str
    topic_tags: Optional[List[str]] = None
    urgency: Optional[str] = "normal"
    confidence: Optional[str] = None  # high, medium, low - auto-calculated if not provided
    confidence_factors: Optional[List[str]] = None


class RecommendationOutcome(BaseModel):
    recommendation_id: str
    status: str  # acted, ignored, partially_acted
    actual_outcome: Optional[str] = None
    notes: Optional[str] = None


@api_router.get("/advisory/confidence")
async def get_current_confidence(
    topic: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the current confidence level for giving advice to this user.
    Confidence is based on data coverage across all cognitive layers.
    """
    topic_tags = [topic] if topic else None
    confidence = await cognitive_core.calculate_confidence(current_user["id"], topic_tags)
    
    return confidence


@api_router.post("/advisory/log")
async def log_advisory_recommendation(
    log: RecommendationLog,
    current_user: dict = Depends(get_current_user)
):
    """
    Log a recommendation with full context and confidence classification.
    Every recommendation must be internally logged with:
    - The situation it addresses
    - The reason it was recommended
    - The expected outcome
    - The confidence level
    """
    # Auto-calculate confidence if not provided
    confidence = log.confidence
    confidence_factors = log.confidence_factors or []
    
    if not confidence:
        conf_data = await cognitive_core.calculate_confidence(
            current_user["id"], 
            log.topic_tags
        )
        confidence = conf_data.get("level", "medium")
        confidence_factors = conf_data.get("limiting_factors", [])
    
    recommendation_id = await cognitive_core.log_recommendation(
        user_id=current_user["id"],
        agent="MyAdvisor",
        situation=log.situation,
        recommendation=log.recommendation,
        reason=log.reason,
        expected_outcome=log.expected_outcome,
        topic_tags=log.topic_tags,
        urgency=log.urgency,
        confidence=confidence,
        confidence_factors=confidence_factors
    )
    
    return {
        "status": "logged",
        "recommendation_id": recommendation_id,
        "confidence": confidence,
        "confidence_factors": confidence_factors
    }


@api_router.post("/advisory/outcome")
async def record_advisory_outcome(
    outcome: RecommendationOutcome,
    current_user: dict = Depends(get_current_user)
):
    """
    Record whether advice was acted on and what happened.
    Future guidance will consider whether similar advice succeeded or failed.
    """
    await cognitive_core.record_recommendation_outcome(
        recommendation_id=outcome.recommendation_id,
        status=outcome.status,
        actual_outcome=outcome.actual_outcome,
        notes=outcome.notes
    )
    
    # If ignored, check if escalation is needed
    if outcome.status == "ignored":
        new_level = await cognitive_core.escalate_ignored_advice(outcome.recommendation_id)
        urgency_labels = ["normal", "elevated", "critical"]
        return {
            "status": "recorded",
            "escalated": True,
            "new_urgency": urgency_labels[new_level]
        }
    
    return {"status": "recorded", "escalated": False}


@api_router.get("/advisory/history")
async def get_advisory_history(
    topic: Optional[str] = None,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get the advisory log for this user."""
    query = supabase_admin.table("advisory_log").select("*").eq("user_id", current_user["id"])

    if topic:
        query = query.contains("topic_tags", [topic])

    result = query.order("created_at", desc=True).limit(limit).execute()
    history = result.data if result.data else []
    
    # Calculate stats
    total = len(history)
    acted = sum(1 for h in history if h.get("status") == "acted")
    ignored = sum(1 for h in history if h.get("status") == "ignored")
    pending = sum(1 for h in history if h.get("status") == "pending")
    
    return {
        "history": history,
        "stats": {
            "total": total,
            "acted": acted,
            "ignored": ignored,
            "pending": pending,
            "action_rate": round(acted / (acted + ignored), 2) if (acted + ignored) > 0 else None
        }
    }


@api_router.get("/advisory/escalations")
async def get_escalated_advice(current_user: dict = Depends(get_current_user)):
    """
    Get advice that has been repeatedly ignored and needs attention.
    Repeatedly ignored advice must escalate in clarity or urgency.
    """
    escalations = await cognitive_core.get_ignored_advice_for_escalation(current_user["id"])
    
    return {
        "escalations": escalations,
        "count": len(escalations)
    }


# ==================== INVITES (ENTERPRISE ONLY) ====================

def tier_allows_seats(account: dict) -> bool:
    # Per your instruction: only Enterprise can create users
    return (account.get("subscription_tier") or "").lower() == "enterprise"


def generate_temp_password() -> str:
    # Simple temp password (shown once)
    return f"Temp!{uuid.uuid4().hex[:10]}"


@api_router.post("/account/users/invite", response_model=InviteResponse)
async def invite_user(req: InviteCreateRequest, current_user: dict = Depends(require_owner_or_admin), account: dict = Depends(get_current_account)):
    if not tier_allows_seats(account):
        raise HTTPException(status_code=403, detail="User seats are available on Enterprise only")

    # Enforce same-domain (enterprise policy)
    owner_domain = get_email_domain(account.get("email"))
    invite_domain = get_email_domain(req.email)
    if owner_domain and invite_domain and owner_domain != invite_domain:
        raise HTTPException(status_code=400, detail="Invited user must use the same email domain as the account")

    # Check if email already exists in Supabase (MongoDB removed)
    try:
        existing_user = supabase_admin.table("users").select("id, email").eq("email", req.email.lower().strip()).execute()
        if existing_user.data and len(existing_user.data) > 0:
            raise HTTPException(status_code=400, detail="Email already exists")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking existing user: {e}")
        # Continue - allow creation attempt

    now = datetime.now(timezone.utc)
    token = uuid.uuid4().hex
    temp_password = generate_temp_password()

    invite = {
        "id": str(uuid.uuid4()),
        "account_id": account["id"],
        "email": req.email.lower().strip(),
        "name": req.name,
        "role": req.role if req.role in {"member", "admin"} else "member",
        "token": token,
        "temp_password_hash": hash_password(temp_password),
        "expires_at": (now + timedelta(days=7)).isoformat(),
        "created_at": now.isoformat(),
    }
    await create_invite_supabase(supabase_admin, invite)

    invite_link = f"/invite/accept?token={token}"
    return InviteResponse(invite_link=invite_link, temp_password=temp_password, expires_at=invite["expires_at"])


@api_router.post("/account/users/accept", response_model=TokenResponse)
async def accept_invite(req: InviteAcceptRequest):
    invite = await get_invite_supabase(supabase_admin, req.token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    now = datetime.now(timezone.utc)
    try:
        exp = datetime.fromisoformat(invite["expires_at"])
        if exp < now:
            raise HTTPException(status_code=400, detail="Invite expired")
    except Exception:
        raise HTTPException(status_code=400, detail="Invite expired")

    if not verify_password(req.temp_password, invite["temp_password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid temporary password")

    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user_id = str(uuid.uuid4())
    created_at = now.isoformat()
    user_doc = {
        "id": user_id,
        "email": invite["email"],
        "password": hash_password(req.new_password),
        "name": invite.get("name") or "User",
        "business_name": None,
        "industry": None,
        "subscription_tier": "free",
        "subscription_started_at": created_at,
        "role": invite.get("role") or "member",
        "account_id": invite["account_id"],
        "is_active": True,
        "created_at": created_at,
        "updated_at": created_at,
        "auth_provider": "invite",
    }

    user_profile = {
        "id": user_id,
        "email": invite["email"],
        "full_name": invite.get("name") or "User",
        "company_name": None,
        "industry": None,
        "role": invite.get("role") or "member",
        "subscription_tier": "free",
        "subscription_started_at": created_at,
        "account_id": invite["account_id"],
        "is_master_account": False,
        "created_at": created_at,
        "updated_at": created_at
    }

    insert_result = supabase_admin.table("users").insert(user_profile).execute()
    if not insert_result.data:
        raise HTTPException(status_code=500, detail="Failed to create user profile")

    # Consume invite
    await delete_invite_supabase(supabase_admin, invite["token"])

    access_token = create_token(user_id, user_doc["email"], user_doc["role"], account_id=user_doc.get("account_id"))
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user_id,
            email=user_doc["email"],
            name=user_doc["name"],
            business_name=None,
            industry=None,
            role=user_doc["role"],
            subscription_tier=user_doc.get("subscription_tier"),
            created_at=user_doc["created_at"],
        ),
    )

# ==================== ONBOARDING MODELS ====================

class OnboardingSave(BaseModel):
    current_step: int
    business_stage: Optional[str] = None
    data: Dict[str, Any]
    completed: bool = False

class OnboardingStatusResponse(BaseModel):
    completed: bool
    current_step: Optional[int] = None
    business_stage: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

# ==================== ONBOARDING ROUTES ====================

async def _read_onboarding_state(user_id: str) -> dict:
    """Read onboarding state from user_operator_profile.operator_profile.onboarding_state (authoritative).
    Falls back to onboarding table for migration, then writes back to user_operator_profile."""
    # PRIMARY: Read from user_operator_profile
    try:
        op_result = supabase_admin.table("user_operator_profile").select(
            "operator_profile"
        ).eq("user_id", user_id).maybe_single().execute()
        
        if op_result.data:
            op = op_result.data.get("operator_profile") or {}
            ob_state = op.get("onboarding_state")
            if ob_state is not None:
                return ob_state
    except Exception as e:
        logger.warning(f"[onboarding] user_operator_profile read failed: {e}")
    
    # FALLBACK: Read from legacy onboarding table, then migrate
    onboarding = await get_onboarding_supabase(supabase_admin, user_id)
    if onboarding:
        state = {
            "completed": onboarding.get("completed", False),
            "current_step": onboarding.get("current_step", 0),
            "business_stage": onboarding.get("business_stage"),
            "data": onboarding.get("onboarding_data", {})
        }
        # Migrate to user_operator_profile
        await _write_onboarding_state(user_id, state)
        return state
    
    return None


async def _write_onboarding_state(user_id: str, state: dict):
    """Write onboarding state to user_operator_profile.operator_profile.onboarding_state."""
    try:
        op_result = supabase_admin.table("user_operator_profile").select(
            "operator_profile"
        ).eq("user_id", user_id).maybe_single().execute()
        
        if op_result.data:
            existing_op = op_result.data.get("operator_profile") or {}
            existing_op["onboarding_state"] = state
            supabase_admin.table("user_operator_profile").update({
                "operator_profile": existing_op,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("user_id", user_id).execute()
        else:
            supabase_admin.table("user_operator_profile").insert({
                "user_id": user_id,
                "operator_profile": {"onboarding_state": state},
                "persona_calibration_status": "incomplete"
            }).execute()
    except Exception as e:
        logger.error(f"[onboarding] user_operator_profile write failed: {e}")
    
    # Also keep onboarding table in sync for backward compat
    try:
        await update_onboarding_supabase(supabase_admin, user_id, {
            "current_step": state.get("current_step", 0),
            "business_stage": state.get("business_stage"),
            "onboarding_data": state.get("data", {}),
            "completed": state.get("completed", False)
        })
    except Exception:
        pass


@api_router.get("/onboarding/status", response_model=OnboardingStatusResponse)
async def get_onboarding_status(current_user: dict = Depends(get_current_user)):
    """Check if user has completed onboarding.
    Authoritative source: user_operator_profile.operator_profile.onboarding_state
    No auto-complete. No heuristics."""
    user_id = current_user["id"]
    
    state = await _read_onboarding_state(user_id)
    
    if not state:
        return OnboardingStatusResponse(
            completed=False,
            current_step=0,
            business_stage=None,
            data={}
        )
    
    return OnboardingStatusResponse(
        completed=state.get("completed", False),
        current_step=state.get("current_step", 0),
        business_stage=state.get("business_stage"),
        data=state.get("data", {})
    )

@api_router.post("/onboarding/save")
async def save_onboarding_progress(
    request: OnboardingSave,
    current_user: dict = Depends(get_current_user)
):
    """Save onboarding progress to user_operator_profile (authoritative).
    Also persists answered fields to the fact_ledger and business_profiles."""
    from fact_resolution import persist_facts_batch, ONBOARDING_FIELD_TO_FACT
    
    user_id = current_user["id"]
    
    # Read current state to enforce anti-regression
    current_state = await _read_onboarding_state(user_id)
    current_step_saved = current_state.get("current_step", 0) if current_state else 0
    
    new_step = request.current_step
    if new_step < current_step_saved and new_step != 0:
        new_step = current_step_saved
    
    new_state = {
        "current_step": new_step,
        "business_stage": request.business_stage,
        "data": request.data,
        "completed": request.completed
    }
    
    await _write_onboarding_state(user_id, new_state)
    
    if request.data:
        # Persist to business_profiles
        profile_fields = {}
        field_mapping = {
            "business_name": "business_name",
            "industry": "industry",
            "business_stage": None,
            "abn": "abn",
            "website": "website",
            "products_services": "products_services",
            "business_model": "business_model",
            "target_customer": "ideal_customer_profile",
            "unique_value": "unique_value_proposition",
            "team_size": "team_size",
            "hiring_status": "hiring_status",
            "revenue_range": "revenue_range",
            "customer_count": "customer_count",
            "growth_challenge": "main_challenges",
            "years_operating": "years_operating",
            "location": "location",
            "geographic_focus": "geographic_focus",
            "product_description": "products_services",
            "problem_statement": "mission_statement",
            "growth_goals": "short_term_goals",
            "funding_status": "funding_status",
            "funding_stage": "funding_stage",
        }
        
        for src_field, dest_field in field_mapping.items():
            if dest_field and src_field in request.data and request.data[src_field]:
                val = request.data[src_field]
                if isinstance(val, list):
                    val = ", ".join(val)
                profile_fields[dest_field] = val
        
        if request.business_stage:
            profile_fields["business_stage"] = request.business_stage
        
        if profile_fields:
            await update_business_profile_supabase(supabase_admin, user_id, profile_fields)
        
        # Persist to fact_ledger — every answered field becomes a confirmed fact
        fact_map = {}
        for form_field, value in request.data.items():
            if value and form_field in ONBOARDING_FIELD_TO_FACT:
                fact_map[ONBOARDING_FIELD_TO_FACT[form_field]] = value
        if fact_map:
            await persist_facts_batch(supabase_admin, user_id, fact_map, source="onboarding")
    
    return {"status": "saved", "current_step": new_step}

@api_router.post("/onboarding/complete")
async def complete_onboarding(current_user: dict = Depends(get_current_user)):
    """
    Mark onboarding as completed.
    Writes to user_operator_profile (authoritative) and onboarding table (compat).
    """
    from workspace_helpers import get_or_create_user_account
    
    user_id = current_user["id"]
    user_email = current_user.get("email")
    
    # Mark onboarding complete in user_operator_profile (authoritative)
    now_iso = datetime.now(timezone.utc).isoformat()
    current_state = await _read_onboarding_state(user_id) or {}
    current_state["completed"] = True
    current_state["completed_at"] = now_iso
    await _write_onboarding_state(user_id, current_state)
    
    # Get business profile created during onboarding
    profile = await get_business_profile_supabase(supabase_admin, user_id)
    business_profile_id = profile.get("id") if profile else None
    company_name = profile.get("business_name") if profile else None
    
    # STEP 1: CREATE PARENT ACCOUNT (if doesn't exist)
    try:
        account = await get_or_create_user_account(
            supabase_admin, 
            user_id, 
            user_email, 
            company_name
        )
        account_id = account["id"]
        
        logger.info(f"✅ Parent account ensured for user {user_id}: {account_id}")
        
        # STEP 2: Link business profile to account (if exists)
        if business_profile_id:
            try:
                # Update business_profile with account_id if not already set
                profile_update = await get_business_profile_supabase(supabase_admin, user_id)
                
                if profile_update and not profile_update.get('account_id'):
                    await update_business_profile_supabase(
                        supabase_admin,
                        user_id,
                        {"account_id": account_id}
                    )
                    logger.info(f"✅ Business profile linked to account {account_id}")
                    
            except Exception as e:
                logger.error(f"⚠️ Failed to link business profile to account: {e}")
                # Non-blocking - continue with completion
        
    except Exception as e:
        logger.error(f"❌ Failed to create/get parent account: {e}")
        # Non-blocking - onboarding completion continues
        account_id = None
        business_profile_id = None
    
    # STEP 3: Create calibration schedule (if account + profile exist)
    if account_id and business_profile_id:
        try:
            now = datetime.now(timezone.utc)
            next_weekly = now + timedelta(days=7)
            next_quarterly = now + timedelta(days=90)
            
            schedule_data = {
                "business_profile_id": business_profile_id,
                "user_id": user_id,
                "account_id": account_id,
                "schedule_status": "active",
                "weekly_pulse_enabled": True,
                "quarterly_calibration_enabled": True,
                "created_at": now.isoformat(),
                "next_weekly_due_at": next_weekly.isoformat(),
                "next_quarterly_due_at": next_quarterly.isoformat(),
                "weekly_completion_count": 0,
                "quarterly_completion_count": 0
            }
            
            # UPSERT: Prevent duplicates
            result = supabase_admin.table("calibration_schedules").upsert(
                schedule_data,
                on_conflict="business_profile_id"
            ).execute()
            
            if result.data:
                logger.info(f"✅ Calibration schedule created")
            else:
                logger.warning(f"⚠️ Calibration schedule upsert returned no data")
                
        except Exception as e:
            # Non-blocking: Log error but don't fail onboarding completion
            logger.error(f"❌ Failed to create calibration schedule: {e}")
    
    return {"status": "completed"}


# ==================== WEBSITE ENRICHMENT ====================

class WebsiteEnrichRequest(BaseModel):
    url: str

@api_router.post("/website/enrich")
async def enrich_website(request: WebsiteEnrichRequest, current_user: dict = Depends(get_current_user)):
    """Fetch website metadata and infer business details from a URL"""
    url = request.url.strip()
    if not url.startswith("http"):
        url = f"https://{url}"
    
    result = {"url": url, "title": None, "description": None, "inferred_name": None, "inferred_category": None}
    
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 BIQC-Bot/1.0"})
            html = resp.text[:50000]  # limit to first 50KB
            
            # Extract title
            title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
            if title_match:
                result["title"] = title_match.group(1).strip()[:200]
            
            # Extract meta description
            desc_match = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']', html, re.IGNORECASE)
            if not desc_match:
                desc_match = re.search(r'<meta[^>]+content=["\'](.*?)["\'][^>]+name=["\']description["\']', html, re.IGNORECASE)
            if desc_match:
                result["description"] = desc_match.group(1).strip()[:500]
            
            # Infer business name from title (before separator)
            if result["title"]:
                for sep in [" | ", " - ", " – ", " — ", " :: "]:
                    if sep in result["title"]:
                        result["inferred_name"] = result["title"].split(sep)[0].strip()
                        break
                if not result["inferred_name"]:
                    result["inferred_name"] = result["title"]
            
            # Extract og:type or keywords for category hint
            og_match = re.search(r'<meta[^>]+property=["\']og:type["\'][^>]+content=["\'](.*?)["\']', html, re.IGNORECASE)
            if og_match:
                result["inferred_category"] = og_match.group(1).strip()
            
    except Exception as e:
        logger.warning(f"Website enrichment failed for {url}: {e}")
        result["error"] = str(e)
    
    return result


@api_router.get("/business-profile/context")
async def get_business_profile_context(current_user: dict = Depends(get_current_user)):
    """Get existing business profile + onboarding state + resolved facts.
    Onboarding state reads from user_operator_profile (authoritative).
    Facts resolved from all Supabase sources."""
    from fact_resolution import resolve_facts, resolve_onboarding_fields
    
    user_id = current_user["id"]
    
    profile = await get_business_profile_supabase(supabase_admin, user_id)
    ob_state = await _read_onboarding_state(user_id)
    
    # Resolve all known facts
    facts = await resolve_facts(supabase_admin, user_id)
    resolved_fields = resolve_onboarding_fields(facts)
    
    # Get intelligence baseline if it exists
    baseline = None
    try:
        bl_result = supabase_admin.table("intelligence_baseline").select("*").eq("user_id", user_id).maybe_single().execute()
        baseline = bl_result.data if bl_result.data else None
    except Exception:
        pass
    
    # Get calibration status
    calibration_status = "incomplete"
    try:
        op_result = supabase_admin.table("user_operator_profile").select(
            "persona_calibration_status"
        ).eq("user_id", user_id).maybe_single().execute()
        if op_result.data:
            calibration_status = op_result.data.get("persona_calibration_status", "incomplete")
    except Exception:
        pass
    
    return {
        "profile": profile or {},
        "onboarding": {
            "completed": ob_state.get("completed", False) if ob_state else False,
            "current_step": ob_state.get("current_step", 0) if ob_state else 0,
            "business_stage": ob_state.get("business_stage") if ob_state else None,
            "data": ob_state.get("data", {}) if ob_state else {}
        },
        "resolved_fields": resolved_fields,
        "intelligence_baseline": baseline,
        "calibration_status": calibration_status
    }


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