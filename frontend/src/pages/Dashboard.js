import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { apiClient } from '../lib/api';
import { 
  MessageSquare, FileText, BarChart3, TrendingUp, 
  Plus, ArrowRight, ArrowUpRight, Loader2, Zap, Target,
  CheckCircle2, Circle, Plug, Sparkles, Building2, FolderOpen, X
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';



const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [profileScores, setProfileScores] = useState({ completeness: 0, strength: 0 });
  const [loading, setLoading] = useState(true);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [showSetupOptions, setShowSetupOptions] = useState(false);

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const response = await apiClient.get('/onboarding/status');
      if (!response.data.completed) {
        // Redirect to onboarding if not completed
        // Keep checkingOnboarding=true so we don't render dashboard
        navigate('/onboarding', { replace: true });
        return;
      }
      // Onboarding completed, fetch dashboard data
      setCheckingOnboarding(false);
      fetchStats();
      fetchProfileScores();
    } catch (error) {
      console.error('Failed to check onboarding:', error);
      // If error, continue to dashboard anyway
      setCheckingOnboarding(false);
      fetchStats();
      fetchProfileScores();
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

  const fetchProfileScores = async () => {
    try {
      const response = await apiClient.get(`/business-profile/scores`);
      setProfileScores(response.data);
    } catch (error) {
      console.error('Failed to fetch profile scores:', error);
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
    { label: 'Connect integrations', done: false, path: '/integrations', icon: Plug },
  ];

  const setupOptions = [
    {
      title: 'Complete Business Profile',
      description: 'Add your business details for personalized AI advice',
      icon: Building2,
      path: '/business-profile',
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
      done: false
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
            <h1 style={{ color: 'var(--text-primary)' }}>
              Welcome back, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
              Here&apos;s what&apos;s happening with your business today
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

        {/* Setup Progress Card */}
        {completedSteps < setupSteps.length && (
          <div 
            className="card p-6"
            style={{ 
              background: 'linear-gradient(135deg, rgba(0, 102, 255, 0.05) 0%, var(--bg-card) 100%)',
              borderColor: 'rgba(0, 102, 255, 0.2)'
            }}
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Complete your setup
                  </span>
                  <span 
                    className="badge badge-primary"
                  >
                    {completedSteps}/{setupSteps.length}
                  </span>
                </div>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  Complete these steps to unlock personalised AI insights
                </p>
                <div className="flex flex-wrap gap-4">
                  {setupSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {step.done ? (
                        <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--accent-success)' }} />
                      ) : (
                        <Circle className="w-5 h-5" style={{ color: 'var(--border-medium)' }} />
                      )}
                      <span 
                        className="text-sm"
                        style={{ 
                          color: step.done ? 'var(--text-primary)' : 'var(--text-muted)',
                          textDecoration: step.done ? 'line-through' : 'none'
                        }}
                      >
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <Button 
                onClick={() => navigate(setupSteps.find(s => !s.done)?.label === 'Business profile' ? '/business-profile' : '/integrations')}
                className="btn-primary"
              >
                Continue Setup
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Profile Scores Card */}
        <div 
          className="card p-6"
          style={{ 
            background: 'linear-gradient(135deg, rgba(0,102,255,0.08) 0%, var(--bg-card) 100%)',
            border: '1px solid rgba(0,102,255,0.2)'
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Profile Completeness */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Profile Completeness</span>
              </div>
              <div className="flex items-end gap-3 mb-2">
                <span className="text-5xl font-serif" style={{ color: 'var(--accent-primary)' }}>{profileScores.completeness}%</span>
                <span className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>of fields filled</span>
              </div>
              <Progress value={profileScores.completeness} className="h-3" />
            </div>

            {/* Business Score */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5" style={{ color: 'var(--accent-success)' }} />
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Business Score</span>
              </div>
              <div className="flex items-end gap-3 mb-2">
                <span className="text-5xl font-serif" style={{ color: 'var(--accent-success)' }}>{profileScores.strength}</span>
                <span className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>/100</span>
              </div>
              <Progress value={profileScores.strength} className="h-3" />
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Based on business performance & activity</p>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'AI Chats', value: stats?.total_chat_sessions || 0, icon: MessageSquare, change: '+12%' },
            { label: 'Documents', value: stats?.total_documents || 0, icon: FileText, change: '+5%' },
            { label: 'Analyses', value: stats?.total_analyses || 0, icon: BarChart3, change: '+8%' },
            { label: 'SOPs', value: stats?.total_sops || 0, icon: FileText, change: 'New' },
          ].map((stat, i) => (
            <div key={i} className="stat-card">
              <div className="flex items-center justify-between mb-4">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--bg-tertiary)' }}
                >
                  <stat.icon className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                </div>
                <span 
                  className="text-xs font-medium flex items-center gap-1"
                  style={{ color: 'var(--accent-success)' }}
                >
                  <ArrowUpRight className="w-3 h-3" />
                  {stat.change}
                </span>
              </div>
              <p className="stat-label mb-1">{stat.label}</p>
              <p className="stat-value">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="mb-4" style={{ color: 'var(--text-primary)' }}>Quick Actions</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={() => navigate(action.path)}
                className="quick-action"
              >
                <div 
                  className="quick-action-icon"
                  style={{ background: `${action.color}15` }}
                >
                  <action.icon className="w-6 h-6" style={{ color: action.color }} />
                </div>
                <h4 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {action.title}
                </h4>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {action.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Chats */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 style={{ color: 'var(--text-primary)' }}>Recent Conversations</h3>
              <button 
                onClick={() => navigate('/advisor')}
                className="btn-ghost text-sm"
                style={{ color: 'var(--accent-primary)' }}
              >
                View All
              </button>
            </div>
            {stats?.recent_analyses?.length > 0 ? (
              <div className="space-y-3">
                {stats.recent_analyses.slice(0, 3).map((item, i) => (
                  <div 
                    key={i}
                    className="flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors"
                    style={{ background: 'var(--bg-tertiary)' }}
                    onClick={() => navigate('/advisor')}
                  >
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'var(--accent-primary)' }}
                    >
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {item.title || 'Business Advisory Chat'}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <MessageSquare className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
                </div>
                <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No conversations yet</p>
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                  Start chatting with your AI advisor
                </p>
                <Button onClick={() => navigate('/advisor')} className="btn-primary">
                  <Plus className="w-4 h-4" />
                  Start Chat
                </Button>
              </div>
            )}
          </div>

          {/* Connect Integrations */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h3 style={{ color: 'var(--text-primary)' }}>Integrations</h3>
              <button 
                onClick={() => navigate('/integrations')}
                className="btn-ghost text-sm"
                style={{ color: 'var(--accent-primary)' }}
              >
                View All
              </button>
            </div>
            <div className="space-y-3">
              {[
                { name: 'HubSpot', desc: 'Connect your CRM', color: '#FF7A59', logo: 'HS' },
                { name: 'Xero', desc: 'Sync accounting data', color: '#13B5EA', logo: 'XE' },
                { name: 'Slack', desc: 'Get notifications', color: '#4A154B', logo: 'SL' },
              ].map((int, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors"
                  style={{ background: 'var(--bg-tertiary)' }}
                  onClick={() => navigate('/integrations')}
                >
                  <div 
                    className="integration-logo"
                    style={{ background: int.color }}
                  >
                    {int.logo}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{int.name}</p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{int.desc}</p>
                  </div>
                  <Button 
                    className="btn-secondary text-sm py-2 px-4"
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
