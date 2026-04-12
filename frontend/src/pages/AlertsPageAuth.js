import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { useSupabaseAuth, AUTH_STATE } from '../context/SupabaseAuthContext';
import { Bell, ChevronDown, ChevronUp, Mail, MessageSquare, Users, Loader2, CheckCircle2, XCircle, Plug, ArrowRight, Shield } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import { Link } from 'react-router-dom';
import InsightExplainabilityStrip from '../components/InsightExplainabilityStrip';
import ActionOwnershipCard from '../components/ActionOwnershipCard';


const sevMap = { critical: { color: '#E85D00', label: 'Critical' }, moderate: { color: '#F59E0B', label: 'Moderate' }, info: { color: '#3B82F6', label: 'Info' }, high: { color: '#E85D00', label: 'Critical' }, medium: { color: '#F59E0B', label: 'Moderate' }, low: { color: '#10B981', label: 'Low' } };

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
      <div className="rounded-lg px-5 py-3 flex items-center gap-3" style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.15)50', opacity: 0.5 }}>
        {actioned === 'complete' ? <CheckCircle2 className="w-4 h-4 text-[#10B981]" /> : <XCircle className="w-4 h-4 text-[#64748B]" />}
        <span className="text-sm text-[#64748B]" style={{ fontFamily: fontFamily.body }}>{alert.title}</span>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded" style={{ color: actioned === 'complete' ? '#10B981' : '#64748B', background: actioned === 'complete' ? '#10B98115' : '#64748B15', fontFamily: fontFamily.mono }}>{actioned}</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#0E1628', border: `1px solid ${s.color}20` }} data-testid={`alert-${alert.id}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors" data-testid={`alert-toggle-${alert.id}`}>
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color, boxShadow: alert.severity === 'critical' || alert.severity === 'high' ? `0 0 10px ${s.color}40` : 'none' }} />
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
            <p className="text-sm text-[#8FA0B8] break-words whitespace-pre-wrap">{alert.impact}</p>
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] uppercase tracking-wider block mb-1" style={{ fontFamily: fontFamily.mono }}>Recommended Action</span>
            <p className="text-sm text-[#8FA0B8] break-words whitespace-pre-wrap">{alert.action}</p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {alert.actions?.includes('email') && <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: '#3B82F615', color: '#3B82F6', border: '1px solid #3B82F630' }} data-testid={`alert-auto-email-${alert.id}`}><Mail className="w-3.5 h-3.5" />Auto-Email</button>}
            {alert.actions?.includes('sms') && <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: '#10B98115', color: '#10B981', border: '1px solid #10B98130' }} data-testid={`alert-quick-sms-${alert.id}`}><MessageSquare className="w-3.5 h-3.5" />Quick-SMS</button>}
            {alert.actions?.includes('handoff') && <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: '#E85D0015', color: '#E85D00', border: '1px solid #E85D0030' }} data-testid={`alert-hand-off-${alert.id}`}><Users className="w-3.5 h-3.5" />Hand Off</button>}
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
  const [sortBy, setSortBy] = useState('severity'); // severity | date
  const [dateRange, setDateRange] = useState('all'); // all | today | week | month
  const { session, authState } = useSupabaseAuth();
  const { status: integrationStatus, loading: integrationLoading } = useIntegrationStatus();

  const connectedIntegrations = (integrationStatus?.integrations || []).filter(i => i.connected);
  const totalConnected = integrationStatus?.total_connected || connectedIntegrations.length;
  const integrationResolved = !integrationLoading && !!integrationStatus;
  const hasCRM = connectedIntegrations.some(i => (i.category || '').toLowerCase().includes('crm'));
  const hasEmail = connectedIntegrations.some(i => ['email', 'gmail', 'outlook'].some(k => (i.category || '').toLowerCase().includes(k) || (i.provider || '').toLowerCase().includes(k)));
  const hasAnyData = totalConnected > 0;

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/intelligence/watchtower', { timeout: 10000 });
      let events = res.data?.events || [];

      if (!events.length) {
        try {
          const fallback = await apiClient.get('/notifications/alerts', { timeout: 10000 });
          events = (fallback.data?.notifications || []).map((n, i) => ({
            id: n.id || i + 1,
            severity: n.severity || 'moderate',
            title: n.title || n.type,
            impact: n.message || '',
            action: n.action || 'Review and take appropriate action.',
            created_at: n.timestamp || new Date().toISOString(),
            source: n.source || 'notifications',
          }));
        } catch {
          events = [];
        }
      }

      if (events.length > 0) {
        const mapped = events.map((e, i) => ({
          id: e.id || i + 1,
          severity: e.severity || 'moderate',
          title: e.title || e.signal || e.event,
          impact: e.impact || e.detail || e.description || '',
          action: e.recommendation || e.action || 'Review and take appropriate action.',
          time: e.created_at ? timeAgo(e.created_at) : 'Recent',
          created_at: e.created_at || new Date().toISOString(),
          actions: e.severity === 'critical' || e.severity === 'high' ? ['email', 'handoff'] : ['handoff'],
        }));
        setAlerts(mapped);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    if (authState === AUTH_STATE.LOADING && !session?.access_token) return;
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    fetchAlerts();
  }, [session?.access_token, authState]);


  // Date range filter helper
  const isInRange = (dateStr) => {
    if (dateRange === 'all') return true;
    const d = new Date(dateStr);
    const now = new Date();
    if (dateRange === 'today') return d.toDateString() === now.toDateString();
    if (dateRange === 'week') return (now - d) < 7 * 86400000;
    if (dateRange === 'month') return (now - d) < 30 * 86400000;
    return true;
  };

  // Severity sort weight
  const sevWeight = { critical: 4, high: 3, moderate: 2, medium: 2, info: 1, low: 1 };

  const filtered = alerts
    .filter(a => filter === 'all' || a.severity === filter || (filter === 'critical' && a.severity === 'high'))
    .filter(a => isInRange(a.created_at))
    .sort((a, b) => {
      if (sortBy === 'severity') return (sevWeight[b.severity] || 0) - (sevWeight[a.severity] || 0);
      if (sortBy === 'date') return new Date(b.created_at) - new Date(a.created_at);
      return 0;
    });

  const critCount = loading ? null : alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length;
  const modCount = loading ? null : alerts.filter(a => a.severity === 'moderate' || a.severity === 'medium').length;
  const infoCount = loading ? null : alerts.filter(a => a.severity === 'info' || a.severity === 'low').length;
  const explainability = {
    whyVisible: hasAnyData
      ? `BIQc is reading ${totalConnected} connected system${totalConnected === 1 ? '' : 's'} and ranking active operational risk signals.`
      : 'Alert Centre activates when integrations are connected and producing live events.',
    whyNow: alerts.length > 0
      ? `${alerts.length} active alert${alerts.length === 1 ? '' : 's'} detected, including ${critCount || 0} critical priority item${critCount === 1 ? '' : 's'}.`
      : 'No active alerts at this moment, but monitoring remains active for new anomalies.',
    nextAction: alerts.length > 0
      ? 'Open each critical alert, assign action owner, and mark complete/ignore with rationale.'
      : 'Keep integrations connected and review this page daily for newly emerging issues.',
    ifIgnored: hasAnyData
      ? 'Unresolved alerts can quickly compound into client, delivery, or cashflow consequences.'
      : 'Without connected data, true issues can remain invisible until they become severe.',
  };
  const actionOwnership = {
    owner: (critCount || 0) > 0 ? 'Duty manager' : alerts.length > 0 ? 'Operations lead' : 'Monitoring owner',
    deadline: (critCount || 0) > 0 ? 'Within 4 hours' : alerts.length > 0 ? 'By next business day' : 'Continuous',
    checkpoint: (critCount || 0) > 0
      ? `Close ${critCount} critical alert${critCount === 1 ? '' : 's'} with owner + rationale.`
      : alerts.length > 0
        ? 'Review all open alerts and classify complete vs ignore with notes.'
        : 'Maintain daily watch cycle and keep integrations healthy.',
    successMetric: `Open alerts ${alerts.length} · critical ${critCount || 0} · moderate ${modCount || 0}`,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[900px]" style={{ fontFamily: fontFamily.body }} data-testid="alerts-page">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>— Alert Centre</div>
            <h1 className="font-medium" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>What needs your <em style={{ fontStyle: 'italic', color: '#E85D00' }}>attention</em>.</h1>
            <p className="text-sm text-[#8FA0B8]">
              {loading || integrationLoading
                ? 'Scanning connected data sources...'
                : alerts.length > 0
                  ? `${alerts.length} active alert${alerts.length !== 1 ? 's' : ''} requiring your attention.`
                  : hasAnyData
                    ? `All ${totalConnected} connected system${totalConnected !== 1 ? 's' : ''} are healthy — no issues detected.`
                    : !integrationResolved
                      ? 'Verifying connected systems before checking for alerts.'
                    : 'No data sources connected — connect your tools to activate monitoring.'}
              {loading && <span className="text-[10px] ml-2 text-[#E85D00]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>syncing...</span>}
            </p>
          </div>
        </div>

        <InsightExplainabilityStrip
          whyVisible={explainability.whyVisible}
          whyNow={explainability.whyNow}
          nextAction={explainability.nextAction}
          ifIgnored={explainability.ifIgnored}
          testIdPrefix="alerts-explainability"
        />

        <ActionOwnershipCard
          title="Alert closure owner plan"
          owner={actionOwnership.owner}
          deadline={actionOwnership.deadline}
          checkpoint={actionOwnership.checkpoint}
          successMetric={actionOwnership.successMetric}
          testIdPrefix="alerts-action-ownership"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[['Critical', critCount, '#E85D00'], ['Moderate', modCount, '#F59E0B'], ['Info', infoCount, '#3B82F6']].map(([l, v, c]) => (
            <div key={l} className="rounded-lg p-4 text-center" style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.15)' }}>
              {loading
                ? <Loader2 className="w-6 h-6 animate-spin mx-auto mb-1" style={{ color: c }} />
                : <span className="text-2xl font-bold block" style={{ fontFamily: fontFamily.mono, color: c }}>{v}</span>
              }
              <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{l}</span>
            </div>
          ))}
        </div>

        {/* Filter + Sort toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 flex-wrap">
            {[['all','All'],['critical','Critical'],['moderate','Moderate'],['info','Info']].map(([val,label]) => (
              <button key={val} onClick={() => setFilter(val)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: filter === val ? '#E85D00' : '#0E1628', color: filter === val ? 'white' : '#8FA0B8', border: `1px solid ${filter === val ? '#E85D00' : 'rgba(140,170,210,0.15)'}`, fontFamily: fontFamily.mono }}
                data-testid={`alerts-filter-${val}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-[rgba(140,170,210,0.15)] hidden sm:block" />
          <div className="flex gap-1.5 flex-wrap">
            {[['all','All time'],['today','Today'],['week','This week'],['month','This month']].map(([val,label]) => (
              <button key={val} onClick={() => setDateRange(val)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: dateRange === val ? 'rgba(140,170,210,0.15)' : 'transparent', color: dateRange === val ? '#EDF1F7' : '#64748B', border: `1px solid ${dateRange === val ? '#334155' : 'transparent'}`, fontFamily: fontFamily.mono }}
                data-testid={`alerts-date-range-${val}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Sort:</span>
            {[['severity','Severity'],['date','Date']].map(([val,label]) => (
              <button key={val} onClick={() => setSortBy(val)}
                className="px-2.5 py-1 rounded-md text-[10px] font-medium transition-all"
                style={{ background: sortBy === val ? '#E85D0015' : 'transparent', color: sortBy === val ? '#E85D00' : '#64748B', border: `1px solid ${sortBy === val ? '#E85D0030' : 'transparent'}`, fontFamily: fontFamily.mono }}
                data-testid={`alerts-sort-${val}`}>
                {label}
              </button>
            ))}
            <button onClick={fetchAlerts} className="ml-1 p-1.5 rounded-lg hover:bg-white/5" title="Refresh" style={{ color: loading ? '#E85D00' : '#64748B' }} data-testid="alerts-refresh-button">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {filtered.length > 0 ? (
            filtered.map(a => <AlertItem key={a.id} alert={a} />)
          ) : !loading ? (
            hasAnyData ? (
              /* Connected but no alerts — genuinely all clear */
              <div className="rounded-xl p-8 text-center" style={{ background: '#0E1628', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <Shield className="w-7 h-7 text-[#10B981]" />
                </div>
                <p className="text-base font-semibold text-[#EDF1F7] mb-2" style={{ fontFamily: fontFamily.display }}>
                  All clear — no issues detected.
                </p>
                <p className="text-sm text-[#8FA0B8] max-w-md mx-auto mb-1" style={{ fontFamily: fontFamily.body }}>
                  BIQc is actively monitoring {totalConnected} connected system{totalConnected !== 1 ? 's' : ''} in real time.
                  {hasCRM && ' Your HubSpot pipeline, deals and contacts are being watched.'}
                  {hasEmail && ' Your Outlook emails and calendar signals are being analysed.'}
                </p>
                <p className="text-xs text-[#64748B] mt-2" style={{ fontFamily: fontFamily.mono }}>
                  Alerts will appear here instantly when BIQc detects a risk, anomaly or action required.
                </p>
              </div>
            ) : (
              /* No integrations connected — explain WHY there are no alerts */
              <div className="rounded-xl p-8" style={{ background: '#0E1628', border: '1px solid rgba(232,93,0,0.2)' }}>
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(232,93,0,0.1)' }}>
                    <Bell className="w-6 h-6 text-[#E85D00]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#EDF1F7] mb-1" style={{ fontFamily: fontFamily.display }}>
                      No alerts — because no data is being monitored yet.
                    </p>
                    <p className="text-sm text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>
                      The Alert Centre can only surface issues from data it can see.
                      Without connected integrations, BIQc has nothing to watch — so zero alerts simply means zero visibility, not zero risk.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                  {[
                    { label: 'Connect CRM', desc: 'Watch for stalled deals, lead delays, churn signals', color: '#3B82F6', example: '"Zanda Health — 70h response delay"' },
                    { label: 'Connect Accounting', desc: 'Monitor cash flow gaps, overdue invoices, margin compression', color: '#10B981', example: '"Invoice $4,200 overdue 14 days"' },
                    { label: 'Connect Email', desc: 'Detect client disengagement, escalation patterns', color: '#8B5CF6', example: '"3 unanswered client emails this week"' },
                  ].map(item => (
                    <div key={item.label} className="rounded-lg p-4" style={{ background: '#0A1018', border: `1px solid ${item.color}20` }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: item.color, fontFamily: fontFamily.mono }}>{item.label}</p>
                      <p className="text-xs text-[#8FA0B8] mb-2" style={{ fontFamily: fontFamily.body }}>{item.desc}</p>
                      <p className="text-[10px] italic" style={{ color: '#4A5568', fontFamily: fontFamily.body }}>e.g. {item.example}</p>
                    </div>
                  ))}
                </div>

                <Link to="/integrations"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
                  style={{ background: '#E85D00', color: 'white', fontFamily: fontFamily.body }}
                  data-testid="alerts-connect-integrations">
                  <Plug className="w-4 h-4" /> Connect Integrations to Activate Alerts <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )
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
