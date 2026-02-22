import React from 'react';

const HEAD = "var(--font-heading)";
const MONO = "var(--font-mono)";
const BODY = "var(--font-body)";

const phases = {
  first: [
    { label: "Scanning your business footprint", delay: 0 },
    { label: "Mapping competitive landscape", delay: 1.2 },
    { label: "Calibrating cognitive agents", delay: 2.4 },
    { label: "Building your intelligence layer", delay: 3.6 },
    { label: "Preparing your executive briefing", delay: 4.8 },
  ],
  returning: [
    { label: "Scanning overnight market signals", delay: 0 },
    { label: "Analysing email & CRM changes", delay: 1.0 },
    { label: "Detecting new risks & opportunities", delay: 2.0 },
    { label: "Updating your executive briefing", delay: 3.0 },
  ],
};

export const CognitiveLoadingScreen = ({ mode = 'first', ownerName = '' }) => {
  const isFirst = mode === 'first';
  const steps = isFirst ? phases.first : phases.returning;

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-6" style={{ background: '#0F172A' }} data-testid="cognitive-loading">
      <style>{`
        @keyframes cogPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes cogOrbit {
          0% { transform: rotate(0deg) translateX(48px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(48px) rotate(-360deg); }
        }
        @keyframes cogFadeUp {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes cogBarGrow {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        @keyframes cogDotPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>

      <div className="max-w-lg w-full text-center">
        {/* Orbital Animation */}
        <div className="relative w-32 h-32 mx-auto mb-10">
          {/* Core */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
              animation: 'cogPulse 2.5s ease-in-out infinite',
              boxShadow: '0 0 40px rgba(249,115,22,0.3)',
            }}>
              <span className="text-white font-black text-lg" style={{ fontFamily: HEAD }}>B</span>
            </div>
          </div>
          {/* Orbiting dots */}
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="absolute inset-0 flex items-center justify-center" style={{
              animation: `cogOrbit ${3 + i * 0.4}s linear infinite`,
              animationDelay: `${i * 0.6}s`,
            }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{
                background: ['#F97316', '#2563EB', '#059669', '#7C3AED', '#EF4444'][i],
                boxShadow: `0 0 12px ${['#F97316', '#2563EB', '#059669', '#7C3AED', '#EF4444'][i]}60`,
              }} />
            </div>
          ))}
        </div>

        {/* Message */}
        <div style={{ animation: 'cogFadeUp 0.6s ease-out' }}>
          {isFirst ? (
            <>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight" style={{ fontFamily: HEAD }}>
                Building Your Intelligence
              </h2>
              <p className="text-base text-slate-400 leading-relaxed mb-8" style={{ fontFamily: BODY }}>
                This is the first time BIQc is building for your business.<br />
                Hang tight while we set up your environment.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight" style={{ fontFamily: HEAD }}>
                Welcome back{ownerName ? `, ${ownerName}` : ''}.
              </h2>
              <p className="text-base text-slate-400 leading-relaxed mb-8" style={{ fontFamily: BODY }}>
                A lot has happened in the market and your business since you last logged on.<br />
                We're completing a thorough analysis.
              </p>
            </>
          )}
        </div>

        {/* Progress Steps */}
        <div className="space-y-3 text-left max-w-sm mx-auto mb-8">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3" style={{
              animation: 'cogFadeUp 0.5s ease-out both',
              animationDelay: `${step.delay}s`,
            }}>
              <div className="flex gap-1">
                {[0, 1, 2].map((d) => (
                  <div key={d} className="w-1.5 h-1.5 rounded-full" style={{
                    background: '#F97316',
                    animation: `cogDotPulse 1.4s ease-in-out infinite`,
                    animationDelay: `${step.delay + d * 0.2}s`,
                  }} />
                ))}
              </div>
              <span className="text-sm text-slate-400" style={{ fontFamily: MONO }}>{step.label}</span>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="max-w-xs mx-auto">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full" style={{
              background: 'linear-gradient(90deg, #F97316, #2563EB, #059669)',
              animation: `cogBarGrow ${isFirst ? '12s' : '8s'} ease-out forwards`,
            }} />
          </div>
          <p className="text-[10px] text-slate-600 mt-2" style={{ fontFamily: MONO }}>
            {isFirst ? 'First-time setup takes ~10 seconds' : 'Updating your intelligence...'}
          </p>
        </div>
      </div>
    </div>
  );
};
