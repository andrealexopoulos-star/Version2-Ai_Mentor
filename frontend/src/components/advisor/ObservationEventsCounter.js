import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';

/**
 * ObservationEventsCounter — Advisor page header counter with D/W/M toggle.
 *
 * Shows total observation_events detected for the current user across three
 * windows (Today / This week / This month). Fetches once on mount; the
 * toggle switches the displayed figure client-side, no refetch required.
 *
 * A.2 — 2026-04-23. Lives above the KPI row, directly under the
 * OnboardingChecklist, so users see the "BIQc is working for you" signal
 * count immediately on page load.
 *
 * Design: matches the existing KPI-card pattern in Advisor.js — bordered
 * surface, display font for the big number, mono caps for the caption,
 * lava-accent pill toggle identical to the Signal Feed filter row.
 */

const WINDOWS = [
  { key: 'daily', label: 'Today', caption: 'past 24 hours' },
  { key: 'weekly', label: 'This week', caption: 'past 7 days' },
  { key: 'monthly', label: 'This month', caption: 'past 30 days' },
];

const ObservationEventsCounter = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [windowKey, setWindowKey] = useState('daily');

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        // apiClient is axios — response.data holds the JSON payload.
        const res = await apiClient.get('/intelligence/observation-stats', {
          signal: controller.signal,
          timeout: 10000,
        });
        if (controller.signal.aborted) return;
        const payload = (res && res.data) || { daily: 0, weekly: 0, monthly: 0, total: 0 };
        setStats(payload);
        setError(false);
      } catch (err) {
        // Swallow the expected AbortController "canceled" error on unmount.
        if (err?.name === 'CanceledError' || err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;
        if (controller.signal.aborted) return;
        setStats({ daily: 0, weekly: 0, monthly: 0, total: 0 });
        setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const activeWindow = WINDOWS.find((w) => w.key === windowKey) || WINDOWS[0];
  const currentCount = stats ? stats[windowKey] ?? 0 : 0;
  const totalAllTime = stats ? stats.total ?? 0 : 0;

  return (
    <section
      aria-label="Observation events counter"
      className="mb-6"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)',
        boxShadow: 'var(--elev-1)',
        padding: 'var(--sp-5) var(--sp-6)',
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Left: label + count + subtitle (tab panel for D/W/M toggle) */}
        <div
          role="tabpanel"
          id={`obs-panel-${windowKey}`}
          aria-labelledby={`obs-tab-${windowKey}`}
        >
          <div
            className="text-[10px] uppercase"
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--ink-muted)',
              letterSpacing: 'var(--ls-caps)',
            }}
          >
            — Observation events
          </div>

          <div
            className="mt-2"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--ink-display)',
              fontSize: 'clamp(2.25rem, 4vw, 3rem)',
              lineHeight: 1,
              fontWeight: 500,
            }}
          >
            {loading ? (
              <span
                className="inline-block rounded animate-pulse"
                style={{
                  width: '6rem',
                  height: '2.75rem',
                  background: 'var(--surface-2)',
                }}
              />
            ) : (
              Number(currentCount).toLocaleString()
            )}
          </div>

          <div
            className="mt-1 text-sm"
            style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}
          >
            {error
              ? 'Counter temporarily unavailable'
              : `Signals BIQc detected for you · ${activeWindow.caption}`}
          </div>

          {!loading && !error && totalAllTime > 0 && (
            <div
              className="mt-1 text-[11px]"
              style={{
                color: 'var(--ink-muted)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: 'var(--ls-caps)',
                textTransform: 'uppercase',
              }}
            >
              {Number(totalAllTime).toLocaleString()} all-time
            </div>
          )}
        </div>

        {/* Right: D/W/M toggle */}
        <div
          className="flex gap-2 items-center"
          role="tablist"
          aria-label="Observation events time window"
        >
          {WINDOWS.map((w) => {
            const active = windowKey === w.key;
            return (
              <button
                key={w.key}
                role="tab"
                id={`obs-tab-${w.key}`}
                aria-selected={active}
                aria-controls={`obs-panel-${w.key}`}
                onClick={() => setWindowKey(w.key)}
                className="text-[10px] uppercase transition-all"
                style={{
                  fontFamily: 'var(--font-mono)',
                  padding: '5px 10px',
                  borderRadius: 'var(--r-pill)',
                  letterSpacing: 'var(--ls-caps)',
                  background: active ? 'var(--lava)' : 'var(--surface-sunken)',
                  color: active ? 'var(--ink-inverse)' : 'var(--ink-secondary)',
                  border: `1px solid ${active ? 'var(--lava)' : 'var(--border)'}`,
                  cursor: 'pointer',
                }}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ObservationEventsCounter;
