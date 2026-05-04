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
 * The enrichment edge functions that MUST return 200 during a scan.
 * Per ops_daily_calibration_check.md §B (7 listed) + the post-scan
 * share/aggregate flow + P0 Marjo R2B + R2C deep-extraction additions.
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
  // P0 Marjo F14 (2026-05-04) — close perimeter gap for the two deep-
  // extraction edges added by R2B + R2C. Both are in the calibration
  // scan fanout (calibration.py:~2655) and therefore MUST be in the daily
  // zero-401 check per feedback_zero_401_tolerance.md. Without these
  // entries, a 401 in customer-reviews-deep or staff-reviews-deep could
  // ship to prod undetected — the exact churn-bomb pattern Andreas hit
  // on 2026-04-23 with the 7 calibration edge fns.
  'customer-reviews-deep',
  'staff-reviews-deep',
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

/**
 * Number of URLs the daily check is expected to cover. The aggregator uses
 * this to detect "matrix slot crashed before writing result.json" — exactly
 * the bug class the Marjo incident itself was about (a silent surviving
 * subset producing a false PASS).
 *
 * Source-of-truth = TEST_URLS.length. The matrix in
 * .github/workflows/daily-cmo-check.yml MUST have the same count; if you add
 * or remove a URL, change BOTH places (and the SETUP.md "Adding a 6th URL"
 * note). The aggregator will FAIL if the per-URL JSONs received don't equal
 * this number — drift is loud, not silent.
 */
export const EXPECTED_URL_COUNT = TEST_URLS.length;

/**
 * R2F (2026-05-04) — depth-verification thresholds.
 *
 * The presence-only daily check (E10 + F6 + F14) verifies that scans complete,
 * CMO sections render, and the perimeter is intact. R2F adds DEPTH thresholds
 * — i.e. did the data we accepted as "present" actually reflect the deep
 * intelligence Marjo expects?
 *
 * Two thresholds per signal: "established" (smsglobal / canva-class /
 * bunnings) and "smb" (jimsmowing / koalafoam / small services). The runner
 * picks based on TestUrl.depth_class (defaulting to "smb" when unset).
 *
 * Numbers are sourced from the R2D / F15 spec ("organic_keywords >= 30 for
 * established, >= 10 for SMB"; "detailed_competitors >= 5"; "ad_history_12m
 * >= 1") and from R2B + R2C (review counts and theme extraction).
 *
 * Numbers are intentionally floors not targets — a real CMO Report against a
 * real domain will produce far more than these values. We're catching
 * collapses to zero / single-digit, not regressions of 30 → 28.
 */
export type DepthClass = 'established' | 'smb';

export const DEPTH_THRESHOLDS = {
  semrush: {
    established: {
      organic_keywords_min: 30,
      backlinks_min: 1,
      ad_history_months_min: 1,
      competitors_min: 5,
    },
    smb: {
      organic_keywords_min: 10,
      backlinks_min: 0, // SMBs may legitimately have 0 backlinks tracked
      ad_history_months_min: 0, // many SMBs never run paid ads
      competitors_min: 5,
    },
  },
  customer_reviews: {
    // Both classes — reviews are discoverable for any business with a Google
    // Maps presence. SMBs without a GBP listing fall to the low-signal exit.
    total_reviews_min: 1,
    platform_with_5plus_reviews_min: 1,
    themes_min: 1,
  },
  staff_reviews: {
    // Established businesses are expected to have staff reviews on at least
    // one platform (Glassdoor / Indeed / Seek). SMBs may legitimately have
    // zero — we only assert the field exists structurally for SMB.
    established: {
      platforms_with_rating_min: 1,
    },
    smb: {
      platforms_with_rating_min: 0,
    },
    employer_brand_health_score_min: 0,
    employer_brand_health_score_max: 100,
  },
  provenance: {
    // E10's happy-path was 12 traces. With R2B + R2C (customer-reviews-deep
    // + staff-reviews-deep) and R2D's deeper SEMrush queries, we expect
    // ~20-30 trace rows per scan. Floor at 13 to catch obvious regressions
    // while accepting the real-world range.
    enrichment_traces_min_per_scan: 13,
    section_source_trace_id_min: 1,
  },
  trinity: {
    // After 7 days of SINGLE_PROVIDER, surface as P1 — Andreas needs to
    // provision the second key. Below that, just record the state.
    single_provider_warn_days: 7,
  },
};

