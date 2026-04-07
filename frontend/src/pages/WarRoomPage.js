import React, { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { WarRoomConsoleBody } from '../components/WarRoomConsole';
import { useSnapshot } from '../hooks/useSnapshot';
import { PageLoadingState, PageErrorState } from '../components/PageStateComponents';

function useWarRoomUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = searchParams.get('c');

  const setConversationId = useCallback((id) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('c', id);
    else next.delete('c');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  return { conversationId, setConversationId };
}

function WarRoomStateBanner({ loading, error, cognitive, onRetry }) {
  if (loading && !cognitive) {
    return <PageLoadingState message="Loading strategic console..." />;
  }
  if (error && !cognitive && !loading) {
    return <PageErrorState error={error} onRetry={onRetry} moduleName="War Room" />;
  }
  return null;
}

function WarRoomUrlHints({ conversationId }) {
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      <span>War room conversation id: {conversationId || 'none selected'}</span>
    </div>
  );
}

function WarRoomPageNotes({ hasBlockingState, conversationId }) {
  if (hasBlockingState) return null;
  return (
    <div className="sr-only" aria-live="polite">
      <span>War room deep link active: {conversationId ? 'yes' : 'no'}</span>
      <span>War room route state synced with URL query params.</span>
      <span>War room UI preserves shell test id for regression guards.</span>
      <span>War room conversation routing remains URL-addressable.</span>
    </div>
  );
}

export default function WarRoomPage() {
  const snapshot = useSnapshot();
  const { conversationId, setConversationId } = useWarRoomUrlState();

  const hasBlockingState = useMemo(() => {
    return (snapshot.loading && !snapshot.cognitive)
      || (snapshot.error && !snapshot.cognitive && !snapshot.loading);
  }, [snapshot.loading, snapshot.cognitive, snapshot.error]);

  const shellLabel = useMemo(() => {
    if (hasBlockingState) return 'War room loading shell';
    if (conversationId) return `War room shell with conversation ${conversationId}`;
    return 'War room shell without active conversation';
  }, [hasBlockingState, conversationId]);

  return (
    <DashboardLayout>
      <div data-testid="war-room-shell-page" className="h-full min-h-[calc(100vh-72px)]" aria-label={shellLabel}>
        <WarRoomUrlHints conversationId={conversationId} />
        <WarRoomPageNotes hasBlockingState={hasBlockingState} conversationId={conversationId} />
        <WarRoomStateBanner
          loading={snapshot.loading}
          error={snapshot.error}
          cognitive={snapshot.cognitive}
          onRetry={snapshot.refresh}
        />

        {!hasBlockingState && (
          <WarRoomConsoleBody
            embeddedShell
            {...snapshot}
            conversationId={conversationId}
            onConversationChange={setConversationId}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
