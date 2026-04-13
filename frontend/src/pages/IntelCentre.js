import { useState, useMemo } from 'react';
import {
  FileText, Plus, Globe, ArrowRight, Clock
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { fontFamily, colors, radius } from '../design-system/tokens';

/* ───────────────────────── CATEGORY CONFIG ───────────────────────── */
const CATEGORY_COLORS = {
  Competitor:  { bg: '#FEE2E2', text: '#991B1B', accent: '#DC2626' },
  Market:      { bg: 'rgba(59,130,246,0.10)', text: '#2563EB', accent: '#2563EB' },
  Regulatory:  { bg: '#F3E8FF', text: '#7C3AED', accent: '#7C3AED' },
  Industry:    { bg: 'rgba(34,197,94,0.10)', text: '#16A34A', accent: '#0891B2' },
  Technology:  { bg: 'rgba(245,158,11,0.10)', text: '#D97706', accent: '#16A34A' },
};

const RELEVANCE_STYLES = {
  High:   { bg: '#FEE2E2', text: '#991B1B' },
  Medium: { bg: '#FEF3C7', text: '#92400E' },
  Low:    { bg: 'rgba(140,170,210,0.08)', text: '#708499' },
};

const TABS = ['All', 'Competitor', 'Market', 'Regulatory', 'Industry', 'Technology'];

/* ───────────────────────── STATIC INTEL ITEMS ───────────────────────── */
const INTEL_ITEMS = [
  {
    id: 1,
    category: 'Competitor',
    relevance: 'High',
    title: 'Trillion Software drops Enterprise tier pricing 15% across AU market',
    summary: 'New pricing page published overnight. Enterprise now starts at $169/seat (was $199). Feature parity overlap with BIQc Growth tier on pipeline analytics and reporting modules.',
    source: 'Web monitoring',
    time: '2h ago',
  },
  {
    id: 2,
    category: 'Regulatory',
    relevance: 'High',
    title: 'OAIC publishes draft guidance for 2026 Privacy Act amendments',
    summary: 'New guidance covers enhanced consent requirements for automated profiling, mandatory data breach response windows (72h to 48h), and cross-border data flow restrictions for AU entities.',
    source: 'Gov feed',
    time: '6h ago',
  },
  {
    id: 3,
    category: 'Market',
    relevance: 'Medium',
    title: 'AU SMB SaaS spending projected to grow 18% in FY2027',
    summary: 'Gartner forecast shows Australian small-medium businesses increasing SaaS budget allocations, driven by AI-assisted operations tooling. Business intelligence and workflow automation lead growth categories.',
    source: 'Market research',
    time: 'Yesterday',
  },
  {
    id: 4,
    category: 'Competitor',
    relevance: 'High',
    title: 'DataPulse AU raises $8.2M Series A — entering pipeline analytics',
    summary: 'Melbourne-based DataPulse announced funding to build CRM analytics layer targeting AU SMBs using HubSpot and Pipedrive. Direct overlap with BIQc core market.',
    source: 'News monitoring',
    time: 'Yesterday',
  },
  {
    id: 5,
    category: 'Industry',
    relevance: 'Medium',
    title: 'HubSpot launches native AI deal scoring for Sales Hub Enterprise',
    summary: 'New feature uses conversation intelligence to score deals. Potential to reduce reliance on third-party analytics for HubSpot Enterprise users. BIQc users on HubSpot Starter/Pro unaffected.',
    source: 'Product feed',
    time: '2 days ago',
  },
  {
    id: 6,
    category: 'Technology',
    relevance: 'Low',
    title: 'Anthropic Claude 4.5 GA — enhanced tool use for agentic workflows',
    summary: 'Latest model release improves structured output reliability and multi-step reasoning. Relevant to BIQc\'s signal enrichment and diagnostic engine pipelines.',
    source: 'Tech feed',
    time: '3 days ago',
  },
  {
    id: 7,
    category: 'Market',
    relevance: 'High',
    title: 'Deloitte: 62% of AU mid-market firms plan AI operations investment in 2026',
    summary: 'Survey of 480 Australian mid-market businesses reveals strong appetite for AI-driven operational tools. Budget reallocation from legacy BI platforms is the primary funding source.',
    source: 'Market research',
    time: '3 days ago',
  },
  {
    id: 8,
    category: 'Regulatory',
    relevance: 'Medium',
    title: 'ACCC launches consultation on AI transparency in B2B SaaS pricing',
    summary: 'New consultation paper examines algorithmic pricing practices in B2B software. Potential disclosure requirements for AI-driven pricing recommendations could affect dynamic pricing features.',
    source: 'Gov feed',
    time: '4 days ago',
  },
  {
    id: 9,
    category: 'Technology',
    relevance: 'Medium',
    title: 'OpenAI releases Codex 2 with improved structured data extraction',
    summary: 'New model capabilities for parsing unstructured business documents. Competitive consideration for BIQc document intelligence pipeline that currently uses Claude-based extraction.',
    source: 'Tech feed',
    time: '5 days ago',
  },
  {
    id: 10,
    category: 'Industry',
    relevance: 'Low',
    title: 'Salesforce acquires AU-based workflow automation startup FlowLogic',
    summary: 'Acquisition strengthens Salesforce ecosystem with AU-native workflow tooling. May affect BIQc integration strategy with Salesforce customers who used FlowLogic connectors.',
    source: 'News monitoring',
    time: '5 days ago',
  },
];

/* ───────────────────────── TRACKED ENTITIES ───────────────────────── */
const TRACKED_ENTITIES = [
  { name: 'Trillion Software', type: 'Competitor',      stats: [{ label: 'Mentions', value: '28' }, { label: 'Alerts', value: '3', color: '#DC2626' }, { label: 'Trend', value: '\u2191', color: '#DC2626' }] },
  { name: 'DataPulse AU',      type: 'Competitor',      stats: [{ label: 'Mentions', value: '12' }, { label: 'Alerts', value: '1', color: '#D97706' }, { label: 'Trend', value: '\u2191', color: '#DC2626' }] },
  { name: 'Bramwell Holdings', type: 'Key Account',     stats: [{ label: 'Mentions', value: '6' },  { label: 'Signals', value: '2', color: '#D97706' }, { label: 'Trend', value: '\u2014' }] },
  { name: 'OAIC / Privacy Act',type: 'Regulatory',      stats: [{ label: 'Updates', value: '4' },  { label: 'Actions', value: '1', color: '#D97706' }, { label: 'Trend', value: '\u2191', color: '#DC2626' }] },
  { name: 'HubSpot',           type: 'Platform',        stats: [{ label: 'Updates', value: '8' },  { label: 'Signals', value: '0' }, { label: 'Trend', value: '\u2014' }] },
  { name: 'AU SMB SaaS Market',type: 'Market Segment',  stats: [{ label: 'Reports', value: '3' },  { label: 'Signals', value: '1' }, { label: 'Trend', value: '\u2191', color: '#16A34A' }] },
];

/* ───────────────────────── HELPERS ───────────────────────── */
const formatToday = () => {
  const d = new Date();
  return d.toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' });
};

/* ───────────────────────── COMPONENT ───────────────────────── */
const IntelCentre = () => {
  const [activeTab, setActiveTab] = useState('All');

  const filteredItems = useMemo(() => {
    if (activeTab === 'All') return INTEL_ITEMS;
    return INTEL_ITEMS.filter((item) => item.category === activeTab);
  }, [activeTab]);

  /* ─── shared styles ─── */
  const cardBg = colors.bgCard;
  const borderColor = colors.border;
  const lava = colors.brand;

  return (
    <DashboardLayout>
      <div className="intel-centre-root" style={{ padding: '32px 32px 48px', maxWidth: 1280, margin: '0 auto' }}>

        {/* ═══════ HEADER ═══════ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontFamily: fontFamily.display, fontSize: 28, fontWeight: 700, color: colors.text, letterSpacing: '-0.02em', margin: 0 }}>
            Intel Centre
          </h1>
          <button
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: radius.badge,
              background: `linear-gradient(135deg, ${lava}, #FF7A1A)`,
              color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: fontFamily.body,
              border: 'none', cursor: 'pointer',
              transition: 'box-shadow 0.2s, transform 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(232,93,0,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
          >
            <FileText size={16} />
            Generate Brief
          </button>
        </div>

        {/* ═══════ AI DAILY BRIEF ═══════ */}
        <div
          style={{
            background: cardBg,
            border: `1px solid ${borderColor}`,
            borderLeft: `3px solid ${lava}`,
            borderRadius: radius.card,
            padding: 20,
            marginBottom: 32,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: lava }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: colors.brandDark, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: fontFamily.mono }}>
              AI Daily Intelligence Brief
            </span>
            <span style={{ fontSize: 12, color: colors.textMuted, marginLeft: 'auto', fontFamily: fontFamily.body }}>
              {formatToday()}
            </span>
          </div>
          <div style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 1.6, fontFamily: fontFamily.body }}>
            <strong style={{ color: colors.text }}>3 high-relevance developments</strong> detected overnight.
            Trillion Software's enterprise pricing drop is gaining traction on LinkedIn — 14 mentions across your target AU SMB segment.
            Meanwhile, <strong style={{ color: colors.text }}>OAIC released draft guidance</strong> on the 2026 Privacy Act amendments that affects your data handling disclosures.
            Your market share of voice held steady at <strong style={{ color: colors.text }}>12%</strong> despite Trillion's push, suggesting brand loyalty is holding in existing accounts.
          </div>
          <button
            style={{
              marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, fontWeight: 600, color: lava, background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: fontFamily.body, padding: 0,
            }}
          >
            Read full brief <ArrowRight size={14} />
          </button>
        </div>

        {/* ═══════ 2-COLUMN LAYOUT: FEED + TRACKED ═══════ */}
        <div className="intel-main-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>

          {/* ─── LEFT: INTELLIGENCE FEED ─── */}
          <div>
            <h2 style={{ fontFamily: fontFamily.display, fontSize: 22, fontWeight: 700, color: colors.text, marginBottom: 16, marginTop: 0 }}>
              Intelligence Feed
            </h2>

            {/* Tab pills */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '6px 14px',
                      fontSize: 11,
                      fontWeight: 500,
                      fontFamily: fontFamily.mono,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: isActive ? '#fff' : colors.textMuted,
                      background: isActive ? '#1E293B' : 'transparent',
                      border: 'none',
                      borderRadius: 999,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(140,170,210,0.08)'; e.currentTarget.style.color = colors.text; } }}
                    onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = colors.textMuted; } }}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            {/* Feed items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredItems.map((item) => {
                const catColor = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Market;
                const relStyle = RELEVANCE_STYLES[item.relevance] || RELEVANCE_STYLES.Low;
                return (
                  <div
                    key={item.id}
                    className="intel-feed-item"
                    style={{
                      background: cardBg,
                      border: `1px solid ${borderColor}`,
                      borderRadius: radius.card,
                      padding: '16px 20px',
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: 16,
                      alignItems: 'start',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(140,170,210,0.3)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    {/* Left content */}
                    <div>
                      {/* Category badge */}
                      <span
                        style={{
                          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                          padding: '3px 8px', borderRadius: radius.full,
                          display: 'inline-block', marginBottom: 8,
                          background: catColor.bg, color: catColor.text,
                          fontFamily: fontFamily.mono,
                        }}
                      >
                        {item.category}
                      </span>

                      {/* Title */}
                      <div style={{ fontSize: 14, fontWeight: 600, color: colors.text, marginBottom: 4, lineHeight: 1.4, fontFamily: fontFamily.body }}>
                        {item.title}
                      </div>

                      {/* Summary */}
                      <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5, fontFamily: fontFamily.body }}>
                        {item.summary}
                      </div>

                      {/* Meta row: source + time + analyse button */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, fontSize: 12, color: colors.textMuted, fontFamily: fontFamily.body }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Globe size={12} />
                          {item.source}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} />
                          {item.time}
                        </span>
                        <button
                          style={{
                            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 12, fontWeight: 600, color: lava,
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontFamily: fontFamily.body, padding: 0,
                          }}
                        >
                          Analyse <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Relevance badge */}
                    <span
                      style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 8px',
                        borderRadius: radius.full, whiteSpace: 'nowrap',
                        background: relStyle.bg, color: relStyle.text,
                        fontFamily: fontFamily.mono,
                      }}
                    >
                      {item.relevance}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── RIGHT: TRACKED ENTITIES ─── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontFamily: fontFamily.display, fontSize: 22, fontWeight: 700, color: colors.text, margin: 0 }}>
                Tracked Entities
              </h2>
              <button
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 600, color: lava,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: fontFamily.body, padding: 0,
                }}
              >
                <Plus size={14} /> Add entity
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {TRACKED_ENTITIES.map((entity) => (
                <div
                  key={entity.name}
                  style={{
                    background: cardBg,
                    border: `1px solid ${borderColor}`,
                    borderRadius: radius.card,
                    padding: 16,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(140,170,210,0.3)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderColor; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {/* Head: name + type */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: colors.text, fontFamily: fontFamily.body }}>
                      {entity.name}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: fontFamily.mono }}>
                      {entity.type}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
                    {entity.stats.map((stat) => (
                      <div key={stat.label}>
                        <div style={{ fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: fontFamily.mono, marginBottom: 2 }}>
                          {stat.label}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: stat.color || colors.text, fontFamily: fontFamily.mono }}>
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ═══════ RESPONSIVE: stack columns on mobile ═══════ */}
      <style>{`
        @media (max-width: 900px) {
          .intel-main-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .intel-centre-root {
            padding: 16px 16px 32px !important;
          }
          .intel-feed-item {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </DashboardLayout>
  );
};

export default IntelCentre;
