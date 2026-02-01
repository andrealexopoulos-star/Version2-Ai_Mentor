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
    email: { connected: false, provider: null, connectedAt: null },
    calendar: { connected: false, connectedAt: null },
    crm: { connected: false, connectedAt: null },
    accounting: { connected: false, connectedAt: null },
    dataPresent: false
  });
  const [intelligenceState, setIntelligenceState] = useState({
    timeConsistency: false,
    crossSourceReinforcement: false,
    behaviouralReinforcement: false
  });

  // Fetch real integration status from Supabase with timestamps
  useEffect(() => {
    const fetchRealIntegrationStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          setIntegrationData({
            email: { connected: false, provider: null, connectedAt: null },
            calendar: { connected: false, connectedAt: null },
            crm: { connected: false, connectedAt: null },
            accounting: { connected: false, connectedAt: null },
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
        const emailConnectedAt = emailConnected ? emailRows[0].connected_at : null;
        
        // Check for CRM integration from integration_accounts
        const { data: crmRows } = await supabase
          .from('integration_accounts')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('category', 'crm');
        
        const crmConnected = crmRows && crmRows.length > 0;
        const crmConnectedAt = crmConnected ? crmRows[0].connected_at : null;
        
        // Check for Accounting integration (Xero)
        const { data: accountingRows } = await supabase
          .from('integration_accounts')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('category', 'accounting');
        
        const accountingConnected = accountingRows && accountingRows.length > 0;
        const accountingConnectedAt = accountingConnected ? accountingRows[0].connected_at : null;
        
        // Calendar check would go here (not implemented yet)
        const calendarConnected = false;
        
        // Check if we have any actual data/signal
        const hasData = emailConnected;
        
        setIntegrationData({
          email: { connected: emailConnected, provider: emailProvider, connectedAt: emailConnectedAt },
          calendar: { connected: calendarConnected, connectedAt: null },
          crm: { connected: crmConnected, connectedAt: crmConnectedAt },
          accounting: { connected: accountingConnected, connectedAt: accountingConnectedAt },
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
            narrative = "These categories become active as data sources connect. Currently no integrations are present. Signal will emerge as connections establish.";
          } else if (selectedFocus) {
            const focusArea = focusAreas.find(f => f.id === selectedFocus);
            narrative = `${focusArea?.title} noted as area of interest. Visibility is minimal without connected data. Integration depth determines what becomes observable.`;
          } else {
            narrative = "Integration layer is dormant. Patterns surface when data sources connect and activity accumulates.";
          }
          confidence = 'minimal signal';
        }
        
        // One integration connected
        else if (connectedCount === 1) {
          if (email.connected) {
            if (activeTab === 'diagnosis') {
              narrative = `${email.provider} integration active. Categories reflect language density across recent communications. Signal strength correlates with conversation volume in each domain.`;
            } else if (selectedFocus) {
              const focusArea = focusAreas.find(f => f.id === selectedFocus);
              narrative = `${focusArea?.title.toLowerCase()}—observing through email patterns. Participant dynamics and language frequency are registering. Context is still forming.`;
            } else {
              narrative = `${email.provider} active. Communication patterns are registering—participant frequency, language patterns, interaction density. Early signal is present.`;
            }
            confidence = 'early signal';
          } else if (calendar.connected) {
            if (activeTab === 'diagnosis') {
              narrative = "Calendar integration active. Time allocation patterns are visible. Email layer would add conversational context.";
            } else if (selectedFocus) {
              const focusArea = focusAreas.find(f => f.id === selectedFocus);
              narrative = `${focusArea?.title}—visible through time allocation. Commitment clusters are present. Conversational layer remains absent.`;
            } else {
              narrative = "Calendar active. Time allocation patterns show where attention concentrates. Conversational context is not yet present.";
            }
            confidence = 'partial signal';
          } else if (crm.connected) {
            if (activeTab === 'diagnosis') {
              narrative = "CRM integration active. Relationship data is present. Operational layers would deepen pattern visibility.";
            } else {
              narrative = "CRM active. Customer relationship data is present. Operational context remains limited.";
            }
            confidence = 'partial signal';
          }
        }
        
        // Multiple integrations connected
        else {
          if (activeTab === 'diagnosis') {
            narrative = "Multiple sources active. Categories reflect signal density across integrated data. Color intensity indicates pattern consistency.";
            confidence = 'signal forming';
          } else if (selectedFocus) {
            const focusArea = focusAreas.find(f => f.id === selectedFocus);
            const sources = [];
            if (email.connected) sources.push('email');
            if (calendar.connected) sources.push('calendar');
            if (crm.connected) sources.push('CRM');
            narrative = `${focusArea?.title}—cross-referencing ${sources.join(' and ')}. Patterns are aligning across sources. Consistency is becoming detectable.`;
            confidence = 'signal forming';
          } else {
            const sources = [];
            if (email.connected) sources.push('email');
            if (calendar.connected) sources.push('calendar');
            if (crm.connected) sources.push('CRM');
            narrative = `${sources.join(', ')} active. Cross-source patterns are forming. Signal density varies by domain.`;
            confidence = 'signal forming';
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
          text: "Connection interrupted. Refresh to restore.",
          confidence: 'offline',
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
                trigger={`${activeTab}-${selectedFocus}-${integrationData.email.connected}-${integrationData.calendar.connected}-${integrationData.crm.connected}`}
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
