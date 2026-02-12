import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { Button } from '../components/ui/button';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { RefreshCw, Loader2, Eye, Zap, AlertCircle, X, ArrowRight } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import WatchtowerEvent from '../components/WatchtowerEvent';

/* ─── Guided tutorial for "Do Later" path ─── */
const TUTORIAL_STEPS = [
  { title: "Your Dashboard", body: "This is the Watchtower — it shows what BIQC has noticed across your business signals, emails, and data." },
  { title: "Where Insights Appear", body: "Intelligence events appear here automatically as BIQC analyses your connected data. No manual triggers needed." },
  { title: "Calibration", body: "Head to Settings → Agent Calibration whenever you're ready. Calibration helps BIQC personalise its advice to your business." },
];

const GuidedTutorial = ({ onDismiss }) => {
  const [step, setStep] = useState(0);
  const current = TUTORIAL_STEPS[step];
  const isLast = step === TUTORIAL_STEPS.length - 1;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-blue-500 uppercase tracking-wide mb-1">
            Quick guide · {step + 1} of {TUTORIAL_STEPS.length}
          </p>
          <h3 className="text-sm font-semibold text-slate-900">{current.title}</h3>
          <p className="text-sm text-slate-600 mt-1">{current.body}</p>
        </div>
        <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600 shrink-0 mt-0.5" aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
      <div className="flex items-center gap-2 mt-3">
        {!isLast ? (
          <Button size="sm" variant="outline" onClick={() => setStep(step + 1)} className="gap-1 text-xs">
            Next <ArrowRight size={12} />
          </Button>
        ) : (
          <Button size="sm" onClick={onDismiss} className="text-xs bg-blue-600 hover:bg-blue-700 text-white">
            Got it
          </Button>
        )}
        <button onClick={onDismiss} className="text-xs text-slate-400 hover:text-slate-600 ml-2">
          Skip tour
        </button>
      </div>
    </div>
  );
};

