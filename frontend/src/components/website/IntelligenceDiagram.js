import { useEffect, useRef } from 'react';
import { fontFamily } from '../../design-system/tokens';

// ─── Input categories — 3×2 grid ─────────────────────────────────────────────

const SIX_INPUT_CATEGORIES = [
  {
    label: 'Financial & Accounting',
    desc: 'Live cash flow, invoice ageing, and margin signals.',
    tools: ['Xero', 'QuickBooks', 'MYOB', 'NetSuite'],
    color: '#10B981',
  },
  {
    label: 'CRM & Sales',
    desc: 'Pipeline velocity, deal health, and client engagement.',
    tools: ['HubSpot', 'Salesforce', 'Pipedrive'],
    color: '#3B82F6',
  },
  {
    label: 'Operations',
    desc: 'Task status, project timelines, and SOP compliance.',
    tools: ['Monday', 'Asana', 'ERP Systems'],
    color: '#8B5CF6',
  },
  {
    label: 'Email & Comms',
    desc: 'Response patterns, escalations, and sentiment shifts.',
    tools: ['Outlook', 'Gmail', 'Slack', 'Teams'],
    color: '#F59E0B',
  },
  {
    label: 'Market Intelligence',
    desc: 'Competitor moves, demand shifts, and industry signals.',
    tools: ['Competitor Recon', 'Industry Signals', 'Web Scanning'],
    color: '#FF6A00',
  },
  {
    label: 'HR & Payments',
    desc: 'Staff utilisation, overtime, and payroll anomalies.',
    tools: ['BambooHR', 'Workable', 'Stripe'],
    color: '#EF4444',
  },
];

const PIPELINE_STEPS = ['Connect', 'Analyse', 'Detect', 'Act'];

// ─── Animated vertical connector ─────────────────────────────────────────────

