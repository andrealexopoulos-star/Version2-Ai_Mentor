/**
 * Check whether the most-recent two daily_check_runs are both FAIL.
 * If so, decorate the aggregate JSON with severity=PAGE so the alert step
 * raises a higher-priority message.
 *
 * Reads aggregate-input/aggregate.json (current run) + queries last 2 rows
 * from daily_check_runs. If table missing, no-op.
 *
 * --- F6 P0-1 patch (peer reviewer R10 finding) ---
 * Previous bug: this script was queried AFTER persist-run.ts, with LIMIT 1.
 * That meant the "prior run" we read was the row we had just inserted —
 * never the genuine prior run. Two-consecutive-FAIL escalation could
 * therefore *never* trigger.
 *
 * Fix (defensive): fetch LIMIT 2 and explicitly skip the row whose
 * workflow_run_id matches the current run. Keep workflow ordering as-is so
 * that persistence happens FIRST and an escalation script crash cannot
 * silently lose the run record. The filter makes us robust against any
 * future workflow re-ordering as well.
 *
 * Belt-and-braces fallback: if neither row carries a workflow_run_id (older
 * historical rows from before persist-run started writing it), we fall back
 * to "skip the most-recent row whose run_at is within 60s of our own
 * aggregate.run_at_utc" (likely the same run, possibly inserted by us).
 * If even that fails, we use the older of the two rows by ordering — never
 * the newer.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function getEnv(name: string): string | null {
  return process.env[name] ?? null;
}

interface PriorRun {
  id: string;
  overall_status: string;
  run_at: string;
  workflow_run_id: string | null;
}

/**
 * Pure helper — exported for tests.
 *
 * Given the two most recent rows from daily_check_runs (DESC by run_at) and
 * the current run's identity, return the row that represents the genuine
 * prior run (or null if there isn't one).
 */
export function pickPriorRun(
  rows: PriorRun[],
  currentRunId: string | null,
  currentRunAtIso: string | null,
): PriorRun | null {
  if (!rows || rows.length === 0) return null;

  // Strategy 1: if the current workflow_run_id matches one of the rows,
  // that row IS us — exclude it. Only short-circuit if we actually removed
  // a match; otherwise the IDs gave us no information and we fall through
  // to the time-based check (avoids defaulting to row[0] when none of the
  // rows even carry a workflow_run_id).
  if (currentRunId) {
    const matchedSelf = rows.some((r) => r.workflow_run_id === currentRunId);
    if (matchedSelf) {
      const filtered = rows.filter((r) => r.workflow_run_id !== currentRunId);
      if (filtered.length > 0) return filtered[0];
      // We removed our row but nothing left → no genuine prior.
      return null;
    }
    // No row matched our ID — can't disambiguate by ID; fall through.
  }

  // Strategy 2: filter by run_at proximity (rows within 60s of current run
  // are almost certainly the same run, possibly inserted by us).
  if (currentRunAtIso) {
    const currentTs = Date.parse(currentRunAtIso);
    if (!Number.isNaN(currentTs)) {
      const filtered = rows.filter((r) => {
        const rTs = Date.parse(r.run_at);
        if (Number.isNaN(rTs)) return true; // unknown ts → treat as different run
        return Math.abs(rTs - currentTs) > 60_000;
      });
      if (filtered.length > 0) return filtered[0];
      // Every row is within 60s of us → all are likely us → no genuine prior.
      return null;
    }
  }

  // Strategy 3 (last resort): if we got 2 rows, return the older (index 1).
  // Never index 0 — that's the most-recent and most likely to be us.
  if (rows.length >= 2) return rows[1];

  // Single row, no way to disambiguate → assume it is us, return null.
  return null;
}

async function main(): Promise<void> {
  const aggPath = path.resolve(__dirname, 'aggregate-input', 'aggregate.json');
  if (!fs.existsSync(aggPath)) {
    console.log('[escalation] no aggregate.json — nothing to escalate');
    process.exit(0);
  }
  const agg = JSON.parse(fs.readFileSync(aggPath, 'utf8'));
  if (agg.overall_status !== 'FAIL') {
    console.log(`[escalation] current run = ${agg.overall_status} — no escalation needed`);
    process.exit(0);
  }

  const projectId = getEnv('SUPABASE_PROJECT_ID');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!projectId || !serviceKey) {
    console.log('[escalation] supabase creds not set — cannot check history');
    process.exit(0);
  }

  const sb = createClient(`https://${projectId}.supabase.co`, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Fetch the 2 most-recent runs so we can filter out the current one and
  // still have a true prior to inspect. See pickPriorRun() for the logic.
  const { data, error } = await sb
    .from('daily_check_runs')
    .select('id,overall_status,run_at,workflow_run_id')
    .order('run_at', { ascending: false })
    .limit(2);

  if (error) {
    const isMissing = /relation .*does not exist|PGRST106|42P01/i.test(error.message);
    if (isMissing) {
      console.log('[escalation] daily_check_runs table not present — no escalation history');
      process.exit(0);
    }
    console.error(`[escalation] query failed: ${error.message}`);
    process.exit(0);
  }

  const rows = (data ?? []) as PriorRun[];
  const currentRunId = (agg.workflow_run_id ?? process.env.WORKFLOW_RUN_ID ?? null) as string | null;
  const currentRunAt = (agg.run_at_utc ?? null) as string | null;
  const priorRun = pickPriorRun(rows, currentRunId, currentRunAt);

  console.log(
    `[escalation] history rows=${rows.length} current_run_id=${currentRunId ?? 'NONE'} ` +
      `prior_run_id=${priorRun?.id ?? 'NONE'} prior_status=${priorRun?.overall_status ?? 'NONE'}`,
  );

  // Current run is FAIL. If the most-recent prior run is ALSO FAIL → PAGE severity.
  if (priorRun && priorRun.overall_status === 'FAIL') {
    agg.severity = 'PAGE';
    agg.escalation_reason = 'two_consecutive_failed_runs';
    agg.prior_run_id = priorRun.id;
    fs.writeFileSync(aggPath, JSON.stringify(agg, null, 2));
    console.log('[escalation] PRIOR RUN ALSO FAILED — escalated severity to PAGE');
  } else {
    console.log(`[escalation] prior run = ${priorRun?.overall_status ?? 'NONE'} — current FAIL is first in sequence`);
  }
}

// Only run if invoked directly, not when imported by tests.
// tsx executes the entrypoint with require.main === module in CJS-emulation
// mode; tests that import pickPriorRun from this file do not trigger this.
function invokedDirectly(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return typeof require !== 'undefined' && require.main === module;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  main().catch((e) => {
    console.error(`[escalation] crashed: ${String(e)}`);
    process.exit(0);
  });
}
