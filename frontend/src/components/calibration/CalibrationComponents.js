import { useState, useEffect } from 'react';
import { Shield, Lock, Database, RefreshCw, X, ChevronRight, DollarSign, Target, Eye, Zap, Clock, ChevronDown } from 'lucide-react';

const CREAM = 'var(--surface, #FFFFFF)';
const CHARCOAL = 'var(--ink-display, #0A0A0A)';
const MUTED = 'var(--ink-secondary, #525252)';
const GOLD = '#E85D00';
const CARD_BG = 'var(--surface, #FFFFFF)';
const CARD_BORDER = 'var(--border, rgba(10,10,10,0.08))';
const SERIF = "var(--font-display)";
const AZ = '#E85D00';

const ANALYZE_PHASES = [
  'Scanning market presence...',
  'Mapping competitive landscape...',
  'Evaluating digital footprint...',
  'Synthesizing strategic profile...',
  'Preparing your Executive Audit Brief...',
];

/** Loading — branded pulse, no spinner */
export const CalibrationLoading = () => (
  <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--biqc-bg)' }} data-testid="calibration-loading">
    <div className="text-center">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: '#E85D00', animation: 'pulse 2s ease-in-out infinite' }}>
        <span className="text-white font-bold text-lg" style={{ fontFamily: "var(--font-mono)" }}>B</span>
      </div>
      <p className="text-sm" style={{ color: 'var(--biqc-text-2)' }}>Loading calibration...</p>
    </div>
  </div>
);

// ── Privacy Commitment Modal ──────────────────────────────────────────────────
const PrivacyModal = ({ onClose }) => (
  <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4"
    style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}>
    <div className="w-full max-w-md rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface, #FFFFFF)', border: '1px solid var(--border, rgba(10,10,10,0.08))', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', maxHeight: '85vh', overflowY: 'auto' }}>

      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1E2D3D' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
            <Shield className="w-4 h-4" style={{ color: '#10B981' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: CHARCOAL, fontFamily: SERIF }}>BIQc Privacy & AI Commitment</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: '#64748B' }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">

        {/* Plain language intro */}
        <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
          We get it — handing over business data feels personal. Here's exactly what BIQc does and doesn't do with yours, in plain language.
        </p>

        {[
          {
            icon: Database,
            color: '#10B981',
            title: 'We read. We never touch.',
            body: 'Every integration BIQc connects to is read-only. We can see your invoices, deals and emails — but we cannot create, edit or delete anything. Ever. You can revoke access in one click at any time.',
          },
          {
            icon: Lock,
            color: '#3B82F6',
            title: 'Your data stays in Australia.',
            body: 'All your business data is stored and processed in Australian data centres (Sydney and Melbourne). Nothing goes offshore. No US servers. No EU servers. Your data is subject to Australian Privacy Law only.',
          },
          {
            icon: Shield,
            color: '#8B5CF6',
            title: 'Military-grade encryption.',
            body: 'Your data is encrypted at AES-256 standard — the same level used by banks and defence agencies. Data in transit uses TLS 1.3. Nobody can intercept or read your information.',
          },
          {
            icon: RefreshCw,
            color: '#E85D00',
            title: 'How BIQc learns about your business.',
            body: 'BIQc uses your data only to generate intelligence for YOU — alerts, recommendations and briefings specific to your business. We do not sell your data, share it with other businesses, or use it to train general AI models. Your intelligence is yours alone.',
          },
        ].map((item, i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border, rgba(10,10,10,0.08))' }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${item.color}15` }}>
                <item.icon className="w-4 h-4" style={{ color: item.color }} />
              </div>
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: CHARCOAL, fontFamily: SERIF }}>{item.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{item.body}</p>
              </div>
            </div>
          </div>
        ))}

        <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: '#10B981' }}>Our commitment to you</p>
          <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
            BIQc operates under Australia's Privacy Act 1988 and the Australian Privacy Principles (APPs).
            You can request deletion of all your data at any time by contacting us at{' '}
            <span style={{ color: '#E85D00' }}>support@biqc.ai</span>.
            We will action your request within 30 days.
          </p>
        </div>

        <button onClick={onClose}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
          style={{ background: 'linear-gradient(135deg, #E85D00, #E56A08)', color: 'white', fontFamily: SERIF }}>
          Got it — I'm happy to continue
        </button>
      </div>
    </div>
  </div>
);

