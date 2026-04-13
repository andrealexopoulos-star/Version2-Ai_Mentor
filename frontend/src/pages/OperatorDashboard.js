import { CognitiveMesh } from '../components/LoadingSystems';
import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';
import { Loader2, AlertCircle, Plug, Activity, Radio, Server, Database, Cpu, Zap, CheckCircle2, XCircle, Clock, Play, Pause } from 'lucide-react';
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
    <div className="text-[10px] uppercase tracking-[0.1em] font-semibold mb-1" style={{ color: '#708499', fontFamily: fontFamily.mono }}>{label}</div>
    <div className="text-[28px] font-bold leading-none" style={{ color: valueColor || '#EDF1F7', fontFamily: fontFamily.mono }}>{value}</div>
    {sub && <div className="text-xs mt-1" style={{ color: '#708499' }}>{sub}</div>}
  </div>
);

// ── Automation Job Row ───────────────────────────────────────────────────────
const JOB_STATUS_STYLE = {
  running: { bg: 'rgba(59,130,246,0.12)', color: '#60A5FA' },
  idle:    { bg: 'rgba(16,185,129,0.12)', color: '#10B981' },
  error:   { bg: 'rgba(239,68,68,0.12)', color: '#EF4444' },
  scheduled: { bg: 'rgba(100,116,139,0.12)', color: '#94A3B8' },
};

const AutomationJob = ({ name, desc, schedule, status }) => {
  const st = JOB_STATUS_STYLE[status] || JOB_STATUS_STYLE.idle;
  return (
    <div className="rounded-xl p-4 grid gap-3" style={{ background: 'var(--biqc-bg-card, rgba(255,255,255,0.02))', border: '1px solid var(--biqc-border, rgba(255,255,255,0.06))', gridTemplateColumns: '1fr auto auto', alignItems: 'center' }}>
      <div>
        <div className="text-sm font-semibold" style={{ color: '#EDF1F7', fontFamily: fontFamily.body }}>{name}</div>
        <div className="text-xs mt-0.5" style={{ color: '#708499' }}>{desc}</div>
      </div>
      <div className="text-xs" style={{ color: '#708499', fontFamily: fontFamily.mono }}>{schedule}</div>
      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap"
        style={{ background: st.bg, color: st.color, fontFamily: fontFamily.mono, letterSpacing: '0.05em' }}>
        {status}
      </span>
    </div>
  );
};

// ── Run Result Badge ─────────────────────────────────────────────────────────
const RUN_RESULT_STYLE = {
  success: { bg: 'rgba(16,185,129,0.12)', color: '#10B981' },
  failed:  { bg: 'rgba(239,68,68,0.12)', color: '#EF4444' },
  partial: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' },
};

// ── Health Bar ───────────────────────────────────────────────────────────────
const HealthItem = ({ name, indicatorOk, barPct, barColor, metaLeft, metaRight }) => (
  <div className="rounded-xl p-4" style={{ background: 'var(--biqc-bg-card, rgba(255,255,255,0.02))', border: '1px solid var(--biqc-border, rgba(255,255,255,0.06))' }}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-semibold" style={{ color: '#EDF1F7', fontFamily: fontFamily.body }}>{name}</span>
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: indicatorOk ? '#16A34A' : '#DC2626' }} />
    </div>
    <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, background: barColor || '#16A34A' }} />
    </div>
    <div className="flex justify-between text-xs" style={{ color: '#708499' }}>
      <span>{metaLeft}</span>
      <span>{metaRight}</span>
    </div>
  </div>
);

// ── Static data for automation pipeline ──────────────────────────────────────
const AUTOMATION_JOBS = [
  { name: 'Signal Enrichment Worker', desc: 'Enriches unenriched watchtower_insights with AI explanations and urgency tiers', schedule: 'Every 60s', status: 'running' },
  { name: 'Merge.dev CRM Sync', desc: 'Pulls latest contacts, deals, and activities from HubSpot via Merge unified API', schedule: 'Every 15m', status: 'idle' },
  { name: 'Email Ingestion Pipeline', desc: 'Processes new Outlook/Gmail messages, extracts signals, updates observation_events', schedule: 'Every 5m', status: 'running' },
  { name: 'Watchtower Event Promotion', desc: 'Triggers on new critical/high observation_events, maps and inserts into watchtower_events', schedule: 'Trigger', status: 'idle' },
  { name: 'SEMrush Domain Intel Refresh', desc: 'Weekly pull of domain authority, keyword rankings, and competitor traffic estimates', schedule: 'Weekly Mon 02:00', status: 'scheduled' },
  { name: 'Signal Grouping Pass', desc: 'Cross-domain correlation of enriched insights with matching urgency tiers', schedule: 'On enrichment', status: 'idle' },
];

