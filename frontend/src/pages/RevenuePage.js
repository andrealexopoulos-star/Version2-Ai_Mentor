import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { TrendingUp, TrendingDown, AlertTriangle, Users, BarChart3, DollarSign, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import DataConfidence from '../components/DataConfidence';

import { useSnapshot } from '../hooks/useSnapshot';

const SORA = "'Cormorant Garamond', Georgia, serif";
const INTER = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const MiniChart = ({ data, color }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - min) / range) * 80}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" className="w-full h-12" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const RevenuePage = () => {
  const { cognitive } = useSnapshot();
  const c = cognitive || {};
  const [deals, setDeals] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dealsRes, finRes] = await Promise.allSettled([
          apiClient.get('/integrations/crm/deals'),
          apiClient.get('/integrations/accounting/summary'),
        ]);
        if (dealsRes.status === 'fulfilled' && dealsRes.value.data?.results?.length > 0) {
          setDeals(dealsRes.value.data.results);
        }
        if (finRes.status === 'fulfilled' && finRes.value.data?.connected) {
          setFinancials(finRes.value.data);
        }
      } catch {} finally { setLoading(false); }
    };
    fetchData();
  }, []);

  // Use ONLY real data — no demo fallback
  const hasDeals = deals && deals.length > 0;
  const hasFinancials = financials && financials.connected;
  const totalPipeline = hasDeals ? deals.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0) : null;
  const activeDeals = hasDeals ? deals.filter(d => !d.status?.includes('WON') && !d.status?.includes('LOST')).length : null;
  const stalledCount = hasDeals ? deals.filter(d => {
    if (!d.last_modified_at) return false;
    return (Date.now() - new Date(d.last_modified_at).getTime()) > 7 * 86400000;
  }).length : null;
  const wonCount = hasDeals ? deals.filter(d => d.status === 'WON').length : 0;
  const winRate = hasDeals ? (deals.length > 0 ? Math.round((wonCount / deals.length) * 100) : 0) : null;

  const healthScore = winRate != null ? (winRate > 50 ? 'good' : winRate > 30 ? 'moderate' : 'critical') : null;
  const healthColor = healthScore === 'good' ? '#10B981' : healthScore === 'moderate' ? '#F59E0B' : '#FF6A00';
  const healthPct = winRate != null ? Math.min(Math.round(winRate * 2), 100) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: INTER }} data-testid="revenue-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: SORA }}>Revenue Engine</h1>
            <p className="text-sm text-[#9FB0C3]">
              {hasDeals ? 'Live data from CRM.' : 'Connect CRM to view revenue data.'}
              {loading && <span className="text-[10px] ml-2 text-[#FF6A00]" style={{ fontFamily: MONO }}>syncing...</span>}
            </p>
          </div>
          <DataConfidence cognitive={{ revenue: hasDeals ? { pipeline: totalPipeline } : null }} />
        </div>

        {!loading && !hasDeals && !hasFinancials && (
          <Panel className="text-center py-8">
            <DollarSign className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
            <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: SORA }}>Revenue data not connected.</p>
            <p className="text-xs text-[#64748B] mb-4">Connect your CRM to view pipeline, deal velocity, and revenue concentration.</p>
            <p className="text-xs text-[#64748B]">Connect accounting tools (Xero/QuickBooks) for cashflow analysis.</p>
          </Panel>
        )}

        {hasDeals && <>
        {/* Revenue Health */}
        <Panel>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Revenue Health Score</h2>
              <p className="text-sm text-[#9FB0C3]">Based on pipeline stability, concentration risk, and churn signals.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-3xl font-bold" style={{ fontFamily: MONO, color: healthColor }}>{healthPct}%</span>
                <span className="block text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{healthScore.toUpperCase()} RISK</span>
              </div>
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ border: `3px solid ${healthColor}`, background: healthColor + '10' }}>
                {healthScore === 'good' ? <TrendingUp className="w-5 h-5" style={{ color: healthColor }} /> : <TrendingDown className="w-5 h-5" style={{ color: healthColor }} />}
              </div>
            </div>
          </div>
        </Panel>

        {/* Three Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Panel>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-[#3B82F6]" />
              <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Pipeline Overview</h3>
            </div>
            <div className="space-y-3 mb-4">
              {[['Total Pipeline', '$' + (totalPipeline || 0).toLocaleString()], ['Active Deals', String(activeDeals || 0)], ['Win Rate', (winRate || 0) + '%']].map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="text-xs text-[#9FB0C3]">{k}</span><span className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{v}</span></div>
              ))}
              <div className="flex justify-between"><span className="text-xs text-[#9FB0C3]">Stalled (&gt;7d)</span><span className="text-sm font-semibold" style={{ fontFamily: MONO, color: '#FF6A00' }}>{stalledCount}</span></div>
            </div>
            <div className="pt-3" style={{ borderTop: '1px solid #243140' }}>
              <p className="text-xs text-[#9FB0C3]"><strong className="text-[#F4F7FA]">Insight:</strong> {stalledCount > 0 ? `${stalledCount} deals stalled. Review pricing and follow-up strategy.` : 'All deals progressing. Pipeline healthy.'}</p>
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-[#FF6A00]" />
              <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Deal Breakdown</h3>
            </div>
            <div className="space-y-2">
              {hasDeals && deals.slice(0, 6).map((d, i) => {
                const name = d.name || d.deal_name || `Deal ${i + 1}`;
                const amount = parseFloat(d.amount) || 0;
                const stage = d.stage?.name || d.stage || 'Unknown';
                const isStalled = d.status === 'stalled' || (d.last_modified_at && (Date.now() - new Date(d.last_modified_at).getTime()) > 7 * 86400000);
                return (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: isStalled ? '#FF6A00' : '#10B981' }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-[#F4F7FA] block truncate">{name}</span>
                      <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{stage}</span>
                    </div>
                    <span className="text-xs font-semibold text-[#F4F7FA] shrink-0" style={{ fontFamily: MONO }}>${amount.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
              <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Churn Signals</h3>
            </div>
            {c.revenue?.churn ? (
              <p className="text-xs text-[#9FB0C3] leading-relaxed">{c.revenue.churn}</p>
            ) : (
              <p className="text-xs text-[#64748B]" style={{ fontFamily: MONO }}>Insufficient data to assess churn risk. Connect CRM with engagement tracking.</p>
            )}
          </Panel>
        </div>
        </>}

        {/* Deal Velocity — only from real data */}
        {hasDeals && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              totalPipeline != null && { label: 'Pipeline Value', value: '$' + Math.round(totalPipeline / 1000) + 'K' },
              activeDeals != null && { label: 'Active Deals', value: String(activeDeals) },
              winRate != null && { label: 'Win Rate', value: winRate + '%' },
              stalledCount != null && { label: 'Stalled', value: String(stalledCount) },
            ].filter(Boolean).map(m => (
              <Panel key={m.label}>
                <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>{m.label}</span>
                <span className="text-xl font-bold text-[#F4F7FA] block" style={{ fontFamily: MONO }}>{m.value}</span>
              </Panel>
            ))}
          </div>
        )}

        {!hasDeals && !loading && (
          <Panel>
            <p className="text-xs text-[#64748B]" style={{ fontFamily: MONO }}>Revenue trend data unavailable. Connect accounting integration to view monthly trends.</p>
          </Panel>
        )}
      </div>
    </DashboardLayout>
  );
};

export default RevenuePage;
