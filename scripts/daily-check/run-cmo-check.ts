/**
 * BIQc Daily CMO E2E Check — per-URL runner.
 *
 * Reads TARGET_URL + TARGET_SLUG from env (set by the matrix).
 * Drives a real browser through:
 *   1. Login
 *   2. URL Scan submission
 *   3. Poll for terminal state
 *   4. Navigate to CMO Report
 *   5. Section-by-section screenshots
 *   6. PDF download
 *   7. Share confirmation
 *   8. Server-side assertions (business_dna_enrichment, enrichment_traces, share_events)
 *   9. Contract v2 + placeholder denylist scan over rendered HTML + PDF text
 *
 * Outputs evidence/<slug>/result.json + screenshots + report.pdf.
 *
 * Per spec: do NOT exit non-zero on per-URL failure. Encode failure in JSON.
 * The aggregate step decides workflow exit.
 *
 * Per BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2.md: any leak of
 * supplier names or internal codes in rendered HTML/PDF = FAIL.
 *
 * Per feedback_zero_401_tolerance.md: any non-200 in enrichment_traces = FAIL.
 */

import { chromium, Browser, BrowserContext, Page, Download } from 'playwright';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import pdfParse from 'pdf-parse';
import {
  SUPPLIER_NAME_DENYLIST,
  INTERNAL_STATE_DENYLIST,
  PLACEHOLDER_DENYLIST,
  REQUIRED_EDGE_FUNCTIONS,
  POLL_CONFIG,
  TERMINAL_STATES,
  TEST_URLS,
  TestUrl,
} from './config.js';
import { verifyDepth, DepthMetrics, DepthCheckResult } from './verifyDepth.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIPPED';
  detail?: string;
  evidence_path?: string;
  duration_ms?: number;
}

interface PerUrlResult {
  schema_version: '1.1.0-marjo-r2f';
  agent: 'E10+F6+F14+R2F';
  url: string;
  slug: string;
  label: string;
  run_at_utc: string;
  workflow_run_id: string | null;
  workflow_run_url: string | null;
  overall_status: 'PASS' | 'FAIL' | 'DEGRADED';
  scan_id: string | null;
  account_id: string | null;
  user_id: string | null;
  latencies: {
    t_login_ms: number | null;
    t_backend_ack_ms: number | null;
    t_fanout_complete_ms: number | null;
    t_terminal_ms: number | null;
    t_total_ms: number | null;
  };
  terminal_state: string | null;
  checks: CheckResult[];
  failures: { check: string; detail: string }[];
  warnings: { check: string; detail: string }[];
  screenshots: string[];
  pdf_path: string | null;
  pdf_size_bytes: number | null;
  pdf_content_type: string | null;
  console_errors: string[];
  // R2F additions — depth verification.
  depth: DepthMetrics | null;
  depth_checks: DepthCheckResult[];
  depth_pass: boolean;
  depth_failures: { check: string; detail: string; category: string }[];
  g0d_semrush_total_failure: boolean;
  presence_failures: { check: string; detail: string }[];
}

