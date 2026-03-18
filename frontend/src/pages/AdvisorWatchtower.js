import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Download,
  Info,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, moderate: 2, low: 3, info: 4 };
const SEVERITY_STYLE = {
  critical: { bg: '#EF444415', border: '#EF444450', text: '#FCA5A5' },
  high: { bg: '#F9731615', border: '#F9731650', text: '#FDBA74' },
  medium: { bg: '#F59E0B15', border: '#F59E0B50', text: '#FCD34D' },
  low: { bg: '#10B98115', border: '#10B98150', text: '#6EE7B7' },
  info: { bg: '#64748B15', border: '#64748B50', text: '#CBD5E1' },
};

const DECISION_ACTIONS = {
  resolve: { label: 'Mark as actioned', icon: CheckCircle2, endpoint: 'complete', style: { bg: '#10B98115', border: '#10B98140', text: '#6EE7B7' } },
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

const InlineInfo = ({ description, testId }) => (
  <span
    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#334155] text-[#94A3B8]"
    title={description}
    data-testid={testId}
  >
    <Info className="h-3 w-3" />
  </span>
);

const isPlaceholderText = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  const exactPlaceholders = new Set([
    'direct',
    'n/a',
    'na',
    'none',
    'unknown',
    'recent',
    'signal',
    'generic',
    '-',
  ]);
  if (exactPlaceholders.has(normalized)) return true;
  return /^(direct\s*)+$/.test(normalized);
};

const settledErrorMessage = (result) => {
  if (!result || result.status !== 'rejected') return '';
  const reason = result.reason;
  return reason?.response?.data?.detail
    || reason?.response?.data?.message
    || reason?.message
    || 'Request failed';
};

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
  const rawTitle = item.title || prettySignal(item.signal || item.event || item.type || item.domain || 'Signal detected');
  const rawDetail = item.detail || item.description || item.impact || item.executive_summary || '';
  const rawAction = item.action || item.recommendation || item.suggested_action || '';

  const title = isPlaceholderText(rawTitle) ? 'Signal requires owner review' : rawTitle;
  const detail = isPlaceholderText(rawDetail)
    ? 'BIQc detected a priority signal, but source detail is low fidelity. Open full context and verify source records.'
    : rawDetail;
  const action = isPlaceholderText(rawAction)
    ? 'Assign an owner and execute this cycle.'
    : rawAction;
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
    occurrences: Number(item.repeat_count || 1),
    actionIds: [actionId],
    dedupeKey: `${signalType}|${domain}|${source}`,
    evidenceRefs: item.evidence_refs || item.evidence || [],
    issueBrief: item.issue_brief || title,
    whyNowBrief: item.why_now_brief || detail,
    actionBrief: item.action_brief || action,
    confidenceNote: item.confidence_note || '',
    factPoints: item.fact_points || [],
    sourceSummary: item.source_summary || '',
    outlook: item.outlook_30_60_90 || null,
    repeatCount: Number(item.repeat_count || 1),
    lastSeen: item.last_seen || item.created_at || item.observed_at || item.timestamp || null,
    escalationState: item.escalation_state || '',
    summaryLabel: item.decision_label || item.summary_label || '',
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
  const candidateSignals = signals.filter((signal) => signal?.conflictEligible !== false).slice(0, 12);

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

