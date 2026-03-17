-- ═══════════════════════════════════════════════════════════════
-- BIQc pg_cron SCHEDULED INTELLIGENCE
-- 
-- BEFORE running this SQL:
--   1. Go to Supabase Dashboard
--   2. Click "Database" in left sidebar  
--   3. Click "Extensions"
--   4. Search for "pg_cron"
--   5. Click the toggle to ENABLE it
--   6. Then come back here and run this SQL
-- ═══════════════════════════════════════════════════════════════

-- Enable the extension (if not already done via Dashboard)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant usage to postgres (required for Supabase)
GRANT USAGE ON SCHEMA cron TO postgres;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'biqc-evidence-freshness') THEN
    PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'biqc-evidence-freshness' LIMIT 1));
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'biqc-silence-detection') THEN
    PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'biqc-silence-detection' LIMIT 1));
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'biqc-contradiction-check') THEN
    PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'biqc-contradiction-check' LIMIT 1));
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'biqc-daily-summary') THEN
    PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'biqc-daily-summary' LIMIT 1));
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- JOB 1: Evidence Freshness Decay (every 6 hours)
-- Recalculates how fresh each data source is
-- Stale data gets lower confidence weighting
-- ═══════════════════════════════════════════════════════════════

SELECT cron.schedule(
    'biqc-evidence-freshness',
    '0 */6 * * *',
    $$
    SELECT compute_evidence_freshness(workspace_id)
    FROM (SELECT DISTINCT workspace_id FROM workspace_integrations WHERE status = 'connected') w;
    $$
);


-- ═══════════════════════════════════════════════════════════════
-- JOB 2: Silence Detection (daily at 8am UTC / 6pm AEST)
-- Detects users who haven't engaged with critical signals
-- Generates intervention recommendations
-- ═══════════════════════════════════════════════════════════════

SELECT cron.schedule(
    'biqc-silence-detection',
    '0 8 * * *',
    $$
    SELECT detect_silence(workspace_id)
    FROM (SELECT DISTINCT workspace_id FROM workspace_integrations WHERE status = 'connected') w;
    $$
);


-- ═══════════════════════════════════════════════════════════════
-- JOB 3: Contradiction Detection (every 12 hours)
-- Finds priority mismatches, action-inaction gaps
-- ═══════════════════════════════════════════════════════════════

SELECT cron.schedule(
    'biqc-contradiction-check',
    '0 */12 * * *',
    $$
    SELECT detect_contradictions(workspace_id)
    FROM (SELECT DISTINCT workspace_id FROM workspace_integrations WHERE status = 'connected') w;
    $$
);


-- ═══════════════════════════════════════════════════════════════
-- JOB 4: Full Intelligence Summary (daily at 2am UTC / 12pm AEST)
-- Rebuilds the complete intelligence picture for all active workspaces
-- ═══════════════════════════════════════════════════════════════

SELECT cron.schedule(
    'biqc-daily-summary',
    '0 2 * * *',
    $$
    SELECT build_intelligence_summary(workspace_id)
    FROM (SELECT DISTINCT workspace_id FROM workspace_integrations WHERE status = 'connected') w;
    $$
);


-- ═══════════════════════════════════════════════════════════════
-- Verify jobs are scheduled
-- ═══════════════════════════════════════════════════════════════

SELECT jobid, schedule, command, jobname
FROM cron.job
WHERE jobname LIKE 'biqc-%'
ORDER BY jobname;
