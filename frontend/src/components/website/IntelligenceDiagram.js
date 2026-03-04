import { useEffect, useRef } from 'react';

const MONO = "'JetBrains Mono', monospace";
const INTER = "'Inter', sans-serif";

const SYSTEMS = [
  { label: 'Finance Systems', tools: ['Xero', 'NetSuite', 'QuickBooks', 'MYOB'] },
  { label: 'Operations Systems', tools: ['ERP Systems', 'HubSpot', 'Monday', 'Asana'] },
  { label: 'Sales Systems', tools: ['Salesforce', 'CRMs', 'Pipedrive', 'HubSpot'] },
];

const AnimatedConnector = ({ height = 40 }) => (
  <div className="flex justify-center relative" style={{ padding: '8px 0', height: height + 16 }}>
    <div className="absolute left-1/2 -translate-x-1/2" style={{
      width: 2,
      height,
      background: 'linear-gradient(to bottom, rgba(255,140,40,0.5), rgba(255,140,40,0.15))',
      boxShadow: '0 0 8px rgba(255,140,40,0.3)',
    }} />
    <div className="signal-pulse absolute left-1/2 -translate-x-1/2" style={{
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: '#FF8C28',
      boxShadow: '0 0 12px rgba(255,140,40,0.8), 0 0 24px rgba(255,140,40,0.4)',
    }} />
    <style>{`
      .signal-pulse {
        animation: signalMove ${1.5 + Math.random()}s ease-in-out infinite;
      }
      @keyframes signalMove {
        0% { top: 8px; opacity: 0; }
        20% { opacity: 1; }
        80% { opacity: 1; }
        100% { top: ${height + 8}px; opacity: 0; }
      }
    `}</style>
  </div>
);

const GlowCard = ({ children, className = '', glow = false }) => (
  <div className={`rounded-xl p-5 sm:p-6 transition-all duration-300 hover:border-[#FF7A18]/40 ${className}`} style={{
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,140,40,0.25)',
    boxShadow: glow ? '0 0 40px rgba(255,140,40,0.1), 0 0 80px rgba(255,140,40,0.05)' : 'none',
  }}>
    {children}
  </div>
);

const FlowLabel = ({ label, sublabel }) => (
  <div className="text-center">
    <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] uppercase block" style={{ fontFamily: MONO, color: '#FF9C45' }}>{label}</span>
    {sublabel && <span className="text-[11px] sm:text-[13px] block mt-1" style={{ fontFamily: INTER, color: '#A6B2C1', fontWeight: 300 }}>{sublabel}</span>}
  </div>
);

const AnimatedNodeSVG = () => {
  const svgRef = useRef(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const dots = svg.querySelectorAll('.flow-dot');
    dots.forEach((dot, i) => {
      dot.style.animationDelay = `${i * 0.4}s`;
    });
  }, []);

  return (
    <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 120" preserveAspectRatio="xMidYMid meet" style={{ opacity: 0.6 }}>
      <defs>
        <radialGradient id="nodeGlow">
          <stop offset="0%" stopColor="rgba(255,140,40,0.4)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      {/* Animated connection lines from 3 system cards to watchtower */}
      {[200, 400, 600].map((x, i) => (
        <g key={i}>
          <line x1={x} y1="10" x2="400" y2="110" stroke="rgba(255,140,40,0.15)" strokeWidth="1" strokeDasharray="4 3" />
          <circle className="flow-dot" cx="0" cy="0" r="3" fill="#FF8C28" style={{
            filter: 'drop-shadow(0 0 4px rgba(255,140,40,0.8))',
            animation: `flowDown${i} 2.5s ease-in-out infinite`,
          }}>
            <animateMotion dur="2.5s" repeatCount="indefinite" begin={`${i * 0.6}s`}>
              <mpath href={`#path-${i}`} />
            </animateMotion>
          </circle>
          <path id={`path-${i}`} d={`M${x},10 L400,110`} fill="none" />
        </g>
      ))}
    </svg>
  );
};

