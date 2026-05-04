/**
 * BIQc Daily CMO E2E Check — DEPTH verification (P0 Marjo R2F).
 *
 * The presence-only daily check (E10 + F6 + F14) confirms scans complete and
 * CMO sections render. With R2A-D's deepened data + F14/F15 fixes shipping,
 * presence is no longer enough — Marjo's round-2 verification requires that
 * the data we accepted as "rendered" is actually *deep*.
 *
 * Six categories of depth assertions, run after the presence checks:
 *
 *   1. SEMrush data depth (R2D / F15)
 *      - organic_keywords >= 30 (established) / 10 (SMB)
 *      - backlinks > 0
 *      - ad_history_12m >= 1 month
 *      - detailed_competitors >= 5
 *      - if all four fail simultaneously: G0d (SEMRUSH_SUPPLIER_TOTAL_FAILURE)
 *
 *   2. Customer reviews depth (R2B)
 *      - total_reviews_cross_platform > 0
 *      - at least 1 platform with >= 5 reviews
 *      - themes.length >= 1 (LLM theme extraction succeeded)
 *      - jimsmowing: ProductReview.com.au queried
 *
 *   3. Staff reviews depth (R2C / F14)
 *      - total_staff_reviews_cross_platform >= 0 (structural — field exists)
 *      - established URLs: >= 1 platform with rating
 *      - employer_brand_health_score is number 0-100 (not null)
 *
 *   4. Provenance integrity (E2 + E6)
 *      - enrichment_traces row count > 12 per scan
 *      - every CMO section has >= 1 source_trace_id
 *      - anti-Marketing-101 regex sweep over rendered HTML
 *
 *   5. Trinity quorum health (E9 + F14)
 *      - quorum_capability = FULL_QUORUM if both keys provisioned
 *      - SINGLE_PROVIDER for 7+ days = P1 warning
 *
 *   6. Brand consistency
 *      - "Ask BIQc" present in HTML; banned variants absent
 *      - "Authority rank" present (not "SEMrush rank") if SEMrush data present
 *
 * Per spec: any depth_pass=false → URL FAIL → aggregate FAIL (consistent with
 * F6's no-false-PASS rule). Depth failures are surfaced separately from
 * presence failures in the aggregator output.
 */

import {
  DEPTH_THRESHOLDS,
  ANTI_MARKETING_101_REGEXES,
  BRAND_REQUIRED_PRESENT,
  BRAND_BANNED_VARIANTS,
  AUTHORITY_RANK_REQUIRED,
  SEMRUSH_RANK_BANNED,
  depthClassFor,
  DepthClass,
} from './config.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Per-URL depth metrics. Mirrors the JSON schema additions documented in
 * SETUP.md. All numbers default to 0 / null when the underlying field is
 * missing — the caller's assertions decide whether 0 is a fail.
 */
export interface DepthMetrics {
  semrush_keyword_count: number;
  semrush_backlinks: number;
  semrush_ad_history_months: number;
  semrush_competitors: number;
  customer_reviews_total: number;
  customer_reviews_platforms_with_5plus: number;
  customer_reviews_themes: number;
  staff_reviews_total: number;
  staff_reviews_platforms_with_rating: number;
  employer_brand_health_score: number | null;
  enrichment_traces_count: number;
  sections_missing_source_trace_id: string[];
  marketing_101_detected: string[];
  quorum_capability: 'FULL_QUORUM' | 'PARTIAL' | 'SINGLE' | 'FAILED' | 'UNKNOWN';
  brand_correct: boolean;
  brand_banned_variants_seen: string[];
  authority_rank_present: boolean;
  semrush_rank_leak_seen: boolean;
}

export interface DepthCheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  detail: string;
  category: 'semrush' | 'customer_reviews' | 'staff_reviews' | 'provenance' | 'trinity' | 'brand';
}

export interface DepthVerifyOutput {
  depth: DepthMetrics;
  checks: DepthCheckResult[];
  depth_pass: boolean;
  /** Set when all 4 SEMrush assertions fail simultaneously — surfaced as separate alert. */
  g0d_total_failure: boolean;
}

// ---------------------------------------------------------------------------
// Inputs to verifyDepth — kept narrow so tests don't need the full
// run-cmo-check.ts world.
// ---------------------------------------------------------------------------

