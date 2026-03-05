"""
MySoundBoard Routes — Thinking Partner
Extracted from server.py. Prompts loaded from Supabase system_prompts table.
Instrumented with Intelligence Spine LLM logging.
"""
from fastapi import APIRouter, Depends, HTTPException
import asyncio
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

# ─── Strategic Advisor System Prompt ───
_SOUNDBOARD_FALLBACK = """\
You are {user_first_name}'s personal Strategic Intelligence Advisor, operating inside BIQc — their sovereign business intelligence platform.

You have live access to {user_first_name}'s business data: CRM pipeline, accounting position, email signals, team capacity, market benchmarks, and their full Business DNA. This data is provided in the context below. You must use it.

YOUR CHARACTER:
You think like a senior commercial operator who has seen hundreds of businesses scale, stall, and fail. You are direct. You do not hedge unnecessarily. You do not start every response with a question. You earn trust by being specific — names, numbers, timeframes — not by being cautiously vague.

WHEN TO BE DIRECT (most of the time):
When you have data, lead with your observation and your view. {user_first_name} is a business owner, not a student. They don't need to be guided to their own conclusions — they need a trusted advisor who has already synthesised the data and can tell them what it means.

WHEN TO ASK A CLARIFYING QUESTION (only when genuinely needed):
When critical context is missing and your answer would be materially different depending on it, ask ONE specific question. Not several. Never ask "How does that make you feel?" — ask operational questions that change the advice.

COMMUNICATION PRINCIPLES:
- Use {user_first_name}'s first name naturally, the way a trusted colleague would — not at the start of every message, not never.
- Be conversational. No bullet lists unless the user specifically asks for a structured breakdown.
- Match energy: if they're urgent, be urgent. If they're reflective, go deep.
- If a signal in their data is serious, say it plainly. Don't soften critical findings.
- If you don't have data on something, say what you'd need — then give your best view with what you do have.
- Never fabricate numbers. If data is absent from the context provided, say so specifically.

RESPONSE PATTERN (adapt, don't follow rigidly):
1. When you have enough data: State your direct observation, back it with their specific numbers, give your recommendation.
2. When context is insufficient: State what the data shows so far, ask your ONE clarifying question.
3. Always close with the highest-leverage next move available to {user_first_name} right now.

You are not a chatbot. You are not a dashboard. You are the advisor {user_first_name} calls when the stakes are real.\
"""


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

    # User info — extract first name
    user_profile = await get_user_by_id(user_id)
    profile = await get_business_profile_supabase(sb, user_id)
    full_name = (user_profile.get("full_name") if user_profile else None) or "there"
    user_first_name = full_name.split()[0] if full_name and full_name != "there" else "there"
    user_email = (user_profile.get("email") if user_profile else None) or ""

    # ═══ FULL BUSINESS DNA ═══
    biz_context = ""
    if profile:
        biz_context = "\n\n═══ BUSINESS DNA ═══\n"
        biz_context += f"Business: {profile.get('business_name', 'Unknown')}\n"
        for field, label in [
            ('industry', 'Industry'), ('location', 'Location'), ('team_size', 'Team size'),
            ('target_market', 'Target market'), ('main_products_services', 'Products/services'),
            ('unique_value_proposition', 'UVP'), ('pricing_model', 'Pricing model'),
            ('business_model', 'Business model'), ('short_term_goals', 'Short-term goals'),
            ('long_term_goals', 'Long-term goals'), ('main_challenges', 'Current challenges'),
            ('growth_strategy', 'Growth strategy'), ('vision_statement', 'Vision'),
        ]:
            val = profile.get(field)
            if val:
                biz_context += f"{label}: {val}\n"

    user_context = (
        f"\nADVISOR IS SPEAKING WITH: {user_first_name} ({user_email})\n"
        f"PROFILE MATURITY: {core_context.get('profile_maturity', 'nascent')}\n"
        f"{biz_context}\n"
        f"════════════════════════════════════════\n"
        f"COGNITIVE INTELLIGENCE SNAPSHOT\n"
        f"════════════════════════════════════════\n"
        f"{cognitive_context or 'No cognitive snapshot available — ask about their data to gather context.'}\n"
    )

    # ═══ LIVE INTEGRATION DATA (CRM, Accounting, Email) ═══
    integration_context = ""
    try:
        from routes.unified_intelligence import _fetch_all_integration_data, _compute_revenue_signals, _compute_risk_signals, _compute_people_signals
        all_data = await _fetch_all_integration_data(sb, user_id)
        
        # Integration status
        connected_list = [k for k, v in {'CRM': all_data['crm']['connected'], 'Accounting': all_data['accounting']['connected'], 'Email': all_data['email']['connected'], 'Marketing': all_data['marketing']['connected']}.items() if v]
        if connected_list:
            integration_context += f"\nCONNECTED INTEGRATIONS: {', '.join(connected_list)}\n"
        else:
            integration_context += "\nNO INTEGRATIONS CONNECTED.\n"
        
        # Revenue signals
        rev = _compute_revenue_signals(all_data)
        if rev['deals']:
            integration_context += f"\nREVENUE: Pipeline ${rev['pipeline_total']:,.0f} | {rev['stalled_deals']} stalled deals | {rev['won_count']} won | {rev['lost_count']} lost | Concentration: {rev['concentration_risk']}\n"
            for d in rev['deals'][:5]:
                integration_context += f"  - {d['name']}: ${d['amount']:,.0f} ({d['status']}) stage: {d['stage']}\n"
        if rev['overdue_invoices']:
            integration_context += f"\nOVERDUE INVOICES ({len(rev['overdue_invoices'])}):\n"
            for inv in rev['overdue_invoices'][:3]:
                integration_context += f"  - Invoice {inv['number']}: ${inv['amount']:,.0f} ({inv['days_overdue']}d overdue)\n"
        if rev['at_risk']:
            integration_context += "\nAT-RISK DEALS:\n"
            for r in rev['at_risk'][:3]:
                integration_context += f"  - {r['name']}: ${r['amount']:,.0f} — {r['risk']} ({r['days_stalled']}d stalled)\n"
        
        # Risk signals
        risk = _compute_risk_signals(all_data)
        if risk['overall_risk'] != 'low':
            integration_context += f"\nRISK LEVEL: {risk['overall_risk'].upper()}\n"
            for cat in ['financial_risks', 'operational_risks', 'people_risks', 'market_risks']:
                for item in risk.get(cat, []):
                    if isinstance(item, dict):
                        integration_context += f"  [{item.get('severity','?').upper()}] {item['detail']}\n"
        
        # People signals
        people = _compute_people_signals(all_data)
        if people.get('capacity') or people.get('fatigue'):
            integration_context += f"\nWORKFORCE: Capacity {people['capacity'] or '?'}% | Fatigue: {people['fatigue'] or '?'}\n"
    except Exception as e:
        logger.debug(f"Unified intelligence fetch for SoundBoard: {e}")
        integration_context = "\nIntegration data unavailable.\n"

    # ═══ MARKETING BENCHMARK DATA ═══
    marketing_context = ""
    try:
        bench = sb.table('marketing_benchmarks').select('scores, competitors, summary').eq('tenant_id', user_id).eq('is_current', True).execute()
        if bench.data and bench.data[0].get('scores'):
            b = bench.data[0]
            scores = b['scores']
            marketing_context = "\n\nMARKETING BENCHMARK SCORES:\n"
            for pillar, score in scores.items():
                if pillar != 'overall' and isinstance(score, (int, float)):
                    marketing_context += f"- {pillar.replace('_', ' ').title()}: {round(score * 100)}%\n"
            marketing_context += f"Overall: {round(scores.get('overall', 0) * 100)}%\n"
            if b.get('competitors'):
                marketing_context += f"Benchmarked against: {', '.join(c.get('name','?') for c in b['competitors'][:3])}\n"
    except Exception:
        pass

    # ═══ AVAILABLE ACTIONS ═══
    actions_context = "\n\nAVAILABLE ACTIONS (tell user about these when relevant):\n"
    actions_context += "- 'Create a logo' → generates AI logo\n"
    actions_context += "- 'Write a blog post about [topic]' → generates SEO blog\n"
    actions_context += "- 'Create a Google Ad for [product]' → generates ad copy\n"
    actions_context += "- 'Write a social media post' → generates LinkedIn/Twitter/Facebook\n"
    actions_context += "- 'Create a job description for [role]' → generates job posting\n"
    actions_context += "- 'Run a benchmark' → compares against competitors\n"
    actions_context += "- 'Generate a report' → creates downloadable PDF report\n"

    # Always use the new Strategic Advisor prompt — do NOT use cached DB prompt
    # (DB has old 'thinking partner' prompt that conflicts with new advisor persona)
    soundboard_prompt = _SOUNDBOARD_FALLBACK.replace("{user_first_name}", user_first_name)
    fact_block = f"\n\nKNOWN FACTS (do not re-ask these):\n{facts_prompt}\n" if facts_prompt else ""

    # ═══ RAG RETRIEVAL — always attempt (no flag dependency) ═══
    rag_context = ""
    try:
        from routes.rag_service import generate_embedding
        query_emb = await generate_embedding(req.message[:500])
        from supabase_client import get_supabase_client
        sb_rag = get_supabase_client()
        rag_results = sb_rag.rpc('rag_search', {
            'p_tenant_id': user_id,
            'p_query_embedding': query_emb,
            'p_limit': 4,
            'p_similarity_threshold': 0.60,
        }).execute()
        if rag_results.data:
            rag_snippets = [f"[{r['source_type']}] {r['content'][:400]}" for r in rag_results.data[:4]]
            rag_context = "\n\n═══ RETRIEVED FROM DOCUMENT STORAGE ═══\n" + "\n---\n".join(rag_snippets) + "\n"
    except Exception as e:
        logger.debug(f"RAG retrieval: {e}")

    # ═══ MEMORY — always attempt (no flag dependency) ═══
    memory_context = ""
    try:
        from supabase_client import get_supabase_client
        sb_mem = get_supabase_client()
        summaries = sb_mem.table('context_summaries') \
            .select('summary_text, created_at').eq('tenant_id', user_id) \
            .order('created_at', desc=True).limit(5).execute()
        if summaries.data:
            memory_context = "\n\n═══ PRIOR CONVERSATION CONTEXT ═══\n"
            for s in summaries.data:
                memory_context += f"- {s['summary_text'][:300]}\n"
    except Exception as e:
        logger.debug(f"Memory retrieval: {e}")

    # ═══ GUARDRAILS: Sanitise input ═══
    from guardrails import sanitise_input, sanitise_output, log_llm_call_to_db
    sanitised = sanitise_input(req.message)
    if sanitised['blocked']:
        return {"reply": "I can't process that request. Could you rephrase?", "blocked": True}
    clean_message = sanitised['text']

    system_message = soundboard_prompt + fact_block + biz_context + rag_context + memory_context + integration_context + marketing_context + actions_context + f"\n\nCONTEXT:\n{user_context}"

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

        # ═══ AUTO SESSION SUMMARISATION — always save ═══
        try:
            from supabase_client import get_supabase_client
            sb_sum = get_supabase_client()
            summary_text = f"[{now_dt.strftime('%d %b %Y')}] {user_first_name} discussed: {req.message[:150]}. Key topic: {req.message[:60]}. Response context: business data accessed, {len(integration_context)} chars integration data."
            sb_sum.table('context_summaries').insert({
                'tenant_id': user_id,
                'summary_type': 'soundboard_session',
                'summary_text': summary_text,
                'source_count': 1,
                'key_outcomes': [{'topic': req.message[:80], 'response_length': len(response) if isinstance(response, str) else 0}],
            }).execute()
        except Exception:
            pass

        # ═══ MARKETING ACTION DELEGATION ═══
        action_keywords = {
            'run_benchmark': ['benchmark my', 'compare me to', 'how do i compare', 'competitor analysis'],
            'generate_ad': ['create an ad', 'write an ad', 'google ad'],
            'generate_blog': ['write a blog', 'create a blog', 'blog post about'],
            'generate_social': ['create a social post', 'write a social', 'post on linkedin'],
        }
        delegated_action = None
        for action, keywords in action_keywords.items():
            if any(kw in msg_lower for kw in keywords):
                delegated_action = action
                break

        execution_id = str(uuid.uuid4())[:8] if delegated_action else None

        return {
            "reply": response,
            "conversation_id": conversation_id,
            "conversation_title": conversation_title,
            "delegated_action": delegated_action,
            "execution_id": execution_id,
        }

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



