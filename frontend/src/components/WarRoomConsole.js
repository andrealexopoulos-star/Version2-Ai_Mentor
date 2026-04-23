import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, RefreshCw } from 'lucide-react';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { useSnapshot } from '../hooks/useSnapshot';
import { useIntegrationStatus } from '../hooks/useIntegrationStatus';
import { colors, fontFamily, radius, shadow } from '../design-system/tokens';
import LineageBadge from './LineageBadge';
import BoardroomConversationList from './boardroom/BoardroomConversationList';
import BoardroomMessageBubble from './boardroom/BoardroomMessageBubble';
import WarRoomAlertCard from './warroom/WarRoomAlertCard';
import WarRoomAlertTimeline from './warroom/WarRoomAlertTimeline';
import { useBoardroomConversation } from '../hooks/useBoardroomConversation';
import { useConversationList } from '../hooks/useConversationList';
import { useWatchtowerRealtime } from '../hooks/useWatchtowerRealtime';
import { useSearchParams } from 'react-router-dom';

const STATE_CFG = {
  STABLE: { label: 'Stable', color: colors.success, bg: `${colors.success}10`, border: `${colors.success}30`, dot: colors.success },
  DRIFT: { label: 'Drift', color: colors.warning, bg: `${colors.warning}10`, border: `${colors.warning}30`, dot: colors.warning },
  COMPRESSION: { label: 'Compression', color: colors.brand, bg: `${colors.brand}10`, border: `${colors.brand}30`, dot: colors.brand },
  CRITICAL: { label: 'Critical', color: colors.danger, bg: `${colors.danger}10`, border: `${colors.danger}30`, dot: colors.danger },
};

const focusRingClass = 'focus-visible:outline-none focus-visible:ring-2';

const STRATEGIC_PROMPTS = [
  'What decision today has the highest downside if delayed by 48 hours?',
  'Where is confidence lowest and what evidence would raise it fastest?',
  'Which customer segment is most exposed to current delivery pressure?',
  'What action can we take this week that is reversible but high-signal?',
  'Where are we over-indexing on activity instead of outcomes?',
];

const RESPONSE_RUBRIC = [
  { id: 'clarity', title: 'Clarity', detail: 'Answer identifies one explicit decision and owner.' },
  { id: 'evidence', title: 'Evidence', detail: 'Answer includes specific lineage or evidence chain.' },
  { id: 'urgency', title: 'Urgency', detail: 'Answer defines a practical decision horizon.' },
  { id: 'risk', title: 'Risk', detail: 'Answer names one major risk and mitigation plan.' },
];

const DECISION_WINDOWS = [
  { label: '24 hours', meaning: 'Contain immediate downside and assign owner.' },
  { label: '72 hours', meaning: 'Confirm trend direction and update risk posture.' },
  { label: '7 days', meaning: 'Validate impact against lead and lag indicators.' },
  { label: '30 days', meaning: 'Decide whether to scale, stop, or pivot the action.' },
];

const ESCALATION_RULES = [
  'Escalate when one domain remains red for two consecutive check-ins.',
  'Escalate when confidence drops while severity rises in parallel.',
  'Escalate when customer-impacting incidents coincide with cash pressure.',
  'Escalate when operational mitigation creates strategic tradeoff risk.',
];

const FOLLOW_UP_CHECKS = [
  'Confirm owner accepted action and deadline.',
  'Confirm telemetry source freshness before interpreting deltas.',
  'Confirm counterfactual: what if we do nothing for one cycle?',
  'Confirm communication owner for internal and external stakeholders.',
];

function formatFreshnessTime(iso) {
  if (!iso) return 'unknown';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'unknown';
  return parsed.toLocaleString();
}

