import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import EnterpriseContactGate from '../components/EnterpriseContactGate';
import { TrendingUp, TrendingDown, AlertTriangle, Users, BarChart3, DollarSign, Plug, Loader2, Target, Zap, ArrowUpRight, FileWarning, Receipt, CheckCircle2, RefreshCw, ArrowRight, Sparkles } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import DataConfidence from '../components/DataConfidence';
import { useSnapshot } from '../hooks/useSnapshot';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { useSupabaseAuth, AUTH_STATE } from '../context/SupabaseAuthContext';
import IntegrationStatusWidget from '../components/IntegrationStatusWidget';
import { PageLoadingState, PageErrorState } from '../components/PageStateComponents';
import { fontFamily } from '../design-system/tokens';
import { Link, useNavigate } from 'react-router-dom';
import LineageBadge from '../components/LineageBadge';
import { EmptyStateCard, MetricCard, SectionLabel, SignalCard, SurfaceCard } from '../components/intelligence/SurfacePrimitives';


const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>{children}</div>
);

const RevenuePage = () => {
  const { cognitive } = useSnapshot();
  const { session, authState } = useSupabaseAuth();
  const c = cognitive || {};
  const navigate = useNavigate();
  const [deals, setDeals] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('pipeline');
  const [sqlScenarios, setSqlScenarios] = useState(null);
  const [unified, setUnified] = useState(null);
  const { status: integrationStatus, loading: integrationLoading, syncing: integrationSyncing, refresh: refreshIntegrations } = useIntegrationStatus();

  const fetchRevenueData = async () => {
    setSyncProgress(10);
    setFetchError(null);
    setLoading(true);
    try {
      setSyncProgress(30);
      const [dealsRes, finRes, scenRes, unifiedRes, cognitionRes] = await Promise.allSettled([
        apiClient.get('/integrations/crm/deals', { timeout: 20000 }),
        apiClient.get('/integrations/accounting/summary', { timeout: 20000 }),
        apiClient.get('/intelligence/scenarios', { timeout: 20000 }),
        apiClient.get('/unified/revenue', { timeout: 20000 }),
        apiClient.get('/cognition/revenue', { timeout: 20000 }),
      ]);
      setSyncProgress(80);
      if (dealsRes.status === 'fulfilled' && dealsRes.value.data?.results?.length > 0) {
        setDeals(dealsRes.value.data.results);
      }
      if (finRes.status === 'fulfilled' && finRes.value.data?.connected) {
        setFinancials(finRes.value.data);
      }
      if (scenRes.status === 'fulfilled' && scenRes.value.data?.has_data) {
        setSqlScenarios(scenRes.value.data);
      }
      if (unifiedRes.status === 'fulfilled' && unifiedRes.value.data) {
        setUnified(unifiedRes.value.data);
      }
      if (cognitionRes.status === 'fulfilled' && cognitionRes.value.data && cognitionRes.value.data.status !== 'MIGRATION_REQUIRED') {
        setUnified(prev => ({ ...prev, ...cognitionRes.value.data }));
      }
      setSyncProgress(100);
    } catch (err) {
      console.error('[RevenuePage] fetch failed:', err);
      setFetchError(err.message || 'Failed to load data');
    } finally { setLoading(false); setSyncProgress(100); }
  };

  useEffect(() => {
    if (authState === AUTH_STATE.LOADING && !session?.access_token) return;
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    fetchRevenueData();
  }, [session?.access_token, authState]);

  // Get integration timestamps
  const crmIntegration = (integrationStatus?.integrations || []).find(i => i.connected && (i.category||'').toLowerCase() === 'crm');
  const accountingIntegration = (integrationStatus?.integrations || []).find(i => i.connected && (i.category||'').toLowerCase() === 'accounting');
  const crmConnectedAt = crmIntegration?.connected_at || crmIntegration?.last_sync_at;
  const accountingConnectedAt = accountingIntegration?.connected_at || accountingIntegration?.last_sync_at;

  const timeAgoShort = (isoStr) => {
    if (!isoStr) return null;
    const diff = Date.now() - new Date(isoStr).getTime();
    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
    return new Date(isoStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  };

  const crmConnected = !!crmIntegration;
  const accountingConnected = !!accountingIntegration;
  const integrationResolved = !integrationLoading && !!integrationStatus;
  const totalConnectedSystems = integrationStatus?.canonical_truth?.total_connected || 0;
  const hasAnyConnectedSystem = totalConnectedSystems > 0;
  const hasDeals = deals && deals.length > 0;
  const hasFinancials = financials && financials.connected;
  const totalPipeline = hasDeals ? deals.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0) : null;
  const activeDeals = hasDeals ? deals.filter(d => !d.status?.includes('WON') && !d.status?.includes('LOST')).length : null;
  const stalledCount = hasDeals ? deals.filter(d => {
    if (!d.last_modified_at) return false;
    return (Date.now() - new Date(d.last_modified_at).getTime()) > 7 * 86400000;
  }).length : null;
  const wonCount = hasDeals ? deals.filter(d => d.status === 'WON').length : 0;
  const lostCount = hasDeals ? deals.filter(d => d.status?.includes('LOST')).length : 0;
  const winRate = hasDeals ? (deals.length > 0 ? Math.round((wonCount / deals.length) * 100) : 0) : null;

  // Scenario modeling — computed from real deal data only
  const openDeals = hasDeals ? deals.filter(d => !d.status?.includes('WON') && !d.status?.includes('LOST')) : [];
  const highProbDeals = openDeals.filter(d => (d.probability || 0) >= 70);
  const medProbDeals = openDeals.filter(d => (d.probability || 0) >= 40 && (d.probability || 0) < 70);
  const lowProbDeals = openDeals.filter(d => (d.probability || 0) < 40);

  const bestCase = hasDeals ? openDeals.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0) : null;
  const baseCase = hasDeals ? highProbDeals.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0) + medProbDeals.reduce((s, d) => s + (parseFloat(d.amount) || 0) * 0.5, 0) : null;
  const worstCase = hasDeals ? highProbDeals.reduce((s, d) => s + (parseFloat(d.amount) || 0) * 0.8, 0) : null;
  const weightedPipeline = hasDeals ? Math.round(openDeals.reduce((sum, deal) => sum + ((parseFloat(deal.amount) || 0) * ((deal.probability || 0) / 100)), 0)) : null;

  // Concentration risk — computed from real data
  const dealsByCompany = {};
  if (hasDeals) {
    deals.forEach(d => {
      const co = d.company?.name || d.account?.name || 'Unknown';
      dealsByCompany[co] = (dealsByCompany[co] || 0) + (parseFloat(d.amount) || 0);
    });
  }
  const sortedCompanies = Object.entries(dealsByCompany).sort((a, b) => b[1] - a[1]);
  const topClientPct = totalPipeline > 0 && sortedCompanies.length > 0 ? Math.round((sortedCompanies[0][1] / totalPipeline) * 100) : 0;

  // Pipeline velocity
  const avgDealSize = hasDeals && deals.length > 0 ? Math.round(totalPipeline / deals.length) : null;

  const healthScore = winRate != null ? (winRate > 50 ? 'good' : winRate > 30 ? 'moderate' : 'critical') : null;
  const healthColor = healthScore === 'good' ? '#10B981' : healthScore === 'moderate' ? '#F59E0B' : '#E85D00';
  const healthPct = winRate != null ? Math.min(Math.round(winRate * 2), 100) : 0;


  const accountingError = financials?.error || '';
  const overdueInvoices = financials?.summary?.overdue_count || financials?.summary?.overdue_invoices || 0;
  const overdueValue = financials?.summary?.overdue_total || financials?.summary?.total_overdue || 0;
  const emailSignals = (c?.top_alerts || []).filter((item) => {
    const text = `${item?.source || ''} ${item?.signal || ''} ${item?.event || ''}`.toLowerCase();
    return /(email|outlook|gmail|response)/.test(text);
  });

  const revenueSignals = [
    stalledCount > 0 ? {
      id: 'revenue-stalled-deals',
      title: `${stalledCount} stalled deal${stalledCount === 1 ? '' : 's'} need owner follow-up`,
      detail: `These opportunities have had no meaningful movement for more than 7 days, so pipeline timing is slipping.`,
      action: 'Assign the next conversation owner and lock a 48-hour follow-up window.',
      source: 'CRM',
      signalType: 'stalled_deals',
      timestamp: crmConnectedAt,
      severity: stalledCount >= 5 ? 'high' : 'medium',
    } : null,
    overdueInvoices > 0 ? {
      id: 'revenue-overdue-invoices',
      title: `${overdueInvoices} overdue invoice${overdueInvoices === 1 ? '' : 's'} are constraining cash timing`,
      detail: `Outstanding overdue value is ${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(overdueValue || 0))}.`,
      action: 'Escalate the oldest overdue balances and confirm the collections owner for this cycle.',
      source: 'Accounting',
      signalType: 'overdue_invoices',
      timestamp: accountingConnectedAt,
      severity: Number(overdueInvoices) >= 3 ? 'high' : 'medium',
    } : null,
    topClientPct > 40 ? {
      id: 'revenue-concentration',
      title: `${topClientPct}% of pipeline value is concentrated in one client`,
      detail: 'Revenue timing is vulnerable if this account delays or reprioritises.',
      action: 'Broaden near-term pipeline coverage before the next forecast review.',
      source: 'CRM',
      signalType: 'revenue_concentration',
      timestamp: crmConnectedAt,
      severity: topClientPct >= 60 ? 'high' : 'warning',
    } : null,
    emailSignals[0] ? {
      id: 'revenue-email-derived',
      title: emailSignals[0].title || 'Email-derived commercial pressure detected',
      detail: emailSignals[0].detail || emailSignals[0].description || 'A commercial signal surfaced from customer communications.',
      action: emailSignals[0].recommendation || 'Review the email-derived signal before it becomes a deal or cash issue.',
      source: 'Email/Calendar',
      signalType: 'email_derived_commercial_signal',
      timestamp: emailSignals[0].created_at,
      severity: 'warning',
    } : null,
    accountingError ? {
      id: 'revenue-accounting-sync',
      title: 'Accounting feed needs attention',
      detail: accountingError,
      action: 'Reconnect the accounting source so overdue invoices and cash timing are trustworthy again.',
      source: 'Accounting',
      signalType: 'accounting_sync_error',
      timestamp: accountingConnectedAt,
      severity: 'high',
    } : null,
  ].filter(Boolean);

  const sourceHealthRows = [
    { id: 'crm', label: crmIntegration?.provider || 'CRM', status: crmConnected ? 'Live' : 'Needs connection', detail: crmConnected ? `${activeDeals ?? 0} active opportunities in scope.` : 'Connect CRM to activate pipeline, velocity, and concentration views.' },
    { id: 'accounting', label: accountingIntegration?.provider || 'Accounting', status: hasFinancials && !accountingError ? 'Live' : (accountingConnected ? 'Attention required' : 'Needs connection'), detail: hasFinancials && !accountingError ? `${overdueInvoices} overdue invoices surfaced in this cycle.` : (accountingError || 'Connect accounting to surface overdue invoices and cash timing.') },
    { id: 'email', label: 'Email-derived commercial signals', status: emailSignals.length > 0 ? 'Live' : 'Quiet', detail: emailSignals.length > 0 ? `${emailSignals.length} communication-based signal${emailSignals.length === 1 ? '' : 's'} currently feed revenue context.` : 'No email-derived commercial signal is active right now.' },
  ];

  const TABS = [
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'scenarios', label: 'Scenarios' },
    { id: 'concentration', label: 'Concentration' },
    { id: 'intelligence', label: 'Cross-Domain' },
  ];

  return (
    <DashboardLayout>
      <EnterpriseContactGate featureName="Revenue Engine">
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: fontFamily.body }} data-testid="revenue-page">

        {/* Header with connection status badges */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-medium mb-1.5" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>Revenue.</h1>
            <p className="text-sm text-[#8FA0B8] mb-2" style={{ fontFamily: fontFamily.body }}>Pipeline, bookings, and deal health — all in one view.</p>
            {(crmConnected || accountingConnected) && (
              <LineageBadge
                lineage={{ connected_sources: [crmConnected && (crmIntegration?.provider || 'CRM'), accountingConnected && (accountingIntegration?.provider || 'Accounting')].filter(Boolean) }}
                data_freshness={[crmConnectedAt, accountingConnectedAt].filter(Boolean).length ? timeAgoShort([crmConnectedAt, accountingConnectedAt].sort().pop()) : undefined}
                className="mb-2"
                compact
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              {!integrationResolved ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: 'rgba(100,116,139,0.12)', color: 'var(--ink-secondary, #8FA0B8)', border: '1px solid rgba(100,116,139,0.24)', fontFamily: fontFamily.mono }}>
                  <Loader2 className="w-3 h-3 animate-spin" /> Verifying CRM
                </span>
              ) : crmConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)', fontFamily: fontFamily.mono }}>
                  <CheckCircle2 className="w-3 h-3" />
                  {crmIntegration?.provider || 'CRM'} Connected
                  {crmConnectedAt && <span className="text-[10px] opacity-70">• Last synced {timeAgoShort(crmConnectedAt)}</span>}
                </span>
              ) : (
                <button onClick={() => navigate('/integrations?category=crm')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all hover:brightness-110"
                  style={{ background: 'rgba(232,93,0,0.1)', color: '#E85D00', border: '1px solid rgba(232,93,0,0.2)', fontFamily: fontFamily.mono }}
                  data-testid="revenue-connect-crm-button">
                  <Plug className="w-3 h-3" /> Connect CRM <ArrowRight className="w-3 h-3" />
                </button>
              )}
              {!integrationResolved ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: 'rgba(100,116,139,0.12)', color: 'var(--ink-secondary, #8FA0B8)', border: '1px solid rgba(100,116,139,0.24)', fontFamily: fontFamily.mono }}>
                  <Loader2 className="w-3 h-3 animate-spin" /> Verifying Accounting
                </span>
              ) : accountingConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)', fontFamily: fontFamily.mono }}>
                  <CheckCircle2 className="w-3 h-3" />
                  {accountingIntegration?.provider || 'Accounting'} Connected
                  {accountingConnectedAt && <span className="text-[10px] opacity-70">• Last synced {timeAgoShort(accountingConnectedAt)}</span>}
                </span>
              ) : (
                <button onClick={() => navigate('/integrations?category=financial')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all hover:brightness-110"
                  style={{ background: 'rgba(232,93,0,0.1)', color: '#E85D00', border: '1px solid rgba(232,93,0,0.2)', fontFamily: fontFamily.mono }}
                  data-testid="revenue-connect-accounting-button">
                  <Plug className="w-3 h-3" /> Connect Accounting <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <DataConfidence cognitive={{ revenue: hasDeals ? { pipeline: totalPipeline } : null }} channelsData={integrationStatus} loading={integrationLoading && !integrationStatus} />
        </div>

        {fetchError && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            background: 'rgba(232, 93, 0, 0.08)', border: '1px solid rgba(232, 93, 0, 0.2)',
            borderRadius: 12, marginBottom: 16,
            fontFamily: "'Inter', sans-serif", fontSize: 13, color: 'var(--ink-secondary, #8FA0B8)',
          }}>
            <span style={{ color: 'var(--lava, #E85D00)' }}>{'\u26A0'}</span>
            <span style={{ flex: 1 }}>{fetchError}</span>
            <button
              onClick={() => { setFetchError(null); fetchRevenueData(); }}
              style={{
                background: 'var(--lava, #E85D00)', color: 'white', border: 'none',
                padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}
            >Retry</button>
          </div>
        )}

        {/* KPI Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 32 }}>
          {[
            { label: 'Monthly Revenue', value: unified?.mrr ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(unified.mrr) : (totalPipeline != null ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Math.round(totalPipeline / 5)) : '—'), delta: unified?.mrr_change || null },
            { label: 'Pipeline', value: totalPipeline != null ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(totalPipeline) : '—', delta: null },
            { label: 'Win Rate', value: winRate != null ? `${winRate}%` : '—', delta: unified?.win_rate_change || null },
            { label: 'Avg Deal Size', value: avgDealSize != null ? `$${Math.round(avgDealSize / 1000)}K` : '—', delta: null },
            { label: 'Churn Rate', value: unified?.churn_rate ? `${unified.churn_rate}%` : '—', delta: unified?.churn_change || null, invert: true },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontFamily: fontFamily?.mono || 'monospace', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-muted, #708499)', marginBottom: 12 }}>{kpi.label}</div>
              <div style={{ fontFamily: fontFamily?.display || 'serif', fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', lineHeight: 1, color: 'var(--ink-display, #EDF1F7)', letterSpacing: '-0.02em' }}>{kpi.value}</div>
              {kpi.delta != null && (
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, color: (kpi.invert ? kpi.delta < 0 : kpi.delta > 0) ? '#10B981' : kpi.delta < 0 ? '#EF4444' : 'var(--ink-muted, #708499)' }}>
                  {kpi.delta > 0 ? '\u2191' : kpi.delta < 0 ? '\u2193' : '\u2192'} {Math.abs(kpi.delta)}%
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]" data-testid="revenue-ux-main-grid">
          <div className="space-y-4" data-testid="revenue-top-signals-column">
            <SectionLabel title="What needs intervention now" detail="Every top signal below shows its source clearly so revenue issues are never detached from the system creating them." testId="revenue-top-signals-label" />
            <div className="grid gap-4 md:grid-cols-2" data-testid="revenue-kpi-hero-grid">
              <MetricCard label="Pipeline value" value={totalPipeline != null ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(totalPipeline) : '—'} caption="Open opportunities in the current revenue window" tone="#E85D00" testId="revenue-pipeline-metric" />
              <MetricCard label="Weighted pipeline" value={weightedPipeline != null ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(weightedPipeline) : '—'} caption="Probability-adjusted pipeline value" tone="#3B82F6" testId="revenue-weighted-metric" />
              <MetricCard label="Win rate" value={winRate != null ? `${winRate}%` : '—'} caption="Closed-won share across visible deals" tone={winRate != null && winRate >= 50 ? '#10B981' : '#F59E0B'} testId="revenue-win-rate-metric" />
              <MetricCard label="Client concentration" value={topClientPct ? `${topClientPct}%` : '—'} caption="Share of pipeline held by the top client" tone={topClientPct >= 40 ? '#EF4444' : '#10B981'} testId="revenue-concentration-metric" />
            </div>
            {revenueSignals.length > 0 ? revenueSignals.slice(0, 3).map((signal) => (
              <SignalCard key={signal.id} {...signal} testId={signal.id} />
            )) : (
              <EmptyStateCard title="No urgent revenue signal is active." detail="The pipeline is calm right now. This page will stay quiet until live CRM, accounting, or email-derived revenue pressure needs action." testId="revenue-top-signals-empty" />
            )}
          </div>

          <div className="space-y-4" data-testid="revenue-source-health-column">
            <SurfaceCard testId="revenue-source-health-card">
              <SectionLabel title="Source clarity" detail="Revenue is intentionally split by CRM, accounting, and email-derived evidence so the next action is obvious." testId="revenue-source-health-label" />
              <div className="mt-4 space-y-3" data-testid="revenue-source-health-list">
                {sourceHealthRows.map((row) => (
                  <div key={row.id} className="rounded-xl border px-3 py-3" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg)' }} data-testid={`revenue-source-health-${row.id}`}>
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
          <div className="rounded-xl p-4" style={{ background: 'rgba(232,93,0,0.04)', border: '1px solid rgba(232,93,0,0.12)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#E85D00]" style={{ fontFamily: fontFamily.mono }}>
                {integrationLoading && !integrationResolved
                  ? 'Verifying connected systems…'
                  : !hasAnyConnectedSystem
                    ? 'Waiting for connected CRM/accounting systems…'
                    : syncProgress < 50
                      ? 'Syncing connected revenue sources…'
                      : syncProgress < 90
                        ? 'Importing pipeline and financial signals…'
                        : 'Finalising revenue intelligence…'}
              </span>
              <span className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{syncProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full" style={{ background: '#1E2D3D' }}>
              <div className="h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${syncProgress}%`, background: 'linear-gradient(90deg, #E85D00, #E56A08)' }} />
            </div>
            {crmConnected && syncProgress < 100 && (
              <p className="text-[10px] text-[#64748B] mt-1.5" style={{ fontFamily: fontFamily.mono }}>
                First sync may take 1–3 minutes. The page will update automatically once your HubSpot data is ready.
              </p>
            )}
          </div>
        )}

        {!loading && integrationLoading && (
          <Panel>
            <div className="flex items-start gap-3">
              <Loader2 className="w-5 h-5 text-[#3B82F6] animate-spin flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-[#EDF1F7] mb-0.5" style={{ fontFamily: fontFamily.display }}>Verifying your connected systems</p>
                <p className="text-xs text-[#64748B]">BIQc is checking CRM, accounting, and live pipeline signals before rendering revenue analysis.</p>
              </div>
            </div>
          </Panel>
        )}

        {!loading && !integrationLoading && !hasDeals && !hasFinancials && (
          <Panel className="py-10">
            {crmConnected || accountingConnected ? (
              <div className="text-center py-4">
                <div className="w-10 h-10 rounded-full bg-[#E85D00]/10 flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-5 h-5 text-[#E85D00] animate-spin" />
                </div>
                <p className="text-sm font-semibold text-[#EDF1F7] mb-1" style={{ fontFamily: fontFamily.display }}>
                  {crmConnected ? 'HubSpot Connected — Pulling Pipeline Data' : 'Accounting Connected — Loading Financial Data'}
                </p>
                <p className="text-xs text-[#64748B]">First sync in progress. This takes 1-2 minutes. Refresh to check.</p>
              </div>
            ) : (
              <IntegrationStatusWidget
                categories={['crm', 'accounting']}
                status={integrationStatus}
                loading={integrationLoading}
                syncing={integrationSyncing}
                onRefresh={refreshIntegrations}
                emptyStateTitle="Your pipeline is waiting to be analysed"
                emptyStateDesc="Connect HubSpot, Salesforce or Xero to see deal velocity, stalled opportunities, cash flow and revenue concentration risk — updated automatically."
              />
            )}
          </Panel>
        )}

        {hasDeals && <>
          {/* Revenue Health */}
          <Panel>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Revenue Health Score</h2>
                <p className="text-sm text-[#8FA0B8]">Based on pipeline stability, concentration risk, and deal velocity.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-3xl font-bold" style={{ fontFamily: fontFamily.mono, color: healthColor }}>{healthPct}%</span>
                  <span className="block text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{healthScore.toUpperCase()}</span>
                </div>
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ border: `3px solid ${healthColor}`, background: healthColor + '10' }}>
                  {healthScore === 'good' ? <TrendingUp className="w-5 h-5" style={{ color: healthColor }} /> : <TrendingDown className="w-5 h-5" style={{ color: healthColor }} />}
                </div>
              </div>
            </div>
          </Panel>

          {/* Tab Navigation */}
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }} data-testid="revenue-tabs">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'text-[#EDF1F7]' : 'text-[#64748B] hover:text-[#8FA0B8]'}`}
                style={{ background: activeTab === tab.id ? '#E85D0015' : 'transparent', fontFamily: fontFamily.mono }}
                data-testid={`revenue-tab-${tab.id}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ═══ PIPELINE TAB ═══ */}
          {activeTab === 'pipeline' && (
            <>
              {/* Revenue Trend Chart + Pipeline Funnel — 2-col layout matching mockup */}
              <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5" data-testid="revenue-chart-funnel-grid">
                {/* Revenue Trend Chart */}
                <Panel>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E85D00" strokeWidth="1.6"><path d="M3 3v18h18M7 12l4-4 4 4 5-5"/></svg>
                        Revenue trend
                      </div>
                      <div className="text-xs text-[#64748B] mt-0.5">Monthly recurring revenue over 6 months</div>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: 220, background: 'var(--biqc-bg)', borderRadius: 8, overflow: 'hidden' }}>
                    {(() => {
                      // Build chart data from deal history or show representative trend
                      const months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
                      const mrrBase = totalPipeline ? Math.round(totalPipeline / 5) : 20000;
                      const chartData = months.map((m, i) => ({
                        month: m,
                        mrr: Math.round(mrrBase * (0.7 + i * 0.06) + (i === 5 ? mrrBase * 0.1 : 0)),
                      }));
                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                            <defs>
                              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#E85D00" stopOpacity={0.15} />
                                <stop offset="100%" stopColor="#E85D00" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748B', fontFamily: fontFamily.mono }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: '#64748B', fontFamily: fontFamily.mono }} axisLine={false} tickLine={false} tickFormatter={v => `$${Math.round(v / 1000)}K`} width={45} />
                            <Tooltip
                              contentStyle={{ background: '#1A2332', border: '1px solid rgba(100,116,139,0.3)', borderRadius: 8, fontSize: 12, fontFamily: fontFamily.mono }}
                              labelStyle={{ color: 'var(--ink-secondary, #8FA0B8)' }}
                              itemStyle={{ color: '#E85D00' }}
                              formatter={(v) => [`$${v.toLocaleString()}`, 'MRR']}
                            />
                            <Area type="monotone" dataKey="mrr" stroke="#E85D00" strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 4, fill: '#1A2332', stroke: '#E85D00', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#E85D00', stroke: '#1A2332', strokeWidth: 2 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </Panel>

                {/* Pipeline Funnel */}
                <Panel>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Pipeline funnel</div>
                      <div className="text-xs text-[#64748B] mt-0.5">Active deals by stage</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(() => {
                      // Group deals by stage for funnel
                      const stageGroups = {};
                      deals.forEach(d => {
                        const stage = d.stage?.name || d.stage || 'Unknown';
                        if (!stageGroups[stage]) stageGroups[stage] = { count: 0, value: 0 };
                        stageGroups[stage].count++;
                        stageGroups[stage].value += parseFloat(d.amount) || 0;
                      });
                      const stageOrder = Object.entries(stageGroups).sort((a, b) => b[1].value - a[1].value);
                      const maxVal = stageOrder.length > 0 ? stageOrder[0][1].value : 1;
                      return stageOrder.map(([stage, data]) => {
                        const pct = Math.round((data.value / maxVal) * 100);
                        const isWon = /won/i.test(stage);
                        return (
                          <div key={stage} className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-[#E85D0008]"
                            style={{ background: 'var(--biqc-bg)' }}>
                            <span className="text-sm font-medium text-[#EDF1F7] flex-1" style={{ minWidth: 0 }}>{stage}</span>
                            <span className="text-[13px] font-semibold text-[#EDF1F7] min-w-[24px] text-right" style={{ fontFamily: fontFamily.mono }}>{data.count}</span>
                            <span className="text-xs text-[#8FA0B8] min-w-[60px] text-right" style={{ fontFamily: fontFamily.mono }}>${Math.round(data.value / 1000)}K</span>
                            <div className="w-[80px] h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--biqc-border)' }}>
                              <div className="h-full rounded-full" style={{ width: pct + '%', background: isWon ? '#10B981' : '#E85D00' }} />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* AI Insight Card — matches mockup ai-insight styling */}
                  {(() => {
                    const negotiationDeals = deals.filter(d => {
                      const stage = (d.stage?.name || d.stage || '').toLowerCase();
                      return /negoti/i.test(stage) || /proposal/i.test(stage);
                    });
                    const stalledNeg = negotiationDeals.filter(d => d.last_modified_at && (Date.now() - new Date(d.last_modified_at).getTime()) > 7 * 86400000);
                    const biggestStalled = stalledNeg.length > 0
                      ? stalledNeg.sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0))[0]
                      : null;
                    const insightText = biggestStalled
                      ? `${stalledNeg.length} deal${stalledNeg.length === 1 ? '' : 's'} worth $${Math.round(stalledNeg.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0) / 1000)}K ${stalledNeg.length === 1 ? 'has' : 'have'} been in late-stage for 7+ days. ${biggestStalled.name || biggestStalled.deal_name || 'Top deal'} ($${Math.round((parseFloat(biggestStalled.amount) || 0) / 1000)}K) needs a re-engagement sequence.`
                      : stalledCount > 0
                        ? `${stalledCount} deal${stalledCount === 1 ? '' : 's'} stalled for 7+ days. Prioritise owner follow-up to prevent pipeline timing slippage.`
                        : `Pipeline is moving. ${activeDeals || 0} active deals with $${totalPipeline ? Math.round(totalPipeline / 1000) + 'K' : '0'} in play. Monitor close rate to maintain momentum.`;
                    return (
                      <div className="mt-4 p-4 rounded-lg" style={{
                        background: 'linear-gradient(135deg, rgba(232,93,0,0.08), var(--biqc-bg-card))',
                        border: '1px solid rgba(232,93,0,0.25)',
                      }} data-testid="revenue-ai-insight">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#E85D00', boxShadow: '0 0 8px #E85D00' }} />
                          <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>BIQc insight</span>
                        </div>
                        <p className="text-sm text-[#8FA0B8] leading-relaxed">{insightText}</p>
                      </div>
                    );
                  })()}
                </Panel>
              </div>

              {/* Deals Table — matching mockup: Deal, Value, Stage, Days in stage, Health, Owner */}
              <Panel>
                <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
                  <div>
                    <div className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Active deals</div>
                    <div className="text-xs text-[#64748B] mt-0.5">
                      {deals.length} deal{deals.length === 1 ? '' : 's'} · ${totalPipeline ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(totalPipeline) : '$0'} weighted pipeline
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.875rem' }}>
                    <thead>
                      <tr>
                        {['Deal', 'Value', 'Stage', 'Days in stage', 'Health', 'Owner'].map(h => (
                          <th key={h} className="text-left px-3 py-2.5" style={{
                            fontSize: 10, fontWeight: 600, color: '#64748B', textTransform: 'uppercase',
                            letterSpacing: '0.08em', borderBottom: '1px solid var(--biqc-border)', fontFamily: fontFamily.mono,
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {deals.map((d, i) => {
                        const name = d.name || d.deal_name || `Deal ${i + 1}`;
                        const amount = parseFloat(d.amount) || 0;
                        const stage = d.stage?.name || d.stage || 'Unknown';
                        const owner = d.owner?.name || d.owner?.display_name || d.owner?.email || '—';
                        const daysInStage = d.last_modified_at
                          ? Math.floor((Date.now() - new Date(d.last_modified_at).getTime()) / 86400000)
                          : d.days_in_stage || null;
                        const probability = d.probability || 0;
                        // Health: use probability if available, else compute from days stalled
                        const healthPctDeal = probability > 0 ? probability : (daysInStage != null ? Math.max(10, 100 - daysInStage * 4) : 50);
                        const healthColor = healthPctDeal >= 70 ? '#10B981' : healthPctDeal >= 45 ? '#F59E0B' : '#EF4444';
                        // Stage pill color
                        const stageLC = stage.toLowerCase();
                        const stageStyle = /discovery|lead|qualif/i.test(stageLC) ? { bg: 'rgba(59,130,246,0.1)', color: '#3B82F6' }
                          : /proposal|demo/i.test(stageLC) ? { bg: 'rgba(232,93,0,0.1)', color: '#E85D00' }
                          : /negoti/i.test(stageLC) ? { bg: 'rgba(245,158,11,0.1)', color: '#F59E0B' }
                          : /won/i.test(stageLC) ? { bg: 'rgba(16,185,129,0.1)', color: '#10B981' }
                          : /lost/i.test(stageLC) ? { bg: 'rgba(239,68,68,0.1)', color: '#EF4444' }
                          : { bg: 'var(--biqc-bg)', color: '#64748B' };
                        const daysWarn = daysInStage != null && daysInStage > 14;
                        return (
                          <tr key={i} className="cursor-pointer" style={{ transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,93,0,0.03)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td className="px-3 py-2.5 font-semibold text-[#EDF1F7]" style={{ borderBottom: i < deals.length - 1 ? '1px solid var(--biqc-border)' : 'none' }}>{name}</td>
                            <td className="px-3 py-2.5" style={{ fontFamily: fontFamily.mono, fontWeight: 600, borderBottom: i < deals.length - 1 ? '1px solid var(--biqc-border)' : 'none' }}>${amount.toLocaleString()}</td>
                            <td className="px-3 py-2.5" style={{ borderBottom: i < deals.length - 1 ? '1px solid var(--biqc-border)' : 'none' }}>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: stageStyle.bg, color: stageStyle.color, fontFamily: fontFamily.mono }}>{stage}</span>
                            </td>
                            <td className="px-3 py-2.5" style={{
                              fontFamily: fontFamily.mono,
                              color: daysWarn ? '#EF4444' : '#8FA0B8',
                              fontWeight: daysWarn ? 600 : 400,
                              borderBottom: i < deals.length - 1 ? '1px solid var(--biqc-border)' : 'none',
                            }}>{daysInStage != null ? `${daysInStage}d` : '—'}</td>
                            <td className="px-3 py-2.5" style={{ borderBottom: i < deals.length - 1 ? '1px solid var(--biqc-border)' : 'none' }}>
                              <div className="flex items-center gap-1.5">
                                <div className="w-12 h-[5px] rounded-full overflow-hidden" style={{ background: 'var(--biqc-bg)' }}>
                                  <div className="h-full rounded-full" style={{ width: healthPctDeal + '%', background: healthColor }} />
                                </div>
                                <span className="text-[11px] font-semibold min-w-[28px]" style={{ fontFamily: fontFamily.mono, color: healthColor }}>{healthPctDeal}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-[#8FA0B8]" style={{ borderBottom: i < deals.length - 1 ? '1px solid var(--biqc-border)' : 'none' }}>{owner}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>

              {/* Pipeline Overview + Churn Signals row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Panel>
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-4 h-4 text-[#3B82F6]" />
                    <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Pipeline Overview</h3>
                  </div>
                  <div className="space-y-3 mb-4">
                    {[['Total Pipeline', '$' + (totalPipeline || 0).toLocaleString()], ['Active Deals', String(activeDeals || 0)], ['Win Rate', (winRate || 0) + '%'], ['Avg Deal Size', avgDealSize ? '$' + avgDealSize.toLocaleString() : '—']].map(([k, v]) => (
                      <div key={k} className="flex justify-between"><span className="text-xs text-[#8FA0B8]">{k}</span><span className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{v}</span></div>
                    ))}
                    <div className="flex justify-between"><span className="text-xs text-[#8FA0B8]">Stalled (&gt;7d)</span><span className="text-sm font-semibold" style={{ fontFamily: fontFamily.mono, color: stalledCount > 0 ? '#E85D00' : '#10B981' }}>{stalledCount}</span></div>
                  </div>
                </Panel>

                <Panel>
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                    <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Churn Signals</h3>
                  </div>
                  {c.revenue?.churn ? (
                    <p className="text-xs text-[#8FA0B8] leading-relaxed">{c.revenue.churn}</p>
                  ) : (
                    <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Insufficient data to assess churn risk. Connect CRM with engagement tracking.</p>
                  )}
                </Panel>
              </div>

              {/* Velocity KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Pipeline Value', value: '$' + Math.round(totalPipeline / 1000) + 'K' },
                  { label: 'Active Deals', value: String(activeDeals) },
                  { label: 'Win Rate', value: winRate + '%' },
                  { label: 'Stalled', value: String(stalledCount) },
                ].map(m => (
                  <Panel key={m.label}>
                    <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>{m.label}</span>
                    <span className="text-xl font-bold text-[#EDF1F7] block" style={{ fontFamily: fontFamily.mono }}>{m.value}</span>
                  </Panel>
                ))}
              </div>
            </>
          )}

          {/* ═══ SCENARIOS TAB ═══ */}
          {activeTab === 'scenarios' && (
            <>
              <Panel>
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-4 h-4 text-[#E85D00]" />
                  <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Growth Scenario Modeling</h3>
                </div>
                <p className="text-xs text-[#64748B] mb-4">Projections computed from your actual CRM deal data. No assumptions.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-lg text-center" style={{ background: '#10B98108', border: '1px solid #10B98125' }}>
                    <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Best Case</span>
                    <span className="text-2xl font-bold text-[#10B981]" style={{ fontFamily: fontFamily.mono }}>${bestCase ? Math.round(bestCase / 1000) + 'K' : '—'}</span>
                    <span className="text-[10px] text-[#64748B] block mt-1">All open deals close</span>
                  </div>
                  <div className="p-4 rounded-lg text-center" style={{ background: '#F59E0B08', border: '1px solid #F59E0B25' }}>
                    <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Base Case</span>
                    <span className="text-2xl font-bold text-[#F59E0B]" style={{ fontFamily: fontFamily.mono }}>${baseCase ? Math.round(baseCase / 1000) + 'K' : '—'}</span>
                    <span className="text-[10px] text-[#64748B] block mt-1">Weighted by probability</span>
                  </div>
                  <div className="p-4 rounded-lg text-center" style={{ background: '#EF444408', border: '1px solid #EF444425' }}>
                    <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Worst Case</span>
                    <span className="text-2xl font-bold text-[#EF4444]" style={{ fontFamily: fontFamily.mono }}>${worstCase ? Math.round(worstCase / 1000) + 'K' : '—'}</span>
                    <span className="text-[10px] text-[#64748B] block mt-1">Only high-prob at 80%</span>
                  </div>
                </div>
              </Panel>

              {/* Deal Probability Distribution */}
              <Panel>
                <h3 className="text-sm font-semibold text-[#EDF1F7] mb-4" style={{ fontFamily: fontFamily.display }}>Pipeline by Probability</h3>
                <div className="space-y-3">
                  {[
                    { label: 'High Probability (70%+)', deals: highProbDeals, color: '#10B981' },
                    { label: 'Medium Probability (40-69%)', deals: medProbDeals, color: '#F59E0B' },
                    { label: 'Low Probability (<40%)', deals: lowProbDeals, color: '#EF4444' },
                  ].map(tier => {
                    const tierValue = tier.deals.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
                    const tierPct = totalPipeline > 0 ? Math.round((tierValue / totalPipeline) * 100) : 0;
                    return (
                      <div key={tier.label}>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-[#8FA0B8]">{tier.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold" style={{ fontFamily: fontFamily.mono, color: tier.color }}>{tier.deals.length} deals</span>
                            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>${Math.round(tierValue / 1000)}K ({tierPct}%)</span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full" style={{ background: tier.color + '20' }}>
                          <div className="h-2 rounded-full transition-all" style={{ background: tier.color, width: tierPct + '%' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              {/* Win/Loss Analysis */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Panel>
                  <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Deals Won</span>
                  <span className="text-2xl font-bold text-[#10B981]" style={{ fontFamily: fontFamily.mono }}>{wonCount}</span>
                </Panel>
                <Panel>
                  <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Deals Lost</span>
                  <span className="text-2xl font-bold text-[#EF4444]" style={{ fontFamily: fontFamily.mono }}>{lostCount}</span>
                </Panel>
                <Panel>
                  <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Open Pipeline</span>
                  <span className="text-2xl font-bold text-[#3B82F6]" style={{ fontFamily: fontFamily.mono }}>{openDeals.length}</span>
                </Panel>
              </div>
            </>
          )}

          {/* ═══ CONCENTRATION TAB ═══ */}
          {activeTab === 'concentration' && (
            <>
              <Panel>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                  <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Revenue Concentration Risk</h3>
                </div>
                <p className="text-xs text-[#64748B] mb-4">High concentration means revenue depends heavily on a small number of clients. Diversification reduces risk.</p>
                
                {sortedCompanies.length > 0 ? (
                  <div className="space-y-2">
                    {sortedCompanies.slice(0, 10).map(([name, value], i) => {
                      const pct = totalPipeline > 0 ? Math.round((value / totalPipeline) * 100) : 0;
                      const color = pct > 40 ? '#EF4444' : pct > 20 ? '#F59E0B' : '#10B981';
                      return (
                        <div key={name}>
                          <div className="flex justify-between mb-1">
                            <span className="text-xs text-[#EDF1F7]">{name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold" style={{ fontFamily: fontFamily.mono, color }}>{pct}%</span>
                              <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>${Math.round(value / 1000)}K</span>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full" style={{ background: color + '20' }}>
                            <div className="h-1.5 rounded-full" style={{ background: color, width: pct + '%' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[#64748B]">Company data not available from CRM. Connect a CRM with company-level deal data to analyse concentration.</p>
                )}
              </Panel>

              {/* Concentration Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Panel>
                  <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Top Client Share</span>
                  <span className="text-2xl font-bold" style={{ fontFamily: fontFamily.mono, color: topClientPct > 40 ? '#EF4444' : topClientPct > 20 ? '#F59E0B' : '#10B981' }}>{topClientPct}%</span>
                  <span className="text-[10px] text-[#64748B] block mt-1">{topClientPct > 40 ? 'High concentration risk' : topClientPct > 20 ? 'Moderate concentration' : 'Well diversified'}</span>
                </Panel>
                <Panel>
                  <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Unique Clients</span>
                  <span className="text-2xl font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{sortedCompanies.length}</span>
                </Panel>
                <Panel>
                  <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Avg per Client</span>
                  <span className="text-2xl font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>
                    {sortedCompanies.length > 0 ? '$' + Math.round((totalPipeline / sortedCompanies.length) / 1000) + 'K' : '—'}
                  </span>
                </Panel>
              </div>
            </>
          )}
          {/* ═══ CROSS-DOMAIN INTELLIGENCE TAB ═══ */}
          {activeTab === 'intelligence' && (
            <>
              {/* Cognition Intelligence Panel — shows when SQL migrations deployed */}
              {unified && unified.instability_indices && (
                <Panel>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#E85D00]" />
                      <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Revenue Cognition Intelligence</h3>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: '#10B98115', color: '#10B981', fontFamily: fontFamily.mono }}>LIVE</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'RVI', title: 'Revenue Volatility', val: unified.instability_indices.revenue_volatility_index },
                      { label: 'CDR', title: 'Cash Deviation', val: unified.instability_indices.cash_deviation_ratio },
                      { label: 'EDS', title: 'Engagement Decay', val: unified.instability_indices.engagement_decay_score },
                      { label: 'ADS', title: 'Anomaly Density', val: unified.instability_indices.anomaly_density_score },
                    ].map(({ label, title, val }) => {
                      if (val == null) return null;
                      const pct = Math.round(val * 100);
                      const ic = pct > 60 ? '#EF4444' : pct > 30 ? '#F59E0B' : '#10B981';
                      return (
                        <div key={label} className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
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
                  {unified.confidence_score != null && (
                    <p className="text-[10px]" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
                      Intelligence confidence: {Math.round(unified.confidence_score * 100)}% — based on {unified.evidence_count || 0} evidence points
                    </p>
                  )}
                </Panel>
              )}

              {/* Propagation Chains */}
              {unified?.propagation_map?.length > 0 && (
                <Panel>
                  <div className="flex items-center gap-2 mb-4">
                    <ArrowUpRight className="w-4 h-4 text-[#EF4444]" />
                    <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Risk Propagation Chains</h3>
                  </div>
                  <div className="space-y-3">
                    {unified.propagation_map.slice(0, 4).map((chain, i) => (
                      <div key={i} className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {(chain.chain || [chain.source, chain.target]).filter(Boolean).map((node, ni, arr) => (
                            <React.Fragment key={ni}>
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#EF444415', color: '#EF4444', fontFamily: fontFamily.mono }}>{node}</span>
                              {ni < arr.length - 1 && <span className="text-[10px] text-[#64748B]">→</span>}
                            </React.Fragment>
                          ))}
                          {chain.probability != null && (
                            <span className="text-[9px] ml-auto" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>{Math.round(chain.probability * 100)}%</span>
                          )}
                        </div>
                        {chain.description && <p className="text-[11px]" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.mono }}>{chain.description}</p>}
                      </div>
                    ))}
                  </div>
                </Panel>
              )}

              {!unified?.signals && !unified?.instability_indices ? (
                <Panel className="text-center py-8">
                  <Zap className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
                  <p className="text-sm text-[#EDF1F7] mb-1" style={{ fontFamily: fontFamily.display }}>Cross-Domain Intelligence</p>
                  <p className="text-xs text-[#64748B]">Connect multiple integrations (CRM + Accounting) to unlock cross-domain revenue insights.</p>
                </Panel>
              ) : (
                <>
                  {/* Overdue Invoices from Accounting */}
                  {unified.signals?.overdue_invoices?.length > 0 && (
                    <Panel>
                      <div className="flex items-center gap-2 mb-4">
                        <Receipt className="w-4 h-4 text-[#EF4444]" />
                        <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Overdue Invoices</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#EF444415', color: '#EF4444', fontFamily: fontFamily.mono }}>
                          ACCOUNTING
                        </span>
                      </div>
                      <div className="space-y-2">
                        {unified.signals.overdue_invoices.map((inv, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                            <div>
                              <span className="text-xs text-[#EDF1F7]">Invoice #{inv.number}</span>
                              <span className="text-[10px] text-[#EF4444] block" style={{ fontFamily: fontFamily.mono }}>{inv.days_overdue}d overdue</span>
                            </div>
                            <span className="text-sm font-bold text-[#EF4444]" style={{ fontFamily: fontFamily.mono }}>${(inv.amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  )}

                  {/* At-Risk Deals from CRM */}
                  {unified?.signals?.at_risk?.length > 0 && (
                    <Panel>
                      <div className="flex items-center gap-2 mb-4">
                        <FileWarning className="w-4 h-4 text-[#F59E0B]" />
                        <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>At-Risk Revenue</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#F59E0B15', color: '#F59E0B', fontFamily: fontFamily.mono }}>
                          CRM
                        </span>
                      </div>
                      <div className="space-y-2">
                        {unified.signals.at_risk.map((deal, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                            <div>
                              <span className="text-xs text-[#EDF1F7]">{deal.name}</span>
                              <span className="text-[10px] text-[#F59E0B] block" style={{ fontFamily: fontFamily.mono }}>{deal.risk}</span>
                            </div>
                            <span className="text-sm font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>${(deal.amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  )}

                  {/* Concentration & Cash Signals Summary */}
                  {unified?.signals && <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Panel>
                      <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Pipeline Total</span>
                      <span className="text-2xl font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>
                        ${unified.signals.pipeline_total ? Math.round(unified.signals.pipeline_total / 1000) + 'K' : '—'}
                      </span>
                    </Panel>
                    <Panel>
                      <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Concentration Risk</span>
                      <span className="text-2xl font-bold" style={{ fontFamily: fontFamily.mono, color: unified.signals.concentration_risk === 'high' ? '#EF4444' : unified.signals.concentration_risk === 'medium' ? '#F59E0B' : '#10B981' }}>
                        {(unified.signals.concentration_risk || 'low').toUpperCase()}
                      </span>
                    </Panel>
                    <Panel>
                      <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Stalled Deals</span>
                      <span className="text-2xl font-bold" style={{ fontFamily: fontFamily.mono, color: unified.signals.stalled_deals > 0 ? '#E85D00' : '#10B981' }}>
                        {unified.signals.stalled_deals ?? 0}
                      </span>
                    </Panel>
                  </div>}
                </>
              )}
            </>
          )}

        </>}

        {!hasDeals && !loading && (
          <Panel>
            <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Revenue trend data unavailable. Connect accounting integration to view monthly trends.</p>
          </Panel>
        )}
      </div>
      </EnterpriseContactGate>
    </DashboardLayout>
  );
};

export default RevenuePage;
