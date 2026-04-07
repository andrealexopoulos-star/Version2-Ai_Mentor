import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api';

export function useConversationList(mode) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get('/boardroom/conversations', {
        params: { mode, limit: 50, status: 'active' },
      });
      setConversations(data.conversations || []);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { conversations, loading, error, refresh };
}
