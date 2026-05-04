/**
 * Tests for aggregate-results.ts — F6 P0-3 patch.
 *
 * Verifies that the aggregator NEVER produces a false PASS when one or
 * more matrix slots failed to write a result.json. Per peer reviewer R10:
 * this is the same class of silent-failure bug that the Marjo incident
 * itself was about — surviving slots all PASS would yield overall=PASS
 * exactly when we needed it to FAIL.
 *
 * The aggregator's pure core is `buildAggregate(perUrlInputs, expectedUrls)`.
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildAggregate } from '../aggregate-results.js';
import { TEST_URLS, EXPECTED_URL_COUNT } from '../config.js';

interface PerUrlSummary {
  slug: string;
  url: string;
  label: string;
  overall_status: 'PASS' | 'FAIL' | 'DEGRADED';
  scan_id: string | null;
  failures: { check: string; detail: string }[];
  warnings: { check: string; detail: string }[];
  latencies: Record<string, number | null>;
  terminal_state: string | null;
  screenshots_count: number;
  pdf_size_bytes: number | null;
}

function makeSummary(slug: string, status: 'PASS' | 'FAIL' | 'DEGRADED'): PerUrlSummary {
  const expected = TEST_URLS.find((u) => u.slug === slug);
  if (!expected) throw new Error(`unknown test slug: ${slug}`);
  return {
    slug: expected.slug,
    url: expected.url,
    label: expected.label,
    overall_status: status,
    scan_id: 'scan-' + slug,
    failures: status === 'FAIL' ? [{ check: 'sample', detail: 'sample fail' }] : [],
    warnings: [],
    latencies: {},
    terminal_state: 'DATA_AVAILABLE',
    screenshots_count: 25,
    pdf_size_bytes: 100_000,
  };
}

describe('buildAggregate — happy path', () => {
  it('all 5 PASS → overall_status=PASS, severity=INFO', () => {
    const inputs = TEST_URLS.map((u) => makeSummary(u.slug, 'PASS'));
    const agg = buildAggregate(inputs, TEST_URLS);
    assert.equal(agg.overall_status, 'PASS');
    assert.equal(agg.severity, 'INFO');
    assert.equal(agg.pass_count, 5);
    assert.equal(agg.fail_count, 0);
    assert.equal(agg.missing_count, 0);
    assert.equal(agg.degraded_count, 0);
    assert.equal(agg.missing_urls.length, 0);
  });
});

describe('buildAggregate — visible failure', () => {
  it('4 PASS + 1 FAIL → overall_status=FAIL, severity=CRITICAL', () => {
    const inputs = TEST_URLS.map((u, idx) => makeSummary(u.slug, idx === 0 ? 'FAIL' : 'PASS'));
    const agg = buildAggregate(inputs, TEST_URLS);
    assert.equal(agg.overall_status, 'FAIL');
    assert.equal(agg.severity, 'CRITICAL');
    assert.equal(agg.pass_count, 4);
    assert.equal(agg.fail_count, 1);
    assert.equal(agg.missing_count, 0);
  });

  it('3 FAIL + 2 PASS → severity=PAGE (most of cohort broken)', () => {
    const inputs = TEST_URLS.map((u, idx) => makeSummary(u.slug, idx < 3 ? 'FAIL' : 'PASS'));
    const agg = buildAggregate(inputs, TEST_URLS);
    assert.equal(agg.overall_status, 'FAIL');
    assert.equal(agg.severity, 'PAGE');
    assert.equal(agg.fail_count, 3);
  });
});

describe('buildAggregate — missing JSON (the Marjo bug class)', () => {
  it('4 PASS + 1 missing JSON → overall_status=FAIL with missing_urls populated', () => {
    // Drop the first URL — simulates a matrix slot that crashed before finalize.
    const inputs = TEST_URLS.slice(1).map((u) => makeSummary(u.slug, 'PASS'));
    const agg = buildAggregate(inputs, TEST_URLS);
    assert.equal(agg.overall_status, 'FAIL', 'missing slot must NOT yield PASS');
    assert.equal(agg.severity, 'CRITICAL');
    assert.equal(agg.pass_count, 4);
    assert.equal(agg.fail_count, 1, '1 missing counted as fail');
    assert.equal(agg.missing_count, 1);
    assert.equal(agg.missing_urls.length, 1);
    assert.equal(agg.missing_urls[0].slug, TEST_URLS[0].slug);
    assert.equal(agg.missing_urls[0].reason, 'NO_RESULT_JSON');
  });

  it('0 JSONs (catastrophic failure) → overall_status=FAIL with all 5 missing', () => {
    const agg = buildAggregate([], TEST_URLS);
    assert.equal(agg.overall_status, 'FAIL');
    assert.equal(agg.severity, 'PAGE', '5 missing = PAGE severity');
    assert.equal(agg.pass_count, 0);
    assert.equal(agg.fail_count, 5);
    assert.equal(agg.missing_count, 5);
    assert.equal(agg.missing_urls.length, 5);
    // All 5 expected URLs must be enumerated in missing_urls.
    for (const expected of TEST_URLS) {
      assert.ok(
        agg.missing_urls.find((m) => m.slug === expected.slug),
        `expected ${expected.slug} to be in missing_urls`,
      );
    }
  });

  it('3 missing + 2 PASS → severity=PAGE (3+ failures rule)', () => {
    const inputs = TEST_URLS.slice(0, 2).map((u) => makeSummary(u.slug, 'PASS'));
    const agg = buildAggregate(inputs, TEST_URLS);
    assert.equal(agg.overall_status, 'FAIL');
    assert.equal(agg.severity, 'PAGE');
    assert.equal(agg.missing_count, 3);
    assert.equal(agg.fail_count, 3);
  });

  it('1 visible FAIL + 1 missing + 3 PASS → fail_count=2, severity=CRITICAL', () => {
    const inputs = [
      makeSummary(TEST_URLS[0].slug, 'FAIL'),
      makeSummary(TEST_URLS[1].slug, 'PASS'),
      makeSummary(TEST_URLS[2].slug, 'PASS'),
      makeSummary(TEST_URLS[3].slug, 'PASS'),
      // TEST_URLS[4] missing
    ];
    const agg = buildAggregate(inputs, TEST_URLS);
    assert.equal(agg.overall_status, 'FAIL');
    assert.equal(agg.severity, 'CRITICAL');
    assert.equal(agg.fail_count, 2, '1 visible + 1 missing = 2');
    assert.equal(agg.missing_count, 1);
  });
});

describe('buildAggregate — DEGRADED handling', () => {
  it('4 PASS + 1 DEGRADED → overall_status=DEGRADED, severity=WARN', () => {
    const inputs = TEST_URLS.map((u, idx) => makeSummary(u.slug, idx === 0 ? 'DEGRADED' : 'PASS'));
    const agg = buildAggregate(inputs, TEST_URLS);
    assert.equal(agg.overall_status, 'DEGRADED');
    assert.equal(agg.severity, 'WARN');
    assert.equal(agg.fail_count, 0);
    assert.equal(agg.degraded_count, 1);
    assert.equal(agg.missing_count, 0);
  });

  it('1 DEGRADED + 1 missing → overall_status=FAIL (missing dominates DEGRADED)', () => {
    const inputs = TEST_URLS.slice(0, 4).map((u, idx) =>
      makeSummary(u.slug, idx === 0 ? 'DEGRADED' : 'PASS'),
    );
    const agg = buildAggregate(inputs, TEST_URLS);
    assert.equal(agg.overall_status, 'FAIL', 'a missing slot must drag overall to FAIL');
    assert.equal(agg.severity, 'CRITICAL');
    assert.equal(agg.fail_count, 1);
    assert.equal(agg.missing_count, 1);
  });
});

describe('buildAggregate — defensive defaults', () => {
  it('total_urls < expected_url_count must NEVER be PASS (belt-and-braces)', () => {
    // Even if all 4 surviving URLs pass, 1 missing means FAIL.
    for (let dropIdx = 0; dropIdx < TEST_URLS.length; dropIdx++) {
      const inputs = TEST_URLS.filter((_, idx) => idx !== dropIdx).map((u) =>
        makeSummary(u.slug, 'PASS'),
      );
      const agg = buildAggregate(inputs, TEST_URLS);
      assert.equal(
        agg.overall_status,
        'FAIL',
        `dropping ${TEST_URLS[dropIdx].slug} must yield FAIL not PASS`,
      );
    }
  });

  it('EXPECTED_URL_COUNT is sourced from TEST_URLS.length and equals 5', () => {
    assert.equal(EXPECTED_URL_COUNT, 5);
    assert.equal(EXPECTED_URL_COUNT, TEST_URLS.length);
  });

  it('deduplicates if same slug appears twice in input', () => {
    const inputs = [
      makeSummary(TEST_URLS[0].slug, 'PASS'),
      makeSummary(TEST_URLS[0].slug, 'FAIL'), // duplicate
      makeSummary(TEST_URLS[1].slug, 'PASS'),
      makeSummary(TEST_URLS[2].slug, 'PASS'),
      makeSummary(TEST_URLS[3].slug, 'PASS'),
      makeSummary(TEST_URLS[4].slug, 'PASS'),
    ];
    const agg = buildAggregate(inputs, TEST_URLS);
    // After dedup, all 5 unique URLs are present and PASS (the duplicate FAIL
    // is dropped because the first occurrence wins).
    assert.equal(agg.total_urls, 5);
    assert.equal(agg.pass_count, 5);
    assert.equal(agg.overall_status, 'PASS');
  });
});
