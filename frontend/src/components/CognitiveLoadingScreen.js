import React, { useState, useEffect, useMemo } from 'react';
import Lottie from 'lottie-react';

const HEAD = "var(--font-heading)";
const MONO = "var(--font-mono)";
const BODY = "var(--font-body)";

// Each pack: lottie URL + matched headline + sub + steps
const FIRST_PACKS = [
  {
    lottie: 'https://assets2.lottiefiles.com/packages/lf20_jcikwtux.json', // Rocket
    headline: 'Launching Your Command Centre',
    sub: 'Your competitors have no idea what\'s about to hit them.',
    steps: ['Scanning your digital footprint', 'Mapping competitive landscape', 'Calibrating AI agents', 'Building intelligence layer', 'Preparing executive briefing'],
  },
  {
    lottie: 'https://assets9.lottiefiles.com/packages/lf20_kyu7xb1v.json', // Robot
    headline: 'Waking Up Your AI Agents',
    sub: 'Your digital leadership team is stretching and warming up.',
    steps: ['Reading your business DNA', 'Detecting market signals', 'Calibrating the cognitive engine', 'Training your digital team', 'Generating your first insights'],
  },
  {
    lottie: 'https://assets5.lottiefiles.com/packages/lf20_V9t630.json', // Gears/Process
    headline: 'Building Your Intelligence',
    sub: 'First time here? We\'re building something special just for your business.',
    steps: ['Analysing your industry position', 'Identifying revenue patterns', 'Setting up risk monitors', 'Connecting intelligence feeds', 'Compiling your command brief'],
  },
  {
    lottie: 'https://assets1.lottiefiles.com/packages/lf20_obhph3sh.json', // Search/Scan
    headline: 'Scanning Your Business',
    sub: 'BIQc is learning everything about your business. Every signal matters.',
    steps: ['Scanning your digital footprint', 'Mapping competitive landscape', 'Assembling your AI agents', 'Building intelligence layer', 'Preparing executive briefing'],
  },
  {
    lottie: 'https://assets8.lottiefiles.com/packages/lf20_svy4ivvy.json', // Data/Analytics
    headline: 'Assembling Your War Room',
    sub: 'Your strategic command centre is being configured.',
    steps: ['Reading your business DNA', 'Detecting market signals', 'Calibrating the cognitive engine', 'Training your digital team', 'Generating your first insights'],
  },
  {
    lottie: 'https://assets4.lottiefiles.com/packages/lf20_xyadoh9h.json', // Brain/AI
    headline: 'Powering Up The Cognitive Engine',
    sub: 'Neurons firing. Patterns forming. Intelligence activating.',
    steps: ['Analysing your industry position', 'Identifying revenue patterns', 'Setting up risk monitors', 'Connecting intelligence feeds', 'Compiling your command brief'],
  },
  {
    lottie: 'https://assets3.lottiefiles.com/packages/lf20_szlepvdh.json', // Shield/Security
    headline: 'Securing Your Intelligence Layer',
    sub: 'Setting up your command centre. Australian sovereign data only.',
    steps: ['Scanning your digital footprint', 'Mapping competitive landscape', 'Calibrating AI agents', 'Building intelligence layer', 'Preparing executive briefing'],
  },
  {
    lottie: 'https://assets10.lottiefiles.com/packages/lf20_yd8fbnml.json', // Coffee
    headline: 'Brewing Your Intelligence',
    sub: 'Grab a coffee — your digital team is warming up. This takes about 10 seconds.',
    steps: ['Reading your business DNA', 'Detecting market signals', 'Calibrating the cognitive engine', 'Training your digital team', 'Generating your first insights'],
  },
];

const RETURN_PACKS = [
  {
    lottie: 'https://assets9.lottiefiles.com/packages/lf20_iorpbol0.json', // Notification/Bell
    headline: 'we caught some things overnight',
    sub: 'Your competitors moved, your inbox filled up, and deals shifted.',
    steps: ['Scanning overnight market signals', 'Analysing new email patterns', 'Detecting risks & opportunities', 'Updating your executive briefing'],
  },
  {
    lottie: 'https://assets2.lottiefiles.com/packages/lf20_tll0j4bb.json', // Chart/Growth
    headline: 'things have changed since yesterday',
    sub: 'New signals detected across your business. Running a thorough analysis.',
    steps: ['Checking what competitors did overnight', 'Processing new CRM activity', 'Recalculating your positions', 'Preparing your morning brief'],
  },
  {
    lottie: 'https://assets5.lottiefiles.com/packages/lf20_V9t630.json', // Process
    headline: 'your agents never sleep',
    sub: 'While you recharged, your digital team was on watch. Finishing your morning briefing now.',
    steps: ['Reviewing 24 hours of business signals', 'Analysing communication changes', 'Updating risk assessments', 'Finalising your intelligence update'],
  },
  {
    lottie: 'https://assets9.lottiefiles.com/packages/lf20_kyu7xb1v.json', // Robot
    headline: 'your digital team pulled an all-nighter',
    sub: 'Your AI agents have been monitoring everything. Let us compile the overnight intelligence.',
    steps: ['Scanning overnight market signals', 'Analysing new email patterns', 'Detecting risks & opportunities', 'Updating your executive briefing'],
  },
  {
    lottie: 'https://assets1.lottiefiles.com/packages/lf20_obhph3sh.json', // Search
    headline: 'missed you',
    sub: 'A lot happened in the market and your business. Pulling it together now.',
    steps: ['Checking what competitors did overnight', 'Processing new CRM activity', 'Recalculating your positions', 'Preparing your morning brief'],
  },
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
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-6" style={{ background: '#0F172A' }} data-testid="cognitive-loading">
      <style>{`
        @keyframes cogFadeUp{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes cogDotPulse{0%,80%,100%{opacity:0.3;transform:scale(0.8)}40%{opacity:1;transform:scale(1.2)}}
      `}</style>

      <div className="max-w-lg w-full text-center">
        {/* Lottie Animation */}
        <div className="w-48 h-48 mx-auto mb-4">
          <Lottie
            animationData={undefined}
            path={pack.lottie}
            loop={true}
            autoplay={true}
            style={{ width: '100%', height: '100%' }}
            rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
          />
        </div>

        {/* Message */}
        <div style={{ animation: 'cogFadeUp 0.6s ease-out' }}>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight" style={{ fontFamily: HEAD }}>
            {!isFirst && ownerName ? `${ownerName}, ` : ''}{pack.headline}
          </h2>
          <p className="text-base text-slate-400 leading-relaxed mb-8" style={{ fontFamily: BODY }}>
            {pack.sub}
          </p>
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
