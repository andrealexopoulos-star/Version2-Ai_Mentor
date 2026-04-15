import React, { useState, useMemo } from 'react';
import { Database, Download, Lightbulb, Target, Zap, TrendingUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fontFamily } from '../../design-system/tokens';
import { normalizeMessageContent } from '../../lib/soundboardPolicy';
import { normalizeAskBiqcConfidencePercent } from '../../lib/soundboardRuntime';
import AskBiqcMessageActions from './AskBiqcMessageActions';

function Chip({ children, style = {}, testId }) {
  return (
    <span
      className="text-[9px] px-1.5 py-0.5 rounded"
      style={{ fontFamily: fontFamily.mono, ...style }}
      data-testid={testId}
    >
      {children}
    </span>
  );
}

/**
 * Parse Insight / Decision / Action / Impact sections out of the raw markdown.
 * Supports multiple heading styles so upstream copy stays natural:
 *   - "## Insight", "### Insight"
 *   - "**Insight:**" or "**Insight**"
 *   - "Insight:" on its own line
 * Aliases ("Recommended Action", "Business Impact", "Key Insight", "Recommendation",
 * "Next Step") are mapped to the canonical four slots. Content keeps its markdown
 * so lists and emphasis still render.
 */
function parseStructuredSections(text) {
  if (!text || typeof text !== 'string') return null;

  const lines = text.split('\n');
  const sections = {};
  let current = null;
  let prefaceLines = [];

  const mapHeading = (raw) => {
    const key = raw.toLowerCase();
    if (/insight|finding|observation/.test(key)) return 'insight';
    if (/decision|recommendation|recommend/.test(key)) return 'decision';
    if (/action|next\s*step|do\s*next/.test(key)) return 'action';
    if (/impact|outcome|result|consequence/.test(key)) return 'impact';
    return null;
  };

  const headingRegex = /^\s*(?:#{1,4}\s*)?(?:\*\*)?\s*(Insight|Key Insight|Finding|Observation|Decision|Recommendation|Recommended(?:\s+Decision)?|Action|Recommended Action|Next Step|Do Next|Impact|Business Impact|Outcome|Result|Consequence)s?\s*(?:\*\*)?\s*:?\s*(.*)$/i;

  lines.forEach((raw) => {
    const trimmed = raw.trim();
    const m = trimmed.match(headingRegex);
    if (m) {
      const mapped = mapHeading(m[1]);
      if (mapped) {
        current = mapped;
        if (!sections[current]) sections[current] = [];
        if (m[2]) sections[current].push(m[2].trim());
        return;
      }
    }
    if (current) {
      sections[current].push(raw);
    } else {
      prefaceLines.push(raw);
    }
  });

  const canonicalKeys = ['insight', 'decision', 'action', 'impact'];
  const filled = canonicalKeys.filter((k) => (sections[k] || []).join('').trim().length > 0);

  // Require at least 2 of 4 slots populated before switching to structured rendering —
  // keeps short or conversational replies from being forced into a panel.
  if (filled.length < 2) return null;

  const out = {};
  canonicalKeys.forEach((k) => {
    const joined = (sections[k] || []).join('\n').replace(/^\s*\n+/, '').trimEnd();
    out[k] = joined;
  });
  out.__preface = prefaceLines.join('\n').trim();
  return out;
}

const SECTION_META = {
  insight: {
    label: 'Insight',
    Icon: Lightbulb,
    accent: 'var(--lava)',
    wash: 'var(--lava-wash)',
    ring: 'var(--lava-ring)',
  },
  decision: {
    label: 'Decision',
    Icon: Target,
    accent: 'var(--info)',
    wash: 'var(--info-wash)',
    ring: 'rgba(37,99,235,0.25)',
  },
  action: {
    label: 'Action',
    Icon: Zap,
    accent: 'var(--positive)',
    wash: 'var(--positive-wash)',
    ring: 'rgba(22,163,74,0.25)',
  },
  impact: {
    label: 'Impact',
    Icon: TrendingUp,
    accent: 'var(--warning)',
    wash: 'var(--warning-wash)',
    ring: 'rgba(217,119,6,0.25)',
  },
};

function StructuredSection({ kind, body, compact }) {
  const meta = SECTION_META[kind];
  if (!meta || !body) return null;
  const { Icon } = meta;
  return (
    <section
      className={`rounded-xl ${compact ? 'p-2.5' : 'p-3'}`}
      style={{
        background: meta.wash,
        border: `1px solid ${meta.ring}`,
      }}
      data-testid={`ask-biqc-structured-${kind}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: meta.accent }} />
        <span
          className="text-[10px] uppercase tracking-wider font-semibold"
          style={{ color: meta.accent, fontFamily: fontFamily.mono, letterSpacing: '0.08em' }}
        >
          {meta.label}
        </span>
      </div>
      <div
        className="markdown-body"
        style={{
          color: 'var(--ink)',
          fontFamily: fontFamily.body,
          lineHeight: 1.55,
          fontSize: compact ? '12px' : '13px',
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
    </section>
  );
}

export default function AskBiqcAssistantResponse({
  message,
  compact = false,
  onCopy,
  onUseInComposer,
  onRegenerate,
  onSuggestedAction,
  actionTestIdPrefix = 'ask-biqc-response-action',
  metadataTestId = 'ask-biqc-response-metadata-row',
  evidenceTestId = 'ask-biqc-evidence-row',
}) {
  const [showDetails, setShowDetails] = useState(false);
  const safeMessage = message && typeof message === 'object' ? message : {};
  const role = safeMessage.role;

  const confidencePercent = normalizeAskBiqcConfidencePercent(safeMessage.confidence_score);
  const contentText = normalizeMessageContent(message.content ?? message.text);
  const structured = useMemo(() => parseStructuredSections(contentText), [contentText]);
  const evidenceSources = (safeMessage.evidence_pack?.sources || []).filter(
    (source) => String(source?.source || '').trim().toLowerCase() !== 'unknown'
  );
  const directSources = (safeMessage.sources || []).filter(
    (source) => String(source || '').trim().toLowerCase() !== 'unknown'
  );
  const retrievalContract = safeMessage.retrieval_contract || {};
  const forensicReport = safeMessage.forensic_report || {};
  const generationContract = safeMessage.generation_contract || {};
  const exportRequestedByPrompt = /\b(export|download|file|pdf|docx|csv|ppt|powerpoint)\b/i.test(contentText);
  const canInlineExport = Boolean(
    contentText.trim()
    && (
      generationContract.requested
      || retrievalContract.report_grade_request
      || exportRequestedByPrompt
    )
  );
  const hasAdvancedDetails = Boolean(
    evidenceSources.length > 0
    || safeMessage.coverage_window
    || safeMessage.boardroom_trace?.phases?.length
    || safeMessage.boardroom_status === 'fallback_error'
    || (forensicReport.mode_active && retrievalContract.answer_grade)
    || (Array.isArray(forensicReport.contradictions) && forensicReport.contradictions.length > 0)
    || directSources.length > 0
    || confidencePercent != null
    || typeof safeMessage.data_sources_count === 'number'
    || safeMessage.data_freshness
    || retrievalContract.retrieval_mode
    || retrievalContract.answer_grade
    || retrievalContract.history_truncated
    || Number(retrievalContract.crm_pages_fetched || 0) > 0
    || Number(retrievalContract.accounting_pages_fetched || 0) > 0
    || retrievalContract.materialization_attempted
    || generationContract.requested
    || safeMessage.advisory_slots?.kpi_note
    || (typeof safeMessage.response_version === 'number' && safeMessage.response_version > 1)
    || (Array.isArray(forensicReport.citations) && forensicReport.citations.length > 0)
  );
  if (role !== 'assistant') return null;

  return (
    <>
      {message.agent_name && (
        <p
          className="text-[10px] font-medium mb-1"
          style={{ color: 'var(--info)', fontFamily: fontFamily.mono }}
        >
          {message.agent_name}
        </p>
      )}
      {message.type === 'integration_prompt' && (
        <Database
          className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5"
          style={{ color: 'var(--warning)' }}
        />
      )}

      {/* Structured intelligence panel (Insight / Decision / Action / Impact).
          Falls back to plain markdown if the response is conversational. */}
      {structured ? (
        <div className="flex flex-col gap-2" data-testid="ask-biqc-structured-panel">
          {structured.__preface && (
            <div
              className="markdown-body"
              style={{ color: 'var(--ink-secondary)', lineHeight: 1.5, fontSize: '12px' }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{structured.__preface}</ReactMarkdown>
            </div>
          )}
          <StructuredSection kind="insight" body={structured.insight} compact={compact} />
          <StructuredSection kind="decision" body={structured.decision} compact={compact} />
          <StructuredSection kind="action" body={structured.action} compact={compact} />
          <StructuredSection kind="impact" body={structured.impact} compact={compact} />
        </div>
      ) : (
        <div
          className="markdown-body"
          style={{ lineHeight: 1.7, color: 'var(--ink)', fontFamily: fontFamily.body }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {contentText || ''}
          </ReactMarkdown>
        </div>
      )}

      <AskBiqcMessageActions
        role="assistant"
        compact={compact}
        onCopy={onCopy}
        onUseInComposer={onUseInComposer}
        onRegenerate={onRegenerate}
        testIdPrefix={actionTestIdPrefix}
      />
      {canInlineExport && (
        <button
          type="button"
          onClick={() => {
            try {
              const filenameHint = String(generationContract.artifact_type || 'ask_biqc_export')
                .replace(/[^a-z0-9_-]+/gi, '_')
                .toLowerCase();
              const filename = `${filenameHint}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.md`;
              const blob = new Blob([contentText], { type: 'text/markdown;charset=utf-8' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(link.href);
            } catch {
              // no-op: preserve chat flow if browser blocks downloads
            }
          }}
          className={`${compact ? 'mt-2 px-2.5 py-1 text-[10px]' : 'mt-2 px-3 py-1.5 text-xs'} rounded-lg font-medium transition-all hover:brightness-110 flex items-center gap-1.5`}
          style={{
            background: 'var(--lava-wash)',
            border: '1px solid var(--lava-ring)',
            color: 'var(--lava)',
            fontFamily: fontFamily.mono,
          }}
          data-testid={`${actionTestIdPrefix}-export-inline`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export this response</span>
        </button>
      )}
      {hasAdvancedDetails && (
        <button
          type="button"
          className="mt-2 text-[10px] underline-offset-2 hover:underline"
          style={{ color: 'var(--ink-secondary)', fontFamily: fontFamily.mono }}
          onClick={() => setShowDetails((value) => !value)}
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </button>
      )}

      {message.suggested_actions?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {message.suggested_actions.map((action, index) => (
            <button
              key={`${action.action || action.label || 'action'}-${index}`}
              type="button"
              onClick={() => onSuggestedAction?.(action.prompt || action.label)}
              className={`${compact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'} rounded-lg font-medium transition-all hover:brightness-110 flex items-center gap-1.5`}
              style={{
                background: 'var(--lava-wash)',
                border: '1px solid var(--lava-ring)',
                color: 'var(--lava)',
                fontFamily: fontFamily.mono,
              }}
              data-testid={`${actionTestIdPrefix}-suggested-${index}`}
            >
              <span>→</span>
              <span>{action.label || action.prompt}</span>
            </button>
          ))}
        </div>
      )}
      {showDetails
        && (
          (retrievalContract.answer_grade && retrievalContract.answer_grade !== 'FULL')
          || Boolean(forensicReport.degraded_reason)
          || message.guardrail_status === 'LIMITED_DATA'
        )
        && onSuggestedAction && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => onSuggestedAction('Rerun this request with a deeper historical window, include pagination/backfill status per connector, and provide a report with explicit data gaps.')}
              className={`${compact ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'} rounded-lg font-medium transition-all hover:brightness-110`}
              style={{
                background: 'var(--info-wash)',
                border: '1px solid rgba(37,99,235,0.25)',
                color: 'var(--info)',
                fontFamily: fontFamily.mono,
              }}
              data-testid={`${actionTestIdPrefix}-rerun-deeper-window`}
            >
              Rerun with deeper window
            </button>
          </div>
        )}

      {message.intent?.domain && message.intent.domain !== 'general' && (
        <div className="mt-2">
          <Chip style={{ background: 'var(--surface-sunken)', color: 'var(--ink-secondary)' }}>
            {message.intent.domain.toUpperCase()} · {message.model_used || 'AI'}
          </Chip>
        </div>
      )}

      {showDetails && evidenceSources.length > 0 && (
        <div className={`mt-2 flex flex-wrap ${compact ? 'gap-1' : 'gap-1.5'}`} data-testid={evidenceTestId}>
          {evidenceSources.slice(0, 5).map((source) => (
            <Chip
              key={source.id || source.source}
              style={{ background: 'rgba(139,92,246,0.12)', color: 'rgb(124, 58, 237)', border: '1px solid rgba(139,92,246,0.25)' }}
            >
              {source.source} {source.freshness ? `(${source.freshness})` : ''}
            </Chip>
          ))}
        </div>
      )}

      {showDetails && message.coverage_window && (
        <div
          className={`${compact ? 'mt-2 rounded-lg px-2 py-1.5' : 'mt-2 rounded-lg p-2'}`}
          style={{
            background: 'var(--surface-sunken)',
            border: '1px solid var(--border)',
          }}
        >
          <p
            className={`${compact ? 'text-[9px] uppercase tracking-wider mb-1' : 'text-[10px] mb-1'}`}
            style={{ color: 'var(--ink-secondary)', fontFamily: fontFamily.mono }}
          >
            Coverage window
          </p>
          <p className="text-[10px]" style={{ color: 'var(--ink)', fontFamily: fontFamily.mono }}>
            {(message.coverage_window.coverage_start || 'n/a')} {compact ? '→' : '->'} {(message.coverage_window.coverage_end || 'n/a')}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--ink-muted)', fontFamily: fontFamily.mono }}>
            last sync: {message.coverage_window.last_sync_at || 'n/a'} · {compact ? 'confidence impact' : 'impact'}: {message.coverage_window.confidence_impact || 'unknown'}
          </p>
          {Array.isArray(message.coverage_window.missing_periods) && message.coverage_window.missing_periods.length > 0 && (
            <p className="text-[10px]" style={{ color: 'var(--warning)', fontFamily: fontFamily.mono }}>
              gap: {message.coverage_window.missing_periods[0]}
            </p>
          )}
        </div>
      )}
      {showDetails && (retrievalContract.searched_windows || retrievalContract.coverage_gaps || retrievalContract.sources_used) && (
        <div
          className={`${compact ? 'mt-2 rounded-lg px-2 py-1.5' : 'mt-2 rounded-lg p-2'}`}
          style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border)' }}
          data-testid="ask-biqc-retrieval-windows"
        >
          <p
            className={`${compact ? 'text-[9px]' : 'text-[10px]'} mb-1`}
            style={{ color: 'var(--positive)', fontFamily: fontFamily.mono }}
          >
            Retrieval windows
          </p>
          <div className="grid gap-1">
            {(() => {
              const windows = retrievalContract.searched_windows || {};
              const blocks = [
                ['overall', windows.overall],
                ['crm', windows.crm],
                ['accounting', windows.accounting],
                ['email', windows.email],
                ['calendar', windows.calendar],
                ['custom', windows.custom],
              ];
              return blocks.map(([label, block]) => {
                if (!block || (!block.start && !block.end)) return null;
                return (
                  <div key={`window-${label}`} className="text-[10px]" style={{ color: 'var(--ink)', fontFamily: fontFamily.mono }}>
                    {label}: {(block.start || 'n/a')} {compact ? '→' : '->'} {(block.end || 'n/a')}
                  </div>
                );
              });
            })()}
          </div>
          {Array.isArray(retrievalContract.coverage_gaps) && retrievalContract.coverage_gaps.length > 0 && (
            <p className="text-[10px] mt-1" style={{ color: 'var(--warning)', fontFamily: fontFamily.mono }}>
              gaps: {retrievalContract.coverage_gaps[0]}
            </p>
          )}
          {Array.isArray(retrievalContract.sources_used) && retrievalContract.sources_used.length > 0 && (
            <p className="text-[10px] mt-1" style={{ color: 'var(--ink-secondary)', fontFamily: fontFamily.mono }}>
              sources used: {retrievalContract.sources_used.slice(0, 6).join(', ')}
            </p>
          )}
        </div>
      )}
      {showDetails && retrievalContract.semantic_signal_layer && (
        <div
          className={`${compact ? 'mt-2 rounded-lg px-2 py-1.5' : 'mt-2 rounded-lg p-2'}`}
          style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border)' }}
          data-testid="ask-biqc-semantic-signal-layer"
        >
          <p
            className={`${compact ? 'text-[9px]' : 'text-[10px]'} mb-1`}
            style={{ color: 'var(--positive)', fontFamily: fontFamily.mono }}
          >
            Live business signals
          </p>
          <p className="text-[10px]" style={{ color: 'var(--ink)', fontFamily: fontFamily.mono }}>
            signals {Number(retrievalContract.semantic_signal_layer.signals_materialized || 0)} · {retrievalContract.semantic_signal_layer.freshness_state || 'unknown'}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--ink-secondary)', fontFamily: fontFamily.mono }}>
            refresh {Number(retrievalContract.semantic_signal_layer?.background_refresh?.refresh_interval_minutes || 0)}m · escalation +{Number(retrievalContract.semantic_signal_layer?.on_demand_escalation?.signals_emitted || 0)}
          </p>
        </div>
      )}

      {showDetails && message.boardroom_trace?.phases?.length > 0 && (
        <div
          className={compact ? 'flex gap-1 mt-2 flex-wrap' : 'mt-2 rounded-lg p-2'}
          style={compact ? undefined : { border: '1px solid var(--border)', background: 'var(--surface-sunken)' }}
        >
          {!compact && (
            <p className="text-[10px] mb-1" style={{ color: 'var(--info)', fontFamily: fontFamily.mono }}>
              Boardroom orchestration
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            {message.boardroom_trace.phases.slice(0, compact ? 4 : 6).map((phase, index) => (
              <Chip
                key={`${phase.phase}-${phase.role || index}`}
                style={{
                  background: 'var(--info-wash)',
                  color: 'var(--info)',
                  border: '1px solid rgba(37,99,235,0.2)',
                }}
              >
                {phase.phase}{phase.role ? `:${phase.role}` : ''} {phase.status || 'ok'}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {showDetails && message.boardroom_status === 'fallback_error' && (
        <div className="mt-2">
          <Chip style={{ background: 'var(--warning-wash)', color: 'var(--warning)', border: '1px solid rgba(217,119,6,0.25)' }}>
            Boardroom degraded mode
          </Chip>
        </div>
      )}
      {showDetails && forensicReport.mode_active && retrievalContract.answer_grade && retrievalContract.answer_grade !== 'FULL' && (
        <div className="mt-2" data-testid="ask-biqc-forensic-banner">
          <Chip style={{ background: 'var(--warning-wash)', color: 'var(--warning)', border: '1px solid rgba(217,119,6,0.25)' }}>
            Forensic report limited: {retrievalContract.answer_grade}
          </Chip>
        </div>
      )}
      {showDetails && (forensicReport.mode_active || retrievalContract.report_grade_request || retrievalContract.answer_grade) && (
        <div
          className={`${compact ? 'mt-2 rounded-lg px-2 py-1.5' : 'mt-2 rounded-lg p-2'}`}
          style={{ background: 'var(--surface-sunken)', border: '1px solid var(--border)' }}
          data-testid="ask-biqc-forensic-contradictions"
        >
          <p
            className={`${compact ? 'text-[9px]' : 'text-[10px]'} mb-1`}
            style={{ color: 'var(--ink-secondary)', fontFamily: fontFamily.mono }}
          >
            Contradictions
          </p>
          <div className="grid gap-1">
            <div className="grid grid-cols-[110px_1fr] gap-2 text-[9px]" style={{ color: 'var(--ink-secondary)', fontFamily: fontFamily.mono }}>
              <span>Role</span>
              <span>Conflict</span>
            </div>
            {(Array.isArray(forensicReport.contradictions) ? forensicReport.contradictions : []).slice(0, 4).map((item, index) => (
              <div key={`forensic-contradiction-${index}`} className="grid grid-cols-[110px_1fr] gap-2 text-[10px]" style={{ color: 'var(--ink)' }}>
                <span style={{ fontFamily: fontFamily.mono }}>{item.role || 'source'}</span>
                <span>{item.contradiction || 'n/a'}</span>
              </div>
            ))}
            {(!Array.isArray(forensicReport.contradictions) || forensicReport.contradictions.length === 0) && (
              <div className="grid grid-cols-[110px_1fr] gap-2 text-[10px]" style={{ color: 'var(--ink)' }}>
                <span style={{ fontFamily: fontFamily.mono }}>system</span>
                <span>No explicit contradictions detected in this turn.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {showDetails && directSources.length > 0 && compact && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {directSources.map((source, index) => (
            <Chip key={`${source}-${index}`} style={{ background: 'var(--positive-wash)', color: 'var(--positive)', border: '1px solid rgba(22,163,74,0.25)' }}>
              {source}
            </Chip>
          ))}
        </div>
      )}

      {showDetails && (
        <div className="mt-2 flex flex-wrap gap-1.5" data-testid={metadataTestId}>
        {confidencePercent != null && (
          <Chip
            style={{ background: 'var(--positive-wash)', color: 'var(--positive)', border: '1px solid rgba(22,163,74,0.25)' }}
            testId={`${metadataTestId}-confidence`}
          >
            Confidence {confidencePercent.toFixed(0)}%
          </Chip>
        )}
        {typeof message.data_sources_count === 'number' && (
          <Chip
            style={{ background: 'var(--info-wash)', color: 'var(--info)', border: '1px solid rgba(37,99,235,0.25)' }}
            testId={`${metadataTestId}-sources`}
          >
            {message.data_sources_count} sources
          </Chip>
        )}
        {message.data_freshness && (
          <Chip
            style={{ background: 'var(--warning-wash)', color: 'var(--warning)', border: '1px solid rgba(217,119,6,0.25)' }}
            testId={`${metadataTestId}-freshness`}
          >
            Last updated {message.data_freshness}
          </Chip>
        )}
        {retrievalContract.retrieval_mode && (
          <Chip
            style={{ background: 'rgba(99,102,241,0.12)', color: 'rgb(79, 70, 229)', border: '1px solid rgba(99,102,241,0.25)' }}
            testId={`${metadataTestId}-retrieval-mode`}
          >
            analysis mode {retrievalContract.retrieval_mode}
          </Chip>
        )}
        {retrievalContract.canonical_retrieval_mode && (
          <Chip
            style={{ background: 'rgba(45,212,191,0.12)', color: 'rgb(13, 148, 136)', border: '1px solid rgba(45,212,191,0.25)' }}
            testId={`${metadataTestId}-canonical-retrieval-mode`}
          >
            canonical {retrievalContract.canonical_retrieval_mode}
          </Chip>
        )}
        {retrievalContract.answer_grade && (
          <Chip
            style={{ background: 'rgba(236,72,153,0.12)', color: 'rgb(190, 24, 93)', border: '1px solid rgba(236,72,153,0.25)' }}
            testId={`${metadataTestId}-answer-grade`}
          >
            grade {retrievalContract.answer_grade}
          </Chip>
        )}
        {retrievalContract.history_truncated && (
          <Chip
            style={{ background: 'var(--warning-wash)', color: 'var(--warning)', border: '1px solid rgba(217,119,6,0.25)' }}
            testId={`${metadataTestId}-history-truncated`}
          >
            history truncated
          </Chip>
        )}
        {(Number(retrievalContract.crm_pages_fetched || 0) > 0 || Number(retrievalContract.accounting_pages_fetched || 0) > 0) && (
          <Chip
            style={{ background: 'rgba(56,189,248,0.12)', color: 'rgb(2, 132, 199)', border: '1px solid rgba(56,189,248,0.25)' }}
            testId={`${metadataTestId}-pages-fetched`}
          >
            pages crm:{Number(retrievalContract.crm_pages_fetched || 0)} acc:{Number(retrievalContract.accounting_pages_fetched || 0)}
          </Chip>
        )}
        {(() => {
          const blocks = [
            { key: 'email', label: 'email', block: retrievalContract.email_retrieval, testSuffix: 'email-depth' },
            { key: 'cal', label: 'calendar', block: retrievalContract.calendar_retrieval, testSuffix: 'calendar-depth' },
            { key: 'custom', label: 'custom', block: retrievalContract.custom_retrieval, testSuffix: 'custom-depth' },
          ];
          return blocks.map(({ key, label, block, testSuffix }) => {
            if (!block || typeof block !== 'object') return null;
            const pages = Number(block.pages_fetched || 0);
            const rows = Number(block.rows_loaded || 0);
            const hasWindow = Boolean(block.window_start && block.window_end);
            if (pages <= 0 && rows <= 0 && !block.truncated && !hasWindow) return null;
            const tail = [
              pages > 0 ? `p${pages}` : null,
              rows > 0 ? `r${rows}` : null,
              block.total_rows != null && Number(block.total_rows) > rows ? `tot${Number(block.total_rows)}` : null,
              block.truncated ? 'trunc' : null,
            ].filter(Boolean).join(' ');
            const win = hasWindow
              ? `${String(block.window_start).slice(0, 10)}->${String(block.window_end).slice(0, 10)}`
              : '';
            const text = [label, tail, win].filter(Boolean).join(' ');
            return (
              <Chip
                key={`depth-${key}`}
                style={{ background: 'rgba(45,212,191,0.12)', color: 'rgb(13, 148, 136)', border: '1px solid rgba(45,212,191,0.25)' }}
                testId={`${metadataTestId}-${testSuffix}`}
              >
                {text}
              </Chip>
            );
          });
        })()}
        {retrievalContract.materialization_attempted && (
          <Chip
            style={{ background: 'var(--positive-wash)', color: 'var(--positive)', border: '1px solid rgba(22,163,74,0.25)' }}
            testId={`${metadataTestId}-materialization`}
          >
            signal heal +{Number(retrievalContract.signals_emitted_on_demand || 0)}
          </Chip>
        )}
        {retrievalContract.quality_eval?.latency_slo_ms_target && (
          <Chip
            style={{ background: 'var(--info-wash)', color: 'var(--info)', border: '1px solid rgba(37,99,235,0.25)' }}
            testId={`${metadataTestId}-latency-slo`}
          >
            slo {Number(retrievalContract.quality_eval.latency_slo_ms_target)}ms
          </Chip>
        )}
        {retrievalContract.quality_eval?.latency_slo_breached && (
          <Chip
            style={{ background: 'var(--danger-wash)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.25)' }}
            testId={`${metadataTestId}-latency-slo-breached`}
          >
            slo breached
          </Chip>
        )}
        {retrievalContract.pricing_packaging?.required_tier && (
          <Chip
            style={{ background: 'var(--warning-wash)', color: 'var(--warning)', border: '1px solid rgba(217,119,6,0.25)' }}
            testId={`${metadataTestId}-pricing-required-tier`}
          >
            package {retrievalContract.pricing_packaging.required_tier}+
          </Chip>
        )}
        {generationContract.requested && (
          <Chip
            style={{ background: 'var(--lava-wash)', color: 'var(--lava)', border: '1px solid var(--lava-ring)' }}
            testId={`${metadataTestId}-generation-artifact`}
          >
            artifact {generationContract.artifact_type || 'analysis'}
          </Chip>
        )}
        {generationContract.requested && generationContract.tier_allowed === false && (
          <Chip
            style={{ background: 'var(--danger-wash)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.25)' }}
            testId={`${metadataTestId}-generation-tier-gated`}
          >
            export tier {generationContract.required_tier || 'starter'}+
          </Chip>
        )}
        {message.advisory_slots?.kpi_note && (
          <Chip
            style={{ background: 'rgba(139,92,246,0.12)', color: 'rgb(124, 58, 237)', border: '1px solid rgba(139,92,246,0.25)' }}
            testId={`${metadataTestId}-kpi`}
          >
            KPI note
          </Chip>
        )}
        {typeof message.response_version === 'number' && message.response_version > 1 && (
          <Chip
            style={{ background: 'var(--surface-sunken)', color: 'var(--ink-secondary)', border: '1px solid var(--border)' }}
            testId={`${metadataTestId}-version`}
          >
            v{message.response_version}
          </Chip>
        )}
        </div>
      )}
      {showDetails && Array.isArray(forensicReport.citations) && forensicReport.citations.length > 0 && (
        <div className="mt-2 grid gap-1.5" data-testid="ask-biqc-forensic-citations">
          {forensicReport.citations.slice(0, compact ? 3 : 5).map((citation, index) => (
            <div
              key={`forensic-citation-${index}`}
              className="rounded px-2 py-1.5"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}
            >
              <p className="text-[10px]" style={{ color: 'var(--info)', fontFamily: fontFamily.mono }}>
                {citation.ref || `S${index + 1}`} · {citation.source || 'source'} {citation.source_id ? `(${citation.source_id})` : ''}
              </p>
              {citation.summary && (
                <p className="text-[10px]" style={{ color: 'var(--ink)', fontFamily: fontFamily.body }}>
                  {citation.summary}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {message.file && (
        <a
          href={message.file.download_url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-2 mt-2 px-3 py-2 rounded-lg ${compact ? '' : 'hover:brightness-110 transition-all'}`}
          style={{
            background: 'var(--lava-wash)',
            border: '1px solid var(--lava-ring)',
            textDecoration: 'none',
          }}
        >
          <Download className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--lava)' }} />
          <div className="flex-1 min-w-0">
            <p
              className={`${compact ? 'text-[11px]' : 'text-xs'} font-semibold truncate`}
              style={{ color: 'var(--lava)', fontFamily: fontFamily.mono }}
            >
              {message.file.name}
            </p>
            <p
              className="text-[9px]"
              style={{ color: 'var(--ink-muted)', fontFamily: fontFamily.mono }}
            >
              {message.file.type} · {Math.round((message.file.size || 0) / 1024)}KB
            </p>
          </div>
        </a>
      )}
    </>
  );
}
