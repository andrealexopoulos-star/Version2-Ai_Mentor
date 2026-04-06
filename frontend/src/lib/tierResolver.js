/**
 * BIQc Central Tier Resolver — Frontend
 * SINGLE SOURCE OF TRUTH for all frontend tier checks.
 * Route access comes from routeAccessConfig.js only.
 */
import { getRouteAccess } from '../config/routeAccessConfig';
import { MASTER_ADMIN_EMAIL as SUPER_ADMIN_EMAIL, isPrivilegedUser } from './privilegedUser';

// Canonical tiers: free + 3 paid + custom build + super_admin.
const TIERS = ['free', 'starter', 'pro', 'enterprise', 'custom_build', 'super_admin'];
export const TIER_RANK = { free: 0, starter: 1, pro: 2, enterprise: 3, custom_build: 4, super_admin: 99 };
// Legacy tier names still resolve to paid rank for compatibility.
const LEGACY_PAID_RANK = 1;
function rankForTier(tier) {
  if (TIER_RANK[tier] !== undefined) return TIER_RANK[tier];
  if (['foundation', 'growth'].includes(tier)) return LEGACY_PAID_RANK;
  if (tier === 'professional' || tier === 'pro') return TIER_RANK.pro;
  if (tier === 'enterprise') return TIER_RANK.enterprise;
  if (tier === 'custom') return TIER_RANK.custom_build;
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
  // Respect role field — only superadmin variants map to super_admin tier.
  const role = (user.role || '').toLowerCase();
  if (role === 'superadmin' || role === 'super_admin') return 'super_admin';

  // Active reverse-trial grants elevated effective tier.
  if (user.trial_expires_at) {
    const trialExpiry = new Date(user.trial_expires_at);
    if (trialExpiry > new Date()) {
      const trialTier = (user.trial_tier || 'pro').toLowerCase();
      return trialTier === 'pro' || trialTier === 'professional' ? 'pro' : 'starter';
    }
  }

  const raw = (user.subscription_tier || user.tier || 'free').toLowerCase().trim();
  if (['super_admin', 'superadmin'].includes(raw)) return 'super_admin';
  if (['enterprise', 'custom_build', 'custom'].includes(raw)) return 'enterprise';
  if (['pro', 'professional'].includes(raw)) return 'pro';
  if (['starter', 'foundation', 'growth'].includes(raw)) return 'starter';
  if (['trial'].includes(raw)) return 'free';
  return 'free';
}

export function hasAccess(userTier, requiredTier) {
  return rankForTier(userTier) >= rankForTier(requiredTier);
}

export function checkRouteAccess(route, user) {
  const tier = resolveTier(user);
  if (user && isPrivilegedUser(user)) return { allowed: true, tier };
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
