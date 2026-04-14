import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { Lock, RefreshCw, Layers } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';

/* ── Shared surface ───────────────────────────────────────────────── */
const Panel = ({ children, className = '', style = {}, ...rest }) => (
  <div
    className={`rounded-xl p-5 ${className}`}
    style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)', ...style }}
    {...rest}
  >
    {children}
  </div>
);

/* ── KPI card ─────────────────────────────────────────────────────── */
const KpiCard = ({ label, value, delta, deltaDir, valueClass = '', testId }) => {
  const valueColor =
    valueClass === 'warn' ? '#D97706' :
    valueClass === 'good' ? '#16A34A' :
    'var(--ink-display, #EDF1F7)';
  const deltaColor = deltaDir === 'up' ? '#16A34A' : '#DC2626';
  return (
    <Panel data-testid={testId}>
      <div style={{ fontSize: 10, color: 'var(--ink-muted, #708499)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4, fontFamily: fontFamily.mono }}>
        {label}
      </div>
      <div style={{ fontFamily: fontFamily.mono, fontSize: 28, fontWeight: 700, color: valueColor, lineHeight: 1 }}>
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
    critical: { background: 'rgba(239,68,68,0.15)', color: '#F87171' },
    high:     { background: 'rgba(245,158,11,0.15)', color: '#FBBF24' },
    medium:   { background: 'rgba(59,130,246,0.15)', color: '#60A5FA' },
    low:      { background: 'rgba(34,197,94,0.15)', color: '#4ADE80' },
  };
  const s = styles[level] || styles.medium;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 9999, whiteSpace: 'nowrap', ...s }}>
      {level}
    </span>
  );
};

