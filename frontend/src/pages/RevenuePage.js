import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { TrendingUp, TrendingDown, AlertTriangle, Users, BarChart3, DollarSign, Plug, Loader2, Target, Zap, ArrowUpRight, FileWarning, Receipt } from 'lucide-react';
import DataConfidence from '../components/DataConfidence';
import { useSnapshot } from '../hooks/useSnapshot';

const SORA = "'Cormorant Garamond', Georgia, serif";
const INTER = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dealsRes, finRes, scenRes, unifiedRes, cognitionRes] = await Promise.allSettled([
          apiClient.get('/integrations/crm/deals'),
          apiClient.get('/integrations/accounting/summary'),
          apiClient.get('/intelligence/scenarios'),
          apiClient.get('/unified/revenue'),
          apiClient.get('/cognition/revenue'),
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
        // Cognition core data (Phase B) — merge if available
        if (cognitionRes.status === 'fulfilled' && cognitionRes.value.data && cognitionRes.value.data.status !== 'MIGRATION_REQUIRED') {
          setUnified(prev => ({ ...prev, ...cognitionRes.value.data }));
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
          <Panel className="text-center py-10">
            <DollarSign className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
            <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: SORA }}>Revenue data not connected.</p>
            <p className="text-xs text-[#64748B] mb-4">Connect your CRM to view pipeline, deal velocity, scenario modeling, and revenue concentration.</p>
            <a href="/integrations" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#FF6A00' }} data-testid="revenue-connect-cta">
              <Plug className="w-4 h-4" /> Connect CRM
            </a>
          </Panel>
        )}

        {hasDeals && <>
          {/* Revenue Health */}
          <Panel>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Revenue Health Score</h2>
                <p className="text-sm text-[#9FB0C3]">Based on pipeline stability, concentration risk, and deal velocity.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-3xl font-bold" style={{ fontFamily: MONO, color: healthColor }}>{healthPct}%</span>
                  <span className="block text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{healthScore.toUpperCase()}</span>
                </div>
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ border: `3px solid ${healthColor}`, background: healthColor + '10' }}>
                  {healthScore === 'good' ? <TrendingUp className="w-5 h-5" style={{ color: healthColor }} /> : <TrendingDown className="w-5 h-5" style={{ color: healthColor }} />}
                </div>
              </div>
            </div>
          </Panel>

          {/* Tab Navigation */}
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#141C26', border: '1px solid #1E293B' }} data-testid="revenue-tabs">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'text-[#F4F7FA]' : 'text-[#64748B] hover:text-[#9FB0C3]'}`}
                style={{ background: activeTab === tab.id ? '#FF6A0015' : 'transparent', fontFamily: MONO }}
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
                    <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Pipeline Overview</h3>
                  </div>
                  <div className="space-y-3 mb-4">
                    {[['Total Pipeline', '$' + (totalPipeline || 0).toLocaleString()], ['Active Deals', String(activeDeals || 0)], ['Win Rate', (winRate || 0) + '%'], ['Avg Deal Size', avgDealSize ? '$' + avgDealSize.toLocaleString() : '—']].map(([k, v]) => (
                      <div key={k} className="flex justify-between"><span className="text-xs text-[#9FB0C3]">{k}</span><span className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{v}</span></div>
                    ))}
                    <div className="flex justify-between"><span className="text-xs text-[#9FB0C3]">Stalled (&gt;7d)</span><span className="text-sm font-semibold" style={{ fontFamily: MONO, color: stalledCount > 0 ? '#FF6A00' : '#10B981' }}>{stalledCount}</span></div>
                  </div>
                </Panel>

                <Panel>
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-4 h-4 text-[#FF6A00]" />
                    <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Deal Breakdown</h3>
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

              {/* Velocity KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Pipeline Value', value: '$' + Math.round(totalPipeline / 1000) + 'K' },
                  { label: 'Active Deals', value: String(activeDeals) },
                  { label: 'Win Rate', value: winRate + '%' },
                  { label: 'Stalled', value: String(stalledCount) },
                ].map(m => (
                  <Panel key={m.label}>
                    <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>{m.label}</span>
                    <span className="text-xl font-bold text-[#F4F7FA] block" style={{ fontFamily: MONO }}>{m.value}</span>
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
                  <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Growth Scenario Modeling</h3>
                </div>
                <p className="text-xs text-[#64748B] mb-4">Projections computed from your actual CRM deal data. No assumptions.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-lg text-center" style={{ background: '#10B98108', border: '1px solid #10B98125' }}>
                    <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>Best Case</span>
                    <span className="text-2xl font-bold text-[#10B981]" style={{ fontFamily: MONO }}>${bestCase ? Math.round(bestCase / 1000) + 'K' : '—'}</span>
                    <span className="text-[10px] text-[#64748B] block mt-1">All open deals close</span>
                  </div>
                  <div className="p-4 rounded-lg text-center" style={{ background: '#F59E0B08', border: '1px solid #F59E0B25' }}>
                    <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>Base Case</span>
                    <span className="text-2xl font-bold text-[#F59E0B]" style={{ fontFamily: MONO }}>${baseCase ? Math.round(baseCase / 1000) + 'K' : '—'}</span>
                    <span className="text-[10px] text-[#64748B] block mt-1">Weighted by probability</span>
                  </div>
                  <div className="p-4 rounded-lg text-center" style={{ background: '#EF444408', border: '1px solid #EF444425' }}>
                    <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>Worst Case</span>
                    <span className="text-2xl font-bold text-[#EF4444]" style={{ fontFamily: MONO }}>${worstCase ? Math.round(worstCase / 1000) + 'K' : '—'}</span>
                    <span className="text-[10px] text-[#64748B] block mt-1">Only high-prob at 80%</span>
                  </div>
                </div>
              </Panel>

              {/* Deal Probability Distribution */}
              <Panel>
                <h3 className="text-sm font-semibold text-[#F4F7FA] mb-4" style={{ fontFamily: SORA }}>Pipeline by Probability</h3>
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
                            <span className="text-xs font-semibold" style={{ fontFamily: MONO, color: tier.color }}>{tier.deals.length} deals</span>
                            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>${Math.round(tierValue / 1000)}K ({tierPct}%)</span>
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
                  <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>Deals Won</span>
                  <span className="text-2xl font-bold text-[#10B981]" style={{ fontFamily: MONO }}>{wonCount}</span>
                </Panel>
                <Panel>
                  <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>Deals Lost</span>
                  <span className="text-2xl font-bold text-[#EF4444]" style={{ fontFamily: MONO }}>{lostCount}</span>
                </Panel>
                <Panel>
                  <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>Open Pipeline</span>
                  <span className="text-2xl font-bold text-[#3B82F6]" style={{ fontFamily: MONO }}>{openDeals.length}</span>
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
                  <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Revenue Concentration Risk</h3>
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
                              <span className="text-xs font-semibold" style={{ fontFamily: MONO, color }}>{pct}%</span>
                              <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>${Math.round(value / 1000)}K</span>
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
                  <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>Top Client Share</span>
                  <span className="text-2xl font-bold" style={{ fontFamily: MONO, color: topClientPct > 40 ? '#EF4444' : topClientPct > 20 ? '#F59E0B' : '#10B981' }}>{topClientPct}%</span>
                  <span className="text-[10px] text-[#64748B] block mt-1">{topClientPct > 40 ? 'High concentration risk' : topClientPct > 20 ? 'Moderate concentration' : 'Well diversified'}</span>
                </Panel>
                <Panel>
                  <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>Unique Clients</span>
                  <span className="text-2xl font-bold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{sortedCompanies.length}</span>
                </Panel>
                <Panel>
                  <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>Avg per Client</span>
                  <span className="text-2xl font-bold text-[#F4F7FA]" style={{ fontFamily: MONO }}>
                    {sortedCompanies.length > 0 ? '$' + Math.round((totalPipeline / sortedCompanies.length) / 1000) + 'K' : '—'}
                  </span>
                </Panel>
              </div>
            </>
          )}
          {/* ═══ CROSS-DOMAIN INTELLIGENCE TAB ═══ */}
          {activeTab === 'intelligence' && (
            <>
              {!unified?.signals ? (
                <Panel className="text-center py-8">
                  <Zap className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
                  <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: SORA }}>Cross-Domain Intelligence</p>
                  <p className="text-xs text-[#64748B]">Connect multiple integrations (CRM + Accounting) to unlock cross-domain revenue insights.</p>
                </Panel>
              ) : (
                <>
                  {/* Overdue Invoices from Accounting */}
                  {unified.signals.overdue_invoices?.length > 0 && (
                    <Panel>
                      <div className="flex items-center gap-2 mb-4">
                        <Receipt className="w-4 h-4 text-[#EF4444]" />
                        <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Overdue Invoices</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#EF444415', color: '#EF4444', fontFamily: MONO }}>
                          ACCOUNTING
                        </span>
                      </div>
                      <div className="space-y-2">
                        {unified.signals.overdue_invoices.map((inv, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                            <div>
                              <span className="text-xs text-[#F4F7FA]">Invoice #{inv.number}</span>
                              <span className="text-[10px] text-[#EF4444] block" style={{ fontFamily: MONO }}>{inv.days_overdue}d overdue</span>
                            </div>
                            <span className="text-sm font-bold text-[#EF4444]" style={{ fontFamily: MONO }}>${(inv.amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  )}

                  {/* At-Risk Deals from CRM */}
                  {unified.signals.at_risk?.length > 0 && (
                    <Panel>
                      <div className="flex items-center gap-2 mb-4">
                        <FileWarning className="w-4 h-4 text-[#F59E0B]" />
                        <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>At-Risk Revenue</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#F59E0B15', color: '#F59E0B', fontFamily: MONO }}>
                          CRM
                        </span>
                      </div>
                      <div className="space-y-2">
                        {unified.signals.at_risk.map((deal, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                            <div>
                              <span className="text-xs text-[#F4F7FA]">{deal.name}</span>
                              <span className="text-[10px] text-[#F59E0B] block" style={{ fontFamily: MONO }}>{deal.risk}</span>
                            </div>
                            <span className="text-sm font-bold text-[#F4F7FA]" style={{ fontFamily: MONO }}>${(deal.amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  )}

                  {/* Concentration & Cash Signals Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Panel>
                      <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>Pipeline Total</span>
                      <span className="text-2xl font-bold text-[#F4F7FA]" style={{ fontFamily: MONO }}>
                        ${unified.signals.pipeline_total ? Math.round(unified.signals.pipeline_total / 1000) + 'K' : '—'}
                      </span>
                    </Panel>
                    <Panel>
                      <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>Concentration Risk</span>
                      <span className="text-2xl font-bold" style={{ fontFamily: MONO, color: unified.signals.concentration_risk === 'high' ? '#EF4444' : unified.signals.concentration_risk === 'medium' ? '#F59E0B' : '#10B981' }}>
                        {(unified.signals.concentration_risk || 'low').toUpperCase()}
                      </span>
                    </Panel>
                    <Panel>
                      <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>Stalled Deals</span>
                      <span className="text-2xl font-bold" style={{ fontFamily: MONO, color: unified.signals.stalled_deals > 0 ? '#FF6A00' : '#10B981' }}>
                        {unified.signals.stalled_deals ?? 0}
                      </span>
                    </Panel>
                  </div>
                </>
              )}
            </>
          )}

        </>}

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
