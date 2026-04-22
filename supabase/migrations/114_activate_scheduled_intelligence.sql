-- =============================================================================
-- Migration 114: Activate Scheduled Intelligence Cron Jobs
--
-- Purpose:
--   Activate the 21 pg_cron schedules that are currently COMMENTED OUT at the
--   bottom of migration 086 (lines 362-403). Each schedule fans out a single
--   named schedule_key to every active user via public.queue_intelligence_job().
--
-- =============================================================================
-- PRE-FLIGHT VERIFICATION RESULTS (2026-04-22, prod vwwandhoydemcybltoxz):
--
--   pg_cron extension:             INSTALLED (v1.6.4, schema pg_catalog)   [OK]
--   pg_net extension:              INSTALLED (v0.20.0, schema public)      [OK]
--   public.intelligence_schedules: DOES NOT EXIST IN PROD                  [BLOCKER]
--   public.intelligence_queue:     DOES NOT EXIST IN PROD                  [BLOCKER]
--   public.queue_intelligence_job: DOES NOT EXIST IN PROD                  [BLOCKER]
--
-- Root cause: Migration 086_scheduled_intelligence.sql was never applied to
-- production. The list_migrations RPC shows a gap between migration 080
-- (20260419065428) and 106 (20260419081038) — 081..105 were skipped on the
-- remote. Migration 086 is one of the skipped files.
--
-- Currently active cron.jobs in prod (unrelated — do NOT touch):
--   biqc-contradiction-check    0 */12 * * *   (seeded by 025_enable_pg_cron.sql)
--   biqc-daily-summary          0 2    * * *   (seeded by 025_enable_pg_cron.sql)
--   biqc-evidence-freshness     0 */6  * * *   (seeded by 025_enable_pg_cron.sql)
--   biqc-silence-detection      0 8    * * *   (seeded by 025_enable_pg_cron.sql)
--   edge-function-warmup        */4    * * *
--   email-priority-refresh      */10   * * *
--   merge-health-check          0 */4  * * *
--   refresh-outlook-tokens      */30   * * *
--   stripe-reconcile-nightly    0 2    * * *
-- =============================================================================
-- DEPLOYMENT GATING:
--
-- This migration MUST NOT ship until migration 086 (or an equivalent creating
-- intelligence_schedules, intelligence_queue, and public.queue_intelligence_job)
-- has been applied to prod. The DO-block guard at the top of this file will
-- raise an exception and abort the transaction if those prerequisites are
-- missing, preventing a broken cron registration.
-- =============================================================================
-- SCHEDULES BEING ACTIVATED (21 total, sourced verbatim from 086 lines 362-403):
--
--   Every 10 min : intel_metrics_compute      (*/10 * * * *)
--   Every 15 min : intel_merge_emission       (*/15 * * * *)
--   Every 4 hr   : intel_cognitive_refresh    (0 */4 * * *)
--   Every 6 hr   : intel_watchtower_scan      (0 */6 * * *)
--   Daily UTC    : intel_external_intelligence (0 14 * * *)
--                  intel_market_scan            (0 15 * * *)
--                  intel_evidence_freshness     (0 16 * * *)
--                  intel_silence_detection      (0 17 * * *)
--                  intel_contradiction_scan     (0 18 * * *)
--                  intel_morning_brief          (0 19 * * *)  -- 05:00 AEST
--                  intel_calendar_intelligence  (0 19 * * *)
--                  intel_email_intelligence     (0 20 * * *)
--                  intel_proactive_scan         (0 20 * * *)
--                  intel_pressure_calibration   (0 21 * * *)
--                  intel_predictive_models      (0 21 * * *)
--                  intel_customer_health        (0 22 * * *)
--   Weekly       : intel_competitor_monitor    (0 20 * * 1)
--                  intel_cash_projection        (0 21 * * 1)
--                  intel_weekly_synthesis       (0 6  * * 5)
--                  intel_weekly_narrative       (0 8  * * 5)
--   Monthly      : intel_monthly_narrative     (0 8 1 * *)
--   Housekeeping : intel_queue_cleanup         (0 3 * * *)   -- inlined DELETE
-- =============================================================================
-- TIMEZONE NOTES (pg_cron runs in UTC):
--
--   "Morning brief" comment in 086 claims 05:00 AEST = 19:00 UTC. This is
--   correct for AEST (UTC+10, non-DST). It will run at 06:00 AEDT during
--   daylight saving (Oct-Apr in AU). Business has accepted this drift in 086;
--   preserved here unchanged. If a stricter local-time guarantee is needed,
--   refactor to use cron.schedule_in_database + timezone('Australia/Sydney')
--   in a follow-up migration.
-- =============================================================================
-- RISK NOTES:
--
--   1. intel_metrics_compute runs every 10 minutes (*/10). This fans out to
--      every active user and enqueues one intelligence_queue row per user per
--      tick. With N users we get N rows / 10 min = 6N rows/hr. The dedup guard
--      inside queue_intelligence_job() (NOT EXISTS on queued/processing) keeps
--      this bounded — a tick is a no-op if the worker hasn't drained the last
--      one. Idempotent by design.  RISK = LOW.
--
--   2. intel_merge_emission runs every 15 minutes (*/15). Same dedup guard
--      applies. LOW.
--
--   3. Multiple daily schedules share the same hour (19:00 has
--      morning_brief+calendar_intelligence; 20:00 has email+proactive_scan;
--      21:00 has pressure_calibration+predictive_models). All run as separate
--      enqueue ops, not heavy work. LOW.
--
--   4. intel_queue_cleanup uses an inlined DELETE (no function wrapper) — this
--      is preserved verbatim from 086. Safe; bounded by the 7-day WHERE.
--
--   5. Worker side: this migration ONLY enqueues. It does NOT run the actual
--      intelligence work. A separate consumer (edge function or backend
--      worker) must poll intelligence_queue and execute. Verify that consumer
--      is live before expecting insight output.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Prerequisite guard — fail fast if 086 has not been applied
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'intelligence_schedules'
    ) THEN
        RAISE EXCEPTION 'Migration 086 prerequisites missing: table public.intelligence_schedules not found. Apply migration 086_scheduled_intelligence.sql before running 114.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'intelligence_queue'
    ) THEN
        RAISE EXCEPTION 'Migration 086 prerequisites missing: table public.intelligence_queue not found. Apply migration 086_scheduled_intelligence.sql before running 114.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'queue_intelligence_job'
    ) THEN
        RAISE EXCEPTION 'Migration 086 prerequisites missing: function public.queue_intelligence_job(text) not found. Apply migration 086_scheduled_intelligence.sql before running 114.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        RAISE EXCEPTION 'pg_cron extension is not installed. Enable via Supabase Dashboard > Database > Extensions before running 114.';
    END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 1. Idempotency — unschedule any pre-existing intel_* jobs with these names
