import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Sparkles, Calendar, Activity, Loader2, AlertCircle } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';

/* --- Domain display config --- */
const DOMAIN_CONFIG = {
  revenue:    { label: 'Revenue',    color: 'var(--lava)' },
  operations: { label: 'Operations', color: 'var(--info)' },
  customer:   { label: 'Customer',   color: 'var(--positive)' },
  finance:    { label: 'Financial',  color: 'var(--warning)' },
  financial:  { label: 'Financial',  color: 'var(--warning)' },
  compliance: { label: 'Compliance', color: 'var(--purple)' },
  security:   { label: 'Security',   color: 'var(--cyan)' },
  strategy:   { label: 'Strategy',   color: 'var(--lava)' },
  retention:  { label: 'Retention',  color: 'var(--purple)' },
  peoplerisk: { label: 'People Risk', color: 'var(--danger)' },
  team:       { label: 'Team',       color: 'var(--purple)' },
  market:     { label: 'Market',     color: 'var(--info)' },
  sales:      { label: 'Sales',      color: 'var(--positive)' },
};

function scoreToStatus(score) {
  if (score == null) return { key: 'unknown', label: 'No Data' };
  if (score >= 85) return { key: 'above', label: 'Above Baseline' };
  if (score >= 75) return { key: 'at', label: 'At Baseline' };
  if (score >= 60) return { key: 'below', label: 'Below Baseline' };
  return { key: 'declining', label: 'Declining' };
}

/* --- Status badge colors (dark theme) --- */
const STATUS_STYLES = {
  above:    { bg: 'var(--positive-wash)', color: 'var(--positive)', border: 'var(--positive)' },
  at:       { bg: 'var(--info-wash)', color: 'var(--info)', border: 'var(--info)' },
  below:    { bg: 'var(--warning-wash)', color: 'var(--warning)', border: 'var(--warning)' },
  declining:{ bg: 'var(--danger-wash)', color: 'var(--danger)', border: 'var(--danger)' },
  unknown:  { bg: 'var(--surface-sunken)', color: 'var(--ink-muted)', border: 'var(--border)' },
};

/* --- Delta icon --- */
const DeltaIcon = ({ direction }) => {
  if (direction === 'up') return <TrendingUp style={{ width: 12, height: 12, color: 'var(--positive)' }} />;
  if (direction === 'down') return <TrendingDown style={{ width: 12, height: 12, color: 'var(--danger)' }} />;
  return <Minus style={{ width: 12, height: 12, color: 'var(--ink-muted)' }} />;
};

/* --- Domain Card --- */
const DomainCard = ({ domain }) => {
  const sts = STATUS_STYLES[domain.status] || STATUS_STYLES.unknown;
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: 20,
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.boxShadow = 'var(--elev-1)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Head: name + score */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 15, color: 'var(--ink-display)' }}>{domain.name}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, color: domain.color, lineHeight: 1 }}>
          {domain.score != null ? domain.score : '--'}
        </span>
      </div>

      {/* Status badge */}
      <div style={{ marginBottom: 12 }}>
        <span style={{
          display: 'inline-block',
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)',
          padding: '3px 10px', borderRadius: 'var(--r-pill)',
          background: sts.bg, color: sts.color, border: '1px solid ' + sts.border,
        }}>
          {domain.statusLabel}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: 'var(--surface-sunken)', borderRadius: 'var(--r-pill)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ height: '100%', width: (domain.score != null ? domain.score : 0) + '%', background: domain.color, borderRadius: 'var(--r-pill)', transition: 'width 0.6s ease' }} />
      </div>

      {/* 4 metrics (2x2 grid) */}
      {domain.metrics && domain.metrics.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {domain.metrics.map((m, i) => (
            <div key={i} style={{ padding: '6px 0' }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)', color: 'var(--ink-muted)', marginBottom: 2, fontFamily: 'var(--font-mono)' }}>
                {m.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--ink-display)' }}>{m.value}</span>
                {m.delta && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, color: m.direction === 'up' ? 'var(--positive)' : m.direction === 'down' ? 'var(--danger)' : 'var(--ink-muted)' }}>
                    <DeltaIcon direction={m.direction} />
                    {m.delta}
                  </span>
                )}
              </div>
              {m.baseline && (
                <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 1, fontFamily: 'var(--font-ui)' }}>
                  Baseline: {m.baseline}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)', textAlign: 'center', padding: '8px 0' }}>
          Connect data sources to see domain metrics.
        </div>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------
   BUILD DOMAINS FROM SNAPSHOT DATA
   --------------------------------------------------------------- */
