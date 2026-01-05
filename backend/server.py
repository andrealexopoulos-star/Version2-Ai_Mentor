from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
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
    website_url: Optional[str] = None
    data_file_ids: Optional[List[str]] = None

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
    user_id: str
    title: str
    analysis_type: str
    business_context: str
    ai_analysis: str
    recommendations: List[str]
    action_items: List[str]
    created_at: str
    updated_at: str

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

# ==================== BUSINESS PROFILE MODELS ====================

class BusinessProfileUpdate(BaseModel):
    # Basic Info
    business_name: Optional[str] = None
    industry: Optional[str] = None
    business_type: Optional[str] = None  # LLC, Corporation, Sole Prop, etc.
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
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
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
    return current_user

# ==================== AI HELPER ====================

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
Use the above business data to:
1. Reference specific details about their business when relevant
2. Tailor recommendations to their exact situation, size, and industry
3. Consider their stated challenges and goals
4. Reference their documents and data when applicable
5. Provide advice that accounts for their tools and systems
"""

    base_prompt = f"""You are a Strategic Business Advisor from "The Strategy Squad" - an elite AI advisor that becomes a subject matter expert on each client's business. You have deep knowledge of this specific business from their uploaded documents, profile, and data.
{user_context}
{knowledge_context}

Your expertise includes:
- Deep analysis of business models, operations, and strategies
- Actionable recommendations with clear reasoning
- Structured action plans, SOPs, and checklists
- Market insights and competitive analysis
- Financial literacy guidance
- Leadership and team optimization advice

Always:
1. Reference specific details you know about their business
2. Provide advice tailored to their exact situation and industry
3. Consider their stated challenges and goals in every recommendation
4. Explain the reasoning behind recommendations
5. Be specific - use their business name, industry terms, and context
6. Format responses clearly with headers and bullet points
7. When you have relevant data from their documents, reference it"""

    context_prompts = {
        "business_analysis": base_prompt + "\n\nFocus on analyzing the business model, identifying strengths, weaknesses, opportunities, and threats. Provide specific optimization strategies for their industry.",
        "sop_generator": base_prompt + "\n\nFocus on creating detailed Standard Operating Procedures, checklists, and operational systems. Be thorough, practical, and industry-appropriate.",
        "market_analysis": base_prompt + "\n\nFocus on market trends, competitive analysis, and positioning strategies. Provide data-driven insights relevant to their sector.",
        "financial": base_prompt + "\n\nFocus on financial literacy, budgeting, cash flow management, and revenue optimization strategies suitable for their business size.",
        "general": base_prompt
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
    role = "admin" if user_count == 0 else "user"
    
    user_id = str(uuid.uuid4())
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
        "is_active": True,
        "created_at": now,
        "updated_at": now
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user_data.email, role)
    
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
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account deactivated")
    
    token = create_token(user["id"], user["email"], user["role"])
    
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
        role = "admin" if user_count == 0 else "user"

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

    token = create_token(user["id"], user["email"], user["role"])

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

# ==================== CHAT ROUTES ====================

@api_router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    session_id = request.session_id or f"{current_user['id']}_{uuid.uuid4()}"
    
    # Pass user data for personalization
    user_data = {
        "name": current_user.get("name"),
        "business_name": current_user.get("business_name"),
        "industry": current_user.get("industry")
    }
    
    response = await get_ai_response(
        request.message,
        request.context_type or "general",
        session_id,
        user_id=current_user["id"],
        user_data=user_data,
        use_advanced=False
    )
    
    # Store chat history
    chat_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
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
    # Generate AI analysis using advanced model with full business context
    user_data = {
        "name": current_user.get("name"),
        "business_name": current_user.get("business_name"),
        "industry": current_user.get("industry")
    }
    
    prompt = f"""Analyze this business context and provide comprehensive insights:

Title: {analysis.title}
Analysis Type: {analysis.analysis_type}
Business Context: {analysis.business_context}

