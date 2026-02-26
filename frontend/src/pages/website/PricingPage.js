import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { ArrowRight, Check, Plus } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";
const BODY = "'Inter', sans-serif";

const plans = [
  {
    name: 'Market Intelligence Brief',
    tagline: 'Complimentary',
    price: 'Free',
    period: '',
    target: 'Any business with a website',
    color: '#FF6A00',
    highlight: false,
    isFree: true,
    features: [
      '13-layer public digital footprint scan',
      'Market Presence Score',
      'Competitive Position Overview',
      'Category Positioning Map (public signals)',
      'Funnel friction flags (observable only)',
      'Trust footprint comparison',
      'Market saturation visibility',
      'Data confidence indicator',
    ],
    notIncluded: 'No integrations. No internal modelling. No stored history.',
    cta: 'Generate Market Brief',
    link: '/register-supabase',
  },
  {
    name: 'Foundation',
    tagline: 'Performance Visibility',
    price: '$750',
    period: '/month',
    target: '$3M\u2013$8M businesses',
    color: '#10B981',
    highlight: false,
    features: [
      'Live market metrics (with integrations)',
      'CAC & channel tracking',
      'Competitive positioning summary',
      'Revenue trend & revenue mix',
      'Revenue per employee',
      'Basic churn detection',
      'Cash position overview',
      'AR aging visibility',
      'Wage-to-revenue ratio',
      'Workforce baseline metrics',
      '60-day forecast',
      'Data confidence indicators',
    ],
    notIncluded: 'No advanced modelling. No scenario engine. No saturation modelling.',
    cta: 'Get Started',
    link: '/register-supabase',
  },
  {
    name: 'Performance',
    tagline: 'Margin Control',
    price: '$1,950',
    period: '/month',
    target: '$8M\u2013$20M businesses',
    color: '#3B82F6',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Everything in Foundation',
      'Service-line profitability tracking',
      'Margin compression detection',
      'Revenue concentration alerts',
      'Capacity strain detection',
      'Hiring trigger alerts',
      'Role productivity benchmarking',
      'Overtime risk modelling',
      'Funnel friction detection',
      'Category positioning map',
      'Trust footprint comparison',
      '90-day projections',
    ],
    cta: 'Upgrade to Performance',
    link: '/register-supabase',
  },
  {
    name: 'Growth',
    tagline: 'Scale Intelligence',
    price: '$3,900',
    period: '/month',
    target: 'Serious growth operators',
    color: '#A855F7',
    highlight: false,
    features: [
      'Everything in Performance',
      'Margin per role modelling',
      'Payroll yield analysis',
      'Capacity saturation forecast',
      'Underperformance variance detection',
      'Hiring vs outsource modelling',
      'Revenue expansion simulation',
      'Margin impact simulation',
      'Cashflow interaction modelling',
      'Saturation density scoring',
      'Demand intensity modelling',
      'Competitive acceleration tracking',
    ],
    cta: 'Upgrade to Growth',
    link: '/register-supabase',
  },
  {
    name: 'Enterprise',
    tagline: 'Strategic Command',
    price: 'Contact Sales',
    period: '',
    target: 'Multi-division organisations',
    color: '#EF4444',
    highlight: false,
    features: [
      'Everything in Growth',
      'Multi-division reporting',
      'Custom KPI modelling',
      'Governance controls',
      'Board-level reporting automation',
      'Custom integrations',
      'Sovereign hosting options',
      'Dedicated support',
      'AI usage customisation',
    ],
    cta: 'Contact Sales',
    link: '/contact',
  },
];

const addOns = [
  { name: 'Advanced AI Modelling Pack', price: '$500\u2013$1,200/mo', desc: 'Extended modelling depth based on usage intensity' },
  { name: 'Multi-Location Benchmarking', price: '$400/mo', desc: 'Per additional entity comparison' },
  { name: 'Executive Reporting Suite', price: '$350/mo', desc: 'Board-ready PDF exports with custom branding' },
  { name: 'Dedicated Data Sync Frequency', price: '$300\u2013$800/mo', desc: 'Real-time or hourly sync vs standard daily' },
];

