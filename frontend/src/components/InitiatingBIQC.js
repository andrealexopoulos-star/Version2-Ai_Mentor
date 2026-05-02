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
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto overflow-hidden" style={{ background: 'var(--surface, #FFFFFF)', border: '1px solid rgba(10,10,10,0.08)', animation: 'initPulse 2s ease-in-out infinite' }}>
          <img src="/biqc-horizontal-light.svg" alt="BIQc.ai" style={{ width: 36, height: 'auto' }} />
        </div>
        <h1 className="text-xl font-semibold text-[var(--ink-display)] tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Initiating BIQc{dots}</h1>
        <p className="text-sm text-[var(--ink-secondary)]" style={{ fontFamily: "var(--font-ui)" }}>Preparing your Intelligence Platform.</p>
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
