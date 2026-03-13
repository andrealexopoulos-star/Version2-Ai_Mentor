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
export const WelcomeHandshake = ({ firstName, websiteUrl, setWebsiteUrl, onSubmit, onManualFallback, isSubmitting, error }) => {
  const [phase, setPhase] = useState('intro'); // intro | scan
  const [showPrivacy, setShowPrivacy] = useState(false);
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
            Let's scan your business.
          </h1>
          <p className="text-base leading-relaxed mb-8" style={{ color: MUTED, maxWidth: 460, margin: '0 auto 32px' }}>
            Enter your website URL. BIQc will analyse your market position, competitive landscape and digital footprint in real time.
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
              data-testid="begin-audit-btn">
              {isSubmitting ? 'Scanning...' : 'Begin Strategic Audit'}
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

          <button onClick={onManualFallback}
            className="mt-6 text-xs font-medium cursor-pointer transition-colors"
            style={{ color: MUTED }}
            data-testid="no-website-btn">
            I Don't Have a Website — Analyse My Business Manually
          </button>
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
  useEffect(() => {
    const interval = setInterval(() => setPhase(p => (p + 1) % ANALYZE_PHASES.length), 3000);
    const fallbackTimer = setTimeout(() => setShowFallback(true), 18000);
    return () => {
      clearInterval(interval);
      clearTimeout(fallbackTimer);
    };
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
