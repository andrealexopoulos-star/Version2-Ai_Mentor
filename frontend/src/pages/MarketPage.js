import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { CognitiveMesh } from '../components/LoadingSystems';
import EngagementScanCard from '../components/EngagementScanCard';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { isPrivilegedUser } from '../lib/privilegedUser';
import { apiClient, callEdgeFunction } from '../lib/api';
import { containsCRMClaim } from '../constants/integrationTruth';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { PageLoadingState } from '../components/PageStateComponents';
import { fontFamily } from '../design-system/tokens';
import {
  TrendingUp, ArrowRight, Target, Shield, AlertTriangle,
  Zap, CheckCircle2, Eye, ChevronDown, ChevronUp, Link2, RefreshCw,
  MessageSquare, FileText, Layers, Crosshair, Filter, BarChart3, Plug, Activity,
  Download, Clock, UserPlus, Calendar, Circle, PlayCircle, Loader2,
  Globe, Star, Search as SearchIcon
} from 'lucide-react';
import { EmptyStateCard, SectionLabel, SignalCard, SurfaceCard } from '../components/intelligence/SurfacePrimitives';
import LineageBadge from '../components/LineageBadge';


const Panel = ({ children, className = '', ...props }) => (
  <div className={`p-5 ${className}`} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl, 16px)', boxShadow: 'var(--elev-1, none)' }} {...props}>{children}</div>
);

const STATUS_MAP = {
  STABLE: { label: 'On Track', color: 'var(--positive)', bg: 'var(--positive-wash)', b: 'var(--positive)' },
  DRIFT: { label: 'Slipping', color: 'var(--warning)', bg: 'var(--warning-wash)', b: 'var(--warning)' },
  COMPRESSION: { label: 'Under Pressure', color: 'var(--lava)', bg: 'var(--lava-wash)', b: 'var(--lava)' },
  CRITICAL: { label: 'At Risk', color: 'var(--danger)', bg: 'var(--danger-wash)', b: 'var(--danger)' },
};

const GaugeMeter = ({ value, label, suffix = '%', thresholds = [30, 60, 80] }) => {
  const color = value >= thresholds[2] ? 'var(--positive)' : value >= thresholds[1] ? 'var(--warning)' : value >= thresholds[0] ? 'var(--lava)' : 'var(--danger)';
  return (
    <div className="p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg, 12px)' }}>
      <span className="text-[10px] block mb-1 uppercase" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-muted)' }}>{label}</span>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-bold" style={{ color, fontFamily: 'var(--font-mono)', fontSize: 'var(--size-mono-lg, 24px)' }}>{value != null ? value : '—'}</span>
        {value != null && <span className="text-xs mb-0.5" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>{suffix}</span>}
      </div>
      {value != null && (
        <div className="h-1.5 rounded-full mt-2" style={{ background: color + '20' }}>
          <div className="h-1.5 rounded-full transition-all" style={{ background: color, width: Math.min(value, 100) + '%' }} />
        </div>
      )}
    </div>
  );
};

