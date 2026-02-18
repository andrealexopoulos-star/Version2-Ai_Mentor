import React, { useState, useEffect } from 'react';
import { supabase } from '../context/SupabaseAuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { RefreshCw } from 'lucide-react';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const HEAD = "'Inter Tight', 'Inter', -apple-system, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', monospace";

const STATE_CFG = {
  STABLE:      { label: 'Stable',      color: '#166534', bg: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E' },
  DRIFT:       { label: 'Drift',       color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B' },
  COMPRESSION: { label: 'Compression', color: '#9A3412', bg: '#FFF7ED', border: '#FED7AA', dot: '#F97316' },
  CRITICAL:    { label: 'Critical',    color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', dot: '#EF4444' },
};

const INTENSITY_CFG = {
  forming:      { color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  accelerating: { color: '#F97316', bg: '#FFF7ED', border: '#FED7AA' },
  imminent:     { color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
};

const AdvisorWatchtower = () => {
  const [cognitive, setCognitive] = useState(null);
  const [sources, setSources] = useState([]);
  const [owner, setOwner] = useState('');
  const [timeOfDay, setTimeOfDay] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadCognitive = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/biqc-insights-cognitive`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json', 'apikey': ANON_KEY },
        body: '{}',
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setCognitive(data.cognitive);
      setSources(data.data_sources || []);
      setOwner(data.owner || '');
      setTimeOfDay(data.time_of_day || '');
    } catch (e) {
      setError(e.message === '404' ? 'Deploy the biqc-insights-cognitive Edge Function.' : 'Cognitive system unavailable. Please retry.');
    } finally { setLoading(false); }
  };

  const refresh = async () => { setRefreshing(true); await loadCognitive(); setRefreshing(false); };

  useEffect(() => { loadCognitive(); }, []);

  const c = cognitive || {};
  const st = STATE_CFG[c.system_state] || STATE_CFG.STABLE;
  const inevitabilities = c.inevitabilities || [];
  const pc = c.priority_compression || {};
  const od = c.opportunity_decay || {};

  return (
    <DashboardLayout>
      <div className="min-h-[calc(100vh-56px)]" style={{ background: '#FAFAF8', fontFamily: HEAD }} data-testid="biqc-insights-page">

        {/* Status Bar */}
        {!loading && cognitive && (
          <div className="sticky top-14 z-30" style={{ background: st.bg, borderBottom: `1px solid ${st.border}` }}>
            <div className="max-w-4xl mx-auto px-6 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full" style={{ background: st.dot }} />
                <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: st.color, fontFamily: MONO }}>{st.label}</span>
                <span className="text-[11px]" style={{ color: st.color, opacity: 0.7 }}>{c.system_state_interpretation}</span>
              </div>
              <button onClick={refresh} disabled={refreshing} className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg hover:bg-black/5" style={{ color: '#9CA3AF' }} data-testid="refresh-btn">
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin mb-5" />
            <p className="text-sm font-medium" style={{ color: '#374151' }}>Cognitive system initialising...</p>
            <p className="text-[11px] mt-1" style={{ color: '#9CA3AF' }}>Perceiving signals across all connected systems</p>
          </div>
        )}

        {error && !loading && (
          <div className="max-w-3xl mx-auto px-6 py-16 text-center">
            <p className="text-sm" style={{ color: '#D97706' }}>{error}</p>
            <button onClick={loadCognitive} className="text-xs font-medium mt-4 px-4 py-1.5 rounded-lg" style={{ color: '#6B7280', border: '1px solid #E5E7EB' }}>Retry</button>
          </div>
        )}

        {cognitive && !loading && (
          <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

            {/* Greeting */}
            <h1 className="text-3xl font-semibold" style={{ color: '#111827', fontFamily: "'Playfair Display', Georgia, serif" }}>
              Good {timeOfDay}, {owner}.
            </h1>

            {/* ═══ INEVITABILITIES ═══ */}
            {inevitabilities.length > 0 && (
              <section data-testid="inevitabilities">
                <h2 className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#9CA3AF', fontFamily: MONO }}>
                  Active Inevitabilities
                </h2>
                <div className="space-y-3">
                  {inevitabilities.map((inv, i) => {
                    const ic = INTENSITY_CFG[inv.intensity] || INTENSITY_CFG.forming;
                    return (
                      <div key={i} className="p-6 rounded-2xl" style={{ background: ic.bg, border: `1px solid ${ic.border}` }} data-testid={`inevitability-${i}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: ic.color, fontFamily: MONO }}>{inv.domain}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: ic.color, background: `${ic.color}10`, fontFamily: MONO }}>{inv.intensity}</span>
                          </div>
                          {inv.intervention_window && (
                            <span className="text-[10px] font-medium" style={{ color: ic.color, fontFamily: MONO }}>Window: {inv.intervention_window}</span>
                          )}
                        </div>
                        <p className="text-[15px] leading-relaxed font-medium" style={{ color: '#1F2937' }}>{inv.signal}</p>
                        {inv.if_ignored && (
                          <p className="text-sm mt-2 leading-relaxed" style={{ color: '#7F1D1D' }}>If ignored: {inv.if_ignored}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ═══ PRIORITY COMPRESSION ═══ */}
            {(pc.primary_focus || pc.secondary_focus) && (
              <section data-testid="priority-compression">
                <h2 className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#9CA3AF', fontFamily: MONO }}>
                  Priority Compression
                </h2>
                <div className="p-7 rounded-2xl" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  {pc.primary_focus && (
                    <div className="mb-4">
                      <span className="text-[10px] font-semibold tracking-widest uppercase block mb-1" style={{ color: '#111827', fontFamily: MONO }}>Primary</span>
                      <p className="text-[15px] leading-relaxed font-medium" style={{ color: '#1F2937' }}>{pc.primary_focus}</p>
                    </div>
                  )}
                  {pc.secondary_focus && (
                    <div className="mb-4 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                      <span className="text-[10px] font-semibold tracking-widest uppercase block mb-1" style={{ color: '#6B7280', fontFamily: MONO }}>Secondary</span>
                      <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{pc.secondary_focus}</p>
                    </div>
                  )}
                  {pc.noise_to_ignore && (
                    <div className="pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                      <span className="text-[10px] font-semibold tracking-widest uppercase block mb-1" style={{ color: '#9CA3AF', fontFamily: MONO }}>Noise</span>
                      <p className="text-sm leading-relaxed" style={{ color: '#9CA3AF' }}>{pc.noise_to_ignore}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ═══ OPPORTUNITY DECAY ═══ */}
            {od.decaying && (
              <section data-testid="opportunity-decay">
                <h2 className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#9CA3AF', fontFamily: MONO }}>
                  Opportunity Decay
                </h2>
                <div className="p-6 rounded-2xl" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <p className="text-[15px] leading-relaxed font-medium" style={{ color: '#7F1D1D' }}>{od.decaying}</p>
                  {od.velocity && <p className="text-sm mt-2" style={{ color: '#991B1B', fontFamily: MONO }}>Decay rate: {od.velocity}</p>}
                  {od.recovery_action && <p className="text-sm mt-2 leading-relaxed" style={{ color: '#374151' }}>{od.recovery_action}</p>}
                </div>
              </section>
            )}

            {/* ═══ EXECUTIVE MEMO ═══ */}
            {c.executive_memo && (
              <section data-testid="executive-memo">
                <h2 className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#9CA3AF', fontFamily: MONO }}>
                  Executive Memo
                </h2>
                <div className="p-8 rounded-2xl" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <p className="text-[15px] leading-loose whitespace-pre-line" style={{ color: '#1F2937' }}>{c.executive_memo}</p>
                </div>
              </section>
            )}

            {/* ═══ STRATEGIC ALIGNMENT ═══ */}
            {c.strategic_alignment_check && (
              <section data-testid="alignment-check">
                <h2 className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#9CA3AF', fontFamily: MONO }}>
                  Strategic Alignment
                </h2>
                <div className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.05)' }}>
                  <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{c.strategic_alignment_check}</p>
                </div>
              </section>
            )}

            {/* ═══ MARKET POSITION ═══ */}
            {c.market_position && (
              <section data-testid="market-position">
                <h2 className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color: '#9CA3AF', fontFamily: MONO }}>
                  Market Position
                </h2>
                <div className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.04)' }}>
                  <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{c.market_position}</p>
                </div>
              </section>
            )}

            {/* ═══ DATA SOURCES ═══ */}
            {sources.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <span className="text-[10px] font-medium" style={{ color: '#9CA3AF', fontFamily: MONO }}>Perception sources:</span>
                {sources.map((s, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: '#6B7280', background: 'rgba(0,0,0,0.04)', fontFamily: MONO }}>{s}</span>
                ))}
                <span className="text-[10px]" style={{ color: '#D1D5DB', fontFamily: MONO }}>{c.data_freshness}</span>
              </div>
            )}

          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdvisorWatchtower;
