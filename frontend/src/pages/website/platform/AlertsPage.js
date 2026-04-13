import React, { useState } from 'react';
import PlatformLayout from '../../../components/website/PlatformLayout';
import { Bell, AlertTriangle, Info, ChevronDown, ChevronUp, Mail, MessageSquare, Users, Check, Clock } from 'lucide-react';
import { fontFamily } from '../../../design-system/tokens';


const alerts = [
  { id: 1, severity: 'critical', title: 'Invoice #1847 overdue 12 days — $3,200', impact: 'Cash flow impact. Client has been unresponsive to previous follow-up.', action: 'Send firm payment reminder. Follow up via phone if no response in 48 hours.', time: '2h ago', actions: ['email', 'sms'] },
  { id: 2, severity: 'critical', title: '3 deals stalled at proposal stage', impact: 'Combined pipeline value: $88K. Pricing objection detected across all 3.', action: 'Review proposal pricing. Consider offering phased engagement or pilot scope.', time: '4h ago', actions: ['email', 'handoff'] },
  { id: 3, severity: 'moderate', title: 'Subcontractor costs increasing 12%', impact: 'Margin compression on Service B. Affects 4 active projects.', action: 'Renegotiate rates with current supplier or source alternatives.', time: '1d ago', actions: ['handoff'] },
  { id: 4, severity: 'moderate', title: 'Staff overtime 15% above target', impact: '3 team members exceeded 48 hours this week. Burnout risk.', action: 'Redistribute Monday workload. Review project allocation.', time: '1d ago', actions: ['handoff'] },
  { id: 5, severity: 'moderate', title: 'Key account engagement declining', impact: 'Response time increased over 30 days. Churn risk elevated.', action: 'Schedule check-in call. Re-engagement email drafted.', time: '2d ago', actions: ['email', 'sms'] },
  { id: 6, severity: 'info', title: 'BAS Q3 deadline in 18 days', impact: 'All documents prepared. No action required at this time.', action: 'Review and submit before deadline.', time: '3d ago', actions: [] },
  { id: 7, severity: 'info', title: 'Workers compensation renewal in 45 days', impact: 'Current policy expires. Renewal documentation gathered.', action: 'Compare renewal quotes. Contact broker.', time: '5d ago', actions: [] },
];

const AlertItem = ({ alert }) => {
  const [open, setOpen] = useState(false);
  const sevMap = { critical: { color: '#E85D00', label: 'Critical' }, moderate: { color: '#F59E0B', label: 'Moderate' }, info: { color: '#3B82F6', label: 'Informational' } };
  const s = sevMap[alert.severity];
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: 'var(--surface, #0E1628)', border: `1px solid ${s.color}20` }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color, boxShadow: alert.severity === 'critical' ? `0 0 10px ${s.color}40` : 'none' }} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-[#EDF1F7] block" style={{ fontFamily: fontFamily.display }}>{alert.title}</span>
        </div>
        <span className="text-[10px] text-[#64748B] shrink-0" style={{ fontFamily: fontFamily.mono }}>{alert.time}</span>
        <span className="text-[10px] px-2 py-0.5 rounded uppercase tracking-wider shrink-0" style={{ fontFamily: fontFamily.mono, color: s.color, background: s.color + '15' }}>{s.label}</span>
        {open ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
      </button>
      {open && (
        <div className="px-5 pb-4 pt-3 space-y-3" style={{ borderTop: '1px solid rgba(140,170,210,0.15)' }}>
          <div>
            <span className="text-[10px] text-[#64748B] uppercase tracking-wider block mb-1" style={{ fontFamily: fontFamily.mono }}>Business Impact</span>
            <p className="text-sm text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>{alert.impact}</p>
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] uppercase tracking-wider block mb-1" style={{ fontFamily: fontFamily.mono }}>Suggested Action</span>
            <p className="text-sm text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>{alert.action}</p>
          </div>
          {alert.actions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {alert.actions.includes('email') && <button onClick={() => window.location.assign('/login-supabase')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: '#3B82F6' + '15', color: '#3B82F6', border: '1px solid #3B82F620', fontFamily: fontFamily.body }}><Mail className="w-3.5 h-3.5" />Auto-Email</button>}
              {alert.actions.includes('sms') && <button onClick={() => window.location.assign('/login-supabase')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: '#10B981' + '15', color: '#10B981', border: '1px solid #10B98120', fontFamily: fontFamily.body }}><MessageSquare className="w-3.5 h-3.5" />Quick-SMS</button>}
              {alert.actions.includes('handoff') && <button onClick={() => window.location.assign('/login-supabase')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: '#E85D00' + '15', color: '#E85D00', border: '1px solid #E85D0020', fontFamily: fontFamily.body }}><Users className="w-3.5 h-3.5" />Hand Off</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AlertsPage = () => {
  const counts = { critical: alerts.filter(a => a.severity === 'critical').length, moderate: alerts.filter(a => a.severity === 'moderate').length, info: alerts.filter(a => a.severity === 'info').length };
  return (
    <PlatformLayout title="Alerts & Actions">
      <div className="space-y-6 max-w-[900px]">
        {/* Summary */}
        <div className="flex gap-4">
          {[{ label: 'Critical', count: counts.critical, color: '#E85D00' }, { label: 'Moderate', count: counts.moderate, color: '#F59E0B' }, { label: 'Info', count: counts.info, color: '#3B82F6' }].map(s => (
            <div key={s.label} className="flex items-center gap-2 px-4 py-2.5 rounded-lg" style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.15)' }}>
              <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              <span className="text-xs text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>{s.label}</span>
              <span className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{s.count}</span>
            </div>
          ))}
        </div>

        {/* Alerts grouped */}
        {['critical', 'moderate', 'info'].map(sev => {
          const items = alerts.filter(a => a.severity === sev);
          if (items.length === 0) return null;
          return (
            <div key={sev}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-[#64748B] mb-3" style={{ fontFamily: fontFamily.mono }}>{sev === 'info' ? 'Informational' : sev}</h3>
              <div className="space-y-2">
                {items.map(a => <AlertItem key={a.id} alert={a} />)}
              </div>
            </div>
          );
        })}
      </div>
    </PlatformLayout>
  );
};

export default AlertsPage;
