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
  resolve: { label: 'Mark resolved', icon: CheckCircle2, endpoint: 'complete', style: { bg: '#10B98115', border: '#10B98140', text: '#6EE7B7' } },
  delegate: { label: 'Assign owner + due date', icon: UserRoundPlus, endpoint: 'hand-off', style: { bg: '#3B82F615', border: '#3B82F640', text: '#93C5FD' } },
  ignore: { label: 'Ignore this signal', icon: XCircle, endpoint: 'ignore', style: { bg: '#64748B15', border: '#64748B40', text: '#CBD5E1' } },
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

const HIGH_URGENCY_SIGNAL_MATCH = /(overdue|response_delay|cash|invoice|compliance|churn|critical|payment)/;
const SYSTEM_PATTERN_MATCH = /(propagation|trend|capacity|bottleneck|stalled|pipeline|repeat|drift)/;

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
    evidenceRefs: item.evidence_refs || item.evidence || [],
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

const formatCurrency = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '$0';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(numeric);
};

const ageInDays = (isoDate) => {
  if (!isoDate) return 0;
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)));
};

const buildIntegrationSignals = (integrationContext) => {
  const raw = [];
  const deals = integrationContext?.crmDeals || [];
  const accounting = integrationContext?.accountingSummary || {};
  const priority = integrationContext?.priorityInbox || {};
  const calibration = integrationContext?.calibrationStatus || {};

  const openDeals = deals.filter((deal) => String(deal?.status || '').toUpperCase() === 'OPEN');
  const stalledDeals = openDeals
    .map((deal) => ({ ...deal, days_stalled: ageInDays(deal?.last_activity_at || deal?.created_at) }))
    .filter((deal) => deal.days_stalled >= 14)
    .sort((a, b) => b.days_stalled - a.days_stalled);

  if (stalledDeals.length > 0) {
    const topDeals = stalledDeals.slice(0, 3);
    const names = topDeals.map((deal) => `${deal.name || 'Unnamed deal'} (${deal.days_stalled}d)`).join(', ');
    raw.push(toSignal({
      id: 'crm-stalled-deals',
      signal: 'stalled_deals',
      domain: 'sales',
      severity: stalledDeals.length >= 6 ? 'high' : 'medium',
      title: `${stalledDeals.length} HubSpot deals stalled 14+ days`,
      detail: `Top stalled deals: ${names}.`,
      recommendation: 'Assign deal owners and trigger follow-up workflows today.',
      if_ignored: 'Pipeline conversion probability drops as stalled deals age without movement.',
      source: 'hubspot',
      created_at: topDeals[0]?.last_activity_at || null,
    }, 'crm'));
  }

  if (openDeals.length > 0) {
    raw.push(toSignal({
      id: 'crm-open-pipeline',
      signal: 'open_pipeline_pressure',
      domain: 'revenue',
      severity: openDeals.length >= 20 ? 'medium' : 'low',
      title: `${openDeals.length} open opportunities in CRM`,
      detail: `Open pipeline requires active owner updates to keep forecast reliable.`,
      recommendation: 'Review stage progression and close-date confidence for top opportunities.',
      if_ignored: 'Forecast confidence degrades when open opportunities are not refreshed weekly.',
      source: 'hubspot',
    }, 'crm'));
  }

  const metrics = accounting?.metrics || {};
  if (accounting?.connected && Number(metrics.overdue_count || 0) > 0) {
    raw.push(toSignal({
      id: 'accounting-overdue-invoices',
      signal: 'overdue_invoices',
      domain: 'cash',
      severity: Number(metrics.overdue_count || 0) >= 3 ? 'high' : 'medium',
      title: `${metrics.overdue_count} overdue invoice${metrics.overdue_count === 1 ? '' : 's'} in Xero`,
      detail: `Total overdue value ${formatCurrency(metrics.total_overdue)}. Outstanding ledger ${formatCurrency(metrics.total_outstanding)}.`,
      recommendation: 'Launch collections sequence and escalate invoices older than terms.',
      if_ignored: 'Working capital gets trapped and short-term runway tightens.',
      source: 'xero',
    }, 'accounting'));
  }

  const highPriorityEmails = priority?.analysis?.high_priority || priority?.high_priority || [];
  if (Array.isArray(highPriorityEmails) && highPriorityEmails.length > 0) {
    const topSubjects = highPriorityEmails
      .slice(0, 2)
      .map((email) => email.subject || email.reason || 'Priority thread')
      .join(' | ');

    raw.push(toSignal({
      id: 'email-priority-inbox',
      signal: 'priority_email_threads',
      domain: 'communications',
      severity: highPriorityEmails.length >= 5 ? 'high' : 'medium',
      title: `${highPriorityEmails.length} high-priority email thread${highPriorityEmails.length === 1 ? '' : 's'}`,
      detail: topSubjects || 'Priority inbox has unresolved time-sensitive threads.',
      recommendation: 'Open Priority Inbox and respond to urgent customer and cash-impacting emails.',
      if_ignored: 'Delayed responses increase churn and payment friction risk.',
      source: 'outlook',
    }, 'email'));
  }

  if (calibration?.status && String(calibration.status).toUpperCase() !== 'COMPLETE') {
    raw.push(toSignal({
      id: 'calibration-incomplete',
      signal: 'calibration_incomplete',
      domain: 'platform',
      severity: 'medium',
      title: 'Calibration is incomplete',
      detail: `Current calibration state: ${calibration.status}.`,
      recommendation: 'Complete calibration to unlock full executive precision and role weighting.',
      if_ignored: 'Decision confidence and intent accuracy remain below full potential.',
      source: 'snapshot',
    }, 'snapshot'));
  }

  return dedupeSignals(raw);
};

