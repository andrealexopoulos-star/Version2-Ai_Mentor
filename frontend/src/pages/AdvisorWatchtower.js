import React, { useState, useMemo, useEffect } from 'react';
import { useSnapshotProgress } from '../hooks/useSnapshotProgress';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { apiClient } from '../lib/api';
import DashboardLayout from '../components/DashboardLayout';
import { CheckInAlerts } from '../components/CheckInAlerts';
import { CognitiveLoadingScreen } from '../components/CognitiveLoadingScreen';
import { Mail, MessageSquare, Users, XCircle, ChevronDown, ChevronUp, DollarSign, TrendingUp, Settings as SettingsIcon, User, Radar, RefreshCw, CheckCircle2, Plug, ArrowRight, Zap } from 'lucide-react';

import DataConfidence from '../components/DataConfidence';
import { DailyBriefCard, DailyBriefBanner } from '../components/DailyBriefCard';
import { RiskSuggestions } from '../components/RiskSuggestions';
import IntegrationStatusWidget from '../components/IntegrationStatusWidget';
import { PageErrorState } from '../components/PageStateComponents';
import { StageProgressBar } from '../components/AsyncDataLoader';
import IntelligenceCoverageBar from '../components/IntelligenceCoverageBar';
import { trackEvent, EVENTS } from '../lib/analytics';
import { trackPageRender } from '../lib/telemetry';
import { fontFamily } from '../design-system/tokens';


/* ═══ ACTION BUTTONS ═══ */
const ActionBtn = ({ icon: Icon, label, color }) => (
  <button className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-lg text-[11px] font-semibold transition-all hover:-translate-y-0.5 active:scale-95" style={{ background: `${color}15`, color, border: `1px solid ${color}30`, fontFamily: fontFamily.mono }} data-testid={`action-${label.toLowerCase().replace(/\s/g,'-')}`}>
    <Icon className="w-3.5 h-3.5" />{label}
  </button>
);
const ActionBar = ({ actions }) => {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {actions.includes("auto-email") && <ActionBtn icon={Mail} label="Auto-Email" color="#3B82F6" />}
      {actions.includes("quick-sms") && <ActionBtn icon={MessageSquare} label="Quick-SMS" color="#10B981" />}
      {actions.includes("hand-off") && <ActionBtn icon={Users} label="Hand Off" color="#FF6A00" />}
      <ActionBtn icon={CheckCircle2} label="Complete" color="#10B981" />
      <ActionBtn icon={XCircle} label="Ignore" color="#64748B" />
    </div>
  );
};

const GROUPS = {
  money: { id: 'money', label: 'Money', icon: DollarSign, color: '#FF6A00', description: 'Cash, invoices, margins, runway, spend', requires: 'accounting' },
  revenue: { id: 'revenue', label: 'Revenue', icon: TrendingUp, color: '#3B82F6', description: 'Pipeline, deals, leads, churn, pricing', requires: 'crm' },
  operations: { id: 'operations', label: 'Operations', icon: SettingsIcon, color: '#10B981', description: 'Tasks, SOPs, bottlenecks, delivery', requires: 'crm' },
  people: { id: 'people', label: 'People', icon: User, color: '#EF4444', description: 'Capacity, calendar, decisions, burnout', requires: 'email' },
  market: { id: 'market', label: 'Market', icon: Radar, color: '#7C3AED', description: 'Competitors, positioning, trends, regulatory', requires: null },
};

const ST = { STABLE: { c: '#10B981', bg: '#10B98108', b: '#10B98125', d: '#10B981' }, DRIFT: { c: '#F59E0B', bg: '#F59E0B08', b: '#F59E0B25', d: '#F59E0B' }, COMPRESSION: { c: '#FF6A00', bg: '#FF6A0008', b: '#FF6A0025', d: '#FF6A00' }, CRITICAL: { c: '#EF4444', bg: '#EF444408', b: '#EF444425', d: '#EF4444' } };
const ST_LABELS = { STABLE: 'On Track', DRIFT: 'Market Shift', COMPRESSION: 'Under Pressure', CRITICAL: 'At Risk' };
const SEV = { high: { bg: '#EF444410', b: '#EF444425', d: '#EF4444' }, medium: { bg: '#F59E0B10', b: '#F59E0B25', d: '#F59E0B' }, low: { bg: '#10B98110', b: '#10B98125', d: '#10B981' } };