const buildSignalsFromBrainConcerns = (brainPayload) => {
  const concerns = brainPayload?.concerns || [];
  if (!Array.isArray(concerns) || concerns.length === 0) return [];

  const toSeverity = (priorityScore = 0, impact = 0, urgency = 0) => {
    const blended = Number(priorityScore || 0) + Number(impact || 0) + Number(urgency || 0);
    if (blended >= 26) return 'critical';
    if (blended >= 20) return 'high';
    if (blended >= 12) return 'medium';
    return 'low';
  };

  const domainForConcern = (concernId = '') => {
    const id = String(concernId).toLowerCase();
    if (id.includes('cash') || id.includes('margin') || id.includes('revenue')) return 'finance';
    if (id.includes('pipeline') || id.includes('response')) return 'sales';
    if (id.includes('operations')) return 'operations';
    return 'general';
  };

  return dedupeSignals(
    concerns
      .filter((concern) => concern?.truth_state !== 'blocked')
      .map((concern, index) => ({ concern, index }))
      .map(({ concern, index }) => {
        const signal = toSignal({
      id: `brain-${concern.concern_id || index}`,
      signal: concern.concern_id || `brain_concern_${index + 1}`,
      domain: domainForConcern(concern.concern_id),
      severity: toSeverity(concern.priority_score, concern.impact, concern.urgency),
      title: concern.issue_brief || concern.explanation || concern.concern_id || `Priority concern ${index + 1}`,
      detail: concern.why_now_brief || concern.confidence_note || `Impact ${concern.impact ?? 0} · Urgency ${concern.urgency ?? 0} · Confidence ${Math.round(Number(concern.confidence || 0) * 100)}%.`,
      recommendation: concern.action_brief || concern.recommendation || 'Review concern and assign owner action now.',
      if_ignored: concern.if_ignored_brief || concern.explanation || 'Priority concern remains unresolved and may compound over time.',
      source: 'BIQc Business Brain',
      created_at: concern?.time_window?.evaluated_at || null,
      evidence_refs: concern.evidence || [],
      issue_brief: concern.issue_brief,
      why_now_brief: concern.why_now_brief,
      action_brief: concern.action_brief,
      confidence_note: concern.confidence_note,
      fact_points: concern.fact_points,
      source_summary: concern.source_summary,
      outlook_30_60_90: concern.outlook_30_60_90,
      repeat_count: concern.repeat_count,
      last_seen: concern.last_seen,
      escalation_state: concern.escalation_state,
      decision_label: concern.decision_label,
    }, 'business_brain');

        return {
          ...signal,
          truthState: concern.truth_state || 'verified',
          signalAvailability: concern.signal_availability,
          conflictEligible: concern.conflict_eligible !== false && concern.truth_state === 'verified',
          sourceTruth: concern.source_truth || [],
        };
      }),
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

  if (signal.summaryLabel && !isPlaceholderText(signal.summaryLabel)) {
    return signal.summaryLabel;
  }

  if (!isPlaceholderText(signal.title)) {
    return signal.title;
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
      whyNow: signal.whyNowBrief || (signal.occurrences > 1
        ? `${signal.occurrences} matching signals were grouped into one decision.`
        : signal.detail),
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

const getExecutiveStateLabel = ({ executiveSnapshot, decisions, fallbackState }) => {
  const maxRisk = Math.max(...decisions.map((decision) => decision.riskScore || 0), 0);
  const overdue = Number(executiveSnapshot?.overdueCount || 0);
  const stalled = Number(executiveSnapshot?.stalledDeals || 0);
  const priorityThreads = Number(executiveSnapshot?.highPriorityEmails || 0);

  if (maxRisk >= 85 || overdue >= 10 || stalled >= 20) return 'Under Pressure';
  if (maxRisk >= 70 || overdue > 0 || stalled > 0 || priorityThreads > 0) return 'Monitoring';
  return fallbackState;
};

export default function AdvisorWatchtower() {
  const { user, authState } = useSupabaseAuth();
  const location = useLocation();
  const navigate = useNavigate();
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
    sourceHealth: {
      crm: { provider: 'CRM', connected: false, live: false, status: 'pending', endpoint: '/integrations/crm/deals', error: '' },
      accounting: { provider: 'Xero', connected: false, live: false, status: 'pending', endpoint: '/integrations/accounting/summary', error: '' },
      email: { provider: 'Outlook', connected: false, live: false, status: 'pending', endpoint: '/email/priority-inbox', error: '' },
      brain: { provider: 'BIQc Business Brain', connected: true, live: false, status: 'pending', endpoint: '/brain/priorities', error: '' },
    },
  });
  const [brainContext, setBrainContext] = useState({
    businessCoreReady: false,
    mode: 'unknown',
    tierMode: 'free',
    allClear: false,
    concerns: [],
    integrityAlerts: [],
    truthSummary: null,
    generatedAt: null,
    error: '',
  });
  const [integrationContextLoading, setIntegrationContextLoading] = useState(false);
  const [integrationContextError, setIntegrationContextError] = useState('');
  const integrationFetchInFlightRef = useRef(false);
  const initialDataLoadTriggeredRef = useRef(false);
  const [brainRetryCount, setBrainRetryCount] = useState(0);
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
  const [pendingMenuAction, setPendingMenuAction] = useState(null);
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [showAdvancedSections, setShowAdvancedSections] = useState(false);

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

  const fetchIntegrationContext = useCallback(async (recomputeBrain = false) => {
    if (integrationFetchInFlightRef.current) return;
    integrationFetchInFlightRef.current = true;

    setIntegrationContextLoading(true);
    setIntegrationContextError('');
    setIntegrationContext((prev) => ({
      ...prev,
      sourceHealth: {
        ...prev.sourceHealth,
        brain: {
          ...prev.sourceHealth.brain,
          status: 'pending',
          live: false,
          error: '',
        },
      },
    }));
    setBrainContext((prev) => ({
      ...prev,
      error: '',
    }));

    try {
      const requestsPromise = Promise.allSettled([
        apiClient.get('/integrations/merge/connected', { timeout: 12000 }),
        apiClient.get('/integrations/crm/deals', { params: { page_size: 50 }, timeout: 15000 }),
        apiClient.get('/integrations/accounting/summary', { timeout: 15000 }),
        apiClient.get('/outlook/status', { timeout: 10000 }),
        apiClient.get('/email/priority-inbox', { timeout: 12000 }),
        apiClient.get('/calibration/status', { timeout: 10000 }),
      ]);

      let brainRes;
      try {
        const brainValue = await apiClient.get('/brain/priorities', { params: { recompute: recomputeBrain }, timeout: 45000 });
        brainRes = { status: 'fulfilled', value: brainValue };
      } catch (brainErr) {
        brainRes = { status: 'rejected', reason: brainErr };
      }

      const executiveSurface = null;
      const brainPayload = brainRes.status === 'fulfilled' ? (brainRes.value?.data || null) : null;
      const brainRequestFailed = brainRes.status === 'rejected' || !brainPayload;
      const brainRequestError = settledErrorMessage(brainRes) || (brainRequestFailed ? 'Business Brain request did not return data.' : '');

      setBrainContext({
        businessCoreReady: Boolean(brainPayload?.business_core_ready),
        mode: brainPayload?.mode || 'unknown',
        tierMode: brainPayload?.tier_mode || 'free',
        allClear: Boolean(brainPayload?.all_clear),
        concerns: brainPayload?.concerns || [],
        integrityAlerts: brainPayload?.integrity_alerts || [],
        truthSummary: brainPayload?.truth_summary || null,
        generatedAt: brainPayload?.generated_at || null,
        error: brainRequestError,
      });
      setIntegrationContext((prev) => ({
        ...prev,
        sourceHealth: {
          ...prev.sourceHealth,
          brain: {
            provider: 'BIQc Business Brain',
            connected: true,
            live: Boolean(brainPayload) && !brainRequestFailed && (!brainRequestError || (brainPayload?.concerns || []).length > 0 || (brainPayload?.integrity_alerts || []).length > 0 || Boolean(brainPayload?.all_clear)),
            status: brainRequestFailed ? 'unavailable' : 'live',
            endpoint: '/brain/priorities',
            error: brainRequestError || '',
          },
        },
      }));

      if (!brainRequestError && brainPayload) {
        setBrainRetryCount(0);
      }

      const requests = await requestsPromise;
      const [mergeRes, crmRes, accountingRes, outlookRes, priorityRes, calibrationRes] = requests;

      const mergeConnected = mergeRes.status === 'fulfilled' ? (mergeRes.value?.data?.integrations || {}) : {};
      const crmDeals = crmRes.status === 'fulfilled' ? (crmRes.value?.data?.results || []) : [];
      const accountingSummary = accountingRes.status === 'fulfilled' ? (accountingRes.value?.data || null) : null;
      const outlookStatus = outlookRes.status === 'fulfilled' ? (outlookRes.value?.data || null) : null;
      let priorityInbox = priorityRes.status === 'fulfilled' ? (priorityRes.value?.data || null) : null;
      const calibrationStatus = calibrationRes.status === 'fulfilled' ? (calibrationRes.value?.data || null) : null;

      const getProviderByCategory = (category, fallback) => {
        const found = Object.values(mergeConnected).find((entry) => String(entry?.category || '').toLowerCase() === category && entry?.provider);
        return found?.provider || fallback;
      };

      const mergeEmailConnected = Object.values(mergeConnected).some((entry) => String(entry?.category || '').toLowerCase() === 'email' && Boolean(entry?.connected));

      // If Outlook is connected but no priority analysis exists, trigger first-pass analysis and retry inbox fetch.
      const needsPriorityAnalysis = Boolean(
        (outlookStatus?.connected || mergeEmailConnected)
        && priorityInbox?.message
        && String(priorityInbox.message).toLowerCase().includes('no priority analysis available')
      );

      if (needsPriorityAnalysis) {
        try {
          const analyzeRes = await apiClient.post('/email/analyze-priority', {}, { timeout: 25000 });
          const refreshedPriority = await apiClient.get('/email/priority-inbox', { timeout: 12000 });
          const analyzedPayload = analyzeRes?.data || {};
          const refreshedPayload = refreshedPriority?.data || {};
          if (refreshedPayload?.analysis || refreshedPayload?.high_priority) {
            priorityInbox = refreshedPayload;
          } else if (analyzedPayload?.high_priority || analyzedPayload?.medium_priority || analyzedPayload?.low_priority) {
            priorityInbox = {
              analysis: analyzedPayload,
              strategic_insights: analyzedPayload?.strategic_insights || '',
              source: 'live-analyze-priority',
            };
          } else {
            priorityInbox = refreshedPayload || priorityInbox;
          }
        } catch {
          // Non-blocking: source health below captures this as unavailable.
        }
      }

      const crmError = settledErrorMessage(crmRes);
      const accountingError = accountingSummary?.error || settledErrorMessage(accountingRes);
      const outlookError = settledErrorMessage(outlookRes)
        || (outlookStatus?.token_expired ? 'Outlook token expired' : '')
        || (outlookStatus?.connected === false && mergeEmailConnected ? 'Outlook disconnected at provider level' : '');
      const priorityError = settledErrorMessage(priorityRes)
        || priorityInbox?.error
        || ((priorityInbox?.message && String(priorityInbox.message).toLowerCase().includes('no priority analysis available'))
          ? 'Priority inbox analysis not generated yet'
          : '');
      const brainError = brainRequestError
        || (brainPayload
          && Array.isArray(brainPayload.concerns)
          && brainPayload.concerns.length === 0
          && !(brainPayload?.integrity_alerts || []).length
          && !brainPayload?.all_clear
          ? 'No brain concerns generated from current data window'
          : '');

      const crmConnected = Object.values(mergeConnected).some((entry) => String(entry?.category || '').toLowerCase() === 'crm' && Boolean(entry?.connected));
      const accountingConnected = Object.values(mergeConnected).some((entry) => String(entry?.category || '').toLowerCase() === 'accounting' && Boolean(entry?.connected));
      const emailConnected = Boolean(outlookStatus?.connected) || mergeEmailConnected;

      const sourceHealth = {
        crm: {
          provider: getProviderByCategory('crm', 'CRM'),
          connected: crmConnected,
          live: crmConnected && !crmError,
          status: !crmConnected ? 'pending' : (crmError ? 'unavailable' : 'live'),
          endpoint: '/integrations/crm/deals',
          error: crmError || '',
        },
        accounting: {
          provider: getProviderByCategory('accounting', 'Xero'),
          connected: accountingConnected,
          live: accountingConnected && !accountingError,
          status: !accountingConnected ? 'pending' : (accountingError ? 'unavailable' : 'live'),
          endpoint: '/integrations/accounting/summary',
          error: accountingError || '',
        },
        email: {
          provider: getProviderByCategory('email', 'Outlook'),
          connected: emailConnected,
          live: emailConnected && !outlookError && !priorityError,
          status: !emailConnected ? 'pending' : ((outlookError || priorityError) ? 'unavailable' : 'live'),
          endpoint: '/email/priority-inbox',
          error: outlookError || priorityError || '',
        },
        brain: {
          provider: 'BIQc Business Brain',
          connected: true,
          live: Boolean(brainPayload) && !brainRequestFailed && !brainError,
          status: brainRequestFailed || brainError ? 'unavailable' : 'live',
          endpoint: '/brain/priorities',
          error: brainError || '',
        },
      };

      setIntegrationContext({
        mergeConnected,
        crmDeals,
        accountingSummary,
        priorityInbox,
        outlookStatus,
        calibrationStatus,
        executiveSurface,
        sourceHealth,
      });
    } catch (error) {
      const message = error?.response?.data?.detail || 'Unable to load integration context.';
      setIntegrationContextError(message);
      setBrainContext((prev) => ({
        ...prev,
        error: prev.error || message,
      }));
    } finally {
      setIntegrationContextLoading(false);
      integrationFetchInFlightRef.current = false;
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
    if (authState === AUTH_STATE.LOADING || initialDataLoadTriggeredRef.current) return;
    initialDataLoadTriggeredRef.current = true;
    fetchOverview(false);
    fetchWatchtower();
    fetchIntegrationContext(false);
    hydrateActionHistory();
  }, [authState, fetchOverview, fetchWatchtower, fetchIntegrationContext, hydrateActionHistory]);

  useEffect(() => {
    if (!location.state?.focusBrief) return;
    const timer = setTimeout(() => {
      const target = document.querySelector('[data-testid="advisor-executive-memo-section"]')
        || document.querySelector('[data-testid="advisor-decision-surface"]');
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      navigate(location.pathname, { replace: true, state: {} });
    }, 800);
    return () => clearTimeout(timer);
  }, [location, navigate]);

  const handleRefresh = async () => {
    await Promise.allSettled([
      refreshSnapshot(),
      fetchOverview(true),
      fetchWatchtower(),
      fetchIntegrationContext(true),
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
    fetchIntegrationContext(false);
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

  const greetingDateTime = useMemo(() => {
    return new Date().toLocaleString([], {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const signals = useMemo(() => {
    const brainSignals = buildSignalsFromBrainConcerns(brainContext);
    if (brainSignals.length > 0) return brainSignals;
    const executiveSignals = integrationContext.executiveSurface ? buildSignalsFromExecutiveSurface(integrationContext.executiveSurface) : [];
    if (executiveSignals.length > 0) return executiveSignals;
    const integrationSignals = buildIntegrationSignals(integrationContext);
    if (integrationSignals.length > 0) return integrationSignals;
    return buildSignals(overview, cognitive, watchtowerEvents);
  }, [brainContext, integrationContext, overview, cognitive, watchtowerEvents]);

  const integrityAlerts = useMemo(() => brainContext.integrityAlerts || [], [brainContext.integrityAlerts]);
  const truthGateAlerts = useMemo(() => {
    if (integrityAlerts.length > 0) return integrityAlerts;

    return Object.values(integrationContext.sourceHealth || {})
      .filter((entry) => entry?.status === 'unavailable' && entry?.provider && entry?.provider !== 'BIQc Business Brain')
      .map((entry) => ({
        id: `source-health-${String(entry.provider).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title: `${entry.provider} truth is currently unavailable`,
        detail: entry.error || `${entry.provider} could not be verified from the live connector.`,
        action: 'Reconnect or refresh this integration before treating its signals as current truth.',
        truth_state: 'blocked',
        last_verified_at: null,
      }));
  }, [integrityAlerts, integrationContext.sourceHealth]);

  const isSignalActioned = useCallback((signal) => {
    if (actionState.byKey?.[signal.dedupeKey]) return true;
    return (signal.actionIds || []).some((alertId) => Boolean(actionState.byAlertId?.[alertId]));
  }, [actionState]);

  const openSignals = useMemo(
    () => {
      const actionableSignals = signals.filter((signal) => !isSignalActioned(signal));
      return actionableSignals.length > 0 ? actionableSignals : signals;
    },
    [signals, isSignalActioned],
  );

  const visibleSignals = useMemo(() => {
    if (openSignals.length > 0) return openSignals;
    return signals;
  }, [openSignals, signals]);

  const prioritizedSignals = useMemo(() => {
    return [...visibleSignals].sort((left, right) => {
      return signalPriorityScore(right, rolePreference) - signalPriorityScore(left, rolePreference);
    });
  }, [visibleSignals, rolePreference]);

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

  const handleCardMenuAction = useCallback((decision, actionType) => {
    if (!decision?.signal) return;

    if (actionType === 'assign-owner') {
      navigate('/actions', {
        state: {
          advisorAssignment: {
            title: decision.signal.issueBrief || decision.signal.title,
            summary: decision.signal.actionBrief || decision.signal.action,
            whyNow: decision.signal.whyNowBrief || decision.whyNow,
            ifIgnored: decision.signal.ifIgnored,
            domain: decision.signal.domain,
            severity: decision.signal.severity,
            alertId: (decision.signal.actionIds && decision.signal.actionIds[0]) || decision.signal.id,
            createCalendarEvent: true,
          },
        },
      });
      return;
    }

    if (actionType === 'add-to-calendar') {
      const now = new Date();
      const followUpStart = new Date(now.getTime() + (24 * 60 * 60 * 1000));
      followUpStart.setHours(9, 0, 0, 0);
      const followUpEnd = new Date(followUpStart.getTime() + (30 * 60 * 1000));
      const draft = {
        title: decision.signal.issueBrief || decision.signal.title,
        summary: decision.signal.actionBrief || decision.signal.action,
        whyNow: decision.signal.whyNowBrief || decision.whyNow,
        ifIgnored: decision.signal.ifIgnored,
        startAt: followUpStart.toISOString(),
        endAt: followUpEnd.toISOString(),
        sourceSummary: decision.signal.sourceSummary || '',
      };
      try {
        sessionStorage.setItem('biqc_calendar_draft', JSON.stringify(draft));
      } catch {}
      navigate('/calendar', {
        state: {
          advisorFollowUp: draft,
        },
      });
      return;
    }

    setPendingMenuAction({ decision, actionType });
  }, [navigate]);

  const confirmPendingMenuAction = useCallback(async () => {
    if (!pendingMenuAction) return;
    await handleDecisionAction(pendingMenuAction.decision, pendingMenuAction.actionType);
    setPendingMenuAction(null);
  }, [pendingMenuAction, handleDecisionAction]);

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
    const sourceHealth = integrationContext.sourceHealth || {};

    Object.values(sourceHealth).forEach((entry) => {
      if (entry?.live && entry?.provider) list.push(entry.provider);
    });

    const mergeMap = integrationContext.mergeConnected || integrationContext.executiveSurface?.connected_tools || {};

    if (!list.length) {
      Object.values(mergeMap).forEach((entry) => {
        if (entry?.connected && entry?.provider) list.push(entry.provider);
      });

      if (integrationContext.outlookStatus?.connected) list.push('Outlook');
    }

    if (!list.length) {
      if (integrationTruth.crm) list.push('CRM');
      if (integrationTruth.accounting) list.push('Accounting');
      if (integrationTruth.email) list.push('Email');
    }

    const normalize = (value) => String(value || '').trim().toLowerCase();
    const uniqueByNormalized = new Map();
    list.forEach((item) => {
      const key = normalize(item);
      if (!key || uniqueByNormalized.has(key)) return;
      uniqueByNormalized.set(key, item);
    });
    return [...uniqueByNormalized.values()];
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
  const brainHasRenderableContext = Boolean(
    (brainContext.concerns || []).length
    || (brainContext.integrityAlerts || []).length
    || liveSignalCount
    || (watchtowerEvents || []).length
    || (overview?.top_alerts || []).length
  );
  const brainLive = Boolean(integrationContext.sourceHealth?.brain?.live || (brainContext.concerns || []).length || (brainContext.integrityAlerts || []).length || brainContext.allClear);
  const brainSourceUnavailable = integrationContext.sourceHealth?.brain?.status === 'unavailable';
  const brainLoading = authState === AUTH_STATE.LOADING
    || (!brainHasRenderableContext && (integrationContextLoading || integrationContext.sourceHealth?.brain?.status === 'pending') && !loadingGuardExpired);
  const brainUnavailable = !brainLoading && (
    Boolean(brainContext.error)
    || brainSourceUnavailable
    || (!brainLive && !brainContext.allClear && !brainHasRenderableContext)
  );
  const fallbackState = getStateLabel(overview, cognitive);
  const executiveState = getExecutiveStateLabel({
    executiveSnapshot,
    decisions,
    fallbackState,
  });

  const openSoundboardWithBrief = useCallback((payload) => {
    try {
      sessionStorage.setItem('biqc_soundboard_handoff', JSON.stringify(payload));
    } catch {}
    navigate('/soundboard', { state: { advisorSoundboardContext: payload } });
  }, [navigate]);

  const soundboardDiscussHref = useCallback((topic) => {
    const prompt = topic ? `Discuss this with context: ${topic}` : 'Discuss advisor context and next best owner action.';
    return `/soundboard?origin=advisor&prompt=${encodeURIComponent(prompt)}`;
  }, []);

  const buildSoundboardHandoff = useCallback((decision, overrides = {}) => {
    const signal = decision?.signal || {};
    return {
      title: overrides.title || signal.summaryLabel || signal.title || decision?.headline || 'BIQc priority',
      issueBrief: overrides.issueBrief || signal.issueBrief || signal.title || decision?.headline || 'BIQc priority requires discussion.',
      whyNowBrief: overrides.whyNowBrief || signal.whyNowBrief || decision?.whyNow || signal.detail || 'This issue needs operator attention now.',
      actionBrief: overrides.actionBrief || signal.actionBrief || signal.action || 'Recommend immediate owner action.',
      ifIgnoredBrief: overrides.ifIgnoredBrief || signal.ifIgnored || 'The issue is likely to compound if ignored.',
      domain: overrides.domain || signal.domain || 'general',
      severity: overrides.severity || signal.severity || 'medium',
      sourceSummary: overrides.sourceSummary || signal.sourceSummary || `Source: ${signal.source || 'BIQc Business Brain'}`,
      factPoints: overrides.factPoints || signal.factPoints || [],
      integrations: {
        crm: Boolean(integrationContext.sourceHealth?.crm?.live),
        accounting: Boolean(integrationContext.sourceHealth?.accounting?.live),
        email: Boolean(integrationContext.sourceHealth?.email?.live),
        brain: Boolean(integrationContext.sourceHealth?.brain?.live),
      },
      thresholds: {
        timeConsistency: Boolean(signal.repeatCount && signal.repeatCount > 1),
        crossSourceReinforcement: Boolean(signal.sourceSummary),
        behaviouralReinforcement: Boolean(signal.escalationState && signal.escalationState !== 'monitoring'),
      },
    };
  }, [integrationContext.sourceHealth]);

  useEffect(() => {
    if (authState === AUTH_STATE.LOADING) return undefined;

    const interval = setInterval(() => {
      Promise.allSettled([
        fetchOverview(true),
        fetchWatchtower(),
        fetchIntegrationContext(true),
      ]);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [authState, fetchOverview, fetchWatchtower, fetchIntegrationContext]);

  useEffect(() => {
    if (integrationContextLoading) return undefined;
    if (!brainUnavailable) return undefined;
    if (brainRetryCount >= 3) return undefined;

    const delayMs = 2500 * (brainRetryCount + 1);
    const timer = setTimeout(() => {
      setBrainRetryCount((prev) => prev + 1);
      fetchIntegrationContext(false);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [integrationContextLoading, brainUnavailable, brainRetryCount, fetchIntegrationContext]);

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
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3" data-testid="advisor-page-header">
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} data-testid="advisor-header-kicker">
                Today · Executive Cognition
              </p>
              <div className="flex flex-wrap items-end gap-3" data-testid="advisor-header-title-row">
                <h1 className="text-xl sm:text-2xl lg:text-[2rem]" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-header-title">
                  Good {displayTimeOfDay}, {displayName}.
                </h1>
                <p
                  className="pb-1 text-[10px]"
                  style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}
                  data-testid="advisor-header-datetime"
                >
                  {greetingDateTime}
                </p>
              </div>
              <p className="text-xs sm:text-sm" style={{ color: 'var(--biqc-text-2)' }} data-testid="advisor-header-subtitle">
                {brainLoading
                  ? 'Business Brain is syncing live sources. Priority decisions will appear when this cycle completes.'
                  : !brainLive
                    ? 'Business Brain is currently unavailable. Priority decisions are paused until data feed recovers.'
                  : (brainContext.allClear
                      ? 'Business Brain is live. No high-priority concerns are currently triggered.'
                      : `Three decisions from BIQc Business Brain with ${connectedSources.join(', ')} evidence.`)}
              </p>
            </div>

            <button
              onClick={handleRefresh}
              disabled={snapshotRefreshing || overviewRefreshing}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-colors hover:bg-white/5"
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

            <div className="flex flex-wrap items-center justify-end gap-2">
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
              Live cognition feed is delayed right now. BIQc Business Brain decisions are temporarily unavailable.
            </div>
          )}

          {!criticalError && integrationContextError && (
            <div
              className="mb-8 rounded-2xl border px-4 py-3 text-sm"
              style={{ borderColor: '#334155', background: '#111827', color: '#CBD5E1' }}
              data-testid="advisor-integration-context-warning"
            >
              Supporting source checks are partially degraded right now, but BIQc Business Brain decisions will still render from the latest available intelligence.
            </div>
          )}

          {migrationRequired && (
            <div
              className="mb-8 rounded-2xl border px-4 py-3 text-sm"
              style={{ borderColor: '#F59E0B60', background: '#F59E0B15', color: '#FDE68A' }}
              data-testid="advisor-migration-warning"
            >
              Cognition migration is required for full contract output. Business Brain remains the only priority decision source.
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
              <section id="advisor-priority-detail-section" className="mb-10" data-testid="advisor-decision-surface">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-base md:text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-decision-title">
                    BIQc Priority Snapshot
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

                <div className="space-y-4" data-testid="advisor-priority-layout-grid">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="advisor-priority-status-row">
                    <article className="rounded-2xl border p-5 flex flex-col justify-between min-h-[108px]" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="advisor-state-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} data-testid="advisor-state-label">Business State</p>
                          <p className="mt-2 text-xl" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-state-value">{executiveState}</p>
                        </div>
                        <button
                          onClick={() => openSoundboardWithBrief({
                            title: `Business state: ${executiveState}`,
                            issueBrief: `Current business state is ${executiveState}.`,
                            whyNowBrief: `The advisor is classifying the current operating state as ${executiveState.toLowerCase()}.`,
                            actionBrief: 'Explain the immediate owner priorities for this state and sequence the next move.',
                            ifIgnoredBrief: 'The team may act without a clear state-based priority order.',
                            domain: 'general',
                            severity: executiveState === 'Under Pressure' ? 'high' : 'medium',
                            sourceSummary: 'Source: BIQc Advisor state classification.',
                            factPoints: [],
                          })}
                          className="inline-flex h-[32px] items-center gap-1 rounded-lg border px-2.5 text-[10px] hover:bg-white/5"
                          style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                          data-testid="advisor-state-discuss-soundboard"
                        >
                          Discuss <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </article>

                    <article className="rounded-2xl border p-5 flex flex-col justify-between min-h-[108px]" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="advisor-queue-status-section">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} data-testid="advisor-queue-status-label">Decision Queue Status</p>
                          <p className="mt-2 text-sm" style={{ color: 'var(--biqc-text-2)' }} data-testid="advisor-queue-status-value">{openSignals.length} open signal{openSignals.length === 1 ? '' : 's'} · showing top 3 executive decisions now.</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-queue-backlog-count">{queuedBeyondThree}</p>
                          <p className="text-xs text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }} data-testid="advisor-queue-backlog-label">Queued after top 3</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <button
                          onClick={() => openSoundboardWithBrief({
                            title: 'Decision queue status',
                            issueBrief: `${openSignals.length} open executive signals are active, with ${queuedBeyondThree} queued behind the current top 3.`,
                            whyNowBrief: 'The queue order determines which BIQc priorities get operator attention first.',
                            actionBrief: 'Review whether the current top queue order is right and decide if any card should be actioned, delegated, or ignored.',
                            ifIgnoredBrief: 'Important priorities may sit in queue too long and lose their decision window.',
                            domain: 'general',
                            severity: openSignals.length > 2 ? 'high' : 'medium',
                            sourceSummary: 'Source: BIQc Advisor queue state.',
                            factPoints: [`${openSignals.length} open signals`, `${queuedBeyondThree} queued after top 3`],
                          })}
                          className="inline-flex h-[32px] items-center gap-1 rounded-lg border px-2.5 text-[10px] hover:bg-white/5"
                          style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                          data-testid="advisor-queue-discuss-soundboard"
                        >
                          Discuss queue <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </article>
                  </div>

                  <div data-testid="advisor-priority-main-rail">
                    {brainUnavailable ? (
                      <div className="rounded-2xl border p-5" style={{ borderColor: '#EF444460', background: '#450A0A' }} data-testid="advisor-brain-unavailable-state">
                        <h3 className="text-lg" style={{ color: '#FCA5A5', fontFamily: fontFamily.display }} data-testid="advisor-brain-unavailable-title">
                          BIQc Business Brain data is currently unavailable.
                        </h3>
                        <p className="mt-2 text-sm" style={{ color: '#FECACA' }} data-testid="advisor-brain-unavailable-summary">
                          {brainContext.error || 'Brain priorities did not load from /brain/priorities in this cycle.'}
                        </p>
                        <p className="mt-2 text-sm" style={{ color: '#FECACA' }} data-testid="advisor-brain-unavailable-next-step">
                          This state is not treated as all-clear. Use Refresh intelligence and verify integrations health before making decisions.
                        </p>
                        <Link
                          to={soundboardDiscussHref(`Business Brain unavailable: ${brainContext.error || 'No concerns returned'}. Diagnose root cause and next actions.`)}
                          className="mt-4 inline-flex min-h-[40px] items-center gap-1 rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
                          style={{ borderColor: '#FCA5A5', color: '#FECACA', fontFamily: fontFamily.mono }}
                          data-testid="advisor-brain-unavailable-discuss-soundboard"
                        >
                          Discuss with BIQc SoundBoard <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ) : brainLoading ? (
                      <div className="rounded-2xl border p-5" style={{ borderColor: '#334155', background: '#0F172A' }} data-testid="advisor-brain-loading-state">
                        <h3 className="text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-brain-loading-title">
                          BIQc Business Brain is syncing live signals.
                        </h3>
                        <p className="mt-2 text-sm" style={{ color: 'var(--biqc-text-2)' }} data-testid="advisor-brain-loading-summary">
                          Connected feeds are active. Priority decisions will render as soon as this analysis cycle finishes.
                        </p>
                        <p className="mt-2 text-sm" style={{ color: 'var(--biqc-text-2)' }} data-testid="advisor-brain-loading-next-step">
                          Use Refresh intelligence if this state persists longer than a few minutes.
                        </p>
                        <Link
                          to={soundboardDiscussHref('Business Brain is syncing live signals. Explain what sources are still pending and what I should monitor while it completes.')}
                          className="mt-4 inline-flex min-h-[40px] items-center gap-1 rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
                          style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                          data-testid="advisor-brain-loading-discuss-soundboard"
                        >
                          Discuss with BIQc SoundBoard <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ) : noActiveDecisions ? (
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
                        <Link
                          to={soundboardDiscussHref('No high-priority signal detected. What proactive actions should I take this week?')}
                          className="mt-4 inline-flex min-h-[40px] items-center gap-1 rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
                          style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                          data-testid="advisor-all-clear-discuss-soundboard"
                        >
                          Discuss with BIQc SoundBoard <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ) : (
                      <div
                        className="grid grid-cols-1 gap-4 md:grid-cols-3"
                        data-testid="advisor-decision-grid"
                      >
                        {decisions.map((decision, index) => {
                          const Icon = decision.icon;
                          const style = SEVERITY_STYLE[decision.severity] || SEVERITY_STYLE.medium;
                          const signal = decision.signal;
                          const actionRecord = signal ? actionState.byKey?.[signal.dedupeKey] : null;
                          const projections = signal ? (signal.outlook || buildProjections(signal)) : null;

                          return (
                            <article
                              key={decision.id}
                              className="min-w-0 rounded-2xl border p-5 flex flex-col h-full"
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

                              <div className="flex-1">
                                <p className="mb-1 text-sm" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }} data-testid={`advisor-decision-intent-${decision.id}`}>{decision.intent}</p>
                                <p className="mb-1 text-sm" style={{ color: style.text }} data-testid={`advisor-decision-headline-${decision.id}`}>{decision.headline}</p>
                                {signal && (
                                  <p className="mb-2 text-[10px] uppercase tracking-[0.12em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }} data-testid={`advisor-decision-confidence-${decision.id}`}>
                                    {signal.confidenceNote || `Confidence interval: ${decision.confidenceInterval}`}
                                  </p>
                                )}
                                <h3 className="mb-3 text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid={`advisor-decision-title-${decision.id}`}>
                                  {signal ? (signal.issueBrief || signal.title) : `No verified ${decision.title.toLowerCase()} signal`}
                                </h3>

                                {signal ? (
                                  <SourceProvenanceBadge source={signal.source} signalType={signal.signalType} timestamp={signal.createdAt} testId={`advisor-provenance-${decision.id}`} />
                                ) : (
                                  <p className="text-xs" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }} data-testid={`advisor-provenance-${decision.id}`}>
                                    Waiting for verified events from connected tools.
                                  </p>
                                )}

                                <button
                                  onClick={() => signal ? setEvidenceDrawerDecision(decision) : null}
                                  className="mt-4 inline-flex min-h-[36px] items-center gap-1 rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
                                  style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                                  data-testid={`advisor-decision-evidence-toggle-${decision.id}`}
                                  disabled={!signal}
                                >
                                  {signal ? 'View full context' : 'No context yet'}
                                </button>

                                {signal?.sourceSummary || signal?.factPoints?.length ? (
                                  <div className="mt-4 rounded-xl border p-3 text-sm" style={{ borderColor: '#334155', background: '#0F172A', color: '#CBD5E1' }} data-testid={`advisor-decision-signal-block-${decision.id}`}>
                                    <div className="mb-2 flex items-center gap-2">
                                      <strong style={{ color: 'var(--biqc-text)' }}>Signal</strong>
                                      <InlineInfo description="What BIQc directly observed in connected systems or supporting evidence." testId={`advisor-decision-signal-info-${decision.id}`} />
                                    </div>
                                    {signal.sourceSummary ? <p className="text-sm">{signal.sourceSummary}</p> : null}
                                    {signal.factPoints?.length ? (
                                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[#CBD5E1]" data-testid={`advisor-decision-fact-points-${decision.id}`}>
                                        {signal.factPoints.map((point, pointIndex) => (
                                          <li key={`${decision.id}-fact-${pointIndex}`}>{point}</li>
                                        ))}
                                      </ul>
                                    ) : null}
                                  </div>
                                ) : null}

                                <div className="mt-4 space-y-3 text-sm" style={{ color: 'var(--biqc-text-2)' }}>
                                  <p data-testid={`advisor-decision-why-${decision.id}`}><strong style={{ color: 'var(--biqc-text)' }}>Why now:</strong> {decision.whyNow}</p>
                                  <p data-testid={`advisor-decision-action-${decision.id}`}><strong style={{ color: 'var(--biqc-text)' }}>Action now:</strong> {signal ? (signal.actionBrief || signal.action) : 'Trigger sync or wait for next watchtower signal.'}</p>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2" data-testid={`advisor-decision-primary-controls-${decision.id}`}>
                                  <button
                                    onClick={() => signal ? openSoundboardWithBrief(buildSoundboardHandoff(decision)) : null}
                                    className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
                                    style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                                    data-testid={`advisor-decision-open-soundboard-${decision.id}`}
                                    disabled={!signal}
                                  >
                                    SoundBoard chat <ArrowRight className="h-3.5 w-3.5" />
                                  </button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
                                        style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                                        data-testid={`advisor-decision-more-actions-${decision.id}`}
                                        disabled={!signal}
                                      >
                                        More actions <ArrowRight className="h-3.5 w-3.5" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-56" data-testid={`advisor-decision-more-actions-menu-${decision.id}`}>
                                      <DropdownMenuItem onClick={() => handleCardMenuAction(decision, 'add-to-calendar')} data-testid={`advisor-decision-add-calendar-${decision.id}`}>
                                        <CalendarPlus className="h-4 w-4" /> Add to calendar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleCardMenuAction(decision, 'assign-owner')} data-testid={`advisor-decision-assign-owner-${decision.id}`}>
                                        <UserRoundPlus className="h-4 w-4" /> Assign owner
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleCardMenuAction(decision, 'resolve')} data-testid={`advisor-decision-mark-actioned-${decision.id}`}>
                                        <CheckCircle2 className="h-4 w-4" /> Mark as actioned
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>

                                {signal && projections && (
                                  <div className="mt-3 rounded-xl border p-3 text-xs" style={{ borderColor: '#334155', background: '#0F172A', color: '#CBD5E1' }} data-testid={`advisor-decision-projection-${decision.id}`}>
                                    <div className="mb-2 flex items-center gap-2">
                                      <strong data-testid={`advisor-decision-projection-title-${decision.id}`}>30/60/90 outlook</strong>
                                      <InlineInfo description={projections.meaning || 'Projected risk over 30, 60, and 90 days if this is ignored versus actioned now.'} testId={`advisor-decision-projection-info-${decision.id}`} />
                                    </div>
                                    <p data-testid={`advisor-decision-projection-ignored-${decision.id}`}>If ignored → risk {projections.ignored[0]}% / {projections.ignored[1]}% / {projections.ignored[2]}%</p>
                                    <p data-testid={`advisor-decision-projection-actioned-${decision.id}`}>If actioned → risk {projections.actioned[0]}% / {projections.actioned[1]}% / {projections.actioned[2]}%</p>
                                  </div>
                                )}

                                <div className="mt-3 rounded-xl border p-3 text-sm" style={{ borderColor: '#334155', background: '#0F172A', color: '#CBD5E1' }} data-testid={`advisor-decision-decision-block-${decision.id}`}>
                                  <div className="mb-2 flex items-center gap-2">
                                    <strong style={{ color: 'var(--biqc-text)' }}>Decision</strong>
                                    <InlineInfo description="What BIQc believes the owner should conclude from the current signal pattern." testId={`advisor-decision-decision-info-${decision.id}`} />
                                  </div>
                                  <p data-testid={`advisor-decision-loop-decision-${decision.id}`}>{decision.headline}</p>
                                </div>

                                <div className="mt-4 space-y-2 text-sm" style={{ color: 'var(--biqc-text-2)' }}>
                                  <p data-testid={`advisor-decision-if-ignored-${decision.id}`}><strong style={{ color: 'var(--biqc-text)' }}>If ignored:</strong> {signal ? signal.ifIgnored : 'No immediate execution risk detected in this bucket.'}</p>
                                  <button
                                    onClick={() => handleCardMenuAction(decision, 'ignore')}
                                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border px-2.5 py-1 text-xs hover:bg-white/5"
                                    style={{ borderColor: '#64748B40', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                                    data-testid={`advisor-decision-ignore-inline-${decision.id}`}
                                    disabled={!signal || Boolean(actionRecord)}
                                  >
                                    <XCircle className="h-3.5 w-3.5" /> Ignore for now
                                  </button>
                                </div>
                              </div>

                              {signal && actionRecord && (
                                <div className="mt-3 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: '#334155', background: '#0F172A', color: '#CBD5E1', fontFamily: fontFamily.mono }} data-testid={`advisor-decision-action-record-${decision.id}`}>
                                  Action recorded: {actionRecord.action} · {formatTime(actionRecord.at)}
                                </div>
                              )}

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
                  </div>
                </div>
              </section>

              {truthGateAlerts.length > 0 && (
                <section className="mb-8 rounded-2xl border p-4" style={{ borderColor: '#FB923C55', background: 'linear-gradient(135deg, rgba(251,146,60,0.08), rgba(239,68,68,0.08))' }} data-testid="advisor-truth-gate-section">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-[#FDBA74]" style={{ fontFamily: fontFamily.mono }} data-testid="advisor-truth-gate-label">
                        Forensic Truth Gate
                      </p>
                      <h2 className="mt-2 text-base md:text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid="advisor-truth-gate-title">
                        BIQc blocked unverified source claims before they reached the decision surface.
                      </h2>
                      <p className="mt-2 text-sm" style={{ color: '#FCD34D' }} data-testid="advisor-truth-gate-copy">
                        Restore the affected integrations, then rerun verification to bring these domains back into live cognition.
                      </p>
                    </div>
                    <Link
                      to="/integrations"
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-3 py-2 text-xs hover:bg-black/10"
                      style={{ borderColor: '#FB923C66', color: '#FDE68A', fontFamily: fontFamily.mono }}
                      data-testid="advisor-truth-gate-open-integrations-button"
                    >
                      Review integrations <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {truthGateAlerts.slice(0, 4).map((alert) => (
                      <article
                        key={alert.id}
                        className="rounded-2xl border p-4"
                        style={{ borderColor: '#FB923C55', background: 'rgba(15,23,42,0.42)' }}
                        data-testid={`advisor-truth-gate-alert-${alert.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.12em] text-[#FDBA74]" style={{ fontFamily: fontFamily.mono }} data-testid={`advisor-truth-gate-alert-state-${alert.id}`}>
                              {String(alert.truth_state || 'blocked').replace(/_/g, ' ')}
                            </p>
                            <h3 className="mt-2 text-sm font-semibold text-[#F8FAFC]" data-testid={`advisor-truth-gate-alert-title-${alert.id}`}>{alert.title}</h3>
                          </div>
                          <ShieldAlert className="h-4 w-4 text-[#FDBA74]" />
                        </div>
                        <p className="mt-3 text-sm text-[#FDE68A]" data-testid={`advisor-truth-gate-alert-detail-${alert.id}`}>{alert.detail}</p>
                        {alert.last_verified_at && (
                          <p className="mt-3 text-xs text-[#CBD5E1]" data-testid={`advisor-truth-gate-alert-last-verified-${alert.id}`}>
                            Last verified: {formatTime(alert.last_verified_at)}
                          </p>
                        )}
                        <p className="mt-3 text-xs text-[#CBD5E1]" data-testid={`advisor-truth-gate-alert-action-${alert.id}`}>{alert.action}</p>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              <section className="mb-8 rounded-2xl border p-4" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }} data-testid="advisor-advanced-toggle-section">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm" style={{ color: 'var(--biqc-text-2)' }} data-testid="advisor-advanced-toggle-copy">
                    Need deeper diagnostics (provider health, conflict resolver, signal inbox, full audit)?
                  </p>
                  <button
                    onClick={() => setShowAdvancedSections((prev) => !prev)}
                    className="inline-flex min-h-[40px] items-center rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
                    style={{ borderColor: '#334155', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                    data-testid="advisor-advanced-toggle-button"
                  >
                    {showAdvancedSections ? 'Hide diagnostics' : 'Show diagnostics'}
                  </button>
                </div>
              </section>

              {showAdvancedSections && (
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
                    {truthGateAlerts.length > 0
                      ? 'Only fully verified signals are eligible for conflict resolution. Restore blocked source truth to expand this view.'
                      : 'No conflicting action directions detected in current high-priority signals.'}
                  </div>
                )}
              </section>
              )}

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

              {showAdvancedSections && (
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
              )}

              {showAdvancedSections && (
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
              )}

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

              <AlertDialog open={Boolean(pendingMenuAction)} onOpenChange={(open) => { if (!open) setPendingMenuAction(null); }}>
                <AlertDialogContent data-testid="advisor-card-action-confirm-dialog">
                  <AlertDialogHeader>
                    <AlertDialogTitle data-testid="advisor-card-action-confirm-title">
                      {pendingMenuAction?.actionType === 'resolve' ? 'Mark this priority as actioned?' : 'Ignore this priority for now?'}
                    </AlertDialogTitle>
                    <AlertDialogDescription data-testid="advisor-card-action-confirm-description">
                      {pendingMenuAction?.actionType === 'resolve'
                        ? 'BIQc will record the action and surface the next queued priority card.'
                        : 'BIQc will remove this priority from the active queue and keep an audit trail of the ignore action.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="advisor-card-action-confirm-cancel">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmPendingMenuAction} data-testid="advisor-card-action-confirm-submit">
                      Confirm
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

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
