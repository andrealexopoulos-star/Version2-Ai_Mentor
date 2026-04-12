import React from 'react';
import { Panel, MetricCard, SystemState, Inevitability, DecisionPressure, ExecMemo, HeatBar, SORA, INTER, MONO, PlatformLayout } from './IndustryComponents';
import { Shield, Clock, Users, AlertTriangle, TrendingDown } from 'lucide-react';

const MSPView = () => (
  <PlatformLayout title="IT Services / MSP — Executive Overview">
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h2 className="text-xl font-semibold text-[#EDF1F7] mb-1" style={{ fontFamily: SORA }}>Good morning, Andre.</h2>
        <p className="text-sm text-[#9FB0C3]" style={{ fontFamily: INTER }}>Managed Services Intelligence &middot; Last scan: 8 minutes ago</p>
      </div>

      <SystemState state="DRIFT" confidence={84} velocity="worsening" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Core Industry Panels */}
        <div className="lg:col-span-2 space-y-5">

          {/* Renewal Exposure Radar */}
          <Panel>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: SORA }}>Renewal Exposure Radar</h3>
              <span className="text-xs px-2 py-0.5 rounded" style={{ fontFamily: MONO, color: '#E85D00', background: '#E85D0015' }}>$276K at risk</span>
            </div>
            <div className="space-y-3">
              {[
                { client: 'Meridian Group', value: '$180,000', days: 74, risk: 'medium', window: '43 days' },
                { client: 'Coastal Logistics', value: '$96,000', days: 112, risk: 'low', window: '81 days' },
                { client: 'Apex Dental', value: '$54,000', days: 28, risk: 'high', window: '14 days' },
              ].map(c => {
                const rc = { high: '#E85D00', medium: '#F59E0B', low: '#10B981' };
                return (
                  <div key={c.client} className="flex items-center gap-4 p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid rgba(140,170,210,0.15)' }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: rc[c.risk], boxShadow: c.risk === 'high' ? `0 0 8px ${rc[c.risk]}50` : 'none' }} />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-[#EDF1F7] block" style={{ fontFamily: SORA }}>{c.client}</span>
                      <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>Intervention window: {c.window}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-[#EDF1F7] block" style={{ fontFamily: MONO }}>{c.value}</span>
                      <span className="text-[10px]" style={{ fontFamily: MONO, color: rc[c.risk] }}>{c.days} days</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 flex justify-between" style={{ borderTop: '1px solid rgba(140,170,210,0.15)' }}>
              <span className="text-xs text-[#64748B]" style={{ fontFamily: MONO }}>Total Revenue at Risk (90 days)</span>
              <span className="text-sm font-bold text-[#E85D00]" style={{ fontFamily: MONO }}>$276,000</span>
            </div>
          </Panel>

          {/* Revenue Concentration */}
          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-4" style={{ fontFamily: SORA }}>Revenue Concentration</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <MetricCard label="Top Client" value="34%" sub="Meridian Group" color="#E85D00" alert />
              <MetricCard label="Top 3 Clients" value="61%" sub="$496K of $812K revenue" color="#F59E0B" alert />
            </div>
            <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #E85D0020' }}>
              <span className="text-[10px] text-[#64748B] uppercase" style={{ fontFamily: MONO }}>If Top Client Lost</span>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-sm text-[#E85D00]" style={{ fontFamily: MONO }}>Revenue: -34%</span>
                <span className="text-sm text-[#E85D00]" style={{ fontFamily: MONO }}>Runway: -2.1 months</span>
              </div>
            </div>
          </Panel>

          {/* SLA Drift Detection */}
          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-4" style={{ fontFamily: SORA }}>SLA Drift Detection</h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <MetricCard label="Ticket Volume" value="+18%" sub="30-day trend" color="#F59E0B" />
              <MetricCard label="Resolution Time" value="+14%" sub="vs baseline" color="#E85D00" alert />
              <MetricCard label="Breach Probability" value="37%" sub="Next 30 days" color="#E85D00" alert />
            </div>
            <HeatBar label="Team Capacity Utilisation" value={87} max={100} color="#F59E0B" />
            <HeatBar label="Ticket Growth vs Headcount" value={118} max={150} color="#E85D00" suffix="% ratio" />
          </Panel>

          {/* Contract Margin Monitor */}
          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-4" style={{ fontFamily: SORA }}>Contract Margin Heat Map</h3>
            {[
              { client: 'Meridian Group', margin: 22, status: 'healthy' },
              { client: 'Coastal Logistics', margin: 11, status: 'warning' },
              { client: 'Apex Dental', margin: 6, status: 'critical' },
              { client: 'Summit Partners', margin: 18, status: 'healthy' },
            ].map(c => {
              const mc = { healthy: '#10B981', warning: '#F59E0B', critical: '#E85D00' };
              return <HeatBar key={c.client} label={c.client} value={c.margin} max={30} color={mc[c.status]} alert={c.status === 'critical'} />;
            })}
          </Panel>
        </div>

        {/* RIGHT: Universal Panels */}
        <div className="space-y-4">
          <DecisionPressure score={7} />

          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: SORA }}>Active Inevitabilities</h3>
            <div className="space-y-2">
              <Inevitability title="Apex Dental renewal at risk — 28 days" why="No engagement in 45 days. Last QBR was 4 months ago. Contact frequency down 60%." impact="-$54,000 annual revenue" window="14 days to intervene" severity="high" />
              <Inevitability title="SLA breach trajectory — ticket volume outpacing team" why="18% ticket growth, 0% headcount growth. Resolution times rising." impact="First SLA breach predicted within 30 days" window="Hire or redistribute within 21 days" severity="high" />
              <Inevitability title="Apex Dental contract margin at 6%" why="Contract priced in 2022. Labour costs up 12% since. Never repriced." impact="Serving at near-loss. $48K revenue, $45K cost" window="Reprice at next renewal (28 days)" severity="medium" />
            </div>
          </Panel>

          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: SORA }}>Intelligence Pulse</h3>
            <div className="grid grid-cols-2 gap-2">
              <MetricCard label="Contracts Tracked" value="12" color="#10B981" />
              <MetricCard label="Signals (30d)" value="847" color="#3B82F6" />
              <MetricCard label="Alerts" value="6" color="#E85D00" />
              <MetricCard label="Prevented" value="3" color="#10B981" />
            </div>
          </Panel>

          <ExecMemo memo={"Andre, your MSP is in DRIFT. The core issue isn't revenue — it's concentration and timing.\n\nApex Dental ($54K) renews in 28 days with zero recent engagement and a 6% margin. This is a lose-lose: if they leave, you lose revenue; if they stay, you're serving at near-cost.\n\nAction: Schedule QBR with Apex this week. Present value delivered. Propose 15% rate increase aligned to market. If they accept, margin recovers. If they leave, you free capacity for a profitable replacement.\n\nMeanwhile, ticket volume is outpacing your team by 18%. First SLA breach is 30 days away. Either hire one L1 technician or redistribute the Apex workload."} />
        </div>
      </div>
    </div>
  </PlatformLayout>
);

export default MSPView;
