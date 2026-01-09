from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from emergentintegrations.llm.chat import LlmChat, UserMessage
import httpx
from authlib.integrations.starlette_client import OAuth
from urllib.parse import quote

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

# Microsoft Outlook OAuth Configuration
AZURE_TENANT_ID = os.environ.get("AZURE_TENANT_ID")
AZURE_CLIENT_ID = os.environ.get("AZURE_CLIENT_ID")
AZURE_CLIENT_SECRET = os.environ.get("AZURE_CLIENT_SECRET")

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ['JWT_SECRET_KEY']
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# AI Configuration - AGI Ready
EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY')

# AGI-Ready Model Configuration  
AI_MODEL = "gpt-4o"  # Latest model for regular chat
AI_MODEL_ADVANCED = "gpt-4o"  # For complex analysis tasks

# File size limit (10MB)
MAX_FILE_SIZE = 10 * 1024 * 1024

app = FastAPI(title="Strategic Advisor API")

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
    role: str
    subscription_tier: Optional[str] = None
    created_at: str

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

class ChatRequest(BaseModel):
    message: str
    context_type: Optional[str] = "general"
    session_id: Optional[str] = None

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
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if user and payload.get("account_id") and not user.get("account_id"):
            await db.users.update_one({"id": user["id"]}, {"$set": {"account_id": payload.get("account_id")}})
            user["account_id"] = payload.get("account_id")
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

