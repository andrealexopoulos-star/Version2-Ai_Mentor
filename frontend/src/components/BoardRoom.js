import React, { useState, useEffect } from 'react';
import { supabase } from '../context/SupabaseAuthContext';
import { useSWR } from '../hooks/useSWR';
import { RefreshCw, ChevronRight, ArrowLeft } from 'lucide-react';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const HEAD = "'Inter Tight', 'Inter', -apple-system, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', monospace";

const STATE_CONFIG = {
  STABLE:      { label: 'STABLE',      color: '#22C55E', bg: 'rgba(34,197,94,0.04)' },
  DRIFT:       { label: 'DRIFT',       color: '#F59E0B', bg: 'rgba(245,158,11,0.04)' },
  COMPRESSION: { label: 'COMPRESSION', color: '#F97316', bg: 'rgba(249,115,22,0.04)' },
  CRITICAL:    { label: 'CRITICAL',    color: '#EF4444', bg: 'rgba(239,68,68,0.05)' },
};

const DIAGNOSIS_AREAS = [
  { id: 'cash_flow_financial_risk', label: 'Cash Flow & Financial Risk', icon: '$', color: '#22C55E', desc: 'Liquidity, payment obligations, and runway.' },
  { id: 'revenue_momentum', label: 'Revenue Momentum', icon: '\u2197', color: '#3B82F6', desc: 'Sales velocity, pipeline health, close rates.' },
  { id: 'strategy_effectiveness', label: 'Strategy Effectiveness', icon: '\u25CE', color: '#8B5CF6', desc: 'Whether direction is producing expected outcomes.' },
  { id: 'operations_delivery', label: 'Operations & Delivery', icon: '\u2699', color: '#F59E0B', desc: 'Execution quality, timelines, bottlenecks.' },
  { id: 'people_retention_capacity', label: 'People & Capacity', icon: '\u2693', color: '#EC4899', desc: 'Team stability, workload, delegation gaps.' },
  { id: 'customer_relationships', label: 'Customer Relationships', icon: '\u2764', color: '#EF4444', desc: 'Client satisfaction, retention signals, churn risk.' },
  { id: 'risk_compliance', label: 'Risk & Compliance', icon: '\u26A0', color: '#F97316', desc: 'Regulatory, contractual, and legal exposure.' },
  { id: 'systems_technology', label: 'Systems & Technology', icon: '\u2699', color: '#6366F1', desc: 'Technical debt, reliability, infrastructure limits.' },
  { id: 'market_position', label: 'Market Position', icon: '\u2691', color: '#14B8A6', desc: 'Competitive landscape, positioning, opportunity decay.' },
];

