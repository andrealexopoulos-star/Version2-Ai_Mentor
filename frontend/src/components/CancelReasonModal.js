// Sprint B #18 (2026-04-22): cancel-reason capture before Stripe portal.
// Shown when a user clicks "Manage Subscription" / "Update card" / "Open portal".
// Enhancement, not a gate: submit, skip, or close — portal redirect still happens.
//
// Keys must stay in sync with backend ALLOWED_CANCEL_REASONS (routes/billing.py)
// and the DB CHECK constraint in supabase/migrations/120_cancel_reasons.sql.

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';

const REASONS = [
  { key: 'too_expensive',    label: 'Too expensive' },
  { key: 'not_enough_value', label: 'Not enough value yet' },
  { key: 'missing_feature',  label: 'Missing a feature I need' },
  { key: 'switching_tool',   label: 'Switching to another tool' },
  { key: 'pausing',          label: 'Just pausing for now' },
  { key: 'other',            label: 'Other' },
];

const cardStyle = {
  background: 'var(--surface, #fff)',
  border: '1px solid var(--border, rgba(10,10,10,0.08))',
  borderRadius: 20,
  boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
  width: '90%',
  maxWidth: 520,
  overflow: 'hidden',
  position: 'relative',
};

export default function CancelReasonModal({ isOpen, onClose, onProceed, submitting }) {
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  const submit = async () => {
    if (!selected) return;
    await onProceed({ reason_key: selected, note: note.trim() || null });
  };

  const skip = async () => {
    await onProceed(null);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(10,10,10,0.5)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'grid', placeItems: 'center', zIndex: 1000,
      }}
      onClick={submitting ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-reason-heading"
    >
      <div onClick={(e) => e.stopPropagation()} style={cardStyle}>
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close"
          style={{
            position: 'absolute', top: 16, right: 16,
            width: 32, height: 32, borderRadius: 8,
            display: 'grid', placeItems: 'center',
            color: 'var(--ink-muted, #737373)',
            background: 'transparent', border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div style={{ padding: '24px 24px 8px' }}>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)',
            color: 'var(--lava, #E85D00)', marginBottom: 8,
          }}>— Before you go</p>
          <h2
            id="cancel-reason-heading"
            style={{
              fontFamily: 'var(--font-display)', fontSize: 22,
              color: 'var(--ink-display, #0A0A0A)', letterSpacing: '-0.01em',
              lineHeight: 1.25, marginBottom: 8,
            }}
          >
            Sorry to see you go. Mind telling us why?
          </h2>
          <p style={{
            fontFamily: 'var(--font-ui)', fontSize: 13,
            color: 'var(--ink-secondary, #525252)', lineHeight: 1.5,
          }}>
            One click. It helps us make BIQc better for the next owner like you.
          </p>
        </div>

        {/* Reason options */}
        <div style={{ padding: '12px 24px 8px', display: 'flex', flexDirection: 'column', gap: 8 }} role="radiogroup" aria-labelledby="cancel-reason-heading">
          {REASONS.map((r) => {
            const active = selected === r.key;
            return (
              <label
                key={r.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px',
                  border: `1px solid ${active ? 'var(--lava, #E85D00)' : 'var(--border, rgba(10,10,10,0.08))'}`,
                  borderRadius: 10,
                  background: active ? 'var(--lava-wash, #FFF1E6)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 160ms ease',
                }}
              >
                <input
                  type="radio"
                  name="cancel_reason"
                  value={r.key}
                  checked={active}
                  onChange={() => setSelected(r.key)}
                  disabled={submitting}
                  style={{ accentColor: 'var(--lava, #E85D00)' }}
                />
                <span style={{
                  fontFamily: 'var(--font-ui)', fontSize: 14,
                  color: 'var(--ink-display, #0A0A0A)',
                }}>{r.label}</span>
              </label>
            );
          })}
        </div>

        {/* Optional note */}
        <div style={{ padding: '8px 24px 16px' }}>
          <label
            htmlFor="cancel-reason-note"
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              textTransform: 'uppercase', letterSpacing: 'var(--ls-caps, 0.08em)',
              color: 'var(--ink-muted, #737373)', display: 'block', marginBottom: 6,
            }}
          >
            Anything else? (optional)
          </label>
          <textarea
            id="cancel-reason-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 2000))}
            disabled={submitting}
            rows={3}
            placeholder="Open text — what would have kept you here?"
            style={{
              width: '100%',
              fontFamily: 'var(--font-ui)', fontSize: 13,
              padding: '10px 12px',
              border: '1px solid var(--border, rgba(10,10,10,0.12))',
              borderRadius: 8, resize: 'vertical',
              background: 'var(--surface, #fff)',
              color: 'var(--ink-display, #0A0A0A)',
            }}
          />
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--ink-muted, #737373)', marginTop: 4, textAlign: 'right',
          }}>{note.length} / 2000</p>
        </div>

        {/* CTAs */}
        <div style={{
          padding: '8px 24px 20px',
          display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end',
        }}>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            style={{
              fontFamily: 'var(--font-ui)', fontSize: 13,
              borderColor: 'var(--border, rgba(10,10,10,0.12))',
              color: 'var(--ink-display, #0A0A0A)',
              borderRadius: 'var(--r-md, 8px)',
            }}
          >
            Never mind, I'll stay
          </Button>
          <Button
            onClick={submit}
            disabled={!selected || submitting}
            style={{
              fontFamily: 'var(--font-ui)', fontSize: 13,
              background: 'var(--lava, #E85D00)',
              color: 'var(--ink-inverse, #fff)',
              borderRadius: 'var(--r-md, 8px)',
              border: 'none',
              opacity: (!selected || submitting) ? 0.6 : 1,
            }}
          >
            {submitting ? 'Opening...' : 'Continue to Stripe'}
          </Button>
        </div>

        {/* Skip link */}
        <div style={{
          padding: '0 24px 20px', textAlign: 'center',
          borderTop: '1px solid var(--border, rgba(10,10,10,0.06))',
          marginTop: 4, paddingTop: 14,
        }}>
          <button
            type="button"
            onClick={skip}
            disabled={submitting}
            style={{
              background: 'transparent', border: 'none',
              fontFamily: 'var(--font-ui)', fontSize: 12,
              color: 'var(--ink-muted, #737373)',
              textDecoration: 'underline',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            Continue without answering
          </button>
        </div>
      </div>
    </div>
  );
}
