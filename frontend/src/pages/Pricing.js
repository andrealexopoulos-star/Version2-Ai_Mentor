/**
 * Pricing — "Simple, transparent pricing" marketing page.
 *
 * Sections: Hero, Plan Cards (4), Comparison Table (collapsible), FAQ (5), Bottom CTA.
 * Uses WebsiteLayout wrapper. No auth required.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../components/website/WebsiteLayout';
import usePageMeta from '../hooks/usePageMeta';
import { Check, ChevronDown, Plus, ArrowRight } from 'lucide-react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';

/* ────────────────────────────────────────────
   Plan card data (mirrors mockup exactly)
   ──────────────────────────────────────────── */
const PLANS = [
  {
    id: 'growth',
    name: 'Growth',
    badge: '14-day free trial · Most Popular',
    badgeBg: 'rgba(232,93,0,0.08)',
    badgeColor: 'var(--lava)',
    price: '$69',
    period: '/mo',
    description: 'Everything you need to understand, grow, and protect your business. Start with a 14-day trial — cancel anytime before day 14 for $0.',
    includesLabel: "What's included",
    features: [
      'AI Business Advisor',
      'Market Intelligence Brief',
      'Ask BIQc AI Chat',
      'Business Profile & DNA',
      'Email Inbox & Calendar',
      'Competitive Benchmark',
      'Data Health Monitor',
      'Actions & Alerts',
      'Board Room (single-model AI)',
      'Revenue Analytics',
      'Operations Centre',
      'Reports Library',
      'SOP Generator',
      'Decision Tracker',
      'Forensic Audit',
      'Exposure Scan',
      'Marketing Intelligence',
      'Marketing Automation',
      'Billing Management',
      'Up to 5 integrations',
    ],
    ctaLabel: 'Start 14-Day Trial',
    ctaStyle: 'primary',
    highlighted: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    badge: 'Full Platform',
    badgeBg: 'var(--ink-display)',
    badgeColor: '#FAFAFA',
    price: '$199',
    period: '/mo',
    description: 'Everything in Growth, plus enterprise-grade intelligence tools.',
    includesLabel: 'Everything in Growth, plus',
    features: [
      'War Room (multi-model AI: GPT + Claude + Gemini)',
      'Risk Intelligence',
      'Compliance Centre',
      'Analysis Suite',
      'Watchtower',
      'Intel Centre',
      'Data Centre',
      'Intelligence Baseline',
      'Operator Dashboard',
      'Market Analysis',
      'Ops Advisory',
      'Audit Log',
      'Document Library',
      'Unlimited integrations',
    ],
    ctaLabel: 'Start 14-Day Trial',
    ctaStyle: 'dark',
  },
  {
    id: 'business',
    name: 'Business',
    badge: 'Full Scale',
    badgeBg: 'rgba(245,158,11,0.12)',
    badgeColor: '#F59E0B',
    price: '$349',
    period: '/mo',
    description: 'Everything in Pro, plus premium AI models and team access.',
    includesLabel: 'Everything in Pro, plus',
    features: [
      'All premium AI model access (Claude, GPT-5.4)',
      '15M input + 6M output tokens/month',
      'Advanced risk & compliance modules',
      'Priority model routing',
      'Up to 15 integrations',
      'Team collaboration (up to 5 seats)',
      'Dedicated onboarding session',
    ],
    ctaLabel: 'Start 14-Day Trial',
    ctaStyle: 'dark',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    badge: 'For Teams',
    badgeBg: 'rgba(37,99,235,0.12)',
    badgeColor: '#60A5FA',
    price: 'Custom',
    period: '',
    description: 'Everything in Business, plus dedicated support and custom solutions.',
    includesLabel: 'Everything in Business, plus',
    features: [
      'Dedicated success manager',
      'Custom integrations',
      'SSO & advanced security',
      'SLA guarantees',
      'Custom AI model training',
      'Multi-seat team access',
      'Priority support',
    ],
    ctaLabel: 'Contact Sales',
    ctaStyle: 'outline',
  },
];

/* ────────────────────────────────────────────
   Comparison table data
   ──────────────────────────────────────────── */
