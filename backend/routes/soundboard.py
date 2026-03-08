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

from core.llm_router import llm_chat, llm_chat_with_usage
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


def _call_cognition_for_soundboard(sb, user_id):
    """Fetch live cognition data for SoundBoard context."""
    try:
        result = sb.rpc('ic_generate_cognition_contract', {
            'p_tenant_id': user_id, 'p_tab': 'overview'
        }).execute()
        return result.data if result.data else None
    except Exception:
        return None


def _polish_response(text):
    """Post-process AI response to enforce quality standards."""
    import re

    # Remove lines that start with numbered lists (1. 2. 3.)
    lines = text.split('\n')
    cleaned = []
    for line in lines:
        stripped = line.strip()
        # Convert numbered list items to prose
        match = re.match(r'^(\d+)\.\s+\*\*(.+?)\*\*:?\s*(.*)', stripped)
        if match:
            title = match.group(2)
            rest = match.group(3)
            cleaned.append(f"{title}: {rest}" if rest else f"{title}.")
        elif re.match(r'^(\d+)\.\s+\*\*(.+?)\*\*', stripped):
            # Bold-only list item
            match2 = re.match(r'^(\d+)\.\s+\*\*(.+?)\*\*\s*(.*)', stripped)
            if match2:
                cleaned.append(f"{match2.group(2)} {match2.group(3)}".strip())
            else:
                cleaned.append(stripped)
        elif re.match(r'^\d+\.\s', stripped):
            # Plain numbered item
            cleaned.append(re.sub(r'^\d+\.\s+', '', stripped))
        elif re.match(r'^[-•]\s', stripped):
            # Bullet point
            cleaned.append(re.sub(r'^[-•]\s+', '', stripped))
        else:
            cleaned.append(line)

    text = '\n'.join(cleaned)

    # Remove **bold** markdown
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)

    # Remove weak/hedging phrases aggressively
    weak_phrases = [
        r'[Ww]ithout [^.]*(?:data|insight|integration|connection|access|metric|feed|source|detail|information|visibility)[^.]*\.',
        r'[Gg]iven the (?:absence|lack|limited)[^.]*\.',
        r'[Tt]o (?:give|provide|get|move|refine)[^.]*(?:precise|detailed|specific|comprehensive|actionable|deeper|better)[^.]*\.',
        r'[Ww]e\'d ideally[^.]*\.',
        r'[Ii]t\'s difficult to[^.]*(?:precise|accurate|exact|detailed|specific)[^.]*\.',
        r'[Ll]et me know[^.]*\.',
        r'[Ww]ould you like[^?]*\?',
        r'[Nn]eed a deeper dive[^?]*\?',
        r'[Ii]f you[\'d]? like to (?:dive|explore|discuss|know)[^.]*\.',
        r'[Cc]onnecting (?:\w+ )*(?:data|financial|CRM|systems)[^.]*\.',
        r'[Yy]ou should consider connecting[^.]*\.',
        r'[Ff]or (?:a )?more (?:precise|detailed|comprehensive|accurate)[^.]*\.',
        r'[Hh]ere\'s (?:a )?rough[^.]*\.',
    ]
    for pattern in weak_phrases:
        text = re.sub(pattern, '', text)

    # Clean up double newlines
    text = re.sub(r'\n{3,}', '\n\n', text).strip()

    return text


