import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { ArrowRight, Check } from 'lucide-react';

const HEADING = "'Cormorant Garamond', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";
const BODY = "'Inter', sans-serif";

const plans = [
  {
    name: 'Business Snapshot',
    tagline: 'Forensic Digital Footprint Overview',
    price: 'Free',
    period: '',
    highlight: false,
    features: [
      'Public digital footprint scan',
      'Market presence score',
      'Competitive overview',
      'High-level digital gaps identified',
      'Limited rescans',
      'No system integrations',
    ],
    cta: 'Start Free Scan',
    link: '/register-supabase',
  },
  {
    name: 'Foundation',
    tagline: 'Performance Visibility',
    price: '$49',
    period: '/mo',
    highlight: false,
    features: [
      'Live market metrics (with integrations)',
      'Revenue tracking',
      'CRM pipeline visibility',
      'Cash position overview',
      'Workforce baseline metrics',
      '60-day performance forecast',
      'Data confidence indicators',
    ],
    cta: 'Upgrade to Foundation',
    link: '/register-supabase',
  },
  {
    name: 'Performance',
    tagline: 'Margin Control',
    price: '$99',
    period: '/mo',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Service-line profitability tracking',
      'Margin compression alerts',
      'Capacity strain detection',
      'Hiring trigger signals',
      'Funnel friction detection',
      'Category positioning analysis',
      '90-day projections',
    ],
    cta: 'Upgrade to Performance',
    link: '/register-supabase',
  },
  {
    name: 'Growth',
    tagline: 'Scale Intelligence',
    price: '$199',
    period: '/mo',
    highlight: false,
    features: [
      'Payroll yield analysis',
      'Revenue expansion modelling',
      'Hiring vs outsource comparisons',
      'Market saturation scoring',
      'Demand intensity modelling',
      'Scenario planning engine',
      'Advanced workforce analytics',
    ],
    cta: 'Upgrade to Growth',
    link: '/register-supabase',
  },
  {
    name: 'Enterprise',
    tagline: 'Strategic Command',
    price: 'Custom',
    period: '',
    highlight: false,
    features: [
      'Multi-division reporting',
      'Custom KPI modelling',
      'Governance controls',
      'Role-based access',
      'Board-level reporting',
      'Custom integrations',
      'Data sovereignty options',
    ],
    cta: 'Contact Sales',
    link: '/contact',
  },
];

const PricingPage = () => (
  <WebsiteLayout>
    {/* HERO */}
    <section className="relative overflow-hidden" data-testid="pricing-hero">
      <div className="absolute top-10 right-10 w-[400px] h-[400px] rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, #FF6A00 0%, transparent 70%)' }} />
      <div className="max-w-5xl mx-auto px-6 pt-24 pb-12 relative z-10 text-center">
        <span className="text-xs font-medium tracking-widest uppercase text-[#FF6A00] mb-6 block" style={{ fontFamily: MONO }}>Pricing</span>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.2] mb-4 tracking-tight" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>
          Choose the Level of Intelligence<br />Your Business Requires
        </h1>
        <p className="text-base text-[#9FB0C3] max-w-xl mx-auto" style={{ fontFamily: BODY }}>
          From visibility to full performance control, BIQc scales with your growth.
        </p>
      </div>
    </section>

    {/* 5-TIER PRICING GRID */}
    <section className="py-12 px-4 sm:px-6" data-testid="pricing-plans">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {plans.map((plan) => (
            <div key={plan.name}
              className={`relative rounded-xl p-5 flex flex-col transition-all ${plan.highlight ? 'ring-2 ring-[#FF6A00] scale-[1.02] z-10' : ''}`}
              style={{ background: plan.highlight ? 'rgba(255,106,0,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${plan.highlight ? 'rgba(255,106,0,0.3)' : 'rgba(255,255,255,0.06)'}` }}
              data-testid={`plan-${plan.name.toLowerCase().replace(/\s/g, '-')}`}>

              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full text-white" style={{ background: '#FF6A00', fontFamily: MONO }}>{plan.badge}</span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-base font-bold text-white mb-0.5" style={{ fontFamily: HEADING }}>{plan.name}</h3>
                <p className="text-[11px] text-[#FF6A00]" style={{ fontFamily: MONO }}>{plan.tagline}</p>
              </div>

              <div className="mb-5">
                <span className="text-3xl font-bold text-white" style={{ fontFamily: MONO }}>{plan.price}</span>
                {plan.period && <span className="text-sm text-[#9FB0C3]">{plan.period}</span>}
              </div>

              <Link to={plan.link}
                className={`w-full flex items-center justify-center gap-1 py-2.5 rounded-lg text-sm font-semibold mb-5 transition-all hover:brightness-110 ${plan.highlight ? 'text-white' : 'text-[#F4F7FA]'}`}
                style={{ background: plan.highlight ? '#FF6A00' : 'rgba(255,255,255,0.05)', border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,0.1)', fontFamily: BODY }}
                data-testid={`cta-${plan.name.toLowerCase().replace(/\s/g, '-')}`}>
                {plan.cta} <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <div className="space-y-2.5 flex-1">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                    <span className="text-xs text-[#9FB0C3] leading-relaxed" style={{ fontFamily: BODY }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* TRUST SIGNALS */}
    <section className="py-12" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} data-testid="pricing-trust">
      <div className="max-w-3xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { label: 'No Lock-In', desc: 'Cancel anytime' },
            { label: '14-Day Trial', desc: 'Full access, no card' },
            { label: 'AU Hosted', desc: 'Sydney & Melbourne' },
            { label: 'AES-256', desc: 'Defence-grade encryption' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h4 className="text-sm font-semibold text-white mb-1" style={{ fontFamily: HEADING }}>{item.label}</h4>
              <p className="text-[10px] text-[#9FB0C3]" style={{ fontFamily: MONO }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* BOTTOM CTA */}
    <section className="py-16 px-6" style={{ background: 'rgba(255,106,0,0.06)', borderTop: '1px solid rgba(255,106,0,0.15)' }}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3" style={{ fontFamily: HEADING }}>
          See what BIQc sees about your business
        </h2>
        <p className="text-[#9FB0C3] mb-6" style={{ fontFamily: BODY }}>
          Start with a free digital footprint scan. No credit card. No commitment.
        </p>
        <Link to="/register-supabase" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold text-white transition-all hover:brightness-110" style={{ background: 'linear-gradient(135deg, #FF6A00, #E85D00)', fontFamily: HEADING, boxShadow: '0 8px 32px rgba(255,106,0,0.3)' }} data-testid="pricing-bottom-cta">
          Start Free Scan <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  </WebsiteLayout>
);

export default PricingPage;
