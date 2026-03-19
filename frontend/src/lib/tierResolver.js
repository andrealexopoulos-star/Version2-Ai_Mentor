/**
 * BIQc Central Tier Resolver — Frontend
 * SINGLE SOURCE OF TRUTH for all frontend tier checks.
 * Route access comes from routeAccessConfig.js only.
 */
import { getRouteAccess } from '../config/routeAccessConfig';

const SUPER_ADMIN_EMAIL = (typeof process !== 'undefined' && process.env.REACT_APP_BIQC_MASTER_ADMIN_EMAIL)?.trim?.()?.toLowerCase?.()
  || 'andre@thestrategysquad.com.au';

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
  const access = getRouteAccess(route);
  if (!access) return { allowed: true, tier };
  const required = access.minTier;
  if (hasAccess(tier, required)) return { allowed: true, tier };
  return { allowed: false, tier, requiredTier: required, redirect: `/subscribe?from=${encodeURIComponent(route)}` };
}

/** Get route config (minTier, featureKey, launchType) for path. */
export { getRouteAccess } from '../config/routeAccessConfig';

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
