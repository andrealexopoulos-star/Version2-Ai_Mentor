"""
MySoundBoard Routes — Thinking Partner
Extracted from server.py. Prompts loaded from Supabase system_prompts table.
Instrumented with Intelligence Spine LLM logging.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import uuid
import logging

from emergentintegrations.llm.chat import LlmChat, UserMessage
from routes.deps import get_current_user, get_sb, OPENAI_KEY, AI_MODEL, logger
from prompt_registry import get_prompt
from auth_supabase import get_user_by_id
from supabase_intelligence_helpers import (
    get_business_profile_supabase,
    get_soundboard_conversation_supabase,
    update_soundboard_conversation_supabase,
    create_soundboard_conversation_supabase,
)
from fact_resolution import resolve_facts, build_known_facts_prompt

router = APIRouter()

# ─── Hardcoded fallback (used only if DB prompt is missing) ───
_SOUNDBOARD_FALLBACK = (
    "You are MySoundBoard.\n\n"
    "You exist as a thinking partner for a business owner.\n"
    "You are NOT an advisor. You are NOT a coach.\n"
    "Output: Observation → Question. NO advice. NO lists."
)


class SoundboardChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    intelligence_context: Optional[Dict[str, Any]] = None


class ConversationRename(BaseModel):
    title: str


@router.get("/soundboard/conversations")
async def get_soundboard_conversations(current_user: dict = Depends(get_current_user)):
    sb = get_sb()
    result = sb.table("soundboard_conversations").select("*").eq(
        "user_id", current_user["id"]
    ).order("updated_at", desc=True).limit(50).execute()
    return {"conversations": result.data or []}


@router.get("/soundboard/conversations/{conversation_id}")
async def get_soundboard_conversation_detail(conversation_id: str, current_user: dict = Depends(get_current_user)):
    sb = get_sb()
    result = sb.table("soundboard_conversations").select("*").eq(
        "id", conversation_id
    ).eq("user_id", current_user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conversation = result.data[0]
    return {"conversation": conversation, "messages": conversation.get("messages", [])}


@router.post("/soundboard/chat")
async def soundboard_chat(req: SoundboardChatRequest, current_user: dict = Depends(get_current_user)):
    """Chat with MySoundBoard — Uses Cognitive Core + Global Fact Authority + DB Prompts"""
    from routes.deps import cognitive_core
    sb = get_sb()
    user_id = current_user["id"]

    # Resolve facts
    resolved_facts = await resolve_facts(sb, user_id)
    facts_prompt = build_known_facts_prompt(resolved_facts)

    # Get or create conversation
    conversation = None
    if req.conversation_id:
        result = sb.table("soundboard_conversations").select("*").eq(
            "id", req.conversation_id
        ).eq("user_id", user_id).execute()
        if result.data:
            conversation = result.data[0]

    messages_history = (conversation.get("messages", [])[-20:]) if conversation else []

    # Cognitive Core context
    core_context = await cognitive_core.get_context_for_agent(user_id, "MySoundboard")
    await cognitive_core.observe(user_id, {
        "type": "message", "content": req.message,
        "agent": "MySoundboard", "topics": [], "is_repeated_concern": False
    })
    now_dt = datetime.now(timezone.utc)
    await cognitive_core.observe(user_id, {
        "type": "timing", "hour": now_dt.hour,
        "day": now_dt.strftime("%A"), "engagement": "high"
    })

    cognitive_context = _build_cognitive_context(req, core_context)

    # User info
    user_profile = await get_user_by_id(user_id)
    profile = await get_business_profile_supabase(sb, user_id)
    user_name = (user_profile.get("full_name") if user_profile else None) or "Business Owner"

    user_context = (
        f"\nUSER: {user_name}\n"
        f"BUSINESS: {profile.get('business_name', 'Their business') if profile else 'Unknown'}\n"
        f"PROFILE MATURITY: {core_context.get('profile_maturity', 'nascent')}\n"
        f"\n────────────────────────────────────────\nCOGNITIVE CORE CONTEXT (USE THIS)\n"
        f"────────────────────────────────────────\n"
        f"{cognitive_context or 'Limited data - ask questions to learn more about this user.'}\n"
    )

    # Fetch prompt from DB, fall back to hardcoded
    soundboard_prompt = await get_prompt("mysoundboard_v1", _SOUNDBOARD_FALLBACK)
    fact_block = f"\n\nGLOBAL FACT AUTHORITY:\n{facts_prompt}\nDo NOT re-ask any fact listed above.\n" if facts_prompt else ""

    # ═══ RAG RETRIEVAL (if enabled) ═══
    rag_context = ""
    try:
        from intelligence_spine import _get_cached_flag
        if _get_cached_flag('rag_chat_enabled'):
            from routes.rag_service import generate_embedding
            query_emb = await generate_embedding(req.message[:500])
            from supabase_client import get_supabase_client
            sb_rag = get_supabase_client()
            rag_results = sb_rag.rpc('rag_search', {
                'p_tenant_id': user_id,
                'p_query_embedding': query_emb,
                'p_limit': 3,
                'p_similarity_threshold': 0.65,
            }).execute()
            if rag_results.data:
                rag_snippets = [f"[{r['source_type']}] {r['content'][:300]}" for r in rag_results.data[:3]]
                rag_context = "\n\nRETRIEVED CONTEXT (cite these sources):\n" + "\n---\n".join(rag_snippets) + "\n"
    except Exception as e:
        logger.debug(f"RAG retrieval skipped: {e}")

    # ═══ MEMORY RETRIEVAL (if enabled) ═══
    memory_context = ""
    try:
        if _get_cached_flag('memory_layer_enabled'):
            sb_mem = get_supabase_client()
            summaries = sb_mem.table('context_summaries') \
                .select('summary_text').eq('tenant_id', user_id) \
                .order('created_at', desc=True).limit(2).execute()
            if summaries.data:
                memory_context = "\n\nPRIOR SESSION CONTEXT:\n" + "\n".join(s['summary_text'][:200] for s in summaries.data) + "\n"
    except Exception:
        pass

    # ═══ GUARDRAILS: Sanitise input ═══
    from guardrails import sanitise_input, sanitise_output, log_llm_call_to_db
    sanitised = sanitise_input(req.message)
    if sanitised['blocked']:
        return {"reply": "I can't process that request. Could you rephrase?", "blocked": True}
    clean_message = sanitised['text']

    system_message = soundboard_prompt + fact_block + rag_context + memory_context + f"\n\nCONTEXT:\n{user_context}"

    # ═══ FILE GENERATION DETECTION ═══
    file_keywords = {
        'logo': ['create a logo', 'design a logo', 'make a logo', 'generate a logo', 'logo for'],
        'document': ['create a document', 'write a document', 'draft a document', 'generate a document'],
        'report': ['create a report', 'generate a report', 'write a report', 'produce a report'],
        'social_image': ['create a social', 'design a post', 'social media image', 'create an image', 'generate an image'],
    }
    detected_file_type = None
    msg_lower = clean_message.lower()
    for ftype, keywords in file_keywords.items():
        if any(kw in msg_lower for kw in keywords):
            detected_file_type = ftype
            break

    if detected_file_type:
        try:
            from routes.file_service import _generate_image, _generate_document, _upload_to_storage, _get_storage
            sb_files = _get_storage()
            timestamp = __import__('datetime').datetime.now(__import__('datetime').timezone.utc).strftime('%Y%m%d_%H%M%S')

            if detected_file_type in ('logo', 'social_image'):
                image_bytes = await _generate_image(clean_message)
                fname = f"{detected_file_type}_{timestamp}.png"
                path = _upload_to_storage(sb_files, user_id, 'user-files', fname, image_bytes, 'image/png')
                signed = sb_files.storage.from_('user-files').create_signed_url(path, 3600)
                download_url = signed.get('signedURL', signed.get('signedUrl', ''))
                sb_files.table('generated_files').insert({
                    'tenant_id': user_id, 'file_name': fname, 'file_type': detected_file_type,
                    'storage_path': path, 'bucket': 'user-files', 'size_bytes': len(image_bytes),
                    'generated_by': 'soundboard', 'source_conversation_id': req.conversation_id or '',
                    'metadata': {'prompt': clean_message[:200]},
                }).execute()
                return {
                    "reply": f"I've created your {detected_file_type}. You can download it below or find it in your Reports tab.",
                    "file": {"name": fname, "type": detected_file_type, "download_url": download_url, "size": len(image_bytes)},
                    "conversation_id": req.conversation_id,
                }
            else:
                content = await _generate_document(clean_message, detected_file_type)
                fname = f"{detected_file_type}_{timestamp}.md"
                bucket = 'reports' if detected_file_type == 'report' else 'user-files'
                file_bytes = content.encode('utf-8')
                path = _upload_to_storage(sb_files, user_id, bucket, fname, file_bytes, 'text/plain')
                signed = sb_files.storage.from_(bucket).create_signed_url(path, 3600)
                download_url = signed.get('signedURL', signed.get('signedUrl', ''))
                sb_files.table('generated_files').insert({
                    'tenant_id': user_id, 'file_name': fname, 'file_type': detected_file_type,
                    'storage_path': path, 'bucket': bucket, 'size_bytes': len(file_bytes),
                    'generated_by': 'soundboard', 'source_conversation_id': req.conversation_id or '',
                    'metadata': {'prompt': clean_message[:200]},
                }).execute()
                return {
                    "reply": f"I've generated your {detected_file_type}. You can download it below or find it in your Reports tab.\n\n{content[:500]}{'...' if len(content) > 500 else ''}",
                    "file": {"name": fname, "type": detected_file_type, "download_url": download_url, "size": len(file_bytes)},
                    "conversation_id": req.conversation_id,
                }
        except Exception as e:
            logger.warning(f"File generation in SoundBoard failed: {e}")
            # Fall through to normal chat response

    try:
        chat = LlmChat(
            api_key=OPENAI_KEY,
            session_id=f"soundboard_{user_id}_{req.conversation_id or 'new'}",
            system_message=system_message
        )
        chat.with_model("openai", AI_MODEL)
        for msg in messages_history:
            if msg["role"] == "user":
                chat.add_message(UserMessage(text=msg["content"]))

        import time as _time
        _start = _time.time()
        response = await chat.send_message(UserMessage(text=clean_message))
        _elapsed = int((_time.time() - _start) * 1000)

        # Sanitise output
        if isinstance(response, str):
            response = sanitise_output(response)

        # Log to observability
        log_llm_call_to_db(
            tenant_id=user_id, model_name=AI_MODEL, endpoint='soundboard/chat',
            total_tokens=(len(clean_message) + len(response if isinstance(response, str) else '')) // 4,
            latency_ms=_elapsed, feature_flag='rag_chat_enabled' if False else 'soundboard',
        )

        # Generate title for new conversations
        conversation_title = None
        if not conversation:
            title_prompt = f"Generate a very short title (3-5 words max) for a conversation that starts with: '{req.message[:100]}'. Just the title, nothing else."
            title_chat = LlmChat(
                api_key=OPENAI_KEY,
                session_id=f"title_{user_id}_{now_dt.timestamp()}",
                system_message="Generate very short conversation titles. Just output the title, nothing else."
            )
            title_chat.with_model("openai", AI_MODEL)
            conversation_title = await title_chat.send_message(UserMessage(text=title_prompt))
            conversation_title = conversation_title.strip().strip("\"'")[:50]

        now = now_dt.isoformat()
        new_messages = [
            {"role": "user", "content": req.message, "timestamp": now},
            {"role": "assistant", "content": response, "timestamp": now}
        ]

        # Save to Supabase
        if req.conversation_id and conversation:
            updated_messages = conversation.get("messages", []) + new_messages
            await update_soundboard_conversation_supabase(sb, req.conversation_id, {
                "messages": updated_messages, "updated_at": now
            })
            conversation_id = req.conversation_id
        else:
            conversation_id = str(uuid.uuid4())
            await create_soundboard_conversation_supabase(sb, {
                "id": conversation_id, "user_id": user_id,
                "title": conversation_title or "New Conversation",
                "messages": new_messages, "created_at": now, "updated_at": now
            })

        return {"reply": response, "conversation_id": conversation_id, "conversation_title": conversation_title}

    except Exception as e:
        logger.error(f"Soundboard chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/soundboard/conversations/{conversation_id}")
async def rename_soundboard_conversation(
    conversation_id: str, req: ConversationRename,
    current_user: dict = Depends(get_current_user)
):
    sb = get_sb()
    result = sb.table("soundboard_conversations").update({
        "title": req.title, "updated_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", conversation_id).eq("user_id", current_user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "renamed"}


@router.delete("/soundboard/conversations/{conversation_id}")
async def delete_soundboard_conversation(conversation_id: str, current_user: dict = Depends(get_current_user)):
    sb = get_sb()
    result = sb.table("soundboard_conversations").delete().eq(
        "id", conversation_id
    ).eq("user_id", current_user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "deleted"}


def _build_cognitive_context(req: SoundboardChatRequest, core_context: dict) -> str:
    """Build cognitive context string from intelligence state + core context."""
    parts = []
    intelligence_ctx = req.intelligence_context or {}
    thresholds = intelligence_ctx.get("thresholds", {})
    integrations = intelligence_ctx.get("integrations", {})

    threshold_met = any([
        thresholds.get("timeConsistency"),
        thresholds.get("crossSourceReinforcement"),
        thresholds.get("behaviouralReinforcement"),
    ])

    parts.append("\n═══ INTELLIGENCE STATE ═══")
    if threshold_met:
        parts.append("Pattern consistency detected. Thresholds met for deeper reasoning.")
        if thresholds.get("timeConsistency"):
            parts.append("- Time consistency: signals held across time")
        if thresholds.get("crossSourceReinforcement"):
            parts.append("- Cross-source: multiple data sources align")
        if thresholds.get("behaviouralReinforcement"):
            parts.append("- Behavioural: user focus has recurred")
        parts.append("\nYou may reason, challenge assumptions, and explore implications.")
    else:
        parts.append("Thresholds NOT met. Signal is forming but not stabilised.")
        parts.append("\nYou must ask clarifying questions to understand context.")

    connected = [k for k, v in integrations.items() if v]
    parts.append(f"\nConnected sources: {', '.join(connected)}" if connected else "\nNo data sources connected.")

    r = core_context.get("reality", {})
    for key, label in [("business_type", "Business type"), ("time_scarcity", "Time availability"), ("cashflow_sensitivity", "Cashflow sensitivity")]:
        if r.get(key) and r[key] != "unknown":
            parts.append(f"{label}: {r[key]}")

    b = core_context.get("behaviour", {})
    if b.get("decision_velocity") and b["decision_velocity"] != "unknown":
        parts.append(f"Decision style: {b['decision_velocity']}")
    if b.get("avoids"):
        parts.append(f"Tends to avoid: {', '.join(b['avoids'][:3])}")
    if b.get("repeated_concerns"):
        parts.append(f"Recurring concerns: {', '.join(b['repeated_concerns'][:3])}")

    d = core_context.get("delivery", {})
    if d.get("style") and d["style"] != "unknown":
        parts.append(f"Prefers {d['style']} communication")

    sf = core_context.get("soundboard_focus", {})
    if sf.get("unresolved_loops"):
        parts.append("\nUNRESOLVED DECISION LOOPS:")
        for loop in sf["unresolved_loops"][:3]:
            parts.append(f"- {loop}")

    h = core_context.get("history", {})
    if h.get("in_stress_period"):
        parts.append("\nUser appears to be in a stress period. Soften tone.")

    return "\n".join(parts)
