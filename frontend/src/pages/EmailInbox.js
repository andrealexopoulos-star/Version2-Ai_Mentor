import { useState, useEffect } from 'react';
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

const EmailInbox = () => {
  const navigate = useNavigate();
  const [activeProvider, setActiveProvider] = useState(null); // 'gmail' or 'outlook' or null
  const [gmailConnected, setGmailConnected] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [connectedEmail, setConnectedEmail] = useState(null);
  const [priorityAnalysis, setPriorityAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [replySuggestions, setReplySuggestions] = useState(null);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [expandedSection, setExpandedSection] = useState('high');

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
      console.log("Querying email_connections for user:", session.user.id);
      
      const { data: rows, error } = await supabase
        .from('email_connections')
        .select('*')
        .eq('user_id', session.user.id);
      
      console.log("Query result:", { rows, error });
      
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
        console.log('No email provider connected');
        setGmailConnected(false);
        setOutlookConnected(false);
        setActiveProvider(null);
        setLoading(false);
        setCheckingConnection(false);
        return;
      }
      
      const connection = rows[0];
      console.log('Email connection found:', connection);
      
      // Set state and fetch inbox
      if (connection.provider === 'outlook') {
        setOutlookConnected(true);
        setGmailConnected(false);
        setActiveProvider('outlook');
        setConnectedEmail(connection.connected_email);
        fetchPriorityInbox('outlook');
      } else if (connection.provider === 'gmail') {
        setGmailConnected(true);
        setOutlookConnected(false);
        setActiveProvider('gmail');
        setConnectedEmail(connection.connected_email);
        fetchPriorityInbox('gmail');
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

  const fetchPriorityInbox = async (provider) => {
    try {
      setLoading(true);
      
      if (provider === 'gmail') {
        // Call Gmail Edge Function
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setLoading(false);
          return;
        }

        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
        const priorityUrl = `${supabaseUrl}/functions/v1/email_priority?provider=gmail`;
        
        const response = await fetch(priorityUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Gmail priority analysis failed:', response.status);
          setLoading(false);
          return;
        }

        const data = await response.json();
        
        if (data.ok) {
          setPriorityAnalysis({
            analysis: {
              high_priority: data.high_priority || [],
              medium_priority: data.medium_priority || [],
              low_priority: data.low_priority || [],
              strategic_insights: data.strategic_insights || ''
            },
            analyzed_at: new Date().toISOString()
          });
        }
      } else if (provider === 'outlook') {
        // Call Outlook Edge Function
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setLoading(false);
          return;
        }

        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
        const priorityUrl = `${supabaseUrl}/functions/v1/email_priority?provider=outlook`;
        
        const response = await fetch(priorityUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Outlook priority analysis failed:', response.status);
          setLoading(false);
          return;
        }

        const data = await response.json();
        
        if (data.ok) {
          setPriorityAnalysis({
            analysis: {
              high_priority: data.high_priority || [],
              medium_priority: data.medium_priority || [],
              low_priority: data.low_priority || [],
              strategic_insights: data.strategic_insights || ''
            },
            analyzed_at: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Priority inbox fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const runPriorityAnalysis = async () => {
    try {
      setAnalyzing(true);
      toast.info('Analyzing your inbox with AI... This may take a moment.');
      
      // Both Gmail and Outlook now use Edge Functions
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
      low: { bg: 'rgba(34, 197, 94, 0.1)', color: '#22C55E', icon: CheckCircle2 }
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
    const isSelected = selectedEmail === email.email_id;
    
    return (
      <div 
        className={`p-4 rounded-xl border transition-all cursor-pointer ${isSelected ? 'ring-2 ring-blue-500' : 'hover:border-blue-300'}`}
        style={{ 
          background: 'var(--bg-card)', 
          borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-light)'
        }}
        onClick={() => fetchReplySuggestions(email.email_id)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                style={{ background: 'var(--accent-primary)' }}
              >
                {(email.from || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {email.from || 'Unknown Sender'}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {email.received ? new Date(email.received).toLocaleDateString() : ''}
                </p>
              </div>
            </div>
            <h4 className="font-medium mb-1 line-clamp-1" style={{ color: 'var(--text-primary)' }}>
              {email.subject || 'No Subject'}
            </h4>
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              {email.reason}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              <span className="font-medium">Action:</span> {email.suggested_action}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <PriorityBadge level={priority} />
            <Button
              size="sm"
              className="btn-secondary text-xs"
              onClick={(e) => {
                e.stopPropagation();
                fetchReplySuggestions(email.email_id);
              }}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Suggest Reply
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
              <EmailCard key={idx} email={email} priority={priority} />
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
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${
                    replySuggestions.priority_level === 'high' ? 'bg-red-100 text-red-700' :
                    replySuggestions.priority_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
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
                className="p-2 rounded-lg hover:bg-gray-100"
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
                    <Button
                      size="sm"
                      className="btn-primary"
                      onClick={() => copyToClipboard(replySuggestions.suggested_reply)}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
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

  const analysis = priorityAnalysis?.analysis || {};

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
                  <Loader2 className="w-4 h-4 mr-2 " />
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
          <div className="flex items-center justify-center py-16">
            <span className="text-sm text-[#FF6A00]" style={{ fontFamily: "monospace" }}>loading...</span>
          </div>
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

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-sm text-[#FF6A00]" style={{ fontFamily: "monospace" }}>loading...</span>
            <p style={{ color: 'var(--text-muted)' }}>Loading priority inbox...</p>
          </div>
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
                  <Loader2 className="w-4 h-4 mr-2 " />
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
          <div className="space-y-4">
            <PrioritySection 
              title="High Priority" 
              emails={analysis.high_priority || []}
              priority="high"
              icon={AlertCircle}
              color="#EF4444"
            />
            <PrioritySection 
              title="Medium Priority" 
              emails={analysis.medium_priority || []}
              priority="medium"
              icon={Clock}
              color="#F59E0B"
            />
            <PrioritySection 
              title="Low Priority" 
              emails={analysis.low_priority || []}
              priority="low"
              icon={CheckCircle2}
              color="#22C55E"
            />
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
            <Loader2 className="w-8 h-8  mx-auto mb-4" style={{ color: 'var(--accent-primary)' }} />
            <p style={{ color: 'var(--text-primary)' }}>Generating smart replies...</p>
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
