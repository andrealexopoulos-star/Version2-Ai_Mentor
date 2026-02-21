import React from 'react';
import DashboardLayout from '../components/DashboardLayout';

const HEAD = "var(--font-heading)";
const MONO = "var(--font-mono)";
const BODY = "var(--font-body)";

// Mock cognitive v2 data
const mock = {
  system_state: { status: "DRIFT", confidence: 78, interpretation: "Cash stable but operations drifting. Founder capacity stretched beyond safe threshold.", velocity: "worsening", velocity_detail: "Moved from STABLE to DRIFT in 8 days. No recovery action taken.", burn_rate_overlay: "At current spend, 4.2 months runway. Stable." },
  founder_vitals: { capacity_index: 112, capacity_status: "overloaded", email_stress_signals: "Response latency up 40% vs 30-day average. 3 emails flagged with stressed tone.", calendar_compression: "42 meetings this week vs 28 average. 6 back-to-back blocks.", decision_fatigue_risk: "high", pending_decisions: 14, recommendation: "Block 2 hours Friday for decision clearing. Cancel or delegate 3 lowest-value meetings." },
  decision_forcing: { decision_required: "Should you hire a junior operations person or invest in automation tools?", options: [{ option: "Hire junior ops (PT $35K/yr)", risk: "medium", capital_impact: "-$3K/mo", timeline_impact: "8 weeks to relief", upside: "Human judgment. Scalable.", downside: "Fixed cost. Management overhead." }, { option: "Invest in automation ($500/mo)", risk: "low", capital_impact: "-$500/mo", timeline_impact: "2 weeks to relief", upside: "Immediate. No management.", downside: "Cannot handle edge cases." }, { option: "Do nothing for 30 days", risk: "medium", capital_impact: "$0", timeline_impact: "No change", upside: "Preserves cash. More data.", downside: "Burnout accelerates. SLAs worsen." }], recommendation: "Option B (automation) as immediate action. Revisit hiring in 60 days after Deal A resolved.", deadline: "Decide by end of this week" },
  inevitabilities: [{ domain: "Revenue", signal: "Three enterprise deals stalled at proposal stage with pricing objection. Close rate compression predicts $45K revenue gap in Q2.", intensity: "accelerating", probability: 75, financial_impact: { low: 15000, high: 45000 }, intervention_window: "12 days", owner: "Sales / Founder", if_ignored: "Q2 revenue target missed by 20-30%. Cash runway drops to 2.8 months." }, { domain: "Operations", signal: "Task completion rate down 8%. Two SLA breaches active. Proposal bottleneck at pricing sign-off.", intensity: "forming", probability: 60, financial_impact: { low: 5000, high: 12000 }, intervention_window: "3 weeks", owner: "Operations Lead", if_ignored: "Client satisfaction decline. Risk of losing Client B contract renewal." }],
  capital_allocation: { cash_runway_months: 4.2, margin_trend: "compressing", margin_detail: "Margins compressed 3% over 60 days due to rising subcontractor costs.", scenario_30d: { best: "Revenue up 8% if Deal Alpha closes. Runway extends to 5.1 months.", base: "Revenue flat. Runway 4.2 months. No immediate risk.", worst: "Deal Alpha lost + Client B churns. Runway drops to 2.8 months." }, spend_efficiency: "Marketing spend returning $4.20 per $1 invested (above benchmark). Maintain.", hiring_affordability: "Can absorb 1 FTE at current margin. Not recommended until Deal Alpha resolved.", alerts: [{ type: "margin_compression", detail: "Subcontractor costs up 12% in 45 days", severity: "medium" }] },
  execution_governance: { sla_breaches: 2, sla_detail: "Project Alpha deliverable (3 days late), Invoice #1847 (7 days overdue).", task_aging_index: 14, bottleneck: "Proposal generation — 3 proposals stalled awaiting pricing sign-off.", velocity_trend: "Task completion rate down 8% vs 30-day average.", resource_load: { founder: 112, operations: 78, sales: 45 }, recommendations: ["Delegate pricing authority for proposals under $5,000", "Automate invoice follow-up for amounts under $2,000"] },
  revenue_forecast: { pipeline_total: 185000, weighted_forecast: 74000, pipeline_entropy: "medium", entropy_detail: "60% of pipeline value concentrated in 2 deals. High concentration risk.", deals: [{ deal: "Deal Alpha", value: 45000, probability: 65, stall_days: 0 }, { deal: "Deal Beta", value: 28000, probability: 40, stall_days: 12 }, { deal: "Deal Gamma", value: 15000, probability: 80, stall_days: 0 }], churn_signals: [{ client: "Client B", risk: "medium", signal: "Response time increased 3x over 30 days" }] },
  priority_compression: { primary_focus: "Close Deal Alpha pricing sign-off", primary_hours: "~6 hrs this week", secondary_focus: "Fix SLA breach on Project Alpha deliverable", secondary_hours: "~2 hrs", delegate_to: "Operations manager", noise_to_ignore: "Social media rebrand discussion — defer to next month" },
  opportunity_decay: { decaying: "Deal Beta ($28K) — client has gone quiet after proposal. Competitor X known to be in conversation.", value: 28000, velocity: "3-5 days before lost", competitive_risk: "Competitor X actively pursuing this segment with aggressive pricing.", recovery_action: "Direct founder call to decision-maker. Offer flexible payment terms." },
  resource_reallocation: { triggered_by: "Operations DRIFT + Founder at 112% capacity", recommendations: [{ action: "Move $2K/mo from paid ads to automation tooling", rationale: "Ads returning diminishing. Automation solves the bottleneck.", impact: "Frees ~8 hrs/week founder time" }, { action: "Kill Deal Delta proposal", rationale: "12 days stalled. Client unresponsive. Opportunity cost too high.", impact: "Recovers 6 hrs sales effort" }, { action: "Raise Service B hourly rate by 15%", rationale: "Margin compression on this service. Below market rate.", impact: "+$800/mo margin, minimal churn risk" }] },
  risk_compliance: { single_points_of_failure: ["All client relationships depend on founder — no backup contact", "Accounting runs through 1 Xero login with no redundancy"], vendor_concentration: "85% of revenue from 3 clients (threshold: max 40%)", regulatory: [{ item: "BAS Q3 due in 18 days", severity: "medium" }, { item: "Workers comp renewal in 45 days", severity: "low" }], contract_exposure: "2 contracts expire within 60 days. No renewal discussion started." },
  strategic_alignment: { narrative: "Your stated goal is 20% revenue growth this year. However, data shows zero new outbound activities in 14 days and no SOP documented for your top 3 revenue-generating processes. The gap between ambition and execution is widening.", kpi_contradictions: ["Goal: grow revenue 20%. Reality: 0 new outbound activities in 14 days.", "Goal: improve operations. Reality: no SOP documented for top 3 processes."] },
  market_position: { narrative: "The Australian consulting market remains competitive with increasing AI adoption among mid-tier firms. Your positioning as a sovereign intelligence partner is differentiated but under-communicated.", competitors: [{ name: "Competitor A", signal: "Launched new pricing page this week" }, { name: "Competitor B", signal: "Hiring 2 sales roles (LinkedIn)" }], pricing_benchmark: "Your pricing is 15% below market average for this service category.", sentiment: "Neutral. No significant brand mentions detected this week." },
  executive_memo: "Andre, your business is at an inflection point. Deal Alpha ($45K) is your Q2 anchor — if it closes, runway extends to 5 months and you can consider the ops hire. If it doesn't, you're looking at 2.8 months runway and need to cut non-essential spend immediately.\n\nThe deeper issue isn't revenue — it's capacity. You're running at 112% with 14 pending decisions and 42 meetings this week. The SLA breaches and proposal bottleneck are symptoms of a founder who's become the single point of failure. The automation vs hire decision isn't really about cost — it's about which one gives you back decision-making bandwidth fastest.\n\nMy recommendation: Deploy $500/mo in automation tools this week (invoice follow-up, proposal templates, scheduling). This buys you 8 hours immediately. Use those hours to close Deal Alpha personally. Revisit the hire conversation in 60 days with better data.",
  blind_spots: { no_data: [{ area: "HR / Payroll", detail: "No HR tool connected. Team metrics, overtime, absence patterns unavailable.", fix: "Connect BambooHR or similar" }], stale_data: [{ area: "Email", detail: "Last sync 6 hours ago. Recent signals current.", freshness: "fresh" }], confidence_score: 72, confidence_detail: "72% — Strong on CRM and email data. Limited by missing HR/payroll connection." },
  sources: ["business_profile", "calibration_persona", "strategy_profile", "emails (25)", "HubSpot CRM (42 contacts, 8 deals)", "Xero (12 invoices)", "signals (18)", "Perplexity (market intel)"],
};

