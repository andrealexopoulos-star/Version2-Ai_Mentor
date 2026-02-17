import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../lib/api';

const cache = new Map();

/**
 * useSWR — Stale-While-Revalidate hook for BIQc.
 * Serves cached data instantly, then revalidates in the background.
 *
 * @param {string} key - API endpoint path (e.g., '/business-profile')
 * @param {object} options - { revalidateOnFocus, dedupingInterval, fallbackData }
 * @returns {{ data, error, isLoading, isValidating, mutate }}
 */
export function useSWR(key, options = {}) {
  const {
    revalidateOnFocus = true,
    dedupingInterval = 5000,
    fallbackData = null,
  } = options;

  const cached = cache.get(key);
  const [data, setData] = useState(cached?.data ?? fallbackData);
  const [error, setError] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const lastFetchRef = useRef(0);
  const mountedRef = useRef(true);

  const isLoading = data === null && !error;

  const revalidate = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < dedupingInterval) return;
    lastFetchRef.current = now;

    setIsValidating(true);
    try {
      const res = await apiClient.get(key);
      const fresh = res.data;
      cache.set(key, { data: fresh, fetchedAt: now });
      if (mountedRef.current) {
        setData(fresh);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) setError(err);
    } finally {
      if (mountedRef.current) setIsValidating(false);
    }
  }, [key, dedupingInterval]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    revalidate();
    return () => { mountedRef.current = false; };
  }, [key]);

  // Revalidate on window focus
  useEffect(() => {
    if (!revalidateOnFocus) return;
    const onFocus = () => revalidate();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [revalidateOnFocus, revalidate]);

  const mutate = useCallback((newData) => {
    if (typeof newData === 'function') {
      setData(prev => {
        const updated = newData(prev);
        cache.set(key, { data: updated, fetchedAt: Date.now() });
        return updated;
      });
    } else if (newData !== undefined) {
      setData(newData);
      cache.set(key, { data: newData, fetchedAt: Date.now() });
    } else {
      revalidate();
    }
  }, [key, revalidate]);

  return { data, error, isLoading, isValidating, mutate };
}

/** Prefetch a key into the SWR cache (fire-and-forget) */
export function prefetch(key) {
  apiClient.get(key).then(res => {
    cache.set(key, { data: res.data, fetchedAt: Date.now() });
  }).catch(() => {});
}

/** Clear a specific key or the entire cache */
export function clearCache(key) {
  if (key) { cache.delete(key); } else { cache.clear(); }
}
