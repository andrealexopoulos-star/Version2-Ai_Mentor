-- ═══════════════════════════════════════════════════════════════
-- BIQc RISK CALIBRATION ANALYTICS
-- Migration: 036_risk_calibration_analytics.sql
--
-- Three analytics views + calibration report function:
--   1. Distribution summary (variance, skew, band distribution)
--   2. Industry separation (per-industry mean/stddev)
--   3. Index dominance (correlation of each index to composite)
--   4. Calibration report function (14-day window, pass/fail)
--
-- ADDITIVE ONLY. No existing tables modified.
-- ═══════════════════════════════════════════════════════════════


-- ═══ 1. DISTRIBUTION SUMMARY VIEW ═══
-- Answers: Is variance statistically significant?
-- What is the band distribution (LOW/MODERATE/HIGH)?

CREATE OR REPLACE VIEW ic_risk_distribution_summary AS
SELECT
    COUNT(*) AS execution_count,
    COUNT(DISTINCT tenant_id) AS tenant_count,
    ROUND(AVG((output_summary->>'composite')::NUMERIC), 4) AS avg_risk,
    ROUND(STDDEV((output_summary->>'composite')::NUMERIC), 4) AS risk_stddev,
    ROUND(MIN((output_summary->>'composite')::NUMERIC), 4) AS min_risk,
    ROUND(MAX((output_summary->>'composite')::NUMERIC), 4) AS max_risk,
    ROUND(MAX((output_summary->>'composite')::NUMERIC) - MIN((output_summary->>'composite')::NUMERIC), 4) AS risk_range,
    -- Band distribution
    ROUND(SUM(CASE WHEN (output_summary->>'composite')::NUMERIC < 0.33 THEN 1 ELSE 0 END)::NUMERIC / GREATEST(COUNT(*), 1), 3) AS pct_low,
    ROUND(SUM(CASE WHEN (output_summary->>'composite')::NUMERIC BETWEEN 0.33 AND 0.66 THEN 1 ELSE 0 END)::NUMERIC / GREATEST(COUNT(*), 1), 3) AS pct_moderate,
    ROUND(SUM(CASE WHEN (output_summary->>'composite')::NUMERIC > 0.66 THEN 1 ELSE 0 END)::NUMERIC / GREATEST(COUNT(*), 1), 3) AS pct_high,
    -- Per-index averages
    ROUND(AVG((output_summary->>'rvi')::NUMERIC), 4) AS avg_rvi,
    ROUND(AVG((output_summary->>'eds')::NUMERIC), 4) AS avg_eds,
    ROUND(AVG((output_summary->>'cdr')::NUMERIC), 4) AS avg_cdr,
    ROUND(AVG((output_summary->>'ads')::NUMERIC), 4) AS avg_ads,
    -- Per-index stddev
    ROUND(STDDEV((output_summary->>'rvi')::NUMERIC), 4) AS stddev_rvi,
    ROUND(STDDEV((output_summary->>'eds')::NUMERIC), 4) AS stddev_eds,
    ROUND(STDDEV((output_summary->>'cdr')::NUMERIC), 4) AS stddev_cdr,
    ROUND(STDDEV((output_summary->>'ads')::NUMERIC), 4) AS stddev_ads
FROM ic_model_executions
WHERE model_name = 'deterministic_risk_baseline'
AND COALESCE((output_summary->>'backtest_mode')::BOOLEAN, false) = false
AND created_at >= NOW() - INTERVAL '14 days';


-- ═══ 2. INDUSTRY SEPARATION VIEW ═══
-- Answers: Do industry weights produce meaningfully different scores?

CREATE OR REPLACE VIEW ic_risk_industry_separation AS
SELECT
    COALESCE(output_summary->'config'->>'industry_code', 'GLOBAL') AS industry_code,
    COUNT(*) AS execution_count,
    COUNT(DISTINCT tenant_id) AS tenant_count,
    ROUND(AVG((output_summary->>'composite')::NUMERIC), 4) AS avg_risk,
    ROUND(STDDEV((output_summary->>'composite')::NUMERIC), 4) AS stddev_risk,
    ROUND(MIN((output_summary->>'composite')::NUMERIC), 4) AS min_risk,
    ROUND(MAX((output_summary->>'composite')::NUMERIC), 4) AS max_risk,
    -- Per-index averages per industry
    ROUND(AVG((output_summary->>'rvi')::NUMERIC), 4) AS avg_rvi,
    ROUND(AVG((output_summary->>'eds')::NUMERIC), 4) AS avg_eds,
    ROUND(AVG((output_summary->>'cdr')::NUMERIC), 4) AS avg_cdr,
    ROUND(AVG((output_summary->>'ads')::NUMERIC), 4) AS avg_ads
FROM ic_model_executions
WHERE model_name = 'deterministic_risk_baseline'
AND COALESCE((output_summary->>'backtest_mode')::BOOLEAN, false) = false
AND created_at >= NOW() - INTERVAL '14 days'
GROUP BY COALESCE(output_summary->'config'->>'industry_code', 'GLOBAL');


