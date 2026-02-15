import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth, supabase } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { TrendingUp, Shield, Activity, RefreshCw, Loader2 } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;

/* ── Signal Class Config ── */
const SIGNAL_CLASS = {
  Revenue: { label: 'Revenue Velocity', icon: TrendingUp, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
  Capital: { label: 'Capital Runway', icon: Shield, color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
  Human:   { label: 'Human Velocity', icon: Activity, color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
};

/* ── Status Colors ── */
const STATUS_STYLE = {
  OPTIMIZED: { color: '#10B981', glow: 'none' },
  DRIFT:     { color: '#F59E0B', glow: 'none' },
  DECAY:     { color: '#EF4444', glow: '0 0 20px rgba(239,68,68,0.3)' },
};

const AdvisorWatchtower = () => {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();

  const [mirror, setMirror] = useState(null);
  const [mirrorLoading, setMirrorLoading] = useState(true);
  const [snapshotRefreshing, setSnapshotRefreshing] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);

  useEffect(() => { fetchMirror(); }, []);

  // Loading phase animation
  useEffect(() => {
    if (!mirrorLoading) return;
    const interval = setInterval(() => setLoadingPhase(p => (p + 1) % 4), 2200);
    return () => clearInterval(interval);
  }, [mirrorLoading]);

  const LOADING_PHASES = [
    'Establishing secure connection to Intelligence Engine...',
    'Analyzing signal history across connected platforms...',
    'Calibrating Strategic DNA against live behavioral data...',
    'Rendering Cognitive Output...',
  ];

  const fetchMirror = async () => {
    setMirrorLoading(true);
    try {
      const res = await apiClient.get('/executive-mirror');
      setMirror(res.data);
    } catch (err) {
      console.error('[mirror] Failed:', err);
    } finally {
      setMirrorLoading(false);
    }
  };

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
      await fetchMirror();
    } catch (err) {
      console.warn('[snapshot] refresh failed:', err.message);
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
    if (n >= 90) return 'OPTIMIZED';
    if (n >= 50) return 'DRIFT';
    return 'DECAY';
  };
  const status = resolveStatus(resolutionScore);
  const statusStyle = status ? STATUS_STYLE[status] : null;
  const styleLabel = persona?.decision_style || persona?.style || null;
  const isOptimized = status === 'OPTIMIZED';
  const hasMemo = memo && (memo.primary_tension || memo.force_summary || (memo.signals && memo.signals.length > 0));
  const signals = memo?.signals || [];

  return (
    <DashboardLayout>
      {/* ── SENTINEL CONTAINER ── */}
      <div className="min-h-[calc(100vh-64px)]" style={{ background: '#080C14' }}>

        {/* ── LOADING: Anti-Black-Box Protocol ── */}
        {mirrorLoading && (
          <div className="flex flex-col items-center justify-center py-32 px-4" data-testid="mirror-loading">
            <div className="w-8 h-8 border-2 rounded-full animate-spin mb-6"
              style={{ borderColor: 'rgba(248,250,252,0.1)', borderTopColor: '#10B981' }} />
            <p className="text-sm font-mono tracking-wide text-center transition-opacity duration-700"
              style={{ color: '#F8FAFC' }}>
              {LOADING_PHASES[loadingPhase]}
            </p>
            <div className="flex gap-1.5 mt-4">
              {LOADING_PHASES.map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
                  style={{ background: i === loadingPhase ? '#10B981' : 'rgba(248,250,252,0.15)' }} />
              ))}
            </div>
          </div>
        )}

        {!mirrorLoading && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-0">

            {/* ── STATUS HEADER ── */}
            <div className="flex items-center justify-between py-3" data-testid="status-header">
              <div className="flex items-center gap-4">
                {status && (
                  <span className="text-xs font-mono font-bold tracking-[0.25em]"
                    style={{ color: statusStyle?.color, textShadow: statusStyle?.glow }}
                    data-testid="resolution-label">
                    {status}
                  </span>
                )}
                {resolutionScore != null && (
                  <span className="text-[10px] font-mono" style={{ color: 'rgba(248,250,252,0.35)' }}>
                    Resolution {typeof resolutionScore === 'number' && resolutionScore <= 1 ? (resolutionScore * 100).toFixed(0) : resolutionScore}
                  </span>
                )}
              </div>
              <button
                onClick={refreshSnapshot}
                disabled={snapshotRefreshing}
                className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em] px-3 py-1.5 rounded transition-colors"
                style={{ color: 'rgba(248,250,252,0.4)', border: '1px solid rgba(248,250,252,0.08)' }}
                data-testid="recalculate-btn"
              >
                <RefreshCw className={`w-3 h-3 ${snapshotRefreshing ? 'animate-spin' : ''}`} />
                Recalculate
              </button>
            </div>

            {/* ── EXECUTIVE MIRROR ── */}
            {calibrated && (persona || factLedger) && (
              <div className="rounded-xl overflow-hidden" data-testid="executive-mirror"
                style={{ background: '#0F172A', border: '1px solid rgba(248,250,252,0.06)' }}>

                {/* Master Agent Declaration */}
                <div className="px-6 py-5">
                  <p className="text-sm leading-relaxed" style={{ color: '#F8FAFC' }}>
                    I am operating as your Master Agent
                    {styleLabel && <> under a <span className="font-bold">{styleLabel}</span> lens</>}.
                    {persona?.risk_posture && <> Risk posture: <span className="font-bold">{persona.risk_posture}</span>.</>}
                  </p>
                  {persona?.bluntness && (
                    <p className="text-[11px] font-mono mt-1.5" style={{ color: 'rgba(248,250,252,0.35)' }}>
                      Communication: {persona.bluntness} bluntness
                    </p>
                  )}
                  {persona?.summary && (
                    <p className="text-sm mt-3 leading-relaxed" style={{ color: 'rgba(248,250,252,0.6)' }}>{persona.summary}</p>
                  )}
                  {!persona?.decision_style && !persona?.summary && persona && typeof persona === 'object' && (
                    <div className="space-y-1 mt-2">
                      {Object.entries(persona).filter(([, v]) => v && typeof v === 'string').map(([k, v]) => (
                        <p key={k} className="text-sm" style={{ color: 'rgba(248,250,252,0.6)' }}>
                          <span className="text-[10px] font-mono uppercase tracking-[0.1em]" style={{ color: 'rgba(248,250,252,0.3)' }}>{k.replace(/_/g, ' ')}: </span>{v}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fact Ledger — Strategic DNA */}
                {factLedger && typeof factLedger === 'object' && Object.keys(factLedger).length > 0 && (
                  <div className="px-6 py-4" style={{ borderTop: '1px solid rgba(248,250,252,0.04)' }} data-testid="fact-ledger">
                    <p className="text-[10px] font-mono uppercase tracking-[0.2em] mb-3" style={{ color: 'rgba(248,250,252,0.25)' }}>
                      Strategic DNA
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                      {Object.entries(factLedger).map(([key, val]) => {
                        const v = typeof val === 'object' ? (val.value || JSON.stringify(val)) : String(val);
                        return (
                          <div key={key} className="flex items-baseline gap-2">
                            <span className="text-[10px] font-mono shrink-0" style={{ color: 'rgba(248,250,252,0.25)' }}>
                              {key.replace(/\./g, ' > ')}
                            </span>
                            <span className="text-sm" style={{ color: '#F8FAFC' }}>{v}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── INTELLIGENCE FEED ── */}
            <div className="rounded-xl overflow-hidden mt-4" data-testid="intelligence-feed"
              style={{ background: '#0F172A', border: '1px solid rgba(248,250,252,0.06)' }}>
              <div className="px-6 py-5">
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] mb-5" style={{ color: 'rgba(248,250,252,0.25)' }}>
                  Intelligence feed
                </p>

                {/* OPTIMIZED: Zero-Noise */}
                {isOptimized && !hasMemo && (
                  <p className="text-sm" style={{ color: 'rgba(248,250,252,0.5)' }}>
                    All signals resolved. No drift detected.
                  </p>
                )}

                {/* Force Memo — Signal Template */}
                {hasMemo && (
                  <div className="space-y-6">
                    {memo.primary_tension && (
                      <div className="space-y-4">
                        {/* THE SIGNAL */}
                        <div>
                          <p className="text-[10px] font-mono uppercase tracking-[0.2em] mb-1.5" style={{ color: 'rgba(248,250,252,0.25)' }}>The signal</p>
                          <p className="text-sm font-medium leading-relaxed" style={{ color: '#F8FAFC' }}>{memo.primary_tension}</p>
                        </div>

                        {memo.force_summary && (
                          <p className="text-sm leading-relaxed" style={{ color: 'rgba(248,250,252,0.6)' }}>{memo.force_summary}</p>
                        )}

                        {/* COST OF SILENCE — High contrast Crimson */}
                        {(memo.risk_quantification || memo.cost_of_silence) && (
                          <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', boxShadow: '0 0 24px rgba(239,68,68,0.1)' }}>
                            <p className="text-[10px] font-mono uppercase tracking-[0.2em] mb-1" style={{ color: 'rgba(239,68,68,0.6)' }}>Cost of silence</p>
                            <p className="text-sm font-bold leading-relaxed" style={{ color: '#EF4444' }}>
                              {memo.risk_quantification || memo.cost_of_silence}
                            </p>
                          </div>
                        )}

                        {/* FORESIGHT */}
                        {(memo.drift_projection || memo.foresight) && (
                          <div>
                            <p className="text-[10px] font-mono uppercase tracking-[0.2em] mb-1.5" style={{ color: 'rgba(248,250,252,0.25)' }}>Foresight</p>
                            <p className="text-sm leading-relaxed" style={{ color: 'rgba(248,250,252,0.6)' }}>
                              {memo.drift_projection || memo.foresight}
                            </p>
                          </div>
                        )}

                        {memo.strategic_direction && (
                          <p className="text-sm font-medium leading-relaxed" style={{ color: '#F8FAFC' }}>{memo.strategic_direction}</p>
                        )}
                      </div>
                    )}

                    {/* Structured Signal Array — Signal Class hierarchy */}
                    {signals.length > 0 && signals.map((sig, i) => {
                      const cls = SIGNAL_CLASS[sig.signal_class] || {};
                      const Icon = cls.icon || TrendingUp;
                      return (
                        <div key={i} className="rounded-lg px-5 py-4" data-testid={`signal-${i}`}
                          style={{ background: cls.bg || 'rgba(248,250,252,0.03)', border: `1px solid ${cls.color || 'rgba(248,250,252,0.06)'}20` }}>
                          {sig.signal_class && (
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className="w-3.5 h-3.5" style={{ color: cls.color }} />
                              <span className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: cls.color }}>{cls.label || sig.signal_class}</span>
                            </div>
                          )}
                          {sig.tension && <p className="text-sm font-medium leading-relaxed mb-1" style={{ color: '#F8FAFC' }}>{sig.tension}</p>}
                          {sig.cost_of_silence && (
                            <p className="text-sm font-bold mt-2" style={{ color: '#EF4444', textShadow: '0 0 12px rgba(239,68,68,0.2)' }}>{sig.cost_of_silence}</p>
                          )}
                          {sig.foresight && <p className="text-sm mt-1 leading-relaxed" style={{ color: 'rgba(248,250,252,0.5)' }}>{sig.foresight}</p>}
                        </div>
                      );
                    })}

                    {/* Unstructured memo fields */}
                    {Object.entries(memo)
                      .filter(([k]) => !['primary_tension','force_summary','drift_projection','risk_quantification','cost_of_silence','foresight','strategic_direction','platform_guidance','signals','signal_class'].includes(k))
                      .filter(([, v]) => v && typeof v === 'string')
                      .map(([key, val]) => (
                        <p key={key} className="text-sm leading-relaxed" style={{ color: 'rgba(248,250,252,0.5)' }}>{val}</p>
                      ))
                    }
                  </div>
                )}

                {/* Pending state */}
                {!hasMemo && !isOptimized && calibrated && (
                  <p className="text-sm" style={{ color: 'rgba(248,250,252,0.35)' }}>
                    Intelligence snapshot pending. Recalculate to generate Force Memo.
                  </p>
                )}

                {/* Not calibrated */}
                {!calibrated && !mirrorLoading && (
                  <div className="text-center py-8">
                    <p className="text-sm" style={{ color: 'rgba(248,250,252,0.35)' }}>Calibration required to activate Intelligence Feed.</p>
                    <button
                      onClick={() => navigate('/calibration')}
                      className="mt-3 text-[10px] font-mono uppercase tracking-[0.15em] px-4 py-2 rounded transition-colors"
                      style={{ color: '#F8FAFC', border: '1px solid rgba(248,250,252,0.15)' }}
                    >
                      Begin Calibration
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdvisorWatchtower;
