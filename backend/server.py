from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'default-secret-key')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# OpenAI Configuration
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

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
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: str

class ChatRequest(BaseModel):
    message: str
    context_type: Optional[str] = "general"
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str

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

def get_system_prompt(context_type: str) -> str:
    base_prompt = """You are a Strategic Business Advisor and Optimization Expert specializing in helping small to medium businesses succeed. Your mission is to transform business owners into the most capable, strategic, and empowered versions of themselves.

You provide:
- Deep analysis of business models, operations, and strategies
- Actionable recommendations with clear reasoning
- Structured action plans, SOPs, and checklists
- Market insights and competitive analysis
- Financial literacy guidance
- Leadership and team optimization advice

Always:
1. Ask clarifying questions when needed
2. Provide specific, actionable advice
3. Explain the reasoning behind recommendations
4. Consider the SMB context (limited resources, need for efficiency)
5. Format responses clearly with headers and bullet points"""

    context_prompts = {
        "business_analysis": base_prompt + "\n\nFocus on analyzing the business model, identifying strengths, weaknesses, opportunities, and threats. Provide specific optimization strategies.",
        "sop_generator": base_prompt + "\n\nFocus on creating detailed Standard Operating Procedures, checklists, and operational systems. Be thorough and practical.",
        "market_analysis": base_prompt + "\n\nFocus on market trends, competitive analysis, and positioning strategies. Provide data-driven insights.",
        "financial": base_prompt + "\n\nFocus on financial literacy, budgeting, cash flow management, and revenue optimization strategies.",
        "general": base_prompt
    }
    return context_prompts.get(context_type, base_prompt)

async def get_ai_response(message: str, context_type: str, session_id: str) -> str:
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=get_system_prompt(context_type)
        )
        chat.with_model("openai", "gpt-5.2")
        
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
        created_at=current_user["created_at"]
    )

# ==================== CHAT ROUTES ====================

@api_router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    session_id = request.session_id or f"{current_user['id']}_{uuid.uuid4()}"
    
    response = await get_ai_response(
        request.message,
        request.context_type or "general",
        session_id
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
    # Generate AI analysis
    prompt = f"""Analyze this business context and provide comprehensive insights:

Title: {analysis.title}
Analysis Type: {analysis.analysis_type}
Business Context: {analysis.business_context}

Please provide:
1. A detailed analysis
2. Key recommendations (numbered list)
3. Specific action items (numbered list)

Format your response with clear sections using markdown headers."""

    session_id = f"analysis_{uuid.uuid4()}"
    ai_response = await get_ai_response(prompt, analysis.analysis_type, session_id)
    
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
    
    prompt = f"""Create a comprehensive Standard Operating Procedure (SOP) for:

Topic: {topic}
Business Context: {business_context}

Please provide a complete SOP including:
1. Purpose and Scope
2. Responsibilities
3. Step-by-step Procedures (numbered)
4. Quality Checks
5. Documentation Requirements
6. Review and Update Schedule

Format using markdown with clear headers and numbered steps."""

    session_id = f"sop_{uuid.uuid4()}"
    response = await get_ai_response(prompt, "sop_generator", session_id)
    
    return {"sop_content": response, "topic": topic}

@api_router.post("/generate/checklist")
async def generate_checklist(request: dict, current_user: dict = Depends(get_current_user)):
    topic = request.get("topic", "")
    context = request.get("context", "")
    
    prompt = f"""Create a comprehensive checklist for:

Topic: {topic}
Context: {context}

Please provide:
1. A clear title
2. Categorized checklist items with checkboxes (use [ ] format)
3. Priority indicators (High/Medium/Low)
4. Estimated time for each item if applicable

Format as a practical, actionable checklist using markdown."""

    session_id = f"checklist_{uuid.uuid4()}"
    response = await get_ai_response(prompt, "sop_generator", session_id)
    
    return {"checklist_content": response, "topic": topic}

@api_router.post("/generate/action-plan")
async def generate_action_plan(request: dict, current_user: dict = Depends(get_current_user)):
    goal = request.get("goal", "")
    timeline = request.get("timeline", "3 months")
    resources = request.get("resources", "")
    
    prompt = f"""Create a strategic action plan for:

Goal: {goal}
Timeline: {timeline}
Available Resources: {resources}

Please provide:
1. Executive Summary
2. Milestones with dates
3. Key activities and tasks
4. Resource allocation
5. Risk mitigation strategies
6. Success metrics and KPIs
7. Review checkpoints

Format with clear structure and actionable steps."""

    session_id = f"action_plan_{uuid.uuid4()}"
    response = await get_ai_response(prompt, "business_analysis", session_id)
    
    return {"action_plan": response, "goal": goal, "timeline": timeline}

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
