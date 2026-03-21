-- ═══════════════════════════════════════════════════════════════
-- BIQc RISK BASELINE HARDENING
-- Migration: 035_risk_baseline_hardening.sql
--
-- Fixes 4 structural weaknesses:
--   1. Canonical industry code enum table (replaces free-text reliance)
--   2. Unique active weight per industry constraint (prevents ambiguity)
--   3. Backtestable risk function (optional config_id parameter)
--   4. Stability guard noted (v2 — 3-day rolling avg)
--
-- ADDITIVE ONLY.
-- ═══════════════════════════════════════════════════════════════


-- ═══ 1. CANONICAL INDUSTRY CODES TABLE ═══

CREATE TABLE IF NOT EXISTS ic_industry_codes (
    code TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    parent_code TEXT,
    created_at TIMESTAMP DEFAULT now()
);

INSERT INTO ic_industry_codes (code, description) VALUES
    ('B2B_SAAS', 'Software as a Service / Technology'),
    ('FINANCIAL_SERVICES', 'Financial Advisory / Wealth / Banking / Insurance'),
    ('CONSTRUCTION', 'Construction / Building / Civil Engineering / Trades'),
    ('PROFESSIONAL_SERVICES', 'Consulting / Legal / Accounting / Marketing'),
    ('HEALTHCARE', 'Medical / Dental / Allied Health'),
    ('RETAIL', 'Retail / E-Commerce'),
    ('EDUCATION', 'Education / Training / Coaching'),
    ('HOSPITALITY', 'Hospitality / Food / Accommodation'),
    ('LOGISTICS', 'Logistics / Transport / Supply Chain'),
    ('MANUFACTURING', 'Manufacturing / Production'),
    ('REAL_ESTATE', 'Real Estate / Property'),
    ('MEDIA', 'Media / Creative / Entertainment'),
    ('NOT_CLASSIFIED', 'Industry not yet classified')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE ic_industry_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_industry_codes" ON ic_industry_codes FOR SELECT USING (true);

-- Add industry_code column to business_profiles for eventual migration
-- (free-text industry remains for backward compat)
DO $$
BEGIN
    IF to_regclass('public.business_profiles') IS NULL THEN
        CREATE TABLE IF NOT EXISTS public.business_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
            business_name TEXT,
            industry TEXT,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'industry_code') THEN
        ALTER TABLE business_profiles ADD COLUMN industry_code TEXT;
    END IF;
END $$;


-- ═══ 2. UNIQUE ACTIVE WEIGHT PER INDUSTRY ═══
-- Prevents two active configs for same industry

-- For industry-specific (non-null industry_code)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_weight_per_industry
    ON ic_risk_weight_configs (industry_code)
    WHERE is_active = true AND industry_code IS NOT NULL;

-- For global default (null industry_code)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_weight_global
    ON ic_risk_weight_configs ((1))
    WHERE is_active = true AND industry_code IS NULL;


-- ═══ 3. BACKTESTABLE RISK FUNCTION ═══
-- Accepts optional config_id to override active config lookup

