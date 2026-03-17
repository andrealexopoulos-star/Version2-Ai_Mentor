"""
Generation Routes — Chat, analyses, documents, SOP, checklist, action-plan, diagnosis.
Extracted from server.py.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
import json

from routes.deps import get_current_user, get_sb, OPENAI_KEY, AI_MODEL, logger
from prompt_registry import get_prompt
from supabase_intelligence_helpers import (
    create_chat_message_supabase, get_chat_history_supabase,
    create_analysis_supabase, get_user_analyses_supabase,
    get_business_profile_supabase,
)
from supabase_document_helpers import (
    create_document_supabase, get_user_documents_supabase,
    get_document_by_id_supabase, update_document_supabase,
    delete_document_supabase,
)
from supabase_remaining_helpers import (
    create_sop_supabase, create_diagnosis_supabase,
    get_diagnoses_supabase,
)

router = APIRouter()


# ─── Models (mirrored from server.py) ───

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

# Import these lazily to avoid circular imports
def _get_ai_response():
    from core.ai_core import get_ai_response
    return get_ai_response

def _build_advisor_context():
    from routes.profile import build_advisor_context
    return build_advisor_context

def _format_advisor_brain_prompt():
    from routes.profile import format_advisor_brain_prompt
    return format_advisor_brain_prompt


def _parse_advisor_brain_response(text: str):
    from routes.profile import parse_advisor_brain_response
    return parse_advisor_brain_response(text)


# ==================== CHAT ROUTES ====================

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """Enhanced AI chat with deep personalization and proactive questioning"""
    session_id = request.session_id or f"{current_user['id']}_{uuid.uuid4()}"
    user_id = current_user["id"]
    
    # Build comprehensive Advisor Brain context
    from routes.profile import build_advisor_context
    context = await build_advisor_context(user_id)
    profile = context.get("profile", {})
    
    # Get communication style
    communication_style = profile.get("advice_style", "conversational")
    
    # Enhanced prompt with business context
    from routes.profile import format_advisor_brain_prompt
    enhanced_message = await format_advisor_brain_prompt(
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
    
    from core.ai_core import get_ai_response
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
    await create_chat_message_supabase(get_sb(), chat_doc)
    
    return ChatResponse(response=response, session_id=session_id)

@router.get("/chat/history")
async def get_chat_history(session_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"user_id": current_user["id"]}
    if session_id:
        query["session_id"] = session_id
    
    # Get chat history from Supabase
    history = await get_chat_history_supabase(get_sb(), current_user["id"], session_id=session_id, limit=50)
    return history

@router.get("/chat/sessions")
async def get_chat_sessions(current_user: dict = Depends(get_current_user)):
    result = get_sb().table("chat_history").select(
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

@router.post("/analyses", response_model=AnalysisResponse)
async def create_analysis(analysis: AnalysisCreate, current_user: dict = Depends(get_current_user)):
    """Generate business analysis with Advisor Brain (evidence-based with citations)"""
    user_id = current_user["id"]
    
    # Build Advisor Brain context
    from routes.profile import build_advisor_context
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

    from routes.profile import format_advisor_brain_prompt
    prompt = await format_advisor_brain_prompt(task_prompt, context, "analysis", communication_style)
    
    session_id = f"analysis_{uuid.uuid4()}"
    ai_response = await _get_ai_response()(
        prompt,
        "business_analysis",
        session_id,
        user_id=user_id,
        user_data={"name": user.get("name"), "business_name": profile.get("business_name")},
        use_advanced=True
    )
    
    # Parse response with Advisor Brain pattern
    insights = _parse_advisor_brain_response(ai_response)
    
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
    await create_analysis_supabase(get_sb(), analysis_doc)
    
    return AnalysisResponse(
        id=analysis_id,
        analysis=ai_response,
        insights=insights,
        created_at=analysis_doc["created_at"]
    )

@router.get("/analyses", response_model=List[AnalysisResponse])
async def get_analyses(current_user: dict = Depends(get_current_user)):
    analyses = await get_user_analyses_supabase(get_sb(), current_user["id"], limit=100)
    return analyses

@router.get("/analyses/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(analysis_id: str, current_user: dict = Depends(get_current_user)):
    result = get_sb().table("analyses").select("*").eq("id", analysis_id).eq("user_id", current_user["id"]).single().execute()
    analysis = result.data if result.data else None
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis

@router.delete("/analyses/{analysis_id}")
async def delete_analysis(analysis_id: str, current_user: dict = Depends(get_current_user)):
    result = get_sb().table("analyses").delete().eq("id", analysis_id).eq("user_id", current_user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {"message": "Analysis deleted"}

# ==================== DOCUMENT ROUTES ====================

@router.post("/documents", response_model=DocumentResponse)
async def create_document(document: DocumentCreate, current_user: dict = Depends(get_current_user)):
    """Create a new document - SUPABASE VERSION"""
    doc_data = {
        "user_id": current_user["id"],
        "title": document.title,
        "document_type": document.document_type,
        "content": document.content,
        "tags": document.tags
    }
    
    created_doc = await create_document_supabase(get_sb(), doc_data)
    
    if not created_doc:
        raise HTTPException(status_code=500, detail="Failed to create document")
    
    return DocumentResponse(**created_doc)

@router.get("/documents", response_model=List[DocumentResponse])
async def get_documents(document_type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get user's documents - SUPABASE VERSION"""
    docs = await get_user_documents_supabase(
        get_sb(),
        current_user["id"],
        document_type=document_type,
        limit=100
    )
    return docs

