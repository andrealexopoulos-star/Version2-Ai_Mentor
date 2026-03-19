/**
 * useIntegrationStatus — Fetches unified integration status once.
 * Provides per-category connection state, record counts, and last sync.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api';
import { useSupabaseAuth, AUTH_STATE } from '../context/SupabaseAuthContext';

const mergeCanonicalStatus = (primary, fallback) => {
  if (!fallback) return primary;

  const merged = primary ? { ...primary } : { integrations: [], canonical_truth: {} };
  const existing = Array.isArray(merged.integrations) ? [...merged.integrations] : [];
  const seen = new Set(existing.filter(i => i?.connected).map(i => `${i.category}:${i.provider || i.integration_name}`));

  const fallbackIntegrations = Object.values(fallback.integrations || {}).map(item => ({
    integration_name: item.provider,
    category: item.category,
    connected: item.connected,
    provider: item.connected_email ? `${item.provider}${item.connected_email ? ` (${item.connected_email})` : ''}` : item.provider,
    connected_at: item.connected_at,
    last_sync_at: item.connected_at,
    records_count: item.records_count || 0,
    record_type: item.category === 'email' ? 'emails' : item.category === 'crm' ? 'deals' : item.category === 'accounting' ? 'invoices' : 'records',
    error_message: null,
  }));

  fallbackIntegrations.forEach(item => {
    const key = `${item.category}:${item.provider || item.integration_name}`;
    if (item.connected && !seen.has(key)) {
      existing.push(item);
      seen.add(key);
    }
  });

  const fallbackTruth = fallback.canonical_truth || {};
  const primaryTruth = merged.canonical_truth || {};
  merged.integrations = existing;
  merged.canonical_truth = {
    crm_connected: fallbackTruth.crm_connected || primaryTruth.crm_connected || false,
    accounting_connected: fallbackTruth.accounting_connected || primaryTruth.accounting_connected || false,
    email_connected: fallbackTruth.email_connected || primaryTruth.email_connected || false,
    hris_connected: fallbackTruth.hris_connected || primaryTruth.hris_connected || false,
    total_connected: Math.max(fallbackTruth.total_connected || 0, primaryTruth.total_connected || 0, existing.filter(i => i.connected).length),
    live_signal_count: fallbackTruth.live_signal_count || primaryTruth.live_signal_count || 0,
    last_signal_at: fallbackTruth.last_signal_at || primaryTruth.last_signal_at || null,
    crm_state: fallbackTruth.crm_state || primaryTruth.crm_state || 'unverified',
    accounting_state: fallbackTruth.accounting_state || primaryTruth.accounting_state || 'unverified',
    email_state: fallbackTruth.email_state || primaryTruth.email_state || 'unverified',
    freshness: fallbackTruth.freshness || primaryTruth.freshness || {},
    live_sync_target_minutes: fallbackTruth.live_sync_target_minutes || primaryTruth.live_sync_target_minutes || 15,
    webhook_enabled: (fallbackTruth.webhook_enabled ?? primaryTruth.webhook_enabled) ?? false,
  };
  merged.total_connected = merged.canonical_truth.total_connected;
  return merged;
};

const deriveFromSnapshot = (snapshotPayload) => {
  const integrations = snapshotPayload?.cognitive?.integrations || {};
  const crm = Boolean(integrations.crm);
  const accounting = Boolean(integrations.accounting);
  const email = Boolean(integrations.email);
  const connected = [
    crm && { integration_name: 'crm', category: 'crm', connected: true, provider: 'CRM' },
    accounting && { integration_name: 'accounting', category: 'accounting', connected: true, provider: 'Accounting' },
    email && { integration_name: 'email', category: 'email', connected: true, provider: 'Email' },
  ].filter(Boolean);

  return {
    integrations: connected,
    canonical_truth: {
      crm_connected: crm,
      accounting_connected: accounting,
      email_connected: email,
      hris_connected: false,
      total_connected: connected.length,
      live_signal_count: snapshotPayload?.cognitive?.live_signal_count || 0,
      last_signal_at: null,
    },
    total_connected: connected.length,
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
      const [primary, fallback, snapshot] = await Promise.allSettled([
        apiClient.get('/user/integration-status'),
        apiClient.get('/integrations/merge/connected'),
        apiClient.get('/snapshot/latest'),
      ]);

      const primaryData = primary.status === 'fulfilled' ? primary.value.data : null;
      const fallbackData = fallback.status === 'fulfilled' ? fallback.value.data : null;
      const snapshotData = snapshot.status === 'fulfilled' ? snapshot.value.data : null;

      let resolved = mergeCanonicalStatus(primaryData, fallbackData);
      if (!resolved) {
        resolved = deriveFromSnapshot(snapshotData);
      } else if (snapshotData) {
        resolved = mergeCanonicalStatus(resolved, deriveFromSnapshot(snapshotData));
      }

      setStatus(resolved);
      setError(null);
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