async def get_current_account(current_user: dict = Depends(get_current_user)):
    account_id = current_user.get("account_id")
    if not account_id:
        raise HTTPException(status_code=400, detail="Account not configured")
    account = await db.accounts.find_one({"id": account_id}, {"_id": 0})
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
    profile = await db.business_profiles.find_one({"user_id": user_id}, {"_id": 0})
    
    # Get recent data files (summaries)
    data_files = await db.data_files.find(
        {"user_id": user_id},
        {"_id": 0, "filename": 1, "category": 1, "description": 1, "extracted_text": 1}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    # Get user info
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    
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

def get_system_prompt(context_type: str, user_data: dict = None, business_knowledge: str = None) -> str:
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

    # MENTOR MODE for MyAdvisor/general context
    if context_type == "general" or context_type == "mentor":
        return f"""You are Strategy Squad — a senior, human business advisor.

You are a real person having a private conversation.
You are NOT an AI assistant.
You are NOT a chatbot.
You are NOT a report generator.

ABSOLUTE BANS (NEVER USE THESE):
- BANNED: "Why:", "Reason:", "Actions:", "Steps:", "Citations:", "Confidence:", "Questions:"
- BANNED: [profile], [data_file], [web] or ANY citation format
- BANNED: Bullet points, numbered lists, headings (unless user explicitly requests)
- BANNED: Summaries of user data (unless they ask)
- BANNED: Justifying your advice (unless they challenge it)
- BANNED: Restating what they already told you

If you use ANY of these formats, you have completely failed.

HOW YOU SPEAK
Like a human advisor sitting with them over coffee.

Use:
- Plain sentences
- Short paragraphs (2-3 lines max)
- Conversational tone
- Natural pauses

Example of GOOD response:
"Let's talk growth. What matters more to you right now - getting more clients or making more from existing ones?"

Example of BAD response:
❌ "Reason: Growth is important for scaling
Why: Your business needs sustainable revenue
Actions:
- Focus on client acquisition
- Improve retention
Citations:
- [profile] Revenue: $100K
Confidence: high"

YOU ARE A HUMAN. SPEAK LIKE ONE.

FIRST INTERACTION RULE
When user selects a focus area:
- Acknowledge it naturally (1 sentence)
- Ask ONE question
- Stop immediately

Do NOT give advice.
Do NOT explain.
Do NOT list.

Just acknowledge and ask.

CONVERSATION FLOW
Every response:
1. Acknowledge what they said (brief, human)
2. Ask ONE question
3. Stop

After 3-4 exchanges, when you understand enough:
- Give direct advice in plain language
- No lists unless they ask
- Just tell them what to do, like a human would

ADAPTATION (CRITICAL)
Match how THEY communicate:

Short answers → You be brief
Long answers → You go deeper
Stressed tone → You soften
Direct tone → You be practical
Hesitation → You simplify

Learn silently:
- Their decision style
- Their stress level
- What they avoid
- How they think

Adjust your style to match theirs.

TRUST BUILDING
You build trust by:
- Listening before advising
- Asking before telling
- Being calm and confident
- Not overwhelming them
- Admitting when you need more info
- Referencing their business by name naturally

IDENTITY SHIFTS
Be:
- Mentor when they need support
- Strategist when they need direction
- Counsellor when they're stressed
- Challenger when they avoid tough topics

CONTEXT:
{user_context}
{knowledge_context}

REMEMBER
- You are a human advisor
- Speak naturally
- ONE question at a time
- No citations, no structure, no formatting
- Build trust through conversation
- Match their communication style
"""

    # Original system prompt for other contexts
    base_prompt = f"""You are Strategy Squad — a senior human business mentor, advisor, and strategic counsellor.

You speak like a real person in a private advisory session.
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
        "mentor": base_prompt
    }
    return context_prompts.get(context_type, base_prompt)

async def get_ai_response(message: str, context_type: str, session_id: str, user_id: str = None, user_data: dict = None, use_advanced: bool = False) -> str:
    """AGI-Ready AI response function with full business context"""
    try:
        # Get comprehensive business context
        business_knowledge = None
        if user_id:
            business_context = await get_business_context(user_id)
            business_knowledge = build_business_knowledge_context(business_context)
        
        system_prompt = get_system_prompt(context_type, user_data, business_knowledge)
        
        # Use emergentintegrations for reliable AI access
        chat = LlmChat(
            api_key=EMERGENT_KEY,
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

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_count = await db.users.count_documents({})
    reg = await db.settings.find_one({"key": "registration_open"}, {"_id": 0})
    if reg and reg.get("value") is False and user_count > 0:
        raise HTTPException(status_code=403, detail="Registration is closed. Ask your owner/admin for an invite.")


    role = "owner" if user_count == 0 else "member"
    
    user_id = str(uuid.uuid4())
    # Workspace/account creation for the first user
    account_id = None
    if user_count == 0:
        account_id = str(uuid.uuid4())
        account_doc = {
            "id": account_id,
            "owner_user_id": user_id,
            "account_name": user_data.business_name or user_data.name,
            "primary_contact_name": user_data.name,
            "email": user_data.email,
            "timezone": "Australia/Sydney",
            "currency": "AUD",
            "currency_locked": False,
            "trial_started_at": now,
            "trial_ends_at": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
            "subscription_tier": "trial",
            "created_at": now,
            "updated_at": now,
        }
        await db.accounts.insert_one(account_doc)

        # Disable self-serve registration after the owner exists
        await db.settings.update_one({"key": "registration_open"}, {"$set": {"key": "registration_open", "value": False}}, upsert=True)

    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "business_name": user_data.business_name,
        "industry": user_data.industry,
        "subscription_tier": "free",
        "subscription_started_at": now,
        "role": role,
        "account_id": account_id,
        "is_active": True,
        "created_at": now,
        "updated_at": now
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user_data.email, role, account_id=account_id)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            business_name=user_data.business_name,
            industry=user_data.industry,
            role=role,
            subscription_tier="free",
            created_at=now
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    
    # Check if user exists
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if user has a password set (Google OAuth users have password=None)
    if user.get("password") is None:
        raise HTTPException(status_code=400, detail="This account uses Google sign-in. Please use 'Continue with Google'")
    
    # Verify password
    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account deactivated")
    
    token = create_token(user["id"], user["email"], user["role"], account_id=user.get("account_id"))
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            business_name=user.get("business_name"),
            industry=user.get("industry"),
            role=user["role"],
            subscription_tier=user.get("subscription_tier"),
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        business_name=current_user.get("business_name"),
        industry=current_user.get("industry"),
        role=current_user["role"],
        subscription_tier=current_user.get("subscription_tier"),
        created_at=current_user["created_at"]
    )

# ==================== GOOGLE OAUTH (CUSTOM) ====================

class GoogleAuthRequest(BaseModel):
    credential: str  # JWT credential from Google

@api_router.post("/auth/google", response_model=TokenResponse)
async def google_auth(request: GoogleAuthRequest):
    """Handle Google OAuth login/register"""
    try:
        # Verify the Google JWT token
        import google.auth.transport.requests
        from google.oauth2 import id_token
        
        # Verify token
        idinfo = id_token.verify_oauth2_token(
            request.credential,
            google.auth.transport.requests.Request(),
            GOOGLE_CLIENT_ID
        )
        
        # Extract user info
        email = idinfo.get('email')
        name = idinfo.get('name')
        google_id = idinfo.get('sub')
        
        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")
        
        # Check if user exists
        user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if user:
            # Existing user - login
            user_id = user["id"]
        else:
            # New user - register
            user_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()
            
            # Check if this is the first user (owner)
            user_count = await db.users.count_documents({})
            role = "owner" if user_count == 0 else "member"
            
            # Create account for first user
            account_id = None
            if user_count == 0:
                account_id = str(uuid.uuid4())
                account_doc = {
                    "id": account_id,
                    "owner_user_id": user_id,
                    "account_name": name,
                    "email": email,
                    "subscription_tier": "trial",
                    "trial_started_at": now,
                    "trial_ends_at": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
                    "created_at": now
                }
                await db.accounts.insert_one(account_doc)
            
            # Create user
            user_doc = {
                "id": user_id,
                "email": email,
                "name": name,
                "password": None,  # Google OAuth users have no password
                "google_id": google_id,
                "role": role,
                "account_id": account_id,
                "subscription_tier": "trial" if user_count == 0 else "free",
                "is_active": True,
                "created_at": now
            }
            await db.users.insert_one(user_doc)
            user = user_doc
        
        # Create JWT token
        token = create_token(user["id"], user["email"], user["role"], account_id=user.get("account_id"))
        
        return TokenResponse(
            access_token=token,
            user=UserResponse(
                id=user["id"],
                email=user["email"],
                name=user["name"],
                business_name=user.get("business_name"),
                industry=user.get("industry"),
                role=user["role"],
                subscription_tier=user.get("subscription_tier"),
                created_at=user["created_at"]
            )
        )
        
    except ValueError as e:
        # Invalid token
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(status_code=500, detail="Google authentication failed")

# ==================== GOOGLE OAUTH (CUSTOM) ====================

class GoogleAuthRequest(BaseModel):
    credential: str  # JWT credential from Google

@api_router.post("/auth/google", response_model=TokenResponse)
async def google_auth(request: GoogleAuthRequest):
    """Handle Google OAuth login/register"""
    try:
        # Decode and verify Google JWT token
        async with httpx.AsyncClient() as client:
            # Get Google's public keys
            keys_response = await client.get('https://www.googleapis.com/oauth2/v3/certs')
            
            # Verify the token using httpx to call Google's tokeninfo endpoint
            verify_response = await client.get(
                'https://oauth2.googleapis.com/tokeninfo',
                params={'id_token': request.credential}
            )
            
            if verify_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid Google token")
            
            idinfo = verify_response.json()
            
            # Verify audience (client ID)
            if idinfo.get('aud') != GOOGLE_CLIENT_ID:
                raise HTTPException(status_code=401, detail="Token audience mismatch")
            
            # Extract user info
            email = idinfo.get('email')
            name = idinfo.get('name')
            google_id = idinfo.get('sub')
            
            if not email:
                raise HTTPException(status_code=400, detail="Email not provided by Google")
        
        # Check if user exists
        user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if user:
            # Existing user - login
            user_id = user["id"]
            
            # Update google_id if not set
            if not user.get("google_id"):
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {"google_id": google_id}}
                )
        else:
            # New user - register
            user_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()
            
            # Check if this is the first user (owner)
            user_count = await db.users.count_documents({})
            role = "owner" if user_count == 0 else "member"
            
            # Create account for first user
            account_id = None
            if user_count == 0:
                account_id = str(uuid.uuid4())
                account_doc = {
                    "id": account_id,
                    "owner_user_id": user_id,
                    "account_name": name,
                    "email": email,
                    "subscription_tier": "trial",
                    "trial_started_at": now,
                    "trial_ends_at": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
                    "created_at": now
                }
                await db.accounts.insert_one(account_doc)
            
            # Create user
            user_doc = {
                "id": user_id,
                "email": email,
                "name": name,
                "password": None,  # Google OAuth users have no password
                "google_id": google_id,
                "role": role,
                "account_id": account_id,
                "subscription_tier": "trial" if user_count == 0 else "free",
                "is_active": True,
                "created_at": now
            }
            await db.users.insert_one(user_doc)
            user = user_doc
        
        # Create JWT token
        token = create_token(user["id"], user["email"], user["role"], account_id=user.get("account_id"))
        
        return TokenResponse(
            access_token=token,
            user=UserResponse(
                id=user["id"],
                email=user["email"],
                name=user["name"],
                business_name=user.get("business_name"),
                industry=user.get("industry"),
                role=user["role"],
                subscription_tier=user.get("subscription_tier"),
                created_at=user["created_at"]
            )
        )
        
    except ValueError as e:
        # Invalid token
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(status_code=500, detail="Google authentication failed")

# ==================== EMERGENT GOOGLE AUTH (MANAGED) ====================

async def fetch_emergent_session_data(session_id: str) -> Dict[str, Any]:
    url = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, headers={"X-Session-ID": session_id})
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google session")
        return resp.json()


@api_router.post("/auth/google/exchange", response_model=TokenResponse)
async def google_exchange(payload: GoogleExchangeRequest):
    now = datetime.now(timezone.utc).isoformat()

    data = await fetch_emergent_session_data(payload.session_id)
    email = (data.get("email") or "").strip().lower()
    name = (data.get("name") or "").strip() or "User"

    if not email:
        raise HTTPException(status_code=400, detail="Google session missing email")

    user = await db.users.find_one({"email": email}, {"_id": 0})

    if not user:
        user_count = await db.users.count_documents({})
        role = "owner" if user_count == 0 else "member"

        user_id = str(uuid.uuid4())
        user_doc = {
            "id": user_id,
            "email": email,
            "password": None,
            "name": name,
            "business_name": None,
            "industry": None,
            "subscription_tier": "free",
            "subscription_started_at": now,
            "role": role,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
            "auth_provider": "google",
            "picture": data.get("picture"),
        }
        await db.users.insert_one(user_doc)
        user = user_doc
    else:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "name": name,
                "picture": data.get("picture"),
                "updated_at": now,
                "auth_provider": user.get("auth_provider") or "google",
            }}
        )
        user["name"] = name

    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account deactivated")

    token = create_token(user["id"], user["email"], user["role"], account_id=user.get("account_id"))

    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            business_name=user.get("business_name"),
            industry=user.get("industry"),
            role=user["role"],
            subscription_tier=user.get("subscription_tier"),
            created_at=user["created_at"],
        ),
    )



# ==================== MICROSOFT OUTLOOK INTEGRATION ====================

@api_router.get("/auth/outlook/login")
async def outlook_login():
    """Initiate Microsoft OAuth flow for Outlook"""
    redirect_uri = f"{os.environ['BACKEND_URL']}/api/auth/outlook/callback"
    
    # URL encode parameters to prevent malformed URLs
    scope = "offline_access User.Read Mail.Read Mail.ReadBasic Calendars.Read Calendars.ReadBasic"
    encoded_redirect = quote(redirect_uri, safe='')
    encoded_scope = quote(scope, safe='')
    
    auth_url = (
        f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/oauth2/v2.0/authorize?"
        f"client_id={AZURE_CLIENT_ID}&"
        f"response_type=code&"
        f"redirect_uri={encoded_redirect}&"
        f"response_mode=query&"
        f"scope={encoded_scope}&"
        f"state=outlook_auth"
    )
    
    return {"auth_url": auth_url}


@api_router.get("/auth/outlook/callback")
async def outlook_callback(code: str, state: str = None):
    """Handle Microsoft OAuth callback and store tokens - NO AUTH REQUIRED"""
    if state and state != "outlook_auth":
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    
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
    
    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=payload)
        
        if response.status_code != 200:
            error_text = response.text
            # Redirect to frontend with error
            from fastapi.responses import RedirectResponse
            frontend_url = os.environ['FRONTEND_URL']
            return RedirectResponse(url=f"{frontend_url}/integrations?outlook_error=auth_failed")
        
        token_data = response.json()
    
    # Get user info from Microsoft Graph
    access_token = token_data.get("access_token")
    headers = {"Authorization": f"Bearer {access_token}"}
    
    async with httpx.AsyncClient() as client:
        user_response = await client.get(
            "https://graph.microsoft.com/v1.0/me",
            headers=headers
        )
        user_info = user_response.json()
    
    # Find user by email in our database
    user_email = user_info.get("mail") or user_info.get("userPrincipalName")
    our_user = await db.users.find_one({"email": user_email}, {"_id": 0})
    
    if not our_user:
        # User not found - redirect with error
        from fastapi.responses import RedirectResponse
        frontend_url = os.environ['FRONTEND_URL']
        return RedirectResponse(url=f"{frontend_url}/integrations?outlook_error=user_not_found")
    
    # Store tokens in user document
    await db.users.update_one(
        {"id": our_user["id"]},
        {"$set": {
            "outlook_access_token": token_data.get("access_token"),
            "outlook_refresh_token": token_data.get("refresh_token"),
            "outlook_token_expires_at": (datetime.now(timezone.utc) + timedelta(seconds=token_data.get("expires_in", 3600))).isoformat(),
            "outlook_connected_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Trigger comprehensive sync in background
    import asyncio
    job_id = str(uuid.uuid4())
    asyncio.create_task(start_comprehensive_sync_job(our_user["id"], job_id))
    
    # Redirect to frontend success page
    from fastapi.responses import RedirectResponse
    frontend_url = os.environ['FRONTEND_URL']
    return RedirectResponse(url=f"{frontend_url}/integrations?outlook_connected=true&job_id={job_id}")


async def start_comprehensive_sync_job(user_id: str, job_id: str):
    """Start comprehensive sync as background task"""
    job_doc = {
        "job_id": job_id,
        "user_id": user_id,
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "progress": {"folders_processed": 0, "emails_processed": 0, "insights_generated": 0}
    }
    await db.outlook_sync_jobs.insert_one(job_doc)
    
    await run_comprehensive_email_analysis(user_id, job_id)


@api_router.get("/outlook/emails/sync")
async def sync_outlook_emails(
    folder: str = "inbox",
    top: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Basic email sync - use /outlook/comprehensive-sync for full analysis"""
    user_id = current_user["id"]
    
    # Get user's Outlook token
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    if not user_doc.get("outlook_access_token"):
        raise HTTPException(status_code=400, detail="Outlook not connected. Please connect first.")
    
    # Check if token expired
    token_expires = user_doc.get("outlook_token_expires_at")
    if token_expires and datetime.fromisoformat(token_expires) < datetime.now(timezone.utc):
        # Refresh token
        await refresh_outlook_token(user_id, user_doc.get("outlook_refresh_token"))
        user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    access_token = user_doc.get("outlook_access_token")
    
    # Fetch emails from Microsoft Graph
    headers = {"Authorization": f"Bearer {access_token}"}
    graph_url = f"https://graph.microsoft.com/v1.0/me/mailFolders/{folder}/messages"
    params = {
        "$select": "subject,from,toRecipients,receivedDateTime,bodyPreview,body,isRead",
        "$top": top,
        "$orderby": "receivedDateTime desc"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(graph_url, headers=headers, params=params)
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Failed to fetch emails: {response.text}")
        
        emails_data = response.json()
    
    # Store emails for AI context
    synced_count = 0
    for email in emails_data.get("value", []):
        email_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "graph_message_id": email.get("id"),
            "subject": email.get("subject", ""),
            "from_address": email.get("from", {}).get("emailAddress", {}).get("address", ""),
            "from_name": email.get("from", {}).get("emailAddress", {}).get("name", ""),
            "received_date": email.get("receivedDateTime"),
            "body_preview": email.get("bodyPreview", ""),
            "body_content": email.get("body", {}).get("content", "")[:5000],
            "is_read": email.get("isRead", False),
            "folder": folder,
            "synced_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Upsert (avoid duplicates)
        await db.outlook_emails.update_one(
            {"user_id": user_id, "graph_message_id": email.get("id")},
            {"$set": email_doc},
            upsert=True
        )
        synced_count += 1
    
    return {
        "status": "synced",
        "emails_synced": synced_count,
        "message": f"Synced {synced_count} emails from {folder}"
    }


@api_router.post("/outlook/comprehensive-sync")
async def comprehensive_outlook_sync(current_user: dict = Depends(get_current_user)):
    """
    COMPREHENSIVE EMAIL ANALYSIS - 36 months across all folders
    
    This analyzes your entire Outlook account to build a complete business intelligence profile:
    - All folders (Inbox, Sent Items, Deleted Items, custom folders)
    - Last 36 months of email history
    - Extracts: clients, topics, patterns, sentiment, business evolution
    - Stores structured intelligence, not just raw emails
    
    Runs as background process. Returns immediately.
    """
    user_id = current_user["id"]
    
    # Check if already running
    existing_job = await db.outlook_sync_jobs.find_one(
        {"user_id": user_id, "status": "running"},
        {"_id": 0}
    )
    
    if existing_job:
        return {
            "status": "already_running",
            "job_id": existing_job["job_id"],
            "message": "Comprehensive sync already in progress"
        }
    
    # Create sync job
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
    await db.outlook_sync_jobs.insert_one(job_doc)
    
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
    """Background task: Comprehensive email analysis over 36 months"""
    try:
        # Get user tokens
        user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
        access_token = user_doc.get("outlook_access_token")
        
        if not access_token:
            await db.outlook_sync_jobs.update_one(
                {"job_id": job_id},
                {"$set": {"status": "failed", "error": "No access token"}}
            )
            return
        
        # Calculate 36 months ago
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=36*30)
        
        # Get all mail folders
        headers = {"Authorization": f"Bearer {access_token}"}
        folders_url = "https://graph.microsoft.com/v1.0/me/mailFolders"
        
        async with httpx.AsyncClient(timeout=30) as client:
            folders_response = await client.get(folders_url, headers=headers)
            folders_data = folders_response.json()
        
        all_folders = folders_data.get("value", [])
        
        # Focus on key folders
        target_folders = ["inbox", "sentitems", "deleteditems"]
        
        # Add custom folders
        for folder in all_folders:
            folder_name = folder.get("displayName", "").lower()
            if folder_name not in ["inbox", "sent items", "deleted items", "drafts", "junk email"]:
                target_folders.append(folder.get("id"))
        
        total_emails = 0
        emails_by_sender = {}
        emails_by_topic = {}
        client_communications = []
        
        # Process each folder
        for folder_id in target_folders[:10]:  # Limit to 10 folders max
            emails = await fetch_folder_emails_batch(
                access_token,
                folder_id,
                cutoff_date,
                max_emails=500  # 500 per folder
            )
            
            # Analyze emails
            for email in emails:
                total_emails += 1
                
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
                
                # Store email
                email_doc = {
                    "id": str(uuid.uuid4()),
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
                    "is_external": is_external,
                    "synced_at": datetime.now(timezone.utc).isoformat()
                }
                
                await db.outlook_emails.update_one(
                    {"user_id": user_id, "graph_message_id": email.get("id")},
                    {"$set": email_doc},
                    upsert=True
                )
            
            # Update progress
            await db.outlook_sync_jobs.update_one(
                {"job_id": job_id},
                {"$set": {
                    "progress.folders_processed": len([f for f in target_folders if f]),
                    "progress.emails_processed": total_emails
                }}
            )
        
        # Generate business intelligence insights
        insights = await generate_email_intelligence(
            user_id,
            emails_by_sender,
            client_communications,
            total_emails
        )
        
        # Mark job complete
        await db.outlook_sync_jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "progress": {
                    "folders_processed": len(target_folders),
                    "emails_processed": total_emails,
                    "insights_generated": len(insights)
                },
                "insights": insights
            }}
        )
        
    except Exception as e:
        logger.error(f"Comprehensive sync error: {e}")
        await db.outlook_sync_jobs.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "failed",
                "error": str(e),
                "failed_at": datetime.now(timezone.utc).isoformat()
            }}
        )