@router.get("/documents/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific document - SUPABASE VERSION"""
    doc = await get_document_by_id_supabase(get_sb(), doc_id)
    
    if not doc or doc.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return doc

@router.put("/documents/{doc_id}", response_model=DocumentResponse)
async def update_document(doc_id: str, document: DocumentCreate, current_user: dict = Depends(get_current_user)):
    """Update a document - SUPABASE VERSION"""
    # Verify ownership
    existing_doc = await get_document_by_id_supabase(get_sb(), doc_id)
    
    if not existing_doc or existing_doc.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=404, detail="Document not found")
    
    updates = {
        "title": document.title,
        "document_type": document.document_type,
        "content": document.content,
        "tags": document.tags
    }
    
    updated_doc = await update_document_supabase(get_sb(), doc_id, updates)
    
    if not updated_doc:
        raise HTTPException(status_code=500, detail="Failed to update document")
    
    return updated_doc

@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a document - SUPABASE VERSION"""
    success = await delete_document_supabase(get_sb(), doc_id, current_user["id"])
    
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document deleted"}

# ==================== SOP GENERATOR ====================

@router.post("/generate/sop")
async def generate_sop(request: dict, current_user: dict = Depends(get_current_user)):
    """Generate SOP with Advisor Brain personalization and document context"""
    topic = request.get("topic", "")
    business_context = request.get("business_context", "")
    uploaded_file_id = request.get("uploaded_file_id")
    
    user_id = current_user["id"]
    from routes.profile import build_advisor_context
    context = await build_advisor_context(user_id)
    profile = context.get("profile", {})
    
    # Get uploaded document content if provided
    document_context = ""
    if uploaded_file_id:
        uploaded_doc_result = get_sb().table("data_files").select(
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

    from routes.profile import format_advisor_brain_prompt
    prompt = await format_advisor_brain_prompt(task_prompt, context, "sop", communication_style)
    
    session_id = f"sop_{uuid.uuid4()}"
    from core.ai_core import get_ai_response
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
    await create_sop_supabase(get_sb(), sop_doc)
    
    return {"sop_content": response, "topic": topic}

@router.post("/generate/checklist")
async def generate_checklist(request: dict, current_user: dict = Depends(get_current_user)):
    topic = request.get("topic", "")
    req_context = request.get("context", "")
    user_id = current_user["id"]
    
    from routes.profile import build_advisor_context
    context = await build_advisor_context(user_id)
    profile = context.get("profile", {})
    biz_name = profile.get("business_name") or "N/A"
    industry = profile.get("industry") or "General"
    
    task = f"""Create a comprehensive checklist for:

Topic: {topic}
Context: {req_context}
Business: {biz_name}
Industry: {industry}

Provide: title, categorized items, priority indicators, time estimates, dependencies, success criteria.
Make it industry-specific and actionable."""

    from routes.profile import format_advisor_brain_prompt
    prompt = await format_advisor_brain_prompt(task, context, "checklist")
    session_id = f"checklist_{uuid.uuid4()}"
    from core.ai_core import get_ai_response
    response = await get_ai_response(prompt, "sop_generator", session_id, user_id=user_id, use_advanced=True)
    
    return {"checklist_content": response, "topic": topic}

@router.post("/generate/action-plan")
async def generate_action_plan(request: dict, current_user: dict = Depends(get_current_user)):
    goal = request.get("goal", "")
    timeline = request.get("timeline", "3 months")
    resources = request.get("resources", "")
    user_id = current_user["id"]
    
    from routes.profile import build_advisor_context
    context = await build_advisor_context(user_id)
    profile = context.get("profile", {})
    biz_name = profile.get("business_name") or "N/A"
    
    task = f"""Create a strategic action plan for {biz_name}:

Goal: {goal}
Timeline: {timeline}
Available Resources: {resources}

Provide: executive summary, SMART goals, milestones, activities, resource allocation,
risk assessment, success metrics, review checkpoints, contingency plans, quick wins.
Make it specific to their industry and realistic."""

    from routes.profile import format_advisor_brain_prompt
    prompt = await format_advisor_brain_prompt(task, context, "action_plan")
    session_id = f"action_plan_{uuid.uuid4()}"
    from core.ai_core import get_ai_response
    response = await get_ai_response(prompt, "business_analysis", session_id, user_id=user_id, use_advanced=True)
    
    return {"action_plan": response, "goal": goal, "timeline": timeline}


# ==================== BUSINESS DIAGNOSIS (AGI-Ready) ====================

@router.post("/diagnose")
async def diagnose_business(request: dict, current_user: dict = Depends(get_current_user)):
    """Business diagnosis with Advisor Brain pattern"""
    symptoms = request.get("symptoms", "")
    areas = request.get("areas", [])
    urgency = request.get("urgency", "medium")
    
    user_id = current_user["id"]
    from routes.profile import build_advisor_context
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
    
    from routes.profile import format_advisor_brain_prompt
    prompt = await format_advisor_brain_prompt(task_prompt, context, "diagnosis", communication_style)
    
    session_id = f"diagnosis_{uuid.uuid4()}"
    response_text = await _get_ai_response()(
        prompt,
        "business_analysis",
        session_id,
        user_id=user_id,
        user_data={"name": current_user.get("name"), "business_name": profile.get("business_name")},
        use_advanced=True
    )
    
    # Parse with Advisor Brain pattern
    insights = _parse_advisor_brain_response(response_text)
    
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
    await create_diagnosis_supabase(get_sb(), diagnosis_doc)
    
    return {
        "diagnosis": response_text,
        "insights": insights,
        "areas": areas,
        "urgency": urgency
    }


@router.get("/diagnoses")
async def get_diagnoses(current_user: dict = Depends(get_current_user)):
    """Get user's business diagnoses history - SUPABASE VERSION"""
    diagnoses = await get_diagnoses_supabase(get_sb(), current_user["id"])
    return diagnoses
