import React from 'react';

const CHARCOAL = 'var(--ink-display, #EDF1F7)';
const MUTED = 'var(--ink-secondary, #8FA0B8)';
const GOLD = '#E85D00';
const CARD_BORDER = 'rgba(140,170,210,0.15)';
const SERIF = "var(--font-heading)";

const ContinuitySuite = ({ firstName, calStep, error, onResume }) => {
  const progressPercent = Math.min(Math.round((calStep / 9) * 100), 99);
  const ringRadius = 52;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (progressPercent / 100) * ringCirc;

  return (
    <div className="flex-1 flex items-center justify-center px-6" style={{ background: 'var(--biqc-bg)' }} data-testid="continuity-suite">
      <div className="max-w-lg w-full text-center">
        <div className="mx-auto mb-8" style={{ width: 120, height: 120 }}>
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={ringRadius} fill="none" stroke={CARD_BORDER} strokeWidth="4" />
            <circle cx="60" cy="60" r={ringRadius} fill="none" stroke={GOLD} strokeWidth="4"
              strokeDasharray={ringCirc} strokeDashoffset={ringOffset}
              strokeLinecap="round" transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dashoffset 1s ease' }} />
            <text x="60" y="60" textAnchor="middle" dominantBaseline="central"
              style={{ fontFamily: SERIF, fontSize: '24px', fontWeight: 600, fill: CHARCOAL }}>
              {progressPercent}%
            </text>
          </svg>
        </div>
        <h1 className="text-3xl sm:text-4xl mb-4" style={{ fontFamily: SERIF, color: CHARCOAL, fontWeight: 600 }}>
          {firstName ? `${firstName}, you are nearly there.` : 'You are nearly there.'}
        </h1>
        <p className="text-base leading-relaxed mb-8" style={{ color: MUTED, maxWidth: 480, margin: '0 auto' }}>
          I have begun mapping your DNA, but we need the final {9 - calStep} stage{9 - calStep !== 1 ? 's' : ''} to reach 100% foresight accuracy.
        </p>
        <p className="text-sm mb-10" style={{ color: '#94A3B8' }}>{calStep} of 9 stages completed.</p>
        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        <button onClick={onResume} className="px-8 py-3 rounded-xl text-sm font-semibold"
          style={{ background: '#E85D00', color: '#FFFFFF' }} data-testid="continue-calibration-btn">
          Resume My Session
        </button>
      </div>
    </div>
  );
};

export { ContinuitySuite };
