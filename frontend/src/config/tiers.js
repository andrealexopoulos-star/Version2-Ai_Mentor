import { FREE_LAUNCH_ROUTES, PAID_LAUNCH_ROUTES } from './launchConfig';

export const TIERS = {
  free: { id: 'free', label: 'Free', price: 0, color: '#64748B' },
  starter: { id: 'starter', label: 'BIQc Foundation', price: 349, color: '#FF6A00' },
  admin: { id: 'admin', label: 'Admin', price: null, color: '#7C3AED' },
};

export const STRIPE_PRICES = {
  starter_monthly: process.env.REACT_APP_STRIPE_STARTER_PRICE_ID || 'price_biqc_foundation_349',
};

export const PATH_TIERS = {
  ...Object.fromEntries(FREE_LAUNCH_ROUTES.map((path) => [path, 'free'])),
  ...Object.fromEntries(PAID_LAUNCH_ROUTES.map((path) => [path, 'starter'])),
  '/revenue': 'starter',
  '/operations': 'starter',
  '/risk': 'starter',
  '/compliance': 'starter',
  '/audit-log': 'starter',
  '/war-room': 'starter',
  '/board-room': 'starter',
  '/analysis': 'starter',
  '/diagnosis': 'starter',
  '/documents': 'starter',
  '/intel-centre': 'starter',
  '/watchtower': 'starter',
  '/market-analysis': 'starter',
  '/ops-advisory': 'starter',
  '/marketing-intelligence': 'starter',
  '/automations': 'starter',
  '/biqc-legal': 'free',
  '/more-features': 'free',
  '/admin': 'admin',
};

const TIER_ORDER = ['free', 'starter', 'admin'];

export function canAccess(userTier, path, userEmail = '') {
  if ((userEmail || '').toLowerCase().trim() === 'andre@thestrategysquad.com.au') return true;
  const required = PATH_TIERS[path] || 'free';
  if (required === 'admin') return false;
  const normalizedTier = ['starter', 'professional', 'enterprise', 'custom', 'growth', 'foundation'].includes(String(userTier || '').toLowerCase())
    ? 'starter'
    : 'free';
  return TIER_ORDER.indexOf(normalizedTier) >= TIER_ORDER.indexOf(required);
}

export function requiredTier(path) {
  return PATH_TIERS[path] || 'free';
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