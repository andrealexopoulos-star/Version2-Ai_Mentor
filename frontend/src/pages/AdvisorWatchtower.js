import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth, supabase } from '../context/SupabaseAuthContext';
import { useSWR } from '../hooks/useSWR';
import { RefreshCw, ArrowRight, ChevronRight } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { PageSkeleton } from '../components/ui/skeleton-loader';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;

const HEAD = "'Inter Tight', 'Inter', -apple-system, sans-serif";
const SERIF = "'Playfair Display', Georgia, serif";

const STATUS_MAP = {
  STRONG:    { label: 'Stable',   color: '#166534', bg: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E' },
  ATTENTION: { label: 'Elevated', color: '#92400E', bg: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B' },
  URGENT:    { label: 'Critical', color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', dot: '#EF4444' },
};

const AdvisorWatchtower = () => {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const { data: mirror, isLoading, mutate } = useSWR('/executive-mirror', {
    revalidateOnFocus: true,
    dedupingInterval: 10000,
  });

  const firstName = (() => {
    const raw = user?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || '';
    if (!raw) return '';
    if (raw.includes('@')) return raw.split('@')[0].split(/[._-]/)[0].replace(/^./, c => c.toUpperCase());
    return raw.split(' ')[0];
  })();

  const greeting = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening';

  const refresh = async () => {
    setRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch(`${SUPABASE_URL}/functions/v1/intelligence-snapshot`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json', 'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY },
          body: '{}',
        });
      }
      mutate();
    } catch {} finally { setRefreshing(false); }
  };

  const calibrated = mirror?.calibration_status === 'complete';
  const memo = mirror?.executive_memo;
  const persona = mirror?.agent_persona;
  const factLedger = mirror?.fact_ledger;
  const score = mirror?.resolution_status;
  const signals = memo?.signals || [];
  const hasMemo = memo && (memo.primary_tension || memo.force_summary || signals.length > 0);

  const resolveStatus = (s) => {
    if (s === null || s === undefined) return null;
    const n = typeof s === 'number' && s <= 1 ? s * 100 : s;
    if (n >= 90) return 'STRONG';
    if (n >= 50) return 'ATTENTION';
    return 'URGENT';
  };
  const status = resolveStatus(score);
  const st = STATUS_MAP[status] || null;

  return (
    <DashboardLayout>
      <div className="min-h-[calc(100vh-56px)]" style={{ background: '#FAFAF8' }} data-testid="biqc-insights-page">

        {/* ═══ INTELLIGENCE STATUS BAR ═══ */}
        {st && !isLoading && (
          <div className="sticky top-14 z-30" style={{ borderBottom: `1px solid ${st.border}`, background: st.bg }} data-testid="intelligence-status-bar">
            <div className="max-w-3xl mx-auto px-6 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full" style={{ background: st.dot }} />
                <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: st.color, fontFamily: HEAD, letterSpacing: '0.15em' }}>
                  {st.label}
                </span>
              </div>
              <span className="text-[11px] tracking-wide" style={{ color: st.color, opacity: 0.7, fontFamily: HEAD }}>
                Intelligence {status === 'STRONG' ? 'nominal' : status === 'ATTENTION' ? 'monitoring' : 'active'}
              </span>
            </div>
          </div>
        )}

        {/* ═══ LOADING ═══ */}
        {isLoading && (
          <div className="max-w-3xl mx-auto px-6 py-12" data-testid="advisor-loading">
            <PageSkeleton cards={2} lines={4} />
          </div>
        )}

        {!isLoading && (
          <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">

            {/* ═══ EXECUTIVE GREETING ═══ */}
            <div data-testid="executive-greeting">
              <div className="flex items-start justify-between mb-1">
                <h1 className="text-3xl sm:text-4xl leading-tight" style={{ fontFamily: SERIF, color: '#111', fontWeight: 600 }}>
                  {firstName ? `Good ${greeting}, ${firstName}.` : 'Your Executive Brief'}
                </h1>
                <button onClick={refresh} disabled={refreshing} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all mt-2"
                  style={{ color: '#9CA3AF', border: '1px solid #E5E5E0', fontFamily: HEAD }}
                  data-testid="refresh-btn">
                  <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
              {calibrated && persona?.summary && (
                <p className="text-base leading-relaxed mt-4" style={{ color: '#555', maxWidth: 560, fontFamily: HEAD, fontWeight: 400 }}>
                  {persona.summary}
                </p>
              )}
            </div>

            {/* ═══ PRIORITY COMPRESSION ═══ */}
            {/* 1-3 compressed signals. Generous whitespace. Executive typography. */}
            {calibrated && hasMemo && (
              <section data-testid="priority-compression">
                <h2 className="text-[11px] font-semibold tracking-widest uppercase mb-6" style={{ color: '#9CA3AF', letterSpacing: '0.2em', fontFamily: HEAD }}>
                  Priority Compression
                </h2>

                {memo.primary_tension && (
                  <div className="rounded-2xl px-7 py-6 mb-4" style={{ background: '#FFF', border: '1px solid #E8E6E1' }} data-testid="primary-tension">
                    <p className="text-lg leading-relaxed" style={{ color: '#111', fontFamily: HEAD, fontWeight: 500 }}>
                      {memo.primary_tension}
                    </p>
                    {memo.force_summary && (
                      <p className="text-sm leading-relaxed mt-3" style={{ color: '#777', fontFamily: HEAD }}>
                        {memo.force_summary}
                      </p>
                    )}
                  </div>
                )}

                {/* Compressed signal cards — max 3 */}
                <div className="space-y-3">
                  {signals.slice(0, 3).map((sig, i) => (
                    <div key={i} className="rounded-2xl px-7 py-5" style={{ background: '#FFF', border: '1px solid #E8E6E1' }} data-testid={`signal-${i}`}>
                      {sig.signal_class && (
                        <span className="text-[10px] font-semibold tracking-widest uppercase mb-2 block" style={{ color: '#B0B0A8', letterSpacing: '0.15em', fontFamily: HEAD }}>
                          {sig.signal_class === 'Revenue' ? 'Growth Momentum' : sig.signal_class === 'Capital' ? 'Financial Resilience' : sig.signal_class === 'Human' ? 'Leadership Cadence' : sig.signal_class}
                        </span>
                      )}
                      {sig.tension && <p className="text-base leading-relaxed" style={{ color: '#222', fontFamily: HEAD }}>{sig.tension}</p>}
                      {sig.cost_of_silence && (
                        <p className="text-sm font-medium mt-2" style={{ color: '#991B1B', fontFamily: HEAD }}>{sig.cost_of_silence}</p>
                      )}
                      {sig.foresight && <p className="text-sm mt-2 leading-relaxed" style={{ color: '#888', fontFamily: HEAD }}>{sig.foresight}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ═══ OPPORTUNITY DECAY ═══ */}
            {calibrated && (memo?.risk_quantification || memo?.cost_of_silence || memo?.drift_projection) && (
              <section data-testid="opportunity-decay">
                <h2 className="text-[11px] font-semibold tracking-widest uppercase mb-6" style={{ color: '#9CA3AF', letterSpacing: '0.2em', fontFamily: HEAD }}>
                  Opportunity Monitor
                </h2>
                <div className="space-y-3">
                  {(memo.risk_quantification || memo.cost_of_silence) && (
                    <div className="rounded-2xl px-7 py-5" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }} data-testid="cost-of-waiting">
                      <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#991B1B', letterSpacing: '0.12em', fontFamily: HEAD }}>
                        Cost of Waiting
                      </span>
                      <p className="text-base font-medium leading-relaxed" style={{ color: '#7F1D1D', fontFamily: HEAD }}>
                        {memo.risk_quantification || memo.cost_of_silence}
                      </p>
                    </div>
                  )}
                  {memo.drift_projection && (
                    <div className="rounded-2xl px-7 py-5" style={{ background: '#FFF', border: '1px solid #E8E6E1' }} data-testid="drift-projection">
                      <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{ color: '#B0B0A8', letterSpacing: '0.12em', fontFamily: HEAD }}>
                        Drift Projection
                      </span>
                      <p className="text-sm leading-relaxed" style={{ color: '#555', fontFamily: HEAD }}>{memo.drift_projection}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ═══ EXECUTIVE MEMO ═══ */}
            {calibrated && memo?.strategic_direction && (
              <section data-testid="executive-memo">
                <h2 className="text-[11px] font-semibold tracking-widest uppercase mb-6" style={{ color: '#9CA3AF', letterSpacing: '0.2em', fontFamily: HEAD }}>
                  Strategic Memo
                </h2>
                <div className="rounded-2xl px-8 py-7" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <p className="text-base leading-loose" style={{ color: '#14532D', fontFamily: HEAD, fontWeight: 450 }}>
                    {memo.strategic_direction}
                  </p>
                </div>
              </section>
            )}

            {/* ═══ PULSE BASELINES (from Fact Ledger) ═══ */}
            {calibrated && factLedger && typeof factLedger === 'object' && Object.keys(factLedger).length > 0 && (
              <section data-testid="pulse-baselines">
                <h2 className="text-[11px] font-semibold tracking-widest uppercase mb-6" style={{ color: '#9CA3AF', letterSpacing: '0.2em', fontFamily: HEAD }}>
                  Your Baselines
                </h2>
                <div className="rounded-2xl px-7 py-5" style={{ background: '#FFF', border: '1px solid #E8E6E1' }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4">
                    {Object.entries(factLedger).slice(0, 12).map(([key, val]) => {
                      const v = typeof val === 'object' ? (val.value || JSON.stringify(val)) : String(val);
                      const label = key.replace(/\./g, ' \u203A ').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
                      return (
                        <div key={key} className="flex flex-col">
                          <span className="text-[10px] uppercase tracking-widest" style={{ color: '#B0B0A8', letterSpacing: '0.1em', fontFamily: HEAD }}>{label}</span>
                          <span className="text-sm font-medium mt-0.5" style={{ color: '#222', fontFamily: HEAD }}>{v}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* ═══ AWAITING BRIEF ═══ */}
            {calibrated && !hasMemo && (
              <div className="rounded-2xl px-8 py-12 text-center" style={{ background: '#FFF', border: '1px solid #E8E6E1' }} data-testid="awaiting-brief">
                <p className="text-xl leading-relaxed mb-2" style={{ color: '#333', fontFamily: SERIF, fontWeight: 500 }}>
                  {firstName ? `${firstName}, your` : 'Your'} executive brief is being prepared.
                </p>
                <p className="text-sm" style={{ color: '#999', fontFamily: HEAD }}>
                  Connect an integration or click Refresh to generate your first intelligence brief.
                </p>
              </div>
            )}

            {/* ═══ NOT CALIBRATED ═══ */}
            {!calibrated && (
              <div className="rounded-2xl px-8 py-14 text-center" style={{ background: '#FFF', border: '1px solid #E8E6E1' }} data-testid="calibration-required">
                <p className="text-2xl leading-relaxed mb-3" style={{ color: '#111', fontFamily: SERIF, fontWeight: 500 }}>
                  Before I can advise, I need to understand how you operate.
                </p>
                <p className="text-sm mb-8" style={{ color: '#888', fontFamily: HEAD }}>
                  Calibration takes 5 minutes. It shapes every insight I generate for you.
                </p>
                <button onClick={() => navigate('/calibration')}
                  className="text-sm font-medium px-8 py-3 rounded-full transition-all hover:shadow-lg"
                  style={{ color: '#FFF', background: '#111', fontFamily: HEAD }}
                  data-testid="begin-calibration-btn">
                  Begin Calibration <ArrowRight className="w-4 h-4 ml-1 inline" />
                </button>
              </div>
            )}

            {/* ═══ QUICK NAV ═══ */}
            {calibrated && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="quick-nav">
                {[
                  { label: 'Strategic Console', path: '/war-room', desc: 'Full calibration' },
                  { label: 'Business DNA', path: '/business-profile', desc: 'Your profile' },
                  { label: 'Integrations', path: '/integrations', desc: 'Connect tools' },
                ].map(item => (
                  <button key={item.path} onClick={() => navigate(item.path)}
                    className="flex items-center justify-between px-5 py-4 rounded-xl text-left transition-all hover:shadow-sm"
                    style={{ background: '#FFF', border: '1px solid #E8E6E1', fontFamily: HEAD }}>
                    <div>
                      <span className="text-sm font-medium block" style={{ color: '#222' }}>{item.label}</span>
                      <span className="text-[11px]" style={{ color: '#AAA' }}>{item.desc}</span>
                    </div>
                    <ChevronRight className="w-4 h-4" style={{ color: '#CCC' }} />
                  </button>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdvisorWatchtower;
