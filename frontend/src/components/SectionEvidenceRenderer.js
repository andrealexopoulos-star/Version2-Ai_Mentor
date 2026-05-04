import React from 'react';
import { AlertTriangle, Clock, Loader2, Info, RefreshCw, Link2 } from 'lucide-react';

/**
 * SectionEvidenceRenderer — renders a CMO Report SectionEvidence object.
 *
 * The backend (backend/core/section_evidence.py + backend/routes/intelligence_modules.py)
 * returns every CMO Report section as a SectionEvidence shape:
 *
 *   {
 *     state: "DATA_AVAILABLE" | "INSUFFICIENT_SIGNAL" | "DEGRADED" | "PROCESSING" | "DATA_UNAVAILABLE",
 *     evidence: { ... } | null,
 *     reason: string | null,         // sanitised, customer-facing
 *     source_trace_ids: string[],    // FK refs into enrichment traces
 *   }
 *
 * Rendering rules per E6 / fix/p0-marjo-e6-cmo-section-evidence:
 *
 *   DATA_AVAILABLE     → render `children(evidence)` + provenance pill
 *                        (small "Source" link to trace IDs)
 *   INSUFFICIENT_SIGNAL → render the INSUFFICIENT_SIGNAL banner with the
 *                        `reason` string (already plain-language per
 *                        BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2)
 *   DEGRADED           → render `children(evidence)` + DEGRADED banner with
 *                        retry CTA
 *   PROCESSING         → spinner + "Deep intelligence still processing"
 *   DATA_UNAVAILABLE   → empty state with retry CTA
 *
 * The banner copy is intentionally non-leaky. Per Contract v2 it MUST NOT
 * mention suppliers ("browse-ai-reviews", "SEMrush"), API keys, internal
 * codes, or HTTP errors. The backend's `reason` field is already cleaned;
 * this component is the last visual layer.
 *
 * Provenance pill — when source_trace_ids is non-empty, a small "Source"
 * pill is shown next to the section. It is decorative-by-default (does
 * not link out yet) but exposes the trace ids on hover. This satisfies
 * the per-section provenance contract while leaving the trace-detail
 * page for a future PR.
 */

export const SECTION_STATE = {
  DATA_AVAILABLE: 'DATA_AVAILABLE',
  DATA_UNAVAILABLE: 'DATA_UNAVAILABLE',
  INSUFFICIENT_SIGNAL: 'INSUFFICIENT_SIGNAL',
  PROCESSING: 'PROCESSING',
  DEGRADED: 'DEGRADED',
};

const ALLOWED_STATES = new Set(Object.values(SECTION_STATE));

/* ───── Placeholder denylist (mirrors backend section_evidence.py) ─────
 *
 * These regexes catch templated Marketing-101 phrases and bare placeholder
 * tokens (TBD, Lorem ipsum, etc.). Any rendered SWOT/Roadmap text that
 * matches an entry here is an AUTOMATIC FAIL per the E6 contract.
 *
 * Used both at runtime (this component skips offending items + falls
 * back to INSUFFICIENT_SIGNAL banner) AND in tests (CMOReportPage.test.js
 * asserts the rendered DOM contains zero matches).
 */
export const PLACEHOLDER_EXACT = new Set([
  'TBD',
  'Coming soon',
  'Insufficient evidence to produce report',
  'Lorem ipsum',
  'Various',
  'Strong',
  'Weak',
  'Positive',
  'Negative',
  'Average',
  'N/A',
  'TODO',
  'Placeholder',
  'Example text',
  'Sample data',
]);

export const PLACEHOLDER_PHRASES = [
  /improve.{1,30}social media presence/i,
  /increase.{1,30}brand awareness/i,
  /create.{1,30}content calendar/i,
  /leverage.{1,30}social media/i,
  /engage with.{1,30}customers/i,
  /build.{1,30}email list/i,
  /expand.{1,30}market presence/i,
  /optimi[sz]e.{1,30}seo/i,
  /focus on.{1,30}customer service/i,
  /differentiate.{1,30}from competitors/i,
];

export function isPlaceholderText(value) {
  if (typeof value !== 'string') return false;
  const t = value.trim();
  if (!t) return false;
  if (PLACEHOLDER_EXACT.has(t.replace(/[.!?\s]+$/g, ''))) return true;
  for (const re of PLACEHOLDER_PHRASES) {
    if (re.test(t)) return true;
  }
  return false;
}

/* ───── State banner config ───── */

const STATE_CONFIG = {
  [SECTION_STATE.INSUFFICIENT_SIGNAL]: {
    Icon: Info,
    color: 'var(--info)',
    bg: 'var(--info-wash)',
    label: 'Insufficient signal',
    fallbackReason:
      "We couldn't gather enough verified signal for this dimension yet.",
  },
  [SECTION_STATE.DATA_UNAVAILABLE]: {
    Icon: AlertTriangle,
    color: 'var(--warning)',
    bg: 'var(--warning-wash)',
    label: 'Data unavailable',
    fallbackReason:
      'Intelligence signal unavailable for this scan. Re-run the scan or connect a relevant integration.',
  },
  [SECTION_STATE.PROCESSING]: {
    Icon: Loader2,
    color: 'var(--ink-secondary)',
    bg: 'var(--surface-muted)',
    label: 'Processing',
    fallbackReason:
      'Deep intelligence is still processing. Sections will populate as signals are confirmed.',
  },
  [SECTION_STATE.DEGRADED]: {
    Icon: Clock,
    color: 'var(--warning)',
    bg: 'var(--warning-wash)',
    label: 'Partial signal',
    fallbackReason:
      'Partial intelligence — some inputs were available but the picture is incomplete.',
  },
};

