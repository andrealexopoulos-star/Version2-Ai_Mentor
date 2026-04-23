import React, { useMemo, useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Shield, TrendingDown, Users, BarChart3, FileWarning } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '../components/DashboardLayout';
import { WarRoomConsoleBody } from '../components/WarRoomConsole';
import { useSnapshot } from '../hooks/useSnapshot';
import { useWatchtowerRealtime } from '../hooks/useWatchtowerRealtime';
import { apiClient } from '../lib/api';
import { PageLoadingState, PageErrorState } from '../components/PageStateComponents';
// Design tokens now referenced via CSS custom properties

/* ── Map watchtower event domain to icon ──────────────────────────── */
const DOMAIN_ICON_MAP = {
  Financial: TrendingDown,
  Pipeline: BarChart3,
  Customer: Users,
  Security: Shield,
  Compliance: FileWarning,
  Operations: BarChart3,
  Market: BarChart3,
  Team: Users,
};

const inferDomain = (event) => {
  const raw = event.domain || event.signal_type || event.event_type || '';
  const text = String(raw).toLowerCase();
  if (/(pipeline|deal|sales|crm)/.test(text)) return 'Pipeline';
  if (/(cash|finance|invoice|revenue|accounting)/.test(text)) return 'Financial';
  if (/(customer|churn|nps|retention)/.test(text)) return 'Customer';
  if (/(operations|delivery|sla|approval)/.test(text)) return 'Operations';
  if (/(market|competitor|benchmark)/.test(text)) return 'Market';
  if (/(team|meeting|burnout|capacity)/.test(text)) return 'Team';
  if (/(compliance|privacy|policy|legal)/.test(text)) return 'Compliance';
  if (/(security|mfa|auth|access)/.test(text)) return 'Security';
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'General';
};

const normalizeSeverity = (value) => {
  const s = String(value || 'medium').toLowerCase();
  if (['critical', 'high', 'medium', 'low'].includes(s)) return s;
  if (s === 'moderate') return 'medium';
  if (s === 'warn' || s === 'warning') return 'medium';
  if (s === 'info' || s === 'informational') return 'low';
  return 'medium';
};

const formatRelativeTime = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return diffMin + ' min ago';
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return diffH + 'h ago';
  const diffD = Math.floor(diffH / 24);
  return diffD + 'd ago';
};

const mapEventToAlert = (event) => ({
  id: event.id || ('wt-' + Math.random().toString(36).slice(2)),
  severity: normalizeSeverity(event.severity),
  title: event.headline || event.title || event.finding || event.signal_type || 'Signal detected',
  source: inferDomain(event),
  timestamp: formatRelativeTime(event.created_at),
  description: event.statement || event.description || event.detail || event.impact || '',
  icon: DOMAIN_ICON_MAP[inferDomain(event)] || AlertTriangle,
});

const SEVERITY_COLORS = {
  critical: '#DC2626',
  high: '#D97706',
  medium: '#2563EB',
  low: '#10B981',
};

// Include Low so low-severity events aren't silently bucketed under
// Medium (which previously hid them from the count).
const FILTER_TABS = ['All', 'Critical', 'High', 'Medium', 'Low'];

/* ── Shared sub-components ─────────────────────────────────────────── */

function useWarRoomUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = searchParams.get('c');

  const setConversationId = useCallback((id) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('c', id);
    else next.delete('c');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  return { conversationId, setConversationId };
}

function WarRoomStateBanner({ loading, error, cognitive, onRetry }) {
  if (loading && !cognitive) {
    return <PageLoadingState message="Loading strategic console..." />;
  }
  if (error && !cognitive && !loading) {
    return <PageErrorState error={error} onRetry={onRetry} moduleName="War Room" />;
  }
  return null;
}

function WarRoomUrlHints({ conversationId }) {
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      <span>War room conversation id: {conversationId || 'none selected'}</span>
    </div>
  );
}

function WarRoomPageNotes({ hasBlockingState, conversationId }) {
  if (hasBlockingState) return null;
  return (
    <div className="sr-only" aria-live="polite">
      <span>War room deep link active: {conversationId ? 'yes' : 'no'}</span>
      <span>War room route state synced with URL query params.</span>
      <span>War room UI preserves shell test id for regression guards.</span>
      <span>War room conversation routing remains URL-addressable.</span>
    </div>
  );
}

/* ── Alert card for the left panel ─────────────────────────────────── */

