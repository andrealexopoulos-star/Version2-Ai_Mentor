import React from 'react';

const MONO = "'JetBrains Mono', monospace";
const INTER = "'Inter', sans-serif";

const Card = ({ children, className = '', glow = false }) => (
  <div className={`rounded-xl p-5 sm:p-6 transition-all duration-300 ${className}`} style={{
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,140,40,0.25)',
    borderRadius: 12,
    boxShadow: glow ? '0 0 40px rgba(255,140,40,0.08)' : 'none',
  }}
  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,140,40,0.35)'; e.currentTarget.style.boxShadow = '0 0 30px rgba(255,140,40,0.12)'; }}
  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,140,40,0.25)'; e.currentTarget.style.boxShadow = glow ? '0 0 40px rgba(255,140,40,0.08)' : 'none'; }}>
    {children}
  </div>
);

const FlowConnector = ({ height = 40 }) => (
  <div className="flex justify-center" style={{ padding: '8px 0' }}>
    <div style={{ width: 1, height, background: 'linear-gradient(to bottom, rgba(255,140,40,0.35), rgba(255,140,40,0.1))' }} />
  </div>
);

const FlowLabel = ({ label, sublabel }) => (
  <div className="text-center">
    <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] uppercase block" style={{ fontFamily: MONO, color: '#FF9C45' }}>{label}</span>
    {sublabel && <span className="text-[11px] sm:text-[13px] block mt-1" style={{ fontFamily: INTER, color: '#A6B2C1', fontWeight: 300 }}>{sublabel}</span>}
  </div>
);

const SYSTEMS = [
  { label: 'Finance Systems', tools: ['Xero', 'NetSuite', 'QuickBooks', 'MYOB'] },
  { label: 'Operations Systems', tools: ['ERP Systems', 'HubSpot', 'Monday', 'Asana'] },
  { label: 'Sales Systems', tools: ['Salesforce', 'CRMs', 'Pipedrive', 'HubSpot'] },
];

