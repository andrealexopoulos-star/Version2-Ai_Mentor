/**
 * BIQc Central Tier Resolver — Frontend
 * SINGLE SOURCE OF TRUTH for all frontend tier checks.
 * Mirrors backend tier_resolver.py exactly.
 */

const SUPER_ADMIN_EMAIL = 'andre@thestrategysquad.com.au';

const TIERS = ['free', 'starter', 'professional', 'enterprise', 'custom', 'super_admin'];
export const TIER_RANK = { free: 0, starter: 1, professional: 2, enterprise: 3, custom: 4, super_admin: 99, growth: 3 }; // growth kept as legacy alias only

// Route → minimum tier
const ROUTE_ACCESS = {
  '/advisor': 'free',
  '/market': 'free',
  '/business-profile': 'free',
  '/forensic-audit': 'free',
  '/knowledge-base': 'free',
  '/settings': 'free',
  '/integrations': 'free',
  '/connect-email': 'free',
  '/data-health': 'free',
  '/calibration': 'free',
  '/onboarding': 'free',
  '/onboarding-decision': 'free',
  '/profile-import': 'free',
  // PAID — Enterprise tier required (Growth & Enterprise plans)
  '/revenue': 'enterprise',
  '/operations': 'enterprise',
  // PAID — Starter tier
  '/risk': 'starter',
  '/compliance': 'starter',
  '/reports': 'free',
  '/audit-log': 'starter',
  '/soundboard': 'starter',
  '/war-room': 'starter',
  '/board-room': 'starter',
  '/sop-generator': 'starter',
  '/alerts': 'starter',
  '/actions': 'starter',
  '/automations': 'starter',
  '/email-inbox': 'starter',
  '/calendar': 'free',
  '/analysis': 'starter',
  '/diagnosis': 'starter',
  '/documents': 'starter',
  '/data-center': 'starter',
  '/intelligence-baseline': 'starter',
  '/intel-centre': 'starter',
  '/watchtower': 'starter',
  '/operator': 'starter',
  // ADMIN
  '/admin': 'super_admin',
  '/auth-debug': 'super_admin',
};

// Market sub-features
const MARKET_SUB_FEATURES = {
  intelligence: 'free',
  saturation: 'starter',
  demand: 'starter',
  friction: 'starter',
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
