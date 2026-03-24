import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { LiquidSteelHeroRotator } from '../../components/website/LiquidSteelHeroRotator';
import { IntegrationCarousel } from '../../components/website/IntegrationCarousel';
import { IntelligenceDiagram } from '../../components/website/IntelligenceDiagram';
import { HowItWorks } from '../../components/website/HowItWorks';
import { CheckCircle2, Shield, ArrowRight, Zap, Eye, BarChart3, Lock, Users, AlertTriangle } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';


const GlassCard = ({ children, className = '' }) => (
  <div className={`rounded-xl p-6 transition-all duration-300 hover:border-[#FF7A18]/30 hover:translate-y-[-2px] ${className}`}
    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,140,40,0.15)', borderRadius: 12 }}>
    {children}
  </div>
);

const DIAMOND_PATTERN = `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cpath d='M40 4L76 40L40 76L4 40z' stroke='%23ffffff' stroke-opacity='0.04' stroke-width='1'/%3E%3C/g%3E%3C/svg%3E")`;

/* ── Stat card — orange-bordered rounded card like Intelligence Diagram ─── */
const StatCard = ({ stat, body, biqc }) => (
  <div
    className="rounded-2xl p-7 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1"
    style={{
      background: 'rgba(20,28,38,0.85)',
      border: '1px solid rgba(255,122,24,0.25)',
      borderRadius: 18,
      boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,122,24,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
      backdropFilter: 'blur(12px)',
    }}
  >
    <p className="text-base sm:text-lg font-bold leading-snug" style={{ color: '#FFFFFF', fontFamily: fontFamily.body }}>{stat}</p>
    <p className="text-sm leading-relaxed" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>{body}</p>
    <p className="text-sm italic leading-relaxed" style={{ color: '#FF7A18', fontFamily: fontFamily.body }}>{biqc}</p>
  </div>
);

const STATS = [
  {
    stat: '90% of data is created every two years',
    body: <>Yet most businesses use less than <strong style={{ color: '#FFFFFF' }}>10% of it.</strong></>,
    biqc: 'BIQc transforms scattered data into practical business intelligence.',
  },
  {
    stat: '40% of business decisions lack the right data',
    body: 'Leaders often rely on instinct instead of insight.',
    biqc: 'BIQc highlights the signals that matter before decisions are made.',
  },
  {
    stat: '75% of businesses are experimenting with AI',
    body: <>But fewer than <strong style={{ color: '#FFFFFF' }}>5% see real operational value.</strong></>,
    biqc: 'BIQc delivers practical AI insights for everyday decisions.',
  },
  {
    stat: 'Poor decisions can cost up to 3% of revenue',
    body: 'Small mistakes add up quickly.',
    biqc: 'BIQc helps identify risks and opportunities early.',
  },
  {
    stat: 'Data-driven companies grow significantly faster',
    body: 'Intelligence creates competitive advantage.',
    biqc: 'BIQc provides the clarity leaders need to scale.',
  },
  {
    stat: 'Business leaders spend up to 40% of their time gathering information',
    body: 'Making decisions consumes far more time than it should.',
    biqc: 'BIQc brings the most important signals from across your business into one place, helping you understand what matters faster.',
  },
];

