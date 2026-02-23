import React, { useState, useMemo } from 'react';
import { useSnapshot } from '../hooks/useSnapshot';
import DashboardLayout from '../components/DashboardLayout';
import { CheckInAlerts } from '../components/CheckInAlerts';
import { CognitiveLoadingScreen } from '../components/CognitiveLoadingScreen';
import { Mail, MessageSquare, Users, XCircle, ChevronDown, ChevronUp, DollarSign, TrendingUp, Settings as SettingsIcon, User, Radar, RefreshCw } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";
const BODY = "'Inter', sans-serif";

/* ═══ ACTION BUTTONS ═══ */
const ActionBtn = ({ icon: Icon, label, color }) => (
  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:-translate-y-0.5 active:scale-95" style={{ background: `${color}15`, color, border: `1px solid ${color}30`, fontFamily: MONO }} data-testid={`action-${label.toLowerCase().replace(/\s/g,'-')}`}>
    <Icon className="w-3.5 h-3.5" />{label}
  </button>
);
const ActionBar = ({ actions }) => {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {actions.includes("auto-email") && <ActionBtn icon={Mail} label="Auto-Email" color="#2563EB" />}
      {actions.includes("quick-sms") && <ActionBtn icon={MessageSquare} label="Quick-SMS" color="#059669" />}
      {actions.includes("hand-off") && <ActionBtn icon={Users} label="Hand Off" color="#F97316" />}
      {actions.includes("dismiss") && <ActionBtn icon={XCircle} label="Dismiss & Learn" color="#6B7280" />}
    </div>
  );
};

const GROUPS = {
  money: { id: 'money', label: 'Money', icon: DollarSign, color: '#F97316', description: 'Cash, invoices, margins, runway, spend' },
  revenue: { id: 'revenue', label: 'Revenue', icon: TrendingUp, color: '#2563EB', description: 'Pipeline, deals, leads, churn, pricing' },
  operations: { id: 'operations', label: 'Operations', icon: SettingsIcon, color: '#059669', description: 'Tasks, SOPs, bottlenecks, delivery' },
  people: { id: 'people', label: 'People', icon: User, color: '#EF4444', description: 'Capacity, calendar, decisions, burnout' },
  market: { id: 'market', label: 'Market', icon: Radar, color: '#7C3AED', description: 'Competitors, positioning, trends, regulatory' },
};

const ST = { STABLE: { c: '#10B981', bg: '#10B98108', b: '#10B98125', d: '#10B981' }, DRIFT: { c: '#F59E0B', bg: '#F59E0B08', b: '#F59E0B25', d: '#F59E0B' }, COMPRESSION: { c: '#FF6A00', bg: '#FF6A0008', b: '#FF6A0025', d: '#FF6A00' }, CRITICAL: { c: '#EF4444', bg: '#EF444408', b: '#EF444425', d: '#EF4444' } };
const SEV = { high: { bg: '#EF444410', b: '#EF444425', d: '#EF4444' }, medium: { bg: '#F59E0B10', b: '#F59E0B25', d: '#F59E0B' }, low: { bg: '#10B98110', b: '#10B98125', d: '#10B981' } };

