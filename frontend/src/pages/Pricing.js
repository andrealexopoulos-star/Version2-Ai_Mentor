import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Check, X, ArrowRight, Shield, Zap, BarChart3, TrendingUp, Building2 } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const Pricing = () => {
  const navigate = useNavigate();

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
      ctaAction: () => navigate('/register-supabase'),
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
      ctaAction: () => navigate('/register-supabase'),
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
      ctaAction: () => navigate('/register-supabase'),
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
      ctaAction: () => navigate('/register-supabase'),
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
      ctaAction: () => navigate('/contact'),
    },
  ];

  const faqs = [
    { q: 'Can I switch plans anytime?', a: 'Yes. Upgrade or downgrade instantly. We prorate billing automatically.' },
    { q: 'What happens on the Free plan?', a: 'You get a full digital footprint scan and competitive overview using public signals. No integrations, no credit card required.' },
    { q: 'Is my business data secure?', a: '100% Australian-hosted. AES-256 encryption. Siloed AI instances per client. Zero data leakage.' },
    { q: 'Do you offer refunds?', a: '14-day money-back guarantee on all paid plans. No questions asked.' },
  ];

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
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-bold text-3xl md:text-4xl lg:text-5xl text-[#F4F7FA] mb-4" style={{ fontFamily: fontFamily.display }}>
            Choose the Level of Intelligence<br />Your Business Requires
          </h1>
          <p className="text-base md:text-lg text-[#9FB0C3] max-w-2xl mx-auto" style={{ fontFamily: fontFamily.body }}>
            From visibility to full performance control, BIQc scales with your growth.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {plans.map((plan, index) => (
              <div key={plan.name}
                className={`relative rounded-xl p-5 flex flex-col transition-all ${plan.highlight ? 'ring-2 ring-[#FF6A00] scale-[1.02]' : ''}`}
                style={{ background: '#141C26', border: `1px solid ${plan.highlight ? '#FF6A0050' : '#243140'}` }}
                data-testid={`plan-${plan.name.toLowerCase().replace(/\s/g, '-')}`}>

                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-[10px] font-semibold px-3 py-1 rounded-full text-white" style={{ background: '#FF6A00', fontFamily: fontFamily.mono }}>{plan.badge}</span>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-base font-bold text-[#F4F7FA] mb-0.5" style={{ fontFamily: fontFamily.display }}>{plan.name}</h3>
                  <p className="text-[11px] text-[#FF6A00]" style={{ fontFamily: fontFamily.mono }}>{plan.tagline}</p>
                </div>

                <div className="mb-5">
                  <span className="text-3xl font-bold text-[#F4F7FA]" style={{ fontFamily: fontFamily.mono }}>{plan.price}</span>
                  {plan.period && <span className="text-sm text-[#64748B]">{plan.period}</span>}
                </div>

                <button onClick={plan.ctaAction}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold mb-5 transition-all hover:brightness-110 ${plan.highlight ? 'text-white' : 'text-[#F4F7FA]'}`}
                  style={{ background: plan.highlight ? '#FF6A00' : '#243140', border: plan.highlight ? 'none' : '1px solid #2D3B4E', fontFamily: fontFamily.body }}
                  data-testid={`cta-${plan.name.toLowerCase().replace(/\s/g, '-')}`}>
                  {plan.cta} <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
                </button>

                <div className="space-y-2.5 flex-1">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                      <span className="text-xs text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-12 px-6" style={{ borderTop: '1px solid #243140', borderBottom: '1px solid #243140' }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { icon: Shield, title: 'AES-256 Encryption', sub: 'Defence-grade protection' },
            { icon: Zap, title: 'Real-time Signals', sub: 'Continuous monitoring' },
            { icon: BarChart3, title: 'Zero Data Leakage', sub: 'Siloed AI instances' },
            { icon: Building2, title: 'Australian Hosted', sub: 'Sydney & Melbourne' },
          ].map(t => (
            <div key={t.title} className="text-center">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ background: '#FF6A0010' }}>
                <t.icon className="w-5 h-5 text-[#FF6A00]" />
              </div>
              <p className="text-sm font-medium text-[#F4F7FA]" style={{ fontFamily: fontFamily.body }}>{t.title}</p>
              <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{t.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-[#F4F7FA] mb-10" style={{ fontFamily: fontFamily.display }}>Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl p-5" style={{ background: '#141C26', border: '1px solid #243140' }}>
                <h3 className="text-sm font-semibold text-[#F4F7FA] mb-2" style={{ fontFamily: fontFamily.display }}>{faq.q}</h3>
                <p className="text-xs text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 px-6" style={{ background: '#FF6A00' }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3" style={{ fontFamily: fontFamily.display }}>
            See what BIQc sees about your business
          </h2>
          <p className="text-white/80 mb-6" style={{ fontFamily: fontFamily.body }}>
            Start with a free digital footprint scan. No credit card. No commitment.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => navigate('/register-supabase')} className="bg-white text-[#0A0F18] hover:bg-white/90 font-semibold px-8 h-12 rounded-lg" data-testid="pricing-bottom-cta">
              Start Free Scan <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" onClick={() => navigate('/contact')} className="border-white/30 text-white hover:bg-white/10 font-semibold px-8 h-12 rounded-lg">
              Talk to Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="py-4 px-6" style={{ background: '#080C14', borderTop: '1px solid #243140' }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[#64748B] text-[10px] leading-relaxed" style={{ fontFamily: fontFamily.mono }}>
            BIQc provides business intelligence based on connected data and public signals. It does not constitute financial, legal, or professional advice.
            Seek independent professional advice before making business decisions.
            <button onClick={() => navigate('/terms')} className="text-[#FF6A00] hover:underline ml-1">Terms & Conditions</button>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6" style={{ background: '#080C14' }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: '#FF6A00' }}>
              <span className="text-white font-bold text-xs" style={{ fontFamily: fontFamily.mono }}>B</span>
            </div>
            <span className="text-sm text-[#9FB0C3]" style={{ fontFamily: fontFamily.display }}>BIQc by The Strategy Squad</span>
          </div>
          <p className="text-[#64748B] text-xs" style={{ fontFamily: fontFamily.mono }}>
            &copy; {new Date().getFullYear()} The Strategy Squad Pty Ltd. Australian owned & operated.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;
