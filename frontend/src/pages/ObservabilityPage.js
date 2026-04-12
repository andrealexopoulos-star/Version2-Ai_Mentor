import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { supabase } from '../context/SupabaseAuthContext';
import { Activity, Clock, DollarSign, Cpu, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const ObservabilityPage = () => {
  const [data, setData] = useState(null);
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoading(false); return; }

        // Fetch LLM call logs
        const { data: logs } = await supabase.from('llm_call_log').select('model_name, total_tokens, latency_ms, output_valid, endpoint, created_at').order('created_at', { ascending: false }).limit(100);

        // Compute metrics
        const calls = logs || [];
        const totalTokens = calls.reduce((s, c) => s + (c.total_tokens || 0), 0);
        const avgLatency = calls.length > 0 ? Math.round(calls.reduce((s, c) => s + (c.latency_ms || 0), 0) / calls.length) : 0;
        const failCount = calls.filter(c => c.output_valid === false).length;
        const estCost = (totalTokens / 1000) * 0.003; // ~$0.003 per 1K tokens for GPT-4o

        const byModel = {};
        const byEndpoint = {};
        const byHour = {};
        calls.forEach(c => {
          const m = c.model_name || 'unknown';
          byModel[m] = (byModel[m] || 0) + 1;
          const ep = c.endpoint || 'unknown';
          byEndpoint[ep] = (byEndpoint[ep] || 0) + 1;
          const hour = (c.created_at || '').substring(0, 13);
          if (hour) byHour[hour] = (byHour[hour] || 0) + 1;
        });

        setData({ calls: calls.length, totalTokens, avgLatency, failCount, estCost: estCost.toFixed(4), byModel, byEndpoint, byHour, recent: calls.slice(0, 15) });
        try {
          const auditRes = await apiClient.get('/services/cognition-platform-audit');
          setAudit(auditRes.data || null);
        } catch {
          setAudit(null);
        }
      } catch {} finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-96"><Loader2 className="w-6 h-6 text-[#E85D00] animate-spin" /></div></DashboardLayout>;

  const d = data || {};

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-[1100px]" style={{ fontFamily: fontFamily.body }} data-testid="observability-page">
        <div>
          <h1 className="text-2xl font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Observability</h1>
          <p className="text-xs text-[#64748B]">LLM call metrics, token usage, latency, validation status.</p>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total Calls', value: d.calls || 0, icon: Activity, color: '#3B82F6' },
            { label: 'Total Tokens', value: (d.totalTokens || 0).toLocaleString(), icon: Cpu, color: '#E85D00' },
            { label: 'Avg Latency', value: `${d.avgLatency || 0}ms`, icon: Clock, color: '#10B981' },
            { label: 'Est Cost', value: `$${d.estCost || '0'}`, icon: DollarSign, color: '#F59E0B' },
            { label: 'Failures', value: d.failCount || 0, icon: AlertTriangle, color: '#EF4444' },
          ].map(m => (
            <div key={m.label} className="rounded-xl p-3" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <m.icon className="w-3 h-3" style={{ color: m.color }} />
                <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{m.label}</span>
              </div>
              <span className="text-xl font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{m.value}</span>
            </div>
          ))}
        </div>

        {/* By Model + By Endpoint */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl p-4" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: fontFamily.display }}>By Model</h3>
            {Object.entries(d.byModel || {}).map(([model, count]) => (
              <div key={model} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid var(--biqc-border)' }}>
                <span className="text-xs text-[#9FB0C3]">{model}</span>
                <span className="text-xs font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{count}</span>
              </div>
            ))}
            {Object.keys(d.byModel || {}).length === 0 && <p className="text-xs text-[#64748B]">No data yet. Enable observability_full_enabled flag.</p>}
          </div>
          <div className="rounded-xl p-4" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: fontFamily.display }}>By Endpoint</h3>
            {Object.entries(d.byEndpoint || {}).map(([ep, count]) => (
              <div key={ep} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid var(--biqc-border)' }}>
                <span className="text-xs text-[#9FB0C3]">{ep}</span>
                <span className="text-xs font-bold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Calls */}
        <div className="rounded-xl p-4" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
          <h3 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: fontFamily.display }}>Recent Calls</h3>
          <div className="space-y-1">
            {(d.recent || []).map((c, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 text-xs" style={{ borderBottom: '1px solid var(--biqc-border)' }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.output_valid !== false ? '#10B981' : '#EF4444' }} />
                <span className="text-[#9FB0C3] flex-1 truncate">{c.endpoint || c.model_name}</span>
                <span className="text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{c.total_tokens || 0} tok</span>
                <span className="text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{c.latency_ms || 0}ms</span>
                <span className="text-[10px] text-[#64748B]">{c.created_at ? new Date(c.created_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }} data-testid="cognition-platform-audit-card">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Cognition Platform Audit</h3>
            {audit?.summary && (
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#10B981', background: 'rgba(16,185,129,0.12)', fontFamily: fontFamily.mono }} data-testid="cognition-platform-audit-score-chip">
                readiness {audit.summary.readiness_score}%
              </span>
            )}
          </div>

          {!audit ? (
            <p className="text-xs text-[#64748B]" data-testid="cognition-platform-audit-empty">Audit data unavailable.</p>
          ) : (
            <div className="space-y-4" data-testid="cognition-platform-audit-content">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="cognition-platform-audit-summary-grid">
                <div className="rounded-lg p-2" style={{ border: '1px solid var(--biqc-border)' }}><p className="text-[10px] text-[#64748B]">Working</p><p className="text-sm text-[#10B981] font-semibold" style={{ fontFamily: fontFamily.mono }}>{audit.summary?.working ?? 0}</p></div>
                <div className="rounded-lg p-2" style={{ border: '1px solid var(--biqc-border)' }}><p className="text-[10px] text-[#64748B]">Partial</p><p className="text-sm text-[#F59E0B] font-semibold" style={{ fontFamily: fontFamily.mono }}>{audit.summary?.partial ?? 0}</p></div>
                <div className="rounded-lg p-2" style={{ border: '1px solid var(--biqc-border)' }}><p className="text-[10px] text-[#64748B]">Missing</p><p className="text-sm text-[#EF4444] font-semibold" style={{ fontFamily: fontFamily.mono }}>{audit.summary?.missing ?? 0}</p></div>
                <div className="rounded-lg p-2" style={{ border: '1px solid var(--biqc-border)' }}><p className="text-[10px] text-[#64748B]">Total checks</p><p className="text-sm text-[#CBD5E1] font-semibold" style={{ fontFamily: fontFamily.mono }}>{audit.summary?.total_checks ?? 0}</p></div>
              </div>

              <div data-testid="cognition-platform-audit-table-wrap" className="overflow-x-auto">
                <table className="w-full text-xs" data-testid="cognition-platform-audit-table">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--biqc-border)' }}>
                      <th className="text-left py-2 text-[#94A3B8]">Layer</th>
                      <th className="text-left py-2 text-[#94A3B8]">Component</th>
                      <th className="text-left py-2 text-[#94A3B8]">Status</th>
                      <th className="text-left py-2 text-[#94A3B8]">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(audit.sql_schema_and_tables || []).slice(0, 30).map((item) => ({
                      layer: 'SQL/Table',
                      component: `${item.schema}.${item.table}`,
                      status: item.status,
                      detail: item.detail,
                    })), ...(audit.sql_functions || []).map((item) => ({
                      layer: 'SQL/RPC',
                      component: item.function,
                      status: item.status,
                      detail: item.detail,
                    })), ...(audit.edge_functions || []).map((item) => ({
                      layer: 'Edge Fn',
                      component: item.edge_function,
                      status: item.status,
                      detail: item.detail,
                    })), ...(audit.webhooks || []).map((item) => ({
                      layer: 'Webhook',
                      component: item.webhook,
                      status: item.status,
                      detail: item.detail,
                    }))].map((row, idx) => (
                      <tr key={`${row.layer}-${row.component}-${idx}`} style={{ borderBottom: '1px solid var(--biqc-border)' }} data-testid={`cognition-platform-audit-row-${idx}`}>
                        <td className="py-2 text-[#94A3B8]">{row.layer}</td>
                        <td className="py-2 text-[#CBD5E1]" style={{ fontFamily: fontFamily.mono }}>{row.component}</td>
                        <td className="py-2">
                          <span className="px-1.5 py-0.5 rounded" style={{
                            background: row.status === 'working' ? 'rgba(16,185,129,0.12)' : row.status === 'partial' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                            color: row.status === 'working' ? '#10B981' : row.status === 'partial' ? '#F59E0B' : '#EF4444',
                            fontFamily: fontFamily.mono,
                          }}>{row.status}</span>
                        </td>
                        <td className="py-2 text-[#94A3B8]">{String(row.detail || '').slice(0, 120)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ObservabilityPage;