const HomePage = () => (
  <WebsiteLayout>

    {/* ══════════════════════════════════════
        HERO — above the fold
    ══════════════════════════════════════ */}
    <section className="relative overflow-hidden" style={{ minHeight: '100vh', background: '#070E18' }} data-testid="hero-section">

      {/* Diamond grid background */}
      <div className="absolute inset-0" style={{ backgroundImage: DIAMOND_PATTERN, backgroundSize: '80px 80px', zIndex: 1 }} />

      {/* Centre spotlight glow */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 80% 55% at 50% 15%, rgba(30,50,80,0.55) 0%, transparent 70%)',
        zIndex: 2,
      }} />

      {/* Content — centred column */}
      <div className="relative flex flex-col items-center text-center px-5 sm:px-8"
        style={{ minHeight: '100vh', zIndex: 3, paddingTop: 72, paddingBottom: 64 }}>

        {/* ── Australian Shield — subtle pill above headline ── */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-3"
          style={{ background: 'rgba(255,122,24,0.06)', border: '1px solid rgba(255,122,24,0.15)' }}>
          <Shield className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#FF7A18', opacity: 0.8 }} />
          <span className="text-xs font-medium tracking-widest uppercase"
            style={{ fontFamily: fontFamily.mono, color: '#FF7A18', opacity: 0.8 }}>
            Australian Owned &amp; Operated
          </span>
        </div>

        {/* ── Headline ── */}
        <div className="w-full max-w-5xl mx-auto mb-5">
          <LiquidSteelHeroRotator />
        </div>

        {/* ── Two CTAs — side by side on desktop, stacked on mobile ── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3 w-full max-w-sm sm:max-w-none mx-auto">
          <Link to="/register-supabase"
            className="w-full sm:w-auto px-10 py-3.5 rounded-xl text-sm font-semibold text-white text-center transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #FF7A18, #E56A08)', fontFamily: fontFamily.body, fontWeight: 600, boxShadow: '0 6px 24px rgba(255,122,24,0.28)', minWidth: 180 }}
            data-testid="hero-cta">
            Try It For Free
          </Link>
          <Link to="/platform"
            className="w-full sm:w-auto px-10 py-3.5 rounded-xl text-sm font-semibold text-white text-center transition-all hover:bg-white/5"
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.22)', fontFamily: fontFamily.body, fontWeight: 600, minWidth: 180 }}
            data-testid="hero-learn-more">
            Learn More
          </Link>
        </div>

        {/* Login link */}
        <p className="text-xs mb-5 text-center" style={{ fontFamily: fontFamily.body, color: '#9FB0C3' }}>
          Already have an account?{' '}
          <Link to="/login-supabase" className="font-semibold text-white hover:text-[#FF7A18] transition-colors" data-testid="hero-login">Log in</Link>
        </p>

        {/* ── Protect / Stabilise / Strengthen ── */}
        <div className="flex flex-col items-center gap-2 mb-16">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {['Protect', 'Stabilise', 'Strengthen'].map(word => (
              <div key={word} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#FF7A18' }} />
                <span className="text-base sm:text-lg font-semibold" style={{ fontFamily: fontFamily.body, color: '#E6EEF7' }}>{word}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-center mt-1" style={{ fontFamily: fontFamily.mono, color: '#9FB0C3', opacity: 0.4 }}>
            No credit card required &middot; Australian owned &amp; operated
          </p>
        </div>

        {/* ════════════════════════════════════
            AI ERA SECTION — sits at the fold
        ════════════════════════════════════ */}

        {/* Section heading */}
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 mt-6"
          style={{ fontFamily: fontFamily.display, color: '#F4F7FA' }}>
          What Businesses Are Achieving In The AI Era
        </h2>

        {/* Intro paragraph — under heading */}
        <p className="text-base sm:text-lg mb-10 max-w-2xl mx-auto leading-relaxed"
          style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>
          Business leaders make hundreds of decisions every day, and research shows up to{' '}
          <span style={{ color: '#FF7A18', fontWeight: 600 }}>40%</span> of those decisions are made without the right data.
        </p>

        {/* ── Stat cards — 3-col grid with shadow/glow ── */}
        <div className="w-full max-w-5xl mx-auto px-2 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {STATS.map((item, i) => (
              <StatCard key={i} {...item} />
            ))}
          </div>
        </div>

      </div>
    </section>

    {/* gap */}
    <div style={{ background: '#07121E', height: 20 }} />

    {/* HOW IT WORKS — consolidated from /platform + /intelligence */}
    <HowItWorks />

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
            { icon: Lock, title: 'Australian Sovereign', desc: 'All data hosted in Australia with transparent provider processing and full audit trail.' },
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
