import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Shield, Activity, ArrowRight, Target, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";
const BODY = "'Inter', sans-serif";

const ST_COLORS = {
  STABLE: { c: '#10B981', label: 'Stable' },
  DRIFT: { c: '#F59E0B', label: 'Drift Detected' },
  COMPRESSION: { c: '#FF6A00', label: 'Compression' },
  CRITICAL: { c: '#EF4444', label: 'Critical' },
};

/**
 * Phase 4 — Executive CMO Snapshot
 * Renders intelligence BEFORE asking calibration questions.
 * Visual only — reads from biqc-insights-cognitive output. No new AI pipeline.
 */
export const ExecutiveCMOSnapshot = ({ intelligenceData, onContinue }) => {
  const c = intelligenceData?.cognitive || {};
  const stateStatus = typeof c.system_state === 'object' ? c.system_state?.status : c.system_state;
  const confidence = typeof c.system_state === 'object' ? c.system_state?.confidence : c.confidence_level;
  const interpretation = typeof c.system_state === 'object' ? c.system_state?.interpretation : c.system_state_interpretation;
  const velocity = typeof c.system_state === 'object' ? c.system_state?.velocity : null;
  const st = ST_COLORS[stateStatus] || ST_COLORS.STABLE;
  const sources = intelligenceData?.data_sources || [];

  // Extract metrics from cognitive output (read-only — no computation)
  const pipeline = c.pipeline_total;
  const slaBreaches = c.sla_breaches || c.execution?.sla_breaches;
  const memo = c.executive_memo || c.memo || '';
  const alignment = c.strategic_alignment_check || c.alignment?.narrative || '';
  const contradictions = c.alignment?.contradictions || [];

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#0F1720' }} data-testid="cmo-snapshot">
      <style>{`@keyframes snapFade{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}`}</style>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="text-center mb-10" style={{ animation: 'snapFade 0.6s ease-out' }}>
          <span className="text-[10px] font-semibold tracking-widest uppercase mb-3 block" style={{ color: '#FF6A00', fontFamily: MONO }}>
            Executive Intelligence Snapshot
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F4F7FA] mb-2" style={{ fontFamily: HEAD }}>
            Here's what BIQc sees.
          </h1>
          <p className="text-sm text-[#9FB0C3]" style={{ fontFamily: BODY }}>
            Before we calibrate your preferences, review your current market position.
          </p>
        </div>

        {/* System State — Phase 5 Drift Visual */}
        <div className="rounded-xl p-5 mb-6" style={{ background: st.c + '08', border: `1px solid ${st.c}25`, animation: 'snapFade 0.8s ease-out' }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: st.c, boxShadow: `0 0 12px ${st.c}50` }} />
              <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: st.c, fontFamily: MONO }}>
                {stateStatus || 'ANALYZING'}
              </span>
              {velocity && (
                <span className="text-xs" style={{ color: st.c }}>
                  {velocity === 'worsening' ? '↘' : velocity === 'improving' ? '↗' : '→'} {velocity}
                </span>
              )}
            </div>
            {confidence && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: st.c, background: `${st.c}15`, fontFamily: MONO }}>
                {typeof confidence === 'number' ? `${confidence}% confidence` : confidence}
              </span>
            )}
          </div>
          {interpretation && (
            <p className="text-sm mt-3 text-[#9FB0C3] leading-relaxed" style={{ fontFamily: BODY }}>{interpretation}</p>
          )}
        </div>

        {/* Drift Delta Bars — Phase 5 Visual Only (reads existing system_state) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6" style={{ animation: 'snapFade 1s ease-out' }}>
          {[
            { label: 'Pipeline', value: pipeline ? `$${Math.round(pipeline / 1000)}K` : '—', icon: TrendingUp, status: 'good' },
            { label: 'SLA Health', value: slaBreaches ? `${slaBreaches} breach${slaBreaches > 1 ? 'es' : ''}` : 'Clear', icon: AlertTriangle, status: slaBreaches > 0 ? 'warning' : 'good' },
            { label: 'Market State', value: st.label, icon: Shield, status: stateStatus === 'STABLE' ? 'good' : 'warning' },
            { label: 'Competitive Position', value: stateStatus === 'CRITICAL' ? 'At Risk' : stateStatus === 'DRIFT' ? 'Under Pressure' : 'Holding', icon: Target, status: stateStatus === 'STABLE' ? 'good' : 'warning' },
          ].map(m => {
            const barColor = m.status === 'good' ? '#10B981' : '#F59E0B';
            return (
              <div key={m.label} className="p-3 rounded-lg" style={{ background: '#141C26', border: '1px solid #243140' }}>
                <div className="flex items-center gap-2 mb-2">
                  <m.icon className="w-3.5 h-3.5" style={{ color: barColor }} />
                  <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{m.label}</span>
                </div>
                <span className="text-lg font-bold text-[#F4F7FA] block" style={{ fontFamily: MONO }}>{m.value}</span>
                {/* Delta bar — visual drift indicator */}
                <div className="h-1 rounded-full mt-2" style={{ background: '#243140' }}>
                  <div className="h-1 rounded-full" style={{ background: barColor, width: m.status === 'good' ? '80%' : '45%', transition: 'width 1s ease' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Executive Memo */}
        {memo && (
          <div className="rounded-xl p-5 mb-6" style={{ background: '#141C26', border: '1px solid #243140', animation: 'snapFade 1.2s ease-out' }}>
            <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#64748B', fontFamily: MONO }}>AI Advisory</h3>
            <p className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: BODY }}>{memo.substring(0, 500)}</p>
          </div>
        )}

        {/* Alignment / Misalignment — Phase 7 visual (reads existing data, no new engine) */}
        {(alignment || contradictions.length > 0) && (
          <div className="rounded-xl p-5 mb-6" style={{ background: '#141C26', border: '1px solid #F59E0B25', animation: 'snapFade 1.4s ease-out' }}>
            <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#F59E0B', fontFamily: MONO }}>Alignment Check</h3>
            {alignment && <p className="text-sm text-[#9FB0C3] leading-relaxed mb-3" style={{ fontFamily: BODY }}>{alignment}</p>}
            {contradictions.map((ct, i) => (
              <div key={i} className="px-3 py-2 rounded-lg mb-2" style={{ background: '#F59E0B10', border: '1px solid #F59E0B25' }}>
                <p className="text-xs" style={{ color: '#F59E0B', fontFamily: MONO }}>&#x26A0; {ct}</p>
              </div>
            ))}
          </div>
        )}

        {/* No data fallback */}
        {!memo && !stateStatus && (
          <div className="rounded-xl p-8 mb-6 text-center" style={{ background: '#141C26', border: '1px solid #243140' }}>
            <p className="text-sm text-[#64748B]" style={{ fontFamily: BODY }}>
              Intelligence snapshot will populate as BIQc connects to your systems.
            </p>
          </div>
        )}

        {/* Sources */}
        {sources.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8" style={{ animation: 'snapFade 1.6s ease-out' }}>
            <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>Sources:</span>
            {sources.map((s, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#9FB0C3', background: '#141C26', fontFamily: MONO }}>{s}</span>
            ))}
          </div>
        )}

        {/* Continue CTA — delayed 3s fade-in for perceived intelligence pacing */}
        <div className="text-center" style={{ animation: 'snapFade 3s ease-out' }}>
          <button onClick={onContinue}
            className="px-10 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 inline-flex items-center gap-2"
            style={{ background: '#FF6A00', fontFamily: HEAD }}
            data-testid="cmo-continue-btn">
            Continue to Dashboard <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[10px] text-[#64748B] mt-3" style={{ fontFamily: MONO }}>
            Your intelligence will sharpen as more data connects
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Phase 8 — Forensic Calibration UI Shell
 * UI only. No server gating. No entitlement middleware.
 * Stripe not integrated — shows premium module without enforcement.
 */
export const ForensicCalibrationUI = ({ onSkip }) => (
  <div className="flex-1 overflow-y-auto" style={{ background: '#0F1720' }} data-testid="forensic-calibration">
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4" style={{ background: '#FF6A0015', border: '1px solid #FF6A0030' }}>
          <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#FF6A00', fontFamily: MONO }}>Premium Intelligence</span>
        </div>
        <h1 className="text-2xl font-bold text-[#F4F7FA] mb-3" style={{ fontFamily: HEAD }}>Forensic Business Calibration</h1>
        <p className="text-sm text-[#9FB0C3] max-w-md mx-auto" style={{ fontFamily: BODY }}>
          Deep-dive analysis of your competitive position, revenue architecture, and strategic alignment.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {[
          { title: 'Competitive Positioning Audit', desc: 'AI-powered analysis of how you rank against direct competitors on pricing, service quality, and market perception.', icon: Target },
          { title: 'Revenue Architecture Scan', desc: 'Identify concentration risk, pricing gaps, and untapped revenue streams in your current business model.', icon: BarChart3 },
          { title: 'Strategic Misalignment Detection', desc: 'Surface contradictions between your stated goals and actual business behaviour patterns.', icon: AlertTriangle },
          { title: 'Growth Pressure Map', desc: 'Visualise the forces accelerating or constraining your growth trajectory over the next 6-12 months.', icon: TrendingUp },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-4 p-5 rounded-xl" style={{ background: '#141C26', border: '1px solid #243140' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#FF6A0015' }}>
              <item.icon className="w-5 h-5 text-[#FF6A00]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#F4F7FA] mb-1" style={{ fontFamily: HEAD }}>{item.title}</h3>
              <p className="text-xs text-[#9FB0C3] leading-relaxed" style={{ fontFamily: BODY }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center space-y-3">
        <button className="px-10 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
          style={{ background: 'linear-gradient(135deg, #FF6A00, #E85D00)', fontFamily: HEAD, boxShadow: '0 8px 32px rgba(255,106,0,0.3)' }}
          data-testid="forensic-unlock-btn">
          Unlock Forensic Calibration
        </button>
        <p className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>Coming soon — included in Pro plan</p>
        {onSkip && (
          <button onClick={onSkip} className="text-xs text-[#64748B] hover:text-[#9FB0C3] transition-colors" data-testid="forensic-skip-btn">
            Continue with standard calibration
          </button>
        )}
      </div>
    </div>
  </div>
);
