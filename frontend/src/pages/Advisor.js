import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth, supabase } from '../context/SupabaseAuthContext';
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
  const [integrationData, setIntegrationData] = useState({
    email: { connected: false, provider: null },
    calendar: { connected: false },
    crm: { connected: false },
    dataPresent: false
  });

  // Fetch real integration status from Supabase
  useEffect(() => {
    const fetchRealIntegrationStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          setIntegrationData({
            email: { connected: false, provider: null },
            calendar: { connected: false },
            crm: { connected: false },
            dataPresent: false
          });
          return;
        }
        
        // Check email connection from email_connections table
        const { data: emailRows } = await supabase
          .from('email_connections')
          .select('*')
          .eq('user_id', session.user.id);
        
        const emailConnected = emailRows && emailRows.length > 0;
        const emailProvider = emailConnected ? emailRows[0].provider : null;
        
        // Check for HubSpot/CRM integration from integration_accounts
        const { data: integrationRows } = await supabase
          .from('integration_accounts')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('category', 'crm');
        
        const crmConnected = integrationRows && integrationRows.length > 0;
        
        // Calendar check would go here (not implemented yet)
        const calendarConnected = false;
        
        // Check if we have any actual data/signal
        // This could be enhanced with actual message counts, etc.
        const hasData = emailConnected; // Basic check for now
        
        setIntegrationData({
          email: { connected: emailConnected, provider: emailProvider },
          calendar: { connected: calendarConnected },
          crm: { connected: crmConnected },
          dataPresent: hasData
        });
        
      } catch (error) {
        console.error('Failed to fetch integration status:', error);
      }
    };
    
    fetchRealIntegrationStatus();
  }, []);

  // Generate narrative based on REAL integration data
  useEffect(() => {
    const generateNarrative = async () => {
      setNarrativeState(prev => ({ ...prev, loading: true }));
      
      try {
        const { email, calendar, crm, dataPresent } = integrationData;
        const connectedCount = [email.connected, calendar.connected, crm.connected].filter(Boolean).length;
        
        let narrative = '';
        let confidence = 'limited visibility';
        
        // No integrations connected
        if (connectedCount === 0) {
          if (activeTab === 'diagnosis') {
            narrative = "These categories reflect patterns across connected data sources. Right now, I have a narrow view—no integrations are active. Once email or calendar connects, signal starts emerging.";
          } else if (selectedFocus) {
            const focusArea = focusAreas.find(f => f.id === selectedFocus);
            narrative = `${focusArea?.title} is your focus. Without connected data, I'm operating with limited context. Email or calendar would give me visibility into what's actually happening.`;
          } else {
            narrative = "Right now I have a narrow view. Connect email or calendar and I'll start identifying patterns in how your business operates day to day.";
          }
          confidence = 'limited visibility';
        }
        
        // One integration connected
        else if (connectedCount === 1) {
          if (email.connected) {
            if (activeTab === 'diagnosis') {
              narrative = `Email is connected (${email.provider}). Categories are reflecting language patterns across recent communications. Stronger signal appears where conversation density is highest.`;
            } else if (selectedFocus) {
              const focusArea = focusAreas.find(f => f.id === selectedFocus);
              narrative = `Looking at ${focusArea?.title.toLowerCase()} through email. I'm observing communication patterns—who's involved, language used, frequency. Still building context.`;
            } else {
              narrative = "Email is connected. I'm observing communication patterns—tracking participants, frequency, language. Pick a focus area and I'll surface what's registering.";
            }
            confidence = 'early signals';
          } else if (calendar.connected) {
            if (activeTab === 'diagnosis') {
              narrative = "Calendar is connected. Time allocation patterns are visible, but without email, I'm missing conversational context that would strengthen signal confidence.";
            } else if (selectedFocus) {
              const focusArea = focusAreas.find(f => f.id === selectedFocus);
              narrative = `${focusArea?.title} selected. Calendar shows how time clusters, but email would reveal what's driving those commitments.`;
            } else {
              narrative = "Calendar is connected. Time allocation reveals where attention concentrates. Email would add conversational layer to complete the picture.";
            }
            confidence = 'partial visibility';
          } else if (crm.connected) {
            if (activeTab === 'diagnosis') {
              narrative = "CRM integration is active. Customer relationship data is visible, though email and calendar would strengthen pattern detection.";
            } else {
              narrative = "CRM is connected. Relationship data is present. Email or calendar would add operational context.";
            }
            confidence = 'partial visibility';
          }
        }
        
        // Multiple integrations connected
        else {
          if (activeTab === 'diagnosis') {
            narrative = "Multiple data sources connected. Categories show where signal density is highest across communications, time allocation, and relationships. Stronger color means more consistent pattern.";
            confidence = 'patterns forming';
          } else if (selectedFocus) {
            const focusArea = focusAreas.find(f => f.id === selectedFocus);
            narrative = `${focusArea?.title} is the focus. Cross-referencing email with ${calendar.connected ? 'calendar' : 'CRM data'}—conversations and commitments are starting to align in detectable ways.`;
            confidence = 'patterns forming';
          } else {
            const sources = [];
            if (email.connected) sources.push('email');
            if (calendar.connected) sources.push('calendar');
            if (crm.connected) sources.push('CRM');
            narrative = `${sources.join(' and ')} connected. Signal is cross-referencing across sources. Select a focus area to see what's emerging.`;
            confidence = 'patterns forming';
          }
        }
        
        setNarrativeState({
          text: narrative,
          confidence,
          loading: false
        });
        
      } catch (error) {
        console.error('Narrative generation failed:', error);
        setNarrativeState({
          text: "Unable to load current state. Refresh to reconnect.",
          confidence: 'connection issue',
          loading: false
        });
      }
    };
    
    generateNarrative();
  }, [integrationData, selectedFocus, activeTab]);

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
