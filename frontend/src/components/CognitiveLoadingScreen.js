import React, { useState, useEffect, useMemo } from 'react';

const HEAD = "'Cormorant Garamond', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";
const BODY = "'Inter', sans-serif";

const FIRST_PACKS = [
  { headline: 'Launching Your Command Centre', sub: 'Your competitors have no idea what\'s about to hit them.', steps: ['Scanning your digital footprint', 'Mapping competitive landscape', 'Calibrating AI agents', 'Building intelligence layer', 'Preparing executive briefing'] },
  { headline: 'Waking Up Your AI Agents', sub: 'Your digital leadership team is stretching and warming up.', steps: ['Reading your business DNA', 'Detecting market signals', 'Calibrating the cognitive engine', 'Training your digital team', 'Generating your first insights'] },
  { headline: 'Powering Up The Cognitive Engine', sub: 'Neurons firing. Patterns forming. Intelligence activating.', steps: ['Analysing your industry position', 'Identifying revenue patterns', 'Setting up risk monitors', 'Connecting intelligence feeds', 'Compiling your command brief'] },
];

const RETURN_PACKS = [
  { headline: 'we caught some things overnight', sub: 'Your competitors moved, your inbox filled up, and deals shifted.', steps: ['Scanning overnight market signals', 'Analysing new email patterns', 'Detecting risks & opportunities', 'Updating your executive briefing'] },
  { headline: 'your agents never sleep', sub: 'While you recharged, your digital team was on watch.', steps: ['Reviewing 24 hours of business signals', 'Analysing communication changes', 'Updating risk assessments', 'Finalising your intelligence update'] },
  { headline: 'things have changed since yesterday', sub: 'New signals detected across your business.', steps: ['Checking what competitors did overnight', 'Processing new CRM activity', 'Recalculating your positions', 'Preparing your morning brief'] },
];

export const CognitiveLoadingScreen = ({ mode = 'first', ownerName = '' }) => {
  const isFirst = mode === 'first';
  const [progress, setProgress] = useState(0);

  const pack = useMemo(() => {
    const packs = isFirst ? FIRST_PACKS : RETURN_PACKS;
    return packs[Math.floor(Math.random() * packs.length)];
  }, [isFirst]);

  useEffect(() => {
    const duration = isFirst ? 12000 : 8000;
    const interval = setInterval(() => setProgress(p => Math.min(p + 1, 100)), duration / 100);
    return () => clearInterval(interval);
  }, [isFirst]);

  const visibleSteps = pack.steps.filter((_, i) => progress > (i / pack.steps.length) * 80);

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-6" style={{ background: '#0F1720' }} data-testid="cognitive-loading">
      <style>{`
        @keyframes cogFadeUp{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes cogPulseGlow{0%,100%{box-shadow:0 0 20px rgba(255,106,0,0.2)}50%{box-shadow:0 0 40px rgba(255,106,0,0.5)}}
        @keyframes cogOrbit{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes cogDotStep{0%,100%{opacity:0.3}50%{opacity:1}}
      `}</style>

      <div className="max-w-lg w-full text-center">
        {/* Branded Animation — Orbiting dots around B logo */}
        <div className="relative w-32 h-32 mx-auto mb-8">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center" style={{ background: '#FF6A00', animation: 'cogPulseGlow 2s ease-in-out infinite' }}>
              <span className="text-white font-bold text-2xl" style={{ fontFamily: MONO }}>B</span>
            </div>
          </div>
          {/* Orbiting dots */}
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="absolute inset-0" style={{ animation: `cogOrbit ${3 + i * 0.5}s linear infinite`, animationDelay: `${i * 0.3}s` }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full" style={{ background: ['#FF6A00', '#3B82F6', '#10B981', '#7C3AED', '#F59E0B', '#EF4444'][i], opacity: 0.7 }} />
            </div>
          ))}
        </div>

        {/* Message */}
        <div style={{ animation: 'cogFadeUp 0.6s ease-out' }}>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#F4F7FA] mb-3 tracking-tight" style={{ fontFamily: HEAD }}>
            {!isFirst && ownerName ? `${ownerName}, ` : ''}{pack.headline}
          </h2>
          <p className="text-base text-[#9FB0C3] leading-relaxed mb-8" style={{ fontFamily: BODY }}>
            {pack.sub}
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-3 text-left max-w-sm mx-auto mb-8">
          {visibleSteps.map((step, i) => (
            <div key={i} className="flex items-center gap-3" style={{ animation: 'cogFadeUp 0.5s ease-out both' }}>
              <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: ['#FF6A00', '#3B82F6', '#10B981', '#7C3AED', '#F59E0B'][i % 5] + '20' }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: ['#FF6A00', '#3B82F6', '#10B981', '#7C3AED', '#F59E0B'][i % 5], animation: `cogDotStep 1.4s ease-in-out infinite ${i * 0.2}s` }} />
              </div>
              <span className="text-sm text-[#9FB0C3]" style={{ fontFamily: MONO }}>{step}</span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="max-w-xs mx-auto">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#243140' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #FF6A00, #3B82F6, #10B981)',
            }} />
          </div>
          <p className="text-[10px] text-[#64748B] mt-2" style={{ fontFamily: MONO }}>
            {isFirst ? 'First-time setup takes ~10 seconds' : 'Updating your intelligence...'}
          </p>
        </div>
      </div>
    </div>
  );
};