async def fetch_folder_emails_batch(access_token: str, folder_id: str, cutoff_date: datetime, max_emails: int = 500):
    """Fetch emails from a folder with date filtering"""
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Format date for Graph API filter
    cutoff_str = cutoff_date.strftime("%Y-%m-%dT%H:%M:%SZ")
    
    graph_url = f"https://graph.microsoft.com/v1.0/me/mailFolders/{folder_id}/messages"
    params = {
        "$select": "id,subject,from,toRecipients,receivedDateTime,bodyPreview,body,isRead",
        "$filter": f"receivedDateTime ge {cutoff_str}",
        "$top": min(max_emails, 999),
        "$orderby": "receivedDateTime desc"
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
    
    # Store intelligence summary
    await db.email_intelligence.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            **insights,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return [insights]


@api_router.get("/outlook/sync-status/{job_id}")
async def get_sync_status(job_id: str, current_user: dict = Depends(get_current_user)):
    """Check status of comprehensive email sync"""
    job = await db.outlook_sync_jobs.find_one(
        {"job_id": job_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not job:
        raise HTTPException(status_code=404, detail="Sync job not found")
    
    return job


@api_router.get("/outlook/intelligence")
async def get_email_intelligence(current_user: dict = Depends(get_current_user)):
    """Get business intelligence extracted from emails"""
    intelligence = await db.email_intelligence.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not intelligence:
        return {
            "message": "No email intelligence available. Run comprehensive sync first."
        }
    
    return intelligence


async def refresh_outlook_token(user_id: str, refresh_token: str):
    """Refresh Outlook access token"""
    token_url = f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/oauth2/v2.0/token"
    
    payload = {
        "client_id": AZURE_CLIENT_ID,
        "client_secret": AZURE_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
        "scope": "offline_access User.Read Mail.Read Mail.ReadBasic Calendars.Read Calendars.ReadBasic"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=payload)
        
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Failed to refresh Outlook token")
        
        token_data = response.json()
    
    # Update tokens
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "outlook_access_token": token_data.get("access_token"),
            "outlook_refresh_token": token_data.get("refresh_token"),
            "outlook_token_expires_at": (datetime.now(timezone.utc) + timedelta(seconds=token_data.get("expires_in", 3600))).isoformat()
        }}
    )


