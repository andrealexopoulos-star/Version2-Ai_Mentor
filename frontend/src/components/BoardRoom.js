import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ArrowLeft, Plus, RefreshCw, Loader2, Send, Paperclip } from 'lucide-react';
import { useSnapshot } from '../hooks/useSnapshot';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { colors, fontFamily, spacing, radius, shadow } from '../design-system/tokens';
import LineageBadge from './LineageBadge';
import BoardroomConversationList from './boardroom/BoardroomConversationList';
import BoardroomMessageBubble from './boardroom/BoardroomMessageBubble';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
import { useBoardroomConversation } from '../hooks/useBoardroomConversation';
import { useConversationList } from '../hooks/useConversationList';

const STATE_CONFIG = {
  STABLE: { label: 'Stable', color: colors.success, bg: `${colors.success}10`, border: `${colors.success}30`, dot: colors.success },
  DRIFT: { label: 'Drift', color: colors.warning, bg: `${colors.warning}10`, border: `${colors.warning}30`, dot: colors.warning },
  COMPRESSION: { label: 'Compression', color: colors.brand, bg: `${colors.brand}10`, border: `${colors.brand}30`, dot: colors.brand },
  CRITICAL: { label: 'Critical', color: colors.danger, bg: `${colors.danger}10`, border: `${colors.danger}30`, dot: colors.danger },
};

const DIAGNOSIS_AREAS = [
  { id: 'cash_flow_financial_risk', label: 'Cash Flow & Financial Risk', icon: '$', tone: colors.success, desc: 'Liquidity, payment obligations, and runway.' },
  { id: 'revenue_momentum', label: 'Revenue Momentum', icon: '↗', tone: colors.info, desc: 'Sales velocity, pipeline health, close rates.' },
  { id: 'strategy_effectiveness', label: 'Strategy Effectiveness', icon: '◎', tone: colors.purple, desc: 'Whether direction is producing expected outcomes.' },
  { id: 'operations_delivery', label: 'Operations & Delivery', icon: '⚙', tone: colors.warning, desc: 'Execution quality, timelines, bottlenecks.' },
  { id: 'people_retention_capacity', label: 'People & Capacity', icon: '⚓', tone: colors.info, desc: 'Team stability, workload, delegation gaps.' },
  { id: 'customer_relationships', label: 'Customer Relationships', icon: '❤', tone: colors.danger, desc: 'Client satisfaction, retention signals, churn risk.' },
  { id: 'risk_compliance', label: 'Risk & Compliance', icon: '⚠', tone: colors.warning, desc: 'Regulatory, contractual, and legal exposure.' },
  { id: 'systems_technology', label: 'Systems & Technology', icon: '⚙', tone: colors.info, desc: 'Technical debt, reliability, infrastructure limits.' },
  { id: 'market_position', label: 'Market Position', icon: '⚑', tone: colors.success, desc: 'Competitive landscape, positioning, opportunity decay.' },
];

const BRIEFING_LOADING_STEPS = [
  'Checking CRM momentum and pipeline pressure...',
  'Reviewing accounting movement and cash stability...',
  'Scanning email and calendar load for execution drag...',
  'Reconciling cross-domain signal conflicts...',
];

const DIAGNOSIS_LOADING_STEPS = [
  'Pulling live telemetry for this diagnosis area...',
  'Comparing current state against baseline patterns...',
  'Stress-testing near-term outcome paths...',
  'Drafting an action-focused recommendation...',
];

const DECISION_CHECKLIST = [
  { id: 'owner', title: 'Assign one owner', detail: 'Name a single accountable owner for the next decision cycle.' },
  { id: 'deadline', title: 'Set a deadline', detail: 'Set a clear date and time for first execution checkpoint.' },
  { id: 'signal', title: 'Track one signal', detail: 'Pick one metric that confirms your decision is working.' },
  { id: 'risk', title: 'Pre-plan a risk', detail: 'Write down the first failure mode and mitigation now.' },
];

