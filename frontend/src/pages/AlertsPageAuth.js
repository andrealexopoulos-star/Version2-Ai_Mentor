import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { Bell, ChevronDown, ChevronUp, Mail, MessageSquare, Users, Loader2 } from 'lucide-react';

const SORA = "'Cormorant Garamond', Georgia, serif";
const INTER = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const DEMO_ALERTS = [
  { id: 1, severity: 'critical', title: 'Invoice #1847 overdue 12 days — $3,200', impact: 'Cash flow impact. Client has been unresponsive to previous follow-up.', action: 'Send firm payment reminder. Follow up via phone if no response in 48 hours.', time: '2h ago', actions: ['email', 'sms'] },
  { id: 2, severity: 'critical', title: '3 deals stalled at proposal stage', impact: 'Combined pipeline value: $88K. Pricing objection detected across all 3.', action: 'Review proposal pricing. Consider offering phased engagement or pilot scope.', time: '4h ago', actions: ['email', 'handoff'] },
  { id: 3, severity: 'moderate', title: 'Subcontractor costs increasing 12%', impact: 'Margin compression on Service B. Affects 4 active projects.', action: 'Renegotiate rates with current supplier or source alternatives.', time: '1d ago', actions: ['handoff'] },
  { id: 4, severity: 'moderate', title: 'Staff overtime 15% above target', impact: '3 team members exceeded 48 hours this week. Burnout risk.', action: 'Redistribute Monday workload. Review project allocation.', time: '1d ago', actions: ['handoff'] },
  { id: 5, severity: 'moderate', title: 'Client B engagement declining', impact: 'Response time increased 3x over 30 days. Churn risk elevated.', action: 'Schedule check-in call. AI has drafted re-engagement email.', time: '2d ago', actions: ['email', 'sms'] },
  { id: 6, severity: 'info', title: 'BAS Q3 deadline in 18 days', impact: 'All documents prepared. No action required at this time.', action: 'Review and submit before deadline.', time: '3d ago', actions: [] },
  { id: 7, severity: 'info', title: 'Workers compensation renewal in 45 days', impact: 'Current policy expires. Renewal documentation gathered.', action: 'Compare renewal quotes. Contact broker.', time: '5d ago', actions: [] },
];

const sevMap = { critical: { color: '#FF6A00', label: 'Critical' }, moderate: { color: '#F59E0B', label: 'Moderate' }, info: { color: '#3B82F6', label: 'Info' }, high: { color: '#FF6A00', label: 'Critical' }, medium: { color: '#F59E0B', label: 'Moderate' }, low: { color: '#10B981', label: 'Low' } };

const AlertItem = ({ alert }) => {
  const [open, setOpen] = useState(false);
  const s = sevMap[alert.severity] || sevMap.info;
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#141C26', border: `1px solid ${s.color}20` }} data-testid={`alert-${alert.id}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color, boxShadow: alert.severity === 'critical' || alert.severity === 'high' ? `0 0 10px ${s.color}40` : 'none' }} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-[#F4F7FA] block" style={{ fontFamily: SORA }}>{alert.title}</span>
        </div>
        <span className="text-[10px] text-[#64748B] shrink-0" style={{ fontFamily: MONO }}>{alert.time}</span>
        <span className="text-[10px] px-2 py-0.5 rounded uppercase tracking-wider shrink-0" style={{ fontFamily: MONO, color: s.color, background: s.color + '15' }}>{s.label}</span>
        {open ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
      </button>
      {open && (
        <div className="px-5 pb-4 pt-3 space-y-3" style={{ borderTop: '1px solid #243140' }}>
          <div>
            <span className="text-[10px] text-[#64748B] uppercase tracking-wider block mb-1" style={{ fontFamily: MONO }}>Business Impact</span>
            <p className="text-sm text-[#9FB0C3]">{alert.impact}</p>
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] uppercase tracking-wider block mb-1" style={{ fontFamily: MONO }}>Recommended Action</span>
            <p className="text-sm text-[#9FB0C3]">{alert.action}</p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {alert.actions?.includes('email') && <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: '#3B82F615', color: '#3B82F6', border: '1px solid #3B82F630' }}><Mail className="w-3.5 h-3.5" />Auto-Email</button>}
            {alert.actions?.includes('sms') && <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: '#10B98115', color: '#10B981', border: '1px solid #10B98130' }}><MessageSquare className="w-3.5 h-3.5" />Quick-SMS</button>}
            {alert.actions?.includes('handoff') && <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: '#FF6A0015', color: '#FF6A00', border: '1px solid #FF6A0030' }}><Users className="w-3.5 h-3.5" />Hand Off</button>}
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: '#10B98115', color: '#10B981', border: '1px solid #10B98130' }} data-testid={`alert-complete-${alert.id}`}><CheckCircle2 className="w-3.5 h-3.5" />Complete</button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: '#64748B15', color: '#64748B', border: '1px solid #64748B30' }} data-testid={`alert-ignore-${alert.id}`}><XCircle className="w-3.5 h-3.5" />Ignore</button>
          </div>
        </div>
      )}
    </div>
  );
};

const AlertsPageAuth = () => {
  const [alerts, setAlerts] = useState(DEMO_ALERTS);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await apiClient.get('/intelligence/watchtower');
        if (res.data?.events?.length > 0) {
          const mapped = res.data.events.map((e, i) => ({
            id: e.id || i + 1,
            severity: e.severity || 'moderate',
            title: e.title || e.signal || e.event,
            impact: e.impact || e.detail || e.description || '',
            action: e.recommendation || e.action || 'Review and take appropriate action.',
            time: e.created_at ? timeAgo(e.created_at) : 'Recent',
            actions: e.severity === 'critical' || e.severity === 'high' ? ['email', 'handoff'] : ['handoff'],
          }));
          setAlerts([...mapped, ...DEMO_ALERTS.slice(mapped.length)]);
        }
      } catch {} finally { setLoading(false); }
    };
    fetchAlerts();
  }, []);

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter || (filter === 'critical' && a.severity === 'high'));
  const critCount = alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length;
  const modCount = alerts.filter(a => a.severity === 'moderate' || a.severity === 'medium').length;
  const infoCount = alerts.filter(a => a.severity === 'info' || a.severity === 'low').length;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[900px]" style={{ fontFamily: INTER }} data-testid="alerts-page">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#F4F7FA]" style={{ fontFamily: SORA }}>Alert Centre</h1>
            <p className="text-sm text-[#9FB0C3]">
              {alerts.length} active alerts across your business.
              {loading && <Loader2 className="w-3 h-3 inline ml-2 animate-spin" />}
            </p>
          </div>
          <div className="flex gap-2">
            {[['all', 'All'], ['critical', 'Critical'], ['moderate', 'Moderate'], ['info', 'Info']].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: filter === val ? '#FF6A00' : '#141C26', color: filter === val ? 'white' : '#9FB0C3', border: `1px solid ${filter === val ? '#FF6A00' : '#243140'}`, fontFamily: MONO }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[['Critical', critCount, '#FF6A00'], ['Moderate', modCount, '#F59E0B'], ['Info', infoCount, '#3B82F6']].map(([l, v, c]) => (
            <div key={l} className="rounded-lg p-4 text-center" style={{ background: '#141C26', border: '1px solid #243140' }}>
              <span className="text-2xl font-bold block" style={{ fontFamily: MONO, color: c }}>{v}</span>
              <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{l}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map(a => <AlertItem key={a.id} alert={a} />)}
        </div>
      </div>
    </DashboardLayout>
  );
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

export default AlertsPageAuth;
