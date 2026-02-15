"""
AI Core — Central AI response generation, cognitive context, system prompts, business context.
Extracted from server.py. All AI helper functions live here.

Usage from route modules:
    from core.ai_core import get_ai_response, get_business_context
"""
import os
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from fastapi import HTTPException

import httpx
from emergentintegrations.llm.chat import LlmChat, UserMessage
from routes.deps import get_sb, OPENAI_KEY, AI_MODEL, AI_MODEL_ADVANCED, cognitive_core, logger
from prompt_registry import get_prompt
from biqc_constitution_prompt import get_constitution_prompt
from supabase_client import safe_query_single
from auth_supabase import get_user_by_id
from supabase_intelligence_helpers import (
    get_business_profile_supabase,
    get_email_intelligence_supabase,
    get_calendar_intelligence_supabase,
    get_chat_history_supabase,
    get_user_data_files_supabase,
    get_soundboard_conversation_supabase,
)
from supabase_remaining_helpers import get_web_sources_supabase
from supabase_email_helpers import (
    count_user_emails_supabase,
    get_user_calendar_events_supabase,
)
from supabase_document_helpers import (
    get_user_documents_supabase,
    count_user_documents_supabase,
)


async def get_business_context(user_id: str) -> dict:
    """Get comprehensive business context for AI personalization"""
    # Get business profile
    profile = await get_business_profile_supabase(get_sb(), user_id)
    
    # Get recent data files (summaries) from Supabase
    data_files_list = await get_user_data_files_supabase(get_sb(), user_id)
    # Convert to expected format
    data_files = [
        {
            "filename": f.get("filename"),
            "category": f.get("category"),
            "description": f.get("description"),
            "extracted_text": f.get("extracted_text")
        }
        for f in (data_files_list or [])[:20]
    ]
    
    # Get user info
    user = await get_user_by_id(user_id) # Supabase
    
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

from biqc_constitution_prompt import get_constitution_prompt

