import React, { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useSnapshot } from '../hooks/useSnapshot';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { apiClient } from '../lib/api';
import { PageLoadingState, PageErrorState } from '../components/PageStateComponents';
import IntegrationStatusWidget from '../components/IntegrationStatusWidget';
import DataConfidence from '../components/DataConfidence';
import {
  AlertTriangle, Shield, DollarSign, TrendingDown, CheckCircle2,
  Users, UserX, Clock, Plug, Activity, Heart, Info, ArrowRight,
  ExternalLink, ChevronDown, ChevronUp, Mail, Calendar, Loader2,
  XCircle, Zap,
} from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import { Link } from 'react-router-dom';
import { useSupabaseAuth, AUTH_STATE } from '../context/SupabaseAuthContext';
import InsightExplainabilityStrip from '../components/InsightExplainabilityStrip';
import ActionOwnershipCard from '../components/ActionOwnershipCard';
import { EmptyStateCard, MetricCard, SectionLabel, SignalCard, SurfaceCard } from '../components/intelligence/SurfacePrimitives';
import LineageBadge from '../components/LineageBadge';

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>{children}</div>
);

// ── Tooltip ───────────────────────────────────────────────────────────────────
const Tooltip = ({ text, children }) => {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)} onBlur={() => setShow(false)}>
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg text-[11px] leading-snug z-50 whitespace-pre-wrap max-w-[200px]"
          style={{ background: '#1E2D3D', color: '#F4F7FA', border: '1px solid #334155', fontFamily: fontFamily.body, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
          {text}
        </span>
      )}
    </span>
  );
};

// ── Risk meter ────────────────────────────────────────────────────────────────
const RiskMeter = ({ value, label, thresholds = [30, 60], insufficientData = false }) => {
  const color = insufficientData || value == null ? '#64748B' : value > thresholds[1] ? '#EF4444' : value > thresholds[0] ? '#F59E0B' : '#10B981';
  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
      <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>{label}</span>
      <div className="flex items-end gap-2">
        {insufficientData || value == null
          ? <span className="text-xs italic" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Insufficient data</span>
          : <span className="text-xl font-bold" style={{ color, fontFamily: fontFamily.mono }}>{value}%</span>
        }
      </div>
      {!insufficientData && value != null && (
        <div className="h-1.5 rounded-full mt-2" style={{ background: color + '20' }}>
          <div className="h-1.5 rounded-full transition-all" style={{ background: color, width: Math.min(value, 100) + '%' }} />
        </div>
      )}
    </div>
  );
};

