import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { TrendingUp, TrendingDown, AlertTriangle, Users, BarChart3, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const SORA = "'Cormorant Garamond', Georgia, serif";
const INTER = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const MiniChart = ({ data, color }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - min) / range) * 80}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" className="w-full h-12" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const RevenuePage = () => (
  <DashboardLayout>
    <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: INTER }} data-testid="revenue-page">
      <div>
        <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: SORA }}>Revenue Intelligence</h1>
        <p className="text-sm text-[#9FB0C3]">Pipeline health, deal velocity, and churn signals.</p>
      </div>

      {/* Revenue Health */}
      <Panel>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Revenue Health Score</h2>
            <p className="text-sm text-[#9FB0C3]">Based on pipeline stability, concentration risk, and churn signals.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-3xl font-bold" style={{ fontFamily: MONO, color: '#F59E0B' }}>67%</span>
              <span className="block text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>MODERATE RISK</span>
            </div>
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ border: '3px solid #F59E0B', background: '#F59E0B10' }}>
              <TrendingDown className="w-5 h-5 text-[#F59E0B]" />
            </div>
          </div>
        </div>
      </Panel>

      {/* Three Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-[#3B82F6]" />
            <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Pipeline Stability</h3>
          </div>
          <div className="space-y-3 mb-4">
            {[['Total Pipeline', '$185,000'], ['Weighted Value', '$74,000'], ['Active Deals', '8']].map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="text-xs text-[#9FB0C3]">{k}</span><span className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{v}</span></div>
            ))}
            <div className="flex justify-between"><span className="text-xs text-[#9FB0C3]">Stalled (&gt;7d)</span><span className="text-sm font-semibold" style={{ fontFamily: MONO, color: '#FF6A00' }}>3</span></div>
          </div>
          <div className="pt-3" style={{ borderTop: '1px solid #243140' }}>
            <p className="text-xs text-[#9FB0C3]"><strong className="text-[#F4F7FA]">Insight:</strong> 3 deals stalled at proposal stage. Close rate declining — consider revised pricing strategy.</p>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-[#FF6A00]" />
            <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Revenue Concentration</h3>
          </div>
          <div className="space-y-3 mb-4">
            {[['Top Client Revenue', '38%', '#FF6A00'], ['Top 3 Clients', '62%', '#F59E0B'], ['Client Count', '14', '#10B981']].map(([k, v, c]) => (
              <div key={k}>
                <div className="flex justify-between mb-1"><span className="text-xs text-[#9FB0C3]">{k}</span><span className="text-sm font-semibold" style={{ fontFamily: MONO, color: c }}>{v}</span></div>
                {k !== 'Client Count' && <div className="h-1.5 rounded-full" style={{ background: c + '20' }}><div className="h-1.5 rounded-full" style={{ background: c, width: v }} /></div>}
              </div>
            ))}
          </div>
          <div className="pt-3" style={{ borderTop: '1px solid #243140' }}>
            <p className="text-xs text-[#9FB0C3]"><strong className="text-[#FF6A00]">Warning:</strong> Top client represents 38% of revenue. High concentration risk — diversification needed.</p>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
            <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Churn Signals</h3>
          </div>
          <div className="space-y-3">
            {[
              { client: 'Client B', signal: 'Response time 3x slower', risk: 'High', color: '#EF4444' },
              { client: 'Client D', signal: 'Usage down 45%', risk: 'Medium', color: '#F59E0B' },
              { client: 'Client F', signal: 'Invoice dispute pending', risk: 'Medium', color: '#F59E0B' },
            ].map((c) => (
              <div key={c.client} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                <div className="flex-1">
                  <span className="text-xs font-semibold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{c.client}</span>
                  <p className="text-[11px] text-[#64748B]">{c.signal}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: c.color, background: c.color + '15', fontFamily: MONO }}>{c.risk}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Revenue Trend */}
      <Panel>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Monthly Revenue Trend</h3>
          <div className="flex items-center gap-1"><ArrowUpRight className="w-3.5 h-3.5 text-[#10B981]" /><span className="text-xs text-[#10B981]" style={{ fontFamily: MONO }}>+8.3% MoM</span></div>
        </div>
        <MiniChart data={[32, 35, 33, 38, 36, 42, 40, 45, 43, 48, 46, 52]} color="#10B981" />
        <div className="flex justify-between mt-2">
          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => (
            <span key={m} className="text-[9px] text-[#64748B]" style={{ fontFamily: MONO }}>{m}</span>
          ))}
        </div>
      </Panel>

      {/* Deal Velocity */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Avg Close Time', value: '18 days', trend: '-2d', up: true },
          { label: 'Win Rate', value: '34%', trend: '-5%', up: false },
          { label: 'Lead → Proposal', value: '4.2 days', trend: '-0.8d', up: true },
          { label: 'MRR Growth', value: '$2,400', trend: '+$400', up: true },
        ].map(m => (
          <Panel key={m.label}>
            <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>{m.label}</span>
            <span className="text-xl font-bold text-[#F4F7FA] block" style={{ fontFamily: MONO }}>{m.value}</span>
            <div className="flex items-center gap-1 mt-1">
              {m.up ? <ArrowUpRight className="w-3 h-3 text-[#10B981]" /> : <ArrowDownRight className="w-3 h-3 text-[#EF4444]" />}
              <span className="text-[10px]" style={{ color: m.up ? '#10B981' : '#EF4444', fontFamily: MONO }}>{m.trend}</span>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  </DashboardLayout>
);

export default RevenuePage;
