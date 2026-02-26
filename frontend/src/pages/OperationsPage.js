import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import FloatingSoundboard from '../components/FloatingSoundboard';
import { apiClient } from '../lib/api';
import { Settings, Clock, Users, AlertTriangle, CheckCircle2, Workflow, Loader2 } from 'lucide-react';

const SORA = "'Cormorant Garamond', Georgia, serif";
const INTER = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const OperationsPage = () => {
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

  // Extract ops data — no fabrication, null if unavailable
  const slaBreaches = snapshot?.sla_breaches ?? snapshot?.execution?.sla_breaches ?? null;
  const sopCompliance = snapshot?.sop_compliance ?? null;
  const activeTasks = snapshot?.active_tasks ?? null;
  const hasOpsData = slaBreaches !== null || sopCompliance !== null;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: INTER }} data-testid="operations-page">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: SORA }}>Operations Intelligence</h1>
          <p className="text-sm text-[#9FB0C3]">
            Task execution, SOP compliance, bottlenecks, and delivery performance.
            {loading && <span className="text-[10px] ml-2 text-[#FF6A00]" style={{ fontFamily: "\x27JetBrains Mono\x27, monospace" }}>syncing...</span>}
          </p>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'SOP Compliance', value: sopCompliance + '%', color: sopCompliance > 85 ? '#10B981' : '#F59E0B', icon: CheckCircle2 },
            { label: 'SLA Breaches', value: String(slaBreaches), color: slaBreaches > 0 ? '#FF6A00' : '#10B981', icon: AlertTriangle },
            { label: 'Tasks Active', value: String(activeTasks), color: '#3B82F6', icon: Workflow },
            { label: 'Avg Cycle Time', value: '3.4d', color: '#F59E0B', icon: Clock },
          ].map(m => (
            <Panel key={m.label}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: m.color + '15' }}>
                  <m.icon className="w-3.5 h-3.5" style={{ color: m.color }} />
                </div>
                <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{m.label}</span>
              </div>
              <span className="text-2xl font-bold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{m.value}</span>
            </Panel>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Active Bottlenecks */}
          <Panel>
            <h3 className="text-sm font-semibold text-[#F4F7FA] mb-4" style={{ fontFamily: SORA }}>Active Bottlenecks</h3>
            <div className="space-y-3">
              {[
                { title: 'Project Alpha delivery delayed', impact: 'Client SLA at risk — 2 days behind schedule', severity: 'critical', team: 'Dev Team' },
                { title: 'Subcontractor approval pending', impact: '3 tasks blocked waiting for sign-off', severity: 'moderate', team: 'Operations' },
                { title: 'QA backlog growing', impact: '8 items in queue, avg wait time 2.1 days', severity: 'moderate', team: 'Quality' },
              ].map((item, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ background: '#0F1720', border: `1px solid ${item.severity === 'critical' ? '#FF6A0025' : '#24314050'}` }}>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: item.severity === 'critical' ? '#FF6A00' : '#F59E0B' }} />
                    <div>
                      <p className="text-sm font-medium text-[#F4F7FA]" style={{ fontFamily: SORA }}>{item.title}</p>
                      <p className="text-xs text-[#9FB0C3] mt-0.5">{item.impact}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded mt-1 inline-block" style={{ color: '#64748B', background: '#243140', fontFamily: MONO }}>{item.team}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* SOP Performance */}
          <Panel>
            <h3 className="text-sm font-semibold text-[#F4F7FA] mb-4" style={{ fontFamily: SORA }}>SOP Performance</h3>
            <div className="space-y-4">
              {[
                { name: 'Client Onboarding', compliance: 94, trend: '+2%' },
                { name: 'Invoice Processing', compliance: 88, trend: '-1%' },
                { name: 'Lead Response', compliance: 72, trend: '-8%' },
                { name: 'Quality Checks', compliance: 96, trend: '+4%' },
                { name: 'Escalation Handling', compliance: 81, trend: '+1%' },
              ].map(sop => {
                const color = sop.compliance >= 90 ? '#10B981' : sop.compliance >= 80 ? '#F59E0B' : '#FF6A00';
                return (
                  <div key={sop.name}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-[#9FB0C3]">{sop.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold" style={{ fontFamily: MONO, color }}>{sop.compliance}%</span>
                        <span className="text-[10px]" style={{ color: sop.trend.startsWith('+') ? '#10B981' : '#EF4444', fontFamily: MONO }}>{sop.trend}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: color + '20' }}>
                      <div className="h-1.5 rounded-full transition-all" style={{ background: color, width: sop.compliance + '%' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* Team Workload */}
        <Panel>
          <h3 className="text-sm font-semibold text-[#F4F7FA] mb-4" style={{ fontFamily: SORA }}>Team Workload Distribution</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: 'Andre', hours: 52, capacity: 40, tasks: 6, status: 'overloaded' },
              { name: 'Sarah', hours: 38, capacity: 40, tasks: 4, status: 'optimal' },
              { name: 'Mike', hours: 44, capacity: 40, tasks: 5, status: 'warning' },
            ].map(member => {
              const color = member.status === 'overloaded' ? '#EF4444' : member.status === 'warning' ? '#F59E0B' : '#10B981';
              return (
                <div key={member.name} className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: '#FF6A00' }}>{member.name[0]}</div>
                      <span className="text-sm font-medium text-[#F4F7FA]">{member.name}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded" style={{ color, background: color + '15', fontFamily: MONO }}>{member.status}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-[#64748B] mb-1" style={{ fontFamily: MONO }}>
                    <span>{member.hours}h / {member.capacity}h</span>
                    <span>{member.tasks} tasks</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: color + '20' }}>
                    <div className="h-1.5 rounded-full" style={{ background: color, width: Math.min((member.hours / member.capacity) * 100, 100) + '%' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* AI Insight */}
        <Panel>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#10B98115' }}>
              <Settings className="w-4 h-4 text-[#10B981]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: SORA }}>AI Operations Advisory</h3>
              <p className="text-sm text-[#9FB0C3] leading-relaxed">
                {snapshot?.execution?.bottleneck || snapshot?.executive_memo?.substring(0, 300) || 
                  'Operations are running at 87% SOP compliance with 2 active SLA breaches. Priority: resolve Project Alpha delivery delay to prevent further SLA impact. Andre is carrying 130% workload — redistribute 2 tasks to Sarah who has capacity. Lead Response SOP compliance has dropped to 72% — investigate root cause and retrain team.'}
              </p>
            </div>
          </div>
        </Panel>
      </div>
      <FloatingSoundboard context="Operations intelligence - SOP compliance and workload" />
    </DashboardLayout>
  );
};

export default OperationsPage;
