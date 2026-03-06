import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { supabase } from '../context/SupabaseAuthContext';
import { Activity, Clock, DollarSign, Cpu, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const ObservabilityPage = () => {
  const [data, setData] = useState(null);
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
      } catch {} finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-96"><Loader2 className="w-6 h-6 text-[#FF6A00] animate-spin" /></div></DashboardLayout>;

  const d = data || {};

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-[1100px]" style={{ fontFamily: fontFamily.body }} data-testid="observability-page">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Observability</h1>
          <p className="text-xs text-[#64748B]">LLM call metrics, token usage, latency, validation status.</p>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total Calls', value: d.calls || 0, icon: Activity, color: '#3B82F6' },
            { label: 'Total Tokens', value: (d.totalTokens || 0).toLocaleString(), icon: Cpu, color: '#FF6A00' },
            { label: 'Avg Latency', value: `${d.avgLatency || 0}ms`, icon: Clock, color: '#10B981' },
            { label: 'Est Cost', value: `$${d.estCost || '0'}`, icon: DollarSign, color: '#F59E0B' },
            { label: 'Failures', value: d.failCount || 0, icon: AlertTriangle, color: '#EF4444' },
          ].map(m => (
            <div key={m.label} className="rounded-xl p-3" style={{ background: '#141C26', border: '1px solid #243140' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <m.icon className="w-3 h-3" style={{ color: m.color }} />
                <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{m.label}</span>
              </div>
              <span className="text-xl font-bold text-[#F4F7FA]" style={{ fontFamily: fontFamily.mono }}>{m.value}</span>
            </div>
          ))}
        </div>

        {/* By Model + By Endpoint */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl p-4" style={{ background: '#141C26', border: '1px solid #243140' }}>
            <h3 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: fontFamily.display }}>By Model</h3>
            {Object.entries(d.byModel || {}).map(([model, count]) => (
              <div key={model} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid #243140' }}>
                <span className="text-xs text-[#9FB0C3]">{model}</span>
                <span className="text-xs font-bold text-[#F4F7FA]" style={{ fontFamily: fontFamily.mono }}>{count}</span>
              </div>
            ))}
            {Object.keys(d.byModel || {}).length === 0 && <p className="text-xs text-[#64748B]">No data yet. Enable observability_full_enabled flag.</p>}
          </div>
          <div className="rounded-xl p-4" style={{ background: '#141C26', border: '1px solid #243140' }}>
            <h3 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: fontFamily.display }}>By Endpoint</h3>
            {Object.entries(d.byEndpoint || {}).map(([ep, count]) => (
              <div key={ep} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid #243140' }}>
                <span className="text-xs text-[#9FB0C3]">{ep}</span>
                <span className="text-xs font-bold text-[#F4F7FA]" style={{ fontFamily: fontFamily.mono }}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Calls */}
        <div className="rounded-xl p-4" style={{ background: '#141C26', border: '1px solid #243140' }}>
          <h3 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: fontFamily.display }}>Recent Calls</h3>
          <div className="space-y-1">
            {(d.recent || []).map((c, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 text-xs" style={{ borderBottom: '1px solid #1E293B' }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.output_valid !== false ? '#10B981' : '#EF4444' }} />
                <span className="text-[#9FB0C3] flex-1 truncate">{c.endpoint || c.model_name}</span>
                <span className="text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{c.total_tokens || 0} tok</span>
                <span className="text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{c.latency_ms || 0}ms</span>
                <span className="text-[10px] text-[#64748B]">{c.created_at ? new Date(c.created_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ObservabilityPage;