# ═══════════════════════════════════════════════════════════════
# SCAN USAGE — Supabase-backed server-side enforcement
# ═══════════════════════════════════════════════════════════════

SCAN_COOLDOWN_DAYS = 30
FEATURES = ['exposure_scan', 'forensic_calibration']


class RecordScanRequest(BaseModel):
    feature_name: str  # 'exposure_scan' or 'forensic_calibration'


@router.get("/soundboard/scan-usage")
async def get_scan_usage(current_user: dict = Depends(get_current_user)):
    """
    Returns scan eligibility for this user from Supabase.
    - calibration_complete: bool
    - is_free_tier: bool
    - exposure_scan: { can_run, last_used_at, days_until_next }
    - forensic_calibration: { can_run, last_used_at, days_until_next }
    """
    sb = get_sb()
    user_id = current_user["id"]
    now = datetime.now(timezone.utc)

    # Check calibration status
    calibration_complete = False
    try:
        op = sb.table("user_operator_profile").select("persona_calibration_status").eq("user_id", user_id).execute()
        if op.data and op.data[0].get("persona_calibration_status") == "complete":
            calibration_complete = True
    except Exception:
        pass

    # Check subscription tier
    subscription_tier = "free"
    try:
        u = sb.table("users").select("subscription_tier").eq("id", user_id).execute()
        if u.data:
            subscription_tier = u.data[0].get("subscription_tier") or "free"
    except Exception:
        pass

    tier_rank = {"free": 0, "starter": 1, "professional": 2, "growth": 3, "enterprise": 3, "super_admin": 99}
    is_paid = tier_rank.get(subscription_tier, 0) >= 1

    # Fetch usage records from Supabase
    usage_map = {}
    try:
        result = sb.table("user_feature_usage").select("feature_name, last_used_at, use_count").eq("user_id", user_id).execute()
        for row in (result.data or []):
            usage_map[row["feature_name"]] = row
    except Exception:
        pass

    def feature_status(feature):
        row = usage_map.get(feature)
        if not row or is_paid:
            # Paid users always can run; no prior record = can run
            return {"can_run": True, "last_used_at": row["last_used_at"] if row else None, "days_until_next": 0}
        last_used = datetime.fromisoformat(row["last_used_at"].replace("Z", "+00:00")) if row.get("last_used_at") else None
        if not last_used:
            return {"can_run": True, "last_used_at": None, "days_until_next": 0}
        elapsed_days = (now - last_used).days
        if elapsed_days >= SCAN_COOLDOWN_DAYS:
            return {"can_run": True, "last_used_at": row["last_used_at"], "days_until_next": 0}
        return {
            "can_run": False,
            "last_used_at": row["last_used_at"],
            "days_until_next": SCAN_COOLDOWN_DAYS - elapsed_days,
        }

    return {
        "calibration_complete": calibration_complete,
        "subscription_tier": subscription_tier,
        "is_paid": is_paid,
        "exposure_scan": feature_status("exposure_scan"),
        "forensic_calibration": feature_status("forensic_calibration"),
    }


@router.post("/soundboard/record-scan")
async def record_scan(req: RecordScanRequest, current_user: dict = Depends(get_current_user)):
    """Record a scan being initiated. Upsert into user_feature_usage."""
    if req.feature_name not in FEATURES:
        raise HTTPException(status_code=400, detail=f"Invalid feature. Must be one of: {FEATURES}")
    sb = get_sb()
    user_id = current_user["id"]
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        existing = sb.table("user_feature_usage").select("id, use_count").eq("user_id", user_id).eq("feature_name", req.feature_name).execute()
        if existing.data:
            sb.table("user_feature_usage").update({
                "last_used_at": now_iso,
                "use_count": (existing.data[0].get("use_count") or 0) + 1,
            }).eq("user_id", user_id).eq("feature_name", req.feature_name).execute()
        else:
            sb.table("user_feature_usage").insert({
                "user_id": user_id,
                "feature_name": req.feature_name,
                "last_used_at": now_iso,
                "use_count": 1,
            }).execute()
    except Exception as e:
        logger.warning(f"record_scan failed: {e}")
        return {"status": "error", "detail": str(e)}
    return {"status": "recorded", "feature": req.feature_name, "recorded_at": now_iso}
