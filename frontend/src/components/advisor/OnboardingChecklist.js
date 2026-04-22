/**
 * OnboardingChecklist — Sprint B #12
 *
 * Progressive onboarding checklist rendered on the Advisor page above the KPI
 * tiles. Shows the user's journey from signup → first signal → first action
 * closed. Retention lever: users who complete more checklist items retain at
 * ~3x rate per typical SaaS benchmarks.
 *
 * Data source: GET /api/onboarding/progress (see backend/routes/onboarding.py).
 * The endpoint evaluates each step against live tables — we never presume
 * done-state client-side.
 *
 * Visibility rules:
 *   - Hide entirely when percent_complete === 100.
 *   - Dismiss button appears only once the user has ≥3 of the counted 5 done
 *     (can't dismiss a dashboard asking you to set up your product).
 *   - Dismissal is session-scoped via sessionStorage so it reappears on next
 *     login until they cross 100%.
 *
 * Step visual states:
 *   - Done: lava fill, checkmark.
 *   - Current (first not-done, not ghost): lava outline + pulse.
 *   - Future: grey outline.
 *   - Ghost (invite teammate, Sprint E #43): dashed outline, muted.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Lock } from 'lucide-react';
import { apiClient } from '../../lib/api';

const DISMISS_STORAGE_KEY = 'biqc.onboarding.checklist.dismissed';
const DISMISS_MIN_DONE = 3; // Sprint B #12 spec: can't dismiss before 3/6 steps

const OnboardingChecklist = () => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const fetchProgress = useCallback(async (signal) => {
    try {
      const res = await apiClient.get('/onboarding/progress', { signal });
      if (!signal?.aborted) setProgress(res.data);
    } catch (err) {
      if (!signal?.aborted) {
        // Silent degradation — if the endpoint is unavailable we simply hide
        // the checklist rather than render a broken strip.
        console.warn('[OnboardingChecklist] progress fetch failed:', err?.message || err);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchProgress(controller.signal);
    return () => controller.abort();
  }, [fetchProgress]);

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_STORAGE_KEY, '1');
    } catch {
      // sessionStorage may be blocked (private mode, etc.) — dismiss for this
      // render only.
    }
    setDismissed(true);
  };

  const handleStepClick = (step) => {
    if (step.ghost) return; // ghost step is non-interactive
    if (!step.href) return;
    navigate(step.href);
  };

  // Hide-all conditions.
  if (loading || !progress) return null;
  if (progress.percent_complete === 100) return null;
  if (dismissed) return null;

  const { steps, percent_complete, current_step_index, countable_done } = progress;
  const canDismiss = countable_done >= DISMISS_MIN_DONE;

  return (
    <div
      className="p-5"
      data-testid="onboarding-checklist"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)',
        boxShadow: 'var(--elev-1)',
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div
            className="text-[10px] uppercase mb-1"
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--ink-muted)',
              letterSpacing: 'var(--ls-caps)',
            }}
          >
            — Get the most out of BIQc
          </div>
          <h3
            className="text-lg font-medium"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--ink-display)',
              letterSpacing: 'var(--ls-heading)',
            }}
          >
            Your setup journey
            <span
              className="ml-2 text-sm font-normal"
              style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}
            >
              {percent_complete}% complete
            </span>
          </h3>
        </div>
        {canDismiss && (
          <button
            onClick={handleDismiss}
            aria-label="Dismiss checklist"
            className="p-1.5 rounded-md transition-all"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--ink-muted)',
              cursor: 'pointer',
            }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Step strip */}
      <div className="flex items-start justify-between gap-2 mb-4">
        {steps.map((step, idx) => {
          const isDone = step.done;
          const isCurrent = idx === current_step_index && !isDone;
          const isGhost = step.ghost;
          const isClickable = !isGhost && step.href;

          // Circle styling per state.
          let circleStyle = {
            width: 36,
            height: 36,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontFamily: 'var(--font-mono)',
            transition: 'all 180ms ease',
          };
          if (isDone) {
            circleStyle = {
              ...circleStyle,
              background: 'var(--lava)',
              color: 'var(--ink-inverse)',
              border: '1px solid var(--lava)',
              boxShadow: '0 0 10px rgba(230, 85, 35, 0.35)',
            };
          } else if (isCurrent) {
            circleStyle = {
              ...circleStyle,
              background: 'var(--surface-sunken)',
              color: 'var(--lava)',
              border: '2px solid var(--lava)',
              animation: 'biqcOnboardingPulse 1.6s ease-in-out infinite',
            };
          } else if (isGhost) {
            circleStyle = {
              ...circleStyle,
              background: 'transparent',
              color: 'var(--ink-muted)',
              border: '1px dashed var(--border)',
            };
          } else {
            circleStyle = {
              ...circleStyle,
              background: 'var(--surface-sunken)',
              color: 'var(--ink-muted)',
              border: '1px solid var(--border)',
            };
          }

          return (
            <div
              key={step.key}
              className="flex-1 flex flex-col items-center text-center"
              style={{ minWidth: 0 }}
            >
              <button
                type="button"
                onClick={() => handleStepClick(step)}
                disabled={!isClickable}
                title={step.helper_text}
                aria-label={`${step.label}${isDone ? ' (done)' : ''}`}
                className="mb-2"
                style={{
                  ...circleStyle,
                  cursor: isClickable ? 'pointer' : 'default',
                }}
              >
                {isDone ? (
                  <Check className="w-4 h-4" />
                ) : isGhost ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  idx + 1
                )}
              </button>
              <div
                className="text-[11px] font-medium"
                style={{
                  fontFamily: 'var(--font-ui)',
                  color: isDone
                    ? 'var(--ink-display)'
                    : isCurrent
                    ? 'var(--lava)'
                    : 'var(--ink-secondary)',
                  lineHeight: 1.2,
                  maxWidth: 120,
                }}
              >
                {step.label}
              </div>
              {isGhost && (
                <div
                  className="text-[9px] mt-1"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--ink-muted)',
                    letterSpacing: 'var(--ls-caps)',
                    textTransform: 'uppercase',
                  }}
                >
                  Coming soon with Pro
                </div>
              )}
              {!isGhost && (isCurrent || isDone) && (
                <div
                  className="text-[10px] mt-1"
                  style={{
                    fontFamily: 'var(--font-ui)',
                    color: 'var(--ink-muted)',
                    lineHeight: 1.3,
                    maxWidth: 160,
                  }}
                >
                  {step.helper_text}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          height: 4,
          background: 'var(--surface-sunken)',
          borderRadius: 999,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percent_complete}%`,
            background: 'var(--lava)',
            transition: 'width 320ms ease',
            boxShadow: '0 0 8px rgba(230, 85, 35, 0.4)',
          }}
        />
      </div>

      {/* Pulse keyframes — scoped inline to avoid adding a global stylesheet. */}
      <style>{`
        @keyframes biqcOnboardingPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(230, 85, 35, 0.45); }
          50% { box-shadow: 0 0 0 6px rgba(230, 85, 35, 0); }
        }
      `}</style>
    </div>
  );
};

export default OnboardingChecklist;
