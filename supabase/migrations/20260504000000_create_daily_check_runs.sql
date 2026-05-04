-- Migration: create public.daily_check_runs
-- Owner: Marjo E10 — daily CMO E2E check workflow
-- Date:  2026-05-04
-- Standing order: ops_daily_health_check_procedure.md, ops_daily_calibration_check.md
--
-- Purpose
--   Persist the aggregate result of every scheduled daily CMO check. Used by:
--     - check-escalation.ts (look up prior run to detect 2-consecutive failure → severity=PAGE)
--     - human review (Andreas can SELECT to see PASS streak / churn-impacting failure history)
--     - future Retention Master Plan dashboard
--
-- Hardening
--   - id is gen_random_uuid (pgcrypto already enabled).
--   - run_at defaulted server-side so we never depend on client clock.
--   - overall_status constrained to enum-equivalent CHECK.
--   - per_url_json kept as full JSONB so we can re-derive any historical view
--     without losing fidelity (per BIQc Platform Contract v2 — internal layer
--     keeps full detail; sanitisation happens at the user-facing surface).

CREATE TABLE IF NOT EXISTS public.daily_check_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at          timestamptz NOT NULL DEFAULT NOW(),
  overall_status  text        NOT NULL CHECK (overall_status IN ('PASS','FAIL','DEGRADED')),
  fail_count      int         NOT NULL DEFAULT 0,
  pass_count      int         NOT NULL DEFAULT 0,
  per_url_json    jsonb       NOT NULL,
  workflow_run_id text,
  workflow_run_url text
);

CREATE INDEX IF NOT EXISTS idx_daily_check_runs_run_at_desc
  ON public.daily_check_runs (run_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_check_runs_status
  ON public.daily_check_runs (overall_status, run_at DESC);

-- RLS posture: this table is internal-only. Service role writes; nothing reads
-- from a user JWT. Enable RLS with a policy that only allows service_role —
-- equivalent to "no public access" because anon/authenticated roles get no
-- explicit policy and thus cannot SELECT/INSERT/etc.
ALTER TABLE public.daily_check_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_check_runs'
      AND policyname = 'daily_check_runs_service_role_full'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY daily_check_runs_service_role_full
        ON public.daily_check_runs
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)
    $sql$;
  END IF;
END $$;

COMMENT ON TABLE public.daily_check_runs IS
  'Aggregate result of scheduled BIQc daily CMO E2E checks. Written by .github/workflows/daily-cmo-check.yml. See scripts/daily-check/SETUP.md.';
COMMENT ON COLUMN public.daily_check_runs.per_url_json IS
  'Full aggregate.json blob — includes per-URL summary, failure list, latencies. Internal only — never surface to user (BIQc Platform Contract v2).';
COMMENT ON COLUMN public.daily_check_runs.overall_status IS
  'PASS = all 5 URLs PASS. DEGRADED = no FAIL but at least one DEGRADED. FAIL = at least one URL FAIL.';
