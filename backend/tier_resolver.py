"""BIQc Central Tier Resolver — SINGLE SOURCE OF TRUTH.

ALL tier checks in the entire platform MUST go through this file.
No scattered tier logic allowed anywhere else.

Responsibilities:
- Tier resolution from database
- Super admin override (email-based, immutable)
- Route access mapping
- Feature gating mapping
- Usage limit enforcement
"""
import logging
from typing import Optional
from functools import lru_cache

logger = logging.getLogger(__name__)

# ═══ SUPER ADMIN — IMMUTABLE, EMAIL-BASED ═══
SUPER_ADMIN_EMAIL = "andre@thestrategysquad.com.au"

# ═══ TIER DEFINITIONS ═══
TIERS = ['free', 'starter', 'professional', 'enterprise', 'custom', 'super_admin']

BRAIN_METRIC_LIMITS = {
    'free': 10,
    'starter': 25,
    'professional': 50,
    'enterprise': 75,
    'custom': 100,
    'super_admin': 100,
}

BRAIN_PLAN_LABELS = {
    'free': 'Free',
    'starter': 'Foundation',
    'professional': 'Performance',
    'enterprise': 'SMB Protect',
    'custom': 'Custom',
    'super_admin': 'Custom',
}

# ═══ ROUTE ACCESS MAP ═══
# Route pattern → minimum tier required
# 'free' = available to all, 'starter' = paid, 'super_admin' = admin only
ROUTE_ACCESS = {
    # FREE TIER — allowed
    '/advisor': 'free',              # BIQc Overview (Market tab only gated separately)
    '/market': 'free',               # Market tab (sub-gating inside)
    '/business-profile': 'free',     # Business DNA
    '/forensic-audit': 'free',       # Ingestion audit (1/month limit)
    '/knowledge-base': 'free',       # Public
    '/settings': 'free',             # Account settings
    '/integrations': 'free',         # Connect integrations
    '/connect-email': 'free',        # Email integration
    '/data-health': 'free',          # Data health check
    '/competitive-benchmark': 'free',
    '/calibration': 'free',          # Onboarding calibration
    '/onboarding': 'free',
    '/onboarding-decision': 'free',
    '/profile-import': 'free',

    # PAID TIER — requires starter or above
    '/revenue': 'starter',
    '/operations': 'starter',
    '/risk': 'starter',
    '/compliance': 'starter',
    '/reports': 'starter',
    '/audit-log': 'starter',
    '/soundboard': 'free',
    '/war-room': 'starter',
    '/board-room': 'starter',
    '/sop-generator': 'starter',
    '/alerts': 'free',
    '/actions': 'free',
    '/automations': 'starter',
    '/email-inbox': 'free',
    '/calendar': 'free',
    '/analysis': 'starter',
    '/diagnosis': 'starter',
    '/documents': 'starter',
    '/data-center': 'starter',
    '/intelligence-baseline': 'starter',
    '/intel-centre': 'starter',
    '/watchtower': 'starter',
    '/operator': 'starter',

    # ADMIN — super admin only
    '/admin': 'super_admin',
    '/auth-debug': 'super_admin',
    '/prompt-lab': 'super_admin',
}

# ═══ API ACCESS MAP ═══
# API route prefix → minimum tier
API_ACCESS = {
    # FREE
    '/snapshot/latest': 'free',
    '/business-profile': 'free',
    '/integrations': 'free',
    '/intelligence/integration-status': 'free',
    '/intelligence/completeness': 'free',
    '/intelligence/readiness': 'free',
    '/calibration': 'free',
    '/onboarding': 'free',
    '/auth': 'free',
    '/health': 'free',
    '/warmup': 'free',
    '/ingestion': 'free',           # Gated by counter, not tier
    '/forensic': 'free',            # Gated by counter
    '/market-intelligence': 'free',
    '/brain/priorities': 'free',
    '/brain/metrics': 'free',
    '/brain/concerns': 'starter',

    # PAID
    '/revenue': 'starter',
    '/snapshot/generate': 'free',    # Gated by counter (3/month)
    '/intelligence/workforce': 'starter',
    '/intelligence/scenarios': 'starter',
    '/intelligence/scores': 'starter',
    '/intelligence/concentration': 'starter',
    '/intelligence/contradictions': 'starter',
    '/intelligence/pressure': 'free',
    '/intelligence/freshness': 'free',
    '/intelligence/silence': 'starter',
    '/intelligence/escalations': 'starter',
    '/intelligence/watchtower': 'free',
    '/intelligence/summary': 'starter',
    '/intelligence/governance-summary': 'starter',
    '/reports': 'starter',
    '/soundboard': 'free',
    '/boardroom': 'starter',
    '/strategic-console': 'starter',
    '/generate': 'starter',
    '/cognitive': 'starter',
    '/advisory': 'starter',
    '/watchtower': 'starter',
    '/emission': 'starter',
    '/email/priority-inbox': 'free',
    '/email/analyze': 'free',
    '/email/suggest': 'free',
    '/notifications/alerts': 'free',
    '/outlook': 'free',
    '/workflows': 'free',

    # ADMIN
    '/admin': 'super_admin',
}