const buildSignalsFromExecutiveSurface = (executiveSurface) => {
  const cards = executiveSurface?.cards || {};
  const ordered = [cards.decide_now, cards.monitor_this_week, cards.build_next].filter(Boolean);
  return dedupeSignals(
    ordered.map((card, index) => toSignal({
      id: card.signal_key || `exec-signal-${index + 1}`,
      signal: card.signal_key || `executive_signal_${index + 1}`,
      domain: card.bucket_hint || 'general',
      severity: Number(card.risk_score || 0) >= 80 ? 'high' : Number(card.risk_score || 0) >= 60 ? 'medium' : 'low',
      title: card.signal_summary,
      detail: `${card.evidence_summary || ''}`.trim() || card.decision_summary,
      recommendation: card.action_summary,
      if_ignored: card.consequence,
      source: card.source || 'snapshot',
      created_at: card.timestamp,
    }, 'snapshot')),
  );
};

const scoreRiskForBucket = (signal, bucketId) => {
  if (!signal) return 0;
  const base = { critical: 92, high: 78, medium: 58, low: 38, info: 25 }[signal.severity] || 30;
  const frequencyBoost = Math.min((signal.occurrences || 1) * 5, 16);
  const bucketBoost = bucketId === 'decide-now' ? 10 : bucketId === 'monitor-this-week' ? 4 : 0;
  return Math.min(99, Math.round(base + frequencyBoost + bucketBoost));
};

const confidenceIntervalForSignal = (signal) => {
  if (!signal) return 'N/A';
  const sourceMid = {
    CRM: 74,
    Accounting: 78,
    'Email/Calendar': 69,
    'Observation Events': 63,
    'Market Feed': 61,
    Snapshot: 56,
  };
  const mid = sourceMid[signal.source] || 58;
  const spread = signal.occurrences > 1 ? 7 : 10;
  return `${Math.max(0, mid - spread)}–${Math.min(99, mid + spread)}%`;
};

const bucketHeadline = (slotId, signal) => {
  if (!signal) {
    if (slotId === 'decide-now') return 'No imminent owner-critical signal from verified feeds.';
    if (slotId === 'monitor-this-week') return 'No weekly pressure trend currently above threshold.';
    return 'No repeated pattern currently requiring systems build action.';
  }

  if (slotId === 'decide-now') {
    if (/(cash|invoice|payment|revenue)/.test(signal.domain)) return 'Imminent commercial impact in next 48 hours.';
    if (/(compliance|risk|operations)/.test(signal.domain)) return 'Imminent execution/compliance impact in next 48 hours.';
    return 'Imminent owner decision required in next 48 hours.';
  }
  if (slotId === 'monitor-this-week') {
    return 'Rising pressure trend this week; active monitoring required.';
  }
  return 'System pattern detected; this month’s build fix can prevent recurrence.';
};

