import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Sparkles, Calendar, Activity } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { fontFamily, colors, radius } from '../design-system/tokens';

/* ─── Domain data ─── */
const DOMAINS = [
  {
    name: 'Revenue', score: 60, color: '#E85D00',
    status: 'below', statusLabel: 'Below Baseline',
    metrics: [
      { label: 'Pipeline', value: '$135K', baseline: '$220K', delta: '-38.6%', direction: 'down' },
      { label: 'Win Rate', value: '24%', baseline: '32%', delta: '-8%', direction: 'down' },
      { label: 'Avg Deal', value: '$18K', baseline: '$15K', delta: '+20%', direction: 'up' },
      { label: 'Cycle', value: '34d', baseline: '28d', delta: '+6d', direction: 'down' },
    ],
  },
  {
    name: 'Operations', score: 70, color: '#2563EB',
    status: 'declining', statusLabel: 'Declining',
    metrics: [
      { label: 'Invoice Cycle', value: '4.5d', baseline: '2.0d', delta: '+2.5d', direction: 'down' },
      { label: 'Meeting Load', value: '32/wk', baseline: '20/wk', delta: '+12', direction: 'down' },
      { label: 'Task Completion', value: '78%', baseline: '85%', delta: '-7%', direction: 'down' },
      { label: 'SLA Adherence', value: '82%', baseline: '90%', delta: '-8%', direction: 'down' },
    ],
  },
  {
    name: 'Customer', score: 75, color: '#16A34A',
    status: 'declining', statusLabel: 'Declining',
    metrics: [
      { label: 'Churn Risk', value: '3 accts', baseline: '1', delta: '+2', direction: 'down' },
      { label: 'NPS', value: '42', baseline: '48', delta: '-6', direction: 'down' },
      { label: 'MRR at Risk', value: '$4.5K', baseline: '$1K', delta: '+$3.5K', direction: 'down' },
      { label: 'Retention', value: '91%', baseline: '95%', delta: '-4%', direction: 'down' },
    ],
  },
  {
    name: 'Financial', score: 68, color: '#F59E0B',
    status: 'below', statusLabel: 'Below Baseline',
    metrics: [
      { label: 'Runway', value: '4.2mo', baseline: '6mo', delta: '-1.8mo', direction: 'down' },
      { label: 'Burn Rate', value: '$38K', baseline: '$32K', delta: '+$6K', direction: 'down' },
      { label: 'Gross Margin', value: '71%', baseline: '74%', delta: '-3%', direction: 'down' },
      { label: 'Collections', value: '28d', baseline: '21d', delta: '+7d', direction: 'down' },
    ],
  },
  {
    name: 'Compliance', score: 88, color: '#7C3AED',
    status: 'at', statusLabel: 'At Baseline',
    metrics: [
      { label: 'Privacy', value: '92%', baseline: '90%', delta: '+2%', direction: 'up' },
      { label: 'E8', value: '95%', baseline: '92%', delta: '+3%', direction: 'up' },
      { label: 'BAS', value: '68%', baseline: '70%', delta: '-2%', direction: 'down' },
      { label: 'ASIC', value: '100%', baseline: '100%', delta: '0%', direction: 'flat' },
    ],
  },
  {
    name: 'Security', score: 93, color: '#0891B2',
    status: 'above', statusLabel: 'Above Baseline',
    metrics: [
      { label: 'MFA', value: '88%', baseline: '85%', delta: '+3%', direction: 'up' },
      { label: 'Access Review', value: '100%', baseline: '100%', delta: '0%', direction: 'flat' },
      { label: 'Data Encrypt', value: '100%', baseline: '100%', delta: '0%', direction: 'flat' },
      { label: 'Vuln Scan', value: 'Weekly', baseline: 'Weekly', delta: 'on track', direction: 'flat' },
    ],
  },
];

const CALIBRATION_HISTORY = [
  { date: 'Apr 1, 2026', type: 'Quarterly', revenue: { val: 60, color: '#DC2626' }, operations: { val: 70, color: '#D97706' }, customer: { val: 75, color: '#D97706' }, compliance: { val: 88, color: '#16A34A' } },
  { date: 'Jan 1, 2026', type: 'Quarterly', revenue: { val: 78 }, operations: { val: 82 }, customer: { val: 84 }, compliance: { val: 85 } },
  { date: 'Oct 1, 2025', type: 'Quarterly', revenue: { val: 74 }, operations: { val: 80 }, customer: { val: 82 }, compliance: { val: 80 } },
  { date: 'Jul 1, 2025', type: 'Initial', revenue: { val: 70 }, operations: { val: 75 }, customer: { val: 78 }, compliance: { val: 72 } },
];

