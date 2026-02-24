import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import FloatingSoundboard from '../components/FloatingSoundboard';
import { CognitiveMesh, RadarSweep } from '../components/LoadingSystems';
import InsufficientDataAlert from '../components/InsufficientDataAlert';
import { useSupabaseAuth, supabase } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import {
  Radar, TrendingUp, TrendingDown, Users, Globe, ArrowUpRight, ArrowRight,
  Target, Shield, AlertTriangle, Activity, BarChart3, Link2, Lock,
  Zap, CheckCircle2, ArrowDownRight, Eye
} from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const BODY = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

const ForensicCalibrationCard = ({ isSuperAdmin, navigate }) => {
  const [forensicResult, setForensicResult] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await apiClient.get('/forensic/calibration');
        if (res.data?.exists) setForensicResult(res.data);
      } catch {}
    };
    fetch();
  }, []);

  return (
    <div className="rounded-xl p-6" style={{ background: 'linear-gradient(135deg, #FF6A0008, #3B82F608)', border: '1px solid #FF6A0020' }} data-testid="forensic-section">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FF6A0015' }}>
          <Eye className="w-6 h-6 text-[#FF6A00]" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Forensic Market Calibration</h3>
            {forensicResult ? (
              <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: forensicResult.risk_color || '#10B981', background: (forensicResult.risk_color || '#10B981') + '15', fontFamily: MONO }}>{forensicResult.risk_profile} — {forensicResult.composite_score}/100</span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#FF6A00', background: '#FF6A0015', fontFamily: MONO }}>Deep Analysis</span>
            )}
          </div>
          {forensicResult ? (
            <div>
              <p className="text-sm text-[#9FB0C3] mb-3">Calibration complete. Your market strategy has been scored.</p>
              {forensicResult.signals?.length > 0 && (
                <div className="space-y-1.5 mb-4">
                  {forensicResult.signals.slice(0, 2).map((sig, i) => (
                    <p key={i} className="text-xs text-[#9FB0C3] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sig.type === 'positive' ? '#10B981' : sig.type === 'critical' ? '#EF4444' : '#F59E0B' }} />
                      {sig.text}
                    </p>
                  ))}
                </div>
              )}
              <button onClick={() => navigate('/market/calibration')} className="px-6 py-2.5 rounded-xl text-sm font-semibold" style={{ color: '#FF6A00', border: '1px solid #FF6A0040' }} data-testid="forensic-calibration-btn">
                View Full Results <ArrowRight className="w-4 h-4 inline ml-1" />
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-[#9FB0C3] mb-4">Weighted assessment of revenue ambition, growth timeline, cohort intention, risk appetite, retention maturity, and pricing confidence.</p>
              {isSuperAdmin ? (
                <button onClick={() => navigate('/market/calibration')} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#FF6A00' }} data-testid="forensic-calibration-btn">
                  Begin Forensic Calibration <ArrowRight className="w-4 h-4 inline ml-1" />
                </button>
              ) : (
                <button className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white opacity-60 cursor-not-allowed" style={{ background: '#FF6A00' }}>
                  <Lock className="w-3.5 h-3.5 inline mr-1" /> Coming Soon — Pro Plan
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


const ChannelIntelligence = ({ navigate, channelsData }) => {
  const [channels, setChannels] = useState(channelsData?.channels || []);
  const [summary, setSummary] = useState(channelsData?.summary || null);

  useEffect(() => {
    // If parent already passed data, use it
    if (channelsData?.channels?.length > 0) {
      setChannels(channelsData.channels);
      setSummary(channelsData.summary || null);
      return;
    }
    // Otherwise fetch independently
    const fetchChannels = async () => {
      try {
        const res = await apiClient.get('/integrations/channels/status');
        setChannels(res.data?.channels || []);
        setSummary(res.data?.summary || null);
      } catch {}
    };
    fetchChannels();
  }, [channelsData]);

  return (
    <div data-testid="channel-intelligence">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Unlock Live Channel Intelligence</h3>
        {summary && (
          <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: summary.connected > 0 ? '#10B981' : '#64748B', background: summary.connected > 0 ? '#10B98115' : '#24314050', fontFamily: MONO }}>
            {summary.connected}/{summary.total} connected
          </span>
        )}
      </div>
      <p className="text-xs text-[#64748B] mb-4" style={{ fontFamily: MONO }}>Connect your marketing channels to activate real-time performance analysis.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {(channels.length > 0 ? channels : [
          { key: 'crm', name: 'CRM', description: 'HubSpot, Salesforce, Pipedrive', color: '#FF7A59', status: 'not_connected', available: true },
          { key: 'google_ads', name: 'Google Ads', description: 'Search, Display, YouTube', color: '#4285F4', status: 'not_connected', available: false },
          { key: 'meta_ads', name: 'Meta Ads', description: 'Facebook, Instagram', color: '#1877F2', status: 'not_connected', available: false },
          { key: 'linkedin', name: 'LinkedIn', description: 'Campaigns, Leads', color: '#0A66C2', status: 'not_connected', available: false },
          { key: 'analytics', name: 'Analytics', description: 'GA4, Mixpanel', color: '#E37400', status: 'not_connected', available: false },
          { key: 'email_platform', name: 'Email Platform', description: 'Mailchimp, ActiveCampaign', color: '#FFE01B', status: 'not_connected', available: false },
        ]).map(ch => (
          <div key={ch.key || ch.name} className="p-4 rounded-lg flex items-center gap-3" style={{ background: '#0F1720', border: `1px solid ${ch.status === 'connected' ? '#10B98130' : '#243140'}` }} data-testid={`channel-${ch.key}`}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-sm" style={{ background: ch.color }}>{ch.name[0]}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-[#F4F7FA] block">{ch.name}</span>
                {ch.provider && <span className="text-[9px] text-[#64748B]" style={{ fontFamily: MONO }}>({ch.provider})</span>}
              </div>
              <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{ch.description}</span>
            </div>
            {ch.status === 'connected' ? (
              <span className="text-[10px] px-2 py-1 rounded flex items-center gap-1" style={{ color: '#10B981', background: '#10B98115', fontFamily: MONO }}>
                <CheckCircle2 className="w-3 h-3" /> Live
              </span>
            ) : ch.available ? (
              <button onClick={() => navigate('/integrations')} className="text-[10px] px-2 py-1 rounded transition-colors hover:bg-[#10B98125]" style={{ color: '#10B981', background: '#10B98115', fontFamily: MONO }} data-testid={`connect-${ch.key}`}>Connect</button>
            ) : (
              <span className="text-[10px] px-2 py-1 rounded" style={{ color: '#64748B', background: '#24314050', fontFamily: MONO }}>Soon</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};


const URGENCY_COLORS = { immediate: '#EF4444', this_week: '#F59E0B', this_month: '#3B82F6', HIGH: '#EF4444', MODERATE: '#F59E0B', LOW: '#10B981', IMMEDIATE: '#EF4444' };

const ActionPlanSection = ({ actionPlan, snapshot }) => {
  if (!actionPlan) return null;

  const moves = actionPlan.top_3_marketing_moves || [];
  const blindside = actionPlan.primary_blindside_risk;
  const lever = actionPlan.hidden_growth_lever;
  const waste = actionPlan.marketing_waste_alert;
  const projection = actionPlan['90_day_market_projection'];
  const window = actionPlan.decision_window_pressure;
  const probExec = actionPlan.probability_shift_if_executed;
  const probIgnore = actionPlan.probability_shift_if_ignored;
  const conf = actionPlan.confidence_score || 0;
  const det = actionPlan.deterministic_inputs || {};

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #FF6A0006, #3B82F606)', border: '1px solid #FF6A0020' }} data-testid="action-plan">
      <div className="px-6 py-5" style={{ borderBottom: '1px solid #FF6A0015' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#FF6A0015' }}>
              <Zap className="w-5 h-5 text-[#FF6A00]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>BIQc Suggested Action Plan</h3>
              <p className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>Cognition-as-a-Platform — consequence-modelled, signal-anchored</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {det.urgency && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ color: URGENCY_COLORS[det.urgency] || '#64748B', background: (URGENCY_COLORS[det.urgency] || '#64748B') + '15', fontFamily: MONO }}>{det.urgency}</span>}
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: conf > 60 ? '#10B981' : conf > 30 ? '#F59E0B' : '#64748B', background: conf > 60 ? '#10B98115' : conf > 30 ? '#F59E0B15' : '#24314050', fontFamily: MONO }}>{conf}% confidence</span>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Top 3 Marketing Moves */}
        {moves.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#FF6A00', fontFamily: MONO }}>Top Strategic Moves</h4>
            <div className="space-y-3">
              {moves.map((m, i) => (
                <div key={i} className="p-4 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#FF6A00]" style={{ fontFamily: MONO }}>#{i + 1}</span>
                      <span className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>{m.move}</span>
                    </div>
                    {m.urgency && <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0" style={{ color: URGENCY_COLORS[m.urgency] || '#64748B', background: (URGENCY_COLORS[m.urgency] || '#64748B') + '15', fontFamily: MONO }}>{m.urgency?.replace('_', ' ')}</span>}
                  </div>
                  <p className="text-xs text-[#9FB0C3] leading-relaxed mb-2">{m.rationale}</p>
                  <div className="flex items-center gap-3">
                    {m.expected_impact && <span className="text-[10px] text-[#10B981]" style={{ fontFamily: MONO }}>{m.expected_impact}</span>}
                    {m.confidence != null && <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{m.confidence}% confidence</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Probability Shift + Decision Window */}
        {(probExec != null || probIgnore != null || window) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {probExec != null && (
              <div className="p-4 rounded-lg text-center" style={{ background: '#10B98108', border: '1px solid #10B98125' }}>
                <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>If Executed</span>
                <span className="text-2xl font-bold text-[#10B981]" style={{ fontFamily: MONO }}>+{probExec}%</span>
                <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>goal probability</span>
              </div>
            )}
            {probIgnore != null && (
              <div className="p-4 rounded-lg text-center" style={{ background: '#EF444408', border: '1px solid #EF444425' }}>
                <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>If Ignored</span>
                <span className="text-2xl font-bold text-[#EF4444]" style={{ fontFamily: MONO }}>-{Math.abs(probIgnore)}%</span>
                <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>goal probability</span>
              </div>
            )}
            {window && (
              <div className="p-4 rounded-lg text-center" style={{ background: '#F59E0B08', border: '1px solid #F59E0B25' }}>
                <span className="text-[10px] text-[#64748B] block mb-1" style={{ fontFamily: MONO }}>Decision Window</span>
                <span className="text-2xl font-bold text-[#F59E0B]" style={{ fontFamily: MONO }}>{window.window_days}d</span>
                <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>{window.cost_of_delay_per_week || 'Act now'}</span>
              </div>
            )}
          </div>
        )}

        {/* Blindside Risk + Hidden Lever */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {blindside && (
            <div className="p-4 rounded-lg" style={{ background: '#EF444406', border: '1px solid #EF444420' }}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444]" />
                <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#EF4444', fontFamily: MONO }}>Blindside Risk</span>
                {blindside.probability != null && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: '#EF4444', background: '#EF444415', fontFamily: MONO }}>{blindside.probability}%</span>}
              </div>
              <p className="text-sm font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>{blindside.risk}</p>
              <p className="text-xs text-[#9FB0C3] leading-relaxed mb-2">{blindside.evidence}</p>
              {blindside.prevention_action && <p className="text-[10px] text-[#10B981]" style={{ fontFamily: MONO }}>Prevention: {blindside.prevention_action}</p>}
            </div>
          )}
          {lever && (
            <div className="p-4 rounded-lg" style={{ background: '#10B98106', border: '1px solid #10B98120' }}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-[#10B981]" />
                <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#10B981', fontFamily: MONO }}>Hidden Growth Lever</span>
              </div>
              <p className="text-sm font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>{lever.lever}</p>
              <p className="text-xs text-[#9FB0C3] leading-relaxed mb-2">{lever.evidence}</p>
              {lever.potential_value && <span className="text-[10px] text-[#10B981] mr-2" style={{ fontFamily: MONO }}>{lever.potential_value}</span>}
              {lever.first_step && <p className="text-[10px] text-[#3B82F6] mt-1" style={{ fontFamily: MONO }}>First step: {lever.first_step}</p>}
            </div>
          )}
        </div>

        {/* Marketing Waste Alert */}
        {waste && waste.waste_identified && (
          <div className="p-4 rounded-lg" style={{ background: '#F59E0B06', border: '1px solid #F59E0B20' }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#F59E0B', fontFamily: MONO }}>Marketing Waste Alert</span>
              {waste.amount_at_risk && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: '#F59E0B', background: '#F59E0B15', fontFamily: MONO }}>{waste.amount_at_risk}</span>}
            </div>
            <p className="text-sm text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>{waste.waste_identified}</p>
            <p className="text-xs text-[#9FB0C3] leading-relaxed">{waste.evidence}</p>
            {waste.recommended_reallocation && <p className="text-[10px] text-[#10B981] mt-2" style={{ fontFamily: MONO }}>Redirect to: {waste.recommended_reallocation}</p>}
          </div>
        )}

        {/* 90-Day Projection */}
        {projection && (
          <div>
            <h4 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#64748B', fontFamily: MONO }}>90-Day Market Projection</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: 'Best Case', content: projection.best_case, color: '#10B981' },
                { label: 'Base Case', content: projection.base_case, color: '#F59E0B' },
                { label: 'Worst Case', content: projection.worst_case, color: '#EF4444' },
              ].map(p => (
                <div key={p.label} className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                  <span className="text-[10px] font-semibold block mb-1" style={{ color: p.color, fontFamily: MONO }}>{p.label}</span>
                  <p className="text-xs text-[#9FB0C3] leading-relaxed">{p.content}</p>
                </div>
              ))}
            </div>
            {projection.key_variable && (
              <p className="text-[10px] text-[#64748B] mt-2" style={{ fontFamily: MONO }}>Key variable: {projection.key_variable}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


const ST = {
  STABLE: { c: '#10B981', label: 'Stable' },
  DRIFT: { c: '#F59E0B', label: 'Drift Detected' },
  COMPRESSION: { c: '#FF6A00', label: 'Compression' },
  CRITICAL: { c: '#EF4444', label: 'Critical' },
};

const MarketPage = () => {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [channelsData, setChannelsData] = useState(null);

  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin' || user?.email === 'andre@thestrategysquad.com.au';

  const fetchSnapshot = useCallback(async () => {
    // Fetch channels in parallel
    apiClient.get('/integrations/channels/status').then(res => {
      if (res.data?.channels) setChannelsData(res.data);
    }).catch(() => {});

    // Parallelize all snapshot sources — use first successful response
    const results = await Promise.allSettled([
      apiClient.get('/snapshot/latest').then(r => r.data?.cognitive ? r.data.cognitive : Promise.reject('no data')),
      apiClient.get('/market-intelligence').then(r => r.data?.cognitive && r.data?.has_data ? r.data.cognitive : Promise.reject('no data')),
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('no session');
        const sbUrl = process.env.REACT_APP_SUPABASE_URL;
        const key = process.env.REACT_APP_SUPABASE_ANON_KEY;
        const res = await fetch(`${sbUrl}/functions/v1/biqc-insights-cognitive`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json', 'apikey': key },
          body: '{}',
        });
        if (!res.ok) throw new Error('edge fn failed');
        const d = await res.json();
        if (!d?.cognitive) throw new Error('no cognitive');
        return d.cognitive;
      })(),
    ]);

    // Use the first fulfilled result
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        setSnapshot(r.value);
        return;
      }
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
  const velocity = typeof c.system_state === 'object' ? c.system_state?.velocity : null;
  const st = ST[stateStatus] || ST.STABLE;
  const memo = c.executive_memo || c.memo || '';
  const alignment = c.strategic_alignment_check || c.alignment?.narrative || '';
  const contradictions = c.alignment?.contradictions || [];
  const pipeline = c.pipeline_total || c.revenue?.pipeline;
  const slaBreaches = c.sla_breaches || c.execution?.sla_breaches;
  const marketNarrative = c.market_position || c.market?.narrative || '';
  const mi = c.market_intelligence || {};
  const misalignmentIndex = mi.misalignment_index || c.misalignment_index;
  const goalProb = mi.probability_of_goal_achievement || c.probability_of_goal_achievement;
  const drift = mi.drift_snapshot || {};
  const kpis = mi.market_kpis || {};
  const compSignals = mi.competitor_signals || c.market?.competitors || [];
  const trends = mi.industry_trends || [];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1200px]" style={{ fontFamily: BODY }} data-testid="market-page">

        {/* ═══ PHASE 1: INTELLIGENCE FIRST — Ignition overlay ═══ */}
        {loading && <CognitiveMesh message="You are about to see how your market currently sees you." />}

        {!loading && <>

        <style>{`@keyframes snapFade{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}`}</style>

        {/* ═══ PHASE 2: EXECUTIVE CMO SNAPSHOT (Free Tier) ═══ */}
        <div style={{ animation: 'snapFade 0.6s ease-out' }}>
          <h1 className="text-2xl font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>Market Intelligence</h1>
          <p className="text-sm text-[#9FB0C3]">Strategic positioning, competitive landscape, and drift analysis.</p>
        </div>

        {/* Insufficient Data Notification */}
        <InsufficientDataAlert missingItems={[
          ...(!mi.drift_snapshot?.cohort_actual ? ['forensic'] : []),
          ...(!alignment && !misalignmentIndex ? ['goals'] : []),
          ...(!pipeline && !c.crm ? ['crm'] : []),
          ...(!c.financial && !c.capital?.runway ? ['accounting'] : []),
          ...(!c.emails && !c.founder_vitals?.email_stress ? ['email'] : []),
        ]} />

        {/* System State — only show with real data */}
        {snapshot ? (
        <div className="rounded-xl p-5" style={{ background: st.c + '08', border: `1px solid ${st.c}25` }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: st.c, boxShadow: `0 0 12px ${st.c}50` }} />
              <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: st.c, fontFamily: MONO }}>{stateStatus || 'ANALYZING'}</span>
              {velocity && <span className="text-xs" style={{ color: st.c }}>{velocity === 'worsening' ? '↘' : velocity === 'improving' ? '↗' : '→'} {velocity}</span>}
            </div>
            {confidence && <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: st.c, background: `${st.c}15`, fontFamily: MONO }}>{typeof confidence === 'number' ? `${confidence}% confidence` : confidence}</span>}
          </div>
          {interpretation && <p className="text-sm mt-3 text-[#9FB0C3] leading-relaxed">{interpretation}</p>}
        </div>
        ) : (
        <div className="rounded-xl p-5" style={{ background: '#64748B08', border: '1px solid #24314050' }}>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ background: '#64748B' }} />
            <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: '#64748B', fontFamily: MONO }}>AWAITING INTELLIGENCE</span>
          </div>
          <p className="text-sm mt-3 text-[#64748B] leading-relaxed">Connect integrations and complete calibration to generate your market intelligence snapshot.</p>
        </div>
        )}

        {/* Signal Scores — from cognitive engine market_intelligence */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Positioning Verdict', value: mi.positioning_verdict || (stateStatus ? st.label : 'Awaiting data'), icon: Target, color: stateStatus ? st.c : '#64748B' },
            { label: 'Acquisition Signal', value: mi.acquisition_signal?.label || (pipeline ? `$${Math.round(pipeline / 1000)}K` : 'Awaiting data'), icon: TrendingUp, color: pipeline ? '#3B82F6' : '#64748B' },
            { label: 'Retention Signal', value: mi.retention_signal?.label || (slaBreaches ? `${slaBreaches} risk${slaBreaches > 1 ? 's' : ''}` : (snapshot ? 'Healthy' : 'Awaiting data')), icon: Shield, color: slaBreaches > 0 ? '#F59E0B' : (snapshot ? '#10B981' : '#64748B') },
            { label: 'Growth Signal', value: mi.growth_signal?.label || (snapshot ? (stateStatus === 'CRITICAL' ? 'Blocked' : stateStatus === 'DRIFT' ? 'Under Pressure' : 'On Track') : 'Awaiting data'), icon: ArrowUpRight, color: snapshot ? (stateStatus === 'STABLE' ? '#10B981' : '#F59E0B') : '#64748B' },
          ].map(m => (
            <Panel key={m.label}>
              <div className="flex items-center gap-2 mb-2">
                <m.icon className="w-3.5 h-3.5" style={{ color: m.color }} />
                <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{m.label}</span>
              </div>
              <span className="text-lg font-bold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{m.value}</span>
            </Panel>
          ))}
        </div>

        {/* AI Advisory */}
        {(memo || marketNarrative) && (
          <Panel>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#3B82F615' }}>
                <Radar className="w-4 h-4 text-[#3B82F6]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>AI Market Advisory</h3>
                <p className="text-sm text-[#9FB0C3] leading-relaxed">{marketNarrative || memo?.substring(0, 500)}</p>
              </div>
            </div>
          </Panel>
        )}

        {/* ═══ PHASE 3: STRATEGIC DRIFT SNAPSHOT — always visible ═══ */}
        <div>
          <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#64748B', fontFamily: MONO }}>Strategic Drift Analysis</h3>
          {(drift.cohort_actual || drift.trust_actual || drift.authority_actual || drift.position_actual) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Current Cohort vs Ideal', actual: drift.cohort_actual, target: drift.cohort_target, unit: '%' },
              { label: 'Trust Score vs Required', actual: drift.trust_actual, target: drift.trust_target, unit: '%' },
              { label: 'Authority vs Benchmark', actual: drift.authority_actual, target: drift.authority_target, unit: '%' },
              { label: 'Position vs Competitors', actual: drift.position_actual, target: drift.position_target, unit: '%' },
            ].map(d => {
              const gap = d.target - d.actual;
              const color = gap > 20 ? '#EF4444' : gap > 10 ? '#F59E0B' : '#10B981';
              return (
                <Panel key={d.label}>
                  <span className="text-[10px] text-[#64748B] block mb-2" style={{ fontFamily: MONO }}>{d.label}</span>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-xl font-bold text-[#F4F7FA]" style={{ fontFamily: MONO }}>{d.actual}{d.unit}</span>
                    <span className="text-xs text-[#64748B] mb-0.5" style={{ fontFamily: MONO }}>/ {d.target}{d.unit}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: '#243140' }}>
                    <div className="h-1.5 rounded-full transition-all" style={{ background: color, width: `${(d.actual / d.target) * 100}%` }} />
                  </div>
                  <span className="text-[10px] mt-1 block" style={{ color, fontFamily: MONO }}>Gap: {gap}{d.unit}</span>
                </Panel>
              );
            })}
          </div>
          ) : (
          <div className="rounded-xl p-5" style={{ background: '#141C26', border: '1px solid #F59E0B25' }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
              <span className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Insufficient Data for Drift Detection</span>
            </div>
            <p className="text-sm text-[#9FB0C3] mb-4 leading-relaxed">BIQc needs more context to calculate strategic drift. Complete the following to activate drift monitoring:</p>
            <div className="space-y-2">
              {[
                { action: 'Complete Forensic Calibration', detail: 'Revenue ambition, growth timeline, cohort targets, risk appetite', path: '/market/calibration', done: false },
                { action: 'Define Business Goals & KPIs', detail: 'Targets for acquisition, retention, and growth', path: '/business-profile', done: false },
                { action: 'Connect CRM', detail: 'Pipeline data enables positioning and acquisition scoring', path: '/integrations', done: !!pipeline },
                { action: 'Connect Accounting', detail: 'Financial data enables trust and retention scoring', path: '/integrations', done: !!c.financial },
              ].map((item, i) => (
                <button key={i} onClick={() => !item.done && navigate(item.path)} className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all hover:bg-white/[0.02]" style={{ background: '#0F1720', border: `1px solid ${item.done ? '#10B98130' : '#24314080'}` }}>
                  {item.done ? <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" /> : <div className="w-4 h-4 rounded-full border shrink-0" style={{ borderColor: '#F59E0B' }} />}
                  <div className="flex-1">
                    <span className="text-sm text-[#F4F7FA] block" style={{ fontFamily: BODY }}>{item.action}</span>
                    <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{item.detail}</span>
                  </div>
                  {!item.done && <ArrowRight className="w-4 h-4 text-[#64748B]" />}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[#64748B] mt-3" style={{ fontFamily: MONO }}>Drift analysis activates automatically as data is ingested.</p>
          </div>
          )}
        </div>

        {/* ═══ PHASE 8.5: MISALIGNMENT QUANTIFICATION — always visible ═══ */}
        <div className="rounded-xl p-5" style={{ background: '#141C26', border: `1px solid ${(misalignmentIndex || alignment) ? '#F59E0B25' : '#24314050'}` }}>
          <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: (misalignmentIndex || alignment) ? '#F59E0B' : '#64748B', fontFamily: MONO }}>Strategic Alignment Check</h3>
          {(misalignmentIndex || goalProb) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {misalignmentIndex != null && (
                <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Misalignment Index</span>
                  <span className="text-2xl font-bold" style={{ fontFamily: MONO, color: misalignmentIndex > 50 ? '#EF4444' : misalignmentIndex > 25 ? '#F59E0B' : '#10B981' }}>{misalignmentIndex}</span>
                  <span className="text-xs text-[#64748B]">/100</span>
                </div>
              )}
              {goalProb != null && (
                <div className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                  <span className="text-[10px] text-[#64748B] block" style={{ fontFamily: MONO }}>Goal Achievement Probability</span>
                  <span className="text-2xl font-bold" style={{ fontFamily: MONO, color: goalProb > 70 ? '#10B981' : goalProb > 40 ? '#F59E0B' : '#EF4444' }}>{goalProb}%</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-[#64748B]" />
              <span className="text-sm text-[#9FB0C3]" style={{ fontFamily: BODY }}>Insufficient data for misalignment scoring</span>
            </div>
          )}
          {alignment && <p className="text-sm text-[#9FB0C3] leading-relaxed mb-3">{alignment}</p>}
          {contradictions.length > 0 && contradictions.map((ct, i) => (
            <div key={i} className="px-3 py-2 rounded-lg mb-2" style={{ background: '#F59E0B10', border: '1px solid #F59E0B25' }}>
              <p className="text-xs" style={{ color: '#F59E0B', fontFamily: MONO }}>&#x26A0; {ct}</p>
            </div>
          ))}
          {!alignment && !misalignmentIndex && (
            <div className="space-y-2 mt-3">
              <p className="text-xs text-[#64748B] leading-relaxed">To activate misalignment detection, BIQc needs:</p>
              {[
                'Business goals, objectives, and KPIs defined in Business DNA',
                'Marketing strategy and acquisition/retention targets',
                'Forensic Calibration completed (revenue ambition, growth timeline)',
                'At least one integration connected (CRM, Accounting, or Email)',
              ].map((req, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#F59E0B' }} />
                  <span className="text-xs text-[#9FB0C3]">{req}</span>
                </div>
              ))}
              <p className="text-[10px] text-[#64748B] mt-2" style={{ fontFamily: MONO }}>Misalignment engine activates automatically as context builds.</p>
            </div>
          )}
        </div>

        {/* ═══ PHASE 5: INTEGRATION LAYER — Unlock Live Channel Intelligence ═══ */}
        <ChannelIntelligence navigate={navigate} channelsData={channelsData} />

        {/* ═══ PHASE 6 + 7: Data Validation + Channel Calibration (placeholder — needs server-side) ═══ */}
        <Panel>
          <div className="flex items-center gap-3 mb-3">
            <BarChart3 className="w-4 h-4 text-[#3B82F6]" />
            <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Channel Performance Analysis</h3>
            <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#64748B', background: '#24314050', fontFamily: MONO }}>Requires channel connections</span>
          </div>
          <p className="text-xs text-[#64748B] leading-relaxed" style={{ fontFamily: BODY }}>
            Connect your marketing channels above to unlock: CAC analysis, CPL tracking, ROAS measurement, conversion rate optimisation, channel dependency mapping, funnel drop-off detection, and saturation risk alerts.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 mt-4">
            {['CAC', 'CPL', 'ROAS', 'Conv Rate', 'Dependency', 'Drop-off', 'Saturation'].map(m => (
              <div key={m} className="p-2 rounded text-center" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                <span className="text-lg font-bold text-[#243140] block" style={{ fontFamily: MONO }}>—</span>
                <span className="text-[9px] text-[#64748B]" style={{ fontFamily: MONO }}>{m}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* ═══ PHASE 8: FORENSIC MARKET CALIBRATION ═══ */}
        <ForensicCalibrationCard isSuperAdmin={isSuperAdmin} navigate={navigate} />

        {/* ═══ BIQc SUGGESTED ACTION PLAN — Cognition-as-a-Platform Flagship ═══ */}
        <ActionPlanSection actionPlan={c.action_plan} snapshot={snapshot} />

        {/* ═══ PHASE 9: EXECUTIVE STRATEGIC BRIEF (Paid Output) ═══ */}
        <Panel>
          <div className="flex items-center gap-3 mb-3">
            <Zap className="w-4 h-4 text-[#FF6A00]" />
            <h3 className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>Executive Strategic Brief</h3>
            {isSuperAdmin ? (
              <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#10B981', background: '#10B98115', fontFamily: MONO }}>Available</span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#64748B', background: '#24314050', fontFamily: MONO }}>Pro Plan</span>
            )}
          </div>
          {isSuperAdmin && memo ? (
            <div className="space-y-3">
              {[
                { title: 'Current Reality', content: interpretation || 'Connect integrations for full analysis.' },
                { title: 'Misalignment Summary', content: alignment || 'No misalignment detected.' },
                { title: 'AI Recommendation', content: memo?.substring(0, 300) || 'Generating...' },
              ].map((s, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ background: '#0F1720', border: '1px solid #243140' }}>
                  <span className="text-[10px] font-semibold tracking-widest uppercase block mb-1" style={{ color: '#FF6A00', fontFamily: MONO }}>{s.title}</span>
                  <p className="text-xs text-[#9FB0C3] leading-relaxed">{s.content}</p>
                </div>
              ))}
              <p className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>Full brief includes: Cohort Correction, Channel Reallocation, Authority Plan, 90-Day Tactical Plan, 12-Month Forecast</p>
            </div>
          ) : (
            <p className="text-xs text-[#64748B] leading-relaxed">Upgrade to Pro to unlock your full Executive Strategic Brief including current reality assessment, cohort correction plan, channel reallocation strategy, and 12-month forecast.</p>
          )}
        </Panel>

        </>}
      </div>
      <FloatingSoundboard context="Market intelligence - strategic positioning, drift analysis, channel calibration" />
    </DashboardLayout>
  );
};

export default MarketPage;
