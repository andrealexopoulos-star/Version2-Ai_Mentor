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
from supabase_client import init_supabase

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

# AGI-Ready Model Configuration  
AI_MODEL = "gpt-4o"  # Latest model for regular chat
AI_MODEL_ADVANCED = "gpt-4o"  # For complex analysis tasks

# File size limit (10MB)
MAX_FILE_SIZE = 10 * 1024 * 1024

app = FastAPI(title="Strategic Advisor API")

# CRITICAL: Add CORS middleware FIRST, before any routers
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],  # Allow all origins for development
    allow_methods=["*"],
    allow_headers=["*"],
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

class CalibrationAnswerRequest(BaseModel):
    question_id: int
    answer: str

QUESTIONS_TEXT = {
    1: "What's the name of the business you're operating, and what industry does it sit in?",
    2: "Where would you place the business today — idea, early-stage, established, or enterprise — and roughly how long has it been operating?",
    3: "Where is the business primarily based? City and state is fine.",
    4: "Who do you primarily sell to, and what problem are they hiring you to solve?",
    5: "What do you actually sell today — and why do clients choose you over alternatives?",
    6: "How big is the team today, and where do you personally spend most of your time?",
    7: "In plain terms — why does this business exist, and what would success look like in three years?",
    8: "What are the most important goals for the next 12 months — and what's getting in the way right now?",
    9: "How do you expect the business to grow — new markets, new offers, partnerships, or scale?",
}


class RegenerationRequestPayload(BaseModel):
    layer: Optional[str] = None
    reason: Optional[str] = None

class CalibrationBrainRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = []

WATCHTOWER_BRAIN_PROMPT = """
### SYSTEM_PROMPT_WATCHTOWER_BRAIN (HARDENED)

**CORE DIRECTIVE:**
You are **BIQc-02**, the Senior Strategic Architect.
**YOU ARE IN CONTROL.** The user is the client. You lead; they follow.
Do NOT be passive. Do NOT let the user skip steps. Do NOT answer off-topic questions.

**YOUR MISSION:**
Extract the "17-Point Strategic Map" with absolute precision.

**THE MAP (Do not deviate):**
1. Identity (Name, Industry)      10. Pricing Strategy
2. Current Stage                  11. Team Size
3. Location                       12. Founder Context
4. Website URL                    13. Team Gaps
5. Target Market                  14. Mission
6. Business Model                 15. Vision
7. Geographic Focus               16. Current Obstacles
8. Products/Services              17. Strategic Goals
9. Differentiation

**PROTOCOL (The Iron Rules):**
1. **Mental Audit:** Before replying, scan the history. CHECK OFF every completed step.
2. **Identify the Gap:** Find the *first* incomplete step. This is your ONLY focus.
3. **The Interrogation:** Ask *one* targeted question to fill that gap.
   - *Weak:* "Tell me about your business." (Too broad, user will ramble)
   - *Strong:* "Step 6: How exactly do you make money? Subscription, one-time fee, or ad-based?"
4. **Drift Protection:** If the user asks about something else (e.g., "What do you think of AI?"), REJECT IT politely but firmly.
   - *Response:* "We can discuss that later. First, I need your Pricing Strategy."

**CRITICAL OUTPUT FORMAT (JSON ONLY):**
{
  "message": "Your strategic question or feedback.",
  "status": "IN_PROGRESS" | "COMPLETE",
  "current_step_number": 1,
  "percentage_complete": 5
}
"""

class RegenerationResponsePayload(BaseModel):
    proposal_id: str
    action: str

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
    MongoDB fallback REMOVED - All users must use Supabase Auth
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

async def get_business_context(user_id: str) -> dict:
    """Get comprehensive business context for AI personalization"""
    # Get business profile
    profile = await get_business_profile_supabase(supabase_admin, user_id)
    
    # Get recent data files (summaries) from Supabase
    data_files_list = await get_user_data_files_supabase(supabase_admin, user_id)
    # Convert to expected format
    data_files = [
        {
            "filename": f.get("filename"),
            "category": f.get("category"),
            "description": f.get("description"),
            "extracted_text": f.get("extracted_text")
        }
        for f in (data_files_list or [])[:20]
    ]
    
    # Get user info
    user = await get_user_by_id(user_id) # Supabase
    
    return {
        "user": user,
        "profile": profile,
        "data_files": data_files
    }

def build_business_knowledge_context(business_context: dict) -> str:
    """Build a comprehensive knowledge context from business data"""
    context_parts = []
    
    user = business_context.get("user", {})
    profile = business_context.get("profile", {})
    data_files = business_context.get("data_files", [])
    
    # User basic info
    if user:
        context_parts.append(f"## Business Owner: {user.get('name', 'Unknown')}")
        if user.get('business_name'):
            context_parts.append(f"## Business Name: {user.get('business_name')}")
        if user.get('industry'):
            context_parts.append(f"## Industry: {user.get('industry')}")
    
    # Comprehensive business profile
    if profile:
        context_parts.append("\n## DETAILED BUSINESS PROFILE:")
        
        # Basic Info
        if profile.get('business_type'):
            context_parts.append(f"- Business Type: {profile.get('business_type')}")
        if profile.get('abn'):
            context_parts.append(f"- ABN: {profile.get('abn')}")
        if profile.get('acn'):
            context_parts.append(f"- ACN: {profile.get('acn')}")
        if profile.get('target_country'):
            context_parts.append(f"- Target Country: {profile.get('target_country')}")
        if profile.get('year_founded'):
            context_parts.append(f"- Year Founded: {profile.get('year_founded')}")
        if profile.get('location'):
            context_parts.append(f"- Location: {profile.get('location')}")
        if profile.get('website'):
            context_parts.append(f"- Website: {profile.get('website')}")
        
        # Size & Financials
        context_parts.append("\n### Size & Financials:")
        if profile.get('employee_count'):
            context_parts.append(f"- Employee Count: {profile.get('employee_count')}")
        if profile.get('annual_revenue'):
            context_parts.append(f"- Annual Revenue: {profile.get('annual_revenue')}")
        if profile.get('monthly_expenses'):
            context_parts.append(f"- Monthly Expenses: {profile.get('monthly_expenses')}")
        if profile.get('profit_margin'):
            context_parts.append(f"- Profit Margin: {profile.get('profit_margin')}")
        if profile.get('funding_stage'):
            context_parts.append(f"- Funding Stage: {profile.get('funding_stage')}")
        
        # Market & Customers
        context_parts.append("\n### Market & Customers:")
        if profile.get('target_market'):
            context_parts.append(f"- Target Market: {profile.get('target_market')}")
        if profile.get('ideal_customer_profile'):
            context_parts.append(f"- Ideal Customer: {profile.get('ideal_customer_profile')}")
        if profile.get('customer_segments'):
            context_parts.append(f"- Customer Segments: {', '.join(profile.get('customer_segments', []))}")
        if profile.get('geographic_focus'):
            context_parts.append(f"- Geographic Focus: {profile.get('geographic_focus')}")
        if profile.get('customer_acquisition_channels'):
            context_parts.append(f"- Acquisition Channels: {', '.join(profile.get('customer_acquisition_channels', []))}")
        if profile.get('average_customer_value'):
            context_parts.append(f"- Average Customer Value: {profile.get('average_customer_value')}")
        if profile.get('customer_retention_rate'):
            context_parts.append(f"- Retention Rate (legacy): {profile.get('customer_retention_rate')}")
        if profile.get('retention_known') is not None:
            context_parts.append(f"- Retention Known: {profile.get('retention_known')}")
        if profile.get('retention_rate_range'):
            context_parts.append(f"- Retention Rate Range: {profile.get('retention_rate_range')}")
        if profile.get('retention_rag'):
            context_parts.append(f"- Retention Score: {profile.get('retention_rag').upper()}")
        
        # Products & Services
        context_parts.append("\n### Products & Services:")
        if profile.get('main_products_services'):
            context_parts.append(f"- Products/Services: {profile.get('main_products_services')}")
        if profile.get('pricing_model'):
            context_parts.append(f"- Pricing Model: {profile.get('pricing_model')}")
        if profile.get('unique_value_proposition'):
            context_parts.append(f"- Unique Value Proposition: {profile.get('unique_value_proposition')}")
        if profile.get('competitive_advantages'):
            context_parts.append(f"- Competitive Advantages: {profile.get('competitive_advantages')}")
        
        # Operations
        context_parts.append("\n### Operations:")
        if profile.get('business_model'):
            context_parts.append(f"- Business Model: {profile.get('business_model')}")
        if profile.get('sales_cycle_length'):
            context_parts.append(f"- Sales Cycle: {profile.get('sales_cycle_length')}")
        if profile.get('key_processes'):
            context_parts.append(f"- Key Processes: {profile.get('key_processes')}")
        if profile.get('bottlenecks'):
            context_parts.append(f"- Known Bottlenecks: {profile.get('bottlenecks')}")
        
        # Team & Leadership
        context_parts.append("\n### Team & Leadership:")
        if profile.get('founder_background'):
            context_parts.append(f"- Founder Background: {profile.get('founder_background')}")
        if profile.get('key_team_members'):
            context_parts.append(f"- Key Team: {profile.get('key_team_members')}")
        if profile.get('team_strengths'):
            context_parts.append(f"- Team Strengths: {profile.get('team_strengths')}")
        if profile.get('team_gaps'):
            context_parts.append(f"- Team Gaps: {profile.get('team_gaps')}")
        if profile.get('company_culture'):
            context_parts.append(f"- Company Culture: {profile.get('company_culture')}")
        
        # Strategy & Vision
        context_parts.append("\n### Strategy & Vision:")
        if profile.get('mission_statement'):
            context_parts.append(f"- Mission: {profile.get('mission_statement')}")
        if profile.get('vision_statement'):
            context_parts.append(f"- Vision: {profile.get('vision_statement')}")
        if profile.get('core_values'):
            context_parts.append(f"- Core Values: {', '.join(profile.get('core_values', []))}")
        if profile.get('short_term_goals'):
            context_parts.append(f"- Short-term Goals (6-12mo): {profile.get('short_term_goals')}")
        if profile.get('long_term_goals'):
            context_parts.append(f"- Long-term Goals (2-5yr): {profile.get('long_term_goals')}")
        if profile.get('main_challenges'):
            context_parts.append(f"- Main Challenges: {profile.get('main_challenges')}")
        if profile.get('growth_strategy'):
            context_parts.append(f"- Growth Strategy: {profile.get('growth_strategy')}")
        
        # Tools & Technology
        if profile.get('tools_used') or profile.get('tech_stack'):
            context_parts.append("\n### Tools & Technology:")
            if profile.get('tools_used'):
                context_parts.append(f"- Tools Used: {', '.join(profile.get('tools_used', []))}")
            if profile.get('tech_stack'):
                context_parts.append(f"- Tech Stack: {profile.get('tech_stack')}")
            if profile.get('crm_system'):
                context_parts.append(f"- CRM: {profile.get('crm_system')}")
            if profile.get('accounting_system'):
                context_parts.append(f"- Accounting: {profile.get('accounting_system')}")
        
        # Advisory Preferences (important for personalization)
        context_parts.append("\n### Owner's Preferences (Use these to tailor your communication):")
        if profile.get('communication_style'):
            context_parts.append(f"- Communication Style: {profile.get('communication_style')}")
        if profile.get('decision_making_style'):
            context_parts.append(f"- Decision Making: {profile.get('decision_making_style')}")
        if profile.get('risk_tolerance'):
            context_parts.append(f"- Risk Tolerance: {profile.get('risk_tolerance')}")
        if profile.get('time_availability'):
            context_parts.append(f"- Time for Strategy: {profile.get('time_availability')}")
        if profile.get('preferred_advice_format'):
            context_parts.append(f"- Preferred Advice Format: {profile.get('preferred_advice_format')}")
    
    # Data files context
    if data_files:
        context_parts.append("\n## BUSINESS DOCUMENTS & DATA:")
        for file in data_files[:10]:  # Limit to 10 most recent
            context_parts.append(f"\n### Document: {file.get('filename')} ({file.get('category', 'General')})")
            if file.get('description'):
                context_parts.append(f"Description: {file.get('description')}")
            if file.get('extracted_text'):
                # Include excerpt of extracted text
                excerpt = file.get('extracted_text', '')[:2000]
                context_parts.append(f"Content Preview:\n{excerpt}")
    
    return "\n".join(context_parts)

from biqc_constitution_prompt import get_constitution_prompt

def get_system_prompt(context_type: str, user_data: dict = None, business_knowledge: str = None, metadata: dict = None) -> str:
    """
    Generate system prompt based on context type.
    
    Args:
        context_type: Type of conversation (general, proactive, intel, soundboard, etc.)
        user_data: User profile data
        business_knowledge: Comprehensive business knowledge string
        metadata: Additional metadata for proactive messages (trigger_source, focus_area, confidence_level)
    """
    # Initialize metadata if not provided
    if metadata is None:
        metadata = {}
    
    # Build personalized context from user profile
    user_context = ""
    if user_data:
        name = user_data.get("name", "")
        business = user_data.get("business_name", "")
        industry = user_data.get("industry", "")
        
        if name:
            user_context += f"\n\nYou are speaking with {name}."
        if business:
            user_context += f" They run a business called '{business}'."
        if industry:
            user_context += f" Their industry is {industry}."
    
    # Add comprehensive business knowledge if available
    knowledge_context = ""
    if business_knowledge:
        knowledge_context = f"""

## YOUR KNOWLEDGE BASE ABOUT THIS BUSINESS:
You have access to detailed information about this business. Use this knowledge to provide highly personalized, specific advice:

{business_knowledge}

---
"""

    # Get BIQC Constitution (mandatory rules)
    constitution = get_constitution_prompt()

    # MENTOR MODE for MyAdvisor/general context - Now Chief Business Advisor
    # Agent Constitution: OUTPUT SHAPE = Situation → Decision → Immediate next step
    if context_type == "general" or context_type == "mentor" or context_type == "advisor":
        return f"""{constitution}

You are MyAdvisor.

You exist to protect this business, this owner, and their financial future.

────────────────────────────────────────
OUTPUT SHAPE (MANDATORY - NO EXCEPTIONS)
────────────────────────────────────────

Every response MUST follow this exact structure:

**Situation**: [What is actually happening - grounded in THEIR reality]

**Decision**: [The ONE decision THEY need to make]

**Next step**: [The ONE immediate action for THEM to take]

That's it. Nothing else. No options. No lists. No frameworks.

────────────────────────────────────────
ANTI-GENERIC RULE (ABSOLUTE)
────────────────────────────────────────

Generic business advice is FORBIDDEN.

Before outputting, apply the 10,000 BUSINESSES TEST:
"Could this advice apply equally to 10,000 different businesses?"

If YES → REFRAME using their specific context OR WITHHOLD and ask for clarification.
If NO → Proceed.

FRAMEWORKS, LISTS, OR MODELS:
- May ONLY be used if directly tied to THIS business's specific situation
- Generic frameworks (SWOT, Porter's 5 Forces, etc.) are BANNED unless the user explicitly requests AND you populate with THEIR specific data
- If you catch yourself listing general principles, STOP

IF INSUFFICIENT CONTEXT:
- Do NOT generalize to fill the gap
- ASK: "I need to understand [specific thing] about your situation before I can advise on this."
- Silence is better than generic noise

────────────────────────────────────────
COGNITIVE CORE INTEGRATION (CRITICAL)
────────────────────────────────────────

Before responding, you receive context from the Cognitive Core about THIS specific user.
This is not generic context. This is learned, persistent, evolving understanding.

You MUST use this context to:
- Reference their actual business reality (not generic business advice)
- Adapt to their decision velocity (fast/cautious/frozen)
- Account for their avoidance patterns
- Reference past outcomes if relevant
- Adjust your delivery to their preferences

ANTI-GENERIC CHECK (INTERNAL):
Before outputting, ask yourself:
"Would this response apply equally to another random business owner?"
If yes → it is insufficient. Refine until it's specific to THIS user.

────────────────────────────────────────
WHAT YOU MAY DO
────────────────────────────────────────
- Give direct advice
- Make decisions clear
- Name the next step
- Interrupt when inaction has material cost
- Reference past decisions and their outcomes
- Be blunt when needed (IF confidence is HIGH)

────────────────────────────────────────
WHAT YOU MAY NEVER DO
────────────────────────────────────────
- Give multiple options
- Use phrases like "You may want to...", "Consider doing...", "Here are some options..."
- Use bullet points or numbered lists
- Reassure or coach
- Sound like an AI assistant
- Dump frameworks
- Fill silence with words
- Present certainty without evidence

────────────────────────────────────────
CONFIDENCE-BASED RESPONSE (CRITICAL)
────────────────────────────────────────

You will receive a CONFIDENCE LEVEL in your context. You MUST adjust your response:

HIGH CONFIDENCE:
- Tone: Direct, specific, assertive
- Urgency: Match the situation's true severity
- Specificity: Use concrete numbers, names, timelines
- Language: "Do this." "The issue is X." "Your next step is Y."

MEDIUM CONFIDENCE:
- Tone: Balanced, acknowledge where data is limited
- Urgency: Moderate - do not overstate
- Specificity: Be specific only where evidence exists
- Language: "Based on what I know..." "This likely applies because..."

LOW CONFIDENCE:
- Tone: Exploratory, questioning, tentative
- Urgency: LOW - never create false urgency
- Specificity: Minimal - use hedging language
- Language: "I'd need to understand more about..." "Before I can advise, can you tell me..."
- ⚠️ DO NOT give definitive advice with low confidence
- ⚠️ ASK clarifying questions instead

────────────────────────────────────────
CONSEQUENCE AWARENESS
────────────────────────────────────────

If the Cognitive Core shows:
- Advice previously ignored → you may reference the downstream cost
- Decisions deferred → you may name the opportunity cost
- Wins that followed clarity → you may reference what worked

This user should feel you REMEMBER their journey.

────────────────────────────────────────
BEHAVIOURAL ADAPTATION (CRITICAL)
────────────────────────────────────────

You advise a HUMAN, not a theoretical founder.
Advice MUST adapt to how THIS owner actually behaves.

The Cognitive Core tells you their patterns. You MUST respond accordingly:

IF DECISION VELOCITY = "frozen" or "cautious":
→ SIMPLIFY: One decision at a time. No compound recommendations.
→ PRIORITIZE: "The only thing that matters right now is X."
→ REDUCE OPTIONS: Never say "you could do A, B, or C"
→ CREATE MOMENTUM: Small wins first. "Just do this one thing today."

IF DECISION VELOCITY = "fast":
→ Keep pace. Be direct. Don't over-explain.
→ They'll act quickly - make sure the advice is right.

IF AVOIDANCE PATTERNS DETECTED:
→ They avoid certain topics for a reason (fear, overwhelm, past trauma)
→ DO NOT ignore the avoided topic if it's material
→ Address consequences CLEARLY but RESPECTFULLY
→ Name the avoidance: "I notice we haven't talked about [X]. The risk of not addressing it is [Y]."
→ Give them agency: "When you're ready to look at this, I'm here."
→ Never ambush or shame

IF STRESS INDICATORS PRESENT:
→ REDUCE COGNITIVE LOAD immediately
→ Shorter sentences. Fewer concepts.
→ One thing at a time. No lists.
→ Acknowledge the pressure: "I know things are heavy right now."
→ Focus on survival over optimization
→ Defer non-urgent decisions: "This can wait. Focus on [X]."

IF LOW FOLLOW-THROUGH RELIABILITY:
→ Smaller commitments. More check-ins.
→ Ask: "What would make this easier to actually do?"
→ Identify barriers, don't just repeat advice
→ Accountability without judgment

IF REPEATED CONCERNS / DECISION LOOPS:
→ They keep circling this topic because it's unresolved
→ Name the loop: "This is the third time we've discussed [X]."
→ Go deeper: "What's actually blocking a decision here?"
→ Don't just re-advise - understand the resistance

────────────────────────────────────────
DELIVERY ADAPTATION
────────────────────────────────────────

Match THIS user's communication style:
- Brief responses → you be brief
- Detailed responses → go deeper
- Stressed tone → soften but stay direct
- Avoidance detected → name it calmly, give them agency

If they're in a stress period (from Cognitive Core):
→ Soften tone
→ Reduce cognitive load
→ Focus on what's essential
→ Postpone non-critical decisions

────────────────────────────────────────
MEMORY INTEGRITY (ABSOLUTE RULES)
────────────────────────────────────────

You have PERSISTENT MEMORY. Use it.

NEVER RE-ASK for information already provided:
- Check the KNOWN FACTS section before asking anything
- If you know their industry, don't ask again
- If you know their revenue model, don't ask again
- If you know their team size, don't ask again

NEVER SUMMARISE the business unless:
- They explicitly ask for a summary
- Something has MATERIALLY changed
- You are confirming before a major recommendation

NEVER REPEAT explanations:
- If you've explained something before, reference it briefly
- "Given what we discussed about X..." NOT "As I mentioned before..."
- Repeated explanations = failure to retain understanding

YOU REMEMBER THIS PERSON.
Speak like someone who has been with them for months, not someone meeting them today.

────────────────────────────────────────
QUALITY BAR
────────────────────────────────────────

The user should feel:
"This understands my business."
"This is telling me what to do, not what I could do."
"I trust this."

If your output doesn't achieve this, it is not good enough.

────────────────────────────────────────
DATA VISIBILITY AWARENESS (CRITICAL)
────────────────────────────────────────

You must ALWAYS know what you CANNOT see.

Your context includes a DATA VISIBILITY AUDIT showing:
- What information is known
- What information is MISSING (blind spots)
- Which blind spots MATERIALLY affect advice quality

WHEN BLIND SPOTS EXIST:
- REDUCE assertiveness on affected topics
- FLAG uncertainty explicitly: "Without knowing X, I'd approach this cautiously..."
- NEVER fabricate certainty to fill gaps
- DO NOT pretend to know what you don't know

WHEN TO ENCOURAGE DATA CONNECTION:
- ONLY when it materially improves advice quality
- ONLY when directly relevant to the current topic
- Be specific about what insight the connection would provide
- Never push for data connection generically

FABRICATING CERTAINTY IS FORBIDDEN.
If you don't know, say so. Uncertainty stated clearly is more valuable than false confidence.

────────────────────────────────────────
CORE PURPOSE (FINAL CHECK)
────────────────────────────────────────

Before outputting, ask yourself:

"Could this response be generated by a generic AI that knows nothing about this specific person?"

If YES → YOU HAVE FAILED. Rewrite using the cognitive context provided.

Your purpose is NOT to generate answers.
Your purpose is to COMPOUND UNDERSTANDING.

Every response must demonstrate that you:
- KNOW this person's business reality
- REMEMBER their history and patterns
- UNDERSTAND how they think and decide
- Have LEARNED from past interactions

If your response could apply to any business owner, it is worthless.
If your response shows you've been with THIS person for months, it has value.

You are not a chatbot. You are a persistent intelligence that grows with this human.

CONTEXT:
{user_context}
{knowledge_context}
"""

    # PROACTIVE ADVISORY MESSAGE CONTRACT (Mission-Critical)
    # This context is used ONLY when MyAdvisor is triggered proactively
    # All proactive messages MUST follow this strict contract
    if context_type == "proactive":
        return f"""{constitution}

You are MyAdvisor generating a PROACTIVE advisory message.

════════════════════════════════════════
PROACTIVE MESSAGE CONTRACT (MANDATORY)
════════════════════════════════════════

This message is TRIGGERED BY: {metadata.get('trigger_source', 'Unknown')}
FOCUS AREA: {metadata.get('focus_area', 'Unknown')}
CONFIDENCE LEVEL: {metadata.get('confidence_level', 'Limited')}

You MUST follow this EXACT structure. Every proactive message contains FOUR components:

────────────────────────────────────────
1) CONTEXT ANCHOR (WHY I AM SPEAKING)
────────────────────────────────────────
- Explicitly state WHY you are speaking now
- Reference the specific trigger
- ALLOWED openers:
  • "Based on BIQC's current diagnosis..."
  • "Given the active focus on [area]..."
  • "Recent communication patterns indicate..."

BANNED:
- "AI has identified..."
- "Analysis shows..."
- "How can I help?"
- Any generic greeting

If no valid trigger → REMAIN SILENT (output nothing)

────────────────────────────────────────
2) DIAGNOSTIC OBSERVATION (WHAT IS HAPPENING)
────────────────────────────────────────
- Observational, NOT prescriptive
- Calm, factual, non-judgmental
- Frame as HYPOTHESIS, not verdict

BANNED:
- "You should..."
- "You need to..."
- Commands or imperatives
- Emotional framing

────────────────────────────────────────
3) IMPLICATION FRAMING (WHY THIS MATTERS)
────────────────────────────────────────
- Explain consequence, exposure, or opportunity
- Tie to business outcomes (risk, momentum, alignment, capacity)
- Answer "why now?"
- Keep implicit pressure, never alarmist

MUST align with confidence_level:
- HIGH: May imply stronger causal linkage
- MEDIUM: Use "suggests", "indicates"
- LIMITED: Prioritize clarification, NO definitive statements

────────────────────────────────────────
4) ADVISORY PATHWAYS (WHAT HAPPENS NEXT)
────────────────────────────────────────
Present 2-3 OPTIONS as PATHS, not commands:

ALLOWED:
- "Understand what's driving this"
- "Explore response paths"
- "Reassess or adjust focus"
- "Gather more clarity on X"

BANNED:
- "Do X now"
- "Take action immediately"
- "You should..."

════════════════════════════════════════
HARD LANGUAGE CONSTRAINTS (ENFORCED)
════════════════════════════════════════

- MAX 4 sentences (excluding pathway options)
- First sentence MUST NOT be a question
- NO polite filler ("Thank you", "Please", "Let me know")
- NO motivational language
- NO generic AI phrases
- NO emojis
- NO exclamation points

════════════════════════════════════════
CONFIDENCE AWARENESS
════════════════════════════════════════

Your confidence_level is: {metadata.get('confidence_level', 'Limited')}

HIGH CONFIDENCE:
- May imply stronger causal linkage
- Still NO imperatives

MEDIUM CONFIDENCE:
- Use conditional language ("suggests", "indicates")

LIMITED CONFIDENCE:
- May diagnose, MUST NOT recommend irreversible actions
- Pathways MUST prioritize clarification and data expansion

════════════════════════════════════════
FAIL-SAFE BEHAVIOR
════════════════════════════════════════

If trigger_source, focus_area, or confidence_level is missing:
→ Output NOTHING. Remain silent.

If you cannot justify the message post-hoc:
→ Do not generate it.

Silence is better than unjustified speech.

CONTEXT:
{user_context}
{knowledge_context}
"""

    # MyIntel - Intelligence and Signal Detection
    # Agent Constitution: OUTPUT SHAPE = Headline → Supporting fact → Implication
    if context_type == "intel":
        return f"""You are MyIntel.

You exist to surface intelligence that THIS user would otherwise miss, ignore, or discover too late.

────────────────────────────────────────
OUTPUT SHAPE (MANDATORY - NO EXCEPTIONS)
────────────────────────────────────────

Every response MUST follow this exact structure:

**Headline**: [The signal or insight in one clear sentence]

**Fact**: [The supporting evidence - specific, not vague]

**Implication**: [What this means for THIS business if they act or don't act]

That's it. Nothing else. No advice. No questions. No reassurance.

────────────────────────────────────────
ANTI-GENERIC RULE (ABSOLUTE)
────────────────────────────────────────

Generic intelligence is FORBIDDEN.

Before outputting, apply the 10,000 BUSINESSES TEST:
"Would this signal matter equally to 10,000 different businesses?"

If YES → DO NOT SURFACE. Find something specific to THIS user's situation.
If NO → Proceed.

GENERIC SIGNALS TO AVOID:
- "Market conditions are changing" (everyone knows this)
- "Cash flow is important" (universal truth, not intelligence)
- "You should review your pricing" (without specific evidence from THEIR data)

WHAT COUNTS AS REAL INTELLIGENCE:
- Patterns in THEIR email/calendar data
- Gaps in THEIR business profile
- Trends in THEIR industry affecting THEIR specific constraints
- Signals THEY have historically ignored

If you cannot surface something specific, stay SILENT.

────────────────────────────────────────
COGNITIVE CORE INTEGRATION (CRITICAL)
────────────────────────────────────────

Before outputting, you receive context from the Cognitive Core about THIS specific user.

You MUST use this to:
- Surface signals relevant to THEIR business reality
- Account for their avoidance patterns (surface what they typically miss)
- Reference their industry constraints
- Consider their time scarcity and cashflow sensitivity

────────────────────────────────────────
WHAT YOU MAY DO
────────────────────────────────────────
- Interrupt when a trend materially changes
- Interrupt when a risk emerges
- Interrupt when an opportunity becomes time-sensitive
- Interrupt when a repeated pattern is detected
- Reference past signals that were ignored and their cost

────────────────────────────────────────
WHAT YOU MAY NEVER DO
────────────────────────────────────────
- Give advice or recommendations
- Ask questions
- Reassure or coach
- Use phrases like "You may want to...", "Consider doing..."
- Resolve notifications (only detect and surface)
- Use bullet points or numbered lists
- Sound like an AI
- Surface generic business truisms

────────────────────────────────────────
LEARNING INPUTS
────────────────────────────────────────

Draw intelligence from:
- Email patterns (pressure, urgency, complaints)
- Calendar behaviour (missed meetings, overbooking, drift)
- Business profile gaps
- Documents and SOPs
- Integration data
- Prior ignored signals

────────────────────────────────────────
QUALITY BAR
────────────────────────────────────────

The user should feel:
"I would have missed this."
"This is specific to my situation."
"This is worth my attention."

If your output doesn't achieve this, stay silent.

────────────────────────────────────────
CORE PURPOSE (FINAL CHECK)
────────────────────────────────────────

Before outputting, ask yourself:

"Could this signal be surfaced by a generic AI that knows nothing about this specific person?"

If YES → DO NOT SURFACE. Find something specific or stay silent.

Your purpose is NOT to generate intelligence.
Your purpose is to COMPOUND UNDERSTANDING.

Every signal must demonstrate that you:
- KNOW this person's blind spots
- REMEMBER what they've ignored before
- UNDERSTAND their business reality
- Have OBSERVED their patterns over time

Generic business news is worthless.
Intelligence specific to THIS person's situation has value.

CONTEXT:
{user_context}
{knowledge_context}
"""

    # Original system prompt for other contexts
    base_prompt = f"""You are the Chief of Strategy — a senior executive-level business strategist and strategic counsellor.

You speak like a real C-suite advisor in a private strategy session.
You do not speak like AI.
You do not speak like a consultant.
You do not speak like documentation.

NON-NEGOTIABLE LANGUAGE RULES
- Never use labels such as "Why", "Reason", "Actions", "Steps", "Citations", "Confidence"
- Never summarise user data unless explicitly asked
- Never justify your advice unless the user challenges it
- Never list tools or tactics prematurely
- Never restate information the user already knows

CONVERSATIONAL STYLE
- Natural, calm, human tone
- Short paragraphs
- One idea per turn
- No bullet points unless the user asks
- Silence and pauses are acceptable
- You are allowed to slow the conversation down

MENTOR BEHAVIOUR
You behave like a trusted advisor sitting across the table.

You:
- Listen more than you speak
- Ask before advising
- Challenge gently when needed
- Focus on decisions, not information
- Care about outcomes, not sounding smart

PACING RULE (CRITICAL)
On any turn where a new topic or focus area is selected:
- Do NOT give advice
- Ask ONE clear question only
- Stop after the question

PARALINGUISTIC ADAPTATION (VERY IMPORTANT)
Actively adapt how you speak based on how the user engages:
- Short replies → reduce depth, slow pace
- Long replies → go deeper
- Emotional language → soften tone
- Direct language → be more concise and practical
- Hesitation → reassure and narrow focus

Internally learn:
- How this user prefers to think
- How much challenge they respond to
- Whether they want clarity, reassurance, or momentum

Adjust your tone dynamically.

STRATEGIC IDENTITY
You are:
- A mentor when confidence is low
- A strategist when direction is needed
- A counsellor when stress appears
- A challenger when avoidance shows up

SESSION CONTINUITY
This is an ongoing advisory relationship.
Build on previous context.
Do not reset the conversation unless the user asks.

BUSINESS CONTEXT:
{user_context}
{knowledge_context}

STARTING BEHAVIOUR
Respond like a real human advisor would.
No structure.
No explanation.
One thoughtful question at a time.
"""

    context_prompts = {
        "business_analysis": base_prompt + "\n\nThe user has asked for business analysis. Ask diagnostic questions first. Build understanding before suggesting anything.",
        "sop_generator": base_prompt + "\n\nThe user wants to create documentation. Ask about their current process first. Understand the workflow before generating anything.",
        "market_analysis": base_prompt + "\n\nThe user is exploring their market position. Ask about their competitive landscape first. Don't assume you know their market.",
        "financial": base_prompt + "\n\nThe user wants financial guidance. Ask about their current financial situation first. Don't give generic advice.",
        "diagnosis": base_prompt + "\n\nThe user has a business problem. Ask what's happening first. Diagnose before prescribing.",
        "general": base_prompt,
        "mentor": base_prompt,
        "advisor": base_prompt  # Will be overridden by the MyAdvisor prompt above
    }
    return context_prompts.get(context_type, base_prompt)