/* ── SOP status badge ─────────────────────────────────────────────── */
const SopStatusBadge = ({ status }) => {
  const styles = {
    active: { background: 'rgba(34,197,94,0.15)', color: '#4ADE80' },
    draft:  { background: 'rgba(245,158,11,0.15)', color: '#FBBF24' },
    review: { background: 'rgba(59,130,246,0.15)', color: '#60A5FA' },
  };
  const s = styles[status] || styles.active;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 9999, whiteSpace: 'nowrap', ...s }}>
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
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.display, lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontSize: 10, color: 'var(--ink-muted, #708499)', marginTop: 2 }}>{domain}</div>
      </div>
      <PriorityBadge level={priority} />
    </div>
    {/* Body */}
    <div style={{ fontSize: 14, color: 'var(--ink-secondary, #8FA0B8)', lineHeight: 1.5, marginBottom: 12 }}>{body}</div>
    {/* Metrics */}
    {metrics.length > 0 && (
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, paddingTop: 12, borderTop: '1px solid rgba(140,170,210,0.08)' }}>
        {metrics.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 10, color: 'var(--ink-muted, #708499)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.label}</span>
            <span style={{ fontFamily: fontFamily.mono, fontSize: 14, fontWeight: 600, color: 'var(--ink-display, #EDF1F7)' }}>{m.value}</span>
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
              fontSize: 12, fontWeight: 600, color: '#E85D00',
              padding: '4px 10px', border: '1px solid rgba(232,93,0,0.25)', borderRadius: 9999,
              cursor: 'pointer', transition: 'background 0.15s ease',
            }}
            className="hover:bg-[rgba(232,93,0,0.08)]"
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
  <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(140,170,210,0.08)' }} data-testid={testId}>
    <div style={{
      flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
      background: 'rgba(232,93,0,0.12)', color: '#E85D00',
      fontFamily: fontFamily.mono, fontSize: 12, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {num}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-display, #EDF1F7)', marginBottom: 2, fontFamily: fontFamily.display }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-secondary, #8FA0B8)', lineHeight: 1.5 }}>{desc}</div>
      {impact && (
        <div style={{ fontSize: 10, color: '#16A34A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>
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
      <div className="space-y-6 max-w-[1200px] animate-fade-in" data-testid="ops-advisory-page" style={{ fontFamily: fontFamily.body }}>

        {/* ── HEADER ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1
              className="font-medium"
              style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)', fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1.15 }}
              data-testid="ops-advisory-title"
            >
              Ops Advisory Centre
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }} data-testid="ops-advisory-subtitle">
              Evidence-backed operational intelligence based on your profile and recent activity
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #E85D00, #FF7A1A)', color: '#fff', transition: 'all 0.15s ease' }}
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
            background: 'var(--surface, #0E1628)',
            border: '1px solid rgba(140,170,210,0.12)',
            borderLeft: '3px solid #E85D00',
          }}
          data-testid="ops-advisory-ai-insight"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div
              style={{
                width: 8, height: 8, borderRadius: '50%', background: '#E85D00',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#C24D00', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Ops Advisory AI
            </span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-secondary, #8FA0B8)', lineHeight: 1.5 }}>
            {aiInsight ? (
              <>{aiInsight}</>
            ) : firstItem ? (
              <>
                <strong style={{ color: 'var(--ink-display, #EDF1F7)' }}>{firstItem.title} is your highest-impact operational signal.</strong>{' '}
                {firstItem.reason || 'Review the recommendation details and assign an owner to begin resolution.'}
              </>
            ) : (
              <>
                <strong style={{ color: 'var(--ink-display, #EDF1F7)' }}>No critical operational signals detected.</strong>{' '}
                Your operations are running within normal parameters. BIQc will surface advisories as new data arrives.
              </>
            )}
          </div>
        </Panel>

        {/* ── LOADING STATE ───────────────────────────────────────── */}
        {loading ? (
          <Panel data-testid="ops-advisory-loading-panel">
            <div className="space-y-3 animate-pulse">
              <div className="h-5 w-52 rounded" style={{ background: '#1E2D3D' }} />
              <div className="h-4 w-80 rounded" style={{ background: '#1E2D3D' }} />
              <div className="h-4 w-full rounded" style={{ background: '#1E2D3D' }} />
              <div className="h-4 w-[88%] rounded" style={{ background: '#1E2D3D' }} />
            </div>
          </Panel>
        ) : data?.locked ? (
          /* ── LOCKED / UPGRADE GATE ─────────────────────────────── */
          <Panel data-testid="ops-advisory-locked-panel">
            <div className="flex items-start gap-3 mb-3">
              <Lock className="w-4 h-4 mt-0.5" style={{ color: '#E85D00' }} />
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.display }}>Upgrade to unlock more recommendations</h3>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>You&apos;ve reached your monthly limit for your current plan.</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                Used {data?.usage?.used || 0} of {data?.usage?.limit || 0} this month.
              </div>
              <Link to="/upgrade" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: '#E85D00', color: '#fff' }} data-testid="ops-advisory-view-plans-button">
                View Plans
              </Link>
            </div>
          </Panel>
        ) : (
          <>
            {/* ── ACTIVE ADVISORIES GRID ─────────────────────────── */}
            <div data-testid="ops-advisory-section-advisories">
              <h2 style={{ fontFamily: fontFamily.display, fontSize: 22, color: 'var(--ink-display, #EDF1F7)', marginBottom: 16 }}>Active Advisories</h2>
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
                <h2 style={{ fontFamily: fontFamily.display, fontSize: 22, color: 'var(--ink-display, #EDF1F7)', marginBottom: 16 }}>Generated SOPs</h2>
                <div style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)', borderRadius: 12, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }} data-testid="ops-advisory-sop-table">
                    <thead>
                      <tr>
                        {['SOP Name', 'Domain', 'Status', 'Last Updated', 'Steps'].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: 'left', padding: '12px 16px',
                              fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
                              color: 'var(--ink-muted, #708499)', background: '#060A12', borderBottom: '1px solid rgba(140,170,210,0.12)',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sops.map((sop, idx) => (
                        <tr key={idx} style={{ transition: 'background 0.1s ease' }} className="hover:bg-[#060A12]">
                          <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--ink-display, #EDF1F7)', fontWeight: 600, borderBottom: '1px solid rgba(140,170,210,0.06)', verticalAlign: 'top' }}>
                            {sop.name}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--ink-secondary, #8FA0B8)', borderBottom: '1px solid rgba(140,170,210,0.06)', verticalAlign: 'top' }}>
                            {sop.domain}
                          </td>
                          <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(140,170,210,0.06)', verticalAlign: 'top' }}>
                            <SopStatusBadge status={sop.status || 'active'} />
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--ink-secondary, #8FA0B8)', borderBottom: '1px solid rgba(140,170,210,0.06)', verticalAlign: 'top' }}>
                            {sop.updated || '—'}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 14, fontFamily: fontFamily.mono, color: 'var(--ink-secondary, #8FA0B8)', borderBottom: '1px solid rgba(140,170,210,0.06)', verticalAlign: 'top' }}>
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
              <h2 style={{ fontFamily: fontFamily.display, fontSize: 22, color: 'var(--ink-display, #EDF1F7)', marginBottom: 16 }}>
                {aiRecommendations.length > 0 ? 'AI Recommendations' : 'Recommendations'}
              </h2>
              <p className="text-xs mb-4" style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono }}>
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
                      style={{ background: '#0B1120', border: '1px solid rgba(140,170,210,0.12)' }}
                      data-testid={`ops-advisory-item-${idx}`}
                    >
                      <div className="text-sm font-semibold" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.display }}>
                        {item.title}
                      </div>
                      {item.reason && (
                        <div className="text-sm mt-1 break-words" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                          {item.reason}
                        </div>
                      )}
                      {item.actions?.length ? (
                        <ul className="mt-3 list-disc pl-5 space-y-1 text-sm" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                          {item.actions.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      ) : null}

                      {(item.why || item.citations?.length) ? (
                        <details className="mt-4" data-testid={`ops-advisory-item-details-${idx}`}>
                          <summary className="text-sm cursor-pointer" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}>Why this recommendation?</summary>
                          <div className="pt-2">
                            {item.why ? (
                              <div className="text-sm break-words" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                                {item.why}
                              </div>
                            ) : null}

                            {item.confidence ? (
                              <div className="text-xs mt-2" style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono }}>
                                Confidence: {item.confidence}
                              </div>
                            ) : null}

                            {item.citations?.length ? (
                              <div className="mt-3">
                                <div className="text-xs font-medium" style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono }}>Sources</div>
                                <ul className="mt-2 space-y-2">
                                  {item.citations.map((c, i) => (
                                    <li key={i} className="text-sm">
                                      <div style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>
                                        <span className="mr-2 text-xs" style={{ color: 'var(--ink-muted, #708499)' }}>[{c.source_type}]</span>
                                        {c.url ? (
                                          <a href={c.url} target="_blank" rel="noreferrer" className="underline">
                                            {c.title || c.url}
                                          </a>
                                        ) : (
                                          <span>{c.title}</span>
                                        )}
                                      </div>
                                      {c.snippet ? (
                                        <div className="text-xs mt-1 break-words" style={{ color: 'var(--ink-muted, #708499)' }}>
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
              <div className="text-sm" style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono }} data-testid="ops-advisory-usage-info">
                Used {data?.usage?.used || 0} of {data?.usage?.limit || 0} recommendations this month.
              </div>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(140,170,210,0.15)', color: 'var(--ink-display, #EDF1F7)', border: '1px solid rgba(140,170,210,0.12)' }}
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