const PricingPage = () => (
  <WebsiteLayout>
    {/* HERO */}
    <section className="relative overflow-hidden" data-testid="pricing-hero">
      <div className="absolute top-10 right-10 w-[500px] h-[500px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #FF6A00 0%, transparent 70%)' }} />
      <div className="max-w-5xl mx-auto px-6 pt-28 pb-8 relative z-10 text-center">
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#FF6A00] mb-5 block" style={{ fontFamily: MONO }}>
          Performance Intelligence
        </span>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.15] mb-4 tracking-tight" style={{ fontFamily: HEAD, color: '#FFFFFF' }}>
          Executive-Grade Intelligence.<br />Priced Against the Alternative.
        </h1>
        <p className="text-base text-[#9FB0C3] max-w-lg mx-auto mb-2" style={{ fontFamily: BODY }}>
          BIQc replaces parts of a fractional CFO, ops strategist, and commercial advisor.
        </p>
        <p className="text-xs text-[#64748B]" style={{ fontFamily: MONO }}>
          Not a dashboard. Not a chatbot. Performance infrastructure.
        </p>
      </div>
    </section>

    {/* 4-TIER PRICING */}
    <section className="py-14 px-4 sm:px-6" data-testid="pricing-plans">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => (
            <div key={plan.name}
              className={`relative rounded-2xl p-6 flex flex-col transition-all ${plan.highlight ? 'ring-2 ring-[#FF6A00] z-10' : ''}`}
              style={{
                background: plan.highlight ? 'rgba(255,106,0,0.03)' : 'rgba(255,255,255,0.015)',
                border: `1px solid ${plan.highlight ? 'rgba(255,106,0,0.25)' : 'rgba(255,255,255,0.06)'}`,
              }}
              data-testid={`plan-${plan.name.toLowerCase()}`}>

              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[9px] font-bold tracking-[0.15em] uppercase px-4 py-1 rounded-full text-white" style={{ background: '#FF6A00', fontFamily: MONO }}>
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Plan color accent */}
              <div className="w-8 h-1 rounded-full mb-4" style={{ background: plan.color }} />

              <h3 className="text-lg font-bold text-white mb-0.5" style={{ fontFamily: HEAD }}>{plan.name}</h3>
              <p className="text-[11px] mb-4" style={{ color: plan.color, fontFamily: MONO }}>{plan.tagline}</p>

              <div className="mb-1">
                <span className="text-3xl font-bold text-white" style={{ fontFamily: MONO }}>{plan.price}</span>
                {plan.period && <span className="text-sm text-[#64748B] ml-1">{plan.period}</span>}
              </div>
              <p className="text-[10px] text-[#4A5568] mb-5" style={{ fontFamily: MONO }}>{plan.target}</p>

              <Link to={plan.link}
                className={`w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold mb-6 transition-all hover:brightness-110`}
                style={{
                  background: plan.highlight ? '#FF6A00' : 'rgba(255,255,255,0.04)',
                  color: plan.highlight ? 'white' : '#F4F7FA',
                  border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  fontFamily: BODY,
                }}
                data-testid={`cta-${plan.name.toLowerCase()}`}>
                {plan.cta} <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <div className="space-y-2 flex-1">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: plan.color }} />
                    <span className="text-xs text-[#9FB0C3] leading-relaxed" style={{ fontFamily: BODY }}>{f}</span>
                  </div>
                ))}
              </div>

              {plan.notIncluded && (
                <p className="text-[10px] text-[#4A5568] mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', fontFamily: MONO }}>
                  {plan.notIncluded}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ADD-ON MODULES */}
    <section className="py-14 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} data-testid="pricing-addons">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: HEAD }}>Add-On Modules</h2>
          <p className="text-sm text-[#9FB0C3]" style={{ fontFamily: BODY }}>Extend depth without changing plan. Available on Performance tier and above.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {addOns.map((a) => (
            <div key={a.name} className="rounded-xl p-5 flex items-start gap-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,106,0,0.08)' }}>
                <Plus className="w-4 h-4 text-[#FF6A00]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white mb-0.5" style={{ fontFamily: HEAD }}>{a.name}</h4>
                <p className="text-[11px] text-[#FF6A00] mb-1" style={{ fontFamily: MONO }}>{a.price}</p>
                <p className="text-xs text-[#64748B]" style={{ fontFamily: BODY }}>{a.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ROI JUSTIFICATION */}
    <section className="py-14 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-xl font-bold text-white mb-6" style={{ fontFamily: HEAD }}>The Cost of Not Knowing</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {[
            { label: 'One bad hire', cost: '$45K\u2013$120K', desc: 'Recruitment + ramp + separation' },
            { label: 'One margin leak', cost: '$20K\u2013$80K/yr', desc: 'Undetected for 6\u201312 months' },
            { label: 'One mispriced contract', cost: '$15K\u2013$50K', desc: 'Revenue left on the table' },
            { label: 'One poor marketing quarter', cost: '$30K\u2013$100K', desc: 'Wasted spend + missed pipeline' },
          ].map(r => (
            <div key={r.label} className="rounded-xl p-5 text-left" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}>
              <p className="text-sm font-semibold text-white mb-1" style={{ fontFamily: HEAD }}>{r.label}</p>
              <p className="text-lg font-bold text-[#EF4444] mb-1" style={{ fontFamily: MONO }}>{r.cost}</p>
              <p className="text-[11px] text-[#64748B]" style={{ fontFamily: MONO }}>{r.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-[#9FB0C3]" style={{ fontFamily: BODY }}>
          BIQc at $1,950/month pays for itself with a single prevented mistake.
        </p>
      </div>
    </section>

    {/* TRUST */}
    <section className="py-10" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-3xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {[
          { label: 'No Lock-In', desc: 'Cancel anytime' },
          { label: '14-Day Trial', desc: 'Full access, no card' },
          { label: 'AU Sovereign', desc: 'Sydney & Melbourne only' },
          { label: 'AES-256', desc: 'Defence-grade encryption' },
        ].map(t => (
          <div key={t.label} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm font-semibold text-white mb-0.5" style={{ fontFamily: HEAD }}>{t.label}</p>
            <p className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{t.desc}</p>
          </div>
        ))}
      </div>
    </section>

    {/* BOTTOM CTA */}
    <section className="py-16 px-6" style={{ background: 'rgba(255,106,0,0.05)', borderTop: '1px solid rgba(255,106,0,0.12)' }}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3" style={{ fontFamily: HEAD }}>
          Ready to see what you're missing?
        </h2>
        <p className="text-[#9FB0C3] mb-6" style={{ fontFamily: BODY }}>
          Start with a full digital footprint scan. Then decide if you need deeper intelligence.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/register-supabase" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold text-white transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #FF6A00, #E85D00)', fontFamily: HEAD, boxShadow: '0 8px 32px rgba(255,106,0,0.25)' }} data-testid="pricing-bottom-cta">
            Start Free Scan <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/contact" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold text-white/80 transition-all hover:text-white"
            style={{ border: '1px solid rgba(255,255,255,0.1)', fontFamily: HEAD }}>
            Talk to Sales
          </Link>
        </div>
      </div>
    </section>
  </WebsiteLayout>
);

export default PricingPage;
