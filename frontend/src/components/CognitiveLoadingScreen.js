import React, { useState, useEffect, useMemo } from 'react';
import { fontFamily } from '../design-system/tokens';


/**
 * CognitiveIgnitionScreen — Phase 1: Cinematic ignition.
 * Merges CognitiveLoadingScreen + InitiatingBIQC + onboard-welcome into single state.
 * Max 6 seconds. No spinners. Smoke + lightning pulse.
 */
export const CognitiveIgnitionScreen = ({ onComplete, ownerName = '' }) => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1500);
    const t2 = setTimeout(() => setPhase(2), 3000);
    const t3 = setTimeout(() => setPhase(3), 5000);
    // NO auto-advance — user must click "Meet BIQc"
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-6 relative overflow-hidden" style={{ background: 'var(--biqc-bg)' }} data-testid="cognitive-ignition">
      <style>{`
        @keyframes ignSmoke{0%{opacity:0;transform:scale(0.8) translateY(20px)}50%{opacity:0.06}100%{opacity:0;transform:scale(1.4) translateY(-40px)}}
        @keyframes ignPulse{0%,100%{box-shadow:0 0 30px rgba(232,93,0,0.15)}50%{box-shadow:0 0 80px rgba(232,93,0,0.4)}}
        @keyframes ignLightning{0%,90%,100%{opacity:0}92%,98%{opacity:0.03}}
        @keyframes ignFadeUp{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes ignBar{0%{width:0}100%{width:100%}}
      `}</style>

      {/* Smoke layers */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, #E85D00 0%, transparent 70%)', animation: 'ignSmoke 4s ease-out infinite', opacity: 0 }} />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, #3B82F6 0%, transparent 70%)', animation: 'ignSmoke 5s ease-out infinite 1s', opacity: 0 }} />
      </div>

      {/* Lightning flash */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: '#FFFFFF', animation: 'ignLightning 3s ease infinite' }} />

      <div className="max-w-xl w-full text-center relative z-10">
        {/* Logo */}
        <div className="mb-10" style={{ animation: 'ignFadeUp 1s ease-out' }}>
          <div style={{ animation: 'ignPulse 2s ease-in-out infinite' }}>
            <img src="/biqc-horizontal-light.svg" alt="BIQc.ai" style={{ width: 96, height: 'auto', margin: '0 auto' }} />
          </div>
        </div>

        {/* Phase 0-1: Header */}
        <div style={{ animation: 'ignFadeUp 1.2s ease-out', opacity: phase >= 0 ? 1 : 0, transition: 'opacity 0.8s ease' }}>
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--ink-display)] mb-4 tracking-tight" style={{ fontFamily: fontFamily.display }}>
            {ownerName ? `Welcome to BIQc, ${ownerName}.` : 'Welcome to BIQc.'}
          </h1>
        </div>

        {/* Phase 1: Subheader */}
        <div style={{ opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? 'translateY(0)' : 'translateY(12px)', transition: 'all 0.8s ease' }}>
          <p className="text-lg text-[var(--ink-secondary)] mb-8" style={{ fontFamily: fontFamily.body }}>
            This is not a dashboard. It's a strategic intelligence system.
          </p>
        </div>

        {/* Phase 2: 4 Feature Areas */}
        <div style={{ opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? 'translateY(0)' : 'translateY(12px)', transition: 'all 0.8s ease' }}>
          <div className="max-w-md mx-auto mb-10 space-y-3">
            {[
              { title: 'Market Intelligence', desc: 'Real-time positioning, competitive signals, and drift analysis.' },
              { title: 'Revenue & Operations', desc: 'Pipeline health, SOP compliance, bottleneck detection.' },
              { title: 'Risk & Compliance', desc: 'Financial exposure, regulatory obligations, threat monitoring.' },
              { title: 'Autonomous Execution', desc: 'AI-driven alerts, actions, and automations across your business.' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg text-left" style={{ background: 'color-mix(in srgb, var(--surface) 50%, transparent)', border: '1px solid rgba(140,170,210,0.15)60' }}>
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: '#E85D0015' }}>
                  <span className="text-xs font-bold" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>{i + 1}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--ink-display)]" style={{ fontFamily: fontFamily.display }}>{item.title}</p>
                  <p className="text-xs text-[var(--ink-muted)] mt-0.5" style={{ fontFamily: fontFamily.body }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Phase 3: CTA */}
        <div style={{ opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? 'translateY(0)' : 'translateY(12px)', transition: 'all 0.8s ease' }}>
          <button onClick={onComplete}
            className="px-10 py-4 rounded-xl text-base font-semibold text-white transition-all hover:brightness-110 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #E85D00, #E85D00)', fontFamily: fontFamily.display, boxShadow: '0 8px 32px rgba(232,93,0,0.3)' }}
            data-testid="ignition-cta">
            Meet BIQc
          </button>
        </div>

        {/* Progress */}
        <div className="max-w-xs mx-auto mt-8">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(140,170,210,0.15)' }}>
            <div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #E85D00, #3B82F6)', animation: 'ignBar 6s ease-in-out' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * CognitiveLoadingScreen — Returning user intelligence update.
 * Used when cache exists and background refresh is happening.
 */
