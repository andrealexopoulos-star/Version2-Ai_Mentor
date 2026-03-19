/**
 * BIQc Central Tier Resolver — Frontend
 * SINGLE SOURCE OF TRUTH for all frontend tier checks.
 * Mirrors backend tier_resolver.py exactly.
 */

const SUPER_ADMIN_EMAIL = 'andre@thestrategysquad.com.au';

// Only free, starter (BIQc Foundation), super_admin. Legacy DB values map to starter in resolveTier.
const TIERS = ['free', 'starter', 'super_admin'];
export const TIER_RANK = { free: 0, starter: 1, super_admin: 99 };
// Legacy tier names (no longer sold) still resolve to paid rank for hasAccess when DB returns them
const LEGACY_PAID_RANK = 1;
function rankForTier(tier) {
  if (TIER_RANK[tier] !== undefined) return TIER_RANK[tier];
  if (['foundation', 'growth', 'professional', 'enterprise', 'custom', 'pro'].includes(tier)) return LEGACY_PAID_RANK;
  return 0;
}

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
  if (dbTier === 'starter') return 'starter';
  if (dbTier === 'super_admin') return 'super_admin';
  if (['foundation', 'growth', 'professional', 'enterprise', 'custom', 'pro'].includes(dbTier)) return 'starter';
  return dbTier === 'free' ? 'free' : 'free';
}

export function hasAccess(userTier, requiredTier) {
  return rankForTier(userTier) >= rankForTier(requiredTier);
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
