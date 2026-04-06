import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Paperclip, Video, X, ChevronDown, FileText } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { trackEvent, EVENTS, trackActivationStep, trackOnceForUser } from '../lib/analytics';
import DataCoverageGate from './DataCoverageGate';
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


// Data query detection — ONLY route to integration Edge Function for EXPLICIT data retrieval requests.
// Must NOT intercept strategic advisory questions that happen to mention business terms.
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
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeConversationTitle, setActiveConversationTitle] = useState('');
  // ── Coverage gate state ──
  const [coverageGate, setCoverageGate] = useState(null); // {guardrail, coveragePct, missingFields}

  const { session, user } = useSupabaseAuth();
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
  const boardroomChecks = useMemo(
    () => buildBoardroomChecks(boardroomConnectedSources, boardroomEvidenceSources),
    [boardroomConnectedSources, boardroomEvidenceSources]
  );
  const activeBoardroomCheck = boardroomChecks[boardroomNarrationIndex % Math.max(1, boardroomChecks.length)] || { role: 'CEO', line: 'Checking strategic priorities...' };

  const inputRef = useRef(null);
  const messageThreadRef = useRef(null);
  const fileRef = useRef(null);
  const streamAbortRef = useRef(null);

  useEffect(() => {
    if (!loading || !showBoardroomViz) {
      setBoardroomNarrationIndex(0);
      return undefined;
    }
    const narrationTimer = setInterval(() => {
      setBoardroomNarrationIndex((prev) => (prev + 1) % Math.max(1, boardroomChecks.length));
    }, 1400);
    return () => {
      clearInterval(narrationTimer);
    };
  }, [loading, showBoardroomViz, boardroomChecks.length]);

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

  // Auto-scroll on new messages and stream deltas
  useEffect(() => {
    if (messageThreadRef.current) {
      messageThreadRef.current.scrollTop = messageThreadRef.current.scrollHeight;
    }
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
        setActiveConversationTitle(turnResult.responseData.conversation_title || 'Ask BIQc');
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
    setActiveConvId(conv.id);
    setActiveConversationTitle(conv.title || 'Ask BIQc');
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
        model_used: m.model_used || m?.metadata?.model_used,
        confidence_score: m.confidence_score ?? m?.metadata?.confidence_score,
        data_freshness: m.data_freshness || m?.metadata?.data_freshness,
        data_sources_count: m.data_sources_count ?? m?.metadata?.data_sources_count,
        lineage: m.lineage || m?.metadata?.lineage,
        suggested_actions: m.suggested_actions || m?.metadata?.suggested_actions || [],
        file: m.file || m?.metadata?.file,
        agent_name: m.agent_name || m?.metadata?.agent_name,
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
    setActiveConversationTitle('');
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

  const assistantBody = (msg, idx) => {
    const isLatestAssistant = idx === messages.length - 1 && loading;
    const responseMessage = { ...msg, agent_name: null };
    return (
      <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #FF7A18, #E56A08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            B
          </div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
            {msg.agent_name || 'BIQc'}
            {isLatestAssistant && <span style={{ color: '#FF6A00', marginLeft: 8 }}>thinking...</span>}
          </span>
        </div>
        <AskBiqcAssistantResponse
          message={responseMessage}
          compact
          onCopy={() => handleCopyAssistantMessage(msg)}
          onUseInComposer={() => handleUseAnswerInComposer(msg)}
          onRegenerate={() => {
            const previousUserPrompt = findPreviousAskBiqcUserPrompt(messages, idx);
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
      </div>
    );
  };

  const userBody = (msg) => {
    const content = normalizeMessageContent(msg.content ?? msg.text);
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 20px' }}>
        <div
          style={{
            maxWidth: '70%',
            padding: '12px 16px',
            background: 'rgba(255,106,0,0.15)',
            border: '1px solid rgba(255,106,0,0.25)',
            borderRadius: '18px 18px 4px 18px',
            fontSize: 14,
            color: 'rgba(255,255,255,0.9)',
            lineHeight: 1.5,
          }}
        >
          {content}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: '#0a0f1a',
        color: '#fff',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
      }}
      data-testid="soundboard-panel"
    >
      <div
        style={{
          width: sidebarCollapsed ? '0px' : '260px',
          minWidth: sidebarCollapsed ? '0px' : '260px',
          height: '100vh',
          background: '#0d1421',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width 0.2s ease, min-width 0.2s ease',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Ask BIQc</span>
          <button
            onClick={() => setSidebarCollapsed(true)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 4 }}
            title="Collapse sidebar"
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '12px 16px', flexShrink: 0 }}>
          <button
            onClick={newChat}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(255,106,0,0.12)',
              border: '1px solid rgba(255,106,0,0.3)',
              borderRadius: 10,
              color: '#FF6A00',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> New Conversation
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {conversations.length === 0 ? (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', padding: '16px 8px', textAlign: 'center' }}>
              No conversations yet
            </p>
          ) : (
            <>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: '8px 8px 4px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Recent
              </p>
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv)}
                  style={{
                    width: '100%',
                    padding: '10px 10px',
                    marginBottom: 2,
                    borderRadius: 8,
                    background: activeConvId === conv.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'block',
                  }}
                >
                  <p
                    style={{
                      fontSize: 13,
                      color: activeConvId === conv.id ? '#fff' : 'rgba(255,255,255,0.6)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      margin: 0,
                    }}
                  >
                    {conv.title || 'New Conversation'}
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', margin: '2px 0 0' }}>
                    {conv.updated_at ? new Date(conv.updated_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''}
                  </p>
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          style={{
            position: 'fixed',
            top: 12,
            left: 12,
            zIndex: 100,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            padding: '6px 10px',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            fontSize: 16,
          }}
          title="Show conversations"
        >
          ☰
        </button>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh' }}>
        <div
          style={{
            height: 52,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            gap: 12,
            flexShrink: 0,
            background: '#0a0f1a',
          }}
        >
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: 4, fontSize: 18 }}
            >
              ☰
            </button>
          )}
          <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>
            {activeConversationTitle || 'Ask BIQc'}
          </span>
        </div>

        <div ref={messageThreadRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 0', display: 'flex', flexDirection: 'column' }}>
          {messages.length === 0 && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 40,
                opacity: 0.4,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #FF7A18, #E56A08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  fontSize: 20,
                }}
              >
                B
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 8 }}>Ask BIQc anything</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', maxWidth: 300 }}>
                Ask about your pipeline, cash flow, risks, or what needs attention this week.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            msg.role === 'user'
              ? <div key={`u-${i}`}>{userBody(msg)}</div>
              : <div key={`a-${i}`}>{assistantBody(msg, i)}</div>
          ))}

          {loading && showBoardroomViz && (
            <div
              style={{
                padding: '10px 20px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,106,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#FF6A00',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  Boardroom Council Live
                </span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['CRM', 'Accounting', 'Email', 'Signals'].map((source) => (
                    <span
                      key={source}
                      style={{
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 20,
                        background: 'rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {source}
                    </span>
                  ))}
                </div>
              </div>

              <div
                style={{
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                  {activeBoardroomCheck.line}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {['CEO', 'CFO', 'COO', 'CMO'].map((role) => (
                  <span
                    key={role}
                    style={{
                      fontSize: 11,
                      padding: '3px 10px',
                      borderRadius: 20,
                      background: 'rgba(255,106,0,0.1)',
                      border: '1px solid rgba(255,106,0,0.2)',
                      color: '#FF6A00',
                    }}
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
          )}

          {loading && !showBoardroomViz && (
            <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: 'linear-gradient(135deg, #FF7A18, #E56A08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  B
                </div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                  BIQc <span style={{ color: '#FF6A00', marginLeft: 8 }}>thinking...</span>
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>BIQc is thinking...</p>
            </div>
          )}
        </div>

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
