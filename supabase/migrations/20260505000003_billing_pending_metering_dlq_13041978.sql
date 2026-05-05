-- 2026-05-05 (13041978) — pending_metering: dead-letter queue for failed usage_ledger inserts.
--
-- Purpose: when recordUsage_v2 (Deno) or _record_usage (Python) cannot write a
-- usage_ledger row after 3 retries, park the row here. An hourly drain worker
-- retries pending_metering rows. Alert super_admin if backlog > 100 (D1 2026-05-05).
--
-- See OPS Manual entry 01 section 7.3.

CREATE TABLE IF NOT EXISTS public.pending_metering (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  uuid NOT NULL,
    payload                  jsonb NOT NULL,                         -- exact row that failed to insert into usage_ledger
    failure_reason           text,                                   -- last error message from the failed write
    retry_count              integer NOT NULL DEFAULT 0,
    last_attempt_at          timestamptz,
    created_at               timestamptz NOT NULL DEFAULT now(),
    drained_at               timestamptz,                            -- nullable; set when drain worker successfully inserts to ledger
    dropped_at               timestamptz,                            -- nullable; set when row is given up on (e.g. > 24 attempts)
    notes                    text
);

COMMENT ON TABLE  public.pending_metering IS 'Dead-letter queue for failed usage_ledger inserts. Drained hourly by jobs/dlq_drain.py. Backlog > 100 alerts super_admin (D1 2026-05-05). Migration 20260505 / OPS Manual entry 01 section 7.3.';
COMMENT ON COLUMN public.pending_metering.payload IS 'Exact row payload that failed (kind/tokens/model/etc.) — used to retry the insert verbatim.';

CREATE INDEX IF NOT EXISTS idx_pending_metering_undrained
    ON public.pending_metering (created_at)
    WHERE drained_at IS NULL AND dropped_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pending_metering_user
    ON public.pending_metering (user_id, created_at DESC);

ALTER TABLE public.pending_metering ENABLE ROW LEVEL SECURITY;

-- Only service_role and super_admin should ever look at this table.
DROP POLICY IF EXISTS pending_metering_service_role ON public.pending_metering;
CREATE POLICY pending_metering_service_role
    ON public.pending_metering
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Helper view for super_admin dashboard: current backlog depth.
CREATE OR REPLACE VIEW public.vw_pending_metering_depth AS
SELECT
    COUNT(*) FILTER (WHERE drained_at IS NULL AND dropped_at IS NULL) AS undrained_count,
    COUNT(*) FILTER (WHERE drained_at IS NULL AND dropped_at IS NULL AND created_at < now() - interval '1 hour') AS stuck_over_1h,
    COUNT(*) FILTER (WHERE drained_at IS NULL AND dropped_at IS NULL AND created_at < now() - interval '24 hour') AS stuck_over_24h,
    COUNT(*) FILTER (WHERE dropped_at IS NOT NULL AND dropped_at > now() - interval '7 days') AS dropped_last_7d,
    MAX(retry_count) AS max_retry_count,
    MAX(last_attempt_at) AS last_attempt_at,
    now() AS computed_at
FROM public.pending_metering;

COMMENT ON VIEW public.vw_pending_metering_depth IS 'Super_admin dashboard view of DLQ depth. Used for monitoring + 100-row alert threshold (D1 2026-05-05).';
