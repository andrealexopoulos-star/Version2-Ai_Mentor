import React, { useEffect, useState } from "react";

/**
 * Initiating BIQC — Post-calibration handoff screen
 * 
 * Renders for 2 seconds, then calls onReady().
 * No buttons, no user input. Pure system authority transition.
 */
const InitiatingBIQC = ({ onReady }) => {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".");
    }, 500);

    const timer = setTimeout(() => {
      if (onReady) onReady();
    }, 2000);

    return () => {
      clearInterval(dotInterval);
      clearTimeout(timer);
    };
  }, [onReady]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--biqc-bg)' }}>
      <style>{`
        @keyframes initPulse{0%,100%{opacity:0.4;transform:scale(0.95)}50%{opacity:1;transform:scale(1.05)}}
        @keyframes initBar{0%{width:0}100%{width:100%}}
      `}</style>
      <div className="text-center space-y-6">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto" style={{ background: '#E85D00', animation: 'initPulse 2s ease-in-out infinite' }}>
          <span className="text-white font-bold text-xl" style={{ fontFamily: "'JetBrains Mono', monospace" }}>B</span>
        </div>
        <h1 className="text-xl font-semibold text-[#EDF1F7] tracking-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>Initiating BIQc{dots}</h1>
        <p className="text-sm text-[#8FA0B8]" style={{ fontFamily: "'Inter', sans-serif" }}>Preparing your Intelligence Platform.</p>
        <div className="w-48 mx-auto">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(140,170,210,0.15)' }}>
            <div className="h-full rounded-full" style={{ background: '#E85D00', animation: 'initBar 2s ease-in-out' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InitiatingBIQC;
