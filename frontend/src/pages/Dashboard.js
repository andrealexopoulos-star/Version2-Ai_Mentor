import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import axios from 'axios';
import { 
  MessageSquare, FileText, BarChart3, TrendingUp, 
  Plus, ArrowRight, Clock, Loader2 
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
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

  const quickActions = [
    { 
      icon: MessageSquare, 
      title: 'Start Chat', 
      desc: 'Talk to your AI advisor',
      path: '/advisor',
      color: 'bg-[#ccff00]',
      iconColor: 'text-[#0f2f24]'
    },
    { 
      icon: BarChart3, 
      title: 'New Analysis', 
      desc: 'Analyze your business',
      path: '/analysis',
      color: 'bg-[#0f2f24]',
      iconColor: 'text-[#ccff00]'
    },
    { 
      icon: FileText, 
      title: 'Generate SOP', 
      desc: 'Create documentation',
      path: '/sop-generator',
      color: 'bg-white border border-[#e5e5e5]',
      iconColor: 'text-[#0f2f24]'
    },
    { 
      icon: TrendingUp, 
      title: 'Market Analysis', 
      desc: 'Competitive insights',
      path: '/market-analysis',
      color: 'bg-white border border-[#e5e5e5]',
      iconColor: 'text-[#0f2f24]'
    }
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#0f2f24]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8" data-testid="dashboard-page">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="overline text-[#0f2f24]/60 mb-2">Dashboard</p>
            <h1 className="text-3xl md:text-4xl font-serif text-[#0f2f24]">
              Welcome back, <em>{user?.name?.split(' ')[0]}</em>
            </h1>
            {user?.business_name && (
              <p className="text-[#0f2f24]/60 mt-1">{user.business_name}</p>
            )}
          </div>
          <Button 
            onClick={() => navigate('/advisor')}
            className="btn-lime rounded-full px-6 flex items-center gap-2"
            data-testid="start-advisor-btn"
          >
            <Plus className="w-4 h-4" />
            New Consultation
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="stat-card hover-lift" data-testid="stat-analyses">
            <CardContent className="p-6">
              <p className="stat-label">Analyses</p>
              <p className="stat-value">{stats?.total_analyses || 0}</p>
            </CardContent>
          </Card>
          <Card className="stat-card hover-lift" data-testid="stat-documents">
            <CardContent className="p-6">
              <p className="stat-label">Documents</p>
              <p className="stat-value">{stats?.total_documents || 0}</p>
            </CardContent>
          </Card>
          <Card className="stat-card hover-lift" data-testid="stat-sessions">
            <CardContent className="p-6">
              <p className="stat-label">Chat Sessions</p>
              <p className="stat-value">{stats?.total_chat_sessions || 0}</p>
            </CardContent>
          </Card>
          <Card className="stat-card bg-[#0f2f24] text-white hover-lift" data-testid="stat-insights">
            <CardContent className="p-6">
              <p className="stat-label text-white/60">AI Insights</p>
              <p className="stat-value text-[#ccff00]">Active</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-serif text-[#0f2f24] mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {quickActions.map((action, i) => (
              <button
                key={action.title}
                onClick={() => navigate(action.path)}
                className={`${action.color} p-6 text-left hover-lift transition-all duration-200`}
                data-testid={`quick-action-${i}`}
              >
                <action.icon className={`w-8 h-8 ${action.iconColor} mb-4`} />
                <h3 className="font-medium text-[#0f2f24]">{action.title}</h3>
                <p className="text-sm text-[#0f2f24]/60 mt-1">{action.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Analyses */}
          <Card className="card-clean">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-serif text-[#0f2f24]">Recent Analyses</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/documents')}
                  className="text-[#0f2f24]/60 hover:text-[#0f2f24]"
                  data-testid="view-all-analyses-btn"
                >
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              {stats?.recent_analyses?.length > 0 ? (
                <div className="space-y-4">
                  {stats.recent_analyses.map((analysis) => (
                    <div 
                      key={analysis.id}
                      className="flex items-start gap-4 p-4 bg-[#f5f5f0] rounded-sm cursor-pointer hover:bg-[#e8e8e3] transition-colors"
                      onClick={() => navigate(`/analysis/${analysis.id}`)}
                    >
                      <BarChart3 className="w-5 h-5 text-[#0f2f24]/60 mt-1" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#0f2f24] truncate">{analysis.title}</p>
                        <p className="text-sm text-[#0f2f24]/60">{analysis.analysis_type}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-[#0f2f24]/40">
                        <Clock className="w-3 h-3" />
                        {new Date(analysis.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 text-[#0f2f24]/20 mx-auto mb-3" />
                  <p className="text-[#0f2f24]/60">No analyses yet</p>
                  <Button 
                    variant="link" 
                    onClick={() => navigate('/analysis')}
                    className="text-[#0f2f24] mt-2"
                    data-testid="create-first-analysis-btn"
                  >
                    Create your first analysis
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Documents */}
          <Card className="card-clean">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-serif text-[#0f2f24]">Recent Documents</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/documents')}
                  className="text-[#0f2f24]/60 hover:text-[#0f2f24]"
                  data-testid="view-all-documents-btn"
                >
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              {stats?.recent_documents?.length > 0 ? (
                <div className="space-y-4">
                  {stats.recent_documents.map((doc) => (
                    <div 
                      key={doc.id}
                      className="flex items-start gap-4 p-4 bg-[#f5f5f0] rounded-sm cursor-pointer hover:bg-[#e8e8e3] transition-colors"
                      onClick={() => navigate(`/documents/${doc.id}`)}
                    >
                      <FileText className="w-5 h-5 text-[#0f2f24]/60 mt-1" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#0f2f24] truncate">{doc.title}</p>
                        <p className="text-sm text-[#0f2f24]/60">{doc.document_type}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-[#0f2f24]/40">
                        <Clock className="w-3 h-3" />
                        {new Date(doc.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-[#0f2f24]/20 mx-auto mb-3" />
                  <p className="text-[#0f2f24]/60">No documents yet</p>
                  <Button 
                    variant="link" 
                    onClick={() => navigate('/sop-generator')}
                    className="text-[#0f2f24] mt-2"
                    data-testid="create-first-document-btn"
                  >
                    Generate your first SOP
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