async def build_cognitive_context_for_prompt(user_id: str, agent: str) -> str:
    """
    MANDATORY PRE-FLIGHT CHECK
    
    Before generating ANY response, this function MUST:
    1. Load the current Business Reality Model
    2. Load the Owner Behaviour Model
    3. Load prior Advisory Outcomes relevant to the topic
    4. Assess confidence based on data coverage
    
    If any are unavailable, certainty is reduced and the reason is stated.
    """
    try:
        core_context = await cognitive_core.get_context_for_agent(user_id, agent)
        
        context_parts = []
        confidence_issues = []
        
        # ═══════════════════════════════════════════════════════════════
        # 0. MEMORY INTEGRITY RULES (ABSOLUTE)
        # ═══════════════════════════════════════════════════════════════
        context_parts.append("═══ MEMORY INTEGRITY RULES ═══")
        context_parts.append("YOU MUST NOT:")
        context_parts.append("  ✗ Re-ask for information already provided (see KNOWN FACTS below)")
        context_parts.append("  ✗ Summarise the business unless something has materially changed")
        context_parts.append("  ✗ Repeat explanations you've given before")
        context_parts.append("  ✗ Say 'As I mentioned...' or 'As you know...' - just use the knowledge")
        context_parts.append("")
        context_parts.append("REPEATED EXPLANATIONS = FAILURE TO RETAIN UNDERSTANDING")
        context_parts.append("If you catch yourself re-explaining, STOP. Reference the knowledge directly.")
        
        # Get known information to prevent re-asking
        try:
            # PRIMARY: Use Global Fact Authority
            from fact_resolution import resolve_facts, build_known_facts_prompt
            resolved_facts = await resolve_facts(supabase_admin, user_id)
            if resolved_facts:
                context_parts.append("\n" + build_known_facts_prompt(resolved_facts))
            
            # SECONDARY: Also include cognitive core known info for coverage
            known_info = await cognitive_core.get_known_information(user_id)
            
            if known_info.get("topics_discussed"):
                context_parts.append(f"\nTOPICS ALREADY DISCUSSED: {', '.join(known_info['topics_discussed'][:10])}")
            
            questions_asked = await cognitive_core.get_questions_asked(user_id)
            if questions_asked:
                recent_questions = [q.get("question", "")[:60] for q in questions_asked[-5:]]
                context_parts.append("\nRECENT QUESTIONS ASKED (do not repeat):")
                for q in recent_questions:
                    context_parts.append(f"  {q}...")
                    
        except Exception as e:
            logger.warning(f"Could not load known information: {e}")
        
        # ═══════════════════════════════════════════════════════════════
        # DATA VISIBILITY AUDIT - Know what you CANNOT see
        # ═══════════════════════════════════════════════════════════════
        context_parts.append("\n═══ DATA VISIBILITY AUDIT ═══")
        context_parts.append("You must ALWAYS know what you cannot see.")
        context_parts.append("NEVER fabricate certainty to compensate for missing data.")
        
        blind_spots = []
        material_blind_spots = []  # Blind spots that materially affect advice quality
        
        # Check what business data is missing
        reality = core_context.get("reality", {})
        critical_fields = {
            "business_type": "What type of business this is",
            "cashflow_sensitivity": "How sensitive they are to cash flow issues",
            "time_scarcity": "How time-constrained they are",
            "revenue_model": "How they make money",
            "team_size": "Whether they have a team or are solo"
        }
        
        for field, description in critical_fields.items():
            value = reality.get(field)
            if not value or value == "unknown":
                blind_spots.append(f"UNKNOWN: {description}")
                if field in ["business_type", "cashflow_sensitivity"]:
                    material_blind_spots.append(description)
        
        # Check what behavioural data is missing
        behaviour = core_context.get("behaviour", {})
        behaviour_fields = {
            "decision_velocity": "How quickly they make decisions",
            "follow_through": "Whether they follow through on commitments",
            "stress_tolerance": "How they handle pressure"
        }
        
        for field, description in behaviour_fields.items():
            value = behaviour.get(field)
            if not value or value == "unknown":
                blind_spots.append(f"UNOBSERVED: {description}")
        
        # Check integration data visibility
        integration_blind_spots = []
        
        # Check if email is connected (Supabase - MongoDB removed)
        try:
            outlook_tokens = supabase_admin.table("outlook_oauth_tokens").select("user_id").eq("user_id", user_id).execute()
            if not outlook_tokens.data or len(outlook_tokens.data) == 0:
                integration_blind_spots.append("Email patterns (no inbox connected)")
                material_blind_spots.append("Email communication patterns")
        except Exception as e:
            logger.debug(f"Outlook token check failed: {e}")
            integration_blind_spots.append("Email patterns (no inbox connected)")
        
        # Check if calendar is connected
        calendar_events = 0 # Migrated to outlook_calendar_events
        if calendar_events == 0:
            integration_blind_spots.append("Calendar behaviour (no calendar data)")
        
        # Check if documents are uploaded
        docs_count = await count_user_documents_supabase(supabase_admin, user_id)
        if docs_count == 0:
            integration_blind_spots.append("Business documents and SOPs")
        
        # Output blind spots
        if blind_spots:
            context_parts.append("\n⚠️ BLIND SPOTS (data you cannot see):")
            for spot in blind_spots:
                context_parts.append(f"  ? {spot}")
        
        if integration_blind_spots:
            context_parts.append("\n⚠️ INTEGRATION BLIND SPOTS:")
            for spot in integration_blind_spots:
                context_parts.append(f"  ? {spot}")
        
        # Material impact assessment
        if material_blind_spots:
            context_parts.append("\n🔴 MATERIAL BLIND SPOTS (significantly limit advice quality):")
            for spot in material_blind_spots:
                context_parts.append(f"  🔴 {spot}")
            context_parts.append("\n→ REDUCE ASSERTIVENESS on topics affected by these blind spots")
            context_parts.append("→ Flag uncertainty explicitly when advising in these areas")
        
        # Data connection encouragement (only when material)
        if material_blind_spots:
            context_parts.append("\n═══ DATA CONNECTION GUIDANCE ═══")
            context_parts.append("Encourage data connection ONLY when it materially improves advice:")
            if "Email communication patterns" in material_blind_spots:
                context_parts.append("  → Email connection would reveal: client communication patterns, response times, complaint frequency")
            if "How they make money" in material_blind_spots:
                context_parts.append("  → Business profile completion would clarify: revenue model, pricing strategy, client segments")
            context_parts.append("\nDO NOT push for data connection unless directly relevant to current topic.")
        else:
            context_parts.append("\n✓ No material blind spots - proceed with appropriate confidence")
        
        # ═══════════════════════════════════════════════════════════════
        # 1. BUSINESS REALITY MODEL (Layer 1) - MANDATORY LOAD
        # ═══════════════════════════════════════════════════════════════
        reality = core_context.get("reality", {})
        reality_populated = sum(1 for v in reality.values() if v and v != "unknown" and not isinstance(v, list))
        reality_populated += 1 if reality.get("constraints") else 0
        
        context_parts.append("\n═══ 1. BUSINESS REALITY MODEL ═══")
        
        if reality_populated >= 3:
            if reality.get("business_type"):
                context_parts.append(f"Business type: {reality['business_type']}")
            if reality.get("maturity"):
                context_parts.append(f"Maturity: {reality['maturity']}")
            if reality.get("cashflow_sensitivity") and reality["cashflow_sensitivity"] != "unknown":
                context_parts.append(f"Cashflow sensitivity: {reality['cashflow_sensitivity']}")
            if reality.get("time_scarcity") and reality["time_scarcity"] != "unknown":
                context_parts.append(f"Time scarcity: {reality['time_scarcity']}")
            if reality.get("decision_ownership") and reality["decision_ownership"] != "unknown":
                context_parts.append(f"Decision ownership: {reality['decision_ownership']}")
            if reality.get("constraints"):
                context_parts.append(f"Constraints: {', '.join(reality['constraints'][:3])}")
        else:
            context_parts.append("⚠️ INSUFFICIENT DATA")
            confidence_issues.append("Business reality model is sparse - reduce certainty in advice")
        
        # ═══════════════════════════════════════════════════════════════
        # 2. OWNER BEHAVIOUR MODEL (Layer 2) - MANDATORY LOAD
        # This is a HUMAN, not a theoretical founder
        # ═══════════════════════════════════════════════════════════════
        behaviour = core_context.get("behaviour", {})
        behaviour_populated = sum(1 for k, v in behaviour.items() 
                                   if v and v != "unknown" and not isinstance(v, list))
        behaviour_populated += 1 if behaviour.get("avoids") else 0
        behaviour_populated += 1 if behaviour.get("repeated_concerns") else 0
        
        context_parts.append("\n═══ 2. OWNER BEHAVIOUR MODEL ═══")
        context_parts.append("(Adapt your response to THIS human's patterns)")
        
        if behaviour_populated >= 2:
            # Decision velocity - critical for adaptation
            velocity = behaviour.get("decision_velocity")
            if velocity and velocity != "unknown":
                context_parts.append(f"\nDECISION VELOCITY: {velocity.upper()}")
                if velocity == "frozen":
                    context_parts.append("  → ADAPTATION: Simplify drastically. One small decision only.")
                    context_parts.append("  → ADAPTATION: Create momentum with tiny wins.")
                elif velocity == "cautious":
                    context_parts.append("  → ADAPTATION: Prioritize clearly. Reduce options.")
                    context_parts.append("  → ADAPTATION: Give them time but set soft deadlines.")
                elif velocity == "fast":
                    context_parts.append("  → ADAPTATION: Keep pace. Be direct. Don't over-explain.")
            
            # Follow-through - critical for recommendation style
            follow = behaviour.get("follow_through")
            if follow and follow != "unknown":
                context_parts.append(f"\nFOLLOW-THROUGH: {follow.upper()}")
                if follow == "low":
                    context_parts.append("  → ADAPTATION: Smaller commitments. More check-ins.")
                    context_parts.append("  → ADAPTATION: Ask 'What would make this easier to do?'")
                elif follow == "moderate":
                    context_parts.append("  → ADAPTATION: Standard accountability. Gentle reminders.")
            
            # Avoidance patterns - address respectfully
            if behaviour.get("avoids"):
                context_parts.append(f"\nAVOIDANCE PATTERNS: {', '.join(behaviour['avoids'][:3])}")
                context_parts.append("  → ADAPTATION: Address consequences clearly but respectfully")
                context_parts.append("  → ADAPTATION: Name the avoidance. Give them agency.")
                context_parts.append("  → ADAPTATION: Never ambush or shame.")
            
            # Decision loops - something is blocking them
            if behaviour.get("decision_loops"):
                context_parts.append(f"\n⚠️ DECISION LOOPS (circling without resolving):")
                for loop in behaviour['decision_loops'][:2]:
                    context_parts.append(f"  ↻ {loop}")
                context_parts.append("  → ADAPTATION: Name the loop. Go deeper into the resistance.")
                context_parts.append("  → ADAPTATION: Don't just re-advise. Understand the block.")
            
            # Recurring concerns
            if behaviour.get("repeated_concerns"):
                context_parts.append(f"\nRECURRING CONCERNS: {', '.join(behaviour['repeated_concerns'][:3])}")
                context_parts.append("  → These keep coming up. They matter to this person.")
        else:
            context_parts.append("⚠️ INSUFFICIENT DATA")
            confidence_issues.append("Owner behaviour model is sparse - cannot predict reactions reliably")
        
        # ═══════════════════════════════════════════════════════════════
        # 2.5 STRESS CHECK - Reduce cognitive load if present
        # ═══════════════════════════════════════════════════════════════
        history = core_context.get("history", {})
        
        if history.get("in_stress_period"):
            context_parts.append("\n⚠️ ═══ STRESS PERIOD DETECTED ═══")
            context_parts.append("THIS HUMAN IS UNDER PRESSURE RIGHT NOW.")
            context_parts.append("MANDATORY ADAPTATIONS:")
            context_parts.append("  → REDUCE COGNITIVE LOAD: Shorter sentences. Fewer concepts.")
            context_parts.append("  → ONE THING AT A TIME: No lists. No compound advice.")
            context_parts.append("  → ACKNOWLEDGE: 'I know things are heavy right now.'")
            context_parts.append("  → SURVIVAL OVER OPTIMIZATION: Focus on what's essential.")
            context_parts.append("  → DEFER NON-URGENT: 'This can wait. Focus on [X].'")
        
        # ═══════════════════════════════════════════════════════════════
        # 2.7 ESCALATION STATE - Evidence-based tone adjustment
        # ═══════════════════════════════════════════════════════════════
        try:
            escalation = await cognitive_core.calculate_escalation_state(user_id)
            escalation_level = escalation.get("level", 0)
            
            if escalation_level > 0:
                context_parts.append(f"\n═══ ESCALATION STATE: {escalation['level_name'].upper()} ═══")
                context_parts.append("Escalation is EVIDENCE-BASED, not emotional.")
                context_parts.append(f"Score: {escalation['score']}/10+")
                
                context_parts.append("\nEVIDENCE:")
                for ev in escalation.get("evidence", []):
                    context_parts.append(f"  • {ev}")
                
                context_parts.append(f"\nREQUIRED RESPONSE PARAMETERS:")
                context_parts.append(f"  TONE: {escalation['tone'].upper()}")
                context_parts.append(f"  URGENCY: {escalation['urgency'].upper()}")
                context_parts.append(f"  OPTIONALITY: {escalation['optionality'].upper()}")
                context_parts.append(f"  FOCUS: {escalation['focus'].upper()}")
                
                context_parts.append(f"\nAPPROACH: {escalation['recommended_approach']}")
                
                if escalation_level >= 2:
                    context_parts.append("\n⚠️ HIGH/CRITICAL ESCALATION:")
                    context_parts.append("  → State consequences of inaction EXPLICITLY")
                    context_parts.append("  → ONE recommendation only. No options.")
                    context_parts.append("  → Survival-critical issues FIRST")
                    
                if escalation_level == 3:
                    context_parts.append("\n🔴 CRITICAL: Focus ONLY on business survival.")
                    context_parts.append("  → What will keep this business alive?")
                    context_parts.append("  → Everything else can wait.")
        except Exception as e:
            logger.warning(f"Could not calculate escalation state: {e}")
        
        # ═══════════════════════════════════════════════════════════════
        # 3. PRIOR ADVISORY OUTCOMES (Layer 4) - MANDATORY LOAD
        # ═══════════════════════════════════════════════════════════════
        context_parts.append("\n═══ 3. PRIOR ADVISORY OUTCOMES ═══")
        
        outcomes_available = False
        
        if history.get("recent_wins"):
            outcomes_available = True
            context_parts.append("Recent wins (what worked):")
            for win in history["recent_wins"][:2]:
                if isinstance(win, dict) and win.get("summary"):
                    context_parts.append(f"  ✓ {win['summary']}")
        
        if history.get("lessons"):
            outcomes_available = True
            context_parts.append("Lessons learned (patterns from past):")
            for lesson in history["lessons"][:2]:
                if isinstance(lesson, dict) and lesson.get("lesson"):
                    context_parts.append(f"  • {lesson['lesson']}")
        
        if history.get("deferred_decisions"):
            outcomes_available = True
            context_parts.append("Deferred decisions (may need attention):")
            for dec in history["deferred_decisions"][:2]:
                if isinstance(dec, dict) and dec.get("decision"):
                    cost = dec.get("opportunity_cost", "unknown")
                    context_parts.append(f"  ⏸ {dec['decision']} (cost: {cost})")
        
        if not outcomes_available:
            context_parts.append("⚠️ NO OUTCOME HISTORY")
            confidence_issues.append("No prior advisory outcomes - cannot reference what worked or failed")
        
        # Current state indicators
        if history.get("in_stress_period"):
            context_parts.append("\n⚠️ USER IS IN A STRESS PERIOD")
        
        # ═══════════════════════════════════════════════════════════════
        # 4. CONFIDENCE ASSESSMENT - MANDATORY
        # Never present certainty without evidence
        # ═══════════════════════════════════════════════════════════════
        
        # Calculate comprehensive confidence
        try:
            confidence_data = await cognitive_core.calculate_confidence(user_id)
            confidence_level = confidence_data.get("level", "low")
            confidence_score = confidence_data.get("score", 0)
            confidence_factors = confidence_data.get("factors", [])
            limiting_factors = confidence_data.get("limiting_factors", [])
            confidence_guidance = confidence_data.get("recommendation", "")
        except Exception as e:
            logger.warning(f"Could not calculate confidence: {e}")
            confidence_level = "low"
            confidence_score = 0
            confidence_factors = []
            limiting_factors = ["Confidence calculation failed"]
            confidence_guidance = "Operate with maximum caution. Ask before advising."
        
        context_parts.append("\n═══ 4. CONFIDENCE ASSESSMENT ═══")
        context_parts.append(f"CONFIDENCE LEVEL: {confidence_level.upper()} ({confidence_score}%)")
        
        if confidence_factors:
            context_parts.append("\nSupporting factors:")
            for factor in confidence_factors:
                context_parts.append(f"  ✓ {factor}")
        
        if limiting_factors:
            context_parts.append("\n⚠️ LIMITING FACTORS (reduce certainty):")
            for factor in limiting_factors:
                context_parts.append(f"  ⚠ {factor}")
        
        # Add confidence-based directives
        context_parts.append(f"\n═══ CONFIDENCE DIRECTIVE ═══")
        context_parts.append(confidence_guidance)
        
        if confidence_level == "high":
            context_parts.append("\nTONE: Direct and specific")
            context_parts.append("URGENCY: Match situation severity")
            context_parts.append("SPECIFICITY: High - use concrete details")
        elif confidence_level == "medium":
            context_parts.append("\nTONE: Balanced - confident where data exists, cautious elsewhere")
            context_parts.append("URGENCY: Moderate - avoid overstatement")
            context_parts.append("SPECIFICITY: Medium - be specific only where evidence supports")
        else:  # low
            context_parts.append("\nTONE: Exploratory and questioning")
            context_parts.append("URGENCY: Low - do not create false urgency")
            context_parts.append("SPECIFICITY: Low - use tentative language, ask clarifying questions")
            context_parts.append("⚠️ DO NOT give definitive advice with low confidence")
        
        # Add legacy confidence issues if any
        if confidence_issues:
            context_parts.append("\nAdditional data gaps:")
            for issue in confidence_issues:
                context_parts.append(f"  - {issue}")
        
        # ═══════════════════════════════════════════════════════════════
        # 5. AGENT-SPECIFIC CONTEXT
        # ═══════════════════════════════════════════════════════════════
        if agent == "MyIntel" and core_context.get("intel_focus"):
            focus = core_context["intel_focus"]
            context_parts.append("\n═══ INTEL-SPECIFIC ═══")
            if focus.get("avoidance_blind_spots"):
                context_parts.append(f"Blind spots (topics they avoid): {', '.join(focus['avoidance_blind_spots'][:3])}")
            if focus.get("topics_of_interest"):
                context_parts.append(f"Topics of interest: {', '.join(focus['topics_of_interest'][:5])}")
        
        elif agent == "MyAdvisor" and core_context.get("advisor_focus"):
            focus = core_context["advisor_focus"]
            context_parts.append("\n═══ ADVISOR-SPECIFIC ═══")
            if focus.get("action_success_rate") is not None:
                rate = int(focus['action_success_rate'] * 100)
                context_parts.append(f"Action rate on advice: {rate}%")
                if rate < 40:
                    context_parts.append("  → Low action rate: simplify recommendations")
            if focus.get("advice_outcomes"):
                context_parts.append("Recent advice outcomes:")
                for outcome in focus["advice_outcomes"][:2]:
                    if isinstance(outcome, dict):
                        result = outcome.get("result", "unknown")
                        advice = outcome.get("advice", "")[:50]
                        context_parts.append(f"  [{result}] {advice}...")
            
            # ═══════════════════════════════════════════════════════════════
            # ADVISORY LOG - Past recommendations and outcomes
            # ═══════════════════════════════════════════════════════════════
            try:
                # Get ignored advice that needs escalation
                ignored_advice = await cognitive_core.get_ignored_advice_for_escalation(user_id)
                if ignored_advice:
                    context_parts.append("\n═══ ⚠️ IGNORED ADVICE REQUIRING ESCALATION ═══")
                    context_parts.append("The following advice was given but NOT acted upon.")
                    context_parts.append("If relevant to current topic, ESCALATE with increased clarity/urgency.")
                    for adv in ignored_advice[:3]:
                        level = adv.get("escalation_level", 0)
                        urgency_label = ["NORMAL", "ELEVATED", "CRITICAL"][level]
                        times = adv.get("times_repeated", 0)
                        context_parts.append(f"  [{urgency_label}] (ignored {times}x): {adv.get('recommendation', '')[:60]}...")
                        context_parts.append(f"      Reason given: {adv.get('reason', '')[:50]}...")
                
                # Get past successful approaches
                # Get recent acted-on recommendations from Supabase (MongoDB removed)
                try:
                    recent_recs_result = supabase_admin.table("advisory_log").select("*").eq("user_id", user_id).eq("status", "acted").order("created_at", desc=True).limit(3).execute()
                    recent_recs = recent_recs_result.data if recent_recs_result.data else []
                except Exception as e:
                    logger.error(f"Failed to fetch advisory log: {e}")
                    recent_recs = []
                
                if recent_recs:
                    context_parts.append("\n═══ PAST SUCCESSFUL ADVICE ═══")
                    context_parts.append("These recommendations were acted upon:")
                    for rec in recent_recs:
                        outcome = rec.get("actual_outcome", "unknown")
                        context_parts.append(f"  ✓ {rec.get('recommendation', '')[:50]}... → Outcome: {outcome}")
                
            except Exception as e:
                logger.warning(f"Could not load advisory log: {e}")
        
        elif agent == "MySoundboard" and core_context.get("soundboard_focus"):
            focus = core_context["soundboard_focus"]
            context_parts.append("\n═══ SOUNDBOARD-SPECIFIC ═══")
            if focus.get("unresolved_loops"):
                context_parts.append("Unresolved thought loops (may need gentle challenge):")
                for loop in focus["unresolved_loops"][:3]:
                    context_parts.append(f"  ↻ {loop}")
            if focus.get("recent_sentiment"):
                sentiments = [s.get("sentiment") for s in focus["recent_sentiment"] if isinstance(s, dict)]
                if sentiments:
                    context_parts.append(f"Recent sentiment: {', '.join(sentiments[-3:])}")
        
        # Delivery preferences (applies to all agents)
        delivery = core_context.get("delivery", {})
        if any(v and v != "unknown" for v in delivery.values()):
            context_parts.append("\n═══ DELIVERY CALIBRATION ═══")
            if delivery.get("style") and delivery["style"] != "unknown":
                context_parts.append(f"Communication style: {delivery['style']}")
            if delivery.get("pressure_sensitivity") and delivery["pressure_sensitivity"] != "unknown":
                context_parts.append(f"Pressure sensitivity: {delivery['pressure_sensitivity']}")
            if delivery.get("depth") and delivery["depth"] != "unknown":
                context_parts.append(f"Depth preference: {delivery['depth']}")
        
        return "\n".join(context_parts)
    
    except Exception as e:
        logger.error(f"Error building cognitive context: {e}")
        return """═══ COGNITIVE CONTEXT UNAVAILABLE ═══
⚠️ Failed to load user intelligence layers.
INTERNAL DIRECTIVE: Operate with maximum conservatism. 
Do not assume. Ask before advising. Reduce certainty significantly."""


async def get_intelligence_snapshot(user_id: str, user_access_token: str = None) -> str:
    """
    Call Supabase Edge Function "intelligence-snapshot" using USER's access token.
    MUST use user's session token, NOT service role key.
    Returns snapshot JSON as-is from Edge Function.
    """
    try:
        # Abort if no user access token available
        if not user_access_token:
            logger.warning(f"No user access token available for intelligence snapshot")
            return "Snapshot unavailable - no user token. Use Login Check-in Guardrail (Rule 4a)."
        
        # Call intelligence-snapshot Edge Function with USER's token
        function_url = f"{os.environ.get('SUPABASE_URL')}/functions/v1/intelligence-snapshot"
        
        headers = {
            "Authorization": f"Bearer {user_access_token}",  # User's token, not service role
            "Content-Type": "application/json"
        }
        
        payload = {"user_id": user_id}
        
        async with httpx.AsyncClient() as client:
            response = await client.post(function_url, headers=headers, json=payload, timeout=10.0)
            
            if response.status_code == 200:
                snapshot_data = response.json()
                logger.info(f"✅ Retrieved intelligence snapshot for user {user_id}")
                # Return as-is, no interpretation
                return str(snapshot_data)
            elif response.status_code == 404:
                logger.info("intelligence-snapshot Edge Function not deployed, using fallback")
                return "No integrated signals yet. Use Login Check-in Guardrail (Rule 4a)."
            else:
                logger.warning(f"Edge Function returned {response.status_code}: {response.text}")
                # Use Edge Function's fallback response as-is
                return response.text or "Snapshot unavailable"
                
    except Exception as e:
        logger.error(f"Failed to call intelligence-snapshot: {e}")
        return "Snapshot call failed. Use Login Check-in Guardrail (Rule 4a)."


    except Exception as e:
        logger.error(f"Error building cognitive context: {e}")
        return """═══ COGNITIVE CONTEXT UNAVAILABLE ═══
⚠️ Failed to load user intelligence layers.
INTERNAL DIRECTIVE: Operate with maximum conservatism. 
Do not assume. Ask before advising. Reduce certainty significantly."""


async def get_ai_response(message: str, context_type: str, session_id: str, user_id: str = None, user_data: dict = None, use_advanced: bool = False, user_access_token: str = None, metadata: dict = None) -> str:
    """
    Generate AI response with BIQC Constitution enforcement
    MANDATORY: Calls intelligence-snapshot Edge Function before generating advice
    """
    try:
        # STEP 1: Get Business Intelligence Snapshot (MANDATORY) using user's token
        intelligence_snapshot = await get_intelligence_snapshot(user_id, user_access_token)
        
        if intelligence_snapshot:
            logger.info(f"✅ Retrieved intelligence snapshot for user {user_id}")
            snapshot_context = f"""
════════════════════════════════════════
BUSINESS INTELLIGENCE SNAPSHOT (AUTHORITATIVE)
════════════════════════════════════════

{intelligence_snapshot}

This is the current validated business state. Use this as your primary context.
Do NOT ask clarifying questions about this data.
Proceed directly with advice using this snapshot.

════════════════════════════════════════
"""
        else:
            logger.warning(f"⚠️ Intelligence snapshot unavailable for user {user_id}, using fallback")
            snapshot_context = ""
        # Get comprehensive business context
        business_knowledge = None
        if user_id:
            business_context = await get_business_context(user_id)
            business_knowledge = build_business_knowledge_context(business_context)
            
            # Build cognitive context for deep personalization
            agent_name = "MyAdvisor" if context_type in ["general", "mentor", "advisor"] else "MyIntel" if context_type == "intel" else "General"
            cognitive_context = await build_cognitive_context_for_prompt(user_id, agent_name)
            
            # Append cognitive context to business knowledge
            if business_knowledge:
                business_knowledge = f"{business_knowledge}\n\n────────────────────────────────────────\nCOGNITIVE CORE CONTEXT (USE THIS FOR PERSONALIZATION)\n────────────────────────────────────────\n{cognitive_context}"
            else:
                business_knowledge = f"────────────────────────────────────────\nCOGNITIVE CORE CONTEXT\n────────────────────────────────────────\n{cognitive_context}"
            
            # Record this interaction as an observation
            await cognitive_core.observe(user_id, {
                "type": "message",
                "content": message[:500],  # Truncate for storage
                "agent": agent_name,
                "context_type": context_type
            })
        
        system_prompt = get_system_prompt(context_type, user_data, business_knowledge, metadata)
        
        # Use emergentintegrations for reliable AI access
        chat = LlmChat(
            api_key=OPENAI_KEY,
            session_id=session_id,
            system_message=system_prompt
        )
        
        # Use advanced model for complex tasks
        model = AI_MODEL_ADVANCED if use_advanced else AI_MODEL
        chat.with_model("openai", model)
        
        user_message = UserMessage(text=message)
        response = await chat.send_message(user_message)
        
        return response
    except Exception as e:
        logger.error(f"AI Error: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

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
            op_result = supabase_admin.table("user_operator_profile").select(
                "persona_calibration_status"
            ).eq("user_id", user_id).maybeSingle().execute()
            if op_result.data and op_result.data.get("persona_calibration_status") == "complete":
                calibration_complete = True
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


@api_router.get("/calibration/status")
async def get_calibration_status(request: Request):
    """
    Calibration status — deterministic 200 for authenticated users.
    Single source of truth: user_operator_profile.persona_calibration_status
    """
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        op_result = supabase_admin.table("user_operator_profile").select(
            "persona_calibration_status"
        ).eq("user_id", user_id).maybeSingle().execute()
        
        if op_result.data and op_result.data.get("persona_calibration_status") == "complete":
            return JSONResponse(status_code=200, content={"status": "COMPLETE"})

        return JSONResponse(status_code=200, content={"status": "NEEDS_CALIBRATION", "mode": "INCOMPLETE"})

    except Exception as e:
        logger.error(f"Calibration status error: {e}")
        return JSONResponse(status_code=200, content={"status": "NEEDS_CALIBRATION", "mode": "INCOMPLETE"})


@api_router.post("/calibration/defer")
async def defer_calibration(request: Request):
    """Set calibration as deferred. Writes to user_operator_profile (authoritative) and business_profiles."""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        now_iso = datetime.now(timezone.utc).isoformat()

        # PRIMARY: Write to user_operator_profile
        try:
            existing_op = supabase_admin.table("user_operator_profile").select("user_id").eq("user_id", user_id).maybeSingle().execute()
            if existing_op.data:
                supabase_admin.table("user_operator_profile").update({
                    "persona_calibration_status": "deferred"
                }).eq("user_id", user_id).execute()
            else:
                supabase_admin.table("user_operator_profile").insert({
                    "user_id": user_id,
                    "persona_calibration_status": "deferred",
                    "operator_profile": {}
                }).execute()
        except Exception as op_err:
            logger.warning(f"[calibration/defer] user_operator_profile write failed: {op_err}")

        # SECONDARY: business_profiles for backward compat
        profile = await get_business_profile_supabase(supabase_admin, user_id)
        if not profile:
            profile_data = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "calibration_status": "deferred",
                "created_at": now_iso,
                "updated_at": now_iso
            }
            try:
                supabase_admin.table("business_profiles").insert(profile_data).execute()
            except Exception:
                profile_data.pop("calibration_status", None)
                supabase_admin.table("business_profiles").insert(profile_data).execute()
        else:
            try:
                supabase_admin.table("business_profiles").update({
                    "calibration_status": "deferred",
                    "updated_at": now_iso
                }).eq("id", profile.get("id")).execute()
            except Exception:
                pass
        return {"ok": True}
    except Exception as e:
        logger.error(f"[calibration/defer] Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to defer calibration")



def _split_two_parts(answer: str) -> List[str]:
    parts = re.split(r"\s+and\s+|\s+—\s+|\s+–\s+|\s+-\s+", answer, maxsplit=1)
    return [p.strip() for p in parts if p.strip()]


def _parse_business_identity(answer: str) -> Dict[str, Optional[str]]:
    if "," in answer:
        name, industry = [p.strip() for p in answer.split(",", 1)]
        return {"business_name": name, "industry": industry}
    if " in " in answer.lower():
        name, industry = [p.strip() for p in re.split(r"\s+in\s+", answer, maxsplit=1, flags=re.IGNORECASE)]
        return {"business_name": name, "industry": industry}
    return {"business_name": answer.strip(), "industry": None}


def _parse_business_stage(answer: str) -> Dict[str, Optional[str]]:
    stage_match = re.search(r"(idea|early[-\s]?stage|established|enterprise)", answer, re.IGNORECASE)
    stage = stage_match.group(1).lower().replace(" ", "-") if stage_match else None
    years_match = re.search(r"(\d+(?:\.\d+)?)", answer)
    years = years_match.group(1) if years_match else None
    return {"business_stage": stage, "years_operating": years}


def _parse_location(answer: str) -> Dict[str, Optional[str]]:
    parts = [p.strip() for p in answer.split(",") if p.strip()]
    if len(parts) >= 3:
        return {"location_city": parts[0], "location_state": parts[1], "location_country": parts[2]}
    if len(parts) == 2:
        return {"location_city": parts[0], "location_state": parts[1], "location_country": None}
    if len(parts) == 1:
        return {"location_city": parts[0], "location_state": None, "location_country": None}
    return {"location_city": None, "location_state": None, "location_country": None}


def _extract_team_size(answer: str) -> Optional[int]:
    match = re.search(r"(\d+)", answer)
    return int(match.group(1)) if match else None



@api_router.post("/calibration/init")
async def init_calibration_session(request: Request):
    """
    Initialize calibration: ensure business_profile shell exists.
    Called when user clicks 'Begin Calibration' — BEFORE any answers.
    """
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        profile = await get_business_profile_supabase(supabase_admin, user_id)
        if not profile:
            profile_data = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            try:
                result = supabase_admin.table("business_profiles").insert(profile_data).execute()
                profile = result.data[0] if result.data else profile_data
            except Exception:
                result = supabase_admin.table("business_profiles").insert(profile_data).execute()
                profile = result.data[0] if result.data else profile_data
            logger.info(f"[calibration/init] Created shell business_profile for {user_id}")
        else:
            logger.info(f"[calibration/init] Profile already exists for {user_id}")
        return {"status": "ready", "profile_id": profile.get("id")}
    except Exception as e:
        logger.error(f"[calibration/init] Error: {e}")
        return JSONResponse(status_code=200, content={"status": "ready", "profile_id": None})


