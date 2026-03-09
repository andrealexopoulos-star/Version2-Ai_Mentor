import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { LiquidSteelHeroRotator } from '../../components/website/LiquidSteelHeroRotator';
import { IntegrationCarousel } from '../../components/website/IntegrationCarousel';
import { IntelligenceDiagram } from '../../components/website/IntelligenceDiagram';
import { ArrowRight, Shield, AlertTriangle, DollarSign, Database, CheckCircle2, Zap, Eye, BarChart3, Lock, Users } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';


const GlassCard = ({ children, className = '' }) => (
  <div className={`rounded-xl p-6 transition-all duration-300 hover:border-[#FF7A18]/30 hover:translate-y-[-2px] ${className}`}
    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,140,40,0.15)', borderRadius: 12 }}>
    {children}
  </div>
);

/* ── Diamond/hex grid background pattern ─────────────────── */
const DIAMOND_PATTERN = `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cpath d='M40 4L76 40L40 76L4 40z' stroke='%23ffffff' stroke-opacity='0.04' stroke-width='1'/%3E%3C/g%3E%3C/svg%3E")`;

/* ── Stat item matching reference image style ─────────────── */
const StatItem = ({ icon: Icon, value, label, iconColor = '#FF7A18' }) => (
  <div className="flex items-center gap-3">
    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: 'rgba(255,122,24,0.08)', border: '1px solid rgba(255,122,24,0.15)' }}>
      <Icon className="w-6 h-6" style={{ color: iconColor }} />
    </div>
    <div>
      <div className="text-2xl sm:text-3xl font-bold leading-none" style={{ fontFamily: fontFamily.mono, color: '#FFFFFF' }}>{value}</div>
      <div className="text-xs mt-0.5 leading-tight" style={{ fontFamily: fontFamily.body, color: '#9FB0C3' }}>{label}</div>
    </div>
  </div>
);

