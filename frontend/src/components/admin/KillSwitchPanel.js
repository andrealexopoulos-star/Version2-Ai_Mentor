/**
 * KillSwitchPanel
 * ---------------
 * Sprint D #28c (2026-04-22) — super admin kill switches.
 *
 * Replaces the "Operational controls — ComingSoon" block in AdminDashboard.
 * Reads from GET /super-admin/feature-flags, toggles via PATCH.
 *
 * Flag seed (migration 124):
 *   - trinity_synthesis_enabled
 *   - morning_brief_cron_enabled
 *   - calibration_deep_scan_enabled
 *   - new_user_signup_enabled
 *   - stripe_webhook_processing
 *   - edge_function_global_pause
 *   - email_sync_cron_enabled
 *   - llm_global_pause
 */
import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '../../lib/api';
import { AlertTriangle, Loader2, Power, PowerOff, RefreshCw } from 'lucide-react';

const KillSwitchPanel = () => {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyKey, setBusyKey] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/super-admin/feature-flags');
      setFlags(res?.data?.flags || []);
    } catch (err) {
      console.error('[kill-switch] load failed:', err);
      setError('Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (flag_key, nextEnabled) => {
    setBusyKey(flag_key);
    try {
      await apiClient.patch(`/super-admin/feature-flags/${encodeURIComponent(flag_key)}`, { enabled: nextEnabled });
      setFlags(prev => prev.map(f => f.flag_key === flag_key ? { ...f, enabled: nextEnabled, updated_at: new Date().toISOString() } : f));
    } catch (err) {
      console.error('[kill-switch] toggle failed:', err);
      setError(`Failed to toggle ${flag_key}`);
    } finally {
      setBusyKey(null);
    }
  };

  if (loading) {
    return (
      <div className="p-10 text-center" data-testid="kill-switch-loading">
        <RefreshCw className="w-6 h-6 mx-auto mb-3 animate-spin" style={{ color: 'var(--ink-muted)' }} />
        <p className="text-sm" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-ui)' }}>Loading kill switches…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="kill-switch-panel">
      <div className="p-4 rounded-lg flex items-start gap-3" style={{ background: 'var(--warning-wash)', border: '1px solid var(--warning)' }}>
        <AlertTriangle style={{ width: 18, height: 18, color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--ink-display)', fontFamily: 'var(--font-ui)' }}>
            Production kill switches
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
            Toggles affect production immediately. Every flip is recorded in <code style={{ fontFamily: 'var(--font-mono)' }}>admin_actions</code> with your user id and timestamp. Turning a flag OFF means the feature is disabled.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-xs" style={{ background: 'var(--danger-wash)', border: '1px solid var(--danger)', color: 'var(--danger)', fontFamily: 'var(--font-ui)' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2" data-testid="kill-switch-list">
        {flags.map(f => (
          <div
            key={f.flag_key}
            className="p-4 rounded-lg flex items-center justify-between gap-4"
            style={{ background: 'var(--biqc-bg)', border: `1px solid ${f.enabled ? 'var(--border)' : 'var(--danger)'}` }}
            data-flag={f.flag_key}
            data-enabled={f.enabled ? 'true' : 'false'}
          >
            <div className="flex items-start gap-3 min-w-0">
              {f.enabled ? (
                <Power style={{ width: 18, height: 18, color: 'var(--positive)', flexShrink: 0, marginTop: 2 }} />
              ) : (
                <PowerOff style={{ width: 18, height: 18, color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
              )}
              <div className="min-w-0">
                <code className="text-sm font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-display)' }}>
                  {f.flag_key}
                </code>
                {f.description && (
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-ui)' }}>
                    {f.description}
                  </p>
                )}
                {f.updated_at && (
                  <p className="text-[10px] mt-1 uppercase" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)', letterSpacing: 'var(--ls-caps)' }}>
                    Last changed {new Date(f.updated_at).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggle(f.flag_key, !f.enabled)}
              disabled={busyKey === f.flag_key}
              aria-label={`Turn ${f.flag_key} ${f.enabled ? 'off' : 'on'}`}
              data-testid={`toggle-${f.flag_key}`}
              style={{
                minWidth: 80,
                padding: '6px 14px',
                borderRadius: 'var(--r-pill)',
                border: 'none',
                background: f.enabled ? 'var(--positive)' : 'var(--danger)',
                color: 'var(--ink-inverse)',
                fontFamily: 'var(--font-ui)',
                fontSize: 13,
                fontWeight: 'var(--fw-semi)',
                cursor: busyKey === f.flag_key ? 'wait' : 'pointer',
                opacity: busyKey === f.flag_key ? 0.6 : 1,
              }}
            >
              {busyKey === f.flag_key ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (f.enabled ? 'ON' : 'OFF')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KillSwitchPanel;
