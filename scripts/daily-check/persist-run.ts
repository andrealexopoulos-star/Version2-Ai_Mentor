/**
 * Insert the aggregate result as a row in public.daily_check_runs.
 *
 * Reads aggregate-input/aggregate.json. Uses SUPABASE_SERVICE_ROLE_KEY.
 *
 * If the table doesn't exist yet (migration not applied), logs a warning and
 * exits 0 — we don't want the alert/issue logic to be blocked on schema state.
 * The migration ships in the same PR as this workflow.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[persist] required env var ${name} not set`);
    process.exit(2);
  }
  return v;
}

async function main(): Promise<void> {
  const projectId = requireEnv('SUPABASE_PROJECT_ID');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const aggPath = path.resolve(__dirname, 'aggregate-input', 'aggregate.json');
  if (!fs.existsSync(aggPath)) {
    console.error('[persist] aggregate.json missing — cannot persist');
    process.exit(1);
  }
  const agg = JSON.parse(fs.readFileSync(aggPath, 'utf8'));

  const sb = createClient(`https://${projectId}.supabase.co`, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const row = {
    overall_status: agg.overall_status,
    fail_count: agg.fail_count,
    pass_count: agg.pass_count,
    per_url_json: agg,
    workflow_run_id: agg.workflow_run_id ?? null,
    workflow_run_url: agg.workflow_run_url ?? null,
  };

  const { data, error } = await sb.from('daily_check_runs').insert(row).select('id').maybeSingle();
  if (error) {
    const isMissing = /relation .*does not exist|PGRST106|42P01/i.test(error.message);
    if (isMissing) {
      console.warn(`[persist] daily_check_runs table missing — apply supabase/migrations/20260504000000_create_daily_check_runs.sql. Continuing without persistence.`);
      process.exit(0);
    }
    console.error(`[persist] insert failed: ${error.message}`);
    // Don't fail the workflow over persistence — alerting still needs to fire.
    process.exit(0);
  }
  console.log(`[persist] inserted daily_check_runs id=${(data as { id: string } | null)?.id ?? '<unknown>'}`);
}

main().catch((e) => {
  console.error(`[persist] crashed: ${String(e)}`);
  process.exit(0);
});
