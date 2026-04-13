import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuth, supabase } from '../context/SupabaseAuthContext';
import { apiClient } from '../lib/api';
import { toast } from 'sonner';
import {
  TrendingUp, DollarSign, Zap, Users, Target,
  RefreshCw, AlertTriangle, ArrowRight, MessageSquare,
  Activity, CheckCircle2, Clock, Calendar,
  Mail, CheckSquare, Puzzle
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
// DailyBriefCard component replaced by inline brief matching approved mockup
// ProactiveAlerts and PredictionsPanel removed — not in approved mockup
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

  // Activity timeline state
  const [activityItems, setActivityItems] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // Fetch activity timeline from notifications/alerts
  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await apiClient.get('/notifications/alerts');
        const items = (res.data?.notifications || res.data || []).slice(0, 6);
        setActivityItems(items);
      } catch {
        setActivityItems([]);
      } finally {
        setActivityLoading(false);
      }
    };
    fetchActivity();
  }, []);

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
              style={{ background: '#0E1628', border: '1px solid rgba(140,170,210,0.12)', color: '#8FA0B8', fontFamily: fontFamily.body, cursor: 'pointer' }}
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
            { label: 'Open signals', value: watchtowerEvents.length || '—', delta: '▲ 3', deltaContext: 'vs yesterday', deltaType: 'neg', color: '#E85D00', sparkColor: '#E85D00', sparkPath: '0,22 10,18 20,20 30,15 40,17 50,10 60,12 70,8 80,11 90,5 100,8', showDot: true },
            { label: 'Pipeline at risk', value: '$48,200', delta: '▲ $12.4k', deltaContext: 'since Monday', deltaType: 'neg', color: '#DC2626', sparkColor: '#DC2626', sparkPath: '0,25 10,22 20,24 30,18 40,20 50,15 60,12 70,10 80,8 90,6 100,4', showDot: false },
            { label: 'Cash runway', value: '6.4', valueSuffix: 'mo', delta: '— 0.1 mo', deltaContext: '30-day average', deltaType: 'neutral', color: '#10B981', sparkColor: 'var(--positive, #16A34A)', sparkPath: '0,12 10,14 20,11 30,13 40,12 50,14 60,11 70,13 80,12 90,14 100,12', showDot: false },
            { label: 'Inbox decisions', value: '7', delta: '▼ 4', deltaContext: 'actioned this week', deltaType: 'pos', color: '#10B981', sparkColor: 'var(--positive, #16A34A)', sparkPath: '0,8 10,10 20,12 30,9 40,14 50,11 60,16 70,13 80,18 90,15 100,20', showDot: false },
          ].map((kpi, i) => (
            <div key={i} className="p-5 rounded-xl" style={{ background: 'var(--surface, #0E1628)', border: '1px solid var(--border, rgba(140,170,210,0.12))' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-muted, #708499)' }}>{kpi.label}</span>
                  {kpi.showDot && <span className="w-2 h-2 rounded-full" style={{ background: kpi.color, boxShadow: `0 0 8px ${kpi.color}` }} />}
                </div>
              </div>
              <div className="text-3xl font-medium" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)', lineHeight: 1 }}>
                {kpi.value}{kpi.valueSuffix && <span style={{ fontSize: '0.5em', color: 'var(--ink-secondary, #8FA0B8)' }}>{kpi.valueSuffix}</span>}
              </div>
              <div className="text-[11px] mt-2.5 flex items-center gap-1.5" style={{ fontFamily: fontFamily.mono }}>
                <span style={{ color: kpi.deltaType === 'neg' ? kpi.color : kpi.deltaType === 'pos' ? '#10B981' : 'var(--ink-muted, #708499)', fontWeight: 600 }}>{kpi.delta}</span>
                <span style={{ color: 'var(--ink-muted, #708499)' }}>{kpi.deltaContext}</span>
              </div>
              <svg className="w-full mt-3" viewBox="0 0 100 30" preserveAspectRatio="none" style={{ height: 30 }}>
                <polyline points={kpi.sparkPath} stroke={kpi.sparkColor} strokeWidth="1.5" fill="none" />
              </svg>
            </div>
          ))}
        </div>

        {/* ── 2-Column Grid ── */}
        <style>{`.advisor-grid { display: grid; grid-template-columns: 1fr; gap: 24px; } @media (min-width: 1180px) { .advisor-grid { grid-template-columns: 2fr 1fr; } }`}</style>
        <div className="advisor-grid">

          {/* LEFT: Signal Feed */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface, #0E1628)', border: '1px solid var(--border, rgba(140,170,210,0.12))' }}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--border, rgba(140,170,210,0.12))' }}>
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
                      border: `1px solid ${signalFilter === f.toLowerCase() ? '#E85D00' : 'rgba(140,170,210,0.12)'}`,
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
                <div key={evt.id || i} className="grid gap-4 p-5 cursor-pointer transition-colors hover:bg-[#121D30]" style={{ gridTemplateColumns: '44px 1fr auto', borderBottom: i < Math.min(watchtowerEvents.length, 6) - 1 ? '1px solid rgba(140,170,210,0.12)' : 'none', alignItems: 'flex-start' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{
                    background: evt.severity === 'critical' ? 'var(--danger-wash, rgba(239,68,68,0.10))' : evt.severity === 'high' ? 'var(--lava-wash, rgba(232,93,0,0.12))' : evt.severity === 'warn' || evt.severity === 'warning' ? 'var(--warning-wash, rgba(245,158,11,0.10))' : 'var(--info-wash, rgba(59,130,246,0.10))',
                    color: evt.severity === 'critical' ? 'var(--danger, #DC2626)' : evt.severity === 'high' ? 'var(--lava, #E85D00)' : evt.severity === 'warn' || evt.severity === 'warning' ? 'var(--warning, #D97706)' : 'var(--info, #2563EB)'
                  }}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] mb-1" style={{ fontFamily: fontFamily.mono, color: '#708499' }}>
                      {evt.severity?.toUpperCase() || 'INFO'}
                      <span className="w-[3px] h-[3px] rounded-full" style={{ background: '#708499' }} />
                      {evt.domain || 'General'}
                      {evt.time_ago && <>
                        <span className="w-[3px] h-[3px] rounded-full" style={{ background: '#708499' }} />
                        {evt.time_ago}
                      </>}
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

          {/* RIGHT: Daily Brief + Quick Actions + Activity Timeline */}
          <div className="flex flex-col gap-5">

            {/* ── Morning Brief Card (matches approved mockup) ── */}
            <div className="rounded-xl relative overflow-hidden" style={{ padding: 'var(--sp-7, 28px)', background: 'linear-gradient(160deg, #111827, #1A1A2E)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {/* Animated orb */}
              <style>{`
                @keyframes orbDrift { 0%, 100% { transform: translate(0,0); } 50% { transform: translate(40px, 30px); } }
                @keyframes briefPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(232,93,0,0.8); } 50% { box-shadow: 0 0 0 8px rgba(232,93,0,0); } }
              `}</style>
              <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, background: 'radial-gradient(circle, #E85D00 0%, transparent 60%)', opacity: 0.25, filter: 'blur(60px)', animation: 'orbDrift 20s ease-in-out infinite' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: '#FF7A1A' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#E85D00', animation: 'briefPulse 1.4s ease-in-out infinite' }} />
                  <span>Your morning brief &middot; {timeStr}</span>
                </div>
                <h2 className="mt-3" style={{ fontFamily: fontFamily.display, fontSize: 36, lineHeight: 1.05, letterSpacing: '-0.025em', color: 'white' }}>
                  Two things to <em style={{ color: '#FF7A1A', fontStyle: 'italic' }}>do today</em>.
                </h2>
                <p className="mt-4 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  Reply to Bramwell ($24k at risk) before your 11am window closes. Eleanor at Olive Lane has gone quiet — a 2-line message will keep that $1.8k MRR. Everything else can wait until after lunch.
                </p>
                <div className="grid grid-cols-3 gap-4 mt-6 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div>
                    <div style={{ fontFamily: fontFamily.display, fontSize: 36, color: '#E85D00', lineHeight: 1 }}>2</div>
                    <div className="text-[10px] uppercase tracking-[0.08em] mt-2" style={{ fontFamily: fontFamily.mono, color: 'rgba(255,255,255,0.5)' }}>Need decisions</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: fontFamily.display, fontSize: 36, color: 'white', lineHeight: 1 }}>$48k</div>
                    <div className="text-[10px] uppercase tracking-[0.08em] mt-2" style={{ fontFamily: fontFamily.mono, color: 'rgba(255,255,255,0.5)' }}>At risk</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: fontFamily.display, fontSize: 36, color: 'white', lineHeight: 1 }}>90<span style={{ fontSize: '0.5em' }}>s</span></div>
                    <div className="text-[10px] uppercase tracking-[0.08em] mt-2" style={{ fontFamily: fontFamily.mono, color: 'rgba(255,255,255,0.5)' }}>To read</div>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/soundboard')}
                  className="mt-6 inline-flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: '#E85D00', color: 'white', border: 'none', cursor: 'pointer', fontFamily: fontFamily.body }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#FF7A1A'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(232,93,0,0.3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#E85D00'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  Open the brief <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Quick Action Cards (2x2 grid per mockup) ── */}
            <div className="grid grid-cols-2 gap-3" style={{ marginTop: 'var(--sp-5, 20px)' }}>
              {[
                { title: 'Ask BIQc anything', desc: '"What changed in the pipeline this week?"', icon: MessageSquare, path: '/soundboard' },
                { title: 'Inbox triage', desc: '23 new emails. 7 need a decision.', icon: Mail, path: '/email-inbox' },
                { title: 'Action queue', desc: '12 items waiting. 3 are overdue.', icon: CheckSquare, path: '/actions' },
                { title: 'Add an integration', desc: 'Xero, HubSpot, Slack — via Merge.dev', icon: Puzzle, path: '/integrations' },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.path}
                    onClick={() => navigate(action.path)}
                    className="flex flex-col gap-2 p-5 rounded-xl text-left transition-all"
                    style={{
                      background: 'var(--surface, #0E1628)',
                      border: '1px solid var(--border, rgba(140,170,210,0.12))',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--lava, #E85D00)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = 'var(--elev-2, 0 1px 3px rgba(0,0,0,0.6))';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border, rgba(140,170,210,0.12))';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ background: 'var(--lava-wash, rgba(232,93,0,0.12))', color: 'var(--lava, #E85D00)' }}>
                      <Icon className="w-[18px] h-[18px]" />
                    </div>
                    <h4 className="text-sm font-semibold" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.body }}>{action.title}</h4>
                    <p className="text-xs leading-snug" style={{ color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body }}>{action.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* ── Activity Timeline (panel style per mockup) ── */}
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface, #0E1628)', border: '1px solid var(--border, rgba(140,170,210,0.12))' }}>
              <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--border, rgba(140,170,210,0.12))' }}>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-muted, #708499)' }}>— Last 24 hours</div>
                  <h3 className="text-2xl font-medium mt-1" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)', letterSpacing: '-0.02em' }}>Activity</h3>
                </div>
              </div>

              {activityLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--ink-muted, #708499)' }} />
                </div>
              ) : activityItems.length > 0 ? (
                <div className="flex flex-col">
                  {activityItems.map((item, idx) => {
                    const isLast = idx === activityItems.length - 1;
                    let timeLabel = '';
                    if (item.timestamp) {
                      try {
                        const d = new Date(item.timestamp);
                        timeLabel = d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
                      } catch {
                        timeLabel = '';
                      }
                    }

                    return (
                      <div key={item.id || idx} className="grid gap-4 items-start" style={{ gridTemplateColumns: '80px 1fr', padding: '16px 24px', borderBottom: isLast ? 'none' : '1px solid var(--border, rgba(140,170,210,0.12))' }}>
                        <div className="text-[10px] uppercase tracking-[0.08em] pt-0.5" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-muted, #708499)' }}>
                          {timeLabel}
                        </div>
                        <div className="text-[13px] leading-relaxed" style={{ color: 'var(--ink, #C8D4E4)' }}>
                          <strong style={{ color: 'var(--ink-display, #EDF1F7)' }}>{item.title || 'Activity'}</strong>
                          {item.message && <> &middot; {item.message}</>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 px-5">
                  <Clock className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--ink-muted, #708499)' }} />
                  <p className="text-xs" style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.body }}>
                    No recent activity. Connect your inbox and CRM to start tracking signals.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Advisor;
