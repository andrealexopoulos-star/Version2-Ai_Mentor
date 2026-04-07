import { useEffect, useState, useCallback } from 'react';
import { supabase, useSupabaseAuth } from '../context/SupabaseAuthContext';

export function useWatchtowerRealtime() {
  const { session } = useSupabaseAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString();
      const { data, error: qErr } = await supabase
        .from('watchtower_events')
        .select('*')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(50);

      if (qErr) throw qErr;
      setAlerts(data || []);
    } catch (e) {
      setError(e.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return undefined;

    let channel = null;
    let mounted = true;

    const setup = async () => {
      if (!mounted) return;
      await fetchHistory();
      if (!mounted) return;

      channel = supabase
        .channel(`watchtower-events-live-${session.user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'watchtower_events',
          },
          (payload) => {
            if (!mounted) return;
            setAlerts((prev) => {
              const exists = prev.find((a) => a.id === payload.new.id);
              if (exists) return prev;
              return [payload.new, ...prev].slice(0, 50);
            });
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'watchtower_events',
          },
          (payload) => {
            if (!mounted) return;
            setAlerts((prev) => prev.map((a) => (a.id === payload.new.id ? payload.new : a)));
          },
        )
        .subscribe();
    };

    setup();
    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [session?.user?.id, fetchHistory]);

  const acknowledge = useCallback(async (eventId) => {
    if (!session?.user?.id) return;
    const { error: uErr } = await supabase
      .from('watchtower_events')
      .update({
        status: 'acknowledged',
        handled_at: new Date().toISOString(),
        handled_by_user_id: session.user.id,
      })
      .eq('id', eventId);
    if (uErr) setError(uErr.message);
  }, [session?.user?.id]);

  const dismiss = useCallback(async (eventId) => {
    if (!session?.user?.id) return;
    const { error: uErr } = await supabase
      .from('watchtower_events')
      .update({
        status: 'dismissed',
        handled_at: new Date().toISOString(),
        handled_by_user_id: session.user.id,
      })
      .eq('id', eventId);
    if (uErr) setError(uErr.message);
  }, [session?.user?.id]);

  return {
    alerts,
    loading,
    error,
    acknowledge,
    dismiss,
    refresh: fetchHistory,
  };
}
