// 2026-04-19: Free tier removed per CEO direction ("there is no free tier, remove").
// All core protection features fold into Starter (Growth, $69) as the first paid tier.
// Higher tiers inherit via "Everything in X" cascade labels.
export const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Growth',
    subtitle: 'For solo operators and early-stage teams',
    price: '$69',
    priceNum: 69,
    period: '/month',
    color: '#E85D00',
    popular: true,
    recommended: true,
    features: [
      '1 user included',
      '1,000,000 AI tokens / month per account',
      'Recent data sync history',
      'All supported integrations',
      'Starter business memory',
      'AI usage pauses at plan limit',
      'Email support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    subtitle: 'For growing teams running weekly intelligence',
    price: '$199',
    priceNum: 199,
    period: '/month',
    color: '#3B82F6',
    features: [
      'Up to 5 users included',
      '5,000,000 AI tokens / month per account',
      'Extended data sync history',
      'All supported integrations',
      'Extended business memory',
      'AI usage pauses at plan limit',
      'Priority support',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    subtitle: 'For established teams needing deeper capacity',
    price: '$349',
    priceNum: 349,
    period: '/month',
    color: '#F59E0B',
    features: [
      'Up to 12 users included',
      '20,000,000 AI tokens / month per account',
      'Advanced data sync history',
      'All supported integrations',
      'Long-term business memory',
      'AI usage pauses at plan limit',
      'Priority support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Specialist',
    subtitle: 'Custom rollout tailored to your business',
    price: 'Custom',
    priceNum: null,
    period: '',
    color: '#8B5CF6',
    features: [
      'Custom users',
      'Custom AI capacity',
      'Custom sync history',
      'Custom integration planning',
      'Specialist-led setup',
      'Multi-location support',
      'Commercial review with a BIQc Specialist',
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
  // Unknown / legacy 'free' / null → fall back to Starter (the new floor).
  return PRICING_TIERS.find((tier) => tier.id === id) || PRICING_TIERS.find((t) => t.id === 'starter') || PRICING_TIERS[0];
};

export const getTierColor = (id) => getTierByPlanId(id).color;
export const getTierName = (id) => getTierByPlanId(id).name;