import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import EnterpriseContactGate from '../components/EnterpriseContactGate';
import { Settings, Clock, Users, AlertTriangle, CheckCircle2, Workflow, Loader2, Plug, Zap, ArrowRight, TrendingUp, BarChart3, Activity, Timer } from 'lucide-react';
import DataConfidence from '../components/DataConfidence';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import IntegrationStatusWidget from '../components/IntegrationStatusWidget';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth, AUTH_STATE } from '../context/SupabaseAuthContext';
import { EmptyStateCard, MetricCard, SectionLabel, SignalCard, SurfaceCard } from '../components/intelligence/SurfacePrimitives';
import LineageBadge from '../components/LineageBadge';
import { PageLoadingState, PageErrorState } from '../components/PageStateComponents';

const Panel = ({ children, className = '', ...rest }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--elev-1)' }} {...rest}>{children}</div>
);

const OperationsPage = () => {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [unifiedOps, setUnifiedOps] = useState(null);
  const navigate = useNavigate();
  const { session, authState } = useSupabaseAuth();
  const { status: integrationStatus, loading: integrationLoading, syncing: integrationSyncing, refresh: refreshIntegrations } = useIntegrationStatus();

  const loadOperationsData = useCallback(async () => {
    if (authState === AUTH_STATE.LOADING && !session?.access_token) return;
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    setLoadError(null);
    setLoading(true);
    setSyncProgress(20);
    try {
      setSyncProgress(50);
      const [snapRes, unifiedRes, cognitionRes] = await Promise.allSettled([
        apiClient.get('/snapshot/latest'),
        apiClient.get('/unified/operations'),
        apiClient.get('/cognition/operations'),
      ]);
      setSyncProgress(85);
      if (snapRes.status === 'fulfilled' && snapRes.value.data?.cognitive) {
        setSnapshot(snapRes.value.data.cognitive);
      }
      if (unifiedRes.status === 'fulfilled' && unifiedRes.value.data) {
        setUnifiedOps(unifiedRes.value.data);
      }
      if (cognitionRes.status === 'fulfilled' && cognitionRes.value.data && cognitionRes.value.data.status !== 'MIGRATION_REQUIRED') {
        setUnifiedOps(prev => ({ ...prev, ...cognitionRes.value.data }));
      }
      setSyncProgress(100);
      const allRejected = [snapRes, unifiedRes, cognitionRes].every((r) => r.status === 'rejected');
      if (allRejected) {
        const r = snapRes.status === 'rejected' ? snapRes.reason : unifiedRes.status === 'rejected' ? unifiedRes.reason : cognitionRes.reason;
        setLoadError(r?.response?.data?.detail || r?.message || 'Unable to load operations data.');
      }
    } catch (e) {
      setLoadError(e?.response?.data?.detail || e?.message || 'Unable to load operations data.');
    } finally {
      setLoading(false);
      setSyncProgress(100);
    }
  }, [session?.access_token, authState]);

  useEffect(() => {
    loadOperationsData();
  }, [loadOperationsData]);

  const hasCRM = integrationStatus?.canonical_truth?.crm_connected;
  const hasAccounting = integrationStatus?.canonical_truth?.accounting_connected;
  const totalConnectedSystems = integrationStatus?.canonical_truth?.total_connected || 0;
  const hasAnyConnectedSystem = totalConnectedSystems > 0;
  const integrationResolved = !integrationLoading && !!integrationStatus;
  const crmIntegration = (integrationStatus?.integrations || []).find(i => i.connected && (i.category||'').toLowerCase() === 'crm');
  const acctIntegration = (integrationStatus?.integrations || []).find(i => i.connected && (i.category||'').toLowerCase() === 'accounting');
  const exec = snapshot?.execution || {};
  const vitals = snapshot?.founder_vitals || {};
  const hasRealOpsData = hasCRM || hasAccounting;

  const timeAgoShort = (iso) => {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
    return new Date(iso).toLocaleDateString('en-AU', { day:'numeric', month:'short' });
  };

  // Operational KPIs — distinct from Revenue
  const OPS_KPIS = [
    exec.sla_breaches != null && { label: 'SLA Breaches', value: String(exec.sla_breaches), unit: 'this week', color: exec.sla_breaches > 0 ? 'var(--lava)' : 'var(--positive)', icon: AlertTriangle, desc: 'Commitments missed against agreed service levels' },
    exec.task_aging != null && { label: 'Task Aging', value: exec.task_aging + '%', unit: 'overdue >7d', color: exec.task_aging > 30 ? 'var(--warning)' : 'var(--positive)', icon: Clock, desc: 'Percentage of open tasks sitting stale beyond threshold' },
    exec.active_tasks != null && { label: 'Tasks Active', value: String(exec.active_tasks), unit: 'in progress', color: 'var(--info)', icon: Workflow, desc: 'Current open tasks across all connected systems' },
    exec.sop_compliance != null && { label: 'SOP Compliance', value: exec.sop_compliance + '%', unit: 'processes on-track', color: exec.sop_compliance > 85 ? 'var(--positive)' : 'var(--warning)', icon: CheckCircle2, desc: 'Standard operating procedures being followed correctly' },
    vitals.calendar && { label: 'Meeting Load', value: vitals.calendar.match(/(\d+)\s+meeting/)?.[1] || '—', unit: 'this week', color: 'var(--info)', icon: Users, desc: vitals.calendar },
    exec.bottleneck && { label: 'Active Bottleneck', value: '1', unit: 'detected', color: 'var(--warning)', icon: Zap, desc: exec.bottleneck.slice(0, 60) },
  ].filter(Boolean);

  const toConfidencePct = (raw) => {
    if (raw == null) return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n)) return undefined;
    return n > 0 && n <= 1 ? n * 100 : n;
  };
  const opsIntelLineage = unifiedOps?.lineage;
  const opsIntelFreshness = unifiedOps?.data_freshness;
  const opsIntelConfidence = toConfidencePct(unifiedOps?.confidence_score);

  const opsSignals = [
    exec.bottleneck ? {
      id: 'operations-active-bottleneck',
      title: 'A live bottleneck is slowing execution',
      detail: String(exec.bottleneck),
      action: 'Assign one owner, one unblock action, and a 48-hour checkpoint.',
      source: 'Observation Events',
      signalType: 'operations_bottleneck',
      timestamp: snapshot?.generated_at || null,
      severity: 'high',
    } : null,
    exec.sla_breaches > 0 ? {
      id: 'operations-sla-breach',
      title: `${exec.sla_breaches} SLA breach${exec.sla_breaches === 1 ? '' : 'es'} need intervention`,
      detail: 'Service commitments are being missed and should be triaged before they affect customer confidence.',
      action: 'Review breached queues and reset delivery ownership for the next service window.',
      source: 'CRM',
      signalType: 'sla_breaches',
      timestamp: crmIntegration?.connected_at || null,
      severity: exec.sla_breaches >= 3 ? 'high' : 'warning',
    } : null,
    exec.task_aging > 30 ? {
      id: 'operations-task-aging',
      title: `${exec.task_aging}% of tasks are ageing beyond threshold`,
      detail: 'Open work is staying stale long enough to create downstream delivery drag.',
      action: 'Clear old tasks or re-sequence the queue so owners can finish what matters first.',
      source: 'CRM',
      signalType: 'task_aging',
      timestamp: crmIntegration?.connected_at || null,
      severity: 'warning',
    } : null,
  ].filter(Boolean);

  const opsSourceRows = [
    { id: 'crm', label: crmIntegration?.provider || 'CRM workflow state', status: hasCRM ? 'Live' : 'Needs connection', detail: hasCRM ? `${exec.active_tasks ?? 0} active tasks and queue states are available.` : 'Connect CRM to activate queue, SLA, and bottleneck tracking.' },
    { id: 'accounting', label: acctIntegration?.provider || 'Accounting pressure spillover', status: hasAccounting ? 'Live' : 'Optional', detail: hasAccounting ? 'Accounting pressure can now be surfaced when it spills into delivery.' : 'Accounting adds cost and profitability context to operational decisions.' },
    { id: 'events', label: 'Observation events', status: opsSignals.length > 0 ? 'Live' : 'Quiet', detail: opsSignals.length > 0 ? `${opsSignals.length} live execution signal${opsSignals.length === 1 ? '' : 's'} are currently shaping priorities.` : 'No operational watchtower event is active in this cycle.' },
  ];

  return (
    <DashboardLayout>
      <EnterpriseContactGate featureName="Delivery & Operations">
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: 'var(--font-ui)' }} data-testid="operations-page">

        {loading && session?.access_token && (
          <PageLoadingState message="Loading delivery & operations..." />
        )}
        {!loading && loadError && session?.access_token && (
          <PageErrorState error={loadError} onRetry={loadOperationsData} moduleName="Operations" />
        )}
        {!(loading && session?.access_token) && !(loadError && session?.access_token) && (
        <>

        {/* Header — operations-specific copy + connection badges */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-medium mb-1.5" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: 'var(--ls-display)', lineHeight: 1.05 }}>Operations.</h1>
            <p className="text-sm text-[var(--ink-secondary)] mb-2" style={{ fontFamily: 'var(--font-ui)' }}>
              Process health, team velocity, and bottleneck detection.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {!integrationResolved ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: 'var(--surface-2)', color: 'var(--ink-secondary)', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>
                  <Loader2 className="w-3 h-3 animate-spin" /> Verifying CRM
                </span>
              ) : hasCRM ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: 'var(--positive-wash)', color: 'var(--positive)', border: '1px solid var(--positive)', fontFamily: 'var(--font-mono)' }}>
                  <CheckCircle2 className="w-3 h-3" /> {crmIntegration?.provider || 'CRM'} Connected
                  {crmIntegration?.connected_at && <span className="opacity-70">• {timeAgoShort(crmIntegration.connected_at)}</span>}
                </span>
              ) : (
                <button onClick={() => navigate('/integrations?category=crm')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all hover:brightness-110"
                  style={{ background: 'var(--lava-wash)', color: 'var(--lava)', border: '1px solid var(--lava)', fontFamily: 'var(--font-mono)' }}
                  data-testid="operations-connect-crm-button">
                  <Plug className="w-3 h-3" /> Connect CRM <ArrowRight className="w-3 h-3" />
                </button>
              )}
              {!integrationResolved ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: 'var(--surface-2)', color: 'var(--ink-secondary)', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>
                  <Loader2 className="w-3 h-3 animate-spin" /> Verifying Accounting
                </span>
              ) : hasAccounting ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: 'var(--positive-wash)', color: 'var(--positive)', border: '1px solid var(--positive)', fontFamily: 'var(--font-mono)' }}>
                  <CheckCircle2 className="w-3 h-3" /> {acctIntegration?.provider || 'Accounting'} Connected
                </span>
              ) : (
                <button onClick={() => navigate('/integrations?category=financial')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all hover:brightness-110"
                  style={{ background: 'var(--lava-wash)', color: 'var(--lava)', border: '1px solid var(--lava)', fontFamily: 'var(--font-mono)' }}
                  data-testid="operations-connect-accounting-button">
                  <Plug className="w-3 h-3" /> Connect Accounting <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <DataConfidence cognitive={snapshot ? { execution: { sla_breaches: exec.sla_breaches } } : null} channelsData={integrationStatus} loading={integrationLoading && !integrationStatus} />
        </div>

        <div className="flex flex-wrap items-center gap-2" data-testid="operations-lineage-badge">
          <LineageBadge lineage={opsIntelLineage} data_freshness={opsIntelFreshness} confidence_score={opsIntelConfidence} compact />
        </div>

        {/* KPI Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          {[
            { label: 'Process Health', value: exec.sop_compliance != null ? `${exec.sop_compliance}%` : (unifiedOps?.health_score ? `${unifiedOps.health_score}%` : '—'), delta: unifiedOps?.health_change || null, color: (exec.sop_compliance || unifiedOps?.health_score || 0) >= 80 ? 'var(--positive)' : 'var(--warning)' },
            { label: 'Meeting Load', value: vitals.calendar ? (vitals.calendar.match(/(\d+)\s+meeting/)?.[1] || '—') : (unifiedOps?.meeting_count || '—'), suffix: '/week', delta: unifiedOps?.meeting_change || null },
            { label: 'Team Velocity', value: exec.active_tasks != null ? String(exec.active_tasks) : (unifiedOps?.velocity_score || '—'), delta: unifiedOps?.velocity_change || null },
            { label: 'Bottlenecks', value: exec.bottleneck ? '1' : (unifiedOps?.bottleneck_count || '0'), delta: null, color: (exec.bottleneck || (unifiedOps?.bottleneck_count || 0) > 3) ? 'var(--danger)' : 'var(--positive)' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)', color: 'var(--ink-muted)', letterSpacing: 'var(--ls-caps)', marginBottom: 12 }}>{kpi.label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', lineHeight: 1, color: kpi.color || 'var(--ink-display)', letterSpacing: 'var(--ls-display)' }}>{kpi.value}</div>
              {kpi.delta != null && (
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, color: kpi.delta > 0 ? 'var(--positive)' : kpi.delta < 0 ? 'var(--danger)' : 'var(--ink-muted)' }}>
                  {kpi.delta > 0 ? '\u2191' : kpi.delta < 0 ? '\u2193' : '\u2192'} {Math.abs(kpi.delta)}%
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]" data-testid="operations-ux-main-grid">
          <div className="space-y-4" data-testid="operations-priority-column">
            <SectionLabel title="What needs unblocking now" detail="This view stays focused on concrete delivery friction, not abstract operations theory." testId="operations-priority-label" />
            <div className="grid gap-4 md:grid-cols-2" data-testid="operations-hero-metrics-grid">
              <MetricCard label="SLA breaches" value={exec.sla_breaches != null ? String(exec.sla_breaches) : '—'} caption="Commitments missed in the current service cycle" tone={exec.sla_breaches > 0 ? 'var(--danger)' : 'var(--positive)'} testId="operations-sla-metric" />
              <MetricCard label="Task aging" value={exec.task_aging != null ? `${exec.task_aging}%` : '—'} caption="Open work sitting stale beyond threshold" tone={exec.task_aging > 30 ? 'var(--warning)' : 'var(--positive)'} testId="operations-aging-metric" />
              <MetricCard label="Tasks in motion" value={exec.active_tasks != null ? String(exec.active_tasks) : '—'} caption="Current in-flight operational workload" tone="var(--info)" testId="operations-active-tasks-metric" />
              <MetricCard label="SOP compliance" value={exec.sop_compliance != null ? `${exec.sop_compliance}%` : '—'} caption="Procedures followed in the latest cycle" tone={exec.sop_compliance > 85 ? 'var(--positive)' : 'var(--warning)'} testId="operations-sop-metric" />
            </div>
            {opsSignals.length > 0 ? opsSignals.map((signal) => (
              <SignalCard key={signal.id} {...signal} testId={signal.id} />
            )) : (
              <EmptyStateCard title="No urgent operational blockage is active." detail="Delivery is currently calm. BIQc will only surface an operations card when workflow pressure becomes real." testId="operations-priority-empty" />
            )}
          </div>

          <div className="space-y-4" data-testid="operations-source-column">
            <SurfaceCard testId="operations-source-health-card">
              <SectionLabel title="Actionability by source" detail="Operations keeps workflow, accounting spillover, and watchtower signals separate so the fix path is obvious." testId="operations-source-health-label" />
              <div className="mt-4 space-y-3" data-testid="operations-source-health-list">
                {opsSourceRows.map((row) => (
                  <div key={row.id} className="rounded-xl border px-3 py-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }} data-testid={`operations-source-health-${row.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-secondary)]" style={{ fontFamily: 'var(--font-mono)' }}>{row.label}</p>
                      <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-secondary)]" style={{ fontFamily: 'var(--font-mono)' }}>{row.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--ink-secondary)]">{row.detail}</p>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>
        </div>

        {/* Sync progress bar */}
        {(loading || (hasAnyConnectedSystem && syncProgress < 100)) && (
          <div className="rounded-xl p-4" style={{ background: 'var(--info-wash)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[var(--info)]" style={{ fontFamily: 'var(--font-mono)' }}>
                {integrationLoading && !integrationResolved
                  ? 'Verifying connected systems…'
                  : !hasAnyConnectedSystem
                    ? 'Waiting for connected operations systems…'
                    : syncProgress < 50
                      ? 'Syncing operational data…'
                      : 'Analysing workflows and SLA status…'}
              </span>
              <span className="text-xs text-[var(--ink-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>{syncProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
              <div className="h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${syncProgress}%`, background: 'linear-gradient(90deg, var(--info), var(--info))' }} />
            </div>
          </div>
        )}

        {!loading && integrationLoading && (
          <Panel>
            <div className="flex items-start gap-3">
              <Loader2 className="w-5 h-5 text-[var(--info)] animate-spin flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-[var(--ink-display)] mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>Verifying operations data sources</p>
                <p className="text-xs text-[var(--ink-muted)]">BIQc is confirming CRM and accounting connections before scoring execution risk and bottlenecks.</p>
              </div>
            </div>
          </Panel>
        )}

        {!loading && !integrationLoading && !hasRealOpsData && (
          <Panel className="py-10">
            <div className="text-center mb-5">
              <Settings className="w-10 h-10 text-[var(--lava)] mx-auto mb-3 opacity-60" />
              <h3 className="text-base font-semibold text-[var(--ink-display)] mb-1" style={{ fontFamily: 'var(--font-display)' }}>Activate Operations Intelligence</h3>
              <p className="text-sm text-[var(--ink-secondary)] max-w-md mx-auto" style={{ fontFamily: 'var(--font-ui)' }}>
                Connect your CRM to monitor task delivery, SLA performance and workflow bottlenecks. Connect accounting to track project profitability and resource costs.
              </p>
            </div>
            <IntegrationStatusWidget
              categories={['crm', 'accounting']}
              status={integrationStatus}
              loading={integrationLoading}
              syncing={integrationSyncing}
              onRefresh={refreshIntegrations}
              emptyStateTitle="Operations intelligence activates with your data"
              emptyStateDesc="Connect CRM or accounting tools to monitor SLA compliance, task bottlenecks, delivery health and workload analysis."
            />
          </Panel>
        )}

        {!loading && hasRealOpsData && (
          <>
            {/* Operations KPI strip — distinct from Revenue */}
            {OPS_KPIS.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {OPS_KPIS.map(m => (
                  <Panel key={m.label}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: m.color + '15' }}>
                        <m.icon className="w-3.5 h-3.5" style={{ color: m.color }} />
                      </div>
                      <span className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>{m.label}</span>
                    </div>
                    <span className="text-2xl font-bold text-[var(--ink-display)] block" style={{ fontFamily: 'var(--font-mono)' }}>{m.value}</span>
                    <span className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>{m.unit}</span>
                    {m.desc && <p className="text-[10px] text-[var(--ink-muted)] mt-1.5 leading-snug">{m.desc}</p>}
                  </Panel>
                ))}
              </div>
            )}

            {OPS_KPIS.length === 0 && (
              <Panel>
                <div className="flex items-start gap-3">
                  <Loader2 className="w-5 h-5 text-[var(--lava)] animate-spin flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink-display)] mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>
                      {hasCRM ? 'HubSpot connected — pulling operational metrics…' : 'Accounting connected — loading financial operations data…'}
                    </p>
                    <p className="text-xs text-[var(--ink-muted)]">First sync may take 1–3 minutes. Task aging, SLA and bottleneck data will appear once imported.</p>
                  </div>
                </div>
              </Panel>
            )}
          </>
        )}

        {/* ═══ PROCESS HEALTH TABLE ═══ */}
        <Panel data-testid="operations-process-health">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4" style={{ color: 'var(--lava)' }} />
            <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Process Health</h3>
            <span className="text-[10px] ml-auto" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>5 core processes monitored</span>
          </div>
          {/* Table header */}
          <div className="grid gap-2" style={{ gridTemplateColumns: '1.5fr 0.7fr 0.7fr 1fr' }}>
            <div className="text-[10px] uppercase tracking-[0.08em] pb-2" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', borderBottom: '1px solid var(--border)' }}>Process</div>
            <div className="text-[10px] uppercase tracking-[0.08em] pb-2 text-right" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', borderBottom: '1px solid var(--border)' }}>Current</div>
            <div className="text-[10px] uppercase tracking-[0.08em] pb-2 text-right" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', borderBottom: '1px solid var(--border)' }}>Target</div>
            <div className="text-[10px] uppercase tracking-[0.08em] pb-2 text-right" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', borderBottom: '1px solid var(--border)' }}>Health</div>
          </div>
          {/* Table rows */}
          {[
            { process: 'Lead Response Time', current: '2.4h', target: '<1h', pct: 40, color: 'var(--warning)' },
            { process: 'Invoice Approval', current: '4.5 days', target: '<2 days', pct: 55, color: 'var(--warning)' },
            { process: 'Onboarding', current: '12 days', target: '<7 days', pct: 42, color: 'var(--warning)' },
            { process: 'Support Resolution', current: '6.2h', target: '<4h', pct: 65, color: 'var(--positive)' },
            { process: 'Contract Processing', current: '3.1 days', target: '<2 days', pct: 64, color: 'var(--positive)' },
          ].map((row) => (
            <div key={row.process} className="grid items-center gap-2 py-3" style={{ gridTemplateColumns: '1.5fr 0.7fr 0.7fr 1fr', borderBottom: '1px solid var(--border)' }}>
              <span className="text-sm font-medium" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}>{row.process}</span>
              <span className="text-sm text-right font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-display)' }}>{row.current}</span>
              <span className="text-[11px] text-right" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>{row.target}</span>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[10px] font-semibold" style={{ fontFamily: 'var(--font-mono)', color: row.color }}>{row.pct}%</span>
                <div className="w-[80px] h-[5px] rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: row.color }} />
                </div>
              </div>
            </div>
          ))}
        </Panel>

        {/* ═══ TEAM VELOCITY CARDS ═══ */}
        <Panel data-testid="operations-team-velocity">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4" style={{ color: 'var(--lava)' }} />
            <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Team Velocity</h3>
            <span className="text-[10px] ml-auto" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>Task throughput this week</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { initials: 'SC', name: 'Sarah Chen', role: 'Operations Lead', tasks: 24, meetings: 8.2, completion: 92 },
              { initials: 'MW', name: 'Marcus Webb', role: 'Process Manager', tasks: 18, meetings: 12.1, completion: 87 },
              { initials: 'PP', name: 'Priya Patel', role: 'QA Lead', tasks: 31, meetings: 5.5, completion: 96 },
            ].map((member) => (
              <div key={member.initials} className="rounded-lg p-5 text-center" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center text-sm font-semibold"
                  style={{ background: 'linear-gradient(135deg, var(--surface-2), var(--surface))', color: 'var(--ink-display)', fontFamily: 'var(--font-mono)' }}>
                  {member.initials}
                </div>
                <div className="text-sm font-semibold mb-0.5" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>{member.name}</div>
                <div className="text-[11px] mb-3" style={{ color: 'var(--ink-muted)' }}>{member.role}</div>
                <div className="flex justify-center gap-4">
                  <div className="text-center">
                    <div className="text-base font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-display)' }}>{member.tasks}</div>
                    <div className="text-[9px] uppercase tracking-[0.08em]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>Tasks/wk</div>
                  </div>
                  <div className="text-center">
                    <div className="text-base font-semibold" style={{ fontFamily: 'var(--font-mono)', color: member.meetings > 10 ? 'var(--warning)' : 'var(--ink-display)' }}>{member.meetings}h</div>
                    <div className="text-[9px] uppercase tracking-[0.08em]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>Meetings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-base font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-display)' }}>{member.completion}%</div>
                    <div className="text-[9px] uppercase tracking-[0.08em]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>Complete</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* ═══ MEETING LOAD CHART ═══ */}
        <Panel data-testid="operations-meeting-load">
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-4 h-4" style={{ color: 'var(--lava)' }} />
            <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Weekly Meeting Load</h3>
          </div>
          <div style={{ position: 'relative', paddingBottom: '8px' }}>
            {/* Threshold line at 6h */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${(6 / 10) * 140 + 32}px`, borderTop: '2px dashed var(--danger)', zIndex: 1 }}>
              <span className="text-[10px] font-semibold" style={{ position: 'absolute', right: 0, top: '-16px', fontFamily: 'var(--font-mono)', color: 'var(--danger)' }}>Overload threshold (6h)</span>
            </div>
            {/* Bar chart */}
            <div className="flex items-end gap-3" style={{ height: '172px', paddingTop: '32px' }}>
              {[
                { day: 'Mon', hours: 4.2 },
                { day: 'Tue', hours: 6.8 },
                { day: 'Wed', hours: 8.1 },
                { day: 'Thu', hours: 5.3 },
                { day: 'Fri', hours: 3.9 },
              ].map((d) => {
                const maxH = 10;
                const barHeight = Math.max((d.hours / maxH) * 140, 8);
                const overThreshold = d.hours > 6;
                const barColor = overThreshold ? 'var(--warning)' : 'var(--lava)';
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[11px] font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-display)' }}>{d.hours}h</span>
                    <div className="w-full max-w-[40px] rounded-t" style={{ height: `${barHeight}px`, background: barColor, transition: 'opacity 0.15s' }} />
                    <span className="text-[10px] font-medium" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>{d.day}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>

            {/* Bottleneck */}
            {exec.bottleneck && (
              <Panel>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--warning-wash)' }}>
                    <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--ink-display)] mb-1" style={{ fontFamily: 'var(--font-display)' }}>Active Bottleneck</h3>
                    <p className="text-sm text-[var(--ink-secondary)] leading-relaxed">{exec.bottleneck}</p>
                  </div>
                </div>
              </Panel>
            )}

            {/* Recommendations from snapshot */}
            {exec.recs?.length > 0 && (
              <Panel>
                <h3 className="text-sm font-semibold text-[var(--ink-display)] mb-3" style={{ fontFamily: 'var(--font-display)' }}>Recommendations</h3>
                <div className="space-y-2">
                  {exec.recs.map((r, i) => (
                    <div key={i} className="p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                      <p className="text-sm text-[var(--ink-secondary)] leading-relaxed">{r}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* ═══ CROSS-DOMAIN OPERATIONS INTELLIGENCE ═══ */}
            {/* Cognition operations data — shows when SQL migrations deployed */}
            {unifiedOps?.instability_indices && (
              <Panel>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[var(--positive)]" />
                    <h3 className="text-sm font-semibold text-[var(--ink-display)]" style={{ fontFamily: 'var(--font-display)' }}>Operations Intelligence</h3>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'var(--positive-wash)', color: 'var(--positive)', fontFamily: 'var(--font-mono)' }}>COGNITION CORE</span>
                </div>
                <div className="mb-3" data-testid="operations-lineage-badge-intel-panel">
                  <LineageBadge lineage={opsIntelLineage} data_freshness={opsIntelFreshness} confidence_score={opsIntelConfidence} compact />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: 'anomaly_density_score', label: 'ADS', title: 'Anomaly Density' },
                    { key: 'execution_gap_index', label: 'EGI', title: 'Execution Gap' },
                    { key: 'sop_deviation_score', label: 'SDS', title: 'SOP Deviation' },
                    { key: 'bottleneck_severity', label: 'BNS', title: 'Bottleneck Severity' },
                  ].map(({ key, label, title }) => {
                    const val = unifiedOps.instability_indices[key];
                    if (val == null) return null;
                    const pct = Math.round(val * 100);
                    const ic = pct > 60 ? 'var(--danger)' : pct > 30 ? 'var(--warning)' : 'var(--positive)';
                    return (
                      <div key={key} className="p-3 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                        <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: ic, fontFamily: 'var(--font-mono)' }}>{label}</span>
                        <div className="text-2xl font-bold" style={{ color: ic, fontFamily: 'var(--font-mono)' }}>{pct}%</div>
                        <span className="text-[9px]" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>{title}</span>
                        <div className="h-1 rounded-full mt-2" style={{ background: ic + '20' }}>
                          <div className="h-1 rounded-full" style={{ background: ic, width: pct + '%' }} />
                        </div>
                      </div>
                    );
                  }).filter(Boolean)}
                </div>
              </Panel>
            )}

            {unifiedOps?.signals && (
              <>
                {unifiedOps.signals.bottlenecks?.length > 0 && (
                  <Panel>
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-4 h-4 text-[var(--lava)]" />
                      <h3 className="text-sm font-semibold text-[var(--ink-display)]" style={{ fontFamily: 'var(--font-display)' }}>Cross-Domain Bottlenecks</h3>
                    </div>
                    <div className="space-y-2">
                      {unifiedOps.signals.bottlenecks.map((b, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'var(--lava-wash)', border: '1px solid var(--border)' }}>
                          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--lava)' }} />
                          <div>
                            <p className="text-xs text-[var(--ink-secondary)]">{b.detail}</p>
                            <span className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>Source: {b.source}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}

                {unifiedOps.signals.capacity_alerts?.length > 0 && (
                  <Panel>
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="w-4 h-4 text-[var(--warning)]" />
                      <h3 className="text-sm font-semibold text-[var(--ink-display)]" style={{ fontFamily: 'var(--font-display)' }}>Capacity Alerts</h3>
                    </div>
                    <div className="space-y-2">
                      {unifiedOps.signals.capacity_alerts.map((a, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'var(--warning-wash)', border: '1px solid var(--border)' }}>
                          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--warning)' }} />
                          <div>
                            <p className="text-xs text-[var(--ink-secondary)]">{a.detail}</p>
                            <span className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>Source: {a.source}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}
              </>
            )}
        </>
        )}
        </div>
      </EnterpriseContactGate>
    </DashboardLayout>
  );
};

export default OperationsPage;
