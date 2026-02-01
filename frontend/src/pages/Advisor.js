import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { Button } from '../components/ui/button';
import { apiClient } from '../lib/api';
import { 
  TrendingUp, DollarSign, Zap, Users, Target,
  RefreshCw, Loader2
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import Diagnosis from '../pages/Diagnosis';
import NarrativeTypewriter from '../components/NarrativeTypewriter';

const focusAreas = [
  {
    id: 'growth',
    title: 'Growth & Strategy',
    icon: TrendingUp,
    color: '#0066FF',
    description: 'Scale your business, find new opportunities'
  },
  {
    id: 'operations',
    title: 'Operations',
    icon: Zap,
    color: '#00C853',
    description: 'Improve efficiency, streamline processes'
  },
  {
    id: 'financial',
    title: 'Financial',
    icon: DollarSign,
    color: '#FF9500',
    description: 'Cash flow, pricing, profitability'
  },
  {
    id: 'marketing',
    title: 'Marketing & Sales',
    icon: Target,
    color: '#7C3AED',
    description: 'Win clients, improve conversion'
  },
  {
    id: 'team',
    title: 'Team & Leadership',
    icon: Users,
    color: '#EC4899',
    description: 'Hiring, culture, delegation'
  }
];

const Advisor = () => {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('focus'); // 'focus' or 'diagnosis'
  const [selectedFocus, setSelectedFocus] = useState(null);
  const [narrativeState, setNarrativeState] = useState({
    text: '',
    confidence: 'early signals',
    loading: true
  });
  const [integrations, setIntegrations] = useState({
    email: false,
    calendar: false,
    crm: false
  });

  // Fetch integrations status
  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        const response = await apiClient.get('/integrations/status');
        setIntegrations(response.data || {});
      } catch (error) {
        console.error('Failed to fetch integrations:', error);
      }
    };
    
    fetchIntegrations();
  }, []);

  // Generate narrative based on context
  useEffect(() => {
    const generateNarrative = async () => {
      setNarrativeState(prev => ({ ...prev, loading: true }));
      
      try {
        // Determine narrative based on integrations and selected focus
        const connectedCount = Object.values(integrations).filter(Boolean).length;
        
        let narrative = '';
        let confidence = 'early signals';
        
        if (connectedCount === 0) {
          // No integrations
          narrative = "I'm listening, but I can't see much yet. Connect your email or calendar so I can start picking up patterns in how your business actually operates. The more I see, the clearer the picture becomes.";
          confidence = 'early signals';
        } else if (connectedCount === 1) {
          // One integration
          if (integrations.email) {
            narrative = "I'm watching your email flow. Starting to see some patterns in how you communicate and where pressure points might be building. Still early, but there's signal emerging.";
          } else if (integrations.calendar) {
            narrative = "I can see your calendar. Beginning to understand how you allocate time and where commitments cluster. Early indicators forming.";
          }
          confidence = 'early signals';
        } else if (connectedCount >= 2) {
          // Multiple integrations
          if (selectedFocus) {
            const focusArea = focusAreas.find(f => f.id === selectedFocus);
            narrative = `Looking at ${focusArea?.title.toLowerCase() || 'your focus area'}. The signals are starting to connect across your email and calendar. I'm seeing patterns that matter, but I need more context to be specific. What's changed recently that brought you here?`;
            confidence = 'patterns forming';
          } else {
            narrative = "I'm connecting what I see in your email with how your time is structured. Patterns are emerging. Pick a focus area below and I'll tell you what stands out.";
            confidence = 'patterns forming';
          }
        }
        
        // If diagnosis tab is active, adjust narrative
        if (activeTab === 'diagnosis') {
          narrative = "This is what I can measure right now. These categories light up based on signals in your communications, calendar, and connected data. Red means I'm seeing something that needs attention. Green means stability. Grey means I don't have enough signal yet.";
          confidence = 'diagnostic view';
        }
        
        setNarrativeState({
          text: narrative,
          confidence,
          loading: false
        });
        
      } catch (error) {
        console.error('Failed to generate narrative:', error);
        setNarrativeState({
          text: "Something's not loading properly. Try refreshing the page.",
          confidence: 'connection issue',
          loading: false
        });
      }
    };
    
    generateNarrative();
  }, [integrations, selectedFocus, activeTab]);

  const handleFocusSelect = (focusId) => {
    setSelectedFocus(focusId);
    // Narrative will update via useEffect
  };

  const handleRefresh = () => {
    setNarrativeState(prev => ({ ...prev, loading: true }));
    setSelectedFocus(null);
    // Trigger re-fetch
    window.location.reload();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif" style={{ color: 'var(--text-primary)' }}>
              BIQC Insights
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              What BIQC understands about your business right now
            </p>
          </div>
          <Button 
            onClick={handleRefresh}
            variant="outline"
            className="btn-secondary"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* PRIMARY NARRATIVE TEXT AREA */}
        <div 
          className="p-6 rounded-xl border"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-light)',
            minHeight: '120px'
          }}
        >
          {narrativeState.loading ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
              <p className="text-base" style={{ color: 'var(--text-muted)' }}>
                Reading the signals...
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p 
                className="text-base leading-relaxed font-serif"
                style={{ 
                  color: 'var(--text-primary)',
                  fontFamily: 'Georgia, Cambria, "Times New Roman", serif'
                }}
              >
                {narrativeState.text}
              </p>
              <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {narrativeState.confidence}
              </p>
            </div>
          )}
        </div>

        {/* TABS */}
        <div className="border-b" style={{ borderColor: 'var(--border-light)' }}>
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('focus')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'focus'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              What would you like to work on?
            </button>
            <button
              onClick={() => setActiveTab('diagnosis')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'diagnosis'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Diagnosis
            </button>
          </div>
        </div>

        {/* TAB CONTENT */}
        {activeTab === 'focus' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {focusAreas.map((area) => {
              const Icon = area.icon;
              const isSelected = selectedFocus === area.id;
              
              return (
                <button
                  key={area.id}
                  onClick={() => handleFocusSelect(area.id)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:shadow-md'
                  }`}
                  style={{
                    borderColor: isSelected ? '#0066FF' : 'var(--border-light)',
                    background: isSelected ? 'rgba(0, 102, 255, 0.03)' : 'var(--bg-card)'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${area.color}15` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: area.color }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                        {area.title}
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {area.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {activeTab === 'diagnosis' && (
          <div>
            <Diagnosis embedded={true} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Advisor;