# ═══ MARKET SUB-FEATURES GATING ═══
MARKET_SUB_FEATURES = {
    'intelligence': 'free',     # Focus tab — allowed
    'saturation': 'free',       # Saturation tab — free
    'demand': 'free',           # Demand tab — free
    'friction': 'free',         # Friction tab — free
    'reports': 'free',          # Reports tab — allowed
}

# ═══ EMAIL CATEGORIES ═══
FREE_EMAIL_CATEGORIES = ['lead', 'marketing', 'inquiry', 'campaign', 'general']
PAID_EMAIL_CATEGORIES = ['financial', 'churn', 'risk', 'operational', 'escalation']


def resolve_tier(user: dict) -> str:
    """Resolve user's effective tier. Super admin override is immutable."""
    email = (user.get('email') or '').lower().strip()

    # SUPER ADMIN OVERRIDE — cannot be restricted
    if email == SUPER_ADMIN_EMAIL.lower():
        return 'super_admin'

    # Database tier
    db_tier = (user.get('subscription_tier') or 'free').lower().strip()
    if db_tier in TIERS:
        return db_tier

    return 'free'


def tier_rank(tier: str) -> int:
    """Numeric rank for tier comparison."""
    ranks = {'free': 0, 'starter': 1, 'professional': 2, 'enterprise': 3, 'custom': 4, 'super_admin': 99}
    return ranks.get(tier, 0)


def has_access(user_tier: str, required_tier: str) -> bool:
    """Check if user tier meets required tier."""
    return tier_rank(user_tier) >= tier_rank(required_tier)


def check_route_access(route: str, user: dict) -> dict:
    """Check if user can access a frontend route."""
    tier = resolve_tier(user)

    # Find matching route
    required = None
    for pattern, req_tier in ROUTE_ACCESS.items():
        if route == pattern or route.startswith(pattern + '/'):
            required = req_tier
            break

    if required is None:
        # Unknown route — allow (public pages, etc.)
        return {'allowed': True, 'tier': tier, 'route': route}

    if has_access(tier, required):
        return {'allowed': True, 'tier': tier, 'route': route}

    return {
        'allowed': False,
        'tier': tier,
        'required_tier': required,
        'route': route,
        'redirect': f'/subscribe?from={route}',
        'error': 'subscription_required',
    }


def check_api_access(api_path: str, user: dict) -> dict:
    """Check if user can access an API endpoint."""
    tier = resolve_tier(user)

    # Find matching API pattern
    required = None
    for pattern, req_tier in sorted(API_ACCESS.items(), key=lambda x: -len(x[0])):
        if api_path.startswith(pattern):
            required = req_tier
            break

    if required is None:
        return {'allowed': True, 'tier': tier}

    if has_access(tier, required):
        return {'allowed': True, 'tier': tier}

    return {
        'allowed': False,
        'tier': tier,
        'required_tier': required,
        'error': 'subscription_required',
        'redirect': '/subscribe',
    }


def check_market_sub_feature(feature: str, user: dict) -> dict:
    """Check if user can access a Market sub-tab."""
    tier = resolve_tier(user)
    required = MARKET_SUB_FEATURES.get(feature, 'starter')

    if has_access(tier, required):
        return {'allowed': True, 'tier': tier}

    return {
        'allowed': False,
        'tier': tier,
        'required_tier': required,
        'redirect': '/subscribe?from=/market',
    }


def filter_email_categories(user: dict) -> list:
    """Return allowed email categories for user's tier."""
    tier = resolve_tier(user)
    if has_access(tier, 'starter'):
        return FREE_EMAIL_CATEGORIES + PAID_EMAIL_CATEGORIES
    return FREE_EMAIL_CATEGORIES


def get_usage_limits(tier: str) -> dict:
    """Get monthly usage limits for tier."""
    if tier == 'super_admin':
        return {'snapshots': 999, 'audits': 999}
    if tier == 'free':
        return {'snapshots': 3, 'audits': 1}
    if tier == 'starter':
        return {'snapshots': 20, 'audits': 10}
    return {'snapshots': 999, 'audits': 999}


def get_brain_metric_limit(user_or_tier) -> int:
    """Return the maximum visible KPI count for Brain surfaces."""
    if isinstance(user_or_tier, dict):
        tier = resolve_tier(user_or_tier)
    else:
        tier = str(user_or_tier or 'free').lower().strip()
    return BRAIN_METRIC_LIMITS.get(tier, BRAIN_METRIC_LIMITS['free'])


def get_brain_plan_label(user_or_tier) -> str:
    """Human-readable plan label for Brain surfaces."""
    if isinstance(user_or_tier, dict):
        tier = resolve_tier(user_or_tier)
    else:
        tier = str(user_or_tier or 'free').lower().strip()
    return BRAIN_PLAN_LABELS.get(tier, 'Free')
