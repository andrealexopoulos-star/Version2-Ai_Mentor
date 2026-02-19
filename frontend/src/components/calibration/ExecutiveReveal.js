import React from 'react';

const CHARCOAL = '#1E293B';
const MUTED = '#64748B';
const GOLD = '#B8860B';
const CARD_BG = '#FFFFFF';
const CARD_BORDER = '#E8E6E1';
const SERIF = "var(--font-heading)";

const REVEAL_PHASES = [
  'Assembling your Intelligence Dashboard...',
  'Calibrating for Revenue Velocity...',
  'Preparing Strategy Memos...',
  'Finalizing your Executive Brief...',
];

const ExecutiveReveal = ({ firstName, lastResponse, revealPhase }) => (
  <div className="flex-1 flex flex-col items-center justify-center px-6" style={{ animation: 'fadeIn 0.8s ease' }} data-testid="executive-reveal">
    <div className="max-w-md text-center mb-10">
      <p className="text-lg leading-relaxed mb-2" style={{ fontFamily: SERIF, color: CHARCOAL }}>
        Thank you{firstName ? `, ${firstName}` : ''}. Your alignment is complete.
      </p>
      {lastResponse && (
        <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
          Your approach to {lastResponse.toLowerCase().replace(/ — .*/, '')} has been integrated into your Decision DNA.
        </p>
      )}
    </div>

    <div className="mb-8" style={{ width: 80, height: 80 }}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="34" fill="none" stroke={CARD_BORDER} strokeWidth="3" />
        <circle cx="40" cy="40" r="34" fill="none" stroke={GOLD} strokeWidth="3"
          strokeDasharray="214" strokeDashoffset={214 - (214 * ((revealPhase + 1) / REVEAL_PHASES.length))}
          strokeLinecap="round" transform="rotate(-90 40 40)"
          style={{ transition: 'stroke-dashoffset 1.5s ease' }} />
      </svg>
    </div>

    <p className="text-base text-center leading-relaxed transition-opacity duration-700"
      style={{ fontFamily: SERIF, color: CHARCOAL, maxWidth: 400 }}>
      {REVEAL_PHASES[revealPhase]}
    </p>

    <div className="flex gap-1.5 mt-5">
      {REVEAL_PHASES.map((_, i) => (
        <div key={i} className="w-1.5 h-1.5 rounded-full transition-colors duration-500"
          style={{ background: i <= revealPhase ? GOLD : CARD_BORDER }} />
      ))}
    </div>
  </div>
);

export { ExecutiveReveal, REVEAL_PHASES };
