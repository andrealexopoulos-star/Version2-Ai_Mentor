import React from 'react';
import { fontFamily } from '../../design-system/tokens';

const VARIANT_STYLES = {
  neutral: { background: 'rgba(148,163,184,0.12)', color: '#CBD5E1' },
  accent: { background: 'rgba(59,130,246,0.12)', color: '#93C5FD' },
  highlight: { background: 'rgba(232,93,0,0.12)', color: '#FFB36B' },
};

function ActionButton({ label, onClick, compact = false, variant = 'neutral', testId }) {
  const palette = VARIANT_STYLES[variant] || VARIANT_STYLES.neutral;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${compact ? 'text-[9px] px-2 py-1' : 'text-[10px] px-2 py-1'} rounded-md`}
      style={{ ...palette, fontFamily: fontFamily.mono }}
      data-testid={testId}
    >
      {label}
    </button>
  );
}

export default function AskBiqcMessageActions({
  role,
  compact = false,
  onEdit,
  onCopy,
  onUseInComposer,
  onRegenerate,
  testIdPrefix = 'ask-biqc-message-action',
}) {
  const actions = role === 'user'
    ? [
        onEdit ? { key: 'edit', label: 'Edit & resend', onClick: onEdit, variant: 'neutral' } : null,
      ].filter(Boolean)
    : [
        onCopy ? { key: 'copy', label: 'Copy', onClick: onCopy, variant: 'neutral' } : null,
        onUseInComposer ? { key: 'composer', label: 'Use in composer', onClick: onUseInComposer, variant: 'highlight' } : null,
        onRegenerate ? { key: 'regenerate', label: 'Regenerate', onClick: onRegenerate, variant: 'accent' } : null,
      ].filter(Boolean);

  if (!actions.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {actions.map((action) => (
        <ActionButton
          key={action.key}
          label={action.label}
          onClick={action.onClick}
          compact={compact}
          variant={action.variant}
          testId={`${testIdPrefix}-${action.key}`}
        />
      ))}
    </div>
  );
}
