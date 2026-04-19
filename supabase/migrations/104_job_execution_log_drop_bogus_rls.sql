-- 104_job_execution_log_drop_bogus_rls.sql
-- P0-d fix (2026-04-19): the "Users manage own data" policy on
-- job_execution_log references a user_id column that does NOT exist on
-- the table (schema is {company_id, id, job_id, job_type, status,
-- result_summary, created_at, processed_at}). Every non-service-role
-- write failed RLS.
--
-- Applied to prod via Supabase MCP on 2026-04-19 (ledger version
-- 20260419065229, name `079_job_execution_log_drop_bogus_rls`). This
-- file documents the change for repo/infra parity and is idempotent.

DROP POLICY IF EXISTS "Users manage own data" ON public.job_execution_log;

COMMENT ON POLICY job_exec_log_service_role ON public.job_execution_log IS
  'Only service_role writes/reads execution log. Users have no direct access — data surfaces through authenticated API routes. Bogus user-level policy dropped 2026-04-19.';
