/**
 * Tests for verifyDepth.ts — P0 Marjo R2F.
 *
 * These tests exercise the 6 categories of depth assertions independently of
 * the full Playwright runner. They use realistic-shape enrichment payloads
 * and small HTML snippets so the assertions can be validated without spinning
 * up a browser or hitting Supabase.
 *
 * Mission spec test cases:
 *   - test_semrush_depth_assertions_pass_on_rich_data
 *   - test_semrush_depth_assertions_fail_on_supplier_failure (G0d signal)
 *   - test_customer_reviews_depth_pass_on_established_business
 *   - test_staff_reviews_depth_optional_for_smb
 *   - test_provenance_anti_marketing_101_sweep
 *   - test_trinity_single_provider_warns_not_fails
 *   - test_brand_audit_authority_rank_not_semrush_rank
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  verifyDepth,
  extractSemrushMetrics,
  extractCustomerReviewMetrics,
  extractStaffReviewMetrics,
  detectMarketing101,
  detectBrand,
  detectAuthorityRank,
  extractQuorum,
  stripHtmlToText,
  DepthInputs,
} from '../verifyDepth.js';

// ---------------------------------------------------------------------------
// Fixture builders — keep terse so test intent is the prominent thing.
// ---------------------------------------------------------------------------

function richSemrushEnrichment(opts: {
  organic?: number;
  backlinks?: number;
  ad_months?: number;
  competitors?: number;
} = {}) {
  return {
    keyword_intelligence: {
      organic_keywords: Array.from({ length: opts.organic ?? 50 }, (_, i) => ({ keyword: `kw-${i}` })),
    },
    backlink_intelligence: { total_backlinks: opts.backlinks ?? 1234 },
    advertising_intelligence: {
      ad_history_12m: Array.from({ length: opts.ad_months ?? 6 }, (_, i) => ({ month: `2026-${String(i + 1).padStart(2, '0')}` })),
    },
    competitive_intelligence: {
      detailed_competitors: Array.from({ length: opts.competitors ?? 8 }, (_, i) => ({ domain: `comp${i}.example` })),
    },
  };
}

function richCustomerReviews(opts: {
  total?: number;
  platforms?: Array<{ platform: string; review_count: number }>;
  themes?: number;
} = {}) {
  return {
    customer_review_intelligence_v2: {
      total_reviews_cross_platform: opts.total ?? 320,
      per_platform: opts.platforms ?? [
        { platform: 'Google', review_count: 200 },
        { platform: 'Facebook', review_count: 80 },
        { platform: 'ProductReview.com.au', review_count: 40 },
      ],
      themes: Array.from({ length: opts.themes ?? 5 }, (_, i) => ({ theme: `theme-${i}` })),
    },
  };
}

function richStaffReviews(opts: {
  total?: number;
  platforms_with_rating?: number;
  ebhs?: number | null;
} = {}) {
  const platforms: Array<{ platform: string; rating?: number; review_count: number }> = [];
  for (let i = 0; i < (opts.platforms_with_rating ?? 2); i++) {
    platforms.push({ platform: `Platform-${i}`, rating: 4.0 + i * 0.1, review_count: 50 });
  }
  return {
    workplace_intelligence: {
      total_staff_reviews_cross_platform: opts.total ?? 100,
      per_platform: platforms,
      employer_brand_health_score: opts.ebhs === undefined ? 72 : opts.ebhs,
    },
  };
}

function happyHtml(): string {
  return `
<html><body>
<h1>Ask BIQc CMO Report — Bunnings</h1>
<section>
  <h2>SEO snapshot</h2>
  <p>Authority rank: 78 / 100 (top quintile in home-improvement).</p>
  <p>Top opportunity: target the underserved "drill bit recommendation" cluster.</p>
</section>
<section>
  <h2>Customer reviews</h2>
  <p>Themes detected from 320 reviews include "knowledgeable staff" and "long checkout queues".</p>
</section>
</body></html>`;
}

function baseInputs(over: Partial<DepthInputs> = {}): DepthInputs {
  return {
    slug: 'bunnings',
    enrichment: { ...richSemrushEnrichment(), ...richCustomerReviews(), ...richStaffReviews() },
    html: happyHtml(),
    enrichment_traces: Array.from({ length: 20 }, (_, i) => ({
      function_name: `fn-${i}`,
      status_code: 200,
      source_trace_id: `trace-${i}`,
      section_name: `section-${i % 5}`,
    })),
    enrichment_traces_table_exists: true,
    router_config: { quorum_capability: 'FULL_QUORUM', single_provider_since_days: 0 },
    ...over,
  };
}

// ---------------------------------------------------------------------------
// 1. SEMrush depth
// ---------------------------------------------------------------------------

describe('SEMrush depth assertions', () => {
  it('test_semrush_depth_assertions_pass_on_rich_data — established URL, all 4 metrics rich', () => {
    const out = verifyDepth(baseInputs());
    const semChecks = out.checks.filter((c) => c.category === 'semrush');
    const fails = semChecks.filter((c) => c.status === 'FAIL');
    assert.equal(fails.length, 0, `expected 0 SEMrush FAILs, got ${fails.map((f) => f.name).join(', ')}`);
    assert.equal(out.g0d_total_failure, false);
    assert.equal(out.depth.semrush_keyword_count, 50);
    assert.equal(out.depth.semrush_competitors, 8);
  });

  it('test_semrush_depth_assertions_fail_on_supplier_failure (G0d signal)', () => {
    // All four SEMrush fields zeroed out — simulates SEMrush key revoked /
    // supplier total failure / silent fallback to empty payload.
    const out = verifyDepth(
      baseInputs({
        enrichment: {
          // workplace_intelligence kept so non-SEMrush asserts don't dominate.
          ...richStaffReviews(),
          ...richCustomerReviews(),
          keyword_intelligence: { organic_keywords: [] },
          backlink_intelligence: { total_backlinks: 0 },
          advertising_intelligence: { ad_history_12m: [] },
          competitive_intelligence: { detailed_competitors: [] },
        },
      }),
    );
    const semFails = out.checks.filter((c) => c.category === 'semrush' && c.status === 'FAIL');
    assert.equal(semFails.length, 4, 'all four SEMrush metrics should FAIL when supplier is dead');
    assert.equal(out.g0d_total_failure, true, 'G0d flag MUST fire on simultaneous SEMrush failure');
    assert.equal(out.depth_pass, false);
  });

  it('SMB tolerance — organic_keywords floor is 10 not 30', () => {
    const out = verifyDepth(
      baseInputs({
        slug: 'jimsmowing',
        enrichment: {
          ...richStaffReviews({ platforms_with_rating: 0, ebhs: 50 }),
          ...richCustomerReviews(),
          ...richSemrushEnrichment({ organic: 12, backlinks: 5, ad_months: 0, competitors: 6 }),
        },
      }),
    );
    const kwCheck = out.checks.find((c) => c.name === 'semrush_organic_keywords_depth');
    assert.equal(kwCheck?.status, 'PASS', '12 organic keywords passes the SMB floor of 10');
  });
});

// ---------------------------------------------------------------------------
// 2. Customer reviews depth
// ---------------------------------------------------------------------------

describe('Customer reviews depth', () => {
  it('test_customer_reviews_depth_pass_on_established_business', () => {
    const out = verifyDepth(baseInputs());
    const crChecks = out.checks.filter((c) => c.category === 'customer_reviews');
    const fails = crChecks.filter((c) => c.status === 'FAIL');
    assert.equal(fails.length, 0, `expected 0 customer-review FAILs, got: ${fails.map((f) => f.name).join(', ')}`);
    assert.equal(out.depth.customer_reviews_total, 320);
    assert.equal(out.depth.customer_reviews_themes, 5);
    assert.ok(out.depth.customer_reviews_platforms_with_5plus >= 1);
  });

  it('jimsmowing — flags missing ProductReview.com.au platform as WARN', () => {
    const out = verifyDepth(
      baseInputs({
        slug: 'jimsmowing',
        enrichment: {
          ...richStaffReviews({ platforms_with_rating: 0 }),
          ...richSemrushEnrichment({ organic: 11, backlinks: 5, ad_months: 0, competitors: 6 }),
          customer_review_intelligence_v2: {
            total_reviews_cross_platform: 120,
            per_platform: [{ platform: 'Google', review_count: 100 }, { platform: 'Facebook', review_count: 20 }],
            themes: [{ theme: 'fast service' }],
          },
        },
      }),
    );
    const prCheck = out.checks.find((c) => c.name === 'customer_reviews_productreview_au_queried');
    assert.equal(prCheck?.status, 'WARN', 'jimsmowing without ProductReview.com.au should WARN');
  });
});

// ---------------------------------------------------------------------------
// 3. Staff reviews depth
// ---------------------------------------------------------------------------

describe('Staff reviews depth', () => {
  it('test_staff_reviews_depth_optional_for_smb — zero platforms with rating is OK for SMB', () => {
    const out = verifyDepth(
      baseInputs({
        slug: 'jimsmowing',
        enrichment: {
          ...richSemrushEnrichment({ organic: 12, backlinks: 1, ad_months: 0, competitors: 6 }),
          ...richCustomerReviews(),
          workplace_intelligence: {
            total_staff_reviews_cross_platform: 0,
            per_platform: [],
            employer_brand_health_score: 50, // valid number 0-100
          },
        },
      }),
    );
    const platCheck = out.checks.find((c) => c.name === 'staff_reviews_platform_with_rating');
    assert.equal(platCheck?.status, 'PASS', 'SMB with 0 staff platforms must still PASS');
  });

  it('established URL — staff platforms with rating is required', () => {
    const out = verifyDepth(
      baseInputs({
        slug: 'bunnings',
        enrichment: {
          ...richSemrushEnrichment(),
          ...richCustomerReviews(),
          workplace_intelligence: {
            total_staff_reviews_cross_platform: 0,
            per_platform: [],
            employer_brand_health_score: 60,
          },
        },
      }),
    );
    const platCheck = out.checks.find((c) => c.name === 'staff_reviews_platform_with_rating');
    assert.equal(platCheck?.status, 'FAIL', 'established URL with 0 staff platforms must FAIL');
  });

  it('staff_reviews_field_present — workplace_intelligence missing is FAIL', () => {
    const out = verifyDepth(
      baseInputs({
        enrichment: {
          ...richSemrushEnrichment(),
          ...richCustomerReviews(),
          // intentionally omit workplace_intelligence
        },
      }),
    );
    const fldCheck = out.checks.find((c) => c.name === 'staff_reviews_field_present');
    assert.equal(fldCheck?.status, 'FAIL');
  });

  it('employer_brand_health_score — null fails, out-of-range fails, valid passes', () => {
    const nullOut = verifyDepth(
      baseInputs({
        enrichment: {
          ...richSemrushEnrichment(),
          ...richCustomerReviews(),
          workplace_intelligence: { total_staff_reviews_cross_platform: 50, per_platform: [{ platform: 'X', rating: 4, review_count: 10 }], employer_brand_health_score: null },
        },
      }),
    );
    assert.equal(
      nullOut.checks.find((c) => c.name === 'employer_brand_health_score_valid')?.status,
      'FAIL',
    );

    const outOfRange = verifyDepth(
      baseInputs({
        enrichment: {
          ...richSemrushEnrichment(),
          ...richCustomerReviews(),
          workplace_intelligence: { total_staff_reviews_cross_platform: 50, per_platform: [{ platform: 'X', rating: 4, review_count: 10 }], employer_brand_health_score: 150 },
        },
      }),
    );
    assert.equal(
      outOfRange.checks.find((c) => c.name === 'employer_brand_health_score_valid')?.status,
      'FAIL',
    );

    const valid = verifyDepth(baseInputs());
    assert.equal(
      valid.checks.find((c) => c.name === 'employer_brand_health_score_valid')?.status,
      'PASS',
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Provenance + anti-Marketing-101
// ---------------------------------------------------------------------------

describe('Provenance + anti-Marketing-101', () => {
  it('test_provenance_anti_marketing_101_sweep — generic phrase in HTML is FAIL', () => {
    const dirtyHtml = happyHtml().replace(
      'Top opportunity:',
      'Improve your social media presence and engage more with your audience. Top opportunity:',
    );
    const out = verifyDepth(baseInputs({ html: dirtyHtml }));
    const m101Check = out.checks.find((c) => c.name === 'anti_marketing_101_sweep');
    assert.equal(m101Check?.status, 'FAIL');
    assert.ok(out.depth.marketing_101_detected.length >= 1);
  });

  it('clean HTML passes the Marketing-101 sweep', () => {
    const out = verifyDepth(baseInputs());
    assert.equal(
      out.checks.find((c) => c.name === 'anti_marketing_101_sweep')?.status,
      'PASS',
    );
    assert.equal(out.depth.marketing_101_detected.length, 0);
  });

  it('enrichment_traces count below floor is FAIL when table exists', () => {
    const out = verifyDepth(
      baseInputs({
        enrichment_traces: Array.from({ length: 5 }, (_, i) => ({
          function_name: `fn-${i}`,
          status_code: 200,
          source_trace_id: `t-${i}`,
          section_name: `s-${i}`,
        })),
      }),
    );
    const traceCheck = out.checks.find((c) => c.name === 'enrichment_traces_count_threshold');
    assert.equal(traceCheck?.status, 'FAIL');
  });

  it('enrichment_traces table missing degrades to WARN', () => {
    const out = verifyDepth(baseInputs({ enrichment_traces: [], enrichment_traces_table_exists: false }));
    const traceCheck = out.checks.find((c) => c.name === 'enrichment_traces_count_threshold');
    assert.equal(traceCheck?.status, 'WARN');
  });
});

// ---------------------------------------------------------------------------
// 5. Trinity quorum
// ---------------------------------------------------------------------------

describe('Trinity quorum', () => {
  it('FULL_QUORUM passes', () => {
    const out = verifyDepth(baseInputs());
    assert.equal(out.checks.find((c) => c.name === 'trinity_quorum_capability')?.status, 'PASS');
  });

  it('test_trinity_single_provider_warns_not_fails — SINGLE for 10 days = WARN, not FAIL', () => {
    const out = verifyDepth(
      baseInputs({ router_config: { quorum_capability: 'SINGLE', single_provider_since_days: 10 } }),
    );
    const trCheck = out.checks.find((c) => c.name === 'trinity_quorum_capability');
    assert.equal(trCheck?.status, 'WARN', 'SINGLE_PROVIDER must WARN, not FAIL');
    // Per spec: it's a P1 alert, not a workflow fail. Verify depth_pass is
    // not affected by this WARN alone (assuming everything else is clean).
    assert.equal(out.depth_pass, true, 'a WARN-only depth result must still depth_pass');
  });

  it('FAILED quorum is FAIL', () => {
    const out = verifyDepth(
      baseInputs({ router_config: { quorum_capability: 'FAILED', single_provider_since_days: 0 } }),
    );
    assert.equal(out.checks.find((c) => c.name === 'trinity_quorum_capability')?.status, 'FAIL');
    assert.equal(out.depth_pass, false);
  });

  it('UNKNOWN quorum (router_config missing) is WARN', () => {
    const out = verifyDepth(baseInputs({ router_config: null }));
    assert.equal(out.checks.find((c) => c.name === 'trinity_quorum_capability')?.status, 'WARN');
  });
});

// ---------------------------------------------------------------------------
// 6. Brand audit
// ---------------------------------------------------------------------------

describe('Brand audit', () => {
  it('test_brand_audit_authority_rank_not_semrush_rank — "Authority rank" present, no SEMrush rank leak', () => {
    const out = verifyDepth(baseInputs());
    assert.equal(
      out.checks.find((c) => c.name === 'authority_rank_naming')?.status,
      'PASS',
    );
    assert.equal(out.depth.authority_rank_present, true);
    assert.equal(out.depth.semrush_rank_leak_seen, false);
  });

  it('"SEMrush rank" leaked — F15 regression FAIL', () => {
    const leakHtml = happyHtml().replace('Authority rank', 'SEMrush rank');
    const out = verifyDepth(baseInputs({ html: leakHtml }));
    assert.equal(
      out.checks.find((c) => c.name === 'authority_rank_naming')?.status,
      'FAIL',
    );
    assert.equal(out.depth.semrush_rank_leak_seen, true);
  });

  it('Ask BIQc absent + Soundboard present — brand FAIL', () => {
    const badHtml = `<html><body><h1>Soundboard CMO Report</h1><p>Some content.</p></body></html>`;
    const out = verifyDepth(baseInputs({ html: badHtml }));
    const brandCheck = out.checks.find((c) => c.name === 'brand_ask_biqc_present');
    assert.equal(brandCheck?.status, 'FAIL');
    assert.equal(out.depth.brand_correct, false);
    assert.ok(out.depth.brand_banned_variants_seen.includes('Old brand "Soundboard"'));
  });

  it('SEMrush data absent — authority-rank label not required (no SEMrush block to label)', () => {
    const out = verifyDepth(
      baseInputs({
        enrichment: {
          ...richStaffReviews(),
          ...richCustomerReviews(),
          keyword_intelligence: { organic_keywords: [] },
          backlink_intelligence: { total_backlinks: 0 },
          advertising_intelligence: { ad_history_12m: [] },
          competitive_intelligence: { detailed_competitors: [] },
        },
        // HTML without "Authority rank" — but no SEMrush data, so it's OK.
        html: '<html><body><h1>Ask BIQc CMO Report</h1><p>No SEO section because no data.</p></body></html>',
      }),
    );
    const authCheck = out.checks.find((c) => c.name === 'authority_rank_naming');
    // depth_pass overall will still be FAIL due to G0d, but the authority-rank
    // check itself should not contribute another FAIL.
    assert.notEqual(authCheck?.status, 'FAIL');
  });
});

// ---------------------------------------------------------------------------
// Helper extractor unit tests
// ---------------------------------------------------------------------------

describe('extractors — defensive parsing', () => {
  it('null enrichment yields zeroed metrics, no crash', () => {
    const sem = extractSemrushMetrics(null);
    assert.equal(sem.semrush_keyword_count, 0);
    assert.equal(sem.semrush_backlinks, 0);
    const cr = extractCustomerReviewMetrics(null);
    assert.equal(cr.customer_reviews_total, 0);
    const sr = extractStaffReviewMetrics(null);
    assert.equal(sr.employer_brand_health_score, null);
    assert.equal(sr.staff_field_present, false);
  });

  it('stripHtmlToText strips scripts + styles + tags', () => {
    const t = stripHtmlToText('<p>hello <script>alert(1)</script><style>x{}</style><b>world</b></p>');
    assert.equal(t, 'hello world');
  });

  it('detectBrand respects "Ask BIQc" word boundaries', () => {
    const ok = detectBrand('<p>Ask BIQc gives you the answer.</p>');
    assert.equal(ok.brand_correct, true);
    const bad = detectBrand('<p>Ask Soundboard for advice.</p>');
    assert.equal(bad.brand_correct, false);
  });

  it('detectMarketing101 returns labels for all hits', () => {
    const hits = detectMarketing101(
      '<p>You should <em>improve your social media presence</em> and <em>create more quality content</em>.</p>',
    );
    assert.ok(hits.length >= 2);
  });

  it('detectAuthorityRank — when no SEMrush data, absence is OK', () => {
    const r = detectAuthorityRank('<p>no auth label here</p>', false);
    assert.equal(r.authority_rank_present, true, 'should be true (not required) when SEMrush absent');
    assert.equal(r.semrush_rank_leak_seen, false);
  });

  it('extractQuorum — uppercases and normalises', () => {
    const q = extractQuorum({ quorum_capability: 'full_quorum', single_provider_since_days: 0 });
    assert.equal(q.quorum_capability, 'FULL_QUORUM');
  });
});

// ---------------------------------------------------------------------------
// Integration — depth_pass + g0d_total_failure surfaced together
// ---------------------------------------------------------------------------

describe('verifyDepth — top-level surface', () => {
  it('rich data → depth_pass=true, g0d=false', () => {
    const out = verifyDepth(baseInputs());
    assert.equal(out.depth_pass, true);
    assert.equal(out.g0d_total_failure, false);
  });

  it('all SEMrush + missing workplace + Marketing-101 + bad brand + SEMrush rank leak → depth_pass=false, g0d=true, multiple FAILs', () => {
    const out = verifyDepth(
      baseInputs({
        enrichment: {
          ...richCustomerReviews(),
          // No workplace_intelligence, no SEMrush data.
        },
        html: '<html><body><h1>Soundboard CMO Report</h1><p>Improve your social media presence. SEMrush rank: 30.</p></body></html>',
      }),
    );
    assert.equal(out.depth_pass, false);
    assert.equal(out.g0d_total_failure, true);
    const failNames = out.checks.filter((c) => c.status === 'FAIL').map((c) => c.name);
    assert.ok(failNames.includes('staff_reviews_field_present'));
    assert.ok(failNames.includes('anti_marketing_101_sweep'));
    assert.ok(failNames.includes('brand_ask_biqc_present'));
    assert.ok(failNames.includes('authority_rank_naming'));
  });
});