const HomePage = () => (
  <WebsiteLayout>
    {/* ── HERO ─────────────────────────────────────────────── */}
    <section className="relative overflow-hidden" style={{ minHeight: '100vh', background: '#070E18' }} data-testid="hero-section">

      {/* Diamond grid pattern */}
      <div className="absolute inset-0" style={{ backgroundImage: DIAMOND_PATTERN, backgroundSize: '80px 80px', zIndex: 1 }} />

      {/* Radial spotlight glow from center-top */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 10%, rgba(30,50,80,0.6) 0%, transparent 70%)',
        zIndex: 2,
      }} />

      {/* Subtle orange brand glow at very center */}
      <div className="absolute" style={{
        top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 600, height: 300,
        background: 'radial-gradient(ellipse, rgba(255,122,24,0.04) 0%, transparent 70%)',
        zIndex: 2,
      }} />

      {/* Content */}
      <div className="relative flex flex-col items-center justify-center text-center px-4 sm:px-6"
        style={{ minHeight: '100vh', zIndex: 3, paddingTop: 80, paddingBottom: 60 }}>

        {/* Rotating headline */}
        <div className="w-full max-w-4xl mx-auto mb-6">
          <LiquidSteelHeroRotator />
        </div>

        {/* CTA buttons — two side-by-side like reference */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4 w-full max-w-md mx-auto">
          <Link to="/register-supabase"
            className="w-full sm:w-auto px-10 py-4 rounded-xl text-base font-semibold text-white inline-flex items-center justify-center gap-2 transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #FF7A18, #E56A08)', fontFamily: fontFamily.body, fontWeight: 600, boxShadow: '0 8px 32px rgba(255,122,24,0.3)', minWidth: 190 }}
            data-testid="hero-cta">
            Try It For Free
          </Link>
          <Link to="/platform"
            className="w-full sm:w-auto px-10 py-4 rounded-xl text-base font-semibold inline-flex items-center justify-center gap-2 transition-all hover:bg-white/5"
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.25)', color: '#FFFFFF', fontFamily: fontFamily.body, fontWeight: 600, minWidth: 190 }}
            data-testid="hero-learn-more">
            Learn More
          </Link>
        </div>

        {/* Login link */}
        <Link to="/login-supabase"
          className="text-sm hover:text-white transition-colors mb-12"
          style={{ fontFamily: fontFamily.body, color: '#9FB0C3' }}
          data-testid="hero-login">
          Already have an account? <span className="font-semibold text-white">Log in</span>
        </Link>

        {/* ── Stats row — icon + number + label ── */}
        <div className="w-full max-w-3xl mx-auto mb-10 px-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-4" data-testid="stats-section">
            <StatItem icon={Shield}        value="6 hrs"    label="Saved per Week"       />
            <StatItem icon={AlertTriangle} value="83%"      label="Faster Risk Detection" />
            <StatItem icon={DollarSign}    value="$47K"     label="Cash Recovered"        />
            <StatItem icon={Database}      value="1 Single" label="Source of Truth"       />
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="w-full max-w-2xl mx-auto mb-8" style={{ height: 1, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent)' }} />

        {/* ── Protect / Stabilise / Strengthen + disclaimer ── */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
            {['Protect', 'Stabilise', 'Strengthen'].map(word => (
              <div key={word} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#FF7A18' }} />
                <span className="text-sm font-medium" style={{ fontFamily: fontFamily.body, color: '#E6EEF7' }}>{word}</span>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: fontFamily.mono, color: '#9FB0C3', opacity: 0.4, fontSize: '11px' }}>
            No credit card required &middot; Australian owned &amp; operated
          </p>
        </div>
      </div>
    </section>

    {/* gap */}
    <div style={{ background: '#07121E', height: 20 }} />

    {/* INTELLIGENCE ARCHITECTURE DIAGRAM */}
    <div style={{ background: '#07121E' }}>
      <IntelligenceDiagram />
    </div>

    {/* INTEGRATION CAROUSEL */}
    <div style={{ background: '#07121E' }}>
      <IntegrationCarousel />
    </div>

    {/* TRUST & COMPLIANCE BADGES */}
    <section className="py-10" style={{ background: '#07121E', borderTop: '1px solid rgba(255,122,24,0.1)', borderBottom: '1px solid rgba(255,122,24,0.1)' }} data-testid="trust-badges">
      <div className="max-w-5xl mx-auto px-6">
        <p className="text-center text-xs font-semibold tracking-widest uppercase mb-6" style={{ fontFamily: fontFamily.mono, color: '#FF7A18' }}>
          Security &amp; Compliance
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: '🇦🇺', label: 'Australian Hosted', sub: 'Sydney & Melbourne data centres' },
            { icon: '🔒', label: 'AES-256 Encrypted', sub: 'Defence-grade at rest & in transit' },
            { icon: '🛡️', label: 'Privacy Act Compliant', sub: 'Australian Privacy Principles' },
            { icon: '✅', label: '14-Day Guarantee', sub: 'No questions asked refund' },
          ].map(b => (
            <div key={b.label} className="flex items-start gap-3 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,122,24,0.12)' }}>
              <span className="text-2xl">{b.icon}</span>
              <div>
                <p className="text-xs font-semibold" style={{ color: '#E6EEF7', fontFamily: fontFamily.mono }}>{b.label}</p>
                <p className="text-[11px] mt-0.5 leading-snug" style={{ color: '#6B7B8D', fontFamily: fontFamily.body }}>{b.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

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
          <p className="text-base max-w-xl" style={{ fontFamily: fontFamily.body, color: '#9FB0C3' }}>Businesses embedding AI-driven decision systems experience:</p>
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
              <p className="text-sm leading-relaxed" style={{ fontFamily: fontFamily.body, color: '#9FB0C3' }}>{item.desc}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>

    {/* SOCIAL PROOF — Testimonials */}
    <section className="py-14 sm:py-20" style={{ background: '#060E18' }} data-testid="testimonials-section">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-8 h-[2px]" style={{ background: '#FF7A18' }} />
            <span className="text-xs font-medium tracking-widest uppercase" style={{ fontFamily: fontFamily.mono, color: '#FF7A18' }}>What Australian SMBs Say</span>
            <div className="w-8 h-[2px]" style={{ background: '#FF7A18' }} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-medium" style={{ fontFamily: fontFamily.displayING, color: '#E6EEF7' }}>
            Built for operators, not analysts.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              quote: "BIQc flagged a cash flow issue two weeks before it would have hit. We were able to collect early and avoid a painful overdraft.",
              author: "Operations Director",
              company: "Manufacturing SMB, NSW",
              metric: "$47K recovered",
            },
            {
              quote: "I used to spend 6 hours a week pulling together reports for our board. Now I walk in with the BIQc brief and it's done.",
              author: "Founder & CEO",
              company: "Professional Services, VIC",
              metric: "6hrs saved weekly",
            },
            {
              quote: "The competitive benchmark showed us we were invisible online while our competitors had 4× more review presence. We fixed it in 30 days.",
              author: "Marketing Manager",
              company: "Retail Group, QLD",
              metric: "83% faster detection",
            },
          ].map((t, i) => (
            <GlassCard key={i} className="flex flex-col">
              <div className="flex-1">
                <p className="text-sm leading-relaxed mb-4" style={{ fontFamily: fontFamily.body, color: '#9FB0C3' }}>
                  "{t.quote}"
                </p>
              </div>
              <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid rgba(255,122,24,0.15)' }}>
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#E6EEF7', fontFamily: fontFamily.display }}>{t.author}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#6B7B8D', fontFamily: fontFamily.body }}>{t.company}</p>
                </div>
                <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(255,122,24,0.12)', color: '#FF7A18', fontFamily: fontFamily.mono }}>
                  {t.metric}
                </span>
              </div>
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
        <p className="text-base mb-8 max-w-lg mx-auto" style={{ fontFamily: fontFamily.body, color: '#9FB0C3' }}>
          Join the operators who replaced reactive firefighting with autonomous intelligence.
        </p>
        <Link to="/register-supabase" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold text-white transition-all hover:brightness-110" style={{ background: 'linear-gradient(135deg, #FF7A18, #E56A08)', fontFamily: fontFamily.body, fontWeight: 600, boxShadow: '0 8px 32px rgba(255,122,24,0.25)' }} data-testid="bottom-cta">
          Try It For Free <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="mt-4" style={{ fontFamily: fontFamily.mono, color: '#9FB0C3', opacity: 0.3, fontSize: '12px' }}>14-day trial &middot; No credit card &middot; Australian support</p>
      </div>
    </section>
  </WebsiteLayout>
);

export default HomePage;