--    so re-running the migration is safe. Uses pg_cron's unschedule(name).
--    The four legacy biqc-* jobs from migration 025 are intentionally
--    untouched — they use different function entry points (compute_evidence_
--    freshness et al.) and are NOT the same as the new intel_* fan-out model.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    j record;
BEGIN
    FOR j IN
        SELECT jobname FROM cron.job
        WHERE jobname IN (
            'intel_metrics_compute',
            'intel_merge_emission',
            'intel_cognitive_refresh',
            'intel_watchtower_scan',
            'intel_external_intelligence',
            'intel_market_scan',
            'intel_evidence_freshness',
            'intel_silence_detection',
            'intel_contradiction_scan',
            'intel_morning_brief',
            'intel_calendar_intelligence',
            'intel_email_intelligence',
            'intel_proactive_scan',
            'intel_pressure_calibration',
            'intel_predictive_models',
            'intel_customer_health',
            'intel_competitor_monitor',
            'intel_cash_projection',
            'intel_weekly_synthesis',
            'intel_weekly_narrative',
            'intel_monthly_narrative',
            'intel_queue_cleanup'
        )
    LOOP
        PERFORM cron.unschedule(j.jobname);
    END LOOP;
END $$;


-- -----------------------------------------------------------------------------
-- 2. Register schedules
-- -----------------------------------------------------------------------------

