import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import EnterpriseContactGate from '../components/EnterpriseContactGate';
import { TrendingUp, TrendingDown, AlertTriangle, Users, BarChart3, DollarSign, Plug, Loader2, Target, Zap, ArrowUpRight, FileWarning, Receipt } from 'lucide-react';
import DataConfidence from '../components/DataConfidence';
import { useSnapshot } from '../hooks/useSnapshot';
import { fontFamily } from '../design-system/tokens';


const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const RevenuePage = () => {
  const { cognitive } = useSnapshot();
  const c = cognitive || {};
  const [deals, setDeals] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pipeline');
  const [sqlScenarios, setSqlScenarios] = useState(null);
  const [unified, setUnified] = useState(null);
  const [signalTruth, setSignalTruth] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dealsRes, finRes, scenRes, unifiedRes, cognitionRes, signalsRes] = await Promise.allSettled([
          apiClient.get('/integrations/crm/deals'),
          apiClient.get('/integrations/accounting/summary'),
          apiClient.get('/intelligence/scenarios'),
          apiClient.get('/unified/revenue'),
          apiClient.get('/cognition/revenue'),
          apiClient.get('/integrations/merge/connected'),
        ]);
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
        // Use canonical truth for connection status
        if (signalsRes.status === 'fulfilled') {
          const truth = signalsRes.value.data?.canonical_truth;
          if (truth) {
            setSignalTruth(truth);
          }
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
  const healthColor = healthScore === 'good' ? '#10B981' : healthScore === 'moderate' ? '#F59E0B' : '#FF6A00';
  const healthPct = winRate != null ? Math.min(Math.round(winRate * 2), 100) : 0;

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Revenue Engine</h1>
            <p className="text-sm text-[#9FB0C3]">
              {hasDeals ? 'Live data from CRM.' : 'Connect CRM to view revenue data.'}
              {loading && <span className="text-[10px] ml-2 text-[#FF6A00]" style={{ fontFamily: fontFamily.mono }}>syncing...</span>}
            </p>
          </div>
          <DataConfidence cognitive={{ revenue: hasDeals ? { pipeline: totalPipeline } : null }} />
        </div>

        {!loading && !hasDeals && !hasFinancials && (
          <Panel className="py-8">
            {signalTruth?.crm_connected || signalTruth?.live_signal_count > 0 ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5" style={{ color: '#FF6A00' }} />
                  <h2 className="text-lg font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Revenue Intelligence</h2>
                </div>
                <p className="text-sm text-[#9FB0C3] mb-4">
                  {signalTruth.live_signal_count} live signals detected from your connected systems.
                  {signalTruth.last_signal_at && ` Last signal: ${new Date(signalTruth.last_signal_at).toLocaleString()}`}
                </p>
                <p className="text-sm text-[#9FB0C3] mb-2">Your SoundBoard advisor has access to all deal, invoice, and cash flow signals. Ask it directly:</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {['Show me stalled deals', 'What invoices are overdue?', 'Cash flow analysis'].map(q => (
                    <a key={q} href="/soundboard" className="px-3 py-2 rounded-lg text-xs font-medium" style={{ background: '#FF6A0010', color: '#FF6A00', border: '1px solid #FF6A0030', fontFamily: fontFamily.mono }}>{q}</a>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <DollarSign className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
                <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Revenue data not connected.</p>
                <p className="text-xs text-[#64748B] mb-4">Connect your CRM to view pipeline, deal velocity, scenario modeling, and revenue concentration.</p>
                <a href="/integrations" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#FF6A00' }} data-testid="revenue-connect-cta">
                  <Plug className="w-4 h-4" /> Connect CRM
                </a>
              </div>
            )}
          </Panel>
        )}

        {hasDeals && <>
          {/* Revenue Health */}
          <Panel>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Revenue Health Score</h2>
                <p className="text-sm text-[#9FB0C3]">Based on pipeline stability, concentration risk, and deal velocity.</p>
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
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#141C26', border: '1px solid #243140' }} data-testid="revenue-tabs">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'text-[#F4F7FA]' : 'text-[#64748B] hover:text-[#9FB0C3]'}`}
                style={{ background: activeTab === tab.id ? '#FF6A0015' : 'transparent', fontFamily: fontFamily.mono }}
                data-testid={`revenue-tab-${tab.id}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ═══ PIPELINE TAB ═══ */}
          {activeTab === 'pipeline' && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <Panel>
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-4 h-4 text-[#3B82F6]" />
                    <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Pipeline Overview</h3>
                  </div>
                  <div className="space-y-3 mb-4">
                    {[['Total Pipeline', '$' + (totalPipeline || 0).toLocaleString()], ['Active Deals', String(activeDeals || 0)], ['Win Rate', (winRate || 0) + '%'], ['Avg Deal Size', avgDealSize ? '$' + avgDealSize.toLocaleString() : '—']].map(([k, v]) => (
                      <div key={k} className="flex justify-between"><span className="text-xs text-[#9FB0C3]">{k}</span><span className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.mono }}>{v}</span></div>
                    ))}
                    <div className="flex justify-between"><span className="text-xs text-[#9FB0C3]">Stalled (&gt;7d)</span><span className="text-sm font-semibold" style={{ fontFamily: fontFamily.mono, color: stalledCount > 0 ? '#FF6A00' : '#10B981' }}>{stalledCount}</span></div>
                  </div>
                </Panel>

                <Panel>
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-4 h-4 text-[#FF6A00]" />
                    <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Deal Breakdown</h3>
                  </div>
                  <div className="space-y-2">
                    {deals.slice(0, 6).map((d, i) => {
                      const name = d.name || d.deal_name || `Deal ${i + 1}`;
                      const amount = parseFloat(d.amount) || 0;
                      const stage = d.stage?.name || d.stage || 'Unknown';
                      const isStalled = d.last_modified_at && (Date.now() - new Date(d.last_modified_at).getTime()) > 7 * 86400000;
                      return (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: isStalled ? '#FF6A00' : '#10B981' }} />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-[#F4F7FA] block truncate">{name}</span>
                            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{stage}</span>
                          </div>
                          <span className="text-xs font-semibold text-[#F4F7FA] shrink-0" style={{ fontFamily: fontFamily.mono }}>${amount.toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </Panel>

                <Panel>
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                    <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Churn Signals</h3>
                  </div>
                  {c.revenue?.churn ? (
                    <p className="text-xs text-[#9FB0C3] leading-relaxed">{c.revenue.churn}</p>
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
                    <span className="text-xl font-bold text-[#F4F7FA] block" style={{ fontFamily: fontFamily.mono }}>{m.value}</span>
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
                  <Target className="w-4 h-4 text-[#FF6A00]" />
                  <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Growth Scenario Modeling</h3>
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
                <h3 className="text-sm font-semibold text-[#F4F7FA] mb-4" style={{ fontFamily: fontFamily.display }}>Pipeline by Probability</h3>
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
                          <span className="text-xs text-[#9FB0C3]">{tier.label}</span>
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
                  <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Revenue Concentration Risk</h3>
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
                            <span className="text-xs text-[#F4F7FA]">{name}</span>
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
                  <span className="text-2xl font-bold text-[#F4F7FA]" style={{ fontFamily: fontFamily.mono }}>{sortedCompanies.length}</span>
                </Panel>
                <Panel>
                  <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Avg per Client</span>
                  <span className="text-2xl font-bold text-[#F4F7FA]" style={{ fontFamily: fontFamily.mono }}>
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
                      <Zap className="w-4 h-4 text-[#FF6A00]" />
                      <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Revenue Cognition Intelligence</h3>
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
                        <div key={label} className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
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
                    <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Risk Propagation Chains</h3>
                  </div>
                  <div className="space-y-3">
                    {unified.propagation_map.slice(0, 4).map((chain, i) => (
                      <div key={i} className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
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
                        {chain.description && <p className="text-[11px]" style={{ color: '#9FB0C3', fontFamily: fontFamily.mono }}>{chain.description}</p>}
                      </div>
                    ))}
                  </div>
                </Panel>
              )}

              {!unified?.signals && !unified?.instability_indices ? (
                <Panel className="text-center py-8">
                  <Zap className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
                  <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Cross-Domain Intelligence</p>
                  <p className="text-xs text-[#64748B]">Connect multiple integrations (CRM + Accounting) to unlock cross-domain revenue insights.</p>
                </Panel>
              ) : (
                <>
                  {/* Overdue Invoices from Accounting */}
                  {unified.signals?.overdue_invoices?.length > 0 && (
                    <Panel>
                      <div className="flex items-center gap-2 mb-4">
                        <Receipt className="w-4 h-4 text-[#EF4444]" />
                        <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Overdue Invoices</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#EF444415', color: '#EF4444', fontFamily: fontFamily.mono }}>
                          ACCOUNTING
                        </span>
                      </div>
                      <div className="space-y-2">
                        {unified.signals.overdue_invoices.map((inv, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                            <div>
                              <span className="text-xs text-[#F4F7FA]">Invoice #{inv.number}</span>
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
                        <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>At-Risk Revenue</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#F59E0B15', color: '#F59E0B', fontFamily: fontFamily.mono }}>
                          CRM
                        </span>
                      </div>
                      <div className="space-y-2">
                        {unified.signals.at_risk.map((deal, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                            <div>
                              <span className="text-xs text-[#F4F7FA]">{deal.name}</span>
                              <span className="text-[10px] text-[#F59E0B] block" style={{ fontFamily: fontFamily.mono }}>{deal.risk}</span>
                            </div>
                            <span className="text-sm font-bold text-[#F4F7FA]" style={{ fontFamily: fontFamily.mono }}>${(deal.amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  )}

                  {/* Concentration & Cash Signals Summary */}
                  {unified?.signals && <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Panel>
                      <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Pipeline Total</span>
                      <span className="text-2xl font-bold text-[#F4F7FA]" style={{ fontFamily: fontFamily.mono }}>
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
                      <span className="text-2xl font-bold" style={{ fontFamily: fontFamily.mono, color: unified.signals.stalled_deals > 0 ? '#FF6A00' : '#10B981' }}>
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
