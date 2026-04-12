import React from 'react';

const statusColor = (status) => {
  if (status === 'ready') return '#10B981';
  if (status === 'partial') return '#F59E0B';
  if (status === 'stale') return '#F97316';
  if (status === 'empty') return '#EF4444';
  return '#94A3B8';
};

const normalizeConfidence = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(1, numeric));
};

const SemanticContractBanner = ({ payload, title = 'Data Contract' }) => {
  if (!payload || typeof payload !== 'object') return null;

  const dataStatus = String(payload.data_status || '').toLowerCase();
  const confidence = normalizeConfidence(payload.confidence_score);
  const lookbackTarget = Number(payload.lookback_days_target);
  const lookbackEffective = Number(payload.lookback_days_effective);
  const missingPeriods = Array.isArray(payload.missing_periods) ? payload.missing_periods : [];
  const actions = Array.isArray(payload.next_best_actions) ? payload.next_best_actions : [];

  if (!dataStatus && confidence === null && missingPeriods.length === 0 && actions.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-xl border px-4 py-3 space-y-2"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}
      data-testid="semantic-contract-banner"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: '#94A3B8' }}>
          {title}
        </p>
        {dataStatus && (
          <span
            className="text-[11px] px-2 py-0.5 rounded-full uppercase tracking-[0.08em]"
            style={{ background: `${statusColor(dataStatus)}20`, color: statusColor(dataStatus) }}
          >
            {dataStatus}
          </span>
        )}
      </div>
      <div className="grid gap-2 md:grid-cols-3 text-xs">
        <div style={{ color: '#CBD5E1' }}>
          Confidence:{' '}
          <strong style={{ color: '#EDF1F7' }}>
            {confidence === null ? 'n/a' : `${Math.round(confidence * 100)}%`}
          </strong>
        </div>
        <div style={{ color: '#CBD5E1' }}>
          Lookback:{' '}
          <strong style={{ color: '#EDF1F7' }}>
            {Number.isFinite(lookbackEffective) ? lookbackEffective : 'n/a'} / {Number.isFinite(lookbackTarget) ? lookbackTarget : 'n/a'} days
          </strong>
        </div>
        <div style={{ color: '#CBD5E1' }}>
          Backfill:{' '}
          <strong style={{ color: '#EDF1F7' }}>{payload.backfill_state || 'none'}</strong>
        </div>
      </div>
      {payload.confidence_reason && (
        <p className="text-xs" style={{ color: '#94A3B8' }}>
          {payload.confidence_reason}
        </p>
      )}
      {missingPeriods.length > 0 && (
        <p className="text-xs" style={{ color: '#FCA5A5' }}>
          Gaps: {missingPeriods.slice(0, 2).join(' | ')}
        </p>
      )}
      {actions.length > 0 && (
        <p className="text-xs" style={{ color: '#FFB17A' }}>
          Next: {actions[0]}
        </p>
      )}
    </div>
  );
};

export default SemanticContractBanner;
