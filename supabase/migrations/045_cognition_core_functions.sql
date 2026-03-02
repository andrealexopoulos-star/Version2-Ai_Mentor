-- ═══════════════════════════════════════════════════════════════
-- BIQc COGNITION CORE FUNCTIONS v2 — Migration 045
-- ENTERPRISE EXECUTABLE ALGORITHMS
--
-- 1. Evidence Engine with freshness-weighted integrity scoring
-- 2. Integration Health with SLA breach + retry + history
-- 3. Compound Propagation with chain amplification + dampening
-- 4. Decision Outcome Evaluation with variance normalization
-- 5. Bayesian Confidence Recalibration with decay + gating
-- 6. Drift Detection Engine
-- 7. Daily Instability Snapshot Generator
-- 8. UNIFIED COGNITION CONTRACT FUNCTION (ic_generate_cognition_contract)
-- 9. Telemetry instrumentation on every function
-- ═══════════════════════════════════════════════════════════════


-- ═══ HELPER: Telemetry logger ═══

CREATE OR REPLACE FUNCTION fn_log_telemetry(
    p_tenant_id UUID, p_function TEXT, p_ms INT, p_status TEXT, p_error TEXT DEFAULT NULL, p_rows INT DEFAULT 0
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO cognition_telemetry (tenant_id, function_name, execution_ms, output_status, error_message, row_count)
    VALUES (p_tenant_id, p_function, p_ms, p_status, p_error, p_rows);
EXCEPTION WHEN OTHERS THEN NULL; -- telemetry must never block
END;
$$;


-- ═══ 1. EVIDENCE ENGINE — Freshness-Weighted Integrity ═══

CREATE OR REPLACE FUNCTION fn_assemble_evidence_pack(p_tenant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_start TIMESTAMP := clock_timestamp();
    v_pack JSONB := '{}'::JSONB;
    v_sources INT := 0;
    v_total_possible INT := 8;
    v_missing TEXT[] := '{}';
    v_stale TEXT[] := '{}';
    v_freshness_total FLOAT := 0;
    v_freshness_count INT := 0;
    v_integrity FLOAT := 0;
    v_freshness FLOAT := 0;
    v_tmp JSONB;
    v_tmp_ts TIMESTAMPTZ;
    v_age_hours FLOAT;
    -- Freshness thresholds (hours): fresh < 24, stale > 72
    c_fresh_hours CONSTANT FLOAT := 24;
    c_stale_hours CONSTANT FLOAT := 72;
    v_crm BOOLEAN := false;
    v_acct BOOLEAN := false;
    v_email BOOLEAN := false;
    v_mktg BOOLEAN := false;
    v_elapsed INT;
BEGIN
    -- 1. Business profile (freshness = updated_at)
    SELECT jsonb_build_object('business_name', business_name, 'industry', industry, 'website', website,
        'team_size', team_size, 'years_operating', years_operating, 'target_market', target_market,
        'products_services', products_services, 'competitive_advantages', competitive_advantages,
        'calibration_status', calibration_status), updated_at
    INTO v_tmp, v_tmp_ts FROM business_profiles WHERE user_id = p_tenant_id LIMIT 1;

    IF v_tmp IS NOT NULL THEN
        v_sources := v_sources + 1;
        v_age_hours := EXTRACT(EPOCH FROM (now() - COALESCE(v_tmp_ts, now() - INTERVAL '999 days'))) / 3600;
        v_freshness_total := v_freshness_total + GREATEST(1.0 - (v_age_hours / c_stale_hours), 0);
        v_freshness_count := v_freshness_count + 1;
        IF v_age_hours > c_stale_hours THEN v_stale := array_append(v_stale, 'business_profile'); END IF;
    ELSE
        v_missing := array_append(v_missing, 'business_profile');
    END IF;
    v_pack := v_pack || jsonb_build_object('profile', COALESCE(v_tmp, '{}'::JSONB));

    -- 2. Latest cognitive snapshot (freshness = generated_at)
    SELECT cognitive_snapshot, generated_at INTO v_tmp, v_tmp_ts
    FROM intelligence_snapshots WHERE user_id = p_tenant_id ORDER BY generated_at DESC LIMIT 1;

    IF v_tmp IS NOT NULL THEN
        v_sources := v_sources + 1;
        v_age_hours := EXTRACT(EPOCH FROM (now() - COALESCE(v_tmp_ts, now() - INTERVAL '999 days'))) / 3600;
        v_freshness_total := v_freshness_total + GREATEST(1.0 - (v_age_hours / c_stale_hours), 0);
        v_freshness_count := v_freshness_count + 1;
        IF v_age_hours > c_stale_hours THEN v_stale := array_append(v_stale, 'cognitive_snapshot'); END IF;
    ELSE
        v_missing := array_append(v_missing, 'cognitive_snapshot');
    END IF;
    v_pack := v_pack || jsonb_build_object('snapshot', COALESCE(v_tmp, '{}'::JSONB));

    -- 3. Integration health
    SELECT COALESCE(jsonb_agg(jsonb_build_object('provider', provider, 'category', category, 'status', status,
        'last_sync', last_successful_sync, 'freshness_minutes', data_freshness_minutes,
        'error', last_error_message, 'action_required', required_user_action,
        'sla_breached', sla_breached, 'latency_ms', latency_ms
    )), '[]'::JSONB) INTO v_tmp FROM integration_health WHERE tenant_id = p_tenant_id;
    v_pack := v_pack || jsonb_build_object('integration_health', v_tmp);

    -- 4. Integration connections (with freshness per source)
    SELECT EXISTS(SELECT 1 FROM integration_accounts WHERE user_id = p_tenant_id AND category = 'crm' AND account_token IS NOT NULL AND status != 'disconnected') INTO v_crm;
    SELECT EXISTS(SELECT 1 FROM integration_accounts WHERE user_id = p_tenant_id AND category IN ('accounting','financial') AND account_token IS NOT NULL AND status != 'disconnected') INTO v_acct;
    SELECT EXISTS(SELECT 1 FROM email_connections WHERE user_id = p_tenant_id AND status IN ('connected','active','COMPLETE')) INTO v_email;
    SELECT EXISTS(SELECT 1 FROM marketing_benchmarks WHERE tenant_id = p_tenant_id AND is_current = true) INTO v_mktg;

    IF v_crm THEN v_sources := v_sources + 1; v_freshness_total := v_freshness_total + 0.8; v_freshness_count := v_freshness_count + 1;
    ELSE v_missing := array_append(v_missing, 'crm'); END IF;
    IF v_acct THEN v_sources := v_sources + 1; v_freshness_total := v_freshness_total + 0.8; v_freshness_count := v_freshness_count + 1;
    ELSE v_missing := array_append(v_missing, 'accounting'); END IF;
    IF v_email THEN v_sources := v_sources + 1; v_freshness_total := v_freshness_total + 0.7; v_freshness_count := v_freshness_count + 1;
    ELSE v_missing := array_append(v_missing, 'email'); END IF;
    IF v_mktg THEN v_sources := v_sources + 1; v_freshness_total := v_freshness_total + 0.6; v_freshness_count := v_freshness_count + 1;
    ELSE v_missing := array_append(v_missing, 'marketing'); END IF;

    v_pack := v_pack || jsonb_build_object('integrations', jsonb_build_object('crm', v_crm, 'accounting', v_acct, 'email', v_email, 'marketing', v_mktg));

    -- 5. Active decisions
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'category', decision_category, 'statement', decision_statement,
        'affected_domains', affected_domains, 'expected_change', expected_instability_change,
        'confidence', confidence_at_time, 'status', status, 'created_at', created_at
    ) ORDER BY created_at DESC), '[]'::JSONB) INTO v_tmp
    FROM cognition_decisions WHERE tenant_id = p_tenant_id AND status IN ('active','draft') LIMIT 20;
    IF jsonb_array_length(v_tmp) > 0 THEN v_sources := v_sources + 1; ELSE v_missing := array_append(v_missing, 'decisions'); END IF;
    v_pack := v_pack || jsonb_build_object('decisions', v_tmp);

    -- 6. Evaluated checkpoints
    SELECT COALESCE(jsonb_agg(jsonb_build_object('decision_id', oc.decision_id, 'checkpoint_day', oc.checkpoint_day,
        'status', oc.status, 'decision_effective', oc.decision_effective, 'variance_delta', oc.variance_delta,
        'normalized_variance', oc.normalized_variance, 'false_positive', oc.false_positive, 'evaluated_at', oc.evaluated_at
    ) ORDER BY oc.scheduled_at DESC), '[]'::JSONB) INTO v_tmp
    FROM outcome_checkpoints oc WHERE oc.tenant_id = p_tenant_id AND oc.status = 'evaluated' LIMIT 30;
    v_pack := v_pack || jsonb_build_object('outcome_checkpoints', v_tmp);

    -- 7. Daily metric snapshots (30d)
    SELECT COALESCE(jsonb_agg(jsonb_build_object('date', snapshot_date, 'deal_velocity', deal_velocity,
        'engagement_score', engagement_score, 'cash_balance', cash_balance, 'anomaly_count', anomaly_count
    ) ORDER BY snapshot_date DESC), '[]'::JSONB) INTO v_tmp
    FROM ic_daily_metric_snapshots WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;
    IF jsonb_array_length(v_tmp) > 0 THEN v_sources := v_sources + 1; ELSE v_missing := array_append(v_missing, 'daily_metrics'); END IF;
    v_pack := v_pack || jsonb_build_object('daily_metrics', v_tmp);

    -- 8. Instability history (90d for delta)
    v_pack := v_pack || jsonb_build_object('instability_history', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('date', snapshot_date, 'rvi', rvi, 'eds', eds, 'cdr', cdr, 'ads', ads,
            'composite', composite, 'risk_band', risk_band) ORDER BY snapshot_date DESC), '[]'::JSONB)
        FROM instability_snapshots WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 90));

    -- Compute scores
    v_integrity := ROUND((v_sources::FLOAT / v_total_possible)::NUMERIC, 4);
    v_freshness := CASE WHEN v_freshness_count > 0 THEN ROUND((v_freshness_total / v_freshness_count)::NUMERIC, 4) ELSE 0 END;

    -- Upsert
    INSERT INTO evidence_packs (tenant_id, evidence, integrity_score, freshness_score, missing_sources, stale_sources, source_count, assembly_ms, assembled_at)
    VALUES (p_tenant_id, v_pack, v_integrity, v_freshness, v_missing, v_stale, v_sources,
            EXTRACT(MILLISECOND FROM clock_timestamp() - v_start)::INT, now())
    ON CONFLICT (tenant_id) DO UPDATE SET evidence = EXCLUDED.evidence, integrity_score = EXCLUDED.integrity_score,
        freshness_score = EXCLUDED.freshness_score, missing_sources = EXCLUDED.missing_sources,
        stale_sources = EXCLUDED.stale_sources, source_count = EXCLUDED.source_count,
        assembly_ms = EXCLUDED.assembly_ms, assembled_at = EXCLUDED.assembled_at;

    v_elapsed := EXTRACT(MILLISECOND FROM clock_timestamp() - v_start)::INT;
    PERFORM fn_log_telemetry(p_tenant_id, 'fn_assemble_evidence_pack', v_elapsed, 'ok', NULL, v_sources);

    RETURN jsonb_build_object('evidence', v_pack, 'integrity_score', v_integrity, 'freshness_score', v_freshness,
        'missing_sources', to_jsonb(v_missing), 'stale_sources', to_jsonb(v_stale),
        'source_count', v_sources, 'total_possible', v_total_possible, 'assembly_ms', v_elapsed, 'assembled_at', now());
