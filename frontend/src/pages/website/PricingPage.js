import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';

const WEBSITE_FONTS = {
  display: 'var(--font-display)',
  body: 'var(--font-ui)',
  mono: 'var(--font-mono)',
};

/* ─── PLAN DATA (from approved mockup) ─── */
const PLANS = [
  {
    name: 'Free',
    badge: 'Get Started',
    badgeBg: 'rgba(140,170,210,0.1)', badgeColor: '#8FA0B8',
    price: '$0',
    period: '/mo',
    desc: 'Everything you need to start understanding your business better.',
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
    cta: 'Start Free',
    ctaStyle: 'outline',
    link: '/register-supabase',
  },
  {
    name: 'Growth',
    badge: 'Most Popular',
    badgeBg: 'rgba(232,93,0,0.08)', badgeColor: '#E85D00',
    price: '$69',
    period: '/mo',
    desc: 'Everything in Free, plus powerful tools to grow your revenue.',
    includesLabel: 'Everything in Free, plus',
    highlight: true,
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
    cta: 'Start 14-Day Trial',
    ctaStyle: 'primary',
    link: '/register-supabase',
  },
  {
    name: 'Pro',
    badge: 'Full Platform',
    badgeBg: '#EDF1F7', badgeColor: '#FAFAFA',
    price: '$199',
    period: '/mo',
    desc: 'Everything in Growth, plus enterprise-grade intelligence tools.',
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
    cta: 'Start 14-Day Trial',
    ctaStyle: 'dark',
    link: '/register-supabase',
  },
  {
    name: 'Business',
    badge: 'Full Scale',
    badgeBg: 'rgba(245,158,11,0.12)', badgeColor: '#F59E0B',
    price: '$349',
    period: '/mo',
    desc: 'Everything in Pro, plus premium AI models and team access.',
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
    cta: 'Start 14-Day Trial',
    ctaStyle: 'dark',
    link: '/register-supabase',
  },
  {
    name: 'Enterprise',
    badge: 'For Teams',
    badgeBg: 'rgba(37,99,235,0.12)', badgeColor: '#60A5FA',
    price: 'Custom',
    period: '',
    desc: 'Everything in Business, plus dedicated support and custom solutions.',
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
    cta: 'Contact Sales',
    ctaStyle: 'outline',
    link: '/contact',
  },
];

