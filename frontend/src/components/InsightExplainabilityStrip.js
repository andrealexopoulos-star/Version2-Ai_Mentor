import React from 'react';
import { Eye, Clock3, ArrowRightCircle, AlertTriangle } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';

const ITEMS = [
  { key: 'whyVisible', label: 'Why you are seeing this', icon: Eye, color: '#3B82F6' },
  { key: 'whyNow', label: 'Why this matters now', icon: Clock3, color: '#F59E0B' },
  { key: 'nextAction', label: 'What to do next', icon: ArrowRightCircle, color: '#10B981' },
  { key: 'ifIgnored', label: 'If ignored', icon: AlertTriangle, color: '#EF4444' },
];

const InsightExplainabilityStrip = ({
  whyVisible,
  whyNow,
  nextAction,
  ifIgnored,
  className = '',
  testIdPrefix = 'insight-explainability',
}) => {
  const values = { whyVisible, whyNow, nextAction, ifIgnored };

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 ${className}`}
      data-testid={`${testIdPrefix}-strip`}
    >
      {ITEMS.map((item) => (
        <div
          key={item.key}
          className="rounded-xl p-4"
          style={{ background: 'var(--biqc-bg-card)', border: `1px solid ${item.color}30` }}
          data-testid={`${testIdPrefix}-${item.key}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <item.icon className="w-3.5 h-3.5" style={{ color: item.color }} />
            <span
              className="text-[10px] font-semibold tracking-widest uppercase"
              style={{ color: item.color, fontFamily: fontFamily.mono }}
            >
              {item.label}
            </span>
          </div>
          <p className="text-xs leading-relaxed break-words" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.body }}>
            {values[item.key]}
          </p>
        </div>
      ))}
    </div>
  );
};

export default InsightExplainabilityStrip;