-- =============================================================================
-- Migration 086: Scheduled Intelligence Infrastructure
--
-- Creates the job scheduling and queue system for BIQc intelligence pipelines.
--
-- Tables:
--   intelligence_schedules  - Registry of recurring intelligence jobs
--   intelligence_queue      - Per-user job queue populated by schedule triggers
--
-- Functions:
--   queue_intelligence_job(schedule_key)  - Fan-out a schedule to all active users
--   increment_schedule_error(schedule_key) - Bump error_count on failure
--
-- RLS: service_role has full access; authenticated users see own queue items.
--
-- Seed data: 21 intelligence schedules covering watchtower, cognitive, email,
--   market, competitor, financial, synthesis, and operational intelligence.
--
-- NOTE: pg_cron schedule registration is NOT executed here. See commented-out
-- cron.schedule() calls at the bottom. Enable via Supabase Dashboard > Database
-- > Extensions > pg_cron, then run those statements manually or via CLI.
-- =============================================================================


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
-- 4. Seed Data - Intelligence Schedules
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


-- =============================================================================
-- 8. pg_cron schedule registration (COMMENTED OUT)
--
-- pg_cron must be enabled via Supabase Dashboard > Database > Extensions first.
-- After enabling, run these statements manually via SQL Editor or Supabase CLI.
--
-- IMPORTANT: Do NOT uncomment and run in this migration — pg_cron may not be
-- available on all Supabase plans and the cron schema may not exist yet.
-- =============================================================================

/*
-- Enable the extension (requires dashboard pre-approval on Pro+ plans):
-- CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- ── High-frequency ──────────────────────────────────────────────────────────
SELECT cron.schedule('intel_metrics_compute',     '*/10 * * * *', $$ SELECT public.queue_intelligence_job('metrics_compute') $$);
SELECT cron.schedule('intel_merge_emission',      '*/15 * * * *', $$ SELECT public.queue_intelligence_job('merge_emission') $$);

-- ── Every 4-6 hours ─────────────────────────────────────────────────────────
SELECT cron.schedule('intel_cognitive_refresh',   '0 */4 * * *',  $$ SELECT public.queue_intelligence_job('cognitive_refresh') $$);
SELECT cron.schedule('intel_watchtower_scan',     '0 */6 * * *',  $$ SELECT public.queue_intelligence_job('watchtower_scan') $$);

-- ── Daily ───────────────────────────────────────────────────────────────────
SELECT cron.schedule('intel_external_intelligence', '0 14 * * *', $$ SELECT public.queue_intelligence_job('external_intelligence') $$);
SELECT cron.schedule('intel_market_scan',           '0 15 * * *', $$ SELECT public.queue_intelligence_job('market_scan') $$);
SELECT cron.schedule('intel_evidence_freshness',    '0 16 * * *', $$ SELECT public.queue_intelligence_job('evidence_freshness') $$);
SELECT cron.schedule('intel_silence_detection',     '0 17 * * *', $$ SELECT public.queue_intelligence_job('silence_detection') $$);
SELECT cron.schedule('intel_contradiction_scan',    '0 18 * * *', $$ SELECT public.queue_intelligence_job('contradiction_scan') $$);
SELECT cron.schedule('intel_morning_brief',         '0 19 * * *', $$ SELECT public.queue_intelligence_job('morning_brief') $$);
SELECT cron.schedule('intel_calendar_intelligence', '0 19 * * *', $$ SELECT public.queue_intelligence_job('calendar_intelligence') $$);
SELECT cron.schedule('intel_email_intelligence',    '0 20 * * *', $$ SELECT public.queue_intelligence_job('email_intelligence') $$);
SELECT cron.schedule('intel_proactive_scan',        '0 20 * * *', $$ SELECT public.queue_intelligence_job('proactive_scan') $$);
SELECT cron.schedule('intel_pressure_calibration',  '0 21 * * *', $$ SELECT public.queue_intelligence_job('pressure_calibration') $$);
SELECT cron.schedule('intel_predictive_models',     '0 21 * * *', $$ SELECT public.queue_intelligence_job('predictive_models') $$);
SELECT cron.schedule('intel_customer_health',       '0 22 * * *', $$ SELECT public.queue_intelligence_job('customer_health') $$);

-- ── Weekly ──────────────────────────────────────────────────────────────────
SELECT cron.schedule('intel_competitor_monitor',  '0 20 * * 1', $$ SELECT public.queue_intelligence_job('competitor_monitor') $$);
SELECT cron.schedule('intel_cash_projection',     '0 21 * * 1', $$ SELECT public.queue_intelligence_job('cash_projection') $$);
SELECT cron.schedule('intel_weekly_synthesis',    '0 6 * * 5',  $$ SELECT public.queue_intelligence_job('weekly_synthesis') $$);
SELECT cron.schedule('intel_weekly_narrative',    '0 8 * * 5',  $$ SELECT public.queue_intelligence_job('weekly_narrative') $$);

-- ── Monthly ─────────────────────────────────────────────────────────────────
SELECT cron.schedule('intel_monthly_narrative',   '0 8 1 * *',  $$ SELECT public.queue_intelligence_job('monthly_narrative') $$);

-- ── Queue cleanup (purge completed/failed items older than 7 days) ──────────
SELECT cron.schedule('intel_queue_cleanup', '0 3 * * *', $$
    DELETE FROM public.intelligence_queue
    WHERE status IN ('completed', 'failed')
      AND completed_at < now() - interval '7 days'
$$);
*/


-- =============================================================================
-- 9. Queue Cleanup Note
--
-- Completed and failed queue items older than 7 days should be purged to prevent
-- unbounded table growth. Options:
--
--   a) pg_cron (see commented-out intel_queue_cleanup above)
--   b) Application-level: backend cron endpoint calls:
--        DELETE FROM intelligence_queue
--        WHERE status IN ('completed', 'failed')
--          AND completed_at < now() - interval '7 days';
--   c) Manual: run the above DELETE periodically via SQL Editor
--
-- Recommended: option (a) if pg_cron is available, otherwise option (b) in the
-- backend scheduler that already drives the intelligence pipeline.
-- =============================================================================
