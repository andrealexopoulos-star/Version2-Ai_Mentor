import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Video, X, MessageSquare, Clock, ChevronDown, Database, CheckCircle2, XCircle, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useSupabaseAuth, supabase } from '../context/SupabaseAuthContext';

const MONO = "'JetBrains Mono', monospace";
const BODY = "'Inter', sans-serif";
const HEAD = "'Cormorant Garamond', Georgia, serif";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const DATA_KEYWORDS = ['how much', 'how many', 'what was', 'what is', 'show me', 'total', 'pipeline', 'deals', 'contacts', 'invoices', 'revenue', 'spend', 'google ads', 'leads', 'clients', 'outstanding', 'overdue'];
function isDataQuery(msg) {
  const lower = msg.toLowerCase();
  return DATA_KEYWORDS.some(kw => lower.includes(kw));
}

const SoundboardPanel = ({ actionMessage, onActionConsumed }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const { session } = useSupabaseAuth();

  // Load conversation history
  useEffect(() => {
    apiClient.get('/soundboard/conversations').then(res => {
      setConversations(res.data?.conversations || []);
    }).catch(() => {});
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Handle action messages from insight cards
  useEffect(() => {
    if (actionMessage && actionMessage.trim()) {
      setInput('');
      setMessages(prev => [...prev, { role: 'user', text: actionMessage }]);
      executeMessage(actionMessage);
      if (onActionConsumed) onActionConsumed();
    }
  }, [actionMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  const queryIntegrationData = async (query) => {
    try {
      const token = session?.access_token;
      if (!token) return null;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/query-integrations-data`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'apikey': ANON_KEY },
        body: JSON.stringify({ query }),
      });
      if (res.ok) return await res.json();
    } catch {}
    return null;
  };

  const executeMessage = async (userMsg) => {
    setLoading(true);
    try {
      if (isDataQuery(userMsg)) {
        const result = await queryIntegrationData(userMsg);
        if (result?.status === 'not_connected') {
          setMessages(prev => [...prev, { role: 'assistant', text: result.message, type: 'integration_prompt' }]);
          setLoading(false);
          return;
        }
        if (result?.status === 'answered') {
          setMessages(prev => [...prev, { role: 'assistant', text: result.answer, sources: result.data_sources }]);
          setLoading(false);
          return;
        }
      }
      const res = await apiClient.post('/soundboard/chat', {
        message: userMsg,
        conversation_id: activeConvId,
      });
      if (res.data?.reply) {
        setMessages(prev => [...prev, { role: 'assistant', text: res.data.reply }]);
        if (res.data.conversation_id && !activeConvId) {
          setActiveConvId(res.data.conversation_id);
          setConversations(prev => [{ id: res.data.conversation_id, title: res.data.conversation_title || 'New chat', updated_at: new Date().toISOString() }, ...prev]);
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Connection issue. Try again.' }]);
    }
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    await executeMessage(userMsg);
  };

  const loadConversation = async (conv) => {
    setShowHistory(false);
    setActiveConvId(conv.id);
    try {
      const res = await apiClient.get(`/soundboard/conversations/${conv.id}`);
      setMessages((res.data?.messages || []).map(m => ({ role: m.role, text: m.content })));
    } catch {
      setMessages([]);
    }
  };

  const newChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setShowHistory(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessages(prev => [...prev, { role: 'user', text: `[Attached: ${file.name}]`, type: 'file' }]);
    setMessages(prev => [...prev, { role: 'assistant', text: 'File upload received. File analysis will be available when document processing is connected.' }]);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#0A1018' }} data-testid="soundboard-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid #1E293B' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#FF6A0020' }}>
            <MessageSquare className="w-3.5 h-3.5 text-[#FF6A00]" />
          </div>
          <span className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: HEAD }}>SoundBoard</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowHistory(!showHistory)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" data-testid="sb-history-btn">
            <Clock className="w-4 h-4 text-[#64748B]" />
          </button>
          <button onClick={newChat} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" data-testid="sb-new-chat">
            <Plus className="w-4 h-4 text-[#64748B]" />
          </button>
        </div>
      </div>

      {/* History dropdown */}
      {showHistory && (
        <div className="border-b overflow-y-auto max-h-60 shrink-0" style={{ borderColor: '#1E293B', background: '#0D1420' }}>
          <div className="p-2">
            <p className="text-[10px] uppercase tracking-wider px-2 py-1 mb-1" style={{ color: '#64748B', fontFamily: MONO }}>Recent conversations</p>
            {conversations.length === 0 && <p className="text-xs text-[#4A5568] px-2 py-2">No conversations yet</p>}
            {conversations.slice(0, 15).map(c => (
              <button key={c.id} onClick={() => loadConversation(c)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors truncate ${activeConvId === c.id ? 'bg-white/10 text-[#F4F7FA]' : 'text-[#9FB0C3] hover:bg-white/5'}`}
                style={{ fontFamily: BODY }}>
                {c.title || 'Untitled'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4" style={{ minHeight: 0 }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <MessageSquare className="w-10 h-10 mb-4 text-[#FF6A00]/20" />
            <p className="text-sm text-[#64748B] mb-1" style={{ fontFamily: BODY }}>Ask anything about your business</p>
            <p className="text-[11px] text-[#4A5568] mb-6" style={{ fontFamily: MONO }}>or click an insight to explore it here</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-[280px]">
              {['What should I focus on?', 'Show me my pipeline', 'Summarise my risks', 'How can I grow?'].map(q => (
                <button key={q} onClick={() => setInput(q)}
                  className="text-[11px] px-3 py-1.5 rounded-lg transition-colors hover:bg-white/10"
                  style={{ background: '#141C26', color: '#9FB0C3', border: '1px solid #1E293B', fontFamily: MONO }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed`}
              style={{
                background: msg.role === 'user' ? '#FF6A00' : '#141C26',
                color: msg.role === 'user' ? 'white' : '#D1D5DB',
                border: msg.role === 'user' ? 'none' : '1px solid #1E293B',
                fontFamily: BODY,
                whiteSpace: 'pre-line',
                borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
              }}>
              {msg.type === 'integration_prompt' && <Database className="w-3.5 h-3.5 text-[#F59E0B] inline mr-1.5 -mt-0.5" />}
              {msg.text}
              {msg.sources?.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {msg.sources.map((s, j) => (
                    <span key={j} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#10B98110', color: '#10B981', fontFamily: MONO }}>{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 rounded-2xl text-sm flex items-center gap-2" style={{ background: '#141C26', border: '1px solid #1E293B', borderRadius: '20px 20px 20px 4px' }}>
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="px-3 pb-3 pt-2 shrink-0" style={{ borderTop: '1px solid #1E293B' }}>
        <div className="rounded-2xl flex items-end gap-1 p-1.5" style={{ background: '#141C26', border: '1px solid #1E293B' }}>
          <input type="file" ref={fileRef} className="hidden" onChange={handleFileSelect} accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.png,.jpg" />
          <button onClick={() => fileRef.current?.click()} className="p-2 rounded-xl hover:bg-white/5 transition-colors shrink-0" data-testid="sb-upload">
            <Paperclip className="w-4 h-4 text-[#64748B]" />
          </button>
          <button className="p-2 rounded-xl hover:bg-white/5 transition-colors shrink-0" data-testid="sb-video"
            onClick={() => setMessages(prev => [...prev, { role: 'assistant', text: 'Video consultation will be available in the Pro plan. Stay tuned.' }])}>
            <Video className="w-4 h-4 text-[#64748B]" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Ask anything..."
            rows={1}
            className="flex-1 px-2 py-2 text-sm outline-none resize-none bg-transparent"
            style={{ color: '#F4F7FA', fontFamily: BODY, maxHeight: '120px' }}
            data-testid="sb-input"
          />
          <button onClick={sendMessage} disabled={!input.trim() || loading}
            className="p-2 rounded-xl shrink-0 transition-all disabled:opacity-20"
            style={{ background: input.trim() ? '#FF6A00' : 'transparent' }}
            data-testid="sb-send">
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-[9px] text-[#4A5568] text-center mt-1.5" style={{ fontFamily: MONO }}>
          BIQc uses connected data only. No fabrication.
        </p>
      </div>
    </div>
  );
};

export default SoundboardPanel;
