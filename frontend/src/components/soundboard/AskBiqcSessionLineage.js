import React from 'react';
import LineageBadge from '../LineageBadge';
import { normalizeAskBiqcConfidencePercent } from '../../lib/soundboardRuntime';

export default function AskBiqcSessionLineage({
  latestAssistantMessage,
  compact = false,
  className = '',
  testId = 'ask-biqc-session-lineage',
}) {
  if (!latestAssistantMessage) return null;

  const confidencePercent = normalizeAskBiqcConfidencePercent(latestAssistantMessage.confidence_score);
  const hasLineage = latestAssistantMessage.lineage || latestAssistantMessage.data_freshness || confidencePercent != null;

  if (!hasLineage) return null;

  return (
    <div className={className} data-testid={testId}>
      <LineageBadge
        lineage={latestAssistantMessage.lineage}
        data_freshness={latestAssistantMessage.data_freshness}
        confidence_score={confidencePercent ?? undefined}
        compact={compact}
      />
    </div>
  );
}
