import React, { useState } from 'react';
import PlatformLayout from '../../../../components/website/PlatformLayout';
import { AlertTriangle, TrendingDown, TrendingUp, DollarSign, Shield, Clock, Users, BarChart3, ChevronDown, ChevronUp, Zap, Target, RefreshCw } from 'lucide-react';
import { fontFamily } from '../../../../design-system/tokens';


// Shared components for all industry pages
export const Panel = ({ children, className = '' }) => (
  <div className={`rounded-lg p-5 ${className}`} style={{ background: 'var(--surface, #FFFFFF)', border: '1px solid rgba(140,170,210,0.15)' }}>{children}</div>
);

export const MetricCard = ({ label, value, sub, color = 'var(--ink-display, #0A0A0A)', alert = false }) => (
  <div className="p-4 rounded-lg" style={{ background: 'var(--surface, #FFFFFF)', border: `1px solid ${alert ? '#E85D00' + '40' : 'rgba(140,170,210,0.15)'}` }}>
    <span className="text-[10px] text-[#64748B] uppercase tracking-wider block mb-1" style={{ fontFamily: fontFamily.mono }}>{label}</span>
    <span className="text-xl font-bold block" style={{ fontFamily: fontFamily.mono, color }}>{value}</span>
    {sub && <span className="text-[11px] text-[#64748B] mt-0.5 block" style={{ fontFamily: fontFamily.body }}>{sub}</span>}
  </div>
);

export const SystemState = ({ state = 'DRIFT', confidence = 84, velocity = 'worsening' }) => {
  const states = { STABLE: '#10B981', DRIFT: '#F59E0B', COMPRESSION: '#E85D00', CRITICAL: '#EF4444' };
  const c = states[state] || states.DRIFT;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg mb-6" style={{ background: c + '08', border: `1px solid ${c}25` }} data-testid="system-state">
      <div className="w-3 h-3 rounded-full" style={{ background: c, boxShadow: `0 0 12px ${c}50` }} />
      <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ fontFamily: fontFamily.mono, color: c }}>{state}</span>
      <span className="text-[11px] text-[#64748B]" style={{ fontFamily: fontFamily.mono }}>{velocity === 'worsening' ? '↘' : velocity === 'improving' ? '↗' : '→'} {velocity}</span>
      <span className="text-[11px] px-2 py-0.5 rounded ml-auto" style={{ fontFamily: fontFamily.mono, color: c, background: c + '15' }}>{confidence}%</span>
    </div>
  );
};

export const Inevitability = ({ title, why, impact, window: w, severity = 'high' }) => {
  const [open, setOpen] = useState(false);
  const sevC = { high: '#E85D00', medium: '#F59E0B', low: '#3B82F6' };
  const c = sevC[severity];
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: 'var(--surface, #FFFFFF)', border: `1px solid ${c}20` }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c, boxShadow: `0 0 8px ${c}50` }} />
        <span className="text-sm font-medium text-[#EDF1F7] flex-1" style={{ fontFamily: fontFamily.display }}>{title}</span>
        <span className="text-[10px] px-2 py-0.5 rounded uppercase tracking-wider" style={{ fontFamily: fontFamily.mono, color: c, background: c + '15' }}>{severity}</span>
        {open ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 space-y-2" style={{ borderTop: '1px solid rgba(140,170,210,0.15)' }}>
          <div><span className="text-[10px] text-[#64748B] uppercase" style={{ fontFamily: fontFamily.mono }}>Why</span><p className="text-sm text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>{why}</p></div>
          <div><span className="text-[10px] text-[#64748B] uppercase" style={{ fontFamily: fontFamily.mono }}>Financial Impact</span><p className="text-sm text-[#E85D00]" style={{ fontFamily: fontFamily.mono }}>{impact}</p></div>
          <div><span className="text-[10px] text-[#64748B] uppercase" style={{ fontFamily: fontFamily.mono }}>Intervention Window</span><p className="text-sm text-[#EDF1F7]" style={{ fontFamily: fontFamily.mono }}>{w}</p></div>
        </div>
      )}
    </div>
  );
};

export const DecisionPressure = ({ score = 7 }) => {
  const c = score >= 8 ? '#EF4444' : score >= 5 ? '#E85D00' : '#10B981';
  return (
    <Panel>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[#64748B] uppercase tracking-wider" style={{ fontFamily: fontFamily.mono }}>Decision Pressure</span>
        <span className="text-2xl font-bold" style={{ fontFamily: fontFamily.mono, color: c }}>{score}<span className="text-xs text-[#64748B]">/10</span></span>
      </div>
      <div className="h-2 rounded-full" style={{ background: 'rgba(140,170,210,0.15)' }}>
        <div className="h-2 rounded-full transition-all" style={{ width: `${score * 10}%`, background: c }} />
      </div>
      <span className="text-[10px] text-[#64748B] mt-1 block" style={{ fontFamily: fontFamily.mono }}>{score >= 8 ? 'Critical decisions pending' : score >= 5 ? 'Moderate pressure — act within 7 days' : 'Low pressure — stable'}</span>
    </Panel>
  );
};

export const ExecMemo = ({ memo }) => (
  <Panel>
    <h3 className="text-sm font-semibold text-[#EDF1F7] mb-3" style={{ fontFamily: fontFamily.display }}>Executive Memo</h3>
    <p className="text-sm text-[#8FA0B8] leading-relaxed whitespace-pre-line" style={{ fontFamily: fontFamily.body }}>{memo}</p>
  </Panel>
);

export const HeatBar = ({ label, value, max = 100, color = '#E85D00', suffix = '%', alert = false }) => (
  <div className="mb-3">
    <div className="flex justify-between mb-1">
      <span className="text-xs text-[#8FA0B8]" style={{ fontFamily: fontFamily.body }}>{label}</span>
      <span className="text-xs font-semibold" style={{ fontFamily: fontFamily.mono, color: alert ? '#E85D00' : 'var(--ink-display, #0A0A0A)' }}>{value}{suffix}</span>
    </div>
    <div className="h-1.5 rounded-full" style={{ background: 'rgba(140,170,210,0.15)' }}>
      <div className="h-1.5 rounded-full" style={{ width: `${Math.min((value / max) * 100, 100)}%`, background: color }} />
    </div>
  </div>
);

const SORA = fontFamily.display;
const INTER = fontFamily.body;
const MONO = fontFamily.mono;
export { SORA, INTER, MONO, PlatformLayout };
