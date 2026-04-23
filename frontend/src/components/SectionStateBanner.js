import React from 'react';
import { AlertTriangle, Clock, Loader2, Info } from 'lucide-react';

/**
 * SectionStateBanner — renders a contract-v2 state indicator for an
 * intelligence section (seo_analysis, swot, competitor_analysis, etc.).
 *
 * The backend sanitizer (backend/core/response_sanitizer.py) annotates
 * every section with one of 5 ExternalState values:
 *   - DATA_AVAILABLE      → hide banner, render real data
 *   - DATA_UNAVAILABLE    → warning banner + the section's message
 *   - INSUFFICIENT_SIGNAL → info banner (we scanned but found too little)
 *   - PROCESSING          → loading banner
 *   - DEGRADED            → soft warning banner
 *
 * Contract v2 / Step 3f (2026-04-23). Paired with
 * BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2 memory file.
 *
 * Usage:
 *   <SectionStateBanner section={seoAnalysis} title="Organic Search Performance" />
 *   {isAvailable(seoAnalysis) && <RealSeoCard data={seoAnalysis} />}
 */

export const SECTION_STATE = {
  DATA_AVAILABLE: 'DATA_AVAILABLE',
  DATA_UNAVAILABLE: 'DATA_UNAVAILABLE',
  INSUFFICIENT_SIGNAL: 'INSUFFICIENT_SIGNAL',
  PROCESSING: 'PROCESSING',
  DEGRADED: 'DEGRADED',
};

// Returns true if the section has DATA_AVAILABLE state (or is missing a
// state field, for backward compatibility with pre-contract responses).
export function isAvailable(section) {
  if (!section || typeof section !== 'object') return false;
  if (!('state' in section)) return true;  // legacy — treat as available
  return section.state === SECTION_STATE.DATA_AVAILABLE;
}

// Returns the customer-safe message on the section, or a sensible default.
export function sectionMessage(section, fallback = 'Data not available for this scan') {
  if (!section || typeof section !== 'object') return fallback;
  if (section.message && typeof section.message === 'string') return section.message;
  return fallback;
}

const BANNER_CONFIG = {
  [SECTION_STATE.DATA_UNAVAILABLE]: {
    Icon: AlertTriangle,
    color: 'var(--warning)',
    bg: 'var(--warning-wash)',
    label: 'Data unavailable',
  },
  [SECTION_STATE.INSUFFICIENT_SIGNAL]: {
    Icon: Info,
    color: 'var(--info)',
    bg: 'var(--info-wash)',
    label: 'Insufficient signal',
  },
  [SECTION_STATE.PROCESSING]: {
    Icon: Loader2,
    color: 'var(--ink-secondary)',
    bg: 'var(--surface-muted)',
    label: 'Processing',
  },
  [SECTION_STATE.DEGRADED]: {
    Icon: Clock,
    color: 'var(--warning)',
    bg: 'var(--warning-wash)',
    label: 'Partial signal',
  },
};

/**
 * Minimal banner for any non-DATA_AVAILABLE state. Renders nothing for
 * DATA_AVAILABLE — caller renders their real card in that case.
 */
export default function SectionStateBanner({ section, title, className = '' }) {
  if (!section || typeof section !== 'object') {
    return (
      <div className={`rounded-md p-3 text-xs ${className}`} style={{ background: 'var(--surface-muted)', color: 'var(--ink-muted)' }}>
        {title ? <div className="font-semibold mb-1">{title}</div> : null}
        <div>Data not available for this scan.</div>
      </div>
    );
  }

  const state = section.state || SECTION_STATE.DATA_AVAILABLE;
  if (state === SECTION_STATE.DATA_AVAILABLE) return null;

  const config = BANNER_CONFIG[state] || BANNER_CONFIG[SECTION_STATE.DEGRADED];
  const { Icon, color, bg, label } = config;
  const spin = state === SECTION_STATE.PROCESSING ? ' animate-spin' : '';
  const message = sectionMessage(section);

  return (
    <div
      className={`rounded-md p-3 flex items-start gap-2 ${className}`}
      style={{ background: bg, borderLeft: `3px solid ${color}` }}
      data-testid={`section-state-banner-${state.toLowerCase()}`}
    >
      <Icon className={`w-4 h-4 shrink-0 mt-0.5${spin}`} style={{ color }} />
      <div>
        {title ? <div className="text-xs font-semibold mb-0.5" style={{ color: 'var(--ink-display)' }}>{title}</div> : null}
        <div className="text-[11px] uppercase tracking-wide mb-0.5" style={{ color, fontFamily: 'var(--font-mono)' }}>{label}</div>
        <div className="text-xs" style={{ color: 'var(--ink-secondary)' }}>{message}</div>
      </div>
    </div>
  );
}
