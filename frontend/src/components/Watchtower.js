// FILE: src/components/Watchtower.js
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
// lucide-react icons available for future use but not rendered currently
import DashboardLayout from './DashboardLayout';
import { useWatchtowerRealtime } from '../hooks/useWatchtowerRealtime';

const PERIODS = ['24h', '7d', '30d', '90d'];

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

const SEVERITY_BADGE = {
  critical: { bg: '#FEE2E2', text: '#991B1B', label: 'Critical' },
  high:     { bg: '#FEF3C7', text: '#92400E', label: 'High' },
  medium:   { bg: '#DBEAFE', text: '#1E40AF', label: 'Medium' },
  low:      { bg: '#D1FAE5', text: '#065F46', label: 'Low' },
};

const STATUS_STYLE = {
  active:       { bg: '#FEE2E2', text: '#991B1B', label: 'Active' },
  acknowledged: { bg: '#FEF3C7', text: '#92400E', label: 'Handled' },
  handled:      { bg: '#FEF3C7', text: '#92400E', label: 'Handled' },
  resolved:     { bg: '#D1FAE5', text: '#065F46', label: 'Resolved' },
  dismissed:    { bg: '#D1FAE5', text: '#065F46', label: 'Resolved' },
};

const FILTER_ACTIVE_BG = {
  all:      '#1E293B',
  critical: '#DC2626',
  high:     '#D97706',
  medium:   '#2563EB',
};

const normalizeSeverity = (value) => {
  const s = String(value || 'medium').toLowerCase();
  if (SEVERITY_RANK[s] !== undefined) return s;
  if (s === 'moderate') return 'medium';
  return 'medium';
};

const normalizeStatus = (value) => {
  const s = String(value || 'active').toLowerCase();
  if (STATUS_STYLE[s]) return s;
  return 'active';
};

