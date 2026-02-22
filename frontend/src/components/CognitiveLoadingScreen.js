import React, { useState, useEffect, useMemo } from 'react';

const HEAD = "var(--font-heading)";
const MONO = "var(--font-mono)";
const BODY = "var(--font-body)";

// Each scene is paired with its headline — animation matches the message
const SCENE_PACKS = [
  {
    emoji: '☕', headline: 'Brewing Your Intelligence',
    sub: 'Grab a coffee — your digital team is warming up. This takes about 10 seconds.',
    anim: (p) => ({ animation: `coffeeWiggle 1.2s ease-in-out infinite`, filter: 'drop-shadow(0 0 20px rgba(249,115,22,0.3))' }),
    extras: (p) => p > 30 ? [{ e: '~', x: '42%', y: '15%', a: 'steam 1.5s ease-out infinite' }, { e: '~', x: '50%', y: '12%', a: 'steam 1.5s ease-out infinite 0.4s' }, { e: '~', x: '58%', y: '14%', a: 'steam 1.5s ease-out infinite 0.8s' }] : [],
  },
  {
    emoji: '🚀', headline: 'Launching Your Command Centre',
    sub: 'Your competitors have no idea what\'s about to hit them.',
    anim: (p) => ({ animation: p > 50 ? 'rocketShake 0.1s infinite' : 'none', filter: 'drop-shadow(0 0 25px rgba(249,115,22,0.5))' }),
    extras: (p) => {
      const stars = Array.from({ length: 5 }, (_, i) => ({ e: '✦', x: `${15 + i * 18}%`, y: `${10 + (i % 3) * 15}%`, a: `starTwinkle ${1.5 + i * 0.3}s ease-in-out infinite ${i * 0.5}s`, size: '10px', color: 'rgba(255,255,255,0.4)' }));
      const flame = p > 25 ? [{ e: '🔥', x: '47%', y: '78%', a: 'flame 0.3s ease-in-out infinite', size: '28px' }] : [];
      return [...stars, ...flame];
    },
  },
  {
    emoji: '🤖', headline: 'Waking Up Your AI Agents',
    sub: 'Your digital leadership team is stretching and warming up.',
    anim: (p) => ({ animation: 'robotBounce 1.5s ease-in-out infinite', filter: 'drop-shadow(0 0 20px rgba(37,99,235,0.4))' }),
    extras: (p) => [
      ...(p > 20 ? [{ e: '⚙️', x: '72%', y: '20%', a: 'gearSpin 2s linear infinite', size: '20px' }] : []),
      ...(p > 40 ? [{ e: '⚙️', x: '25%', y: '25%', a: 'gearSpin 3s linear infinite reverse', size: '16px' }] : []),
      ...(p > 60 ? [{ e: '⚡', x: '65%', y: '45%', a: 'sparkFly 1s ease-out infinite', size: '14px' }] : []),
    ],
  },
  {
    emoji: '🏋️', headline: 'Training Your Digital Team',
    sub: 'Your AI agents are getting in shape. Peak performance incoming.',
    anim: (p) => ({ animation: 'benchPress 0.8s ease-in-out infinite', filter: 'drop-shadow(0 0 15px rgba(5,150,105,0.4))' }),
    extras: (p) => [
      ...(p > 30 ? [{ e: '💪', x: '70%', y: '40%', a: 'curl 0.6s ease-in-out infinite', size: '22px' }] : []),
      ...(p > 60 ? [{ e: '💨', x: '30%', y: '55%', a: 'steam 1s ease-out infinite', size: '16px' }] : []),
    ],
  },
  {
    emoji: '🔍', headline: 'Scanning Your Business',
    sub: 'BIQc is learning everything about your business. Every signal matters.',
    anim: (p) => ({ animation: 'detectiveSearch 2s ease-in-out infinite', filter: 'drop-shadow(0 0 15px rgba(249,115,22,0.3))' }),
    extras: (p) => [
      ...(p > 20 ? [{ e: '📊', x: '73%', y: '22%', a: 'clueAppear 0.5s ease-out both', size: '20px' }] : []),
      ...(p > 45 ? [{ e: '📈', x: '25%', y: '30%', a: 'clueAppear 0.5s ease-out both', size: '20px' }] : []),
      ...(p > 70 ? [{ e: '🎯', x: '68%', y: '60%', a: 'clueAppear 0.5s ease-out both', size: '18px' }] : []),
    ],
  },
  {
    emoji: '🧠', headline: 'Powering Up The Cognitive Engine',
    sub: 'Neurons firing. Patterns forming. Intelligence activating.',
    anim: (p) => ({ animation: 'brainPulse 2s ease-in-out infinite' }),
    extras: (p) => Array.from({ length: Math.min(Math.floor(p / 20), 5) }, (_, i) => ({
      e: '⚡', x: `${25 + Math.sin(i * 1.8) * 25}%`, y: `${20 + Math.cos(i * 1.5) * 20}%`,
      a: `sparkFly 1s ease-out infinite ${i * 0.3}s`, size: '14px',
    })),
  },
  {
    emoji: '🛡️', headline: 'Assembling Your War Room',
    sub: 'Your strategic command centre is being configured.',
    anim: (p) => ({ animation: 'shieldPulse 2s ease-in-out infinite', filter: 'drop-shadow(0 0 20px rgba(37,99,235,0.4))' }),
    extras: (p) => [
      ...(p > 25 ? [{ e: '📡', x: '28%', y: '28%', a: 'gearSpin 4s linear infinite', size: '18px' }] : []),
      ...(p > 50 ? [{ e: '🗺️', x: '70%', y: '32%', a: 'clueAppear 0.5s ease-out both', size: '20px' }] : []),
    ],
  },
  {
    emoji: '⚡', headline: 'Supercharging Your Insights',
    sub: 'We\'re pulling data from every connected source. Stand by for clarity.',
    anim: (p) => ({ animation: 'boltFlash 1.5s ease-in-out infinite', filter: 'drop-shadow(0 0 30px rgba(249,115,22,0.5))' }),
    extras: (p) => [
      ...(p > 30 ? [{ e: '✨', x: '30%', y: '25%', a: 'starTwinkle 1s ease-in-out infinite', size: '14px' }] : []),
      ...(p > 50 ? [{ e: '✨', x: '68%', y: '30%', a: 'starTwinkle 1.2s ease-in-out infinite 0.3s', size: '12px' }] : []),
      ...(p > 70 ? [{ e: '✨', x: '45%', y: '18%', a: 'starTwinkle 0.8s ease-in-out infinite 0.6s', size: '16px' }] : []),
    ],
  },
];