-- ═══ 3. INDEX DOMINANCE ANALYSIS FUNCTION ═══
-- Answers: Does one index dominate the composite?
-- Cannot use CORR in a view across JSONB easily, so use function.

CREATE OR REPLACE FUNCTION ic_index_dominance_analysis()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_corr_rvi FLOAT;
    v_corr_eds FLOAT;
    v_corr_cdr FLOAT;
    v_corr_ads FLOAT;
    v_dominant TEXT := 'none';
    v_dominant_corr FLOAT := 0;
    v_is_single_factor BOOLEAN := false;
BEGIN
    SELECT
        COALESCE(CORR((output_summary->>'rvi')::FLOAT, (output_summary->>'composite')::FLOAT), 0),
        COALESCE(CORR((output_summary->>'eds')::FLOAT, (output_summary->>'composite')::FLOAT), 0),
        COALESCE(CORR((output_summary->>'cdr')::FLOAT, (output_summary->>'composite')::FLOAT), 0),
        COALESCE(CORR((output_summary->>'ads')::FLOAT, (output_summary->>'composite')::FLOAT), 0)
    INTO v_corr_rvi, v_corr_eds, v_corr_cdr, v_corr_ads
    FROM ic_model_executions
    WHERE model_name = 'deterministic_risk_baseline'
    AND COALESCE((output_summary->>'backtest_mode')::BOOLEAN, false) = false
    AND created_at >= NOW() - INTERVAL '14 days';

    -- Find dominant
    IF ABS(v_corr_rvi) > v_dominant_corr THEN v_dominant := 'RVI'; v_dominant_corr := ABS(v_corr_rvi); END IF;
    IF ABS(v_corr_eds) > v_dominant_corr THEN v_dominant := 'EDS'; v_dominant_corr := ABS(v_corr_eds); END IF;
    IF ABS(v_corr_cdr) > v_dominant_corr THEN v_dominant := 'CDR'; v_dominant_corr := ABS(v_corr_cdr); END IF;
    IF ABS(v_corr_ads) > v_dominant_corr THEN v_dominant := 'ADS'; v_dominant_corr := ABS(v_corr_ads); END IF;

    -- Single-factor check: dominant > 0.85 AND others < 0.3
    v_is_single_factor := v_dominant_corr > 0.85 AND (
        CASE v_dominant
            WHEN 'RVI' THEN GREATEST(ABS(v_corr_eds), ABS(v_corr_cdr), ABS(v_corr_ads)) < 0.3
            WHEN 'EDS' THEN GREATEST(ABS(v_corr_rvi), ABS(v_corr_cdr), ABS(v_corr_ads)) < 0.3
            WHEN 'CDR' THEN GREATEST(ABS(v_corr_rvi), ABS(v_corr_eds), ABS(v_corr_ads)) < 0.3
            WHEN 'ADS' THEN GREATEST(ABS(v_corr_rvi), ABS(v_corr_eds), ABS(v_corr_cdr)) < 0.3
            ELSE false
        END
    );

    RETURN jsonb_build_object(
        'correlations', jsonb_build_object(
            'rvi_to_composite', ROUND(v_corr_rvi::NUMERIC, 4),
            'eds_to_composite', ROUND(v_corr_eds::NUMERIC, 4),
            'cdr_to_composite', ROUND(v_corr_cdr::NUMERIC, 4),
            'ads_to_composite', ROUND(v_corr_ads::NUMERIC, 4)
        ),
        'dominant_index', v_dominant,
        'dominant_correlation', ROUND(v_dominant_corr::NUMERIC, 4),
        'is_single_factor', v_is_single_factor,
        'assessment', CASE
            WHEN v_is_single_factor THEN 'WARNING: Composite is effectively single-factor. Robustness weakened.'
            WHEN v_dominant_corr > 0.75 THEN 'ATTENTION: One index is disproportionately influential.'
            ELSE 'HEALTHY: Indices contribute balanced influence to composite.'
        END
    );
END;
$$;


-- ═══ 4. FULL CALIBRATION REPORT FUNCTION ═══
-- 14-day window. Combines distribution + industry + dominance.

CREATE OR REPLACE FUNCTION ic_risk_calibration_report()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_distribution RECORD;
    v_industry JSONB;
    v_dominance JSONB;
    v_execution_count INT;
    v_tenant_count INT;
    v_calibration_pass BOOLEAN := false;
    v_issues JSONB := '[]'::JSONB;
