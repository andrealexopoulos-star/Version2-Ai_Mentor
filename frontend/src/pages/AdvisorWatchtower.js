import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Radar, RefreshCw, ShieldAlert, Target } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { useSnapshotProgress } from '../hooks/useSnapshotProgress';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { PageErrorState } from '../components/PageStateComponents';
import { SourceProvenanceBadge } from '../components/advisor/SourceProvenanceBadge';
import { fontFamily } from '../design-system/tokens';

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, moderate: 2, low: 3, info: 4 };
const SEVERITY_STYLE = {
  critical: { bg: '#EF444415', border: '#EF444450', text: '#FCA5A5' },
  high: { bg: '#F9731615', border: '#F9731650', text: '#FDBA74' },
  medium: { bg: '#F59E0B15', border: '#F59E0B50', text: '#FCD34D' },
  low: { bg: '#10B98115', border: '#10B98150', text: '#6EE7B7' },
  info: { bg: '#64748B15', border: '#64748B50', text: '#CBD5E1' },
};

const DECISION_SLOTS = [
  { id: 'decide-now', title: 'Decide Now', intent: 'What needs owner action in the next 48 hours?', icon: ShieldAlert },
  { id: 'monitor-this-week', title: 'Monitor This Week', intent: 'Which pressure is rising and needs active monitoring?', icon: Radar },
  { id: 'build-next', title: 'Build Next', intent: 'What system fix prevents repeated pressure this month?', icon: Target },
];

const normalizeSeverity = (severity) => {
  const value = String(severity || '').toLowerCase();
  if (SEVERITY_RANK[value] !== undefined) return value;
  return 'medium';
};

const prettySignal = (value = '') => value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const inferSource = (rawSource = '', domain = '', signal = '') => {
  const text = `${rawSource} ${domain} ${signal}`.toLowerCase();
  if (/(hubspot|salesforce|crm|deal|pipeline)/.test(text)) return 'CRM';
  if (/(xero|quickbooks|account|invoice|cash|finance)/.test(text)) return 'Accounting';
  if (/(gmail|outlook|email|calendar|thread|response)/.test(text)) return 'Email/Calendar';
  if (/(observation|watchtower|event)/.test(text)) return 'Observation Events';
  if (/(market|competitor|benchmark)/.test(text)) return 'Market Feed';
  return 'Snapshot';
};

const toSignal = (item = {}, fallbackSource = 'snapshot') => {
  const title = item.title || prettySignal(item.signal || item.event || item.type || item.domain || 'Signal detected');
  const detail = item.detail || item.description || item.impact || item.executive_summary || 'Review this signal in context with your owner team.';
  const action = item.action || item.recommendation || item.suggested_action || 'Assign an owner and execute this cycle.';
  const signalType = String(item.signal || item.event || item.type || item.signal_name || title || 'business_signal').replace(/\s+/g, '_').toLowerCase();

  return {
    id: item.id || `${signalType}-${item.domain || 'general'}`,
    signalType,
    title,
    detail,
    action,
    ifIgnored: item.if_ignored || item.impact || detail,
    domain: String(item.domain || 'general').toLowerCase(),
    severity: normalizeSeverity(item.severity || item.priority),
    source: inferSource(item.source || item.data_source || fallbackSource, item.domain, signalType),
    createdAt: item.created_at || item.observed_at || item.timestamp || null,
    occurrences: 1,
  };
};

