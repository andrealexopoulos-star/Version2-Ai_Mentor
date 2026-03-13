import React from 'react';
import { UserRound, CalendarClock, Flag, Target } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';

const ActionOwnershipCard = ({
  title,
  owner,
  deadline,
  checkpoint,
  successMetric,
  testIdPrefix = 'action-ownership',
  className = '',
}) => {
  const items = [
    { label: 'Owner', value: owner, icon: UserRound, color: '#3B82F6', key: 'owner' },
    { label: 'Deadline', value: deadline, icon: CalendarClock, color: '#F59E0B', key: 'deadline' },
    { label: 'Checkpoint', value: checkpoint, icon: Flag, color: '#10B981', key: 'checkpoint' },
    { label: 'Success metric', value: successMetric, icon: Target, color: '#FF6A00', key: 'success' },
  ];

  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}
      data-testid={`${testIdPrefix}-card`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <p
          className="text-[10px] font-semibold tracking-widest uppercase"
          style={{ color: '#64748B', fontFamily: fontFamily.mono }}
          data-testid={`${testIdPrefix}-title`}
        >
          {title}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3" data-testid={`${testIdPrefix}-items`}>
        {items.map((item) => (
          <div
            key={item.key}
            className="rounded-lg p-3"
            style={{ background: 'var(--biqc-bg)', border: `1px solid ${item.color}25` }}
            data-testid={`${testIdPrefix}-${item.key}`}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <item.icon className="w-3.5 h-3.5" style={{ color: item.color }} />
              <span className="text-[10px]" style={{ color: item.color, fontFamily: fontFamily.mono }}>
                {item.label}
              </span>
            </div>
            <p className="text-xs leading-relaxed break-words" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActionOwnershipCard;