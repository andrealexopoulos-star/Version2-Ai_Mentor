-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION 091: Gross Profit (GP) visibility
-- SQL views + RPC for cost, revenue, and GP per user per month.
-- Drives Super Admin GP dashboard without requiring raw-table access.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Monthly LLM cost per user ─────────────────────────────────
-- Sums ai_usage_log.cost_aud by user + calendar month.
-- period_start is the first day of the month (UTC) at 00:00:00.
CREATE OR REPLACE VIEW public.v_monthly_llm_cost_per_user AS
SELECT
    user_id,
    date_trunc('month', date::timestamp)::timestamptz AS period_start,
    COALESCE(SUM(cost_aud), 0)::numeric(14,6)       AS total_cost_aud,
    COALESCE(SUM(input_tokens), 0)::bigint          AS total_input_tokens,
    COALESCE(SUM(output_tokens), 0)::bigint         AS total_output_tokens,
    COALESCE(SUM(count), 0)::bigint                 AS call_count
FROM public.ai_usage_log
WHERE user_id IS NOT NULL
GROUP BY user_id, date_trunc('month', date::timestamp);


-- ─── 2. Monthly revenue per user ──────────────────────────────────
-- Derived from payment_transactions rows that have been marked paid.
-- amount is stored in major units (AUD), so no /100 division.
CREATE OR REPLACE VIEW public.v_monthly_revenue_per_user AS
SELECT
    user_id,
    date_trunc('month', COALESCE(paid_at, created_at))::timestamptz AS period_start,
    COALESCE(SUM(amount), 0)::numeric(14,2) AS revenue_aud,
    COUNT(*)::bigint                        AS paid_transaction_count
FROM public.payment_transactions
WHERE payment_status = 'paid'
  AND user_id IS NOT NULL
GROUP BY user_id, date_trunc('month', COALESCE(paid_at, created_at));


-- ─── 3. Monthly gross profit per user ─────────────────────────────
-- Joins revenue and cost per (user, period). Uses FULL OUTER JOIN
-- so a user who incurred cost without matching revenue in that month
-- still appears (revenue will be 0) — prevents silent GP blind spots.
CREATE OR REPLACE VIEW public.v_monthly_gp_per_user AS
SELECT
    COALESCE(r.user_id, c.user_id)                       AS user_id,
    COALESCE(r.period_start, c.period_start)             AS period_start,
    COALESCE(r.revenue_aud, 0)::numeric(14,2)            AS revenue_aud,
    COALESCE(c.total_cost_aud, 0)::numeric(14,6)         AS cost_aud,
    (COALESCE(r.revenue_aud, 0)
        - COALESCE(c.total_cost_aud, 0))::numeric(14,6)  AS gp_aud,
    CASE
        WHEN COALESCE(r.revenue_aud, 0) = 0 THEN NULL
        ELSE ROUND(
            ((COALESCE(r.revenue_aud, 0) - COALESCE(c.total_cost_aud, 0))
                / NULLIF(r.revenue_aud, 0)) * 100,
            2
        )
    END                                                  AS gp_margin_pct,
    COALESCE(c.total_input_tokens, 0)                    AS total_input_tokens,
    COALESCE(c.total_output_tokens, 0)                   AS total_output_tokens,
    COALESCE(c.call_count, 0)                            AS call_count,
    COALESCE(r.paid_transaction_count, 0)                AS paid_transaction_count
FROM public.v_monthly_revenue_per_user r
FULL OUTER JOIN public.v_monthly_llm_cost_per_user c
    ON r.user_id = c.user_id
   AND r.period_start = c.period_start;


-- ─── 4. Grants ─────────────────────────────────────────────────────
-- service_role gets full read access.
-- authenticated users can read these views, but RLS on the base tables
-- already limits what they see (ai_usage_log RLS, payment_transactions RLS).
GRANT SELECT ON public.v_monthly_llm_cost_per_user TO service_role;
GRANT SELECT ON public.v_monthly_revenue_per_user  TO service_role;
GRANT SELECT ON public.v_monthly_gp_per_user       TO service_role;
GRANT SELECT ON public.v_monthly_llm_cost_per_user TO authenticated;
GRANT SELECT ON public.v_monthly_revenue_per_user  TO authenticated;
GRANT SELECT ON public.v_monthly_gp_per_user       TO authenticated;