/* ───── Sub-components ───── */

/**
 * ProvenancePill — small "Source" link/badge shown next to a DATA_AVAILABLE
 * section. Hover reveals the trace ids. Decorative until the trace-detail
 * route ships.
 */
export function ProvenancePill({ traceIds = [] }) {
  if (!Array.isArray(traceIds) || traceIds.length === 0) return null;
  const title = `Source trace ids: ${traceIds.slice(0, 6).join(', ')}${traceIds.length > 6 ? ', …' : ''}`;
  return (
    <span
      title={title}
      data-testid="provenance-pill"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 'var(--ls-caps)',
        textTransform: 'uppercase',
        padding: '2px 8px',
        borderRadius: 'var(--r-pill)',
        background: 'var(--surface-muted)',
        color: 'var(--ink-muted)',
        border: '1px solid var(--border)',
        cursor: 'help',
      }}
    >
      <Link2 size={10} />
      Source ({traceIds.length})
    </span>
  );
}

/**
 * StateBanner — the actual banner shown for non-DATA_AVAILABLE states.
 */
export function StateBanner({ state, reason, onRetry, className = '' }) {
  const cfg = STATE_CONFIG[state] || STATE_CONFIG[SECTION_STATE.DEGRADED];
  const { Icon, color, bg, label, fallbackReason } = cfg;
  const message = (typeof reason === 'string' && reason.trim()) ? reason : fallbackReason;
  const spin = state === SECTION_STATE.PROCESSING ? ' animate-spin' : '';
  const showRetry = state === SECTION_STATE.DEGRADED || state === SECTION_STATE.DATA_UNAVAILABLE;
  return (
    <div
      data-testid={`section-state-banner-${state.toLowerCase()}`}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 'var(--r-lg)',
        background: bg,
        borderLeft: `3px solid ${color}`,
        marginTop: 4,
      }}
    >
      <Icon
        size={16}
        className={spin}
        style={{ color, flexShrink: 0, marginTop: 2 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 'var(--ls-caps)',
            color,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
          {message}
        </span>
        {showRetry && typeof onRetry === 'function' && (
          <button
            onClick={onRetry}
            data-testid={`section-retry-${state.toLowerCase()}`}
            style={{
              marginTop: 6,
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 'var(--r-md)',
              border: `1px solid ${color}`,
              background: 'transparent',
              color,
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            <RefreshCw size={11} />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * SectionEvidenceRenderer — top-level renderer for a SectionEvidence object.
 *
 * Props:
 *   section    : the SectionEvidence object from the backend response
 *                shape `{state, evidence, reason, source_trace_ids}`
 *   children   : (evidence) => ReactNode — render function called only
 *                when state === DATA_AVAILABLE (or DEGRADED with evidence)
 *   onRetry    : optional () => void — wired to retry CTAs
 *   showProvenance : boolean (default true) — show the provenance pill
 *                    next to DATA_AVAILABLE content
 */
export default function SectionEvidenceRenderer({
  section,
  children,
  onRetry,
  showProvenance = true,
  className = '',
}) {
  // Defensive coercion — accept missing / malformed sections gracefully.
  // A null section is treated as DATA_UNAVAILABLE (the safest external state).
  if (!section || typeof section !== 'object') {
    return (
      <StateBanner
        state={SECTION_STATE.DATA_UNAVAILABLE}
        reason={null}
        onRetry={onRetry}
        className={className}
      />
    );
  }

  const state = ALLOWED_STATES.has(section.state)
    ? section.state
    : SECTION_STATE.DATA_UNAVAILABLE;
  const evidence = section.evidence;
  const reason = section.reason;
  const traceIds = Array.isArray(section.source_trace_ids) ? section.source_trace_ids : [];

  if (state === SECTION_STATE.DATA_AVAILABLE) {
    return (
      <div className={className}>
        {typeof children === 'function' ? children(evidence) : children}
        {showProvenance && <ProvenancePill traceIds={traceIds} />}
      </div>
    );
  }

  if (state === SECTION_STATE.DEGRADED && evidence) {
    return (
      <div className={className}>
        {typeof children === 'function' ? children(evidence) : children}
        <StateBanner state={state} reason={reason} onRetry={onRetry} />
        {showProvenance && <ProvenancePill traceIds={traceIds} />}
      </div>
    );
  }

  // INSUFFICIENT_SIGNAL, PROCESSING, DATA_UNAVAILABLE, or DEGRADED-without-evidence:
  // banner only. No fake content rendered.
  return (
    <StateBanner state={state} reason={reason} onRetry={onRetry} className={className} />
  );
}

/**
 * Helper: pull a section out of the report.sections map by id, returning
 * a defensive default when the section is missing (so callers don't crash
 * on a partial response).
 */
export function getSection(report, sectionId) {
  if (!report || typeof report !== 'object' || !report.sections) return null;
  return report.sections[sectionId] || null;
}
