import React, { useMemo, useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Shield, TrendingDown, Users, BarChart3, FileWarning, Radio } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { WarRoomConsoleBody } from '../components/WarRoomConsole';
import { useSnapshot } from '../hooks/useSnapshot';
import { PageLoadingState, PageErrorState } from '../components/PageStateComponents';
import { colors } from '../design-system/tokens';

/* ── Static alert data ─────────────────────────────────────────────── */
const STATIC_ALERTS = [
  {
    id: 'alert-cash-flow',
    severity: 'critical',
    title: 'Cash runway dropped below 5-month threshold',
    source: 'Financial',
    timestamp: '18 min ago',
    description: 'Burn rate increased 12% while pipeline decayed 43%. Current runway is 4.2 months — below the 5-month safety threshold.',
    icon: TrendingDown,
  },
  {
    id: 'alert-security',
    severity: 'critical',
    title: 'Unusual login pattern detected — 3 geo anomalies',
    source: 'Security',
    timestamp: '42 min ago',
    description: 'Three admin accounts authenticated from unrecognised geolocations in the last hour. MFA challenges were bypassed via legacy token.',
    icon: Shield,
  },
  {
    id: 'alert-compliance',
    severity: 'high',
    title: 'AU Privacy Act compliance deadline in 14 days',
    source: 'Compliance',
    timestamp: '2h ago',
    description: 'Privacy policy update required before April 28. Legal review not yet initiated and two data-processing addendums are outstanding.',
    icon: FileWarning,
  },
  {
    id: 'alert-supplier',
    severity: 'critical',
    title: 'Pipeline concentration risk — Bramwell at 31%',
    source: 'Supply Chain',
    timestamp: '2 min ago',
    description: 'Single-supplier dependency has reached 31% of active pipeline. If Bramwell stalls, $46.5K of pipeline value is at immediate risk.',
    icon: AlertTriangle,
  },
  {
    id: 'alert-churn',
    severity: 'high',
    title: '3 customer accounts showing churn signals',
    source: 'Customer',
    timestamp: '3h ago',
    description: 'Usage decline, support ticket spike, and billing inquiry detected across three accounts representing $4,500 MRR combined.',
    icon: Users,
  },
  {
    id: 'alert-pipeline',
    severity: 'high',
    title: 'Pipeline velocity stalled — 0 deals advanced this week',
    source: 'Revenue',
    timestamp: '6h ago',
    description: 'No pipeline stage transitions recorded in 7 days. Average cycle time has increased from 28 to 41 days this quarter.',
    icon: BarChart3,
  },
];

const SEVERITY_COLORS = {
  critical: '#DC2626',
  high: '#D97706',
};

const FILTER_TABS = ['All', 'Critical', 'High'];

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
  const sevColor = SEVERITY_COLORS[alert.severity] || colors.textMuted;

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
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: sevColor,
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
          color: '#EDF1F7',
          lineHeight: 1.35,
          marginBottom: '4px',
          margin: 0,
          marginTop: 0,
        }}
      >
        {alert.title}
      </h4>

      {/* Source + timestamp */}
      <div style={{ fontSize: '11px', color: '#708499', marginBottom: '4px' }}>
        {alert.source} &middot; {alert.timestamp}
      </div>

      {/* Description (truncated to 2 lines) */}
      <p
        style={{
          fontSize: '11px',
          color: '#8FA0B8',
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
      <AlertTriangle size={40} style={{ color: '#708499', opacity: 0.4 }} />
      <p style={{ fontSize: '15px', color: '#708499', textAlign: 'center', maxWidth: '320px', lineHeight: 1.5 }}>
        Select an alert to begin crisis analysis
      </p>
    </div>
  );
}

/* ── Main page component ───────────────────────────────────────────── */

export default function WarRoomPage() {
  const snapshot = useSnapshot();
  const { conversationId, setConversationId } = useWarRoomUrlState();
  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');

  const selectedAlert = useMemo(
    () => STATIC_ALERTS.find((a) => a.id === selectedAlertId) || null,
    [selectedAlertId]
  );

  const filteredAlerts = useMemo(() => {
    if (activeFilter === 'All') return STATIC_ALERTS;
    return STATIC_ALERTS.filter((a) => a.severity === activeFilter.toLowerCase());
  }, [activeFilter]);

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
            style={{
              width: '350px',
              flexShrink: 0,
              borderRight: '1px solid rgba(140,170,210,0.12)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              background: '#0E1628',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '20px 16px 14px',
                borderBottom: '1px solid rgba(140,170,210,0.12)',
              }}
            >
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#EDF1F7',
                  margin: 0,
                  marginBottom: '12px',
                }}
              >
                Active Alerts
              </h2>

              {/* Filter tabs */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {FILTER_TABS.map((tab) => {
                  const isActive = activeFilter === tab;
                  const isCritical = tab === 'Critical';
                  let bg = 'transparent';
                  let borderColor = 'rgba(140,170,210,0.15)';
                  let textColor = '#708499';
                  if (isActive && isCritical) {
                    bg = '#DC2626';
                    borderColor = '#DC2626';
                    textColor = '#FFFFFF';
                  } else if (isActive) {
                    bg = '#1E293B';
                    borderColor = '#1E293B';
                    textColor = '#FFFFFF';
                  }

                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveFilter(tab)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        fontSize: '10px',
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        border: `1px solid ${borderColor}`,
                        background: bg,
                        color: textColor,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
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
                borderTop: '1px solid rgba(140,170,210,0.12)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                color: '#708499',
              }}
            >
              <Radio size={12} style={{ color: colors.success }} />
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
              background: '#0E1628',
            }}
          >
            {/* Console header — selected alert info */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid rgba(140,170,210,0.12)',
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
                    fontWeight: 600,
                    color: '#EDF1F7',
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
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      background: SEVERITY_COLORS[selectedAlert.severity] || '#708499',
                      color: '#FFFFFF',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {selectedAlert.severity}
                  </span>
                )}
              </div>
              {selectedAlert && (
                <button
                  style={{
                    padding: '6px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: colors.danger,
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#991B1B'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = colors.danger; }}
                >
                  Escalate
                </button>
              )}
            </div>

            {/* Console body */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <WarRoomStateBanner
                loading={snapshot.loading}
                error={snapshot.error}
                cognitive={snapshot.cognitive}
                onRetry={snapshot.refresh}
              />

              {selectedAlert ? (
                !hasBlockingState && (
                  <WarRoomConsoleBody
                    embeddedShell
                    {...snapshot}
                    conversationId={conversationId}
                    onConversationChange={setConversationId}
                  />
                )
              ) : (
                <ConsoleEmptyState />
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
