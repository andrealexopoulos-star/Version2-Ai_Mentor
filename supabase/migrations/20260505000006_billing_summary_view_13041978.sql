-- 2026-05-05 (13041978) — vw_billing_summary: customer-facing aggregate view.
--
-- Purpose: customers see ONLY aggregates (total since signup, current cycle)
-- per the backend-only itemized policy. The granular usage_ledger rows are
-- never exposed to authenticated users — this view is the single read surface
-- behind GET /billing/summary.
--
-- Per OPS Manual entry 01 principle P2 + section 6.2.
--
-- Returns one row per user_id with:
--   total_tokens_since_signup  — SUM(consume) for all time
--   tokens_this_cycle          — SUM(consume) since current_period_start
--   topped_up_this_cycle       — SUM(topup) since current_period_start
--   allowance_this_cycle       — token_allocations.input_allocated + output_allocated
--   percent_used               — tokens_this_cycle / allowance × 100
--   cycle_start / cycle_end    — current period boundaries

CREATE OR REPLACE VIEW public.vw_billing_summary
WITH (security_invoker = true) AS
WITH latest_alloc AS (
    SELECT DISTINCT ON (user_id)
        user_id,
        period_start,
        period_end,
        input_allocated,
        output_allocated,
        input_used,
        output_used
    FROM public.token_allocations
    ORDER BY user_id, period_start DESC NULLS LAST
)
SELECT
    ul.user_id,
    COALESCE(SUM(ul.tokens) FILTER (WHERE ul.kind = 'consume'), 0)::bigint
        AS total_tokens_since_signup,
    COALESCE(SUM(ul.tokens) FILTER (
        WHERE ul.kind = 'consume'
          AND la.period_start IS NOT NULL
          AND ul.created_at >= la.period_start
    ), 0)::bigint AS tokens_this_cycle,
    COALESCE(SUM(ul.tokens) FILTER (
        WHERE ul.kind = 'topup'
          AND la.period_start IS NOT NULL
          AND ul.created_at >= la.period_start
    ), 0)::bigint AS topped_up_this_cycle,
    COALESCE(la.input_allocated, 0) + COALESCE(la.output_allocated, 0)
        AS allowance_this_cycle,
    CASE
        WHEN COALESCE(la.input_allocated, 0) + COALESCE(la.output_allocated, 0) = 0 THEN 0
        ELSE ROUND(
            (COALESCE(SUM(ul.tokens) FILTER (
                WHERE ul.kind = 'consume'
                  AND la.period_start IS NOT NULL
                  AND ul.created_at >= la.period_start
            ), 0)::numeric
             / (la.input_allocated + la.output_allocated)::numeric) * 100,
            2
        )
    END AS percent_used,
    la.period_start AS cycle_start,
    la.period_end   AS cycle_end
FROM public.usage_ledger ul
LEFT JOIN latest_alloc la ON la.user_id = ul.user_id
GROUP BY ul.user_id, la.input_allocated, la.output_allocated, la.period_start, la.period_end;

COMMENT ON VIEW public.vw_billing_summary IS 'Customer-facing aggregate billing view. Single read surface for GET /billing/summary. NEVER exposes per-call rows, model names, or provider names — only totals. Migration 20260505 / OPS Manual entry 01 section 6.2 / principle P2.';

-- Authenticated users can read their own summary; security_invoker means
-- the view runs as the caller, so usage_ledger RLS still applies.
GRANT SELECT ON public.vw_billing_summary TO authenticated;
GRANT SELECT ON public.vw_billing_summary TO service_role;
