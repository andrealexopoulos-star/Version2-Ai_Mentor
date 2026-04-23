import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Paperclip, Video, X, ChevronDown, FileText, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { supabase } from '../context/SupabaseAuthContext';
import { trackEvent, EVENTS, trackActivationStep, trackOnceForUser } from '../lib/analytics';
import { fontFamily } from '../design-system/tokens';
import { toast } from 'sonner';
import { getSoundboardPolicy, SOUND_BOARD_MODES } from '../lib/soundboardPolicy';
import { deriveSoundboardRequestScope } from '../lib/soundboardQueryRouting';
import { getBackendUrl } from '../config/urls';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  appendAskBiqcDelta,
  buildAskBiqcComposedMessage,
  buildAskBiqcRequestPayload,
  buildBoardroomChecks,
  copyAskBiqcText,
  createAskBiqcPlaceholder,
  findPreviousAskBiqcUserPrompt,
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
import DashboardLayout from './DashboardLayout';


// Data query detection — ONLY route to integration Edge Function for EXPLICIT data retrieval requests.
// Must NOT intercept strategic advisory questions that happen to mention business terms.
function ConversationResumeCard({ field, value, resuming }) {
  const fieldLabel = String(field || '').replace(/_/g, ' ');
  return (
    <div
      style={{
        marginTop: 8,
        marginLeft: 20,
        marginRight: 20,
        padding: '10px 14px',
        background: 'rgba(16,185,129,0.06)',
        border: '1px solid rgba(16,185,129,0.15)',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span style={{ color: '#10B981', fontSize: 16 }}>✓</span>
      <div>
        <p style={{ fontSize: 13, color: '#10B981', margin: 0 }}>
          Saved {fieldLabel ? `${fieldLabel}: ` : ''}{value}
        </p>
        {resuming && (
          <p style={{ fontSize: 12, color: 'var(--ink-muted, #737373)', margin: '2px 0 0' }}>
            Updating analysis with new context...
          </p>
        )}
      </div>
    </div>
  );
}

function InlineIntegrationConnect({ req, onDismiss }) {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Missing session');
      const tokenRes = await fetch(`${getBackendUrl()}/api/integrations/merge/link-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ category: req.integration_category }),
      });
      const tokenData = await tokenRes.json();
      const linkToken = tokenData?.link_token;
      if (!linkToken) throw new Error('No link token returned');

      if (window.MergeLink) {
        window.MergeLink.initialize({
          linkToken,
          onSuccess: async (public_token) => {
            await fetch(`${getBackendUrl()}/api/integrations/merge/exchange-account-token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ public_token }),
            });
            setConnected(true);
            setConnecting(false);
          },
          onExit: () => {
            setConnecting(false);
          },
        });
        window.MergeLink.openLink();
      } else {
        window.open('/integrations', '_blank', 'noopener,noreferrer');
        setConnecting(false);
      }
    } catch (error) {
      console.error('Inline integration connect failed:', error);
      setConnecting(false);
    }
  };

  if (connected) {
    return (
      <div
        style={{
          padding: '10px 14px',
          borderRadius: 10,
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ color: '#10B981', fontSize: 16 }}>✓</span>
        <span style={{ fontSize: 13, color: '#10B981' }}>
          {req.label} connected — refreshing your analysis...
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'rgba(10,10,10,0.03)',
        border: '1px solid rgba(10,10,10,0.08)',
        borderRadius: 10,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div>
        <span style={{ fontSize: 13, color: 'var(--ink, #171717)', fontWeight: 500 }}>
          {req.label}
        </span>
        <p style={{ fontSize: 12, color: 'var(--ink-muted, #737373)', margin: '2px 0 0' }}>
          {req.why}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={handleConnect}
          disabled={connecting}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            background: 'rgba(232,93,0,0.15)',
            border: '1px solid rgba(232,93,0,0.3)',
            color: '#E85D00',
            fontSize: 12,
            fontWeight: 600,
            cursor: connecting ? 'default' : 'pointer',
          }}
        >
          {connecting ? 'Opening...' : req.integration_label}
        </button>
        <button
          onClick={onDismiss}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            background: 'none',
            color: 'var(--ink-muted, #737373)',
            border: '1px solid rgba(10,10,10,0.1)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Later
        </button>
      </div>
    </div>
  );
}

