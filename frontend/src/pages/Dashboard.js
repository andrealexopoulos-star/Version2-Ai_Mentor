import { PageLoadingState } from '../components/PageStateComponents';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { apiClient } from '../lib/api';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { 
  MessageSquare, FileText, 
  ArrowRight, Loader2,
  CheckCircle2, Circle, Plug, Building2, FolderOpen, X
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useSupabaseAuth();
  const [stats, setStats] = useState(null);
  const [focus, setFocus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [showSetupOptions, setShowSetupOptions] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(false);

  useEffect(() => {
    checkOnboarding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkOnboarding = async () => {
    try {
      const response = await apiClient.get('/onboarding/status');
      
      // INTELLIGENCE GATE: Fail open on errors, show choice if incomplete
      if (!response.data.completed) {
        // Don't force redirect - user can skip
        // Show degraded intelligence mode banner instead
        // console.log('ℹ️ Onboarding incomplete - degraded intelligence mode active');
      }
      
      setCheckingOnboarding(false);
      fetchStats();
      fetchFocus();
      checkOutlookStatus();
    } catch (error) {
      // FAIL OPEN: If onboarding status unknown, allow access
      // console.log('Onboarding status unavailable');
      setCheckingOnboarding(false);
      fetchStats();
      fetchFocus();
      checkOutlookStatus();
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get(`/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFocus = async () => {
    try {
      const response = await apiClient.get('/dashboard/focus');
      setFocus(response.data);
    } catch (error) {
      console.error('Failed to fetch focus:', error);
    }
  };

  const checkOutlookStatus = async () => {
    try {
      const response = await apiClient.get('/outlook/status');
      setOutlookConnected(response.data?.connected || false);
    } catch (error) {
      console.error('Failed to check Outlook status:', error);
    }
  };

  // Core = everything needed for Ask BIQc to give real value.
  // Enhanced = integrations that unlock real-time signals + alerts.
  // A freshly-signed-up user should see "Core ready, ask anything" immediately.
  const setupSteps = [
    { label: 'Account created', done: true, icon: CheckCircle2, group: 'core' },
    { label: 'Business profile', done: !!user?.business_name, path: '/business-profile', icon: Building2, group: 'core' },
    { label: 'Ask BIQc ready', done: true, path: '/soundboard', icon: MessageSquare, group: 'core', hint: 'Use right now — no setup needed' },
    { label: 'Upload documents', done: stats?.total_documents > 0, path: '/data-center', icon: FolderOpen, group: 'enhanced', hint: 'Optional — boosts context depth' },
    { label: 'Connect integrations', done: outlookConnected, path: '/integrations', icon: Plug, group: 'enhanced', hint: 'Optional — unlocks live alerts & Board Room signals' },
  ];

  const setupOptions = [
    {
      title: 'Complete Business Profile',
      description: 'Add detailed business data for maximum AI personalization',
      icon: Building2,
      path: '/profile-import',
      color: '#0066FF',
      done: !!user?.business_name
    },
    {
      title: 'Upload Documents',
      description: 'Add business plans, financials, or reports for AI analysis',
      icon: FolderOpen,
      path: '/data-center',
      color: '#00C853',
      done: stats?.total_documents > 0
    },
    {
      title: 'Connect Integrations',
      description: 'Link your tools for deeper insights',
      icon: Plug,
      path: '/integrations',
      color: '#7C3AED',
      done: outlookConnected
    },
    {
      title: 'Generate Your First SOP',
      description: 'Create standard operating procedures',
      icon: FileText,
      path: '/sop-generator',
      color: '#FF9500',
      done: false
    }
  ];

  const completedSteps = setupSteps.filter(s => s.done).length;

  if (loading || checkingOnboarding) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl">
          <PageLoadingState message="Loading your Intelligence Platform…" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-6xl animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-serif leading-tight" style={{ color: 'var(--text-primary)' }}>
              Here's What Matters in Your Business Right Now
            </h1>
            <p className="mt-2 text-base" style={{ color: 'var(--text-secondary)' }}>
              One clear priority. No noise. Updated as your business changes.
            </p>
          </div>
          <Button 
            onClick={() => navigate('/advisor')}
            className="btn-primary"
          >
            <MessageSquare className="w-4 h-4" />
            New Chat
          </Button>
        </div>

        {/* AI Focus Card - Primary Hero */}
        <div 
          className="card p-8 relative overflow-hidden"
          style={{ 
            background: focus?.type === 'action' 
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, var(--bg-card) 100%)'
              : focus?.type === 'stability'
              ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, var(--bg-card) 100%)'
              : 'linear-gradient(135deg, rgba(0, 102, 255, 0.08) 0%, var(--bg-card) 100%)',
            border: focus?.type === 'action'
              ? '2px solid rgba(245, 158, 11, 0.25)'
              : focus?.type === 'stability'
              ? '2px solid rgba(34, 197, 94, 0.25)'
              : '2px solid rgba(0, 102, 255, 0.25)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)'
          }}
        >
          <div className="flex flex-col gap-4">
            <p 
              className="text-2xl md:text-3xl font-serif leading-snug"
              style={{ color: 'var(--text-primary)' }}
            >
              {focus?.focus || "Checking your business signals..."}
            </p>
            {focus?.context && (
              <p 
                className="text-base leading-relaxed max-w-2xl"
                style={{ color: 'var(--text-secondary)' }}
              >
                {focus.context}
              </p>
            )}
          </div>
        </div>

        {/* Setup Progress - Secondary */}
        {completedSteps < setupSteps.length && (
          <div 
            className="p-5 rounded-xl"
            style={{ 
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)'
            }}
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Setup progress — Ask BIQc works now; the rest unlocks more depth
                </span>
                <Button
                  onClick={() => setShowSetupOptions(true)}
                  className="btn-secondary text-sm"
                >
                  Continue setup
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
              {['core', 'enhanced'].map((group) => {
                const steps = setupSteps.filter((s) => (s.group || 'core') === group);
                if (steps.length === 0) return null;
                return (
                  <div key={group} className="flex flex-col gap-2">
                    <div
                      className="text-[10px] uppercase tracking-wider"
                      style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em' }}
                    >
                      {group === 'core' ? 'Core — ready to use' : 'Enhanced — optional upgrades'}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {steps.map((step, i) => (
                        <button
                          key={`${group}-${i}`}
                          type="button"
                          onClick={() => step.path && navigate(step.path)}
                          className="flex items-center gap-1.5 text-left"
                          style={{ background: 'transparent', border: 'none', padding: 0, cursor: step.path ? 'pointer' : 'default' }}
                          title={step.hint || ''}
                        >
                          {step.done ? (
                            <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent-success)' }} />
                          ) : (
                            <Circle className="w-4 h-4" style={{ color: 'var(--border-medium)' }} />
                          )}
                          <span
                            className="text-xs"
                            style={{ color: step.done ? 'var(--text-primary)' : 'var(--text-muted)' }}
                          >
                            {step.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Setup Options Modal */}
        {showSetupOptions && (
          <div className="modal-overlay" onClick={() => setShowSetupOptions(false)}>
            <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
              <button 
                onClick={() => setShowSetupOptions(false)}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-2xl font-serif mb-2" style={{ color: 'var(--text-primary)' }}>
                Continue Setup
              </h2>
              <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
                Choose what you'd like to set up next
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {setupOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.path}
                      onClick={() => {
                        setShowSetupOptions(false);
                        navigate(option.path);
                      }}
                      className="text-left p-5 rounded-xl border-2 transition-all hover:border-opacity-100"
                      style={{ 
                        borderColor: option.done ? 'var(--accent-success)' : 'var(--border-medium)',
                        background: 'var(--bg-card)'
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `${option.color}15` }}
                        >
                          <Icon className="w-6 h-6" style={{ color: option.color }} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {option.title}
                            </h3>
                            {option.done && (
                              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent-success)' }} />
                            )}
                          </div>
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {option.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
