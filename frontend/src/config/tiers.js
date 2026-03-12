/**
 * BIQc Subscription Tier Configuration
 * Single source of truth for all feature gating across the platform.
 */

export const TIERS = {
  free:        { id: 'free',        label: 'Free',        price: 0,   color: '#64748B' },
  foundation:  { id: 'foundation',  label: 'Foundation',  price: 99,  color: '#3B82F6' },
  growth:      { id: 'growth',      label: 'Growth',      price: 249, color: '#FF6A00' },
  custom:      { id: 'custom',      label: 'Enterprise',  price: null, color: '#8B5CF6' },
};

// Stripe Price IDs — set these after creating plans in Stripe Dashboard
export const STRIPE_PRICES = {
  foundation_monthly: process.env.REACT_APP_STRIPE_FOUNDATION_PRICE_ID || 'price_foundation_99',
  growth_monthly:     process.env.REACT_APP_STRIPE_GROWTH_PRICE_ID     || 'price_growth_249',
};

/**
 * Path-to-tier mapping
 * Every path listed here requires the stated tier or higher.
 * Paths NOT listed = free (always accessible).
 */
export const PATH_TIERS = {
  // ── Free (always accessible) ───────────────────────────────────────────────
  '/advisor':                 'free',
  '/market':                  'free',
  '/competitive-benchmark':   'free',
  '/marketing-intelligence':  'free',
  '/email-inbox':             'free',
  '/calendar':                'free',
  '/alerts':                  'free',
  '/settings':                'free',
  '/business-profile':        'free',
  '/data-health':             'free',
  '/integrations':            'free',
  '/reports':                 'free',
  '/knowledge-base':          'free',

  // ── Foundation $99/month ───────────────────────────────────────────────────
  '/soundboard':              'foundation',
  '/revenue':                 'foundation',
  '/operations':              'foundation',
  '/actions':                 'foundation',
  '/sop-generator':           'foundation',
  '/documents':               'foundation',
  '/exposure-scan':           'foundation',
  '/marketing-automation':    'foundation',

  // ── Growth $249/month ─────────────────────────────────────────────────────
  '/risk':                    'growth',
  '/compliance':              'growth',
  '/decisions':               'growth',
  '/audit-log':               'growth',
  '/forensic-audit':          'growth',
  '/board-room':              'growth',
  '/war-room':                'growth',
  '/intel-centre':            'growth',
  '/analysis':                'growth',
  '/diagnosis':               'growth',
  '/ops-advisory':            'growth',
  '/watchtower':              'growth',
  '/automations':             'growth',
  '/market-analysis':         'growth',

  // ── Admin (andre@thestrategysquad.com.au only) ─────────────────────────────
  '/admin':                   'admin',
  '/ab-testing':              'admin',
  '/data-center':             'admin',
  '/observability':           'admin',
  '/support-admin':           'admin',
  '/prompt-lab':              'admin',
};

const TIER_ORDER = ['free', 'foundation', 'growth', 'custom', 'admin'];

/**
 * Check if a user's tier allows access to a path.
 */
export function canAccess(userTier, path) {
  const required = PATH_TIERS[path] || 'free';
  if (required === 'admin') return false; // Admin handled separately
  const userIdx = TIER_ORDER.indexOf(userTier || 'free');
  const reqIdx  = TIER_ORDER.indexOf(required);
  return userIdx >= reqIdx;
}

/**
 * Get the minimum tier required for a path.
 */
export function requiredTier(path) {
  return PATH_TIERS[path] || 'free';
}

/**
 * Pricing features for each tier (used on pricing page).
 */
export const TIER_FEATURES = {
  free: [
    'BIQc Overview dashboard',
    'Priority Inbox (AI email triage)',
    'Calendar & meeting intelligence',
    'Alerts (up to 5/month)',
    'Market & Positioning page',
    'Competitive Benchmark',
    'Marketing Intelligence',
    'Settings & account management',
    'Integrations connection',
    'Data Health monitoring',
  ],
  foundation: [
    'Everything in Free',
    'Soundboard AI Advisor (50 queries/month)',
    'Revenue & Pipeline tracking',
    'Operations monitoring',
    'Actions & recommended next steps',
    'SOP Generator (5 SOPs/month)',
    'Documents library',
    'Exposure Scan',
    'Marketing Automation',
    'Connect up to 3 integrations',
    'Standard PDF reports',
  ],
  growth: [
    'Everything in Foundation',
    'Unlimited AI Advisor queries',
    'Full Risk Intelligence (unlimited alerts)',
    'Compliance monitoring',
    'Decisions & outcome tracking',
    'Audit Log & Ingestion Audit',
    'Boardroom & War Room AI',
    'Intel Centre & deep Analysis',
    'Ops Advisory Centre',
    'Watchtower 24/7 monitoring',
    'All Market sub-pages + Automations',
    'Unlimited integrations',
    'Advanced reports + scheduling',
    'Mobile app access',
  ],
  custom: [
    'Everything in Growth',
    'Multi-user / team seats',
    'White labelling',
    'Custom AI agent training',
    'Custom integrations + dedicated Merge support',
    'SLA guarantee',
    'Dedicated success manager',
    'Priority phone support',
  ],
};
