-- =============================================================================
-- Migration 115: Surgical Rebuild of Intelligence Infrastructure
--
-- Creates the 3 core objects that migration 086_scheduled_intelligence.sql
-- was supposed to install but which never landed in prod (the remote
-- migration log skips versions 081..105, jumping from 080 directly to 106).
--
-- Objects this migration creates:
--   1. public.intelligence_schedules             (table + indexes + RLS + seed)
--   2. public.intelligence_queue                 (table + indexes + RLS)
--   3. public.queue_intelligence_job(text)       (SECURITY DEFINER function)
--
-- Supporting objects REQUIRED by the above (also missing from prod, verified
-- via pg_proc on 2026-04-22):
--   - public.set_updated_at()                    (trigger function used by
--                                                 trg_intelligence_schedules_updated_at)
--   - public.increment_schedule_error(text)      (companion helper — kept
--                                                 because 086 defined it as
--                                                 part of the same infra
--                                                 contract; callers expect it)
--
-- Pre-flight verification (prod vwwandhoydemcybltoxz, 2026-04-22):
--   * intelligence_schedules   : DOES NOT EXIST         -> create
--   * intelligence_queue       : DOES NOT EXIST         -> create
--   * queue_intelligence_job   : DOES NOT EXIST         -> create
--   * set_updated_at           : DOES NOT EXIST         -> create
--   * increment_schedule_error : DOES NOT EXIST         -> create
--   * auth.users               : EXISTS (FK target OK)
--   * public.business_profiles : EXISTS with user_id uuid + subscription_tier text
--   * orphan views referencing any of the above : NONE
--
-- Prereqs: none (this IS the prereq for migration 114).
-- Idempotent: every CREATE uses IF NOT EXISTS; policies use DROP IF EXISTS
-- before CREATE; functions use CREATE OR REPLACE; trigger creation is
-- wrapped in a duplicate_object catch.
--
-- Deviations from 086:
--   * pg_cron schedule registration (lines 362-403 of 086) is NOT included
--     here. That work belongs to migration 114, which is blocked on this
--     one landing. Keeping them split preserves the single-responsibility
--     boundary 114 was authored against.
--   * The 21-row seed in intelligence_schedules IS included verbatim —
--     114's fan-out queries do not require it to run, but it populates the
--     registry so the dashboard health view is non-empty the moment the
--     table exists.
-- =============================================================================

BEGIN;