const MarketPage = () => {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [channelsData, setChannelsData] = useState(null);
  const [gapsOpen, setGapsOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [activeTab, setActiveTab] = useState('intelligence');
  const [reports, setReports] = useState([]);
  const [watchtower, setWatchtower] = useState(null);
  const [pressure, setPressure] = useState(null);
  const [freshness, setFreshness] = useState(null);
  const [cognitionMarket, setCognitionMarket] = useState(null);
  const [enrichmentData, setEnrichmentData] = useState(null);
  const [actionItems, setActionItems] = useState([]);
  const [pdfGenerating, setPdfGenerating] = useState(null);
  const [seedingActions, setSeedingActions] = useState(false);
  const { status: integrationStatus } = useIntegrationStatus();

  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin' || isPrivilegedUser(user);

  useEffect(() => {
    apiClient.get('/snapshot/latest').then(res => {
      const snaps = [];
      if (res.data?.generated_at) {
        snaps.push({ type: 'Cognitive Snapshot', date: res.data.generated_at, data: res.data.cognitive });
      }
      setReports(snaps);
    }).catch(() => {});
    apiClient.get('/intelligence/watchtower')
      .then(res => { if (res.data) setWatchtower(res.data); })
      .catch((error) => setWatchtower({
        error: error?.response?.data?.detail || 'Canonical watchtower positions are unavailable.',
        events: [],
        positions: {},
      }));
    apiClient.get('/intelligence/pressure')
      .then(res => { if (res.data?.pressures) setPressure(res.data); })
      .catch((error) => setPressure({
        has_data: false,
        message: error?.response?.data?.detail || 'Canonical pressure calibration is unavailable.',
      }));
    apiClient.get('/intelligence/freshness')
      .then(res => { if (res.data?.freshness) setFreshness(res.data); })
      .catch((error) => setFreshness({
        has_data: false,
        message: error?.response?.data?.detail || 'Canonical evidence freshness is unavailable.',
      }));
    apiClient.get('/cognition/market').then(res => {
      if (res.data && res.data.status !== 'MIGRATION_REQUIRED') {
        setCognitionMarket(res.data);
      }
    }).catch(() => {});
    apiClient.get('/enrichment/latest').then(res => {
      if (res.data?.has_data) setEnrichmentData(res.data);
    }).catch(() => {});
    apiClient.get('/action-items').then(res => {
      if (res.data?.items) setActionItems(res.data.items);
    }).catch(() => {});
  }, []);

  const fetchSnapshot = useCallback(async () => {
    apiClient.get('/integrations/channels/status').then(res => {
      if (res.data?.channels) setChannelsData(res.data);
    }).catch(() => {});

    const results = await Promise.allSettled([
      apiClient.get('/snapshot/latest').then(r => r.data?.cognitive ? r.data.cognitive : Promise.reject('no data')),
      apiClient.get('/market-intelligence').then(r => r.data?.cognitive && r.data?.has_data ? r.data.cognitive : Promise.reject('no data')),
      (async () => {
        const d = await callEdgeFunction('biqc-insights-cognitive', {}, 45000);
        if (!d?.cognitive) throw new Error('no cognitive');
        return d.cognitive;
      })(),
    ]);
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) { setSnapshot(r.value); return; }
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await Promise.race([fetchSnapshot(), new Promise(r => setTimeout(r, 4000))]);
      setLoading(false);
    };
    init();
  }, [fetchSnapshot]);

  const c = snapshot || {};
  const stateStatus = typeof c.system_state === 'object' ? c.system_state?.status : c.system_state;
  const confidence = typeof c.system_state === 'object' ? c.system_state?.confidence : c.confidence_level;
  const interpretation = typeof c.system_state === 'object' ? c.system_state?.interpretation : null;
  const st = STATUS_MAP[stateStatus] || STATUS_MAP.STABLE;
  const memo = c.executive_memo || c.memo || '';
  const alignment = c.alignment?.narrative || '';
  const goalProb = c.market_intelligence?.probability_of_goal_achievement || c.probability_of_goal_achievement;
  const mi = c.market_intelligence || {};
  const ap = c.action_plan || {};
  const moves = ap.top_3_marketing_moves || [];
  const blindside = ap.primary_blindside_risk;
  const lever = ap.hidden_growth_lever;
  const hasCRM = integrationStatus?.canonical_truth?.crm_connected || channelsData?.channels?.some(ch => ch.key === 'crm' && ch.status === 'connected');
  const hasSignals = integrationStatus?.canonical_truth?.total_connected > 0;
  const pipeline = hasCRM ? (c.pipeline_total || c.revenue?.pipeline) : null;

  const filteredMoves = hasCRM ? moves : moves.filter(m => !containsCRMClaim(m.move) && !containsCRMClaim(m.rationale));
  const filteredBlindside = blindside && (!containsCRMClaim(blindside.risk) || hasCRM) ? blindside : null;
  const filteredLever = lever && (!containsCRMClaim(lever.lever) || hasCRM) ? lever : null;
  const filteredMemo = memo && (!containsCRMClaim(memo) || hasCRM) ? memo : '';
  const filteredAlignment = alignment && (!containsCRMClaim(alignment) || hasCRM) ? alignment : '';
  const marketSignals = Array.isArray(watchtower?.events) ? watchtower.events.filter((event) => {
    const text = `${event?.domain || ''} ${event?.signal || ''} ${event?.title || ''}`.toLowerCase();
    return /(market|competitor|demand|saturation|pricing|trend)/.test(text);
  }) : [];
  const watchtowerMessage = watchtower?.error || '';
  const pressureMessage = pressure?.message || '';
  const freshnessMessage = freshness?.message || '';
  const pressureAvailable = Boolean(pressure?.pressures && Object.keys(pressure.pressures).length > 0);
  const freshnessAvailable = Boolean(freshness?.freshness && Object.keys(freshness.freshness).length > 0);
  const watchtowerAvailable = Boolean(
    (!watchtower?.error && Array.isArray(watchtower?.events))
    || (watchtower?.positions && Object.keys(watchtower.positions).length > 0)
  );
  const marketPressureSummary = pressureAvailable
    ? Object.entries(pressure.pressures)
        .slice(0, 2)
        .map(([domain, value]) => `${domain}: ${value.level}`)
        .join(' · ')
    : null;
  const freshnessSummary = freshnessAvailable
    ? Object.entries(freshness.freshness)
        .filter(([, value]) => value.status !== 'no_data')
        .slice(0, 2)
        .map(([domain, value]) => `${domain}: ${value.status}`)
        .join(' · ')
    : null;
  const hasLiveMarketContext = Boolean(snapshot || cognitionMarket || watchtowerAvailable || pressureAvailable || freshnessAvailable);

  const toConfidencePct = (raw) => {
    if (raw == null) return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n)) return undefined;
    return n > 0 && n <= 1 ? n * 100 : n;
  };
  const marketIntelLineage = cognitionMarket?.lineage ?? c?.lineage;
  const marketIntelFreshness = cognitionMarket?.data_freshness ?? c?.data_freshness;
  const marketIntelConfidence = toConfidencePct(cognitionMarket?.confidence_score ?? c?.confidence_score)
    ?? toConfidencePct(typeof c.system_state === 'object' ? c.system_state?.confidence : c.confidence_level);

  const sendToChat = (msg) => setActionMessage(msg);

  const [showRecalibrateModal, setShowRecalibrateModal] = useState(false);
  const [recalForm, setRecalForm] = useState({ name: '', email: user?.email || '', message: '' });
  const [recalSubmitted, setRecalSubmitted] = useState(false);
  const [recalSubmitting, setRecalSubmitting] = useState(false);
  const [calibrationDate, setCalibrationDate] = useState(null);

  useEffect(() => {
    apiClient.get('/calibration/status').then(res => {
      if (res.data?.completed_at) setCalibrationDate(new Date(res.data.completed_at));
      else if (res.data?.status === 'COMPLETE') setCalibrationDate(new Date(Date.now() - 86400000));
    }).catch(() => {});
  }, []);

  const daysSinceCalibration = calibrationDate ? Math.floor((Date.now() - calibrationDate.getTime()) / 86400000) : null;
  const canRecalibrate = daysSinceCalibration !== null && daysSinceCalibration >= 30;

  const handleRecalSubmit = async (e) => {
    e.preventDefault();
    setRecalSubmitting(true);
    try {
      await apiClient.post('/contact/recalibration', {
        name: recalForm.name,
        email: recalForm.email,
        message: recalForm.message || 'I would like to recalibrate my business profile.',
        days_since_calibration: daysSinceCalibration,
      });
      setRecalSubmitted(true);
    } catch {
      setRecalSubmitted(true);
    } finally {
      setRecalSubmitting(false);
    }
  };

  // Deep Market Modeling data extraction
  const competitors = c.market?.competitors || mi.competitors || [];
  const saturationScore = mi.misalignment_index != null ? Math.max(0, 100 - mi.misalignment_index) : null;
  const demandCapture = mi.probability_of_goal_achievement || null;
  const positionVerdict = mi.positioning_verdict || stateStatus || null;

  // Enrichment data extraction
  const enr = enrichmentData?.enrichment || {};
  const swot = enr.swot || {};
  const cmoActions = enr.cmo_priority_actions || [];
  const cmoBrief = enr.cmo_executive_brief || '';
  const execSummary = enr.executive_summary || '';
  const competitorSwot = enr.competitor_swot || [];
  const marketPosition = enr.market_position || '';
  const seoAnalysis = enr.seo_analysis || {};
  const websiteHealth = enr.website_health || {};
  const socialAnalysis = enr.social_media_analysis || {};
  const paidMedia = enr.paid_media_analysis || {};
  const reviewAgg = enr.review_aggregation || {};
  const trustSignals = enr.trust_signals || [];
  const aeoStrategy = enr.aeo_strategy || [];
  const industryActions = enr.industry_action_items || [];
  const recommendedKeywords = enr.recommended_keywords || [];
  const customerReviews = enr.customer_review_intelligence || {};
  const staffReviews = enr.staff_review_intelligence || {};
  const scanTimestamp = enrichmentData?.scanned_at;
  const nextUpdate = enrichmentData?.next_update_available;
  const hasEnrichment = enrichmentData?.has_data;

  // Action item helpers
  const handleStatusChange = async (itemId, newStatus) => {
    try {
      await apiClient.patch(`/action-items/${itemId}`, { status: newStatus });
      setActionItems(prev => prev.map(it => it.id === itemId ? { ...it, status: newStatus } : it));
    } catch (err) { console.error('Failed to update action item:', err); }
  };
  const handleAssign = async (itemId, assignee) => {
    try {
      await apiClient.patch(`/action-items/${itemId}`, { assigned_to: assignee });
      setActionItems(prev => prev.map(it => it.id === itemId ? { ...it, assigned_to: assignee } : it));
    } catch (err) { console.error('Failed to assign action item:', err); }
  };
  const handleSeedActions = async () => {
    setSeedingActions(true);
    try {
      const res = await apiClient.post('/action-items/seed');
      if (res.data?.seeded) {
        const refreshed = await apiClient.get('/action-items');
        if (refreshed.data?.items) setActionItems(refreshed.data.items);
      }
    } catch (err) { console.error('Failed to seed actions:', err); }
    setSeedingActions(false);
  };
  const handleDownloadPdf = async (type) => {
    setPdfGenerating(type);
    try {
      const res = await apiClient.post(`/reports/${type}/pdf`);
      if (res.data?.pdf_url) {
        window.open(res.data.pdf_url, '_blank');
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || 'PDF generation failed.';
      console.error('PDF generation error:', detail);
      alert(detail);
    }
    setPdfGenerating(null);
  };

  const statusColors = { pending: 'var(--warning)', in_progress: 'var(--info)', done: 'var(--positive)' };
  const statusLabels = { pending: 'Pending', in_progress: 'In Progress', done: 'Done' };
  const statusCycle = { pending: 'in_progress', in_progress: 'done', done: 'pending' };
  const priorityColors = { urgent: 'var(--danger)', high: 'var(--lava)', medium: 'var(--warning)', low: 'var(--ink-muted)' };

  const TABS = [
    { id: 'intelligence', label: 'Focus', icon: Zap },
    { id: 'saturation', label: 'Saturation', icon: Layers },
    { id: 'demand', label: 'Demand', icon: Crosshair },
    { id: 'friction', label: 'Friction', icon: Filter },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  return (
    <DashboardLayout actionMessage={actionMessage} onActionConsumed={() => setActionMessage('')}>
      <div className="space-y-6 max-w-[1000px]" style={{ fontFamily: 'var(--font-ui)', overflowY: 'visible' }} data-testid="market-page">
        <style>{`@keyframes snapFade{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}@media(max-width:1100px){[data-testid="position-hero"]{grid-template-columns:1fr!important}[data-testid="position-hero"]>div:last-child{order:-1}}`}</style>

        {/* ═══ HEADER ═══ */}
        <div>
          <div className="text-[11px] uppercase mb-2" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--lava)' }}>{'— Market & position \u00b7 '}{loading ? 'Loading...' : 'Ready'}</div>
          <h1 className="font-medium" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: 'var(--ls-display, -0.035em)', lineHeight: 1.05 }}>You're <em style={{ fontStyle: 'italic', color: 'var(--lava)' }}>{hasLiveMarketContext ? st.label.toLowerCase() : 'calibrating'}</em>.</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>BIQc reads market signals periodically: competitor pricing, hiring, press, customer sentiment, and search intent in your category.</p>
        </div>

        {/* ═══ POSITION HERO ═══ */}
        {!loading && hasLiveMarketContext && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-2xl, 20px)', padding: 'var(--sp-8, 32px)', marginBottom: 'var(--sp-6, 24px)', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--sp-8, 32px)', alignItems: 'center', overflow: 'hidden', position: 'relative' }} data-testid="position-hero">
            {/* Left: Verdict */}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--lava)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)' }}>Market Position</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 5vw, 4rem)', color: 'var(--ink-display)', lineHeight: 1.05, letterSpacing: 'var(--ls-display, -0.035em)', margin: '12px 0 16px' }}>
                {stateStatus === 'STABLE' ? <>Holding <em style={{ color: 'var(--lava)', fontStyle: 'italic' }}>steady</em>.</> :
                 stateStatus === 'DRIFT' ? <>Starting to <em style={{ color: 'var(--lava)', fontStyle: 'italic' }}>drift</em>.</> :
                 stateStatus === 'COMPRESSION' ? <>Under <em style={{ color: 'var(--lava)', fontStyle: 'italic' }}>pressure</em>.</> :
                 stateStatus === 'CRITICAL' ? <>Position <em style={{ color: 'var(--lava)', fontStyle: 'italic' }}>at risk</em>.</> :
                 <>Position <em style={{ color: 'var(--lava)', fontStyle: 'italic' }}>calibrating</em>.</>}
              </div>
              <div style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)', fontSize: 15, lineHeight: 1.6, maxWidth: '50ch' }}>
                {interpretation || 'BIQc evaluates your market position using signal data from connected integrations, competitive intel, and business calibration.'}
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-6, 24px)', marginTop: 'var(--sp-6, 24px)', flexWrap: 'wrap' }}>
                {[
                  { label: 'Confidence', value: confidence ? `${confidence}%` : '—' },
                  { label: 'Data Sources', value: integrationStatus?.canonical_truth?.total_connected || '0' },
                  { label: 'Last Signal', value: snapshot?.last_updated ? new Date(snapshot.last_updated).toLocaleDateString() : '\u2014' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)' }}>{item.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-display)', fontFamily: 'var(--font-mono)' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: SVG Gauge */}
            <div style={{ position: 'relative', width: 240, height: 240, margin: '0 auto' }}>
              <svg width="100%" height="100%" viewBox="0 0 240 240" style={{ transform: 'rotate(-90deg)' }}>
                <defs>
                  <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--lava-warm)" />
                    <stop offset="100%" stopColor="var(--lava)" />
                  </linearGradient>
                </defs>
                <circle cx="120" cy="120" r="100" fill="none" stroke="var(--surface-sunken)" strokeWidth="14" />
                <circle cx="120" cy="120" r="100" fill="none" stroke="url(#gaugeGrad)" strokeWidth="14" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 100}
                  strokeDashoffset={2 * Math.PI * 100 * (1 - (confidence || 0) / 100)} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 64, lineHeight: 1, color: 'var(--ink-display)', letterSpacing: '-0.04em' }}>{confidence || '—'}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', marginTop: 4 }}>Position Score</span>
                <span style={{ fontSize: 13, color: 'var(--lava)', fontWeight: 600, marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {stateStatus === 'STABLE' ? '↑ Holding' : stateStatus === 'DRIFT' ? '↗ Drifting' : stateStatus === 'COMPRESSION' ? '↘ Under Pressure' : stateStatus === 'CRITICAL' ? '↓ At Risk' : '— Calibrating'}
                </span>
              </div>
            </div>
          </div>
        )}

        {loading && <PageLoadingState message="Pulling your latest market signals…" />}

        {!loading && <>

        {/* ═══ STATUS BANNER ═══ */}
        <div className="p-6" style={{ background: st.bg, border: `1px solid ${st.b}`, borderRadius: 'var(--r-xl, 16px)', animation: 'snapFade 0.5s ease-out' }} data-testid="status-banner">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: st.color, boxShadow: `0 0 12px ${st.color}50` }} />
              <span className="text-lg font-bold" style={{ color: st.color, fontFamily: 'var(--font-display)' }}>{hasLiveMarketContext ? st.label : 'Waiting for data'}</span>
            </div>
            <div className="flex items-center gap-2">
                {confidence && <span className="text-xs px-2 py-0.5" style={{ color: st.color, background: st.bg, fontFamily: 'var(--font-mono)', borderRadius: 'var(--r-pill, 100px)' }}>{confidence}% confidence</span>}
              <button onClick={() => { setLoading(true); fetchSnapshot().finally(() => setLoading(false)); }} className="p-1.5 rounded-lg hover:bg-[var(--surface-tint)]" data-testid="market-refresh">
                <RefreshCw className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
              </button>
              {canRecalibrate && (
                <button
                  onClick={() => setShowRecalibrateModal(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: 'var(--info-wash)', color: 'var(--info)', border: '1px solid var(--info)' }}
                  data-testid="recalibrate-btn"
                >
                  <RefreshCw className="w-3 h-3" /> Recalibrate
                </button>
              )}
            </div>
          </div>
          {interpretation && <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{interpretation}</p>}
          {!hasLiveMarketContext && <p className="text-sm" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>Connect your tools and complete calibration to see where your business stands.</p>}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]" data-testid="market-ux-main-grid">
          <div className="space-y-4" data-testid="market-external-column">
            <SectionLabel title="External market signals" detail="This column is reserved for forces outside your business — competitor movement, demand changes, and market pressure." testId="market-external-label" />
            {marketSignals.length > 0 ? marketSignals.slice(0, 3).map((signal, index) => (
              <SignalCard
                key={signal.id || `market-signal-${index}`}
                title={signal.title || 'External market signal'}
                detail={signal.detail || signal.description || 'A market-facing signal is active in the latest watchtower cycle.'}
                action={signal.recommendation || signal.action || 'Review this external signal before adjusting internal spend or positioning.'}
                source="Market Feed"
                signalType={signal.signal || signal.event || 'market_signal'}
                timestamp={signal.created_at}
                severity={signal.severity === 'high' ? 'high' : signal.severity === 'critical' ? 'critical' : 'warning'}
                testId={`market-external-signal-${index}`}
              />
            )) : (
              <EmptyStateCard
                title={watchtowerMessage ? 'Canonical watchtower feed is unavailable.' : (watchtowerAvailable ? 'No external market alert is active.' : 'External market feed is still warming up.')}
                detail={watchtowerMessage || (watchtowerAvailable
                  ? 'The market feed is calm right now. BIQc will keep external signals separate from your internal channel performance so the next move stays clear.'
                  : 'Market watchtower positions exist in the platform, but no market-classified signal is active in the current cycle.')}
                testId="market-external-empty"
              />
            )}
          </div>

          <div className="space-y-4" data-testid="market-internal-column">
            <SurfaceCard testId="market-evidence-health-card">
              <SectionLabel title="Evidence health" detail="Pressure and freshness indicate whether the market story is grounded in enough current evidence." testId="market-evidence-health-label" />
              <div className="mt-4 space-y-3" data-testid="market-evidence-health-list">
                <div className="rounded-xl border px-3 py-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} data-testid="market-pressure-status">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-secondary)]" style={{ fontFamily: 'var(--font-mono)' }}>Pressure calibration</p>
                  <p className="mt-2 text-sm" style={{ color: 'var(--ink-secondary)' }}>{pressureAvailable ? `Pressure data available: ${marketPressureSummary || 'signal mix detected for this cycle.'}` : (pressureMessage || 'Pressure calibration is not available yet.')}</p>
                </div>
                <div className="rounded-xl border px-3 py-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} data-testid="market-freshness-status">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-secondary)]" style={{ fontFamily: 'var(--font-mono)' }}>Evidence freshness</p>
                  <p className="mt-2 text-sm" style={{ color: 'var(--ink-secondary)' }}>{freshnessAvailable ? `Freshness scoring active: ${freshnessSummary || 'recent evidence is now available.'}` : (freshnessMessage || 'Evidence freshness is not available yet.')}</p>
                  <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }} data-testid="market-lineage-badge-evidence">
                    <LineageBadge lineage={marketIntelLineage} data_freshness={marketIntelFreshness} confidence_score={marketIntelConfidence} compact />
                  </div>
                </div>
                <div className="rounded-xl border px-3 py-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} data-testid="market-channel-separation-note">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-secondary)]" style={{ fontFamily: 'var(--font-mono)' }}>Scan status</p>
                  {scanTimestamp ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--ink-secondary)' }}><Clock className="w-3 h-3" style={{ color: 'var(--ink-muted)' }} /> Last scan: {new Date(scanTimestamp).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      {nextUpdate && <p className="text-[10px]" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>Next update: {new Date(nextUpdate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm" style={{ color: 'var(--ink-secondary)' }}>Complete calibration to generate your scan data.</p>
                  )}
                </div>
              </div>
            </SurfaceCard>
          </div>
        </div>

        {/* ═══ INTERNAL CHANNEL PERFORMANCE STRIP ═══ */}
        {(() => {
          const footprint = c?.digital_footprint || {};
          const hasFootprint = footprint.score != null;
          const hasMarketing = channelsData?.channels?.some(ch => ch.status === 'connected' && ['google_ads', 'meta_ads', 'linkedin', 'analytics', 'email_platform', 'marketing'].includes(ch.key));
          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Digital Footprint', value: footprint.score, unit: '/100', color: 'var(--lava)', icon: BarChart3, desc: 'Internal channel strength, not external market demand.' },
                { label: 'Social Engagement', value: footprint.social_score, unit: '/100', color: 'var(--info)', icon: MessageSquare, desc: 'Internal audience response across owned and social channels.' },
                { label: 'SEO Visibility', value: footprint.seo_score, unit: '/100', color: 'var(--positive)', icon: Eye, desc: 'Owned-search discoverability for your business.' },
                { label: 'Content Authority', value: footprint.content_score, unit: '/100', color: 'var(--ink-secondary)', icon: FileText, desc: 'Content depth and authority inside your current channel footprint.' },
              ].map(metric => (
                <div key={metric.label} className="p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg, 12px)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-muted)' }}>{metric.label}</span>
                    <metric.icon className="w-3.5 h-3.5" style={{ color: metric.color }} />
                  </div>
                  {hasFootprint && metric.value != null
                    ? <>
                        <span className="text-2xl font-bold" style={{ color: metric.color, fontFamily: 'var(--font-mono)', fontSize: 'var(--size-mono-lg, 24px)' }}>{metric.value}</span>
                        <span className="text-xs ml-0.5" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>{metric.unit}</span>
                        <div className="h-1 rounded-full mt-2" style={{ background: metric.color + '20' }}>
                          <div style={{ width: `${metric.value}%`, height: '100%', borderRadius: 4, background: metric.color, transition: 'width 1s ease' }} />
                        </div>
                      </>
                    : <span className="text-xs italic" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                        {hasMarketing ? 'Signal still calibrating…' : 'Connect marketing tools'}
                      </span>
                  }
                </div>
              ))}
            </div>
          );
        })()}

        {/* ═══ TAB NAVIGATION ═══ */}
        <div className="flex gap-1 p-1 overflow-x-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg, 12px)' }} data-testid="market-tabs">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors shrink-0`}
              style={{ background: activeTab === tab.id ? 'var(--lava-wash)' : 'transparent', color: activeTab === tab.id ? 'var(--ink-display)' : 'var(--ink-muted)', fontFamily: 'var(--font-mono)', borderRadius: 'var(--r-md, 8px)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', fontSize: 11 }}
              data-testid={`tab-${tab.id}`}>
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════ */}
        {/* ═══ INTELLIGENCE TAB (existing) ═══ */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'intelligence' && <>
          {/* EXECUTIVE BRIEF — top of page per user request */}
          {filteredMemo && (
            <Panel data-testid="brief-section">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2"><Zap className="w-3.5 h-3.5" style={{ color: 'var(--lava)' }} /><h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Executive Brief</h2></div>
                <span className="text-[9px] px-2 py-0.5" style={{ background: 'var(--lava-wash)', color: 'var(--lava)', fontFamily: 'var(--font-mono)', borderRadius: 'var(--r-pill, 100px)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)' }}>MARKET INTELLIGENCE</span>
              </div>
              <div className="mb-2" data-testid="market-lineage-badge-brief">
                <LineageBadge lineage={marketIntelLineage} data_freshness={marketIntelFreshness} confidence_score={marketIntelConfidence} compact />
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{filteredMemo.substring(0, 400)}{filteredMemo.length > 400 ? '...' : ''}</p>
              <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-[10px]" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>Full reports available under Governance → Reports</span>
                <button onClick={() => navigate('/reports')} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded hover:bg-[var(--surface-tint)] transition-colors" style={{ color: 'var(--lava)', fontFamily: 'var(--font-mono)' }}>
                  View Reports <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </Panel>
          )}
          {filteredMoves.length > 0 && (
            <div style={{ animation: 'snapFade 0.6s ease-out' }} data-testid="focus-section">
              <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', letterSpacing: 'var(--ls-display, -0.035em)' }}>What To Focus On Next</h2>
              <div className="space-y-3">
                {filteredMoves.map((m, i) => (
                  <div key={i} className="p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl, 16px)' }}>
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-bold mt-0.5" style={{ fontFamily: 'var(--font-mono)', color: 'var(--lava)' }}>#{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>{m.move}</p>
                        <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{m.rationale}</p>
                        <div className="flex flex-wrap gap-3">
                          {m.expected_impact && <span className="text-[11px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--positive)' }}>{m.expected_impact}</span>}
                          {m.confidence != null && <span className="text-[11px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>{m.confidence}% confidence</span>}
                          {m.urgency && <span className="text-[11px] px-2 py-0.5" style={{ color: m.urgency === 'immediate' ? 'var(--danger)' : 'var(--warning)', background: m.urgency === 'immediate' ? 'var(--danger-wash)' : 'var(--warning-wash)', fontFamily: 'var(--font-mono)', borderRadius: 'var(--r-pill, 100px)' }}>{m.urgency?.replace('_', ' ')}</span>}
                        </div>
                        <button onClick={() => sendToChat(`Help me execute: ${m.move}. ${m.rationale}`)}
                          className="flex items-center gap-1.5 mt-3 text-[11px] px-3 py-1.5 transition-colors hover:bg-[var(--lava-wash)]"
                          style={{ color: 'var(--lava)', border: '1px solid var(--lava)33', fontFamily: 'var(--font-mono)', borderRadius: 'var(--r-lg, 12px)' }}
                          data-testid={`execute-move-${i}`}>
                          <MessageSquare className="w-3 h-3" /> Execute in Chat
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {(ap.probability_shift_if_executed || ap.probability_shift_if_ignored) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  {ap.probability_shift_if_executed != null && (
                    <div className="p-4 text-center" style={{ background: 'var(--positive-wash)', border: '1px solid var(--positive)', borderRadius: 'var(--r-lg, 12px)' }}>
                      <span className="text-[11px] block mb-1 uppercase" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-muted)' }}>If you act</span>
                      <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--positive)', fontSize: 'var(--size-mono-lg, 24px)' }}>+{ap.probability_shift_if_executed}%</span>
                    </div>
                  )}
                  {ap.probability_shift_if_ignored != null && (
                    <div className="p-4 text-center" style={{ background: 'var(--danger-wash)', border: '1px solid var(--danger)', borderRadius: 'var(--r-lg, 12px)' }}>
                      <span className="text-[11px] block mb-1 uppercase" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-muted)' }}>If you don't</span>
                      <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--danger)', fontSize: 'var(--size-mono-lg, 24px)' }}>-{Math.abs(ap.probability_shift_if_ignored)}%</span>
                    </div>
                  )}
                  {ap.decision_window_pressure && (
                    <div className="p-4 text-center" style={{ background: 'var(--warning-wash)', border: '1px solid var(--warning)', borderRadius: 'var(--r-lg, 12px)' }}>
                      <span className="text-[11px] block mb-1 uppercase" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-muted)' }}>Time to act</span>
                      <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--warning)', fontSize: 'var(--size-mono-lg, 24px)' }}>{ap.decision_window_pressure.window_days}d</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {filteredMoves.length === 0 && snapshot && (
            <Panel><p className="text-sm text-[var(--ink-secondary)]">Complete forensic calibration and connect integrations to unlock personalised action priorities.</p></Panel>
          )}
          {filteredBlindside && (
            <div className="p-5" style={{ background: 'var(--danger-wash)', border: '1px solid var(--danger)', borderRadius: 'var(--r-xl, 16px)' }} data-testid="risk-section">
              <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4" style={{ color: 'var(--danger)' }} /><h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Biggest Risk Right Now</h2></div>
              <p className="text-sm mb-2" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}>{filteredBlindside.risk}</p>
              {filteredBlindside.evidence && <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{filteredBlindside.evidence}</p>}
              {filteredBlindside.prevention_action && <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--positive)' }}>What to do: {filteredBlindside.prevention_action}</p>}
            </div>
          )}
          {filteredLever && (
            <div className="p-5" style={{ background: 'var(--positive-wash)', border: '1px solid var(--positive)', borderRadius: 'var(--r-xl, 16px)' }} data-testid="opportunity-section">
              <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4" style={{ color: 'var(--positive)' }} /><h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Growth Opportunity You're Missing</h2></div>
              <p className="text-sm mb-2" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}>{filteredLever.lever}</p>
              {filteredLever.evidence && <p className="text-xs mb-2" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{filteredLever.evidence}</p>}
              {filteredLever.potential_value && <span className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--positive)' }}>Potential: {filteredLever.potential_value}</span>}
            </div>
          )}
          {(goalProb != null || filteredAlignment) && (
            <Panel data-testid="track-section">
              <h2 className="text-sm font-semibold mb-3" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Are You On Track?</h2>
              {goalProb != null && <div className="flex items-center gap-4 mb-3"><span className="text-3xl font-bold" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--size-mono-lg, 30px)', color: goalProb > 60 ? 'var(--positive)' : 'var(--warning)' }}>{goalProb}%</span><span className="text-sm" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>chance of hitting your goals</span></div>}
              {filteredAlignment && <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{filteredAlignment}</p>}
            </Panel>
          )}
          <GapsSection channelsData={channelsData} hasCRM={hasCRM} pipeline={pipeline} gapsOpen={gapsOpen} setGapsOpen={setGapsOpen} navigate={navigate} />

          {/* ═══ SWOT ANALYSIS ═══ */}
          {hasEnrichment && (swot.strengths?.length > 0 || swot.weaknesses?.length > 0 || swot.opportunities?.length > 0 || swot.threats?.length > 0) && (
            <div data-testid="swot-section" style={{ animation: 'snapFade 0.6s ease-out' }}>
              <h2 className="text-lg font-semibold mb-4" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display)' }}>SWOT Analysis</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'strengths', label: 'Strengths', color: 'var(--positive)', icon: CheckCircle2 },
                  { key: 'weaknesses', label: 'Weaknesses', color: 'var(--danger)', icon: AlertTriangle },
                  { key: 'opportunities', label: 'Opportunities', color: 'var(--info)', icon: TrendingUp },
                  { key: 'threats', label: 'Threats', color: 'var(--warning)', icon: Shield },
                ].map(q => {
                  const items = swot[q.key] || [];
                  const QIcon = q.icon;
                  return (
                    <div key={q.key} className="rounded-xl p-4" style={{ background: 'var(--biqc-bg-card)', border: `1px solid ${q.color}20` }}>
                      <div className="flex items-center gap-2 mb-3">
                        <QIcon className="w-4 h-4" style={{ color: q.color }} />
                        <span className="text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: fontFamily.display }}>{q.label}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: q.color + '15', color: q.color, fontFamily: fontFamily.mono }}>{items.length}</span>
                      </div>
                      <div className="space-y-2">
                        {items.map((item, i) => (
                          <p key={i} className="text-xs leading-relaxed flex items-start gap-2" style={{ color: 'var(--ink-secondary)' }}>
                            <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: q.color }} />
                            {item.length > 150 ? item.substring(0, 147) + '...' : item}
                          </p>
                        ))}
                        {items.length === 0 && <p className="text-[10px] italic" style={{ color: 'var(--ink-muted)' }}>No data available</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ CMO PRIORITY ACTIONS (Interactive) ═══ */}
          {hasEnrichment && cmoActions.length > 0 && (
            <div data-testid="cmo-actions-section" style={{ animation: 'snapFade 0.6s ease-out' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--ink-display)', fontFamily: fontFamily.display }}>CMO Priority Actions</h2>
                {cmoBrief && <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'var(--lava-wash)', color: 'var(--lava)', fontFamily: fontFamily.mono }}>FROM SCAN</span>}
              </div>
              <div className="space-y-2">
                {cmoActions.map((action, i) => {
                  const tracked = actionItems.find(it => it.source === 'cmo' && it.title === action);
                  return (
                    <div key={i} className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
                      <span className="text-sm font-bold mt-0.5 shrink-0" style={{ color: 'var(--lava)', fontFamily: fontFamily.mono }}>#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-display)' }}>{action}</p>
                        {tracked && (
                          <div className="flex items-center gap-2 mt-2">
                            <button onClick={() => handleStatusChange(tracked.id, statusCycle[tracked.status])}
                              className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors"
                              style={{ background: statusColors[tracked.status] + '15', color: statusColors[tracked.status], fontFamily: fontFamily.mono }}>
                              <Circle className="w-2.5 h-2.5" /> {statusLabels[tracked.status]}
                            </button>
                            {tracked.due_date && <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--ink-muted)', fontFamily: fontFamily.mono }}><Calendar className="w-2.5 h-2.5" /> {new Date(tracked.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>}
                            {tracked.assigned_to && <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--ink-muted)', fontFamily: fontFamily.mono }}><UserPlus className="w-2.5 h-2.5" /> {tracked.assigned_to}</span>}
                            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: priorityColors[tracked.priority] + '15', color: priorityColors[tracked.priority], fontFamily: fontFamily.mono }}>{tracked.priority}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {actionItems.filter(it => it.source === 'cmo').length === 0 && (
                <button onClick={handleSeedActions} disabled={seedingActions}
                  className="flex items-center gap-2 mt-3 text-xs px-4 py-2 rounded-lg transition-colors"
                  style={{ background: 'var(--lava-wash)', color: 'var(--lava)', border: '1px solid var(--lava)', opacity: seedingActions ? 0.6 : 1, fontFamily: fontFamily.mono }}>
                  {seedingActions ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlayCircle className="w-3 h-3" />}
                  {seedingActions ? 'Generating...' : 'Generate 90-Day Action Plan'}
                </button>
              )}
            </div>
          )}

          {/* ═══ INDUSTRY ACTION ITEMS ═══ */}
          {hasEnrichment && industryActions.length > 0 && (
            <Panel data-testid="industry-actions-section">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-3.5 h-3.5" style={{ color: 'var(--info)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: fontFamily.display }}>Industry-Specific Actions</h3>
              </div>
              <div className="space-y-2">
                {industryActions.map((action, i) => (
                  <p key={i} className="text-xs leading-relaxed flex items-start gap-2" style={{ color: 'var(--ink-secondary)' }}>
                    <span className="text-[10px] font-bold mt-0.5 shrink-0" style={{ color: 'var(--info)', fontFamily: fontFamily.mono }}>{i + 1}.</span>
                    {action}
                  </p>
                ))}
              </div>
            </Panel>
          )}

          {/* ═══ 90-DAY ACTION PLAN TIMELINE ═══ */}
          {actionItems.length > 0 && (
            <div data-testid="action-plan-timeline" style={{ animation: 'snapFade 0.6s ease-out' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--ink-display)', fontFamily: fontFamily.display }}>90-Day Action Plan</h2>
                <span className="text-[10px]" style={{ color: 'var(--ink-muted)', fontFamily: fontFamily.mono }}>
                  {actionItems.filter(it => it.status === 'done').length}/{actionItems.length} complete
                </span>
              </div>
              <div className="space-y-2">
                {actionItems.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')).map(item => (
                  <div key={item.id} className="rounded-lg p-3 flex items-center gap-3" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', opacity: item.status === 'done' ? 0.6 : 1 }}>
                    <button onClick={() => handleStatusChange(item.id, statusCycle[item.status])}
                      className="w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors"
                      style={{ borderColor: statusColors[item.status], background: item.status === 'done' ? statusColors.done : 'transparent' }}>
                      {item.status === 'done' && <CheckCircle2 className="w-3 h-3 text-[var(--ink-inverse)]" />}
                      {item.status === 'in_progress' && <div className="w-2 h-2 rounded-full" style={{ background: statusColors.in_progress }} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs truncate ${item.status === 'done' ? 'line-through' : ''}`} style={{ color: 'var(--ink-display)' }}>{item.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: priorityColors[item.priority] + '15', color: priorityColors[item.priority], fontFamily: fontFamily.mono }}>{item.priority}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-sunken)', color: 'var(--ink-muted)', fontFamily: fontFamily.mono }}>{item.source.replace('_', ' ')}</span>
                        {item.due_date && <span className="text-[9px]" style={{ color: 'var(--ink-muted)', fontFamily: fontFamily.mono }}>{new Date(item.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>}
                      </div>
                    </div>
                    {item.assigned_to ? (
                      <span className="text-[9px] shrink-0" style={{ color: 'var(--ink-muted)', fontFamily: fontFamily.mono }}>{item.assigned_to}</span>
                    ) : (
                      <button onClick={() => { const name = prompt('Assign to (name or email):'); if (name) handleAssign(item.id, name); }}
                        className="text-[9px] shrink-0 transition-colors" style={{ color: 'var(--ink-muted)', fontFamily: fontFamily.mono }}>
                        <UserPlus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>}

        {/* ═══════════════════════════════════════════════════ */}
        {/* ═══ SATURATION ANALYSIS TAB (NEW) ═══ */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'saturation' && (
          <div className="space-y-6" data-testid="saturation-tab">
            <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', letterSpacing: 'var(--ls-display, -0.035em)' }}>Market Saturation Analysis</h2>
            <p className="text-xs" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>How crowded is your market and where do you stand relative to competitors.</p>
            {marketPosition && (
              <Panel className="mt-3" data-testid="market-position-statement">
                <div className="flex items-center gap-2 mb-2"><Globe className="w-3.5 h-3.5" style={{ color: 'var(--info)' }} /><span className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)' }}>Market Position</span></div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>{marketPosition}</p>
                {scanTimestamp && <p className="text-[9px] mt-2" style={{ color: 'var(--ink-muted)', fontFamily: fontFamily.mono }}>Last scanned: {new Date(scanTimestamp).toLocaleDateString('en-AU')}</p>}
              </Panel>
            )}

            {!snapshot && !watchtower ? (
              <Panel className="text-center py-10">
                <Layers className="w-8 h-8 text-[var(--ink-muted)] mx-auto mb-3" />
                <p className="text-sm mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Complete calibration to unlock saturation analysis.</p>
                <p className="text-xs mb-4" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>BIQc needs your business context to assess market density, positioning, and competitive pressure.</p>
                <button onClick={() => navigate('/market/calibration')} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[var(--ink-inverse)]" style={{ background: 'var(--info)' }} data-testid="saturation-calibrate-cta">
                  <Eye className="w-4 h-4" /> Start Calibration
                </button>
              </Panel>
            ) : (
              <>
                {/* Saturation Score */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <GaugeMeter value={saturationScore} label="Market Position Score" suffix="/100" thresholds={[25, 50, 75]} />
                  <GaugeMeter value={demandCapture} label="Demand Capture Rate" suffix="%" thresholds={[30, 50, 70]} />
                  <div className="p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg, 12px)' }}>
                    <span className="text-[10px] block mb-1 uppercase" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-muted)' }}>Position Verdict</span>
                    <span className="text-xl font-bold" style={{ color: positionVerdict === 'STABLE' ? 'var(--positive)' : positionVerdict === 'DRIFT' ? 'var(--warning)' : 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
                      {positionVerdict || '—'}
                    </span>
                  </div>
                </div>

                {/* Competitor Density */}
                <Panel>
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-4 h-4" style={{ color: 'var(--info)' }} />
                    <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Competitive Landscape</h3>
                  </div>
                  {competitors.length > 0 ? (
                    <div className="space-y-2">
                      {competitors.map((comp, i) => (
                        <div key={i} className="flex items-center gap-3 p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg, 12px)' }}>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--info)' }} />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm block truncate" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>{comp.name}</span>
                            {comp.signal && <p className="text-[10px] mt-0.5" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>{comp.signal}</p>}
                          </div>
                          {comp.threat_level && <span className="text-[10px] px-2 py-0.5" style={{ color: comp.threat_level === 'high' ? 'var(--danger)' : 'var(--warning)', background: comp.threat_level === 'high' ? 'var(--danger-wash)' : 'var(--warning-wash)', fontFamily: 'var(--font-mono)', borderRadius: 'var(--r-pill, 100px)' }}>{comp.threat_level}</span>}
                        </div>
                      ))}
                    </div>
                  ) : competitorSwot.length > 0 ? (
                    <div className="space-y-3">
                      {competitorSwot.slice(0, 5).map((comp, i) => (
                        <div key={i} className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium" style={{ color: 'var(--ink-display)', fontFamily: fontFamily.display }}>{comp.name}</span>
                            {comp.threat_level && <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: comp.threat_level === 'high' ? 'var(--danger)' : comp.threat_level === 'medium' ? 'var(--warning)' : 'var(--positive)', background: comp.threat_level === 'high' ? 'var(--danger-wash)' : comp.threat_level === 'medium' ? 'var(--warning-wash)' : 'var(--positive-wash)', fontFamily: fontFamily.mono }}>{comp.threat_level} threat</span>}
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div>
                              <p className="text-[9px] uppercase mb-1" style={{ color: 'var(--positive)', fontFamily: fontFamily.mono }}>Strengths</p>
                              {(comp.strengths || []).slice(0, 2).map((s, j) => <p key={j} className="text-[10px] leading-snug" style={{ color: 'var(--ink-secondary)' }}>{s.length > 80 ? s.substring(0, 77) + '...' : s}</p>)}
                            </div>
                            <div>
                              <p className="text-[9px] uppercase mb-1" style={{ color: 'var(--danger)', fontFamily: fontFamily.mono }}>Weaknesses</p>
                              {(comp.weaknesses || []).slice(0, 2).map((w, j) => <p key={j} className="text-[10px] leading-snug" style={{ color: 'var(--ink-secondary)' }}>{w.length > 80 ? w.substring(0, 77) + '...' : w}</p>)}
                            </div>
                          </div>
                          {comp.opportunities_against_them?.length > 0 && (
                            <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--biqc-border)' }}>
                              <p className="text-[9px] uppercase mb-1" style={{ color: 'var(--info)', fontFamily: fontFamily.mono }}>Your opportunities against them</p>
                              {comp.opportunities_against_them.slice(0, 1).map((o, j) => <p key={j} className="text-[10px] leading-snug" style={{ color: 'var(--ink-secondary)' }}>{o.length > 100 ? o.substring(0, 97) + '...' : o}</p>)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--ink-muted)]">No competitor data from calibration. Complete calibration to identify your competitive landscape.</p>
                  )}
                </Panel>

                {/* SEO Analysis */}
                {seoAnalysis.score != null && (
                  <Panel data-testid="saturation-seo">
                    <div className="flex items-center gap-2 mb-3">
                      <SearchIcon className="w-4 h-4" style={{ color: 'var(--positive)' }} />
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: fontFamily.display }}>SEO Analysis</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: seoAnalysis.status === 'strong' ? 'var(--positive)' : 'var(--warning)', background: seoAnalysis.status === 'strong' ? 'var(--positive-wash)' : 'var(--warning-wash)', fontFamily: fontFamily.mono }}>{seoAnalysis.score}/100 — {seoAnalysis.status}</span>
                    </div>
                    {seoAnalysis.strengths?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[9px] uppercase mb-1" style={{ color: 'var(--positive)', fontFamily: fontFamily.mono }}>Strengths</p>
                        {seoAnalysis.strengths.map((s, i) => <p key={i} className="text-[10px] flex items-start gap-1.5" style={{ color: 'var(--ink-secondary)' }}><CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'var(--positive)' }} />{s}</p>)}
                      </div>
                    )}
                    {seoAnalysis.gaps?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[9px] uppercase mb-1" style={{ color: 'var(--warning)', fontFamily: fontFamily.mono }}>Gaps</p>
                        {seoAnalysis.gaps.map((g, i) => <p key={i} className="text-[10px] flex items-start gap-1.5" style={{ color: 'var(--ink-secondary)' }}><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />{g}</p>)}
                      </div>
                    )}
                    {seoAnalysis.priority_actions?.length > 0 && (
                      <div>
                        <p className="text-[9px] uppercase mb-1" style={{ color: 'var(--lava)', fontFamily: fontFamily.mono }}>Priority Actions</p>
                        {seoAnalysis.priority_actions.map((a, i) => <p key={i} className="text-[10px] flex items-start gap-1.5" style={{ color: 'var(--ink-secondary)' }}><Zap className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'var(--lava)' }} />{a}</p>)}
                      </div>
                    )}
                  </Panel>
                )}

                {/* Watchtower Positions */}
                {watchtower?.positions && Object.keys(watchtower.positions).length > 0 && (
                  <Panel>
                    <div className="flex items-center gap-2 mb-4">
                      <Activity className="w-4 h-4" style={{ color: 'var(--info)' }} />
                      <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Signal Positions by Source</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(watchtower.positions).map(([domain, pos]) => {
                        const posColor = pos.position === 'CRITICAL' ? 'var(--danger)' : pos.position === 'COMPRESSION' ? 'var(--lava)' : pos.position === 'DRIFT' ? 'var(--warning)' : 'var(--positive)';
                        return (
                          <div key={domain} className="p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg, 12px)' }}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs capitalize" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{domain}</span>
                              <span className="text-[10px] px-2 py-0.5" style={{ color: posColor, background: posColor + '15', fontFamily: 'var(--font-mono)', borderRadius: 'var(--r-pill, 100px)' }}>{pos.position}</span>
                            </div>
                            <div className="flex gap-3 text-[10px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
                              <span>{pos.events_30d} events</span>
                              <span>{pos.velocity}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Panel>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* ═══ DEMAND CAPTURE TAB (NEW) ═══ */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'demand' && (
          <div className="space-y-6" data-testid="demand-tab">
            <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', letterSpacing: 'var(--ls-display, -0.035em)' }}>Demand Capture Analysis</h2>
            <p className="text-xs" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>How effectively you're capturing available market demand and converting interest into revenue.</p>

            {!hasCRM && !snapshot ? (
              <Panel className="text-center py-10">
                <Crosshair className="w-8 h-8 text-[var(--ink-muted)] mx-auto mb-3" />
                <p className="text-sm mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Connect CRM to analyse demand capture.</p>
                <p className="text-xs mb-4" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>Demand capture analysis requires CRM data (deals, contacts) and calibration to assess market opportunity.</p>
                <a href="/integrations" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[var(--ink-inverse)]" style={{ background: 'var(--info)' }} data-testid="demand-connect-cta">
                  <Plug className="w-4 h-4" /> Connect CRM
                </a>
              </Panel>
            ) : (
              <>
                {/* Demand Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <GaugeMeter value={demandCapture} label="Goal Achievement Probability" suffix="%" thresholds={[30, 50, 70]} />
                  <GaugeMeter value={mi.misalignment_index != null ? mi.misalignment_index : null} label="Misalignment Index" suffix="/100" thresholds={[60, 40, 20]} />
                  {pipeline != null && (
                    <div className="p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg, 12px)' }}>
                      <span className="text-[10px] block mb-1 uppercase" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-muted)' }}>Active Pipeline</span>
                      <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--info)', fontSize: 'var(--size-mono-lg, 24px)' }}>${Math.round(pipeline / 1000)}K</span>
                    </div>
                  )}
                </div>

                {/* Pressure Analysis */}
                {pressure?.pressures && (
                  <Panel>
                    <div className="flex items-center gap-2 mb-4">
                      <Target className="w-4 h-4" style={{ color: 'var(--lava)' }} />
                      <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Demand Pressure by Channel</h3>
                    </div>
                    <div className="space-y-3">
                      {Object.entries(pressure.pressures).map(([domain, p]) => {
                        const levelColor = p.level === 'critical' ? 'var(--danger)' : p.level === 'elevated' ? 'var(--lava)' : p.level === 'moderate' ? 'var(--warning)' : p.level === 'low' ? 'var(--positive)' : 'var(--silver-4)';
                        return (
                          <div key={domain}>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs capitalize" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{domain}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] px-2 py-0.5" style={{ color: levelColor, background: levelColor + '15', fontFamily: 'var(--font-mono)', borderRadius: 'var(--r-pill, 100px)' }}>{p.level}</span>
                                <span className="text-[10px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>{p.events_14d} signals</span>
                              </div>
                            </div>
                            <div className="h-1.5 rounded-full" style={{ background: levelColor + '20' }}>
                              <div className="h-1.5 rounded-full transition-all" style={{ background: levelColor, width: Math.min(p.score * 3, 100) + '%' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Panel>
                )}

                {/* Channel Gaps */}
                <GapsSection channelsData={channelsData} hasCRM={hasCRM} pipeline={pipeline} gapsOpen={gapsOpen} setGapsOpen={setGapsOpen} navigate={navigate} />

                {/* Paid Media Analysis */}
                {paidMedia.maturity && (
                  <Panel data-testid="demand-paid-media">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="w-4 h-4" style={{ color: 'var(--warning)' }} />
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: fontFamily.display }}>Paid Media Analysis</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: paidMedia.maturity === 'unknown_or_low_visibility' ? 'var(--warning)' : 'var(--positive)', background: paidMedia.maturity === 'unknown_or_low_visibility' ? 'var(--warning-wash)' : 'var(--positive-wash)', fontFamily: fontFamily.mono }}>{paidMedia.maturity.replace(/_/g, ' ')}</span>
                    </div>
                    {paidMedia.assessment && <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--ink-secondary)' }}>{paidMedia.assessment}</p>}
                    {paidMedia.priority_actions?.length > 0 && (
                      <div>
                        <p className="text-[9px] uppercase mb-1" style={{ color: 'var(--lava)', fontFamily: fontFamily.mono }}>Priority Actions</p>
                        {paidMedia.priority_actions.map((a, i) => <p key={i} className="text-[10px] flex items-start gap-1.5 mb-1" style={{ color: 'var(--ink-secondary)' }}><Zap className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'var(--lava)' }} />{a}</p>)}
                      </div>
                    )}
                  </Panel>
                )}

                {/* AEO Strategy */}
                {aeoStrategy.length > 0 && (
                  <Panel data-testid="demand-aeo">
                    <div className="flex items-center gap-2 mb-3">
                      <Eye className="w-4 h-4" style={{ color: 'var(--info)' }} />
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: fontFamily.display }}>AI Engine Optimisation</h3>
                    </div>
                    <p className="text-[10px] mb-3" style={{ color: 'var(--ink-muted)', fontFamily: fontFamily.mono }}>Actions to improve your visibility in AI-powered search and answer engines.</p>
                    <div className="space-y-2">
                      {aeoStrategy.map((action, i) => <p key={i} className="text-xs leading-relaxed flex items-start gap-2" style={{ color: 'var(--ink-secondary)' }}><span className="text-[10px] font-bold mt-0.5 shrink-0" style={{ color: 'var(--info)', fontFamily: fontFamily.mono }}>{i + 1}.</span>{action}</p>)}
                    </div>
                  </Panel>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* ═══ FUNNEL FRICTION TAB (NEW) ═══ */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'friction' && (
          <div className="space-y-6" data-testid="friction-tab">
            <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', letterSpacing: 'var(--ls-display, -0.035em)' }}>Funnel Friction Analysis</h2>
            <p className="text-xs" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>Where prospects drop off and where your conversion engine has resistance.</p>

            {!hasCRM && !snapshot ? (
              <Panel className="text-center py-10">
                <Filter className="w-8 h-8 text-[var(--ink-muted)] mx-auto mb-3" />
                <p className="text-sm mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Connect CRM to analyse funnel friction.</p>
                <p className="text-xs mb-4" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>Funnel analysis requires deal stage data from your CRM to identify where deals stall, drop off, or slow down.</p>
                <a href="/integrations" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[var(--ink-inverse)]" style={{ background: 'var(--warning)' }} data-testid="friction-connect-cta">
                  <Plug className="w-4 h-4" /> Connect CRM
                </a>
              </Panel>
            ) : (
              <>
                {/* Evidence Freshness */}
                {freshness?.freshness && (
                  <Panel>
                    <div className="flex items-center gap-2 mb-4">
                      <RefreshCw className="w-4 h-4" style={{ color: 'var(--info)' }} />
                      <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Data Freshness by Source</h3>
                    </div>
                    <p className="text-xs mb-4" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>Stale data creates blind spots. Fresh data reduces friction in decision-making.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(freshness.freshness).filter(([, f]) => f.status !== 'no_data').map(([domain, f]) => {
                        const fColor = f.status === 'fresh' ? 'var(--positive)' : f.status === 'recent' ? 'var(--info)' : f.status === 'aging' ? 'var(--warning)' : 'var(--danger)';
                        return (
                          <div key={domain} className="p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg, 12px)' }}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs capitalize" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>{domain}</span>
                              <span className="text-[10px] px-2 py-0.5" style={{ color: fColor, background: fColor + '15', fontFamily: 'var(--font-mono)', borderRadius: 'var(--r-pill, 100px)' }}>{f.status}</span>
                            </div>
                            <span className="text-lg font-bold block" style={{ color: fColor, fontFamily: 'var(--font-mono)', fontSize: 'var(--size-mono-lg, 18px)' }}>{f.hours_old != null ? (f.hours_old < 24 ? Math.round(f.hours_old) + 'h' : Math.round(f.hours_old / 24) + 'd') : '—'}</span>
                            <span className="text-[10px] block" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>Decay: {f.decay_factor != null ? Math.round(f.decay_factor * 100) + '%' : '—'} signal strength</span>
                          </div>
                        );
                      })}
                    </div>
                  </Panel>
                )}

                {/* Friction Points */}
                <Panel>
                  <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-4 h-4" style={{ color: 'var(--warning)' }} />
                    <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Identified Friction Points</h3>
                  </div>
                  {c.data_gaps && c.data_gaps.length > 0 ? (
                    <div className="space-y-2">
                      {c.data_gaps.map((gap, i) => {
                        const impactColor = gap.impact_on_confidence === 'high' ? 'var(--danger)' : gap.impact_on_confidence === 'medium' ? 'var(--warning)' : 'var(--positive)';
                        return (
                          <div key={i} className="flex items-start gap-3 p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg, 12px)' }}>
                            <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: impactColor }} />
                            <div className="flex-1">
                              <span className="text-xs font-semibold" style={{ color: 'var(--ink-display)' }}>{gap.area}</span>
                              <span className="text-[10px] ml-2 px-1.5 py-0.5" style={{ color: impactColor, background: impactColor + '15', fontFamily: 'var(--font-mono)', borderRadius: 'var(--r-pill, 100px)' }}>{gap.status}</span>
                              {gap.fix && <p className="text-[10px] text-[var(--ink-muted)] mt-1">{gap.fix}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {!hasCRM && <FrictionItem label="CRM not connected" detail="Deal stage data unavailable. Cannot assess funnel conversion rates." impact="high" />}
                      {!channelsData?.channels?.some(ch => ch.key === 'google_ads' && ch.status === 'connected') && <FrictionItem label="No paid acquisition data" detail="Cannot measure cost per acquisition or channel efficiency." impact="medium" />}
                      {!channelsData?.channels?.some(ch => ch.key === 'analytics' && ch.status === 'connected') && <FrictionItem label="No website analytics" detail="Cannot track website-to-lead conversion or traffic sources." impact="medium" />}
                      {!channelsData?.channels?.some(ch => ch.key === 'email' && ch.status === 'connected') && <FrictionItem label="No email data" detail="Cannot assess email engagement or nurture effectiveness." impact="low" />}
                    </div>
                  )}
                </Panel>

                {/* Website Health */}
                {websiteHealth.score != null && (
                  <Panel data-testid="friction-website-health">
                    <div className="flex items-center gap-2 mb-3">
                      <Globe className="w-4 h-4" style={{ color: 'var(--info)' }} />
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: fontFamily.display }}>Website Health</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: websiteHealth.status === 'strong' ? 'var(--positive)' : 'var(--warning)', background: websiteHealth.status === 'strong' ? 'var(--positive-wash)' : 'var(--warning-wash)', fontFamily: fontFamily.mono }}>{websiteHealth.score}/100 — {websiteHealth.status}</span>
                    </div>
                    {websiteHealth.summary && <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>{websiteHealth.summary}</p>}
                  </Panel>
                )}

                {/* Trust Signals */}
                {trustSignals.length > 0 && (
                  <Panel data-testid="friction-trust-signals">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4" style={{ color: 'var(--positive)' }} />
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: fontFamily.display }}>Trust Signals</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--positive-wash)', color: 'var(--positive)', fontFamily: fontFamily.mono }}>{trustSignals.length} detected</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {trustSignals.map((signal, i) => (
                        <span key={i} className="text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1.5" style={{ background: 'var(--positive-wash)', border: '1px solid var(--positive)', color: 'var(--ink-secondary)', fontFamily: fontFamily.mono }}>
                          <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--positive)' }} /> {signal}
                        </span>
                      ))}
                    </div>
                  </Panel>
                )}

                {/* Review Aggregation */}
                {reviewAgg.has_data && (
                  <Panel data-testid="friction-reviews">
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-4 h-4" style={{ color: 'var(--warning)' }} />
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: fontFamily.display }}>Review Reputation</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--positive)' }}>
                        <span className="text-[10px] block" style={{ color: 'var(--ink-muted)', fontFamily: fontFamily.mono }}>Positive</span>
                        <span className="text-lg font-bold" style={{ color: 'var(--positive)', fontFamily: fontFamily.mono }}>{reviewAgg.positive_count || 0}</span>
                      </div>
                      <div className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--danger)' }}>
                        <span className="text-[10px] block" style={{ color: 'var(--ink-muted)', fontFamily: fontFamily.mono }}>Negative</span>
                        <span className="text-lg font-bold" style={{ color: 'var(--danger)', fontFamily: fontFamily.mono }}>{reviewAgg.negative_count || 0}</span>
                      </div>
                    </div>
                    {reviewAgg.top_recent?.length > 0 && (
                      <div>
                        <p className="text-[9px] uppercase mb-2" style={{ color: 'var(--ink-muted)', fontFamily: fontFamily.mono }}>Recent reviews</p>
                        {reviewAgg.top_recent.slice(0, 2).map((r, i) => (
                          <p key={i} className="text-[10px] leading-snug mb-1 pl-2" style={{ color: 'var(--ink-secondary)', borderLeft: '2px solid var(--warning)' }}>{r.length > 120 ? r.substring(0, 117) + '...' : r}</p>
                        ))}
                      </div>
                    )}
                  </Panel>
                )}

                {/* Conversion Intelligence */}
                {(goalProb != null || mi.misalignment_index != null) && (
                  <Panel>
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="w-4 h-4" style={{ color: 'var(--positive)' }} />
                      <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Conversion Intelligence</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {goalProb != null && (
                        <div className="p-4 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg, 12px)' }}>
                          <span className="text-[10px] block mb-1 uppercase" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-muted)' }}>Goal Achievement</span>
                          <span className="text-3xl font-bold" style={{ color: goalProb > 60 ? 'var(--positive)' : 'var(--warning)', fontFamily: 'var(--font-mono)', fontSize: 'var(--size-mono-lg, 30px)' }}>{goalProb}%</span>
                          <span className="text-[10px] block mt-1" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>probability at current pace</span>
                        </div>
                      )}
                      {mi.misalignment_index != null && (
                        <div className="p-4 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg, 12px)' }}>
                          <span className="text-[10px] block mb-1 uppercase" style={{ fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--ink-muted)' }}>Strategy-Execution Gap</span>
                          <span className="text-3xl font-bold" style={{ color: mi.misalignment_index > 50 ? 'var(--danger)' : mi.misalignment_index > 25 ? 'var(--warning)' : 'var(--positive)', fontFamily: 'var(--font-mono)', fontSize: 'var(--size-mono-lg, 30px)' }}>{mi.misalignment_index}</span>
                          <span className="text-[10px] block mt-1" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>misalignment index (lower is better)</span>
                        </div>
                      )}
                    </div>
                  </Panel>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ REPORTS TAB ═══ */}
        {activeTab === 'reports' && (
          <div className="space-y-4" data-testid="reports-tab">
            <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', letterSpacing: 'var(--ls-display, -0.035em)' }}>Intelligence Reports</h2>

            {/* Scan metadata */}
            {scanTimestamp && (
              <Panel>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" style={{ color: 'var(--ink-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--ink-secondary)' }}>Last calibration scan: <strong style={{ color: 'var(--ink-display)' }}>{new Date(scanTimestamp).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></span>
                  </div>
                  {nextUpdate && <span className="text-[10px]" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>Next update: {new Date(nextUpdate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>}
                </div>
              </Panel>
            )}

            {/* PDF Download buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4" style={{ color: 'var(--lava)' }} />
                  <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Market & Position Report</span>
                </div>
                <p className="text-[10px] mb-3" style={{ color: 'var(--ink-muted)' }}>Executive PDF with Digital Footprint, SWOT, CMO actions, competitive landscape, and SEO analysis.</p>
                <button onClick={() => handleDownloadPdf('market-position')} disabled={pdfGenerating === 'market-position' || !hasEnrichment}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-colors w-full justify-center"
                  style={{ background: hasEnrichment ? 'var(--lava)' : 'var(--surface-sunken)', color: hasEnrichment ? 'var(--ink-inverse)' : 'var(--ink-muted)', opacity: pdfGenerating === 'market-position' ? 0.6 : 1, fontFamily: 'var(--font-mono)' }}>
                  {pdfGenerating === 'market-position' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {pdfGenerating === 'market-position' ? 'Generating...' : hasEnrichment ? 'Download PDF' : 'Complete calibration first'}
                </button>
              </div>
              <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4" style={{ color: 'var(--info)' }} />
                  <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Competitive Benchmark Report</span>
                </div>
                <p className="text-[10px] mb-3" style={{ color: 'var(--ink-muted)' }}>Executive PDF with competitor landscape, 5-pillar breakdown, SEO analysis, social media, and review reputation.</p>
                <button onClick={() => handleDownloadPdf('benchmark')} disabled={pdfGenerating === 'benchmark' || !hasEnrichment}
                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-colors w-full justify-center"
                  style={{ background: hasEnrichment ? 'var(--info)' : 'var(--surface-sunken)', color: hasEnrichment ? 'var(--ink-inverse)' : 'var(--ink-muted)', opacity: pdfGenerating === 'benchmark' ? 0.6 : 1, fontFamily: 'var(--font-mono)' }}>
                  {pdfGenerating === 'benchmark' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {pdfGenerating === 'benchmark' ? 'Generating...' : hasEnrichment ? 'Download PDF' : 'Complete calibration first'}
                </button>
              </div>
            </div>

            {/* Existing snapshot reports */}
            {reports.length === 0 && !hasEnrichment && (
              <div className="p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl, 16px)' }}>
                <FileText className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--ink-muted)', opacity: 0.3 }} />
                <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Complete calibration to generate downloadable reports.</p>
              </div>
            )}
            {reports.map((r, i) => (
              <div key={i} className="p-5 cursor-pointer hover:bg-[var(--surface-tint)] transition-colors" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl, 16px)' }}
                onClick={() => sendToChat(`Summarise my ${r.type}`)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2"><FileText className="w-4 h-4" style={{ color: 'var(--lava)' }} /><span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>{r.type}</span></div>
                  <span className="text-[10px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>{new Date(r.date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1 mt-2"><MessageSquare className="w-3 h-3" style={{ color: 'var(--lava)' }} /><span className="text-[10px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--lava)' }}>Discuss in Ask BIQc</span></div>
              </div>
            ))}
          </div>
        )}

        </>}
      </div>
      {showRecalibrateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm" style={{ background: 'color-mix(in srgb, var(--surface-sunken) 72%, transparent)' }} onClick={() => { if (!recalSubmitting) setShowRecalibrateModal(false); }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4 mx-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            {recalSubmitted ? (
              <div className="text-center space-y-3 py-4">
                <CheckCircle2 className="w-10 h-10 mx-auto" style={{ color: 'var(--positive)' }} />
                <h2 className="text-lg font-semibold" style={{ color: 'var(--ink-display)' }}>Request Received</h2>
                <p className="text-sm" style={{ color: 'var(--ink-secondary)' }}>Our team will be in touch within 24 hours to schedule your recalibration session.</p>
                <button onClick={() => { setShowRecalibrateModal(false); setRecalSubmitted(false); }} className="mt-3 px-5 py-2 rounded-lg text-sm font-medium text-[var(--ink-inverse)]" style={{ background: 'var(--lava)' }}>Close</button>
              </div>
            ) : (
              <form onSubmit={handleRecalSubmit} className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>Request Recalibration</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--ink-secondary)' }}>Your business profile was calibrated {daysSinceCalibration} days ago. Submit a request and our team will arrange a fresh calibration session.</p>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--ink-secondary)' }}>Your name</label>
                  <input value={recalForm.name} onChange={e => setRecalForm(p => ({ ...p, name: e.target.value }))} required className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border)', color: 'var(--ink-display)' }} placeholder="Full name" />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--ink-secondary)' }}>Email</label>
                  <input value={recalForm.email} onChange={e => setRecalForm(p => ({ ...p, email: e.target.value }))} required type="email" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border)', color: 'var(--ink-display)' }} placeholder="you@company.com" />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--ink-secondary)' }}>Message (optional)</label>
                  <textarea value={recalForm.message} onChange={e => setRecalForm(p => ({ ...p, message: e.target.value }))} rows={3} className="w-full rounded-lg px-3 py-2 text-sm resize-none" style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border)', color: 'var(--ink-display)' }} placeholder="Any details about what's changed in your business..." />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowRecalibrateModal(false)} className="flex-1 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--border)', color: 'var(--ink-secondary)' }}>Cancel</button>
                  <button type="submit" disabled={recalSubmitting} className="flex-1 py-2 rounded-lg text-sm font-medium text-[var(--ink-inverse)]" style={{ background: 'var(--lava)', opacity: recalSubmitting ? 0.6 : 1 }}>{recalSubmitting ? 'Submitting...' : 'Contact Sales'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

// ═══ Friction Item Component ═══
const FrictionItem = ({ label, detail, impact }) => {
  const color = impact === 'high' ? 'var(--danger)' : impact === 'medium' ? 'var(--warning)' : 'var(--positive)';
  return (
    <div className="flex items-start gap-3 p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg, 12px)' }}>
      <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: color }} />
      <div>
        <span className="text-xs font-semibold" style={{ color: 'var(--ink-display)' }}>{label}</span>
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>{detail}</p>
      </div>
    </div>
  );
};

// ═══ Gaps Section Component ═══
const GapsSection = ({ channelsData, hasCRM, pipeline, gapsOpen, setGapsOpen, navigate }) => (
  <div data-testid="gaps-section">
    <button onClick={() => setGapsOpen(!gapsOpen)} className="w-full flex items-center justify-between p-4 transition-colors hover:bg-[var(--surface-tint)]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl, 16px)' }}>
      <div className="flex items-center gap-3">
        <Link2 className="w-4 h-4" style={{ color: 'var(--info)' }} />
        <div className="text-left">
          <h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Your Marketing Gaps</h2>
          <div className="flex gap-3 mt-1">
            <span className="text-[11px]" style={{ color: hasCRM ? 'var(--positive)' : 'var(--warning)', fontFamily: 'var(--font-mono)' }}>{hasCRM ? 'CRM connected' : 'CRM not connected'}</span>
            <span className="text-[11px]" style={{ color: pipeline ? 'var(--positive)' : 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>{pipeline ? `$${Math.round(pipeline / 1000)}K pipeline` : 'No pipeline data'}</span>
            <span className="text-[11px]" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>{channelsData?.summary?.connected || 0}/{channelsData?.summary?.total || 0} channels</span>
          </div>
        </div>
      </div>
      {gapsOpen ? <ChevronUp className="w-4 h-4 text-[var(--ink-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--ink-muted)]" />}
    </button>
    {gapsOpen && (
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {(channelsData?.channels || []).map(ch => (
          <div key={ch.key} className="p-3 flex items-center gap-3" style={{ background: 'var(--surface)', border: `1px solid ${ch.status === 'connected' ? 'var(--positive)' : 'var(--border)'}`, borderRadius: 'var(--r-lg, 12px)' }}>
            <div className="w-8 h-8 flex items-center justify-center shrink-0 text-[var(--ink-inverse)] font-bold text-xs" style={{ background: ch.color, borderRadius: 'var(--r-md, 8px)' }}>{ch.name[0]}</div>
            <span className="text-sm flex-1" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}>{ch.name}</span>
            {ch.status === 'connected' ? (
              <span className="text-[11px] px-2 py-1 flex items-center gap-1" style={{ color: 'var(--positive)', background: 'var(--positive-wash)', fontFamily: 'var(--font-mono)', borderRadius: 'var(--r-pill, 100px)' }}><CheckCircle2 className="w-3 h-3" /> Connected</span>
            ) : ch.available ? (
              <button onClick={() => navigate('/integrations')} className="text-[11px] px-2 py-1" style={{ color: 'var(--positive)', background: 'var(--positive-wash)', fontFamily: 'var(--font-mono)', borderRadius: 'var(--r-pill, 100px)' }}>Connect</button>
            ) : (
              <span className="text-[11px] px-2 py-1" style={{ color: 'var(--ink-muted)', background: 'var(--surface-sunken)', fontFamily: 'var(--font-mono)', borderRadius: 'var(--r-pill, 100px)' }}>Soon</span>
            )}
          </div>
        ))}
        {(channelsData?.channels || []).length === 0 && (
          <div className="md:col-span-3 p-4 text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg, 12px)', color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
            No channel inventory is available yet. Connect integrations to populate this panel with verified live sources.
          </div>
        )}
      </div>
    )}
  </div>
);

// ═══ ForensicCalibrationCard ═══
const ForensicCalibrationCard = ({ isSuperAdmin, navigate }) => {
  const [forensicResult, setForensicResult] = useState(null);
  useEffect(() => {
    apiClient.get('/forensic/calibration').then(res => { if (res.data?.exists) setForensicResult(res.data); }).catch(() => {});
  }, []);
  return (
    <div className="p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl, 16px)' }} data-testid="forensic-section">
      <div className="flex items-start gap-3">
        <Eye className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--lava)' }} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)' }}>Forensic Calibration</h3>
            {forensicResult && <span className="text-[11px] px-2 py-0.5" style={{ color: forensicResult.risk_color || 'var(--positive)', background: 'var(--surface-sunken)', fontFamily: 'var(--font-mono)', borderRadius: 'var(--r-pill, 100px)' }}>{forensicResult.risk_profile} — {forensicResult.composite_score}/100</span>}
          </div>
          {forensicResult ? (
            <button onClick={() => navigate('/market/calibration')} className="text-xs hover:underline" style={{ fontFamily: 'var(--font-mono)', color: 'var(--lava)' }}>View results</button>
          ) : isSuperAdmin ? (
            <button onClick={() => navigate('/market/calibration')} className="text-xs px-4 py-2 rounded-lg text-[var(--ink-inverse)] mt-2" style={{ background: 'var(--lava)' }}>
              Complete calibration <ArrowRight className="w-3 h-3 inline ml-1" />
            </button>
          ) : (
            <p className="text-xs text-[var(--ink-muted)]">Available in Pro plan</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketPage;