END;
$$;


-- ═══ 2. INTEGRATION HEALTH with SLA + Retry + History ═══

CREATE OR REPLACE FUNCTION fn_check_integration_health(p_tenant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_start TIMESTAMP := clock_timestamp();
    v_result JSONB := '[]'::JSONB;
    v_account RECORD;
    v_status TEXT; v_action TEXT; v_freshness INT; v_sla BOOLEAN; v_old_status TEXT;
    v_elapsed INT;
BEGIN
    FOR v_account IN
        SELECT provider, category, account_token, status, updated_at FROM integration_accounts WHERE user_id = p_tenant_id
    LOOP
        IF v_account.account_token IS NULL OR v_account.status = 'disconnected' THEN
            v_status := 'NOT_CONNECTED'; v_action := 'Connect integration';
        ELSIF v_account.status IN ('error','failed') THEN
            v_status := 'SYNC_FAILED'; v_action := 'Reconnect';
        ELSIF v_account.updated_at < now() - INTERVAL '24 hours' THEN
            v_status := 'TOKEN_EXPIRED'; v_action := 'Re-authorise';
        ELSIF v_account.updated_at < now() - INTERVAL '4 hours' THEN
            v_status := 'DEGRADED'; v_action := 'Check sync status';
        ELSE
            v_status := 'CONNECTED'; v_action := NULL;
        END IF;

        v_freshness := EXTRACT(EPOCH FROM (now() - COALESCE(v_account.updated_at, now() - INTERVAL '999 days')))::INT / 60;
        v_sla := v_freshness > 240; -- SLA breach: >4 hours stale

        -- Get old status for history
        SELECT status INTO v_old_status FROM integration_health WHERE tenant_id = p_tenant_id AND provider = v_account.provider;

        -- Upsert
        INSERT INTO integration_health (tenant_id, provider, category, status, data_freshness_minutes, required_user_action,
            sla_breached, consecutive_failures, checked_at)
        VALUES (p_tenant_id, v_account.provider, v_account.category, v_status, v_freshness, v_action, v_sla,
            CASE WHEN v_status IN ('SYNC_FAILED','TOKEN_EXPIRED','DEGRADED') THEN 1 ELSE 0 END, now())
        ON CONFLICT (tenant_id, provider) DO UPDATE SET
            status = EXCLUDED.status, data_freshness_minutes = EXCLUDED.data_freshness_minutes,
            required_user_action = EXCLUDED.required_user_action, sla_breached = EXCLUDED.sla_breached,
            consecutive_failures = CASE WHEN EXCLUDED.status IN ('SYNC_FAILED','TOKEN_EXPIRED','DEGRADED')
                THEN integration_health.consecutive_failures + 1 ELSE 0 END,
            checked_at = EXCLUDED.checked_at;

        -- Log status change to history
        IF v_old_status IS DISTINCT FROM v_status THEN
            INSERT INTO integration_health_history (tenant_id, provider, old_status, new_status, error_message)
            VALUES (p_tenant_id, v_account.provider, v_old_status, v_status, v_account.status);
        END IF;

        v_result := v_result || jsonb_build_array(jsonb_build_object(
            'provider', v_account.provider, 'category', v_account.category, 'status', v_status,
            'freshness_minutes', v_freshness, 'sla_breached', v_sla, 'action_required', v_action));
    END LOOP;

    -- Email connections
    DECLARE v_email RECORD; BEGIN
        FOR v_email IN SELECT provider, status, updated_at FROM email_connections WHERE user_id = p_tenant_id LOOP
            v_status := CASE WHEN v_email.status IN ('connected','active','COMPLETE') THEN 'CONNECTED' ELSE 'NOT_CONNECTED' END;
            v_freshness := EXTRACT(EPOCH FROM (now() - COALESCE(v_email.updated_at, now() - INTERVAL '999 days')))::INT / 60;
            v_sla := v_freshness > 240;
            INSERT INTO integration_health (tenant_id, provider, category, status, data_freshness_minutes, sla_breached, checked_at)
            VALUES (p_tenant_id, v_email.provider, 'email', v_status, v_freshness, v_sla, now())
            ON CONFLICT (tenant_id, provider) DO UPDATE SET status = EXCLUDED.status, data_freshness_minutes = EXCLUDED.data_freshness_minutes, sla_breached = EXCLUDED.sla_breached, checked_at = EXCLUDED.checked_at;
            v_result := v_result || jsonb_build_array(jsonb_build_object('provider', v_email.provider, 'category', 'email', 'status', v_status, 'freshness_minutes', v_freshness, 'sla_breached', v_sla));
        END LOOP;
    END;

    v_elapsed := EXTRACT(MILLISECOND FROM clock_timestamp() - v_start)::INT;
    PERFORM fn_log_telemetry(p_tenant_id, 'fn_check_integration_health', v_elapsed, 'ok', NULL, jsonb_array_length(v_result));
    RETURN jsonb_build_object('health', v_result, 'checked_at', now(), 'total_integrations', jsonb_array_length(v_result), 'execution_ms', v_elapsed);
END;
$$;


-- ═══ 3. COMPOUND PROPAGATION with Chain Amplification ═══

CREATE OR REPLACE FUNCTION fn_compute_propagation_map(p_tenant_id UUID, p_instability JSONB DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_start TIMESTAMP := clock_timestamp();
    v_rule RECORD; v_map JSONB := '[]'::JSONB; v_chains JSONB := '[]'::JSONB;
    v_source_value FLOAT; v_adjusted_prob FLOAT; v_indices JSONB; v_domain_map JSONB;
    v_chain_source TEXT; v_chain_targets TEXT[];
    v_compound_prob FLOAT; v_elapsed INT;
    v_industry_code TEXT;
BEGIN
    -- Get indices
    IF p_instability IS NOT NULL AND p_instability ? 'revenue_volatility_index' THEN
        v_indices := p_instability;
    ELSE
        DECLARE v_baseline JSONB;
        BEGIN
            v_baseline := ic_calculate_risk_baseline(p_tenant_id);
            IF v_baseline->>'status' != 'computed' THEN
                RETURN jsonb_build_object('status', 'insufficient_data', 'propagation_map', '[]'::JSONB, 'chains', '[]'::JSONB);
            END IF;
            v_indices := v_baseline->'indices';
        END;
    END IF;

    -- Resolve industry for overrides
    SELECT ic_resolve_industry_code(industry) INTO v_industry_code FROM business_profiles WHERE user_id = p_tenant_id LIMIT 1;

    -- Map domains to index values
    v_domain_map := jsonb_build_object(
        'finance', COALESCE((v_indices->>'cash_deviation_ratio')::FLOAT, 0),
        'cash', COALESCE((v_indices->>'cash_deviation_ratio')::FLOAT, 0),
        'revenue', COALESCE((v_indices->>'revenue_volatility_index')::FLOAT, 0),
        'market', COALESCE((v_indices->>'engagement_decay_score')::FLOAT, 0),
        'operations', COALESCE((v_indices->>'anomaly_density_score')::FLOAT, 0),
        'delivery', COALESCE((v_indices->>'anomaly_density_score')::FLOAT, 0),
        'people', COALESCE((v_indices->>'engagement_decay_score')::FLOAT, 0));

    -- First pass: evaluate direct propagation
    FOR v_rule IN
        SELECT * FROM propagation_rules WHERE is_active = true
        AND (industry_override IS NULL OR industry_override = v_industry_code)
        ORDER BY industry_override NULLS LAST
    LOOP
        v_source_value := COALESCE((v_domain_map->>v_rule.source_domain)::FLOAT, 0);
        IF v_source_value >= v_rule.trigger_threshold THEN
            -- Dynamic probability: base * (source / threshold) * amplification, clamped [0,1]
            v_adjusted_prob := LEAST(
                v_rule.base_probability * (v_source_value / v_rule.trigger_threshold) * v_rule.amplification_factor
                    * (1.0 - v_rule.dampening_factor),
                1.0);
            v_adjusted_prob := ROUND(v_adjusted_prob::NUMERIC, 4);

            v_map := v_map || jsonb_build_array(jsonb_build_object(
                'source_domain', v_rule.source_domain, 'target_domain', v_rule.target_domain,
                'mechanism', v_rule.mechanism, 'severity', v_rule.severity,
                'probability', v_adjusted_prob, 'time_horizon', v_rule.time_horizon,
                'source_instability', ROUND(v_source_value::NUMERIC, 4),
                'trigger_threshold', v_rule.trigger_threshold, 'amplification', v_rule.amplification_factor,
                'is_chain', false,
                'evidence_refs', jsonb_build_array('instability:' || v_rule.source_domain, 'rule:' || v_rule.id)));
        END IF;
    END LOOP;

    -- Second pass: detect compound chains (A→B→C where both A→B and B→C fire)
    DECLARE
        v_p1 JSONB; v_p2 JSONB;
    BEGIN
        FOR v_p1 IN SELECT * FROM jsonb_array_elements(v_map) LOOP
            FOR v_p2 IN SELECT * FROM jsonb_array_elements(v_map) LOOP
                IF (v_p1->>'target_domain') = (v_p2->>'source_domain')
                   AND (v_p1->>'source_domain') != (v_p2->>'target_domain') THEN
                    v_compound_prob := ROUND((COALESCE((v_p1->>'probability')::FLOAT, 0) * COALESCE((v_p2->>'probability')::FLOAT, 0))::NUMERIC, 4);
                    IF v_compound_prob > 0.1 THEN
                        v_chains := v_chains || jsonb_build_array(jsonb_build_object(
                            'chain', (v_p1->>'source_domain') || ' → ' || (v_p1->>'target_domain') || ' → ' || (v_p2->>'target_domain'),
                            'compound_probability', v_compound_prob,
                            'severity', CASE WHEN v_compound_prob > 0.5 THEN 'high' WHEN v_compound_prob > 0.25 THEN 'medium' ELSE 'low' END,
                            'mechanism', (v_p1->>'mechanism') || ' THEN ' || (v_p2->>'mechanism')));
                    END IF;
                END IF;
            END LOOP;
        END LOOP;
    END;

    v_elapsed := EXTRACT(MILLISECOND FROM clock_timestamp() - v_start)::INT;
    PERFORM fn_log_telemetry(p_tenant_id, 'fn_compute_propagation_map', v_elapsed, 'ok', NULL, jsonb_array_length(v_map));

    RETURN jsonb_build_object('status', 'computed', 'propagation_map', v_map, 'chains', v_chains,
        'active_propagations', jsonb_array_length(v_map), 'compound_chains', jsonb_array_length(v_chains),
        'industry_code', v_industry_code, 'execution_ms', v_elapsed);
END;
$$;


-- ═══ 4. DECISION OUTCOME EVALUATION with Variance Normalization ═══

CREATE OR REPLACE FUNCTION fn_evaluate_pending_checkpoints(p_tenant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_start TIMESTAMP := clock_timestamp();
    v_cp RECORD; v_baseline JSONB; v_indices JSONB;
    v_predicted JSONB; v_actual JSONB; v_variance JSONB;
    v_norm_var FLOAT; v_effective BOOLEAN; v_fp BOOLEAN;
    v_evaluated INT := 0; v_results JSONB := '[]'::JSONB;
    v_elapsed INT;
BEGIN
    v_baseline := ic_calculate_risk_baseline(p_tenant_id);
    IF v_baseline->>'status' = 'computed' THEN
        v_indices := v_baseline->'indices';
    ELSE
        v_indices := '{"revenue_volatility_index":0,"engagement_decay_score":0,"cash_deviation_ratio":0,"anomaly_density_score":0}'::JSONB;
    END IF;

    FOR v_cp IN
        SELECT oc.*, cd.expected_instability_change, cd.instability_snapshot_at_time, cd.decision_statement, cd.decision_category
        FROM outcome_checkpoints oc JOIN cognition_decisions cd ON cd.id = oc.decision_id
        WHERE oc.tenant_id = p_tenant_id AND oc.status = 'pending' AND oc.scheduled_at <= now()
        ORDER BY oc.scheduled_at LIMIT 50
    LOOP
        v_predicted := COALESCE(v_cp.expected_instability_change, '{}'::JSONB);
        v_actual := jsonb_build_object(
            'rvi', ROUND(((v_indices->>'revenue_volatility_index')::FLOAT - COALESCE((v_cp.instability_snapshot_at_time->>'rvi')::FLOAT, 0))::NUMERIC, 4),
            'eds', ROUND(((v_indices->>'engagement_decay_score')::FLOAT - COALESCE((v_cp.instability_snapshot_at_time->>'eds')::FLOAT, 0))::NUMERIC, 4),
            'cdr', ROUND(((v_indices->>'cash_deviation_ratio')::FLOAT - COALESCE((v_cp.instability_snapshot_at_time->>'cdr')::FLOAT, 0))::NUMERIC, 4),
            'ads', ROUND(((v_indices->>'anomaly_density_score')::FLOAT - COALESCE((v_cp.instability_snapshot_at_time->>'ads')::FLOAT, 0))::NUMERIC, 4));

        -- Variance per domain
        v_variance := jsonb_build_object(
            'rvi', ROUND((COALESCE((v_actual->>'rvi')::FLOAT,0) - COALESCE((v_predicted->>'revenue')::FLOAT,0))::NUMERIC, 4),
            'eds', ROUND((COALESCE((v_actual->>'eds')::FLOAT,0) - COALESCE((v_predicted->>'market')::FLOAT,0))::NUMERIC, 4),
            'cdr', ROUND((COALESCE((v_actual->>'cdr')::FLOAT,0) - COALESCE((v_predicted->>'cash')::FLOAT,0))::NUMERIC, 4),
            'ads', ROUND((COALESCE((v_actual->>'ads')::FLOAT,0) - COALESCE((v_predicted->>'operations')::FLOAT,0))::NUMERIC, 4));

        -- Normalized variance: root mean square of all domain variances
        v_norm_var := ROUND(SQRT(
            (COALESCE((v_variance->>'rvi')::FLOAT,0))^2 + (COALESCE((v_variance->>'eds')::FLOAT,0))^2 +
            (COALESCE((v_variance->>'cdr')::FLOAT,0))^2 + (COALESCE((v_variance->>'ads')::FLOAT,0))^2
        )::NUMERIC / 2, 4);

        -- Effective if composite instability decreased
        v_effective := COALESCE((v_baseline->'composite'->>'risk_score')::FLOAT, 1) <=
                       COALESCE((v_cp.instability_snapshot_at_time->>'composite')::FLOAT, 1);

        -- False positive: predicted improvement but actual worsened (norm variance > 0.15 and prediction was negative)
        v_fp := (v_norm_var > 0.15) AND NOT v_effective AND (
            COALESCE((v_predicted->>'revenue')::FLOAT, 0) < 0 OR COALESCE((v_predicted->>'cash')::FLOAT, 0) < 0);

        UPDATE outcome_checkpoints SET
            evaluated_at = now(), actual_instability = v_actual, predicted_instability = v_predicted,
            variance_delta = v_variance, normalized_variance = v_norm_var,
            decision_effective = v_effective, false_positive = v_fp,
            confidence_adjustment = CASE WHEN v_effective AND NOT v_fp THEN 0.03 WHEN v_fp THEN -0.05 ELSE -0.02 END,
            status = 'evaluated'
        WHERE id = v_cp.id;

        v_evaluated := v_evaluated + 1;
        v_results := v_results || jsonb_build_array(jsonb_build_object(
            'decision_id', v_cp.decision_id, 'decision_statement', v_cp.decision_statement,
            'category', v_cp.decision_category, 'checkpoint_day', v_cp.checkpoint_day,
            'effective', v_effective, 'false_positive', v_fp,
            'normalized_variance', v_norm_var, 'variance', v_variance));
    END LOOP;

    v_elapsed := EXTRACT(MILLISECOND FROM clock_timestamp() - v_start)::INT;
    PERFORM fn_log_telemetry(p_tenant_id, 'fn_evaluate_pending_checkpoints', v_elapsed, 'ok', NULL, v_evaluated);
    RETURN jsonb_build_object('status', 'evaluated', 'checkpoints_processed', v_evaluated, 'results', v_results, 'execution_ms', v_elapsed);
END;
$$;


-- ═══ 5. BAYESIAN CONFIDENCE RECALIBRATION ═══

CREATE OR REPLACE FUNCTION fn_recalibrate_confidence(p_tenant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_start TIMESTAMP := clock_timestamp();
    v_total INT; v_effective INT; v_fp INT;
    v_accuracy FLOAT; v_fp_rate FLOAT;
    v_prev FLOAT; v_new FLOAT;
    v_reason TEXT; v_decay BOOLEAN := false;
    v_min_decisions CONSTANT INT := 3;
    v_last_eval TIMESTAMPTZ;
    v_days_since_eval INT;
    v_elapsed INT;
BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE decision_effective = true), COUNT(*) FILTER (WHERE false_positive = true)
    INTO v_total, v_effective, v_fp
    FROM outcome_checkpoints WHERE tenant_id = p_tenant_id AND status = 'evaluated';

    -- Minimum decision count gating
    IF v_total < v_min_decisions THEN
        RETURN jsonb_build_object('confidence', 0.5, 'reason', 'Minimum ' || v_min_decisions || ' evaluated checkpoints required. Currently: ' || v_total,
            'trend', 'neutral', 'decisions_evaluated', v_total, 'accuracy_rate', NULL,
            'false_positive_rate', NULL, 'minimum_threshold_met', false);
    END IF;

    v_accuracy := ROUND((v_effective::FLOAT / v_total)::NUMERIC, 4);
    v_fp_rate := ROUND((v_fp::FLOAT / v_total)::NUMERIC, 4);

    SELECT new_confidence INTO v_prev FROM confidence_recalibrations WHERE tenant_id = p_tenant_id ORDER BY recalibrated_at DESC LIMIT 1;
    v_prev := COALESCE(v_prev, 0.5);

    -- Confidence decay: if no evaluation in 30+ days, decay by 0.05 per 30 days
    SELECT MAX(evaluated_at) INTO v_last_eval FROM outcome_checkpoints WHERE tenant_id = p_tenant_id AND status = 'evaluated';
    v_days_since_eval := COALESCE(EXTRACT(DAY FROM (now() - v_last_eval))::INT, 999);
    IF v_days_since_eval > 30 THEN
        v_decay := true;
        v_prev := GREATEST(v_prev - (v_days_since_eval / 30) * 0.05, 0.1);
    END IF;

    -- Bayesian-inspired update: prior * likelihood / evidence
    -- Simplified: confidence = prev + (accuracy - 0.5) * learning_rate - fp_penalty
    -- Learning rate increases with more data points
    DECLARE
        v_lr FLOAT := LEAST(0.05 + (v_total::FLOAT / 100), 0.2);
        v_fp_penalty FLOAT := v_fp_rate * 0.15;
    BEGIN
        v_new := v_prev + (v_accuracy - 0.5) * v_lr - v_fp_penalty;
    END;

    v_new := ROUND(LEAST(GREATEST(v_new, 0.1), 0.95)::NUMERIC, 4);

    v_reason := 'Accuracy ' || ROUND(v_accuracy * 100)::INT || '% (' || v_effective || '/' || v_total || ' effective). '
        || 'False positive rate ' || ROUND(v_fp_rate * 100)::INT || '%. '
        || CASE WHEN v_decay THEN 'Confidence decayed due to ' || v_days_since_eval || ' days since last evaluation. ' ELSE '' END
        || CASE WHEN v_new > v_prev THEN 'Confidence improving.' WHEN v_new < v_prev THEN 'Confidence declining.' ELSE 'Confidence stable.' END;

    INSERT INTO confidence_recalibrations (tenant_id, previous_confidence, new_confidence, adjustment_reason,
        decisions_evaluated, accuracy_rate, false_positive_rate, decay_applied, minimum_threshold_met)
    VALUES (p_tenant_id, v_prev, v_new, v_reason, v_total, v_accuracy, v_fp_rate, v_decay, true);

    v_elapsed := EXTRACT(MILLISECOND FROM clock_timestamp() - v_start)::INT;
    PERFORM fn_log_telemetry(p_tenant_id, 'fn_recalibrate_confidence', v_elapsed, 'ok', NULL, 1);

    RETURN jsonb_build_object('confidence', v_new, 'previous_confidence', v_prev, 'reason', v_reason,
        'trend', CASE WHEN v_new > v_prev THEN 'improving' WHEN v_new < v_prev THEN 'declining' ELSE 'stable' END,
        'decisions_evaluated', v_total, 'decisions_effective', v_effective, 'accuracy_rate', v_accuracy,
        'false_positive_rate', v_fp_rate, 'decay_applied', v_decay, 'minimum_threshold_met', true, 'execution_ms', v_elapsed);
END;
$$;


-- ═══ 6. DRIFT DETECTION ENGINE ═══

CREATE OR REPLACE FUNCTION fn_detect_drift(p_tenant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_start TIMESTAMP := clock_timestamp();
    v_drifts JSONB := '[]'::JSONB;
    v_metric RECORD;
    v_mean FLOAT; v_stddev FLOAT; v_current FLOAT;
    v_drift_mag FLOAT; v_direction TEXT; v_anomalous BOOLEAN;
    v_elapsed INT;
BEGIN
    -- Check each instability index for drift vs 30-day baseline
    FOR v_metric IN
        SELECT unnest(ARRAY['rvi','eds','cdr','ads','composite']) AS name
    LOOP
        EXECUTE format(
            'SELECT COALESCE(AVG(%I), 0), COALESCE(STDDEV(%I), 0) FROM instability_snapshots WHERE tenant_id = $1 AND snapshot_date >= CURRENT_DATE - 30',
            v_metric.name, v_metric.name) INTO v_mean, v_stddev USING p_tenant_id;

        EXECUTE format(
            'SELECT COALESCE(%I, 0) FROM instability_snapshots WHERE tenant_id = $1 ORDER BY snapshot_date DESC LIMIT 1',
            v_metric.name) INTO v_current USING p_tenant_id;

        IF v_stddev > 0 THEN
            v_drift_mag := ROUND(ABS(v_current - v_mean) / v_stddev, 4);
        ELSE
            v_drift_mag := 0;
        END IF;

        v_direction := CASE WHEN v_current > v_mean + v_stddev THEN 'up' WHEN v_current < v_mean - v_stddev THEN 'down' ELSE 'stable' END;
        v_anomalous := v_drift_mag > 2.0; -- >2 standard deviations

        INSERT INTO drift_detection_log (tenant_id, metric_name, expected_range_low, expected_range_high,
            actual_value, drift_magnitude, drift_direction, is_anomalous)
        VALUES (p_tenant_id, v_metric.name, ROUND((v_mean - v_stddev)::NUMERIC, 4), ROUND((v_mean + v_stddev)::NUMERIC, 4),
            ROUND(v_current::NUMERIC, 4), v_drift_mag, v_direction, v_anomalous);

        v_drifts := v_drifts || jsonb_build_array(jsonb_build_object(
            'metric', v_metric.name, 'mean_30d', ROUND(v_mean::NUMERIC, 4), 'stddev_30d', ROUND(v_stddev::NUMERIC, 4),
            'current', ROUND(v_current::NUMERIC, 4), 'drift_magnitude', v_drift_mag,
            'direction', v_direction, 'anomalous', v_anomalous));
    END LOOP;

    v_elapsed := EXTRACT(MILLISECOND FROM clock_timestamp() - v_start)::INT;
    PERFORM fn_log_telemetry(p_tenant_id, 'fn_detect_drift', v_elapsed, 'ok', NULL, jsonb_array_length(v_drifts));
    RETURN jsonb_build_object('drifts', v_drifts, 'anomalies_detected', (SELECT COUNT(*) FROM jsonb_array_elements(v_drifts) e WHERE (e.value->>'anomalous')::BOOLEAN),
        'execution_ms', v_elapsed);
END;
$$;


-- ═══ 7. DAILY INSTABILITY SNAPSHOT GENERATOR ═══

CREATE OR REPLACE FUNCTION fn_snapshot_daily_instability(p_tenant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_baseline JSONB; v_indices JSONB; v_composite JSONB; v_config JSONB;
    v_evidence JSONB; v_prop JSONB;
    v_active_decisions INT;
BEGIN
    v_baseline := ic_calculate_risk_baseline(p_tenant_id);
    IF v_baseline->>'status' != 'computed' THEN
        RETURN jsonb_build_object('status', 'skipped', 'reason', v_baseline->>'status');
    END IF;

    v_indices := v_baseline->'indices'; v_composite := v_baseline->'composite'; v_config := v_baseline->'config';
    v_evidence := fn_assemble_evidence_pack(p_tenant_id);
    v_prop := fn_compute_propagation_map(p_tenant_id, v_indices);
    SELECT COUNT(*) INTO v_active_decisions FROM cognition_decisions WHERE tenant_id = p_tenant_id AND status = 'active';

    INSERT INTO instability_snapshots (tenant_id, rvi, eds, cdr, ads, composite, risk_band,
        config_name, industry_code, evidence_integrity, propagation_count, active_decisions, model_version)
    VALUES (p_tenant_id,
        (v_indices->>'revenue_volatility_index')::FLOAT, (v_indices->>'engagement_decay_score')::FLOAT,
        (v_indices->>'cash_deviation_ratio')::FLOAT, (v_indices->>'anomaly_density_score')::FLOAT,
        (v_composite->>'risk_score')::FLOAT, v_composite->>'risk_band',
        v_config->>'name', v_config->>'industry_code',
        (v_evidence->>'integrity_score')::FLOAT,
        COALESCE((v_prop->>'active_propagations')::INT, 0), v_active_decisions, v_baseline->>'model_version')
    ON CONFLICT (tenant_id, snapshot_date) DO UPDATE SET
        rvi = EXCLUDED.rvi, eds = EXCLUDED.eds, cdr = EXCLUDED.cdr, ads = EXCLUDED.ads,
        composite = EXCLUDED.composite, risk_band = EXCLUDED.risk_band,
        evidence_integrity = EXCLUDED.evidence_integrity, propagation_count = EXCLUDED.propagation_count,
        active_decisions = EXCLUDED.active_decisions;

    RETURN jsonb_build_object('status', 'stored', 'date', CURRENT_DATE,
        'composite', (v_composite->>'risk_score')::FLOAT, 'risk_band', v_composite->>'risk_band');
END;
$$;


-- ═══ 8. UNIFIED COGNITION CONTRACT (THE MASTER FUNCTION) ═══

CREATE OR REPLACE FUNCTION ic_generate_cognition_contract(p_tenant_id UUID, p_tab TEXT DEFAULT 'overview')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_start TIMESTAMP := clock_timestamp();
    v_evidence JSONB; v_baseline JSONB; v_indices JSONB := '{}'::JSONB;
    v_composite JSONB := '{}'::JSONB; v_deltas JSONB := '{}'::JSONB;
    v_propagation JSONB; v_checkpoints JSONB; v_confidence JSONB;
    v_drift JSONB; v_health JSONB;
    v_trajectory TEXT := 'stable';
    v_prev_composite FLOAT; v_curr_composite FLOAT;
    v_tab_insights JSONB := '[]'::JSONB;
    v_automation JSONB := '[]'::JSONB;
    v_integrity FLOAT := 0;
    v_elapsed INT;
    v_valid_tabs TEXT[] := ARRAY['revenue','money','operations','risk','people','market','overview'];
BEGIN
    IF p_tab != ALL(v_valid_tabs) THEN
        RETURN jsonb_build_object('error', 'Invalid tab: ' || p_tab, 'valid_tabs', to_jsonb(v_valid_tabs));
    END IF;

    -- 1. EVIDENCE ENGINE
    v_evidence := fn_assemble_evidence_pack(p_tenant_id);
    v_integrity := COALESCE((v_evidence->>'integrity_score')::FLOAT, 0);

    -- 2. INTEGRATION HEALTH
    v_health := fn_check_integration_health(p_tenant_id);

    -- 3. INSTABILITY ENGINE (existing ic_calculate_risk_baseline)
    v_baseline := ic_calculate_risk_baseline(p_tenant_id);
    IF v_baseline->>'status' = 'computed' THEN
        v_indices := v_baseline->'indices';
        v_composite := v_baseline->'composite';
    END IF;

    -- 4. COMPUTE DELTAS (vs yesterday)
    SELECT composite INTO v_prev_composite FROM instability_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date = CURRENT_DATE - 1;
    v_curr_composite := COALESCE((v_composite->>'risk_score')::FLOAT, 0);
    IF v_prev_composite IS NOT NULL THEN
        v_deltas := jsonb_build_object('composite', ROUND((v_curr_composite - v_prev_composite)::NUMERIC, 4));
        v_trajectory := CASE
            WHEN v_curr_composite - v_prev_composite > 0.05 THEN 'worsening'
            WHEN v_curr_composite - v_prev_composite < -0.05 THEN 'improving'
            ELSE 'stable' END;
    END IF;
    -- Per-index deltas
    DECLARE v_prev RECORD; BEGIN
        SELECT rvi, eds, cdr, ads INTO v_prev FROM instability_snapshots
        WHERE tenant_id = p_tenant_id AND snapshot_date = CURRENT_DATE - 1;
        IF v_prev.rvi IS NOT NULL THEN
            v_deltas := v_deltas || jsonb_build_object(
                'rvi', ROUND((COALESCE((v_indices->>'revenue_volatility_index')::FLOAT,0) - v_prev.rvi)::NUMERIC, 4),
                'eds', ROUND((COALESCE((v_indices->>'engagement_decay_score')::FLOAT,0) - v_prev.eds)::NUMERIC, 4),
                'cdr', ROUND((COALESCE((v_indices->>'cash_deviation_ratio')::FLOAT,0) - v_prev.cdr)::NUMERIC, 4),
                'ads', ROUND((COALESCE((v_indices->>'anomaly_density_score')::FLOAT,0) - v_prev.ads)::NUMERIC, 4));
        END IF;
    END;

    -- 5. PROPAGATION ENGINE
    v_propagation := fn_compute_propagation_map(p_tenant_id, v_indices);

    -- 6. DECISION CONSEQUENCE ENGINE
    v_checkpoints := fn_evaluate_pending_checkpoints(p_tenant_id);

    -- 7. CONFIDENCE RECALIBRATION
    v_confidence := fn_recalibrate_confidence(p_tenant_id);

    -- 8. DRIFT DETECTION
    v_drift := fn_detect_drift(p_tenant_id);

    -- 9. AUTOMATION ACTIONS (fetch all active, filter by tab relevance)
    SELECT COALESCE(jsonb_agg(jsonb_build_object('action_type', action_type, 'label', action_label,
        'secondary_label', secondary_action_label, 'requires_confirmation', requires_confirmation,
        'risk_level', risk_level, 'integration_required', integration_required, 'rollback_guidance', rollback_guidance
    )), '[]'::JSONB) INTO v_automation FROM automation_actions WHERE is_active = true;

    -- 10. EVIDENCE GATING: if integrity < 0.25, block intelligence generation
    IF v_integrity < 0.25 THEN
        v_elapsed := EXTRACT(MILLISECOND FROM clock_timestamp() - v_start)::INT;
        PERFORM fn_log_telemetry(p_tenant_id, 'ic_generate_cognition_contract', v_elapsed, 'insufficient_evidence', NULL, 0);
        RETURN jsonb_build_object(
            'status', 'INSUFFICIENT_EVIDENCE',
            'tab', p_tab,
            'evidence_pack', jsonb_build_object('integrity_score', v_integrity,
                'missing_sources', v_evidence->'missing_sources', 'stale_sources', v_evidence->'stale_sources'),
            'message', 'Evidence integrity too low (' || ROUND(v_integrity * 100)::INT || '%). Connect more data sources to enable intelligence.',
            'required_actions', v_evidence->'missing_sources',
            'integration_health', v_health->'health',
            'computation_ms', v_elapsed);
    END IF;

    -- ASSEMBLE FINAL CONTRACT
    v_elapsed := EXTRACT(MILLISECOND FROM clock_timestamp() - v_start)::INT;
    PERFORM fn_log_telemetry(p_tenant_id, 'ic_generate_cognition_contract', v_elapsed, 'ok', NULL, 1);

    RETURN jsonb_build_object(
        'status', 'computed',
        'tab', p_tab,
        'computed_at', now(),
        'computation_ms', v_elapsed,
        'model_version', COALESCE(v_baseline->>'model_version', 'v1.0.0'),

        'evidence_pack', jsonb_build_object(
            'integrity_score', v_integrity,
            'freshness_score', COALESCE((v_evidence->>'freshness_score')::FLOAT, 0),
            'missing_sources', v_evidence->'missing_sources',
            'stale_sources', v_evidence->'stale_sources',
            'source_count', COALESCE((v_evidence->>'source_count')::INT, 0),
            'total_possible', COALESCE((v_evidence->>'total_possible')::INT, 8),
            'assembly_ms', COALESCE((v_evidence->>'assembly_ms')::INT, 0)),

        'instability', jsonb_build_object(
            'rvi', COALESCE((v_indices->>'revenue_volatility_index')::FLOAT, 0),
            'eds', COALESCE((v_indices->>'engagement_decay_score')::FLOAT, 0),
            'cdr', COALESCE((v_indices->>'cash_deviation_ratio')::FLOAT, 0),
            'ads', COALESCE((v_indices->>'anomaly_density_score')::FLOAT, 0),
            'composite', v_curr_composite,
            'risk_band', COALESCE(v_composite->>'risk_band', 'UNKNOWN'),
            'deltas', v_deltas,
            'trajectory', v_trajectory,
            'config', v_baseline->'config',
            'weights', v_baseline->'weights',
            'thresholds', v_baseline->'thresholds'),

        'propagation_map', COALESCE(v_propagation->'propagation_map', '[]'::JSONB),
        'compound_chains', COALESCE(v_propagation->'chains', '[]'::JSONB),

        'decision_effectiveness', jsonb_build_object(
            'checkpoints_processed', COALESCE((v_checkpoints->>'checkpoints_processed')::INT, 0),
            'results', COALESCE(v_checkpoints->'results', '[]'::JSONB)),

        'confidence', jsonb_build_object(
            'score', COALESCE((v_confidence->>'confidence')::FLOAT, 0.5),
            'reason', COALESCE(v_confidence->>'reason', 'Baseline'),
            'trend', COALESCE(v_confidence->>'trend', 'neutral'),
            'accuracy_rate', (v_confidence->>'accuracy_rate')::FLOAT,
            'false_positive_rate', (v_confidence->>'false_positive_rate')::FLOAT,
            'decisions_evaluated', COALESCE((v_confidence->>'decisions_evaluated')::INT, 0),
            'minimum_threshold_met', COALESCE((v_confidence->>'minimum_threshold_met')::BOOLEAN, false),
            'decay_applied', COALESCE((v_confidence->>'decay_applied')::BOOLEAN, false)),

        'drift', jsonb_build_object(
            'drifts', COALESCE(v_drift->'drifts', '[]'::JSONB),
            'anomalies_detected', COALESCE((v_drift->>'anomalies_detected')::INT, 0)),

        'automation_actions', v_automation,
        'integration_health', COALESCE(v_health->'health', '[]'::JSONB),

        'evidence_refs', jsonb_build_object(
            'evidence_engine', 'fn_assemble_evidence_pack',
            'instability_engine', 'ic_calculate_risk_baseline',
            'propagation_engine', 'fn_compute_propagation_map',
            'decision_engine', 'fn_evaluate_pending_checkpoints',
            'confidence_engine', 'fn_recalibrate_confidence',
            'drift_engine', 'fn_detect_drift',
            'health_engine', 'fn_check_integration_health'));
END;
$$;


-- ═══ GRANTS ═══

GRANT EXECUTE ON FUNCTION fn_log_telemetry(UUID, TEXT, INT, TEXT, TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION fn_assemble_evidence_pack(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_check_integration_health(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_compute_propagation_map(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fn_evaluate_pending_checkpoints(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION fn_recalibrate_confidence(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION fn_detect_drift(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION fn_snapshot_daily_instability(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION ic_generate_cognition_contract(UUID, TEXT) TO authenticated, service_role;

GRANT SELECT ON propagation_rules TO authenticated;
GRANT ALL ON propagation_rules TO service_role;
GRANT SELECT ON automation_actions TO authenticated;
GRANT ALL ON automation_actions TO service_role;

-- ═══ pg_cron SCHEDULES (run these once in SQL editor) ═══
-- Daily instability snapshot at 1:30am UTC:
-- SELECT cron.schedule('cognition-daily-snapshot', '30 1 * * *', $$SELECT fn_snapshot_daily_instability(tenant_id) FROM (SELECT DISTINCT tenant_id FROM ic_daily_metric_snapshots WHERE snapshot_date >= CURRENT_DATE - 7) t$$);
-- Daily drift detection at 2:00am UTC:
-- SELECT cron.schedule('cognition-drift-detection', '0 2 * * *', $$SELECT fn_detect_drift(tenant_id) FROM (SELECT DISTINCT tenant_id FROM instability_snapshots WHERE snapshot_date >= CURRENT_DATE - 7) t$$);
-- Daily checkpoint evaluation at 2:30am UTC:
-- SELECT cron.schedule('cognition-checkpoint-eval', '30 2 * * *', $$SELECT fn_evaluate_pending_checkpoints(tenant_id) FROM (SELECT DISTINCT tenant_id FROM outcome_checkpoints WHERE status = 'pending' AND scheduled_at <= now()) t$$);
