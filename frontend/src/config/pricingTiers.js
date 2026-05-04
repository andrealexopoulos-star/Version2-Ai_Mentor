// 2026-05-04: Lite tier ($14) added per Andreas direction (code 13041978).
// Pricing model: 4 paid tiers (Lite/Growth/Pro/Business) + Enterprise/Custom Build.
// Higher tiers inherit via "Everything in X" cascade labels.
// Seat caps + capacity match backend tier_resolver + commit d76ab6e3:
//   Lite 1 user / 150K tokens, Growth 1 / 1M, Pro 5 / 5M, Business 12 / 20M.
export const PRICING_TIERS = [
  {
    id: 'lite',
    name: 'Lite',
    subtitle: 'Try BIQc intelligence with one connected account',
    price: '$14',
    priceNum: 14,
    period: '/month',
    color: '#0a0a0a',
    features: [
      'Ask BIQc',
      '1 user included',
      'Monthly AI allowance: 150,000 tokens',
      '1 supported integration',
      'Sync history: 14 days',
      '30-day business memory',
      'Unlimited PDF / CSV / Excel exports',
      'Self-serve support',
    ],
  },
  {
    id: 'starter',
    name: 'Growth',
    subtitle: 'Core BIQc intelligence for solo operators',
    price: '$69',
    priceNum: 69,
    period: '/month',
    color: '#E85D00',
    popular: true,
    recommended: true,
    features: [
      'Market & Business Forensic Snapshot',
      'Intelligence Spine',
      'Ask BIQc',
      'Priority insights and recommended actions',
      'Supported integrations',
      'Seats: 1 user',
      'Monthly AI allowance: 1M tokens',
      'Sync history: 90 days',
      'Auto top-up when tokens run out',
      'Email support, 24h response',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    subtitle: 'Core BIQc intelligence with higher capacity',
    price: '$199',
    priceNum: 199,
    period: '/month',
    color: '#3B82F6',
    features: [
      'All Growth core intelligence features',
      'Seats: up to 5 users',
      'Monthly AI allowance: 5M tokens',
      'Sync history: 12 months',
      '1 specialist strategy session per quarter',
      'Priority chat support',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    subtitle: 'Core BIQc intelligence for growing teams',
    price: '$349',
    priceNum: 349,
    period: '/month',
    color: '#F59E0B',
    features: [
      'All Pro core intelligence features',
      'Seats: up to 12 users',
      'Monthly AI allowance: 20M tokens',
      'Sync history: 24 months',
      'Dedicated onboarding + customer success manager',
      'Priority+ support',
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

/** Resolve plan id to display tier with legacy aliases preserved.
 * 2026-05-04: Lite added at index [0]; downstream indices shift by +1.
 */
export const getTierByPlanId = (id) => {
  if (id === 'super_admin') return PRICING_TIERS.find((tier) => tier.id === 'enterprise') || PRICING_TIERS[4];
  if (id === 'lite') return PRICING_TIERS.find((tier) => tier.id === 'lite') || PRICING_TIERS[0];
  if (id === 'starter' || id === 'foundation' || id === 'growth') return PRICING_TIERS.find((tier) => tier.id === 'starter') || PRICING_TIERS[1];
  if (id === 'professional' || id === 'pro') return PRICING_TIERS.find((tier) => tier.id === 'pro') || PRICING_TIERS[2];
  if (id === 'business') return PRICING_TIERS.find((tier) => tier.id === 'business') || PRICING_TIERS[3];
  if (id === 'enterprise') return PRICING_TIERS.find((tier) => tier.id === 'enterprise') || PRICING_TIERS[4];
  if (id === 'custom' || id === 'custom_build') return PRICING_TIERS.find((tier) => tier.id === 'custom_build') || PRICING_TIERS[5];
  // Unknown / legacy/null values fall back to Lite (the new entry-level floor).
  return PRICING_TIERS.find((tier) => tier.id === id) || PRICING_TIERS.find((t) => t.id === 'lite') || PRICING_TIERS[0];
};

export const getTierColor = (id) => getTierByPlanId(id).color;
export const getTierName = (id) => getTierByPlanId(id).name;