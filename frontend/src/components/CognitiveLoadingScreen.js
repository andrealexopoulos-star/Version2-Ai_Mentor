import React, { useState, useEffect, useMemo } from 'react';

const HEAD = "var(--font-heading)";
const MONO = "var(--font-mono)";
const BODY = "var(--font-body)";

// 30 different fun messages — randomly selected each time
const FIRST_TIME_HEADLINES = [
  "Suiting Up Your Digital Team",
  "Assembling Your War Room",
  "Waking Up Your AI Agents",
  "Brewing Your Intelligence",
  "Loading Your Secret Weapon",
  "Deploying Your Digital Army",
  "Powering Up The Machine",
  "Unleashing The Strategy Squad",
  "Cranking The Intelligence Engine",
  "Booting Your Business Brain",
];

const FIRST_TIME_SUBS = [
  "First time here? We're building something special just for your business. This only happens once.",
  "Your digital leadership team is being assembled. Grab a coffee — this takes about 10 seconds.",
  "We're scanning everything about your business. Your AI agents are stretching and warming up.",
  "BIQc is learning your business DNA. Think of it as your first day with a very fast executive team.",
  "Setting up your command centre. Your competitors have no idea what's about to hit them.",
];

const RETURN_HEADLINES = [
  "missed you",
  "we've been busy while you were away",
  "things have changed since yesterday",
  "your agents never sleep",
  "the market didn't wait — but we watched it for you",
  "your digital team pulled an all-nighter",
  "we caught some things overnight",
  "buckle up — there's news",
  "the boardroom has been buzzing",
  "your agents have a briefing ready",
];

const RETURN_SUBS = [
  "A lot happened in the market and your business. We're pulling it all together now.",
  "Your AI agents have been monitoring everything. Let us compile the overnight intelligence.",
  "While you recharged, your digital team was on watch. Finishing your morning briefing now.",
  "New signals detected across your business. Running a thorough analysis before we brief you.",
  "Your competitors moved, your inbox filled up, and deals shifted. Updating your command centre.",
];

