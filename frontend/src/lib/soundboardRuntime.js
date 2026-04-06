import { apiClient, callEdgeFunction } from './api';
import { getBackendUrl } from '../config/urls';
import { shouldUseGroundedDataQuery } from './soundboardQueryRouting';

export const SOUNDBOARD_CHAT_TIMEOUT_MS = 120000;

export function getSoundboardErrorMessage(error, fallbackMessage = 'Failed to send message') {
  if (error?.code === 'ECONNABORTED' || String(error?.message || '').toLowerCase().includes('timeout')) {
    return 'Reply timed out — try Normal mode or wait and retry (Trinity can take over a minute).';
  }
  if (String(error?.message || '').includes('API returned HTML instead of JSON')) {
    return 'Ask BIQc request was routed incorrectly (HTML returned instead of API JSON). Refresh and try again.';
  }
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  const reply = error?.response?.data?.reply;
  if (typeof reply === 'string' && reply.trim()) return reply;
  if (typeof error?.message === 'string' && error.message.trim()) return error.message;
  return fallbackMessage;
}

export function buildBoardroomChecks(connectedSources = [], evidenceSources = []) {
  const normalized = new Set(
    [...connectedSources, ...evidenceSources]
      .map((value) => String(value || '').toLowerCase().trim())
      .filter(Boolean)
  );
  const hasCRM = normalized.has('crm');
  const hasAccounting = normalized.has('accounting');
  const hasEmail = normalized.has('email');
  const hasMarket = ['market', 'google_ads', 'ads', 'competitor', 'web'].some((key) => normalized.has(key));

  const steps = [
    { role: 'CEO', line: 'Checking strategic priorities and growth pressure...' },
    hasCRM
      ? { role: 'CEO', line: 'Checking CRM pipeline momentum and stalled deals...' }
      : { role: 'COO', line: 'Checking execution cadence from available business signals...' },
    hasAccounting
      ? { role: 'Finance Manager', line: 'Checking overdue invoices, cash timing, and runway...' }
      : { role: 'Finance Manager', line: 'Checking cash risk assumptions from calibration and activity patterns...' },
    hasEmail
      ? { role: 'COO', line: 'Checking inbox response lag and escalation patterns...' }
      : { role: 'HR', line: 'Checking team load and decision bottlenecks from current evidence...' },
  ];

  if (hasMarket) {
    steps.push({ role: 'Marketing Manager', line: 'Checking Google Ads and market demand signals...' });
  }

  steps.push({ role: 'CCO', line: 'Aligning boardroom views into one clear recommendation...' });
  return steps;
}

export function buildAskBiqcComposedMessage({ userMessage = '', attachedFile = null }) {
  const trimmedUserMessage = String(userMessage || '').trim();
  let fullMessage = trimmedUserMessage;
  let displayMessage = trimmedUserMessage;

  if (attachedFile) {
    if (attachedFile.type === 'text' && attachedFile.content) {
      const preview = attachedFile.content.slice(0, 3000);
      const truncated = attachedFile.content.length > 3000;
      fullMessage = `${trimmedUserMessage ? `${trimmedUserMessage}\n\n` : ''}Attached file: ${attachedFile.name}\n\nContent:\n${preview}${truncated ? '\n\n[...truncated]' : ''}`;
      displayMessage = trimmedUserMessage || `Analysing: ${attachedFile.name}`;
    } else {
      fullMessage = `${trimmedUserMessage ? `${trimmedUserMessage}\n\n` : ''}File attached: ${attachedFile.name} (${attachedFile.hint || 'describe what you need'})`;
      displayMessage = trimmedUserMessage || `Attached: ${attachedFile.name}`;
    }
  }

  return { fullMessage, displayMessage };
}

