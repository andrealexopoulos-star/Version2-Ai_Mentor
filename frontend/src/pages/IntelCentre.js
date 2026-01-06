import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Target, Stethoscope, BarChart3, TrendingUp, ArrowRight } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';

const IntelCentre = () => {
  const navigate = useNavigate();

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

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} />
              <span className="badge badge-primary">Intelligence Hub</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-serif mb-2" style={{ color: 'var(--text-primary)' }}>
              Intel Centre
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Business intelligence, diagnostics, and market insights powered by AI
            </p>
          </div>

          {/* Tool Cards */}
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
        </div>
      </div>
    </DashboardLayout>
  );
};

export default IntelCentre;
