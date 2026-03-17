import DashboardLayout from '../components/DashboardLayout';
import WarRoomConsole from '../components/WarRoomConsole';

export default function WarRoomPage() {
  return (
    <DashboardLayout>
      <div data-testid="war-room-shell-page">
        <WarRoomConsole embeddedShell />
      </div>
    </DashboardLayout>
  );
}