Using your knowledge of this specific business (from their profile and uploaded documents), please provide:
1. A detailed analysis (be thorough and reference specific business details you know)
2. Key recommendations (numbered list with reasoning, tailored to their situation)
3. Specific action items (numbered list with priority levels)
4. Potential risks and how to mitigate them
5. Quick wins that can be implemented immediately

Format your response with clear sections using markdown headers."""

    session_id = f"analysis_{uuid.uuid4()}"
    ai_response = await get_ai_response(prompt, analysis.analysis_type, session_id, user_id=current_user["id"], user_data=user_data, use_advanced=True)
    
    # Parse recommendations and action items from response
    recommendations = []
    action_items = []
    current_section = None
    
    for line in ai_response.split('\n'):
        line = line.strip()
        if 'recommendation' in line.lower():
            current_section = 'recommendations'
        elif 'action' in line.lower() and 'item' in line.lower():
            current_section = 'actions'
        elif line.startswith(('-', '•', '*')) or (line and line[0].isdigit() and '.' in line[:3]):
            item = line.lstrip('-•*0123456789. ')
            if current_section == 'recommendations' and item:
                recommendations.append(item)
            elif current_section == 'actions' and item:
                action_items.append(item)
    
    if not recommendations:
        recommendations = ["Review the analysis above for detailed recommendations"]
    if not action_items:
        action_items = ["Implement the recommendations based on priority"]
    
    now = datetime.now(timezone.utc).isoformat()
    analysis_id = str(uuid.uuid4())
    
    doc = {
        "id": analysis_id,
        "user_id": current_user["id"],
        "title": analysis.title,
        "analysis_type": analysis.analysis_type,
        "business_context": analysis.business_context,
        "ai_analysis": ai_response,
        "recommendations": recommendations[:10],
        "action_items": action_items[:10],
        "created_at": now,
        "updated_at": now
    }
    
    await db.analyses.insert_one(doc)
    
    return AnalysisResponse(**{k: v for k, v in doc.items() if k != "_id"})

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
    topic = request.get("topic", "")
    business_context = request.get("business_context", "")
    
    user_data = {
        "name": current_user.get("name"),
        "business_name": current_user.get("business_name"),
        "industry": current_user.get("industry")
    }
    
    prompt = f"""Create a comprehensive Standard Operating Procedure (SOP) for:

Topic: {topic}
Business Context: {business_context}
Business: {user_data.get('business_name', 'N/A')}
Industry: {user_data.get('industry', 'General')}

Please provide a complete SOP including:
1. Purpose and Scope
2. Responsibilities (who does what)
3. Step-by-step Procedures (numbered with detailed sub-steps)
4. Quality Checks and Verification Points
5. Documentation Requirements
6. Troubleshooting Common Issues
7. Review and Update Schedule
8. Key Performance Indicators (KPIs) to track

Make this specific to the industry and practical for immediate implementation.
Format using markdown with clear headers and numbered steps."""

    session_id = f"sop_{uuid.uuid4()}"
    response = await get_ai_response(prompt, "sop_generator", session_id, user_id=current_user["id"], user_data=user_data, use_advanced=True)
    
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
    """AGI-Ready comprehensive business diagnosis"""
    symptoms = request.get("symptoms", "")
    areas = request.get("areas", [])
    urgency = request.get("urgency", "medium")
    
    user_data = {
        "name": current_user.get("name"),
        "business_name": current_user.get("business_name"),
        "industry": current_user.get("industry")
    }
    
    areas_text = ", ".join(areas) if areas else "all areas"
    
    prompt = f"""As an expert business diagnostician, analyze these business issues:

Business: {user_data.get('business_name', 'N/A')}
Industry: {user_data.get('industry', 'General')}
Problem Areas: {areas_text}
Urgency Level: {urgency}

Symptoms/Issues Reported:
{symptoms}

Please provide a comprehensive diagnosis:

## 1. Root Cause Analysis
- Identify the underlying causes (not just symptoms)
- Explain the chain of causation
- Rate confidence level for each diagnosis

