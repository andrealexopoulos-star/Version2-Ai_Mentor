import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { apiClient } from '../lib/api';
import { supabase } from '../context/SupabaseAuthContext';
import { toast } from 'sonner';
import { 
  Mail, Inbox, AlertCircle, Clock, CheckCircle2, 
  RefreshCw, Send, Sparkles, ChevronDown, ChevronUp,
  User, Calendar, ArrowRight, Copy, Loader2, Star,
  TrendingUp, Target, Zap, MessageSquare, X
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { PageLoadingState, PageErrorState } from '../components/PageStateComponents';

const EmailInbox = () => {
  const navigate = useNavigate();
  const [activeProvider, setActiveProvider] = useState(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [connectedEmail, setConnectedEmail] = useState(null);
  const [priorityAnalysis, setPriorityAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inboxLoadError, setInboxLoadError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [replySuggestions, setReplySuggestions] = useState(null);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [expandedSection, setExpandedSection] = useState('high');
  const [reclassifying, setReclassifying] = useState(null); // email_id being reclassified

  useEffect(() => {
    checkConnections();
  }, []);

  const checkConnections = async () => {
    try {
      setCheckingConnection(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setGmailConnected(false);
        setOutlookConnected(false);
        setCheckingConnection(false);
        return;
      }

      // CANONICAL: Query email_connections ONLY
      // console.log("Querying email_connections for user:", session.user.id);
      
      const { data: rows, error } = await supabase
        .from('email_connections')
        .select('*')
        .eq('user_id', session.user.id);
      
      // console.log("Query result:", { rows, error });
      
      if (error) {
        console.error('Database query error:', error);
        setGmailConnected(false);
        setOutlookConnected(false);
        setActiveProvider(null);
        setLoading(false);
        setCheckingConnection(false);
        return;
      }
      
      // CANONICAL: rows.length > 0 means connected
      if (!rows || rows.length === 0) {
        // console.log('No email provider connected');
        setGmailConnected(false);
        setOutlookConnected(false);
        setActiveProvider(null);
        setLoading(false);
        setCheckingConnection(false);
        return;
      }
      
      const connectedRows = rows.filter((row) => row?.connected !== false);
      if (!connectedRows.length) {
        setGmailConnected(false);
        setOutlookConnected(false);
        setActiveProvider(null);
        setConnectedEmail(null);
        setLoading(false);
        setCheckingConnection(false);
        return;
      }

      const connection = connectedRows.find((row) => row.provider === 'outlook')
        || connectedRows.find((row) => row.provider === 'gmail')
        || connectedRows[0];
      // console.log('Email connection found:', connection);
      
      // Set state and fetch inbox
      if (connection.provider === 'outlook') {
        setOutlookConnected(true);
        setGmailConnected(false);
        setActiveProvider('outlook');
        setConnectedEmail(connection.connected_email);
      } else if (connection.provider === 'gmail') {
        setGmailConnected(true);
        setOutlookConnected(false);
        setActiveProvider('gmail');
        setConnectedEmail(connection.connected_email);
      }
      
    } catch (error) {
      console.error('Error checking connections:', error);
      setGmailConnected(false);
      setOutlookConnected(false);
      setActiveProvider(null);
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleConnect = () => {
    navigate('/connect-email');
  };

  useEffect(() => {
    if (activeProvider) {
      fetchPriorityInbox(activeProvider);
    }
  }, [activeProvider]);

  const normalizePriorityPayload = (payload, fallbackMeta = {}) => {
    if (!payload || typeof payload !== 'object') return null;
    const base = payload.analysis && typeof payload.analysis === 'object' ? payload.analysis : payload;
    if (base.message && !base.high_priority && !base.medium_priority && !base.low_priority) return null;
    return {
      high_priority: (base.high_priority || []).map(normalizeEmailFields),
      medium_priority: (base.medium_priority || []).map(normalizeEmailFields),
      low_priority: (base.low_priority || []).map(normalizeEmailFields),
      strategic_insights: base.strategic_insights || '',
      total_analyzed: base.total_analyzed || fallbackMeta.total_analyzed || 0,
      analyzed_at: payload.analyzed_at || fallbackMeta.analyzed_at || new Date().toISOString(),
      from_cache: Boolean(fallbackMeta.from_cache),
    };
  };

  const fetchPriorityInbox = async (provider) => {
    try {
      if (!provider) return;
      setLoading(true);
      setInboxLoadError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      // 1. Load from cache first (priority_inbox table) for instant display
      const { data: cached } = await supabase
        .from('priority_inbox')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('provider', provider)
        .order('received_date', { ascending: false })
        .limit(50);

      if (cached?.length) {
        const normalized = normalizePriorityRows(cached);
        setPriorityAnalysis({ ...normalized, analyzed_at: cached[0].analyzed_at, from_cache: true });
        setLoading(false);
      }

      // 2. Prefer backend-backed inbox retrieval to avoid direct edge JWT issues in production.
      let latest = null;
      let fetchErrMsg = null;
      try {
        const existing = await apiClient.get('/email/priority-inbox');
        latest = normalizePriorityPayload(existing.data, { from_cache: false });
      } catch (error) {
        console.error('Priority inbox existing fetch failed:', error?.response?.data || error.message);
        fetchErrMsg = error?.response?.data?.detail || error?.message || 'Unable to load priority inbox.';
      }

      if (!latest) {
        try {
          const analyzed = await apiClient.post('/email/analyze-priority');
          latest = normalizePriorityPayload(analyzed.data, { from_cache: false, analyzed_at: new Date().toISOString() });
        } catch (error) {
          if (!cached?.length) {
            console.error('Priority inbox analysis failed:', error?.response?.data || error.message);
            const detail = error?.response?.data?.detail || error?.message || 'Priority Inbox is temporarily unavailable.';
            fetchErrMsg = fetchErrMsg || detail;
            toast.error(detail);
          }
        }
      }

      if (latest) {
        setPriorityAnalysis(latest);
      } else if (!cached?.length && fetchErrMsg) {
        setInboxLoadError(fetchErrMsg);
      }
    } catch (error) {
      console.error('Priority inbox fetch error:', error);
      setInboxLoadError(error?.message || 'Unable to load priority inbox.');
    } finally {
      setLoading(false);
    }
  };

  // Normalize edge function email fields to UI-expected format
  const normalizeEmailFields = (e) => ({
    email_id:        e.email_id || e.id,
    graph_message_id: e.graph_message_id || null,
    from:            e.from_address || e.from || 'Unknown',
    subject:         e.subject || '(no subject)',
    snippet:         e.snippet || '',
    received:        e.received_date || e.received || '',
    reason:          e.reason || '',
    suggested_action: e.suggested_action || '',
    thread_id:       e.thread_id,
    web_link:        e.web_link || null,
    priority_level:  e.priority_level || e.priority,
    user_override:   e.user_override || null,
  });

  // Normalize cached priority_inbox rows to UI format
  const normalizePriorityRows = (rows) => {
    const bucket = (level) => rows
      .filter(r => (r.user_override || r.priority_level) === level)
      .map(normalizeEmailFields);
    const latest = rows[0];
    return {
      high_priority: bucket('high'),
      medium_priority: bucket('medium'),
      low_priority: bucket('low'),
      strategic_insights: latest?.strategic_insights || '',
      analyzed_at: latest?.analyzed_at,
    };
  };

  // Reclassify an email (updates user_override in priority_inbox)
  const reclassifyEmail = async (emailId, newLevel) => {
    setReclassifying(emailId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error } = await supabase.from('priority_inbox')
        .update({ user_override: newLevel })
        .eq('user_id', session.user.id)
        .eq('email_id', emailId);
      if (error) {
        toast.error(error.message || 'Failed to reclassify email');
        return;
      }
      // Optimistically update UI
      setPriorityAnalysis(prev => {
        if (!prev) return prev;
        const allEmails = [
          ...(prev.high_priority || []),
          ...(prev.medium_priority || []),
          ...(prev.low_priority || []),
        ].map(e => e.email_id === emailId ? { ...e, user_override: newLevel } : e);
        return {
          ...prev,
          high_priority:   allEmails.filter(e => (e.user_override || e.priority_level) === 'high'),
          medium_priority: allEmails.filter(e => (e.user_override || e.priority_level) === 'medium'),
          low_priority:    allEmails.filter(e => (e.user_override || e.priority_level) === 'low'),
        };
      });
      toast.success(`Moved to ${newLevel} priority`);
    } catch {
      toast.error('Failed to reclassify email');
    }
    setReclassifying(null);
  };

  const runPriorityAnalysis = async () => {
    try {
      setAnalyzing(true);
      toast.info('Analyzing your inbox with AI... This may take a moment.');
      const analyzed = await apiClient.post('/email/analyze-priority');
      const normalized = normalizePriorityPayload(analyzed.data, { from_cache: false, analyzed_at: new Date().toISOString() });
      if (normalized) {
        setPriorityAnalysis(normalized);
      }
      // Refresh provider-cached rows after an explicit analysis run.
      await fetchPriorityInbox(activeProvider);
      toast.success(`${activeProvider === 'gmail' ? 'Gmail' : 'Outlook'} inbox analyzed! Your emails are now prioritized.`);
    } catch (error) {
      toast.error('Failed to analyze inbox: ' + (error.response?.data?.detail || error.message));
    } finally {
      setAnalyzing(false);
    }
  };

  const fetchReplySuggestions = async (emailId) => {
    try {
      setLoadingReplies(true);
      setSelectedEmail(emailId);
      const response = await apiClient.post(`/email/suggest-reply/${emailId}`);
      setReplySuggestions(response.data);
    } catch (error) {
      toast.error('Failed to generate reply suggestions');
    } finally {
      setLoadingReplies(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Reply copied to clipboard!');
  };

  const PriorityBadge = ({ level }) => {
    const styles = {
      high: { bg: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', icon: AlertCircle },
      medium: { bg: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', icon: Clock },
      low: { bg: 'rgba(34, 197, 94, 0.1)', color: '#10B981', icon: CheckCircle2 }
    };
    const style = styles[level] || styles.medium;
    const Icon = style.icon;
    
    return (
      <span 
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
        style={{ background: style.bg, color: style.color }}
      >
        <Icon className="w-3 h-3" />
        {level.charAt(0).toUpperCase() + level.slice(1)} Priority
      </span>
    );
  };

  const EmailCard = ({ email, priority }) => {
    const effectivePriority = email.user_override || priority;
    const isSelected = selectedEmail === email.email_id;
    const LEVELS = ['high', 'medium', 'low'];

    return (
      <div
        onClick={() => setSelectedEmail(email.email_id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setSelectedEmail(email.email_id);
          }
        }}
        role="button"
        tabIndex={0}
        className={`p-4 rounded-xl border transition-all ${isSelected ? 'ring-1 ring-[#FF6A00]' : ''}`}
        style={{
          background: 'var(--biqc-bg-card, #141C26)',
          borderColor: isSelected ? '#FF6A00' : 'var(--biqc-border, #1E2D3D)',
        }}
        data-testid={`priority-email-card-${email.email_id}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: '#FF6A00' }}>
                {(email.from || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" style={{ color: 'var(--biqc-text, #F4F7FA)' }}>
                  {email.from || 'Unknown Sender'}
                </p>
                <p className="text-xs" style={{ color: '#64748B' }}>
                  {email.received ? new Date(email.received).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              </div>
            </div>
            <h4 className="text-sm font-semibold mb-1 line-clamp-1" style={{ color: 'var(--biqc-text, #F4F7FA)' }}>
              {email.subject || 'No Subject'}
            </h4>
            {email.snippet && (
              <p className="text-xs mb-1.5 line-clamp-1" style={{ color: '#64748B' }}>{email.snippet}</p>
            )}
            {email.reason && (
              <p className="text-xs mb-1" style={{ color: 'var(--biqc-text-2, #9FB0C3)' }}>
                <span className="font-medium">Why:</span> {email.reason}
              </p>
            )}
            {email.suggested_action && (
              <p className="text-xs" style={{ color: '#FF6A00' }}>
                <span className="font-medium">Action:</span> {email.suggested_action}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <PriorityBadge level={effectivePriority} />
            {/* Reclassify buttons */}
            <div className="flex gap-1">
              {LEVELS.filter(l => l !== effectivePriority).map(l => (
                <button
                  key={l}
                  type="button"
                  disabled={reclassifying === email.email_id}
                  onClick={(event) => {
                    event.stopPropagation();
                    reclassifyEmail(email.email_id, l);
                  }}
                  className="text-[10px] px-2 py-0.5 rounded-md transition-all"
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#64748B',
                    cursor: 'pointer',
                  }}
                  title={`Move to ${l} priority`}>
                  {reclassifying === email.email_id ? '...' : l[0].toUpperCase()}
                </button>
              ))}
            </div>
            {email.web_link && (
              <Button
                size="sm"
                type="button"
                variant="outline"
                style={{ padding: '4px 10px' }}
                onClick={(event) => {
                  event.stopPropagation();
                  window.open(email.web_link, '_blank', 'noopener,noreferrer');
                }}
              >
                Open
              </Button>
            )}
            <Button size="sm" type="button" className="text-xs"
              style={{ background: 'rgba(255,106,0,0.1)', color: '#FF6A00', border: '1px solid rgba(255,106,0,0.2)', padding: '4px 10px' }}
              onClick={(e) => { e.stopPropagation(); fetchReplySuggestions(email.email_id); }}>
              <Sparkles className="w-3 h-3 mr-1" />
              Reply
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const PrioritySection = ({ title, emails, priority, icon: Icon, color }) => {
    const isExpanded = expandedSection === priority;
    const count = emails?.length || 0;
    
    return (
      <div className="mb-4">
        <button
          onClick={() => setExpandedSection(isExpanded ? null : priority)}
          className="w-full flex items-center justify-between p-4 rounded-xl transition-all"
          style={{ 
            background: isExpanded ? 'var(--bg-tertiary)' : 'var(--bg-card)',
            border: '1px solid var(--border-light)'
          }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${color}20` }}
            >
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div className="text-left">
              <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {title}
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {count} {count === 1 ? 'email' : 'emails'} need attention
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span 
              className="text-2xl font-bold"
              style={{ color }}
            >
              {count}
            </span>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
            ) : (
              <ChevronDown className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
            )}
          </div>
        </button>
        
        {isExpanded && count > 0 && (
          <div className="mt-3 space-y-3 pl-2">
            {emails.map((email, idx) => (
              <EmailCard key={email?.email_id || `${priority}-${idx}`} email={email} priority={priority} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const ReplySuggestionsModal = () => {
    if (!replySuggestions) return null;
    
    // Handle both new format (suggested_reply/advisor_rationale) and legacy format (replies array)
    const hasNewFormat = replySuggestions.suggested_reply !== undefined;
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div 
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
          style={{ background: 'var(--bg-primary)' }}
        >
          <div className="sticky top-0 p-6 border-b" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-light)' }}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {hasNewFormat ? 'BIQC Suggested Reply' : 'AI Reply Suggestions'}
                </h2>
                {replySuggestions.priority_level && (
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-medium mb-2"
                    style={{
                      background: replySuggestions.priority_level === 'high'
                        ? 'rgba(239,68,68,0.18)'
                        : replySuggestions.priority_level === 'medium'
                          ? 'rgba(245,158,11,0.18)'
                          : 'rgba(16,185,129,0.18)',
                      color: replySuggestions.priority_level === 'high'
                        ? '#F87171'
                        : replySuggestions.priority_level === 'medium'
                          ? '#FBBF24'
                          : '#34D399',
                    }}
                  >
                    {replySuggestions.priority_level.toUpperCase()} PRIORITY
                  </span>
                )}
                {replySuggestions.original_subject && (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Re: {replySuggestions.original_subject}
                  </p>
                )}
                {replySuggestions.from && (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    From: {replySuggestions.from}
                  </p>
                )}
              </div>
              <button 
                onClick={() => {
                  setReplySuggestions(null);
                  setSelectedEmail(null);
                }}
                className="p-2 rounded-lg"
                style={{ background: 'transparent', border: '1px solid rgba(148,163,184,0.24)' }}
              >
                <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            {/* NEW FORMAT: suggested_reply + advisor_rationale */}
            {hasNewFormat && (
              <>
                {/* Advisor Rationale */}
                {replySuggestions.advisor_rationale && (
                  <div 
                    className="p-4 rounded-xl"
                    style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                      <span className="font-medium text-blue-600">BIQC Advisor Rationale</span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {replySuggestions.advisor_rationale}
                    </p>
                  </div>
                )}
                
                {/* Suggested Reply */}
                <div 
                  className="p-5 rounded-xl border"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Suggested Reply
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {replySuggestions.web_link && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(replySuggestions.web_link, '_blank', 'noopener,noreferrer')}
                        >
                          Open Email
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="btn-primary"
                        onClick={() => copyToClipboard(replySuggestions.suggested_reply)}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                  </div>
                  
                  <div 
                    className="p-4 rounded-lg whitespace-pre-wrap text-sm"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                  >
                    {replySuggestions.suggested_reply || 'No reply generated'}
                  </div>
                </div>
              </>
            )}

            {/* LEGACY FORMAT: context_insight + replies array */}
            {!hasNewFormat && (
              <>
                {replySuggestions.context_insight && (
                  <div 
                    className="p-4 rounded-xl"
                    style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                      <span className="font-medium text-blue-600">Strategic Insight</span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {replySuggestions.context_insight}
                    </p>
                  </div>
                )}
                
                {replySuggestions.replies?.map((reply, idx) => (
                  <div 
                    key={idx}
                    className="p-5 rounded-xl border"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {reply.style === 'direct' && <Zap className="w-4 h-4 text-yellow-500" />}
                        {reply.style === 'relationship' && <User className="w-4 h-4 text-pink-500" />}
                        {reply.style === 'strategic' && <Target className="w-4 h-4 text-purple-500" />}
                        <span className="font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
                          {reply.style === 'direct' ? 'Direct & Efficient' : 
                           reply.style === 'relationship' ? 'Relationship-Building' : 
                           'Strategic Positioning'}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        className="btn-primary"
                        onClick={() => copyToClipboard(reply.body)}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    
                    {reply.subject && reply.subject !== `Re: ${replySuggestions.original_subject}` && (
                      <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
                        <span className="font-medium">Subject:</span> {reply.subject}
                      </p>
                    )}
                    
                    <div 
                      className="p-4 rounded-lg mb-3 whitespace-pre-wrap text-sm"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                    >
                      {reply.body}
                    </div>
                    
                    {reply.strategic_note && (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span className="font-medium">💡 Why this works:</span> {reply.strategic_note}
                      </p>
                    )}
                  </div>
                ))}
              </>
            )}
            
            {/* Fallback if no content */}
            {!hasNewFormat && !replySuggestions.replies?.length && (
              <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                No reply suggestions available
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const analysis = priorityAnalysis || {};
  const allPriorityEmails = useMemo(() => ([
    ...(priorityAnalysis?.high_priority || []),
    ...(priorityAnalysis?.medium_priority || []),
    ...(priorityAnalysis?.low_priority || []),
  ]), [priorityAnalysis]);
  const selectedEmailData = useMemo(() => {
    if (!allPriorityEmails.length) return null;
    return allPriorityEmails.find((email) => email.email_id === selectedEmail) || allPriorityEmails[0];
  }, [allPriorityEmails, selectedEmail]);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl animate-fade-in">
        {/* Header with Active Provider Badge */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Inbox className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} />
              <span className="badge badge-primary">
                <Sparkles className="w-3 h-3" />
                AI-Powered
              </span>
              {activeProvider && (
                <span className="badge badge-secondary">
                  {activeProvider === 'gmail' ? '📧 Gmail' : '📮 Outlook'}
                </span>
              )}
            </div>
            <h1 style={{ color: 'var(--text-primary)' }}>Priority Inbox</h1>
            <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
              {activeProvider 
                ? `AI-prioritized emails from ${activeProvider === 'gmail' ? 'Gmail' : 'Outlook'}`
                : 'Connect an email provider to get started'}
            </p>
          </div>
          
          {activeProvider && (
            <Button
              onClick={runPriorityAnalysis}
              disabled={analyzing}
              className="btn-primary"
            >
              {analyzing ? (
                <>
                  
                  Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Analyze Inbox
                </>
              )}
            </Button>
          )}
        </div>

        {/* Connection Status - Show if no provider connected */}
        {checkingConnection ? (
          <PageLoadingState message="Checking email connection..." />
        ) : !activeProvider ? (
          <div 
            className="text-center py-16 rounded-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
          >
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <Mail className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              No Email Provider Connected
            </h3>
            <p className="mb-6 max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
              Connect Gmail or Outlook to enable AI-powered email prioritization
            </p>
            <Button onClick={handleConnect} className="btn-primary">
              <ArrowRight className="w-4 h-4 mr-2" />
              Connect Email Provider
            </Button>
          </div>
        ) : null}

        {/* Strategic Insights Banner */}
        {analysis.strategic_insights && (
          <div 
            className="p-5 rounded-xl"
            style={{ 
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}
          >
            <div className="flex items-start gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--accent-primary)' }}
              >
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Strategic Insight
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {analysis.strategic_insights}
                </p>
              </div>
            </div>
          </div>
        )}

        {priorityAnalysis && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3" data-testid="priority-inbox-summary-grid">
            {[
              ['High priority', (priorityAnalysis.high_priority || []).length, '#EF4444'],
              ['Medium priority', (priorityAnalysis.medium_priority || []).length, '#F59E0B'],
              ['Low priority', (priorityAnalysis.low_priority || []).length, '#10B981'],
              ['Analyzed', priorityAnalysis.total_analyzed || allPriorityEmails.length, '#3B82F6'],
            ].map(([label, value, color]) => (
              <div key={label} className="p-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#94A3B8' }}>{label}</p>
                <p className="mt-2 text-2xl font-bold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <PageLoadingState message="Loading priority inbox..." />
        ) : inboxLoadError && !priorityAnalysis ? (
          <PageErrorState
            error={inboxLoadError}
            onRetry={() => fetchPriorityInbox(activeProvider)}
            moduleName="Priority Inbox"
          />
        ) : !priorityAnalysis ? (
          /* Empty State */
          <div 
            className="text-center py-16 rounded-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
          >
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              <Mail className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              No Priority Analysis Yet
            </h3>
            <p className="mb-6 max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
              Click "Analyze Inbox" to let AI prioritize your emails based on your business goals and relationships.
            </p>
            <Button onClick={runPriorityAnalysis} disabled={analyzing} className="btn-primary">
              {analyzing ? (
                <>
                  
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Analyze My Inbox
                </>
              )}
            </Button>
          </div>
        ) : (
          /* Priority Sections */
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.75fr)]" data-testid="priority-inbox-command-grid">
            <div className="space-y-4">
              {priorityAnalysis?.from_cache && (
                <p className="text-xs text-center" style={{ color: '#64748B' }}>
                  Showing cached results · <button className="underline" style={{ color: '#FF6A00' }} onClick={runPriorityAnalysis}>Refresh now</button>
                </p>
              )}
              <div className="rounded-xl border px-4 py-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }} data-testid="priority-inbox-guidance-card">
                <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#94A3B8' }}>Command centre flow</p>
                <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Open the highest-risk thread first, validate BIQc’s rationale, then trigger a reply or reclassify before the customer signal degrades.</p>
              </div>
              <PrioritySection
                title="High Priority"
                emails={priorityAnalysis.high_priority || []}
                priority="high"
                icon={AlertCircle}
                color="#EF4444"
              />
              <PrioritySection
                title="Medium Priority"
                emails={priorityAnalysis.medium_priority || []}
                priority="medium"
                icon={Clock}
                color="#F59E0B"
              />
              <PrioritySection
                title="Low Priority"
                emails={priorityAnalysis.low_priority || []}
                priority="low"
                icon={CheckCircle2}
                color="#10B981"
              />
            </div>
            <div className="space-y-4" data-testid="priority-inbox-detail-column">
              <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }} data-testid="priority-inbox-detail-panel">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#94A3B8' }}>Selected thread</p>
                    <p className="mt-2 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedEmailData?.subject || 'Select a thread'}</p>
                  </div>
                  {selectedEmailData && <PriorityBadge level={selectedEmailData.user_override || selectedEmailData.priority_level || 'medium'} />}
                </div>
                {selectedEmailData ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-lg border p-4" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-light)' }}>
                      <p className="text-xs text-[#94A3B8]">From</p>
                      <p className="mt-1 text-sm text-[#F4F7FA]">{selectedEmailData.from}</p>
                      <p className="mt-2 text-xs text-[#64748B]">{selectedEmailData.received ? new Date(selectedEmailData.received).toLocaleString() : 'No timestamp available'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em]" style={{ color: '#94A3B8' }}>Why BIQc ranked this</p>
                      <p className="mt-2 text-sm text-[#CBD5E1]">{selectedEmailData.reason || 'This thread intersects with customer, commercial, or timing pressure.'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em]" style={{ color: '#94A3B8' }}>Recommended action</p>
                      <p className="mt-2 text-sm text-[#CBD5E1]">{selectedEmailData.suggested_action || 'Review thread context and send a decisive response.'}</p>
                    </div>
                    {selectedEmailData.snippet && (
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em]" style={{ color: '#94A3B8' }}>Preview</p>
                        <p className="mt-2 text-sm text-[#9FB0C3]">{selectedEmailData.snippet}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => fetchReplySuggestions(selectedEmailData.email_id)} className="btn-primary" data-testid="priority-inbox-generate-reply-button">
                        <Sparkles className="w-4 h-4 mr-2" />Generate reply
                      </Button>
                      <Button variant="outline" onClick={() => reclassifyEmail(selectedEmailData.email_id, 'high')} data-testid="priority-inbox-mark-high-button">
                        Mark high
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[#64748B]">Select a priority email from the left column to view full context and act faster.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Last Analyzed */}
        {priorityAnalysis?.analyzed_at && (
          <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Last analyzed: {new Date(priorityAnalysis.analyzed_at).toLocaleString()}
          </p>
        )}
      </div>

      {/* Reply Suggestions Modal */}
      {loadingReplies && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div 
            className="p-8 rounded-2xl text-center"
            style={{ background: 'var(--bg-primary)' }}
          >
            <PageLoadingState message="Generating smart replies..." compact />
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Analyzing context and crafting responses
            </p>
          </div>
        </div>
      )}
      
      <ReplySuggestionsModal />
    </DashboardLayout>
  );
};

export default EmailInbox;
