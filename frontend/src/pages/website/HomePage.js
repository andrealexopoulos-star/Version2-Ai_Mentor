import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { LiquidSteelHeroRotator } from '../../components/website/LiquidSteelHeroRotator';
import { ArrowRight, Zap, Eye, BarChart3, Lock, Users, TrendingUp, AlertTriangle, FileCheck, Clock } from 'lucide-react';

const HEADING = "'Cormorant Garamond', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";
const BODY = "'Inter', sans-serif";

const GlassCard = ({ children, className = '', hover = true }) => (
  <div className={`rounded-2xl p-6 transition-all duration-300 ${hover ? 'hover:border-[#FF6A00]/30 hover:translate-y-[-2px]' : ''} ${className}`}
    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
    {children}
  </div>
);

const StatBlock = ({ value, label }) => (
  <div className="text-center">
    <div className="text-4xl md:text-5xl font-bold mb-2" style={{ fontFamily: MONO, color: '#FF6A00' }}>{value}</div>
    <div className="text-xs tracking-widest uppercase text-[#9FB0C3]/60" style={{ fontFamily: MONO }}>{label}</div>
  </div>
);

const HomePage = () => (
  <WebsiteLayout>
    {/* ══ HERO ══ */}
    <section className="relative overflow-hidden" data-testid="hero-section">
      {/* Subtle grid pattern — hidden on mobile */}
      <div className="absolute inset-0 opacity-[0.03] hidden sm:block" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />
      {/* Orange glow — hidden on mobile */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-10 hidden sm:block" style={{ background: 'radial-gradient(circle, #FF6A00 0%, transparent 70%)' }} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 sm:pt-24 pb-8 sm:pb-20 relative z-10">
        <div className="text-center">
          {/* Pill removed — "Autonomous Business Intelligence" relocated to trust section below */}

          <p className="text-xs sm:text-sm font-medium tracking-widest uppercase mb-4 sm:mb-6" style={{ color: '#9FB0C3' }} data-testid="hero-label">Australian Owned &amp; Operated</p>

          {/* hero-viewport: rotating content ONLY — CTA is OUTSIDE this container */}
          <LiquidSteelHeroRotator />

          {/* hero-cta-block: completely isolated from viewport — no inherited transform/opacity */}
          <div className="hero-cta-block" style={{ position: 'relative', zIndex: 10 }}>
            <div className="block sm:hidden mb-4" />

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
              <Link to="/register-supabase" className="px-8 py-3.5 rounded-xl text-base font-semibold text-white inline-flex items-center gap-2 transition-all hover:brightness-110" style={{ background: 'linear-gradient(135deg, #FF6A00, #E85D00)', fontFamily: HEADING, boxShadow: '0 8px 32px rgba(255,106,0,0.3)' }} data-testid="hero-cta">
                Try It For Free <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <Link to="/login-supabase" className="block text-center text-xs text-[#9FB0C3] hover:text-white transition-colors mb-6" style={{ fontFamily: MONO }} data-testid="hero-login">Already have an account? Log in</Link>

            <div className="flex items-center justify-center gap-8 text-xs text-[#9FB0C3]/50" style={{ fontFamily: MONO }}>
              <span>Not a chatbot.</span>
              <span>Not a dashboard.</span>
              <span>Not another tool.</span>
            </div>

            <p className="mt-4 text-[11px] text-[#9FB0C3]/40" style={{ fontFamily: MONO }}>No credit card required &middot; Australian owned & operated</p>
          </div>
        </div>
      </div>
    </section>

    {/* ══ STATS BAR ══ */}
    <section className="border-y" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }} data-testid="stats-section">
      <div className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-8">
        <StatBlock value="40%" label="Operational Improvement" />
        <StatBlock value="50%" label="Reduced Manual Work" />
        <StatBlock value="80%" label="Lower Processing Costs" />
        <StatBlock value="3x" label="Faster Anomaly Detection" />
        <StatBlock value="-25%" label="Fewer Preventable Errors" />
      </div>
    </section>

    {/* ══ WHAT COGNITION DELIVERS ══ */}
    <section className="py-24" data-testid="cognition-section">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-[2px]" style={{ background: '#FF6A00' }} />
            <span className="text-xs font-medium tracking-widest uppercase text-[#FF6A00]" style={{ fontFamily: MONO }}>Autonomous Business Intelligence</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>
            Enterprise-grade intelligence.<br />SMB-sized investment.
          </h2>
          <p className="text-base text-[#9FB0C3] max-w-xl" style={{ fontFamily: BODY }}>Businesses embedding AI-driven decision systems experience:</p>
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
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: 'rgba(255,106,0,0.1)' }}>
                <item.icon className="w-5 h-5 text-[#FF6A00]" />
              </div>
              <h3 className="text-base font-semibold mb-2" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>{item.title}</h3>
              <p className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: BODY }}>{item.desc}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>

    {/* ══ ARCHITECTURE DIAGRAM ══ */}
    <section className="py-24" style={{ background: '#141C26' }} data-testid="architecture-section">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-xs font-medium tracking-widest uppercase text-[#FF6A00] mb-4 block" style={{ fontFamily: MONO }}>The Functional Arsenal</span>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>
            One platform. Four pillars.
          </h2>
          <p className="text-base text-[#9FB0C3]" style={{ fontFamily: BODY }}>Built for decisions, not analysis.</p>
        </div>

        {/* Architecture: Inputs → BIQc Core → Outputs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          {/* LEFT: Inputs */}
          <GlassCard hover={false}>
            <h4 className="text-xs font-semibold tracking-widest uppercase text-[#9FB0C3]/50 mb-5" style={{ fontFamily: MONO }}>Connected Systems</h4>
            <div className="grid grid-cols-2 gap-3">
              {['Xero', 'MYOB', 'HubSpot', 'Salesforce', 'Stripe', 'Shopify', 'Google Workspace', 'Microsoft 365', 'Slack', 'Payroll'].map((name) => (
                <div key={name} className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-white/5 group" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="w-2 h-2 rounded-full bg-[#9FB0C3]/30 group-hover:bg-[#FF6A00] transition-colors" />
                  <span className="text-xs text-[#9FB0C3] group-hover:text-white transition-colors" style={{ fontFamily: MONO }}>{name}</span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* CENTER: Core */}
          <div className="flex flex-col items-center justify-center py-8">
            <div className="relative">
              <div className="w-32 h-32 rounded-full flex items-center justify-center" style={{ background: 'radial-gradient(circle at 30% 30%, #2A3444, #141C26)', border: '2px solid rgba(255,106,0,0.3)', boxShadow: '0 0 60px rgba(255,106,0,0.15), inset 0 0 30px rgba(255,106,0,0.05)' }}>
                <div className="text-center">
                  <span className="text-xl font-bold text-[#FF6A00]" style={{ fontFamily: MONO }}>BIQc</span>
                  <span className="block text-[10px] text-[#9FB0C3]/60" style={{ fontFamily: MONO }}>Intelligence</span>
                </div>
              </div>
              {/* Pulse ring */}
              <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ border: '1px solid #FF6A00', animationDuration: '3s' }} />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-[#9FB0C3]/50" style={{ fontFamily: MONO }}>Always on. Always watching.</span>
            </div>
          </div>

          {/* RIGHT: Outputs */}
          <GlassCard hover={false}>
            <h4 className="text-xs font-semibold tracking-widest uppercase text-[#9FB0C3]/50 mb-5" style={{ fontFamily: MONO }}>Intelligence Outputs</h4>
            <div className="space-y-3">
              {[
                { label: 'Executive Alerts', color: '#EF4444' },
                { label: 'Revenue Warnings', color: '#F59E0B' },
                { label: 'Compliance Flags', color: '#8B5CF6' },
                { label: 'Cash Flow Risks', color: '#FF6A00' },
                { label: 'Auto-Generated Briefings', color: '#22C55E' },
                { label: 'Corrective Actions', color: '#3B82F6' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:bg-white/5" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                  <span className="text-xs text-[#F4F7FA]" style={{ fontFamily: MONO }}>{item.label}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </section>

    {/* ══ PERFORMANCE STATS ══ */}
    <section className="py-20 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} data-testid="performance-section">
      <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-10">
        <StatBlock value="94%" label="Faster Loads" />
        <StatBlock value="15+" label="Hrs/Week Reclaimed" />
        <StatBlock value="500+" label="Integrations" />
        <StatBlock value="24/7" label="Sentinel Active" />
      </div>
    </section>

    {/* ══ CTA ══ */}
    <section className="py-24" style={{ background: '#141C26' }} data-testid="cta-section">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ fontFamily: HEADING, color: '#FFFFFF' }}>
          Stop reacting. Start <span style={{ color: '#FF6A00' }}>preventing.</span>
        </h2>
        <p className="text-base text-[#9FB0C3] mb-8 max-w-lg mx-auto" style={{ fontFamily: BODY }}>
          Join the operators who replaced reactive firefighting with autonomous intelligence.
        </p>
        <Link to="/register-supabase" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold text-white transition-all hover:brightness-110" style={{ background: 'linear-gradient(135deg, #FF6A00, #E85D00)', fontFamily: HEADING, boxShadow: '0 8px 32px rgba(255,106,0,0.3)' }} data-testid="bottom-cta">
          Try It For Free <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="mt-4 text-[11px] text-[#9FB0C3]/40" style={{ fontFamily: MONO }}>14-day trial &middot; No credit card &middot; Australian support</p>
      </div>
    </section>
  </WebsiteLayout>
);

export default HomePage;
