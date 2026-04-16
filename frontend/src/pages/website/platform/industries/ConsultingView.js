import React from 'react';
import { Panel, MetricCard, SystemState, Inevitability, DecisionPressure, ExecMemo, HeatBar, SORA, INTER, MONO, PlatformLayout } from './IndustryComponents';

const ConsultingView = () => (
  <PlatformLayout title="Consulting / Professional Services — Executive Overview">
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h2 className="text-xl font-semibold text-[#EDF1F7] mb-1" style={{ fontFamily: SORA }}>Good morning, Andre.</h2>
        <p className="text-sm text-[#8FA0B8]" style={{ fontFamily: INTER }}>Professional Services Intelligence &middot; Last scan: 4 minutes ago</p>
      </div>

      <SystemState state="DRIFT" confidence={81} velocity="stable" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">

          {/* Utilisation Snapshot */}
          <Panel>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: SORA }}>Utilisation Snapshot</h3>
              <span className="text-xs px-2 py-0.5 rounded" style={{ fontFamily: MONO, color: '#E85D00', background: '#E85D0015' }}>Below target</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <MetricCard label="Current Rate" value="68%" sub="Target: 80%" color="#E85D00" alert />
              <MetricCard label="Revenue Impact" value="-$18,000" sub="This month" color="#E85D00" alert />
              <MetricCard label="Billable Hours" value="124" sub="of 182 available" color="#F59E0B" />
            </div>
            <h4 className="text-[10px] text-[#64748B] uppercase tracking-wider mb-2" style={{ fontFamily: MONO }}>Team Utilisation</h4>
            {[
              { name: 'Andre (Principal)', util: 92, target: 60 },
              { name: 'Sarah (Senior Consultant)', util: 78, target: 80 },
              { name: 'James (Consultant)', util: 54, target: 80 },
              { name: 'Lisa (Graduate)', util: 42, target: 75 },
            ].map(t => (
              <HeatBar key={t.name} label={t.name} value={t.util} max={100} color={t.util >= t.target ? '#10B981' : t.util >= t.target * 0.8 ? '#F59E0B' : '#E85D00'} alert={t.util < t.target * 0.8} />
            ))}
          </Panel>

          {/* Scope Creep Monitor */}
          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-4" style={{ fontFamily: SORA }}>Scope Creep Monitor</h3>
            {[
              { project: 'Project Alpha — Digital Transformation', quoted: 40, actual: 52, impact: -2400, status: 'critical' },
              { project: 'Project Beta — Process Review', quoted: 24, actual: 28, impact: -800, status: 'warning' },
              { project: 'Project Gamma — Strategy Workshop', quoted: 16, actual: 14, impact: 400, status: 'healthy' },
            ].map(p => {
              const mc = { healthy: '#10B981', warning: '#F59E0B', critical: '#E85D00' };
              return (
                <div key={p.project} className="mb-3 p-3 rounded-lg" style={{ background: 'var(--surface, #FFFFFF)', border: '1px solid rgba(140,170,210,0.15)' }}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-[#EDF1F7]" style={{ fontFamily: SORA }}>{p.project}</span>
                    <span className="text-xs" style={{ fontFamily: MONO, color: mc[p.status] }}>{p.impact > 0 ? '+' : ''}{p.impact < 0 ? '-' : ''}${Math.abs(p.impact)}</span>
                  </div>
                  <div className="flex gap-4 text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>
                    <span>Quoted: {p.quoted}hrs</span>
                    <span>Actual: {p.actual}hrs</span>
                    <span style={{ color: mc[p.status] }}>({p.actual > p.quoted ? '+' : ''}{p.actual - p.quoted}hrs)</span>
                  </div>
                </div>
              );
            })}
          </Panel>

          {/* Proposal Stall Detector */}
          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-4" style={{ fontFamily: SORA }}>Proposal Stall Detector</h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <MetricCard label="Stalled Proposals" value="3" sub="> 45 days" color="#E85D00" alert />
              <MetricCard label="Avg Close Cycle" value="32 days" color="#EDF1F7" />
              <MetricCard label="Revenue Gap Risk" value="61%" sub="Probability" color="#E85D00" alert />
            </div>
            {[
              { name: 'Zenith Corp — Audit Engagement', value: '$42,000', days: 58, stage: 'Proposal Sent' },
              { name: 'Harbour Finance — Tax Advisory', value: '$28,000', days: 51, stage: 'Pricing Discussion' },
              { name: 'Pacific Industries — Compliance', value: '$18,000', days: 47, stage: 'Decision Pending' },
            ].map(p => (
              <div key={p.name} className="flex items-center justify-between p-2.5 rounded mb-2" style={{ background: 'var(--surface, #FFFFFF)', border: '1px solid #E85D0020' }}>
                <div>
                  <span className="text-xs text-[#EDF1F7]" style={{ fontFamily: SORA }}>{p.name}</span>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>{p.stage} &middot; {p.days} days</span>
                </div>
                <span className="text-xs font-semibold text-[#EDF1F7]" style={{ fontFamily: MONO }}>{p.value}</span>
              </div>
            ))}
          </Panel>
        </div>

        <div className="space-y-4">
          <DecisionPressure score={6} />
          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: SORA }}>Active Inevitabilities</h3>
            <div className="space-y-2">
              <Inevitability title="Utilisation at 68% — $18K revenue leakage" why="James (54%) and Lisa (42%) are under-utilised. No new work assigned." impact="-$18,000 this month. -$54K if sustained through quarter." window="Assign to open projects or redeploy within 14 days" severity="high" />
              <Inevitability title="Project Alpha scope creep — 30% over quoted hours" why="Client requesting additional deliverables without change orders." impact="-$2,400 margin erosion. Pattern will repeat on Beta." window="Issue change order this week" severity="medium" />
              <Inevitability title="3 proposals stalled beyond normal cycle" why="Average close is 32 days. These are at 47-58 days. No movement." impact="$88K pipeline at risk of going cold" window="Follow up within 7 days or consider lost" severity="medium" />
            </div>
          </Panel>
          <ExecMemo memo={"Andre, your consulting firm is DRIFTING. The numbers tell a clear story.\n\nYou're at 68% utilisation against an 80% target. That's $18K in revenue you could be earning this month but aren't. James and Lisa are significantly under-utilised — either they need client work or you're overstaffed.\n\nMeanwhile, Project Alpha has 30% scope creep with no change order. This is the single most common margin killer in professional services. Issue the change order today.\n\nYour proposal pipeline has 3 deals ($88K) stalled past normal close cycle. At 61% probability of revenue gap, you need to either close these or replace them within 30 days."} />
        </div>
      </div>
    </div>
  </PlatformLayout>
);

export default ConsultingView;
