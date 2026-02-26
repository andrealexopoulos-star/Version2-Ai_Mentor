import React, { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Mail, MessageSquare, Users, XCircle, ChevronDown, ChevronUp, DollarSign, TrendingUp, Settings, User, Radar } from 'lucide-react';

const HEAD = "var(--font-heading)";
const MONO = "var(--font-mono)";
const BODY = "var(--font-body)";

/* ═══ ACTION BUTTONS ═══ */
const ActionBtn = ({ icon: Icon, label, color }) => (
  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:-translate-y-0.5 active:scale-95" style={{ background: `${color}12`, color, border: `1px solid ${color}30`, fontFamily: MONO }} data-testid={`action-${label.toLowerCase().replace(/\s/g,'-')}`}>
    <Icon className="w-3.5 h-3.5" />{label}
  </button>
);
const ActionBar = ({ actions }) => (
  <div className="flex flex-wrap gap-2 mt-3">
    {actions.includes("auto-email") && <ActionBtn icon={Mail} label="Auto-Email" color="#2563EB" />}
    {actions.includes("quick-sms") && <ActionBtn icon={MessageSquare} label="Quick-SMS" color="#059669" />}
    {actions.includes("hand-off") && <ActionBtn icon={Users} label="Hand Off" color="#F97316" />}
    {actions.includes("dismiss") && <ActionBtn icon={XCircle} label="Dismiss & Learn" color="#6B7280" />}
  </div>
);

/* ═══ 5 COGNITION GROUPS ═══ */
const GROUPS = {
  money: {
    id: 'money', label: 'Money', icon: DollarSign, color: '#F97316', 
    description: 'Cash, invoices, margins, runway, spend',
  },
  revenue: {
    id: 'revenue', label: 'Revenue', icon: TrendingUp, color: '#2563EB',
    description: 'Pipeline, deals, leads, churn, pricing',
  },
  operations: {
    id: 'operations', label: 'Operations', icon: Settings, color: '#059669',
    description: 'Tasks, SOPs, bottlenecks, delivery',
  },
  people: {
    id: 'people', label: 'People', icon: User, color: '#EF4444',
    description: 'Capacity, calendar, decisions, burnout',
  },
  market: {
    id: 'market', label: 'Market', icon: Radar, color: '#7C3AED',
    description: 'Competitors, positioning, trends, regulatory',
  },
};

