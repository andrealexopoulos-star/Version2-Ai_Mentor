import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import FloatingSoundboard from '../components/FloatingSoundboard';
import { apiClient } from '../lib/api';
import { AlertTriangle, Shield, DollarSign, Clock, ArrowRight, Loader2 } from 'lucide-react';

const SORA = "'Cormorant Garamond', Georgia, serif";
const INTER = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const RiskPage = () => {
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

  const cashRunway = snapshot?.cash_runway_months ?? snapshot?.capital?.runway ?? null;
  const riskLevel = cashRunway !== null ? (cashRunway < 3 ? 'CRITICAL' : cashRunway < 6 ? 'MODERATE' : 'LOW') : null;
  const riskColor = riskLevel === 'CRITICAL' ? '#EF4444' : riskLevel === 'MODERATE' ? '#F59E0B' : riskLevel === 'LOW' ? '#10B981' : '#64748B';

  return (
  <DashboardLayout>
    <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: INTER }} data-testid="risk-page">
      <div>
        <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: SORA }}>Risk & Governance</h1>
        <p className="text-sm text-[#9FB0C3]">
          {cashRunway !== null ? 'Risk exposure from connected data.' : 'Connect financial data to assess risk.'}
          {loading && <span className="text-[10px] ml-2 text-[#FF6A00]" style={{ fontFamily: MONO }}>syncing...</span>}
        </p>
      </div>

      {/* Risk Overview */}
      <Panel>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Overall Risk Score</h2>
            <p className="text-sm text-[#9FB0C3]">Composite assessment across financial, operational, and market factors.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-3xl font-bold" style={{ fontFamily: MONO, color: riskColor }}>{riskLevel}</span>
              <span className="block text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{cashRunway} months runway</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* Risk Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel>
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4 text-[#FF6A00]" />
            <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Financial Risk</h3>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded" style={{ color: '#FF6A00', background: '#FF6A0015', fontFamily: MONO }}>HIGH</span>
          </div>
          <div className="space-y-3">
            {[
              { title: 'Cash runway declining', detail: '4.2 months at current burn rate. Down from 5.8 months.', severity: '#FF6A00' },
              { title: 'Revenue concentration', detail: 'Top client = 38% of revenue. Single point of failure.', severity: '#F59E0B' },
              { title: 'Overdue receivables', detail: '$12,400 outstanding >30 days. $3,200 critical.', severity: '#FF6A00' },
            ].map((r, i) => (
              <div key={i} className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: r.severity }} />
                  <div>
                    <p className="text-xs font-semibold text-[#F4F7FA]">{r.title}</p>
                    <p className="text-[11px] text-[#64748B] mt-0.5">{r.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
            <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Operational Risk</h3>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded" style={{ color: '#F59E0B', background: '#F59E0B15', fontFamily: MONO }}>MODERATE</span>
          </div>
          <div className="space-y-3">
            {[
              { title: '2 SLA breaches this month', detail: 'Project Alpha and Client D deliverables delayed.', severity: '#FF6A00' },
              { title: 'Staff overtime 15% above target', detail: '3 team members exceeded 48h. Burnout risk.', severity: '#F59E0B' },
              { title: 'Subcontractor costs rising', detail: '12% increase in 45 days. Margin compression.', severity: '#F59E0B' },
            ].map((r, i) => (
              <div key={i} className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: r.severity }} />
                  <div>
                    <p className="text-xs font-semibold text-[#F4F7FA]">{r.title}</p>
                    <p className="text-[11px] text-[#64748B] mt-0.5">{r.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-[#10B981]" />
            <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Market Risk</h3>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded" style={{ color: '#10B981', background: '#10B98115', fontFamily: MONO }}>LOW</span>
          </div>
          <div className="space-y-3">
            {[
              { title: 'Competitor launched similar service', detail: 'Pricing 15% lower. Monitor client reactions.', severity: '#F59E0B' },
              { title: 'Industry regulation changes', detail: 'New compliance requirements effective Q3.', severity: '#3B82F6' },
              { title: 'Market sentiment stable', detail: 'No significant macro changes detected.', severity: '#10B981' },
            ].map((r, i) => (
              <div key={i} className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: r.severity }} />
                  <div>
                    <p className="text-xs font-semibold text-[#F4F7FA]">{r.title}</p>
                    <p className="text-[11px] text-[#64748B] mt-0.5">{r.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Risk Timeline */}
      <Panel>
        <h3 className="text-sm font-semibold text-[#F4F7FA] mb-4" style={{ fontFamily: SORA }}>Upcoming Risk Events</h3>
        <div className="space-y-3">
          {[
            { date: '18 days', event: 'BAS Q3 submission deadline', type: 'Compliance', color: '#3B82F6' },
            { date: '30 days', event: 'Cash runway drops below 4 months', type: 'Financial', color: '#FF6A00' },
            { date: '45 days', event: 'Workers compensation renewal', type: 'Insurance', color: '#F59E0B' },
            { date: '60 days', event: 'Largest client contract renewal', type: 'Revenue', color: '#EF4444' },
          ].map((e, i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
              <span className="text-sm font-bold shrink-0 w-16 text-right" style={{ color: e.color, fontFamily: MONO }}>{e.date}</span>
              <div className="w-px h-8" style={{ background: '#243140' }} />
              <div className="flex-1">
                <p className="text-sm text-[#F4F7FA]">{e.event}</p>
                <span className="text-[10px]" style={{ color: '#64748B', fontFamily: MONO }}>{e.type}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#64748B]" />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  </DashboardLayout>
  );
};

export default RiskPage;
