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
import { ArrowRight, Check } from 'lucide-react';

/* ── How the AI Works ── */
const AI_STEPS = [
  {
    num: '01',
    title: 'Connect',
    desc: 'Your data sources feed into BIQc continuously. No manual uploads, no CSV wrangling.',
    badges: ['Xero', 'HubSpot', 'Outlook', 'Gmail'],
  },
  {
    num: '02',
    title: 'Analyse',
    desc: 'Three AI models process every signal in parallel, cross-checking each other for accuracy.',
    badges: ['GPT-5.2', 'Claude Opus', 'Gemini 2.5 Pro'],
  },
  {
    num: '03',
    title: 'Act',
    desc: 'Synthesised insights delivered as actionable intelligence \u2014 briefings, alerts, and recommended actions.',
    badges: ['Briefings', 'Alerts', 'Actions'],
  },
];

/* ── Watchtower ── */
const WATCHTOWER_CARDS = [
  {
    title: 'Real-time Anomaly Detection',
    desc: 'Watchtower learns your business baseline over 14 days, then alerts you the moment something deviates \u2014 revenue drops, pipeline stalls, unusual spending patterns, or customer behaviour shifts.',
  },
  {
    title: 'Cross-System Correlation',
    desc: "Signals from your CRM, accounting, email, and calendar are correlated automatically. A stalled deal plus a missed follow-up plus a competitor mention becomes one clear warning, not three disconnected data points.",
  },
  {
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
  { num: '01', title: 'Connect', desc: 'Securely link your business tools. Xero, HubSpot, Outlook, Gmail, and more flow in automatically.' },
  { num: '02', title: 'Analyse', desc: 'Multi-model AI processes every data point, cross-referencing across systems for context and accuracy.' },
  { num: '03', title: 'Detect', desc: 'Anomalies, risks, and opportunities are surfaced automatically. No manual searching required.' },
  { num: '04', title: 'Act', desc: 'Receive prioritised recommendations with clear next steps. Every insight is tied to a specific action.' },
];

const cardBg = 'linear-gradient(105deg, rgba(200,220,240,0) 0%, rgba(200,220,240,0.06) 45%, rgba(200,220,240,0) 55%), linear-gradient(180deg, rgba(140,170,210,0.04) 0%, rgba(140,170,210,0.01) 100%)';
const cardBorder = '1px solid rgba(140,170,210,0.15)';

export default function IntelligencePage() {
  return (
    <WebsiteLayout>
      {/* Hero */}
      <section className="py-20 md:py-24 text-center px-6"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(46,74,110,0.08) 0%, transparent 60%), linear-gradient(180deg, #080C14 0%, #0B1120 100%)' }}>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-[48px] font-bold leading-[1.15] tracking-tight mb-4"
            style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: "'Source Serif 4', 'Cormorant Garamond', Georgia, serif" }}>
            A brain that thinks like an operator, not a dashboard.
          </h1>
          <p className="text-lg max-w-[560px] mx-auto leading-relaxed mb-8"
            style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
            BIQc uses multi-model AI &mdash; GPT, Claude, and Gemini &mdash; to understand your business context, detect what matters, and tell you what to do next.
          </p>
          <Link to="/platform"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg text-base font-semibold text-white transition-all hover:brightness-110"
            style={{ background: 'var(--lava, #E85D00)', boxShadow: '0 4px 16px rgba(232,93,0,0.3)' }}>
            See It In Action <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* How the AI Works */}
      <section className="py-20 px-6" style={{ background: 'var(--bg-primary, #080C14)' }}>
        <div className="max-w-[1120px] mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-[28px] font-bold tracking-tight mb-3"
              style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: "'Source Serif 4', 'Cormorant Garamond', Georgia, serif" }}>
              How the AI works
            </h2>
            <p className="text-[15px]" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
              Three steps from raw data to actionable intelligence.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {AI_STEPS.map((step) => (
              <div key={step.num} className="rounded-xl p-8" style={{ background: cardBg, border: cardBorder }}>
                <div className="text-[40px] font-bold mb-4"
                  style={{ color: 'rgba(232,93,0,0.15)', fontFamily: "'Source Serif 4', Georgia, serif" }}>
                  {step.num}
                </div>
                <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--ink-display, #EDF1F7)' }}>
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                  {step.desc}
                </p>
                <div className="flex flex-wrap gap-2">
                  {step.badges.map((b) => (
                    <span key={b} className="px-2.5 py-1 rounded text-[11px] font-medium"
                      style={{ background: 'rgba(232,93,0,0.08)', color: 'var(--lava, #E85D00)' }}>
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Watchtower */}
      <section className="py-20 px-6" style={{ background: 'var(--bg-secondary, #0B1120)' }}>
        <div className="max-w-[1120px] mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-[28px] font-bold tracking-tight mb-3"
              style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: "'Source Serif 4', 'Cormorant Garamond', Georgia, serif" }}>
              24/7 Autonomous Monitoring
            </h2>
            <p className="text-[15px] max-w-[600px] mx-auto" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
              Watchtower monitors all your connected systems around the clock. It detects anomalies, flags emerging risks, and surfaces opportunities &mdash; before you even know to look.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {WATCHTOWER_CARDS.map((card) => (
              <div key={card.title} className="rounded-xl p-7" style={{ background: cardBg, border: cardBorder }}>
                <h3 className="text-base font-semibold mb-3" style={{ color: 'var(--ink-display, #EDF1F7)' }}>
                  {card.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Board Room vs War Room */}
      <section className="py-20 px-6" style={{ background: 'var(--bg-primary, #080C14)' }}>
        <div className="max-w-[1120px] mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-[28px] font-bold tracking-tight mb-3"
              style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: "'Source Serif 4', 'Cormorant Garamond', Georgia, serif" }}>
              Board Room vs War Room
            </h2>
            <p className="text-[15px]" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
              Two intelligence modes for different moments. One for strategy, one for crisis.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {COMPARISON.map((mode) => (
              <div key={mode.name} className="rounded-xl p-8"
                style={{
                  background: cardBg,
                  border: mode.highlighted ? '2px solid var(--lava, #E85D00)' : cardBorder,
                  boxShadow: mode.highlighted ? '0 4px 16px rgba(232,93,0,0.08)' : 'none',
                }}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
                    style={{
                      background: mode.highlighted ? 'rgba(232,93,0,0.08)' : 'rgba(140,170,210,0.1)',
                      color: mode.highlighted ? 'var(--lava, #E85D00)' : 'var(--ink-secondary, #8FA0B8)',
                    }}>
                    {mode.tier}
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-1" style={{ color: 'var(--ink-display, #EDF1F7)' }}>
                  {mode.name}
                </h3>
                <div className="text-[28px] font-bold mb-3" style={{ color: 'var(--ink-display, #EDF1F7)' }}>
                  {mode.price}<span className="text-sm font-medium ml-1" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>/month</span>
                </div>
                <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                  {mode.tagline}
                </p>
                <ul className="space-y-3">
                  {mode.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--ink-body, #C8D4E4)' }}>
                      <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#16A34A' }} />
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
      <section className="py-20 px-6" style={{ background: 'var(--bg-secondary, #0B1120)' }}>
        <div className="max-w-[1120px] mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-[28px] font-bold tracking-tight mb-3"
              style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: "'Source Serif 4', 'Cormorant Garamond', Georgia, serif" }}>
              The Intelligence Pipeline
            </h2>
            <p className="text-[15px]" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
              From raw data to decisive action in four steps.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {PIPELINE.map((step, i) => (
              <div key={step.num} className="text-center relative">
                <div className="text-[48px] font-bold mb-4"
                  style={{ color: 'rgba(232,93,0,0.15)', fontFamily: "'Source Serif 4', Georgia, serif" }}>
                  {step.num}
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--ink-display, #EDF1F7)' }}>
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                  {step.desc}
                </p>
                {i < 3 && (
                  <div className="hidden md:block absolute top-6 -right-3 text-lg" style={{ color: 'rgba(140,170,210,0.2)' }}>&rarr;</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center"
        style={{ background: 'var(--bg-primary, #080C14)', borderTop: '1px solid var(--border-card, rgba(140,170,210,0.12))' }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
            style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: "'Source Serif 4', 'Cormorant Garamond', Georgia, serif" }}>
            Ready to think faster?
          </h2>
          <p className="text-base mb-8" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
            Start free and get your first intelligence briefing in under 10 minutes.
          </p>
          <Link to="/register-supabase"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg text-base font-semibold text-white transition-all hover:brightness-110"
            style={{ background: 'var(--lava, #E85D00)', boxShadow: '0 4px 16px rgba(232,93,0,0.3)' }}>
            Start Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </WebsiteLayout>
  );
}
