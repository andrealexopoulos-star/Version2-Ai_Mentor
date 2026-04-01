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
  MessageSquare, FileText, Layers, Crosshair, Filter, BarChart3, Plug, Activity
} from 'lucide-react';
import { EmptyStateCard, SectionLabel, SignalCard, SurfaceCard } from '../components/intelligence/SurfacePrimitives';
import LineageBadge from '../components/LineageBadge';


const Panel = ({ children, className = '', ...props }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }} {...props}>{children}</div>
);

const STATUS_MAP = {
  STABLE: { label: 'On Track', color: '#10B981', bg: '#10B98108', b: '#10B98125' },
  DRIFT: { label: 'Slipping', color: '#F59E0B', bg: '#F59E0B08', b: '#F59E0B25' },
  COMPRESSION: { label: 'Under Pressure', color: '#FF6A00', bg: '#FF6A0008', b: '#FF6A0025' },
  CRITICAL: { label: 'At Risk', color: '#EF4444', bg: '#EF444408', b: '#EF444425' },
};

const GaugeMeter = ({ value, label, suffix = '%', thresholds = [30, 60, 80] }) => {
  const color = value >= thresholds[2] ? '#10B981' : value >= thresholds[1] ? '#F59E0B' : value >= thresholds[0] ? '#FF6A00' : '#EF4444';
  return (
    <div className="p-4 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
      <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>{label}</span>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-bold" style={{ color, fontFamily: fontFamily.mono }}>{value != null ? value : '—'}</span>
        {value != null && <span className="text-xs mb-0.5" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{suffix}</span>}
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

  const TABS = [
    { id: 'intelligence', label: 'Focus', icon: Zap },
    { id: 'saturation', label: 'Saturation', icon: Layers },
    { id: 'demand', label: 'Demand', icon: Crosshair },
    { id: 'friction', label: 'Friction', icon: Filter },
    { id: 'reports', label: 'Reports', icon: FileText },
  ];

  return (
    <DashboardLayout actionMessage={actionMessage} onActionConsumed={() => setActionMessage('')}>
      <div className="space-y-6 max-w-[1000px]" style={{ fontFamily: fontFamily.body, overflowY: 'visible' }} data-testid="market-page">
        <style>{`@keyframes snapFade{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}`}</style>

        {loading && <PageLoadingState message="Pulling your latest market signals…" />}

        {!loading && <>

        {/* ═══ STATUS BANNER ═══ */}
        <div className="rounded-xl p-6" style={{ background: st.bg, border: `1px solid ${st.b}`, animation: 'snapFade 0.5s ease-out' }} data-testid="status-banner">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: st.color, boxShadow: `0 0 12px ${st.color}50` }} />
              <span className="text-lg font-bold" style={{ color: st.color, fontFamily: fontFamily.display }}>{hasLiveMarketContext ? st.label : 'Waiting for data'}</span>
            </div>
            <div className="flex items-center gap-2">
              {confidence && <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: st.color, background: `${st.color}15`, fontFamily: fontFamily.mono }}>{confidence}% confidence</span>}
              <button onClick={() => { setLoading(true); fetchSnapshot().finally(() => setLoading(false)); }} className="p-1.5 rounded-lg hover:bg-white/5" data-testid="market-refresh">
                <RefreshCw className="w-3.5 h-3.5 text-[#64748B]" />
              </button>
              {canRecalibrate && (
                <button
                  onClick={() => setShowRecalibrateModal(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: '#7C3AED15', color: '#7C3AED', border: '1px solid #7C3AED30' }}
                  data-testid="recalibrate-btn"
                >
                  <RefreshCw className="w-3 h-3" /> Recalibrate
                </button>
              )}
            </div>
          </div>
          {interpretation && <p className="text-sm text-[#9FB0C3] leading-relaxed">{interpretation}</p>}
          {!hasLiveMarketContext && <p className="text-sm text-[#64748B]">Connect your tools and complete calibration to see where your business stands.</p>}
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
                <div className="rounded-xl border px-3 py-3" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg)' }} data-testid="market-pressure-status">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>Pressure calibration</p>
                  <p className="mt-2 text-sm text-[#CBD5E1]">{pressureAvailable ? `Live pressure available: ${marketPressureSummary || 'signal mix detected for this cycle.'}` : (pressureMessage || 'Pressure calibration is not available yet.')}</p>
                </div>
                <div className="rounded-xl border px-3 py-3" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg)' }} data-testid="market-freshness-status">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>Evidence freshness</p>
                  <p className="mt-2 text-sm text-[#CBD5E1]">{freshnessAvailable ? `Freshness scoring is live: ${freshnessSummary || 'recent evidence is now available.'}` : (freshnessMessage || 'Evidence freshness is not available yet.')}</p>
                  <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--biqc-border)' }} data-testid="market-lineage-badge-evidence">
                    <LineageBadge lineage={marketIntelLineage} data_freshness={marketIntelFreshness} confidence_score={marketIntelConfidence} compact />
                  </div>
                </div>
                <div className="rounded-xl border px-3 py-3" style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg)' }} data-testid="market-channel-separation-note">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#94A3B8]" style={{ fontFamily: fontFamily.mono }}>Internal channel context</p>
                  <p className="mt-2 text-sm text-[#CBD5E1]">The performance strip below is intentionally internal — useful, but separate from the external market narrative.</p>
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
                { label: 'Digital Footprint', value: footprint.score, unit: '/100', color: '#FF6A00', icon: BarChart3, desc: 'Internal channel strength, not external market demand.' },
                { label: 'Social Engagement', value: footprint.social_score, unit: '/100', color: '#3B82F6', icon: MessageSquare, desc: 'Internal audience response across owned and social channels.' },
                { label: 'SEO Visibility', value: footprint.seo_score, unit: '/100', color: '#10B981', icon: Eye, desc: 'Owned-search discoverability for your business.' },
                { label: 'Content Authority', value: footprint.content_score, unit: '/100', color: '#8B5CF6', icon: FileText, desc: 'Content depth and authority inside your current channel footprint.' },
              ].map(metric => (
                <div key={metric.label} className="rounded-lg p-4" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{metric.label}</span>
                    <metric.icon className="w-3.5 h-3.5" style={{ color: metric.color }} />
                  </div>
                  {hasFootprint && metric.value != null
                    ? <>
                        <span className="text-2xl font-bold" style={{ color: metric.color, fontFamily: fontFamily.mono }}>{metric.value}</span>
                        <span className="text-xs ml-0.5" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{metric.unit}</span>
                        <div className="h-1 rounded-full mt-2" style={{ background: metric.color + '20' }}>
                          <div style={{ width: `${metric.value}%`, height: '100%', borderRadius: 4, background: metric.color, transition: 'width 1s ease' }} />
                        </div>
                      </>
                    : <span className="text-xs italic" style={{ color: '#4A5568', fontFamily: fontFamily.mono }}>
                        {hasMarketing ? 'Signal still calibrating…' : 'Connect marketing tools'}
                      </span>
                  }
                </div>
              ))}
            </div>
          );
        })()}

        {/* ═══ TAB NAVIGATION ═══ */}
        <div className="flex gap-1 p-1 rounded-lg overflow-x-auto" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }} data-testid="market-tabs">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors shrink-0 ${activeTab === tab.id ? 'text-[#F4F7FA]' : 'text-[#64748B] hover:text-[#9FB0C3]'}`}
              style={{ background: activeTab === tab.id ? '#FF6A0015' : 'transparent', fontFamily: fontFamily.mono }}
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
                <div className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-[#FF6A00]" /><h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Executive Brief</h2></div>
                <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: '#FF6A0015', color: '#FF6A00', fontFamily: fontFamily.mono }}>MARKET INTELLIGENCE</span>
              </div>
              <div className="mb-2" data-testid="market-lineage-badge-brief">
                <LineageBadge lineage={marketIntelLineage} data_freshness={marketIntelFreshness} confidence_score={marketIntelConfidence} compact />
              </div>
              <p className="text-xs text-[#9FB0C3] leading-relaxed">{filteredMemo.substring(0, 400)}{filteredMemo.length > 400 ? '...' : ''}</p>
              <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--biqc-border)' }}>
                <span className="text-[10px]" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Full reports available under Governance → Reports</span>
                <button onClick={() => navigate('/reports')} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded hover:bg-white/5 transition-colors" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>
                  View Reports <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </Panel>
          )}
          {filteredMoves.length > 0 && (
            <div style={{ animation: 'snapFade 0.6s ease-out' }} data-testid="focus-section">
              <h2 className="text-lg font-semibold text-[#F4F7FA] mb-4" style={{ fontFamily: fontFamily.display }}>What To Focus On Next</h2>
              <div className="space-y-3">
                {filteredMoves.map((m, i) => (
                  <div key={i} className="rounded-xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-bold text-[#FF6A00] mt-0.5" style={{ fontFamily: fontFamily.mono }}>#{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>{m.move}</p>
                        <p className="text-xs text-[#9FB0C3] leading-relaxed mb-3">{m.rationale}</p>
                        <div className="flex flex-wrap gap-3">
                          {m.expected_impact && <span className="text-[11px] text-[#10B981]" style={{ fontFamily: fontFamily.mono }}>{m.expected_impact}</span>}
                          {m.confidence != null && <span className="text-[11px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{m.confidence}% confidence</span>}
                          {m.urgency && <span className="text-[11px] px-2 py-0.5 rounded" style={{ color: m.urgency === 'immediate' ? '#EF4444' : '#F59E0B', background: (m.urgency === 'immediate' ? '#EF4444' : '#F59E0B') + '15', fontFamily: fontFamily.mono }}>{m.urgency?.replace('_', ' ')}</span>}
                        </div>
                        <button onClick={() => sendToChat(`Help me execute: ${m.move}. ${m.rationale}`)}
                          className="flex items-center gap-1.5 mt-3 text-[11px] px-3 py-1.5 rounded-lg transition-colors hover:bg-[#FF6A0015]"
                          style={{ color: '#FF6A00', border: '1px solid #FF6A0030', fontFamily: fontFamily.mono }}
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
                    <div className="p-4 rounded-lg text-center" style={{ background: '#10B98108', border: '1px solid #10B98125' }}>
                      <span className="text-[11px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>If you act</span>
                      <span className="text-2xl font-bold text-[#10B981]" style={{ fontFamily: fontFamily.mono }}>+{ap.probability_shift_if_executed}%</span>
                    </div>
                  )}
                  {ap.probability_shift_if_ignored != null && (
                    <div className="p-4 rounded-lg text-center" style={{ background: '#EF444408', border: '1px solid #EF444425' }}>
                      <span className="text-[11px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>If you don't</span>
                      <span className="text-2xl font-bold text-[#EF4444]" style={{ fontFamily: fontFamily.mono }}>-{Math.abs(ap.probability_shift_if_ignored)}%</span>
                    </div>
                  )}
                  {ap.decision_window_pressure && (
                    <div className="p-4 rounded-lg text-center" style={{ background: '#F59E0B08', border: '1px solid #F59E0B25' }}>
                      <span className="text-[11px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Time to act</span>
                      <span className="text-2xl font-bold text-[#F59E0B]" style={{ fontFamily: fontFamily.mono }}>{ap.decision_window_pressure.window_days}d</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {filteredMoves.length === 0 && snapshot && (
            <Panel><p className="text-sm text-[#9FB0C3]">Complete forensic calibration and connect integrations to unlock personalised action priorities.</p></Panel>
          )}
          {filteredBlindside && (
            <div className="rounded-xl p-5" style={{ background: '#EF444406', border: '1px solid #EF444420' }} data-testid="risk-section">
              <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-[#EF4444]" /><h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Biggest Risk Right Now</h2></div>
              <p className="text-sm text-[#F4F7FA] mb-2">{filteredBlindside.risk}</p>
              {filteredBlindside.evidence && <p className="text-xs text-[#9FB0C3] leading-relaxed mb-2">{filteredBlindside.evidence}</p>}
              {filteredBlindside.prevention_action && <p className="text-xs text-[#10B981]" style={{ fontFamily: fontFamily.mono }}>What to do: {filteredBlindside.prevention_action}</p>}
            </div>
          )}
          {filteredLever && (
            <div className="rounded-xl p-5" style={{ background: '#10B98106', border: '1px solid #10B98120' }} data-testid="opportunity-section">
              <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-[#10B981]" /><h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Growth Opportunity You're Missing</h2></div>
              <p className="text-sm text-[#F4F7FA] mb-2">{filteredLever.lever}</p>
              {filteredLever.evidence && <p className="text-xs text-[#9FB0C3] mb-2">{filteredLever.evidence}</p>}
              {filteredLever.potential_value && <span className="text-xs text-[#10B981]" style={{ fontFamily: fontFamily.mono }}>Potential: {filteredLever.potential_value}</span>}
            </div>
          )}
          {(goalProb != null || filteredAlignment) && (
            <Panel data-testid="track-section">
              <h2 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: fontFamily.display }}>Are You On Track?</h2>
              {goalProb != null && <div className="flex items-center gap-4 mb-3"><span className="text-3xl font-bold" style={{ fontFamily: fontFamily.mono, color: goalProb > 60 ? '#10B981' : '#F59E0B' }}>{goalProb}%</span><span className="text-sm text-[#9FB0C3]">chance of hitting your goals</span></div>}
              {filteredAlignment && <p className="text-sm text-[#9FB0C3] leading-relaxed">{filteredAlignment}</p>}
            </Panel>
          )}
          <GapsSection channelsData={channelsData} hasCRM={hasCRM} pipeline={pipeline} gapsOpen={gapsOpen} setGapsOpen={setGapsOpen} navigate={navigate} />

          {/* Forensic Calibration and Exposure Scan blocks moved to Governance → Reports */}
          <Panel>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-3.5 h-3.5 text-[#64748B]" />
              <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Forensic Reports</h3>
            </div>
            <p className="text-xs mb-3" style={{ color: '#64748B', fontFamily: fontFamily.body }}>Forensic Calibration and Market Exposure Scan reports have been moved to the Reports section for download as Board-ready PDFs.</p>
            <button onClick={() => navigate('/reports')} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ background: '#FF6A0015', color: '#FF6A00', border: '1px solid #FF6A0030' }}>
              <ArrowRight className="w-3 h-3" /> Go to Governance Reports
            </button>
          </Panel>
        </>}

        {/* ═══════════════════════════════════════════════════ */}
        {/* ═══ SATURATION ANALYSIS TAB (NEW) ═══ */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'saturation' && (
          <div className="space-y-6" data-testid="saturation-tab">
            <h2 className="text-lg font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Market Saturation Analysis</h2>
            <p className="text-xs text-[#64748B]">How crowded is your market and where do you stand relative to competitors.</p>

            {!snapshot && !watchtower ? (
              <Panel className="text-center py-10">
                <Layers className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
                <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Complete calibration to unlock saturation analysis.</p>
                <p className="text-xs text-[#64748B] mb-4">BIQc needs your business context to assess market density, positioning, and competitive pressure.</p>
                <button onClick={() => navigate('/market/calibration')} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#7C3AED' }} data-testid="saturation-calibrate-cta">
                  <Eye className="w-4 h-4" /> Start Calibration
                </button>
              </Panel>
            ) : (
              <>
                {/* Saturation Score */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <GaugeMeter value={saturationScore} label="Market Position Score" suffix="/100" thresholds={[25, 50, 75]} />
                  <GaugeMeter value={demandCapture} label="Demand Capture Rate" suffix="%" thresholds={[30, 50, 70]} />
                  <div className="p-4 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                    <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Position Verdict</span>
                    <span className="text-xl font-bold" style={{ color: positionVerdict === 'STABLE' ? '#10B981' : positionVerdict === 'DRIFT' ? '#F59E0B' : '#EF4444', fontFamily: fontFamily.mono }}>
                      {positionVerdict || '—'}
                    </span>
                  </div>
                </div>

                {/* Competitor Density */}
                <Panel>
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-4 h-4 text-[#7C3AED]" />
                    <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Competitive Landscape</h3>
                  </div>
                  {competitors.length > 0 ? (
                    <div className="space-y-2">
                      {competitors.map((comp, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#7C3AED' }} />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-[#F4F7FA] block truncate" style={{ fontFamily: fontFamily.display }}>{comp.name}</span>
                            {comp.signal && <p className="text-[10px] text-[#64748B] mt-0.5">{comp.signal}</p>}
                          </div>
                          {comp.threat_level && <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: comp.threat_level === 'high' ? '#EF4444' : '#F59E0B', background: (comp.threat_level === 'high' ? '#EF4444' : '#F59E0B') + '15', fontFamily: fontFamily.mono }}>{comp.threat_level}</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#64748B]">No competitor data from calibration. Complete calibration to identify your competitive landscape.</p>
                  )}
                </Panel>

                {/* Watchtower Positions */}
                {watchtower?.positions && Object.keys(watchtower.positions).length > 0 && (
                  <Panel>
                    <div className="flex items-center gap-2 mb-4">
                      <Activity className="w-4 h-4 text-[#3B82F6]" />
                      <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Signal Positions by Source</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(watchtower.positions).map(([domain, pos]) => {
                        const posColor = pos.position === 'CRITICAL' ? '#EF4444' : pos.position === 'COMPRESSION' ? '#FF6A00' : pos.position === 'DRIFT' ? '#F59E0B' : '#10B981';
                        return (
                          <div key={domain} className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-[#9FB0C3] capitalize">{domain}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: posColor, background: posColor + '15', fontFamily: fontFamily.mono }}>{pos.position}</span>
                            </div>
                            <div className="flex gap-3 text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>
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
            <h2 className="text-lg font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Demand Capture Analysis</h2>
            <p className="text-xs text-[#64748B]">How effectively you're capturing available market demand and converting interest into revenue.</p>

            {!hasCRM && !snapshot ? (
              <Panel className="text-center py-10">
                <Crosshair className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
                <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Connect CRM to analyse demand capture.</p>
                <p className="text-xs text-[#64748B] mb-4">Demand capture analysis requires CRM data (deals, contacts) and calibration to assess market opportunity.</p>
                <a href="/integrations" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#3B82F6' }} data-testid="demand-connect-cta">
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
                    <div className="p-4 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                      <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Active Pipeline</span>
                      <span className="text-2xl font-bold text-[#3B82F6]" style={{ fontFamily: fontFamily.mono }}>${Math.round(pipeline / 1000)}K</span>
                    </div>
                  )}
                </div>

                {/* Pressure Analysis */}
                {pressure?.pressures && (
                  <Panel>
                    <div className="flex items-center gap-2 mb-4">
                      <Target className="w-4 h-4 text-[#FF6A00]" />
                      <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Demand Pressure by Channel</h3>
                    </div>
                    <div className="space-y-3">
                      {Object.entries(pressure.pressures).map(([domain, p]) => {
                        const levelColor = p.level === 'critical' ? '#EF4444' : p.level === 'elevated' ? '#FF6A00' : p.level === 'moderate' ? '#F59E0B' : p.level === 'low' ? '#10B981' : '#64748B';
                        return (
                          <div key={domain}>
                            <div className="flex justify-between mb-1">
                              <span className="text-xs text-[#9FB0C3] capitalize">{domain}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: levelColor, background: levelColor + '15', fontFamily: fontFamily.mono }}>{p.level}</span>
                                <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{p.events_14d} signals</span>
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
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* ═══ FUNNEL FRICTION TAB (NEW) ═══ */}
        {/* ═══════════════════════════════════════════════════ */}
        {activeTab === 'friction' && (
          <div className="space-y-6" data-testid="friction-tab">
            <h2 className="text-lg font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Funnel Friction Analysis</h2>
            <p className="text-xs text-[#64748B]">Where prospects drop off and where your conversion engine has resistance.</p>

            {!hasCRM && !snapshot ? (
              <Panel className="text-center py-10">
                <Filter className="w-8 h-8 text-[#64748B] mx-auto mb-3" />
                <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: fontFamily.display }}>Connect CRM to analyse funnel friction.</p>
                <p className="text-xs text-[#64748B] mb-4">Funnel analysis requires deal stage data from your CRM to identify where deals stall, drop off, or slow down.</p>
                <a href="/integrations" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#F59E0B' }} data-testid="friction-connect-cta">
                  <Plug className="w-4 h-4" /> Connect CRM
                </a>
              </Panel>
            ) : (
              <>
                {/* Evidence Freshness */}
                {freshness?.freshness && (
                  <Panel>
                    <div className="flex items-center gap-2 mb-4">
                      <RefreshCw className="w-4 h-4 text-[#3B82F6]" />
                      <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Data Freshness by Source</h3>
                    </div>
                    <p className="text-xs text-[#64748B] mb-4">Stale data creates blind spots. Fresh data reduces friction in decision-making.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(freshness.freshness).filter(([, f]) => f.status !== 'no_data').map(([domain, f]) => {
                        const fColor = f.status === 'fresh' ? '#10B981' : f.status === 'recent' ? '#3B82F6' : f.status === 'aging' ? '#F59E0B' : '#EF4444';
                        return (
                          <div key={domain} className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-[#9FB0C3] capitalize">{domain}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: fColor, background: fColor + '15', fontFamily: fontFamily.mono }}>{f.status}</span>
                            </div>
                            <span className="text-lg font-bold block" style={{ color: fColor, fontFamily: fontFamily.mono }}>{f.hours_old != null ? (f.hours_old < 24 ? Math.round(f.hours_old) + 'h' : Math.round(f.hours_old / 24) + 'd') : '—'}</span>
                            <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: fontFamily.mono }}>Decay: {f.decay_factor != null ? Math.round(f.decay_factor * 100) + '%' : '—'} signal strength</span>
                          </div>
                        );
                      })}
                    </div>
                  </Panel>
                )}

                {/* Friction Points */}
                <Panel>
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                    <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Identified Friction Points</h3>
                  </div>
                  {c.data_gaps && c.data_gaps.length > 0 ? (
                    <div className="space-y-2">
                      {c.data_gaps.map((gap, i) => {
                        const impactColor = gap.impact_on_confidence === 'high' ? '#EF4444' : gap.impact_on_confidence === 'medium' ? '#F59E0B' : '#10B981';
                        return (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                            <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: impactColor }} />
                            <div className="flex-1">
                              <span className="text-xs font-semibold text-[#F4F7FA]">{gap.area}</span>
                              <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded" style={{ color: impactColor, background: impactColor + '15', fontFamily: fontFamily.mono }}>{gap.status}</span>
                              {gap.fix && <p className="text-[10px] text-[#64748B] mt-1">{gap.fix}</p>}
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

                {/* Conversion Intelligence */}
                {(goalProb != null || mi.misalignment_index != null) && (
                  <Panel>
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="w-4 h-4 text-[#10B981]" />
                      <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Conversion Intelligence</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {goalProb != null && (
                        <div className="p-4 rounded-lg text-center" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                          <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Goal Achievement</span>
                          <span className="text-3xl font-bold" style={{ color: goalProb > 60 ? '#10B981' : '#F59E0B', fontFamily: fontFamily.mono }}>{goalProb}%</span>
                          <span className="text-[10px] text-[#64748B] block mt-1">probability at current pace</span>
                        </div>
                      )}
                      {mi.misalignment_index != null && (
                        <div className="p-4 rounded-lg text-center" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
                          <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: fontFamily.mono }}>Strategy-Execution Gap</span>
                          <span className="text-3xl font-bold" style={{ color: mi.misalignment_index > 50 ? '#EF4444' : mi.misalignment_index > 25 ? '#F59E0B' : '#10B981', fontFamily: fontFamily.mono }}>{mi.misalignment_index}</span>
                          <span className="text-[10px] text-[#64748B] block mt-1">misalignment index (lower is better)</span>
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
            <h2 className="text-lg font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Intelligence Reports</h2>
            {reports.length === 0 && (
              <div className="rounded-xl p-8 text-center" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
                <FileText className="w-8 h-8 mx-auto mb-3 text-[#64748B]/30" />
                <p className="text-sm text-[#64748B]">Reports will appear here after your first cognitive snapshot.</p>
              </div>
            )}
            {reports.map((r, i) => (
              <div key={i} className="rounded-xl p-5 cursor-pointer hover:bg-white/[0.02] transition-colors" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}
                onClick={() => sendToChat(`Summarise my ${r.type}`)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-[#FF6A00]" /><span className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>{r.type}</span></div>
                  <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{new Date(r.date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1 mt-2"><MessageSquare className="w-3 h-3 text-[#FF6A00]" /><span className="text-[10px] text-[#FF6A00]" style={{ fontFamily: fontFamily.mono }}>Discuss in SoundBoard</span></div>
              </div>
            ))}
          </div>
        )}

        </>}
      </div>
      {showRecalibrateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { if (!recalSubmitting) setShowRecalibrateModal(false); }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4 mx-4" style={{ background: 'var(--biqc-surface, #0B1120)', border: '1px solid var(--biqc-border, #1E293B)' }} onClick={e => e.stopPropagation()}>
            {recalSubmitted ? (
              <div className="text-center space-y-3 py-4">
                <CheckCircle2 className="w-10 h-10 mx-auto text-green-400" />
                <h2 className="text-lg font-semibold" style={{ color: 'var(--biqc-text, #F4F7FA)' }}>Request Received</h2>
                <p className="text-sm" style={{ color: 'var(--biqc-text-2, #94A3B8)' }}>Our team will be in touch within 24 hours to schedule your recalibration session.</p>
                <button onClick={() => { setShowRecalibrateModal(false); setRecalSubmitted(false); }} className="mt-3 px-5 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#FF6A00' }}>Close</button>
              </div>
            ) : (
              <form onSubmit={handleRecalSubmit} className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--biqc-text, #F4F7FA)', fontFamily: fontFamily.display }}>Request Recalibration</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--biqc-text-2, #94A3B8)' }}>Your business profile was calibrated {daysSinceCalibration} days ago. Submit a request and our team will arrange a fresh calibration session.</p>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--biqc-text-2, #94A3B8)' }}>Your name</label>
                  <input value={recalForm.name} onChange={e => setRecalForm(p => ({ ...p, name: e.target.value }))} required className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--biqc-bg, #060B18)', border: '1px solid var(--biqc-border, #1E293B)', color: 'var(--biqc-text, #F4F7FA)' }} placeholder="Full name" />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--biqc-text-2, #94A3B8)' }}>Email</label>
                  <input value={recalForm.email} onChange={e => setRecalForm(p => ({ ...p, email: e.target.value }))} required type="email" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--biqc-bg, #060B18)', border: '1px solid var(--biqc-border, #1E293B)', color: 'var(--biqc-text, #F4F7FA)' }} placeholder="you@company.com" />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--biqc-text-2, #94A3B8)' }}>Message (optional)</label>
                  <textarea value={recalForm.message} onChange={e => setRecalForm(p => ({ ...p, message: e.target.value }))} rows={3} className="w-full rounded-lg px-3 py-2 text-sm resize-none" style={{ background: 'var(--biqc-bg, #060B18)', border: '1px solid var(--biqc-border, #1E293B)', color: 'var(--biqc-text, #F4F7FA)' }} placeholder="Any details about what's changed in your business..." />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowRecalibrateModal(false)} className="flex-1 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--biqc-border, #1E293B)', color: 'var(--biqc-text-2, #94A3B8)' }}>Cancel</button>
                  <button type="submit" disabled={recalSubmitting} className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#FF6A00', opacity: recalSubmitting ? 0.6 : 1 }}>{recalSubmitting ? 'Submitting...' : 'Contact Sales'}</button>
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
  const color = impact === 'high' ? '#EF4444' : impact === 'medium' ? '#F59E0B' : '#10B981';
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)' }}>
      <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: color }} />
      <div>
        <span className="text-xs font-semibold text-[#F4F7FA]">{label}</span>
        <p className="text-[10px] text-[#64748B] mt-0.5">{detail}</p>
      </div>
    </div>
  );
};

// ═══ Gaps Section Component ═══
const GapsSection = ({ channelsData, hasCRM, pipeline, gapsOpen, setGapsOpen, navigate }) => (
  <div data-testid="gaps-section">
    <button onClick={() => setGapsOpen(!gapsOpen)} className="w-full flex items-center justify-between p-4 rounded-xl transition-colors hover:bg-white/[0.02]" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
      <div className="flex items-center gap-3">
        <Link2 className="w-4 h-4 text-[#3B82F6]" />
        <div className="text-left">
          <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>Your Marketing Gaps</h2>
          <div className="flex gap-3 mt-1">
            <span className="text-[11px]" style={{ color: hasCRM ? '#10B981' : '#F59E0B', fontFamily: "'JetBrains Mono', monospace" }}>{hasCRM ? 'CRM connected' : 'CRM not connected'}</span>
            <span className="text-[11px]" style={{ color: pipeline ? '#10B981' : '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>{pipeline ? `$${Math.round(pipeline / 1000)}K pipeline` : 'No pipeline data'}</span>
            <span className="text-[11px]" style={{ color: '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>{channelsData?.summary?.connected || 0}/{channelsData?.summary?.total || 0} channels</span>
          </div>
        </div>
      </div>
      {gapsOpen ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
    </button>
    {gapsOpen && (
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {(channelsData?.channels || []).map(ch => (
          <div key={ch.key} className="p-3 rounded-lg flex items-center gap-3" style={{ background: 'var(--biqc-bg)', border: `1px solid ${ch.status === 'connected' ? '#10B98130' : '#243140'}` }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-xs" style={{ background: ch.color }}>{ch.name[0]}</div>
            <span className="text-sm text-[#F4F7FA] flex-1">{ch.name}</span>
            {ch.status === 'connected' ? (
              <span className="text-[11px] px-2 py-1 rounded flex items-center gap-1" style={{ color: '#10B981', background: '#10B98115', fontFamily: "'JetBrains Mono', monospace" }}><CheckCircle2 className="w-3 h-3" /> Live</span>
            ) : ch.available ? (
              <button onClick={() => navigate('/integrations')} className="text-[11px] px-2 py-1 rounded" style={{ color: '#10B981', background: '#10B98115', fontFamily: "'JetBrains Mono', monospace" }}>Connect</button>
            ) : (
              <span className="text-[11px] px-2 py-1 rounded" style={{ color: '#64748B', background: '#24314050', fontFamily: "'JetBrains Mono', monospace" }}>Soon</span>
            )}
          </div>
        ))}
        {(channelsData?.channels || []).length === 0 && (
          <div className="md:col-span-3 p-4 rounded-lg text-xs" style={{ background: 'var(--biqc-bg)', border: '1px solid var(--biqc-border)', color: '#94A3B8' }}>
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
    <div className="rounded-xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }} data-testid="forensic-section">
      <div className="flex items-start gap-3">
        <Eye className="w-4 h-4 text-[#FF6A00] mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>Forensic Calibration</h3>
            {forensicResult && <span className="text-[11px] px-2 py-0.5 rounded" style={{ color: forensicResult.risk_color || '#10B981', background: (forensicResult.risk_color || '#10B981') + '15', fontFamily: "'JetBrains Mono', monospace" }}>{forensicResult.risk_profile} — {forensicResult.composite_score}/100</span>}
          </div>
          {forensicResult ? (
            <button onClick={() => navigate('/market/calibration')} className="text-xs text-[#FF6A00] hover:underline" style={{ fontFamily: "'JetBrains Mono', monospace" }}>View results</button>
          ) : isSuperAdmin ? (
            <button onClick={() => navigate('/market/calibration')} className="text-xs px-4 py-2 rounded-lg text-white mt-2" style={{ background: '#FF6A00' }}>
              Complete calibration <ArrowRight className="w-3 h-3 inline ml-1" />
            </button>
          ) : (
            <p className="text-xs text-[#64748B]">Available in Pro plan</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketPage;
