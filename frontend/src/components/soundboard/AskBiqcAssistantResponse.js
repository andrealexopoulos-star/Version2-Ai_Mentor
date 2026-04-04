import React, { useState } from 'react';
import { Database, Download } from 'lucide-react';
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
  if (!message || message.role !== 'assistant') return null;

  const confidencePercent = normalizeAskBiqcConfidencePercent(message.confidence_score);
  const evidenceSources = (message.evidence_pack?.sources || []).filter(
    (source) => String(source?.source || '').trim().toLowerCase() !== 'unknown'
  );
  const directSources = (message.sources || []).filter(
    (source) => String(source || '').trim().toLowerCase() !== 'unknown'
  );
  const retrievalContract = message.retrieval_contract || {};
  const forensicReport = message.forensic_report || {};
  const [showDetails, setShowDetails] = useState(false);
  const hasAdvancedDetails = Boolean(
    evidenceSources.length > 0
    || message.coverage_window
    || message.boardroom_trace?.phases?.length
    || message.boardroom_status === 'fallback_error'
    || (forensicReport.mode_active && retrievalContract.answer_grade)
    || (Array.isArray(forensicReport.contradictions) && forensicReport.contradictions.length > 0)
    || directSources.length > 0
    || confidencePercent != null
    || typeof message.data_sources_count === 'number'
    || message.data_freshness
    || retrievalContract.retrieval_mode
    || retrievalContract.answer_grade
    || retrievalContract.history_truncated
    || Number(retrievalContract.crm_pages_fetched || 0) > 0
    || Number(retrievalContract.accounting_pages_fetched || 0) > 0
    || retrievalContract.materialization_attempted
    || message.advisory_slots?.kpi_note
    || (typeof message.response_version === 'number' && message.response_version > 1)
    || (Array.isArray(forensicReport.citations) && forensicReport.citations.length > 0)
  );

  return (
    <>
      {message.agent_name && (
        <p className="text-[10px] font-medium mb-1" style={{ color: compact ? '#93C5FD' : '#3B82F6', fontFamily: fontFamily.mono }}>
          {message.agent_name}
        </p>
      )}
      {message.type === 'integration_prompt' && <Database className="w-3.5 h-3.5 text-[#F59E0B] inline mr-1.5 -mt-0.5" />}
      <p className={`${compact ? 'text-sm' : 'text-sm'} whitespace-pre-wrap leading-relaxed`}>
        {normalizeMessageContent(message.content ?? message.text)}
      </p>

      <AskBiqcMessageActions
        role="assistant"
        compact={compact}
        onCopy={onCopy}
        onUseInComposer={onUseInComposer}
        onRegenerate={onRegenerate}
        testIdPrefix={actionTestIdPrefix}
      />
      {hasAdvancedDetails && (
        <button
          type="button"
          className="mt-2 text-[10px] underline-offset-2 hover:underline"
          style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}
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
              style={{ background: 'rgba(255,106,0,0.1)', border: '1px solid rgba(255,106,0,0.25)', color: '#FF6A00', fontFamily: fontFamily.mono }}
              data-testid={`${actionTestIdPrefix}-suggested-${index}`}
            >
              <span>→</span>
              <span>{action.label || action.prompt}</span>
            </button>
          ))}
        </div>
      )}

      {message.intent?.domain && message.intent.domain !== 'general' && (
        <div className="mt-2">
          <Chip style={{ background: 'rgba(255,255,255,0.05)', color: compact ? '#64748B' : '#4A5568' }}>
            {message.intent.domain.toUpperCase()} · {message.model_used || 'AI'}
          </Chip>
        </div>
      )}

      {showDetails && evidenceSources.length > 0 && (
        <div className={`mt-2 flex flex-wrap ${compact ? 'gap-1' : 'gap-1.5'}`} data-testid={evidenceTestId}>
          {evidenceSources.slice(0, 5).map((source) => (
            <Chip
              key={source.id || source.source}
              style={{ background: compact ? '#8B5CF610' : 'rgba(139,92,246,0.12)', color: '#A78BFA' }}
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
            background: compact ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.45)',
            border: compact ? '1px solid rgba(148,163,184,0.2)' : '1px solid rgba(148,163,184,0.25)',
          }}
        >
          <p className={`${compact ? 'text-[9px] uppercase tracking-wider mb-1' : 'text-[10px] mb-1'}`} style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}>
            Coverage window
          </p>
          <p className="text-[10px]" style={{ color: '#CBD5E1', fontFamily: fontFamily.mono }}>
            {(message.coverage_window.coverage_start || 'n/a')} {compact ? '→' : '->'} {(message.coverage_window.coverage_end || 'n/a')}
          </p>
          <p className="text-[10px]" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
            last sync: {message.coverage_window.last_sync_at || 'n/a'} · {compact ? 'confidence impact' : 'impact'}: {message.coverage_window.confidence_impact || 'unknown'}
          </p>
          {Array.isArray(message.coverage_window.missing_periods) && message.coverage_window.missing_periods.length > 0 && (
            <p className="text-[10px]" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>
              gap: {message.coverage_window.missing_periods[0]}
            </p>
          )}
        </div>
      )}

      {showDetails && message.boardroom_trace?.phases?.length > 0 && (
        <div
          className={compact ? 'flex gap-1 mt-2 flex-wrap' : 'mt-2 rounded-lg p-2'}
          style={compact ? undefined : { border: '1px solid rgba(59,130,246,0.25)', background: 'rgba(2,6,23,0.45)' }}
        >
          {!compact && (
            <p className="text-[10px] mb-1" style={{ color: '#60A5FA', fontFamily: fontFamily.mono }}>
              Boardroom orchestration
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            {message.boardroom_trace.phases.slice(0, compact ? 4 : 6).map((phase, index) => (
              <Chip
                key={`${phase.phase}-${phase.role || index}`}
                style={{
                  background: compact ? '#3B82F615' : 'rgba(59,130,246,0.16)',
                  color: compact ? '#93C5FD' : '#BFDBFE',
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
          <Chip style={{ background: compact ? '#F59E0B15' : 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
            Boardroom degraded mode
          </Chip>
        </div>
      )}
      {showDetails && forensicReport.mode_active && retrievalContract.answer_grade && retrievalContract.answer_grade !== 'FULL' && (
        <div className="mt-2" data-testid="ask-biqc-forensic-banner">
          <Chip style={{ background: 'rgba(245,158,11,0.18)', color: '#FCD34D' }}>
            Forensic report limited: {retrievalContract.answer_grade}
          </Chip>
        </div>
      )}
      {showDetails && Array.isArray(forensicReport.contradictions) && forensicReport.contradictions.length > 0 && (
        <div
          className={`${compact ? 'mt-2 rounded-lg px-2 py-1.5' : 'mt-2 rounded-lg p-2'}`}
          style={{ background: 'rgba(2,6,23,0.42)', border: '1px solid rgba(148,163,184,0.2)' }}
          data-testid="ask-biqc-forensic-contradictions"
        >
          <p className={`${compact ? 'text-[9px]' : 'text-[10px]'} mb-1`} style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}>
            Contradictions
          </p>
          {forensicReport.contradictions.slice(0, 3).map((item, index) => (
            <p key={`forensic-contradiction-${index}`} className="text-[10px]" style={{ color: '#CBD5E1', fontFamily: fontFamily.mono }}>
              - {item.role || 'source'}: {item.contradiction || 'n/a'}
            </p>
          ))}
        </div>
      )}

      {showDetails && directSources.length > 0 && compact && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {directSources.map((source, index) => (
            <Chip key={`${source}-${index}`} style={{ background: '#10B98110', color: '#10B981' }}>
              {source}
            </Chip>
          ))}
        </div>
      )}

      {showDetails && (
        <div className="mt-2 flex flex-wrap gap-1.5" data-testid={metadataTestId}>
        {confidencePercent != null && (
          <Chip
            style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}
            testId={`${metadataTestId}-confidence`}
          >
            confidence {confidencePercent.toFixed(0)}%
          </Chip>
        )}
        {typeof message.data_sources_count === 'number' && (
          <Chip
            style={{ background: 'rgba(59,130,246,0.12)', color: '#60A5FA' }}
            testId={`${metadataTestId}-sources`}
          >
            {message.data_sources_count} sources
          </Chip>
        )}
        {message.data_freshness && (
          <Chip
            style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}
            testId={`${metadataTestId}-freshness`}
          >
            freshness {message.data_freshness}
          </Chip>
        )}
        {retrievalContract.retrieval_mode && (
          <Chip
            style={{ background: 'rgba(99,102,241,0.16)', color: '#A5B4FC' }}
            testId={`${metadataTestId}-retrieval-mode`}
          >
            retrieval {retrievalContract.retrieval_mode}
          </Chip>
        )}
        {retrievalContract.answer_grade && (
          <Chip
            style={{ background: 'rgba(236,72,153,0.14)', color: '#F9A8D4' }}
            testId={`${metadataTestId}-answer-grade`}
          >
            grade {retrievalContract.answer_grade}
          </Chip>
        )}
        {retrievalContract.history_truncated && (
          <Chip
            style={{ background: 'rgba(245,158,11,0.16)', color: '#FCD34D' }}
            testId={`${metadataTestId}-history-truncated`}
          >
            history truncated
          </Chip>
        )}
        {(Number(retrievalContract.crm_pages_fetched || 0) > 0 || Number(retrievalContract.accounting_pages_fetched || 0) > 0) && (
          <Chip
            style={{ background: 'rgba(56,189,248,0.14)', color: '#7DD3FC' }}
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
                style={{ background: 'rgba(45,212,191,0.12)', color: '#5EEAD4' }}
                testId={`${metadataTestId}-${testSuffix}`}
              >
                {text}
              </Chip>
            );
          });
        })()}
        {retrievalContract.materialization_attempted && (
          <Chip
            style={{ background: 'rgba(34,197,94,0.14)', color: '#86EFAC' }}
            testId={`${metadataTestId}-materialization`}
          >
            signal heal +{Number(retrievalContract.signals_emitted_on_demand || 0)}
          </Chip>
        )}
        {message.advisory_slots?.kpi_note && (
          <Chip
            style={{ background: compact ? '#8B5CF615' : 'rgba(139,92,246,0.12)', color: '#C4B5FD' }}
            testId={`${metadataTestId}-kpi`}
          >
            KPI note
          </Chip>
        )}
        {typeof message.response_version === 'number' && message.response_version > 1 && (
          <Chip
            style={{ background: 'rgba(148,163,184,0.12)', color: '#CBD5E1' }}
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
              style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}
            >
              <p className="text-[10px]" style={{ color: '#C7D2FE', fontFamily: fontFamily.mono }}>
                {citation.ref || `S${index + 1}`} · {citation.source || 'source'} {citation.source_id ? `(${citation.source_id})` : ''}
              </p>
              {citation.summary && (
                <p className="text-[10px]" style={{ color: '#CBD5E1', fontFamily: fontFamily.body }}>
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
          style={{ background: '#FF6A0015', border: '1px solid #FF6A0030', textDecoration: 'none' }}
        >
          <Download className="w-3.5 h-3.5 text-[#FF6A00] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className={`${compact ? 'text-[11px]' : 'text-xs'} font-semibold truncate`} style={{ color: '#FF6A00', fontFamily: fontFamily.mono }}>
              {message.file.name}
            </p>
            <p className="text-[9px]" style={{ color: compact ? '#64748B' : 'var(--text-muted)', fontFamily: fontFamily.mono }}>
              {message.file.type} · {Math.round((message.file.size || 0) / 1024)}KB
            </p>
          </div>
        </a>
      )}
    </>
  );
}
