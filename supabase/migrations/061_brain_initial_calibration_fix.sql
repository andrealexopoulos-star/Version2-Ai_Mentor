-- Fix business_core.brain_initial_calibration for the current integration_accounts schema.

CREATE OR REPLACE FUNCTION business_core.brain_initial_calibration(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_top_concerns JSONB := '[]'::jsonb;
    v_confidence NUMERIC := 0;
    v_data_coverage NUMERIC := 0;
    v_sources INTEGER := 0;
BEGIN
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'concern_id', concern_id,
                'priority_score', priority_score,
                'recommendation', recommendation,
                'issue_brief', issue_brief,
                'why_now_brief', why_now_brief,
                'action_brief', action_brief,
                'if_ignored_brief', if_ignored_brief,
                'confidence_score', COALESCE(confidence_score, confidence),
                'data_sources_count', COALESCE(data_sources_count, 0),
                'data_freshness', data_freshness,
                'lineage', COALESCE(evidence_lineage, '{}'::jsonb),
                'evaluated_at', evaluated_at
            )
        ),
        '[]'::jsonb
    )
    INTO v_top_concerns
    FROM (
        SELECT *
        FROM business_core.concern_evaluations
        WHERE tenant_id = p_tenant_id
        ORDER BY evaluated_at DESC, priority_score DESC
        LIMIT 5
    ) t;

    SELECT COALESCE(AVG(COALESCE(confidence_score, confidence)), 0)
    INTO v_confidence
    FROM business_core.concern_evaluations
    WHERE tenant_id = p_tenant_id
      AND evaluated_at > now() - interval '30 days';

    SELECT COUNT(*)
    INTO v_sources
    FROM integration_accounts
    WHERE user_id = p_tenant_id;

    SELECT CASE
        WHEN total_metrics = 0 THEN 0
        ELSE ROUND((computed_metrics::numeric / total_metrics::numeric), 4)
    END
    INTO v_data_coverage
    FROM (
        SELECT
            COUNT(*) AS total_metrics,
            COUNT(*) FILTER (WHERE value IS NOT NULL) AS computed_metrics
        FROM business_core.business_metrics
        WHERE tenant_id = p_tenant_id
          AND calculated_at > now() - interval '45 days'
    ) stats;

    RETURN jsonb_build_object(
        'tenant_id', p_tenant_id,
        'top_5_concerns', v_top_concerns,
        'confidence_score', COALESCE(v_confidence, 0),
        'data_coverage', COALESCE(v_data_coverage, 0),
        'data_sources_count', COALESCE(v_sources, 0),
        'generated_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION business_core.brain_initial_calibration(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION business_core.brain_initial_calibration(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.brain_initial_calibration(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.brain_initial_calibration(UUID) TO service_role;