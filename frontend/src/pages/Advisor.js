import { useState, useRef, useEffect } from 'react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { apiClient } from '../lib/api';
import { Send, Loader2, Target, TrendingUp, DollarSign, Zap, Users, RotateCcw } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';
import TypingInsights from '../components/TypingInsights';

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

// Proactivity Gate: validate trigger before auto-speaking
const validateProactiveTrigger = (trigger) => {
  if (!trigger) return null;
  
  // Must have trigger_source and confidence_level
  if (!trigger.trigger_source || !trigger.confidence_level) return null;
  
  // trigger_source must be valid
  if (!['Diagnosis', 'Inbox'].includes(trigger.trigger_source)) return null;
  
  // confidence_level must be valid
  if (!['High', 'Medium', 'Limited'].includes(trigger.confidence_level)) return null;
  
  return trigger;
};

const Advisor = () => {
  const { user } = useSupabaseAuth();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [showFocusAreas, setShowFocusAreas] = useState(true);
  const [focus, setFocus] = useState(null);
  const [proactiveTrigger, setProactiveTrigger] = useState(null);
  const [hasSpoken, setHasSpoken] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Check for proactive trigger on mount
  useEffect(() => {
    const checkProactiveTrigger = () => {
      // Check URL params for Diagnosis trigger
      const focusArea = searchParams.get('focus_area');
      const triggerSource = searchParams.get('trigger_source');
      const confidence = searchParams.get('confidence');
      
      if (focusArea && triggerSource === 'Diagnosis') {
        const trigger = validateProactiveTrigger({
          trigger_source: 'Diagnosis',
          focus_area: focusArea,
          confidence_level: confidence || 'Medium'
        });
        
        if (trigger) {
          setProactiveTrigger(trigger);
          setShowFocusAreas(false);
          return;
        }
      }
      
      // No valid trigger - load silently
      setProactiveTrigger(null);
    };
    
    checkProactiveTrigger();
    fetchFocus();
  }, [searchParams]);

  // Proactive message generation (only if valid trigger exists)
  useEffect(() => {
    const generateProactiveMessage = async () => {
      // Gate check: must have valid trigger and not already spoken
      if (!proactiveTrigger || hasSpoken || messages.length > 0) return;
      
      // Additional validation
      const validTrigger = validateProactiveTrigger(proactiveTrigger);
      if (!validTrigger) return;
      
      setHasSpoken(true);
      setLoading(true);
      
      try {
        // Build context-aware proactive prompt
        const contextPrompt = buildProactivePrompt(validTrigger);
        
        const response = await apiClient.post('/chat', {
          message: contextPrompt,
          context_type: 'proactive',
          metadata: {
            trigger_source: validTrigger.trigger_source,
            confidence_level: validTrigger.confidence_level,
            focus_area: validTrigger.focus_area
          }
        });
        
        // Add assistant's proactive message
        setMessages([{
          role: 'assistant',
          content: response.data.response,
          metadata: {
            trigger_source: validTrigger.trigger_source,
            confidence_level: validTrigger.confidence_level
          }
        }]);
        
        setSessionId(response.data.session_id);
      } catch (error) {
        console.error('Proactive message failed:', error);
        // Fail silently - don't show error, just let user interact naturally
      } finally {
        setLoading(false);
      }
    };
    
    generateProactiveMessage();
  }, [proactiveTrigger, hasSpoken, messages.length]);

  // Build proactive prompt based on trigger
  const buildProactivePrompt = (trigger) => {
    if (trigger.trigger_source === 'Diagnosis') {
      return `[PROACTIVE CONTEXT: User arrived from Business Diagnosis. Focus area: ${trigger.focus_area}. Confidence: ${trigger.confidence_level}.]
      
Provide a brief, direct observation about their ${trigger.focus_area} focus area. Do NOT ask "How can I help?" or similar. Make one specific observation or surface one consideration they may not have thought of. Be concise (2-3 sentences max).`;
    }
    
    if (trigger.trigger_source === 'Inbox') {
      return `[PROACTIVE CONTEXT: User has high-priority emails requiring attention. Confidence: ${trigger.confidence_level}.]
      
Acknowledge you've noticed activity in their inbox that may need attention. Do NOT ask "How can I help?" - instead, offer one specific observation. Be concise.`;
    }
    
    return '';
  };

  const fetchFocus = async () => {
    try {
      const response = await apiClient.get('/dashboard/focus');
      setFocus(response.data);
    } catch (error) {
      console.error('Failed to fetch focus:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFocusAreaSelect = async (area) => {
    setShowFocusAreas(false);
    const focusMessage = `I want to focus on ${area.title.toLowerCase()}`;
    await sendMessage(focusMessage);
  };

  const sendMessage = async (messageText) => {
    const userMessage = messageText || input.trim();
    if (!userMessage || loading) return;

    const newMessage = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await apiClient.post('/chat', {
        message: userMessage,
        session_id: sessionId,
        context_type: 'mentor'
      });

      const aiMessage = { 
        role: 'assistant', 
        content: response.data.response 
      };
      
      setMessages(prev => [...prev, aiMessage]);
      setSessionId(response.data.session_id);
    } catch (error) {
      toast.error('Failed to get response');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    sendMessage();
  };

  const handleNewSession = () => {
    setMessages([]);
    setSessionId(null);
    setShowFocusAreas(true);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)]">
        {/* Header - Mobile Optimized */}
        <div className="border-b flex-shrink-0" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-card)' }}>
          <div className="max-w-4xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-serif truncate" style={{ color: 'var(--text-primary)' }}>BIQc Insights</h1>
              <p className="text-xs sm:text-sm truncate" style={{ color: 'var(--text-muted)' }}>Evidence-backed insights for strategic decisions</p>
            </div>
            {messages.length > 0 && (
              <Button 
                onClick={handleNewSession} 
                variant="outline" 
                className="btn-secondary flex-shrink-0 h-9 sm:h-10 px-3 sm:px-4 text-sm touch-manipulation"
              >
                <RotateCcw className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">New Session</span>
              </Button>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-secondary)' }}>
          <div className="max-w-4xl mx-auto px-6 py-8">
            {/* AI Focus + Focus Area Cards - Show at start */}
            {showFocusAreas && messages.length === 0 && (
              <div className="space-y-8">
                {/* AI Focus Hero */}
                <div 
                  className="p-8 rounded-2xl"
                  style={{ 
                    background: focus?.type === 'action' 
                      ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, var(--bg-card) 100%)'
                      : focus?.type === 'stability'
                      ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, var(--bg-card) 100%)'
                      : 'linear-gradient(135deg, rgba(0, 102, 255, 0.08) 0%, var(--bg-card) 100%)',
                    border: focus?.type === 'action'
                      ? '1px solid rgba(245, 158, 11, 0.2)'
                      : focus?.type === 'stability'
                      ? '1px solid rgba(34, 197, 94, 0.2)'
                      : '1px solid rgba(0, 102, 255, 0.2)'
                  }}
                >
                  <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
                    Here's What Matters Right Now
                  </p>
                  <p 
                    className="text-2xl md:text-3xl font-serif leading-snug mb-3"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {focus?.focus || "Checking your business signals..."}
                  </p>
                  {focus?.context && (
                    <p 
                      className="text-base leading-relaxed"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {focus.context}
                    </p>
                  )}
                </div>

                {/* Focus Areas */}
                <div>
                  <h2 className="text-lg font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
                    What would you like to work on?
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {focusAreas.map((area) => {
                      const Icon = area.icon;
                      return (
                        <button
                          key={area.id}
                          onClick={() => handleFocusAreaSelect(area)}
                          className="text-left p-4 rounded-xl border transition-all hover:shadow-md"
                          style={{
                            borderColor: 'var(--border-light)',
                            background: 'var(--bg-card)'
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
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {area.description}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  Or type your question below to start a conversation
                </p>
              </div>
            )}

            {/* Messages */}
            {messages.map((message, index) => (
              <div
                key={index}
                className={`mb-4 ${message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}
              >
                <div
                  className={`max-w-[85%] ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-3xl rounded-br-md px-6 py-4'
                      : 'bg-white rounded-3xl rounded-bl-md px-6 py-4 shadow-sm border border-gray-100'
                  }`}
                  style={{
                    fontFamily: message.role === 'assistant' ? 'Georgia, Cambria, "Times New Roman", serif' : 'inherit'
                  }}
                >
                  <p 
                    className={`whitespace-pre-wrap leading-relaxed ${
                      message.role === 'user' ? 'text-white' : 'text-gray-800'
                    }`}
                    style={{ 
                      fontSize: '15px',
                      lineHeight: '1.6'
                    }}
                  >
                    {message.content}
                  </p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start mb-4">
                <div className="bg-white rounded-3xl rounded-bl-md px-6 py-4 shadow-sm border border-gray-100">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area - Fixed Bottom with Safe Area */}
        <div 
          className="border-t bg-white shadow-lg flex-shrink-0" 
          style={{ 
            borderColor: '#E5E7EB',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))'
          }}
        >
          <div className="max-w-4xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
            <form onSubmit={handleSubmit} className="flex gap-2 sm:gap-3 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="flex-1 min-h-[48px] max-h-[200px] resize-none bg-gray-50 border-gray-200 rounded-2xl px-4 py-3 focus:bg-white"
                style={{ 
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontSize: '16px' // Prevents iOS zoom
                }}
              />
              <Button
                type="submit"
                disabled={!input.trim() || loading}
                className="h-12 sm:h-14 px-4 sm:px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-sm touch-manipulation"
                style={{
                  minWidth: '48px',
                  minHeight: '48px'
                }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </form>
            <p className="text-xs mt-2 text-center text-gray-400">
              Press Enter to send • Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Advisor;
