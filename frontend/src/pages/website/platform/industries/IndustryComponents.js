import React, { useState } from 'react';
import PlatformLayout from '../../../../components/website/PlatformLayout';
import { AlertTriangle, TrendingDown, TrendingUp, DollarSign, Shield, Clock, Users, BarChart3, ChevronDown, ChevronUp, Zap, Target, RefreshCw } from 'lucide-react';

const SORA = "'Cormorant Garamond', Georgia, serif";
const INTER = "'Inter', sans-serif";
const MONO = "'JetBrains Mono', monospace";

// Shared components for all industry pages
export const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: '#141C26', border: '1px solid #243140' }}>{children}</div>
);

export const MetricCard = ({ label, value, sub, color = '#F4F7FA', alert = false }) => (
  <div className="p-4 rounded-lg" style={{ background: '#0F1720', border: `1px solid ${alert ? '#FF6A00' + '40' : '#243140'}` }}>
    <span className="text-[10px] text-[#64748B] uppercase tracking-wider block mb-1" style={{ fontFamily: MONO }}>{label}</span>
    <span className="text-xl font-bold block" style={{ fontFamily: MONO, color }}>{value}</span>
    {sub && <span className="text-[11px] text-[#64748B] mt-0.5 block" style={{ fontFamily: INTER }}>{sub}</span>}
  </div>
);

export const SystemState = ({ state = 'DRIFT', confidence = 84, velocity = 'worsening' }) => {
  const states = { STABLE: '#10B981', DRIFT: '#F59E0B', COMPRESSION: '#FF6A00', CRITICAL: '#EF4444' };
  const c = states[state] || states.DRIFT;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg mb-6" style={{ background: c + '08', border: `1px solid ${c}25` }} data-testid="system-state">
      <div className="w-3 h-3 rounded-full" style={{ background: c, boxShadow: `0 0 12px ${c}50` }} />
      <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ fontFamily: MONO, color: c }}>{state}</span>
      <span className="text-[11px] text-[#64748B]" style={{ fontFamily: MONO }}>{velocity === 'worsening' ? '↘' : velocity === 'improving' ? '↗' : '→'} {velocity}</span>
      <span className="text-[11px] px-2 py-0.5 rounded ml-auto" style={{ fontFamily: MONO, color: c, background: c + '15' }}>{confidence}%</span>
    </div>
  );
};

export const Inevitability = ({ title, why, impact, window: w, severity = 'high' }) => {
  const [open, setOpen] = useState(false);
  const sevC = { high: '#FF6A00', medium: '#F59E0B', low: '#3B82F6' };
  const c = sevC[severity];
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#141C26', border: `1px solid ${c}20` }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c, boxShadow: `0 0 8px ${c}50` }} />
        <span className="text-sm font-medium text-[#F4F7FA] flex-1" style={{ fontFamily: SORA }}>{title}</span>
        <span className="text-[10px] px-2 py-0.5 rounded uppercase tracking-wider" style={{ fontFamily: MONO, color: c, background: c + '15' }}>{severity}</span>
        {open ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 space-y-2" style={{ borderTop: '1px solid #243140' }}>
          <div><span className="text-[10px] text-[#64748B] uppercase" style={{ fontFamily: MONO }}>Why</span><p className="text-sm text-[#9FB0C3]" style={{ fontFamily: INTER }}>{why}</p></div>
          <div><span className="text-[10px] text-[#64748B] uppercase" style={{ fontFamily: MONO }}>Financial Impact</span><p className="text-sm text-[#FF6A00]" style={{ fontFamily: MONO }}>{impact}</p></div>
          <div><span className="text-[10px] text-[#64748B] uppercase" style={{ fontFamily: MONO }}>Intervention Window</span><p className="text-sm text-[#F4F7FA]" style={{ fontFamily: MONO }}>{w}</p></div>
        </div>
      )}
    </div>
  );
};

export const DecisionPressure = ({ score = 7 }) => {
  const c = score >= 8 ? '#EF4444' : score >= 5 ? '#FF6A00' : '#10B981';
  return (
    <Panel>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[#64748B] uppercase tracking-wider" style={{ fontFamily: MONO }}>Decision Pressure</span>
        <span className="text-2xl font-bold" style={{ fontFamily: MONO, color: c }}>{score}<span className="text-xs text-[#64748B]">/10</span></span>
      </div>
      <div className="h-2 rounded-full" style={{ background: '#243140' }}>
        <div className="h-2 rounded-full transition-all" style={{ width: `${score * 10}%`, background: c }} />
      </div>
      <span className="text-[10px] text-[#64748B] mt-1 block" style={{ fontFamily: MONO }}>{score >= 8 ? 'Critical decisions pending' : score >= 5 ? 'Moderate pressure — act within 7 days' : 'Low pressure — stable'}</span>
    </Panel>
  );
};

export const ExecMemo = ({ memo }) => (
  <Panel>
    <h3 className="text-sm font-semibold text-[#F4F7FA] mb-3" style={{ fontFamily: SORA }}>Executive Memo</h3>
    <p className="text-sm text-[#9FB0C3] leading-relaxed whitespace-pre-line" style={{ fontFamily: INTER }}>{memo}</p>
  </Panel>
);

export const HeatBar = ({ label, value, max = 100, color = '#FF6A00', suffix = '%', alert = false }) => (
  <div className="mb-3">
    <div className="flex justify-between mb-1">
      <span className="text-xs text-[#9FB0C3]" style={{ fontFamily: INTER }}>{label}</span>
      <span className="text-xs font-semibold" style={{ fontFamily: MONO, color: alert ? '#FF6A00' : '#F4F7FA' }}>{value}{suffix}</span>
    </div>
    <div className="h-1.5 rounded-full" style={{ background: '#243140' }}>
      <div className="h-1.5 rounded-full" style={{ width: `${Math.min((value / max) * 100, 100)}%`, background: color }} />
    </div>
  </div>
);

export { SORA, INTER, MONO, PlatformLayout };