@api_router.get("/outlook/status")
async def outlook_connection_status(current_user: dict = Depends(get_current_user)):
    """Check if Outlook is connected"""
    user_doc = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    
    is_connected = bool(user_doc.get("outlook_access_token"))
    emails_count = await db.outlook_emails.count_documents({"user_id": current_user["id"]})
    
    return {
        "connected": is_connected,
        "connected_at": user_doc.get("outlook_connected_at"),
        "emails_synced": emails_count
    }


# ==================== CALENDAR INTEGRATION ====================

@api_router.get("/outlook/calendar/events")
async def get_calendar_events(
    days_ahead: int = 14,
    days_back: int = 7,
    current_user: dict = Depends(get_current_user)
):
    """Get calendar events for AI context"""
    user_doc = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    
    if not user_doc.get("outlook_access_token"):
        raise HTTPException(status_code=400, detail="Outlook not connected")
    
    access_token = user_doc.get("outlook_access_token")
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
        
        if response.status_code == 401:
            # Token expired - try refresh
            await refresh_outlook_token(current_user["id"], user_doc.get("outlook_refresh_token"))
            user_doc = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
            headers = {"Authorization": f"Bearer {user_doc.get('outlook_access_token')}"}
            response = await client.get(graph_url, headers=headers, params=params)
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Failed to fetch calendar: {response.text}")
        
        events_data = response.json()
    
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
    
    # Store for AI context
    await db.calendar_events.delete_many({"user_id": current_user["id"]})
    if events:
        for e in events:
            e["user_id"] = current_user["id"]
            e["synced_at"] = datetime.now(timezone.utc).isoformat()
        await db.calendar_events.insert_many(events)
    
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
        
        await db.calendar_intelligence.update_one(
            {"user_id": current_user["id"]},
            {"$set": calendar_intel},
            upsert=True
        )
    
    return {
        "status": "synced",
        "events_synced": len(events),
        "message": f"Calendar synced: {len(events)} events"
    }


