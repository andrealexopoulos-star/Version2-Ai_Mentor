import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent } from '../components/ui/card';
import { apiClient } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { Send, Loader2, Target, TrendingUp, DollarSign, Zap, Users, RotateCcw } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';

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
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [showFocusAreas, setShowFocusAreas] = useState(true);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

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
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="border-b" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-card)' }}>
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-serif" style={{ color: 'var(--text-primary)' }}>MyAdvisor</h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Your personal business mentor</p>
            </div>
            {messages.length > 0 && (
              <Button onClick={handleNewSession} variant="outline" className="btn-secondary">
                <RotateCcw className="w-4 h-4 mr-2" />
                New Session
              </Button>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-secondary)' }}>
          <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Focus Area Cards - Show at start */}
            {showFocusAreas && messages.length === 0 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-serif mb-2" style={{ color: 'var(--text-primary)' }}>
                    What would you like to work on today?
                  </h2>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    Choose a focus area and I'll guide you step by step
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {focusAreas.map((area) => {
                    const Icon = area.icon;
                    return (
                      <button
                        key={area.id}
                        onClick={() => handleFocusAreaSelect(area)}
                        className="text-left p-6 rounded-xl border-2 transition-all hover:shadow-lg"
                        style={{
                          borderColor: 'var(--border-medium)',
                          background: 'var(--bg-card)'
                        }}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: `${area.color}15` }}
                          >
                            <Icon className="w-6 h-6" style={{ color: area.color }} />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                              {area.title}
                            </h3>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                              {area.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="text-center mt-8">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Or type your question below to start
                  </p>
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((message, index) => (
              <div
                key={index}
                className={`mb-6 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 flex-shrink-0"
                    style={{ background: 'var(--accent-primary)' }}
                  >
                    <span className="text-white font-semibold">SS</span>
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-4 ${
                    message.role === 'user'
                      ? 'rounded-br-sm'
                      : 'rounded-bl-sm'
                  }`}
                  style={{
                    background: message.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-card)',
                    color: message.role === 'user' ? 'white' : 'var(--text-primary)',
                    border: message.role === 'user' ? 'none' : '1px solid var(--border-light)'
                  }}
                >
                  {message.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none" style={{ color: 'var(--text-secondary)' }}>
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-white">{message.content}</p>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start mb-6">
                <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 flex-shrink-0"
                  style={{ background: 'var(--accent-primary)' }}
                >
                  <span className="text-white font-semibold">SS</span>
                </div>
                <div className="rounded-2xl rounded-bl-sm px-5 py-4 border"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}
                >
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-card)' }}>
          <div className="max-w-4xl mx-auto px-6 py-4">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your question or answer here..."
                className="flex-1 min-h-[60px] max-h-[200px] resize-none"
                style={{ background: 'var(--bg-primary)' }}
              />
              <Button
                type="submit"
                disabled={!input.trim() || loading}
                className="btn-primary h-[60px] px-6"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </form>
            <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Advisor;