// ── Risk category row ─────────────────────────────────────────────────────────
const RiskCategory = ({ icon: Icon, color, title, hasData, children, badgeLabel, noCTA }) => (
  <Panel>
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>{title}</h3>
      </div>
      <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
        style={{ background: hasData ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.15)', color: hasData ? '#10B981' : '#64748B', fontFamily: fontFamily.mono }}>
        {hasData ? (badgeLabel || 'Data available') : 'Insufficient data'}
      </span>
    </div>
    {hasData ? children : (
      <p className="text-xs italic" style={{ color: '#64748B', fontFamily: fontFamily.body }}>
        No data available for this category. {!noCTA && 'Connect the relevant integration to activate monitoring.'}
      </p>
    )}
  </Panel>
);

// ── Workforce example metric card ─────────────────────────────────────────────
const ExampleMetric = ({ label, example, color }) => (
  <div className="p-3 rounded-lg opacity-60" style={{ background: 'var(--biqc-bg)', border: `1px dashed ${color}40` }}>
    <span className="text-[9px] uppercase tracking-widest" style={{ color, fontFamily: fontFamily.mono }}>sample</span>
    <p className="text-xs font-semibold text-[#F4F7FA] mt-0.5" style={{ fontFamily: fontFamily.display }}>{label}</p>
    <p className="text-[10px]" style={{ color: '#64748B', fontFamily: fontFamily.body }}>{example}</p>
  </div>
);

// ── Clickable propagation chain ───────────────────────────────────────────────
const PropagationChain = ({ chain, cognitive }) => {
  const [expanded, setExpanded] = useState(false);
  const src = chain.source || '';
  const tgt = chain.target || '';
  const pct = chain.probability != null ? Math.round(chain.probability * 100) : null;
  const ic = pct > 70 ? '#EF4444' : pct > 40 ? '#F59E0B' : '#3B82F6';

  // Derive specific data to show on drill-down
  const drillDown = {
    revenue: cognitive?.revenue,
    finance: cognitive?.capital,
    people: cognitive?.founder_vitals,
    operations: cognitive?.execution,
    market: cognitive?.market_position,
  };
  const srcData = drillDown[(src || '').toLowerCase()];
  const tgtData = drillDown[(tgt || '').toLowerCase()];

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${ic}25` }}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 p-3 text-left transition-all hover:bg-white/5"
        style={{ background: ic + '06' }}>
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: '#EF444415', color: '#EF4444', fontFamily: fontFamily.mono }}>{src}</span>
          <span className="text-[10px] text-[#64748B]">→</span>
          <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: '#F59E0B15', color: '#F59E0B', fontFamily: fontFamily.mono }}>{tgt}</span>
          {pct != null && <span className="text-[9px] ml-auto font-semibold" style={{ color: ic, fontFamily: fontFamily.mono }}>{pct}% likelihood</span>}
          {chain.window && <span className="text-[9px]" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{chain.window}</span>}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#64748B' }} /> : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#64748B' }} />}
      </button>

      {expanded && (
        <div className="p-3 space-y-2" style={{ borderTop: `1px solid ${ic}20` }}>
          {chain.description && (
            <p className="text-xs leading-relaxed" style={{ color: '#9FB0C3', fontFamily: fontFamily.body }}>{chain.description}</p>
          )}

          {/* Show underlying data for each domain */}
          {srcData && (
            <div className="p-2.5 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid #243140' }}>
              <p className="text-[10px] font-semibold mb-1" style={{ color: ic, fontFamily: fontFamily.mono }}>{src.toUpperCase()} — Contributing factors</p>
              {srcData.pipeline != null && <p className="text-[11px]" style={{ color: '#9FB0C3' }}>Pipeline: ${srcData.pipeline?.toLocaleString()}</p>}
              {srcData.runway != null && <p className="text-[11px]" style={{ color: '#9FB0C3' }}>Cash runway: {srcData.runway} months</p>}
              {srcData.calendar && <p className="text-[11px]" style={{ color: '#9FB0C3' }}>{srcData.calendar}</p>}
              {srcData.deals?.length > 0 && <p className="text-[11px]" style={{ color: '#9FB0C3' }}>{srcData.deals.length} active deals — {srcData.deals.filter(d => (d.stall||0) > 30).length} stalled</p>}
            </div>
          )}

          {/* Navigation link */}
          <div className="flex gap-2 pt-1">
            {src === 'revenue' && <Link to="/revenue" className="text-[10px] flex items-center gap-1" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>View Revenue <ExternalLink className="w-3 h-3" /></Link>}
            {(src === 'finance' || tgt === 'finance') && <Link to="/revenue" className="text-[10px] flex items-center gap-1" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>View Financials <ExternalLink className="w-3 h-3" /></Link>}
            {(src === 'people' || tgt === 'people') && <Link to="/risk?tab=workforce" className="text-[10px] flex items-center gap-1" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>View Workforce <ExternalLink className="w-3 h-3" /></Link>}
            {(src === 'operations' || tgt === 'operations') && <Link to="/operations" className="text-[10px] flex items-center gap-1" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>View Operations <ExternalLink className="w-3 h-3" /></Link>}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Acronym legend ────────────────────────────────────────────────────────────
const ACRONYMS = [
  { label: 'RVI', title: 'Revenue Volatility Index', desc: 'Measures month-to-month unpredictability in your revenue streams. High = erratic cashflow.' },
  { label: 'EDS', title: 'Engagement Decay Score', desc: 'Rate at which customer and lead engagement is declining. High = clients pulling away.' },
  { label: 'CDR', title: 'Cash Deviation Ratio', desc: 'How far your actual cash position diverges from expected. High = unexpected outflows or shortfalls.' },
  { label: 'ADS', title: 'Anomaly Density Score', desc: 'Frequency of unusual signals across all connected data. High = something unusual is happening.' },
];

// ── Main component ────────────────────────────────────────────────────────────
const RiskPage = () => {
  const { cognitive, loading, error, refresh } = useSnapshot();
  const { session, authState } = useSupabaseAuth();
  const c = cognitive || {};
  const risk = c.risk || {};
  const cap = c.capital || {};
  const exec = c.execution || {};
  const alignment = c.alignment || {};
  const fv = c.founder_vitals || {};
  const rev = c.revenue || {};

  const { status: integrationStatus, loading: integrationLoading } = useIntegrationStatus();
  const [activeTab, setActiveTab] = useState('governance');
  const [sqlWorkforce, setSqlWorkforce] = useState(null);
  const [sqlScores, setSqlScores] = useState(null);
  const [unifiedRisk, setUnifiedRisk] = useState(null);
  const [showAcronymLegend, setShowAcronymLegend] = useState(false);

  useEffect(() => {
    if (authState === AUTH_STATE.LOADING && !session?.access_token) return;
    if (!session?.access_token) return;
    apiClient.get('/intelligence/workforce').then(res => {
      if (res.data?.has_data) setSqlWorkforce(res.data);
    }).catch(() => {});
    apiClient.get('/intelligence/scores').then(res => {
      if (res.data?.scores) setSqlScores(res.data.scores);
    }).catch(() => {});
    apiClient.get('/unified/risk').then(res => {
      if (res.data) setUnifiedRisk(res.data);
    }).catch(() => {});
    apiClient.get('/cognition/risk').then(res => {
      if (res.data && res.data.status !== 'MIGRATION_REQUIRED') {
        setUnifiedRisk(prev => ({ ...prev, ...res.data }));
      }
    }).catch(() => {});
  }, [session?.access_token, authState]);

  const hasCRM = integrationStatus?.canonical_truth?.crm_connected;
  const hasAccounting = integrationStatus?.canonical_truth?.accounting_connected;
  const hasEmail = integrationStatus?.canonical_truth?.email_connected ||
    (integrationStatus?.integrations || []).some(i => i.connected && ['email','outlook','gmail'].some(k => (i.category||'').toLowerCase().includes(k) || (i.provider||'').toLowerCase().includes(k)));
  const hasAnyIntegration = (integrationStatus?.canonical_truth?.total_connected || 0) > 0 || hasEmail;
  const integrationResolved = !integrationLoading && !!integrationStatus;

  const spofs = risk.spof || [];
  const regulatory = risk.regulatory || [];
  const concentration = risk.concentration || '';
  const runway = hasAccounting ? cap.runway : null;
  const slaBreaches = hasCRM ? exec.sla_breaches : null;
  const contradictions = alignment.contradictions || [];
  const hasPeopleData = hasEmail && (fv.capacity_index != null || fv.fatigue || fv.recommendation || fv.calendar);

  // Req 6: detect missing data (don't show "Low" when data doesn't exist)
  const hasRiskData = runway != null || slaBreaches != null || spofs.length > 0 || concentration || hasEmail;
  const compositeScore = unifiedRisk?.composite_risk_score;
  const compositeDisplay = compositeScore != null
    ? Math.round(compositeScore * 100) + '%'
    : 'Insufficient data';
  const compositeColor = compositeScore != null
    ? compositeScore > 0.6 ? '#EF4444' : compositeScore > 0.3 ? '#F59E0B' : '#10B981'
    : '#64748B';

  // Req 3: concentration as specific metric
  const topClientPct = rev.deals?.length > 0 ? (() => {
    const byCompany = {};
    rev.deals.forEach(d => { const co = d.company?.name || 'Unknown'; byCompany[co] = (byCompany[co]||0) + (parseFloat(d.amount)||0); });
    const total = Object.values(byCompany).reduce((s,v)=>s+v,0);
    const sorted = Object.entries(byCompany).sort((a,b)=>b[1]-a[1]);
    const top3 = sorted.slice(0,3).reduce((s,[,v])=>s+v,0);
    return total > 0 ? Math.round((top3/total)*100) : null;
  })() : null;

  const TABS = [
    { id: 'governance', label: 'Risk & Governance', icon: Shield },
    { id: 'workforce', label: 'Workforce Intelligence', icon: Users },
    { id: 'unified', label: 'Cross-Domain Risk', icon: Activity },
  ];

  // All risk categories (complete matrix)
  const RISK_CATEGORIES = [
    { id: 'financial', icon: DollarSign, color: '#FF6A00', title: 'Financial Risk', has: runway != null || !!concentration || !!cap.margin },
    { id: 'operational', icon: AlertTriangle, color: '#F59E0B', title: 'Operational Risk', has: slaBreaches != null || !!exec.bottleneck },
    { id: 'compliance', icon: Shield, color: '#8B5CF6', title: 'Compliance & Regulatory', has: regulatory.length > 0 },
    { id: 'market', icon: TrendingDown, color: '#3B82F6', title: 'Market Volatility', has: !!c.market_position?.volatility || !!c.market_position?.threats },
    { id: 'supplier', icon: Zap, color: '#EF4444', title: 'Supplier Dependency', has: spofs.length > 0 },
    { id: 'people', icon: Users, color: '#10B981', title: 'Workforce & Key-Person', has: spofs.length > 0 || hasPeopleData },
  ];

  const monitoredCount = RISK_CATEGORIES.filter((category) => category.has).length;
  const explainability = {
    whyVisible: hasAnyIntegration
      ? `BIQc is monitoring ${monitoredCount} of ${RISK_CATEGORIES.length} risk categories using your connected systems.`
      : 'Risk monitoring needs connected CRM, accounting, or email systems to score exposure reliably.',
    whyNow: compositeScore != null
      ? `Composite risk is ${Math.round(compositeScore * 100)}%, indicating current cross-domain pressure.`
      : 'Composite risk is unavailable because current evidence is incomplete.',
    nextAction: contradictions.length > 0
      ? 'Resolve the top alignment contradiction first, then review the linked operational and financial chain.'
      : 'Review the highest-risk category, assign owner + deadline, and document mitigation this week.',
    ifIgnored: hasRiskData
      ? 'Financial, operational, and workforce risks can cascade across domains and shorten your decision window.'
      : 'Low visibility can delay detection, turning manageable issues into urgent incidents.',
  };

  const actionOwnership = {
    owner: contradictions.length > 0 ? 'Founder + risk owner' : hasRiskData ? 'Risk owner' : 'Founder',
    deadline: compositeScore != null && compositeScore > 0.6 ? 'Next 24 hours' : 'By end of this week',
    checkpoint: contradictions[0]
      ? `Resolve contradiction in ${contradictions[0].domain || 'priority domain'} and confirm mitigation ownership.`
      : monitoredCount > 0
        ? `Close highest-risk category first (${RISK_CATEGORIES.find((c) => c.has)?.title || 'Risk category'}).`
        : 'Connect integrations to activate governance monitoring.',
    successMetric: `Composite risk ${compositeDisplay} · monitored categories ${monitoredCount}/${RISK_CATEGORIES.length}`,
  };

  const toConfidencePct = (raw) => {
    if (raw == null) return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n)) return undefined;
    return n > 0 && n <= 1 ? n * 100 : n;
  };
  const riskIntelLineage = unifiedRisk?.lineage ?? c?.lineage;
  const riskIntelFreshness = unifiedRisk?.data_freshness ?? c?.data_freshness;
  const riskIntelConfidence = toConfidencePct(unifiedRisk?.confidence_score ?? c?.confidence_score)
    ?? toConfidencePct(typeof c.system_state === 'object' ? c.system_state?.confidence : c.confidence_level);

  const riskPrioritySignals = [
    runway != null ? {
      id: 'risk-financial-runway',
      title: `Cash runway is ${runway} month${runway === 1 ? '' : 's'}`,
      detail: 'Liquidity pressure is real enough to watch before it compounds into people or delivery trade-offs.',
      action: 'Review overdue cash timing, committed spend, and the next decision deadline together.',
      source: 'Accounting',
      signalType: 'cash_runway',
      timestamp: c?.computed_at || null,
      severity: runway <= 3 ? 'high' : 'warning',
    } : null,
    hasPeopleData ? {
      id: 'risk-workforce-pressure',
      title: 'People pressure is visible in live communication signals',
      detail: fv.recommendation || fv.calendar || 'Workforce strain is starting to surface through calendar or email patterns.',
      action: 'Check key-person dependency and capacity before execution quality drops further.',
      source: 'Email/Calendar',
      signalType: 'workforce_pressure',
      timestamp: c?.computed_at || null,
      severity: 'warning',
    } : null,
    topClientPct != null ? {
      id: 'risk-concentration-top-clients',
      title: `${topClientPct}% of revenue sits in the top three clients`,
      detail: 'Commercial concentration means one delayed account can move the whole risk picture.',
      action: 'Review concentration and diversify near-term revenue coverage before the next review.',
      source: 'CRM',
      signalType: 'concentration_risk',
      timestamp: c?.computed_at || null,
      severity: topClientPct >= 60 ? 'high' : 'warning',
    } : null,
  ].filter(Boolean);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: fontFamily.body }} data-testid="risk-page">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Risk & Workforce Intelligence</h1>
            <p className="text-sm text-[#9FB0C3]">
              {integrationLoading && !integrationResolved ? 'Verifying connected systems and live risk signals…' : hasAnyIntegration ? `Monitoring ${RISK_CATEGORIES.filter(c => c.has).length} of ${RISK_CATEGORIES.length} risk categories with live data.` : 'Connect integrations to activate risk monitoring.'}
            </p>
          </div>
          <DataConfidence cognitive={cognitive} channelsData={integrationStatus} loading={integrationLoading && !integrationStatus} />
        </div>

        <InsightExplainabilityStrip
          whyVisible={explainability.whyVisible}
          whyNow={explainability.whyNow}
          nextAction={explainability.nextAction}
          ifIgnored={explainability.ifIgnored}
          testIdPrefix="risk-explainability"
        />

        <ActionOwnershipCard
          title="Risk response owner plan"
          owner={actionOwnership.owner}
          deadline={actionOwnership.deadline}
          checkpoint={actionOwnership.checkpoint}
          successMetric={actionOwnership.successMetric}
          testIdPrefix="risk-action-ownership"
        />

        <div className="flex flex-wrap items-center gap-2" data-testid="risk-lineage-badge">
          <LineageBadge lineage={riskIntelLineage} data_freshness={riskIntelFreshness} confidence_score={riskIntelConfidence} compact />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]" data-testid="risk-ux-main-grid">
          <div className="space-y-4" data-testid="risk-priority-column">
            <SectionLabel title="What could hurt the business first" detail="Risk is intentionally reduced to the few real exposures that can cascade across domains." testId="risk-priority-label" />
            <div className="grid gap-4 md:grid-cols-2" data-testid="risk-summary-metric-grid">
              <MetricCard label="Composite risk" value={compositeDisplay} caption="Cross-domain pressure from live signals" tone={compositeColor} testId="risk-composite-metric" />
              <MetricCard label="Monitored categories" value={`${monitoredCount}/${RISK_CATEGORIES.length}`} caption="Only categories with live evidence are counted" tone="#3B82F6" testId="risk-monitored-metric" />
              <MetricCard label="Cash runway" value={runway != null ? `${runway}m` : '—'} caption="Accounting-backed liquidity window" tone={runway != null && runway <= 3 ? '#EF4444' : '#10B981'} testId="risk-runway-metric" />
              <MetricCard label="Top 3 client share" value={topClientPct != null ? `${topClientPct}%` : '—'} caption="Commercial concentration in major accounts" tone={topClientPct != null && topClientPct >= 60 ? '#EF4444' : '#F59E0B'} testId="risk-concentration-metric" />
            </div>
            {riskPrioritySignals.length > 0 ? riskPrioritySignals.map((signal) => (
              <SignalCard key={signal.id} {...signal} testId={signal.id} />
            )) : (
              <EmptyStateCard title="Risk is quiet right now." detail="BIQc is not surfacing a material cross-domain risk in this cycle. That quiet state is intentional, not filler." testId="risk-priority-empty" />
            )}
          </div>

          <div className="space-y-4" data-testid="risk-guidance-column">
            <SurfaceCard testId="risk-reading-guidance-card">
              <SectionLabel title="How to use this page" detail="Start with the top card here, then use the deeper sections below only if you need the supporting chain or evidence." testId="risk-reading-guidance-label" />
              <div className="mt-4 space-y-3 text-sm text-[#CBD5E1]">
                <p data-testid="risk-reading-guidance-1">Finance remains tied to runway and concentration.</p>
                <p data-testid="risk-reading-guidance-2">People risk stays tied to live email and calendar strain signals.</p>
                <p data-testid="risk-reading-guidance-3">Propagation chains below are for investigation, not first-glance overload.</p>
              </div>
            </SurfaceCard>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }} data-testid="risk-tabs">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
              style={{ background: activeTab === tab.id ? '#FF6A0015' : 'transparent', color: activeTab === tab.id ? '#F4F7FA' : '#64748B', fontFamily: fontFamily.mono }}
              data-testid={`risk-tab-${tab.id}`}>
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {loading && <PageLoadingState message="Scanning risk signals…" />}
        {error && !loading && <PageErrorState error={error} onRetry={refresh} moduleName="Risk Intelligence" />}

        {/* ═══ GOVERNANCE TAB ═══ */}
        {!loading && activeTab === 'governance' && (
          <>
            {/* Req 1: Complete risk matrix — all categories, "Insufficient data" for missing */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
              {RISK_CATEGORIES.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 p-3 rounded-lg"
                  style={{ background: 'var(--biqc-bg-card)', border: `1px solid ${cat.has ? cat.color + '30' : '#1E2D3D'}` }}>
                  <cat.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: cat.has ? cat.color : '#4A5568' }} />
                  <div>
                    <p className="text-[10px] font-semibold" style={{ color: cat.has ? '#F4F7FA' : '#64748B', fontFamily: fontFamily.mono }}>{cat.title}</p>
                    <p className="text-[9px]" style={{ color: cat.has ? cat.color : '#4A5568', fontFamily: fontFamily.mono }}>
                      {cat.has ? 'Monitoring' : 'Insufficient data'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Financial Risk */}
            <RiskCategory icon={DollarSign} color="#FF6A00" title="Financial Risk"
              hasData={runway != null || !!concentration || !!cap.margin}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <RiskMeter value={runway != null ? (runway < 3 ? 90 : runway < 6 ? 60 : runway < 12 ? 30 : 10) : null}
                  label={runway != null ? `Cash Runway: ${runway}mo` : 'Cash Runway'}
                  insufficientData={runway == null} />
                {/* Req 3: specific concentration metric */}
                {(concentration || topClientPct != null) && (
                  <div className="p-3 rounded-lg sm:col-span-2" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                    <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Revenue Concentration Risk</span>
                    {topClientPct != null ? (
                      <>
                        <p className="text-sm font-semibold" style={{ color: topClientPct > 60 ? '#EF4444' : '#F59E0B', fontFamily: fontFamily.mono }}>
                          Top 3 clients = {topClientPct}% of pipeline
                        </p>
                        <p className="text-[11px] text-[#64748B] mt-0.5">
                          {topClientPct > 75 ? 'High concentration — losing one client would significantly impact revenue.' : topClientPct > 50 ? 'Moderate concentration — consider diversifying.' : 'Healthy spread across clients.'}
                        </p>
                        <Link to="/revenue" className="text-[10px] flex items-center gap-1 mt-1.5" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>
                          View client breakdown <ArrowRight className="w-3 h-3" />
                        </Link>
                      </>
                    ) : (
                      <p className="text-xs text-[#9FB0C3]">{concentration}</p>
                    )}
                  </div>
                )}
                {cap.margin && (
                  <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                    <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Margin</span>
                    <p className="text-xs text-[#9FB0C3]">{cap.margin}</p>
                  </div>
                )}
              </div>
              {!hasAccounting && (
                <div className="mt-3 flex items-center justify-between p-2.5 rounded-lg"
                  style={{ background: 'rgba(255,106,0,0.06)', border: '1px solid rgba(255,106,0,0.15)' }}>
                  <p className="text-[11px]" style={{ color: '#9FB0C3' }}>Connect Xero or MYOB for exact cash runway, margin % and cost structure.</p>
                  <Link to="/integrations?category=financial" className="text-[10px] flex items-center gap-1 ml-3 whitespace-nowrap" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>
                    Connect <Plug className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </RiskCategory>

            {/* Operational Risk */}
            <RiskCategory icon={AlertTriangle} color="#F59E0B" title="Operational Risk"
              hasData={slaBreaches != null || !!exec.bottleneck}>
              {slaBreaches != null && (
                <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                  <p className="text-xs font-semibold text-[#F4F7FA]">SLA Breaches: <span style={{ color: slaBreaches > 0 ? '#EF4444' : '#10B981' }}>{slaBreaches}</span></p>
                  <p className="text-[11px] text-[#64748B] mt-0.5">{slaBreaches === 0 ? 'No service commitment breaches this week.' : `${slaBreaches} commitment${slaBreaches > 1?'s':''} missed — review with your team.`}</p>
                </div>
              )}
              {exec.bottleneck && (
                <div className="p-3 rounded-lg mt-2" style={{ background: '#F59E0B08', border: '1px solid #F59E0B25' }}>
                  <p className="text-[10px] font-semibold text-[#F59E0B] mb-0.5" style={{ fontFamily: fontFamily.mono }}>Active Bottleneck</p>
                  <p className="text-xs text-[#9FB0C3]">{exec.bottleneck}</p>
                </div>
              )}
            </RiskCategory>

            {/* Req 2: Compliance — guidance + CTA */}
            <RiskCategory icon={Shield} color="#8B5CF6" title="Compliance & Regulatory"
              hasData={regulatory.length > 0}>
              {regulatory.length > 0 ? (
                <div className="space-y-2">
                  {regulatory.map((r, i) => (
                    <div key={i} className="p-3 rounded-lg" style={{ background: '#8B5CF608', border: '1px solid #8B5CF625' }}>
                      <p className="text-xs text-[#9FB0C3]">{r}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[#9FB0C3]">
                    BIQc monitors GST compliance, payroll obligations, contract renewals and regulatory deadlines — but only when the right data sources are connected.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { label: 'Accounting (Xero/MYOB)', icon: DollarSign, desc: 'GST, BAS, payroll compliance', cat: 'financial', connected: hasAccounting },
                      { label: 'HR Platform', icon: Users, desc: 'Award obligations, leave compliance', cat: 'hris', connected: false },
                      { label: 'CRM (HubSpot)', icon: Shield, desc: 'Contract renewals, SLA obligations', cat: 'crm', connected: hasCRM },
                    ].map(item => (
                      <div key={item.label} className="p-2.5 rounded-lg"
                        style={{ background: item.connected ? 'rgba(16,185,129,0.06)' : 'var(--biqc-bg)', border: `1px solid ${item.connected ? 'rgba(16,185,129,0.2)' : '#243140'}` }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          {item.connected ? <CheckCircle2 className="w-3 h-3 text-[#10B981]" /> : <XCircle className="w-3 h-3 text-[#64748B]" />}
                          <p className="text-[10px] font-semibold" style={{ color: item.connected ? '#10B981' : '#9FB0C3', fontFamily: fontFamily.mono }}>{item.label}</p>
                        </div>
                        <p className="text-[10px] text-[#64748B]">{item.desc}</p>
                        {!item.connected && (
                          <Link to={`/integrations?category=${item.cat}`} className="text-[9px] flex items-center gap-1 mt-1" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>
                            Connect <ArrowRight className="w-2.5 h-2.5" />
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </RiskCategory>

            {/* Market Volatility */}
            <RiskCategory icon={TrendingDown} color="#3B82F6" title="Market Volatility"
              hasData={!!c.market_position?.volatility || !!c.market_position?.threats} noCTA>
              {c.market_position?.volatility && <p className="text-xs text-[#9FB0C3]">{c.market_position.volatility}</p>}
            </RiskCategory>

            {/* Supplier Dependency */}
            <RiskCategory icon={Zap} color="#EF4444" title="Supplier Dependency"
              hasData={spofs.length > 0}>
              {spofs.length > 0 && (
                <div className="space-y-2">
                  {spofs.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-lg" style={{ background: '#EF444408', border: '1px solid #EF444425' }}>
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: '#EF4444' }} />
                      <p className="text-xs text-[#9FB0C3]">{s}</p>
                    </div>
                  ))}
                </div>
              )}
            </RiskCategory>

            {/* Alignment contradictions */}
            {contradictions.length > 0 && (
              <Panel>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown className="w-4 h-4 text-[#F59E0B]" />
                  <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Alignment Issues</h3>
                </div>
                <div className="space-y-2">
                  {contradictions.map((ct, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg" style={{ background: '#F59E0B08', border: '1px solid #F59E0B25' }}>
                      <p className="text-xs" style={{ color: '#F59E0B' }}>{ct}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </>
        )}

        {/* ═══ WORKFORCE INTELLIGENCE TAB ═══ */}
        {!loading && activeTab === 'workforce' && (
          <>
            {/* Req 4: Always show connection status + example metrics even when not connected */}
            <Panel>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#3B82F6]" />
                  <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Data Sources</h3>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Outlook / Gmail', desc: 'Response times, email stress, communication patterns', icon: Mail, connected: hasEmail, cat: 'email' },
                  { label: 'Google / Outlook Calendar', desc: 'Meeting load, available capacity, overcommitment risk', icon: Calendar, connected: hasEmail, cat: 'email' },
                ].map(src => (
                  <div key={src.label} className="flex items-start gap-3 p-3 rounded-lg"
                    style={{ background: src.connected ? 'rgba(16,185,129,0.06)' : 'var(--biqc-bg)', border: `1px solid ${src.connected ? 'rgba(16,185,129,0.2)' : '#243140'}` }}>
                    <src.icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: src.connected ? '#10B981' : '#64748B' }} />
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-semibold" style={{ color: src.connected ? '#10B981' : '#9FB0C3', fontFamily: fontFamily.mono }}>{src.label}</p>
                        {src.connected
                          ? <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', fontFamily: fontFamily.mono }}>Connected</span>
                          : <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: '#1E2D3D', color: '#64748B', fontFamily: fontFamily.mono }}>Not connected</span>
                        }
                      </div>
                      <p className="text-[10px] text-[#64748B]">{src.desc}</p>
                      {!src.connected && (
                        <Link to="/integrations?step=1" className="text-[9px] flex items-center gap-1 mt-1" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>
                          Connect <ArrowRight className="w-2.5 h-2.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Sample metrics when not connected */}
            {!hasEmail && (
              <Panel>
                <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Sample Insights — Unlock by Connecting Email & Calendar</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <ExampleMetric label="Avg Email Response Time" example="e.g. 4.2 hours (target: 2h)" color="#3B82F6" />
                  <ExampleMetric label="Meeting Load This Week" example="e.g. 14 meetings — above your avg of 9" color="#8B5CF6" />
                  <ExampleMetric label="Founder Fatigue Index" example="e.g. High — 3 consecutive 50h+ weeks" color="#EF4444" />
                  <ExampleMetric label="Key-Person Dependency" example="e.g. 73% of client comms via 1 person" color="#F59E0B" />
                  <ExampleMetric label="Unread Email Backlog" example="e.g. 47 unread — 8 from priority clients" color="#FF6A00" />
                  <ExampleMetric label="Calendar Availability" example="e.g. 6hrs free time next 5 business days" color="#10B981" />
                </div>
                <Link to="/integrations?step=1"
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
                  style={{ background: '#FF6A00', color: 'white', fontFamily: fontFamily.body }}>
                  <Plug className="w-4 h-4" /> Connect Email & Calendar to Unlock These Insights
                </Link>
              </Panel>
            )}

            {/* Real data when connected */}
            {hasPeopleData && (
              <>
                <Panel>
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-[#3B82F6]" />
                    <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Live Capacity & Communication Signals</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <RiskMeter value={fv.capacity_index} label="Capacity Utilisation" thresholds={[80, 100]} insufficientData={fv.capacity_index == null} />
                    <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                      <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Fatigue Level</span>
                      {fv.fatigue
                        ? <span className="text-xl font-bold" style={{ color: fv.fatigue === 'high' ? '#EF4444' : fv.fatigue === 'medium' ? '#F59E0B' : '#10B981', fontFamily: fontFamily.mono }}>{fv.fatigue}</span>
                        : <span className="text-xs italic text-[#64748B]">Insufficient data</span>
                      }
                    </div>
                    {fv.calendar && (
                      <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Meeting Load (Outlook)</span>
                        <p className="text-xs text-[#9FB0C3]">{fv.calendar}</p>
                      </div>
                    )}
                    {fv.email_stress && (
                      <div className="p-3 rounded-lg sm:col-span-2" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                        <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Email Stress Signal</span>
                        <p className="text-xs text-[#9FB0C3]">{fv.email_stress}</p>
                      </div>
                    )}
                  </div>
                </Panel>
                {fv.recommendation && (
                  <Panel>
                    <div className="flex items-start gap-3">
                      <Heart className="w-4 h-4 text-[#FF6A00] shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Workforce Advisory</h3>
                        <p className="text-xs text-[#9FB0C3] leading-relaxed">{fv.recommendation}</p>
                      </div>
                    </div>
                  </Panel>
                )}
              </>
            )}

            {hasEmail && !hasPeopleData && (
              <Panel className="text-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-[#10B981] mx-auto mb-2" />
                <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Processing workforce signals.</p>
                <p className="text-xs text-[#64748B]">BIQc is analysing communication patterns and calendar density. Check back shortly.</p>
              </Panel>
            )}
          </>
        )}

        {/* ═══ CROSS-DOMAIN RISK TAB ═══ */}
        {!loading && activeTab === 'unified' && (
          <>
            {/* Req 5: Acronym legend */}
            <div className="flex justify-end">
              <button onClick={() => setShowAcronymLegend(v => !v)}
                className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                style={{ color: '#64748B', fontFamily: fontFamily.mono, border: '1px solid #243140' }}>
                <Info className="w-3 h-3" /> {showAcronymLegend ? 'Hide' : 'What do RVI, EDS, CDR, ADS mean?'}
              </button>
            </div>

            {showAcronymLegend && (
              <Panel>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>Acronym Reference</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ACRONYMS.map(a => (
                    <div key={a.label} className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid #243140' }}>
                      <p className="text-xs font-bold mb-0.5" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>{a.label} — {a.title}</p>
                      <p className="text-[11px] text-[#9FB0C3]">{a.desc}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {unifiedRisk?.instability_indices && (
              <Panel>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#EF4444]" />
                    <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Instability Indices</h3>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: '#10B98115', color: '#10B981', fontFamily: fontFamily.mono }}>COGNITION CORE</span>
                </div>
                <div className="mb-3" data-testid="risk-lineage-badge-unified-panel">
                  <LineageBadge lineage={riskIntelLineage} data_freshness={riskIntelFreshness} confidence_score={riskIntelConfidence} compact />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {ACRONYMS.map(({ key: _, label, title, desc }) => {
                    const keyMap = { RVI: 'revenue_volatility_index', EDS: 'engagement_decay_score', CDR: 'cash_deviation_ratio', ADS: 'anomaly_density_score' };
                    const val = unifiedRisk.instability_indices[keyMap[label]];
                    const pct = val != null ? Math.round(val * 100) : null;
                    const ic = pct > 60 ? '#EF4444' : pct > 30 ? '#F59E0B' : '#10B981';
                    const c2 = 2 * Math.PI * 18;
                    const off = c2 * (1 - (pct || 0) / 100);
                    return (
                      <Tooltip key={label} text={`${label}: ${title}\n\n${desc}`}>
                        <div className="p-4 rounded-lg text-center cursor-help w-full" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                          <div className="relative w-12 h-12 mx-auto mb-2">
                            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 40 40">
                              <circle cx="20" cy="20" r="18" fill="none" stroke="#243140" strokeWidth="3.5" />
                              {pct != null && <circle cx="20" cy="20" r="18" fill="none" stroke={ic} strokeWidth="3.5" strokeDasharray={c2} strokeDashoffset={off} strokeLinecap="round" />}
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[10px] font-bold" style={{ color: pct != null ? ic : '#64748B', fontFamily: fontFamily.mono }}>
                                {pct != null ? pct + '%' : '—'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: pct != null ? ic : '#64748B', fontFamily: fontFamily.mono }}>{label}</span>
                            <Info className="w-3 h-3" style={{ color: '#4A5568' }} />
                          </div>
                          <p className="text-[9px] mt-0.5" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{title}</p>
                          {pct == null && <p className="text-[9px] italic" style={{ color: '#4A5568' }}>Insufficient data</p>}
                        </div>
                      </Tooltip>
                    );
                  })}
                </div>

                {/* Req 6: Composite score — "Insufficient data" not "Low" */}
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.display }}>Composite Risk Score</span>
                    <Tooltip text="Composite Risk Score combines RVI, EDS, CDR and ADS into a single risk rating. 'Insufficient data' means there is not yet enough connected data to compute a reliable score — this is not the same as Low risk.">
                      <Info className="w-3.5 h-3.5 cursor-help" style={{ color: '#4A5568' }} />
                    </Tooltip>
                  </div>
                  <span className="text-2xl font-bold" style={{ color: compositeColor, fontFamily: fontFamily.mono }}>
                    {compositeDisplay}
                  </span>
                </div>
              </Panel>
            )}

            {/* Req 7: Clickable propagation chains with drill-down */}
            {unifiedRisk?.propagation_map?.length > 0 && (
              <Panel>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                    <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Risk Propagation Analysis</h3>
                  </div>
                  <Tooltip text="Click any chain to see the underlying data driving that risk pathway and navigate to the relevant page.">
                    <span className="text-[10px] flex items-center gap-1 cursor-help" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
                      <Info className="w-3 h-3" /> Click to expand
                    </span>
                  </Tooltip>
                </div>
                <p className="text-[11px] text-[#64748B] mb-3">
                  These chains show how a risk in one area cascades to another. Click any row to see the contributing data and navigate to the detail view.
                </p>
                <div className="space-y-2">
                  {unifiedRisk.propagation_map.slice(0, 5).map((chain, i) => (
                    <PropagationChain key={i} chain={chain} cognitive={c} />
                  ))}
                </div>
              </Panel>
            )}

            {!unifiedRisk?.instability_indices && !unifiedRisk?.propagation_map && (
              <Panel className="text-center py-8">
                <Shield className="w-8 h-8 mx-auto mb-3" style={{ color: '#64748B' }} />
                <p className="text-sm font-semibold text-[#9FB0C3] mb-1" style={{ fontFamily: fontFamily.display }}>Cross-domain risk data not yet available.</p>
                <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                  Connect CRM, accounting and email to generate your cross-domain risk matrix. BIQc will then compute propagation chains and instability indices.
                </p>
                <Link to="/integrations" className="mt-4 inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                  style={{ background: '#FF6A00', fontFamily: fontFamily.body }}>
                  <Plug className="w-4 h-4" /> Connect Integrations
                </Link>
              </Panel>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default RiskPage;
