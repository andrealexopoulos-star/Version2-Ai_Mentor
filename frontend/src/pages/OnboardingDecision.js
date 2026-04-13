import { useNavigate, Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';

const DISPLAY = fontFamily.display;

const OnboardingDecision = () => {
  const navigate = useNavigate();

  const handleConnectInbox = () => {
    sessionStorage.removeItem('onboarding_deferred');
    navigate('/connect-email', { replace: true });
  };

  const handleCalibrate = () => {
    sessionStorage.removeItem('onboarding_deferred');
    navigate('/onboarding', { replace: true });
  };

  const handleDefer = () => {
    sessionStorage.setItem('onboarding_deferred', 'true');
    navigate('/advisor', { replace: true });
  };

  const paths = [
    {
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="2" y="6" width="20" height="14" rx="2"/>
          <path d="m22 8-10 6L2 8"/>
        </svg>
      ),
      time: '~3 min',
      title: 'Just connect my inbox',
      desc: 'Link Outlook or Gmail and BIQc starts reading the room immediately. Best if you mostly want one thing: a calm morning brief.',
      features: [
        'Auto-discovers active deals + risks from inbox alone',
        'First insight within 90 seconds',
        'Zero questions, zero paperwork',
      ],
      cta: 'Connect inbox',
      onClick: handleConnectInbox,
      primary: false,
    },
    {
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
      ),
      time: '~7 min',
      title: 'Calibrate me properly',
      desc: "Tell BIQc what your business actually does, what good looks like for you, and which signals matter. The brief gets sharp on day one.",
      features: [
        '5-step calibration with smart defaults at every step',
        'Connect inbox + CRM + accounting (via Merge.dev)',
        'Custom signal thresholds for your stage',
        'Skip any step — answer the rest later',
      ],
      cta: 'Start calibration',
      onClick: handleCalibrate,
      primary: true,
      recommended: true,
    },
    {
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>
        </svg>
      ),
      time: '~30 min',
      title: 'Walk me through it',
      desc: 'Book a guided session with a real founder on our team. Best if you want a second pair of eyes or your data is messy.',
      features: [
        '30 min on Zoom with a BIQc team member',
        "We'll connect your tools live with you",
        'You leave with the brief already configured',
      ],
      cta: 'Book a session',
      onClick: () => navigate('/contact'),
      primary: false,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden" style={{ background: '#080C14' }}>
      <style>{`
        .path-card-btn { transition: all 300ms cubic-bezier(0.4,0,0.2,1); }
        .path-card-btn:hover { transform: translateY(-6px); border-color: #E85D00 !important; box-shadow: 0 16px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(232,93,0,0.2) !important; }
        .path-card-btn .path-cta { transition: all 200ms ease; }
        .path-card-btn:hover .path-cta-primary { filter: brightness(1.1); }
        .path-card-btn:hover .path-cta-secondary { border-color: rgba(232,93,0,0.4) !important; color: #E85D00 !important; }
      `}</style>
      {/* Lava gradient glow */}
      <div className="fixed top-[-200px] left-1/2 -translate-x-1/2 w-[1100px] h-[600px] pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(232,93,0,0.15) 0%, transparent 60%)', opacity: 0.5, filter: 'blur(100px)' }} />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-6">
        <Link to="/" className="flex items-center gap-3" style={{ color: '#EDF1F7', textDecoration: 'none' }}>
          <span className="inline-block rounded-full" style={{ width: 10, height: 10, background: '#E85D00', boxShadow: '0 0 16px #E85D00' }} />
          <span className="text-[22px] font-semibold" style={{ fontFamily: DISPLAY }}>BIQc</span>
        </Link>
        <div className="flex items-center gap-3" style={{ fontFamily: fontFamily.mono, fontSize: 11, color: '#708499', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: '#E85D00' }}>1</span>
          <span>Step 1 of 4 · Pick your path</span>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 relative z-10 px-6 py-10 sm:py-12">
        {/* Header */}
        <div className="text-center max-w-[700px] mx-auto mb-12">
          <div className="text-[11px] uppercase tracking-[0.08em] mb-3" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>— Welcome to BIQc</div>
          <h1 className="font-medium mb-4" style={{ fontFamily: DISPLAY, color: '#EDF1F7', fontSize: 'clamp(2.5rem, 5vw, 4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
            How would you like to <em style={{ fontStyle: 'italic', color: '#E85D00' }}>get started</em>?
          </h1>
          <p className="text-lg leading-relaxed max-w-[580px] mx-auto" style={{ fontFamily: fontFamily.body, color: '#8FA0B8' }}>
            You're three minutes away from your first quiet feed. Pick the path that fits you — you can switch later.
          </p>
        </div>

        {/* Path cards grid */}
        <div className="max-w-[1180px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
          {paths.map((path, i) => (
            <button
              key={i}
              onClick={path.onClick}
              className="path-card-btn relative rounded-2xl p-7 flex flex-col text-left cursor-pointer group"
              style={{
                background: path.recommended ? 'linear-gradient(180deg, #0E1628 0%, rgba(232,93,0,0.06) 200%)' : '#0E1628',
                border: `1px solid ${path.recommended ? '#E85D00' : 'rgba(140,170,210,0.12)'}`,
                boxShadow: path.recommended ? '0 8px 32px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.2)',
              }}
            >
              {path.recommended && (
                <div className="absolute -top-2.5 right-6 px-3 py-1 rounded-full text-white text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ background: '#E85D00', fontFamily: fontFamily.mono, boxShadow: '0 4px 12px rgba(232,93,0,0.4)' }}>
                  ★ Most chosen
                </div>
              )}

              <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-5" style={{ background: path.recommended ? '#E85D00' : 'rgba(232,93,0,0.12)', color: path.recommended ? 'white' : '#E85D00', boxShadow: path.recommended ? '0 8px 24px rgba(232,93,0,0.3)' : 'none' }}>
                {path.icon}
              </div>

              <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: fontFamily.mono, color: '#708499' }}>{path.time}</div>
              <h3 className="text-[28px] font-medium mb-3" style={{ fontFamily: DISPLAY, color: '#EDF1F7', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{path.title}</h3>
              <p className="text-sm leading-relaxed mb-6" style={{ fontFamily: fontFamily.body, color: '#8FA0B8' }}>{path.desc}</p>

              <div className="flex flex-col gap-3 flex-1">
                {path.features.map((feat, j) => (
                  <div key={j} className="flex items-start gap-3 text-sm" style={{ color: '#EDF1F7' }}>
                    <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(232,93,0,0.12)', color: '#E85D00' }}>
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </div>
                    <span style={{ fontFamily: fontFamily.body }}>{feat}</span>
                  </div>
                ))}
              </div>

              <div className={`path-cta mt-6 w-full text-center py-3 rounded-xl text-sm font-semibold ${path.primary ? 'path-cta-primary' : 'path-cta-secondary'}`} style={{
                background: path.primary ? '#E85D00' : 'transparent',
                color: path.primary ? 'white' : '#EDF1F7',
                border: path.primary ? 'none' : '1px solid rgba(140,170,210,0.12)',
                fontFamily: fontFamily.body,
              }}>
                {path.cta} <span className="ml-1">→</span>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-sm" style={{ color: '#708499', fontFamily: fontFamily.body }}>
          Not ready?{' '}
          <button onClick={handleDefer} className="font-medium" style={{ color: '#E85D00', background: 'none', border: 'none', cursor: 'pointer', fontFamily: fontFamily.body }}>
            Skip and explore the demo →
          </button>
        </div>
      </main>
    </div>
  );
};

export default OnboardingDecision;
