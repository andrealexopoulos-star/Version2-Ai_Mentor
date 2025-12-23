import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ScrollArea } from '../components/ui/scroll-area';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { Send, Loader2, Sparkles, RotateCcw, MessageSquare } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const contextTypes = [
  { value: 'general', label: 'General Advice' },
  { value: 'business_analysis', label: 'Business Analysis' },
  { value: 'sop_generator', label: 'Operations & SOPs' },
  { value: 'market_analysis', label: 'Market & Competition' },
  { value: 'financial', label: 'Financial Strategy' },
];

const suggestedPrompts = [
  "Help me analyze my business model and identify growth opportunities",
  "What are the key metrics I should track for my SMB?",
  "Create a customer onboarding process for my service business",
  "How can I improve my cash flow management?",
  "What marketing strategies work best for small businesses?",
];

const Advisor = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextType, setContextType] = useState('general');
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await axios.post(`${API}/chat`, {
        message: userMessage,
        context_type: contextType,
        session_id: sessionId
      });

      setSessionId(response.data.session_id);
      setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);
    } catch (error) {
      toast.error('Failed to get response. Please try again.');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handlePromptClick = (prompt) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const startNewChat = () => {
    setMessages([]);
    setSessionId(null);
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
      <div className="h-screen flex flex-col" data-testid="advisor-page">
        {/* Header */}
        <div className="border-b border-[#e5e5e5] bg-white px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif text-[#0f2f24]">AI Advisor</h1>
            <p className="text-sm text-[#0f2f24]/60">Your strategic business partner</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={contextType} onValueChange={setContextType}>
              <SelectTrigger className="w-48 bg-white" data-testid="context-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {contextTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {messages.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={startNewChat}
                className="border-[#0f2f24] text-[#0f2f24]"
                data-testid="new-chat-btn"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                New Chat
              </Button>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <ScrollArea className="flex-1 p-6">
          {messages.length === 0 ? (
            <div className="max-w-3xl mx-auto pt-12">
              <div className="text-center mb-12">
                <div className="w-16 h-16 bg-[#ccff00] rounded-sm flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-8 h-8 text-[#0f2f24]" />
                </div>
                <h2 className="text-3xl font-serif text-[#0f2f24] mb-3">
                  Hello, {user?.name?.split(' ')[0]}
                </h2>
                <p className="text-[#0f2f24]/60 max-w-md mx-auto">
                  I'm your strategic business advisor. Ask me anything about growing your business, 
                  optimizing operations, or creating professional documentation.
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-[#0f2f24]/60 text-center">Try asking:</p>
                <div className="grid gap-3 max-w-2xl mx-auto">
                  {suggestedPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handlePromptClick(prompt)}
                      className="text-left p-4 bg-white border border-[#e5e5e5] rounded-sm hover:border-[#0f2f24] transition-colors group"
                      data-testid={`suggested-prompt-${i}`}
                    >
                      <div className="flex items-start gap-3">
                        <MessageSquare className="w-5 h-5 text-[#0f2f24]/40 group-hover:text-[#0f2f24] mt-0.5" />
                        <span className="text-[#0f2f24]">{prompt}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`message-bubble animate-fade-in ${
                    msg.role === 'user' ? 'message-user' : 'message-ai'
                  }`}
                  data-testid={`message-${i}`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="markdown-content">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              ))}
              {loading && (
                <div className="message-bubble message-ai animate-fade-in">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-[#0f2f24]/60">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="chat-input-area">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="flex gap-3">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your business..."
                className="flex-1 min-h-[56px] max-h-[200px] resize-none bg-[#f5f5f0] border-0 focus:ring-2 focus:ring-[#0f2f24]"
                disabled={loading}
                data-testid="chat-input"
              />
              <Button 
                type="submit" 
                disabled={!input.trim() || loading}
                className="btn-forest h-14 w-14 rounded-sm p-0"
                data-testid="send-message-btn"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-[#0f2f24]/40 mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Advisor;