export function buildAskBiqcRequestPayload({
  message,
  conversationId = null,
  intelligenceContext = {},
  mode = 'auto',
  agentId = 'auto',
  forensicReportMode = false,
  deliverableType = null,
  exportRequested = false,
}) {
  return {
    message,
    conversation_id: conversationId,
    intelligence_context: intelligenceContext,
    mode,
    agent_id: agentId || 'auto',
    forensic_report_mode: Boolean(forensicReportMode),
    deliverable_type: deliverableType || null,
    export_requested: Boolean(exportRequested),
  };
}

const ARTIFACT_TYPE_HINTS = [
  { type: 'video_brief', rx: /\b(video|storyboard|script)\b/i },
  { type: 'image', rx: /\b(image|graphic|logo|banner|visual|thumbnail)\b/i },
  { type: 'job_description', rx: /\b(job description|jd|position description|role spec)\b/i },
  { type: 'sop', rx: /\b(sop|standard operating procedure|process guide)\b/i },
  { type: 'playbook', rx: /\b(playbook|runbook|battlecard)\b/i },
  { type: 'dashboard_spec', rx: /\b(dashboard|scorecard|kpi board|kpi dashboard)\b/i },
  { type: 'plan', rx: /\b(plan|roadmap|execution plan|rollout)\b/i },
  { type: 'memo', rx: /\b(memo|briefing note|brief)\b/i },
  { type: 'report', rx: /\b(report|board report|board pack|exec report)\b/i },
  { type: 'analysis', rx: /\b(analysis|analyse|deep dive|forensic)\b/i },
];

export function inferAskBiqcGenerationIntent(message = '') {
  const text = String(message || '').trim();
  if (!text) return { deliverableType: null, exportRequested: false };
  const lower = text.toLowerCase();
  const exportRequested = /\b(export|download|file|pdf|docx|csv|ppt|powerpoint)\b/i.test(text);
  const creationRequested = /\b(create|generate|write|produce|build|draft|make|prepare)\b/i.test(text);
  const matched = ARTIFACT_TYPE_HINTS.find((item) => item.rx.test(text));
  let deliverableType = matched?.type || null;
  if (!deliverableType && creationRequested) {
    deliverableType = 'analysis';
  }
  if (!deliverableType && /\b(report|analysis)\b/i.test(text)) {
    deliverableType = 'report';
  }
  // Strong forensic prompts should route as report artifacts for strict structure.
  if (!deliverableType && /\b(board|forensic|executive summary|monthly review|quarterly review)\b/i.test(lower)) {
    deliverableType = 'report';
  }
  return { deliverableType, exportRequested };
}

export function normalizeAskBiqcConfidencePercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return value > 0 && value <= 1 ? value * 100 : value;
}

export function getAskBiqcMessageText(message) {
  const value = message?.content ?? message?.text ?? '';
  return typeof value === 'string' ? value : String(value || '');
}

export function findPreviousAskBiqcUserPrompt(messages, currentIndex) {
  return [...(messages || []).slice(0, currentIndex)]
    .reverse()
    .map((message) => getAskBiqcMessageText(message).trim())
    .find(Boolean) || '';
}

export function buildAskBiqcComposerDraftFromAnswer(answerText, { maxChars = 2400 } = {}) {
  const trimmed = String(answerText || '').trim();
  if (!trimmed) return '';
  const excerpt = trimmed.slice(0, maxChars);
  const truncated = trimmed.length > maxChars ? '\n\n[...truncated for follow-up]' : '';
  return `Use this previous Ask BIQc answer as context and continue from it:\n\n${excerpt}${truncated}\n\nFollow-up:`;
}

function shouldSynthesizeExportFile(message, responseData) {
  const text = String(message || '').toLowerCase();
  if (!text) return false;
  if (responseData?.file?.download_url) return false;
  return /(export|download|file|pdf|docx|csv|ppt|powerpoint)/i.test(text);
}

function buildInlineExportFile(content, hint = 'analysis') {
  const body = String(content || '').trim();
  if (!body) return null;
  const safeHint = String(hint || 'analysis').toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
  const name = `${safeHint}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.md`;
  const encoded = encodeURIComponent(body);
  return {
    name,
    type: safeHint,
    download_url: `data:text/markdown;charset=utf-8,${encoded}`,
    size: new Blob([body]).size,
    content_type: 'text/markdown',
    export_fallback: true,
  };
}