function buildDomainsFromSnapshot(cognitive) {
  if (!cognitive) return [];

  const domains = [];

  // Try to extract domain scores from various snapshot structures
  // 1. Check resolution_queue for domain-level signals
  const rq = cognitive.resolution_queue || [];
  const openRisks = cognitive.open_risks || [];

  // 2. Check system_state for domain scores
  const systemState = cognitive.system_state || {};

  // 3. Check for direct domain scores in the cognitive object
  const knownDomains = ['revenue', 'operations', 'customer', 'finance', 'financial', 'compliance', 'security', 'strategy', 'retention', 'team', 'market', 'sales'];

  // Build a score map from available data
  const scoreMap = {};

  // Check if cognitive has direct domain data
  for (const key of knownDomains) {
    if (cognitive[key] && typeof cognitive[key] === 'object') {
      const domainData = cognitive[key];
      const score = domainData.score || domainData.health_score || domainData.baseline_score;
      if (score != null) {
        scoreMap[key] = { score: Math.round(score), data: domainData };
      }
    }
  }

  // Check system_state for domain scores
  if (systemState.domain_scores && typeof systemState.domain_scores === 'object') {
    for (const [key, val] of Object.entries(systemState.domain_scores)) {
      const k = key.toLowerCase();
      if (!scoreMap[k]) {
        scoreMap[k] = { score: typeof val === 'number' ? Math.round(val) : (val?.score ? Math.round(val.score) : null), data: typeof val === 'object' ? val : {} };
      }
    }
  }

  // Check execution for ops-related data
  const exec = cognitive.execution || {};
  if (exec.sla_breaches != null || exec.task_aging != null) {
    if (!scoreMap.operations) {
      const opsScore = exec.task_aging != null ? Math.max(0, 100 - exec.task_aging) : null;
      scoreMap.operations = { score: opsScore, data: exec };
    }
  }

  // Check founder_vitals for people-related data
  const vitals = cognitive.founder_vitals || {};

  // Map resolution_queue items to domain severity
  const domainSeverity = {};
  [...rq, ...openRisks].forEach(item => {
    const d = (item.domain || '').toLowerCase();
    if (!domainSeverity[d]) domainSeverity[d] = [];
    domainSeverity[d].push(item.severity || 'info');
  });

  // If we have no scores at all but have resolution queue items, derive basic domains
  if (Object.keys(scoreMap).length === 0 && (rq.length > 0 || openRisks.length > 0)) {
    const seenDomains = new Set();
    [...rq, ...openRisks].forEach(item => {
      const d = (item.domain || '').toLowerCase();
      if (d && !seenDomains.has(d)) {
        seenDomains.add(d);
        scoreMap[d] = { score: null, data: {} };
      }
    });
  }

  // Build domain cards
  for (const [key, { score, data }] of Object.entries(scoreMap)) {
    const config = DOMAIN_CONFIG[key] || { label: key.charAt(0).toUpperCase() + key.slice(1), color: 'var(--ink-muted)' };
    const status = scoreToStatus(score);

    // Build metrics from available data
    const metrics = [];
    if (data && typeof data === 'object') {
      // Extract up to 4 meaningful metrics from domain data
      const metricKeys = Object.keys(data).filter(k =>
        !['score', 'health_score', 'baseline_score', 'domain', 'status'].includes(k)
        && (typeof data[k] === 'number' || typeof data[k] === 'string')
      ).slice(0, 4);

      metricKeys.forEach(mk => {
        const val = data[mk];
        metrics.push({
          label: mk.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          value: typeof val === 'number' ? String(val) : val,
          direction: 'flat',
        });
      });
    }

    domains.push({
      name: config.label,
      score,
      color: config.color,
      status: status.key,
      statusLabel: status.label,
      metrics,
    });
  }

  // If no domains found at all, return empty
  return domains;
}

/* ---------------------------------------------------------------
   Main Page
   --------------------------------------------------------------- */
