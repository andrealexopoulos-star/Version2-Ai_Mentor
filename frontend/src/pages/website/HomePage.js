import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { LiquidSteelHeroRotator } from '../../components/website/LiquidSteelHeroRotator';
import { IntegrationCarousel } from '../../components/website/IntegrationCarousel';
import { IntelligenceDiagram } from '../../components/website/IntelligenceDiagram';
import EnergyGalaxyBackground from '../../components/website/EnergyGalaxyBackground';
import { ArrowRight, Shield, Zap, Eye, BarChart3, Lock, Users, AlertTriangle } from 'lucide-react';

const HEADING = "'Cormorant Garamond', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";
const BODY = "'Inter', sans-serif";
const INTER = BODY;

const GlassCard = ({ children, className = '' }) => (
  <div className={`rounded-xl p-6 transition-all duration-300 hover:border-[#FF7A18]/30 hover:translate-y-[-2px] ${className}`}
    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,140,40,0.15)', borderRadius: 12 }}>
    {children}
  </div>
);

const StatBlock = ({ value, label }) => (
  <div className="text-center">
    <div className="text-[36px] sm:text-[42px] font-bold mb-2" style={{ fontFamily: MONO, color: '#FF7A18' }}>{value}</div>
    <div className="text-[10px] sm:text-xs tracking-widest uppercase" style={{ fontFamily: MONO, color: '#A6B2C1', opacity: 0.6 }}>{label}</div>
  </div>
);

const HomePage = () => (
  <WebsiteLayout>
    {/* HERO with full animated galaxy background */}
    <section className="relative overflow-hidden" style={{ minHeight: '88vh' }} data-testid="hero-section">
      {/* Base dark background */}
      <div className="absolute inset-0" style={{ background: '#07121E' }} />

      {/* Canvas-based animated energy galaxy */}
      <EnergyGalaxyBackground />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-28 relative z-10">
        <div className="text-center">
          {/* Trust badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 sm:mb-10" style={{ background: 'rgba(255,122,24,0.08)', border: '1px solid rgba(255,122,24,0.2)' }}>
            <Shield className="w-3.5 h-3.5" style={{ color: '#FF7A18' }} />
            <span className="text-[10px] sm:text-xs font-medium tracking-widest uppercase" style={{ fontFamily: MONO, color: '#FF7A18' }}>Australian Owned &amp; Operated</span>
          </div>

          {/* Rotating headline + subheadline */}
          <LiquidSteelHeroRotator />

          {/* CTA */}
          <div className="hero-cta-block pt-10" style={{ position: 'relative', zIndex: 10 }}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
              <Link to="/register-supabase" className="px-8 py-3.5 rounded-xl text-base font-semibold text-white inline-flex items-center gap-2 transition-all hover:brightness-110" style={{ background: 'linear-gradient(135deg, #FF7A18, #E56A08)', fontFamily: INTER, fontWeight: 600, boxShadow: '0 8px 32px rgba(255,122,24,0.25)' }} data-testid="hero-cta">
                Try It For Free <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <Link to="/login-supabase" className="block text-center text-xs hover:text-white transition-colors mb-10" style={{ fontFamily: MONO, color: '#A6B2C1' }} data-testid="hero-login">Already have an account? Log in</Link>

            {/* Continuously Learning */}
            <div className="flex flex-col items-center gap-3">
              <span className="text-[12px] sm:text-[14px]" style={{ fontFamily: BODY, color: '#A6B2C1', opacity: 0.45 }}>Continuously Learning &amp; Designed to</span>
              <div className="flex items-center gap-5 sm:gap-8">
                {['Protect', 'Stabilise', 'Strengthen'].map((word) => (
                  <div key={word} className="flex items-center gap-1.5 sm:gap-2">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 16 16" fill="none"><path d="M13.3 4.3L6.5 11.1 2.7 7.3" stroke="#FF7A18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span className="text-[14px] sm:text-[18px] font-bold" style={{ fontFamily: BODY, color: '#FF7A18' }}>{word}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-6 text-[11px]" style={{ fontFamily: MONO, color: '#A6B2C1', opacity: 0.3 }}>No credit card required &middot; Australian owned & operated</p>
          </div>
        </div>
      </div>
    </section>

    {/* INTELLIGENCE ARCHITECTURE DIAGRAM */}
    <div style={{ background: '#07121E' }}>
      <IntelligenceDiagram />
    </div>

    {/* STATS */}
    <section className="py-16 sm:py-20" style={{ background: '#07121E', borderTop: '1px solid rgba(255,140,40,0.06)' }} data-testid="stats-section">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-8 sm:gap-10">
          <StatBlock value="40%" label="Operational Improvement" />
          <StatBlock value="50%" label="Reduced Manual Work" />
          <StatBlock value="80%" label="Lower Processing Costs" />
          <StatBlock value="3x" label="Faster Anomaly Detection" />
          <StatBlock value="-25%" label="Fewer Preventable Errors" />
        </div>
      </div>
    </section>

    {/* INTEGRATION CAROUSEL */}
    <div style={{ background: '#07121E' }}>
      <IntegrationCarousel />
    </div>

    {/* WHAT COGNITION DELIVERS */}
    <section className="py-20 sm:py-28" style={{ background: '#07121E' }} data-testid="cognition-section">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-14 sm:mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-[2px]" style={{ background: '#FF7A18' }} />
            <span className="text-xs font-medium tracking-widest uppercase" style={{ fontFamily: MONO, color: '#FF7A18' }}>What Cognition-as-a-Service Delivers</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ fontFamily: HEADING, color: '#E6EEF7' }}>
            Enterprise-grade intelligence.<br />SMB-sized investment.
          </h2>
          <p className="text-base max-w-xl" style={{ fontFamily: BODY, color: '#A6B2C1' }}>Businesses embedding AI-driven decision systems experience:</p>
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
              <h3 className="text-base font-semibold mb-2" style={{ fontFamily: HEADING, color: '#E6EEF7' }}>{item.title}</h3>
              <p className="text-sm leading-relaxed" style={{ fontFamily: BODY, color: '#A6B2C1' }}>{item.desc}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="py-20 sm:py-28" style={{ background: '#0A1520' }} data-testid="cta-section">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ fontFamily: HEADING, color: '#E6EEF7' }}>
          Stop reacting. Start <span style={{ color: '#FF7A18' }}>preventing.</span>
        </h2>
        <p className="text-base mb-8 max-w-lg mx-auto" style={{ fontFamily: BODY, color: '#A6B2C1' }}>
          Join the operators who replaced reactive firefighting with autonomous intelligence.
        </p>
        <Link to="/register-supabase" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold text-white transition-all hover:brightness-110" style={{ background: 'linear-gradient(135deg, #FF7A18, #E56A08)', fontFamily: INTER, fontWeight: 600, boxShadow: '0 8px 32px rgba(255,122,24,0.25)' }} data-testid="bottom-cta">
          Try It For Free <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="mt-4 text-[11px]" style={{ fontFamily: MONO, color: '#A6B2C1', opacity: 0.3 }}>14-day trial &middot; No credit card &middot; Australian support</p>
      </div>
    </section>
  </WebsiteLayout>
);

export default HomePage;
