import React from 'react';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { fontFamily } from '../../design-system/tokens';
import { SourceProvenanceBadge } from '../advisor/SourceProvenanceBadge';

export const SurfaceCard = ({ children, className = '', testId }) => (
  <div
    className={`rounded-2xl border p-5 ${className}`}
    style={{ background: 'var(--biqc-bg-card)', borderColor: 'var(--biqc-border)' }}
    data-testid={testId}
  >
    {children}
  </div>
);

export const SurfaceHeader = ({ eyebrow, title, question, summary, rightSlot, testIdPrefix }) => (
  <div className="flex flex-wrap items-start justify-between gap-4" data-testid={`${testIdPrefix}-header`}>
    <div className="max-w-3xl space-y-2">
      <p className="text-[11px] uppercase tracking-[0.08em]" style={{ fontFamily: fontFamily.mono, color: '#E85D00' }} data-testid={`${testIdPrefix}-eyebrow`}>
        — {eyebrow}
      </p>
      <h1 className="font-medium" style={{ fontFamily: fontFamily.display, color: 'var(--ink-display, #0A0A0A)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.05 }} data-testid={`${testIdPrefix}-title`}>
        {title}
      </h1>
      <p className="text-sm" style={{ fontFamily: fontFamily.body, color: 'var(--ink-secondary, #8FA0B8)' }} data-testid={`${testIdPrefix}-question`}>
        {question}
      </p>
      <p className="text-sm text-[var(--ink-secondary)]" style={{ fontFamily: fontFamily.body }} data-testid={`${testIdPrefix}-summary`}>
        {summary}
      </p>
    </div>
    {rightSlot ? <div data-testid={`${testIdPrefix}-right-slot`}>{rightSlot}</div> : null}
  </div>
);

export const MetricCard = ({ label, value, caption, tone = '#E85D00', testId }) => (
  <SurfaceCard testId={testId}>
    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-secondary)]" style={{ fontFamily: fontFamily.mono }}>{label}</p>
    <div className="mt-3 flex items-end gap-2">
      <span className="text-3xl md:text-4xl font-bold" style={{ color: tone, fontFamily: fontFamily.mono }}>{value}</span>
    </div>
    <p className="mt-2 text-sm text-[var(--ink-secondary)]" style={{ fontFamily: fontFamily.body }}>{caption}</p>
  </SurfaceCard>
);

export const SectionLabel = ({ title, detail, testId }) => (
  <div className="space-y-1" data-testid={testId}>
    <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-secondary)]" style={{ fontFamily: fontFamily.mono }}>{title}</p>
    {detail ? <p className="text-sm text-[#CBD5E1]" style={{ fontFamily: fontFamily.body }}>{detail}</p> : null}
  </div>
);

export const SignalCard = ({ title, detail, action, source, signalType, timestamp, severity = 'medium', testId }) => {
  const tone = severity === 'critical' ? '#EF4444' : severity === 'high' ? '#F97316' : severity === 'warning' ? '#F59E0B' : '#3B82F6';
  return (
    <SurfaceCard testId={testId}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }} data-testid={`${testId}-title`}>{title}</p>
            <p className="mt-1 text-sm text-[#CBD5E1]" style={{ fontFamily: fontFamily.body }} data-testid={`${testId}-detail`}>{detail}</p>
          </div>
          <span className="rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: `${tone}55`, color: tone, fontFamily: fontFamily.mono }} data-testid={`${testId}-severity`}>
            {severity}
          </span>
        </div>
        <SourceProvenanceBadge source={source} signalType={signalType} timestamp={timestamp} testId={`${testId}-provenance`} />
        {action ? (
          <div className="rounded-xl border px-3 py-2" style={{ borderColor: `${tone}33`, background: `${tone}10` }} data-testid={`${testId}-action`}>
            <p className="text-sm" style={{ color: 'var(--ink, #171717)', fontFamily: fontFamily.body }}>{action}</p>
          </div>
        ) : null}
      </div>
    </SurfaceCard>
  );
};

export const EmptyStateCard = ({ title, detail, testId }) => (
  <SurfaceCard testId={testId}>
    <div className="flex items-start gap-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 text-[#F59E0B]" />
      <div>
        <p className="text-lg" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>{title}</p>
        <p className="mt-2 text-sm text-[var(--ink-secondary)]" style={{ fontFamily: fontFamily.body }}>{detail}</p>
      </div>
    </div>
  </SurfaceCard>
);

export const QuietActionLink = ({ label, onClick, testId }) => (
  <button
    onClick={onClick}
    className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border px-3 py-2 text-xs transition-colors hover:bg-black/5"
    style={{ borderColor: 'var(--biqc-border)', color: 'var(--ink-secondary, #525252)', fontFamily: fontFamily.mono }}
    data-testid={testId}
  >
    {label} <ArrowRight className="h-3.5 w-3.5" />
  </button>
);