import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { ArrowRight, Check, X } from 'lucide-react';

const HEADING = "'Cormorant Garamond', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";
const BODY = "'Inter', sans-serif";

const hiresCost = [
  { role: 'Chief Operating Officer', salary: '$180,000+', icon: '/' },
  { role: 'Business Analyst', salary: '$95,000+', icon: '/' },
  { role: 'Compliance Officer', salary: '$110,000+', icon: '/' },
  { role: 'Data Analyst', salary: '$85,000+', icon: '/' },
];

const features = [
  'Autonomous monitoring across all connected systems',
  'Executive intelligence briefings (daily)',
  'Revenue & pipeline risk detection',
  'Cash flow & financial anomaly alerts',
  'Operational bottleneck identification',
  'Compliance gap detection',
  'Market & competitor signal monitoring',
  'Resolution Centre with auto-drafted actions',
  'Unlimited integrations',
  'Australian sovereign data hosting',
  'Dedicated onboarding',
  'Priority support',
];

const PricingPage = () => (
  <WebsiteLayout>
    {/* HERO */}
    <section className="relative overflow-hidden" data-testid="pricing-hero">
      <div className="absolute top-10 right-10 w-[400px] h-[400px] rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, #FF6A00 0%, transparent 70%)' }} />
      <div className="max-w-5xl mx-auto px-6 pt-24 pb-16 relative z-10 text-center">
        <span className="text-xs font-medium tracking-widest uppercase text-[#FF6A00] mb-6 block" style={{ fontFamily: MONO }}>Pricing</span>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.2] mb-6 tracking-tight" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>
          Increase <span style={{ color: '#FF6A00' }}>Return on Talent.</span>
        </h1>
        <p className="text-lg text-[#9FB0C3] max-w-xl mx-auto" style={{ fontFamily: BODY }}>
          Transform leadership time into measurable impact. Reduce operational drag, prevent burnout, and improve performance without increasing payroll.
        </p>
      </div>
    </section>

    {/* COMPARISON */}
    <section className="py-20" style={{ background: '#141C26' }} data-testid="pricing-comparison">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Cost Without BIQc */}
          <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2 mb-6">
              <X className="w-5 h-5 text-[#EF4444]" />
              <h3 className="text-lg font-semibold" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>Without BIQc</h3>
            </div>
            <div className="space-y-4 mb-8">
              {[
                { item: 'Missed revenue signals', cost: 'Hidden cost' },
                { item: 'Delayed risk detection', cost: 'Weeks of exposure' },
                { item: 'Manual reporting overhead', cost: '10+ hrs/week' },
                { item: 'Reactive decision-making', cost: 'Compounding losses' },
              ].map((row) => (
                <div key={row.item} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-sm text-[#9FB0C3]" style={{ fontFamily: BODY }}>{row.item}</span>
                  <span className="text-sm font-semibold text-[#EF4444]" style={{ fontFamily: MONO }}>{row.cost}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>Cost of inaction</span>
                <span className="text-xl font-bold text-[#EF4444]" style={{ fontFamily: MONO }}>Compounding</span>
              </div>
              <span className="text-xs text-[#EF4444]/60 mt-1 block" style={{ fontFamily: MONO }}>missed signals + delayed decisions + preventable losses</span>
            </div>
          </div>

          {/* BIQc Column */}
          <div className="rounded-2xl p-8 relative" style={{ background: 'rgba(255,106,0,0.03)', border: '1px solid rgba(255,106,0,0.2)' }}>
            <div className="absolute -top-3 left-8 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase text-white" style={{ background: '#FF6A00', fontFamily: MONO }}>Recommended</div>
            <div className="flex items-center gap-2 mb-6 mt-2">
              <Check className="w-5 h-5 text-[#FF6A00]" />
              <h3 className="text-lg font-semibold" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>BIQc Subscription</h3>
            </div>

            <div className="mb-8">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl font-bold text-[#FF6A00]" style={{ fontFamily: MONO }}>$X</span>
                <span className="text-sm text-[#9FB0C3]" style={{ fontFamily: MONO }}>/month</span>
              </div>
              <p className="text-sm text-[#9FB0C3]" style={{ fontFamily: BODY }}>All features. All integrations. Full intelligence.</p>
            </div>

            <div className="space-y-2.5 mb-8">
              {features.map((f) => (
                <div key={f} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#FF6A00] mt-0.5 shrink-0" />
                  <span className="text-sm text-[#9FB0C3]" style={{ fontFamily: BODY }}>{f}</span>
                </div>
              ))}
            </div>

            <Link to="/register-supabase" className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-base font-semibold text-white transition-all hover:brightness-110" style={{ background: 'linear-gradient(135deg, #FF6A00, #E85D00)', fontFamily: HEADING, boxShadow: '0 8px 32px rgba(255,106,0,0.3)' }} data-testid="pricing-cta">
              Start 14-day free trial <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>

    {/* TRUST SIGNALS */}
    <section className="py-16" data-testid="pricing-trust">
      <div className="max-w-3xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { label: 'No Lock-In', desc: 'Cancel anytime' },
            { label: '14-Day Trial', desc: 'Full access, no card' },
            { label: 'AU Support', desc: 'Local team, local time' },
            { label: 'Onboarding', desc: 'Included at no cost' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h4 className="text-sm font-semibold text-[#FF6A00] mb-1" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>{item.label}</h4>
              <p className="text-xs text-[#9FB0C3]" style={{ fontFamily: MONO }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  </WebsiteLayout>
);

export default PricingPage;