/**
 * Marketing-101 generic-language regex sweep. If any of these phrases appear
 * in the rendered CMO HTML, it means the LLM (or a fallback path) emitted
 * a clichéd recommendation instead of a data-backed insight. R2F treats this
 * as a depth_pass=false signal — the report rendered, but the content was
 * advice you'd find in any "10 marketing tips" listicle.
 *
 * Sourced from common LLM "lazy advice" patterns flagged in CMO QA reviews.
 * Add to this list any time a generic phrase is spotted in production output.
 */
export const ANTI_MARKETING_101_REGEXES: { pattern: RegExp; label: string }[] = [
  { pattern: /improve\s+(your\s+)?social\s+media\s+presence/i, label: 'Generic "improve social media presence"' },
  { pattern: /engage\s+(more\s+)?with\s+(your\s+)?audience/i, label: 'Generic "engage with audience"' },
  { pattern: /create\s+(more\s+)?(quality|engaging)\s+content/i, label: 'Generic "create quality/engaging content"' },
  { pattern: /optimi[sz]e\s+(your\s+)?website\s+for\s+(seo|search)/i, label: 'Generic "optimize website for SEO"' },
  { pattern: /leverage\s+social\s+media/i, label: 'Generic "leverage social media"' },
  { pattern: /build\s+(a\s+)?strong\s+brand\s+identity/i, label: 'Generic "build strong brand identity"' },
  { pattern: /focus\s+on\s+customer\s+(experience|service)/i, label: 'Generic "focus on customer experience/service"' },
  { pattern: /utili[sz]e\s+email\s+marketing/i, label: 'Generic "utilize email marketing"' },
  { pattern: /run\s+(targeted\s+)?ad\s+campaigns/i, label: 'Generic "run targeted ad campaigns"' },
  { pattern: /implement\s+(a\s+)?content\s+marketing\s+strategy/i, label: 'Generic "implement content marketing strategy"' },
];

/**
 * Brand audit rule (per feedback_ask_biqc_brand_name.md). The conversational
 * surface MUST appear as "Ask BIQc" in any user-facing render. Soundboard /
 * Chat / Assistant variants are banned and indicate stale copy that hasn't
 * been swept post-rebrand.
 */
export const BRAND_REQUIRED_PRESENT: RegExp = /\bAsk\s+BIQc\b/i;
export const BRAND_BANNED_VARIANTS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bSoundboard\b/i, label: 'Old brand "Soundboard"' },
  { pattern: /\bAsk\s+Chat\b/i, label: 'Variant "Ask Chat"' },
  { pattern: /\bAsk\s+Assistant\b/i, label: 'Variant "Ask Assistant"' },
];

/**
 * F15 — Authority rank rebrand. The CMO surface should refer to the SEMrush
 * Authority Score as "Authority rank" or "Authority Score" — never "SEMrush
 * rank" (which would leak the supplier name in addition to violating the F15
 * brand cleanup).
 */
export const AUTHORITY_RANK_REQUIRED: RegExp = /\bAuthority\s+(rank|score)\b/i;
export const SEMRUSH_RANK_BANNED: RegExp = /\bSEMrush\s+rank\b/i;

/**
 * Per-URL depth classification. "established" = a business with mature SEO
 * + paid + reviews footprint that we expect to fill all the SEMrush /
 * customer-review / staff-review buckets. "smb" = a small business where
 * SEMrush will return less + staff reviews may be zero.
 *
 * Defaults to "smb" if the URL isn't in the table — conservative default
 * avoids false negatives on new URLs.
 */
export const URL_DEPTH_CLASS: Record<string, DepthClass> = {
  smsglobal: 'established',
  bunnings: 'established',
  jimsmowing: 'smb',
  koalafoam: 'smb',
  maddocks: 'smb',
};

export function depthClassFor(slug: string): DepthClass {
  return URL_DEPTH_CLASS[slug] ?? 'smb';
}
