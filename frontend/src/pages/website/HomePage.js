import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import usePageMeta from '../../hooks/usePageMeta';
import { IntelligenceDiagram } from '../../components/website/IntelligenceDiagram';
import { Shield, ArrowRight, Zap, Eye, BarChart3, Lock, Users, AlertTriangle, DollarSign, TrendingDown, AlertCircle, FileWarning } from 'lucide-react';
/* design tokens consumed via CSS custom properties — see liquid-steel-tokens.css */

// ─── Reusable card wrappers ───────────────────────────────────────────────────

const GlassCard = ({ children, className = '' }) => (
  <div className={`rounded-xl p-8 transition-all duration-300 hover:-translate-y-[2px] ${className}`}
    style={{ background: '#FFFFFF', border: '1px solid rgba(10,10,10,0.06)', borderRadius: 16 }}>
    {children}
  </div>
);

const StatCard = ({ number, stat, body, biqc }) => (
  <div
    className="rounded-2xl p-9 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1"
    style={{
      background: '#FFFFFF',
      border: '1px solid rgba(10,10,10,0.06)',
      borderRadius: 20,
      boxShadow: '0 8px 28px rgba(10,10,10,0.04)',
    }}
  >
    <p style={{ fontFamily: 'var(--font-marketing-display)', fontSize: '48px', fontWeight: 700, color: 'var(--ink-display)', lineHeight: 1.05, letterSpacing: '-0.04em', marginBottom: 0 }}>{number}</p>
    <p className="text-lg sm:text-xl leading-snug" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-marketing-ui)', fontWeight: 600, letterSpacing: '-0.01em' }}>{stat}</p>
    <p className="text-base leading-relaxed" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-marketing-ui)', letterSpacing: '-0.003em' }}>{body}</p>
    <p className="text-base leading-relaxed" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-marketing-ui)', paddingTop: '12px', borderTop: '1px solid rgba(10,10,10,0.06)', letterSpacing: '-0.003em' }}>{biqc}</p>
  </div>
);

const STATS = [
  {
    number: '90%',
    stat: 'of data is created every two years',
    body: <>Yet most businesses use less than <strong style={{ color: 'var(--ink-display, #0A0A0A)' }}>10% of it.</strong></>,
    biqc: 'BIQc transforms scattered data into practical business intelligence.',
  },
  {
    number: '40%',
    stat: 'of business decisions lack the right data',
    body: 'Leaders often rely on instinct instead of insight.',
    biqc: 'BIQc highlights the signals that matter before decisions are made.',
  },
  {
    number: '75%',
    stat: 'of businesses are experimenting with AI',
    body: <>But fewer than <strong style={{ color: 'var(--ink-display, #0A0A0A)' }}>5% see real operational value.</strong></>,
    biqc: 'BIQc delivers practical AI insights for everyday decisions.',
  },
  {
    number: '3%',
    stat: 'Poor decisions can cost up to 3% of revenue',
    body: 'Small mistakes add up quickly.',
    biqc: 'BIQc helps identify risks and opportunities early.',
  },
  {
    number: '5x',
    stat: 'Data-driven companies grow significantly faster',
    body: 'Intelligence creates competitive advantage.',
    biqc: 'BIQc provides the clarity leaders need to scale.',
  },
  {
    number: '40%',
    stat: 'of their time gathering information',
    body: 'Making decisions consumes far more time than it should.',
    biqc: 'BIQc brings the most important signals from across your business into one place, helping you understand what matters faster.',
  },
];

// ─── What You Get — pain-point cards ─────────────────────────────────────────

