import React, { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { BoardRoomBody } from '../components/BoardRoom';
import { useSnapshot } from '../hooks/useSnapshot';
import { PageLoadingState, PageErrorState } from '../components/PageStateComponents';

function useBoardroomUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = searchParams.get('c');
  const focusArea = searchParams.get('area');

  const setConversationId = useCallback((id) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('c', id);
    else next.delete('c');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const setFocusArea = useCallback((area) => {
    const next = new URLSearchParams(searchParams);
    if (area) next.set('area', area);
    else next.delete('area');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  return { conversationId, focusArea, setConversationId, setFocusArea };
}

function BoardroomStateBanner({ loading, error, cognitive, onRetry }) {
  if (loading && !cognitive) {
    return <PageLoadingState message="Loading boardroom..." />;
  }
  if (error && !cognitive && !loading) {
    return <PageErrorState error={error} onRetry={onRetry} moduleName="Boardroom" />;
  }
  return null;
}

function BoardroomUrlHints({ conversationId, focusArea }) {
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      <span>Boardroom conversation id: {conversationId || 'none selected'}</span>
      <span>Boardroom focus area: {focusArea || 'none selected'}</span>
    </div>
  );
}

export default function BoardRoomPage() {
  const { loading, error, cognitive, refresh } = useSnapshot();
  const {
    conversationId,
    focusArea,
    setConversationId,
    setFocusArea,
  } = useBoardroomUrlState();

  const hasBlockingState = useMemo(() => {
    return (loading && !cognitive) || (error && !cognitive && !loading);
  }, [loading, cognitive, error]);

  const shellLabel = useMemo(() => {
    if (hasBlockingState) return 'Boardroom loading shell';
    if (conversationId) return `Boardroom shell with conversation ${conversationId}`;
    return 'Boardroom shell without active conversation';
  }, [hasBlockingState, conversationId]);

  return (
    <DashboardLayout>
      <div data-testid="board-room-shell-page" className="h-full min-h-[calc(100vh-72px)]" aria-label={shellLabel}>
        <BoardroomUrlHints conversationId={conversationId} focusArea={focusArea} />
        <BoardroomStateBanner
          loading={loading}
          error={error}
          cognitive={cognitive}
          onRetry={refresh}
        />

        {!hasBlockingState && (
          <BoardRoomBody
            embeddedShell
            cognitive={cognitive}
            briefingLoading={loading}
            conversationId={conversationId}
            initialFocusArea={focusArea}
            onConversationChange={setConversationId}
            onFocusAreaChange={setFocusArea}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