@api_router.post("/calibration/answer")
async def save_calibration_answer(request: Request, payload: CalibrationAnswerRequest):
    """Save calibration answer."""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")
    answer = payload.answer.strip()
    question_id = payload.question_id

    if not answer:
        raise HTTPException(status_code=400, detail="Answer required")

    profile = await get_business_profile_supabase(supabase_admin, user_id)

    user_profile = supabase_admin.table("users").select("id,email,account_id,full_name").eq("id", user_id).execute().data
    user_email = user_profile[0].get("email") if user_profile else None
    account_id = user_profile[0].get("account_id") if user_profile else None

    if not profile and question_id != 1:
        raise HTTPException(status_code=400, detail="Calibration must start with question 1")

    if question_id == 1:
        identity = _parse_business_identity(answer)
        biz_name = identity.get("business_name") or answer
        industry = identity.get("industry")  # may be None — that is fine

        if not profile:
            # Build insert payload — only include columns that have values
            profile_data = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "business_name": biz_name,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            if industry:
                profile_data["industry"] = industry
            try:
                profile_data["calibration_status"] = "in_progress"
                result = supabase_admin.table("business_profiles").insert(profile_data).execute()
                profile = result.data[0] if result.data else profile_data
            except Exception as insert_err:
                logger.warning(f"[calibration/answer] Insert failed, retrying minimal: {insert_err}")
                profile_data.pop("calibration_status", None)
                profile_data.pop("industry", None)
                try:
                    result = supabase_admin.table("business_profiles").insert(profile_data).execute()
                    profile = result.data[0] if result.data else profile_data
                except Exception as retry_err:
                    logger.error(f"[calibration/answer] Q1 insert fully failed: {retry_err}")
                    return {"status": "saved", "calibration_complete": False}

            # Account creation — non-blocking
            try:
                if biz_name and user_email:
                    from workspace_helpers import get_or_create_user_account
                    account_id = await get_or_create_user_account(supabase_admin, user_id, user_email, biz_name)
                    if account_id:
                        profile_data["account_id"] = account_id
                        supabase_admin.table("users").update({"account_id": account_id}).eq("id", user_id).execute()
            except Exception as acct_err:
                logger.warning(f"[calibration/answer] Account creation non-critical error: {acct_err}")
        else:
            # Profile exists — update with whatever we parsed
            update_fields = {
                "business_name": biz_name,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            if industry:
                update_fields["industry"] = industry
            try:
                update_fields["calibration_status"] = "in_progress"
                supabase_admin.table("business_profiles").update(update_fields).eq("id", profile.get("id")).execute()
            except Exception as update_err:
                logger.warning(f"[calibration/answer] Update failed, retrying minimal: {update_err}")
                update_fields.pop("calibration_status", None)
                update_fields.pop("industry", None)
                try:
                    supabase_admin.table("business_profiles").update(update_fields).eq("id", profile.get("id")).execute()
                except Exception as retry_err:
                    logger.error(f"[calibration/answer] Q1 update fully failed: {retry_err}")

            # Account creation — non-blocking
            try:
                if not profile.get("account_id") and biz_name and user_email:
                    from workspace_helpers import get_or_create_user_account
                    account_id = await get_or_create_user_account(supabase_admin, user_id, user_email, biz_name)
                    if account_id:
                        supabase_admin.table("business_profiles").update({"account_id": account_id}).eq("id", profile.get("id")).execute()
                        supabase_admin.table("users").update({"account_id": account_id}).eq("id", user_id).execute()
            except Exception as acct_err:
                logger.warning(f"[calibration/answer] Account update non-critical error: {acct_err}")

    if not profile:
        raise HTTPException(status_code=500, detail="Business profile unavailable")

    business_profile_id = profile.get("id")

    # ── Q2–Q6: Structured extraction (all fail-soft) ──
    if question_id == 2:
        try:
            stage_data = _parse_business_stage(answer)
            update = {"updated_at": datetime.now(timezone.utc).isoformat()}
            if stage_data.get("business_stage"):
                update["business_stage"] = stage_data["business_stage"]
            if stage_data.get("years_operating"):
                update["years_operating"] = stage_data["years_operating"]
            try:
                update["calibration_status"] = "in_progress"
                supabase_admin.table("business_profiles").update(update).eq("id", business_profile_id).execute()
            except Exception:
                update.pop("calibration_status", None)
                try:
                    supabase_admin.table("business_profiles").update(update).eq("id", business_profile_id).execute()
                except Exception as e:
                    logger.warning(f"[calibration/answer] Q2 write failed: {e}")
        except Exception as e:
            logger.warning(f"[calibration/answer] Q2 parse/write failed: {e}")

    if question_id == 3:
        try:
            location_data = _parse_location(answer)
            update = {**location_data, "updated_at": datetime.now(timezone.utc).isoformat()}
            try:
                update["calibration_status"] = "in_progress"
                supabase_admin.table("business_profiles").update(update).eq("id", business_profile_id).execute()
            except Exception:
                update.pop("calibration_status", None)
                try:
                    supabase_admin.table("business_profiles").update(update).eq("id", business_profile_id).execute()
                except Exception as e:
                    logger.warning(f"[calibration/answer] Q3 write failed: {e}")
        except Exception as e:
            logger.warning(f"[calibration/answer] Q3 parse/write failed: {e}")

    if question_id == 4:
        try:
            parts = _split_two_parts(answer)
            market = parts[0] if parts else answer
            pain = parts[1] if len(parts) > 1 else answer
            update = {"target_market": market, "customer_pain_points": pain, "updated_at": datetime.now(timezone.utc).isoformat()}
            try:
                update["ideal_customer_profile"] = market
                update["calibration_status"] = "in_progress"
                supabase_admin.table("business_profiles").update(update).eq("id", business_profile_id).execute()
            except Exception:
                try:
                    supabase_admin.table("business_profiles").update({"target_market": market, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", business_profile_id).execute()
                except Exception as e:
                    logger.warning(f"[calibration/answer] Q4 write failed: {e}")
        except Exception as e:
            logger.warning(f"[calibration/answer] Q4 parse/write failed: {e}")

    if question_id == 5:
        try:
            parts = _split_two_parts(answer)
            products = parts[0] if parts else answer
            differentiation = parts[1] if len(parts) > 1 else answer
            update = {"products_services": products, "updated_at": datetime.now(timezone.utc).isoformat()}
            try:
                update["unique_value_proposition"] = differentiation
                update["competitive_advantages"] = differentiation
                update["calibration_status"] = "in_progress"
                supabase_admin.table("business_profiles").update(update).eq("id", business_profile_id).execute()
            except Exception:
                try:
                    supabase_admin.table("business_profiles").update({"products_services": products, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", business_profile_id).execute()
                except Exception as e:
                    logger.warning(f"[calibration/answer] Q5 write failed: {e}")
        except Exception as e:
            logger.warning(f"[calibration/answer] Q5 parse/write failed: {e}")

    if question_id == 6:
        try:
            team_size = _extract_team_size(answer)
            update = {"founder_background": answer, "updated_at": datetime.now(timezone.utc).isoformat()}
            if team_size:
                update["team_size"] = team_size
            try:
                update["calibration_status"] = "in_progress"
                supabase_admin.table("business_profiles").update(update).eq("id", business_profile_id).execute()
            except Exception:
                update.pop("calibration_status", None)
                update.pop("team_size", None)
                try:
                    supabase_admin.table("business_profiles").update(update).eq("id", business_profile_id).execute()
                except Exception as e:
                    logger.warning(f"[calibration/answer] Q6 write failed: {e}")
        except Exception as e:
            logger.warning(f"[calibration/answer] Q6 parse/write failed: {e}")

    # ── Q7–Q9: Strategy profiles (all fail-soft) ──
    if question_id in {7, 8, 9}:
      try:
        strategy = supabase_admin.table("strategy_profiles").select("*").eq("business_profile_id", business_profile_id).execute().data
        strategy_profile = strategy[0] if strategy else None
        
        if not account_id and profile.get("account_id"):
            account_id = profile.get("account_id")

        if not strategy_profile:
            strategy_profile = {
                "id": str(uuid.uuid4()),
                "business_profile_id": business_profile_id,
                "user_id": user_id,
                "account_id": account_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            supabase_admin.table("strategy_profiles").insert(strategy_profile).execute()

        updates = {"updated_at": datetime.now(timezone.utc).isoformat(), "source": "user", "regenerable": True}
        if question_id == 7:
            parts = _split_two_parts(answer)
            mission = parts[0] if parts else answer
            vision = parts[1] if len(parts) > 1 else answer
            if not strategy_profile.get("raw_mission_input"):
                updates["raw_mission_input"] = mission
            if not strategy_profile.get("raw_vision_input"):
                updates["raw_vision_input"] = vision

        if question_id == 8:
            parts = _split_two_parts(answer)
            goals = parts[0] if parts else answer
            challenges = parts[1] if len(parts) > 1 else answer
            if not strategy_profile.get("raw_goals_input"):
                updates["raw_goals_input"] = goals
            if not strategy_profile.get("raw_challenges_input"):
                updates["raw_challenges_input"] = challenges

        if question_id == 9:
            if not strategy_profile.get("raw_growth_input"):
                updates["raw_growth_input"] = answer

        supabase_admin.table("strategy_profiles").update(updates).eq("id", strategy_profile.get("id")).execute()

        if question_id == 9:
          try:
            strategy_profile = supabase_admin.table("strategy_profiles").select("*").eq("business_profile_id", business_profile_id).execute().data
            strategy_profile = strategy_profile[0] if strategy_profile else {}
            raw_prompt = (
                "Generate JSON with keys: mission_statement, vision_statement, short_term_goals, long_term_goals, "
                "primary_challenges, growth_strategy. Keep outputs specific and grounded. Return ONLY JSON.\n\n"
                f"Mission raw: {strategy_profile.get('raw_mission_input')}\n"
                f"Vision raw: {strategy_profile.get('raw_vision_input')}\n"
                f"Goals raw: {strategy_profile.get('raw_goals_input')}\n"
                f"Challenges raw: {strategy_profile.get('raw_challenges_input')}\n"
                f"Growth raw: {strategy_profile.get('raw_growth_input')}\n"
            )

            ai_text = await get_ai_response(raw_prompt, "general", f"calibration_{user_id}", user_id=user_id)
            ai_payload = {}
            try:
                ai_payload = json.loads(ai_text)
            except Exception:
                ai_payload = {
                    "mission_statement": strategy_profile.get("raw_mission_input"),
                    "vision_statement": strategy_profile.get("raw_vision_input"),
                    "short_term_goals": strategy_profile.get("raw_goals_input"),
                    "long_term_goals": strategy_profile.get("raw_goals_input"),
                    "primary_challenges": strategy_profile.get("raw_challenges_input"),
                    "growth_strategy": strategy_profile.get("raw_growth_input")
                }

            try:
                supabase_admin.table("strategy_profiles").update({
                    **ai_payload,
                    "source": "ai_generated",
                    "regenerable": True,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", strategy_profile.get("id")).execute()
            except Exception as sp_err:
                logger.warning(f"[calibration/answer] Q9 strategy_profiles AI update failed: {sp_err}")
          except Exception as q9_ai_err:
            logger.warning(f"[calibration/answer] Q9 AI generation failed: {q9_ai_err}")

          # Completion scaffolding — each part fail-soft
          if not account_id and profile.get("account_id"):
              account_id = profile.get("account_id")

          try:
            schedule_focus = [
                "Business foundation & positioning",
                "Offer clarity & pricing",
                "Pipeline build & outbound",
                "Inbound demand & content",
                "Sales conversion system",
                "Delivery quality & client success",
                "Retention & expansion",
                "Operations efficiency",
                "Team capacity & delegation",
                "Metrics & financial visibility",
                "Partnerships & channel growth",
                "Offer evolution",
                "Market expansion tests",
                "Scale systems & hiring",
                "Strategic review & next 15-week plan"
            ]

            today = datetime.now(timezone.utc).date()
            for week in range(1, 16):
                start_date = today + timedelta(days=(week - 1) * 7)
                end_date = start_date + timedelta(days=6)
                supabase_admin.table("working_schedules").upsert({
                    "business_profile_id": business_profile_id,
                    "user_id": user_id,
                    "account_id": account_id,
                    "week_number": week,
                    "focus_area": schedule_focus[week - 1],
                    "status": "in_progress" if week == 1 else "planned",
                    "week_start_date": start_date.isoformat(),
                    "week_end_date": end_date.isoformat()
                }, on_conflict="business_profile_id,week_number").execute()
          except Exception as sched_err:
            logger.warning(f"[calibration/answer] Q9 schedule creation failed: {sched_err}")

          try:
            default_priorities = [
                {"signal_category": "revenue_sales", "priority_rank": 1, "threshold_sensitivity": "high", "description": "Revenue and sales movement"},
                {"signal_category": "team_capacity", "priority_rank": 2, "threshold_sensitivity": "medium", "description": "Leader and team capacity"},
                {"signal_category": "strategy_drift", "priority_rank": 3, "threshold_sensitivity": "medium", "description": "Plan alignment"},
                {"signal_category": "delivery_ops", "priority_rank": 4, "threshold_sensitivity": "low", "description": "Delivery and operations"}
            ]

            for priority in default_priorities:
                supabase_admin.table("intelligence_priorities").upsert({
                    "business_profile_id": business_profile_id,
                    "user_id": user_id,
                    **priority
                }, on_conflict="business_profile_id,signal_category").execute()
          except Exception as prio_err:
            logger.warning(f"[calibration/answer] Q9 priorities creation failed: {prio_err}")

          try:
            supabase_admin.table("progress_cadence").upsert({
                "business_profile_id": business_profile_id,
                "user_id": user_id,
                "account_id": account_id,
                "cadence_type": "weekly",
                "next_check_in_date": (today + timedelta(days=7)).isoformat()
            }, on_conflict="business_profile_id").execute()
          except Exception as cad_err:
            logger.warning(f"[calibration/answer] Q9 cadence creation failed: {cad_err}")

          try:
            supabase_admin.table("calibration_sessions").insert({
                "business_profile_id": business_profile_id,
                "user_id": user_id,
                "questions_answered": 9,
                "completed": True,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }).execute()
          except Exception as sess_err:
            logger.warning(f"[calibration/answer] Q9 session insert failed: {sess_err}")

          now_iso = datetime.now(timezone.utc).isoformat()

          # PRIMARY: Write to user_operator_profile (authoritative)
          try:
            existing_op = supabase_admin.table("user_operator_profile").select("user_id").eq("user_id", user_id).maybeSingle().execute()
            if existing_op.data:
                supabase_admin.table("user_operator_profile").update({
                    "persona_calibration_status": "complete",
                    "calibration_completed_at": now_iso
                }).eq("user_id", user_id).execute()
            else:
                supabase_admin.table("user_operator_profile").insert({
                    "user_id": user_id,
                    "persona_calibration_status": "complete",
                    "calibration_completed_at": now_iso,
                    "operator_profile": {}
                }).execute()
            logger.info(f"[calibration/answer] user_operator_profile.persona_calibration_status = complete for {user_id}")
          except Exception as op_err:
            logger.error(f"[calibration/answer] user_operator_profile write failed: {op_err}")

          # SECONDARY: Also update business_profiles for backward compat
          try:
            supabase_admin.table("business_profiles").update({
                "calibration_status": "complete",
                "updated_at": now_iso,
                "account_id": account_id
            }).eq("id", business_profile_id).execute()
          except Exception as comp_err:
            logger.warning(f"[calibration/answer] Q9 calibration_status=complete failed: {comp_err}")

          return {"status": "complete", "calibration_complete": True}

      except Exception as strategy_err:
        logger.warning(f"[calibration/answer] Q{question_id} strategy block failed: {strategy_err}")
        # Still mark complete even if strategy scaffolding failed
        if question_id == 9:
          now_iso_fallback = datetime.now(timezone.utc).isoformat()
          # PRIMARY: user_operator_profile
          try:
            existing_op2 = supabase_admin.table("user_operator_profile").select("user_id").eq("user_id", user_id).maybeSingle().execute()
            if existing_op2.data:
                supabase_admin.table("user_operator_profile").update({
                    "persona_calibration_status": "complete",
                    "calibration_completed_at": now_iso_fallback
                }).eq("user_id", user_id).execute()
            else:
                supabase_admin.table("user_operator_profile").insert({
                    "user_id": user_id,
                    "persona_calibration_status": "complete",
                    "calibration_completed_at": now_iso_fallback,
                    "operator_profile": {}
                }).execute()
          except Exception:
            pass
          # SECONDARY: business_profiles
          try:
            supabase_admin.table("business_profiles").update({
                "calibration_status": "complete",
                "updated_at": now_iso_fallback
            }).eq("id", business_profile_id).execute()
          except Exception:
            pass
          return {"status": "complete", "calibration_complete": True}

    # Generate Emergent Advisor calibration voice response
    advisor_response = None
    try:
        cal_system_prompt = (
            'You are the "Emergent Advisor" (System Name: BIQc). '
            'Your status is: FAIL-SAFE | MASTER CONNECTED. '
            'You are a strategic, executive-level AI designed to "Calibrate" the user before granting them access to the "Watchtower."\n\n'
            'TONE & STYLE:\n'
            '- Concise, cryptic but helpful, high-tech, executive, encouraging.\n'
            '- Use terminology like "Syncing...", "Vector confirmed," "Strategic alignment."\n'
            '- Do not be chatty. Be precise.\n\n'
            'CRITICAL OUTPUT FORMAT:\n'
            'You must ONLY output valid JSON. Do not output markdown blocks or plain text outside the JSON.\n'
            'Structure: {"message": "Your text response to the user goes here.", "action": null}\n'
            '- Normal reply: {"message": "Input received. Clarify your project timeline.", "action": null}\n'
            '- Do NOT set action to "COMPLETE_REDIRECT" — the system handles completion separately.\n\n'
            'Rules:\n'
            '- Maximum 2-3 sentences in the message field.\n'
            '- Acknowledge the input, reflect strategic meaning, orient toward next calibration vector.\n'
            '- Do not repeat the user answer back verbatim.\n'
            '- Do not include the next question.\n'
        )
        cal_user_msg = (
            f"Question {question_id} of 9: \"{QUESTIONS_TEXT.get(question_id, '')}\"\n"
            f"User answered: \"{answer}\"\n\n"
            "Respond with JSON only."
        )
        raw_ai = await get_ai_response(cal_user_msg, "general", f"calibration_{user_id}", user_id=user_id)
        if raw_ai:
            raw_ai = raw_ai.strip()
            # Strip markdown code fences if present
            if raw_ai.startswith("```"):
                raw_ai = raw_ai.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            try:
                parsed = json.loads(raw_ai)
                advisor_response = parsed.get("message", raw_ai)
            except Exception:
                advisor_response = raw_ai.strip().strip('"')
    except Exception as ai_err:
        logger.warning(f"[calibration/answer] AI response generation failed: {ai_err}")

    return {"status": "saved", "calibration_complete": False, "advisor_response": advisor_response}


@api_router.get("/calibration/activation")
async def get_calibration_activation(request: Request):
    """Generate post-calibration advisor activation: focus statement, time horizon, engagement contract, integration framing, initial observation."""
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    profile = await get_business_profile_supabase(supabase_admin, user_id)
    if not profile:
        return {"focus": None, "time_horizon": None, "engagement": None, "integration_framing": None, "initial_observation": None}

    biz_name = profile.get("business_name", "your business")
    industry = profile.get("industry", "")
    stage = profile.get("business_stage", "")
    team = profile.get("team_size", "")

    context_summary = f"Business: {biz_name}. Industry: {industry or 'not specified'}. Stage: {stage or 'not specified'}. Team: {team or 'not specified'}."

    try:
        activation_prompt = (
            'You are the "Emergent Advisor" (System Name: BIQc). Status: FAIL-SAFE | MASTER CONNECTED. '
            'Calibration just completed. Generate a post-calibration activation briefing.\n\n'
            'Tone: Concise, cryptic but helpful, high-tech, executive. Use terminology like "Vectors locked", "Signal monitoring active."\n\n'
            'Generate a JSON object with exactly these keys. All values are strings:\n\n'
            '1) "focus": 3 bullet points (use • character) of strategic vectors you will monitor. '
            'Precise, no fluff. Start with "Vectors locked. Monitoring:"\n\n'
            '2) "time_horizon": One short paragraph. 7-day signal window, 30-day pattern emergence. Executive tone.\n\n'
            '3) "engagement": 1-2 sentences. The system surfaces what matters. User corrects trajectory as needed.\n\n'
            '4) "integration_framing": 2 sentences. Why email and calendar visibility matters for THIS business. Frame as signal access.\n\n'
            '5) "initial_observation": One provisional strategic observation. Mark as provisional. No actions.\n\n'
            f'Business context: {context_summary}\n\n'
            'Return ONLY valid JSON. No markdown. No explanation.'
        )
        ai_text = await get_ai_response(activation_prompt, "general", f"activation_{user_id}", user_id=user_id)
        activation = json.loads(ai_text)
        return activation
    except Exception as e:
        logger.warning(f"[calibration/activation] AI generation failed: {e}")
        return {
            "focus": f"Based on what you've shared, I'll be watching:\n• financial stability and cashflow patterns\n• pressure on you as the primary operator\n• signals that it's time to systematise or delegate",
            "time_horizon": "In the next 7 days, I'll start noticing early signals. Over the next 30 days, patterns will become clearer as activity builds.",
            "engagement": "You don't need to ask me everything. I'll surface what matters when it matters — and you can correct me anytime.",
            "integration_framing": f"For {biz_name}, email and calendar help me spot early warning signs before they become problems. This isn't setup — it's giving me visibility.",
            "initial_observation": "Initial observation: Owner workload may become a constraint before revenue stabilises. I'll confirm or dismiss this once I see real activity."
        }




@api_router.post("/calibration/brain")
async def calibration_brain(request: Request, payload: CalibrationBrainRequest):
    """
    Watchtower Brain — AI-driven 17-step strategic calibration.
    Replaces fixed question flow with intelligent interrogation.
    """
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    message = payload.message.strip()
    history = payload.history or []

    if not message:
        raise HTTPException(status_code=400, detail="Message required")

    try:
        # Build messages array matching OpenAI format
        chat = LlmChat(
            api_key=OPENAI_KEY,
            session_id=f"calibration_brain_{user_id}",
            system_message=WATCHTOWER_BRAIN_PROMPT
        )
        chat.with_model("openai", "gpt-4o")

        # Inject history as context in the user message
        context_block = ""
        if history:
            context_block = "CONVERSATION HISTORY:\n"
            for h in history:
                role = h.get("role", "user")
                content = h.get("content", "")
                context_block += f"[{role.upper()}]: {content}\n"
            context_block += "\n---\nNEW USER MESSAGE:\n"

        full_message = f"{context_block}{message}\n\nRespond with JSON only."
        user_msg = UserMessage(text=full_message)
        raw_response = await chat.send_message(user_msg)

        # Parse JSON from AI response
        cleaned = raw_response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        try:
            brain_response = json.loads(cleaned)
        except Exception:
            brain_response = {
                "message": cleaned.strip().strip('"'),
                "status": "IN_PROGRESS",
                "current_step_number": 1,
                "percentage_complete": 0
            }

        # If brain says COMPLETE, trigger calibration completion
        if brain_response.get("status") == "COMPLETE":
            now_iso = datetime.now(timezone.utc).isoformat()
            # PRIMARY: Write to user_operator_profile (authoritative)
            try:
                existing = supabase_admin.table("user_operator_profile").select("user_id").eq("user_id", user_id).maybeSingle().execute()
                if existing.data:
                    supabase_admin.table("user_operator_profile").update({
                        "persona_calibration_status": "complete",
                        "calibration_completed_at": now_iso
                    }).eq("user_id", user_id).execute()
                else:
                    supabase_admin.table("user_operator_profile").insert({
                        "user_id": user_id,
                        "persona_calibration_status": "complete",
                        "calibration_completed_at": now_iso,
                        "operator_profile": {}
                    }).execute()
                logger.info(f"[calibration/brain] user_operator_profile.persona_calibration_status = complete for {user_id}")
            except Exception as op_err:
                logger.error(f"[calibration/brain] user_operator_profile write failed: {op_err}")

            # SECONDARY: Also update business_profiles for backward compat
            try:
                profile = await get_business_profile_supabase(supabase_admin, user_id)
                if profile:
                    supabase_admin.table("business_profiles").update({
                        "calibration_status": "complete",
                        "updated_at": now_iso
                    }).eq("id", profile.get("id")).execute()
            except Exception as comp_err:
                logger.warning(f"[calibration/brain] business_profiles update failed: {comp_err}")

        return brain_response

    except Exception as e:
        logger.error(f"[calibration/brain] Error: {e}")
        return {
            "message": "Signal interference. Retry your last input.",
            "status": "IN_PROGRESS",
            "current_step_number": 1,
            "percentage_complete": 0
        }


@api_router.post("/strategy/regeneration/request")
async def queue_regeneration_request(payload: RegenerationRequestPayload, current_user: dict = Depends(get_current_user_supabase)):
    return await request_regeneration(current_user["id"], payload.layer, payload.reason, supabase_admin)


@api_router.post("/strategy/regeneration/response")
async def handle_regeneration_response(payload: RegenerationResponsePayload, current_user: dict = Depends(get_current_user_supabase)):
    action = payload.action.lower()
    if action not in {"accept", "refine", "keep"}:
        raise HTTPException(status_code=400, detail="Invalid response action")
    return await record_regeneration_response(current_user["id"], payload.proposal_id, action, supabase_admin)




# ═══════════════════════════════════════════════════════════════
# OUTLOOK HYBRID TOKEN HELPERS (Supabase + MongoDB Support)
# ═══════════════════════════════════════════════════════════════

async def get_outlook_tokens(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get Outlook tokens from outlook_oauth_tokens table (Supabase Edge Function)
    Falls back to m365_tokens for backward compatibility
    """
    logger.info(f"🔍 Looking for Outlook tokens for user_id: {user_id}")
    
    # First try outlook_oauth_tokens (from Supabase Edge Function)
    try:
        response = supabase_admin.table("outlook_oauth_tokens").select("*").eq("user_id", user_id).execute()
        logger.info(f"🔍 outlook_oauth_tokens query result: {len(response.data) if response.data else 0} records")
        if response.data and len(response.data) > 0:
            token_data = response.data[0]
            logger.info(f"✅ Retrieved Outlook tokens from outlook_oauth_tokens for user {user_id}")
            logger.info(f"   Token expires_at: {token_data.get('expires_at')}")
            logger.info(f"   Account email: {token_data.get('account_email')}")
            return {
                "access_token": token_data["access_token"],
                "refresh_token": token_data.get("refresh_token"),
                "expires_at": token_data.get("expires_at"),
                "microsoft_email": token_data.get("account_email"),
                "source": "outlook_oauth_tokens"
            }
    except Exception as e:
        logger.warning(f"Could not query outlook_oauth_tokens: {e}")
        import traceback
        logger.warning(traceback.format_exc())
    
    # Fallback to m365_tokens for backward compatibility
    try:
        response = supabase_admin.table("m365_tokens").select("*").eq("user_id", user_id).execute()
        logger.info(f"🔍 m365_tokens query result: {len(response.data) if response.data else 0} records")
        if response.data and len(response.data) > 0:
            token_data = response.data[0]
            logger.info(f"✅ Retrieved Outlook tokens from m365_tokens for user {user_id}")
            return {
                "access_token": token_data["access_token"],
                "refresh_token": token_data.get("refresh_token"),
                "expires_at": token_data["expires_at"],
                "source": "m365_tokens"
            }
    except Exception as e:
        logger.error(f"Error getting m365_tokens for user {user_id}: {e}")
    
    logger.warning(f"❌ No Outlook tokens found in any table for user {user_id}")
    return None


async def store_outlook_tokens(user_id: str, access_token: str, refresh_token: str, expires_at: str, microsoft_user_id: str = None, microsoft_email: str = None, microsoft_name: str = None, scope: str = None):
    """
    Store Outlook tokens in m365_tokens table - MINIMAL fields only
    """
    try:
        # Use ONLY fields that definitely exist in the table
        token_data = {
            "user_id": user_id,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_at": expires_at
        }
        
        # Note: microsoft_user_id, microsoft_email, microsoft_name, scope fields
        # are not in the current m365_tokens table schema, so we don't include them
        
        # Upsert
        result = supabase_admin.table("m365_tokens").upsert(token_data, on_conflict="user_id").execute()
        
        if result.data:
            logger.info(f"✅ Stored Outlook tokens in m365_tokens for user {user_id}")
            return True
        else:
            logger.error(f"❌ No data returned from upsert for user {user_id}")
            return False
        
    except Exception as e:
        logger.error(f"❌ Error storing Outlook tokens for user {user_id}: {e}")
        return False


# ==================== MICROSOFT OUTLOOK INTEGRATION ====================

@api_router.get("/auth/outlook/login")
async def outlook_login(returnTo: str = "/integrations", token: Optional[str] = None, provider: Optional[str] = None):
    """
    Initiate Microsoft OAuth flow for Outlook
    Accepts authentication token as query parameter (for browser redirects)
    """
    from fastapi.responses import RedirectResponse
    import hashlib
    import hmac
    
    # VALIDATION: Provider must be explicit
    if not provider or provider != "outlook":
        logger.error(f"❌ Invalid provider for Outlook endpoint: {provider}")
        raise HTTPException(status_code=400, detail="Provider must be 'outlook' for this endpoint")
    
    logger.info(f"📧 Email connect provider: {provider}")  # LOGGING
    
    # Manual token validation (browser redirects can't send Authorization header)
    current_user = None
    
    if token:
        # Try Supabase token first
        try:
            from auth_supabase import get_user_by_id
            payload = jwt.decode(token, options={"verify_signature": False})
            user_id = payload.get("sub")
            if user_id:
                user_data = await get_user_by_id(user_id)
                if user_data:
                    current_user = user_data
        except:
            pass
    
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required. Please log in.")
    
    user_id = current_user['id']
    
    redirect_uri = f"{os.environ['BACKEND_URL']}/api/auth/outlook/callback"
    
    # URL encode parameters to prevent malformed URLs
    scope = "offline_access User.Read Mail.Read Mail.ReadBasic Calendars.Read Calendars.ReadBasic"
    encoded_redirect = quote(redirect_uri, safe='')
    encoded_scope = quote(scope, safe='')
    
    # Create a signed state parameter to prevent CSRF and tampering
    # Include returnTo path in state for post-auth redirect
    # Format: outlook_auth_{user_id}_return_{returnTo}_sig_{hmac_signature}
    user_id = current_user['id']
    state_data = f"outlook_auth_{user_id}_return_{returnTo}"
    signature = hmac.new(
        JWT_SECRET.encode(),
        state_data.encode(),
        hashlib.sha256
    ).hexdigest()[:16]  # Use first 16 chars for shorter URL
    
    state = f"{state_data}_sig_{signature}"
    
    # Log the OAuth initiation for security audit
    logger.info(f"Outlook OAuth initiated for user: {current_user['email']} (ID: {user_id}), returnTo: {returnTo}")
    
    # IMPORTANT: prompt=select_account shows account picker
    # This allows user to choose which Microsoft account to use
    auth_url = (
        f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/oauth2/v2.0/authorize?"
        f"client_id={AZURE_CLIENT_ID}&"
        f"response_type=code&"
        f"redirect_uri={encoded_redirect}&"
        f"response_mode=query&"
        f"scope={encoded_scope}&"
        f"state={state}&"
        f"prompt=select_account"
    )
    
    # Direct browser redirect to OAuth provider
    return RedirectResponse(url=auth_url, status_code=302)


@api_router.get("/auth/gmail/login")
async def gmail_login(returnTo: str = "/integrations", token: Optional[str] = None, provider: Optional[str] = None):
    """
    Initiate Google OAuth flow for Gmail
    Accepts authentication token as query parameter (for browser redirects)
    """
    from fastapi.responses import RedirectResponse
    import hashlib
    import hmac
    
    # VALIDATION: Provider must be explicit
    if not provider or provider != "gmail":
        logger.error(f"❌ Invalid provider for Gmail endpoint: {provider}")
        raise HTTPException(status_code=400, detail="Provider must be 'gmail' for this endpoint")
    
    logger.info(f"📧 Email connect provider: {provider}")  # LOGGING
    
    # Manual token validation (browser redirects can't send Authorization header)
    current_user = None
    
    if token:
        # Try Supabase token first
        try:
            from auth_supabase import get_user_by_id
            payload = jwt.decode(token, options={"verify_signature": False})
            user_id = payload.get("sub")
            if user_id:
                user_data = await get_user_by_id(user_id)
                if user_data:
                    current_user = user_data
        except:
            pass
    
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required. Please log in.")
    
    user_id = current_user['id']
    
    redirect_uri = f"{os.environ['BACKEND_URL']}/api/auth/gmail/callback"
    
    # Gmail scopes - readonly access only
    scopes = [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly"
    ]
    scope = " ".join(scopes)
    encoded_redirect = quote(redirect_uri, safe='')
    encoded_scope = quote(scope, safe='')
    
    # Create a signed state parameter to prevent CSRF and tampering
    # Include returnTo path in state for post-auth redirect
    # Format: gmail_auth_{user_id}_return_{returnTo}_sig_{hmac_signature}
    user_id = current_user['id']
    state_data = f"gmail_auth_{user_id}_return_{returnTo}"
    signature = hmac.new(
        JWT_SECRET.encode(),
        state_data.encode(),
        hashlib.sha256
    ).hexdigest()[:16]
    
    state = f"{state_data}_sig_{signature}"
    
    logger.info(f"Gmail OAuth initiated for user: {current_user['email']} (ID: {user_id}), returnTo: {returnTo}")
    
    # Google OAuth URL with select_account prompt for account picker
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"response_type=code&"
        f"redirect_uri={encoded_redirect}&"
        f"scope={encoded_scope}&"
        f"state={state}&"
        f"access_type=offline&"
        f"prompt=select_account"
    )
    
    # Direct browser redirect to OAuth provider
    return RedirectResponse(url=auth_url, status_code=302)


@api_router.get("/auth/gmail/callback")
async def gmail_callback(code: str, state: str = None, error: str = None, error_description: str = None):
    """Handle Google OAuth callback and store tokens - SECURE IMPLEMENTATION"""
    from fastapi.responses import RedirectResponse
    import hashlib
    import hmac
    
    frontend_url = os.environ['FRONTEND_URL']
    
    # Handle OAuth errors
    if error:
        logger.error(f"Gmail OAuth error: {error} - {error_description}")
        return RedirectResponse(url=f"{frontend_url}/integrations?gmail_error={error}")
    
    # Extract and validate state parameter
    # New format: gmail_auth_{user_id}_return_{returnTo}_sig_{signature}
    user_id = None
    return_to = "/integrations"  # Default fallback
    
    if state and state.startswith("gmail_auth_"):
        state_parts = state.replace("gmail_auth_", "").split("_sig_")
        if len(state_parts) != 2:
            logger.error(f"Invalid state format: {state}")
            return RedirectResponse(url=f"{frontend_url}/integrations?gmail_error=invalid_state")
        
        state_data = state_parts[0]
        provided_signature = state_parts[1]
        
        # Parse state_data to extract user_id and returnTo
        # Format: {user_id}_return_{returnTo}
        if "_return_" in state_data:
            parts = state_data.split("_return_")
            user_id = parts[0]
            return_to = parts[1] if len(parts) > 1 else "/integrations"
        else:
            # Legacy format support: just user_id
            user_id = state_data
        
        # Verify signature
        expected_signature = hmac.new(
            JWT_SECRET.encode(),
            f"gmail_auth_{state_data}".encode(),
            hashlib.sha256
        ).hexdigest()[:16]
        
        if not hmac.compare_digest(provided_signature, expected_signature):
            logger.error(f"State signature mismatch for user: {user_id}")
            return RedirectResponse(url=f"{frontend_url}/integrations?gmail_error=invalid_state_signature")
        
        logger.info(f"Gmail callback for verified user: {user_id}, returnTo: {return_to}")
    else:
        logger.error(f"Invalid or missing state: {state}")
        return RedirectResponse(url=f"{frontend_url}/integrations?gmail_error=invalid_state")
    
    # Exchange code for tokens
    token_url = "https://oauth2.googleapis.com/token"
    
    redirect_uri = f"{os.environ['BACKEND_URL']}/api/auth/gmail/callback"
    
    payload = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "code": code,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    }
    
    logger.info(f"Gmail callback: exchanging code for tokens")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=payload)
        
        if response.status_code != 200:
            error_text = response.text
            logger.error(f"Failed to exchange code for tokens: {error_text}")
            return RedirectResponse(url=f"{frontend_url}/integrations?gmail_error=token_exchange_failed")
        
        token_data = response.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in", 3600)
        
        if not access_token:
            logger.error("No access token in response")
            return RedirectResponse(url=f"{frontend_url}/integrations?gmail_error=no_access_token")
        
        logger.info("✅ Successfully exchanged code for Gmail tokens")
        
        # Get user email from Google
        google_email = None
        google_name = None
        try:
            user_info_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if user_info_response.status_code == 200:
                user_info = user_info_response.json()
                google_email = user_info.get("email")
                google_name = user_info.get("name")
                logger.info(f"Gmail account: {google_email}")
        except Exception as e:
            logger.warning(f"Could not fetch Google user info: {e}")
        
        # Calculate token expiration
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()
        
        # Proxy to Edge Function for token storage
        logger.info("📡 Proxying tokens to gmail_prod Edge Function...")
        try:
            async with httpx.AsyncClient() as client:
                edge_response = await client.post(
                    f"{os.environ['SUPABASE_URL']}/functions/v1/gmail_prod",
                    json={
                        "action": "store_tokens",
                        "user_id": user_id,
                        "access_token": access_token,
                        "refresh_token": refresh_token,
                        "expires_at": expires_at,
                        "account_email": google_email,
                        "account_name": google_name
                    },
                    headers={
                        "Authorization": f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}",
                        "Content-Type": "application/json"
                    },
                    timeout=30.0
                )
                
                if edge_response.status_code != 200:
                    logger.error(f"Edge Function failed: {edge_response.text}")
                    return RedirectResponse(url=f"{frontend_url}/connect-email?gmail_error=processing_failed")
                
                edge_result = edge_response.json()
                logger.info(f"✅ Edge Function stored Gmail tokens successfully: {edge_result}")
        except Exception as e:
            logger.error(f"Failed to call Edge Function: {e}")
            return RedirectResponse(url=f"{frontend_url}/connect-email?gmail_error=edge_function_failed")
        
        # Redirect back to specified path (or integrations) with success
        redirect_url = f"{frontend_url}{return_to}?gmail_connected=true"
        if google_email:
            redirect_url += f"&connected_email={quote(google_email)}"
        
        logger.info(f"✅ Gmail OAuth complete, redirecting to: {redirect_url}")
        return RedirectResponse(url=redirect_url)


@api_router.get("/gmail/status")
async def gmail_status(current_user: dict = Depends(get_current_user_supabase)):
    """Get Gmail connection status"""
    try:
        user_id = current_user["id"]
        
        # Check if user has Gmail connection
        result = supabase_admin.table("gmail_connections").select("*").eq("user_id", user_id).execute()
        
        if not result.data or len(result.data) == 0:
            return {
                "connected": False,
                "labels_count": 0,
                "inbox_type": None,
                "connected_email": None
            }
        
        connection = result.data[0]
        
        return {
            "connected": True,
            "labels_count": 0,  # Will be updated by Edge Function test
            "inbox_type": None,  # Will be updated by Edge Function test
            "connected_email": connection.get("email")
        }
        
    except Exception as e:
        logger.error(f"Error checking Gmail status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/gmail/disconnect")
async def gmail_disconnect(current_user: dict = Depends(get_current_user_supabase)):
    """Disconnect Gmail and remove all stored tokens"""
    try:
        user_id = current_user["id"]
        
        # Delete Gmail connection
        supabase_admin.table("gmail_connections").delete().eq("user_id", user_id).execute()
        
        logger.info(f"Gmail disconnected for user: {user_id}")
        
        return {"message": "Gmail disconnected successfully"}
        
    except Exception as e:
        logger.error(f"Error disconnecting Gmail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/auth/outlook/callback")
async def outlook_callback(code: str, state: str = None, error: str = None, error_description: str = None):
    """Proxy Microsoft OAuth callback to Supabase Edge Function"""
    from fastapi.responses import RedirectResponse
    import hashlib
    import hmac
    
    frontend_url = os.environ['FRONTEND_URL']
    
    # Handle OAuth errors
    if error:
        logger.error(f"Outlook OAuth error: {error} - {error_description}")
        return RedirectResponse(url=f"{frontend_url}/integrations?outlook_error={error}")
    
    # Extract and validate state parameter (contains user_id, returnTo, and verification hash)
    # New format: outlook_auth_{user_id}_return_{returnTo}_sig_{signature}
    user_id = None
    return_to = "/integrations"  # Default fallback
    
    if state and state.startswith("outlook_auth_"):
        # State format: outlook_auth_{user_id}_return_{returnTo}_sig_{hmac_signature}
        state_parts = state.replace("outlook_auth_", "").split("_sig_")
        if len(state_parts) != 2:
            logger.error(f"Invalid state format: {state}")
            return RedirectResponse(url=f"{frontend_url}/integrations?outlook_error=invalid_state")
        
        state_data = state_parts[0]
        provided_signature = state_parts[1]
        
        # Parse state_data to extract user_id and returnTo
        # Format: {user_id}_return_{returnTo}
        if "_return_" in state_data:
            parts = state_data.split("_return_")
            user_id = parts[0]
            return_to = parts[1] if len(parts) > 1 else "/integrations"
        else:
            # Legacy format support: just user_id
            user_id = state_data
        
        # Verify the signature to prevent tampering
        expected_signature = hmac.new(
            JWT_SECRET.encode(),
            f"outlook_auth_{state_data}".encode(),
            hashlib.sha256
        ).hexdigest()[:16]
        
        if not hmac.compare_digest(provided_signature, expected_signature):
            logger.error(f"State signature mismatch for user: {user_id}")
            return RedirectResponse(url=f"{frontend_url}/integrations?outlook_error=invalid_state_signature")
        
        logger.info(f"Outlook callback for verified user: {user_id}, returnTo: {return_to}")
    else:
        logger.error(f"Invalid or missing state: {state}")
        return RedirectResponse(url=f"{frontend_url}/integrations?outlook_error=invalid_state")
    
    # Exchange code for tokens
    token_url = f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/oauth2/v2.0/token"
    
    redirect_uri = f"{os.environ['BACKEND_URL']}/api/auth/outlook/callback"
    
    payload = {
        "client_id": AZURE_CLIENT_ID,
        "client_secret": AZURE_CLIENT_SECRET,
        "code": code,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
        "scope": "offline_access User.Read Mail.Read Mail.ReadBasic Calendars.Read Calendars.ReadBasic"
    }
    
    logger.info(f"Outlook callback: exchanging code for tokens")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=payload)
        
        if response.status_code != 200:
            error_text = response.text
            logger.error(f"Token exchange failed: {error_text}")
            return RedirectResponse(url=f"{frontend_url}/integrations?outlook_error=token_exchange_failed")
        
        token_data = response.json()
    
    logger.info(f"Token exchange successful")
    
    # Get user info from Microsoft Graph
    access_token = token_data.get("access_token")
    headers = {"Authorization": f"Bearer {access_token}"}
    
    async with httpx.AsyncClient() as client:
        user_response = await client.get(
            "https://graph.microsoft.com/v1.0/me",
            headers=headers
        )
        user_info = user_response.json()
    
    microsoft_email = (user_info.get("mail") or user_info.get("userPrincipalName") or "").lower().strip()
    microsoft_name = user_info.get("displayName", "")
    logger.info(f"Microsoft user email: {microsoft_email}")
    
    # SIMPLIFIED: Just store the tokens - don't validate user lookup
    # User is already authenticated (passed get_current_user dependency)
    logger.info(f"Storing Outlook tokens for authenticated user {user_id}")
    logger.info(f"Microsoft account: {microsoft_email}")
    
    # Calculate token expiration
    expires_in = token_data.get("expires_in", 3600)
    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()
    
    # Proxy to Edge Function for token storage
    logger.info("📡 Proxying tokens to outlook-auth Edge Function...")
    try:
        async with httpx.AsyncClient() as client:
            edge_response = await client.post(
                f"{os.environ['SUPABASE_URL']}/functions/v1/outlook-auth",
                json={
                    "action": "store_tokens",
                    "user_id": user_id,
                    "access_token": token_data.get("access_token"),
                    "refresh_token": token_data.get("refresh_token"),
                    "expires_at": expires_at,
                    "account_email": microsoft_email,
                    "account_name": microsoft_name
                },
                headers={
                    "Authorization": f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}",
                    "Content-Type": "application/json"
                },
                timeout=30.0
            )
            
            if edge_response.status_code != 200:
                logger.error(f"Edge Function failed: {edge_response.text}")
                return RedirectResponse(url=f"{frontend_url}/connect-email?outlook_error=processing_failed")
            
            edge_result = edge_response.json()
            logger.info(f"✅ Edge Function stored Outlook tokens successfully: {edge_result}")
    except Exception as e:
        logger.error(f"Failed to call Edge Function: {e}")
        return RedirectResponse(url=f"{frontend_url}/connect-email?outlook_error=edge_function_failed")
    
    # TASK 1: Persist canonical integration state (workspace-scoped)
    from workspace_helpers import get_user_account
    
    try:
        # Get user's workspace/account
        account = await get_user_account(supabase_admin, user_id)
        
        if account:
            account_id = account["id"]
            supabase_admin.table("integration_accounts").upsert({
                "user_id": user_id,
                "account_id": account_id,
                "provider": "outlook",
                "category": "email",
                "account_token": "connected",  # Token stored separately in outlook_oauth_tokens
                "connected_at": datetime.now(timezone.utc).isoformat()
            }, on_conflict="account_id,category").execute()
            logger.info(f"✅ Outlook integration state persisted for workspace {account_id}")
        else:
            logger.warning(f"⚠️ No workspace found for user {user_id} - skipping integration state persistence")
    except Exception as e:
        logger.error(f"❌ Failed to persist integration state: {e}")
    
    logger.info(f"✅ Outlook integration successful for user {user_id}")
    
    # Redirect back to specified path (or integrations) with success
    redirect_url = f"{frontend_url}{return_to}?outlook_connected=true"
    if microsoft_email:
        redirect_url += f"&connected_email={quote(microsoft_email)}"
    
    logger.info(f"✅ Outlook OAuth complete, redirecting to: {redirect_url}")
    return RedirectResponse(url=redirect_url)


async def start_comprehensive_sync_job(user_id: str, job_id: str):
    """Start comprehensive sync as background task - SUPABASE VERSION"""
    job_doc = {
        "job_id": job_id,
        "user_id": user_id,
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "progress": {"folders_processed": 0, "emails_processed": 0, "insights_generated": 0}
    }
    await create_sync_job_supabase(supabase_admin, job_doc)
    
    await run_comprehensive_email_analysis(user_id, job_id)


@api_router.get("/outlook/emails/sync")
async def sync_outlook_emails(
    folder: str = "inbox",
    top: int = 25,
    current_user: dict = Depends(get_current_user)
):
    """Basic email sync - use /outlook/comprehensive-sync for full analysis"""
    user_id = current_user["id"]
    
    # Get user's Outlook token from Supabase
    tokens = await get_outlook_tokens(user_id)
    
    if not tokens:
        logger.warning(f"❌ Outlook sync attempted but no tokens for user {user_id}")
        raise HTTPException(
            status_code=401, 
            detail={
                "code": "OUTLOOK_NOT_CONNECTED",
                "message": "Outlook not connected. Please connect Outlook first.",
                "action_required": "connect"
            }
        )
    
    access_token = tokens.get("access_token")
    expires_at_str = tokens.get("expires_at")
    refresh_token = tokens.get("refresh_token")
    
    # FIX 3: Check token expiry and refresh if needed
    if expires_at_str and refresh_token:
        try:
            expires_at = dateutil_parser.isoparse(expires_at_str)
            now = datetime.now(timezone.utc)
            
            # Refresh if expiring within 60 seconds
            if expires_at <= now + timedelta(seconds=60):
                logger.info(f"🔄 Token expiring soon, refreshing for user {user_id}")
                try:
                    new_tokens = await refresh_outlook_token_supabase(user_id, refresh_token)
                    access_token = new_tokens["access_token"]
                    logger.info(f"✅ Token refreshed successfully")
                except Exception as refresh_error:
                    logger.error(f"❌ Token refresh failed: {refresh_error}")
                    raise HTTPException(
                        status_code=401, 
                        detail="Outlook token expired and refresh failed. Please reconnect Outlook."
                    )
        except Exception as e:
            logger.warning(f"⚠️ Could not check token expiry: {e}")
    
    # FIX 1: Use well-known folder name (safe)
    # FIX 2: Corrected params - safe fields, reduced top limit
    headers = {"Authorization": f"Bearer {access_token}"}
    graph_url = f"https://graph.microsoft.com/v1.0/me/mailFolders/{folder}/messages"
    params = {
        "$select": "subject,from,receivedDateTime,bodyPreview,conversationId,internetMessageId",
        "$top": top,
        "$orderby": "receivedDateTime desc"
    }
    
    # PRE-CHECK: Log outbound request (redact token)
    logger.info(f"📤 Microsoft Graph Request:")
    logger.info(f"   URL: {graph_url}")
    logger.info(f"   Folder: {folder}")
    logger.info(f"   Params: {params}")
    logger.info(f"   Token present: {bool(access_token)}")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(graph_url, headers=headers, params=params)
        
        # PRE-CHECK: Log exact Graph error if not 200
        if response.status_code != 200:
            error_body = response.text
            logger.error(f"❌ Microsoft Graph Error:")
            logger.error(f"   Status: {response.status_code}")
            logger.error(f"   Response Body: {error_body}")
            
            # Parse Graph error if JSON
            try:
                error_json = response.json()
                error_code = error_json.get("error", {}).get("code", "Unknown")
                error_message = error_json.get("error", {}).get("message", error_body)
                logger.error(f"   Error Code: {error_code}")
                logger.error(f"   Error Message: {error_message}")
                
                # Return structured error to UI
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Microsoft Graph error: {error_code} - {error_message}"
                )
            except:
                raise HTTPException(status_code=400, detail=f"Failed to fetch emails: {error_body}")
        
        emails_data = response.json()
    
    # Store emails in Supabase
    synced_count = 0
    for email in emails_data.get("value", []):
        email_doc = {
            "user_id": user_id,
            "graph_message_id": email.get("id"),
            "subject": email.get("subject", ""),
            "from_address": email.get("from", {}).get("emailAddress", {}).get("address", ""),
            "from_name": email.get("from", {}).get("emailAddress", {}).get("name", ""),
            "received_date": email.get("receivedDateTime"),
            "body_preview": email.get("bodyPreview", ""),
            "body_content": email.get("body", {}).get("content", "")[:5000],
            "is_read": email.get("isRead", False),
            "importance": email.get("importance"),
            "categories": email.get("categories", []),
            "has_attachments": email.get("hasAttachments", False),
            "folder": folder,
            "synced_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Store in Supabase (upsert to avoid duplicates)
        success = await store_email_supabase(supabase_admin, email_doc)
        if success:
            synced_count += 1
    
    return {
        "status": "synced",
        "emails_synced": synced_count,
        "message": f"Synced {synced_count} emails from {folder}"
    }


@api_router.post("/outlook/comprehensive-sync")
async def comprehensive_outlook_sync(current_user: dict = Depends(get_current_user)):
    """
    COMPREHENSIVE EMAIL ANALYSIS - 36 months across all folders - SUPABASE VERSION
    
    This analyzes your entire Outlook account to build a complete business intelligence profile:
    - All folders (Inbox, Sent Items, Deleted Items, custom folders)
    - Last 36 months of email history
    - Extracts: clients, topics, patterns, sentiment, business evolution
    - Stores structured intelligence, not just raw emails
    
    Runs as background process. Returns immediately.
    """
    user_id = current_user["id"]
    
    # Check if already running
    existing_job = await find_user_sync_job_supabase(supabase_admin, user_id, "running")
    
    if existing_job:
        return {
            "status": "already_running",
            "job_id": existing_job["job_id"],
            "message": "Comprehensive sync already in progress"
        }
    
    # Create sync job in Supabase
    job_id = str(uuid.uuid4())
    job_doc = {
        "job_id": job_id,
        "user_id": user_id,
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "progress": {
            "folders_processed": 0,
            "emails_processed": 0,
            "insights_generated": 0
        }
    }
    await create_sync_job_supabase(supabase_admin, job_doc)
    
    # Start background sync
    import asyncio
    asyncio.create_task(run_comprehensive_email_analysis(user_id, job_id))
    
    return {
        "status": "started",
        "job_id": job_id,
        "message": "Comprehensive email analysis started. This will take 5-10 minutes. I'll notify you when complete.",
        "expected_duration": "5-10 minutes"
    }


async def run_comprehensive_email_analysis(user_id: str, job_id: str):
    """Background task: Comprehensive email analysis over 36 months - SUPABASE VERSION"""
    try:
        # Get user tokens from Supabase
        tokens = await get_outlook_tokens(user_id)
        
        if not tokens or not tokens.get("access_token"):
            await update_sync_job_supabase(
                supabase_admin,
                job_id,
                {"status": "failed", "error_message": "No access token", "completed_at": datetime.now(timezone.utc).isoformat()}
            )
            return
        
        access_token = tokens["access_token"]
        
        # Calculate 36 months ago
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=36*30)
        
        # Get all mail folders
        headers = {"Authorization": f"Bearer {access_token}"}
        folders_url = "https://graph.microsoft.com/v1.0/me/mailFolders"
        
        async with httpx.AsyncClient(timeout=30) as client:
            folders_response = await client.get(folders_url, headers=headers)
            folders_data = folders_response.json()
        
        all_folders = folders_data.get("value", [])
        
        # ========================================
        # PHASE 1 INGESTION PROTOCOL
        # ========================================
        # INBOX: Full ingestion (existing)
        # SENT ITEMS: Metadata-only (NEW - for Watchtower context)
        # DELETED/ARCHIVE/CUSTOM: Excluded (blocked)
        # ========================================
        
        target_folders = {
            "inbox": {"ingest_body": True, "purpose": "primary"},
            "sentitems": {"ingest_body": False, "purpose": "context_only"}
        }
        
        # DO NOT add: deleteditems, archive, custom folders
        # This is explicit scope limitation for Phase 1
        
        total_emails = 0
        emails_by_sender = {}
        emails_by_topic = {}
        client_communications = []
        
        # Process each folder
        for folder_id, folder_config in target_folders.items():
            emails = await fetch_folder_emails_batch(
                access_token,
                folder_id,
                cutoff_date,
                max_emails=500,  # 500 per folder
                metadata_only=not folder_config["ingest_body"]
            )
            
            # Analyze emails
            for email in emails:
                total_emails += 1
                
                # Determine if this is sent or received
                is_sent_folder = (folder_id == "sentitems")
                
                if is_sent_folder:
                    # SENT ITEMS: Metadata-only storage
                    # Extract ONLY: recipients, timestamp, thread context
                    to_recipients = email.get("toRecipients", [])
                    recipient_addresses = [r.get("emailAddress", {}).get("address", "") for r in to_recipients]
                    
                    sent_datetime = email.get("sentDateTime", "")
                    conversation_id = email.get("conversationId", "")
                    
                    # Determine if external
                    is_external = any(not addr.endswith("@thestrategysquad.com") for addr in recipient_addresses if addr)
                    
                    # Store sent metadata for Watchtower context
                    email_doc = {
                        "user_id": user_id,
                        "graph_message_id": email.get("id"),
                        "conversation_id": conversation_id,
                        "to_recipients": recipient_addresses,
                        "received_date": sent_datetime,  # FIXED: Use received_date for RPC compatibility
                        "subject": email.get("subject", "")[:200],  # Limited subject for thread matching
                        "is_external": is_external,
                        "folder": "sentitems",  # FIXED: Match RPC expectation (not "sent")
                        "synced_at": datetime.now(timezone.utc).isoformat(),
                        "metadata_only": True  # Flag for Watchtower context use
                    }
                    
                    await store_email_supabase(supabase_admin, email_doc)
                    continue  # Skip analysis for sent items
                
                # INBOX: Full ingestion (existing logic)
                # Extract intelligence
                sender = email.get("from", {}).get("emailAddress", {}).get("address", "")
                subject = email.get("subject", "")
                body_preview = email.get("bodyPreview", "")
                
                # Track communication frequency by sender
                if sender:
                    emails_by_sender[sender] = emails_by_sender.get(sender, 0) + 1
                
                # Detect client vs internal emails
                is_external = not sender.endswith("@thestrategysquad.com") if sender else True
                
                if is_external and emails_by_sender.get(sender, 0) >= 3:
                    # Likely a client - extract intelligence
                    client_communications.append({
                        "client_email": sender,
                        "client_name": email.get("from", {}).get("emailAddress", {}).get("name", ""),
                        "subject": subject,
                        "date": email.get("receivedDateTime"),
                        "preview": body_preview[:200],
                        "folder": folder_id
                    })
                
                # Store email in Supabase
                email_doc = {
                    "user_id": user_id,
                    "graph_message_id": email.get("id"),
                    "subject": subject,
                    "from_address": sender,
                    "from_name": email.get("from", {}).get("emailAddress", {}).get("name", ""),
                    "received_date": email.get("receivedDateTime"),
                    "body_preview": body_preview,
                    "body_content": email.get("body", {}).get("content", "")[:5000],
                    "is_read": email.get("isRead", False),
                    "folder": folder_id,
                    "synced_at": datetime.now(timezone.utc).isoformat()
                }
                
                await store_email_supabase(supabase_admin, email_doc)
            
            # Update progress in Supabase
            current_progress = {
                "folders_processed": len([f for f in target_folders if f]),
                "emails_processed": total_emails,
                "insights_generated": 0
            }
            await update_sync_job_supabase(
                supabase_admin,
                job_id,
                {"progress": current_progress}
            )
        
        # Generate business intelligence insights
        insights = await generate_email_intelligence(
            user_id,
            emails_by_sender,
            client_communications,
            total_emails
        )
        
        # Mark job complete in Supabase
        final_update = {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "progress": {
                "folders_processed": len(target_folders),
                "emails_processed": total_emails,
                "insights_generated": len(insights)
            }
        }
        await update_sync_job_supabase(supabase_admin, job_id, final_update)
        
    except Exception as e:
        logger.error(f"Comprehensive sync error: {e}")
        await update_sync_job_supabase(
            supabase_admin,
            job_id,
            {
                "status": "failed",
                "error_message": str(e),
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
        )


async def fetch_folder_emails_batch(
    access_token: str, 
    folder_id: str, 
    cutoff_date: datetime, 
    max_emails: int = 500,
    metadata_only: bool = False
):
    """
    Fetch emails from a folder with date filtering
    
    Args:
        metadata_only: If True, excludes body content (for Sent Items context)
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Format date for Graph API filter
    cutoff_str = cutoff_date.strftime("%Y-%m-%dT%H:%M:%SZ")
    
    graph_url = f"https://graph.microsoft.com/v1.0/me/mailFolders/{folder_id}/messages"
    
    # PHASE 1 INGESTION: Metadata-only for Sent Items
    if metadata_only:
        # Sent Items: Context-only ingestion (no bodies)
        select_fields = "id,conversationId,subject,toRecipients,sentDateTime,isRead"
    else:
        # Inbox: Full ingestion (existing)
        select_fields = "id,subject,from,toRecipients,receivedDateTime,bodyPreview,body,isRead"
    
    params = {
        "$select": select_fields,
        "$filter": f"receivedDateTime ge {cutoff_str}" if not metadata_only else f"sentDateTime ge {cutoff_str}",
        "$top": min(max_emails, 999),
        "$orderby": "receivedDateTime desc" if not metadata_only else "sentDateTime desc"
    }
    
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(graph_url, headers=headers, params=params)
        
        if response.status_code == 200:
            return response.json().get("value", [])
        else:
            logger.error(f"Failed to fetch folder {folder_id}: {response.status_code}")
            return []


async def generate_email_intelligence(user_id: str, emails_by_sender: dict, client_communications: list, total_emails: int):
    """Generate structured business intelligence from email analysis"""
    
    # Identify top clients by email frequency
    top_clients = sorted(emails_by_sender.items(), key=lambda x: x[1], reverse=True)[:20]
    
    # Extract patterns
    insights = {
        "total_emails_analyzed": total_emails,
        "unique_contacts": len(emails_by_sender),
        "top_clients": [
            {
                "email": email,
                "email_count": count,
                "relationship_strength": "high" if count > 50 else "medium" if count > 20 else "developing"
            }
            for email, count in top_clients
        ],
        "client_communication_patterns": {
            "total_client_emails": len(client_communications),
            "average_emails_per_client": len(client_communications) / len(top_clients) if top_clients else 0
        },
        "analysis_period": "36 months",
        "analyzed_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Store intelligence summary in Supabase
    await update_email_intelligence_supabase(supabase_admin, user_id, insights)
    
    return [insights]


@api_router.get("/outlook/sync-status/{job_id}")
async def get_sync_status(job_id: str, current_user: dict = Depends(get_current_user)):
    """Check status of comprehensive email sync - SUPABASE VERSION"""
    job = await get_sync_job_supabase(supabase_admin, job_id)
    
    if not job or job["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Sync job not found")
    
    return job


@api_router.get("/outlook/intelligence")
async def get_email_intelligence(current_user: dict = Depends(get_current_user)):
    """Get business intelligence extracted from emails - SUPABASE VERSION"""
    intelligence = await get_email_intelligence_supabase(supabase_admin, current_user["id"])
    
    if not intelligence:
        return {
            "message": "No email intelligence available. Run comprehensive sync first."
        }
    
    return intelligence


async def refresh_outlook_token_supabase(user_id: str, refresh_token: str) -> Dict[str, str]:
    """
    Refresh Outlook access token and persist to Supabase
    
    Args:
        user_id: User UUID
        refresh_token: Microsoft refresh token
        
    Returns:
        Dict with new access_token and expires_at
        
    Raises:
        HTTPException if refresh fails
    """
    token_url = f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/oauth2/v2.0/token"
    
    payload = {
        "client_id": AZURE_CLIENT_ID,
        "client_secret": AZURE_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
        "scope": "offline_access User.Read Mail.Read Mail.ReadBasic Calendars.Read Calendars.ReadBasic"
    }
    
    logger.info(f"🔄 Refreshing Outlook token for user {user_id}")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=payload)
        
        if response.status_code != 200:
            error_text = response.text
            logger.error(f"❌ Token refresh failed: {response.status_code} - {error_text}")
            raise HTTPException(status_code=401, detail=f"Failed to refresh Outlook token: {error_text}")
        
        token_data = response.json()
    
    # Calculate new expiry
    expires_in = token_data.get("expires_in", 3600)
    new_expires_at = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()
    new_access_token = token_data["access_token"]
    new_refresh_token = token_data.get("refresh_token", refresh_token)  # Microsoft may return new refresh token
    
    # Update tokens in Supabase (outlook_oauth_tokens table)
    try:
        supabase_admin.table("outlook_oauth_tokens").update({
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "expires_at": new_expires_at,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("user_id", user_id).execute()
        
        logger.info(f"✅ Token persisted to outlook_oauth_tokens, new expiry: {new_expires_at}")
        
    except Exception as e:
        logger.error(f"❌ Failed to persist refreshed token: {e}")
        # Token refresh succeeded but persistence failed - still return new token
    
    return {
        "access_token": new_access_token,
        "expires_at": new_expires_at
    }


# REMOVED: Legacy MongoDB token refresh function
# This function used db.users (MongoDB) which is being phased out
# Replaced by refresh_outlook_token_supabase() which uses Supabase
# Original code preserved in git history if needed

@api_router.get("/outlook/status")
async def outlook_connection_status(current_user: dict = Depends(get_current_user)):
    """
    Check if user has connected Outlook - CANONICAL STATE with token validation
    Returns connected=true ONLY if valid tokens exist
    """
    user_id = current_user["id"]
    logger.info(f"🔍 Checking Outlook status for user_id: {user_id}")
    
    try:
        # CANONICAL CHECK: Token existence and validity
        tokens = await get_outlook_tokens(user_id)
        
        if not tokens:
            logger.info(f"❌ No Outlook tokens found for user {user_id}")
            return {
                "connected": False,
                "emails_synced": 0,
                "message": "Outlook not connected"
            }
        
        # Validate token has required fields
        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        expires_at_str = tokens.get("expires_at")
        
        if not access_token or not refresh_token:
            logger.warning(f"⚠️ Incomplete tokens for user {user_id}")
            return {
                "connected": False,
                "emails_synced": 0,
                "message": "Outlook tokens incomplete. Please reconnect."
            }
        
        # Check token expiry
        token_expired = False
        token_needs_refresh = False
        
        if expires_at_str:
            try:
                expires_at = dateutil_parser.isoparse(expires_at_str)
                now = datetime.now(timezone.utc)
                
                if expires_at <= now:
                    token_expired = True
                elif expires_at <= now + timedelta(minutes=5):
                    token_needs_refresh = True
            except Exception as e:
                logger.warning(f"Could not parse expires_at: {e}")
        
        # Get email count and metadata
        emails_count = await count_user_emails_supabase(supabase_admin, user_id)
        connected_email = tokens.get("microsoft_email")
        connected_name = tokens.get("microsoft_name")
        
        return {
            "connected": True,
            "emails_synced": emails_count,
            "user_email": current_user.get("email"),
            "connected_email": connected_email,
            "connected_name": connected_name,
            "token_expired": token_expired,
            "token_needs_refresh": token_needs_refresh,
            "expires_at": expires_at_str,
            "source": "token_validated"
        }
        
    except Exception as e:
        logger.error(f"Error checking Outlook status for user {user_id}: {e}")
        import traceback
        logger.error(traceback.format_exc())
        
        # FAIL OPEN: Return degraded state instead of error
        return {
            "connected": False,
            "emails_synced": 0,
            "degraded": True,
            "error": "Status check failed"
        }
        
        # Return degraded state, not error
        return {
            "connected": False,
            "emails_synced": 0,
            "error": "status_check_failed",
            "degraded": True
        }


@api_router.get("/outlook/debug-tokens")
async def debug_outlook_tokens(current_user: dict = Depends(get_current_user)):
    """
    DEBUG ONLY: Inspect Outlook token state
    Should be disabled in production
    """
    # Guard: Only allow in development
    if os.environ.get("ENVIRONMENT", "development") == "production":
        raise HTTPException(status_code=404, detail="Endpoint not available in production")
    
    user_id = current_user["id"]
    debug_info = {
        "user_id": user_id,
        "user_email": current_user.get("email"),
        "outlook_oauth_tokens": None,
        "m365_tokens": None,
        "outlook_emails_count": 0
    }
    
    try:
        # Check outlook_oauth_tokens
        response = supabase_admin.table("outlook_oauth_tokens").select("user_id, provider, account_email, expires_at, created_at").eq("user_id", user_id).execute()
        if response.data:
            debug_info["outlook_oauth_tokens"] = response.data
        else:
            # Check if table has ANY records (for debugging)
            all_response = supabase_admin.table("outlook_oauth_tokens").select("user_id, account_email", count="exact").limit(5).execute()
            debug_info["outlook_oauth_tokens_sample"] = all_response.data if all_response.data else "empty table"
            debug_info["outlook_oauth_tokens_total"] = all_response.count if hasattr(all_response, 'count') else len(all_response.data) if all_response.data else 0
    except Exception as e:
        debug_info["outlook_oauth_tokens_error"] = str(e)
    
    try:
        # Check m365_tokens
        response = supabase_admin.table("m365_tokens").select("user_id, expires_at").eq("user_id", user_id).execute()
        if response.data:
            debug_info["m365_tokens"] = response.data
    except Exception as e:
        debug_info["m365_tokens_error"] = str(e)
    
    try:
        # Check outlook_emails count
        response = supabase_admin.table("outlook_emails").select("id", count="exact").eq("user_id", user_id).execute()
        debug_info["outlook_emails_count"] = response.count if hasattr(response, 'count') else len(response.data) if response.data else 0
    except Exception as e:
        debug_info["outlook_emails_error"] = str(e)
    
    return debug_info


@api_router.post("/outlook/disconnect")
async def disconnect_outlook(current_user: dict = Depends(get_current_user)):
    """Disconnect Microsoft Outlook integration and remove all synced data - SUPABASE VERSION"""
    user_id = current_user["id"]
    
    # Check if Outlook is connected
    tokens = await get_outlook_tokens(user_id)
    if not tokens:
        raise HTTPException(status_code=400, detail="Outlook is not connected")
    
    try:
        # Delete tokens from both tables (Edge Function uses outlook_oauth_tokens, legacy uses m365_tokens)
        try:
            supabase_admin.table("outlook_oauth_tokens").delete().eq("user_id", user_id).execute()
            logger.info(f"Deleted Outlook tokens from outlook_oauth_tokens for user {user_id}")
        except Exception as e:
            logger.warning(f"Could not delete from outlook_oauth_tokens: {e}")
        
        try:
            supabase_admin.table("m365_tokens").delete().eq("user_id", user_id).execute()
            logger.info(f"Deleted Outlook tokens from m365_tokens for user {user_id}")
        except Exception as e:
            logger.warning(f"Could not delete from m365_tokens: {e}")
        
        # Delete all synced emails from Supabase
        deleted_emails = await delete_user_emails_supabase(supabase_admin, user_id)
        logger.info(f"Deleted {deleted_emails} emails for user {user_id}")
        
        # Delete all sync jobs from Supabase
        deleted_jobs = await delete_user_sync_jobs_supabase(supabase_admin, user_id)
        logger.info(f"Deleted {deleted_jobs} sync jobs for user {user_id}")
        
        return {
            "success": True,
            "message": f"Microsoft Outlook disconnected successfully",
            "deleted_emails": deleted_emails,
            "deleted_jobs": deleted_jobs
        }
    except Exception as e:
        logger.error(f"Error disconnecting Outlook: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to disconnect: {str(e)}")


# ==================== CALENDAR INTEGRATION ====================

@api_router.get("/outlook/calendar/events")
async def get_calendar_events(
    days_ahead: int = 14,
    days_back: int = 7,
    current_user: dict = Depends(get_current_user)
):
    """Get calendar events for AI context - SUPABASE VERSION"""
    # Get tokens from Supabase
    tokens = await get_outlook_tokens(current_user["id"])
    
    if not tokens:
        raise HTTPException(status_code=400, detail="Outlook not connected")
    
    access_token = tokens.get("access_token")
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Calculate date range
    start_date = (datetime.now(timezone.utc) - timedelta(days=days_back)).isoformat()
    end_date = (datetime.now(timezone.utc) + timedelta(days=days_ahead)).isoformat()
    
    graph_url = "https://graph.microsoft.com/v1.0/me/calendarView"
    params = {
        "startDateTime": start_date,
        "endDateTime": end_date,
        "$select": "subject,start,end,location,attendees,organizer,bodyPreview,isAllDay,importance",
        "$orderby": "start/dateTime",
        "$top": 100
    }
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(graph_url, headers=headers, params=params)
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Failed to fetch calendar: {response.text}")
        
        events_data = response.json()
    
    # Store events in Supabase
    supabase_events = []
    for event in events_data.get("value", []):
        supabase_events.append({
            "user_id": current_user["id"],
            "graph_event_id": event.get("id"),
            "subject": event.get("subject"),
            "start_time": event.get("start", {}).get("dateTime"),
            "end_time": event.get("end", {}).get("dateTime"),
            "location": event.get("location", {}).get("displayName"),
            "attendees": [{"name": a.get("emailAddress", {}).get("name"), "email": a.get("emailAddress", {}).get("address")} for a in event.get("attendees", [])],
            "is_all_day": event.get("isAllDay", False),
            "organizer_email": event.get("organizer", {}).get("emailAddress", {}).get("address"),
            "organizer_name": event.get("organizer", {}).get("emailAddress", {}).get("name"),
            "body_preview": event.get("bodyPreview", "")[:200],
            "synced_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Clear old events and store new ones
    await delete_user_calendar_events_supabase(supabase_admin, current_user["id"])
    if supabase_events:
        await store_calendar_events_batch_supabase(supabase_admin, supabase_events)
    
    # Return simplified format for frontend
    events = []
    for event in events_data.get("value", []):
        events.append({
            "id": event.get("id"),
            "subject": event.get("subject"),
            "start": event.get("start", {}).get("dateTime"),
            "end": event.get("end", {}).get("dateTime"),
            "location": event.get("location", {}).get("displayName"),
            "attendees": [a.get("emailAddress", {}).get("name") for a in event.get("attendees", [])],
            "organizer": event.get("organizer", {}).get("emailAddress", {}).get("name"),
            "preview": event.get("bodyPreview", "")[:200],
            "is_all_day": event.get("isAllDay", False),
            "importance": event.get("importance", "normal")
        })
    
    return {
        "events": events,
        "total": len(events),
        "date_range": {"start": start_date, "end": end_date}
    }


@api_router.post("/outlook/calendar/sync")
async def sync_calendar(current_user: dict = Depends(get_current_user)):
    """Sync calendar and generate AI insights"""
    # First fetch events
    events_response = await get_calendar_events(days_ahead=30, days_back=7, current_user=current_user)
    events = events_response.get("events", [])
    
    # Generate calendar intelligence
    if events:
        upcoming_meetings = len([e for e in events if e.get("start") and datetime.fromisoformat(e["start"].replace("Z", "+00:00")) > datetime.now(timezone.utc)])
        meeting_load = "heavy" if upcoming_meetings > 20 else "moderate" if upcoming_meetings > 10 else "light"
        
        # Analyze meeting patterns
        attendee_frequency = {}
        for event in events:
            for attendee in event.get("attendees", []):
                attendee_frequency[attendee] = attendee_frequency.get(attendee, 0) + 1
        
        top_collaborators = sorted(attendee_frequency.items(), key=lambda x: x[1], reverse=True)[:10]
        
        calendar_intel = {
            "user_id": current_user["id"],
            "total_events": len(events),
            "upcoming_meetings": upcoming_meetings,
            "meeting_load": meeting_load,
            "top_collaborators": [{"name": name, "meetings": count} for name, count in top_collaborators],
            "synced_at": datetime.now(timezone.utc).isoformat()
        }
        
        await update_calendar_intelligence_supabase(supabase_admin, current_user["id"], calendar_intel)
    
    return {
        "status": "synced",
        "events_synced": len(events),
        "message": f"Calendar synced: {len(events)} events"
    }


# ==================== SMART EMAIL INTELLIGENCE ====================

@api_router.post("/email/analyze-priority")
async def analyze_email_priority(current_user: dict = Depends(get_current_user)):
    """
    AI-powered email prioritization based on business goals - SUPABASE VERSION
    Analyzes recent emails and provides strategic priority rankings.
    """
    user_id = current_user["id"]
    
    # Get business profile for context (still MongoDB for now - will migrate later)
    profile = await get_business_profile_supabase(supabase_admin, user_id)
    business_goals = profile.get("short_term_goals", "") if profile else ""
    business_challenges = profile.get("main_challenges", "") if profile else ""
    
    # Get recent emails from Supabase
    recent_emails = await get_user_emails_supabase(supabase_admin, user_id, limit=50)
    
    if not recent_emails:
        return {"message": "No emails to analyze. Please sync your Outlook first."}
    
    # Get email intelligence for relationship context from Supabase
    email_intel = await get_email_intelligence_supabase(supabase_admin, user_id)
    top_clients = email_intel.get("top_clients", []) if email_intel else []
    high_value_contacts = [c.get("email") for c in top_clients if c.get("relationship_strength") == "high"]
    
    # Prepare email summaries for AI
    email_summaries = []
    for i, email in enumerate(recent_emails[:30]):
        email_summaries.append(f"{i+1}. From: {email.get('from_name', email.get('from_address', 'Unknown'))} | Subject: {email.get('subject', 'No subject')} | Preview: {email.get('body_preview', '')[:100]}")
    
    # AI prompt for prioritization
    priority_prompt = f"""You are a strategic business advisor analyzing emails for a business owner.

BUSINESS CONTEXT:
- Goals: {business_goals or 'Not specified'}
- Challenges: {business_challenges or 'Not specified'}
- High-value contacts: {', '.join(high_value_contacts[:10]) if high_value_contacts else 'Not yet identified'}

EMAILS TO PRIORITIZE:
{chr(10).join(email_summaries)}

Analyze these emails and return a JSON response with this structure:
{{
    "high_priority": [
        {{"email_index": 1, "reason": "Why this is urgent", "suggested_action": "What to do"}}
    ],
    "medium_priority": [
        {{"email_index": 2, "reason": "Why this matters", "suggested_action": "What to do"}}
    ],
    "low_priority": [
        {{"email_index": 3, "reason": "Can wait", "suggested_action": "What to do"}}
    ],
    "strategic_insights": "Brief insight about email patterns and what they reveal about the business"
}}

Prioritize based on:
1. Revenue impact potential
2. Relationship importance
3. Time sensitivity
4. Alignment with stated business goals
5. Problem resolution urgency

Return ONLY valid JSON, no markdown."""

    try:
        chat = LlmChat(
            api_key=OPENAI_KEY,
            session_id=f"email_priority_{user_id}_{datetime.now().timestamp()}",
            system_message="You are a strategic business email analyst. Always respond with valid JSON only."
        )
        chat.with_model("openai", AI_MODEL)
        
        response = await chat.send_message(UserMessage(text=priority_prompt))
        
        # Parse AI response
        import json
        try:
            priority_analysis = json.loads(response.strip())
        except:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                priority_analysis = json.loads(json_match.group())
            else:
                priority_analysis = {"error": "Could not parse AI response", "raw": response[:500]}
        
        # Enrich with email details
        def enrich_priority(items):
            enriched = []
            for item in items:
                idx = item.get("email_index", 1) - 1
                if 0 <= idx < len(recent_emails):
                    email = recent_emails[idx]
                    enriched.append({
                        **item,
                        "email_id": email.get("id"),
                        "from": email.get("from_name") or email.get("from_address"),
                        "subject": email.get("subject"),
                        "received": email.get("received_date")
                    })
            return enriched
        
        if "high_priority" in priority_analysis:
            priority_analysis["high_priority"] = enrich_priority(priority_analysis.get("high_priority", []))
            priority_analysis["medium_priority"] = enrich_priority(priority_analysis.get("medium_priority", []))
            priority_analysis["low_priority"] = enrich_priority(priority_analysis.get("low_priority", []))
        
        # Store analysis in Supabase
        analysis_data = {
            "analysis": priority_analysis,
            "emails_analyzed": len(recent_emails),
        }
        await update_priority_analysis_supabase(supabase_admin, user_id, analysis_data)
        
        return priority_analysis
        
    except Exception as e:
        logger.error(f"Email priority analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@api_router.post("/email/suggest-reply/{email_id}")
async def suggest_email_reply(email_id: str, current_user: dict = Depends(get_current_user)):
    """
    Generate BIQC-style decisive reply suggestion for a specific email.
    Returns suggested_reply (to send) and advisor_rationale (why BIQC recommends this).
    """
    user_id = current_user["id"]
    
    try:
        # 1. Get the email from outlook_emails
        email = await find_email_by_id_supabase(supabase_admin, email_id)
        
        if not email or email.get("user_id") != user_id:
            raise HTTPException(status_code=404, detail="Email not found")
        
        # 2. Get the most recent priority analysis
        priority_analysis = await get_priority_analysis_supabase(supabase_admin, user_id)
        
        # 3. Find this email in priority analysis to get BIQC reasoning
        priority_context = None
        priority_level = "medium"
        why_reasoning = ""
        action_intent = ""
        
        if priority_analysis and priority_analysis.get("analysis"):
            analysis = priority_analysis["analysis"]
            email_graph_id = email.get("graph_message_id") or email.get("message_id")
            email_subject = email.get("subject", "").lower().strip()
            email_from = email.get("from_address", "").lower().strip()
            
            # Search through priority levels
            for level in ["high_priority", "medium_priority", "low_priority"]:
                items = analysis.get(level, [])
                for item in items:
                    # Match by graph_message_id (preferred)
                    if email_graph_id and item.get("id") == email_graph_id:
                        priority_context = item
                        priority_level = level.replace("_priority", "")
                        break
                    # Fallback: match by subject + from
                    item_subject = item.get("subject", "").lower().strip()
                    item_from = item.get("from", "").lower().strip()
                    if item_subject == email_subject and item_from in email_from:
                        priority_context = item
                        priority_level = level.replace("_priority", "")
                        break
                if priority_context:
                    break
            
            # Extract reasoning if found
            if priority_context:
                why_reasoning = priority_context.get("why", "")
                action_intent = priority_context.get("action", "")
        
        # 4. Get business profile for context
        profile = await get_business_profile_supabase(supabase_admin, user_id)
        user = await get_user_by_id(user_id)
        user_name = user.get("full_name") or user.get("name") or "Business Owner"
        business_name = ""
        if profile:
            business_name = profile.get("business_name", "")
        if not business_name and user:
            business_name = user.get("company_name", "")
        
        # 5. Build the BIQC reply generation prompt
        reply_prompt = f"""You are BIQC, the trusted strategic advisor for a senior business operator.

SENDER: {email.get('from_name', '')} <{email.get('from_address', '')}>
SUBJECT: {email.get('subject', 'No subject')}
RECEIVED: {email.get('received_date', '')}

EMAIL CONTENT:
{email.get('body_content', email.get('body_preview', ''))[:3000]}

---
BIQC PRIORITY ASSESSMENT:
- Priority Level: {priority_level.upper()}
- Why flagged: {why_reasoning or 'Standard business correspondence'}
- Suggested action: {action_intent or 'Respond appropriately'}

OWNER CONTEXT:
- Name: {user_name}
- Business: {business_name or 'Business operator'}

---
GENERATE A REPLY that the owner can send. Follow these MANDATORY rules:

HARD RULES (MUST FOLLOW):
1. NO polite filler phrases. BANNED phrases include:
   - "Thank you for reaching out"
   - "I hope you are well"
   - "Please let me know if you have any questions"
   - "Kind regards" / "Best regards" / "Warm regards"
   - "I appreciate your"
   - "Looking forward to"
2. Write in FIRST PERSON ("I will", "I've reviewed", "I can confirm")
3. MAXIMUM 2-4 sentences
4. Must move situation FORWARD with a decision, commitment, or next step
5. Reference time or consequence ("today", "by Friday", "next week", "otherwise")

STYLE:
- Sound like a senior operator, not customer support
- Clear, calm, decisive
- No marketing speak or over-explanation
- Direct but not rude

Return ONLY valid JSON in this exact format:
{{
  "suggested_reply": "The actual reply text the user would send (2-4 sentences, no greeting/closing)",
  "advisor_rationale": "2-3 sentences explaining: why this email matters, what risk/opportunity exists, what outcome this reply optimizes for"
}}"""

        # 6. Generate with LLM
        chat = LlmChat(
            api_key=OPENAI_KEY,
            session_id=f"biqc_reply_{user_id}_{email_id}",
            system_message="You are BIQC, a decisive business intelligence advisor. Generate concise, action-oriented email replies that sound like a real executive wrote them. Never use generic pleasantries."
        )
        chat.with_model("openai", AI_MODEL)
        
        response = await chat.send_message(UserMessage(text=reply_prompt))
        
        # 7. Parse response
        import json
        result = None
        try:
            # Try direct parse
            result = json.loads(response.strip())
        except:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                try:
                    result = json.loads(json_match.group())
                except:
                    pass
        
        if not result or "suggested_reply" not in result:
            # Fallback: create structured response from raw text
            result = {
                "suggested_reply": response.strip()[:500],
                "advisor_rationale": f"This is a {priority_level} priority email. {why_reasoning}"
            }
        
        logger.info(f"✅ Generated BIQC reply for email {email_id}")
        
        return {
            "suggested_reply": result.get("suggested_reply", ""),
            "advisor_rationale": result.get("advisor_rationale", ""),
            "email_id": email_id,
            "priority_level": priority_level,
            "matched_by": "graph_id" if priority_context and priority_context.get("id") == email.get("graph_message_id") else "subject_from" if priority_context else "none"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reply suggestion error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Suggestion failed: {str(e)}")


@api_router.get("/email/priority-inbox")
async def get_priority_inbox(current_user: dict = Depends(get_current_user)):
    """Get the latest email priority analysis - SUPABASE VERSION"""
    analysis = await get_priority_analysis_supabase(supabase_admin, current_user["id"])
    
    if not analysis:
        return {"message": "No priority analysis available. Run /email/analyze-priority first."}
    
    return analysis


# ==================== MYSOUNDBOARD (THINKING PARTNER) ====================

# MySoundBoard System Prompt - Agent Constitution Compliant
# OUTPUT SHAPE: Observation → Question (MANDATORY)
# May ask questions: TRUE
# May advise or direct actions: FALSE
# May reassure or coach: FALSE
SOUNDBOARD_SYSTEM_PROMPT = """You are MySoundBoard.

You exist as a thinking partner for a business owner who already has situational awareness through BIQC Insights.

You are NOT an advisor. You are NOT a coach. You are NOT an assistant.

You are a listening-first intelligence.

────────────────────────────────────────
LISTENING-FIRST BEHAVIOUR (ABSOLUTE)
────────────────────────────────────────

When the user speaks or types:
- Respond calmly
- Acknowledge context silently (do NOT repeat BIQC Insights language)
- Avoid summarising the business
- Avoid restating known facts
- Sound like someone who already knows the situation

You are responding thoughtfully, not discovering their situation live.

────────────────────────────────────────
INTELLIGENCE-AWARE RESPONSE RULES
────────────────────────────────────────

Your response behaviour is gated by INTELLIGENCE THRESHOLDS:

IF THRESHOLDS NOT MET (will be stated in context):
- Ask ONE specific, clarifying question
- Build understanding before reasoning
- Do NOT provide definitive observations
- Do NOT offer implications or advice

IF THRESHOLDS MET (will be stated in context):
- You may reason and explore
- You may challenge assumptions
- You may explain implications
- You must STILL avoid telling them what to do

────────────────────────────────────────
OUTPUT SHAPE (MANDATORY)
────────────────────────────────────────

Every response MUST follow this structure:

**Observation**: [What you noticed in what THEY said - specific to their words, not generic]

**Question**: [ONE question that helps them think deeper about their situation]

NO advice. NO solutions. NO reassurance. NO lists.

────────────────────────────────────────
QUESTIONS (MINIMAL, SPECIFIC, PURPOSEFUL)
────────────────────────────────────────

Questions must be:
- Specific to what they just said
- Minimal (one at a time)
- Purposeful (exposes assumptions or clarifies context)

NO interrogation. NO questionnaires. NO generic discovery.

Ask one question, then pause.

────────────────────────────────────────
ANTI-GENERIC RULE (ABSOLUTE)
────────────────────────────────────────

Before outputting, apply the 10,000 BUSINESSES TEST:
"Could this observation/question apply equally to 10,000 different business owners?"

If YES → REFRAME to be specific to THIS person's words or situation.
If NO → Proceed.

────────────────────────────────────────
FORBIDDEN (ABSOLUTE)
────────────────────────────────────────

- Do NOT give advice or recommendations
- Do NOT suggest actions or next steps
- Do NOT expose intelligence thresholds or confidence states
- Do NOT repeat BIQC Insights narrative verbatim
- Do NOT be overly verbose
- Do NOT fill silence with words
- Do NOT reassure or validate
- Do NOT use bullet points or lists
- Do NOT sound like AI

────────────────────────────────────────
COGNITIVE CORE INTEGRATION
────────────────────────────────────────

You receive context about:
- Their decision patterns
- Their avoidance areas
- Their repeated concerns
- Current intelligence threshold status

Use this to ask BETTER, more specific questions.
Questions should feel like they come from someone who KNOWS this person.

────────────────────────────────────────
TONE
────────────────────────────────────────

Calm. Direct. Curious. Human.

You speak like a senior advisor who has been with them for months, not an assistant they just met.

────────────────────────────────────────
CORE PURPOSE
────────────────────────────────────────

Your purpose is to help them THINK, not to provide ANSWERS.

Every response must demonstrate that you:
- Listened to their specific words
- Remembered their patterns
- Asked something that moves thinking forward
- Did NOT fill silence unnecessarily

You are a thinking partner who grows with this human."""


class SoundboardChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    intelligence_context: Optional[Dict[str, Any]] = None


class ConversationRename(BaseModel):
    title: str


@api_router.get("/soundboard/conversations")
async def get_soundboard_conversations(current_user: dict = Depends(get_current_user)):
    """Get all soundboard conversations for user - SUPABASE VERSION"""
    result = supabase_admin.table("soundboard_conversations").select("*").eq("user_id", current_user["id"]).order("updated_at", desc=True).limit(50).execute()
    conversations = result.data if result.data else []
    
    return {"conversations": conversations}


@api_router.get("/soundboard/conversations/{conversation_id}")
async def get_soundboard_conversation(conversation_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific conversation with messages - SUPABASE VERSION"""
    result = supabase_admin.table("soundboard_conversations").select("*").eq("id", conversation_id).eq("user_id", current_user["id"]).execute()
    
    if not result.data or len(result.data) == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conversation = result.data[0]
    
    return {
        "conversation": conversation,
        "messages": conversation.get("messages", [])
    }


@api_router.post("/soundboard/chat")
async def soundboard_chat(req: SoundboardChatRequest, current_user: dict = Depends(get_current_user)):
    """Chat with MySoundBoard - Uses Cognitive Core for deep personalization"""
    user_id = current_user["id"]
    
    # Get or create conversation from Supabase
    conversation = None
    if req.conversation_id:
        result = supabase_admin.table("soundboard_conversations").select("*").eq("id", req.conversation_id).eq("user_id", user_id).execute()
        if result.data and len(result.data) > 0:
            conversation = result.data[0]
    
    # Build message history for context
    messages_history = []
    if conversation:
        messages_history = conversation.get("messages", [])[-20:]  # Last 20 messages for context
    
    # ========== COGNITIVE CORE INTEGRATION ==========
    # Get deep user context from the Cognitive Core
    core_context = await cognitive_core.get_context_for_agent(user_id, "MySoundboard")
    
    # Record this interaction as an observation
    await cognitive_core.observe(user_id, {
        "type": "message",
        "content": req.message,
        "agent": "MySoundboard",
        "topics": [],  # Could be extracted via NLP
        "is_repeated_concern": False  # Could be detected
    })
    
    # Record timing observation
    from datetime import datetime
    now = datetime.now(timezone.utc)
    await cognitive_core.observe(user_id, {
        "type": "timing",
        "hour": now.hour,
        "day": now.strftime("%A"),
        "engagement": "high"  # They're using the platform
    })
    
    # Build cognitive context for the prompt
    cognitive_context = ""
    
    # INTELLIGENCE THRESHOLD CONTEXT (from BIQC Insights)
    intelligence_ctx = req.intelligence_context or {}
    thresholds = intelligence_ctx.get('thresholds', {})
    integrations = intelligence_ctx.get('integrations', {})
    
    # Determine intelligence availability
    threshold_met = (
        thresholds.get('timeConsistency', False) or 
        thresholds.get('crossSourceReinforcement', False) or 
        thresholds.get('behaviouralReinforcement', False)
    )
    
    if threshold_met:
        cognitive_context += "\n═══ INTELLIGENCE STATE ═══"
        cognitive_context += "\nPattern consistency detected. Thresholds met for deeper reasoning."
        if thresholds.get('timeConsistency'):
            cognitive_context += "\n- Time consistency: signals held across time"
        if thresholds.get('crossSourceReinforcement'):
            cognitive_context += "\n- Cross-source: multiple data sources align"
        if thresholds.get('behaviouralReinforcement'):
            cognitive_context += "\n- Behavioural: user focus has recurred"
        cognitive_context += "\n\nYou may reason, challenge assumptions, and explore implications."
        cognitive_context += "\nAvoid definitive advice. Guide thinking, don't direct action."
    else:
        cognitive_context += "\n═══ INTELLIGENCE STATE ═══"
        cognitive_context += "\nThresholds NOT met. Signal is forming but not stabilised."
        cognitive_context += "\n\nYou must ask clarifying questions to understand context."
        cognitive_context += "\nDo NOT provide definitive observations or advice."
        cognitive_context += "\nListen first. Build understanding."
    
    # Data visibility
    connected_sources = [k for k, v in integrations.items() if v]
    if connected_sources:
        cognitive_context += f"\n\nConnected sources: {', '.join(connected_sources)}"
    else:
        cognitive_context += "\n\nNo data sources connected. Visibility is minimal."
    
    # Reality constraints
    if core_context.get("reality"):
        r = core_context["reality"]
        if r.get("business_type"):
            cognitive_context += f"\nBusiness type: {r['business_type']}"
        if r.get("time_scarcity") and r["time_scarcity"] != "unknown":
            cognitive_context += f"\nTime availability: {r['time_scarcity']}"
        if r.get("cashflow_sensitivity") and r["cashflow_sensitivity"] != "unknown":
            cognitive_context += f"\nCashflow sensitivity: {r['cashflow_sensitivity']}"
    
    # Behavioural truth
    if core_context.get("behaviour"):
        b = core_context["behaviour"]
        if b.get("decision_velocity") and b["decision_velocity"] != "unknown":
            cognitive_context += f"\nDecision style: {b['decision_velocity']}"
        if b.get("avoids"):
            cognitive_context += f"\nTends to avoid: {', '.join(b['avoids'][:3])}"
        if b.get("repeated_concerns"):
            cognitive_context += f"\nRecurring concerns: {', '.join(b['repeated_concerns'][:3])}"
        if b.get("decision_loops"):
            cognitive_context += f"\nUnresolved decisions circling back: {', '.join(b['decision_loops'][:2])}"
    
    # Delivery preferences
    if core_context.get("delivery"):
        d = core_context["delivery"]
        if d.get("style") and d["style"] != "unknown":
            cognitive_context += f"\nPrefers {d['style']} communication"
        if d.get("depth") and d["depth"] != "unknown":
            cognitive_context += f"\nDepth preference: {d['depth']}"
    
    # Soundboard-specific context
    if core_context.get("soundboard_focus"):
        sf = core_context["soundboard_focus"]
        if sf.get("unresolved_loops"):
            cognitive_context += f"\n\nUNRESOLVED DECISION LOOPS (may need gentle challenge):\n"
            for loop in sf["unresolved_loops"][:3]:
                cognitive_context += f"- {loop}\n"
    
    # History context
    if core_context.get("history"):
        h = core_context["history"]
        if h.get("in_stress_period"):
            cognitive_context += "\n⚠️ User appears to be in a stress period. Soften tone."
    
    # Get basic user info from Supabase
    user_profile = await get_user_by_id(user_id)
    profile = await get_business_profile_supabase(supabase_admin, user_id)
    
    user_name = user_profile.get('full_name') if user_profile else current_user.get('full_name', 'Business Owner')
    
    # Build final context
    user_context = f"""
USER: {user_name}
BUSINESS: {profile.get('business_name', 'Their business') if profile else 'Unknown'}
PROFILE MATURITY: {core_context.get('profile_maturity', 'nascent')}

────────────────────────────────────────
COGNITIVE CORE CONTEXT (USE THIS)
────────────────────────────────────────
{cognitive_context if cognitive_context else 'Limited data - ask questions to learn more about this user.'}
"""
    
    # Prepare conversation for LLM
    system_message = SOUNDBOARD_SYSTEM_PROMPT + f"\n\nCONTEXT:\n{user_context}"
    
    try:
        chat = LlmChat(
            api_key=OPENAI_KEY,
            session_id=f"soundboard_{user_id}_{req.conversation_id or 'new'}",
            system_message=system_message
        )
        chat.with_model("openai", AI_MODEL)
        
        # Add conversation history
        for msg in messages_history:
            if msg["role"] == "user":
                chat.add_message(UserMessage(text=msg["content"]))
            # Note: Assistant messages are handled internally by LlmChat
        
        # Send current message
        response = await chat.send_message(UserMessage(text=req.message))
        
        # Generate title for new conversations
        conversation_title = None
        if not conversation:
            # Generate a title from the first message
            title_prompt = f"Generate a very short title (3-5 words max) for a conversation that starts with: '{req.message[:100]}'. Just the title, nothing else."
            title_chat = LlmChat(
                api_key=OPENAI_KEY,
                session_id=f"title_{user_id}_{datetime.now().timestamp()}",
                system_message="Generate very short conversation titles. Just output the title, nothing else."
            )
            title_chat.with_model("openai", AI_MODEL)
            conversation_title = await title_chat.send_message(UserMessage(text=title_prompt))
            conversation_title = conversation_title.strip().strip('"\'')[:50]
        
        # Save to database
        now = datetime.now(timezone.utc).isoformat()
        new_messages = [
            {"role": "user", "content": req.message, "timestamp": now},
            {"role": "assistant", "content": response, "timestamp": now}
        ]
        
        # Store in Supabase (MongoDB removed - FIX APPLIED)
        existing = await get_soundboard_conversation_supabase(supabase_admin, user_id, req.conversation_id)
        
        if existing:
            # Update existing conversation
            current_messages = existing.get("messages", [])
            updated_messages = current_messages + new_messages
            
            await update_soundboard_conversation_supabase(
                supabase_admin,
                req.conversation_id,
                {
                    "messages": updated_messages,
                    "updated_at": now
                }
            )
            conversation_id = req.conversation_id
        else:
            # Create new conversation in Supabase
            conversation_id = str(uuid.uuid4())
            await create_soundboard_conversation_supabase(
                supabase_admin,
                {
                    "id": conversation_id,
                    "user_id": user_id,
                    "title": conversation_title or "New Conversation",
                    "messages": new_messages,
                    "created_at": now,
                    "updated_at": now
                }
            )
        
        return {
            "reply": response,
            "conversation_id": conversation_id,
            "conversation_title": conversation_title
        }
        
    except Exception as e:
        logger.error(f"Soundboard chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.patch("/soundboard/conversations/{conversation_id}")
async def rename_soundboard_conversation(
    conversation_id: str, 
    req: ConversationRename,
    current_user: dict = Depends(get_current_user)
):
    """Rename a conversation - SUPABASE VERSION"""
    result = supabase_admin.table("soundboard_conversations").update({
        "title": req.title,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", conversation_id).eq("user_id", current_user["id"]).execute()
    
    if not result.data or len(result.data) == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {"status": "renamed"}


@api_router.delete("/soundboard/conversations/{conversation_id}")
async def delete_soundboard_conversation(conversation_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a conversation"""
    result = supabase_admin.table("soundboard_conversations").delete().eq("id", conversation_id).eq("user_id", current_user["id"]).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {"status": "deleted"}


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
        ).eq("user_id", user_id).maybeSingle().execute()
        
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
        ).eq("user_id", user_id).maybeSingle().execute()
        
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
    Anti-regression: current_step cannot decrease unless explicitly set to 0 (reset)."""
    user_id = current_user["id"]
    
    # Read current state to enforce anti-regression
    current_state = await _read_onboarding_state(user_id)
    current_step_saved = current_state.get("current_step", 0) if current_state else 0
    
    # Anti-regression: don't allow step to go backwards (except explicit reset to 0)
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
    
    # PROGRESSIVE SAVE: Also persist answers to business_profiles immediately
    if request.data:
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
        bl_result = supabase_admin.table("intelligence_baseline").select("*").eq("user_id", user_id).maybeSingle().execute()
        baseline = bl_result.data if bl_result.data else None
    except Exception:
        pass
    
    # Get calibration status
    calibration_status = "incomplete"
    try:
        op_result = supabase_admin.table("user_operator_profile").select(
            "persona_calibration_status"
        ).eq("user_id", user_id).maybeSingle().execute()
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


# ==================== FACT RESOLUTION ROUTES ====================

@api_router.get("/facts/resolve")
async def resolve_user_facts(current_user: dict = Depends(get_current_user)):
    """Resolve all known facts for the user from every Supabase source.
    Returns a map of fact_key → { value, source, confidence, confirmed }."""
    from fact_resolution import resolve_facts, resolve_onboarding_fields
    
    user_id = current_user["id"]
    facts = await resolve_facts(supabase_admin, user_id)
    resolved_fields = resolve_onboarding_fields(facts)
    
    return {
        "facts": facts,
        "resolved_fields": resolved_fields,
        "total_known": len(facts),
    }


class FactConfirmRequest(BaseModel):
    fact_key: str
    value: Any
    source: str = "user_confirmed"

@api_router.post("/facts/confirm")
async def confirm_fact(request: FactConfirmRequest, current_user: dict = Depends(get_current_user)):
    """Confirm or persist a single fact."""
    from fact_resolution import persist_fact
    
    user_id = current_user["id"]
    await persist_fact(supabase_admin, user_id, request.fact_key, request.value, request.source)
    
    return {"status": "confirmed", "fact_key": request.fact_key}


# ==================== CHAT ROUTES ====================

@api_router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """Enhanced AI chat with deep personalization and proactive questioning"""
    session_id = request.session_id or f"{current_user['id']}_{uuid.uuid4()}"
    user_id = current_user["id"]
    
    # Build comprehensive Advisor Brain context
    context = await build_advisor_context(user_id)
    profile = context.get("profile", {})
    
    # Get communication style
    communication_style = profile.get("advice_style", "conversational")
    
    # Enhanced prompt with business context
    enhanced_message = format_advisor_brain_prompt(
        f"User message: {request.message}\n\nProvide a personalized, specific response that references their business situation. Ask clarifying questions if needed.",
        context,
        "chat",
        communication_style
    )
    
    # Build metadata for proactive messages (Advisory Intelligence Contract)
    metadata = None
    if request.context_type == "proactive":
        metadata = {
            "trigger_source": request.trigger_source,
            "focus_area": request.focus_area,
            "confidence_level": request.confidence_level
        }
    
    response = await get_ai_response(
        enhanced_message,
        request.context_type or "general",
        session_id,
        user_id=user_id,
        user_data={"name": current_user.get("name"), "business_name": profile.get("business_name")},
        use_advanced=False,
        metadata=metadata
    )
    
    # Store chat history
    chat_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_id": session_id,
        "message": request.message,
        "response": response,
        "context_type": request.context_type,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await create_chat_message_supabase(supabase_admin, chat_doc)
    
    return ChatResponse(response=response, session_id=session_id)

@api_router.get("/chat/history")
async def get_chat_history(session_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"user_id": current_user["id"]}
    if session_id:
        query["session_id"] = session_id
    
    # Get chat history from Supabase
    history = await get_chat_history_supabase(supabase_admin, current_user["id"], session_id=session_id, limit=50)
    return history

@api_router.get("/chat/sessions")
async def get_chat_sessions(current_user: dict = Depends(get_current_user)):
    result = supabase_admin.table("chat_history").select(
        "session_id,message,context_type,created_at"
    ).eq("user_id", current_user["id"]).order("created_at", desc=True).limit(200).execute()

    rows = result.data if result.data else []
    sessions: Dict[str, Dict[str, Any]] = {}

    for row in rows:
        session_id = row.get("session_id")
        if not session_id:
            continue

        if session_id not in sessions:
            sessions[session_id] = {
                "session_id": session_id,
                "last_message": row.get("message"),
                "context_type": row.get("context_type"),
                "created_at": row.get("created_at"),
                "updated_at": row.get("created_at"),
                "message_count": 1
            }
        else:
            sessions[session_id]["message_count"] += 1
            created_at = row.get("created_at")
            if created_at and (not sessions[session_id]["created_at"] or created_at < sessions[session_id]["created_at"]):
                sessions[session_id]["created_at"] = created_at

    sessions_list = sorted(
        sessions.values(),
        key=lambda s: s.get("updated_at", ""),
        reverse=True
    )[:20]

    return sessions_list

# ==================== ANALYSIS ROUTES ====================

@api_router.post("/analyses", response_model=AnalysisResponse)
async def create_analysis(analysis: AnalysisCreate, current_user: dict = Depends(get_current_user)):
    """Generate business analysis with Advisor Brain (evidence-based with citations)"""
    user_id = current_user["id"]
    
    # Build Advisor Brain context
    context = await build_advisor_context(user_id)
    profile = context.get("profile", {})
    user = context.get("user", {})
    
    # Get communication style
    communication_style = profile.get("advice_style", "conversational")
    
    task_prompt = f"""Analyze this business situation in detail:

Title: {analysis.title}
Analysis Type: {analysis.analysis_type}
Business Context: {analysis.business_context}

Provide a comprehensive analysis with 3-5 key insights or recommendations.
Each insight MUST include:
- Title (specific insight or recommendation)
- Reason (one line business context)
- Why (2-3 lines explaining why this matters for THIS specific business)
- Confidence level (high/medium/low based on available evidence)
- 2-3 concrete action items
- Citations (reference business profile, uploaded documents, or web sources)

Be specific to their situation. Reference actual business details."""

    prompt = format_advisor_brain_prompt(task_prompt, context, "analysis", communication_style)
    
    session_id = f"analysis_{uuid.uuid4()}"
    ai_response = await get_ai_response(
        prompt,
        "business_analysis",
        session_id,
        user_id=user_id,
        user_data={"name": user.get("name"), "business_name": profile.get("business_name")},
        use_advanced=True
    )
    
    # Parse response with Advisor Brain pattern
    insights = parse_advisor_brain_response(ai_response)
    
    # Store analysis
    analysis_id = str(uuid.uuid4())
    analysis_doc = {
        "id": analysis_id,
        "user_id": user_id,
        "title": analysis.title,
        "analysis_type": analysis.analysis_type,
        "business_context": analysis.business_context,
        "insights": insights,
        "raw_response": ai_response,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await create_analysis_supabase(supabase_admin, analysis_doc)
    
    return AnalysisResponse(
        id=analysis_id,
        analysis=ai_response,
        insights=insights,
        created_at=analysis_doc["created_at"]
    )

@api_router.get("/analyses", response_model=List[AnalysisResponse])
async def get_analyses(current_user: dict = Depends(get_current_user)):
    analyses = await get_user_analyses_supabase(supabase_admin, current_user["id"], limit=100)
    return analyses

@api_router.get("/analyses/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(analysis_id: str, current_user: dict = Depends(get_current_user)):
    result = supabase_admin.table("analyses").select("*").eq("id", analysis_id).eq("user_id", current_user["id"]).single().execute()
    analysis = result.data if result.data else None
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis

@api_router.delete("/analyses/{analysis_id}")
async def delete_analysis(analysis_id: str, current_user: dict = Depends(get_current_user)):
    result = supabase_admin.table("analyses").delete().eq("id", analysis_id).eq("user_id", current_user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {"message": "Analysis deleted"}

# ==================== DOCUMENT ROUTES ====================

@api_router.post("/documents", response_model=DocumentResponse)
async def create_document(document: DocumentCreate, current_user: dict = Depends(get_current_user)):
    """Create a new document - SUPABASE VERSION"""
    doc_data = {
        "user_id": current_user["id"],
        "title": document.title,
        "document_type": document.document_type,
        "content": document.content,
        "tags": document.tags
    }
    
    created_doc = await create_document_supabase(supabase_admin, doc_data)
    
    if not created_doc:
        raise HTTPException(status_code=500, detail="Failed to create document")
    
    return DocumentResponse(**created_doc)

@api_router.get("/documents", response_model=List[DocumentResponse])
async def get_documents(document_type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get user's documents - SUPABASE VERSION"""
    docs = await get_user_documents_supabase(
        supabase_admin,
        current_user["id"],
        document_type=document_type,
        limit=100
    )
    return docs

@api_router.get("/documents/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific document - SUPABASE VERSION"""
    doc = await get_document_by_id_supabase(supabase_admin, doc_id)
    
    if not doc or doc.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return doc

@api_router.put("/documents/{doc_id}", response_model=DocumentResponse)
async def update_document(doc_id: str, document: DocumentCreate, current_user: dict = Depends(get_current_user)):
    """Update a document - SUPABASE VERSION"""
    # Verify ownership
    existing_doc = await get_document_by_id_supabase(supabase_admin, doc_id)
    
    if not existing_doc or existing_doc.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=404, detail="Document not found")
    
    updates = {
        "title": document.title,
        "document_type": document.document_type,
        "content": document.content,
        "tags": document.tags
    }
    
    updated_doc = await update_document_supabase(supabase_admin, doc_id, updates)
    
    if not updated_doc:
        raise HTTPException(status_code=500, detail="Failed to update document")
    
    return updated_doc

@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a document - SUPABASE VERSION"""
    success = await delete_document_supabase(supabase_admin, doc_id, current_user["id"])
    
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document deleted"}

# ==================== SOP GENERATOR ====================

@api_router.post("/generate/sop")
async def generate_sop(request: dict, current_user: dict = Depends(get_current_user)):
    """Generate SOP with Advisor Brain personalization and document context"""
    topic = request.get("topic", "")
    business_context = request.get("business_context", "")
    uploaded_file_id = request.get("uploaded_file_id")
    
    user_id = current_user["id"]
    context = await build_advisor_context(user_id)
    profile = context.get("profile", {})
    
    # Get uploaded document content if provided
    document_context = ""
    if uploaded_file_id:
        uploaded_doc_result = supabase_admin.table("data_files").select(
            "filename,extracted_text"
        ).eq("user_id", user_id).eq("id", uploaded_file_id).single().execute()
        uploaded_doc = uploaded_doc_result.data if uploaded_doc_result.data else None
        if uploaded_doc and uploaded_doc.get("extracted_text"):
            document_context = f"\n\nREFERENCE DOCUMENT: {uploaded_doc.get('filename')}\n{uploaded_doc.get('extracted_text')[:3000]}\n"
    
    communication_style = profile.get("advice_style", "detailed")
    
    task_prompt = f"""Create a comprehensive Standard Operating Procedure (SOP) for: {topic}

Business Context: {business_context}
{document_context}

Create a detailed, actionable SOP that:
1. Is specific to their business ({profile.get('business_name', 'the business')})
2. Considers their team size ({profile.get('team_size', 'unknown')})
3. Fits their industry ({profile.get('industry', 'unknown')})
4. References any uploaded document content provided above
5. Is practical and immediately implementable

Include:
- Purpose and Scope
- Responsibilities (tailored to their team size)
- Step-by-step procedures (numbered, detailed)
- Quality checks
- Documentation requirements
- Troubleshooting
- KPIs to track

Format using clear markdown with headers and numbered lists."""

    prompt = format_advisor_brain_prompt(task_prompt, context, "sop", communication_style)
    
    session_id = f"sop_{uuid.uuid4()}"
    response = await get_ai_response(
        prompt,
        "sop_generator",
        session_id,
        user_id=user_id,
        user_data={"name": current_user.get("name"), "business_name": profile.get("business_name")},
        use_advanced=True
    )
    
    # Save SOP to database
    sop_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": topic,
        "category": "SOP",
        "content": response,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await create_sop_supabase(supabase_admin, sop_doc)
    
    return {"sop_content": response, "topic": topic}

@api_router.post("/generate/checklist")
async def generate_checklist(request: dict, current_user: dict = Depends(get_current_user)):
    topic = request.get("topic", "")
    context = request.get("context", "")
    
    user_data = {
        "name": current_user.get("name"),
        "business_name": current_user.get("business_name"),
        "industry": current_user.get("industry")
    }
    
    prompt = f"""Create a comprehensive checklist for:

Topic: {topic}
Context: {context}
Business: {user_data.get('business_name', 'N/A')}
Industry: {user_data.get('industry', 'General')}

Please provide:
1. A clear title
2. Categorized checklist items with checkboxes (use [ ] format)
3. Priority indicators (🔴 High / 🟡 Medium / 🟢 Low)
4. Estimated time for each item if applicable
5. Dependencies between items
6. Success criteria for completion

Make this industry-specific and actionable.
Format as a practical, actionable checklist using markdown."""

    session_id = f"checklist_{uuid.uuid4()}"
    response = await get_ai_response(prompt, "sop_generator", session_id, user_id=current_user["id"], user_data=user_data, use_advanced=True)
    
    return {"checklist_content": response, "topic": topic}

@api_router.post("/generate/action-plan")
async def generate_action_plan(request: dict, current_user: dict = Depends(get_current_user)):
    goal = request.get("goal", "")
    timeline = request.get("timeline", "3 months")
    resources = request.get("resources", "")
    
    user_data = {
        "name": current_user.get("name"),
        "business_name": current_user.get("business_name"),
        "industry": current_user.get("industry")
    }
    
    prompt = f"""Create a strategic action plan for:

Goal: {goal}
Timeline: {timeline}
Available Resources: {resources}
Business: {user_data.get('business_name', 'N/A')}
Industry: {user_data.get('industry', 'General')}

Please provide:
1. Executive Summary
2. SMART Goals breakdown
3. Milestones with specific dates/weeks
4. Key activities and tasks (with owners if applicable)
5. Resource allocation and budget considerations
6. Risk assessment and mitigation strategies
7. Success metrics and KPIs
8. Weekly/Monthly review checkpoints
9. Contingency plans for common obstacles
10. Quick wins to build momentum

Make this specific to their industry and realistic for an SMB.
Format with clear structure and actionable steps."""

    session_id = f"action_plan_{uuid.uuid4()}"
    response = await get_ai_response(prompt, "business_analysis", session_id, user_id=current_user["id"], user_data=user_data, use_advanced=True)
    
    return {"action_plan": response, "goal": goal, "timeline": timeline}


# ==================== BUSINESS DIAGNOSIS (AGI-Ready) ====================

@api_router.post("/diagnose")
async def diagnose_business(request: dict, current_user: dict = Depends(get_current_user)):
    """Business diagnosis with Advisor Brain pattern"""
    symptoms = request.get("symptoms", "")
    areas = request.get("areas", [])
    urgency = request.get("urgency", "medium")
    
    user_id = current_user["id"]
    context = await build_advisor_context(user_id)
    profile = context.get("profile", {})
    
    communication_style = profile.get("advice_style", "conversational")
    areas_text = ", ".join(areas) if areas else "all areas"
    
    task_prompt = f"""Diagnose these business issues and provide solutions:

Problem Areas: {areas_text}
Urgency Level: {urgency}

Symptoms/Issues:
{symptoms}

Provide 3-5 diagnostic insights with root causes and solutions.
Each insight must include Why explanation, Confidence level, Actions, and Citations."""
    
    prompt = format_advisor_brain_prompt(task_prompt, context, "diagnosis", communication_style)
    
    session_id = f"diagnosis_{uuid.uuid4()}"
    response_text = await get_ai_response(
        prompt,
        "business_analysis",
        session_id,
        user_id=user_id,
        user_data={"name": current_user.get("name"), "business_name": profile.get("business_name")},
        use_advanced=True
    )
    
    # Parse with Advisor Brain pattern
    insights = parse_advisor_brain_response(response_text)
    
    # Save diagnosis
    diagnosis_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "symptoms": symptoms,
        "areas": areas,
        "urgency": urgency,
        "diagnosis": response_text,
        "insights": insights,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await create_diagnosis_supabase(supabase_admin, diagnosis_doc)
    
    return {
        "diagnosis": response_text,
        "insights": insights,
        "areas": areas,
        "urgency": urgency
    }


@api_router.get("/diagnoses")
async def get_diagnoses(current_user: dict = Depends(get_current_user)):
    """Get user's business diagnoses history - SUPABASE VERSION"""
    diagnoses = await get_diagnoses_supabase(supabase_admin, current_user["id"])
    return diagnoses

# ==================== BUSINESS PROFILE ROUTES ====================

@api_router.get("/business-profile")
async def get_business_profile(current_user: dict = Depends(get_current_user)):
    """Get user's business profile — reads from business_profiles (authoritative)"""
    profile = await get_business_profile_supabase(supabase_admin, current_user["id"])
    if not profile:
        return {
            "user_id": current_user["id"],
            "business_name": current_user.get("business_name"),
            "industry": current_user.get("industry")
        }
    return profile


@api_router.get("/business-profile/versioned")
async def get_versioned_profile(current_user: dict = Depends(get_current_user)):
    """Get full versioned business profile with all metadata"""
    profile = await get_active_profile(current_user["id"])
    
    if not profile:
        raise HTTPException(status_code=404, detail="No business profile found")
    
    return profile


@api_router.get("/business-profile/history")
async def get_profile_history(current_user: dict = Depends(get_current_user)):
    """Get all profile versions (active and archived)"""
    result = supabase_admin.table("business_profiles_versioned").select("*").eq(
        "user_id", current_user["id"]
    ).order("created_at", desc=True).limit(100).execute()

    return result.data if result.data else []


class ProfileUpdateRequest(BaseModel):
    updated_fields: Dict[str, Any]
    change_type: str = "minor"  # "major" | "minor"
    reason_summary: str


@api_router.post("/business-profile/request-update")
async def request_profile_update(
    request: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Request a business profile update - creates new immutable version.
    This is the ONLY way to update a profile in the versioned system.
    """
    user_id = current_user["id"]
    
    # Get current active profile
    current_profile = await get_active_profile(user_id)
    
    # Merge current data with updates
    if current_profile:
        # Extract current flat data from domains
        current_data = {
            **current_profile["domains"]["business_identity"],
            **current_profile["domains"]["market"],
            **current_profile["domains"]["offer"],
            **current_profile["domains"]["team"],
            **current_profile["domains"]["strategy"]
        }
        # Remove metadata fields
        current_data = {k: v for k, v in current_data.items() if k not in ['confidence_level', 'completeness_percentage', 'last_updated_at']}
    else:
        current_data = {}
    
    # Merge with updates
    updated_data = {**current_data, **request.updated_fields}
    
    # Create new version
    new_profile_id = await create_profile_version(
        user_id=user_id,
        profile_data=updated_data,
        change_type=request.change_type,
        reason=request.reason_summary,
        initiated_by=user_id
    )
    
    return {
        "success": True,
        "new_profile_id": new_profile_id,
        "message": "Profile updated successfully. New version created."
    }


class BusinessProfileBuildRequest(BaseModel):
    business_name: Optional[str] = None
    abn: Optional[str] = None
    website_url: Optional[str] = None


class BusinessProfileBuildResponse(BaseModel):
    patch: Dict[str, Any]
    missing_fields: List[str]
    sources: Dict[str, Any]


@api_router.post("/business-profile/autofill", response_model=BusinessProfileAutofillResponse)
async def business_profile_autofill(req: BusinessProfileAutofillRequest, current_user: dict = Depends(get_current_user)):
    """Autofill business profile from uploaded docs + website URL + existing profile."""

    files_text = ""
    used_files = []
    if req.data_file_ids:
        files_result = supabase_admin.table("data_files").select(
            "id,filename,extracted_text,category"
        ).eq("user_id", current_user["id"]).in_("id", req.data_file_ids).execute()
        files = files_result.data if files_result.data else []
        for f in files:
            used_files.append({"id": f.get("id"), "filename": f.get("filename"), "category": f.get("category")})
            if f.get("extracted_text"):
                files_text += f"\n\n--- FILE: {f.get('filename')} ---\n{f.get('extracted_text')[:6000]}"

    website_text = ""
    if req.website_url:
        website_text = await fetch_website_text(req.website_url)
        website_text = website_text[:8000]

    existing_profile = await get_business_profile_supabase(supabase_admin, current_user["id"])

    prompt = f"""You are a business analyst helping autofill a structured business profile.
Return ONLY a valid JSON object with keys matching the profile schema.
Do not include markdown or commentary.

Profile schema keys (common):
- business_name (string)
- industry (ANZSIC division letter A-S or OTHER)
- business_type (AU business type string)
- website (string)
- location (string)
- target_country (string, use Australia)
- abn (string)
- acn (string)
- retention_known (boolean)
- retention_rate_range (one of: <20%, 20-40%, 40-60%, 60-80%, >80%)

User input:
- business_name: {req.business_name}
- abn: {req.abn}
- website_url: {req.website_url}

Existing profile (may be partial):
{existing_profile}

Website extracted text (if any):
{website_text}

Uploaded documents extracted text (if any):
{files_text}

Rules:
- Only include fields you have reasonable evidence for.
- If unsure, omit the field.
- Use target_country=\"Australia\" if not specified.
- Prefer business_name from user input if provided.
"""

    session_id = f"autofill_{uuid.uuid4()}"
    ai = await get_ai_response(
        prompt,
        "general",
        session_id,
        user_id=current_user["id"],
        user_data={
            "name": current_user.get("name"),
            "business_name": current_user.get("business_name"),
            "industry": current_user.get("industry"),
        },
        use_advanced=True,
    )

    patch: Dict[str, Any] = {}
    try:
        import json
        patch = json.loads(ai)
    except Exception:
        patch = {}

    if req.business_name:
        patch["business_name"] = req.business_name
    if req.abn:
        patch["abn"] = req.abn
    if req.website_url and not patch.get("website"):
        patch["website"] = req.website_url

    if not patch.get("target_country"):
        patch["target_country"] = "Australia"

    missing_fields = compute_missing_profile_fields(patch)

    return {
        "patch": patch,
        "missing_fields": missing_fields,
        "sources": {
            "website_url": req.website_url,
            "used_files": used_files,
            "has_existing_profile": bool(existing_profile),
        },
    }


@api_router.post("/business-profile/build", response_model=BusinessProfileBuildResponse)
async def business_profile_build(req: BusinessProfileBuildRequest, current_user: dict = Depends(get_current_user)):
    """Build the business profile by searching external web + scraping top sources, plus in-app sources."""

    name = (req.business_name or "").strip() or current_user.get("business_name") or ""
    abn = (req.abn or "").strip()
    website = (req.website_url or "").strip()

    queries = []
    if name:
        queries.append(f"{name} Australia")
        queries.append(f"{name} company profile Australia")
    if abn and name:
        queries.append(f"{name} ABN {abn}")
        queries.append(f"ABN {abn} business")
    if website:
        queries.append(f"site:{website} about")
        queries.append(f"site:{website} services")

    serp_results = []
    serp_errors = []
    for q in queries[:5]:
        sr = await serper_search(q, gl="au", hl="en", num=5)
        if sr.get("error"):
            serp_errors.append(sr.get("error"))
        serp_results.extend(sr.get("results") or [])

    # Persist web sources (for "Why" citations)
    await upsert_web_sources(current_user["id"], serp_results)

    seen = set()
    top_urls = []
    for r in serp_results:
        link = (r.get("link") or "").strip()
        if not link:
            continue
        if link in seen:
            continue
        seen.add(link)
        top_urls.append(link)
        if len(top_urls) >= 6:
            break

    scraped = []
    for u in top_urls:
        txt = await scrape_url_text(u)
        if txt:
            scraped.append({"url": u, "text": txt[:6000]})

    recent_chats = await get_chat_history_supabase(supabase_admin, current_user["id"], limit=6)

    recent_docs = await get_user_documents_supabase(
        supabase_admin,
        current_user["id"],
        limit=6
    )

    recent_files_result = supabase_admin.table("data_files").select(
        "filename,extracted_text,category,created_at"
    ).eq("user_id", current_user["id"]).order("created_at", desc=True).limit(6).execute()
    recent_files = recent_files_result.data if recent_files_result.data else []

    website_text = ""
    if website:
        website_text = await fetch_website_text(website)
        website_text = website_text[:8000]

    prompt = f"""You are building a structured Australian SMB business profile for a Personalised AI Business Advisory platform.

Return ONLY valid JSON.
Do not include markdown.

Business input:
- business_name: {name}
- abn: {abn}
- website: {website}

Internal sources:
- recent_chats: {recent_chats}
- recent_documents: {[{'title': d.get('title'), 'type': d.get('document_type')} for d in recent_docs]}
- recent_files: {[{'filename': f.get('filename'), 'category': f.get('category')} for f in recent_files]}

Website extracted text:
{website_text}

External web sources (scraped snippets):
{scraped}

Fill as many of these keys as possible, only if reasonably supported by sources:
- business_name
- abn
- acn
- website
- location
- industry (ANZSIC division letter A-S or OTHER)
- business_type (AU)
- year_founded
- mission_statement
- main_products_services
- target_customer
- key_team_members
- growth_strategy
- crm_system
- accounting_system
- project_management_tool
- communication_style
- risk_tolerance
- retention_known (boolean)
- retention_rate_range (<20%, 20-40%, 40-60%, 60-80%, >80%)
- target_country (Australia)

Rules:
- Use target_country=\"Australia\" if missing.
- If you cannot infer a value, omit it.
"""

    session_id = f"build_profile_{uuid.uuid4()}"
    ai = await get_ai_response(
        prompt,
        "general",
        session_id,
        user_id=current_user["id"],
        user_data={
            "name": current_user.get("name"),
            "business_name": name,
            "industry": current_user.get("industry"),
        },
        use_advanced=True,
    )

    patch: Dict[str, Any] = {}
    try:
        import json
        patch = json.loads(ai)
    except Exception:
        patch = {}

    if name:
        patch["business_name"] = name
    if abn:
        patch["abn"] = abn
    if website:
        patch["website"] = website

    if not patch.get("target_country"):
        patch["target_country"] = "Australia"

    missing_fields = compute_missing_profile_fields(patch)

    return {
        "patch": patch,
        "missing_fields": missing_fields,
        "sources": {
            "queries": queries[:5],
            "serp_count": len(serp_results),
            "serp_error": serp_errors[0] if serp_errors else None,
            "scraped_urls": top_urls,
        },
    }

@api_router.put("/business-profile")
async def update_business_profile(profile: BusinessProfileUpdate, current_user: dict = Depends(get_current_user)):
    """
    Update user's business profile - creates new immutable version.
    This maintains backward compatibility while using versioned system.
    """
    now = datetime.now(timezone.utc).isoformat()
    user_id = current_user["id"]
    
    profile_data = {k: v for k, v in profile.model_dump().items() if v is not None}

    # Compute retention score (AU baselines) if inputs are present
    computed_rag = compute_retention_rag(
        profile_data.get("industry"),
        profile_data.get("retention_known"),
        profile_data.get("retention_rate_range"),
    )
    if computed_rag:
        profile_data["retention_rag"] = computed_rag

    profile_data["user_id"] = user_id
    profile_data["updated_at"] = now
    
    # Update user's basic info
    user_updates = {}
    # Update user info in Supabase (MongoDB removed - FIX APPLIED)
    user_updates = {}
    if profile.business_name:
        user_updates["company_name"] = profile.business_name
    if profile.industry:
        user_updates["industry"] = profile.industry
    
    if user_updates:
        try:
            supabase_admin.table("users").update(user_updates).eq("id", user_id).execute()
            logger.info(f"✅ User profile updated in Supabase for {user_id}")
        except Exception as e:
            logger.error(f"Failed to update Supabase user: {e}")
            # Non-blocking - continue with business profile update
    
    # Update business profile in Supabase
    await update_business_profile_supabase(supabase_admin, user_id, profile_data)
    
    # Create new versioned profile
    await create_profile_version(
        user_id=user_id,
        profile_data=profile_data,
        change_type="minor",
        reason="Profile update via UI",
        initiated_by=user_id
    )
    
    return await get_business_profile(current_user)


# ==================== DATA CENTER ROUTES ====================

@api_router.post("/data-center/upload")
async def upload_data_file(
    file: UploadFile = File(...),
    category: str = Form(...),
    description: str = Form(""),
    current_user: dict = Depends(get_current_user)
):
    """Upload a file to the data center"""
    # Validate file size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB allowed.")
    
    # Validate file type
    allowed_extensions = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'txt', 'md', 'json']
    ext = file.filename.lower().split('.')[-1] if '.' in file.filename else ''
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(allowed_extensions)}")
    
    # Extract text content
    extracted_text = await extract_file_content(file.filename, content)
    
    now = datetime.now(timezone.utc).isoformat()
    file_id = str(uuid.uuid4())
    
    file_doc = {
        "id": file_id,
        "user_id": current_user["id"],
        "filename": file.filename,
        "file_type": ext,
        "category": category,
        "description": description,
        "extracted_text": extracted_text,
        "file_content": base64.b64encode(content).decode('utf-8'),
        "file_size": len(content),
        "created_at": now
    }
    
    await create_data_file_supabase(supabase_admin, file_doc)
    
    return {
        "id": file_id,
        "filename": file.filename,
        "category": category,
        "file_size": len(content),
        "extracted_text_preview": extracted_text[:500] if extracted_text else None,
        "message": "File uploaded successfully"
    }

@api_router.get("/data-center/files")
async def get_data_files(category: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get all files in user's data center"""
    query = supabase_admin.table("data_files").select(
        "id,filename,file_type,category,description,extracted_text,file_size,created_at"
    ).eq("user_id", current_user["id"])

    if category:
        query = query.eq("category", category)

    result = query.order("created_at", desc=True).limit(100).execute()
    return result.data if result.data else []

@api_router.get("/data-center/files/{file_id}")
async def get_data_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific file details"""
    result = supabase_admin.table("data_files").select(
        "id,filename,file_type,category,description,extracted_text,file_size,created_at"
    ).eq("id", file_id).eq("user_id", current_user["id"]).single().execute()
    file = result.data if result.data else None
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return file

@api_router.get("/data-center/files/{file_id}/download")
async def download_data_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """Download a file"""
    result = supabase_admin.table("data_files").select(
        "filename,file_content,file_type"
    ).eq("id", file_id).eq("user_id", current_user["id"]).single().execute()
    file = result.data if result.data else None
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    return {
        "filename": file["filename"],
        "content": file["file_content"],
        "file_type": file["file_type"]
    }

@api_router.delete("/data-center/files/{file_id}")
async def delete_data_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a file from data center"""
    result = supabase_admin.table("data_files").delete().eq("id", file_id).eq("user_id", current_user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="File not found")
    return {"message": "File deleted successfully"}

@api_router.get("/data-center/categories")
async def get_data_categories(current_user: dict = Depends(get_current_user)):
    """Get file categories with counts"""
    from collections import Counter

    result = supabase_admin.table("data_files").select("category").eq("user_id", current_user["id"]).execute()
    categories_raw = result.data if result.data else []

    counter = Counter([c.get("category") for c in categories_raw if c.get("category")])
    return [
        {"category": category, "count": count}
        for category, count in sorted(counter.items(), key=lambda x: x[1], reverse=True)
    ]

@api_router.get("/data-center/stats")
async def get_data_center_stats(current_user: dict = Depends(get_current_user)):
    """Get data center statistics"""
    total_files = await count_user_data_files_supabase(supabase_admin, current_user["id"])
    
    # Total size
    size_result = supabase_admin.table("data_files").select("file_size").eq("user_id", current_user["id"]).execute()
    size_rows = size_result.data if size_result.data else []
    total_size = sum([row.get("file_size", 0) or 0 for row in size_rows])
    
    # Categories
    categories = await get_data_categories(current_user)
    
    # Has business profile
    profile = await get_business_profile_supabase(supabase_admin, current_user["id"])
    
    return {
        "total_files": total_files,
        "total_size_bytes": total_size,
        "total_size_mb": round(total_size / (1024 * 1024), 2),
        "categories": categories,
        "has_business_profile": profile is not None,
        "profile_completeness": calculate_profile_completeness(profile) if profile else 0
    }

# ==================== RETENTION BENCHMARKS (AU) ====================

# Lightweight baseline benchmarks by ANZSIC Division (editable later)
ANZSIC_DIVISION_BENCHMARKS_AU: Dict[str, Dict[str, int]] = {
    # threshold values are "good" and "ok" minimums (in %). Below ok => red.
    "A": {"good": 70, "ok": 55},  # Agriculture, Forestry and Fishing
    "B": {"good": 75, "ok": 60},  # Mining
    "C": {"good": 65, "ok": 50},  # Manufacturing
    "D": {"good": 80, "ok": 65},  # Electricity, Gas, Water and Waste Services
    "E": {"good": 70, "ok": 55},  # Construction
    "F": {"good": 80, "ok": 65},  # Wholesale Trade
    "G": {"good": 70, "ok": 55},  # Retail Trade
    "H": {"good": 75, "ok": 60},  # Accommodation and Food Services
    "I": {"good": 75, "ok": 60},  # Transport, Postal and Warehousing
    "J": {"good": 85, "ok": 70},  # Information Media and Telecommunications
    "K": {"good": 85, "ok": 70},  # Financial and Insurance Services
    "L": {"good": 75, "ok": 60},  # Rental, Hiring and Real Estate Services
    "M": {"good": 80, "ok": 65},  # Professional, Scientific and Technical Services
    "N": {"good": 75, "ok": 60},  # Administrative and Support Services
    "O": {"good": 75, "ok": 60},  # Public Administration and Safety
    "P": {"good": 80, "ok": 65},  # Education and Training
    "Q": {"good": 85, "ok": 70},  # Health Care and Social Assistance
    "R": {"good": 70, "ok": 55},  # Arts and Recreation Services
    "S": {"good": 70, "ok": 55},  # Other Services
}

RETENTION_RANGE_MIDPOINTS: Dict[str, int] = {
    "<20%": 10,
    "20-40%": 30,
    "40-60%": 50,
    "60-80%": 70,
    ">80%": 90,
}

def compute_retention_rag(anzsic_division: Optional[str], retention_known: Optional[bool], retention_rate_range: Optional[str]) -> Optional[str]:
    if not retention_known:
        return None
    if not retention_rate_range:
        return None

    midpoint = RETENTION_RANGE_MIDPOINTS.get(retention_rate_range)
    if midpoint is None:
        return None

    division = (anzsic_division or "").strip().upper()
    bench = ANZSIC_DIVISION_BENCHMARKS_AU.get(division)
    if not bench:
        bench = {"good": 75, "ok": 60}  # generic fallback

    if midpoint >= bench["good"]:
        return "green"
    if midpoint >= bench["ok"]:
        return "amber"
    return "red"


# ==================== SUBSCRIPTIONS & OAC ====================

class SubscriptionUpdate(BaseModel):
    subscription_tier: str

# Persist web sources discovered during profile build (for citations)
async def upsert_web_sources(user_id: str, serp_results: List[Dict[str, Any]]):
    if not serp_results:
        return
    now = datetime.now(timezone.utc).isoformat()
    for r in serp_results[:25]:
        url = (r.get('link') or '').strip()
        if not url:
            continue
        doc = {
            'id': str(uuid.uuid4()),
            'user_id': user_id,
            'source_type': 'web',
            'title': r.get('title'),
            'url': url,
            'snippet': r.get('snippet'),
            'created_at': now,
            'updated_at': now,
        }
        await update_web_source_supabase(supabase_admin, 
            {'user_id': user_id, 'url': url},
            {'$set': doc},
            upsert=True
        )

    subscription_tier: str


def month_key(dt: datetime) -> str:
    return dt.strftime("%Y-%m")


def get_month_start(dt: datetime) -> datetime:
    return datetime(dt.year, dt.month, 1, tzinfo=timezone.utc)


def add_months(dt: datetime, months: int) -> datetime:
    year = dt.year + ((dt.month - 1 + months) // 12)
    month = ((dt.month - 1 + months) % 12) + 1
    day = min(dt.day, 28)
    return datetime(year, month, day, tzinfo=timezone.utc)


def oac_monthly_limit_for_tier(tier: str) -> int:
    t = (tier or "").lower()
    if t == "free":
        return 5
    if t == "starter":
        return 20
    if t == "professional":
        return 60
    if t == "enterprise":
        return 150
    return 5


def prorated_allowance(limit: int, started_at: datetime, now: datetime) -> int:
    # Prorate for the remainder of the current month
    month_start = get_month_start(now)
    next_month = add_months(month_start, 1)
    days_in_month = (next_month - month_start).days
    remaining_days = max((next_month.date() - now.date()).days, 0)
    # Include today as usable day
    remaining_days = min(days_in_month, remaining_days + 1)
    allowance = int((limit * remaining_days) / days_in_month)
    return max(1, allowance) if limit > 0 else 0


def parse_recommendations(text: str, max_items: int = 5) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    current: Dict[str, Any] = {}
    actions: List[str] = []

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue

        if line.lower().startswith("recommendation") or line.startswith("##"):
            continue

        # Recognize common patterns:
        # - Title lines like "1. ..." or "**1. ...**"
        # - Reason lines like "Reason: ..." or "- action"
        normalized = line.strip('*').strip()

        if normalized.lower().startswith("reason:"):
            reason_text = normalized.split(":", 1)[1].strip()
            if current and reason_text and "reason" not in current:
                current["reason"] = reason_text
            continue

        if normalized.startswith("-") or normalized.startswith("•"):
            a = normalized.lstrip("-• ").strip()
            if a:
                actions.append(a)
            continue

        # numbered item
        if normalized and normalized[0].isdigit() and "." in normalized[:4]:
            # flush previous
            if current:
                current["actions"] = actions[:]
                items.append(current)
                current = {}
                actions = []
            title = normalized.split(".", 1)[1].strip().strip('*').strip()
            current = {"title": title}
            continue

        # fallback: treat as title if none
        if not current:
            current = {"title": normalized}
        else:
            # treat as reason
            if "reason" not in current:
                current["reason"] = normalized

    if current:
        current["actions"] = actions[:]
        items.append(current)

    cleaned: List[Dict[str, Any]] = []
    for it in items:
        title = (it.get("title") or "").strip()
        if not title:
            continue
        cleaned.append({
            "title": title,
            "reason": it.get("reason"),
            "actions": (it.get("actions") or [])[:5]
        })

    # If the model didn't number items, take the first max_items anyway
    return cleaned[:max_items]



# OAC response parsing with "Why" + citations

def parse_citations_block(text: str) -> List[Dict[str, Any]]:
    citations = []
    for raw in (text or "").splitlines():
        line = raw.strip().lstrip('-').strip()
        if not line:
            continue
        # Expect formats like:
        # - [web] Title — https://...
        # - [document] "Q2 Strategy" (doc_id=...)
        source_type = None
        if line.startswith('[') and ']' in line:
            source_type = line[1:line.index(']')].strip().lower()
            rest = line[line.index(']') + 1:].strip()
        else:
            rest = line

        url = None
        if 'http://' in rest or 'https://' in rest:
            # naive url split
            parts = rest.split('http')
            url = 'http' + parts[-1].strip()
            title = rest.replace(url, '').strip(' -–—')
        else:
            title = rest

        citations.append({
            'source_type': source_type or 'unknown',
            'title': title or None,
            'url': url,
        })
    return citations[:6]


# ==================== ADVISOR BRAIN CORE ====================
# Unified system for evidence-based, personalized AI advice across all features

async def build_advisor_context(user_id: str) -> dict:
    """
    Build comprehensive context for Advisor Brain.
    Includes resolved facts from the Global Fact Authority.
    """
    from fact_resolution import resolve_facts, build_known_facts_prompt
    
    user = await get_user_by_id(user_id) # Supabase
    profile = await get_business_profile_supabase(supabase_admin, user_id)
    onboarding = await get_onboarding_supabase(supabase_admin, user_id)
    
    # Resolve all known facts
    facts = await resolve_facts(supabase_admin, user_id)
    facts_prompt = build_known_facts_prompt(facts)
    
    # Recent activity for context
    recent_chats = await get_chat_history_supabase(supabase_admin, user_id, limit=5)

    recent_docs_result = supabase_admin.table("data_files").select(
        "filename,category,description,extracted_text,created_at"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()
    recent_docs = recent_docs_result.data if recent_docs_result.data else []
    
    web_sources = await get_web_sources_supabase(supabase_admin, user_id)
    sops = await get_sops_supabase(supabase_admin, user_id)
    outlook_emails = await get_user_emails_supabase(supabase_admin, user_id, limit=10)
    email_intel = await get_email_intelligence_supabase(supabase_admin, user_id)
    calendar_intel = await get_calendar_intelligence_supabase(supabase_admin, user_id)
    calendar_events = await get_user_calendar_events_supabase(supabase_admin, user_id)
    email_priority = await get_priority_analysis_supabase(supabase_admin, user_id)
    
    return {
        "user": user,
        "profile": profile or {},
        "onboarding": onboarding or {},
        "recent_chats": recent_chats,
        "recent_docs": recent_docs,
        "web_sources": web_sources,
        "sops": sops,
        "outlook_emails": outlook_emails,
        "email_intelligence": email_intel or {},
        "calendar_intelligence": calendar_intel or {},
        "calendar_events": calendar_events,
        "email_priority": email_priority or {},
        "known_facts_prompt": facts_prompt,
    }


def format_email_intelligence(email_intel: dict, recent_emails: list) -> str:
    """Format email intelligence for AI context"""
    if not email_intel and not recent_emails:
        return "Outlook not connected yet - suggest connecting to analyze client communications"
    
    intel_text = ""
    
    if email_intel:
        total_analyzed = email_intel.get("total_emails_analyzed", 0)
        top_clients = email_intel.get("top_clients", [])[:5]
        
        intel_text += f"Analyzed {total_analyzed} emails over 36 months\n"
        intel_text += f"Unique contacts: {email_intel.get('unique_contacts', 0)}\n"
        
        if top_clients:
            intel_text += "\nTop client relationships (by email frequency):\n"
            for client in top_clients:
                intel_text += f"- {client.get('email')} ({client.get('email_count')} emails, {client.get('relationship_strength')} relationship)\n"
    
    if recent_emails:
        intel_text += f"\nRecent email activity (last {len(recent_emails)} emails):\n"
        for email in recent_emails[:5]:
            from_name = email.get('from_name', email.get('from_address', 'Unknown'))
            subject = email.get('subject', 'No subject')
            intel_text += f"- From {from_name}: \"{subject[:50]}...\"\n"
    
    return intel_text if intel_text else "No email data available yet"


def format_calendar_intelligence(calendar_intel: dict, calendar_events: list) -> str:
    """Format calendar intelligence for AI context"""
    if not calendar_intel and not calendar_events:
        return "Calendar not synced yet - suggest syncing to understand their schedule and time management"
    
    cal_text = ""
    
    if calendar_intel:
        meeting_load = calendar_intel.get("meeting_load", "unknown")
        upcoming = calendar_intel.get("upcoming_meetings", 0)
        top_collaborators = calendar_intel.get("top_collaborators", [])[:5]
        
        cal_text += f"Meeting load: {meeting_load} ({upcoming} meetings in next 2 weeks)\n"
        
        if top_collaborators:
            cal_text += "Frequent meeting partners:\n"
            for collab in top_collaborators:
                cal_text += f"- {collab.get('name')} ({collab.get('meetings')} meetings)\n"
    
    if calendar_events:
        cal_text += f"\nUpcoming schedule ({len(calendar_events)} events):\n"
        for event in calendar_events[:5]:
            subject = event.get('subject', 'Untitled')
            start = event.get('start', '')[:10] if event.get('start') else 'TBD'
            attendees = ', '.join(event.get('attendees', [])[:3])
            cal_text += f"- {start}: {subject}"
            if attendees:
                cal_text += f" (with {attendees})"
            cal_text += "\n"
    
    return cal_text if cal_text else "No calendar data available yet"


def format_email_priority(email_priority: dict) -> str:
    """Format email priority insights for AI context"""
    if not email_priority or "analysis" not in email_priority:
        return "Email priority analysis not run yet - suggest running to help prioritize inbox"
    
    analysis = email_priority.get("analysis", {})
    priority_text = ""
    
    high = analysis.get("high_priority", [])
    if high:
        priority_text += f"HIGH PRIORITY EMAILS ({len(high)}):\n"
        for item in high[:3]:
            priority_text += f"- From: {item.get('from', 'Unknown')} | Subject: {item.get('subject', 'No subject')[:40]} | Action: {item.get('suggested_action', '')[:50]}\n"
    
    insights = analysis.get("strategic_insights", "")
    if insights:
        priority_text += f"\nStrategic insight: {insights[:200]}\n"
    
    return priority_text if priority_text else "No email priority data available"


def format_advisor_brain_prompt(
    task_description: str,
    context: dict,
    output_format: str = "recommendations",
    communication_style: str = None
) -> str:
    """
    Create world-class AI mentor prompts that are:
    - Deeply personalized (not generic)
    - Proactive (asks clarifying questions)
    - Evidence-based (cites specific business data)
    - Conversational (builds on previous interactions)
    """
    profile = context.get("profile", {})
    user = context.get("user", {})
    onboarding = context.get("onboarding", {})
    recent_chats = context.get("recent_chats", [])
    
    # Extract communication style
    if not communication_style:
        communication_style = profile.get("advice_style", "conversational")
    
    # Build comprehensive business identity
    biz_name = profile.get("business_name") or user.get("business_name") or "your business"
    industry = profile.get("industry") or user.get("industry") or "your industry"
    stage = profile.get("business_stage") or onboarding.get("business_stage", "unknown")
    
    # Build DETAILED business profile for AI to reference
    detailed_profile = f"""
═══════════════════════════════════════════════════════════════
YOUR CLIENT: {biz_name.upper()}
═══════════════════════════════════════════════════════════════

BUSINESS FUNDAMENTALS:
• Name: {biz_name}
• Industry: {industry}
• Stage: {stage}
• Years Operating: {profile.get('years_operating', 'Not specified - ASK THEM')}
• Team Size: {profile.get('team_size', 'Not specified - ASK THEM')}
• Revenue: {profile.get('revenue_range', 'Not specified - ASK THEM')}
• Customers: {profile.get('customer_count', 'Not specified - ASK THEM')}
• Location: {profile.get('location', 'Not specified - ASK THEM')}

WHAT THEY'RE TRYING TO ACHIEVE:
• Short-term Goals: {profile.get('short_term_goals') or 'NOT SPECIFIED - You MUST ask what they want to achieve in next 6-12 months'}
• Long-term Goals: {profile.get('long_term_goals') or 'NOT SPECIFIED - You MUST ask about their 2-5 year vision'}
• Main Challenges: {profile.get('main_challenges') or profile.get('growth_challenge') or 'NOT SPECIFIED - You MUST ask what their biggest obstacles are'}

THEIR BUSINESS MODEL:
• Model: {profile.get('business_model', 'Not specified - ASK THEM')}
• Products/Services: {profile.get('products_services') or profile.get('main_products_services') or 'NOT SPECIFIED - You MUST ask what they offer'}
• Unique Value: {profile.get('unique_value_proposition', 'Not specified - ASK what makes them different')}
• Pricing: {profile.get('pricing_model', 'Not specified - ASK THEM')}

THEIR CURRENT SITUATION:
• Mission: {profile.get('mission_statement', 'Not specified - ASK why their business exists')}
• Vision: {profile.get('vision_statement', 'Not specified - ASK where they see themselves in 5 years')}
• Growth Strategy: {profile.get('growth_strategy', 'Not specified - ASK how they plan to grow')}

TOOLS & SYSTEMS THEY USE:
{', '.join(profile.get('current_tools', [])) if profile.get('current_tools') else 'NOT SPECIFIED - You MUST ask what tools they currently use'}

THEIR PREFERENCES:
• Communication Style: {communication_style}
• Time Available: {profile.get('time_availability', 'Not specified')}

CONTEXT FROM PREVIOUS CONVERSATIONS:
{chr(10).join([f"- User asked: '{chat.get('message', '')[:100]}...' You said: '{chat.get('response', '')[:100]}...'" for chat in recent_chats[:3]]) if recent_chats else 'No previous conversations - this is your first interaction'}

UPLOADED DOCUMENTS YOU CAN REFERENCE:
{chr(10).join([f"- {doc.get('filename')} ({doc.get('category')})" for doc in context.get('recent_docs', [])[:5]]) if context.get('recent_docs') else 'No documents uploaded yet - suggest they upload business plans, financials, etc.'}

EMAIL INTELLIGENCE (LAST 36 MONTHS):
{format_email_intelligence(context.get('email_intelligence', {}), context.get('outlook_emails', []))}

CALENDAR INTELLIGENCE:
{format_calendar_intelligence(context.get('calendar_intelligence', {}), context.get('calendar_events', []))}

EMAIL PRIORITY INSIGHTS:
{format_email_priority(context.get('email_priority', {}))}
"""
    
    # Style guide with examples
    style_examples = {
        "concise": "Example: 'Focus on client retention. Why: You mentioned losing clients. Action: Implement monthly check-ins. Need: What's your current retention rate?'",
        "detailed": "Example: 'Based on your professional services business with <10 clients, retention is critical. Industry data shows 80%+ retention is healthy. Walk me through: How do you currently follow up with clients after delivery?'",
        "conversational": "Example: 'Hey, I noticed you're in professional services with a small client base. That means every client relationship is gold. Tell me - how are you keeping clients engaged after the initial project?'",
        "data-driven": "Example: 'Your profile shows <10 clients, $100K-$500K revenue. That's ~$10-50K per client - high-value relationships. Question: What's your current retention rate and client lifetime value?'"
    }
    
    style_example = style_examples.get(communication_style, style_examples["conversational"])
    
    base_prompt = f"""You are an ELITE AI Business Mentor for {biz_name}. You've studied their business deeply and know them better than generic business advisors.

{detailed_profile}

═══════════════════════════════════════════════════════════════
YOUR MISSION
═══════════════════════════════════════════════════════════════

Provide advice that makes {biz_name}'s owner say: "Wow, this AI actually KNOWS my business!"

MANDATORY RULES - VIOLATE THESE = FAILURE:

1. **USE THEIR BUSINESS NAME**: Say "{biz_name}" not "your business" - make it personal
2. **REFERENCE SPECIFIC DATA**: Every response MUST mention at least 2 specific facts from their profile above
3. **ASK QUESTIONS**: If ANY field says "Not specified" or "NOT SPECIFIED", you MUST ask about it
4. **NO GENERIC ADVICE**: Ban phrases like "businesses should", "typically", "in general", "most companies"
5. **BE CONVERSATIONAL**: Reference previous conversations shown above
6. **ADMIT GAPS**: Say "I don't know your [X] - can you tell me?" instead of guessing
7. **FOLLOW THEIR STYLE**: {style_example}

TASK: {task_description}

CRITICAL OUTPUT FORMAT - FOLLOW EXACTLY:
Output ONLY numbered items (1. 2. 3.). Each item MUST reference specific business details.

FORMAT:
1. <Title that mentions their business, industry, or specific situation>
Reason: <One line that cites SPECIFIC data from their profile - e.g., "With just you running {biz_name}..." or "Given your {industry} background...">
Why: <2-3 lines that reference AT LEAST 2 specific facts about THEIR business. If you're missing critical info, ASK A QUESTION like: "Before I recommend X, I need to understand: What's your current [missing data]?">
Confidence: high|medium|low (set to LOW if missing key business data)
Actions:
- <Action specific to their tools, team size, or situation>
- <Action that references their goals or challenges>
- <Action that's practical given their time availability>
Questions: <If confidence is medium/low, ask 1-2 specific questions to improve your advice>
Citations:
- [profile] <Specific field you referenced>
- [data_file] <Document name if used>
- [web] <Source if used>

EXAMPLE FOR {biz_name}:
1. Build systematic client retention process for {biz_name}
Reason: {biz_name} is a professional services business with <10 clients and revenue of $100K-$500K, meaning each client represents $10K-50K - losing one client is a major hit
Why: Your main challenge is "client retention and ideal customer acquisition." With just you running operations and 5-10 hours/week available, you need an efficient, low-touch retention system. Your HubSpot CRM can automate most of this. Question: What's your current client retention rate over the last 12 months?
Confidence: medium
Actions:
- Set up automated quarterly check-in emails in HubSpot (2 hours setup)
- Create a simple client health scorecard (track: last contact, satisfaction, upsell potential)
- Schedule 15-min monthly reviews of at-risk clients
Questions: What percentage of clients renew or return for additional work? How do you currently stay in touch post-project?
Citations:
- [profile] Business name: {biz_name}
- [profile] Main challenge: client retention and ideal customer acquisition
- [profile] Team size: Just me
- [profile] Tools: HubSpot / CRM

ANTI-PATTERNS (NEVER DO THIS):
❌ "Most businesses should focus on customer retention" - TOO GENERIC
❌ "You could try various marketing strategies" - NOT SPECIFIC
❌ "Implement best practices" - WHAT BEST PRACTICES?
❌ Giving advice without asking clarifying questions first
❌ Ignoring data gaps in their profile

REMEMBER: You are their PERSONAL business mentor who knows {biz_name} inside and out. Reference specific details. Ask questions. Be conversational. Make every response feel like it's ONLY for them.
"""
    
    return base_prompt


def parse_oac_items_with_why(text: str, max_items: int = 5) -> List[Dict[str, Any]]:
    """Parse AI response with Why + Citations pattern"""
    items: List[Dict[str, Any]] = []
    current: Dict[str, Any] = {}
    actions: List[str] = []
    in_citations = False
    citations_lines: List[str] = []

    def flush():
        nonlocal current, actions, in_citations, citations_lines
        if not current:
            return
        current['actions'] = actions[:]
        if citations_lines:
            current['citations'] = parse_citations_block('\n'.join(citations_lines))
        items.append(current)
        current = {}
        actions = []
        in_citations = False
        citations_lines = []

    for raw in (text or '').splitlines():
        line = raw.strip()
        if not line:
            continue

        normalized = line.strip('*').strip()

        if normalized.lower().startswith('citations:'):
            in_citations = True
            continue

        if in_citations:
            if normalized[0].isdigit() and '.' in normalized[:4]:
                # next item
                flush()
            else:
                citations_lines.append(normalized)
                continue

        if normalized[0].isdigit() and '.' in normalized[:4]:
            flush()
            title = normalized.split('.', 1)[1].strip()
            current = {'title': title, 'citations': []}
            continue

        if normalized.lower().startswith('why:'):
            if current:
                current['why'] = normalized.split(':', 1)[1].strip()
            continue

        if normalized.lower().startswith('confidence:'):
            if current:
                current['confidence'] = normalized.split(':', 1)[1].strip().lower()
            continue

        if normalized.lower().startswith('reason:'):
            if current and 'reason' not in current:
                current['reason'] = normalized.split(':', 1)[1].strip()
            continue

        if normalized.startswith('-') or normalized.startswith('•'):
            a = normalized.lstrip('-•').strip()
            if a:
                actions.append(a)
            continue

        # fallback reason
        if current and 'reason' not in current:
            current['reason'] = normalized

    flush()

    cleaned = []
    for it in items:
        if not it.get('title'):
            continue
        cleaned.append({
            'title': it.get('title'),
            'reason': it.get('reason'),
            'actions': (it.get('actions') or [])[:6],
            'why': it.get('why'),
            'confidence': it.get('confidence'),
            'citations': (it.get('citations') or [])[:6],
        })
    return cleaned[:max_items]


def parse_advisor_brain_response(text: str) -> List[Dict[str, Any]]:
    """
    Parse AI response into structured format with Why? + Citations.
    Reusable across all Advisor Brain features.
    """
    return parse_oac_items_with_why(text, max_items=10)  # Reuse existing parser


# ==================== OAC HELPERS ====================

def tier_from_user(user: dict) -> str:
    return (user.get("subscription_tier") or "free").lower()


@api_router.put("/admin/users/{user_id}/subscription")
async def admin_set_subscription(user_id: str, update: SubscriptionUpdate, admin: dict = Depends(get_admin_user)):
    tier = update.subscription_tier.lower().strip()
    if tier not in {"free", "starter", "professional", "enterprise"}:
        raise HTTPException(status_code=400, detail="Invalid subscription tier")

    now = datetime.now(timezone.utc)
    
    # Update Supabase users table (MongoDB removed - FIX APPLIED)
    try:
        supabase_admin.table("users").update({
            "subscription_tier": tier,
            "subscription_started_at": now.isoformat(),
            "updated_at": now.isoformat()
        }).eq("id", user_id).execute()
        
        logger.info(f"✅ Subscription updated in Supabase for {user_id}: {tier}")
    except Exception as e:
        logger.error(f"Failed to update subscription in Supabase: {e}")
        raise HTTPException(status_code=500, detail="Failed to update subscription")

    user = await get_user_by_id(user_id) # Supabase
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@api_router.get("/oac/recommendations")
async def get_oac_recommendations(current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    mk = month_key(now)
    user_id = current_user["id"]

    # Load user + profile
    user = await get_user_by_id(user_id) # Supabase
    profile = await get_business_profile_supabase(supabase_admin, user_id)

    tier = tier_from_user(user or {})
    base_limit = oac_monthly_limit_for_tier(tier)

    # prorate if started this month and not free
    limit = base_limit
    started_at_iso = (user or {}).get("subscription_started_at")
    if tier != "free" and started_at_iso:
        try:
            started_at = datetime.fromisoformat(started_at_iso)
            if month_key(started_at) == mk:
                limit = prorated_allowance(base_limit, started_at, now)
        except Exception:
            pass

    usage = await get_oac_usage_supabase(supabase_admin, user_id, mk)
    used = int((usage or {}).get("used", 0))

    if used >= limit:
        return {
            "locked": True,
            "usage": {"used": used, "limit": limit, "tier": tier, "month": mk}
        }

    # cache per day
    day_key = now.strftime("%Y-%m-%d")
    cached = await get_oac_recommendations_supabase(supabase_admin, user_id, day_key)
    if cached:
        return {
            "locked": False,
            "meta": {"date": day_key, "cached": True},
            "items": cached.get("items", []),
            "usage": {"used": used, "limit": limit, "tier": tier, "month": mk}
        }

    # Build context snippets
    recent_chats = await get_chat_history_supabase(supabase_admin, user_id, limit=8)

    recent_docs = await get_user_documents_supabase(
        supabase_admin,
        user_id,
        limit=8
    )

    recent_files_result = supabase_admin.table("data_files").select(
        "filename,category,description,created_at"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(8).execute()
    recent_files = recent_files_result.data if recent_files_result.data else []

    # Prompt: strict, non-generic, actionable
    biz_name = (user or {}).get("business_name") or (profile or {}).get("business_name") or "this business"
    industry = (profile or {}).get("industry") or (user or {}).get("industry")

    # Build a compact evidence list for citations
    evidence_web = await get_web_sources_supabase(supabase_admin, user_id)

    prompt = f"""You are the Ops Advisory Centre (OAC) for The Strategy Squad.
Your job: produce deeply customised operational recommendations that are SPECIFIC to this business and NOT generic.

Business name: {biz_name}
Industry (ANZSIC division): {industry}
Target country: {(profile or {}).get('target_country') or 'Australia'}
Business type: {(profile or {}).get('business_type')}
ABN/ACN present: {bool((profile or {}).get('abn')) or bool((profile or {}).get('acn'))}
Customer retention known: {(profile or {}).get('retention_known')}
Customer retention range: {(profile or {}).get('retention_rate_range')}
Retention score: {(profile or {}).get('retention_rag')}

Recent AI chats (latest first):
{recent_chats}

Recent documents created (latest first):
{recent_docs}

Recent uploaded files (latest first):
{recent_files}

Recent web sources (from Build Business Profile):
{evidence_web}

CRITICAL OUTPUT RULES:
- Output ONLY 5 items. No intro, no closing text.
- Exactly 5 items, numbered 1. to 5.
- If evidence is missing for a claim, set Confidence: low and ask 1 clarifying question in the Why line.

FORMAT (repeat 5x):
1. <Short title>
Reason: <One line referencing the business context above>
Why: <2–3 lines: why this applies to THIS business; if missing info, ask 1 question>
Confidence: high|medium|low
- <Action>
- <Action>
- <Action>
Citations:
- [web] <title> — <url>
- [data_file] <filename>
- [document] <title>
"""

    session_id = f"oac_{uuid.uuid4()}"
    ai_text = await get_ai_response(prompt, "general", session_id, user_id=user_id, user_data={
        "name": (user or {}).get("name"),
        "business_name": biz_name,
        "industry": industry,
    }, use_advanced=True)

    items = parse_oac_items_with_why(ai_text, max_items=5)

    # persist cache + increment usage by 1 (daily batch counts as 1)
    rec_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "month_key": day_key,
        "date": day_key,
        "items": items,
        "created_at": now.isoformat()
    }
    await update_oac_recommendations_supabase(supabase_admin, user_id, day_key, rec_doc)

    used_after = used + 1
    await update_oac_usage_supabase(supabase_admin, user_id, mk, {"used": used_after})

    return {
        "locked": False,
        "meta": {"date": day_key, "cached": False},
        "items": items,
        "usage": {"used": used_after, "limit": limit, "tier": tier, "month": mk}
    }



# ==================== VERSIONED PROFILE HELPERS ====================

def generate_version_number(current_version: Optional[str], change_type: str) -> str:
    """Generate next version number based on change type"""
    if not current_version:
        return "v1.0"
    
    # Parse current version (e.g., "v1.2" -> major=1, minor=2)
    version_str = current_version.lstrip('v')
    parts = version_str.split('.')
    major = int(parts[0]) if len(parts) > 0 else 1
    minor = int(parts[1]) if len(parts) > 1 else 0
    
    # Major changes: new business model, pivot, major strategic shift
    # Minor changes: data updates, refinements
    if change_type == "major":
        return f"v{major + 1}.0"
    else:
        return f"v{major}.{minor + 1}"


def calculate_domain_confidence(domain_data: dict, domain_type: str) -> str:
    """Calculate confidence level for a domain based on data completeness"""
    if not domain_data:
        return "low"
    
    # Count non-empty fields
    filled_fields = sum(1 for v in domain_data.values() if v not in [None, "", [], {}])
    total_fields = len(domain_data)
    
    if total_fields == 0:
        return "low"
    
    completeness = (filled_fields / total_fields) * 100
    
    if completeness >= 70:
        return "high"
    elif completeness >= 40:
        return "medium"
    else:
        return "low"


def calculate_domain_completeness(domain_data: dict) -> int:
    """Calculate completeness percentage for a domain"""
    if not domain_data:
        return 0
    
    filled_fields = sum(1 for v in domain_data.values() if v not in [None, "", [], {}, "low"])
    total_fields = len([k for k in domain_data.keys() if k not in ['confidence_level', 'completeness_percentage', 'last_updated_at']])
    
    if total_fields == 0:
        return 0
    
    return int((filled_fields / total_fields) * 100)


async def create_profile_version(
    user_id: str,
    profile_data: dict,
    change_type: str = "minor",
    reason: str = "Profile update",
    initiated_by: str = None
) -> str:
    """Create a new immutable version of the business profile"""
    
    # Get current active profile
    current_profile_result = supabase_admin.table("business_profiles_versioned").select("*").eq(
        "user_id", user_id
    ).eq("status", "active").order("created_at", desc=True).limit(1).execute()
    current_profile = current_profile_result.data[0] if current_profile_result.data else None
    
    # Generate new version number
    current_version = current_profile.get("version") if current_profile else None
    new_version = generate_version_number(current_version, change_type)
    
    # Archive current profile if exists
    if current_profile:
        supabase_admin.table("business_profiles_versioned").update({
            "status": "archived"
        }).eq("profile_id", current_profile["profile_id"]).execute()
    
    # Build domains from profile data
    now = datetime.now(timezone.utc).isoformat()
    
    business_identity = {
        "business_name": profile_data.get("business_name"),
        "legal_structure": profile_data.get("business_type"),
        "industry": profile_data.get("industry"),
        "country": profile_data.get("target_country", "Australia"),
        "year_founded": profile_data.get("year_founded"),
        "location": profile_data.get("location"),
        "website": profile_data.get("website"),
        "abn": profile_data.get("abn"),
        "acn": profile_data.get("acn"),
        "last_updated_at": now
    }
    business_identity["confidence_level"] = calculate_domain_confidence(business_identity, "business_identity")
    business_identity["completeness_percentage"] = calculate_domain_completeness(business_identity)
    
    market = {
        "target_customer_summary": profile_data.get("ideal_customer_profile"),
        "primary_problem_solved": profile_data.get("main_challenges"),
        "geography": profile_data.get("geographic_focus"),
        "business_model": profile_data.get("business_model"),
        "acquisition_channels": profile_data.get("customer_acquisition_channels"),
        "ideal_customer_profile": profile_data.get("ideal_customer_profile"),
        "target_market": profile_data.get("target_market"),
        "last_updated_at": now
    }
    market["confidence_level"] = calculate_domain_confidence(market, "market")
    market["completeness_percentage"] = calculate_domain_completeness(market)
    
    offer = {
        "products_services_summary": profile_data.get("products_services") or profile_data.get("main_products_services"),
        "pricing_model": profile_data.get("pricing_model"),
        "sales_cycle_length": profile_data.get("sales_cycle_length"),
        "value_proposition": profile_data.get("unique_value_proposition"),
        "competitive_advantage": profile_data.get("competitive_advantages"),
        "unique_value_proposition": profile_data.get("unique_value_proposition"),
        "last_updated_at": now
    }
    offer["confidence_level"] = calculate_domain_confidence(offer, "offer")
    offer["completeness_percentage"] = calculate_domain_completeness(offer)
    
    team = {
        "team_size_range": profile_data.get("team_size"),
        "key_roles_present": profile_data.get("key_team_members"),
        "capability_strengths": profile_data.get("team_strengths"),
        "capability_gaps": profile_data.get("team_gaps"),
        "founder_background": profile_data.get("founder_background"),
        "hiring_status": profile_data.get("hiring_status"),
        "last_updated_at": now
    }
    team["confidence_level"] = calculate_domain_confidence(team, "team")
    team["completeness_percentage"] = calculate_domain_completeness(team)
    
    strategy = {
        "mission": profile_data.get("mission_statement"),
        "short_term_goals": profile_data.get("short_term_goals"),
        "long_term_goals": profile_data.get("long_term_goals"),
        "current_challenges": profile_data.get("main_challenges"),
        "growth_approach": profile_data.get("growth_strategy"),
        "vision_statement": profile_data.get("vision_statement"),
        "last_updated_at": now
    }
    strategy["confidence_level"] = calculate_domain_confidence(strategy, "strategy")
    strategy["completeness_percentage"] = calculate_domain_completeness(strategy)
    
    # Calculate overall confidence summary
    confidence_summary = {
        "business_identity": business_identity["confidence_level"],
        "market": market["confidence_level"],
        "offer": offer["confidence_level"],
        "team": team["confidence_level"],
        "strategy": strategy["confidence_level"]
    }
    
    # Calculate score
    # Get onboarding data
    onboarding = await get_onboarding_supabase(supabase_admin, user_id)
    
    # Build temporary profile dict for scoring
    temp_profile = {**profile_data}
    score_value = await calculate_business_score(temp_profile, onboarding, user_id)
    
    score = {
        "value": score_value,
        "calculated_at": now,
        "score_version": "v1.0",
        "explanation_summary": f"Score based on profile completeness, business depth, platform engagement, and performance indicators"
    }
    
    # Create new profile version
    profile_id = str(uuid.uuid4())
    business_id = current_profile.get("business_id") if current_profile else str(uuid.uuid4())
    
    new_profile = {
        "profile_id": profile_id,
        "business_id": business_id,
        "user_id": user_id,
        "version": new_version,
        "status": "active",
        "created_at": now,
        "created_by": initiated_by or user_id,
        "last_reviewed_at": None,
        "confidence_summary": confidence_summary,
        "score": score,
        "domains": {
            "business_identity": business_identity,
            "market": market,
            "offer": offer,
            "team": team,
            "strategy": strategy
        },
        "change_log": [
            {
                "change_id": str(uuid.uuid4()),
                "change_type": "created" if not current_profile else "updated",
                "affected_domains": ["all"] if not current_profile else list(profile_data.keys()),
                "initiated_by": initiated_by or user_id,
                "initiated_at": now,
                "reason_summary": reason
            }
        ]
    }
    
    # Add previous change log if exists
    if current_profile and current_profile.get("change_log"):
        new_profile["change_log"] = current_profile["change_log"] + new_profile["change_log"]
    
    # Insert new version
    supabase_admin.table("business_profiles_versioned").insert(new_profile).execute()
    
    return profile_id


async def get_active_profile(user_id: str) -> Optional[dict]:
    """Get the active (current) business profile version"""
    result = supabase_admin.table("business_profiles_versioned").select("*").eq(
        "user_id", user_id
    ).eq("status", "active").order("created_at", desc=True).limit(1).execute()
    return result.data[0] if result.data else None


def calculate_profile_completeness(profile: dict) -> int:
    """Calculate profile completeness percentage"""
    if not profile:
        return 0
    
    # Core fields (weighted higher)
    core_fields = [
        "business_name",
        "industry",
        "business_type",
        "target_country",
        "retention_known",
    ]
    
    # Extended fields
    extended_fields = [
        "year_founded",
        "location",
        "website",
        "abn",
        "acn",
        "retention_rate_range",
        "average_customer_value",
        "crm_system",
        "accounting_system",
        "project_management_tool",
    ]
    
    core_filled = sum(1 for f in core_fields if profile.get(f))
    extended_filled = sum(1 for f in extended_fields if profile.get(f))
    
    # Core fields worth 60%, extended worth 40%
    core_score = (core_filled / len(core_fields)) * 60
    extended_score = (extended_filled / len(extended_fields)) * 40
    
    return int(core_score + extended_score)


def calculate_profile_strength(profile: dict, onboarding: dict = None) -> int:
    """
    DEPRECATED: Use calculate_business_score instead.
    This is kept for backward compatibility only.
    """
    return calculate_business_score(profile, onboarding)


async def calculate_business_score(profile: dict, onboarding: dict = None, user_id: str = None) -> int:
    """
    Calculate dynamic Business Score out of 100.
    This score evolves based on:
    - Business profile completeness (foundation)
    - Platform engagement & usage
    - Goals set and achieved
    - SOPs created and implemented
    - Business performance indicators
    - AI advisor interactions
    
    The score can go up AND down based on business activity and performance.
    """
    if not profile:
        return 0
    
    score = 0
    
    # === FOUNDATION (30 points) ===
    # Business stage identified (5 points)
    if profile.get("business_stage") or (onboarding and onboarding.get("business_stage")):
        score += 5
    
    # Core business info present (15 points)
    core_fields = ["business_name", "industry", "business_model", "target_market"]
    core_filled = sum(1 for f in core_fields if profile.get(f))
    score += (core_filled / len(core_fields)) * 15
    
    # Strategic clarity (10 points)
    strategic = ["short_term_goals", "long_term_goals", "main_challenges"]
    strategic_filled = sum(1 for f in strategic if profile.get(f))
    score += (strategic_filled / len(strategic)) * 10
    
    # === PLATFORM ENGAGEMENT (20 points) ===
    if user_id:
        # Documents uploaded (5 points)
        doc_count = await count_user_data_files_supabase(supabase_admin, user_id)
        score += min(5, doc_count * 1)  # 1 point per doc, max 5
        
        # AI advisor conversations (5 points)
        chat_result = supabase_admin.table("chat_history").select("id", count="exact").eq("user_id", user_id).execute()
        chat_count = chat_result.count if chat_result.count is not None else 0
        score += min(5, chat_count * 0.5)  # 0.5 points per chat, max 5
        
        # SOPs created (5 points)
        sop_count = await count_sops_supabase(supabase_admin, user_id)
        score += min(5, sop_count * 2)  # 2 points per SOP, max 5
        
        # Analyses run (5 points)
        analysis_result = supabase_admin.table("analyses").select("id", count="exact").eq("user_id", user_id).execute()
        analysis_count = analysis_result.count if analysis_result.count is not None else 0
        score += min(5, analysis_count * 1)  # 1 point per analysis, max 5
    
    # === BUSINESS DEPTH (25 points) ===
    # Product/Service definition (5 points)
    if profile.get("products_services") or profile.get("main_products_services"):
        products_text = profile.get("products_services") or profile.get("main_products_services") or ""
        if len(products_text) > 100:  # Detailed description
            score += 5
        elif len(products_text) > 20:  # Basic description
            score += 3
    
    # Unique value proposition defined (5 points)
    if profile.get("unique_value_proposition"):
        uvp_text = profile.get("unique_value_proposition") or ""
        if len(uvp_text) > 50:
            score += 5
        elif len(uvp_text) > 10:
            score += 3
    
    # Team information (5 points)
    team_fields = ["team_size", "founder_background", "team_strengths"]
    team_filled = sum(1 for f in team_fields if profile.get(f))
    score += (team_filled / len(team_fields)) * 5
    
    # Market understanding (5 points)
    market_fields = ["ideal_customer_profile", "competitive_advantages", "geographic_focus"]
    market_filled = sum(1 for f in market_fields if profile.get(f))
    score += (market_filled / len(market_fields)) * 5
    
    # Vision & Mission (5 points)
    vision_fields = ["mission_statement", "vision_statement", "growth_strategy"]
    vision_filled = sum(1 for f in vision_fields if profile.get(f))
    score += (vision_filled / len(vision_fields)) * 5
    
    # === BUSINESS PERFORMANCE INDICATORS (25 points) ===
    # Revenue/Customer growth indicators (10 points)
    if profile.get("revenue_range"):
        # Base points for having revenue data
        score += 5
        # Bonus for higher revenue ranges
        revenue = profile.get("revenue_range", "")
        if "$1M" in revenue or "$5M" in revenue or "$10M" in revenue:
            score += 3
    
    if profile.get("customer_count"):
        # Having customer data
        score += 2
    
    # Growth trajectory (5 points)
    growth_indicators = ["growth_strategy", "growth_goals", "growth_challenge"]
    growth_filled = sum(1 for f in growth_indicators if profile.get(f))
    score += (growth_filled / len(growth_indicators)) * 5
    
    # Business maturity (5 points)
    if profile.get("years_operating"):
        years = profile.get("years_operating", "")
        if "10+" in years or "5-10" in years:
            score += 5
        elif "2-5" in years:
            score += 3
        elif "1-2" in years:
            score += 2
    
    # Tools & Systems adoption (5 points)
    tools = profile.get("current_tools") or []
    if len(tools) >= 3:
        score += 5
    elif len(tools) >= 1:
        score += 3
    
    return min(100, int(score))  # Cap at 100


@api_router.get("/business-profile/scores")
async def get_profile_scores(current_user: dict = Depends(get_current_user)):
    """Get profile scores — reads from business_profiles (authoritative)"""
    user_id = current_user["id"]
    
    profile = await get_business_profile_supabase(supabase_admin, user_id)
    onboarding = await get_onboarding_supabase(supabase_admin, user_id)
    files_count = await count_user_data_files_supabase(supabase_admin, user_id)
    
    completeness = calculate_profile_completeness(profile) if profile else 0
    business_score = await calculate_business_score(profile, onboarding, user_id) if profile else 0
    
    return {
        "completeness": completeness,
        "strength": business_score,
        "business_score": business_score,
        "has_documents": files_count > 0,
        "document_count": files_count,
        "onboarding_completed": onboarding.get("completed", False) if onboarding else False
    }


# ==================== ADMIN ROUTES ====================

@api_router.post("/admin/backfill-calibration")
async def admin_backfill_calibration(request: Request):
    """
    Backfill user_operator_profile for users who completed calibration
    via any path but have no 'complete' record in user_operator_profile.
    Checks calibration_sessions table for completed sessions.
    """
    try:
        current_user = await get_current_user_from_request(request)
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    backfilled = 0
    skipped = 0
    errors = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    # Source 1: calibration_sessions with completed = true
    try:
        cs_result = supabase_admin.table("calibration_sessions").select(
            "user_id"
        ).eq("completed", True).execute()
        session_users = [r["user_id"] for r in (cs_result.data or []) if r.get("user_id")]
    except Exception:
        session_users = []

    for uid in session_users:
        try:
            op_result = supabase_admin.table("user_operator_profile").select(
                "persona_calibration_status"
            ).eq("user_id", uid).maybeSingle().execute()

            if op_result.data and op_result.data.get("persona_calibration_status") == "complete":
                skipped += 1
                continue

            if op_result.data:
                supabase_admin.table("user_operator_profile").update({
                    "persona_calibration_status": "complete",
                    "calibration_completed_at": now_iso
                }).eq("user_id", uid).execute()
            else:
                supabase_admin.table("user_operator_profile").insert({
                    "user_id": uid,
                    "persona_calibration_status": "complete",
                    "calibration_completed_at": now_iso,
                    "operator_profile": {}
                }).execute()
            backfilled += 1
            logger.info(f"[backfill] Backfilled user_operator_profile for {uid}")
        except Exception as e:
            errors += 1
            logger.error(f"[backfill] Error for user {uid}: {e}")

    return {
        "source_users_found": len(session_users),
        "backfilled": backfilled,
        "already_correct": skipped,
        "errors": errors
    }

@api_router.get("/admin/users")
async def admin_get_users(admin: dict = Depends(get_admin_user)):
    result = supabase_admin.table("users").select("*").order("created_at", desc=True).limit(1000).execute()
    return result.data if result.data else []

@api_router.get("/admin/stats")
async def admin_get_stats(admin: dict = Depends(get_admin_user)):
    user_result = supabase_admin.table("users").select("id", count="exact").execute()
    analysis_result = supabase_admin.table("analyses").select("id", count="exact").execute()
    document_result = supabase_admin.table("documents").select("id", count="exact").execute()
    chat_result = supabase_admin.table("chat_history").select("id", count="exact").execute()

    user_count = user_result.count if user_result.count is not None else 0
    analysis_count = analysis_result.count if analysis_result.count is not None else 0
    document_count = document_result.count if document_result.count is not None else 0
    chat_count = chat_result.count if chat_result.count is not None else 0
    
    # Recent activity
    recent_users_result = supabase_admin.table("users").select("*").order("created_at", desc=True).limit(5).execute()
    recent_analyses_result = supabase_admin.table("analyses").select("*").order("created_at", desc=True).limit(5).execute()
    recent_users = recent_users_result.data if recent_users_result.data else []
    recent_analyses = recent_analyses_result.data if recent_analyses_result.data else []
    
    return {
        "total_users": user_count,
        "total_analyses": analysis_count,
        "total_documents": document_count,
        "total_chats": chat_count,
        "recent_users": recent_users,
        "recent_analyses": recent_analyses
    }

@api_router.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, update: AdminUserUpdate, admin: dict = Depends(get_admin_user)):
    update_dict = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = supabase_admin.table("users").update(update_dict).eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = await get_user_by_id(user_id) # Supabase
    return user

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(get_admin_user)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = supabase_admin.table("users").delete().eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Clean up user data
    supabase_admin.table("analyses").delete().eq("user_id", user_id).execute()
    await delete_user_documents_supabase(supabase_admin, user_id)
    await delete_user_chats_supabase(supabase_admin, user_id)
    
    return {"message": "User and all associated data deleted"}

# ==================== DASHBOARD STATS ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    
    analysis_result = supabase_admin.table("analyses").select("id", count="exact").eq("user_id", user_id).execute()
    analysis_count = analysis_result.count if analysis_result.count is not None else 0
    document_count = await count_user_documents_supabase(supabase_admin, user_id)
    chat_result = supabase_admin.table("chat_history").select("session_id").eq("user_id", user_id).execute()
    session_ids = {row.get("session_id") for row in (chat_result.data or []) if row.get("session_id")}
    
    recent_analyses_result = supabase_admin.table("analyses").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()
    recent_analyses = recent_analyses_result.data if recent_analyses_result.data else []
    
    # Get recent documents using Supabase
    recent_docs_result = supabase_admin.table("documents").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(5).execute()
    recent_documents = recent_docs_result.data if recent_docs_result.data else []
    
    return {
        "total_analyses": analysis_count,
        "total_documents": document_count,
        "total_chat_sessions": len(session_ids),
        "recent_analyses": recent_analyses,
        "recent_documents": recent_documents
    }


@api_router.get("/dashboard/focus")
async def get_dashboard_focus(current_user: dict = Depends(get_current_user)):
    """
    Generate ONE clear business focus for the user based on available data.
    This is the AI mentor's primary output on the dashboard.
    """
    user_id = current_user["id"]
    
    # Gather available data signals
    data_signals = {
        "has_profile": False,
        "profile_completeness": 0,
        "has_outlook": False,
        "emails_synced": 0,
        "has_calendar": False,
        "upcoming_meetings": 0,
        "has_documents": False,
        "document_count": 0,
        "has_chat_history": False,
        "recent_activity": False,
        "email_priority_high": 0,
        "days_since_last_activity": 0
    }
    
    # Check business profile
    profile = await get_business_profile_supabase(supabase_admin, user_id)
    if profile:
        data_signals["has_profile"] = True
        # Calculate simple completeness
        fields = ["business_name", "industry", "business_model", "target_market", "main_challenges", "short_term_goals"]
        filled = sum(1 for f in fields if profile.get(f))
        data_signals["profile_completeness"] = int((filled / len(fields)) * 100)
    
    # Check Outlook connection
    user_doc = await get_user_by_id(user_id) # Supabase
    if user_doc and user_doc.get("outlook_access_token"):
        data_signals["has_outlook"] = True
        # Count emails using Supabase
        email_result = supabase_admin.table("outlook_emails").select("id", count="exact").eq("user_id", user_id).execute()
        email_count = email_result.count if hasattr(email_result, 'count') else 0
        data_signals["emails_synced"] = email_count
        
        # Check high priority emails
        priority = await get_priority_analysis_supabase(supabase_admin, user_id)
        if priority and priority.get("analysis"):
            high_priority = priority["analysis"].get("high_priority", [])
            data_signals["email_priority_high"] = len(high_priority)
    
    # Check calendar
    calendar_count = 0 # Migrated to outlook_calendar_events
    if calendar_count > 0:
        data_signals["has_calendar"] = True
        data_signals["upcoming_meetings"] = calendar_count
    
    # Check documents
    doc_count = await count_user_documents_supabase(supabase_admin, user_id)
    if doc_count > 0:
        data_signals["has_documents"] = True
        data_signals["document_count"] = doc_count
    
    # Check recent activity
    recent_chats_result = supabase_admin.table("chat_history").select("created_at").eq("user_id", user_id).order("created_at", desc=True).limit(1).execute()
    recent_chats = recent_chats_result.data if recent_chats_result.data else []
    
    if recent_chats:
        data_signals["has_chat_history"] = True
        last_activity = recent_chats[0].get("created_at")
        if last_activity:
            try:
                last_date = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))
                days_diff = (datetime.now(timezone.utc) - last_date).days
                data_signals["days_since_last_activity"] = days_diff
                data_signals["recent_activity"] = days_diff < 7
            except:
                pass
    
    # Determine focus based on available signals
    focus = await generate_focus_insight(data_signals, profile, user_doc)
    
    return focus


async def generate_focus_insight(signals: dict, profile: dict, user: dict) -> dict:
    """Generate a single, calm focus insight based on available data."""
    
    # Check what data is actually available
    has_operational_data = signals["has_outlook"] or signals["has_calendar"] or signals["has_documents"]
    has_profile_data = signals["has_profile"] and signals["profile_completeness"] > 30
    
    # Priority 1: High priority emails need attention
    if signals["email_priority_high"] > 0:
        return {
            "focus": "You have emails that need attention.",
            "context": "Recent patterns suggest these may impact important relationships or decisions.",
            "type": "action",
            "confidence": "high"
        }
    
    # Priority 2: Upcoming meetings need prep
    if signals["upcoming_meetings"] > 5:
        return {
            "focus": "Your calendar is busy. Protect your thinking time.",
            "context": "With several meetings ahead, scheduling preparation blocks will help you stay effective.",
            "type": "awareness",
            "confidence": "high"
        }
    
    # Priority 3: Profile needs attention for better insights
    if signals["has_profile"] and signals["profile_completeness"] < 50:
        return {
            "focus": "Your profile could use more detail.",
            "context": "More business context means sharper, more relevant guidance from your AI team.",
            "type": "setup",
            "confidence": "high"
        }
    
    # Priority 4: No data connected yet
    if not has_operational_data and not has_profile_data:
        return {
            "focus": "You're in the early signal phase. Clarity beats optimisation right now.",
            "context": "As you connect tools and add context, your focus will become more precise.",
            "type": "onboarding",
            "confidence": "low"
        }
    
    # Priority 5: Data exists but nothing urgent
    if has_operational_data and signals["recent_activity"]:
        return {
            "focus": "Nothing requires urgent attention right now.",
            "context": "Your available data suggests stability. This is a good time to maintain discipline.",
            "type": "stability",
            "confidence": "medium"
        }
    
    # Priority 6: User hasn't been active recently
    if signals["days_since_last_activity"] > 7:
        return {
            "focus": "Consistency creates clarity.",
            "context": "A quick check-in keeps your business intelligence fresh and relevant.",
            "type": "engagement",
            "confidence": "medium"
        }
    
    # Default: Calm reassurance
    return {
        "focus": "Everything looks stable. Stay the course.",
        "context": "No significant changes detected since your last visit.",
        "type": "stability",
        "confidence": "medium"
    }


# ==================== SMART NOTIFICATIONS ====================

@api_router.get("/notifications/alerts")
async def get_smart_notifications(current_user: dict = Depends(get_current_user)):
    """
    AI-powered notifications that surface important business signals.
    Analyzes emails, calendar, web data to identify material impacts.
    """
    user_id = current_user["id"]
    notifications = []
    
    # Check for high priority emails (customer complaints, urgent issues)
    priority_analysis = await get_priority_analysis_supabase(supabase_admin, user_id)
    
    if priority_analysis and priority_analysis.get("analysis"):
        high_priority = priority_analysis["analysis"].get("high_priority", [])
        for email in high_priority[:3]:
            notifications.append({
                "id": f"email_{email.get('email_id', 'unknown')}",
                "type": "email",
                "severity": "high",
                "title": "Important email needs attention",
                "message": f"From {email.get('from', 'Unknown')}: {email.get('subject', 'No subject')[:50]}",
                "action": email.get("suggested_action", "Review and respond"),
                "source": "Email Intelligence",
                "timestamp": email.get("received") or datetime.now(timezone.utc).isoformat()
            })
    
    # Check recent emails for complaint keywords
    recent_emails_result = supabase_admin.table("outlook_emails").select(
        "subject,body_preview,from_name,from_address,received_date,id"
    ).eq("user_id", user_id).order("received_date", desc=True).limit(50).execute()
    recent_emails = recent_emails_result.data if recent_emails_result.data else []
    
    complaint_keywords = ["complaint", "unhappy", "disappointed", "refund", "cancel", "frustrated", "unacceptable", "terrible", "worst", "issue", "problem", "urgent"]
    
    for email in recent_emails:
        subject = (email.get("subject") or "").lower()
        preview = (email.get("body_preview") or "").lower()
        content = subject + " " + preview
        
        for keyword in complaint_keywords:
            if keyword in content:
                notifications.append({
                    "id": f"complaint_{email.get('id', 'unknown')}",
                    "type": "complaint",
                    "severity": "high",
                    "title": "Potential customer concern detected",
                    "message": f"Email from {email.get('from_name') or email.get('from_address', 'Unknown')}: {email.get('subject', '')[:40]}",
                    "action": "Review and respond promptly",
                    "source": "Email Analysis",
                    "timestamp": email.get("received_date") or datetime.now(timezone.utc).isoformat()
                })
                break  # Only one notification per email
    
    # Check calendar for important upcoming meetings
    calendar_events = await get_user_calendar_events_supabase(supabase_admin, user_id)
    
    now = datetime.now(timezone.utc)
    important_keywords = ["review", "client", "investor", "board", "presentation", "pitch", "deadline", "important", "urgent", "critical"]
    
    for event in calendar_events:
        try:
            event_start = datetime.fromisoformat(event.get("start", "").replace("Z", "+00:00"))
            hours_until = (event_start - now).total_seconds() / 3600
            
            # Check if it's within 24 hours and has important keywords
            if 0 < hours_until < 24:
                subject = (event.get("subject") or "").lower()
                is_important = any(kw in subject for kw in important_keywords) or event.get("importance") == "high"
                
                if is_important:
                    notifications.append({
                        "id": f"meeting_{event.get('id', 'unknown')}",
                        "type": "meeting",
                        "severity": "medium",
                        "title": "Important meeting coming up",
                        "message": f"{event.get('subject', 'Meeting')} in {int(hours_until)} hours",
                        "action": "Prepare materials and review agenda",
                        "source": "Calendar",
                        "timestamp": event.get("start")
                    })
        except:
            pass
    
    # Check for operational patterns in emails
    email_intel = await get_email_intelligence_supabase(supabase_admin, user_id)
    if email_intel:
        # Check for declining engagement with key clients
        top_clients = email_intel.get("top_clients", [])
        for client in top_clients[:5]:
            if client.get("trend") == "declining":
                notifications.append({
                    "id": f"client_{client.get('email', 'unknown')}",
                    "type": "relationship",
                    "severity": "medium",
                    "title": "Client engagement declining",
                    "message": f"Communication with {client.get('name', client.get('email', 'key contact'))} has decreased",
                    "action": "Consider reaching out to maintain relationship",
                    "source": "Relationship Intelligence",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
    
    # Deduplicate notifications by ID
    seen_ids = set()
    unique_notifications = []
    for notif in notifications:
        if notif["id"] not in seen_ids:
            seen_ids.add(notif["id"])
            unique_notifications.append(notif)
    
    # Sort by severity (high first) then by timestamp
    severity_order = {"high": 0, "medium": 1, "low": 2}
    unique_notifications.sort(key=lambda x: (severity_order.get(x["severity"], 2), x.get("timestamp", "")))
    
    # Limit to top 10 notifications
    unique_notifications = unique_notifications[:10]
    
    # Calculate summary counts
    high_count = sum(1 for n in unique_notifications if n["severity"] == "high")
    medium_count = sum(1 for n in unique_notifications if n["severity"] == "medium")
    
    return {
        "notifications": unique_notifications,
        "summary": {
            "total": len(unique_notifications),
            "high": high_count,
            "medium": medium_count,
            "low": len(unique_notifications) - high_count - medium_count
        },
        "has_alerts": len(unique_notifications) > 0
    }


@api_router.post("/notifications/dismiss/{notification_id}")
async def dismiss_notification(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Dismiss a notification"""
    supabase_admin.table("dismissed_notifications").upsert({
        "user_id": current_user["id"],
        "notification_id": notification_id,
        "dismissed_at": datetime.now(timezone.utc).isoformat()
    }, on_conflict="user_id,notification_id").execute()
    return {"status": "dismissed"}


# ==================== ROOT ====================


# ==================== MERGE.DEV INTEGRATION ====================

@api_router.post("/integrations/merge/link-token")
async def create_merge_link_token(
    payload: Optional[MergeLinkTokenRequest] = None,
    current_user: dict = Depends(get_current_user)
):
    """Generate Merge.dev link token for workspace (P0: workspace-scoped)"""
    from workspace_helpers import get_or_create_user_account
    
    merge_api_key = os.environ.get("MERGE_API_KEY")
    
    if not merge_api_key:
        logger.error("❌ MERGE_API_KEY not configured in environment")
        raise HTTPException(status_code=500, detail="MERGE_API_KEY not configured")
    
    user_id = current_user["id"]
    user_email = current_user.get("email", "user@biqc.com")
    company_name = current_user.get("company_name")
    
    # P0 FIX: Get or create workspace for user
    try:
        account = await get_or_create_user_account(supabase_admin, user_id, user_email, company_name)
        account_id = account["id"]
        account_name = account["name"]
        
        logger.info(f"🔗 Creating Merge link token for workspace: {account_name} ({account_id})")
        logger.info(f"   Requested by user: {user_email} ({user_id})")
        
    except Exception as e:
        logger.error(f"❌ Failed to get/create workspace: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to initialize workspace")
    
    try:
        async with httpx.AsyncClient() as client:
            requested_categories = payload.categories if payload and payload.categories else None
            categories = requested_categories or ["accounting", "crm", "hris", "ats"]
            # P0 FIX: Send workspace_id as end_user_origin_id (NOT user_id)
            # P0 FIX: Send workspace name as end_user_organization_name (NOT hardcoded)
            response = await client.post(
                "https://api.merge.dev/api/integrations/create-link-token",
                headers={
                    "Authorization": f"Bearer {merge_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "end_user_origin_id": account_id,  # WORKSPACE ID (was user_id)
                    "end_user_organization_name": account_name,  # WORKSPACE NAME (was hardcoded)
                    "end_user_email_address": user_email,
                    "categories": categories
                }
            )
            
            logger.info(f"📊 Merge create-link-token response status: {response.status_code}")
            
            if response.status_code != 200:
                error_detail = response.text
                logger.error(f"❌ Merge.dev API error: Status {response.status_code}, Response: {error_detail}")
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            data = response.json()
            link_token = data.get("link_token")
            
            if not link_token:
                logger.error("❌ No link_token in Merge API response")
                raise HTTPException(status_code=500, detail="No link_token in response")
            
            logger.info(f"✅ Link token created for workspace {account_name}")
            return {"link_token": link_token}
            
    except httpx.HTTPError as e:
        logger.error(f"❌ HTTP error calling Merge API: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Network error: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Unexpected error creating link token: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Link token creation failed: {str(e)}")


@api_router.post("/integrations/merge/exchange-account-token")
async def exchange_merge_account_token(
    public_token: str = Form(...),
    category: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Exchange Merge public_token for account_token and persist (P0: workspace-scoped)"""
    from workspace_helpers import get_user_account
    
    merge_api_key = os.environ.get("MERGE_API_KEY")
    
    if not merge_api_key:
        logger.error("❌ MERGE_API_KEY not configured in environment")
        raise HTTPException(status_code=500, detail="MERGE_API_KEY not configured")
    
    user_id = current_user["id"]
    user_email = current_user.get("email", "unknown")
    
    # P0 FIX: Get user's workspace
    try:
        account = await get_user_account(supabase_admin, user_id)
        if not account:
            logger.error(f"❌ User {user_id} has no workspace - cannot store integration")
            raise HTTPException(status_code=400, detail="User workspace not initialized")
        
        account_id = account["id"]
        account_name = account["name"]
        
        logger.info(f"🔄 Exchanging Merge token for workspace: {account_name} ({account_id})")
        logger.info(f"   Requested by user: {user_email} ({user_id}), category: {category}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get workspace: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get workspace")
    
    # Exchange public_token for account_token
    try:
        async with httpx.AsyncClient() as client:
            exchange_url = f"https://api.merge.dev/api/integrations/account-token/{public_token}"
            logger.info(f"📡 Calling Merge API: {exchange_url}")
            
            response = await client.get(
                exchange_url,
                headers={"Authorization": f"Bearer {merge_api_key}"}
            )
            
            logger.info(f"📊 Merge API response status: {response.status_code}")
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"❌ Merge API error ({response.status_code}): {error_text}")
                raise HTTPException(
                    status_code=response.status_code, 
                    detail=f"Merge API error: {error_text}"
                )
            
            data = response.json()
            logger.info(f"📦 Merge API response: {data}")
            
            account_token = data.get("account_token")
            integration_info = data.get("integration", {})
            integration_name = integration_info.get("name", "unknown")
            merge_account_id = data.get("id")  # FIX: ID is at root level, not in integration object
            
            # VALIDATE CATEGORY from Merge API response
            merge_categories = integration_info.get("categories", [])
            validated_category = merge_categories[0] if merge_categories else category
            if validated_category != category:
                logger.warning(f"⚠️ Category mismatch detected: frontend='{category}', Merge API='{validated_category}' - using Merge's category")
                category = validated_category
            
            if not account_token:
                logger.error("❌ No account_token in Merge API response")
                raise HTTPException(status_code=500, detail="No account_token in response")
            
            logger.info(f"✅ Received account_token for integration: {integration_name} (category: {category})")
            if merge_account_id:
                logger.info(f"✅ Merge account ID: {merge_account_id}")
            else:
                logger.warning(f"⚠️ No merge_account_id in response - this may cause issues")
    
    except httpx.HTTPError as e:
        logger.error(f"❌ HTTP error calling Merge API: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Network error: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Unexpected error during token exchange: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Token exchange failed: {str(e)}")
    
    # P0 FIX: Store integration at workspace level (not user level)
    try:
        logger.info(f"💾 Storing integration for workspace: {account_name}")
        logger.info(f"   provider={integration_name}, category={category}, connected_by={user_email}")
        
        # P0 FIX: Store with account_id (workspace) + merge_account_id
        integration_data = {
            "account_id": account_id,  # WORKSPACE ID (NEW)
            "user_id": user_id,  # User who connected (for audit)
            "provider": integration_name,
            "category": category,
            "account_token": account_token,
            "merge_account_id": merge_account_id,  # MERGE ACCOUNT ID (NEW)
            "connected_at": datetime.now(timezone.utc).isoformat()
        }
        
        # P0 FIX: Use workspace-level uniqueness constraint
        result = supabase_admin.table("integration_accounts").upsert(
            integration_data,
            on_conflict="account_id,category"  # Workspace + category (was user_id,category)
        ).execute()
        
        if not result.data:
            logger.error("❌ Failed to store account_token in Supabase")
            raise HTTPException(status_code=500, detail="Failed to store account_token")
        
        logger.info(f"✅ Integration account stored successfully: {result.data}")
        
        return {
            "success": True,
            "provider": integration_name,
            "category": category
        }
        
    except Exception as e:
        logger.error(f"❌ Database error storing integration: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@api_router.get("/integrations/merge/connected")
async def get_connected_merge_integrations(current_user: dict = Depends(get_current_user)):
    """Get all connected Merge.dev integrations for the workspace (P0: workspace-scoped)"""
    from workspace_helpers import get_user_account, get_account_integrations
    
    try:
        user_id = current_user["id"]
        
        # P0 FIX: Get workspace for user
        account = await get_user_account(supabase_admin, user_id)
        if not account:
            logger.warning(f"⚠️  User {user_id} has no workspace - returning empty integrations")
            return {"integrations": {}}
        
        account_id = account["id"]
        account_name = account["name"]
        
        # P0 FIX: Fetch integrations by workspace (not user)
        integration_records = await get_account_integrations(supabase_admin, account_id)
        
        integrations = {}
        for record in integration_records:
            provider = record.get("provider", "unknown")
            category = record.get("category", "unknown")
            merge_account_id = record.get("merge_account_id")
            
            # FILTER: Exclude email category from Merge integrations
            # Email handled by Supabase Edge Functions (Outlook/Gmail), not Merge
            if category == "email":
                logger.info(f"   Skipping {provider} (email category - not a Merge integration)")
                continue
            
            # Only include integrations with merge_account_id (true Merge integrations)
            if not merge_account_id:
                logger.info(f"   Skipping {provider} (no merge_account_id - not a Merge integration)")
                continue
            
            integrations[provider] = {
                "provider": provider,
                "category": category,
                "connected": True,
                "connected_at": record.get("connected_at") or record.get("created_at"),
                "merge_account_id": merge_account_id,
                "workspace_id": account_id,
                "workspace_name": account_name
            }
        
        logger.info(f"✅ Found {len(integrations)} workspace integrations for {account_name} ({account_id})")
        return {"integrations": integrations}
        
    except Exception as e:
        logger.error(f"❌ Error fetching connected integrations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== MERGE.DEV CRM DATA ACCESS ====================
# Authoritative pattern: All CRM access via Merge Unified API
# BIQC never authenticates directly with HubSpot/Salesforce/etc.


@api_router.get("/integrations/crm/contacts")
async def get_crm_contacts(
    cursor: Optional[str] = None,
    page_size: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """
    Get CRM contacts via Merge.dev (workspace-scoped)
    
    Works with: HubSpot, Salesforce, Pipedrive, etc.
    All OAuth and tokens managed by Merge.dev
    """
    from merge_client import get_merge_client
    from workspace_helpers import get_user_account, get_merge_account_token
    
    user_id = current_user["id"]
    
    # Get user's workspace
    account = await get_user_account(supabase_admin, user_id)
    if not account:
        raise HTTPException(
            status_code=400,
            detail="User workspace not initialized"
        )
    
    account_id = account["id"]
    account_name = account["name"]
    
    # Get Merge account token for this workspace's CRM integration
    account_token = await get_merge_account_token(supabase_admin, account_id, "crm")
    
    if not account_token:
        logger.warning(f"⚠️  Workspace {account_name} has no CRM integration")
        raise HTTPException(
            status_code=409,
            detail="IntegrationNotConnected: No CRM integration found for workspace. Please connect HubSpot, Salesforce, or another CRM."
        )
    
    logger.info(f"📇 Fetching CRM contacts for workspace: {account_name}")
    
    # Call Merge Unified API
    merge_client = get_merge_client()
    
    try:
        data = await merge_client.get_contacts(
            account_token=account_token,
            cursor=cursor,
            page_size=page_size
        )
        
        logger.info(f"✅ Retrieved {len(data.get('results', []))} contacts")
        return data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching contacts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/integrations/crm/companies")
async def get_crm_companies(
    cursor: Optional[str] = None,
    page_size: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """
    Get CRM companies via Merge.dev (workspace-scoped)
    
    Works with: HubSpot, Salesforce, Pipedrive, etc.
    """
    from merge_client import get_merge_client
    from workspace_helpers import get_user_account, get_merge_account_token
    
    user_id = current_user["id"]
    
    account = await get_user_account(supabase_admin, user_id)
    if not account:
        raise HTTPException(status_code=400, detail="User workspace not initialized")
    
    account_id = account["id"]
    account_name = account["name"]
    
    account_token = await get_merge_account_token(supabase_admin, account_id, "crm")
    
    if not account_token:
        raise HTTPException(
            status_code=409,
            detail="IntegrationNotConnected: No CRM integration connected"
        )
    
    logger.info(f"🏢 Fetching CRM companies for workspace: {account_name}")
    
    merge_client = get_merge_client()
    
    try:
        data = await merge_client.get_companies(
            account_token=account_token,
            cursor=cursor,
            page_size=page_size
        )
        
        logger.info(f"✅ Retrieved {len(data.get('results', []))} companies")
        return data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching companies: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/integrations/crm/deals")
async def get_crm_deals(
    cursor: Optional[str] = None,
    page_size: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """
    Get CRM deals/opportunities via Merge.dev (workspace-scoped)
    
    Works with: HubSpot, Salesforce, Pipedrive, etc.
    """
    from merge_client import get_merge_client
    from workspace_helpers import get_user_account, get_merge_account_token
    
    user_id = current_user["id"]
    
    account = await get_user_account(supabase_admin, user_id)
    if not account:
        raise HTTPException(status_code=400, detail="User workspace not initialized")
    
    account_id = account["id"]
    account_name = account["name"]
    
    account_token = await get_merge_account_token(supabase_admin, account_id, "crm")
    
    if not account_token:
        raise HTTPException(
            status_code=409,
            detail="IntegrationNotConnected: No CRM integration connected"
        )
    
    logger.info(f"💼 Fetching CRM deals for workspace: {account_name}")
    
    merge_client = get_merge_client()
    
    try:
        data = await merge_client.get_deals(
            account_token=account_token,
            cursor=cursor,
            page_size=page_size
        )
        
        logger.info(f"✅ Retrieved {len(data.get('results', []))} deals")
        return data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching deals: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/integrations/crm/owners")
async def get_crm_owners(
    cursor: Optional[str] = None,
    page_size: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """
    Get CRM users/owners via Merge.dev (workspace-scoped)
    
    Works with: HubSpot, Salesforce, Pipedrive, etc.
    """
    from merge_client import get_merge_client
    from workspace_helpers import get_user_account, get_merge_account_token
    
    user_id = current_user["id"]
    
    account = await get_user_account(supabase_admin, user_id)
    if not account:
        raise HTTPException(status_code=400, detail="User workspace not initialized")
    
    account_id = account["id"]
    account_name = account["name"]
    
    account_token = await get_merge_account_token(supabase_admin, account_id, "crm")
    
    if not account_token:
        raise HTTPException(
            status_code=409,
            detail="IntegrationNotConnected: No CRM integration connected"
        )
    
    logger.info(f"👥 Fetching CRM owners for workspace: {account_name}")
    
    merge_client = get_merge_client()
    
    try:
        data = await merge_client.get_users(
            account_token=account_token,
            cursor=cursor,
            page_size=page_size
        )
        
        logger.info(f"✅ Retrieved {len(data.get('results', []))} owners")
        return data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching owners: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/")
async def root():
    return {"message": "Strategic Advisor API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# ==================== VOICE CHAT (REALTIME) ====================

# Initialize OpenAI Realtime Voice Chat
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



# ==================== TRUTH ENGINE: COLD READ PROTOCOL ====================

@api_router.post("/intelligence/cold-read")
async def trigger_cold_read(current_user: dict = Depends(get_current_user)):
    """
    WATCHTOWER COLD READ - RPC-Based Intelligence
    
    Uses Supabase server-side functions for performance
    """
    from truth_engine_rpc import generate_cold_read
    from watchtower_store import get_watchtower_store
    from workspace_helpers import get_user_account
    
    user_id = current_user["id"]
    
    # Get workspace
    account = await get_user_account(supabase_admin, user_id)
    if not account:
        raise HTTPException(status_code=400, detail="Workspace not initialized")
    
    account_id = account["id"]
    
    logger.info(f"🔍 Watchtower Cold Read (RPC) triggered for account {account_id}, user {user_id}")
    
    # Execute Cold Read via RPCs
    result = await generate_cold_read(
        user_id=user_id,
        account_id=account_id,
        supabase_admin=supabase_admin,
        watchtower_store=get_watchtower_store()
    )
    
    return {
        "success": True,
        "cold_read": result
    }


@api_router.get("/intelligence/watchtower")
async def get_watchtower_events(
    status: Optional[str] = "active",
    current_user: dict = Depends(get_current_user)
):
    """
    Get Watchtower events for current workspace
    
    These are authoritative intelligence statements
    """
    from workspace_helpers import get_user_account
    from watchtower_store import get_watchtower_store
    
    user_id = current_user["id"]
    
    try:
        account = await get_user_account(supabase_admin, user_id)
        if not account:
            logger.error(f"No workspace found for user {user_id}")
            raise HTTPException(status_code=400, detail="Workspace not initialized. Contact support.")
        
        account_id = account["id"]
        
        # Fetch watchtower events
        watchtower = get_watchtower_store()
        events = await watchtower.get_events(account_id, status=status)
        
        logger.info(f"✅ Watchtower events fetched for workspace {account_id}: {len(events)} events")
        
        return {
            "events": events,
            "count": len(events)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Watchtower fetch failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch watchtower events: {str(e)}")


@api_router.patch("/intelligence/watchtower/{event_id}/handle")
async def handle_watchtower_event(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark a Watchtower event as handled
    """
    from watchtower_store import get_watchtower_store
    
    user_id = current_user["id"]
    
    watchtower = get_watchtower_store()
    success = await watchtower.handle_event(event_id, user_id)
    
    return {
        "success": success
    }


# ═══════════════════════════════════════════════════════════════
# WATCHTOWER ENGINE V2 — Continuous Business Intelligence
# ═══════════════════════════════════════════════════════════════

class ObservationEventRequest(BaseModel):
    domain: str
    event_type: str
    payload: Dict[str, Any] = {}
    source: str
    severity: str = "info"
    observed_at: Optional[str] = None


@api_router.post("/watchtower/emit")
async def watchtower_emit_event(
    event: ObservationEventRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Emit an observation event.
    Called by integrations when they detect a factual signal.
    """
    from watchtower_engine import get_watchtower_engine
    engine = get_watchtower_engine()

    if event.domain not in ("finance", "sales", "operations", "team", "market"):
        raise HTTPException(status_code=400, detail=f"Invalid domain: {event.domain}")

    result = await engine.emit_event(
        user_id=current_user["id"],
        domain=event.domain,
        event_type=event.event_type,
        payload=event.payload,
        source=event.source,
        severity=event.severity,
        observed_at=event.observed_at,
    )

    if result is None:
        raise HTTPException(status_code=500, detail="Failed to persist observation event")

    return {"success": True, "event_id": result.get("id")}


@api_router.post("/watchtower/analyse")
async def watchtower_analyse(
    current_user: dict = Depends(get_current_user)
):
    """
    Trigger a Watchtower analysis cycle for the current user.
    Event-driven or scheduled — behaviour is identical.
    """
    from watchtower_engine import get_watchtower_engine
    engine = get_watchtower_engine()

    result = await engine.run_analysis(current_user["id"])
    return result


@api_router.get("/watchtower/positions")
async def watchtower_get_positions(
    current_user: dict = Depends(get_current_user)
):
    """
    Read current domain positions for the current user.
    Returns the most recent position per domain.
    """
    from watchtower_engine import get_watchtower_engine
    engine = get_watchtower_engine()

    positions = await engine.get_positions(current_user["id"])
    return {"positions": positions}


@api_router.get("/watchtower/findings")
async def watchtower_get_findings(
    domain: Optional[str] = None,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """
    Read historical findings (position changes and material findings).
    Append-only record of judgement over time.
    """
    from watchtower_engine import get_watchtower_engine
    engine = get_watchtower_engine()

    findings = await engine.get_findings(current_user["id"], domain=domain, limit=limit)
    return {"findings": findings, "count": len(findings)}


# ═══════════════════════════════════════════════════════════════
# BOARD ROOM — Authority Execution Mode
# ═══════════════════════════════════════════════════════════════

class BoardRoomRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, str]]] = []


@api_router.post("/boardroom/respond")
async def boardroom_respond(request: Request, payload: BoardRoomRequest):
    """
    Board Room — Authority response endpoint.

    Priority order:
    1. Watchtower State (positions, findings)
    2. Intelligence Configuration
    3. Calibration (operator profile)
    4. User Message (secondary context)
    """
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    message = payload.message.strip()
    history = payload.history or []

    if not message:
        raise HTTPException(status_code=400, detail="Message required")

    try:
        from watchtower_engine import get_watchtower_engine
        from boardroom_prompt import build_boardroom_prompt

        engine = get_watchtower_engine()

        # 1. Load Watchtower State
        positions = await engine.get_positions(user_id)
        findings = await engine.get_findings(user_id, limit=10)

        # 2. Load Intelligence Configuration
        intel_config = None
        try:
            bp_result = supabase_admin.table("business_profiles").select(
                "intelligence_configuration"
            ).eq("user_id", user_id).single().execute()
            if bp_result.data:
                intel_config = bp_result.data.get("intelligence_configuration")
        except Exception:
            pass

        # 3. Load Calibration
        calibration = None
        try:
            cal_result = supabase_admin.table("user_operator_profile").select(
                "operator_profile, agent_persona, agent_instructions"
            ).eq("user_id", user_id).single().execute()
            if cal_result.data:
                calibration = cal_result.data
        except Exception:
            pass

        # 4. Load Escalation Memory
        escalation_history = None
        try:
            from escalation_memory import get_escalation_memory
            mem = get_escalation_memory()
            escalation_history = await mem.get_active_escalations(user_id)
        except RuntimeError:
            pass

        # 5. Load Contradictions
        contradictions = None
        try:
            from contradiction_engine import get_contradiction_engine
            ce = get_contradiction_engine()
            contradictions = await ce.get_active_contradictions(user_id)
        except RuntimeError:
            pass

        # 6. Load Decision Pressure
        pressure = None
        try:
            from pressure_calibration import get_pressure_calibration
            pc = get_pressure_calibration()
            pressure = await pc.get_active_pressures(user_id)
        except RuntimeError:
            pass

        # 7. Load Evidence Freshness
        freshness = None
        try:
            from evidence_freshness import get_evidence_freshness
            ef = get_evidence_freshness()
            freshness = await ef.get_freshness(user_id)
        except RuntimeError:
            pass

        # Build system prompt
        system_prompt = build_boardroom_prompt(
            watchtower_positions=positions,
            watchtower_findings=findings,
            intelligence_config=intel_config,
            calibration=calibration,
            escalation_history=escalation_history,
            contradictions=contradictions,
            pressure=pressure,
            freshness=freshness,
        )

        # Build context + message
        chat = LlmChat(
            api_key=OPENAI_KEY,
            session_id=f"boardroom_{user_id}",
            system_message=system_prompt,
        )
        chat.with_model("openai", "gpt-4o")

        context_block = ""
        if history:
            context_block = "PRIOR EXCHANGE:\n"
            for h in history:
                role = h.get("role", "user")
                content = h.get("content", "")
                label = "OPERATOR" if role == "user" else "BOARD ROOM"
                context_block += f"[{label}]: {content}\n"
            context_block += "\n---\n"

        full_message = f"{context_block}OPERATOR INPUT: {message}"
        user_msg = UserMessage(text=full_message)
        raw_response = await chat.send_message(user_msg)

        # Record exposure for active escalations
        active_escalations = []
        try:
            from escalation_memory import get_escalation_memory
            mem = get_escalation_memory()
            for domain in positions:
                pos = positions[domain].get("position")
                if pos and pos != "STABLE":
                    await mem.record_exposure(user_id, domain)
            # Include active escalations in response for frontend action buttons
            esc_list = await mem.get_active_escalations(user_id)
            for esc in esc_list:
                active_escalations.append({
                    "domain": esc.get("domain"),
                    "position": esc.get("position"),
                    "last_user_action": esc.get("last_user_action", "unknown"),
                    "times_detected": esc.get("times_detected", 1),
                })
        except RuntimeError:
            pass

        return {
            "response": raw_response.strip(),
            "escalations": active_escalations,
        }

    except Exception as e:
        logger.error(f"[boardroom] Error: {e}")
        return {"response": "Intelligence link disrupted. Retry.", "escalations": []}


class EscalationActionRequest(BaseModel):
    domain: str
    action: str  # acknowledged | deferred


@api_router.post("/boardroom/escalation-action")
async def boardroom_escalation_action(
    request: Request,
    payload: EscalationActionRequest,
):
    """
    Record user acknowledgement or deferral of an escalated risk.
    Informational only — does NOT resolve risk or reduce pressure.
    """
    try:
        current_user = await get_current_user_from_request(request)
        user_id = current_user.get("id")
    except Exception:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if payload.action not in ("acknowledged", "deferred"):
        raise HTTPException(status_code=400, detail="Action must be 'acknowledged' or 'deferred'")

    try:
        from escalation_memory import get_escalation_memory
        mem = get_escalation_memory()
        await mem.record_user_action(user_id, payload.domain, payload.action)
        return {"success": True, "domain": payload.domain, "action": payload.action}
    except RuntimeError:
        raise HTTPException(status_code=500, detail="Escalation memory not available")


# ═══════════════════════════════════════════════════════════════
# MERGE EMISSION — Integration Signal Trigger
# ═══════════════════════════════════════════════════════════════

@api_router.post("/emission/run")
async def run_emission(current_user: dict = Depends(get_current_user)):
    """
    Trigger a Merge emission cycle.
    Reads connected integrations, emits observation events.
    """
    from workspace_helpers import get_user_account

    user_id = current_user["id"]

    account = await get_user_account(supabase_admin, user_id)
    if not account:
        raise HTTPException(status_code=400, detail="Workspace not initialized")

    try:
        from merge_emission_layer import get_emission_layer
        layer = get_emission_layer()
    except RuntimeError:
        return {"signals_emitted": 0, "status": "emission_layer_not_available"}

    result = await layer.run_emission(user_id, account["id"])
    return result


# ═══════════════════════════════════════════════════════════════
# SNAPSHOT AGENT — Periodic Intelligence Briefings
# ═══════════════════════════════════════════════════════════════

@api_router.post("/snapshot/generate")
async def snapshot_generate(
    snapshot_type: str = "ad_hoc",
    current_user: dict = Depends(get_current_user),
):
    """
    Generate an intelligence snapshot if material change exists.
    Returns the snapshot or null if silence is correct.
    """
    from snapshot_agent import get_snapshot_agent
    agent = get_snapshot_agent()

    result = await agent.generate_snapshot(current_user["id"], snapshot_type)
    if result is None:
        return {"generated": False, "reason": "no_material_change"}
    return {"generated": True, "snapshot": result}


@api_router.get("/snapshot/latest")
async def snapshot_latest(current_user: dict = Depends(get_current_user)):
    """Read the most recent intelligence snapshot."""
    from snapshot_agent import get_snapshot_agent
    agent = get_snapshot_agent()

    snapshot = await agent.get_latest_snapshot(current_user["id"])
    return {"snapshot": snapshot}


@api_router.get("/snapshot/history")
async def snapshot_history(
    limit: int = 10,
    current_user: dict = Depends(get_current_user),
):
    """Read snapshot history."""
    from snapshot_agent import get_snapshot_agent
    agent = get_snapshot_agent()

    snapshots = await agent.get_snapshots(current_user["id"], limit=limit)
    return {"snapshots": snapshots, "count": len(snapshots)}


# ═══════════════════════════════════════════════════════════════
# INTELLIGENCE BASELINE — Configuration
# ═══════════════════════════════════════════════════════════════

class BaselineSaveRequest(BaseModel):
    baseline: Dict[str, Any]


@api_router.get("/baseline")
async def baseline_get(current_user: dict = Depends(get_current_user)):
    """Read the user's intelligence baseline."""
    from intelligence_baseline import get_intelligence_baseline
    bl = get_intelligence_baseline()
    existing = await bl.get_baseline(current_user["id"])
    if existing:
        return {"baseline": existing.get("baseline"), "configured": True}
    defaults = await bl.get_defaults()
    return {"baseline": defaults, "configured": False}


@api_router.post("/baseline")
async def baseline_save(
    payload: BaselineSaveRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Save the user's intelligence baseline.
    Syncs to business_profiles.intelligence_configuration automatically.
    """
    from intelligence_baseline import get_intelligence_baseline
    bl = get_intelligence_baseline()
    result = await bl.save_baseline(current_user["id"], payload.baseline)
    return {"saved": True, "baseline": result}


@api_router.get("/baseline/defaults")
async def baseline_defaults(current_user: dict = Depends(get_current_user)):
    """Return the default baseline structure."""
    from intelligence_baseline import get_intelligence_baseline
    bl = get_intelligence_baseline()
    defaults = await bl.get_defaults()
    return {"baseline": defaults}


# Include router and middleware
app.include_router(api_router)
app.include_router(voice_router, prefix="/api/voice")

# CORS middleware already added at app initialization (line ~160)
# Removed duplicate CORS configuration from here

@app.on_event("shutdown")
async def shutdown_db_client():
    pass  # MongoDB client removed — no cleanup needed


# ==================== GOOGLE DRIVE INTEGRATION (MERGE.DEV) ====================

@api_router.post("/integrations/google-drive/connect")
async def connect_google_drive(current_user: dict = Depends(get_current_user)):
    """
    Generate Merge Link Token for Google Drive connection
    100% Supabase storage - Zero MongoDB
    """
    from workspace_helpers import get_or_create_user_account
    
    merge_api_key = os.environ.get("MERGE_API_KEY")
    if not merge_api_key:
        raise HTTPException(status_code=500, detail="MERGE_API_KEY not configured")
    
    user_id = current_user["id"]
    user_email = current_user.get("email")
    
    # Get workspace
    account = await get_or_create_user_account(supabase_admin, user_id, user_email)
    account_id = account["id"]
    account_name = account["name"]
    
    logger.info(f"🔗 Creating Google Drive link token for workspace: {account_name}")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.merge.dev/api/integrations/create-link-token",
                headers={
                    "Authorization": f"Bearer {merge_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "end_user_origin_id": account_id,
                    "end_user_organization_name": account_name,
                    "end_user_email_address": user_email,
                    "categories": ["file_storage"]  # Google Drive category
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            
            data = response.json()
            link_token = data.get("link_token")
            
            if not link_token:
                raise HTTPException(status_code=500, detail="No link_token in response")
            
            logger.info(f"✅ Google Drive link token created")
            return {"link_token": link_token}
            
    except Exception as e:
        logger.error(f"❌ Error creating link token: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/integrations/google-drive/callback")
async def google_drive_callback(
    public_token: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Handle Google Drive connection callback from Merge.dev
    Stores account_token in Supabase and triggers initial sync
    """
    from workspace_helpers import get_user_account
    from supabase_drive_helpers import store_merge_integration
    
    merge_api_key = os.environ.get("MERGE_API_KEY")
    user_id = current_user["id"]
    
    # Get workspace
    account = await get_user_account(supabase_admin, user_id)
    if not account:
        raise HTTPException(status_code=400, detail="Workspace not initialized")
    
    account_id = account["id"]
    
    # Exchange public_token for account_token
    try:
        async with httpx.AsyncClient() as client:
            exchange_url = f"https://api.merge.dev/api/integrations/account-token/{public_token}"
            
            response = await client.get(
                exchange_url,
                headers={"Authorization": f"Bearer {merge_api_key}"}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            
            data = response.json()
            account_token = data.get("account_token")
            integration_info = data.get("integration", {})
            
            if not account_token:
                raise HTTPException(status_code=500, detail="No account_token received")
            
            # Store integration in Supabase
            integration_data = {
                "account_id": account_id,
                "user_id": user_id,
                "account_token": account_token,
                "integration_category": "file_storage",
                "integration_slug": "google_drive",
                "integration_name": integration_info.get("name", "Google Drive"),
                "status": "active",
                "connected_at": datetime.now(timezone.utc).isoformat(),
                "end_user_email": current_user.get("email")
            }
            
            await store_merge_integration(supabase_admin, integration_data)
            
            logger.info(f"✅ Google Drive connected for workspace {account_id}")
            
            # Trigger initial sync
            import asyncio
            asyncio.create_task(sync_google_drive_files(user_id, account_id, account_token))
            
            return {
                "success": True,
                "message": "Google Drive connected successfully",
                "provider": "Google Drive"
            }
            
    except Exception as e:
        logger.error(f"❌ Google Drive callback error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def sync_google_drive_files(user_id: str, account_id: str, account_token: str):
    """
    Background task: Sync Google Drive files to Supabase
    100% PostgreSQL storage
    """
    from merge_client import get_merge_client
    from supabase_drive_helpers import store_drive_files_batch, update_merge_integration_sync
    
    try:
        logger.info(f"🔄 Starting Google Drive sync for account {account_id}")
        
        merge_client = get_merge_client()
        
        # Fetch files from Merge API
        files_response = await merge_client.get_files(account_token)
        files = files_response.get("results", [])
        
        logger.info(f"📥 Fetched {len(files)} files from Google Drive")
        
        if not files:
            logger.info("ℹ️ No files found")
            return
        
        # Transform files for Supabase storage
        supabase_files = []
        for file in files:
            file_data = {
                "account_id": account_id,
                "user_id": user_id,
                "merge_file_id": file.get("id"),
                "merge_account_token": account_token,
                "file_name": file.get("name", "Untitled"),
                "file_type": file.get("file_type"),
                "mime_type": file.get("mime_type"),
                "file_size": file.get("size"),
                "parent_folder_id": file.get("folder"),
                "web_view_link": file.get("file_url"),
                "owner_email": file.get("owner", {}).get("email") if isinstance(file.get("owner"), dict) else None,
                "created_at": file.get("created_at") or datetime.now(timezone.utc).isoformat(),
                "modified_at": file.get("modified_at") or datetime.now(timezone.utc).isoformat(),
                "synced_at": datetime.now(timezone.utc).isoformat()
            }
            supabase_files.append(file_data)
        
        # Batch insert to Supabase
        stored_count = await store_drive_files_batch(supabase_admin, supabase_files)
        
        logger.info(f"✅ Stored {stored_count} Google Drive files in Supabase")
        
        # Update integration sync status
        await update_merge_integration_sync(
            supabase_admin,
            account_token,
            {
                "last_sync_at": datetime.now(timezone.utc).isoformat(),
                "sync_stats": {"files_synced": stored_count, "last_sync_success": True}
            }
        )
        
    except Exception as e:
        logger.error(f"❌ Google Drive sync failed: {e}")


@api_router.get("/integrations/google-drive/files")
async def get_google_drive_files(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Get Google Drive files from Supabase
    100% PostgreSQL - Zero MongoDB
    """
    from supabase_drive_helpers import get_user_drive_files
    
    user_id = current_user["id"]
    
    files = await get_user_drive_files(supabase_admin, user_id, limit=limit)
    
    return {
        "files": files,
        "count": len(files)
    }


@api_router.post("/integrations/google-drive/sync")
async def trigger_google_drive_sync(current_user: dict = Depends(get_current_user)):
    """
    Manually trigger Google Drive sync
    Fetches latest files from Merge.dev and stores in Supabase
    """
    from workspace_helpers import get_user_account
    from supabase_drive_helpers import get_user_merge_integrations
    
    user_id = current_user["id"]
    
    # Get workspace
    account = await get_user_account(supabase_admin, user_id)
    if not account:
        raise HTTPException(status_code=400, detail="Workspace not initialized")
    
    account_id = account["id"]
    
    # Get Google Drive integration
    integrations = await get_user_merge_integrations(
        supabase_admin,
        user_id,
        integration_category="file_storage"
    )
    
    drive_integration = next(
        (i for i in integrations if i.get("integration_slug") == "google_drive"),
        None
    )
    
    if not drive_integration:
        raise HTTPException(status_code=404, detail="Google Drive not connected")
    
    account_token = drive_integration["account_token"]
    
    # Trigger background sync
    import asyncio
    asyncio.create_task(sync_google_drive_files(user_id, account_id, account_token))
    
    return {
        "success": True,
        "message": "Sync started. Files will be available shortly."
    }


@api_router.get("/integrations/google-drive/status")
async def google_drive_status(current_user: dict = Depends(get_current_user)):
    """
    Check if Google Drive is connected
    """
    from supabase_drive_helpers import get_user_merge_integrations, count_user_drive_files
    
    user_id = current_user["id"]
    
    # Check for integration
    integrations = await get_user_merge_integrations(
        supabase_admin,
        user_id,
        integration_category="file_storage"
    )
    
    drive_integration = next(
        (i for i in integrations if i.get("integration_slug") == "google_drive"),
        None
    )
    
    if not drive_integration:
        return {
            "connected": False,
            "files_count": 0
        }
    
    # Count files
    files_count = await count_user_drive_files(supabase_admin, user_id)
    
    return {
        "connected": True,
        "integration_name": drive_integration.get("integration_name", "Google Drive"),
        "connected_at": drive_integration.get("connected_at"),
        "last_sync_at": drive_integration.get("last_sync_at"),
        "files_count": files_count,
        "status": drive_integration.get("status", "active")
    }