const Card = ({ children, className = '', ...props }) => (<div className={`rounded-2xl ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }} {...props}>{children}</div>);

/* Integration-aware empty state — uses granular IntegrationStatusWidget */
const GROUP_CATEGORY_MAP = {
  revenue: ['crm'],
  money: ['accounting'],
  operations: ['crm'],
  people: ['email'],
  market: [],
};

const IntegrationRequired = ({ groupId, color, integrationStatus, integrationLoading, onRefresh, integrationSyncing }) => {
  const categories = GROUP_CATEGORY_MAP[groupId] || [];
  if (categories.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Radar className="w-8 h-8 mx-auto mb-3" style={{ color: '#64748B' }} />
        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>Market Data Unavailable</p>
        <p className="text-xs mb-4 max-w-md mx-auto" style={{ color: '#64748B', fontFamily: fontFamily.body }}>Complete calibration to enable market positioning analysis.</p>
        <a href="/calibration" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: color }}>Start Calibration</a>
      </Card>
    );
  }
  return (
    <Card className="p-6">
      <IntegrationStatusWidget
        categories={categories}
        status={integrationStatus}
        loading={integrationLoading}
        syncing={integrationSyncing}
        onRefresh={onRefresh}
        showRefresh={true}
      />
    </Card>
  );
};

/* First-time user welcome — shown when zero integrations connected */
const WelcomeBanner = ({ owner }) => (
  <Card className="p-6 mb-6" data-testid="welcome-banner">
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FF6A0015' }}>
        <Zap className="w-5 h-5" style={{ color: '#FF6A00' }} />
      </div>
      <div className="flex-1">
        <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>Welcome{owner ? `, ${owner}` : ''}. Let's activate your intelligence.</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}>
          BIQc needs to connect to your business tools to surface real intelligence. Connect at least one tool to get started.
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Connect CRM', desc: 'HubSpot, Salesforce', color: '#3B82F6' },
            { label: 'Connect Accounting', desc: 'Xero, QuickBooks', color: '#FF6A00' },
            { label: 'Connect Email', desc: 'Gmail, Outlook', color: '#10B981' },
          ].map(tool => (
            <a key={tool.label} href="/integrations" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:brightness-110" style={{ background: tool.color }} data-testid={`welcome-${tool.label.toLowerCase().replace(/\s/g, '-')}`}>
              <Plug className="w-3 h-3" /> {tool.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  </Card>
);

/* Daily summary — "What changed in 24h" */
const DailySummary = ({ cognitive }) => {
  const c = cognitive || {};
  const rq = c.resolution_queue || [];
  const newAlerts = rq.filter(r => {
    if (!r.created_at) return false;
    const created = new Date(r.created_at);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return created > dayAgo;
  });
  const memo = c.executive_memo || c.memo || '';
  if (!memo && newAlerts.length === 0) return null;
  return (
    <Card className="p-5 mb-6" data-testid="daily-summary">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#FF6A00' }} />
        <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>What changed in 24h</span>
      </div>
      {newAlerts.length > 0 && (
        <p className="text-xs mb-2" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}>
          <span className="font-semibold" style={{ color: 'var(--biqc-text)' }}>{newAlerts.length} new signal{newAlerts.length > 1 ? 's' : ''}</span> detected across your systems.
        </p>
      )}
      {memo && <p className="text-sm leading-relaxed" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}>{memo.substring(0, 200)}{memo.length > 200 ? '...' : ''}</p>}
    </Card>
  );
};

// Parse cognitive data into group structure — only from verified integration data
function parseToGroups(c, connectedIntegrations) {
  const groups = {
    money: { alerts: 0, severity: 'low', resolutions: [], insight: '', metrics: [], details: null, hasData: false, score: 0 },
    revenue: { alerts: 0, severity: 'low', resolutions: [], insight: '', metrics: [], details: null, hasData: false, score: 0 },
    operations: { alerts: 0, severity: 'low', resolutions: [], insight: '', metrics: [], details: null, hasData: false, score: 0 },
    people: { alerts: 0, severity: 'low', resolutions: [], insight: '', metrics: [], details: null, hasData: false, score: 0 },
    market: { alerts: 0, severity: 'low', resolutions: [], insight: '', metrics: [], details: null, hasData: false, score: 0 },
  };
  if (!c) return groups;

  const hasCRM = connectedIntegrations.includes('crm') || connectedIntegrations.includes('hubspot') || connectedIntegrations.includes('salesforce') || connectedIntegrations.includes('pipedrive');
  const hasAccounting = connectedIntegrations.includes('accounting') || connectedIntegrations.includes('xero') || connectedIntegrations.includes('quickbooks') || connectedIntegrations.includes('myob');
  const hasEmail = connectedIntegrations.includes('email') || connectedIntegrations.includes('gmail') || connectedIntegrations.includes('outlook');

  // Map resolution_queue items to groups — only if integration available
  const rq = c.resolution_queue || [];
  for (const item of rq) {
    const t = item.type || '';
    let g = 'operations';
    let allowed = hasCRM;
    if (t.includes('payment') || t.includes('invoice') || t.includes('cash') || t.includes('budget')) { g = 'money'; allowed = hasAccounting; }
    else if (t.includes('deal') || t.includes('lead') || t.includes('churn') || t.includes('revenue') || t.includes('pipeline')) { g = 'revenue'; allowed = hasCRM; }
    else if (t.includes('sop') || t.includes('task') || t.includes('overtime') || t.includes('breach')) { g = 'operations'; allowed = hasCRM; }
    else if (t.includes('capacity') || t.includes('burnout') || t.includes('fatigue') || t.includes('team')) { g = 'people'; allowed = hasEmail; }
    else if (t.includes('competitor') || t.includes('market') || t.includes('regulatory') || t.includes('compliance')) { g = 'market'; allowed = true; }
    if (!allowed) continue;
    groups[g].resolutions.push(item);
    groups[g].alerts++;
    groups[g].hasData = true;
    if (item.severity === 'high') groups[g].severity = 'high';
    else if (item.severity === 'medium' && groups[g].severity !== 'high') groups[g].severity = 'medium';
  }

  // Map inevitabilities to groups
  const inv = c.inevitabilities || [];
  for (const item of inv) {
    const d = (item.domain || '').toLowerCase();
    let g = 'operations';
    let allowed = hasCRM;
    if (d.includes('financ') || d.includes('money') || d.includes('cash')) { g = 'money'; allowed = hasAccounting; }
    else if (d.includes('revenue') || d.includes('sales') || d.includes('pipeline')) { g = 'revenue'; allowed = hasCRM; }
    else if (d.includes('operation') || d.includes('execution')) { g = 'operations'; allowed = hasCRM; }
    else if (d.includes('people') || d.includes('team') || d.includes('founder')) { g = 'people'; allowed = hasEmail; }
    else if (d.includes('market') || d.includes('compet') || d.includes('strategic')) { g = 'market'; allowed = true; }
    if (!allowed) continue;
    groups[g].resolutions.push({ severity: item.intensity === 'imminent' ? 'high' : 'medium', title: item.signal || item.domain, detail: item.if_ignored || '', actions: item.actions || ["hand-off", "dismiss"], probability: item.probability, impact: item.impact, window: item.window });
    groups[g].alerts++;
    groups[g].hasData = true;
    if (!groups[g].insight) groups[g].insight = item.signal;
  }

  // ═══ MONEY TAB — Only with accounting integration ═══
  if (hasAccounting) {
    const cap = c.capital || {};
    if (cap.runway || cap.margin || cap.alert) {
      groups.money.details = cap;
      groups.money.hasData = true;
      groups.money.metrics = [
        cap.runway != null && { label: 'Runway', value: `${cap.runway}mo`, color: cap.runway < 6 ? '#EF4444' : cap.runway < 12 ? '#F59E0B' : '#10B981' },
        cap.margin && { label: 'Margin', value: cap.margin, color: (cap.margin || '').includes('compress') ? '#EF4444' : '#10B981' },
        cap.spend && { label: 'Spend', value: cap.spend, color: '#3B82F6' },
      ].filter(Boolean);
      groups.money.insight = cap.alert || cap.best || groups.money.insight;
    }
  }

  // ═══ REVENUE TAB — Only with CRM integration ═══
  if (hasCRM) {
    const rev = c.revenue || {};
    if (rev.pipeline || rev.weighted || rev.churn) {
      groups.revenue.details = rev;
      groups.revenue.hasData = true;
      groups.revenue.metrics = [
        rev.pipeline != null && { label: 'Pipeline', value: `$${Math.round((rev.pipeline || 0) / 1000)}K`, color: '#3B82F6' },
        rev.weighted != null && { label: 'Weighted', value: `$${Math.round((rev.weighted || 0) / 1000)}K`, color: '#10B981' },
        rev.entropy && { label: 'Concentration', value: rev.entropy, color: '#F59E0B' },
      ].filter(Boolean);
      groups.revenue.insight = rev.churn || groups.revenue.insight;
    }
  }

  // ═══ OPERATIONS TAB — Only with CRM/PM integration ═══
  if (hasCRM) {
    const exec = c.execution || {};
    if (exec.sla_breaches != null || exec.bottleneck || exec.task_aging) {
      groups.operations.details = exec;
      groups.operations.hasData = true;
      groups.operations.metrics = [
        exec.sla_breaches != null && { label: 'SLA Breaches', value: String(exec.sla_breaches), color: exec.sla_breaches > 0 ? '#EF4444' : '#10B981' },
        exec.task_aging != null && { label: 'Task Aging', value: `${exec.task_aging}%`, color: exec.task_aging > 30 ? '#F59E0B' : '#10B981' },
        exec.bottleneck && { label: 'Bottleneck', value: exec.bottleneck, color: '#F59E0B' },
      ].filter(Boolean);
      groups.operations.insight = exec.bottleneck || groups.operations.insight;
    }
  }

  // ═══ PEOPLE TAB — Only with email/calendar integration ═══
  if (hasEmail) {
    const fv = c.founder_vitals || {};
    if (fv.capacity_index || fv.fatigue || fv.recommendation) {
      groups.people.details = fv;
      groups.people.hasData = true;
      groups.people.metrics = [
        fv.capacity_index != null && { label: 'Capacity', value: `${fv.capacity_index}%`, color: fv.capacity_index > 100 ? '#EF4444' : fv.capacity_index > 80 ? '#F59E0B' : '#10B981' },
        fv.fatigue && { label: 'Fatigue', value: fv.fatigue, color: fv.fatigue === 'high' ? '#EF4444' : fv.fatigue === 'medium' ? '#F59E0B' : '#10B981' },
        fv.decisions != null && { label: 'Pending Decisions', value: String(fv.decisions), color: fv.decisions > 5 ? '#F59E0B' : '#10B981' },
      ].filter(Boolean);
      groups.people.insight = fv.recommendation || groups.people.insight;
    }
  }

  // ═══ MARKET TAB — Always allowed (from web scraping/calibration) ═══
  const mkt = c.market || {};
  const mi = c.market_intelligence || {};
  if (mkt.narrative || mi.positioning_verdict) {
    groups.market.details = { ...mkt, ...mi };
    groups.market.hasData = true;
    groups.market.metrics = [
      mi.positioning_verdict && { label: 'Position', value: mi.positioning_verdict, color: mi.positioning_verdict === 'STABLE' ? '#10B981' : mi.positioning_verdict === 'DRIFT' ? '#F59E0B' : '#EF4444' },
      mi.misalignment_index != null && { label: 'Misalignment', value: `${mi.misalignment_index}/100`, color: mi.misalignment_index > 50 ? '#EF4444' : mi.misalignment_index > 25 ? '#F59E0B' : '#10B981' },
      mi.probability_of_goal_achievement != null && { label: 'Goal Prob', value: `${mi.probability_of_goal_achievement}%`, color: mi.probability_of_goal_achievement > 60 ? '#10B981' : '#F59E0B' },
    ].filter(Boolean);
    groups.market.insight = mkt.narrative || groups.market.insight;
  }

  // ═══ WEIGHTED SCORING FORMULA ═══
  // Score = (severity_weight * alert_count * data_quality_multiplier)
  // severity_weight: high=3, medium=2, low=1
  // data_quality_multiplier: based on number of metrics and integration status
  const sevWeights = { high: 3, medium: 2, low: 1 };
  for (const gid of Object.keys(groups)) {
    const g = groups[gid];
    if (!g.hasData) { g.score = 0; continue; }
    const sevWeight = sevWeights[g.severity] || 1;
    const alertScore = g.alerts * sevWeight;
    const metricBonus = g.metrics.length * 5;
    const detailBonus = g.details ? 10 : 0;
    const insightBonus = g.insight ? 5 : 0;
    g.score = Math.min(Math.round(alertScore + metricBonus + detailBonus + insightBonus), 100);
  }

  return groups;
}

/* ═══ STABILITY SCORE CARD ═══ */
const StabilityScoreCard = ({ score, status, velocity, interpretation, cognitionConf, indices }) => {
  const statusConfig = {
    STABLE: { color: '#10B981', label: 'Stable', bg: '#10B98108' },
    DRIFT: { color: '#F59E0B', label: 'Drifting', bg: '#F59E0B08' },
    COMPRESSION: { color: '#FF6A00', label: 'Under Pressure', bg: '#FF6A0008' },
    CRITICAL: { color: '#EF4444', label: 'Critical', bg: '#EF444408' },
  };
  const cfg = statusConfig[status] || statusConfig.STABLE;
  const velIcon = velocity === 'worsening' ? '↘' : velocity === 'improving' ? '↗' : '→';
  const scoreColor = score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : score >= 30 ? '#FF6A00' : '#EF4444';
  const circumference = 2 * Math.PI * 28;
  const offset = circumference * (1 - score / 100);

  return (
    <Card className="p-5 mb-6" data-testid="stability-score-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-5">
          {/* Circular Score */}
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#243140" strokeWidth="5" />
              <circle cx="32" cy="32" r="28" fill="none" stroke={scoreColor} strokeWidth="5"
                strokeDasharray={circumference} strokeDashoffset={offset}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold leading-none" style={{ color: scoreColor, fontFamily: fontFamily.mono }}>{score}</span>
              <span className="text-[8px] tracking-widest uppercase mt-0.5" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>SCORE</span>
            </div>
          </div>
          {/* Status Info */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
              <span className="text-sm font-semibold" style={{ color: cfg.color, fontFamily: fontFamily.mono }}>{cfg.label}</span>
              {velocity && <span className="text-xs" style={{ color: cfg.color }}>{velIcon} {velocity}</span>}
            </div>
            <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>Business Stability</h2>
            {interpretation && <p className="text-xs max-w-xs leading-relaxed" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}>{interpretation.substring(0, 120)}{interpretation.length > 120 ? '...' : ''}</p>}
            {!interpretation && <p className="text-xs" style={{ color: '#64748B', fontFamily: fontFamily.body }}>Overall operational health across all connected systems.</p>}
          </div>
        </div>

        {/* Instability Indices — from cognition core */}
        {indices && (
          <div className="hidden sm:grid grid-cols-2 gap-2 shrink-0">
            {[
              { key: 'revenue_volatility_index', label: 'RVI', title: 'Revenue Volatility' },
              { key: 'engagement_decay_score', label: 'EDS', title: 'Engagement Decay' },
              { key: 'cash_deviation_ratio', label: 'CDR', title: 'Cash Deviation' },
              { key: 'anomaly_density_score', label: 'ADS', title: 'Anomaly Density' },
            ].map(({ key, label, title }) => {
              const val = indices[key];
              if (val == null) return null;
              const pct = Math.round(val * 100);
              const ic = pct > 60 ? '#EF4444' : pct > 30 ? '#F59E0B' : '#10B981';
              return (
                <div key={key} className="p-2 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)', minWidth: 80 }}>
                  <span className="text-[9px] font-bold tracking-widest uppercase block" style={{ color: ic, fontFamily: fontFamily.mono }}>{label}</span>
                  <span className="text-base font-bold" style={{ color: ic, fontFamily: fontFamily.mono }}>{pct}%</span>
                  <span className="text-[9px] block" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{title}</span>
                </div>
              );
            }).filter(Boolean)}
          </div>
        )}

        {/* Confidence badge */}
        {cognitionConf != null && (
          <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
            <span className="text-[9px] font-semibold tracking-widest uppercase" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Confidence</span>
            <span className="text-lg font-bold" style={{ color: cognitionConf > 0.6 ? '#10B981' : '#F59E0B', fontFamily: fontFamily.mono }}>{Math.round(cognitionConf * 100)}%</span>
          </div>
        )}
      </div>
    </Card>
  );
};

const AdvisorWatchtower = () => {
  const { cognitive, sources, owner, timeOfDay, loading, error, cacheAge, refreshing, refresh, stage, progress, startedAt, resumeSnapshot } = useSnapshotProgress();
  const c = useMemo(() => cognitive || {}, [cognitive]);
  const { status: integrationStatus, loading: integrationLoading, syncing: integrationSyncing, refresh: refreshIntegrations } = useIntegrationStatus();
  const [cognitionData, setCognitionData] = useState(null);

  // Derive connectedIntegrations from unified status for parseToGroups compatibility
  const connectedIntegrations = useMemo(() => {
    if (!integrationStatus?.integrations) return [];
    return integrationStatus.integrations
      .filter(i => i.connected)
      .map(i => i.category.toLowerCase());
  }, [integrationStatus]);

  useEffect(() => {
    // Cognition core (Phase B)
    apiClient.get('/cognition/overview').then(res => {
      if (res.data && res.data.status !== 'MIGRATION_REQUIRED') {
        setCognitionData(res.data);
      }
    }).catch(() => {});
    trackEvent(EVENTS.DASHBOARD_VIEW, { page: 'advisor' });
    trackPageRender('advisor');
  }, []);

  // Parse system state (handle both string and object formats)
  const stateStatus = typeof c.system_state === 'object' ? c.system_state?.status : c.system_state;
  const stateConf = typeof c.system_state === 'object' ? c.system_state?.confidence : c.confidence_level;
  const stateInterp = typeof c.system_state === 'object' ? c.system_state?.interpretation : c.system_state_interpretation;
  const stateVelocity = typeof c.system_state === 'object' ? c.system_state?.velocity : null;
  const st = ST[stateStatus] || ST.STABLE;

  const groupData = useMemo(() => parseToGroups(c, connectedIntegrations), [c, connectedIntegrations]);
  const sortedGroups = useMemo(() => Object.values(GROUPS).sort((a, b) => {
    const sevW = { high: 3, medium: 2, low: 1 };
    return (groupData[b.id].alerts * (sevW[groupData[b.id].severity] || 1)) - (groupData[a.id].alerts * (sevW[groupData[a.id].severity] || 1));
  }), [groupData]);

  const [activeGroup, setActiveGroup] = useState(null);
  const activeId = activeGroup || sortedGroups[0]?.id || 'market';
  const gd = groupData[activeId];
  const group = GROUPS[activeId];

  // Check if the active tab's required integration is connected
  const isTabConnected = !group.requires || connectedIntegrations.some(i => i.includes(group.requires));

  const [briefOpen, setBriefOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);

  const memo = c.executive_memo || c.memo || '';
  const alignment = c.strategic_alignment_check || c.alignment?.narrative || '';
  const contradictions = c.alignment?.contradictions || [];
  const wb = c.weekly_brief || {};

  // ═══ COMPOSITE STABILITY SCORE — Phase B ═══
  // Uses cognition core score when available, derives from snapshot otherwise
  const stabilityScore = useMemo(() => {
    if (cognitionData?.composite_risk_score != null) {
      return Math.round((1 - Math.min(cognitionData.composite_risk_score, 1)) * 100);
    }
    const baseScores = { STABLE: 87, DRIFT: 64, COMPRESSION: 42, CRITICAL: 22 };
    const base = baseScores[stateStatus] || 75;
    const totalAlerts = Object.values(groupData).reduce((s, g) => s + g.alerts, 0);
    return Math.max(5, Math.min(99, base - totalAlerts * 3));
  }, [cognitionData, stateStatus, groupData]);

  const instabilityIndices = cognitionData?.instability_indices || null;
  const propagationMap = cognitionData?.propagation_map || null;
  const cognitionConfidence = cognitionData?.confidence_score ?? null;

  return (
    <DashboardLayout>
      <div className="min-h-[calc(100vh-56px)]" style={{ background: 'var(--biqc-bg)', fontFamily: fontFamily.display }} data-testid="biqc-insights-page">

        {/* LOADING — Animated cognitive screen with progress bar */}
        {loading && (
          <>
            <CognitiveLoadingScreen
              mode={cacheAge === null ? 'first' : 'returning'}
              ownerName={owner}
            />
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-6" data-testid="advisor-progress-bar">
              <div className="rounded-xl p-4" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                <StageProgressBar stage={stage} progress={progress} startedAt={startedAt} />
              </div>
            </div>
          </>
        )}

        {/* ERROR */}
        {error && !loading && !cognitive && (
          <div className="max-w-3xl mx-auto px-6 py-16">
            <PageErrorState error={error} onRetry={resumeSnapshot} moduleName="BIQc Overview" />
          </div>
        )}

        {/* EMPTY STATE — no data yet, no error */}
        {!loading && !cognitive && !error && (
          <div className="max-w-5xl mx-auto px-6 py-12">
            <WelcomeBanner owner={owner} />
          </div>
        )}

        {/* MAIN CONTENT */}
        {!loading && cognitive && (
          <>
            {/* STICKY HEADER */}
            <div className="sticky top-14 z-30" style={{ background: st.bg, borderBottom: `1px solid ${st.b}` }}>
              <div className="max-w-5xl mx-auto px-6 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: st.d, boxShadow: `0 0 8px ${st.d}50` }} />
                  <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: st.c, fontFamily: fontFamily.mono }}>{ST_LABELS[stateStatus] || 'On Track'}</span>
                  {stateVelocity && <span className="text-[11px]" style={{ color: st.c }}>{stateVelocity === 'worsening' ? '↘' : stateVelocity === 'improving' ? '↗' : '→'} {stateVelocity}</span>}
                  {stateConf && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: st.c, background: `${st.c}15`, fontFamily: fontFamily.mono }}>{typeof stateConf === 'number' ? `${stateConf}%` : stateConf}</span>}
                </div>
                <button onClick={refresh} disabled={refreshing} className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg hover:bg-white/5" style={{ color: '#64748B' }} data-testid="refresh-btn">
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
              {stateInterp && <div className="max-w-5xl mx-auto px-6 pb-2"><p className="text-[12px]" style={{ color: st.c, fontFamily: fontFamily.body }}>{stateInterp}</p></div>}
            </div>

            <div className="max-w-5xl mx-auto px-6 py-8">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h1 className="text-3xl font-semibold" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>
                  Good {timeOfDay || 'morning'}, {owner || 'there'}.
                </h1>
                <div className="flex items-center gap-3">
                  <IntelligenceCoverageBar integrationStatus={integrationStatus} loading={integrationLoading} />
                  <DataConfidence cognitive={cognitive} />
                </div>
              </div>

              {/* CHECK-IN ALERTS */}
              <CheckInAlerts />

              {/* STABILITY SCORE — Phase B: Key Intelligence Number */}
              <StabilityScoreCard
                score={stabilityScore}
                status={stateStatus}
                velocity={stateVelocity}
                interpretation={stateInterp}
                cognitionConf={cognitionConfidence}
                indices={instabilityIndices}
              />

              {/* DAILY BRIEF CARD — Proactive intelligence */}
              <DailyBriefCard />

              {/* RISK SUGGESTIONS — Signal-driven actionable risks */}
              <RiskSuggestions />

              {/* WELCOME BANNER — shown when no integrations connected AND cognition says none */}
              {connectedIntegrations.length === 0 && (!cognitionData || !cognitionData.integrations || (!cognitionData.integrations.crm && !cognitionData.integrations.email && !cognitionData.integrations.accounting)) && <WelcomeBanner owner={owner} />}

              {/* DAILY SUMMARY — "What changed in 24h" */}
              {(connectedIntegrations.length > 0 || (cognitionData?.integrations && (cognitionData.integrations.crm || cognitionData.integrations.email || cognitionData.integrations.accounting))) && <DailySummary cognitive={cognitive} />}

              {/* 5 COGNITION TABS */}
              <div className="relative mb-6">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" data-testid="cognition-tabs" style={{ WebkitOverflowScrolling: 'touch', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                {sortedGroups.map((g) => {
                  const d = groupData[g.id];
                  const isActive = activeId === g.id;
                  const Icon = g.icon;
                  return (
                    <button key={g.id} onClick={() => setActiveGroup(g.id)}
                      className="flex items-center gap-2.5 px-4 py-3 min-h-[48px] rounded-xl transition-all shrink-0"
                      style={{ background: isActive ? g.color : '#141C26', color: isActive ? 'white' : '#9FB0C3', border: `1.5px solid ${isActive ? g.color : '#243140'}`, boxShadow: isActive ? `0 4px 16px ${g.color}30` : 'none', fontFamily: fontFamily.display }}
                      data-testid={`tab-${g.id}`}>
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-semibold">{g.label}</span>
                      {d.alerts > 0 && d.hasData && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: isActive ? 'rgba(255,255,255,0.25)' : SEV[d.severity].bg, color: isActive ? 'white' : SEV[d.severity].d, fontFamily: fontFamily.mono }}>{d.alerts}</span>}
                    </button>
                  );
                })}
                </div>
                <div className="absolute right-0 top-0 bottom-2 w-8 pointer-events-none sm:hidden" style={{ background: 'linear-gradient(to right, transparent, #0F1720)' }} />
              </div>

              {/* ACTIVE GROUP */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${group.color}15` }}>
                    <group.icon className="w-4 h-4" style={{ color: group.color }} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>{group.label}</h2>
                    <p className="text-xs" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{group.description}</p>
                  </div>
                  {gd.score > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full ml-auto" style={{ color: gd.score > 50 ? '#EF4444' : gd.score > 20 ? '#F59E0B' : '#10B981', background: (gd.score > 50 ? '#EF4444' : gd.score > 20 ? '#F59E0B' : '#10B981') + '15', fontFamily: fontFamily.mono }} data-testid="insight-score">
                      Score: {gd.score}
                    </span>
                  )}
                </div>

                {/* Show integration-required state if tab needs unconnected integration */}
                {!isTabConnected && !gd.hasData ? (
                  <IntegrationRequired
                    groupId={activeId}
                    color={group.color}
                    integrationStatus={integrationStatus}
                    integrationLoading={integrationLoading}
                    integrationSyncing={integrationSyncing}
                    onRefresh={refreshIntegrations}
                  />
                ) : (
                  <>
                    {/* AI Insight */}
                    {gd.insight ? (
                      <Card className="p-5"><p className="text-sm leading-relaxed" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}>{gd.insight}</p></Card>
                    ) : (
                      <Card className="p-5"><p className="text-sm" style={{ color: '#64748B', fontFamily: fontFamily.body }}>
                        {gd.hasData ? 'Insufficient data to generate insight.' : 'No active signals detected. Connect relevant integrations to activate monitoring.'}
                      </p></Card>
                    )}

                    {/* Tab Metrics — from cognitive snapshot */}
                    {gd.metrics.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {gd.metrics.map((m, i) => (
                          <Card key={i} className="p-4">
                            <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>{m.label}</span>
                            <span className="text-lg font-bold block" style={{ color: m.color, fontFamily: fontFamily.mono }}>{m.value}</span>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* Tab-specific detail panels */}
                    {activeId === 'revenue' && gd.details?.deals?.length > 0 && (
                      <div>
                        <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Deal Pipeline</h3>
                        <div className="space-y-2">
                          {gd.details.deals.slice(0, 5).map((d, i) => (
                            <Card key={i} className="p-4 flex items-center justify-between">
                              <div>
                                <span className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>{d.name}</span>
                                {d.stall > 0 && <span className="text-[10px] ml-2" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>{d.stall}d stalled</span>}
                              </div>
                              <div className="text-right">
                                {d.value != null && <span className="text-sm font-bold text-[#F4F7FA]" style={{ fontFamily: fontFamily.mono }}>${d.value}K</span>}
                                {d.prob != null && <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>{d.prob}% prob</span>}
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeId === 'money' && gd.details && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          gd.details.best && { label: 'Best Case (30d)', value: gd.details.best, color: '#10B981' },
                          gd.details.base && { label: 'Base Case (30d)', value: gd.details.base, color: '#F59E0B' },
                          gd.details.worst && { label: 'Worst Case (30d)', value: gd.details.worst, color: '#EF4444' },
                        ].filter(Boolean).map((s, i) => (
                          <Card key={i} className="p-4">
                            <span className="text-[10px] font-semibold block mb-1" style={{ color: s.color, fontFamily: fontFamily.mono }}>{s.label}</span>
                            <p className="text-xs text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>{s.value}</p>
                          </Card>
                        ))}
                      </div>
                    )}

                    {activeId === 'operations' && gd.details?.recs?.length > 0 && (
                      <div>
                        <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Recommendations</h3>
                        <div className="space-y-2">
                          {gd.details.recs.map((r, i) => (
                            <Card key={i} className="p-4">
                              <p className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>{r}</p>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeId === 'people' && gd.details && (
                      <div className="space-y-3">
                        {gd.details.calendar && <Card className="p-4"><span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Calendar</span><p className="text-sm text-[#9FB0C3]">{gd.details.calendar}</p></Card>}
                        {gd.details.email_stress && <Card className="p-4"><span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Email Stress</span><p className="text-sm text-[#9FB0C3]">{gd.details.email_stress}</p></Card>}
                      </div>
                    )}

                    {activeId === 'market' && gd.details?.competitors?.length > 0 && (
                      <div>
                        <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Competitor Signals</h3>
                        <div className="space-y-2">
                          {gd.details.competitors.map((comp, i) => (
                            <Card key={i} className="p-4 flex items-start gap-3">
                              <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#7C3AED' }} />
                              <div>
                                <span className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>{comp.name}</span>
                                <p className="text-xs text-[#9FB0C3] mt-0.5">{comp.signal}</p>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resolution Items */}
                    {gd.resolutions.length > 0 ? (
                      <div>
                        <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Needs Attention</h3>
                        <div className="space-y-3">
                          {gd.resolutions.map((item, i) => {
                            const sv = SEV[item.severity] || SEV.medium;
                            return (
                              <div key={i} className="rounded-2xl p-5" style={{ background: sv.bg, border: `1px solid ${sv.b}` }}>
                                <div className="flex items-start gap-3">
                                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: sv.d }} />
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>{item.title}</p>
                                    {item.detail && <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}>{item.detail}</p>}
                                    <ActionBar actions={item.actions || ["hand-off", "dismiss"]} />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      !gd.hasData ? null : <Card className="p-6 text-center"><p className="text-sm" style={{ color: '#64748B', fontFamily: fontFamily.body }}>No items need attention right now. All clear.</p></Card>
                    )}
                  </>
                )}

                {/* Alignment Gaps — only if from real data */}
                {isTabConnected && (alignment || contradictions.length > 0) && (
                  <div>
                    <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Alignment</h3>
                    {alignment && <Card className="p-5 mb-3"><p className="text-sm leading-relaxed" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}>{alignment}</p></Card>}
                    {contradictions.map((ct, i) => (<div key={i} className="px-3 py-2 rounded-lg mb-2" style={{ background: '#F59E0B10', border: '1px solid #F59E0B25' }}><p className="text-xs" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>&#x26A0; {ct}</p></div>))}
                  </div>
                )}
              </div>

              {/* PROPAGATION MAP — Phase B: shows risk chain when cognition deployed */}
              {propagationMap && propagationMap.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Risk Propagation</h3>
                  <div className="space-y-2">
                    {propagationMap.slice(0, 3).map((chain, i) => (
                      <Card key={i} className="p-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {(chain.chain || [chain.source, chain.target]).filter(Boolean).map((node, ni, arr) => (
                            <React.Fragment key={ni}>
                              <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: '#EF444415', color: '#EF4444', fontFamily: fontFamily.mono }}>{node}</span>
                              {ni < arr.length - 1 && <span className="text-[10px]" style={{ color: '#64748B' }}>→</span>}
                            </React.Fragment>
                          ))}
                          {chain.probability && <span className="text-[10px] ml-2" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>{Math.round(chain.probability * 100)}% likelihood</span>}
                        </div>
                        {chain.description && <p className="text-xs mt-2" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}>{chain.description}</p>}
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* WEEKLY BRIEF — only show if integrations provide real data */}
              {connectedIntegrations.length > 0 && (wb.cashflow_recovered || wb.hours_saved || wb.actions_taken) && (
                <div className="mt-8 mb-4">
                  <Card className="p-0 overflow-hidden">
                    <button onClick={() => setBriefOpen(!briefOpen)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-1 sm:gap-6 flex-wrap">
                        <span className="text-[10px] font-semibold tracking-widest uppercase mr-2" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>This Week</span>
                        {wb.cashflow_recovered && <div className="text-left"><span className="text-xl font-bold" style={{ color: '#FF6A00', fontFamily: fontFamily.display }}>${(wb.cashflow_recovered || 0).toLocaleString()}</span><span className="text-[9px] ml-1 uppercase" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>recovered</span></div>}
                        {wb.hours_saved && <div className="text-left"><span className="text-xl font-bold" style={{ color: '#10B981', fontFamily: fontFamily.display }}>{wb.hours_saved}h</span><span className="text-[9px] ml-1 uppercase" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>saved</span></div>}
                        {wb.actions_taken && <div className="text-left"><span className="text-xl font-bold" style={{ color: '#3B82F6', fontFamily: fontFamily.display }}>{wb.actions_taken}</span><span className="text-[9px] ml-1 uppercase" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>actions</span></div>}
                      </div>
                      {briefOpen ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
                    </button>
                    {briefOpen && (
                      <div className="px-6 pb-5 pt-2 space-y-2" style={{ borderTop: '1px solid var(--biqc-border)' }}>
                        {wb.cashflow_recovered && <p className="text-sm" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}><strong style={{ color: '#FF6A00' }}>Cash:</strong> Recovered ${(wb.cashflow_recovered || 0).toLocaleString()} via payment follow-ups.</p>}
                        {wb.hours_saved && <p className="text-sm" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}><strong style={{ color: '#10B981' }}>Time:</strong> Handled {wb.tasks_handled || 0} tasks, saving {wb.hours_saved || 0} hours.</p>}
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* Connect integrations prompt if nothing connected */}
              {connectedIntegrations.length === 0 && !loading && (
                <div className="mt-8 mb-4">
                  <Card className="p-6 text-center">
                    <Plug className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
                    <p className="text-sm font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Connect your business tools</p>
                    <p className="text-xs text-[#64748B] mb-4 max-w-lg mx-auto">Connect your CRM, accounting, and email integrations to unlock verified intelligence across all modules.</p>
                    <a href="/integrations" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#FF6A00' }} data-testid="overview-connect-cta">
                      <Plug className="w-4 h-4" /> Connect Integrations
                    </a>
                  </Card>
                </div>
              )}

              {/* EXECUTIVE MEMO */}
              {memo && (
                <div className="mb-8">
                  <button onClick={() => setMemoOpen(!memoOpen)} className="flex items-center justify-between w-full mb-3">
                    <h3 className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Executive Memo</h3>
                    {memoOpen ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
                  </button>
                  {memoOpen && <Card className="p-8"><p className="text-[15px] leading-loose whitespace-pre-line" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}>{memo}</p></Card>}
                </div>
              )}

              {/* Sources */}
              {sources && sources.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-4 pb-8" style={{ borderTop: '1px solid var(--biqc-border)' }}>
                  <span className="text-[10px]" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Sources:</span>
                  {sources.map((s, i) => (<span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: 'var(--biqc-text-2)', background: 'var(--biqc-bg-card)', fontFamily: fontFamily.mono }}>{s}</span>))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdvisorWatchtower;
