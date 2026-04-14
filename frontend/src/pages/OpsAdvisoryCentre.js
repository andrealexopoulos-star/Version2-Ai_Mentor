import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { Lock, RefreshCw, Layers } from 'lucide-react';

/* ── Shared surface ───────────────────────────────────────────────── */
const Panel = ({ children, className = '', style = {}, ...rest }) => (
  <div
    className={`rounded-xl p-5 ${className}`}
    style={{ background: 'var(--surface)', border: '1px solid var(--border)', ...style }}
    {...rest}
  >
    {children}
  </div>
);

/* ── KPI card ─────────────────────────────────────────────────────── */
const KpiCard = ({ label, value, delta, deltaDir, valueClass = '', testId }) => {
  const valueColor =
    valueClass === 'warn' ? 'var(--warning)' :
    valueClass === 'good' ? 'var(--positive)' :
    'var(--ink-display)';
  const deltaColor = deltaDir === 'up' ? 'var(--positive)' : 'var(--danger)';
  return (
    <Panel data-testid={testId}>
      <div style={{ fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)', fontWeight: 600, marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: valueColor, lineHeight: 1 }}>
        {value}
      </div>
      {delta && (
        <div style={{ fontSize: 12, fontWeight: 500, marginTop: 4, color: deltaColor }}>
          {delta}
        </div>
      )}
    </Panel>
  );
};

/* ── Priority badge ───────────────────────────────────────────────── */
const PriorityBadge = ({ level }) => {
  const styles = {
    critical: { background: 'var(--danger-wash)', color: 'var(--danger)' },
    high:     { background: 'var(--warning-wash)', color: 'var(--warning)' },
    medium:   { background: 'var(--info-wash)', color: 'var(--info)' },
    low:      { background: 'var(--positive-wash)', color: 'var(--positive)' },
  };
  const s = styles[level] || styles.medium;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 'var(--r-pill)', whiteSpace: 'nowrap', ...s }}>
      {level}
    </span>
  );
};

/* ── SOP status badge ─────────────────────────────────────────────── */
const SopStatusBadge = ({ status }) => {
  const styles = {
    active: { background: 'var(--positive-wash)', color: 'var(--positive)' },
    draft:  { background: 'var(--warning-wash)', color: 'var(--warning)' },
    review: { background: 'var(--info-wash)', color: 'var(--info)' },
  };
  const s = styles[status] || styles.active;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 'var(--r-pill)', whiteSpace: 'nowrap', ...s }}>
      {status}
    </span>
  );
};

/* ── Advisory card ────────────────────────────────────────────────── */
const AdvisoryCard = ({ title, domain, priority, body, metrics = [], actions = [], testId }) => (
  <Panel data-testid={testId} style={{ transition: 'box-shadow 0.15s ease' }} className="hover:shadow-lg">
    {/* Head */}
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-display)', fontFamily: 'var(--font-display)', lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontSize: 10, color: 'var(--ink-muted)', marginTop: 2 }}>{domain}</div>
      </div>
      <PriorityBadge level={priority} />
    </div>
    {/* Body */}
    <div style={{ fontSize: 14, color: 'var(--ink-secondary)', lineHeight: 1.5, marginBottom: 12 }}>{body}</div>
    {/* Metrics */}
    {metrics.length > 0 && (
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
        {metrics.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)' }}>{m.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--ink-display)' }}>{m.value}</span>
          </div>
        ))}
      </div>
    )}
    {/* Actions */}
    {actions.length > 0 && (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {actions.map((a, i) => (
          <span
            key={i}
            style={{
              fontSize: 12, fontWeight: 600, color: 'var(--lava)',
              padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)',
              cursor: 'pointer', transition: 'background 0.15s ease',
            }}
            className="hover:bg-[var(--lava-wash)]"
          >
            {a}
          </span>
        ))}
      </div>
    )}
  </Panel>
);

