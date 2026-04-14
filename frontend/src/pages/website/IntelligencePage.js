/**
 * IntelligencePage — "Intelligence" marketing page.
 *
 * Sections: Hero, How the AI Works (3 steps), Watchtower (3 cards),
 * Board Room vs War Room comparison, Intelligence Pipeline (4 steps), CTA.
 * Uses WebsiteLayout wrapper. No auth required.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import WebsiteLayout from '../../components/website/WebsiteLayout';
import { ArrowRight } from 'lucide-react';

/* ── How the AI Works ── */
const AI_STEPS = [
  {
    num: 1,
    title: 'Connect',
    desc: 'Your data sources feed into BIQc continuously. No manual uploads, no CSV wrangling.',
    badges: ['Xero', 'HubSpot', 'Outlook', 'Gmail'],
  },
  {
    num: 2,
    title: 'Analyse',
    desc: 'Three AI models process every signal in parallel, cross-checking each other for accuracy.',
    badges: ['GPT-5.2', 'Claude Opus', 'Gemini 2.5 Pro'],
  },
  {
    num: 3,
    title: 'Act',
    desc: 'Synthesised insights delivered as actionable intelligence \u2014 briefings, alerts, and recommended actions.',
    badges: ['Briefings', 'Alerts', 'Actions'],
  },
];

/* ── Watchtower ── */
const WATCHTOWER_CARDS = [
  {
    icon: '\uD83D\uDD0E',
    title: 'Real-time Anomaly Detection',
    desc: 'Watchtower learns your business baseline over 14 days, then alerts you the moment something deviates \u2014 revenue drops, pipeline stalls, unusual spending patterns, or customer behaviour shifts.',
  },
  {
    icon: '\uD83D\uDD17',
    title: 'Cross-System Correlation',
    desc: "Signals from your CRM, accounting, email, and calendar are correlated automatically. A stalled deal plus a missed follow-up plus a competitor mention becomes one clear warning, not three disconnected data points.",
  },
  {
    icon: '\uD83D\uDEA8',
    title: 'Automatic Escalation',
    desc: 'Critical signals are escalated instantly via email and in-app notifications. Watchtower triages every alert by severity so you focus on what actually needs attention right now.',
  },
];

/* ── Board Room vs War Room ── */
const COMPARISON = [
  {
    name: 'Board Room',
    tier: 'Growth',
    price: '$69',
    tagline: 'Strategic oversight powered by single-model AI. Perfect for staying informed and making confident decisions.',
    features: [
      'Single-model AI analysis',
      'Strategic business overview',
      'Daily intelligence briefings',
      'Weekly trend summaries',
      'Decision memo generator',
      'Board pack auto-export',
    ],
    highlighted: false,
  },
  {
    name: 'War Room',
    tier: 'Pro',
    price: '$199',
    tagline: 'Deep analysis powered by the Trinity \u2014 three AI models working in parallel for maximum accuracy and speed.',
    features: [
      'Multi-model AI (GPT + Claude + Gemini)',
      'Deep cross-system analysis',
      'Real-time conversational chat',
      'Streaming crisis diagnosis',
      'Stakeholder comms drafts',
      'Action tracker with audit trail',
    ],
    highlighted: true,
  },
];

/* ── Pipeline ── */
const PIPELINE = [
  { num: 1, icon: '\uD83D\uDD0C', title: 'Connect', desc: 'Securely link your business tools. Xero, HubSpot, Outlook, Gmail, and more flow in automatically.' },
  { num: 2, icon: '\uD83D\uDD2C', title: 'Analyse', desc: 'Multi-model AI processes every data point, cross-referencing across systems for context and accuracy.' },
  { num: 3, icon: '\uD83D\uDCA1', title: 'Detect', desc: 'Anomalies, risks, and opportunities are surfaced automatically. No manual searching required.' },
  { num: 4, icon: '\uD83C\uDFAF', title: 'Act', desc: 'Receive prioritised recommendations with clear next steps. Every insight is tied to a specific action.' },
];

const cardBg = 'var(--surface)';
const cardBorder = '1px solid var(--border)';

