import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { apiClient } from '../lib/api';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { useSupabaseAuth, AUTH_STATE } from '../context/SupabaseAuthContext';
import { Bell, Mail, MessageSquare, Users, Loader2, CheckCircle2, XCircle, Plug, ArrowRight, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { fontFamily } from '../design-system/tokens';
import { Link } from 'react-router-dom';


const sevMap = { critical: { color: 'var(--danger, #DC2626)', label: 'Critical' }, high: { color: 'var(--lava, #E85D00)', label: 'High' }, moderate: { color: 'var(--warning, #D97706)', label: 'Moderate' }, info: { color: 'var(--info, #3B82F6)', label: 'Info' }, medium: { color: 'var(--warning, #D97706)', label: 'Moderate' }, low: { color: 'var(--positive, #10B981)', label: 'Low' } };

const sevBorderMap = { critical: 'var(--danger, #DC2626)', high: 'var(--lava, #E85D00)', moderate: 'var(--warning, #D97706)', medium: 'var(--warning, #D97706)', warning: 'var(--warning, #D97706)', info: 'var(--silver-4, #64748B)', low: 'var(--positive, #10B981)' };
const sevPillBg = { critical: 'rgba(220,38,38,0.12)', high: 'var(--lava-wash, rgba(232,93,0,0.12))', moderate: 'rgba(217,119,6,0.12)', medium: 'rgba(217,119,6,0.12)', warning: 'rgba(217,119,6,0.12)', info: 'var(--silver-2, rgba(100,116,139,0.12))', low: 'rgba(16,185,129,0.12)' };

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
      className="overflow-hidden mb-3"
      style={{
        background: isResolved ? 'var(--surface-2, #F1F5F9)' : 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: 'var(--r-lg, 12px)',
        opacity: isResolved ? 0.55 : 1,
        transition: 'all 200ms ease',
      }}
      data-testid={`alert-${alert.id}`}
    >
      {/* Header: meta + severity pill + time */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase px-2.5 py-0.5 font-semibold" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', color: borderColor, background: sevPillBg[alert.severity] || 'rgba(100,116,139,0.12)', borderRadius: 'var(--r-pill, 100px)' }}>{s.label}</span>
            {alert.source && <span className="text-[10px] px-2 py-0.5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-secondary)', background: 'var(--surface-2, #F1F5F9)', borderRadius: 'var(--r-xs, 4px)' }}>{alert.source}</span>}
          </div>
          <span className="text-[11px] shrink-0" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>{alert.time}</span>
        </div>
        {/* Title */}
        <h3 className="mt-2" style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: isResolved ? 'var(--ink-muted)' : 'var(--ink-display)', lineHeight: 1.2, letterSpacing: 'var(--ls-tight, -0.01em)', textDecoration: isResolved ? 'line-through' : 'none' }}>
          {alert.title}
        </h3>
        {/* Body text */}
        {alert.impact && (
          <p className="mt-1.5 text-sm" style={{ fontFamily: 'var(--font-ui)', color: 'var(--ink-secondary)', lineHeight: 1.6 }}>{alert.impact}</p>
        )}
      </div>

      {/* Evidence block */}
      {(alert.evidence || alert.action) && (
        <div className="mx-5 mt-1 mb-3 px-4 py-3 flex flex-wrap gap-4" style={{ background: 'var(--surface-2, #F1F5F9)', borderRadius: 'var(--r-md, 8px)' }}>
          {alert.evidence ? (
            (Array.isArray(alert.evidence) ? alert.evidence : [{ label: 'Recommended action', value: alert.action }]).map((ev, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <span className="text-[10px] uppercase" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-muted)' }}>{ev.label}</span>
                <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-ui)', color: 'var(--ink-display)' }}>{ev.value}</span>
              </div>
            ))
          ) : alert.action ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-muted)' }}>Recommended action</span>
              <span className="text-sm" style={{ fontFamily: 'var(--font-ui)', color: 'var(--ink-display)' }}>{alert.action}</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Action buttons — always visible */}
      {!isResolved && (
        <div className="px-5 pb-4 flex flex-wrap gap-2">
          {alert.actions?.includes('email') && <button onClick={() => handleAction('auto-email')} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium transition-all hover:border-[var(--lava)] hover:text-[var(--lava)]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md, 8px)', color: 'var(--ink)', fontFamily: 'var(--font-ui)' }} data-testid={`alert-auto-email-${alert.id}`}><Mail className="w-3.5 h-3.5" />Auto-Email</button>}
          {alert.actions?.includes('sms') && <button onClick={() => handleAction('quick-sms')} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium transition-all hover:border-[var(--lava)] hover:text-[var(--lava)]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md, 8px)', color: 'var(--ink)', fontFamily: 'var(--font-ui)' }} data-testid={`alert-quick-sms-${alert.id}`}><MessageSquare className="w-3.5 h-3.5" />Quick-SMS</button>}
          {alert.actions?.includes('handoff') && <button onClick={() => handleAction('hand-off')} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium transition-all hover:border-[var(--lava)] hover:text-[var(--lava)]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md, 8px)', color: 'var(--ink)', fontFamily: 'var(--font-ui)' }} data-testid={`alert-hand-off-${alert.id}`}><Users className="w-3.5 h-3.5" />Hand Off</button>}
          <button onClick={() => handleAction('complete')} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold transition-all hover:brightness-110" style={{ background: 'var(--lava, #E85D00)', color: 'white', border: '1px solid var(--lava, #E85D00)', borderRadius: 'var(--r-md, 8px)', fontFamily: 'var(--font-ui)' }} data-testid={`alert-complete-${alert.id}`}><CheckCircle2 className="w-3.5 h-3.5" />Resolve</button>
          <button onClick={() => handleAction('ignore')} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium transition-all hover:text-[var(--ink)]" style={{ background: 'transparent', border: '1px solid transparent', borderRadius: 'var(--r-md, 8px)', color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }} data-testid={`alert-ignore-${alert.id}`}><XCircle className="w-3.5 h-3.5" />Ignore</button>
        </div>
      )}
      {isResolved && (
        <div className="px-5 pb-3 flex items-center gap-2">
          {actioned === 'complete' ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--positive, #10B981)' }} /> : <XCircle className="w-3.5 h-3.5" style={{ color: 'var(--ink-muted)' }} />}
          <span className="text-[11px] uppercase" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', color: actioned === 'complete' ? 'var(--positive, #10B981)' : 'var(--silver-4, #64748B)' }}>{actioned === 'complete' ? 'Resolved' : 'Dismissed'}</span>
        </div>
      )}
    </div>
  );
};

