import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import axios from 'axios';
import { 
  MessageSquare, FileText, BarChart3, TrendingUp, 
  Plus, ArrowRight, Clock, Loader2, Zap, Target,
  CheckCircle, AlertCircle, Crown, Sparkles, Plug,
  ArrowUpRight, Activity
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [strengthScore, setStrengthScore] = useState(65);

  useEffect(() => {
    fetchStats();
    // Calculate strength score based on profile completeness
    calculateStrengthScore();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStrengthScore = () => {
    // This would normally come from the backend based on profile completeness
    // For now, simulate a score
    let score = 45;
    if (user?.business_name) score += 15;
    if (user?.industry) score += 10;
    setStrengthScore(Math.min(score, 100));
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#6366f1';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Work';
  };

  const quickActions = [
    { 
      icon: MessageSquare, 
      title: 'AI Chat', 
      desc: 'Get instant advice',
      path: '/advisor',
      gradient: 'from-indigo-500 to-purple-500'
    },
    { 
      icon: Zap, 
      title: 'Quick Diagnosis', 
      desc: 'Analyze your business',
      path: '/diagnosis',
      gradient: 'from-cyan-500 to-blue-500'
    },
    { 
      icon: FileText, 
      title: 'Generate SOP', 
      desc: 'Create documentation',
      path: '/sop-generator',
      gradient: 'from-emerald-500 to-teal-500'
    },
    { 
      icon: Target, 
      title: 'Market Intel', 
      desc: 'Competitive insights',
      path: '/market-analysis',
      gradient: 'from-orange-500 to-red-500'
    }
  ];

  const statCards = [
    { 
      label: 'AI Conversations', 
      value: stats?.total_chat_sessions || 0,
      icon: MessageSquare,
      change: '+12%',
      positive: true
    },
    { 
      label: 'Documents', 
      value: stats?.total_documents || 0,
      icon: FileText,
      change: '+5%',
      positive: true
    },
    { 
      label: 'Analyses', 
      value: stats?.total_analyses || 0,
      icon: BarChart3,
      change: '+8%',
      positive: true
    },
    { 
      label: 'Integrations', 
      value: 0,
      icon: Plug,
      change: 'Connect',
      positive: null
    }
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: 'var(--accent-primary)' }} />
            <p style={{ color: 'var(--text-muted)' }}>Loading your dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-8 animate-fade-in" data-testid="dashboard-page">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Welcome back
            </p>
            <h1 className="font-heading text-3xl lg:text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {user?.name?.split(' ')[0]}'s Dashboard
            </h1>
            {user?.business_name && (
              <p className="mt-1 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <span>{user.business_name}</span>
                {user?.industry && (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span style={{ color: 'var(--text-muted)' }}>{user.industry}</span>
                  </>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => navigate('/integrations')}
              className="btn-modern-secondary flex items-center gap-2"
            >
              <Plug className="w-4 h-4" />
              Connect Apps
            </Button>
            <Button 
              onClick={() => navigate('/advisor')}
              className="btn-modern-primary flex items-center gap-2"
              data-testid="start-advisor-btn"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </Button>
          </div>
        </div>

        {/* Top Row - Strength Score + Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Business Strength Score */}
          <div className="lg:col-span-4 card-modern p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-heading font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Business Strength
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Based on your profile
                </p>
              </div>
              <span 
                className="text-sm font-semibold px-3 py-1 rounded-full"
                style={{ 
                  background: `${getScoreColor(strengthScore)}20`,
                  color: getScoreColor(strengthScore)
                }}
              >
                {getScoreLabel(strengthScore)}
              </span>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Score Ring */}
              <div className="strength-ring">
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="var(--bg-tertiary)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke={getScoreColor(strengthScore)}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${(strengthScore / 100) * 327} 327`}
                    style={{ filter: `drop-shadow(0 0 8px ${getScoreColor(strengthScore)}40)` }}
                  />
                </svg>
                <div className="score-text" style={{ color: 'var(--text-primary)' }}>
                  {strengthScore}
                </div>
              </div>
              
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4" style={{ color: 'var(--accent-success)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Profile completed</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {strengthScore >= 60 ? (
                    <CheckCircle className="w-4 h-4" style={{ color: 'var(--accent-success)' }} />
                  ) : (
                    <AlertCircle className="w-4 h-4" style={{ color: 'var(--accent-warning)' }} />
                  )}
                  <span style={{ color: 'var(--text-secondary)' }}>Business data added</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>No integrations</span>
                </div>
                <Button 
                  variant="link" 
                  className="text-sm p-0 h-auto"
                  onClick={() => navigate('/business-profile')}
                  style={{ color: 'var(--accent-primary)' }}
                >
                  Improve Score <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="lg:col-span-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat, i) => (
              <div key={i} className="stat-card-modern" data-testid={`stat-${i}`}>
                <div className="flex items-center justify-between mb-3">
                  <stat.icon className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                  {stat.change && (
                    <span 
                      className="text-xs font-medium flex items-center gap-0.5"
                      style={{ 
                        color: stat.positive === null 
                          ? 'var(--accent-primary)' 
                          : stat.positive 
                            ? 'var(--accent-success)' 
                            : 'var(--accent-danger)'
                      }}
                    >
                      {stat.positive !== null && <ArrowUpRight className="w-3 h-3" />}
                      {stat.change}
                    </span>
                  )}
                </div>
                <p className="stat-label">{stat.label}</p>
                <p className="stat-value">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="font-heading text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, i) => (
              <button
                key={action.title}
                onClick={() => navigate(action.path)}
                className="card-modern p-5 text-left group"
                data-testid={`quick-action-${i}`}
              >
                <div 
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br ${action.gradient} group-hover:scale-110 transition-transform`}
                >
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{action.title}</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{action.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Analyses */}
          <div className="card-modern p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-heading font-semibold" style={{ color: 'var(--text-primary)' }}>
                Recent Analyses
              </h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/documents')}
                className="btn-modern-ghost"
                data-testid="view-all-analyses-btn"
              >
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            {stats?.recent_analyses?.length > 0 ? (
              <div className="space-y-3">
                {stats.recent_analyses.map((analysis) => (
                  <div 
                    key={analysis.id}
                    className="flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all"
                    style={{ background: 'var(--bg-tertiary)' }}
                    onClick={() => navigate(`/analysis/${analysis.id}`)}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                      <BarChart3 className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{analysis.title}</p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{analysis.analysis_type}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Clock className="w-3 h-3" />
                      {new Date(analysis.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <BarChart3 className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p style={{ color: 'var(--text-muted)' }}>No analyses yet</p>
                <Button 
                  onClick={() => navigate('/analysis')}
                  className="btn-modern-secondary mt-4"
                  data-testid="create-first-analysis-btn"
                >
                  Create Analysis
                </Button>
              </div>
            )}
          </div>

          {/* Recent Documents */}
          <div className="card-modern p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-heading font-semibold" style={{ color: 'var(--text-primary)' }}>
                Recent Documents
              </h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/documents')}
                className="btn-modern-ghost"
                data-testid="view-all-documents-btn"
              >
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            {stats?.recent_documents?.length > 0 ? (
              <div className="space-y-3">
                {stats.recent_documents.map((doc) => (
                  <div 
                    key={doc.id}
                    className="flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all"
                    style={{ background: 'var(--bg-tertiary)' }}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-500">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{doc.title}</p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{doc.document_type}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Clock className="w-3 h-3" />
                      {new Date(doc.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p style={{ color: 'var(--text-muted)' }}>No documents yet</p>
                <Button 
                  onClick={() => navigate('/sop-generator')}
                  className="btn-modern-secondary mt-4"
                  data-testid="create-first-document-btn"
                >
                  Generate SOP
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
