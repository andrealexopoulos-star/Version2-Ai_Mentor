import React, { useState, useEffect } from 'react';
import { TrendingUp, AlertTriangle, Shield, ArrowRight, Target, Activity, BarChart3, Eye, Link2, RefreshCw, MessageSquare } from 'lucide-react';
import { containsCRMClaim } from '../../constants/integrationTruth';
import { fontFamily } from '../../design-system/tokens';
import { StageProgressBar } from '../AsyncDataLoader';
import { trackSnapshotEvent, EVENTS } from '../../lib/analytics';


const ST_COLORS = {
  STABLE: { c: '#10B981', label: 'Stable' },
  DRIFT: { c: '#F59E0B', label: 'Drift Detected' },
  COMPRESSION: { c: '#E85D00', label: 'Compression' },
  CRITICAL: { c: '#EF4444', label: 'Critical' },
};

export const ExecutiveCMOSnapshot = ({ intelligenceData, onContinue }) => {
  const [ctaVisible, setCtaVisible] = useState(false);
  const [snapshotStage, setSnapshotStage] = useState('fetching');
  const [startedAt] = useState(() => Date.now());

  const c = intelligenceData?.cognitive || {};
  const stateStatus = typeof c.system_state === 'object' ? c.system_state?.status : c.system_state;
  const confidence = typeof c.system_state === 'object' ? c.system_state?.confidence : c.confidence_level;
  const interpretation = typeof c.system_state === 'object' ? c.system_state?.interpretation : c.system_state_interpretation;
  const velocity = typeof c.system_state === 'object' ? c.system_state?.velocity : null;
  const driftVelocity = typeof c.system_state === 'object' ? c.system_state?.drift_velocity : null;
  const signalFreshness = typeof c.system_state === 'object' ? c.system_state?.signal_freshness_hours : null;
  const st = ST_COLORS[stateStatus] || ST_COLORS.STABLE;
  const sources = intelligenceData?.data_sources || [];

  const hasAnyIntelligence = intelligenceData !== null && intelligenceData !== undefined;
  const isReady = hasAnyIntelligence || !!(stateStatus && stateStatus !== 'ANALYZING');
  const hasData = hasAnyIntelligence || !!(c.executive_memo || c.memo || stateStatus);
  const [contentRendered, setContentRendered] = useState(false);

  useEffect(() => {
    if (isReady) return;
    const stages = ['fetching', 'preprocessing', 'analyzing', 'assembling'];
    const delays = [0, 3000, 7000, 12000];
    const timers = stages.map((s, i) => setTimeout(() => setSnapshotStage(s), delays[i]));
    const forceComplete = setTimeout(() => {
      setSnapshotStage('complete');
      setContentRendered(true);
    }, 18000);
    return () => { timers.forEach(clearTimeout); clearTimeout(forceComplete); };
  }, [isReady]);

  useEffect(() => {
    if (isReady && hasData) {
      setSnapshotStage('complete');
      setContentRendered(true);
      trackSnapshotEvent(EVENTS.SNAPSHOT_FINISH, {
        elapsed_ms: Date.now() - startedAt,
        state: stateStatus || 'LOADED',
      });
    }
  }, [isReady, hasData, stateStatus, startedAt]);

  useEffect(() => {
    if (!contentRendered) return;
    const timer = setTimeout(() => setCtaVisible(true), 20000);
    return () => clearTimeout(timer);
  }, [contentRendered]);

  useEffect(() => {
    trackSnapshotEvent(EVENTS.SNAPSHOT_START, { timestamp: startedAt });
    const hardFallback = setTimeout(() => {
      setSnapshotStage('complete');
      setContentRendered(true);
      setCtaVisible(true);
    }, 45000);
    return () => clearTimeout(hardFallback);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Integration truth — suppress CRM claims without integration
  const hasCRMSource = sources.some(s => ['crm', 'hubspot', 'email', 'pipeline'].includes(s?.toLowerCase?.()));
  const rawMemo = c.executive_memo || c.memo || '';
  const memo = hasCRMSource ? rawMemo : (containsCRMClaim(rawMemo) ? '' : rawMemo);

  const rawAlignment = c.strategic_alignment_check || c.alignment?.narrative || '';
  const alignment = hasCRMSource ? rawAlignment : (containsCRMClaim(rawAlignment) ? '' : rawAlignment);
  const contradictions = (c.alignment?.contradictions || []).filter(ct => hasCRMSource || !containsCRMClaim(ct));

  const pipeline = hasCRMSource ? c.pipeline_total : null;
  const slaBreaches = hasCRMSource ? (c.sla_breaches || c.execution?.sla_breaches) : null;

  // v2 fields
  const trajectory = c.trajectory_projection_90_days || {};
  const dataGaps = c.data_gaps || [];
  const snapshotConfidence = c.snapshot_confidence || confidence || null;
  const ap = c.action_plan || {};
  const moves = ap.top_3_marketing_moves || [];
  const blindside = ap.primary_blindside_risk || {};
  const lever = ap.hidden_growth_lever || {};

  // Filter CRM claims from moves
  const filteredMoves = hasCRMSource ? moves : moves.filter(m => !containsCRMClaim(m.move) && !containsCRMClaim(m.rationale));
  const showBlindside = blindside.risk && (hasCRMSource || !containsCRMClaim(blindside.risk));
  const showLever = lever.lever && (hasCRMSource || !containsCRMClaim(lever.lever));

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--biqc-bg)' }} data-testid="cmo-snapshot">
      <style>{`
        @keyframes snapFade{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes pulseGlow{0%,100%{opacity:0.3}50%{opacity:1}}
        @keyframes ctaReveal{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
      `}</style>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="text-center mb-10" style={{ animation: 'snapFade 0.6s ease-out' }}>
          <span className="text-[10px] font-semibold tracking-widest uppercase mb-3 block" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>
            Executive Intelligence Snapshot
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#EDF1F7] mb-2" style={{ fontFamily: fontFamily.display }}>
            Here's what BIQc sees.
          </h1>
          <p className="text-sm text-[#9FB0C3]" style={{ fontFamily: fontFamily.body }}>
            Your first intelligence baseline is ready. Review it, then continue into the platform.
          </p>
        </div>

        {/* ═══ SECTION 1 — System State + Drift Velocity ═══ */}
        <div className="rounded-xl p-5 mb-6" style={{ background: st.c + '08', border: `1px solid ${st.c}25`, animation: 'snapFade 0.8s ease-out' }} data-testid="snapshot-system-state">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: st.c, boxShadow: `0 0 12px ${st.c}50`, animation: !isReady ? 'pulseGlow 2s ease-in-out infinite' : 'none' }} />
              <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: st.c, fontFamily: fontFamily.mono }}>
                {stateStatus || 'ANALYZING'}
              </span>
              {velocity && (
                <span className="text-xs" style={{ color: st.c }}>
                  {velocity === 'worsening' ? '\u2198' : velocity === 'improving' ? '\u2197' : '\u2192'} {velocity}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {driftVelocity && (
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: driftVelocity === 'accelerating' ? '#EF4444' : '#64748B', background: driftVelocity === 'accelerating' ? '#EF444415' : 'rgba(140,170,210,0.15)50', fontFamily: fontFamily.mono }}>
                  {driftVelocity}
                </span>
              )}
              {confidence && isReady && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: st.c, background: `${st.c}15`, fontFamily: fontFamily.mono }}>
                  {typeof confidence === 'number' ? `${confidence}%` : confidence}
                </span>
              )}
              {signalFreshness != null && (
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: signalFreshness > 48 ? '#F59E0B' : '#64748B', background: 'rgba(140,170,210,0.15)50', fontFamily: fontFamily.mono }}>
                  {signalFreshness < 1 ? 'Live' : signalFreshness < 24 ? `${Math.round(signalFreshness)}h old` : `${Math.round(signalFreshness / 24)}d old`}
                </span>
              )}
            </div>
          </div>
          {interpretation && <p className="text-sm mt-3 text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>{interpretation}</p>}
        </div>

        {/* ═══ SECTION 2 — 90-Day Trajectory Projection ═══ */}
        {(trajectory.projected_state || trajectory.best_case) && (
          <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', animation: 'snapFade 0.9s ease-out' }} data-testid="snapshot-trajectory">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-[#3B82F6]" />
              <h3 className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>90-Day Trajectory</h3>
              {trajectory.confidence != null && (
                <span className="text-[10px] px-2 py-0.5 rounded-full ml-auto" style={{ color: '#3B82F6', background: '#3B82F615', fontFamily: fontFamily.mono }}>{trajectory.confidence}% confidence</span>
              )}
            </div>
            {trajectory.projected_state && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-[#9FB0C3]">Projected state:</span>
                <span className="text-xs font-semibold" style={{ color: ST_COLORS[trajectory.projected_state]?.c || '#64748B', fontFamily: fontFamily.mono }}>{trajectory.projected_state}</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Best case', value: trajectory.best_case, color: '#10B981' },
                { label: 'Base case', value: trajectory.base_case, color: '#F59E0B' },
                { label: 'Worst case', value: trajectory.worst_case, color: '#EF4444' },
              ].filter(s => s.value).map(s => (
                <div key={s.label} className="p-3 rounded-lg" style={{ background: s.color + '06', border: `1px solid ${s.color}20` }}>
                  <span className="text-[10px] block mb-1" style={{ color: s.color, fontFamily: fontFamily.mono }}>{s.label}</span>
                  <p className="text-xs text-[#9FB0C3] leading-relaxed">{s.value}</p>
                </div>
              ))}
            </div>
            {trajectory.key_variable && (
              <p className="text-xs text-[#3B82F6] mt-3" style={{ fontFamily: fontFamily.mono }}>Key variable: {trajectory.key_variable}</p>
            )}
          </div>
        )}

        {/* ═══ SECTION 3 — Strategic Moves (with impact bands) ═══ */}
        {filteredMoves.length > 0 && (
          <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', animation: 'snapFade 1s ease-out' }} data-testid="snapshot-moves">
            <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Strategic Moves</h3>
            <div className="space-y-3">
              {filteredMoves.map((m, i) => (
                <div key={i} className="p-4 rounded-lg" style={{ background: 'var(--biqc-bg)', border: '1px solid rgba(140,170,210,0.15)80' }}>
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold text-[#E85D00] mt-0.5" style={{ fontFamily: fontFamily.mono }}>#{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#EDF1F7] mb-1" style={{ fontFamily: fontFamily.display }}>{m.move}</p>
                      <p className="text-xs text-[#9FB0C3] leading-relaxed mb-2">{m.rationale}</p>
                      <div className="flex flex-wrap gap-2">
                        {m.measurable_outcome && <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#10B981', background: '#10B98110', fontFamily: fontFamily.mono }}>{m.measurable_outcome}</span>}
                        {m.timeframe_days && <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#3B82F6', background: '#3B82F610', fontFamily: fontFamily.mono }}>{m.timeframe_days}d window</span>}
                        {m.impact_band?.low != null && m.impact_band?.high != null && (
                          <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#F59E0B', background: '#F59E0B10', fontFamily: fontFamily.mono }}>
                            ${m.impact_band.low}K-${m.impact_band.high}K impact
                          </span>
                        )}
                        {m.confidence != null && <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{m.confidence}% confidence</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ SECTION 4 — Blindside Risk ═══ */}
        {showBlindside && (
          <div className="rounded-xl p-5 mb-6" style={{ background: '#EF444406', border: '1px solid #EF444420', animation: 'snapFade 1.1s ease-out' }} data-testid="snapshot-blindside">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
              <h3 className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Blindside Risk</h3>
              {blindside.probability != null && <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#EF4444', background: '#EF444415', fontFamily: fontFamily.mono }}>{blindside.probability_band || `${blindside.probability}%`}</span>}
            </div>
            <p className="text-sm text-[#EDF1F7] mb-2" style={{ fontFamily: fontFamily.display }}>{blindside.risk}</p>
            <p className="text-xs text-[#9FB0C3] leading-relaxed mb-2">{blindside.evidence}</p>
            <div className="flex flex-wrap gap-2">
              {blindside.time_window_days && <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#EF4444', background: '#EF444410', fontFamily: fontFamily.mono }}>{blindside.time_window_days}d window</span>}
              {blindside.severity != null && <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#EF4444', background: '#EF444410', fontFamily: fontFamily.mono }}>severity {blindside.severity}/100</span>}
              {blindside.confidence != null && <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{blindside.confidence}% confidence</span>}
            </div>
            {blindside.prevention_action && <p className="text-xs text-[#10B981] mt-2" style={{ fontFamily: fontFamily.mono }}>Prevention: {blindside.prevention_action}</p>}
          </div>
        )}

        {/* ═══ SECTION 5 — Hidden Growth Lever ═══ */}
        {showLever && (
          <div className="rounded-xl p-5 mb-6" style={{ background: '#10B98106', border: '1px solid #10B98120', animation: 'snapFade 1.2s ease-out' }} data-testid="snapshot-lever">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#10B981]" />
              <h3 className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Hidden Growth Lever</h3>
              {lever.underutilisation_score != null && <span className="text-[10px] px-2 py-0.5 rounded ml-auto" style={{ color: '#10B981', background: '#10B98115', fontFamily: fontFamily.mono }}>{lever.underutilisation_score}% underutilised</span>}
            </div>
            <p className="text-sm text-[#EDF1F7] mb-2" style={{ fontFamily: fontFamily.display }}>{lever.lever}</p>
            <p className="text-xs text-[#9FB0C3] leading-relaxed mb-2">{lever.evidence}</p>
            <div className="flex flex-wrap gap-2">
              {lever.upside_band?.low != null && lever.upside_band?.high != null && (
                <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#10B981', background: '#10B98110', fontFamily: fontFamily.mono }}>${lever.upside_band.low}K-${lever.upside_band.high}K upside</span>
              )}
              {lever.potential_value && <span className="text-[10px] text-[#10B981]" style={{ fontFamily: fontFamily.mono }}>{lever.potential_value}</span>}
              {lever.confidence != null && <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{lever.confidence}% confidence</span>}
            </div>
            {lever.first_step && <p className="text-xs text-[#3B82F6] mt-2" style={{ fontFamily: fontFamily.mono }}>First step: {lever.first_step}</p>}
          </div>
        )}

        {/* ═══ SECTION 6 — Data Gaps Limiting Confidence ═══ */}
        {dataGaps.length > 0 && (
          <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--biqc-bg-card)', border: '1px solid #F59E0B20', animation: 'snapFade 1.3s ease-out' }} data-testid="snapshot-data-gaps">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="w-4 h-4 text-[#F59E0B]" />
              <h3 className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Data Gaps Limiting Confidence</h3>
            </div>
            <div className="space-y-2">
              {dataGaps.map((gap, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: gap.status === 'not_connected' ? '#EF4444' : gap.status === 'stale' ? '#F59E0B' : '#64748B' }} />
                    <span className="text-xs text-[#9FB0C3]">{gap.area}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: gap.status === 'not_connected' ? '#EF4444' : '#F59E0B', background: (gap.status === 'not_connected' ? '#EF4444' : '#F59E0B') + '10', fontFamily: fontFamily.mono }}>{gap.status?.replace('_', ' ')}</span>
                  </div>
                  <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>-{gap.impact_on_confidence || '?'}% confidence</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No CRM notice (fallback when data_gaps not populated) */}
        {!hasCRMSource && dataGaps.length === 0 && (
          <div className="rounded-xl p-4 mb-6" style={{ background: '#F59E0B08', border: '1px solid #F59E0B20', animation: 'snapFade 1.3s ease-out' }}>
            <p className="text-xs text-[#F59E0B] leading-relaxed" style={{ fontFamily: fontFamily.mono }}>
              Pipeline, lead, and churn metrics require CRM integration. Connect HubSpot or your CRM to unlock internal performance analysis.
            </p>
          </div>
        )}

        {/* ═══ SECTION 7 — Snapshot Confidence (Insight Performance Preview) ═══ */}
        {snapshotConfidence != null && (
          <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', animation: 'snapFade 1.4s ease-out' }} data-testid="snapshot-confidence">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-[#3B82F6]" />
              <h3 className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Snapshot Confidence</h3>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-3xl font-bold" style={{ color: snapshotConfidence > 70 ? '#10B981' : snapshotConfidence > 40 ? '#F59E0B' : '#EF4444', fontFamily: fontFamily.mono }}>{Math.round(snapshotConfidence)}%</span>
              <div className="flex-1">
                <div className="h-2 rounded-full" style={{ background: 'rgba(140,170,210,0.15)' }}>
                  <div className="h-2 rounded-full transition-all" style={{ width: `${snapshotConfidence}%`, background: snapshotConfidence > 70 ? '#10B981' : snapshotConfidence > 40 ? '#F59E0B' : '#EF4444' }} />
                </div>
                <p className="text-[10px] text-[#64748B] mt-1" style={{ fontFamily: fontFamily.mono }}>
                  {snapshotConfidence > 70 ? 'Strong data coverage' : snapshotConfidence > 40 ? 'Moderate — connect more systems to improve' : 'Limited — most insights based on public signals only'}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-[#64748B] mt-3" style={{ fontFamily: fontFamily.mono }}>
              Insight performance tracking active. Predictions stored for future accuracy measurement.
            </p>
          </div>
        )}

        {/* Executive Memo */}
        {memo && (
          <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', animation: 'snapFade 1.5s ease-out' }}>
            <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>AI Advisory</h3>
            <p className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: fontFamily.body }}>{memo.substring(0, 500)}</p>
          </div>
        )}

        {/* Alignment */}
        {(alignment || contradictions.length > 0) && (
          <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--biqc-bg-card)', border: '1px solid #F59E0B25', animation: 'snapFade 1.6s ease-out' }}>
            <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>Alignment Check</h3>
            {alignment && <p className="text-sm text-[#9FB0C3] leading-relaxed mb-3" style={{ fontFamily: fontFamily.body }}>{alignment}</p>}
            {contradictions.map((ct, i) => (
              <div key={i} className="px-3 py-2 rounded-lg mb-2" style={{ background: '#F59E0B10', border: '1px solid #F59E0B25' }}>
                <p className="text-xs" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>{'\u26A0'} {ct}</p>
              </div>
            ))}
          </div>
        )}

        {/* No data — ANALYZING state — show stage progress bar */}
        {!isReady && (
          <div className="rounded-xl p-6 mb-6" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }} data-testid="snapshot-analyzing-state">
            <div className="mb-4">
              <StageProgressBar stage={snapshotStage} startedAt={startedAt} />
            </div>
            <p className="text-xs text-center mt-3" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
              Intelligence snapshot will populate as BIQc analyses your systems.
            </p>
          </div>
        )}

        {/* Sources */}
        {sources.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8" style={{ animation: 'snapFade 1.7s ease-out' }}>
            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Sources:</span>
            {sources.map((s, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: 'var(--biqc-text-2)', background: 'var(--biqc-bg-card)', fontFamily: fontFamily.mono }}>{s}</span>
            ))}
          </div>
        )}

        {/* CTA — GATED: hidden while loading, 20s dwell after render, then reveal */}
        {ctaVisible ? (
          <div className="text-center" style={{ animation: 'ctaReveal 0.6s ease-out' }}>
            <button onClick={onContinue}
              className="px-10 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 inline-flex items-center gap-2"
              style={{ background: '#E85D00', fontFamily: fontFamily.display }}
              data-testid="cmo-continue-btn">
              Continue to Intelligence Platform <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[10px] text-[#64748B] mt-3" style={{ fontFamily: fontFamily.mono }}>
              {isReady ? 'Your intelligence will sharpen as more data connects' : 'Analysis continues in the background — you\'ll be notified when ready'}
            </p>
            {!isReady && (
              <div className="flex justify-center gap-3 mt-3">
                <a href="mailto:support@biqc.com.au" className="text-[10px] text-[#64748B] hover:text-[#9FB0C3] underline" style={{ fontFamily: fontFamily.mono }}>
                  Contact support
                </a>
                <span className="text-[10px] text-[#3A4A5C]">·</span>
                <a href="/knowledge-base" className="text-[10px] text-[#64748B] hover:text-[#9FB0C3] underline" style={{ fontFamily: fontFamily.mono }}>
                  Troubleshooting guide
                </a>
              </div>
            )}
          </div>
        ) : contentRendered ? (
          <div className="text-center">
            <p className="text-xs text-[#64748B] animate-pulse" style={{ fontFamily: fontFamily.mono }}>Reviewing your intelligence snapshot...</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const ForensicCalibrationUI = ({ onSkip }) => (
  <div className="flex-1 overflow-y-auto" style={{ background: 'var(--biqc-bg)' }} data-testid="forensic-calibration">
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4" style={{ background: '#E85D0015', border: '1px solid #E85D0030' }}>
          <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>Premium Intelligence</span>
        </div>
        <h1 className="text-2xl font-bold text-[#EDF1F7] mb-3" style={{ fontFamily: fontFamily.display }}>Forensic Business Calibration</h1>
        <p className="text-sm text-[#9FB0C3] max-w-md mx-auto" style={{ fontFamily: fontFamily.body }}>
          Deep-dive analysis of your competitive position, revenue architecture, and strategic alignment.
        </p>
      </div>
      <div className="text-center space-y-3">
        <button className="px-10 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
          style={{ background: 'linear-gradient(135deg, #E85D00, #E85D00)', fontFamily: fontFamily.display, boxShadow: '0 8px 32px rgba(232,93,0,0.3)' }}
          data-testid="forensic-unlock-btn">
          Unlock Forensic Calibration
        </button>
        <p className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>Coming soon — included in Pro plan</p>
        {onSkip && (
          <button onClick={onSkip} className="text-xs text-[#64748B] hover:text-[#9FB0C3] transition-colors" data-testid="forensic-skip-btn">
            Continue with standard calibration
          </button>
        )}
      </div>
    </div>
  </div>
);
