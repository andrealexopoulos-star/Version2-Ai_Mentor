import React, { useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { BoardRoomBody } from '../components/BoardRoom';
import { useSnapshot } from '../hooks/useSnapshot';
import { PageLoadingState, PageErrorState } from '../components/PageStateComponents';
/* fontFamily import removed — using CSS custom properties */

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
      <div
        data-testid="board-room-shell-page"
        className="h-full min-h-[calc(100vh-72px)]"
        aria-label={shellLabel}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <BoardroomUrlHints conversationId={conversationId} focusArea={focusArea} />
        <BoardroomStateBanner
          loading={loading}
          error={error}
          cognitive={cognitive}
          onRetry={refresh}
        />

        {!hasBlockingState && (
          <>
            <div style={{ flex: 1, minHeight: 0 }}>
              <BoardRoomBody
                embeddedShell
                cognitive={cognitive}
                briefingLoading={loading}
                snapshotRefresh={refresh}
                conversationId={conversationId}
                initialFocusArea={focusArea}
                onConversationChange={setConversationId}
                onFocusAreaChange={setFocusArea}
              />
            </div>

            {/* Pro upsell banner -- matches mockup */}
            <div
              style={{
                margin: '0 24px 16px',
                padding: '16px 20px',
                background: 'linear-gradient(135deg, var(--surface-sunken), var(--surface))',
                borderRadius: 'var(--r-lg)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                color: 'var(--ink-display)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--elev-1)',
              }}
              data-testid="boardroom-pro-upsell"
            >
              <div style={{ flex: 1 }}>
                <strong
                  style={{
                    fontSize: 14,
                    fontFamily: 'var(--font-ui)',
                    display: 'block',
                    marginBottom: 2,
                  }}
                >
                  Need crisis-level analysis? Unlock WarRoom.
                </strong>
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: 'var(--font-ui)',
                    color: 'var(--ink-muted)',
                  }}
                >
                  Pro tier adds real-time threat detection, cross-domain signal groups, and compliance tools.
                </span>
              </div>
              <Link
                to="/subscribe"
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--r-md)',
                  background: 'linear-gradient(135deg, var(--lava), var(--lava-warm))',
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-ui)',
                  whiteSpace: 'nowrap',
                  textDecoration: 'none',
                  transition: 'box-shadow 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 12px var(--lava-ring)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
              >
                Upgrade to Pro &rarr;
              </Link>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
