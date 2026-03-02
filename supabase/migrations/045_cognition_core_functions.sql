-- ═══════════════════════════════════════════════════════════════
-- BIQc COGNITION CORE FUNCTIONS — Migration 045
-- Evidence Assembly + Propagation + Decision Evaluation + Confidence
--
-- ALL COMPUTATION IN SQL. DETERMINISTIC. EVIDENCE-GATED.
-- ═══════════════════════════════════════════════════════════════


-- ═══ 1. EVIDENCE PACK ASSEMBLY ═══

CREATE OR REPLACE FUNCTION fn_assemble_evidence_pack(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pack JSONB := '{}'::JSONB;
    v_sources INT := 0;
    v_missing TEXT[] := '{}';
    v_integrity FLOAT := 0;
    v_profile JSONB;
    v_snapshot JSONB;
    v_integration_health JSONB;
    v_decisions JSONB;
    v_checkpoints JSONB;
    v_metric_snapshots JSONB;
    v_crm_connected BOOLEAN := false;
    v_accounting_connected BOOLEAN := false;
    v_email_connected BOOLEAN := false;
    v_marketing_connected BOOLEAN := false;
    v_total_possible INT := 8;  -- profile, snapshot, crm, accounting, email, marketing, decisions, metrics
BEGIN
    -- 1. Business profile
    SELECT jsonb_build_object(
        'business_name', business_name,
        'industry', industry,
        'website', website,
        'team_size', team_size,
        'years_operating', years_operating,
        'target_market', target_market,
        'products_services', products_services,
        'competitive_advantages', competitive_advantages,
        'calibration_status', calibration_status
    ) INTO v_profile
    FROM business_profiles WHERE user_id = p_tenant_id LIMIT 1;

    IF v_profile IS NOT NULL THEN
        v_sources := v_sources + 1;
    ELSE
        v_missing := array_append(v_missing, 'business_profile');
    END IF;
    v_pack := v_pack || jsonb_build_object('profile', COALESCE(v_profile, '{}'::JSONB));

    -- 2. Latest cognitive snapshot
    SELECT cognitive_snapshot INTO v_snapshot
    FROM intelligence_snapshots
    WHERE user_id = p_tenant_id
    ORDER BY generated_at DESC LIMIT 1;

    IF v_snapshot IS NOT NULL THEN
        v_sources := v_sources + 1;
    ELSE
        v_missing := array_append(v_missing, 'cognitive_snapshot');
    END IF;
    v_pack := v_pack || jsonb_build_object('snapshot', COALESCE(v_snapshot, '{}'::JSONB));

    -- 3. Integration health
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'provider', provider,
        'category', category,
        'status', status,
        'last_sync', last_successful_sync,
        'freshness_minutes', data_freshness_minutes,
        'error', last_error_message,
        'action_required', required_user_action
    )), '[]'::JSONB) INTO v_integration_health
    FROM integration_health WHERE tenant_id = p_tenant_id;

    v_pack := v_pack || jsonb_build_object('integration_health', v_integration_health);

    -- 4. Check integration connections
    SELECT EXISTS(
        SELECT 1 FROM integration_accounts
        WHERE user_id = p_tenant_id AND category = 'crm' AND account_token IS NOT NULL AND status != 'disconnected'
    ) INTO v_crm_connected;

    SELECT EXISTS(
        SELECT 1 FROM integration_accounts
        WHERE user_id = p_tenant_id AND category IN ('accounting', 'financial') AND account_token IS NOT NULL AND status != 'disconnected'
    ) INTO v_accounting_connected;

    SELECT EXISTS(
        SELECT 1 FROM email_connections
        WHERE user_id = p_tenant_id AND status IN ('connected', 'active', 'COMPLETE')
    ) INTO v_email_connected;

    SELECT EXISTS(
        SELECT 1 FROM marketing_benchmarks
        WHERE tenant_id = p_tenant_id AND is_current = true
    ) INTO v_marketing_connected;

    IF v_crm_connected THEN v_sources := v_sources + 1; ELSE v_missing := array_append(v_missing, 'crm'); END IF;
    IF v_accounting_connected THEN v_sources := v_sources + 1; ELSE v_missing := array_append(v_missing, 'accounting'); END IF;
    IF v_email_connected THEN v_sources := v_sources + 1; ELSE v_missing := array_append(v_missing, 'email'); END IF;
    IF v_marketing_connected THEN v_sources := v_sources + 1; ELSE v_missing := array_append(v_missing, 'marketing'); END IF;

    v_pack := v_pack || jsonb_build_object('integrations', jsonb_build_object(
        'crm', v_crm_connected,
        'accounting', v_accounting_connected,
        'email', v_email_connected,
        'marketing', v_marketing_connected
    ));

    -- 5. Active decisions
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'category', decision_category,
        'statement', decision_statement,
        'affected_domains', affected_domains,
        'expected_change', expected_instability_change,
        'confidence', confidence_at_time,
        'created_at', created_at
    ) ORDER BY created_at DESC), '[]'::JSONB) INTO v_decisions
    FROM cognition_decisions
    WHERE tenant_id = p_tenant_id AND status = 'active'
    LIMIT 20;

    IF jsonb_array_length(v_decisions) > 0 THEN v_sources := v_sources + 1; ELSE v_missing := array_append(v_missing, 'decisions'); END IF;
    v_pack := v_pack || jsonb_build_object('decisions', v_decisions);

    -- 6. Outcome checkpoints
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'decision_id', oc.decision_id,
        'checkpoint_day', oc.checkpoint_day,
        'status', oc.status,
        'decision_effective', oc.decision_effective,
        'variance_delta', oc.variance_delta,
        'evaluated_at', oc.evaluated_at
    ) ORDER BY oc.scheduled_at DESC), '[]'::JSONB) INTO v_checkpoints
    FROM outcome_checkpoints oc
    WHERE oc.tenant_id = p_tenant_id AND oc.status = 'evaluated'
    LIMIT 30;

    v_pack := v_pack || jsonb_build_object('outcome_checkpoints', v_checkpoints);

    -- 7. Daily metric snapshots (30 days)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'date', snapshot_date,
        'deal_velocity', deal_velocity,
        'engagement_score', engagement_score,
        'cash_balance', cash_balance,
        'anomaly_count', anomaly_count
    ) ORDER BY snapshot_date DESC), '[]'::JSONB) INTO v_metric_snapshots
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

    IF jsonb_array_length(v_metric_snapshots) > 0 THEN v_sources := v_sources + 1; ELSE v_missing := array_append(v_missing, 'daily_metrics'); END IF;
    v_pack := v_pack || jsonb_build_object('daily_metrics', v_metric_snapshots);

    -- 8. Instability history (for delta computation)
    v_pack := v_pack || jsonb_build_object('instability_history', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'date', snapshot_date,
            'rvi', rvi, 'eds', eds, 'cdr', cdr, 'ads', ads,
            'composite', composite, 'risk_band', risk_band
        ) ORDER BY snapshot_date DESC), '[]'::JSONB)
        FROM instability_snapshots
        WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 90
    ));

    -- Compute integrity
    v_integrity := ROUND((v_sources::FLOAT / v_total_possible)::NUMERIC, 2);

    -- Upsert cached pack
    INSERT INTO evidence_packs (tenant_id, evidence, integrity_score, missing_sources, source_count, assembled_at)
    VALUES (p_tenant_id, v_pack, v_integrity, v_missing, v_sources, now())
    ON CONFLICT (tenant_id) DO UPDATE SET
        evidence = EXCLUDED.evidence,
        integrity_score = EXCLUDED.integrity_score,
        missing_sources = EXCLUDED.missing_sources,
        source_count = EXCLUDED.source_count,
        assembled_at = EXCLUDED.assembled_at;

    RETURN jsonb_build_object(
        'evidence', v_pack,
        'integrity_score', v_integrity,
        'missing_sources', to_jsonb(v_missing),
        'source_count', v_sources,
        'total_possible', v_total_possible,
        'assembled_at', now()
    );
