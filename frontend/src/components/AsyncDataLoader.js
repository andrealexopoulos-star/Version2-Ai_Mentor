/**
 * AsyncDataLoader — Universal async wrapper for all data-loading patterns.
 *
 * Handles: loading stages, determinate progress, partial results,
 * tier gating, integration gating, error fallback, timeout CTA.
 *
 * Usage:
 *   <AsyncDataLoader
 *     loading={loading}
 *     error={error}
 *     progress={progress}          // 0-100
 *     stage={stage}                // 'fetching' | 'analyzing' | 'assembling' | 'complete'
 *     tierLocked={false}           // show upgrade gate
 *     integrationMissing={null}    // 'crm' | 'accounting' | 'email' | null
 *     onRetry={refresh}
 *     onContinue={onContinue}      // fallback CTA at timeout
 *     loadingLabel="Analyzing signals..."
 *     emptyState={<EmptyState />}  // shown when no data + !loading + !error
 *   >
 *     {children}
 *   </AsyncDataLoader>
 */
import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, Lock, Plug, ArrowRight, MessageSquare } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import { getUpgradeContext } from '../lib/upgradeContext';

// ── Stage config ──────────────────────────────────────────────
const STAGE_CONFIG = {
  fetching:    { label: 'Fetching context',           pct: 15, color: '#3B82F6',
    tooltip: 'Reading your business profile, ABN, connected integrations and preferences.' },
  preprocessing:{ label: 'Preprocessing signals',     pct: 35, color: '#8B5CF6',
    tooltip: 'Cleaning and structuring your data ready for AI analysis.' },
  analyzing:   { label: 'Analysing your business',    pct: 60, color: '#FF6A00',
    tooltip: 'Running AI models across your revenue, cash, operations and market data.' },
  assembling:  { label: 'Preparing recommendations',  pct: 85, color: '#F59E0B',
    tooltip: 'Summarising insights and preparing your personalised intelligence report.' },
  complete:    { label: 'Ready',                       pct: 100, color: '#10B981',
    tooltip: 'Your intelligence snapshot is ready.' },
};

// ── Skeleton pulse card ───────────────────────────────────────
export const SkeletonCard = ({ lines = 3, className = '' }) => (
  <div className={`rounded-xl p-5 animate-pulse ${className}`} style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
    <div className="h-2 rounded mb-3 w-1/3" style={{ background: '#243140' }} />
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="h-2 rounded mb-2" style={{ background: '#1E2A38', width: `${100 - i * 15}%` }} />
    ))}
  </div>
);

