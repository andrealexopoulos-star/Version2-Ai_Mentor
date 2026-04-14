import React, { useState, useMemo, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
/* fontFamily import removed — using CSS custom properties */
import { apiClient } from '../lib/api';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { Shield, ChevronDown } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   SEVERITY CONFIG
   ═══════════════════════════════════════════════════════════════════════════ */
const SEVERITY_COLORS = {
  critical: 'var(--danger)',
  high:     'var(--warning)',
  medium:   'var(--info)',
  low:      'var(--positive)',
};

const SEVERITY_BADGE_STYLES = {
  critical: { background: 'var(--danger-wash)', color: 'var(--danger)' },
  high:     { background: 'var(--warning-wash)', color: 'var(--warning)' },
  medium:   { background: 'var(--info-wash)', color: 'var(--info)' },
  low:      { background: 'var(--positive-wash)', color: 'var(--positive)' },
};

const scoreClass = (val) => {
  if (val >= 80) return 'good';
  if (val >= 60) return 'warn';
  return 'bad';
};

const SCORE_STROKE = { good: 'var(--positive)', warn: 'var(--warning)', bad: 'var(--danger)' };

/* ═══════════════════════════════════════════════════════════════════════════
   DEMO DATA
   ═══════════════════════════════════════════════════════════════════════════ */
const DEMO_OVERALL_SCORE = 77;

const DEMO_SCORE_BARS = [
  { label: 'Data Security',  score: 92 },
  { label: 'Financial',      score: 71 },
  { label: 'Operational',    score: 68 },
  { label: 'Reputation',     score: 85 },
  { label: 'Compliance',     score: 88 },
  { label: 'Supply Chain',   score: 58 },
];

const DEMO_FINDINGS = [
  {
    id: 1,
    severity: 'critical',
    domain: 'Supply Chain',
    title: 'Single-vendor dependency \u2014 Bramwell Holdings represents 31% of pipeline value',
    description: 'Bramwell Holdings ($42K) accounts for 31% of your total active pipeline ($127K). If this deal falls through, Q2 revenue targets become unrecoverable without 3+ new enterprise deals entering the pipeline within 14 days. Concentration risk is well above the 20% threshold.',
    actions: [
      { label: 'Create mitigation plan', primary: true },
      { label: 'Ask BoardRoom', primary: false },
      { label: 'Dismiss', primary: false },
    ],
    detected: 'Detected 2 days ago',
  },
  {
    id: 2,
    severity: 'high',
    domain: 'Financial',
    title: 'Cash runway below 6-month safety threshold',
    description: 'Current runway of 4.2 months at $38K/mo burn rate is below the recommended 6-month minimum for businesses your size. A single large unexpected expense or delayed payment could trigger a cash crisis. Burn rate has increased 12% this quarter.',
    actions: [
      { label: 'View cash flow analysis', primary: true },
      { label: 'Ask BoardRoom', primary: false },
      { label: 'Acknowledge', primary: false },
    ],
    detected: 'Detected 5 days ago',
  },
  {
    id: 3,
    severity: 'high',
    domain: 'Operational',
    title: 'Invoice approval bottleneck \u2014 avg 4.5 day delay costing $8K/mo in late payments',
    description: 'The invoice approval process averages 4.5 days per approval against a 2-day target. 3 invoices over $5K are currently stalled at the manager approval stage. Late payment fees and supplier relationship damage estimated at $8K/mo.',
    actions: [
      { label: 'Generate SOP fix', primary: true },
      { label: 'View process', primary: false },
      { label: 'Acknowledge', primary: false },
    ],
    detected: 'Detected 1 week ago',
  },
  {
    id: 4,
    severity: 'medium',
    domain: 'Reputation',
    title: '3 customer accounts showing churn signals \u2014 $4,500 MRR at risk',
    description: 'Login frequency, support ticket tone, and feature usage patterns indicate elevated churn risk for 3 accounts totalling $4,500 MRR. Two have not logged in for 14+ days. One submitted a negative NPS response last week.',
    actions: [
      { label: 'View at-risk accounts', primary: true },
      { label: 'Ask BoardRoom', primary: false },
    ],
    detected: 'Detected 3 days ago',
  },
  {
    id: 5,
    severity: 'medium',
    domain: 'Compliance',
    title: 'Privacy policy not updated for Australian Privacy Act amendments',
    description: 'Your privacy policy was last updated 8 months ago. Recent amendments to the Australian Privacy Act require updated data breach notification timelines and consent mechanisms. Non-compliance risk increases after the July 2026 enforcement date.',
    actions: [
      { label: 'Generate update checklist', primary: true },
      { label: 'Acknowledge', primary: false },
    ],
    detected: 'Detected 2 weeks ago',
  },
  {
    id: 6,
    severity: 'low',
    domain: 'Data Security',
    title: '2 team members have not enabled MFA on their accounts',
    description: 'Marcus Chen and a contractor account have not activated multi-factor authentication. While current access is password-protected, MFA is recommended as a baseline security measure for all team members.',
    actions: [
      { label: 'Send reminder', primary: true },
      { label: 'Dismiss', primary: false },
    ],
    detected: 'Detected 3 weeks ago',
  },
];

const DEMO_SCAN_HISTORY = [
  { date: '10 Apr 2026, 06:00', score: 77, findings: '6 findings (1 critical, 2 high, 2 medium, 1 low)', link: 'Current' },
  { date: '09 Apr 2026, 06:00', score: 74, findings: '7 findings (1 critical, 3 high, 2 medium, 1 low)', link: 'View report' },
  { date: '08 Apr 2026, 06:00', score: 72, findings: '8 findings (2 critical, 3 high, 2 medium, 1 low)', link: 'View report' },
  { date: '07 Apr 2026, 06:00', score: 70, findings: '8 findings (2 critical, 3 high, 2 medium, 1 low)', link: 'View report' },
  { date: '03 Apr 2026, 06:00', score: 81, findings: '4 findings (0 critical, 2 high, 1 medium, 1 low)', link: 'View report' },
];

/* ═══════════════════════════════════════════════════════════════════════════
   SCORE RING SVG
   ═══════════════════════════════════════════════════════════════════════════ */
const CIRCUMFERENCE = 2 * Math.PI * 52; // r=52 => ~326.73

const ScoreRing = ({ score }) => {
  const cls = scoreClass(score);
  const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;

  return (
    <div style={{ position: 'relative', width: 160, height: 160 }}>
      <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle
          cx="60" cy="60" r="52"
          fill="none"
          stroke="var(--border)"
          strokeWidth="8"
        />
        <circle
          cx="60" cy="60" r="52"
          fill="none"
          stroke={SCORE_STROKE[cls]}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 700,
          color: 'var(--ink-display)', lineHeight: 1,
        }}>
          {score}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-secondary)', marginTop: 4 }}>out of 100</div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SCORE BAR
   ═══════════════════════════════════════════════════════════════════════════ */
