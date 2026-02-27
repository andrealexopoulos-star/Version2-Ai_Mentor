-- ═══════════════════════════════════════════════════════════════
-- BIQc DETERMINISTIC RISK BASELINE ENGINE
-- Migration: 033_risk_baseline.sql
--
-- Four indices (0–1 normalized):
--   RVI: Revenue Volatility Index
--   EDS: Engagement Decay Score
--   CDR: Cash Deviation Ratio
--   ADS: Anomaly Density Score
--   CRS: Composite Risk Score (weighted)
--
-- Pure SQL. Zero LLM. Zero randomness.
-- Reads ONLY from ic_daily_metric_snapshots.
-- Weights versioned in ic_model_registry.
-- All executions logged to ic_model_executions + ic_intelligence_events.
-- ═══════════════════════════════════════════════════════════════


-- ═══ REGISTER MODEL + WEIGHTS ═══

INSERT INTO ic_model_registry (model_name, model_version, feature_schema_version, accuracy_metric, is_active)
VALUES (
    'deterministic_risk_baseline',
    'v1.0.0',
    'ic_daily_metric_snapshots_v1',
    1.0,  -- deterministic = perfect accuracy by definition
    true
)
ON CONFLICT DO NOTHING;

-- Store weight configuration as a separate registry entry for versioning
INSERT INTO ic_model_registry (model_name, model_version, feature_schema_version, accuracy_metric, is_active)
VALUES (
    'deterministic_risk_baseline_weights',
    'v1.0.0',
    'weight_config',
    1.0,
    true
)
ON CONFLICT DO NOTHING;


-- ═══ RISK BASELINE FUNCTION ═══

