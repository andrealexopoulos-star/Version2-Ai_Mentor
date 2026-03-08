/**
 * useIntegrationStatus — Fetches unified integration status once.
 * Provides per-category connection state, record counts, and last sync.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api';

export const useIntegrationStatus = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    try {
      const res = await apiClient.get('/user/integration-status');
      setStatus(res.data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

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