const Card = ({ children, className = '' }) => (<div className={`rounded-2xl ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>);

// Parse cognitive data into group structure
function parseToGroups(c) {
  const groups = { money: { alerts: 0, severity: 'low', resolutions: [], insight: '' }, revenue: { alerts: 0, severity: 'low', resolutions: [], insight: '' }, operations: { alerts: 0, severity: 'low', resolutions: [], insight: '' }, people: { alerts: 0, severity: 'low', resolutions: [], insight: '' }, market: { alerts: 0, severity: 'low', resolutions: [], insight: '' } };
  if (!c) return groups;

  // Map resolution_queue items to groups
  const rq = c.resolution_queue || [];
  for (const item of rq) {
    const t = item.type || '';
    let g = 'operations';
    if (t.includes('payment') || t.includes('invoice') || t.includes('cash') || t.includes('budget')) g = 'money';
    else if (t.includes('deal') || t.includes('lead') || t.includes('churn') || t.includes('revenue') || t.includes('pipeline')) g = 'revenue';
    else if (t.includes('sop') || t.includes('task') || t.includes('overtime') || t.includes('breach')) g = 'operations';
    else if (t.includes('capacity') || t.includes('burnout') || t.includes('fatigue') || t.includes('team')) g = 'people';
    else if (t.includes('competitor') || t.includes('market') || t.includes('regulatory') || t.includes('compliance')) g = 'market';
    groups[g].resolutions.push(item);
    groups[g].alerts++;
    if (item.severity === 'high') groups[g].severity = 'high';
    else if (item.severity === 'medium' && groups[g].severity !== 'high') groups[g].severity = 'medium';
  }

  // Map inevitabilities to groups
  const inv = c.inevitabilities || [];
  for (const item of inv) {
    const d = (item.domain || '').toLowerCase();
    let g = 'operations';
    if (d.includes('financ') || d.includes('money') || d.includes('cash')) g = 'money';
    else if (d.includes('revenue') || d.includes('sales') || d.includes('pipeline')) g = 'revenue';
    else if (d.includes('operation') || d.includes('execution')) g = 'operations';
    else if (d.includes('people') || d.includes('team') || d.includes('founder')) g = 'people';
    else if (d.includes('market') || d.includes('compet') || d.includes('strategic')) g = 'market';
    groups[g].resolutions.push({ severity: 'medium', title: item.signal || item.domain, detail: item.if_ignored || '', actions: ["hand-off", "dismiss"] });
    groups[g].alerts++;
    if (!groups[g].insight) groups[g].insight = item.signal;
  }

  // Set insights from various fields
  if (c.capital || c.cash_runway_months) groups.money.insight = groups.money.insight || (c.capital?.alert || c.executive_memo?.substring(0, 200) || 'Review financial position.');
  if (c.revenue || c.pipeline_total) groups.revenue.insight = groups.revenue.insight || (c.revenue?.churn || 'Review revenue pipeline.');
  if (c.execution || c.sla_breaches) groups.operations.insight = groups.operations.insight || (c.execution?.bottleneck || 'Review operational execution.');
  if (c.founder_vitals || c.capacity_index) groups.people.insight = groups.people.insight || 'Review founder capacity and workload.';
  groups.market.insight = groups.market.insight || c.market_position || c.market?.narrative || 'No urgent market signals.';

  // Use executive memo as fallback insight for the top group
  const topGroup = Object.entries(groups).sort((a, b) => b[1].alerts - a[1].alerts)[0];
  if (!topGroup[1].insight && c.executive_memo) topGroup[1].insight = c.executive_memo.substring(0, 300);

  // Use priority compression
  const pc = c.priority_compression || c.priority || {};
  if (pc.primary_focus || pc.primary) {
    const mainGroup = Object.entries(groups).sort((a, b) => b[1].alerts - a[1].alerts)[0];
    if (!mainGroup[1].insight) mainGroup[1].insight = pc.primary_focus || pc.primary;
  }

  return groups;
}

const AdvisorWatchtower = () => {
  const { cognitive, sources, owner, timeOfDay, loading, error, cacheAge, refreshing, refresh } = useSnapshot();
  const c = cognitive || {};

  // Parse system state (handle both string and object formats)
  const stateStatus = typeof c.system_state === 'object' ? c.system_state?.status : c.system_state;
  const stateConf = typeof c.system_state === 'object' ? c.system_state?.confidence : c.confidence_level;
  const stateInterp = typeof c.system_state === 'object' ? c.system_state?.interpretation : c.system_state_interpretation;
  const stateVelocity = typeof c.system_state === 'object' ? c.system_state?.velocity : null;
  const st = ST[stateStatus] || ST.STABLE;

  const groupData = useMemo(() => parseToGroups(c), [c]);
  const sortedGroups = useMemo(() => Object.values(GROUPS).sort((a, b) => {
    const sevW = { high: 3, medium: 2, low: 1 };
    return (groupData[b.id].alerts * (sevW[groupData[b.id].severity] || 1)) - (groupData[a.id].alerts * (sevW[groupData[a.id].severity] || 1));
  }), [groupData]);

  const [activeGroup, setActiveGroup] = useState(null);
  const activeId = activeGroup || sortedGroups[0]?.id || 'money';
  const gd = groupData[activeId];
  const group = GROUPS[activeId];

  const [briefOpen, setBriefOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);

  const memo = c.executive_memo || c.memo || '';
  const alignment = c.strategic_alignment_check || c.alignment?.narrative || '';
  const contradictions = c.alignment?.contradictions || [];
  const wb = c.weekly_brief || {};

  return (
    <DashboardLayout>
      <div className="min-h-[calc(100vh-56px)]" style={{ background: '#0F1720', fontFamily: HEAD }} data-testid="biqc-insights-page">

        {/* LOADING — Animated cognitive screen */}
        {loading && (
          <CognitiveLoadingScreen
            mode={cacheAge === null ? 'first' : 'returning'}
            ownerName={owner}
          />
        )}

        {/* ERROR */}
        {error && !loading && !cognitive && (
          <div className="max-w-3xl mx-auto px-6 py-16 text-center">
            <p className="text-sm" style={{ color: '#FF6A00' }}>{error}</p>
            <button onClick={refresh} className="text-xs font-medium mt-4 px-4 py-1.5 rounded-lg" style={{ color: '#9FB0C3', border: '1px solid #243140' }}>Retry</button>
          </div>
        )}

        {/* MAIN CONTENT */}
        {!loading && cognitive && (
          <>
            {/* STICKY HEADER */}
            <div className="sticky top-14 z-30" style={{ background: st.bg, borderBottom: `1px solid ${st.b}` }}>
              <div className="max-w-5xl mx-auto px-6 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: st.d }} />
                  <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: st.c, fontFamily: MONO }}>{stateStatus || 'STABLE'}</span>
                  {stateVelocity && <span className="text-[11px]" style={{ color: st.c }}>{stateVelocity === 'worsening' ? '↘' : stateVelocity === 'improving' ? '↗' : '→'} {stateVelocity}</span>}
                  {stateConf && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: st.c, background: `${st.c}15`, fontFamily: MONO }}>{typeof stateConf === 'number' ? `${stateConf}%` : stateConf}</span>}
                </div>
                <button onClick={refresh} disabled={refreshing} className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg hover:bg-black/5" style={{ color: '#9CA3AF' }} data-testid="refresh-btn">
                  <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {stateInterp && <div className="max-w-5xl mx-auto px-6 pb-2"><p className="text-[12px]" style={{ color: st.c, fontFamily: BODY }}>{stateInterp}</p></div>}
            </div>

            <div className="max-w-5xl mx-auto px-6 py-8">
              <h1 className="text-3xl font-semibold mb-6" style={{ color: '#111827', fontFamily: HEAD }}>
                Good {timeOfDay || 'morning'}, {owner || 'there'}.
              </h1>

              {/* CHECK-IN ALERTS */}
              <CheckInAlerts />

              {/* 5 COGNITION TABS */}
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2" data-testid="cognition-tabs">
                {sortedGroups.map((g) => {
                  const d = groupData[g.id];
                  const isActive = activeId === g.id;
                  const Icon = g.icon;
                  return (
                    <button key={g.id} onClick={() => setActiveGroup(g.id)}
                      className="flex items-center gap-2.5 px-4 py-3 rounded-xl transition-all shrink-0"
                      style={{ background: isActive ? g.color : 'white', color: isActive ? 'white' : '#374151', border: `1.5px solid ${isActive ? g.color : 'rgba(0,0,0,0.08)'}`, boxShadow: isActive ? `0 4px 16px ${g.color}30` : '0 1px 3px rgba(0,0,0,0.04)', fontFamily: HEAD }}
                      data-testid={`tab-${g.id}`}>
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-semibold">{g.label}</span>
                      {d.alerts > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: isActive ? 'rgba(255,255,255,0.25)' : SEV[d.severity].bg, color: isActive ? 'white' : SEV[d.severity].d, fontFamily: MONO }}>{d.alerts}</span>}
                    </button>
                  );
                })}
              </div>

              {/* ACTIVE GROUP */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${group.color}15` }}>
                    <group.icon className="w-4 h-4" style={{ color: group.color }} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: '#111827', fontFamily: HEAD }}>{group.label}</h2>
                    <p className="text-xs" style={{ color: '#9CA3AF', fontFamily: MONO }}>{group.description}</p>
                  </div>
                </div>

                {/* AI Insight */}
                {gd.insight && <Card className="p-5"><p className="text-sm leading-relaxed" style={{ color: '#374151', fontFamily: BODY }}>{gd.insight}</p></Card>}

                {/* Resolution Items */}
                {gd.resolutions.length > 0 ? (
                  <div>
                    <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#9CA3AF', fontFamily: MONO }}>Needs Attention</h3>
                    <div className="space-y-3">
                      {gd.resolutions.map((item, i) => {
                        const sv = SEV[item.severity] || SEV.medium;
                        return (
                          <div key={i} className="rounded-2xl p-5" style={{ background: sv.bg, border: `1px solid ${sv.b}` }}>
                            <div className="flex items-start gap-3">
                              <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: sv.d }} />
                              <div className="flex-1">
                                <p className="text-sm font-semibold" style={{ color: '#1F2937', fontFamily: HEAD }}>{item.title}</p>
                                {item.detail && <p className="text-xs mt-1 leading-relaxed" style={{ color: '#6B7280', fontFamily: BODY }}>{item.detail}</p>}
                                <ActionBar actions={item.actions || ["hand-off", "dismiss"]} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <Card className="p-6 text-center"><p className="text-sm" style={{ color: '#9CA3AF', fontFamily: BODY }}>No items need attention right now. All clear.</p></Card>
                )}

                {/* Alignment Gaps */}
                {(alignment || contradictions.length > 0) && (
                  <div>
                    <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#9CA3AF', fontFamily: MONO }}>Alignment</h3>
                    {alignment && <Card className="p-5 mb-3"><p className="text-sm leading-relaxed" style={{ color: '#374151', fontFamily: BODY }}>{alignment}</p></Card>}
                    {contradictions.map((ct, i) => (<div key={i} className="px-3 py-2 rounded-lg mb-2" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}><p className="text-xs" style={{ color: '#92400E', fontFamily: MONO }}>⚠ {ct}</p></div>))}
                  </div>
                )}
              </div>

              {/* WEEKLY BRIEF */}
              <div className="mt-8 mb-4">
                <Card className="p-0 overflow-hidden">
                  <button onClick={() => setBriefOpen(!briefOpen)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-1 sm:gap-6 flex-wrap">
                      <span className="text-[10px] font-semibold tracking-widest uppercase mr-2" style={{ color: '#9CA3AF', fontFamily: MONO }}>This Week</span>
                      {wb.cashflow_recovered && <div className="text-left"><span className="text-xl font-bold" style={{ color: '#F97316', fontFamily: HEAD }}>${(wb.cashflow_recovered || 0).toLocaleString()}</span><span className="text-[9px] ml-1 uppercase" style={{ color: '#9CA3AF', fontFamily: MONO }}>recovered</span></div>}
                      {wb.hours_saved && <div className="text-left"><span className="text-xl font-bold" style={{ color: '#059669', fontFamily: HEAD }}>{wb.hours_saved}h</span><span className="text-[9px] ml-1 uppercase" style={{ color: '#9CA3AF', fontFamily: MONO }}>saved</span></div>}
                      {wb.actions_taken && <div className="text-left"><span className="text-xl font-bold" style={{ color: '#2563EB', fontFamily: HEAD }}>{wb.actions_taken}</span><span className="text-[9px] ml-1 uppercase" style={{ color: '#9CA3AF', fontFamily: MONO }}>actions</span></div>}
                      {wb.sop_compliance && <div className="text-left"><span className="text-xl font-bold" style={{ color: '#7C3AED', fontFamily: HEAD }}>{wb.sop_compliance}%</span><span className="text-[9px] ml-1 uppercase" style={{ color: '#9CA3AF', fontFamily: MONO }}>sop</span></div>}
                      {!wb.cashflow_recovered && !wb.hours_saved && <span className="text-xs" style={{ color: '#9CA3AF', fontFamily: BODY }}>Connect integrations to see weekly activity</span>}
                    </div>
                    {briefOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {briefOpen && wb.actions_taken && (
                    <div className="px-6 pb-5 pt-2 space-y-2" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                      <p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}><strong style={{ color: '#F97316' }}>Cash:</strong> Recovered ${(wb.cashflow_recovered || 0).toLocaleString()} via payment follow-ups.</p>
                      <p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}><strong style={{ color: '#059669' }}>Time:</strong> Handled {wb.tasks_handled || 0} tasks, saving {wb.hours_saved || 0} hours.</p>
                    </div>
                  )}
                </Card>
              </div>

              {/* EXECUTIVE MEMO */}
              {memo && (
                <div className="mb-8">
                  <button onClick={() => setMemoOpen(!memoOpen)} className="flex items-center justify-between w-full mb-3">
                    <h3 className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#6B7280', fontFamily: MONO }}>Executive Memo</h3>
                    {memoOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {memoOpen && <Card className="p-8"><p className="text-[15px] leading-loose whitespace-pre-line" style={{ color: '#1F2937', fontFamily: BODY }}>{memo}</p></Card>}
                </div>
              )}

              {/* Sources */}
              {sources && sources.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-4 pb-8" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  <span className="text-[10px]" style={{ color: '#9CA3AF', fontFamily: MONO }}>Sources:</span>
                  {sources.map((s, i) => (<span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#6B7280', background: 'rgba(0,0,0,0.04)', fontFamily: MONO }}>{s}</span>))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdvisorWatchtower;