## 2. Impact Assessment
- Immediate impacts on operations
- Financial implications
- Customer/market impact
- Team/culture effects

## 3. Prioritized Solutions
For each solution provide:
- Implementation difficulty (Easy/Medium/Hard)
- Time to implement
- Expected ROI
- Resources needed

## 4. Emergency Actions (if urgency is high)
- What to do in the next 24-48 hours
- Quick stabilization measures

## 5. Long-term Prevention
- Systemic changes to prevent recurrence
- Monitoring systems to implement
- Early warning indicators

## 6. Success Metrics
- How to measure if the problem is truly solved
- Leading vs lagging indicators

Be specific, actionable, and consider SMB resource constraints."""

    session_id = f"diagnosis_{uuid.uuid4()}"
    response = await get_ai_response(prompt, "business_analysis", session_id, user_id=current_user["id"], user_data=user_data, use_advanced=True)
    
    # Save diagnosis
    diagnosis_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "symptoms": symptoms,
        "areas": areas,
        "urgency": urgency,
        "diagnosis": response,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.diagnoses.insert_one(diagnosis_doc)
    
    return {
        "diagnosis": response,
        "diagnosis_id": diagnosis_doc["id"],
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
    """Get user's business profile"""
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


@api_router.post("/business-profile/autofill", response_model=BusinessProfileAutofillResponse)
async def business_profile_autofill(req: BusinessProfileAutofillRequest, current_user: dict = Depends(get_current_user)):
    """Autofill business profile from uploaded docs + website URL + existing profile."""

    # Collect sources
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
- Use target_country="Australia" if not specified.
- Prefer business_name from user input if provided.
"""

    session_id = f"autofill_{uuid.uuid4()}"
    ai = await get_ai_response(prompt, "general", session_id, user_id=current_user["id"], user_data={
        "name": current_user.get("name"),
        "business_name": current_user.get("business_name"),
        "industry": current_user.get("industry"),
    }, use_advanced=True)

    patch: Dict[str, Any] = {}
    try:
        import json
        patch = json.loads(ai)
    except Exception:
        # If the model returns non-JSON, fall back to minimal patch
        patch = {}

    # Always respect explicit inputs
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
        }
    }

@api_router.put("/business-profile")
async def update_business_profile(profile: BusinessProfileUpdate, current_user: dict = Depends(get_current_user)):
    """Update user's business profile"""
    now = datetime.now(timezone.utc).isoformat()
    
    profile_data = {k: v for k, v in profile.model_dump().items() if v is not None}

    # Compute retention score (AU baselines) if inputs are present
    computed_rag = compute_retention_rag(
        profile_data.get("industry"),
        profile_data.get("retention_known"),
        profile_data.get("retention_rate_range"),
    )
    if computed_rag:
        profile_data["retention_rag"] = computed_rag

    profile_data["user_id"] = current_user["id"]
    profile_data["updated_at"] = now
    
    # Also update user's basic info
    user_updates = {}
    if profile.business_name:
        user_updates["business_name"] = profile.business_name
    if profile.industry:
        user_updates["industry"] = profile.industry
    
    if user_updates:
        await db.users.update_one({"id": current_user["id"]}, {"$set": user_updates})
    
    await db.business_profiles.update_one(
        {"user_id": current_user["id"]},
        {"$set": profile_data},
        upsert=True
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

CRITICAL OUTPUT RULES:
- Output ONLY the 5 recommendations. No intro, no closing text, no markdown headings.
- Must start with "1." and end with "5." section.
- Exactly 5 items.

FORMAT (repeat 5x):
1. <Short title>
Reason: <One line referencing the business context above>
- <Action>
- <Action>
- <Action>
"""

    session_id = f"oac_{uuid.uuid4()}"
    ai_text = await get_ai_response(prompt, "general", session_id, user_id=current_user["id"], user_data={
        "name": (user or {}).get("name"),
        "business_name": biz_name,
        "industry": industry,
    }, use_advanced=True)

    items = parse_recommendations(ai_text, max_items=5)

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
