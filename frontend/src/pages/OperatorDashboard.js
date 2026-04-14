import { CognitiveMesh } from '../components/LoadingSystems';
import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import { AlertCircle, Plug, Activity, Radio } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { fontFamily } from '../design-system/tokens';

const POSITION_COLORS = {
  STABLE: 'text-emerald-400', ELEVATED: 'text-amber-400',
  DETERIORATING: 'text-red-400', CRITICAL: 'text-red-500',
};
const DOT_COLORS = {
  STABLE: 'bg-emerald-400', ELEVATED: 'bg-amber-400',
  DETERIORATING: 'bg-red-400', CRITICAL: 'bg-red-500',
};
const PRESSURE_COLORS = {
  LOW: 'text-white/40', MODERATE: 'text-amber-400',
  HIGH: 'text-red-400', CRITICAL: 'text-red-500',
};

const formatHours = (h) => {
  if (h == null) return '';
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
};

const Panel = ({ title, children, empty }) => (
  <div className="border border-white/6 p-5">
    <h3 className="text-[10px] tracking-[0.3em] uppercase text-white/30 mb-4">{title}</h3>
    {empty ? <p className="text-xs text-white/20">No data.</p> : children}
  </div>
);

// ── Status Card ──────────────────────────────────────────────────────────────
const StatusCard = ({ label, value, valueColor, sub }) => (
  <div className="rounded-xl p-4" style={{ background: 'var(--biqc-bg-card, rgba(255,255,255,0.02))', border: '1px solid var(--biqc-border, rgba(255,255,255,0.06))' }}>
    <div className="text-[10px] uppercase tracking-[0.1em] font-semibold mb-1" style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono }}>{label}</div>
    <div className="text-[28px] font-bold leading-none" style={{ color: valueColor || 'var(--ink-display)', fontFamily: fontFamily.mono }}>{value}</div>
    {sub && <div className="text-xs mt-1" style={{ color: 'var(--ink-muted, #708499)' }}>{sub}</div>}
  </div>
);

// ── Health Bar ───────────────────────────────────────────────────────────────
const HealthItem = ({ name, indicatorOk, barPct, barColor, metaLeft, metaRight }) => (
  <div className="rounded-xl p-4" style={{ background: 'var(--biqc-bg-card, rgba(255,255,255,0.02))', border: '1px solid var(--biqc-border, rgba(255,255,255,0.06))' }}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-semibold" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.body }}>{name}</span>
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: indicatorOk ? '#16A34A' : '#DC2626' }} />
    </div>
    <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, background: barColor || '#16A34A' }} />
    </div>
    <div className="flex justify-between text-xs" style={{ color: 'var(--ink-muted, #708499)' }}>
      <span>{metaLeft}</span>
      <span>{metaRight}</span>
    </div>
  </div>
);

// ── Empty State Card ────────────────────────────────────────────────────────
const EmptyState = ({ message }) => (
  <div className="rounded-xl p-6 text-center" style={{ background: 'var(--biqc-bg-card, rgba(255,255,255,0.02))', border: '1px solid var(--biqc-border, rgba(255,255,255,0.06))' }}>
    <p className="text-sm" style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.body }}>{message}</p>
  </div>
);

const Row = ({ left, right, sub }) => (
  <div className="flex items-center justify-between py-2 border-b border-white/4 last:border-0">
    <div>
      <span className="text-sm text-white/70">{left}</span>
      {sub && <span className="text-xs text-white/25 ml-2">{sub}</span>}
    </div>
    <div className="text-right">{right}</div>
  </div>
);

