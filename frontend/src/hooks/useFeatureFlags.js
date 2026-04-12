/**
 * useFeatureFlags — Database-backed feature flag hook with caching.
 *
 * Fetches flags from GET /api/feature-flags on mount, caches in localStorage
 * with 5-minute TTL. Falls back to empty flags on error (never blocks UI).
 *
 * Usage:
 *   const { isEnabled, loading } = useFeatureFlags();
 *   if (isEnabled('merge_webhook')) { ... }
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api';

const CACHE_KEY = 'biqc-feature-flags';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function loadFromCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_TTL) return data;
  } catch {
    // Corrupt cache — ignore
  }
  return null;
}

function saveToCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // Storage full — ignore
  }
}

export function useFeatureFlags() {
  const [flags, setFlags] = useState(() => loadFromCache() || {});
  const [loading, setLoading] = useState(true);

  const fetchFlags = useCallback(async () => {
    try {
      const res = await apiClient.get('/feature-flags');
      const flagData = res.data?.flags || {};
      setFlags(flagData);
      saveToCache(flagData);
    } catch {
      // Flags unavailable — use cached or empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const isEnabled = useCallback(
    (key) => {
      const val = flags[key];
      return val === true || val === 'true';
    },
    [flags],
  );

  return { flags, loading, isEnabled, refetch: fetchFlags };
}