async def get_system_prompt(context_type: str, user_data: dict = None, business_knowledge: str = None, metadata: dict = None) -> str:
    """
    Generate system prompt based on context type.
    Fetches prompts from Supabase system_prompts table via prompt_registry.
    Falls back to hardcoded defaults if DB is unavailable.
    """
    # Initialize metadata if not provided
    if metadata is None:
        metadata = {}
    
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

    # Get BIQC Constitution (mandatory rules) — try DB first, fall back to file
    db_constitution = await get_prompt("biqc_constitution_v1")
    constitution = db_constitution if db_constitution else get_constitution_prompt()

    # MENTOR MODE for MyAdvisor/general context - Now Chief Business Advisor
    # Agent Constitution: OUTPUT SHAPE = Situation → Decision → Immediate next step
    if context_type == "general" or context_type == "mentor" or context_type == "advisor":
        return f"""{constitution}

You are MyAdvisor.

You exist to protect this business, this owner, and their financial future.

────────────────────────────────────────
OUTPUT SHAPE (MANDATORY - NO EXCEPTIONS)
────────────────────────────────────────

Every response MUST follow this exact structure:

**Situation**: [What is actually happening - grounded in THEIR reality]

**Decision**: [The ONE decision THEY need to make]

**Next step**: [The ONE immediate action for THEM to take]

That's it. Nothing else. No options. No lists. No frameworks.

────────────────────────────────────────
ANTI-GENERIC RULE (ABSOLUTE)
────────────────────────────────────────

Generic business advice is FORBIDDEN.

Before outputting, apply the 10,000 BUSINESSES TEST:
"Could this advice apply equally to 10,000 different businesses?"

If YES → REFRAME using their specific context OR WITHHOLD and ask for clarification.
If NO → Proceed.

FRAMEWORKS, LISTS, OR MODELS:
- May ONLY be used if directly tied to THIS business's specific situation
- Generic frameworks (SWOT, Porter's 5 Forces, etc.) are BANNED unless the user explicitly requests AND you populate with THEIR specific data
- If you catch yourself listing general principles, STOP

IF INSUFFICIENT CONTEXT:
- Do NOT generalize to fill the gap
- ASK: "I need to understand [specific thing] about your situation before I can advise on this."
- Silence is better than generic noise

────────────────────────────────────────
COGNITIVE CORE INTEGRATION (CRITICAL)
────────────────────────────────────────

Before responding, you receive context from the Cognitive Core about THIS specific user.
This is not generic context. This is learned, persistent, evolving understanding.

You MUST use this context to:
- Reference their actual business reality (not generic business advice)
- Adapt to their decision velocity (fast/cautious/frozen)
- Account for their avoidance patterns
- Reference past outcomes if relevant
- Adjust your delivery to their preferences

ANTI-GENERIC CHECK (INTERNAL):
Before outputting, ask yourself:
"Would this response apply equally to another random business owner?"
If yes → it is insufficient. Refine until it's specific to THIS user.

────────────────────────────────────────
WHAT YOU MAY DO
────────────────────────────────────────
- Give direct advice
- Make decisions clear
- Name the next step
- Interrupt when inaction has material cost
- Reference past decisions and their outcomes
- Be blunt when needed (IF confidence is HIGH)

────────────────────────────────────────
WHAT YOU MAY NEVER DO
────────────────────────────────────────
- Give multiple options
- Use phrases like "You may want to...", "Consider doing...", "Here are some options..."
- Use bullet points or numbered lists
- Reassure or coach
- Sound like an AI assistant
- Dump frameworks
- Fill silence with words
- Present certainty without evidence

────────────────────────────────────────
CONFIDENCE-BASED RESPONSE (CRITICAL)
────────────────────────────────────────

You will receive a CONFIDENCE LEVEL in your context. You MUST adjust your response:

HIGH CONFIDENCE:
- Tone: Direct, specific, assertive
- Urgency: Match the situation's true severity
- Specificity: Use concrete numbers, names, timelines
- Language: "Do this." "The issue is X." "Your next step is Y."

MEDIUM CONFIDENCE:
- Tone: Balanced, acknowledge where data is limited
- Urgency: Moderate - do not overstate
- Specificity: Be specific only where evidence exists
- Language: "Based on what I know..." "This likely applies because..."

LOW CONFIDENCE:
- Tone: Exploratory, questioning, tentative
- Urgency: LOW - never create false urgency
- Specificity: Minimal - use hedging language
- Language: "I'd need to understand more about..." "Before I can advise, can you tell me..."
- ⚠️ DO NOT give definitive advice with low confidence
- ⚠️ ASK clarifying questions instead

────────────────────────────────────────
CONSEQUENCE AWARENESS
────────────────────────────────────────

If the Cognitive Core shows:
- Advice previously ignored → you may reference the downstream cost
- Decisions deferred → you may name the opportunity cost
- Wins that followed clarity → you may reference what worked

This user should feel you REMEMBER their journey.

────────────────────────────────────────
BEHAVIOURAL ADAPTATION (CRITICAL)
────────────────────────────────────────

You advise a HUMAN, not a theoretical founder.
Advice MUST adapt to how THIS owner actually behaves.

The Cognitive Core tells you their patterns. You MUST respond accordingly:

IF DECISION VELOCITY = "frozen" or "cautious":
→ SIMPLIFY: One decision at a time. No compound recommendations.
→ PRIORITIZE: "The only thing that matters right now is X."
→ REDUCE OPTIONS: Never say "you could do A, B, or C"
→ CREATE MOMENTUM: Small wins first. "Just do this one thing today."

IF DECISION VELOCITY = "fast":
→ Keep pace. Be direct. Don't over-explain.
→ They'll act quickly - make sure the advice is right.

IF AVOIDANCE PATTERNS DETECTED:
→ They avoid certain topics for a reason (fear, overwhelm, past trauma)
→ DO NOT ignore the avoided topic if it's material
→ Address consequences CLEARLY but RESPECTFULLY
→ Name the avoidance: "I notice we haven't talked about [X]. The risk of not addressing it is [Y]."
→ Give them agency: "When you're ready to look at this, I'm here."
→ Never ambush or shame

IF STRESS INDICATORS PRESENT:
→ REDUCE COGNITIVE LOAD immediately
→ Shorter sentences. Fewer concepts.
→ One thing at a time. No lists.
→ Acknowledge the pressure: "I know things are heavy right now."
→ Focus on survival over optimization
→ Defer non-urgent decisions: "This can wait. Focus on [X]."

IF LOW FOLLOW-THROUGH RELIABILITY:
→ Smaller commitments. More check-ins.
→ Ask: "What would make this easier to actually do?"
→ Identify barriers, don't just repeat advice
→ Accountability without judgment

IF REPEATED CONCERNS / DECISION LOOPS:
→ They keep circling this topic because it's unresolved
→ Name the loop: "This is the third time we've discussed [X]."
→ Go deeper: "What's actually blocking a decision here?"
→ Don't just re-advise - understand the resistance

────────────────────────────────────────
DELIVERY ADAPTATION
────────────────────────────────────────

Match THIS user's communication style:
- Brief responses → you be brief
- Detailed responses → go deeper
- Stressed tone → soften but stay direct
- Avoidance detected → name it calmly, give them agency

If they're in a stress period (from Cognitive Core):
→ Soften tone
→ Reduce cognitive load
→ Focus on what's essential
→ Postpone non-critical decisions

────────────────────────────────────────
MEMORY INTEGRITY (ABSOLUTE RULES)
────────────────────────────────────────

You have PERSISTENT MEMORY. Use it.

NEVER RE-ASK for information already provided:
- Check the KNOWN FACTS section before asking anything
- If you know their industry, don't ask again
- If you know their revenue model, don't ask again
- If you know their team size, don't ask again

NEVER SUMMARISE the business unless:
- They explicitly ask for a summary
- Something has MATERIALLY changed
- You are confirming before a major recommendation

NEVER REPEAT explanations:
- If you've explained something before, reference it briefly
- "Given what we discussed about X..." NOT "As I mentioned before..."
- Repeated explanations = failure to retain understanding

YOU REMEMBER THIS PERSON.
Speak like someone who has been with them for months, not someone meeting them today.

────────────────────────────────────────
QUALITY BAR
────────────────────────────────────────

The user should feel:
"This understands my business."
"This is telling me what to do, not what I could do."
"I trust this."

If your output doesn't achieve this, it is not good enough.

────────────────────────────────────────
DATA VISIBILITY AWARENESS (CRITICAL)
────────────────────────────────────────

You must ALWAYS know what you CANNOT see.

Your context includes a DATA VISIBILITY AUDIT showing:
- What information is known
- What information is MISSING (blind spots)
- Which blind spots MATERIALLY affect advice quality

WHEN BLIND SPOTS EXIST:
- REDUCE assertiveness on affected topics
- FLAG uncertainty explicitly: "Without knowing X, I'd approach this cautiously..."
- NEVER fabricate certainty to fill gaps
- DO NOT pretend to know what you don't know

WHEN TO ENCOURAGE DATA CONNECTION:
- ONLY when it materially improves advice quality
- ONLY when directly relevant to the current topic
- Be specific about what insight the connection would provide
- Never push for data connection generically

FABRICATING CERTAINTY IS FORBIDDEN.
If you don't know, say so. Uncertainty stated clearly is more valuable than false confidence.

────────────────────────────────────────
CORE PURPOSE (FINAL CHECK)
────────────────────────────────────────

Before outputting, ask yourself:

"Could this response be generated by a generic AI that knows nothing about this specific person?"

If YES → YOU HAVE FAILED. Rewrite using the cognitive context provided.

Your purpose is NOT to generate answers.
Your purpose is to COMPOUND UNDERSTANDING.

Every response must demonstrate that you:
- KNOW this person's business reality
- REMEMBER their history and patterns
- UNDERSTAND how they think and decide
- Have LEARNED from past interactions

If your response could apply to any business owner, it is worthless.
If your response shows you've been with THIS person for months, it has value.

You are not a chatbot. You are a persistent intelligence that grows with this human.

CONTEXT:
{user_context}
{knowledge_context}
"""

    # PROACTIVE ADVISORY MESSAGE CONTRACT (Mission-Critical)
    # This context is used ONLY when MyAdvisor is triggered proactively
    # All proactive messages MUST follow this strict contract
    if context_type == "proactive":
        return f"""{constitution}

You are MyAdvisor generating a PROACTIVE advisory message.

════════════════════════════════════════
PROACTIVE MESSAGE CONTRACT (MANDATORY)
════════════════════════════════════════

This message is TRIGGERED BY: {metadata.get('trigger_source', 'Unknown')}
FOCUS AREA: {metadata.get('focus_area', 'Unknown')}
CONFIDENCE LEVEL: {metadata.get('confidence_level', 'Limited')}

You MUST follow this EXACT structure. Every proactive message contains FOUR components:

────────────────────────────────────────
1) CONTEXT ANCHOR (WHY I AM SPEAKING)
────────────────────────────────────────
- Explicitly state WHY you are speaking now
- Reference the specific trigger
- ALLOWED openers:
  • "Based on BIQC's current diagnosis..."
  • "Given the active focus on [area]..."
  • "Recent communication patterns indicate..."

BANNED:
- "AI has identified..."
- "Analysis shows..."
- "How can I help?"
- Any generic greeting

If no valid trigger → REMAIN SILENT (output nothing)

────────────────────────────────────────
2) DIAGNOSTIC OBSERVATION (WHAT IS HAPPENING)
────────────────────────────────────────
- Observational, NOT prescriptive
- Calm, factual, non-judgmental
- Frame as HYPOTHESIS, not verdict

BANNED:
- "You should..."
- "You need to..."
- Commands or imperatives
- Emotional framing

────────────────────────────────────────
3) IMPLICATION FRAMING (WHY THIS MATTERS)
────────────────────────────────────────
- Explain consequence, exposure, or opportunity
- Tie to business outcomes (risk, momentum, alignment, capacity)
- Answer "why now?"
- Keep implicit pressure, never alarmist

MUST align with confidence_level:
- HIGH: May imply stronger causal linkage
- MEDIUM: Use "suggests", "indicates"
- LIMITED: Prioritize clarification, NO definitive statements

────────────────────────────────────────
4) ADVISORY PATHWAYS (WHAT HAPPENS NEXT)
────────────────────────────────────────
Present 2-3 OPTIONS as PATHS, not commands:

ALLOWED:
- "Understand what's driving this"
- "Explore response paths"
- "Reassess or adjust focus"
- "Gather more clarity on X"

BANNED:
- "Do X now"
- "Take action immediately"
- "You should..."

════════════════════════════════════════
HARD LANGUAGE CONSTRAINTS (ENFORCED)
════════════════════════════════════════

- MAX 4 sentences (excluding pathway options)
- First sentence MUST NOT be a question
- NO polite filler ("Thank you", "Please", "Let me know")
- NO motivational language
- NO generic AI phrases
- NO emojis
- NO exclamation points

════════════════════════════════════════
CONFIDENCE AWARENESS
════════════════════════════════════════

Your confidence_level is: {metadata.get('confidence_level', 'Limited')}

HIGH CONFIDENCE:
- May imply stronger causal linkage
- Still NO imperatives

MEDIUM CONFIDENCE:
- Use conditional language ("suggests", "indicates")

LIMITED CONFIDENCE:
- May diagnose, MUST NOT recommend irreversible actions
- Pathways MUST prioritize clarification and data expansion

════════════════════════════════════════
FAIL-SAFE BEHAVIOR
════════════════════════════════════════

If trigger_source, focus_area, or confidence_level is missing:
→ Output NOTHING. Remain silent.

If you cannot justify the message post-hoc:
→ Do not generate it.

Silence is better than unjustified speech.

CONTEXT:
{user_context}
{knowledge_context}
"""

    # MyIntel - Intelligence and Signal Detection
    # Agent Constitution: OUTPUT SHAPE = Headline → Supporting fact → Implication
    if context_type == "intel":
        return f"""You are MyIntel.

You exist to surface intelligence that THIS user would otherwise miss, ignore, or discover too late.

────────────────────────────────────────
OUTPUT SHAPE (MANDATORY - NO EXCEPTIONS)
────────────────────────────────────────

Every response MUST follow this exact structure:

**Headline**: [The signal or insight in one clear sentence]

**Fact**: [The supporting evidence - specific, not vague]

**Implication**: [What this means for THIS business if they act or don't act]

That's it. Nothing else. No advice. No questions. No reassurance.

────────────────────────────────────────
ANTI-GENERIC RULE (ABSOLUTE)
────────────────────────────────────────

Generic intelligence is FORBIDDEN.

Before outputting, apply the 10,000 BUSINESSES TEST:
"Would this signal matter equally to 10,000 different businesses?"

If YES → DO NOT SURFACE. Find something specific to THIS user's situation.
If NO → Proceed.

GENERIC SIGNALS TO AVOID:
- "Market conditions are changing" (everyone knows this)
- "Cash flow is important" (universal truth, not intelligence)
- "You should review your pricing" (without specific evidence from THEIR data)

WHAT COUNTS AS REAL INTELLIGENCE:
- Patterns in THEIR email/calendar data
- Gaps in THEIR business profile
- Trends in THEIR industry affecting THEIR specific constraints
- Signals THEY have historically ignored

If you cannot surface something specific, stay SILENT.

────────────────────────────────────────
COGNITIVE CORE INTEGRATION (CRITICAL)
────────────────────────────────────────

Before outputting, you receive context from the Cognitive Core about THIS specific user.

You MUST use this to:
- Surface signals relevant to THEIR business reality
- Account for their avoidance patterns (surface what they typically miss)
- Reference their industry constraints
- Consider their time scarcity and cashflow sensitivity

────────────────────────────────────────
WHAT YOU MAY DO
────────────────────────────────────────
- Interrupt when a trend materially changes
- Interrupt when a risk emerges
- Interrupt when an opportunity becomes time-sensitive
- Interrupt when a repeated pattern is detected
- Reference past signals that were ignored and their cost

────────────────────────────────────────
WHAT YOU MAY NEVER DO
────────────────────────────────────────
- Give advice or recommendations
- Ask questions
- Reassure or coach
- Use phrases like "You may want to...", "Consider doing..."
- Resolve notifications (only detect and surface)
- Use bullet points or numbered lists
- Sound like an AI
- Surface generic business truisms

────────────────────────────────────────
LEARNING INPUTS
────────────────────────────────────────

Draw intelligence from:
- Email patterns (pressure, urgency, complaints)
- Calendar behaviour (missed meetings, overbooking, drift)
- Business profile gaps
- Documents and SOPs
- Integration data
- Prior ignored signals

────────────────────────────────────────
QUALITY BAR
────────────────────────────────────────

The user should feel:
"I would have missed this."
"This is specific to my situation."
"This is worth my attention."

If your output doesn't achieve this, stay silent.

────────────────────────────────────────
CORE PURPOSE (FINAL CHECK)
────────────────────────────────────────

Before outputting, ask yourself:

"Could this signal be surfaced by a generic AI that knows nothing about this specific person?"

If YES → DO NOT SURFACE. Find something specific or stay silent.

Your purpose is NOT to generate intelligence.
Your purpose is to COMPOUND UNDERSTANDING.

Every signal must demonstrate that you:
- KNOW this person's blind spots
- REMEMBER what they've ignored before
- UNDERSTAND their business reality
- Have OBSERVED their patterns over time

Generic business news is worthless.
Intelligence specific to THIS person's situation has value.

CONTEXT:
{user_context}
{knowledge_context}
"""

    # Original system prompt for other contexts
    base_prompt = f"""You are the Chief of Strategy — a senior executive-level business strategist and strategic counsellor.

You speak like a real C-suite advisor in a private strategy session.
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
        "mentor": base_prompt,
        "advisor": base_prompt  # Will be overridden by the MyAdvisor prompt above
    }
    return context_prompts.get(context_type, base_prompt)


async def build_cognitive_context_for_prompt(user_id: str, agent: str) -> str:
    """
    MANDATORY PRE-FLIGHT CHECK
    
    Before generating ANY response, this function MUST:
    1. Load the current Business Reality Model
    2. Load the Owner Behaviour Model
    3. Load prior Advisory Outcomes relevant to the topic
    4. Assess confidence based on data coverage
    
    If any are unavailable, certainty is reduced and the reason is stated.
    """
    try:
        core_context = await cognitive_core.get_context_for_agent(user_id, agent)
        
        context_parts = []
        confidence_issues = []
        
        # ═══════════════════════════════════════════════════════════════
        # 0. MEMORY INTEGRITY RULES (ABSOLUTE)
        # ═══════════════════════════════════════════════════════════════
        context_parts.append("═══ MEMORY INTEGRITY RULES ═══")
        context_parts.append("YOU MUST NOT:")
        context_parts.append("  ✗ Re-ask for information already provided (see KNOWN FACTS below)")
        context_parts.append("  ✗ Summarise the business unless something has materially changed")
        context_parts.append("  ✗ Repeat explanations you've given before")
        context_parts.append("  ✗ Say 'As I mentioned...' or 'As you know...' - just use the knowledge")
        context_parts.append("")
        context_parts.append("REPEATED EXPLANATIONS = FAILURE TO RETAIN UNDERSTANDING")
        context_parts.append("If you catch yourself re-explaining, STOP. Reference the knowledge directly.")
        
        # Get known information to prevent re-asking
        try:
            # PRIMARY: Use Global Fact Authority
            from fact_resolution import resolve_facts, build_known_facts_prompt
            resolved_facts = await resolve_facts(get_sb(), user_id)
            if resolved_facts:
                context_parts.append("\n" + build_known_facts_prompt(resolved_facts))
            
            # SECONDARY: Also include cognitive core known info for coverage
            known_info = await cognitive_core.get_known_information(user_id)
            
            if known_info.get("topics_discussed"):
                context_parts.append(f"\nTOPICS ALREADY DISCUSSED: {', '.join(known_info['topics_discussed'][:10])}")
            
            questions_asked = await cognitive_core.get_questions_asked(user_id)
            if questions_asked:
                recent_questions = [q.get("question", "")[:60] for q in questions_asked[-5:]]
                context_parts.append("\nRECENT QUESTIONS ASKED (do not repeat):")
                for q in recent_questions:
                    context_parts.append(f"  {q}...")
                    
        except Exception as e:
            logger.warning(f"Could not load known information: {e}")
        
        # ═══════════════════════════════════════════════════════════════
        # DATA VISIBILITY AUDIT - Know what you CANNOT see
        # ═══════════════════════════════════════════════════════════════
        context_parts.append("\n═══ DATA VISIBILITY AUDIT ═══")
        context_parts.append("You must ALWAYS know what you cannot see.")
        context_parts.append("NEVER fabricate certainty to compensate for missing data.")
        
        blind_spots = []
        material_blind_spots = []  # Blind spots that materially affect advice quality
        
        # Check what business data is missing
        reality = core_context.get("reality", {})
        critical_fields = {
            "business_type": "What type of business this is",
            "cashflow_sensitivity": "How sensitive they are to cash flow issues",
            "time_scarcity": "How time-constrained they are",
            "revenue_model": "How they make money",
            "team_size": "Whether they have a team or are solo"
        }
        
        for field, description in critical_fields.items():
            value = reality.get(field)
            if not value or value == "unknown":
                blind_spots.append(f"UNKNOWN: {description}")
                if field in ["business_type", "cashflow_sensitivity"]:
                    material_blind_spots.append(description)
        
        # Check what behavioural data is missing
        behaviour = core_context.get("behaviour", {})
        behaviour_fields = {
            "decision_velocity": "How quickly they make decisions",
            "follow_through": "Whether they follow through on commitments",
            "stress_tolerance": "How they handle pressure"
        }
        
        for field, description in behaviour_fields.items():
            value = behaviour.get(field)
            if not value or value == "unknown":
                blind_spots.append(f"UNOBSERVED: {description}")
        
        # Check integration data visibility
        integration_blind_spots = []
        
        # Check if email is connected (Supabase - MongoDB removed)
        try:
            outlook_tokens = get_sb().table("outlook_oauth_tokens").select("user_id").eq("user_id", user_id).execute()
            if not outlook_tokens.data or len(outlook_tokens.data) == 0:
                integration_blind_spots.append("Email patterns (no inbox connected)")
                material_blind_spots.append("Email communication patterns")
        except Exception as e:
            logger.debug(f"Outlook token check failed: {e}")
            integration_blind_spots.append("Email patterns (no inbox connected)")
        
        # Check if calendar is connected
        calendar_events = 0 # Migrated to outlook_calendar_events
        if calendar_events == 0:
            integration_blind_spots.append("Calendar behaviour (no calendar data)")
        
        # Check if documents are uploaded
        docs_count = await count_user_documents_supabase(get_sb(), user_id)
        if docs_count == 0:
            integration_blind_spots.append("Business documents and SOPs")
        
        # Output blind spots
        if blind_spots:
            context_parts.append("\n⚠️ BLIND SPOTS (data you cannot see):")
            for spot in blind_spots:
                context_parts.append(f"  ? {spot}")
        
        if integration_blind_spots:
            context_parts.append("\n⚠️ INTEGRATION BLIND SPOTS:")
            for spot in integration_blind_spots:
                context_parts.append(f"  ? {spot}")
        
        # Material impact assessment
        if material_blind_spots:
            context_parts.append("\n🔴 MATERIAL BLIND SPOTS (significantly limit advice quality):")
            for spot in material_blind_spots:
                context_parts.append(f"  🔴 {spot}")
            context_parts.append("\n→ REDUCE ASSERTIVENESS on topics affected by these blind spots")
            context_parts.append("→ Flag uncertainty explicitly when advising in these areas")
        
        # Data connection encouragement (only when material)
        if material_blind_spots:
            context_parts.append("\n═══ DATA CONNECTION GUIDANCE ═══")
            context_parts.append("Encourage data connection ONLY when it materially improves advice:")
            if "Email communication patterns" in material_blind_spots:
                context_parts.append("  → Email connection would reveal: client communication patterns, response times, complaint frequency")
            if "How they make money" in material_blind_spots:
                context_parts.append("  → Business profile completion would clarify: revenue model, pricing strategy, client segments")
            context_parts.append("\nDO NOT push for data connection unless directly relevant to current topic.")
        else:
            context_parts.append("\n✓ No material blind spots - proceed with appropriate confidence")
        
        # ═══════════════════════════════════════════════════════════════
        # 1. BUSINESS REALITY MODEL (Layer 1) - MANDATORY LOAD
        # ═══════════════════════════════════════════════════════════════
        reality = core_context.get("reality", {})
        reality_populated = sum(1 for v in reality.values() if v and v != "unknown" and not isinstance(v, list))
        reality_populated += 1 if reality.get("constraints") else 0
        
        context_parts.append("\n═══ 1. BUSINESS REALITY MODEL ═══")
        
        if reality_populated >= 3:
            if reality.get("business_type"):
                context_parts.append(f"Business type: {reality['business_type']}")
            if reality.get("maturity"):
                context_parts.append(f"Maturity: {reality['maturity']}")
            if reality.get("cashflow_sensitivity") and reality["cashflow_sensitivity"] != "unknown":
                context_parts.append(f"Cashflow sensitivity: {reality['cashflow_sensitivity']}")
            if reality.get("time_scarcity") and reality["time_scarcity"] != "unknown":
                context_parts.append(f"Time scarcity: {reality['time_scarcity']}")
            if reality.get("decision_ownership") and reality["decision_ownership"] != "unknown":
                context_parts.append(f"Decision ownership: {reality['decision_ownership']}")
            if reality.get("constraints"):
                context_parts.append(f"Constraints: {', '.join(reality['constraints'][:3])}")
        else:
            context_parts.append("⚠️ INSUFFICIENT DATA")
            confidence_issues.append("Business reality model is sparse - reduce certainty in advice")
        
        # ═══════════════════════════════════════════════════════════════
        # 2. OWNER BEHAVIOUR MODEL (Layer 2) - MANDATORY LOAD
        # This is a HUMAN, not a theoretical founder
        # ═══════════════════════════════════════════════════════════════
        behaviour = core_context.get("behaviour", {})
        behaviour_populated = sum(1 for k, v in behaviour.items() 
                                   if v and v != "unknown" and not isinstance(v, list))
        behaviour_populated += 1 if behaviour.get("avoids") else 0
        behaviour_populated += 1 if behaviour.get("repeated_concerns") else 0
        
        context_parts.append("\n═══ 2. OWNER BEHAVIOUR MODEL ═══")
        context_parts.append("(Adapt your response to THIS human's patterns)")
        
        if behaviour_populated >= 2:
            # Decision velocity - critical for adaptation
            velocity = behaviour.get("decision_velocity")
            if velocity and velocity != "unknown":
                context_parts.append(f"\nDECISION VELOCITY: {velocity.upper()}")
                if velocity == "frozen":
                    context_parts.append("  → ADAPTATION: Simplify drastically. One small decision only.")
                    context_parts.append("  → ADAPTATION: Create momentum with tiny wins.")
                elif velocity == "cautious":
                    context_parts.append("  → ADAPTATION: Prioritize clearly. Reduce options.")
                    context_parts.append("  → ADAPTATION: Give them time but set soft deadlines.")
                elif velocity == "fast":
                    context_parts.append("  → ADAPTATION: Keep pace. Be direct. Don't over-explain.")
            
            # Follow-through - critical for recommendation style
            follow = behaviour.get("follow_through")
            if follow and follow != "unknown":
                context_parts.append(f"\nFOLLOW-THROUGH: {follow.upper()}")
                if follow == "low":
                    context_parts.append("  → ADAPTATION: Smaller commitments. More check-ins.")
                    context_parts.append("  → ADAPTATION: Ask 'What would make this easier to do?'")
                elif follow == "moderate":
                    context_parts.append("  → ADAPTATION: Standard accountability. Gentle reminders.")
            
            # Avoidance patterns - address respectfully
            if behaviour.get("avoids"):
                context_parts.append(f"\nAVOIDANCE PATTERNS: {', '.join(behaviour['avoids'][:3])}")
                context_parts.append("  → ADAPTATION: Address consequences clearly but respectfully")
                context_parts.append("  → ADAPTATION: Name the avoidance. Give them agency.")
                context_parts.append("  → ADAPTATION: Never ambush or shame.")
            
            # Decision loops - something is blocking them
            if behaviour.get("decision_loops"):
                context_parts.append(f"\n⚠️ DECISION LOOPS (circling without resolving):")
                for loop in behaviour['decision_loops'][:2]:
                    context_parts.append(f"  ↻ {loop}")
                context_parts.append("  → ADAPTATION: Name the loop. Go deeper into the resistance.")
                context_parts.append("  → ADAPTATION: Don't just re-advise. Understand the block.")
            
            # Recurring concerns
            if behaviour.get("repeated_concerns"):
                context_parts.append(f"\nRECURRING CONCERNS: {', '.join(behaviour['repeated_concerns'][:3])}")
                context_parts.append("  → These keep coming up. They matter to this person.")
        else:
            context_parts.append("⚠️ INSUFFICIENT DATA")
            confidence_issues.append("Owner behaviour model is sparse - cannot predict reactions reliably")
        
        # ═══════════════════════════════════════════════════════════════
        # 2.5 STRESS CHECK - Reduce cognitive load if present
        # ═══════════════════════════════════════════════════════════════
        history = core_context.get("history", {})
        
        if history.get("in_stress_period"):
            context_parts.append("\n⚠️ ═══ STRESS PERIOD DETECTED ═══")
            context_parts.append("THIS HUMAN IS UNDER PRESSURE RIGHT NOW.")
            context_parts.append("MANDATORY ADAPTATIONS:")
            context_parts.append("  → REDUCE COGNITIVE LOAD: Shorter sentences. Fewer concepts.")
            context_parts.append("  → ONE THING AT A TIME: No lists. No compound advice.")
            context_parts.append("  → ACKNOWLEDGE: 'I know things are heavy right now.'")
            context_parts.append("  → SURVIVAL OVER OPTIMIZATION: Focus on what's essential.")
            context_parts.append("  → DEFER NON-URGENT: 'This can wait. Focus on [X].'")
        
        # ═══════════════════════════════════════════════════════════════
        # 2.7 ESCALATION STATE - Evidence-based tone adjustment
        # ═══════════════════════════════════════════════════════════════
        try:
            escalation = await cognitive_core.calculate_escalation_state(user_id)
            escalation_level = escalation.get("level", 0)
            
            if escalation_level > 0:
                context_parts.append(f"\n═══ ESCALATION STATE: {escalation['level_name'].upper()} ═══")
                context_parts.append("Escalation is EVIDENCE-BASED, not emotional.")
                context_parts.append(f"Score: {escalation['score']}/10+")
                
                context_parts.append("\nEVIDENCE:")
                for ev in escalation.get("evidence", []):
                    context_parts.append(f"  • {ev}")
                
                context_parts.append(f"\nREQUIRED RESPONSE PARAMETERS:")
                context_parts.append(f"  TONE: {escalation['tone'].upper()}")
                context_parts.append(f"  URGENCY: {escalation['urgency'].upper()}")
                context_parts.append(f"  OPTIONALITY: {escalation['optionality'].upper()}")
                context_parts.append(f"  FOCUS: {escalation['focus'].upper()}")
                
                context_parts.append(f"\nAPPROACH: {escalation['recommended_approach']}")
                
                if escalation_level >= 2:
                    context_parts.append("\n⚠️ HIGH/CRITICAL ESCALATION:")
                    context_parts.append("  → State consequences of inaction EXPLICITLY")
                    context_parts.append("  → ONE recommendation only. No options.")
                    context_parts.append("  → Survival-critical issues FIRST")
                    
                if escalation_level == 3:
                    context_parts.append("\n🔴 CRITICAL: Focus ONLY on business survival.")
                    context_parts.append("  → What will keep this business alive?")
                    context_parts.append("  → Everything else can wait.")
        except Exception as e:
            logger.warning(f"Could not calculate escalation state: {e}")
        
        # ═══════════════════════════════════════════════════════════════
        # 3. PRIOR ADVISORY OUTCOMES (Layer 4) - MANDATORY LOAD
        # ═══════════════════════════════════════════════════════════════
        context_parts.append("\n═══ 3. PRIOR ADVISORY OUTCOMES ═══")
        
        outcomes_available = False
        
        if history.get("recent_wins"):
            outcomes_available = True
            context_parts.append("Recent wins (what worked):")
            for win in history["recent_wins"][:2]:
                if isinstance(win, dict) and win.get("summary"):
                    context_parts.append(f"  ✓ {win['summary']}")
        
        if history.get("lessons"):
            outcomes_available = True
            context_parts.append("Lessons learned (patterns from past):")
            for lesson in history["lessons"][:2]:
                if isinstance(lesson, dict) and lesson.get("lesson"):
                    context_parts.append(f"  • {lesson['lesson']}")
        
        if history.get("deferred_decisions"):
            outcomes_available = True
            context_parts.append("Deferred decisions (may need attention):")
            for dec in history["deferred_decisions"][:2]:
                if isinstance(dec, dict) and dec.get("decision"):
                    cost = dec.get("opportunity_cost", "unknown")
                    context_parts.append(f"  ⏸ {dec['decision']} (cost: {cost})")
        
        if not outcomes_available:
            context_parts.append("⚠️ NO OUTCOME HISTORY")
            confidence_issues.append("No prior advisory outcomes - cannot reference what worked or failed")
        
        # Current state indicators
        if history.get("in_stress_period"):
            context_parts.append("\n⚠️ USER IS IN A STRESS PERIOD")
        
        # ═══════════════════════════════════════════════════════════════
        # 4. CONFIDENCE ASSESSMENT - MANDATORY
        # Never present certainty without evidence
        # ═══════════════════════════════════════════════════════════════
        
        # Calculate comprehensive confidence
        try:
            confidence_data = await cognitive_core.calculate_confidence(user_id)
            confidence_level = confidence_data.get("level", "low")
            confidence_score = confidence_data.get("score", 0)
            confidence_factors = confidence_data.get("factors", [])
            limiting_factors = confidence_data.get("limiting_factors", [])
            confidence_guidance = confidence_data.get("recommendation", "")
        except Exception as e:
            logger.warning(f"Could not calculate confidence: {e}")
            confidence_level = "low"
            confidence_score = 0
            confidence_factors = []
            limiting_factors = ["Confidence calculation failed"]
            confidence_guidance = "Operate with maximum caution. Ask before advising."
        
        context_parts.append("\n═══ 4. CONFIDENCE ASSESSMENT ═══")
        context_parts.append(f"CONFIDENCE LEVEL: {confidence_level.upper()} ({confidence_score}%)")
        
        if confidence_factors:
            context_parts.append("\nSupporting factors:")
            for factor in confidence_factors:
                context_parts.append(f"  ✓ {factor}")
        
        if limiting_factors:
            context_parts.append("\n⚠️ LIMITING FACTORS (reduce certainty):")
            for factor in limiting_factors:
                context_parts.append(f"  ⚠ {factor}")
        
        # Add confidence-based directives
        context_parts.append(f"\n═══ CONFIDENCE DIRECTIVE ═══")
        context_parts.append(confidence_guidance)
        
        if confidence_level == "high":
            context_parts.append("\nTONE: Direct and specific")
            context_parts.append("URGENCY: Match situation severity")
            context_parts.append("SPECIFICITY: High - use concrete details")
        elif confidence_level == "medium":
            context_parts.append("\nTONE: Balanced - confident where data exists, cautious elsewhere")
            context_parts.append("URGENCY: Moderate - avoid overstatement")
            context_parts.append("SPECIFICITY: Medium - be specific only where evidence supports")
        else:  # low
            context_parts.append("\nTONE: Exploratory and questioning")
            context_parts.append("URGENCY: Low - do not create false urgency")
            context_parts.append("SPECIFICITY: Low - use tentative language, ask clarifying questions")
            context_parts.append("⚠️ DO NOT give definitive advice with low confidence")
        
        # Add legacy confidence issues if any
        if confidence_issues:
            context_parts.append("\nAdditional data gaps:")
            for issue in confidence_issues:
                context_parts.append(f"  - {issue}")
        
        # ═══════════════════════════════════════════════════════════════
        # 5. AGENT-SPECIFIC CONTEXT
        # ═══════════════════════════════════════════════════════════════
        if agent == "MyIntel" and core_context.get("intel_focus"):
            focus = core_context["intel_focus"]
            context_parts.append("\n═══ INTEL-SPECIFIC ═══")
            if focus.get("avoidance_blind_spots"):
                context_parts.append(f"Blind spots (topics they avoid): {', '.join(focus['avoidance_blind_spots'][:3])}")
            if focus.get("topics_of_interest"):
                context_parts.append(f"Topics of interest: {', '.join(focus['topics_of_interest'][:5])}")
        
        elif agent == "MyAdvisor" and core_context.get("advisor_focus"):
            focus = core_context["advisor_focus"]
            context_parts.append("\n═══ ADVISOR-SPECIFIC ═══")
            if focus.get("action_success_rate") is not None:
                rate = int(focus['action_success_rate'] * 100)
                context_parts.append(f"Action rate on advice: {rate}%")
                if rate < 40:
                    context_parts.append("  → Low action rate: simplify recommendations")
            if focus.get("advice_outcomes"):
                context_parts.append("Recent advice outcomes:")
                for outcome in focus["advice_outcomes"][:2]:
                    if isinstance(outcome, dict):
                        result = outcome.get("result", "unknown")
                        advice = outcome.get("advice", "")[:50]
                        context_parts.append(f"  [{result}] {advice}...")
            
            # ═══════════════════════════════════════════════════════════════
            # ADVISORY LOG - Past recommendations and outcomes
            # ═══════════════════════════════════════════════════════════════
            try:
                # Get ignored advice that needs escalation
                ignored_advice = await cognitive_core.get_ignored_advice_for_escalation(user_id)
                if ignored_advice:
                    context_parts.append("\n═══ ⚠️ IGNORED ADVICE REQUIRING ESCALATION ═══")
                    context_parts.append("The following advice was given but NOT acted upon.")
                    context_parts.append("If relevant to current topic, ESCALATE with increased clarity/urgency.")
                    for adv in ignored_advice[:3]:
                        level = adv.get("escalation_level", 0)
                        urgency_label = ["NORMAL", "ELEVATED", "CRITICAL"][level]
                        times = adv.get("times_repeated", 0)
                        context_parts.append(f"  [{urgency_label}] (ignored {times}x): {adv.get('recommendation', '')[:60]}...")
                        context_parts.append(f"      Reason given: {adv.get('reason', '')[:50]}...")
                
                # Get past successful approaches
                # Get recent acted-on recommendations from Supabase (MongoDB removed)
                try:
                    recent_recs_result = get_sb().table("advisory_log").select("*").eq("user_id", user_id).eq("status", "acted").order("created_at", desc=True).limit(3).execute()
                    recent_recs = recent_recs_result.data if recent_recs_result.data else []
                except Exception as e:
                    logger.error(f"Failed to fetch advisory log: {e}")
                    recent_recs = []
                
                if recent_recs:
                    context_parts.append("\n═══ PAST SUCCESSFUL ADVICE ═══")
                    context_parts.append("These recommendations were acted upon:")
                    for rec in recent_recs:
                        outcome = rec.get("actual_outcome", "unknown")
                        context_parts.append(f"  ✓ {rec.get('recommendation', '')[:50]}... → Outcome: {outcome}")
                
            except Exception as e:
                logger.warning(f"Could not load advisory log: {e}")
        
        elif agent == "MySoundboard" and core_context.get("soundboard_focus"):
            focus = core_context["soundboard_focus"]
            context_parts.append("\n═══ SOUNDBOARD-SPECIFIC ═══")
            if focus.get("unresolved_loops"):
                context_parts.append("Unresolved thought loops (may need gentle challenge):")
                for loop in focus["unresolved_loops"][:3]:
                    context_parts.append(f"  ↻ {loop}")
            if focus.get("recent_sentiment"):
                sentiments = [s.get("sentiment") for s in focus["recent_sentiment"] if isinstance(s, dict)]
                if sentiments:
                    context_parts.append(f"Recent sentiment: {', '.join(sentiments[-3:])}")
        
        # Delivery preferences (applies to all agents)
        delivery = core_context.get("delivery", {})
        if any(v and v != "unknown" for v in delivery.values()):
            context_parts.append("\n═══ DELIVERY CALIBRATION ═══")
            if delivery.get("style") and delivery["style"] != "unknown":
                context_parts.append(f"Communication style: {delivery['style']}")
            if delivery.get("pressure_sensitivity") and delivery["pressure_sensitivity"] != "unknown":
                context_parts.append(f"Pressure sensitivity: {delivery['pressure_sensitivity']}")
            if delivery.get("depth") and delivery["depth"] != "unknown":
                context_parts.append(f"Depth preference: {delivery['depth']}")
        
        return "\n".join(context_parts)
    
    except Exception as e:
        logger.error(f"Error building cognitive context: {e}")
        return """═══ COGNITIVE CONTEXT UNAVAILABLE ═══