# ─── Strategic Advisor System Prompt ───
_SOUNDBOARD_FALLBACK = """\
You are {user_first_name}'s Strategic Intelligence Advisor inside BIQc — their sovereign business intelligence platform.

═══ YOUR IDENTITY ═══
You are a former McKinsey engagement manager who left consulting to build intelligence systems. You think in frameworks but speak in plain language. You've advised 200+ SMBs through growth, contraction, and transformation. You never give advice you wouldn't stake your reputation on.

═══ ABSOLUTE RULES ═══
NEVER give generic advice. Every sentence must reference {user_first_name}'s specific business, their industry, their numbers, or their competitive position. If you catch yourself writing something that could apply to any business, delete it and be more specific.

LEAD WITH INSIGHT, NOT QUESTIONS. When you have data — and you do — state what you see, what it means, and what {user_first_name} should do about it. Then ask ONE targeted follow-up only if critical context is missing.

USE THEIR NUMBERS. Reference their revenue range, team size, customer count, industry benchmarks, and competitive position in every substantive response. Vague answers like "consider your market position" are BANNED — say "at $22M revenue with 112 staff in specialty coffee, your overhead ratio suggests..."

NAME THE RISK. Don't say "there may be some challenges." Say exactly what the challenge is, who it affects, by when, and what happens if they don't act.

GIVE THE RECOMMENDATION. Don't say "you should think about this." Say "Here's what I'd do this week: [specific action with specific outcome]."

NEVER FABRICATE DATA. If you don't have a specific number, give a calibrated estimate based on industry benchmarks for their revenue band and team size.

FORMAT: Write in flowing prose paragraphs ONLY. NEVER use numbered lists, bullet points, bold headers, or structured breakdowns unless the user explicitly says "give me a list" or "break it down step by step". Your response should read like a sharp email from a senior advisor — paragraphs of connected thinking, not a consultant's slide deck.

═══ INTELLIGENCE FRAMEWORK ═══
When answering, ALWAYS run this analysis internally using the business data provided:

REVENUE EFFICIENCY: Revenue range / team size = revenue per employee. Compare to industry benchmark (~$250K-400K/employee for F&B). If below, they're either overstaffed or underpricing. If above, they have margin to invest.

CUSTOMER CONCENTRATION: Customer count vs revenue. Calculate implied revenue per customer. If a few customers represent >20% of revenue, flag concentration risk.

GROWTH STAGE: Revenue range + team size + business model = growth lifecycle position. $22-50M with 112 staff in food manufacturing = mid-market scaling phase. Typical challenges: margin compression, operational complexity, talent retention.

MARKET POSITION: Industry + location + UVP = competitive positioning. Specialty coffee in Australia with sustainability positioning = premium but competitive. Key risks: commoditization, supply chain ethics audits, café closures.

CASH DYNAMICS: Revenue range + business model (B2B invoicing cycles + B2C direct) = cash flow pattern. B2B coffee supply typically has 30-60 day payment terms. At their revenue, 5% overdue = $1-2.5M trapped.

Run these calculations EVERY TIME and weave the findings into your response naturally.

═══ COMMUNICATION STYLE ═══
- Write like a trusted colleague at a working dinner — direct, warm, no bullshit
- Use {user_first_name}'s name naturally, like a colleague would
- ABSOLUTELY NO NUMBERED LISTS OR BULLET POINTS unless the user specifically asks "give me a list" or "break it down". Write in flowing paragraphs that connect ideas narratively. If you catch yourself writing "1." or "•" — STOP and rewrite as prose.
- If the news is bad, say it plainly. Respect {user_first_name} enough to be honest.
- Short paragraphs. Punch lines. No filler words.
- Close every response with the ONE thing {user_first_name} should do next — specific, actionable, time-bound.

═══ BANNED PHRASES (never use these) ═══
- "without direct data" / "absence of data" / "data is limited" — NEVER mention what you DON'T have. Work with what you DO have.
- "consider looking into" — too vague. Say exactly what to do.
- "it might be wise" / "you might want to" — weak. Be direct: "Do this."
- "Let me know if you want to explore deeper" — assume they do. Go deep.
- "To get more precise analysis" — don't advertise your limitations.
- "Here's what I suggest" followed by a generic list — give ONE sharp recommendation backed by their numbers.

═══ WHEN DATA IS LIMITED ═══
Even without full integration data, you ALWAYS have their Business DNA (industry, revenue range, team size, location, business model, challenges, goals). USE IT AGGRESSIVELY:
- Industry benchmarks: Compare their metrics against typical ranges for their industry and revenue band
- Structural analysis: At their team size and revenue, what are the predictable bottlenecks?
- Growth stage diagnosis: Based on revenue range and team size, where are they in the growth lifecycle?
- Competitive positioning: Based on their industry and location, what are the market dynamics?

A great advisor doesn't need perfect data to give sharp advice. They use what they have and are transparent about what's missing.

═══ EXAMPLE OF A GREAT RESPONSE ═══
User asks: "What should I focus on this week?"
BAD response: "Consider reviewing your strategy and looking at market opportunities."
GOOD response: "At $22M revenue with 112 people in specialty coffee, your biggest lever right now is cash collection efficiency. Businesses at your stage typically have 15-20% of revenue tied up in receivables. Without seeing your Xero data directly, I'd bet you have at least $200-400K aging past 30 days — that's working capital trapped. This week: pull your aged receivables report, flag anything over 45 days, and personally call your top 3 overdue accounts. The second priority is your B2B pipeline. With 600+ cafés as customers, your acquisition cost per new café relationship matters. What's your current close rate on new café partnerships, and how many are in active negotiation right now?"

Notice: specific to THEIR business, uses THEIR numbers, gives a CONCRETE action, and asks ONE targeted question.\
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

    # ═══ PERSONALIZATION GUARDRAIL ═══
    context_fields = 0
    if profile:
        for field in ['business_name', 'industry', 'revenue_range', 'team_size', 'main_challenges', 'short_term_goals']:
            if profile.get(field) and str(profile.get(field)) != 'None':
                context_fields += 1

    # Live signal freshness check
    live_signal_count = 0
    live_signal_age_hours = None
    try:
        obs_result = sb.table('observation_events').select('observed_at', count='exact').eq('user_id', user_id).order('observed_at', desc=True).limit(1).execute()
        live_signal_count = obs_result.count or 0
        if obs_result.data:
            last_obs = datetime.fromisoformat(obs_result.data[0]['observed_at'].replace('Z', '+00:00'))
            live_signal_age_hours = round((datetime.now(timezone.utc) - last_obs).total_seconds() / 3600, 1)
    except Exception:
        pass

    if context_fields < 2:
        logger.warning(f"[GUARDRAIL_BLOCKED] user={user_id} context_fields={context_fields}")
        guardrail_status = "BLOCKED"
    elif context_fields < 4:
        logger.info(f"[GUARDRAIL_DEGRADED] user={user_id} context_fields={context_fields} live_signals={live_signal_count}")
        guardrail_status = "DEGRADED"
    else:
        guardrail_status = "FULL"
        logger.info(f"[GUARDRAIL_FULL] user={user_id} context_fields={context_fields} live_signals={live_signal_count} age_hours={live_signal_age_hours}")

    # ═══ FULL BUSINESS DNA ═══
    biz_context = ""
    if profile:
        biz_context = "\n\n═══ BUSINESS DNA (USE THIS DATA IN EVERY RESPONSE) ═══\n"
        biz_context += f"Business: {profile.get('business_name', 'Unknown')}\n"
        
        # Core identity
        for field, label in [
            ('industry', 'Industry'), ('location', 'Location'), ('website', 'Website'),
            ('team_size', 'Team Size'), ('revenue_range', 'Revenue Range'),
            ('customer_count', 'Customer Base'), ('target_market', 'Target Market'),
        ]:
            val = profile.get(field)
            if val and val != 'None':
                biz_context += f"{label}: {val}\n"
        
        biz_context += "\n--- Strategic Position ---\n"
        for field, label in [
            ('main_products_services', 'Products/Services'),
            ('unique_value_proposition', 'Unique Value Proposition'),
            ('pricing_model', 'Pricing Model'), ('business_model', 'Business Model'),
            ('mission_statement', 'Mission'),
        ]:
            val = profile.get(field)
            if val and val != 'None':
                biz_context += f"{label}: {val}\n"
        
        biz_context += "\n--- Goals & Challenges (REFERENCE THESE) ---\n"
        for field, label in [
            ('short_term_goals', 'Short-term Goals (next 90 days)'),
            ('long_term_goals', 'Long-term Goals (12+ months)'),
            ('main_challenges', 'Current Challenges'),
            ('growth_strategy', 'Growth Strategy'),
            ('vision_statement', 'Vision'),
        ]:
            val = profile.get(field)
            if val and val != 'None':
                biz_context += f"{label}: {val}\n"
        
        # Additional profile fields
        biz_context += "\n--- Operational Context ---\n"
        for field, label in [
            ('key_competitors', 'Known Competitors'),
            ('tech_stack', 'Technology Stack'),
            ('marketing_channels', 'Marketing Channels'),
            ('sales_process', 'Sales Process'),
            ('operational_model', 'Operations Model'),
            ('funding_stage', 'Funding Stage'),
            ('burn_rate', 'Monthly Burn Rate'),
            ('advisory_mode', 'Advisor Mode Preference'),
        ]:
            val = profile.get(field)
            if val and val != 'None' and val != 0:
                biz_context += f"{label}: {val}\n"

    user_context = (
        f"\nADVISOR IS SPEAKING WITH: {user_first_name} ({user_email})\n"
        f"PROFILE MATURITY: {core_context.get('profile_maturity', 'nascent')}\n"
        f"{biz_context}\n"
        f"════════════════════════════════════════\n"
        f"INTELLIGENCE SNAPSHOT (reference these signals)\n"
        f"════════════════════════════════════════\n"
        f"{cognitive_context or 'No pre-computed intelligence snapshot available. Rely on Business DNA and integration data above to deliver sharp, specific insights.'}\n"
    )

    # ═══ COGNITION CORE LIVE DATA ═══
    cognition_context = ""
    try:
        cognition_result = _call_cognition_for_soundboard(sb, user_id)
        if cognition_result and cognition_result.get('status') == 'computed':
            cognition_context = "\n═══ COGNITION CORE (LIVE COMPUTED) ═══\n"
            cognition_context += f"System State: {cognition_result.get('system_state', 'Unknown')}\n"
            cognition_context += f"Evidence Count: {cognition_result.get('evidence_count', 0)}\n"
            
            # Instability indices
            indices = cognition_result.get('instability_indices', {})
            if indices:
                cognition_context += "Instability Indices:\n"
                for key, val in indices.items():
                    if isinstance(val, (int, float)):
                        cognition_context += f"  {key}: {val:.2f}\n"
            
            # Propagation map
            prop_map = cognition_result.get('propagation_map', [])
            if prop_map:
                cognition_context += "Risk Propagation Chains:\n"
                for chain in prop_map[:3]:
                    cognition_context += f"  {chain.get('source')} → {chain.get('target')} (probability: {chain.get('probability', 0):.0%})\n"
            
            # Stability score
            stability = cognition_result.get('stability_score')
            if stability:
                cognition_context += f"Composite Stability Score: {stability}\n"
    except Exception:
        pass

    # ═══ LIVE INTEGRATION DATA (CRM, Accounting, Email) ═══
    integration_context = ""

    # FIRST: Inject observation_events (cached signals from emission layer)
    try:
        obs_result = sb.table('observation_events').select(
            'signal_name,domain,severity,entity,metric,observed_at'
        ).eq('user_id', user_id).order('observed_at', desc=True).limit(30).execute()

        obs_events = obs_result.data or []
        if obs_events:
            integration_context += f"\n═══ YOUR LIVE BUSINESS SIGNALS ({len(obs_events)} detected) ═══\n"
            integration_context += "IMPORTANT: These are REAL signals from the user's connected CRM and accounting systems. You MUST reference these specific signals in your response. Do NOT say you don't have access to their data.\n\n"

            for evt in obs_events[:15]:
                entity = evt.get('entity', {})
                if isinstance(entity, str):
                    try:
                        import json as _json
                        entity = _json.loads(entity)
                    except Exception:
                        entity = {}
                metric = evt.get('metric', {})
                if isinstance(metric, str):
                    try:
                        metric = _json.loads(metric)
                    except Exception:
                        metric = {}

                sig = evt.get('signal_name', '?')
                severity = evt.get('severity', '?')
                name = entity.get('name', entity.get('contact_name', ''))
                amount = entity.get('amount', entity.get('value', 0))
                stage = entity.get('stage', entity.get('status', ''))
                days_stalled = metric.get('days_in_stage', entity.get('days_stalled', ''))

                line = f"SIGNAL: {sig} | severity={severity}"
                if name: line += f" | deal='{name}'"
                if amount:
                    try: line += f" | amount=${float(amount):,.0f}"
                    except: line += f" | amount={amount}"
                if stage: line += f" | stage={stage}"
                if days_stalled: line += f" | stalled={days_stalled} days"
                integration_context += line + "\n"

            logger.info(f"[soundboard] Injected {len(obs_events)} observation_events for user {user_id[:8]}")
    except Exception as e:
        logger.warning(f"[soundboard] observation_events fetch: {e}")

    # SECOND: Try live Merge API data (may fail — non-fatal)
    try:
        from routes.unified_intelligence import _fetch_all_integration_data, _compute_revenue_signals, _compute_risk_signals, _compute_people_signals
        all_data = await _fetch_all_integration_data(sb, user_id)
        
        # Integration status
        connected_list = [k for k, v in {'CRM': all_data['crm']['connected'], 'Accounting': all_data['accounting']['connected'], 'Email': all_data['email']['connected'], 'Marketing': all_data['marketing']['connected']}.items() if v]
        disconnected_list = [k for k, v in {'CRM': all_data['crm']['connected'], 'Accounting': all_data['accounting']['connected'], 'Email': all_data['email']['connected']}.items() if not v]
        
        if connected_list:
            integration_context += "\n═══ LIVE INTEGRATION DATA (USE THESE NUMBERS) ═══\n"
            integration_context += f"Connected: {', '.join(connected_list)}\n"
            if disconnected_list:
                integration_context += f"Not Connected: {', '.join(disconnected_list)} — mention these gaps when relevant\n"
        # DO NOT clear integration_context here — observation_events data is already in it
        
        # Revenue signals
        rev = _compute_revenue_signals(all_data)
        if rev['deals']:
            integration_context += "\n--- Revenue Intelligence ---\n"
            integration_context += f"Pipeline Total: ${rev['pipeline_total']:,.0f}\n"
            integration_context += f"Stalled Deals: {rev['stalled_deals']} | Won: {rev['won_count']} | Lost: {rev['lost_count']}\n"
            integration_context += f"Concentration Risk: {rev['concentration_risk']}\n"
            if rev['deals']:
                integration_context += "Top Pipeline:\n"
                for d in rev['deals'][:5]:
                    integration_context += f"  {d['name']}: ${d['amount']:,.0f} ({d['status']}) stage: {d['stage']}\n"
        if rev.get('overdue_invoices'):
            integration_context += f"\n--- Cash Alert: {len(rev['overdue_invoices'])} Overdue Invoices ---\n"
            total_overdue = sum(inv.get('amount', 0) for inv in rev['overdue_invoices'])
            integration_context += f"Total Overdue: ${total_overdue:,.0f}\n"
            for inv in rev['overdue_invoices'][:5]:
                integration_context += f"  Invoice {inv['number']}: ${inv['amount']:,.0f} ({inv['days_overdue']} days overdue)\n"
        if rev.get('at_risk'):
            integration_context += f"\n--- At-Risk Deals ({len(rev['at_risk'])}) ---\n"
            for r in rev['at_risk'][:5]:
                integration_context += f"  {r['name']}: ${r['amount']:,.0f} — {r['risk']} ({r['days_stalled']}d stalled)\n"
        
        # Risk signals
        risk = _compute_risk_signals(all_data)
        if risk['overall_risk'] != 'low':
            integration_context += f"\n--- Risk Assessment: {risk['overall_risk'].upper()} ---\n"
            for cat in ['financial_risks', 'operational_risks', 'people_risks', 'market_risks']:
                items = risk.get(cat, [])
                if items:
                    integration_context += f"{cat.replace('_', ' ').title()}:\n"
                    for item in items:
                        if isinstance(item, dict):
                            integration_context += f"  [{item.get('severity','?').upper()}] {item['detail']}\n"
        
        # People signals
        people = _compute_people_signals(all_data)
        if people.get('capacity') or people.get('fatigue'):
            integration_context += "\n--- Workforce Signals ---\n"
            integration_context += f"Capacity Utilisation: {people['capacity'] or 'Unknown'}%\n"
            integration_context += f"Fatigue Index: {people['fatigue'] or 'Unknown'}\n"
    except Exception as e:
        logger.warning(f"[soundboard] Merge API fetch failed (non-fatal, using cached signals): {e}")
        # integration_context already has observation_events from above — don't clear it

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
    actions_context = "\n\nCONTENT GENERATION (only mention if user asks for content):\n"
    actions_context += "You can create: logos, blog posts, Google Ads, social media posts, job descriptions, benchmark reports, PDF reports.\n"
    actions_context += "Only offer these when the user specifically asks for content creation. Do NOT suggest these as business strategy.\n"

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

    # ═══ PERSONALIZATION GUARDRAIL: Block generic advice ═══
    if guardrail_status == "BLOCKED":
        return {
            "reply": "I need to know more about your business before I can give you specific advice. Please complete your business calibration first — it takes about 3 minutes and unlocks personalised intelligence across the entire platform.",
            "guardrail": "BLOCKED",
            "context_fields": context_fields,
            "live_signals": live_signal_count,
            "conversation_id": req.conversation_id,
        }

    # P1: Signal freshness injection
    signal_injection = ""
    if live_signal_count > 0:
        signal_injection = f"\n\n═══ LIVE SIGNAL STATUS ═══\nActive observation signals: {live_signal_count}\nLast signal: {live_signal_age_hours}h ago\nUSE THESE to ground your advice.\n"

    # P1: Response contract enforcement
    contract_injection = "\n\n═══ RESPONSE CONTRACT (MANDATORY) ═══\nEvery strategic response MUST include:\n1) SITUATION: What is happening? Use specific numbers or entity names from the data above.\n2) DECISION: One clear recommendation.\n3) THIS WEEK: One concrete action with who/what/by-when.\n4) RISK IF DELAYED: What happens if they don't act? Quantify.\nDo NOT output generic strategy. Every sentence must reference THIS business.\nDATA ATTRIBUTION: When referencing a fact, state its source inline — e.g. 'Based on your calibration data...' or 'Your HubSpot pipeline shows...' or 'From your Xero invoices...'. Never state a fact without its source.\n"

    guardrail_injection = ""
    if guardrail_status == "DEGRADED":
        calibration_fields = []
        if profile:
            for field, label in [
                ('business_name', 'Business Name'), ('industry', 'Industry'),
                ('location', 'Location'), ('team_size', 'Team Size'),
                ('main_products_services', 'Products/Services'),
                ('target_market', 'Target Market'), ('short_term_goals', 'Goals'),
                ('main_challenges', 'Challenges'),
            ]:
                if profile.get(field) and str(profile.get(field)) not in ('None', ''):
                    calibration_fields.append(label)
        calibration_summary = ', '.join(calibration_fields) if calibration_fields else 'business name and industry'
        guardrail_injection = (
            f"\n[ADVISOR CONTEXT: You have calibration data for this business covering: {calibration_summary}. "
            f"You DO have access to this data — it is injected above in BUSINESS DNA. "
            f"Do NOT say 'I don't have access to your data' or 'no data sources connected'. "
            f"Use the calibration data you have. Acknowledge that live integrations (CRM, accounting) are not yet connected "
            f"and focus your advisory on what you know from their calibration profile. "
            f"Be specific using the business name, industry, goals and challenges you have been given.]\n"
        )

    system_message = soundboard_prompt + fact_block + biz_context + cognition_context + rag_context + memory_context + integration_context + marketing_context + actions_context + signal_injection + guardrail_injection + contract_injection + f"\n\nCONTEXT:\n{user_context}"

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
        import time as _time
        _start = _time.time()
        response, token_usage = await llm_chat_with_usage(
            system_message=system_message,
            user_message=clean_message,
            messages=messages_history,
            model=AI_MODEL,
            temperature=0.7,
            max_tokens=1500,
            api_key=OPENAI_KEY,
        )
        _elapsed = int((_time.time() - _start) * 1000)
        _actual_tokens = token_usage.get("total_tokens") or (token_usage.get("prompt_tokens", 0) + token_usage.get("completion_tokens", 0))

        # Post-process: enforce quality and remove AI crutches
        logger.info(f"[POLISH_DEBUG] response type={type(response).__name__}, is_str={isinstance(response, str)}")
        if isinstance(response, str):
            pre_len = len(response)
            response = _polish_response(response)
            post_len = len(response)
            logger.info(f"[POLISH] Before: {pre_len} chars, After: {post_len} chars")
            response = sanitise_output(response)
        else:
            # Force convert to string if not already
            logger.info(f"[POLISH_DEBUG] Converting response to str: {str(response)[:100]}")
            response_str = str(response) if response else ""
            response = _polish_response(response_str)
            response = sanitise_output(response)

        # Log to observability — actual token counts from API
        log_llm_call_to_db(
            tenant_id=user_id, model_name=AI_MODEL, endpoint='soundboard/chat',
            total_tokens=_actual_tokens,
            latency_ms=_elapsed, feature_flag='soundboard',
        )

        # Generate title for new conversations
        conversation_title = None
        if not conversation:
            title_prompt = f"Generate a very short title (3-5 words max) for a conversation that starts with: '{req.message[:100]}'. Just the title, nothing else."
            try:
                conversation_title = await llm_chat(
                    system_message="Generate very short conversation titles. Just output the title, nothing else.",
                    user_message=title_prompt,
                    model=AI_MODEL,
                    max_tokens=30,
                    api_key=OPENAI_KEY,
                )
                conversation_title = conversation_title.strip().strip("\"'")[:50]
            except Exception:
                conversation_title = req.message[:40]

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
        parts.append("Signal still forming. Lead with analysis using Business DNA data.")

    connected = [k for k, v in integrations.items() if v]
    if connected:
        parts.append(f"\nConnected sources: {', '.join(connected)}")

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
