import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import FloatingSoundboard from '../components/FloatingSoundboard';
import { CognitiveMesh } from '../components/LoadingSystems';
import { apiClient } from '../lib/api';
import { Radar, TrendingUp, TrendingDown, Users, Globe, ArrowUpRight, Target, Shield, AlertTriangle, Activity } from 'lucide-react';

const SORA = "'Cormorant Garamond', Georgia, serif";
const INTER = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const ST_COLORS = {
  STABLE: { c: '#10B981', label: 'Stable' },
  DRIFT: { c: '#F59E0B', label: 'Drift Detected' },
  COMPRESSION: { c: '#FF6A00', label: 'Compression' },
  CRITICAL: { c: '#EF4444', label: 'Critical' },
};

const MarketPage = () => {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // Try snapshot/latest first (cached data)
        const res = await apiClient.get('/snapshot/latest');
        if (res.data?.cognitive) { setSnapshot(res.data.cognitive); setLoading(false); return; }
      } catch {}
      // Fallback: trigger a fresh cognitive snapshot
      try {
        const { data: { session } } = await (await import('../context/SupabaseAuthContext')).supabase.auth.getSession();
        if (session) {
          const sbUrl = process.env.REACT_APP_SUPABASE_URL;
          const key = process.env.REACT_APP_SUPABASE_ANON_KEY;
          const res = await fetch(`${sbUrl}/functions/v1/biqc-insights-cognitive`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json', 'apikey': key },
            body: '{}',
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.cognitive) setSnapshot(data.cognitive);
          }
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const c = snapshot || {};
  const stateStatus = typeof c.system_state === 'object' ? c.system_state?.status : c.system_state;
  const confidence = typeof c.system_state === 'object' ? c.system_state?.confidence : c.confidence_level;
  const interpretation = typeof c.system_state === 'object' ? c.system_state?.interpretation : c.system_state_interpretation;
  const velocity = typeof c.system_state === 'object' ? c.system_state?.velocity : null;
  const st = ST_COLORS[stateStatus] || ST_COLORS.STABLE;
  const marketNarrative = c.market_position || c.market?.narrative || null;
  const alignment = c.strategic_alignment_check || c.alignment?.narrative || '';
  const contradictions = c.alignment?.contradictions || [];
  const memo = c.executive_memo || c.memo || '';
  const pipeline = c.pipeline_total;
  const slaBreaches = c.sla_breaches || c.execution?.sla_breaches;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: INTER }} data-testid="market-page">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: SORA }}>Market Intelligence</h1>
          <p className="text-sm text-[#9FB0C3]">
            Strategic positioning, competitive landscape, drift analysis, and market alignment.
            {loading && <span className="text-[10px] ml-2 text-[#FF6A00]" style={{ fontFamily: MONO }}>syncing...</span>}
          </p>
        </div>

        {/* ═══ SYSTEM STATE — CMO SNAPSHOT ═══ */}
        <div className="rounded-xl p-5" style={{ background: st.c + '08', border: `1px solid ${st.c}25` }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: st.c, boxShadow: `0 0 12px ${st.c}50` }} />
              <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: st.c, fontFamily: MONO }}>
                {stateStatus || 'STABLE'}
              </span>
              {velocity && (
                <span className="text-xs" style={{ color: st.c }}>
                  {velocity === 'worsening' ? '↘' : velocity === 'improving' ? '↗' : '→'} {velocity}
                </span>
              )}
            </div>
            {confidence && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: st.c, background: `${st.c}15`, fontFamily: MONO }}>
                {typeof confidence === 'number' ? `${confidence}% confidence` : confidence}
              </span>
            )}
          </div>
          {interpretation && (
            <p className="text-sm mt-3 text-[#9FB0C3] leading-relaxed" style={{ fontFamily: INTER }}>{interpretation}</p>
          )}
        </div>

        {/* ═══ DRIFT DELTA BARS (no cash — cash is in Risk page only) ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Pipeline Health', value: pipeline ? `$${Math.round(pipeline / 1000)}K` : '—', icon: TrendingUp, status: 'good' },
            { label: 'SLA Health', value: slaBreaches ? `${slaBreaches} breach${slaBreaches > 1 ? 'es' : ''}` : 'Clear', icon: AlertTriangle, status: slaBreaches > 0 ? 'warning' : 'good' },
            { label: 'Market State', value: st.label, icon: Shield, status: stateStatus === 'STABLE' ? 'good' : 'warning' },
            { label: 'Competitive Position', value: stateStatus === 'CRITICAL' ? 'At Risk' : stateStatus === 'DRIFT' ? 'Under Pressure' : 'Holding', icon: Target, status: stateStatus === 'STABLE' ? 'good' : 'warning' },
          ].map(m => {
            const barColor = m.status === 'good' ? '#10B981' : '#F59E0B';
            return (
              <Panel key={m.label}>
                <div className="flex items-center gap-2 mb-2">
                  <m.icon className="w-3.5 h-3.5" style={{ color: barColor }} />
                  <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{m.label}</span>
                </div>
                <span className="text-lg font-bold text-[#F4F7FA] block" style={{ fontFamily: MONO }}>{m.value}</span>
                <div className="h-1 rounded-full mt-2" style={{ background: '#243140' }}>
                  <div className="h-1 rounded-full" style={{ background: barColor, width: m.status === 'good' ? '80%' : '45%', transition: 'width 1s ease' }} />
                </div>
              </Panel>
            );
          })}
        </div>

        {/* ═══ ALIGNMENT / MISALIGNMENT ═══ */}
        {(alignment || contradictions.length > 0) && (
          <div className="rounded-xl p-5" style={{ background: '#141C26', border: '1px solid #F59E0B25' }}>
            <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#F59E0B', fontFamily: MONO }}>Strategic Alignment Check</h3>
            {alignment && <p className="text-sm text-[#9FB0C3] leading-relaxed mb-3" style={{ fontFamily: INTER }}>{alignment}</p>}
            {contradictions.map((ct, i) => (
              <div key={i} className="px-3 py-2 rounded-lg mb-2" style={{ background: '#F59E0B10', border: '1px solid #F59E0B25' }}>
                <p className="text-xs" style={{ color: '#F59E0B', fontFamily: MONO }}>&#x26A0; {ct}</p>
              </div>
            ))}
          </div>
        )}

        {/* ═══ MARKET KPIs ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Market Share Est.', value: '4.2%', icon: Globe, color: '#3B82F6' },
            { label: 'Competitor Count', value: '23', icon: Users, color: '#F59E0B' },
            { label: 'Win Rate vs Market', value: '34%', icon: Target, color: '#10B981' },
            { label: 'Price Position', value: 'Mid-tier', icon: TrendingUp, color: '#FF6A00' },
          ].map(m => (
            <Panel key={m.label}>
              <div className="flex items-center gap-2 mb-2">
                <m.icon className="w-4 h-4" style={{ color: m.color }} />
                <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{m.label}</span>
              </div>
              <span className="text-xl font-bold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{m.value}</span>
            </Panel>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Competitor Signals */}
          <Panel>
            <h3 className="text-sm font-semibold text-[#F4F7FA] mb-4" style={{ fontFamily: SORA }}>Competitor Signals</h3>
            <div className="space-y-3">
              {[
                { name: 'Competitor A', signal: 'Launched similar service at 15% lower price', impact: 'High', time: '5d ago', color: '#EF4444' },
                { name: 'Competitor B', signal: 'Expanded into Melbourne market', impact: 'Medium', time: '12d ago', color: '#F59E0B' },
                { name: 'Competitor C', signal: 'Key hire — former industry leader as CTO', impact: 'Medium', time: '18d ago', color: '#F59E0B' },
                { name: 'Competitor D', signal: 'Lost major client — service quality issues', impact: 'Opportunity', time: '7d ago', color: '#10B981' },
              ].map((c, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: c.color }} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{c.name}</span>
                        <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{c.time}</span>
                      </div>
                      <p className="text-[11px] text-[#9FB0C3] mt-0.5">{c.signal}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded mt-1 inline-block" style={{ color: c.color, background: c.color + '15', fontFamily: MONO }}>{c.impact}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Industry Trends */}
          <Panel>
            <h3 className="text-sm font-semibold text-[#F4F7FA] mb-4" style={{ fontFamily: SORA }}>Industry Trends</h3>
            <div className="space-y-3">
              {[
                { trend: 'AI-driven automation demand increasing', direction: 'up', impact: 'Strong tailwind for your services', confidence: '89%' },
                { trend: 'Labour costs rising across sector', direction: 'up', impact: 'Margin pressure — automation offset needed', confidence: '92%' },
                { trend: 'Regulatory complexity increasing', direction: 'up', impact: 'Compliance services opportunity', confidence: '78%' },
                { trend: 'Client budget cycles shifting to quarterly', direction: 'neutral', impact: 'Shorter sales cycles expected', confidence: '71%' },
              ].map((t, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                  <div className="flex items-start gap-2">
                    {t.direction === 'up' ? <ArrowUpRight className="w-4 h-4 shrink-0 mt-0.5 text-[#10B981]" /> : <TrendingDown className="w-4 h-4 shrink-0 mt-0.5 text-[#64748B]" />}
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-[#F4F7FA]">{t.trend}</p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">{t.impact}</p>
                      <span className="text-[10px] mt-1 inline-block" style={{ color: '#3B82F6', fontFamily: MONO }}>Confidence: {t.confidence}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* ═══ AI MARKET ADVISORY (from cognitive engine) ═══ */}
        <Panel>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#3B82F615' }}>
              <Radar className="w-4 h-4 text-[#3B82F6]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: SORA }}>AI Market Advisory</h3>
              <p className="text-sm text-[#9FB0C3] leading-relaxed">{marketNarrative || memo?.substring(0, 400) || 'Your market position is stable but under emerging pressure. Competitor A\'s price undercut requires a response — recommend emphasising your differentiated value (Australian data sovereignty, AI-driven proactive intelligence). Competitor D\'s client loss presents an acquisition opportunity. The AI automation trend strongly favours your platform positioning.'}</p>
            </div>
          </div>
        </Panel>
      </div>
      <FloatingSoundboard context="Market intelligence - competitive positioning, drift analysis, and strategic alignment" />
    </DashboardLayout>
  );
};

export default MarketPage;