-- ── High-frequency operational (dedup guarded inside queue_intelligence_job) ─
-- Recompute core business metrics from latest ingested data.
SELECT cron.schedule('intel_metrics_compute',      '*/10 * * * *', $$ SELECT public.queue_intelligence_job('metrics_compute') $$);

-- Ingest latest Merge.dev webhook payloads into business brain.
SELECT cron.schedule('intel_merge_emission',       '*/15 * * * *', $$ SELECT public.queue_intelligence_job('merge_emission') $$);

-- ── Every 4-6 hours ──────────────────────────────────────────────────────────
-- Refresh cognitive model with latest evidence and signals.
SELECT cron.schedule('intel_cognitive_refresh',    '0 */4 * * *',  $$ SELECT public.queue_intelligence_job('cognitive_refresh') $$);

-- Full watchtower scan — anomaly detection across all data sources.
SELECT cron.schedule('intel_watchtower_scan',      '0 */6 * * *',  $$ SELECT public.queue_intelligence_job('watchtower_scan') $$);

-- ── Daily schedules (times in UTC) ───────────────────────────────────────────
-- External market signals, news, regulatory updates. 14:00 UTC = 00:00 AEST next day.
SELECT cron.schedule('intel_external_intelligence', '0 14 * * *', $$ SELECT public.queue_intelligence_job('external_intelligence') $$);

-- AI market and industry trend analysis. 15:00 UTC = 01:00 AEST next day.
SELECT cron.schedule('intel_market_scan',           '0 15 * * *', $$ SELECT public.queue_intelligence_job('market_scan') $$);

-- Stale-evidence detector. 16:00 UTC = 02:00 AEST next day.
SELECT cron.schedule('intel_evidence_freshness',    '0 16 * * *', $$ SELECT public.queue_intelligence_job('evidence_freshness') $$);

-- Silent-failure detector. 17:00 UTC = 03:00 AEST next day.
SELECT cron.schedule('intel_silence_detection',     '0 17 * * *', $$ SELECT public.queue_intelligence_job('silence_detection') $$);

-- Cross-source contradiction scan. 18:00 UTC = 04:00 AEST next day.
SELECT cron.schedule('intel_contradiction_scan',    '0 18 * * *', $$ SELECT public.queue_intelligence_job('contradiction_scan') $$);

-- Morning advisory brief. 19:00 UTC = 05:00 AEST. (AEDT +1h during DST.)
SELECT cron.schedule('intel_morning_brief',         '0 19 * * *', $$ SELECT public.queue_intelligence_job('morning_brief') $$);

-- Calendar intelligence. 19:00 UTC = 05:00 AEST.
SELECT cron.schedule('intel_calendar_intelligence', '0 19 * * *', $$ SELECT public.queue_intelligence_job('calendar_intelligence') $$);

-- Email priority scoring. 20:00 UTC = 06:00 AEST.
SELECT cron.schedule('intel_email_intelligence',    '0 20 * * *', $$ SELECT public.queue_intelligence_job('email_intelligence') $$);

-- Proactive opportunity/risk scan. 20:00 UTC = 06:00 AEST.
SELECT cron.schedule('intel_proactive_scan',        '0 20 * * *', $$ SELECT public.queue_intelligence_job('proactive_scan') $$);

-- Recalibrate business pressure index. 21:00 UTC = 07:00 AEST.
SELECT cron.schedule('intel_pressure_calibration',  '0 21 * * *', $$ SELECT public.queue_intelligence_job('pressure_calibration') $$);

-- Predictive models (churn, revenue, runway). 21:00 UTC = 07:00 AEST.
SELECT cron.schedule('intel_predictive_models',     '0 21 * * *', $$ SELECT public.queue_intelligence_job('predictive_models') $$);

-- Customer concentration / health. 22:00 UTC = 08:00 AEST.
SELECT cron.schedule('intel_customer_health',       '0 22 * * *', $$ SELECT public.queue_intelligence_job('customer_health') $$);

