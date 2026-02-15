import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth, supabase } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { RefreshCw, Loader2 } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;

const AdvisorWatchtower = () => {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();

  const [mirror, setMirror] = useState(null);
  const [mirrorLoading, setMirrorLoading] = useState(true);
  const [snapshotRefreshing, setSnapshotRefreshing] = useState(false);

  useEffect(() => { fetchMirror(); }, []);

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

  // Resolution status derivation
  const resolveStatus = (score) => {
    if (score === null || score === undefined) return null;
    if (score >= 0.9 || score >= 90) return 'OPTIMIZED';
    if (score >= 0.5 || score >= 50) return 'DRIFT';
    return 'DECAY';
  };
  const status = resolveStatus(resolutionScore);

  // Calibrated style label from persona
  const styleLabel = persona?.decision_style || persona?.style || null;

  // Zero-Noise Policy: if OPTIMIZED, feed is minimal
  const isOptimized = status === 'OPTIMIZED';

  // Extract signal classes from memo if structured
  const signals = memo?.signals || [];
  const hasMemo = memo && (memo.primary_tension || memo.force_summary || signals.length > 0);

  return (
    <DashboardLayout>
      <div className="space-y-0">

        {/* ─── STATUS HEADER ─── */}
        <div className="flex items-center justify-between px-1 py-3" data-testid="status-header">
          <div className="flex items-center gap-3">
            {status && (
              <span className={`text-[11px] font-mono font-bold tracking-[0.25em] ${
                status === 'OPTIMIZED' ? 'text-emerald-400' :
                status === 'DRIFT' ? 'text-amber-400' :
                'text-red-400'
              }`} data-testid="resolution-label">{status}</span>
            )}
            {resolutionScore != null && (
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                Resolution {typeof resolutionScore === 'number' && resolutionScore < 1 ? (resolutionScore * 100).toFixed(0) : resolutionScore}
              </span>
            )}
          </div>
          <button
            onClick={refreshSnapshot}
            disabled={snapshotRefreshing}
            className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded border transition-colors"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border-light)' }}
            data-testid="recalculate-btn"
          >
            <RefreshCw className={`w-3 h-3 ${snapshotRefreshing ? 'animate-spin' : ''}`} />
            Recalculate
          </button>
        </div>

        {/* ─── LOADING ─── */}
        {mirrorLoading && (
          <div className="flex items-center justify-center py-20" data-testid="mirror-loading">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        )}

        {!mirrorLoading && (
          <>
            {/* ─── EXECUTIVE MIRROR ─── */}
            {calibrated && (persona || factLedger) && (
              <div className="border-t" style={{ borderColor: 'var(--border-light)' }} data-testid="executive-mirror">
                {/* Master Agent Declaration */}
                <div className="px-5 py-4">
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    I am operating as your Master Agent
                    {styleLabel && <> under a <span className="font-bold">{styleLabel}</span> lens</>}.
                    {persona?.risk_posture && <> Risk posture: <span className="font-bold">{persona.risk_posture}</span>.</>}
                  </p>
                  {persona?.bluntness && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Communication: {persona.bluntness} bluntness.
                    </p>
                  )}
                  {persona?.summary && (
                    <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{persona.summary}</p>
                  )}
                  {/* Generic persona fields fallback */}
                  {!persona?.decision_style && !persona?.summary && persona && typeof persona === 'object' && (
                    <div className="space-y-1 mt-2">
                      {Object.entries(persona).filter(([, v]) => v && typeof v === 'string').map(([k, v]) => (
                        <p key={k} className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          <span className="text-[10px] font-mono uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{k.replace(/_/g, ' ')}: </span>{v}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fact Ledger — Strategic Truths */}
                {factLedger && typeof factLedger === 'object' && Object.keys(factLedger).length > 0 && (
                  <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border-light)' }} data-testid="fact-ledger">
                    <p className="text-[10px] font-mono uppercase tracking-[0.15em] mb-3" style={{ color: 'var(--text-muted)' }}>Fact ledger</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                      {Object.entries(factLedger).map(([key, val]) => {
                        const v = typeof val === 'object' ? (val.value || JSON.stringify(val)) : String(val);
                        return (
                          <div key={key} className="flex items-baseline gap-2">
                            <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
                              {key.replace(/\./g, ' > ')}
                            </span>
                            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{v}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── INTELLIGENCE FEED ─── */}
            <div className="border-t" style={{ borderColor: 'var(--border-light)' }} data-testid="intelligence-feed">
              <div className="px-5 py-4">
                <p className="text-[10px] font-mono uppercase tracking-[0.15em] mb-4" style={{ color: 'var(--text-muted)' }}>
                  Intelligence feed
                </p>

                {/* Zero-Noise: OPTIMIZED state */}
                {isOptimized && !hasMemo && (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    All signals resolved. No drift detected.
                  </p>
                )}

                {/* Force Memo — rendered as Signal Template */}
                {hasMemo && (
                  <div className="space-y-5">
                    {/* Structured memo: STATUS → SIGNAL → COST → FORESIGHT */}
                    {memo.primary_tension && (
                      <div className="space-y-2" data-testid="force-signal">
                        {/* THE SIGNAL */}
                        <div>
                          <p className="text-[10px] font-mono uppercase tracking-[0.15em] mb-1" style={{ color: 'var(--text-muted)' }}>The signal</p>
                          <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text-primary)' }}>{memo.primary_tension}</p>
                        </div>

                        {/* Force Summary */}
                        {memo.force_summary && (
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{memo.force_summary}</p>
                        )}

                        {/* COST OF SILENCE */}
                        {(memo.risk_quantification || memo.cost_of_silence) && (
                          <div>
                            <p className="text-[10px] font-mono uppercase tracking-[0.15em] mb-1" style={{ color: 'var(--text-muted)' }}>Cost of silence</p>
                            <p className="text-sm font-medium leading-relaxed" style={{ color: '#ef4444' }}>
                              {memo.risk_quantification || memo.cost_of_silence}
                            </p>
                          </div>
                        )}

                        {/* FORESIGHT */}
                        {(memo.drift_projection || memo.foresight) && (
                          <div>
                            <p className="text-[10px] font-mono uppercase tracking-[0.15em] mb-1" style={{ color: 'var(--text-muted)' }}>Foresight</p>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                              {memo.drift_projection || memo.foresight}
                            </p>
                          </div>
                        )}

                        {/* Strategic Direction */}
                        {memo.strategic_direction && (
                          <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text-primary)' }}>{memo.strategic_direction}</p>
                        )}
                      </div>
                    )}

                    {/* Structured signals array (if Edge Function returns signal_class hierarchy) */}
                    {signals.length > 0 && signals.map((sig, i) => (
                      <div key={i} className="border-t pt-4" style={{ borderColor: 'var(--border-light)' }} data-testid={`signal-${i}`}>
                        {sig.signal_class && (
                          <span className="text-[10px] font-mono uppercase tracking-[0.2em] px-2 py-0.5 rounded" style={{
                            color: sig.signal_class === 'Revenue' ? '#f59e0b' : sig.signal_class === 'Capital' ? '#ef4444' : '#8b5cf6',
                            background: sig.signal_class === 'Revenue' ? 'rgba(245,158,11,0.1)' : sig.signal_class === 'Capital' ? 'rgba(239,68,68,0.1)' : 'rgba(139,92,246,0.1)',
                          }}>{sig.signal_class}</span>
                        )}
                        {sig.tension && (
                          <p className="text-sm font-medium mt-2 leading-relaxed" style={{ color: 'var(--text-primary)' }}>{sig.tension}</p>
                        )}
                        {sig.cost_of_silence && (
                          <p className="text-sm mt-1" style={{ color: '#ef4444' }}>{sig.cost_of_silence}</p>
                        )}
                        {sig.foresight && (
                          <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{sig.foresight}</p>
                        )}
                      </div>
                    ))}

                    {/* Render any additional unstructured memo fields */}
                    {Object.entries(memo)
                      .filter(([k]) => !['primary_tension','force_summary','drift_projection','risk_quantification','cost_of_silence','foresight','strategic_direction','platform_guidance','signals','signal_class'].includes(k))
                      .filter(([, v]) => v && typeof v === 'string')
                      .map(([key, val]) => (
                        <p key={key} className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{val}</p>
                      ))
                    }
                  </div>
                )}

                {/* No memo — pending state */}
                {!hasMemo && !isOptimized && calibrated && (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Intelligence snapshot pending. Recalculate to generate Force Memo.
                  </p>
                )}

                {/* Not calibrated */}
                {!calibrated && !mirrorLoading && (
                  <div className="text-center py-8">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Calibration required to activate Intelligence Feed.</p>
                    <button
                      onClick={() => navigate('/calibration')}
                      className="mt-3 text-xs font-mono uppercase tracking-wider px-4 py-2 rounded border transition-colors"
                      style={{ color: 'var(--text-primary)', borderColor: 'var(--border-medium)' }}
                    >
                      Begin Calibration
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdvisorWatchtower;
