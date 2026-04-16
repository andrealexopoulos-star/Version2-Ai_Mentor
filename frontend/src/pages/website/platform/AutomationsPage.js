import React from 'react';
import PlatformLayout from '../../../components/website/PlatformLayout';
import { Workflow, Play, Pause, Edit, FileText, ToggleLeft, ToggleRight, Clock, Zap, Mail, AlertTriangle, DollarSign, Users } from 'lucide-react';
import { fontFamily } from '../../../design-system/tokens';


const automations = [
  { id: 1, name: 'Overdue Invoice Follow-up', active: true, condition: 'Invoice is overdue > 7 days AND client has not responded', action: 'Send automated payment reminder via email. Escalate to phone after 48 hours.', runs: 12, lastRun: '2 hours ago', icon: DollarSign },
  { id: 2, name: 'New Lead Auto-Response', active: true, condition: 'New lead received AND not contacted within 4 hours', action: 'Send personalised intro email from CRM template. Log to HubSpot.', runs: 34, lastRun: '6 hours ago', icon: Mail },
  { id: 3, name: 'Churn Risk Alert', active: true, condition: 'Client engagement score drops below 40% AND response time increases > 2x', action: 'Flag client as at-risk. Notify account manager. Draft re-engagement email.', runs: 5, lastRun: '3 days ago', icon: AlertTriangle },
  { id: 4, name: 'Overtime Threshold Alert', active: false, condition: 'Any team member logs > 45 hours in a week', action: 'Alert operations lead. Suggest workload redistribution. Block additional scheduling.', runs: 8, lastRun: '1 week ago', icon: Users },
];

const AutomationCard = ({ auto }) => (
  <div className="rounded-lg overflow-hidden" style={{ background: 'var(--surface, #0E1628)', border: `1px solid ${auto.active ? 'rgba(140,170,210,0.15)' : 'rgba(140,170,210,0.15)'}`, opacity: auto.active ? 1 : 0.7 }} data-testid={`automation-${auto.id}`}>
    <div className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: auto.active ? '#E85D00' + '15' : 'rgba(140,170,210,0.15)' }}>
          <auto.icon className="w-4 h-4" style={{ color: auto.active ? '#E85D00' : '#64748B' }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>{auto.name}</h3>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{auto.runs} runs</span>
            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Last: {auto.lastRun}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => window.location.assign('/login-supabase')} className="p-1.5 rounded-md hover:bg-black/5 text-[#64748B]"><Edit className="w-3.5 h-3.5" /></button>
        <button onClick={() => window.location.assign('/login-supabase')} className="p-1.5 rounded-md hover:bg-black/5 text-[#64748B]"><FileText className="w-3.5 h-3.5" /></button>
        {auto.active ? (
          <div onClick={() => window.location.assign('/login-supabase')} className="w-9 h-5 rounded-full cursor-pointer flex items-center px-0.5" style={{ background: '#E85D00' }}>
            <div className="w-4 h-4 rounded-full bg-white ml-auto" />
          </div>
        ) : (
          <div onClick={() => window.location.assign('/login-supabase')} className="w-9 h-5 rounded-full cursor-pointer flex items-center px-0.5" style={{ background: 'rgba(140,170,210,0.15)' }}>
            <div className="w-4 h-4 rounded-full bg-[#64748B]" />
          </div>
        )}
      </div>
    </div>

    {/* IF / THEN blocks */}
    <div className="px-5 pb-4 space-y-2" style={{ borderTop: '1px solid rgba(140,170,210,0.15)' }}>
      <div className="flex gap-3 pt-3">
        <span className="text-[10px] font-semibold px-2 py-1 rounded uppercase tracking-wider shrink-0 h-fit" style={{ fontFamily: fontFamily.mono, color: '#3B82F6', background: '#3B82F6' + '15', border: '1px solid #3B82F620' }}>IF</span>
        <div className="flex-1 p-3 rounded-md" style={{ background: 'var(--surface, #FFFFFF)', border: '1px solid rgba(140,170,210,0.15)' }}>
          <p className="text-xs text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>{auto.condition}</p>
        </div>
      </div>
      <div className="flex gap-3">
        <span className="text-[10px] font-semibold px-2 py-1 rounded uppercase tracking-wider shrink-0 h-fit" style={{ fontFamily: fontFamily.mono, color: '#10B981', background: '#10B981' + '15', border: '1px solid #10B98120' }}>THEN</span>
        <div className="flex-1 p-3 rounded-md" style={{ background: 'var(--surface, #FFFFFF)', border: '1px solid rgba(140,170,210,0.15)' }}>
          <p className="text-xs text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>{auto.action}</p>
        </div>
      </div>
    </div>
  </div>
);

const AutomationsPage = () => (
  <PlatformLayout title="Automations">
    <div className="space-y-6 max-w-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>Automated workflows triggered by business signals.</p>
        </div>
        <button onClick={() => window.location.assign('/login-supabase')} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white" style={{ background: '#E85D00', fontFamily: fontFamily.body }}>
          <Workflow className="w-4 h-4" /> New Automation
        </button>
      </div>

      {/* Summary */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg" style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.15)' }}>
          <span className="text-xs text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>Active</span>
          <span className="text-sm font-semibold text-[#10B981]" style={{ fontFamily: fontFamily.mono }}>{automations.filter(a => a.active).length}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg" style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.15)' }}>
          <span className="text-xs text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>Paused</span>
          <span className="text-sm font-semibold text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{automations.filter(a => !a.active).length}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg" style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.15)' }}>
          <span className="text-xs text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>Total Runs</span>
          <span className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{automations.reduce((s, a) => s + a.runs, 0)}</span>
        </div>
      </div>

      {/* Automation cards */}
      <div className="space-y-4">
        {automations.map(a => <AutomationCard key={a.id} auto={a} />)}
      </div>
    </div>
  </PlatformLayout>
);

export default AutomationsPage;
