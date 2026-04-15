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
    id: 'free',
    name: 'Free',
    badge: 'Get Started',
    badgeBg: 'rgba(140,170,210,0.1)',
    badgeColor: 'var(--ink-secondary)',
    price: '$0',
    period: '/mo',
    description: 'Everything you need to start understanding your business better.',
    includesLabel: "What's included",
    features: [
      'AI Business Advisor',
      'Market Intelligence Brief',
      'Email Inbox & Calendar',
      'Competitive Benchmark',
      'Business Profile & DNA',
      'Data Health Monitor',
      'Actions & Alerts',
      'Ask BIQc AI Chat',
      'Up to 2 integrations',
    ],
    ctaLabel: 'Start Free',
    ctaStyle: 'outline',
  },
  {
    id: 'growth',
    name: 'Growth',
    badge: 'Most Popular',
    badgeBg: 'rgba(232,93,0,0.08)',
    badgeColor: 'var(--lava)',
    price: '$69',
    period: '/mo',
    description: 'Everything in Free, plus powerful tools to grow your revenue.',
    includesLabel: 'Everything in Free, plus',
    features: [
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
    badgeColor: '#080C14',
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
      ['AI Business Advisor', true, true, true, true],
      ['Ask BIQc AI Chat', true, true, true, true],
      ['Board Room (single-model AI)', false, true, true, true],
      ['War Room (multi-model AI)', false, false, true, true],
      ['Custom AI model training', false, false, false, true],
    ],
  },
  {
    group: 'Business Intelligence',
    rows: [
      ['Market Intelligence Brief', true, true, true, true],
      ['Competitive Benchmark', true, true, true, true],
      ['Business Profile & DNA', true, true, true, true],
      ['Intelligence Baseline', false, false, true, true],
      ['Intel Centre', false, false, true, true],
    ],
  },
  {
    group: 'Revenue & Finance',
    rows: [
      ['Revenue Analytics', false, true, true, true],
      ['Billing Management', false, true, true, true],
      ['Forensic Audit', false, true, true, true],
      ['Exposure Scan', false, true, true, true],
    ],
  },
  {
    group: 'Operations',
    rows: [
      ['Actions & Alerts', true, true, true, true],
      ['Email Inbox & Calendar', true, true, true, true],
      ['Data Health Monitor', true, true, true, true],
      ['Operations Centre', false, true, true, true],
      ['SOP Generator', false, true, true, true],
      ['Decision Tracker', false, true, true, true],
      ['Operator Dashboard', false, false, true, true],
      ['Ops Advisory', false, false, true, true],
    ],
  },
  {
    group: 'Marketing',
    rows: [
      ['Marketing Intelligence', false, true, true, true],
      ['Marketing Automation', false, true, true, true],
      ['Market Analysis', false, false, true, true],
    ],
  },
  {
    group: 'Risk & Compliance',
    rows: [
      ['Risk Intelligence', false, false, true, true],
      ['Compliance Centre', false, false, true, true],
      ['Watchtower', false, false, true, true],
      ['Audit Log', false, false, true, true],
    ],
  },
  {
    group: 'Reporting & Data',
    rows: [
      ['Reports Library', false, true, true, true],
      ['Analysis Suite', false, false, true, true],
      ['Data Centre', false, false, true, true],
      ['Document Library', false, false, true, true],
    ],
  },
  {
    group: 'Integrations & Support',
    rows: [
      ['Integrations', 'Up to 2', 'Up to 5', 'Unlimited', 'Unlimited + custom'],
      ['SSO & advanced security', false, false, false, true],
      ['SLA guarantees', false, false, false, true],
      ['Dedicated success manager', false, false, false, true],
      ['Multi-seat team access', false, false, false, true],
      ['Priority support', false, false, false, true],
    ],
  },
];

/* ────────────────────────────────────────────
   FAQ data
   ──────────────────────────────────────────── */
const FAQS = [
  {
    q: 'How does the 14-day free trial work?',
    a: 'When you sign up for Growth or Pro, you get full access to all features for 14 days at no cost. No credit card is required to start. At the end of the trial, you can choose to subscribe or downgrade to the Free plan without losing your data.',
  },
  {
    q: 'Can I cancel my subscription at any time?',
    a: "Yes, absolutely. There are no lock-in contracts. You can cancel or downgrade your plan at any time from your account settings. If you cancel, you'll retain access to your current plan until the end of your billing period, then automatically move to the Free plan.",
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
  dark: { background: 'var(--ink-display)', color: '#080C14', border: 'none' },
  outline: { background: 'transparent', color: 'var(--ink-display)', border: '1px solid rgba(140,170,210,0.2)' },
};

/* ────────────────────────────────────────────
   Page component
   ──────────────────────────────────────────── */
export default function Pricing() {
  usePageMeta({ title: 'Pricing — Plans for Every Business Stage', description: 'Simple, transparent pricing for BIQc. Start free, upgrade when you need more intelligence. Plans from $69 AUD/month.' });
  const { user } = useSupabaseAuth();
  const [compareOpen, setCompareOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const ctaHref = (plan) => {
    if (plan.id === 'enterprise') return '/contact?source=pricing';
    if (plan.id === 'free') return '/register-supabase';
    return user ? '/subscribe' : '/register-supabase';
  };

  return (
    <WebsiteLayout>
      {/* ── Hero ── */}
      <section className="py-20 md:py-24 text-center px-6"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(46,74,110,0.08) 0%, transparent 60%), linear-gradient(180deg, #080C14 0%, #0B1120 100%)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold mb-6"
            style={{ background: 'rgba(232,93,0,0.06)', color: 'var(--lava)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a4 4 0 0 0-8 0v2" /></svg>
            Pricing
          </div>
          <h1 className="text-4xl md:text-[52px] font-bold leading-[1.1] tracking-tight mb-4"
            style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)', letterSpacing: 'var(--ls-display)' }}>
            Simple, transparent pricing.
          </h1>
          <p className="text-lg max-w-[480px] mx-auto leading-relaxed"
            style={{ color: 'var(--ink-secondary)' }}>
            Start free. Upgrade when you're ready. No surprises, no hidden fees.
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
                    {['Feature', 'Free', 'Growth', 'Pro', 'Enterprise'].map((h, i) => (
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
                        <td colSpan={5} className="px-4 pt-3.5 pb-2 text-xs font-bold uppercase tracking-wide"
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
            No credit card required. Full access to Growth features. Cancel anytime.
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
