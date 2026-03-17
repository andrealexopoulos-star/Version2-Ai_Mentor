-- ═══════════════════════════════════════════════════════════════
-- BIQc SQL HOTFIX — Run after 023_complete_intelligence_sql.sql
-- Fixes: get_escalation_summary GROUP BY error
--        build_intelligence_summary downstream call
-- ═══════════════════════════════════════════════════════════════

-- FIX 1: get_escalation_summary — fix ORDER BY with jsonb_agg
CREATE OR REPLACE FUNCTION get_escalation_summary(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_active INT;
    v_recovered INT;
    v_avg_duration NUMERIC;
    v_domains JSONB;
BEGIN
    SELECT COUNT(*) FILTER (WHERE recovered_at IS NULL),
           COUNT(*) FILTER (WHERE recovered_at IS NOT NULL)
    INTO v_active, v_recovered
    FROM escalation_history
    WHERE workspace_id = p_workspace_id;

    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(recovered_at, NOW()) - escalated_at)) / 86400), 0)
    INTO v_avg_duration
    FROM escalation_history
    WHERE workspace_id = p_workspace_id;

    SELECT COALESCE(jsonb_agg(row_data), '[]'::JSONB) INTO v_domains
    FROM (
        SELECT jsonb_build_object(
            'domain', domain,
            'position', position,
            'escalated_at', escalated_at,
            'days_active', EXTRACT(DAY FROM NOW() - escalated_at),
            'exposure_count', exposure_count
        ) AS row_data
        FROM escalation_history
        WHERE workspace_id = p_workspace_id
        AND recovered_at IS NULL
        ORDER BY escalated_at DESC
        LIMIT 10
    ) sub;

    RETURN jsonb_build_object(
        'active_escalations', v_active,
        'recovered', v_recovered,
        'avg_duration_days', ROUND(v_avg_duration, 1),
        'active_details', v_domains,
        'computed_at', NOW()
    );
END;
$$;

-- FIX 2: build_intelligence_summary — handle missing functions gracefully
CREATE OR REPLACE FUNCTION build_intelligence_summary(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_workforce JSONB;
    v_scenarios JSONB;
    v_scores JSONB;
    v_pressure JSONB;
    v_freshness JSONB;
    v_contradictions JSONB;
    v_silence JSONB;
    v_escalations JSONB;
    v_completeness JSONB;
    v_readiness JSONB;
    v_overall_health TEXT;
    v_overall_score NUMERIC := 0;
    v_connected_count INT := 0;
BEGIN
    -- Call all sub-functions directly. No silent fallback behavior.
    v_workforce := compute_workforce_health(p_workspace_id);
    v_scenarios := compute_revenue_scenarios(p_workspace_id);
    v_scores := compute_insight_scores(p_workspace_id);
    v_pressure := compute_pressure_levels(p_workspace_id);
    v_freshness := compute_evidence_freshness(p_workspace_id);
    v_contradictions := detect_contradictions(p_workspace_id);
    v_silence := detect_silence(p_workspace_id);
    v_escalations := get_escalation_summary(p_workspace_id);
    v_completeness := compute_profile_completeness(p_workspace_id);
    v_readiness := compute_data_readiness(p_workspace_id);

    -- Compute overall health
    SELECT COUNT(*) INTO v_connected_count
    FROM workspace_integrations
    WHERE workspace_id = p_workspace_id AND status = 'connected';

    v_overall_score := (v_connected_count * 15)
        + CASE WHEN COALESCE((v_contradictions->>'count')::INT, 0) = 0 THEN 20 ELSE 0 END
        + CASE WHEN COALESCE(v_silence->>'silence_level', 'unknown') = 'active' THEN 20 ELSE 0 END
        + COALESCE((v_completeness->>'completeness_pct')::NUMERIC * 0.2, 0)
        + COALESCE((v_readiness->>'readiness_pct')::NUMERIC * 0.1, 0);

    v_overall_health := CASE
        WHEN v_overall_score >= 80 THEN 'excellent'
        WHEN v_overall_score >= 60 THEN 'good'
        WHEN v_overall_score >= 40 THEN 'developing'
        WHEN v_overall_score >= 20 THEN 'needs_attention'
        ELSE 'critical'
    END;

    RETURN jsonb_build_object(
        'workspace_id', p_workspace_id,
        'overall_health', v_overall_health,
        'overall_score', ROUND(v_overall_score),
        'modules', jsonb_build_object(
            'workforce', v_workforce,
            'scenarios', v_scenarios,
            'scores', v_scores,
            'pressure', v_pressure,
            'freshness', v_freshness,
            'contradictions', v_contradictions,
            'silence', v_silence,
            'escalations', v_escalations,
            'completeness', v_completeness,
            'readiness', v_readiness
        ),
        'connected_integrations', v_connected_count,
        'generated_at', NOW()
    );
END;
$$;

-- Re-grant
GRANT EXECUTE ON FUNCTION get_escalation_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION build_intelligence_summary(UUID) TO authenticated;