const buildDecisionSurface = (signals) => {
  const remaining = [...signals];

  const pull = (predicate) => {
    const idx = remaining.findIndex(predicate);
    if (idx === -1) return null;
    const [picked] = remaining.splice(idx, 1);
    return picked;
  };

  const decideSignal = pull((signal) => {
    if (!signal) return false;
    return signal.severity === 'critical'
      || signal.severity === 'high'
      || HIGH_URGENCY_SIGNAL_MATCH.test(`${signal.signalType} ${signal.domain} ${signal.title}`.toLowerCase());
  }) || remaining.shift() || null;

  const monitorSignal = pull((signal) => {
    if (!signal) return false;
    return signal.severity === 'medium'
      || SYSTEM_PATTERN_MATCH.test(`${signal.signalType} ${signal.domain} ${signal.title}`.toLowerCase());
  }) || remaining.shift() || null;

  const buildSignal = pull((signal) => {
    if (!signal) return false;
    return (signal.occurrences || 1) > 1
      || SYSTEM_PATTERN_MATCH.test(`${signal.signalType} ${signal.domain} ${signal.title}`.toLowerCase());
  }) || remaining.shift() || null;

  const mappedSignals = {
    'decide-now': decideSignal,
    'monitor-this-week': monitorSignal,
    'build-next': buildSignal,
  };

  return DECISION_SLOTS.map((slot) => {
    const signal = mappedSignals[slot.id] || null;
    const riskScore = scoreRiskForBucket(signal, slot.id);
    const confidenceInterval = confidenceIntervalForSignal(signal);
    const headline = bucketHeadline(slot.id, signal);

    if (!signal) {
      return {
        ...slot,
        signal: null,
        severity: 'info',
        riskScore,
        confidenceInterval,
        headline,
        whyNow: headline,
      };
    }

    return {
      ...slot,
      signal,
      severity: signal.severity,
      riskScore,
      confidenceInterval,
      headline,
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
  const [integrationContext, setIntegrationContext] = useState({
    mergeConnected: {},
    crmDeals: [],
    accountingSummary: null,
    priorityInbox: null,
    outlookStatus: null,
    calibrationStatus: null,
    executiveSurface: null,
  });
  const [integrationContextLoading, setIntegrationContextLoading] = useState(false);
  const [integrationContextError, setIntegrationContextError] = useState('');
  const [actionState, setActionState] = useState({ byKey: {}, byAlertId: {} });
  const [actionsHydrated, setActionsHydrated] = useState(false);
  const [actionLoadingKey, setActionLoadingKey] = useState('');
  const [rolePreference, setRolePreference] = useState(() => localStorage.getItem('advisor-role-preference') || 'ceo');
  const [pageFeedback, setPageFeedback] = useState(() => localStorage.getItem('advisor-page-feedback') || '');
  const [delegateModalDecision, setDelegateModalDecision] = useState(null);
  const [delegateSubmitting, setDelegateSubmitting] = useState(false);
  const [delegateProviders, setDelegateProviders] = useState([]);
  const [delegateProviderOptions, setDelegateProviderOptions] = useState({
    provider: 'auto',
    recommendedProvider: 'auto',
    assignees: [],
    collections: [],
  });
  const [delegateProviderHealthLoaded, setDelegateProviderHealthLoaded] = useState(false);
  const [delegateProviderHealth, setDelegateProviderHealth] = useState({
    ticketing_provider: null,
    outlook_exchange: false,
    outlook_connected: false,
    outlook_expired: false,
    outlook_expires_at: null,
    google_workspace: false,
    gmail_connected: false,
    gmail_needs_reconnect: false,
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

  const fetchIntegrationContext = useCallback(async () => {
    setIntegrationContextLoading(true);
    setIntegrationContextError('');

    try {
      const requests = await Promise.allSettled([
        apiClient.get('/advisor/executive-surface', { timeout: 15000 }),
        apiClient.get('/integrations/merge/connected', { timeout: 12000 }),
        apiClient.get('/integrations/crm/deals', { params: { page_size: 50 }, timeout: 15000 }),
        apiClient.get('/integrations/accounting/summary', { timeout: 15000 }),
        apiClient.get('/outlook/status', { timeout: 10000 }),
        apiClient.get('/email/priority-inbox', { timeout: 12000 }),
        apiClient.get('/calibration/status', { timeout: 10000 }),
      ]);

      const [surfaceRes, mergeRes, crmRes, accountingRes, outlookRes, priorityRes, calibrationRes] = requests;

      const executiveSurface = surfaceRes.status === 'fulfilled' ? (surfaceRes.value?.data || null) : null;

      const mergeConnected = mergeRes.status === 'fulfilled' ? (mergeRes.value?.data?.integrations || {}) : {};
      const crmDeals = crmRes.status === 'fulfilled' ? (crmRes.value?.data?.results || []) : [];
      const accountingSummary = accountingRes.status === 'fulfilled' ? (accountingRes.value?.data || null) : null;
      const outlookStatus = outlookRes.status === 'fulfilled' ? (outlookRes.value?.data || null) : null;
      const priorityInbox = priorityRes.status === 'fulfilled' ? (priorityRes.value?.data || null) : null;
      const calibrationStatus = calibrationRes.status === 'fulfilled' ? (calibrationRes.value?.data || null) : null;

      setIntegrationContext({
        mergeConnected,
        crmDeals,
        accountingSummary,
        priorityInbox,
        outlookStatus,
        calibrationStatus,
        executiveSurface,
      });
    } catch (error) {
      setIntegrationContextError(error?.response?.data?.detail || 'Unable to load integration context.');
    } finally {
      setIntegrationContextLoading(false);
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
    if (pageFeedback) {
      localStorage.setItem('advisor-page-feedback', pageFeedback);
    }
  }, [pageFeedback]);

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
    fetchIntegrationContext();
    hydrateActionHistory();
  }, [fetchOverview, fetchWatchtower, fetchIntegrationContext, hydrateActionHistory]);

  const handleRefresh = async () => {
    await Promise.allSettled([
      refreshSnapshot(),
      fetchOverview(true),
      fetchWatchtower(),
      fetchIntegrationContext(),
      fetchDelegateProviders(),
    ]);
  };

  const hasOverviewData = Boolean(overview);
  const hasSnapshotData = Boolean(cognitive);
  const hasWatchtowerData = (watchtowerEvents || []).length > 0;
  const hasIntegrationData = (integrationContext.crmDeals || []).length > 0
    || Boolean(integrationContext.accountingSummary?.connected)
    || Boolean(integrationContext.outlookStatus?.connected)
    || Boolean(integrationContext.priorityInbox?.analysis)
    || Boolean(integrationContext.priorityInbox?.high_priority)
    || Boolean(integrationContext.calibrationStatus?.status);
  const hasData = hasSnapshotData || hasOverviewData || hasWatchtowerData || hasIntegrationData;
  const isLoading = !loadingGuardExpired
    && !hasData
    && !overviewError
    && !watchtowerError
    && !integrationContextError
    && (overviewLoading || watchtowerLoading || integrationContextLoading);
  const dataErrorMessage = snapshotError || overviewError || watchtowerError || integrationContextError || '';
  const criticalError = !isLoading && !hasData && Boolean(dataErrorMessage);

  useEffect(() => {
    if (authState === AUTH_STATE.LOADING) return;
    if (hasData || overviewLoading || watchtowerLoading) return;
    fetchOverview(true);
    fetchWatchtower();
    fetchIntegrationContext();
    hydrateActionHistory();
  }, [
    authState,
    hasData,
    overviewLoading,
    watchtowerLoading,
    integrationContextLoading,
    fetchOverview,
    fetchWatchtower,
    fetchIntegrationContext,
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

  const signals = useMemo(() => {
    const surfaceSignals = buildSignalsFromExecutiveSurface(integrationContext.executiveSurface);
    const coreSignals = buildSignals(overview, cognitive, watchtowerEvents);
    const integrationSignals = buildIntegrationSignals(integrationContext);

    if (surfaceSignals.length > 0) {
      return dedupeSignals([...surfaceSignals, ...coreSignals]);
    }

    return dedupeSignals([...coreSignals, ...integrationSignals]);
  }, [overview, cognitive, watchtowerEvents, integrationContext]);

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
    () => buildDecisionSurface(prioritizedSignals),
    [prioritizedSignals],
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
      const health = response?.data?.connected_business_tools || {};
      setDelegateProviders(providers);
      setDelegateProviderHealth((prev) => ({ ...prev, ...health }));
      setDelegateProviderHealthLoaded(true);
      setDelegateProviderOptions((prev) => ({
        ...prev,
        recommendedProvider,
      }));
      return recommendedProvider;
    } catch {
      // Fallback to existing stable APIs to avoid false negatives during transient failures.
      try {
        const [outlookRes, gmailRes, mergeRes] = await Promise.allSettled([
          apiClient.get('/outlook/status', { timeout: 8000 }),
          apiClient.get('/gmail/status', { timeout: 8000 }),
          apiClient.get('/integrations/merge/connected', { timeout: 8000 }),
        ]);

        const outlookData = outlookRes.status === 'fulfilled' ? (outlookRes.value?.data || {}) : {};
        const gmailData = gmailRes.status === 'fulfilled' ? (gmailRes.value?.data || {}) : {};
        const mergeData = mergeRes.status === 'fulfilled' ? (mergeRes.value?.data || {}) : {};

        const integrations = mergeData?.integrations || {};
        const ticketingEntry = Object.values(integrations).find((item) => item?.category === 'ticketing' && item?.connected);
        const ticketingProvider = ticketingEntry?.provider ? String(ticketingEntry.provider).toLowerCase() : null;

        const outlookExchangeReady = Boolean(outlookData?.connected) && !Boolean(outlookData?.token_expired);
        const googleWorkspaceReady = Boolean(gmailData?.connected) && !Boolean(gmailData?.needs_reconnect);

        const derivedProviders = [
          { id: 'auto', label: 'Auto (based on connected tools)', available: Boolean(ticketingProvider || outlookExchangeReady || googleWorkspaceReady) },
          { id: 'manual', label: 'Manual follow-up', available: true },
          { id: 'jira', label: 'Jira (via Merge)', available: ticketingProvider?.includes('jira') || false },
          { id: 'asana', label: 'Asana (via Merge)', available: ticketingProvider?.includes('asana') || false },
          { id: 'merge-ticketing', label: 'Connected Ticketing Tool (via Merge)', available: Boolean(ticketingProvider) },
          { id: 'outlook-exchange', label: 'Outlook / Exchange', available: outlookExchangeReady },
          { id: 'google-calendar', label: 'Google Calendar', available: googleWorkspaceReady },
        ];

        setDelegateProviders(derivedProviders);
        setDelegateProviderHealth({
          ticketing_provider: ticketingProvider,
          outlook_exchange: outlookExchangeReady,
          outlook_connected: Boolean(outlookData?.connected),
          outlook_expired: Boolean(outlookData?.token_expired),
          outlook_expires_at: outlookData?.expires_at || null,
          google_workspace: googleWorkspaceReady,
          gmail_connected: Boolean(gmailData?.connected),
          gmail_needs_reconnect: Boolean(gmailData?.needs_reconnect),
        });
        setDelegateProviderHealthLoaded(true);

        const recommended = ticketingProvider
          ? 'merge-ticketing'
          : outlookExchangeReady
            ? 'outlook-exchange'
            : googleWorkspaceReady
              ? 'google-calendar'
              : 'manual';

        setDelegateProviderOptions((prev) => ({ ...prev, recommendedProvider: recommended }));
        return recommended;
      } catch {
        setDelegateProviderHealthLoaded(false);
        setDelegateProviders((prev) => {
          if (prev.length) return prev;
          return [
            { id: 'auto', label: 'Auto (based on connected tools)', available: false },
            { id: 'manual', label: 'Manual follow-up', available: true },
            { id: 'merge-ticketing', label: 'Merge Ticketing', available: false },
            { id: 'outlook-exchange', label: 'Outlook / Exchange', available: false },
            { id: 'google-calendar', label: 'Google Calendar', available: false },
          ];
        });
        return 'manual';
      }
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

  const handlePageFeedback = useCallback(async (helpful) => {
    const value = helpful ? 'helpful' : 'not-helpful';
    setPageFeedback(value);

    try {
      await apiClient.post('/workflows/decision-feedback', {
        decision_key: 'advisor-page',
        helpful,
      }, { timeout: 8000 });
      toast.success('Thanks — feedback saved for advisor quality tuning.');
    } catch {
      // local persistence retained even if API write fails.
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
    const mergeMap = integrationContext.mergeConnected || integrationContext.executiveSurface?.connected_tools || {};

    Object.values(mergeMap).forEach((entry) => {
      if (entry?.connected && entry?.provider) list.push(entry.provider);
    });

    if (integrationContext.outlookStatus?.connected) list.push('Outlook');

    if (!list.length) {
      if (integrationTruth.crm) list.push('CRM');
      if (integrationTruth.accounting) list.push('Accounting');
      if (integrationTruth.email) list.push('Email');
    }

    return [...new Set(list)];
  }, [integrationTruth, integrationContext]);

  const executiveSnapshot = useMemo(() => {
    const surfaceSnapshot = integrationContext.executiveSurface?.snapshot;
    if (surfaceSnapshot) {
      return {
        openDeals: Number(surfaceSnapshot.open_deals || 0),
        stalledDeals: Number(surfaceSnapshot.stalled_deals_72h || 0),
        overdueCount: Number(surfaceSnapshot.overdue_invoices || 0),
        overdueValue: Number(surfaceSnapshot.total_overdue || 0),
        outstandingValue: Number(surfaceSnapshot.total_outstanding || 0),
        highPriorityEmails: Number(surfaceSnapshot.high_priority_threads || 0),
        calibrationStatus: integrationContext.calibrationStatus?.status || null,
      };
    }

    const metrics = integrationContext.accountingSummary?.metrics || {};
    const deals = integrationContext.crmDeals || [];
    const openDeals = deals.filter((deal) => String(deal?.status || '').toUpperCase() === 'OPEN').length;
    const stalledDeals = deals.filter((deal) => ageInDays(deal?.last_activity_at || deal?.created_at) >= 14).length;
    const priority = integrationContext.priorityInbox?.analysis || integrationContext.priorityInbox || {};
    const highPriorityEmails = (priority.high_priority || []).length;

    return {
      openDeals,
      stalledDeals,
      overdueCount: Number(metrics.overdue_count || 0),
      overdueValue: Number(metrics.total_overdue || 0),
      outstandingValue: Number(metrics.total_outstanding || 0),
      highPriorityEmails,
      calibrationStatus: integrationContext.calibrationStatus?.status || null,
    };
  }, [integrationContext]);

  const liveSignalCount = overview?.live_signal_count || cognitive?.live_signal_count || signals.length;
  const confidenceRaw = overview?.confidence_score ?? overview?.confidence ?? cognitive?.system_state?.confidence ?? null;
  const confidence = typeof confidenceRaw === 'number' ? Math.round(confidenceRaw <= 1 ? confidenceRaw * 100 : confidenceRaw) : null;
  const executiveMemo = overview?.executive_memo || cognitive?.executive_memo || cognitive?.memo;
  const migrationRequired = overview?.status === 'MIGRATION_REQUIRED';
  const queuedBeyondThree = Math.max(openSignals.length - 3, 0);
  const noActiveDecisions = decisions.every((decision) => !decision.signal);

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
                {connectedSources.length > 0
                  ? `Three decisions from ${connectedSources.join(', ')} evidence. Clear owner-ready actions.`
                  : 'Three decision buckets are active. Connect integrations to unlock verified signals.'}
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

              <section className="mb-8 rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="advisor-executive-snapshot-section">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-[#FF6A00]" />
                  <h2 className="text-base md:text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-executive-snapshot-title">
                    Executive Snapshot (Live Integration Truth)
                  </h2>
                </div>

                <div className="grid gap-3 md:grid-cols-4" data-testid="advisor-executive-snapshot-grid">
                  <div className="rounded-xl border p-3" style={{ borderColor: 'var(--biqc-border)', background: '#0F172A' }} data-testid="advisor-executive-snapshot-crm">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>CRM Pipeline</p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--biqc-text)' }} data-testid="advisor-executive-snapshot-crm-value">
                      {executiveSnapshot.openDeals} open · {executiveSnapshot.stalledDeals} stalled 14+d
                    </p>
                  </div>

                  <div className="rounded-xl border p-3" style={{ borderColor: 'var(--biqc-border)', background: '#0F172A' }} data-testid="advisor-executive-snapshot-cash">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>Cash Exposure</p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--biqc-text)' }} data-testid="advisor-executive-snapshot-cash-value">
                      {executiveSnapshot.overdueCount} overdue · {formatCurrency(executiveSnapshot.overdueValue)}
                    </p>
                  </div>

                  <div className="rounded-xl border p-3" style={{ borderColor: 'var(--biqc-border)', background: '#0F172A' }} data-testid="advisor-executive-snapshot-email">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>Priority Inbox</p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--biqc-text)' }} data-testid="advisor-executive-snapshot-email-value">
                      {executiveSnapshot.highPriorityEmails} high-priority threads
                    </p>
                  </div>

                  <div className="rounded-xl border p-3" style={{ borderColor: 'var(--biqc-border)', background: '#0F172A' }} data-testid="advisor-executive-snapshot-calibration">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>Calibration</p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--biqc-text)' }} data-testid="advisor-executive-snapshot-calibration-value">
                      {executiveSnapshot.calibrationStatus || 'Unknown'}
                    </p>
                  </div>
                </div>

                {connectedSources.length === 0 && (
                  <div className="mt-3 rounded-xl border p-3 text-sm" style={{ borderColor: '#F59E0B60', background: '#F59E0B12', color: '#FDE68A' }} data-testid="advisor-integration-onboarding-prompt">
                    No integrations detected yet. Connect HubSpot, Xero, and Outlook to activate personalized executive signals.
                    <Link to="/integrations" className="ml-2 underline" data-testid="advisor-integration-onboarding-link">Open Integrations</Link>
                  </div>
                )}
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

              <section className="mb-8" data-testid="advisor-provider-health-section">
                <div className="mb-3 flex items-center gap-2">
                  <Radar className="h-4 w-4 text-[#3B82F6]" />
                  <h2 className="text-base md:text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-provider-health-title">
                    Delegate Provider Health
                  </h2>
                </div>

                <div className="grid gap-3 md:grid-cols-3" data-testid="advisor-provider-health-grid">
                  <article className="rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="advisor-provider-health-ticketing-card">
                    <p className="text-xs uppercase tracking-[0.12em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} data-testid="advisor-provider-health-ticketing-label">
                      Jira / Asana via Merge
                    </p>
                    <p className="mt-2 text-sm" style={{ color: 'var(--biqc-text)' }} data-testid="advisor-provider-health-ticketing-value">
                      {!delegateProviderHealthLoaded
                        ? 'Status unavailable'
                        : (delegateProviderHealth.ticketing_provider ? `Connected: ${delegateProviderHealth.ticketing_provider}` : 'Not connected')}
                    </p>
                    {delegateProviderHealthLoaded && !delegateProviderHealth.ticketing_provider && (
                      <Link
                        to="/integrations"
                        className="mt-3 inline-flex min-h-[40px] items-center rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
                        style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                        data-testid="advisor-provider-health-ticketing-connect-cta"
                      >
                        Connect Merge Ticketing
                      </Link>
                    )}
                  </article>

                  <article className="rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="advisor-provider-health-outlook-card">
                    <p className="text-xs uppercase tracking-[0.12em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} data-testid="advisor-provider-health-outlook-label">
                      Outlook / Exchange
                    </p>
                    <p className="mt-2 text-sm" style={{ color: 'var(--biqc-text)' }} data-testid="advisor-provider-health-outlook-value">
                      {!delegateProviderHealthLoaded
                        ? 'Status unavailable'
                        : (delegateProviderHealth.outlook_exchange
                          ? 'Ready for delegation'
                          : delegateProviderHealth.outlook_connected
                            ? 'Connected but token refresh required'
                            : 'Not connected')}
                    </p>
                    {delegateProviderHealthLoaded && delegateProviderHealth.outlook_expires_at && (
                      <p className="mt-1 text-xs" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }} data-testid="advisor-provider-health-outlook-expiry">
                        Token expiry: {formatTime(delegateProviderHealth.outlook_expires_at)}
                      </p>
                    )}
                    {delegateProviderHealthLoaded && !delegateProviderHealth.outlook_exchange && (
                      <Link
                        to="/connect-email"
                        className="mt-3 inline-flex min-h-[40px] items-center rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
                        style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                        data-testid="advisor-provider-health-outlook-reconnect-cta"
                      >
                        Reconnect Outlook
                      </Link>
                    )}
                  </article>

                  <article className="rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="advisor-provider-health-google-card">
                    <p className="text-xs uppercase tracking-[0.12em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} data-testid="advisor-provider-health-google-label">
                      Google Calendar
                    </p>
                    <p className="mt-2 text-sm" style={{ color: 'var(--biqc-text)' }} data-testid="advisor-provider-health-google-value">
                      {!delegateProviderHealthLoaded
                        ? 'Status unavailable'
                        : (delegateProviderHealth.google_workspace
                          ? 'Ready for delegation'
                          : delegateProviderHealth.gmail_connected
                            ? 'Connected but token refresh required'
                            : 'Not connected')}
                    </p>
                    {delegateProviderHealthLoaded && !delegateProviderHealth.google_workspace && (
                      <Link
                        to="/connect-email"
                        className="mt-3 inline-flex min-h-[40px] items-center rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
                        style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                        data-testid="advisor-provider-health-google-connect-cta"
                      >
                        Connect Google
                      </Link>
                    )}
                  </article>
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

                {noActiveDecisions ? (
                  <div className="rounded-2xl border p-5" style={{ borderColor: '#334155', background: '#0F172A' }} data-testid="advisor-all-clear-state">
                    <h3 className="text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-all-clear-title">
                      All clear right now — no high-priority decision signal detected.
                    </h3>
                    <p className="mt-2 text-sm" style={{ color: 'var(--biqc-text-2)' }} data-testid="advisor-all-clear-summary">
                      Current live scan: {executiveSnapshot.openDeals} open deals, {executiveSnapshot.overdueCount} overdue invoices, {executiveSnapshot.highPriorityEmails} high-priority threads.
                    </p>
                    <p className="mt-2 text-sm" style={{ color: 'var(--biqc-text-2)' }} data-testid="advisor-all-clear-next-step">
                      Keep monitoring this week and sync integrations if you expected active risks.
                    </p>
                  </div>
                ) : (
                <div className="grid gap-4 lg:grid-cols-3" data-testid="advisor-decision-grid">
                  {decisions.map((decision, index) => {
                    const Icon = decision.icon;
                    const style = SEVERITY_STYLE[decision.severity] || SEVERITY_STYLE.medium;
                    const signal = decision.signal;
                    const actionRecord = signal ? actionState.byKey?.[signal.dedupeKey] : null;
                    const projections = signal ? buildProjections(signal) : null;

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
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }} data-testid={`advisor-decision-severity-${decision.id}`}>
                              {decision.severity}
                            </span>
                            {signal && (
                              <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: '#0F172A', color: '#CBD5E1', fontFamily: fontFamily.mono }} data-testid={`advisor-decision-risk-score-${decision.id}`}>
                                Risk {decision.riskScore}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="mb-1 text-sm" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }} data-testid={`advisor-decision-intent-${decision.id}`}>
                          {decision.intent}
                        </p>
                        <p className="mb-1 text-sm" style={{ color: style.text }} data-testid={`advisor-decision-headline-${decision.id}`}>
                          {decision.headline}
                        </p>
                        {signal && (
                          <p className="mb-2 text-[10px] uppercase tracking-[0.12em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }} data-testid={`advisor-decision-confidence-${decision.id}`}>
                            Confidence interval: {decision.confidenceInterval}
                          </p>
                        )}
                        <h3 className="mb-3 text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid={`advisor-decision-title-${decision.id}`}>
                          {signal ? signal.title : `No verified ${decision.title.toLowerCase()} signal`}
                        </h3>

                        {signal ? (
                          <SourceProvenanceBadge
                            source={signal.source}
                            signalType={signal.signalType}
                            timestamp={signal.createdAt}
                            testId={`advisor-provenance-${decision.id}`}
                          />
                        ) : (
                          <p className="text-xs" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }} data-testid={`advisor-provenance-${decision.id}`}>
                            Waiting for verified events from connected tools.
                          </p>
                        )}

                        <div className="mt-4 space-y-3 text-sm" style={{ color: 'var(--biqc-text-2)' }}>
                          <p data-testid={`advisor-decision-why-${decision.id}`}><strong style={{ color: 'var(--biqc-text)' }}>Why now:</strong> {decision.whyNow}</p>
                          <p data-testid={`advisor-decision-if-ignored-${decision.id}`}><strong style={{ color: 'var(--biqc-text)' }}>If ignored:</strong> {signal ? signal.ifIgnored : 'No immediate execution risk detected in this bucket.'}</p>
                          <p data-testid={`advisor-decision-action-${decision.id}`}><strong style={{ color: 'var(--biqc-text)' }}>Action now:</strong> {signal ? signal.action : 'Trigger sync or wait for next watchtower signal.'}</p>
                        </div>

                        <div className="mt-3 rounded-xl border p-3 text-xs" style={{ borderColor: '#334155', background: '#0F172A', color: '#CBD5E1' }} data-testid={`advisor-decision-loop-${decision.id}`}>
                          <p data-testid={`advisor-decision-loop-signal-${decision.id}`}><strong>Signal:</strong> {signal ? signal.detail : 'No signal above threshold.'}</p>
                          <p data-testid={`advisor-decision-loop-decision-${decision.id}`}><strong>Decision:</strong> {decision.headline}</p>
                          <p data-testid={`advisor-decision-loop-action-${decision.id}`}><strong>Action:</strong> {signal ? signal.action : 'No action required.'}</p>
                        </div>

                        {signal && projections && (
                          <div className="mt-3 rounded-xl border p-3 text-xs" style={{ borderColor: '#334155', background: '#0F172A', color: '#CBD5E1' }} data-testid={`advisor-decision-projection-${decision.id}`}>
                            <p data-testid={`advisor-decision-projection-title-${decision.id}`}><strong>30/60/90 outlook</strong></p>
                            <p data-testid={`advisor-decision-projection-ignored-${decision.id}`}>If ignored → risk {projections.ignored[0]}% / {projections.ignored[1]}% / {projections.ignored[2]}%</p>
                            <p data-testid={`advisor-decision-projection-actioned-${decision.id}`}>If actioned → risk {projections.actioned[0]}% / {projections.actioned[1]}% / {projections.actioned[2]}%</p>
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2" data-testid={`advisor-decision-actions-${decision.id}`}>
                          {Object.entries(DECISION_ACTIONS).map(([actionType, config]) => {
                            const ActionIcon = config.icon;
                            const loadingThisAction = actionLoadingKey === `${decision.id}-${actionType}`;

                            return (
                              <button
                                key={actionType}
                                onClick={() => {
                                  if (!signal) return;
                                  if (actionType === 'delegate') {
                                    handleOpenDelegateModal(decision);
                                    return;
                                  }
                                  handleDecisionAction(decision, actionType);
                                }}
                                disabled={!signal || loadingThisAction || Boolean(actionRecord)}
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
                                {loadingThisAction ? 'Saving...' : config.label}
                              </button>
                            );
                          })}
                        </div>

                        {signal && actionRecord && (
                          <div className="mt-3 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: '#334155', background: '#0F172A', color: '#CBD5E1', fontFamily: fontFamily.mono }} data-testid={`advisor-decision-action-record-${decision.id}`}>
                            Last action: {actionRecord.action} · {formatTime(actionRecord.at)}
                          </div>
                        )}

                        <button
                          onClick={() => signal ? setEvidenceDrawerDecision(decision) : null}
                          className="mt-3 inline-flex min-h-[44px] items-center gap-1 rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
                          style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                          data-testid={`advisor-decision-evidence-toggle-${decision.id}`}
                          disabled={!signal}
                        >
                          {signal ? 'View full context' : 'No context yet'}
                        </button>

                        <Link
                          to="/soundboard"
                          className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
                          style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                          data-testid={`advisor-decision-open-soundboard-${decision.id}`}
                        >
                          Open in SoundBoard <ArrowRight className="h-3.5 w-3.5" />
                        </Link>

                        {signal && signal.occurrences > 1 && (
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
                )}
              </section>

              <section className="mb-8 rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="advisor-page-feedback-section">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} data-testid="advisor-page-feedback-label">
                      Single feedback loop
                    </p>
                    <p className="text-sm" style={{ color: 'var(--biqc-text-2)' }} data-testid="advisor-page-feedback-copy">
                      Is this advisor page helping you decide faster with confidence?
                    </p>
                  </div>
                  <div className="flex items-center gap-2" data-testid="advisor-page-feedback-actions">
                    <button
                      onClick={() => handlePageFeedback(true)}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-2.5 py-1 text-xs"
                      style={{
                        borderColor: pageFeedback === 'helpful' ? '#10B98160' : '#334155',
                        color: pageFeedback === 'helpful' ? '#86EFAC' : '#CBD5E1',
                        background: pageFeedback === 'helpful' ? '#10B98115' : '#0F172A',
                        fontFamily: fontFamily.mono,
                      }}
                      data-testid="advisor-page-feedback-yes"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" /> Helpful
                    </button>
                    <button
                      onClick={() => handlePageFeedback(false)}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-2.5 py-1 text-xs"
                      style={{
                        borderColor: pageFeedback === 'not-helpful' ? '#EF444460' : '#334155',
                        color: pageFeedback === 'not-helpful' ? '#FCA5A5' : '#CBD5E1',
                        background: pageFeedback === 'not-helpful' ? '#EF444415' : '#0F172A',
                        fontFamily: fontFamily.mono,
                      }}
                      data-testid="advisor-page-feedback-no"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" /> Not helpful
                    </button>
                  </div>
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