const COMPARISON = [
  {
    group: 'AI & Intelligence',
    rows: [
      ['AI Business Advisor', true, true, true],
      ['Ask BIQc AI Chat', true, true, true],
      ['Board Room (single-model AI)', true, true, true],
      ['War Room (multi-model AI)', false, true, true],
      ['Custom AI model training', false, false, true],
    ],
  },
  {
    group: 'Business Intelligence',
    rows: [
      ['Market Intelligence Brief', true, true, true],
      ['Competitive Benchmark', true, true, true],
      ['Business Profile & DNA', true, true, true],
      ['Intelligence Baseline', false, true, true],
      ['Intel Centre', false, true, true],
    ],
  },
  {
    group: 'Revenue & Finance',
    rows: [
      ['Revenue Analytics', true, true, true],
      ['Billing Management', true, true, true],
      ['Forensic Audit', true, true, true],
      ['Exposure Scan', true, true, true],
    ],
  },
  {
    group: 'Operations',
    rows: [
      ['Actions & Alerts', true, true, true],
      ['Email Inbox & Calendar', true, true, true],
      ['Data Health Monitor', true, true, true],
      ['Operations Centre', true, true, true],
      ['SOP Generator', true, true, true],
      ['Decision Tracker', true, true, true],
      ['Operator Dashboard', false, true, true],
      ['Ops Advisory', false, true, true],
    ],
  },
  {
    group: 'Marketing',
    rows: [
      ['Marketing Intelligence', true, true, true],
      ['Marketing Automation', true, true, true],
      ['Market Analysis', false, true, true],
    ],
  },
  {
    group: 'Risk & Compliance',
    rows: [
      ['Risk Intelligence', false, true, true],
      ['Compliance Centre', false, true, true],
      ['Watchtower', false, true, true],
      ['Audit Log', false, true, true],
    ],
  },
  {
    group: 'Reporting & Data',
    rows: [
      ['Reports Library', true, true, true],
      ['Analysis Suite', false, true, true],
      ['Data Centre', false, true, true],
      ['Document Library', false, true, true],
    ],
  },
  {
    group: 'Integrations & Support',
    rows: [
      ['Integrations', 'Up to 5', 'Unlimited', 'Unlimited + custom'],
      ['SSO & advanced security', false, false, true],
      ['SLA guarantees', false, false, true],
      ['Dedicated success manager', false, false, true],
      ['Multi-seat team access', false, false, true],
      ['Priority support', false, false, true],
    ],
  },
];

/* ────────────────────────────────────────────
   FAQ data
   ──────────────────────────────────────────── */
const FAQS = [
  {
    q: 'How does the 14-day trial work?',
    a: 'When you sign up, you start a 14-day Growth trial with full access to every Growth feature. Your card is captured at signup by Stripe (BIQc never sees it) and charged automatically on day 14 — unless you cancel before then for $0. We email a reminder 3 days before the charge date.',
  },
  {
    q: 'Can I cancel my subscription at any time?',
    a: "Yes, absolutely. There are no lock-in contracts. You can cancel or downgrade your plan at any time from your account settings in two clicks. If you cancel mid-billing-period, you keep access until the end of that period; after that, your account moves to read-only — your data stays intact, and you can reactivate any time with no learning lost.",
  },
  {
    q: 'Where is my data stored and is it secure?',
    a: 'All data is hosted in Australia on enterprise-grade infrastructure. We use end-to-end encryption for data in transit and at rest, and follow SOC 2 security practices. Your data is never shared with third parties or used to train AI models. You own your data, always.',
  },
  {
    q: 'Which integrations are supported?',
    a: 'BIQc integrates with Xero, MYOB, HubSpot, Salesforce, Outlook, Gmail, ServiceM8, Tradify, and Deputy out of the box. Enterprise customers can request custom integrations via our Merge.dev-powered integration layer. New integrations are added regularly based on customer feedback.',
  },
  {
    q: 'What security certifications do you have?',
    a: 'BIQc follows SOC 2 Type II security practices and complies with the Australian Privacy Act 1988. All data is encrypted using AES-256 at rest and TLS 1.3 in transit. We conduct regular penetration testing and security audits. Enterprise plans include additional security features like SSO, IP whitelisting, and dedicated security reviews.',
  },
];

