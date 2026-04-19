import { getRouteAccess } from './routeAccessConfig';
import { checkRouteAccess } from '../lib/tierResolver';

export const TIERS = {
  starter: { id: 'starter', label: 'Growth', price: 69, color: '#E85D00' },
  pro: { id: 'pro', label: 'Professional', price: 199, color: '#3B82F6' },
  business: { id: 'business', label: 'Business', price: 349, color: '#F59E0B' },
  enterprise: { id: 'enterprise', label: 'Enterprise', price: null, color: '#8B5CF6' },
  custom_build: { id: 'custom_build', label: 'Custom Build', price: null, color: '#10B981' },
  admin: { id: 'admin', label: 'Admin', price: null, color: '#7C3AED' },
};

export const STRIPE_PRICES = {
  starter_monthly: process.env.REACT_APP_STRIPE_STARTER_PRICE_ID || 'price_biqc_growth_69',
  pro_monthly: process.env.REACT_APP_STRIPE_PRO_PRICE_ID || 'price_biqc_professional_199',
  business_monthly: process.env.REACT_APP_STRIPE_BUSINESS_PRICE_ID || 'price_biqc_business_349',
  enterprise_monthly: process.env.REACT_APP_STRIPE_ENTERPRISE_PRICE_ID || '',
};

/** Path → minTier; from routeAccessConfig. */
export function getPathTier(path) {
  return getRouteAccess(path)?.minTier ?? 'free';
}

/** canAccess(userTier, path, userEmail) — delegates to tierResolver (privileged bypass there). */
export function canAccess(userTier, path, userEmail) {
  const user = { tier: userTier, email: userEmail };
  const access = checkRouteAccess(path, user);
  return access?.allowed !== false;
}

export function requiredTier(path) {
  return getRouteAccess(path)?.minTier ?? 'free';
}

export const TIER_FEATURES = {
  // 2026-04-19: free tier removed. Its features folded into Starter (Growth,
  // $69) as the first paid tier; higher tiers inherit via "Everything in X"
  // labels. Per Andreas direction — no more free plan offered to users.
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
    'All premium model access (Claude, GPT-5.4)',
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