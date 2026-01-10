import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { apiClient } from '../lib/api';
import { 
  MessageSquare, FileText, BarChart3, 
  Plus, ArrowRight, ArrowUpRight, Loader2, Zap, Target,
  CheckCircle2, Circle, Plug, Building2, FolderOpen, X
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';



const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
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
      if (!response.data.completed) {
        navigate('/onboarding', { replace: true });
        return;
      }
      setCheckingOnboarding(false);
      fetchStats();
      fetchFocus();
      checkOutlookStatus();
    } catch (error) {
      console.error('Failed to check onboarding:', error);
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

  const quickActions = [
    { 
      icon: MessageSquare, 
      title: 'AI Advisor', 
      desc: 'Get personalised advice',
      path: '/advisor',
      color: '#0066FF'
    },
    { 
      icon: Zap, 
      title: 'Quick Diagnosis', 
      desc: 'Analyse your business',
      path: '/diagnosis',
      color: '#7C3AED'
    },
    { 
      icon: FileText, 
      title: 'Generate SOP', 
      desc: 'Create documentation',
      path: '/sop-generator',
      color: '#00C853'
    },
    { 
      icon: Target, 
      title: 'Market Intel', 
      desc: 'Competitive insights',
      path: '/market-analysis',
      color: '#FF9500'
    }
  ];

  const setupSteps = [
    { label: 'Account created', done: true, icon: CheckCircle2 },
    { label: 'Business profile', done: !!user?.business_name, path: '/business-profile', icon: Building2 },
    { label: 'Upload documents', done: stats?.total_documents > 0, path: '/data-center', icon: FolderOpen },
    { label: 'Connect integrations', done: outlookConnected, path: '/integrations', icon: Plug },
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
      description: 'Link your CRM, accounting, and marketing tools',
      icon: Plug,
      path: '/integrations',
      color: '#7C3AED',
      done: outlookConnected
    },
    {
      title: 'Generate Your First SOP',
      description: 'Create standard operating procedures for your business',
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
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-primary)' }} />
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Setup Progress
                </span>
                <div className="flex gap-3">
                  {setupSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      {step.done ? (
                        <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--accent-success)' }} />
                      ) : (
                        <Circle className="w-4 h-4" style={{ color: 'var(--border-medium)' }} />
                      )}
                      <span 
                        className="text-xs hidden sm:inline"
                        style={{ 
                          color: step.done ? 'var(--text-primary)' : 'var(--text-muted)'
                        }}
                      >
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <Button 
                onClick={() => setShowSetupOptions(true)}
                className="btn-secondary text-sm"
              >
                Continue Setup
                <ArrowRight className="w-3 h-3" />
              </Button>
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

        {/* Stats Row - Secondary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'AI Chats', value: stats?.total_chat_sessions || 0, icon: MessageSquare, change: '+12%' },
            { label: 'Documents', value: stats?.total_documents || 0, icon: FileText, change: '+5%' },
            { label: 'Analyses', value: stats?.total_analyses || 0, icon: BarChart3, change: '+8%' },
            { label: 'SOPs', value: stats?.total_sops || 0, icon: FileText, change: 'New' },
          ].map((stat, i) => (
            <div 
              key={i} 
              className="p-4 rounded-xl"
              style={{ 
                background: 'var(--bg-card)', 
                border: '1px solid var(--border-light)'
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--bg-tertiary)' }}
                >
                  <stat.icon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                </div>
                <span 
                  className="text-xs font-medium flex items-center gap-1"
                  style={{ color: 'var(--accent-success)' }}
                >
                  <ArrowUpRight className="w-3 h-3" />
                  {stat.change}
                </span>
              </div>
              <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
              <p className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions - Secondary */}
        <div>
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Quick Actions</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={() => navigate(action.path)}
                className="p-4 rounded-xl text-left transition-all hover:shadow-sm"
                style={{ 
                  background: 'var(--bg-card)', 
                  border: '1px solid var(--border-light)'
                }}
              >
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `${action.color}10` }}
                >
                  <action.icon className="w-4 h-4" style={{ color: action.color }} />
                </div>
                <h4 className="text-sm font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>
                  {action.title}
                </h4>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {action.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity - Secondary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Chats */}
          <div 
            className="p-5 rounded-xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Recent Conversations</h3>
              <button 
                onClick={() => navigate('/advisor')}
                className="text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                View All
              </button>
            </div>
            {stats?.recent_analyses?.length > 0 ? (
              <div className="space-y-2">
                {stats.recent_analyses.slice(0, 3).map((item, i) => (
                  <div 
                    key={i}
                    className="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors"
                    style={{ background: 'var(--bg-tertiary)' }}
                    onClick={() => navigate('/advisor')}
                  >
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'var(--accent-primary)' }}
                    >
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {item.title || 'Business Advisory Chat'}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowRight className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2"
                  style={{ background: 'var(--bg-tertiary)' }}
                >
                  <MessageSquare className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                </div>
                <p className="text-sm mb-1" style={{ color: 'var(--text-primary)' }}>No conversations yet</p>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  Start chatting with your AI advisor
                </p>
                <Button onClick={() => navigate('/advisor')} className="btn-secondary text-xs px-3 py-1.5">
                  <Plus className="w-3 h-3" />
                  Start Chat
                </Button>
              </div>
            )}
          </div>

          {/* Connect Integrations */}
          <div 
            className="p-5 rounded-xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Integrations</h3>
              <button 
                onClick={() => navigate('/integrations')}
                className="text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                View All
              </button>
            </div>
            <div className="space-y-2">
              {[
                { name: 'HubSpot', desc: 'Connect your CRM', color: '#FF7A59', logo: 'HS' },
                { name: 'Xero', desc: 'Sync accounting data', color: '#13B5EA', logo: 'XE' },
                { name: 'Slack', desc: 'Get notifications', color: '#4A154B', logo: 'SL' },
              ].map((int, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors"
                  style={{ background: 'var(--bg-tertiary)' }}
                  onClick={() => navigate('/integrations')}
                >
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: int.color }}
                  >
                    {int.logo}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{int.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{int.desc}</p>
                  </div>
                  <Button 
                    className="btn-secondary text-xs px-3 py-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/integrations');
                    }}
                  >
                    Connect
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
