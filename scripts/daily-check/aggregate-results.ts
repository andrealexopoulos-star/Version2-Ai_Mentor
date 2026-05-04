/**
 * Aggregate per-URL JSONs into one aggregate.json.
 *
 * Reads from aggregate-input/per-url-json-<slug>/result.json (the GH Actions
 * download-artifact pattern produces one folder per artifact) and writes
 * aggregate-input/aggregate.json.
 *
 * --- F6 P0-3 patch (peer reviewer R10 finding) ---
 * Previous bug: this aggregator counted only physically-present per-URL
 * JSONs. If a matrix slot crashed before run-cmo-check.ts wrote result.json
 * (OOM, browser launch failure, runner timeout, network glitch in
 * upload-artifact, etc.) the aggregator silently shrugged and computed a
 * verdict from the *surviving* slots. If those happened to all PASS, the
 * overall verdict was PASS — exactly when we needed it to be FAIL.
 * That is the same class of silent-failure bug the Marjo incident itself
 * surfaced.
 *
 * Fix:
 *   a) Use TEST_URLS / EXPECTED_URL_COUNT from config.ts as the canonical
 *      list of slots we *should* see.
 *   b) After loading per-URL JSONs, compare against that list. Any URL that
 *      did not produce a parseable result.json is recorded as a
 *      "missing_url" — surfaced in aggregate.missing_urls AND counted in
 *      fail_count.
 *   c) overall_status defaults to FAIL — it can only become PASS if every
 *      expected URL is present AND every present result is PASS. There is
 *      no "default to PASS because nothing failed visibly" path.
 *   d) Severity stays PASS-strict: PAGE if ≥3 missing+fail, CRITICAL if
 *      ≥1 missing+fail, WARN if only DEGRADED, INFO if all-PASS.
 */

import * as fs from 'fs';
import * as path from 'path';
import { TEST_URLS, EXPECTED_URL_COUNT, TestUrl } from './config.js';

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

interface MissingUrl {
  slug: string;
  url: string;
  label: string;
  reason: 'NO_RESULT_JSON' | 'PARSE_FAILED';
  detail?: string;
}

const INPUT_DIR = path.resolve(__dirname, 'aggregate-input');

function findResultJsons(): string[] {
  const out: string[] = [];
  if (!fs.existsSync(INPUT_DIR)) return out;
  const entries = fs.readdirSync(INPUT_DIR, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (!e.name.startsWith('per-url-json-')) continue;
    const candidate = path.join(INPUT_DIR, e.name, 'result.json');
    if (fs.existsSync(candidate)) out.push(candidate);
  }
  return out;
}

/**
 * Pure aggregator core — exported for tests.
 *
 * Takes the parsed per-URL summaries and the canonical expected URL list,
 * returns the full aggregate object (minus runtime-only fields like
 * workflow_run_id which the CLI wraps around it).
 */
export function buildAggregate(
  perUrlInputs: PerUrlSummary[],
  expectedUrls: TestUrl[],
): {
  overall_status: 'PASS' | 'FAIL' | 'DEGRADED';
  severity: 'INFO' | 'WARN' | 'CRITICAL' | 'PAGE';
  pass_count: number;
  fail_count: number;
  degraded_count: number;
  missing_count: number;
  total_urls: number;
  expected_url_count: number;
  per_url: PerUrlSummary[];
  missing_urls: MissingUrl[];
} {
  // Deduplicate by slug — defensive in case the same slug got uploaded twice.
  const seen = new Set<string>();
  const perUrl: PerUrlSummary[] = [];
  for (const u of perUrlInputs) {
    if (seen.has(u.slug)) continue;
    seen.add(u.slug);
    perUrl.push(u);
  }

  const missingUrls: MissingUrl[] = [];
  for (const expected of expectedUrls) {
    const found = perUrl.find((u) => u.slug === expected.slug || u.url === expected.url);
    if (!found) {
      missingUrls.push({
        slug: expected.slug,
        url: expected.url,
        label: expected.label,
        reason: 'NO_RESULT_JSON',
        detail: 'matrix slot did not produce a result.json — runner likely crashed before finalize()',
      });
    }
  }

  const passCount = perUrl.filter((u) => u.overall_status === 'PASS').length;
  const presentFailCount = perUrl.filter((u) => u.overall_status === 'FAIL').length;
  const degradedCount = perUrl.filter((u) => u.overall_status === 'DEGRADED').length;
  const missingCount = missingUrls.length;

  // Missing slots count as failures — they're worse than visible failures
  // because we have no evidence at all.
  const failCount = presentFailCount + missingCount;

  // overall_status defaults to FAIL. Only flip to PASS if EVERY expected
  // URL is present AND every present URL is PASS. Belt-and-braces against
  // any future "default to PASS" regression.
  let overall_status: 'PASS' | 'FAIL' | 'DEGRADED' = 'FAIL';
  if (missingCount === 0 && presentFailCount === 0 && perUrl.length === expectedUrls.length) {
    if (degradedCount > 0) {
      overall_status = 'DEGRADED';
    } else if (passCount === expectedUrls.length) {
      overall_status = 'PASS';
    } else {
      // Should be unreachable given the above conditions, but kept as a
      // defensive default so any future enum state can't slip through as PASS.
      overall_status = 'FAIL';
    }
  }

  // Severity:
  //   - INFO  = clean PASS.
  //   - WARN  = no FAIL or missing, but at least one DEGRADED.
  //   - PAGE  = ≥3 FAIL+missing (most of the cohort is broken).
  //   - CRITICAL = ≥1 FAIL+missing (some of the cohort is broken).
  let severity: 'INFO' | 'WARN' | 'CRITICAL' | 'PAGE' = 'INFO';
  if (overall_status === 'PASS') severity = 'INFO';
  else if (failCount === 0 && degradedCount > 0) severity = 'WARN';
  else if (failCount >= 3) severity = 'PAGE';
  else if (failCount > 0) severity = 'CRITICAL';
  else severity = 'WARN'; // catch-all defensive default — never PASS-implying

  return {
    overall_status,
    severity,
    pass_count: passCount,
    fail_count: failCount,
    degraded_count: degradedCount,
    missing_count: missingCount,
    total_urls: perUrl.length,
    expected_url_count: expectedUrls.length,
    per_url: perUrl,
    missing_urls: missingUrls,
  };
}

