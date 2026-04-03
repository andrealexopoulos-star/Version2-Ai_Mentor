import React from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';

const STATUS_STYLE = {
  active: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.35)', color: '#10B981', label: 'Active' },
  foundation: { bg: 'rgba(255,106,0,0.15)', border: 'rgba(255,106,0,0.35)', color: '#FF6A00', label: 'Foundation' },
  waitlist: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.35)', color: '#3B82F6', label: 'Waitlist' },
  locked: { bg: 'rgba(100,116,139,0.16)', border: 'rgba(100,116,139,0.35)', color: '#94A3B8', label: 'Locked' },
};

function UsageMeter({ usage }) {
  if (!usage || !Number.isFinite(usage.used) || !Number.isFinite(usage.limit) || usage.limit <= 0) return null;
  const pct = Math.min(100, Math.max(0, Math.round((usage.used / usage.limit) * 100)));
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: '#94A3B8', fontFamily: fontFamily.mono }}>
          {usage.label || 'Usage'}
        </span>
        <span className="text-[10px]" style={{ color: '#CBD5E1', fontFamily: fontFamily.mono }}>
          {usage.used}/{usage.limit}
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full" style={{ background: 'rgba(148,163,184,0.24)' }}>
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: pct >= 90 ? '#F97316' : '#FF6A00' }} />
      </div>
    </div>
  );
}

export default function UnifiedModuleCard({
  title,
  valueStatement,
  status = 'locked',
  bullets = [],
  usage,
  lockReason,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  testId,
}) {
  const style = STATUS_STYLE[status] || STATUS_STYLE.locked;
  return (
    <article
      className="rounded-[24px] border p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(5,10,20,0.3)]"
      style={{ borderColor: 'var(--biqc-border)', background: 'var(--biqc-bg-card)' }}
      data-testid={testId}
    >
      <div className="inline-flex items-center gap-2 rounded-full px-2.5 py-1" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
        {status === 'locked' ? <Lock className="h-3 w-3" style={{ color: style.color }} /> : null}
        <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: style.color, fontFamily: fontFamily.mono }}>
          {style.label}
        </span>
      </div>
      <h3 className="mt-3 text-xl" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>
        {title}
      </h3>
      <p className="mt-2 text-sm" style={{ color: 'var(--biqc-text-2)' }}>
        {valueStatement}
      </p>
      {lockReason ? (
        <p className="mt-2 text-xs" style={{ color: '#F59E0B', fontFamily: fontFamily.mono }}>
          {lockReason}
        </p>
      ) : null}

      {bullets.length > 0 ? (
        <div className="mt-4 space-y-2">
          {bullets.slice(0, 2).map((line) => (
            <div key={line} className="rounded-xl px-3 py-2 text-sm" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--biqc-text-2)' }}>
              {line}
            </div>
          ))}
        </div>
      ) : null}

      <UsageMeter usage={usage} />

      <div className="mt-5 flex flex-wrap gap-2">
        {secondaryLabel ? (
          <button
            onClick={onSecondary}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-3 py-2 text-xs hover:bg-white/5"
            style={{ borderColor: 'var(--biqc-border)', color: 'var(--biqc-text)', fontFamily: fontFamily.mono }}
          >
            {secondaryLabel} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {primaryLabel ? (
          <button
            onClick={onPrimary}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white"
            style={{ background: '#FF6A00', fontFamily: fontFamily.body }}
          >
            {primaryLabel}
          </button>
        ) : null}
      </div>
    </article>
  );
}