/* ═══ MOCK DATA PER GROUP ═══ */
const groupData = {
  money: {
    alerts: 3, severity: 'high',
    resolutions: [
      { severity: "high", title: "Client #47 — Invoice $3,200 overdue 12 days", detail: "AI drafted a payment reminder. Tone: firm but polite. Follow-up in 3 days if no response.", actions: ["auto-email", "quick-sms", "hand-off", "dismiss"] },
      { severity: "high", title: "Invoice #1847 — $1,800 overdue 7 days", detail: "Second reminder ready. Previous email opened but no action taken by client.", actions: ["auto-email", "quick-sms", "dismiss"] },
      { severity: "medium", title: "Subcontractor costs up 12% in 45 days", detail: "Margin compression detected. Consider renegotiating or sourcing alternatives.", actions: ["hand-off", "dismiss"] },
    ],
    metrics: { runway: 4.2, margin: "compressing (-3%)", outstanding: "$12,400", overdue: "$5,000" },
    scenarios: { best: "Top deal closes — extended runway", base: "Flat — current runway holds", worst: "Key deals lost — compressed runway" },
    insight: "Your cash position is stable but margins are compressing. Two overdue invoices totalling $5,000 need immediate chase. Subcontractor cost increase is the structural risk — address within 30 days.",
  },
  revenue: {
    alerts: 2, severity: 'high',
    resolutions: [
      { severity: "high", title: "3 enterprise deals stalled at proposal stage", detail: "Close rate compression predicts $45K revenue gap in Q2. Pricing objection common across all 3.", actions: ["auto-email", "hand-off"] },
      { severity: "high", title: "Key account — engagement declining, response time elevated", detail: "30-day communication decline. Churn risk increasing.", actions: ["auto-email", "quick-sms", "hand-off", "dismiss"] },
    ],
    metrics: { pipeline: "$185K", weighted: "$74K", entropy: "High — 60% in 2 deals", deals: 8, stalled: 2 },
    deals: [
      { name: "Deal Alpha", value: 45, prob: 65, stall: 0 },
      { name: "Deal Beta", value: 28, prob: 40, stall: 12 },
      { name: "Deal Gamma", value: 15, prob: 80, stall: 0 },
    ],
    insight: "Pipeline is $185K but concentration risk is high — 60% sits in 2 deals. Deal Beta has been stalled 12 days. If Deal Alpha closes, Q2 is secure. If not, revenue gap of $45K opens.",
  },
  operations: {
    alerts: 2, severity: 'high',
    resolutions: [
      { severity: "high", title: "3 new leads not contacted in 24 hours", detail: "SOP requires contact within 4 hours. AI can send personalised intro emails to all 3, logged to CRM.", actions: ["auto-email", "hand-off", "dismiss"] },
      { severity: "medium", title: "Overtime 15% above target this week", detail: "3 team members logged 48+ hours. Redistribute Monday's workload.", actions: ["hand-off", "dismiss"] },
    ],
    metrics: { sla_breaches: 2, task_aging: "14%", bottleneck: "Pricing sign-off", sop_compliance: "97%" },
    load: { Founder: 112, Operations: 78, Sales: 45 },
    insight: "Two SLA breaches active. The bottleneck is pricing sign-off on proposals — 3 stalled. Delegate authority for proposals under $5K to unblock immediately.",
    recs: ["Delegate pricing authority under $5K", "Automate invoice follow-up under $2K"],
  },
  people: {
    alerts: 1, severity: 'high',
    resolutions: [
      { severity: "high", title: "Founder capacity at 112% — burnout risk", detail: "42 meetings this week (avg 28). 14 pending decisions. Response latency up 40%. AI recommends blocking decision time.", actions: ["hand-off", "dismiss"] },
    ],
    metrics: { capacity: 112, meetings: 42, avg_meetings: 28, decisions: 14, fatigue: "HIGH" },
    insight: "You are the single point of failure. All client relationships, pricing decisions, and strategic direction depend on you. 42 meetings this week is unsustainable. Block 2 hours Friday for decision clearing.",
    spof: ["All client relationships depend on founder", "No backup for pricing sign-off", "Accounting on 1 login, no redundancy"],
  },
  market: {
    alerts: 0, severity: 'low',
    resolutions: [],
    metrics: { competitors_tracked: 3, pricing_vs_market: "-15%", sentiment: "Neutral" },
    competitors: [
      { name: "Competitor A", signal: "Launched new pricing page this week" },
      { name: "Competitor B", signal: "Hiring 2 sales roles (LinkedIn)" },
    ],
    insight: "No urgent market threats. Your positioning as a sovereign intelligence partner is differentiated but under-communicated. Pricing is 15% below market — consider a rate increase on Service B.",
    regulatory: [{ item: "BAS Q3 due 18 days", sev: "med" }, { item: "Workers comp renewal 45 days", sev: "low" }],
  },
};

const weeklyBrief = { cash: 4200, hours: 8.5, actions: 14, tasks: 22, sop: 97, fixes: 2, leads: 5, actioned: 3 };
const alignment = { contradictions: ["Revenue target 20% vs 0 outbound in 14 days", "Improve ops vs no SOPs for top 3 processes"] };
const memo = "Andre, your business is at an inflection point. Deal Alpha ($45K) is your Q2 anchor — if it closes, runway extends to 5 months. If not, 2.8 months and cut non-essential spend.\n\nThe deeper issue isn't revenue — it's capacity. You're at 112% with 14 pending decisions and 42 meetings. SLA breaches and proposal bottleneck are symptoms of a founder who's the single point of failure.\n\nMy recommendation: Deploy $500/mo in automation this week. This buys 8 hours immediately. Use them to close Deal Alpha personally. Revisit hiring in 60 days.";

