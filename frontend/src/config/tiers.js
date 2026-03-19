import { getRouteAccess } from './routeAccessConfig';
import { isPrivilegedUser } from '../lib/privilegedUser';

export const TIERS = {
  free: { id: 'free', label: 'Free', price: 0, color: '#64748B' },
  starter: { id: 'starter', label: 'BIQc Foundation', price: 349, color: '#FF6A00' },
  admin: { id: 'admin', label: 'Admin', price: null, color: '#7C3AED' },
};

export const STRIPE_PRICES = {
  starter_monthly: process.env.REACT_APP_STRIPE_STARTER_PRICE_ID || 'price_biqc_foundation_349',
};

/** Path → minTier; from routeAccessConfig. */
export function getPathTier(path) {
  return getRouteAccess(path)?.minTier ?? 'free';
}

const TIER_ORDER = ['free', 'starter', 'super_admin', 'admin'];

/** canAccess(userTier, path, userEmail) — privileged user bypass via isPrivilegedUser. */
export function canAccess(userTier, path, userEmail = '') {
  if (userEmail && isPrivilegedUser({ email: userEmail })) return true;
  const required = getRouteAccess(path)?.minTier ?? 'free';
  if (required === 'admin' || required === 'super_admin') return false;
  const normalizedTier = ['starter', 'professional', 'enterprise', 'custom', 'growth', 'foundation'].includes(String(userTier || '').toLowerCase())
    ? 'starter'
    : 'free';
  return TIER_ORDER.indexOf(normalizedTier) >= TIER_ORDER.indexOf(required);
}

export function requiredTier(path) {
  return getRouteAccess(path)?.minTier ?? 'free';
}

export const TIER_FEATURES = {
  free: [
    'BIQc Overview',
    'Soundboard',
    'Priority Inbox',
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
};