/* ─── COMPARISON TABLE DATA ─── */
const COMPARE_GROUPS = [
  {
    label: 'AI & Intelligence',
    rows: [
      ['AI Business Advisor', true, true, true, true],
      ['Ask BIQc AI Chat', true, true, true, true],
      ['Board Room (single-model AI)', false, true, true, true],
      ['War Room (multi-model AI)', false, false, true, true],
      ['Custom AI model training', false, false, false, true],
    ],
  },
  {
    label: 'Business Intelligence',
    rows: [
      ['Market Intelligence Brief', true, true, true, true],
      ['Competitive Benchmark', true, true, true, true],
      ['Business Profile & DNA', true, true, true, true],
      ['Intelligence Baseline', false, false, true, true],
      ['Intel Centre', false, false, true, true],
    ],
  },
  {
    label: 'Revenue & Finance',
    rows: [
      ['Revenue Analytics', false, true, true, true],
      ['Billing Management', false, true, true, true],
      ['Forensic Audit', false, true, true, true],
      ['Exposure Scan', false, true, true, true],
    ],
  },
  {
    label: 'Operations',
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
    label: 'Marketing',
    rows: [
      ['Marketing Intelligence', false, true, true, true],
      ['Marketing Automation', false, true, true, true],
      ['Market Analysis', false, false, true, true],
    ],
  },
  {
    label: 'Risk & Compliance',
    rows: [
      ['Risk Intelligence', false, false, true, true],
      ['Compliance Centre', false, false, true, true],
      ['Watchtower', false, false, true, true],
      ['Audit Log', false, false, true, true],
    ],
  },
  {
    label: 'Reporting & Data',
    rows: [
      ['Reports Library', false, true, true, true],
      ['Analysis Suite', false, false, true, true],
      ['Data Centre', false, false, true, true],
      ['Document Library', false, false, true, true],
    ],
  },
  {
    label: 'Integrations & Support',
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

/* ─── FAQ DATA ─── */
const FAQS = [
  {
    q: 'How does the 14-day free trial work?',
    a: "When you sign up for Growth or Pro, you get full access to all features for 14 days at no cost. No credit card is required to start. At the end of the trial, you can choose to subscribe or downgrade to the Free plan without losing your data.",
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

/* ─── COMPONENTS ─── */
const PlanCard = ({ plan }) => {
  const ctaMap = {
    primary: { bg: 'var(--lava)', color: 'var(--ink-inverse)', border: 'none' },
    dark: { bg: 'var(--ink-display)', color: 'var(--ink-inverse)', border: 'none' },
    outline: { bg: 'transparent', color: 'var(--ink-display)', border: '1px solid var(--border-strong)' },
  };
  const ctaS = ctaMap[plan.ctaStyle] || ctaMap.outline;
  return (
    <div
      className="relative rounded-2xl p-6 flex flex-col"
      style={{
        background: plan.highlight
          ? 'linear-gradient(105deg, rgba(200,220,240,0.0) 0%, rgba(200,220,240,0.06) 45%, rgba(200,220,240,0.0) 55%), rgba(232,93,0,0.025)'
          : 'linear-gradient(105deg, rgba(200,220,240,0.0) 0%, rgba(200,220,240,0.06) 45%, rgba(200,220,240,0.0) 55%), linear-gradient(180deg, rgba(140,170,210,0.04) 0%, rgba(140,170,210,0.01) 100%)',
        border: `1px solid ${plan.highlight ? 'var(--lava-ring)' : 'var(--border)'}`,
      }}
      data-testid={`plan-${plan.name.toLowerCase()}`}
    >
      <span
        className="text-[10px] font-semibold tracking-[0.08em] uppercase px-3 py-1 rounded-full inline-block mb-4 self-start"
        style={{ background: plan.badgeBg, color: plan.badgeColor, fontFamily: WEBSITE_FONTS.mono }}
      >
        {plan.badge}
      </span>
      <h3 className="text-lg font-bold mb-2" style={{ fontFamily: WEBSITE_FONTS.display, color: 'var(--ink-display)' }}>{plan.name}</h3>
      <div className="flex items-baseline gap-1 mb-1.5">
        <span className="text-[42px] font-bold leading-none tracking-tight" style={{ color: 'var(--ink-display)' }}>{plan.price}</span>
        {plan.period && <span className="text-[15px] font-medium" style={{ color: 'var(--ink-secondary)' }}>{plan.period}</span>}
      </div>
      <p className="text-sm mb-6" style={{ fontFamily: WEBSITE_FONTS.body, color: 'var(--ink-secondary)', lineHeight: 1.5, borderBottom: '1px solid var(--border)', paddingBottom: 24 }}>{plan.desc}</p>
      <div className="text-[12px] font-semibold uppercase tracking-[0.04em] mb-4" style={{ color: 'var(--ink-display)' }}>{plan.includesLabel}</div>
      <ul className="space-y-1.5 flex-1 mb-7">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--ink)', lineHeight: 1.4 }}>
            <Check className="w-4 h-4 shrink-0 mt-0.5 text-[var(--positive)]" />
            {f}
          </li>
        ))}
      </ul>
      <Link
        to={plan.link}
        className="w-full block text-center py-3 rounded-lg text-sm font-semibold transition-all hover:brightness-110"
        style={{ background: ctaS.bg, color: ctaS.color, border: ctaS.border, fontFamily: WEBSITE_FONTS.body }}
        data-testid={`cta-${plan.name.toLowerCase()}`}
      >
        {plan.cta}
      </Link>
    </div>
  );
};

const FaqItem = ({ q, a, open, onToggle }) => {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 text-left"
        style={{ fontFamily: WEBSITE_FONTS.body }}
      >
        <span className="text-base font-semibold pr-4" style={{ color: 'var(--ink-display)', lineHeight: 1.4 }}>{q}</span>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-secondary)" strokeWidth="2"
          className="shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}
        >
          <path strokeLinecap="round" d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <div
        className="overflow-hidden transition-all"
        style={{ maxHeight: open ? 400 : 0, opacity: open ? 1 : 0 }}
      >
        <p className="pb-5 text-[15px]" style={{ fontFamily: WEBSITE_FONTS.body, color: 'var(--ink-secondary)', lineHeight: 1.6 }}>{a}</p>
      </div>
    </div>
  );
};

/* ─── INJECTED CSS FOR HOVER EFFECTS ─── */
const tableHoverCSS = `
.biqc-compare-row:hover td { background: rgba(140,170,210,0.03) !important; }
`;