/** Welcome screen — two phases:
 *  Phase 1: Intro with Privacy link + Continue button
 *  Phase 2: Website URL scan form
 */
export const WelcomeHandshake = ({
  firstName,
  websiteUrl,
  setWebsiteUrl,
  onSubmit,
  onManualFallback,
  isSubmitting,
  error,
  initialPhase = 'intro',
  scanFailure = null,
  scanAttemptCount = 0,
  canManualFallback = false,
}) => {
  const [phase, setPhase] = useState(initialPhase); // intro | scan
  const [showPrivacy, setShowPrivacy] = useState(false);
  

  useEffect(() => {
    setPhase(initialPhase === 'scan' ? 'scan' : 'intro');
  }, [initialPhase]);

  

  // ── Phase 1: Intro ──────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <>
        {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-lg w-full text-center">

            {/* BIQc logo mark */}
            <div className="w-16 h-16 rounded-2xl mx-auto mb-7 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #E85D00, #E56A08)', boxShadow: '0 0 40px rgba(232,93,0,0.25)' }}>
              <span className="text-white font-bold text-2xl" style={{ fontFamily: "var(--font-mono)" }}>B</span>
            </div>

            <h1 className="text-3xl sm:text-4xl mb-4" style={{ fontFamily: SERIF, color: CHARCOAL, fontWeight: 600 }}>
              {firstName ? `Welcome to BIQc, ${firstName}.` : 'Welcome to BIQc.'}
            </h1>

            <p className="text-base leading-relaxed mb-6" style={{ color: MUTED, maxWidth: 480, margin: '0 auto 24px' }}>
              This is not a dashboard. It's a strategic intelligence system that monitors your business 24/7,
              detects risks before they compound, and delivers executive-level briefings — without you having to ask.
            </p>

            {/* What it does */}
            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto mb-7">
              {[
                { num: '1', label: 'Market Intelligence', desc: 'Real-time positioning & competitive signals' },
                { num: '2', label: 'Revenue & Operations', desc: 'Pipeline health, SOP compliance' },
                { num: '3', label: 'Risk & Compliance', desc: 'Financial exposure, regulatory obligations' },
                { num: '4', label: 'Autonomous Execution', desc: 'AI-driven alerts, actions & automations' },
              ].map(item => (
                <div key={item.num} className="rounded-xl p-3 text-left" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
                  <div className="w-5 h-5 rounded-md flex items-center justify-center mb-1.5"
                    style={{ background: 'rgba(232,93,0,0.15)' }}>
                    <span className="text-[10px] font-bold" style={{ color: AZ }}>{item.num}</span>
                  </div>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: CHARCOAL, fontFamily: SERIF }}>{item.label}</p>
                  <p className="text-[10px] leading-snug" style={{ color: MUTED }}>{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Privacy link */}
            <button onClick={() => setShowPrivacy(true)}
              className="flex items-center gap-1.5 mx-auto mb-6 text-xs transition-colors hover:text-green-400"
              style={{ color: '#10B981', fontFamily: "var(--font-mono)" }}
              data-testid="privacy-link">
              <Shield className="w-3.5 h-3.5" />
              See BIQc Privacy Commitment
              <ChevronRight className="w-3 h-3" />
            </button>

            <button onClick={() => setPhase('scan')}
              className="mx-auto px-12 py-4 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #E85D00, #E56A08)', color: 'white', fontFamily: SERIF, boxShadow: '0 8px 28px rgba(232,93,0,0.28)' }}
              data-testid="welcome-continue-btn">
              Begin Business Intelligence Scan
              <ChevronRight className="w-4 h-4" />
            </button>

            <p className="mt-4 text-[10px]" style={{ color: '#4A5568', fontFamily: "var(--font-mono)" }}>
              Takes under 2 minutes · Read-only · Australian hosted
            </p>
          </div>
        </div>
      </>
    );
  }

  // ── Phase 2: Scan form ──────────────────────────────────────────────────────
  return (
    <>
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-lg w-full text-center">
          <h1 className="text-3xl sm:text-4xl mb-4" style={{ fontFamily: SERIF, color: CHARCOAL, fontWeight: 600 }}>
            {scanFailure ? "Let's retry your scan." : "Let's scan your business."}
          </h1>
          <p className="text-base leading-relaxed mb-8" style={{ color: MUTED, maxWidth: 460, margin: '0 auto 32px' }}>
            {scanFailure
              ? 'Check your website details, then regenerate the scan. If it still fails, manual setup will unlock.'
              : 'Enter your website URL. BIQc will analyse your market position, competitive landscape and digital footprint in real time.'}
          </p>

          {error && <p className="text-sm text-red-500 mb-4" data-testid="calibration-error">{error}</p>}
          {scanFailure && (
            <p className="text-xs mb-4" style={{ color: '#3B82F6' }} data-testid="calibration-retry-guidance">
              Attempt {scanAttemptCount}: verify domain spelling, ensure the site is live, then click Regenerate Scan.
            </p>
          )}

          <form onSubmit={onSubmit} className="max-w-md mx-auto space-y-4">
            <input
              type="text"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="yourcompany.com"
              className="w-full rounded-xl px-5 py-4 text-lg text-center focus:outline-none transition-colors"
              style={{ background: CARD_BG, border: `2px solid ${CARD_BORDER}`, color: CHARCOAL, fontFamily: SERIF }}
              autoFocus
              data-testid="website-url-input"
            />
            <button
              type="submit"
              disabled={isSubmitting || !websiteUrl.trim()}
              className="w-full px-8 py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: '#E85D00', color: '#FFFFFF', fontFamily: SERIF }}
              data-testid="begin-audit-btn">
              {isSubmitting ? 'Scanning...' : scanFailure ? 'Regenerate Scan' : 'Begin Strategic Audit'}
            </button>
          </form>

          <div className="max-w-sm mx-auto mt-8 grid grid-cols-2 gap-3">
            {['Market positioning', 'Competitive signals', 'Trust architecture', 'Growth pressure'].map(item => (
              <div key={item} className="flex items-center gap-2 text-left">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#E85D00' }} />
                <span className="text-xs" style={{ color: MUTED, fontFamily: "var(--font-mono)" }}>{item}</span>
              </div>
            ))}
          </div>

          {canManualFallback && (
            <button onClick={onManualFallback}
              className="mt-6 text-xs font-medium cursor-pointer transition-colors"
              style={{ color: MUTED }}
              data-testid="no-website-btn">
              Continue manually after scan retries
            </button>
          )}
        </div>
      </div>
    </>
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
            style={{ background: CHARCOAL, color: 'var(--canvas, #080C14)' }}
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
export const AuditProgress = ({ onManualFallback = null }) => {
  const [phase, setPhase] = useState(0);
  const [showFallback, setShowFallback] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setPhase(p => (p + 1) % ANALYZE_PHASES.length), 3000);
    const tickInterval = setInterval(() => setTick(t => t + 1), 180);
    const fallbackTimer = setTimeout(() => setShowFallback(true), 18000);
    return () => {
      clearInterval(interval);
      clearInterval(tickInterval);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const signalStrength = 62 + (tick % 14);
  const confidence = 48 + (tick % 23);
  const packetsPerSecond = 1200 + (tick * 7);
  const sweepRotation = (tick * 7) % 360;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6" data-testid="analyzing-state">
      <style>{`
        @keyframes panelGlow{0%,100%{box-shadow:0 0 0 rgba(232,93,0,0.0), inset 0 0 0 rgba(232,93,0,0.0)}50%{box-shadow:0 0 34px rgba(232,93,0,0.14), inset 0 0 24px rgba(232,93,0,0.09)}}
        @keyframes crtFlicker{0%,100%{opacity:0.18}50%{opacity:0.11}}
        @keyframes scanlineSweep{0%{transform:translateY(-110%)}100%{transform:translateY(310%)}}
        @keyframes dataPulse{0%,100%{opacity:0.45}50%{opacity:1}}
      `}</style>

      <div
        className="relative mb-8 w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{
          background: 'var(--canvas-app, #FAFAFA)',
          border: '1px solid #27374A',
          animation: 'panelGlow 3.2s ease-in-out infinite',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 2px, transparent 4px)',
            animation: 'crtFlicker 0.28s linear infinite',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(232,93,0,0) 0%, rgba(232,93,0,0.13) 45%, rgba(232,93,0,0) 100%)',
            transform: 'translateY(-110%)',
            animation: 'scanlineSweep 2.9s linear infinite',
          }}
        />

        <div className="relative grid grid-cols-1 md:grid-cols-[220px,1fr] gap-5 p-5">
          <div className="flex items-center justify-center">
            <div
              className="relative rounded-full"
              style={{
                width: 170,
                height: 170,
                border: '1px solid rgba(232,93,0,0.5)',
                background: 'radial-gradient(circle at center, rgba(232,93,0,0.18) 0%, rgba(232,93,0,0.06) 35%, rgba(232,93,0,0.02) 60%, rgba(0,0,0,0.0) 100%)',
              }}
            >
              <div className="absolute left-1/2 top-0 h-full w-px" style={{ background: 'rgba(232,93,0,0.16)' }} />
              <div className="absolute top-1/2 left-0 w-full h-px" style={{ background: 'rgba(232,93,0,0.16)' }} />
              {[30, 55, 80].map((size) => (
                <div
                  key={size}
                  className="absolute rounded-full"
                  style={{
                    inset: `${size / 2}px`,
                    border: '1px solid rgba(232,93,0,0.18)',
                  }}
                />
              ))}
              <div
                className="absolute top-1/2 left-1/2"
                style={{
                  width: 1,
                  height: 82,
                  transformOrigin: 'bottom center',
                  transform: `translate(-50%, -100%) rotate(${sweepRotation}deg)`,
                  background: 'linear-gradient(to top, rgba(232,93,0,0.9) 0%, rgba(232,93,0,0.1) 100%)',
                }}
              />
              <div
                className="absolute top-1/2 left-1/2 w-2.5 h-2.5 rounded-full"
                style={{ transform: 'translate(-50%, -50%)', background: '#E85D00', boxShadow: '0 0 14px rgba(232,93,0,0.6)' }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-[11px]" style={{ color: '#B9C8D8', fontFamily: "var(--font-mono)" }}>
              <div className="rounded-lg px-2.5 py-2" style={{ background: 'var(--surface-sunken, #F5F5F5)', border: '1px solid var(--border, rgba(10,10,10,0.08))' }}>
                <div style={{ color: '#6C8095' }}>SIGNAL</div>
                <div style={{ color: '#FFB06E' }}>{signalStrength}%</div>
              </div>
              <div className="rounded-lg px-2.5 py-2" style={{ background: 'var(--surface-sunken, #F5F5F5)', border: '1px solid var(--border, rgba(10,10,10,0.08))' }}>
                <div style={{ color: '#6C8095' }}>CONFIDENCE</div>
                <div style={{ color: '#FFB06E' }}>{confidence}%</div>
              </div>
              <div className="rounded-lg px-2.5 py-2" style={{ background: 'var(--surface-sunken, #F5F5F5)', border: '1px solid var(--border, rgba(10,10,10,0.08))' }}>
                <div style={{ color: '#6C8095' }}>PACKETS/S</div>
                <div style={{ color: '#FFB06E' }}>{packetsPerSecond}</div>
              </div>
            </div>

            <div className="space-y-1.5">
              {Array.from({ length: 8 }).map((_, i) => {
                const active = ((tick + i * 3) % 10) + 2;
                return (
                  <div key={i} className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--silver-2, #E8ECF1)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${active * 10}%`,
                        background: 'linear-gradient(90deg, #E85D00 0%, #FFC48B 100%)',
                        animation: 'dataPulse 1.1s ease-in-out infinite',
                        animationDelay: `${i * 0.08}s`,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
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

      {showFallback && onManualFallback && (
        <button
          onClick={onManualFallback}
          className="mt-6 px-5 py-2 rounded-full text-xs font-semibold"
          style={{ color: '#3B82F6', border: '1px solid #3B82F640', background: '#3B82F610' }}
          data-testid="analyzing-manual-fallback-btn"
        >
          Continue manually
        </button>
      )}
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

// ── WOW Cards (Phase 4 — Forensic Insight Cards) ───────────────────────────

const CARD_TYPE_META = {
  revenue_leakage: { icon: DollarSign, color: '#E85D00', gradient: 'linear-gradient(135deg, #111A24 0%, #1A2633 100%)', borderColor: '#2D3B4A' },
  competitor_delta: { icon: Target, color: '#E85D00', gradient: 'linear-gradient(135deg, #121B25 0%, #1C2836 100%)', borderColor: '#324252' },
  hidden_issue: { icon: Eye, color: '#E85D00', gradient: 'linear-gradient(135deg, #111925 0%, #1A2432 100%)', borderColor: '#30404F' },
  quick_win: { icon: Zap, color: '#FF8C33', gradient: 'linear-gradient(135deg, #13202C 0%, #1D2B39 100%)', borderColor: '#3A4A5B' },
};

const ConfidenceBadge = ({ level }) => {
  const colors = {
    high: { bg: '#213041', text: '#FF8C33', label: 'High Confidence' },
    medium: { bg: '#273649', text: '#E85D00', label: 'Medium Confidence' },
    low: { bg: '#2B394D', text: '#E85D00', label: 'Low Confidence' },
  };
  const c = colors[level] || colors.medium;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: c.bg, color: c.text }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.text }} />
      {c.label}
    </span>
  );
};

const WowCard = ({ card, index }) => {
  const [visible, setVisible] = useState(false);
  const meta = CARD_TYPE_META[card.type] || CARD_TYPE_META.quick_win;
  const Icon = meta.icon;

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 200 + index * 280);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <div
      className="rounded-xl p-5 transition-all duration-700"
      style={{
        background: meta.gradient,
        border: `1px solid ${meta.borderColor}`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
      }}
      data-testid={`wow-card-${card.type}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${meta.color}20` }}>
          <Icon className="w-5 h-5" style={{ color: meta.color }} />
        </div>
        <ConfidenceBadge level={card.confidence} />
      </div>
      <h3 className="text-sm font-semibold mb-2" style={{ fontFamily: SERIF, color: CHARCOAL }}>{card.title}</h3>
      <p className="text-xs leading-relaxed mb-3" style={{ color: MUTED }}>{card.claim}</p>
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#6C8095' }}>Source:</span>
        <span className="text-[10px]" style={{ color: MUTED }}>{card.evidence}</span>
      </div>
      <div className="rounded-lg px-3 py-2" style={{ background: `${meta.color}08`, border: `1px solid ${meta.color}20` }}>
        <p className="text-[11px] font-medium" style={{ color: meta.color }}>{card.action}</p>
      </div>
    </div>
  );
};

