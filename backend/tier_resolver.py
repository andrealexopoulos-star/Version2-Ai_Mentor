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
from auth_supabase import MASTER_ADMIN_EMAIL

logger = logging.getLogger(__name__)

# ═══ SUPER ADMIN — IMMUTABLE, EMAIL-BASED ═══
SUPER_ADMIN_EMAIL = MASTER_ADMIN_EMAIL

# ═══ TIER DEFINITIONS — free + 4 paid (lite + starter + pro + business) + custom + super_admin ═══
# Phase 1.9 (2026-05-05 code 13041978): 'lite' added — $14/mo entry-level paid tier.
TIERS = ['free', 'lite', 'starter', 'pro', 'business', 'enterprise', 'custom_build', 'super_admin']

BRAIN_METRIC_LIMITS = {
    'free': 10,
    'lite': 25,           # Between free (10) and starter (50)
    'starter': 50,
    'pro': 75,
    'business': 100,
    'enterprise': 120,
    'custom_build': 150,
    'super_admin': 200,
}

BRAIN_PLAN_LABELS = {
    'free': 'Free',
    'starter': 'Starter',
    'pro': 'Pro',
    'business': 'Business',
    'enterprise': 'Enterprise',
    'custom_build': 'Custom Build',
    'super_admin': 'Enterprise',
}

# ═══ ROUTE ACCESS MAP ═══
# Route pattern → minimum tier required
# 'free' = available to all, 'starter' = paid, 'super_admin' = admin only
ROUTE_ACCESS = {
    # Phase 6.11 — Free tier is a locked/unsubscribed state, not a
    # destination. Routes below stay on 'free' only because they must
    # remain reachable during/after signup:
    #   • Signup + onboarding flow
    #   • Account self-service (settings — to cancel)
    #   • Purchase path (subscribe, upgrade)
    #   • Legal + catalog (biqc-legal, more-features)
    # Everything else lifts to 'starter'. See routeAccessConfig.js —
    # parity enforced by scripts/feature_tier_parity_gate.py.
    '/settings': 'free',             # Account settings (cancel/manage)
    '/calibration': 'starter',       # Paid/trialing only
    '/onboarding': 'free',
    '/onboarding-decision': 'free',
    '/profile-import': 'free',
    '/biqc-legal': 'free',
    '/subscribe': 'free',
    '/upgrade': 'free',
    '/more-features': 'free',

    # Starter tier (trialing users pass, since _normalize_tier maps
    # trialing users to their plan). Subscription gate.
    '/advisor': 'starter',
    '/market': 'starter',
    '/business-profile': 'starter',
    '/integrations': 'starter',
    '/connect-email': 'starter',
    '/data-health': 'starter',
    '/competitive-benchmark': 'starter',
    '/soundboard': 'starter',
    '/email-inbox': 'starter',
    '/calendar': 'starter',
    '/actions': 'starter',
    '/alerts': 'starter',
    '/settings/actions': 'starter',
    '/settings/alerts': 'starter',
    '/cmo-report': 'starter',

    # PAID TIER — requires starter or above
    '/exposure-scan': 'starter',
    '/marketing-automation': 'starter',
    '/forensic-audit': 'starter',
    '/revenue': 'starter',
    '/operations': 'starter',
    '/risk': 'pro',
    '/compliance': 'pro',
    '/reports': 'starter',
    '/audit-log': 'pro',
    '/war-room': 'pro',
    '/board-room': 'starter',
    '/billing': 'starter',
    '/sop-generator': 'starter',
    '/decisions': 'starter',
    '/automations': 'pro',
    '/analysis': 'pro',
    '/diagnosis': 'pro',
    '/documents': 'pro',
    '/data-center': 'pro',
    '/intelligence-baseline': 'pro',
    '/intel-centre': 'pro',
    '/watchtower': 'pro',
    '/ab-testing': 'pro',
    '/operator': 'pro',
    '/marketing-intelligence': 'starter',
    '/market-analysis': 'pro',
    '/ops-advisory': 'pro',

    # ADMIN — super admin only
    '/admin': 'super_admin',
    '/admin/scope-checkpoints': 'super_admin',
    '/admin/pricing': 'super_admin',
    '/admin/ux-feedback': 'super_admin',
    '/admin/prompt-lab': 'super_admin',
    '/auth-debug': 'super_admin',
    '/prompt-lab': 'super_admin',
    '/support-admin': 'super_admin',
    '/observability': 'super_admin',
}