function InlineFieldCapture({ req, value, onChange, onSave, onDismiss, saving }) {
  const [expanded, setExpanded] = useState(false);

  if (req.type === 'integration') {
    return <InlineIntegrationConnect req={req} onDismiss={onDismiss} />;
  }

  return (
    <div
      style={{
        background: 'rgba(10,10,10,0.03)',
        border: '1px solid rgba(10,10,10,0.08)',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div>
          <span style={{ fontSize: 13, color: 'var(--ink, #171717)', fontWeight: 500 }}>
            {req.label}
          </span>
          <span style={{ fontSize: 12, color: 'var(--ink-muted, #737373)', marginLeft: 8 }}>
            — {req.why}
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            color: '#E85D00',
            padding: '2px 10px',
            background: 'rgba(232,93,0,0.1)',
            borderRadius: 20,
            border: '1px solid rgba(232,93,0,0.2)',
            flexShrink: 0,
            marginLeft: 8,
          }}
        >
          {expanded ? 'Cancel' : 'Add'}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 12px', borderTop: '1px solid rgba(10,10,10,0.06)' }}>
          {req.type === 'select' ? (
            <select
              value={value}
              onChange={(event) => onChange(event.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                marginTop: 8,
                background: 'rgba(10,10,10,0.06)',
                border: '1px solid rgba(10,10,10,0.12)',
                borderRadius: 8,
                color: 'var(--ink-display, #0A0A0A)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <option value="">Select {String(req.label || '').toLowerCase()}...</option>
              {(req.options || []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={req.placeholder || `Enter ${String(req.label || '').toLowerCase()}...`}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && value.trim()) onSave();
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                marginTop: 8,
                background: 'rgba(10,10,10,0.06)',
                border: '1px solid rgba(10,10,10,0.12)',
                borderRadius: 8,
                color: 'var(--ink-display, #0A0A0A)',
                fontSize: 13,
                boxSizing: 'border-box',
              }}
            />
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={onSave}
              disabled={!value || saving}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                background: value ? '#E85D00' : 'rgba(10,10,10,0.1)',
                color: value ? 'white' : 'rgba(10,10,10,0.3)',
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                cursor: value ? 'pointer' : 'default',
              }}
            >
              {saving ? 'Saving...' : 'Save and update analysis'}
            </button>
            <button
              onClick={onDismiss}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: 'none',
                color: 'var(--ink-muted, #737373)',
                border: '1px solid rgba(10,10,10,0.1)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InlineDataRequirements({ requirements, originalMessage, conversationId, onResume }) {
  const [saved, setSaved] = useState({});
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState({});
  const [dismissed, setDismissed] = useState([]);

  if (!Array.isArray(requirements) || requirements.length === 0) return null;
  const visible = requirements.filter((req) => !dismissed.includes(req.id) && !saved[req.id]);
  if (!visible.length) return null;

  const handleSave = async (req) => {
    const value = String(values[req.id] || '').trim();
    if (!value) return;
    setSaving((prev) => ({ ...prev, [req.id]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Missing session');
      const response = await fetch(`${getBackendUrl()}/api/soundboard/resume-after-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          original_message: originalMessage,
          saved_field: req.id,
          saved_value: value,
        }),
      });
      const payload = await response.json();
      if (payload.status === 'saved') {
        setSaved((prev) => ({ ...prev, [req.id]: value }));
        if (onResume && payload.resume_message) {
          onResume(payload.resume_message, req, value);
        }
      }
    } catch (error) {
      console.error('Failed to save inline field:', error);
    } finally {
      setSaving((prev) => ({ ...prev, [req.id]: false }));
    }
  };

  return (
    <div
      style={{
        marginTop: 16,
        padding: '14px 16px',
        background: 'rgba(10,10,10,0.04)',
        border: '1px solid rgba(10,10,10,0.1)',
        borderRadius: 12,
      }}
    >
      <p style={{ fontSize: 12, color: 'var(--ink-muted, #737373)', marginBottom: 12, fontWeight: 500, letterSpacing: '0.05em' }}>
        SHARPEN THIS RESPONSE
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map((req) => (
          <InlineFieldCapture
            key={req.id}
            req={req}
            value={values[req.id] || ''}
            onChange={(nextValue) => setValues((prev) => ({ ...prev, [req.id]: nextValue }))}
            onSave={() => handleSave(req)}
            onDismiss={() => setDismissed((prev) => [...prev, req.id])}
            saving={Boolean(saving[req.id])}
          />
        ))}
      </div>
    </div>
  );
}

const SoundboardPanel = ({ actionMessage, onActionConsumed }) => {
  const navigate = useNavigate();
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
  const streamingBuffer = useMemo(() => {
    const activeStreamingMessage = [...messages].reverse().find((message) => message.streaming);
    return String(activeStreamingMessage?.content || '');
  }, [messages]);

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
  }, [messages, streamingBuffer]);

  const stopStreaming = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setLoading(false);
    setMessages((prev) => markAskBiqcStreamingStopped(prev, { includeText: true }));
  }, []);

  const appendUserMessage = useCallback((rawMessage) => {
    const cleanMessage = String(rawMessage || '').trim();
    if (!cleanMessage) return '';
    // Ensure no in-flight assistant streaming buffer remains before user append.
    setMessages((prev) => [
      ...prev.filter((message) => !message.streaming),
      { role: 'user', text: cleanMessage, content: cleanMessage },
    ]);
    return cleanMessage;
  }, []);

  // Handle action messages from insight cards
  useEffect(() => {
    if (actionMessage && actionMessage.trim()) {
      setInput('');
      const cleanActionMessage = appendUserMessage(actionMessage);
      if (cleanActionMessage) {
        executeMessage(cleanActionMessage);
      }
      if (onActionConsumed) onActionConsumed();
    }
  }, [actionMessage, appendUserMessage, onActionConsumed]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopyAssistantMessage = useCallback(async (message) => {
    const copied = await copyAskBiqcText(getAskBiqcMessageText(message));
    if (copied) {
      toast.success('Ask BIQc response copied to clipboard.');
      return;
    }
    toast.error('Failed to copy Ask BIQc response.');
  }, []);

  const executeMessage = async (userMsg, fullMessage, traceOptions = null, options = {}) => {
    const { isResume = false, resumeConfirmationId = null } = options;
    const msgToSend = fullMessage || userMsg;
    const resumeStatusId = isResume ? `resume-status-${Date.now()}` : null;
    setLoading(true);
    try {
      if (resumeStatusId) {
        setMessages((prev) => ([
          ...prev,
          {
            id: resumeStatusId,
            role: 'assistant_status',
            content: 'Updating analysis with your new context...',
            isStatus: true,
          },
        ]));
      }
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

      if (turnResult.kind === 'empty') {
        setMessages((prev) => [
          ...removeAskBiqcPlaceholder(
            prev.filter((message) => message.id !== resumeStatusId),
            placeholderId
          ),
          turnResult.assistantMessage,
        ]);
        if (resumeConfirmationId) {
          setMessages((prev) => prev.map((message) => (
            message.id === resumeConfirmationId
              ? { ...message, resuming: false }
              : message
          )));
        }
        return;
      }

      setMessages((prev) => replaceAskBiqcPlaceholder(
        prev.filter((message) => message.id !== resumeStatusId),
        placeholderId,
        turnResult.assistantMessage
      ));
      if (resumeConfirmationId) {
        setMessages((prev) => prev.map((message) => (
          message.id === resumeConfirmationId
            ? { ...message, resuming: false }
            : message
        )));
      }
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
      setMessages((prev) => ([
        ...prev.filter((message) => !message.streaming && message.id !== resumeStatusId),
        { role: 'assistant', text: errText, content: errText },
      ]));
      if (resumeConfirmationId) {
        setMessages((prev) => prev.map((message) => (
          message.id === resumeConfirmationId
            ? { ...message, resuming: false }
            : message
        )));
      }
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
    const cleanMessage = appendUserMessage(userMsg || displayText);
    if (!cleanMessage) return;
    trackEvent(EVENTS.SOUNDBOARD_QUERY, { message_length: fullMessage.length, has_attachment: !!currentAttachment });
    trackOnceForUser(EVENTS.ACTIVATION_FIRST_SOUNDBOARD_USE, user?.id, { entrypoint: 'soundboard_panel' });
    trackActivationStep('first_soundboard_use', { entrypoint: 'soundboard_panel' });
    await executeMessage(cleanMessage, fullMessage);
  };

  const handleInlineResume = useCallback(async (resumeMessage, savedReq, savedValue) => {
    const confirmationId = `resume-confirm-${Date.now()}`;
    setMessages((prev) => ([
      ...prev,
      {
        id: confirmationId,
        role: 'resume_confirmation',
        field: savedReq?.id,
        value: savedValue,
        resuming: true,
      },
    ]));
    await executeMessage(
      resumeMessage,
      resumeMessage,
      {
        trace_root_id: `trace-${Date.now()}`,
        response_version: 1,
      },
      {
        isResume: true,
        resumeConfirmationId: confirmationId,
      }
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        data_requirements: m.data_requirements || m?.metadata?.data_requirements || [],
        data_coverage_pct: m.data_coverage_pct ?? m?.metadata?.data_coverage_pct ?? m.coverage_pct ?? null,
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
    const content = String(msg.content || msg.text || '');
    const dataRequirements = Array.isArray(msg.data_requirements) ? msg.data_requirements : [];
    const coveragePct = Number.isFinite(Number(msg.data_coverage_pct))
      ? Number(msg.data_coverage_pct)
      : (Number.isFinite(Number(msg.coverage_pct)) ? Number(msg.coverage_pct) : null);
    const originalMessage = messages
      .slice(0, idx)
      .filter((message) => message.role === 'user')
      .slice(-1)[0]?.content || '';

    return (
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(10,10,10,0.04)', background: 'var(--surface-sunken, #F5F5F5)', borderLeft: '1px solid var(--border, rgba(10,10,10,0.08))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #E85D00, #E56A08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            B
          </div>
          <span style={{ fontSize: 12, color: 'var(--ink-muted, #737373)', fontWeight: 500, fontFamily: fontFamily.body }}>
            BIQc
            {msg.agent_name && msg.agent_name !== 'BIQc' && (
              <span style={{ color: 'var(--ink-subtle, #A3A3A3)' }}> {'\u00B7'} {msg.agent_name}</span>
            )}
          </span>
          {coveragePct !== null && coveragePct < 50 && (
            <span
              style={{
                fontSize: 10,
                color: 'var(--ink-subtle, #A3A3A3)',
                padding: '1px 8px',
                borderRadius: 20,
                border: '1px solid rgba(10,10,10,0.1)',
                marginLeft: 4,
              }}
            >
              {coveragePct}% context — answers sharpen as you add more
            </span>
          )}
          {isLatestAssistant && (
            <span style={{ fontSize: 12, color: '#E85D00', marginLeft: 4 }}>
              <span style={{ animation: 'pulse 1s infinite' }}>●</span>
            </span>
          )}
        </div>

        <div className="markdown-body" style={{ lineHeight: 1.75, color: 'var(--ink-display, #0A0A0A)', fontSize: 14, fontFamily: fontFamily.body }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>

        {/* Message metadata: model, sources, response time */}
        {!isLatestAssistant && (msg.model_used || msg.data_sources_count || msg.agent_name) && (
          <div style={{
            marginTop: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: fontFamily.mono,
            fontSize: 10,
            color: 'var(--ink-subtle, #A3A3A3)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            {msg.model_used && <span>{msg.model_used}</span>}
            {msg.data_sources_count != null && <span>{'\u00B7'} {msg.data_sources_count} source{msg.data_sources_count !== 1 ? 's' : ''}</span>}
            {msg.confidence_score != null && <span>{'\u00B7'} {Math.round(msg.confidence_score * 100)}% confidence</span>}
            {msg.data_freshness && <span>{'\u00B7'} {msg.data_freshness}</span>}
          </div>
        )}

        {!isLatestAssistant && dataRequirements.length > 0 && (
          <InlineDataRequirements
            requirements={dataRequirements}
            originalMessage={originalMessage}
            conversationId={activeConvId}
            onResume={handleInlineResume}
          />
        )}

        {!isLatestAssistant && (
          <AskBiqcMessageActions
            role="assistant"
            compact
            onCopy={() => handleCopyAssistantMessage(msg)}
            onRegenerate={() => {
              const previousUserPrompt = findPreviousAskBiqcUserPrompt(messages, idx);
              if (!previousUserPrompt) return;
              const cleanMessage = appendUserMessage(previousUserPrompt);
              if (!cleanMessage) return;
              executeMessage(
                cleanMessage,
                cleanMessage,
                {
                  trace_root_id: msg.trace_root_id || `trace-${Date.now()}`,
                  response_version: Number(msg.response_version || 1) + 1,
                },
              );
            }}
            testIdPrefix="ask-biqc-panel-message-action"
          />
        )}
      </div>
    );
  };

  const userBody = (msg) => {
    const content = String(msg.content ?? msg.text ?? '');
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 20px' }}>
        <div
          style={{
            maxWidth: '70%',
            padding: '12px 16px',
            background: 'var(--surface-sunken, #F5F5F5)',
            border: '1px solid rgba(10,10,10,0.08)',
            borderRadius: '18px 18px 4px 18px',
            fontSize: 14,
            color: 'var(--ink-display, #0A0A0A)',
            lineHeight: 1.5,
            wordBreak: 'break-word',
            fontFamily: fontFamily.body,
          }}
        >
          {content}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
    <div
      style={{
        display: 'flex',
        // Size from parent flex, not viewport. DashboardLayout adds a top
        // bar, page-nav row, and padding above children, so `calc(100vh
        // - N)` is fragile. Codex P1 on PR #333.
        flex: 1,
        minHeight: 560,
        height: '100%',
        maxHeight: 'calc(100vh - 88px)',
        background: 'var(--surface, #FFFFFF)',
        color: 'var(--ink-display, #0A0A0A)',
        overflow: 'hidden',
        fontFamily: "var(--font-ui)",
        borderRadius: 12,
        border: '1px solid var(--border, rgba(10,10,10,0.08))',
      }}
      data-testid="soundboard-panel"
    >
      <div
        style={{
          width: sidebarCollapsed ? '0px' : '260px',
          minWidth: sidebarCollapsed ? '0px' : '260px',
          height: '100%',
          background: 'var(--surface-sunken, #F5F5F5)',
          borderRight: '1px solid rgba(10,10,10,0.08)',
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
            borderBottom: '1px solid rgba(10,10,10,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-secondary, #525252)', fontFamily: fontFamily.display }}>Ask BIQc</span>
          <button
            onClick={() => setSidebarCollapsed(true)}
            style={{ background: 'none', border: 'none', color: 'var(--ink-muted, #737373)', cursor: 'pointer', padding: 4 }}
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
              background: 'rgba(232,93,0,0.12)',
              border: '1px solid rgba(232,93,0,0.3)',
              borderRadius: 10,
              color: '#E85D00',
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
            <p style={{ fontSize: 12, color: 'var(--ink-subtle, #A3A3A3)', padding: '16px 8px', textAlign: 'center' }}>
              No conversations yet
            </p>
          ) : (
            <>
              <p style={{ fontSize: 10, color: 'var(--ink-muted, #737373)', padding: '8px 8px 4px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: fontFamily.mono }}>
                Recent conversations
              </p>
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv)}
                  onMouseEnter={(e) => { if (activeConvId !== conv.id) e.currentTarget.style.background = 'rgba(10,10,10,0.05)'; }}
                  onMouseLeave={(e) => { if (activeConvId !== conv.id) e.currentTarget.style.background = 'transparent'; }}
                  style={{
                    width: '100%',
                    padding: '10px 10px',
                    marginBottom: 2,
                    borderRadius: 8,
                    background: activeConvId === conv.id ? 'rgba(232,93,0,0.08)' : 'transparent',
                    border: 'none',
                    borderLeft: activeConvId === conv.id ? '3px solid #E85D00' : '3px solid transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'block',
                    transition: 'background 150ms ease, border-color 150ms ease',
                  }}
                >
                  <p
                    style={{
                      fontSize: 13,
                      color: activeConvId === conv.id ? 'var(--ink-display, #0A0A0A)' : 'var(--ink-secondary, #525252)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      margin: 0,
                      fontFamily: fontFamily.body,
                      fontWeight: activeConvId === conv.id ? 600 : 500,
                    }}
                  >
                    {conv.title || 'New Conversation'}
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--ink-subtle, #A3A3A3)', margin: '2px 0 0', fontFamily: fontFamily.mono }}>
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
            background: 'rgba(10,10,10,0.08)',
            border: '1px solid rgba(10,10,10,0.12)',
            borderRadius: 8,
            padding: '6px 10px',
            color: 'var(--ink-secondary, #525252)',
            cursor: 'pointer',
            fontSize: 16,
          }}
          title="Show conversations"
        >
          ☰
        </button>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
        <div
          style={{
            height: 52,
            borderBottom: '1px solid rgba(10,10,10,0.08)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            gap: 12,
            flexShrink: 0,
            background: 'var(--surface, #FFFFFF)',
          }}
        >
          <button
            onClick={() => navigate(-1)}
            className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)' }}
            data-testid="page-back-button"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              style={{ background: 'none', border: 'none', color: 'var(--ink-muted, #737373)', cursor: 'pointer', padding: 4, fontSize: 18 }}
            >
              ☰
            </button>
          )}
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-secondary, #525252)', fontFamily: fontFamily.display }}>
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
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #E85D00, #E56A08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  fontSize: 20,
                  opacity: 0.7,
                }}
              >
                B
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-display, #0A0A0A)', marginBottom: 8, fontFamily: fontFamily.display }}>Ask BIQc anything</p>
              <p style={{ fontSize: 13, color: 'var(--ink-muted, #737373)', textAlign: 'center', maxWidth: 340, fontFamily: fontFamily.body, marginBottom: 28 }}>
                Ask about your pipeline, cash flow, risks, or what needs attention this week.
              </p>
              {/* Suggested prompts grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 8,
                width: '100%',
                maxWidth: 480,
              }}>
                {[
                  { text: "What's happening in my pipeline?", icon: '📊' },
                  { text: "Show me this week's priorities", icon: '🎯' },
                  { text: "How's my cash position?", icon: '💰' },
                  { text: 'Draft a follow-up email', icon: '✉️' },
                ].map((prompt) => (
                  <button
                    key={prompt.text}
                    onClick={() => {
                      setInput(prompt.text);
                      setTimeout(() => {
                        const syntheticInput = prompt.text;
                        setInput('');
                        const cleanMessage = appendUserMessage(syntheticInput);
                        if (cleanMessage) executeMessage(cleanMessage);
                      }, 0);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(232,93,0,0.08)';
                      e.currentTarget.style.borderColor = 'rgba(232,93,0,0.3)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(10,10,10,0.04)';
                      e.currentTarget.style.borderColor = 'rgba(10,10,10,0.08)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      background: 'rgba(10,10,10,0.04)',
                      border: '1px solid rgba(10,10,10,0.08)',
                      borderRadius: 10,
                      cursor: 'pointer',
                      transition: 'all 180ms ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontSize: 13,
                      color: 'var(--ink-secondary, #525252)',
                      fontFamily: fontFamily.body,
                    }}
                  >
                    <span style={{
                      width: 28,
                      height: 28,
                      background: 'rgba(10,10,10,0.06)',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: 14,
                    }}>
                      {prompt.icon}
                    </span>
                    {prompt.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            msg.role === 'user'
              ? <div key={msg.id || `u-${i}`}>{userBody(msg)}</div>
              : msg.role === 'assistant_status'
                ? (
                  <div key={msg.id || `status-${i}`} style={{ padding: '8px 20px' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: 'rgba(10,10,10,0.04)',
                        border: '1px solid rgba(10,10,10,0.08)',
                        color: 'var(--ink-muted, #737373)',
                        fontSize: 12,
                      }}
                    >
                      <span style={{ animation: 'pulse 1s infinite' }}>●</span>
                      <span>{msg.content || 'Updating analysis...'}</span>
                    </div>
                  </div>
                )
                : msg.role === 'resume_confirmation'
                  ? (
                    <ConversationResumeCard
                      key={msg.id || `resume-${i}`}
                      field={msg.field}
                      value={msg.value}
                      resuming={Boolean(msg.resuming)}
                    />
                  )
                  : <div key={msg.id || `a-${i}`}>{assistantBody(msg, i)}</div>
          ))}

          {loading && showBoardroomViz && (
            <div
              style={{
                padding: '10px 20px',
                borderTop: '1px solid rgba(10,10,10,0.08)',
                background: 'rgba(232,93,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#E85D00',
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
                        background: 'rgba(10,10,10,0.08)',
                        color: 'var(--ink-muted, #737373)',
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
                  background: 'rgba(10,10,10,0.04)',
                  borderRadius: 8,
                  border: '1px solid rgba(10,10,10,0.08)',
                }}
              >
                <p style={{ fontSize: 13, color: 'var(--ink-secondary, #525252)', margin: 0 }}>
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
                      background: 'rgba(232,93,0,0.1)',
                      border: '1px solid rgba(232,93,0,0.2)',
                      color: '#E85D00',
                    }}
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
          )}

          {loading && !showBoardroomViz && (
            <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(10,10,10,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: 'linear-gradient(135deg, #E85D00, #E56A08)',
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
                <span style={{ fontSize: 12, color: 'var(--ink-muted, #737373)', fontWeight: 500 }}>
                  BIQc <span style={{ color: '#E85D00', marginLeft: 8 }}>thinking...</span>
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink, #171717)' }}>BIQc is thinking...</p>
            </div>
          )}
        </div>

        <div className="px-3 pb-3 pt-2 shrink-0" style={{ borderTop: '1px solid var(--biqc-border)' }}>
        {/* Attachment preview */}
        {attachedFile && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--biqc-bg-card)', border: '1px solid rgba(232,93,0,0.3)' }}>
            <FileText className="w-3 h-3 shrink-0" style={{ color: '#E85D00' }} />
            <span className="flex-1 text-[10px] truncate" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.mono }}>{attachedFile.name}</span>
            {attachedFile.type === 'text' && <span className="text-[9px]" style={{ color: '#10B981', fontFamily: fontFamily.mono }}>ready</span>}
            <button onClick={() => setAttachedFile(null)} className="p-0.5 rounded" style={{ color: 'var(--ink-muted)' }}>
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
                color: 'var(--info, #2563EB)',
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
              style={{ background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.35)', color: 'var(--ink-secondary, #525252)', fontFamily: fontFamily.mono }}
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
                  style={{ background: 'rgba(232,93,0,0.1)', border: '1px solid rgba(232,93,0,0.2)', color: '#E85D00', fontFamily: fontFamily.mono }}
                  data-testid="soundboard-panel-mode-selector"
                >
                  <span>{activeMode?.icon}</span>
                  <span>{activeMode?.label}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {showModeMenu && (
                  <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl overflow-hidden shadow-xl z-50"
                    style={{ background: 'var(--surface, #FFFFFF)', border: '1px solid #1E2D3D' }}>
                    {availableModes.map((mode, idx) => (
                      <button
                        key={mode.id}
                        onClick={() => { setSelectedMode(mode.id); setShowModeMenu(false); }}
                        className="w-full flex items-start gap-2 px-3 py-2 text-left transition-all hover:bg-black/5"
                        style={{ borderBottom: idx < availableModes.length - 1 ? '1px solid #1E2D3D' : 'none' }}
                        data-testid={`soundboard-panel-mode-option-${mode.id}`}
                      >
                        <span className="text-sm shrink-0">{mode.icon}</span>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: selectedMode === mode.id ? '#E85D00' : 'var(--ink-display, #0A0A0A)', fontFamily: fontFamily.body }}>{mode.label}</p>
                          <p className="text-[10px]" style={{ color: 'var(--ink-muted)', fontFamily: fontFamily.body }}>{mode.desc}</p>
                        </div>
                      </button>
                    ))}

                    {!canUseTrinity && (
                      <a href="/subscribe?section=foundation" className="block px-3 py-2 text-[10px] no-underline"
                        style={{ color: 'var(--ink-muted)', fontFamily: fontFamily.body }} data-testid="soundboard-panel-trinity-upgrade-link">
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
                    style={{ background: 'var(--surface, #FFFFFF)', border: '1px solid #1E2D3D' }}>
                    <p className="px-3 py-1.5 text-[9px] uppercase tracking-wider" style={{ color: 'var(--ink-muted)', fontFamily: fontFamily.mono }}>Agent persona</p>
                    {BIQC_AGENTS.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => { setSelectedAgent(agent.id); setShowAgentMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left transition-all hover:bg-black/5"
                        style={{ borderTop: '1px solid #1E2D3D' }}
                        data-testid={`soundboard-panel-agent-option-${agent.id}`}
                      >
                        <span className="text-sm shrink-0">{agent.icon}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: selectedAgent === agent.id ? '#3B82F6' : 'var(--ink-display, #0A0A0A)', fontFamily: fontFamily.body }}>
                            {agent.label}
                          </p>
                          <p className="text-[10px] truncate" style={{ color: 'var(--ink-muted)', fontFamily: fontFamily.body }}>
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
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: 'var(--info, #2563EB)', fontFamily: fontFamily.mono }}
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

        <div
          className="rounded-2xl flex items-end gap-1 p-2"
          style={{
            background: 'rgba(10,10,10,0.05)',
            border: `1px solid ${attachedFile ? 'rgba(232,93,0,0.4)' : 'rgba(10,10,10,0.1)'}`,
          }}
        >
          <input type="file" ref={fileRef} className="hidden" onChange={handleFileSelect} accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.png,.jpg,.md,.json,.py,.js" />
          <button
            onClick={() => fileRef.current?.click()}
            className="p-2 rounded-xl hover:bg-black/5 transition-colors shrink-0"
            data-testid="sb-upload"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4" style={{ color: attachedFile ? '#E85D00' : '#64748B' }} />
          </button>
          <button
            className="p-2 rounded-xl hover:bg-black/5 transition-colors shrink-0"
            data-testid="sb-video"
            onClick={() => setShowVoiceChat(true)}>
            <Video className="w-4 h-4 text-[var(--ink-muted)]" />
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
            onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`; }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!loading) sendMessage(); } }}
            placeholder={attachedFile ? `Ask about ${attachedFile.name}...` : "Ask anything..."}
            rows={1}
            className="flex-1 px-2 py-2 text-sm outline-none resize-none bg-transparent"
            style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.body, maxHeight: '160px', minHeight: '24px' }}
            data-testid="sb-input"
          />
          <button
            onClick={sendMessage}
            disabled={(!input.trim() && !attachedFile) || loading}
            className="p-2 rounded-xl shrink-0 transition-all disabled:opacity-20"
            style={{ background: (input.trim() || attachedFile) ? '#E85D00' : 'rgba(10,10,10,0.1)', width: 32, height: 32 }}
            data-testid="sb-send"
          >
            {loading ? (
              <div style={{ width: 12, height: 12, border: '2px solid rgba(10,10,10,0.5)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
        <p className="text-[9px] text-center mt-1.5" style={{ fontFamily: fontFamily.mono, color: 'var(--ink-subtle, #A3A3A3)' }}>
          <span style={{ padding: '1px 5px', background: 'rgba(10,10,10,0.06)', border: '1px solid rgba(10,10,10,0.08)', borderRadius: 3, marginRight: 2 }}>{'\u21B5'}</span> Send {'\u00B7'} <span style={{ padding: '1px 5px', background: 'rgba(10,10,10,0.06)', border: '1px solid rgba(10,10,10,0.08)', borderRadius: 3, marginRight: 2, marginLeft: 2 }}>{'\u21E7\u21B5'}</span> New line {'\u00B7'} BIQc uses connected data only
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
    </DashboardLayout>
  );
};

export default SoundboardPanel;
