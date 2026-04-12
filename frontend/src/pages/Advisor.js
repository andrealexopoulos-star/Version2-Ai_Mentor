import { CognitiveMesh } from '../components/LoadingSystems';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth, supabase } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import {
  TrendingUp, DollarSign, Zap, Users, Target,
  RefreshCw, AlertTriangle, ArrowRight, MessageSquare,
  Activity, CheckCircle2, Clock, Calendar
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { DailyBriefCard } from '../components/DailyBriefCard';
import { fontFamily } from '../design-system/tokens';
import { extractEmailEvidence, extractCalendarEvidence, extractCRMEvidence, generateFastInsight } from '../lib/fastEvidence';

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
    calendar: { connected: false },
    crm: { connected: false },
    accounting: { connected: false },
    hasData: false
  });

  // Missing state declarations (were referenced but never declared)
  const [selectedFocus, setSelectedFocus] = useState(null);
  const [activeTab, setActiveTab] = useState('focus');
  const [intelligenceState, setIntelligenceState] = useState({});
  const [narrativeState, setNarrativeState] = useState({ text: '', confidence: 'minimal signal', loading: true });
  const [fastInsights, setFastInsights] = useState([]);
  const [signalFilter, setSignalFilter] = useState('all');

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

  /* Greeting time */
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  /* Connected count for KPI */
  const connectedCount = [
    integrationData.email?.connected,
    integrationData.calendar?.connected,
    integrationData.crm?.connected,
    integrationData.accounting?.connected
  ].filter(Boolean).length;

  /* Filter pills */
  const filters = ['All', 'Critical', 'Money', 'People'];

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Greeting Header ── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.08em] mb-2" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }}>
              — {dateStr} · {timeStr}
            </div>
            <h1 className="font-medium" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', fontSize: 'clamp(2rem, 4vw, 2.8rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
              {greeting}, <em style={{ fontStyle: 'italic', color: '#E85D00' }}>{firstName}</em>.
            </h1>
            <p className="mt-2 text-base" style={{ fontFamily: fontFamily.body, color: '#8FA0B8' }}>
              {narrativeState.loading
                ? 'Reading the signals...'
                : narrativeState.text || "Your business intelligence is warming up."
              }
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.15)', color: '#8FA0B8', fontFamily: fontFamily.body, cursor: 'pointer' }}
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button
              onClick={() => navigate('/alerts')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: '#E85D00', color: 'white', fontFamily: fontFamily.body, border: 'none', cursor: 'pointer' }}
            >
              Open Alert Centre <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Open signals', value: watchtowerEvents.length || '—', delta: null, color: '#E85D00' },
            { label: 'Sources connected', value: connectedCount, delta: `${4 - connectedCount} remaining`, color: connectedCount >= 2 ? '#10B981' : '#F59E0B' },
            { label: 'Intelligence level', value: narrativeState.confidence || 'minimal', delta: null, color: '#E85D00', isText: true },
            { label: 'Focus area', value: selectedFocus ? focusAreas.find(f => f.id === selectedFocus)?.title || '—' : 'Not set', delta: null, color: '#8FA0B8', isText: true },
          ].map((kpi, i) => (
            <div key={i} className="p-5 rounded-xl" style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.15)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: '#708499' }}>{kpi.label}</span>
                {kpi.color === '#E85D00' && <span className="w-2 h-2 rounded-full" style={{ background: '#E85D00', boxShadow: '0 0 8px #E85D00' }} />}
              </div>
              <div className={kpi.isText ? 'text-sm font-semibold capitalize' : 'text-3xl font-medium'} style={{ fontFamily: fontFamily.display, color: '#EDF1F7', lineHeight: 1 }}>
                {kpi.value}
              </div>
              {kpi.delta && (
                <div className="text-xs mt-2" style={{ fontFamily: fontFamily.mono, color: '#708499' }}>{kpi.delta}</div>
              )}
            </div>
          ))}
        </div>

        {/* ── Daily Brief Card ── */}
        <DailyBriefCard />

        {/* ── 2-Column Grid ── */}
        <style>{`.advisor-grid { display: grid; grid-template-columns: 1fr; gap: 24px; } @media (min-width: 1180px) { .advisor-grid { grid-template-columns: 2fr 1fr; } }`}</style>
        <div className="advisor-grid">

          {/* LEFT: Signal Feed / Focus Areas */}
          <div className="rounded-xl overflow-hidden" style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.15)' }}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(140,170,210,0.15)' }}>
              <div>
                <div className="text-[10px] uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: '#708499' }}>— Live signal feed</div>
                <h3 className="text-2xl font-medium mt-1" style={{ fontFamily: fontFamily.display, color: '#EDF1F7', letterSpacing: '-0.02em' }}>What changed overnight</h3>
              </div>
              <div className="flex gap-2">
                {filters.map((f) => (
                  <button
                    key={f}
                    onClick={() => setSignalFilter(f.toLowerCase())}
                    className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.08em] transition-all"
                    style={{
                      fontFamily: fontFamily.mono,
                      background: signalFilter === f.toLowerCase() ? '#E85D00' : '#121D30',
                      color: signalFilter === f.toLowerCase() ? 'white' : '#8FA0B8',
                      border: `1px solid ${signalFilter === f.toLowerCase() ? '#E85D00' : 'rgba(140,170,210,0.15)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Signal rows from watchtower events */}
            <div className="flex flex-col">
              {watchtowerEvents.length > 0 ? watchtowerEvents.slice(0, 6).map((evt, i) => (
                <div key={evt.id || i} className="grid gap-4 p-5 cursor-pointer transition-colors hover:bg-[#121D30]" style={{ gridTemplateColumns: '44px 1fr auto', borderBottom: i < Math.min(watchtowerEvents.length, 6) - 1 ? '1px solid rgba(140,170,210,0.15)' : 'none', alignItems: 'flex-start' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: evt.severity === 'critical' ? 'rgba(239,68,68,0.12)' : evt.severity === 'high' ? 'rgba(232,93,0,0.12)' : 'rgba(245,158,11,0.12)', color: evt.severity === 'critical' ? '#EF4444' : evt.severity === 'high' ? '#E85D00' : '#F59E0B' }}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] mb-1" style={{ fontFamily: fontFamily.mono, color: '#708499' }}>
                      {evt.severity?.toUpperCase() || 'INFO'}
                      <span className="w-[3px] h-[3px] rounded-full" style={{ background: '#708499' }} />
                      {evt.domain || 'General'}
                    </div>
                    <div className="text-sm font-semibold leading-tight" style={{ color: '#EDF1F7' }}>{evt.title || evt.summary || 'Signal detected'}</div>
                    {evt.description && <div className="text-[13px] mt-1 leading-relaxed" style={{ color: '#8FA0B8' }}>{evt.description}</div>}
                  </div>
                  <div className="text-[11px] shrink-0" style={{ fontFamily: fontFamily.mono, color: '#708499' }}>{evt.time_ago || ''}</div>
                </div>
              )) : (
                <div className="p-10 text-center">
                  <Activity className="w-8 h-8 mx-auto mb-3" style={{ color: '#708499' }} />
                  <p className="text-sm font-medium" style={{ color: '#EDF1F7', fontFamily: fontFamily.body }}>No signals yet</p>
                  <p className="text-xs mt-1" style={{ color: '#708499', fontFamily: fontFamily.body }}>Connect your inbox and CRM to start surfacing business intelligence.</p>
                  <button onClick={() => navigate('/connect-email')} className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: '#E85D00', color: 'white', border: 'none', cursor: 'pointer', fontFamily: fontFamily.body }}>
                    Connect inbox <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Quick Actions + Sources */}
          <div className="flex flex-col gap-5">
            {/* Focus area quick-select */}
            <div className="rounded-xl p-5" style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.15)' }}>
              <div className="text-[10px] uppercase tracking-[0.08em] mb-3" style={{ fontFamily: fontFamily.mono, color: '#708499' }}>— Focus area</div>
              <div className="grid grid-cols-2 gap-3">
                {focusAreas.map((area) => {
                  const Icon = area.icon;
                  const isSelected = selectedFocus === area.id;
                  return (
                    <button
                      key={area.id}
                      onClick={() => handleFocusSelect(area.id)}
                      className="flex flex-col gap-2 p-4 rounded-lg text-left transition-all"
                      style={{
                        background: isSelected ? 'rgba(232,93,0,0.08)' : '#121D30',
                        border: `1px solid ${isSelected ? '#E85D00' : 'rgba(140,170,210,0.15)'}`,
                        cursor: 'pointer',
                      }}
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: isSelected ? '#E85D00' : 'rgba(232,93,0,0.12)', color: isSelected ? 'white' : '#E85D00' }}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="text-xs font-semibold" style={{ color: '#EDF1F7' }}>{area.title}</div>
                      <div className="text-[11px] leading-tight" style={{ color: '#708499' }}>{area.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Integration status */}
            <div className="rounded-xl p-5" style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.15)' }}>
              <div className="text-[10px] uppercase tracking-[0.08em] mb-4" style={{ fontFamily: fontFamily.mono, color: '#708499' }}>— Connected sources</div>
              <div className="flex flex-col gap-3">
                {sourceCards.map((card) => (
                  <div key={card.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: card.connected ? '#10B981' : '#475569' }} />
                      <span className="text-sm" style={{ color: '#EDF1F7', fontFamily: fontFamily.body }}>{card.label}</span>
                    </div>
                    <span className="text-xs" style={{ color: card.connected ? '#10B981' : '#708499', fontFamily: fontFamily.mono }}>
                      {card.connected ? 'Live' : 'Not connected'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Advisor;
