import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';

const CREAM = '#0F1720';
const CHARCOAL = '#F4F7FA';
const MUTED = '#9FB0C3';
const GOLD = '#FF6A00';
const CARD_BG = '#141C26';
const CARD_BORDER = '#243140';
const SERIF = "var(--font-heading)";
const AZ = '#FF6A00';

const ANALYZE_PHASES = [
  'Scanning market presence...',
  'Mapping competitive landscape...',
  'Evaluating digital footprint...',
  'Synthesizing strategic profile...',
  'Preparing your Executive Audit Brief...',
];

/** Loading — branded pulse, no spinner */
export const CalibrationLoading = () => (
  <div className="flex-1 flex items-center justify-center" style={{ background: '#0F1720' }} data-testid="calibration-loading">
    <div className="text-center">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: '#FF6A00', animation: 'pulse 2s ease-in-out infinite' }}>
        <span className="text-white font-bold text-lg" style={{ fontFamily: "'JetBrains Mono', monospace" }}>B</span>
      </div>
      <p className="text-sm" style={{ color: '#9FB0C3' }}>Loading calibration...</p>
    </div>
  </div>
);

/** Welcome screen — URL input + manual fallback + Strategic Expansion drawer */
export const WelcomeHandshake = ({ firstName, websiteUrl, setWebsiteUrl, onSubmit, onManualFallback, isSubmitting, error }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [handles, setHandles] = useState({ linkedin: '', twitter: '', instagram: '', facebook: '' });
  const [savingHandles, setSavingHandles] = useState(false);
  const [handlesSaved, setHandlesSaved] = useState(false);

  const hasAnyHandle = Object.values(handles).some(v => v.trim());

  const saveHandles = async () => {
    if (!hasAnyHandle) return;
    setSavingHandles(true);
    try {
      const clean = {};
      for (const [k, v] of Object.entries(handles)) { if (v.trim()) clean[k] = v.trim(); }
      await apiClient.put('/intelligence/social-handles', clean);
      // Trigger deep-web-recon Edge Function immediately
      try {
        const reconRes = await apiClient.post('/intelligence/recon', {});
        if (reconRes.data?.ok) {
          // console.log('[Recon] SWOT generated:', reconRes.data.signals_created, 'signals');
        }
      } catch (e) {
        console.warn('[Recon] Edge function trigger failed (non-blocking):', e);
      }
      setHandlesSaved(true);
      setTimeout(() => setDrawerOpen(false), 800);
    } catch (e) {
      console.error('Failed to save handles:', e);
    } finally {
      setSavingHandles(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-3xl sm:text-4xl mb-4" style={{ fontFamily: SERIF, color: CHARCOAL, fontWeight: 600 }}>
          {firstName ? `Welcome to BIQc, ${firstName}.` : 'Welcome to BIQc.'}
        </h1>
        <p className="text-base leading-relaxed mb-8" style={{ color: MUTED, maxWidth: 460, margin: '0 auto' }}>
          Enter your website to begin a live strategic market audit.
        </p>

        {error && <p className="text-sm text-red-500 mb-4" data-testid="calibration-error">{error}</p>}

        <form onSubmit={onSubmit} className="max-w-md mx-auto space-y-4">
          <input
            type="text"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="thestrategysquad.com"
            className="w-full rounded-xl px-5 py-4 text-lg text-center focus:outline-none transition-colors"
            style={{ background: CARD_BG, border: `2px solid ${CARD_BORDER}`, color: CHARCOAL, fontFamily: SERIF }}
            autoFocus
            data-testid="website-url-input"
          />
          <button
            type="submit"
            disabled={isSubmitting || !websiteUrl.trim()}
            className="w-full px-8 py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: '#FF6A00', color: '#FFFFFF', fontFamily: SERIF }}
            data-testid="begin-audit-btn"
          >
            Begin Strategic Audit
          </button>
        </form>

        {/* Scan indicators */}
        <div className="max-w-sm mx-auto mt-8 grid grid-cols-2 gap-3">
          {['Market positioning', 'Competitive signals', 'Trust architecture', 'Growth pressure'].map(item => (
            <div key={item} className="flex items-center gap-2 text-left">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#FF6A00' }} />
              <span className="text-xs" style={{ color: MUTED, fontFamily: "'JetBrains Mono', monospace" }}>{item}</span>
            </div>
          ))}
        </div>

        {/* Social Intelligence Handles — always visible, optional */}
        <div className="max-w-md mx-auto mt-8 rounded-xl p-5 text-left" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }} data-testid="social-handles-section">
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: MUTED, fontFamily: "'JetBrains Mono', monospace" }}>
            Social Intelligence Handles
          </p>
          <p className="text-xs mb-4" style={{ color: MUTED }}>
            Optional. BIQc will crawl these for competitor news, staff sentiment, and SWOT signals.
          </p>
          <div className="space-y-3">
            {[
              { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/company/your-company', icon: 'in' },
              { key: 'twitter', label: 'X (Twitter)', placeholder: '@yourhandle', icon: 'X' },
              { key: 'instagram', label: 'Instagram', placeholder: '@yourhandle', icon: 'IG' },
              { key: 'facebook', label: 'Facebook', placeholder: 'facebook.com/yourpage', icon: 'fb' },
            ].map(s => (
              <div key={s.key} className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: `${AZ}10`, color: AZ }}>
                  {s.icon}
                </span>
                <input type="text" value={handles[s.key]}
                  onChange={(e) => setHandles(p => ({ ...p, [s.key]: e.target.value }))}
                  placeholder={s.placeholder}
                  className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ background: CREAM, border: `1px solid ${CARD_BORDER}`, color: CHARCOAL }}
                  data-testid={`social-handle-${s.key}`} />
              </div>
            ))}
          </div>
          {hasAnyHandle && (
            <button onClick={saveHandles} disabled={savingHandles}
              className="mt-4 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
              style={{ background: handlesSaved ? '#10B981' : AZ, color: '#fff' }}
              data-testid="save-social-handles-btn">
              {savingHandles ? 'Saving...' : handlesSaved ? 'Saved' : 'Save & Activate Recon'}
            </button>
          )}
        </div>

        <button onClick={onManualFallback}
          className="mt-6 text-xs font-medium cursor-pointer transition-colors"
          style={{ color: MUTED }}
          data-testid="no-website-btn">
          I Don't Have a Website — Analyse My Business Manually
        </button>
      </div>
    </div>
  );
};

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
        <p className="text-sm leading-relaxed mb-3" style={{ color: MUTED, maxWidth: 440, margin: '0 auto' }}>
          In 2-3 sentences: What does your business do, and who do you serve?
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-5"
          style={{ background: '#F0F4FF', border: '1px solid #BFDBFE' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <span className="text-xs font-medium" style={{ color: '#3B82F6' }}>
            9 quick questions follow · Takes ~3 minutes
          </span>
        </div>
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
      <style>{`
        @keyframes meshFloat{0%,100%{transform:translate(0,0)}25%{transform:translate(3px,-4px)}50%{transform:translate(-2px,3px)}75%{transform:translate(4px,2px)}}
        @keyframes meshLine{0%{opacity:0;stroke-dashoffset:60}50%{opacity:0.3}100%{opacity:0;stroke-dashoffset:0}}
        @keyframes meshPulse{0%,100%{opacity:0.3;transform:scale(1)}50%{opacity:0.8;transform:scale(1.3)}}
      `}</style>

      {/* Cognitive mesh animation — replaces rotating circle */}
      <div className="relative mb-8" style={{ width: 200, height: 150 }}>
        <svg width="200" height="150" viewBox="0 0 200 150">
          {[[40,30,100,40],[100,40,160,70],[60,90,120,80],[120,80,170,100],[40,30,60,90],[100,40,120,80],[160,70,170,100]].map(([x1,y1,x2,y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FF6A00" strokeWidth="0.5" strokeDasharray="60"
              style={{ animation: `meshLine ${3+i*0.7}s ease-in-out infinite`, animationDelay: `${i*0.4}s` }} />
          ))}
          {[[40,30],[100,40],[160,70],[60,90],[120,80],[170,100],[80,60],[140,50],[30,65],[175,40],[90,110],[150,120]].map(([cx,cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={i < 4 ? 3 : 2} fill="#FF6A00"
              style={{ animation: `meshFloat ${4+i*0.3}s ease-in-out infinite, meshPulse ${2+i*0.5}s ease-in-out infinite`, animationDelay: `${i*0.2}s`, opacity: i < 6 ? 0.6 : 0.25 }} />
          ))}
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
