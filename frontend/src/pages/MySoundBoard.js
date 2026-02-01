import { useState, useRef, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { apiClient } from '../lib/api';
import { useMobileDrawer } from '../context/MobileDrawerContext';
import { toast } from 'sonner';
import { 
  MessageSquare, Send, Plus, Trash2, Edit2, Check, X,
  Loader2, ChevronLeft, ChevronRight, MoreVertical, Video, Phone
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import VoiceChat from '../components/VoiceChat';

const MySoundBoard = () => {
  const { isChatOpen, openChat, closeAll } = useMobileDrawer();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    // Only scroll if there are messages (not on initial load)
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchConversations = async () => {
    try {
      setLoadingConversations(true);
      const response = await apiClient.get('/soundboard/conversations');
      setConversations(response.data.conversations || []);
    } catch (error) {
      console.error('Failed to fetch conversations');
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadConversation = async (conversationId) => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/soundboard/conversations/${conversationId}`);
      setActiveConversation(conversationId);
      setMessages(response.data.messages || []);
    } catch (error) {
      toast.error('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  const startNewConversation = () => {
    setActiveConversation(null);
    setMessages([]);
    setInput('');
    inputRef.current?.focus();
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // Fetch current intelligence state from BIQC Insights
      const intelligenceContext = JSON.parse(localStorage.getItem('biqc_intelligence_state') || '{}');
      
      const response = await apiClient.post('/soundboard/chat', {
        message: userMessage,
        conversation_id: activeConversation,
        intelligence_context: intelligenceContext
      });

      const { reply, conversation_id, conversation_title } = response.data;
      
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      
      // If this was a new conversation, update the state
      if (!activeConversation && conversation_id) {
        setActiveConversation(conversation_id);
        // Add to conversations list
        setConversations(prev => [{
          id: conversation_id,
          title: conversation_title || 'New Conversation',
          updated_at: new Date().toISOString()
        }, ...prev]);
      } else {
        // Update conversation in list
        setConversations(prev => prev.map(c => 
          c.id === conversation_id 
            ? { ...c, updated_at: new Date().toISOString() }
            : c
        ));
      }
    } catch (error) {
      toast.error('Failed to send message');
      setMessages(prev => prev.slice(0, -1)); // Remove optimistic user message
    } finally {
      setLoading(false);
    }
  };

  const deleteConversation = async (conversationId, e) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;

    try {
      await apiClient.delete(`/soundboard/conversations/${conversationId}`);
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (activeConversation === conversationId) {
        startNewConversation();
      }
      toast.success('Conversation deleted');
    } catch (error) {
      toast.error('Failed to delete conversation');
    }
  };

  const renameConversation = async (conversationId) => {
    if (!editingTitle.trim()) {
      setEditingId(null);
      return;
    }

    try {
      await apiClient.patch(`/soundboard/conversations/${conversationId}`, {
        title: editingTitle.trim()
      });
      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, title: editingTitle.trim() } : c
      ));
      setEditingId(null);
      toast.success('Renamed');
    } catch (error) {
      toast.error('Failed to rename');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <DashboardLayout>
      <div className="flex h-full relative">
        {/* Sidebar - Desktop: static, Mobile: overlay */}
        <div 
          className={`
            ${isChatOpen ? 'translate-x-0' : '-translate-x-full'} 
            lg:translate-x-0 
            fixed lg:relative 
            left-0 top-0 
            w-72 h-full 
            transition-transform duration-300 
            flex-shrink-0 border-r overflow-hidden z-50 lg:z-auto
          `}
          style={{ borderColor: 'var(--border-light)', background: 'var(--bg-secondary)' }}
        >
          <div className="w-72 h-full flex flex-col">
            {/* New Chat Button */}
            <div className="p-4">
              <Button
                onClick={startNewConversation}
                className="w-full btn-primary justify-start gap-2"
              >
                <Plus className="w-4 h-4" />
                New Conversation
              </Button>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {loadingConversations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    No conversations yet
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => loadConversation(conv.id)}
                      className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                        activeConversation === conv.id ? 'bg-opacity-100' : 'hover:bg-opacity-50'
                      }`}
                      style={{ 
                        background: activeConversation === conv.id ? 'var(--bg-tertiary)' : 'transparent'
                      }}
                    >
                      <MessageSquare className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                      
                      {editingId === conv.id ? (
                        <div className="flex-1 flex items-center gap-1">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') renameConversation(conv.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="flex-1 px-2 py-1 text-sm rounded"
                            style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button onClick={() => renameConversation(conv.id)} className="p-1">
                            <Check className="w-3 h-3 text-green-500" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1">
                            <X className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                              {conv.title || 'New Conversation'}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {formatTime(conv.updated_at)}
                            </p>
                          </div>
                          
                          <div className="hidden group-hover:flex items-center gap-1">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(conv.id);
                                setEditingTitle(conv.title || '');
                              }}
                              className="p-1 rounded hover:bg-black/10"
                            >
                              <Edit2 className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                            </button>
                            <button 
                              onClick={(e) => deleteConversation(conv.id, e)}
                              className="p-1 rounded hover:bg-red-100"
                            >
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Toggle Sidebar Button */}
        <button
          onClick={() => isChatOpen ? closeAll() : openChat()}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-r-lg lg:block hidden"
          style={{ 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-light)',
            borderLeft: 'none',
            left: isChatOpen ? '288px' : '0'
          }}
        >
          {isChatOpen ? (
            <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          ) : (
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          )}
        </button>
        
        {/* Mobile: Backdrop overlay */}
        {isChatOpen && (
          <div 
            className="fixed inset-0 bg-black/40 lg:hidden z-40"
            onClick={closeAll}
            aria-hidden="true"
          />
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 w-full lg:w-auto overflow-hidden"
>
          {/* Header */}
          <div 
            className="px-6 py-4 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--border-light)', background: 'var(--bg-card)' }}
          >
            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                MySoundBoard
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Your thinking partner for clarity
              </p>
            </div>
            
            {/* Voice Call Button */}
            <Button 
              onClick={() => setShowVoiceChat(true)}
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              <Video className="w-4 h-4" />
              Start Voice Call
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto touch-pan-y" style={{ background: 'var(--bg-primary)', WebkitOverflowScrolling: 'touch', minHeight: 0 }}>
            <div className="max-w-3xl mx-auto px-6 py-6">
              {messages.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'var(--bg-tertiary)' }}
                  >
                    <MessageSquare className="w-7 h-7" style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Type a message below to start
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                          message.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'
                        }`}
                        style={{
                          background: message.role === 'user' 
                            ? 'var(--accent-primary)' 
                            : 'var(--bg-card)',
                          color: message.role === 'user' 
                            ? 'white' 
                            : 'var(--text-primary)',
                          border: message.role === 'user' 
                            ? 'none' 
                            : '1px solid var(--border-light)'
                        }}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {loading && (
                    <div className="flex justify-start">
                      <div 
                        className="px-4 py-3 rounded-2xl rounded-bl-md"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* Input Area */}
          <div 
            className="border-t px-6 py-4"
            style={{ borderColor: 'var(--border-light)', background: 'var(--bg-card)' }}
          >
            <div className="max-w-3xl mx-auto">
              <div 
                className="flex items-end gap-3 p-3 rounded-xl"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Share what's on your mind..."
                  className="flex-1 resize-none bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text-primary)', minHeight: '24px', maxHeight: '120px' }}
                  rows={1}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="btn-primary p-2"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                Press Enter to send • Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Voice Chat Modal */}
      {showVoiceChat && (
        <VoiceChat 
          onClose={() => setShowVoiceChat(false)}
          onSwitchToText={() => setShowVoiceChat(false)}
        />
      )}
    </DashboardLayout>
  );
};

export default MySoundBoard;
