import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth, supabase } from '../context/SupabaseAuthContext';
import { Button } from '../components/ui/button';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { RefreshCw, Loader2, Eye, AlertCircle, ArrowRight } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import WatchtowerEvent from '../components/WatchtowerEvent';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;

const AdvisorWatchtower = () => {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();

  const [mirror, setMirror] = useState(null);
  const [mirrorLoading, setMirrorLoading] = useState(true);
  const [watchtowerEvents, setWatchtowerEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [snapshotRefreshing, setSnapshotRefreshing] = useState(false);

  // Fetch Executive Mirror + Watchtower Events on mount
  useEffect(() => {
    fetchMirror();
    fetchWatchtowerEvents();
  }, []);

  /** Read cognitive outputs from /api/executive-mirror */
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

  /** Trigger intelligence-snapshot Edge Function to refresh memo */
  const refreshSnapshot = async () => {
    setSnapshotRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/intelligence-snapshot`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        // Re-fetch mirror to get updated executive_memo
        await fetchMirror();
        toast.success('Intelligence snapshot refreshed');
      }
    } catch (err) {
      console.warn('[snapshot] refresh failed:', err.message);
    } finally {
      setSnapshotRefreshing(false);
    }
  };

  /** Fetch watchtower events */
  const fetchWatchtowerEvents = async () => {
    setLoadingEvents(true);
    try {
      const res = await apiClient.get('/intelligence/watchtower?status=active');
      setWatchtowerEvents(res.data?.events || []);
    } catch {
      console.error('[watchtower] Failed to fetch events');
    } finally {
      setLoadingEvents(false);
    }
  };

  /** Run cold read analysis */
  const runColdRead = async () => {
    setRunningAnalysis(true);
    toast.loading('Running analysis...', { id: 'cold-read' });
    try {
      const res = await apiClient.post('/intelligence/cold-read', {});
      const result = res.data?.cold_read;
      if (result?.events_created > 0) {
        toast.success(`${result.events_created} signal${result.events_created > 1 ? 's' : ''} detected`, { id: 'cold-read' });
      } else {
        toast.success('Baseline initialized. Monitoring active domains.', { id: 'cold-read' });
      }
      await fetchWatchtowerEvents();
      await fetchMirror();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Analysis failed', { id: 'cold-read' });
    } finally {
      setRunningAnalysis(false);
    }
  };

  const handleEventAction = async (eventId) => {
    try {
      await apiClient.patch(`/intelligence/watchtower/${eventId}/handle`);
      toast.success('Event handled');
      await fetchWatchtowerEvents();
    } catch {
      toast.error('Failed to update event');
    }
  };

  // Derive resolution status
  const persona = mirror?.agent_persona;
  const factLedger = mirror?.fact_ledger;
  const memo = mirror?.executive_memo;
  const resolutionScore = mirror?.resolution_status;

  const statusLabel = resolutionScore >= 80 ? 'OPTIMIZED' : resolutionScore >= 50 ? 'DRIFT' : resolutionScore > 0 ? 'DECAY' : null;
  const statusColor = statusLabel === 'OPTIMIZED' ? 'text-emerald-400' : statusLabel === 'DRIFT' ? 'text-amber-400' : statusLabel === 'DECAY' ? 'text-red-400' : 'text-white/40';

  // Group events by domain
  const eventsByDomain = watchtowerEvents.reduce((acc, event) => {
    const domain = event.domain || 'other';
    if (!acc[domain]) acc[domain] = [];
    acc[domain].push(event);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ─── STATUS HEADER ─── */}
        {statusLabel && (
          <div className="flex items-center gap-3 px-1" data-testid="resolution-status">
            <div className={`text-xs font-mono font-bold tracking-[0.2em] ${statusColor}`}>{statusLabel}</div>
            {resolutionScore > 0 && (
              <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                Resolution: {resolutionScore}
              </div>
            )}
          </div>
        )}

        {/* ─── EXECUTIVE MIRROR: Strategic DNA ─── */}
        {mirrorLoading ? (
          <div className="flex items-center justify-center py-12" data-testid="mirror-loading">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : mirror && (persona || factLedger) ? (
          <div className="rounded-xl border" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-card)' }} data-testid="executive-mirror">
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Executive Mirror</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Your strategic DNA as mapped by BIQc</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshSnapshot}
                  disabled={snapshotRefreshing}
                  className="text-xs gap-1"
                  data-testid="refresh-snapshot-btn"
                >
                  <RefreshCw className={`w-3 h-3 ${snapshotRefreshing ? 'animate-spin' : ''}`} />
                  {snapshotRefreshing ? 'Refreshing...' : 'Recalculate'}
                </Button>
              </div>
            </div>

            {/* Agent Persona — Strategic DNA Summary */}
            {persona && (
              <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-light)' }} data-testid="agent-persona">
                {persona.decision_style && (
                  <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    Decision style mapped as <span className="font-bold">{persona.decision_style}</span>.
                    {persona.risk_posture && <> Risk posture: <span className="font-bold">{persona.risk_posture}</span>.</>}
                  </p>
                )}
                {persona.bluntness && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Communication calibrated to {persona.bluntness} bluntness.
                  </p>
                )}
                {persona.summary && (
                  <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {persona.summary}
                  </p>
                )}
                {/* Render any persona fields the Edge Function provides */}
                {!persona.decision_style && !persona.summary && typeof persona === 'object' && (
                  <div className="space-y-1">
                    {Object.entries(persona).map(([key, val]) => (
                      val && typeof val === 'string' && (
                        <p key={key} className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          <span className="text-xs font-mono uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{key.replace(/_/g, ' ')}: </span>
                          {val}
                        </p>
                      )
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fact Ledger — Confirmed Strategic Truths */}
            {factLedger && typeof factLedger === 'object' && Object.keys(factLedger).length > 0 && (
              <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-light)' }} data-testid="fact-ledger">
                <p className="text-xs font-mono uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Confirmed signals</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(factLedger).slice(0, 12).map(([key, val]) => {
                    const displayVal = typeof val === 'object' ? (val.value || JSON.stringify(val)) : String(val);
                    return (
                      <div key={key} className="flex items-baseline gap-2 text-sm">
                        <span className="text-xs font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
                          {key.replace(/\./g, ' > ')}
                        </span>
                        <span style={{ color: 'var(--text-primary)' }}>{displayVal}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Executive Memo — Force Resolution from intelligence-snapshot */}
            {memo && (
              <div className="px-5 py-4" data-testid="executive-memo">
                <p className="text-xs font-mono uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>Force memo</p>
                <div className="space-y-2">
                  {memo.primary_tension && (
                    <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text-primary)' }}>{memo.primary_tension}</p>
                  )}
                  {memo.force_summary && (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{memo.force_summary}</p>
                  )}
                  {memo.drift_projection && (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{memo.drift_projection}</p>
                  )}
                  {memo.risk_quantification && (
                    <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--accent-primary, #3b82f6)' }}>{memo.risk_quantification}</p>
                  )}
                  {memo.strategic_direction && (
                    <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text-primary)' }}>{memo.strategic_direction}</p>
                  )}
                  {/* Render any additional memo fields the Edge Function provides */}
                  {Object.entries(memo).filter(([k]) => !['primary_tension','force_summary','drift_projection','risk_quantification','strategic_direction','platform_guidance'].includes(k)).map(([key, val]) => (
                    val && typeof val === 'string' && (
                      <p key={key} className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{val}</p>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* No memo yet — prompt recalculate */}
            {!memo && mirror?.calibration_status === 'complete' && (
              <div className="px-5 py-4" data-testid="memo-empty">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Intelligence snapshot pending. Click Recalculate to generate your first Force Memo.
                </p>
              </div>
            )}
          </div>
        ) : null}

        {/* ─── STRATEGIC CONSOLE ─── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>BIQc</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Strategic operations console</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/war-room')} className="text-xs gap-1">
              <ArrowRight className="w-3 h-3" /> Full Screen
            </Button>
          </div>
          <div
            className="w-full border rounded-xl shadow-sm overflow-hidden cursor-pointer transition-colors hover:border-blue-300"
            style={{ background: 'var(--bg-tertiary, #F6F7F9)' }}
            onClick={() => navigate('/war-room')}
            data-testid="strategic-console"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Open Strategic Console</span>
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Click to begin or continue your session</span>
            </div>
          </div>
        </div>

        {/* ─── WATCHTOWER: Emerging Inevitabilities ─── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Watchtower</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Emerging signals across your business</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={fetchWatchtowerEvents} variant="outline" size="sm" disabled={loadingEvents} className="gap-1 text-xs">
                <RefreshCw className={`w-3 h-3 ${loadingEvents ? 'animate-spin' : ''}`} /> Refresh
              </Button>
              <Button onClick={runColdRead} size="sm" disabled={runningAnalysis} className="bg-slate-900 hover:bg-slate-800 text-white gap-1 text-xs"
                data-testid="run-analysis-btn">
                {runningAnalysis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />} Run Analysis
              </Button>
            </div>
          </div>

          {loadingEvents && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          )}

          {!loadingEvents && watchtowerEvents.length === 0 && (
            <div className="text-center py-10 px-4 rounded-lg border" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-tertiary)' }}
              data-testid="watchtower-empty">
              <Eye className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No intelligence events yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Events appear as BIQc analyses your connected data.</p>
            </div>
          )}

          {!loadingEvents && watchtowerEvents.length > 0 && (
            <div className="space-y-4" data-testid="watchtower-events">
              {Object.keys(eventsByDomain).map(domain => (
                <div key={domain} className="space-y-3">
                  <h3 className="text-sm font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
                    {domain}
                  </h3>
                  <div className="space-y-2">
                    {eventsByDomain[domain].map(event => (
                      <WatchtowerEvent key={event.id} event={event} onHandle={handleEventAction} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdvisorWatchtower;
