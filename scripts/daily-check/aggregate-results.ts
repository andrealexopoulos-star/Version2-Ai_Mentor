/**
 * Aggregate per-URL JSONs into one aggregate.json.
 *
 * Reads from aggregate-input/per-url-json-<slug>/result.json (the GH Actions
 * download-artifact pattern produces one folder per artifact) and writes
 * aggregate-input/aggregate.json.
 */

import * as fs from 'fs';
import * as path from 'path';

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

function main(): void {
  const files = findResultJsons();
  console.log(`[aggregate] found ${files.length} per-URL result.json file(s)`);

  const perUrl: PerUrlSummary[] = [];
  for (const f of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
      perUrl.push({
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
    }
  }

  const passCount = perUrl.filter((u) => u.overall_status === 'PASS').length;
  const failCount = perUrl.filter((u) => u.overall_status === 'FAIL').length;
  const degradedCount = perUrl.filter((u) => u.overall_status === 'DEGRADED').length;

  // Severity:
  //   - PASS = all 5 passed.
  //   - DEGRADED = no FAIL but at least one DEGRADED.
  //   - FAIL = at least one FAIL.
  //   - PAGE = ≥3 FAIL (most of the cohort) — escalation handled separately.
  let overall_status: 'PASS' | 'FAIL' | 'DEGRADED' = 'PASS';
  if (failCount > 0) overall_status = 'FAIL';
  else if (degradedCount > 0) overall_status = 'DEGRADED';

  let severity: 'INFO' | 'WARN' | 'CRITICAL' | 'PAGE' = 'INFO';
  if (failCount === 0 && degradedCount === 0) severity = 'INFO';
  else if (failCount === 0) severity = 'WARN';
  else if (failCount >= 3) severity = 'PAGE';
  else severity = 'CRITICAL';

  const aggregate = {
    schema_version: '1.0.0-marjo-e10',
    agent: 'E10',
    run_at_utc: new Date().toISOString(),
    workflow_run_id: process.env.WORKFLOW_RUN_ID ?? null,
    workflow_run_url: process.env.WORKFLOW_RUN_URL ?? null,
    overall_status,
    severity,
    pass_count: passCount,
    fail_count: failCount,
    degraded_count: degradedCount,
    total_urls: perUrl.length,
    per_url: perUrl,
  };

  fs.mkdirSync(INPUT_DIR, { recursive: true });
  const out = path.join(INPUT_DIR, 'aggregate.json');
  fs.writeFileSync(out, JSON.stringify(aggregate, null, 2));
  console.log(`[aggregate] wrote ${out} — overall=${overall_status} sev=${severity} pass=${passCount} fail=${failCount} degraded=${degradedCount}`);
}

main();
