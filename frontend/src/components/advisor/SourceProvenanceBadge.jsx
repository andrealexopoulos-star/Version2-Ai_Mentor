import React from 'react';
import { Database, RadioTower, Clock3 } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';

const SOURCE_STYLE = {
  CRM: { bg: '#3B82F615', border: '#3B82F640', text: '#93C5FD' },
  Accounting: { bg: '#E85D0015', border: '#E85D0040', text: '#FDBA74' },
  'Email/Calendar': { bg: '#10B98115', border: '#10B98140', text: '#86EFAC' },
  'Observation Events': { bg: '#F59E0B15', border: '#F59E0B40', text: '#FCD34D' },
  'Market Feed': { bg: '#A855F715', border: '#A855F740', text: '#D8B4FE' },
  Snapshot: { bg: '#64748B15', border: '#64748B40', text: '#CBD5E1' },
};

const prettySignal = (signal = '') =>
  signal.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const prettyTime = (value) => {
  if (!value) return 'Recent';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Recent';
  return parsed.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const SourceProvenanceBadge = ({ source, signalType, timestamp, testId }) => {
  const style = SOURCE_STYLE[source] || SOURCE_STYLE.Snapshot;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={testId}>
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px]"
        style={{ background: style.bg, borderColor: style.border, color: style.text, fontFamily: fontFamily.mono }}
        data-testid={`${testId}-source`}
      >
        <Database className="h-3 w-3" />
        {source}
      </span>
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px]"
        style={{ background: '#1E293B', borderColor: '#334155', color: 'var(--ink-secondary, #525252)', fontFamily: fontFamily.mono }}
        data-testid={`${testId}-signal`}
      >
        <RadioTower className="h-3 w-3" />
        {prettySignal(signalType || 'business_signal')}
      </span>
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px]"
        style={{ background: 'var(--surface-sunken, #F5F5F5)', borderColor: '#334155', color: 'var(--ink-muted, #737373)', fontFamily: fontFamily.mono }}
        data-testid={`${testId}-time`}
      >
        <Clock3 className="h-3 w-3" />
        {prettyTime(timestamp)}
      </span>
    </div>
  );
};