export function resolveAskBiqcTrace(traceOptions = null) {
  return {
    traceRootId: traceOptions?.trace_root_id || `trace-${Date.now()}`,
    responseVersion: Number(traceOptions?.response_version || 1),
  };
}

export function createAskBiqcPlaceholder({ traceRootId, responseVersion, includeText = false }) {
  const placeholder = {
    id: `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: 'assistant',
    content: '',
    streaming: true,
    trace_root_id: traceRootId,
    response_version: responseVersion,
  };
  if (includeText) {
    placeholder.text = '';
  }
  return placeholder;
}

export function appendAskBiqcDelta(messages, placeholderId, deltaText, { includeText = false } = {}) {
  return messages.map((message) => (
    message.id === placeholderId
      ? {
          ...message,
          content: `${message.content || ''}${deltaText}`,
          ...(includeText ? { text: `${message.text || ''}${deltaText}` } : {}),
        }
      : message
  ));
}

export function replaceAskBiqcPlaceholder(messages, placeholderId, assistantMessage) {
  return messages.map((message) => (message.id === placeholderId ? assistantMessage : message));
}

export function removeAskBiqcPlaceholder(messages, placeholderId) {
  return messages.filter((message) => message.id !== placeholderId);
}

export function markAskBiqcStreamingStopped(messages, { includeText = false } = {}) {
  return messages.map((message) => {
    if (!message.streaming) return message;

    const stoppedContent = `${message.content || ''}\n\n[Stopped]`;
    return {
      ...message,
      streaming: false,
      content: stoppedContent,
      ...(includeText ? { text: `${message.text || message.content || ''}\n\n[Stopped]` } : {}),
    };
  });
}

export async function copyAskBiqcText(text) {
  const value = String(text || '').trim();
  if (!value) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }

  return copied;
}

export function getAskBiqcCoverageGate(responseData) {
  const guardrail = responseData?.guardrail;
  if (guardrail !== 'BLOCKED' && guardrail !== 'DEGRADED') {
    return null;
  }

  return {
    guardrail,
    coveragePct: responseData?.coverage_pct ?? null,
    missingFields: Array.isArray(responseData?.missing_fields) ? responseData.missing_fields : [],
  };
}

function normalizeGroundedRetrievalContract(grounded = {}) {
  const nowIso = new Date().toISOString();
  const sources = (grounded?.data_sources || []).map((value) => String(value || '').toLowerCase().trim()).filter(Boolean);
  const sourceSet = new Set(sources);
  const searchedWindows = {
    overall: { start: null, end: null },
    crm: { start: null, end: null },
    accounting: { start: null, end: null },
    email: { start: null, end: null },
    calendar: { start: null, end: null },
    custom: { start: null, end: null },
  };
  const canonicalMode = sourceSet.size > 1 ? 'hybrid_compare' : 'materialized';
  return {
    retrieval_mode: 'grounded_query',
    canonical_retrieval_mode: canonicalMode,
    retrieval_plane: {
      engine: 'query_integrations_data',
      legacy_mode: 'grounded_query',
      canonical_mode: canonicalMode,
      execution_path: canonicalMode === 'hybrid_compare' ? 'hybrid_compare_cross_connector' : 'materialized_semantic_layer',
    },
    answer_grade: 'FULL',
    report_grade_request: false,
    grounded_report_ready: true,
    has_connected_sources: sources.length > 0,
    live_signal_count: 0,
    sources_used: sources,
    coverage_start: null,
    coverage_end: null,
    searched_windows: searchedWindows,
    coverage_gaps: [],
    missing_periods_count: 0,
    history_truncated: false,
    crm_pages_fetched: 0,
    accounting_pages_fetched: 0,
    email_retrieval: {},
    calendar_retrieval: {},
    custom_retrieval: {},
    materialization_attempted: false,
    signals_emitted_on_demand: 0,
    semantic_signal_layer: {
      version: 'semantic_signal_layer_v2',
      signals_materialized: 0,
      source_table: 'observation_events',
      freshness_state: 'unknown',
      background_refresh: {
        enabled: true,
        refresh_interval_minutes: 15,
      },
      on_demand_escalation: {
        requested: false,
        signals_emitted: 0,
        reason: null,
      },
    },
    quality_eval: {
      depth_score: 0,
      freshness_score: 0.4,
      coverage_score: 0.6,
      workspace_power_score: 0.35,
      answer_grade_score: 1,
      composite_score: 0.495,
      latency_slo_ms_target: 45000,
      latency_observed_ms: null,
      latency_slo_breached: false,
    },
    pricing_packaging: {
      workspace_tier: 'free',
      required_tier: 'free',
      tier_aligned: true,
      packaging_basis: {
        depth_score: 0,
        freshness_score: 0.4,
        workspace_power_score: 0.35,
      },
    },
    surfaced_at: nowIso,
  };
}

function buildGroundedAssistantMessage(grounded, { traceRootId, responseVersion, includeText = false } = {}) {
  const content = String(grounded?.answer || grounded?.message || '').trim();
  const retrievalContract = grounded?.status === 'answered'
    ? normalizeGroundedRetrievalContract(grounded)
    : undefined;
  const assistantMessage = {
    role: 'assistant',
    content,
    sources: grounded?.data_sources || [],
    evidence_pack: (grounded?.data_sources || []).length
      ? {
          sources: (grounded.data_sources || []).map((source, idx) => ({
            id: `grounded-${idx}`,
            source,
            freshness: 'live_query',
          })),
        }
      : undefined,
    soundboard_contract: grounded?.status === 'answered'
      ? {
          version: 'grounded_query_v1',
          guardrail: 'FULL',
          connected_sources: grounded?.data_sources || [],
        }
      : undefined,
    retrieval_contract: retrievalContract,
    boardroom_status: grounded?.status === 'answered' ? 'grounded_query' : 'grounding_blocked',
    trace_root_id: traceRootId,
    response_version: responseVersion,
  };

  if (grounded?.status === 'not_connected') {
    assistantMessage.type = 'integration_prompt';
  }
  if (includeText) {
    assistantMessage.text = content;
  }
  return assistantMessage;
}

function buildAssistantMessageFromResponse(responseData, { traceRootId, responseVersion, includeText = false } = {}) {
  const assistantMessage = {
    role: 'assistant',
    content: responseData.reply,
    suggested_actions: responseData.suggested_actions || [],
    intent: responseData.intent,
    agent_name: responseData.agent_name || undefined,
    model_used: responseData.model_used,
    confidence_score: responseData.confidence_score,
    data_sources_count: responseData.data_sources_count,
    data_freshness: responseData.data_freshness,
    lineage: responseData.lineage,
    boardroom_trace: responseData.boardroom_trace,
    boardroom_status: responseData.boardroom_status,
    evidence_pack: responseData.evidence_pack,
    soundboard_contract: responseData.soundboard_contract,
    retrieval_contract: responseData.retrieval_contract,
    forensic_report: responseData.forensic_report,
    generation_contract: responseData.generation_contract,
    advisory_slots: responseData.advisory_slots,
    coverage_window: responseData.coverage_window,
    data_requirements: responseData.data_requirements || [],
    data_coverage_pct: responseData.data_coverage_pct,
    trace_root_id: traceRootId,
    response_version: responseVersion,
  };

  if (responseData?.file) {
    assistantMessage.file = responseData.file;
  }
  if (includeText) {
    assistantMessage.text = responseData.reply;
  }
  return assistantMessage;
}

async function streamSoundboardChat({
  sessionToken,
  payload,
  signal,
  onDelta,
  onStart,
  onToolStart,
  onToolResult,
  onError,
} = {}) {
  if (!sessionToken) {
    throw new Error('Missing session token for streaming chat');
  }

  const response = await fetch(`${getBackendUrl()}/api/soundboard/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    signal,
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Streaming request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finalPayload = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const rawEvent of events) {
      const line = rawEvent.split('\n').find((entry) => entry.startsWith('data: '));
      if (!line) continue;

      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === 'start') {
          onStart?.(event);
        } else if (event.type === 'delta' && typeof event.text === 'string') {
          onDelta?.(event.text);
        } else if (event.type === 'tool_start') {
          onToolStart?.(event);
        } else if (event.type === 'tool_result') {
          onToolResult?.(event);
        } else if (event.type === 'final' && event.payload) {
          finalPayload = event.payload;
        } else if (event.type === 'error') {
          onError?.(event);
          const streamErr = new Error(event?.message || 'Streaming error');
          streamErr.__streamFatal = true;
          throw streamErr;
        }
      } catch (err) {
        if (err?.__streamFatal) {
          throw err;
        }
        // Ignore malformed event chunks and continue streaming.
      }
    }
  }

  return finalPayload;
}