// Fun animated characters/scenes — different each load
const SCENES = [
  // Scene: Rocket launch
  (progress) => (
    <div className="relative w-40 h-40 mx-auto mb-8">
      <style>{`@keyframes rocketShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}} @keyframes flame{0%,100%{transform:scaleY(1);opacity:0.8}50%{transform:scaleY(1.3);opacity:1}} @keyframes smokeR{0%{opacity:0.6;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(40px) scale(2)}} @keyframes starTwinkle{0%,100%{opacity:0.3}50%{opacity:1}}`}</style>
      {[...Array(8)].map((_, i) => (
        <div key={i} className="absolute w-1 h-1 rounded-full bg-white" style={{
          left: `${10 + Math.random() * 80}%`, top: `${Math.random() * 60}%`,
          animation: `starTwinkle ${1 + Math.random() * 2}s ease-in-out infinite`,
          animationDelay: `${Math.random() * 3}s`,
        }} />
      ))}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2" style={{ animation: progress > 60 ? 'rocketShake 0.1s infinite' : 'none' }}>
        <div className="text-6xl" style={{ filter: 'drop-shadow(0 0 20px rgba(249,115,22,0.5))' }}>🚀</div>
        {progress > 30 && <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-6 h-8 rounded-full" style={{
          background: 'linear-gradient(to bottom, #F97316, #EF4444, transparent)',
          animation: 'flame 0.3s ease-in-out infinite',
        }} />}
      </div>
      {progress > 50 && [...Array(3)].map((_, i) => (
        <div key={i} className="absolute bottom-0 left-1/2 w-4 h-4 rounded-full" style={{
          background: 'rgba(148,163,184,0.3)',
          animation: `smokeR 1.5s ease-out infinite`,
          animationDelay: `${i * 0.3}s`,
          transform: `translateX(${(i - 1) * 15}px)`,
        }} />
      ))}
    </div>
  ),
  // Scene: Robot assembling
  (progress) => (
    <div className="relative w-40 h-40 mx-auto mb-8 flex items-center justify-center">
      <style>{`@keyframes robotBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}} @keyframes gearSpin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}} @keyframes eyeBlink{0%,90%,100%{transform:scaleY(1)}95%{transform:scaleY(0.1)}}`}</style>
      <div style={{ animation: 'robotBounce 1.5s ease-in-out infinite' }}>
        <div className="text-7xl" style={{ animation: 'eyeBlink 3s ease-in-out infinite', filter: 'drop-shadow(0 0 20px rgba(37,99,235,0.4))' }}>🤖</div>
      </div>
      {progress > 20 && <div className="absolute top-2 right-6 text-2xl" style={{ animation: 'gearSpin 2s linear infinite' }}>⚙️</div>}
      {progress > 40 && <div className="absolute top-8 left-6 text-2xl" style={{ animation: 'gearSpin 3s linear infinite reverse' }}>⚙️</div>}
      {progress > 60 && <div className="absolute bottom-6 right-8 text-xl" style={{ animation: 'gearSpin 1.5s linear infinite' }}>⚙️</div>}
    </div>
  ),
  // Scene: Magnifying glass detective
  (progress) => (
    <div className="relative w-40 h-40 mx-auto mb-8 flex items-center justify-center">
      <style>{`@keyframes detectiveSearch{0%,100%{transform:translateX(0) rotate(-5deg)}50%{transform:translateX(10px) rotate(5deg)}} @keyframes clueAppear{0%{opacity:0;transform:scale(0.5)}100%{opacity:1;transform:scale(1)}}`}</style>
      <div style={{ animation: 'detectiveSearch 2s ease-in-out infinite' }}>
        <div className="text-7xl" style={{ filter: 'drop-shadow(0 0 15px rgba(249,115,22,0.3))' }}>🔍</div>
      </div>
      {progress > 25 && <div className="absolute top-4 right-4 text-xl" style={{ animation: 'clueAppear 0.5s ease-out' }}>📊</div>}
      {progress > 45 && <div className="absolute bottom-8 left-4 text-xl" style={{ animation: 'clueAppear 0.5s ease-out' }}>💰</div>}
      {progress > 65 && <div className="absolute top-8 left-8 text-xl" style={{ animation: 'clueAppear 0.5s ease-out' }}>📈</div>}
      {progress > 85 && <div className="absolute bottom-4 right-8 text-xl" style={{ animation: 'clueAppear 0.5s ease-out' }}>🎯</div>}
    </div>
  ),
  // Scene: Brain charging
  (progress) => (
    <div className="relative w-40 h-40 mx-auto mb-8 flex items-center justify-center">
      <style>{`@keyframes brainPulse{0%,100%{transform:scale(1);filter:drop-shadow(0 0 10px rgba(124,58,237,0.3))}50%{transform:scale(1.08);filter:drop-shadow(0 0 25px rgba(124,58,237,0.6))}} @keyframes sparkFly{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-30px)}}`}</style>
      <div style={{ animation: 'brainPulse 2s ease-in-out infinite' }}>
        <div className="text-7xl">🧠</div>
      </div>
      {progress > 20 && [...Array(Math.min(Math.floor(progress / 15), 6))].map((_, i) => (
        <div key={i} className="absolute text-sm" style={{
          left: `${20 + Math.random() * 60}%`, top: `${20 + Math.random() * 40}%`,
          animation: `sparkFly 1s ease-out infinite`, animationDelay: `${i * 0.4}s`,
        }}>⚡</div>
      ))}
    </div>
  ),
  // Scene: Coffee & hustle
  (progress) => (
    <div className="relative w-40 h-40 mx-auto mb-8 flex items-center justify-center">
      <style>{`@keyframes steam{0%{opacity:0.6;transform:translateY(0) scaleX(1)}100%{opacity:0;transform:translateY(-20px) scaleX(1.5)}} @keyframes coffeeWiggle{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}`}</style>
      <div style={{ animation: 'coffeeWiggle 1s ease-in-out infinite' }}>
        <div className="text-7xl" style={{ filter: 'drop-shadow(0 0 15px rgba(249,115,22,0.3))' }}>☕</div>
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="absolute text-lg" style={{
          left: `${40 + i * 10}%`, top: '15%',
          animation: `steam 1.5s ease-out infinite`, animationDelay: `${i * 0.4}s`,
          color: 'rgba(255,255,255,0.4)',
        }}>~</div>
      ))}
      {progress > 50 && <div className="absolute bottom-4 right-4 text-2xl" style={{ animation: 'coffeeWiggle 0.5s ease-in-out infinite' }}>💪</div>}
    </div>
  ),
];