-- =============================================================================
-- 1. intelligence_schedules - Job registry
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.intelligence_schedules (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_key        text NOT NULL UNIQUE,
    description         text,
    cron_expression     text NOT NULL,
    edge_function_name  text,              -- NULL when backend_endpoint is used
    backend_endpoint    text,              -- NULL when edge_function_name is used
    is_enabled          boolean NOT NULL DEFAULT true,
    last_run_at         timestamptz,
    last_status         text NOT NULL DEFAULT 'pending',
    last_duration_ms    integer,
    error_count         integer NOT NULL DEFAULT 0,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.intelligence_schedules IS
    'Registry of all recurring intelligence jobs — what runs, when, and current health.';

COMMENT ON COLUMN public.intelligence_schedules.schedule_key IS
    'Stable identifier used by pg_cron and queue_intelligence_job() to reference this schedule.';

COMMENT ON COLUMN public.intelligence_schedules.cron_expression IS
    'Standard 5-field cron expression (minute hour day month weekday).';


-- =============================================================================
-- 2. intelligence_queue - Per-user job queue
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.intelligence_queue (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    schedule_key    text NOT NULL,
    status          text NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    priority        integer NOT NULL DEFAULT 5,
    payload         jsonb,
    queued_at       timestamptz NOT NULL DEFAULT now(),
    started_at      timestamptz,
    completed_at    timestamptz,
    error_detail    text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.intelligence_queue IS
    'Per-user job queue. Populated by queue_intelligence_job(); consumed by edge functions / backend workers.';

-- Composite index: workers poll by status + oldest first
CREATE INDEX IF NOT EXISTS idx_intelligence_queue_status_queued
    ON public.intelligence_queue (status, queued_at);

-- Composite index: dedup check per user+schedule
CREATE INDEX IF NOT EXISTS idx_intelligence_queue_user_schedule
    ON public.intelligence_queue (user_id, schedule_key);


-- =============================================================================
-- 3. RLS Policies
-- =============================================================================

-- ── intelligence_schedules ──────────────────────────────────────────────────
ALTER TABLE public.intelligence_schedules ENABLE ROW LEVEL SECURITY;

-- Service role: full CRUD (backend / edge functions use service_role key)
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_full_intelligence_schedules" ON public.intelligence_schedules;
    CREATE POLICY "service_role_full_intelligence_schedules"
        ON public.intelligence_schedules FOR ALL
        USING (auth.jwt() ->> 'role' = 'service_role');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Authenticated users: read-only (dashboard may show schedule health)
DO $$ BEGIN
    DROP POLICY IF EXISTS "authenticated_select_intelligence_schedules" ON public.intelligence_schedules;
    CREATE POLICY "authenticated_select_intelligence_schedules"
        ON public.intelligence_schedules FOR SELECT TO authenticated
        USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ── intelligence_queue ──────────────────────────────────────────────────────
ALTER TABLE public.intelligence_queue ENABLE ROW LEVEL SECURITY;

-- Service role: full CRUD
DO $$ BEGIN
    DROP POLICY IF EXISTS "service_role_full_intelligence_queue" ON public.intelligence_queue;
    CREATE POLICY "service_role_full_intelligence_queue"
        ON public.intelligence_queue FOR ALL
        USING (auth.jwt() ->> 'role' = 'service_role');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Authenticated users: see own queue items only
DO $$ BEGIN
    DROP POLICY IF EXISTS "users_select_own_intelligence_queue" ON public.intelligence_queue;
    CREATE POLICY "users_select_own_intelligence_queue"
        ON public.intelligence_queue FOR SELECT TO authenticated
        USING (auth.uid() = user_id);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- =============================================================================
-- 4. Seed Data - Intelligence Schedules (verbatim from 086)
-- =============================================================================
INSERT INTO public.intelligence_schedules (schedule_key, description, cron_expression, edge_function_name, backend_endpoint)
VALUES
    -- ── High-frequency operational ──────────────────────────────────────────
    ('metrics_compute',
     'Recompute core business metrics from latest ingested data',
     '*/10 * * * *',
     'business-brain-metrics-cron', NULL),

    ('merge_emission',
     'Ingest latest Merge.dev webhook payloads into business brain',
     '*/15 * * * *',
     'business-brain-merge-ingest', NULL),

    -- ── Every 4-6 hours ─────────────────────────────────────────────────────
    ('cognitive_refresh',
     'Refresh cognitive model with latest evidence and signals',
     '0 */4 * * *',
     'biqc-insights-cognitive', NULL),

    ('watchtower_scan',
     'Full watchtower scan — anomaly detection across all data sources',
     '0 */6 * * *',
     'watchtower-brain', NULL),

    -- ── Daily schedules (UTC times) ─────────────────────────────────────────
    ('external_intelligence',
     'Ingest external market signals, news, and regulatory updates',
     '0 14 * * *',
     'external-intelligence', NULL),

    ('market_scan',
     'AI-driven market and industry trend analysis',
     '0 15 * * *',
     'market-analysis-ai', NULL),

    ('evidence_freshness',
     'Flag stale evidence and data sources that need refresh',
     '0 16 * * *',
     NULL, '/api/intelligence/freshness'),

    ('silence_detection',
     'Detect silent failures — integrations or data feeds that stopped reporting',
     '0 17 * * *',
     NULL, '/api/intelligence/silence'),

    ('contradiction_scan',
     'Identify contradictory signals across intelligence sources',
     '0 18 * * *',
     NULL, '/api/intelligence/contradictions'),

    ('morning_brief',
     'Generate personalised morning advisory briefing (05:00 AEST = 19:00 UTC)',
     '0 19 * * *',
     NULL, '/api/unified/advisor'),

    ('calendar_intelligence',
     'Analyse upcoming calendar events for meeting prep and context enrichment',
     '0 19 * * *',
     'calendar-intelligence', NULL),

    ('email_intelligence',
     'AI priority scoring and categorisation of inbox',
     '0 20 * * *',
     'email_priority', NULL),

    ('proactive_scan',
     'Proactive opportunity and risk scan across all intelligence layers',
     '0 20 * * *',
     'proactive-intelligence', NULL),

    ('pressure_calibration',
     'Recalibrate business pressure index based on latest signals',
     '0 21 * * *',
     NULL, '/api/intelligence/pressure'),

    ('predictive_models',
     'Run predictive models — churn risk, revenue trajectory, cash runway',
     '0 21 * * *',
     'predictive-models', NULL),

    ('customer_health',
     'Customer concentration and health scoring',
     '0 22 * * *',
     NULL, '/api/intelligence/concentration'),

    -- ── Weekly schedules ────────────────────────────────────────────────────
    ('competitor_monitor',
     'Competitive intelligence — track competitor moves and positioning',
     '0 20 * * 1',
     'competitor-monitor', NULL),

    ('cash_projection',
     'CFO-grade cash flow projection and scenario analysis',
     '0 21 * * 1',
     'cfo-cash-analysis', NULL),

    ('weekly_synthesis',
     'Generate weekly intelligence snapshot and narrative',
     '0 6 * * 5',
     NULL, '/api/snapshot/generate'),

    ('weekly_narrative',
     'Produce weekly strategic narrative from accumulated intelligence',
     '0 8 * * 5',
     'weekly-narrative', NULL),

    -- ── Monthly schedules ───────────────────────────────────────────────────
    ('monthly_narrative',
     'Monthly executive summary and trend analysis',
     '0 8 1 * *',
     'monthly-narrative', NULL)

ON CONFLICT (schedule_key) DO NOTHING;


-- =============================================================================
-- 5. queue_intelligence_job() - Fan-out a schedule to all active users
-- =============================================================================
CREATE OR REPLACE FUNCTION public.queue_intelligence_job(p_schedule_key text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer := 0;
BEGIN
    -- Insert a queue item for every active user in business_profiles,
    -- skipping users who already have a queued or processing item for this key.
    -- Priority is based on subscription_tier:
    --   pro / enterprise / super_admin  => 1 (highest)
    --   starter / growth               => 3
    --   free / anything else            => 5 (lowest)
    INSERT INTO public.intelligence_queue (user_id, schedule_key, priority, payload)
    SELECT
        bp.user_id,
        p_schedule_key,
        CASE
            WHEN lower(coalesce(bp.subscription_tier, 'free')) IN ('pro', 'enterprise', 'super_admin') THEN 1
            WHEN lower(coalesce(bp.subscription_tier, 'free')) IN ('starter', 'growth')                THEN 3
            ELSE 5
        END,
        jsonb_build_object(
            'schedule_key', p_schedule_key,
            'queued_by',    'queue_intelligence_job',
            'queued_at',    now()::text
        )
    FROM public.business_profiles bp
    WHERE bp.user_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM public.intelligence_queue iq
          WHERE iq.user_id      = bp.user_id
            AND iq.schedule_key = p_schedule_key
            AND iq.status       IN ('queued', 'processing')
      );

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Record this run on the schedule registry
    UPDATE public.intelligence_schedules
    SET last_run_at = now(),
        last_status = 'running',
        updated_at  = now()
    WHERE schedule_key = p_schedule_key;

    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.queue_intelligence_job(text) IS
    'Fan-out: inserts one intelligence_queue row per active user for the given schedule_key. '
    'Skips users with an existing queued/processing item. Returns count of newly queued users.';


-- =============================================================================
-- 6. increment_schedule_error() - Bump error_count for a schedule
-- =============================================================================
CREATE OR REPLACE FUNCTION public.increment_schedule_error(p_schedule_key text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.intelligence_schedules
    SET error_count = error_count + 1,
        last_status = 'error',
        updated_at  = now()
    WHERE schedule_key = p_schedule_key;
$$;

COMMENT ON FUNCTION public.increment_schedule_error(text) IS
    'Increments error_count and sets last_status to error for the given schedule_key.';


-- =============================================================================
-- 7. Updated-at trigger for intelligence_schedules
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$ BEGIN
    CREATE TRIGGER trg_intelligence_schedules_updated_at
        BEFORE UPDATE ON public.intelligence_schedules
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


COMMIT;


-- =============================================================================
-- POST-DEPLOY VERIFICATION — run these three against prod after the migration
-- applies. All three must succeed for 114 to be unblocked:
--
--   SELECT count(*) FROM public.intelligence_schedules;   -- expect 21
--   SELECT * FROM public.intelligence_queue LIMIT 1;      -- expect 0 rows, no error
--   SELECT public.queue_intelligence_job('metrics_compute'); -- returns integer (user count)
-- =============================================================================