# ==================== SMART EMAIL INTELLIGENCE ====================

@api_router.post("/email/analyze-priority")
async def analyze_email_priority(current_user: dict = Depends(get_current_user)):
    """
    AI-powered email prioritization based on business goals.
    Analyzes recent emails and provides strategic priority rankings.
    """
    user_id = current_user["id"]
    
    # Get business profile for context
    profile = await db.business_profiles.find_one({"user_id": user_id}, {"_id": 0})
    business_goals = profile.get("short_term_goals", "") if profile else ""
    business_challenges = profile.get("main_challenges", "") if profile else ""
    
    # Get recent unread emails (or all recent)
    recent_emails = await db.outlook_emails.find(
        {"user_id": user_id},
        {"_id": 0, "subject": 1, "from_address": 1, "from_name": 1, "body_preview": 1, "received_date": 1, "is_read": 1, "id": 1}
    ).sort("received_date", -1).limit(50).to_list(50)
    
    if not recent_emails:
        return {"message": "No emails to analyze. Please sync your Outlook first."}
    
    # Get email intelligence for relationship context
    email_intel = await db.email_intelligence.find_one({"user_id": user_id}, {"_id": 0})
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
            api_key=EMERGENT_KEY,
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
        
        # Store analysis
        await db.email_priority_analysis.update_one(
            {"user_id": user_id},
            {"$set": {
                "user_id": user_id,
                "analysis": priority_analysis,
                "emails_analyzed": len(recent_emails),
                "analyzed_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        return priority_analysis
        
    except Exception as e:
        logger.error(f"Email priority analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@api_router.post("/email/suggest-reply/{email_id}")
async def suggest_email_reply(email_id: str, current_user: dict = Depends(get_current_user)):
    """
    Generate strategic reply suggestions for a specific email.
    """
    user_id = current_user["id"]
    
    # Get the email
    email = await db.outlook_emails.find_one(
        {"user_id": user_id, "id": email_id},
        {"_id": 0}
    )
    
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    # Get business context
    profile = await db.business_profiles.find_one({"user_id": user_id}, {"_id": 0})
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    # Get communication history with this sender
    sender = email.get("from_address", "")
    history = await db.outlook_emails.find(
        {"user_id": user_id, "from_address": sender},
        {"_id": 0, "subject": 1, "body_preview": 1}
    ).sort("received_date", -1).limit(5).to_list(5)
    
    history_context = "\n".join([f"- {h.get('subject')}: {h.get('body_preview', '')[:100]}" for h in history])
    
    reply_prompt = f"""You are helping a business owner craft a strategic reply to an email.

BUSINESS OWNER: {user.get('name', 'Business Owner')}
BUSINESS: {profile.get('business_name', user.get('business_name', 'Their business')) if profile else user.get('business_name', 'Their business')}
COMMUNICATION STYLE: {profile.get('communication_style', 'Professional and friendly') if profile else 'Professional and friendly'}

EMAIL TO REPLY TO:
From: {email.get('from_name', email.get('from_address', 'Unknown'))}
Subject: {email.get('subject', 'No subject')}
Content: {email.get('body_content', email.get('body_preview', ''))[:2000]}

RECENT HISTORY WITH THIS CONTACT:
{history_context if history_context else 'No previous history'}

Generate 3 reply options with different tones/approaches:

1. DIRECT & EFFICIENT - Get to the point quickly
2. RELATIONSHIP-BUILDING - Warm, builds rapport
3. STRATEGIC - Positions for future opportunity

For each, provide:
- A suggested subject line (if reply changes topic)
- The full reply text (ready to send)
- Strategic note (why this approach)

Format as JSON:
{{
    "replies": [
        {{
            "style": "direct",
            "subject": "Re: ...",
            "body": "Full reply text...",
            "strategic_note": "Why this works..."
        }}
    ],
    "context_insight": "What this email tells us about the relationship/opportunity"
}}"""

    try:
        chat = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=f"reply_suggest_{user_id}_{email_id}",
            system_message="You are an expert business communication strategist. Generate professional, effective email replies."
        )
        chat.with_model("openai", AI_MODEL)
        
        response = await chat.send_message(UserMessage(text=reply_prompt))
        
        import json
        try:
            suggestions = json.loads(response.strip())
        except:
            import re
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                suggestions = json.loads(json_match.group())
            else:
                suggestions = {"error": "Could not parse response", "raw_response": response[:1000]}
        
        return {
            "email_id": email_id,
            "original_subject": email.get("subject"),
            "from": email.get("from_name") or email.get("from_address"),
            **suggestions
        }
        
    except Exception as e:
        logger.error(f"Reply suggestion error: {e}")
        raise HTTPException(status_code=500, detail=f"Suggestion failed: {str(e)}")


@api_router.get("/email/priority-inbox")
async def get_priority_inbox(current_user: dict = Depends(get_current_user)):
    """Get the latest email priority analysis"""
    analysis = await db.email_priority_analysis.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not analysis:
        return {"message": "No priority analysis available. Run /email/analyze-priority first."}
    
    return analysis


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

    # Create invited user with temp password
    existing = await db.users.find_one({"email": req.email.lower().strip()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

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
    await db.invites.insert_one(invite)

    invite_link = f"/invite/accept?token={token}"
    return InviteResponse(invite_link=invite_link, temp_password=temp_password, expires_at=invite["expires_at"])


@api_router.post("/account/users/accept", response_model=TokenResponse)
async def accept_invite(req: InviteAcceptRequest):
    invite = await db.invites.find_one({"token": req.token}, {"_id": 0})
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
    await db.users.insert_one(user_doc)

    # Consume invite
    await db.invites.delete_one({"id": invite["id"]})

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

@api_router.get("/onboarding/status", response_model=OnboardingStatusResponse)
async def get_onboarding_status(current_user: dict = Depends(get_current_user)):
    """Check if user has completed onboarding"""
    user_id = current_user["id"]
    
    onboarding = await db.onboarding.find_one({"user_id": user_id}, {"_id": 0})
    
    if not onboarding:
        return OnboardingStatusResponse(
            completed=False,
            current_step=0,
            business_stage=None,
            data={}
        )
    
    return OnboardingStatusResponse(
        completed=onboarding.get("completed", False),
        current_step=onboarding.get("current_step", 0),
        business_stage=onboarding.get("business_stage"),
        data=onboarding.get("data", {})
    )

@api_router.post("/onboarding/save")
async def save_onboarding_progress(
    request: OnboardingSave,
    current_user: dict = Depends(get_current_user)
):
    """Save onboarding progress"""
    user_id = current_user["id"]
    
    await db.onboarding.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "user_id": user_id,
                "current_step": request.current_step,
                "business_stage": request.business_stage,
                "data": request.data,
                "completed": request.completed,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"status": "saved", "current_step": request.current_step}

@api_router.post("/onboarding/complete")
async def complete_onboarding(current_user: dict = Depends(get_current_user)):
    """Mark onboarding as completed"""
    user_id = current_user["id"]
    
    await db.onboarding.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "completed": True,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"status": "completed"}

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
    
    response = await get_ai_response(
        enhanced_message,
        request.context_type or "general",
        session_id,
        user_id=user_id,
        user_data={"name": current_user.get("name"), "business_name": profile.get("business_name")},
        use_advanced=False
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
    await db.chat_history.insert_one(chat_doc)
    
    return ChatResponse(response=response, session_id=session_id)

@api_router.get("/chat/history")
async def get_chat_history(session_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"user_id": current_user["id"]}
    if session_id:
        query["session_id"] = session_id
    
    history = await db.chat_history.find(query, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return history

@api_router.get("/chat/sessions")
async def get_chat_sessions(current_user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": current_user["id"]}},
        {"$group": {
            "_id": "$session_id",
            "last_message": {"$last": "$message"},
            "context_type": {"$last": "$context_type"},
            "created_at": {"$min": "$created_at"},
            "updated_at": {"$max": "$created_at"},
            "message_count": {"$sum": 1}
        }},
        {"$sort": {"updated_at": -1}},
        {"$limit": 20}
    ]
    sessions = await db.chat_history.aggregate(pipeline).to_list(20)
    return [{"session_id": s["_id"], **{k: v for k, v in s.items() if k != "_id"}} for s in sessions]

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
    await db.analyses.insert_one(analysis_doc)
    
    return AnalysisResponse(
        id=analysis_id,
        analysis=ai_response,
        insights=insights,
        created_at=analysis_doc["created_at"]
    )

@api_router.get("/analyses", response_model=List[AnalysisResponse])
async def get_analyses(current_user: dict = Depends(get_current_user)):
    analyses = await db.analyses.find(
        {"user_id": current_user["id"]}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return analyses

@api_router.get("/analyses/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(analysis_id: str, current_user: dict = Depends(get_current_user)):
    analysis = await db.analyses.find_one(
        {"id": analysis_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis

@api_router.delete("/analyses/{analysis_id}")
async def delete_analysis(analysis_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.analyses.delete_one({"id": analysis_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {"message": "Analysis deleted"}

# ==================== DOCUMENT ROUTES ====================

@api_router.post("/documents", response_model=DocumentResponse)
async def create_document(document: DocumentCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    doc_id = str(uuid.uuid4())
    
    doc = {
        "id": doc_id,
        "user_id": current_user["id"],
        "title": document.title,
        "document_type": document.document_type,
        "content": document.content,
        "tags": document.tags,
        "created_at": now,
        "updated_at": now
    }
    
    await db.documents.insert_one(doc)
    return DocumentResponse(**{k: v for k, v in doc.items() if k != "_id"})

@api_router.get("/documents", response_model=List[DocumentResponse])
async def get_documents(document_type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"user_id": current_user["id"]}
    if document_type:
        query["document_type"] = document_type
    
    docs = await db.documents.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return docs

@api_router.get("/documents/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one(
        {"id": doc_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@api_router.put("/documents/{doc_id}", response_model=DocumentResponse)
async def update_document(doc_id: str, document: DocumentCreate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db.documents.update_one(
        {"id": doc_id, "user_id": current_user["id"]},
        {"$set": {
            "title": document.title,
            "document_type": document.document_type,
            "content": document.content,
            "tags": document.tags,
            "updated_at": now
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    doc = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    return doc

@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.documents.delete_one({"id": doc_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
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
        uploaded_doc = await db.data_files.find_one(
            {"user_id": user_id, "id": uploaded_file_id},
            {"_id": 0, "filename": 1, "extracted_text": 1}
        )
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
    await db.sops.insert_one(sop_doc)
    
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
    await db.diagnoses.insert_one(diagnosis_doc)
    
    return {
        "diagnosis": response_text,
        "insights": insights,
        "areas": areas,
        "urgency": urgency
    }


@api_router.get("/diagnoses")
async def get_diagnoses(current_user: dict = Depends(get_current_user)):
    """Get user's business diagnoses history"""
    diagnoses = await db.diagnoses.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    return diagnoses

# ==================== BUSINESS PROFILE ROUTES ====================

@api_router.get("/business-profile")
async def get_business_profile(current_user: dict = Depends(get_current_user)):
    """Get user's business profile - returns active versioned profile or legacy"""
    # Try versioned profile first
    versioned_profile = await get_active_profile(current_user["id"])
    
    if versioned_profile:
        # Flatten domains for backward compatibility
        flattened = {
            "user_id": versioned_profile["user_id"],
            "profile_id": versioned_profile["profile_id"],
            "version": versioned_profile["version"],
            **versioned_profile["domains"]["business_identity"],
            **versioned_profile["domains"]["market"],
            **versioned_profile["domains"]["offer"],
            **versioned_profile["domains"]["team"],
            **versioned_profile["domains"]["strategy"]
        }
        return flattened
    
    # Fallback to legacy profile
    profile = await db.business_profiles.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    if not profile:
        # Return default empty profile
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
    profiles = await db.business_profiles_versioned.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return profiles


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
        files = await db.data_files.find(
            {"user_id": current_user["id"], "id": {"$in": req.data_file_ids}},
            {"_id": 0, "id": 1, "filename": 1, "extracted_text": 1, "category": 1}
        ).to_list(20)
        for f in files:
            used_files.append({"id": f.get("id"), "filename": f.get("filename"), "category": f.get("category")})
            if f.get("extracted_text"):
                files_text += f"\n\n--- FILE: {f.get('filename')} ---\n{f.get('extracted_text')[:6000]}"

    website_text = ""
    if req.website_url:
        website_text = await fetch_website_text(req.website_url)
        website_text = website_text[:8000]

    existing_profile = await db.business_profiles.find_one({"user_id": current_user["id"]}, {"_id": 0})

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

    recent_chats = await db.chat_history.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "message": 1, "response": 1, "created_at": 1}
    ).sort("created_at", -1).limit(6).to_list(6)

    recent_docs = await db.documents.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "title": 1, "content": 1, "document_type": 1, "created_at": 1}
    ).sort("created_at", -1).limit(6).to_list(6)

    recent_files = await db.data_files.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "filename": 1, "extracted_text": 1, "category": 1}
    ).sort("created_at", -1).limit(6).to_list(6)

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
    if profile.business_name:
        user_updates["business_name"] = profile.business_name
    if profile.industry:
        user_updates["industry"] = profile.industry
    
    if user_updates:
        await db.users.update_one({"id": user_id}, {"$set": user_updates})
    
    # Update legacy profile (for backward compatibility)
    await db.business_profiles.update_one(
        {"user_id": user_id},
        {"$set": profile_data},
        upsert=True
    )
    
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
    
    await db.data_files.insert_one(file_doc)
    
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
    query = {"user_id": current_user["id"]}
    if category:
        query["category"] = category
    
    files = await db.data_files.find(
        query,
        {"_id": 0, "file_content": 0}  # Exclude file content for listing
    ).sort("created_at", -1).to_list(100)
    
    return files

@api_router.get("/data-center/files/{file_id}")
async def get_data_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific file details"""
    file = await db.data_files.find_one(
        {"id": file_id, "user_id": current_user["id"]},
        {"_id": 0, "file_content": 0}
    )
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return file

@api_router.get("/data-center/files/{file_id}/download")
async def download_data_file(file_id: str, current_user: dict = Depends(get_current_user)):
    """Download a file"""
    file = await db.data_files.find_one(
        {"id": file_id, "user_id": current_user["id"]}
    )
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
    result = await db.data_files.delete_one(
        {"id": file_id, "user_id": current_user["id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="File not found")
    return {"message": "File deleted successfully"}

@api_router.get("/data-center/categories")
async def get_data_categories(current_user: dict = Depends(get_current_user)):
    """Get file categories with counts"""
    pipeline = [
        {"$match": {"user_id": current_user["id"]}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    categories = await db.data_files.aggregate(pipeline).to_list(20)
    return [{"category": c["_id"], "count": c["count"]} for c in categories]

@api_router.get("/data-center/stats")
async def get_data_center_stats(current_user: dict = Depends(get_current_user)):
    """Get data center statistics"""
    total_files = await db.data_files.count_documents({"user_id": current_user["id"]})
    
    # Total size
    pipeline = [
        {"$match": {"user_id": current_user["id"]}},
        {"$group": {"_id": None, "total_size": {"$sum": "$file_size"}}}
    ]
    size_result = await db.data_files.aggregate(pipeline).to_list(1)
    total_size = size_result[0]["total_size"] if size_result else 0
    
    # Categories
    categories = await get_data_categories(current_user)
    
    # Has business profile
    profile = await db.business_profiles.find_one({"user_id": current_user["id"]})
    
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
        await db.web_sources.update_one(
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
    This is the 'truth serum' - all evidence the AI needs to provide personalized advice.
    """
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    profile = await db.business_profiles.find_one({"user_id": user_id}, {"_id": 0})
    onboarding = await db.onboarding.find_one({"user_id": user_id}, {"_id": 0})
    
    # Recent activity for context
    recent_chats = await db.chat_history.find(
        {"user_id": user_id},
        {"_id": 0, "message": 1, "response": 1, "created_at": 1}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    recent_docs = await db.data_files.find(
        {"user_id": user_id},
        {"_id": 0, "filename": 1, "category": 1, "description": 1, "extracted_text": 1}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    web_sources = await db.web_sources.find(
        {"user_id": user_id},
        {"_id": 0, "title": 1, "url": 1, "snippet": 1}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    sops = await db.sops.find(
        {"user_id": user_id},
        {"_id": 0, "title": 1, "category": 1, "created_at": 1}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    # Outlook emails (if connected)
    outlook_emails = await db.outlook_emails.find(
        {"user_id": user_id},
        {"_id": 0, "subject": 1, "from_name": 1, "from_address": 1, "received_date": 1, "body_preview": 1}
    ).sort("received_date", -1).limit(10).to_list(10)
    
    # Email intelligence summary
    email_intel = await db.email_intelligence.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    # Calendar intelligence
    calendar_intel = await db.calendar_intelligence.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    # Calendar events (upcoming)
    calendar_events = await db.calendar_events.find(
        {"user_id": user_id},
        {"_id": 0, "subject": 1, "start": 1, "end": 1, "attendees": 1, "location": 1}
    ).sort("start", 1).limit(10).to_list(10)
    
    # Email priority analysis
    email_priority = await db.email_priority_analysis.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
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
        "email_priority": email_priority or {}
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
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "subscription_tier": tier,
            "subscription_started_at": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@api_router.get("/oac/recommendations")
async def get_oac_recommendations(current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    mk = month_key(now)

    # Load user + profile
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    profile = await db.business_profiles.find_one({"user_id": current_user["id"]}, {"_id": 0})

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

    usage = await db.oac_usage.find_one({"user_id": current_user["id"], "month": mk}, {"_id": 0})
    used = int((usage or {}).get("used", 0))

    if used >= limit:
        return {
            "locked": True,
            "usage": {"used": used, "limit": limit, "tier": tier, "month": mk}
        }

    # cache per day
    day_key = now.strftime("%Y-%m-%d")
    cached = await db.oac_recommendations.find_one({"user_id": current_user["id"], "date": day_key}, {"_id": 0})
    if cached:
        return {
            "locked": False,
            "meta": {"date": day_key, "cached": True},
            "items": cached.get("items", []),
            "usage": {"used": used, "limit": limit, "tier": tier, "month": mk}
        }

    # Build context snippets
    recent_chats = await db.chat_history.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "message": 1, "response": 1, "created_at": 1}
    ).sort("created_at", -1).limit(8).to_list(8)

    recent_docs = await db.documents.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "title": 1, "document_type": 1, "created_at": 1}
    ).sort("created_at", -1).limit(8).to_list(8)

    recent_files = await db.data_files.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "filename": 1, "category": 1, "description": 1}
    ).sort("created_at", -1).limit(8).to_list(8)

    # Prompt: strict, non-generic, actionable
    biz_name = (user or {}).get("business_name") or (profile or {}).get("business_name") or "this business"
    industry = (profile or {}).get("industry") or (user or {}).get("industry")

    # Build a compact evidence list for citations
    evidence_web = await db.web_sources.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "title": 1, "url": 1, "snippet": 1, "created_at": 1}
    ).sort("created_at", -1).limit(6).to_list(6)

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
    ai_text = await get_ai_response(prompt, "general", session_id, user_id=current_user["id"], user_data={
        "name": (user or {}).get("name"),
        "business_name": biz_name,
        "industry": industry,
    }, use_advanced=True)

    items = parse_oac_items_with_why(ai_text, max_items=5)

    # persist cache + increment usage by 1 (daily batch counts as 1)
    rec_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "date": day_key,
        "items": items,
        "created_at": now.isoformat()
    }
    await db.oac_recommendations.update_one(
        {"user_id": current_user["id"], "date": day_key},
        {"$set": rec_doc},
        upsert=True
    )

    await db.oac_usage.update_one(
        {"user_id": current_user["id"], "month": mk},
        {"$set": {"user_id": current_user["id"], "month": mk}, "$inc": {"used": 1}},
        upsert=True
    )

    used_after = used + 1

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
    current_profile = await db.business_profiles_versioned.find_one(
        {"user_id": user_id, "status": "active"},
        {"_id": 0}
    )
    
    # Generate new version number
    current_version = current_profile.get("version") if current_profile else None
    new_version = generate_version_number(current_version, change_type)
    
    # Archive current profile if exists
    if current_profile:
        await db.business_profiles_versioned.update_one(
            {"profile_id": current_profile["profile_id"]},
            {"$set": {"status": "archived"}}
        )
    
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
    onboarding = await db.onboarding.find_one({"user_id": user_id}, {"_id": 0})
    
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
    await db.business_profiles_versioned.insert_one(new_profile)
    
    return profile_id


async def get_active_profile(user_id: str) -> Optional[dict]:
    """Get the active (current) business profile version"""
    profile = await db.business_profiles_versioned.find_one(
        {"user_id": user_id, "status": "active"},
        {"_id": 0}
    )
    return profile


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
    if user_id and db is not None:
        # Documents uploaded (5 points)
        doc_count = await db.data_files.count_documents({"user_id": user_id})
        score += min(5, doc_count * 1)  # 1 point per doc, max 5
        
        # AI advisor conversations (5 points)
        chat_count = await db.chat_history.count_documents({"user_id": user_id})
        score += min(5, chat_count * 0.5)  # 0.5 points per chat, max 5
        
        # SOPs created (5 points)
        sop_count = await db.sops.count_documents({"user_id": user_id}) if await db.sops.count_documents({}) else 0
        score += min(5, sop_count * 2)  # 2 points per SOP, max 5
        
        # Analyses run (5 points)
        analysis_count = await db.analyses.count_documents({"user_id": user_id})
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
    """Get profile scores from versioned profile with confidence levels"""
    user_id = current_user["id"]
    
    # Try versioned profile first
    versioned_profile = await get_active_profile(user_id)
    
    if versioned_profile:
        # Use pre-calculated score from versioned profile
        score_data = versioned_profile.get("score", {})
        confidence = versioned_profile.get("confidence_summary", {})
        
        # Calculate overall completeness from domains
        domains = versioned_profile.get("domains", {})
        domain_completeness = [
            domains.get("business_identity", {}).get("completeness_percentage", 0),
            domains.get("market", {}).get("completeness_percentage", 0),
            domains.get("offer", {}).get("completeness_percentage", 0),
            domains.get("team", {}).get("completeness_percentage", 0),
            domains.get("strategy", {}).get("completeness_percentage", 0)
        ]
        overall_completeness = int(sum(domain_completeness) / len(domain_completeness)) if domain_completeness else 0
        
        return {
            "completeness": overall_completeness,
            "strength": score_data.get("value", 0),
            "business_score": score_data.get("value", 0),
            "score_explanation": score_data.get("explanation_summary", ""),
            "confidence_summary": confidence,
            "version": versioned_profile.get("version"),
            "profile_id": versioned_profile.get("profile_id"),
            "has_documents": await db.data_files.count_documents({"user_id": user_id}) > 0,
            "document_count": await db.data_files.count_documents({"user_id": user_id}),
            "onboarding_completed": (await db.onboarding.find_one({"user_id": user_id}, {"_id": 0}) or {}).get("completed", False)
        }
    
    # Fallback to legacy profile calculation
    profile = await db.business_profiles.find_one({"user_id": user_id}, {"_id": 0})
    onboarding = await db.onboarding.find_one({"user_id": user_id}, {"_id": 0})
    files_count = await db.data_files.count_documents({"user_id": user_id})
    
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
    
    # Calculate scores
    completeness = calculate_profile_completeness(profile) if profile else 0
    strength = calculate_profile_strength(profile, onboarding) if profile else 0
    
    # Add bonus for uploaded documents
    if files_count > 0:
        strength = min(100, strength + 15)
    
    return {
        "completeness": completeness,
        "strength": strength,
        "has_documents": files_count > 0,
        "document_count": files_count,
        "onboarding_completed": onboarding.get("completed", False) if onboarding else False
    }


# ==================== ADMIN ROUTES ====================

@api_router.get("/admin/users")
async def admin_get_users(admin: dict = Depends(get_admin_user)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return users

@api_router.get("/admin/stats")
async def admin_get_stats(admin: dict = Depends(get_admin_user)):
    user_count = await db.users.count_documents({})
    analysis_count = await db.analyses.count_documents({})
    document_count = await db.documents.count_documents({})
    chat_count = await db.chat_history.count_documents({})
    
    # Recent activity
    recent_users = await db.users.find({}, {"_id": 0, "password": 0}).sort("created_at", -1).limit(5).to_list(5)
    recent_analyses = await db.analyses.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    
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
    
    result = await db.users.update_one({"id": user_id}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return user

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(get_admin_user)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Clean up user data
    await db.analyses.delete_many({"user_id": user_id})
    await db.documents.delete_many({"user_id": user_id})
    await db.chat_history.delete_many({"user_id": user_id})
    
    return {"message": "User and all associated data deleted"}

# ==================== DASHBOARD STATS ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    
    analysis_count = await db.analyses.count_documents({"user_id": user_id})
    document_count = await db.documents.count_documents({"user_id": user_id})
    chat_sessions = await db.chat_history.distinct("session_id", {"user_id": user_id})
    
    recent_analyses = await db.analyses.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    recent_documents = await db.documents.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    return {
        "total_analyses": analysis_count,
        "total_documents": document_count,
        "total_chat_sessions": len(chat_sessions),
        "recent_analyses": recent_analyses,
        "recent_documents": recent_documents
    }

# ==================== ROOT ====================

@api_router.get("/")
async def root():
    return {"message": "Strategic Advisor API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