const OperatorDashboard = () => {
  const [data, setData] = useState(null);
  const [lifecycle, setLifecycle] = useState(null);
  const [dataReadiness, setDataReadiness] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [pos, findings, snapshot, lc, dr] = await Promise.all([
        apiClient.get('/watchtower/positions').then(r => r.data).catch(() => ({ positions: {} })),
        apiClient.get('/watchtower/findings?limit=20').then(r => r.data).catch(() => ({ findings: [] })),
        apiClient.get('/snapshot/latest').then(r => r.data).catch(() => ({ snapshot: null })),
        apiClient.get('/lifecycle/state').then(r => r.data).catch(() => null),
        apiClient.get('/intelligence/data-readiness').then(r => r.data).catch(() => null),
      ]);
      const snap = snapshot.snapshot;
      setData({
        positions: pos.positions || {},
        escalations: snap?.open_risks || [],
        contradictions: snap?.contradictions || [],
        snapshot: snap,
      });
      setLifecycle(lc);
      setDataReadiness(dr);
    } catch (e) {
      console.error('[OperatorDashboard] Load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 -mx-4 -my-4 md:-mx-6 md:-my-6" style={{ background: '#050505', minHeight: 'calc(100vh - 80px)' }}>
          <CognitiveMesh compact />
        </div>
      </DashboardLayout>
    );
  }

  const posEntries = data ? Object.entries(data.positions) : [];
  const escalations = data?.escalations || [];
  const contradictions = data?.contradictions || [];
  const hasIntelligence = posEntries.length > 0 || escalations.length > 0 || contradictions.length > 0;

  // Determine why there's no intelligence
  const getNoIntelligenceReasons = () => {
    if (!lifecycle) return [{ icon: AlertCircle, text: 'Unable to determine system state.' }];
    const reasons = [];
    if (lifecycle.integrations.count === 0) {
      reasons.push({ icon: Plug, text: 'No integrations connected. Connect HubSpot, Outlook, or Xero to begin data collection.' });
    } else {
      reasons.push({ icon: Plug, text: `${lifecycle.integrations.count} integration(s) connected: ${lifecycle.integrations.providers.join(', ')}` });
    }
    if (lifecycle.intelligence.domains_enabled.length === 0) {
      reasons.push({ icon: Radio, text: 'No monitoring domains enabled. Go to Intelligence Baseline and enable Finance, Sales, or Operations.' });
    } else {
      reasons.push({ icon: Radio, text: `Domains enabled: ${lifecycle.intelligence.domains_enabled.join(', ')}` });
    }
    if (!lifecycle.intelligence.has_events) {
      reasons.push({ icon: Activity, text: 'No observation events received yet. Click "Run Analysis" on the BIQc Insights page to trigger the first analysis.' });
    }
    return reasons;
  };

  return (
    <DashboardLayout>
      <div data-testid="operator-dashboard" className="min-h-[calc(100vh-80px)] text-white/80 -mx-4 -my-4 md:-mx-6 md:-my-6 px-6 py-10" style={{ background: '#050505' }}>
        <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="font-medium" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)', fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1.15 }}>Operator Dashboard</h1>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-muted, #708499)' }}>Read-only intelligence state</p>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ink-muted, #708499)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#16A34A', animation: 'pulse 2s ease-in-out infinite' }} />
              All systems operational
            </div>
          </div>

          {/* ═══ Status Grid ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatusCard label="Positions Tracked" value={posEntries.length > 0 ? String(posEntries.length) : '\u2014'} sub={posEntries.length > 0 ? 'Active domain positions' : 'No positions yet'} />
            <StatusCard label="Active Findings" value={escalations.length > 0 ? String(escalations.length) : '\u2014'} sub={escalations.length > 0 ? 'Open escalations' : 'No findings yet'} />
            <StatusCard label="Data Sources Ready" value={dataReadiness?.integrations?.length > 0 ? String(dataReadiness.integrations.length) : '\u2014'} valueColor={dataReadiness?.integrations?.length > 0 ? '#16A34A' : undefined} sub={dataReadiness?.integrations?.length > 0 ? 'Connected integrations' : 'No integrations connected'} />
            <StatusCard label="Lifecycle State" value={lifecycle?.stage || '\u2014'} sub={lifecycle?.stage ? 'Current platform stage' : 'State unavailable'} />
          </div>

          {/* ═══ Automation Pipeline ═══ */}
          <div>
            <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)' }}>Automation Pipeline</h2>
            <EmptyState message="No automation jobs configured. Automation pipelines will appear here when active." />
          </div>

          {/* ═══ Recent Runs Table ═══ */}
          <div>
            <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)' }}>Recent Runs</h2>
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--biqc-bg-card, rgba(255,255,255,0.02))', border: '1px solid var(--biqc-border, rgba(255,255,255,0.06))' }}>
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Job', 'Started', 'Duration', 'Records', 'Result'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5"
                        style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.mono, background: 'rgba(30,45,61,0.3)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm" style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.body }}>
                      No recent runs to display.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ System Health ═══ */}
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)' }}>System Health</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-muted, #708499)' }}>Connect monitoring to see live health data.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <HealthItem name="API Backend" indicatorOk={false} barPct={0} barColor="#475569" metaLeft="CPU: \u2014" metaRight="Memory: \u2014" />
              <HealthItem name="Supabase Database" indicatorOk={false} barPct={0} barColor="#475569" metaLeft="Connections: \u2014" metaRight="Storage: \u2014" />
              <HealthItem name="Edge Functions" indicatorOk={false} barPct={0} barColor="#475569" metaLeft="Health: \u2014" metaRight="Latency: \u2014" />
            </div>
          </div>

          {!hasIntelligence && (
            <div className="border border-white/8 bg-white/[0.02] p-6 space-y-4">
              <h3 className="text-xs tracking-[0.2em] uppercase text-amber-500/70">Intelligence State Diagnosis</h3>
              <p className="text-sm text-white/40">No material intelligence state detected. Reasons:</p>
              {getNoIntelligenceReasons().map((r, i) => (
                <div key={i} className="flex items-start gap-3">
                  <r.icon className="w-4 h-4 text-white/30 mt-0.5 shrink-0" />
                  <p className="text-sm text-white/50">{r.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Data Readiness Panel — Part 2 */}
          {dataReadiness?.integrations?.length > 0 && (
            <div className="border border-white/8 bg-white/[0.02] p-5">
              <h3 className="text-[10px] tracking-[0.3em] uppercase text-white/30 mb-4">Data Readiness</h3>
              {dataReadiness.integrations.map((int, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/4 last:border-0">
                  <div>
                    <span className="text-sm text-white/70">{int.provider}</span>
                    <span className="text-xs text-white/25 ml-2">{int.category}</span>
                  </div>
                  <div className="text-right text-xs space-x-3">
                    <span className="text-emerald-400">{int.status}</span>
                    <span className="text-white/30">{int.observation_events} events</span>
                    {int.connected_at && (
                      <span className="text-white/20">since {int.connected_at.slice(0, 10)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {data?.snapshot?.summary && (
            <div className="border border-white/8 bg-white/[0.02] p-5">
              <div className="text-[10px] tracking-[0.3em] uppercase text-white/25 mb-2">LATEST SNAPSHOT</div>
              <p className="text-sm text-white/60 leading-relaxed">{data.snapshot.summary}</p>
              <p className="text-[10px] text-white/20 mt-2">{(data.snapshot.generated_at || '').slice(0, 16)}</p>
            </div>
          )}

          {hasIntelligence && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Panel title="Domain Positions" empty={posEntries.length === 0}>
                {posEntries.map(([domain, d]) => {
                  const pos = d.position || 'STABLE';
                  let persistence = '';
                  if (d.detected_at) {
                    try {
                      const h = Math.round((Date.now() - new Date(d.detected_at).getTime()) / 3600000);
                      persistence = formatHours(h);
                    } catch {}
                  }
                  return (
                    <Row key={domain}
                      left={<span className="flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[pos] || 'bg-white/20'}`} />{domain}</span>}
                      right={<span className={`text-xs tracking-wider ${POSITION_COLORS[pos] || 'text-white/40'}`}>{pos}</span>}
                      sub={persistence}
                    />
                  );
                })}
              </Panel>
              <Panel title="Active Escalations" empty={escalations.length === 0}>
                {escalations.map((esc, i) => (
                  <Row key={i} left={esc.domain}
                    right={<span className="text-xs text-white/40">{esc.times_detected || 1}x &middot; {esc.user_action || 'unknown'}</span>}
                  />
                ))}
              </Panel>
              <Panel title="Contradictions" empty={contradictions.length === 0}>
                {contradictions.map((c, i) => (
                  <Row key={i} left={c.domain}
                    right={<span className="text-xs text-amber-400/70">{(c.type || '').replace(/_/g, ' ')} &middot; {c.times_detected || 1}x</span>}
                  />
                ))}
              </Panel>
              <Panel title="Decision Pressure" empty={escalations.length === 0}>
                {escalations.map((r, i) => {
                  const pos = r.position || 'ELEVATED';
                  const level = pos === 'CRITICAL' ? 'CRITICAL' : pos === 'DETERIORATING' ? 'HIGH' : pos === 'ELEVATED' ? 'MODERATE' : 'LOW';
                  return (
                    <Row key={i} left={r.domain}
                      right={<span className={`text-xs tracking-wider ${PRESSURE_COLORS[level]}`}>{level}</span>}
                      sub={r.persistence_hours != null ? formatHours(r.persistence_hours) : ''}
                    />
                  );
                })}
              </Panel>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default OperatorDashboard;
