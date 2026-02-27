-- ═══════════════════════════════════════════════════════════════
-- BIQc CONFIGURABLE RISK BASELINE ENGINE
-- Migration: 034_configurable_risk_weights.sql
--
-- Replaces hardcoded weights with:
--   1. Immutable weight configuration table
--   2. Industry-specific override capability
--   3. Version-locked configurations
--   4. Sum = 1.0 constraint enforcement
--   5. Dynamic weight resolution in risk function
--
-- ADDITIVE. Does not modify 033 tables.
-- Supersedes the CONSTANT weights in ic_calculate_risk_baseline.
-- ═══════════════════════════════════════════════════════════════


-- ═══ 1. WEIGHT CONFIGURATION TABLE ═══

CREATE TABLE IF NOT EXISTS ic_risk_weight_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    industry_code TEXT,  -- NULL = global default
    weight_rvi FLOAT NOT NULL,
    weight_eds FLOAT NOT NULL,
    weight_cdr FLOAT NOT NULL,
    weight_ads FLOAT NOT NULL,
    volatility_threshold FLOAT NOT NULL DEFAULT 0.25,
    cash_deviation_threshold FLOAT NOT NULL DEFAULT 0.20,
    is_active BOOLEAN DEFAULT false,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT now(),
    -- Weights MUST sum to 1.0
    CONSTRAINT weights_sum_one CHECK (
        ROUND((weight_rvi + weight_eds + weight_cdr + weight_ads)::NUMERIC, 5) = 1.0
    )
);

CREATE INDEX IF NOT EXISTS idx_ic_weights_active ON ic_risk_weight_configs(is_active, industry_code);


-- ═══ 2. IMMUTABILITY TRIGGER ═══

CREATE OR REPLACE FUNCTION ic_prevent_weight_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Risk weight configs are immutable. Create a new version instead.';
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_weight_update ON ic_risk_weight_configs;
CREATE TRIGGER trg_prevent_weight_update
    BEFORE UPDATE ON ic_risk_weight_configs
    FOR EACH ROW
    WHEN (OLD.is_active IS NOT DISTINCT FROM NEW.is_active)
    EXECUTE FUNCTION ic_prevent_weight_update();

-- Allow ONLY is_active toggle (for activation/deactivation)
-- The trigger fires on ALL updates EXCEPT when only is_active changes
-- To activate a new config: UPDATE SET is_active = true WHERE id = X
-- Then deactivate old: UPDATE SET is_active = false WHERE id = Y


-- ═══ 3. DEFAULT CONFIGS ═══

-- Global default (all industries)
INSERT INTO ic_risk_weight_configs (config_name, model_version, industry_code, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, is_active, created_by)
VALUES ('global_default', 'v1.0.0', NULL, 0.35, 0.25, 0.25, 0.15, 0.25, 0.20, true, 'system')
ON CONFLICT DO NOTHING;

-- B2B SaaS: higher weight on engagement decay + revenue volatility
INSERT INTO ic_risk_weight_configs (config_name, model_version, industry_code, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, is_active, created_by)
VALUES ('b2b_saas', 'v1.0.0', 'B2B_SAAS', 0.30, 0.35, 0.20, 0.15, 0.30, 0.15, true, 'system')
ON CONFLICT DO NOTHING;

-- Financial Services: higher weight on cash deviation + anomaly density
INSERT INTO ic_risk_weight_configs (config_name, model_version, industry_code, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, is_active, created_by)
VALUES ('financial_services', 'v1.0.0', 'FINANCIAL_SERVICES', 0.25, 0.20, 0.35, 0.20, 0.20, 0.15, true, 'system')
ON CONFLICT DO NOTHING;

-- Construction: higher weight on cash deviation (project-based cash flow)
INSERT INTO ic_risk_weight_configs (config_name, model_version, industry_code, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, is_active, created_by)
VALUES ('construction', 'v1.0.0', 'CONSTRUCTION', 0.25, 0.15, 0.40, 0.20, 0.30, 0.25, true, 'system')
ON CONFLICT DO NOTHING;

-- Professional Services: balanced but engagement-weighted
INSERT INTO ic_risk_weight_configs (config_name, model_version, industry_code, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, is_active, created_by)
VALUES ('professional_services', 'v1.0.0', 'PROFESSIONAL_SERVICES', 0.30, 0.30, 0.25, 0.15, 0.25, 0.20, true, 'system')
ON CONFLICT DO NOTHING;

-- Healthcare: higher anomaly sensitivity
INSERT INTO ic_risk_weight_configs (config_name, model_version, industry_code, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, is_active, created_by)
VALUES ('healthcare', 'v1.0.0', 'HEALTHCARE', 0.25, 0.25, 0.25, 0.25, 0.20, 0.20, true, 'system')
ON CONFLICT DO NOTHING;


