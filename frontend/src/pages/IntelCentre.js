import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import {
  Target, Stethoscope, BarChart3, TrendingUp, ArrowRight,
  Brain, BookOpen, Globe, GitBranch
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { fontFamily } from '../design-system/tokens';
import { apiClient } from '../lib/api';
import PredictionsPanel from '../components/intelligence/PredictionsPanel';
import NarrativePanel from '../components/intelligence/NarrativePanel';
import ExternalIntelFeed from '../components/intelligence/ExternalIntelFeed';
import DecisionPatterns from '../components/intelligence/DecisionPatterns';

const TABS = [
  { key: 'tools',       label: 'Tools',         icon: Target },
  { key: 'predictions', label: 'Predictions',   icon: Brain },
  { key: 'narrative',   label: 'Narrative',      icon: BookOpen },
  { key: 'external',    label: 'External Intel', icon: Globe },
  { key: 'decisions',   label: 'Decisions',      icon: GitBranch },
];

const IntelCentre = () => {
  const navigate = useNavigate();
  const [businessScore, setBusinessScore] = useState(0);
  const [activeTab, setActiveTab] = useState('tools');

  useEffect(() => {
    fetchBusinessScore();
  }, []);

  const fetchBusinessScore = async () => {
    try {
      const response = await apiClient.get('/business-profile/scores');
      setBusinessScore(response.data?.strength || 0);
    } catch (error) {
      console.error('Failed to fetch business score:', error);
    }
  };

  const tools = [
    {
      icon: Stethoscope,
      title: 'Diagnosis',
      description: 'Quick business health diagnosis with root cause analysis',
      path: '/diagnosis',
      color: '#7C3AED'
    },
    {
      icon: BarChart3,
      title: 'Analysis',
      description: 'Comprehensive business analysis and strategic insights',
      path: '/analysis',
      color: '#0066FF'
    },
    {
      icon: TrendingUp,
      title: 'Market Intel',
      description: 'Competitive market analysis and positioning insights',
      path: '/market-analysis',
      color: '#FF9500'
    }
  ];

  const getScoreColor = (score) => {
    if (score >= 70) return 'var(--accent-success)';
    if (score >= 40) return '#F59E0B';
    return '#EF4444';
  };

  const getScoreLabel = (score) => {
    if (score >= 70) return 'Strong';
    if (score >= 40) return 'Developing';
    return 'Needs Attention';
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>
              — Intelligence
            </div>
            <h1 className="font-medium mb-2" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
              Intel <em style={{ fontStyle: 'italic', color: '#E85D00' }}>Centre</em>.
            </h1>
            <p className="text-sm" style={{ fontFamily: fontFamily.body, color: '#8FA0B8' }}>
              Business intelligence, diagnostics, and market insights powered by AI
            </p>
          </div>

          {/* Business Score Card */}
          <div
            className="p-6 rounded-xl mb-6"
            style={{
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, var(--bg-card) 100%)',
              border: `1px solid ${getScoreColor(businessScore)}40`
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" style={{ color: getScoreColor(businessScore) }} />
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Business Score</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: `${getScoreColor(businessScore)}20`,
                    color: getScoreColor(businessScore)
                  }}
                >
                  {getScoreLabel(businessScore)}
                </span>
              </div>
              <span className="text-4xl font-serif" style={{ color: getScoreColor(businessScore) }}>
                {businessScore}<span className="text-lg">/100</span>
              </span>
            </div>
            <Progress value={businessScore} className="h-2 mb-2" />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Based on your business performance, profile completeness, and activity
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1" style={{ borderBottom: '1px solid var(--border-default)' }}>
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm whitespace-nowrap transition-all relative"
                  style={{
                    color: isActive ? '#E85D00' : '#708499',
                    fontFamily: fontFamily.body,
                    fontWeight: isActive ? 600 : 400,
                  }}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {isActive && (
                    <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ background: '#E85D00' }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          {activeTab === 'tools' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {tools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <Card
                      key={tool.path}
                      className="card cursor-pointer hover:shadow-lg transition-all"
                      onClick={() => navigate(tool.path)}
                    >
                      <CardContent className="p-6">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                          style={{ background: `${tool.color}15` }}
                        >
                          <Icon className="w-6 h-6" style={{ color: tool.color }} />
                        </div>
                        <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                          {tool.title}
                        </h3>
                        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                          {tool.description}
                        </p>
                        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--accent-primary)' }}>
                          <span>Open tool</span>
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Quick Info */}
              <div className="mt-8 p-6 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  About Intel Centre
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Your central hub for business intelligence. Each tool provides AI-powered insights
                  tailored to your business profile, with evidence-based recommendations and actionable steps.
                </p>
              </div>
            </>
          )}

          {activeTab === 'predictions' && <PredictionsPanel />}
          {activeTab === 'narrative' && <NarrativePanel />}
          {activeTab === 'external' && <ExternalIntelFeed />}
          {activeTab === 'decisions' && <DecisionPatterns />}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default IntelCentre;
