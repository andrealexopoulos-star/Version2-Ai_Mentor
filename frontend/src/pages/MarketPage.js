import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { Radar, TrendingUp, TrendingDown, Users, Globe, ArrowUpRight, Target, Loader2 } from 'lucide-react';

const SORA = "'Cormorant Garamond', Georgia, serif";
const INTER = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const MarketPage = () => {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await apiClient.get('/snapshot/latest');
        if (res.data?.cognitive) setSnapshot(res.data.cognitive);
      } catch {} finally { setLoading(false); }
    };
    fetch();
  }, []);

  const marketNarrative = snapshot?.market_position || snapshot?.market?.narrative || null;

  return (
  <DashboardLayout>
    <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: INTER }} data-testid="market-page">
      <div>
        <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: SORA }}>Market Intelligence</h1>
        <p className="text-sm text-[#9FB0C3]">
          Competitive landscape, market trends, and positioning analysis.
          {loading && <span className="text-[10px] ml-2 text-[#FF6A00]" style={{ fontFamily: "\x27JetBrains Mono\x27, monospace" }}>syncing...</span>}
        </p>
      </div>

      {/* Market Position */}
      <Panel>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Market Position</h2>
            <p className="text-sm text-[#9FB0C3]">Your competitive standing based on pricing, service quality, and market share signals.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold" style={{ fontFamily: MONO, color: '#3B82F6' }}>STABLE</span>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Market Share Est.', value: '4.2%', icon: Globe, color: '#3B82F6' },
          { label: 'Competitor Count', value: '23', icon: Users, color: '#F59E0B' },
          { label: 'Win Rate vs Market', value: '34%', icon: Target, color: '#10B981' },
          { label: 'Price Position', value: 'Mid-tier', icon: TrendingUp, color: '#FF6A00' },
        ].map(m => (
          <Panel key={m.label}>
            <div className="flex items-center gap-2 mb-2">
              <m.icon className="w-4 h-4" style={{ color: m.color }} />
              <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{m.label}</span>
            </div>
            <span className="text-xl font-bold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{m.value}</span>
          </Panel>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Competitor Signals */}
        <Panel>
          <h3 className="text-sm font-semibold text-[#F4F7FA] mb-4" style={{ fontFamily: SORA }}>Competitor Signals</h3>
          <div className="space-y-3">
            {[
              { name: 'Competitor A', signal: 'Launched similar service at 15% lower price', impact: 'High', time: '5d ago', color: '#EF4444' },
              { name: 'Competitor B', signal: 'Expanded into Melbourne market', impact: 'Medium', time: '12d ago', color: '#F59E0B' },
              { name: 'Competitor C', signal: 'Key hire — former industry leader as CTO', impact: 'Medium', time: '18d ago', color: '#F59E0B' },
              { name: 'Competitor D', signal: 'Lost major client — service quality issues', impact: 'Opportunity', time: '7d ago', color: '#10B981' },
            ].map((c, i) => (
              <div key={i} className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: c.color }} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{c.name}</span>
                      <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{c.time}</span>
                    </div>
                    <p className="text-[11px] text-[#9FB0C3] mt-0.5">{c.signal}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded mt-1 inline-block" style={{ color: c.color, background: c.color + '15', fontFamily: MONO }}>{c.impact}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Market Trends */}
        <Panel>
          <h3 className="text-sm font-semibold text-[#F4F7FA] mb-4" style={{ fontFamily: SORA }}>Industry Trends</h3>
          <div className="space-y-3">
            {[
              { trend: 'AI-driven automation demand increasing', direction: 'up', impact: 'Strong tailwind for your services', confidence: '89%' },
              { trend: 'Labour costs rising across sector', direction: 'up', impact: 'Margin pressure — automation offset needed', confidence: '92%' },
              { trend: 'Regulatory complexity increasing', direction: 'up', impact: 'Compliance services opportunity', confidence: '78%' },
              { trend: 'Client budget cycles shifting to quarterly', direction: 'neutral', impact: 'Shorter sales cycles expected', confidence: '71%' },
            ].map((t, i) => (
              <div key={i} className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                <div className="flex items-start gap-2">
                  {t.direction === 'up' ? <ArrowUpRight className="w-4 h-4 shrink-0 mt-0.5 text-[#10B981]" /> : <TrendingDown className="w-4 h-4 shrink-0 mt-0.5 text-[#64748B]" />}
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-[#F4F7FA]">{t.trend}</p>
                    <p className="text-[11px] text-[#64748B] mt-0.5">{t.impact}</p>
                    <span className="text-[10px] mt-1 inline-block" style={{ color: '#3B82F6', fontFamily: MONO }}>Confidence: {t.confidence}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* AI Insight */}
      <Panel>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#3B82F615' }}>
            <Radar className="w-4 h-4 text-[#3B82F6]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: SORA }}>AI Market Advisory</h3>
            <p className="text-sm text-[#9FB0C3] leading-relaxed">{marketNarrative || 'Your market position is stable but under emerging pressure. Competitor A\'s price undercut requires a response — recommend emphasising your differentiated value (Australian data sovereignty, AI-driven proactive intelligence). Competitor D\'s client loss presents an acquisition opportunity. The AI automation trend strongly favours your platform positioning.'}</p>
          </div>
        </div>
      </Panel>
    </div>
  </DashboardLayout>
  );
};

export default MarketPage;
