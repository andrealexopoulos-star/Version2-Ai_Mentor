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
  },
  {
    id: 'starter',
    name: 'SMB Protect',
    subtitle: 'Full launch tier',
    price: '$349',
    priceNum: 349,
    period: '/month',
    color: '#FF6A00',
    popular: true,
    recommended: true,
    features: [
      'Everything in Free',
      'Exposure Scan',
      'Marketing Auto',
      'Reports',
      'SOP Generator',
      'Decision Tracker',
      'Ingestion Audit',
      'Weekly Check-Ups',
      'Up to 5 integrations',
    ],
  },
];

export const getTierByPlanId = (id) => {
  if (id === 'super_admin') return PRICING_TIERS[1];
  if (['professional', 'enterprise', 'custom', 'growth', 'foundation'].includes(id)) return PRICING_TIERS[1];
  return PRICING_TIERS.find((tier) => tier.id === id) || PRICING_TIERS[0];
};

export const getTierColor = (id) => getTierByPlanId(id).color;
export const getTierName = (id) => getTierByPlanId(id).name;