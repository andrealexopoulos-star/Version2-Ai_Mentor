import { getRouteAccess } from './routeAccessConfig';
import { checkRouteAccess } from '../lib/tierResolver';

export const TIERS = {
  free: { id: 'free', label: 'Free', price: 0, color: '#64748B' },
  starter: { id: 'starter', label: 'Starter', price: 349, color: '#FF6A00' },
  pro: { id: 'pro', label: 'Pro', price: 699, color: '#3B82F6' },
  enterprise: { id: 'enterprise', label: 'Enterprise', price: 1499, color: '#8B5CF6' },
  custom_build: { id: 'custom_build', label: 'Custom Build', price: null, color: '#10B981' },
  admin: { id: 'admin', label: 'Admin', price: null, color: '#7C3AED' },
};

export const STRIPE_PRICES = {
  starter_monthly: process.env.REACT_APP_STRIPE_STARTER_PRICE_ID || 'price_biqc_foundation_349',
  pro_monthly: process.env.REACT_APP_STRIPE_PRO_PRICE_ID || 'price_biqc_pro_699',
  enterprise_monthly: process.env.REACT_APP_STRIPE_ENTERPRISE_PRICE_ID || 'price_biqc_enterprise_1499',
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
  free: [
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
    'Email integration only',
  ],
  starter: [
    'Everything in Free',
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
  enterprise: [
    'Everything in Pro',
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