/**
 * Check whether the most-recent two daily_check_runs are both FAIL.
 * If so, decorate the aggregate JSON with severity=PAGE so the alert step
 * raises a higher-priority message.
 *
 * Reads aggregate-input/aggregate.json (current run) + queries last 2 rows
 * from daily_check_runs. If table missing, no-op.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function getEnv(name: string): string | null {
  return process.env[name] ?? null;
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

  const { data, error } = await sb
    .from('daily_check_runs')
    .select('id,overall_status,run_at')
    .order('run_at', { ascending: false })
    .limit(1);

  if (error) {
    const isMissing = /relation .*does not exist|PGRST106|42P01/i.test(error.message);
    if (isMissing) {
      console.log('[escalation] daily_check_runs table not present — no escalation history');
      process.exit(0);
    }
    console.error(`[escalation] query failed: ${error.message}`);
    process.exit(0);
  }

  const lastRun = (data && data[0]) as { overall_status: string } | undefined;
  // Current run is FAIL. If the most-recent prior run is ALSO FAIL → PAGE severity.
  if (lastRun && lastRun.overall_status === 'FAIL') {
    agg.severity = 'PAGE';
    agg.escalation_reason = 'two_consecutive_failed_runs';
    fs.writeFileSync(aggPath, JSON.stringify(agg, null, 2));
    console.log('[escalation] PRIOR RUN ALSO FAILED — escalated severity to PAGE');
  } else {
    console.log(`[escalation] prior run = ${lastRun?.overall_status ?? 'NONE'} — current FAIL is first in sequence`);
  }
}

main().catch((e) => {
  console.error(`[escalation] crashed: ${String(e)}`);
  process.exit(0);
});
