import React, { useState, useEffect } from 'react';
import { TrendingUp, AlertTriangle, Shield, ArrowRight, Target } from 'lucide-react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";
const BODY = "'Inter', sans-serif";

const ST_COLORS = {
  STABLE: { c: '#10B981', label: 'Stable' },
  DRIFT: { c: '#F59E0B', label: 'Drift Detected' },
  COMPRESSION: { c: '#FF6A00', label: 'Compression' },
  CRITICAL: { c: '#EF4444', label: 'Critical' },
};

// CRM-dependent terms that must be suppressed without integration
const CRM_TERMS = ['pipeline', 'stale lead', 'churn', 'follow-up', 'cashflow', 'follow up', 'leads'];
function containsCRMClaim(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return CRM_TERMS.some(term => lower.includes(term));
}

export const ExecutiveCMOSnapshot = ({ intelligenceData, onContinue }) => {
  const [ctaVisible, setCtaVisible] = useState(false);

  const c = intelligenceData?.cognitive || {};
  const stateStatus = typeof c.system_state === 'object' ? c.system_state?.status : c.system_state;
  const confidence = typeof c.system_state === 'object' ? c.system_state?.confidence : c.confidence_level;
  const interpretation = typeof c.system_state === 'object' ? c.system_state?.interpretation : c.system_state_interpretation;
  const velocity = typeof c.system_state === 'object' ? c.system_state?.velocity : null;
  const st = ST_COLORS[stateStatus] || ST_COLORS.STABLE;
  const sources = intelligenceData?.data_sources || [];

  // Determine if snapshot is ready (has actual data vs still analyzing)
  const isReady = !!(stateStatus && stateStatus !== 'ANALYZING');
  const hasData = !!(c.executive_memo || c.memo || stateStatus);

  // CTA gating: only show after READY + 3s delay
  useEffect(() => {
    if (!isReady) {
      setCtaVisible(false);
      return;
    }
    const timer = setTimeout(() => setCtaVisible(true), 3000);
    return () => clearTimeout(timer);
  }, [isReady]);

  // Integration truth check — suppress CRM claims if no integration source
  const hasCRMSource = sources.some(s => ['crm', 'hubspot', 'email', 'pipeline'].includes(s?.toLowerCase?.()));
  const rawMemo = c.executive_memo || c.memo || '';
  const memo = hasCRMSource ? rawMemo : (containsCRMClaim(rawMemo) ? '' : rawMemo);

  const rawAlignment = c.strategic_alignment_check || c.alignment?.narrative || '';
  const alignment = hasCRMSource ? rawAlignment : (containsCRMClaim(rawAlignment) ? '' : rawAlignment);
  const contradictions = (c.alignment?.contradictions || []).filter(ct => hasCRMSource || !containsCRMClaim(ct));

  // Suppress pipeline metrics without CRM
  const pipeline = hasCRMSource ? c.pipeline_total : null;
  const slaBreaches = hasCRMSource ? (c.sla_breaches || c.execution?.sla_breaches) : null;

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#0F1720' }} data-testid="cmo-snapshot">
      <style>{`
        @keyframes snapFade{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes pulseGlow{0%,100%{opacity:0.3}50%{opacity:1}}
        @keyframes ctaReveal{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
      `}</style>

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

        {/* System State */}
        <div className="rounded-xl p-5 mb-6" style={{ background: st.c + '08', border: `1px solid ${st.c}25`, animation: 'snapFade 0.8s ease-out' }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: st.c, boxShadow: `0 0 12px ${st.c}50`, animation: !isReady ? 'pulseGlow 2s ease-in-out infinite' : 'none' }} />
              <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: st.c, fontFamily: MONO }}>
                {stateStatus || 'ANALYZING'}
              </span>
              {velocity && (
                <span className="text-xs" style={{ color: st.c }}>
                  {velocity === 'worsening' ? '\u2198' : velocity === 'improving' ? '\u2197' : '\u2192'} {velocity}
                </span>
              )}
            </div>
            {confidence && isReady && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: st.c, background: `${st.c}15`, fontFamily: MONO }}>
                {typeof confidence === 'number' ? `${confidence}% confidence` : confidence}
              </span>
            )}
          </div>
          {interpretation && <p className="text-sm mt-3 text-[#9FB0C3] leading-relaxed" style={{ fontFamily: BODY }}>{interpretation}</p>}
        </div>

        {/* Drift Delta Bars */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6" style={{ animation: 'snapFade 1s ease-out' }}>
          {[
            { label: 'Pipeline', value: pipeline ? `$${Math.round(pipeline / 1000)}K` : '\u2014', icon: TrendingUp, status: pipeline ? 'good' : 'none' },
            { label: 'SLA Health', value: slaBreaches ? `${slaBreaches} breach${slaBreaches > 1 ? 'es' : ''}` : 'Clear', icon: AlertTriangle, status: slaBreaches > 0 ? 'warning' : 'good' },
            { label: 'Market State', value: isReady ? st.label : 'Analyzing...', icon: Shield, status: stateStatus === 'STABLE' ? 'good' : 'warning' },
            { label: 'Competitive Position', value: stateStatus === 'CRITICAL' ? 'At Risk' : stateStatus === 'DRIFT' ? 'Under Pressure' : 'Holding', icon: Target, status: stateStatus === 'STABLE' ? 'good' : 'warning' },
          ].map(m => {
            const barColor = m.status === 'good' ? '#10B981' : m.status === 'none' ? '#243140' : '#F59E0B';
            return (
              <div key={m.label} className="p-3 rounded-lg" style={{ background: '#141C26', border: '1px solid #243140' }}>
                <div className="flex items-center gap-2 mb-2">
                  <m.icon className="w-3.5 h-3.5" style={{ color: barColor }} />
                  <span className="text-[10px] text-[#64748B]" style={{ fontFamily: MONO }}>{m.label}</span>
                </div>
                <span className="text-lg font-bold text-[#F4F7FA] block" style={{ fontFamily: MONO }}>{m.value}</span>
                <div className="h-1 rounded-full mt-2" style={{ background: '#243140' }}>
                  <div className="h-1 rounded-full" style={{ background: barColor, width: m.status === 'good' ? '80%' : m.status === 'none' ? '0%' : '45%', transition: 'width 1s ease' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* No CRM notice */}
        {!hasCRMSource && (
          <div className="rounded-xl p-4 mb-6" style={{ background: '#F59E0B08', border: '1px solid #F59E0B20', animation: 'snapFade 1.1s ease-out' }}>
            <p className="text-xs text-[#F59E0B] leading-relaxed" style={{ fontFamily: MONO }}>
              Pipeline, lead, and churn metrics require CRM integration. Connect HubSpot or your CRM to unlock internal performance analysis.
            </p>
          </div>
        )}

        {/* Executive Memo — suppressed if contains CRM claims without integration */}
        {memo && (
          <div className="rounded-xl p-5 mb-6" style={{ background: '#141C26', border: '1px solid #243140', animation: 'snapFade 1.2s ease-out' }}>
            <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#64748B', fontFamily: MONO }}>AI Advisory</h3>
            <p className="text-sm text-[#9FB0C3] leading-relaxed" style={{ fontFamily: BODY }}>{memo.substring(0, 500)}</p>
          </div>
        )}

        {/* Alignment */}
        {(alignment || contradictions.length > 0) && (
          <div className="rounded-xl p-5 mb-6" style={{ background: '#141C26', border: '1px solid #F59E0B25', animation: 'snapFade 1.4s ease-out' }}>
            <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#F59E0B', fontFamily: MONO }}>Alignment Check</h3>
            {alignment && <p className="text-sm text-[#9FB0C3] leading-relaxed mb-3" style={{ fontFamily: BODY }}>{alignment}</p>}
            {contradictions.map((ct, i) => (
              <div key={i} className="px-3 py-2 rounded-lg mb-2" style={{ background: '#F59E0B10', border: '1px solid #F59E0B25' }}>
                <p className="text-xs" style={{ color: '#F59E0B', fontFamily: MONO }}>{'\u26A0'} {ct}</p>
              </div>
            ))}
          </div>
        )}

        {/* No data fallback — shown when ANALYZING */}
        {!isReady && (
          <div className="rounded-xl p-8 mb-6 text-center" style={{ background: '#141C26', border: '1px solid #243140' }}>
            <div className="flex justify-center mb-4">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#FF6A00', borderTopColor: 'transparent' }} />
            </div>
            <p className="text-sm text-[#9FB0C3]" style={{ fontFamily: BODY }}>
              Generating your executive snapshot...
            </p>
            <p className="text-xs text-[#64748B] mt-2" style={{ fontFamily: MONO }}>
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

        {/* CTA — GATED: Hidden during ANALYZING, delayed 3s fade-in after READY */}
        {ctaVisible ? (
          <div className="text-center" style={{ animation: 'ctaReveal 0.6s ease-out' }}>
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
        ) : isReady ? (
          <div className="text-center">
            <p className="text-xs text-[#64748B] animate-pulse" style={{ fontFamily: MONO }}>Preparing your dashboard...</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

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