const RETURN_PACKS = [
  { emoji: '🌅', headline: 'missed you', sub: 'A lot happened in the market and your business. Pulling it together now.' },
  { emoji: '🦉', headline: 'your agents pulled an all-nighter', sub: 'While you recharged, your digital team was on watch. Compiling the briefing now.' },
  { emoji: '📰', headline: 'things have changed since yesterday', sub: 'New signals detected across your business. Running a thorough analysis.' },
  { emoji: '🔔', headline: 'we caught some things overnight', sub: 'Your competitors moved, your inbox filled up, and deals shifted.' },
  { emoji: '🎯', headline: 'the boardroom has been buzzing', sub: 'Your AI agents have been monitoring everything. Let us compile the overnight intelligence.' },
  { emoji: '⏰', headline: 'the market didn\'t wait — but we watched it for you', sub: 'Your digital team never sleeps. Finishing your morning briefing now.' },
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

  const pack = useMemo(() => {
    if (isFirst) return SCENE_PACKS[Math.floor(Math.random() * SCENE_PACKS.length)];
    const rp = RETURN_PACKS[Math.floor(Math.random() * RETURN_PACKS.length)];
    // Use a random first-time scene animation for returning users too
    const base = SCENE_PACKS[Math.floor(Math.random() * SCENE_PACKS.length)];
    return { ...base, headline: rp.headline, sub: rp.sub, emoji: rp.emoji };
  }, [isFirst]);

  const steps = useMemo(() => {
    const sets = isFirst ? STEP_SETS.first : STEP_SETS.returning;
    return sets[Math.floor(Math.random() * sets.length)];
  }, [isFirst]);

  useEffect(() => {
    const duration = isFirst ? 12000 : 8000;
    const interval = setInterval(() => setProgress(p => Math.min(p + 1, 100)), duration / 100);
    return () => clearInterval(interval);
  }, [isFirst]);

  const visibleSteps = steps.filter((_, i) => progress > (i / steps.length) * 80);
  const extras = pack.extras ? pack.extras(progress) : [];
  const emojiStyle = pack.anim ? pack.anim(progress) : {};

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-6" style={{ background: '#0F172A' }} data-testid="cognitive-loading">
      <style>{`
        @keyframes coffeeWiggle{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
        @keyframes steam{0%{opacity:0.6;transform:translateY(0)}100%{opacity:0;transform:translateY(-20px)}}
        @keyframes rocketShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}
        @keyframes flame{0%,100%{transform:scaleY(1);opacity:0.8}50%{transform:scaleY(1.3);opacity:1}}
        @keyframes starTwinkle{0%,100%{opacity:0.3}50%{opacity:1}}
        @keyframes robotBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes gearSpin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
        @keyframes detectiveSearch{0%,100%{transform:translateX(0) rotate(-5deg)}50%{transform:translateX(10px) rotate(5deg)}}
        @keyframes clueAppear{0%{opacity:0;transform:scale(0.5)}100%{opacity:1;transform:scale(1)}}
        @keyframes brainPulse{0%,100%{transform:scale(1);filter:drop-shadow(0 0 10px rgba(124,58,237,0.3))}50%{transform:scale(1.08);filter:drop-shadow(0 0 25px rgba(124,58,237,0.6))}}
        @keyframes sparkFly{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-25px)}}
        @keyframes benchPress{0%,100%{transform:translateY(0) scaleY(1)}50%{transform:translateY(3px) scaleY(0.88)}}
        @keyframes curl{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-12deg)}}
        @keyframes shieldPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
        @keyframes boltFlash{0%,100%{opacity:0.7;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}}
        @keyframes cogFadeUp{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes cogDotPulse{0%,80%,100%{opacity:0.3;transform:scale(0.8)}40%{opacity:1;transform:scale(1.2)}}
      `}</style>

      <div className="max-w-lg w-full text-center">
        {/* Main animated emoji */}
        <div className="relative w-48 h-48 mx-auto mb-6">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-7xl" style={emojiStyle}>{pack.emoji}</div>
          </div>
          {/* Contextual extras */}
          {extras.map((ex, i) => (
            <div key={i} className="absolute" style={{
              left: ex.x, top: ex.y,
              animation: ex.a,
              fontSize: ex.size || '16px',
              color: ex.color || 'inherit',
            }}>{ex.e}</div>
          ))}
        </div>

        {/* Message */}
        <div style={{ animation: 'cogFadeUp 0.6s ease-out' }}>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight" style={{ fontFamily: HEAD }}>
            {!isFirst && ownerName ? `${ownerName}, ` : ''}{pack.headline}
          </h2>
          <p className="text-base text-slate-400 leading-relaxed mb-8" style={{ fontFamily: BODY }}>{pack.sub}</p>
        </div>

        {/* Steps */}
        <div className="space-y-3 text-left max-w-sm mx-auto mb-8">
          {visibleSteps.map((step, i) => (
            <div key={i} className="flex items-center gap-3" style={{ animation: 'cogFadeUp 0.5s ease-out both' }}>
              <div className="flex gap-1">
                {[0, 1, 2].map((d) => (
                  <div key={d} className="w-1.5 h-1.5 rounded-full" style={{
                    background: ['#F97316', '#2563EB', '#059669', '#7C3AED', '#EF4444'][i % 5],
                    animation: `cogDotPulse 1.4s ease-in-out infinite ${d * 0.2}s`,
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
