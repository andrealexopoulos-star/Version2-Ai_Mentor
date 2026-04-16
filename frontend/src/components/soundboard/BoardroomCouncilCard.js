import { fontFamily } from '../../design-system/tokens';

const safeModuloIndex = (index, size) => {
  const n = Math.max(1, Number(size) || 1);
  const i = Number(index) || 0;
  return ((i % n) + n) % n;
};

const BoardroomCouncilCard = ({
  checks = [],
  sourceLabels = [],
  activeIndex = 0,
  activeCheck = null,
  boardroomStatus = 'live',
  compact = false,
  testId = 'soundboard-boardroom-visualizer',
}) => {
  if (!Array.isArray(checks) || checks.length === 0) return null;
  const selectedIdx = safeModuloIndex(activeIndex, checks.length);
  const selected = activeCheck || checks[selectedIdx];
  const avatarSize = compact ? 'w-7 h-7 text-[9px]' : 'w-8 h-8 text-[10px]';
  const chipText = compact ? 'text-[9px]' : 'text-[10px]';
  const sourcePillPadding = compact ? 'px-1.5 py-0.5' : 'px-2 py-0.5';

  return (
    <div
      className={`${compact ? 'mb-2 rounded-xl px-3 py-2' : 'mb-2 rounded-2xl px-4 py-3'}`}
      style={{
        background: 'linear-gradient(145deg, rgba(2, 6, 23, 0.92), rgba(15, 23, 42, 0.92))',
        border: '1px solid rgba(59,130,246,0.4)'
      }}
      data-testid={testId}
    >
      <div className={`flex items-center justify-between gap-2 ${compact ? 'mb-2' : 'mb-3'}`}>
        <p className={`${compact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-wider`} style={{ color: '#93C5FD', fontFamily: fontFamily.mono }}>
          {boardroomStatus === 'fallback_error' ? 'Boardroom Council Degraded' : 'Boardroom Council Live'}
        </p>
        <p className={`${compact ? 'text-[9px]' : 'text-[10px]'}`} style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
          Data-aware role checks
        </p>
      </div>

      {sourceLabels.length > 0 && (
        <div className={`flex flex-wrap gap-1.5 ${compact ? 'mb-2' : 'mb-3'}`}>
          {sourceLabels.map((label) => (
            <span
              key={label}
              className={`${sourcePillPadding} rounded-md ${chipText}`}
              style={{
                background: 'rgba(16, 185, 129, 0.14)',
                color: '#6EE7B7',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                fontFamily: fontFamily.mono,
              }}
            >
              {compact ? label : `${label} connected`}
            </span>
          ))}
        </div>
      )}

      <div className={`flex flex-wrap ${compact ? 'gap-1.5 mb-2' : 'gap-2 mb-3'}`}>
        {checks.map((step, i) => {
          const isActive = i === selectedIdx;
          return (
            <div
              key={`${step.role}-avatar-${i}`}
              className={`${avatarSize} rounded-full flex items-center justify-center font-semibold`}
              style={{
                background: isActive ? 'radial-gradient(circle at 30% 30%, #60A5FA, #1E3A8A)' : 'rgba(51, 65, 85, 0.95)',
                color: isActive ? '#F8FAFC' : '#CBD5E1',
                border: isActive ? '2px solid rgba(147,197,253,0.85)' : '1px solid rgba(148,163,184,0.35)',
                boxShadow: isActive ? `0 0 0 ${compact ? '3px' : '4px'} rgba(59,130,246,0.18)` : 'none',
                transition: 'all 250ms ease',
                fontFamily: fontFamily.mono,
              }}
            >
              {step.role}
            </div>
          );
        })}
      </div>

      <div
        className={`${compact ? 'rounded-lg px-2.5 py-2 mb-2' : 'rounded-xl px-3 py-3 mb-3'}`}
        style={{ background: 'rgba(30, 41, 59, 0.75)', border: '1px solid rgba(96,165,250,0.35)' }}
      >
        <p className={`${compact ? 'text-[10px]' : 'text-xs'} font-semibold mb-1`} style={{ color: '#DBEAFE', fontFamily: fontFamily.mono }}>
          {selected?.role || 'Boardroom'}
        </p>
        <p className={`${compact ? 'text-xs' : 'text-sm'} leading-relaxed`} style={{ color: 'var(--ink, #171717)', fontFamily: fontFamily.body }}>
          {selected?.line || 'Checking strategic priorities...'}
        </p>
      </div>

      <div className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-1.5'}`}>
        {checks.map((step, i) => {
          const isActive = i === selectedIdx;
          return (
            <span
              key={`${step.role}-chip-${i}`}
              className={`${compact ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2.5 py-1'} rounded-lg`}
              style={{
                background: isActive ? 'rgba(59,130,246,0.25)' : 'rgba(30, 41, 59, 0.9)',
                color: isActive ? '#DBEAFE' : '#E2E8F0',
                border: compact ? 'none' : '1px solid rgba(148, 163, 184, 0.35)',
                fontFamily: fontFamily.mono,
              }}
            >
              {step.role}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default BoardroomCouncilCard;
