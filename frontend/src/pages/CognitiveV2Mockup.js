import React, { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Mail, MessageSquare, Users, XCircle, Send, Clock, FileText, ChevronDown, ChevronUp } from 'lucide-react';

const HEAD = "var(--font-heading)";
const MONO = "var(--font-mono)";
const BODY = "var(--font-body)";

/* ═══ ACTION BUTTONS — The Resolution Center ═══ */
const ActionBtn = ({ icon: Icon, label, color, onClick }) => (
  <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:-translate-y-0.5" style={{ background: `${color}12`, color, border: `1px solid ${color}30`, fontFamily: MONO }} data-testid={`action-${label.toLowerCase().replace(/\s/g,'-')}`}>
    <Icon className="w-3.5 h-3.5" />{label}
  </button>
);

const AutoEmail = ({ context }) => <ActionBtn icon={Mail} label="Auto-Email" color="#2563EB" onClick={() => alert(`AI will draft and send a professional email re: ${context}`)} />;
const QuickSMS = ({ context }) => <ActionBtn icon={MessageSquare} label="Quick-SMS" color="#059669" onClick={() => alert(`AI will send an SMS re: ${context}`)} />;
const HandOff = ({ context }) => <ActionBtn icon={Users} label="Hand Off" color="#F97316" onClick={() => alert(`AI will assign this to a team member: ${context}`)} />;
const Dismiss = ({ context }) => <ActionBtn icon={XCircle} label="Dismiss & Learn" color="#6B7280" onClick={() => alert(`Dismissed. AI will learn to suppress similar: ${context}`)} />;

