import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import EnterpriseContactGate from '../components/EnterpriseContactGate';
import { Settings, Clock, Users, AlertTriangle, CheckCircle2, Workflow, Loader2, Plug, Zap, ArrowRight, TrendingUp, BarChart3, Activity, Timer } from 'lucide-react';
import DataConfidence from '../components/DataConfidence';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import IntegrationStatusWidget from '../components/IntegrationStatusWidget';
import { fontFamily } from '../design-system/tokens';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth, AUTH_STATE } from '../context/SupabaseAuthContext';
import { EmptyStateCard, MetricCard, SectionLabel, SignalCard, SurfaceCard } from '../components/intelligence/SurfacePrimitives';
import LineageBadge from '../components/LineageBadge';
import { PageLoadingState, PageErrorState } from '../components/PageStateComponents';

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>{children}</div>
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
    exec.sla_breaches != null && { label: 'SLA Breaches', value: String(exec.sla_breaches), unit: 'this week', color: exec.sla_breaches > 0 ? '#E85D00' : '#10B981', icon: AlertTriangle, desc: 'Commitments missed against agreed service levels' },
    exec.task_aging != null && { label: 'Task Aging', value: exec.task_aging + '%', unit: 'overdue >7d', color: exec.task_aging > 30 ? '#F59E0B' : '#10B981', icon: Clock, desc: 'Percentage of open tasks sitting stale beyond threshold' },
    exec.active_tasks != null && { label: 'Tasks Active', value: String(exec.active_tasks), unit: 'in progress', color: '#3B82F6', icon: Workflow, desc: 'Current open tasks across all connected systems' },
    exec.sop_compliance != null && { label: 'SOP Compliance', value: exec.sop_compliance + '%', unit: 'processes on-track', color: exec.sop_compliance > 85 ? '#10B981' : '#F59E0B', icon: CheckCircle2, desc: 'Standard operating procedures being followed correctly' },
    vitals.calendar && { label: 'Meeting Load', value: vitals.calendar.match(/(\d+)\s+meeting/)?.[1] || '—', unit: 'this week', color: '#8B5CF6', icon: Users, desc: vitals.calendar },
    exec.bottleneck && { label: 'Active Bottleneck', value: '1', unit: 'detected', color: '#F59E0B', icon: Zap, desc: exec.bottleneck.slice(0, 60) },
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
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: fontFamily.body }} data-testid="operations-page">

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
            <h1 className="font-medium mb-1.5" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>Operations.</h1>
            <p className="text-sm text-[#8FA0B8] mb-2" style={{ fontFamily: fontFamily.body }}>
              Process health, team velocity, and bottleneck detection.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {!integrationResolved ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: 'rgba(100,116,139,0.12)', color: '#8FA0B8', border: '1px solid rgba(100,116,139,0.24)', fontFamily: fontFamily.mono }}>
                  <Loader2 className="w-3 h-3 animate-spin" /> Verifying CRM
                </span>
              ) : hasCRM ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)', fontFamily: fontFamily.mono }}>
                  <CheckCircle2 className="w-3 h-3" /> {crmIntegration?.provider || 'CRM'} Connected
                  {crmIntegration?.connected_at && <span className="opacity-70">• {timeAgoShort(crmIntegration.connected_at)}</span>}
                </span>
              ) : (
                <button onClick={() => navigate('/integrations?category=crm')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all hover:brightness-110"
                  style={{ background: 'rgba(232,93,0,0.1)', color: '#E85D00', border: '1px solid rgba(232,93,0,0.2)', fontFamily: fontFamily.mono }}
                  data-testid="operations-connect-crm-button">
                  <Plug className="w-3 h-3" /> Connect CRM <ArrowRight className="w-3 h-3" />
                </button>
              )}
              {!integrationResolved ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: 'rgba(100,116,139,0.12)', color: '#8FA0B8', border: '1px solid rgba(100,116,139,0.24)', fontFamily: fontFamily.mono }}>
                  <Loader2 className="w-3 h-3 animate-spin" /> Verifying Accounting
                </span>
              ) : hasAccounting ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)', fontFamily: fontFamily.mono }}>
                  <CheckCircle2 className="w-3 h-3" /> {acctIntegration?.provider || 'Accounting'} Connected
                </span>
              ) : (
                <button onClick={() => navigate('/integrations?category=financial')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all hover:brightness-110"
                  style={{ background: 'rgba(232,93,0,0.1)', color: '#E85D00', border: '1px solid rgba(232,93,0,0.2)', fontFamily: fontFamily.mono }}
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

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]" data-testid="operations-ux-main-grid">
          <div className="space-y-4" data-testid="operations-priority-column">
            <SectionLabel title="What needs unblocking now" detail="This view stays focused on concrete delivery friction, not abstract operations theory." testId="operations-priority-label" />
            <div className="grid gap-4 md:grid-cols-2" data-testid="operations-hero-metrics-grid">
              <MetricCard label="SLA breaches" value={exec.sla_breaches != null ? String(exec.sla_breaches) : '—'} caption="Commitments missed in the current service cycle" tone={exec.sla_breaches > 0 ? '#EF4444' : '#10B981'} testId="operations-sla-metric" />
              <MetricCard label="Task aging" value={exec.task_aging != null ? `${exec.task_aging}%` : '—'} caption="Open work sitting stale beyond threshold" tone={exec.task_aging > 30 ? '#F59E0B' : '#10B981'} testId="operations-aging-metric" />
              <MetricCard label="Tasks in motion" value={exec.active_tasks != null ? String(exec.active_tasks) : '—'} caption="Current in-flight operational workload" tone="#3B82F6" testId="operations-active-tasks-metric" />
              <MetricCard label="SOP compliance" value={exec.sop_compliance != null ? `${exec.sop_compliance}%` : '—'} caption="Procedures followed in the latest cycle" tone={exec.sop_compliance > 85 ? '#10B981' : '#F59E0B'} testId="operations-sop-metric" />
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
                  <div key={row.id} className="rounded-xl border px-3 py-3" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg)' }} data-testid={`operations-source-health-${row.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>{row.label}</p>
                      <span className="text-[10px] uppercase tracking-[0.14em] text-[#CBD5E1]" style={{ fontFamily: fontFamily.mono }}>{row.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-[#CBD5E1]">{row.detail}</p>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>
        </div>

        {/* Sync progress bar */}
        {(loading || (hasAnyConnectedSystem && syncProgress < 100)) && (
          <div className="rounded-xl p-4" style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#3B82F6]" style={{ fontFamily: fontFamily.mono }}>
                {integrationLoading && !integrationResolved
                  ? 'Verifying connected systems…'
                  : !hasAnyConnectedSystem
                    ? 'Waiting for connected operations systems…'
                    : syncProgress < 50
                      ? 'Syncing operational data…'
                      : 'Analysing workflows and SLA status…'}
              </span>
              <span className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{syncProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full" style={{ background: '#1E2D3D' }}>
              <div className="h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${syncProgress}%`, background: 'linear-gradient(90deg, #3B82F6, #60A5FA)' }} />
            </div>
          </div>
        )}

        {!loading && integrationLoading && (
          <Panel>
            <div className="flex items-start gap-3">
              <Loader2 className="w-5 h-5 text-[#3B82F6] animate-spin flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-[#EDF1F7] mb-0.5" style={{ fontFamily: fontFamily.display }}>Verifying operations data sources</p>
                <p className="text-xs text-[#64748B]">BIQc is confirming CRM and accounting connections before scoring execution risk and bottlenecks.</p>
              </div>
            </div>
          </Panel>
        )}

        {!loading && !integrationLoading && !hasRealOpsData && (
          <Panel className="py-10">
            <div className="text-center mb-5">
              <Settings className="w-10 h-10 text-[#E85D00] mx-auto mb-3 opacity-60" />
              <h3 className="text-base font-semibold text-[#EDF1F7] mb-1" style={{ fontFamily: fontFamily.display }}>Activate Operations Intelligence</h3>
              <p className="text-sm text-[#8FA0B8] max-w-md mx-auto" style={{ fontFamily: fontFamily.body }}>
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
                      <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{m.label}</span>
                    </div>
                    <span className="text-2xl font-bold text-[#EDF1F7] block" style={{ fontFamily: fontFamily.mono }}>{m.value}</span>
                    <span className="text-[10px] text-[#4A5568]" style={{ fontFamily: fontFamily.mono }}>{m.unit}</span>
                    {m.desc && <p className="text-[10px] text-[#64748B] mt-1.5 leading-snug">{m.desc}</p>}
                  </Panel>
                ))}
              </div>
            )}

            {OPS_KPIS.length === 0 && (
              <Panel>
                <div className="flex items-start gap-3">
                  <Loader2 className="w-5 h-5 text-[#E85D00] animate-spin flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[#EDF1F7] mb-0.5" style={{ fontFamily: fontFamily.display }}>
                      {hasCRM ? 'HubSpot connected — pulling operational metrics…' : 'Accounting connected — loading financial operations data…'}
                    </p>
                    <p className="text-xs text-[#64748B]">First sync may take 1–3 minutes. Task aging, SLA and bottleneck data will appear once imported.</p>
                  </div>
                </div>
              </Panel>
            )}
          </>
        )}

        {/* ═══ PROCESS HEALTH TABLE ═══ */}
        <Panel data-testid="operations-process-health">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4" style={{ color: '#E85D00' }} />
            <h3 className="text-sm font-semibold" style={{ fontFamily: fontFamily.display, color: '#EDF1F7' }}>Process Health</h3>
            <span className="text-[10px] ml-auto" style={{ fontFamily: fontFamily.mono, color: '#708499' }}>5 core processes monitored</span>
          </div>
          {/* Table header */}
          <div className="grid gap-2" style={{ gridTemplateColumns: '1.5fr 0.7fr 0.7fr 1fr' }}>
            <div className="text-[10px] uppercase tracking-[0.08em] pb-2" style={{ fontFamily: fontFamily.mono, color: '#708499', borderBottom: '1px solid var(--biqc-border)' }}>Process</div>
            <div className="text-[10px] uppercase tracking-[0.08em] pb-2 text-right" style={{ fontFamily: fontFamily.mono, color: '#708499', borderBottom: '1px solid var(--biqc-border)' }}>Current</div>
            <div className="text-[10px] uppercase tracking-[0.08em] pb-2 text-right" style={{ fontFamily: fontFamily.mono, color: '#708499', borderBottom: '1px solid var(--biqc-border)' }}>Target</div>
            <div className="text-[10px] uppercase tracking-[0.08em] pb-2 text-right" style={{ fontFamily: fontFamily.mono, color: '#708499', borderBottom: '1px solid var(--biqc-border)' }}>Health</div>
          </div>
          {/* Table rows */}
          {[
            { process: 'Lead Response Time', current: '2.4h', target: '<1h', pct: 40, color: '#F59E0B' },
            { process: 'Invoice Approval', current: '4.5 days', target: '<2 days', pct: 55, color: '#F59E0B' },
            { process: 'Onboarding', current: '12 days', target: '<7 days', pct: 42, color: '#F59E0B' },
            { process: 'Support Resolution', current: '6.2h', target: '<4h', pct: 65, color: '#16A34A' },
            { process: 'Contract Processing', current: '3.1 days', target: '<2 days', pct: 64, color: '#16A34A' },
          ].map((row) => (
            <div key={row.process} className="grid items-center gap-2 py-3" style={{ gridTemplateColumns: '1.5fr 0.7fr 0.7fr 1fr', borderBottom: '1px solid var(--biqc-border)' }}>
              <span className="text-sm font-medium" style={{ color: '#EDF1F7', fontFamily: fontFamily.body }}>{row.process}</span>
              <span className="text-sm text-right font-semibold" style={{ fontFamily: fontFamily.mono, color: '#EDF1F7' }}>{row.current}</span>
              <span className="text-[11px] text-right" style={{ fontFamily: fontFamily.mono, color: '#708499' }}>{row.target}</span>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[10px] font-semibold" style={{ fontFamily: fontFamily.mono, color: row.color }}>{row.pct}%</span>
                <div className="w-[80px] h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(112,132,153,0.15)' }}>
                  <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: row.color }} />
                </div>
              </div>
            </div>
          ))}
        </Panel>

        {/* ═══ TEAM VELOCITY CARDS ═══ */}
        <Panel data-testid="operations-team-velocity">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4" style={{ color: '#E85D00' }} />
            <h3 className="text-sm font-semibold" style={{ fontFamily: fontFamily.display, color: '#EDF1F7' }}>Team Velocity</h3>
            <span className="text-[10px] ml-auto" style={{ fontFamily: fontFamily.mono, color: '#708499' }}>Task throughput this week</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { initials: 'SC', name: 'Sarah Chen', role: 'Operations Lead', tasks: 24, meetings: 8.2, completion: 92 },
              { initials: 'MW', name: 'Marcus Webb', role: 'Process Manager', tasks: 18, meetings: 12.1, completion: 87 },
              { initials: 'PP', name: 'Priya Patel', role: 'QA Lead', tasks: 31, meetings: 5.5, completion: 96 },
            ].map((member) => (
              <div key={member.initials} className="rounded-lg p-5 text-center" style={{ background: 'rgba(14,22,40,0.6)', border: '1px solid var(--biqc-border)' }}>
                <div className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center text-sm font-semibold"
                  style={{ background: 'linear-gradient(135deg, #3B4F6B, #506680)', color: '#EDF1F7', fontFamily: fontFamily.mono }}>
                  {member.initials}
                </div>
                <div className="text-sm font-semibold mb-0.5" style={{ color: '#EDF1F7', fontFamily: fontFamily.display }}>{member.name}</div>
                <div className="text-[11px] mb-3" style={{ color: '#708499' }}>{member.role}</div>
                <div className="flex justify-center gap-4">
                  <div className="text-center">
                    <div className="text-base font-semibold" style={{ fontFamily: fontFamily.mono, color: '#EDF1F7' }}>{member.tasks}</div>
                    <div className="text-[9px] uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: '#708499' }}>Tasks/wk</div>
                  </div>
                  <div className="text-center">
                    <div className="text-base font-semibold" style={{ fontFamily: fontFamily.mono, color: member.meetings > 10 ? '#F59E0B' : '#EDF1F7' }}>{member.meetings}h</div>
                    <div className="text-[9px] uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: '#708499' }}>Meetings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-base font-semibold" style={{ fontFamily: fontFamily.mono, color: '#EDF1F7' }}>{member.completion}%</div>
                    <div className="text-[9px] uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: '#708499' }}>Complete</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* ═══ MEETING LOAD CHART ═══ */}
        <Panel data-testid="operations-meeting-load">
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-4 h-4" style={{ color: '#E85D00' }} />
            <h3 className="text-sm font-semibold" style={{ fontFamily: fontFamily.display, color: '#EDF1F7' }}>Weekly Meeting Load</h3>
          </div>
          <div style={{ position: 'relative', paddingBottom: '8px' }}>
            {/* Threshold line at 6h */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${(6 / 10) * 140 + 32}px`, borderTop: '2px dashed #DC2626', zIndex: 1 }}>
              <span className="text-[10px] font-semibold" style={{ position: 'absolute', right: 0, top: '-16px', fontFamily: fontFamily.mono, color: '#DC2626' }}>Overload threshold (6h)</span>
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
                const barColor = overThreshold ? '#F59E0B' : '#E85D00';
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[11px] font-semibold" style={{ fontFamily: fontFamily.mono, color: '#EDF1F7' }}>{d.hours}h</span>
                    <div className="w-full max-w-[40px] rounded-t" style={{ height: `${barHeight}px`, background: barColor, transition: 'opacity 0.15s' }} />
                    <span className="text-[10px] font-medium" style={{ fontFamily: fontFamily.mono, color: '#708499' }}>{d.day}</span>
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
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#F59E0B15' }}>
                    <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#EDF1F7] mb-1" style={{ fontFamily: fontFamily.display }}>Active Bottleneck</h3>
                    <p className="text-sm text-[#8FA0B8] leading-relaxed">{exec.bottleneck}</p>
                  </div>
                </div>
              </Panel>
            )}

            {/* Recommendations from snapshot */}
            {exec.recs?.length > 0 && (
              <Panel>
                <h3 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: fontFamily.display }}>Recommendations</h3>
                <div className="space-y-2">
                  {exec.recs.map((r, i) => (
                    <div key={i} className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                      <p className="text-sm text-[#8FA0B8] leading-relaxed">{r}</p>
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
                    <Zap className="w-4 h-4 text-[#10B981]" />
                    <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Operations Intelligence</h3>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: '#10B98115', color: '#10B981', fontFamily: fontFamily.mono }}>COGNITION CORE</span>
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
                    const ic = pct > 60 ? '#EF4444' : pct > 30 ? '#F59E0B' : '#10B981';
                    return (
                      <div key={key} className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: ic, fontFamily: fontFamily.mono }}>{label}</span>
                        <div className="text-2xl font-bold" style={{ color: ic, fontFamily: fontFamily.mono }}>{pct}%</div>
                        <span className="text-[9px]" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{title}</span>
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
                      <AlertTriangle className="w-4 h-4 text-[#E85D00]" />
                      <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Cross-Domain Bottlenecks</h3>
                    </div>
                    <div className="space-y-2">
                      {unifiedOps.signals.bottlenecks.map((b, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: '#E85D0008', border: '1px solid #E85D0025' }}>
                          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#E85D00' }} />
                          <div>
                            <p className="text-xs text-[#8FA0B8]">{b.detail}</p>
                            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Source: {b.source}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}

                {unifiedOps.signals.capacity_alerts?.length > 0 && (
                  <Panel>
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="w-4 h-4 text-[#F59E0B]" />
                      <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Capacity Alerts</h3>
                    </div>
                    <div className="space-y-2">
                      {unifiedOps.signals.capacity_alerts.map((a, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: '#F59E0B08', border: '1px solid #F59E0B25' }}>
                          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#F59E0B' }} />
                          <div>
                            <p className="text-xs text-[#8FA0B8]">{a.detail}</p>
                            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Source: {a.source}</span>
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