const AdvisorWatchtower = () => {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  
  const [watchtowerEvents, setWatchtowerEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [emailConnected, setEmailConnected] = useState(false);
  const [emailConnection, setEmailConnection] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [activation, setActivation] = useState(null);
  const [lifecycle, setLifecycle] = useState(null);
  const [resolvedFacts, setResolvedFacts] = useState(null);
  const [baselineSnapshot, setBaselineSnapshot] = useState(null);

  // Check for "Do Later" tutorial flag
  useEffect(() => {
    if (localStorage.getItem("biqc_show_tutorial") === "true") {
      setShowTutorial(true);
      localStorage.removeItem("biqc_show_tutorial");
    }
  }, []);

  // Fetch lifecycle state + resolved facts + baseline snapshot for WOW Landing
  useEffect(() => {
    const fetchLifecycle = async () => {
      try {
        const [lcRes, factsRes, baselineRes] = await Promise.all([
          apiClient.get('/lifecycle/state').catch(() => ({ data: null })),
          apiClient.get('/facts/resolve').catch(() => ({ data: null })),
          apiClient.get('/intelligence/baseline-snapshot').catch(() => ({ data: null })),
        ]);
        // Validate lifecycle response has the expected shape before setting
        const lc = lcRes.data;
        if (lc && lc.calibration && lc.integrations && lc.intelligence) {
          setLifecycle(lc);
        }
        if (factsRes.data?.facts) setResolvedFacts(factsRes.data.facts);
        if (baselineRes.data?.snapshot) setBaselineSnapshot(baselineRes.data.snapshot);
      } catch {}
    };
    fetchLifecycle();
  }, []);

  // Post-calibration activation — disabled (legacy endpoint removed)
  // Activation data now comes from user_operator_profile.agent_persona

  // Check if email is connected
  useEffect(() => {
    checkEmailConnection();
  }, []);

  const checkEmailConnection = async () => {
    try {
      const response = await apiClient.get('/outlook/status');
      setEmailConnected(response.data?.connected || false);
      if (response.data?.connected) {
        setEmailConnection({
          id: response.data?.connection_id || user?.id,
          provider: response.data?.provider || 'outlook'
        });
      }
    } catch (error) {
      console.error('Failed to check email status');
    }
  };

  // Fetch watchtower events
  useEffect(() => {
    fetchWatchtowerEvents();
  }, []);

  const fetchWatchtowerEvents = async () => {
    try {
      setLoadingEvents(true);
      const response = await apiClient.get('/intelligence/watchtower?status=active');
      setWatchtowerEvents(response.data?.events || []);
    } catch (error) {
      console.error('Failed to fetch watchtower events:', error);
      toast.error('Failed to load intelligence events');
    } finally {
      setLoadingEvents(false);
    }
  };

  const runColdRead = async () => {
    if (!user) {
      toast.error("Session error. Please refresh and try again.");
      return;
    }

    setRunningAnalysis(true);
    toast.loading('Running Watchtower analysis...', { id: 'cold-read' });

    try {
      // Backend resolves workspace_id internally — no frontend guard needed
      const response = await apiClient.post('/intelligence/cold-read', {});
      const result = response.data?.cold_read;

      if (result?.events_created > 0) {
        toast.success(
          `Analysis complete: ${result.events_created} insight${result.events_created > 1 ? 's' : ''} detected`,
          { id: 'cold-read' }
        );
      } else {
        toast.success('Baseline Initialized. No material changes detected yet. Monitoring your enabled domains.', { id: 'cold-read' });
      }

      await fetchWatchtowerEvents();
      // Refresh lifecycle to update WOW Landing
      try {
        const [lcRes, blRes] = await Promise.all([
          apiClient.get('/lifecycle/state'),
          apiClient.get('/intelligence/baseline-snapshot'),
        ]);
        setLifecycle(lcRes.data);
        if (blRes.data?.snapshot) setBaselineSnapshot(blRes.data.snapshot);
      } catch {}

    } catch (error) {
      console.error("Cold read failed:", error);
      const errorMsg = error?.response?.data?.detail || "Unable to start analysis. Please try again.";
      toast.error(errorMsg, { id: 'cold-read' });
    } finally {
      setRunningAnalysis(false);
    }
  };

  const handleEventAction = async (eventId) => {
    try {
      await apiClient.patch(`/intelligence/watchtower/${eventId}/handle`);
      toast.success('Event marked as handled');
      
      // Refresh events
      await fetchWatchtowerEvents();
    } catch (error) {
      toast.error('Failed to update event');
    }
  };

  // Group events by domain
  const eventsByDomain = watchtowerEvents.reduce((acc, event) => {
    const domain = event.domain || 'other';
    if (!acc[domain]) acc[domain] = [];
    acc[domain].push(event);
    return acc;
  }, {});

  const domainLabels = {
    communications: 'Communications',
    pipeline: 'Pipeline',
    financial: 'Financial',
    calendar: 'Calendar',
    operations: 'Operations',
    marketing: 'Marketing'
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Guided Tutorial (from "Do Later" path) */}
        {showTutorial && <GuidedTutorial onDismiss={() => setShowTutorial(false)} />}

        {/* ─── WOW LANDING: Lifecycle Summary ─── */}
        {lifecycle && (
          <div data-testid="wow-landing" className="rounded-xl border" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-card)' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>BIQc Intelligence Summary</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Your platform state at a glance</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 divide-x divide-y md:divide-y-0" style={{ borderColor: 'var(--border-light)' }}>
              {/* Calibration */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${lifecycle.calibration.complete ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                  <span className="text-xs font-medium tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>Calibration</span>
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {lifecycle.calibration.complete ? 'Agent Calibrated' : 'Pending'}
                </p>
                {resolvedFacts?.['business.name'] && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{resolvedFacts['business.name'].value}</p>
                )}
              </div>

              {/* Business DNA */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xs font-medium tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>Business DNA</span>
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {resolvedFacts ? `${Object.keys(resolvedFacts).length} facts confirmed` : 'Loading...'}
                </p>
                <div className="text-xs mt-1 space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {resolvedFacts?.['business.industry'] && <p>{resolvedFacts['business.industry'].value}</p>}
                  {resolvedFacts?.['business.website'] && <p>{resolvedFacts['business.website'].value}</p>}
                </div>
              </div>

              {/* Integrations */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${lifecycle.integrations.count > 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="text-xs font-medium tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>Integrations</span>
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {lifecycle.integrations.count > 0 ? `${lifecycle.integrations.count} Connected` : 'None Connected'}
                </p>
                {lifecycle.integrations.providers.length > 0 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {lifecycle.integrations.providers.join(', ')}
                  </p>
                )}
              </div>

              {/* Intelligence */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${lifecycle.intelligence.has_events ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                  <span className="text-xs font-medium tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>Intelligence</span>
                </div>
                {lifecycle.intelligence.has_events ? (
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Active</p>
                ) : (
                  <>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Pre-analysis</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {lifecycle.intelligence.domains_enabled.length > 0
                        ? `Domains: ${lifecycle.intelligence.domains_enabled.join(', ')}`
                        : 'No domains enabled'}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Executive Memo — data-bound, no hallucination */}
            {resolvedFacts && lifecycle && (
              <div className="col-span-full px-5 py-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
                <p className="text-xs font-medium tracking-wide uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Executive Memo</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                  {user?.full_name ? `${user.full_name.split(' ')[0]}, b` : 'B'}ased on your confirmed {resolvedFacts['business.industry']?.value || 'business'} focus
                  {lifecycle.integrations.count > 0 && ` and ${lifecycle.integrations.count} connected data source${lifecycle.integrations.count > 1 ? 's' : ''} (${lifecycle.integrations.providers.join(', ')})`}
                  , {baselineSnapshot ? 'I have initialized monitoring' : 'I am preparing to monitor'} across {lifecycle.intelligence.domains_enabled.length > 0 ? lifecycle.intelligence.domains_enabled.join(', ') : 'your enabled domains'}.
                  {baselineSnapshot && ' Baseline established — I will surface material changes as they occur.'}
                </p>
              </div>
            )}

            {/* Baseline Status */}
            {baselineSnapshot && (
              <div className="col-span-full px-5 py-3 border-t" style={{ borderColor: 'var(--border-light)', background: 'rgba(34,197,94,0.04)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Baseline Initialized</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    — Checked: {(baselineSnapshot.domains?.integrations_checked || []).join(', ')} | Monitoring: {(baselineSnapshot.domains?.enabled || []).join(', ')}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── SECTION 1: Strategic Operations Console ─── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">BIQc</h2>
              <p className="text-xs text-slate-500">Strategic operations console</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/war-room')} className="text-xs gap-1">
              <ArrowRight className="w-3 h-3" /> Full Screen
            </Button>
          </div>
          <div
            className="w-full border rounded-xl shadow-sm overflow-hidden cursor-pointer transition-colors hover:border-blue-300"
            style={{ background: '#F6F7F9' }}
            onClick={() => navigate('/war-room')}
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium text-slate-700">Open Strategic Console</span>
              </div>
              <span className="text-xs text-slate-400">Click to begin or continue your session</span>
            </div>
          </div>
        </div>

        {/* ─── SECTION 2: WATCHTOWER (Intelligence Events) ─── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Watchtower</h2>
              <p className="text-xs text-slate-500">What BIQc has noticed across your business</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={fetchWatchtowerEvents} variant="outline" size="sm" disabled={loadingEvents} className="gap-1 text-xs">
                <RefreshCw className={`w-3 h-3 ${loadingEvents ? 'animate-spin' : ''}`} /> Refresh
              </Button>
              <Button onClick={runColdRead} size="sm" disabled={runningAnalysis} className="bg-slate-900 hover:bg-slate-800 text-white gap-1 text-xs">
                {runningAnalysis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />} Run Analysis
              </Button>
            </div>
          </div>

          {/* Email Connection Warning */}
          {!emailConnected && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 mb-4">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-amber-900">Connect your email to enable Watchtower</p>
                <Button onClick={() => navigate('/connect-email')} size="sm" variant="outline" className="mt-2 text-xs border-amber-300 text-amber-700 hover:bg-amber-100">
                  Connect Email
                </Button>
              </div>
            </div>
          )}

          {/* Loading */}
          {loadingEvents && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          )}

          {/* Empty state */}
          {!loadingEvents && watchtowerEvents.length === 0 && (
            <div className="text-center py-10 px-4 bg-slate-50 rounded-lg border border-slate-200">
              <Eye className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">No intelligence events yet</p>
              <p className="text-xs text-slate-400 mt-1">Events appear as BIQc analyses your connected data.</p>
            </div>
          )}

          {/* Events list */}
          {!loadingEvents && watchtowerEvents.length > 0 && (
            <div className="space-y-4">
              {Object.keys(eventsByDomain).map(domain => (
                <div key={domain} className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700 capitalize">{domainLabels[domain] || domain}</h3>
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
