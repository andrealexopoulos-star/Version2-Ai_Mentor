-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION 094: ai_pricing_gaps — surface models missing from
-- MODEL_PRICING so cost_aud=0 doesn't silently distort GP.
--
-- The token_metering middleware currently logs a one-shot warning when a
-- model is missing from MODEL_PRICING. That warning is invisible to admins
-- once the process restarts. This view aggregates ai_usage_log rows where
-- cost_aud is 0 but tokens > 0 — i.e. the model produced billable tokens
-- but the platform recorded no cost. Used by the Super Admin GP dashboard.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.v_ai_pricing_gaps AS
SELECT
    model_used,
    COUNT(*)::bigint                          AS row_count,
    SUM(input_tokens)::bigint                 AS total_input_tokens,
    SUM(output_tokens)::bigint                AS total_output_tokens,
    MIN(date)                                 AS first_seen,
    MAX(date)                                 AS last_seen,
    COUNT(DISTINCT user_id)::bigint           AS affected_users
FROM public.ai_usage_log
WHERE cost_aud IS NOT NULL
  AND cost_aud = 0
  AND (input_tokens > 0 OR output_tokens > 0)
  AND model_used IS NOT NULL
  AND model_used != ''
GROUP BY model_used
ORDER BY total_input_tokens + total_output_tokens DESC;

GRANT SELECT ON public.v_ai_pricing_gaps TO service_role;

-- Admin-gated RPC so the Super Admin dashboard can pull this without
-- granting raw view access to every authenticated user.
CREATE OR REPLACE FUNCTION public.admin_ai_pricing_gaps(
    p_limit integer DEFAULT 50
)
RETURNS TABLE (
    model_used text,
    row_count bigint,
    total_input_tokens bigint,
    total_output_tokens bigint,
    first_seen date,
    last_seen date,
    affected_users bigint
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
        RAISE EXCEPTION 'admin_ai_pricing_gaps: caller is not authorised'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        g.model_used,
        g.row_count,
        g.total_input_tokens,
        g.total_output_tokens,
        g.first_seen,
        g.last_seen,
        g.affected_users
    FROM public.v_ai_pricing_gaps g
    LIMIT GREATEST(1, LEAST(500, COALESCE(p_limit, 50)));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_ai_pricing_gaps(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_ai_pricing_gaps(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ai_pricing_gaps(integer) TO service_role;
