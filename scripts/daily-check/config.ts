// Shared config + denylists for daily CMO check.
//
// Sourced from BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2.md.
// If this file drifts, the test will produce false negatives. Keep aligned.

/**
 * Contract v2 supplier-name denylist. External-facing surfaces (frontend HTML,
 * generated PDFs) MUST NEVER mention these suppliers by name. If any of these
 * appear in rendered HTML or PDF text, the test FAILS — surfacing the leak as
 * a P0 per Andreas's standing order.
 *
 * Each entry is a /pattern/i regex. Bounded with word-ish boundaries to avoid
 * false positives on unrelated words (e.g. "Open Library" should not flag
 * "OpenAI"). We use \b word boundaries for plain identifiers and explicit
 * lookarounds for compound brand names.
 */
export const SUPPLIER_NAME_DENYLIST: { pattern: RegExp; label: string }[] = [
  { pattern: /\bSEMrush\b/i, label: 'SEMrush' },
  { pattern: /\bSemrush\b/, label: 'Semrush (case-sensitive variant)' },
  { pattern: /\bOpenAI\b/i, label: 'OpenAI' },
  { pattern: /\bPerplexity\b/i, label: 'Perplexity' },
  { pattern: /\bFirecrawl\b/i, label: 'Firecrawl' },
  { pattern: /\bBrowse\.?ai\b/i, label: 'Browse.ai' },
  { pattern: /\bSerper\b/i, label: 'Serper' },
  { pattern: /\bSerpAPI\b/i, label: 'SerpAPI' },
  { pattern: /\bMerge\.dev\b/i, label: 'Merge.dev' },
  { pattern: /\bGoogle\s+Maps\s+API\b/i, label: 'Google Maps API (vendor name leak)' },
];

/**
 * Sensitive internal-state denylist. These should never appear in external
 * HTML/PDF — they're proof we've leaked an internal failure code.
 */
export const INTERNAL_STATE_DENYLIST: { pattern: RegExp; label: string }[] = [
  { pattern: /SEMRUSH_API_KEY/i, label: 'SEMRUSH_API_KEY env var name' },
  { pattern: /BROWSE_AI_API_KEY/i, label: 'BROWSE_AI_API_KEY env var name' },
  { pattern: /PERPLEXITY_API_KEY/i, label: 'PERPLEXITY_API_KEY env var name' },
  { pattern: /OPENAI_API_KEY/i, label: 'OPENAI_API_KEY env var name' },
  { pattern: /FIRECRAWL_API_KEY/i, label: 'FIRECRAWL_API_KEY env var name' },
  { pattern: /SERPER_API_KEY/i, label: 'SERPER_API_KEY env var name' },
  { pattern: /SUPPLIER_CONFIG_MISSING/i, label: 'Internal error code SUPPLIER_CONFIG_MISSING' },
  { pattern: /service_role_exact/i, label: 'Internal auth marker service_role_exact' },
  { pattern: /user_jwt_rejected/i, label: 'Internal auth marker user_jwt_rejected' },
  { pattern: /\bHTTP\s*40[13]\b\s*from/i, label: 'Raw upstream HTTP 401/403 leaked' },
];

/**
 * Placeholder/sentinel denylist. These strings indicate a fallback was rendered
 * instead of real data — exactly what the contract bans.
 */
export const PLACEHOLDER_DENYLIST: { pattern: RegExp; label: string }[] = [
  { pattern: /unknown\s*[—-]\s*insufficient\s*website\s*data/i, label: 'Sentinel "unknown — insufficient website data"' },
  { pattern: /undefined\s*undefined/i, label: 'Double-undefined render' },
  { pattern: /\[object\s*Object\]/i, label: 'JS [object Object] leak' },
  { pattern: /\bNaN\b\s*%/i, label: 'NaN% — broken math render' },
  { pattern: /\bnull\s*null\b/i, label: 'Double-null render' },
  { pattern: /TODO:|FIXME:|XXX:/, label: 'Dev placeholder TODO/FIXME/XXX' },
  { pattern: /lorem\s+ipsum/i, label: 'Lorem ipsum placeholder' },
  { pattern: /sample\s+business\s+name/i, label: 'Sample business name placeholder' },
];

/**
 * The 8 enrichment edge functions that MUST return 200 during a scan.
 * Per ops_daily_calibration_check.md §B (7 listed) + the new 8th
 * (review_aggregator) added with the post-scan share/aggregate flow.
 * If `enrichment_traces` shows fewer than these all at 200, the scan is
 * incomplete and the test FAILS per zero-401 tolerance.
 */
export const REQUIRED_EDGE_FUNCTIONS: string[] = [
  'deep-web-recon',
  'social-enrichment',
  'competitor-monitor',
  'market-analysis-ai',
  'market-signal-scorer',
  'browse-ai-reviews',
  'semrush-domain-intel',
  // 8th — added per task spec step 3j ("all 8 edge functions called").
  // If review_aggregator doesn't exist as a tracked edge fn yet, the test
  // surfaces "missing trace" as a WARN — not a hard fail — to avoid
  // false-positive on a not-yet-instrumented function.
  'review-aggregator',
];

/**
 * Per-URL polling configuration. The total wall-clock budget for "wait for
 * scan to reach a terminal state" is 8 minutes — long-tail scans can take
 * 4-6 minutes when supplier APIs are slow.
 */
export const POLL_CONFIG = {
  // Initial state — backend has acked the URL submission.
  T_BACKEND_ACK_TIMEOUT_MS: 30_000,
  // Fan-out — backend has dispatched all 8 edge functions.
  T_FANOUT_TIMEOUT_MS: 60_000,
  // Terminal — DATA_AVAILABLE | INSUFFICIENT_SIGNAL | DEGRADED.
  T_TERMINAL_TIMEOUT_MS: 8 * 60 * 1000,
  POLL_INTERVAL_MS: 3_000,
};

export const TERMINAL_STATES = ['DATA_AVAILABLE', 'INSUFFICIENT_SIGNAL', 'DEGRADED'] as const;
export type TerminalState = typeof TERMINAL_STATES[number];

/**
 * The 5 test URLs.  Order matches mission spec.
 * Slug is used as a directory name for evidence.
 */
export interface TestUrl {
  url: string;
  slug: string;
  label: string;
  // Whether this is expected to be low-signal (i.e. INSUFFICIENT_SIGNAL is a valid PASS).
  low_signal_acceptable: boolean;
}

export const TEST_URLS: TestUrl[] = [
  { url: 'www.smsglobal.com', slug: 'smsglobal', label: 'sms-global', low_signal_acceptable: false },
  { url: 'www.jimsmowing.com.au', slug: 'jimsmowing', label: 'jims-mowing', low_signal_acceptable: false },
  { url: 'www.koalafoam.com.au', slug: 'koalafoam', label: 'koalafoam', low_signal_acceptable: false },
  { url: 'www.bunnings.com.au', slug: 'bunnings', label: 'bunnings', low_signal_acceptable: false },
  { url: 'www.maddocks.com.au', slug: 'maddocks', label: 'maddocks', low_signal_acceptable: true },
];
