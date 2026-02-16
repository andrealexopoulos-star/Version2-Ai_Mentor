import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';

const CREAM = '#FBFBF9';
const CHARCOAL = '#1E293B';
const MUTED = '#64748B';
const GOLD = '#B8860B';
const CARD_BG = '#FFFFFF';
const CARD_BORDER = '#E8E6E1';
const SERIF = "'Playfair Display', serif";
const AZ = '#007AFF';

const ANALYZE_PHASES = [
  'Scanning market presence...',
  'Mapping competitive landscape...',
  'Evaluating digital footprint...',
  'Synthesizing strategic profile...',
  'Preparing your Executive Audit Brief...',
];

/** Loading spinner */
export const CalibrationLoading = () => (
  <div className="flex-1 flex items-center justify-center" data-testid="calibration-loading">
    <div className="w-6 h-6 border rounded-full animate-spin" style={{ borderColor: CARD_BORDER, borderTopColor: CHARCOAL }} />
  </div>
);

/** Welcome screen — URL input + manual fallback */
export const WelcomeHandshake = ({ firstName, websiteUrl, setWebsiteUrl, onSubmit, onManualFallback, isSubmitting, error }) => (
  <div className="flex-1 flex items-center justify-center px-6">
    <div className="max-w-lg w-full text-center">
      <h1 className="text-3xl sm:text-4xl mb-4" style={{ fontFamily: SERIF, color: CHARCOAL, fontWeight: 600 }}>
        {firstName ? `Welcome to BIQc, ${firstName}.` : 'Welcome to BIQc.'}
      </h1>
      <p className="text-base leading-relaxed mb-8" style={{ color: MUTED, maxWidth: 460, margin: '0 auto' }}>
        Provide your website URL for an instant strategic audit — or describe your business in a few sentences.
      </p>

      {error && <p className="text-sm text-red-500 mb-4" data-testid="calibration-error">{error}</p>}

      <form onSubmit={onSubmit} className="max-w-md mx-auto space-y-4">
        <input
          type="text"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="thestrategysquad.com"
          className="w-full rounded-xl px-5 py-3.5 text-base text-center focus:outline-none transition-colors"
          style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: CHARCOAL }}
          autoFocus
          data-testid="website-url-input"
        />
        <button
          type="submit"
          disabled={isSubmitting || !websiteUrl.trim()}
          className="w-full px-8 py-3.5 rounded-full text-sm font-medium transition-opacity disabled:opacity-40"
          style={{ background: CHARCOAL, color: '#FFFFFF' }}
          data-testid="begin-audit-btn"
        >
          Begin Audit
        </button>
      </form>

      <button
        onClick={onManualFallback}
        className="mt-6 text-xs underline cursor-pointer"
        style={{ color: MUTED }}
        data-testid="manual-fallback-btn"
      >
        I don't have a website — describe my business instead
      </button>
    </div>
  </div>
);

/** Manual business summary fallback (Smart-Retry tier 3) */
export const ManualSummaryFallback = ({ firstName, onSubmit, isSubmitting }) => {
  const [summary, setSummary] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (summary.trim().length >= 10) onSubmit(summary.trim());
  };

  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="max-w-lg w-full text-center">
        <h2 className="text-2xl sm:text-3xl mb-4" style={{ fontFamily: SERIF, color: CHARCOAL, fontWeight: 600 }}>
          {firstName ? `Tell me about your business, ${firstName}.` : 'Tell me about your business.'}
        </h2>
        <p className="text-sm leading-relaxed mb-6" style={{ color: MUTED, maxWidth: 440, margin: '0 auto' }}>
          In 2-3 sentences: What does your business do, and who do you serve?
        </p>
        <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="e.g. We're a boutique accounting firm in Melbourne serving SMEs with advisory and tax compliance services..."
            rows={4}
            className="w-full rounded-xl px-5 py-3.5 text-sm focus:outline-none resize-none"
            style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, color: CHARCOAL }}
            autoFocus
            data-testid="manual-summary-input"
          />
          <button
            type="submit"
            disabled={isSubmitting || summary.trim().length < 10}
            className="w-full px-8 py-3.5 rounded-full text-sm font-medium transition-opacity disabled:opacity-40"
            style={{ background: CHARCOAL, color: '#FFFFFF' }}
            data-testid="submit-summary-btn"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
};

/** Analyzing animation */
export const AuditProgress = () => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setPhase(p => (p + 1) % ANALYZE_PHASES.length), 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6" data-testid="analyzing-state">
      <div className="mb-10" style={{ width: 100, height: 100 }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke={CARD_BORDER} strokeWidth="3" />
          <circle cx="50" cy="50" r="42" fill="none" stroke={GOLD} strokeWidth="3"
            strokeDasharray="264" strokeDashoffset="66" strokeLinecap="round" transform="rotate(-90 50 50)">
            <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="2s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>
      <p className="text-base text-center leading-relaxed transition-opacity duration-1000"
        style={{ fontFamily: SERIF, color: CHARCOAL, maxWidth: 440 }}>
        {ANALYZE_PHASES[phase]}
      </p>
      <div className="flex gap-1.5 mt-5">
        {ANALYZE_PHASES.map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
            style={{ background: i === phase ? GOLD : CARD_BORDER }} />
        ))}
      </div>
    </div>
  );
};

/** Identity bar — signed in as */
export const IdentityBar = ({ email, onSignOut }) => (
  <div className="flex items-center justify-between px-6 py-2" style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
    <span className="text-xs" style={{ color: MUTED }}>
      Signed in as <strong style={{ color: CHARCOAL }}>{email}</strong>
    </span>
    <button onClick={onSignOut} className="text-xs underline" style={{ color: MUTED }} data-testid="sign-out-btn">
      Sign out
    </button>
  </div>
);
