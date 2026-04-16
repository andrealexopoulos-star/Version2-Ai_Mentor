import React from 'react';
import { Panel, MetricCard, SystemState, Inevitability, DecisionPressure, ExecMemo, HeatBar, SORA, INTER, MONO, PlatformLayout } from './IndustryComponents';

const AgencyView = () => (
  <PlatformLayout title="Marketing / Digital Agency — Executive Overview">
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h2 className="text-xl font-semibold text-[#EDF1F7] mb-1" style={{ fontFamily: SORA }}>Good morning, Andre.</h2>
        <p className="text-sm text-[#8FA0B8]" style={{ fontFamily: INTER }}>Agency Intelligence &middot; Last scan: 5 minutes ago</p>
      </div>
      <SystemState state="DRIFT" confidence={77} velocity="worsening" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Retainer Stability */}
          <Panel>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: SORA }}>Retainer Stability Monitor</h3>
              <span className="text-xs px-2 py-0.5 rounded" style={{ fontFamily: MONO, color: '#E85D00', background: '#E85D0015' }}>2 at risk</span>
            </div>
            {[
              { client: 'BluePeak Ventures', monthly: '$8,500', renewal: 42, engagement: 'declining', risk: 'high' },
              { client: 'Horizon Health', monthly: '$12,000', renewal: 90, engagement: 'stable', risk: 'low' },
              { client: 'Metro Property Group', monthly: '$6,200', renewal: 18, engagement: 'declining', risk: 'high' },
              { client: 'Catalyst Finance', monthly: '$9,800', renewal: 120, engagement: 'growing', risk: 'low' },
              { client: 'Pinnacle Legal', monthly: '$4,500', renewal: 65, engagement: 'stable', risk: 'medium' },
            ].map(c => {
              const rc = { high: '#E85D00', medium: '#F59E0B', low: '#10B981' };
              return (
                <div key={c.client} className="flex items-center gap-3 p-2.5 rounded mb-2" style={{ background: 'var(--surface, #FFFFFF)', border: '1px solid rgba(140,170,210,0.15)' }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: rc[c.risk] }} />
                  <div className="flex-1">
                    <span className="text-xs text-[#EDF1F7]" style={{ fontFamily: SORA }}>{c.client}</span>
                    <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Engagement: {c.engagement} &middot; {c.renewal}d to renewal</span>
                  </div>
                  <span className="text-xs font-semibold text-[#EDF1F7]" style={{ fontFamily: MONO }}>{c.monthly}/mo</span>
                </div>
              );
            })}
            <div className="mt-3 pt-3 flex justify-between" style={{ borderTop: '1px solid rgba(140,170,210,0.15)' }}>
              <span className="text-xs text-[#64748B]" style={{ fontFamily: MONO }}>Total MRR</span>
              <span className="text-sm font-bold text-[#EDF1F7]" style={{ fontFamily: MONO }}>$41,000/mo</span>
            </div>
          </Panel>
          {/* Revenue Concentration */}
          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-4" style={{ fontFamily: SORA }}>Revenue Concentration</h3>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Top Client" value="29%" sub="Horizon Health" color="#F59E0B" />
              <MetricCard label="Top 3" value="74%" sub="$30.3K of $41K MRR" color="#E85D00" alert />
            </div>
          </Panel>
          {/* Scope Creep */}
          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-4" style={{ fontFamily: SORA }}>Scope Creep Monitor</h3>
            {[
              { client: 'BluePeak — Brand Refresh', quoted: 60, actual: 78, impact: -3600 },
              { client: 'Metro — Monthly Content', quoted: 20, actual: 26, impact: -1200 },
            ].map(p => (
              <div key={p.client} className="p-3 rounded-lg mb-2" style={{ background: 'var(--surface, #FFFFFF)', border: '1px solid rgba(140,170,210,0.15)' }}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-[#EDF1F7]" style={{ fontFamily: SORA }}>{p.client}</span>
                  <span className="text-xs text-[#E85D00]" style={{ fontFamily: MONO }}>-${Math.abs(p.impact)}</span>
                </div>
                <div className="flex gap-4 text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>
                  <span>Quoted: {p.quoted}hrs</span><span>Actual: {p.actual}hrs</span><span style={{ color: '#E85D00' }}>+{p.actual - p.quoted}hrs over</span>
                </div>
              </div>
            ))}
          </Panel>
        </div>
        <div className="space-y-4">
          <DecisionPressure score={6} />
          <Panel>
            <h3 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: SORA }}>Active Inevitabilities</h3>
            <div className="space-y-2">
              <Inevitability title="BluePeak & Metro retainers at risk — engagement declining" why="Response times up 2x. Meeting cancellations increasing. Content feedback delays." impact="-$14,700/mo if both churn ($176K annualised)" window="Re-engage within 14 days" severity="high" />
              <Inevitability title="Scope creep across 2 clients — $4,800 unbilled" why="Extra revisions and deliverables without change orders." impact="-$4,800 this month. Pattern compounds." window="Issue change orders or set boundaries this week" severity="medium" />
            </div>
          </Panel>
          <ExecMemo memo={"Andre, your agency is DRIFTING and the pattern is familiar.\n\nTwo retainers ($14.7K/mo combined) show engagement decline. BluePeak hasn't responded to the last 3 content drafts. Metro cancelled 2 of the last 3 monthly catch-ups. These are classic pre-churn signals.\n\nMeanwhile, you're doing $4,800 of unbilled work across these same clients — scope creep without change orders. You're over-delivering for clients who are already disengaging.\n\nAction: Schedule face-to-face with BluePeak and Metro this week. Present value delivered. Address scope boundaries. Better to have the hard conversation now than lose $176K in annual revenue."} />
        </div>
      </div>
    </div>
  </PlatformLayout>
);

export default AgencyView;