/* ─── PAGE ─── */
const PricingPage = () => {
  const [showCompare, setShowCompare] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <WebsiteLayout>
      <style>{tableHoverCSS}</style>
      {/* HERO */}
      <section className="pt-16 sm:pt-28 pb-12 px-6 text-center" data-testid="pricing-hero">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full mb-6 text-[13px] font-semibold" style={{ background: 'var(--lava-soft)', color: 'var(--lava)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg>
            Pricing
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-tight mb-4" style={{ fontFamily: WEBSITE_FONTS.display, color: 'var(--ink-display)', lineHeight: 1.12, letterSpacing: '-0.02em' }}>
            Simple, transparent pricing.
          </h1>
          <p className="text-base sm:text-lg" style={{ fontFamily: WEBSITE_FONTS.body, color: 'var(--ink-secondary)', lineHeight: 1.6 }}>
            Start free. Upgrade when you're ready. No surprises, no hidden fees.
          </p>
        </div>
      </section>

      {/* PRICING CARDS */}
      <section className="pb-16 px-4 sm:px-6" data-testid="pricing-cards">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLANS.map(plan => <PlanCard key={plan.name} plan={plan} />)}
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="py-16 px-4 sm:px-6" style={{ borderTop: '1px solid var(--border)' }} data-testid="pricing-compare">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3" style={{ fontFamily: WEBSITE_FONTS.display, color: 'var(--ink-display)', letterSpacing: '-0.02em' }}>Compare all features</h2>
            <p className="text-[15px]" style={{ fontFamily: WEBSITE_FONTS.body, color: 'var(--ink-secondary)' }}>A detailed breakdown of what's included in every plan.</p>
          </div>
          <div className="flex justify-center mb-6">
            <button
              onClick={() => setShowCompare(!showCompare)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:shadow-lg"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-display)', fontFamily: WEBSITE_FONTS.body }}
            >
              {showCompare ? 'Hide full comparison' : 'Show full comparison'}
              <ChevronDown className={`w-4 h-4 transition-transform ${showCompare ? 'rotate-180' : ''}`} style={{ color: 'var(--ink-secondary)' }} />
            </button>
          </div>
          {showCompare && (
            <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 64, zIndex: 10 }}>
                  <tr style={{ background: 'var(--canvas-app)' }}>
                    <th className="text-left py-3 px-4 font-semibold" style={{ color: 'var(--ink-display)', fontFamily: WEBSITE_FONTS.body, minWidth: 140, background: 'var(--canvas-app)' }}>Feature</th>
                    <th className="text-center py-3 px-4 font-semibold" style={{ color: 'var(--ink-display)', fontFamily: WEBSITE_FONTS.body, background: 'var(--canvas-app)' }}>Free</th>
                    <th className="text-center py-3 px-4 font-semibold" style={{ color: 'var(--ink-display)', fontFamily: WEBSITE_FONTS.body, background: 'var(--canvas-app)' }}>Growth</th>
                    <th className="text-center py-3 px-4 font-semibold" style={{ color: 'var(--ink-display)', fontFamily: WEBSITE_FONTS.body, background: 'var(--canvas-app)' }}>Pro</th>
                    <th className="text-center py-3 px-4 font-semibold" style={{ color: 'var(--ink-display)', fontFamily: WEBSITE_FONTS.body, background: 'var(--canvas-app)' }}>Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_GROUPS.map(group => (
                    <React.Fragment key={group.label}>
                      <tr>
                        <td colSpan={5} className="py-3 px-4 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ink-secondary)', fontFamily: WEBSITE_FONTS.mono, background: 'var(--canvas-app)', borderTop: '1px solid var(--border)' }}>
                          {group.label}
                        </td>
                      </tr>
                      {group.rows.map(([feature, ...tiers], ri) => (
                        <tr key={ri} className="biqc-compare-row" style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="py-2.5 px-4" style={{ color: 'var(--ink)', fontFamily: WEBSITE_FONTS.body }}>{feature}</td>
                          {tiers.map((v, ti) => (
                            <td key={ti} className="py-2.5 px-4 text-center">
                              {v === true ? <Check className="w-4 h-4 mx-auto text-[var(--positive)]" /> : v === false ? <span className="text-[var(--ink-muted)]">—</span> : <span className="text-sm" style={{ color: 'var(--ink)', fontFamily: WEBSITE_FONTS.body }}>{v}</span>}
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

      {/* FAQ */}
      <section className="py-20 px-6" style={{ borderTop: '1px solid var(--border)' }} data-testid="pricing-faq">
        <div className="max-w-[720px] mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-[32px] font-bold tracking-tight mb-3" style={{ fontFamily: WEBSITE_FONTS.display, color: 'var(--ink-display)', letterSpacing: '-0.02em' }}>Frequently asked questions</h2>
            <p className="text-base" style={{ fontFamily: WEBSITE_FONTS.body, color: 'var(--ink-secondary)' }}>Everything you need to know about BIQc pricing and plans.</p>
          </div>
          <div>
            {FAQS.map((faq, i) => <FaqItem key={i} q={faq.q} a={faq.a} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} />)}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="py-20 px-6 text-center" style={{ borderTop: '1px solid var(--border)' }} data-testid="pricing-bottom-cta">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4" style={{ fontFamily: WEBSITE_FONTS.display, color: 'var(--ink-display)', letterSpacing: '-0.02em' }}>Start your 14-day trial today</h2>
          <p className="text-base mb-8" style={{ fontFamily: WEBSITE_FONTS.body, color: 'var(--ink-secondary)' }}>No credit card required. Full access to Growth features. Cancel anytime.</p>
          <Link
            to="/register-supabase"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg text-base font-semibold text-white transition-all hover:brightness-110"
            style={{ background: 'var(--lava)', fontFamily: WEBSITE_FONTS.body, boxShadow: '0 4px 16px var(--lava-ring)' }}
          >
            Start 14-Day Trial <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </WebsiteLayout>
  );
};

export default PricingPage;
