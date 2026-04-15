export const PRICING_TIERS = [
  {
    id: 'free',
    name: 'Free',
    subtitle: 'Launch access',
    price: '$0',
    priceNum: 0,
    period: '/month',
    color: '#64748B',
    features: [
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
  },
  {
    id: 'starter',
    name: 'Growth',
    subtitle: 'Growth operating package',
    price: '$69',
    priceNum: 69,
    period: '/month',
    color: '#E85D00',
    popular: true,
    recommended: true,
    features: [
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
  },
  {
    id: 'pro',
    name: 'Professional',
    subtitle: 'Scale operating intelligence',
    price: '$199',
    priceNum: 199,
    period: '/month',
    color: '#3B82F6',
    features: [
      'Everything in Starter',
      'Higher monthly limits for core modules',
      'Priority model routing and deeper analysis windows',
      'Advanced reporting cadence',
      'Expanded connector allowance',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    subtitle: 'Full-scale operating intelligence',
    price: '$349',
    priceNum: 349,
    period: '/month',
    color: '#F59E0B',
    features: [
      'Everything in Professional',
      'All premium model access (Claude, GPT-5.4)',
      '15M input + 6M output tokens/month',
      'Advanced risk & compliance modules',
      'Priority model routing',
      'Up to 15 integrations',
      'Team collaboration (up to 5 seats)',
      'Dedicated onboarding session',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    subtitle: 'Governed enterprise control',
    price: 'Custom',
    priceNum: null,
    period: '',
    color: '#8B5CF6',
    features: [
      'Everything in Business',
      'Enterprise governance controls',
      'Higher reliability and support commitments',
      'Expanded organizational limits',
      'Executive rollout and enablement',
    ],
  },
  {
    id: 'custom_build',
    name: 'Custom Build',
    subtitle: 'Contracted build and entitlement overlay',
    price: 'Custom',
    priceNum: null,
    period: '',
    color: '#10B981',
    features: [
      'Everything in Enterprise',
      'Custom entitlement overlays',
      'Tailored module packaging',
      'Contracted integration and delivery plan',
      'Commercial terms by scope',
    ],
  },
];

/** Resolve plan id to display tier with legacy aliases preserved. */
export const getTierByPlanId = (id) => {
  if (id === 'super_admin') return PRICING_TIERS.find((tier) => tier.id === 'enterprise') || PRICING_TIERS[2];
  if (id === 'starter' || id === 'foundation' || id === 'growth') return PRICING_TIERS.find((tier) => tier.id === 'starter') || PRICING_TIERS[1];
  if (id === 'professional' || id === 'pro') return PRICING_TIERS.find((tier) => tier.id === 'pro') || PRICING_TIERS[2];
  if (id === 'business') return PRICING_TIERS.find((tier) => tier.id === 'business') || PRICING_TIERS[3];
  if (id === 'enterprise') return PRICING_TIERS.find((tier) => tier.id === 'enterprise') || PRICING_TIERS[4];
  if (id === 'custom' || id === 'custom_build') return PRICING_TIERS.find((tier) => tier.id === 'custom_build') || PRICING_TIERS[5];
  return PRICING_TIERS.find((tier) => tier.id === id) || PRICING_TIERS[0];
};

export const getTierColor = (id) => getTierByPlanId(id).color;
export const getTierName = (id) => getTierByPlanId(id).name;