export const CognitiveLoadingScreen = ({ mode = 'first', ownerName = '' }) => {
  const [progress, setProgress] = useState(0);

  const PACKS = useMemo(() => [
    { headline: 'your agents never sleep', sub: 'While you recharged, your digital team was on watch.', steps: ['Reviewing 24 hours of business signals', 'Analysing communication changes', 'Updating risk assessments', 'Finalising your intelligence update'] },
    { headline: 'we caught some things overnight', sub: 'Your competitors moved, your inbox filled up, and deals shifted.', steps: ['Scanning overnight market signals', 'Analysing new email patterns', 'Detecting risks & opportunities', 'Updating your executive briefing'] },
    { headline: 'things have changed since yesterday', sub: 'New signals detected across your business.', steps: ['Checking what competitors did overnight', 'Processing new CRM activity', 'Recalculating your positions', 'Preparing your morning brief'] },
  ], []);

  const pack = useMemo(() => PACKS[Math.floor(Math.random() * PACKS.length)], [PACKS]);

  useEffect(() => {
    const duration = 8000;
    const interval = setInterval(() => setProgress(p => Math.min(p + 1, 100)), duration / 100);
    return () => clearInterval(interval);
  }, []);

  const visibleSteps = pack.steps.filter((_, i) => progress > (i / pack.steps.length) * 80);

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-6" style={{ background: 'var(--biqc-bg)' }} data-testid="cognitive-loading">
      <style>{`
        @keyframes cogFadeUp{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes cogPulseGlow{0%,100%{box-shadow:0 0 20px rgba(232,93,0,0.2)}50%{box-shadow:0 0 40px rgba(232,93,0,0.5)}}
        @keyframes cogOrbit{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes cogDotStep{0%,100%{opacity:0.3}50%{opacity:1}}
      `}</style>

      <div className="max-w-lg w-full text-center">
        <div className="relative w-32 h-32 mx-auto mb-8">
          <div className="absolute inset-0 flex items-center justify-center">
            <div style={{ animation: 'cogPulseGlow 2s ease-in-out infinite' }}>
              <img src="/biqc-horizontal-light.svg" alt="BIQc.ai" style={{ width: 84, height: 'auto' }} />
            </div>
          </div>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="absolute inset-0" style={{ animation: `cogOrbit ${3 + i * 0.5}s linear infinite`, animationDelay: `${i * 0.3}s` }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full" style={{ background: ['#E85D00', '#3B82F6', '#10B981', '#7C3AED', '#F59E0B', '#EF4444'][i], opacity: 0.7 }} />
            </div>
          ))}
        </div>

        <div style={{ animation: 'cogFadeUp 0.6s ease-out' }}>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--ink-display)] mb-3 tracking-tight" style={{ fontFamily: fontFamily.display }}>
            {ownerName ? `${ownerName}, ` : ''}{pack.headline}
          </h2>
          <p className="text-base text-[var(--ink-secondary)] leading-relaxed mb-8" style={{ fontFamily: fontFamily.body }}>{pack.sub}</p>
        </div>

        <div className="space-y-3 text-left max-w-sm mx-auto mb-8">
          {visibleSteps.map((step, i) => (
            <div key={i} className="flex items-center gap-3" style={{ animation: 'cogFadeUp 0.5s ease-out both' }}>
              <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: ['#E85D00', '#3B82F6', '#10B981', '#7C3AED'][i % 4] + '20' }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: ['#E85D00', '#3B82F6', '#10B981', '#7C3AED'][i % 4], animation: `cogDotStep 1.4s ease-in-out infinite ${i * 0.2}s` }} />
              </div>
              <span className="text-sm text-[var(--ink-secondary)]" style={{ fontFamily: fontFamily.mono }}>{step}</span>
            </div>
          ))}
        </div>

        <div className="max-w-xs mx-auto">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(140,170,210,0.15)' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #E85D00, #3B82F6, #10B981)' }} />
          </div>
          <p className="text-[10px] text-[var(--ink-muted)] mt-2" style={{ fontFamily: fontFamily.mono }}>Updating your intelligence...</p>
        </div>
      </div>
    </div>
  );
};
