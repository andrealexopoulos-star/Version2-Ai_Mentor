import { CognitiveMesh } from '../components/LoadingSystems';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth, supabase } from '../context/SupabaseAuthContext';
import { Button } from '../components/ui/button';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import { 
  TrendingUp, DollarSign, Zap, Users, Target,
  RefreshCw, Loader2, Eye, AlertCircle
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import WatchtowerEvent from '../components/WatchtowerEvent';

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
  
  // Watchtower state
  const [watchtowerEvents, setWatchtowerEvents] = useState([]);
  const [loadingWatchtower, setLoadingWatchtower] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  
  // Integration state
  const [integrationData, setIntegrationData] = useState({
    email: { connected: false, provider: null },
    hasData: false
  });

  // Detect intelligence thresholds using existing data
  useEffect(() => {
    const detectThresholds = () => {
      const thresholds = {
        timeConsistency: false,
        crossSourceReinforcement: false,
        behaviouralReinforcement: false
      };
      
      // THRESHOLD 1: TIME CONSISTENCY
      // Check if integrations have been connected for meaningful duration
      const now = new Date();
      const oneDayMs = 24 * 60 * 60 * 1000;
      
      const integrationAges = [
        integrationData.email.connectedAt,
        integrationData.crm.connectedAt,
        integrationData.accounting.connectedAt,
        integrationData.calendar.connectedAt
      ].filter(Boolean);
      
      if (integrationAges.length > 0) {
        const oldestConnection = new Date(Math.min(...integrationAges.map(d => new Date(d).getTime())));
        const ageMs = now - oldestConnection;
        
        // Time consistency threshold: integration active for > 24 hours
        if (ageMs > oneDayMs) {
          thresholds.timeConsistency = true;
        }
      }
      
      // THRESHOLD 2: CROSS-SOURCE REINFORCEMENT
      // Detect when 2+ sources are connected
      const connectedSources = [
        integrationData.email.connected,
        integrationData.calendar.connected,
        integrationData.crm.connected,
        integrationData.accounting.connected
      ].filter(Boolean).length;
      
      if (connectedSources >= 2) {
        thresholds.crossSourceReinforcement = true;
      }
      
      // THRESHOLD 3: BEHAVIOURAL REINFORCEMENT
      if (selectedFocus) {
        const focusCount = focusHistory.filter(f => f.area === selectedFocus).length;
        
        if (focusCount >= 2) {
          thresholds.behaviouralReinforcement = true;
        }
      }
      
      setIntelligenceState(thresholds);
    };
    
    detectThresholds();
  }, [integrationData, selectedFocus]);
  
  // Track focus area selections for behavioural reinforcement (in-memory only)
  const [focusHistory, setFocusHistory] = useState([]);
  useEffect(() => {
    if (selectedFocus) {
      setFocusHistory(prev => {
        const updated = [...prev, { area: selectedFocus, timestamp: new Date().toISOString() }];
        return updated.slice(-50);
      });
    }
  }, [selectedFocus]);

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
        
        // Calendar is considered connected when Outlook/Gmail is connected.
        // This reflects current product behavior where calendar intelligence
        // rides on the same OAuth provider connection.
        const calendarConnected = emailConnected && (emailProvider === 'outlook' || emailProvider === 'gmail');
        const calendarConnectedAt = calendarConnected ? emailConnectedAt : null;
        
        // Check if we have any actual data/signal
        const hasData = emailConnected;
        
        setIntegrationData({
          email: { connected: emailConnected, provider: emailProvider, connectedAt: emailConnectedAt },
          calendar: { connected: calendarConnected, connectedAt: calendarConnectedAt },
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
  
  // Extract fast evidence from connected sources (Track A)
  useEffect(() => {
    const extractFastEvidence = async () => {
      // Only run if integrations are connected
      if (!integrationData.email.connected && !integrationData.calendar.connected && !integrationData.crm.connected) {
        setFastInsights([]);
        return;
      }
      
      try {
        // Extract evidence from each connected source
        const emailEvidence = integrationData.email.connected 
          ? await extractEmailEvidence(apiClient) 
          : null;
        
        const calendarEvidence = integrationData.calendar.connected 
          ? await extractCalendarEvidence(apiClient) 
          : null;
        
        const crmEvidence = integrationData.crm.connected 
          ? await extractCRMEvidence(apiClient) 
          : null;
        
        // Generate provisional insights
        const insights = generateFastInsight(
          emailEvidence, 
          calendarEvidence, 
          crmEvidence,
          selectedFocus
        );
        
        setFastInsights(insights || []);
        
        // Developer-only evidence trace exposure
        if (process.env.NODE_ENV !== 'production' && insights && insights.length > 0) {
          window.__BIQC_EVIDENCE_TRACE__ = {
            timestamp: new Date().toISOString(),
            insights: insights,
            raw_evidence: {
              email: emailEvidence ? {
                total_threads: emailEvidence.totalThreads,
                unresolved_count: emailEvidence.unresolvedCount,
                recurring_topic_count: Object.keys(emailEvidence.recurringTopics).length
              } : null,
              calendar: calendarEvidence ? {
                total_meetings: calendarEvidence.totalMeetings,
                avg_duration: calendarEvidence.avgDuration,
                fragmentation: calendarEvidence.fragmentationScore
              } : null,
              crm: crmEvidence ? {
                total_deals: crmEvidence.totalDeals,
                stalled: crmEvidence.stalledCount,
                active: crmEvidence.activeCount
              } : null
            }
          };
          // console.debug('🔍 [BIQC DEV] Track A evidence trace available at window.__BIQC_EVIDENCE_TRACE__');
        }
        
      } catch (error) {
        console.error('Fast evidence extraction failed:', error);
        setFastInsights([]);
      }
    };
    
    extractFastEvidence();
  }, [integrationData, selectedFocus]);

  // Generate narrative based on REAL integration data and intelligence thresholds
  useEffect(() => {
    const generateNarrative = async () => {
      setNarrativeState(prev => ({ ...prev, loading: true }));
      
      try {
        const { email, calendar, crm, accounting, dataPresent } = integrationData;
        const { timeConsistency, crossSourceReinforcement, behaviouralReinforcement } = intelligenceState;
        const connectedCount = [email.connected, calendar.connected, crm.connected, accounting.connected].filter(Boolean).length;
        
        let narrative = '';
        let confidence = 'minimal signal';
        
        // No integrations connected
        if (connectedCount === 0) {
          if (activeTab === 'diagnosis') {
            narrative = "Nothing here yet. These areas light up when there's enough activity to form a view.";
          } else if (selectedFocus) {
            const focusArea = focusAreas.find(f => f.id === selectedFocus);
            narrative = `${focusArea?.title} noted. Not enough happening yet to say anything meaningful about it.`;
          } else {
            narrative = "There isn't enough activity here yet for anything meaningful to take shape.";
          }
          confidence = 'minimal signal';
        }
        
        // One integration connected
        else if (connectedCount === 1) {
          if (email.connected) {
            if (activeTab === 'diagnosis') {
              if (timeConsistency) {
                narrative = `${email.provider} has been connected for a while now. The way conversations are happening is becoming more consistent over time.`;
                confidence = 'pattern stabilising';
              } else {
                narrative = `${email.provider} just connected. Early days—watching how conversations flow and who's involved.`;
                confidence = 'early signal';
              }
            } else if (selectedFocus) {
              const focusArea = focusAreas.find(f => f.id === selectedFocus);
              if (behaviouralReinforcement) {
                narrative = `${focusArea?.title.toLowerCase()}—you keep coming back to this. Conversations around it are starting to show a consistent shape.`;
                confidence = 'pattern stabilising';
              } else {
                narrative = `${focusArea?.title.toLowerCase()}. Too early to say much, but watching how this topic surfaces in your communications.`;
                confidence = 'early signal';
              }
            } else {
              if (timeConsistency) {
                // Add fast insight if available
                if (fastInsights.length > 0) {
                  const insightText = typeof fastInsights[0] === 'string' ? fastInsights[0] : fastInsights[0].text;
                  narrative = `${email.provider} connected. ${insightText}`;
                } else {
                  narrative = `${email.provider} connected. The way you communicate with people is starting to settle into a recognisable rhythm.`;
                }
                confidence = 'pattern stabilising';
              } else {
                narrative = `${email.provider} connected. Early days—watching conversations, frequency, who reaches out.`;
                confidence = 'early signal';
              }
            }
          } else if (calendar.connected) {
            if (activeTab === 'diagnosis') {
              narrative = "Calendar connected. Where time goes is visible, but there's no conversational layer yet.";
            } else if (selectedFocus) {
              const focusArea = focusAreas.find(f => f.id === selectedFocus);
              narrative = `${focusArea?.title}. Calendar shows where your time concentrates, but the why isn't visible yet.`;
            } else {
              narrative = "Calendar connected. Time allocation is visible. What's driving those commitments isn't.";
            }
            confidence = 'partial signal';
          } else if (crm.connected) {
            if (activeTab === 'diagnosis') {
              narrative = "CRM connected. Customer relationships are visible. Operational detail would add depth.";
            } else {
              narrative = "CRM connected. Relationship layer is present. Operational layer is missing.";
            }
            confidence = 'partial signal';
          } else if (accounting.connected) {
            if (activeTab === 'diagnosis') {
              narrative = "Accounting connected. Financial movements are visible. Email or CRM would show what's behind them.";
            } else {
              narrative = "Accounting connected. Money flow is visible. Operational context isn't.";
            }
            confidence = 'partial signal';
          }
        }
        
        // Multiple integrations connected - check for cross-source reinforcement
        else {
          if (activeTab === 'diagnosis') {
            if (crossSourceReinforcement && timeConsistency) {
              narrative = "Several connections active over time. What's showing up in one area is starting to appear in others. This is no longer isolated.";
              confidence = 'intelligence forming';
            } else if (crossSourceReinforcement) {
              narrative = "Multiple connections present. Where things cluster across different areas is becoming visible.";
              confidence = 'signal forming';
            } else {
              narrative = "Multiple connections present. Where things cluster across different areas is becoming visible.";
              confidence = 'signal forming';
            }
          } else if (selectedFocus) {
            const focusArea = focusAreas.find(f => f.id === selectedFocus);
            const sources = [];
            if (email.connected) sources.push('email');
            if (calendar.connected) sources.push('calendar');
            if (crm.connected) sources.push('customer relationships');
            if (accounting.connected) sources.push('financials');
            
            if (behaviouralReinforcement && crossSourceReinforcement) {
              // Add fast insight if available
              if (fastInsights.length > 0) {
                const insightText = typeof fastInsights[0] === 'string' ? fastInsights[0] : fastInsights[0].text;
                narrative = `${focusArea?.title}—you keep returning here. ${insightText} This is no longer isolated.`;
              } else {
                narrative = `${focusArea?.title}—you keep returning here. What's showing up across ${sources.join(' and ')} is starting to align. This is no longer isolated.`;
              }
              confidence = 'intelligence forming';
            } else if (crossSourceReinforcement) {
              narrative = `${focusArea?.title}. Looking across ${sources.join(' and ')}—things are starting to line up in ways worth noticing.`;
              confidence = 'signal forming';
            } else {
              narrative = `${focusArea?.title}. Looking across ${sources.join(' and ')}—things are starting to line up in ways worth noticing.`;
              confidence = 'signal forming';
            }
          } else {
            const sources = [];
            if (email.connected) sources.push('email');
            if (calendar.connected) sources.push('calendar');
            if (crm.connected) sources.push('relationships');
            if (accounting.connected) sources.push('financials');
            
            if (crossSourceReinforcement && timeConsistency) {
              narrative = `${sources.join(', ')} connected over time. What's happening in one area is showing up in others. Consistency is starting to settle.`;
              confidence = 'intelligence forming';
            } else {
              narrative = `${sources.join(', ')} connected. Where these overlap is becoming clearer.`;
              confidence = 'signal forming';
            }
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
  }, [integrationData, selectedFocus, activeTab, intelligenceState]);

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

  const sourceCards = [
    {
      key: 'email',
      label: 'Email',
      connected: integrationData.email?.connected,
      detail: integrationData.email?.connected ? (integrationData.email?.provider || 'Connected') : 'Not connected',
    },
    {
      key: 'calendar',
      label: 'Calendar',
      connected: integrationData.calendar?.connected,
      detail: integrationData.calendar?.connected ? 'Connected via provider' : 'Not connected',
    },
    {
      key: 'crm',
      label: 'CRM',
      connected: integrationData.crm?.connected,
      detail: integrationData.crm?.connected ? 'Connected' : 'Not connected',
    },
    {
      key: 'accounting',
      label: 'Accounting',
      connected: integrationData.accounting?.connected,
      detail: integrationData.accounting?.connected ? 'Connected' : 'Not connected',
    },
  ];

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

        {/* Connector visibility strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {sourceCards.map((card) => (
            <div
              key={card.key}
              className="p-3 rounded-xl border"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-light)',
              }}
            >
              <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {card.label}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className="inline-flex w-2 h-2 rounded-full"
                  style={{ background: card.connected ? '#10B981' : '#64748B' }}
                />
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {card.connected ? 'Connected' : 'Disconnected'}
                </p>
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {card.detail}
              </p>
            </div>
          ))}
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
              <CognitiveMesh compact />
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