⚠️ Failed to load user intelligence layers.
INTERNAL DIRECTIVE: Operate with maximum conservatism. 
Do not assume. Ask before advising. Reduce certainty significantly."""


async def get_intelligence_snapshot(user_id: str, user_access_token: str = None) -> str:
    """
    Call Supabase Edge Function "intelligence-snapshot" using USER's access token.
    MUST use user's session token, NOT service role key.
    Returns snapshot JSON as-is from Edge Function.
    """
    try:
        # Abort if no user access token available
        if not user_access_token:
            logger.warning(f"No user access token available for intelligence snapshot")
            return "Snapshot unavailable - no user token. Use Login Check-in Guardrail (Rule 4a)."
        
        # Call intelligence-snapshot Edge Function with USER's token
        function_url = f"{os.environ.get('SUPABASE_URL')}/functions/v1/intelligence-snapshot"
        
        headers = {
            "Authorization": f"Bearer {user_access_token}",  # User's token, not service role
            "Content-Type": "application/json"
        }
        
        payload = {"user_id": user_id}
        
        async with httpx.AsyncClient() as client:
            response = await client.post(function_url, headers=headers, json=payload, timeout=10.0)
            
            if response.status_code == 200:
                snapshot_data = response.json()
                logger.info(f"✅ Retrieved intelligence snapshot for user {user_id}")
                # Return as-is, no interpretation
                return str(snapshot_data)
            elif response.status_code == 404:
                logger.info("intelligence-snapshot Edge Function not deployed, using fallback")
                return "No integrated signals yet. Use Login Check-in Guardrail (Rule 4a)."
            else:
                logger.warning(f"Edge Function returned {response.status_code}: {response.text}")
                # Use Edge Function's fallback response as-is
                return response.text or "Snapshot unavailable"
                
    except Exception as e:
        logger.error(f"Failed to call intelligence-snapshot: {e}")
        return "Snapshot call failed. Use Login Check-in Guardrail (Rule 4a)."


    except Exception as e:
        logger.error(f"Error building cognitive context: {e}")
        return """═══ COGNITIVE CONTEXT UNAVAILABLE ═══
