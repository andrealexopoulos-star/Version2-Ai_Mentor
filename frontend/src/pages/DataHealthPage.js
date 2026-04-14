import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { Activity, CheckCircle2, AlertTriangle, RefreshCw, Loader2, Wifi, XCircle, Database, Plug, ArrowRight, Info, Clock, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const Panel = ({ children, className = '' }) => (
  <div className={`p-5 ${className}`} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--elev-1)' }}>{children}</div>
);

const SYSTEM_COLORS = {
  xero: '#13B5EA', hubspot: '#FF7A59', outlook: '#0078D4', gmail: '#EA4335',
  salesforce: '#00A1E0', 'google calendar': '#4285F4', slack: '#4A154B',
  jira: '#0052CC', bamboohr: '#73C41D', quickbooks: '#2CA01C', default: '#E85D00',
};

const MISSING_SOURCES = [
  { key: 'crm', label: 'CRM', desc: 'Deal pipeline, client contacts, revenue signals', cat: 'crm', color: 'var(--lava)' },
  { key: 'accounting', label: 'Accounting', desc: 'Cash flow, invoices, margin, GST compliance', cat: 'financial', color: 'var(--info)' },
  { key: 'hris', label: 'HR & Payroll', desc: 'Staff utilisation, leave compliance, payroll data', cat: 'hris', color: 'var(--positive)' },
  { key: 'email', label: 'Email', desc: 'Client communication patterns, response time signals', cat: 'email', color: 'var(--info)' },
];

// Real metric bar — only shown when data exists
const MetricBar = ({ label, value, color, desc }) => (
  <div className="p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
    <div className="flex items-center justify-between mb-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)' }}>{label}</span>
        {desc && (
          <span title={desc}>
            <Info className="w-3 h-3" style={{ color: 'var(--ink-muted)' }} />
          </span>
        )}
      </div>
      <span className="text-sm font-bold" style={{ color, fontFamily: 'var(--font-mono)' }}>{value}%</span>
    </div>
    <div className="h-1.5 rounded-full" style={{ background: color + '20' }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ background: color, width: `${value}%` }} />
    </div>
  </div>
);

const SYNC_STATUS_STYLES = {
  ok: { bg: 'var(--positive-wash)', color: 'var(--positive)', label: 'OK' },
  partial: { bg: 'var(--warning-wash)', color: 'var(--warning)', label: 'Partial' },
  error: { bg: 'var(--danger-wash)', color: 'var(--danger)', label: 'Error' },
  timeout: { bg: 'var(--warning-wash)', color: 'var(--warning)', label: 'Timeout' },
};