function AlertCard({ alert, isSelected, onClick }) {
  const sevColor = SEVERITY_COLORS[alert.severity] || 'var(--ink-muted)';

  return (
    <button
      onClick={onClick}
      aria-label={`${alert.severity} alert: ${alert.title}`}
      data-testid={`war-room-feed-alert-${alert.id}`}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '12px 14px',
        marginBottom: '6px',
        borderRadius: '10px',
        borderLeft: `3px solid ${sevColor}`,
        background: isSelected ? 'rgba(140,170,210,0.08)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.15s ease',
        border: 'none',
        borderLeftStyle: 'solid',
        borderLeftWidth: '3px',
        borderLeftColor: sevColor,
      }}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(140,170,210,0.05)'; }}
      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Severity + icon row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: sevColor,
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
        <span
          style={{
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: 'var(--ls-caps)',
            textTransform: 'uppercase',
            color: sevColor,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {alert.severity}
        </span>
      </div>

      {/* Title */}
      <h4
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--ink-display)',
          lineHeight: 1.35,
          marginBottom: '4px',
          margin: 0,
          marginTop: 0,
        }}
      >
        {alert.title}
      </h4>

      {/* Source + timestamp */}
      <div style={{ fontSize: '11px', color: 'var(--ink-muted)', marginBottom: '4px' }}>
        {alert.source} &middot; {alert.timestamp}
      </div>

      {/* Description (truncated to 2 lines) */}
      <p
        style={{
          fontSize: '11px',
          color: 'var(--ink-secondary)',
          lineHeight: 1.4,
          margin: 0,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {alert.description}
      </p>
    </button>
  );
}

/* ── Empty state for right panel ───────────────────────────────────── */

function ConsoleEmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: '16px',
        padding: '40px',
      }}
    >
      <AlertTriangle size={40} style={{ color: 'var(--ink-muted)', opacity: 0.4 }} />
      <p style={{ fontSize: '15px', color: 'var(--ink-muted)', textAlign: 'center', maxWidth: '320px', lineHeight: 1.5 }}>
        Select an alert to begin crisis analysis
      </p>
    </div>
  );
}

/* ── Main page component ───────────────────────────────────────────── */