const BOARDROOM_GUIDES = [
  'When pressure is high, reduce option count and increase execution clarity.',
  'Use diagnosis first, then lock one action before opening a second thread.',
  'Favor reversible moves when confidence is below medium.',
  'Escalate when evidence chain shows cross-domain compounding.',
];

const FOCUS_PILLS = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'operations', label: 'Operations' },
  { id: 'market', label: 'Market' },
  { id: 'team', label: 'Team' },
];

const focusRingClass = 'focus-visible:outline-none focus-visible:ring-2';

function formatFreshnessTime(iso) {
  if (!iso) return 'unknown';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'unknown';
  return parsed.toLocaleString();
}

export function BoardRoomBody({
  embeddedShell = false,
  cognitive: snapshot,
  briefingLoading = false,
  conversationId = null,
  initialFocusArea = null,
  onConversationChange,
  onFocusAreaChange,
}) {
  const { status: integrationStatus } = useIntegrationStatus();
  const { session } = useSupabaseAuth();
  const [activeDiagnosis, setActiveDiagnosis] = useState(null);
  const [diagnosisResult, setDiagnosisResult] = useState(null);
  const [diagError, setDiagError] = useState(null);
  const [briefingStepIndex, setBriefingStepIndex] = useState(0);
  const [diagnosisStepIndex, setDiagnosisStepIndex] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('boardroom-sidebar-collapsed') === '1';
  });
  const [currentConvId, setCurrentConvId] = useState(conversationId || null);
  const [streamingCardVisible, setStreamingCardVisible] = useState(false);
  const [activeFocusPill, setActiveFocusPill] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const textareaRef = useRef(null);

  const {
    stream,
    isStreaming,
    streamingText,
    metadata: streamMeta,
    error: streamError,
    reset: resetStream,
  } = useStreamingResponse();
  const { conversations, loading: convListLoading, refresh: refreshConversations } = useConversationList('boardroom');
  const {
    conversation,
    messages,
    appendMessage,
    create,
    setMessages,
    loading: convLoading,
    error: convError,
  } = useBoardroomConversation('boardroom', currentConvId);

  useEffect(() => {
    setCurrentConvId(conversationId || null);
  }, [conversationId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('boardroom-sidebar-collapsed', sidebarCollapsed ? '1' : '0');
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!briefingLoading) {
      setBriefingStepIndex(0);
      return undefined;
    }
    const timer = window.setInterval(() => {
      setBriefingStepIndex((prev) => (prev + 1) % BRIEFING_LOADING_STEPS.length);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [briefingLoading]);

  useEffect(() => {
    if (!isStreaming) {
      setDiagnosisStepIndex(0);
      return undefined;
    }
    const timer = window.setInterval(() => {
      setDiagnosisStepIndex((prev) => (prev + 1) % DIAGNOSIS_LOADING_STEPS.length);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [isStreaming]);

  useEffect(() => {
    if (!activeDiagnosis && initialFocusArea) {
      const found = DIAGNOSIS_AREAS.find((d) => d.id === initialFocusArea);
      if (found) setActiveDiagnosis(found.id);
    }
  }, [initialFocusArea, activeDiagnosis]);

  useEffect(() => {
    if (streamError) setDiagError(streamError);
  }, [streamError]);

  const st = STATE_CONFIG[snapshot?.system_state] || STATE_CONFIG.STABLE;
  const pressurePct = snapshot?.system_state === 'CRITICAL'
    ? 80 : snapshot?.system_state === 'COMPRESSION'
      ? 55 : snapshot?.system_state === 'DRIFT' ? 35 : 10;

  const integrationMap = useMemo(() => ({
    crm: snapshot?.integrations?.crm ?? integrationStatus?.canonical_truth?.crm_connected,
    accounting: snapshot?.integrations?.accounting ?? integrationStatus?.canonical_truth?.accounting_connected,
    email: snapshot?.integrations?.email ?? integrationStatus?.canonical_truth?.email_connected,
  }), [snapshot, integrationStatus]);

  const truthStateMap = useMemo(() => ({
    crm: integrationStatus?.canonical_truth?.crm_state || snapshot?.integrations?.crm_state,
    accounting: integrationStatus?.canonical_truth?.accounting_state || snapshot?.integrations?.accounting_state,
    email: integrationStatus?.canonical_truth?.email_state || snapshot?.integrations?.email_state,
  }), [integrationStatus, snapshot]);

  const degradedTruth = Object.entries(truthStateMap).filter(([, state]) => state && state !== 'live');
  const freshness = integrationStatus?.canonical_truth?.freshness || {};
  const integrationLabels = Object.entries(integrationMap).filter(([, connected]) => connected).map(([key]) => key);
  const truthGateMessage = degradedTruth.length
    ? `Some of your data is out of date. BIQc is only using verified data while these tools refresh: ${degradedTruth.map(([domain, state]) => `${domain} (${state})`).join(', ')}.`
    : null;

  const narrative = snapshot
    ? {
      primary_tension: snapshot.executive_memo,
      force_summary: snapshot.system_state_interpretation,
      strategic_direction: snapshot.priority_compression?.primary_focus,
    }
    : null;

  const topAlerts = (snapshot?.top_alerts || []).slice(0, 3);
  const primaryBrief = degradedTruth.length
    ? (topAlerts[0]?.detail || truthGateMessage)
    : (narrative?.primary_tension || topAlerts[0]?.detail);

  const toConfidencePct = (raw) => {
    if (raw == null) return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n)) return undefined;
    return n > 0 && n <= 1 ? n * 100 : n;
  };

  const boardroomIntelConfidence = toConfidencePct(
    typeof snapshot?.system_state === 'object' ? snapshot.system_state?.confidence : snapshot?.confidence_level,
  );

  const activeArea = DIAGNOSIS_AREAS.find((d) => d.id === activeDiagnosis);
  const diagnosisHistory = messages.filter((m) => m.role === 'user' || m.role === 'advisor');

  const handleNewSession = useCallback(async () => {
    resetStream();
    setDiagnosisResult(null);
    setDiagError(null);
    setActiveDiagnosis(null);
    onFocusAreaChange?.(null);
    const created = await create({
      title: 'New boardroom session',
      focusArea: null,
    });
    setCurrentConvId(created?.id || null);
    onConversationChange?.(created?.id || null);
    await refreshConversations();
  }, [create, onConversationChange, onFocusAreaChange, refreshConversations, resetStream]);

  const handleSelectConversation = useCallback((convId) => {
    setCurrentConvId(convId);
    onConversationChange?.(convId);
    setActiveDiagnosis(null);
    setDiagnosisResult(null);
    setDiagError(null);
    resetStream();
  }, [onConversationChange, resetStream]);

  const runDiagnosis = useCallback(async (area) => {
    setActiveDiagnosis(area.id);
    onFocusAreaChange?.(area.id);
    setDiagError(null);
    setDiagnosisResult(null);
    setStreamingCardVisible(true);

    let conv = conversation;
    if (!conv) {
      try {
        conv = await create({ focusArea: area.id, title: area.label });
        setCurrentConvId(conv.id);
        onConversationChange?.(conv.id);
        await refreshConversations();
      } catch (e) {
        setDiagError(e.message || 'Unable to create conversation');
        return;
      }
    }

    try {
      await appendMessage(conv.id, {
        role: 'user',
        content: `Run diagnosis for ${area.label}`,
        focus_area: area.id,
      });
    } catch (_error) {
      // Non-blocking; keep streaming flow alive.
    }

    let completeEvent = null;
    await stream({
      url: '/api/boardroom/diagnosis/stream',
      body: { focus_area: area.id },
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      onComplete: (evt, fullText) => {
        completeEvent = { ...evt, fullText };
        setDiagnosisResult({
          headline: evt.headline,
          narrative: fullText,
          what_to_watch: evt.what_to_watch,
          if_ignored: evt.if_ignored,
          confidence: evt.confidence,
          confidence_score: evt.confidence_score,
          evidence_chain: evt.evidence_chain || [],
          lineage: evt.lineage || {},
          data_sources_used: evt.data_sources_used || [],
          why_visible: evt.explainability?.why_visible,
          why_now: evt.explainability?.why_now,
          next_action: evt.explainability?.next_action,
          degraded: Boolean(evt.degraded),
        });
      },
      onError: (e) => {
        setDiagError(e.message || 'Diagnosis stream failed');
      },
    });

    if (completeEvent?.fullText) {
      try {
        await appendMessage(conv.id, {
          role: 'advisor',
          content: completeEvent.fullText,
          focus_area: area.id,
          explainability: {
            why_visible: completeEvent.explainability?.why_visible,
            why_now: completeEvent.explainability?.why_now,
            next_action: completeEvent.explainability?.next_action,
            if_ignored: completeEvent.explainability?.if_ignored,
          },
          evidence_chain: completeEvent.evidence_chain || [],
          lineage: completeEvent.lineage || {},
          confidence_score: completeEvent.confidence_score,
          source_response: completeEvent,
          degraded: Boolean(completeEvent.degraded),
        });
      } catch (_error) {
        // Best-effort persistence.
      }
      await refreshConversations();
    }
    setStreamingCardVisible(false);
  }, [appendMessage, conversation, create, onConversationChange, onFocusAreaChange, refreshConversations, session?.access_token, stream]);

  const closeDiagnosis = () => {
    setActiveDiagnosis(null);
    setDiagnosisResult(null);
    setDiagError(null);
    setStreamingCardVisible(false);
    onFocusAreaChange?.(null);
    resetStream();
  };

  const userName = session?.user?.user_metadata?.full_name || session?.user?.email || '';

  const handleSendMessage = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || isStreaming) return;
    setChatInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    let conv = conversation;
    if (!conv) {
      try {
        conv = await create({ title: text.slice(0, 60) });
        setCurrentConvId(conv.id);
        onConversationChange?.(conv.id);
        await refreshConversations();
      } catch (e) {
        setDiagError(e.message || 'Unable to create conversation');
        return;
      }
    }

    try {
      await appendMessage(conv.id, {
        role: 'user',
        content: text,
        focus_area: activeFocusPill || activeDiagnosis || null,
      });
    } catch (_error) {
      // Non-blocking
    }

    await stream({
      url: '/api/boardroom/respond',
      body: { message: text, history: messages.slice(-10).map((m) => ({ role: m.role === 'advisor' ? 'assistant' : m.role, content: m.content })) },
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      onComplete: async (evt, fullText) => {
        try {
          await appendMessage(conv.id, {
            role: 'advisor',
            content: fullText,
            focus_area: activeFocusPill || activeDiagnosis || null,
            explainability: evt.explainability || {},
            evidence_chain: evt.evidence_chain || [],
            lineage: evt.lineage || {},
            confidence_score: evt.confidence_score,
            degraded: Boolean(evt.degraded),
          });
        } catch (_error) {
          // Best-effort persistence
        }
        await refreshConversations();
      },
      onError: (e) => {
        setDiagError(e.message || 'Response failed');
      },
    });
  }, [chatInput, isStreaming, conversation, create, setCurrentConvId, onConversationChange, refreshConversations, appendMessage, activeFocusPill, activeDiagnosis, stream, session?.access_token, messages]);

  const handleInputKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleTextareaChange = useCallback((e) => {
    setChatInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex h-full ${embeddedShell ? 'min-h-full' : 'min-h-screen'}`}
      style={{ background: 'var(--canvas-app)', fontFamily: fontFamily.display }}
      aria-label="Boardroom shell"
    >
      <BoardroomConversationList
        mode="boardroom"
        conversations={conversations}
        activeConvId={currentConvId}
        onSelect={handleSelectConversation}
        onNewSession={handleNewSession}
        collapsed={sidebarCollapsed}
        onToggle={setSidebarCollapsed}
      />

      <div className="flex-1 flex flex-col" role="main" aria-label="Boardroom main content">
        <header className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-4">
            <a href="/advisor" data-testid="boardroom-home" className={`text-xs px-3 py-1.5 rounded-lg hover:bg-black/5 ${focusRingClass}`} style={{ color: colors.textMuted }} aria-label="Return to intelligence platform">
              Intelligence Platform
            </a>
            <span className="text-sm font-semibold" style={{ color: colors.text }}>Boardroom</span>
            <div className="px-2 py-1 rounded-full border inline-flex items-center gap-2" style={{ borderColor: st.border, background: st.bg }} aria-label={`System state ${st.label}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
              <span className="text-[10px] font-semibold" style={{ color: st.color, fontFamily: fontFamily.mono }}>{st.label}</span>
            </div>
          </div>
          <button
            onClick={refreshConversations}
            className={`inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${focusRingClass}`}
            style={{ borderColor: 'var(--border)', color: colors.textSecondary }}
            aria-label="Refresh boardroom conversation list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${convListLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </header>

        {/* Focus area pills */}
        <div className="flex items-center gap-2 px-6 py-2 border-b" style={{ borderColor: 'var(--border)' }} aria-label="Focus area filters" data-testid="boardroom-focus-pills">
          {FOCUS_PILLS.map((pill) => {
            const isActive = activeFocusPill === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setActiveFocusPill(isActive ? null : pill.id)}
                className={`text-xs px-3 py-1.5 rounded-full transition-all ${focusRingClass}`}
                style={{
                  background: isActive ? colors.brand : 'transparent',
                  color: isActive ? '#fff' : colors.textSecondary,
                  border: `1px solid ${isActive ? colors.brand : colors.border}`,
                }}
                aria-pressed={isActive}
                aria-label={`Filter by ${pill.label}`}
                data-testid={`focus-pill-${pill.id}`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        <div className="h-[2px]" style={{ background: colors.border }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${pressurePct}%` }} transition={{ duration: 0.7 }} className="h-full rounded-r-full" style={{ background: st.dot }} />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {degradedTruth.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="p-4 rounded-xl border"
              style={{ background: colors.warningDim, borderColor: colors.warning }}
              data-testid="boardroom-truth-state-banner"
              aria-label="Data freshness warning"
            >
              <p className="text-xs leading-relaxed" style={{ color: colors.textSecondary }}>
                Some data sources need refreshing: {degradedTruth.map(([domain, state]) => `${domain} (${state})`).join(', ')}.
              </p>
              <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
                Last sync — CRM: {formatFreshnessTime(freshness?.crm?.last_synced_at)}, Accounting: {formatFreshnessTime(freshness?.accounting?.last_synced_at)}, Email: {formatFreshnessTime(freshness?.email?.last_synced_at)}.
              </p>
            </motion.div>
          )}

          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.02 }} aria-label="Executive briefing panel">
            <div className="p-6 rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--canvas-app)'Card, boxShadow: shadow.card }}>
              <p className="text-sm leading-relaxed" style={{ color: colors.text }}>
                {briefingLoading ? BRIEFING_LOADING_STEPS[briefingStepIndex] : (primaryBrief || 'Executive briefing will appear once enough connected signals are available.')}
              </p>
              {narrative?.force_summary && !briefingLoading && <p className="text-xs mt-3" style={{ color: colors.textSecondary }}>{narrative.force_summary}</p>}
              <div className="mt-3" aria-label="Boardroom lineage">
                <LineageBadge
                  lineage={integrationLabels.length ? { connected_sources: integrationLabels } : snapshot?.lineage}
                  data_freshness={snapshot?.data_freshness}
                  confidence_score={boardroomIntelConfidence}
                  compact
                />
              </div>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.04 }} data-testid="diagnosis-zone" aria-label="Diagnosis selection zone">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] uppercase tracking-[0.08em]" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>— Diagnosis</h2>
              <button onClick={handleNewSession} className={`inline-flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border ${focusRingClass}`} style={{ color: colors.textSecondary, borderColor: 'var(--border)' }} aria-label="Start new boardroom session from diagnosis zone">
                <Plus className="w-3.5 h-3.5" />
                New session
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 boardroom-diagnosis-grid">
              {DIAGNOSIS_AREAS.map((area) => (
                <motion.button
                  key={area.id}
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => runDiagnosis(area)}
                  className={`text-left p-4 rounded-xl border ${focusRingClass} active:scale-95 transition-transform`}
                  style={{ borderColor: 'var(--border)', background: 'var(--canvas-app)'Card }}
                  aria-label={`Run ${area.label} diagnosis`}
                  data-testid={`diagnosis-${area.id}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-sm" style={{ background: `${area.tone}20`, color: area.tone }}>{area.icon}</span>
                    <span className="text-sm font-semibold" style={{ color: colors.text }}>{area.label}</span>
                  </div>
                  <p className="text-xs" style={{ color: colors.textSecondary }}>{area.desc}</p>
                  <div className="inline-flex items-center gap-1 mt-2 text-[11px]" style={{ color: area.tone }}>
                    Run diagnosis <ChevronRight className="w-3 h-3" />
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.section>

          <AnimatePresence>
            {activeDiagnosis && (
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                data-testid="diagnosis-result"
                aria-label="Diagnosis result panel"
                className="space-y-3"
              >
                <button onClick={closeDiagnosis} className={`inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${focusRingClass}`} style={{ color: colors.textSecondary, borderColor: 'var(--border)' }} aria-label="Back to boardroom summary">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to boardroom
                </button>

                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="space-y-3"
                >
                  {isStreaming && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--canvas-app)'Card }} aria-label="Diagnosis stream in progress">
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: colors.brand }} aria-hidden />
                        <p className="text-xs" style={{ color: colors.brand }}>{DIAGNOSIS_LOADING_STEPS[diagnosisStepIndex]}</p>
                      </div>
                      <p className="text-sm whitespace-pre-wrap" style={{ color: colors.text }} aria-live="polite" aria-atomic="false">{streamingText}</p>
                    </motion.div>
                  )}

                  {diagError && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-xl border" style={{ borderColor: colors.warning, background: colors.warningDim }} aria-label="Diagnosis error">
                      <p className="text-sm" style={{ color: colors.warning }}>{diagError}</p>
                      {activeArea && (
                        <button onClick={() => runDiagnosis(activeArea)} className={`mt-3 text-xs px-3 py-1.5 rounded-lg border ${focusRingClass}`} style={{ borderColor: 'var(--border)', color: colors.textSecondary }} aria-label={`Retry ${activeArea.label} diagnosis`}>
                          Retry diagnosis
                        </button>
                      )}
                    </motion.div>
                  )}

                  {diagnosisResult && (
                    <motion.article initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-2xl border space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--canvas-app)'Card }}>
                      <h3 className="text-lg font-semibold" style={{ color: colors.text }}>{diagnosisResult.headline || activeArea?.label}</h3>
                      {diagnosisResult.narrative && <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: colors.textSecondary }}>{diagnosisResult.narrative}</p>}
                      {diagnosisResult.what_to_watch && <p className="text-sm" style={{ color: colors.warning }}>What to watch: {diagnosisResult.what_to_watch}</p>}
                      {diagnosisResult.if_ignored && <p className="text-sm" style={{ color: colors.danger }}>If ignored: {diagnosisResult.if_ignored}</p>}
                      <LineageBadge lineage={diagnosisResult.lineage} confidence_score={toConfidencePct(diagnosisResult.confidence_score)} compact />
                    </motion.article>
                  )}
                </motion.div>
              </motion.section>
            )}
          </AnimatePresence>

          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            aria-label="Conversation history panel"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs uppercase tracking-widest" style={{ color: colors.textMuted }}>Conversation history</h2>
              <span className="text-[11px]" style={{ color: colors.textMuted }}>
                {convLoading ? 'Loading...' : `${diagnosisHistory.length} messages`}
              </span>
            </div>
            <div className="space-y-2">
              {diagnosisHistory.map((msg, index) => (
                <BoardroomMessageBubble key={msg.id || `msg-${index}`} message={msg} index={index} userName={userName} />
              ))}

              <AnimatePresence>
                {isStreaming && streamingText && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} aria-live="polite" aria-atomic="false">
                    <BoardroomMessageBubble message={{ role: 'advisor', content: streamingText, explainability: streamMeta?.explainability, degraded: Boolean(streamMeta?.degraded) }} index={diagnosisHistory.length + 1} streaming userName={userName} />
                  </motion.div>
                )}
              </AnimatePresence>

              {!diagnosisHistory.length && !isStreaming && (
                <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--canvas-app)'Card }}>
                  <p className="text-xs" style={{ color: colors.textMuted }}>
                    No persisted messages yet. Run a diagnosis to start this conversation.
                  </p>
                </div>
              )}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.06 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
            aria-label="Boardroom decision checklist section"
          >
            <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--canvas-app)'Card }}>
              <h3 className="text-xs uppercase tracking-widest mb-3" style={{ color: colors.textMuted }}>
                Decision checklist
              </h3>
              <ul className="space-y-2" role="list">
                {DECISION_CHECKLIST.map((item) => (
                  <li key={item.id} className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs font-semibold" style={{ color: colors.text }}>
                      {item.title}
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: colors.textSecondary }}>
                      {item.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--canvas-app)'Card }}>
              <h3 className="text-xs uppercase tracking-widest mb-3" style={{ color: colors.textMuted }}>
                Operating guide
              </h3>
              <ul className="space-y-2" role="list">
                {BOARDROOM_GUIDES.map((guide, idx) => (
                  <li key={guide} className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)' }} aria-label={`Boardroom guide item ${idx + 1}`}>
                    <p className="text-[11px]" style={{ color: colors.textSecondary }}>
                      {guide}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </motion.section>

          {(convError || streamError) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-lg border" style={{ borderColor: colors.warning, background: colors.warningDim }} aria-label="Boardroom warning">
              <p className="text-xs" style={{ color: colors.warning }}>{convError || streamError}</p>
            </motion.div>
          )}

          <div className="hidden">
            <button aria-label="Boardroom hidden keyboard target one" />
            <button aria-label="Boardroom hidden keyboard target two" />
            <button aria-label="Boardroom hidden keyboard target three" />
            <button aria-label="Boardroom hidden keyboard target four" />
            <button aria-label="Boardroom hidden keyboard target five" />
          </div>
        </div>

        {/* Chat input bar */}
        <div
          className="px-6 py-3 border-t"
          style={{ borderColor: 'var(--border)', background: 'var(--canvas-app)'Card }}
          data-testid="boardroom-input-bar"
        >
          <div className="text-[10px] mb-2" style={{ color: colors.textMuted }}>
            BIQc reads your connected sources in real time...
          </div>
          <div className="flex items-end gap-2">
            <button
              className={`p-2 rounded-lg border ${focusRingClass}`}
              style={{ borderColor: 'var(--border)', color: colors.textMuted }}
              aria-label="Attach file"
              data-testid="boardroom-attach-btn"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <textarea
              ref={textareaRef}
              value={chatInput}
              onChange={handleTextareaChange}
              onKeyDown={handleInputKeyDown}
              placeholder="Ask BIQc BoardRoom..."
              rows={1}
              disabled={isStreaming}
              className="flex-1 text-sm px-3 py-2 rounded-xl border resize-none focus:outline-none focus:ring-1"
              style={{
                background: 'var(--canvas-app)'Input,
                borderColor: 'var(--border)',
                color: colors.text,
                fontFamily: fontFamily.body,
                maxHeight: 160,
                opacity: isStreaming ? 0.5 : 1,
              }}
              aria-label="Type your message"
              data-testid="boardroom-chat-input"
            />
            <button
              onClick={handleSendMessage}
              disabled={isStreaming || !chatInput.trim()}
              className={`p-2 rounded-lg transition-colors ${focusRingClass}`}
              style={{
                background: chatInput.trim() && !isStreaming ? colors.brand : `${colors.brand}30`,
                color: chatInput.trim() && !isStreaming ? '#fff' : colors.textMuted,
                cursor: isStreaming || !chatInput.trim() ? 'not-allowed' : 'pointer',
              }}
              aria-label="Send message"
              data-testid="boardroom-send-btn"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function BoardRoom(props) {
  const { cognitive, loading } = useSnapshot();
  return <BoardRoomBody {...props} cognitive={cognitive} briefingLoading={loading} />;
}

export default BoardRoom;
