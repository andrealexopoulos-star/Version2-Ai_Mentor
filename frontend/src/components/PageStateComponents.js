/**
 * PageLoadingState — Consistent loading state for ALL dashboard pages.
 * PageErrorState   — Consistent error state for ALL dashboard pages.
 *
 * Apply everywhere: replace individual spinners with these.
 */
import React from 'react';
import { RefreshCw, AlertCircle, MessageSquare } from 'lucide-react';
import { fontFamily } from '../design-system/tokens';
import { SkeletonCard } from './AsyncDataLoader';

/**
 * PageLoadingState
 * @param {string} message - optional label shown during load
 * @param {boolean} compact - smaller variant for inline use
 */
export const PageLoadingState = ({ message = 'Loading…', compact = false }) => {
  if (compact) {
    return (
      <div className="flex items-center gap-2 py-4" data-testid="page-loading-compact">
        <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#E85D00', borderTopColor: 'transparent' }} />
        <span className="text-sm" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.mono }}>{message}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full" data-testid="page-loading-state">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
          style={{ borderColor: '#E85D00', borderTopColor: 'transparent' }} />
        <span className="text-sm" style={{ color: 'var(--biqc-text-2)', fontFamily: fontFamily.mono }}>{message}</span>
      </div>
      <SkeletonCard lines={3} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
      <SkeletonCard lines={1} />
    </div>
  );
};

/**
 * PageErrorState
 * @param {string} error - error message
 * @param {function} onRetry - retry callback
 * @param {string} moduleName - display name of the module
 */
export const PageErrorState = ({ error, onRetry, moduleName = 'this page' }) => (
  <div className="rounded-xl p-6 w-full" style={{ background: '#EF444406', border: '1px solid #EF444425' }} data-testid="page-error-state">
    <div className="flex items-start gap-3 mb-4">
      <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-[#EF4444]" />
      <div>
        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--biqc-text)', fontFamily: fontFamily.display }}>
          Unable to load {moduleName}
        </p>
        <p className="text-xs mb-2" style={{ color: 'var(--biqc-text-2)' }}>
          {error || 'An unexpected error occurred. Please check your connection and try again.'}
        </p>
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      {onRetry && (
        <button
          onClick={onRetry}
          data-testid="page-error-retry-btn"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
          style={{ background: '#EF4444' }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
      <a
        href="mailto:support@biqc.com.au"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
        style={{ color: 'var(--biqc-text-2)', background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}
        data-testid="page-error-support-link"
      >
        <MessageSquare className="w-3.5 h-3.5" /> Contact support
      </a>
      <a
        href="/knowledge-base"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
        style={{ color: 'var(--biqc-text-2)', background: 'var(--biqc-bg-card)', border: '1px solid var(--biqc-border)' }}
        data-testid="page-error-troubleshoot-link"
      >
        Troubleshoot
      </a>
    </div>
  </div>
);

export default PageLoadingState;
