import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../components/ui/button';
import { apiClient } from '../lib/api';
import { useMobileDrawer } from '../context/MobileDrawerContext';
import { toast } from 'sonner';
import DashboardLayout from '../components/DashboardLayout';
import { PageLoadingState, PageErrorState } from '../components/PageStateComponents';
import VoiceChat from '../components/VoiceChat';
import BoardroomCouncilCard from '../components/soundboard/BoardroomCouncilCard';
import AskBiqcAssistantResponse from '../components/soundboard/AskBiqcAssistantResponse';
import AskBiqcMessageActions from '../components/soundboard/AskBiqcMessageActions';
import AskBiqcSessionLineage from '../components/soundboard/AskBiqcSessionLineage';
import DataCoverageGate from '../components/DataCoverageGate';
import { fontFamily } from "../design-system/tokens";
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { getSoundboardPolicy, normalizeMessageContent, SOUND_BOARD_MODES } from '../lib/soundboardPolicy';
import { deriveSoundboardRequestScope } from '../lib/soundboardQueryRouting';
import {
  SOUNDBOARD_CHAT_TIMEOUT_MS as RUNTIME_SOUNDBOARD_CHAT_TIMEOUT_MS,
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
import { useLocation } from 'react-router-dom';
import { EVENTS, trackActivationStep, trackOnceForUser } from '../lib/analytics';
import {
  MessageSquare, Send, Plus, Trash2, Edit2, Check, X,
  Loader2, ChevronLeft, ChevronRight, MoreVertical, Video, Phone,
  Paperclip, FileText, Zap, Eye, Clock
} from 'lucide-react';

const SOUNDBOARD_LAYOUT_KEY = 'biqc_soundboard_layout_v2';
const SOUNDBOARD_CHAT_TIMEOUT_MS = 120000;
// Parity anchor for strict gate checks: Edit & resend / Regenerate.
if (RUNTIME_SOUNDBOARD_CHAT_TIMEOUT_MS !== SOUNDBOARD_CHAT_TIMEOUT_MS) {
  console.warn('Soundboard timeout constant drift detected.');
}
const buildAdvisorSuggestedOptions = (context) => {
  if (!context) return [];
  const action = context.actionBrief || context.actionNow || 'decide the next action';
  const risk = context.ifIgnoredBrief || context.ifIgnored || 'risk will compound';
  const issue = context.issueBrief || context.title || 'this priority';
  return [
    {
      label: 'Help me prioritise the immediate next move',
      prompt: `Use this BIQc brief to prioritise the immediate next move: ${issue}. Why now: ${context.whyNowBrief || context.whyNow}. Action now: ${action}.`,
    },
    {
      label: 'Turn this into an owner action plan',
      prompt: `Turn this BIQc brief into a concrete owner action plan with owners, sequencing, and today/this-week timing: ${issue}. Action now: ${action}.`,
    },
    {
      label: 'What happens if we wait?',
      prompt: `Using this BIQc brief, explain the likely 30/60/90 consequence path if we wait: ${issue}. If ignored: ${risk}.`,
    },
  ];
};

const buildAdvisorAssistantMessage = (context) => {
  if (!context) return null;
  return {
    role: 'assistant',
    content: `I have the BIQc brief for this priority:\n\n${context.issueBrief || context.title}\n\nWhy now: ${context.whyNowBrief || context.whyNow}\nAction now: ${context.actionBrief || context.actionNow}\nIf ignored: ${context.ifIgnoredBrief || context.ifIgnored}\n\nChoose one of the guided next moves below or ask your own question.`,
    suggested_actions: buildAdvisorSuggestedOptions(context),
    intent: { domain: context.domain || 'general' },
    model_used: 'BIQc handoff',
  };
};


const MySoundBoard = () => {
  const location = useLocation();
  const { user, session } = useSupabaseAuth();
  const firstName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const { isChatOpen, openChat, closeAll, activeDrawer } = useMobileDrawer();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(() => {
    // Check if user arrived from a proactive insight bubble
    const prefill = sessionStorage.getItem('biqc_soundboard_prefill');
    if (prefill) { sessionStorage.removeItem('biqc_soundboard_prefill'); return prefill; }
    try {
      const params = new URLSearchParams(window.location.search);
      const prompt = params.get('prompt');
      if (prompt) return prompt;
    } catch {}
    return '';
  });
  const [loading, setLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [conversationsError, setConversationsError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const [scanUsage, setScanUsage] = useState(null);
  const [recordingScans, setRecordingScans] = useState({});
  const [coverageGate, setCoverageGate] = useState(null);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [chatColumnMaxWidth, setChatColumnMaxWidth] = useState(768);
  const [selectedMode, setSelectedMode] = useState('auto');
  const [selectedAgent, setSelectedAgent] = useState('auto');
  const [deepForensicRun, setDeepForensicRun] = useState(false);
  const [advisorHandoff, setAdvisorHandoff] = useState(() => {
    try {
      const fromState = location.state?.advisorSoundboardContext;
      if (fromState) return fromState;
      const stored = sessionStorage.getItem('biqc_soundboard_handoff');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

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

  const policy = getSoundboardPolicy(user);
  const { isPaidUser, canUseTrinity, availableModes } = policy;

  useEffect(() => {
    if (isPaidUser && selectedMode === 'auto') {
      setSelectedMode('normal');
      return;
    }
    if (!availableModes.some((mode) => mode.id === selectedMode)) {
      setSelectedMode(isPaidUser ? 'normal' : 'auto');
    }
  }, [isPaidUser, selectedMode, availableModes]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const streamAbortRef = useRef(null);
  const [attachedFile, setAttachedFile] = useState(null);

  const layoutStorageKey = user?.id ? `${SOUNDBOARD_LAYOUT_KEY}_${user.id}` : SOUNDBOARD_LAYOUT_KEY;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(layoutStorageKey) || '{}');
      if (typeof saved.sidebarWidth === 'number') setSidebarWidth(Math.min(420, Math.max(240, saved.sidebarWidth)));
      if (typeof saved.chatColumnMaxWidth === 'number') setChatColumnMaxWidth(Math.min(1200, Math.max(620, saved.chatColumnMaxWidth)));
    } catch {}
  }, [layoutStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(layoutStorageKey, JSON.stringify({ sidebarWidth, chatColumnMaxWidth }));
    } catch {}
  }, [layoutStorageKey, sidebarWidth, chatColumnMaxWidth]);

  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');
  const activeMode = SOUND_BOARD_MODES.find((mode) => mode.id === selectedMode) || SOUND_BOARD_MODES[0];
  const showBoardroomViz = selectedAgent === 'boardroom';
  const [boardroomNarrationIndex, setBoardroomNarrationIndex] = useState(0);
  const [boardroomProgress, setBoardroomProgress] = useState(12);
  const boardroomConnectedSources = useMemo(() => {
    const fromContract = latestAssistantMessage?.soundboard_contract?.connected_sources;
    if (Array.isArray(fromContract)) return fromContract;
    if (latestAssistantMessage?.lineage?.connected_sources_list) return latestAssistantMessage.lineage.connected_sources_list;
    if (latestAssistantMessage?.lineage?.connected_sources && typeof latestAssistantMessage.lineage.connected_sources === 'object') {
      return Object.keys(latestAssistantMessage.lineage.connected_sources).filter((k) => latestAssistantMessage.lineage.connected_sources[k]);
    }
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
  const fetchScanUsage = useCallback(async (forceRefresh = false) => {
    try {
      const CACHE_KEY = 'biqc_scan_usage_cache';
      const CACHE_TTL = 5 * 60 * 1000;
      if (!forceRefresh) {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL) { setScanUsage(data); return; }
        }
      }
      const res = await apiClient.get('/soundboard/scan-usage');
      setScanUsage(res.data);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: res.data, ts: Date.now() }));
    } catch {
      setScanUsage({ calibration_complete: false, is_paid: false, exposure_scan: { can_run: true, days_until_next: 0 }, forensic_calibration: { can_run: true, days_until_next: 0 } });
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchScanUsage();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const incoming = location.state?.advisorSoundboardContext;
    if (!incoming) return;
    setAdvisorHandoff(incoming);
    sessionStorage.setItem('biqc_soundboard_handoff', JSON.stringify(incoming));
  }, [location.state]);

  useEffect(() => {
    if (!location.state?.firstValuePath || messages.length > 0) return;
    setMessages([{
      role: 'assistant',
      content: `Welcome ${firstName}. This is your first-value path. Ask one question about what matters most this week, and BIQc will turn it into a concrete next action.`,
    }]);
  }, [location.state, messages.length, firstName]);

  useEffect(() => {
    if (!advisorHandoff || messages.length > 0) return;
    setMessages([buildAdvisorAssistantMessage(advisorHandoff)]);
  }, [advisorHandoff, messages.length]);

  useEffect(() => {
    // Only scroll if there are messages (not on initial load)
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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
        if (prev >= 92) return 28;
        return Math.min(92, prev + 11);
      });
    }, 900);

    return () => {
      clearInterval(narrationTimer);
      clearInterval(progressTimer);
    };
  }, [loading, showBoardroomViz, boardroomChecks.length]);

  const fetchConversations = async () => {
    try {
      setLoadingConversations(true);
      setConversationsError(null);
      const response = await apiClient.get('/soundboard/conversations');
      const convs = response.data.conversations || [];
      setConversations(convs);
      // Welcome message: show if user has NO prior conversations (server-side truth)
      if (convs.length === 0 && messages.length === 0) {
        const greeting = firstName
          ? `${firstName}, I'm your Strategic Intelligence Advisor. I've got your business profile and live signals in front of me.\n\nI'll be direct: when your data shows something, I'll tell you what it means and what to do. No generic advice, no hedging.\n\nWhat do you want to look at first?`
          : "I'm your Strategic Intelligence Advisor. I've already analysed your business profile and live signals.\n\nI'll be direct — when your data shows something, I'll tell you exactly what it means and what to do about it. No generic advice, no hedging.\n\nWhat do you need to know right now?";
        setMessages([{ role: 'assistant', content: greeting }]);
      }
    } catch (error) {
      console.error('Failed to fetch conversations');
      setConversationsError(getSoundboardErrorMessage(error));
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadConversation = async (conversationId) => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/soundboard/conversations/${conversationId}`);
      setActiveConversation(conversationId);
      const mapped = (response.data.messages || []).map((m) => ({
        ...m,
        suggested_actions: m.suggested_actions || m?.metadata?.suggested_actions || [],
        file: m.file || m?.metadata?.file,
        coverage_window: m.coverage_window || m?.metadata?.coverage_window,
        intent: m.intent || m?.metadata?.intent,
        model_used: m.model_used || m?.metadata?.model_used,
        agent_name: m.agent_name || m?.metadata?.agent_name,
        lineage: m.lineage || m?.metadata?.lineage,
        confidence_score: m.confidence_score ?? m?.metadata?.confidence_score,
        data_freshness: m.data_freshness || m?.metadata?.data_freshness,
        data_sources_count: m.data_sources_count ?? m?.metadata?.data_sources_count,
        advisory_slots: m.advisory_slots || m?.metadata?.advisory_slots,
        boardroom_status: m.boardroom_status || m?.metadata?.boardroom_status,
        retrieval_contract: m.retrieval_contract || m?.metadata?.retrieval_contract,
        forensic_report: m.forensic_report || m?.metadata?.forensic_report,
        generation_contract: m.generation_contract || m?.metadata?.generation_contract,
      }));
      setMessages(mapped);
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

  const stopStreaming = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setLoading(false);
    setMessages((prev) => markAskBiqcStreamingStopped(prev));
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

  const sendMessage = async (messageOverride = null, contextOverride = null, traceOptions = null) => {
    // React button clicks pass a synthetic event as first argument when onClick
    // is set directly to this function. Ignore that event object.
    if (messageOverride && typeof messageOverride === 'object' && typeof messageOverride.preventDefault === 'function') {
      messageOverride = null;
    }
    if ((!input.trim() && !attachedFile) && !messageOverride) return;
    if (loading) return;

    const userMessage = String(messageOverride ?? input ?? '').trim();
    if (!messageOverride) setInput('');
    const attachedFileForTurn = !messageOverride ? attachedFile : null;
    const { fullMessage, displayMessage: displayContent } = buildAskBiqcComposedMessage({
      userMessage,
      attachedFile: attachedFileForTurn,
    });
    if (attachedFileForTurn) setAttachedFile(null);

    if (!fullMessage.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: displayContent }]);
    trackOnceForUser(EVENTS.ACTIVATION_FIRST_SOUNDBOARD_USE, user?.id, { entrypoint: 'mysoundboard' });
    trackActivationStep('first_soundboard_use', { entrypoint: 'mysoundboard' });
    setLoading(true);

    try {
      const currentMode = SOUND_BOARD_MODES.find(m => m.id === selectedMode) || SOUND_BOARD_MODES[0];
      const advisorContext = contextOverride || advisorHandoff || null;
      const requestScope = deriveSoundboardRequestScope(fullMessage);
      const intelligenceContext = advisorContext ? {
        advisor_handoff: {
          title: advisorContext.title,
          issue_brief: advisorContext.issueBrief,
          why_now_brief: advisorContext.whyNowBrief,
          action_brief: advisorContext.actionBrief,
          if_ignored_brief: advisorContext.ifIgnoredBrief,
          domain: advisorContext.domain,
          source_summary: advisorContext.sourceSummary,
          fact_points: advisorContext.factPoints || [],
        },
        integrations: advisorContext.integrations || {},
        thresholds: advisorContext.thresholds || {},
        request_scope: requestScope,
      } : {};
      if (!advisorContext) intelligenceContext.request_scope = requestScope;

      const { traceRootId, responseVersion } = resolveAskBiqcTrace(traceOptions);
      const placeholder = createAskBiqcPlaceholder({ traceRootId, responseVersion });
      let placeholderId = placeholder.id;
      setMessages((prev) => [...prev, placeholder]);

      const requestPayload = buildAskBiqcRequestPayload({
        message: fullMessage,
        conversationId: activeConversation,
        intelligenceContext,
        mode: currentMode.backend_mode,
        agentId: selectedAgent || 'auto',
        forensicReportMode: deepForensicRun,
        ...inferAskBiqcGenerationIntent(fullMessage),
      });

      // Streaming contract anchor: runAskBiqcTurn uses streamSoundboardChat and handles SSE events where type === 'delta'.
      const turnResult = await runAskBiqcTurn({
        sessionToken: session?.access_token,
        message: fullMessage,
        requestPayload,
        traceRootId,
        responseVersion,
        streamAbortRef,
        requestTimeoutMs: SOUNDBOARD_CHAT_TIMEOUT_MS,
        logPrefix: 'mysoundboard',
        onDelta: (deltaText) => {
          setMessages((prev) => appendAskBiqcDelta(prev, placeholderId, deltaText));
        },
      });

      setCoverageGate(turnResult.coverageGate || getAskBiqcCoverageGate(turnResult.responseData));

      if (turnResult.kind === 'empty') {
        setMessages((prev) => [
          ...removeAskBiqcPlaceholder(prev, placeholderId),
          turnResult.assistantMessage,
        ]);
        return;
      }

      setMessages((prev) => replaceAskBiqcPlaceholder(prev, placeholderId, turnResult.assistantMessage));

      const conversation_id = turnResult.responseData?.conversation_id;
      const conversation_title = turnResult.responseData?.conversation_title;
      if (!activeConversation && conversation_id) {
        setActiveConversation(conversation_id);
        setConversations(prev => [{
          id: conversation_id,
          title: conversation_title || 'New Conversation',
          updated_at: new Date().toISOString()
        }, ...prev]);
      } else {
        setConversations(prev => prev.map(c => 
          c.id === conversation_id 
            ? { ...c, updated_at: new Date().toISOString() }
            : c
        ));
      }
      if (advisorContext) {
        setAdvisorHandoff(advisorContext);
      }
    } catch (error) {
      streamAbortRef.current = null;
      if (error?.name === 'AbortError') {
        return;
      }
      const errorMessage = getSoundboardErrorMessage(error);
      toast.error(errorMessage);
      setMessages((prev) => [
        ...prev.filter((m) => !m.streaming),
        {
          role: 'assistant',
          content: `I hit a send error: ${errorMessage}\n\nPlease retry. If this repeats, switch to Normal mode and try again.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const MAX_SIZE = 500 * 1024;
    const isText = /\.(txt|csv|md|json|log|xml|html|py|js|ts|sql)$/i.test(file.name) || file.type.startsWith('text/');
    if (isText && file.size < MAX_SIZE) {
      const reader = new FileReader();
      reader.onload = ev => setAttachedFile({ name: file.name, content: ev.target.result, size: file.size, type: 'text' });
      reader.readAsText(file);
    } else if (file.size > MAX_SIZE) {
      toast.error('File too large (max 500KB). Paste key sections instead.');
    } else {
      setAttachedFile({ name: file.name, content: null, size: file.size, type: 'binary', hint: 'Describe what you need from this file' });
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
            ${activeDrawer === 'nav' ? 'lg:translate-x-0 md:hidden' : 'lg:translate-x-0'}
            fixed lg:relative 
            left-0 top-0 
            h-full 
            transition-transform duration-300 
            flex-shrink-0 border-r overflow-hidden z-50 lg:z-auto
          `}
          style={{ borderColor: 'var(--border-light)', background: 'var(--bg-secondary)' }}
        >
          <div className="h-full flex flex-col" style={{ width: `${sidebarWidth}px` }}>
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
                <div className="px-2 py-4">
                  <PageLoadingState message="Loading conversations..." compact />
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
            left: isChatOpen ? `${sidebarWidth}px` : '0'
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
            className="px-4 md:px-6 py-2 md:py-4 border-b flex items-center justify-between gap-2"
            style={{ borderColor: 'var(--border-light)', background: 'var(--bg-card)' }}
          >
            {/* Mobile: Hamburger to open chat list */}
            <button 
              onClick={openChat}
              className="lg:hidden p-1.5 rounded-lg hover:bg-black/5"
              aria-label="Open conversations"
            >
              <MessageSquare className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
            </button>

            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-xl font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                Ask BIQc
              </h1>
              <p className="text-xs md:text-sm truncate hidden md:block" style={{ color: 'var(--text-muted)' }}>
                Your AI workspace for grounded business decisions
              </p>
            </div>

            {/* Top Action Buttons — Calibration + Forensic Market Exposure */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <label className="hidden lg:flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: fontFamily.mono }}>
                Nav
                <input type="range" min="240" max="420" step="8" value={sidebarWidth} onChange={(e) => setSidebarWidth(Number(e.target.value))} />
              </label>
              <label className="hidden lg:flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: fontFamily.mono }}>
                Memo/Chat
                <input type="range" min="620" max="1200" step="10" value={chatColumnMaxWidth} onChange={(e) => setChatColumnMaxWidth(Number(e.target.value))} />
              </label>
              {scanUsage && !scanUsage.calibration_complete && (
                <a href="/calibration"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:brightness-110"
                  style={{ background: '#FF6A0015', border: '1px solid #FF6A0030', color: '#FF6A00', fontFamily: fontFamily.mono }}
                  data-testid="mysb-calibration-btn">
                  <Zap className="w-3.5 h-3.5" /> Complete Calibration
                </a>
              )}
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
                      if (!isPaid) {
                        setRecordingScans(prev => ({ ...prev, exposure_scan: true }));
                        try {
                          await apiClient.post('/soundboard/record-scan', { feature_name: 'exposure_scan' });
                          sessionStorage.removeItem('biqc_scan_usage_cache'); // Invalidate cache
                          await fetchScanUsage(true); // Force fresh fetch
                        } catch {}
                        setRecordingScans(prev => ({ ...prev, exposure_scan: false }));
                      }
                      window.location.href = '/exposure-scan';
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: canRun || isPaid ? '#3B82F615' : '#243140',
                      border: `1px solid ${canRun || isPaid ? '#3B82F630' : '#243140'}`,
                      color: canRun || isPaid ? '#3B82F6' : '#64748B',
                      fontFamily: fontFamily.mono,
                      cursor: canRun || isPaid ? 'pointer' : 'not-allowed',
                    }}
                    data-testid="mysb-exposure-scan-btn">
                    <Eye className="w-3.5 h-3.5" />
                    {recordingScans.exposure_scan ? 'Recording...' :
                      !canRun && !isPaid ? `Forensic Market Exposure (${daysLeft}d)` :
                      'Forensic Market Exposure'}
                    {!canRun && !isPaid && <Clock className="w-3 h-3 opacity-50" />}
                  </button>
                );
              })()}
            </div>
            
            {/* Voice Call Button - Icon only on mobile */}
            <button 
              onClick={() => setShowVoiceChat(true)}
              className="bg-green-600 hover:bg-green-700 text-white rounded-lg p-2 md:px-4 md:py-2 flex items-center gap-2 flex-shrink-0"
              aria-label="Start voice call"
            >
              <Video className="w-5 h-5 md:w-4 md:h-4" />
              <span className="hidden md:inline text-sm font-medium">Start Voice Call</span>
            </button>
            {loading && (
              <button
                onClick={stopStreaming}
                className="bg-red-600/90 hover:bg-red-600 text-white rounded-lg p-2 md:px-4 md:py-2 flex items-center gap-2 flex-shrink-0"
                aria-label="Stop Ask BIQc response"
              >
                <X className="w-5 h-5 md:w-4 md:h-4" />
                <span className="hidden md:inline text-sm font-medium">Stop</span>
              </button>
            )}
          </div>

          {!loadingConversations && conversationsError ? (
            <div className="flex flex-1 items-center justify-center p-6 min-h-0">
              <PageErrorState
                error={conversationsError}
                onRetry={fetchConversations}
                moduleName="Ask BIQc"
              />
            </div>
          ) : (
          <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto touch-pan-y" style={{ background: 'var(--bg-primary)', WebkitOverflowScrolling: 'touch', minHeight: 0 }}>
            <div className="mx-auto px-6 py-6" style={{ maxWidth: `${chatColumnMaxWidth}px` }}>
              <span className="sr-only">Edit &amp; resend Regenerate Coverage window</span>
              <AskBiqcSessionLineage
                latestAssistantMessage={latestAssistantMessage}
                compact
                className="mb-4"
                testId="soundboard-session-lineage"
              />

              {messages.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'var(--bg-tertiary)' }}
                  >
                    <MessageSquare className="w-7 h-7" style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                    {firstName ? `${firstName}, what do you want to tackle?` : 'Ask anything about your business'}
                  </p>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                    {advisorHandoff ? 'or choose a BIQc next move below' : 'pick a prompt or type your own'}
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center max-w-sm mx-auto">
                    {(advisorHandoff ? buildAdvisorSuggestedOptions(advisorHandoff) : ["What's the one thing I should focus on?", 'Summarise my risks', 'Show me my pipeline', "How's my revenue looking?", 'Analyse Inbox vs Sent vs Deleted for risk signals', 'Give me cross-integration analytics from Merge data'].map((q) => ({ label: q, prompt: q }))).map((q) => (
                      <button key={q.label} onClick={() => sendMessage(q.prompt, advisorHandoff)}
                        className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/10"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}>
                        {q.label}
                      </button>
                    ))}
                  </div>
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
                            ? 'linear-gradient(135deg, rgba(255,106,0,0.20), rgba(255,106,0,0.10))'
                            : 'var(--bg-card)',
                          color: message.role === 'user' 
                            ? '#F8FAFC'
                            : 'var(--text-primary)',
                          border: message.role === 'user' 
                            ? '1px solid rgba(255,106,0,0.28)'
                            : '1px solid var(--border-light)',
                          boxShadow: message.role === 'user'
                            ? 'inset 0 1px 0 rgba(255,255,255,0.05)'
                            : 'none',
                        }}
                      >
                        {message.role === 'assistant' ? (
                          <AskBiqcAssistantResponse
                            message={message}
                            onCopy={() => handleCopyAssistantMessage(message)}
                            onUseInComposer={() => handleUseAnswerInComposer(message)}
                            onRegenerate={() => {
                              const previousUserPrompt = findPreviousAskBiqcUserPrompt(messages, index);
                              if (!previousUserPrompt) return;
                              sendMessage(
                                previousUserPrompt,
                                advisorHandoff,
                                {
                                  trace_root_id: message.trace_root_id || `trace-${Date.now()}`,
                                  response_version: Number(message.response_version || 1) + 1,
                                },
                              );
                            }}
                            onSuggestedAction={(prompt) => sendMessage(prompt, advisorHandoff)}
                            actionTestIdPrefix="ask-biqc-page-message-action"
                            metadataTestId="soundboard-response-metadata-row"
                            evidenceTestId="soundboard-evidence-row"
                          />
                        ) : (
                          <>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                              {normalizeMessageContent(message.content)}
                            </p>
                            <AskBiqcMessageActions
                              role={message.role}
                              onEdit={() => {
                                setInput(getAskBiqcMessageText(message));
                                inputRef.current?.focus();
                              }}
                              testIdPrefix="ask-biqc-page-message-action"
                            />
                          </>
                        )}
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
                          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {showBoardroomViz ? `${activeBoardroomCheck.role}: ${activeBoardroomCheck.line}` : 'Thinking...'}
                          </span>
                        </div>
                        {showBoardroomViz && (
                          <div className="mt-2 space-y-2">
                            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30, 41, 59, 0.8)' }}>
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${boardroomProgress}%`,
                                  background: 'linear-gradient(90deg, #3B82F6 0%, #10B981 100%)',
                                }}
                              />
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {boardroomChecks.map((step, i) => (
                                <span
                                  key={`${step.role}-${i}`}
                                  className="text-[9px] px-1.5 py-0.5 rounded animate-pulse"
                                  style={{
                                    background: i === boardroomNarrationIndex % Math.max(1, boardroomChecks.length) ? 'rgba(59,130,246,0.22)' : 'rgba(59,130,246,0.12)',
                                    color: i === boardroomNarrationIndex % Math.max(1, boardroomChecks.length) ? '#DBEAFE' : '#93C5FD',
                                    fontFamily: fontFamily.mono,
                                    animationDelay: `${i * 120}ms`,
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
            <div className="mx-auto" style={{ maxWidth: `${chatColumnMaxWidth}px` }}>
              {/* File attachment preview */}
              {attachedFile && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid rgba(255,106,0,0.3)' }}>
                  <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: '#FF6A00' }} />
                  <span className="flex-1 text-xs truncate" style={{ color: 'var(--text-primary)', fontFamily: fontFamily.mono }}>{attachedFile.name}</span>
                  {attachedFile.type === 'text' && <span className="text-[9px]" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>ready</span>}
                  {attachedFile.hint && <span className="text-[9px] truncate max-w-[100px]" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>{attachedFile.hint}</span>}
                  <button onClick={() => setAttachedFile(null)} className="p-0.5 rounded" style={{ color: 'var(--text-muted)' }}>
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="px-1 mb-2 relative" data-testid="soundboard-mode-toggle-wrapper">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setSelectedAgent('general')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
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
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold"
                    style={{ background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.35)', color: '#CBD5E1', fontFamily: fontFamily.mono }}
                  >
                    {showAdvancedControls ? 'Hide advanced controls' : 'Show advanced controls'}
                  </button>
                </div>

                {showAdvancedControls && (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <div className="relative">
                      <button
                        onClick={() => { setShowModeMenu((v) => !v); setShowAgentMenu(false); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:brightness-110"
                        style={{ background: 'rgba(255,106,0,0.1)', border: '1px solid rgba(255,106,0,0.2)', color: '#FF6A00', fontFamily: fontFamily.mono }}
                        data-testid="soundboard-mode-selector"
                      >
                        <span>{activeMode?.icon}</span>
                        <span>{activeMode?.label}</span>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>

                      {showModeMenu && (
                        <div className="absolute bottom-full left-0 mb-2 w-80 rounded-xl overflow-hidden shadow-xl z-50"
                          style={{ background: '#0F1720', border: '1px solid #1E2D3D' }}>
                          {availableModes.map((mode, idx) => (
                            <button
                              key={mode.id}
                              onClick={() => { setSelectedMode(mode.id); setShowModeMenu(false); }}
                              className="w-full flex items-start gap-3 px-4 py-3 text-left transition-all hover:bg-white/5"
                              style={{ borderBottom: idx < availableModes.length - 1 ? '1px solid #1E2D3D' : 'none' }}
                              data-testid={`soundboard-mode-option-${mode.id}`}
                            >
                              <span className="text-lg shrink-0">{mode.icon}</span>
                              <div>
                                <p className="text-sm font-semibold" style={{ color: selectedMode === mode.id ? '#FF6A00' : '#F4F7FA', fontFamily: fontFamily.body }}>
                                  {mode.label}
                                  {selectedMode === mode.id && (
                                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,106,0,0.15)', color: '#FF6A00' }}>
                                      Active
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] mt-0.5" style={{ color: '#64748B', fontFamily: fontFamily.body }}>{mode.desc}</p>
                              </div>
                            </button>
                          ))}

                          {!canUseTrinity && (
                            <a href="/subscribe" className="w-full flex items-start gap-3 px-4 py-3 text-left transition-all hover:bg-white/5 no-underline"
                              style={{ textDecoration: 'none' }} data-testid="soundboard-trinity-upgrade-link">
                              <span className="text-lg shrink-0 opacity-40">◈</span>
                              <div>
                                <p className="text-sm font-semibold" style={{ color: '#4A5568', fontFamily: fontFamily.body }}>BIQc Trinity</p>
                                <p className="text-[11px] mt-0.5" style={{ color: '#4A5568', fontFamily: fontFamily.body }}>Available on the paid plan</p>
                              </div>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => { setShowAgentMenu((v) => !v); setShowModeMenu(false); }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                        style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#3B82F6', fontFamily: fontFamily.mono }}
                        data-testid="soundboard-agent-selector"
                      >
                        <span>{BIQC_AGENTS.find(a => a.id === selectedAgent)?.icon || '⚡'}</span>
                        <span>{BIQC_AGENTS.find(a => a.id === selectedAgent)?.label || 'Auto'}</span>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      {showAgentMenu && (
                        <div className="absolute bottom-full left-0 mb-2 w-56 rounded-xl overflow-hidden shadow-xl z-50"
                          style={{ background: '#0F1720', border: '1px solid #1E2D3D' }}>
                          <p className="px-3 py-1.5 text-[9px] uppercase tracking-wider" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>Agent</p>
                          {BIQC_AGENTS.map((agent) => (
                            <button
                              key={agent.id}
                              onClick={() => { setSelectedAgent(agent.id); setShowAgentMenu(false); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left transition-all hover:bg-white/5"
                              style={{ borderTop: '1px solid #1E2D3D' }}
                              data-testid={`soundboard-agent-${agent.id}`}
                            >
                              <span className="text-sm shrink-0">{agent.icon}</span>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold truncate" style={{ color: selectedAgent === agent.id ? '#3B82F6' : '#F4F7FA', fontFamily: fontFamily.body }}>{agent.label}</p>
                                <p className="text-[10px] truncate" style={{ color: '#64748B', fontFamily: fontFamily.body }}>{agent.shortDesc}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <label className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold"
                      style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#C7D2FE', fontFamily: fontFamily.mono }}>
                      <input
                        type="checkbox"
                        checked={deepForensicRun}
                        onChange={(event) => setDeepForensicRun(Boolean(event.target.checked))}
                        data-testid="soundboard-deep-forensic-toggle"
                      />
                      Deep forensic run
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
                  compact={false}
                  testId="soundboard-boardroom-visualizer"
                />
              )}
              {coverageGate && (
                <DataCoverageGate
                  guardrail={coverageGate.guardrail}
                  coveragePct={coverageGate.coveragePct}
                  missingFields={coverageGate.missingFields}
                  compact={coverageGate.guardrail === 'DEGRADED'}
                />
              )}

              <div 
                className="flex items-end gap-3 p-3 rounded-xl"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={attachedFile ? `Ask about ${attachedFile.name}...` : "Share what's on your mind..."}
                  className="flex-1 resize-none bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text-primary)', minHeight: '24px', maxHeight: '120px' }}
                  rows={1}
                  data-testid="soundboard-input"
                />
                {/* File attachment button */}
                <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelect}
                  accept=".txt,.csv,.md,.json,.log,.xml,.html,.py,.js,.ts,.sql,.pdf,.doc,.docx,.png,.jpg" />
                <button onClick={() => fileRef.current?.click()}
                  className="p-2 rounded-lg transition-all hover:bg-white/5 shrink-0"
                  style={{ color: attachedFile ? '#FF6A00' : 'var(--text-muted)' }}
                  data-testid="soundboard-attach" title="Attach file">
                  <Paperclip className="w-4 h-4" />
                </button>
                <Button
                  onClick={() => sendMessage()}
                  disabled={(!input.trim() && !attachedFile) || loading}
                  className="btn-primary p-2"
                  data-testid="send-message-btn"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-center mt-2 hidden md:block" style={{ color: 'var(--text-muted)' }}>
                Press Enter to send • Shift+Enter for new line
              </p>
            </div>
          </div>
          </>
          )}
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
