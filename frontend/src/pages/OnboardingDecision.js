import { useNavigate, Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import useForceLightTheme from '../hooks/useForceLightTheme';
import BiqcLogoCard from '../components/BiqcLogoCard';

const OnboardingDecision = () => {
  // P0 2026-04-23 (Andreas CTO): signup/onboarding/calibration path MUST be
  // light theme. Was previously forcing dark — direct regression.
  useForceLightTheme();
  const navigate = useNavigate();

  const handleConnectInbox = () => {
    sessionStorage.removeItem('onboarding_deferred');
    // Pass returnTo=/advisor so after Outlook/Gmail OAuth the user lands on the
    // inbox-first intelligence page instead of being stranded on /connect-email.
    navigate('/connect-email?returnTo=%2Fadvisor', { replace: true });
  };

  const handleCalibrate = () => {
    sessionStorage.removeItem('onboarding_deferred');
    navigate('/onboarding', { replace: true });
  };

  const handleDefer = () => {
    sessionStorage.setItem('onboarding_deferred', 'true');
    navigate('/soundboard', { replace: true });
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflowX: 'hidden', background: 'var(--canvas-app)' }}>
      <style>{`
        .path-card-btn {
          transition: all 300ms var(--ease-standard, cubic-bezier(0.4,0,0.2,1));
          text-align: left;
        }
        .path-card-btn:hover {
          transform: translateY(-6px);
          border-color: var(--lava) !important;
          box-shadow: var(--elev-3) !important;
        }
        .path-card-btn:focus-visible {
          outline: 0;
          box-shadow: var(--ring-focus);
        }
        .path-card-btn:active {
          transform: translateY(1px);
        }
        .path-card-btn .path-cta { transition: all 200ms ease; }
        .path-card-btn:hover .path-cta-primary {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(232,93,0,0.32), 0 16px 32px -8px rgba(232,93,0,0.40);
        }
        .path-card-btn:hover .path-cta-secondary {
          border-color: var(--border-hover) !important;
          background: var(--surface-tint) !important;
        }
        .decision-grid {
          max-width: 1180px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--sp-5, 20px);
        }
        @media (min-width: 900px) {
          .decision-grid { grid-template-columns: 1fr 1fr 1fr; }
        }
      `}</style>

      {/* Lava gradient glow */}
      <div style={{
        position: 'fixed', top: -200, left: '50%', transform: 'translateX(-50%)',
        width: 1100, height: 600,
        background: 'radial-gradient(ellipse, var(--lava-soft) 0%, transparent 60%)',
        opacity: 0.5, filter: 'blur(100px)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Nav */}
      <nav style={{
        position: 'relative', zIndex: 1,
        padding: 'var(--sp-6) var(--sp-10)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <BiqcLogoCard size="sm" />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)',
        }}>
          <span style={{
            width: 18, height: 18, borderRadius: '50%',
            background: 'var(--lava)', color: 'white',
            display: 'grid', placeItems: 'center',
            fontSize: 10, fontWeight: 700,
          }}>1</span>
          <span>Step 1 of 4 · Pick your path</span>
        </div>
      </nav>

      {/* Content */}
      <main style={{
        flex: 1, position: 'relative', zIndex: 1,
        padding: 'var(--sp-10) var(--sp-6) var(--sp-12)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', maxWidth: 700, margin: '0 auto var(--sp-12)' }}>
          <div style={{
            color: 'var(--lava)',
            fontFamily: 'var(--font-mono)', fontSize: 11,
            textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)',
          }}>
            — Welcome to BIQc
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            color: 'var(--ink-display)',
            letterSpacing: 'var(--ls-tight)',
            lineHeight: 1.05,
            marginTop: 'var(--sp-3)',
          }}>
            How would you like to <em style={{ fontStyle: 'italic', color: 'var(--lava)' }}>get started</em>?
          </h1>
          <p style={{
            color: 'var(--ink-secondary)',
            marginTop: 'var(--sp-4)',
            fontSize: 'var(--size-lg)',
            lineHeight: 1.5,
            maxWidth: 580, marginLeft: 'auto', marginRight: 'auto',
            fontFamily: 'var(--font-ui)',
          }}>
            You're three minutes away from your first quiet feed. Pick the path that fits you — you can switch later.
          </p>
        </div>

        {/* Path cards grid */}
        <div className="decision-grid">
          {paths.map((path, i) => (
            <button
              key={i}
              onClick={path.onClick}
              className="path-card-btn"
              style={{
                background: path.recommended
                  ? 'linear-gradient(180deg, var(--surface) 0%, var(--lava-wash) 200%)'
                  : 'var(--surface)',
                border: `1px solid ${path.recommended ? 'var(--lava)' : 'var(--border)'}`,
                borderRadius: 'var(--r-2xl)',
                padding: 'var(--sp-7)',
                display: 'flex', flexDirection: 'column',
                cursor: 'pointer',
                position: 'relative',
                boxShadow: 'var(--elev-1)',
                color: 'inherit',
              }}
            >
              {path.recommended && (
                <div style={{
                  position: 'absolute', top: -10, right: 'var(--sp-6)',
                  background: 'var(--lava)', color: 'white',
                  padding: '4px 12px',
                  borderRadius: 'var(--r-pill)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600, fontSize: 10,
                  textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)',
                  boxShadow: '0 4px 12px rgba(232,93,0,0.4)',
                }}>
                  ★ Most chosen
                </div>
              )}

              <div style={{
                width: 56, height: 56,
                background: path.recommended ? 'var(--lava)' : 'var(--lava-wash)',
                color: path.recommended ? 'white' : 'var(--lava)',
                borderRadius: 'var(--r-lg)',
                display: 'grid', placeItems: 'center',
                marginBottom: 'var(--sp-5)',
                boxShadow: path.recommended ? '0 8px 24px rgba(232,93,0,0.3)' : 'none',
              }}>
                {path.icon}
              </div>

              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                color: 'var(--ink-muted)',
                textTransform: 'uppercase', letterSpacing: 'var(--ls-caps)',
                marginBottom: 'var(--sp-2)',
              }}>{path.time}</div>
              <h3 style={{
                fontFamily: 'var(--font-display)', fontSize: 28,
                color: 'var(--ink-display)',
                letterSpacing: 'var(--ls-tight)', lineHeight: 1.1,
              }}>{path.title}</h3>
              <p style={{
                color: 'var(--ink-secondary)',
                marginTop: 'var(--sp-3)',
                fontSize: 'var(--size-sm)',
                lineHeight: 1.6,
                fontFamily: 'var(--font-ui)',
              }}>{path.desc}</p>

              <div style={{
                marginTop: 'var(--sp-6)',
                display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)',
                flex: 1,
              }}>
                {path.features.map((feat, j) => (
                  <div key={j} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)',
                    color: 'var(--ink)',
                    fontSize: 'var(--size-sm)', lineHeight: 1.5,
                  }}>
                    <div style={{
                      flexShrink: 0, width: 18, height: 18,
                      background: 'var(--lava-wash)', color: 'var(--lava)',
                      borderRadius: '50%',
                      display: 'grid', placeItems: 'center',
                      marginTop: 2,
                    }}>
                      <Check style={{ width: 10, height: 10 }} strokeWidth={3} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-ui)' }}>{feat}</span>
                  </div>
                ))}
              </div>

              <div
                className={`path-cta ${path.primary ? 'path-cta-primary' : 'path-cta-secondary'}`}
                style={{
                  marginTop: 'var(--sp-6)',
                  width: '100%',
                  textAlign: 'center',
                  height: 44,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 'var(--r-md)',
                  fontSize: 'var(--size-sm)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-ui)',
                  ...(path.primary
                    ? {
                        background: 'linear-gradient(135deg, var(--lava-warm) 0%, var(--lava) 50%, var(--lava-deep) 100%)',
                        backgroundSize: '200% 200%',
                        color: 'var(--ink-inverse, white)',
                        border: 'none',
                        boxShadow: '0 1px 2px rgba(232,93,0,0.28), 0 8px 24px -8px rgba(232,93,0,0.32)',
                      }
                    : {
                        background: 'var(--surface)',
                        color: 'var(--ink)',
                        border: '1px solid var(--border-strong)',
                      }),
                }}
              >
                {path.cta} <span style={{ marginLeft: 'var(--sp-2)' }}>→</span>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 'var(--sp-12)',
          textAlign: 'center',
          color: 'var(--ink-muted)',
          fontSize: 'var(--size-sm)',
          fontFamily: 'var(--font-ui)',
        }}>
          Not ready?{' '}
          <button onClick={handleDefer} style={{
            color: 'var(--lava)',
            fontWeight: 500,
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-ui)',
          }}>
            Skip and explore the demo →
          </button>
        </div>
      </main>
    </div>
  );
};

export default OnboardingDecision;