# ═══ API ACCESS MAP ═══
# API route prefix → minimum tier
API_ACCESS = {
    # FREE
    '/snapshot/latest': 'starter',
    '/business-profile': 'starter',
    '/integrations': 'starter',
    '/intelligence/integration-status': 'starter',
    '/intelligence/completeness': 'starter',
    '/intelligence/readiness': 'starter',
    '/calibration': 'starter',
    '/onboarding': 'free',
    '/auth': 'free',
    '/health': 'free',
    '/warmup': 'free',
    '/ingestion': 'free',           # Gated by counter, not tier
    '/forensic': 'starter',
    '/market-intelligence': 'starter',
    '/brain/priorities': 'starter',
    '/brain/metrics': 'starter',
    '/brain/concerns': 'starter',

    # PAID
    '/revenue': 'starter',
    '/snapshot/generate': 'starter',
    '/intelligence/workforce': 'starter',
    '/intelligence/scenarios': 'starter',
    '/intelligence/scores': 'starter',
    '/intelligence/concentration': 'starter',
    '/intelligence/contradictions': 'starter',
    '/intelligence/pressure': 'starter',
    '/intelligence/freshness': 'starter',
    '/intelligence/silence': 'starter',
    '/intelligence/escalations': 'starter',
    '/intelligence/watchtower': 'starter',
    '/intelligence/summary': 'starter',
    '/intelligence/governance-summary': 'starter',
    '/reports': 'starter',
    '/soundboard': 'starter',
    '/boardroom': 'starter',
    '/strategic-console': 'starter',
    '/generate': 'starter',
    '/cognitive': 'starter',
    '/advisory': 'starter',
    '/watchtower': 'starter',
    '/emission': 'starter',
    '/email/priority-inbox': 'starter',
    '/email/analyze': 'starter',
    '/email/suggest': 'starter',
    '/notifications/alerts': 'starter',
    '/outlook': 'starter',
    '/workflows': 'starter',
    '/decisions': 'starter',
    '/marketing-automation': 'starter',
    '/exposure': 'starter',

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
    role = (user.get('role') or '').lower().strip()

    # SUPER ADMIN OVERRIDE — cannot be restricted
    if SUPER_ADMIN_EMAIL and email == SUPER_ADMIN_EMAIL.lower():
        return 'super_admin'
    if role in {'superadmin', 'super_admin'}:
        return 'super_admin'

    # Commercial gate: paid app access requires an active/trialing Stripe
    # subscription with both customer + subscription ids linked.
    status = (user.get('subscription_status') or '').lower().strip()
    inactive_statuses = {'past_due', 'canceled', 'cancelled', 'incomplete', 'incomplete_expired', 'unpaid'}
    if status in inactive_statuses:
        return 'free'
    if status not in {'active', 'trialing'}:
        return 'free'
    if not (user.get('stripe_customer_id') and user.get('stripe_subscription_id')):
        return 'free'

    # Database tier
    db_tier = (user.get('subscription_tier') or 'free').lower().strip()
    if db_tier == 'trial':
        return 'starter'
    if db_tier in {'foundation', 'growth', 'starter'}:
        return 'starter'
    if db_tier in {'professional', 'pro'}:
        return 'pro'
    if db_tier == 'business':
        return 'business'
    if db_tier in {'enterprise'}:
        return 'enterprise'
    if db_tier in {'custom', 'custom_build'}:
        return 'custom_build'
    if db_tier in TIERS:
        return db_tier

    return 'free'


def tier_rank(tier: str) -> int:
    """Numeric rank for tier comparison with legacy aliases mapped safely.

    Phase 1.9 (2026-05-05 code 13041978): 'lite' added at rank 1 same as
    starter — both are paid entry-level so route access matches; token
    allocation differs (lite=150K, starter=1M).
    """
    if tier == 'super_admin':
        return 99
    if tier in ('custom_build', 'custom'):
        return 5
    if tier == 'enterprise':
        return 4
    if tier == 'business':
        return 3
    if tier in ('pro', 'professional'):
        return 2
    if tier in ('lite', 'starter', 'foundation', 'growth'):
        return 1
    return 0


def has_access(user_tier: str, required_tier: str) -> bool:
    """Check if user tier meets required tier."""
    return tier_rank(user_tier) >= tier_rank(required_tier)


def check_route_access(route: str, user: dict) -> dict:
    """Check if user can access a frontend route."""
    tier = resolve_tier(user)

    # Find matching route. Exact match wins over prefix match — otherwise
    # `/settings` (declared before `/settings/actions`) would swallow the
    # subroute and grant its `free` tier where we set `starter`. Codex P1
    # on PR #332.
    required = None
    if route in ROUTE_ACCESS:
        required = ROUTE_ACCESS[route]
    else:
        for pattern, req_tier in ROUTE_ACCESS.items():
            if route.startswith(pattern + '/'):
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
    if tier == 'custom_build':
        return {'snapshots': 300, 'audits': 120}
    if tier == 'enterprise':
        return {'snapshots': 120, 'audits': 60}
    if tier == 'pro':
        return {'snapshots': 60, 'audits': 25}
    if tier == 'free':
        return {'snapshots': 3, 'audits': 1}
    if tier == 'starter':
        return {'snapshots': 20, 'audits': 10}
    return {'snapshots': 3, 'audits': 1}


def get_brain_metric_limit(user_or_tier) -> int:
    """Return the maximum visible KPI count for Brain surfaces."""
    if isinstance(user_or_tier, dict):
        tier = resolve_tier(user_or_tier)
    else:
        tier = str(user_or_tier or 'free').lower().strip()
        if tier not in BRAIN_METRIC_LIMITS:
            if tier in {'foundation', 'growth'}:
                tier = 'starter'
            elif tier in {'professional', 'pro'}:
                tier = 'pro'
            elif tier == 'enterprise':
                tier = 'enterprise'
            elif tier in {'custom', 'custom_build'}:
                tier = 'custom_build'
    return BRAIN_METRIC_LIMITS.get(tier, BRAIN_METRIC_LIMITS['free'])


def get_brain_plan_label(user_or_tier) -> str:
    """Human-readable plan label for Brain surfaces."""
    if isinstance(user_or_tier, dict):
        tier = resolve_tier(user_or_tier)
    else:
        tier = str(user_or_tier or 'free').lower().strip()
        if tier not in BRAIN_PLAN_LABELS:
            if tier in {'foundation', 'growth'}:
                tier = 'starter'
            elif tier in {'professional', 'pro'}:
                tier = 'pro'
            elif tier == 'enterprise':
                tier = 'enterprise'
            elif tier in {'custom', 'custom_build'}:
                tier = 'custom_build'
    return BRAIN_PLAN_LABELS.get(tier, 'Free')
