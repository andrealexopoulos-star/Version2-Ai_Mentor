import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { useSupabaseAuth, AUTH_STATE } from '../context/SupabaseAuthContext';
import { Bell, Mail, MessageSquare, Users, Loader2, CheckCircle2, XCircle, Plug, ArrowRight, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { fontFamily } from '../design-system/tokens';
import { Link } from 'react-router-dom';


const sevMap = { critical: { color: '#E85D00', label: 'Critical' }, high: { color: '#F97316', label: 'High' }, moderate: { color: '#F59E0B', label: 'Moderate' }, info: { color: '#3B82F6', label: 'Info' }, medium: { color: '#F59E0B', label: 'Moderate' }, low: { color: '#10B981', label: 'Low' } };

const sevBorderMap = { critical: '#DC2626', high: '#E85D00', moderate: '#D97706', medium: '#D97706', warning: '#D97706', info: '#64748B', low: '#10B981' };
const sevPillBg = { critical: 'rgba(220,38,38,0.12)', high: 'rgba(232,93,0,0.12)', moderate: 'rgba(217,119,6,0.12)', medium: 'rgba(217,119,6,0.12)', warning: 'rgba(217,119,6,0.12)', info: 'rgba(100,116,139,0.12)', low: 'rgba(16,185,129,0.12)' };

const AlertItem = ({ alert, onAction }) => {
  const [actioned, setActioned] = useState(null);
  const s = sevMap[alert.severity] || sevMap.info;
  const borderColor = sevBorderMap[alert.severity] || '#64748B';

  const handleAction = async (action) => {
    setActioned(action);
    try {
      await apiClient.post('/intelligence/alerts/action', { alert_id: alert.id, action });
      toast.success(action === 'complete' ? 'Alert marked as complete' : 'Alert dismissed');
    } catch {
      toast.error('Action failed — please try again');
    }
  };

  const isResolved = actioned === 'complete' || actioned === 'ignore';

  return (
    <div
      className="rounded-lg overflow-hidden mb-3"
      style={{
        background: isResolved ? 'var(--surface-2, #121D30)' : 'var(--surface, #0E1628)',
        border: '1px solid var(--border, rgba(140,170,210,0.12))',
        borderLeft: `4px solid ${borderColor}`,
        opacity: isResolved ? 0.55 : 1,
      }}
      data-testid={`alert-${alert.id}`}
    >
      {/* Header: meta + severity pill + time */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full font-semibold" style={{ fontFamily: fontFamily.mono, color: borderColor, background: sevPillBg[alert.severity] || 'rgba(100,116,139,0.12)' }}>{s.label}</span>
            {alert.source && <span className="text-[10px] px-2 py-0.5 rounded" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-secondary, #8FA0B8)', background: 'var(--surface-2, #121D30)' }}>{alert.source}</span>}
          </div>
          <span className="text-[11px] shrink-0" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-muted, #708499)' }}>{alert.time}</span>
        </div>
        {/* Title */}
        <h3 className="mt-2" style={{ fontFamily: fontFamily.display, fontSize: '22px', color: isResolved ? 'var(--ink-muted, #708499)' : 'var(--ink-display, #EDF1F7)', lineHeight: 1.2, letterSpacing: '-0.01em', textDecoration: isResolved ? 'line-through' : 'none' }}>
          {alert.title}
        </h3>
        {/* Body text */}
        {alert.impact && (
          <p className="mt-1.5 text-sm" style={{ fontFamily: fontFamily.body, color: 'var(--ink-secondary, #8FA0B8)', lineHeight: 1.6 }}>{alert.impact}</p>
        )}
      </div>

      {/* Evidence block */}
      {(alert.evidence || alert.action) && (
        <div className="mx-5 mt-1 mb-3 px-4 py-3 rounded-lg flex flex-wrap gap-4" style={{ background: 'var(--surface-2, #121D30)' }}>
          {alert.evidence ? (
            (Array.isArray(alert.evidence) ? alert.evidence : [{ label: 'Recommended action', value: alert.action }]).map((ev, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase tracking-wider" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-muted, #708499)' }}>{ev.label}</span>
                <span className="text-sm font-medium" style={{ fontFamily: fontFamily.body, color: 'var(--ink-display, #EDF1F7)' }}>{ev.value}</span>
              </div>
            ))
          ) : alert.action ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-muted, #708499)' }}>Recommended action</span>
              <span className="text-sm" style={{ fontFamily: fontFamily.body, color: 'var(--ink-display, #EDF1F7)' }}>{alert.action}</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Action buttons — always visible */}
      {!isResolved && (
        <div className="px-5 pb-4 flex flex-wrap gap-2">
          {alert.actions?.includes('email') && <button className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all hover:border-[#E85D00] hover:text-[#E85D00]" style={{ background: 'var(--surface, #0E1628)', border: '1px solid var(--border, rgba(140,170,210,0.12))', color: 'var(--ink, #8FA0B8)' }} data-testid={`alert-auto-email-${alert.id}`}><Mail className="w-3.5 h-3.5" />Auto-Email</button>}
          {alert.actions?.includes('sms') && <button className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all hover:border-[#E85D00] hover:text-[#E85D00]" style={{ background: 'var(--surface, #0E1628)', border: '1px solid var(--border, rgba(140,170,210,0.12))', color: 'var(--ink, #8FA0B8)' }} data-testid={`alert-quick-sms-${alert.id}`}><MessageSquare className="w-3.5 h-3.5" />Quick-SMS</button>}
          {alert.actions?.includes('handoff') && <button className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all hover:border-[#E85D00] hover:text-[#E85D00]" style={{ background: 'var(--surface, #0E1628)', border: '1px solid var(--border, rgba(140,170,210,0.12))', color: 'var(--ink, #8FA0B8)' }} data-testid={`alert-hand-off-${alert.id}`}><Users className="w-3.5 h-3.5" />Hand Off</button>}
          <button onClick={() => handleAction('complete')} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all hover:brightness-110" style={{ background: '#E85D00', color: 'white', border: '1px solid #E85D00' }} data-testid={`alert-complete-${alert.id}`}><CheckCircle2 className="w-3.5 h-3.5" />Resolve</button>
          <button onClick={() => handleAction('ignore')} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all hover:text-[var(--ink)]" style={{ background: 'transparent', border: '1px solid transparent', color: 'var(--ink-muted, #708499)' }} data-testid={`alert-ignore-${alert.id}`}><XCircle className="w-3.5 h-3.5" />Ignore</button>
        </div>
      )}
      {isResolved && (
        <div className="px-5 pb-3 flex items-center gap-2">
          {actioned === 'complete' ? <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" /> : <XCircle className="w-3.5 h-3.5 text-[#64748B]" />}
          <span className="text-[11px] uppercase tracking-wider" style={{ fontFamily: fontFamily.mono, color: actioned === 'complete' ? '#10B981' : '#64748B' }}>{actioned === 'complete' ? 'Resolved' : 'Dismissed'}</span>
        </div>
      )}
    </div>
  );
};

const AlertsPageAuth = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
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
    .filter(a => filter === 'all' || a.severity === filter || (filter === 'resolved' && (a.severity === 'info' || a.severity === 'low')))
    .filter(a => isInRange(a.created_at))
    .filter(a => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (a.title || '').toLowerCase().includes(q) ||
             (a.impact || '').toLowerCase().includes(q) ||
             (a.action || '').toLowerCase().includes(q) ||
             (a.source || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'severity') return (sevWeight[b.severity] || 0) - (sevWeight[a.severity] || 0);
      if (sortBy === 'date') return new Date(b.created_at) - new Date(a.created_at);
      return 0;
    });

  const critCount = loading ? null : alerts.filter(a => a.severity === 'critical').length;
  const highCount = loading ? null : alerts.filter(a => a.severity === 'high').length;
  const modCount = loading ? null : alerts.filter(a => a.severity === 'moderate' || a.severity === 'medium').length;
  const infoCount = loading ? null : alerts.filter(a => a.severity === 'info' || a.severity === 'low').length;
  const urgentCount = (critCount || 0) + (highCount || 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[900px]" style={{ fontFamily: fontFamily.body }} data-testid="alerts-page">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>— Alert centre · Live</div>
            <h1 className="font-medium" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>{alerts.length || 5} things <em style={{ fontStyle: 'italic', color: '#E85D00' }}>need a decision</em>.</h1>
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Critical', value: critCount, dot: '#DC2626' },
            { label: 'High', value: highCount, dot: '#E85D00' },
            { label: 'Warning', value: modCount, dot: '#D97706' },
            { label: 'Resolved', value: infoCount, dot: '#16A34A' },
          ].map(({ label, value, dot }) => (
            <div key={label} style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)', borderRadius: 12, padding: '20px' }}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, display: 'inline-block' }} />
                <span style={{ fontFamily: fontFamily.mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-secondary, #8FA0B8)' }}>{label}</span>
              </div>
              <span style={{ fontFamily: fontFamily.display, fontSize: 28, color: 'var(--ink-display, #EDF1F7)', display: 'block', lineHeight: 1 }}>{loading ? '\u2014' : value}</span>
            </div>
          ))}
        </div>

        {/* Filter + Search toolbar */}
        <div className="flex items-center gap-3 flex-wrap" data-testid="alerts-toolbar">
          {[['all','All'],['critical','Critical'],['high','High'],['moderate','Watching'],['resolved','Resolved']].map(([val,label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className="px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all"
              style={{
                background: filter === val ? 'var(--surface-sunken, #060A12)' : 'transparent',
                color: filter === val ? 'var(--ink-display, #EDF1F7)' : '#8FA0B8',
                border: filter === val ? '1px solid rgba(140,170,210,0.2)' : '1px solid rgba(140,170,210,0.08)',
                fontFamily: fontFamily.mono,
              }}
              data-testid={`alerts-filter-${val}`}>
              {label}
            </button>
          ))}
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter by deal, contact, source..."
            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg text-sm alerts-toolbar-search"
            style={{
              background: 'var(--surface, #0E1628)',
              border: '1px solid rgba(140,170,210,0.12)',
              color: 'var(--ink-display, #EDF1F7)',
              fontFamily: fontFamily.body,
              outline: 'none',
            }}
            data-testid="alerts-search-input"
          />
          <style>{`
            .alerts-toolbar-search::placeholder { color: #5C6E82 !important; }
          `}</style>
        </div>

        <div className="space-y-3">
          {filtered.length > 0 ? (
            filtered.map(a => <AlertItem key={a.id} alert={a} />)
          ) : !loading ? (
            hasAnyData ? (
              /* Connected but no alerts — genuinely all clear */
              <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(16,185,129,0.2)' }}>
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
              <div className="rounded-xl p-8" style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(232,93,0,0.2)' }}>
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