END;
$$;


-- ═══ 2. PROPAGATION MAP COMPUTATION ═══

CREATE OR REPLACE FUNCTION fn_compute_propagation_map(
    p_tenant_id UUID,
    p_instability JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rule RECORD;
    v_map JSONB := '[]'::JSONB;
    v_source_value FLOAT;
    v_adjusted_prob FLOAT;
    v_indices JSONB;
    v_domain_map JSONB;
BEGIN
    -- Get current instability indices
    IF p_instability IS NOT NULL THEN
        v_indices := p_instability;
    ELSE
        v_indices := ic_calculate_risk_baseline(p_tenant_id);
        IF v_indices->>'status' != 'computed' THEN
            RETURN jsonb_build_object('status', 'insufficient_data', 'propagation_map', '[]'::JSONB);
        END IF;
        v_indices := v_indices->'indices';
    END IF;

    -- Map domain names to index values
    v_domain_map := jsonb_build_object(
        'finance', COALESCE((v_indices->>'cash_deviation_ratio')::FLOAT, 0),
        'cash', COALESCE((v_indices->>'cash_deviation_ratio')::FLOAT, 0),
        'revenue', COALESCE((v_indices->>'revenue_volatility_index')::FLOAT, 0),
        'market', COALESCE((v_indices->>'engagement_decay_score')::FLOAT, 0),
        'operations', COALESCE((v_indices->>'anomaly_density_score')::FLOAT, 0),
        'delivery', COALESCE((v_indices->>'anomaly_density_score')::FLOAT, 0),
        'people', COALESCE((v_indices->>'engagement_decay_score')::FLOAT, 0)
    );

    -- Evaluate each rule
    FOR v_rule IN
        SELECT * FROM propagation_rules WHERE is_active = true
    LOOP
        v_source_value := COALESCE((v_domain_map->>v_rule.source_domain)::FLOAT, 0);

        -- Only fire if source domain instability exceeds trigger threshold
        IF v_source_value >= v_rule.trigger_threshold THEN
            -- Adjust probability based on how far above threshold
            v_adjusted_prob := LEAST(
                v_rule.base_probability * (v_source_value / v_rule.trigger_threshold),
                1.0
            );
            v_adjusted_prob := ROUND(v_adjusted_prob::NUMERIC, 2);

            v_map := v_map || jsonb_build_array(jsonb_build_object(
                'source_domain', v_rule.source_domain,
                'target_domain', v_rule.target_domain,
                'mechanism', v_rule.mechanism,
                'severity', v_rule.severity,
                'probability', v_adjusted_prob,
                'time_horizon', v_rule.time_horizon,
                'source_instability', ROUND(v_source_value::NUMERIC, 4),
                'trigger_threshold', v_rule.trigger_threshold,
                'evidence_refs', jsonb_build_array(
                    'instability_index:' || v_rule.source_domain,
                    'propagation_rule:' || v_rule.id
                )
            ));
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'computed',
        'propagation_map', v_map,
        'active_propagations', jsonb_array_length(v_map),
        'indices_used', v_indices
    );
