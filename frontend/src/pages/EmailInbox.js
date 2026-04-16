import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { apiClient } from '../lib/api';
import { supabase } from '../context/SupabaseAuthContext';
import { toast } from 'sonner';
import {
  Mail, AlertCircle, Clock, CheckCircle2,
  RefreshCw, Send, Sparkles,
  User, ArrowRight, Copy,
  TrendingUp, Target, Zap, X
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
  const [reclassifying, setReclassifying] = useState(null); // email_id being reclassified
  const [taskingEmail, setTaskingEmail] = useState(null);
  const [dismissingEmail, setDismissingEmail] = useState(null);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [folderMessages, setFolderMessages] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [priorityContract, setPriorityContract] = useState(null);

  useEffect(() => {
    checkConnections();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      fetchFolders(activeProvider);
      fetchFolderMessages(activeProvider, selectedFolder || 'inbox');
    }
  }, [activeProvider, selectedFolder]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchPriorityInbox = useCallback(async (provider) => {
    try {
      if (!provider) return;
      setLoading(true);
      setInboxLoadError(null);
      let latest = null;
      let fetchErrMsg = null;
      try {
        const existing = await apiClient.get('/email/priority-inbox');
        setPriorityContract(existing?.data || null);
        latest = normalizePriorityPayload(existing.data, { from_cache: false });
      } catch (error) {
        console.error('Priority inbox existing fetch failed:', error?.response?.data || error.message);
        fetchErrMsg = error?.response?.data?.detail || error?.message || 'Unable to load priority inbox.';
      }

      if (!latest) {
        try {
          const analyzed = await apiClient.post('/email/analyze-priority');
          setPriorityContract(analyzed?.data || null);
          latest = normalizePriorityPayload(analyzed.data, { from_cache: false, analyzed_at: new Date().toISOString() });
        } catch (error) {
          console.error('Priority inbox analysis failed:', error?.response?.data || error.message);
          const detail = error?.response?.data?.detail || error?.message || 'Priority Inbox is temporarily unavailable.';
          fetchErrMsg = fetchErrMsg || detail;
          toast.error(detail);
        }
      }

      if (latest) {
        setPriorityAnalysis(latest);
      } else if (fetchErrMsg) {
        setInboxLoadError(fetchErrMsg);
      }
    } catch (error) {
      console.error('Priority inbox fetch error:', error);
      setInboxLoadError(error?.message || 'Unable to load priority inbox.');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const fetchFolders = useCallback(async (provider) => {
    if (!provider) return;
    try {
      setLoadingFolders(true);
      const response = await apiClient.get(`/email/folders?provider=${encodeURIComponent(provider)}`);
      const serverFolders = response.data?.folders || [];
      setFolders(serverFolders);
    } catch (error) {
      console.error('Folder fetch error:', error);
      setFolders([]);
    } finally {
      setLoadingFolders(false);
    }
  }, []);

  const fetchFolderMessages = useCallback(async (provider, folderName) => {
    if (!provider || !folderName) return;
    try {
      const response = await apiClient.get(
        `/email/messages?provider=${encodeURIComponent(provider)}&folder=${encodeURIComponent(folderName)}&limit=30&offset=0`
      );
      const messages = (response.data?.messages || []).map((msg) => ({
        id: msg.id || msg.graph_message_id || msg.email_id,
        from: msg.from_name || msg.from_address || 'Unknown',
        subject: msg.subject || '(no subject)',
        received: msg.received_date || null,
        snippet: msg.body_preview || msg.snippet || '',
        web_link: msg.web_link || null,
      }));
      setFolderMessages(messages);
    } catch (error) {
      console.error('Message fetch error:', error);
      setFolderMessages([]);
    }
  }, []);

  // Reclassify an email (updates user_override in priority_inbox)
  const reclassifyEmail = async (emailId, newLevel) => {
    setReclassifying(emailId);
    try {
      await apiClient.post('/email/priority/reclassify', {
        email_id: emailId,
        provider: activeProvider,
        priority_level: newLevel,
      });
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

  const createEmailTask = async (email) => {
    if (!email?.email_id || !activeProvider) return;
    setTaskingEmail(email.email_id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error } = await supabase.from('email_tasks').insert({
        user_id: session.user.id,
        provider: activeProvider,
        email_id: email.email_id,
        task_text: email.suggested_action || `Respond to: ${email.subject || 'Email'}`,
        status: 'pending',
      });
      if (error) throw error;
      toast.success('Task created from email');
    } catch (error) {
      toast.error(error?.message || 'Failed to create task');
    } finally {
      setTaskingEmail(null);
    }
  };

  const dismissEmail = async (email) => {
    if (!email?.email_id || !activeProvider) return;
    setDismissingEmail(email.email_id);
    try {
      await apiClient.post('/email/priority/reclassify', {
        email_id: email.email_id,
        provider: activeProvider,
        priority_level: 'low',
      });
      setPriorityAnalysis(prev => {
        if (!prev) return prev;
        const allEmails = [
          ...(prev.high_priority || []),
          ...(prev.medium_priority || []),
          ...(prev.low_priority || []),
        ].map(item => item.email_id === email.email_id ? { ...item, user_override: 'low' } : item);
        return {
          ...prev,
          high_priority: allEmails.filter(item => (item.user_override || item.priority_level) === 'high'),
          medium_priority: allEmails.filter(item => (item.user_override || item.priority_level) === 'medium'),
          low_priority: allEmails.filter(item => (item.user_override || item.priority_level) === 'low'),
        };
      });
      toast.success('Dismissed to low priority');
    } catch (error) {
      toast.error(error?.message || 'Failed to dismiss email');
    } finally {
      setDismissingEmail(null);
    }
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

  const sendRecommendedReply = async () => {
    if (!replySuggestions?.suggested_reply || !selectedEmail) return;
    try {
      setSendingReply(true);
      const response = await apiClient.post('/email/send-recommended-reply', {
        email_id: selectedEmail,
        suggested_reply: replySuggestions.suggested_reply,
        subject: replySuggestions.original_subject || undefined,
      });
      const composeLink = response?.data?.compose_link;
      if (composeLink) {
        window.open(composeLink, '_blank', 'noopener,noreferrer');
      }
      toast.success('Reply opened in your mailbox composer.');
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to prepare send flow.');
    } finally {
      setSendingReply(false);
    }
  };

  const PriorityBadge = ({ level }) => {
    const styles = {
      high: { bg: 'var(--danger-wash)', color: 'var(--danger)', icon: AlertCircle },
      medium: { bg: 'var(--warning-wash)', color: 'var(--warning)', icon: Clock },
      low: { bg: 'var(--positive-wash)', color: 'var(--positive)', icon: CheckCircle2 }
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

  // -- removed EmailCard and PrioritySection (replaced by 3-panel inline layout) --

  const ReplySuggestionsModal = () => {
    if (!replySuggestions) return null;
    
    // Handle both new format (suggested_reply/advisor_rationale) and legacy format (replies array)
    const hasNewFormat = replySuggestions.suggested_reply !== undefined;
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div 
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
          style={{ background: 'var(--surface)' }}
        >
          <div className="sticky top-0 p-6 border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--ink-display)' }}>
                  {hasNewFormat ? 'BIQc Suggested Reply' : 'AI Reply Suggestions'}
                </h2>
                {replySuggestions.priority_level && (
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-medium mb-2"
                    style={{
                      background: replySuggestions.priority_level === 'high'
                        ? 'var(--danger-wash)'
                        : replySuggestions.priority_level === 'medium'
                          ? 'var(--warning-wash)'
                          : 'var(--positive-wash)',
                      color: replySuggestions.priority_level === 'high'
                        ? 'var(--danger)'
                        : replySuggestions.priority_level === 'medium'
                          ? 'var(--warning)'
                          : 'var(--positive)',
                    }}
                  >
                    {replySuggestions.priority_level.toUpperCase()} PRIORITY
                  </span>
                )}
                {replySuggestions.original_subject && (
                  <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                    Re: {replySuggestions.original_subject}
                  </p>
                )}
                {replySuggestions.from && (
                  <p className="text-sm" style={{ color: 'var(--ink-secondary)' }}>
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
                style={{ background: 'transparent', border: '1px solid var(--border)' }}
              >
                <X className="w-5 h-5" style={{ color: 'var(--ink-muted)' }} />
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
                    style={{ background: 'var(--info-wash)', border: '1px solid var(--info)' }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4" style={{ color: 'var(--info)' }} />
                      <span className="font-medium" style={{ color: 'var(--info)' }}>BIQc Advisor Rationale</span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--ink-secondary)' }}>
                      {replySuggestions.advisor_rationale}
                    </p>
                  </div>
                )}
                
                {/* Suggested Reply */}
                <div 
                  className="p-5 rounded-xl border"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      <span className="font-semibold" style={{ color: 'var(--ink-display)' }}>
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
                      <Button
                        size="sm"
                        onClick={sendRecommendedReply}
                        disabled={sendingReply}
                        style={{ background: 'var(--positive)', color: 'var(--ink-inverse)' }}
                      >
                        <Send className="w-3 h-3 mr-1" />
                        {sendingReply ? 'Preparing…' : 'Send via Mailbox'}
                      </Button>
                    </div>
                  </div>
                  
                  <div 
                    className="p-4 rounded-lg whitespace-pre-wrap text-sm"
                    style={{ background: 'var(--surface-sunken)', color: 'var(--ink)' }}
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
                    style={{ background: 'var(--info-wash)', border: '1px solid var(--info)' }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4" style={{ color: 'var(--info)' }} />
                      <span className="font-medium" style={{ color: 'var(--info)' }}>Strategic Insight</span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--ink-secondary)' }}>
                      {replySuggestions.context_insight}
                    </p>
                  </div>
                )}
                
                {replySuggestions.replies?.map((reply, idx) => (
                  <div 
                    key={idx}
                    className="p-5 rounded-xl border"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {reply.style === 'direct' && <Zap className="w-4 h-4 text-yellow-500" />}
                        {reply.style === 'relationship' && <User className="w-4 h-4 text-pink-500" />}
                        {reply.style === 'strategic' && <Target className="w-4 h-4 text-purple-500" />}
                        <span className="font-semibold capitalize" style={{ color: 'var(--ink-display)' }}>
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
                      <p className="text-sm mb-2" style={{ color: 'var(--ink-muted)' }}>
                        <span className="font-medium">Subject:</span> {reply.subject}
                      </p>
                    )}
                    
                    <div 
                      className="p-4 rounded-lg mb-3 whitespace-pre-wrap text-sm"
                      style={{ background: 'var(--surface-sunken)', color: 'var(--ink)' }}
                    >
                      {reply.body}
                    </div>
                    
                    {reply.strategic_note && (
                      <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                        <span className="font-medium">Why this works:</span> {reply.strategic_note}
                      </p>
                    )}
                  </div>
                ))}
              </>
            )}
            
            {/* Fallback if no content */}
            {!hasNewFormat && !replySuggestions.replies?.length && (
              <div className="text-center py-8" style={{ color: 'var(--ink-muted)' }}>
                No reply suggestions available
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const allPriorityEmails = useMemo(() => ([
    ...(priorityAnalysis?.high_priority || []),
    ...(priorityAnalysis?.medium_priority || []),
    ...(priorityAnalysis?.low_priority || []),
  ]), [priorityAnalysis]);

  // Compute messages for the active folder/filter
  const currentMessages = useMemo(() => {
    if (selectedFolder?.startsWith('priority-')) {
      const level = selectedFolder.replace('priority-', '');
      return priorityAnalysis?.[`${level}_priority`] || [];
    }
    if (selectedFolder === 'inbox' && priorityAnalysis) {
      return [
        ...(priorityAnalysis.high_priority || []),
        ...(priorityAnalysis.medium_priority || []),
        ...(priorityAnalysis.low_priority || []),
      ];
    }
    return folderMessages;
  }, [selectedFolder, priorityAnalysis, folderMessages]);

  // Compute the currently-selected email's full data
  const selectedEmailData = useMemo(() => {
    if (!selectedEmail) return null;
    const all = [
      ...(priorityAnalysis?.high_priority || []),
      ...(priorityAnalysis?.medium_priority || []),
      ...(priorityAnalysis?.low_priority || []),
    ];
    return all.find(e => e.email_id === selectedEmail) || folderMessages.find(e => (e.id || e.email_id) === selectedEmail) || null;
  }, [selectedEmail, priorityAnalysis, folderMessages]);

  const providerLabel = activeProvider === 'gmail' ? 'Gmail' : activeProvider === 'outlook' ? 'Outlook' : 'Email';

  // ──────────────────────────────────────────────
  //  RENDER
  // ──────────────────────────────────────────────
  return (
    <DashboardLayout>
      {/* Connection / loading gates */}
      {checkingConnection ? (
        <PageLoadingState message="Checking email connection..." />
      ) : !activeProvider ? (
        <div
          className="text-center py-16 rounded-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--elev-1)' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--surface-sunken)' }}
          >
            <Mail className="w-8 h-8" style={{ color: 'var(--ink-muted)' }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-display)' }}>
            No Email Provider Connected
          </h3>
          <p className="mb-6 max-w-md mx-auto" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>
            Connect Gmail or Outlook to enable AI-powered email prioritization
          </p>
          <Button onClick={handleConnect} className="btn-primary">
            <ArrowRight className="w-4 h-4 mr-2" />
            Connect Email Provider
          </Button>
        </div>
      ) : loading ? (
        <PageLoadingState message="Loading priority inbox..." />
      ) : inboxLoadError && !priorityAnalysis ? (
        <PageErrorState
          error={inboxLoadError}
          onRetry={() => fetchPriorityInbox(activeProvider)}
          moduleName="Priority Inbox"
        />
      ) : (
        /* ═══════════════════════════════════════════
           3-PANEL INBOX LAYOUT
           ═══════════════════════════════════════════ */
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
          {/* Compact header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', flexShrink: 0 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--lava)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)' }}>
                Inbox &middot; {providerLabel} &middot; Live
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-display)', fontSize: 22, letterSpacing: '-0.02em', marginTop: 2 }}>
                {allPriorityEmails.length || 0} emails <em style={{ fontStyle: 'italic', color: 'var(--lava)' }}>need a decision</em>
              </h1>
            </div>
            <Button onClick={runPriorityAnalysis} disabled={analyzing} className="btn-primary" style={{ flexShrink: 0 }}>
              {analyzing ? 'Analyzing...' : <><RefreshCw className="w-4 h-4 mr-2" />Analyze Inbox</>}
            </Button>
          </div>

          {/* Responsive breakpoints for inbox layout */}
          <style>{`
            @media (max-width: 1100px) {
              .inbox-shell { grid-template-columns: 320px 1fr !important; }
              .inbox-folders { display: none !important; }
            }
            @media (max-width: 800px) {
              .inbox-shell { grid-template-columns: 1fr !important; }
              .inbox-list { display: none !important; }
            }
            .inbox-msg-row {
              transition: background 150ms ease, border-color 150ms ease;
            }
            .inbox-msg-row:hover {
              background: var(--surface-2, var(--surface-sunken)) !important;
            }
          `}</style>

          {/* 3-panel grid */}
          <div className="inbox-shell" style={{ display: 'grid', gridTemplateColumns: '200px 360px 1fr', gap: 'var(--sp-4, 12px)', flex: 1, minHeight: 0 }}>

            {/* ── PANEL 1: FOLDERS ── */}
            <div className="inbox-folders" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 16, overflowY: 'auto' }}>
              {/* Mailbox */}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', marginBottom: 8 }}>Mailbox</div>
              {['inbox', 'sent', 'drafts', 'archive'].map(f => (
                <div
                  key={f}
                  onClick={() => setSelectedFolder(f)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--r-sm, 4px)', color: selectedFolder === f ? 'var(--lava)' : 'var(--ink-secondary)', background: selectedFolder === f ? 'var(--lava-wash, rgba(232,93,0,0.08))' : 'transparent', fontWeight: selectedFolder === f ? 500 : 400, fontSize: 13, cursor: 'pointer', marginBottom: 2, fontFamily: 'var(--font-ui)', transition: 'all 150ms ease' }}
                >
                  <Mail className="w-4 h-4" />
                  <span style={{ flex: 1 }}>{f.charAt(0).toUpperCase() + f.slice(1)}</span>
                  {f === 'inbox' && priorityAnalysis && (
                    <span style={{ padding: '1px 7px', borderRadius: 100, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, background: selectedFolder === f ? 'var(--lava)' : 'var(--surface-2)', color: selectedFolder === f ? 'white' : 'var(--ink-secondary)' }}>
                      {allPriorityEmails.length}
                    </span>
                  )}
                </div>
              ))}

              {/* Smart Folders */}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', marginTop: 16, marginBottom: 8 }}>Smart Folders</div>
              {['high', 'medium', 'low'].map(level => {
                const count = priorityAnalysis?.[`${level}_priority`]?.length || 0;
                const colors = { high: 'var(--danger)', medium: 'var(--warning)', low: 'var(--positive)' };
                return (
                  <div
                    key={level}
                    onClick={() => setSelectedFolder(`priority-${level}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--r-sm, 4px)', color: selectedFolder === `priority-${level}` ? colors[level] : 'var(--ink-secondary)', background: selectedFolder === `priority-${level}` ? `${colors[level]}10` : 'transparent', fontSize: 13, cursor: 'pointer', marginBottom: 2, fontFamily: 'var(--font-ui)', transition: 'all 150ms ease' }}
                  >
                    {level === 'high' ? <AlertCircle className="w-4 h-4" /> : level === 'medium' ? <Clock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span style={{ flex: 1 }}>{level.charAt(0).toUpperCase() + level.slice(1)} Priority</span>
                    {count > 0 && (
                      <span style={{ padding: '1px 7px', borderRadius: 100, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, background: `${colors[level]}15`, color: colors[level] }}>{count}</span>
                    )}
                  </div>
                );
              })}

              {/* Server labels */}
              {folders.length > 0 && (
                <>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', marginTop: 16, marginBottom: 8 }}>Labels</div>
                  {folders.filter(f => !['inbox','sent','drafts','archive'].includes(f.name?.toLowerCase())).slice(0, 8).map(f => (
                    <div
                      key={f.id || f.name}
                      onClick={() => setSelectedFolder(f.name || f.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--r-sm, 4px)', color: selectedFolder === (f.name || f.id) ? 'var(--lava)' : 'var(--ink-secondary)', background: selectedFolder === (f.name || f.id) ? 'var(--lava-wash, rgba(232,93,0,0.08))' : 'transparent', fontSize: 13, cursor: 'pointer', marginBottom: 2, fontFamily: 'var(--font-ui)', transition: 'all 150ms ease' }}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.display_name || f.name || f.id}</span>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* ── PANEL 2: MESSAGE LIST ── */}
            <div className="inbox-list" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* List header */}
              <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-display)' }}>
                  {selectedFolder?.startsWith('priority-')
                    ? `${selectedFolder.replace('priority-', '').charAt(0).toUpperCase()}${selectedFolder.replace('priority-', '').slice(1)} Priority`
                    : (selectedFolder || 'Inbox').charAt(0).toUpperCase() + (selectedFolder || 'Inbox').slice(1)}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted)' }}>{currentMessages.length} messages</span>
              </div>
              {/* Scrollable list */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {currentMessages.length === 0 && (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-muted)', fontSize: 13, fontFamily: 'var(--font-ui)' }}>
                    {!priorityAnalysis ? 'Click "Analyze Inbox" to prioritize your emails.' : 'No messages in this folder.'}
                  </div>
                )}
                {currentMessages.map((msg, idx) => {
                  const msgId = msg.email_id || msg.id;
                  const isActive = selectedEmail === msgId;
                  const isUnread = msg.priority_level === 'high' || !msg.read;
                  return (
                    <div
                      key={msgId || idx}
                      className="inbox-msg-row"
                      onClick={() => setSelectedEmail(msgId)}
                      style={{ padding: 16, borderBottom: '1px solid var(--border)', cursor: 'pointer', position: 'relative', background: isActive ? 'var(--lava-wash, rgba(232,93,0,0.08))' : 'transparent', borderLeft: isActive ? '3px solid var(--lava)' : '3px solid transparent', paddingLeft: isActive ? 13 : 16 }}
                    >
                      {isUnread && <div style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', width: 6, height: 6, background: 'var(--lava)', borderRadius: '50%' }} />}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 13, fontFamily: 'var(--font-ui)', color: isUnread ? 'var(--ink-display)' : 'var(--ink)', fontWeight: isUnread ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.from || 'Unknown'}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', flexShrink: 0 }}>{msg.received ? new Date(msg.received).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                      <div style={{ fontSize: 13, fontFamily: 'var(--font-ui)', color: 'var(--ink-display)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isUnread ? 600 : 400 }}>{msg.subject || '(no subject)'}</div>
                      <div style={{ fontSize: 12, fontFamily: 'var(--font-ui)', color: 'var(--ink-secondary)', marginTop: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>{msg.snippet || msg.reason || ''}</div>
                      {msg.priority_level && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 100, fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', fontWeight: 600, background: msg.priority_level === 'high' ? 'var(--danger-wash)' : msg.priority_level === 'medium' ? 'var(--warning-wash)' : 'var(--positive-wash)', color: msg.priority_level === 'high' ? 'var(--danger)' : msg.priority_level === 'medium' ? 'var(--warning)' : 'var(--positive)' }}>{msg.priority_level}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── PANEL 3: READING PANE ── */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: 'var(--elev-1)' }}>
              {selectedEmailData ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {/* Subject */}
                  <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink-display)', lineHeight: 1.15, marginBottom: 16 }}>
                      {selectedEmailData.subject || '(no subject)'}
                    </h2>
                    {/* From row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--lava), var(--lava-warm, #FF8A3D))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-inverse)', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                        {(selectedEmailData.from || 'U')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}>{selectedEmailData.from || 'Unknown'}</div>
                        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>
                          {selectedEmailData.received ? new Date(selectedEmailData.received).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </div>
                      {selectedEmailData.priority_level && <PriorityBadge level={selectedEmailData.user_override || selectedEmailData.priority_level} />}
                    </div>
                    {/* Toolbar */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                      <Button size="sm" onClick={() => fetchReplySuggestions(selectedEmailData.email_id)} style={{ background: 'var(--lava-wash, rgba(232,93,0,0.1))', color: 'var(--lava)', border: '1px solid var(--lava-ring, rgba(232,93,0,0.2))' }}>
                        <Sparkles className="w-3 h-3 mr-1.5" />Reply
                      </Button>
                      {selectedEmailData.web_link && (
                        <Button size="sm" variant="outline" onClick={() => window.open(selectedEmailData.web_link, '_blank', 'noopener,noreferrer')}>
                          <Send className="w-3 h-3 mr-1.5" />Open
                        </Button>
                      )}
                      <Button size="sm" variant="outline" disabled={taskingEmail === selectedEmailData.email_id} onClick={() => createEmailTask(selectedEmailData)}>
                        <Target className="w-3 h-3 mr-1.5" />{taskingEmail === selectedEmailData.email_id ? 'Creating...' : 'Task'}
                      </Button>
                      <Button size="sm" variant="outline" disabled={dismissingEmail === selectedEmailData.email_id} onClick={() => dismissEmail(selectedEmailData)}>
                        <X className="w-3 h-3 mr-1.5" />{dismissingEmail === selectedEmailData.email_id ? '...' : 'Dismiss'}
                      </Button>
                      {/* Reclassify dropdown-style buttons */}
                      {['high', 'medium', 'low'].filter(l => l !== (selectedEmailData.user_override || selectedEmailData.priority_level)).map(l => {
                        const clr = l === 'high' ? 'var(--danger)' : l === 'medium' ? 'var(--warning)' : 'var(--positive)';
                        return (
                          <Button key={l} size="sm" variant="outline" disabled={reclassifying === selectedEmailData.email_id} onClick={() => reclassifyEmail(selectedEmailData.email_id, l)} style={{ fontSize: 11 }}>
                            {reclassifying === selectedEmailData.email_id ? '...' : <><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: clr, marginRight: 4 }} />{l.charAt(0).toUpperCase() + l.slice(1)}</>}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Scrollable body area */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                    {/* Email body / snippet */}
                    {selectedEmailData.snippet && (
                      <div style={{ fontSize: 14, lineHeight: 1.7, fontFamily: 'var(--font-ui)', color: 'var(--ink)', whiteSpace: 'pre-wrap', marginBottom: 24 }}>
                        {selectedEmailData.snippet}
                      </div>
                    )}

                    {/* AI Brief card */}
                    {(selectedEmailData.reason || selectedEmailData.suggested_action) && (
                      <div style={{ background: 'linear-gradient(135deg, var(--lava-wash, rgba(232,93,0,0.06)), var(--surface))', border: '1px solid var(--lava-ring, rgba(232,93,0,0.15))', borderRadius: 'var(--r-lg)', padding: 20, marginBottom: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <Sparkles className="w-4 h-4" style={{ color: 'var(--lava)' }} />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)', color: 'var(--lava)', fontWeight: 600 }}>BIQc AI Brief</span>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, fontFamily: 'var(--font-ui)', color: 'var(--ink-secondary)' }}>
                          {selectedEmailData.reason && <li style={{ marginBottom: 6 }}><strong style={{ color: 'var(--ink-display)' }}>Why ranked:</strong> {selectedEmailData.reason}</li>}
                          {selectedEmailData.suggested_action && <li><strong style={{ color: 'var(--ink-display)' }}>Suggested action:</strong> {selectedEmailData.suggested_action}</li>}
                        </ul>
                      </div>
                    )}

                    {/* Quick-reply pill triggers */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {['Acknowledge & schedule', 'Request more info', 'Delegate to team'].map(label => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => fetchReplySuggestions(selectedEmailData.email_id)}
                          style={{ padding: '6px 14px', borderRadius: 100, fontSize: 12, fontFamily: 'var(--font-ui)', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-secondary)', cursor: 'pointer', transition: 'all 150ms ease' }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Empty reading pane */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-muted)' }}>
                  <Mail className="w-10 h-10" style={{ opacity: 0.3, marginBottom: 12 }} />
                  <p style={{ fontSize: 14, fontFamily: 'var(--font-ui)' }}>Select a message to read</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reply Suggestions Modal */}
      {loadingReplies && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="p-8 rounded-2xl text-center"
            style={{ background: 'var(--surface)' }}
          >
            <PageLoadingState message="Generating smart replies..." compact />
            <p className="text-sm mt-1" style={{ color: 'var(--ink-muted)' }}>
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
