/* SuperAdminProviders — Super-Admin API Providers dashboard.
 *
 * Scope locked 2026-04-22 by Andreas: running tally per supplier showing
 * name, plan allocation, usage, status (up/down), errors. One row per
 * provider for EVERY provider BIQc uses. Drill-down by GP deferred.
 *
 * Feeds from GET /api/super-admin/api-providers (see backend/routes/super_admin.py).
 */
import React, { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw,
  ExternalLink, Key,
} from 'lucide-react';
import { fontFamily } from '../design-system/tokens';

const STATUS_META = {
  up:      { label: 'Up',      color: '#10B981', bg: '#10B98115' },
  down:    { label: 'Down',    color: '#EF4444', bg: '#EF444415' },
  error:   { label: 'Error',   color: '#F59E0B', bg: '#F59E0B15' },
  unknown: { label: 'Unknown', color: '#8FA0B8', bg: 'rgba(140,170,210,0.15)' },
};

const fmtAud = (n) => {
  if (!n && n !== 0) return '—';
  const v = Number(n);
  if (v < 0.01) return `A$${v.toFixed(4)}`;
  if (v < 1) return `A$${v.toFixed(3)}`;
  return `A$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtTs = (ts) => {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    return d.toISOString().slice(0, 10);
  } catch { return '—'; }
};

// Quota bar: green <50%, yellow 50-80%, red 80%+ (migration 125 / 2026-04-22).
// Fed by the optional quota_total/quota_used/pct_used fields on each provider
// row. When absent (e.g. a provider with no public usage API), we render "—"
// so the column degrades gracefully rather than showing a misleading 0% bar.
const QuotaBar = ({ pctUsed, quotaUsed, quotaTotal, lastCheckError }) => {
  if (pctUsed === null || pctUsed === undefined) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-[var(--ink-muted)]"
              style={{ fontFamily: fontFamily.mono }}>—</span>
        {lastCheckError && (
          <span className="text-[9px] text-[#EF4444] truncate max-w-[120px]"
                title={lastCheckError}
                style={{ fontFamily: fontFamily.mono }}>
            {String(lastCheckError).slice(0, 28)}
          </span>
        )}
      </div>
    );
  }
  const pct = Math.min(Math.max(Number(pctUsed), 0), 200);
  const color = pct >= 80 ? '#EF4444' : pct >= 50 ? '#F59E0B' : '#10B981';
  const displayPct = Number(pctUsed).toFixed(1);
  const widthPct = Math.min(pct, 100); // cap visual bar at 100% even when over
  return (
    <div className="flex flex-col gap-1 min-w-[110px]">
      <div className="flex items-center justify-between text-[10px]"
           style={{ fontFamily: fontFamily.mono }}>
        <span style={{ color }}>{displayPct}%</span>
        {quotaUsed !== null && quotaUsed !== undefined &&
          quotaTotal !== null && quotaTotal !== undefined && (
          <span className="text-[var(--ink-muted)]">
            {Number(quotaUsed).toLocaleString()}/{Number(quotaTotal).toLocaleString()}
          </span>
        )}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden"
           style={{ background: 'var(--biqc-border)' }}>
        <div style={{
          width: `${widthPct}%`,
          height: '100%',
          background: color,
          transition: 'width 200ms ease',
        }} />
      </div>
    </div>
  );
};

const rowAccent = (row) => {
  const st = String(row.status || 'unknown');
  if (!row.key_configured) return { bg: '#EF444408', border: '#EF444425' };
  if (st === 'down' || st === 'error') return { bg: '#EF444408', border: '#EF444425' };
  if (st === 'up' && row.last_error) return { bg: '#F59E0B08', border: '#F59E0B25' };
  if (st === 'up') return { bg: '#10B98108', border: '#10B98125' };
  return { bg: 'transparent', border: 'var(--biqc-border)' };
};

const SuperAdminProviders = () => {
  const [admin, setAdmin] = useState(null);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadProviders = useCallback(async () => {
    setRefreshing(true); setError(null);
    try {
      const res = await apiClient.get('/super-admin/api-providers');
      setProviders(res.data?.providers || []);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [verifyRes] = await Promise.allSettled([apiClient.get('/super-admin/verify')]);
        if (verifyRes.status === 'fulfilled') setAdmin(verifyRes.value.data);
        await loadProviders();
      } catch { /* admin block renders */ } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, [loadProviders]);

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 text-[#E85D00] animate-spin" />
      </div>
    </DashboardLayout>
  );

  if (!admin?.is_super_admin) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="w-12 h-12 text-[#EF4444] mx-auto mb-3" />
          <h2 className="text-lg text-[var(--ink-display)]" style={{ fontFamily: fontFamily.display }}>Access Denied</h2>
          <p className="text-sm text-[var(--ink-muted)]">Super admin role required.</p>
        </div>
      </div>
    </DashboardLayout>
  );

  const total = providers.length;
  const configured = providers.filter(p => p.key_configured).length;
  const errored = providers.filter(p => p.status === 'error' || p.status === 'down').length;

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-[1400px]" style={{ fontFamily: fontFamily.body }} data-testid="super-admin-providers">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl text-[var(--ink-display)]" style={{ fontFamily: fontFamily.display }}>
              API Providers
            </h1>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              Running tally per supplier · {total} total · {configured} keys configured · {errored} errored
            </p>
          </div>
          <button
            onClick={loadProviders}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs"
            style={{
              background: 'var(--biqc-bg-card)',
              border: '1px solid var(--biqc-border)',
              color: 'var(--ink-display)',
              fontFamily: fontFamily.mono,
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-xl p-3 text-xs" style={{ background: '#EF444410', border: '1px solid #EF444430', color: '#EF4444' }}>
            {error}
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-[10px]" style={{ fontFamily: fontFamily.mono }}>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: v.bg, color: v.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: v.color }} />
              {v.label}
            </span>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--biqc-border)' }}>
                  {['Provider', 'Env Var', 'Configured', 'Plan', 'Quota', 'Total Calls', 'Total Cost', 'Status', 'Last Error', 'Last Called'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[var(--ink-muted)]"
                        style={{ fontFamily: fontFamily.mono, fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => {
                  const accent = rowAccent(p);
                  const stMeta = STATUS_META[p.status] || STATUS_META.unknown;
                  return (
                    <tr key={p.provider}
                        style={{ background: accent.bg, borderBottom: `1px solid ${accent.border}` }}>
                      {/* Provider name */}
                      <td className="px-3 py-3 text-[var(--ink-display)] font-medium">
                        {p.provider}
                      </td>

                      {/* Env var */}
                      <td className="px-3 py-3 text-[var(--ink-muted)]" style={{ fontFamily: fontFamily.mono }}>
                        {p.env_var_name}
                      </td>

                      {/* Configured */}
                      <td className="px-3 py-3">
                        {p.key_configured ? (
                          <span className="inline-flex items-center gap-1 text-[#10B981]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#EF4444]">
                            <XCircle className="w-3.5 h-3.5" /> Missing
                          </span>
                        )}
                      </td>

                      {/* Plan */}
                      <td className="px-3 py-3 text-[var(--ink-muted)] max-w-xs">
                        <div className="flex items-start gap-1.5">
                          <Key className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="text-[11px] leading-snug">{p.plan_allocation_note}</div>
                            {p.plan_url && (
                              <a href={p.plan_url} target="_blank" rel="noopener noreferrer"
                                 className="inline-flex items-center gap-1 text-[10px] text-[#E85D00] mt-0.5 hover:underline"
                                 style={{ fontFamily: fontFamily.mono }}>
                                dashboard <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Quota (plan headroom from provider_quotas — migration 125) */}
                      <td className="px-3 py-3">
                        <QuotaBar
                          pctUsed={p.pct_used}
                          quotaUsed={p.quota_used}
                          quotaTotal={p.quota_total}
                          lastCheckError={p.quota_last_check_error}
                        />
                      </td>

                      {/* Total calls */}
                      <td className="px-3 py-3 text-right text-[var(--ink-display)]"
                          style={{ fontFamily: fontFamily.mono }}>
                        {Number(p.call_count || 0).toLocaleString()}
                      </td>

                      {/* Total cost */}
                      <td className="px-3 py-3 text-right text-[var(--ink-display)]"
                          style={{ fontFamily: fontFamily.mono }}>
                        {fmtAud(p.total_cost_aud)}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px]"
                              style={{ background: stMeta.bg, color: stMeta.color, fontFamily: fontFamily.mono }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: stMeta.color }} />
                          {stMeta.label}
                        </span>
                      </td>

                      {/* Last error */}
                      <td className="px-3 py-3 text-[var(--ink-muted)] max-w-[220px]">
                        {p.last_error ? (
                          <div title={p.last_error} className="flex items-start gap-1">
                            <AlertTriangle className="w-3 h-3 text-[#F59E0B] mt-0.5 flex-shrink-0" />
                            <span className="truncate text-[11px]">{p.last_error}</span>
                          </div>
                        ) : <span className="text-[var(--ink-muted)]">—</span>}
                        {p.last_error_at && (
                          <div className="text-[10px] text-[var(--ink-muted)] ml-4 mt-0.5"
                               style={{ fontFamily: fontFamily.mono }}>
                            {fmtTs(p.last_error_at)}
                          </div>
                        )}
                      </td>

                      {/* Last called */}
                      <td className="px-3 py-3 text-[var(--ink-muted)]"
                          style={{ fontFamily: fontFamily.mono }}>
                        {fmtTs(p.last_called_at)}
                      </td>
                    </tr>
                  );
                })}

                {providers.length === 0 && !refreshing && (
                  <tr>
                    <td colSpan={10} className="px-3 py-10 text-center text-[var(--ink-muted)] text-xs">
                      No provider rows yet. Migration 118 seeds these on deploy.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footnote */}
        <div className="text-[10px] text-[var(--ink-muted)]" style={{ fontFamily: fontFamily.mono }}>
          Tally refreshed on page load. LLM totals roll up from usage_ledger;
          non-LLM providers (Resend, Merge, Browse AI, SEMrush, Firecrawl,
          Perplexity) are recorded per-call via provider_tracker. Per-GP
          drill-down deferred.
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminProviders;
