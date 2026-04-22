-- Migration 119: fix ambiguous column reference in refresh_provider_usage()
--
-- Bug found 2026-04-22 via user-level test evidence gathering:
--   ERROR 42702: column reference "provider" is ambiguous
--   DETAIL:  It could refer to either a PL/pgSQL variable or a table column.
--
-- Root cause: migration 118 declared the function with
--   RETURNS TABLE(provider text, call_count bigint, ...)
-- which creates PL/pgSQL OUT-parameter variables named identically to
-- real columns of public.provider_usage. When the INSERT...ON CONFLICT
-- DO UPDATE...RETURNING clause referenced those columns, Postgres
-- couldn't decide whether "provider" meant the variable or the column
-- and refused to run at all.
--
-- Fix: DROP the function (required — Postgres won't allow CREATE OR REPLACE
-- to change return-type signatures), recreate with OUT-param names prefixed
-- `out_*` and qualify every internal table reference explicitly via the
-- `AS pu` alias on the INSERT target.
--
-- Verified via MCP 2026-04-22: SELECT * FROM public.refresh_provider_usage()
-- executes cleanly and returns 0 rows (expected — usage_ledger empty).

DROP FUNCTION IF EXISTS public.refresh_provider_usage();

CREATE FUNCTION public.refresh_provider_usage()
RETURNS TABLE(
    out_provider              text,
    out_call_count            bigint,
    out_total_cost_aud_micros bigint,
    out_last_called_at        timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH llm_rollup AS (
        SELECT
            ul.provider::text                             AS rollup_provider,
            COUNT(*)::bigint                              AS rollup_call_count,
            COALESCE(SUM(ul.cost_aud_micros), 0)::bigint  AS rollup_total_cost,
            MAX(ul.created_at)                            AS rollup_last_called_at
        FROM public.usage_ledger ul
        WHERE ul.kind = 'consume' AND ul.provider IS NOT NULL
        GROUP BY ul.provider
    ),
    upserted AS (
        INSERT INTO public.provider_usage AS pu
            (provider, call_count, total_cost_aud_micros, last_called_at, status, updated_at)
        SELECT
            r.rollup_provider,
            r.rollup_call_count,
            r.rollup_total_cost,
            r.rollup_last_called_at,
            CASE
                WHEN r.rollup_last_called_at > (now() - interval '24 hours') THEN 'up'
                ELSE 'unknown'
            END,
            now()
        FROM llm_rollup r
        ON CONFLICT (provider) DO UPDATE
            SET call_count            = EXCLUDED.call_count,
                total_cost_aud_micros = EXCLUDED.total_cost_aud_micros,
                last_called_at        = EXCLUDED.last_called_at,
                status                = CASE
                    WHEN pu.last_error_at IS NOT NULL
                     AND pu.last_error_at > EXCLUDED.last_called_at
                        THEN pu.status
                    ELSE EXCLUDED.status
                END,
                updated_at            = now()
            RETURNING pu.provider, pu.call_count, pu.total_cost_aud_micros, pu.last_called_at
    )
    SELECT u.provider, u.call_count, u.total_cost_aud_micros, u.last_called_at FROM upserted u;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_provider_usage() TO service_role;