const AlertsPageAuth = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
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
    setFetchError(null);
    try {
      let fetchedEventsCount = 0;
      let anyEndpointSucceeded = false;
      let events = [];
      try {
        const res = await apiClient.get('/intelligence/watchtower', { timeout: 10000 });
        anyEndpointSucceeded = true;
        events = res.data?.events || [];
        fetchedEventsCount = events.length;
      } catch (wtErr) {
        console.warn('[alerts] /intelligence/watchtower failed:', wtErr?.message);
      }

      if (!fetchedEventsCount) {
        try {
          const fallback = await apiClient.get('/notifications/alerts', { timeout: 10000 });
          anyEndpointSucceeded = true;
          events = (fallback.data?.notifications || []).map((n, i) => ({
            id: n.id || i + 1,
            severity: n.severity || 'moderate',
            title: n.title || n.type,
            impact: n.message || '',
            action: n.action || 'Review and take appropriate action.',
            created_at: n.timestamp || new Date().toISOString(),
            source: n.source || 'notifications',
          }));
        } catch (nfErr) {
          console.warn('[alerts] /notifications/alerts fallback failed:', nfErr?.message);
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
      } else if (!anyEndpointSucceeded) {
        // Both endpoints failed \u2014 surface a banner so the user can retry
        // instead of seeing a blank page with no explanation (zero-401 rule).
        setFetchError('Alert service temporarily unavailable.');
      }
    } catch (err) {
      setFetchError(err?.message || 'Alert service temporarily unavailable.');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (authState === AUTH_STATE.LOADING && !session?.access_token) return;
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    fetchAlerts();
    // 2026-04-23: add 60s refresh so alerts arrive without a full reload.
    // Keeps using the existing fetchAlerts path — no architecture change,
    // no new endpoint. Cleared on unmount or auth-state change.
    const pollId = setInterval(() => {
      fetchAlerts();
    }, 60_000);
    return () => clearInterval(pollId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Watching = moderate + medium (both map to the same visual tier).
    // Resolved uses info + low as proxy until the server exposes a proper
    // resolved state. Filter now correctly covers both.
    .filter(a => filter === 'all'
      || a.severity === filter
      || (filter === 'moderate' && (a.severity === 'moderate' || a.severity === 'medium'))
      || (filter === 'resolved' && (a.severity === 'info' || a.severity === 'low')))
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
      <div className="space-y-6 max-w-[900px]" style={{ fontFamily: 'var(--font-ui)' }} data-testid="alerts-page">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-[11px] uppercase mb-2" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--lava)' }}>— Alert centre · Live</div>
            <h1 className="font-medium" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: 'var(--ls-display, -0.035em)', lineHeight: 1.05 }}>{loading ? '\u2014' : urgentCount} thing{urgentCount === 1 ? '' : 's'} <em style={{ fontStyle: 'italic', color: 'var(--lava)' }}>need a decision</em>.</h1>
            <p className="text-sm" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
              {loading || integrationLoading
                ? 'Scanning connected data sources...'
                : alerts.length > 0
                  ? `${alerts.length} active alert${alerts.length !== 1 ? 's' : ''} requiring your attention.`
                  : hasAnyData
                    ? `All ${totalConnected} connected system${totalConnected !== 1 ? 's' : ''} are healthy — no issues detected.`
                    : !integrationResolved
                      ? 'Verifying connected systems before checking for alerts.'
                    : 'No data sources connected — connect your tools to activate monitoring.'}
              {loading && <span className="text-[10px] ml-2" style={{ fontFamily: 'var(--font-mono)', color: 'var(--lava)' }}>syncing...</span>}
            </p>
          </div>
        </div>

        {fetchError && (
          <div role="alert" className="px-4 py-3 text-sm flex items-center justify-between gap-3" style={{ background: 'var(--warning-wash)', border: '1px solid var(--warning)', borderRadius: 'var(--r-lg, 12px)', color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }} data-testid="alerts-fetch-error">
            <span>Alert service temporarily unavailable \u2014 retrying automatically.</span>
            <button onClick={fetchAlerts} className="text-[12px] px-3 py-1 rounded-full" style={{ background: 'var(--warning)', color: 'white', fontFamily: 'var(--font-mono)' }} data-testid="alerts-retry-btn">Retry now</button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Critical', value: critCount, dot: 'var(--danger, #DC2626)' },
            { label: 'High', value: highCount, dot: 'var(--lava, #E85D00)' },
            { label: 'Warning', value: modCount, dot: 'var(--warning, #D97706)' },
            { label: 'Resolved', value: infoCount, dot: 'var(--positive, #16A34A)' },
          ].map(({ label, value, dot }) => (
            <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg, 12px)', padding: '20px', transition: 'all 200ms ease' }}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, display: 'inline-block' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-muted)' }}>{label}</span>
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink-display)', display: 'block', lineHeight: 1 }}>{loading ? '\u2014' : value}</span>
            </div>
          ))}
        </div>

        {/* Filter + Search toolbar */}
        <div className="flex items-center gap-3 flex-wrap" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg, 12px)', padding: '12px 16px' }} data-testid="alerts-toolbar">
          {[['all','All'],['critical','Critical'],['high','High'],['moderate','Watching'],['resolved','Resolved']].map(([val,label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className="text-xs cursor-pointer transition-all"
              style={{
                padding: '6px 14px',
                background: filter === val ? 'var(--lava, #E85D00)' : 'transparent',
                color: filter === val ? 'white' : 'var(--ink-secondary)',
                border: filter === val ? '1px solid var(--lava)' : '1px solid var(--border)',
                borderRadius: 'var(--r-pill, 100px)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 'var(--ls-caps, 0.08em)',
              }}
              data-testid={`alerts-filter-${val}`}>
              {label}
            </button>
          ))}
          <div className="flex-1 min-w-[200px] flex items-center gap-2" style={{ background: 'var(--surface-2, #F1F5F9)', border: '1px solid var(--border)', borderRadius: 'var(--r-md, 8px)', padding: '8px 14px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter by deal, contact, source..."
              className="w-full text-[13px] alerts-toolbar-search"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--ink)',
                fontFamily: 'var(--font-ui)',
                outline: 'none',
              }}
              data-testid="alerts-search-input"
            />
          </div>
          <style>{`
            .alerts-toolbar-search::placeholder { color: var(--ink-muted) !important; }
          `}</style>
        </div>

        <div className="space-y-3">
          {filtered.length > 0 ? (
            filtered.map(a => <AlertItem key={a.id} alert={a} />)
          ) : !loading ? (
            hasAnyData ? (
              /* Connected but no alerts — genuinely all clear */
              <div className="p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--positive, #10B981)33', borderRadius: 'var(--r-xl, 16px)' }}>
                <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--positive-wash, rgba(16,185,129,0.1))' }}>
                  <Shield className="w-7 h-7" style={{ color: 'var(--positive, #10B981)' }} />
                </div>
                <p className="text-base font-semibold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>
                  All clear — no issues detected.
                </p>
                <p className="text-sm max-w-md mx-auto mb-1" style={{ fontFamily: 'var(--font-ui)', color: 'var(--ink-secondary)' }}>
                  BIQc is actively monitoring {totalConnected} connected system{totalConnected !== 1 ? 's' : ''} in real time.
                  {hasCRM && ' Your CRM pipeline, deals and contacts are being watched.'}
                  {hasEmail && ' Your email inbox and calendar signals are being analysed.'}
                </p>
                <p className="text-xs mt-2" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
                  Alerts will appear here instantly when BIQc detects a risk, anomaly or action required.
                </p>
              </div>
            ) : (
              /* No integrations connected — explain WHY there are no alerts */
              <div className="p-8" style={{ background: 'var(--surface)', border: '1px solid var(--lava, #E85D00)33', borderRadius: 'var(--r-xl, 16px)' }}>
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-12 h-12 flex items-center justify-center flex-shrink-0" style={{ background: 'var(--lava-wash, rgba(232,93,0,0.1))', borderRadius: 'var(--r-lg, 12px)' }}>
                    <Bell className="w-6 h-6" style={{ color: 'var(--lava)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>
                      Alerts need connected data — Ask BIQc works right now.
                    </p>
                    <p className="text-sm" style={{ fontFamily: 'var(--font-ui)', color: 'var(--ink-secondary)' }}>
                      The Alert Centre monitors CRM, email, and accounting signals for anomalies — so it's gated on those integrations.
                      Meanwhile, Ask BIQc is fully available and can answer strategic questions, generate plans, and critique decisions without any connectors.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                  {[
                    { label: 'Connect CRM', desc: 'Watch for stalled deals, lead delays, churn signals', color: 'var(--info, #3B82F6)', example: '"Zanda Health — 70h response delay"' },
                    { label: 'Connect Accounting', desc: 'Monitor cash flow gaps, overdue invoices, margin compression', color: 'var(--positive, #10B981)', example: '"Invoice $4,200 overdue 14 days"' },
                    { label: 'Connect Email', desc: 'Detect client disengagement, escalation patterns', color: '#8B5CF6', example: '"3 unanswered client emails this week"' },
                  ].map(item => (
                    <div key={item.label} className="p-4" style={{ background: 'var(--surface-sunken, #F8FAFC)', border: `1px solid ${item.color}20`, borderRadius: 'var(--r-lg, 12px)' }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: item.color, fontFamily: 'var(--font-mono)' }}>{item.label}</p>
                      <p className="text-xs mb-2" style={{ fontFamily: 'var(--font-ui)', color: 'var(--ink-secondary)' }}>{item.desc}</p>
                      <p className="text-[10px] italic" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>e.g. {item.example}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link to="/integrations"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all hover:brightness-110"
                    style={{ background: 'var(--lava, #E85D00)', color: 'white', fontFamily: 'var(--font-ui)', borderRadius: 'var(--r-xl, 16px)' }}
                    data-testid="alerts-connect-integrations">
                    <Plug className="w-4 h-4" /> Connect integrations to activate alerts <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link to="/soundboard"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all hover:brightness-110"
                    style={{ background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border-strong)', fontFamily: 'var(--font-ui)', borderRadius: 'var(--r-xl, 16px)' }}
                    data-testid="alerts-use-ask-biqc">
                    Use Ask BIQc now <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
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
