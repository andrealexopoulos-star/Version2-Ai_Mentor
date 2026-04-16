import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useSnapshot } from '../hooks/useSnapshot';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { apiClient } from '../lib/api';
import { PageLoadingState, PageErrorState } from '../components/PageStateComponents';
import IntegrationStatusWidget from '../components/IntegrationStatusWidget';
import DataConfidence from '../components/DataConfidence';
import {
  AlertTriangle, Shield, DollarSign, TrendingDown, CheckCircle2,
  Users, UserX, Clock, Plug, Activity, Heart, Info, ArrowRight,
  ExternalLink, ChevronDown, ChevronUp, Mail, Calendar, Loader2,
  XCircle, Zap, Sparkles,
} from 'lucide-react';
// Design tokens now referenced via CSS custom properties
import { Link } from 'react-router-dom';
import { useSupabaseAuth, AUTH_STATE } from '../context/SupabaseAuthContext';
import { EmptyStateCard, MetricCard, SectionLabel, SignalCard, SurfaceCard } from '../components/intelligence/SurfacePrimitives';
import LineageBadge from '../components/LineageBadge';

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>{children}</div>
);

// ── Tooltip ───────────────────────────────────────────────────────────────────
const Tooltip = ({ text, children }) => {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)} onBlur={() => setShow(false)}>
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg text-[11px] leading-snug z-50 whitespace-pre-wrap max-w-[200px]"
          style={{ background: 'var(--surface-sunken, #F5F5F5)', color: 'var(--ink-display)', border: '1px solid var(--border-strong, rgba(10,10,10,0.14))', fontFamily: 'var(--font-ui)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
          {text}
        </span>
      )}
    </span>
  );
};

// ── Risk meter ────────────────────────────────────────────────────────────────
const RiskMeter = ({ value, label, thresholds = [30, 60], insufficientData = false }) => {
  const color = insufficientData || value == null ? '#64748B' : value > thresholds[1] ? '#EF4444' : value > thresholds[0] ? '#F59E0B' : '#10B981';
  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
      <span className="text-[10px] text-[var(--ink-muted)] block mb-1" style={{ fontFamily: 'var(--font-mono)' }}>{label}</span>
      <div className="flex items-end gap-2">
        {insufficientData || value == null
          ? <span className="text-xs italic" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>Insufficient data</span>
          : <span className="text-xl font-bold" style={{ color, fontFamily: 'var(--font-mono)' }}>{value}%</span>
        }
      </div>
      {!insufficientData && value != null && (
        <div className="h-1.5 rounded-full mt-2" style={{ background: color + '20' }}>
          <div className="h-1.5 rounded-full transition-all" style={{ background: color, width: Math.min(value, 100) + '%' }} />
        </div>
      )}
    </div>
  );
};

