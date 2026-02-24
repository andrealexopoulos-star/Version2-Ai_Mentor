import React, { useState } from 'react';
import { supabase } from '../context/SupabaseAuthContext';
import { useSnapshot } from '../hooks/useSnapshot';
import { ChevronRight, ArrowLeft } from 'lucide-react';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const HEAD = "var(--font-heading)";
const MONO = "var(--font-mono)";

const STATE_CONFIG = {
  STABLE:      { label: 'Stable',      color: '#166534', bg: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E' },
  DRIFT:       { label: 'Drift',       color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B' },
  COMPRESSION: { label: 'Compression', color: '#9A3412', bg: '#FFF7ED', border: '#FED7AA', dot: '#F97316' },
  CRITICAL:    { label: 'Critical',    color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', dot: '#EF4444' },
};

const DIAGNOSIS_AREAS = [
  { id: 'cash_flow_financial_risk', label: 'Cash Flow & Financial Risk', icon: '$', color: '#16A34A', desc: 'Liquidity, payment obligations, and runway.' },
  { id: 'revenue_momentum', label: 'Revenue Momentum', icon: '\u2197', color: '#2563EB', desc: 'Sales velocity, pipeline health, close rates.' },
  { id: 'strategy_effectiveness', label: 'Strategy Effectiveness', icon: '\u25CE', color: '#7C3AED', desc: 'Whether direction is producing expected outcomes.' },
  { id: 'operations_delivery', label: 'Operations & Delivery', icon: '\u2699', color: '#D97706', desc: 'Execution quality, timelines, bottlenecks.' },
  { id: 'people_retention_capacity', label: 'People & Capacity', icon: '\u2693', color: '#DB2777', desc: 'Team stability, workload, delegation gaps.' },
  { id: 'customer_relationships', label: 'Customer Relationships', icon: '\u2764', color: '#DC2626', desc: 'Client satisfaction, retention signals, churn risk.' },
  { id: 'risk_compliance', label: 'Risk & Compliance', icon: '\u26A0', color: '#EA580C', desc: 'Regulatory, contractual, and legal exposure.' },
  { id: 'systems_technology', label: 'Systems & Technology', icon: '\u2699', color: '#4F46E5', desc: 'Technical debt, reliability, infrastructure limits.' },
  { id: 'market_position', label: 'Market Position', icon: '\u2691', color: '#0D9488', desc: 'Competitive landscape, positioning, opportunity decay.' },
];

const BoardRoom = () => {
  const [activeDiagnosis, setActiveDiagnosis] = useState(null);
  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagError, setDiagError] = useState(null);

  const { cognitive: snapshot, loading: briefingLoading } = useSnapshot();
  const narrative = snapshot ? { primary_tension: snapshot.executive_memo, force_summary: snapshot.system_state_interpretation, strategic_direction: snapshot.priority_compression?.primary_focus } : null;
  const st = STATE_CONFIG[snapshot?.system_state] || STATE_CONFIG.STABLE;
  const dpi = snapshot?.system_state === 'CRITICAL' ? 80 : snapshot?.system_state === 'COMPRESSION' ? 55 : snapshot?.system_state === 'DRIFT' ? 35 : 10;
  const forces = (snapshot?.inevitabilities || []).map(function(inv) { return { domain: inv.domain, detail: inv.signal, position: inv.intensity }; });
  const hasBrief = narrative && narrative.primary_tension;

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
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json', 'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY },
        body: JSON.stringify({ focus_area: area.id }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setDiagnosisResult(await res.json());
    } catch (e) {
      setDiagError(`Diagnosis unavailable. ${e.message === '404' ? 'Edge Function not deployed yet.' : 'Please try again.'}`);
    } finally { setDiagnosing(false); }
  };

  const closeDiagnosis = () => { setActiveDiagnosis(null); setDiagnosisResult(null); setDiagError(null); };
  const activeArea = DIAGNOSIS_AREAS.find(a => a.id === activeDiagnosis);

  return (
    <div className="flex flex-col h-full min-h-screen" style={{ background: 'linear-gradient(180deg, #F8F9FA 0%, #EFF1F3 40%, #E8EAED 100%)', fontFamily: HEAD }}>

      {/* ═══ HEADER — Liquid Silver ═══ */}
      <header className="flex items-center justify-between px-6 md:px-10 py-3.5 shrink-0" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-5">
          <a href="/advisor" className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-black/5" style={{ color: '#6B7280', textDecoration: 'none', fontFamily: HEAD }} data-testid="boardroom-home">
            ← Dashboard
          </a>
          <div className="h-4 w-px" style={{ background: '#E5E7EB' }} />
          <span className="text-sm font-semibold" style={{ color: '#111827' }}>Board Room</span>
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full" style={{ background: st.bg, border: `1px solid ${st.border}` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
            <span className="text-[10px] font-semibold tracking-wide" style={{ color: st.color, fontFamily: MONO }}>{st.label}</span>
          </div>
        </div>
        <span className="text-[11px] font-medium" style={{ color: '#9CA3AF', fontFamily: MONO }}>{new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </header>

      {/* ═══ PRESSURE BAR ═══ */}
      <div className="h-[2px] shrink-0" style={{ background: '#E5E7EB' }}>
        <div className="h-full transition-all duration-1000 rounded-r-full" style={{ width: `${dpi}%`, background: st.dot }} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 md:px-10 py-10 space-y-10">

          {/* ═══ EXECUTIVE BRIEFING ═══ */}
          {!activeDiagnosis && (
            <>
              <section data-testid="executive-zone">
                {briefingLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <span className="text-xs text-[#FF6A00]" style={{ fontFamily: "monospace" }}>loading...</span>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {hasBrief && (
                      <div className="p-7 rounded-2xl" style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                        <p className="text-[15px] leading-relaxed" style={{ color: '#1F2937' }}>
                          {typeof narrative === 'string' ? narrative : narrative.primary_tension}
                        </p>
                        {narrative.force_summary && (
                          <p className="text-sm mt-3 leading-relaxed" style={{ color: '#6B7280' }}>{narrative.force_summary}</p>
                        )}
                        {narrative.strategic_direction && (
                          <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                            <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#16A34A', fontFamily: MONO }}>Direction</span>
                            <p className="text-sm mt-1.5 leading-relaxed" style={{ color: '#374151' }}>{narrative.strategic_direction}</p>
                          </div>
                        )}
                      </div>
                    )}
                    {!hasBrief && (
                      <div className="p-7 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <p className="text-sm" style={{ color: '#9CA3AF' }}>Executive briefing will appear here once intelligence is generated.</p>
                      </div>
                    )}

                    {forces.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {forces.map((f, i) => (
                          <div key={i} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.05)' }}>
                            <span className="text-xs font-semibold" style={{ color: '#374151' }}>{f.domain}</span>
                            {f.detail && <p className="text-[11px] mt-1" style={{ color: '#9CA3AF', fontFamily: MONO }}>{f.detail}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* ═══ DIAGNOSIS CARDS ═══ */}
              <section data-testid="diagnosis-zone">
                <h2 className="text-[10px] font-semibold tracking-widest uppercase mb-5" style={{ color: '#9CA3AF', fontFamily: MONO }}>
                  Diagnosis — Select an area to analyse
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {DIAGNOSIS_AREAS.map((area) => (
                    <button
                      key={area.id}
                      onClick={() => runDiagnosis(area)}
                      className="text-left p-5 rounded-xl transition-all hover:shadow-md hover:-translate-y-0.5 group"
                      style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', border: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer' }}
                      data-testid={`diagnosis-${area.id}`}
                    >
                      <div className="flex items-center gap-3 mb-2.5">
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-medium" style={{ background: `${area.color}10`, color: area.color }}>{area.icon}</span>
                        <span className="text-sm font-semibold" style={{ color: '#1F2937' }}>{area.label}</span>
                      </div>
                      <p className="text-[12px] leading-relaxed" style={{ color: '#6B7280' }}>{area.desc}</p>
                      <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] font-medium" style={{ color: area.color }}>Run diagnosis</span>
                        <ChevronRight className="w-3 h-3" style={{ color: area.color }} />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ═══ DIAGNOSIS RESULT ═══ */}
          {activeDiagnosis && (
            <section data-testid="diagnosis-result">
              <button onClick={closeDiagnosis} className="flex items-center gap-2 text-xs font-medium mb-8 px-3 py-1.5 rounded-lg transition-colors hover:bg-black/5" style={{ color: '#6B7280' }}>
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Board Room
              </button>

              {diagnosing && (
                <div className="flex flex-col items-center justify-center py-24">
                  <span className="text-xs text-[#FF6A00]" style={{ fontFamily: "monospace" }}>loading...</span>
                  <p className="text-sm font-medium" style={{ color: '#374151' }}>Analysing {activeArea?.label}...</p>
                  <p className="text-[11px] mt-1.5" style={{ color: '#9CA3AF' }}>Reading your CRM, financials, and email signals</p>
                </div>
              )}

              {diagError && (
                <div className="p-8 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <p className="text-sm" style={{ color: '#D97706' }}>{diagError}</p>
                  <button onClick={() => runDiagnosis(activeArea)} className="text-xs font-medium mt-4 px-4 py-1.5 rounded-lg" style={{ color: '#6B7280', border: '1px solid #E5E7EB' }}>Retry</button>
                </div>
              )}

              {diagnosisResult && (
                <div className="space-y-5">
                  {/* Headline */}
                  <div className="p-8 rounded-2xl" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div className="flex items-center gap-3 mb-5">
                      {activeArea && <span className="w-10 h-10 rounded-xl flex items-center justify-center text-base" style={{ background: `${activeArea.color}10`, color: activeArea.color }}>{activeArea.icon}</span>}
                      <div>
                        <h2 className="text-lg font-semibold" style={{ color: '#111827' }}>{activeArea?.label}</h2>
                        {diagnosisResult.confidence && (
                          <span className="text-[10px] tracking-wider uppercase font-medium" style={{ color: '#9CA3AF', fontFamily: MONO }}>Confidence: {diagnosisResult.confidence}</span>
                        )}
                      </div>
                    </div>
                    <p className="text-lg leading-relaxed" style={{ color: '#1F2937', fontWeight: 500 }}>{diagnosisResult.headline}</p>
                  </div>

                  {/* Narrative */}
                  {diagnosisResult.narrative && (
                    <div className="p-8 rounded-2xl" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.05)' }}>
                      <p className="text-[15px] leading-loose whitespace-pre-line" style={{ color: '#374151' }}>{diagnosisResult.narrative}</p>
                    </div>
                  )}

                  {/* What to Watch */}
                  {diagnosisResult.what_to_watch && (
                    <div className="p-6 rounded-2xl" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                      <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#92400E', fontFamily: MONO }}>What to Watch</span>
                      <p className="text-sm leading-relaxed" style={{ color: '#78350F' }}>{diagnosisResult.what_to_watch}</p>
                    </div>
                  )}

                  {/* If Ignored */}
                  {diagnosisResult.if_ignored && (
                    <div className="p-6 rounded-2xl" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                      <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#991B1B', fontFamily: MONO }}>If Ignored</span>
                      <p className="text-sm leading-relaxed" style={{ color: '#7F1D1D' }}>{diagnosisResult.if_ignored}</p>
                    </div>
                  )}

                  {/* Sources */}
                  {diagnosisResult.data_sources_used?.length > 0 && (
                    <div className="flex items-center gap-3 pt-2">
                      <span className="text-[10px] font-medium" style={{ color: '#9CA3AF', fontFamily: MONO }}>Sources:</span>
                      {diagnosisResult.data_sources_used.map((s, i) => (
                        <span key={i} className="text-[10px] px-2.5 py-1 rounded-full font-medium" style={{ color: '#6B7280', background: 'rgba(0,0,0,0.04)', fontFamily: MONO }}>{s}</span>
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