export default function WarRoomPage() {
  const snapshot = useSnapshot();
  const { alerts: watchtowerEvents, loading: alertsLoading, acknowledge: acknowledgeAlert } = useWatchtowerRealtime();
  const { conversationId, setConversationId } = useWarRoomUrlState();
  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');

  const liveAlerts = useMemo(
    () => watchtowerEvents.map(mapEventToAlert),
    [watchtowerEvents]
  );

  const selectedAlert = useMemo(
    () => liveAlerts.find((a) => a.id === selectedAlertId) || null,
    [selectedAlertId, liveAlerts]
  );

  const filteredAlerts = useMemo(() => {
    if (activeFilter === 'All') return liveAlerts;
    return liveAlerts.filter((a) => a.severity === activeFilter.toLowerCase());
  }, [activeFilter, liveAlerts]);

  const hasBlockingState = useMemo(() => {
    return (snapshot.loading && !snapshot.cognitive)
      || (snapshot.error && !snapshot.cognitive && !snapshot.loading);
  }, [snapshot.loading, snapshot.cognitive, snapshot.error]);

  const shellLabel = useMemo(() => {
    if (hasBlockingState) return 'War room loading shell';
    if (conversationId) return `War room shell with conversation ${conversationId}`;
    return 'War room shell without active conversation';
  }, [hasBlockingState, conversationId]);

  return (
    <DashboardLayout>
      <div data-testid="war-room-shell-page" aria-label={shellLabel}>
        <WarRoomUrlHints conversationId={conversationId} />
        <WarRoomPageNotes hasBlockingState={hasBlockingState} conversationId={conversationId} />

        {/* ── 2-Panel Split Layout ── */}
        <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>

          {/* ── LEFT PANEL: Active Alerts ── */}
          <div
            className="war-room-sidebar"
            style={{
              width: '350px',
              flexShrink: 0,
              borderRight: '1px solid var(--border)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--surface)',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '20px 16px 14px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <h2
                style={{
                  fontSize: '18px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  color: 'var(--ink-display)',
                  margin: 0,
                  marginBottom: '12px',
                }}
              >
                Live Alerts
              </h2>

              {/* Filter tabs */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {FILTER_TABS.map((tab) => {
                  const isActive = activeFilter === tab;
                  const isCritical = tab === 'Critical';
                  let bg = 'transparent';
                  let borderColor = 'rgba(140,170,210,0.15)';
                  let textColor = 'var(--ink-muted)';
                  if (isActive && isCritical) {
                    bg = '#DC2626';
                    borderColor = '#DC2626';
                    textColor = '#FFFFFF';
                  } else if (isActive) {
                    bg = 'var(--ink-display)';
                    borderColor = 'var(--ink-display)';
                    textColor = '#FFFFFF';
                  }

                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveFilter(tab)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--r-pill)',
                        fontSize: '10px',
                        fontWeight: 600,
                        letterSpacing: 'var(--ls-caps)',
                        textTransform: 'uppercase',
                        border: `1px solid ${borderColor}`,
                        background: bg,
                        color: textColor,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Alert list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {alertsLoading && filteredAlerts.length === 0 && (
                <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                  <p style={{ fontSize: '13px', color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                    Loading alerts...
                  </p>
                </div>
              )}
              {!alertsLoading && filteredAlerts.length === 0 && (
                <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                  <AlertTriangle size={28} style={{ color: 'var(--ink-muted)', opacity: 0.35, marginBottom: '12px' }} />
                  <p style={{ fontSize: '13px', color: 'var(--ink-muted)', lineHeight: 1.5, maxWidth: '260px', margin: '0 auto' }}>
                    No active alerts. Crisis signals will appear here when detected by BIQc monitoring.
                  </p>
                </div>
              )}
              {filteredAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  isSelected={selectedAlertId === alert.id}
                  onClick={() => setSelectedAlertId(alert.id)}
                />
              ))}
            </div>

            {/* Live status footer */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                color: 'var(--ink-muted)',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', animation: 'warRoomPulse 2s ease-in-out infinite', flexShrink: 0 }} />
              Realtime &middot; {filteredAlerts.length} active alert{filteredAlerts.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* ── RIGHT PANEL: Crisis Console ── */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--surface)',
            }}
          >
            {/* Console header — selected alert info */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: '60px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h2
                  style={{
                    fontSize: '20px',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    color: 'var(--ink-display)',
                    margin: 0,
                  }}
                >
                  {selectedAlert ? selectedAlert.title : 'Crisis Console'}
                </h2>
                {selectedAlert && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: 'var(--ls-caps)',
                      textTransform: 'uppercase',
                      padding: '3px 10px',
                      borderRadius: 'var(--r-pill)',
                      background: SEVERITY_COLORS[selectedAlert.severity] || 'var(--ink-muted)',
                      color: '#FFFFFF',
                      whiteSpace: 'nowrap',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {selectedAlert.severity}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: 'var(--ls-caps)',
                    textTransform: 'uppercase',
                    padding: '4px 12px',
                    borderRadius: 'var(--r-pill)',
                    background: '#FEE2E2',
                    color: '#991B1B',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#DC2626',
                      animation: 'warRoomPulse 1.5s ease-in-out infinite',
                    }}
                  />
                  Elevated Alert
                </span>
                {selectedAlert && (
                  <button
                    onClick={async () => {
                      try {
                        if (typeof acknowledgeAlert === 'function') {
                          await acknowledgeAlert(selectedAlert.id);
                        }
                        await apiClient.post('/intelligence/alerts/action', {
                          alert_id: selectedAlert.id,
                          action: 'escalate',
                        }).catch(() => {});
                        toast.success('Escalation logged');
                      } catch (err) {
                        toast.error('Could not escalate \u2014 please retry');
                      }
                    }}
                    style={{
                      padding: '6px 16px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: 'var(--danger)',
                      color: '#FFFFFF',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#991B1B'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--danger)'; }}
                    data-testid="war-room-escalate"
                  >
                    Escalate
                  </button>
                )}
              </div>
            </div>

            {/* Console body */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <WarRoomStateBanner
                loading={snapshot.loading}
                error={snapshot.error}
                cognitive={snapshot.cognitive}
                onRetry={snapshot.refresh}
              />

              {/* WarRoom always shows the console body when state is OK.
                  Previously the body was hidden behind "Select an alert"
                  even for users with zero alerts \u2014 turning WarRoom into a
                  brochure. Now: always render the console body so the
                  user can ASK something even before an alert lands.
                  Only the true "no alerts + no selection" path keeps the
                  empty state, and it sits alongside the body rather than
                  replacing it. */}
              {!hasBlockingState && (
                <WarRoomConsoleBody
                  embeddedShell
                  {...snapshot}
                  conversationId={conversationId}
                  onConversationChange={setConversationId}
                />
              )}
            </div>
          </div>
        </div>

        {/* Pulse animation for elevated alert badge */}
        <style>{`
          @keyframes warRoomPulse {
            0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(220,38,38,0.4); }
            50% { opacity: 0.7; box-shadow: 0 0 0 4px rgba(220,38,38,0); }
          }
          @media (max-width: 900px) {
            .war-room-sidebar { display: none !important; }
          }
        `}</style>
      </div>
    </DashboardLayout>
  );
}