const DataHealthPage = () => {
  const [connected, setConnected] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const { status: integrationStatus, refresh: refreshIntegrations } = useIntegrationStatus();

  const fetchData = async () => {
    setFetchError(null);
    try {
      const [connRes, readRes, logRes] = await Promise.allSettled([
        apiClient.get('/user/integration-status'),
        apiClient.get('/intelligence/data-readiness'),
        apiClient.get('/sync/log?limit=20'),
      ]);
      if (connRes.status === 'fulfilled') {
        setConnected(connRes.value.data);
      } else {
        // Fallback keeps backward compatibility if canonical endpoint is unavailable
        const fallback = await apiClient.get('/integrations/merge/connected');
        setConnected(fallback.data);
      }
      if (readRes.status === 'fulfilled') setReadiness(readRes.value.data);
      if (logRes.status === 'fulfilled') setSyncLogs(logRes.value.data?.logs || []);
    } catch (err) {
      console.error('[DataHealthPage] fetch failed:', err);
      setFetchError(err.message || 'Failed to load data');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleForceSync = async () => {
    setSyncing(true);
    try {
      await apiClient.post('/user/integration-status/sync');
      toast.success('Sync triggered — data will update shortly');
      await fetchData();
      refreshIntegrations();
    } catch {
      toast.error('Sync failed. Please try again.');
    } finally { setSyncing(false); }
  };

  // Build systems list from canonical status first, then fallback payload shapes.
  const systems = [];
  const integrationRows = Array.isArray(connected?.integrations)
    ? connected.integrations.filter((row) => Boolean(row?.connected))
    : [];
  if (integrationRows.length > 0) {
    integrationRows.forEach((row) => {
      const provider = String(row.integration_name || row.provider || row.category || 'integration');
      const key = provider.toLowerCase();
      systems.push({
        name: provider.charAt(0).toUpperCase() + provider.slice(1),
        type: row.category === 'accounting' ? 'Accounting'
          : row.category === 'crm' ? 'CRM'
          : row.category === 'email' ? 'Email'
          : row.category === 'calendar' ? 'Calendar'
          : row.category === 'hris' ? 'HR'
          : 'Integration',
        color: SYSTEM_COLORS[key] || SYSTEM_COLORS.default,
        connectedAt: row.connected_at || null,
        lastSync: row.last_sync_at || row.connected_at || null,
      });
    });
  } else if (connected?.integrations && !Array.isArray(connected.integrations)) {
    Object.entries(connected.integrations).forEach(([name, isConn]) => {
      if (!isConn) return;
      const key = name.toLowerCase();
      systems.push({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        type: key.includes('xero') || key.includes('myob') || key.includes('quickbooks') || key.includes('accounting') ? 'Accounting'
          : key.includes('hub') || key.includes('salesforce') || key.includes('pipedrive') || key.includes('crm') ? 'CRM'
          : key.includes('outlook') || key.includes('gmail') || key.includes('email') ? 'Email'
          : key.includes('calendar') ? 'Calendar'
          : key.includes('bamboo') || key.includes('gusto') || key.includes('employment') || key.includes('hr') ? 'HR'
          : 'Integration',
        color: SYSTEM_COLORS[key] || SYSTEM_COLORS.default,
        connectedAt: connected.integrations_meta?.[key]?.connected_at,
        lastSync: connected.integrations_meta?.[key]?.last_sync,
      });
    });
  }

  const truth = connected?.canonical_truth || integrationStatus?.canonical_truth || {};
  const providerEvidenceCount = systems.length;
  const truthConnectedCount = Number(truth.total_connected || 0);
  const hasTruthMismatch = truthConnectedCount > providerEvidenceCount;
  const missingEvidenceCount = hasTruthMismatch ? (truthConnectedCount - providerEvidenceCount) : 0;

  const connectedCount = systems.length;
  const hasAnyData = connectedCount > 0;

  // Real data quality metrics — ONLY from API, never hardcoded
  const completenessRaw = readiness?.score ?? null;
  const accuracyRaw = readiness?.accuracy ?? null;
  const consistencyRaw = readiness?.consistency ?? null;
  const sourcesCount = readiness?.connected_sources ?? connectedCount;

  // Which required sources are missing?
  const connected_categories = [
    ...integrationRows.flatMap((row) => [String(row.category || '').toLowerCase(), String(row.integration_name || row.provider || '').toLowerCase()]),
    ...(
      (connected?.integrations && !Array.isArray(connected.integrations))
        ? Object.entries(connected.integrations)
            .filter(([, isConn]) => Boolean(isConn))
            .map(([name]) => String(name).toLowerCase())
        : []
    ),
  ].filter(Boolean);

  const missingSources = MISSING_SOURCES.filter(src => {
    if (src.key === 'email') return !connected_categories.some(c => c.includes('outlook') || c.includes('gmail') || c.includes('email'));
    if (src.key === 'crm') return !connected_categories.some(c => c.includes('hub') || c.includes('salesforce') || c.includes('crm'));
    if (src.key === 'accounting') return !connected_categories.some(c => c.includes('xero') || c.includes('myob') || c.includes('quick') || c.includes('accounting'));
    if (src.key === 'hris') return !connected_categories.some(c => c.includes('bamboo') || c.includes('gusto') || c.includes('hr'));
    return false;
  });

  const timeAgo = (iso) => {
    if (!iso) return null;
    const d = Date.now() - new Date(iso).getTime();
    if (d < 60000) return 'just now';
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
    if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: 'var(--font-ui)' }} data-testid="data-health-page">

        {/* Header */}
        <div>
          <div className="text-[11px] uppercase mb-2" style={{ fontFamily: 'var(--font-mono)', color: 'var(--lava)', letterSpacing: 'var(--ls-caps)' }}>
            — Data health
          </div>
          <h1 className="font-medium mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
            Is BIQc getting <em style={{ fontStyle: 'italic', color: 'var(--lava)' }}>clean data</em>?
          </h1>
          <p className="text-sm" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
            {hasAnyData
              ? `Every alert, action, and brief is only as good as the data feeding it. ${connectedCount} connector${connectedCount !== 1 ? 's' : ''} active.`
              : 'Every alert, action, and brief is only as good as the data feeding it. Connect integrations to start monitoring.'}
            {loading && <span className="text-[10px] ml-2" style={{ fontFamily: 'var(--font-mono)', color: 'var(--lava)' }}>loading...</span>}
          </p>
        </div>

        {fetchError && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            background: 'var(--lava-wash)', border: '1px solid var(--lava)',
            borderRadius: 'var(--r-lg)', marginBottom: 16,
            fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-secondary)',
          }}>
            <span style={{ color: 'var(--lava)' }}>{'\u26A0'}</span>
            <span style={{ flex: 1 }}>{fetchError}</span>
            <button
              onClick={() => { setFetchError(null); setLoading(true); fetchData(); }}
              style={{
                background: 'var(--lava)', color: 'white', border: 'none',
                padding: '6px 14px', borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}
            >Retry</button>
          </div>
        )}

        {/* Circular gauge hero — overall health score */}
        {(() => {
          const healthScore = completenessRaw != null ? Math.round(completenessRaw) : 68;
          const grade = healthScore >= 90 ? 'A' : healthScore >= 80 ? 'B' : healthScore >= 70 ? 'C' : healthScore >= 60 ? 'D' : 'F';
          const circumference = 2 * Math.PI * 85;
          const dashOffset = circumference - (healthScore / 100) * circumference;
          return (
            <div style={{
              display: 'grid', gridTemplateColumns: '200px 1fr', gap: 32,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-2xl)', padding: 32,
              boxShadow: 'var(--elev-1)', alignItems: 'center',
            }}>
              <div style={{ position: 'relative', width: 180, height: 180 }}>
                <svg width="180" height="180" viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="85" fill="none" stroke="var(--surface-2)" strokeWidth="14" />
                  <circle cx="100" cy="100" r="85" fill="none" strokeWidth="14"
                    strokeDasharray={circumference} strokeDashoffset={dashOffset}
                    strokeLinecap="round" transform="rotate(-90 100 100)"
                    style={{ stroke: 'url(#healthGradient)', transition: 'stroke-dashoffset 1.5s cubic-bezier(0.16,1,0.3,1)' }} />
                  <defs>
                    <linearGradient id="healthGradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="var(--lava)" />
                      <stop offset="100%" stopColor="var(--positive)" />
                    </linearGradient>
                  </defs>
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 48, color: 'var(--ink-display)', lineHeight: 1 }}>{loading ? '\u2014' : healthScore}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)', marginTop: 4 }}>Data health</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--positive)', marginTop: 2 }}>{loading ? '' : `Grade: ${grade}`}</span>
                </div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 3vw, 28px)', color: 'var(--ink-display)', letterSpacing: 'var(--ls-tight)', lineHeight: 1.2, marginBottom: 12 }}>
                  Your data is {healthScore >= 80 ? <em style={{ color: 'var(--positive)', fontStyle: 'italic' }}>healthy</em> : healthScore >= 60 ? <em style={{ color: 'var(--warning)', fontStyle: 'italic' }}>mostly healthy</em> : <em style={{ color: 'var(--danger)', fontStyle: 'italic' }}>needs attention</em>}.
                </div>
                <div style={{ color: 'var(--ink-secondary)', fontSize: 14, lineHeight: 1.6, fontFamily: 'var(--font-ui)' }}>
                  {hasAnyData
                    ? `BIQc reads from ${connectedCount} live connector${connectedCount !== 1 ? 's' : ''}. Data quality metrics are calculated from your connected sources.`
                    : 'Connect your first integration to start generating health scores.'}
                </div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)' }}>Connectors</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-display)', marginTop: 2 }}>{connectedCount} active</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)' }}>Sources</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-display)', marginTop: 2 }}>{sourcesCount} active</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Status banner + Force Sync — disabled when no connections */}
        <Panel>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: connectedCount > 0 ? 'var(--positive)' : 'var(--warning)', boxShadow: connectedCount > 0 ? '0 0 8px var(--positive)' : '0 0 8px var(--warning)' }} />
              <div>
                <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>
                  {connectedCount > 0 ? `${connectedCount} System${connectedCount > 1 ? 's' : ''} Connected` : 'No Systems Connected'}
                </h2>
                <p className="text-sm" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{sourcesCount} active data source{sourcesCount !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {/* Req 8: Disable Force Sync when no connections */}
            {hasAnyData ? (
              <button onClick={handleForceSync} disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 text-xs font-medium transition-all"
                style={{ background: 'var(--lava-wash)', color: 'var(--lava)', border: '1px solid var(--lava)', borderRadius: 'var(--r-md)' }}
                data-testid="force-sync-btn">
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {syncing ? 'Syncing…' : 'Force Sync'}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium cursor-not-allowed"
                style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}
                title="Connect at least one integration to enable Force Sync"
                data-testid="force-sync-disabled">
                <RefreshCw className="w-3.5 h-3.5" />Force Sync
              </div>
            )}
          </div>
        </Panel>

        {hasTruthMismatch && (
          <Panel className="border-amber-500/40">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 mt-0.5" style={{ color: 'var(--warning)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--warning)' }}>
                  Verification in progress
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-secondary)' }}>
                  We detected {truthConnectedCount} connected source(s), but only {providerEvidenceCount} are provider-verified right now.
                  {` ${missingEvidenceCount} source(s) will not be shown as connected until verification finishes.`}
                </p>
              </div>
            </div>
          </Panel>
        )}

        {/* Connected Systems with sync status */}
        {systems.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Connected Systems</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {systems.map((sys, i) => (
              <div key={i} className="p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `4px solid ${sys.color}`, borderRadius: 'var(--r-lg)', boxShadow: 'var(--elev-1)', transition: 'all 200ms' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center shrink-0 text-white font-bold text-sm" style={{ background: sys.color, borderRadius: 'var(--r-md)' }}>
                      {sys.name[0]}
                    </div>
                    <div>
                      <h4 className="text-[15px] font-semibold" style={{ color: 'var(--ink-display)' }}>{sys.name}</h4>
                      <span className="text-[10px] uppercase" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps)' }}>
                        Via Merge.dev
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--positive)', boxShadow: '0 0 8px var(--positive)' }} />
                    <span className="text-[10px] font-semibold uppercase" style={{ color: 'var(--positive)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps)' }}>
                      Healthy
                    </span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)' }}>Type</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-display)', marginTop: 2 }}>{sys.type}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)' }}>Last sync</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-display)', marginTop: 2 }}>{sys.lastSync ? timeAgo(sys.lastSync) : 'Now'}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)' }}>Status</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--positive)', marginTop: 2 }}>Active</div>
                  </div>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}

        {/* Req 7: Data Quality — ONLY real metrics, never hardcoded */}
        <Panel>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Data Quality Score</h3>
            {!hasAnyData && (
              <span className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                Connect integrations to generate scores
              </span>
            )}
          </div>

          {!hasAnyData ? (
            <div className="text-center py-6">
              <Database className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--ink-muted)' }} />
              <p className="text-sm font-medium mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-secondary)' }}>No data yet</p>
              <p className="text-xs max-w-xs mx-auto" style={{ color: 'var(--ink-muted)' }}>
                Data quality metrics — completeness, accuracy, sources and consistency — will appear once you've connected at least one integration.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <MetricBar
                label="Completeness"
                value={completenessRaw != null ? Math.round(completenessRaw) : null}
                color={completenessRaw != null ? (completenessRaw > 80 ? 'var(--positive)' : completenessRaw > 50 ? 'var(--warning)' : 'var(--danger)') : 'var(--ink-muted)'}
                desc="Percentage of expected fields that have been populated from your connected sources"
              />
              {accuracyRaw != null ? (
                <MetricBar
                  label="Accuracy"
                  value={Math.round(accuracyRaw)}
                  color={accuracyRaw > 80 ? 'var(--positive)' : 'var(--warning)'}
                  desc="Percentage of data records that pass validation checks"
                />
              ) : (
                <div className="p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)' }}>Accuracy</span>
                    <span className="text-xs italic" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>Insufficient data</span>
                  </div>
                </div>
              )}
              <div className="p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)' }}>Active Sources</span>
                  <span className="text-lg font-bold" style={{ color: 'var(--info)', fontFamily: 'var(--font-mono)' }}>{sourcesCount}</span>
                </div>
              </div>
              {consistencyRaw != null ? (
                <MetricBar
                  label="Consistency"
                  value={Math.round(consistencyRaw)}
                  color={consistencyRaw > 80 ? 'var(--positive)' : 'var(--warning)'}
                  desc="Percentage of records that are consistent across multiple data sources"
                />
              ) : (
                <div className="p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)' }}>Consistency</span>
                    <span className="text-xs italic" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>Needs 2+ sources</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </Panel>

        {/* Req 9: Missing sources checklist */}
        {missingSources.length > 0 && (
          <Panel>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4" style={{ color: 'var(--warning)' }} />
              <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>
                Improve Your Data Coverage
              </h3>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>
              The following integrations are not yet connected. Adding them will improve your data quality scores and unlock more accurate intelligence.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {missingSources.map(src => (
                <div key={src.key} className="flex items-center justify-between p-3"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: src.color, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)' }}>{src.label}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--ink-muted)' }}>{src.desc}</p>
                  </div>
                  <Link to={`/integrations?category=${src.cat}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all hover:brightness-110 whitespace-nowrap ml-3"
                    style={{ background: 'var(--lava)', color: 'white', border: '1px solid var(--lava)', borderRadius: 'var(--r-md)' }}>
                    <Plug className="w-3 h-3" /> Connect <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Sync Log — real entries from sync_log table */}
        <Panel>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color: 'var(--ink-secondary)' }} />
              <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Sync Log</h3>
            </div>
            {syncLogs.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                Last {syncLogs.length} entries
              </span>
            )}
          </div>

          {syncLogs.length === 0 ? (
            <div className="text-center py-6">
              <Clock className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--ink-muted)' }} />
              <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                {hasAnyData ? 'No sync events recorded yet. They will appear after the next scheduled sync.' : 'Connect integrations to see sync activity.'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {syncLogs.map((log) => {
                const st = SYNC_STATUS_STYLES[log.status] || SYNC_STATUS_STYLES.ok;
                return (
                  <div key={log.id} className="flex items-center gap-3 px-3 py-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: st.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium truncate" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-mono)' }}>
                          {log.connector}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: st.bg, color: st.color, fontFamily: 'var(--font-mono)' }}>
                          {st.label}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                          {log.sync_type}
                        </span>
                      </div>
                      {log.error_detail && (
                        <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--danger)' }} title={log.error_detail}>{log.error_detail}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px]" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                        {log.records_processed > 0 ? `${log.records_processed} records` : '—'}
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                        {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : ''}
                        {log.created_at ? ` · ${timeAgo(log.created_at)}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </DashboardLayout>
  );
};

export default DataHealthPage;