const IntelligenceBaselinePage = () => {
  const [domains, setDomains] = useState([]);
  const [insightText, setInsightText] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [snapshotRes, cognitionRes] = await Promise.allSettled([
          apiClient.get('/snapshot/latest', { timeout: 10000 }),
          apiClient.get('/cognition/overview', { timeout: 10000 }),
        ]);

        if (cancelled) return;

        let cognitive = null;
        let cogOverview = null;

        if (snapshotRes.status === 'fulfilled') {
          cognitive = snapshotRes.value.data?.cognitive;
        }
        if (cognitionRes.status === 'fulfilled') {
          cogOverview = cognitionRes.value.data;
        }

        // Build domains from snapshot data
        const builtDomains = buildDomainsFromSnapshot(cognitive);
        setDomains(builtDomains);

        // Build insight text
        if (cognitive) {
          const memo = cognitive.executive_memo;
          const rq = cognitive.resolution_queue || [];
          const openRisks = cognitive.open_risks || [];

          if (memo) {
            setInsightText(memo);
          } else if (builtDomains.length > 0) {
            const belowDomains = builtDomains.filter(d => d.status === 'below' || d.status === 'declining');
            if (belowDomains.length > 0) {
              setInsightText(
                belowDomains.map(d => d.name).join(' and ')
                + (belowDomains.length === 1 ? ' shows' : ' show')
                + ' below-baseline drift this period. Review signals in each domain for recommended actions.'
              );
            } else if (rq.length > 0 || openRisks.length > 0) {
              setInsightText(
                (rq.length + openRisks.length) + ' active signal'
                + ((rq.length + openRisks.length) === 1 ? '' : 's')
                + ' detected across your intelligence baseline.'
              );
            }
          }
        }

        // Merge cognition overview data if available
        if (cogOverview && cogOverview.propagation_map) {
          // Could enhance domain cards with propagation data in future
        }

      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.detail || err?.message || 'Failed to load baseline data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, []);

  return (
    <DashboardLayout>
      <div data-testid="intelligence-baseline-page" style={{ minHeight: '100vh', background: 'var(--canvas-app)', color: 'var(--ink-secondary)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '40px 24px' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--ink-display)', letterSpacing: 'var(--ls-display)', margin: 0 }}>
              Intelligence Baseline
            </h1>
            <button
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 'var(--r-md)', border: 'none',
                background: 'linear-gradient(135deg, ' + 'var(--lava)' + ', ' + 'var(--lava-deep)' + ')',
                color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                transition: 'box-shadow 0.2s, transform 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--elev-1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
            >
              <Activity style={{ width: 16, height: 16 }} />
              Recalibrate
            </button>
          </div>
          <p style={{ fontSize: 14, color: 'var(--ink-secondary)', lineHeight: 1.5, maxWidth: 640, marginBottom: 32, marginTop: 0 }}>
            Your intelligence baseline is a personalised benchmark that BIQc uses to detect drift, anomalies, and emerging patterns. It recalibrates quarterly.
          </p>

          {/* Error state */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--danger-wash)', border: '1px solid var(--danger)',
              borderRadius: 'var(--r-lg)', padding: 16, marginBottom: 24,
              fontSize: 13, color: 'var(--danger)', fontFamily: 'var(--font-ui)',
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* AI Insight Banner */}
          <div style={{
            background: 'linear-gradient(135deg, var(--lava-wash) 0%, var(--surface) 40%)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid ' + 'var(--lava)',
            borderRadius: 'var(--r-lg)',
            padding: 20, marginBottom: 32,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Sparkles style={{ width: 16, height: 16, color: 'var(--lava)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)', color: 'var(--lava)' }}>
                Baseline Intelligence
              </span>
            </div>
            <p style={{ fontSize: 14, color: 'var(--ink-secondary)', lineHeight: 1.6, margin: 0 }}>
              {loading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                  Analysing baseline data...
                </span>
              ) : insightText ? (
                <span><strong style={{ color: 'var(--ink-display)' }}>{insightText}</strong></span>
              ) : (
                <span style={{ color: 'var(--ink-muted)' }}>
                  Connect data sources and run initial calibration to establish your intelligence baseline.
                </span>
              )}
            </p>
          </div>

          {/* Domain Baseline Cards */}
          {loading ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: 64, color: 'var(--ink-muted)', fontSize: 14, fontFamily: 'var(--font-ui)',
            }}>
              <Loader2 style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} />
              Loading baseline domains...
            </div>
          ) : domains.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16, marginBottom: 40,
            }}>
              {domains.map(d => <DomainCard key={d.name} domain={d} />)}
            </div>
          ) : (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)', padding: '40px 24px',
              textAlign: 'center', marginBottom: 40,
            }}>
              <div style={{ fontSize: 14, color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)', lineHeight: 1.6 }}>
                Connect data sources and run initial calibration to establish your intelligence baseline.
              </div>
            </div>
          )}

          {/* Responsive override for the grid */}
          <style>{`
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
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
              <Calendar style={{ width: 18, height: 18, color: 'var(--ink-muted)' }} />
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--ink-display)', margin: 0 }}>
                Calibration History
              </h2>
            </div>
            <div className="ib-table-wrap" style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '24px 20px',
                textAlign: 'center',
                color: 'var(--ink-muted)',
                fontSize: 14,
                fontFamily: 'var(--font-ui)',
                lineHeight: 1.6,
              }}>
                No calibration history. Run a baseline calibration to establish your starting metrics.
              </div>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default IntelligenceBaselinePage;
