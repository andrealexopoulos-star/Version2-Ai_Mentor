import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { CognitiveMesh } from '../components/LoadingSystems';
import { useSupabaseAuth, supabase } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { containsCRMClaim } from '../constants/integrationTruth';
import {
  TrendingUp, ArrowRight, Target, Shield, AlertTriangle,
  Zap, CheckCircle2, Eye, ChevronDown, ChevronUp, Link2, RefreshCw,
  MessageSquare, FileText
} from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

// SMB-friendly status labels (replace enterprise DRIFT/COMPRESSION)
const STATUS_MAP = {
  STABLE: { label: 'On Track', color: '#10B981', bg: '#10B98108', b: '#10B98125' },
  DRIFT: { label: 'Slipping', color: '#F59E0B', bg: '#F59E0B08', b: '#F59E0B25' },
  COMPRESSION: { label: 'Under Pressure', color: '#FF6A00', bg: '#FF6A0008', b: '#FF6A0025' },
  CRITICAL: { label: 'At Risk', color: '#EF4444', bg: '#EF444408', b: '#EF444425' },
};

// ═══════════════════════════════════════════════════════════════
// MARKET PAGE — SMB-First Cognition Interface
// Structure: Status → Focus → Risk → Opportunity → Track → Gaps
// No synthetic data. No enterprise jargon. No chaos.
// ═══════════════════════════════════════════════════════════════

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

  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin' || user?.email === 'andre@thestrategysquad.com.au';

  // Load past reports (CMO summaries, forensic reports)
  useEffect(() => {
    apiClient.get('/snapshot/latest').then(res => {
      const snaps = [];
      if (res.data?.generated_at) {
        snaps.push({ type: 'Cognitive Snapshot', date: res.data.generated_at, data: res.data.cognitive });
      }
      setReports(snaps);
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
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('no session');
        const res = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/biqc-insights-cognitive`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json', 'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY },
          body: '{}',
        });
        if (!res.ok) throw new Error('edge fn failed');
        const d = await res.json();
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
      await Promise.race([fetchSnapshot(), new Promise(r => setTimeout(r, 8000))]);
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
  const ap = c.action_plan || {};
  const moves = ap.top_3_marketing_moves || [];
  const blindside = ap.primary_blindside_risk;
  const lever = ap.hidden_growth_lever;
  const hasCRM = channelsData?.channels?.some(ch => ch.key === 'crm' && ch.status === 'connected');
  const hasEmail = channelsData?.channels?.some(ch => ch.key === 'email' && ch.status === 'connected');
  const pipeline = hasCRM ? (c.pipeline_total || c.revenue?.pipeline) : null;

  // Suppress moves/risks/levers that reference CRM data without integration
  const filteredMoves = hasCRM ? moves : moves.filter(m => !containsCRMClaim(m.move) && !containsCRMClaim(m.rationale));
  const filteredBlindside = blindside && (!containsCRMClaim(blindside.risk) || hasCRM) ? blindside : null;
  const filteredLever = lever && (!containsCRMClaim(lever.lever) || hasCRM) ? lever : null;
  const filteredMemo = memo && (!containsCRMClaim(memo) || hasCRM) ? memo : '';
  const filteredAlignment = alignment && (!containsCRMClaim(alignment) || hasCRM) ? alignment : '';

  const sendToChat = (msg) => setActionMessage(msg);

  return (
    <DashboardLayout actionMessage={actionMessage} onActionConsumed={() => setActionMessage('')}>
      <div className="space-y-6 max-w-[1000px]" style={{ fontFamily: BODY, overflowY: 'visible' }} data-testid="market-page">
        <style>{`@keyframes snapFade{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}`}</style>

        {loading && <CognitiveMesh message="Pulling your latest signals..." />}

        {!loading && <>

        {/* ═══ TAB NAVIGATION ═══ */}
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#141C26', border: '1px solid #1E293B' }} data-testid="market-tabs">
          <button onClick={() => setActiveTab('intelligence')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'intelligence' ? 'text-[#F4F7FA]' : 'text-[#64748B] hover:text-[#9FB0C3]'}`}
            style={{ background: activeTab === 'intelligence' ? '#FF6A0015' : 'transparent', fontFamily: MONO }}
            data-testid="tab-intelligence">
            What to Focus on Next
          </button>
          <button onClick={() => setActiveTab('reports')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'reports' ? 'text-[#F4F7FA]' : 'text-[#64748B] hover:text-[#9FB0C3]'}`}
            style={{ background: activeTab === 'reports' ? '#FF6A0015' : 'transparent', fontFamily: MONO }}
            data-testid="tab-reports">
            <FileText className="w-3.5 h-3.5" /> Reports
          </button>
        </div>

        {/* ═══ SECTION 1 — WHERE YOU STAND RIGHT NOW ═══ */}
        <div className="rounded-xl p-6" style={{ background: st.bg, border: `1px solid ${st.b}`, animation: 'snapFade 0.5s ease-out' }} data-testid="status-banner">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: st.color, boxShadow: `0 0 12px ${st.color}50` }} />
              <span className="text-lg font-bold" style={{ color: st.color, fontFamily: HEAD }}>{snapshot ? st.label : 'Waiting for data'}</span>
            </div>
            <div className="flex items-center gap-2">
              {confidence && <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: st.color, background: `${st.color}15`, fontFamily: MONO }}>{confidence}% confidence</span>}
              <button onClick={() => { setLoading(true); fetchSnapshot().finally(() => setLoading(false)); }} className="p-1.5 rounded-lg hover:bg-white/5" data-testid="market-refresh">
                <RefreshCw className="w-3.5 h-3.5 text-[#64748B]" />
              </button>
            </div>
          </div>
          {interpretation && <p className="text-sm text-[#9FB0C3] leading-relaxed">{interpretation}</p>}
          {!snapshot && <p className="text-sm text-[#64748B]">Connect your tools and complete calibration to see where your business stands.</p>}
        </div>

        {/* ═══ SECTION 2 — WHAT TO FOCUS ON NEXT ═══ */}
        {filteredMoves.length > 0 && (
          <div style={{ animation: 'snapFade 0.6s ease-out' }} data-testid="focus-section">
            <h2 className="text-lg font-semibold text-[#F4F7FA] mb-4" style={{ fontFamily: HEAD }}>What To Focus On Next</h2>
            <div className="space-y-3">
              {filteredMoves.map((m, i) => (
                <div key={i} className="rounded-xl p-5" style={{ background: '#141C26', border: '1px solid #243140' }}>
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-bold text-[#FF6A00] mt-0.5" style={{ fontFamily: MONO }}>#{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>{m.move}</p>
                      <p className="text-xs text-[#9FB0C3] leading-relaxed mb-3">{m.rationale}</p>
                      <div className="flex flex-wrap gap-3">
                        {m.expected_impact && <span className="text-[11px] text-[#10B981]" style={{ fontFamily: MONO }}>{m.expected_impact}</span>}
                        {m.confidence != null && <span className="text-[11px] text-[#64748B]" style={{ fontFamily: MONO }}>{m.confidence}% confidence</span>}
                        {m.urgency && <span className="text-[11px] px-2 py-0.5 rounded" style={{ color: m.urgency === 'immediate' ? '#EF4444' : '#F59E0B', background: (m.urgency === 'immediate' ? '#EF4444' : '#F59E0B') + '15', fontFamily: MONO }}>{m.urgency?.replace('_', ' ')}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* If executed vs ignored */}
            {(ap.probability_shift_if_executed || ap.probability_shift_if_ignored || ap.decision_window_pressure) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                {ap.probability_shift_if_executed != null && (
                  <div className="p-4 rounded-lg text-center" style={{ background: '#10B98108', border: '1px solid #10B98125' }}>
                    <span className="text-[11px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>If you act</span>
                    <span className="text-2xl font-bold text-[#10B981]" style={{ fontFamily: MONO }}>+{ap.probability_shift_if_executed}%</span>
                    <span className="text-[11px] text-[#64748B] block">chance of hitting goals</span>
                  </div>
                )}
                {ap.probability_shift_if_ignored != null && (
                  <div className="p-4 rounded-lg text-center" style={{ background: '#EF444408', border: '1px solid #EF444425' }}>
                    <span className="text-[11px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>If you don't</span>
                    <span className="text-2xl font-bold text-[#EF4444]" style={{ fontFamily: MONO }}>-{Math.abs(ap.probability_shift_if_ignored)}%</span>
                    <span className="text-[11px] text-[#64748B] block">chance of hitting goals</span>
                  </div>
                )}
                {ap.decision_window_pressure && (
                  <div className="p-4 rounded-lg text-center" style={{ background: '#F59E0B08', border: '1px solid #F59E0B25' }}>
                    <span className="text-[11px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>Time to act</span>
                    <span className="text-2xl font-bold text-[#F59E0B]" style={{ fontFamily: MONO }}>{ap.decision_window_pressure.window_days}d</span>
                    <span className="text-[11px] text-[#64748B] block">{ap.decision_window_pressure.cost_of_delay_per_week || 'Before it costs you'}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* No action plan yet — show what's needed */}
        {filteredMoves.length === 0 && snapshot && (
          <Panel>
            <h2 className="text-sm font-semibold text-[#F4F7FA] mb-2" style={{ fontFamily: HEAD }}>What To Focus On Next</h2>
            <p className="text-sm text-[#9FB0C3] leading-relaxed">BIQc needs more data to generate specific recommendations. Complete forensic calibration and connect your key tools to unlock personalised action priorities.</p>
            {!hasCRM && (
              <p className="text-xs text-[#F59E0B] mt-2" style={{ fontFamily: MONO }}>Connect CRM to unlock lead, pipeline, and churn intelligence.</p>
            )}
          </Panel>
        )}

        {/* ═══ SECTION 3 — BIGGEST RISK RIGHT NOW ═══ */}
        {filteredBlindside && (
          <div className="rounded-xl p-5" style={{ background: '#EF444406', border: '1px solid #EF444420', animation: 'snapFade 0.7s ease-out' }} data-testid="risk-section">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
              <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Biggest Risk Right Now</h2>
              {filteredBlindside.probability != null && <span className="text-[11px] px-2 py-0.5 rounded" style={{ color: '#EF4444', background: '#EF444415', fontFamily: MONO }}>{filteredBlindside.probability}% likely</span>}
            </div>
            <p className="text-sm text-[#F4F7FA] mb-2" style={{ fontFamily: HEAD }}>{filteredBlindside.risk}</p>
            <p className="text-xs text-[#9FB0C3] leading-relaxed mb-2">{filteredBlindside.evidence}</p>
            {filteredBlindside.impact_if_materialises && <p className="text-xs text-[#EF4444] mb-2" style={{ fontFamily: MONO }}>Impact: {filteredBlindside.impact_if_materialises}</p>}
            {filteredBlindside.prevention_action && <p className="text-xs text-[#10B981]" style={{ fontFamily: MONO }}>What to do: {filteredBlindside.prevention_action}</p>}
          </div>
        )}

        {/* ═══ SECTION 4 — GROWTH OPPORTUNITY YOU'RE MISSING ═══ */}
        {filteredLever && (
          <div className="rounded-xl p-5" style={{ background: '#10B98106', border: '1px solid #10B98120', animation: 'snapFade 0.8s ease-out' }} data-testid="opportunity-section">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#10B981]" />
              <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Growth Opportunity You're Missing</h2>
            </div>
            <p className="text-sm text-[#F4F7FA] mb-2" style={{ fontFamily: HEAD }}>{filteredLever.lever}</p>
            <p className="text-xs text-[#9FB0C3] leading-relaxed mb-2">{filteredLever.evidence}</p>
            {filteredLever.potential_value && <span className="text-xs text-[#10B981] mr-3" style={{ fontFamily: MONO }}>Potential: {filteredLever.potential_value}</span>}
            {filteredLever.first_step && <p className="text-xs text-[#3B82F6] mt-1" style={{ fontFamily: MONO }}>First step: {filteredLever.first_step}</p>}
          </div>
        )}

        {/* ═══ SECTION 5 — ARE YOU ON TRACK? ═══ */}
        {(goalProb != null || filteredAlignment) && (
          <Panel data-testid="track-section">
            <h2 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: HEAD }}>Are You On Track?</h2>
            {goalProb != null && (
              <div className="flex items-center gap-4 mb-3">
                <span className="text-3xl font-bold" style={{ fontFamily: MONO, color: goalProb > 60 ? '#10B981' : goalProb > 40 ? '#F59E0B' : '#EF4444' }}>{goalProb}%</span>
                <span className="text-sm text-[#9FB0C3]">chance of hitting your goals at current pace</span>
              </div>
            )}
            {filteredAlignment && <p className="text-sm text-[#9FB0C3] leading-relaxed">{filteredAlignment}</p>}
          </Panel>
        )}

        {/* ═══ SECTION 6 — YOUR MARKETING GAPS ═══ */}
        <div data-testid="gaps-section">
          <button onClick={() => setGapsOpen(!gapsOpen)} className="w-full flex items-center justify-between p-4 rounded-xl transition-colors hover:bg-white/[0.02]" style={{ background: '#141C26', border: '1px solid #243140' }}>
            <div className="flex items-center gap-3">
              <Link2 className="w-4 h-4 text-[#3B82F6]" />
              <div className="text-left">
                <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Your Marketing Gaps</h2>
                <div className="flex gap-3 mt-1">
                  <span className="text-[11px]" style={{ color: hasCRM ? '#10B981' : '#F59E0B', fontFamily: MONO }}>{hasCRM ? 'CRM connected' : 'CRM not connected'}</span>
                  <span className="text-[11px]" style={{ color: pipeline ? '#10B981' : '#64748B', fontFamily: MONO }}>{pipeline ? `$${Math.round(pipeline / 1000)}K pipeline` : 'No pipeline data'}</span>
                  <span className="text-[11px]" style={{ color: '#64748B', fontFamily: MONO }}>{channelsData?.summary?.connected || 0}/{channelsData?.summary?.total || 6} channels</span>
                </div>
              </div>
            </div>
            {gapsOpen ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
          </button>

          {gapsOpen && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {(channelsData?.channels || [
                { key: 'crm', name: 'CRM', description: 'HubSpot, Salesforce', color: '#FF7A59', status: 'not_connected', available: true },
                { key: 'google_ads', name: 'Google Ads', description: 'Search, Display', color: '#4285F4', status: 'not_connected', available: false },
                { key: 'meta_ads', name: 'Meta Ads', description: 'Facebook, Instagram', color: '#1877F2', status: 'not_connected', available: false },
                { key: 'linkedin', name: 'LinkedIn', description: 'Campaigns', color: '#0A66C2', status: 'not_connected', available: false },
                { key: 'analytics', name: 'Analytics', description: 'GA4', color: '#E37400', status: 'not_connected', available: false },
                { key: 'email_platform', name: 'Email', description: 'Mailchimp', color: '#FFE01B', status: 'not_connected', available: false },
              ]).map(ch => (
                <div key={ch.key} className="p-3 rounded-lg flex items-center gap-3" style={{ background: '#0F1720', border: `1px solid ${ch.status === 'connected' ? '#10B98130' : '#243140'}` }} data-testid={`channel-${ch.key}`}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-xs" style={{ background: ch.color }}>{ch.name[0]}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[#F4F7FA]">{ch.name}</span>
                    {ch.provider && <span className="text-[10px] text-[#64748B] ml-1">({ch.provider})</span>}
                  </div>
                  {ch.status === 'connected' ? (
                    <span className="text-[11px] px-2 py-1 rounded flex items-center gap-1" style={{ color: '#10B981', background: '#10B98115', fontFamily: MONO }}><CheckCircle2 className="w-3 h-3" /> Live</span>
                  ) : ch.available ? (
                    <button onClick={() => navigate('/integrations')} className="text-[11px] px-2 py-1 rounded" style={{ color: '#10B981', background: '#10B98115', fontFamily: MONO }}>Connect</button>
                  ) : (
                    <span className="text-[11px] px-2 py-1 rounded" style={{ color: '#64748B', background: '#24314050', fontFamily: MONO }}>Soon</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ SECTION 7 — FORENSIC CALIBRATION (secondary) ═══ */}
        <ForensicCalibrationCard isSuperAdmin={isSuperAdmin} navigate={navigate} />

        {/* ═══ SECTION 8 — EXECUTIVE BRIEF (compact preview) ═══ */}
        {filteredMemo && (
          <Panel data-testid="brief-section">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3.5 h-3.5 text-[#FF6A00]" />
              <h2 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Executive Brief</h2>
            </div>
            <p className="text-xs text-[#9FB0C3] leading-relaxed">{filteredMemo.substring(0, 400)}{filteredMemo.length > 400 ? '...' : ''}</p>
          </Panel>
        )}

        </>}
      </div>
      <FloatingSoundboard context="Market intelligence - business health, risks, opportunities, action priorities" />
    </DashboardLayout>
  );
};

// ═══ ForensicCalibrationCard (secondary placement) ═══
const ForensicCalibrationCard = ({ isSuperAdmin, navigate }) => {
  const [forensicResult, setForensicResult] = useState(null);
  useEffect(() => {
    apiClient.get('/forensic/calibration').then(res => { if (res.data?.exists) setForensicResult(res.data); }).catch(() => {});
  }, []);

  return (
    <div className="rounded-xl p-5" style={{ background: '#141C26', border: '1px solid #243140' }} data-testid="forensic-section">
      <div className="flex items-start gap-3">
        <Eye className="w-4 h-4 text-[#FF6A00] mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Forensic Calibration</h3>
            {forensicResult && <span className="text-[11px] px-2 py-0.5 rounded" style={{ color: forensicResult.risk_color || '#10B981', background: (forensicResult.risk_color || '#10B981') + '15', fontFamily: MONO }}>{forensicResult.risk_profile} — {forensicResult.composite_score}/100</span>}
          </div>
          {forensicResult ? (
            <button onClick={() => navigate('/market/calibration')} className="text-xs text-[#FF6A00] hover:underline" style={{ fontFamily: MONO }}>View results</button>
          ) : isSuperAdmin ? (
            <button onClick={() => navigate('/market/calibration')} className="text-xs px-4 py-2 rounded-lg text-white mt-2" style={{ background: '#FF6A00', fontFamily: BODY }}>
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
