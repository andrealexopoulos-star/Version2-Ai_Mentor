import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Workflow, Play, Pause, CheckCircle2, Clock, Zap, ArrowRight, Settings } from 'lucide-react';

const SORA = "'Cormorant Garamond', Georgia, serif";
const INTER = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const AutomationsPageAuth = () => (
  <DashboardLayout>
    <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: INTER }} data-testid="automations-page">
      <div>
        <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: SORA }}>Automations</h1>
        <p className="text-sm text-[#9FB0C3]">AI-powered workflows running across your business systems.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Flows', value: '6', color: '#10B981', icon: Play },
          { label: 'Paused', value: '2', color: '#F59E0B', icon: Pause },
          { label: 'Runs Today', value: '47', color: '#3B82F6', icon: Zap },
          { label: 'Hours Saved', value: '12.5', color: '#FF6A00', icon: Clock },
        ].map(m => (
          <Panel key={m.label}>
            <div className="flex items-center gap-2 mb-2">
              <m.icon className="w-4 h-4" style={{ color: m.color }} />
              <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{m.label}</span>
            </div>
            <span className="text-2xl font-bold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{m.value}</span>
          </Panel>
        ))}
      </div>

      {/* Automation List */}
      <div className="space-y-3">
        {[
          { name: 'Invoice Payment Reminders', trigger: 'Invoice overdue > 7 days', lastRun: '2h ago', runs: 156, status: 'active', saved: '4.2h/week' },
          { name: 'Lead Response Auto-Email', trigger: 'New lead detected in CRM', lastRun: '45m ago', runs: 89, status: 'active', saved: '2.8h/week' },
          { name: 'SOP Compliance Check', trigger: 'Daily at 9:00 AM AEST', lastRun: '6h ago', runs: 312, status: 'active', saved: '1.5h/week' },
          { name: 'Client Engagement Monitor', trigger: 'Weekly engagement score < threshold', lastRun: '1d ago', runs: 24, status: 'active', saved: '1.2h/week' },
          { name: 'Subcontractor Cost Alerts', trigger: 'Cost variance > 10%', lastRun: '3d ago', runs: 8, status: 'active', saved: '0.5h/week' },
          { name: 'Calendar Conflict Detection', trigger: 'New meeting scheduled', lastRun: '4h ago', runs: 67, status: 'active', saved: '2.3h/week' },
          { name: 'Quarterly BAS Prep', trigger: '30 days before BAS deadline', lastRun: '12d ago', runs: 4, status: 'paused', saved: '3h/quarter' },
          { name: 'Team Overtime Alerts', trigger: 'Weekly hours > 45', lastRun: '5d ago', runs: 18, status: 'paused', saved: '0.8h/week' },
        ].map((auto, i) => (
          <Panel key={i}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: auto.status === 'active' ? '#10B98115' : '#F59E0B15' }}>
                {auto.status === 'active' ? <Play className="w-4 h-4 text-[#10B981]" /> : <Pause className="w-4 h-4 text-[#F59E0B]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>{auto.name}</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: auto.status === 'active' ? '#10B981' : '#F59E0B', background: (auto.status === 'active' ? '#10B981' : '#F59E0B') + '15', fontFamily: MONO }}>{auto.status}</span>
                </div>
                <p className="text-[11px] text-[#64748B]" style={{ fontFamily: MONO }}>Trigger: {auto.trigger}</p>
              </div>
              <div className="hidden md:flex items-center gap-6 shrink-0">
                <div className="text-right">
                  <span className="text-xs text-[#64748B] block" style={{ fontFamily: MONO }}>Last run</span>
                  <span className="text-xs text-[#9FB0C3]" style={{ fontFamily: MONO }}>{auto.lastRun}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#64748B] block" style={{ fontFamily: MONO }}>Total runs</span>
                  <span className="text-xs text-[#F4F7FA] font-semibold" style={{ fontFamily: MONO }}>{auto.runs}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#64748B] block" style={{ fontFamily: MONO }}>Time saved</span>
                  <span className="text-xs font-semibold" style={{ fontFamily: MONO, color: '#10B981' }}>{auto.saved}</span>
                </div>
              </div>
              <button className="p-2 rounded-lg hover:bg-white/5 shrink-0"><Settings className="w-4 h-4 text-[#64748B]" /></button>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  </DashboardLayout>
);

export default AutomationsPageAuth;
