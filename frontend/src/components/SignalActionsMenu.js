/**
 * SignalActionsMenu
 * -----------------
 * Sprint B #17 Phase 2 (2026-04-22) — row-level snooze + structured feedback.
 *
 * Renders a "⋯" button in the upper-right of a signal row. Clicking opens a
 * small popover with:
 *   - Snooze 24h
 *   - Snooze 7d
 *   - Not relevant
 *   - Already done
 *   - Report as incorrect
 *
 * All five call the Sprint B #17 backend:
 *   POST /api/signals/{event_id}/snooze   { until }
 *   POST /api/signals/{event_id}/feedback { feedback_key }
 *
 * After a successful call this component invokes `onAfterAction(actionKind)`
 * so the parent can optimistically remove the row from the feed. If the API
 * call fails we surface the error inline and keep the row visible.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { MoreVertical, Clock, CalendarDays, X, ThumbsDown, CheckCircle2, AlertOctagon } from 'lucide-react';
import { apiClient } from '../lib/api';

const SNOOZE_PRESETS = [
  { key: 'snooze_24h', label: 'Snooze 24 hours',  hours: 24,  icon: Clock },
  { key: 'snooze_7d',  label: 'Snooze 7 days',    hours: 168, icon: CalendarDays },
];

const FEEDBACK_PRESETS = [
  { key: 'not_relevant',  label: 'Not relevant',       icon: ThumbsDown },
  { key: 'already_done',  label: 'Already done',       icon: CheckCircle2 },
  { key: 'incorrect',     label: 'Report as incorrect', icon: AlertOctagon },
];

const SignalActionsMenu = ({ eventId, onAfterAction, sourceSurface = 'advisor', dataTestId = 'signal-actions-menu' }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const rootRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const performSnooze = useCallback(async (hours, actionKey) => {
    if (!eventId) return;
    setBusy(true); setError(null);
    try {
      const until = new Date(Date.now() + hours * 3_600_000).toISOString();
      await apiClient.post(`/signals/${eventId}/snooze`, { until, source_surface: sourceSurface });
      setOpen(false);
      onAfterAction && onAfterAction(actionKey);
    } catch (err) {
      console.error('snooze failed:', err);
      setError('Couldn’t snooze — try again.');
    } finally {
      setBusy(false);
    }
  }, [eventId, sourceSurface, onAfterAction]);

  const performFeedback = useCallback(async (feedback_key) => {
    if (!eventId) return;
    setBusy(true); setError(null);
    try {
      await apiClient.post(`/signals/${eventId}/feedback`, {
        feedback_key,
        source_surface: sourceSurface,
      });
      setOpen(false);
      onAfterAction && onAfterAction(feedback_key);
    } catch (err) {
      console.error('feedback failed:', err);
      setError('Couldn’t submit — try again.');
    } finally {
      setBusy(false);
    }
  }, [eventId, sourceSurface, onAfterAction]);

  if (!eventId) return null;

  return (
    <div ref={rootRef} className="relative inline-flex" data-testid={dataTestId}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        aria-label="Signal actions"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        className="flex items-center justify-center rounded-md transition-opacity"
        style={{
          width: 24, height: 24,
          color: 'var(--ink-muted)',
          background: 'transparent',
          border: 'none',
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        <MoreVertical style={{ width: 16, height: 16 }} />
      </button>

      {open && (
        <div
          role="menu"
          data-testid={`${dataTestId}-popover`}
          className="absolute z-20 text-sm"
          style={{
            top: '100%',
            right: 0,
            minWidth: 200,
            marginTop: 4,
            padding: 4,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            boxShadow: 'var(--elev-3)',
            fontFamily: 'var(--font-ui)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Snooze group */}
          <div className="px-3 pt-2 pb-1 text-[10px] uppercase" style={{ color: 'var(--ink-muted)', letterSpacing: 'var(--ls-caps)', fontFamily: 'var(--font-mono)' }}>
            Snooze
          </div>
          {SNOOZE_PRESETS.map(({ key, label, hours, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => performSnooze(hours, key)}
              className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md transition-colors"
              style={{ color: 'var(--ink-display)', background: 'transparent', border: 'none', cursor: busy ? 'wait' : 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-tint)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              data-action={key}
            >
              <Icon style={{ width: 14, height: 14, color: 'var(--ink-muted)' }} />
              <span>{label}</span>
            </button>
          ))}

          <div className="my-1" style={{ height: 1, background: 'var(--border)' }} />

          {/* Feedback group */}
          <div className="px-3 pt-2 pb-1 text-[10px] uppercase" style={{ color: 'var(--ink-muted)', letterSpacing: 'var(--ls-caps)', fontFamily: 'var(--font-mono)' }}>
            Not for me
          </div>
          {FEEDBACK_PRESETS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => performFeedback(key)}
              className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md transition-colors"
              style={{ color: 'var(--ink-display)', background: 'transparent', border: 'none', cursor: busy ? 'wait' : 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-tint)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              data-action={key}
            >
              <Icon style={{ width: 14, height: 14, color: 'var(--ink-muted)' }} />
              <span>{label}</span>
            </button>
          ))}

          {error && (
            <div className="px-3 py-2 text-xs flex items-center gap-1.5" style={{ color: 'var(--danger)' }}>
              <X style={{ width: 12, height: 12 }} />
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SignalActionsMenu;