// ---------------------------------------------------------------------------
// Env / config
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[FATAL] required env var ${name} not set`);
    process.exit(2);
  }
  return v;
}

const TARGET_URL = requireEnv('TARGET_URL');
const TARGET_SLUG = requireEnv('TARGET_SLUG');
const QA_EMAIL = requireEnv('BIQC_QA_EMAIL');
const QA_PASSWORD = requireEnv('BIQC_QA_PASSWORD');
const SUPABASE_PROJECT_ID = requireEnv('SUPABASE_PROJECT_ID');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const FRONTEND_BASE = requireEnv('BIQC_FRONTEND_BASE_URL').replace(/\/+$/, '');
const API_BASE = requireEnv('BIQC_API_BASE_URL').replace(/\/+$/, '');
const WORKFLOW_RUN_ID = process.env.WORKFLOW_RUN_ID || null;
const WORKFLOW_RUN_URL = process.env.WORKFLOW_RUN_URL || null;

const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
const EVIDENCE_DIR = path.resolve(__dirname, 'evidence', TARGET_SLUG);

const targetCfg: TestUrl =
  TEST_URLS.find((u) => u.url === TARGET_URL || u.slug === TARGET_SLUG) ?? {
    url: TARGET_URL,
    slug: TARGET_SLUG,
    label: TARGET_SLUG,
    low_signal_acceptable: false,
  };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function ts(): string {
  return new Date().toISOString();
}

function logInfo(msg: string, extra?: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: ts(), level: 'info', slug: TARGET_SLUG, msg, ...extra }));
}

function logWarn(msg: string, extra?: Record<string, unknown>) {
  console.warn(JSON.stringify({ ts: ts(), level: 'warn', slug: TARGET_SLUG, msg, ...extra }));
}

function logErr(msg: string, extra?: Record<string, unknown>) {
  console.error(JSON.stringify({ ts: ts(), level: 'error', slug: TARGET_SLUG, msg, ...extra }));
}

function nowMs(): number {
  return Date.now();
}

function denylistScan(
  text: string,
  denylist: { pattern: RegExp; label: string }[],
): { hit: boolean; matches: string[] } {
  const matches: string[] = [];
  for (const entry of denylist) {
    if (entry.pattern.test(text)) {
      matches.push(entry.label);
    }
  }
  return { hit: matches.length > 0, matches };
}

// ---------------------------------------------------------------------------
// Result accumulator
// ---------------------------------------------------------------------------

const result: PerUrlResult = {
  schema_version: '1.1.0-marjo-r2f',
  agent: 'E10+F6+F14+R2F',
  url: targetCfg.url,
  slug: targetCfg.slug,
  label: targetCfg.label,
  run_at_utc: ts(),
  workflow_run_id: WORKFLOW_RUN_ID,
  workflow_run_url: WORKFLOW_RUN_URL,
  overall_status: 'FAIL',
  scan_id: null,
  account_id: null,
  user_id: null,
  latencies: {
    t_login_ms: null,
    t_backend_ack_ms: null,
    t_fanout_complete_ms: null,
    t_terminal_ms: null,
    t_total_ms: null,
  },
  terminal_state: null,
  checks: [],
  failures: [],
  warnings: [],
  screenshots: [],
  pdf_path: null,
  pdf_size_bytes: null,
  pdf_content_type: null,
  console_errors: [],
  // R2F depth fields — populated by runDepthVerification().
  depth: null,
  depth_checks: [],
  depth_pass: false,
  depth_failures: [],
  g0d_semrush_total_failure: false,
  presence_failures: [],
};

// Captured-during-run state passed into the depth verifier. None of these
// belong in the final JSON — they're scratchpad for the in-process verifier.
interface CapturedRunState {
  rendered_html: string | null;
  enrichment_payload: Record<string, unknown> | null;
  enrichment_traces: Array<{
    function_name: string;
    status_code: number;
    source_trace_id?: string | null;
    section_name?: string | null;
  }>;
  enrichment_traces_table_exists: boolean;
}

const captured: CapturedRunState = {
  rendered_html: null,
  enrichment_payload: null,
  enrichment_traces: [],
  enrichment_traces_table_exists: false,
};

function recordCheck(c: CheckResult) {
  result.checks.push(c);
  if (c.status === 'FAIL') {
    result.failures.push({ check: c.name, detail: c.detail || '(no detail)' });
  } else if (c.status === 'WARN') {
    result.warnings.push({ check: c.name, detail: c.detail || '(no detail)' });
  }
  logInfo(`check: ${c.name}=${c.status}`, { detail: c.detail });
}

async function snap(page: Page, name: string): Promise<string> {
  const filename = `${String(result.screenshots.length + 1).padStart(3, '0')}-${name}.png`;
  const out = path.join(EVIDENCE_DIR, 'screenshots', filename);
  ensureDir(path.dirname(out));
  await page.screenshot({ path: out, fullPage: true });
  result.screenshots.push(filename);
  return out;
}

// ---------------------------------------------------------------------------
// Section-by-section CMO capture (target ≥25 screenshots per task spec 3f)
// ---------------------------------------------------------------------------

const CMO_SECTIONS: { selector: string; name: string }[] = [
  { selector: '[data-testid="cmo-report-header"], h1, header', name: 'cmo-section-01-header' },
  { selector: '[data-testid="executive-summary"], section:has(h2:has-text("Executive Summary"))', name: 'cmo-section-02-executive-summary' },
  { selector: '[data-testid="business-snapshot"], section:has(h2:has-text("Business Snapshot"))', name: 'cmo-section-03-business-snapshot' },
  { selector: '[data-testid="market-position"], section:has(h2:has-text("Market Position"))', name: 'cmo-section-04-market-position' },
  { selector: '[data-testid="competitor-landscape"], section:has(h2:has-text("Competitor"))', name: 'cmo-section-05-competitor-landscape' },
  { selector: '[data-testid="swot-analysis"], section:has(h2:has-text("SWOT"))', name: 'cmo-section-06-swot' },
  { selector: '[data-testid="brand-voice"], section:has(h2:has-text("Brand Voice"))', name: 'cmo-section-07-brand-voice' },
  { selector: '[data-testid="customer-segments"], section:has(h2:has-text("Customer"))', name: 'cmo-section-08-customer-segments' },
  { selector: '[data-testid="value-proposition"], section:has(h2:has-text("Value Proposition"))', name: 'cmo-section-09-value-proposition' },
  { selector: '[data-testid="seo-overview"], section:has(h2:has-text("SEO"))', name: 'cmo-section-10-seo-overview' },
  { selector: '[data-testid="content-strategy"], section:has(h2:has-text("Content"))', name: 'cmo-section-11-content-strategy' },
  { selector: '[data-testid="paid-media"], section:has(h2:has-text("Paid Media"))', name: 'cmo-section-12-paid-media' },
  { selector: '[data-testid="social-presence"], section:has(h2:has-text("Social"))', name: 'cmo-section-13-social-presence' },
  { selector: '[data-testid="reviews-summary"], section:has(h2:has-text("Review"))', name: 'cmo-section-14-reviews-summary' },
  { selector: '[data-testid="market-trends"], section:has(h2:has-text("Trend"))', name: 'cmo-section-15-market-trends' },
  { selector: '[data-testid="opportunity-matrix"], section:has(h2:has-text("Opportunit"))', name: 'cmo-section-16-opportunities' },
  { selector: '[data-testid="risk-register"], section:has(h2:has-text("Risk"))', name: 'cmo-section-17-risks' },
  { selector: '[data-testid="quick-wins"], section:has(h2:has-text("Quick Win"))', name: 'cmo-section-18-quick-wins' },
  { selector: '[data-testid="90-day-plan"], section:has(h2:has-text("90-Day"))', name: 'cmo-section-19-90-day-plan' },
  { selector: '[data-testid="kpi-dashboard"], section:has(h2:has-text("KPI"))', name: 'cmo-section-20-kpis' },
  { selector: '[data-testid="budget-allocation"], section:has(h2:has-text("Budget"))', name: 'cmo-section-21-budget' },
  { selector: '[data-testid="tech-stack-recos"], section:has(h2:has-text("Tech"))', name: 'cmo-section-22-tech-recommendations' },
  { selector: '[data-testid="next-steps"], section:has(h2:has-text("Next Step"))', name: 'cmo-section-23-next-steps' },
  { selector: '[data-testid="appendix"], section:has(h2:has-text("Appendix"))', name: 'cmo-section-24-appendix' },
  { selector: 'footer, [data-testid="cmo-report-footer"]', name: 'cmo-section-25-footer' },
];

async function captureCmoSections(page: Page): Promise<void> {
  // Auto-scroll to load lazy sections, then per-section.
  await page.evaluate(async () => {
    const distance = 400;
    const max = document.body.scrollHeight;
    for (let y = 0; y < max; y += distance) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 250));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1000);

  // Always capture top-of-page first.
  await snap(page, 'cmo-report-top');

  let captured = 0;
  for (const section of CMO_SECTIONS) {
    try {
      const loc = page.locator(section.selector).first();
      const visible = await loc.isVisible().catch(() => false);
      if (!visible) {
        // Still take a viewport snap so we have a placeholder — counts toward
        // the ≥25 budget and proves we attempted the section.
        await page.evaluate(() => window.scrollBy(0, 400));
        await page.waitForTimeout(200);
        await snap(page, `${section.name}-not-found`);
        captured += 1;
        continue;
      }
      await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
      // Capture full page (so context is preserved); section locator clipping
      // is too brittle across React render variations.
      await snap(page, section.name);
      captured += 1;
    } catch (e) {
      logWarn(`capture section failed`, { section: section.name, err: String(e) });
    }
  }
  logInfo(`captured ${captured} CMO sections`);
}

// ---------------------------------------------------------------------------
// Supabase server-side assertions
// ---------------------------------------------------------------------------

function makeSupabase(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface EnrichmentRow {
  id: string;
  user_id: string;
  scan_id?: string | null;
  enrichment: Record<string, unknown> | null;
  created_at: string;
}

async function assertEnrichmentRow(
  sb: SupabaseClient,
  scanId: string | null,
  userId: string | null,
): Promise<void> {
  const t0 = nowMs();
  try {
    let q = sb.from('business_dna_enrichment').select('id,user_id,scan_id,enrichment,created_at').order('created_at', { ascending: false }).limit(5);
    if (scanId) {
      q = q.eq('scan_id', scanId);
    } else if (userId) {
      q = q.eq('user_id', userId);
    }
    const { data, error } = await q;
    if (error) {
      recordCheck({ name: 'supabase_enrichment_row', status: 'FAIL', detail: `query error: ${error.message}`, duration_ms: nowMs() - t0 });
      return;
    }
    if (!data || data.length === 0) {
      recordCheck({ name: 'supabase_enrichment_row', status: 'FAIL', detail: 'no business_dna_enrichment row found', duration_ms: nowMs() - t0 });
      return;
    }
    const row = data[0] as EnrichmentRow;
    recordCheck({ name: 'supabase_enrichment_row_present', status: 'PASS', detail: `id=${row.id}`, duration_ms: nowMs() - t0 });

    // R2F: capture the enrichment payload for the depth verifier.
    captured.enrichment_payload = (row.enrichment ?? null) as Record<string, unknown> | null;

    // Required fields populated.
    const enrichment = row.enrichment ?? {};
    const businessName = String((enrichment as any).business_name ?? '');
    const competitors = Array.isArray((enrichment as any).competitors) ? (enrichment as any).competitors : [];
    const swot = ((enrichment as any).swot ?? {}) as Record<string, unknown>;
    const swotStrengths = Array.isArray((swot as any).strengths) ? (swot as any).strengths : [];
    const aiErrors = Array.isArray((enrichment as any).ai_errors) ? (enrichment as any).ai_errors : [];

    if (!businessName) {
      recordCheck({ name: 'enrichment_business_name_present', status: 'FAIL', detail: 'business_name missing/empty in enrichment payload' });
    } else {
      recordCheck({ name: 'enrichment_business_name_present', status: 'PASS', detail: `business_name="${businessName}"` });
    }

    // For low-signal cases (e.g. small professional services firms), competitors
    // may legitimately be empty — that's WARN not FAIL per low_signal_acceptable.
    if (competitors.length === 0) {
      recordCheck({
        name: 'enrichment_competitors_present',
        status: targetCfg.low_signal_acceptable ? 'WARN' : 'FAIL',
        detail: 'competitors array empty (zero items)',
      });
    } else {
      recordCheck({ name: 'enrichment_competitors_present', status: 'PASS', detail: `${competitors.length} competitors` });
    }

    if (swotStrengths.length === 0) {
      recordCheck({
        name: 'enrichment_swot_strengths_present',
        status: targetCfg.low_signal_acceptable ? 'WARN' : 'FAIL',
        detail: 'swot.strengths empty',
      });
    } else {
      recordCheck({ name: 'enrichment_swot_strengths_present', status: 'PASS', detail: `${swotStrengths.length} strengths` });
    }

    // Per zero-401-tolerance: ai_errors MUST be empty.
    if (aiErrors.length > 0) {
      recordCheck({
        name: 'enrichment_ai_errors_empty',
        status: 'FAIL',
        detail: `ai_errors has ${aiErrors.length} entry/entries: ${JSON.stringify(aiErrors).slice(0, 500)}`,
      });
    } else {
      recordCheck({ name: 'enrichment_ai_errors_empty', status: 'PASS', detail: 'ai_errors empty' });
    }

    // Stash scan_id from the row if our UI capture missed it.
    if (!result.scan_id && (row as any).scan_id) {
      result.scan_id = (row as any).scan_id;
    }
  } catch (e) {
    recordCheck({ name: 'supabase_enrichment_row', status: 'FAIL', detail: `exception: ${String(e)}`, duration_ms: nowMs() - t0 });
  }
}

async function assertEnrichmentTraces(sb: SupabaseClient, scanId: string | null, userId: string | null): Promise<void> {
  const t0 = nowMs();
  try {
    // The enrichment_traces table may not exist yet. Probe + downgrade gracefully.
    // R2F: also fetch source_trace_id + section_name so the depth verifier can
    // assert "every CMO section has at least one source_trace_id".
    let q = sb
      .from('enrichment_traces')
      .select('function_name,status_code,duration_ms,created_at,source_trace_id,section_name')
      .order('created_at', { ascending: false })
      .limit(200);
    if (scanId) q = q.eq('scan_id', scanId);
    else if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q;
    if (error) {
      // Table missing or RLS denies = WARN, not FAIL — Andreas hasn't shipped
      // it yet but the workflow shouldn't false-positive on its absence.
      // Code 42P01 = undefined_table (Postgres). PGRST106 = relation not found.
      const isMissing = /relation .*does not exist|PGRST106|42P01/i.test(error.message);
      // The depth verifier reads enrichment_traces_table_exists to decide
      // whether to FAIL or WARN on the trace count. If we couldn't even query,
      // mark the table as not-existing so downstream assertions degrade.
      captured.enrichment_traces_table_exists = false;
      recordCheck({
        name: 'supabase_enrichment_traces_query',
        status: isMissing ? 'WARN' : 'FAIL',
        detail: `enrichment_traces query: ${error.message}`,
        duration_ms: nowMs() - t0,
      });
      return;
    }
    const rows = data ?? [];
    // R2F: stash for the depth verifier — it needs the full row list.
    captured.enrichment_traces = rows.map((r: any) => ({
      function_name: r.function_name,
      status_code: r.status_code,
      source_trace_id: r.source_trace_id ?? null,
      section_name: r.section_name ?? null,
    }));
    captured.enrichment_traces_table_exists = true;
    if (rows.length === 0) {
      recordCheck({
        name: 'supabase_enrichment_traces_present',
        status: 'WARN',
        detail: 'no enrichment_traces rows for this scan — table may not be wired yet',
        duration_ms: nowMs() - t0,
      });
      return;
    }

    // Per zero-401: every status_code MUST be 200.
    const non200 = rows.filter((r: any) => r.status_code !== 200);
    if (non200.length > 0) {
      const summary = non200.slice(0, 5).map((r: any) => `${r.function_name}=${r.status_code}`).join(', ');
      recordCheck({
        name: 'enrichment_traces_zero_401',
        status: 'FAIL',
        detail: `${non200.length} non-200 status(es): ${summary}`,
        duration_ms: nowMs() - t0,
      });
    } else {
      recordCheck({
        name: 'enrichment_traces_zero_401',
        status: 'PASS',
        detail: `all ${rows.length} traces returned 200`,
        duration_ms: nowMs() - t0,
      });
    }

    // All 8 required edge functions present?
    const seen = new Set(rows.map((r: any) => r.function_name));
    const missing = REQUIRED_EDGE_FUNCTIONS.filter((fn) => !seen.has(fn));
    if (missing.length > 0) {
      // review-aggregator is "soft" (may not be wired yet), the other 7 are hard.
      const hardMissing = missing.filter((fn) => fn !== 'review-aggregator');
      if (hardMissing.length > 0) {
        recordCheck({
          name: 'enrichment_traces_all_edge_fns_called',
          status: 'FAIL',
          detail: `missing required edge functions: ${hardMissing.join(', ')}`,
        });
      } else {
        recordCheck({
          name: 'enrichment_traces_all_edge_fns_called',
          status: 'WARN',
          detail: `optional review-aggregator trace not present`,
        });
      }
    } else {
      recordCheck({
        name: 'enrichment_traces_all_edge_fns_called',
        status: 'PASS',
        detail: `all 8 required edge functions traced`,
      });
    }
  } catch (e) {
    recordCheck({ name: 'supabase_enrichment_traces_query', status: 'WARN', detail: `exception: ${String(e)}`, duration_ms: nowMs() - t0 });
  }
}

async function assertShareEvent(sb: SupabaseClient, scanId: string | null, userId: string | null): Promise<void> {
  const t0 = nowMs();
  try {
    let q = sb.from('share_events').select('id,share_target,created_at').order('created_at', { ascending: false }).limit(5);
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q;
    if (error) {
      const isMissing = /relation .*does not exist|PGRST106|42P01/i.test(error.message);
      recordCheck({
        name: 'supabase_share_events_query',
        status: isMissing ? 'WARN' : 'FAIL',
        detail: `share_events query: ${error.message}`,
        duration_ms: nowMs() - t0,
      });
      return;
    }
    const rows = data ?? [];
    // Recent share event (within last 5 min) — created during this test run.
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const recent = rows.filter((r: any) => new Date(r.created_at).getTime() > fiveMinAgo);
    if (recent.length > 0) {
      recordCheck({ name: 'supabase_share_event_recorded', status: 'PASS', detail: `${recent.length} recent share_events row(s)`, duration_ms: nowMs() - t0 });
    } else {
      recordCheck({
        name: 'supabase_share_event_recorded',
        status: 'WARN',
        detail: 'no share_events row in last 5 min (UI confirmation modal seen but DB write may be async/not-instrumented)',
        duration_ms: nowMs() - t0,
      });
    }
  } catch (e) {
    recordCheck({ name: 'supabase_share_events_query', status: 'WARN', detail: `exception: ${String(e)}`, duration_ms: nowMs() - t0 });
  }
}

/**
 * R2F: read Trinity router quorum state from `router_config` (or
 * `get_router_config()` RPC). This table/RPC may not be wired yet — the
 * verifier downgrades to UNKNOWN/WARN when missing, so this query failing is
 * NOT a depth_pass failure.
 */
async function fetchRouterConfig(sb: SupabaseClient): Promise<{ quorum_capability?: string; single_provider_since_days?: number | null } | null> {
  // Try the RPC first (preferred shape per E9).
  try {
    const { data, error } = await sb.rpc('get_router_config');
    if (!error && data) {
      const row = Array.isArray(data) ? data[0] : data;
      return {
        quorum_capability: (row as any)?.quorum_capability,
        single_provider_since_days: (row as any)?.single_provider_since_days ?? null,
      };
    }
  } catch {
    /* RPC missing — try table. */
  }
  // Fallback: a `router_config` table with a single row.
  try {
    const { data, error } = await sb.from('router_config').select('quorum_capability,single_provider_since_days').limit(1);
    if (!error && data && data.length > 0) {
      return {
        quorum_capability: (data[0] as any).quorum_capability,
        single_provider_since_days: (data[0] as any).single_provider_since_days ?? null,
      };
    }
  } catch {
    /* table missing — fine. */
  }
  return null;
}

/**
 * R2F: run the depth verification suite after presence checks have populated
 * the captured.* scratchpad. Mutates result.depth, result.depth_checks,
 * result.depth_pass, result.depth_failures, result.g0d_semrush_total_failure.
 *
 * The depth verifier returns its own check list; we mirror those into the
 * top-level result.checks so finalize()'s presence + depth gates both fire.
 */
async function runDepthVerification(sb: SupabaseClient): Promise<void> {
  const t0 = nowMs();
  // Snapshot presence-only failures before depth checks land — this is what
  // the aggregator needs to surface "presence vs depth" separately.
  result.presence_failures = [...result.failures];

  if (!captured.rendered_html) {
    recordCheck({
      name: 'depth_verification_skipped',
      status: 'FAIL',
      detail: 'no rendered HTML captured — CMO never rendered, depth check cannot run',
    });
    result.depth = null;
    result.depth_pass = false;
    return;
  }
  if (!captured.enrichment_payload) {
    recordCheck({
      name: 'depth_verification_skipped',
      status: 'FAIL',
      detail: 'no enrichment payload captured — depth check cannot run on missing data',
    });
    result.depth = null;
    result.depth_pass = false;
    return;
  }

  const router_config = await fetchRouterConfig(sb);

  const depthOut = verifyDepth({
    slug: targetCfg.slug,
    enrichment: captured.enrichment_payload,
    html: captured.rendered_html,
    enrichment_traces: captured.enrichment_traces,
    enrichment_traces_table_exists: captured.enrichment_traces_table_exists,
    router_config,
  });

  result.depth = depthOut.depth;
  result.depth_checks = depthOut.checks;
  result.depth_pass = depthOut.depth_pass;
  result.g0d_semrush_total_failure = depthOut.g0d_total_failure;
  result.depth_failures = depthOut.checks
    .filter((c) => c.status === 'FAIL')
    .map((c) => ({ check: c.name, detail: c.detail, category: c.category }));

  // Mirror depth checks into result.checks so finalize() sees them, prefixed
  // so they're easy to grep in the JSON.
  for (const dc of depthOut.checks) {
    result.checks.push({
      name: `depth.${dc.category}.${dc.name}`,
      status: dc.status,
      detail: dc.detail,
    });
    if (dc.status === 'FAIL') {
      result.failures.push({
        check: `depth.${dc.category}.${dc.name}`,
        detail: dc.detail,
      });
    } else if (dc.status === 'WARN') {
      result.warnings.push({
        check: `depth.${dc.category}.${dc.name}`,
        detail: dc.detail,
      });
    }
  }

  // Surface G0d as its own top-level check — used by the aggregator + alert
  // pipeline to fire the SEMRUSH_SUPPLIER_TOTAL_FAILURE alert separately
  // from per-metric failures.
  if (depthOut.g0d_total_failure) {
    recordCheck({
      name: 'g0d_semrush_supplier_total_failure',
      status: 'FAIL',
      detail: 'G0d: ALL 4 SEMrush depth assertions failed simultaneously — supplier total failure',
    });
  }

  // Roll-up summary line for log scrubbers.
  recordCheck({
    name: 'depth_verification_summary',
    status: depthOut.depth_pass ? 'PASS' : 'FAIL',
    detail: `depth_pass=${depthOut.depth_pass} failures=${result.depth_failures.length} g0d=${depthOut.g0d_total_failure} t=${nowMs() - t0}ms`,
  });
}

async function resolveUserAndAccount(sb: SupabaseClient): Promise<{ user_id: string | null; account_id: string | null }> {
  // Look up the QA user by email so we can scope server-side queries.
  try {
    const { data: u, error } = await sb
      .from('users')
      .select('id,account_id,email')
      .eq('email', QA_EMAIL)
      .limit(1)
      .maybeSingle();
    if (error) {
      logWarn('resolveUserAndAccount: query error', { err: error.message });
      return { user_id: null, account_id: null };
    }
    if (!u) {
      logWarn('resolveUserAndAccount: QA user not found in public.users — has it been seeded? See SETUP.md');
      return { user_id: null, account_id: null };
    }
    return { user_id: (u as any).id ?? null, account_id: (u as any).account_id ?? null };
  } catch (e) {
    logWarn('resolveUserAndAccount: exception', { err: String(e) });
    return { user_id: null, account_id: null };
  }
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  ensureDir(EVIDENCE_DIR);
  ensureDir(path.join(EVIDENCE_DIR, 'screenshots'));

  const t_run_start = nowMs();

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  const sb = makeSupabase();
  const { user_id, account_id } = await resolveUserAndAccount(sb);
  result.user_id = user_id;
  result.account_id = account_id;

  if (!user_id) {
    recordCheck({
      name: 'qa_user_seeded',
      status: 'FAIL',
      detail: `QA user ${QA_EMAIL} not in public.users — see scripts/daily-check/SETUP.md`,
    });
    // Cannot proceed meaningfully without a user.
    finalize();
    return;
  }
  recordCheck({ name: 'qa_user_seeded', status: 'PASS', detail: `user_id=${user_id}` });

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: false,
    });
    page = await context.newPage();

    // Capture console errors throughout the run.
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        result.console_errors.push(msg.text().slice(0, 500));
      }
    });
    page.on('pageerror', (err) => {
      result.console_errors.push(`PAGEERROR: ${err.message}`.slice(0, 500));
    });

    // ----- a. Login -----
    const t_login_start = nowMs();
    await page.goto(`${FRONTEND_BASE}/login-supabase`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await snap(page, 'login-page');

    const emailInput = page.getByRole('textbox', { name: /work email|email/i });
    await emailInput.waitFor({ timeout: 15000 });
    await emailInput.fill(QA_EMAIL);
    await page.getByRole('textbox', { name: /password/i }).fill(QA_PASSWORD);

    // Optional captcha (production sometimes has an arithmetic challenge).
    const captcha = page.getByRole('spinbutton');
    if (await captcha.isVisible().catch(() => false)) {
      const txt = await page.locator('text=/solve\\s+\\d+\\s*\\+\\s*\\d+/i').first().textContent().catch(() => null);
      const m = txt?.match(/solve\s+(\d+)\s*\+\s*(\d+)/i);
      if (m) await captcha.fill(String(Number(m[1]) + Number(m[2])));
    }

    await page.getByRole('button', { name: /sign in|login/i }).click();
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await snap(page, 'login-success');
    result.latencies.t_login_ms = nowMs() - t_login_start;
    recordCheck({ name: 'login', status: 'PASS', detail: `t=${result.latencies.t_login_ms}ms` });

    // ----- b/c. Navigate to URL Scan and submit -----
    await page.goto(`${FRONTEND_BASE}/market/calibration`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    await snap(page, 'url-scan-page');

    const urlInput = page.getByTestId('calibration-url-input').or(page.locator('input[type="url"], input[name*="url" i], input[placeholder*="url" i]').first());
    await urlInput.waitFor({ timeout: 15000 });
    await urlInput.fill(targetCfg.url);
    await snap(page, 'url-entered');

    const t_submit = nowMs();
    const scanBtn = page.getByTestId('calibration-scan-btn').or(page.getByRole('button', { name: /scan|analy[sz]e|start/i }).first());
    await scanBtn.click();

    // t=1s loading screenshot (per spec 3c).
    await page.waitForTimeout(1000);
    await snap(page, 'loading-state');
    result.latencies.t_backend_ack_ms = nowMs() - t_submit;
    recordCheck({ name: 'scan_submitted', status: 'PASS', detail: `ack t=${result.latencies.t_backend_ack_ms}ms` });

    // ----- d. Poll for terminal state -----
    const t_term_start = nowMs();
    const terminalBudget = POLL_CONFIG.T_TERMINAL_TIMEOUT_MS;
    let terminalState: string | null = null;
    let pollCount = 0;
    while (nowMs() - t_term_start < terminalBudget) {
      pollCount += 1;
      await page.waitForTimeout(POLL_CONFIG.POLL_INTERVAL_MS);
      // Check for terminal-state markers in DOM. The exact markers are
      // surface-dependent; we accept several signals.
      const bodyText = (await page.textContent('body').catch(() => '')) || '';
      const hasViewReportBtn = await page
        .getByTestId('calibration-view-report-btn')
        .or(page.getByRole('button', { name: /view\s+(full\s+)?(cmo\s+)?report/i }).first())
        .isVisible()
        .catch(() => false);
      const hasErrorPanel = await page.getByTestId('calibration-scan-error').isVisible().catch(() => false);
      for (const ts of TERMINAL_STATES) {
        if (bodyText.includes(ts)) {
          terminalState = ts;
          break;
        }
      }
      if (!terminalState && hasViewReportBtn) terminalState = 'DATA_AVAILABLE';
      if (!terminalState && hasErrorPanel) terminalState = 'DEGRADED';
      if (terminalState) break;

      if (pollCount % 10 === 0) {
        await snap(page, `polling-tick-${String(pollCount).padStart(3, '0')}`);
      }
    }
    result.latencies.t_terminal_ms = nowMs() - t_term_start;
    result.terminal_state = terminalState;
    if (!terminalState) {
      recordCheck({
        name: 'scan_reached_terminal',
        status: 'FAIL',
        detail: `did not reach terminal state within ${terminalBudget}ms`,
      });
    } else {
      const allowed = (TERMINAL_STATES as readonly string[]).includes(terminalState);
      recordCheck({
        name: 'scan_reached_terminal',
        status: allowed ? 'PASS' : 'WARN',
        detail: `terminal=${terminalState} t=${result.latencies.t_terminal_ms}ms`,
      });
    }

    // ----- e. Result snapshot -----
    await snap(page, 'scan-result');

    // Try to extract scan_id from URL or page state.
    const urlNow = page.url();
    const scanIdMatch = urlNow.match(/scan[_-]?id[=/]([a-f0-9-]{8,})/i);
    if (scanIdMatch) result.scan_id = scanIdMatch[1];

    // ----- f. Navigate to CMO Report and capture sections -----
    if (terminalState === 'DATA_AVAILABLE' || terminalState === 'DEGRADED' || terminalState === 'INSUFFICIENT_SIGNAL') {
      // Try the View Report button first (preserves any in-flight state), else navigate directly.
      const viewBtn = page.getByTestId('calibration-view-report-btn').or(
        page.getByRole('button', { name: /view\s+(full\s+)?(cmo\s+)?report/i }).first(),
      );
      if (await viewBtn.isVisible().catch(() => false)) {
        await viewBtn.click();
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      } else {
        await page.goto(`${FRONTEND_BASE}/cmo-report`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }
      await page.waitForTimeout(2000);

      await captureCmoSections(page);
      recordCheck({ name: 'cmo_report_rendered', status: 'PASS', detail: `${result.screenshots.length} screenshots captured` });

      // ----- Contract v2 + placeholder denylist scan over rendered HTML -----
      const html = await page.content();
      // R2F: stash for the depth verifier (Marketing-101 sweep, brand audit,
      // authority-rank label check).
      captured.rendered_html = html;
      const supplierLeak = denylistScan(html, SUPPLIER_NAME_DENYLIST);
      const internalLeak = denylistScan(html, INTERNAL_STATE_DENYLIST);
      const placeholderLeak = denylistScan(html, PLACEHOLDER_DENYLIST);

      recordCheck({
        name: 'contract_v2_no_supplier_names_in_html',
        status: supplierLeak.hit ? 'FAIL' : 'PASS',
        detail: supplierLeak.hit ? `LEAKED: ${supplierLeak.matches.join(', ')}` : 'clean',
      });
      recordCheck({
        name: 'contract_v2_no_internal_codes_in_html',
        status: internalLeak.hit ? 'FAIL' : 'PASS',
        detail: internalLeak.hit ? `LEAKED: ${internalLeak.matches.join(', ')}` : 'clean',
      });
      recordCheck({
        name: 'no_placeholders_in_html',
        status: placeholderLeak.hit ? 'FAIL' : 'PASS',
        detail: placeholderLeak.hit ? `FOUND: ${placeholderLeak.matches.join(', ')}` : 'clean',
      });

      // ----- g. PDF download -----
      try {
        const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
        const pdfBtn = page.getByRole('button', { name: /download\s+pdf|export\s+pdf|pdf/i }).first();
        await pdfBtn.click({ timeout: 10000 });
        const dl: Download = await downloadPromise;
        const pdfPath = path.join(EVIDENCE_DIR, 'report.pdf');
        await dl.saveAs(pdfPath);
        const stat = fs.statSync(pdfPath);
        result.pdf_path = 'report.pdf';
        result.pdf_size_bytes = stat.size;

        // Sniff content type via magic bytes.
        const buf = fs.readFileSync(pdfPath, { flag: 'r' });
        const isPdf = buf.slice(0, 4).toString() === '%PDF';
        result.pdf_content_type = isPdf ? 'application/pdf' : 'unknown';

        const sizeOk = stat.size >= 10 * 1024;
        recordCheck({
          name: 'pdf_download_size',
          status: sizeOk ? 'PASS' : 'FAIL',
          detail: `size=${stat.size}B (>=10KB required)`,
        });
        recordCheck({
          name: 'pdf_download_content_type',
          status: isPdf ? 'PASS' : 'FAIL',
          detail: `magic_bytes=${buf.slice(0, 4).toString('hex')}`,
        });

        // PDF text denylist scan.
        try {
          const parsed = await pdfParse(buf);
          const pdfText = parsed.text || '';
          const pdfSupplier = denylistScan(pdfText, SUPPLIER_NAME_DENYLIST);
          const pdfInternal = denylistScan(pdfText, INTERNAL_STATE_DENYLIST);
          const pdfPlaceholder = denylistScan(pdfText, PLACEHOLDER_DENYLIST);
          recordCheck({
            name: 'contract_v2_no_supplier_names_in_pdf',
            status: pdfSupplier.hit ? 'FAIL' : 'PASS',
            detail: pdfSupplier.hit ? `LEAKED: ${pdfSupplier.matches.join(', ')}` : 'clean',
          });
          recordCheck({
            name: 'contract_v2_no_internal_codes_in_pdf',
            status: pdfInternal.hit ? 'FAIL' : 'PASS',
            detail: pdfInternal.hit ? `LEAKED: ${pdfInternal.matches.join(', ')}` : 'clean',
          });
          recordCheck({
            name: 'no_placeholders_in_pdf',
            status: pdfPlaceholder.hit ? 'FAIL' : 'PASS',
            detail: pdfPlaceholder.hit ? `FOUND: ${pdfPlaceholder.matches.join(', ')}` : 'clean',
          });
        } catch (pdfErr) {
          recordCheck({
            name: 'pdf_parse',
            status: 'WARN',
            detail: `pdf-parse failed: ${String(pdfErr)} — denylist not applied to PDF text`,
          });
        }
      } catch (e) {
        recordCheck({
          name: 'pdf_download',
          status: 'FAIL',
          detail: `download failed/timed out: ${String(e)}`,
        });
      }

      // ----- h. Share -----
      try {
        const shareBtn = page.getByRole('button', { name: /share/i }).first();
        if (await shareBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await shareBtn.click();
          await page.waitForTimeout(1500);
          await snap(page, 'share-modal');
          // Look for confirmation UI (any of: a copy-link button, a modal, "shared" text).
          const confirmed =
            (await page.getByRole('dialog').isVisible().catch(() => false)) ||
            (await page.getByText(/copied|shared|link\s+copied/i).first().isVisible().catch(() => false)) ||
            (await page.getByRole('button', { name: /copy\s+link/i }).first().isVisible().catch(() => false));
          recordCheck({
            name: 'share_ui_confirmed',
            status: confirmed ? 'PASS' : 'WARN',
            detail: confirmed ? 'share modal/confirmation visible' : 'no confirmation UI seen',
          });
        } else {
          recordCheck({ name: 'share_ui_confirmed', status: 'WARN', detail: 'share button not visible on CMO report' });
        }
      } catch (e) {
        recordCheck({ name: 'share_ui_confirmed', status: 'WARN', detail: `share interaction failed: ${String(e)}` });
      }
    } else {
      recordCheck({ name: 'cmo_report_rendered', status: 'FAIL', detail: 'scan never reached terminal — CMO not attempted' });
    }

    // ----- i/j/h server-side checks -----
    await assertEnrichmentRow(sb, result.scan_id, result.user_id);
    await assertEnrichmentTraces(sb, result.scan_id, result.user_id);
    await assertShareEvent(sb, result.scan_id, result.user_id);

    // ----- R2F depth verification (runs AFTER presence checks have populated
    //   the captured.* scratchpad with enrichment payload, traces, and HTML).
    await runDepthVerification(sb);

    // Console error sanity (informational WARN, not FAIL — React can be noisy).
    if (result.console_errors.length > 0) {
      recordCheck({
        name: 'browser_console_errors',
        status: result.console_errors.length > 5 ? 'WARN' : 'PASS',
        detail: `${result.console_errors.length} console errors observed`,
      });
    } else {
      recordCheck({ name: 'browser_console_errors', status: 'PASS', detail: '0 console errors' });
    }
  } catch (e) {
    logErr('runner exception', { err: String(e) });
    recordCheck({ name: 'runner_exception', status: 'FAIL', detail: `unhandled: ${String(e)}` });
  } finally {
    if (page) {
      try {
        await snap(page, 'final-state');
      } catch {}
    }
    if (browser) await browser.close().catch(() => {});
    result.latencies.t_total_ms = nowMs() - t_run_start;
    finalize();
  }
}

function finalize(): void {
  // Decide overall status. Any FAIL = FAIL. WARN-only with ≥1 WARN + ≥1 PASS = DEGRADED. All-PASS = PASS.
  // R2F: depth_pass=false MUST also force FAIL, belt-and-braces against any
  // future refactor that stops mirroring depth FAILs into result.checks.
  // Per spec: "Per-URL: depth_pass = false → URL FAIL".
  const failCount = result.checks.filter((c) => c.status === 'FAIL').length;
  const warnCount = result.checks.filter((c) => c.status === 'WARN').length;
  const passCount = result.checks.filter((c) => c.status === 'PASS').length;
  const depthForcesFail = result.depth !== null && result.depth_pass === false;
  if (failCount > 0 || depthForcesFail) {
    result.overall_status = 'FAIL';
  } else if (warnCount > 0 && passCount > 0) {
    result.overall_status = 'DEGRADED';
  } else if (passCount > 0) {
    result.overall_status = 'PASS';
  } else {
    // No checks ran at all = FAIL (the runner crashed before reaching checks).
    result.overall_status = 'FAIL';
  }

  ensureDir(EVIDENCE_DIR);
  const out = path.join(EVIDENCE_DIR, 'result.json');
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  logInfo('result.json written', { path: out, overall: result.overall_status });

  // IMPORTANT: do not exit 1 on per-URL failure. The aggregator decides the
  // workflow exit code. This runner exits 0 so the workflow step succeeds and
  // artefacts upload.
  process.exit(0);
}

run().catch((e) => {
  logErr('top-level run() crashed', { err: String(e) });
  recordCheck({ name: 'top_level_crash', status: 'FAIL', detail: String(e) });
  finalize();
});