const ST = { STABLE: { c: '#166534', bg: '#F0FDF4', b: '#BBF7D0', d: '#22C55E' }, DRIFT: { c: '#92400E', bg: '#FFFBEB', b: '#FDE68A', d: '#F59E0B' }, COMPRESSION: { c: '#9A3412', bg: '#FFF7ED', b: '#FED7AA', d: '#F97316' }, CRITICAL: { c: '#991B1B', bg: '#FEF2F2', b: '#FECACA', d: '#EF4444' } };
const SEV = { high: { bg: '#FEF2F2', b: '#FECACA', d: '#EF4444' }, medium: { bg: '#FFFBEB', b: '#FDE68A', d: '#F59E0B' }, low: { bg: '#F0FDF4', b: '#BBF7D0', d: '#059669' } };

const Card = ({ children, className = '' }) => (<div className={`rounded-2xl ${className}`} style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.06)', backdropFilter: 'blur(12px)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>{children}</div>);

// Sort groups by alert count + severity
const getSortedGroups = () => {
  const sevWeight = { high: 3, medium: 2, low: 1 };
  return Object.values(GROUPS).sort((a, b) => {
    const da = groupData[a.id], db = groupData[b.id];
    const scoreA = da.alerts * sevWeight[da.severity];
    const scoreB = db.alerts * sevWeight[db.severity];
    return scoreB - scoreA;
  });
};

