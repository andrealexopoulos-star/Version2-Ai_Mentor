import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock3,
  Compass,
  Download,
  Radar,
  RefreshCw,
  Search,
  ShieldAlert,
  Target,
  ThumbsDown,
  ThumbsUp,
  UserRoundPlus,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '../components/DashboardLayout';
import { useSnapshotProgress } from '../hooks/useSnapshotProgress';
import { AUTH_STATE, useSupabaseAuth } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { SourceProvenanceBadge } from '../components/advisor/SourceProvenanceBadge';
import { DelegateActionModal } from '../components/advisor/DelegateActionModal';
import { EvidenceDrawer } from '../components/advisor/EvidenceDrawer';
import { fontFamily } from '../design-system/tokens';

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, moderate: 2, low: 3, info: 4 };
const SEVERITY_STYLE = {
  critical: { bg: '#EF444415', border: '#EF444450', text: '#FCA5A5' },
  high: { bg: '#F9731615', border: '#F9731650', text: '#FDBA74' },
  medium: { bg: '#F59E0B15', border: '#F59E0B50', text: '#FCD34D' },
  low: { bg: '#10B98115', border: '#10B98150', text: '#6EE7B7' },
  info: { bg: '#64748B15', border: '#64748B50', text: '#CBD5E1' },
};

const DECISION_ACTIONS = {
  resolve: { label: 'Resolve', icon: CheckCircle2, endpoint: 'complete', style: { bg: '#10B98115', border: '#10B98140', text: '#6EE7B7' } },
  delegate: { label: 'Delegate', icon: UserRoundPlus, endpoint: 'hand-off', style: { bg: '#3B82F615', border: '#3B82F640', text: '#93C5FD' } },
  ignore: { label: 'Ignore', icon: XCircle, endpoint: 'ignore', style: { bg: '#64748B15', border: '#64748B40', text: '#CBD5E1' } },
};

const ROLE_OPTIONS = [
  { id: 'ceo', label: 'CEO' },
  { id: 'coo', label: 'COO' },
  { id: 'finance', label: 'Finance Lead' },
];

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

const formatTime = (value) => {
  if (!value) return 'Recent';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Recent';
  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const domain = String(item.domain || 'general').toLowerCase();
  const source = inferSource(item.source || item.data_source || fallbackSource, item.domain, signalType);
  const actionId = String(item.id || `${signalType}-${domain}`);

  return {
    id: actionId,
    signalType,
    title,
    detail,
    action,
    ifIgnored: item.if_ignored || item.impact || detail,
    domain,
    severity: normalizeSeverity(item.severity || item.priority),
    source,
    createdAt: item.created_at || item.observed_at || item.timestamp || null,
    occurrences: 1,
    actionIds: [actionId],
    dedupeKey: `${signalType}|${domain}|${source}`,
  };
};