/* ─── Status badge colors (dark theme) ─── */
const STATUS_STYLES = {
  above:    { bg: 'rgba(22,163,74,0.15)', color: '#4ADE80', border: 'rgba(22,163,74,0.3)' },
  at:       { bg: 'rgba(37,99,235,0.15)', color: '#60A5FA', border: 'rgba(37,99,235,0.3)' },
  below:    { bg: 'rgba(245,158,11,0.15)', color: '#FBBF24', border: 'rgba(245,158,11,0.3)' },
  declining:{ bg: 'rgba(220,38,38,0.15)', color: '#F87171', border: 'rgba(220,38,38,0.3)' },
};

/* ─── Delta icon ─── */
const DeltaIcon = ({ direction }) => {
  if (direction === 'up') return <TrendingUp style={{ width: 12, height: 12, color: colors.success }} />;
  if (direction === 'down') return <TrendingDown style={{ width: 12, height: 12, color: colors.danger }} />;
  return <Minus style={{ width: 12, height: 12, color: colors.textMuted }} />;
};

/* ─── Domain Card ─── */
const DomainCard = ({ domain }) => {
  const sts = STATUS_STYLES[domain.status];
  return (
    <div
      style={{
        background: colors.bgCard,
        border: `1px solid rgba(140,170,210,0.12)`,
        borderRadius: radius.card,
        padding: 20,
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(140,170,210,0.25)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(140,170,210,0.12)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Head: name + score */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: fontFamily.body, fontWeight: 600, fontSize: 15, color: colors.text }}>{domain.name}</span>
        <span style={{ fontFamily: fontFamily.display, fontWeight: 700, fontSize: 28, color: domain.color, lineHeight: 1 }}>{domain.score}</span>
      </div>

      {/* Status badge */}
      <div style={{ marginBottom: 12 }}>
        <span style={{
          display: 'inline-block',
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
          padding: '3px 10px', borderRadius: 9999,
          background: sts.bg, color: sts.color, border: `1px solid ${sts.border}`,
        }}>
          {domain.statusLabel}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: colors.bgInput, borderRadius: 9999, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ height: '100%', width: `${domain.score}%`, background: domain.color, borderRadius: 9999, transition: 'width 0.6s ease' }} />
      </div>

      {/* 4 metrics (2x2 grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {domain.metrics.map((m, i) => (
          <div key={i} style={{ padding: '6px 0' }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.textMuted, marginBottom: 2, fontFamily: fontFamily.mono }}>
              {m.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: fontFamily.mono, fontSize: 14, fontWeight: 600, color: colors.text }}>{m.value}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, color: m.direction === 'up' ? colors.success : m.direction === 'down' ? colors.danger : colors.textMuted }}>
                <DeltaIcon direction={m.direction} />
                {m.delta}
              </span>
            </div>
            {m.baseline && (
              <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 1, fontFamily: fontFamily.body }}>
                Baseline: {m.baseline}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Main Page ─── */
const IntelligenceBaselinePage = () => {
  const [hoveredRow, setHoveredRow] = useState(null);

  return (
    <DashboardLayout>
      <div data-testid="intelligence-baseline-page" style={{ minHeight: '100vh', background: colors.bg, color: colors.textSecondary }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '40px 24px' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
            <h1 style={{ fontFamily: fontFamily.display, fontSize: 28, fontWeight: 700, color: colors.text, letterSpacing: '-0.02em', margin: 0 }}>
              Intelligence Baseline
            </h1>
            <button
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: radius.button, border: 'none',
                background: `linear-gradient(135deg, ${colors.brand}, ${colors.brandDark})`,
                color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                transition: 'box-shadow 0.2s, transform 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(232,93,0,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
            >
              <Activity style={{ width: 16, height: 16 }} />
              Recalibrate
            </button>
          </div>
          <p style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 1.5, maxWidth: 640, marginBottom: 32, marginTop: 0 }}>
            Your intelligence baseline is a personalised benchmark that BIQc uses to detect drift, anomalies, and emerging patterns. It recalibrates quarterly.
          </p>

          {/* AI Insight Banner */}
          <div style={{
            background: `linear-gradient(135deg, rgba(232,93,0,0.08) 0%, ${colors.bgCard} 40%)`,
            border: `1px solid rgba(140,170,210,0.12)`,
            borderLeft: `3px solid ${colors.brand}`,
            borderRadius: radius.card,
            padding: 20, marginBottom: 32,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Sparkles style={{ width: 16, height: 16, color: colors.brand }} />
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: colors.brand }}>
                Baseline Intelligence
              </span>
            </div>
            <p style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 1.6, margin: 0 }}>
              <strong style={{ color: colors.text }}>Operations and Financial domains show below-baseline drift</strong> this quarter.
              Revenue dropped from 78 to 60 (driven by Bramwell stall + pipeline decay). Operations dropped from 82 to 70
              (invoice approval bottleneck). Both crossed their alert thresholds — your Watchtower and WarRoom escalations are
              calibrated to these baselines.
            </p>
          </div>

          {/* 6 Domain Baseline Cards (3x2 grid) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16, marginBottom: 40,
          }}>
            {DOMAINS.map(d => <DomainCard key={d.name} domain={d} />)}
          </div>

          {/* Responsive override for the grid (injected as a style tag) */}
          <style>{`
            @media (max-width: 900px) {
              [data-testid="intelligence-baseline-page"] > div > div:nth-child(4) {
                grid-template-columns: repeat(2, 1fr) !important;
              }
            }
            @media (max-width: 600px) {
              [data-testid="intelligence-baseline-page"] > div > div:nth-child(4) {
                grid-template-columns: 1fr !important;
              }
            }
            @media (max-width: 767px) {
              .ib-table-wrap th:nth-child(4),
              .ib-table-wrap td:nth-child(4),
              .ib-table-wrap th:nth-child(5),
              .ib-table-wrap td:nth-child(5),
              .ib-table-wrap th:nth-child(6),
              .ib-table-wrap td:nth-child(6) { display: none; }
            }
          `}</style>

          {/* Calibration History Table */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Calendar style={{ width: 18, height: 18, color: colors.textMuted }} />
              <h2 style={{ fontFamily: fontFamily.display, fontSize: 22, fontWeight: 700, color: colors.text, margin: 0 }}>
                Calibration History
              </h2>
            </div>
            <div className="ib-table-wrap" style={{
              background: colors.bgCard,
              border: `1px solid rgba(140,170,210,0.12)`,
              borderRadius: radius.card,
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Date', 'Type', 'Revenue', 'Operations', 'Customer', 'Compliance'].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '12px 16px',
                        fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
                        color: colors.textMuted, background: colors.bgInput,
                        borderBottom: '1px solid rgba(140,170,210,0.12)',
                        fontFamily: fontFamily.mono,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CALIBRATION_HISTORY.map((row, i) => (
                    <tr
                      key={i}
                      onMouseEnter={() => setHoveredRow(i)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{ background: hoveredRow === i ? colors.bgInput : 'transparent', transition: 'background 0.15s' }}
                    >
                      <td style={{
                        padding: '12px 16px', fontSize: 14, fontWeight: 500,
                        color: colors.text,
                        borderBottom: i < CALIBRATION_HISTORY.length - 1 ? '1px solid rgba(140,170,210,0.06)' : 'none',
                      }}>
                        {row.date}
                      </td>
                      <td style={{
                        padding: '12px 16px', fontSize: 14, color: colors.textSecondary,
                        borderBottom: i < CALIBRATION_HISTORY.length - 1 ? '1px solid rgba(140,170,210,0.06)' : 'none',
                      }}>
                        {row.type}
                      </td>
                      {[row.revenue, row.operations, row.customer, row.compliance].map((cell, ci) => (
                        <td key={ci} style={{
                          padding: '12px 16px',
                          borderBottom: i < CALIBRATION_HISTORY.length - 1 ? '1px solid rgba(140,170,210,0.06)' : 'none',
                        }}>
                          <span style={{
                            fontFamily: fontFamily.mono, fontSize: 14, fontWeight: 700,
                            color: cell.color || colors.text,
                          }}>
                            {cell.val}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default IntelligenceBaselinePage;
