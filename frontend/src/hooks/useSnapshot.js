import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../context/SupabaseAuthContext';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 min
const CACHE_KEY = 'biqc_snapshot_cache';

/**
 * useSnapshot — STALE-WHILE-REVALIDATE strategy.
 * 1. ALWAYS show cached data instantly (never loading spinner for returning users)
 * 2. Background refresh if cache > 5 min old
 * 3. Show "Updated X min ago" indicator
 * 4. Loading spinner ONLY on first-ever visit (no cache exists)
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

  const getCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      const age = Date.now() - (cached._timestamp || 0);
      return { ...cached, _age: age };
    } catch { return null; }
  }, []);

  const setCache = useCallback((data) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, _timestamp: Date.now() })); } catch {}
  }, []);

  const applyData = useCallback((data) => {
    if (!data || !mountedRef.current) return;
    setCognitive(data.cognitive);
    setSources(data.data_sources || []);
    setOwner(data.owner || '');
    setTimeOfDay(data.time_of_day || '');
    setCacheAge(data._age ? Math.round(data._age / 60000) : (data.cache_age_minutes || 0));
  }, []);

  const fetchFresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
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
  }, []);

  // STALE-WHILE-REVALIDATE: Always show data, refresh in background
  const loadSnapshot = useCallback(async () => {
    setError(null);

    // Step 1: Show ANY cached data immediately (even stale)
    const cached = getCache();
    if (cached?.cognitive) {
      applyData(cached);
      setLoading(false); // Never show spinner if we have cache
    }

    // Step 2: Background refresh
    setRefreshing(true);
    try {
      const fresh = await fetchFresh();
      if (fresh && mountedRef.current) {
        applyData(fresh);
        setCache(fresh);
      }
    } catch (e) {
      if (!cached && mountedRef.current) {
        setError('Connect integrations for full insights.');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [getCache, applyData, fetchFresh, setCache]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const fresh = await fetchFresh();
      if (fresh && mountedRef.current) {
        applyData(fresh);
        setCache(fresh);
      }
    } catch { setError('Refresh failed.'); }
    finally { if (mountedRef.current) setRefreshing(false); }
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
