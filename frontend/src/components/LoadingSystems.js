import React, { useEffect, useRef, useState, useMemo } from 'react';
import { fontFamily } from '../design-system/tokens';


const MESH_MESSAGES = [
  'Mapping cross-functional signals…',
  'Linking revenue + velocity patterns…',
  'Identifying inevitabilities…',
  'Correlating behavioural drift…',
  'Constructing strategic topology…',
];

const RADAR_MESSAGES = [
  'Scanning for blindside risk…',
  'Monitoring operational compression…',
  'Detecting opportunity decay…',
  'Assessing systemic drift…',
  'Evaluating resilience thresholds…',
];

/**
 * MODE 1 — Cognitive Mesh Build
 * Use for: AI thinking, calibration analyzing, snapshot loading, intelligence refresh
 * Pure CSS animations — no external library, no physics engine
 */
export const CognitiveMesh = ({ message, compact = false }) => {
  const [msgIdx, setMsgIdx] = useState(0);
  const [fade, setFade] = useState(true);
  const prefersReduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => { setMsgIdx(p => (p + 1) % MESH_MESSAGES.length); setFade(true); }, 400);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  const h = compact ? 'h-40' : 'min-h-[300px]';

  return (
    <div className={`${h} flex flex-col items-center justify-center relative overflow-hidden`} data-testid="cognitive-mesh">
      <style>{`
        @keyframes meshFloat{0%,100%{transform:translate(0,0)}25%{transform:translate(3px,-4px)}50%{transform:translate(-2px,3px)}75%{transform:translate(4px,2px)}}
        @keyframes meshLine{0%{opacity:0;stroke-dashoffset:60}50%{opacity:0.3}100%{opacity:0;stroke-dashoffset:0}}
        @keyframes meshPulse{0%,100%{opacity:0.3;transform:scale(1)}50%{opacity:0.8;transform:scale(1.3)}}
        @keyframes meshGlow{0%,100%{box-shadow:0 0 8px rgba(232,93,0,0.1)}50%{box-shadow:0 0 20px rgba(232,93,0,0.2)}}
      `}</style>

      {/* Mesh nodes */}
      {!prefersReduced && (
        <div className="absolute inset-0 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">
            {/* Lines between nodes */}
            {[[80,60,200,80],[200,80,320,140],[120,180,240,160],[240,160,340,200],[80,60,120,180],[200,80,240,160],[320,140,340,200]].map(([x1,y1,x2,y2], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#E85D00" strokeWidth="0.5" strokeDasharray="60"
                style={{ animation: `meshLine ${3+i*0.7}s ease-in-out infinite`, animationDelay: `${i*0.4}s` }} />
            ))}
            {/* Nodes */}
            {[[80,60],[200,80],[320,140],[120,180],[240,160],[340,200],[160,120],[280,100],[60,130],[350,80],[180,220],[300,240]].map(([cx,cy], i) => (
              <circle key={i} cx={cx} cy={cy} r={i < 4 ? 3 : 2} fill="#E85D00"
                style={{ animation: `meshFloat ${4+i*0.3}s ease-in-out infinite, meshPulse ${2+i*0.5}s ease-in-out infinite`, animationDelay: `${i*0.2}s`, opacity: i < 6 ? 0.7 : 0.3 }} />
            ))}
          </svg>
        </div>
      )}

      {/* Microcopy */}
      <div className="relative z-10 text-center">
        <div className="mx-auto mb-4" style={{ animation: prefersReduced ? 'none' : 'meshGlow 3s ease-in-out infinite' }}>
          <img src="/biqc-horizontal-light.svg" alt="BIQc.ai" style={{ width: 72, height: 'auto', margin: '0 auto' }} />
        </div>
        <p className="text-xs transition-opacity duration-400" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.mono, opacity: fade ? 1 : 0 }}>
          {message || MESH_MESSAGES[msgIdx]}
        </p>
      </div>
    </div>
  );
};

/**
 * MODE 2 — Strategic Radar Sweep
 * Use for: System health, drift detection, market scan, watchtower
 * Pure CSS — no external libs
 */