/* ── Recommendation row ───────────────────────────────────────────── */
const RecItem = ({ num, title, desc, impact, testId }) => (
  <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }} data-testid={testId}>
    <div style={{
      flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
      background: 'var(--lava-wash)', color: 'var(--lava)',
      fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {num}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-display)', marginBottom: 2, fontFamily: 'var(--font-display)' }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-secondary)', lineHeight: 1.5 }}>{desc}</div>
      {impact && (
        <div style={{ fontSize: 10, color: 'var(--positive)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)', marginTop: 4 }}>
          {impact}
        </div>
      )}
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════ */
/*  OPS ADVISORY CENTRE                                              */
/* ═══════════════════════════════════════════════════════════════════ */
const OpsAdvisoryCentre = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/oac/recommendations');
      setData(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const items = data?.items || [];
  const firstItem = items[0];
  const usage = data?.usage || {};
  const kpis = data?.kpis || {};
  const advisories = data?.advisories || [];
  const sops = data?.sops || [];
  const aiRecommendations = data?.ai_recommendations || [];
  const aiInsight = data?.ai_insight || null;

  /* Fallback KPIs when API hasn't populated them yet */
  const kpiCards = [
    { label: 'Active Advisories', value: kpis.active_advisories ?? items.length ?? '—', delta: kpis.active_advisories_delta || null, deltaDir: 'down', valueClass: '', testId: 'ops-kpi-active' },
    { label: 'Avg Resolution',    value: kpis.avg_resolution ?? '—',   delta: kpis.avg_resolution_delta || null,    deltaDir: 'down', valueClass: 'warn', testId: 'ops-kpi-resolution' },
    { label: 'SOPs Generated',    value: kpis.sops_generated ?? '—',   delta: kpis.sops_generated_delta || null,    deltaDir: 'up',   valueClass: '', testId: 'ops-kpi-sops' },
    { label: 'Process Score',     value: kpis.process_score ?? '—',    delta: kpis.process_score_delta || null,     deltaDir: 'up',   valueClass: 'good', testId: 'ops-kpi-process' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px] animate-fade-in" data-testid="ops-advisory-page" style={{ fontFamily: 'var(--font-ui)' }}>

        {/* ── HEADER ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1
              className="font-medium"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', fontSize: 28, letterSpacing: 'var(--ls-display)', lineHeight: 1.15 }}
              data-testid="ops-advisory-title"
            >
              Ops Advisory Centre
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }} data-testid="ops-advisory-subtitle">
              Evidence-backed operational intelligence based on your profile and recent activity
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, var(--lava), var(--lava-warm))', color: '#fff', transition: 'all 0.15s ease' }}
            onClick={fetchRecommendations}
            data-testid="ops-advisory-generate-btn"
          >
            <Layers className="w-4 h-4" />
            Generate Advisory
          </button>
        </div>

        {/* ── KPI GRID ────────────────────────────────────────────── */}
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}
          className="max-[800px]:!grid-cols-2"
          data-testid="ops-advisory-kpis"
        >
          {kpiCards.map((kpi, i) => (
            <KpiCard key={i} {...kpi} />
          ))}
        </div>

        {/* ── AI OPS INSIGHT ──────────────────────────────────────── */}
        <Panel
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--lava)',
          }}
          data-testid="ops-advisory-ai-insight"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div
              style={{
                width: 8, height: 8, borderRadius: '50%', background: 'var(--lava)',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--lava-deep)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)' }}>
              Ops Advisory AI
            </span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
            {aiInsight ? (
              <>{aiInsight}</>
            ) : firstItem ? (
              <>
                <strong style={{ color: 'var(--ink-display)' }}>{firstItem.title} is your highest-impact operational signal.</strong>{' '}
                {firstItem.reason || 'Review the recommendation details and assign an owner to begin resolution.'}
              </>
            ) : (
              <>
                <strong style={{ color: 'var(--ink-display)' }}>No critical operational signals detected.</strong>{' '}
                Your operations are running within normal parameters. BIQc will surface advisories as new data arrives.
              </>
            )}
          </div>
        </Panel>

        {/* ── LOADING STATE ───────────────────────────────────────── */}
        {loading ? (
          <Panel data-testid="ops-advisory-loading-panel">
            <div className="space-y-3 animate-pulse">
              <div className="h-5 w-52 rounded" style={{ background: 'var(--surface-sunken)' }} />
              <div className="h-4 w-80 rounded" style={{ background: 'var(--surface-sunken)' }} />
              <div className="h-4 w-full rounded" style={{ background: 'var(--surface-sunken)' }} />
              <div className="h-4 w-[88%] rounded" style={{ background: 'var(--surface-sunken)' }} />
            </div>
          </Panel>
        ) : data?.locked ? (
          /* ── LOCKED / UPGRADE GATE ─────────────────────────────── */
          <Panel data-testid="ops-advisory-locked-panel">
            <div className="flex items-start gap-3 mb-3">
              <Lock className="w-4 h-4 mt-0.5" style={{ color: 'var(--lava)' }} />
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>Upgrade to unlock more recommendations</h3>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-secondary)' }}>You&apos;ve reached your monthly limit for your current plan.</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm" style={{ color: 'var(--ink-secondary)' }}>
                Used {data?.usage?.used || 0} of {data?.usage?.limit || 0} this month.
              </div>
              <Link to="/upgrade" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: 'var(--lava)', color: '#fff' }} data-testid="ops-advisory-view-plans-button">
                View Plans
              </Link>
            </div>
          </Panel>
        ) : (
          <>
            {/* ── ACTIVE ADVISORIES GRID ─────────────────────────── */}
            <div data-testid="ops-advisory-section-advisories">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink-display)', marginBottom: 16 }}>Active Advisories</h2>
              <div
                style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}
                className="max-[800px]:!grid-cols-1"
                data-testid="ops-advisory-grid"
              >
                {/* Render from API if available, otherwise from items */}
                {(advisories.length > 0 ? advisories : items).map((item, idx) => (
                  <AdvisoryCard
                    key={idx}
                    title={item.title}
                    domain={item.domain || 'Operations'}
                    priority={item.priority || item.severity || 'medium'}
                    body={item.reason || item.body || item.description || ''}
                    metrics={item.metrics || []}
                    actions={item.card_actions || item.actions || []}
                    testId={`ops-advisory-card-${idx}`}
                  />
                ))}
              </div>
            </div>

            {/* ── GENERATED SOPs TABLE ───────────────────────────── */}
            {sops.length > 0 && (
              <div data-testid="ops-advisory-section-sops">
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink-display)', marginBottom: 16 }}>Generated SOPs</h2>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="ops-advisory-sop-table">
                    <thead>
                      <tr>
                        {['SOP Name', 'Domain', 'Status', 'Last Updated', 'Steps'].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: 'left', padding: '12px 16px',
                              fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)',
                              color: 'var(--ink-muted)', background: 'var(--surface-sunken)', borderBottom: '1px solid var(--border)',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sops.map((sop, idx) => (
                        <tr key={idx} style={{ transition: 'background 0.1s ease' }} className="hover:bg-[var(--surface-sunken)]">
                          <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--ink-display)', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'top' }}>
                            {sop.name}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--ink-secondary)', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'top' }}>
                            {sop.domain}
                          </td>
                          <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'top' }}>
                            <SopStatusBadge status={sop.status || 'active'} />
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--ink-secondary)', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'top' }}>
                            {sop.updated || '—'}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--ink-secondary)', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'top' }}>
                            {sop.steps ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── AI RECOMMENDATIONS ─────────────────────────────── */}
            <Panel data-testid="ops-advisory-recommendations-panel">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink-display)', marginBottom: 16 }}>
                {aiRecommendations.length > 0 ? 'AI Recommendations' : 'Recommendations'}
              </h2>
              <p className="text-xs mb-4" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                {data?.meta?.date ? `Generated for ${data.meta.date}` : 'Generated today'}
              </p>

              {/* AI-style numbered recommendations when available */}
              {aiRecommendations.length > 0 ? (
                <div>
                  {aiRecommendations.map((rec, idx) => (
                    <RecItem
                      key={idx}
                      num={idx + 1}
                      title={rec.title}
                      desc={rec.description || rec.desc || ''}
                      impact={rec.impact || null}
                      testId={`ops-advisory-rec-${idx}`}
                    />
                  ))}
                </div>
              ) : (
                /* Fallback: original flat recommendation items */
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl"
                      style={{ background: 'var(--canvas-app)', border: '1px solid var(--border)' }}
                      data-testid={`ops-advisory-item-${idx}`}
                    >
                      <div className="text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>
                        {item.title}
                      </div>
                      {item.reason && (
                        <div className="text-sm mt-1 break-words" style={{ color: 'var(--ink-secondary)' }}>
                          {item.reason}
                        </div>
                      )}
                      {item.actions?.length ? (
                        <ul className="mt-3 list-disc pl-5 space-y-1 text-sm" style={{ color: 'var(--ink-secondary)' }}>
                          {item.actions.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      ) : null}

                      {(item.why || item.citations?.length) ? (
                        <details className="mt-4" data-testid={`ops-advisory-item-details-${idx}`}>
                          <summary className="text-sm cursor-pointer" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>Why this recommendation?</summary>
                          <div className="pt-2">
                            {item.why ? (
                              <div className="text-sm break-words" style={{ color: 'var(--ink-secondary)' }}>
                                {item.why}
                              </div>
                            ) : null}

                            {item.confidence ? (
                              <div className="text-xs mt-2" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                                Confidence: {item.confidence}
                              </div>
                            ) : null}

                            {item.citations?.length ? (
                              <div className="mt-3">
                                <div className="text-xs font-medium" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>Sources</div>
                                <ul className="mt-2 space-y-2">
                                  {item.citations.map((c, i) => (
                                    <li key={i} className="text-sm">
                                      <div style={{ color: 'var(--ink-secondary)' }}>
                                        <span className="mr-2 text-xs" style={{ color: 'var(--ink-muted)' }}>[{c.source_type}]</span>
                                        {c.url ? (
                                          <a href={c.url} target="_blank" rel="noreferrer" className="underline">
                                            {c.title || c.url}
                                          </a>
                                        ) : (
                                          <span>{c.title}</span>
                                        )}
                                      </div>
                                      {c.snippet ? (
                                        <div className="text-xs mt-1 break-words" style={{ color: 'var(--ink-muted)' }}>
                                          {c.snippet}
                                        </div>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* ── USAGE + REFRESH ─────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }} data-testid="ops-advisory-usage-info">
                Used {data?.usage?.used || 0} of {data?.usage?.limit || 0} recommendations this month.
              </div>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold"
                style={{ background: 'var(--surface-sunken)', color: 'var(--ink-display)', border: '1px solid var(--border)' }}
                onClick={fetchRecommendations}
                data-testid="ops-advisory-refresh-button"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          </>
        )}
      </div>

      {/* Pulse keyframe for AI insight dot */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @media (max-width: 800px) {
          [data-testid="ops-advisory-kpis"] { grid-template-columns: repeat(2, 1fr) !important; }
          [data-testid="ops-advisory-grid"] { grid-template-columns: 1fr !important; }
          [data-testid="ops-advisory-sop-table"] th:nth-child(4),
          [data-testid="ops-advisory-sop-table"] td:nth-child(4),
          [data-testid="ops-advisory-sop-table"] th:nth-child(5),
          [data-testid="ops-advisory-sop-table"] td:nth-child(5) { display: none; }
        }
      `}</style>
    </DashboardLayout>
  );
};

export default OpsAdvisoryCentre;
