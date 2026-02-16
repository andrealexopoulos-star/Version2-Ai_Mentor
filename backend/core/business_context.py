"""
Business Context — Functions for building personalized business context for AI responses.
Extracted from ai_core.py for modularity.
"""
import logging
from routes.deps import get_sb
from auth_supabase import get_user_by_id
from supabase_intelligence_helpers import (
    get_business_profile_supabase,
    get_user_data_files_supabase,
)

logger = logging.getLogger(__name__)


async def get_business_context(user_id: str) -> dict:
    """Get comprehensive business context for AI personalization"""
    profile = await get_business_profile_supabase(get_sb(), user_id)
    data_files_list = await get_user_data_files_supabase(get_sb(), user_id)
    data_files = [
        {
            "filename": f.get("filename"),
            "category": f.get("category"),
            "description": f.get("description"),
            "extracted_text": f.get("extracted_text")
        }
        for f in (data_files_list or [])[:20]
    ]
    user = await get_user_by_id(user_id)
    return {"user": user, "profile": profile, "data_files": data_files}


def build_business_knowledge_context(business_context: dict) -> str:
    """Build a comprehensive knowledge context from business data"""
    context_parts = []
    user = business_context.get("user", {})
    profile = business_context.get("profile", {})
    data_files = business_context.get("data_files", [])

    if user:
        context_parts.append(f"## Business Owner: {user.get('name', 'Unknown')}")
        if user.get('business_name'):
            context_parts.append(f"## Business Name: {user.get('business_name')}")
        if user.get('industry'):
            context_parts.append(f"## Industry: {user.get('industry')}")

    if profile:
        context_parts.append("\n## DETAILED BUSINESS PROFILE:")
        _append_profile_section(context_parts, profile, "Basic Info", {
            'business_type': 'Business Type', 'abn': 'ABN', 'acn': 'ACN',
            'target_country': 'Target Country', 'year_founded': 'Year Founded',
            'location': 'Location', 'website': 'Website',
        })
        _append_profile_section(context_parts, profile, "Size & Financials", {
            'employee_count': 'Employee Count', 'annual_revenue': 'Annual Revenue',
            'monthly_expenses': 'Monthly Expenses', 'profit_margin': 'Profit Margin',
            'funding_stage': 'Funding Stage',
        })
        context_parts.append("\n### Market & Customers:")
        for field, label in {
            'target_market': 'Target Market', 'ideal_customer_profile': 'Ideal Customer',
            'geographic_focus': 'Geographic Focus', 'average_customer_value': 'Average Customer Value',
            'customer_retention_rate': 'Retention Rate (legacy)',
            'retention_rate_range': 'Retention Rate Range', 'retention_rag': 'Retention Score',
        }.items():
            val = profile.get(field)
            if val:
                context_parts.append(f"- {label}: {val.upper() if field == 'retention_rag' else val}")
        for field, label in {'customer_segments': 'Customer Segments', 'customer_acquisition_channels': 'Acquisition Channels'}.items():
            val = profile.get(field)
            if val:
                context_parts.append(f"- {label}: {', '.join(val)}")
        if profile.get('retention_known') is not None:
            context_parts.append(f"- Retention Known: {profile.get('retention_known')}")

        _append_profile_section(context_parts, profile, "Products & Services", {
            'main_products_services': 'Products/Services', 'pricing_model': 'Pricing Model',
            'unique_value_proposition': 'Unique Value Proposition',
            'competitive_advantages': 'Competitive Advantages',
        })
        _append_profile_section(context_parts, profile, "Operations", {
            'business_model': 'Business Model', 'sales_cycle_length': 'Sales Cycle',
            'key_processes': 'Key Processes', 'bottlenecks': 'Known Bottlenecks',
        })
        _append_profile_section(context_parts, profile, "Team & Leadership", {
            'founder_background': 'Founder Background', 'key_team_members': 'Key Team',
            'team_strengths': 'Team Strengths', 'team_gaps': 'Team Gaps',
            'company_culture': 'Company Culture',
        })
        context_parts.append("\n### Strategy & Vision:")
        for field, label in {
            'mission_statement': 'Mission', 'vision_statement': 'Vision',
            'short_term_goals': 'Short-term Goals (6-12mo)',
            'long_term_goals': 'Long-term Goals (2-5yr)',
            'main_challenges': 'Main Challenges', 'growth_strategy': 'Growth Strategy',
        }.items():
            if profile.get(field):
                context_parts.append(f"- {label}: {profile[field]}")
        if profile.get('core_values'):
            context_parts.append(f"- Core Values: {', '.join(profile['core_values'])}")

        if profile.get('tools_used') or profile.get('tech_stack'):
            context_parts.append("\n### Tools & Technology:")
            for field, label in {'tools_used': 'Tools Used', 'tech_stack': 'Tech Stack',
                                  'crm_system': 'CRM', 'accounting_system': 'Accounting'}.items():
                val = profile.get(field)
                if val:
                    context_parts.append(f"- {label}: {', '.join(val) if isinstance(val, list) else val}")

        context_parts.append("\n### Owner's Preferences (Use these to tailor your communication):")
        for field, label in {
            'communication_style': 'Communication Style', 'decision_making_style': 'Decision Making',
            'risk_tolerance': 'Risk Tolerance', 'time_availability': 'Time for Strategy',
            'preferred_advice_format': 'Preferred Advice Format',
        }.items():
            if profile.get(field):
                context_parts.append(f"- {label}: {profile[field]}")

    if data_files:
        context_parts.append("\n## BUSINESS DOCUMENTS & DATA:")
        for file in data_files[:10]:
            context_parts.append(f"\n### Document: {file.get('filename')} ({file.get('category', 'General')})")
            if file.get('description'):
                context_parts.append(f"Description: {file['description']}")
            if file.get('extracted_text'):
                context_parts.append(f"Content Preview:\n{file['extracted_text'][:2000]}")

    return "\n".join(context_parts)


def _append_profile_section(parts, profile, title, fields):
    """Helper to append a profile section with non-empty fields."""
    parts.append(f"\n### {title}:")
    for field, label in fields.items():
        if profile.get(field):
            parts.append(f"- {label}: {profile[field]}")