const BoardRoom = () => {
  const [activeDiagnosis, setActiveDiagnosis] = useState(null);
  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagError, setDiagError] = useState(null);

  const { data: briefing, isLoading: briefingLoading } = useSWR('/strategic-console/briefing', {
    revalidateOnFocus: true, dedupingInterval: 15000,
  });

  const st = STATE_CONFIG[briefing?.system_state] || STATE_CONFIG.STABLE;
  const dpi = briefing?.decision_pressure_index || 0;
  const narrative = briefing?.executive_narrative;
  const forces = briefing?.compression || [];
  const hasBrief = narrative && (narrative.primary_tension || typeof narrative === 'string');

  const runDiagnosis = async (area) => {
    setActiveDiagnosis(area.id);
    setDiagnosisResult(null);
    setDiagError(null);
    setDiagnosing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/boardroom-diagnosis`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ focus_area: area.id }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setDiagnosisResult(data);
    } catch (e) {
      setDiagError(`Diagnosis unavailable. ${e.message === '404' ? 'Edge Function not deployed yet.' : 'Please try again.'}`);
    } finally {
      setDiagnosing(false);
    }
  };

  const closeDiagnosis = () => {
    setActiveDiagnosis(null);
    setDiagnosisResult(null);
    setDiagError(null);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#09090B', color: '#E4E4E7', fontFamily: HEAD }}>

      {/* ═══ HEADER ═══ */}
      <header className="flex items-center justify-between px-5 md:px-8 py-3 shrink-0" style={{ borderBottom: '1px solid #1A1A1E' }}>
        <div className="flex items-center gap-4">
          <a href="/advisor" className="text-xs px-2.5 py-1 rounded" style={{ color: '#555', border: '1px solid #222', fontFamily: MONO, textDecoration: 'none' }} data-testid="boardroom-home">
            ← Dashboard
          </a>
          <span className="text-sm font-medium tracking-wide" style={{ color: '#A1A1AA' }}>Board Room</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: st.color, boxShadow: `0 0 8px ${st.color}40` }} />
            <span className="text-[10px] font-semibold tracking-widest" style={{ color: st.color, fontFamily: MONO }}>{st.label}</span>
          </div>
        </div>
        <span className="text-[10px]" style={{ color: '#444', fontFamily: MONO }}>{new Date().toISOString().slice(0, 10)}</span>
      </header>

      {/* ═══ PRESSURE BAR ═══ */}
      <div className="h-[3px] shrink-0" style={{ background: '#111' }}>
        <div className="h-full transition-all duration-1000" style={{ width: `${dpi}%`, background: st.color }} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 space-y-10">

          {/* ═══ EXECUTIVE BRIEFING (Top Zone) ═══ */}
          {!activeDiagnosis && (
            <>
              <section data-testid="executive-zone">
                {briefingLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-5 h-5 border border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Narrative */}
                    {hasBrief && (
                      <div className="p-6 rounded-2xl" style={{ background: '#111113', border: '1px solid #1A1A1E' }}>
                        <p className="text-base leading-relaxed" style={{ color: '#D4D4D8' }}>
                          {typeof narrative === 'string' ? narrative : narrative.primary_tension}
                        </p>
                        {narrative.force_summary && (
                          <p className="text-sm mt-3 leading-relaxed" style={{ color: '#71717A' }}>{narrative.force_summary}</p>
                        )}
                        {narrative.strategic_direction && (
                          <div className="mt-4 pt-4" style={{ borderTop: '1px solid #1A1A1E' }}>
                            <span className="text-[10px] tracking-widest uppercase" style={{ color: '#22C55E', fontFamily: MONO }}>Direction</span>
                            <p className="text-sm mt-1 leading-relaxed" style={{ color: '#A1A1AA' }}>{narrative.strategic_direction}</p>
                          </div>
                        )}
                      </div>
                    )}
                    {!hasBrief && (
                      <div className="p-6 rounded-2xl text-center" style={{ background: '#111113', border: '1px solid #1A1A1E' }}>
                        <p className="text-sm" style={{ color: '#71717A' }}>Executive briefing will appear here once intelligence is generated.</p>
                      </div>
                    )}

                    {/* Forces */}
                    {forces.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {forces.map((f, i) => (
                          <div key={i} className="p-4 rounded-xl" style={{ background: '#111113', border: '1px solid #1A1A1E' }}>
                            <span className="text-xs font-medium" style={{ color: '#D4D4D8' }}>{f.domain}</span>
                            {f.detail && <p className="text-[11px] mt-1" style={{ color: '#71717A', fontFamily: MONO }}>{f.detail}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* ═══ DIAGNOSIS CARDS (Bottom Zone) ═══ */}
              <section data-testid="diagnosis-zone">
                <h2 className="text-[10px] font-semibold tracking-widest uppercase mb-5" style={{ color: '#555', fontFamily: MONO }}>
                  Diagnosis — Select an area to analyse
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {DIAGNOSIS_AREAS.map((area) => (
                    <button
                      key={area.id}
                      onClick={() => runDiagnosis(area)}
                      className="text-left p-5 rounded-xl transition-all hover:scale-[1.01]"
                      style={{ background: '#111113', border: '1px solid #1A1A1E', cursor: 'pointer' }}
                      data-testid={`diagnosis-${area.id}`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: `${area.color}15`, color: area.color }}>{area.icon}</span>
                        <span className="text-sm font-medium" style={{ color: '#D4D4D8' }}>{area.label}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed" style={{ color: '#71717A' }}>{area.desc}</p>
                      <div className="flex items-center gap-1 mt-3">
                        <span className="text-[10px]" style={{ color: '#555', fontFamily: MONO }}>Run diagnosis</span>
                        <ChevronRight className="w-3 h-3" style={{ color: '#555' }} />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ═══ DIAGNOSIS RESULT VIEW ═══ */}
          {activeDiagnosis && (
            <section data-testid="diagnosis-result">
              <button onClick={closeDiagnosis} className="flex items-center gap-2 text-xs mb-6 px-3 py-1.5 rounded" style={{ color: '#888', border: '1px solid #222', fontFamily: MONO }}>
                <ArrowLeft className="w-3 h-3" /> Back to Board Room
              </button>

              {diagnosing && (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-6 h-6 border border-zinc-700 border-t-zinc-400 rounded-full animate-spin mb-4" />
                  <p className="text-sm" style={{ color: '#71717A' }}>
                    Analysing {DIAGNOSIS_AREAS.find(a => a.id === activeDiagnosis)?.label}...
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: '#555', fontFamily: MONO }}>Reading CRM, financials, and email signals</p>
                </div>
              )}

              {diagError && (
                <div className="p-6 rounded-2xl text-center" style={{ background: '#111113', border: '1px solid #1A1A1E' }}>
                  <p className="text-sm" style={{ color: '#F59E0B' }}>{diagError}</p>
                  <button onClick={() => runDiagnosis(DIAGNOSIS_AREAS.find(a => a.id === activeDiagnosis))} className="text-xs mt-4 px-4 py-1.5 rounded" style={{ color: '#888', border: '1px solid #333', fontFamily: MONO }}>Retry</button>
                </div>
              )}

              {diagnosisResult && (
                <div className="space-y-6">
                  {/* Headline */}
                  <div className="p-7 rounded-2xl" style={{ background: '#111113', border: '1px solid #1A1A1E' }}>
                    <div className="flex items-center gap-3 mb-4">
                      {(() => { const area = DIAGNOSIS_AREAS.find(a => a.id === activeDiagnosis); return area ? (
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: `${area.color}15`, color: area.color }}>{area.icon}</span>
                      ) : null; })()}
                      <div>
                        <h2 className="text-lg font-medium" style={{ color: '#E4E4E7' }}>
                          {DIAGNOSIS_AREAS.find(a => a.id === activeDiagnosis)?.label}
                        </h2>
                        {diagnosisResult.confidence && (
                          <span className="text-[10px] tracking-wider uppercase" style={{ color: '#888', fontFamily: MONO }}>
                            Confidence: {diagnosisResult.confidence}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-lg leading-relaxed font-medium" style={{ color: '#D4D4D8' }}>
                      {diagnosisResult.headline}
                    </p>
                  </div>

                  {/* Narrative */}
                  {diagnosisResult.narrative && (
                    <div className="p-7 rounded-2xl" style={{ background: '#111113', border: '1px solid #1A1A1E' }}>
                      <p className="text-sm leading-loose whitespace-pre-line" style={{ color: '#A1A1AA' }}>
                        {diagnosisResult.narrative}
                      </p>
                    </div>
                  )}

                  {/* What to Watch */}
                  {diagnosisResult.what_to_watch && (
                    <div className="p-5 rounded-2xl" style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)' }}>
                      <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#F59E0B', fontFamily: MONO }}>What to Watch</span>
                      <p className="text-sm leading-relaxed" style={{ color: '#D4D4D8' }}>{diagnosisResult.what_to_watch}</p>
                    </div>
                  )}

                  {/* If Ignored */}
                  {diagnosisResult.if_ignored && (
                    <div className="p-5 rounded-2xl" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}>
                      <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#EF4444', fontFamily: MONO }}>If Ignored</span>
                      <p className="text-sm leading-relaxed" style={{ color: '#FECACA' }}>{diagnosisResult.if_ignored}</p>
                    </div>
                  )}

                  {/* Data Sources */}
                  {diagnosisResult.data_sources_used?.length > 0 && (
                    <div className="flex items-center gap-3 pt-2">
                      <span className="text-[10px]" style={{ color: '#555', fontFamily: MONO }}>Sources:</span>
                      {diagnosisResult.data_sources_used.map((s, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded" style={{ color: '#888', background: '#1A1A1E', fontFamily: MONO }}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

        </div>
      </div>
    </div>
  );
};

export default BoardRoom;
