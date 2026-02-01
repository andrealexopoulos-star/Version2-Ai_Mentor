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
          // No integrations - quiet acknowledgment
          if (activeTab === 'diagnosis') {
            narrative = "Not much to show yet. These categories measure what I can see across your email, calendar, and data. Right now, everything's grey because nothing's connected. Once you link your accounts, patterns start emerging here.";
          } else if (selectedFocus) {
            const focusArea = focusAreas.find(f => f.id === selectedFocus);
            narrative = `You've picked ${focusArea?.title.toLowerCase()}, but I can't see anything yet. Connect your email or calendar first—that's where the signal lives.`;
          } else {
            narrative = "I'm here, but I can't see much. Connect your email or calendar so I can start reading what's actually happening in your business. Until then, I'm mostly guessing.";
          }
          confidence = 'limited visibility';
        } else if (connectedCount === 1) {
          // One integration - starting to see
          if (activeTab === 'diagnosis') {
            if (integrations.email) {
              narrative = "I'm watching your email now. Some categories are lighting up based on language patterns in your recent messages. Red doesn't mean urgent—it means I'm seeing consistent signal there. Grey means nothing clear yet.";
            } else if (integrations.calendar) {
              narrative = "Your calendar's connected. I can see how time is allocated, but without email, I'm only getting half the picture. Patterns are forming around scheduling, but context is missing.";
            }
          } else if (selectedFocus) {
            const focusArea = focusAreas.find(f => f.id === selectedFocus);
            if (integrations.email) {
              narrative = `Looking at ${focusArea?.title.toLowerCase()} through your email. Starting to pick up on language, urgency, who you're talking to. Still early, but there's signal forming.`;
            } else {
              narrative = `You want to talk about ${focusArea?.title.toLowerCase()}, but I only see your calendar right now. That tells me where your time goes, not what's actually happening. Email would help.`;
            }
          } else {
            if (integrations.email) {
              narrative = "Your email's connected. I'm watching conversations, tracking who reaches out and how often. Some patterns are emerging—pick a focus area above and I'll tell you what stands out.";
            } else {
              narrative = "I see your calendar. Time allocation is starting to reveal priorities, but I need email to understand what's driving those commitments.";
            }
          }
          confidence = 'early signals';
        } else {
          // Multiple integrations - clearer picture
          if (activeTab === 'diagnosis') {
            narrative = "This view shows where signal density is highest. I'm cross-referencing your email with your calendar to detect patterns. Categories with stronger color have more consistent signal. This doesn't diagnose problems—it shows where attention is concentrated.";
            confidence = 'diagnostic view';
          } else if (selectedFocus) {
            const focusArea = focusAreas.find(f => f.id === selectedFocus);
            narrative = `${focusArea?.title} is your focus. I'm seeing patterns across both your email and calendar now. Conversations cluster around certain topics, meetings reflect those same themes. Still connecting dots, but signal's getting clearer.`;
            confidence = 'patterns forming';
          } else {
            narrative = "Email and calendar are both connected now. I'm watching how communication flows and where your time actually goes. Pick a focus area and I'll surface what's worth paying attention to.";
            confidence = 'patterns forming';
          }
        }
        
        setNarrativeState({
          text: narrative,
          confidence,
          loading: false
        });
        
      } catch (error) {
        console.error('Failed to generate narrative:', error);
        setNarrativeState({
          text: "Something's not loading. Try refreshing.",
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
              <NarrativeTypewriter 
                text={narrativeState.text}
                trigger={`${activeTab}-${selectedFocus}-${Object.values(integrations).filter(Boolean).length}`}
              />
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
