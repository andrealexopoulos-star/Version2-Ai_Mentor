import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Video, X, MessageSquare, Clock, ChevronDown, Database, CheckCircle2, XCircle, Plus, Trash2, Download, FileText, Zap, Eye } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useSupabaseAuth, supabase } from '../context/SupabaseAuthContext';
import { trackEvent, EVENTS, trackActivationStep, trackOnceForUser } from '../lib/analytics';
import DataCoverageGate from './DataCoverageGate';
import { CheckInAlerts } from './CheckInAlerts';
import { fontFamily } from '../design-system/tokens';
import { isPrivilegedUser } from '../lib/privilegedUser';
import VoiceChat from './VoiceChat';


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
  /analy[sz]e.*\b(inbox|sent|deleted|trash)\b/i,
  /cross[- ]integration analytics/i,
  /(merge|integration).*(insights|analytics|analysis)/i,
];
function isDataQuery(msg) {
  const lower = msg.trim().toLowerCase();
  // Only match explicit data retrieval requests — not strategic questions
  return DATA_QUERY_PATTERNS.some(pattern => pattern.test(lower));
}

const SCAN_USAGE_CACHE_KEY = 'biqc_scan_usage_cache';
const SCAN_USAGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getSoundboardErrorMessage = (error) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  const reply = error?.response?.data?.reply;
  if (typeof reply === 'string' && reply.trim()) return reply;
  return 'Connection issue. Try again.';
};

