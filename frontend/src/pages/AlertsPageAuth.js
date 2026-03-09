import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { Bell, ChevronDown, ChevronUp, Mail, MessageSquare, Users, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';


const sevMap = { critical: { color: '#FF6A00', label: 'Critical' }, moderate: { color: '#F59E0B', label: 'Moderate' }, info: { color: '#3B82F6', label: 'Info' }, high: { color: '#FF6A00', label: 'Critical' }, medium: { color: '#F59E0B', label: 'Moderate' }, low: { color: '#10B981', label: 'Low' } };

const AlertItem = ({ alert, onAction }) => {
  const [open, setOpen] = useState(false);
  const [actioned, setActioned] = useState(null);
  const s = sevMap[alert.severity] || sevMap.info;

  const handleAction = async (action) => {
    setActioned(action);
    try {
      await apiClient.post('/intelligence/alerts/action', { alert_id: alert.id, action });
    } catch {}
  };

  if (actioned === 'complete' || actioned === 'ignore') {
    return (
      <div className="rounded-lg px-5 py-3 flex items-center gap-3" style={{ background: '#141C26', border: '1px solid #24314050', opacity: 0.5 }}>
        {actioned === 'complete' ? <CheckCircle2 className="w-4 h-4 text-[#10B981]" /> : <XCircle className="w-4 h-4 text-[#64748B]" />}
        <span className="text-sm text-[#64748B]" style={{ fontFamily: fontFamily.body }}>{alert.title}</span>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded" style={{ color: actioned === 'complete' ? '#10B981' : '#64748B', background: actioned === 'complete' ? '#10B98115' : '#64748B15', fontFamily: fontFamily.mono }}>{actioned}</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#141C26', border: `1px solid ${s.color}20` }} data-testid={`alert-${alert.id}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color, boxShadow: alert.severity === 'critical' || alert.severity === 'high' ? `0 0 10px ${s.color}40` : 'none' }} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-[#F4F7FA] block" style={{ fontFamily: fontFamily.display }}>{alert.title}</span>
        </div>
        <span className="text-[10px] text-[#64748B] shrink-0" style={{ fontFamily: fontFamily.mono }}>{alert.time}</span>
        <span className="text-[10px] px-2 py-0.5 rounded uppercase tracking-wider shrink-0" style={{ fontFamily: fontFamily.mono, color: s.color, background: s.color + '15' }}>{s.label}</span>
        {open ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
      </button>
      {open && (
        <div className="px-5 pb-4 pt-3 space-y-3" style={{ borderTop: '1px solid #243140' }}>
          <div>
            <span className="text-[10px] text-[#64748B] uppercase tracking-wider block mb-1" style={{ fontFamily: fontFamily.mono }}>Business Impact</span>
            <p className="text-sm text-[#9FB0C3]">{alert.impact}</p>
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] uppercase tracking-wider block mb-1" style={{ fontFamily: fontFamily.mono }}>Recommended Action</span>
            <p className="text-sm text-[#9FB0C3]">{alert.action}</p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {alert.actions?.includes('email') && <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: '#3B82F615', color: '#3B82F6', border: '1px solid #3B82F630' }}><Mail className="w-3.5 h-3.5" />Auto-Email</button>}
            {alert.actions?.includes('sms') && <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: '#10B98115', color: '#10B981', border: '1px solid #10B98130' }}><MessageSquare className="w-3.5 h-3.5" />Quick-SMS</button>}
            {alert.actions?.includes('handoff') && <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: '#FF6A0015', color: '#FF6A00', border: '1px solid #FF6A0030' }}><Users className="w-3.5 h-3.5" />Hand Off</button>}
            <button onClick={() => handleAction('complete')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: '#10B98115', color: '#10B981', border: '1px solid #10B98130' }} data-testid={`alert-complete-${alert.id}`}><CheckCircle2 className="w-3.5 h-3.5" />Complete</button>
            <button onClick={() => handleAction('ignore')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: '#64748B15', color: '#64748B', border: '1px solid #64748B30' }} data-testid={`alert-ignore-${alert.id}`}><XCircle className="w-3.5 h-3.5" />Ignore</button>
          </div>
        </div>
      )}
    </div>
  );
};

const AlertsPageAuth = () => {
  const [alerts, setAlerts] = useState([]);
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
          setAlerts(mapped);
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
      <div className="space-y-6 max-w-[900px]" style={{ fontFamily: fontFamily.body }} data-testid="alerts-page">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Alert Centre</h1>
            <p className="text-sm text-[#9FB0C3]">
              {alerts.length} active alerts across your business.
              {loading && <span className="text-[10px] ml-2 text-[#FF6A00]" style={{ fontFamily: "\x27JetBrains Mono\x27, monospace" }}>syncing...</span>}
            </p>
          </div>
          <div className="flex gap-2">
            {[['all', 'All'], ['critical', 'Critical'], ['moderate', 'Moderate'], ['info', 'Info']].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: filter === val ? '#FF6A00' : '#141C26', color: filter === val ? 'white' : '#9FB0C3', border: `1px solid ${filter === val ? '#FF6A00' : '#243140'}`, fontFamily: fontFamily.mono }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[['Critical', critCount, '#FF6A00'], ['Moderate', modCount, '#F59E0B'], ['Info', infoCount, '#3B82F6']].map(([l, v, c]) => (
            <div key={l} className="rounded-lg p-4 text-center" style={{ background: '#141C26', border: '1px solid #243140' }}>
              <span className="text-2xl font-bold block" style={{ fontFamily: fontFamily.mono, color: c }}>{v}</span>
              <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{l}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.length > 0 ? (
            filtered.map(a => <AlertItem key={a.id} alert={a} />)
          ) : !loading ? (
            <div className="rounded-lg p-8 text-center" style={{ background: '#141C26', border: '1px solid #243140' }}>
              <Bell className="w-8 h-8 text-[#10B981] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>All systems normal — no alerts.</p>
              <p className="text-xs mt-1" style={{ color: '#9FB0C3' }}>BIQc monitors your connected data 24/7. You'll be notified here the moment something requires your attention.</p>
            </div>
          ) : null}
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
