import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { Activity, CheckCircle2, AlertTriangle, RefreshCw, Loader2, Wifi, XCircle, Database, Plug, ArrowRight, Info } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>{children}</div>
);

const SYSTEM_COLORS = {
  xero: '#13B5EA', hubspot: '#FF6A00', outlook: '#0078D4', gmail: '#EF4444',
  salesforce: '#00A1E0', 'google calendar': '#4285F4', slack: '#4A154B',
  jira: '#0052CC', bamboohr: '#73C41D', quickbooks: '#2CA01C', default: '#FF6A00',
};

const MISSING_SOURCES = [
  { key: 'crm', label: 'CRM', desc: 'Deal pipeline, client contacts, revenue signals', cat: 'crm', color: '#FF7A59' },
  { key: 'accounting', label: 'Accounting', desc: 'Cash flow, invoices, margin, GST compliance', cat: 'financial', color: '#13B5EA' },
  { key: 'hris', label: 'HR & Payroll', desc: 'Staff utilisation, leave compliance, payroll data', cat: 'hris', color: '#10B981' },
  { key: 'email', label: 'Email', desc: 'Client communication patterns, response time signals', cat: 'email', color: '#0078D4' },
];

// Real metric bar — only shown when data exists
const MetricBar = ({ label, value, color, desc }) => (
  <div className="p-4 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
    <div className="flex items-center justify-between mb-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-[#9FB0C3]" style={{ fontFamily: fontFamily.mono }}>{label}</span>
        {desc && (
          <span title={desc}>
            <Info className="w-3 h-3 text-[#4A5568]" />
          </span>
        )}
      </div>
      <span className="text-sm font-bold" style={{ color, fontFamily: fontFamily.mono }}>{value}%</span>
    </div>
    <div className="h-1.5 rounded-full" style={{ background: color + '20' }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ background: color, width: `${value}%` }} />
    </div>
  </div>
);