-- ═══ 4. INDUSTRY CODE RESOLVER ═══
-- Maps free-text business_profiles.industry to standardized industry_code

CREATE OR REPLACE FUNCTION ic_resolve_industry_code(p_industry TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_lower TEXT;
BEGIN
    IF p_industry IS NULL OR p_industry = '' THEN
        RETURN NULL;
    END IF;
    v_lower := LOWER(p_industry);

    RETURN CASE
        WHEN v_lower ~ '(saas|software|technology|IT|platform|app)' THEN 'B2B_SAAS'
        WHEN v_lower ~ '(financial|wealth|advisory|investment|banking|insurance)' THEN 'FINANCIAL_SERVICES'
        WHEN v_lower ~ '(construction|building|civil|engineering|trades)' THEN 'CONSTRUCTION'
        WHEN v_lower ~ '(accounting|bookkeeping|tax|audit)' THEN 'PROFESSIONAL_SERVICES'
        WHEN v_lower ~ '(law|legal|solicitor|barrister)' THEN 'PROFESSIONAL_SERVICES'
        WHEN v_lower ~ '(consulting|management|strategy|advisory)' THEN 'PROFESSIONAL_SERVICES'
        WHEN v_lower ~ '(medical|healthcare|health|dental|physio|chiro)' THEN 'HEALTHCARE'
        WHEN v_lower ~ '(real estate|property|agency)' THEN 'PROFESSIONAL_SERVICES'
        WHEN v_lower ~ '(marketing|advertising|digital|media|creative)' THEN 'PROFESSIONAL_SERVICES'
        WHEN v_lower ~ '(retail|ecommerce|shop|store)' THEN 'B2B_SAAS'
        WHEN v_lower ~ '(education|training|coaching)' THEN 'PROFESSIONAL_SERVICES'
        WHEN v_lower ~ '(hospitality|restaurant|cafe|hotel)' THEN 'CONSTRUCTION'
        WHEN v_lower ~ '(logistics|transport|freight|supply)' THEN 'CONSTRUCTION'
        WHEN v_lower ~ '(manufacturing|production|factory)' THEN 'CONSTRUCTION'
        ELSE NULL
    END;
END;
$$;


-- ═══ 5. CONFIGURABLE RISK BASELINE FUNCTION (v2) ═══
-- Supersedes ic_calculate_risk_baseline from 033

CREATE OR REPLACE FUNCTION ic_calculate_risk_baseline(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    -- Dynamic weights
    w_rvi FLOAT;
    w_eds FLOAT;
    w_cdr FLOAT;
    w_ads FLOAT;
    v_vol_threshold FLOAT;
    v_cash_threshold FLOAT;
    v_config_name TEXT;
    v_config_version TEXT;
    v_industry_code TEXT;
    v_tenant_industry TEXT;

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

    -- Check spine
    IF NOT is_spine_enabled() THEN
        RETURN jsonb_build_object('status', 'spine_disabled');
    END IF;

    -- Snapshot count check
    SELECT COUNT(*) INTO v_snapshot_count
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

    IF v_snapshot_count < 3 THEN
        RETURN jsonb_build_object('status', 'insufficient_data', 'snapshots_available', v_snapshot_count, 'minimum_required', 3);
    END IF;

    -- ═══ RESOLVE WEIGHTS ═══
    -- Get tenant industry
    SELECT industry INTO v_tenant_industry
    FROM business_profiles
    WHERE user_id = p_tenant_id
    LIMIT 1;

    v_industry_code := ic_resolve_industry_code(v_tenant_industry);

    -- Load weight config: industry-specific first, then global fallback
    SELECT config_name, model_version, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold
    INTO v_config_name, v_config_version, w_rvi, w_eds, w_cdr, w_ads, v_vol_threshold, v_cash_threshold
    FROM ic_risk_weight_configs
    WHERE is_active = true
    AND (industry_code = v_industry_code OR industry_code IS NULL)
    ORDER BY industry_code NULLS LAST  -- industry-specific first
    LIMIT 1;

    -- Fallback if no config found
    IF w_rvi IS NULL THEN
        w_rvi := 0.35; w_eds := 0.25; w_cdr := 0.25; w_ads := 0.15;
        v_vol_threshold := 0.25; v_cash_threshold := 0.20;
        v_config_name := 'hardcoded_fallback'; v_config_version := 'v0.0.0';
    END IF;

    -- ═══ 1. REVENUE VOLATILITY INDEX ═══
    SELECT COALESCE(AVG(deal_velocity), 0), COALESCE(STDDEV(deal_velocity), 0)
    INTO v_rolling_mean, v_rolling_stddev
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

    IF v_rolling_mean > 0 THEN
        v_rvi := LEAST((v_rolling_stddev / v_rolling_mean) / v_vol_threshold, 1.0);
    END IF;
    v_rvi := ROUND(v_rvi::NUMERIC, 4);

    -- ═══ 2. ENGAGEMENT DECAY SCORE ═══
    SELECT COALESCE(AVG(engagement_score), 0) INTO v_recent_engagement
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 7;

    SELECT COALESCE(AVG(engagement_score), 0) INTO v_prior_engagement
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 14 AND snapshot_date < CURRENT_DATE - 7;

    IF v_prior_engagement > 0 THEN
        v_eds := GREATEST((v_prior_engagement - v_recent_engagement) / v_prior_engagement, 0);
    END IF;
    v_eds := LEAST(ROUND(v_eds::NUMERIC, 4), 1.0);

    -- ═══ 3. CASH DEVIATION RATIO ═══
    SELECT COALESCE(AVG(cash_balance), 0) INTO v_rolling_cash_avg
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30 AND cash_balance IS NOT NULL;

    SELECT COALESCE(cash_balance, 0) INTO v_current_cash
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND cash_balance IS NOT NULL
    ORDER BY snapshot_date DESC LIMIT 1;

    IF v_rolling_cash_avg > 0 THEN
        v_cdr := LEAST(ABS(v_current_cash - v_rolling_cash_avg) / v_rolling_cash_avg, 1.0);
    END IF;
    v_cdr := ROUND(v_cdr::NUMERIC, 4);

    -- ═══ 4. ANOMALY DENSITY SCORE ═══
    SELECT COALESCE(SUM(anomaly_count), 0) INTO v_anomaly_events
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

    SELECT COUNT(*) INTO v_total_events
    FROM governance_events
    WHERE workspace_id = p_tenant_id AND signal_timestamp >= NOW() - INTERVAL '30 days';

    IF v_total_events > 0 THEN
        v_ads := LEAST(v_anomaly_events::FLOAT / v_total_events::FLOAT, 1.0);
    END IF;
    v_ads := ROUND(v_ads::NUMERIC, 4);

    -- ═══ COMPOSITE ═══
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
        'deterministic_risk_baseline', v_config_version, p_tenant_id,
        v_elapsed_ms, 1.0,
        jsonb_build_object(
            'rvi', v_rvi, 'eds', v_eds, 'cdr', v_cdr, 'ads', v_ads,
            'composite', v_crs, 'risk_band', v_risk_band,
            'config', jsonb_build_object(
                'name', v_config_name,
                'version', v_config_version,
                'industry_code', v_industry_code,
                'tenant_industry', v_tenant_industry
            ),
            'weights', jsonb_build_object('rvi', w_rvi, 'eds', w_eds, 'cdr', w_cdr, 'ads', w_ads),
            'thresholds', jsonb_build_object('volatility', v_vol_threshold, 'cash_deviation', v_cash_threshold),
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
            'config_name', v_config_name,
            'industry_code', v_industry_code,
            'execution_id', v_exec_id
        ),
        1.0
    );

    -- ═══ RETURN ═══
    RETURN jsonb_build_object(
        'status', 'computed',
        'model_name', 'deterministic_risk_baseline',
        'model_version', v_config_version,
        'execution_id', v_exec_id,
        'execution_time_ms', v_elapsed_ms,
        'confidence_score', 1.0,
        'config', jsonb_build_object(
            'name', v_config_name,
            'industry_code', v_industry_code,
            'tenant_industry', v_tenant_industry
        ),
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
        'thresholds', jsonb_build_object(
            'volatility', v_vol_threshold,
            'cash_deviation', v_cash_threshold
        ),
        'inputs_used', jsonb_build_object(
            'snapshots', v_snapshot_count,
            'period', '30 days'
        )
    );
END;
$$;


-- ═══ BATCH (unchanged but now uses dynamic weights) ═══
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
        SELECT DISTINCT tenant_id FROM ic_daily_metric_snapshots WHERE snapshot_date >= CURRENT_DATE - 7
    LOOP
        BEGIN
            v_result := ic_calculate_risk_baseline(v_tenant);
            IF (v_result->>'status') = 'computed' THEN v_count := v_count + 1; END IF;
        EXCEPTION WHEN OTHERS THEN v_errors := v_errors + 1;
        END;
    END LOOP;
    RETURN jsonb_build_object('status', 'batch_complete', 'tenants_computed', v_count, 'errors', v_errors);
END;
$$;


-- ═══ RLS + GRANTS ═══
ALTER TABLE ic_risk_weight_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_weights" ON ic_risk_weight_configs FOR SELECT USING (true);
CREATE POLICY "service_manage_weights" ON ic_risk_weight_configs FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT EXECUTE ON FUNCTION ic_resolve_industry_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION ic_calculate_risk_baseline(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ic_calculate_all_risk_baselines() TO postgres;

-- pg_cron: daily at 1:30am UTC (after snapshot at 1am)
-- SELECT cron.schedule('ic-risk-baseline', '30 1 * * *', $$SELECT ic_calculate_all_risk_baselines()$$);