/* ── Helpers ── */
const CellValue = ({ value }) => {
  if (value === true) return <Check className="w-[18px] h-[18px] mx-auto" style={{ color: '#16A34A' }} />;
  if (value === false) return <div className="mx-auto w-[18px] h-[2px] rounded-full" style={{ background: 'rgba(140,170,210,0.2)' }} />;
  return <span className="text-sm" style={{ color: 'var(--ink)' }}>{value}</span>;
};

const ctaStyles = {
  primary: { background: 'var(--lava)', color: '#fff', border: 'none' },
  dark: { background: 'var(--ink-display)', color: '#FAFAFA', border: 'none' },
  outline: { background: 'transparent', color: 'var(--ink-display)', border: '1px solid rgba(140,170,210,0.2)' },
};

/* ────────────────────────────────────────────
   Page component
   ──────────────────────────────────────────── */
export default function Pricing() {
  usePageMeta({ title: 'Pricing — Plans for Every Business Stage', description: 'Simple, transparent pricing for BIQc. 14-day trial, upgrade when you need more intelligence. Plans from $69 AUD/month.' });
  const { user } = useSupabaseAuth();
  const [compareOpen, setCompareOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const ctaHref = (plan) => {
    if (plan.id === 'enterprise') return '/contact?source=pricing';
    // 2026-04-19: no free tier. All signups start a 14-day Growth trial.
    return user ? '/subscribe' : '/register-supabase';
  };

  return (
    <WebsiteLayout>
      {/* ── Hero ── */}
      <section className="py-20 md:py-24 text-center px-6"
        style={{ background: 'var(--canvas-sage)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold mb-6"
            style={{ background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(10,10,10,0.08)', color: 'var(--ink-secondary)' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--lava)', display: 'inline-block' }} />
            Pricing
          </div>
          <h1 className="text-4xl md:text-[52px] font-bold leading-[1.1] tracking-tight mb-4"
            style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-marketing-display)', letterSpacing: '-0.035em' }}>
            Simple, transparent pricing.
          </h1>
          <p className="text-lg max-w-[480px] mx-auto leading-relaxed"
            style={{ color: 'var(--ink-secondary)' }}>
            Start your 14-day trial. Upgrade when you're ready. No surprises, no hidden fees.
          </p>
        </div>
      </section>

      {/* ── Pricing Cards ── */}
      <section className="pb-20 px-6" style={{ background: 'var(--canvas)' }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {PLANS.map((plan) => (
              <div key={plan.id}
                className="rounded-xl p-8 relative transition-shadow duration-200 hover:shadow-lg"
                style={{
                  background: 'var(--surface)',
                  border: plan.highlighted ? '2px solid var(--lava)' : '1px solid var(--border)',
                  borderRadius: 'var(--r-lg)',
                  boxShadow: plan.highlighted ? '0 4px 16px rgba(232,93,0,0.08)' : 'var(--elev-1)',
                }}>
                <span className="inline-block text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full mb-5"
                  style={{ background: plan.badgeBg, color: plan.badgeColor }}>
                  {plan.badge}
                </span>
                <div className="text-xl font-bold mb-2" style={{ color: 'var(--ink-display)' }}>{plan.name}</div>
                <div className="flex items-baseline gap-1 mb-1.5">
                  <span className="text-[42px] font-bold leading-none tracking-tight" style={{ color: 'var(--ink-display)' }}>{plan.price}</span>
                  {plan.period && <span className="text-[15px] font-medium" style={{ color: 'var(--ink-secondary)' }}>{plan.period}</span>}
                </div>
                <p className="text-sm mb-6 pb-6"
                  style={{ color: 'var(--ink-secondary)', borderBottom: '1px solid var(--border)' }}>
                  {plan.description}
                </p>
                <div className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--ink-display)' }}>
                  {plan.includesLabel}
                </div>
                <ul className="space-y-2.5 mb-7">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm leading-snug" style={{ color: 'var(--ink)' }}>
                      <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#16A34A' }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to={ctaHref(plan)}
                  className="block w-full py-3 text-sm font-semibold text-center transition-all hover:brightness-110"
                  style={{ ...ctaStyles[plan.ctaStyle], borderRadius: 'var(--r-md)' }}>
                  {plan.ctaLabel}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison Table ── */}
      <section className="py-16 px-6"
        style={{ background: 'var(--canvas)', borderTop: '1px solid var(--border)' }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-[28px] font-bold tracking-tight mb-3"
              style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)', letterSpacing: 'var(--ls-display)' }}>
              Compare all features
            </h2>
            <p className="text-[15px]" style={{ color: 'var(--ink-secondary)' }}>
              A detailed breakdown of what's included in every plan.
            </p>
          </div>

          <div className="flex justify-center mb-6">
            <button onClick={() => setCompareOpen(!compareOpen)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:shadow-md"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-display)' }}>
              {compareOpen ? 'Hide full comparison' : 'Show full comparison'}
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${compareOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {compareOpen && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Feature', 'Growth', 'Pro', 'Enterprise'].map((h, i) => (
                      <th key={h}
                        className={`${i === 0 ? 'text-left' : 'text-center min-w-[100px]'} px-4 py-3 font-semibold sticky top-16 z-10`}
                        style={{ color: 'var(--ink-display)', background: 'var(--canvas)', borderBottom: '1px solid var(--border)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((group) => (
                    <React.Fragment key={group.group}>
                      <tr>
                        <td colSpan={4} className="px-4 pt-3.5 pb-2 text-xs font-bold uppercase tracking-wide"
                          style={{ color: 'var(--ink-secondary)', background: 'var(--canvas)' }}>
                          {group.group}
                        </td>
                      </tr>
                      {group.rows.map(([feature, ...values]) => (
                        <tr key={feature} className="transition-colors hover:bg-white/[0.02]">
                          <td className="px-4 py-2.5" style={{ color: 'var(--ink)', borderBottom: '1px solid var(--border)' }}>
                            {feature}
                          </td>
                          {values.map((v, i) => (
                            <td key={i} className="px-4 py-2.5 text-center" style={{ borderBottom: '1px solid var(--border)' }}>
                              <CellValue value={v} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 px-6"
        style={{ background: 'var(--canvas)', borderTop: '1px solid var(--border)' }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-[32px] font-bold tracking-tight mb-3"
              style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)', letterSpacing: 'var(--ls-display)' }}>
              Frequently asked questions
            </h2>
            <p className="text-base" style={{ color: 'var(--ink-secondary)' }}>
              Everything you need to know about BIQc pricing and plans.
            </p>
          </div>
          <div className="max-w-[720px] mx-auto">
            {FAQS.map((faq, i) => (
              <div key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between py-5 text-left text-base font-semibold leading-snug"
                  style={{ color: 'var(--ink-display)' }}>
                  {faq.q}
                  <Plus className={`w-[18px] h-[18px] shrink-0 ml-4 transition-transform duration-200 ${openFaq === i ? 'rotate-45' : ''}`}
                    style={{ color: 'var(--ink-secondary)' }} />
                </button>
                <div className="overflow-hidden transition-all duration-300"
                  style={{ maxHeight: openFaq === i ? '400px' : '0', paddingBottom: openFaq === i ? undefined : 0 }}>
                  <p className="pb-5 text-[15px] leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-20 px-6 text-center"
        style={{ background: 'var(--canvas)', borderTop: '1px solid var(--border)' }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold tracking-tight mb-4"
            style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)', letterSpacing: 'var(--ls-display)' }}>
            Start your 14-day trial today
          </h2>
          <p className="text-base mb-8" style={{ color: 'var(--ink-secondary)' }}>
            14-day trial. Full access to Growth features. Cancel anytime before day 14 for $0.
          </p>
          <Link to="/register-supabase"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-white transition-all hover:brightness-110"
            style={{ background: 'var(--lava)', borderRadius: 'var(--r-md)', boxShadow: '0 4px 16px rgba(232,93,0,0.3)' }}>
            Start 14-Day Trial <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </WebsiteLayout>
  );
}
