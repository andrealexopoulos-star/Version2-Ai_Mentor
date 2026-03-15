/**
 * BIQc Canonical Pricing Configuration
 * Single source of truth for all pricing tiers.
 * All pricing UI (SubscribePage, UpgradeCardsGate, PricingPage) must reference this file.
 */

export const PRICING_TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    priceNum: 0,
    period: '/month',
    color: '#64748B',
    features: [
      '10 KPI monitors with custom thresholds',
      'Market Intelligence (basic)',
      'Business DNA',
      '1 Forensic Audit/month',
      '3 Snapshots/month',
      'Email Integration',
    ],
  },
  {
    id: 'starter',
    name: 'Foundation',
    subtitle: 'Leadership Visibility',
    price: '$750',
    priceNum: 750,
    period: '/month',
    color: '#10B981',
    features: [
      '25 KPI monitors with custom thresholds',
      'Live market metrics (with integrations)',
      'Revenue intelligence',
      'Workforce baseline monitoring',
      'Cash discipline visibility',
      '60-day forecasting',
    ],
  },
  {
    id: 'professional',
    name: 'Performance',
    subtitle: 'Margin & Capacity Discipline',
    price: '$1,950',
    priceNum: 1950,
    period: '/month',
    color: '#3B82F6',
    popular: true,
    features: [
      '50 KPI monitors with custom thresholds',
      'Everything in Foundation',
      'Service-line profitability insight',
      'Hiring trigger detection',
      'Capacity strain modelling',
      'Margin compression alerts',
      'Soundboard Chat',
      '90-day projections',
    ],
  },
  {
    id: 'enterprise',
    name: 'Growth',
    subtitle: 'Strategic Expansion Control',
    price: '$3,900',
    priceNum: 3900,
    period: '/month',
    color: '#7C3AED',
    features: [
      '75 KPI monitors with custom thresholds',
      'Everything in Performance',
      'Hiring vs outsource modelling',
      'Revenue expansion simulation',
      'Market saturation scoring',
      'Scenario planning capability',
      'Board-ready PDF reports',
    ],
  },
  {
    id: 'super_admin',
    name: 'Enterprise',
    subtitle: 'Executive Command Layer',
    price: null,
    priceNum: null,
    period: null,
    color: '#EF4444',
    cta: 'Speak to Sales',
    features: [
      '100 KPI monitors with custom thresholds',
      'Everything in Growth',
      'Multi-division reporting',
      'Custom KPI frameworks',
      'Governance controls',
      'Executive reporting automation',
      'Custom integrations',
      'Sovereign data options',
    ],
  },
];

export const getTierByPlanId = (id) => PRICING_TIERS.find(t => t.id === id) || PRICING_TIERS[0];
export const getTierColor = (id) => getTierByPlanId(id).color;
export const getTierName = (id) => getTierByPlanId(id).name;
