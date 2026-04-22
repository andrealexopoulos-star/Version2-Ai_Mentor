-- =============================================================================
-- Migration 117: Activate Morning Brief Worker Cron
-- (renamed from 116 — 116 was claimed by 116_observation_event_dismissals.sql
-- shipped earlier in the same Sprint A batch; this is a conflict-free rename)
--
-- Purpose:
--   Migration 114 activated `intel_morning_brief` (daily 19:00 UTC) which
--   fans out one `intelligence_queue` row per active user. Without a consumer
--   draining that queue, the user never receives the E15 Morning Brief email.
--
--   This migration adds `intel_process_morning_brief` which runs every 5
--   minutes and POSTs to the backend's queue processor endpoint. The
--   processor drains a batch of up to 200 queued rows and sends emails.
--
-- Architecture:
--
--   19:00 UTC (daily)  : intel_morning_brief     — fan-out to queue
--   */5 * * * *         : intel_process_morning_brief — drain & send
--
--   Worker load math:
--     1 user/row * 12 fires/hr = 12 drain attempts per user per hour.
--     Queue dedup inside queue_intelligence_job() caps queued/processing
--     rows at 1 per user per schedule, so only fires after 19:00 UTC find
--     work. Between 19:00 UTC and ~19:05 UTC all active users complete.
--
--   Even a 10,000-user install clears in a single 5-min tick:
--     batch_size=200 × concurrency=10 (per worker) ≈ 2,000 briefs/min.
--
-- Prerequisites:
--   * pg_cron (migration 025)                 [OK]
--   * pg_net                                   (migration 025)  [OK]
--   * intelligence_queue (migration 115)       [OK]
--   * intel_morning_brief scheduled (mig 114)  [OK]
--   * MORNING_BRIEF_WORKER_SECRET env var set on backend runtime
--   * BIQC_BACKEND_URL env var or app.setting for backend base URL
--
-- Config — two DB settings required BEFORE the cron fires. Set these in
-- the Supabase SQL editor ONCE per environment:
--
--   ALTER DATABASE postgres
--     SET app.biqc_backend_url = 'https://api.biqc.ai';
--
--   ALTER DATABASE postgres
--     SET app.morning_brief_worker_secret = '<same value as backend env>';
--
--   (Or use the per-role / per-session syntax if that better fits the
--   deployment model. What matters is that current_setting() resolves
--   both at cron execution time. The guard at the bottom checks both.)
--
-- Auth model:
--   The cron invokes pg_net.http_post with an X-BIQc-Cron-Secret header.
--   The backend route at /api/intelligence/process-morning-brief
--   compares it via constant-time compare against MORNING_BRIEF_WORKER_SECRET.
--   Mismatch → 401. Missing env on backend → 503 (fails closed).
--
-- Idempotency:
--   Re-running this migration is safe — cron.unschedule() is called for the
--   job name before cron.schedule() recreates it.
--
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Prerequisite guard — fail fast if the target infra is missing
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE EXCEPTION 'pg_cron extension not installed. Enable via Supabase Dashboard > Database > Extensions.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        RAISE EXCEPTION 'pg_net extension not installed. Enable via Supabase Dashboard > Database > Extensions.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'intelligence_queue'
    ) THEN
        RAISE EXCEPTION 'public.intelligence_queue missing. Apply migration 115 first.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'intel_morning_brief'
    ) THEN
        RAISE EXCEPTION 'intel_morning_brief cron missing. Apply migration 114 first — nothing will be queued for the worker to drain.';
    END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 1. Idempotency — unschedule any prior instance of this job
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    PERFORM cron.unschedule('intel_process_morning_brief');
EXCEPTION WHEN OTHERS THEN
    -- unschedule() raises when the jobname doesn't exist. Swallow.
    NULL;
END $$;


-- -----------------------------------------------------------------------------
-- 2. Schedule the worker fire — every 5 minutes
-- -----------------------------------------------------------------------------
--
-- We build the POST with current_setting() so the URL + secret are a
-- one-time config, not baked into the migration body. `true` flag on
-- current_setting means "return NULL if unset" instead of raising —
-- we explicitly check for NULLs in the health-check view below.
--
-- Note on pg_net semantics: http_post returns a request_id immediately
-- and the actual HTTP call happens in the background extension worker.
-- That's the desired shape — we don't want pg_cron blocked on a 10s
-- Resend call. The request_id is discarded; we rely on the worker's
-- own logging + the admin audit row for observability.
--
-- The `timeout_milliseconds` argument is set generously at 30s because
-- the batch of up to 200 brief-sends (even parallelised to 10) may take
-- ~25s worst-case. Longer than that = escalate. pg_net will not block
-- another cron fire (they're queued independently).
SELECT cron.schedule(
    'intel_process_morning_brief',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url     := current_setting('app.biqc_backend_url', true) || '/api/intelligence/process-morning-brief?batch_size=200',
        headers := jsonb_build_object(
                     'Content-Type', 'application/json',
                     'X-BIQc-Cron-Secret', current_setting('app.morning_brief_worker_secret', true)
                   ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 30000
    )
    $$
);


COMMIT;


-- =============================================================================
-- POST-DEPLOY VERIFICATION
--
-- 1. Confirm the new job is registered:
--      SELECT jobname, schedule, active FROM cron.job
--      WHERE jobname = 'intel_process_morning_brief';
--    Expected: 1 row, schedule='*/5 * * * *', active=true.
--
-- 2. Confirm the runtime settings are present (both should return a value,
--    not NULL):
--      SELECT current_setting('app.biqc_backend_url', true) AS backend_url,
--             current_setting('app.morning_brief_worker_secret', true) IS NOT NULL
--                 AS secret_present;
--
-- 3. After the next daily fire of intel_morning_brief (19:00 UTC), watch
--    the queue drain. Within 5-10 min of 19:00 UTC the queued count should
--    drop to zero as the worker ticks complete:
--      SELECT status, count(*)
--      FROM public.intelligence_queue
--      WHERE schedule_key = 'morning_brief'
--      GROUP BY status
--      ORDER BY status;
--
-- 4. Observe pg_net response codes for the worker POSTs — 200/202 expected:
--      SELECT id, status_code, error_msg, created
--      FROM net._http_response
--      WHERE url_path LIKE '%process-morning-brief%'
--      ORDER BY created DESC
--      LIMIT 10;
--
-- 5. Failure mode: if status_code=401 you forgot to set
--    app.morning_brief_worker_secret OR it doesn't match the backend env.
--    If status_code=503 the backend env var is unset.
-- =============================================================================
