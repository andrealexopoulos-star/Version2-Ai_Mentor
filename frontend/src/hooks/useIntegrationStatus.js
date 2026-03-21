/**
 * useIntegrationStatus — Fetches unified integration status once.
 * Provides per-category connection state, record counts, and last sync.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api';
import { useSupabaseAuth, AUTH_STATE } from '../context/SupabaseAuthContext';

const normalizePrimary = (payload = {}) => {
  const rows = Array.isArray(payload.integrations) ? payload.integrations : [];
  const verifiedRows = rows.filter((row) => Boolean(row?.connected));
  const canonicalTruth = payload.canonical_truth || {};
  const truthCount = Number(canonicalTruth.total_connected || 0);
  const verifiedCount = verifiedRows.length;
  return {
    ...payload,
    integrations: rows,
    canonical_truth: canonicalTruth,
    total_connected: verifiedCount,
    verification_mode: 'primary',
    verification_gap_count: Math.max(0, truthCount - verifiedCount),
  };
};

const normalizeFallback = (payload = {}) => {
  const map = payload.integrations || {};
  const rows = Object.values(map).map((item) => ({
    integration_name: item?.provider || item?.integration_name || 'Unknown',
    category: item?.category || 'general',
    connected: Boolean(item?.connected),
    provider: item?.provider || item?.integration_name || 'Unknown',
    connected_at: item?.connected_at || null,
    last_sync_at: item?.last_sync_at || item?.connected_at || null,
    records_count: item?.records_count || 0,
    truth_state: item?.truth_state,
    truth_reason: item?.truth_reason,
    last_verified_at: item?.last_verified_at || item?.connected_at || null,
  }));
  const verifiedRows = rows.filter((row) => Boolean(row.connected));
  const canonicalTruth = payload.canonical_truth || {};
  const truthCount = Number(canonicalTruth.total_connected || 0);
  const verifiedCount = verifiedRows.length;
  return {
    integrations: rows,
    canonical_truth: canonicalTruth,
    total_connected: verifiedCount,
    verification_mode: 'fallback',
    verification_gap_count: Math.max(0, truthCount - verifiedCount),
  };
};

export const useIntegrationStatus = () => {
  const { session, authState } = useSupabaseAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    try {
      const [primary, fallback] = await Promise.allSettled([
        apiClient.get('/user/integration-status'),
        apiClient.get('/integrations/merge/connected'),
      ]);

      const primaryData = primary.status === 'fulfilled' ? primary.value.data : null;
      const fallbackData = fallback.status === 'fulfilled' ? fallback.value.data : null;
      if (primaryData) {
        setStatus(normalizePrimary(primaryData));
        setError(null);
        return;
      }
      if (fallbackData) {
        setStatus(normalizeFallback(fallbackData));
        setError('Primary integration status unavailable; showing fallback verification.');
        return;
      }
      setStatus({
        integrations: [],
        canonical_truth: {},
        total_connected: 0,
        verification_mode: 'none',
        verification_gap_count: 0,
      });
      setError('Integration verification unavailable.');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authState === AUTH_STATE.LOADING && !session?.access_token) return;
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    fetch();
  }, [fetch, authState, session?.access_token]);

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      await apiClient.post('/user/integration-status/sync');
      await fetch();
    } catch {
      // silent
    } finally {
      setSyncing(false);
    }
  }, [fetch]);

  /**
   * Get status for a specific category ('crm', 'accounting', 'email', 'hris', 'ats')
   * Returns { connected, provider, records_count, record_type, last_sync_at, error_message }
   */
  const getCategory = useCallback((category) => {
    if (!status?.integrations) return null;
    const matches = status.integrations.filter(i => i.category === category && i.connected);
    if (matches.length === 0) return null;
    return matches[0];
  }, [status]);

  const isConnected = useCallback((category) => !!getCategory(category), [getCategory]);

  return { status, loading, syncing, error, refresh, getCategory, isConnected };
};