export const IntelligenceDiagram = () => (
  <section className="relative py-20 sm:py-28 overflow-hidden" data-testid="intelligence-diagram">
    <style>{`
      @keyframes coreGlow { 0%,100% { box-shadow: 0 0 40px rgba(255,140,40,0.35), 0 0 80px rgba(255,140,40,0.15); } 50% { box-shadow: 0 0 50px rgba(255,140,40,0.45), 0 0 100px rgba(255,140,40,0.2); } }
      @keyframes softPulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }
      @keyframes waveMove { 0% { transform: translateX(-50%) scaleX(1); } 50% { transform: translateX(-50%) scaleX(1.02); } 100% { transform: translateX(-50%) scaleX(1); } }
    `}</style>

    {/* Subtle intelligence field background */}
    <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,140,40,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,140,40,0.015) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

    {/* Soft energy waves */}
    <div className="absolute left-1/2 -translate-x-1/2 hidden sm:block" style={{ top: '35%', width: 800, height: 200, background: 'radial-gradient(ellipse, rgba(255,140,40,0.06) 0%, transparent 70%)', animation: 'waveMove 10s ease-in-out infinite', pointerEvents: 'none' }} />
    <div className="absolute left-1/2 -translate-x-1/2 hidden sm:block" style={{ top: '55%', width: 600, height: 150, background: 'radial-gradient(ellipse, rgba(255,140,40,0.04) 0%, transparent 70%)', animation: 'waveMove 8s ease-in-out infinite 2s', pointerEvents: 'none' }} />

    <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">

      {/* TIER 1: BUSINESS SIGNALS */}
      <FlowLabel label="Business Signals" sublabel="What is happening in your business" />
      <FlowConnector height={32} />

      {/* Three system blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        {SYSTEMS.map(sys => (
          <Card key={sys.label}>
            <h4 className="text-[10px] sm:text-[11px] font-bold tracking-[0.15em] uppercase mb-3 text-center" style={{ fontFamily: MONO, color: '#FF9C45' }}>{sys.label}</h4>
            <div className="flex flex-wrap justify-center gap-2">
              {sys.tools.map(t => (
                <span key={t} className="text-[10px] sm:text-[11px] px-2.5 py-1 rounded-md" style={{ fontFamily: MONO, color: '#A6B2C1', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>{t}</span>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <FlowConnector height={40} />

      {/* TIER 2: WATCHTOWER */}
      <Card className="max-w-md mx-auto text-center" glow>
        <FlowLabel label="Watchtower" sublabel="Constant monitoring across all your systems" />
      </Card>

      <FlowConnector height={48} />

      {/* TIER 3: BIQc CORE — Business Intelligence Quotient Centre */}
      <div className="flex items-center justify-center gap-6 sm:gap-10">
        {/* Left: inputs */}
        <div className="text-right flex-1 max-w-[160px] hidden sm:block">
          <p className="text-[12px] sm:text-[13px] mb-1" style={{ fontFamily: INTER, fontWeight: 300, color: '#A6B2C1' }}>Risk Signals</p>
          <p className="text-[12px] sm:text-[13px]" style={{ fontFamily: INTER, fontWeight: 300, color: '#A6B2C1' }}>Market Intelligence</p>
        </div>

        {/* Core node */}
        <div className="relative">
          <div className="absolute -inset-6 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,140,40,0.12) 0%, transparent 70%)', animation: 'softPulse 4s ease-in-out infinite', pointerEvents: 'none' }} />
          <div className="relative px-8 sm:px-12 py-5 sm:py-6 rounded-full text-center" style={{
            background: 'linear-gradient(135deg, rgba(42,52,68,0.95), rgba(15,23,32,0.95))',
            border: '2px solid rgba(255,140,40,0.4)',
            animation: 'coreGlow 4s ease-in-out infinite',
          }}>
            <span className="text-xl sm:text-2xl font-bold block" style={{ fontFamily: MONO, color: '#FF7A18' }}>BIQc</span>
            <span className="text-[8px] sm:text-[9px] tracking-[0.15em] uppercase block mt-1" style={{ fontFamily: MONO, color: '#A6B2C1' }}>Business Intelligence</span>
            <span className="text-[8px] sm:text-[9px] tracking-[0.15em] uppercase block" style={{ fontFamily: MONO, color: '#A6B2C1' }}>Quotient Centre</span>
          </div>
        </div>

        {/* Right: outputs */}
        <div className="flex-1 max-w-[160px] hidden sm:block">
          <p className="text-[12px] sm:text-[13px] mb-1" style={{ fontFamily: INTER, fontWeight: 300, color: '#A6B2C1' }}>Decision Guidance</p>
          <p className="text-[12px] sm:text-[13px]" style={{ fontFamily: INTER, fontWeight: 300, color: '#A6B2C1' }}>Growth Signals</p>
        </div>
      </div>

      <FlowConnector height={48} />

      {/* TIER 4: DECISION SUPPORT */}
      <Card className="max-w-md mx-auto text-center" glow>
        <FlowLabel label="Decision Support" sublabel="Clear signals to guide leadership decisions" />
      </Card>

      {/* Partner logos */}
      <div className="flex items-center justify-center gap-6 sm:gap-10 flex-wrap mt-12 sm:mt-16">
        {[
          { name: 'HubSpot', domain: 'hubspot.com' },
          { name: 'Salesforce', domain: 'salesforce.com' },
          { name: 'Xero', domain: 'xero.com' },
          { name: 'Stripe', domain: 'stripe.com' },
          { name: 'Slack', domain: 'slack.com' },
          { name: 'Google', domain: 'google.com' },
        ].map(p => (
          <div key={p.name} className="flex items-center gap-1.5 opacity-40 hover:opacity-80 transition-opacity">
            <img src={`https://logo.clearbit.com/${p.domain}?size=32`} alt={p.name} className="w-4 h-4 object-contain" loading="lazy" onError={e => { e.target.style.display = 'none'; }} />
            <span className="text-[12px] sm:text-[13px]" style={{ fontFamily: INTER, fontWeight: 400, color: '#A6B2C1' }}>{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default IntelligenceDiagram;
