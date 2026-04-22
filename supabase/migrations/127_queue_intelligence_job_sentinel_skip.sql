-- Migration 127: Queue-intelligence-job sentinel-skip + auth.users referential guard.
--
-- BACKFILLS a hotfix applied directly via MCP on 2026-04-22 20:10 UTC after a
-- 13.5-hour silent failure of all 22 intel_* pg_cron schedules. Root cause:
-- migration 126_biqc_internal_sentinel_user.sql inserted the sentinel UUID
-- '00000000-0000-0000-0000-000000000001' into public.users only. The trigger
-- trg_sync_business_profile_tier_from_users fired and auto-created a matching
-- public.business_profiles row. queue_intelligence_job() then iterated
-- business_profiles, tried to insert the sentinel into public.intelligence_queue,
-- but intelligence_queue_user_id_fkey references auth.users(id) — where the
-- sentinel does NOT exist — so every cron fire rolled back with a FK violation.
--
-- This file documents the prod state so `supabase db push` reproduces it + so
-- any schema regenerator / fresh branch / rebuild lands in the correct shape.
-- Idempotent — safe to re-run.
--
-- Lesson captured (feedback_compensate_for_ai_limits.md Protocol 2 extension):
-- any migration that inserts into public.users MUST be smoke-tested against
-- queue_intelligence_job() within 5 minutes of apply.

BEGIN;

-- Step 1: Remove orphan sentinel business_profile (idempotent — DELETE 0 is fine).
DELETE FROM public.business_profiles
WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Step 2: Rewrite queue_intelligence_job() to explicitly skip sentinel + require
-- referential integrity with auth.users before enqueueing.
CREATE OR REPLACE FUNCTION public.queue_intelligence_job(p_schedule_key text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_count integer := 0;
BEGIN
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
      AND bp.user_id != '00000000-0000-0000-0000-000000000001'::uuid
      AND EXISTS (
          SELECT 1 FROM auth.users au WHERE au.id = bp.user_id
      )
      AND NOT EXISTS (
          SELECT 1
          FROM public.intelligence_queue iq
          WHERE iq.user_id      = bp.user_id
            AND iq.schedule_key = p_schedule_key
            AND iq.status       IN ('queued', 'processing')
      );

    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE public.intelligence_schedules
    SET last_run_at = now(),
        last_status = 'running',
        updated_at  = now()
    WHERE schedule_key = p_schedule_key;

    RETURN v_count;
END;
$function$;

COMMIT;

-- =============================================================================
-- POST-DEPLOY VERIFICATION (run via MCP execute_sql after apply)
-- =============================================================================
-- 1. Sentinel row gone:
--      SELECT COUNT(*) FROM public.business_profiles
--       WHERE user_id='00000000-0000-0000-0000-000000000001'::uuid;
--    Expected: 0
--
-- 2. Function body contains the skip + guard:
--      SELECT pg_get_functiondef(oid) LIKE '%000000000001%'
--             AND pg_get_functiondef(oid) LIKE '%FROM auth.users au%' AS patched
--        FROM pg_proc
--       WHERE proname='queue_intelligence_job'
--         AND pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='public');
--    Expected: true
--
-- 3. Synchronous function test:
--      SELECT public.queue_intelligence_job('__verify_mig_127__');
--    Expected: integer >= 0, no FK error raised.
--
-- 4. Cleanup the verification rows:
--      DELETE FROM public.intelligence_queue WHERE schedule_key='__verify_mig_127__';
--
-- 5. Wait 10 min; confirm the next real intel_* cron fire succeeded:
--      SELECT jobname, status, start_time
--        FROM cron.job_run_details jrd
--        JOIN cron.job j USING(jobid)
--       WHERE j.jobname='intel_metrics_compute'
--         AND start_time > NOW() - INTERVAL '15 minutes'
--       ORDER BY start_time DESC LIMIT 1;
--    Expected: status='succeeded'.
-- =============================================================================