export const WowCards = ({ cards, onConfirm }) => {
  if (!cards || cards.length === 0) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--biqc-bg)' }} data-testid="wow-cards-phase">
      <style>{`
        @keyframes scanlineGlow{0%,100%{opacity:0.03}50%{opacity:0.08}}
        @keyframes fadeSlideIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8" style={{ animation: 'fadeSlideIn 0.6s ease-out' }}>
            <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #E85D00, #E56A08)', boxShadow: '0 0 30px rgba(232,93,0,0.2)' }}>
              <Eye className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl mb-2" style={{ fontFamily: SERIF, color: CHARCOAL, fontWeight: 600 }}>
              What We Found
            </h2>
            <p className="text-sm" style={{ color: MUTED, maxWidth: 460, margin: '0 auto' }}>
              Four forensic insights from your business scan — each backed by evidence from your digital footprint.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {cards.map((card, i) => (
              <WowCard key={card.type} card={card} index={i} />
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={onConfirm}
              className="px-10 py-3.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
              style={{
                background: 'linear-gradient(135deg, #E85D00, #E56A08)',
                color: 'white',
                fontFamily: SERIF,
                boxShadow: '0 8px 28px rgba(232,93,0,0.25)',
              }}
              data-testid="wow-cards-continue-btn"
            >
              See Your Strategic Roadmap
              <ChevronRight className="w-4 h-4 inline-block ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Strategic Roadmap (Phase 5 — 7/30/90 Day Timeline) ─────────────────────

const EFFORT_COLORS = { Low: '#10B981', Medium: '#F59E0B', High: '#EF4444' };

const RoadmapPhase = ({ label, days, moves, color, delay }) => {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-700 mb-4"
      style={{
        border: `1px solid ${color}30`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
      }}
      data-testid={`roadmap-phase-${days}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        style={{ background: `${color}08` }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
            <Clock className="w-5 h-5" style={{ color }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ fontFamily: SERIF, color: CHARCOAL }}>{label}</p>
            <p className="text-[11px]" style={{ color: MUTED }}>{moves.length} strategic move{moves.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <ChevronDown
          className="w-4 h-4 transition-transform"
          style={{ color: MUTED, transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}
        />
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-3" style={{ background: CARD_BG }}>
          {moves.map((move, i) => (
            <div key={i} className="rounded-lg p-4" style={{ background: 'var(--surface-sunken, #F5F5F5)', border: `1px solid ${CARD_BORDER}` }}>
              <p className="text-xs font-medium leading-relaxed mb-3" style={{ color: CHARCOAL }}>{move.action}</p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                  style={{ background: 'var(--surface-tint, #FAFAFA)', color: MUTED }}>
                  Owner: <span style={{ color: CHARCOAL }}>{move.owner}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                  style={{ background: 'var(--surface-tint, #FAFAFA)', color: MUTED }}>
                  Effort: <span style={{ color: EFFORT_COLORS[move.effort] || MUTED }}>{move.effort}</span>
                </span>
                <ConfidenceBadge level={move.confidence} />
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#6C8095' }}>KPI:</span>
                <span className="text-[10px]" style={{ color: MUTED }}>{move.kpiShift}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#6C8095' }}>Evidence:</span>
                <span className="text-[10px]" style={{ color: MUTED }}>{move.evidence}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const StrategicRoadmap = ({ roadmap, onConfirm }) => {
  if (!roadmap) return null;
  const { sevenDay, thirtyDay, ninetyDay } = roadmap;

  const phases = [
    { label: '7-Day Sprint', days: 7, moves: sevenDay, color: '#10B981', delay: 200 },
    { label: '30-Day Push', days: 30, moves: thirtyDay, color: '#3B82F6', delay: 500 },
    { label: '90-Day Transformation', days: 90, moves: ninetyDay, color: '#A855F7', delay: 800 },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--biqc-bg)' }} data-testid="strategic-roadmap-phase">
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8" style={{ animation: 'fadeSlideIn 0.6s ease-out' }}>
            <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', boxShadow: '0 0 30px rgba(59,130,246,0.2)' }}>
              <Target className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl mb-2" style={{ fontFamily: SERIF, color: CHARCOAL, fontWeight: 600 }}>
              Your Strategic Roadmap
            </h2>
            <p className="text-sm" style={{ color: MUTED, maxWidth: 480, margin: '0 auto' }}>
              A prioritised 7/30/90-day action plan built from your scan intelligence — with effort, ownership, and expected impact.
            </p>
          </div>

          {/* Timeline connector */}
          <div className="relative pl-6 mb-4">
            <div className="absolute left-8 top-0 bottom-0 w-px" style={{ background: `linear-gradient(to bottom, #10B981, #3B82F6, #A855F7)` }} />
            {phases.map(phase => (
              <RoadmapPhase key={phase.days} {...phase} />
            ))}
          </div>

          <div className="text-center mt-6">
            <button
              onClick={onConfirm}
              className="px-10 py-3.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
              style={{
                background: 'linear-gradient(135deg, #E85D00, #E56A08)',
                color: 'white',
                fontFamily: SERIF,
                boxShadow: '0 8px 28px rgba(232,93,0,0.25)',
              }}
              data-testid="roadmap-continue-btn"
            >
              View Full CMO Report
              <ChevronRight className="w-4 h-4 inline-block ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
