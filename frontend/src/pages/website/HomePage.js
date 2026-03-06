import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { LiquidSteelHeroRotator } from '../../components/website/LiquidSteelHeroRotator';
import { IntegrationCarousel } from '../../components/website/IntegrationCarousel';
import { IntelligenceDiagram } from '../../components/website/IntelligenceDiagram';
import EnergyGalaxyBackground from '../../components/website/EnergyGalaxyBackground';
import { ArrowRight, Shield, Zap, Eye, BarChart3, Lock, Users, AlertTriangle } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';


const GlassCard = ({ children, className = '' }) => (
  <div className={`rounded-xl p-6 transition-all duration-300 hover:border-[#FF7A18]/30 hover:translate-y-[-2px] ${className}`}
    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,140,40,0.15)', borderRadius: 12 }}>
    {children}
  </div>
);

const StatBlock = ({ value, label }) => (
  <div className="text-center">
    <div className="text-[36px] sm:text-[42px] font-bold mb-2" style={{ fontFamily: fontFamily.mono, color: '#FF7A18' }}>{value}</div>
    <div className="tracking-widest uppercase" style={{ fontFamily: fontFamily.mono, color: '#A6B2C1', opacity: 0.6, fontSize: '12px' }}>{label}</div>
  </div>
);

const HomePage = () => (
  <WebsiteLayout>
    {/* HERO */}
    <section className="relative overflow-hidden" style={{ minHeight: '70vh', maxHeight: '95vh', position: 'relative' }} data-testid="hero-section">
      <div className="absolute inset-0" style={{ background: '#07121E', zIndex: 0 }} />

      <div className="hero-content" style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center', padding: '0 20px' }} className="pt-6 sm:pt-20">
          {/* Trust badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 sm:mb-8" style={{ background: 'rgba(255,122,24,0.08)', border: '1px solid rgba(255,122,24,0.2)' }}>
            <Shield className="w-3.5 h-3.5" style={{ color: '#FF7A18' }} />
            <span className="font-medium tracking-widest uppercase" style={{ fontFamily: fontFamily.mono, color: '#FF7A18', fontSize: '12px' }}>Australian Owned &amp; Operated</span>
          </div>

          {/* Rotating headline */}
          <LiquidSteelHeroRotator />

          {/* CTA block — compact */}
          <div style={{ paddingTop: 28, position: 'relative', zIndex: 10 }}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3" style={{ marginBottom: 12 }}>
              <Link to="/register-supabase" className="px-10 py-4 rounded-xl text-base font-semibold text-white inline-flex items-center gap-2 transition-all hover:brightness-110 hover:scale-[1.02]" style={{ background: 'linear-gradient(135deg, #FF7A18, #E56A08)', fontFamily: fontFamily.body, fontWeight: 600, boxShadow: '0 8px 32px rgba(255,122,24,0.3)' }} data-testid="hero-cta">
                Try It For Free <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <Link to="/login-supabase" className="block text-center text-xs hover:text-white transition-colors" style={{ fontFamily: fontFamily.mono, color: '#A6B2C1', marginBottom: 20 }} data-testid="hero-login">Already have an account? Log in</Link>

            {/* Protect / Stabilise / Strengthen */}
            <div className="flex flex-col items-center gap-2">
              <span style={{ fontFamily: fontFamily.body, color: '#A6B2C1', opacity: 0.4, fontSize: '13px' }}>Continuously Learning &amp; Designed to</span>
              <div className="flex items-center gap-5 sm:gap-8">
                {['Protect', 'Stabilise', 'Strengthen'].map((word) => (
                  <div key={word} className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none"><path d="M13.3 4.3L6.5 11.1 2.7 7.3" stroke="#FF7A18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span className="text-[14px] sm:text-[16px] font-medium" style={{ fontFamily: fontFamily.body, color: '#FF7A18' }}>{word}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-4" style={{ fontFamily: fontFamily.mono, color: '#A6B2C1', opacity: 0.25, fontSize: '11px' }}>No credit card required &middot; Australian owned & operated</p>

            {/* SMB Impact Stats */}
            <div className="mt-8 sm:mt-10" data-testid="stats-section">
              <p className="font-medium tracking-widest uppercase mb-5" style={{ fontFamily: fontFamily.mono, color: '#FF7A18', fontSize: '11px' }}>What SMBs Gain With BIQc</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 sm:gap-6 max-w-3xl mx-auto">
                <StatBlock value="6hrs" label="Saved Per Week on Reporting" />
                <StatBlock value="83%" label="Faster Risk Detection" />
                <StatBlock value="$47K" label="Avg. Cash Recovered Annually" />
                <StatBlock value="1" label="Single Source of Truth" />
              </div>
              <p className="mt-3" style={{ fontFamily: fontFamily.body, color: '#A6B2C1', opacity: 0.3, fontSize: '11px' }}>Based on pilot data from Australian SMBs using BIQc intelligence systems</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* gap: hero → platform diagram */}
    <div style={{ background: '#07121E', height: 20 }} />

    {/* INTELLIGENCE ARCHITECTURE DIAGRAM */}
    <div style={{ background: '#07121E' }}>
      <IntelligenceDiagram />
    </div>

    {/* INTEGRATION CAROUSEL */}
    <div style={{ background: '#07121E' }}>
      <IntegrationCarousel />
    </div>

    {/* WHAT COGNITION DELIVERS */}
    <section className="py-14 sm:py-20" style={{ background: '#07121E' }} data-testid="cognition-section">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-10 sm:mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-[2px]" style={{ background: '#FF7A18' }} />
            <span className="text-xs font-medium tracking-widest uppercase" style={{ fontFamily: fontFamily.mono, color: '#FF7A18' }}>What Cognition-as-a-Service Delivers</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-medium mb-3" style={{ fontFamily: fontFamily.displayING, color: '#E6EEF7' }}>
            Enterprise-grade intelligence.<br />SMB-sized investment.
          </h2>
          <p className="text-base max-w-xl" style={{ fontFamily: fontFamily.body, color: '#A6B2C1' }}>Businesses embedding AI-driven decision systems experience:</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: Eye, title: 'Monitors Everything', desc: 'Connects accounting, CRM, and ops. Watches 24/7.' },
            { icon: AlertTriangle, title: 'Detects & Flags', desc: 'Flags anomalies, cash flow risks, and compliance gaps early.' },
            { icon: Zap, title: 'Prevents & Corrects', desc: 'Recommends actions, drafts comms, and automates workflows.' },
            { icon: BarChart3, title: 'Executive Briefings', desc: 'Daily intelligence briefs from all sources. No dashboard digging.' },
            { icon: Lock, title: 'Australian Sovereign', desc: 'Australian hosted. No offshore processing. Full audit trail.' },
            { icon: Users, title: 'Maximise Output', desc: 'Boost leverage and performance without expanding headcount.' },
          ].map((item, i) => (
            <GlassCard key={i}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: 'rgba(255,122,24,0.08)' }}>
                <item.icon className="w-5 h-5" style={{ color: '#FF7A18' }} />
              </div>
              <h3 className="text-base font-semibold mb-2" style={{ fontFamily: fontFamily.displayING, color: '#E6EEF7' }}>{item.title}</h3>
              <p className="text-sm leading-relaxed" style={{ fontFamily: fontFamily.body, color: '#A6B2C1' }}>{item.desc}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="py-14 sm:py-20" style={{ background: '#0A1520' }} data-testid="cta-section">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-medium mb-4" style={{ fontFamily: fontFamily.displayING, color: '#E6EEF7' }}>
          Stop reacting. Start <span style={{ color: '#FF7A18' }}>preventing.</span>
        </h2>
        <p className="text-base mb-8 max-w-lg mx-auto" style={{ fontFamily: fontFamily.body, color: '#A6B2C1' }}>
          Join the operators who replaced reactive firefighting with autonomous intelligence.
        </p>
        <Link to="/register-supabase" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold text-white transition-all hover:brightness-110" style={{ background: 'linear-gradient(135deg, #FF7A18, #E56A08)', fontFamily: fontFamily.body, fontWeight: 600, boxShadow: '0 8px 32px rgba(255,122,24,0.25)' }} data-testid="bottom-cta">
          Try It For Free <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="mt-4" style={{ fontFamily: fontFamily.mono, color: '#A6B2C1', opacity: 0.3, fontSize: '12px' }}>14-day trial &middot; No credit card &middot; Australian support</p>
      </div>
    </section>
  </WebsiteLayout>
);

export default HomePage;
