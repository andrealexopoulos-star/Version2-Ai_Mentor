import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import usePageMeta from '../../hooks/usePageMeta';
import { IntelligenceDiagram } from '../../components/website/IntelligenceDiagram';
import { Shield, ArrowRight, Zap, Eye, BarChart3, Lock, Users, AlertTriangle, DollarSign, TrendingDown, AlertCircle, FileWarning } from 'lucide-react';
/* design tokens consumed via CSS custom properties — see liquid-steel-tokens.css */

// ─── Reusable card wrappers ───────────────────────────────────────────────────

const GlassCard = ({ children, className = '' }) => (
  <div className={`rounded-xl p-6 transition-all duration-300 hover:-translate-y-[2px] ${className}`}
    style={{ background: '#FFFFFF', border: '1px solid rgba(10,10,10,0.06)', borderRadius: 14 }}>
    {children}
  </div>
);

const StatCard = ({ number, stat, body, biqc }) => (
  <div
    className="rounded-2xl p-7 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1"
    style={{
      background: '#FFFFFF',
      border: '1px solid rgba(10,10,10,0.06)',
      borderRadius: 18,
      boxShadow: '0 8px 28px rgba(10,10,10,0.04)',
    }}
  >
    <p style={{ fontFamily: 'var(--font-marketing-display)', fontSize: '40px', fontWeight: 700, color: 'var(--ink-display)', lineHeight: 1.05, letterSpacing: '-0.04em', marginBottom: 0 }}>{number}</p>
    <p className="text-base sm:text-lg leading-snug" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-marketing-ui)', fontWeight: 600, letterSpacing: '-0.01em' }}>{stat}</p>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-marketing-ui)', letterSpacing: '-0.003em' }}>{body}</p>
    <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-marketing-ui)', paddingTop: '10px', borderTop: '1px solid rgba(10,10,10,0.06)', letterSpacing: '-0.003em' }}>{biqc}</p>
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
          50%     { box-shadow: 0 0 0 6px rgba(10,10,10,0.04); }
        }
        @keyframes orbFloat {
          0%,100% { transform: translate(-50%, -50%) scale(1);    opacity: 0.55; }
          50%     { transform: translate(-50%, -50%) scale(1.12); opacity: 0.7; }
        }
        .hero-fade-1 { animation: heroFadeUp 0.7s ease both 0.05s; }
        .hero-fade-2 { animation: heroFadeUp 0.7s ease both 0.18s; }
        .hero-fade-3 { animation: heroFadeUp 0.7s ease both 0.32s; }
        .hero-fade-4 { animation: heroFadeUp 0.7s ease both 0.46s; }
        .hero-fade-5 { animation: heroFadeUp 0.7s ease both 0.58s; }
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

      {/* ── Hero content ── */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 sm:px-10 text-center" style={{ paddingTop: 96, paddingBottom: 72 }}>

        {/* Badge — structure preserved, colors shaded */}
        <div className="hero-fade-1 inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-8 cursor-default" style={{
          background: 'rgba(255,255,255,0.65)',
          border: '1px solid rgba(10,10,10,0.08)',
          animation: 'heroFadeUp 0.7s ease both 0.05s, badgePulse 4s ease-in-out infinite 1s',
        }}>
          {/* Live indicator dot — subtle orange accent (the only orange in hero) */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: 'var(--lava)' }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--lava)' }} />
          </span>
          <Shield className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--ink-secondary)' }} />
          <span style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-secondary)', fontSize: '11px', fontWeight: 500, letterSpacing: '-0.005em' }}>
            Australian Owned &amp; Operated
          </span>
        </div>

        {/* Headline — Geist, plain color (gradient killed) */}
        <h1
          className="hero-fade-2 tracking-tight mb-5"
          style={{
            fontFamily: 'var(--font-marketing-display)',
            fontSize: 'clamp(26px, 3.8vw, 44px)',
            lineHeight: 1.1,
            letterSpacing: '-0.035em',
            fontWeight: 600,
            color: 'var(--ink-display)',
          }}
        >
          All your systems. One decision engine.{' '}
          <span style={{
            fontFamily: 'var(--font-marketing-display)',
            color: 'var(--ink-display)',
          }}>
            No noise. Just what matters.
          </span>
        </h1>

        {/* Subtitle — fixed color (was broken on light bg), Geist */}
        <p
          className="hero-fade-3 max-w-2xl mx-auto leading-relaxed mb-10"
          style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-secondary)', fontSize: 'clamp(15px, 1.8vw, 18px)', letterSpacing: '-0.005em', marginTop: 18 }}
        >
          BIQc reads every signal across your business, and tells you exactly what matters, so you can act with confidence.
        </p>

        {/* CTA — was orange gradient, now black pill. 2026-04-19 PDF #4b:
            trial claim was buried; promoted to a prominent accent pill
            above the CTA button (reviewer's direction). */}
        <div className="hero-fade-4 flex flex-col items-center mb-6 gap-3">
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
            className="group relative inline-flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
            style={{
              background: '#0A0A0A',
              color: '#FFFFFF',
              fontFamily: 'var(--font-marketing-ui)',
              fontWeight: 500,
              fontSize: '15px',
              letterSpacing: '-0.005em',
              padding: '13px 24px',
              borderRadius: '999px',
              border: '1px solid #0A0A0A',
              boxShadow: '0 4px 12px rgba(10,10,10,0.08)',
              minWidth: 'min(200px, calc(100vw - 64px))',
            }}
            data-testid="hero-cta"
          >
            Start Your 14-Day Trial
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Inline trust strip — monochrome shades, emoji removed, font Geist */}
        <div className="hero-fade-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
          {[
            { label: 'Australian Hosted' },
            { label: 'AES-256 Encrypted' },
            { label: '14-Day Guarantee' },
          ].map((t, i) => (
            <span key={t.label} className="flex items-center gap-1.5">
              {i > 0 && <span style={{ display: 'inline-block', width: 3, height: 3, borderRadius: '50%', background: 'rgba(10,10,10,0.2)' }} />}
              <span style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-muted)', fontSize: '12px', fontWeight: 500, letterSpacing: '-0.002em' }}>{t.label}</span>
            </span>
          ))}
          <span style={{ display: 'inline-block', width: 3, height: 3, borderRadius: '50%', background: 'rgba(10,10,10,0.2)' }} />
          <Link
            to="/login-supabase"
            className="transition-colors"
            style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-secondary)', fontSize: '12px', fontWeight: 500, letterSpacing: '-0.002em' }}
            data-testid="hero-login"
          >
            Already have an account?
          </Link>
        </div>

      </div>

      {/* ── Diagram flows directly from hero ── */}
      <div className="relative z-10">
        <IntelligenceDiagram embedded />
      </div>
    </section>

    {/* ══════════════════════════════════════════════════════════
        CUSTOMER LOGO CAROUSEL — consent-confirmed 2026-04-21
        Samsung, Phillips Healthcare, Twilio, Lending Tree,
        Evo Homes Victoria, Blanca Melbourne
    ══════════════════════════════════════════════════════════ */}
    <section
      aria-label="Customers"
      style={{ background: 'var(--canvas-sage)', padding: '40px 0 48px', position: 'relative', overflow: 'hidden', fontFamily: 'var(--font-marketing-ui)' }}
      data-testid="customer-logos"
    >
      <style>{`
        @keyframes biqcLogoScroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .biqc-logo-eyebrow {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--ink-muted);
          text-align: center;
          margin: 0 0 28px;
        }
        .biqc-logo-track-wrap {
          position: relative;
          overflow: hidden;
          display: flex;
          justify-content: center;
          -webkit-mask-image: linear-gradient(to right, transparent 0, #000 12%, #000 88%, transparent 100%);
          mask-image: linear-gradient(to right, transparent 0, #000 12%, #000 88%, transparent 100%);
        }
        .biqc-logo-track {
          display: flex;
          align-items: center;
          width: max-content;
          animation: biqcLogoScroll 48s linear infinite;
          will-change: transform;
        }
        .biqc-logo-track:hover { animation-play-state: paused; }
        .biqc-logo-item {
          flex-shrink: 0;
          width: 180px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ink-muted);
          opacity: 0.6;
          transition: opacity 0.25s, color 0.25s, transform 0.25s;
        }
        .biqc-logo-item:hover {
          opacity: 1;
          color: var(--ink-display);
          transform: translateY(-1px);
        }
        .biqc-logo-item img {
          height: 24px;
          width: auto;
          max-width: 140px;
          object-fit: contain;
          display: block;
        }
        .biqc-logo-text {
          font-family: var(--font-marketing-display);
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.02em;
          font-style: italic;
          line-height: 1;
          white-space: nowrap;
        }
      `}</style>
      <p className="biqc-logo-eyebrow">Trusted by operators building smarter businesses</p>
      <div className="biqc-logo-track-wrap">
        <div className="biqc-logo-track">
          {[0, 1].map((copy) => (
            <React.Fragment key={copy}>
              <div className="biqc-logo-item"><img src="https://cdn.simpleicons.org/samsung/737373" alt="Samsung" /></div>
              <div className="biqc-logo-item"><span className="biqc-logo-text">Phillips Healthcare</span></div>
              <div className="biqc-logo-item"><img src="https://cdn.simpleicons.org/twilio/737373" alt="Twilio" /></div>
              <div className="biqc-logo-item"><span className="biqc-logo-text">Lending Tree</span></div>
              <div className="biqc-logo-item"><span className="biqc-logo-text">Evo Homes Victoria</span></div>
              <div className="biqc-logo-item"><span className="biqc-logo-text">Blanca Melbourne</span></div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>

    {/* ══════════════════════════════════════════════════════════
        WHAT YOU GET — pain-point framing
    ══════════════════════════════════════════════════════════ */}
    <section className="pb-16 sm:pb-24" style={{ background: 'var(--canvas-sage)', fontFamily: 'var(--font-marketing-ui)' }} data-testid="what-you-get">
      <style>{`
        .wyg-card-enhanced:hover {
          box-shadow: 0 12px 32px rgba(10,10,10,0.06) !important;
          transform: translateY(-4px);
        }
      `}</style>
      <div className="max-w-5xl mx-auto px-6">

        {/* Section header — eyebrow orange → shade with tiny orange dot */}
        <div className="text-center mb-4">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-secondary)', letterSpacing: '0.12em', display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--lava)', display: 'inline-block' }} />
            Intelligence Output
          </p>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-semibold mb-4"
            style={{ fontFamily: 'var(--font-marketing-display)', color: 'var(--ink-display)', letterSpacing: '-0.035em', lineHeight: 1.1 }}
          >
            What You Get
          </h2>
          <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed"
            style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-marketing-ui)', letterSpacing: '-0.005em' }}>
            Full visibility over where you&rsquo;re <strong style={{ color: 'var(--ink-display)' }}>losing money</strong>;
            {' '}where risk is building, and where <strong style={{ color: 'var(--ink-display)' }}>growth</strong> is being{' '}
            <strong style={{ color: 'var(--ink-display)' }}>missed</strong>&mdash;<strong style={{ color: 'var(--ink-display)' }}>in real time.</strong>
          </p>
        </div>

        {/* 4 pain-point cards — monochrome shades, white bg */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-10">
          {WHAT_YOU_GET_CARDS.map((card) => (
            <div
              key={card.title}
              className="wyg-card-enhanced relative rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300 overflow-hidden"
              style={{
                background: '#FFFFFF',
                border: `1px solid ${card.border}`,
              }}
            >
              {/* Top accent bar — was colored, now shade */}
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'rgba(10,10,10,0.18)', opacity: 0.6 }} />
              {/* Card header */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: card.iconBg }}>
                  <card.icon className="w-5 h-5" style={{ color: card.iconColor }} />
                </div>
                <div>
                  <h3 className="text-sm leading-snug mb-0.5" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-marketing-ui)', fontWeight: 600, letterSpacing: '-0.015em' }}>
                    {card.title}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-marketing-ui)', letterSpacing: '-0.003em' }}>
                    {card.subtitle}
                  </p>
                </div>
              </div>

              {/* Bullet points — colored dots → shade dots */}
              <ul className="flex flex-col gap-2 pl-1">
                {card.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <span className="flex-shrink-0 mt-1.5" style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(10,10,10,0.35)' }} />
                    <span className="text-xs leading-relaxed" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-marketing-ui)', letterSpacing: '-0.003em' }}>{b}</span>
                  </li>
                ))}
              </ul>

              {/* Card CTA — arrow orange kept as micro-accent, text plain ink */}
              <div className="flex items-center gap-2 pt-3 mt-auto" style={{ borderTop: `1px solid ${card.border}` }}>
                <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--lava)' }} />
                <span className="text-xs leading-snug" style={{ color: card.ctaColor, fontFamily: 'var(--font-marketing-ui)', fontWeight: 600, letterSpacing: '-0.005em' }}>
                  {card.cta}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom banner — orange accent text → plain ink, sage-deep bg */}
        <div
          className="mt-6 rounded-2xl p-8 text-center"
          style={{
            background: 'var(--canvas-sage-deep)',
            border: '1px solid rgba(10,10,10,0.06)',
          }}
        >
          <h3 className="text-lg sm:text-xl mb-3" style={{ fontFamily: 'var(--font-marketing-display)', color: 'var(--ink-display)', fontWeight: 600, letterSpacing: '-0.02em' }}>
            Then&mdash;BIQc Brings It Together
          </h3>
          <p className="text-sm mb-3" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-marketing-ui)', letterSpacing: '-0.003em' }}>
            Daily Executive Brief &nbsp;·&nbsp; Strategic Action Plans &nbsp;·&nbsp; Market &amp; Competitor Intelligence
          </p>
          <p className="text-base" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-marketing-ui)', fontWeight: 600, letterSpacing: '-0.01em' }}>
            The full picture &nbsp;·&nbsp; The right moves &nbsp;·&nbsp; The confidence to act
          </p>
        </div>

      </div>
    </section>

    {/* AI era evidence cards */}
    <section className="py-14 sm:py-16" style={{ background: 'var(--canvas-sage-soft)', fontFamily: 'var(--font-marketing-ui)' }} data-testid="ai-era-section">
      <div className="max-w-5xl mx-auto px-6">
        <p className="text-xs font-semibold tracking-widest uppercase mb-3 text-center" style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-secondary)', letterSpacing: '0.12em', display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center', width: '100%' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--lava)', display: 'inline-block' }} />
          The Opportunity
        </p>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold mb-4 text-center"
          style={{ fontFamily: 'var(--font-marketing-display)', color: 'var(--ink-display)', letterSpacing: '-0.035em', lineHeight: 1.1 }}>
          What Businesses Are Achieving In The AI Era
        </h2>
        <p className="text-base sm:text-lg mb-10 max-w-2xl mx-auto leading-relaxed text-center"
          style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-marketing-ui)', letterSpacing: '-0.005em' }}>
          Business leaders make hundreds of decisions every day, and research shows up to{' '}
          <span style={{ color: 'var(--ink-display)', fontWeight: 600 }}>40%</span> of those decisions are made without the right data.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {STATS.map((item, i) => (
            <StatCard key={i} {...item} />
          ))}
        </div>
      </div>
    </section>

    {/* TRUST & COMPLIANCE BADGES — emoji killed, monoline shade icons */}
    <section className="py-10" style={{ background: '#FFFFFF', borderTop: '1px solid rgba(10,10,10,0.06)', borderBottom: '1px solid rgba(10,10,10,0.06)', fontFamily: 'var(--font-marketing-ui)' }} data-testid="trust-badges">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {[
            { iconPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', label: 'Australian Hosted', sub: 'Sydney & Melbourne data centres' },
            { iconPath: 'M7 11V7a5 5 0 0110 0v4', iconExtra: 'M3 11h18v11H3z', label: 'AES-256 Encrypted', sub: 'Defence-grade at rest & in transit' },
            { iconPath: 'M12 2L2 7v6c0 5.5 3.8 10.7 10 12 6.2-1.3 10-6.5 10-12V7L12 2z', label: 'Privacy Act Compliant', sub: 'Australian Privacy Principles' },
            { iconPath: 'M20 6 9 17l-5-5', label: '14-Day Guarantee', sub: 'No questions asked refund' },
          ].map(b => (
            <div key={b.label} className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'var(--canvas-sage-soft)', border: '1px solid rgba(10,10,10,0.06)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(10,10,10,0.04)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={b.iconPath} />
                  {b.iconExtra && <path d={b.iconExtra} />}
                </svg>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-marketing-ui)', fontWeight: 600, letterSpacing: '-0.005em' }}>{b.label}</p>
                <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-marketing-ui)', letterSpacing: '-0.002em' }}>{b.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* WHAT COGNITION DELIVERS — eyebrow orange → shade, icons orange → shade */}
    <section className="py-14 sm:py-20" style={{ background: 'var(--canvas-sage)', fontFamily: 'var(--font-marketing-ui)' }} data-testid="cognition-section">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-10 sm:mb-12 text-center">
          <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-secondary)', letterSpacing: '0.12em', display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--lava)', display: 'inline-block' }} />
            What Cognition-as-a-Service Delivers
          </p>
          <h2 className="text-2xl sm:text-3xl mb-3" style={{ fontFamily: 'var(--font-marketing-display)', color: 'var(--ink-display)', fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1.1 }}>
            Enterprise-grade intelligence.<br />SMB-sized investment.
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-secondary)', letterSpacing: '-0.005em' }}>Businesses embedding AI-driven decision systems experience:</p>
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
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: 'rgba(10,10,10,0.04)' }}>
                <item.icon className="w-5 h-5" style={{ color: 'var(--ink)' }} strokeWidth={1.8} />
              </div>
              <h3 className="text-base mb-2" style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-display)', fontWeight: 600, letterSpacing: '-0.015em' }}>{item.title}</h3>
              <p className="text-sm leading-relaxed" style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-secondary)', letterSpacing: '-0.003em' }}>{item.desc}</p>
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
      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <h2 className="mb-4" style={{ fontFamily: 'var(--font-marketing-display)', color: 'var(--ink-display)', fontSize: 'clamp(32px, 4vw, 44px)', fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1.1 }}>
          Stop reacting. Start preventing.
        </h2>
        <p className="text-base mb-8 max-w-lg mx-auto" style={{ fontFamily: 'var(--font-marketing-ui)', color: 'var(--ink-secondary)', lineHeight: 1.6, letterSpacing: '-0.005em' }}>
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
