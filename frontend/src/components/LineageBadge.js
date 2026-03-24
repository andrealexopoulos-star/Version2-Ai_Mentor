/**
 * Compact lineage/source line for intelligence cards. Phase 1.4 — surface provenance everywhere.
 * Use on every intelligence block that has lineage, data_freshness, or connected_sources.
 */
import React from 'react';
import { Database, Clock } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';

/**
 * @param {{ lineage?: { connected_sources?: string[] }, data_freshness?: string, confidence_score?: number } | null} props
 */
export function LineageBadge({ lineage, data_freshness, confidence_score, className = '', compact = false }) {
  const rawSources = lineage?.connected_sources_list || lineage?.connected_sources;
  const sources = Array.isArray(rawSources)
    ? rawSources
    : (rawSources && typeof rawSources === 'object'
      ? Object.keys(rawSources).filter((key) => Boolean(rawSources[key]))
      : []);
  const hasSources = sources.length > 0;
  const freshness = data_freshness || lineage?.last_updated;
  const confidence = confidence_score != null ? Number(confidence_score) : null;

  if (!hasSources && !freshness && confidence == null) return null;

  const sourceText = hasSources ? sources.slice(0, 3).join(', ') : 'BIQc';
  const freshnessText = freshness ? (typeof freshness === 'string' && /^\d+[mhd]$/i.test(freshness.trim())
    ? `${freshness.trim()} ago`
    : freshness) : null;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] ${className}`}
        style={{ color: '#64748B', fontFamily: fontFamily.mono }}
        title={hasSources ? `From ${sourceText}${freshness ? ` • ${freshness}` : ''}` : undefined}
      >
        {hasSources && <Database className="w-2.5 h-2.5 flex-shrink-0" />}
        {hasSources && <span className="truncate max-w-[120px]">{sourceText}</span>}
        {freshnessText && <><Clock className="w-2.5 h-2.5 flex-shrink-0 ml-0.5" /><span>{freshnessText}</span></>}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] ${className}`}
      style={{ color: '#64748B', fontFamily: fontFamily.mono }}
    >
      {hasSources && (
        <span className="inline-flex items-center gap-1">
          <Database className="w-3 h-3 flex-shrink-0" style={{ color: '#64748B' }} />
          From {sourceText}
        </span>
      )}
      {freshnessText && (
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3 h-3 flex-shrink-0" style={{ color: '#64748B' }} />
          {freshnessText}
        </span>
      )}
      {confidence != null && confidence >= 0 && (
        <span style={{ color: confidence >= 70 ? '#10B981' : confidence >= 40 ? '#F59E0B' : '#64748B' }}>
          {confidence >= 70 ? 'High' : confidence >= 40 ? 'Medium' : 'Low'} confidence
        </span>
      )}
    </div>
  );
}

export default LineageBadge;