export const IntelligenceDiagram = () => (
  <section className="relative py-20 sm:py-28 overflow-hidden" data-testid="intelligence-diagram">
    <style>{`
      @keyframes coreGlow {
        0%,100% { box-shadow: 0 0 40px rgba(255,140,40,0.35), 0 0 80px rgba(255,140,40,0.15); }
        50% { box-shadow: 0 0 50px rgba(255,140,40,0.5), 0 0 100px rgba(255,140,40,0.22); }
      }
      @keyframes corePulse {
        0%,100% { opacity: 0.3; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(1.15); }
      }
      @keyframes signalFlow {
        0% { stroke-dashoffset: 20; }
        100% { stroke-dashoffset: 0; }
      }
      @keyframes waveFloat {
        0%,100% { transform: translateX(-50%) scaleX(1); opacity: 0.04; }
        50% { transform: translateX(-50%) scaleX(1.04); opacity: 0.08; }
      }
    `}</style>

    {/* Subtle intelligence field background */}
    <div className="absolute inset-0" style={{
      backgroundImage: 'linear-gradient(rgba(255,140,40,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,140,40,0.02) 1px, transparent 1px)',
      backgroundSize: '60px 60px',
    }} />

    {/* Energy wave layers */}
    <div className="absolute left-1/2 -translate-x-1/2 hidden sm:block" style={{
      top: '30%', width: 900, height: 250,
      background: 'radial-gradient(ellipse, rgba(255,140,40,0.07) 0%, transparent 70%)',
      animation: 'waveFloat 10s ease-in-out infinite', pointerEvents: 'none',
    }} />
    <div className="absolute left-1/2 -translate-x-1/2 hidden sm:block" style={{
      top: '55%', width: 700, height: 180,
      background: 'radial-gradient(ellipse, rgba(255,140,40,0.05) 0%, transparent 70%)',
      animation: 'waveFloat 8s ease-in-out infinite 2s', pointerEvents: 'none',
    }} />

    <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">

      {/* TIER 1: BUSINESS SIGNALS */}
      <FlowLabel label="Business Signals" sublabel="What is happening across your systems" />
      <AnimatedConnector height={32} />

      {/* Three system blocks with animated connecting lines */}
      <div className="relative">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 relative z-10">
          {SYSTEMS.map(sys => (
            <GlowCard key={sys.label}>
              <h4 className="text-[10px] sm:text-[11px] font-bold tracking-[0.15em] uppercase mb-3 text-center" style={{ fontFamily: MONO, color: '#FF9C45' }}>{sys.label}</h4>
              <div className="flex flex-wrap justify-center gap-2">
                {sys.tools.map(t => (
                  <span key={t} className="text-[10px] sm:text-[11px] px-2.5 py-1 rounded-md transition-colors hover:bg-orange-500/10" style={{ fontFamily: MONO, color: '#A6B2C1', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>{t}</span>
                ))}
              </div>
            </GlowCard>
          ))}
        </div>
      </div>

      <AnimatedConnector height={40} />

      {/* TIER 2: WATCHTOWER */}
      <GlowCard className="max-w-md mx-auto text-center" glow>
        <FlowLabel label="Watchtower" sublabel="Continuous monitoring across your tools" />
        {/* Animated radar sweep */}
        <div className="flex justify-center mt-3">
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 rounded-full" style={{ border: '1.5px solid rgba(255,140,40,0.2)' }} />
            <div className="absolute inset-1 rounded-full" style={{ border: '1px solid rgba(255,140,40,0.12)' }} />
            <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ background: '#FF8C28', boxShadow: '0 0 8px rgba(255,140,40,0.8)' }} />
            <div className="absolute top-1/2 left-1/2 origin-bottom" style={{
              width: 1, height: 14, background: 'linear-gradient(to top, rgba(255,140,40,0.6), transparent)',
              transform: 'translate(-50%, -100%)',
              animation: 'spin 3s linear infinite',
            }} />
          </div>
        </div>
      </GlowCard>

      <AnimatedConnector height={48} />

      {/* TIER 3: BIQc CORE */}
      <div className="flex items-center justify-center gap-6 sm:gap-10">
        {/* Left inputs */}
        <div className="text-right flex-1 max-w-[160px] hidden sm:block">
          <p className="text-[12px] sm:text-[13px] mb-1" style={{ fontFamily: INTER, fontWeight: 300, color: '#A6B2C1' }}>Risk Signals</p>
          <p className="text-[12px] sm:text-[13px]" style={{ fontFamily: INTER, fontWeight: 300, color: '#A6B2C1' }}>Market Intelligence</p>
        </div>

        {/* Animated input lines */}
        <div className="hidden sm:flex items-center" style={{ width: 40 }}>
          <svg width="40" height="4" viewBox="0 0 40 4">
            <line x1="0" y1="2" x2="40" y2="2" stroke="rgba(255,140,40,0.3)" strokeWidth="1" strokeDasharray="4 3">
              <animate attributeName="stroke-dashoffset" from="20" to="0" dur="2s" repeatCount="indefinite" />
            </line>
            <circle cx="0" cy="2" r="2" fill="#FF8C28" style={{ filter: 'drop-shadow(0 0 4px rgba(255,140,40,0.8))' }}>
              <animate attributeName="cx" from="0" to="40" dur="1.5s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>

        {/* Core node with HALO */}
        <div className="relative" data-testid="biqc-core-node">
          {/* Outer halo */}
          <div className="absolute -inset-10 rounded-full" style={{
            background: 'radial-gradient(circle, rgba(255,140,40,0.15) 0%, rgba(255,100,0,0.05) 50%, transparent 70%)',
            animation: 'corePulse 6s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
          {/* Second halo ring */}
          <div className="absolute -inset-6 rounded-full" style={{
            border: '1px solid rgba(255,140,40,0.08)',
            animation: 'corePulse 6s ease-in-out infinite 1.5s',
            pointerEvents: 'none',
          }} />
          {/* Core */}
          <div className="relative px-8 sm:px-12 py-5 sm:py-6 rounded-full text-center" style={{
            background: 'linear-gradient(135deg, rgba(42,52,68,0.95), rgba(15,23,32,0.95))',
            border: '2px solid rgba(255,140,40,0.5)',
            animation: 'coreGlow 6s ease-in-out infinite',
          }}>
            <span className="text-xl sm:text-2xl font-bold block" style={{ fontFamily: MONO, color: '#FF7A18', textShadow: '0 0 20px rgba(255,122,24,0.5)' }}>BIQc</span>
            <span className="text-[8px] sm:text-[9px] tracking-[0.15em] uppercase block mt-1" style={{ fontFamily: MONO, color: '#A6B2C1' }}>Business Intelligence</span>
            <span className="text-[8px] sm:text-[9px] tracking-[0.15em] uppercase block" style={{ fontFamily: MONO, color: '#A6B2C1' }}>Quotient Centre</span>
          </div>
        </div>

        {/* Animated output lines */}
        <div className="hidden sm:flex items-center" style={{ width: 40 }}>
          <svg width="40" height="4" viewBox="0 0 40 4">
            <line x1="0" y1="2" x2="40" y2="2" stroke="rgba(255,140,40,0.3)" strokeWidth="1" strokeDasharray="4 3">
              <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="2s" repeatCount="indefinite" />
            </line>
            <circle cx="0" cy="2" r="2" fill="#FF8C28" style={{ filter: 'drop-shadow(0 0 4px rgba(255,140,40,0.8))' }}>
              <animate attributeName="cx" from="0" to="40" dur="1.5s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>

        {/* Right outputs */}
        <div className="flex-1 max-w-[160px] hidden sm:block">
          <p className="text-[12px] sm:text-[13px] mb-1" style={{ fontFamily: INTER, fontWeight: 300, color: '#A6B2C1' }}>Decision Guidance</p>
          <p className="text-[12px] sm:text-[13px]" style={{ fontFamily: INTER, fontWeight: 300, color: '#A6B2C1' }}>Growth Signals</p>
        </div>
      </div>

      <AnimatedConnector height={48} />

      {/* TIER 4: DECISION SUPPORT */}
      <GlowCard className="max-w-md mx-auto text-center" glow>
        <FlowLabel label="Decision Support" sublabel="Clear signals that guide leadership decisions" />
      </GlowCard>

      {/* Partner logos with brand colors */}
      <div className="flex items-center justify-center gap-6 sm:gap-10 flex-wrap mt-12 sm:mt-16">
        {['HubSpot', 'Salesforce', 'Xero', 'Stripe', 'Slack', 'Google'].map(name => (
          <div key={name} className="flex items-center gap-2 opacity-50 hover:opacity-90 transition-opacity cursor-default">
            <span className="text-[12px] sm:text-[13px]" style={{ fontFamily: INTER, fontWeight: 400, color: getBrandColor(name) }}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const getBrandColor = (name) => {
  const colors = { HubSpot: '#FF7A59', Salesforce: '#00A1E0', Xero: '#13B5EA', Stripe: '#635BFF', Slack: '#E01E5A', Google: '#4285F4' };
  return colors[name] || '#A6B2C1';
};

export default IntelligenceDiagram;