function main(): void {
  const files = findResultJsons();
  console.log(`[aggregate] found ${files.length} per-URL result.json file(s); expecting ${EXPECTED_URL_COUNT}`);

  const perUrlInputs: PerUrlSummary[] = [];
  const parseFailures: MissingUrl[] = [];
  for (const f of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
      perUrlInputs.push({
        slug: raw.slug,
        url: raw.url,
        label: raw.label,
        overall_status: raw.overall_status,
        scan_id: raw.scan_id ?? null,
        failures: raw.failures ?? [],
        warnings: raw.warnings ?? [],
        latencies: raw.latencies ?? {},
        terminal_state: raw.terminal_state ?? null,
        screenshots_count: Array.isArray(raw.screenshots) ? raw.screenshots.length : 0,
        pdf_size_bytes: raw.pdf_size_bytes ?? null,
      });
    } catch (e) {
      console.error(`[aggregate] failed to parse ${f}: ${String(e)}`);
      // Try to extract the slug from the file path so we can still surface it
      // as a missing/parse-failed URL.
      const m = f.match(/per-url-json-([^/]+)\//);
      const slug = m?.[1] ?? 'unknown';
      const expected = TEST_URLS.find((u) => u.slug === slug);
      parseFailures.push({
        slug,
        url: expected?.url ?? 'unknown',
        label: expected?.label ?? slug,
        reason: 'PARSE_FAILED',
        detail: `result.json present but unparseable: ${String(e)}`,
      });
    }
  }

  const aggregateCore = buildAggregate(perUrlInputs, TEST_URLS);

  // Merge in any parse-failures alongside the missing list.
  const missingUrls = [...aggregateCore.missing_urls, ...parseFailures];
  // Remove from missing_urls anything that's also covered by a parse failure
  // for the same slug (avoid double-counting).
  const dedupedMissing = missingUrls.filter(
    (m, idx) => missingUrls.findIndex((other) => other.slug === m.slug) === idx,
  );

  // Recompute fail/missing counts to reflect parse failures (they'd been
  // missing in buildAggregate's view because the input list didn't include
  // them either).
  const missingCount = dedupedMissing.length;
  // Visible-fail count from present-and-parsed inputs:
  const presentFailCount = aggregateCore.per_url.filter((u) => u.overall_status === 'FAIL').length;
  const failCount = presentFailCount + missingCount;

  // Re-decide overall_status with the deduped missing list. Same gate: PASS
  // only if everything is present AND all present results are PASS.
  let overall_status: 'PASS' | 'FAIL' | 'DEGRADED' = 'FAIL';
  if (
    missingCount === 0 &&
    presentFailCount === 0 &&
    aggregateCore.per_url.length === EXPECTED_URL_COUNT
  ) {
    overall_status = aggregateCore.degraded_count > 0 ? 'DEGRADED' : 'PASS';
  }

  let severity: 'INFO' | 'WARN' | 'CRITICAL' | 'PAGE' = 'INFO';
  if (overall_status === 'PASS') severity = 'INFO';
  else if (failCount === 0 && aggregateCore.degraded_count > 0) severity = 'WARN';
  else if (failCount >= 3) severity = 'PAGE';
  else if (failCount > 0) severity = 'CRITICAL';
  else severity = 'WARN';

  const aggregate = {
    schema_version: '1.0.0-marjo-e10',
    agent: 'E10+F6',
    run_at_utc: new Date().toISOString(),
    workflow_run_id: process.env.WORKFLOW_RUN_ID ?? null,
    workflow_run_url: process.env.WORKFLOW_RUN_URL ?? null,
    overall_status,
    severity,
    pass_count: aggregateCore.pass_count,
    fail_count: failCount,
    degraded_count: aggregateCore.degraded_count,
    missing_count: missingCount,
    total_urls: aggregateCore.per_url.length,
    expected_url_count: EXPECTED_URL_COUNT,
    per_url: aggregateCore.per_url,
    missing_urls: dedupedMissing,
  };

  fs.mkdirSync(INPUT_DIR, { recursive: true });
  const out = path.join(INPUT_DIR, 'aggregate.json');
  fs.writeFileSync(out, JSON.stringify(aggregate, null, 2));
  console.log(
    `[aggregate] wrote ${out} — overall=${overall_status} sev=${severity} ` +
      `pass=${aggregateCore.pass_count}/${EXPECTED_URL_COUNT} ` +
      `fail=${failCount} (visible=${presentFailCount} missing=${missingCount}) ` +
      `degraded=${aggregateCore.degraded_count}`,
  );
}

// Only run if invoked directly, not when imported by tests.
function invokedDirectly(): boolean {
  try {
    return typeof require !== 'undefined' && require.main === module;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  main();
}
