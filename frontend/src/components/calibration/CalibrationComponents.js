import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';
import { Shield, Lock, Database, RefreshCw, X, ChevronRight } from 'lucide-react';

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
  <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--biqc-bg)' }} data-testid="calibration-loading">
    <div className="text-center">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: '#FF6A00', animation: 'pulse 2s ease-in-out infinite' }}>
        <span className="text-white font-bold text-lg" style={{ fontFamily: "'JetBrains Mono', monospace" }}>B</span>
      </div>
      <p className="text-sm" style={{ color: 'var(--biqc-text-2)' }}>Loading calibration...</p>
    </div>
  </div>
);

// ── Privacy Commitment Modal ──────────────────────────────────────────────────
const PrivacyModal = ({ onClose }) => (
  <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4"
    style={{ background: 'rgba(7,14,24,0.88)', backdropFilter: 'blur(12px)' }}>
    <div className="w-full max-w-md rounded-2xl overflow-hidden"
      style={{ background: '#0F1720', border: '1px solid #1E2D3D', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', maxHeight: '85vh', overflowY: 'auto' }}>

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
            color: '#FF7A18',
            title: 'How BIQc learns about your business.',
            body: 'BIQc uses your data only to generate intelligence for YOU — alerts, recommendations and briefings specific to your business. We do not sell your data, share it with other businesses, or use it to train general AI models. Your intelligence is yours alone.',
          },
        ].map((item, i) => (
          <div key={i} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1E2D3D' }}>
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
            <span style={{ color: '#FF7A18' }}>privacy@biqc.com.au</span>.
            We will action your request within 30 days.
          </p>
        </div>

        <button onClick={onClose}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
          style={{ background: 'linear-gradient(135deg, #FF7A18, #E56A08)', color: 'white', fontFamily: SERIF }}>
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
  const [handles, setHandles] = useState({ linkedin: '', twitter: '', instagram: '', facebook: '' });
  const [savingHandles, setSavingHandles] = useState(false);
  const [handlesSaved, setHandlesSaved] = useState(false);

  const hasAnyHandle = Object.values(handles).some(v => v.trim());

  useEffect(() => {
    setPhase(initialPhase === 'scan' ? 'scan' : 'intro');
  }, [initialPhase]);

  const saveHandles = async () => {
    if (!hasAnyHandle) return;
    setSavingHandles(true);
    try {
      const clean = {};
      for (const [k, v] of Object.entries(handles)) { if (v.trim()) clean[k] = v.trim(); }
      await apiClient.put('/intelligence/social-handles', clean);
      try { await apiClient.post('/intelligence/recon', {}); } catch {}
      setHandlesSaved(true);
      setTimeout(() => {}, 800);
    } catch (e) {
      console.error('Failed to save handles:', e);
    } finally {
      setSavingHandles(false);
    }
  };

  // ── Phase 1: Intro ──────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <>
        {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-lg w-full text-center">

            {/* BIQc logo mark */}
            <div className="w-16 h-16 rounded-2xl mx-auto mb-7 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FF7A18, #E56A08)', boxShadow: '0 0 40px rgba(255,106,0,0.25)' }}>
              <span className="text-white font-bold text-2xl" style={{ fontFamily: "'JetBrains Mono', monospace" }}>B</span>
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
                    style={{ background: 'rgba(255,122,24,0.15)' }}>
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
              style={{ color: '#10B981', fontFamily: "'JetBrains Mono', monospace" }}
              data-testid="privacy-link">
              <Shield className="w-3.5 h-3.5" />
              See BIQc Privacy Commitment
              <ChevronRight className="w-3 h-3" />
            </button>

            <button onClick={() => setPhase('scan')}
              className="mx-auto px-12 py-4 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #FF7A18, #E56A08)', color: 'white', fontFamily: SERIF, boxShadow: '0 8px 28px rgba(255,106,0,0.28)' }}
              data-testid="welcome-continue-btn">
              Begin Business Intelligence Scan
              <ChevronRight className="w-4 h-4" />
            </button>

            <p className="mt-4 text-[10px]" style={{ color: '#4A5568', fontFamily: "'JetBrains Mono', monospace" }}>
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
              style={{ background: '#FF6A00', color: '#FFFFFF', fontFamily: SERIF }}
              data-testid="begin-audit-btn">
              {isSubmitting ? 'Scanning...' : scanFailure ? 'Regenerate Scan' : 'Begin Strategic Audit'}
            </button>
          </form>

          <div className="max-w-sm mx-auto mt-8 grid grid-cols-2 gap-3">
            {['Market positioning', 'Competitive signals', 'Trust architecture', 'Growth pressure'].map(item => (
              <div key={item} className="flex items-center gap-2 text-left">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#FF6A00' }} />
                <span className="text-xs" style={{ color: MUTED, fontFamily: "'JetBrains Mono', monospace" }}>{item}</span>
              </div>
            ))}
          </div>

          {/* Social handles */}
          <div className="max-w-md mx-auto mt-8 rounded-xl p-5 text-left" style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }} data-testid="social-handles-section">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: MUTED, fontFamily: "'JetBrains Mono', monospace" }}>Social Intelligence (Optional)</p>
            <p className="text-xs mb-4" style={{ color: MUTED }}>BIQc will use these for competitor news, staff sentiment, and SWOT signals.</p>
            <div className="space-y-3">
              {[
                { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/company/your-company', icon: 'in' },
                { key: 'twitter', label: 'X (Twitter)', placeholder: '@yourhandle', icon: 'X' },
                { key: 'instagram', label: 'Instagram', placeholder: '@yourhandle', icon: 'IG' },
                { key: 'facebook', label: 'Facebook', placeholder: 'facebook.com/yourpage', icon: 'fb' },
              ].map(s => (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: `${AZ}10`, color: AZ }}>{s.icon}</span>
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
        @keyframes panelGlow{0%,100%{box-shadow:0 0 0 rgba(255,106,0,0.0), inset 0 0 0 rgba(255,106,0,0.0)}50%{box-shadow:0 0 34px rgba(255,106,0,0.14), inset 0 0 24px rgba(255,106,0,0.09)}}
        @keyframes crtFlicker{0%,100%{opacity:0.18}50%{opacity:0.11}}
        @keyframes scanlineSweep{0%{transform:translateY(-110%)}100%{transform:translateY(310%)}}
        @keyframes dataPulse{0%,100%{opacity:0.45}50%{opacity:1}}
      `}</style>

      <div
        className="relative mb-8 w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #0A111A 0%, #0E1824 45%, #111D2B 100%)',
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
            background: 'linear-gradient(180deg, rgba(255,106,0,0) 0%, rgba(255,106,0,0.13) 45%, rgba(255,106,0,0) 100%)',
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
                border: '1px solid rgba(255,106,0,0.5)',
                background: 'radial-gradient(circle at center, rgba(255,106,0,0.18) 0%, rgba(255,106,0,0.06) 35%, rgba(255,106,0,0.02) 60%, rgba(0,0,0,0.0) 100%)',
              }}
            >
              <div className="absolute left-1/2 top-0 h-full w-px" style={{ background: 'rgba(255,106,0,0.16)' }} />
              <div className="absolute top-1/2 left-0 w-full h-px" style={{ background: 'rgba(255,106,0,0.16)' }} />
              {[30, 55, 80].map((size) => (
                <div
                  key={size}
                  className="absolute rounded-full"
                  style={{
                    inset: `${size / 2}px`,
                    border: '1px solid rgba(255,106,0,0.18)',
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
                  background: 'linear-gradient(to top, rgba(255,106,0,0.9) 0%, rgba(255,106,0,0.1) 100%)',
                }}
              />
              <div
                className="absolute top-1/2 left-1/2 w-2.5 h-2.5 rounded-full"
                style={{ transform: 'translate(-50%, -50%)', background: '#FF6A00', boxShadow: '0 0 14px rgba(255,106,0,0.6)' }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-[11px]" style={{ color: '#B9C8D8', fontFamily: "'JetBrains Mono', monospace" }}>
              <div className="rounded-lg px-2.5 py-2" style={{ background: '#0B141F', border: '1px solid #223243' }}>
                <div style={{ color: '#6C8095' }}>SIGNAL</div>
                <div style={{ color: '#FFB06E' }}>{signalStrength}%</div>
              </div>
              <div className="rounded-lg px-2.5 py-2" style={{ background: '#0B141F', border: '1px solid #223243' }}>
                <div style={{ color: '#6C8095' }}>CONFIDENCE</div>
                <div style={{ color: '#FFB06E' }}>{confidence}%</div>
              </div>
              <div className="rounded-lg px-2.5 py-2" style={{ background: '#0B141F', border: '1px solid #223243' }}>
                <div style={{ color: '#6C8095' }}>PACKETS/S</div>
                <div style={{ color: '#FFB06E' }}>{packetsPerSecond}</div>
              </div>
            </div>

            <div className="space-y-1.5">
              {Array.from({ length: 8 }).map((_, i) => {
                const active = ((tick + i * 3) % 10) + 2;
                return (
                  <div key={i} className="h-2 rounded-full overflow-hidden" style={{ background: '#142130' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${active * 10}%`,
                        background: 'linear-gradient(90deg, #FF6A00 0%, #FFC48B 100%)',
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