const CognitiveSnapshotV2Mockup = () => {
  const sortedGroups = getSortedGroups();
  const [activeGroup, setActiveGroup] = useState(sortedGroups[0].id);
  const [briefOpen, setBriefOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);

  const gd = groupData[activeGroup];
  const group = GROUPS[activeGroup];
  const st = ST.DRIFT;

  return (
    <DashboardLayout>
      <div className="min-h-[calc(100vh-56px)]" style={{ background: '#FAFAF8', fontFamily: HEAD }}>

        {/* ═══ STICKY HEADER ═══ */}
        <div className="sticky top-14 z-30" style={{ background: st.bg, borderBottom: `1px solid ${st.b}` }}>
          <div className="max-w-5xl mx-auto px-6 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: st.d }} />
              <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: st.c, fontFamily: MONO }}>DRIFT</span>
              <span className="text-[11px]" style={{ color: st.c }}>↘ worsening</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: st.c, background: `${st.c}15`, fontFamily: MONO }}>78%</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#6B7280', background: 'rgba(0,0,0,0.04)', fontFamily: MONO }}>4.2mo runway</span>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-semibold mb-6" style={{ color: '#111827', fontFamily: HEAD }}>Good morning, Andre.</h1>

          {/* ═══ 5 COGNITION TABS ═══ */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2" data-testid="cognition-tabs">
            {sortedGroups.map((g) => {
              const d = groupData[g.id];
              const isActive = activeGroup === g.id;
              const Icon = g.icon;
              return (
                <button key={g.id} onClick={() => setActiveGroup(g.id)}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl transition-all shrink-0"
                  style={{
                    background: isActive ? g.color : 'white',
                    color: isActive ? 'white' : '#374151',
                    border: `1.5px solid ${isActive ? g.color : 'rgba(0,0,0,0.08)'}`,
                    boxShadow: isActive ? `0 4px 16px ${g.color}30` : '0 1px 3px rgba(0,0,0,0.04)',
                    fontFamily: HEAD,
                  }}
                  data-testid={`tab-${g.id}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{g.label}</span>
                  {d.alerts > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{
                      background: isActive ? 'rgba(255,255,255,0.25)' : SEV[d.severity].bg,
                      color: isActive ? 'white' : SEV[d.severity].d,
                      fontFamily: MONO,
                    }}>{d.alerts}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ═══ ACTIVE GROUP CONTENT ═══ */}
          <div className="space-y-6">

            {/* Group Header */}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${group.color}15` }}>
                <group.icon className="w-4 h-4" style={{ color: group.color }} />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: '#111827', fontFamily: HEAD }}>{group.label}</h2>
                <p className="text-xs" style={{ color: '#9CA3AF', fontFamily: MONO }}>{group.description}</p>
              </div>
            </div>

            {/* AI Insight Summary */}
            <Card className="p-5">
              <p className="text-sm leading-relaxed" style={{ color: '#374151', fontFamily: BODY }}>{gd.insight}</p>
            </Card>

            {/* Resolution Items */}
            {gd.resolutions.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#9CA3AF', fontFamily: MONO }}>Needs Attention</h3>
                <div className="space-y-3">
                  {gd.resolutions.map((item, i) => {
                    const sv = SEV[item.severity];
                    return (
                      <div key={i} className="rounded-2xl p-5" style={{ background: sv.bg, border: `1px solid ${sv.b}` }}>
                        <div className="flex items-start gap-3">
                          <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: sv.d }} />
                          <div className="flex-1">
                            <p className="text-sm font-semibold" style={{ color: '#1F2937', fontFamily: HEAD }}>{item.title}</p>
                            <p className="text-xs mt-1 leading-relaxed" style={{ color: '#6B7280', fontFamily: BODY }}>{item.detail}</p>
                            <ActionBar actions={item.actions} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {gd.resolutions.length === 0 && (
              <Card className="p-6 text-center">
                <p className="text-sm" style={{ color: '#9CA3AF', fontFamily: BODY }}>No items need attention right now. All clear.</p>
              </Card>
            )}

            {/* Group-Specific Metrics */}
            {activeGroup === 'money' && (
              <Card className="p-6">
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#9CA3AF', fontFamily: MONO }}>Financial Position</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div><span className="text-2xl font-bold" style={{ color: '#F97316', fontFamily: HEAD }}>{gd.metrics.runway}</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Months Runway</p></div>
                  <div><span className="text-sm font-semibold" style={{ color: '#92400E', fontFamily: HEAD }}>{gd.metrics.margin}</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Margins</p></div>
                  <div><span className="text-sm font-semibold" style={{ color: '#374151', fontFamily: HEAD }}>{gd.metrics.outstanding}</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Outstanding</p></div>
                  <div><span className="text-sm font-semibold" style={{ color: '#EF4444', fontFamily: HEAD }}>{gd.metrics.overdue}</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Overdue</p></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[{ l: 'Best', t: gd.scenarios.best, c: '#166534', bg: '#F0FDF4' }, { l: 'Base', t: gd.scenarios.base, c: '#6B7280', bg: '#F9FAFB' }, { l: 'Worst', t: gd.scenarios.worst, c: '#991B1B', bg: '#FEF2F2' }].map((s, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ background: s.bg }}><p className="text-[10px] font-semibold uppercase mb-1" style={{ color: s.c, fontFamily: MONO }}>30d {s.l}</p><p className="text-xs" style={{ color: s.c, fontFamily: BODY }}>{s.t}</p></div>
                  ))}
                </div>
              </Card>
            )}

            {activeGroup === 'revenue' && (
              <Card className="p-6">
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#9CA3AF', fontFamily: MONO }}>Pipeline</h3>
                <div className="flex items-center gap-4 mb-4">
                  <div><span className="text-2xl font-bold" style={{ fontFamily: HEAD }}>{gd.metrics.pipeline}</span><span className="text-[10px] ml-1" style={{ color: '#9CA3AF', fontFamily: MONO }}>total</span></div>
                  <div><span className="text-2xl font-bold" style={{ color: '#2563EB', fontFamily: HEAD }}>{gd.metrics.weighted}</span><span className="text-[10px] ml-1" style={{ color: '#9CA3AF', fontFamily: MONO }}>weighted</span></div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#FFFBEB', color: '#92400E', fontFamily: MONO }}>{gd.metrics.entropy}</span>
                </div>
                <div className="space-y-2">{gd.deals.map((d, i) => (<div key={i} className="flex items-center gap-3"><span className="text-sm w-28 truncate" style={{ fontFamily: HEAD }}>{d.name}</span><span className="text-xs w-12 text-right" style={{ fontFamily: MONO }}>${d.value}K</span><span className="text-xs w-10 text-right font-semibold" style={{ color: d.prob >= 70 ? '#166534' : d.prob >= 50 ? '#92400E' : '#991B1B', fontFamily: MONO }}>{d.prob}%</span><div className="flex-1 h-2 rounded-full" style={{ background: '#F3F4F6' }}><div className="h-full rounded-full" style={{ width: `${d.prob}%`, background: d.prob >= 70 ? '#22C55E' : d.prob >= 50 ? '#F59E0B' : '#EF4444' }} /></div>{d.stall > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#FEF2F2', color: '#991B1B', fontFamily: MONO }}>{d.stall}d stalled</span>}</div>))}</div>
              </Card>
            )}

            {activeGroup === 'operations' && (
              <Card className="p-6">
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#9CA3AF', fontFamily: MONO }}>Execution</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div><span className="text-2xl font-bold" style={{ color: '#EF4444', fontFamily: HEAD }}>{gd.metrics.sla_breaches}</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>SLA Breaches</p></div>
                  <div><span className="text-2xl font-bold" style={{ color: '#F59E0B', fontFamily: HEAD }}>{gd.metrics.task_aging}</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Task Aging</p></div>
                  <div><span className="text-sm font-semibold" style={{ color: '#374151', fontFamily: HEAD }}>{gd.metrics.sop_compliance}</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>SOP Compliance</p></div>
                  <div><span className="text-sm font-semibold" style={{ color: '#374151', fontFamily: HEAD }}>{gd.metrics.bottleneck}</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Bottleneck</p></div>
                </div>
                <div className="mb-4"><p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#9CA3AF', fontFamily: MONO }}>Resource Load</p><div className="flex gap-4">{Object.entries(gd.load).map(([k, v]) => (<div key={k} className="flex items-center gap-2"><span className="text-xs" style={{ fontFamily: BODY }}>{k}</span><div className="w-24 h-2 rounded-full" style={{ background: '#F3F4F6' }}><div className="h-full rounded-full" style={{ width: `${Math.min(v, 100)}%`, background: v > 100 ? '#EF4444' : v > 80 ? '#F59E0B' : '#22C55E' }} /></div><span className="text-[10px] font-semibold" style={{ color: v > 100 ? '#EF4444' : '#6B7280', fontFamily: MONO }}>{v}%</span></div>))}</div></div>
                {gd.recs.map((r, i) => (<p key={i} className="text-sm mt-1" style={{ color: '#F97316', fontFamily: HEAD }}>→ {r}</p>))}
              </Card>
            )}

            {activeGroup === 'people' && (
              <Card className="p-6">
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#9CA3AF', fontFamily: MONO }}>Capacity</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div><span className="text-2xl font-bold" style={{ color: '#EF4444', fontFamily: HEAD }}>{gd.metrics.capacity}%</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Capacity</p></div>
                  <div><span className="text-2xl font-bold" style={{ color: '#374151', fontFamily: HEAD }}>{gd.metrics.meetings}</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Meetings (avg {gd.metrics.avg_meetings})</p></div>
                  <div><span className="text-2xl font-bold" style={{ color: '#F59E0B', fontFamily: HEAD }}>{gd.metrics.decisions}</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Decisions Pending</p></div>
                  <div><span className="text-sm font-bold" style={{ color: '#EF4444', fontFamily: HEAD }}>{gd.metrics.fatigue}</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Fatigue Risk</p></div>
                </div>
                <div className="mb-3"><p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#9CA3AF', fontFamily: MONO }}>Single Points of Failure</p>{gd.spof.map((s, i) => (<p key={i} className="text-sm mb-1" style={{ color: '#374151', fontFamily: BODY }}>• {s}</p>))}</div>
              </Card>
            )}

            {activeGroup === 'market' && (
              <Card className="p-6">
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#9CA3AF', fontFamily: MONO }}>Competitive Intelligence</h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div><span className="text-2xl font-bold" style={{ color: '#7C3AED', fontFamily: HEAD }}>{gd.metrics.competitors_tracked}</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Tracked</p></div>
                  <div><span className="text-sm font-semibold" style={{ color: '#F97316', fontFamily: HEAD }}>{gd.metrics.pricing_vs_market}</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>vs Market</p></div>
                  <div><span className="text-sm font-semibold" style={{ fontFamily: HEAD }}>{gd.metrics.sentiment}</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Sentiment</p></div>
                </div>
                <div className="space-y-2 mb-3">{gd.competitors.map((c, i) => (<div key={i} className="flex items-center gap-2"><span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: '#F3F4F6', fontFamily: MONO }}>{c.name}</span><span className="text-xs" style={{ color: '#6B7280', fontFamily: BODY }}>{c.signal}</span></div>))}</div>
                <div className="flex flex-wrap gap-2 mt-3">{gd.regulatory.map((r, i) => (<span key={i} className="text-[10px] px-2 py-1 rounded-lg" style={{ background: r.sev === 'med' ? '#FFFBEB' : '#F9FAFB', color: r.sev === 'med' ? '#92400E' : '#6B7280', fontFamily: MONO }}>{r.item}</span>))}</div>
              </Card>
            )}

            {/* Alignment Contradictions (shown for all groups) */}
            {alignment.contradictions.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#9CA3AF', fontFamily: MONO }}>Alignment Gaps</h3>
                {alignment.contradictions.map((c, i) => (<div key={i} className="px-3 py-2 rounded-lg mb-2" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}><p className="text-xs" style={{ color: '#92400E', fontFamily: MONO }}>⚠ {c}</p></div>))}
              </div>
            )}
          </div>

          {/* ═══ WEEKLY BRIEF (Always visible, collapsed) ═══ */}
          <div className="mt-8 mb-4">
            <Card className="p-0 overflow-hidden">
              <button onClick={() => setBriefOpen(!briefOpen)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-1 sm:gap-6 flex-wrap">
                  <span className="text-[10px] font-semibold tracking-widest uppercase mr-2" style={{ color: '#9CA3AF', fontFamily: MONO }}>This Week</span>
                  <div className="text-left"><span className="text-xl font-bold" style={{ color: '#F97316', fontFamily: HEAD }}>${weeklyBrief.cash.toLocaleString()}</span><span className="text-[9px] ml-1 uppercase" style={{ color: '#9CA3AF', fontFamily: MONO }}>recovered</span></div>
                  <div className="text-left"><span className="text-xl font-bold" style={{ color: '#059669', fontFamily: HEAD }}>{weeklyBrief.hours}h</span><span className="text-[9px] ml-1 uppercase" style={{ color: '#9CA3AF', fontFamily: MONO }}>saved</span></div>
                  <div className="text-left"><span className="text-xl font-bold" style={{ color: '#2563EB', fontFamily: HEAD }}>{weeklyBrief.actions}</span><span className="text-[9px] ml-1 uppercase" style={{ color: '#9CA3AF', fontFamily: MONO }}>actions</span></div>
                  <div className="text-left"><span className="text-xl font-bold" style={{ color: '#7C3AED', fontFamily: HEAD }}>{weeklyBrief.sop}%</span><span className="text-[9px] ml-1 uppercase" style={{ color: '#9CA3AF', fontFamily: MONO }}>sop</span></div>
                </div>
                {briefOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {briefOpen && (
                <div className="px-6 pb-5 pt-2 space-y-2" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  <p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}><strong style={{ color: '#F97316' }}>Cash:</strong> Sent {weeklyBrief.actions} payment reminders, recovering ${weeklyBrief.cash.toLocaleString()}.</p>
                  <p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}><strong style={{ color: '#059669' }}>Time:</strong> Handled {weeklyBrief.tasks} tasks, saving {weeklyBrief.hours} hours.</p>
                  <p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}><strong style={{ color: '#2563EB' }}>Team:</strong> Assigned {weeklyBrief.leads} leads; {weeklyBrief.actioned} actioned in 2 hours.</p>
                  <p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}><strong style={{ color: '#7C3AED' }}>SOPs:</strong> {weeklyBrief.sop}% compliance, {weeklyBrief.fixes} auto-fixes.</p>
                </div>
              )}
            </Card>
          </div>

          {/* ═══ EXECUTIVE MEMO (Collapsible) ═══ */}
          <div className="mb-8">
            <button onClick={() => setMemoOpen(!memoOpen)} className="flex items-center justify-between w-full mb-3">
              <h3 className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#6B7280', fontFamily: MONO }}>Executive Memo</h3>
              {memoOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {memoOpen && <Card className="p-8"><p className="text-[15px] leading-loose whitespace-pre-line" style={{ color: '#1F2937', fontFamily: BODY }}>{memo}</p></Card>}
          </div>

          {/* Sources */}
          <div className="flex flex-wrap gap-2 pt-4 pb-8" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            <span className="text-[10px]" style={{ color: '#9CA3AF', fontFamily: MONO }}>Sources:</span>
            {["business_profile", "calibration", "emails (25)", "HubSpot CRM", "Xero (12 invoices)", "signals (18)", "Perplexity"].map((s, i) => (<span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#6B7280', background: 'rgba(0,0,0,0.04)', fontFamily: MONO }}>{s}</span>))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CognitiveSnapshotV2Mockup;
