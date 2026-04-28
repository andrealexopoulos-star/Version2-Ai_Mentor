import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';

const VARIANT_STYLES = {
  neutral: { background: 'rgba(148,163,184,0.12)', color: 'var(--ink-secondary, #525252)' },
  accent: { background: 'rgba(232,93,0,0.12)', color: 'var(--lava, #E85D00)' },
};

function ActionButton({ label, onClick, compact = false, variant = 'neutral', testId }) {
  const palette = VARIANT_STYLES[variant] || VARIANT_STYLES.neutral;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${compact ? 'text-[11px] px-2.5 py-1.5' : 'text-xs px-3 py-1.5'} rounded-lg text-left`}
      style={{ ...palette, fontFamily: fontFamily.body, width: '100%' }}
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
  extraActions = [],
  testIdPrefix = 'ask-biqc-message-action',
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handlePointer = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointer);
    return () => window.removeEventListener('pointerdown', handlePointer);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [role, compact]);

  const actions = role === 'user'
    ? [
        onEdit ? { key: 'edit', label: 'Edit & resend', onClick: onEdit, variant: 'neutral' } : null,
      ].filter(Boolean)
    : [
        onCopy ? { key: 'copy', label: 'Copy', onClick: onCopy, variant: 'neutral' } : null,
        onUseInComposer ? { key: 'composer', label: 'Use in composer', onClick: onUseInComposer, variant: 'neutral' } : null,
        onRegenerate ? { key: 'regenerate', label: 'Regenerate', onClick: onRegenerate, variant: 'accent' } : null,
        ...extraActions.filter(Boolean),
      ].filter(Boolean);

  if (!actions.length) return null;

  return (
    <div className="mt-2 flex justify-end">
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          className={`${compact ? 'h-7 w-7' : 'h-8 w-8'} inline-flex items-center justify-center rounded-full transition-colors`}
          style={{
            color: 'var(--ink-secondary, #525252)',
            background: menuOpen ? 'rgba(10,10,10,0.08)' : 'transparent',
            border: '1px solid rgba(10,10,10,0.1)',
          }}
          data-testid={`${testIdPrefix}-overflow-toggle`}
          aria-label="Message actions"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 mt-1.5 w-44 rounded-xl p-1.5 z-20"
            style={{
              background: 'var(--surface, #FFFFFF)',
              border: '1px solid var(--border, rgba(10,10,10,0.1))',
              boxShadow: '0 8px 22px rgba(15,23,42,0.12)',
            }}
            data-testid={`${testIdPrefix}-overflow-menu`}
          >
            <div className="grid gap-1">
              {actions.map((action) => (
                <ActionButton
                  key={action.key}
                  label={action.label}
                  onClick={() => {
                    setMenuOpen(false);
                    action.onClick?.();
                  }}
                  compact={compact}
                  variant={action.variant}
                  testId={`${testIdPrefix}-${action.key}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
