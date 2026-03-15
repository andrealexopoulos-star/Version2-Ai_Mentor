import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Check, X, ArrowRight, Shield, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


// ── Plan data ─────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'snapshot',
    name: 'Business Snapshot',
    tagline: 'Digital Footprint Overview',
    monthlyPrice: null, annualPrice: null, priceLabel: 'Free',
    period: '',
    highlight: false,
    features: [
      'Public digital footprint scan',
      'Market presence score (1 per 30 days)',
      'Competitive overview',
      'High-level digital gaps identified',
      'No integrations required',
    ],
    cta: 'Start Free Scan',
    ctaPath: '/register-supabase',
    color: '#64748B',
  },
  {
    id: 'foundation',
    name: 'Foundation',
    tagline: 'Performance Visibility',
    monthlyPrice: 49, annualPrice: 39,
    period: '/mo',
    highlight: false,
    features: [
      'Live market metrics with integrations',
      'Revenue & CRM pipeline visibility',
      'Cash position overview',
      'Workforce baseline metrics',
      '60-day performance forecast',
      'Data confidence indicators',
    ],
    cta: 'Start Foundation',
    ctaPath: '/register-supabase',
    color: '#3B82F6',
  },
  {
    id: 'performance',
    name: 'Performance',
    tagline: 'Margin Control',
    monthlyPrice: 99, annualPrice: 79,
    period: '/mo',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Service-line profitability tracking',
      'Margin compression alerts',
      'Capacity strain detection',
      'Hiring trigger signals',
      'Funnel friction detection',
      '90-day projections',
    ],
    cta: 'Start Performance',
    ctaPath: '/register-supabase',
    color: '#FF6A00',
  },
  {
    id: 'growth',
    name: 'SMB Protect',
    tagline: 'Scale Intelligence',
    monthlyPrice: 199, annualPrice: 159,
    period: '/mo',
    highlight: false,
    features: [
      'Payroll yield analysis',
      'Revenue expansion modelling',
      'Hiring vs outsource comparisons',
      'Market saturation scoring',
      'Demand intensity modelling',
      'Scenario planning engine',
    ],
    cta: 'Start SMB Protect',
    ctaPath: '/register-supabase',
    color: '#10B981',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Strategic Command',
    monthlyPrice: null, annualPrice: null, priceLabel: 'Custom',
    period: '',
    highlight: false,
    features: [
      'Multi-division reporting',
      'Custom KPI modelling',
      'Governance controls & role-based access',
      'Board-level reporting',
      'Custom integrations',
      'Dedicated support & SLA',
    ],
    cta: 'Contact Sales',
    ctaPath: '/contact',
    color: '#7C3AED',
  },
];

// ── Feature comparison rows ───────────────────────────────────────────────────
const COMPARISON = [
  { feature: 'Digital footprint scan', snapshot: true, foundation: true, performance: true, growth: true, enterprise: true },
  { feature: 'CRM integration', snapshot: false, foundation: true, performance: true, growth: true, enterprise: true },
  { feature: 'Accounting integration', snapshot: false, foundation: true, performance: true, growth: true, enterprise: true },
  { feature: 'Email intelligence', snapshot: false, foundation: false, performance: true, growth: true, enterprise: true },
  { feature: 'Revenue engine', snapshot: false, foundation: true, performance: true, growth: true, enterprise: true },
  { feature: 'Risk & governance', snapshot: false, foundation: false, performance: true, growth: true, enterprise: true },
  { feature: 'Scenario planning', snapshot: false, foundation: false, performance: false, growth: true, enterprise: true },
  { feature: 'Custom KPI modelling', snapshot: false, foundation: false, performance: false, growth: false, enterprise: true },
  { feature: 'Board-level reporting', snapshot: false, foundation: false, performance: false, growth: false, enterprise: true },
  { feature: 'Dedicated support', snapshot: false, foundation: false, performance: false, growth: false, enterprise: true },
  { feature: 'Australian data hosting', snapshot: true, foundation: true, performance: true, growth: true, enterprise: true },
  { feature: 'ARIA-compliant UI', snapshot: true, foundation: true, performance: true, growth: true, enterprise: true },
];

const FAQS = [
  { q: 'Can I switch plans anytime?', a: 'Yes. Upgrade or downgrade instantly — billing is prorated automatically.' },
  { q: 'What happens on the Free plan?', a: 'You get a full digital footprint scan and competitive overview using public signals. No integrations or credit card required.' },
  { q: 'Is my business data secure?', a: '100% Australian-hosted. AES-256 encryption. Siloed AI instances per client. Zero offshore processing.' },
  { q: 'Do you offer a refund?', a: '14-day money-back guarantee on all paid plans. No questions asked.' },
  { q: 'How does annual billing work?', a: 'Pay annually and save ~20% versus monthly billing. Cancel anytime within the first 14 days for a full refund.' },
];