const ScoreBar = ({ label, score }) => {
  const cls = scoreClass(score);
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '120px 1fr 40px',
      alignItems: 'center', gap: 12,
    }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}>
        {label}
      </div>
      <div style={{
        height: 8, background: 'var(--border-subtle)', borderRadius: 4, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 4, width: `${score}%`,
          background: SCORE_STROKE[cls],
          transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600,
        color: 'var(--ink-display)', textAlign: 'right',
      }}>
        {score}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   FINDING CARD
   ═══════════════════════════════════════════════════════════════════════════ */
const FindingCard = ({ finding, onAction }) => {
  const borderColor = SEVERITY_COLORS[finding.severity] || 'var(--border)';
  const badgeStyle = SEVERITY_BADGE_STYLES[finding.severity] || {};

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: 'var(--r-xl)', padding: 20,
      transition: 'box-shadow 0.15s ease',
      boxShadow: 'var(--elev-1)',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--elev-2)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--elev-1)'; }}
    >
      {/* Head */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 12, gap: 12,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
          padding: '3px 8px', borderRadius: 9999, whiteSpace: 'nowrap',
          ...badgeStyle,
        }}>
          {finding.severity}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
          color: 'var(--ink-secondary)',
        }}>
          {finding.domain}
        </span>
      </div>

      {/* Title */}
      <div style={{
        fontSize: 15, fontWeight: 600, color: 'var(--ink-display)', marginBottom: 8,
        fontFamily: 'var(--font-ui)',
      }}>
        {finding.title}
      </div>

      {/* Description */}
      <div style={{
        fontSize: 14, color: 'var(--ink-secondary)', lineHeight: 1.5, marginBottom: 16,
        fontFamily: 'var(--font-ui)',
      }}>
        {finding.description}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {finding.actions.map((action, i) => (
          <button
            key={i}
            onClick={() => onAction(finding, action.label)}
            style={{
              padding: '6px 14px', borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 500,
              border: action.primary ? 'none' : '1px solid var(--border)',
              background: action.primary ? 'var(--lava-wash)' : 'transparent',
              color: action.primary ? 'var(--lava-deep)' : 'var(--ink-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              fontFamily: 'var(--font-ui)',
            }}
            onMouseEnter={(e) => {
              if (action.primary) {
                e.currentTarget.style.background = 'var(--lava)';
                e.currentTarget.style.color = 'white';
              } else {
                e.currentTarget.style.borderColor = 'var(--lava)';
                e.currentTarget.style.color = 'var(--lava)';
              }
            }}
            onMouseLeave={(e) => {
              if (action.primary) {
                e.currentTarget.style.background = 'var(--lava-wash)';
                e.currentTarget.style.color = 'var(--lava-deep)';
              } else {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--ink-secondary)';
              }
            }}
          >
            {action.label}
          </button>
        ))}
        <span style={{
          marginLeft: 'auto', fontSize: 12, color: 'var(--ink-muted)',
          fontFamily: 'var(--font-ui)',
        }}>
          {finding.detected}
        </span>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   FILTER PILLS
   ═══════════════════════════════════════════════════════════════════════════ */