-- ── Weekly schedules (day-of-week in UTC: 1=Mon, 5=Fri) ──────────────────────
-- Competitor intelligence. Monday 20:00 UTC = Tuesday 06:00 AEST.
SELECT cron.schedule('intel_competitor_monitor',   '0 20 * * 1', $$ SELECT public.queue_intelligence_job('competitor_monitor') $$);

-- CFO cash projection. Monday 21:00 UTC = Tuesday 07:00 AEST.
SELECT cron.schedule('intel_cash_projection',      '0 21 * * 1', $$ SELECT public.queue_intelligence_job('cash_projection') $$);

-- Weekly intelligence snapshot. Friday 06:00 UTC = Friday 16:00 AEST.
SELECT cron.schedule('intel_weekly_synthesis',     '0 6 * * 5',  $$ SELECT public.queue_intelligence_job('weekly_synthesis') $$);

-- Weekly strategic narrative. Friday 08:00 UTC = Friday 18:00 AEST.
SELECT cron.schedule('intel_weekly_narrative',     '0 8 * * 5',  $$ SELECT public.queue_intelligence_job('weekly_narrative') $$);

-- ── Monthly ──────────────────────────────────────────────────────────────────
-- Monthly exec summary + trend analysis. 1st of month, 08:00 UTC = 18:00 AEST.
SELECT cron.schedule('intel_monthly_narrative',    '0 8 1 * *',  $$ SELECT public.queue_intelligence_job('monthly_narrative') $$);

-- ── Queue cleanup (housekeeping) ─────────────────────────────────────────────
-- Purge completed/failed queue items older than 7 days. 03:00 UTC = 13:00 AEST.
SELECT cron.schedule('intel_queue_cleanup', '0 3 * * *', $$
    DELETE FROM public.intelligence_queue
    WHERE status IN ('completed', 'failed')
      AND completed_at < now() - interval '7 days'
$$);

COMMIT;


-- =============================================================================
-- POST-DEPLOY VERIFICATION
--
-- 1. Count intel_* schedules — expect exactly 22 rows (21 enqueue + 1 cleanup):
--      SELECT count(*) FROM cron.job WHERE jobname LIKE 'intel_%';
--
-- 2. Full listing ordered by jobname:
--      SELECT jobname, schedule, command
--      FROM cron.job
--      WHERE jobname LIKE 'intel_%'
--      ORDER BY jobname;
--
--    Expected jobnames (alphabetical):
--      intel_calendar_intelligence
--      intel_cash_projection
--      intel_cognitive_refresh
--      intel_competitor_monitor
--      intel_contradiction_scan
--      intel_customer_health
--      intel_email_intelligence
--      intel_evidence_freshness
--      intel_external_intelligence
--      intel_market_scan
--      intel_merge_emission
--      intel_metrics_compute
--      intel_monthly_narrative
--      intel_morning_brief
--      intel_predictive_models
--      intel_pressure_calibration
--      intel_proactive_scan
--      intel_queue_cleanup
--      intel_silence_detection
--      intel_watchtower_scan
--      intel_weekly_narrative
--      intel_weekly_synthesis
--
-- 3. Confirm the four legacy biqc-* jobs were NOT touched:
--      SELECT jobname FROM cron.job WHERE jobname LIKE 'biqc-%' ORDER BY jobname;
--    Expected: biqc-contradiction-check, biqc-daily-summary,
--              biqc-evidence-freshness, biqc-silence-detection
--
-- 4. After first tick of intel_metrics_compute (≤10 min), verify fan-out worked:
--      SELECT schedule_key, count(*) AS queued
--      FROM public.intelligence_queue
--      WHERE status = 'queued'
--      GROUP BY schedule_key
--      ORDER BY schedule_key;
--    Expected: one row per user per active schedule_key.
--
-- 5. Confirm schedule registry timestamps are updating:
--      SELECT schedule_key, last_run_at, last_status
--      FROM public.intelligence_schedules
--      ORDER BY last_run_at DESC NULLS LAST;
-- =============================================================================
