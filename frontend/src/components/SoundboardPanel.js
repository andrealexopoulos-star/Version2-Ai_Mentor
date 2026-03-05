import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Video, X, MessageSquare, Clock, ChevronDown, Database, CheckCircle2, XCircle, Plus, Trash2, Download, FileText, Zap, Eye } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useSupabaseAuth, supabase } from '../context/SupabaseAuthContext';

const MONO = "'JetBrains Mono', monospace";
const BODY = "'Inter', sans-serif";
const HEAD = "'Cormorant Garamond', Georgia, serif";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Data query detection — ONLY route to integration Edge Function for EXPLICIT data retrieval requests.
// Must NOT intercept strategic advisory questions that happen to mention business terms.
const DATA_QUERY_PATTERNS = [
  /^show me (my )?(pipeline|deals|invoices|revenue|leads|contacts|spend)/i,
  /^what (is|was|are) (my |our )?(total |current )?(pipeline|revenue|spend|overdue|outstanding)/i,
  /^how much (did|have|has|do)/i,
  /^how many (deals|leads|contacts|invoices|clients)/i,
  /^(list|give me|pull up) (my |our )?(deals|invoices|pipeline|leads|contacts)/i,
  /^what('s| is) (my |our )?(pipeline value|revenue figure|total spend)/i,
];
function isDataQuery(msg) {
  const lower = msg.trim().toLowerCase();
  // Only match explicit data retrieval requests — not strategic questions
  return DATA_QUERY_PATTERNS.some(pattern => pattern.test(lower));
}

const SCAN_USAGE_CACHE_KEY = 'biqc_scan_usage_cache';
const SCAN_USAGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const SoundboardPanel = ({ actionMessage, onActionConsumed }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);

  // ── Server-side scan usage (Supabase) ──
  const [scanUsage, setScanUsage] = useState(null); // null = loading
  const [recordingScans, setRecordingScans] = useState({});
  const { session } = useSupabaseAuth();

  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);

  // Fetch scan usage from Supabase backend on mount — with 5-minute sessionStorage cache
  const fetchScanUsage = useCallback(async (forceRefresh = false) => {
    try {
      // Try sessionStorage cache first
      if (!forceRefresh) {
        const cached = sessionStorage.getItem(SCAN_USAGE_CACHE_KEY);
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < SCAN_USAGE_CACHE_TTL) { setScanUsage(data); return; }
        }
      }
      const res = await apiClient.get('/soundboard/scan-usage');
      setScanUsage(res.data);
      sessionStorage.setItem(SCAN_USAGE_CACHE_KEY, JSON.stringify({ data: res.data, ts: Date.now() }));
    } catch {
      setScanUsage({ calibration_complete: false, is_paid: false, exposure_scan: { can_run: true, days_until_next: 0 }, forensic_calibration: { can_run: true, days_until_next: 0 } });
    }
  }, []);

  // Load conversations + welcome message based on server state
  useEffect(() => {
    apiClient.get('/soundboard/conversations').then(res => {
      const convs = res.data?.conversations || [];
      setConversations(convs);
      // Welcome message: show if user has NO prior conversations (server truth, no localStorage)
      if (convs.length === 0) {
        setMessages([{
          role: 'assistant',
          text: "Good to meet you. I'm your Strategic Intelligence Advisor — I have access to your business data and I'm here to help you make better decisions, faster.\n\nWhen the data tells me something clearly, I'll tell you directly. When I need more context, I'll ask you one specific question. No waffle, no hedging.\n\nWhat's on your mind right now?",
        }]);
      }
    }).catch(() => {});
    fetchScanUsage();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const executeMessage = async (userMsg, fullMessage) => {
    const msgToSend = fullMessage || userMsg;
    setLoading(true);
    try {
      if (isDataQuery(msgToSend)) {
        const result = await queryIntegrationData(msgToSend);
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
        message: msgToSend,
        conversation_id: activeConvId,
      });
      if (res.data?.reply) {
        const assistantMsg = { role: 'assistant', text: res.data.reply };
        if (res.data?.file) assistantMsg.file = res.data.file;
        setMessages(prev => [...prev, assistantMsg]);
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
    if ((!input.trim() && !attachedFile) || loading) return;
    const userMsg = input.trim();
    setInput('');

    let fullMessage = userMsg;
    let displayText = userMsg;
    if (attachedFile) {
      if (attachedFile.type === 'text' && attachedFile.content) {
        const preview = attachedFile.content.slice(0, 3000);
        fullMessage = `${userMsg ? userMsg + '\n\n' : ''}Attached file: ${attachedFile.name}\n\nContent:\n${preview}${attachedFile.content.length > 3000 ? '\n\n[...truncated]' : ''}`;
        displayText = userMsg || `Analysing: ${attachedFile.name}`;
      } else {
        fullMessage = `${userMsg ? userMsg + '\n\n' : ''}File attached: ${attachedFile.name} (${attachedFile.hint || 'describe what you need'})`;
        displayText = userMsg || `Attached: ${attachedFile.name}`;
      }
      setAttachedFile(null);
    }

    if (!fullMessage.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text: displayText }]);
    await executeMessage(displayText, fullMessage);
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
    e.target.value = '';
    const MAX_SIZE = 500 * 1024;
    const isText = /\.(txt|csv|md|json|log|xml|html|py|js|ts|sql)$/i.test(file.name) || file.type.startsWith('text/');
    if (isText && file.size < MAX_SIZE) {
      const reader = new FileReader();
      reader.onload = (ev) => setAttachedFile({ name: file.name, content: ev.target.result, size: file.size, type: 'text' });
      reader.readAsText(file);
    } else if (file.size > MAX_SIZE) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'File too large (max 500KB for text files). Try pasting key sections directly.' }]);
    } else {
      setAttachedFile({ name: file.name, content: null, size: file.size, type: 'binary', hint: 'Describe what you need from this file' });
    }
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

      {/* Top Action Buttons — server-side enforced via Supabase */}
      <div className="px-3 pt-2 pb-1.5 shrink-0 space-y-1.5" style={{ borderBottom: '1px solid #1E293B' }}>

        {/* Complete Calibration — only shown if NOT yet complete */}
        {scanUsage && !scanUsage.calibration_complete && (
          <a href="/calibration"
            className="flex items-center gap-2 px-3 py-2 rounded-xl w-full text-xs font-medium transition-all hover:brightness-110"
            style={{ background: '#FF6A0015', border: '1px solid #FF6A0030', color: '#FF6A00', fontFamily: MONO }}
            data-testid="sb-calibration-btn">
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1">Complete Calibration</span>
            <ChevronDown className="w-3 h-3 -rotate-90" />
          </a>
        )}

        {/* Forensic Market Exposure — free tier: 1/month, paid: unlimited */}
        {(() => {
          const scan = scanUsage?.exposure_scan;
          const canRun = !scanUsage || scan?.can_run;
          const daysLeft = scan?.days_until_next || 0;
          const isPaid = scanUsage?.is_paid;

          return (
            <button
              disabled={!canRun && !isPaid}
              onClick={async () => {
                if (!canRun && !isPaid) return;
                // Record in Supabase first
                if (!isPaid) {
                  setRecordingScans(prev => ({ ...prev, exposure_scan: true }));
                  try {
                    await apiClient.post('/soundboard/record-scan', { feature_name: 'exposure_scan' });
                    sessionStorage.removeItem(SCAN_USAGE_CACHE_KEY); // Invalidate cache
                    await fetchScanUsage(true); // Force fresh fetch
                  } catch {}
                  setRecordingScans(prev => ({ ...prev, exposure_scan: false }));
                }
                window.location.href = '/exposure-scan';
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl w-full text-xs font-medium transition-all"
              style={{
                background: canRun || isPaid ? '#3B82F615' : '#243140',
                border: `1px solid ${canRun || isPaid ? '#3B82F630' : '#1E293B'}`,
                color: canRun || isPaid ? '#3B82F6' : '#4A5568',
                fontFamily: MONO,
                cursor: canRun || isPaid ? 'pointer' : 'not-allowed',
              }}
              data-testid="sb-exposure-scan-btn">
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1">
                {recordingScans.exposure_scan ? 'Recording...' :
                  !canRun && !isPaid ? `Forensic Market Exposure (available in ${daysLeft}d)` :
                  'Forensic Market Exposure'}
              </span>
              {!canRun && !isPaid && <Clock className="w-3 h-3 opacity-50" />}
            </button>
          );
        })()}
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
              {/* File download card */}
              {msg.file && (
                <a href={msg.file.download_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg"
                  style={{ background: '#FF6A0015', border: '1px solid #FF6A0030', textDecoration: 'none' }}>
                  <Download className="w-3.5 h-3.5 text-[#FF6A00] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold truncate" style={{ color: '#FF6A00', fontFamily: MONO }}>{msg.file.name}</p>
                    <p className="text-[9px]" style={{ color: '#64748B', fontFamily: MONO }}>{msg.file.type} · {Math.round((msg.file.size || 0) / 1024)}KB</p>
                  </div>
                </a>
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
        {/* Attachment preview */}
        {attachedFile && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg" style={{ background: '#141C26', border: '1px solid rgba(255,106,0,0.3)' }}>
            <FileText className="w-3 h-3 shrink-0" style={{ color: '#FF6A00' }} />
            <span className="flex-1 text-[10px] truncate" style={{ color: '#F4F7FA', fontFamily: MONO }}>{attachedFile.name}</span>
            {attachedFile.type === 'text' && <span className="text-[9px]" style={{ color: '#10B981', fontFamily: MONO }}>ready</span>}
            <button onClick={() => setAttachedFile(null)} className="p-0.5 rounded" style={{ color: '#64748B' }}>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="rounded-2xl flex items-end gap-1 p-1.5" style={{ background: '#141C26', border: `1px solid ${attachedFile ? 'rgba(255,106,0,0.4)' : '#1E293B'}` }}>
          <input type="file" ref={fileRef} className="hidden" onChange={handleFileSelect} accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.png,.jpg,.md,.json,.py,.js" />
          <button onClick={() => fileRef.current?.click()} className="p-2 rounded-xl hover:bg-white/5 transition-colors shrink-0" data-testid="sb-upload">
            <Paperclip className="w-4 h-4" style={{ color: attachedFile ? '#FF6A00' : '#64748B' }} />
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
            placeholder={attachedFile ? `Ask about ${attachedFile.name}...` : "Ask anything..."}
            rows={1}
            className="flex-1 px-2 py-2 text-sm outline-none resize-none bg-transparent"
            style={{ color: '#F4F7FA', fontFamily: BODY, maxHeight: '120px' }}
            data-testid="sb-input"
          />
          <button onClick={sendMessage} disabled={(!input.trim() && !attachedFile) || loading}
            className="p-2 rounded-xl shrink-0 transition-all disabled:opacity-20"
            style={{ background: (input.trim() || attachedFile) ? '#FF6A00' : 'transparent' }}
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
