import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import ModernIntegrationBanner from '../../components/website/ModernIntegrationBanner';
import { IntelligenceDiagram } from '../../components/website/IntelligenceDiagram';
import { Shield, ArrowRight, Zap, Eye, BarChart3, Lock, Users, AlertTriangle, DollarSign, TrendingDown, AlertCircle, FileWarning, Check } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';

// ─── Reusable card wrappers ───────────────────────────────────────────────────

const GlassCard = ({ children, className = '' }) => (
  <div className={`rounded-xl p-6 transition-all duration-300 hover:border-[#E85D00]/30 hover:translate-y-[-2px] ${className}`}
    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(232,93,0,0.15)', borderRadius: 12 }}>
    {children}
  </div>
);

const StatCard = ({ stat, body, biqc }) => (
  <div
    className="rounded-2xl p-7 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1"
    style={{
      background: 'rgba(20,28,38,0.85)',
      border: '1px solid rgba(232,93,0,0.25)',
      borderRadius: 18,
      boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(232,93,0,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
      backdropFilter: 'blur(12px)',
    }}
  >
    <p className="text-base sm:text-lg font-bold leading-snug" style={{ color: '#FFFFFF', fontFamily: fontFamily.body }}>{stat}</p>
    <p className="text-sm leading-relaxed" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>{body}</p>
    <p className="text-sm italic leading-relaxed" style={{ color: '#E85D00', fontFamily: fontFamily.body }}>{biqc}</p>
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

// ─── What You Get — pain-point cards ─────────────────────────────────────────

const WHAT_YOU_GET_CARDS = [
  {
    icon: DollarSign,
    iconBg: 'rgba(16,185,129,0.12)',
    iconColor: '#10B981',
    border: 'rgba(16,185,129,0.2)',
    title: 'Revenue Leakage & Missed Opportunities',
    subtitle: "Identify revenue you're losing—without realising it.",
    bullets: [
      'Missed follow-ups and unconverted leads',
      'Deals stalling in your pipeline',
      'Customers disengaging or reducing spend',
      'Revenue concentrated in too few clients',
    ],
    cta: 'Recover lost revenue and close gaps before they widen',
    ctaColor: '#10B981',
  },
  {
    icon: TrendingDown,
    iconBg: 'rgba(59,130,246,0.12)',
    iconColor: '#3B82F6',
    border: 'rgba(59,130,246,0.2)',
    title: 'Cost & Payroll Blowouts',
    subtitle: 'Stop costs creeping up unnoticed.',
    bullets: [
      'Payroll exceeding expected output',
      'Overtime and staffing inefficiencies',
      'Underperforming roles or resource misallocation',
      'Rising operational costs without clear return',
    ],
    cta: 'Control costs and protect your margins',
    ctaColor: '#3B82F6',
  },
  {
    icon: AlertCircle,
    iconBg: 'rgba(245,158,11,0.12)',
    iconColor: '#F59E0B',
    border: 'rgba(245,158,11,0.2)',
    title: 'Customer & Operational Risk',
    subtitle: 'Catch issues before they impact your reputation.',
    bullets: [
      'Customer complaints and negative patterns',
      'Missed service expectations or delays',
      'Internal communication breakdowns',
      'Processes not being followed by staff',
    ],
    cta: 'Fix problems early — before customers feel them',
    ctaColor: '#F59E0B',
  },
  {
    icon: FileWarning,
    iconBg: 'rgba(239,68,68,0.12)',
    iconColor: '#EF4444',
    border: 'rgba(239,68,68,0.2)',
    title: 'Compliance & Legal Exposure',
    subtitle: 'Reduce risk before it becomes a liability.',
    bullets: [
      'Gaps in compliance or documentation',
      'Missed obligations, deadlines, or policies',
      'Inconsistent processes that create legal exposure',
      'Audit and governance blind spots',
    ],
    cta: 'Protect your business from avoidable risk',
    ctaColor: '#EF4444',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

const HomePage = () => (
  <WebsiteLayout>

    {/* ══════════════════════════════════════════════════════════
        HERO — premium centered, full-bleed dark
    ══════════════════════════════════════════════════════════ */}
    <section
      className="relative overflow-hidden"
      style={{ background: '#080C14' }}
      data-testid="hero-section"
    >
      <style>{`
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes badgePulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(232,93,0,0); }
          50%     { box-shadow: 0 0 0 6px rgba(232,93,0,0.08); }
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

      {/* ── Decorative background layers ── */}
      {/* Centred amber bloom */}
      <div className="absolute pointer-events-none" style={{
        top: '0%', left: '50%', width: 900, height: 560,
        transform: 'translate(-50%, -30%)',
        background: 'radial-gradient(ellipse, rgba(198,95,46,0.13) 0%, rgba(232,93,0,0.04) 40%, transparent 70%)',
        animation: 'orbFloat 12s ease-in-out infinite',
      }} />
      {/* Left accent orb */}
      <div className="absolute pointer-events-none hidden lg:block" style={{
        top: '60%', left: '5%', width: 400, height: 400,
        transform: 'translate(-50%, -50%)',
        background: 'radial-gradient(ellipse, rgba(59,130,246,0.06) 0%, transparent 70%)',
        animation: 'orbFloat 16s ease-in-out infinite 3s',
      }} />
      {/* Fine grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }} />
      {/* Top vignette */}
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(232,93,0,0.3), transparent)' }} />

      {/* ── Hero content ── */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 sm:px-10 text-center" style={{ paddingTop: 96, paddingBottom: 72 }}>

        {/* Badge */}
        <div className="hero-fade-1 inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-8 cursor-default" style={{
          background: 'rgba(232,93,0,0.06)',
          border: '1px solid rgba(232,93,0,0.22)',
          animation: 'heroFadeUp 0.7s ease both 0.05s, badgePulse 4s ease-in-out infinite 1s',
        }}>
          {/* Live indicator dot */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: '#E85D00' }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#E85D00' }} />
          </span>
          <Shield className="w-3 h-3 flex-shrink-0" style={{ color: '#E85D00' }} />
          <span style={{ fontFamily: fontFamily.mono, color: '#E85D00', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Australian Owned &amp; Operated
          </span>
        </div>

        {/* Headline */}
        <h1
          className="hero-fade-2 tracking-tight mb-5"
          style={{
            fontFamily: fontFamily.display,
            fontSize: 'clamp(26px, 3.8vw, 44px)',
            lineHeight: 1.1,
            color: '#EDF1F7',
          }}
        >
          One intelligence layer for every{' '}
          <span style={{
            fontFamily: fontFamily.display,
            background: 'linear-gradient(135deg, #FF8C3A 0%, #C65F2E 60%, #A64F26 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            decision that matters.
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="hero-fade-3 max-w-2xl mx-auto leading-relaxed mb-10"
          style={{ fontFamily: fontFamily.body, color: 'rgba(159,176,195,0.9)', fontSize: 'clamp(15px, 1.8vw, 18px)' }}
        >
          BIQc brings your business systems into one live Intelligence Platform — helping owners
          and leaders make faster decisions, evaluate trade‑offs clearly, and execute with
          confidence in real time.
        </p>

        {/* CTA — single centred button */}
        <div className="hero-fade-4 flex justify-center mb-6">
          <Link
            to="/register-supabase"
            className="group relative inline-flex items-center justify-center gap-2 px-10 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #D06832, #A64F26)',
              fontFamily: fontFamily.body,
              fontWeight: 600,
              boxShadow: '0 8px 28px rgba(198,95,46,0.38), 0 2px 4px rgba(0,0,0,0.3)',
              minWidth: 220,
            }}
            data-testid="hero-cta"
          >
            Start For Free Today
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Inline trust strip */}
        <div className="hero-fade-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
          {[
            { icon: '🇦🇺', label: 'Australian Hosted' },
            { icon: '🔒', label: 'AES-256 Encrypted' },
            { icon: '✅', label: '14-Day Guarantee' },
          ].map((t, i) => (
            <span key={t.label} className="flex items-center gap-1.5">
              {i > 0 && <span style={{ color: 'rgba(100,116,139,0.5)', marginRight: 4 }}>·</span>}
              <span style={{ fontSize: '13px' }}>{t.icon}</span>
              <span style={{ fontFamily: fontFamily.mono, color: '#64748B', fontSize: '11px', fontWeight: 500 }}>{t.label}</span>
            </span>
          ))}
          <span style={{ color: 'rgba(100,116,139,0.5)' }}>·</span>
          <Link
            to="/login-supabase"
            className="hover:text-white transition-colors"
            style={{ fontFamily: fontFamily.mono, color: '#64748B', fontSize: '11px' }}
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
        ANIMATED CONNECTOR — diagram → What You Get
    ══════════════════════════════════════════════════════════ */}
    <div style={{ background: '#0B1120', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 0, paddingBottom: 0 }}>
      <style>{`
        @keyframes connectorPulse {
          0%   { transform: translateX(-50%) translateY(0);    opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateX(-50%) translateY(72px); opacity: 0; }
        }
        @keyframes connectorLineDash {
          0%   { stroke-dashoffset: 16; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes labelFadeIn {
          0%,40% { opacity: 0.3; }
          60%,100% { opacity: 1; }
        }
        .connector-dot { animation: connectorPulse 2s ease-in-out infinite; }
        .connector-label { animation: labelFadeIn 2s ease-in-out infinite; }
      `}</style>

      {/* Vertical animated line */}
      <div style={{ position: 'relative', width: 2, height: 80 }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(232,93,0,0.55), rgba(232,93,0,0.12))',
          boxShadow: '0 0 8px rgba(232,93,0,0.25)',
          borderRadius: 1,
        }} />
        <div
          className="connector-dot"
          style={{
            position: 'absolute', left: '50%',
            width: 8, height: 8, borderRadius: '50%',
            background: '#FF8C28',
            boxShadow: '0 0 14px rgba(232,93,0,0.9), 0 0 28px rgba(232,93,0,0.4)',
            top: 0,
          }}
        />
      </div>

      {/* Animated node with label */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        padding: '18px 36px',
        borderRadius: 16,
        background: 'rgba(232,93,0,0.06)',
        border: '1px solid rgba(232,93,0,0.25)',
        boxShadow: '0 0 40px rgba(232,93,0,0.08)',
        marginTop: 0,
      }}>
        {/* Pulsing ring */}
        <div style={{ position: 'relative', width: 14, height: 14 }}>
          <div style={{
            position: 'absolute', inset: -4, borderRadius: '50%',
            border: '1px solid rgba(232,93,0,0.3)',
            animation: 'corePulse 3s ease-in-out infinite',
          }} />
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: '#E85D00',
            boxShadow: '0 0 12px rgba(232,93,0,0.8)',
          }} />
        </div>
        <span
          className="connector-label"
          style={{ fontFamily: fontFamily.mono, color: '#FF9C45', fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase' }}
        >
          Intelligence Output
        </span>
        <svg width="180" height="10" viewBox="0 0 180 10" fill="none" style={{ marginTop: -4 }}>
          <line x1="0" y1="5" x2="172" y2="5" stroke="rgba(232,93,0,0.3)" strokeWidth="1.2" strokeDasharray="4 3">
            <animate attributeName="stroke-dashoffset" from="14" to="0" dur="1.5s" repeatCount="indefinite" />
          </line>
          <polygon points="170,2 180,5 170,8" fill="rgba(232,93,0,0.45)" />
        </svg>
      </div>

      {/* Second vertical connector into What You Get */}
      <div style={{ position: 'relative', width: 2, height: 80 }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(232,93,0,0.45), rgba(232,93,0,0.08))',
          boxShadow: '0 0 8px rgba(232,93,0,0.2)',
          borderRadius: 1,
        }} />
        <div
          className="connector-dot"
          style={{
            position: 'absolute', left: '50%',
            width: 8, height: 8, borderRadius: '50%',
            background: '#FF8C28',
            boxShadow: '0 0 14px rgba(232,93,0,0.9), 0 0 28px rgba(232,93,0,0.4)',
            top: 0, animationDelay: '0.5s',
          }}
        />
      </div>
    </div>

    {/* ══════════════════════════════════════════════════════════
        WHAT YOU GET — pain-point framing
    ══════════════════════════════════════════════════════════ */}
    <section className="pb-16 sm:pb-24" style={{ background: '#0B1120' }} data-testid="what-you-get">
      <div className="max-w-5xl mx-auto px-6">

        {/* Section header */}
        <div className="text-center mb-4">
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-semibold mb-4"
            style={{ fontFamily: fontFamily.display, color: '#EDF1F7' }}
          >
            What You Get
          </h2>
          <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed"
            style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>
            Full visibility over where you&rsquo;re <strong style={{ color: '#EDF1F7' }}>losing money</strong>;
            {' '}where risk is building, and where <strong style={{ color: '#EDF1F7' }}>growth</strong> is being{' '}
            <strong style={{ color: '#EDF1F7' }}>missed</strong>&mdash;<strong style={{ color: '#EDF1F7' }}>in real time.</strong>
          </p>
        </div>

        {/* 4 pain-point cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-10">
          {WHAT_YOU_GET_CARDS.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-0.5"
              style={{
                background: 'rgba(255,255,255,0.025)',
                border: `1px solid ${card.border}`,
                boxShadow: `0 4px 32px ${card.iconColor}0a`,
              }}
            >
              {/* Card header */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: card.iconBg }}>
                  <card.icon className="w-5 h-5" style={{ color: card.iconColor }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-snug mb-0.5" style={{ color: '#EDF1F7', fontFamily: fontFamily.display }}>
                    {card.title}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(159,176,195,0.7)', fontFamily: fontFamily.body }}>
                    {card.subtitle}
                  </p>
                </div>
              </div>

              {/* Bullet points */}
              <ul className="flex flex-col gap-2 pl-1">
                {card.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: card.iconColor }} />
                    <span className="text-xs leading-relaxed" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>{b}</span>
                  </li>
                ))}
              </ul>

              {/* Card CTA */}
              <div className="flex items-center gap-2 pt-2 mt-auto" style={{ borderTop: `1px solid ${card.border}` }}>
                <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: card.ctaColor }} />
                <span className="text-xs font-semibold leading-snug" style={{ color: card.ctaColor, fontFamily: fontFamily.body }}>
                  {card.cta}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom banner — BIQc brings it together */}
        <div
          className="mt-6 rounded-2xl p-8 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(198,95,46,0.07) 0%, rgba(15,23,32,0.6) 50%, rgba(16,185,129,0.05) 100%)',
            border: '1px solid rgba(232,93,0,0.2)',
            boxShadow: '0 0 60px rgba(232,93,0,0.06)',
          }}
        >
          <h3 className="text-lg sm:text-xl font-bold mb-3" style={{ fontFamily: fontFamily.display, color: '#EDF1F7' }}>
            Then&mdash;<span style={{ color: '#E85D00' }}>BIQc Brings It Together</span>
          </h3>
          <p className="text-sm mb-3" style={{ color: 'rgba(159,176,195,0.7)', fontFamily: fontFamily.body }}>
            Daily Executive Brief &nbsp;·&nbsp; Strategic Action Plans &nbsp;·&nbsp; Market &amp; Competitor Intelligence
          </p>
          <p className="text-base font-semibold" style={{ color: '#EDF1F7', fontFamily: fontFamily.display }}>
            The full picture &nbsp;·&nbsp; The right moves &nbsp;·&nbsp; The confidence to act
          </p>
        </div>

      </div>
    </section>

    <ModernIntegrationBanner />

    {/* AI era evidence cards */}
    <section className="py-14 sm:py-16" style={{ background: '#0B1120' }} data-testid="ai-era-section">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 text-center"
          style={{ fontFamily: fontFamily.display, color: '#EDF1F7' }}>
          What Businesses Are Achieving In The AI Era
        </h2>
        <p className="text-base sm:text-lg mb-10 max-w-2xl mx-auto leading-relaxed text-center"
          style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>
          Business leaders make hundreds of decisions every day, and research shows up to{' '}
          <span style={{ color: '#C65F2E', fontWeight: 600 }}>40%</span> of those decisions are made without the right data.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {STATS.map((item, i) => (
            <StatCard key={i} {...item} />
          ))}
        </div>
      </div>
    </section>

    {/* TRUST & COMPLIANCE BADGES */}
    <section className="py-10" style={{ background: '#0B1120', borderTop: '1px solid rgba(232,93,0,0.1)', borderBottom: '1px solid rgba(232,93,0,0.1)' }} data-testid="trust-badges">
      <div className="max-w-5xl mx-auto px-6">
        <p className="text-center text-xs font-semibold tracking-widest uppercase mb-6" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>
          Security &amp; Compliance
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: '🇦🇺', label: 'Australian Hosted', sub: 'Sydney & Melbourne data centres' },
            { icon: '🔒', label: 'AES-256 Encrypted', sub: 'Defence-grade at rest & in transit' },
            { icon: '🛡️', label: 'Privacy Act Compliant', sub: 'Australian Privacy Principles' },
            { icon: '✅', label: '14-Day Guarantee', sub: 'No questions asked refund' },
          ].map(b => (
            <div key={b.label} className="flex items-start gap-3 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(232,93,0,0.12)' }}>
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
    <section className="py-14 sm:py-20" style={{ background: '#0B1120' }} data-testid="cognition-section">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-10 sm:mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-[2px]" style={{ background: '#E85D00' }} />
            <span className="text-xs font-medium tracking-widest uppercase" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>What Cognition-as-a-Service Delivers</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-medium mb-3" style={{ fontFamily: fontFamily.display, color: '#E6EEF7' }}>
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
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: 'rgba(232,93,0,0.08)' }}>
                <item.icon className="w-5 h-5" style={{ color: '#E85D00' }} />
              </div>
              <h3 className="text-base font-semibold mb-2" style={{ fontFamily: fontFamily.display, color: '#E6EEF7' }}>{item.title}</h3>
              <p className="text-sm leading-relaxed" style={{ fontFamily: fontFamily.body, color: '#9FB0C3' }}>{item.desc}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>

    {/* SOCIAL PROOF */}
    <section className="py-14 sm:py-20" style={{ background: '#080C14' }} data-testid="testimonials-section">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-8 h-[2px]" style={{ background: '#E85D00' }} />
            <span className="text-xs font-medium tracking-widest uppercase" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>What Australian SMBs Say</span>
            <div className="w-8 h-[2px]" style={{ background: '#E85D00' }} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-medium" style={{ fontFamily: fontFamily.display, color: '#E6EEF7' }}>
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
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>
              <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid rgba(232,93,0,0.15)' }}>
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#E6EEF7', fontFamily: fontFamily.display }}>{t.author}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#6B7B8D', fontFamily: fontFamily.body }}>{t.company}</p>
                </div>
                <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold" style={{ background: 'rgba(232,93,0,0.12)', color: '#E85D00', fontFamily: fontFamily.mono }}>
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
        <h2 className="text-2xl sm:text-3xl font-medium mb-4" style={{ fontFamily: fontFamily.display, color: '#E6EEF7' }}>
          Stop reacting. Start <span style={{ color: '#E85D00' }}>preventing.</span>
        </h2>
        <p className="text-base mb-8 max-w-lg mx-auto" style={{ fontFamily: fontFamily.body, color: '#9FB0C3' }}>
          Join the operators who replaced reactive firefighting with autonomous intelligence.
        </p>
        <Link to="/register-supabase" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold text-white transition-all hover:brightness-110" style={{ background: 'linear-gradient(135deg, #E85D00, #E56A08)', fontFamily: fontFamily.body, fontWeight: 600, boxShadow: '0 8px 32px rgba(232,93,0,0.25)' }} data-testid="bottom-cta">
          Try It For Free <ArrowRight className="w-4 h-4" />
        </Link>
        <p className="mt-4" style={{ fontFamily: fontFamily.mono, color: '#9FB0C3', opacity: 0.3, fontSize: '12px' }}>14-day trial &middot; No credit card &middot; Australian support</p>
      </div>
    </section>

  </WebsiteLayout>
);

export default HomePage;