const ST_CFG = { STABLE: { label: 'Stable', color: '#166534', bg: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E' }, DRIFT: { label: 'Drift', color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B' }, COMPRESSION: { label: 'Compression', color: '#9A3412', bg: '#FFF7ED', border: '#FED7AA', dot: '#F97316' }, CRITICAL: { label: 'Critical', color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', dot: '#EF4444' } };

const VEL_ICON = { improving: '↗', stable: '→', worsening: '↘' };

const Section = ({ label, children, testId }) => (
  <section className="mb-8" data-testid={testId}>
    <h2 className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#9CA3AF', fontFamily: MONO }}>{label}</h2>
    {children}
  </section>
);

const Card = ({ children, bg, border, className = '' }) => (
  <div className={`rounded-2xl ${className}`} style={{ background: bg || 'rgba(255,255,255,0.85)', border: `1px solid ${border || 'rgba(0,0,0,0.06)'}`, backdropFilter: 'blur(12px)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
    {children}
  </div>
);

const CognitiveSnapshotV2Mockup = () => {
  const s = mock;
  const st = ST_CFG[s.system_state.status] || ST_CFG.STABLE;

  return (
    <DashboardLayout>
      <div className="min-h-[calc(100vh-56px)]" style={{ background: '#FAFAF8', fontFamily: HEAD }}>

        {/* 1. HEADER BAR */}
        <div className="sticky top-14 z-30" style={{ background: st.bg, borderBottom: `1px solid ${st.border}` }}>
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: st.dot }} />
              <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: st.color, fontFamily: MONO }}>{st.label}</span>
              <span className="text-[11px] font-medium" style={{ color: st.color }}>{VEL_ICON[s.system_state.velocity]} {s.system_state.velocity}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ color: st.color, background: `${st.color}15`, fontFamily: MONO }}>Confidence: {s.system_state.confidence}%</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ color: '#6B7280', background: 'rgba(0,0,0,0.04)', fontFamily: MONO }}>Runway: {s.capital_allocation.cash_runway_months}mo</span>
            </div>
          </div>
          <div className="max-w-4xl mx-auto px-6 pb-2">
            <p className="text-[12px]" style={{ color: st.color, fontFamily: BODY }}>{s.system_state.interpretation}</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
          <h1 className="text-3xl font-semibold" style={{ color: '#111827', fontFamily: HEAD }}>Good morning, Andre.</h1>

          {/* 2. DECISION FORCING */}
          <Section label="Decision Required" testId="decision-forcing">
            <Card bg="#0F172A" border="rgba(249,115,22,0.3)" className="p-7">
              <div className="flex items-center justify-between mb-4">
                <p className="text-lg font-bold text-white" style={{ fontFamily: HEAD }}>{s.decision_forcing.decision_required}</p>
                <span className="text-[10px] px-3 py-1 rounded-full font-semibold" style={{ background: '#F97316', color: 'white', fontFamily: MONO }}>{s.decision_forcing.deadline}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                {s.decision_forcing.options.map((o, i) => (
                  <div key={i} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <p className="text-sm font-semibold text-white mb-2" style={{ fontFamily: HEAD }}>{o.option}</p>
                    <div className="space-y-1 text-[11px]" style={{ fontFamily: MONO }}>
                      <p style={{ color: o.risk === 'low' ? '#4ADE80' : '#FCD34D' }}>Risk: {o.risk}</p>
                      <p style={{ color: '#94A3B8' }}>Capital: {o.capital_impact}</p>
                      <p style={{ color: '#94A3B8' }}>Timeline: {o.timeline_impact}</p>
                    </div>
                    <p className="text-[11px] text-emerald-400 mt-2">↑ {o.upside}</p>
                    <p className="text-[11px] text-red-400">↓ {o.downside}</p>
                  </div>
                ))}
              </div>
              <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <p className="text-sm font-medium" style={{ color: '#F97316', fontFamily: HEAD }}>BIQc Recommends: {s.decision_forcing.recommendation}</p>
              </div>
            </Card>
          </Section>

          {/* 3. FOUNDER VITALS */}
          <Section label="Founder Vitals" testId="founder-vitals">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: s.founder_vitals.capacity_index > 100 ? '#EF4444' : '#22C55E', fontFamily: MONO }}>Capacity: {s.founder_vitals.capacity_index}%</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#FEF2F2', color: '#991B1B', fontFamily: MONO }}>Fatigue risk: {s.founder_vitals.decision_fatigue_risk}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#9CA3AF', fontFamily: MONO }}>Calendar</p><p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}>{s.founder_vitals.calendar_compression}</p></div>
                <div><p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#9CA3AF', fontFamily: MONO }}>Pending Decisions</p><p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}>{s.founder_vitals.pending_decisions} open (threshold: 8)</p></div>
              </div>
              <p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}>{s.founder_vitals.email_stress_signals}</p>
              <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <p className="text-sm font-medium" style={{ color: '#F97316', fontFamily: HEAD }}>→ {s.founder_vitals.recommendation}</p>
              </div>
            </Card>
          </Section>

          {/* 4. INEVITABILITIES */}
          <Section label="Active Inevitabilities" testId="inevitabilities">
            <div className="space-y-3">
              {s.inevitabilities.map((inv, i) => {
                const ic = inv.intensity === 'imminent' ? { color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' } : inv.intensity === 'accelerating' ? { color: '#F97316', bg: '#FFF7ED', border: '#FED7AA' } : { color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' };
                return (
                  <div key={i} className="p-6 rounded-2xl" style={{ background: ic.bg, border: `1px solid ${ic.border}` }}>
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: ic.color, fontFamily: MONO }}>{inv.domain}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: ic.color, background: `${ic.color}15`, fontFamily: MONO }}>{inv.intensity}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: ic.color, background: `${ic.color}10`, fontFamily: MONO }}>{inv.probability}% probability</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#991B1B', background: '#FEF2F2', fontFamily: MONO }}>${(inv.financial_impact.low/1000).toFixed(0)}K–${(inv.financial_impact.high/1000).toFixed(0)}K impact</span>
                      </div>
                      <span className="text-[10px] font-medium" style={{ color: ic.color, fontFamily: MONO }}>Window: {inv.intervention_window} · Owner: {inv.owner}</span>
                    </div>
                    <p className="text-[15px] leading-relaxed font-medium" style={{ color: '#1F2937' }}>{inv.signal}</p>
                    <p className="text-sm mt-2 leading-relaxed" style={{ color: '#7F1D1D' }}>If ignored: {inv.if_ignored}</p>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* 5. CAPITAL ALLOCATION */}
          <Section label="Capital Position" testId="capital-allocation">
            <Card className="p-6">
              <div className="flex items-center gap-4 mb-4 flex-wrap">
                <div className="flex items-center gap-2"><span className="text-2xl font-bold" style={{ color: '#F97316', fontFamily: HEAD }}>{s.capital_allocation.cash_runway_months}</span><span className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>months runway</span></div>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#FFFBEB', color: '#92400E', fontFamily: MONO }}>Margins: {s.capital_allocation.margin_trend} (-3%)</span>
              </div>
              <p className="text-sm mb-4" style={{ color: '#6B7280', fontFamily: BODY }}>{s.capital_allocation.margin_detail}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                {[{ label: 'Best', text: s.capital_allocation.scenario_30d.best, color: '#166534', bg: '#F0FDF4' }, { label: 'Base', text: s.capital_allocation.scenario_30d.base, color: '#6B7280', bg: '#F9FAFB' }, { label: 'Worst', text: s.capital_allocation.scenario_30d.worst, color: '#991B1B', bg: '#FEF2F2' }].map((sc, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: sc.bg }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: sc.color, fontFamily: MONO }}>30-Day {sc.label}</p>
                    <p className="text-xs leading-relaxed" style={{ color: sc.color, fontFamily: BODY }}>{sc.text}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}>{s.capital_allocation.spend_efficiency}</p>
              <p className="text-sm mt-1" style={{ color: '#374151', fontFamily: BODY }}>{s.capital_allocation.hiring_affordability}</p>
              {s.capital_allocation.alerts.map((a, i) => (
                <div key={i} className="mt-3 px-3 py-2 rounded-lg" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                  <p className="text-xs" style={{ color: '#92400E', fontFamily: MONO }}>⚠ {a.detail}</p>
                </div>
              ))}
            </Card>
          </Section>

          {/* 6. EXECUTION GOVERNANCE */}
          <Section label="Execution Status" testId="execution-governance">
            <Card className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div><p className="text-2xl font-bold" style={{ color: '#EF4444', fontFamily: HEAD }}>{s.execution_governance.sla_breaches}</p><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>SLA Breaches</p></div>
                <div><p className="text-2xl font-bold" style={{ color: s.execution_governance.task_aging_index > 10 ? '#F59E0B' : '#22C55E', fontFamily: HEAD }}>{s.execution_governance.task_aging_index}%</p><p className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Task Aging</p></div>
                <div className="col-span-2"><p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#9CA3AF', fontFamily: MONO }}>Bottleneck</p><p className="text-sm" style={{ color: '#374151', fontFamily: BODY }}>{s.execution_governance.bottleneck}</p></div>
              </div>
              <div className="mb-4"><p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#9CA3AF', fontFamily: MONO }}>Resource Load</p>
                <div className="flex gap-4">
                  {Object.entries(s.execution_governance.resource_load).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-xs capitalize" style={{ color: '#6B7280', fontFamily: BODY }}>{k}</span>
                      <div className="w-24 h-2 rounded-full" style={{ background: '#F3F4F6' }}><div className="h-full rounded-full" style={{ width: `${Math.min(v, 100)}%`, background: v > 100 ? '#EF4444' : v > 80 ? '#F59E0B' : '#22C55E' }} /></div>
                      <span className="text-[10px] font-semibold" style={{ color: v > 100 ? '#EF4444' : '#6B7280', fontFamily: MONO }}>{v}%</span>
                    </div>
                  ))}
                </div>
              </div>
              {s.execution_governance.recommendations.map((r, i) => (<p key={i} className="text-sm mt-1" style={{ color: '#F97316', fontFamily: HEAD }}>→ {r}</p>))}
            </Card>
          </Section>

          {/* 7. REVENUE FORECAST */}
          <Section label="Revenue Pipeline" testId="revenue-forecast">
            <Card className="p-6">
              <div className="flex items-center gap-4 mb-4 flex-wrap">
                <div><span className="text-2xl font-bold" style={{ color: '#111827', fontFamily: HEAD }}>${(s.revenue_forecast.pipeline_total/1000).toFixed(0)}K</span><span className="text-[10px] ml-1 uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Pipeline</span></div>
                <div><span className="text-2xl font-bold" style={{ color: '#F97316', fontFamily: HEAD }}>${(s.revenue_forecast.weighted_forecast/1000).toFixed(0)}K</span><span className="text-[10px] ml-1 uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Weighted</span></div>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#FFFBEB', color: '#92400E', fontFamily: MONO }}>Entropy: {s.revenue_forecast.pipeline_entropy}</span>
              </div>
              <p className="text-xs mb-4" style={{ color: '#6B7280', fontFamily: BODY }}>{s.revenue_forecast.entropy_detail}</p>
              <div className="space-y-2 mb-4">
                {s.revenue_forecast.deals.map((d, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm w-28 truncate" style={{ color: '#374151', fontFamily: HEAD }}>{d.deal}</span>
                    <span className="text-xs w-16 text-right" style={{ color: '#6B7280', fontFamily: MONO }}>${(d.value/1000).toFixed(0)}K</span>
                    <span className="text-xs w-10 text-right font-semibold" style={{ color: d.probability >= 70 ? '#166534' : d.probability >= 50 ? '#92400E' : '#991B1B', fontFamily: MONO }}>{d.probability}%</span>
                    <div className="flex-1 h-2 rounded-full" style={{ background: '#F3F4F6' }}><div className="h-full rounded-full" style={{ width: `${d.probability}%`, background: d.probability >= 70 ? '#22C55E' : d.probability >= 50 ? '#F59E0B' : '#EF4444' }} /></div>
                    {d.stall_days > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#FEF2F2', color: '#991B1B', fontFamily: MONO }}>{d.stall_days}d stalled</span>}
                  </div>
                ))}
              </div>
              {s.revenue_forecast.churn_signals.map((c, i) => (<div key={i} className="px-3 py-2 rounded-lg" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}><p className="text-xs" style={{ color: '#991B1B', fontFamily: MONO }}>Churn risk: {c.client} — {c.signal}</p></div>))}
            </Card>
          </Section>

          {/* 8. RESOURCE REALLOCATION */}
          <Section label="Resource Reallocation" testId="resource-reallocation">
            <Card className="p-6">
              <p className="text-[10px] uppercase tracking-widest mb-4" style={{ color: '#9CA3AF', fontFamily: MONO }}>Triggered by: {s.resource_reallocation.triggered_by}</p>
              <div className="space-y-3">
                {s.resource_reallocation.recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 pb-3" style={{ borderBottom: i < s.resource_reallocation.recommendations.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                    <span className="text-sm font-bold w-6 shrink-0" style={{ color: '#F97316', fontFamily: HEAD }}>{i+1}.</span>
                    <div><p className="text-sm font-medium" style={{ color: '#1F2937', fontFamily: HEAD }}>{r.action}</p><p className="text-xs mt-0.5" style={{ color: '#6B7280', fontFamily: BODY }}>{r.rationale}</p><p className="text-xs mt-0.5 font-medium" style={{ color: '#059669', fontFamily: MONO }}>Impact: {r.impact}</p></div>
                  </div>
                ))}
              </div>
            </Card>
          </Section>

          {/* 9. PRIORITY COMPRESSION */}
          <Section label="This Week" testId="priority-compression">
            <Card className="p-7">
              <div className="mb-4"><span className="text-[10px] font-semibold tracking-widest uppercase block mb-1" style={{ color: '#111827', fontFamily: MONO }}>Primary Focus</span><p className="text-[15px] leading-relaxed font-medium" style={{ color: '#1F2937' }}>{s.priority_compression.primary_focus}</p><p className="text-xs mt-1" style={{ color: '#F97316', fontFamily: MONO }}>{s.priority_compression.primary_hours}</p></div>
              <div className="mb-4 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}><span className="text-[10px] font-semibold tracking-widest uppercase block mb-1" style={{ color: '#6B7280', fontFamily: MONO }}>Secondary</span><p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{s.priority_compression.secondary_focus}</p><p className="text-xs mt-1" style={{ color: '#6B7280', fontFamily: MONO }}>{s.priority_compression.secondary_hours} · Delegate to: {s.priority_compression.delegate_to}</p></div>
              <div className="pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}><span className="text-[10px] font-semibold tracking-widest uppercase block mb-1" style={{ color: '#9CA3AF', fontFamily: MONO }}>Noise — Ignore</span><p className="text-sm leading-relaxed" style={{ color: '#9CA3AF' }}>{s.priority_compression.noise_to_ignore}</p></div>
            </Card>
          </Section>

          {/* 10. OPPORTUNITY DECAY */}
          <Section label="Opportunity Decay" testId="opportunity-decay">
            <div className="p-6 rounded-2xl" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
              <div className="flex items-center gap-3 mb-2"><span className="text-lg font-bold" style={{ color: '#991B1B', fontFamily: HEAD }}>${(s.opportunity_decay.value/1000).toFixed(0)}K at risk</span><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#991B1B', background: '#FEE2E2', fontFamily: MONO }}>{s.opportunity_decay.velocity}</span></div>
              <p className="text-[15px] leading-relaxed font-medium" style={{ color: '#7F1D1D' }}>{s.opportunity_decay.decaying}</p>
              <p className="text-sm mt-2" style={{ color: '#991B1B', fontFamily: BODY }}>Competitive risk: {s.opportunity_decay.competitive_risk}</p>
              <p className="text-sm mt-2 font-medium" style={{ color: '#374151' }}>→ {s.opportunity_decay.recovery_action}</p>
            </div>
          </Section>

          {/* 11. RISK & COMPLIANCE */}
          <Section label="Risk Register" testId="risk-compliance">
            <Card className="p-6">
              <div className="mb-4"><p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#9CA3AF', fontFamily: MONO }}>Single Points of Failure</p>{s.risk_compliance.single_points_of_failure.map((f, i) => (<p key={i} className="text-sm mb-1" style={{ color: '#374151', fontFamily: BODY }}>• {f}</p>))}</div>
              <div className="mb-4 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}><p className="text-sm" style={{ color: '#991B1B', fontFamily: BODY }}>Revenue Concentration: {s.risk_compliance.vendor_concentration}</p></div>
              <div className="flex flex-wrap gap-2 mb-3">{s.risk_compliance.regulatory.map((r, i) => (<span key={i} className="text-[10px] px-2 py-1 rounded-lg" style={{ background: r.severity === 'medium' ? '#FFFBEB' : '#F9FAFB', color: r.severity === 'medium' ? '#92400E' : '#6B7280', fontFamily: MONO }}>{r.item}</span>))}</div>
              <p className="text-sm" style={{ color: '#92400E', fontFamily: BODY }}>{s.risk_compliance.contract_exposure}</p>
            </Card>
          </Section>

          {/* 12. STRATEGIC ALIGNMENT */}
          <Section label="Strategic Alignment" testId="strategic-alignment">
            <Card className="p-6">
              <p className="text-sm leading-relaxed mb-4" style={{ color: '#374151', fontFamily: BODY }}>{s.strategic_alignment.narrative}</p>
              <div className="space-y-2">{s.strategic_alignment.kpi_contradictions.map((c, i) => (<div key={i} className="px-3 py-2 rounded-lg" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}><p className="text-xs" style={{ color: '#92400E', fontFamily: MONO }}>⚠ {c}</p></div>))}</div>
            </Card>
          </Section>

          {/* 13. MARKET POSITION */}
          <Section label="Market Intelligence" testId="market-position">
            <Card className="p-6">
              <p className="text-sm leading-relaxed mb-4" style={{ color: '#374151', fontFamily: BODY }}>{s.market_position.narrative}</p>
              <div className="space-y-2 mb-3">{s.market_position.competitors.map((c, i) => (<div key={i} className="flex items-center gap-2"><span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: '#F3F4F6', color: '#374151', fontFamily: MONO }}>{c.name}</span><span className="text-xs" style={{ color: '#6B7280', fontFamily: BODY }}>{c.signal}</span></div>))}</div>
              <p className="text-xs" style={{ color: '#F97316', fontFamily: MONO }}>{s.market_position.pricing_benchmark}</p>
            </Card>
          </Section>

          {/* 14. EXECUTIVE MEMO */}
          <Section label="Executive Memo" testId="executive-memo">
            <Card className="p-8"><p className="text-[15px] leading-loose whitespace-pre-line" style={{ color: '#1F2937', fontFamily: BODY }}>{s.executive_memo}</p></Card>
          </Section>

          {/* 15. BLIND SPOTS */}
          <Section label="Blind Spots" testId="blind-spots">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-lg font-bold" style={{ color: s.blind_spots.confidence_score >= 80 ? '#166534' : s.blind_spots.confidence_score >= 60 ? '#92400E' : '#991B1B', fontFamily: HEAD }}>{s.blind_spots.confidence_score}%</span>
                <span className="text-[10px] uppercase tracking-widest" style={{ color: '#9CA3AF', fontFamily: MONO }}>Overall Confidence</span>
                <span className="text-xs" style={{ color: '#6B7280', fontFamily: BODY }}>{s.blind_spots.confidence_detail}</span>
              </div>
              <div className="space-y-2 mb-3">{s.blind_spots.no_data.map((b, i) => (<div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: '#FEF2F2' }}><span className="text-xs shrink-0" style={{ color: '#991B1B' }}>●</span><span className="text-xs" style={{ color: '#991B1B', fontFamily: BODY }}>{b.area}: {b.detail} → <strong>{b.fix}</strong></span></div>))}</div>
              <div className="flex flex-wrap items-center gap-2 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <span className="text-[10px] font-medium" style={{ color: '#9CA3AF', fontFamily: MONO }}>Sources:</span>
                {s.sources.map((src, i) => (<span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#6B7280', background: 'rgba(0,0,0,0.04)', fontFamily: MONO }}>{src}</span>))}
              </div>
            </Card>
          </Section>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CognitiveSnapshotV2Mockup;