/* ═══ MOCK DATA ═══ */
const mock = {
  system_state: { status: "DRIFT", confidence: 78, interpretation: "Cash stable but operations drifting. Founder capacity stretched beyond safe threshold.", velocity: "worsening", burn_rate: "4.2 months runway" },
  weekly_brief: { actions_taken: 14, cashflow_recovered: 4200, hours_saved: 8.5, tasks_handled: 22, leads_assigned: 5, leads_actioned: 3, sop_compliance: 97, sop_fixes: 2 },
  resolution_queue: [
    { id: 1, type: "late_payment", severity: "high", title: "Client #47 — Invoice $3,200 overdue 12 days", detail: "AI has drafted a professional payment reminder. Tone: firm but polite. Follow-up scheduled in 3 days if no response.", actions: ["auto-email", "quick-sms", "hand-off", "dismiss"] },
    { id: 2, type: "budget_alert", severity: "medium", title: "Overtime 15% above target this week", detail: "3 team members logged 48+ hours. AI recommends redistributing Monday's workload and blocking overtime for non-critical tasks.", actions: ["hand-off", "dismiss"] },
    { id: 3, type: "sop_breach", severity: "high", title: "3 new leads not contacted in 24 hours", detail: "SOP requires contact within 4 hours. AI can send personalised intro emails to all 3 leads immediately, logged to CRM.", actions: ["auto-email", "hand-off", "dismiss"] },
    { id: 4, type: "profit_win", severity: "low", title: "Supplier price dropped 10% — restock opportunity", detail: "Supplier ABC reduced pricing on your top 3 products. AI can generate a purchase order and send for your approval.", actions: ["auto-email", "hand-off", "dismiss"] },
    { id: 5, type: "churn_risk", severity: "high", title: "Client B — response time up 3x, engagement declining", detail: "AI detected declining communication over 30 days. A personal check-in call is recommended. AI can draft a warm re-engagement email.", actions: ["auto-email", "quick-sms", "hand-off", "dismiss"] },
  ],
  founder_vitals: { capacity_index: 112, calendar: "42 meetings (avg 28)", decisions: 14, fatigue: "high", email_stress: "Response latency up 40%. 3 stressed-tone emails.", recommendation: "Block 2 hours Friday for decision clearing. Cancel 3 lowest-value meetings." },
  inevitabilities: [
    { domain: "Revenue", signal: "Three enterprise deals stalled at proposal stage. Close rate compression predicts $45K gap in Q2.", intensity: "accelerating", probability: 75, impact: "$15K–$45K", window: "12 days", owner: "Sales / Founder", if_ignored: "Q2 target missed 20-30%. Runway drops to 2.8 months.", actions: ["auto-email", "hand-off"] },
    { domain: "Operations", signal: "Task completion down 8%. Two SLA breaches. Proposal bottleneck at pricing sign-off.", intensity: "forming", probability: 60, impact: "$5K–$12K", window: "3 weeks", owner: "Operations", if_ignored: "Client satisfaction decline. Contract renewal risk.", actions: ["hand-off", "dismiss"] },
  ],
  capital: { runway: 4.2, margin: "compressing (-3%)", best: "Deal Alpha closes → 5.1mo runway", base: "Flat → 4.2mo", worst: "Deal Alpha + Client B lost → 2.8mo", spend: "Marketing $4.20 per $1 (above benchmark)", alert: "Subcontractor costs up 12% in 45 days" },
  execution: { sla_breaches: 2, sla_detail: "Project Alpha (3 days late), Invoice #1847 (7 days overdue)", task_aging: 14, bottleneck: "3 proposals stalled — pricing sign-off", load: { Founder: 112, Operations: 78, Sales: 45 }, recs: ["Delegate pricing authority under $5K", "Automate invoice follow-up under $2K"] },
  revenue: { pipeline: 185000, weighted: 74000, entropy: "60% in 2 deals — high concentration", deals: [{ name: "Deal Alpha", value: 45, prob: 65, stall: 0 }, { name: "Deal Beta", value: 28, prob: 40, stall: 12 }, { name: "Deal Gamma", value: 15, prob: 80, stall: 0 }], churn: "Client B — response time 3x slower over 30 days" },
  reallocation: [{ action: "Move $2K/mo ads → automation", impact: "Frees 8 hrs/week" }, { action: "Kill Deal Delta proposal", impact: "Recovers 6 hrs sales" }, { action: "Raise Service B rate +15%", impact: "+$800/mo margin" }],
  priority: { primary: "Close Deal Alpha pricing sign-off", primary_hrs: "~6 hrs", secondary: "Fix SLA on Project Alpha", secondary_hrs: "~2 hrs", delegate: "Operations manager", noise: "Social media rebrand — defer" },
  risk: { spof: ["All client relationships on founder", "1 Xero login, no redundancy"], concentration: "85% revenue from 3 clients (max 40%)", regulatory: [{ item: "BAS Q3 due 18 days", sev: "med" }, { item: "Workers comp renewal 45 days", sev: "low" }], contracts: "2 expire within 60 days, no renewal started" },
  alignment: { narrative: "Goal: 20% revenue growth. Reality: 0 outbound activities in 14 days. The gap between ambition and execution is widening.", contradictions: ["Revenue target 20% vs 0 outbound in 14 days", "Improve ops vs no SOPs for top 3 processes"] },
  market: { narrative: "Australian consulting market competitive. Your sovereign positioning is differentiated but under-communicated.", competitors: [{ name: "Competitor A", signal: "New pricing page" }, { name: "Competitor B", signal: "Hiring 2 sales (LinkedIn)" }], pricing: "15% below market average" },
  memo: "Andre, your business is at an inflection point. Deal Alpha ($45K) is your Q2 anchor — if it closes, runway extends to 5 months. If it doesn't, you're looking at 2.8 months and need to cut non-essential spend immediately.\n\nThe deeper issue isn't revenue — it's capacity. You're at 112% with 14 pending decisions and 42 meetings. The SLA breaches and proposal bottleneck are symptoms of a founder who's become the single point of failure.\n\nMy recommendation: Deploy $500/mo in automation tools this week. This buys you 8 hours immediately. Use those hours to close Deal Alpha personally. Revisit hiring in 60 days.",
  blind_spots: { confidence: 72, detail: "Strong on CRM + email. Missing HR/payroll.", missing: [{ area: "HR / Payroll", fix: "Connect BambooHR" }], sources: ["business_profile", "calibration", "emails (25)", "HubSpot CRM (42 contacts, 8 deals)", "Xero (12 invoices)", "signals (18)", "Perplexity (market)"] },
};

