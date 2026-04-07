import React, { useMemo } from 'react';
import { colors } from '../../design-system/tokens';

const SEVERITY_COLORS = {
  critical: colors.danger,
  high: colors.danger,
  warning: colors.warning,
  medium: colors.warning,
  info: colors.info,
  low: colors.success,
};

function getDaysArray() {
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  return days;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export default function WarRoomAlertTimeline({ alerts = [], onSelectDay }) {
  const days = getDaysArray();
  const alertsByDay = useMemo(() => days.map((day) => {
    const dayAlerts = alerts.filter((a) => isSameDay(new Date(a.created_at), day));
    const counts = { critical: 0, high: 0, warning: 0, info: 0 };
    for (const a of dayAlerts) {
      const sev = a.severity || 'info';
      if (counts[sev] !== undefined) counts[sev] += 1;
      else counts.info += 1;
    }
    return { day, alerts: dayAlerts, counts };
  }), [days, alerts]);

  const formatDay = (d) => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });

  return (
    <div className="h-20 border-t px-4 py-2 flex items-center gap-1 overflow-x-auto" style={{ borderColor: colors.border, background: colors.bgCard }} role="region" aria-label="7-day alert timeline" data-testid="war-room-timeline">
      {alertsByDay.map(({ day, alerts: dayAlerts, counts }) => {
        const total = dayAlerts.length;
        return (
          <button key={day.toISOString()} onClick={() => onSelectDay?.(day)} className="flex-1 min-w-[70px] flex flex-col items-center justify-center h-full rounded-lg hover:bg-white/5 transition-colors focus-visible:ring-2" aria-label={`${formatDay(day)}: ${total} alerts`} data-testid={`war-room-timeline-day-${day.toISOString().split('T')[0]}`}>
            <div className="text-[10px] mb-1" style={{ color: colors.textMuted }}>{formatDay(day)}</div>
            <div className="flex items-end gap-0.5 h-6">
              {counts.critical > 0 && <div className="w-1.5 rounded-sm" style={{ background: SEVERITY_COLORS.critical, height: `${Math.min(100, counts.critical * 20)}%`, minHeight: '4px' }} aria-hidden="true" />}
              {counts.high > 0 && <div className="w-1.5 rounded-sm" style={{ background: SEVERITY_COLORS.high, height: `${Math.min(100, counts.high * 20)}%`, minHeight: '4px' }} aria-hidden="true" />}
              {counts.warning > 0 && <div className="w-1.5 rounded-sm" style={{ background: SEVERITY_COLORS.warning, height: `${Math.min(100, counts.warning * 20)}%`, minHeight: '4px' }} aria-hidden="true" />}
              {counts.info > 0 && <div className="w-1.5 rounded-sm" style={{ background: SEVERITY_COLORS.info, height: `${Math.min(100, counts.info * 20)}%`, minHeight: '4px' }} aria-hidden="true" />}
            </div>
            <div className="text-[9px] mt-0.5" style={{ color: colors.textMuted }}>{total}</div>
          </button>
        );
      })}
    </div>
  );
}
