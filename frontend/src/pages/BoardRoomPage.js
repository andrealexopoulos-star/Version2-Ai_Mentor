import DashboardLayout from '../components/DashboardLayout';
import { BoardRoomBody } from '../components/BoardRoom';
import { useSnapshot } from '../hooks/useSnapshot';
import { PageLoadingState, PageErrorState } from '../components/PageStateComponents';

export default function BoardRoomPage() {
  const { loading, error, cognitive, refresh } = useSnapshot();

  return (
    <DashboardLayout>
      <div data-testid="board-room-shell-page">
        {loading && !cognitive && <PageLoadingState message="Loading boardroom..." />}
        {error && !cognitive && !loading && (
          <PageErrorState error={error} onRetry={refresh} moduleName="Boardroom" />
        )}
        {!(loading && !cognitive) && !(error && !cognitive && !loading) && (
          <BoardRoomBody embeddedShell cognitive={cognitive} briefingLoading={loading} />
        )}
      </div>
    </DashboardLayout>
  );
}