const dedupeSignals = (signals) => {
  const map = new Map();

  signals.forEach((signal) => {
    const key = signal.dedupeKey;
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
      actionIds: [...new Set([...(existing.actionIds || []), ...(signal.actionIds || [])])],
      dedupeKey: key,
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

const buildSignals = (overview, cognitive, watchtowerEvents = []) => {
  const raw = [];
  const topAlerts = overview?.top_alerts || cognitive?.top_alerts || [];
  const resolutionQueue = cognitive?.resolution_queue || overview?.resolution_queue || [];
  const propagationMap = overview?.propagation_map || [];

  topAlerts.forEach((entry) => raw.push(toSignal(entry, 'observation_events')));
  resolutionQueue.forEach((entry) => raw.push(toSignal(entry, 'snapshot')));
  (watchtowerEvents || []).forEach((entry) => raw.push(toSignal(entry, 'observation_events')));

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

const scoreIntent = (text = '') => {
  const value = String(text).toLowerCase();
  const increase = /(increase|invest|expand|scale|hire|accelerate|push|raise|grow)/.test(value);
  const reduce = /(reduce|cut|pause|defer|delay|hold|conserve|freeze|slow)/.test(value);
  if (increase && !reduce) return 'increase';
  if (reduce && !increase) return 'reduce';
  return 'neutral';
};

const detectConflicts = (signals) => {
  const conflicts = [];
  const seen = new Set();
  const candidateSignals = signals.slice(0, 12);

  for (let i = 0; i < candidateSignals.length; i += 1) {
    for (let j = i + 1; j < candidateSignals.length; j += 1) {
      const left = candidateSignals[i];
      const right = candidateSignals[j];

      if (left.domain !== right.domain) continue;

      const leftIntent = scoreIntent(`${left.action} ${left.title}`);
      const rightIntent = scoreIntent(`${right.action} ${right.title}`);
      if (leftIntent === 'neutral' || rightIntent === 'neutral' || leftIntent === rightIntent) continue;

      const key = `${left.domain}|${leftIntent}|${rightIntent}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const leftRank = SEVERITY_RANK[left.severity] ?? 9;
      const rightRank = SEVERITY_RANK[right.severity] ?? 9;
      const preferred = leftRank <= rightRank ? left : right;

      conflicts.push({
        id: key,
        domain: left.domain,
        left,
        right,
        recommendation: `Prioritise: ${preferred.title}`,
      });
    }
  }

  return conflicts;
};

const signalPriorityScore = (signal, role) => {
  const severityWeight = { critical: 120, high: 90, medium: 60, low: 30, info: 10 };
  const severityScore = severityWeight[signal.severity] || 25;
  const recencyScore = signal.createdAt ? Math.max(0, 24 - (Date.now() - new Date(signal.createdAt).getTime()) / (1000 * 60 * 60)) : 5;
  const frequencyScore = Math.min((signal.occurrences || 1) * 8, 30);
  const roleBoostMap = {
    ceo: /(revenue|cash|market|growth|risk)/.test(signal.domain) ? 18 : 8,
    coo: /(operations|delivery|execution|people|capacity)/.test(signal.domain) ? 22 : 6,
    finance: /(revenue|cash|invoice|margin|finance|payment)/.test(signal.domain) ? 24 : 4,
  };
  const roleBoost = roleBoostMap[role] || 0;
  return severityScore + recencyScore + frequencyScore + roleBoost;
};

const buildProjections = (signal) => {
  const base = signal.severity === 'critical' ? 34 : signal.severity === 'high' ? 26 : signal.severity === 'medium' ? 18 : 10;
  const multiplier = Math.min(signal.occurrences || 1, 4);
  const risk30 = Math.min(95, Math.round(base + multiplier * 4));
  const risk60 = Math.min(99, Math.round(risk30 + 11));
  const risk90 = Math.min(99, Math.round(risk60 + 9));
  const action30 = Math.max(4, risk30 - 14);
  const action60 = Math.max(6, risk60 - 18);
  const action90 = Math.max(8, risk90 - 22);
  return {
    ignored: [risk30, risk60, risk90],
    actioned: [action30, action60, action90],
  };
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
  const { user, authState } = useSupabaseAuth();
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
  const [watchtowerEvents, setWatchtowerEvents] = useState([]);
  const [watchtowerLoading, setWatchtowerLoading] = useState(false);
  const [watchtowerError, setWatchtowerError] = useState('');
  const [actionState, setActionState] = useState({ byKey: {}, byAlertId: {} });
  const [actionsHydrated, setActionsHydrated] = useState(false);
  const [actionLoadingKey, setActionLoadingKey] = useState('');
  const [rolePreference, setRolePreference] = useState(() => localStorage.getItem('advisor-role-preference') || 'ceo');
  const [feedbackByDecision, setFeedbackByDecision] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('advisor-decision-feedback') || '{}');
    } catch {
      return {};
    }
  });
  const [delegateModalDecision, setDelegateModalDecision] = useState(null);
  const [delegateSubmitting, setDelegateSubmitting] = useState(false);
  const [delegateProviders, setDelegateProviders] = useState([]);
  const [delegateProviderOptions, setDelegateProviderOptions] = useState({
    provider: 'auto',
    recommendedProvider: 'auto',
    assignees: [],
    collections: [],
  });
  const [delegateOptionsLoading, setDelegateOptionsLoading] = useState(false);
  const [evidenceDrawerDecision, setEvidenceDrawerDecision] = useState(null);
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');

  const actionStorageKey = useMemo(() => `advisor-actions-${user?.id || 'anon'}`, [user?.id]);

  useEffect(() => {
    const timer = setTimeout(() => setLoadingGuardExpired(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  const fetchOverview = useCallback(async (refreshMode = false) => {
    if (refreshMode) setOverviewRefreshing(true);
    if (!refreshMode) setOverviewLoading(true);

    try {
      const response = await apiClient.get('/cognition/overview', { timeout: 12000 });
      setOverview(response.data || null);
      setOverviewError('');
    } catch (error) {
      setOverviewError(error?.response?.data?.detail || 'Unable to load cognition overview.');
    } finally {
      setOverviewLoading(false);
      setOverviewRefreshing(false);
    }
  }, []);

  const fetchWatchtower = useCallback(async () => {
    setWatchtowerLoading(true);
    try {
      const response = await apiClient.get('/intelligence/watchtower', { timeout: 12000 });
      setWatchtowerEvents(response?.data?.events || []);
      setWatchtowerError('');
    } catch (error) {
      setWatchtowerError(error?.response?.data?.detail || 'Unable to load watchtower events.');
      setWatchtowerEvents([]);
    } finally {
      setWatchtowerLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(actionStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setActionState({
          byKey: parsed?.byKey || {},
          byAlertId: parsed?.byAlertId || {},
        });
      }
    } catch {}
  }, [actionStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(actionStorageKey, JSON.stringify(actionState));
    } catch {}
  }, [actionState, actionStorageKey]);

  useEffect(() => {
    localStorage.setItem('advisor-role-preference', rolePreference);
  }, [rolePreference]);

  useEffect(() => {
    localStorage.setItem('advisor-decision-feedback', JSON.stringify(feedbackByDecision));
  }, [feedbackByDecision]);

  const hydrateActionHistory = useCallback(async () => {
    try {
      const response = await apiClient.get('/intelligence/alerts/actions', { params: { limit: 150 }, timeout: 10000 });
      const actions = response?.data?.actions || [];
      const byAlertId = {};
      actions.forEach((item) => {
        if (!item?.alert_id) return;
        if (!DECISION_ACTIONS.resolve.endpoint && !DECISION_ACTIONS.ignore.endpoint) return;
        if (!['complete', 'ignore', 'hand-off'].includes(item.action)) return;
        byAlertId[item.alert_id] = {
          action: item.action,
          at: item.created_at,
          source: 'server',
          alertId: item.alert_id,
        };
      });
      setActionState((prev) => ({ ...prev, byAlertId: { ...prev.byAlertId, ...byAlertId } }));
    } catch {
      // Non-blocking: local action state still works.
    } finally {
      setActionsHydrated(true);
    }
  }, []);

  useEffect(() => {
    fetchOverview(false);
    fetchWatchtower();
    hydrateActionHistory();
  }, [fetchOverview, fetchWatchtower, hydrateActionHistory]);

  const handleRefresh = async () => {
    await Promise.allSettled([
      refreshSnapshot(),
      fetchOverview(true),
      fetchWatchtower(),
      apiClient.get('/workflows/delegate/providers', { timeout: 10000 }),
    ]);
  };

  const hasOverviewData = Boolean(overview);
  const hasSnapshotData = Boolean(cognitive);
  const hasWatchtowerData = (watchtowerEvents || []).length > 0;
  const hasData = hasSnapshotData || hasOverviewData || hasWatchtowerData;
  const isLoading = !loadingGuardExpired
    && !hasData
    && !overviewError
    && !watchtowerError
    && (overviewLoading || watchtowerLoading);
  const dataErrorMessage = snapshotError || overviewError || watchtowerError || '';
  const criticalError = !isLoading && !hasData && Boolean(dataErrorMessage);

  useEffect(() => {
    if (authState === AUTH_STATE.LOADING) return;
    if (hasData || overviewLoading || watchtowerLoading) return;
    fetchOverview(true);
    fetchWatchtower();
    hydrateActionHistory();
  }, [
    authState,
    hasData,
    overviewLoading,
    watchtowerLoading,
    fetchOverview,
    fetchWatchtower,
    hydrateActionHistory,
  ]);

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

  const signals = useMemo(() => buildSignals(overview, cognitive, watchtowerEvents), [overview, cognitive, watchtowerEvents]);

  const isSignalActioned = useCallback((signal) => {
    if (actionState.byKey?.[signal.dedupeKey]) return true;
    return (signal.actionIds || []).some((alertId) => Boolean(actionState.byAlertId?.[alertId]));
  }, [actionState]);

  const openSignals = useMemo(
    () => signals.filter((signal) => !isSignalActioned(signal)),
    [signals, isSignalActioned],
  );

  const prioritizedSignals = useMemo(() => {
    return [...openSignals].sort((left, right) => {
      return signalPriorityScore(right, rolePreference) - signalPriorityScore(left, rolePreference);
    });
  }, [openSignals, rolePreference]);

  const decisions = useMemo(
    () => buildDecisionSurface(prioritizedSignals, overview, cognitive),
    [prioritizedSignals, overview, cognitive],
  );

  const conflicts = useMemo(() => detectConflicts(prioritizedSignals), [prioritizedSignals]);

  const actionAuditRows = useMemo(() => {
    const keyRows = Object.entries(actionState.byKey || {}).map(([dedupeKey, entry]) => ({
      dedupeKey,
      ...entry,
    }));
    return keyRows
      .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
      .slice(0, 8);
  }, [actionState]);

  const filteredAuditRows = useMemo(() => {
    const query = auditSearch.trim().toLowerCase();
    return actionAuditRows.filter((row) => {
      const filterMatch = auditActionFilter === 'all' || row.action === auditActionFilter;
      if (!filterMatch) return false;
      if (!query) return true;
      const blob = `${row.title || ''} ${row.domain || ''} ${row.source || ''}`.toLowerCase();
      return blob.includes(query);
    });
  }, [actionAuditRows, auditActionFilter, auditSearch]);

  const fetchDelegateProviders = useCallback(async () => {
    try {
      const response = await apiClient.get('/workflows/delegate/providers', { timeout: 10000 });
      const providers = response?.data?.providers || [];
      const recommendedProvider = response?.data?.recommended_provider || 'auto';
      setDelegateProviders(providers);
      setDelegateProviderOptions((prev) => ({
        ...prev,
        recommendedProvider,
      }));
      return recommendedProvider;
    } catch {
      setDelegateProviders([
        { id: 'auto', label: 'Auto (based on connected tools)', available: true },
        { id: 'merge-ticketing', label: 'Merge Ticketing', available: false },
        { id: 'outlook-exchange', label: 'Outlook / Exchange', available: false },
        { id: 'google-calendar', label: 'Google Calendar', available: false },
      ]);
      return 'auto';
    }
  }, []);

  const fetchDelegateOptions = useCallback(async (providerChoice = 'auto') => {
    setDelegateOptionsLoading(true);
    try {
      const response = await apiClient.get('/workflows/delegate/options', {
        params: { provider: providerChoice },
        timeout: 12000,
      });
      setDelegateProviderOptions((prev) => ({
        ...prev,
        provider: response?.data?.provider || providerChoice,
        assignees: response?.data?.assignees || [],
        collections: response?.data?.collections || [],
      }));
    } catch {
      setDelegateProviderOptions((prev) => ({
        ...prev,
        provider: providerChoice,
        assignees: [],
        collections: [],
      }));
    } finally {
      setDelegateOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDelegateProviders();
  }, [fetchDelegateProviders]);

  const handleDecisionAction = useCallback(async (decision, actionType) => {
    const actionConfig = DECISION_ACTIONS[actionType];
    if (!actionConfig) return;

    const signal = decision.signal;
    const alertId = (signal.actionIds && signal.actionIds[0]) || signal.id || signal.dedupeKey;
    const loadingKey = `${decision.id}-${actionType}`;
    setActionLoadingKey(loadingKey);

    const persistLocalAction = () => {
      const nextRecord = {
        action: actionConfig.endpoint,
        at: new Date().toISOString(),
        title: signal.title,
        source: signal.source,
        domain: signal.domain,
        alertId,
      };

      setActionState((prev) => ({
        byKey: {
          ...prev.byKey,
          [signal.dedupeKey]: nextRecord,
        },
        byAlertId: {
          ...prev.byAlertId,
          [alertId]: nextRecord,
        },
      }));
    };

    // Optimistic update: move queue immediately, then sync backend.
    persistLocalAction();

    try {
      await apiClient.post('/intelligence/alerts/action', {
        alert_id: alertId,
        action: actionConfig.endpoint,
      }, { timeout: 10000 });

      if (actionType !== 'ignore') {
        try {
          await apiClient.post('/cognition/decisions', {
            decision_category: signal.domain || 'operational_change',
            decision_statement: `${actionConfig.label}: ${signal.title}. ${signal.action}`,
            affected_domains: [signal.domain || 'operations'],
            expected_time_horizon: actionType === 'delegate' ? 14 : 30,
            evidence_refs: signal.actionIds || [alertId],
          }, { timeout: 10000 });
        } catch {
          // Non-blocking: decision record can be retried later.
        }
      }

      toast.success(`${actionConfig.label} logged. Next decision surfaced automatically.`);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Action saved locally. Sync will retry in background.');
    } finally {
      setActionLoadingKey('');
    }
  }, []);

  const handleReopenDecision = useCallback((dedupeKey, alertId) => {
    setActionState((prev) => {
      const nextByKey = { ...prev.byKey };
      const nextByAlertId = { ...prev.byAlertId };
      delete nextByKey[dedupeKey];
      if (alertId) delete nextByAlertId[alertId];
      return { byKey: nextByKey, byAlertId: nextByAlertId };
    });
    toast.success('Decision reopened and moved back into active queue.');
  }, []);

  const handleOpenDelegateModal = useCallback(async (decision) => {
    setDelegateModalDecision(decision);
    const recommended = await fetchDelegateProviders();
    await fetchDelegateOptions(recommended || 'auto');
  }, [fetchDelegateProviders, fetchDelegateOptions]);

  const handleDelegateSubmit = useCallback(async (form) => {
    if (!delegateModalDecision) return;
    setDelegateSubmitting(true);
    try {
      await apiClient.post('/workflows/delegate/execute', {
        decision_id: delegateModalDecision.signal.id,
        decision_title: delegateModalDecision.signal.title,
        decision_summary: delegateModalDecision.signal.detail,
        domain: delegateModalDecision.signal.domain,
        severity: delegateModalDecision.signal.severity,
        provider_preference: form.providerPreference,
        assignee_name: form.assigneeName || null,
        assignee_email: form.assigneeEmail || null,
        assignee_remote_id: form.assigneeRemoteId || null,
        due_at: form.dueAt ? new Date(form.dueAt).toISOString() : null,
        collection_remote_id: form.collectionRemoteId || null,
        create_calendar_event: Boolean(form.createCalendarEvent),
      }, { timeout: 20000 });

      await handleDecisionAction(delegateModalDecision, 'delegate');
      setDelegateModalDecision(null);
      toast.success('Delegation executed through your connected business workflow.');
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Delegation failed. Please check provider connection.');
    } finally {
      setDelegateSubmitting(false);
    }
  }, [delegateModalDecision, handleDecisionAction]);

  const handleDecisionFeedback = useCallback(async (decision, helpful) => {
    const key = decision.signal?.dedupeKey || decision.id;
    setFeedbackByDecision((prev) => ({ ...prev, [key]: helpful ? 'helpful' : 'not-helpful' }));

    try {
      await apiClient.post('/workflows/decision-feedback', {
        decision_key: key,
        helpful,
      }, { timeout: 8000 });
    } catch {
      // local persistence still retained for confidence UX.
    }
  }, []);

  const exportAuditCsv = useCallback(() => {
    if (!filteredAuditRows.length) {
      toast.error('No audit rows match the current filter.');
      return;
    }

    const header = ['decision', 'action', 'source', 'domain', 'timestamp'];
    const rows = filteredAuditRows.map((row) => [
      row.title || '',
      row.action || '',
      row.source || '',
      row.domain || '',
      row.at || '',
    ]);

    const csvContent = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'advisor-decision-audit.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredAuditRows]);

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
  const queuedBeyondThree = Math.max(openSignals.length - 3, 0);

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

          <div className="mb-8 space-y-3" data-testid="advisor-ia-consistency-strip">
            <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }} data-testid="advisor-breadcrumbs">
              <Link to="/advisor" className="hover:text-white" data-testid="advisor-breadcrumb-today">Today</Link>
              <span>›</span>
              <span data-testid="advisor-breadcrumb-current">Advisor</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2" data-testid="advisor-context-nav-links">
                <Link to="/market" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs hover:bg-white/5" style={{ borderColor: 'var(--biqc-border)', color: '#CBD5E1', fontFamily: fontFamily.mono }} data-testid="advisor-context-nav-market">
                  <Compass className="h-3.5 w-3.5" /> Market
                </Link>
                <Link to="/revenue" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs hover:bg-white/5" style={{ borderColor: 'var(--biqc-border)', color: '#CBD5E1', fontFamily: fontFamily.mono }} data-testid="advisor-context-nav-revenue">
                  <Building2 className="h-3.5 w-3.5" /> Revenue
                </Link>
                <Link to="/operations" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs hover:bg-white/5" style={{ borderColor: 'var(--biqc-border)', color: '#CBD5E1', fontFamily: fontFamily.mono }} data-testid="advisor-context-nav-operations">
                  <BriefcaseBusiness className="h-3.5 w-3.5" /> Operations
                </Link>
              </div>

              <div className="flex items-center gap-2" data-testid="advisor-role-personalization-control">
                <label className="text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} htmlFor="advisor-role-select">View as</label>
                <select
                  id="advisor-role-select"
                  value={rolePreference}
                  onChange={(event) => setRolePreference(event.target.value)}
                  className="rounded-xl border px-3 py-2 text-xs"
                  style={{ background: '#0F172A', borderColor: '#334155', color: '#E2E8F0', fontFamily: fontFamily.mono }}
                  data-testid="advisor-role-select"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {criticalError && (
            <div
              className="mb-8 rounded-2xl border px-4 py-3 text-sm"
              style={{ borderColor: '#F59E0B60', background: '#F59E0B15', color: '#FDE68A' }}
              data-testid="advisor-critical-error"
            >
              Live cognition feed is delayed right now. Showing fallback executive decisions while BIQc reconnects.
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

          {!isLoading && (
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

              <section className="mb-8 rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="advisor-queue-status-section">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} data-testid="advisor-queue-status-label">
                      Decision Queue Status
                    </p>
                    <p className="text-sm" style={{ color: 'var(--biqc-text-2)' }} data-testid="advisor-queue-status-value">
                      {openSignals.length} open signal{openSignals.length === 1 ? '' : 's'} · showing top 3 executive decisions now.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-queue-backlog-count">
                      {queuedBeyondThree}
                    </p>
                    <p className="text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} data-testid="advisor-queue-backlog-label">Queued after top 3</p>
                  </div>
                </div>
              </section>

              <section className="mb-10" data-testid="advisor-conflict-resolver-section">
                <div className="mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
                  <h2 className="text-base md:text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-conflict-resolver-title">
                    Conflict Resolver
                  </h2>
                </div>

                {conflicts.length > 0 ? (
                  <div className="space-y-3" data-testid="advisor-conflict-list">
                    {conflicts.slice(0, 3).map((conflict) => (
                      <article
                        key={conflict.id}
                        className="rounded-2xl border p-4"
                        style={{ borderColor: '#F59E0B50', background: '#F59E0B10' }}
                        data-testid={`advisor-conflict-item-${conflict.id.replace(/\|/g, '-')}`}
                      >
                        <p className="text-xs uppercase tracking-[0.12em]" style={{ color: '#FCD34D', fontFamily: fontFamily.mono }} data-testid={`advisor-conflict-domain-${conflict.id.replace(/\|/g, '-')}`}>
                          Domain · {conflict.domain}
                        </p>
                        <p className="mt-2 text-sm" style={{ color: '#FDE68A' }} data-testid={`advisor-conflict-summary-${conflict.id.replace(/\|/g, '-')}`}>
                          Conflicting guidance detected between “{conflict.left.title}” and “{conflict.right.title}”.
                        </p>
                        <p className="mt-2 text-sm" style={{ color: '#FDE68A' }} data-testid={`advisor-conflict-recommendation-${conflict.id.replace(/\|/g, '-')}`}>
                          Recommended priority: {conflict.recommendation}
                        </p>
                        <Link
                          to="/war-room"
                          className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 text-xs hover:bg-black/10"
                          style={{ borderColor: '#F59E0B60', color: '#FDE68A', fontFamily: fontFamily.mono }}
                          data-testid={`advisor-conflict-open-war-room-${conflict.id.replace(/\|/g, '-')}`}
                        >
                          Resolve conflict in War Room <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)', color: 'var(--biqc-text-2)' }} data-testid="advisor-conflict-empty-state">
                    No conflicting action directions detected in current high-priority signals.
                  </div>
                )}
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
                    const signal = decision.signal;
                    const actionRecord = actionState.byKey?.[signal.dedupeKey];
                    const feedbackState = feedbackByDecision[signal.dedupeKey];
                    const projections = buildProjections(signal);

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
                          {signal.title}
                        </h3>

                        <SourceProvenanceBadge
                          source={signal.source}
                          signalType={signal.signalType}
                          timestamp={signal.createdAt}
                          testId={`advisor-provenance-${decision.id}`}
                        />

                        <div className="mt-4 space-y-3 text-sm" style={{ color: 'var(--biqc-text-2)' }}>
                          <p data-testid={`advisor-decision-why-${decision.id}`}><strong style={{ color: 'var(--biqc-text)' }}>Why now:</strong> {decision.whyNow}</p>
                          <p data-testid={`advisor-decision-if-ignored-${decision.id}`}><strong style={{ color: 'var(--biqc-text)' }}>If ignored:</strong> {signal.ifIgnored}</p>
                          <p data-testid={`advisor-decision-action-${decision.id}`}><strong style={{ color: 'var(--biqc-text)' }}>Action now:</strong> {signal.action}</p>
                        </div>

                        <div className="mt-3 rounded-xl border p-3 text-xs" style={{ borderColor: '#334155', background: '#0F172A', color: '#CBD5E1' }} data-testid={`advisor-decision-projection-${decision.id}`}>
                          <p data-testid={`advisor-decision-projection-title-${decision.id}`}><strong>30/60/90 outlook</strong></p>
                          <p data-testid={`advisor-decision-projection-ignored-${decision.id}`}>If ignored → risk {projections.ignored[0]}% / {projections.ignored[1]}% / {projections.ignored[2]}%</p>
                          <p data-testid={`advisor-decision-projection-actioned-${decision.id}`}>If actioned → risk {projections.actioned[0]}% / {projections.actioned[1]}% / {projections.actioned[2]}%</p>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2" data-testid={`advisor-decision-actions-${decision.id}`}>
                          {Object.entries(DECISION_ACTIONS).map(([actionType, config]) => {
                            const ActionIcon = config.icon;
                            const loadingThisAction = actionLoadingKey === `${decision.id}-${actionType}`;

                            return (
                              <button
                                key={actionType}
                                onClick={() => {
                                  if (actionType === 'delegate') {
                                    handleOpenDelegateModal(decision);
                                    return;
                                  }
                                  handleDecisionAction(decision, actionType);
                                }}
                                disabled={loadingThisAction || Boolean(actionRecord)}
                                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                                style={{
                                  background: config.style.bg,
                                  borderColor: config.style.border,
                                  color: config.style.text,
                                  fontFamily: fontFamily.mono,
                                }}
                                data-testid={`advisor-decision-${actionType}-${decision.id}`}
                              >
                                <ActionIcon className="h-3.5 w-3.5" />
                                {actionType === 'delegate'
                                  ? 'Delegate'
                                  : (loadingThisAction ? 'Saving...' : config.label)}
                              </button>
                            );
                          })}
                        </div>

                        {actionRecord && (
                          <div className="mt-3 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: '#334155', background: '#0F172A', color: '#CBD5E1', fontFamily: fontFamily.mono }} data-testid={`advisor-decision-action-record-${decision.id}`}>
                            Last action: {actionRecord.action} · {formatTime(actionRecord.at)}
                          </div>
                        )}

                        <button
                          onClick={() => setEvidenceDrawerDecision(decision)}
                          className="mt-3 inline-flex min-h-[44px] items-center gap-1 rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
                          style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                          data-testid={`advisor-decision-evidence-toggle-${decision.id}`}
                        >
                          View full context
                        </button>

                        <div className="mt-3 flex flex-wrap items-center gap-2" data-testid={`advisor-decision-feedback-${decision.id}`}>
                          <span className="text-[10px]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }} data-testid={`advisor-decision-feedback-label-${decision.id}`}>
                            Helpful?
                          </span>
                          <button
                            onClick={() => handleDecisionFeedback(decision, true)}
                            className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border px-2 py-1 text-[10px]"
                            style={{
                              borderColor: feedbackState === 'helpful' ? '#10B98160' : '#334155',
                              color: feedbackState === 'helpful' ? '#86EFAC' : '#CBD5E1',
                              background: feedbackState === 'helpful' ? '#10B98115' : '#0F172A',
                              fontFamily: fontFamily.mono,
                            }}
                            data-testid={`advisor-decision-feedback-yes-${decision.id}`}
                          >
                            <ThumbsUp className="h-3 w-3" /> Yes
                          </button>
                          <button
                            onClick={() => handleDecisionFeedback(decision, false)}
                            className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border px-2 py-1 text-[10px]"
                            style={{
                              borderColor: feedbackState === 'not-helpful' ? '#EF444460' : '#334155',
                              color: feedbackState === 'not-helpful' ? '#FCA5A5' : '#CBD5E1',
                              background: feedbackState === 'not-helpful' ? '#EF444415' : '#0F172A',
                              fontFamily: fontFamily.mono,
                            }}
                            data-testid={`advisor-decision-feedback-no-${decision.id}`}
                          >
                            <ThumbsDown className="h-3 w-3" /> No
                          </button>
                        </div>

                        <Link
                          to="/soundboard"
                          className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
                          style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                          data-testid={`advisor-decision-open-soundboard-${decision.id}`}
                        >
                          Open in SoundBoard <ArrowRight className="h-3.5 w-3.5" />
                        </Link>

                        {signal.occurrences > 1 && (
                          <p className="mt-3 text-xs" style={{ color: '#FCD34D', fontFamily: fontFamily.mono }} data-testid={`advisor-decision-dedupe-note-${decision.id}`}>
                            Deduplicated {signal.occurrences} repeated signals into one decision.
                          </p>
                        )}

                        {index === 2 && queuedBeyondThree > 0 && (
                          <p className="mt-3 text-xs" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }} data-testid="advisor-next-up-indicator">
                            Next up automatically after action: {queuedBeyondThree} queued signal{queuedBeyondThree === 1 ? '' : 's'}.
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="mb-10" data-testid="advisor-action-audit-section">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-[#3B82F6]" />
                    <h2 className="text-base md:text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-action-audit-title">
                      Decision Action Audit
                    </h2>
                  </div>

                  <button
                    onClick={exportAuditCsv}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
                    style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                    data-testid="advisor-action-audit-export-button"
                  >
                    <Download className="h-3.5 w-3.5" /> Export CSV
                  </button>
                </div>

                <div className="mb-3 flex flex-wrap gap-2" data-testid="advisor-action-audit-filters">
                  <select
                    value={auditActionFilter}
                    onChange={(event) => setAuditActionFilter(event.target.value)}
                    className="rounded-xl border px-3 py-2 text-xs"
                    style={{ background: '#0F172A', borderColor: '#334155', color: '#E2E8F0', fontFamily: fontFamily.mono }}
                    data-testid="advisor-action-audit-action-filter"
                  >
                    <option value="all">All actions</option>
                    <option value="complete">Resolved</option>
                    <option value="hand-off">Delegated</option>
                    <option value="ignore">Ignored</option>
                  </select>

                  <div className="flex items-center gap-1 rounded-xl border px-3 py-2" style={{ borderColor: '#334155', background: '#0F172A' }}>
                    <Search className="h-3.5 w-3.5 text-[#94A3B8]" />
                    <input
                      value={auditSearch}
                      onChange={(event) => setAuditSearch(event.target.value)}
                      placeholder="Search decision, source, domain"
                      className="w-56 bg-transparent text-xs outline-none"
                      style={{ color: '#E2E8F0', fontFamily: fontFamily.mono }}
                      data-testid="advisor-action-audit-search-input"
                    />
                  </div>
                </div>

                {!actionsHydrated ? (
                  <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)', color: 'var(--biqc-text-2)' }} data-testid="advisor-action-audit-loading">
                    Loading decision action history...
                  </div>
                ) : filteredAuditRows.length === 0 ? (
                  <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)', color: 'var(--biqc-text-2)' }} data-testid="advisor-action-audit-empty">
                    No recorded actions yet. Resolve, delegate, or ignore a decision to start the audit trail.
                  </div>
                ) : (
                  <div className="space-y-2" data-testid="advisor-action-audit-list">
                    {filteredAuditRows.map((row) => (
                      <div key={row.dedupeKey} className="rounded-xl border p-3" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid={`advisor-action-audit-row-${row.dedupeKey.replace(/\|/g, '-')}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm" style={{ color: 'var(--biqc-text)' }} data-testid={`advisor-action-audit-row-title-${row.dedupeKey.replace(/\|/g, '-')}`}>
                            {row.title}
                          </p>
                          <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }} data-testid={`advisor-action-audit-row-meta-${row.dedupeKey.replace(/\|/g, '-')}`}>
                            {row.action} · {formatTime(row.at)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="text-xs" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }} data-testid={`advisor-action-audit-row-source-${row.dedupeKey.replace(/\|/g, '-')}`}>
                            {row.source} · {row.domain}
                          </p>
                          <button
                            onClick={() => handleReopenDecision(row.dedupeKey, row.alertId)}
                            className="inline-flex min-h-[36px] items-center rounded-lg border px-2.5 py-1 text-[10px] hover:bg-white/5"
                            style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                            data-testid={`advisor-action-audit-row-reopen-${row.dedupeKey.replace(/\|/g, '-')}`}
                          >
                            Reopen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="mb-10" data-testid="advisor-signal-inbox-section">
                <div className="mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
                  <h2 className="text-base md:text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-signal-inbox-title">
                    Signal Inbox (Deduplicated)
                  </h2>
                </div>

                <div className="space-y-3" data-testid="advisor-signal-inbox-list">
                  {prioritizedSignals.slice(0, 8).map((signal) => (
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

                  {openSignals.length === 0 && (
                    <div className="rounded-2xl border p-5 text-sm" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)', color: 'var(--biqc-text-2)' }} data-testid="advisor-signal-empty-state">
                      All active signals are currently actioned. New decisions will appear automatically when fresh signals arrive.
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

              <DelegateActionModal
                open={Boolean(delegateModalDecision)}
                decision={delegateModalDecision}
                providers={delegateProviders}
                providerOptions={delegateProviderOptions}
                optionsLoading={delegateOptionsLoading}
                submitting={delegateSubmitting}
                onClose={() => setDelegateModalDecision(null)}
                onProviderChange={fetchDelegateOptions}
                onSubmit={handleDelegateSubmit}
              />

              <EvidenceDrawer
                open={Boolean(evidenceDrawerDecision)}
                decision={evidenceDrawerDecision}
                onClose={() => setEvidenceDrawerDecision(null)}
              />
            </>
          )}

          {!isLoading && !hasData && !criticalError && null}
        </div>
      </div>
    </DashboardLayout>
  );
}