CREATE OR REPLACE FUNCTION ic_calculate_risk_baseline(
    p_tenant_id UUID,
    p_config_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
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
    v_backtest_mode BOOLEAN := false;

    v_rvi FLOAT := 0;
    v_eds FLOAT := 0;
    v_cdr FLOAT := 0;
    v_ads FLOAT := 0;
    v_crs FLOAT := 0;
    v_risk_band TEXT;

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

    IF NOT is_spine_enabled() THEN
        RETURN jsonb_build_object('status', 'spine_disabled');
    END IF;

    SELECT COUNT(*) INTO v_snapshot_count
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

    IF v_snapshot_count < 3 THEN
        RETURN jsonb_build_object('status', 'insufficient_data', 'snapshots_available', v_snapshot_count, 'minimum_required', 3);
    END IF;

    -- ═══ RESOLVE WEIGHTS ═══
    IF p_config_id IS NOT NULL THEN
        -- BACKTEST MODE: use specified config
        v_backtest_mode := true;
        SELECT config_name, model_version, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, industry_code
        INTO v_config_name, v_config_version, w_rvi, w_eds, w_cdr, w_ads, v_vol_threshold, v_cash_threshold, v_industry_code
        FROM ic_risk_weight_configs
        WHERE id = p_config_id;
    ELSE
        -- PRODUCTION MODE: resolve from tenant industry
        SELECT industry, industry_code INTO v_tenant_industry, v_industry_code
        FROM business_profiles
        WHERE user_id = p_tenant_id
        LIMIT 1;

        -- Use explicit industry_code if set, otherwise resolve from free text
        IF v_industry_code IS NULL THEN
            v_industry_code := ic_resolve_industry_code(v_tenant_industry);
        END IF;

        SELECT config_name, model_version, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold
        INTO v_config_name, v_config_version, w_rvi, w_eds, w_cdr, w_ads, v_vol_threshold, v_cash_threshold
        FROM ic_risk_weight_configs
        WHERE is_active = true
        AND (industry_code = v_industry_code OR industry_code IS NULL)
        ORDER BY industry_code NULLS LAST
        LIMIT 1;
    END IF;

    -- Fallback
    IF w_rvi IS NULL THEN
        w_rvi := 0.35; w_eds := 0.25; w_cdr := 0.25; w_ads := 0.15;
        v_vol_threshold := 0.25; v_cash_threshold := 0.20;
        v_config_name := 'hardcoded_fallback'; v_config_version := 'v0.0.0';
    END IF;

    -- ═══ RVI ═══
    SELECT COALESCE(AVG(deal_velocity), 0), COALESCE(STDDEV(deal_velocity), 0)
    INTO v_rolling_mean, v_rolling_stddev
    FROM ic_daily_metric_snapshots WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

    IF v_rolling_mean > 0 THEN
        v_rvi := LEAST((v_rolling_stddev / v_rolling_mean) / v_vol_threshold, 1.0);
    END IF;
    v_rvi := ROUND(v_rvi::NUMERIC, 4);

    -- ═══ EDS ═══
    SELECT COALESCE(AVG(engagement_score), 0) INTO v_recent_engagement
    FROM ic_daily_metric_snapshots WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 7;

    SELECT COALESCE(AVG(engagement_score), 0) INTO v_prior_engagement
    FROM ic_daily_metric_snapshots WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 14 AND snapshot_date < CURRENT_DATE - 7;

    IF v_prior_engagement > 0 THEN
        v_eds := GREATEST((v_prior_engagement - v_recent_engagement) / v_prior_engagement, 0);
    END IF;
    v_eds := LEAST(ROUND(v_eds::NUMERIC, 4), 1.0);

    -- ═══ CDR ═══
    SELECT COALESCE(AVG(cash_balance), 0) INTO v_rolling_cash_avg
    FROM ic_daily_metric_snapshots WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30 AND cash_balance IS NOT NULL;

    SELECT COALESCE(cash_balance, 0) INTO v_current_cash
    FROM ic_daily_metric_snapshots WHERE tenant_id = p_tenant_id AND cash_balance IS NOT NULL ORDER BY snapshot_date DESC LIMIT 1;

    IF v_rolling_cash_avg > 0 THEN
        v_cdr := LEAST(ABS(v_current_cash - v_rolling_cash_avg) / v_rolling_cash_avg, 1.0);
    END IF;
    v_cdr := ROUND(v_cdr::NUMERIC, 4);

    -- ═══ ADS ═══
    SELECT COALESCE(SUM(anomaly_count), 0) INTO v_anomaly_events
    FROM ic_daily_metric_snapshots WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

    SELECT COUNT(*) INTO v_total_events
    FROM governance_events WHERE workspace_id = p_tenant_id AND signal_timestamp >= NOW() - INTERVAL '30 days';

    IF v_total_events > 0 THEN
        v_ads := LEAST(v_anomaly_events::FLOAT / v_total_events::FLOAT, 1.0);
    END IF;
    v_ads := ROUND(v_ads::NUMERIC, 4);

    -- ═══ COMPOSITE ═══
    v_crs := ROUND((w_rvi * v_rvi + w_eds * v_eds + w_cdr * v_cdr + w_ads * v_ads)::NUMERIC, 4);
    v_risk_band := CASE WHEN v_crs >= 0.7 THEN 'HIGH' WHEN v_crs >= 0.4 THEN 'MODERATE' ELSE 'LOW' END;

    v_elapsed_ms := EXTRACT(MILLISECOND FROM clock_timestamp() - v_start_time)::INT;

    -- ═══ LOG ═══
    INSERT INTO ic_model_executions (
        model_name, model_version, tenant_id, execution_time_ms, confidence_score, output_summary
    ) VALUES (
        'deterministic_risk_baseline', v_config_version, p_tenant_id, v_elapsed_ms, 1.0,
        jsonb_build_object(
            'rvi', v_rvi, 'eds', v_eds, 'cdr', v_cdr, 'ads', v_ads,
            'composite', v_crs, 'risk_band', v_risk_band,
            'backtest_mode', v_backtest_mode,
            'config', jsonb_build_object('name', v_config_name, 'version', v_config_version, 'industry_code', v_industry_code, 'config_id', p_config_id),
            'weights', jsonb_build_object('rvi', w_rvi, 'eds', w_eds, 'cdr', w_cdr, 'ads', w_ads),
            'thresholds', jsonb_build_object('volatility', v_vol_threshold, 'cash_deviation', v_cash_threshold),
            'inputs', jsonb_build_object(
                'snapshots_used', v_snapshot_count, 'rolling_mean', ROUND(v_rolling_mean::NUMERIC, 4),
                'rolling_stddev', ROUND(v_rolling_stddev::NUMERIC, 4), 'recent_engagement', ROUND(v_recent_engagement::NUMERIC, 4),
                'prior_engagement', ROUND(v_prior_engagement::NUMERIC, 4), 'rolling_cash_avg', ROUND(v_rolling_cash_avg::NUMERIC, 2),
                'current_cash', ROUND(v_current_cash::NUMERIC, 2), 'anomaly_events', v_anomaly_events, 'total_events', v_total_events
            )
        )
    ) RETURNING id INTO v_exec_id;

    INSERT INTO ic_intelligence_events (
        tenant_id, event_type, model_name, numeric_payload, json_payload, confidence_score
    ) VALUES (
        p_tenant_id, 'FORECAST_RUN', 'deterministic_risk_baseline', v_crs,
        jsonb_build_object('rvi', v_rvi, 'eds', v_eds, 'cdr', v_cdr, 'ads', v_ads, 'composite', v_crs,
            'risk_band', v_risk_band, 'config_name', v_config_name, 'backtest', v_backtest_mode, 'execution_id', v_exec_id),
        1.0
    );

    RETURN jsonb_build_object(
        'status', 'computed',
        'model_name', 'deterministic_risk_baseline',
        'model_version', v_config_version,
        'backtest_mode', v_backtest_mode,
        'execution_id', v_exec_id,
        'execution_time_ms', v_elapsed_ms,
        'confidence_score', 1.0,
        'config', jsonb_build_object('name', v_config_name, 'industry_code', v_industry_code, 'tenant_industry', v_tenant_industry),
        'indices', jsonb_build_object('revenue_volatility_index', v_rvi, 'engagement_decay_score', v_eds, 'cash_deviation_ratio', v_cdr, 'anomaly_density_score', v_ads),
        'composite', jsonb_build_object('risk_score', v_crs, 'risk_band', v_risk_band),
        'weights', jsonb_build_object('rvi', w_rvi, 'eds', w_eds, 'cdr', w_cdr, 'ads', w_ads),
        'thresholds', jsonb_build_object('volatility', v_vol_threshold, 'cash_deviation', v_cash_threshold),
        'inputs_used', jsonb_build_object('snapshots', v_snapshot_count, 'period', '30 days')
    );
END;
$$;

-- Batch remains unchanged but uses the updated function signature
CREATE OR REPLACE FUNCTION ic_calculate_all_risk_baselines()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_tenant UUID; v_count INT := 0; v_errors INT := 0; v_result JSONB;
BEGIN
    IF NOT is_spine_enabled() THEN RETURN jsonb_build_object('status', 'spine_disabled'); END IF;
    FOR v_tenant IN SELECT DISTINCT tenant_id FROM ic_daily_metric_snapshots WHERE snapshot_date >= CURRENT_DATE - 7
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

GRANT EXECUTE ON FUNCTION ic_calculate_risk_baseline(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ic_calculate_all_risk_baselines() TO postgres;
