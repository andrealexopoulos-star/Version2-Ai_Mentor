-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 088: Create job_execution_log table
--
-- This table is actively used by backend/biqc_jobs.py (line 531) for flushing
-- Redis job execution logs to Supabase for permanent storage. Without this
-- table, the _flush_log_buffer() method silently fails and re-queues entries.
--
-- Referenced by:
--   backend/biqc_jobs.py: sb.table("job_execution_log").upsert(rows, on_conflict="job_id")
--
-- Columns from code:
--   job_id       — unique job identifier (upsert conflict key)
--   job_type     — e.g. 'watchtower-analysis', 'advisor-analysis', 'ai-reasoning-log'
--   company_id   — optional company/workspace association
--   status       — 'success', 'failed', 'skipped'
--   result_summary — truncated JSON result (max 2000 chars)
--   processed_at — when the job was processed by the worker
--
-- Uses CREATE TABLE IF NOT EXISTS for idempotency.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.job_execution_log (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          text NOT NULL UNIQUE,
    job_type        text NOT NULL,
    company_id      text,
    status          text NOT NULL DEFAULT 'success',
    result_summary  text,
    processed_at    timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by job type and status
CREATE INDEX IF NOT EXISTS idx_job_execution_log_type_status
    ON public.job_execution_log(job_type, status);

-- Index for querying recent jobs
CREATE INDEX IF NOT EXISTS idx_job_execution_log_processed
    ON public.job_execution_log(processed_at DESC);

-- Index for company-scoped queries
CREATE INDEX IF NOT EXISTS idx_job_execution_log_company
    ON public.job_execution_log(company_id)
    WHERE company_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.job_execution_log ENABLE ROW LEVEL SECURITY;

-- Service role full access (backend worker writes via service key)
CREATE POLICY "job_exec_log_service_role"
    ON public.job_execution_log FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- No direct user access — this is an internal operations table.
-- Super admins access via backend API endpoints (GET /api/admin/jobs/*).

-- Auto-cleanup: keep only last 30 days of logs (optional — can be run as cron)
-- CREATE OR REPLACE FUNCTION public.cleanup_old_job_logs()
-- RETURNS void LANGUAGE plpgsql AS $$
-- BEGIN
--     DELETE FROM public.job_execution_log
--     WHERE processed_at < now() - interval '30 days';
-- END $$;
