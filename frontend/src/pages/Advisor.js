import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ScrollArea } from '../components/ui/scroll-area';
import { apiClient } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { Send, Loader2, Sparkles, RotateCcw, MessageSquare } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { toast } from 'sonner';



const contextTypes = [
  { value: 'general', label: 'General Strategy', icon: '💡' },
  { value: 'business_analysis', label: 'Business Analysis', icon: '📊' },
  { value: 'sop_generator', label: 'Operations & SOPs', icon: '📋' },
  { value: 'market_analysis', label: 'Market & Competition', icon: '🎯' },
  { value: 'financial', label: 'Financial Strategy', icon: '💰' },
];

const promptCategories = [
  {
    title: "🚀 Growth & Strategy",
    prompts: [
      "What are the top 3 growth opportunities for my business right now?",
      "How can I differentiate my business from competitors in my industry?",
      "What's the best pricing strategy for my type of business?",
    ]
  },
  {
    title: "⚙️ Operations & Efficiency",
    prompts: [
      "Help me identify bottlenecks in my business operations",
      "Create a daily workflow routine to maximize productivity",
      "What processes should I automate first?",
    ]
  },
  {
    title: "📈 Marketing & Sales",
    prompts: [
      "What marketing channels would work best for my business?",
      "Help me create a customer acquisition strategy",
      "How can I improve my customer retention rate?",
    ]
  },
  {
    title: "💵 Financial Health",
    prompts: [
      "How can I improve my cash flow management?",
      "What key financial metrics should I track weekly?",
      "Help me create a budget for the next quarter",
    ]
  }
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
            <h1 className="text-2xl font-serif text-[#0f2f24]">Strategy Squad</h1>
            <p className="text-sm text-[#0f2f24]/60">
              {user?.business_name ? `Advising ${user.business_name}` : 'Your AI business partner'}
            </p>
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
            <div className="max-w-4xl mx-auto pt-8">
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-[#ccff00] rounded-sm flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-8 h-8 text-[#0f2f24]" />
                </div>
                <h2 className="text-3xl font-serif text-[#0f2f24] mb-3">
                  Hey {user?.name?.split(' ')[0]}! 👋
                </h2>
                <p className="text-[#0f2f24]/60 max-w-lg mx-auto">
                  I'm your Strategy Squad advisor. 
                  {user?.business_name && <> I'm here to help <strong>{user.business_name}</strong> succeed.</>}
                  {user?.industry && <> I know the <strong>{user.industry}</strong> industry well.</>}
                  {' '}What would you like to work on today?
                </p>
              </div>

              {/* Quick Context Selector */}
              <div className="flex flex-wrap justify-center gap-2 mb-8">
                {contextTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setContextType(type.value)}
                    className={`px-4 py-2 rounded-full text-sm transition-all ${
                      contextType === type.value 
                        ? 'bg-[#0f2f24] text-white' 
                        : 'bg-white border border-[#e5e5e5] text-[#0f2f24] hover:border-[#0f2f24]'
                    }`}
                    data-testid={`context-quick-${type.value}`}
                  >
                    {type.icon} {type.label}
                  </button>
                ))}
              </div>

              {/* Prompt Categories */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {promptCategories.map((category, catIndex) => (
                  <div key={catIndex} className="bg-white border border-[#e5e5e5] rounded-sm p-5">
                    <h3 className="font-medium text-[#0f2f24] mb-4">{category.title}</h3>
                    <div className="space-y-2">
                      {category.prompts.map((prompt, i) => (
                        <button
                          key={i}
                          onClick={() => handlePromptClick(prompt)}
                          className="w-full text-left p-3 bg-[#f5f5f0] rounded-sm hover:bg-[#e8e8e3] transition-colors group text-sm"
                          data-testid={`prompt-${catIndex}-${i}`}
                        >
                          <div className="flex items-start gap-2">
                            <MessageSquare className="w-4 h-4 text-[#0f2f24]/40 group-hover:text-[#0f2f24] mt-0.5 flex-shrink-0" />
                            <span className="text-[#0f2f24]/80 group-hover:text-[#0f2f24]">{prompt}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Custom Question Hint */}
              <p className="text-center text-sm text-[#0f2f24]/50 mt-8">
                Or type your own question below — I'll tailor my advice to {user?.business_name || 'your business'}
              </p>
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
