import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { Button } from '../components/ui/button';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { RefreshCw, Loader2, Eye, Zap, AlertCircle } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import WatchtowerEvent from '../components/WatchtowerEvent';

const AdvisorWatchtower = () => {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  
  const [watchtowerEvents, setWatchtowerEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [emailConnected, setEmailConnected] = useState(false);
  const [emailConnection, setEmailConnection] = useState(null);

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
    // 1. Session Guard
    if (!user) {
      console.error("⛔ Watchtower Abort: No user session");
      toast.error("Session error. Please refresh and try again.");
      return;
    }

    // 2. Connection Existence Guard
    if (!emailConnected || !emailConnection) {
      toast.error('Connect your email first to run analysis');
      navigate('/connect-email');
      return;
    }

    // 3. Payload Construction (THE CRITICAL FIX)
    // We strictly map emailConnection.id, NOT user.id
    const payload = {
      workspace_id: user?.account_id || user?.workspace_id,
      email_connection_id: emailConnection?.id,
      provider: emailConnection?.provider || 'outlook'
    };

    // 4. Data Integrity Guard
    // Prevents sending bad requests to backend
    if (!payload.workspace_id || !payload.email_connection_id) {
      console.error("⛔ Watchtower Abort: Missing Business Context", payload);
      toast.error("Intelligence context missing. Please refresh or reconnect Outlook.");
      return;
    }

    // 5. Execution State Management
    setRunningAnalysis(true);
    toast.loading('Running Watchtower analysis...', { id: 'cold-read' });

    try {
      console.log("🧠 Cold Read payload being sent:", payload);

      const response = await apiClient.post('/intelligence/cold-read', payload);
      const result = response.data?.cold_read;

      // 6. Success Handling
      if (result?.events_created > 0) {
        toast.success(
          `Analysis complete: ${result.events_created} insight${result.events_created > 1 ? 's' : ''} detected`,
          { id: 'cold-read' }
        );
      } else {
        toast.info('Analysis complete: No new patterns detected', { id: 'cold-read' });
      }

      // 7. Refresh View
      await fetchWatchtowerEvents();

    } catch (error) {
      console.error("Cold read failed:", error);
      const errorMsg =
        error?.response?.data?.detail ||
        "Unable to start analysis. Please try again.";
      toast.error(errorMsg, { id: 'cold-read' });
    } finally {
      // 8. Always Release Lock
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
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
              Watchtower
            </h1>
            <p className="text-sm md:text-base text-slate-600 mt-1">
              What BIQc has noticed across your business
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={fetchWatchtowerEvents}
              variant="outline"
              disabled={loadingEvents}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loadingEvents ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              onClick={runColdRead}
              disabled={runningAnalysis || !emailConnected}
              className="bg-slate-900 hover:bg-slate-800 text-white gap-2"
            >
              {runningAnalysis ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              Run Analysis
            </Button>
          </div>
        </div>

        {/* Email Connection Warning */}
        {!emailConnected && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                Connect your email to enable Watchtower analysis
              </p>
              <p className="text-xs text-amber-700 mt-1">
                BIQc requires email access to detect communication patterns and relationship signals.
              </p>
              <Button
                onClick={() => navigate('/connect-email')}
                size="sm"
                variant="outline"
                className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                Connect Email
              </Button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loadingEvents ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : watchtowerEvents.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Eye className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {emailConnected ? 'No patterns detected yet' : 'Waiting for data'}
            </h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              {emailConnected 
                ? 'BIQc is monitoring your business activity. Click "Run Analysis" to generate intelligence from your email patterns.'
                : 'Connect your email account to enable BIQc to detect patterns, risks, and opportunities.'
              }
            </p>
            {emailConnected && (
              <Button
                onClick={runColdRead}
                className="mt-6 bg-slate-900 hover:bg-slate-800 text-white"
                disabled={runningAnalysis}
              >
                {runningAnalysis ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
                ) : (
                  <><Eye className="w-4 h-4 mr-2" /> Run Analysis</>
                )}
              </Button>
            )}
          </div>
        ) : (
          /* Watchtower Events */
          <div className="space-y-6">
            {Object.keys(eventsByDomain).map(domain => (
              <div key={domain} className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 capitalize">
                  {domainLabels[domain] || domain}
                </h2>
                <div className="space-y-3">
                  {eventsByDomain[domain].map(event => (
                    <WatchtowerEvent
                      key={event.id}
                      event={event}
                      onHandle={handleEventAction}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdvisorWatchtower;
