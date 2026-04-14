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

  // Real advisor data state (replaces hardcoded KPIs + morning brief)
  const [advisorData, setAdvisorData] = useState(null);
  const [advisorLoading, setAdvisorLoading] = useState(true);
  const [executiveSurface, setExecutiveSurface] = useState(null);
  const [snapshotData, setSnapshotData] = useState(null);
  const [emailStats, setEmailStats] = useState({ total: 0, highPriority: 0 });

  // Fetch real advisor data for KPIs and morning brief
  useEffect(() => {
    const controller = new AbortController();
    const fetchAdvisorData = async () => {
      try {
        const [advisorRes, surfaceRes, snapshotRes] = await Promise.allSettled([
          apiClient.get('/unified/advisor', { signal: controller.signal }),
          apiClient.get('/advisor/executive-surface', { signal: controller.signal }),
          apiClient.get('/snapshot/latest', { signal: controller.signal }),
        ]);
        if (!controller.signal.aborted) {
          if (advisorRes.status === 'fulfilled') setAdvisorData(advisorRes.value.data);
          if (surfaceRes.status === 'fulfilled') setExecutiveSurface(surfaceRes.value.data);
          if (snapshotRes.status === 'fulfilled') setSnapshotData(snapshotRes.value.data);
        }
      } catch (err) {
        if (!controller.signal.aborted) console.error('Advisor data fetch failed:', err);
      } finally {
        if (!controller.signal.aborted) setAdvisorLoading(false);
      }
    };
    fetchAdvisorData();
    return () => controller.abort();
  }, []);

  // Fetch email stats for quick action cards
  useEffect(() => {
    const controller = new AbortController();
    const fetchEmailStats = async () => {
      try {
        const res = await apiClient.get('/email/priority-inbox', { signal: controller.signal });
        if (!controller.signal.aborted) {
          const data = res.data;
          const high = (data?.high_priority || []).length;
          const medium = (data?.medium_priority || []).length;
          const low = (data?.low_priority || []).length;
          setEmailStats({ total: high + medium + low, highPriority: high });
        }
      } catch {
        if (!controller.signal.aborted) setEmailStats({ total: 0, highPriority: 0 });
      }
    };
    fetchEmailStats();
    return () => controller.abort();
  }, []);

  // Fetch activity timeline from notifications/alerts
  useEffect(() => {
    const controller = new AbortController();
    const fetchActivity = async () => {
      try {
        const res = await apiClient.get('/notifications/alerts', { signal: controller.signal });
        if (!controller.signal.aborted) {
          const items = (res.data?.notifications || res.data || []).slice(0, 6);
          setActivityItems(items);
        }
      } catch {
        if (!controller.signal.aborted) setActivityItems([]);
      } finally {
        if (!controller.signal.aborted) setActivityLoading(false);
      }
    };
    fetchActivity();
    return () => controller.abort();
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
        
        // Parallel fetch all integration status (was sequential — 3× faster now)
        const [emailResult, crmResult, accountingResult] = await Promise.allSettled([
          supabase.from('email_connections').select('*').eq('user_id', session.user.id),
          supabase.from('integration_accounts').select('*').eq('user_id', session.user.id).eq('category', 'crm'),
          supabase.from('integration_accounts').select('*').eq('user_id', session.user.id).eq('category', 'accounting'),
        ]);

        const emailRows = emailResult.status === 'fulfilled' ? emailResult.value.data : null;
        const crmRows = crmResult.status === 'fulfilled' ? crmResult.value.data : null;
        const accountingRows = accountingResult.status === 'fulfilled' ? accountingResult.value.data : null;

        const emailConnected = emailRows && emailRows.length > 0;
        const emailProvider = emailConnected ? emailRows[0].provider : null;
        const emailConnectedAt = emailConnected ? emailRows[0].connected_at : null;

        const crmConnected = crmRows && crmRows.length > 0;
        const crmConnectedAt = crmConnected ? crmRows[0].connected_at : null;

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
            <h1 className="font-medium" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)', fontSize: 'clamp(2rem, 4vw, 2.8rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
              {greeting}, <em style={{ fontStyle: 'italic', color: '#E85D00' }}>{firstName}</em>.
            </h1>
            <p className="mt-2 text-base" style={{ fontFamily: fontFamily.body, color: 'var(--ink-secondary, #8FA0B8)' }}>
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
              style={{ background: 'var(--surface, #0E1628)', border: '1px solid rgba(140,170,210,0.12)', color: 'var(--ink-secondary, #8FA0B8)', fontFamily: fontFamily.body, cursor: 'pointer' }}
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

        {/* ── KPI Row — ALL values from real APIs ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(() => {
            const pipeline = advisorData?.revenue_summary?.pipeline;
            const runway = snapshotData?.cognitive?.capital?.runway;
            const highPriorityThreads = executiveSurface?.snapshot?.high_priority_threads;
            const kpis = [
              { label: 'Open signals', value: watchtowerEvents.length || '\u2014', hasData: true, color: '#E85D00', showDot: true },
              { label: 'Pipeline at risk', value: pipeline != null ? `$${Number(pipeline).toLocaleString()}` : '\u2014', hasData: pipeline != null, color: '#DC2626', showDot: false, noDataHint: 'Connect CRM' },
              { label: 'Cash runway', value: runway != null ? String(runway) : '\u2014', valueSuffix: runway != null ? 'mo' : '', hasData: runway != null, color: '#10B981', showDot: false, noDataHint: 'Connect accounting' },
              { label: 'Inbox decisions', value: highPriorityThreads != null ? String(highPriorityThreads) : emailStats.highPriority > 0 ? String(emailStats.highPriority) : '\u2014', hasData: highPriorityThreads != null || emailStats.highPriority > 0, color: '#10B981', showDot: false, noDataHint: 'Connect inbox' },
            ];
            return kpis.map((kpi, i) => (
              <div key={i} className="p-5 rounded-xl" style={{ background: 'var(--surface, #0E1628)', border: '1px solid var(--border, rgba(140,170,210,0.12))' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-muted, #708499)' }}>{kpi.label}</span>
                    {kpi.showDot && <span className="w-2 h-2 rounded-full" style={{ background: kpi.color, boxShadow: `0 0 8px ${kpi.color}` }} />}
                  </div>
                </div>
                <div className="text-3xl font-medium" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)', lineHeight: 1 }}>
                  {advisorLoading ? (
                    <span className="inline-block w-16 h-8 rounded animate-pulse" style={{ background: 'var(--surface-2, #121D30)' }} />
                  ) : (
                    <>{kpi.value}{kpi.valueSuffix && <span style={{ fontSize: '0.5em', color: 'var(--ink-secondary, #8FA0B8)' }}>{kpi.valueSuffix}</span>}</>
                  )}
                </div>
                {!advisorLoading && !kpi.hasData && kpi.noDataHint && (
                  <div className="text-[11px] mt-2.5" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-muted, #708499)' }}>{kpi.noDataHint}</div>
                )}
              </div>
            ));
          })()}
        </div>

        {/* ── 2-Column Grid ── */}
        <style>{`.advisor-grid { display: grid; grid-template-columns: 1fr; gap: 24px; } @media (min-width: 1180px) { .advisor-grid { grid-template-columns: 2fr 1fr; } }`}</style>
        <div className="advisor-grid">

          {/* LEFT: Signal Feed */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface, #0E1628)', border: '1px solid var(--border, rgba(140,170,210,0.12))' }}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--border, rgba(140,170,210,0.12))' }}>
              <div>
                <div className="text-[10px] uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-muted, #708499)' }}>— Live signal feed</div>
                <h3 className="text-2xl font-medium mt-1" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #EDF1F7)', letterSpacing: '-0.02em' }}>What changed overnight</h3>
              </div>
              <div className="flex gap-2">
                {filters.map((f) => (
                  <button
                    key={f}
                    onClick={() => setSignalFilter(f.toLowerCase())}
                    className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.08em] transition-all"
                    style={{
                      fontFamily: fontFamily.mono,
                      background: signalFilter === f.toLowerCase() ? '#E85D00' : 'var(--surface-2, #121D30)',
                      color: signalFilter === f.toLowerCase() ? 'white' : 'var(--ink-secondary)',
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
                <div key={evt.id || i} className="grid gap-4 p-5 cursor-pointer transition-colors hover:bg-[var(--surface-2)]" style={{ gridTemplateColumns: '44px 1fr auto', borderBottom: i < Math.min(watchtowerEvents.length, 6) - 1 ? '1px solid rgba(140,170,210,0.12)' : 'none', alignItems: 'flex-start' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{
                    background: evt.severity === 'critical' ? 'var(--danger-wash, rgba(239,68,68,0.10))' : evt.severity === 'high' ? 'var(--lava-wash, rgba(232,93,0,0.12))' : evt.severity === 'warn' || evt.severity === 'warning' ? 'var(--warning-wash, rgba(245,158,11,0.10))' : 'var(--info-wash, rgba(59,130,246,0.10))',
                    color: evt.severity === 'critical' ? 'var(--danger, #DC2626)' : evt.severity === 'high' ? 'var(--lava, #E85D00)' : evt.severity === 'warn' || evt.severity === 'warning' ? 'var(--warning, #D97706)' : 'var(--info, #2563EB)'
                  }}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] mb-1" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-muted, #708499)' }}>
                      {evt.severity?.toUpperCase() || 'INFO'}
                      <span className="w-[3px] h-[3px] rounded-full" style={{ background: 'var(--ink-muted, #708499)' }} />
                      {evt.domain || 'General'}
                      {evt.time_ago && <>
                        <span className="w-[3px] h-[3px] rounded-full" style={{ background: 'var(--ink-muted, #708499)' }} />
                        {evt.time_ago}
                      </>}
                    </div>
                    <div className="text-sm font-semibold leading-tight" style={{ color: 'var(--ink-display, #EDF1F7)' }}>{evt.title || evt.summary || 'Signal detected'}</div>
                    {evt.description && <div className="text-[13px] mt-1 leading-relaxed" style={{ color: 'var(--ink-secondary, #8FA0B8)' }}>{evt.description}</div>}
                  </div>
                  <div className="text-[11px] shrink-0" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-muted, #708499)' }}>{evt.time_ago || ''}</div>
                </div>
              )) : (
                <div className="p-10 text-center">
                  <Activity className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--ink-muted, #708499)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--ink-display, #EDF1F7)', fontFamily: fontFamily.body }}>No signals yet</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-muted, #708499)', fontFamily: fontFamily.body }}>Connect your inbox and CRM to start surfacing business intelligence.</p>
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
                {advisorLoading ? (
                  <>
                    <div className="mt-3 h-10 w-3/4 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
                    <div className="mt-4 h-4 w-full rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    <div className="mt-2 h-4 w-2/3 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  </>
                ) : (() => {
                  const memo = snapshotData?.cognitive?.executive_memo || snapshotData?.snapshot?.executive_memo;
                  const decideNow = executiveSurface?.cards?.decide_now;
                  const stalledDeals = executiveSurface?.snapshot?.stalled_deals_72h || 0;
                  const overdueInvoices = executiveSurface?.snapshot?.overdue_invoices || 0;
                  const totalOverdue = executiveSurface?.snapshot?.total_overdue || 0;
                  const urgentCount = (decideNow ? 1 : 0) + (stalledDeals > 0 ? 1 : 0) + (overdueInvoices > 0 ? 1 : 0);
                  const hasAnyData = memo || decideNow || stalledDeals > 0 || overdueInvoices > 0;
                  if (!hasAnyData) {
                    return (
                      <>
                        <h2 className="mt-3" style={{ fontFamily: fontFamily.display, fontSize: 36, lineHeight: 1.05, letterSpacing: '-0.025em', color: 'white' }}>
                          Nothing urgent <em style={{ color: '#FF7A1A', fontStyle: 'italic' }}>right now</em>.
                        </h2>
                        <p className="mt-4 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                          Connect your inbox and CRM to start receiving personalised intelligence briefs each morning.
                        </p>
                      </>
                    );
                  }
                  const headline = urgentCount > 0 ? `${urgentCount} thing${urgentCount !== 1 ? 's' : ''} to` : 'All clear';
                  const headlineEmphasis = urgentCount > 0 ? 'act on' : 'for now';
                  return (
                    <>
                      <h2 className="mt-3" style={{ fontFamily: fontFamily.display, fontSize: 36, lineHeight: 1.05, letterSpacing: '-0.025em', color: 'white' }}>
                        {headline} <em style={{ color: '#FF7A1A', fontStyle: 'italic' }}>{headlineEmphasis}</em>.
                      </h2>
                      <p className="mt-4 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        {memo || (decideNow?.signal_summary) || 'Your intelligence brief is being assembled.'}
                      </p>
                      <div className="grid grid-cols-3 gap-4 mt-6 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <div>
                          <div style={{ fontFamily: fontFamily.display, fontSize: 36, color: urgentCount > 0 ? '#E85D00' : 'white', lineHeight: 1 }}>{urgentCount}</div>
                          <div className="text-[10px] uppercase tracking-[0.08em] mt-2" style={{ fontFamily: fontFamily.mono, color: 'rgba(255,255,255,0.5)' }}>Need attention</div>
                        </div>
                        <div>
                          <div style={{ fontFamily: fontFamily.display, fontSize: 36, color: 'white', lineHeight: 1 }}>{totalOverdue > 0 ? `$${Math.round(totalOverdue / 1000)}k` : '\u2014'}</div>
                          <div className="text-[10px] uppercase tracking-[0.08em] mt-2" style={{ fontFamily: fontFamily.mono, color: 'rgba(255,255,255,0.5)' }}>At risk</div>
                        </div>
                        <div>
                          <div style={{ fontFamily: fontFamily.display, fontSize: 36, color: 'white', lineHeight: 1 }}>{stalledDeals > 0 ? stalledDeals : overdueInvoices > 0 ? overdueInvoices : '\u2014'}</div>
                          <div className="text-[10px] uppercase tracking-[0.08em] mt-2" style={{ fontFamily: fontFamily.mono, color: 'rgba(255,255,255,0.5)' }}>{stalledDeals > 0 ? 'Stalled deals' : overdueInvoices > 0 ? 'Overdue' : 'Signals'}</div>
                        </div>
                      </div>
                    </>
                  );
                })()}
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
                { title: 'Inbox triage', desc: emailStats.total > 0 ? `${emailStats.total} email${emailStats.total !== 1 ? 's' : ''} analysed. ${emailStats.highPriority > 0 ? `${emailStats.highPriority} need${emailStats.highPriority !== 1 ? '' : 's'} a decision.` : 'None urgent.'}` : integrationData.email?.connected ? 'Inbox connected. Checking priorities...' : 'Connect your inbox to start triaging.', icon: Mail, path: '/email-inbox' },
                { title: 'Action queue', desc: activityItems.length > 0 ? `${activityItems.length} recent item${activityItems.length !== 1 ? 's' : ''} tracked.` : 'No actions tracked yet.', icon: CheckSquare, path: '/actions' },
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