END;
$$;


-- ═══ 3. DECISION OUTCOME EVALUATION ═══

CREATE OR REPLACE FUNCTION fn_evaluate_pending_checkpoints(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cp RECORD;
    v_current_baseline JSONB;
    v_current_indices JSONB;
    v_predicted JSONB;
    v_actual JSONB;
    v_variance JSONB;
    v_effective BOOLEAN;
    v_evaluated INT := 0;
    v_results JSONB := '[]'::JSONB;
BEGIN
    -- Get current instability
    v_current_baseline := ic_calculate_risk_baseline(p_tenant_id);
    IF v_current_baseline->>'status' = 'computed' THEN
        v_current_indices := v_current_baseline->'indices';
    ELSE
        v_current_indices := jsonb_build_object(
            'revenue_volatility_index', 0,
            'engagement_decay_score', 0,
            'cash_deviation_ratio', 0,
            'anomaly_density_score', 0
        );
    END IF;

    -- Process each pending checkpoint
    FOR v_cp IN
        SELECT oc.*, cd.expected_instability_change, cd.instability_snapshot_at_time, cd.decision_statement
        FROM outcome_checkpoints oc
        JOIN cognition_decisions cd ON cd.id = oc.decision_id
        WHERE oc.tenant_id = p_tenant_id
          AND oc.status = 'pending'
          AND oc.scheduled_at <= now()
        ORDER BY oc.scheduled_at
        LIMIT 20
    LOOP
        v_predicted := COALESCE(v_cp.expected_instability_change, '{}'::JSONB);
        v_actual := jsonb_build_object(
            'rvi', (v_current_indices->>'revenue_volatility_index')::FLOAT - COALESCE((v_cp.instability_snapshot_at_time->>'rvi')::FLOAT, 0),
            'eds', (v_current_indices->>'engagement_decay_score')::FLOAT - COALESCE((v_cp.instability_snapshot_at_time->>'eds')::FLOAT, 0),
            'cdr', (v_current_indices->>'cash_deviation_ratio')::FLOAT - COALESCE((v_cp.instability_snapshot_at_time->>'cdr')::FLOAT, 0),
            'ads', (v_current_indices->>'anomaly_density_score')::FLOAT - COALESCE((v_cp.instability_snapshot_at_time->>'ads')::FLOAT, 0)
        );

        -- Compute variance (actual vs predicted per domain)
        v_variance := jsonb_build_object(
            'rvi', ROUND((COALESCE((v_actual->>'rvi')::FLOAT, 0) - COALESCE((v_predicted->>'revenue')::FLOAT, 0))::NUMERIC, 4),
            'eds', ROUND((COALESCE((v_actual->>'eds')::FLOAT, 0) - COALESCE((v_predicted->>'market')::FLOAT, 0))::NUMERIC, 4),
            'cdr', ROUND((COALESCE((v_actual->>'cdr')::FLOAT, 0) - COALESCE((v_predicted->>'cash')::FLOAT, 0))::NUMERIC, 4),
            'ads', ROUND((COALESCE((v_actual->>'ads')::FLOAT, 0) - COALESCE((v_predicted->>'operations')::FLOAT, 0))::NUMERIC, 4)
        );

        -- Decision effective if composite instability decreased or stayed stable
        v_effective := (v_current_baseline->'composite'->>'risk_score')::FLOAT <=
                       COALESCE((v_cp.instability_snapshot_at_time->>'composite')::FLOAT, 1.0);

        -- Update checkpoint
        UPDATE outcome_checkpoints SET
            evaluated_at = now(),
            actual_instability = v_actual,
            predicted_instability = v_predicted,
            variance_delta = v_variance,
            decision_effective = v_effective,
            confidence_adjustment = CASE WHEN v_effective THEN 0.02 ELSE -0.03 END,
            status = 'evaluated'
        WHERE id = v_cp.id;

        v_evaluated := v_evaluated + 1;
        v_results := v_results || jsonb_build_array(jsonb_build_object(
            'decision_id', v_cp.decision_id,
            'decision_statement', v_cp.decision_statement,
            'checkpoint_day', v_cp.checkpoint_day,
            'effective', v_effective,
            'variance', v_variance
        ));
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'evaluated',
        'checkpoints_processed', v_evaluated,
        'results', v_results
    );
