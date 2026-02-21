import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../context/SupabaseAuthContext';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes — faster refresh for real-time feel

/**
 * useSnapshot — Reads from intelligence_snapshots table.
 * On mount: triggers snapshot Edge Function (returns cached if fresh).
 * Every 15 min: auto-refreshes.
 * Manual refresh available via `refresh()`.
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

  const callSnapshot = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      // Call v2 cognitive Edge Function first, fallback to legacy
      let res = await fetch(`${SUPABASE_URL}/functions/v1/biqc-insights-cognitive`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json', 'apikey': ANON_KEY },
        body: '{}',
      });
      if (!res.ok) {
        // Fallback to legacy intelligence-snapshot
        res = await fetch(`${SUPABASE_URL}/functions/v1/intelligence-snapshot`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json', 'apikey': ANON_KEY },
          body: '{}',
        });
      }
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    } catch (e) {
      throw e;
    }
  }, []);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await callSnapshot();
      if (data) {
        setCognitive(data.cognitive);
        setSources(data.data_sources || []);
        setOwner(data.owner || '');
        setTimeOfDay(data.time_of_day || '');
        setCacheAge(data.cache_age_minutes);
      }
    } catch (e) {
      setError(e.message === '404' ? 'Deploy the intelligence-snapshot Edge Function.' : 'Intelligence unavailable.');
    } finally { setLoading(false); }
  }, [callSnapshot]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadSnapshot();
    setRefreshing(false);
  }, [loadSnapshot]);

  // On mount: load + start interval
  useEffect(() => {
    loadSnapshot();
    intervalRef.current = setInterval(loadSnapshot, REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadSnapshot]);

  // Also load context snapshot from Supabase directly (for Board Room/Market Analysis)
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
        if (data && data[0]) {
          setContext(data[0].executive_memo);
        }
      } catch {}
    }
    if (!loading && cognitive) loadContext();
  }, [loading, cognitive]);

  return { cognitive, context, sources, owner, timeOfDay, loading, error, cacheAge, refreshing, refresh };
}
