/**
 * NeedsReconnectBanner — top-of-page warning shown when any connected
 * integration has gone stale or hit an error and needs the user to reconnect.
 *
 * Reads GET /user/integration-status (see backend/routes/integrations.py
 * @router.get("/user/integration-status") ~L3302). Response shape:
 *   {
 *     integrations: [
 *       { integration_name, category, connected, provider,
 *         truth_state, truth_reason, last_verified_at, ... },
 *       ...
 *     ],
 *     canonical_truth: {...},
 *     total_connected: number,
 *   }
 *
 * truth_state values emitted by the backend (intelligence_live_truth.py,
 * business_brain_engine.py): "live" | "stale" | "error" | "verified" |
 * "blocked" | "needs_verification". We treat stale/error/needs_reconnect
 * as "needs attention" and only flag rows that are actually connected
 * (the endpoint also returns connected:false placeholders for
 * crm/accounting/email/hris, which must NOT trigger the banner).
 *
 * Silent failure modes:
 *   - API 4xx/5xx / network error → no banner (caller is not logged in
 *     or backend is degraded; DegradedIntelligenceBanner handles that).
 *   - No flagged integrations → no banner (returns null).
 *   - No integrations connected yet → no banner.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { apiClient } from '../../lib/api';

const NEEDS_ATTENTION_STATES = new Set([
  'stale',
  'error',
  'needs_reconnect',
  'blocked',
  'needs_verification',
]);

export const NeedsReconnectBanner = () => {
  const [stale, setStale] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    apiClient
      .get('/user/integration-status', { signal: controller.signal })
      .then((res) => {
        const data = res?.data || {};
        const rows = Array.isArray(data.integrations) ? data.integrations : [];
        // Only flag integrations the user has actually connected —
        // the endpoint also emits connected:false placeholders for missing
        // categories (crm/accounting/email/hris) that must NOT trigger this.
        const flagged = rows.filter((row) =>
          row &&
          row.connected === true &&
          typeof row.truth_state === 'string' &&
          NEEDS_ATTENTION_STATES.has(row.truth_state.toLowerCase())
        );
        setStale(flagged);
      })
      .catch(() => {
        // Silent — never block the page on this optional check.
      });
    return () => controller.abort();
  }, []);

  if (stale.length === 0) return null;

  const labelFor = (row) =>
    row?.provider || row?.integration_name || row?.category || 'An integration';
  const uniqueLabels = Array.from(new Set(stale.map(labelFor))).filter(Boolean);
  const headline =
    stale.length === 1
      ? '1 integration needs attention'
      : `${stale.length} integrations need attention`;

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="needs-reconnect-banner"
      style={{
        background: 'var(--lava-wash)',
        border: '1px solid var(--lava-ring)',
        borderRadius: 12,
        padding: '12px 16px',
        margin: '0 0 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontFamily: 'var(--font-ui)',
      }}
    >
      <AlertTriangle
        className="w-5 h-5 flex-shrink-0"
        style={{ color: 'var(--lava)' }}
        aria-hidden="true"
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            color: 'var(--ink-display)',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {headline}
        </p>
        <p
          style={{
            margin: '2px 0 0',
            color: 'var(--ink-secondary)',
            fontSize: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {uniqueLabels.join(', ')} — sync is paused until reconnected
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate('/integrations')}
        data-testid="needs-reconnect-banner-cta"
        style={{
          background: 'var(--lava)',
          color: 'var(--ink-inverse, #fff)',
          border: 'none',
          padding: '8px 16px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'var(--font-ui)',
          whiteSpace: 'nowrap',
        }}
      >
        Reconnect →
      </button>
    </div>
  );
};

export default NeedsReconnectBanner;
