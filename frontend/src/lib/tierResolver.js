/**
 * BIQc Central Tier Resolver — Frontend
 * SINGLE SOURCE OF TRUTH for all frontend tier checks.
 * Mirrors backend tier_resolver.py exactly.
 */

const SUPER_ADMIN_EMAIL = 'andre@thestrategysquad.com.au';

const TIERS = ['free', 'starter', 'professional', 'enterprise', 'custom', 'super_admin'];
export const TIER_RANK = { free: 0, starter: 1, professional: 1, enterprise: 1, custom: 1, foundation: 1, growth: 1, super_admin: 99 };

// Route → minimum tier
const ROUTE_ACCESS = {
  '/advisor': 'free',
  '/market': 'free',
  '/business-profile': 'free',
  '/settings': 'free',
  '/integrations': 'free',
  '/connect-email': 'free',
  '/data-health': 'free',
  '/competitive-benchmark': 'free',
  '/soundboard': 'free',
  '/email-inbox': 'free',
  '/calendar': 'free',
  '/actions': 'free',
  '/alerts': 'free',
  '/calibration': 'free',
  '/onboarding': 'free',
  '/onboarding-decision': 'free',
  '/profile-import': 'free',
  '/biqc-legal': 'free',
  '/more-features': 'free',
  // PAID — single launch tier
  '/exposure-scan': 'starter',
  '/marketing-automation': 'starter',
  '/reports': 'starter',
  '/sop-generator': 'starter',
  '/decisions': 'starter',
  '/forensic-audit': 'starter',
  '/revenue': 'starter',
  '/operations': 'starter',
  '/risk': 'starter',
  '/compliance': 'starter',
  '/audit-log': 'starter',
  '/war-room': 'starter',
  '/board-room': 'starter',
  '/automations': 'starter',
  '/analysis': 'starter',
  '/diagnosis': 'starter',
  '/documents': 'starter',
  '/intelligence-baseline': 'starter',
  '/intel-centre': 'starter',
  '/watchtower': 'starter',
  '/marketing-intelligence': 'starter',
  '/market-analysis': 'starter',
  '/ops-advisory': 'starter',
  '/operator': 'starter',
  // ADMIN
  '/admin': 'super_admin',
  '/auth-debug': 'super_admin',
};

// Market sub-features
const MARKET_SUB_FEATURES = {
  intelligence: 'free',
  saturation: 'free',
  demand: 'free',
  friction: 'free',
  reports: 'free',
};

export function resolveTier(user) {
  if (!user) return 'free';
  const email = (user.email || '').toLowerCase().trim();
  if (email === SUPER_ADMIN_EMAIL.toLowerCase()) return 'super_admin';
  // Respect role field — superadmin/admin role = super_admin tier
  const role = (user.role || '').toLowerCase();
  if (role === 'superadmin' || role === 'super_admin' || role === 'admin') return 'super_admin';
  const dbTier = (user.subscription_tier || user.tier || 'free').toLowerCase();
  if (['starter', 'professional', 'enterprise', 'custom', 'growth', 'foundation'].includes(dbTier)) return 'starter';
  return TIERS.includes(dbTier) ? dbTier : 'free';
}

export function hasAccess(userTier, requiredTier) {
  return (TIER_RANK[userTier] || 0) >= (TIER_RANK[requiredTier] || 0);
}

export function checkRouteAccess(route, user) {
  const tier = resolveTier(user);
  // Find matching route
  let required = null;
  for (const [pattern, reqTier] of Object.entries(ROUTE_ACCESS)) {
    if (route === pattern || route.startsWith(pattern + '/')) {
      required = reqTier;
      break;
    }
  }
  if (!required) return { allowed: true, tier };
  if (hasAccess(tier, required)) return { allowed: true, tier };
  return { allowed: false, tier, requiredTier: required, redirect: `/subscribe?from=${encodeURIComponent(route)}` };
}

export function checkMarketSubFeature(feature, user) {
  const tier = resolveTier(user);
  const required = MARKET_SUB_FEATURES[feature] || 'starter';
  if (hasAccess(tier, required)) return { allowed: true, tier };
  return { allowed: false, tier, requiredTier: required, redirect: '/subscribe?from=/market' };
}

export function isSuperAdmin(user) {
  return resolveTier(user) === 'super_admin';
}

export function isFreeUser(user) {
  return resolveTier(user) === 'free';
}

export function isPaidUser(user) {
  const tier = resolveTier(user);
  return TIER_RANK[tier] >= TIER_RANK['starter'];
}