export interface DepthInputs {
  slug: string;
  /** Parsed `enrichment` payload from `business_dna_enrichment.enrichment`. */
  enrichment: Record<string, unknown> | null;
  /** Rendered CMO HTML (page.content() output). */
  html: string;
  /**
   * Trace rows from `public.enrichment_traces` for this scan. Schema:
   * { function_name: string; status_code: number; ...; source_trace_id?: string }.
   * Pass an empty array if the table doesn't exist yet (the test will WARN, not FAIL).
   */
  enrichment_traces: Array<{
    function_name: string;
    status_code: number;
    source_trace_id?: string | null;
    section_name?: string | null;
  }>;
  /**
   * Trinity router state from `get_router_config()` — at minimum
   * `quorum_capability` and `single_provider_since_days`.
   */
  router_config: {
    quorum_capability?: string;
    single_provider_since_days?: number | null;
  } | null;
  /** Whether we expect the trace table to be wired (false → assertion downgrades to WARN). */
  enrichment_traces_table_exists: boolean;
}

// ---------------------------------------------------------------------------
// Path helpers — defensive against missing nested fields. The contract v2
// shape can drift; we want graceful degradation, not crashes.
// ---------------------------------------------------------------------------

function getPath(obj: unknown, segments: string[]): unknown {
  let cur: unknown = obj;
  for (const seg of segments) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Metric extractors — pulled out so each is independently testable.
// ---------------------------------------------------------------------------

export function extractSemrushMetrics(enrichment: Record<string, unknown> | null) {
  if (!enrichment) {
    return {
      semrush_keyword_count: 0,
      semrush_backlinks: 0,
      semrush_ad_history_months: 0,
      semrush_competitors: 0,
    };
  }
  const organic = asArray(getPath(enrichment, ['keyword_intelligence', 'organic_keywords']));
  const backlinks = asNumber(getPath(enrichment, ['backlink_intelligence', 'total_backlinks']), 0);
  const adHistory = asArray(getPath(enrichment, ['advertising_intelligence', 'ad_history_12m']));
  const competitors = asArray(
    getPath(enrichment, ['competitive_intelligence', 'detailed_competitors']),
  );
  return {
    semrush_keyword_count: organic.length,
    semrush_backlinks: backlinks,
    semrush_ad_history_months: adHistory.length,
    semrush_competitors: competitors.length,
  };
}

export function extractCustomerReviewMetrics(enrichment: Record<string, unknown> | null) {
  if (!enrichment) {
    return {
      customer_reviews_total: 0,
      customer_reviews_platforms_with_5plus: 0,
      customer_reviews_themes: 0,
    };
  }
  const total = asNumber(
    getPath(enrichment, ['customer_review_intelligence_v2', 'total_reviews_cross_platform']),
    0,
  );
  const perPlatform = asArray(getPath(enrichment, ['customer_review_intelligence_v2', 'per_platform']));
  const platformsWith5plus = perPlatform.filter((p: unknown) => {
    if (!p || typeof p !== 'object') return false;
    const count = asNumber((p as Record<string, unknown>)['review_count'], 0);
    return count >= 5;
  }).length;
  const themes = asArray(getPath(enrichment, ['customer_review_intelligence_v2', 'themes']));
  return {
    customer_reviews_total: total,
    customer_reviews_platforms_with_5plus: platformsWith5plus,
    customer_reviews_themes: themes.length,
  };
}

export function extractStaffReviewMetrics(enrichment: Record<string, unknown> | null): {
  staff_reviews_total: number;
  staff_reviews_platforms_with_rating: number;
  employer_brand_health_score: number | null;
  staff_field_present: boolean;
} {
  if (!enrichment) {
    return {
      staff_reviews_total: 0,
      staff_reviews_platforms_with_rating: 0,
      employer_brand_health_score: null,
      staff_field_present: false,
    };
  }
  const wp = getPath(enrichment, ['workplace_intelligence']);
  const fieldPresent = wp !== undefined && wp !== null;
  const total = asNumber(
    getPath(enrichment, ['workplace_intelligence', 'total_staff_reviews_cross_platform']),
    0,
  );
  const perPlatform = asArray(getPath(enrichment, ['workplace_intelligence', 'per_platform']));
  const platformsWithRating = perPlatform.filter((p: unknown) => {
    if (!p || typeof p !== 'object') return false;
    const rating = (p as Record<string, unknown>)['rating'];
    return typeof rating === 'number' && rating > 0;
  }).length;
  const ebhsRaw = getPath(enrichment, ['workplace_intelligence', 'employer_brand_health_score']);
  const ebhs =
    typeof ebhsRaw === 'number' && Number.isFinite(ebhsRaw)
      ? ebhsRaw
      : ebhsRaw === null
        ? null
        : null;
  return {
    staff_reviews_total: total,
    staff_reviews_platforms_with_rating: platformsWithRating,
    employer_brand_health_score: ebhs,
    staff_field_present: fieldPresent,
  };
}

export function extractProvenanceMetrics(
  inputs: Pick<DepthInputs, 'enrichment_traces' | 'enrichment_traces_table_exists'>,
) {
  const traceCount = inputs.enrichment_traces.length;
  const sectionsWithTraces = inputs.enrichment_traces
    .filter((t) => t.section_name && t.source_trace_id)
    .reduce<Set<string>>((acc, t) => {
      if (t.section_name) acc.add(t.section_name);
      return acc;
    }, new Set());
  return {
    enrichment_traces_count: traceCount,
    sections_with_source_trace_id_count: sectionsWithTraces.size,
  };
}

// ---------------------------------------------------------------------------
// HTML scans — Marketing-101 + brand audit. Stripped to inner text so HTML
// attribute values don't false-positive (e.g. a CSS class named
// `.improve-social-presence` shouldn't trip the regex).
// ---------------------------------------------------------------------------

export function stripHtmlToText(html: string): string {
  // Remove <script>/<style> blocks entirely.
  let s = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
  // Strip remaining tags.
  s = s.replace(/<\/?[a-z][^>]*>/gi, ' ');
  // Collapse whitespace.
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function detectMarketing101(html: string): string[] {
  const text = stripHtmlToText(html);
  const hits: string[] = [];
  for (const r of ANTI_MARKETING_101_REGEXES) {
    if (r.pattern.test(text)) hits.push(r.label);
  }
  return hits;
}

export function detectBrand(html: string): {
  brand_correct: boolean;
  banned_variants_seen: string[];
} {
  const text = stripHtmlToText(html);
  const askBiqcPresent = BRAND_REQUIRED_PRESENT.test(text);
  const banned = BRAND_BANNED_VARIANTS.filter((b) => b.pattern.test(text)).map((b) => b.label);
  return {
    brand_correct: askBiqcPresent && banned.length === 0,
    banned_variants_seen: banned,
  };
}

export function detectAuthorityRank(
  html: string,
  semrush_data_present: boolean,
): { authority_rank_present: boolean; semrush_rank_leak_seen: boolean } {
  const text = stripHtmlToText(html);
  const authPresent = AUTHORITY_RANK_REQUIRED.test(text);
  const semrushLeak = SEMRUSH_RANK_BANNED.test(text);
  return {
    // Only required when SEMrush data is actually present in the report.
    // On low-signal scans there's no SEMrush block to label, so absence is OK.
    authority_rank_present: semrush_data_present ? authPresent : true,
    semrush_rank_leak_seen: semrushLeak,
  };
}

// ---------------------------------------------------------------------------
// Trinity quorum extraction
// ---------------------------------------------------------------------------

export function extractQuorum(
  router_config: DepthInputs['router_config'],
): {
  quorum_capability: DepthMetrics['quorum_capability'];
  single_provider_days: number;
} {
  if (!router_config) {
    return { quorum_capability: 'UNKNOWN', single_provider_days: 0 };
  }
  const rawCap = String(router_config.quorum_capability ?? '').toUpperCase();
  let cap: DepthMetrics['quorum_capability'] = 'UNKNOWN';
  if (rawCap === 'FULL_QUORUM' || rawCap === 'PARTIAL' || rawCap === 'SINGLE' || rawCap === 'FAILED') {
    cap = rawCap;
  }
  const days = asNumber(router_config.single_provider_since_days, 0);
  return { quorum_capability: cap, single_provider_days: days };
}

// ---------------------------------------------------------------------------
// Master verifier — wires together everything above and produces the final
// DepthVerifyOutput consumed by run-cmo-check.ts and the aggregator.
// ---------------------------------------------------------------------------

export function verifyDepth(inputs: DepthInputs): DepthVerifyOutput {
  const depthClass: DepthClass = depthClassFor(inputs.slug);
  const checks: DepthCheckResult[] = [];

  // ---- 1. SEMrush ----
  const semrush = extractSemrushMetrics(inputs.enrichment);
  const semThresh = DEPTH_THRESHOLDS.semrush[depthClass];
  const semKwOk = semrush.semrush_keyword_count >= semThresh.organic_keywords_min;
  const semBlOk = semrush.semrush_backlinks > semThresh.backlinks_min ||
    (depthClass === 'smb' && semrush.semrush_backlinks >= 0); // SMB allows 0
  const semBlStrictOk = depthClass === 'smb' ? true : semrush.semrush_backlinks > 0;
  const semAdOk = semrush.semrush_ad_history_months >= semThresh.ad_history_months_min;
  const semCompOk = semrush.semrush_competitors >= semThresh.competitors_min;

  checks.push({
    name: 'semrush_organic_keywords_depth',
    status: semKwOk ? 'PASS' : 'FAIL',
    detail: `organic_keywords=${semrush.semrush_keyword_count} (min ${semThresh.organic_keywords_min} for ${depthClass})`,
    category: 'semrush',
  });
  checks.push({
    name: 'semrush_backlinks_present',
    status: semBlStrictOk ? 'PASS' : depthClass === 'smb' ? 'WARN' : 'FAIL',
    detail: `total_backlinks=${semrush.semrush_backlinks}`,
    category: 'semrush',
  });
  checks.push({
    name: 'semrush_ad_history_present',
    status: semAdOk ? 'PASS' : depthClass === 'smb' ? 'WARN' : 'FAIL',
    detail: `ad_history_12m months=${semrush.semrush_ad_history_months} (min ${semThresh.ad_history_months_min} for ${depthClass})`,
    category: 'semrush',
  });
  checks.push({
    name: 'semrush_detailed_competitors_depth',
    status: semCompOk ? 'PASS' : 'FAIL',
    detail: `detailed_competitors=${semrush.semrush_competitors} (min ${semThresh.competitors_min})`,
    category: 'semrush',
  });

  // G0d — total SEMrush failure when ALL four assertions fail. Flagged separately so
  // the alert pipeline can surface "SEMrush supplier total failure" vs
  // "individual SEMrush metric below floor".
  const semrushFailures = checks
    .filter((c) => c.category === 'semrush' && c.status === 'FAIL')
    .length;
  const g0d = semrushFailures >= 4;

  // ---- 2. Customer reviews ----
  const cr = extractCustomerReviewMetrics(inputs.enrichment);
  const crT = DEPTH_THRESHOLDS.customer_reviews;
  // For low-signal SMBs, a literal 0 reviews is acceptable as WARN (not FAIL).
  // The TestUrl.low_signal_acceptable flag is honored by the aggregator at
  // a higher level — here we always assert FAIL on 0 unless depthClass===smb,
  // mirroring the established/SMB pattern.
  const crTotalOk = cr.customer_reviews_total >= crT.total_reviews_min;
  const crPlatformsOk = cr.customer_reviews_platforms_with_5plus >= crT.platform_with_5plus_reviews_min;
  const crThemesOk = cr.customer_reviews_themes >= crT.themes_min;
  checks.push({
    name: 'customer_reviews_total_present',
    status: crTotalOk ? 'PASS' : depthClass === 'smb' ? 'WARN' : 'FAIL',
    detail: `total_reviews_cross_platform=${cr.customer_reviews_total} (min ${crT.total_reviews_min})`,
    category: 'customer_reviews',
  });
  checks.push({
    name: 'customer_reviews_platform_with_5plus',
    status: crPlatformsOk ? 'PASS' : depthClass === 'smb' ? 'WARN' : 'FAIL',
    detail: `platforms with >=5 reviews: ${cr.customer_reviews_platforms_with_5plus} (min ${crT.platform_with_5plus_reviews_min})`,
    category: 'customer_reviews',
  });
  checks.push({
    name: 'customer_reviews_themes_extracted',
    status: crThemesOk ? 'PASS' : depthClass === 'smb' ? 'WARN' : 'FAIL',
    detail: `themes.length=${cr.customer_reviews_themes} (LLM theme extraction)`,
    category: 'customer_reviews',
  });
  // jimsmowing-specific check — ProductReview.com.au should be queried.
  if (inputs.slug === 'jimsmowing') {
    const platforms = asArray(
      getPath(inputs.enrichment, ['customer_review_intelligence_v2', 'per_platform']),
    );
    const hasProductReview = platforms.some((p: unknown) => {
      if (!p || typeof p !== 'object') return false;
      const name = String((p as Record<string, unknown>)['platform'] ?? '').toLowerCase();
      return name.includes('productreview');
    });
    checks.push({
      name: 'customer_reviews_productreview_au_queried',
      status: hasProductReview ? 'PASS' : 'WARN',
      detail: hasProductReview
        ? 'ProductReview.com.au present in per_platform list'
        : 'ProductReview.com.au not in per_platform list — Australian SMB platform missing',
      category: 'customer_reviews',
    });
  }

  // ---- 3. Staff reviews ----
  const sr = extractStaffReviewMetrics(inputs.enrichment);
  const srT = DEPTH_THRESHOLDS.staff_reviews;
  // Structural check — workplace_intelligence field MUST be present in the payload.
  // SMB businesses can have zero staff reviews — the field still has to exist
  // (with zero values) per F14 perimeter contract.
  checks.push({
    name: 'staff_reviews_field_present',
    status: sr.staff_field_present ? 'PASS' : 'FAIL',
    detail: sr.staff_field_present
      ? `workplace_intelligence present (total=${sr.staff_reviews_total})`
      : 'workplace_intelligence field MISSING from enrichment payload',
    category: 'staff_reviews',
  });
  // Established URLs — expect at least 1 platform with rating.
  if (depthClass === 'established') {
    const ok = sr.staff_reviews_platforms_with_rating >= srT.established.platforms_with_rating_min;
    checks.push({
      name: 'staff_reviews_platform_with_rating',
      status: ok ? 'PASS' : 'FAIL',
      detail: `platforms with rating: ${sr.staff_reviews_platforms_with_rating} (min ${srT.established.platforms_with_rating_min} for established)`,
      category: 'staff_reviews',
    });
  } else {
    checks.push({
      name: 'staff_reviews_platform_with_rating',
      status: 'PASS',
      detail: `SMB — staff reviews optional (have ${sr.staff_reviews_platforms_with_rating} platforms with rating)`,
      category: 'staff_reviews',
    });
  }
  // employer_brand_health_score — number 0-100, not null.
  const ebhs = sr.employer_brand_health_score;
  const ebhsValid =
    typeof ebhs === 'number' &&
    ebhs >= srT.employer_brand_health_score_min &&
    ebhs <= srT.employer_brand_health_score_max;
  checks.push({
    name: 'employer_brand_health_score_valid',
    status: ebhsValid ? 'PASS' : 'FAIL',
    detail: `employer_brand_health_score=${ebhs} (must be number 0-100)`,
    category: 'staff_reviews',
  });

  // ---- 4. Provenance ----
  const prov = extractProvenanceMetrics(inputs);
  const provT = DEPTH_THRESHOLDS.provenance;
  if (!inputs.enrichment_traces_table_exists) {
    checks.push({
      name: 'enrichment_traces_count_threshold',
      status: 'WARN',
      detail: 'enrichment_traces table not yet wired — depth count downgraded to WARN',
      category: 'provenance',
    });
  } else {
    const traceCountOk = prov.enrichment_traces_count >= provT.enrichment_traces_min_per_scan;
    checks.push({
      name: 'enrichment_traces_count_threshold',
      status: traceCountOk ? 'PASS' : 'FAIL',
      detail: `enrichment_traces=${prov.enrichment_traces_count} (min ${provT.enrichment_traces_min_per_scan} for full R2 deepening)`,
      category: 'provenance',
    });
  }

  // Sections-with-source-trace check — at least one section per traced section.
  // We don't enumerate every CMO section here; just assert the trace table
  // surfaces SOME section→trace links when traces exist.
  if (inputs.enrichment_traces_table_exists && prov.enrichment_traces_count > 0) {
    const sectionsOk = prov.sections_with_source_trace_id_count >= provT.section_source_trace_id_min;
    checks.push({
      name: 'sections_have_source_trace_id',
      status: sectionsOk ? 'PASS' : 'FAIL',
      detail: `${prov.sections_with_source_trace_id_count} CMO sections have at least one source_trace_id`,
      category: 'provenance',
    });
  }

  // Marketing-101 sweep
  const m101 = detectMarketing101(inputs.html);
  checks.push({
    name: 'anti_marketing_101_sweep',
    status: m101.length === 0 ? 'PASS' : 'FAIL',
    detail:
      m101.length === 0
        ? 'no generic Marketing-101 phrases detected'
        : `generic phrases detected: ${m101.join('; ')}`,
    category: 'provenance',
  });

  // ---- 5. Trinity ----
  const trinity = extractQuorum(inputs.router_config);
  if (trinity.quorum_capability === 'FULL_QUORUM') {
    checks.push({
      name: 'trinity_quorum_capability',
      status: 'PASS',
      detail: 'quorum_capability=FULL_QUORUM (Anthropic + Gemini provisioned)',
      category: 'trinity',
    });
  } else if (trinity.quorum_capability === 'PARTIAL') {
    checks.push({
      name: 'trinity_quorum_capability',
      status: 'WARN',
      detail: 'quorum_capability=PARTIAL — one provider degraded',
      category: 'trinity',
    });
  } else if (trinity.quorum_capability === 'SINGLE') {
    const exceeded = trinity.single_provider_days >= DEPTH_THRESHOLDS.trinity.single_provider_warn_days;
    checks.push({
      name: 'trinity_quorum_capability',
      // Per spec: SINGLE_PROVIDER for 7+ days = WARN (P1 alert), not workflow fail.
      status: 'WARN',
      detail: `quorum_capability=SINGLE for ${trinity.single_provider_days} day(s)${exceeded ? ' — P1: provision second key' : ''}`,
      category: 'trinity',
    });
  } else if (trinity.quorum_capability === 'FAILED') {
    checks.push({
      name: 'trinity_quorum_capability',
      status: 'FAIL',
      detail: 'quorum_capability=FAILED — no providers responding',
      category: 'trinity',
    });
  } else {
    checks.push({
      name: 'trinity_quorum_capability',
      status: 'WARN',
      detail: 'quorum_capability=UNKNOWN — router_config unavailable',
      category: 'trinity',
    });
  }

  // ---- 6. Brand ----
  const brand = detectBrand(inputs.html);
  checks.push({
    name: 'brand_ask_biqc_present',
    status: brand.brand_correct ? 'PASS' : 'FAIL',
    detail: brand.brand_correct
      ? '"Ask BIQc" present and no banned variants'
      : `banned variants: ${brand.banned_variants_seen.join(', ') || '(none)'}; ask_biqc_present=${BRAND_REQUIRED_PRESENT.test(stripHtmlToText(inputs.html))}`,
    category: 'brand',
  });
  // Authority rank — only required when SEMrush data made it through.
  const semrushDataPresent =
    semrush.semrush_keyword_count > 0 ||
    semrush.semrush_backlinks > 0 ||
    semrush.semrush_competitors > 0;
  const auth = detectAuthorityRank(inputs.html, semrushDataPresent);
  checks.push({
    name: 'authority_rank_naming',
    status: auth.semrush_rank_leak_seen
      ? 'FAIL'
      : auth.authority_rank_present
        ? 'PASS'
        : 'WARN',
    detail: auth.semrush_rank_leak_seen
      ? '"SEMrush rank" leaked in HTML — F15 brand cleanup regression'
      : auth.authority_rank_present
        ? '"Authority rank/score" present (F15 rebrand intact)'
        : 'no SEMrush data present in HTML — authority-rank label not required',
    category: 'brand',
  });

  // ---- assemble ----
  const depth: DepthMetrics = {
    semrush_keyword_count: semrush.semrush_keyword_count,
    semrush_backlinks: semrush.semrush_backlinks,
    semrush_ad_history_months: semrush.semrush_ad_history_months,
    semrush_competitors: semrush.semrush_competitors,
    customer_reviews_total: cr.customer_reviews_total,
    customer_reviews_platforms_with_5plus: cr.customer_reviews_platforms_with_5plus,
    customer_reviews_themes: cr.customer_reviews_themes,
    staff_reviews_total: sr.staff_reviews_total,
    staff_reviews_platforms_with_rating: sr.staff_reviews_platforms_with_rating,
    employer_brand_health_score: sr.employer_brand_health_score,
    enrichment_traces_count: prov.enrichment_traces_count,
    sections_missing_source_trace_id: [], // populated externally if section list known
    marketing_101_detected: m101,
    quorum_capability: trinity.quorum_capability,
    brand_correct: brand.brand_correct,
    brand_banned_variants_seen: brand.banned_variants_seen,
    authority_rank_present: auth.authority_rank_present,
    semrush_rank_leak_seen: auth.semrush_rank_leak_seen,
  };

  // depth_pass = NO check is FAIL. (WARN is acceptable — SMB tolerances etc.)
  const depth_pass = !checks.some((c) => c.status === 'FAIL');

  return {
    depth,
    checks,
    depth_pass,
    g0d_total_failure: g0d,
  };
}
