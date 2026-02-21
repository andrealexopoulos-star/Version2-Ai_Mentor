import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../context/SupabaseAuthContext';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 min
const CACHE_KEY = 'biqc_snapshot_cache';
const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 min — serve cached data if younger than this

/**
 * useSnapshot — Cache-first, background-refresh strategy.
 * 1. On mount: show cached data INSTANTLY (from localStorage)
 * 2. Then fetch fresh data in background
 * 3. Every 5 min: background refresh (no loading spinner)
 * 4. Manual refresh available via `refresh()`
 */
export function useSnapshot() {
  const [cognitive, setCognitive] = useState(null);
  const [context, setContext] = useState(null);
  const [sources, setSources] = useState([]);
  const [owner, setOwner] = useState('');
  const [timeOfDay, setTimeOfDay] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cacheAge, setCacheAge] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef(null);
  const mountedRef = useRef(true);

  // Read cache
  const getCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      const age = Date.now() - (cached._timestamp || 0);
      if (age > CACHE_MAX_AGE * 2) return null; // stale beyond 10 min, discard
      return { ...cached, _age: age };
    } catch { return null; }
  }, []);

  // Write cache
  const setCache = useCallback((data) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, _timestamp: Date.now() }));
    } catch {}
  }, []);

  // Apply data to state
  const applyData = useCallback((data) => {
    if (!data || !mountedRef.current) return;
    setCognitive(data.cognitive);
    setSources(data.data_sources || []);
    setOwner(data.owner || '');
    setTimeOfDay(data.time_of_day || '');
    setCacheAge(data._age ? Math.round(data._age / 60000) : 0);
  }, []);

  // Fetch from Edge Function
  const fetchFresh = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      // Try v2 first, fallback to legacy
      let res = await fetch(`${SUPABASE_URL}/functions/v1/biqc-insights-cognitive`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json', 'apikey': ANON_KEY },
        body: '{}',
      });
      if (!res.ok) {
        res = await fetch(`${SUPABASE_URL}/functions/v1/intelligence-snapshot`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json', 'apikey': ANON_KEY },
          body: '{}',
        });
      }
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    } catch (e) { throw e; }
  }, []);

  // Load: cache first, then background refresh
  const loadSnapshot = useCallback(async (isBackground = false) => {
    if (!isBackground) setError(null);

    // Step 1: Show cache instantly
    const cached = getCache();
    if (cached && !cognitive) {
      applyData(cached);
      setLoading(false);
    }

    // Step 2: Fetch fresh in background
    if (isBackground) setRefreshing(true);
    try {
      const fresh = await fetchFresh();
      if (fresh && mountedRef.current) {
        applyData(fresh);
        setCache(fresh);
      }
    } catch (e) {
      if (!cached && mountedRef.current) {
        setError('Intelligence unavailable. Connect integrations for full insights.');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [getCache, applyData, fetchFresh, setCache, cognitive]);

  // Manual refresh
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const fresh = await fetchFresh();
      if (fresh && mountedRef.current) {
        applyData(fresh);
        setCache(fresh);
      }
    } catch (e) {
      setError('Refresh failed. Try again.');
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, [fetchFresh, applyData, setCache]);

  // On mount
  useEffect(() => {
    mountedRef.current = true;
    loadSnapshot(false);
    intervalRef.current = setInterval(() => loadSnapshot(true), REFRESH_INTERVAL);
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load context memo from Supabase directly (for Board Room)
  useEffect(() => {
    async function loadContext() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await supabase
          .from('intelligence_snapshots')
          .select('executive_memo')
          .eq('user_id', session.user.id)
          .eq('snapshot_type', 'data_context')
          .order('generated_at', { ascending: false })
          .limit(1);
        if (data && data[0]) setContext(data[0].executive_memo);
      } catch {}
    }
    if (!loading && cognitive) loadContext();
  }, [loading, cognitive]);

  return { cognitive, context, sources, owner, timeOfDay, loading, error, cacheAge, refreshing, refresh };
}