const DataHealthPage = () => {
  const [connected, setConnected] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { status: integrationStatus, refresh: refreshIntegrations } = useIntegrationStatus();

  const fetchData = async () => {
    try {
      const [connRes, readRes] = await Promise.allSettled([
        apiClient.get('/integrations/merge/connected'),
        apiClient.get('/intelligence/data-readiness'),
      ]);
      if (connRes.status === 'fulfilled') setConnected(connRes.value.data);
      if (readRes.status === 'fulfilled') setReadiness(readRes.value.data);
    } catch {} finally { setLoading(false); }
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

  // Build systems list from live data only — NO hardcoded fallbacks
  const systems = [];
  if (connected?.integrations) {
    Object.entries(connected.integrations).forEach(([name, isConn]) => {
      if (!isConn) return; // Only show connected systems
      const key = name.toLowerCase();
      systems.push({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        type: key.includes('xero') || key.includes('myob') || key.includes('quickbooks') ? 'Accounting'
          : key.includes('hub') || key.includes('salesforce') || key.includes('pipedrive') ? 'CRM'
          : key.includes('outlook') || key.includes('gmail') ? 'Email'
          : key.includes('calendar') ? 'Calendar'
          : key.includes('bamboo') || key.includes('gusto') || key.includes('employment') ? 'HR'
          : 'Integration',
        color: SYSTEM_COLORS[key] || SYSTEM_COLORS.default,
        connectedAt: connected.integrations_meta?.[key]?.connected_at,
        lastSync: connected.integrations_meta?.[key]?.last_sync,
      });
    });
  }
  // Email integrations from readiness
  if (readiness?.email?.outlook && !systems.some(s => s.name.toLowerCase().includes('outlook'))) {
    systems.push({ name: 'Outlook', type: 'Email', color: '#0078D4', connectedAt: null, lastSync: null });
  }
  if (readiness?.email?.gmail && !systems.some(s => s.name.toLowerCase().includes('gmail'))) {
    systems.push({ name: 'Gmail', type: 'Email', color: '#EF4444', connectedAt: null, lastSync: null });
  }

  const connectedCount = systems.length;
  const hasAnyData = connectedCount > 0;

  // Real data quality metrics — ONLY from API, never hardcoded
  const completenessRaw = readiness?.score ?? null;
  const accuracyRaw = readiness?.accuracy ?? null;
  const consistencyRaw = readiness?.consistency ?? null;
  const sourcesCount = readiness?.connected_sources ?? connectedCount;

  // Which required sources are missing?
  const connected_categories = [
    ...(connected?.integrations ? Object.keys(connected.integrations).filter(k => connected.integrations[k]) : []),
    ...(readiness?.email?.outlook || readiness?.email?.gmail ? ['email'] : []),
  ].map(k => k.toLowerCase());

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
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: fontFamily.body }} data-testid="data-health-page">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Data Health</h1>
          <p className="text-sm text-[#9FB0C3]">
            {hasAnyData
              ? `${connectedCount} integration${connectedCount !== 1 ? 's' : ''} active — monitoring data quality in real time.`
              : 'Connect integrations to start monitoring data quality and sync status.'}
            {loading && <span className="text-[10px] ml-2 text-[#FF6A00]" style={{ fontFamily: fontFamily.mono }}>loading...</span>}
          </p>
        </div>

        {/* Status banner + Force Sync — disabled when no connections */}
        <Panel>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${connectedCount > 0 ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
              <div>
                <h2 className="text-lg font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>
                  {connectedCount > 0 ? `${connectedCount} System${connectedCount > 1 ? 's' : ''} Connected` : 'No Systems Connected'}
                </h2>
                <p className="text-sm text-[#9FB0C3]">{sourcesCount} active data source{sourcesCount !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {/* Req 8: Disable Force Sync when no connections */}
            {hasAnyData ? (
              <button onClick={handleForceSync} disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all"
                style={{ background: '#FF6A0015', color: '#FF6A00', border: '1px solid #FF6A0030' }}
                data-testid="force-sync-btn">
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {syncing ? 'Syncing…' : 'Force Sync'}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium cursor-not-allowed"
                style={{ background: '#1E2D3D', color: '#4A5568', border: '1px solid #243140' }}
                title="Connect at least one integration to enable Force Sync"
                data-testid="force-sync-disabled">
                <RefreshCw className="w-3.5 h-3.5" />Force Sync
              </div>
            )}
          </div>
        </Panel>

        {/* Connected Systems with sync status */}
        {systems.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Connected Systems</h3>
            {systems.map((sys, i) => (
              <Panel key={i}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-sm" style={{ background: sys.color }}>
                    {sys.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-[#F4F7FA]">{sys.name}</h4>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: '#64748B', background: '#1E2D3D', fontFamily: fontFamily.mono }}>{sys.type}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', fontFamily: fontFamily.mono }}>
                        ✓ Connected
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <Wifi className="w-3 h-3 text-[#10B981]" />
                      <span className="text-[11px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
                        {sys.lastSync ? `Last synced ${timeAgo(sys.lastSync)}` : 'Syncing now'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Link to="/integrations"
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110"
                      style={{ background: '#1E2D3D', color: '#9FB0C3', border: '1px solid #243140' }}>
                      Reconnect
                    </Link>
                    <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        )}

        {/* Req 7: Data Quality — ONLY real metrics, never hardcoded */}
        <Panel>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Data Quality Score</h3>
            {!hasAnyData && (
              <span className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: '#1E2D3D', color: '#64748B', fontFamily: fontFamily.mono }}>
                Connect integrations to generate scores
              </span>
            )}
          </div>

          {!hasAnyData ? (
            <div className="text-center py-6">
              <Database className="w-8 h-8 mx-auto mb-3" style={{ color: '#4A5568' }} />
              <p className="text-sm font-medium text-[#9FB0C3] mb-1" style={{ fontFamily: fontFamily.display }}>No data yet</p>
              <p className="text-xs max-w-xs mx-auto" style={{ color: '#64748B' }}>
                Data quality metrics — completeness, accuracy, sources and consistency — will appear once you've connected at least one integration.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <MetricBar
                label="Completeness"
                value={completenessRaw != null ? Math.round(completenessRaw) : null}
                color={completenessRaw != null ? (completenessRaw > 80 ? '#10B981' : completenessRaw > 50 ? '#F59E0B' : '#EF4444') : '#64748B'}
                desc="Percentage of expected fields that have been populated from your connected sources"
              />
              {accuracyRaw != null ? (
                <MetricBar
                  label="Accuracy"
                  value={Math.round(accuracyRaw)}
                  color={accuracyRaw > 80 ? '#10B981' : '#F59E0B'}
                  desc="Percentage of data records that pass validation checks"
                />
              ) : (
                <div className="p-4 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-[#9FB0C3]" style={{ fontFamily: fontFamily.mono }}>Accuracy</span>
                    <span className="text-xs italic" style={{ color: '#4A5568', fontFamily: fontFamily.mono }}>Insufficient data</span>
                  </div>
                </div>
              )}
              <div className="p-4 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-[#9FB0C3]" style={{ fontFamily: fontFamily.mono }}>Active Sources</span>
                  <span className="text-lg font-bold" style={{ color: '#3B82F6', fontFamily: fontFamily.mono }}>{sourcesCount}</span>
                </div>
              </div>
              {consistencyRaw != null ? (
                <MetricBar
                  label="Consistency"
                  value={Math.round(consistencyRaw)}
                  color={consistencyRaw > 80 ? '#10B981' : '#F59E0B'}
                  desc="Percentage of records that are consistent across multiple data sources"
                />
              ) : (
                <div className="p-4 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-[#9FB0C3]" style={{ fontFamily: fontFamily.mono }}>Consistency</span>
                    <span className="text-xs italic" style={{ color: '#4A5568', fontFamily: fontFamily.mono }}>Needs 2+ sources</span>
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
              <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
              <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>
                Improve Your Data Coverage
              </h3>
            </div>
            <p className="text-xs text-[#64748B] mb-4">
              The following integrations are not yet connected. Adding them will improve your data quality scores and unlock more accurate intelligence.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {missingSources.map(src => (
                <div key={src.key} className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: 'var(--biqc-bg)', border: `1px solid ${src.color}20` }}>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: src.color, fontFamily: fontFamily.mono }}>{src.label}</p>
                    <p className="text-[10px] text-[#64748B] mt-0.5">{src.desc}</p>
                  </div>
                  <Link to={`/integrations?category=${src.cat}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110 whitespace-nowrap ml-3"
                    style={{ background: '#FF6A0015', color: '#FF6A00', border: '1px solid #FF6A0030' }}>
                    <Plug className="w-3 h-3" /> Connect <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DataHealthPage;
