import React from 'react';
import { Shield, Target, Users, TrendingUp, Zap } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';


const REVEAL_PHASES = [
  'Compiling your Business DNA...',
  'Building your Intelligence Profile...',
  'Calibrating Revenue Velocity...',
  'Generating Executive Summary...',
  'Activating your Command Centre...',
];

const ExecutiveReveal = ({ firstName, lastResponse, revealPhase }) => (
  <div className="flex-1 flex flex-col items-center justify-center px-6" style={{ animation: 'fadeIn 0.8s ease', background: 'var(--biqc-bg)' }} data-testid="executive-reveal">
    <style>{`
      @keyframes revealPulse{0%,100%{box-shadow:0 0 20px rgba(232,93,0,0.2)}50%{box-shadow:0 0 40px rgba(232,93,0,0.5)}}
    `}</style>

    {/* Final phase — show Executive Summary */}
    {revealPhase >= REVEAL_PHASES.length - 1 ? (
      <div className="max-w-lg w-full text-center space-y-6" style={{ animation: 'fadeIn 1s ease' }}>
        <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto" style={{ background: '#E85D00', animation: 'revealPulse 2s ease-in-out infinite' }}>
          <Zap className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>
          Calibration Complete{firstName ? `, ${firstName}` : ''}.
        </h2>
        <p className="text-sm text-[#8FA0B8] leading-relaxed" style={{ fontFamily: fontFamily.body }}>
          Your Business DNA has been captured. Your AI agents are now calibrated to your communication style, risk posture, and decision-making approach.
        </p>

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-2 gap-3 text-left mt-6">
          {[
            { icon: Target, label: 'Decision Style', value: 'Data-driven', color: '#3B82F6' },
            { icon: Shield, label: 'Risk Posture', value: 'Moderate', color: '#F59E0B' },
            { icon: Users, label: 'Communication', value: 'Direct & concise', color: '#10B981' },
            { icon: TrendingUp, label: 'Focus Area', value: 'Revenue growth', color: '#E85D00' },
          ].map(item => (
            <div key={item.label} className="p-3 rounded-lg" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <item.icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                <span className="text-[10px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{item.label}</span>
              </div>
              <span className="text-sm font-semibold text-[#EDF1F7]" style={{ fontFamily: fontFamily.body }}>{item.value}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-[#64748B] mt-4" style={{ fontFamily: fontFamily.mono }}>
          Connecting to your Intelligence Platform...
        </p>
      </div>
    ) : (
      /* Progress phases */
      <div className="max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6" style={{ background: '#E85D00', animation: 'revealPulse 2s ease-in-out infinite' }}>
          <span className="text-white font-bold text-xl" style={{ fontFamily: fontFamily.mono }}>B</span>
        </div>

        <p className="text-lg mb-2 text-[#EDF1F7]" style={{ fontFamily: fontFamily.display }}>
          Thank you{firstName ? `, ${firstName}` : ''}.
        </p>
        {lastResponse && (
          <p className="text-sm text-[#8FA0B8] mb-8" style={{ fontFamily: fontFamily.body }}>
            Your alignment preferences have been integrated into your Decision DNA.
          </p>
        )}

        {/* Progress ring */}
        <div className="mb-6 mx-auto" style={{ width: 80, height: 80 }}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(140,170,210,0.15)" strokeWidth="3" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="#E85D00" strokeWidth="3"
              strokeDasharray="214" strokeDashoffset={214 - (214 * ((revealPhase + 1) / REVEAL_PHASES.length))}
              strokeLinecap="round" transform="rotate(-90 40 40)"
              style={{ transition: 'stroke-dashoffset 1.5s ease' }} />
          </svg>
        </div>

        <p className="text-base text-center leading-relaxed transition-opacity duration-700"
          style={{ fontFamily: fontFamily.display, color: 'var(--biqc-text)', maxWidth: 400, margin: '0 auto' }}>
          {REVEAL_PHASES[revealPhase]}
        </p>

        <div className="flex gap-1.5 mt-5 justify-center">
          {REVEAL_PHASES.map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full transition-colors duration-500"
              style={{ background: i <= revealPhase ? '#E85D00' : 'rgba(140,170,210,0.15)' }} />
          ))}
        </div>
      </div>
    )}
  </div>
);

export { ExecutiveReveal, REVEAL_PHASES };