// ── Risk category row ─────────────────────────────────────────────────────────
const RiskCategory = ({ icon: Icon, color, title, hasData, children, badgeLabel, noCTA }) => (
  <Panel>
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <h3 className="text-sm font-semibold text-[var(--ink-display)]" style={{ fontFamily: 'var(--font-display)' }}>{title}</h3>
      </div>
      <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
        style={{ background: hasData ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.15)', color: hasData ? '#10B981' : '#64748B', fontFamily: 'var(--font-mono)' }}>
        {hasData ? (badgeLabel || 'Data available') : 'Insufficient data'}
      </span>
    </div>
    {hasData ? children : (
      <p className="text-xs italic" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>
        No data available for this category. {!noCTA && 'Connect the relevant integration to activate monitoring.'}
      </p>
    )}
  </Panel>
);

// ── Workforce example metric card ─────────────────────────────────────────────
const ExampleMetric = ({ label, example, color }) => (
  <div className="p-3 rounded-lg opacity-60" style={{ background: 'var(--biqc-bg)', border: `1px dashed ${color}40` }}>
    <span className="text-[9px] uppercase tracking-widest" style={{ color, fontFamily: 'var(--font-mono)' }}>sample</span>
    <p className="text-xs font-semibold text-[var(--ink-display)] mt-0.5" style={{ fontFamily: 'var(--font-display)' }}>{label}</p>
    <p className="text-[10px]" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>{example}</p>
  </div>
);

// ── Clickable propagation chain ───────────────────────────────────────────────
const PropagationChain = ({ chain, cognitive }) => {
  const [expanded, setExpanded] = useState(false);
  const src = chain.source || '';
  const tgt = chain.target || '';
  const pct = chain.probability != null ? Math.round(chain.probability * 100) : null;
  const ic = pct > 70 ? '#EF4444' : pct > 40 ? '#F59E0B' : '#3B82F6';

  // Derive specific data to show on drill-down
  const drillDown = {
    revenue: cognitive?.revenue,
    finance: cognitive?.capital,
    people: cognitive?.founder_vitals,
    operations: cognitive?.execution,
    market: cognitive?.market_position,
  };
  const srcData = drillDown[(src || '').toLowerCase()];
  const tgtData = drillDown[(tgt || '').toLowerCase()];

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${ic}25` }}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 p-3 text-left transition-all hover:bg-white/5"
        style={{ background: ic + '06' }}>
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: '#EF444415', color: '#EF4444', fontFamily: 'var(--font-mono)' }}>{src}</span>
          <span className="text-[10px] text-[var(--ink-muted)]">→</span>
          <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: '#F59E0B15', color: '#F59E0B', fontFamily: 'var(--font-mono)' }}>{tgt}</span>
          {pct != null && <span className="text-[9px] ml-auto font-semibold" style={{ color: ic, fontFamily: 'var(--font-mono)' }}>{pct}% likelihood</span>}
          {chain.window && <span className="text-[9px]" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>{chain.window}</span>}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--ink-muted)' }} /> : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--ink-muted)' }} />}
      </button>

      {expanded && (
        <div className="p-3 space-y-2" style={{ borderTop: `1px solid ${ic}20` }}>
          {chain.description && (
            <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{chain.description}</p>
          )}

          {/* Show underlying data for each domain */}
          {srcData && (
            <div className="p-2.5 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid rgba(140,170,210,0.15)' }}>
              <p className="text-[10px] font-semibold mb-1" style={{ color: ic, fontFamily: 'var(--font-mono)' }}>{src.toUpperCase()} — Contributing factors</p>
              {srcData.pipeline != null && <p className="text-[11px]" style={{ color: 'var(--ink-secondary)' }}>Pipeline: ${srcData.pipeline?.toLocaleString()}</p>}
              {srcData.runway != null && <p className="text-[11px]" style={{ color: 'var(--ink-secondary)' }}>Cash runway: {srcData.runway} months</p>}
              {srcData.calendar && <p className="text-[11px]" style={{ color: 'var(--ink-secondary)' }}>{srcData.calendar}</p>}
              {srcData.deals?.length > 0 && <p className="text-[11px]" style={{ color: 'var(--ink-secondary)' }}>{srcData.deals.length} active deals — {srcData.deals.filter(d => (d.stall||0) > 30).length} stalled</p>}
            </div>
          )}

          {/* Navigation link */}
          <div className="flex gap-2 pt-1">
            {src === 'revenue' && <Link to="/revenue" className="text-[10px] flex items-center gap-1" style={{ color: '#E85D00', fontFamily: 'var(--font-mono)' }}>View Revenue <ExternalLink className="w-3 h-3" /></Link>}
            {(src === 'finance' || tgt === 'finance') && <Link to="/revenue" className="text-[10px] flex items-center gap-1" style={{ color: '#E85D00', fontFamily: 'var(--font-mono)' }}>View Financials <ExternalLink className="w-3 h-3" /></Link>}
            {(src === 'people' || tgt === 'people') && <Link to="/risk?tab=workforce" className="text-[10px] flex items-center gap-1" style={{ color: '#E85D00', fontFamily: 'var(--font-mono)' }}>View Workforce <ExternalLink className="w-3 h-3" /></Link>}
            {(src === 'operations' || tgt === 'operations') && <Link to="/operations" className="text-[10px] flex items-center gap-1" style={{ color: '#E85D00', fontFamily: 'var(--font-mono)' }}>View Operations <ExternalLink className="w-3 h-3" /></Link>}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Acronym legend ────────────────────────────────────────────────────────────
const ACRONYMS = [
  { label: 'RVI', title: 'Revenue Volatility Index', desc: 'Measures month-to-month unpredictability in your revenue streams. High = erratic cashflow.' },
  { label: 'EDS', title: 'Engagement Decay Score', desc: 'Rate at which customer and lead engagement is declining. High = clients pulling away.' },
  { label: 'CDR', title: 'Cash Deviation Ratio', desc: 'How far your actual cash position diverges from expected. High = unexpected outflows or shortfalls.' },
  { label: 'ADS', title: 'Anomaly Density Score', desc: 'Frequency of unusual signals across all connected data. High = something unusual is happening.' },
];

// Risk register rows and heat dots are now derived from live data, not hardcoded.

const SEV_STYLE = {
  Critical: { bg: '#FEE2E2', color: '#991B1B' },
  High:     { bg: '#FEF3C7', color: '#92400E' },
  Medium:   { bg: '#DBEAFE', color: '#1E40AF' },
};

const STATUS_STYLE = {
  Complete:      { bg: '#D1FAE5', color: '#065F46' },
  'In Progress': { bg: '#FEF3C7', color: '#92400E' },
  Planned:       { bg: '#DBEAFE', color: '#1E40AF' },
  Monitoring:    { bg: '#F1F5F9', color: '#475569' },
};

// Heat map cell colors — rows = Impact (Critical..Low top-to-bottom), cols = Likelihood (Rare..Likely left-to-right)
const HEAT_COLORS = [
  // Impact: Critical
  ['#92400E', '#991B1B', '#991B1B', '#991B1B'],
  // Impact: High
  ['#92400E', '#92400E', '#991B1B', '#991B1B'],
  // Impact: Medium
  ['#166534', '#92400E', '#92400E', '#991B1B'],
  // Impact: Low
  ['#166534', '#166534', '#92400E', '#92400E'],
];

// Impact row mapping for heat map: Critical=0, High=1, Medium=2, Low=3
const IMPACT_ROW = { Critical: 0, High: 1, Medium: 2, Low: 3 };
// Likelihood col mapping: Rare=0, Unlikely=1, Possible=2, Likely=3
const LIKELIHOOD_COL = { Rare: 0, Unlikely: 1, Possible: 2, Likely: 3 };

const DOT_COLOR = { Critical: '#DC2626', High: '#D97706', Medium: '#2563EB' };
const CELL_BG_ALPHA = { '#166534': 'rgba(22,101,52,0.18)', '#92400E': 'rgba(146,64,14,0.18)', '#991B1B': 'rgba(153,27,27,0.22)' };

const Y_LABELS = ['Critical', 'High', 'Medium', 'Low'];
const X_LABELS = ['Rare', 'Unlikely', 'Possible', 'Likely'];

// ── HeatMapDot with tooltip ──────────────────────────────────────────────────
const HeatMapDot = ({ dot }) => {
  const [hover, setHover] = useState(false);
  return (
    <span
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="relative inline-flex items-center justify-center cursor-pointer"
      style={{
        width: 24, height: 24, borderRadius: '50%', fontSize: 10, fontWeight: 700,
        color: '#fff', background: DOT_COLOR[dot.severity] || '#64748B',
        fontFamily: 'var(--font-mono)', transition: 'transform 150ms ease', transform: hover ? 'scale(1.35)' : 'scale(1)',
        zIndex: 2,
      }}>
      {dot.id}
      {hover && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg text-[11px] leading-snug z-50 whitespace-nowrap"
          style={{ background: 'var(--surface-sunken, #F5F5F5)', color: 'var(--ink-display)', border: '1px solid var(--border-strong, rgba(10,10,10,0.14))', fontFamily: 'var(--font-ui)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
          {dot.name}
        </span>
      )}
    </span>
  );
};

// ── KPI Strip ────────────────────────────────────────────────────────────────
const RiskKPIStrip = ({ riskData }) => {
  const totalRisks = riskData?.total_risks ?? null;
  const critHigh = riskData?.critical_high ?? null;
  const mitigated = riskData?.mitigated_this_month ?? null;
  const exposure = riskData?.exposure_score ?? null;

  const kpis = [
    { label: 'Total Risks', value: totalRisks != null ? totalRisks : '\u2014', icon: Shield, delta: riskData?.total_risks_delta || null, deltaDir: riskData?.total_risks_delta_dir || null },
    { label: 'Critical / High', value: critHigh != null ? critHigh : '\u2014', icon: AlertTriangle, colorClass: critHigh != null ? '#DC2626' : null, delta: riskData?.critical_high_delta || null, deltaDir: riskData?.critical_high_delta_dir || null },
    { label: 'Mitigated', value: mitigated != null ? mitigated : '\u2014', icon: CheckCircle2, colorClass: mitigated != null ? '#16A34A' : null, delta: riskData?.mitigated_delta || null, deltaDir: riskData?.mitigated_delta_dir || null },
    { label: 'Exposure Score', value: exposure != null ? exposure : '\u2014', icon: Activity, colorClass: exposure != null ? '#D97706' : null, delta: riskData?.exposure_delta || null, deltaDir: riskData?.exposure_delta_dir || null },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="risk-kpi-strip">
      {kpis.map((kpi, i) => (
        <div key={i} className="rounded-xl p-4"
          style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <kpi.icon className="w-3.5 h-3.5" style={{ color: kpi.colorClass || '#64748B' }} />
            <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>{kpi.label}</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: kpi.colorClass || 'var(--ink-display)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
            {kpi.value}
          </div>
          {kpi.delta && (
            <div className="text-xs mt-1 font-medium" style={{ color: kpi.deltaDir === 'up' ? '#DC2626' : '#16A34A', fontFamily: 'var(--font-mono)' }}>
              {kpi.delta}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ── AI Risk Insight Card ─────────────────────────────────────────────────────
const AIRiskInsightCard = ({ insight }) => {
  if (!insight) {
    return (
      <div className="rounded-xl p-5" data-testid="risk-ai-insight"
        style={{
          background: 'var(--biqc-bg-card)',
          border: '1px solid var(--biqc-border)',
          borderLeft: '4px solid #64748B',
        }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4" style={{ color: 'var(--ink-muted)' }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>BIQc Risk AI</span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
          Connect data sources to generate risk intelligence.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-5" data-testid="risk-ai-insight"
      style={{
        background: 'linear-gradient(135deg, rgba(220,38,38,0.06), rgba(220,38,38,0.02))',
        border: '1px solid var(--biqc-border)',
        borderLeft: '4px solid #DC2626',
      }}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4" style={{ color: '#DC2626' }} />
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#991B1B', fontFamily: 'var(--font-mono)' }}>BIQc Risk AI</span>
        <span className="w-2 h-2 rounded-full" style={{ background: '#DC2626', animation: 'pulse 2s ease-in-out infinite' }} />
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
        {insight}
      </p>
    </div>
  );
};

// ── Risk Heat Map (SVG Matrix) ───────────────────────────────────────────────
const RiskHeatMap = ({ risks }) => {
  // Derive heat dots from real risk data
  const heatDots = (risks || []).map((r, i) => ({
    id: i + 1,
    row: IMPACT_ROW[r.impact] ?? 2,
    col: LIKELIHOOD_COL[r.likelihood] ?? 2,
    severity: r.severity || 'Medium',
    name: r.risk || r.name || 'Unknown',
  }));

  return (
    <div className="rounded-xl p-5" data-testid="risk-heat-map"
      style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
      <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>Risk Heat Map</h2>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* SVG Matrix */}
        <div className="flex-shrink-0 mx-auto md:mx-0">
          <svg viewBox="-50 0 500 460" style={{ width: '100%', maxWidth: 420, height: 'auto' }}>
            {/* Grid cells -- row 0 = top (Critical impact), col 0 = left (Rare likelihood) */}
            {[0,1,2,3].map(row => [0,1,2,3].map(col => {
              const severity = row + col;
              const color = severity >= 5 ? 'rgba(239,68,68,0.2)' : severity >= 3 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.1)';
              return <rect key={`${row}-${col}`} x={col * 100} y={(3 - row) * 100} width={100} height={100} fill={color} stroke="rgba(140,170,210,0.12)" />;
            }))}

            {/* Risk dots plotted on the SVG grid (only when real data exists) */}
            {heatDots.map(dot => {
              const cx = dot.col * 100 + 50;
              const cy = dot.row * 100 + 50;
              const fill = DOT_COLOR[dot.severity] || '#64748B';
              return (
                <g key={dot.id}>
                  <circle cx={cx} cy={cy} r={14} fill={fill} style={{ cursor: 'pointer' }}>
                    <title>{dot.name}</title>
                  </circle>
                  <text x={cx} y={cy + 4} textAnchor="middle" style={{ fontSize: 11, fill: '#fff', fontWeight: 700, fontFamily: 'var(--font-mono)', pointerEvents: 'none' }}>
                    {dot.id}
                  </text>
                </g>
              );
            })}

            {/* Y-axis row labels */}
            {Y_LABELS.map((label, i) => (
              <text key={`yl-${i}`} x={-8} y={i * 100 + 55} textAnchor="end" style={{ fontSize: 9, fill: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
              </text>
            ))}

            {/* X-axis col labels */}
            {X_LABELS.map((label, i) => (
              <text key={`xl-${i}`} x={i * 100 + 50} y={420} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
              </text>
            ))}

            {/* Axis labels */}
            <text x="200" y="445" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>{'IMPACT \u2192'}</text>
            <text x="-30" y="200" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', transform: 'rotate(-90, -30, 200)' }}>{'LIKELIHOOD \u2192'}</text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-3 min-w-0">
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>Plotted Risks</p>
          {heatDots.length > 0 ? heatDots.map(dot => (
            <div key={dot.id} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                style={{ background: DOT_COLOR[dot.severity] || '#64748B', fontFamily: 'var(--font-mono)' }}>
                {dot.id}
              </span>
              <span className="text-xs" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{dot.name}</span>
              <span className="text-[9px] ml-auto px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: (DOT_COLOR[dot.severity] || '#64748B') + '18', color: DOT_COLOR[dot.severity] || '#64748B', fontFamily: 'var(--font-mono)' }}>
                {dot.severity}
              </span>
            </div>
          )) : (
            <p className="text-xs italic" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>
              No risks plotted. Connect data sources to enable risk detection.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Risk Register Table ──────────────────────────────────────────────────────
const RiskRegisterTable = ({ risks }) => {
  const rows = (risks || []).map((r, i) => ({ ...r, id: r.id || i + 1 }));

  return (
    <div className="rounded-xl overflow-hidden" data-testid="risk-register-table"
      style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-base font-semibold" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>Risk Register</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--biqc-border)' }}>
              {['ID', 'Risk', 'Severity', 'Likelihood', 'Impact', 'Owner', 'Mitigation Status'].map(h => (
                <th key={h} className="text-left px-4 py-2.5"
                  style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', background: 'rgba(30,45,61,0.5)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? rows.map((r) => {
              const sev = SEV_STYLE[r.severity] || SEV_STYLE.Medium;
              const stat = STATUS_STYLE[r.status] || STATUS_STYLE.Monitoring;
              return (
                <tr key={r.id} className="transition-colors hover:bg-white/[0.03]"
                  style={{ borderBottom: '1px solid rgba(140,170,210,0.08)' }}>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)' }}>{r.id}</td>
                  <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}>{r.risk || r.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: sev.bg, color: sev.color, fontFamily: 'var(--font-mono)' }}>
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)' }}>{r.likelihood}</td>
                  <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)' }}>{r.impact}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{r.owner}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: stat.bg, color: stat.color, fontFamily: 'var(--font-mono)' }}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <p className="text-sm" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
                    No risks identified yet. Connect data sources to enable risk detection.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const RiskPage = () => {
  const { cognitive, loading, error, refresh } = useSnapshot();
  const { session, authState } = useSupabaseAuth();
  const c = cognitive || {};
  const risk = c.risk || {};
  const cap = c.capital || {};
  const exec = c.execution || {};
  const alignment = c.alignment || {};
  const fv = c.founder_vitals || {};
  const rev = c.revenue || {};

  const { status: integrationStatus, loading: integrationLoading } = useIntegrationStatus();
  const [activeTab, setActiveTab] = useState('governance');
  const [sqlWorkforce, setSqlWorkforce] = useState(null);
  const [sqlScores, setSqlScores] = useState(null);
  const [unifiedRisk, setUnifiedRisk] = useState(null);
  const [showAcronymLegend, setShowAcronymLegend] = useState(false);

  useEffect(() => {
    if (authState === AUTH_STATE.LOADING && !session?.access_token) return;
    if (!session?.access_token) return;
    apiClient.get('/intelligence/workforce').then(res => {
      if (res.data?.has_data) setSqlWorkforce(res.data);
    }).catch(() => {});
    apiClient.get('/intelligence/scores').then(res => {
      if (res.data?.scores) setSqlScores(res.data.scores);
    }).catch(() => {});
    apiClient.get('/unified/risk').then(res => {
      if (res.data) setUnifiedRisk(res.data);
    }).catch(() => {});
    apiClient.get('/cognition/risk').then(res => {
      if (res.data && res.data.status !== 'MIGRATION_REQUIRED') {
        setUnifiedRisk(prev => ({ ...prev, ...res.data }));
      }
    }).catch(() => {});
  }, [session?.access_token, authState]);

  const hasCRM = integrationStatus?.canonical_truth?.crm_connected;
  const hasAccounting = integrationStatus?.canonical_truth?.accounting_connected;
  const hasEmail = integrationStatus?.canonical_truth?.email_connected ||
    (integrationStatus?.integrations || []).some(i => i.connected && ['email','outlook','gmail'].some(k => (i.category||'').toLowerCase().includes(k) || (i.provider||'').toLowerCase().includes(k)));
  const hasAnyIntegration = (integrationStatus?.canonical_truth?.total_connected || 0) > 0 || hasEmail;
  const integrationResolved = !integrationLoading && !!integrationStatus;

  const spofs = risk.spof || [];
  const regulatory = risk.regulatory || [];
  const concentration = risk.concentration || '';
  const runway = hasAccounting ? cap.runway : null;
  const slaBreaches = hasCRM ? exec.sla_breaches : null;
  const contradictions = alignment.contradictions || [];
  const hasPeopleData = hasEmail && (fv.capacity_index != null || fv.fatigue || fv.recommendation || fv.calendar);

  // Req 6: detect missing data (don't show "Low" when data doesn't exist)
  const hasRiskData = runway != null || slaBreaches != null || spofs.length > 0 || concentration || hasEmail;
  const compositeScore = unifiedRisk?.composite_risk_score;
  const compositeDisplay = compositeScore != null
    ? Math.round(compositeScore * 100) + '%'
    : 'Insufficient data';
  const compositeColor = compositeScore != null
    ? compositeScore > 0.6 ? '#EF4444' : compositeScore > 0.3 ? '#F59E0B' : '#10B981'
    : '#64748B';

  // Req 3: concentration as specific metric
  const topClientPct = rev.deals?.length > 0 ? (() => {
    const byCompany = {};
    rev.deals.forEach(d => { const co = d.company?.name || 'Unknown'; byCompany[co] = (byCompany[co]||0) + (parseFloat(d.amount)||0); });
    const total = Object.values(byCompany).reduce((s,v)=>s+v,0);
    const sorted = Object.entries(byCompany).sort((a,b)=>b[1]-a[1]);
    const top3 = sorted.slice(0,3).reduce((s,[,v])=>s+v,0);
    return total > 0 ? Math.round((top3/total)*100) : null;
  })() : null;

  const TABS = [
    { id: 'governance', label: 'Risk & Governance', icon: Shield },
    { id: 'workforce', label: 'Workforce Intelligence', icon: Users },
    { id: 'unified', label: 'Cross-Domain Risk', icon: Activity },
  ];

  // All risk categories (complete matrix)
  const RISK_CATEGORIES = [
    { id: 'financial', icon: DollarSign, color: '#E85D00', title: 'Financial Risk', has: runway != null || !!concentration || !!cap.margin },
    { id: 'operational', icon: AlertTriangle, color: '#F59E0B', title: 'Operational Risk', has: slaBreaches != null || !!exec.bottleneck },
    { id: 'compliance', icon: Shield, color: '#8B5CF6', title: 'Compliance & Regulatory', has: regulatory.length > 0 },
    { id: 'market', icon: TrendingDown, color: '#3B82F6', title: 'Market Volatility', has: !!c.market_position?.volatility || !!c.market_position?.threats },
    { id: 'supplier', icon: Zap, color: '#EF4444', title: 'Supplier Dependency', has: spofs.length > 0 },
    { id: 'people', icon: Users, color: '#10B981', title: 'Workforce & Key-Person', has: spofs.length > 0 || hasPeopleData },
  ];

  const monitoredCount = RISK_CATEGORIES.filter((category) => category.has).length;
  const toConfidencePct = (raw) => {
    if (raw == null) return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n)) return undefined;
    return n > 0 && n <= 1 ? n * 100 : n;
  };
  const riskIntelLineage = unifiedRisk?.lineage ?? c?.lineage;
  const riskIntelFreshness = unifiedRisk?.data_freshness ?? c?.data_freshness;
  const riskIntelConfidence = toConfidencePct(unifiedRisk?.confidence_score ?? c?.confidence_score)
    ?? toConfidencePct(typeof c.system_state === 'object' ? c.system_state?.confidence : c.confidence_level);

  const riskPrioritySignals = [
    runway != null ? {
      id: 'risk-financial-runway',
      title: `Cash runway is ${runway} month${runway === 1 ? '' : 's'}`,
      detail: 'Liquidity pressure is real enough to watch before it compounds into people or delivery trade-offs.',
      action: 'Review overdue cash timing, committed spend, and the next decision deadline together.',
      source: 'Accounting',
      signalType: 'cash_runway',
      timestamp: c?.computed_at || null,
      severity: runway <= 3 ? 'high' : 'warning',
    } : null,
    hasPeopleData ? {
      id: 'risk-workforce-pressure',
      title: 'People pressure is visible in live communication signals',
      detail: fv.recommendation || fv.calendar || 'Workforce strain is starting to surface through calendar or email patterns.',
      action: 'Check key-person dependency and capacity before execution quality drops further.',
      source: 'Email/Calendar',
      signalType: 'workforce_pressure',
      timestamp: c?.computed_at || null,
      severity: 'warning',
    } : null,
    topClientPct != null ? {
      id: 'risk-concentration-top-clients',
      title: `${topClientPct}% of revenue sits in the top three clients`,
      detail: 'Commercial concentration means one delayed account can move the whole risk picture.',
      action: 'Review concentration and diversify near-term revenue coverage before the next review.',
      source: 'CRM',
      signalType: 'concentration_risk',
      timestamp: c?.computed_at || null,
      severity: topClientPct >= 60 ? 'high' : 'warning',
    } : null,
  ].filter(Boolean);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: 'var(--font-ui)' }} data-testid="risk-page">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-medium mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', fontSize: 28, letterSpacing: 'var(--ls-display)', lineHeight: 1.05 }}>Risk Intelligence</h1>
            <p className="text-sm text-[var(--ink-secondary)]">
              {integrationLoading && !integrationResolved ? 'Verifying connected systems and live risk signals…' : hasAnyIntegration ? `Monitoring ${RISK_CATEGORIES.filter(c => c.has).length} of ${RISK_CATEGORIES.length} risk categories with live data.` : 'Connect integrations to activate risk monitoring.'}
            </p>
          </div>
          <DataConfidence cognitive={cognitive} channelsData={integrationStatus} loading={integrationLoading && !integrationStatus} />
        </div>

        <div className="flex flex-wrap items-center gap-2" data-testid="risk-lineage-badge">
          <LineageBadge lineage={riskIntelLineage} data_freshness={riskIntelFreshness} confidence_score={riskIntelConfidence} compact />
        </div>

        {/* ═══ NEW: KPI Strip ═══ */}
        <RiskKPIStrip riskData={unifiedRisk} />

        {/* ═══ NEW: AI Risk Insight ═══ */}
        <AIRiskInsightCard insight={unifiedRisk?.ai_insight || unifiedRisk?.summary || null} />

        {/* ═══ NEW: Risk Heat Map ═══ */}
        <RiskHeatMap risks={unifiedRisk?.risks} />

        {/* ═══ NEW: Risk Register Table ═══ */}
        <RiskRegisterTable risks={unifiedRisk?.risks} />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]" data-testid="risk-ux-main-grid">
          <div className="space-y-4" data-testid="risk-priority-column">
            <SectionLabel title="What could hurt the business first" detail="Risk is intentionally reduced to the few real exposures that can cascade across domains." testId="risk-priority-label" />
            <div className="grid gap-4 md:grid-cols-2" data-testid="risk-summary-metric-grid">
              <MetricCard label="Composite risk" value={compositeDisplay} caption="Cross-domain pressure from live signals" tone={compositeColor} testId="risk-composite-metric" />
              <MetricCard label="Monitored categories" value={`${monitoredCount}/${RISK_CATEGORIES.length}`} caption="Only categories with live evidence are counted" tone="#3B82F6" testId="risk-monitored-metric" />
              <MetricCard label="Cash runway" value={runway != null ? `${runway}m` : '—'} caption="Accounting-backed liquidity window" tone={runway != null && runway <= 3 ? '#EF4444' : '#10B981'} testId="risk-runway-metric" />
              <MetricCard label="Top 3 client share" value={topClientPct != null ? `${topClientPct}%` : '—'} caption="Commercial concentration in major accounts" tone={topClientPct != null && topClientPct >= 60 ? '#EF4444' : '#F59E0B'} testId="risk-concentration-metric" />
            </div>
            {riskPrioritySignals.length > 0 ? riskPrioritySignals.map((signal) => (
              <SignalCard key={signal.id} {...signal} testId={signal.id} />
            )) : (
              <EmptyStateCard title="Risk is quiet right now." detail="BIQc is not surfacing a material cross-domain risk in this cycle. That quiet state is intentional, not filler." testId="risk-priority-empty" />
            )}
          </div>

          <div className="space-y-4" data-testid="risk-guidance-column">
            <SurfaceCard testId="risk-reading-guidance-card">
              <SectionLabel title="How to use this page" detail="Start with the top card here, then use the deeper sections below only if you need the supporting chain or evidence." testId="risk-reading-guidance-label" />
              <div className="mt-4 space-y-3 text-sm text-[#CBD5E1]">
                <p data-testid="risk-reading-guidance-1">Finance remains tied to runway and concentration.</p>
                <p data-testid="risk-reading-guidance-2">People risk stays tied to live email and calendar strain signals.</p>
                <p data-testid="risk-reading-guidance-3">Propagation chains below are for investigation, not first-glance overload.</p>
              </div>
            </SurfaceCard>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }} data-testid="risk-tabs">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
              style={{ background: activeTab === tab.id ? '#E85D0015' : 'transparent', color: activeTab === tab.id ? 'var(--ink-display)' : '#64748B', fontFamily: 'var(--font-mono)' }}
              data-testid={`risk-tab-${tab.id}`}>
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {loading && <PageLoadingState message="Scanning risk signals…" />}
        {error && !loading && <PageErrorState error={error} onRetry={refresh} moduleName="Risk Intelligence" />}

        {/* ═══ GOVERNANCE TAB ═══ */}
        {!loading && activeTab === 'governance' && (
          <>
            {/* Req 1: Complete risk matrix — all categories, "Insufficient data" for missing */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
              {RISK_CATEGORIES.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 p-3 rounded-lg"
                  style={{ background: 'var(--biqc-bg-card)', border: `1px solid ${cat.has ? cat.color + '30' : '#1E2D3D'}` }}>
                  <cat.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: cat.has ? cat.color : '#4A5568' }} />
                  <div>
                    <p className="text-[10px] font-semibold" style={{ color: cat.has ? 'var(--ink-display)' : '#64748B', fontFamily: 'var(--font-mono)' }}>{cat.title}</p>
                    <p className="text-[9px]" style={{ color: cat.has ? cat.color : '#4A5568', fontFamily: 'var(--font-mono)' }}>
                      {cat.has ? 'Monitoring' : 'Insufficient data'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Financial Risk */}
            <RiskCategory icon={DollarSign} color="#E85D00" title="Financial Risk"
              hasData={runway != null || !!concentration || !!cap.margin}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <RiskMeter value={runway != null ? (runway < 3 ? 90 : runway < 6 ? 60 : runway < 12 ? 30 : 10) : null}
                  label={runway != null ? `Cash Runway: ${runway}mo` : 'Cash Runway'}
                  insufficientData={runway == null} />
                {/* Req 3: specific concentration metric */}
                {(concentration || topClientPct != null) && (
                  <div className="p-3 rounded-lg sm:col-span-2" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                    <span className="text-[10px] text-[var(--ink-muted)] block mb-1" style={{ fontFamily: 'var(--font-mono)' }}>Revenue Concentration Risk</span>
                    {topClientPct != null ? (
                      <>
                        <p className="text-sm font-semibold" style={{ color: topClientPct > 60 ? '#EF4444' : '#F59E0B', fontFamily: 'var(--font-mono)' }}>
                          Top 3 clients = {topClientPct}% of pipeline
                        </p>
                        <p className="text-[11px] text-[var(--ink-muted)] mt-0.5">
                          {topClientPct > 75 ? 'High concentration — losing one client would significantly impact revenue.' : topClientPct > 50 ? 'Moderate concentration — consider diversifying.' : 'Healthy spread across clients.'}
                        </p>
                        <Link to="/revenue" className="text-[10px] flex items-center gap-1 mt-1.5" style={{ color: '#E85D00', fontFamily: 'var(--font-mono)' }}>
                          View client breakdown <ArrowRight className="w-3 h-3" />
                        </Link>
                      </>
                    ) : (
                      <p className="text-xs text-[var(--ink-secondary)]">{concentration}</p>
                    )}
                  </div>
                )}
                {cap.margin && (
                  <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                    <span className="text-[10px] text-[var(--ink-muted)] block mb-1" style={{ fontFamily: 'var(--font-mono)' }}>Margin</span>
                    <p className="text-xs text-[var(--ink-secondary)]">{cap.margin}</p>
                  </div>
                )}
              </div>
              {!hasAccounting && (
                <div className="mt-3 flex items-center justify-between p-2.5 rounded-lg"
                  style={{ background: 'rgba(232,93,0,0.06)', border: '1px solid rgba(232,93,0,0.15)' }}>
                  <p className="text-[11px]" style={{ color: 'var(--ink-secondary)' }}>Connect Xero or MYOB for exact cash runway, margin % and cost structure.</p>
                  <Link to="/integrations?category=financial" className="text-[10px] flex items-center gap-1 ml-3 whitespace-nowrap" style={{ color: '#E85D00', fontFamily: 'var(--font-mono)' }}>
                    Connect <Plug className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </RiskCategory>

            {/* Operational Risk */}
            <RiskCategory icon={AlertTriangle} color="#F59E0B" title="Operational Risk"
              hasData={slaBreaches != null || !!exec.bottleneck}>
              {slaBreaches != null && (
                <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                  <p className="text-xs font-semibold text-[var(--ink-display)]">SLA Breaches: <span style={{ color: slaBreaches > 0 ? '#EF4444' : '#10B981' }}>{slaBreaches}</span></p>
                  <p className="text-[11px] text-[var(--ink-muted)] mt-0.5">{slaBreaches === 0 ? 'No service commitment breaches this week.' : `${slaBreaches} commitment${slaBreaches > 1?'s':''} missed — review with your team.`}</p>
                </div>
              )}
              {exec.bottleneck && (
                <div className="p-3 rounded-lg mt-2" style={{ background: '#F59E0B08', border: '1px solid #F59E0B25' }}>
                  <p className="text-[10px] font-semibold text-[#F59E0B] mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>Active Bottleneck</p>
                  <p className="text-xs text-[var(--ink-secondary)]">{exec.bottleneck}</p>
                </div>
              )}
            </RiskCategory>

            {/* Req 2: Compliance — guidance + CTA */}
            <RiskCategory icon={Shield} color="#8B5CF6" title="Compliance & Regulatory"
              hasData={regulatory.length > 0}>
              {regulatory.length > 0 ? (
                <div className="space-y-2">
                  {regulatory.map((r, i) => (
                    <div key={i} className="p-3 rounded-lg" style={{ background: '#8B5CF608', border: '1px solid #8B5CF625' }}>
                      <p className="text-xs text-[var(--ink-secondary)]">{r}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[var(--ink-secondary)]">
                    BIQc monitors GST compliance, payroll obligations, contract renewals and regulatory deadlines — but only when the right data sources are connected.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { label: 'Accounting (Xero/MYOB)', icon: DollarSign, desc: 'GST, BAS, payroll compliance', cat: 'financial', connected: hasAccounting },
                      { label: 'HR Platform', icon: Users, desc: 'Award obligations, leave compliance', cat: 'hris', connected: false },
                      { label: 'CRM (HubSpot)', icon: Shield, desc: 'Contract renewals, SLA obligations', cat: 'crm', connected: hasCRM },
                    ].map(item => (
                      <div key={item.label} className="p-2.5 rounded-lg"
                        style={{ background: item.connected ? 'rgba(16,185,129,0.06)' : 'var(--biqc-bg)', border: `1px solid ${item.connected ? 'rgba(16,185,129,0.2)' : 'rgba(140,170,210,0.15)'}` }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          {item.connected ? <CheckCircle2 className="w-3 h-3 text-[#10B981]" /> : <XCircle className="w-3 h-3 text-[var(--ink-muted)]" />}
                          <p className="text-[10px] font-semibold" style={{ color: item.connected ? '#10B981' : 'var(--ink-secondary)', fontFamily: 'var(--font-mono)' }}>{item.label}</p>
                        </div>
                        <p className="text-[10px] text-[var(--ink-muted)]">{item.desc}</p>
                        {!item.connected && (
                          <Link to={`/integrations?category=${item.cat}`} className="text-[9px] flex items-center gap-1 mt-1" style={{ color: '#E85D00', fontFamily: 'var(--font-mono)' }}>
                            Connect <ArrowRight className="w-2.5 h-2.5" />
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </RiskCategory>

            {/* Market Volatility */}
            <RiskCategory icon={TrendingDown} color="#3B82F6" title="Market Volatility"
              hasData={!!c.market_position?.volatility || !!c.market_position?.threats} noCTA>
              {c.market_position?.volatility && <p className="text-xs text-[var(--ink-secondary)]">{c.market_position.volatility}</p>}
            </RiskCategory>

            {/* Supplier Dependency */}
            <RiskCategory icon={Zap} color="#EF4444" title="Supplier Dependency"
              hasData={spofs.length > 0}>
              {spofs.length > 0 && (
                <div className="space-y-2">
                  {spofs.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-lg" style={{ background: '#EF444408', border: '1px solid #EF444425' }}>
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#EF4444' }} />
                      <p className="text-xs text-[var(--ink-secondary)]">{s}</p>
                    </div>
                  ))}
                </div>
              )}
            </RiskCategory>

            {/* Alignment contradictions */}
            {contradictions.length > 0 && (
              <Panel>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown className="w-4 h-4 text-[#F59E0B]" />
                  <h3 className="text-sm font-semibold text-[var(--ink-display)]" style={{ fontFamily: 'var(--font-display)' }}>Alignment Issues</h3>
                </div>
                <div className="space-y-2">
                  {contradictions.map((ct, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg" style={{ background: '#F59E0B08', border: '1px solid #F59E0B25' }}>
                      <p className="text-xs" style={{ color: '#F59E0B' }}>{ct}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </>
        )}

        {/* ═══ WORKFORCE INTELLIGENCE TAB ═══ */}
        {!loading && activeTab === 'workforce' && (
          <>
            {/* Req 4: Always show connection status + example metrics even when not connected */}
            <Panel>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#3B82F6]" />
                  <h3 className="text-sm font-semibold text-[var(--ink-display)]" style={{ fontFamily: 'var(--font-display)' }}>Data Sources</h3>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Outlook / Gmail', desc: 'Response times, email stress, communication patterns', icon: Mail, connected: hasEmail, cat: 'email' },
                  { label: 'Google / Outlook Calendar', desc: 'Meeting load, available capacity, overcommitment risk', icon: Calendar, connected: hasEmail, cat: 'email' },
                ].map(src => (
                  <div key={src.label} className="flex items-start gap-3 p-3 rounded-lg"
                    style={{ background: src.connected ? 'rgba(16,185,129,0.06)' : 'var(--biqc-bg)', border: `1px solid ${src.connected ? 'rgba(16,185,129,0.2)' : 'rgba(140,170,210,0.15)'}` }}>
                    <src.icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: src.connected ? '#10B981' : '#64748B' }} />
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-semibold" style={{ color: src.connected ? '#10B981' : 'var(--ink-secondary)', fontFamily: 'var(--font-mono)' }}>{src.label}</p>
                        {src.connected
                          ? <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', fontFamily: 'var(--font-mono)' }}>Connected</span>
                          : <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface-sunken, #F5F5F5)', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>Not connected</span>
                        }
                      </div>
                      <p className="text-[10px] text-[var(--ink-muted)]">{src.desc}</p>
                      {!src.connected && (
                        <Link to="/integrations?step=1" className="text-[9px] flex items-center gap-1 mt-1" style={{ color: '#E85D00', fontFamily: 'var(--font-mono)' }}>
                          Connect <ArrowRight className="w-2.5 h-2.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Sample metrics when not connected */}
            {!hasEmail && (
              <Panel>
                <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>Sample Insights — Unlock by Connecting Email & Calendar</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <ExampleMetric label="Avg Email Response Time" example="e.g. 4.2 hours (target: 2h)" color="#3B82F6" />
                  <ExampleMetric label="Meeting Load This Week" example="e.g. 14 meetings — above your avg of 9" color="#8B5CF6" />
                  <ExampleMetric label="Founder Fatigue Index" example="e.g. High — 3 consecutive 50h+ weeks" color="#EF4444" />
                  <ExampleMetric label="Key-Person Dependency" example="e.g. 73% of client comms via 1 person" color="#F59E0B" />
                  <ExampleMetric label="Unread Email Backlog" example="e.g. 47 unread — 8 from priority clients" color="#E85D00" />
                  <ExampleMetric label="Calendar Availability" example="e.g. 6hrs free time next 5 business days" color="#10B981" />
                </div>
                <Link to="/integrations?step=1"
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
                  style={{ background: '#E85D00', color: 'white', fontFamily: 'var(--font-ui)' }}>
                  <Plug className="w-4 h-4" /> Connect Email & Calendar to Unlock These Insights
                </Link>
              </Panel>
            )}

            {/* Real data when connected */}
            {hasPeopleData && (
              <>
                <Panel>
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-[#3B82F6]" />
                    <h3 className="text-sm font-semibold text-[var(--ink-display)]" style={{ fontFamily: 'var(--font-display)' }}>Live Capacity & Communication Signals</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <RiskMeter value={fv.capacity_index} label="Capacity Utilisation" thresholds={[80, 100]} insufficientData={fv.capacity_index == null} />
                    <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                      <span className="text-[10px] text-[var(--ink-muted)] block mb-1" style={{ fontFamily: 'var(--font-mono)' }}>Fatigue Level</span>
                      {fv.fatigue
                        ? <span className="text-xl font-bold" style={{ color: fv.fatigue === 'high' ? '#EF4444' : fv.fatigue === 'medium' ? '#F59E0B' : '#10B981', fontFamily: 'var(--font-mono)' }}>{fv.fatigue}</span>
                        : <span className="text-xs italic text-[var(--ink-muted)]">Insufficient data</span>
                      }
                    </div>
                    {fv.calendar && (
                      <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <span className="text-[10px] text-[var(--ink-muted)] block mb-1" style={{ fontFamily: 'var(--font-mono)' }}>Meeting Load (Outlook)</span>
                        <p className="text-xs text-[var(--ink-secondary)]">{fv.calendar}</p>
                      </div>
                    )}
                    {fv.email_stress && (
                      <div className="p-3 rounded-lg sm:col-span-2" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <span className="text-[10px] text-[var(--ink-muted)] block mb-1" style={{ fontFamily: 'var(--font-mono)' }}>Email Stress Signal</span>
                        <p className="text-xs text-[var(--ink-secondary)]">{fv.email_stress}</p>
                      </div>
                    )}
                  </div>
                </Panel>
                {fv.recommendation && (
                  <Panel>
                    <div className="flex items-start gap-3">
                      <Heart className="w-4 h-4 text-[#E85D00] shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--ink-display)] mb-1" style={{ fontFamily: 'var(--font-display)' }}>Workforce Advisory</h3>
                        <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">{fv.recommendation}</p>
                      </div>
                    </div>
                  </Panel>
                )}
              </>
            )}

            {hasEmail && !hasPeopleData && (
              <Panel className="text-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-[#10B981] mx-auto mb-2" />
                <p className="text-sm text-[var(--ink-display)] mb-1" style={{ fontFamily: 'var(--font-display)' }}>Processing workforce signals.</p>
                <p className="text-xs text-[var(--ink-muted)]">BIQc is analysing communication patterns and calendar density. Check back shortly.</p>
              </Panel>
            )}
          </>
        )}

        {/* ═══ CROSS-DOMAIN RISK TAB ═══ */}
        {!loading && activeTab === 'unified' && (
          <>
            {/* Req 5: Acronym legend */}
            <div className="flex justify-end">
              <button onClick={() => setShowAcronymLegend(v => !v)}
                className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', border: '1px solid rgba(140,170,210,0.15)' }}>
                <Info className="w-3 h-3" /> {showAcronymLegend ? 'Hide' : 'What do RVI, EDS, CDR, ADS mean?'}
              </button>
            </div>

            {showAcronymLegend && (
              <Panel>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#E85D00', fontFamily: 'var(--font-mono)' }}>Acronym Reference</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ACRONYMS.map(a => (
                    <div key={a.label} className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid rgba(140,170,210,0.15)' }}>
                      <p className="text-xs font-bold mb-0.5" style={{ color: '#E85D00', fontFamily: 'var(--font-mono)' }}>{a.label} — {a.title}</p>
                      <p className="text-[11px] text-[var(--ink-secondary)]">{a.desc}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {unifiedRisk?.instability_indices && (
              <Panel>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#EF4444]" />
                    <h3 className="text-sm font-semibold text-[var(--ink-display)]" style={{ fontFamily: 'var(--font-display)' }}>Instability Indices</h3>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: '#10B98115', color: '#10B981', fontFamily: 'var(--font-mono)' }}>COGNITION CORE</span>
                </div>
                <div className="mb-3" data-testid="risk-lineage-badge-unified-panel">
                  <LineageBadge lineage={riskIntelLineage} data_freshness={riskIntelFreshness} confidence_score={riskIntelConfidence} compact />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {ACRONYMS.map(({ key: _, label, title, desc }) => {
                    const keyMap = { RVI: 'revenue_volatility_index', EDS: 'engagement_decay_score', CDR: 'cash_deviation_ratio', ADS: 'anomaly_density_score' };
                    const val = unifiedRisk.instability_indices[keyMap[label]];
                    const pct = val != null ? Math.round(val * 100) : null;
                    const ic = pct > 60 ? '#EF4444' : pct > 30 ? '#F59E0B' : '#10B981';
                    const c2 = 2 * Math.PI * 18;
                    const off = c2 * (1 - (pct || 0) / 100);
                    return (
                      <Tooltip key={label} text={`${label}: ${title}\n\n${desc}`}>
                        <div className="p-4 rounded-lg text-center cursor-help w-full" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                          <div className="relative w-12 h-12 mx-auto mb-2">
                            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 40 40">
                              <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(140,170,210,0.15)" strokeWidth="3.5" />
                              {pct != null && <circle cx="20" cy="20" r="18" fill="none" stroke={ic} strokeWidth="3.5" strokeDasharray={c2} strokeDashoffset={off} strokeLinecap="round" />}
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[10px] font-bold" style={{ color: pct != null ? ic : '#64748B', fontFamily: 'var(--font-mono)' }}>
                                {pct != null ? pct + '%' : '—'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: pct != null ? ic : '#64748B', fontFamily: 'var(--font-mono)' }}>{label}</span>
                            <Info className="w-3 h-3" style={{ color: '#4A5568' }} />
                          </div>
                          <p className="text-[9px] mt-0.5" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>{title}</p>
                          {pct == null && <p className="text-[9px] italic" style={{ color: '#4A5568' }}>Insufficient data</p>}
                        </div>
                      </Tooltip>
                    );
                  })}
                </div>

                {/* Req 6: Composite score — "Insufficient data" not "Low" */}
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--biqc-text-2)', fontFamily: 'var(--font-display)' }}>Composite Risk Score</span>
                    <Tooltip text="Composite Risk Score combines RVI, EDS, CDR and ADS into a single risk rating. 'Insufficient data' means there is not yet enough connected data to compute a reliable score — this is not the same as Low risk.">
                      <Info className="w-3.5 h-3.5 cursor-help" style={{ color: '#4A5568' }} />
                    </Tooltip>
                  </div>
                  <span className="text-2xl font-bold" style={{ color: compositeColor, fontFamily: 'var(--font-mono)' }}>
                    {compositeDisplay}
                  </span>
                </div>
              </Panel>
            )}

            {/* Req 7: Clickable propagation chains with drill-down */}
            {unifiedRisk?.propagation_map?.length > 0 && (
              <Panel>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                    <h3 className="text-sm font-semibold text-[var(--ink-display)]" style={{ fontFamily: 'var(--font-display)' }}>Risk Propagation Analysis</h3>
                  </div>
                  <Tooltip text="Click any chain to see the underlying data driving that risk pathway and navigate to the relevant page.">
                    <span className="text-[10px] flex items-center gap-1 cursor-help" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                      <Info className="w-3 h-3" /> Click to expand
                    </span>
                  </Tooltip>
                </div>
                <p className="text-[11px] text-[var(--ink-muted)] mb-3">
                  These chains show how a risk in one area cascades to another. Click any row to see the contributing data and navigate to the detail view.
                </p>
                <div className="space-y-2">
                  {unifiedRisk.propagation_map.slice(0, 5).map((chain, i) => (
                    <PropagationChain key={i} chain={chain} cognitive={c} />
                  ))}
                </div>
              </Panel>
            )}

            {!unifiedRisk?.instability_indices && !unifiedRisk?.propagation_map && (
              <Panel className="text-center py-8">
                <Shield className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--ink-muted)' }} />
                <p className="text-sm font-semibold text-[var(--ink-secondary)] mb-1" style={{ fontFamily: 'var(--font-display)' }}>Cross-domain risk data not yet available.</p>
                <p className="text-xs text-[var(--ink-muted)] max-w-sm mx-auto">
                  Connect CRM, accounting and email to generate your cross-domain risk matrix. BIQc will then compute propagation chains and instability indices.
                </p>
                <Link to="/integrations" className="mt-4 inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                  style={{ background: '#E85D00', fontFamily: 'var(--font-ui)' }}>
                  <Plug className="w-4 h-4" /> Connect Integrations
                </Link>
              </Panel>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default RiskPage;