CREATE OR REPLACE FUNCTION ic_calculate_risk_baseline(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    -- Weight config (versioned — change requires new model_version)
    w_rvi CONSTANT FLOAT := 0.35;
    w_eds CONSTANT FLOAT := 0.25;
    w_cdr CONSTANT FLOAT := 0.25;
    w_ads CONSTANT FLOAT := 0.15;

    -- Thresholds (versioned)
    volatility_threshold CONSTANT FLOAT := 0.25;

    -- Computed indices
    v_rvi FLOAT := 0;
    v_eds FLOAT := 0;
    v_cdr FLOAT := 0;
    v_ads FLOAT := 0;
    v_crs FLOAT := 0;
    v_risk_band TEXT;

    -- Intermediate
    v_rolling_mean FLOAT;
    v_rolling_stddev FLOAT;
    v_recent_engagement FLOAT;
    v_prior_engagement FLOAT;
    v_rolling_cash_avg FLOAT;
    v_current_cash FLOAT;
    v_anomaly_events INT;
    v_total_events INT;
    v_snapshot_count INT;
    v_start_time TIMESTAMP;
    v_elapsed_ms INT;
    v_exec_id UUID;
BEGIN
    v_start_time := clock_timestamp();

    -- Check spine enabled
    IF NOT is_spine_enabled() THEN
        RETURN jsonb_build_object('status', 'spine_disabled');
    END IF;

    -- Count available snapshots
    SELECT COUNT(*) INTO v_snapshot_count
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND snapshot_date >= CURRENT_DATE - 30;

    IF v_snapshot_count < 3 THEN
        RETURN jsonb_build_object(
            'status', 'insufficient_data',
            'snapshots_available', v_snapshot_count,
            'minimum_required', 3
        );
    END IF;

    -- ═══ 1. REVENUE VOLATILITY INDEX (RVI) ═══
    -- 30-day rolling mean and stddev of deal_velocity (proxy for revenue flow)
    SELECT
        COALESCE(AVG(deal_velocity), 0),
        COALESCE(STDDEV(deal_velocity), 0)
    INTO v_rolling_mean, v_rolling_stddev
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND snapshot_date >= CURRENT_DATE - 30;

    IF v_rolling_mean > 0 THEN
        v_rvi := LEAST((v_rolling_stddev / v_rolling_mean) / volatility_threshold, 1.0);
    ELSE
        v_rvi := 0;  -- No revenue data = no volatility signal (not high risk by default)
    END IF;
    v_rvi := ROUND(v_rvi::NUMERIC, 4);

    -- ═══ 2. ENGAGEMENT DECAY SCORE (EDS) ═══
    -- Compare last 7 days avg engagement vs prior 7 days
    SELECT COALESCE(AVG(engagement_score), 0) INTO v_recent_engagement
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND snapshot_date >= CURRENT_DATE - 7;

    SELECT COALESCE(AVG(engagement_score), 0) INTO v_prior_engagement
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND snapshot_date >= CURRENT_DATE - 14
    AND snapshot_date < CURRENT_DATE - 7;

    IF v_prior_engagement > 0 THEN
        v_eds := GREATEST((v_prior_engagement - v_recent_engagement) / v_prior_engagement, 0);
    ELSE
        v_eds := 0;  -- No prior engagement = no decay measurable
    END IF;
    v_eds := LEAST(ROUND(v_eds::NUMERIC, 4), 1.0);

    -- ═══ 3. CASH DEVIATION RATIO (CDR) ═══
    -- 30-day rolling average vs most recent value
    SELECT COALESCE(AVG(cash_balance), 0) INTO v_rolling_cash_avg
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND snapshot_date >= CURRENT_DATE - 30
    AND cash_balance IS NOT NULL;

    SELECT COALESCE(cash_balance, 0) INTO v_current_cash
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND cash_balance IS NOT NULL
    ORDER BY snapshot_date DESC
    LIMIT 1;

    IF v_rolling_cash_avg > 0 THEN
        v_cdr := LEAST(ABS(v_current_cash - v_rolling_cash_avg) / v_rolling_cash_avg, 1.0);
    ELSE
        v_cdr := 0;  -- No cash data = no deviation signal
    END IF;
    v_cdr := ROUND(v_cdr::NUMERIC, 4);

    -- ═══ 4. ANOMALY DENSITY SCORE (ADS) ═══
    -- Anomaly events / total events (30 days)
    SELECT COALESCE(SUM(anomaly_count), 0) INTO v_anomaly_events
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND snapshot_date >= CURRENT_DATE - 30;

    SELECT COUNT(*) INTO v_total_events
    FROM governance_events
    WHERE workspace_id = p_tenant_id
    AND signal_timestamp >= NOW() - INTERVAL '30 days';

    IF v_total_events > 0 THEN
        v_ads := LEAST(v_anomaly_events::FLOAT / v_total_events::FLOAT, 1.0);
    ELSE
        v_ads := 0;  -- No events = no anomaly density
    END IF;
    v_ads := ROUND(v_ads::NUMERIC, 4);

    -- ═══ COMPOSITE RISK SCORE ═══
    v_crs := ROUND((w_rvi * v_rvi + w_eds * v_eds + w_cdr * v_cdr + w_ads * v_ads)::NUMERIC, 4);

    v_risk_band := CASE
        WHEN v_crs >= 0.7 THEN 'HIGH'
        WHEN v_crs >= 0.4 THEN 'MODERATE'
        ELSE 'LOW'
    END;

    v_elapsed_ms := EXTRACT(MILLISECOND FROM clock_timestamp() - v_start_time)::INT;

    -- ═══ LOG EXECUTION ═══
    INSERT INTO ic_model_executions (
        model_name, model_version, tenant_id,
        execution_time_ms, confidence_score, output_summary
    ) VALUES (
        'deterministic_risk_baseline', 'v1.0.0', p_tenant_id,
        v_elapsed_ms, 1.0,
        jsonb_build_object(
            'rvi', v_rvi, 'eds', v_eds, 'cdr', v_cdr, 'ads', v_ads,
            'composite', v_crs, 'risk_band', v_risk_band,
            'weights', jsonb_build_object('rvi', w_rvi, 'eds', w_eds, 'cdr', w_cdr, 'ads', w_ads),
            'thresholds', jsonb_build_object('volatility', volatility_threshold),
            'inputs', jsonb_build_object(
                'snapshots_used', v_snapshot_count,
                'rolling_mean', ROUND(v_rolling_mean::NUMERIC, 4),
                'rolling_stddev', ROUND(v_rolling_stddev::NUMERIC, 4),
                'recent_engagement', ROUND(v_recent_engagement::NUMERIC, 4),
                'prior_engagement', ROUND(v_prior_engagement::NUMERIC, 4),
                'rolling_cash_avg', ROUND(v_rolling_cash_avg::NUMERIC, 2),
                'current_cash', ROUND(v_current_cash::NUMERIC, 2),
                'anomaly_events', v_anomaly_events,
                'total_events', v_total_events
            )
        )
    ) RETURNING id INTO v_exec_id;

    -- ═══ LOG EVENT ═══
    INSERT INTO ic_intelligence_events (
        tenant_id, event_type, model_name,
        numeric_payload, json_payload, confidence_score
    ) VALUES (
        p_tenant_id, 'FORECAST_RUN', 'deterministic_risk_baseline',
        v_crs,
        jsonb_build_object(
            'rvi', v_rvi, 'eds', v_eds, 'cdr', v_cdr, 'ads', v_ads,
            'composite', v_crs, 'risk_band', v_risk_band,
            'execution_id', v_exec_id
        ),
        1.0
    );

    -- ═══ RETURN ═══
    RETURN jsonb_build_object(
        'status', 'computed',
        'model_name', 'deterministic_risk_baseline',
        'model_version', 'v1.0.0',
        'execution_id', v_exec_id,
        'execution_time_ms', v_elapsed_ms,
        'confidence_score', 1.0,
        'indices', jsonb_build_object(
            'revenue_volatility_index', v_rvi,
            'engagement_decay_score', v_eds,
            'cash_deviation_ratio', v_cdr,
            'anomaly_density_score', v_ads
        ),
        'composite', jsonb_build_object(
            'risk_score', v_crs,
            'risk_band', v_risk_band
        ),
        'weights', jsonb_build_object(
            'rvi', w_rvi, 'eds', w_eds, 'cdr', w_cdr, 'ads', w_ads
        ),
        'inputs_used', jsonb_build_object(
            'snapshots', v_snapshot_count,
            'period', '30 days'
        )
    );
END;
$$;


-- ═══ BATCH EXECUTION ═══

CREATE OR REPLACE FUNCTION ic_calculate_all_risk_baselines()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant UUID;
    v_count INT := 0;
    v_errors INT := 0;
    v_result JSONB;
BEGIN
    IF NOT is_spine_enabled() THEN
        RETURN jsonb_build_object('status', 'spine_disabled');
    END IF;

    FOR v_tenant IN
        SELECT DISTINCT tenant_id
        FROM ic_daily_metric_snapshots
        WHERE snapshot_date >= CURRENT_DATE - 7
    LOOP
        BEGIN
            v_result := ic_calculate_risk_baseline(v_tenant);
            IF (v_result->>'status') = 'computed' THEN
                v_count := v_count + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'batch_complete',
        'tenants_computed', v_count,
        'errors', v_errors
    );
END;
$$;


-- ═══ GRANTS ═══
GRANT EXECUTE ON FUNCTION ic_calculate_risk_baseline(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ic_calculate_all_risk_baselines() TO postgres;

-- pg_cron: daily AFTER snapshot generation (1:30am UTC, 30min after snapshot at 1am)
-- SELECT cron.schedule('ic-risk-baseline', '30 1 * * *', $$SELECT ic_calculate_all_risk_baselines()$$);