END;
$$;


-- ═══ 4. CONFIDENCE RECALIBRATION ═══

CREATE OR REPLACE FUNCTION fn_recalibrate_confidence(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_evaluated INT;
    v_total_effective INT;
    v_accuracy FLOAT;
    v_prev_confidence FLOAT;
    v_new_confidence FLOAT;
    v_reason TEXT;
BEGIN
    -- Count evaluated checkpoints
    SELECT COUNT(*), COUNT(*) FILTER (WHERE decision_effective = true)
    INTO v_total_evaluated, v_total_effective
    FROM outcome_checkpoints
    WHERE tenant_id = p_tenant_id AND status = 'evaluated';

    -- If no checkpoints, return baseline confidence
    IF v_total_evaluated = 0 THEN
        RETURN jsonb_build_object(
            'confidence', 0.5,
            'reason', 'No decision outcomes evaluated yet. Confidence at baseline.',
            'trend', 'neutral',
            'decisions_evaluated', 0,
            'accuracy_rate', NULL
        );
    END IF;

    v_accuracy := ROUND((v_total_effective::FLOAT / v_total_evaluated)::NUMERIC, 2);

    -- Get previous confidence
    SELECT new_confidence INTO v_prev_confidence
    FROM confidence_recalibrations
    WHERE tenant_id = p_tenant_id
    ORDER BY recalibrated_at DESC LIMIT 1;

    v_prev_confidence := COALESCE(v_prev_confidence, 0.5);

    -- Compute new confidence (bounded 0.1 - 0.95)
    v_new_confidence := LEAST(GREATEST(
        v_prev_confidence + (v_accuracy - 0.5) * 0.1,
        0.1
    ), 0.95);
    v_new_confidence := ROUND(v_new_confidence::NUMERIC, 2);

    v_reason := CASE
        WHEN v_accuracy >= 0.8 THEN 'High prediction accuracy (' || (v_accuracy * 100)::INT || '%). System confidence increasing.'
        WHEN v_accuracy >= 0.5 THEN 'Moderate prediction accuracy (' || (v_accuracy * 100)::INT || '%). Confidence stable.'
        ELSE 'Low prediction accuracy (' || (v_accuracy * 100)::INT || '%). System recalibrating — more data needed.'
    END;

    -- Log recalibration
    INSERT INTO confidence_recalibrations (tenant_id, previous_confidence, new_confidence, adjustment_reason, decisions_evaluated, accuracy_rate)
    VALUES (p_tenant_id, v_prev_confidence, v_new_confidence, v_reason, v_total_evaluated, v_accuracy);

    RETURN jsonb_build_object(
        'confidence', v_new_confidence,
        'previous_confidence', v_prev_confidence,
        'reason', v_reason,
        'trend', CASE WHEN v_new_confidence > v_prev_confidence THEN 'improving' WHEN v_new_confidence < v_prev_confidence THEN 'declining' ELSE 'stable' END,
        'decisions_evaluated', v_total_evaluated,
        'decisions_effective', v_total_effective,
        'accuracy_rate', v_accuracy
    );
END;
$$;


-- ═══ 5. INTEGRATION HEALTH CHECK FUNCTION ═══

CREATE OR REPLACE FUNCTION fn_check_integration_health(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB := '[]'::JSONB;
    v_account RECORD;
    v_status TEXT;
    v_action TEXT;
    v_freshness INT;
BEGIN
    -- Check each integration account
    FOR v_account IN
        SELECT provider, category, account_token, status, updated_at
        FROM integration_accounts
        WHERE user_id = p_tenant_id
    LOOP
        IF v_account.account_token IS NULL OR v_account.status = 'disconnected' THEN
            v_status := 'NOT_CONNECTED';
            v_action := 'Connect integration';
        ELSIF v_account.status IN ('error', 'failed') THEN
            v_status := 'SYNC_FAILED';
            v_action := 'Reconnect';
        ELSIF v_account.updated_at < now() - INTERVAL '24 hours' THEN
            v_status := 'TOKEN_EXPIRED';
            v_action := 'Re-authorise';
        ELSE
            v_status := 'CONNECTED';
            v_action := NULL;
        END IF;

        v_freshness := EXTRACT(EPOCH FROM (now() - COALESCE(v_account.updated_at, now() - INTERVAL '999 days'))) / 60;

        -- Upsert health record
        INSERT INTO integration_health (tenant_id, provider, category, status, data_freshness_minutes, required_user_action, checked_at)
        VALUES (p_tenant_id, v_account.provider, v_account.category, v_status, v_freshness, v_action, now())
        ON CONFLICT (tenant_id, provider) DO UPDATE SET
            status = EXCLUDED.status,
            data_freshness_minutes = EXCLUDED.data_freshness_minutes,
            required_user_action = EXCLUDED.required_user_action,
            checked_at = EXCLUDED.checked_at;

        v_result := v_result || jsonb_build_array(jsonb_build_object(
            'provider', v_account.provider,
            'category', v_account.category,
            'status', v_status,
            'freshness_minutes', v_freshness,
            'action_required', v_action
        ));
    END LOOP;

    -- Check email connections separately
    DECLARE
        v_email RECORD;
    BEGIN
        FOR v_email IN
            SELECT provider, status, updated_at FROM email_connections WHERE user_id = p_tenant_id
        LOOP
            v_status := CASE
                WHEN v_email.status IN ('connected', 'active', 'COMPLETE') THEN 'CONNECTED'
                ELSE 'NOT_CONNECTED'
            END;
            v_freshness := EXTRACT(EPOCH FROM (now() - COALESCE(v_email.updated_at, now() - INTERVAL '999 days'))) / 60;

            INSERT INTO integration_health (tenant_id, provider, category, status, data_freshness_minutes, checked_at)
            VALUES (p_tenant_id, v_email.provider, 'email', v_status, v_freshness, now())
            ON CONFLICT (tenant_id, provider) DO UPDATE SET
                status = EXCLUDED.status,
                data_freshness_minutes = EXCLUDED.data_freshness_minutes,
                checked_at = EXCLUDED.checked_at;

            v_result := v_result || jsonb_build_array(jsonb_build_object(
                'provider', v_email.provider,
                'category', 'email',
                'status', v_status,
                'freshness_minutes', v_freshness
            ));
        END LOOP;
    END;

    RETURN jsonb_build_object(
        'health', v_result,
        'checked_at', now(),
        'total_integrations', jsonb_array_length(v_result)
    );
END;
$$;


-- ═══ GRANTS ═══

GRANT EXECUTE ON FUNCTION fn_assemble_evidence_pack(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_assemble_evidence_pack(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION fn_compute_propagation_map(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_compute_propagation_map(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION fn_evaluate_pending_checkpoints(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION fn_recalibrate_confidence(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION fn_check_integration_health(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fn_check_integration_health(UUID) TO service_role;

GRANT SELECT ON propagation_rules TO authenticated;
GRANT ALL ON propagation_rules TO service_role;
GRANT SELECT ON automation_actions TO authenticated;
GRANT ALL ON automation_actions TO service_role;