export const RadarSweep = ({ message, compact = false }) => {
  const [msgIdx, setMsgIdx] = useState(0);
  const [fade, setFade] = useState(true);
  const [blips, setBlips] = useState([]);
  const prefersReduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => { setMsgIdx(p => (p + 1) % RADAR_MESSAGES.length); setFade(true); }, 400);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  // Random blips
  useEffect(() => {
    if (prefersReduced) return;
    const interval = setInterval(() => {
      const angle = Math.random() * Math.PI * 2;
      const r = 30 + Math.random() * 50;
      setBlips(prev => [...prev.slice(-5), { id: Date.now(), x: 50 + Math.cos(angle) * r, y: 50 + Math.sin(angle) * r, bright: Math.random() > 0.7 }]);
    }, 1200);
    return () => clearInterval(interval);
  }, [prefersReduced]);

  const h = compact ? 'h-40' : 'min-h-[300px]';

  return (
    <div className={`${h} flex flex-col items-center justify-center relative overflow-hidden`} data-testid="radar-sweep">
      <style>{`
        @keyframes radarSweep{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes radarPulse{0%{opacity:0.2;transform:scale(0.8)}50%{opacity:0.1;transform:scale(1.2)}100%{opacity:0;transform:scale(1.4)}}
        @keyframes blipIn{0%{opacity:0;transform:scale(0)}30%{opacity:1;transform:scale(1.2)}100%{opacity:0;transform:scale(0.8)}}
        @keyframes signalLock{0%{box-shadow:0 0 4px rgba(232,93,0,0.3)}50%{box-shadow:0 0 16px rgba(232,93,0,0.6)}100%{box-shadow:0 0 4px rgba(232,93,0,0.3)}}
      `}</style>

      {/* Radar visualization */}
      {!prefersReduced && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative" style={{ width: 200, height: 200 }}>
            {/* Grid */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(140,170,210,0.15)" strokeWidth="0.5" />
              <circle cx="100" cy="100" r="55" fill="none" stroke="rgba(140,170,210,0.15)" strokeWidth="0.3" />
              <circle cx="100" cy="100" r="30" fill="none" stroke="rgba(140,170,210,0.15)" strokeWidth="0.3" />
              <line x1="100" y1="20" x2="100" y2="180" stroke="rgba(140,170,210,0.15)" strokeWidth="0.3" />
              <line x1="20" y1="100" x2="180" y2="100" stroke="rgba(140,170,210,0.15)" strokeWidth="0.3" />
            </svg>
            {/* Sweep arc */}
            <div className="absolute inset-0" style={{ animation: 'radarSweep 3.5s linear infinite' }}>
              <svg className="w-full h-full" viewBox="0 0 200 200">
                <path d="M100,100 L100,20 A80,80 0 0,1 160,50 Z" fill="url(#sweepGrad)" opacity="0.4" />
                <defs>
                  <linearGradient id="sweepGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#E85D00" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#E85D00" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            {/* Pulse ring */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full" style={{ border: '1px solid #E85D0020', animation: 'radarPulse 4s ease-out infinite' }} />
            </div>
            {/* Blips */}
            {blips.map(b => (
              <div key={b.id} className="absolute w-2 h-2 rounded-full" style={{
                left: `${b.x}%`, top: `${b.y}%`, background: '#E85D00',
                animation: `blipIn 2s ease-out forwards${b.bright ? ', signalLock 1s ease-in-out' : ''}`,
                boxShadow: b.bright ? '0 0 8px rgba(232,93,0,0.5)' : 'none',
              }} />
            ))}
            {/* Center dot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full" style={{ background: '#E85D00', boxShadow: '0 0 12px rgba(232,93,0,0.4)' }} />
          </div>
        </div>
      )}

      {/* Microcopy */}
      <div className="relative z-10 text-center mt-auto mb-6">
        <p className="text-xs transition-opacity duration-400" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.mono, opacity: fade ? 1 : 0 }}>
          {message || RADAR_MESSAGES[msgIdx]}
        </p>
      </div>
    </div>
  );
};

/**
 * Inline loading indicator for buttons/small areas
 * Replaces the old "loading..." text with a subtle pulse dot
 */
export const InlineLoading = ({ text = 'processing' }) => (
  <span className="inline-flex items-center gap-1.5" data-testid="inline-loading">
    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#E85D00', animation: 'meshPulse 1.2s ease-in-out infinite' }} />
    <span className="text-xs" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>{text}...</span>
  </span>
);
