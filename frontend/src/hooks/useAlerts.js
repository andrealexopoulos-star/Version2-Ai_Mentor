import { useEffect, useCallback, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';

/**
 * useAlerts — Phase 6.5 alert flow hook.
 *
 * Responsibilities:
 *   • Poll /api/alerts/active every 60s while mounted
 *   • Provide dismiss / action / feedback / view methods
 *   • Auto-clear alerts whose target_page matches the current route
 *
 * Usage:
 *   const { alerts, dismiss, action, feedback } = useAlerts();
 *
 * Returns:
 *   alerts       — array of { id, type, source, target_page, payload, priority, ... }
 *   loading      — boolean
 *   refresh()    — manually re-fetch
 *   dismiss(id)  — X-button behaviour (negative signal)
 *   action(id, actionTaken?) — user clicked CTA (positive signal)
 *   feedback(id, value)      — thumbs up/down (-1 | 0 | 1)
 *   view(id)     — explicit acknowledge
 */
const POLL_INTERVAL_MS = 60_000;

export function useAlerts() {
  const { user, session } = useSupabaseAuth();
  const location = useLocation();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const clearedPagesRef = useRef(new Set());

  const authed = Boolean(user?.id || session?.user?.id);

  const refresh = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    try {
      const res = await apiClient.get('/alerts/active');
      setAlerts(res.data?.alerts || []);
    } catch (err) {
      // Swallow — alerts are non-critical. Don't alarm the user if API is down.
      if (err?.response?.status !== 401) {
        console.debug('[useAlerts] fetch failed:', err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [authed]);

  // Poll on mount + every 60s
  useEffect(() => {
    if (!authed) { setAlerts([]); return; }
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [authed, refresh]);

  // Auto-clear alerts targeting the current route
  useEffect(() => {
    if (!authed) return;
    const path = location.pathname;
    if (!path || clearedPagesRef.current.has(path)) return;

    // Only hit the server if there ARE alerts pointing to this page
    const hasMatchingAlert = alerts.some((a) => a.target_page === path);
    if (!hasMatchingAlert) return;

    // Fire-and-forget — backend will mark matching alerts as viewed
    apiClient.post('/alerts/visit', { target_page: path })
      .then(() => {
        clearedPagesRef.current.add(path);
        // Drop cleared alerts from local state immediately so UI updates
        setAlerts((prev) => prev.filter((a) => a.target_page !== path));
      })
      .catch(() => { /* best effort */ });
  }, [authed, location.pathname, alerts]);

  const dismiss = useCallback(async (id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    try { await apiClient.post(`/alerts/${id}/dismiss`); }
    catch { /* best effort — already removed from UI */ }
  }, []);

  const action = useCallback(async (id, actionTaken) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    try {
      await apiClient.post(`/alerts/${id}/action`,
        actionTaken ? { action_taken: actionTaken } : {});
    } catch { /* best effort */ }
  }, []);

  const feedback = useCallback(async (id, value) => {
    try { await apiClient.post(`/alerts/${id}/feedback`, { feedback: value }); }
    catch { /* best effort */ }
  }, []);

  const view = useCallback(async (id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    try { await apiClient.post(`/alerts/${id}/view`); }
    catch { /* best effort */ }
  }, []);

  return { alerts, loading, refresh, dismiss, action, feedback, view };
}

export default useAlerts;