const STEP_SETS = {
  first: [
    ["Scanning your digital footprint", "Mapping the competitive landscape", "Assembling your AI agents", "Building your intelligence layer", "Preparing your executive briefing"],
    ["Reading your business DNA", "Detecting market signals", "Calibrating the cognitive engine", "Training your digital team", "Generating your first insights"],
    ["Analysing your industry position", "Identifying revenue patterns", "Setting up risk monitors", "Connecting intelligence feeds", "Compiling your command brief"],
  ],
  returning: [
    ["Scanning overnight market signals", "Analysing new email patterns", "Detecting risks & opportunities", "Updating your executive briefing"],
    ["Checking what competitors did overnight", "Processing new CRM activity", "Recalculating your positions", "Preparing your morning brief"],
    ["Reviewing 24 hours of business signals", "Analysing communication changes", "Updating risk assessments", "Finalising your intelligence update"],
  ],
};

export const CognitiveLoadingScreen = ({ mode = 'first', ownerName = '' }) => {
  const isFirst = mode === 'first';
  const [progress, setProgress] = useState(0);

  // Randomly select content — different every time
  const content = useMemo(() => {
    const r = (arr) => arr[Math.floor(Math.random() * arr.length)];
    return {
      headline: isFirst ? r(FIRST_TIME_HEADLINES) : r(RETURN_HEADLINES),
      sub: isFirst ? r(FIRST_TIME_SUBS) : r(RETURN_SUBS),
      scene: SCENES[Math.floor(Math.random() * SCENES.length)],
      steps: isFirst ? r(STEP_SETS.first) : r(STEP_SETS.returning),
    };
  }, [isFirst]);

  // Animate progress
  useEffect(() => {
    const duration = isFirst ? 12000 : 8000;
    const interval = setInterval(() => {
      setProgress(p => Math.min(p + 1, 100));
    }, duration / 100);
    return () => clearInterval(interval);
  }, [isFirst]);

  const visibleSteps = content.steps.filter((_, i) => {
    const threshold = (i / content.steps.length) * 80;
    return progress > threshold;
  });

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-6" style={{ background: '#0F172A' }} data-testid="cognitive-loading">
      <div className="max-w-lg w-full text-center">

        {/* Animated Scene */}
        {content.scene(progress)}

        {/* Message */}
        <div style={{ animation: 'cogFadeUp 0.6s ease-out' }}>
          <style>{`@keyframes cogFadeUp{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}} @keyframes cogDotPulse{0%,80%,100%{opacity:0.3;transform:scale(0.8)}40%{opacity:1;transform:scale(1.2)}}`}</style>

          {isFirst ? (
            <>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight" style={{ fontFamily: HEAD }}>
                {content.headline}
              </h2>
              <p className="text-base text-slate-400 leading-relaxed mb-8" style={{ fontFamily: BODY }}>
                {content.sub}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 tracking-tight" style={{ fontFamily: HEAD }}>
                {ownerName ? `${ownerName}, ` : ''}{content.headline}
              </h2>
              <p className="text-base text-slate-400 leading-relaxed mb-8 mt-3" style={{ fontFamily: BODY }}>
                {content.sub}
              </p>
            </>
          )}
        </div>

        {/* Steps that fade in */}
        <div className="space-y-3 text-left max-w-sm mx-auto mb-8">
          {visibleSteps.map((step, i) => (
            <div key={i} className="flex items-center gap-3" style={{
              animation: 'cogFadeUp 0.5s ease-out both',
            }}>
              <div className="flex gap-1">
                {[0, 1, 2].map((d) => (
                  <div key={d} className="w-1.5 h-1.5 rounded-full" style={{
                    background: ['#F97316', '#2563EB', '#059669', '#7C3AED', '#EF4444'][i % 5],
                    animation: `cogDotPulse 1.4s ease-in-out infinite`,
                    animationDelay: `${d * 0.2}s`,
                  }} />
                ))}
              </div>
              <span className="text-sm text-slate-400" style={{ fontFamily: MONO }}>{step}</span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="max-w-xs mx-auto">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #F97316, #2563EB, #059669, #7C3AED)',
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
