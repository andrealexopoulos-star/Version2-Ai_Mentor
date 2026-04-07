import DashboardLayout from '../components/DashboardLayout';
import { WarRoomConsoleBody } from '../components/WarRoomConsole';
import { useSnapshot } from '../hooks/useSnapshot';
import { PageLoadingState, PageErrorState } from '../components/PageStateComponents';

export default function WarRoomPage() {
  const snapshot = useSnapshot();

  return (
    <DashboardLayout>
      <div data-testid="war-room-shell-page">
        {snapshot.loading && !snapshot.cognitive && <PageLoadingState message="Loading strategic console..." />}
        {snapshot.error && !snapshot.cognitive && !snapshot.loading && (
          <PageErrorState error={snapshot.error} onRetry={snapshot.refresh} moduleName="War Room" />
        )}
        {!(snapshot.loading && !snapshot.cognitive) && !(snapshot.error && !snapshot.cognitive && !snapshot.loading) && (
          <WarRoomConsoleBody embeddedShell {...snapshot} />
        )}
      </div>
    </DashboardLayout>
  );
}