const FILTER_OPTIONS = ['all', 'critical', 'high', 'medium', 'low'];

const FilterPills = ({ active, onChange }) => (
  <div style={{ display: 'flex', gap: 4 }}>
    {FILTER_OPTIONS.map((sev) => {
      const isActive = active === sev;
      return (
        <button
          key={sev}
          onClick={() => onChange(sev)}
          style={{
            padding: '6px 14px', borderRadius: 'var(--r-pill)',
            fontSize: 12, fontWeight: 500,
            border: isActive ? '1px solid var(--lava)' : '1px solid var(--border)',
            background: isActive ? 'var(--lava)' : 'transparent',
            color: isActive ? 'white' : 'var(--ink-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            textTransform: 'capitalize',
            fontFamily: 'var(--font-ui)',
          }}
          onMouseEnter={(e) => {
            if (!isActive) {
              e.currentTarget.style.borderColor = 'var(--border-strong)';
              e.currentTarget.style.color = 'var(--ink-display)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--ink-secondary)';
            }
          }}
        >
          {sev}
        </button>
      );
    })}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   SCAN HISTORY ROW
   ═══════════════════════════════════════════════════════════════════════════ */
const ScanRow = ({ row }) => {
  const cls = scoreClass(row.score);
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '140px 80px 1fr 100px',
      alignItems: 'center', gap: 12,
      padding: '12px 0',
      borderBottom: '1px solid var(--border-subtle)',
      fontSize: 14,
    }}>
      <div style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        {row.date}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontWeight: 700,
        color: SCORE_STROKE[cls],
      }}>
        {row.score}
      </div>
      <div style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
        {row.findings}
      </div>
      <div style={{
        color: 'var(--lava)', fontWeight: 500, textAlign: 'right',
        cursor: row.link !== 'Current' ? 'pointer' : 'default',
        fontFamily: 'var(--font-ui)',
      }}>
        {row.link}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
