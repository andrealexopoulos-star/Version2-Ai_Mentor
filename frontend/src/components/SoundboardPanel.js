import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Paperclip, Video, X, MessageSquare, Clock, ChevronDown, CheckCircle2, XCircle, Plus, Trash2, FileText, Zap, Eye } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useSupabaseAuth, supabase } from '../context/SupabaseAuthContext';
import { trackEvent, EVENTS, trackActivationStep, trackOnceForUser } from '../lib/analytics';
import DataCoverageGate from './DataCoverageGate';
import { CheckInAlerts } from './CheckInAlerts';
import { fontFamily } from '../design-system/tokens';
import { toast } from 'sonner';
import { getSoundboardPolicy, normalizeMessageContent, SOUND_BOARD_MODES } from '../lib/soundboardPolicy';
import { deriveSoundboardRequestScope } from '../lib/soundboardQueryRouting';
import {
  appendAskBiqcDelta,
  buildAskBiqcComposedMessage,
  buildAskBiqcComposerDraftFromAnswer,
  buildAskBiqcRequestPayload,
  buildBoardroomChecks,
  copyAskBiqcText,
  createAskBiqcPlaceholder,
  findPreviousAskBiqcUserPrompt,
  getAskBiqcCoverageGate,
  getAskBiqcMessageText,
  inferAskBiqcGenerationIntent,
  getSoundboardErrorMessage,
  markAskBiqcStreamingStopped,
  removeAskBiqcPlaceholder,
  replaceAskBiqcPlaceholder,
  resolveAskBiqcTrace,
  runAskBiqcTurn,
} from '../lib/soundboardRuntime';
import VoiceChat from './VoiceChat';
import AskBiqcMessageActions from './soundboard/AskBiqcMessageActions';
import AskBiqcAssistantResponse from './soundboard/AskBiqcAssistantResponse';
import AskBiqcSessionLineage from './soundboard/AskBiqcSessionLineage';
import BoardroomCouncilCard from './soundboard/BoardroomCouncilCard';