const WHAT_YOU_GET_CARDS = [
  {
    icon: DollarSign,
    iconBg: 'rgba(10,10,10,0.04)',
    iconColor: 'var(--ink)',
    border: 'rgba(10,10,10,0.06)',
    title: 'Revenue Leakage & Missed Opportunities',
    subtitle: "Identify revenue you're losing \u2014 without realising it.",
    bullets: [
      'Missed follow-ups and abandoned leads slipping through your pipeline',
      'Deals stalling at critical stages without intervention',
      'Customers disengaging before renewal without early warning',
      'Revenue concentrated in too few clients, increasing risk',
    ],
    cta: 'Recover lost revenue and close gaps before they widen',
    ctaColor: 'var(--ink-display)',
  },
  {
    icon: TrendingDown,
    iconBg: 'rgba(10,10,10,0.04)',
    iconColor: 'var(--ink)',
    border: 'rgba(10,10,10,0.06)',
    title: 'Cost & Payroll Blowouts',
    subtitle: 'Stop costs creeping up unnoticed.',
    bullets: [
      'Payroll exceeding output value without visibility',
      'Overtime and contractor costs growing unchecked',
      'Underperforming roles consuming budget without ROI',
      'Rising operational costs with no clear driver identified',
    ],
    cta: 'Control costs and protect your margins',
    ctaColor: 'var(--ink-display)',
  },
  {
    icon: AlertCircle,
    iconBg: 'rgba(10,10,10,0.04)',
    iconColor: 'var(--ink)',
    border: 'rgba(10,10,10,0.06)',
    title: 'Customer & Operational Risk',
    subtitle: 'Catch issues before they impact your reputation.',
    bullets: [
      'Customer complaints surfacing too late for recovery',
      'Missed service-level expectations eroding trust',
      'Communication breakdowns between teams and clients',
      'Processes not followed, creating inconsistent outcomes',
    ],
    cta: 'Fix problems early — before customers feel them',
    ctaColor: 'var(--ink-display)',
  },
  {
    icon: FileWarning,
    iconBg: 'rgba(10,10,10,0.04)',
    iconColor: 'var(--ink)',
    border: 'rgba(10,10,10,0.06)',
    title: 'Compliance & Legal Exposure',
    subtitle: 'Reduce risk before it becomes a liability.',
    bullets: [
      'Gaps in compliance documentation going unnoticed',
      'Missed regulatory obligations creating legal exposure',
      'Inconsistent processes across teams and locations',
      'Audit blind spots that compound over time',
    ],
    cta: 'Protect your business from avoidable risk',
    ctaColor: 'var(--ink-display)',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

const HomePage = () => {
  usePageMeta({ title: 'AI Business Intelligence', description: 'AI-powered business intelligence that continuously learns your business. Strategic advice, diagnostics, and growth planning for Australian SMEs.' });
  return (
  <WebsiteLayout>

    {/* ══════════════════════════════════════════════════════════
        HERO — premium centered, full-bleed dark
    ══════════════════════════════════════════════════════════ */}
    <section
      className="relative overflow-hidden"
      style={{ background: 'var(--canvas-sage)', fontFamily: 'var(--font-marketing-ui)' }}
      data-testid="hero-section"
    >
      <style>{`
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes badgePulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(10,10,10,0); }
          50%     { box-shadow: 0 0 0 10px rgba(10,10,10,0.04); }
        }
        @keyframes orbFloat {
          0%,100% { transform: translate(-50%, -50%) scale(1);    opacity: 0.55; }
          50%     { transform: translate(-50%, -50%) scale(1.12); opacity: 0.7; }
        }
        @keyframes heroCtaSheen {
          0%   { transform: translateX(-30%); opacity: 0; }
          20%  { opacity: 1; }
          60%  { opacity: 0.95; }
          100% { transform: translateX(30%); opacity: 0; }
        }
        .hero-fade-1 { animation: heroFadeUp 0.7s ease both 0.05s; }
        .hero-fade-2 { animation: heroFadeUp 0.7s ease both 0.18s; }
        .hero-fade-3 { animation: heroFadeUp 0.7s ease both 0.32s; }
        .hero-fade-4 { animation: heroFadeUp 0.7s ease both 0.46s; }
        .hero-fade-5 { animation: heroFadeUp 0.7s ease both 0.58s; }
        .hero-cta-glossy { position: relative; overflow: hidden; }
        .hero-cta-glossy::after {
          content: ''; position: absolute;
          top: 0; left: -60%; right: -60%; bottom: 0;
          background: linear-gradient(75deg,
            transparent 30%,
            rgba(255,255,255,0.18) 47%,
            rgba(232,93,0,0.35) 50%,
            rgba(255,255,255,0.18) 53%,
            transparent 70%);
          animation: heroCtaSheen 4.5s ease-in-out infinite;
          pointer-events: none;
          mix-blend-mode: screen;
        }
        .hero-cta-glossy:hover {
          box-shadow: 0 6px 20px rgba(10,10,10,0.24),
                      0 0 24px rgba(232,93,0,0.18),
                      0 1px 0 rgba(255,255,255,0.22) inset,
                      0 -1px 0 rgba(0,0,0,0.4) inset !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-cta-glossy::after { animation: none; }
        }
      `}</style>

      {/* ── Decorative background layers (shades only, Merge-aligned) ── */}
      {/* Centred soft bloom — was amber, now neutral shade */}
      <div className="absolute pointer-events-none" style={{
        top: '0%', left: '50%', width: 900, height: 560,
        transform: 'translate(-50%, -30%)',
        background: 'radial-gradient(ellipse, rgba(10,10,10,0.05) 0%, rgba(10,10,10,0.015) 40%, transparent 70%)',
        animation: 'orbFloat 12s ease-in-out infinite',
      }} />
      {/* Left accent orb — was blue, now shade */}
      <div className="absolute pointer-events-none hidden lg:block" style={{
        top: '60%', left: '5%', width: 400, height: 400,
        transform: 'translate(-50%, -50%)',
        background: 'radial-gradient(ellipse, rgba(10,10,10,0.035) 0%, transparent 70%)',
        animation: 'orbFloat 16s ease-in-out infinite 3s',
      }} />
      {/* Fine grid — softened */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(10,10,10,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(10,10,10,0.015) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }} />
      {/* Top vignette — was orange, now neutral shade */}
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(10,10,10,0.12), transparent)' }} />

      {/* ── Hero content (mockup v4.4 — bigger badge, 2× headline, glossy CTA, single trust line, hero width matches card row) ── */}
      <div className="relative z-10 mx-auto px-6 sm:px-10 text-center" style={{ maxWidth: 1448, paddingTop: 56, paddingBottom: 40 }}>

        {/* Badge — 2× size, prominent Australian Owned & Operated */}
        <div className="hero-fade-1 inline-flex items-center gap-3 px-6 py-3 rounded-full mb-6 cursor-default" style={{
          background: 'rgba(255,255,255,0.7)',
          border: '1px solid rgba(10,10,10,0.1)',
          animation: 'heroFadeUp 0.7s ease both 0.05s, badgePulse 4s ease-in-out infinite 1s',
          boxShadow: '0 2px 8px rgba(10,10,10,0.04)',
        }}>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: 'var(--lava)' }} />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: 'var(--lava)' }} />
          </span>
          <Shield className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ink-secondary)' }} />
          <span style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-display)', fontSize: '14px', fontWeight: 600, letterSpacing: '-0.005em' }}>
            Australian Owned &amp; Operated
          </span>
        </div>

        {/* Headline — 2× size, full container width to align with card row */}
        <h1
          className="hero-fade-2 tracking-tight mb-5"
          style={{
            fontFamily: 'var(--font-marketing-display)',
            fontSize: 'clamp(36px, 4.4vw, 56px)',
            lineHeight: 1.08,
            letterSpacing: '-0.035em',
            fontWeight: 600,
            color: 'var(--ink-display)',
          }}
        >
          A dashboard without intelligence is like using a GPS to tell you where you have been.
        </h1>

        {/* Subhead — 2× size */}
        <p
          className="hero-fade-3 max-w-3xl mx-auto leading-relaxed mb-8"
          style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-secondary)', fontSize: 'clamp(17px, 1.8vw, 22px)', letterSpacing: '-0.005em', marginTop: 14 }}
        >
          BIQc reads every signal across your business tools and tells you exactly what matters, so you can act with confidence.
        </p>

        {/* Trial pill + glossy CTA */}
        <div className="hero-fade-4 flex flex-col items-center mb-4 gap-3">
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-[0.08em]"
            style={{
              background: 'var(--lava-wash, rgba(232,93,0,0.12))',
              color: 'var(--lava, #E85D00)',
              border: '1px solid var(--lava-soft, rgba(232,93,0,0.18))',
              fontFamily: 'var(--font-marketing-ui)',
            }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--lava, #E85D00)', boxShadow: '0 0 8px var(--lava, #E85D00)' }} />
            14 days free · Cancel anytime
          </span>
          <Link
            to="/register-supabase"
            className="hero-cta-glossy group inline-flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 50%), linear-gradient(155deg, #1A1A1A 0%, #0A0A0A 50%, #050505 100%)',
              color: '#FFFFFF',
              fontFamily: 'var(--font-marketing-ui)',
              fontWeight: 600,
              fontSize: '15px',
              letterSpacing: '-0.005em',
              padding: '13px 26px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 4px 14px rgba(10,10,10,0.18), 0 1px 0 rgba(255,255,255,0.18) inset, 0 -1px 0 rgba(0,0,0,0.4) inset',
              minWidth: 'min(220px, calc(100vw - 64px))',
            }}
            data-testid="hero-cta"
          >
            <span style={{ position: 'relative', zIndex: 1 }}>Start Your 14-Day Trial</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" style={{ position: 'relative', zIndex: 1 }} />
          </Link>
        </div>

        {/* Trust line — replaces 3-item strip; data privacy commitment */}
        <p
          className="hero-fade-5"
          style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-muted)', fontSize: '13px', letterSpacing: '-0.002em', margin: '8px 0 0' }}
        >
          <strong style={{ color: 'var(--ink-display)', fontWeight: 600 }}>Your data stays yours.</strong> BIQc reads signals, not secrets.
        </p>

      </div>

      {/* ── Diagram flows directly from hero ── */}
      <div className="relative z-10">
        <IntelligenceDiagram embedded />
      </div>
    </section>

    {/* ══════════════════════════════════════════════════════════
        CUSTOMER LOGO CAROUSEL — REMOVED 2026-04-22 per Andreas directive.
        Section looked visually off; logos can come back once we have a
        polished treatment (and re-confirmed consent on the 4 brands).
    ══════════════════════════════════════════════════════════ */}

    {/* ══════════════════════════════════════════════════════════
        WHAT YOU GET — pain-point framing
    ══════════════════════════════════════════════════════════ */}
    <section className="pt-20 sm:pt-28 pb-16 sm:pb-24" style={{ background: 'var(--canvas-sage)', fontFamily: 'var(--font-marketing-ui)' }} data-testid="what-you-get">
      <style>{`
        .wyg-card-enhanced:hover {
          box-shadow: 0 12px 32px rgba(10,10,10,0.06) !important;
          transform: translateY(-4px);
        }
      `}</style>
      <div className="max-w-6xl mx-auto px-6">

        {/* Section header — sizes increased per v4.4 mock-up */}
        <div className="text-center mb-4">
          <p className="text-sm sm:text-base font-semibold tracking-widest uppercase mb-4" style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-secondary)', letterSpacing: '0.14em', display: 'inline-flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--lava)', display: 'inline-block' }} />
            Intelligence Output
          </p>
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl font-semibold mb-5"
            style={{ fontFamily: 'var(--font-marketing-display)', color: 'var(--ink-display)', letterSpacing: '-0.035em', lineHeight: 1.05 }}
          >
            What You Get
          </h2>
          <p className="text-lg sm:text-xl lg:text-2xl max-w-3xl mx-auto leading-relaxed"
            style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-marketing-ui)', letterSpacing: '-0.005em' }}>
            Full visibility over where you&rsquo;re <strong style={{ color: 'var(--ink-display)' }}>losing money</strong>;
            {' '}where risk is building, and where <strong style={{ color: 'var(--ink-display)' }}>growth</strong> is being{' '}
            <strong style={{ color: 'var(--ink-display)' }}>missed</strong>&mdash;<strong style={{ color: 'var(--ink-display)' }}>in real time.</strong>
          </p>
        </div>

        {/* 4 pain-point cards — bigger padding, larger readable text per Andreas 2026-04-30 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-7 mt-14">
          {WHAT_YOU_GET_CARDS.map((card) => (
            <div
              key={card.title}
              className="wyg-card-enhanced relative rounded-2xl p-8 flex flex-col gap-6 transition-all duration-300 overflow-hidden"
              style={{
                background: '#FFFFFF',
                border: `1px solid ${card.border}`,
              }}
            >
              {/* Top accent bar — was colored, now shade */}
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'rgba(10,10,10,0.18)', opacity: 0.6 }} />
              {/* Card header */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: card.iconBg }}>
                  <card.icon className="w-6 h-6" style={{ color: card.iconColor }} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl leading-snug mb-1" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-marketing-ui)', fontWeight: 600, letterSpacing: '-0.015em' }}>
                    {card.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-marketing-ui)', letterSpacing: '-0.003em' }}>
                    {card.subtitle}
                  </p>
                </div>
              </div>

              {/* Bullet points — colored dots → shade dots */}
              <ul className="flex flex-col gap-3 pl-1">
                {card.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <span className="flex-shrink-0 mt-2" style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(10,10,10,0.35)' }} />
                    <span className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-marketing-ui)', letterSpacing: '-0.003em' }}>{b}</span>
                  </li>
                ))}
              </ul>

              {/* Card CTA — arrow orange kept as micro-accent, text plain ink */}
              <div className="flex items-center gap-2 pt-4 mt-auto" style={{ borderTop: `1px solid ${card.border}` }}>
                <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--lava)' }} />
                <span className="text-sm leading-snug" style={{ color: card.ctaColor, fontFamily: 'var(--font-marketing-ui)', fontWeight: 600, letterSpacing: '-0.005em' }}>
                  {card.cta}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom banner — sized to match the bumped 4 cards above */}
        <div
          className="mt-10 rounded-2xl p-10 text-center"
          style={{
            background: 'var(--canvas-sage-deep)',
            border: '1px solid rgba(10,10,10,0.06)',
          }}
        >
          <h3 className="text-xl sm:text-2xl mb-4" style={{ fontFamily: 'var(--font-marketing-display)', color: 'var(--ink-display)', fontWeight: 600, letterSpacing: '-0.02em' }}>
            Then&mdash;BIQc Brings It Together
          </h3>
          <p className="text-base mb-3" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-marketing-ui)', letterSpacing: '-0.003em' }}>
            Daily Executive Brief &nbsp;·&nbsp; Strategic Action Plans &nbsp;·&nbsp; Market &amp; Competitor Intelligence
          </p>
          <p className="text-lg" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-marketing-ui)', fontWeight: 600, letterSpacing: '-0.01em' }}>
            The full picture &nbsp;·&nbsp; The right moves &nbsp;·&nbsp; The confidence to act
          </p>
        </div>

      </div>
    </section>

    {/* AI era evidence cards */}
    <section className="py-20 sm:py-24" style={{ background: 'var(--canvas-sage-soft)', fontFamily: 'var(--font-marketing-ui)' }} data-testid="ai-era-section">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-sm sm:text-base font-semibold tracking-widest uppercase mb-4 text-center" style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-secondary)', letterSpacing: '0.14em', display: 'inline-flex', alignItems: 'center', gap: 10, justifyContent: 'center', width: '100%' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--lava)', display: 'inline-block' }} />
          The Opportunity
        </p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold mb-5 text-center"
          style={{ fontFamily: 'var(--font-marketing-display)', color: 'var(--ink-display)', letterSpacing: '-0.035em', lineHeight: 1.1 }}>
          What Businesses Are Achieving In The AI Era
        </h2>
        <p className="text-lg sm:text-xl mb-14 max-w-3xl mx-auto leading-relaxed text-center"
          style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-marketing-ui)', letterSpacing: '-0.005em' }}>
          Business leaders make hundreds of decisions every day, and research shows up to{' '}
          <span style={{ color: 'var(--ink-display)', fontWeight: 600 }}>40%</span> of those decisions are made without the right data.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {STATS.map((item, i) => (
            <StatCard key={i} {...item} />
          ))}
        </div>
      </div>
    </section>

    {/* TRUST & COMPLIANCE BADGES — emoji killed, monoline shade icons */}
    <section className="py-14" style={{ background: '#FFFFFF', borderTop: '1px solid rgba(10,10,10,0.06)', borderBottom: '1px solid rgba(10,10,10,0.06)', fontFamily: 'var(--font-marketing-ui)' }} data-testid="trust-badges">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-wrap items-center justify-center gap-5">
          {[
            { iconPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', label: 'Australian Hosted', sub: 'Sydney & Melbourne data centres' },
            { iconPath: 'M7 11V7a5 5 0 0110 0v4', iconExtra: 'M3 11h18v11H3z', label: 'AES-256 Encrypted', sub: 'Defence-grade at rest & in transit' },
            { iconPath: 'M12 2L2 7v6c0 5.5 3.8 10.7 10 12 6.2-1.3 10-6.5 10-12V7L12 2z', label: 'Privacy Act Compliant', sub: 'Australian Privacy Principles' },
            { iconPath: 'M20 6 9 17l-5-5', label: '14-Day Guarantee', sub: 'No questions asked refund' },
          ].map(b => (
            <div key={b.label} className="flex items-center gap-4 p-5 rounded-xl" style={{ background: 'var(--canvas-sage-soft)', border: '1px solid rgba(10,10,10,0.06)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(10,10,10,0.04)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={b.iconPath} />
                  {b.iconExtra && <path d={b.iconExtra} />}
                </svg>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-marketing-ui)', fontWeight: 600, letterSpacing: '-0.005em' }}>{b.label}</p>
                <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-marketing-ui)', letterSpacing: '-0.002em' }}>{b.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* WHAT COGNITION DELIVERS — eyebrow orange → shade, icons orange → shade */}
    <section className="py-20 sm:py-28" style={{ background: 'var(--canvas-sage)', fontFamily: 'var(--font-marketing-ui)' }} data-testid="cognition-section">
      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-14 sm:mb-16 text-center">
          <p className="text-sm sm:text-base font-semibold tracking-widest uppercase mb-4" style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-secondary)', letterSpacing: '0.14em', display: 'inline-flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--lava)', display: 'inline-block' }} />
            What Cognition-as-a-Service Delivers
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl mb-4" style={{ fontFamily: 'var(--font-marketing-display)', color: 'var(--ink-display)', fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1.1 }}>
            Enterprise-grade intelligence.<br />SMB-sized investment.
          </h2>
          <p className="text-lg sm:text-xl max-w-2xl mx-auto" style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-secondary)', letterSpacing: '-0.005em' }}>Businesses embedding AI-driven decision systems experience:</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
          {[
            { icon: Eye, title: 'Monitors Everything', desc: 'Connects accounting, CRM, and ops. Watches 24/7.' },
            { icon: AlertTriangle, title: 'Detects & Flags', desc: 'Flags anomalies, cash flow risks, and compliance gaps early.' },
            { icon: Zap, title: 'Prevents & Corrects', desc: 'Recommends actions, drafts comms, and automates workflows.' },
            { icon: BarChart3, title: 'Executive Briefings', desc: 'Daily intelligence briefs from all sources. No dashboard digging.' },
            { icon: Lock, title: 'Australian Sovereign', desc: 'All data hosted in Australia with transparent provider processing and full audit trail.' },
            { icon: Users, title: 'Maximise Output', desc: 'Boost leverage and performance without expanding headcount.' },
          ].map((item, i) => (
            <GlassCard key={i}>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-5" style={{ background: 'rgba(10,10,10,0.04)' }}>
                <item.icon className="w-6 h-6" style={{ color: 'var(--ink)' }} strokeWidth={1.8} />
              </div>
              <h3 className="text-lg sm:text-xl mb-3" style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-display)', fontWeight: 600, letterSpacing: '-0.015em' }}>{item.title}</h3>
              <p className="text-base leading-relaxed" style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-secondary)', letterSpacing: '-0.003em' }}>{item.desc}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>

    {/* BOTTOM CTA — orange pill button → black pill, orange orb → shade orb */}
    <section className="relative py-20 sm:py-24 overflow-hidden" style={{ background: 'var(--canvas-sage)', fontFamily: 'var(--font-marketing-ui)' }} data-testid="cta-section">
      {/* Decorative orb — was orange+blue, now neutral shade */}
      <div className="absolute pointer-events-none" style={{
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(10,10,10,0.04), transparent 70%)',
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      }} />
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <h2 className="mb-5" style={{ fontFamily: 'var(--font-marketing-display)', color: 'var(--ink-display)', fontSize: 'clamp(36px, 4.4vw, 56px)', fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1.05 }}>
          Stop reacting. Start preventing.
        </h2>
        <p className="text-lg sm:text-xl mb-10 max-w-2xl mx-auto" style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-secondary)', lineHeight: 1.55, letterSpacing: '-0.005em' }}>
          Join the operators who replaced reactive firefighting with autonomous intelligence.
        </p>
        <div className="flex flex-col items-center gap-3">
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-[0.08em]"
            style={{
              background: 'var(--lava-wash, rgba(232,93,0,0.12))',
              color: 'var(--lava, #E85D00)',
              border: '1px solid var(--lava-soft, rgba(232,93,0,0.18))',
              fontFamily: 'var(--font-marketing-ui)',
            }}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--lava, #E85D00)', boxShadow: '0 0 8px var(--lava, #E85D00)' }} />
            14 days free · Cancel anytime
          </span>
          <Link to="/register-supabase" className="inline-flex items-center gap-2 transition-all hover:-translate-y-0.5" style={{ background: '#0A0A0A', color: '#FFFFFF', padding: '13px 28px', borderRadius: '999px', border: '1px solid #0A0A0A', fontFamily: 'var(--font-marketing-ui)', fontWeight: 500, fontSize: '15px', letterSpacing: '-0.005em', boxShadow: '0 4px 12px rgba(10,10,10,0.08)' }} data-testid="bottom-cta">
            Start Your 14-Day Trial <ArrowRight className="w-4 h-4" />
          </Link>
          <p style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-muted)', fontSize: '12px', letterSpacing: '-0.002em' }}>Australian support · SOC 2 in progress · Cancel anytime</p>
        </div>
      </div>
    </section>

  </WebsiteLayout>
  );
};

export default HomePage;