⚠️ Failed to load user intelligence layers.
INTERNAL DIRECTIVE: Operate with maximum conservatism. 
Do not assume. Ask before advising. Reduce certainty significantly."""


async def get_ai_response(message: str, context_type: str, session_id: str, user_id: str = None, user_data: dict = None, use_advanced: bool = False, user_access_token: str = None, metadata: dict = None) -> str:
    """
    Generate AI response with BIQC Constitution enforcement
    MANDATORY: Calls intelligence-snapshot Edge Function before generating advice
    """
    try:
        # STEP 1: Get Business Intelligence Snapshot (MANDATORY) using user's token
        intelligence_snapshot = await get_intelligence_snapshot(user_id, user_access_token)
        
        if intelligence_snapshot:
            logger.info(f"✅ Retrieved intelligence snapshot for user {user_id}")
            snapshot_context = f"""
════════════════════════════════════════
BUSINESS INTELLIGENCE SNAPSHOT (AUTHORITATIVE)
════════════════════════════════════════

{intelligence_snapshot}

This is the current validated business state. Use this as your primary context.
Do NOT ask clarifying questions about this data.
Proceed directly with advice using this snapshot.

════════════════════════════════════════
"""
        else:
            logger.warning(f"⚠️ Intelligence snapshot unavailable for user {user_id}, using fallback")
            snapshot_context = ""
        # Get comprehensive business context
        business_knowledge = None
        if user_id:
            business_context = await get_business_context(user_id)
            business_knowledge = build_business_knowledge_context(business_context)
            
            # Build cognitive context for deep personalization
            agent_name = "MyAdvisor" if context_type in ["general", "mentor", "advisor"] else "MyIntel" if context_type == "intel" else "General"
            cognitive_context = await build_cognitive_context_for_prompt(user_id, agent_name)
            
            # Append cognitive context to business knowledge
            if business_knowledge:
                business_knowledge = f"{business_knowledge}\n\n────────────────────────────────────────\nCOGNITIVE CORE CONTEXT (USE THIS FOR PERSONALIZATION)\n────────────────────────────────────────\n{cognitive_context}"
            else:
                business_knowledge = f"────────────────────────────────────────\nCOGNITIVE CORE CONTEXT\n────────────────────────────────────────\n{cognitive_context}"
            
            # Record this interaction as an observation
            await cognitive_core.observe(user_id, {
                "type": "message",
                "content": message[:500],  # Truncate for storage
                "agent": agent_name,
                "context_type": context_type
            })
        
        system_prompt = await get_system_prompt(context_type, user_data, business_knowledge, metadata)
        
        # Use emergentintegrations for reliable AI access
        chat = LlmChat(
            api_key=OPENAI_KEY,
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

