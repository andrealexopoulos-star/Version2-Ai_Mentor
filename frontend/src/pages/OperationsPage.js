import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import EnterpriseContactGate from '../components/EnterpriseContactGate';
import { Settings, Clock, Users, AlertTriangle, CheckCircle2, Workflow, Loader2, Plug, Zap, ArrowRight, TrendingUp, BarChart3 } from 'lucide-react';
import DataConfidence from '../components/DataConfidence';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import IntegrationStatusWidget from '../components/IntegrationStatusWidget';
import { fontFamily } from '../design-system/tokens';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth, AUTH_STATE } from '../context/SupabaseAuthContext';
import InsightExplainabilityStrip from '../components/InsightExplainabilityStrip';
import ActionOwnershipCard from '../components/ActionOwnershipCard';
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
    exec.sla_breaches != null && { label: 'SLA Breaches', value: String(exec.sla_breaches), unit: 'this week', color: exec.sla_breaches > 0 ? '#FF6A00' : '#10B981', icon: AlertTriangle, desc: 'Commitments missed against agreed service levels' },
    exec.task_aging != null && { label: 'Task Aging', value: exec.task_aging + '%', unit: 'overdue >7d', color: exec.task_aging > 30 ? '#F59E0B' : '#10B981', icon: Clock, desc: 'Percentage of open tasks sitting stale beyond threshold' },
    exec.active_tasks != null && { label: 'Tasks Active', value: String(exec.active_tasks), unit: 'in progress', color: '#3B82F6', icon: Workflow, desc: 'Current open tasks across all connected systems' },
    exec.sop_compliance != null && { label: 'SOP Compliance', value: exec.sop_compliance + '%', unit: 'processes on-track', color: exec.sop_compliance > 85 ? '#10B981' : '#F59E0B', icon: CheckCircle2, desc: 'Standard operating procedures being followed correctly' },
    vitals.calendar && { label: 'Meeting Load', value: vitals.calendar.match(/(\d+)\s+meeting/)?.[1] || '—', unit: 'this week', color: '#8B5CF6', icon: Users, desc: vitals.calendar },
    exec.bottleneck && { label: 'Active Bottleneck', value: '1', unit: 'detected', color: '#F59E0B', icon: Zap, desc: exec.bottleneck.slice(0, 60) },
  ].filter(Boolean);

  const explainability = {
    whyVisible: hasRealOpsData
      ? `BIQc is reading live workflow signals from ${hasCRM ? (crmIntegration?.provider || 'CRM') : 'connected systems'}${hasAccounting ? ` and ${acctIntegration?.provider || 'accounting'}` : ''}.`
      : 'Operations intelligence appears when CRM/accounting systems are connected.',
    whyNow: exec.sla_breaches > 0
      ? `${exec.sla_breaches} SLA breach${exec.sla_breaches === 1 ? '' : 'es'} detected — service slippage is now measurable.`
      : exec.bottleneck
        ? `Active bottleneck detected: ${exec.bottleneck}`
        : 'This module surfaces delivery friction before it cascades into customer or cashflow issues.',
    nextAction: exec.bottleneck
      ? 'Assign a bottleneck owner, define one unblock action, and re-check task aging within 48 hours.'
      : 'Prioritise overdue tasks and tighten weekly execution cadence with clear owners per queue.',
    ifIgnored: hasRealOpsData
      ? 'Unresolved delivery drift typically compounds into missed commitments, rework, and client trust erosion.'
      : 'Without connected workflow data, operational risks remain undetected until outcomes deteriorate.',
  };

  const toConfidencePct = (raw) => {
    if (raw == null) return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n)) return undefined;
    return n > 0 && n <= 1 ? n * 100 : n;
  };
  const opsIntelLineage = unifiedOps?.lineage;
  const opsIntelFreshness = unifiedOps?.data_freshness;
  const opsIntelConfidence = toConfidencePct(unifiedOps?.confidence_score);

  const actionOwnership = {
    owner: exec.bottleneck ? 'Operations manager' : 'Delivery lead',
    deadline: exec.sla_breaches > 0 ? 'Within 24 hours' : 'By end of this week',
    checkpoint: exec.bottleneck
      ? `Unblock bottleneck: ${String(exec.bottleneck).slice(0, 80)}${String(exec.bottleneck).length > 80 ? '…' : ''}`
      : 'Run overdue-task cleanup and confirm clear queue ownership.',
    successMetric: `SLA breaches ${exec.sla_breaches ?? '—'} · task aging ${exec.task_aging != null ? `${exec.task_aging}%` : '—'}`,
  };

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
            <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1.5" style={{ fontFamily: fontFamily.display }}>Delivery & Operations</h1>
            <p className="text-sm text-[#9FB0C3] mb-2" style={{ fontFamily: fontFamily.body }}>
              Track fulfilment timelines, task throughput, SOP compliance and resource utilisation — updated from your connected systems.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {!integrationResolved ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: 'rgba(100,116,139,0.12)', color: '#9FB0C3', border: '1px solid rgba(100,116,139,0.24)', fontFamily: fontFamily.mono }}>
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
                  style={{ background: 'rgba(255,106,0,0.1)', color: '#FF6A00', border: '1px solid rgba(255,106,0,0.2)', fontFamily: fontFamily.mono }}
                  data-testid="operations-connect-crm-button">
                  <Plug className="w-3 h-3" /> Connect CRM <ArrowRight className="w-3 h-3" />
                </button>
              )}
              {!integrationResolved ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: 'rgba(100,116,139,0.12)', color: '#9FB0C3', border: '1px solid rgba(100,116,139,0.24)', fontFamily: fontFamily.mono }}>
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
                  style={{ background: 'rgba(255,106,0,0.1)', color: '#FF6A00', border: '1px solid rgba(255,106,0,0.2)', fontFamily: fontFamily.mono }}
                  data-testid="operations-connect-accounting-button">
                  <Plug className="w-3 h-3" /> Connect Accounting <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <DataConfidence cognitive={snapshot ? { execution: { sla_breaches: exec.sla_breaches } } : null} channelsData={integrationStatus} loading={integrationLoading && !integrationStatus} />
        </div>

        <InsightExplainabilityStrip
          whyVisible={explainability.whyVisible}
          whyNow={explainability.whyNow}
          nextAction={explainability.nextAction}
          ifIgnored={explainability.ifIgnored}
          testIdPrefix="operations-explainability"
        />

        <div className="flex flex-wrap items-center gap-2" data-testid="operations-lineage-badge">
          <LineageBadge lineage={opsIntelLineage} data_freshness={opsIntelFreshness} confidence_score={opsIntelConfidence} compact />
        </div>

        <ActionOwnershipCard
          title="Operations execution owner plan"
          owner={actionOwnership.owner}
          deadline={actionOwnership.deadline}
          checkpoint={actionOwnership.checkpoint}
          successMetric={actionOwnership.successMetric}
          testIdPrefix="operations-action-ownership"
        />

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
                <p className="text-sm font-semibold text-[#F4F7FA] mb-0.5" style={{ fontFamily: fontFamily.display }}>Verifying operations data sources</p>
                <p className="text-xs text-[#64748B]">BIQc is confirming CRM and accounting connections before scoring execution risk and bottlenecks.</p>
              </div>
            </div>
          </Panel>
        )}

        {!loading && !integrationLoading && !hasRealOpsData && (
          <Panel className="py-10">
            <div className="text-center mb-5">
              <Settings className="w-10 h-10 text-[#FF6A00] mx-auto mb-3 opacity-60" />
              <h3 className="text-base font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Activate Operations Intelligence</h3>
              <p className="text-sm text-[#9FB0C3] max-w-md mx-auto" style={{ fontFamily: fontFamily.body }}>
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
                    <span className="text-2xl font-bold text-[#F4F7FA] block" style={{ fontFamily: fontFamily.mono }}>{m.value}</span>
                    <span className="text-[10px] text-[#4A5568]" style={{ fontFamily: fontFamily.mono }}>{m.unit}</span>
                    {m.desc && <p className="text-[10px] text-[#64748B] mt-1.5 leading-snug">{m.desc}</p>}
                  </Panel>
                ))}
              </div>
            )}

            {OPS_KPIS.length === 0 && (
              <Panel>
                <div className="flex items-start gap-3">
                  <Loader2 className="w-5 h-5 text-[#FF6A00] animate-spin flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[#F4F7FA] mb-0.5" style={{ fontFamily: fontFamily.display }}>
                      {hasCRM ? 'HubSpot connected — pulling operational metrics…' : 'Accounting connected — loading financial operations data…'}
                    </p>
                    <p className="text-xs text-[#64748B]">First sync may take 1–3 minutes. Task aging, SLA and bottleneck data will appear once imported.</p>
                  </div>
                </div>
              </Panel>
            )}
          </>
        )}

            {/* Bottleneck */}
            {exec.bottleneck && (
              <Panel>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#F59E0B15' }}>
                    <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Active Bottleneck</h3>
                    <p className="text-sm text-[#9FB0C3] leading-relaxed">{exec.bottleneck}</p>
                  </div>
                </div>
              </Panel>
            )}

            {/* Recommendations from snapshot */}
            {exec.recs?.length > 0 && (
              <Panel>
                <h3 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: fontFamily.display }}>Recommendations</h3>
                <div className="space-y-2">
                  {exec.recs.map((r, i) => (
                    <div key={i} className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                      <p className="text-sm text-[#9FB0C3] leading-relaxed">{r}</p>
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
                    <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Operations Intelligence</h3>
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
                      <AlertTriangle className="w-4 h-4 text-[#FF6A00]" />
                      <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Cross-Domain Bottlenecks</h3>
                    </div>
                    <div className="space-y-2">
                      {unifiedOps.signals.bottlenecks.map((b, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: '#FF6A0008', border: '1px solid #FF6A0025' }}>
                          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#FF6A00' }} />
                          <div>
                            <p className="text-xs text-[#9FB0C3]">{b.detail}</p>
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
                      <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Capacity Alerts</h3>
                    </div>
                    <div className="space-y-2">
                      {unifiedOps.signals.capacity_alerts.map((a, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: '#F59E0B08', border: '1px solid #F59E0B25' }}>
                          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#F59E0B' }} />
                          <div>
                            <p className="text-xs text-[#9FB0C3]">{a.detail}</p>
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
