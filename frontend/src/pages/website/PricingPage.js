import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { ArrowRight, Check, Plus } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';


const PricingPage = () => (
  <WebsiteLayout>
    {/* HERO */}
    <section className="relative overflow-hidden" data-testid="pricing-hero">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-[0.03]" style={{ background: 'radial-gradient(circle, #E85D00 0%, transparent 70%)' }} />
      <div className="max-w-4xl mx-auto px-6 pt-16 sm:pt-28 pb-10 relative z-10 text-center">
        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-medium leading-[1.12] mb-4 sm:mb-5 tracking-tight" style={{ fontFamily: fontFamily.display, color: '#FFFFFF', textShadow: '0 1px 8px rgba(0,0,0,0.5)', WebkitTextStroke: '0.3px #FFFFFF' }}>
          Multiply the Capability<br />of Your Entire Team.
        </h1>
        <p className="text-base text-[#C8D4E0] max-w-lg mx-auto mb-4" style={{ fontFamily: fontFamily.body, lineHeight: 1.7 }}>
          BIQc enhances the judgement, clarity and execution speed of your Finance Manager, COO and Commercial leaders.
        </p>
        <p className="text-sm text-[#7A8FA3] max-w-xl mx-auto" style={{ fontFamily: fontFamily.body, lineHeight: 1.7 }}>
          Built for growth-stage businesses managing margin pressure, hiring decisions and competitive intensity. BIQc strengthens decision discipline across market, revenue and workforce.
        </p>
      </div>
    </section>

    {/* ═══ SECTION 1 — EXECUTIVE MARKET ASSESSMENT ═══ */}
    <section className="py-14 px-6" data-testid="pricing-assessment">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl p-8 sm:p-10" style={{ background: 'rgba(255,106,0,0.02)', border: '1px solid rgba(255,106,0,0.12)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: fontFamily.display }}>Executive Market Assessment</h2>
              <span className="text-[11px] tracking-[0.15em] uppercase" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>Complimentary</span>
            </div>
          </div>

          <p className="text-sm text-[#9FB0C3] mb-6" style={{ fontFamily: fontFamily.body, lineHeight: 1.7 }}>
            A forensic review of your public digital footprint and competitive position.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 mb-6">
            {[
              '13-layer digital footprint scan',
              'Market Presence Score',
              'Competitive positioning overview',
              'Category positioning map (public signals only)',
              'Funnel friction flags',
              'Trust footprint comparison',
              'Market saturation visibility',
              'Data confidence indicator',
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Check className="w-3.5 h-3.5 text-[#E85D00] shrink-0 mt-0.5" />
                <span className="text-xs text-[#C8D4E0]" style={{ fontFamily: fontFamily.body }}>{f}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-[#5A6B7D] mb-6" style={{ fontFamily: fontFamily.mono }}>
            This assessment analyses public signals only. Internal performance modelling requires system integration.
          </p>

          <Link to="/register-supabase"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
            style={{ background: '#E85D00', fontFamily: fontFamily.body }}
            data-testid="cta-market-assessment">
            Request Market Assessment <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>

    {/* ═══ SECTION 2 — BIQc PERFORMANCE PLATFORM ═══ */}
    <section className="py-14 px-4 sm:px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} data-testid="pricing-platform">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-[10px] tracking-[0.2em] uppercase text-[#5A6B7D] block mb-3" style={{ fontFamily: fontFamily.mono }}>BIQc Performance Platform</span>
          <h2 className="text-2xl sm:text-3xl font-medium text-white" style={{ fontFamily: fontFamily.display }}>Choose Your Level of Discipline</h2>
        </div>

        {/* Free tier compact bar */}
        <div className="rounded-xl p-4 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ background: 'rgba(255,106,0,0.03)', border: '1px solid rgba(255,106,0,0.12)' }} data-testid="free-tier-bar">
          <div className="flex items-center gap-3">
            <div className="w-8 h-0.5 rounded-full" style={{ background: '#E85D00' }} />
            <div>
              <span className="text-sm font-bold text-white" style={{ fontFamily: fontFamily.display }}>Market Intelligence Brief</span>
              <span className="text-[10px] tracking-[0.12em] uppercase ml-2" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>Free</span>
            </div>
          </div>
          <p className="text-xs text-[#7A8FA3] text-center sm:text-left flex-1 px-4" style={{ fontFamily: fontFamily.body }}>
            13-layer digital footprint scan, Market Presence Score, competitive overview, category positioning, trust comparison. Public signals only.
          </p>
          <Link to="/register-supabase"
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white shrink-0 transition-all hover:brightness-110"
            style={{ background: '#E85D00', fontFamily: fontFamily.body }}
            data-testid="cta-free-bar">
            Request Market Assessment <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* FOUNDATION */}
          <PlanCard
            name="Foundation"
            tagline="Leadership Visibility"
            price="$750"
            period="/month"
            color="#10B981"
            description="For teams who require disciplined clarity across market, revenue and workforce."
            features={[
              'Live market metrics (with integrations)',
              'Revenue intelligence',
              'Workforce baseline monitoring',
              'Cash discipline visibility',
              '60-day forecasting',
            ]}
            cta="Get Started"
            link="/register-supabase"
          />

          {/* PERFORMANCE */}
          <PlanCard
            name="Performance"
            tagline="Margin & Capacity Discipline"
            price="$1,950"
            period="/month"
            color="#3B82F6"
            highlight
            badge="Most Adopted"
            description="For leadership teams protecting margin while managing growth pressure."
            includesFrom="Foundation"
            features={[
              'Service-line profitability insight',
              'Hiring trigger detection',
              'Capacity strain modelling',
              'Margin compression alerts',
              'Competitive positioning refinement',
              '90-day projections',
            ]}
            cta="Upgrade to Performance"
            link="/register-supabase"
          />

          {/* SMB PROTECT */}
          <PlanCard
            name="BIQc Foundation"
            tagline="Strategic Expansion Control"
            price="$3,900"
            period="/month"
            color="#A855F7"
            description="For businesses scaling deliberately."
            includesFrom="Performance"
            features={[
              'Hiring vs outsource modelling',
              'Payroll yield analysis',
              'Revenue expansion simulation',
              'Market saturation scoring',
              'Scenario planning capability',
            ]}
            cta="Upgrade to BIQc Foundation"
            link="/register-supabase"
          />

          {/* CUSTOM */}
          <PlanCard
            name="Custom"
            tagline="Executive Command Layer"
            price="Contact Sales"
            period=""
            color="#EF4444"
            description="For multi-division organisations requiring sovereign intelligence infrastructure."
            includesFrom="BIQc Foundation"
            features={[
              'Multi-division reporting',
              'Custom KPI frameworks',
              'Governance controls',
              'Executive reporting automation',
              'Custom integrations',
              'Sovereign data options',
            ]}
            cta="Speak to Sales"
            link="/contact"
          />
        </div>
      </div>
    </section>

    {/* ADD-ONS */}
    <section className="py-12 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} data-testid="pricing-addons">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h3 className="text-lg font-bold text-white mb-1" style={{ fontFamily: fontFamily.display }}>Expansion Modules</h3>
          <p className="text-xs text-[#5A6B7D]" style={{ fontFamily: fontFamily.mono }}>Available on Performance tier and above</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { name: 'Advanced AI Modelling', price: '$500\u2013$1,200/mo', desc: 'Extended modelling depth based on usage intensity' },
            { name: 'Multi-Location Benchmarking', price: '$400/mo', desc: 'Per additional entity comparison' },
            { name: 'Executive Reporting Suite', price: '$350/mo', desc: 'Board-ready exports with custom branding' },
            { name: 'Dedicated Data Sync', price: '$300\u2013$800/mo', desc: 'Real-time or hourly sync vs standard daily' },
          ].map(a => (
            <div key={a.name} className="rounded-xl p-5 flex items-start gap-4" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(255,106,0,0.06)' }}>
                <Plus className="w-3.5 h-3.5 text-[#E85D00]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white" style={{ fontFamily: fontFamily.display }}>{a.name}</h4>
                <span className="text-[11px] text-[#E85D00] block mb-1" style={{ fontFamily: fontFamily.mono }}>{a.price}</span>
                <p className="text-xs text-[#5A6B7D]" style={{ fontFamily: fontFamily.body }}>{a.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* CLOSING */}
    <section className="py-16 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-lg text-[#C8D4E0] mb-2" style={{ fontFamily: fontFamily.display, lineHeight: 1.6 }}>
          BIQc does not replace your leadership team.
        </p>
        <p className="text-lg text-white font-semibold" style={{ fontFamily: fontFamily.display, lineHeight: 1.6 }}>
          It sharpens their judgement and strengthens their discipline.
        </p>
        <div className="mt-8">
          <Link to="/register-supabase"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold text-white transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #E85D00, #E85D00)', fontFamily: fontFamily.body, boxShadow: '0 8px 32px rgba(255,106,0,0.2)' }}
            data-testid="pricing-bottom-cta">
            Request Market Assessment <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  </WebsiteLayout>
);

// ═══ Plan Card Component ═══
const PlanCard = ({ name, tagline, price, period, color, highlight, badge, description, includesFrom, features, cta, link }) => (
  <div className={`relative rounded-2xl p-6 flex flex-col transition-all ${highlight ? 'ring-2 ring-[#E85D00]' : ''}`}
    style={{
      background: highlight ? 'rgba(255,106,0,0.025)' : 'rgba(255,255,255,0.015)',
      border: `1px solid ${highlight ? 'rgba(255,106,0,0.2)' : 'rgba(255,255,255,0.05)'}`,
    }}
    data-testid={`plan-${name.toLowerCase()}`}>

    {badge && (
      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
        <span className="text-[9px] font-semibold tracking-[0.12em] uppercase px-4 py-1 rounded-full text-white whitespace-nowrap" style={{ background: '#E85D00', fontFamily: fontFamily.mono }}>
          {badge}
        </span>
      </div>
    )}

    <div className="w-7 h-0.5 rounded-full mb-4" style={{ background: color }} />

    <h3 className="text-base font-bold text-white" style={{ fontFamily: fontFamily.display }}>{name}</h3>
    <p className="text-[11px] mb-3" style={{ color, fontFamily: fontFamily.mono }}>{tagline}</p>

    <div className="mb-1">
      <span className="text-2xl font-bold text-white" style={{ fontFamily: fontFamily.mono }}>{price}</span>
      {period && <span className="text-xs text-[#5A6B7D] ml-1">{period}</span>}
    </div>

    <p className="text-[11px] text-[#7A8FA3] mb-5 leading-relaxed" style={{ fontFamily: fontFamily.body }}>{description}</p>

    <Link to={link}
      className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold mb-5 transition-all hover:brightness-110`}
      style={{
        background: highlight ? '#E85D00' : 'rgba(255,255,255,0.04)',
        color: highlight ? 'white' : '#E2E8F0',
        border: highlight ? 'none' : '1px solid rgba(255,255,255,0.08)',
        fontFamily: fontFamily.body,
      }}
      data-testid={`cta-${name.toLowerCase()}`}>
      {cta} <ArrowRight className="w-3.5 h-3.5" />
    </Link>

    <div className="space-y-2 flex-1">
      {includesFrom && (
        <div className="flex items-start gap-2 mb-1">
          <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color }} />
          <span className="text-xs text-[#C8D4E0] font-medium" style={{ fontFamily: fontFamily.body }}>Everything in {includesFrom}</span>
        </div>
      )}
      {features.map((f, i) => (
        <div key={i} className="flex items-start gap-2">
          <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color }} />
          <span className="text-xs text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>{f}</span>
        </div>
      ))}
    </div>
  </div>
);

export default PricingPage;