BEGIN
    -- Distribution summary
    SELECT * INTO v_distribution FROM ic_risk_distribution_summary;

    -- Industry separation
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::JSONB), '[]'::JSONB) INTO v_industry
    FROM ic_risk_industry_separation sub;

    -- Index dominance
    v_dominance := ic_index_dominance_analysis();

    v_execution_count := COALESCE(v_distribution.execution_count, 0);
    v_tenant_count := COALESCE(v_distribution.tenant_count, 0);

    -- ═══ CALIBRATION CHECKS ═══

    -- Check 1: Sufficient data (14 days, multiple tenants)
    IF v_execution_count < 7 THEN
        v_issues := v_issues || '"Insufficient executions. Need ≥7 over 14 days."'::JSONB;
    END IF;

    -- Check 2: Variance is meaningful (stddev ≥ 0.10)
    IF COALESCE(v_distribution.risk_stddev, 0) < 0.10 AND v_execution_count >= 7 THEN
        v_issues := v_issues || '"Risk scores clustering too tightly. Normalization thresholds may be too wide."'::JSONB;
    END IF;

    -- Check 3: Band distribution not 90/10 skewed
    IF COALESCE(v_distribution.pct_low, 0) > 0.90 OR COALESCE(v_distribution.pct_moderate, 0) > 0.90 OR COALESCE(v_distribution.pct_high, 0) > 0.90 THEN
        v_issues := v_issues || '"Band distribution severely skewed. >90% in single band."'::JSONB;
    END IF;

    -- Check 4: No single-factor dominance
    IF (v_dominance->>'is_single_factor')::BOOLEAN THEN
        v_issues := v_issues || ('"Single-factor dominance detected: ' || (v_dominance->>'dominant_index') || ' (corr=' || (v_dominance->>'dominant_correlation') || '). Composite robustness weakened."')::JSONB;
    END IF;

    -- Check 5: Risk range is non-trivial
    IF COALESCE(v_distribution.risk_range, 0) < 0.15 AND v_execution_count >= 7 THEN
        v_issues := v_issues || '"Risk range < 0.15. Scores may not be informative."'::JSONB;
    END IF;

    -- Check 6: Per-index variance — detect flat indices hiding behind composite
    IF v_execution_count >= 7 THEN
        IF COALESCE(v_distribution.stddev_rvi, 0) < 0.02 THEN
            v_issues := v_issues || '"RVI stddev near zero. Volatility threshold likely too wide. Revenue signal is flat."'::JSONB;
        END IF;
        IF COALESCE(v_distribution.stddev_eds, 0) < 0.02 THEN
            v_issues := v_issues || '"EDS stddev near zero. Engagement decay threshold too wide. Engagement signal is flat."'::JSONB;
        END IF;
        IF COALESCE(v_distribution.stddev_cdr, 0) < 0.02 THEN
            v_issues := v_issues || '"CDR stddev near zero. Cash deviation threshold too wide. Cash signal is flat."'::JSONB;
        END IF;
        IF COALESCE(v_distribution.stddev_ads, 0) < 0.02 THEN
            v_issues := v_issues || '"ADS stddev near zero. Anomaly density signal is flat."'::JSONB;
        END IF;
    END IF;

    -- Pass if: sufficient data AND no critical issues
    v_calibration_pass := v_execution_count >= 7 AND jsonb_array_length(v_issues) = 0;

    RETURN jsonb_build_object(
        'calibration_status', CASE WHEN v_calibration_pass THEN 'PASS' ELSE 'NEEDS_CALIBRATION' END,
        'period', '14 days',
        'execution_count', v_execution_count,
        'tenant_count', v_tenant_count,
        'issues', v_issues,
        'issue_count', jsonb_array_length(v_issues),
        'distribution', jsonb_build_object(
            'avg_risk', v_distribution.avg_risk,
            'stddev', v_distribution.risk_stddev,
            'min', v_distribution.min_risk,
            'max', v_distribution.max_risk,
            'range', v_distribution.risk_range,
            'pct_low', v_distribution.pct_low,
            'pct_moderate', v_distribution.pct_moderate,
            'pct_high', v_distribution.pct_high
        ),
        'per_index', jsonb_build_object(
            'rvi', jsonb_build_object('avg', v_distribution.avg_rvi, 'stddev', v_distribution.stddev_rvi),
            'eds', jsonb_build_object('avg', v_distribution.avg_eds, 'stddev', v_distribution.stddev_eds),
            'cdr', jsonb_build_object('avg', v_distribution.avg_cdr, 'stddev', v_distribution.stddev_cdr),
            'ads', jsonb_build_object('avg', v_distribution.avg_ads, 'stddev', v_distribution.stddev_ads)
        ),
        'industry_separation', v_industry,
        'index_dominance', v_dominance,
        'recommendation', CASE
            WHEN v_calibration_pass THEN 'Calibration PASS. Distribution healthy, indices balanced. Ready for probabilistic layer.'
            WHEN v_execution_count < 7 THEN 'Need more data. Run baseline daily for 14 days.'
            WHEN COALESCE(v_distribution.risk_stddev, 0) < 0.10 THEN 'Widen normalization thresholds. Scores clustering too tightly.'
            WHEN (v_dominance->>'is_single_factor')::BOOLEAN THEN 'Rebalance weights. Single index dominates composite.'
            ELSE 'Review identified issues before activating probabilistic engines.'
        END
    );
END;
$$;


-- ═══ GRANTS ═══
GRANT SELECT ON ic_risk_distribution_summary TO authenticated;
GRANT SELECT ON ic_risk_industry_separation TO authenticated;
GRANT EXECUTE ON FUNCTION ic_index_dominance_analysis() TO authenticated;
GRANT EXECUTE ON FUNCTION ic_risk_calibration_report() TO authenticated;
