import { getRouteAccess } from './routeAccessConfig';
import { checkRouteAccess } from '../lib/tierResolver';

// 2026-05-04: Lite tier ($14) added per code 13041978.
export const TIERS = {
  lite: { id: 'lite', label: 'Lite', price: 14, color: '#0a0a0a' },
  starter: { id: 'starter', label: 'Growth', price: 69, color: '#E85D00' },
  pro: { id: 'pro', label: 'Pro', price: 199, color: '#3B82F6' },
  business: { id: 'business', label: 'Business', price: 349, color: '#F59E0B' },
  enterprise: { id: 'enterprise', label: 'Enterprise', price: null, color: '#8B5CF6' },
  custom_build: { id: 'custom_build', label: 'Custom Build', price: null, color: '#10B981' },
  admin: { id: 'admin', label: 'Admin', price: null, color: '#7C3AED' },
};

export const STRIPE_PRICES = {
  lite_monthly: process.env.REACT_APP_STRIPE_LITE_PRICE_ID || 'price_1TSnBMRoX8RKDDG5akGL7RkT',
  starter_monthly: process.env.REACT_APP_STRIPE_STARTER_PRICE_ID || 'price_1T9wiVRoX8RKDDG5AOSi8Cu6',
  pro_monthly: process.env.REACT_APP_STRIPE_PRO_PRICE_ID || 'price_1TMxjtRoX8RKDDG5btgRBrRu',
  business_monthly: process.env.REACT_APP_STRIPE_BUSINESS_PRICE_ID || 'price_1TMxplRoX8RKDDG59IaUg7aV',
  enterprise_monthly: process.env.REACT_APP_STRIPE_ENTERPRISE_PRICE_ID || '',
};

/** Path → minTier; from routeAccessConfig. */
export function getPathTier(path) {
  return getRouteAccess(path)?.minTier ?? 'free';
}

/** canAccess(userTier, path, userEmail) — delegates to tierResolver (privileged bypass there).
 *
 * 2026-05-05 fix (13041978): super_admin / admin tiers must short-circuit BEFORE we
 * rebuild a stripped-down user object. The caller has already done the tier resolution
 * (resolveTier) which DID see role='superadmin' on the full user. Rebuilding `{tier,email}`
 * here drops the role, so when checkRouteAccess re-runs resolveTier it falls through to
 * 'free' (because REACT_APP_BIQC_MASTER_ADMIN_EMAIL is not always present in the build
 * env). That's how a superadmin ended up seeing every menu item locked.
 */
export function canAccess(userTier, path, userEmail) {
  if (userTier === 'super_admin' || userTier === 'admin' || userTier === 'enterprise' || userTier === 'custom_build') return true;
  const user = { tier: userTier, email: userEmail };
  const access = checkRouteAccess(path, user);
  return access?.allowed !== false;
}

export function requiredTier(path) {
  return getRouteAccess(path)?.minTier ?? 'free';
}

export const TIER_FEATURES = {
  // 2026-05-04: Lite added at $14 entry tier (code 13041978).
  // 2026-04-19: free tier removed. Higher tiers inherit via "Everything in X"
  // labels. Per Andreas direction — no more free plan offered to users.
  lite: [
    'Ask BIQc',
    '1 user included',
    'Monthly AI allowance: 150,000 tokens',
    '1 supported integration',
    'Sync history: 14 days',
    '30-day business memory',
    'Unlimited PDF / CSV / Excel exports',
    'Self-serve support',
  ],
  starter: [
    'BIQc Overview',
    'Ask BIQc',
    'Inbox',
    'Calendar',
    'Market & Position',
    'Business DNA',
    'Actions',
    'Alerts',
    'Data Health',
    'Settings',
    'Competitive Benchmark',
    'BIQc Foundation package',
    'Exposure Scan',
    'Marketing Auto',
    'Reports',
    'SOP Generator',
    'Decision Tracker',
    'Ingestion Audit',
    'Revenue',
    'Operations',
    'Marketing Intelligence',
    'Boardroom',
    'Weekly Check-Ups',
    'Up to 5 integrations',
  ],
  pro: [
    'Everything in Starter',
    'Higher request and automation limits',
    'Priority model routing',
    'Advanced reporting schedules',
    'Expanded connector allowance',
  ],
  business: [
    'Everything in Professional',
    'Access to frontier models from OpenAI, Anthropic, and Google',
    '15M input + 6M output tokens/month',
    'Advanced risk & compliance modules',
    'Priority model routing',
    'Up to 15 integrations',
    'Team collaboration (up to 5 seats)',
    'Dedicated onboarding session',
  ],
  enterprise: [
    'Everything in Business',
    'Enterprise governance controls',
    'Dedicated reliability controls',
    'Priority support and onboarding',
    'Enterprise-scale usage allowances',
  ],
  custom_build: [
    'Tailored entitlement overlays',
    'Contract-specific usage and routing',
    'Custom module packaging',
    'Delivery and integration roadmap alignment',
  ],
};
