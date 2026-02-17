import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth, supabase } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { useSWR } from '../hooks/useSWR';
import { TrendingUp, Shield, Activity, RefreshCw, Loader2 } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { PageSkeleton } from '../components/ui/skeleton-loader';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;

/* ── Pulse Class Config (Agnostic) ── */
const PULSE_CLASS = {
  Revenue: { label: 'Growth Momentum', icon: TrendingUp, accent: '#1a1a1a' },
  Capital: { label: 'Financial Resilience', icon: Shield, accent: '#8B4513' },
  Human:   { label: 'Leadership Cadence', icon: Activity, accent: '#2D3748' },
};

const AdvisorWatchtower = () => {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();

  const [snapshotRefreshing, setSnapshotRefreshing] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);

  // SWR: Stale-While-Revalidate — serves cached data instantly, revalidates in background
  const { data: mirror, isLoading: mirrorLoading, mutate: mutateMirror } = useSWR('/executive-mirror', {
    revalidateOnFocus: true,
    dedupingInterval: 10000,
  });

  useEffect(() => {
    if (!mirrorLoading) return;
    const interval = setInterval(() => setLoadingPhase(p => (p + 1) % 3), 2800);
    return () => clearInterval(interval);
  }, [mirrorLoading]);

  // Extract first name — never show raw email
  const extractName = (raw) => {
    if (!raw) return '';
    if (raw.includes('@')) {
      const namePart = raw.split('@')[0].split(/[._-]/)[0];
      return namePart.charAt(0).toUpperCase() + namePart.slice(1);
    }
    return raw.split(' ')[0];
  };
  const firstName = extractName(user?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || '');

  const LOADING_PHASES = [
    `${firstName ? firstName + ', finalizing' : 'Finalizing'} your Executive Brief...`,
    'Synthesizing Revenue Velocity and Capital Signals...',
    'Mapping Leadership Cadence across your connected platforms...',
  ];

  const refreshSnapshot = async () => {
    setSnapshotRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await fetch(`${SUPABASE_URL}/functions/v1/intelligence-snapshot`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({}),
      });
      // SWR: trigger background revalidation
      mutateMirror();
    } catch (err) {
      console.warn('[advisor] refresh failed:', err.message);
    } finally {
      setSnapshotRefreshing(false);
    }
  };

  const persona = mirror?.agent_persona;
  const factLedger = mirror?.fact_ledger;
  const memo = mirror?.executive_memo;
  const resolutionScore = mirror?.resolution_status;
  const calibrated = mirror?.calibration_status === 'complete';

  const resolveStatus = (score) => {
    if (score === null || score === undefined) return null;
    const n = typeof score === 'number' && score <= 1 ? score * 100 : score;
    if (n >= 90) return 'STRONG';
    if (n >= 50) return 'ATTENTION';
    return 'URGENT';
  };
  const status = resolveStatus(resolutionScore);
  const hasMemo = memo && (memo.primary_tension || memo.force_summary || (memo.signals && memo.signals.length > 0));
  const signals = memo?.signals || [];

  // Translate persona into partner language
  const partnerIntro = () => {
    if (!persona) return null;
    const style = persona.decision_style || persona.style;
    const risk = persona.risk_posture;
    if (!style && !risk && !persona.summary) return null;

    const parts = [];
    if (firstName) parts.push(`${firstName}, `);
    else parts.push('');

    if (style && risk) {
      parts.push(`based on our calibration, you operate with a ${style.toLowerCase()} approach and show ${risk.toLowerCase()}. `);
    } else if (style) {
      parts.push(`your operating style is ${style.toLowerCase()}. `);
    }

    parts.push('I will frame every insight through this lens — protecting your growth and surfacing what needs your attention.');
    return parts.join('');
  };

  const statusLabel = status === 'STRONG' ? 'Position Strong' : status === 'ATTENTION' ? 'Attention Required' : status === 'URGENT' ? 'Requires Immediate Focus' : null;
  const statusColor = status === 'STRONG' ? '#2D6A4F' : status === 'ATTENTION' ? '#92400E' : status === 'URGENT' ? '#991B1B' : '#6B7280';

  return (
    <DashboardLayout>
      {/* ── GILDED ADVISOR CONTAINER ── */}
      <div className="min-h-[calc(100vh-64px)]" style={{ background: '#FBFBF9' }}>

        {/* ── LOADING ── */}
        {mirrorLoading && (
          <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8" data-testid="advisor-loading">
            <PageSkeleton cards={3} lines={5} />
          </div>
        )}

        {!mirrorLoading && (
          <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 space-y-8">

            {/* ── STATUS ── */}
            <div className="flex items-center justify-between" data-testid="status-header">
              {statusLabel && (
                <span className="text-xs font-medium tracking-wide uppercase" style={{ color: statusColor, letterSpacing: '0.1em' }}>
                  {statusLabel}
                </span>
              )}
              {!statusLabel && <span />}
              <button
                onClick={refreshSnapshot}
                disabled={snapshotRefreshing}
                className="flex items-center gap-1.5 text-xs tracking-wide px-3 py-1.5 rounded-full transition-colors"
                style={{ color: '#6B7280', border: '1px solid #E8E6E1' }}
                data-testid="refresh-btn"
              >
                <RefreshCw className={`w-3 h-3 ${snapshotRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {/* ── YOUR ADVISOR ── */}
            {calibrated && (persona || factLedger) && (
              <div data-testid="executive-mirror">
                {/* Partner Greeting */}
                <div className="mb-8">
                  <h1 className="text-3xl sm:text-4xl leading-tight mb-4"
                    style={{ fontFamily: "'Playfair Display', serif", color: '#1a1a1a', fontWeight: 600 }}>
                    {firstName ? `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${firstName}.` : 'Your Advisory Brief'}
                  </h1>
                  {partnerIntro() && (
                    <p className="text-base leading-relaxed" style={{ color: '#4A4A4A', maxWidth: 600 }}>
                      {partnerIntro()}
                    </p>
                  )}
                  {persona?.summary && !partnerIntro() && (
                    <p className="text-base leading-relaxed" style={{ color: '#4A4A4A', maxWidth: 600 }}>
                      {persona.summary}
                    </p>
                  )}
                </div>

                {/* Pulse Baselines — Strategic DNA */}
                {factLedger && typeof factLedger === 'object' && Object.keys(factLedger).length > 0 && (
                  <div className="rounded-xl px-6 py-5 mb-8" data-testid="pulse-baselines"
                    style={{ background: '#FFFFFF', border: '1px solid #E8E6E1' }}>
                    <h3 className="text-sm font-medium uppercase tracking-wider mb-4" style={{ color: '#9CA3AF', letterSpacing: '0.15em' }}>
                      Your Pulse Baselines
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3">
                      {Object.entries(factLedger).map(([key, val]) => {
                        const v = typeof val === 'object' ? (val.value || JSON.stringify(val)) : String(val);
                        const label = key.replace(/\./g, ' \u203A ').replace(/^./, c => c.toUpperCase());
                        return (
                          <div key={key} className="flex flex-col">
                            <span className="text-[11px] uppercase tracking-wider" style={{ color: '#9CA3AF', letterSpacing: '0.1em' }}>{label}</span>
                            <span className="text-sm font-medium mt-0.5" style={{ color: '#1a1a1a' }}>{v}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── YOUR BUSINESS PULSE ── */}
            <div data-testid="business-pulse">
              <h2 className="text-2xl mb-5" style={{ fontFamily: "'Playfair Display', serif", color: '#1a1a1a', fontWeight: 600 }}>
                Your Business Pulse
              </h2>

              {/* Force Memo — rendered as advisory narrative */}
              {hasMemo && (
                <div className="space-y-6">
                  {memo.primary_tension && (
                    <div className="rounded-xl px-6 py-5" style={{ background: '#FFFFFF', border: '1px solid #E8E6E1' }}>
                      <p className="text-base leading-relaxed" style={{ color: '#1a1a1a' }}>
                        {memo.primary_tension}
                      </p>
                      {memo.force_summary && (
                        <p className="text-sm leading-relaxed mt-3" style={{ color: '#6B7280' }}>
                          {memo.force_summary}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Cost of inaction — elegant but urgent */}
                  {(memo.risk_quantification || memo.cost_of_silence) && (
                    <div className="rounded-xl px-6 py-5" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                      <h4 className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#991B1B', letterSpacing: '0.12em' }}>
                        Cost of waiting
                      </h4>
                      <p className="text-base font-semibold leading-relaxed" style={{ color: '#7F1D1D' }}>
                        {memo.risk_quantification || memo.cost_of_silence}
                      </p>
                    </div>
                  )}

                  {/* Foresight */}
                  {(memo.drift_projection || memo.foresight) && (
                    <div className="rounded-xl px-6 py-5" style={{ background: '#FFFFFF', border: '1px solid #E8E6E1' }}>
                      <h4 className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#9CA3AF', letterSpacing: '0.12em' }}>
                        Looking ahead
                      </h4>
                      <p className="text-sm leading-relaxed" style={{ color: '#4A4A4A' }}>
                        {memo.drift_projection || memo.foresight}
                      </p>
                    </div>
                  )}

                  {memo.strategic_direction && (
                    <div className="rounded-xl px-6 py-5" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                      <h4 className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#166534', letterSpacing: '0.12em' }}>
                        Recommended direction
                      </h4>
                      <p className="text-base leading-relaxed" style={{ color: '#14532D' }}>
                        {memo.strategic_direction}
                      </p>
                    </div>
                  )}

                  {/* Structured pulse items */}
                  {signals.length > 0 && signals.map((sig, i) => {
                    const cls = PULSE_CLASS[sig.signal_class] || {};
                    const Icon = cls.icon || TrendingUp;
                    return (
                      <div key={i} className="rounded-xl px-6 py-5" data-testid={`pulse-${i}`}
                        style={{ background: '#FFFFFF', border: '1px solid #E8E6E1' }}>
                        {sig.signal_class && (
                          <div className="flex items-center gap-2 mb-3">
                            <Icon className="w-4 h-4" style={{ color: cls.accent || '#4A4A4A' }} />
                            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#9CA3AF', letterSpacing: '0.1em' }}>
                              {cls.label || sig.signal_class}
                            </span>
                          </div>
                        )}
                        {sig.tension && <p className="text-base leading-relaxed" style={{ color: '#1a1a1a' }}>{sig.tension}</p>}
                        {sig.cost_of_silence && (
                          <p className="text-sm font-semibold mt-2" style={{ color: '#991B1B' }}>{sig.cost_of_silence}</p>
                        )}
                        {sig.foresight && <p className="text-sm mt-2 leading-relaxed" style={{ color: '#6B7280' }}>{sig.foresight}</p>}
                      </div>
                    );
                  })}

                  {/* Unstructured memo fields */}
                  {Object.entries(memo)
                    .filter(([k]) => !['primary_tension','force_summary','drift_projection','risk_quantification','cost_of_silence','foresight','strategic_direction','platform_guidance','signals','signal_class'].includes(k))
                    .filter(([, v]) => v && typeof v === 'string')
                    .map(([key, val]) => (
                      <p key={key} className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>{val}</p>
                    ))
                  }
                </div>
              )}

              {/* Pending */}
              {!hasMemo && calibrated && status !== 'STRONG' && (
                <div className="rounded-xl px-6 py-8 text-center" style={{ background: '#FFFFFF', border: '1px solid #E8E6E1' }}>
                  <p className="text-base leading-relaxed" style={{ color: '#6B7280', fontFamily: "'Playfair Display', serif" }}>
                    {firstName ? `${firstName}, your` : 'Your'} advisory brief is being prepared.
                  </p>
                  <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>
                    Click Refresh to generate your first Business Pulse.
                  </p>
                </div>
              )}

              {/* Not calibrated */}
              {!calibrated && !mirrorLoading && (
                <div className="rounded-xl px-6 py-10 text-center" style={{ background: '#FFFFFF', border: '1px solid #E8E6E1' }}>
                  <p className="text-lg leading-relaxed mb-4" style={{ color: '#1a1a1a', fontFamily: "'Playfair Display', serif" }}>
                    Before I can advise you, I need to understand how you think.
                  </p>
                  <button
                    onClick={() => navigate('/calibration')}
                    className="text-sm font-medium px-6 py-2.5 rounded-full transition-colors"
                    style={{ color: '#FFFFFF', background: '#1a1a1a' }}
                  >
                    Begin Calibration
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdvisorWatchtower;