// ── Trust badges ─────────────────────────────────────────────────────────────
const TRUST_BADGES = [
  { label: 'Australian Hosted', sub: 'Sydney & Melbourne', icon: '🇦🇺' },
  { label: 'AES-256 Encrypted', sub: 'Defence-grade', icon: '🔒' },
  { label: 'Privacy Act Compliant', sub: 'Australian Privacy Principles', icon: '🛡️' },
  { label: '14-Day Guarantee', sub: 'No questions asked', icon: '✅' },
];

export default function Pricing() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const getPrice = (plan) => {
    if (plan.priceLabel) return plan.priceLabel;
    const price = annual ? plan.annualPrice : plan.monthlyPrice;
    return `$${price}`;
  };

  const getSavings = (plan) => {
    if (!plan.monthlyPrice || !plan.annualPrice) return null;
    const savings = Math.round(((plan.monthlyPrice - plan.annualPrice) / plan.monthlyPrice) * 100);
    return `Save ${savings}%`;
  };

  return (
    <div className="min-h-screen" style={{ background: '#0A0F18', color: '#F4F7FA' }}>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: '#0A0F18E0', backdropFilter: 'blur(12px)', borderBottom: '1px solid #243140' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: '#FF6A00' }}>
              <span className="text-white font-bold text-xs" style={{ fontFamily: fontFamily.mono }}>B</span>
            </div>
            <span className="font-semibold text-sm text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>BIQc</span>
          </button>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/login-supabase')} className="text-[#9FB0C3] hover:text-white" data-testid="pricing-login">Log In</Button>
            <Button onClick={() => navigate('/register-supabase')} className="text-white font-medium rounded-lg" style={{ background: '#FF6A00' }} data-testid="pricing-cta-nav">Try It Free</Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-12 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-bold text-3xl md:text-5xl mb-4" style={{ fontFamily: fontFamily.display, color: '#F4F7FA' }}>
            Enterprise Intelligence.<br />SMB Investment.
          </h1>
          <p className="text-base md:text-lg mb-8" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>
            Start free. Scale as your intelligence needs grow.
          </p>

          {/* Annual/Monthly toggle */}
          <div className="inline-flex items-center gap-4 p-1 rounded-xl mb-2" style={{ background: '#141C26', border: '1px solid #243140' }} data-testid="billing-toggle">
            <button
              onClick={() => setAnnual(false)}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: !annual ? '#FF6A00' : 'transparent', color: !annual ? 'white' : '#9FB0C3' }}
              data-testid="toggle-monthly"
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
              style={{ background: annual ? '#FF6A00' : 'transparent', color: annual ? 'white' : '#9FB0C3' }}
              data-testid="toggle-annual"
            >
              Annual
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: annual ? 'rgba(255,255,255,0.25)' : '#10B98120', color: annual ? 'white' : '#10B981' }}>
                Save 20%
              </span>
            </button>
          </div>
          {annual && (
            <p className="text-xs mt-1" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>
              Annual pricing — billed once per year
            </p>
          )}
        </div>
      </section>

      {/* Trust badges */}
      <div className="max-w-5xl mx-auto px-6 mb-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TRUST_BADGES.map(b => (
            <div key={b.label} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#141C26', border: '1px solid #243140' }}>
              <span className="text-xl">{b.icon}</span>
              <div>
                <p className="text-xs font-semibold" style={{ color: '#F4F7FA', fontFamily: fontFamily.mono }}>{b.label}</p>
                <p className="text-[10px]" style={{ color: '#64748B', fontFamily: fontFamily.body }}>{b.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing Cards */}
      <section className="pb-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {PLANS.map(plan => (
              <div key={plan.id}
                className={`relative rounded-xl p-5 flex flex-col transition-all ${plan.highlight ? 'ring-2 scale-[1.02]' : ''}`}
                style={{ background: '#141C26', border: `1px solid ${plan.highlight ? '#FF6A0050' : '#243140'}`, ringColor: '#FF6A00' }}
                data-testid={`plan-${plan.id}`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-[10px] font-semibold px-3 py-1 rounded-full text-white" style={{ background: '#FF6A00', fontFamily: fontFamily.mono }}>
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <div className="w-2 h-2 rounded-full mb-2" style={{ background: plan.color }} />
                  <h3 className="text-sm font-bold mb-0.5" style={{ color: '#F4F7FA', fontFamily: fontFamily.display }}>{plan.name}</h3>
                  <p className="text-[11px]" style={{ color: plan.color, fontFamily: fontFamily.mono }}>{plan.tagline}</p>
                </div>

                <div className="mb-4">
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold" style={{ color: '#F4F7FA', fontFamily: fontFamily.mono }}>{getPrice(plan)}</span>
                    {plan.period && <span className="text-sm pb-0.5" style={{ color: '#64748B' }}>{plan.period}</span>}
                  </div>
                  {annual && getSavings(plan) && (
                    <span className="text-[10px] font-semibold" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>
                      {getSavings(plan)} vs monthly
                    </span>
                  )}
                </div>

                <button
                  onClick={() => navigate(plan.ctaPath)}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold mb-5 transition-all hover:brightness-110"
                  style={{
                    background: plan.highlight ? '#FF6A00' : '#243140',
                    color: plan.highlight ? 'white' : '#F4F7FA',
                    fontFamily: fontFamily.body,
                  }}
                  data-testid={`cta-${plan.id}`}
                >
                  {plan.cta} <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
                </button>

                <div className="space-y-2.5 flex-1">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: plan.color }} />
                      <span className="text-xs leading-relaxed" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="px-4 sm:px-6 pb-16">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium mb-4 transition-all"
            style={{ background: '#141C26', border: '1px solid #243140', color: '#9FB0C3' }}
            data-testid="toggle-comparison"
          >
            {showComparison ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showComparison ? 'Hide' : 'View'} Full Feature Comparison
          </button>

          {showComparison && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #243140' }} data-testid="comparison-table">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#0A1018', borderBottom: '1px solid #243140' }}>
                      <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: '#9FB0C3', fontFamily: fontFamily.mono, minWidth: '180px' }}>Feature</th>
                      {PLANS.map(p => (
                        <th key={p.id} className="px-3 py-3 text-center text-xs font-semibold" style={{ color: p.highlight ? '#FF6A00' : '#9FB0C3', fontFamily: fontFamily.mono, minWidth: '90px' }}>
                          {p.name.split(' ')[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map((row, i) => (
                      <tr key={row.feature} style={{ background: i % 2 === 0 ? '#141C26' : '#0F1720', borderBottom: '1px solid #1E2A38' }}>
                        <td className="px-4 py-2.5 text-xs" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>{row.feature}</td>
                        {['snapshot','foundation','performance','growth','enterprise'].map(id => (
                          <td key={id} className="px-3 py-2.5 text-center">
                            {row[id]
                              ? <Check className="w-4 h-4 mx-auto" style={{ color: '#10B981' }} />
                              : <X className="w-3.5 h-3.5 mx-auto" style={{ color: '#2D3B4E' }} />
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 sm:px-6 pb-16">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-8" style={{ color: '#F4F7FA', fontFamily: fontFamily.display }}>
            Common Questions
          </h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid #243140' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/5"
                  style={{ background: '#141C26' }}
                  aria-expanded={openFaq === i}
                >
                  <span className="text-sm font-medium" style={{ color: '#F4F7FA', fontFamily: fontFamily.body }}>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 ml-3 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} style={{ color: '#64748B' }} />
                </button>
                {openFaq === i && (
                  <div className="px-5 py-4" style={{ background: '#0F1720', borderTop: '1px solid #243140' }}>
                    <p className="text-sm" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 pb-20 text-center">
        <div className="max-w-lg mx-auto">
          <h2 className="text-2xl font-bold mb-3" style={{ color: '#F4F7FA', fontFamily: fontFamily.display }}>
            Start with a free scan today.
          </h2>
          <p className="text-sm mb-6" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>
            No credit card required. 100% Australian data sovereignty.
          </p>
          <Button
            onClick={() => navigate('/register-supabase')}
            className="text-white font-semibold px-10 h-12 rounded-xl"
            style={{ background: 'linear-gradient(135deg, #FF6A00, #E85D00)', boxShadow: '0 8px 32px rgba(255,106,0,0.3)' }}
            data-testid="pricing-bottom-cta"
          >
            Try It For Free <ArrowRight className="w-4 h-4 inline ml-1" />
          </Button>
          <p className="text-xs mt-3" style={{ color: '#4A5568', fontFamily: fontFamily.mono }}>
            14-day guarantee · Cancel anytime · Australian support
          </p>
        </div>
      </section>
    </div>
  );
}
