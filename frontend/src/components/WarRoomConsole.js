import React, { useState, useEffect, Component } from 'react';
import { useSWR } from '../hooks/useSWR';
import { apiClient } from '../lib/api';
import { RefreshCw, ChevronRight } from 'lucide-react';

const MONO = "'JetBrains Mono', 'SF Mono', monospace";
const HEAD = "'Inter Tight', 'Inter', -apple-system, sans-serif";

const STATE_CONFIG = {
  STABLE:      { label: 'STABLE',      color: '#22C55E', bg: 'rgba(34,197,94,0.06)',  border: 'rgba(34,197,94,0.15)' },
  DRIFT:       { label: 'DRIFT',       color: '#F59E0B', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)' },
  COMPRESSION: { label: 'COMPRESSION', color: '#F97316', bg: 'rgba(249,115,22,0.06)', border: 'rgba(249,115,22,0.15)' },
  CRITICAL:    { label: 'CRITICAL',    color: '#EF4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)' },
};

const POSITION_COLORS = {
  STABLE: '#22C55E', ELEVATED: '#F59E0B', DETERIORATING: '#F97316',
  CRITICAL: '#EF4444', PRESSURED: '#F97316', UNKNOWN: '#6B7280',
};

class ConsoleBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return (
      <div className="flex items-center justify-center h-full" style={{ background: '#09090B' }}>
        <div className="text-center space-y-3">
          <p className="text-xs tracking-widest" style={{ color: '#555', fontFamily: MONO }}>SYSTEM FAULT</p>
          <button onClick={() => this.setState({ hasError: false })} className="text-xs px-4 py-1.5 rounded" style={{ color: '#888', border: '1px solid #333', fontFamily: MONO }}>RETRY</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

const StrategicConsoleInner = () => {
  const [synthesizing, setSynthesizing] = useState(false);
  const { data: briefing, isLoading, mutate } = useSWR('/strategic-console/briefing', { revalidateOnFocus: true, dedupingInterval: 15000 });

  const triggerSynthesis = async () => {
    setSynthesizing(true);
    try {
      await apiClient.post('/strategic-console/synthesize');
      mutate();
    } catch {} finally { setSynthesizing(false); }
  };

  const st = STATE_CONFIG[briefing?.system_state] || STATE_CONFIG.STABLE;
  const dpi = briefing?.decision_pressure_index || 0;
  const forces = briefing?.compression || [];
  const narrative = briefing?.executive_narrative;
  const drifts = briefing?.drift_vectors || [];
  const signals = briefing?.signal_trace || [];
  const sources = briefing?.data_sources || [];
  const hasBrief = narrative && (narrative.primary_tension || typeof narrative === 'string');
  const primaryFocus = briefing?.primary_focus_domain;
  const now = new Date();

  return (
    <div className="flex flex-col h-full" style={{ background: '#09090B', color: '#E4E4E7', fontFamily: HEAD }}>

      {/* ═══ TOP BAR ═══ */}
      <header className="flex items-center justify-between px-5 md:px-8 py-3 shrink-0" style={{ borderBottom: '1px solid #1A1A1E' }} data-testid="console-header">
        <div className="flex items-center gap-4">
          <a href="/advisor" className="text-xs px-2.5 py-1 rounded" style={{ color: '#555', border: '1px solid #222', fontFamily: MONO, textDecoration: 'none' }} data-testid="console-home-btn">
            ← Dashboard
          </a>
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full" style={{ background: st.color, boxShadow: `0 0 8px ${st.color}40` }} />
            <span className="text-[11px] font-semibold tracking-widest" style={{ color: st.color, fontFamily: MONO }}>{st.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {primaryFocus && (
            <span className="text-[10px] tracking-wider uppercase" style={{ color: '#666', fontFamily: MONO }}>
              Focus: {primaryFocus}
            </span>
          )}
          <span className="text-[10px]" style={{ color: '#444', fontFamily: MONO }}>
            {now.toISOString().slice(0, 10)}
          </span>
          <button onClick={() => { triggerSynthesis(); }} disabled={synthesizing} className="flex items-center gap-1.5 text-[10px] px-3 py-1 rounded transition-colors" style={{ color: '#666', border: '1px solid #222', fontFamily: MONO }} data-testid="synthesize-btn">
            <RefreshCw className={`w-3 h-3 ${synthesizing ? 'animate-spin' : ''}`} />
            {synthesizing ? 'Synthesizing...' : 'Synthesize'}
          </button>
        </div>
      </header>

      {/* ═══ DECISION PRESSURE BAR ═══ */}
      <div className="h-[3px] shrink-0" style={{ background: '#111' }}>
        <div className="h-full transition-all duration-1000" style={{ width: `${dpi}%`, background: st.color, boxShadow: `0 0 12px ${st.color}30` }} />
      </div>

      {/* ═══ LOADING ═══ */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-5 h-5 border border-zinc-700 border-t-zinc-400 rounded-full animate-spin mx-auto" />
            <p className="text-xs" style={{ color: '#555', fontFamily: MONO }}>Loading strategic briefing...</p>
          </div>
        </div>
      )}

      {!isLoading && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-5 md:px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

              {/* ═══ LEFT COLUMN — Compression View ═══ */}
              <div className="lg:col-span-3 space-y-6" data-testid="compression-view">
                <div>
                  <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#555', fontFamily: MONO }}>
                    Active Forces
                  </h3>
                  {forces.length > 0 ? forces.map((f, i) => (
                    <div key={i} className="mb-3 p-4 rounded-xl" style={{ background: '#111113', border: '1px solid #1A1A1E' }} data-testid={`force-${i}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: POSITION_COLORS[f.position] || '#666' }} />
                        <span className="text-xs font-medium" style={{ color: '#D4D4D8' }}>{f.domain}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px]" style={{ color: POSITION_COLORS[f.position] || '#666', fontFamily: MONO }}>{f.position || f.intensity}</span>
                        {f.window_days && <span className="text-[10px]" style={{ color: '#F59E0B', fontFamily: MONO }}>{f.window_days}d window</span>}
                      </div>
                      {f.has_contradiction && <span className="text-[9px] mt-1 block" style={{ color: '#EF4444', fontFamily: MONO }}>Alignment gap detected</span>}
                    </div>
                  )) : (
                    <div className="p-4 rounded-xl" style={{ background: '#111113', border: '1px solid #1A1A1E' }}>
                      <p className="text-xs" style={{ color: '#555' }}>No active forces detected.</p>
                      <p className="text-[10px] mt-1" style={{ color: '#444', fontFamily: MONO }}>Click Synthesize to process connected data.</p>
                    </div>
                  )}
                </div>

                {/* Decision Pressure */}
                <div>
                  <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#555', fontFamily: MONO }}>
                    Decision Pressure
                  </h3>
                  <div className="p-4 rounded-xl" style={{ background: '#111113', border: '1px solid #1A1A1E' }}>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-3xl font-light" style={{ color: st.color, fontFamily: MONO }}>{dpi}</span>
                      <span className="text-[10px]" style={{ color: '#555', fontFamily: MONO }}>/100</span>
                    </div>
                    <div className="h-1 rounded-full" style={{ background: '#1A1A1E' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${dpi}%`, background: st.color }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* ═══ CENTER — Executive Briefing ═══ */}
              <div className="lg:col-span-6 space-y-6" data-testid="executive-briefing">
                <div>
                  <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#555', fontFamily: MONO }}>
                    Strategic Briefing
                  </h3>

                  {hasBrief ? (
                    <div className="space-y-4">
                      <div className="p-6 rounded-xl" style={{ background: '#111113', border: '1px solid #1A1A1E' }}>
                        <p className="text-base leading-relaxed" style={{ color: '#D4D4D8', fontWeight: 400 }}>
                          {typeof narrative === 'string' ? narrative : narrative.primary_tension}
                        </p>
                        {narrative.force_summary && (
                          <p className="text-sm mt-4 leading-relaxed" style={{ color: '#71717A' }}>
                            {narrative.force_summary}
                          </p>
                        )}
                      </div>

                      {narrative.strategic_direction && (
                        <div className="p-5 rounded-xl" style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)' }}>
                          <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#22C55E', fontFamily: MONO }}>
                            Recommended Direction
                          </span>
                          <p className="text-sm leading-relaxed" style={{ color: '#A1A1AA' }}>
                            {narrative.strategic_direction}
                          </p>
                        </div>
                      )}

                      {narrative.cost_of_silence && (
                        <div className="p-5 rounded-xl" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}>
                          <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#EF4444', fontFamily: MONO }}>
                            If Ignored
                          </span>
                          <p className="text-sm leading-relaxed" style={{ color: '#EF4444' }}>
                            {narrative.cost_of_silence}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 rounded-xl text-center" style={{ background: '#111113', border: '1px solid #1A1A1E' }}>
                      <p className="text-sm mb-2" style={{ color: '#71717A' }}>No intelligence briefing available yet.</p>
                      <p className="text-xs mb-6" style={{ color: '#555', fontFamily: MONO }}>
                        {sources.length > 0 ? `${sources.length} data sources connected. Click Synthesize to generate.` : 'Connect integrations to enable intelligence.'}
                      </p>
                      <button onClick={triggerSynthesis} disabled={synthesizing} className="text-xs px-5 py-2 rounded-lg transition-colors" style={{ color: '#D4D4D8', background: '#1A1A1E', border: '1px solid #27272A', fontFamily: HEAD }}>
                        {synthesizing ? 'Synthesizing...' : 'Generate Briefing'}
                      </button>
                    </div>
                  )}

                  {/* Drift Vectors */}
                  {drifts.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3 mt-6" style={{ color: '#555', fontFamily: MONO }}>
                        Drift Vectors
                      </h3>
                      <div className="space-y-2">
                        {drifts.map((d, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#111113', border: '1px solid #1A1A1E' }}>
                            <div>
                              <span className="text-xs font-medium" style={{ color: '#A1A1AA' }}>{d.domain}</span>
                              <span className="text-[10px] ml-2" style={{ color: '#555', fontFamily: MONO }}>{d.signal_count} signals</span>
                            </div>
                            <ChevronRight className="w-3 h-3" style={{ color: '#333' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ═══ RIGHT COLUMN — Signal Trace ═══ */}
              <div className="lg:col-span-3 space-y-6" data-testid="signal-trace">
                <div>
                  <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#555', fontFamily: MONO }}>
                    Signal Trace
                  </h3>
                  {signals.length > 0 ? signals.map((s, i) => (
                    <div key={i} className="mb-2 p-3 rounded-lg" style={{ background: '#111113', border: '1px solid #1A1A1E' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-medium" style={{ color: '#A1A1AA', fontFamily: MONO }}>{s.signal}</span>
                        <span className="text-[9px]" style={{ color: '#444', fontFamily: MONO }}>{Math.round((s.confidence || 0) * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px]" style={{ color: '#555', fontFamily: MONO }}>{s.source}</span>
                        <span className="text-[9px]" style={{ color: '#333' }}>|</span>
                        <span className="text-[9px]" style={{ color: '#555', fontFamily: MONO }}>{s.domain}</span>
                      </div>
                    </div>
                  )) : (
                    <div className="p-4 rounded-xl" style={{ background: '#111113', border: '1px solid #1A1A1E' }}>
                      <p className="text-[10px]" style={{ color: '#555', fontFamily: MONO }}>No signals traced yet.</p>
                    </div>
                  )}
                </div>

                {/* Data Sources */}
                {sources.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: '#555', fontFamily: MONO }}>
                      Data Sources
                    </h3>
                    {sources.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 mb-1.5">
                        <span className="w-1 h-1 rounded-full" style={{ background: '#22C55E' }} />
                        <span className="text-[10px]" style={{ color: '#555', fontFamily: MONO }}>{s}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const WarRoomConsole = () => (
  <ConsoleBoundary>
    <StrategicConsoleInner />
  </ConsoleBoundary>
);

export default WarRoomConsole;