// ── Determinate progress bar ──────────────────────────────────
export const StageProgressBar = ({ stage = 'analyzing', progress = null, startedAt = null }) => {
  const [displayPct, setDisplayPct] = useState(5);
  const sc = STAGE_CONFIG[stage] || STAGE_CONFIG.analyzing;

  // If real progress provided, use it; otherwise approximate over 30s
  useEffect(() => {
    if (progress !== null) { setDisplayPct(Math.min(progress, 99)); return; }
    if (!startedAt) { setDisplayPct(5); return; }
    const tick = () => {
      const elapsed = (Date.now() - startedAt) / 1000;
      // Ease-out curve: 95% at 30s, slows before 100
      const approx = Math.min(95, Math.round(95 * (1 - Math.exp(-elapsed / 18))));
      setDisplayPct(approx);
    };
    const interval = setInterval(tick, 500);
    tick();
    return () => clearInterval(interval);
  }, [progress, startedAt, stage]);

  const stages = Object.keys(STAGE_CONFIG).filter(k => k !== 'complete');
  const currentIdx = stages.indexOf(stage);

  return (
    <div className="w-full" data-testid="stage-progress-bar">
      {/* Stage pills with tooltips */}
      <div className="flex items-center justify-between mb-3 overflow-x-auto gap-1">
        {stages.map((s, i) => {
          const past = i < currentIdx;
          const active = i === currentIdx;
          const sc2 = STAGE_CONFIG[s];
          return (
            <div key={s} className="flex items-center gap-1 flex-shrink-0">
              <div
                className="relative group px-2 py-1 rounded text-[9px] font-semibold whitespace-nowrap transition-all cursor-default"
                style={{
                  background: active ? sc2.color + '20' : past ? '#10B98110' : 'transparent',
                  color: active ? sc2.color : past ? '#10B981' : '#4A5568',
                  border: `1px solid ${active ? sc2.color + '40' : past ? '#10B98130' : '#243140'}`,
                  fontFamily: fontFamily.mono,
                }}
                tabIndex={0}
                role="status"
                aria-label={`${sc2.label}: ${sc2.tooltip}`}
              >
                {active && <span className="mr-1">●</span>}{sc2.label}
                {/* Tooltip */}
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-[10px] leading-snug pointer-events-none opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity z-50"
                  style={{
                    background: '#1E2A38',
                    border: '1px solid #2D3E50',
                    color: 'var(--biqc-text-2)',
                    fontFamily: fontFamily.body,
                    width: '160px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  }}
                  role="tooltip"
                >
                  <span className="font-semibold block mb-0.5" style={{ color: sc2.color, fontFamily: fontFamily.mono }}>
                    {sc2.label}
                  </span>
                  {sc2.tooltip}
                  {/* Arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0" style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #2D3E50' }} />
                </div>
              </div>
              {i < stages.length - 1 && (
                <div className="w-3 h-px flex-shrink-0" style={{ background: past ? '#10B98150' : '#243140' }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Bar */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#243140' }}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${displayPct}%`, background: sc.color }}
          data-testid="progress-fill"
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[9px]" style={{ color: sc.color, fontFamily: fontFamily.mono }}>{sc.label}…</span>
        <span className="text-[9px]" style={{ color: '#4A5568', fontFamily: fontFamily.mono }}>{displayPct}%</span>
      </div>
    </div>
  );
};

// ── Tier gate ─────────────────────────────────────────────────
const TierGateBanner = ({ feature = 'this feature' }) => {
  const ctx = getUpgradeContext(String(feature || '').toLowerCase());
  return (
    <div className="rounded-xl p-6 text-center" style={{ background: '#FF6A0006', border: '1px solid #FF6A0025' }} data-testid="tier-gate-banner">
      <Lock className="w-8 h-8 mx-auto mb-3" style={{ color: '#FF6A00' }} />
      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>
        Unlock {ctx.title}: {ctx.benefit}
      </p>
      <p className="text-xs mb-4" style={{ color: 'var(--biqc-text-2)' }}>
        Included in BIQc Foundation.
      </p>
      <a
        href={ctx.href}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
        style={{ background: '#FF6A00' }}
        data-testid="tier-gate-upgrade-btn"
      >
        {ctx.cta} <ArrowRight className="w-4 h-4" />
      </a>
    </div>
  );
};

// ── Integration gate ──────────────────────────────────────────
const IntegrationGateBanner = ({ category = 'crm' }) => {
  const META = {
    crm: { label: 'CRM', cta: 'Connect HubSpot or Salesforce' },
    accounting: { label: 'Accounting', cta: 'Connect Xero or QuickBooks' },
    email: { label: 'Email', cta: 'Connect Gmail or Outlook' },
  };
  const m = META[category] || META.crm;
  return (
    <div className="rounded-xl p-5" style={{ background: '#F59E0B06', border: '1px solid #F59E0B25' }} data-testid="integration-gate-banner">
      <div className="flex items-start gap-3">
        <Plug className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#F59E0B' }} />
        <div className="flex-1">
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>
            {m.label} not connected — analysis limited
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--biqc-text-2)' }}>
            Connect your {m.label} to unlock full analysis. Current results are based on available signals only.
          </p>
          <a href="/integrations" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: '#F59E0B' }}>
            <Plug className="w-3.5 h-3.5" /> {m.cta}
          </a>
        </div>
      </div>
    </div>
  );
};

// ── Error state ───────────────────────────────────────────────
const ErrorPanel = ({ error, onRetry, moduleName = 'this module' }) => (
  <div className="rounded-xl p-6" style={{ background: '#EF444406', border: '1px solid #EF444425' }} data-testid="async-error-panel">
    <div className="flex items-start gap-3 mb-4">
      <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-[#EF4444]" />
      <div>
        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>
          Failed to load {moduleName}
        </p>
        <p className="text-xs mb-2" style={{ color: 'var(--biqc-text-2)' }}>
          {error || 'An unexpected error occurred. Check your connection and try again.'}
        </p>
        <div className="text-xs space-y-1" style={{ color: '#64748B', fontFamily: fontFamily.mono }}>
          <p>Possible causes: network timeout · missing credentials · service outage</p>
        </div>
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      {onRetry && (
        <button
          onClick={onRetry}
          data-testid="async-retry-btn"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:brightness-110"
          style={{ background: '#EF4444' }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry now
        </button>
      )}
      <a
        href="mailto:support@biqc.com.au"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{ color: 'var(--biqc-text-2)', background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}
        data-testid="async-support-link"
      >
        <MessageSquare className="w-3.5 h-3.5" /> Contact support
      </a>
      <a
        href="/knowledge-base"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={{ color: 'var(--biqc-text-2)', background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}
        data-testid="async-troubleshoot-link"
      >
        View troubleshooting guide
      </a>
    </div>
  </div>
);

// ── Main AsyncDataLoader ──────────────────────────────────────
const AsyncDataLoader = ({
  loading = false,
  error = null,
  progress = null,
  stage = 'analyzing',
  tierLocked = false,
  integrationMissing = null,    // 'crm' | 'accounting' | 'email' | null
  onRetry = null,
  onContinue = null,            // fallback CTA after timeout
  loadingLabel = 'Loading intelligence…',
  timeoutMs = 35000,
  moduleName = 'module',
  feature = 'this feature',
  children,
  emptyState = null,
  showProgressBar = true,
}) => {
  const [startedAt] = useState(() => Date.now());
  const [timedOut, setTimedOut] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => { setTimedOut(true); setCtaVisible(true); }, timeoutMs);
    return () => clearTimeout(t);
  }, [loading, timeoutMs]);

  // Tier gate — disabled, full access for all users
  // if (tierLocked) return <TierGateBanner feature={feature} />;

  // Error state
  if (error && !loading) return <ErrorPanel error={error} onRetry={onRetry} moduleName={moduleName} />;

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4" data-testid="async-loading-state">
        {showProgressBar && (
          <div className="rounded-xl p-5" style={{ background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}>
            <StageProgressBar stage={stage} progress={progress} startedAt={startedAt} />
          </div>
        )}

        {/* Skeleton cards while loading */}
        <SkeletonCard lines={3} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>

        {/* Timeout fallback CTA */}
        {ctaVisible && onContinue && (
          <div className="rounded-xl p-5 text-center" style={{ background: '#FF6A0008', border: '1px solid #FF6A0025' }} data-testid="timeout-fallback-cta">
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>
              Taking longer than expected
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--biqc-text-2)' }}>
              Analysis continues in the background. You'll be notified when it's ready.
            </p>
            <button
              onClick={onContinue}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: '#FF6A00' }}
              data-testid="timeout-continue-btn"
            >
              Continue to Intelligence Platform <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Empty state (no error, no loading, no data)
  if (!children && emptyState) return emptyState;

  return (
    <div data-testid="async-content">
      {integrationMissing && (
        <div className="mb-4">
          <IntegrationGateBanner category={integrationMissing} />
        </div>
      )}
      {children}
    </div>
  );
};

export default AsyncDataLoader;
export { TierGateBanner, IntegrationGateBanner, ErrorPanel };
