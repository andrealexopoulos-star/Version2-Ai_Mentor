"""
Pydantic models — extracted from server.py.
All request/response schemas live here. Route modules import from core.models.
"""
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any


# ==================== AUTH MODELS ====================

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
    role: str = "user"
    subscription_tier: Optional[str] = None
    is_master_account: Optional[bool] = False
    is_admin: Optional[bool] = False
    features: Optional[Dict[str, bool]] = None
    created_at: str = ""

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ChatMessage(BaseModel):
    role: str
    content: str

class AccountCreate(BaseModel):
    account_name: str


# ==================== INVITE MODELS ====================

class InviteCreateRequest(BaseModel):
    email: EmailStr
    name: str
    role: str = "member"

class InviteAcceptRequest(BaseModel):
    token: str
    temp_password: str
    new_password: str

class InviteResponse(BaseModel):
    invite_link: str
    temp_password: str
    expires_at: str


# ==================== OAUTH MODELS ====================

class GoogleExchangeRequest(BaseModel):
    session_id: str

class MergeLinkTokenRequest(BaseModel):
    categories: Optional[List[str]] = None


# ==================== CHAT MODELS ====================

class ChatRequest(BaseModel):
    message: str
    context_type: Optional[str] = "general"
    session_id: Optional[str] = None
    trigger_source: Optional[str] = None
    focus_area: Optional[str] = None
    confidence_level: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str


# ==================== PROFILE MODELS ====================

class BusinessProfileAutofillRequest(BaseModel):
    business_name: Optional[str] = None
    abn: Optional[str] = None

class Citation(BaseModel):
    source_type: str
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
    confidence: Optional[str] = None
    citations: List[Citation] = []

class BusinessProfileAutofillResponse(BaseModel):
    patch: Dict[str, Any]
    missing_fields: List[str]
    sources: Dict[str, Any]


# ==================== ANALYSIS MODELS ====================

class AnalysisCreate(BaseModel):
    title: str
    analysis_type: str
    business_context: str
    content: Optional[str] = None

class AnalysisResponse(BaseModel):
    id: str
    analysis: str
    insights: Optional[List[Dict[str, Any]]] = None
    created_at: str


# ==================== DOCUMENT MODELS ====================

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


# ==================== ADMIN MODELS ====================

class AdminUserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


# ==================== VERSIONED BUSINESS PROFILE ====================

class ConfidenceLevel(BaseModel):
    business_identity: str = "low"
    market: str = "low"
    offer: str = "low"
    team: str = "low"
    strategy: str = "low"

class ProfileScore(BaseModel):
    value: int = 0
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
    change_type: str
    affected_domains: List[str]
    initiated_by: str
    initiated_at: str
    reason_summary: str

class VersionedBusinessProfile(BaseModel):
    profile_id: str
    business_id: str
    user_id: str
    version: str
    status: str = "active"
    created_at: str
    created_by: str
    last_reviewed_at: Optional[str] = None
    confidence_summary: ConfidenceLevel
    score: ProfileScore
    domains: ProfileDomains
    change_log: List[ChangeLogEntry] = []


# ==================== LEGACY BUSINESS PROFILE (will be deprecated) ====================

class BusinessProfileUpdate(BaseModel):
    business_name: Optional[str] = None
    industry: Optional[str] = None
    business_type: Optional[str] = None
    business_stage: Optional[str] = None
    year_founded: Optional[int] = None
    website: Optional[str] = None
    location: Optional[str] = None
    abn: Optional[str] = None
    acn: Optional[str] = None
    retention_known: Optional[bool] = None
    retention_rate_range: Optional[str] = None
    retention_rag: Optional[str] = None
    employee_count: Optional[str] = None
    annual_revenue: Optional[str] = None
    monthly_expenses: Optional[str] = None
    profit_margin: Optional[str] = None
    funding_stage: Optional[str] = None
    target_market: Optional[str] = None
    target_country: Optional[str] = None
    ideal_customer_profile: Optional[str] = None
    customer_segments: Optional[List[str]] = None
    geographic_focus: Optional[str] = None
    customer_acquisition_channels: Optional[List[str]] = None
    average_customer_value: Optional[str] = None
    customer_retention_rate: Optional[str] = None
    main_products_services: Optional[str] = None
    pricing_model: Optional[str] = None
    unique_value_proposition: Optional[str] = None
    competitive_advantages: Optional[str] = None
    business_model: Optional[str] = None
    sales_cycle_length: Optional[str] = None
    key_processes: Optional[str] = None
    bottlenecks: Optional[str] = None
    founder_background: Optional[str] = None
    key_team_members: Optional[str] = None
    team_strengths: Optional[str] = None
    team_gaps: Optional[str] = None
    company_culture: Optional[str] = None
    mission_statement: Optional[str] = None
    vision_statement: Optional[str] = None
    core_values: Optional[List[str]] = None
    short_term_goals: Optional[str] = None
    long_term_goals: Optional[str] = None
    main_challenges: Optional[str] = None
    business_goals: Optional[str] = None
    growth_strategy: Optional[str] = None
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
    key_metrics: Optional[List[str]] = None
    tools_used: Optional[List[str]] = None
    tech_stack: Optional[str] = None
    automation_level: Optional[str] = None
    communication_style: Optional[str] = None
    decision_making_style: Optional[str] = None
    risk_tolerance: Optional[str] = None
    preferred_advice_format: Optional[str] = None
    crm_system: Optional[str] = None
    accounting_system: Optional[str] = None
    project_management_tool: Optional[str] = None
    communication_tools: Optional[List[str]] = None


# ==================== DATA CENTER MODELS ====================

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