const formatEventDate = (dateString) => {
  if (!dateString) return { date: '', time: '' };
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return { date, time };
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

const eventTitle = (event) =>
  event.headline || event.title || event.finding || event.signal_type || 'Signal detected';

const eventDescription = (event) =>
  event.statement || event.description || event.detail || event.impact || '';

const filterByPeriod = (events, period) => {
  const now = Date.now();
  const ms = { '24h': 86400000, '7d': 604800000, '30d': 2592000000, '90d': 7776000000 };
  const cutoff = now - (ms[period] || ms['7d']);
  return events.filter((e) => {
    const t = new Date(e.created_at || 0).getTime();
    return t >= cutoff;
  });
};

const Watchtower = () => {
  const navigate = useNavigate();
  const { alerts, loading, error } = useWatchtowerRealtime();
  const [period, setPeriod] = useState('7d');
  const [severityFilter, setSeverityFilter] = useState('all');

  const periodEvents = useMemo(() => filterByPeriod(alerts, period), [alerts, period]);

  const filteredEvents = useMemo(() => {
    const sorted = [...periodEvents].sort((a, b) => {
      const rankA = SEVERITY_RANK[normalizeSeverity(a.severity)] ?? 9;
      const rankB = SEVERITY_RANK[normalizeSeverity(b.severity)] ?? 9;
      if (rankA !== rankB) return rankA - rankB;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
    if (severityFilter === 'all') return sorted;
    return sorted.filter((e) => normalizeSeverity(e.severity) === severityFilter);
  }, [periodEvents, severityFilter]);

  // KPI computations
  const kpis = useMemo(() => {
    const total = periodEvents.length;
    const critical = periodEvents.filter((e) => normalizeSeverity(e.severity) === 'critical').length;
    const high = periodEvents.filter((e) => normalizeSeverity(e.severity) === 'high').length;
    const resolved = periodEvents.filter((e) => {
      const s = normalizeStatus(e.status);
      return s === 'resolved' || s === 'dismissed';
    }).length;

    // Avg response time (hours) for resolved events
    const resolvedWithTime = periodEvents.filter((e) => {
      const s = normalizeStatus(e.status);
      return (s === 'resolved' || s === 'dismissed' || s === 'acknowledged' || s === 'handled') && e.handled_at && e.created_at;
    });
    let avgResponse = null;
    if (resolvedWithTime.length > 0) {
      const totalHours = resolvedWithTime.reduce((sum, e) => {
        const diff = new Date(e.handled_at).getTime() - new Date(e.created_at).getTime();
        return sum + Math.max(0, diff / (1000 * 60 * 60));
      }, 0);
      avgResponse = (totalHours / resolvedWithTime.length).toFixed(1);
    }

    return { total, critical, high, resolved, avgResponse };
  }, [periodEvents]);

  // Severity filter counts
  const filterCounts = useMemo(() => ({
    all: periodEvents.length,
    critical: periodEvents.filter((e) => normalizeSeverity(e.severity) === 'critical').length,
    high: periodEvents.filter((e) => normalizeSeverity(e.severity) === 'high').length,
    medium: periodEvents.filter((e) => normalizeSeverity(e.severity) === 'medium').length,
  }), [periodEvents]);

  return (
    <DashboardLayout>
      <div
        className="min-h-[calc(100vh-56px)]"
        style={{
          background: 'radial-gradient(circle at 15% -10%, var(--lava-wash), transparent 35%), var(--canvas-app)',
          fontFamily: 'var(--font-ui)',
        }}
        data-testid="watchtower-screen"
      >
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">

          {/* ── HEADER ── */}
          <div
            className="mb-6 flex flex-wrap items-center justify-between gap-3"
            data-testid="wt-header"
          >
            <h1
              className="font-semibold"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '28px',
                color: 'var(--ink-display)',
                letterSpacing: 'var(--ls-display)',
              }}
            >
              Watchtower
            </h1>
            <div
              className="inline-flex items-center gap-2 text-sm font-semibold"
              style={{ color: 'var(--ink-secondary)' }}
              data-testid="wt-live-status"
            >
              <span
                className="inline-block"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#16A34A',
                  animation: 'wtPulse 2s ease-in-out infinite',
                }}
              />
              Live monitoring
            </div>
          </div>

          {/* ── PERIOD SELECTOR ── */}
          <div className="mb-6 flex gap-1" data-testid="wt-period-selector">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors"
                style={{
                  background: period === p ? '#1E293B' : 'transparent',
                  color: period === p ? '#FFFFFF' : 'var(--ink-muted)',
                }}
                data-testid={`wt-period-${p}`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* ── KPI CARDS ── */}
          <div
            className="wt-kpi-grid mb-6 grid gap-4"
            data-testid="wt-kpi-grid"
          >
            {/* Total Events */}
            <div
              className="rounded-xl border p-4"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              data-testid="wt-kpi-total"
            >
              <div
                className="mb-1 text-[10px] font-semibold uppercase"
                style={{ color: 'var(--ink-muted)', letterSpacing: 'var(--ls-caps)' }}
              >
                Total Events
              </div>
              <div
                className="text-[28px] font-bold leading-none"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-display)' }}
              >
                {kpis.total}
              </div>
            </div>

            {/* Critical */}
            <div
              className="rounded-xl border p-4"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              data-testid="wt-kpi-critical"
            >
              <div
                className="mb-1 text-[10px] font-semibold uppercase"
                style={{ color: 'var(--ink-muted)', letterSpacing: 'var(--ls-caps)' }}
              >
                Critical
              </div>
              <div
                className="text-[28px] font-bold leading-none"
                style={{ fontFamily: 'var(--font-mono)', color: '#DC2626' }}
              >
                {kpis.critical}
              </div>
            </div>

            {/* High */}
            <div
              className="rounded-xl border p-4"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              data-testid="wt-kpi-high"
            >
              <div
                className="mb-1 text-[10px] font-semibold uppercase"
                style={{ color: 'var(--ink-muted)', letterSpacing: 'var(--ls-caps)' }}
              >
                High
              </div>
              <div
                className="text-[28px] font-bold leading-none"
                style={{ fontFamily: 'var(--font-mono)', color: '#D97706' }}
              >
                {kpis.high}
              </div>
            </div>

            {/* Resolved */}
            <div
              className="rounded-xl border p-4"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              data-testid="wt-kpi-resolved"
            >
              <div
                className="mb-1 text-[10px] font-semibold uppercase"
                style={{ color: 'var(--ink-muted)', letterSpacing: 'var(--ls-caps)' }}
              >
                Resolved
              </div>
              <div
                className="text-[28px] font-bold leading-none"
                style={{ fontFamily: 'var(--font-mono)', color: '#16A34A' }}
              >
                {kpis.resolved}
              </div>
            </div>

            {/* Avg Response */}
            <div
              className="rounded-xl border p-4"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              data-testid="wt-kpi-avg-response"
            >
              <div
                className="mb-1 text-[10px] font-semibold uppercase"
                style={{ color: 'var(--ink-muted)', letterSpacing: 'var(--ls-caps)' }}
              >
                Avg Response
              </div>
              <div
                className="text-[28px] font-bold leading-none"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-display)' }}
              >
                {kpis.avgResponse !== null ? `${kpis.avgResponse}h` : '--'}
              </div>
            </div>
          </div>

          {/* ── SIGNAL TIMELINE SECTION ── */}
          <section className="mb-8" data-testid="wt-timeline-section">
            <h2
              className="mb-4 font-semibold"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '22px',
                color: 'var(--ink-display)',
              }}
            >
              Signal Timeline
            </h2>

            {/* Filter pills */}
            <div className="mb-4 flex flex-wrap gap-2" data-testid="wt-filters">
              {(['all', 'critical', 'high', 'medium']).map((sev) => {
                const isActive = severityFilter === sev;
                const activeBg = FILTER_ACTIVE_BG[sev] || '#1E293B';
                return (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
                    style={{
                      background: isActive ? activeBg : 'transparent',
                      color: isActive ? '#FFFFFF' : 'var(--ink-muted)',
                      border: isActive ? `1px solid ${activeBg}` : '1px solid var(--border)',
                      borderRadius: 'var(--r-pill)',
                    }}
                    data-testid={`wt-filter-${sev}`}
                  >
                    {sev === 'all' ? 'All' : sev.charAt(0).toUpperCase() + sev.slice(1)}
                    {filterCounts[sev] > 0 && (
                      <span className="ml-1.5 opacity-80">{filterCounts[sev]}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Loading state */}
            {loading && (
              <div
                className="rounded-xl border p-6 text-center text-sm"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
                data-testid="wt-loading"
              >
                Loading watchtower events...
              </div>
            )}

            {/* Error state */}
            {!loading && error && (
              <div
                className="rounded-xl border p-6 text-center text-sm"
                style={{ background: 'var(--danger-wash)', borderColor: 'var(--danger)', color: '#FCA5A5' }}
                data-testid="wt-error"
              >
                {error}
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && filteredEvents.length === 0 && (
              <div
                className="rounded-xl border p-6 text-center text-sm"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
                data-testid="wt-empty"
              >
                No events found for this period and filter.
              </div>
            )}

            {/* Event cards */}
            {!loading && !error && filteredEvents.length > 0 && (
              <div className="flex flex-col gap-3" data-testid="wt-timeline">
                {filteredEvents.map((event) => {
                  const sev = normalizeSeverity(event.severity);
                  const status = normalizeStatus(event.status);
                  const badge = SEVERITY_BADGE[sev] || SEVERITY_BADGE.medium;
                  const statusStyle = STATUS_STYLE[status] || STATUS_STYLE.active;
                  const { date, time } = formatEventDate(event.created_at);
                  const domain = inferDomain(event);
                  const title = eventTitle(event);
                  const desc = eventDescription(event);
                  const hasEnrichment = event.enrichment || event.ai_enriched || event.enrichment_group;

                  return (
                    <div
                      key={event.id}
                      className="rounded-xl border p-4 sm:p-5 transition-colors cursor-pointer hover:border-white/20"
                      style={{
                        background: 'var(--surface)',
                        borderColor: 'var(--border)',
                        display: 'grid',
                        gridTemplateColumns: '48px 1fr auto',
                        gap: '16px',
                        alignItems: 'start',
                      }}
                      data-testid={`wt-event-${event.id}`}
                      data-sev={sev}
                    >
                      {/* Time column */}
                      <div
                        className="text-center pt-0.5"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-muted)' }}
                      >
                        <span className="block font-semibold" style={{ color: 'var(--ink-secondary)' }}>
                          {date}
                        </span>
                        {time}
                      </div>

                      {/* Body column */}
                      <div className="min-w-0">
                        {/* Severity + domain */}
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                            style={{
                              background: badge.bg,
                              color: badge.text,
                              letterSpacing: 'var(--ls-caps)',
                            }}
                          >
                            {badge.label}
                          </span>
                          <span
                            className="text-[10px] font-semibold uppercase"
                            style={{ color: 'var(--ink-muted)', letterSpacing: 'var(--ls-caps)' }}
                          >
                            {domain}
                          </span>
                        </div>

                        {/* Title */}
                        <div
                          className="mb-1 text-sm font-semibold"
                          style={{ color: 'var(--ink-display)' }}
                        >
                          {title}
                        </div>

                        {/* Description */}
                        {desc && (
                          <div
                            className="text-[13px] leading-relaxed"
                            style={{ color: 'var(--ink-secondary)' }}
                          >
                            {desc}
                          </div>
                        )}

                        {/* Enrichment badge */}
                        {hasEnrichment && (
                          <div
                            className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold"
                            style={{ color: 'var(--lava)' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                            AI enriched{event.enrichment_group ? ` \u2014 ${event.enrichment_group}` : ''}
                          </div>
                        )}
                      </div>

                      {/* Actions column */}
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase whitespace-nowrap"
                          style={{
                            background: statusStyle.bg,
                            color: statusStyle.text,
                            letterSpacing: 'var(--ls-caps)',
                          }}
                        >
                          {statusStyle.label}
                        </span>
                        {status === 'active' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const query = title;
                              navigate(`/war-room?prefill=${encodeURIComponent(query)}`);
                            }}
                            className="text-xs font-medium whitespace-nowrap hover:underline"
                            style={{ color: 'var(--lava)' }}
                            data-testid={`wt-event-warroom-${event.id}`}
                          >
                            Ask WarRoom &rarr;
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Watchtower-specific responsive styles */}
      <style>{`
        @keyframes wtPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .wt-kpi-grid {
          grid-template-columns: repeat(2, 1fr);
        }
        @media (min-width: 640px) {
          .wt-kpi-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (min-width: 900px) {
          .wt-kpi-grid {
            grid-template-columns: repeat(5, 1fr);
          }
        }
        @media (max-width: 600px) {
          [data-testid^="wt-event-"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </DashboardLayout>
  );
};

export default Watchtower;
