/**
 * HowItWorks — Consolidated section merging /platform + /intelligence
 *
 * VERIFIED CONTENT SOURCES:
 *   [P] = PlatformPage.js (/platform)
 *   [I] = IntelligencePage.js (/intelligence)
 *
 * All copy, data and claims are directly extracted from the source files above.
 * Nothing has been invented or generalised.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, BarChart3, Eye, RefreshCw,
  Workflow, Cpu, Zap, Settings,
  DollarSign, TrendingUp, Shield, Radar, Mail,
  ArrowRight, ChevronDown,
} from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';

// ─── Verified content — sourced directly from PlatformPage.js [P] ────────────

const PAIN_POINTS = [
  { icon: AlertTriangle, title: 'Too Many Disconnected Tools',  desc: 'Your accounting, CRM, email, project management, and payroll all operate in silos. No single source of truth.' },            // [P]
  { icon: Eye,           title: 'No Central Oversight',         desc: 'Critical information scattered across platforms. Decisions made on partial data. Blind spots everywhere.' },                  // [P]
  { icon: RefreshCw,     title: 'Reactive Decision-Making',     desc: 'You discover problems after they happen. Cash flow gaps, churn signals, compliance issues — always too late.' },               // [P]
  { icon: BarChart3,     title: 'Hidden Financial Leaks',       desc: 'Margin compression, overdue invoices, cost blowouts — buried in spreadsheets nobody reviews weekly.' },                       // [P]
];

const SIX_LAYERS = [
  { icon: Workflow,      title: 'Connects Your Systems',    desc: 'Secure OAuth integration with your accounting, CRM, communication, and HR platforms. One unified data layer.',                                     num: '01' }, // [P]
  { icon: Cpu,           title: 'Builds Unified Context',   desc: 'Cross-references data across all connected platforms to create a single, holistic view of your business.',                                          num: '02' }, // [P]
  { icon: Eye,           title: 'Monitors In Real Time',    desc: 'Always-on sentinel that watches cash flow, revenue signals, operational metrics, and market movements 24/7.',                                        num: '03' }, // [P]
  { icon: AlertTriangle, title: 'Flags Anomalies',          desc: 'Detects overdue invoices, engagement decline, SOP breaches, margin compression, and compliance gaps automatically.',                                num: '04' }, // [P]
  { icon: Zap,           title: 'Recommends Actions',       desc: 'Generates specific, actionable recommendations with drafted communications, prioritised by urgency and impact.',                                    num: '05' }, // [P]
  { icon: Settings,      title: 'Automates Correction',     desc: 'Can execute corrective workflows — sending follow-ups, creating tasks, escalating alerts — without manual intervention.',                           num: '06' }, // [P]
];

// ─── Verified content — sourced directly from IntelligencePage.js [I] ────────

const SIX_CATEGORIES = [
  {
    icon: DollarSign, color: '#E85D00', title: 'Financial Data',         // [I]
    items: ['Cash flow monitoring', 'Invoice tracking & aged receivables', 'Expense anomaly detection', 'Margin variance analysis', 'Tax liability flags', 'Runway projections'],
  },
  {
    icon: TrendingUp, color: '#3B82F6', title: 'Revenue & Sales Data',   // [I]
    items: ['Pipeline velocity tracking', 'Lead conversion analysis', 'Revenue concentration risk', 'Customer churn prediction', 'Deal stall detection', 'Pricing optimisation signals'],
  },
  {
    icon: Settings,   color: '#10B981', title: 'Operational Data',       // [I]
    items: ['Staff utilisation rates', 'Overtime anomaly detection', 'SOP compliance monitoring', 'Delivery timeline tracking', 'Bottleneck identification', 'Task aging & SLA breaches'],
  },
  {
    icon: Shield,     color: '#8B5CF6', title: 'Risk & Compliance Data', // [I]
    items: ['Missing documentation alerts', 'Regulatory exposure detection', 'Policy drift monitoring', 'Certification expiry tracking', 'Audit trail maintenance', 'Compliance gap analysis'],
  },
  {
    icon: Radar,      color: '#F59E0B', title: 'Market Signals',         // [I]
    items: ['Competitor activity monitoring', 'Industry benchmark comparisons', 'Demand shift detection', 'Pricing position analysis', 'Market sentiment tracking', 'Regulatory change alerts'],
  },
  {
    icon: Mail,       color: '#EF4444', title: 'Communication Signals',  // [I]
    items: ['Email response pattern analysis', 'Response delay monitoring', 'Escalation trigger detection', 'Client engagement decline', 'Internal communication gaps', 'Sentiment shift detection'],
    note: 'Where authorised by the user',                                 // [I] — privacy statement preserved verbatim
  },
];

const PIPELINE_STEPS = [
  { num: '01', title: 'Ingest',   desc: 'Securely connects and continuously syncs data from all your business platforms.' },                                   // [I]
  { num: '02', title: 'Analyse',  desc: 'Cross-references signals across financial, operational, revenue, and market data.' },                                 // [I]
  { num: '03', title: 'Detect',   desc: 'Identifies anomalies, risks, opportunities, and compliance gaps autonomously.' },                                     // [I]
  { num: '04', title: 'Act',      desc: 'Delivers prioritised alerts, drafted actions, and automated corrections.' },                                          // [I]
];

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'problem',    anchor: 'why-biqc',    label: 'Why BIQc' },
  { id: 'layers',     anchor: 'layers',      label: 'How It Works' },
  { id: 'categories', anchor: 'categories',  label: 'What We Monitor' },
  { id: 'pipeline',   anchor: 'pipeline',    label: 'The Pipeline' },
];

// ─── Small reusable pieces ────────────────────────────────────────────────────
const OrangeLine = () => (
  <div className="flex items-center gap-3 mb-4">
    <div className="w-8 h-[2px] flex-shrink-0" style={{ background: '#E85D00' }} />
  </div>
);

const SectionTag = ({ children }) => (
  <span className="text-[10px] font-semibold tracking-[0.18em] uppercase"
    style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>
    {children}
  </span>
);

// Expandable category card (collapses bullet list on mobile)
const CategoryCard = ({ cat }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl p-5 transition-all duration-200"
      style={{
        background: 'var(--biqc-bg-card, rgba(255,255,255,0.03))',
        border: '1px solid var(--biqc-border, rgba(255,255,255,0.06))',
      }}>
      {/* Header — always visible */}
      <button
        className="w-full flex items-center justify-between gap-3 text-left mb-0 sm:mb-4"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${cat.color}15` }}>
            <cat.icon className="w-4 h-4" style={{ color: cat.color }} />
          </div>
          <h3 className="text-sm font-semibold" style={{ fontFamily: fontFamily.display, color: 'var(--biqc-text, #EDF1F7)' }}>
            {cat.title}
          </h3>
        </div>
        {/* Toggle chevron — only on mobile */}
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 sm:hidden transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          style={{ color: '#64748B' }} />
      </button>

      {/* Bullet list — always visible on sm+, collapsible on mobile */}
      <ul className={`space-y-1.5 mt-3 ${open ? 'block' : 'hidden'} sm:block`}>
        {cat.items.map((item, j) => (
          <li key={j} className="flex items-start gap-2">
            <div className="w-1 h-1 rounded-full mt-[7px] flex-shrink-0" style={{ background: cat.color }} />
            <span className="text-xs leading-relaxed"
              style={{ color: 'var(--biqc-text-2, #9FB0C3)', fontFamily: fontFamily.body }}>
              {item}
            </span>
          </li>
        ))}
        {cat.note && (
          <li className="mt-3">
            <span className="text-[10px] italic" style={{ color: 'var(--biqc-text-muted, #64748B)', fontFamily: fontFamily.mono }}>
              {cat.note}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
export function HowItWorks() {
  const [activeTab, setActiveTab] = useState('problem');

  return (
    <section
      id="how-it-works"
      aria-label="How BIQc works"
      style={{ background: 'var(--biqc-bg, #070E18)' }}>

      {/* ── Section header ── */}
      <div className="max-w-5xl mx-auto px-6 pt-14 pb-2 text-center">
        <SectionTag>How It Works</SectionTag>
        <h2 className="text-2xl sm:text-3xl font-medium mt-2 mb-3"
          style={{ fontFamily: fontFamily.display, color: 'var(--biqc-text, #EDF1F7)' }}>
          From disconnected data to&nbsp;
          <span style={{ color: '#E85D00' }}>autonomous intelligence.</span>
        </h2>
        <p className="text-sm sm:text-base max-w-xl mx-auto"
          style={{ color: 'var(--biqc-text-2, #9FB0C3)', fontFamily: fontFamily.body }}>
          BIQc connects your systems, monitors every signal, and surfaces what matters — before it becomes a problem.
        </p>
      </div>

      {/* ── Sticky tab bar ── */}
      <div className="sticky top-14 z-40 mt-8"
        style={{ background: 'var(--biqc-bg, #070E18)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex overflow-x-auto no-scrollbar" role="tablist" aria-label="How It Works sections">
            {TABS.map(tab => (
              <a
                key={tab.id}
                href={`#${tab.anchor}`}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={e => { e.preventDefault(); setActiveTab(tab.id); document.getElementById(tab.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                className="flex-shrink-0 px-4 sm:px-6 py-3.5 text-xs font-semibold whitespace-nowrap transition-all"
                style={{
                  fontFamily: fontFamily.mono,
                  color: activeTab === tab.id ? '#E85D00' : 'var(--biqc-text-muted, #64748B)',
                  borderBottom: activeTab === tab.id ? '2px solid #E85D00' : '2px solid transparent',
                  textDecoration: 'none',
                }}
                data-testid={`how-it-works-tab-${tab.id}`}>
                {tab.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          TAB 1: WHY BIQC — Pain Points [P]
      ════════════════════════════════════════ */}
      <div id="why-biqc" className="scroll-mt-28">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <OrangeLine />
          <SectionTag>The Problem SMBs Face</SectionTag>
          <h3 className="text-xl sm:text-2xl font-medium mt-2 mb-8"
            style={{ fontFamily: fontFamily.display, color: 'var(--biqc-text, #EDF1F7)' }}>
            You're running a business with enterprise-level complexity<br className="hidden sm:block" /> on startup-level infrastructure.
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PAIN_POINTS.map((item, i) => (
              <div key={i}
                className="rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: 'var(--biqc-bg-card, rgba(255,255,255,0.03))',
                  border: '1px solid rgba(239,68,68,0.12)',
                }}>
                <item.icon className="w-5 h-5 mb-3" style={{ color: '#EF4444' }} />
                <h4 className="text-sm font-semibold mb-2"
                  style={{ fontFamily: fontFamily.display, color: 'var(--biqc-text, #EDF1F7)' }}>
                  {item.title}
                </h4>
                <p className="text-xs leading-relaxed"
                  style={{ color: 'var(--biqc-text-2, #9FB0C3)', fontFamily: fontFamily.body }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          TAB 2: SIX LAYERS — How It Works [P]
      ════════════════════════════════════════ */}
      <div id="layers" className="scroll-mt-28"
        style={{ background: 'var(--biqc-bg-elevated, #0A1018)', borderTop: '1px solid var(--biqc-border, #1E2D3D)' }}>
        <div className="max-w-5xl mx-auto px-6 py-12">
          <OrangeLine />
          <SectionTag>What BIQc Does</SectionTag>
          <h3 className="text-xl sm:text-2xl font-medium mt-2 mb-8"
            style={{ fontFamily: fontFamily.display, color: 'var(--biqc-text, #EDF1F7)' }}>
            Six layers of autonomous intelligence.
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SIX_LAYERS.map((item, i) => (
              <div key={i}
                className="rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#E85D00]/20 relative overflow-hidden"
                style={{
                  background: 'var(--biqc-bg-card, rgba(255,255,255,0.03))',
                  border: '1px solid var(--biqc-border, rgba(255,255,255,0.08))',
                }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(232,93,0,0.1)' }}>
                    <item.icon className="w-4 h-4" style={{ color: '#E85D00' }} />
                  </div>
                  <span className="text-3xl font-bold" style={{ fontFamily: fontFamily.mono, color: 'rgba(232,93,0,0.08)' }}>
                    {item.num}
                  </span>
                </div>
                <h4 className="text-sm font-semibold mb-2"
                  style={{ fontFamily: fontFamily.display, color: 'var(--biqc-text, #EDF1F7)' }}>
                  {item.title}
                </h4>
                <p className="text-xs leading-relaxed"
                  style={{ color: 'var(--biqc-text-2, #9FB0C3)', fontFamily: fontFamily.body }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          TAB 3: SIX CATEGORIES — What We Monitor [I]
      ════════════════════════════════════════ */}
      <div id="categories" className="scroll-mt-28"
        style={{ borderTop: '1px solid var(--biqc-border, #1E2D3D)' }}>
        <div className="max-w-5xl mx-auto px-6 py-12">
          <OrangeLine />
          <SectionTag>What BIQc Analyses</SectionTag>
          <h3 className="text-xl sm:text-2xl font-medium mt-2 mb-2"
            style={{ fontFamily: fontFamily.display, color: 'var(--biqc-text, #EDF1F7)' }}>
            Six categories of business intelligence.
          </h3>
          <p className="text-sm mb-8"
            style={{ color: 'var(--biqc-text-2, #9FB0C3)', fontFamily: fontFamily.body }}>
            Every data point mapped, monitored, and cross-referenced autonomously.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SIX_CATEGORIES.map((cat, i) => (
              <CategoryCard key={i} cat={cat} />
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          TAB 4: PIPELINE — Ingest→Analyse→Detect→Act [I]
      ════════════════════════════════════════ */}
      <div id="pipeline" className="scroll-mt-28"
        style={{ background: 'var(--biqc-bg-elevated, #0A1018)', borderTop: '1px solid var(--biqc-border, #1E2D3D)' }}>
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="text-center mb-10">
            <SectionTag>Intelligence Pipeline</SectionTag>
            <h3 className="text-xl sm:text-2xl font-medium mt-2"
              style={{ fontFamily: fontFamily.display, color: 'var(--biqc-text, #EDF1F7)' }}>
              From Raw Data to Executive Briefing
            </h3>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={i} className="relative">
                {/* Connector line between steps (desktop) */}
                {i < 3 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full z-10"
                    style={{ width: 'calc(100% - 1rem)', marginLeft: '0.5rem' }}>
                    <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, rgba(232,93,0,0.4), rgba(232,93,0,0.1))' }} />
                  </div>
                )}
                <div className="rounded-2xl p-5 text-center h-full transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    background: 'var(--biqc-bg-card, rgba(255,255,255,0.03))',
                    border: '1px solid var(--biqc-border, rgba(255,255,255,0.08))',
                  }}>
                  <div className="text-4xl font-bold mb-3"
                    style={{ fontFamily: fontFamily.mono, color: 'rgba(232,93,0,0.15)' }}>
                    {step.num}
                  </div>
                  <h4 className="text-base font-semibold mb-2"
                    style={{ fontFamily: fontFamily.display, color: 'var(--biqc-text, #EDF1F7)' }}>
                    {step.title}
                  </h4>
                  <p className="text-xs leading-relaxed"
                    style={{ color: 'var(--biqc-text-2, #9FB0C3)', fontFamily: fontFamily.body }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ── CTA ── */}
          <div className="text-center pt-6" style={{ borderTop: '1px solid var(--biqc-border, #1E2D3D)' }}>
            <p className="text-sm mb-5" style={{ color: 'var(--biqc-text-2, #9FB0C3)', fontFamily: fontFamily.body }}>
              Connect your first platform in under 2 minutes. No credit card required.
            </p>
            <Link
              to="/register-supabase"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
              style={{
                background: 'linear-gradient(135deg, #E85D00, #E56A08)',
                fontFamily: fontFamily.body,
                boxShadow: '0 8px 32px rgba(232,93,0,0.28)',
              }}
              data-testid="how-it-works-cta">
              Start free trial <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-[11px] mt-3" style={{ fontFamily: fontFamily.mono, color: '#4A5568' }}>
              14-day trial · Australian hosted · Cancel anytime
            </p>
          </div>
        </div>
      </div>

    </section>
  );
}

export default HowItWorks;
