import React, { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Mail, MessageSquare, Users, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

const HEAD = "var(--font-heading)";
const MONO = "var(--font-mono)";
const BODY = "var(--font-body)";

/* ═══ ACTION BUTTONS ═══ */
const ActionBtn = ({ icon: Icon, label, color }) => (
  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:-translate-y-0.5" style={{ background: `${color}12`, color, border: `1px solid ${color}30`, fontFamily: MONO }} data-testid={`action-${label.toLowerCase().replace(/\s/g,'-')}`}>
    <Icon className="w-3.5 h-3.5" />{label}
  </button>
);
const AutoEmail = () => <ActionBtn icon={Mail} label="Auto-Email" color="#2563EB" />;
const QuickSMS = () => <ActionBtn icon={MessageSquare} label="Quick-SMS" color="#059669" />;
const HandOff = () => <ActionBtn icon={Users} label="Hand Off" color="#F97316" />;
const Dismiss = () => <ActionBtn icon={XCircle} label="Dismiss & Learn" color="#6B7280" />;
const ActionBar = ({ actions }) => (<div className="flex flex-wrap gap-2 mt-3">{actions.includes("auto-email") && <AutoEmail />}{actions.includes("quick-sms") && <QuickSMS />}{actions.includes("hand-off") && <HandOff />}{actions.includes("dismiss") && <Dismiss />}</div>);

/* ═══ MOCK DATA ═══ */
const m = {
  state: { status: "DRIFT", confidence: 78, interpretation: "Cash stable but operations drifting. Founder capacity stretched.", velocity: "worsening", runway: 4.2 },
  resolution: [
    { id: 1, severity: "high", title: "Client #47 — Invoice $3,200 overdue 12 days", detail: "AI drafted a payment reminder. Tone: firm but polite. Follow-up in 3 days if no response.", actions: ["auto-email", "quick-sms", "hand-off", "dismiss"] },
    { id: 2, severity: "high", title: "3 new leads not contacted in 24 hours", detail: "SOP requires contact within 4 hours. AI can send personalised intro emails to all 3, logged to CRM.", actions: ["auto-email", "hand-off", "dismiss"] },
    { id: 3, severity: "high", title: "Client B — engagement declining, response time up 3x", detail: "30-day communication decline detected. AI can draft a warm re-engagement email.", actions: ["auto-email", "quick-sms", "hand-off", "dismiss"] },
    { id: 4, severity: "medium", title: "Overtime 15% above target this week", detail: "3 team members logged 48+ hours. Redistribute Monday's workload.", actions: ["hand-off", "dismiss"] },
    { id: 5, severity: "low", title: "Supplier price dropped 10% — restock opportunity", detail: "Supplier ABC reduced pricing on top 3 products. AI can generate a purchase order.", actions: ["auto-email", "dismiss"] },
  ],
  brief: { cash: 4200, hours: 8.5, actions: 14, tasks: 22, leads: 5, actioned: 3, sop: 97, fixes: 2 },
  vitals: { capacity: 112, calendar: "42 meetings (avg 28). 6 back-to-back.", decisions: 14, fatigue: "high", stress: "Response latency up 40%. 3 stressed-tone emails.", rec: "Block 2 hours Friday for decision clearing. Cancel 3 lowest-value meetings." },
  inevitabilities: [
    { domain: "Revenue", signal: "Three enterprise deals stalled at proposal. Close rate compression predicts $45K gap in Q2.", intensity: "accelerating", prob: 75, impact: "$15K–$45K", window: "12 days", owner: "Sales / Founder", ignored: "Q2 target missed 20-30%. Runway drops to 2.8mo.", actions: ["auto-email", "hand-off"] },
    { domain: "Operations", signal: "Task completion down 8%. Two SLA breaches. Proposal bottleneck at pricing sign-off.", intensity: "forming", prob: 60, impact: "$5K–$12K", window: "3 weeks", owner: "Operations", ignored: "Client satisfaction decline. Contract renewal risk.", actions: ["hand-off", "dismiss"] },
  ],
  priority: { primary: "Close Deal Alpha pricing sign-off", hrs: "~6 hrs", secondary: "Fix SLA on Project Alpha", shrs: "~2 hrs", delegate: "Operations manager", noise: "Social media rebrand — defer to next month" },
  capital: { runway: 4.2, margin: "compressing (-3%)", best: "Deal Alpha closes → 5.1mo", base: "Flat → 4.2mo", worst: "Deal A + Client B lost → 2.8mo", spend: "Marketing $4.20 per $1 (above benchmark)", alert: "Subcontractor costs up 12% in 45 days" },
  revenue: { pipeline: 185, weighted: 74, entropy: "60% in 2 deals — high concentration", deals: [{ n: "Deal Alpha", v: 45, p: 65, s: 0 }, { n: "Deal Beta", v: 28, p: 40, s: 12 }, { n: "Deal Gamma", v: 15, p: 80, s: 0 }], churn: "Client B — response time 3x slower" },
  reallocation: [{ a: "Move $2K/mo ads → automation", i: "Frees 8 hrs/week" }, { a: "Kill Deal Delta proposal", i: "Recovers 6 hrs" }, { a: "Raise Service B rate +15%", i: "+$800/mo margin" }],
  execution: { sla: 2, detail: "Project Alpha (3d late), Invoice #1847 (7d overdue)", aging: 14, bottleneck: "3 proposals stalled — pricing sign-off", load: { Founder: 112, Operations: 78, Sales: 45 }, recs: ["Delegate pricing authority under $5K", "Automate invoice follow-up under $2K"] },
  risk: { spof: ["All client relationships on founder", "1 Xero login, no redundancy"], conc: "85% revenue from 3 clients (max 40%)", reg: [{ i: "BAS Q3 due 18 days", s: "med" }, { i: "Workers comp 45 days", s: "low" }], contracts: "2 expire in 60 days, no renewal started" },
  alignment: { text: "Goal: 20% revenue growth. Reality: 0 outbound activities in 14 days. Gap between ambition and execution widening.", contradictions: ["Revenue target 20% vs 0 outbound in 14 days", "Improve ops vs no SOPs for top 3 processes"] },
  market: { text: "Australian consulting market competitive. Your sovereign positioning differentiated but under-communicated.", competitors: [{ n: "Competitor A", s: "New pricing page" }, { n: "Competitor B", s: "Hiring 2 sales (LinkedIn)" }], pricing: "15% below market average" },
  memo: "Andre, your business is at an inflection point. Deal Alpha ($45K) is your Q2 anchor — if it closes, runway extends to 5 months. If not, 2.8 months and cut non-essential spend.\n\nThe deeper issue isn't revenue — it's capacity. You're at 112% with 14 pending decisions and 42 meetings. SLA breaches and proposal bottleneck are symptoms of a founder who's become the single point of failure.\n\nMy recommendation: Deploy $500/mo in automation this week. This buys 8 hours immediately. Use them to close Deal Alpha personally. Revisit hiring in 60 days.",
  blindspots: { confidence: 72, detail: "Strong on CRM + email. Missing HR/payroll.", missing: [{ a: "HR / Payroll", f: "Connect BambooHR" }], sources: ["business_profile", "calibration", "emails (25)", "HubSpot CRM (42 contacts, 8 deals)", "Xero (12 invoices)", "signals (18)", "Perplexity (market)"] },
};

const ST = { STABLE: { c: '#166534', bg: '#F0FDF4', b: '#BBF7D0', d: '#22C55E' }, DRIFT: { c: '#92400E', bg: '#FFFBEB', b: '#FDE68A', d: '#F59E0B' }, COMPRESSION: { c: '#9A3412', bg: '#FFF7ED', b: '#FED7AA', d: '#F97316' }, CRITICAL: { c: '#991B1B', bg: '#FEF2F2', b: '#FECACA', d: '#EF4444' } };
const INT = { forming: { c: '#F59E0B', bg: '#FFFBEB', b: '#FDE68A' }, accelerating: { c: '#F97316', bg: '#FFF7ED', b: '#FED7AA' }, imminent: { c: '#EF4444', bg: '#FEF2F2', b: '#FECACA' } };
const SEV = { high: { bg: '#FEF2F2', b: '#FECACA', d: '#EF4444' }, medium: { bg: '#FFFBEB', b: '#FDE68A', d: '#F59E0B' }, low: { bg: '#F0FDF4', b: '#BBF7D0', d: '#059669' } };

const Sec = ({ label, children, id }) => (<section className="mb-8" data-testid={id}><h2 className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#9CA3AF', fontFamily: MONO }}>{label}</h2>{children}</section>);
const Card = ({ children, className = '' }) => (<div className={`rounded-2xl ${className}`} style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.06)', backdropFilter: 'blur(12px)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>{children}</div>);
const Group = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (<div className="mb-8"><button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full mb-4 group"><h2 className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#6B7280', fontFamily: MONO }}>{title}</h2><span className="text-gray-400 group-hover:text-gray-600 transition-colors">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span></button>{open && <div className="space-y-6">{children}</div>}</div>);
};

const CognitiveSnapshotV2Mockup = () => {
  const st = ST[m.state.status];
  const [briefOpen, setBriefOpen] = useState(false);

  return (
    <DashboardLayout>
      <div className="min-h-[calc(100vh-56px)]" style={{ background: '#FAFAF8', fontFamily: HEAD }}>

        {/* ═══ 1. SYSTEM STATE — Sticky Anchor ═══ */}
        <div className="sticky top-14 z-30" style={{ background: st.bg, borderBottom: `1px solid ${st.b}` }}>
          <div className="max-w-4xl mx-auto px-6 py-2.5 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: st.d }} />
              <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: st.c, fontFamily: MONO }}>{m.state.status}</span>
              <span className="text-[11px]" style={{ color: st.c }}>↘ {m.state.velocity}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: st.c, background: `${st.c}15`, fontFamily: MONO }}>{m.state.confidence}%</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#6B7280', background: 'rgba(0,0,0,0.04)', fontFamily: MONO }}>Runway: {m.state.runway}mo</span>
            </div>
          </div>
          <div className="max-w-4xl mx-auto px-6 pb-2"><p className="text-[12px]" style={{ color: st.c, fontFamily: BODY }}>{m.state.interpretation}</p></div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-10 space-y-2">
          <h1 className="text-3xl font-semibold mb-6" style={{ color: '#111827', fontFamily: HEAD }}>Good morning, Andre.</h1>

          {/* ═══ 2. RESOLUTION CENTER — "What's on fire?" ═══ */}
          <Sec label="Needs Your Attention" id="resolution-center">
            <div className="space-y-3">
              {m.resolution.map((item) => {
                const sv = SEV[item.severity];
                return (
                  <div key={item.id} className="rounded-2xl p-5" style={{ background: sv.bg, border: `1px solid ${sv.b}` }}>
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
          </Sec>

          {/* ═══ 3. WEEKLY BRIEF — "What did you handle?" ═══ */}
          <Sec label="This Week — Your AI at Work" id="weekly-brief">
            <Card className="p-0 overflow-hidden">
              <button onClick={() => setBriefOpen(!briefOpen)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="text-left"><span className="text-2xl font-bold" style={{ color: '#F97316', fontFamily: HEAD }}>${m.brief.cash.toLocaleString()}</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Recovered</p></div>
                  <div className="text-left"><span className="text-2xl font-bold" style={{ color: '#059669', fontFamily: HEAD }}>{m.brief.hours}h</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Saved</p></div>
                  <div className="text-left"><span className="text-2xl font-bold" style={{ color: '#2563EB', fontFamily: HEAD }}>{m.brief.actions}</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Actions</p></div>
                  <div className="text-left"><span className="text-2xl font-bold" style={{ color: '#7C3AED', fontFamily: HEAD }}>{m.brief.sop}%</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>SOP</p></div>
                </div>
                {briefOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>
              {briefOpen && (
                <div className="px-6 pb-5 pt-2 space-y-2" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  <p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}><strong style={{ color: '#F97316' }}>Cash:</strong> Sent {m.brief.actions} late-payment emails, recovering ${m.brief.cash.toLocaleString()}.</p>
                  <p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}><strong style={{ color: '#059669' }}>Time:</strong> Handled {m.brief.tasks} routine tasks, saving you {m.brief.hours} hours.</p>
                  <p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}><strong style={{ color: '#2563EB' }}>Team:</strong> Assigned {m.brief.leads} leads; {m.brief.actioned} actioned within 2 hours.</p>
                  <p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}><strong style={{ color: '#7C3AED' }}>SOPs:</strong> {m.brief.sop}% compliance, {m.brief.fixes} automated fixes.</p>
                </div>
              )}
            </Card>
          </Sec>

          {/* ═══ 4. FOUNDER VITALS — "Am I okay?" ═══ */}
          <Sec label="Your Capacity" id="founder-vitals">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#EF4444', fontFamily: MONO }}>Capacity: {m.vitals.capacity}%</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#FEF2F2', color: '#991B1B', fontFamily: MONO }}>Fatigue: {m.vitals.fatigue}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div><p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#9CA3AF', fontFamily: MONO }}>Calendar</p><p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}>{m.vitals.calendar}</p></div>
                <div><p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#9CA3AF', fontFamily: MONO }}>Decisions Pending</p><p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}>{m.vitals.decisions} open (threshold: 8)</p></div>
              </div>
              <p className="text-sm" style={{ color: '#6B7280', fontFamily: BODY }}>{m.vitals.stress}</p>
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}><p className="text-sm font-medium" style={{ color: '#F97316', fontFamily: HEAD }}>→ {m.vitals.rec}</p></div>
            </Card>
          </Sec>

          {/* ═══ 5. INEVITABILITIES — "What's coming?" ═══ */}
          <Sec label="Coming Towards You" id="inevitabilities">
            <div className="space-y-3">
              {m.inevitabilities.map((inv, i) => {
                const ic = INT[inv.intensity];
                return (
                  <div key={i} className="p-5 rounded-2xl" style={{ background: ic.bg, border: `1px solid ${ic.b}` }}>
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: ic.c, fontFamily: MONO }}>{inv.domain}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: ic.c, background: `${ic.c}15`, fontFamily: MONO }}>{inv.intensity} · {inv.prob}%</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#991B1B', background: '#FEF2F2', fontFamily: MONO }}>{inv.impact}</span>
                      </div>
                      <span className="text-[10px]" style={{ color: ic.c, fontFamily: MONO }}>Window: {inv.window} · Owner: {inv.owner}</span>
                    </div>
                    <p className="text-[15px] leading-relaxed font-medium" style={{ color: '#1F2937' }}>{inv.signal}</p>
                    <p className="text-sm mt-1" style={{ color: '#7F1D1D' }}>If ignored: {inv.ignored}</p>
                    <ActionBar actions={inv.actions} />
                  </div>
                );
              })}
            </div>
          </Sec>

          {/* ═══ 6. PRIORITY — "The ONE thing" ═══ */}
          <Sec label="Your Focus This Week" id="priority">
            <Card className="p-6">
              <div className="mb-3"><span className="text-[10px] font-semibold tracking-widest uppercase block mb-1" style={{ color: '#111827', fontFamily: MONO }}>Do This First</span><p className="text-[15px] font-medium" style={{ color: '#1F2937' }}>{m.priority.primary}</p><p className="text-xs mt-1" style={{ color: '#F97316', fontFamily: MONO }}>{m.priority.hrs}</p></div>
              <div className="mb-3 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}><span className="text-[10px] font-semibold tracking-widest uppercase block mb-1" style={{ color: '#6B7280', fontFamily: MONO }}>Then</span><p className="text-sm" style={{ color: '#374151' }}>{m.priority.secondary}</p><p className="text-xs mt-1" style={{ color: '#6B7280', fontFamily: MONO }}>{m.priority.shrs} · Delegate: {m.priority.delegate}</p></div>
              <div className="pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}><span className="text-[10px] font-semibold tracking-widest uppercase block mb-1" style={{ color: '#9CA3AF', fontFamily: MONO }}>Ignore This</span><p className="text-sm" style={{ color: '#9CA3AF' }}>{m.priority.noise}</p></div>
            </Card>
          </Sec>

          {/* ═══ 7. FINANCIAL HEALTH — Collapsible Group ═══ */}
          <Group title="Financial Health">
            <Card className="p-6">
              <div className="flex items-center gap-4 mb-4 flex-wrap">
                <div><span className="text-2xl font-bold" style={{ color: '#F97316', fontFamily: HEAD }}>{m.capital.runway}</span><span className="text-[10px] ml-1 uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>months runway</span></div>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#FFFBEB', color: '#92400E', fontFamily: MONO }}>Margins: {m.capital.margin}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[{ l: 'Best', t: m.capital.best, c: '#166534', bg: '#F0FDF4' }, { l: 'Base', t: m.capital.base, c: '#6B7280', bg: '#F9FAFB' }, { l: 'Worst', t: m.capital.worst, c: '#991B1B', bg: '#FEF2F2' }].map((s, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: s.bg }}><p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: s.c, fontFamily: MONO }}>30d {s.l}</p><p className="text-xs leading-relaxed" style={{ color: s.c, fontFamily: BODY }}>{s.t}</p></div>
                ))}
              </div>
              {m.capital.alert && <div className="px-3 py-2 rounded-lg" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}><p className="text-xs" style={{ color: '#92400E', fontFamily: MONO }}>⚠ {m.capital.alert}</p></div>}
            </Card>
            <Card className="p-6">
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#9CA3AF', fontFamily: MONO }}>Pipeline</p>
              <div className="flex items-center gap-4 mb-3"><span className="text-2xl font-bold" style={{ fontFamily: HEAD }}>${m.revenue.pipeline}K</span><span className="text-2xl font-bold" style={{ color: '#F97316', fontFamily: HEAD }}>${m.revenue.weighted}K</span><span className="text-[10px]" style={{ color: '#9CA3AF', fontFamily: MONO }}>weighted</span></div>
              <div className="space-y-2 mb-3">{m.revenue.deals.map((d, i) => (<div key={i} className="flex items-center gap-3"><span className="text-sm w-28 truncate" style={{ fontFamily: HEAD }}>{d.n}</span><span className="text-xs w-12 text-right" style={{ fontFamily: MONO }}>${d.v}K</span><span className="text-xs w-10 text-right font-semibold" style={{ color: d.p >= 70 ? '#166534' : d.p >= 50 ? '#92400E' : '#991B1B', fontFamily: MONO }}>{d.p}%</span><div className="flex-1 h-2 rounded-full" style={{ background: '#F3F4F6' }}><div className="h-full rounded-full" style={{ width: `${d.p}%`, background: d.p >= 70 ? '#22C55E' : d.p >= 50 ? '#F59E0B' : '#EF4444' }} /></div>{d.s > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#FEF2F2', color: '#991B1B', fontFamily: MONO }}>{d.s}d stalled</span>}</div>))}</div>
              {m.revenue.churn && <div className="px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}><p className="text-xs" style={{ color: '#991B1B', fontFamily: MONO }}>Churn: {m.revenue.churn}</p></div>}
            </Card>
            <Card className="p-5">
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#9CA3AF', fontFamily: MONO }}>Recommended Moves</p>
              {m.reallocation.map((r, i) => (<div key={i} className="flex items-start gap-3 mb-2"><span className="text-sm font-bold shrink-0" style={{ color: '#F97316', fontFamily: HEAD }}>{i+1}.</span><div><p className="text-sm font-medium" style={{ color: '#1F2937', fontFamily: HEAD }}>{r.a}</p><p className="text-xs" style={{ color: '#059669', fontFamily: MONO }}>Impact: {r.i}</p></div></div>))}
            </Card>
          </Group>

          {/* ═══ 8. OPERATIONAL HEALTH — Collapsible Group ═══ */}
          <Group title="Operational Health">
            <Card className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div><p className="text-2xl font-bold" style={{ color: '#EF4444', fontFamily: HEAD }}>{m.execution.sla}</p><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>SLA Breaches</p></div>
                <div><p className="text-2xl font-bold" style={{ color: '#F59E0B', fontFamily: HEAD }}>{m.execution.aging}%</p><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Task Aging</p></div>
                <div className="col-span-2"><p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#9CA3AF', fontFamily: MONO }}>Bottleneck</p><p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}>{m.execution.bottleneck}</p></div>
              </div>
              <div className="mb-4"><p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#9CA3AF', fontFamily: MONO }}>Resource Load</p><div className="flex gap-4">{Object.entries(m.execution.load).map(([k, v]) => (<div key={k} className="flex items-center gap-2"><span className="text-xs" style={{ fontFamily: BODY }}>{k}</span><div className="w-24 h-2 rounded-full" style={{ background: '#F3F4F6' }}><div className="h-full rounded-full" style={{ width: `${Math.min(v, 100)}%`, background: v > 100 ? '#EF4444' : v > 80 ? '#F59E0B' : '#22C55E' }} /></div><span className="text-[10px] font-semibold" style={{ color: v > 100 ? '#EF4444' : '#6B7280', fontFamily: MONO }}>{v}%</span></div>))}</div></div>
              {m.execution.recs.map((r, i) => (<p key={i} className="text-sm mt-1" style={{ color: '#F97316', fontFamily: HEAD }}>→ {r}</p>))}
            </Card>
            <Card className="p-6">
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#9CA3AF', fontFamily: MONO }}>Risk Register</p>
              {m.risk.spof.map((f, i) => (<p key={i} className="text-sm mb-1" style={{ color: '#374151', fontFamily: BODY }}>• {f}</p>))}
              <p className="text-sm mt-2" style={{ color: '#991B1B', fontFamily: BODY }}>{m.risk.conc}</p>
              <div className="flex flex-wrap gap-2 mt-2">{m.risk.reg.map((r, i) => (<span key={i} className="text-[10px] px-2 py-1 rounded-lg" style={{ background: r.s === 'med' ? '#FFFBEB' : '#F9FAFB', color: r.s === 'med' ? '#92400E' : '#6B7280', fontFamily: MONO }}>{r.i}</span>))}</div>
              <p className="text-sm mt-2" style={{ color: '#92400E', fontFamily: BODY }}>{m.risk.contracts}</p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-2"><span className="text-lg font-bold" style={{ color: '#92400E', fontFamily: HEAD }}>{m.blindspots.confidence}%</span><span className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Confidence</span><span className="text-xs" style={{ color: '#6B7280', fontFamily: BODY }}>{m.blindspots.detail}</span></div>
              {m.blindspots.missing.map((b, i) => (<div key={i} className="px-3 py-2 rounded-lg mb-1" style={{ background: '#FEF2F2' }}><p className="text-xs" style={{ color: '#991B1B', fontFamily: BODY }}>● {b.a} → <strong>{b.f}</strong></p></div>))}
            </Card>
          </Group>

          {/* ═══ 9. STRATEGIC CONTEXT — Collapsible Group ═══ */}
          <Group title="Strategic Context">
            <Card className="p-6">
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#9CA3AF', fontFamily: MONO }}>Alignment Check</p>
              <p className="text-sm leading-relaxed mb-3" style={{ color: '#374151', fontFamily: BODY }}>{m.alignment.text}</p>
              {m.alignment.contradictions.map((c, i) => (<div key={i} className="px-3 py-2 rounded-lg mb-2" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}><p className="text-xs" style={{ color: '#92400E', fontFamily: MONO }}>⚠ {c}</p></div>))}
            </Card>
            <Card className="p-6">
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#9CA3AF', fontFamily: MONO }}>Market Intelligence</p>
              <p className="text-sm leading-relaxed mb-3" style={{ color: '#374151', fontFamily: BODY }}>{m.market.text}</p>
              {m.market.competitors.map((c, i) => (<div key={i} className="flex items-center gap-2 mb-1"><span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: '#F3F4F6', fontFamily: MONO }}>{c.n}</span><span className="text-xs" style={{ color: '#6B7280', fontFamily: BODY }}>{c.s}</span></div>))}
              <p className="text-xs mt-2" style={{ color: '#F97316', fontFamily: MONO }}>{m.market.pricing}</p>
            </Card>
            <Card className="p-8">
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#9CA3AF', fontFamily: MONO }}>Executive Memo</p>
              <p className="text-[15px] leading-loose whitespace-pre-line" style={{ color: '#1F2937', fontFamily: BODY }}>{m.memo}</p>
            </Card>
          </Group>

          {/* Sources footer */}
          <div className="flex flex-wrap gap-2 pt-4 pb-8" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
            <span className="text-[10px]" style={{ color: '#9CA3AF', fontFamily: MONO }}>Sources:</span>
            {m.blindspots.sources.map((s, i) => (<span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#6B7280', background: 'rgba(0,0,0,0.04)', fontFamily: MONO }}>{s}</span>))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CognitiveSnapshotV2Mockup;
