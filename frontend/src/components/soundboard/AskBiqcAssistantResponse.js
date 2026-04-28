import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fontFamily } from '../../design-system/tokens';
import { normalizeMessageContent } from '../../lib/soundboardPolicy';
import { normalizeAskBiqcConfidencePercent } from '../../lib/soundboardRuntime';
import AskBiqcMessageActions from './AskBiqcMessageActions';

const SECTION_TITLES = {
  executive: 'Executive answer',
  meaning: 'Commercial meaning',
  nextMove: 'Recommended next move',
};

function formatFreshnessLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Freshness unknown';
  const isoDateLike = /^\d{4}-\d{2}-\d{2}/.test(raw);
  if (isoDateLike) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return `Updated ${parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    }
  }
  if (/^\d+\s*[mhds]$/i.test(raw)) return `Updated ${raw.toLowerCase()} ago`;
  return `Updated ${raw}`;
}

function splitExecutiveSections(rawText) {
  const text = String(rawText || '').trim();
  if (!text) {
    return {
      executive: '',
      meaning: '',
      nextMove: '',
    };
  }

  const lines = text.split('\n');
  const map = {};
  let current = 'executive';

  const headingPattern = /^\s*(?:#{1,4}\s*)?(?:\*\*)?\s*(insight|key insight|finding|observation|decision|recommendation|recommended decision|action|recommended action|next step|do next|impact|business impact|outcome|result|consequence)\s*(?:\*\*)?\s*:?\s*$/i;
  const inlinePattern = /^\s*(?:#{1,4}\s*)?(?:\*\*)?\s*(insight|key insight|finding|observation|decision|recommendation|recommended decision|action|recommended action|next step|do next|impact|business impact|outcome|result|consequence)\s*(?:\*\*)?\s*:\s*(.*)$/i;

  const pickBucket = (heading) => {
    const key = heading.toLowerCase();
    if (/decision|recommendation|action|next step|do next/.test(key)) return 'nextMove';
    if (/impact|outcome|result|consequence/.test(key)) return 'meaning';
    return 'executive';
  };

  lines.forEach((line) => {
    const inline = line.match(inlinePattern);
    if (inline) {
      current = pickBucket(inline[1]);
      map[current] = [...(map[current] || []), inline[2]].filter(Boolean);
      return;
    }
    const heading = line.match(headingPattern);
    if (heading) {
      current = pickBucket(heading[1]);
      return;
    }
    map[current] = [...(map[current] || []), line];
  });

  const executive = (map.executive || []).join('\n').trim();
  const meaning = (map.meaning || []).join('\n').trim();
  const nextMove = (map.nextMove || []).join('\n').trim();
  return { executive, meaning, nextMove };
}

function ExecutiveSection({ title, body }) {
  if (!body) return null;
  return (
    <section className="grid gap-1.5">
      <p
        className="text-[12px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: 'var(--ink-muted, #737373)', fontFamily: fontFamily.body }}
      >
        {title}
      </p>
      <div
        className="markdown-body text-[14px]"
        style={{ color: 'var(--ink, #171717)', lineHeight: 1.65, fontFamily: fontFamily.body }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
    </section>
  );
}

function EvidenceList({ citations, evidenceSources }) {
  const hasCitations = Array.isArray(citations) && citations.length > 0;
  const hasSources = Array.isArray(evidenceSources) && evidenceSources.length > 0;
  if (!hasCitations && !hasSources) {
    return (
      <p className="text-[13px]" style={{ color: 'var(--ink-secondary, #525252)', fontFamily: fontFamily.body }}>
        No source citations are available for this response.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {hasCitations && (
        <div className="grid gap-1.5">
          {citations.slice(0, 5).map((citation, index) => (
            <div
              key={`citation-${index}`}
              className="rounded-lg px-3 py-2"
              style={{
                background: 'var(--surface-sunken, #F5F5F5)',
                border: '1px solid var(--border, rgba(10,10,10,0.08))',
              }}
            >
              <p className="text-[12px] font-semibold" style={{ color: 'var(--ink-secondary, #525252)', fontFamily: fontFamily.body }}>
                {citation.ref || `Source ${index + 1}`} · {citation.source || 'Connected source'}
              </p>
              {citation.summary && (
                <p className="text-[13px] mt-1" style={{ color: 'var(--ink, #171717)', fontFamily: fontFamily.body }}>
                  {citation.summary}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {hasSources && (
        <div className="flex flex-wrap gap-2">
          {evidenceSources.slice(0, 6).map((source, index) => (
            <span
              key={`${source?.source || 'source'}-${index}`}
              className="px-2.5 py-1 rounded-full text-[12px]"
              style={{
                background: 'rgba(148,163,184,0.14)',
                color: 'var(--ink-secondary, #525252)',
                border: '1px solid rgba(148,163,184,0.28)',
                fontFamily: fontFamily.body,
              }}
            >
              {source.source}
              {source.freshness ? ` · ${source.freshness}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
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
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const safeMessage = message && typeof message === 'object' ? message : {};
  const role = safeMessage.role;

  const contentText = normalizeMessageContent(message.content ?? message.text);
  const confidencePercent = normalizeAskBiqcConfidencePercent(safeMessage.confidence_score);
  const evidenceSources = (safeMessage.evidence_pack?.sources || []).filter(
    (source) => String(source?.source || '').trim().toLowerCase() !== 'unknown'
  );
  const dataSourcesCount = typeof safeMessage.data_sources_count === 'number'
    ? safeMessage.data_sources_count
    : evidenceSources.length;
  const freshnessLabel = formatFreshnessLabel(safeMessage.data_freshness);
  const retrievalContract = useMemo(() => safeMessage.retrieval_contract || {}, [safeMessage.retrieval_contract]);
  const forensicReport = useMemo(() => safeMessage.forensic_report || {}, [safeMessage.forensic_report]);
  const generationContract = useMemo(() => safeMessage.generation_contract || {}, [safeMessage.generation_contract]);

  const sections = useMemo(() => splitExecutiveSections(contentText), [contentText]);
  const suggestedActions = Array.isArray(safeMessage.suggested_actions) ? safeMessage.suggested_actions.slice(0, 3) : [];
  const primaryAction = suggestedActions[0] || null;
  const secondaryActions = suggestedActions.slice(1, 3);

  const exportRequestedByPrompt = /\b(export|download|file|pdf|docx|csv|ppt|powerpoint)\b/i.test(contentText);
  const canInlineExport = Boolean(
    contentText.trim()
    && (
      generationContract.requested
      || retrievalContract.report_grade_request
      || exportRequestedByPrompt
    )
  );

  const advancedRows = useMemo(() => {
    const rows = [];
    if (retrievalContract.retrieval_mode) rows.push(`Retrieval mode: ${retrievalContract.retrieval_mode}`);
    if (retrievalContract.canonical_retrieval_mode) rows.push(`Canonical retrieval mode: ${retrievalContract.canonical_retrieval_mode}`);
    if (retrievalContract.answer_grade) rows.push(`Answer grade: ${retrievalContract.answer_grade}`);
    if (retrievalContract.history_truncated) rows.push('History truncated: true');
    if (Number(retrievalContract.crm_pages_fetched || 0) > 0 || Number(retrievalContract.accounting_pages_fetched || 0) > 0) {
      rows.push(`Pages fetched CRM:${Number(retrievalContract.crm_pages_fetched || 0)} ACC:${Number(retrievalContract.accounting_pages_fetched || 0)}`);
    }
    if (retrievalContract.materialization_attempted) rows.push(`Signal heal count: +${Number(retrievalContract.signals_emitted_on_demand || 0)}`);
    if (retrievalContract.quality_eval?.latency_slo_ms_target) rows.push(`SLO target: ${Number(retrievalContract.quality_eval.latency_slo_ms_target)}ms`);
    if (retrievalContract.quality_eval?.latency_slo_breached) rows.push('SLO breached: true');
    if (generationContract.requested) rows.push(`Generation contract: ${generationContract.artifact_type || 'analysis'}`);
    if (generationContract.requested && generationContract.tier_allowed === false) {
      rows.push(`Export tier: ${generationContract.required_tier || 'starter'}+`);
    }
    if (safeMessage.boardroom_status === 'fallback_error') rows.push('Boardroom degraded mode');
    if (safeMessage.boardroom_trace?.phases?.length) rows.push('Boardroom orchestration phases available');
    if (forensicReport.mode_active && retrievalContract.answer_grade && retrievalContract.answer_grade !== 'FULL') {
      rows.push(`Forensic report limited: ${retrievalContract.answer_grade}`);
    }
    return rows;
  }, [forensicReport.mode_active, generationContract, retrievalContract, safeMessage.boardroom_status, safeMessage.boardroom_trace?.phases?.length]);

  if (role !== 'assistant') return null;

  return (
    <div
      className={`grid ${compact ? 'gap-2.5' : 'gap-3'} rounded-2xl`}
      data-testid="ask-biqc-executive-card"
      style={{
        padding: compact ? '12px' : '16px',
        background: 'var(--surface, #FFFFFF)',
        border: '1px solid var(--border, rgba(10,10,10,0.08))',
      }}
    >
      <ExecutiveSection title={SECTION_TITLES.executive} body={sections.executive || contentText} />
      <ExecutiveSection title={SECTION_TITLES.meaning} body={sections.meaning} />
      <ExecutiveSection title={SECTION_TITLES.nextMove} body={sections.nextMove} />

      {primaryAction && (
        <button
          type="button"
          onClick={() => onSuggestedAction?.(primaryAction.prompt || primaryAction.label)}
          className={`${compact ? 'px-3 py-2 text-[13px]' : 'px-3.5 py-2 text-[14px]'} rounded-xl text-left`}
          style={{
            background: 'var(--lava-wash, rgba(232,93,0,0.12))',
            border: '1px solid var(--lava-ring, rgba(232,93,0,0.32))',
            color: 'var(--lava, #E85D00)',
            fontFamily: fontFamily.body,
            fontWeight: 600,
          }}
          data-testid={`${actionTestIdPrefix}-primary-suggested`}
        >
          {primaryAction.label || primaryAction.prompt}
        </button>
      )}

      <div
        className="flex flex-wrap items-center gap-2.5"
        style={{
          padding: compact ? '8px 10px' : '9px 12px',
          background: 'var(--surface-sunken, #F5F5F5)',
          border: '1px solid var(--border, rgba(10,10,10,0.08))',
          borderRadius: 12,
        }}
      >
        <span className="text-[12px]" style={{ color: 'var(--ink-secondary, #525252)', fontFamily: fontFamily.body }}>
          {confidencePercent != null ? `Confidence ${confidencePercent.toFixed(0)}%` : 'Confidence unknown'}
        </span>
        <span className="text-[12px]" style={{ color: 'var(--ink-secondary, #525252)', fontFamily: fontFamily.body }}>
          {dataSourcesCount} source{dataSourcesCount === 1 ? '' : 's'}
        </span>
        <span className="text-[12px]" style={{ color: 'var(--ink-secondary, #525252)', fontFamily: fontFamily.body }}>
          {freshnessLabel}
        </span>
        <button
          type="button"
          onClick={() => setShowEvidence((value) => !value)}
          className="text-[12px] underline underline-offset-2"
          style={{ color: 'var(--lava, #E85D00)', fontFamily: fontFamily.body }}
          data-testid={`${actionTestIdPrefix}-view-evidence`}
        >
          {showEvidence ? 'Hide evidence' : 'View evidence'}
        </button>
      </div>

      {showEvidence && (
        <div
          className="grid gap-2 rounded-xl"
          style={{
            padding: compact ? '10px' : '12px',
            background: 'var(--surface, #FFFFFF)',
            border: '1px solid var(--border, rgba(10,10,10,0.08))',
          }}
          data-testid="ask-biqc-evidence-panel"
        >
          <EvidenceList citations={forensicReport.citations || []} evidenceSources={evidenceSources} />

          {safeMessage.coverage_window?.missing_periods?.length > 0 && (
            <p className="text-[12px]" style={{ color: 'var(--warning, #D97706)', fontFamily: fontFamily.body }}>
              Data gap detected: {safeMessage.coverage_window.missing_periods[0]}
            </p>
          )}

          {advancedRows.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvanced((value) => !value)}
                className="text-[12px] underline underline-offset-2"
                style={{ color: 'var(--ink-secondary, #525252)', fontFamily: fontFamily.body }}
                data-testid={`${actionTestIdPrefix}-advanced-toggle`}
              >
                {showAdvanced ? 'Hide advanced details' : 'Show advanced details'}
              </button>
              {showAdvanced && (
                <div
                  className="mt-2 rounded-lg px-3 py-2 grid gap-1"
                  style={{
                    background: 'var(--surface-sunken, #F5F5F5)',
                    border: '1px solid var(--border, rgba(10,10,10,0.08))',
                  }}
                  data-testid="ask-biqc-advanced-details"
                >
                  {advancedRows.map((row) => (
                    <p key={row} className="text-[12px]" style={{ color: 'var(--ink-secondary, #525252)', fontFamily: fontFamily.body }}>
                      {row}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {secondaryActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {secondaryActions.map((action, index) => (
            <button
              key={`${action.action || action.label || 'action'}-${index}`}
              type="button"
              onClick={() => onSuggestedAction?.(action.prompt || action.label)}
              className="px-3 py-1.5 rounded-full text-[12px]"
              style={{
                background: 'rgba(148,163,184,0.12)',
                border: '1px solid rgba(148,163,184,0.25)',
                color: 'var(--ink-secondary, #525252)',
                fontFamily: fontFamily.body,
              }}
              data-testid={`${actionTestIdPrefix}-secondary-suggested-${index}`}
            >
              {action.label || action.prompt}
            </button>
          ))}
        </div>
      )}

      <AskBiqcMessageActions
        role="assistant"
        compact={compact}
        onCopy={onCopy}
        onUseInComposer={onUseInComposer}
        onRegenerate={onRegenerate}
        extraActions={canInlineExport ? [{
          key: 'export-inline',
          label: 'Export response',
          variant: 'neutral',
          onClick: () => {
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
          },
        }] : []}
        testIdPrefix={actionTestIdPrefix}
      />

      {message.file && (
        <a
          href={message.file.download_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg w-fit"
          style={{
            background: 'rgba(148,163,184,0.12)',
            border: '1px solid rgba(148,163,184,0.25)',
            textDecoration: 'none',
            color: 'var(--ink-secondary, #525252)',
            fontFamily: fontFamily.body,
          }}
          data-testid={`${actionTestIdPrefix}-file-download`}
        >
          <Download className="w-3.5 h-3.5" />
          <span className="text-[12px]">
            Download file: {message.file.name}
          </span>
        </a>
      )}
    </div>
  );
}