const SoundboardPanel = ({ actionMessage, onActionConsumed }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [selectedMode, setSelectedMode] = useState('auto');
  const [selectedAgent, setSelectedAgent] = useState('auto');
  const [showHistory, setShowHistory] = useState(false);
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  // ── Coverage gate state ──
  const [coverageGate, setCoverageGate] = useState(null); // {guardrail, coveragePct, missingFields}

  // ── Server-side scan usage (Supabase) ──
  const [scanUsage, setScanUsage] = useState(null); // null = loading
  const [recordingScans, setRecordingScans] = useState({});
  const { session, user } = useSupabaseAuth();
  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || '';
  const userTier = String(user?.subscription_tier || 'free').toLowerCase();
  const isAndre = isPrivilegedUser(user);

  const BIQC_MODES = [
    { id: 'auto', label: 'BIQc Auto', desc: 'Smart mode — BIQc picks the best approach for your question', icon: '⚡', backend_mode: 'auto', minTier: 'free' },
    { id: 'normal', label: 'Normal', desc: 'Default paid conversation mode', icon: '◉', backend_mode: 'normal', minTier: 'foundation' },
    { id: 'thinking', label: 'Deep Thinking', desc: 'High-depth strategic reasoning mode', icon: '🧠', backend_mode: 'thinking', minTier: 'foundation' },
    { id: 'pro', label: 'Pro Analysis', desc: 'Expanded multi-domain executive analysis', icon: '✦', backend_mode: 'pro', minTier: 'foundation' },
    { id: 'trinity', label: 'BIQc Trinity', desc: 'Consensus intelligence across BIQc model pathways', icon: '◈', backend_mode: 'trinity', minTier: 'pro' },
  ];
  const BIQC_AGENTS = [
    { id: 'auto', label: 'Auto', shortDesc: 'Pick specialist by question', icon: '⚡' },
    { id: 'boardroom', label: 'Boardroom', shortDesc: 'CEO/CFO/COO/CTO/HR/CCO council', icon: '🏛️' },
    { id: 'general', label: 'Strategic Advisor', shortDesc: 'Full picture & priorities', icon: '◎' },
    { id: 'finance', label: 'Finance', shortDesc: 'Cash, revenue, margins', icon: '💰' },
    { id: 'sales', label: 'Sales', shortDesc: 'Pipeline & deals', icon: '📊' },
    { id: 'marketing', label: 'Marketing', shortDesc: 'Campaigns & positioning', icon: '📣' },
    { id: 'risk', label: 'Risk', shortDesc: 'Compliance & exposure', icon: '🛡️' },
    { id: 'operations', label: 'Operations', shortDesc: 'Workflow & capacity', icon: '⚙️' },
    { id: 'strategy', label: 'Strategy', shortDesc: 'Planning & scenarios', icon: '🎯' },
  ];

  const tierRank = { free: 0, starter: 0, foundation: 1, growth: 2, custom: 3, pro: 2, enterprise: 3 };
  const isPaidUser = (tierRank[userTier] ?? 0) >= 1;
  const canUseTrinity = isAndre || ['pro', 'enterprise', 'growth', 'custom'].includes(userTier);
  const availableModes = BIQC_MODES.filter((mode) => {
    if (isAndre) return true;
    if (mode.id === 'trinity') return canUseTrinity;
    return (tierRank[userTier] ?? 0) >= (tierRank[mode.minTier] ?? 0);
  });
  const activeMode = availableModes.find((mode) => mode.id === selectedMode) || availableModes[0] || BIQC_MODES[0];
  const activeAgent = BIQC_AGENTS.find((agent) => agent.id === selectedAgent) || BIQC_AGENTS[0];

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
          text: "Hey — I'm your BIQc business advisor. I can see your connected business data (CRM, accounting, email) and I'm here to help you make smarter decisions, faster.\n\nI'll be straight with you: when the data is clear, I'll tell you exactly what's happening. When I need more info, I'll ask one clear question.\n\nWhat's on your mind?",
        }]);
      }
    }).catch(() => {});
    fetchScanUsage();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isPaidUser && selectedMode === 'auto') {
      setSelectedMode('normal');
      return;
    }
    if (!availableModes.some((mode) => mode.id === selectedMode)) {
      setSelectedMode(isPaidUser ? 'normal' : 'auto');
    }
  }, [isPaidUser, selectedMode, availableModes]);

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
        mode: activeMode?.backend_mode || 'auto',
        agent_id: selectedAgent || 'auto',
      });
      if (res.data?.reply) {
        const assistantMsg = { role: 'assistant', text: res.data.reply };
        if (res.data?.agent_name) assistantMsg.agent_name = res.data.agent_name;
        if (res.data?.file) assistantMsg.file = res.data.file;
        setMessages(prev => [...prev, assistantMsg]);
        if (res.data.conversation_id && !activeConvId) {
          setActiveConvId(res.data.conversation_id);
          setConversations(prev => [{ id: res.data.conversation_id, title: res.data.conversation_title || 'New chat', updated_at: new Date().toISOString() }, ...prev]);
        }

        // ── Coverage gate + telemetry ──
        const guardrail = res.data?.guardrail;
        const coveragePct = res.data?.coverage_pct ?? null;
        const missingFields = res.data?.missing_fields || [];

        if (guardrail) {
          // Emit telemetry
          const eventName = guardrail === 'BLOCKED' ? 'ai_response_blocked'
            : guardrail === 'DEGRADED' ? 'ai_response_degraded' : 'ai_response_full';
          trackEvent(eventName, { coverage_pct: coveragePct, missing_count: missingFields.length });

          if (guardrail === 'BLOCKED') {
            setCoverageGate({ guardrail: 'BLOCKED', coveragePct, missingFields });
          } else if (guardrail === 'DEGRADED') {
            setCoverageGate({ guardrail: 'DEGRADED', coveragePct, missingFields });
          } else {
            setCoverageGate(null);
          }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', text: getSoundboardErrorMessage(error) }]);
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
    trackEvent(EVENTS.SOUNDBOARD_QUERY, { message_length: fullMessage.length, has_attachment: !!attachedFile });
    trackOnceForUser(EVENTS.ACTIVATION_FIRST_SOUNDBOARD_USE, user?.id, { entrypoint: 'soundboard_panel' });
    trackActivationStep('first_soundboard_use', { entrypoint: 'soundboard_panel' });
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
    <div className="flex flex-col h-full" style={{ background: 'var(--biqc-bg-input)' }} data-testid="soundboard-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--biqc-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#FF6A0020' }}>
            <MessageSquare className="w-3.5 h-3.5 text-[#FF6A00]" />
          </div>
          <span className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>SoundBoard</span>
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
      <div className="px-3 pt-2 pb-1.5 shrink-0 space-y-1.5" style={{ borderBottom: '1px solid var(--biqc-border)' }}>

        {/* Complete Calibration — only shown if NOT yet complete */}
        {scanUsage && !scanUsage.calibration_complete && (
          <a href="/calibration"
            className="flex items-center gap-2 px-3 py-2 rounded-xl w-full text-xs font-medium transition-all hover:brightness-110"
            style={{ background: '#FF6A0015', border: '1px solid #FF6A0030', color: '#FF6A00', fontFamily: fontFamily.mono }}
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
                border: `1px solid ${canRun || isPaid ? '#3B82F630' : '#243140'}`,
                color: canRun || isPaid ? '#3B82F6' : '#64748B',
                fontFamily: fontFamily.mono,
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

      <div className="px-3 pt-2 shrink-0" data-testid="soundboard-checkin-alerts-slot">
        <CheckInAlerts />
      </div>

      {/* History dropdown */}
      {showHistory && (
        <div className="border-b overflow-y-auto max-h-60 shrink-0" style={{ borderColor: 'var(--biqc-border)', background: '#0D1420' }}>
          <div className="p-2">
            <p className="text-[10px] uppercase tracking-wider px-2 py-1 mb-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Recent conversations</p>
            {conversations.length === 0 && <p className="text-xs text-[#64748B] px-2 py-2">No conversations yet</p>}
            {conversations.slice(0, 15).map(c => (
              <button key={c.id} onClick={() => loadConversation(c)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors truncate ${activeConvId === c.id ? 'bg-white/10 text-[#F4F7FA]' : 'text-[#9FB0C3] hover:bg-white/5'}`}
                style={{ fontFamily: fontFamily.body }}>
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
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: '#FF6A0015' }}>
              <Zap className="w-6 h-6" style={{ color: '#FF6A00' }} />
            </div>
            <p className="text-base font-semibold mb-1" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>
              {firstName ? `${firstName}, your advisor is ready.` : 'Your advisor is ready.'}
            </p>
            <p className="text-xs mb-6 max-w-[240px]" style={{ color: '#64748B', fontFamily: fontFamily.body }}>
              I've read your business data. Ask me anything specific — deals, cash flow, risks, competitors.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-[300px]">
              {[
                'What needs my attention this week?',
                'Show me stalled deals',
                'How is my cash flow?',
                'What are my biggest risks?',
              ].map(q => (
                <button key={q} onClick={() => setInput(q)}
                  className="text-[11px] px-3 py-2 rounded-lg transition-all hover:bg-[#FF6A00]/10 hover:border-[#FF6A00]/30"
                  style={{ background: 'var(--biqc-bg-card)', color: 'var(--biqc-text-2)', border: '1px solid var(--biqc-border)', fontFamily: fontFamily.mono }}>
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
                border: msg.role === 'user' ? 'none' : '1px solid #243140',
                fontFamily: fontFamily.body,
                whiteSpace: 'pre-line',
                borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
              }}>
              {msg.role === 'assistant' && msg.agent_name && (
                <p className="text-[10px] font-medium mb-1" style={{ color: '#60A5FA', fontFamily: fontFamily.mono }}>
                  {msg.agent_name}
                </p>
              )}
              {msg.type === 'integration_prompt' && <Database className="w-3.5 h-3.5 text-[#F59E0B] inline mr-1.5 -mt-0.5" />}
              {msg.text}
              {msg.sources?.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {msg.sources.map((s, j) => (
                    <span key={j} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#10B98110', color: '#10B981', fontFamily: fontFamily.mono }}>{s}</span>
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
                    <p className="text-[11px] font-semibold truncate" style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>{msg.file.name}</p>
                    <p className="text-[9px]" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>{msg.file.type} · {Math.round((msg.file.size || 0) / 1024)}KB</p>
                  </div>
                </a>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 rounded-2xl text-sm flex items-center gap-2" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', borderRadius: '20px 20px 20px 4px' }}>
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
      <div className="px-3 pb-3 pt-2 shrink-0" style={{ borderTop: '1px solid var(--biqc-border)' }}>
        {/* Coverage gate — shown above input when blocked or degraded */}
        {coverageGate && (
          <DataCoverageGate
            guardrail={coverageGate.guardrail}
            coveragePct={coverageGate.coveragePct}
            missingFields={coverageGate.missingFields}
            compact={coverageGate.guardrail === 'DEGRADED'}
            data-testid="soundboard-coverage-gate"
          />
        )}
        {/* Attachment preview */}
        {attachedFile && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--biqc-bg-card)', border: '1px solid rgba(255,106,0,0.3)' }}>
            <FileText className="w-3 h-3 shrink-0" style={{ color: '#FF6A00' }} />
            <span className="flex-1 text-[10px] truncate" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.mono }}>{attachedFile.name}</span>
            {attachedFile.type === 'text' && <span className="text-[9px]" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>ready</span>}
            <button onClick={() => setAttachedFile(null)} className="p-0.5 rounded" style={{ color: '#64748B' }}>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="mb-2 relative flex items-center gap-2" data-testid="soundboard-panel-mode-wrapper">
          <div className="relative">
            <button
              onClick={() => { setShowModeMenu((v) => !v); setShowAgentMenu(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all hover:brightness-110"
              style={{ background: 'rgba(255,106,0,0.1)', border: '1px solid rgba(255,106,0,0.2)', color: '#FF6A00', fontFamily: fontFamily.mono }}
              data-testid="soundboard-panel-mode-selector"
            >
              <span>{activeMode?.icon}</span>
              <span>{activeMode?.label}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showModeMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl overflow-hidden shadow-xl z-50"
                style={{ background: '#0F1720', border: '1px solid #1E2D3D' }}>
                {availableModes.map((mode, idx) => (
                  <button
                    key={mode.id}
                    onClick={() => { setSelectedMode(mode.id); setShowModeMenu(false); }}
                    className="w-full flex items-start gap-2 px-3 py-2 text-left transition-all hover:bg-white/5"
                    style={{ borderBottom: idx < availableModes.length - 1 ? '1px solid #1E2D3D' : 'none' }}
                    data-testid={`soundboard-panel-mode-option-${mode.id}`}
                  >
                    <span className="text-sm shrink-0">{mode.icon}</span>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: selectedMode === mode.id ? '#FF6A00' : '#F4F7FA', fontFamily: fontFamily.body }}>{mode.label}</p>
                      <p className="text-[10px]" style={{ color: '#64748B', fontFamily: fontFamily.body }}>{mode.desc}</p>
                    </div>
                  </button>
                ))}

                {!canUseTrinity && (
                  <a href="/biqc-foundation" className="block px-3 py-2 text-[10px] no-underline"
                    style={{ color: '#64748B', fontFamily: fontFamily.body }} data-testid="soundboard-panel-trinity-upgrade-link">
                    Unlock BIQc Trinity: get consensus intelligence across BIQc pathways.
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => { setShowAgentMenu((v) => !v); setShowModeMenu(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#3B82F6', fontFamily: fontFamily.mono }}
              data-testid="soundboard-panel-agent-selector"
            >
              <span>{activeAgent.icon}</span>
              <span>{activeAgent.label}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showAgentMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-60 rounded-xl overflow-hidden shadow-xl z-50"
                style={{ background: '#0F1720', border: '1px solid #1E2D3D' }}>
                <p className="px-3 py-1.5 text-[9px] uppercase tracking-wider" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Agent persona</p>
                {BIQC_AGENTS.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => { setSelectedAgent(agent.id); setShowAgentMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left transition-all hover:bg-white/5"
                    style={{ borderTop: '1px solid #1E2D3D' }}
                    data-testid={`soundboard-panel-agent-option-${agent.id}`}
                  >
                    <span className="text-sm shrink-0">{agent.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: selectedAgent === agent.id ? '#3B82F6' : '#F4F7FA', fontFamily: fontFamily.body }}>
                        {agent.label}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: '#64748B', fontFamily: fontFamily.body }}>
                        {agent.shortDesc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl flex items-end gap-1 p-1.5" style={{ background: 'var(--biqc-bg-card)', border: `1px solid ${attachedFile ? 'rgba(255,106,0,0.4)' : '#243140'}` }}>
          <input type="file" ref={fileRef} className="hidden" onChange={handleFileSelect} accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.png,.jpg,.md,.json,.py,.js" />
          <button onClick={() => fileRef.current?.click()} className="p-2 rounded-xl hover:bg-white/5 transition-colors shrink-0" data-testid="sb-upload">
            <Paperclip className="w-4 h-4" style={{ color: attachedFile ? '#FF6A00' : '#64748B' }} />
          </button>
          <button className="p-2 rounded-xl hover:bg-white/5 transition-colors shrink-0" data-testid="sb-video"
            onClick={() => setShowVoiceChat(true)}>
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
            style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.body, maxHeight: '120px' }}
            data-testid="sb-input"
          />
          <button onClick={sendMessage} disabled={(!input.trim() && !attachedFile) || loading}
            className="p-2 rounded-xl shrink-0 transition-all disabled:opacity-20"
            style={{ background: (input.trim() || attachedFile) ? '#FF6A00' : 'transparent' }}
            data-testid="sb-send">
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-[9px] text-[#64748B] text-center mt-1.5" style={{ fontFamily: fontFamily.mono }}>
          BIQc uses connected data only. No fabrication.
        </p>
      </div>
      {showVoiceChat && (
        <VoiceChat
          onClose={() => setShowVoiceChat(false)}
          onSwitchToText={() => setShowVoiceChat(false)}
        />
      )}
    </div>
  );
};

export default SoundboardPanel;
