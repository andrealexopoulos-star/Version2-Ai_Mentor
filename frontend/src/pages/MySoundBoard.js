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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  const [uploadedFiles, setUploadedFiles] = useState([]);

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

  const uploadAttachmentToSoundboard = useCallback(async () => {
    if (!attachedFile?.raw) return [];
    const form = new FormData();
    form.append('file', attachedFile.raw, attachedFile.name || 'upload.bin');
    if (activeConversation) {
      form.append('conversation_id', activeConversation);
    }
    const response = await apiClient.post('/soundboard/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    const payload = response?.data || {};
    if (payload?.upload_id) {
      setUploadedFiles((prev) => [...prev, payload]);
      return [payload.upload_id];
    }
    return [];
  }, [attachedFile, activeConversation]);

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
      if (attachedFileForTurn?.raw) {
        try {
          requestPayload.upload_ids = await uploadAttachmentToSoundboard();
        } catch {
          toast.error("Couldn't attach your file to this request.");
        }
      }

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
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error('File too large. Maximum size is 25MB.');
      return;
    }
    const isText = /\.(txt|csv|md|json|log|xml|html|py|js|ts|sql)$/i.test(file.name) || (file.type || '').startsWith('text/');
    if (isText) {
      const reader = new FileReader();
      reader.onload = ev => setAttachedFile({ name: file.name, content: ev.target.result, size: file.size, type: 'text', raw: file });
      reader.readAsText(file);
    } else {
      setAttachedFile({ name: file.name, content: null, size: file.size, type: 'binary', hint: 'Describe what you need from this file', raw: file });
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

  /* ── Mockup-matched inline style constants ── */
  const SB = {
    surface:     'var(--surface, #0E1628)',
    surface2:    'var(--surface-2, #151D2E)',
    border:      'var(--border, rgba(140,170,210,0.12))',
    lava:        'var(--lava, #E85D00)',
    lavaWash:    'var(--lava-wash, rgba(232,93,0,0.08))',
    lavaDeep:    'var(--lava-deep, #C44D00)',
    lavaRing:    'var(--lava-ring, rgba(232,93,0,0.15))',
    inkDisplay:  'var(--ink-display, #EDF1F7)',
    ink:         'var(--ink, #C8D4E4)',
    inkSecondary:'var(--ink-secondary, #8FA0B8)',
    inkMuted:    'var(--ink-muted, #708499)',
    userBubble:  '#1E293B',
  };

  return (
    <DashboardLayout>
      {/* CSS keyframes for mockup animations */}
      <style>{`
        @keyframes sbPulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes sbMsgIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width: 1100px) {
          .sb-shell-grid { grid-template-columns: 1fr !important; }
          .sb-side-panel { display: none !important; }
        }
      `}</style>

      <div className="sb-shell-grid" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, height: 'calc(100vh - 80px)', padding: '0 20px 20px', fontFamily: fontFamily.body }}>

        {/* ════════ CONVERSATION SIDEBAR ════════ */}
        <aside className="sb-side-panel" style={{
          background: SB.surface, border: `1px solid ${SB.border}`, borderRadius: 12,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Sidebar header */}
          <div style={{
            padding: 16, borderBottom: `1px solid ${SB.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontFamily: fontFamily.mono, fontSize: 11, color: SB.inkMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Recent conversations
            </span>
            <button
              onClick={startNewConversation}
              aria-label="New conversation"
              style={{
                width: 28, height: 28, background: SB.lavaWash, color: SB.lava,
                borderRadius: 6, display: 'grid', placeItems: 'center',
                border: 0, cursor: 'pointer', transition: 'all 180ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = SB.lava; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = SB.lavaWash; e.currentTarget.style.color = SB.lava; }}
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Conversation list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loadingConversations ? (
              <div style={{ padding: 16 }}>
                <PageLoadingState message="Loading conversations..." compact />
              </div>
            ) : conversations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <MessageSquare size={32} style={{ color: SB.inkMuted, margin: '0 auto 8px' }} />
                <p style={{ fontSize: 13, color: SB.inkMuted }}>No conversations yet</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  style={{
                    display: 'block', padding: '12px 16px',
                    borderBottom: `1px solid ${SB.border}`,
                    cursor: 'pointer', transition: 'background 150ms ease',
                    background: activeConversation === conv.id ? SB.lavaWash : 'transparent',
                    borderLeft: activeConversation === conv.id ? `3px solid ${SB.lava}` : '3px solid transparent',
                    paddingLeft: activeConversation === conv.id ? 13 : 16,
                    position: 'relative',
                  }}
                  className="group"
                >
                  {editingId === conv.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') renameConversation(conv.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        style={{ flex: 1, padding: '4px 8px', fontSize: 13, borderRadius: 4, background: SB.surface2, color: SB.inkDisplay, border: `1px solid ${SB.border}`, outline: 'none' }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button onClick={() => renameConversation(conv.id)} style={{ padding: 4, background: 'none', border: 0, cursor: 'pointer' }}>
                        <Check size={12} style={{ color: '#16A34A' }} />
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ padding: 4, background: 'none', border: 0, cursor: 'pointer' }}>
                        <X size={12} style={{ color: '#DC2626' }} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{
                        fontSize: 13, fontWeight: 500, color: SB.inkDisplay, lineHeight: 1.3,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {conv.title || 'New Conversation'}
                      </div>
                      <div style={{ fontFamily: fontFamily.mono, fontSize: 10, color: SB.inkMuted, marginTop: 4 }}>
                        {formatTime(conv.updated_at)}
                      </div>
                      <div className="hidden group-hover:flex" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', gap: 2 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingId(conv.id); setEditingTitle(conv.title || ''); }}
                          style={{ padding: 4, background: 'none', border: 0, cursor: 'pointer', borderRadius: 4 }}
                        >
                          <Edit2 size={12} style={{ color: SB.inkMuted }} />
                        </button>
                        <button
                          onClick={(e) => deleteConversation(conv.id, e)}
                          style={{ padding: 4, background: 'none', border: 0, cursor: 'pointer', borderRadius: 4 }}
                        >
                          <Trash2 size={12} style={{ color: '#DC2626' }} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Mobile: Backdrop overlay */}
        {isChatOpen && (
          <div
            className="fixed inset-0 bg-black/40 lg:hidden z-40"
            onClick={closeAll}
            aria-hidden="true"
          />
        )}

        {/* ════════ CHAT PANEL ════════ */}
        <section style={{
          background: SB.surface, border: `1px solid ${SB.border}`, borderRadius: 12,
          display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
        }}>
          {/* Chat header */}
          <header style={{
            padding: '20px 24px', borderBottom: `1px solid ${SB.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontFamily: fontFamily.display, fontSize: 26, color: SB.inkDisplay, lineHeight: 1.1, margin: 0 }}>
                A second brain for <em style={{ color: SB.lava, fontStyle: 'italic' }}>your business</em>.
              </h2>
              <div style={{
                fontFamily: fontFamily.mono, fontSize: 11, color: SB.inkMuted, marginTop: 4,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{
                  width: 6, height: 6, background: '#16A34A', borderRadius: '50%',
                  boxShadow: '0 0 8px rgba(22,163,74,0.5)', animation: 'sbPulse 1.6s infinite',
                }} />
                BIQc Pro model active
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {scanUsage && !scanUsage.calibration_complete && (
                <a href="/calibration"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                    borderRadius: 8, fontSize: 12, fontWeight: 500, textDecoration: 'none',
                    background: 'rgba(232,93,0,0.08)', border: '1px solid rgba(232,93,0,0.2)',
                    color: SB.lava, fontFamily: fontFamily.mono,
                  }}
                  data-testid="mysb-calibration-btn">
                  <Zap size={14} /> Calibrate
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
                          sessionStorage.removeItem('biqc_scan_usage_cache');
                          await fetchScanUsage(true);
                        } catch {}
                        setRecordingScans(prev => ({ ...prev, exposure_scan: false }));
                      }
                      window.location.href = '/exposure-scan';
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                      borderRadius: 8, fontSize: 12, fontWeight: 500, border: 'none',
                      background: canRun || isPaid ? 'rgba(59,130,246,0.08)' : 'rgba(140,170,210,0.08)',
                      color: canRun || isPaid ? '#3B82F6' : '#64748B',
                      fontFamily: fontFamily.mono, cursor: canRun || isPaid ? 'pointer' : 'not-allowed',
                    }}
                    data-testid="mysb-exposure-scan-btn">
                    <Eye size={14} />
                    {recordingScans.exposure_scan ? 'Recording...' :
                      !canRun && !isPaid ? `Exposure (${daysLeft}d)` :
                      'Exposure Scan'}
                    {!canRun && !isPaid && <Clock size={12} style={{ opacity: 0.5 }} />}
                  </button>
                );
              })()}
              <button
                onClick={() => setShowVoiceChat(true)}
                aria-label="Start voice call"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                  borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none',
                  background: '#16A34A', color: '#fff', cursor: 'pointer', fontFamily: fontFamily.body,
                }}
              >
                <Video size={14} />
                <span className="hidden md:inline">Voice</span>
              </button>
              {loading && (
                <button
                  onClick={stopStreaming}
                  aria-label="Stop Ask BIQc response"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                    borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none',
                    background: 'rgba(220,38,38,0.9)', color: '#fff', cursor: 'pointer',
                  }}
                >
                  <X size={14} /> Stop
                </button>
              )}
            </div>
          </header>

          {!loadingConversations && conversationsError ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <PageErrorState
                error={conversationsError}
                onRetry={fetchConversations}
                moduleName="Ask BIQc"
              />
            </div>
          ) : (
          <>
          {/* ── Chat thread ── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <span className="sr-only">Edit &amp; resend Regenerate Coverage window</span>
              <AskBiqcSessionLineage
                latestAssistantMessage={latestAssistantMessage}
                compact
                className="mb-4"
                testId="soundboard-session-lineage"
              />

              {messages.length === 0 ? (
                /* ── Empty state / suggestions grid ── */
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 16px' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: SB.surface2, marginBottom: 16 }}>
                    <MessageSquare size={28} style={{ color: SB.lava }} />
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: SB.inkDisplay, marginBottom: 4, textAlign: 'center' }}>
                    {firstName ? `${firstName}, what do you want to tackle?` : 'Ask anything about your business'}
                  </p>
                  <p style={{ fontSize: 12, color: SB.inkMuted, marginBottom: 20, textAlign: 'center' }}>
                    {advisorHandoff ? 'or choose a BIQc next move below' : 'pick a prompt or type your own'}
                  </p>
                  {/* Suggestion chips - 2x2 grid like mockup */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxWidth: 560, width: '100%' }}>
                    {(advisorHandoff ? buildAdvisorSuggestedOptions(advisorHandoff) : [
                      { label: "What's the one thing I should focus on?", prompt: "What's the one thing I should focus on?" },
                      { label: 'Summarise my risks', prompt: 'Summarise my risks' },
                      { label: 'Show me my pipeline', prompt: 'Show me my pipeline' },
                      { label: "How's my revenue looking?", prompt: "How's my revenue looking?" },
                    ]).map((q) => (
                      <button
                        key={q.label}
                        onClick={() => sendMessage(q.prompt, advisorHandoff)}
                        style={{
                          textAlign: 'left', padding: '12px 16px',
                          background: SB.surface2, border: `1px solid ${SB.border}`,
                          borderRadius: 8, cursor: 'pointer', transition: 'all 180ms ease',
                          display: 'flex', alignItems: 'center', gap: 12,
                          fontSize: 13, color: SB.ink, fontFamily: fontFamily.body,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = SB.lavaWash; e.currentTarget.style.borderColor = SB.lava; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = SB.surface2; e.currentTarget.style.borderColor = SB.border; e.currentTarget.style.transform = 'translateY(0)'; }}
                      >
                        <span style={{
                          width: 28, height: 28, background: SB.surface, borderRadius: 6,
                          color: SB.lava, display: 'grid', placeItems: 'center', flexShrink: 0,
                          border: `1px solid ${SB.border}`,
                        }}>
                          <Zap size={14} />
                        </span>
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* ── Message bubbles ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                        animation: 'sbMsgIn 320ms cubic-bezier(0.25, 1, 0.5, 1)',
                      }}
                    >
                      <div style={{
                        maxWidth: '78%', padding: '16px 20px', borderRadius: 12,
                        fontSize: 15, lineHeight: 1.6,
                        ...(message.role === 'user' ? {
                          alignSelf: 'flex-end',
                          background: SB.userBubble,
                          color: '#fff',
                          borderBottomRightRadius: 4,
                        } : {
                          alignSelf: 'flex-start',
                          background: SB.surface2,
                          color: SB.ink,
                          borderBottomLeftRadius: 4,
                          border: `1px solid ${SB.border}`,
                        }),
                      }}>
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
                            <div className="markdown-body" style={{ fontSize: 15, lineHeight: 1.6 }}>
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {normalizeMessageContent(message.content)}
                              </ReactMarkdown>
                            </div>
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
                        {/* Message meta line */}
                        <div style={{
                          fontFamily: fontFamily.mono, fontSize: 10, marginTop: 8,
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                          display: 'flex', alignItems: 'center', gap: 8,
                          color: message.role === 'user' ? 'rgba(255,255,255,0.5)' : SB.inkMuted,
                        }}>
                          {message.role === 'user' ? 'You' : 'BIQc'}
                          {message.model_used && ` \u00B7 ${message.model_used}`}
                          {message.agent_name && ` \u00B7 ${message.agent_name}`}
                        </div>
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div style={{
                        padding: '16px 20px', borderRadius: 12, borderBottomLeftRadius: 4,
                        background: SB.surface2, border: `1px solid ${SB.border}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <span className="animate-bounce" style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748B', animationDelay: '0ms' }} />
                            <span className="animate-bounce" style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748B', animationDelay: '150ms' }} />
                            <span className="animate-bounce" style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748B', animationDelay: '300ms' }} />
                          </div>
                          <span style={{ fontSize: 14, color: SB.inkMuted }}>
                            {showBoardroomViz ? `${activeBoardroomCheck.role}: ${activeBoardroomCheck.line}` : 'BIQc is thinking...'}
                          </span>
                        </div>
                        {showBoardroomViz && (
                          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ width: '100%', height: 6, borderRadius: 999, overflow: 'hidden', background: 'rgba(30,41,59,0.8)' }}>
                              <div style={{ height: '100%', borderRadius: 999, width: `${boardroomProgress}%`, background: 'linear-gradient(90deg, #3B82F6, #10B981)', transition: 'width 700ms ease' }} />
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {boardroomChecks.map((step, i) => (
                                <span
                                  key={`${step.role}-${i}`}
                                  className="animate-pulse"
                                  style={{
                                    fontSize: 9, padding: '2px 6px', borderRadius: 4,
                                    background: i === boardroomNarrationIndex % Math.max(1, boardroomChecks.length) ? 'rgba(59,130,246,0.22)' : 'rgba(59,130,246,0.12)',
                                    color: i === boardroomNarrationIndex % Math.max(1, boardroomChecks.length) ? '#DBEAFE' : '#93C5FD',
                                    fontFamily: fontFamily.mono, animationDelay: `${i * 120}ms`,
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

          {/* ── Input area ── */}
          <div style={{ padding: '20px 24px', borderTop: `1px solid ${SB.border}`, background: SB.surface }}>
              {/* File attachment preview */}
              {attachedFile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 12px', borderRadius: 8, background: SB.surface2, border: '1px solid rgba(232,93,0,0.3)' }}>
                  <FileText size={14} style={{ color: SB.lava, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, color: SB.inkDisplay, fontFamily: fontFamily.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedFile.name}</span>
                  {attachedFile.type === 'text' && <span style={{ fontSize: 9, color: '#10B981', fontFamily: fontFamily.mono }}>ready</span>}
                  {attachedFile.hint && <span style={{ fontSize: 9, color: '#F59E0B', fontFamily: fontFamily.mono, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedFile.hint}</span>}
                  <button onClick={() => setAttachedFile(null)} style={{ padding: 2, background: 'none', border: 0, cursor: 'pointer', color: SB.inkMuted }}>
                    <X size={12} />
                  </button>
                </div>
              )}
              {uploadedFiles.length > 0 && (
                <p style={{ marginBottom: 8, fontSize: 10, color: SB.inkMuted, fontFamily: fontFamily.mono }}>
                  Uploaded files in this session: {uploadedFiles.length}
                </p>
              )}

              {/* Agent / mode toggle bar */}
              <div style={{ marginBottom: 8, position: 'relative' }} data-testid="soundboard-mode-toggle-wrapper">
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => setSelectedAgent('general')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                      borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: fontFamily.mono,
                      background: selectedAgent === 'general' ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)',
                      border: `1px solid ${selectedAgent === 'general' ? 'rgba(129,140,248,0.55)' : 'rgba(99,102,241,0.25)'}`,
                      color: '#C7D2FE', cursor: 'pointer',
                    }}
                  >
                    <span>&#9678;</span><span>Advisor</span>
                  </button>
                  <button
                    onClick={() => setSelectedAgent('boardroom')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                      borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: fontFamily.mono,
                      background: selectedAgent === 'boardroom' ? 'rgba(59,130,246,0.22)' : 'rgba(59,130,246,0.1)',
                      border: `1px solid ${selectedAgent === 'boardroom' ? 'rgba(96,165,250,0.55)' : 'rgba(59,130,246,0.25)'}`,
                      color: '#93C5FD', cursor: 'pointer',
                    }}
                  >
                    <span>{'\uD83C\uDFDB\uFE0F'}</span><span>Boardroom</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowAdvancedControls((prev) => !prev);
                      if (showAdvancedControls) { setShowModeMenu(false); setShowAgentMenu(false); }
                    }}
                    style={{
                      padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                      background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.35)',
                      color: 'var(--ink-secondary, #525252)', fontFamily: fontFamily.mono, cursor: 'pointer',
                    }}
                  >
                    {showAdvancedControls ? 'Hide advanced' : 'Advanced'}
                  </button>
                </div>

                {showAdvancedControls && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => { setShowModeMenu((v) => !v); setShowAgentMenu(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                          borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: fontFamily.mono,
                          background: 'rgba(232,93,0,0.1)', border: '1px solid rgba(232,93,0,0.2)',
                          color: SB.lava, cursor: 'pointer',
                        }}
                        data-testid="soundboard-mode-selector"
                      >
                        <span>{activeMode?.icon}</span>
                        <span>{activeMode?.label}</span>
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      {showModeMenu && (
                        <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 8, width: 320, borderRadius: 12, overflow: 'hidden', background: 'var(--surface, #FFFFFF)', border: '1px solid #1E2D3D', zIndex: 50, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                          {availableModes.map((mode, idx) => (
                            <button
                              key={mode.id}
                              onClick={() => { setSelectedMode(mode.id); setShowModeMenu(false); }}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
                                textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
                                borderBottom: idx < availableModes.length - 1 ? '1px solid #1E2D3D' : 'none',
                              }}
                              data-testid={`soundboard-mode-option-${mode.id}`}
                            >
                              <span style={{ fontSize: 18, flexShrink: 0 }}>{mode.icon}</span>
                              <div>
                                <p style={{ fontSize: 14, fontWeight: 600, color: selectedMode === mode.id ? SB.lava : SB.inkDisplay, fontFamily: fontFamily.body, margin: 0 }}>
                                  {mode.label}
                                  {selectedMode === mode.id && (
                                    <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(232,93,0,0.15)', color: SB.lava }}>Active</span>
                                  )}
                                </p>
                                <p style={{ fontSize: 11, marginTop: 2, color: '#64748B', fontFamily: fontFamily.body }}>{mode.desc}</p>
                              </div>
                            </button>
                          ))}
                          {!canUseTrinity && (
                            <a href="/subscribe" style={{
                              width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
                              textAlign: 'left', textDecoration: 'none',
                            }} data-testid="soundboard-trinity-upgrade-link">
                              <span style={{ fontSize: 18, flexShrink: 0, opacity: 0.4 }}>{'\u25C8'}</span>
                              <div>
                                <p style={{ fontSize: 14, fontWeight: 600, color: '#4A5568', fontFamily: fontFamily.body, margin: 0 }}>BIQc Trinity</p>
                                <p style={{ fontSize: 11, marginTop: 2, color: '#4A5568', fontFamily: fontFamily.body }}>Available on the paid plan</p>
                              </div>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => { setShowAgentMenu((v) => !v); setShowModeMenu(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                          borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: fontFamily.mono,
                          background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
                          color: '#3B82F6', cursor: 'pointer',
                        }}
                        data-testid="soundboard-agent-selector"
                      >
                        <span>{BIQC_AGENTS.find(a => a.id === selectedAgent)?.icon || '\u26A1'}</span>
                        <span>{BIQC_AGENTS.find(a => a.id === selectedAgent)?.label || 'Auto'}</span>
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      {showAgentMenu && (
                        <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 8, width: 224, borderRadius: 12, overflow: 'hidden', background: 'var(--surface, #FFFFFF)', border: '1px solid #1E2D3D', zIndex: 50, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                          <p style={{ padding: '6px 12px', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', fontFamily: fontFamily.mono, margin: 0 }}>Agent</p>
                          {BIQC_AGENTS.map((agent) => (
                            <button
                              key={agent.id}
                              onClick={() => { setSelectedAgent(agent.id); setShowAgentMenu(false); }}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                                textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
                                borderTop: '1px solid #1E2D3D',
                              }}
                              data-testid={`soundboard-agent-${agent.id}`}
                            >
                              <span style={{ fontSize: 14, flexShrink: 0 }}>{agent.icon}</span>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: 12, fontWeight: 600, color: selectedAgent === agent.id ? '#3B82F6' : SB.inkDisplay, fontFamily: fontFamily.body, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.label}</p>
                                <p style={{ fontSize: 10, color: '#64748B', fontFamily: fontFamily.body, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.shortDesc}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                      borderRadius: 999, fontSize: 11, fontWeight: 600,
                      background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
                      color: '#C7D2FE', fontFamily: fontFamily.mono, cursor: 'pointer',
                    }}>
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

              {/* Composer input row - mockup style */}
              <div style={{
                display: 'flex', alignItems: 'flex-end', gap: 12, padding: '12px 16px',
                background: SB.surface2, border: `1px solid ${SB.border}`, borderRadius: 12,
                transition: 'border-color 180ms ease',
              }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={attachedFile ? `Ask about ${attachedFile.name}...` : 'Ask BIQc anything...'}
                  style={{
                    flex: 1, border: 0, background: 'transparent', outline: 'none', resize: 'none',
                    font: `400 15px/1.5 ${fontFamily.body}`, color: SB.ink,
                    minHeight: 22, maxHeight: 160,
                  }}
                  rows={1}
                  data-testid="soundboard-input"
                  onFocus={(e) => { e.currentTarget.parentElement.style.borderColor = SB.lava; e.currentTarget.parentElement.style.boxShadow = `0 0 0 4px ${SB.lavaRing}`; }}
                  onBlur={(e) => { e.currentTarget.parentElement.style.borderColor = SB.border; e.currentTarget.parentElement.style.boxShadow = 'none'; }}
                />
                <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect}
                  accept=".txt,.csv,.md,.json,.log,.xml,.html,.py,.js,.ts,.sql,.pdf,.doc,.docx,.png,.jpg" />
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{ padding: 8, background: 'none', border: 0, cursor: 'pointer', color: attachedFile ? SB.lava : SB.inkMuted, flexShrink: 0, borderRadius: 8 }}
                  data-testid="soundboard-attach" title="Attach file"
                >
                  <Paperclip size={16} />
                </button>
                <button
                  onClick={() => sendMessage()}
                  disabled={(!input.trim() && !attachedFile) || loading}
                  data-testid="send-message-btn"
                  style={{
                    width: 40, height: 40, background: SB.lava, color: '#fff',
                    border: 0, borderRadius: 8, display: 'grid', placeItems: 'center',
                    cursor: (!input.trim() && !attachedFile) || loading ? 'not-allowed' : 'pointer',
                    flexShrink: 0, transition: 'all 180ms ease',
                    opacity: (!input.trim() && !attachedFile) || loading ? 0.5 : 1,
                  }}
                >
                  <Send size={18} />
                </button>
              </div>

              {/* Hint line */}
              <div style={{ fontFamily: fontFamily.mono, fontSize: 10, color: SB.inkMuted, marginTop: 8, textAlign: 'center' }}>
                <kbd style={{ padding: '1px 5px', background: SB.surface, border: `1px solid ${SB.border}`, borderRadius: 3 }}>{'\u21B5'}</kbd> to send{' \u00B7 '}
                <kbd style={{ padding: '1px 5px', background: SB.surface, border: `1px solid ${SB.border}`, borderRadius: 3 }}>{'\u21E7\u21B5'}</kbd> for newline{' \u00B7 '}
                BIQc reads your inbox, calendar, deals, and accounting
              </div>
          </div>
          </>
          )}
        </section>
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