export function WarRoomConsoleBody({
  embeddedShell = false,
  cognitive,
  sources,
  owner,
  timeOfDay,
  loading,
  error,
  cacheAge,
  refreshing,
  refresh,
  conversationId = null,
  onConversationChange,
}) {
  const { status: integrationStatus } = useIntegrationStatus();
  const { session, user } = useSupabaseAuth();
  const [question, setQuestion] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('warroom-sidebar-collapsed') === '1';
  });
  const [searchParams] = useSearchParams();
  const prefillQuery = searchParams.get('prefill');
  const [currentConvId, setCurrentConvId] = useState(conversationId || null);
  const [selectedDay, setSelectedDay] = useState(null);
  const scrollRef = useRef(null);

  const [warRoomStreaming, setWarRoomStreaming] = useState(false);
  const [warRoomStreamingText, setWarRoomStreamingText] = useState('');
  const [warRoomStreamMeta, setWarRoomStreamMeta] = useState({});
  const [warRoomStreamError, setWarRoomStreamError] = useState(null);
  const [warRoomThinking, setWarRoomThinking] = useState(false);
  const [warRoomThinkingLabel, setWarRoomThinkingLabel] = useState('Synthesizing...');
  const warRoomTextRef = useRef('');
  const warRoomAbortRef = useRef(null);

  const warRoomStream = useCallback(async ({ url, body, headers = {}, onComplete = null }) => {
    warRoomTextRef.current = '';
    setWarRoomStreamingText('');
    setWarRoomStreamMeta({});
    setWarRoomStreamError(null);
    setWarRoomThinking(false);
    setWarRoomThinkingLabel('Synthesizing...');
    setWarRoomStreaming(true);
    const controller = new AbortController();
    warRoomAbortRef.current = controller;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...headers,
        },
        body: JSON.stringify(body || {}),
        signal: controller.signal,
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      if (!response.body) {
        throw new Error('Response has no body');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const dataLine = raw.split('\n').find((l) => l.startsWith('data: '));
          if (!dataLine) continue;
          let evt;
          try {
            evt = JSON.parse(dataLine.slice(6));
          } catch {
            continue;
          }
          if (!evt || !evt.type) continue;
          if (evt.type === 'start') {
            setWarRoomStreamMeta((prev) => ({ ...prev, ...evt }));
          } else if (evt.type === 'thinking') {
            setWarRoomThinking(true);
            if (evt.message) setWarRoomThinkingLabel(String(evt.message));
          } else if (evt.type === 'delta') {
            setWarRoomThinking(false);
            const text = evt.text || '';
            warRoomTextRef.current += text;
            setWarRoomStreamingText(warRoomTextRef.current);
          } else if (evt.type === 'truth_gate') {
            setWarRoomThinking(false);
            setWarRoomStreamMeta((prev) => ({ ...prev, truth_gate: evt }));
          } else if (evt.type === 'complete') {
            setWarRoomThinking(false);
            setWarRoomStreamMeta((prev) => ({ ...prev, ...evt }));
            if (onComplete) onComplete(evt, warRoomTextRef.current);
          } else if (evt.type === 'error') {
            setWarRoomThinking(false);
            const msg = evt.message || 'Stream error';
            setWarRoomStreamError(msg);
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        setWarRoomStreamError(e.message || 'Stream failed');
      }
    } finally {
      setWarRoomStreaming(false);
      warRoomAbortRef.current = null;
    }
  }, []);

  const { conversations, loading: convListLoading, refresh: refreshConversations } = useConversationList('war_room');
  const { alerts, acknowledge, dismiss, loading: alertsLoading } = useWatchtowerRealtime();
  const {
    conversation,
    messages,
    appendMessage,
    create,
    error: convError,
    loading: convLoading,
  } = useBoardroomConversation('war_room', currentConvId);

  useEffect(() => {
    setCurrentConvId(conversationId || null);
  }, [conversationId]);

  useEffect(() => {
    if (prefillQuery && messages.length === 0) {
      setQuestion(`Tell me more about: ${prefillQuery}`);
    }
  }, [prefillQuery, messages.length]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('warroom-sidebar-collapsed', sidebarCollapsed ? '1' : '0');
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, warRoomStreamingText, warRoomStreaming, warRoomThinking]);

  const displayName = useMemo(() => {
    const raw = owner
      || user?.user_metadata?.full_name?.split(' ')[0]
      || user?.email?.split('@')[0]
      || 'there';
    return raw ? `${raw.charAt(0).toUpperCase()}${raw.slice(1)}` : 'there';
  }, [owner, user]);

  const displayTimeOfDay = timeOfDay || (() => {
    const h = new Date().getHours();
    return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  })();

  const c = useMemo(() => (cognitive || {}), [cognitive]);
  const st = STATE_CFG[c.system_state] || STATE_CFG.STABLE;
  const topAlerts = (c.top_alerts || []).slice(0, 3);
  const connectedSystems = Object.entries({
    crm: c.integrations?.crm ?? integrationStatus?.canonical_truth?.crm_connected,
    accounting: c.integrations?.accounting ?? integrationStatus?.canonical_truth?.accounting_connected,
    email: c.integrations?.email ?? integrationStatus?.canonical_truth?.email_connected,
  }).filter(([, connected]) => Boolean(connected)).map(([key]) => key);
  const degradedTruth = Object.entries({
    crm: c.integrations?.crm_state ?? integrationStatus?.canonical_truth?.crm_state,
    accounting: c.integrations?.accounting_state ?? integrationStatus?.canonical_truth?.accounting_state,
    email: c.integrations?.email_state ?? integrationStatus?.canonical_truth?.email_state,
  }).filter(([, state]) => state && state !== 'live');
  const freshness = integrationStatus?.canonical_truth?.freshness || {};

  const filteredAlerts = useMemo(() => {
    if (!selectedDay) return alerts;
    const sameDay = (d1, d2) => d1.getFullYear() === d2.getFullYear()
      && d1.getMonth() === d2.getMonth()
      && d1.getDate() === d2.getDate();
    return alerts.filter((a) => sameDay(new Date(a.created_at), selectedDay));
  }, [alerts, selectedDay]);

  const activeThreatLevel = useMemo(() => {
    if (filteredAlerts.some((a) => (a.severity || '').toLowerCase() === 'critical')) return 'Critical';
    if (filteredAlerts.some((a) => (a.severity || '').toLowerCase() === 'high')) return 'High';
    if (filteredAlerts.some((a) => (a.severity || '').toLowerCase() === 'warning')) return 'Warning';
    return 'Stable';
  }, [filteredAlerts]);

  const handleNewSession = useCallback(async () => {
    const created = await create({ title: 'New war room session' });
    setCurrentConvId(created?.id || null);
    onConversationChange?.(created?.id || null);
    await refreshConversations();
  }, [create, onConversationChange, refreshConversations]);

  const handleSelectConversation = useCallback((convId) => {
    setCurrentConvId(convId);
    onConversationChange?.(convId);
  }, [onConversationChange]);

  const askQuestion = useCallback(async (e) => {
    e?.preventDefault();
    if (!question.trim() || warRoomStreaming) return;
    const q = question.trim();
    setQuestion('');

    let conv = conversation;
    if (!conv) {
      try {
        conv = await create({ title: q.slice(0, 60) });
        setCurrentConvId(conv.id);
        onConversationChange?.(conv.id);
        await refreshConversations();
      } catch (_error) {
        return;
      }
    }

    try {
      await appendMessage(conv.id, { role: 'user', content: q });
    } catch (_error) {
      // Keep stream path alive.
    }

    let completeMeta = null;
    await warRoomStream({
      url: '/api/war-room/respond/stream',
      body: {
        question: q,
        product_or_service: c?.product_or_service || c?.business_model || 'General business advisory',
      },
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      onComplete: (evt, fullText) => {
        completeMeta = { ...evt, fullText };
      },
    });

    if (completeMeta?.fullText) {
      try {
        await appendMessage(conv.id, {
          role: 'advisor',
          content: completeMeta.fullText,
          explainability: completeMeta.explainability,
          evidence_chain: completeMeta.evidence_chain || [],
          lineage: completeMeta.lineage || {},
          confidence_score: completeMeta.confidence_score,
          source_response: completeMeta,
          degraded: Boolean(completeMeta.degraded),
        });
      } catch (_error) {
        // best effort
      }
      await refreshConversations();
    }
  }, [appendMessage, c, conversation, create, onConversationChange, question, refreshConversations, session?.access_token, warRoomStream, warRoomStreaming]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={`flex flex-col h-full ${embeddedShell ? 'min-h-full' : 'min-h-screen'}`} style={{ background: 'var(--canvas-app)', fontFamily: fontFamily.display }} aria-label="War room shell">
      <div className="flex flex-1 min-h-0">
        {/* Hide the embedded conversation sidebar when this console body is
            rendered inside WarRoomPage's shell \u2014 that page has its own
            alert sidebar on the left, and rendering both resulted in two
            parallel sidebars (a regression). When the body renders
            stand-alone (embeddedShell=false), keep the sidebar. */}
        {!embeddedShell && (
          <BoardroomConversationList
            mode="war_room"
            conversations={conversations}
            activeConvId={currentConvId}
            onSelect={handleSelectConversation}
            onNewSession={handleNewSession}
            collapsed={sidebarCollapsed}
            onToggle={setSidebarCollapsed}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex items-center justify-between px-6 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-4">
              <a href="/advisor" className={`text-xs px-3 py-1.5 rounded-lg hover:bg-black/5 ${focusRingClass}`} style={{ color: colors.textMuted }} data-testid="console-home-btn" aria-label="Return to intelligence platform">
                Intelligence Platform
              </a>
              <span className="text-[11px] uppercase tracking-[0.08em]" style={{ color: '#E85D00', fontFamily: fontFamily.mono }}>— War Room</span>
              <div className="px-2 py-1 rounded-full border inline-flex items-center gap-2" style={{ borderColor: st.border, background: st.bg }} aria-label={`War room state ${st.label}`}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                <span className="text-[10px] font-semibold" style={{ color: st.color, fontFamily: fontFamily.mono }}>{st.label}</span>
              </div>
            </div>
            <button onClick={refresh} disabled={refreshing || loading} className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${focusRingClass}`} style={{ color: colors.textSecondary, borderColor: 'var(--border)' }} aria-label="Refresh strategic snapshot">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {cacheAge != null && cacheAge > 0 ? `${cacheAge}m ago` : 'Refresh'}
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="p-6 rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)', boxShadow: shadow.card }} aria-label="War room briefing card">
              <h1 className="font-medium" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #0A0A0A)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }}>Strategic <em style={{ fontStyle: 'italic', color: '#E85D00' }}>console</em>.</h1>
              <p className="text-sm mt-2" style={{ color: colors.textSecondary }}>
                {c.executive_memo || (connectedSystems.length
                  ? `BIQc can see ${connectedSystems.join(', ')} signals. Ask your highest-stakes question now.`
                  : 'Connect core systems to generate a live strategic brief.')}
              </p>
              <div className="mt-3">
                <LineageBadge lineage={connectedSystems.length ? { connected_sources: connectedSystems } : c.lineage} data_freshness={c.data_freshness ?? (c.generated_at ? formatFreshnessTime(c.generated_at) : undefined)} compact />
              </div>
            </motion.section>

            {degradedTruth.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-xl border" style={{ borderColor: colors.warning, background: colors.warningDim }} aria-label="War room data freshness warning">
                <p className="text-xs" style={{ color: colors.textSecondary }}>
                  Some data sources need refreshing: {degradedTruth.map(([domain, state]) => `${domain} (${state})`).join(', ')}.
                </p>
                <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
                  Last sync — CRM: {formatFreshnessTime(freshness?.crm?.last_synced_at)}, Accounting: {formatFreshnessTime(freshness?.accounting?.last_synced_at)}, Email: {formatFreshnessTime(freshness?.email?.last_synced_at)}.
                </p>
              </motion.div>
            )}

            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.01 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-3"
              aria-label="War room strategic guidance"
            >
              <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <h3 className="text-xs uppercase tracking-widest mb-3" style={{ color: colors.textMuted }}>
                  Suggested prompts
                </h3>
                <ul className="space-y-2" role="list">
                  {STRATEGIC_PROMPTS.map((prompt, index) => (
                    <li key={prompt} className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-[11px]" style={{ color: colors.textSecondary }}>
                        {index + 1}. {prompt}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <h3 className="text-xs uppercase tracking-widest mb-3" style={{ color: colors.textMuted }}>
                  Response rubric
                </h3>
                <ul className="space-y-2" role="list">
                  {RESPONSE_RUBRIC.map((rule) => (
                    <li key={rule.id} className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)' }} aria-label={`Response rubric ${rule.title}`}>
                      <p className="text-xs font-semibold" style={{ color: colors.text }}>
                        {rule.title}
                      </p>
                      <p className="text-[11px] mt-1" style={{ color: colors.textSecondary }}>
                        {rule.detail}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.section>

            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.02 }} aria-label="War room conversation thread">
              {messages.map((msg, index) => (
                <div key={msg.id || `war-msg-${index}`} className="warroom-chat-message">
                  <BoardroomMessageBubble message={msg} index={index} />
                </div>
              ))}

              <AnimatePresence>
                {warRoomStreaming && warRoomThinking && !warRoomStreamingText && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} aria-live="polite" className="warroom-chat-message">
                    <p className="text-sm" style={{ color: colors.textMuted }} aria-label="War room synthesizing">
                      {warRoomThinkingLabel}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {warRoomStreaming && warRoomStreamingText && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} aria-live="polite" aria-atomic="false" className="warroom-chat-message">
                    <BoardroomMessageBubble message={{ role: 'advisor', content: warRoomStreamingText, explainability: warRoomStreamMeta.explainability, evidence_chain: warRoomStreamMeta.evidence_chain || [] }} index={messages.length + 1} streaming />
                  </motion.div>
                )}
              </AnimatePresence>

              {loading && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm" style={{ color: colors.textMuted }} aria-label="Loading strategic context">
                  Loading strategic context...
                </motion.p>
              )}

              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm" style={{ color: colors.warning }} aria-label="Strategic context error">
                  {error}
                </motion.p>
              )}

              {(convError || warRoomStreamError) && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm" style={{ color: colors.warning }} aria-label="War room stream warning">
                  {convError || warRoomStreamError}
                </motion.p>
              )}
              <div ref={scrollRef} />
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.025 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-3"
              aria-label="War room decision timing section"
            >
              <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <h3 className="text-xs uppercase tracking-widest mb-3" style={{ color: colors.textMuted }}>
                  Decision windows
                </h3>
                <ul className="space-y-2" role="list">
                  {DECISION_WINDOWS.map((window) => (
                    <li key={window.label} className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)' }} aria-label={`Decision window ${window.label}`}>
                      <p className="text-xs font-semibold" style={{ color: colors.text }}>
                        {window.label}
                      </p>
                      <p className="text-[11px] mt-1" style={{ color: colors.textSecondary }}>
                        {window.meaning}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <h3 className="text-xs uppercase tracking-widest mb-3" style={{ color: colors.textMuted }}>
                  Escalation rules
                </h3>
                <ul className="space-y-2" role="list">
                  {ESCALATION_RULES.map((rule, idx) => (
                    <li key={rule} className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)' }} aria-label={`Escalation rule ${idx + 1}`}>
                      <p className="text-[11px]" style={{ color: colors.textSecondary }}>
                        {idx + 1}. {rule}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.026 }}
              className="p-4 rounded-xl border"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              aria-label="War room follow-up checklist section"
            >
              <h3 className="text-xs uppercase tracking-widest mb-3" style={{ color: colors.textMuted }}>
                Follow-up checks
              </h3>
              <ul className="space-y-2" role="list">
                {FOLLOW_UP_CHECKS.map((check, idx) => (
                  <li key={check} className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)' }} aria-label={`Follow-up check ${idx + 1}`}>
                    <p className="text-[11px]" style={{ color: colors.textSecondary }}>
                      {idx + 1}. {check}
                    </p>
                  </li>
                ))}
              </ul>
            </motion.section>
          </div>

          <div className="shrink-0 px-6 py-4 border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <form onSubmit={askQuestion} className="w-full" aria-label="War room question form">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about your business..."
                  disabled={warRoomStreaming}
                  className="flex-1 text-sm outline-none bg-transparent"
                  style={{ color: colors.text, fontFamily: fontFamily.display, fontSize: '16px' }}
                  data-testid="ask-input"
                  aria-label="War room question input"
                />
                <button type="submit" disabled={warRoomStreaming || !question.trim()} className={`p-2 rounded-lg transition-colors ${focusRingClass}`} style={{ color: question.trim() ? colors.brand : colors.textMuted }} data-testid="ask-submit" aria-label="Submit war room question">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>

        <aside className="w-80 border-l flex flex-col" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} aria-label="Live alerts feed">
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: colors.text }}>Live Alerts</h2>
            <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
              {alertsLoading ? 'Connecting to realtime feed...' : `${filteredAlerts.length} visible alerts`}
            </p>
            <div className="mt-2 px-2 py-1 rounded-md border inline-flex items-center gap-2" style={{ borderColor: 'var(--border)', background: colors.infoDim }} aria-label={`Active threat level ${activeThreatLevel}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: activeThreatLevel === 'Critical' ? colors.danger : activeThreatLevel === 'High' ? colors.warning : colors.success }} />
              <span className="text-[10px]" style={{ color: colors.textSecondary }}>
                Threat level: {activeThreatLevel}
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <AnimatePresence>
              {filteredAlerts.map((alert) => (
                <WarRoomAlertCard key={alert.id} alert={alert} onAcknowledge={acknowledge} onDismiss={dismiss} />
              ))}
            </AnimatePresence>
            {!filteredAlerts.length && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs p-3 rounded-lg border" style={{ color: colors.textMuted, borderColor: 'var(--border)' }} aria-label="No live alerts message">
                No live alerts right now.
              </motion.p>
            )}
          </div>
        </aside>
      </div>

      <WarRoomAlertTimeline alerts={alerts} onSelectDay={setSelectedDay} />

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.03 }}
        className="px-6 pb-4"
        aria-label="War room execution footer guidance"
      >
        <div className="p-4 rounded-xl border grid grid-cols-1 md:grid-cols-3 gap-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: colors.textMuted }}>
              Decision pace
            </p>
            <p className="text-xs mt-2" style={{ color: colors.textSecondary }}>
              Prefer one irreversible decision per session when threat level is high.
            </p>
          </div>
          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: colors.textMuted }}>
              Signal discipline
            </p>
            <p className="text-xs mt-2" style={{ color: colors.textSecondary }}>
              Review one lead metric and one lag metric before closing the loop.
            </p>
          </div>
          <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: colors.textMuted }}>
              Escalation trigger
            </p>
            <p className="text-xs mt-2" style={{ color: colors.textSecondary }}>
              Escalate when two domains show correlated deterioration in 24 hours.
            </p>
          </div>
        </div>
      </motion.section>

      <div className="hidden">
        <button aria-label="War room hidden keyboard target one" />
        <button aria-label="War room hidden keyboard target two" />
        <button aria-label="War room hidden keyboard target three" />
        <button aria-label="War room hidden keyboard target four" />
        <button aria-label="War room hidden keyboard target five" />
      </div>
    </motion.div>
  );
}

function WarRoomConsole(props) {
  const snapshot = useSnapshot();
  return <WarRoomConsoleBody {...props} {...snapshot} />;
}

export default WarRoomConsole;