async function queryIntegrationData({ sessionToken, query, logPrefix = 'soundboard' }) {
  try {
    if (!sessionToken) return null;
    return await callEdgeFunction('query-integrations-data', { query });
  } catch (error) {
    console.warn(`[${logPrefix}] integration query failed`, error);
    return null;
  }
}

export async function runAskBiqcTurn({
  sessionToken,
  message,
  requestPayload,
  traceRootId,
  responseVersion,
  streamAbortRef = null,
  includeText = false,
  requestTimeoutMs = SOUNDBOARD_CHAT_TIMEOUT_MS,
  onDelta,
  onStart,
  onToolStart,
  onToolResult,
  onError,
  logPrefix = 'soundboard',
}) {
  if (shouldUseGroundedDataQuery(message)) {
    const grounded = await queryIntegrationData({ sessionToken, query: message, logPrefix });
    if (grounded?.status === 'answered' || grounded?.status === 'not_connected') {
      return {
        kind: 'resolved',
        assistantMessage: buildGroundedAssistantMessage(grounded, { traceRootId, responseVersion, includeText }),
        responseData: grounded,
        coverageGate: null,
      };
    }
  }

  const abortController = new AbortController();
  if (streamAbortRef) {
    streamAbortRef.current = abortController;
  }

  try {
    const streamedPayload = await streamSoundboardChat({
      sessionToken,
      payload: requestPayload,
      signal: abortController.signal,
      onDelta,
      onStart,
      onToolStart,
      onToolResult,
      onError,
    });
    if (streamAbortRef) {
      streamAbortRef.current = null;
    }

    const responseConfig = requestTimeoutMs ? { timeout: requestTimeoutMs } : undefined;
    const responseData = streamedPayload || (await apiClient.post('/soundboard/chat', requestPayload, responseConfig)).data;
    const coverageGate = getAskBiqcCoverageGate(responseData);
    const replyTrimmed = typeof responseData?.reply === 'string' ? responseData.reply.trim() : '';

    if (!replyTrimmed) {
      const hint = 'I could not generate a complete answer for that request. Please retry.';

      return {
        kind: 'empty',
        assistantMessage: {
          role: 'assistant',
          content: String(hint),
          ...(includeText ? { text: String(hint) } : {}),
        },
        responseData,
        coverageGate,
      };
    }

    const assistantMessage = buildAssistantMessageFromResponse(responseData, { traceRootId, responseVersion, includeText });
    if (shouldSynthesizeExportFile(message, responseData) && !assistantMessage.file) {
      assistantMessage.file = buildInlineExportFile(
        responseData?.reply || assistantMessage?.content || '',
        responseData?.generation_contract?.artifact_type || 'analysis'
      );
    }
    return {
      kind: 'resolved',
      assistantMessage,
      responseData,
      coverageGate,
    };
  } catch (error) {
    if (streamAbortRef) {
      streamAbortRef.current = null;
    }
    throw error;
  }
}
