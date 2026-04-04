import React from 'react';
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

      {evidenceSources.length > 0 && (
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

      {message.coverage_window && (
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

      {message.boardroom_trace?.phases?.length > 0 && (
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

      {message.boardroom_status === 'fallback_error' && (
        <div className="mt-2">
          <Chip style={{ background: compact ? '#F59E0B15' : 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
            Boardroom degraded mode
          </Chip>
        </div>
      )}

      {directSources.length > 0 && compact && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {directSources.map((source, index) => (
            <Chip key={`${source}-${index}`} style={{ background: '#10B98110', color: '#10B981' }}>
              {source}
            </Chip>
          ))}
        </div>
      )}

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
