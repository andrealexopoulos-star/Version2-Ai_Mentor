import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../components/website/WebsiteLayout';
import usePageMeta from '../hooks/usePageMeta';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { planCtaHref } from '../lib/subscriptionUi';
import PricingCard from '../components/PricingCard';
import PricingFAQ from '../components/PricingFAQ';
import AlwaysFreeStrip from '../components/AlwaysFreeStrip';
import PremiumServices from '../components/PremiumServices';
import '../styles/pricing.css';

const planCtaLabel = (planId) => {
  if (planId === 'business') return 'Talk to us';
  if (planId === 'growth') return 'Start with Growth';
  if (planId === 'lite') return 'Start free trial';
  if (planId === 'pro') return 'Start free trial';
  return 'Start free trial';
};

const PLANS = [
  {
    id: 'lite',
    name: 'Lite',
    kicker: 'For solo operators',
    description: 'Try BIQc intelligence with one connected account.',
    price: '14',
    tokens: '150,000',
    features: [
      '1 integration',
      '10 signals, weekly refresh',
      '30-day memory',
      'Unlimited PDF / CSV / Excel exports',
      'Self-serve support',
    ],
    autoTopUp: null,
  },
  {
    id: 'growth',
    name: 'Growth',
    kicker: 'For owner-led SMBs',
    description: 'Daily intelligence across your sales, marketing, and finance.',
    price: '69',
    tokens: '1,000,000',
    recommended: true,
    features: [
      'Unlimited integrations and team seats',
      '50 signals, daily refresh',
      '90-day memory',
      'Email support',
    ],
    autoTopUp: {
      defaultAmount: '$50',
      exampleLabel: '$50 buys you',
      exampleValue: '~2.7M tokens of additional AI capacity (usage-dependent)',
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    kicker: 'For multi-function teams',
    description: '5x more thinking power with a quarterly strategy session included.',
    price: '199',
    tokens: '5,000,000',
    features: [
      'Unlimited integrations and team seats',
      '250 signals, 4x daily refresh',
      '12-month memory',
      '1 specialist session per quarter included',
      'Priority support',
    ],
    autoTopUp: {
      defaultAmount: '$50',
      exampleLabel: '$100 buys you',
      exampleValue: '~5.4M tokens of additional AI capacity (usage-dependent)',
    },
  },
  {
    id: 'business',
    name: 'Business',
    kicker: 'For growth-stage teams',
    description: 'Whole-business intelligence with onboarding and a dedicated CSM.',
    price: '349',
    tokens: '20,000,000',
    features: [
      'Unlimited integrations and team seats',
      '1,000 signals, hourly refresh',
      '24-month memory',
      'Onboarding + dedicated CSM included',
      'Priority support with quarterly reviews',
    ],
    autoTopUp: {
      defaultAmount: '$100',
      exampleLabel: '$500 buys you',
      exampleValue: '~27M tokens of additional AI capacity (usage-dependent)',
    },
  },
];

const HERO_BULLETS = [
  '14-day free trial',
  'No credit card to start',
  'Cancel anytime',
];

function BottomCTA({ user }) {
  const defaultPlan = '/subscribe?plan=starter';
  return (
    <section className="pricing-bottom-cta">
      <div className="pricing-container">
        <h2>Ready to give your business an AI brain?</h2>
        <p>14-day free trial · No credit card to start · Cancel anytime</p>
        <Link to={user ? defaultPlan : `/register-supabase?next=${encodeURIComponent(defaultPlan)}`}>Start free trial</Link>
        <div className="pricing-bottom-sub">
          Or <Link to="/speak-with-local-specialist">talk to a specialist</Link> if you want a guided setup.
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  usePageMeta({
    title: 'Pricing — BIQc Plans',
    description: 'Simple BIQc pricing in AUD. Pick Lite, Growth, Pro, or Business with always-free integrations and seats.',
  });
  const { user } = useSupabaseAuth();

  return (
    <WebsiteLayout>
      <section className="pricing-hero">
        <div className="pricing-container">
          <p className="pricing-hero-pill">Australian SMB intelligence</p>
          <h1>
            Simple pricing.
            <br />
            Pay for AI, everything else is free.
          </h1>
          <p className="pricing-hero-sub">
            Connect every account. Invite your whole team. Generate every report. BIQc only charges for the AI thinking we do on your behalf.
          </p>
          <div className="pricing-hero-checks">
            {HERO_BULLETS.map((bullet) => (
              <span key={bullet}>{bullet}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="pricing-plans">
        <div className="pricing-container pricing-grid">
          {PLANS.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              ctaTo={planCtaHref(user, plan.id)}
              ctaLabel={planCtaLabel(plan.id)}
            />
          ))}
        </div>
      </section>

      <AlwaysFreeStrip />
      <PremiumServices />

      <section className="pricing-coming-soon">
        <div className="pricing-container">
          <p className="coming-pill">Coming soon · Premium intelligence modules</p>
          <p>Industry forecasting · M&A intelligence · Regulatory monitoring · Competitor deep-dives · Add to any plan when needed.</p>
        </div>
      </section>

      <PricingFAQ />
      <BottomCTA user={user} />
    </WebsiteLayout>
  );
}

export default Pricing;
