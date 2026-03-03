import React from 'react';

const MONO = "'JetBrains Mono', monospace";
const INTER = "'Inter', sans-serif";

const SYSTEMS = [
  { label: 'FINANCE SYSTEMS', tools: ['Xero', 'NetSuite', 'QuickBooks', 'MYOB'] },
  { label: 'OPERATIONS SYSTEMS', tools: ['ERP Systems', 'HubSpot', 'Monday', 'Asana'] },
  { label: 'SALES SYSTEMS', tools: ['Salesforce', 'CRMs', 'Pipedrive', 'HubSpot'] },
];

const OUTPUTS_LEFT = ['Risk Signals', 'Market Intelligence'];
const OUTPUTS_RIGHT = ['Decision Guidance', 'Growth Signals'];

const PARTNER_LOGOS = [
  { name: 'HubSpot', domain: 'hubspot.com' },
  { name: 'Salesforce', domain: 'salesforce.com' },
  { name: 'Xero', domain: 'xero.com' },
  { name: 'Stripe', domain: 'stripe.com' },
  { name: 'Slack', domain: 'slack.com' },
  { name: 'Google', domain: 'google.com' },
];

export const IntelligenceDiagram = () => (
  <section className="relative py-16 sm:py-24 overflow-hidden" data-testid="intelligence-diagram">
    {/* Background effects */}
    <style>{`
      @keyframes energyPulse {
        0%, 100% { opacity: 0.6; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.08); }
      }
      @keyframes lineGlow {
        0%, 100% { opacity: 0.15; }
        50% { opacity: 0.4; }
      }
      @keyframes particleFlow {
        0% { transform: translateY(0) scaleY(0); opacity: 0; }
        20% { opacity: 1; scaleY(1); }
        100% { transform: translateY(60px) scaleY(1); opacity: 0; }
      }
      @keyframes circuitPulse {
        0% { background-position: 0% 0%; }
        100% { background-position: 100% 100%; }
      }
    `}</style>

    {/* Circuit network background */}
    <div className="absolute inset-0" style={{
      backgroundImage: `
        linear-gradient(90deg, rgba(255,106,0,0.03) 1px, transparent 1px),
        linear-gradient(rgba(255,106,0,0.03) 1px, transparent 1px)
      `,
      backgroundSize: '48px 48px',
    }} />

    {/* Horizontal circuit lines */}
    <div className="absolute left-0 right-0" style={{ top: '30%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,106,0,0.15) 20%, rgba(255,106,0,0.3) 50%, rgba(255,106,0,0.15) 80%, transparent)', animation: 'lineGlow 4s ease-in-out infinite' }} />
    <div className="absolute left-0 right-0" style={{ top: '70%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,106,0,0.1) 30%, rgba(255,106,0,0.2) 50%, rgba(255,106,0,0.1) 70%, transparent)', animation: 'lineGlow 5s ease-in-out infinite 1s' }} />

    {/* Central energy burst */}
    <div className="absolute left-1/2 -translate-x-1/2" style={{
      top: '45%', width: 500, height: 300,
      background: 'radial-gradient(ellipse at center, rgba(255,106,0,0.25) 0%, rgba(255,106,0,0.08) 30%, rgba(255,106,0,0.02) 60%, transparent 80%)',
      animation: 'energyPulse 4s ease-in-out infinite',
      filter: 'blur(20px)',
      pointerEvents: 'none',
    }} />

    {/* Corner glow accents */}
    <div className="absolute" style={{ top: '20%', left: '10%', width: 200, height: 200, background: 'radial-gradient(circle, rgba(255,106,0,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
    <div className="absolute" style={{ top: '20%', right: '10%', width: 200, height: 200, background: 'radial-gradient(circle, rgba(255,106,0,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

    <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">

      {/* THE BIQc INTELLIGENCE header */}
      <div className="flex justify-center mb-10 sm:mb-14">
        <div className="px-8 sm:px-12 py-3 sm:py-4 rounded-lg" style={{
          background: 'rgba(15,23,32,0.9)',
          border: '1px solid rgba(255,106,0,0.3)',
          boxShadow: '0 0 30px rgba(255,106,0,0.1), inset 0 0 20px rgba(255,106,0,0.03)',
        }}>
          <span className="text-sm sm:text-base font-semibold tracking-[0.2em] uppercase" style={{ fontFamily: MONO, color: '#FFFFFF' }}>
            THE <span style={{ color: '#FF6A00' }}>BIQc</span> INTELLIGENCE
          </span>
        </div>
      </div>

      {/* Vertical connector from header to systems */}
      <div className="flex justify-center mb-6">
        <div style={{ width: 1, height: 32, background: 'linear-gradient(to bottom, rgba(255,106,0,0.4), rgba(255,106,0,0.1))' }} />
      </div>

      {/* Three system boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
        {SYSTEMS.map((sys) => (
          <div key={sys.label} className="rounded-lg p-4 sm:p-5 text-center" style={{
            background: 'rgba(15,23,32,0.85)',
            border: '1px solid rgba(255,106,0,0.2)',
            boxShadow: '0 0 20px rgba(255,106,0,0.05)',
          }}>
            <h4 className="text-[11px] sm:text-xs font-bold tracking-[0.15em] uppercase mb-3" style={{ fontFamily: MONO, color: '#FF6A00' }}>
              {sys.label}
            </h4>
            <div className="flex flex-wrap justify-center gap-2">
              {sys.tools.map((tool) => (
                <span key={tool} className="text-[10px] sm:text-[11px] px-2 py-1 rounded" style={{
                  fontFamily: MONO, color: '#9FB0C3',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>{tool}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Vertical connectors to engine */}
      <div className="flex justify-center mb-6">
        <div className="flex gap-[140px] sm:gap-[200px]">
          <div style={{ width: 1, height: 32, background: 'linear-gradient(to bottom, rgba(255,106,0,0.2), rgba(255,106,0,0.4))' }} />
          <div style={{ width: 1, height: 32, background: 'linear-gradient(to bottom, rgba(255,106,0,0.3), rgba(255,106,0,0.5))' }} />
          <div style={{ width: 1, height: 32, background: 'linear-gradient(to bottom, rgba(255,106,0,0.2), rgba(255,106,0,0.4))' }} />
        </div>
      </div>

      {/* Central engine with left/right labels */}
      <div className="flex items-center justify-center gap-4 sm:gap-8 mb-8">
        {/* Left: Risk Signals / Market Intelligence */}
        <div className="text-right flex-1 max-w-[180px]">
          {OUTPUTS_LEFT.map((label) => (
            <p key={label} className="text-[12px] sm:text-sm mb-1" style={{ fontFamily: INTER, color: '#9FB0C3' }}>{label}</p>
          ))}
        </div>

        {/* Center: BIQc Engine */}
        <div className="relative">
          {/* Glow ring */}
          <div className="absolute -inset-4 rounded-full" style={{
            background: 'radial-gradient(circle, rgba(255,106,0,0.15) 0%, transparent 70%)',
            animation: 'energyPulse 3s ease-in-out infinite',
          }} />
          <div className="relative px-6 sm:px-10 py-4 sm:py-5 rounded-full" style={{
            background: 'linear-gradient(135deg, rgba(42,52,68,0.95), rgba(20,28,38,0.95))',
            border: '2px solid rgba(255,106,0,0.4)',
            boxShadow: '0 0 40px rgba(255,106,0,0.2), 0 0 80px rgba(255,106,0,0.08), inset 0 0 20px rgba(255,106,0,0.05)',
          }}>
            <div className="text-center">
              <span className="text-lg sm:text-2xl font-bold" style={{ fontFamily: MONO, color: '#FF6A00' }}>BIQc</span>
              <span className="block text-[9px] sm:text-[10px] tracking-wider uppercase mt-0.5" style={{ fontFamily: MONO, color: '#9FB0C3' }}>Intelligence Engine</span>
            </div>
          </div>
        </div>

        {/* Right: Decision Guidance / Growth Signals */}
        <div className="flex-1 max-w-[180px]">
          {OUTPUTS_RIGHT.map((label) => (
            <p key={label} className="text-[12px] sm:text-sm mb-1" style={{ fontFamily: INTER, color: '#9FB0C3' }}>{label}</p>
          ))}
        </div>
      </div>

      {/* Horizontal connector lines from engine to labels */}
      <div className="hidden sm:flex justify-center mb-8">
        <div style={{ width: '70%', height: 1, background: 'linear-gradient(90deg, rgba(255,106,0,0.3), rgba(255,106,0,0.1) 40%, rgba(255,106,0,0.1) 60%, rgba(255,106,0,0.3))' }} />
      </div>

      {/* Partner logos */}
      <div className="flex items-center justify-center gap-6 sm:gap-10 flex-wrap mb-4">
        {PARTNER_LOGOS.map((p) => (
          <div key={p.name} className="flex items-center gap-1.5 opacity-50 hover:opacity-90 transition-opacity">
            <img
              src={`https://logo.clearbit.com/${p.domain}?size=40`}
              alt={p.name}
              className="w-5 h-5 object-contain"
              loading="lazy"
              onError={e => { e.target.style.display = 'none'; }}
            />
            <span className="text-[12px] sm:text-sm font-medium" style={{ fontFamily: INTER, color: '#9FB0C3' }}>{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default IntelligenceDiagram;