const AnimatedConnector = ({ height = 40 }) => (
  <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', padding: '6px 0', height: height + 12 }}>
    <div style={{
      position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 6,
      width: 2, height,
      background: 'linear-gradient(to bottom, rgba(255,140,40,0.55), rgba(255,140,40,0.12))',
      boxShadow: '0 0 8px rgba(255,140,40,0.3)',
    }} />
    <div className="signal-pulse" style={{
      position: 'absolute', left: '50%', transform: 'translateX(-50%)',
      width: 7, height: 7, borderRadius: '50%', background: '#FF8C28', top: 6,
      boxShadow: '0 0 12px rgba(255,140,40,0.8), 0 0 24px rgba(255,140,40,0.4)',
    }} />
    <style>{`
      .signal-pulse { animation: signalMove 2s ease-in-out infinite; }
      @keyframes signalMove {
        0%   { transform: translateX(-50%) translateY(0);            opacity: 0; }
        20%  { opacity: 1; }
        80%  { opacity: 1; }
        100% { transform: translateX(-50%) translateY(${height}px);  opacity: 0; }
      }
    `}</style>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const IntelligenceDiagram = ({ embedded = false }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.querySelectorAll('.flow-dot').forEach((dot, i) => {
      dot.style.animationDelay = `${i * 0.4}s`;
    });
  }, []);

  return (
    <section
      ref={ref}
      className={`relative overflow-hidden ${embedded ? 'pt-6 pb-8' : 'py-16 sm:py-20'}`}
      data-testid="intelligence-diagram"
    >
      <style>{`
        @keyframes coreGlow {
          0%,100% { box-shadow: 0 0 40px rgba(255,140,40,0.35), 0 0 80px rgba(255,140,40,0.15); }
          50%      { box-shadow: 0 0 55px rgba(255,140,40,0.5),  0 0 110px rgba(255,140,40,0.22); }
        }
        @keyframes corePulse {
          0%,100% { opacity: 0.3; transform: scale(1); }
          50%     { opacity: 0.6; transform: scale(1.15); }
        }
        @keyframes waveFloat {
          0%,100% { transform: translateX(-50%) scaleX(1);    opacity: 0.04; }
          50%     { transform: translateX(-50%) scaleX(1.04); opacity: 0.09; }
        }
        @keyframes stepPulse {
          0%,100% { opacity: 0.55; }
          50%     { opacity: 1; }
        }
      `}</style>

      {/* Subtle grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,140,40,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,140,40,0.018) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />
      {/* Central energy wave */}
      <div className="absolute left-1/2 -translate-x-1/2 hidden sm:block pointer-events-none" style={{
        top: '35%', width: 1000, height: 320,
        background: 'radial-gradient(ellipse, rgba(255,140,40,0.06) 0%, transparent 70%)',
        animation: 'waveFloat 10s ease-in-out infinite',
      }} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">

        {/* ── TIER 1: YOUR BUSINESS SIGNALS — 3×2 grid ── */}
        <div className="text-center mb-8">
          <h2 style={{
            fontFamily: fontFamily.display,
            color: '#F4F7FA',
            fontSize: 'clamp(26px, 3.8vw, 44px)',
            fontWeight: 700,
            lineHeight: 1.1,
            marginBottom: 8,
          }}>
            Your Business Signals
          </h2>
          <p style={{
            fontFamily: fontFamily.body,
            color: '#9FB0C3',
            fontSize: 'clamp(14px, 1.6vw, 17px)',
            lineHeight: 1.6,
          }}>
            What is happening across your systems
          </p>
        </div>

        {/* 3-column × 2-row input grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
        }}>
          {SIX_INPUT_CATEGORIES.map(cat => (
            <div
              key={cat.label}
              style={{
                borderRadius: 14,
                padding: '20px 20px',
                background: 'rgba(255,255,255,0.025)',
                border: `1px solid ${cat.color}35`,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'border-color 0.2s',
              }}
            >
              {/* Icon dot + label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: cat.color,
                  boxShadow: `0 0 8px ${cat.color}80`,
                  flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: fontFamily.mono,
                  color: cat.color,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  lineHeight: 1.3,
                }}>
                  {cat.label}
                </span>
              </div>

              {/* Description */}
              <p style={{
                fontFamily: fontFamily.body,
                color: 'rgba(159,176,195,0.65)',
                fontSize: 12,
                lineHeight: 1.55,
                margin: 0,
              }}>
                {cat.desc}
              </p>

              {/* Tool pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 'auto' }}>
                {cat.tools.map(t => (
                  <span key={t} style={{
                    fontFamily: fontFamily.mono,
                    color: '#9FB0C3',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 5,
                    whiteSpace: 'nowrap',
                  }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <AnimatedConnector height={52} />

        {/* ── TIER 2: BIQc INTELLIGENCE ENGINE ── */}
        <div className="text-center mb-6">
          <span style={{ fontFamily: fontFamily.mono, color: '#FF9C45', fontSize: '11px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
            BIQc Intelligence Engine
          </span>
          <p style={{ fontFamily: fontFamily.body, color: '#9FB0C3', fontSize: '13px', marginTop: 4 }}>
            Continuous AI cognition across every signal
          </p>
        </div>

        {/* Core glowing node */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{ position: 'relative' }} data-testid="biqc-core-node">
            <div style={{
              position: 'absolute', inset: -48, borderRadius: '50%', pointerEvents: 'none',
              background: 'radial-gradient(circle, rgba(255,140,40,0.14) 0%, rgba(255,100,0,0.04) 50%, transparent 70%)',
              animation: 'corePulse 6s ease-in-out infinite',
            }} />
            <div style={{
              position: 'absolute', inset: -28, borderRadius: '50%', pointerEvents: 'none',
              border: '1px solid rgba(255,140,40,0.08)',
              animation: 'corePulse 6s ease-in-out infinite 1.5s',
            }} />
            <div style={{
              position: 'relative',
              padding: '28px 80px',
              borderRadius: 20,
              textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(38,50,65,0.97), rgba(12,20,30,0.97))',
              border: '2px solid rgba(255,140,40,0.5)',
              animation: 'coreGlow 6s ease-in-out infinite',
            }}>
              <span style={{
                fontFamily: fontFamily.mono, color: '#FF7A18',
                fontSize: 30, fontWeight: 800, display: 'block',
                textShadow: '0 0 28px rgba(255,122,24,0.6)',
              }}>
                BIQc
              </span>
              <span style={{
                display: 'block', marginTop: 4,
                fontFamily: fontFamily.mono, color: '#9FB0C3',
                fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
              }}>
                Your AI Executive Team
              </span>
              <span style={{
                display: 'block', marginTop: 8,
                fontFamily: fontFamily.body,
                color: 'rgba(159,176,195,0.6)',
                fontSize: 11,
              }}>
                Powered By BIQc Trinity Intelligence Layer
              </span>
            </div>
          </div>
        </div>

        {/* 4-step animated pipeline */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {PIPELINE_STEPS.map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                padding: '9px 22px', borderRadius: 8,
                background: 'rgba(255,140,40,0.05)',
                border: '1px solid rgba(255,140,40,0.18)',
                animation: `stepPulse 3s ease-in-out infinite ${i * 0.65}s`,
              }}>
                <span style={{ fontFamily: fontFamily.mono, color: '#FF9C45', fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  {step}
                </span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div style={{ padding: '0 5px' }}>
                  <svg width="24" height="10" viewBox="0 0 24 10" fill="none">
                    <line x1="0" y1="5" x2="20" y2="5" stroke="rgba(255,140,40,0.35)" strokeWidth="1.2" strokeDasharray="3 2">
                      <animate attributeName="stroke-dashoffset" from="10" to="0" dur="1.5s" repeatCount="indefinite" />
                    </line>
                    <polygon points="18,2 24,5 18,8" fill="rgba(255,140,40,0.5)" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default IntelligenceDiagram;
