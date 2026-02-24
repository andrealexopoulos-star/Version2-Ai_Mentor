import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../context/SupabaseAuthContext';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const CACHE_KEY = 'biqc_snapshot_cache';

/**
 * useSnapshot — SUPABASE REALTIME strategy (replaces polling).
 * 
 * 1. Show cached data instantly on mount
 * 2. Fetch fresh data from Edge Function once
 * 3. Subscribe to intelligence_snapshots table via Supabase Realtime
 * 4. When pg_cron inserts a new snapshot → auto-update (no polling)
 * 5. Manual refresh still available via refresh()
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

  // Initial load: cache first, then fresh fetch
  const loadSnapshot = useCallback(async () => {
    setError(null);
    const cached = getCache();
    if (cached?.cognitive) {
      applyData(cached);
      setLoading(false);
    }
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
      if (mountedRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, [getCache, applyData, fetchFresh, setCache]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const fresh = await fetchFresh();
      if (fresh && mountedRef.current) { applyData(fresh); setCache(fresh); }
    } catch { setError('Refresh failed.'); }
    finally { if (mountedRef.current) setRefreshing(false); }
  }, [fetchFresh, applyData, setCache]);

  // On mount: load once + subscribe to Realtime
  useEffect(() => {
    mountedRef.current = true;
    loadSnapshot();

    // Supabase Realtime subscription — listen for new snapshots
    let channel;
    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      channel = supabase
        .channel('snapshot-updates')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'intelligence_snapshots',
          filter: `user_id=eq.${session.user.id}`,
        }, (payload) => {
          // New snapshot inserted (by pg_cron or manual trigger) → refresh
          console.log('[Realtime] New snapshot detected, refreshing...');
          refresh();
        })
        .subscribe();
    };
    setupRealtime();

    return () => {
      mountedRef.current = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Context memo from Supabase (for Board Room)
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
