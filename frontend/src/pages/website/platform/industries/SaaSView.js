import React from 'react';
import { Panel, MetricCard, SystemState, Inevitability, DecisionPressure, ExecMemo, HeatBar, SORA, INTER, MONO, PlatformLayout } from './IndustryComponents';

const SaaSView = () => (
  <PlatformLayout title="B2B SaaS — Executive Overview">
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h2 className="text-xl font-semibold text-[#EDF1F7] mb-1" style={{ fontFamily: SORA }}>Good morning, Andre.</h2>
        <p className="text-sm text-[#9FB0C3]" style={{ fontFamily: INTER }}>SaaS Intelligence &middot; Last scan: 3 minutes ago</p>
      </div>
      <SystemState state="DRIFT" confidence={82} velocity="stable" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Churn Cohort Risk */}
          <Panel>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: SORA }}>Churn Cohort Risk Snapshot</h3>
              <span className="text-xs px-2 py-0.5 rounded" style={{ fontFamily: MONO, color: '#E85D00', background: '#E85D0015' }}>$8.2K MRR at risk</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <MetricCard label="Monthly Churn" value="4.2%" sub="Target: <3%" color="#E85D00" alert />
              <MetricCard label="At-Risk Accounts" value="6" sub="of 84 total" color="#F59E0B" />
              <MetricCard label="MRR at Risk" value="$8,200" sub="$98.4K annualised" color="#E85D00" alert />
            </div>
            <h4 className="text-[10px] text-[#64748B] uppercase tracking-wider mb-2" style={{ fontFamily: MONO }}>At-Risk Accounts</h4>
            {[
              { name: 'Nexus Corp', mrr: '$2,400', usage: -42, signal: 'Login frequency down 60%. No feature adoption in 30 days.', risk: 'high' },
              { name: 'Evergreen Ltd', mrr: '$1,800', usage: -28, signal: 'Support tickets up 3x. Frustration signals detected.', risk: 'high' },
              { name: 'Clearview Ops', mrr: '$1,200', usage: -15, signal: 'Only 2 of 8 seats active. Low adoption.', risk: 'medium' },
            ].map(a => (
              <div key={a.name} className="p-3 rounded-lg mb-2" style={{ background: '#0F1720', border: '1px solid rgba(140,170,210,0.15)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[#EDF1F7]" style={{ fontFamily: SORA }}>{a.name}</span>
                  <span className="text-xs" style={{ fontFamily: MONO, color: a.risk === 'high' ? '#E85D00' : '#F59E0B' }}>{a.mrr}/mo</span>
                </div>
                <p className="text-[11px] text-[#9FB0C3]" style={{ fontFamily: INTER }}>{a.signal}</p>
                <span className="text-[10px]" style={{ fontFamily: MONO, color: '#E85D00' }}>Usage: {a.usage}% (30d)</span>
              </div>
            ))}
          </Panel>

          {/* Pipeline Velocity */}
          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-4" style={{ fontFamily: SORA }}>Pipeline Velocity Monitor</h3>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <MetricCard label="Active Deals" value="14" color="#EDF1F7" />
              <MetricCard label="Win Rate" value="22%" sub="Target: 28%" color="#F59E0B" />
              <MetricCard label="Avg Cycle" value="38d" sub="Up from 31d" color="#E85D00" alert />
              <MetricCard label="Pipeline Value" value="$42K" sub="MRR" color="#EDF1F7" />
            </div>
            <HeatBar label="Demo → Trial" value={45} max={100} color="#3B82F6" />
            <HeatBar label="Trial → Close" value={22} max={100} color="#E85D00" />
            <HeatBar label="30-Day Pipeline Coverage" value={68} max={100} color="#F59E0B" />
          </Panel>

          {/* ARR & Runway */}
          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-4" style={{ fontFamily: SORA }}>Cash Runway & ARR Projection</h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <MetricCard label="Current ARR" value="$1.14M" color="#EDF1F7" />
              <MetricCard label="MRR" value="$95K" color="#EDF1F7" />
              <MetricCard label="Cash Runway" value="8.4mo" sub="At current burn" color="#F59E0B" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded" style={{ background: '#10B98110', border: '1px solid #10B98120' }}>
                <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Best Case</span>
                <span className="text-xs text-[#10B981]" style={{ fontFamily: MONO }}>12.1mo runway</span>
                <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: INTER }}>Win rate recovers + churn drops</span>
              </div>
              <div className="p-3 rounded" style={{ background: '#F59E0B10', border: '1px solid #F59E0B20' }}>
                <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Base Case</span>
                <span className="text-xs text-[#F59E0B]" style={{ fontFamily: MONO }}>8.4mo runway</span>
                <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: INTER }}>Current trajectory</span>
              </div>
              <div className="p-3 rounded" style={{ background: '#E85D0010', border: '1px solid #E85D0020' }}>
                <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Worst Case</span>
                <span className="text-xs text-[#E85D00]" style={{ fontFamily: MONO }}>5.8mo runway</span>
                <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: INTER }}>Churn accelerates + pipeline stalls</span>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <DecisionPressure score={7} />
          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: SORA }}>Active Inevitabilities</h3>
            <div className="space-y-2">
              <Inevitability title="Churn rate at 4.2% — above 3% target" why="6 accounts showing usage decline. Nexus Corp hasn't logged in for 14 days." impact="-$8.2K MRR ($98.4K ARR). Runway drops 1.4 months." window="Intervene with at-risk accounts within 7 days" severity="high" />
              <Inevitability title="Sales cycle lengthening — 38d vs 31d average" why="Trial-to-close conversion dropped to 22%. Pricing objections increasing." impact="Pipeline velocity declining. Q2 revenue gap opening." window="Review pricing and trial experience within 14 days" severity="medium" />
              <Inevitability title="CAC trending upward — acquisition cost rising" why="Paid channels declining in efficiency. Organic not compensating." impact="Unit economics deteriorating. LTV:CAC approaching 2:1" window="Rebalance channels within 30 days" severity="medium" />
            </div>
          </Panel>
          <ExecMemo memo={"Andre, your SaaS business is DRIFTING and the metrics are telling a consistent story.\n\nChurn is above target at 4.2%. Six accounts representing $8.2K MRR are showing disengagement signals. Nexus Corp ($2.4K MRR) hasn't logged in for 2 weeks — that's a strong churn predictor.\n\nYour sales cycle has stretched from 31 to 38 days, and trial-to-close is at 22% vs 28% target. The pipeline has volume but velocity is dropping.\n\nThe math: if churn continues and pipeline doesn't accelerate, your runway compresses from 8.4 to 5.8 months.\n\nImmediate action: Personal outreach to Nexus and Evergreen this week. Review your trial onboarding — something is breaking between demo and adoption. And audit your paid channels — CAC is drifting upward."} />
        </div>
      </div>
    </div>
  </PlatformLayout>
);

export default SaaSView;