const RECENT_RUNS = [
  { job: 'Signal Enrichment', started: '09:14 AM', duration: '2.4s', records: 3, result: 'success' },
  { job: 'Email Ingestion', started: '09:10 AM', duration: '8.1s', records: 12, result: 'success' },
  { job: 'Merge CRM Sync', started: '09:00 AM', duration: '14.7s', records: 247, result: 'success' },
  { job: 'Signal Enrichment', started: '09:13 AM', duration: '1.8s', records: 0, result: 'success' },
  { job: 'SEMrush Refresh', started: 'Mon 02:00', duration: '42s', records: 524, result: 'partial' },
  { job: 'Email Ingestion', started: '09:05 AM', duration: '6.3s', records: 8, result: 'success' },
];

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
              <h1 className="font-medium" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1.15 }}>Operator Dashboard</h1>
              <p className="text-xs mt-1" style={{ color: '#708499' }}>Read-only intelligence state</p>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#708499' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#16A34A', animation: 'pulse 2s ease-in-out infinite' }} />
              All systems operational
            </div>
          </div>

          {/* ═══ Status Grid ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatusCard label="Active Jobs" value="4" sub="2 running, 2 scheduled" />
            <StatusCard label="Uptime (30d)" value="99.8%" valueColor="#16A34A" sub="4.3h downtime" />
            <StatusCard label="API Calls Today" value="1,847" sub="Avg: 1,500/day" />
            <StatusCard label="Error Rate" value="0.3%" valueColor="#16A34A" sub="Below 1% threshold" />
          </div>

          {/* ═══ Automation Pipeline ═══ */}
          <div>
            <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: fontFamily.display, color: '#EDF1F7' }}>Automation Pipeline</h2>
            <div className="space-y-3">
              {AUTOMATION_JOBS.map((job, i) => (
                <AutomationJob key={i} name={job.name} desc={job.desc} schedule={job.schedule} status={job.status} />
              ))}
            </div>
          </div>

          {/* ═══ Recent Runs Table ═══ */}
          <div>
            <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: fontFamily.display, color: '#EDF1F7' }}>Recent Runs</h2>
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--biqc-bg-card, rgba(255,255,255,0.02))', border: '1px solid var(--biqc-border, rgba(255,255,255,0.06))' }}>
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Job', 'Started', 'Duration', 'Records', 'Result'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5"
                        style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#708499', fontFamily: fontFamily.mono, background: 'rgba(30,45,61,0.3)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RECENT_RUNS.map((run, i) => {
                    const rs = RUN_RESULT_STYLE[run.result] || RUN_RESULT_STYLE.success;
                    return (
                      <tr key={i} className="transition-colors hover:bg-white/[0.02]"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: '#EDF1F7', fontFamily: fontFamily.body }}>{run.job}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#708499' }}>{run.started}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#708499', fontFamily: fontFamily.mono }}>{run.duration}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#708499', fontFamily: fontFamily.mono }}>{run.records}</td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: rs.bg, color: rs.color, fontFamily: fontFamily.mono, letterSpacing: '0.05em' }}>
                            {run.result}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ System Health ═══ */}
          <div>
            <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: fontFamily.display, color: '#EDF1F7' }}>System Health</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <HealthItem name="API Backend" indicatorOk barPct={23} barColor="#16A34A" metaLeft="CPU: 23%" metaRight="Memory: 412 MB" />
              <HealthItem name="Supabase Database" indicatorOk barPct={41} barColor="#16A34A" metaLeft="Connections: 12/100" metaRight="Storage: 1.2 GB" />
              <HealthItem name="Edge Functions" indicatorOk barPct={8} barColor="#16A34A" metaLeft="37/38 healthy" metaRight="Avg latency: 142ms" />
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
