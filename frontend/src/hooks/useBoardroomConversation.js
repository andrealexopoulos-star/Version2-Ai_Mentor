import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api';

export function useBoardroomConversation(mode, conversationId = null) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (id) => {
    if (!id) {
      setConversation(null);
      setMessages([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get(`/boardroom/conversations/${id}`);
      setConversation(data.conversation);
      setMessages(data.messages || []);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async ({ focusArea = null, title = null } = {}) => {
    setError(null);
    try {
      const { data } = await apiClient.post('/boardroom/conversations', {
        mode,
        focus_area: focusArea,
        title,
      });
      setConversation(data);
      setMessages([]);
      return data;
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Create failed';
      setError(msg);
      throw new Error(msg);
    }
  }, [mode]);

  const appendMessage = useCallback(async (convId, message) => {
    if (!convId) throw new Error('convId required');
    try {
      const { data } = await apiClient.post(
        `/boardroom/conversations/${convId}/messages`,
        message,
      );
      setMessages((prev) => [...prev, data]);
      return data;
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Append failed';
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const appendOptimistic = useCallback((message) => {
    const optimistic = {
      ...message,
      id: `optimistic-${Date.now()}`,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    return optimistic;
  }, []);

  const replaceOptimistic = useCallback((optimisticId, real) => {
    setMessages((prev) => prev.map((m) => (m.id === optimisticId ? real : m)));
  }, []);

  const archive = useCallback(async (id) => {
    try {
      await apiClient.patch(`/boardroom/conversations/${id}`, { status: 'archived' });
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Archive failed');
    }
  }, []);

  useEffect(() => {
    if (conversationId) {
      load(conversationId);
    } else {
      setConversation(null);
      setMessages([]);
    }
  }, [conversationId, load]);

  return {
    conversation,
    messages,
    loading,
    error,
    load,
    create,
    appendMessage,
    appendOptimistic,
    replaceOptimistic,
    archive,
    setMessages,
  };
}