export default function IntelligencePage() {
  return (
    <WebsiteLayout>
      {/* Hero */}
      <section className="py-20 md:py-24 text-center px-6"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(46,74,110,0.08) 0%, transparent 60%), linear-gradient(180deg, #080C14 0%, #0B1120 100%)' }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-[48px] font-bold leading-[1.15] tracking-tight mb-4"
            style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>
            A brain that thinks like an operator, not a dashboard.
          </h1>
          <p className="text-lg max-w-[560px] mx-auto leading-relaxed mb-8"
            style={{ color: 'var(--ink-secondary)' }}>
            BIQc uses multi-model AI &mdash; GPT, Claude, and Gemini &mdash; to understand your business context, detect what matters, and tell you what to do next.
          </p>
          <Link to="/platform"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-white transition-all hover:brightness-110"
            style={{ background: 'var(--lava)', borderRadius: 'var(--r-md)', boxShadow: '0 4px 16px rgba(232,93,0,0.3)' }}>
            See It In Action <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* How the AI Works */}
      <section className="py-20 px-6" style={{ background: 'var(--canvas)' }}>
        <div className="max-w-[1120px] mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-[28px] font-bold tracking-tight mb-3"
              style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>
              How the AI works
            </h2>
            <p className="text-[15px]" style={{ color: 'var(--ink-secondary)' }}>
              Three steps from raw data to actionable intelligence.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {AI_STEPS.map((step, i) => (
              <div key={step.num} className="rounded-xl p-8 text-center relative"
                style={{ background: cardBg, border: cardBorder, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                <div className="inline-flex items-center justify-center mb-5"
                  style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: 'rgba(232,93,0,0.12)', color: '#E85D00',
                    fontSize: 16, fontWeight: 700,
                  }}>
                  {step.num}
                </div>
                <h3 className="text-lg font-semibold mb-2.5" style={{ color: 'var(--ink-display)' }}>
                  {step.title}
                </h3>
                <p className="text-[15px] leading-relaxed mb-5" style={{ color: 'var(--ink-secondary)' }}>
                  {step.desc}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {step.badges.map((b) => (
                    <span key={b} className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{ background: '#0B1120', border: '1px solid rgba(140,170,210,0.12)', color: 'var(--ink-secondary)' }}>
                      {b}
                    </span>
                  ))}
                </div>
                {/* Step connector arrow */}
                {i < 2 && (
                  <div className="hidden md:flex items-center justify-center absolute z-10"
                    style={{
                      top: '50%', right: -14, transform: 'translateY(-50%)',
                      width: 28, height: 28, borderRadius: '50%',
                      background: '#0B1120', border: '1px solid rgba(140,170,210,0.12)',
                      color: '#5C6E82', fontSize: 14, fontWeight: 600,
                    }}>
                    &rarr;
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Watchtower */}
      <section className="py-20 px-6" style={{ background: 'var(--canvas-app)' }}>
        <div className="max-w-[1120px] mx-auto">
          {/* 2-column header: title left, description right */}
          <div className="grid md:grid-cols-2 gap-10 items-center mb-8">
            <div>
              <h2 className="text-[32px] font-semibold tracking-tight"
                style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)', letterSpacing: 'var(--ls-display)' }}>
                24/7 Autonomous Monitoring
              </h2>
            </div>
            <div>
              <p className="text-base leading-relaxed" style={{ color: 'var(--ink-secondary)', lineHeight: 1.7 }}>
                Watchtower monitors all your connected systems around the clock. It detects anomalies, flags emerging risks, and surfaces opportunities &mdash; before you even know to look.
              </p>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {WATCHTOWER_CARDS.map((card) => (
              <div key={card.title} className="rounded-xl p-7"
                style={{ background: cardBg, border: cardBorder, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                {/* Icon container */}
                <div className="flex items-center justify-center mb-4"
                  style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: 'rgba(232,93,0,0.12)', fontSize: 20,
                  }}>
                  {card.icon}
                </div>
                <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--ink-display)' }}>
                  {card.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)', lineHeight: 1.7 }}>
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Board Room vs War Room */}
      <section className="py-20 px-6" style={{ background: 'var(--canvas)' }}>
        <div className="max-w-[1120px] mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-[28px] font-bold tracking-tight mb-3"
              style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>
              Board Room vs War Room
            </h2>
            <p className="text-[15px]" style={{ color: 'var(--ink-secondary)' }}>
              Two intelligence modes for different moments. One for strategy, one for crisis.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {COMPARISON.map((mode) => (
              <div key={mode.name} className="rounded-xl p-8"
                style={{
                  background: cardBg,
                  border: mode.highlighted ? '2px solid var(--lava)' : cardBorder,
                  boxShadow: mode.highlighted ? '0 4px 16px rgba(232,93,0,0.08)' : 'none',
                }}>
                <div className="mb-5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide px-3.5 py-1 rounded-full"
                    style={{
                      background: mode.highlighted ? 'rgba(232,93,0,0.12)' : 'rgba(2,132,199,0.12)',
                      color: mode.highlighted ? '#E85D00' : '#0284C7',
                      letterSpacing: '0.5px',
                    }}>
                    {mode.highlighted ? '\u26A1' : '\uD83C\uDFE2'} {mode.tier}
                  </span>
                </div>
                <h3 className="text-2xl font-semibold mb-1.5"
                  style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>
                  {mode.name}
                </h3>
                <div className="text-[28px] font-bold mb-1" style={{ color: 'var(--ink-display)' }}>
                  {mode.price}<span className="text-[15px] font-normal ml-1" style={{ color: '#5C6E82' }}>/month</span>
                </div>
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--ink-secondary)', lineHeight: 1.6 }}>
                  {mode.tagline}
                </p>
                <ul className="space-y-0">
                  {mode.features.map((f) => (
                    <li key={f} className="relative text-sm pl-6 py-2"
                      style={{
                        color: 'var(--ink)',
                        borderBottom: '1px solid rgba(140,170,210,0.06)',
                        lineHeight: 1.6,
                      }}>
                      <span className="absolute left-0 top-1/2 -translate-y-1/2"
                        style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: '#E85D00', display: 'block',
                        }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Intelligence Pipeline */}
      <section className="py-20 px-6" style={{ background: 'var(--canvas)' }}>
        <div className="max-w-[1120px] mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-[32px] font-semibold tracking-tight mb-3"
              style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)', letterSpacing: 'var(--ls-display)' }}>
              The Intelligence Pipeline
            </h2>
            <p className="text-base" style={{ color: 'var(--ink-secondary)' }}>
              From raw data to decisive action in four steps.
            </p>
          </div>
          {/* pipeline-wrap container */}
          <div className="rounded-2xl p-10 md:p-12" style={{ background: '#0B1120' }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {PIPELINE.map((step, i) => (
                <div key={step.num} className="rounded-xl p-6 text-center relative"
                  style={{ background: cardBg, border: cardBorder, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                  {/* Icon container */}
                  <div className="flex items-center justify-center mx-auto mb-4"
                    style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'rgba(232,93,0,0.12)', fontSize: 22,
                    }}>
                    {step.icon}
                  </div>
                  {/* Step label */}
                  <div className="text-[11px] font-semibold uppercase tracking-wide mb-2"
                    style={{ color: '#5C6E82', letterSpacing: '0.5px' }}>
                    Step {step.num}
                  </div>
                  <h4 className="text-base font-semibold mb-2" style={{ color: 'var(--ink-display)' }}>
                    {step.title}
                  </h4>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-secondary)', lineHeight: 1.6 }}>
                    {step.desc}
                  </p>
                  {/* Pipeline connector arrow */}
                  {i < 3 && (
                    <div className="hidden md:flex items-center justify-center absolute z-10"
                      style={{
                        top: '50%', right: -12, transform: 'translateY(-50%)',
                        width: 24, height: 24, borderRadius: '50%',
                        background: '#0B1120', color: '#5C6E82', fontSize: 13,
                      }}>
                      &rarr;
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24 px-6 text-center" style={{ background: 'var(--canvas)' }}>
        <div className="max-w-[1120px] mx-auto">
          <div className="rounded-2xl py-14 px-10"
            style={{
              background: cardBg,
              border: cardBorder,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}>
            <h2 className="text-[28px] font-semibold tracking-tight mb-3"
              style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>
              Ready to think faster?
            </h2>
            <p className="text-base mb-7" style={{ color: 'var(--ink-secondary)' }}>
              Start free and get your first intelligence briefing in under 10 minutes.
            </p>
            <Link to="/register-supabase"
              className="inline-flex items-center gap-2 px-7 py-3 text-[15px] font-semibold text-white transition-all hover:brightness-110"
              style={{ background: 'var(--lava)', borderRadius: 'var(--r-md)', boxShadow: '0 4px 16px rgba(232,93,0,0.3)' }}>
              Start Free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </WebsiteLayout>
  );
}
