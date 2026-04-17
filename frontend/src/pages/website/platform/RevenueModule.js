import React from 'react';
import PlatformLayout from '../../../components/website/PlatformLayout';
import { TrendingUp, TrendingDown, AlertTriangle, Users, BarChart3, Toggle } from 'lucide-react';
import { fontFamily } from '../../../design-system/tokens';


const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--surface, #FFFFFF)', border: '1px solid rgba(140,170,210,0.15)' }}>{children}</div>
);

const RevenueModule = () => (
  <PlatformLayout title="Revenue">
    <div className="space-y-6 max-w-[1200px]">
      {/* Revenue Health Score */}
      <Panel>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#EDF1F7] mb-1" style={{ fontFamily: fontFamily.display }}>Revenue Health</h2>
            <p className="text-sm text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>Overall revenue position based on pipeline, concentration, and churn signals.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-3xl font-bold" style={{ fontFamily: fontFamily.mono, color: '#F59E0B' }}>67%</span>
              <span className="block text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>MODERATE RISK</span>
            </div>
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ border: '3px solid #F59E0B', background: '#F59E0B' + '10' }}>
              <TrendingDown className="w-6 h-6 text-[#F59E0B]" />
            </div>
          </div>
        </div>
      </Panel>

      {/* Three Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Pipeline Stability */}
        <Panel>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-[#3B82F6]" />
            <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Pipeline Stability</h3>
          </div>
          <div className="space-y-3 mb-4">
            <div className="flex justify-between"><span className="text-xs text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>Total Pipeline</span><span className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>$185,000</span></div>
            <div className="flex justify-between"><span className="text-xs text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>Weighted Value</span><span className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>$74,000</span></div>
            <div className="flex justify-between"><span className="text-xs text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>Active Deals</span><span className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>8</span></div>
            <div className="flex justify-between"><span className="text-xs text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>Stalled (&gt;7d)</span><span className="text-sm font-semibold" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>3</span></div>
          </div>
          <div className="pt-3" style={{ borderTop: '1px solid rgba(140,170,210,0.15)' }}>
            <p className="text-xs text-[#8FA0B8] mb-2" style={{ fontFamily: fontFamily.body }}><strong className="text-[#EDF1F7]">Insight:</strong> 3 deals stalled at proposal stage. Close rate declining.</p>
            <p className="text-xs text-[#8FA0B8] mb-2" style={{ fontFamily: fontFamily.body }}><strong className="text-[#EDF1F7]">Why it matters:</strong> $45K revenue gap opens in Q2 if unresolved.</p>
            <p className="text-xs text-[#8FA0B8] mb-3" style={{ fontFamily: fontFamily.body }}><strong className="text-[#EDF1F7]">What to do:</strong> Review pricing on stalled proposals. Send follow-up to Deal Beta.</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Auto-follow-up</span>
              <div onClick={() => window.location.assign('/login-supabase')} className="w-8 h-4 rounded-full cursor-pointer" style={{ background: '#E85D00' }}><div className="w-3.5 h-3.5 rounded-full bg-white ml-auto mr-0.5 mt-[1px]" /></div>
            </div>
          </div>
        </Panel>

        {/* Revenue Concentration */}
        <Panel>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-[#E85D00]" />
            <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Revenue Concentration</h3>
          </div>
          <div className="space-y-3 mb-4">
            <div className="flex justify-between"><span className="text-xs text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>Entropy Level</span><span className="text-sm font-semibold" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>HIGH</span></div>
            <div className="flex justify-between"><span className="text-xs text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>Top 2 Deals</span><span className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>60%</span></div>
          </div>
          {/* Deal bars */}
          <div className="space-y-2 mb-4">
            {[{ name: 'Deal Alpha', val: 45, prob: 65 }, { name: 'Deal Beta', val: 28, prob: 40 }, { name: 'Deal Gamma', val: 15, prob: 80 }].map(d => (
              <div key={d.name}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>{d.name}</span>
                  <span style={{ fontFamily: fontFamily.mono, color: d.prob < 50 ? '#E85D00' : '#10B981' }}>${d.val}K &middot; {d.prob}%</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'rgba(140,170,210,0.15)' }}>
                  <div className="h-1.5 rounded-full" style={{ width: d.prob + '%', background: d.prob < 50 ? '#E85D00' : '#10B981' }} />
                </div>
              </div>
            ))}
          </div>
          <div className="pt-3" style={{ borderTop: '1px solid rgba(140,170,210,0.15)' }}>
            <p className="text-xs text-[#8FA0B8] mb-2" style={{ fontFamily: fontFamily.body }}><strong className="text-[#EDF1F7]">Insight:</strong> 60% of pipeline sits in 2 deals. High dependency risk.</p>
            <p className="text-xs text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}><strong className="text-[#EDF1F7]">What to do:</strong> Diversify outbound. Focus 40% effort on new pipeline generation.</p>
          </div>
        </Panel>

        {/* Churn Probability */}
        <Panel>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-[#F59E0B]" />
            <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>Churn Probability</h3>
          </div>
          <div className="space-y-3 mb-4">
            <div className="flex justify-between"><span className="text-xs text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>At-Risk Clients</span><span className="text-sm font-semibold" style={{ fontFamily: fontFamily.mono, color: '#F59E0B' }}>2</span></div>
            <div className="flex justify-between"><span className="text-xs text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>Revenue at Risk</span><span className="text-sm font-semibold" style={{ fontFamily: fontFamily.mono, color: '#F59E0B' }}>$18,400</span></div>
          </div>
          {/* Client risk items */}
          <div className="space-y-2 mb-4">
            {[{ name: 'Key Account #1', signal: 'Response time elevated. Engagement declining over 30 days.', risk: 'HIGH' },
              { name: 'Client F', signal: 'Contract renewal in 45 days. No renewal discussion initiated.', risk: 'MODERATE' }].map(c => (
              <div key={c.name} className="p-3 rounded-md" style={{ background: 'var(--surface, #FFFFFF)', border: '1px solid rgba(140,170,210,0.15)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>{c.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ fontFamily: fontFamily.mono, color: c.risk === 'HIGH' ? '#E85D00' : '#F59E0B', background: (c.risk === 'HIGH' ? '#E85D00' : '#F59E0B') + '15' }}>{c.risk}</span>
                </div>
                <p className="text-[11px] text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>{c.signal}</p>
              </div>
            ))}
          </div>
          <div className="pt-3" style={{ borderTop: '1px solid rgba(140,170,210,0.15)' }}>
            <p className="text-xs text-[#8FA0B8] mb-2" style={{ fontFamily: fontFamily.body }}><strong className="text-[#EDF1F7]">What to do:</strong> Draft re-engagement email for at-risk accounts. Schedule renewal calls.</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Auto-re-engage</span>
              <div onClick={() => window.location.assign('/login-supabase')} className="w-8 h-4 rounded-full cursor-pointer" style={{ background: 'rgba(140,170,210,0.15)' }}><div className="w-3.5 h-3.5 rounded-full bg-[#8FA0B8] ml-0.5 mt-[1px]" /></div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  </PlatformLayout>
);

export default RevenueModule;
