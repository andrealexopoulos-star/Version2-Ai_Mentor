import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useSnapshot } from '../hooks/useSnapshot';
import { apiClient } from '../lib/api';
import { CognitiveMesh } from '../components/LoadingSystems';
import DataConfidence from '../components/DataConfidence';
import { AlertTriangle, Shield, DollarSign, TrendingDown, CheckCircle2, Users, UserX, Clock, Plug, Activity, Heart } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const RiskMeter = ({ value, label, thresholds = [30, 60] }) => {
  const color = value > thresholds[1] ? '#EF4444' : value > thresholds[0] ? '#F59E0B' : '#10B981';
  return (
    <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
      <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>{label}</span>
      <div className="flex items-end gap-2">
        <span className="text-xl font-bold" style={{ color, fontFamily: fontFamily.mono }}>{value != null ? value : '—'}{value != null ? '%' : ''}</span>
      </div>
      {value != null && (
        <div className="h-1.5 rounded-full mt-2" style={{ background: color + '20' }}>
          <div className="h-1.5 rounded-full transition-all" style={{ background: color, width: Math.min(value, 100) + '%' }} />
        </div>
      )}
    </div>
  );
};

const RiskPage = () => {
  const { cognitive, loading } = useSnapshot();
  const c = cognitive || {};
  const risk = c.risk || {};
  const cap = c.capital || {};
  const exec = c.execution || {};
  const alignment = c.alignment || {};
  const fv = c.founder_vitals || {};

  const [integrations, setIntegrations] = useState([]);
  const [activeTab, setActiveTab] = useState('governance');
  const [sqlWorkforce, setSqlWorkforce] = useState(null);
  const [sqlScores, setSqlScores] = useState(null);
  const [unifiedRisk, setUnifiedRisk] = useState(null);

  useEffect(() => {
    // Fetch integration status from both Merge and workspace_integrations
    apiClient.get('/integrations/merge/connected').then(res => {
      if (res.data?.integrations) {
        const names = Object.entries(res.data.integrations).filter(([, v]) => v).map(([k]) => k.toLowerCase());
        setIntegrations(names);
      }
    }).catch(() => {});

    // Fetch SQL-backed workforce health
    apiClient.get('/intelligence/workforce').then(res => {
      if (res.data?.has_data) setSqlWorkforce(res.data);
    }).catch(() => {});

    // Fetch weighted insight scores
    apiClient.get('/intelligence/scores').then(res => {
      if (res.data?.scores) setSqlScores(res.data.scores);
    }).catch(() => {});

    // Fetch unified risk intelligence
    apiClient.get('/unified/risk').then(res => {
      if (res.data) setUnifiedRisk(res.data);
    }).catch(() => {});

    // Cognition core data (Phase B)
    apiClient.get('/cognition/risk').then(res => {
      if (res.data && res.data.status !== 'MIGRATION_REQUIRED') {
        setUnifiedRisk(prev => ({ ...prev, ...res.data }));
      }
    }).catch(() => {});
  }, []);

  const hasCRM = integrations.some(i => i.includes('crm') || i.includes('hubspot'));
  const hasAccounting = integrations.some(i => i.includes('accounting') || i.includes('xero'));
  const hasEmail = integrations.some(i => i.includes('email') || i.includes('gmail') || i.includes('outlook'));
  const hasAnyIntegration = integrations.length > 0;

  const spofs = risk.spof || [];
  const regulatory = risk.regulatory || [];
  const concentration = risk.concentration || '';
  const runway = hasAccounting ? cap.runway : null;
  const slaBreaches = hasCRM ? exec.sla_breaches : null;
  const contradictions = alignment.contradictions || [];

  const hasRiskData = runway != null || slaBreaches != null || spofs.length > 0 || concentration;
  const hasPeopleData = hasEmail && (fv.capacity_index != null || fv.fatigue || fv.recommendation);

  const TABS = [
    { id: 'governance', label: 'Risk & Governance', icon: Shield },
    { id: 'workforce', label: 'Workforce Intelligence', icon: Users },
    { id: 'unified', label: 'Cross-Domain Risk', icon: Activity },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: fontFamily.body }} data-testid="risk-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Risk & Workforce Intelligence</h1>
            <p className="text-sm text-[#9FB0C3]">
              {hasAnyIntegration ? 'Signals from connected data sources.' : 'Connect integrations to assess risk and workforce health.'}
            </p>
          </div>
          <DataConfidence cognitive={cognitive} />
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#141C26', border: '1px solid #1E293B' }} data-testid="risk-tabs">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id ? 'text-[#F4F7FA]' : 'text-[#64748B] hover:text-[#9FB0C3]'}`}
              style={{ background: activeTab === tab.id ? '#FF6A0015' : 'transparent', fontFamily: fontFamily.mono }}
              data-testid={`risk-tab-${tab.id}`}>
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {loading && <CognitiveMesh message="Scanning risk signals..." />}

        {/* ═══ GOVERNANCE TAB ═══ */}
        {!loading && activeTab === 'governance' && (
          <>
            {!hasAnyIntegration && (
              <Panel className="text-center py-10">
                <Shield className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
                <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Connect integrations to assess risk.</p>
                <p className="text-xs text-[#64748B] mb-4">CRM, accounting, and email integrations enable risk detection, SPOF analysis, and governance monitoring.</p>
                <a href="/integrations" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#FF6A00' }} data-testid="risk-connect-cta">
                  <Plug className="w-4 h-4" /> Connect Integrations
                </a>
              </Panel>
            )}

            {hasAnyIntegration && !hasRiskData && (
              <Panel className="text-center py-8">
                <CheckCircle2 className="w-8 h-8 text-[#10B981] mx-auto mb-3" />
                <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>No risk signals detected.</p>
                <p className="text-xs text-[#64748B]">Your connected integrations show no active risk indicators.</p>
              </Panel>
            )}

            {hasRiskData && (
              <>
                {/* Financial Risk */}
                {(runway != null || concentration) && (
                  <Panel>
                    <div className="flex items-center gap-2 mb-4">
                      <DollarSign className="w-4 h-4 text-[#FF6A00]" />
                      <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Financial Risk</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {runway != null && (
                        <RiskMeter value={runway < 3 ? 90 : runway < 6 ? 60 : runway < 12 ? 30 : 10} label={`Cash Runway: ${runway}mo`} />
                      )}
                      {concentration && (
                        <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                          <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Revenue Concentration</span>
                          <p className="text-xs text-[#9FB0C3]">{concentration}</p>
                        </div>
                      )}
                      {cap.margin && (
                        <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                          <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Margin</span>
                          <p className="text-xs text-[#9FB0C3]">{cap.margin}</p>
                        </div>
                      )}
                    </div>
                  </Panel>
                )}

                {!hasAccounting && (
                  <Panel>
                    <p className="text-xs text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Connect accounting integration to assess cash runway, margin, and cost structure.</p>
                  </Panel>
                )}

                {/* Operational Risk */}
                {slaBreaches != null && (
                  <Panel>
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-4 h-4" style={{ color: slaBreaches > 0 ? '#F59E0B' : '#10B981' }} />
                      <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Operational Risk</h3>
                    </div>
                    <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                      <p className="text-xs font-semibold text-[#F4F7FA]">SLA Breaches: {slaBreaches}</p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">{slaBreaches === 0 ? 'No breaches detected.' : `${slaBreaches} breach${slaBreaches > 1 ? 'es' : ''} detected.`}</p>
                    </div>
                  </Panel>
                )}

                {/* SPOFs */}
                {spofs.length > 0 && (
                  <Panel>
                    <div className="flex items-center gap-2 mb-4">
                      <UserX className="w-4 h-4 text-[#EF4444]" />
                      <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Single Points of Failure</h3>
                    </div>
                    <div className="space-y-2">
                      {spofs.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 p-3 rounded-lg" style={{ background: '#EF444408', border: '1px solid #EF444425' }}>
                          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#EF4444' }} />
                          <p className="text-xs text-[#9FB0C3]">{s}</p>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}

                {/* Contradictions */}
                {contradictions.length > 0 && (
                  <Panel>
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingDown className="w-4 h-4 text-[#F59E0B]" />
                      <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Alignment Issues</h3>
                    </div>
                    <div className="space-y-2">
                      {contradictions.map((ct, i) => (
                        <div key={i} className="px-3 py-2 rounded-lg" style={{ background: '#F59E0B08', border: '1px solid #F59E0B25' }}>
                          <p className="text-xs" style={{ color: '#F59E0B' }}>{ct}</p>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}
              </>
            )}
          </>
        )}

        {/* ═══ WORKFORCE INTELLIGENCE TAB ═══ */}
        {!loading && activeTab === 'workforce' && (
          <>
            {!hasEmail && (
              <Panel className="text-center py-10">
                <Users className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
                <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Connect email and calendar to unlock workforce intelligence.</p>
                <p className="text-xs text-[#64748B] mb-4 max-w-md mx-auto">
                  Workforce intelligence requires email and calendar data to assess capacity, fatigue, communication patterns, and key-person dependency risk.
                </p>
                <a href="/integrations" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#EF4444' }} data-testid="workforce-connect-cta">
                  <Plug className="w-4 h-4" /> Connect Email & Calendar
                </a>
              </Panel>
            )}

            {hasEmail && !hasPeopleData && (
              <Panel className="text-center py-8">
                <Activity className="w-8 h-8 text-[#10B981] mx-auto mb-3" />
                <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Processing workforce signals.</p>
                <p className="text-xs text-[#64748B]">BIQc is analysing communication patterns, calendar density, and workload distribution. Check back shortly.</p>
              </Panel>
            )}

            {hasPeopleData && (
              <>
                {/* Capacity & Fatigue Dashboard */}
                <Panel>
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-[#3B82F6]" />
                    <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Capacity & Fatigue</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <RiskMeter value={fv.capacity_index} label="Capacity Utilisation" thresholds={[80, 100]} />
                    <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                      <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Fatigue Level</span>
                      <span className="text-xl font-bold" style={{ color: fv.fatigue === 'high' ? '#EF4444' : fv.fatigue === 'medium' ? '#F59E0B' : '#10B981', fontFamily: fontFamily.mono }}>
                        {fv.fatigue || '—'}
                      </span>
                    </div>
                    {fv.decisions != null && (
                      <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                        <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Pending Decisions</span>
                        <span className="text-xl font-bold" style={{ color: fv.decisions > 5 ? '#F59E0B' : '#10B981', fontFamily: fontFamily.mono }}>{fv.decisions}</span>
                      </div>
                    )}
                  </div>
                </Panel>

                {/* Communication Health */}
                {(fv.calendar || fv.email_stress) && (
                  <Panel>
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="w-4 h-4 text-[#7C3AED]" />
                      <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Communication Health</h3>
                    </div>
                    <div className="space-y-3">
                      {fv.calendar && (
                        <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                          <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Calendar Density</span>
                          <p className="text-xs text-[#9FB0C3]">{fv.calendar}</p>
                        </div>
                      )}
                      {fv.email_stress && (
                        <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                          <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Email Stress</span>
                          <p className="text-xs text-[#9FB0C3]">{fv.email_stress}</p>
                        </div>
                      )}
                    </div>
                  </Panel>
                )}

                {/* Recommendation */}
                {fv.recommendation && (
                  <Panel>
                    <div className="flex items-start gap-3">
                      <Heart className="w-4 h-4 text-[#FF6A00] shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Workforce Advisory</h3>
                        <p className="text-xs text-[#9FB0C3] leading-relaxed">{fv.recommendation}</p>
                      </div>
                    </div>
                  </Panel>
                )}

                {/* Key-Person Dependency */}
                {spofs.length > 0 && (
                  <Panel>
                    <div className="flex items-center gap-2 mb-4">
                      <UserX className="w-4 h-4 text-[#EF4444]" />
                      <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Key-Person Dependency Risk</h3>
                    </div>
                    <p className="text-xs text-[#9FB0C3] mb-3">These roles or individuals represent single points of failure in your organisation.</p>
                    <div className="space-y-2">
                      {spofs.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 p-3 rounded-lg" style={{ background: '#EF444408', border: '1px solid #EF444425' }}>
                          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#EF4444' }} />
                          <p className="text-xs text-[#9FB0C3]">{s}</p>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}
              </>
            )}
          </>
        )}

        {/* ═══ CROSS-DOMAIN RISK TAB ═══ */}
        {!loading && activeTab === 'unified' && (
          <>
            {/* Cognition Risk Intelligence — shows when SQL deployed */}
            {unifiedRisk?.instability_indices && (
              <Panel>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#EF4444]" />
                    <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Instability Intelligence</h3>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: '#10B98115', color: '#10B981', fontFamily: fontFamily.mono }}>COGNITION CORE</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { key: 'revenue_volatility_index', label: 'RVI', title: 'Revenue Volatility', help: 'Measures unpredictability in revenue streams' },
                    { key: 'engagement_decay_score', label: 'EDS', title: 'Engagement Decay', help: 'Rate of customer/lead disengagement' },
                    { key: 'cash_deviation_ratio', label: 'CDR', title: 'Cash Deviation', help: 'Divergence from expected cash position' },
                    { key: 'anomaly_density_score', label: 'ADS', title: 'Anomaly Density', help: 'Frequency of anomalous signals' },
                  ].map(({ key, label, title, help }) => {
                    const val = unifiedRisk.instability_indices[key];
                    if (val == null) return null;
                    const pct = Math.round(val * 100);
                    const ic = pct > 60 ? '#EF4444' : pct > 30 ? '#F59E0B' : '#10B981';
                    const circumference2 = 2 * Math.PI * 18;
                    const off2 = circumference2 * (1 - pct / 100);
                    return (
                      <div key={key} className="p-4 rounded-lg text-center" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                        <div className="relative w-12 h-12 mx-auto mb-2">
                          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 40 40">
                            <circle cx="20" cy="20" r="18" fill="none" stroke="#243140" strokeWidth="3.5" />
                            <circle cx="20" cy="20" r="18" fill="none" stroke={ic} strokeWidth="3.5"
                              strokeDasharray={circumference2} strokeDashoffset={off2} strokeLinecap="round" />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] font-bold" style={{ color: ic, fontFamily: fontFamily.mono }}>{pct}%</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: ic, fontFamily: fontFamily.mono }}>{label}</span>
                        <p className="text-[9px] mt-0.5" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{title}</p>
                      </div>
                    );
                  }).filter(Boolean)}
                </div>
                {unifiedRisk.composite_risk_score != null && (
                  <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                    <span className="text-xs" style={{ color: '#9FB0C3', fontFamily: fontFamily.display }}>Composite Risk Score</span>
                    <span className="text-2xl font-bold" style={{ 
                      color: unifiedRisk.composite_risk_score > 0.6 ? '#EF4444' : unifiedRisk.composite_risk_score > 0.3 ? '#F59E0B' : '#10B981', 
                      fontFamily: fontFamily.mono 
                    }}>{Math.round(unifiedRisk.composite_risk_score * 100)}%</span>
                  </div>
                )}
              </Panel>
            )}

            {/* Propagation Risk Chains */}
            {unifiedRisk?.propagation_map?.length > 0 && (
              <Panel>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                  <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Risk Propagation Analysis</h3>
                </div>
                <div className="space-y-3">
                  {unifiedRisk.propagation_map.slice(0, 5).map((chain, i) => (
                    <div key={i} className="p-3 rounded-lg" style={{ background: '#F59E0B08', border: '1px solid #F59E0B25' }}>
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        {(chain.chain || [chain.source, chain.target]).filter(Boolean).map((node, ni, arr) => (
                          <React.Fragment key={ni}>
                            <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: '#EF444415', color: '#EF4444', fontFamily: fontFamily.mono }}>{node}</span>
                            {ni < arr.length - 1 && <span className="text-[10px] text-[#64748B]">→</span>}
                          </React.Fragment>
                        ))}
                        {chain.probability != null && (
                          <span className="text-[9px] ml-auto" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>{Math.round(chain.probability * 100)}% likelihood</span>
                        )}
                      </div>
                      {chain.description && <p className="text-[11px]" style={{ color: '#9FB0C3' }}>{chain.description}</p>}
                      {chain.window && <p className="text-[9px] mt-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Time window: {chain.window}</p>}
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {!unifiedRisk?.signals && !unifiedRisk?.instability_indices ? (
              <Panel className="text-center py-10">
                <Activity className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
                <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Cross-Domain Risk Intelligence</p>
                <p className="text-xs text-[#64748B] mb-4">Connect CRM, accounting, and email integrations to unlock holistic risk analysis across all data sources.</p>
                <a href="/integrations" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#FF6A00' }} data-testid="unified-risk-connect-cta">
                  <Plug className="w-4 h-4" /> Connect Integrations
                </a>
              </Panel>
            ) : unifiedRisk?.signals ? (
              <>
                {/* Overall Risk Level */}
                <Panel>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Overall Risk Assessment</h3>
                      <p className="text-xs text-[#64748B] mt-1">Aggregated from all connected integrations</p>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-bold" style={{ 
                        fontFamily: fontFamily.mono, 
                        color: unifiedRisk.signals.overall_risk === 'high' ? '#EF4444' : unifiedRisk.signals.overall_risk === 'medium' ? '#F59E0B' : '#10B981' 
                      }}>
                        {(unifiedRisk.signals.overall_risk || 'LOW').toUpperCase()}
                      </span>
                    </div>
                  </div>
                </Panel>

                {/* Risk Categories */}
                {['financial_risks', 'operational_risks', 'people_risks', 'market_risks'].map(category => {
                  const items = unifiedRisk.signals[category] || [];
                  if (items.length === 0) return null;
                  const label = category.replace('_risks', '').replace('_', ' ');
                  const icon = category === 'financial_risks' ? DollarSign : category === 'operational_risks' ? AlertTriangle : category === 'people_risks' ? Users : Shield;
                  const Icon = icon;
                  return (
                    <Panel key={category}>
                      <div className="flex items-center gap-2 mb-4">
                        <Icon className="w-4 h-4 text-[#FF6A00]" />
                        <h3 className="text-sm font-semibold text-[#F4F7FA] capitalize" style={{ fontFamily: fontFamily.display }}>{label} Risk</h3>
                      </div>
                      <div className="space-y-2">
                        {items.map((item, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ 
                            background: item.severity === 'high' ? '#EF444408' : '#F59E0B08', 
                            border: `1px solid ${item.severity === 'high' ? '#EF444425' : '#F59E0B25'}` 
                          }}>
                            <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: item.severity === 'high' ? '#EF4444' : '#F59E0B' }} />
                            <div className="flex-1">
                              <p className="text-xs text-[#9FB0C3]">{item.detail}</p>
                              <span className="text-[10px] text-[#64748B] mt-1 block" style={{ fontFamily: fontFamily.mono }}>Source: {item.source}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  );
                })}
              </>
            ) : null}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default RiskPage;
