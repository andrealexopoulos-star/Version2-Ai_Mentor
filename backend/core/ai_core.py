"""
AI Core — Thin orchestrator for AI response generation.
Delegates to sub-modules: business_context, prompt_builder, cognitive_context.

Usage from route modules:
    from core.ai_core import get_ai_response, get_business_context, get_system_prompt, build_business_knowledge_context
"""
import logging
from fastapi import HTTPException
from core.llm_router import llm_chat
from routes.deps import OPENAI_KEY, AI_MODEL, AI_MODEL_ADVANCED, cognitive_core

# Re-export from sub-modules for backward compatibility
from core.business_context import get_business_context, build_business_knowledge_context
from core.prompt_builder import get_system_prompt
from core.cognitive_context import build_cognitive_context_for_prompt, get_intelligence_snapshot

logger = logging.getLogger(__name__)


async def get_ai_response(
    message: str, context_type: str, session_id: str,
    user_id: str = None, user_data: dict = None,
    use_advanced: bool = False, user_access_token: str = None,
    metadata: dict = None
) -> str:
    """
    Generate AI response with BIQC Constitution enforcement.
    Calls intelligence-snapshot Edge Function before generating advice.
    """
    try:
        # STEP 1: Get Business Intelligence Snapshot (MANDATORY)
        intelligence_snapshot = await get_intelligence_snapshot(user_id, user_access_token)

        if intelligence_snapshot:
            logger.info(f"Retrieved intelligence snapshot for user {user_id}")
        else:
            logger.warning(f"Intelligence snapshot unavailable for user {user_id}")

        # STEP 2: Build business and cognitive context
        business_knowledge = None
        if user_id:
            business_context = await get_business_context(user_id)
            business_knowledge = build_business_knowledge_context(business_context)

            agent_name = "MyAdvisor" if context_type in ("general", "mentor", "advisor") else "MyIntel" if context_type == "intel" else "General"
            cognitive_context = await build_cognitive_context_for_prompt(user_id, agent_name)

            separator = "\n\n────────────────────────────────────────\nCOGNITIVE CORE CONTEXT (USE THIS FOR PERSONALIZATION)\n────────────────────────────────────────\n"
            if business_knowledge:
                business_knowledge = f"{business_knowledge}{separator}{cognitive_context}"
            else:
                business_knowledge = f"────────────────────────────────────────\nCOGNITIVE CORE CONTEXT\n────────────────────────────────────────\n{cognitive_context}"

            # Record interaction as observation
            await cognitive_core.observe(user_id, {
                "type": "message",
                "content": message[:500],
                "agent": agent_name,
                "context_type": context_type
            })

        # STEP 3: Generate system prompt and call LLM
        system_prompt = await get_system_prompt(context_type, user_data, business_knowledge, metadata)

        model = AI_MODEL_ADVANCED if use_advanced else AI_MODEL
        response = await llm_chat(system_message=system_prompt, user_message=message, model=model, api_key=OPENAI_KEY)
        return response

    except Exception as e:
        logger.error(f"AI Error: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")
