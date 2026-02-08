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
    <div className="min-h-screen bg-gradient-to-br from-[#080c14] via-[#0f172a] to-[#162032] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin mx-auto" />
        <h1 className="text-xl font-semibold text-white tracking-tight">Initiating BIQC{dots}</h1>
        <p className="text-sm text-white/50">Preparing your Intelligence Platform.</p>
        <p className="text-xs text-white/30">You will be directed shortly.</p>
      </div>
    </div>
  );
};

export default InitiatingBIQC;