const ExposureScanPage = () => {
  const { user } = useSupabaseAuth();
  const [severityFilter, setSeverityFilter] = useState('all');
  const [scanning, setScanning] = useState(false);

  // Filter findings
  const filteredFindings = useMemo(() => {
    if (severityFilter === 'all') return DEMO_FINDINGS;
    return DEMO_FINDINGS.filter((f) => f.severity === severityFilter);
  }, [severityFilter]);

  // Handle finding action clicks
  const handleAction = useCallback((finding, actionLabel) => {
    console.log('Action:', actionLabel, 'on finding:', finding.title);
  }, []);

  // Handle scan button
  const handleRunScan = useCallback(() => {
    setScanning(true);
    setTimeout(() => setScanning(false), 3000);
  }, []);

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24, flexWrap: 'wrap', gap: 12,
        }}>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 28,
            color: 'var(--ink-display)', letterSpacing: '-0.01em',
            margin: 0,
          }}>
            Exposure Scan
          </h1>
          <button
            onClick={handleRunScan}
            disabled={scanning}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 8,
              background: scanning
                ? 'var(--lava-wash)'
                : 'linear-gradient(135deg, var(--lava), var(--lava-warm))',
              color: 'white', fontSize: 14, fontWeight: 600,
              border: 'none', cursor: scanning ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              fontFamily: 'var(--font-ui)',
              boxShadow: scanning ? 'none' : undefined,
            }}
            onMouseEnter={(e) => {
              if (!scanning) e.currentTarget.style.boxShadow = '0 4px 16px var(--lava-ring)';
              if (!scanning) e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Shield size={16} />
            {scanning ? 'Scanning\u2026' : 'Run New Scan'}
          </button>
        </div>

        {/* ── SCORE HERO ─────────────────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '200px 1fr',
          gap: 24, alignItems: 'center',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)', padding: 24,
          marginBottom: 24,
          boxShadow: 'var(--elev-1)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ScoreRing score={DEMO_OVERALL_SCORE} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: 22,
                color: 'var(--ink-display)', marginBottom: 4,
              }}>
                Business Exposure Score
              </div>
              <div style={{
                fontSize: 14, color: 'var(--ink-secondary)', marginBottom: 8,
                fontFamily: 'var(--font-ui)',
              }}>
                Last scanned 4 hours ago across 6 domains. 3 findings require attention.
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {DEMO_SCORE_BARS.map((bar) => (
                <ScoreBar key={bar.label} label={bar.label} score={bar.score} />
              ))}
            </div>
          </div>
        </div>

        {/* ── FINDINGS HEADER + FILTER ─────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 22,
            color: 'var(--ink-display)', margin: 0,
          }}>
            Active Findings
          </h2>
          <FilterPills active={severityFilter} onChange={setSeverityFilter} />
        </div>

        {/* ── FINDING CARDS ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
          {filteredFindings.length === 0 ? (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-xl)', padding: 32, textAlign: 'center',
              color: 'var(--ink-secondary)', fontSize: 14, fontFamily: 'var(--font-ui)',
            }}>
              No findings at this severity level.
            </div>
          ) : (
            filteredFindings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} onAction={handleAction} />
            ))
          )}
        </div>

        {/* ── SCAN HISTORY ─────────────────────────────────────────── */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)', padding: 20,
          marginBottom: 24,
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 20,
            color: 'var(--ink-display)', marginTop: 0, marginBottom: 16,
          }}>
            Scan History
          </h2>
          {DEMO_SCAN_HISTORY.map((row, i) => (
            <ScanRow key={i} row={row} />
          ))}
        </div>

      </div>
    </DashboardLayout>
  );
};

export default ExposureScanPage;