-- ─── 5. Admin GP summary RPC ───────────────────────────────────────
-- Returns aggregated GP across all users for a given month.
-- Only callable by Super Admin accounts. Determined via the users.role
-- column (supported values: 'super_admin', 'superadmin', or email match
-- against the MASTER_ADMIN_EMAIL seed). If neither holds, raises.
CREATE OR REPLACE FUNCTION public.admin_gp_summary(
    p_period_start timestamptz DEFAULT date_trunc('month', now())
)
RETURNS TABLE (
    user_id uuid,
    period_start timestamptz,
    revenue_aud numeric,
    cost_aud numeric,
    gp_aud numeric,
    gp_margin_pct numeric,
    total_input_tokens bigint,
    total_output_tokens bigint,
    call_count bigint,
    paid_transaction_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_admin boolean := false;
BEGIN
    -- service_role JWT always permitted.
    IF (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role' THEN
        v_is_admin := true;
    END IF;

    -- Otherwise require the caller to be a super admin in public.users.
    IF NOT v_is_admin THEN
        SELECT TRUE INTO v_is_admin
        FROM public.users u
        WHERE u.id = auth.uid()
          AND (
               LOWER(COALESCE(u.role, '')) IN ('super_admin', 'superadmin')
               OR LOWER(COALESCE(u.subscription_tier, '')) IN ('super_admin', 'superadmin')
          )
        LIMIT 1;
    END IF;

    IF NOT COALESCE(v_is_admin, false) THEN
        RAISE EXCEPTION 'admin_gp_summary: caller is not authorised'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        g.user_id,
        g.period_start,
        g.revenue_aud,
        g.cost_aud,
        g.gp_aud,
        g.gp_margin_pct,
        g.total_input_tokens,
        g.total_output_tokens,
        g.call_count,
        g.paid_transaction_count
    FROM public.v_monthly_gp_per_user g
    WHERE g.period_start = date_trunc('month', p_period_start)::timestamptz
    ORDER BY g.gp_aud DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_gp_summary(timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_gp_summary(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_gp_summary(timestamptz) TO service_role;


-- ─── 6. Platform-wide GP totals (Super Admin dashboard) ───────────
-- Aggregate across ALL users for a period. Used on the monitoring
-- dashboard — returns a single row per month.
CREATE OR REPLACE FUNCTION public.admin_platform_gp_totals(
    p_months integer DEFAULT 12
)
RETURNS TABLE (
    period_start timestamptz,
    total_revenue_aud numeric,
    total_cost_aud numeric,
    total_gp_aud numeric,
    platform_gp_margin_pct numeric,
    active_users bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_admin boolean := false;
BEGIN
    IF (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role' THEN
        v_is_admin := true;
    END IF;

    IF NOT v_is_admin THEN
        SELECT TRUE INTO v_is_admin
        FROM public.users u
        WHERE u.id = auth.uid()
          AND (
               LOWER(COALESCE(u.role, '')) IN ('super_admin', 'superadmin')
               OR LOWER(COALESCE(u.subscription_tier, '')) IN ('super_admin', 'superadmin')
          )
        LIMIT 1;
    END IF;

    IF NOT COALESCE(v_is_admin, false) THEN
        RAISE EXCEPTION 'admin_platform_gp_totals: caller is not authorised'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        g.period_start,
        SUM(g.revenue_aud)::numeric(14,2)                 AS total_revenue_aud,
        SUM(g.cost_aud)::numeric(14,6)                    AS total_cost_aud,
        SUM(g.gp_aud)::numeric(14,6)                      AS total_gp_aud,
        CASE
            WHEN SUM(g.revenue_aud) = 0 THEN NULL
            ELSE ROUND(
                (SUM(g.gp_aud) / NULLIF(SUM(g.revenue_aud), 0)) * 100,
                2
            )
        END                                               AS platform_gp_margin_pct,
        COUNT(DISTINCT g.user_id)::bigint                 AS active_users
    FROM public.v_monthly_gp_per_user g
    WHERE g.period_start >= date_trunc('month', now()) - (p_months || ' months')::interval
    GROUP BY g.period_start
    ORDER BY g.period_start DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_platform_gp_totals(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_platform_gp_totals(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_platform_gp_totals(integer) TO service_role;


-- ─── 7. Indexes to keep the views fast ─────────────────────────────
-- ai_usage_log already has idx_ai_usage_tokens from migration 090.
-- Add a date index so the view's date_trunc('month', date) is efficient.
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_date_month
    ON public.ai_usage_log(date);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_paid_month
    ON public.payment_transactions(paid_at)
    WHERE payment_status = 'paid';
