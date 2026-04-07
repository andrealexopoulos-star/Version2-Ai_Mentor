import { useState, useRef, useCallback, useEffect } from 'react';

export function useStreamingResponse() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [metadata, setMetadata] = useState({});
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const textRef = useRef('');

  const reset = useCallback(() => {
    setStreamingText('');
    setMetadata({});
    setError(null);
    textRef.current = '';
  }, []);

  const stream = useCallback(async ({
    url,
    body,
    headers = {},
    onStart = null,
    onDelta = null,
    onTruthGate = null,
    onComplete = null,
    onError = null,
  }) => {
    if (!url) throw new Error('stream: url is required');

    reset();
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...headers,
        },
        body: JSON.stringify(body || {}),
        signal: controller.signal,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      if (!response.body) {
        throw new Error('Response has no body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const raw of lines) {
          const dataLine = raw.split('\n').find((l) => l.startsWith('data: '));
          if (!dataLine) continue;

          let evt = null;
          try {
            evt = JSON.parse(dataLine.slice(6));
          } catch {
            continue;
          }
          if (!evt || !evt.type) continue;

          if (evt.type === 'start') {
            setMetadata((prev) => ({ ...prev, ...evt }));
            if (onStart) onStart(evt);
          } else if (evt.type === 'delta') {
            const text = evt.text || '';
            textRef.current += text;
            setStreamingText(textRef.current);
            if (onDelta) onDelta(evt);
          } else if (evt.type === 'truth_gate') {
            setMetadata((prev) => ({ ...prev, truth_gate: evt }));
            if (onTruthGate) onTruthGate(evt);
          } else if (evt.type === 'complete') {
            setMetadata((prev) => ({ ...prev, ...evt }));
            if (onComplete) onComplete(evt, textRef.current);
          } else if (evt.type === 'error') {
            const msg = evt.message || 'Stream error';
            setError(msg);
            if (onError) onError(new Error(msg));
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        setError(e.message || 'Stream failed');
        if (onError) onError(e);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [reset]);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  useEffect(() => () => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  return { stream, abort, isStreaming, streamingText, metadata, error, reset };
}
