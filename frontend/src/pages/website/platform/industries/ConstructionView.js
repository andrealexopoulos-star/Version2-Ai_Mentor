import React from 'react';
import { Panel, MetricCard, SystemState, Inevitability, DecisionPressure, ExecMemo, HeatBar, SORA, INTER, MONO, PlatformLayout } from './IndustryComponents';

const ConstructionView = () => (
  <PlatformLayout title="Commercial Contractors / HVAC — Executive Overview">
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h2 className="text-xl font-semibold text-[#EDF1F7] mb-1" style={{ fontFamily: SORA }}>Good morning, Andre.</h2>
        <p className="text-sm text-[#8FA0B8]" style={{ fontFamily: INTER }}>Construction & HVAC Intelligence &middot; Last scan: 6 minutes ago</p>
      </div>

      <SystemState state="COMPRESSION" confidence={79} velocity="worsening" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">

          {/* Project Margin Tracker */}
          <Panel>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: SORA }}>Project Margin Tracker</h3>
              <span className="text-xs px-2 py-0.5 rounded" style={{ fontFamily: MONO, color: '#E85D00', background: '#E85D0015' }}>2 jobs below target</span>
            </div>
            {[
              { job: 'JOB #142 — Westfield HVAC Fit-out', quoted: 15, current: 8, variance: -6200, status: 'critical' },
              { job: 'JOB #158 — Crown Casino Level 4', quoted: 18, current: 16, variance: -1800, status: 'warning' },
              { job: 'JOB #163 — Meridian Office Tower', quoted: 20, current: 22, variance: 2400, status: 'healthy' },
              { job: 'JOB #171 — Harbour City Residential', quoted: 14, current: 14, variance: 0, status: 'healthy' },
            ].map(j => {
              const mc = { healthy: '#10B981', warning: '#F59E0B', critical: '#E85D00' };
              return (
                <div key={j.job} className="mb-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-[#EDF1F7]" style={{ fontFamily: SORA }}>{j.job}</span>
                    <span className="text-xs" style={{ fontFamily: MONO, color: mc[j.status] }}>{j.variance > 0 ? '+' : ''}{j.variance < 0 ? '-' : ''}${Math.abs(j.variance).toLocaleString()}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] text-[#64748B] mb-0.5" style={{ fontFamily: MONO }}>
                        <span>Quoted: {j.quoted}%</span><span>Current: {j.current}%</span>
                      </div>
                      <div className="h-2 rounded-full" style={{ background: 'rgba(140,170,210,0.15)' }}>
                        <div className="h-2 rounded-full" style={{ width: `${(j.current / 25) * 100}%`, background: mc[j.status] }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </Panel>

          {/* Progress Claim Exposure */}
          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-4" style={{ fontFamily: SORA }}>Progress Claim Exposure</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <MetricCard label="Total Outstanding" value="$184,000" color="#F59E0B" />
              <MetricCard label="Over 30 Days" value="$62,000" color="#E85D00" alert />
            </div>
            <div className="space-y-2">
              {[
                { claim: 'Claim #14 — Westfield', amount: '$42,000', days: 38, status: 'overdue' },
                { claim: 'Claim #12 — Crown Casino', amount: '$20,000', days: 45, status: 'overdue' },
                { claim: 'Claim #18 — Harbour City', amount: '$68,000', days: 12, status: 'current' },
                { claim: 'Claim #19 — Meridian', amount: '$54,000', days: 8, status: 'current' },
              ].map(cl => (
                <div key={cl.claim} className="flex items-center justify-between p-2.5 rounded" style={{ background: 'var(--surface, #FFFFFF)', border: '1px solid rgba(140,170,210,0.15)' }}>
                  <div>
                    <span className="text-xs text-[#EDF1F7]" style={{ fontFamily: SORA }}>{cl.claim}</span>
                    <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>{cl.days} days outstanding</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold" style={{ fontFamily: MONO, color: cl.status === 'overdue' ? '#E85D00' : 'var(--ink-display, #0A0A0A)' }}>{cl.amount}</span>
                    <span className="text-[10px] block" style={{ fontFamily: MONO, color: cl.status === 'overdue' ? '#E85D00' : '#10B981' }}>{cl.status.toUpperCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Forward Work Coverage */}
          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: SORA }}>Forward Work Coverage</h3>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <span className="text-3xl font-bold text-[#F59E0B]" style={{ fontFamily: MONO }}>4.2</span>
                <span className="text-xs text-[#64748B] block" style={{ fontFamily: MONO }}>months confirmed</span>
              </div>
              <div className="flex-1">
                <HeatBar label="Confirmed" value={4.2} max={12} color="#10B981" suffix=" mo" />
                <HeatBar label="Tendered (not won)" value={2.8} max={12} color="#F59E0B" suffix=" mo" />
                <HeatBar label="Pipeline (leads)" value={1.4} max={12} color="#3B82F6" suffix=" mo" />
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <DecisionPressure score={8} />

          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: SORA }}>Active Inevitabilities</h3>
            <div className="space-y-2">
              <Inevitability title="JOB #142 margin collapse — currently at 8%" why="Subcontractor costs exceeded quote by $6,200. Two variation requests unapproved by client." impact="-$6,200 on this job. Pattern repeating on 2 other jobs." window="Approve variations within 14 days or absorb loss" severity="high" />
              <Inevitability title="$62K in progress claims overdue 30+ days" why="Westfield ($42K) and Crown ($20K) claims past due. Payroll due in 12 days." impact="Cash gap of $62K. Payroll exposure if not collected." window="Chase within 7 days" severity="high" />
              <Inevitability title="Forward work drops below 4 months in 6 weeks" why="No new tenders won in 30 days. Pipeline is thin." impact="Team idle time in Q3. Potential layoffs if no work secured." window="Submit 3+ tenders within 30 days" severity="medium" />
            </div>
          </Panel>

          <ExecMemo memo={"Andre, your contracting business is in COMPRESSION. Two forces are squeezing simultaneously.\n\n1. Margin erosion: Job #142 is at 8% vs 15% quoted. Subcontractor costs and unapproved variations are the cause. This pattern is appearing on Crown Casino too.\n\n2. Cash timing: $62K in claims are overdue while payroll hits in 12 days. This is the classic construction death spiral — profitable on paper, bankrupt on cash.\n\nImmediate action: Chase Westfield and Crown claims today. Submit variation approvals in writing. And start tendering — your forward work coverage is thinning."} />
        </div>
      </div>
    </div>
  </PlatformLayout>
);

export default ConstructionView;