// Data query detection — ONLY route to integration Edge Function for EXPLICIT data retrieval requests.
// Must NOT intercept strategic advisory questions that happen to mention business terms.
const SCAN_USAGE_CACHE_KEY = 'biqc_scan_usage_cache';
const SCAN_USAGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const SoundboardPanel = ({ actionMessage, onActionConsumed }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [selectedMode, setSelectedMode] = useState('auto');
  const [selectedAgent, setSelectedAgent] = useState('auto');
  const [deepForensicRun, setDeepForensicRun] = useState(false);
  const [boardroomNarrationIndex, setBoardroomNarrationIndex] = useState(0);
  const [boardroomProgress, setBoardroomProgress] = useState(12);
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
  const policy = getSoundboardPolicy(user);

  const BIQC_AGENTS = [
    { id: 'auto', label: 'Auto', shortDesc: 'Pick specialist by question', icon: '⚡' },
    { id: 'boardroom', label: 'Boardroom', shortDesc: 'CEO/Finance/Marketing/Ops/Risk council', icon: '🏛️' },
    { id: 'general', label: 'Strategic Advisor', shortDesc: 'Full picture & priorities', icon: '◎' },
    { id: 'finance', label: 'Finance', shortDesc: 'Cash, revenue, margins', icon: '💰' },
    { id: 'sales', label: 'Sales', shortDesc: 'Pipeline & deals', icon: '📊' },
    { id: 'marketing', label: 'Marketing', shortDesc: 'Campaigns & positioning', icon: '📣' },
    { id: 'risk', label: 'Risk', shortDesc: 'Compliance & exposure', icon: '🛡️' },
    { id: 'operations', label: 'Operations', shortDesc: 'Workflow & capacity', icon: '⚙️' },
    { id: 'strategy', label: 'Strategy', shortDesc: 'Planning & scenarios', icon: '🎯' },
  ];

  const { isPaidUser, canUseTrinity } = policy;
  const minTierRank = { free: 0, starter: 1 };
  const availableModes = SOUND_BOARD_MODES.filter((mode) => {
    if (policy.privileged) return true;
    if (mode.id === 'trinity') return canUseTrinity;
    return policy.tierRank >= (minTierRank[mode.minTier] ?? 0);
  });
  const activeMode = availableModes.find((mode) => mode.id === selectedMode) || availableModes[0] || SOUND_BOARD_MODES[0];
  const activeAgent = BIQC_AGENTS.find((agent) => agent.id === selectedAgent) || BIQC_AGENTS[0];
  const showBoardroomViz = selectedAgent === 'boardroom';
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');
  const boardroomConnectedSources = useMemo(() => {
    const fromContract = latestAssistantMessage?.soundboard_contract?.connected_sources;
    if (Array.isArray(fromContract)) return fromContract;
    if (latestAssistantMessage?.lineage?.connected_sources_list) return latestAssistantMessage.lineage.connected_sources_list;
    if (latestAssistantMessage?.lineage?.connected_sources && typeof latestAssistantMessage.lineage.connected_sources === 'object') {
      return Object.keys(latestAssistantMessage.lineage.connected_sources).filter((k) => latestAssistantMessage.lineage.connected_sources[k]);
    }
    if (Array.isArray(latestAssistantMessage?.connected_sources)) return latestAssistantMessage.connected_sources;
    return [];
  }, [latestAssistantMessage]);
  const boardroomEvidenceSources = useMemo(
    () => (latestAssistantMessage?.evidence_pack?.sources || []).map((item) => item?.source).filter(Boolean),
    [latestAssistantMessage]
  );
  const boardroomSourceLabels = useMemo(() => {
    const sourceLabelMap = {
      crm: 'CRM',
      accounting: 'Accounting',
      email: 'Email',
      market: 'Market',
      google_ads: 'Google Ads',
      ads: 'Ads',
      web: 'Web',
      competitor: 'Competitor',
    };
    const unique = [...new Set([...boardroomConnectedSources, ...boardroomEvidenceSources].map((v) => String(v || '').toLowerCase().trim()).filter(Boolean))];
    return unique.map((key) => sourceLabelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())).slice(0, 5);
  }, [boardroomConnectedSources, boardroomEvidenceSources]);
  const boardroomChecks = useMemo(
    () => buildBoardroomChecks(boardroomConnectedSources, boardroomEvidenceSources),
    [boardroomConnectedSources, boardroomEvidenceSources]
  );
  const activeBoardroomCheck = boardroomChecks[boardroomNarrationIndex % Math.max(1, boardroomChecks.length)] || { role: 'CEO', line: 'Checking strategic priorities...' };

  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const streamAbortRef = useRef(null);

  useEffect(() => {
    if (!loading || !showBoardroomViz) {
      setBoardroomNarrationIndex(0);
      setBoardroomProgress(12);
      return undefined;
    }
    const narrationTimer = setInterval(() => {
      setBoardroomNarrationIndex((prev) => (prev + 1) % Math.max(1, boardroomChecks.length));
    }, 1400);
    const progressTimer = setInterval(() => {
      setBoardroomProgress((prev) => {
        if (prev >= 92) return 26;
        return Math.min(92, prev + 10);
      });
    }, 900);
    return () => {
      clearInterval(narrationTimer);
      clearInterval(progressTimer);
    };
  }, [loading, showBoardroomViz, boardroomChecks.length]);

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
          text: "Hey — I'm your BIQc business advisor. Ask a concrete business question and I'll respond with what BIQc can verify from your current context.\n\nIf any source is missing or stale, I'll call that out clearly and guide the next step.\n\nWhat's on your mind?",
          content: "Hey — I'm your BIQc business advisor. Ask a concrete business question and I'll respond with what BIQc can verify from your current context.\n\nIf any source is missing or stale, I'll call that out clearly and guide the next step.\n\nWhat's on your mind?",
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
      setMessages(prev => [...prev, { role: 'user', text: actionMessage, content: actionMessage }]);
      executeMessage(actionMessage);
      if (onActionConsumed) onActionConsumed();
    }
  }, [actionMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopStreaming = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setLoading(false);
    setMessages((prev) => markAskBiqcStreamingStopped(prev, { includeText: true }));
  }, []);

  const handleCopyAssistantMessage = useCallback(async (message) => {
    const copied = await copyAskBiqcText(getAskBiqcMessageText(message));
    if (copied) {
      toast.success('Ask BIQc response copied to clipboard.');
      return;
    }
    toast.error('Failed to copy Ask BIQc response.');
  }, []);

  const handleUseAnswerInComposer = useCallback((message) => {
    setInput(buildAskBiqcComposerDraftFromAnswer(getAskBiqcMessageText(message)));
    inputRef.current?.focus();
  }, []);

  const executeMessage = async (userMsg, fullMessage, traceOptions = null) => {
    const msgToSend = fullMessage || userMsg;
    setLoading(true);
    try {
      const { traceRootId, responseVersion } = resolveAskBiqcTrace(traceOptions);
      const placeholder = createAskBiqcPlaceholder({ traceRootId, responseVersion, includeText: true });
      const placeholderId = placeholder.id;
      setMessages((prev) => [...prev, placeholder]);

      const requestPayload = buildAskBiqcRequestPayload({
        message: msgToSend,
        conversationId: activeConvId,
        intelligenceContext: {
          request_scope: deriveSoundboardRequestScope(msgToSend),
        },
        mode: activeMode?.backend_mode || 'auto',
        agentId: selectedAgent || 'auto',
        forensicReportMode: deepForensicRun,
        ...inferAskBiqcGenerationIntent(msgToSend),
      });

      const turnResult = await runAskBiqcTurn({
        sessionToken: session?.access_token,
        message: msgToSend,
        requestPayload,
        traceRootId,
        responseVersion,
        streamAbortRef,
        includeText: true,
        logPrefix: 'soundboard_panel',
        onDelta: (deltaText) => {
          setMessages((prev) => appendAskBiqcDelta(prev, placeholderId, deltaText, { includeText: true }));
        },
      });

      const coverageState = turnResult.coverageGate || getAskBiqcCoverageGate(turnResult.responseData);
      if (turnResult.responseData?.guardrail) {
        const eventName = turnResult.responseData.guardrail === 'BLOCKED'
          ? 'ai_response_blocked'
          : turnResult.responseData.guardrail === 'DEGRADED'
            ? 'ai_response_degraded'
            : 'ai_response_full';
        trackEvent(eventName, {
          coverage_pct: turnResult.responseData?.coverage_pct ?? null,
          missing_count: (turnResult.responseData?.missing_fields || []).length,
        });
      }
      setCoverageGate(coverageState);

      if (turnResult.kind === 'empty') {
        setMessages((prev) => [
          ...removeAskBiqcPlaceholder(prev, placeholderId),
          turnResult.assistantMessage,
        ]);
        return;
      }

      setMessages((prev) => replaceAskBiqcPlaceholder(prev, placeholderId, turnResult.assistantMessage));
      if (turnResult.responseData?.conversation_id && !activeConvId) {
        setActiveConvId(turnResult.responseData.conversation_id);
        setConversations((prev) => [
          {
            id: turnResult.responseData.conversation_id,
            title: turnResult.responseData.conversation_title || 'New chat',
            updated_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } catch (error) {
      streamAbortRef.current = null;
      if (error?.name === 'AbortError') {
        return;
      }
      const errText = getSoundboardErrorMessage(error, 'Connection issue. Try again.');
      setMessages(prev => [...prev.filter((m) => !m.streaming), { role: 'assistant', text: errText, content: errText }]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && !attachedFile) || loading) return;
    const userMsg = input.trim();
    setInput('');

    const currentAttachment = attachedFile;
    const { fullMessage, displayMessage: displayText } = buildAskBiqcComposedMessage({
      userMessage: userMsg,
      attachedFile: currentAttachment,
    });
    if (currentAttachment) setAttachedFile(null);

    if (!fullMessage.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text: displayText, content: displayText }]);
    trackEvent(EVENTS.SOUNDBOARD_QUERY, { message_length: fullMessage.length, has_attachment: !!currentAttachment });
    trackOnceForUser(EVENTS.ACTIVATION_FIRST_SOUNDBOARD_USE, user?.id, { entrypoint: 'soundboard_panel' });
    trackActivationStep('first_soundboard_use', { entrypoint: 'soundboard_panel' });
    await executeMessage(displayText, fullMessage);
  };

  const submitSuggestedAction = async (prompt) => {
    const nextPrompt = String(prompt || '').trim();
    if (!nextPrompt || loading) return;
    setMessages(prev => [...prev, { role: 'user', text: nextPrompt, content: nextPrompt }]);
    trackEvent(EVENTS.SOUNDBOARD_QUERY, { message_length: nextPrompt.length, has_attachment: false, source: 'suggested_action' });
    trackOnceForUser(EVENTS.ACTIVATION_FIRST_SOUNDBOARD_USE, user?.id, { entrypoint: 'soundboard_panel' });
    trackActivationStep('first_soundboard_use', { entrypoint: 'soundboard_panel' });
    await executeMessage(nextPrompt, nextPrompt, {
      trace_root_id: `trace-${Date.now()}`,
      response_version: 1,
    });
  };

  const loadConversation = async (conv) => {
    setShowHistory(false);
    setActiveConvId(conv.id);
    try {
      const res = await apiClient.get(`/soundboard/conversations/${conv.id}`);
      setMessages((res.data?.messages || []).map((m) => ({
        role: m.role,
        text: m.content,
        content: m.content,
        intent: m.intent || m?.metadata?.intent,
        evidence_pack: m.evidence_pack,
        boardroom_trace: m.boardroom_trace,
        boardroom_status: m.boardroom_status || m?.metadata?.boardroom_status,
        soundboard_contract: m.soundboard_contract,
        retrieval_contract: m.retrieval_contract || m?.metadata?.retrieval_contract,
        forensic_report: m.forensic_report || m?.metadata?.forensic_report,
        generation_contract: m.generation_contract || m?.metadata?.generation_contract,
        model_used: m.model_used,
        confidence_score: m.confidence_score,
        data_freshness: m.data_freshness,
        data_sources_count: m.data_sources_count,
        lineage: m.lineage,
        suggested_actions: m.suggested_actions,
        advisory_slots: m.advisory_slots || m?.metadata?.advisory_slots,
        coverage_window: m.coverage_window || m?.metadata?.coverage_window,
      })));
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
      const tooLargeText = 'File too large (max 500KB for text files). Try pasting key sections directly.';
      setMessages(prev => [...prev, { role: 'assistant', text: tooLargeText, content: tooLargeText }]);
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
          <span className="text-sm font-semibold text-[#F4F7FA]" style={{ fontFamily: fontFamily.display }}>Ask BIQc</span>
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
        <AskBiqcSessionLineage
          latestAssistantMessage={latestAssistantMessage}
          compact
          className="mb-1"
          testId="soundboard-panel-session-lineage"
        />
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
                <button key={q} onClick={() => submitSuggestedAction(q)}
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
            <div className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm`}
              style={{
                background: msg.role === 'user' ? 'linear-gradient(135deg, rgba(255,106,0,0.20), rgba(255,106,0,0.10))' : '#0F1720',
                color: msg.role === 'user' ? '#F8FAFC' : '#E2E8F0',
                border: msg.role === 'user' ? '1px solid rgba(255,106,0,0.28)' : '1px solid #223246',
                fontFamily: fontFamily.body,
                whiteSpace: 'pre-line',
                borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                boxShadow: msg.role === 'user' ? 'inset 0 1px 0 rgba(255,255,255,0.05)' : 'none',
              }}>
              {msg.role === 'assistant' ? (
                <AskBiqcAssistantResponse
                  message={msg}
                  compact
                  onCopy={() => handleCopyAssistantMessage(msg)}
                  onUseInComposer={() => handleUseAnswerInComposer(msg)}
                  onRegenerate={() => {
                    const previousUserPrompt = findPreviousAskBiqcUserPrompt(messages, i);
                    if (!previousUserPrompt) return;
                    setMessages((prev) => [...prev, { role: 'user', text: previousUserPrompt, content: previousUserPrompt }]);
                    executeMessage(
                      previousUserPrompt,
                      previousUserPrompt,
                      {
                        trace_root_id: msg.trace_root_id || `trace-${Date.now()}`,
                        response_version: Number(msg.response_version || 1) + 1,
                      },
                    );
                  }}
                  onSuggestedAction={(prompt) => submitSuggestedAction(prompt)}
                  actionTestIdPrefix="ask-biqc-panel-message-action"
                  metadataTestId="soundboard-panel-response-metadata-row"
                  evidenceTestId="soundboard-panel-evidence-row"
                />
              ) : (
                <>
                  <p>{normalizeMessageContent(msg.content ?? msg.text)}</p>
                  <AskBiqcMessageActions
                    role={msg.role}
                    compact
                    onEdit={() => {
                      setInput(getAskBiqcMessageText(msg));
                      inputRef.current?.focus();
                    }}
                    testIdPrefix="ask-biqc-panel-message-action"
                  />
                </>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 rounded-2xl text-sm" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)', borderRadius: '20px 20px 20px 4px' }}>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF6A00] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs" style={{ color: '#94A3B8', fontFamily: fontFamily.body }}>
                  {showBoardroomViz ? `${activeBoardroomCheck.role}: ${activeBoardroomCheck.line}` : 'Thinking...'}
                </span>
              </div>
              {showBoardroomViz && (
                <div className="mt-2">
                  <div className="w-full h-1 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(30, 41, 59, 0.8)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${boardroomProgress}%`, background: 'linear-gradient(90deg, #3B82F6 0%, #10B981 100%)' }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {boardroomChecks.map((step, i) => (
                      <span
                        key={`${step.role}-loading-${i}`}
                        className="text-[9px] px-1.5 py-0.5 rounded"
                        style={{
                          background: i === boardroomNarrationIndex % Math.max(1, boardroomChecks.length) ? 'rgba(59,130,246,0.22)' : 'rgba(59,130,246,0.12)',
                          color: i === boardroomNarrationIndex % Math.max(1, boardroomChecks.length) ? '#DBEAFE' : '#93C5FD',
                          fontFamily: fontFamily.mono,
                        }}
                      >
                        {step.role}
                      </span>
                    ))}
                  </div>
                </div>
              )}
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

        <div className="mb-2" data-testid="soundboard-panel-mode-wrapper">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedAgent('general')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{
                background: selectedAgent === 'general' ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)',
                border: `1px solid ${selectedAgent === 'general' ? 'rgba(129,140,248,0.55)' : 'rgba(99,102,241,0.25)'}`,
                color: '#C7D2FE',
                fontFamily: fontFamily.mono
              }}
            >
              <span>◎</span>
              <span>Advisor</span>
            </button>
            <button
              onClick={() => setSelectedAgent('boardroom')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{
                background: selectedAgent === 'boardroom' ? 'rgba(59,130,246,0.22)' : 'rgba(59,130,246,0.1)',
                border: `1px solid ${selectedAgent === 'boardroom' ? 'rgba(96,165,250,0.55)' : 'rgba(59,130,246,0.25)'}`,
                color: '#93C5FD',
                fontFamily: fontFamily.mono
              }}
            >
              <span>🏛️</span>
              <span>Boardroom</span>
            </button>
            <button
              onClick={() => {
                setShowAdvancedControls((prev) => !prev);
                if (showAdvancedControls) {
                  setShowModeMenu(false);
                  setShowAgentMenu(false);
                }
              }}
              className="px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{ background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.35)', color: '#CBD5E1', fontFamily: fontFamily.mono }}
            >
              {showAdvancedControls ? 'Hide advanced' : 'Show advanced'}
            </button>
          </div>

          {showAdvancedControls && (
            <div className="mt-2 relative flex items-center gap-2">
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
                      <a href="/subscribe?section=foundation" className="block px-3 py-2 text-[10px] no-underline"
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
              <label
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#C7D2FE', fontFamily: fontFamily.mono }}
              >
                <input
                  type="checkbox"
                  checked={deepForensicRun}
                  onChange={(event) => setDeepForensicRun(Boolean(event.target.checked))}
                  data-testid="soundboard-panel-deep-forensic-toggle"
                />
                Deep forensic
              </label>
            </div>
          )}
        </div>

        {showBoardroomViz && (
          <BoardroomCouncilCard
            checks={boardroomChecks}
            sourceLabels={boardroomSourceLabels}
            activeIndex={boardroomNarrationIndex}
            activeCheck={activeBoardroomCheck}
            boardroomStatus={latestAssistantMessage?.boardroom_status}
            compact
            testId="soundboard-panel-boardroom-visualizer"
          />
        )}

        <div className="rounded-2xl flex items-end gap-1 p-1.5" style={{ background: 'var(--biqc-bg-card)', border: `1px solid ${attachedFile ? 'rgba(255,106,0,0.4)' : '#243140'}` }}>
          <input type="file" ref={fileRef} className="hidden" onChange={handleFileSelect} accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.png,.jpg,.md,.json,.py,.js" />
          <button onClick={() => fileRef.current?.click()} className="p-2 rounded-xl hover:bg-white/5 transition-colors shrink-0" data-testid="sb-upload">
            <Paperclip className="w-4 h-4" style={{ color: attachedFile ? '#FF6A00' : '#64748B' }} />
          </button>
          <button className="p-2 rounded-xl hover:bg-white/5 transition-colors shrink-0" data-testid="sb-video"
            onClick={() => setShowVoiceChat(true)}>
            <Video className="w-4 h-4 text-[#64748B]" />
          </button>
          {loading && (
            <button
              onClick={stopStreaming}
              className="p-2 rounded-xl shrink-0 transition-all hover:bg-red-500/10"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.24)' }}
              data-testid="sb-stop"
              aria-label="Stop Ask BIQc response"
            >
              <X className="w-4 h-4 text-red-400" />
            </button>
          )}
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