const dedupeSignals = (signals) => {
  const map = new Map();

  signals.forEach((signal) => {
    const key = `${signal.signalType}|${signal.domain}|${signal.source}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, signal);
      return;
    }

    const incomingRank = SEVERITY_RANK[signal.severity] ?? 9;
    const existingRank = SEVERITY_RANK[existing.severity] ?? 9;
    const keep = incomingRank < existingRank ? signal : existing;

    map.set(key, {
      ...keep,
      occurrences: (existing.occurrences || 1) + 1,
      detail: keep.detail,
      action: keep.action,
      ifIgnored: keep.ifIgnored,
      createdAt: keep.createdAt || existing.createdAt,
    });
  });

  return [...map.values()].sort((a, b) => {
    const rankDelta = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
    if (rankDelta !== 0) return rankDelta;

    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
};

const buildSignals = (overview, cognitive) => {
  const raw = [];
  const topAlerts = overview?.top_alerts || cognitive?.top_alerts || [];
  const resolutionQueue = cognitive?.resolution_queue || overview?.resolution_queue || [];
  const propagationMap = overview?.propagation_map || [];

  topAlerts.forEach((entry) => raw.push(toSignal(entry, 'observation_events')));
  resolutionQueue.forEach((entry) => raw.push(toSignal(entry, 'snapshot')));

  propagationMap
    .filter((entry) => Number(entry?.probability || 0) >= 0.55)
    .slice(0, 2)
    .forEach((entry) => {
      raw.push(toSignal({
        signal: `propagation_${entry.source || 'domain'}_${entry.target || 'domain'}`,
        domain: entry.target || entry.source || 'general',
        severity: Number(entry.probability || 0) >= 0.8 ? 'high' : 'medium',
        title: `${prettySignal(entry.source || 'domain')} pressure moving into ${prettySignal(entry.target || 'domain')}`,
        detail: entry.description || `${Math.round(Number(entry.probability || 0) * 100)}% risk chain is active.`,
        recommendation: 'Set mitigation owner before pressure compounds.',
        source: 'propagation_map',
      }, 'propagation_map'));
    });

  return dedupeSignals(raw);
};

const buildDecisionSurface = (signals, overview, cognitive) => {
  const memo = overview?.executive_memo || cognitive?.executive_memo || cognitive?.memo;
  const fallbackSignal = toSignal({
    signal: 'executive_priority',
    title: overview?.priority_action || 'Set one owner-accountable action for this cycle.',
    detail: memo || 'No critical signal currently exceeds threshold. Keep active monitoring.',
    recommendation: 'Capture this as a tracked decision and assign a deadline.',
    severity: 'low',
    source: 'snapshot',
  }, 'snapshot');

  return DECISION_SLOTS.map((slot, index) => {
    const signal = signals[index] || fallbackSignal;
    return {
      ...slot,
      signal,
      severity: signal.severity,
      whyNow: signal.occurrences > 1
        ? `${signal.occurrences} matching signals were grouped into one decision.`
        : signal.detail,
    };
  });
};

const getStateLabel = (overview, cognitive) => {
  const raw = overview?.system_state?.status || cognitive?.system_state?.status || cognitive?.system_state || 'STABLE';
  const value = String(raw).toUpperCase();
  if (value === 'CRITICAL') return 'Critical';
  if (value === 'COMPRESSION') return 'Under Pressure';
  if (value === 'DRIFT') return 'Drifting';
  return 'Stable';
};

export default function AdvisorWatchtower() {
  const { user } = useSupabaseAuth();
  const {
    cognitive,
    owner,
    timeOfDay,
    loading: snapshotLoading,
    error: snapshotError,
    refreshing: snapshotRefreshing,
    refresh: refreshSnapshot,
  } = useSnapshotProgress();

  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const [overviewRefreshing, setOverviewRefreshing] = useState(false);
  const [loadingGuardExpired, setLoadingGuardExpired] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoadingGuardExpired(true), 15000);
    return () => clearTimeout(timer);
  }, []);

  const fetchOverview = useCallback(async (refreshMode = false) => {
    if (refreshMode) setOverviewRefreshing(true);
    if (!refreshMode) setOverviewLoading(true);

    try {
      const response = await apiClient.get('/cognition/overview');
      setOverview(response.data || null);
      setOverviewError('');
    } catch (error) {
      setOverviewError(error?.response?.data?.detail || 'Unable to load cognition overview.');
    } finally {
      setOverviewLoading(false);
      setOverviewRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview(false);
  }, [fetchOverview]);

  const handleRefresh = async () => {
    await Promise.allSettled([
      refreshSnapshot(),
      fetchOverview(true),
    ]);
  };

  const hasData = Boolean(cognitive) || Boolean(overview);
  const isLoading = !loadingGuardExpired && !hasData && !snapshotError && !overviewError && (snapshotLoading || overviewLoading);
  const criticalError = !isLoading && !hasData && (snapshotError || overviewError);

  const displayName = useMemo(() => {
    const source = owner
      || user?.user_metadata?.full_name?.split(' ')[0]
      || user?.email?.split('@')[0]
      || 'there';
    return source.charAt(0).toUpperCase() + source.slice(1);
  }, [owner, user]);

  const displayTimeOfDay = useMemo(() => {
    if (timeOfDay) return timeOfDay;
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }, [timeOfDay]);

  const signals = useMemo(() => buildSignals(overview, cognitive), [overview, cognitive]);
  const decisions = useMemo(() => buildDecisionSurface(signals, overview, cognitive), [signals, overview, cognitive]);

  const integrationTruth = overview?.integrations || cognitive?.integrations || {};
  const connectedSources = useMemo(() => {
    const list = [];
    if (integrationTruth.crm) list.push('CRM');
    if (integrationTruth.accounting) list.push('Accounting');
    if (integrationTruth.email) list.push('Email');
    return list;
  }, [integrationTruth]);

  const liveSignalCount = overview?.live_signal_count || cognitive?.live_signal_count || signals.length;
  const confidenceRaw = overview?.confidence_score ?? overview?.confidence ?? cognitive?.system_state?.confidence ?? null;
  const confidence = typeof confidenceRaw === 'number' ? Math.round(confidenceRaw <= 1 ? confidenceRaw * 100 : confidenceRaw) : null;
  const executiveMemo = overview?.executive_memo || cognitive?.executive_memo || cognitive?.memo;
  const migrationRequired = overview?.status === 'MIGRATION_REQUIRED';

  return (
    <DashboardLayout>
      <div
        className="min-h-[calc(100vh-56px)]"
        style={{
          background: 'radial-gradient(circle at 15% -10%, rgba(249,115,22,0.15), transparent 35%), var(--biqc-bg)',
          fontFamily: fontFamily.body,
        }}
        data-testid="advisor-screen"
      >
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4" data-testid="advisor-page-header">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} data-testid="advisor-header-kicker">
                Today · Executive Cognition
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-header-title">
                Good {displayTimeOfDay}, {displayName}.
              </h1>
              <p className="text-sm sm:text-base" style={{ color: 'var(--biqc-text-2)' }} data-testid="advisor-header-subtitle">
                Three decisions. Clear evidence. Owner-ready actions.
              </p>
            </div>

            <button
              onClick={handleRefresh}
              disabled={snapshotRefreshing || overviewRefreshing}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-colors hover:bg-white/5"
              style={{ borderColor: 'var(--biqc-border)', color: 'var(--biqc-text)' }}
              data-testid="advisor-refresh-button"
            >
              <RefreshCw className={`h-4 w-4 ${(snapshotRefreshing || overviewRefreshing) ? 'animate-spin' : ''}`} />
              Refresh intelligence
            </button>
          </div>

          {criticalError && (
            <div className="mb-8" data-testid="advisor-critical-error">
              <PageErrorState error={snapshotError || overviewError} onRetry={handleRefresh} moduleName="Advisor" />
            </div>
          )}

          {migrationRequired && (
            <div
              className="mb-8 rounded-2xl border px-4 py-3 text-sm"
              style={{ borderColor: '#F59E0B60', background: '#F59E0B15', color: '#FDE68A' }}
              data-testid="advisor-migration-warning"
            >
              Cognition migration is required for full contract output. Snapshot-backed decisions are still active.
            </div>
          )}

          {isLoading && (
            <div className="space-y-4" data-testid="advisor-loading-state">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-28 animate-pulse rounded-2xl" style={{ background: '#111827', border: '1px solid #1F2937' }} data-testid={`advisor-loading-skeleton-${item}`} />
              ))}
            </div>
          )}

          {!isLoading && hasData && (
            <>
              <section className="mb-8 grid gap-3 md:grid-cols-3" data-testid="advisor-top-metrics">
                <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="advisor-state-card">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} data-testid="advisor-state-label">Business State</p>
                  <p className="mt-2 text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-state-value">{getStateLabel(overview, cognitive)}</p>
                </div>
                <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="advisor-signals-card">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} data-testid="advisor-signals-label">Live Signals</p>
                  <p className="mt-2 text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-signals-value">{liveSignalCount} active</p>
                </div>
                <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="advisor-coverage-card">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} data-testid="advisor-coverage-label">Connected Sources</p>
                  <p className="mt-2 text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-coverage-value">
                    {connectedSources.length > 0 ? connectedSources.join(' · ') : 'None connected'}
                  </p>
                  {confidence !== null && (
                    <p className="mt-1 text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} data-testid="advisor-confidence-value">Confidence {confidence}%</p>
                  )}
                </div>
              </section>

              <section className="mb-10" data-testid="advisor-decision-surface">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-base md:text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-decision-title">
                    Three-Decision Executive Surface
                  </h2>
                  <Link
                    to="/alerts"
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
                    style={{ borderColor: 'var(--biqc-border)', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                    data-testid="advisor-view-alerts-link"
                  >
                    View full signal inbox <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="grid gap-4 lg:grid-cols-3" data-testid="advisor-decision-grid">
                  {decisions.map((decision, index) => {
                    const Icon = decision.icon;
                    const style = SEVERITY_STYLE[decision.severity] || SEVERITY_STYLE.medium;

                    return (
                      <article
                        key={decision.id}
                        className="rounded-2xl border p-5"
                        style={{ borderColor: style.border, background: 'var(--biqc-bg-card)' }}
                        data-testid={`advisor-decision-card-${decision.id}`}
                      >
                        <div className="mb-4 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em]" style={{ background: style.bg, color: style.text, fontFamily: fontFamily.mono }} data-testid={`advisor-decision-slot-${decision.id}`}>
                            <Icon className="h-3 w-3" />
                            {decision.title}
                          </span>
                          <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }} data-testid={`advisor-decision-severity-${decision.id}`}>
                            {decision.severity}
                          </span>
                        </div>

                        <p className="mb-1 text-sm" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }} data-testid={`advisor-decision-intent-${decision.id}`}>
                          {decision.intent}
                        </p>
                        <h3 className="mb-3 text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid={`advisor-decision-title-${decision.id}`}>
                          {decision.signal.title}
                        </h3>

                        <SourceProvenanceBadge
                          source={decision.signal.source}
                          signalType={decision.signal.signalType}
                          timestamp={decision.signal.createdAt}
                          testId={`advisor-provenance-${decision.id}`}
                        />

                        <div className="mt-4 space-y-3 text-sm" style={{ color: 'var(--biqc-text-2)' }}>
                          <p data-testid={`advisor-decision-why-${decision.id}`}><strong style={{ color: 'var(--biqc-text)' }}>Why now:</strong> {decision.whyNow}</p>
                          <p data-testid={`advisor-decision-if-ignored-${decision.id}`}><strong style={{ color: 'var(--biqc-text)' }}>If ignored:</strong> {decision.signal.ifIgnored}</p>
                          <p data-testid={`advisor-decision-action-${decision.id}`}><strong style={{ color: 'var(--biqc-text)' }}>Action now:</strong> {decision.signal.action}</p>
                        </div>

                        <Link
                          to="/soundboard"
                          className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
                          style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                          data-testid={`advisor-decision-open-soundboard-${decision.id}`}
                        >
                          Open in SoundBoard <ArrowRight className="h-3.5 w-3.5" />
                        </Link>

                        {index === 0 && decision.signal.occurrences > 1 && (
                          <p className="mt-3 text-xs" style={{ color: '#FCD34D', fontFamily: fontFamily.mono }} data-testid={`advisor-decision-dedupe-note-${decision.id}`}>
                            Deduplicated {decision.signal.occurrences} repeated signals into one decision.
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="mb-10" data-testid="advisor-signal-inbox-section">
                <div className="mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
                  <h2 className="text-base md:text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-signal-inbox-title">
                    Signal Inbox (Deduplicated)
                  </h2>
                </div>

                <div className="space-y-3" data-testid="advisor-signal-inbox-list">
                  {signals.slice(0, 6).map((signal) => (
                    <div key={`${signal.id}-${signal.signalType}`} className="rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid={`advisor-signal-row-${signal.signalType}`}>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="text-base" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid={`advisor-signal-title-${signal.signalType}`}>{signal.title}</h3>
                        {signal.occurrences > 1 && (
                          <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: '#1E293B', color: '#E2E8F0', fontFamily: fontFamily.mono }} data-testid={`advisor-signal-duplicates-${signal.signalType}`}>
                            x{signal.occurrences}
                          </span>
                        )}
                      </div>

                      <SourceProvenanceBadge
                        source={signal.source}
                        signalType={signal.signalType}
                        timestamp={signal.createdAt}
                        testId={`advisor-signal-provenance-${signal.signalType}`}
                      />

                      <p className="mt-3 text-sm" style={{ color: 'var(--biqc-text-2)' }} data-testid={`advisor-signal-detail-${signal.signalType}`}>
                        {signal.detail}
                      </p>
                    </div>
                  ))}

                  {signals.length === 0 && (
                    <div className="rounded-2xl border p-5 text-sm" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)', color: 'var(--biqc-text-2)' }} data-testid="advisor-signal-empty-state">
                      No active high-priority signals right now. BIQc is still monitoring your connected systems.
                    </div>
                  )}
                </div>
              </section>

              {executiveMemo && (
                <section className="rounded-2xl border p-5" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="advisor-executive-memo-section">
                  <h2 className="mb-3 text-base md:text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-executive-memo-title">
                    Executive Memo
                  </h2>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--biqc-text-2)' }} data-testid="advisor-executive-memo-content">
                    {executiveMemo}
                  </p>
                </section>
              )}
            </>
          )}

          {!isLoading && !hasData && !criticalError && (
            <div
              className="rounded-2xl border p-5 text-sm"
              style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)', color: 'var(--biqc-text-2)' }}
              data-testid="advisor-empty-fallback"
            >
              BIQc is online but has no actionable signals yet. Connect CRM, accounting, and email sources for full cognition.
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