const ST = { STABLE: { color: '#166534', bg: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E' }, DRIFT: { color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B' }, COMPRESSION: { color: '#9A3412', bg: '#FFF7ED', border: '#FED7AA', dot: '#F97316' }, CRITICAL: { color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', dot: '#EF4444' } };
const INT = { forming: { color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' }, accelerating: { color: '#F97316', bg: '#FFF7ED', border: '#FED7AA' }, imminent: { color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' } };

const Section = ({ label, children, id }) => (<section className="mb-8" data-testid={id}><h2 className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#9CA3AF', fontFamily: MONO }}>{label}</h2>{children}</section>);
const Card = ({ children, bg, border, className = '' }) => (<div className={`rounded-2xl ${className}`} style={{ background: bg || 'rgba(255,255,255,0.85)', border: `1px solid ${border || 'rgba(0,0,0,0.06)'}`, backdropFilter: 'blur(12px)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>{children}</div>);
const ActionBar = ({ actions, context }) => (<div className="flex flex-wrap gap-2 mt-3">{actions.includes("auto-email") && <AutoEmail context={context} />}{actions.includes("quick-sms") && <QuickSMS context={context} />}{actions.includes("hand-off") && <HandOff context={context} />}{actions.includes("dismiss") && <Dismiss context={context} />}</div>);

const SEV_STYLE = { high: { bg: '#FEF2F2', border: '#FECACA', dot: '#EF4444' }, medium: { bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B' }, low: { bg: '#F0FDF4', border: '#BBF7D0', dot: '#059669' } };

const CognitiveSnapshotV2Mockup = () => {
  const s = mock;
  const st = ST[s.system_state.status];
  const [briefOpen, setBriefOpen] = useState(false);

  return (
    <DashboardLayout>
      <div className="min-h-[calc(100vh-56px)]" style={{ background: '#FAFAF8', fontFamily: HEAD }}>

        {/* HEADER */}
        <div className="sticky top-14 z-30" style={{ background: st.bg, borderBottom: `1px solid ${st.border}` }}>
          <div className="max-w-4xl mx-auto px-6 py-2.5 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: st.dot }} />
              <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: st.color, fontFamily: MONO }}>{s.system_state.status}</span>
              <span className="text-[11px]" style={{ color: st.color }}>↘ {s.system_state.velocity}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: st.color, background: `${st.color}15`, fontFamily: MONO }}>{s.system_state.confidence}% confidence</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#6B7280', background: 'rgba(0,0,0,0.04)', fontFamily: MONO }}>Runway: {s.capital.runway}mo</span>
            </div>
          </div>
          <div className="max-w-4xl mx-auto px-6 pb-2"><p className="text-[12px]" style={{ color: st.color, fontFamily: BODY }}>{s.system_state.interpretation}</p></div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
          <h1 className="text-3xl font-semibold" style={{ color: '#111827', fontFamily: HEAD }}>Good morning, Andre.</h1>

          {/* WEEKLY EXECUTIVE BRIEF */}
          <Section label="Weekly Executive Brief — Proof of Work" id="weekly-brief">
            <Card className="p-0 overflow-hidden">
              <button onClick={() => setBriefOpen(!briefOpen)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-6">
                  <div className="text-left"><span className="text-2xl font-bold" style={{ color: '#F97316', fontFamily: HEAD }}>${s.weekly_brief.cashflow_recovered.toLocaleString()}</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Cash Recovered</p></div>
                  <div className="text-left"><span className="text-2xl font-bold" style={{ color: '#059669', fontFamily: HEAD }}>{s.weekly_brief.hours_saved}h</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Time Saved</p></div>
                  <div className="text-left"><span className="text-2xl font-bold" style={{ color: '#2563EB', fontFamily: HEAD }}>{s.weekly_brief.actions_taken}</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Actions Taken</p></div>
                  <div className="text-left"><span className="text-2xl font-bold" style={{ color: '#7C3AED', fontFamily: HEAD }}>{s.weekly_brief.sop_compliance}%</span><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>SOP Compliance</p></div>
                </div>
                {briefOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>
              {briefOpen && (
                <div className="px-6 pb-5 pt-2 space-y-2" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  <p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}><strong style={{ color: '#F97316' }}>Actions Taken:</strong> This week, I sent {s.weekly_brief.actions_taken} late-payment emails, recovering ${s.weekly_brief.cashflow_recovered.toLocaleString()} in cashflow.</p>
                  <p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}><strong style={{ color: '#059669' }}>Time Reclaimed:</strong> I handled {s.weekly_brief.tasks_handled} routine admin tasks, saving you {s.weekly_brief.hours_saved} hours of work.</p>
                  <p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}><strong style={{ color: '#2563EB' }}>Team Performance:</strong> I assigned {s.weekly_brief.leads_assigned} high-value leads to your sales team; {s.weekly_brief.leads_actioned} were actioned within 2 hours.</p>
                  <p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}><strong style={{ color: '#7C3AED' }}>SOP Compliance:</strong> {s.weekly_brief.sop_compliance}% of core processes followed, with {s.weekly_brief.sop_fixes} automated fixes for skipped steps.</p>
                </div>
              )}
            </Card>
          </Section>

          {/* RESOLUTION CENTER */}
          <Section label="Resolution Center — One-Click Actions" id="resolution-center">
            <div className="space-y-3">
              {s.resolution_queue.map((item) => {
                const sev = SEV_STYLE[item.severity];
                return (
                  <div key={item.id} className="rounded-2xl p-5" style={{ background: sev.bg, border: `1px solid ${sev.border}` }}>
                    <div className="flex items-start gap-3">
                      <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: sev.dot }} />
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: '#1F2937', fontFamily: HEAD }}>{item.title}</p>
                        <p className="text-xs mt-1 leading-relaxed" style={{ color: '#6B7280', fontFamily: BODY }}>{item.detail}</p>
                        <ActionBar actions={item.actions} context={item.title} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* FOUNDER VITALS */}
          <Section label="Founder Vitals" id="founder-vitals">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#EF4444', fontFamily: MONO }}>Capacity: {s.founder_vitals.capacity_index}%</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#FEF2F2', color: '#991B1B', fontFamily: MONO }}>Fatigue: {s.founder_vitals.fatigue}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div><p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#9CA3AF', fontFamily: MONO }}>Calendar</p><p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}>{s.founder_vitals.calendar}</p></div>
                <div><p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#9CA3AF', fontFamily: MONO }}>Pending Decisions</p><p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}>{s.founder_vitals.decisions} open (threshold: 8)</p></div>
              </div>
              <p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}>{s.founder_vitals.email_stress}</p>
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <p className="text-sm font-medium" style={{ color: '#F97316', fontFamily: HEAD }}>→ {s.founder_vitals.recommendation}</p>
              </div>
            </Card>
          </Section>

          {/* INEVITABILITIES */}
          <Section label="Active Inevitabilities" id="inevitabilities">
            <div className="space-y-3">
              {s.inevitabilities.map((inv, i) => {
                const ic = INT[inv.intensity];
                return (
                  <div key={i} className="p-5 rounded-2xl" style={{ background: ic.bg, border: `1px solid ${ic.border}` }}>
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: ic.color, fontFamily: MONO }}>{inv.domain}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: ic.color, background: `${ic.color}15`, fontFamily: MONO }}>{inv.intensity} · {inv.probability}%</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#991B1B', background: '#FEF2F2', fontFamily: MONO }}>{inv.impact}</span>
                      </div>
                      <span className="text-[10px]" style={{ color: ic.color, fontFamily: MONO }}>Window: {inv.window} · Owner: {inv.owner}</span>
                    </div>
                    <p className="text-[15px] leading-relaxed font-medium" style={{ color: '#1F2937' }}>{inv.signal}</p>
                    <p className="text-sm mt-1" style={{ color: '#7F1D1D' }}>If ignored: {inv.if_ignored}</p>
                    <ActionBar actions={inv.actions} context={inv.signal} />
                  </div>
                );
              })}
            </div>
          </Section>

          {/* CAPITAL */}
          <Section label="Capital Position" id="capital">
            <Card className="p-6">
              <div className="flex items-center gap-4 mb-4 flex-wrap">
                <div><span className="text-2xl font-bold" style={{ color: '#F97316', fontFamily: HEAD }}>{s.capital.runway}</span><span className="text-[10px] ml-1 uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>months runway</span></div>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#FFFBEB', color: '#92400E', fontFamily: MONO }}>Margins: {s.capital.margin}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[{ l: 'Best', t: s.capital.best, c: '#166534', bg: '#F0FDF4' }, { l: 'Base', t: s.capital.base, c: '#6B7280', bg: '#F9FAFB' }, { l: 'Worst', t: s.capital.worst, c: '#991B1B', bg: '#FEF2F2' }].map((sc, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: sc.bg }}><p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: sc.c, fontFamily: MONO }}>30d {sc.l}</p><p className="text-xs leading-relaxed" style={{ color: sc.c, fontFamily: BODY }}>{sc.t}</p></div>
                ))}
              </div>
              <p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}>{s.capital.spend}</p>
              <div className="mt-3 px-3 py-2 rounded-lg" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}><p className="text-xs" style={{ color: '#92400E', fontFamily: MONO }}>⚠ {s.capital.alert}</p></div>
            </Card>
          </Section>

          {/* EXECUTION */}
          <Section label="Execution Status" id="execution">
            <Card className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div><p className="text-2xl font-bold" style={{ color: '#EF4444', fontFamily: HEAD }}>{s.execution.sla_breaches}</p><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>SLA Breaches</p></div>
                <div><p className="text-2xl font-bold" style={{ color: '#F59E0B', fontFamily: HEAD }}>{s.execution.task_aging}%</p><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Task Aging</p></div>
                <div className="col-span-2"><p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#9CA3AF', fontFamily: MONO }}>Bottleneck</p><p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}>{s.execution.bottleneck}</p></div>
              </div>
              <div className="mb-4"><p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#9CA3AF', fontFamily: MONO }}>Resource Load</p>
                <div className="flex gap-4">{Object.entries(s.execution.load).map(([k, v]) => (<div key={k} className="flex items-center gap-2"><span className="text-xs" style={{ color: '#6B7280', fontFamily: BODY }}>{k}</span><div className="w-24 h-2 rounded-full" style={{ background: '#F3F4F6' }}><div className="h-full rounded-full" style={{ width: `${Math.min(v, 100)}%`, background: v > 100 ? '#EF4444' : v > 80 ? '#F59E0B' : '#22C55E' }} /></div><span className="text-[10px] font-semibold" style={{ color: v > 100 ? '#EF4444' : '#6B7280', fontFamily: MONO }}>{v}%</span></div>))}</div>
              </div>
              {s.execution.recs.map((r, i) => (<p key={i} className="text-sm mt-1" style={{ color: '#F97316', fontFamily: HEAD }}>→ {r}</p>))}
            </Card>
          </Section>

          {/* REVENUE */}
          <Section label="Revenue Pipeline" id="revenue">
            <Card className="p-6">
              <div className="flex items-center gap-4 mb-4 flex-wrap">
                <div><span className="text-2xl font-bold" style={{ color: '#111827', fontFamily: HEAD }}>${(s.revenue.pipeline/1000)}K</span><span className="text-[10px] ml-1" style={{ color: '#9CA3AF', fontFamily: MONO }}>Pipeline</span></div>
                <div><span className="text-2xl font-bold" style={{ color: '#F97316', fontFamily: HEAD }}>${(s.revenue.weighted/1000)}K</span><span className="text-[10px] ml-1" style={{ color: '#9CA3AF', fontFamily: MONO }}>Weighted</span></div>
              </div>
              <p className="text-xs mb-4" style={{ color: '#6B7280', fontFamily: BODY }}>{s.revenue.entropy}</p>
              <div className="space-y-2 mb-4">{s.revenue.deals.map((d, i) => (<div key={i} className="flex items-center gap-3"><span className="text-sm w-28 truncate" style={{ fontFamily: HEAD }}>{d.name}</span><span className="text-xs w-12 text-right" style={{ fontFamily: MONO }}>${d.value}K</span><span className="text-xs w-10 text-right font-semibold" style={{ color: d.prob >= 70 ? '#166534' : d.prob >= 50 ? '#92400E' : '#991B1B', fontFamily: MONO }}>{d.prob}%</span><div className="flex-1 h-2 rounded-full" style={{ background: '#F3F4F6' }}><div className="h-full rounded-full" style={{ width: `${d.prob}%`, background: d.prob >= 70 ? '#22C55E' : d.prob >= 50 ? '#F59E0B' : '#EF4444' }} /></div>{d.stall > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#FEF2F2', color: '#991B1B', fontFamily: MONO }}>{d.stall}d stalled</span>}</div>))}</div>
              <div className="px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}><p className="text-xs" style={{ color: '#991B1B', fontFamily: MONO }}>Churn risk: {s.revenue.churn}</p></div>
              <ActionBar actions={["auto-email", "quick-sms", "hand-off"]} context="Deal follow-up" />
            </Card>
          </Section>

          {/* PRIORITY */}
          <Section label="This Week" id="priority">
            <Card className="p-6">
              <div className="mb-3"><span className="text-[10px] font-semibold tracking-widest uppercase block mb-1" style={{ color: '#111827', fontFamily: MONO }}>Primary</span><p className="text-[15px] font-medium" style={{ color: '#1F2937' }}>{s.priority.primary}</p><p className="text-xs mt-1" style={{ color: '#F97316', fontFamily: MONO }}>{s.priority.primary_hrs}</p></div>
              <div className="mb-3 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}><span className="text-[10px] font-semibold tracking-widest uppercase block mb-1" style={{ color: '#6B7280', fontFamily: MONO }}>Secondary</span><p className="text-sm" style={{ color: '#374151' }}>{s.priority.secondary}</p><p className="text-xs mt-1" style={{ color: '#6B7280', fontFamily: MONO }}>{s.priority.secondary_hrs} · Delegate: {s.priority.delegate}</p></div>
              <div className="pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}><span className="text-[10px] font-semibold tracking-widest uppercase block mb-1" style={{ color: '#9CA3AF', fontFamily: MONO }}>Noise — Ignore</span><p className="text-sm" style={{ color: '#9CA3AF' }}>{s.priority.noise}</p></div>
            </Card>
          </Section>

          {/* RISK */}
          <Section label="Risk Register" id="risk">
            <Card className="p-6">
              <div className="mb-3"><p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#9CA3AF', fontFamily: MONO }}>Single Points of Failure</p>{s.risk.spof.map((f, i) => (<p key={i} className="text-sm mb-1" style={{ color: '#374151', fontFamily: BODY }}>• {f}</p>))}</div>
              <p className="text-sm mb-3" style={{ color: '#991B1B', fontFamily: BODY }}>Revenue Concentration: {s.risk.concentration}</p>
              <div className="flex flex-wrap gap-2 mb-3">{s.risk.regulatory.map((r, i) => (<span key={i} className="text-[10px] px-2 py-1 rounded-lg" style={{ background: r.sev === 'med' ? '#FFFBEB' : '#F9FAFB', color: r.sev === 'med' ? '#92400E' : '#6B7280', fontFamily: MONO }}>{r.item}</span>))}</div>
              <p className="text-sm" style={{ color: '#92400E', fontFamily: BODY }}>{s.risk.contracts}</p>
            </Card>
          </Section>

          {/* ALIGNMENT */}
          <Section label="Strategic Alignment" id="alignment">
            <Card className="p-6">
              <p className="text-sm leading-relaxed mb-3" style={{ color: '#374151', fontFamily: BODY }}>{s.alignment.narrative}</p>
              {s.alignment.contradictions.map((c, i) => (<div key={i} className="px-3 py-2 rounded-lg mb-2" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}><p className="text-xs" style={{ color: '#92400E', fontFamily: MONO }}>⚠ {c}</p></div>))}
            </Card>
          </Section>

          {/* MEMO */}
          <Section label="Executive Memo" id="memo">
            <Card className="p-8"><p className="text-[15px] leading-loose whitespace-pre-line" style={{ color: '#1F2937', fontFamily: BODY }}>{s.memo}</p></Card>
          </Section>

          {/* BLIND SPOTS */}
          <Section label="Blind Spots" id="blind-spots">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-3"><span className="text-lg font-bold" style={{ color: '#92400E', fontFamily: HEAD }}>{s.blind_spots.confidence}%</span><span className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Confidence</span><span className="text-xs" style={{ color: '#6B7280', fontFamily: BODY }}>{s.blind_spots.detail}</span></div>
              {s.blind_spots.missing.map((b, i) => (<div key={i} className="px-3 py-2 rounded-lg mb-2" style={{ background: '#FEF2F2' }}><p className="text-xs" style={{ color: '#991B1B', fontFamily: BODY }}>● {b.area}: → <strong>{b.fix}</strong></p></div>))}
              <div className="flex flex-wrap gap-2 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}><span className="text-[10px]" style={{ color: '#9CA3AF', fontFamily: MONO }}>Sources:</span>{s.blind_spots.sources.map((src, i) => (<span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#6B7280', background: 'rgba(0,0,0,0.04)', fontFamily: MONO }}>{src}</span>))}</div>
            </Card>
          </Section>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CognitiveSnapshotV2Mockup;
