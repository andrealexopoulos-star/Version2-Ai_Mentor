"""BIQc Marketing Automation Agent — Content generation + campaign orchestration.

Generates: Google Ads, landing pages, blog posts, social posts, job descriptions.
Uses retrieval-augmented templates grounded in company data + benchmarks.
Feature-flagged: marketing_automation_enabled.
All actions logged to action_log. Requires user confirmation before execution.
"""
import logging
import time
import os
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

from routes.auth import get_current_user
from intelligence_spine import _get_cached_flag
from guardrails import sanitise_output, log_llm_call_to_db

OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "")


class GenerateRequest(BaseModel):
    content_type: str  # 'google_ad', 'blog', 'social_post', 'landing_page', 'job_description'
    topic: str = ''
    tone: str = 'professional'
    target_audience: str = ''
    additional_context: str = ''


class ExecuteRequest(BaseModel):
    action_id: str
    confirmed: bool = False


CONTENT_TEMPLATES = {
    'google_ad': {
        'system': 'You are a Google Ads copywriter. Write compelling ad copy that drives clicks. Output JSON with: headline1 (30 chars max), headline2 (30 chars max), headline3 (30 chars max), description1 (90 chars max), description2 (90 chars max), display_url, final_url_suggestion.',
        'max_tokens': 500,
    },
    'blog': {
        'system': 'You are a B2B content strategist. Write an SEO-optimised blog post. Output JSON with: title, meta_description (155 chars), introduction, sections (array of {heading, content}), conclusion, suggested_tags.',
        'max_tokens': 2000,
    },
    'social_post': {
        'system': 'You are a social media manager. Write platform-specific social content. Output JSON with: linkedin_post, twitter_post, facebook_post, instagram_caption, hashtags.',
        'max_tokens': 800,
    },
    'landing_page': {
        'system': 'You are a conversion copywriter. Write landing page copy. Output JSON with: headline, subheadline, hero_cta, value_props (array), social_proof_suggestion, final_cta.',
        'max_tokens': 1000,
    },
    'job_description': {
        'system': 'You are an HR content specialist. Write a compelling job description. Output JSON with: title, department, location, about_company, responsibilities, requirements, benefits, application_instructions.',
        'max_tokens': 1200,
    },
}


async def _generate_content(content_type: str, business_context: str, topic: str, tone: str, audience: str, extra: str, tenant_id: str) -> dict:
    """Generate marketing content using RAG-augmented LLM."""
    template = CONTENT_TEMPLATES.get(content_type)
    if not template:
        raise HTTPException(status_code=400, detail=f"Unknown content type: {content_type}")

    # RAG retrieval for grounding
    rag_context = ""
    try:
        if _get_cached_flag('rag_chat_enabled'):
            from routes.rag_service import generate_embedding
            from supabase_client import get_supabase_client
            query_emb = await generate_embedding(f"{topic} {content_type}")
            sb = get_supabase_client()
            rag = sb.rpc('rag_search', {
                'p_tenant_id': tenant_id,
                'p_query_embedding': query_emb,
                'p_limit': 3,
                'p_similarity_threshold': 0.6,
            }).execute()
            if rag.data:
                rag_context = "\n\nRETRIEVED BUSINESS CONTEXT:\n" + "\n".join(f"- {r['content'][:200]}" for r in rag.data[:3])
    except Exception:
        pass

    prompt = f"""Business context: {business_context}
Topic: {topic}
Tone: {tone}
Target audience: {audience}
{extra}
{rag_context}

Generate {content_type.replace('_', ' ')} content. Return ONLY valid JSON."""

    try:
        from core.llm_router import llm_chat

        start = time.time()
        response = await llm_chat(system_message=template['system'], user_message=prompt, model="gpt-5.3", api_key=OPENAI_KEY)
        elapsed = int((time.time() - start) * 1000)

        response = sanitise_output(response)
        log_llm_call_to_db(tenant_id=tenant_id, model_name="gpt-5.3", endpoint=f'automation/{content_type}', latency_ms=elapsed, total_tokens=(len(prompt) + len(response)) // 4)

        import json
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {'raw_content': response, 'parse_error': True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/automation/generate")
async def generate_content(req: GenerateRequest, current_user: dict = Depends(get_current_user)):
    """Generate marketing content. Returns draft for review — does NOT execute."""
    if not _get_cached_flag('marketing_automation_enabled'):
        return {'status': 'feature_disabled', 'message': 'Marketing automation not enabled'}

    # Get business context
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        profile = sb.table('business_profiles').select('business_name, industry, website, target_market, products_services, competitive_advantage').eq('user_id', current_user['id']).single().execute()
        biz = profile.data or {}
        biz_context = f"Company: {biz.get('business_name', '')}. Industry: {biz.get('industry', '')}. Services: {biz.get('products_services', '')}. Target market: {biz.get('target_market', '')}. Advantage: {biz.get('competitive_advantage', '')}."
    except Exception:
        biz_context = "No business profile available."

    content = await _generate_content(req.content_type, biz_context, req.topic, req.tone, req.target_audience, req.additional_context, current_user['id'])

    # Log to action_log as pending (NOT executed)
    try:
        sb.table('action_log').insert({
            'tenant_id': current_user['id'],
            'action_type': f'generate_{req.content_type}',
            'action_params': {'content_type': req.content_type, 'topic': req.topic, 'tone': req.tone, 'audience': req.target_audience},
            'status': 'pending',
            'result': content,
        }).execute()
    except Exception:
        pass

    return {'status': 'draft_ready', 'content_type': req.content_type, 'content': content, 'requires_confirmation': True}


@router.get("/automation/history")
async def get_automation_history(current_user: dict = Depends(get_current_user)):
    """Get marketing automation action history."""
    try:
        from supabase_client import get_supabase_client
        sb = get_supabase_client()
        result = sb.table('action_log').select('id, action_type, status, action_params, created_at').eq('tenant_id', current_user['id']).order('created_at', desc=True).limit(20).execute()
        return {'actions': result.data or []}
    except Exception:
        return {'actions': []}


@router.get("/automation/content-types")
async def get_content_types(current_user: dict = Depends(get_current_user)):
    """Get available content generation types."""
    return {'types': [
        {'id': 'google_ad', 'label': 'Google Ad', 'description': 'Headlines + descriptions for Google Ads'},
        {'id': 'blog', 'label': 'Blog Post', 'description': 'SEO-optimised article with sections'},
        {'id': 'social_post', 'label': 'Social Media', 'description': 'LinkedIn, Twitter, Facebook, Instagram'},
        {'id': 'landing_page', 'label': 'Landing Page', 'description': 'Conversion-focused page copy'},
        {'id': 'job_description', 'label': 'Job Description', 'description': 'Role posting with requirements'},
    ]}
