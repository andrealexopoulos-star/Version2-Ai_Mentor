import DashboardLayout from '../components/DashboardLayout';
import BoardRoom from '../components/BoardRoom';

export default function BoardRoomPage() {
  return (
    <DashboardLayout>
      <div data-testid="board-room-shell-page">
        <BoardRoom embeddedShell />
      </div>
    </DashboardLayout>
  );
}
