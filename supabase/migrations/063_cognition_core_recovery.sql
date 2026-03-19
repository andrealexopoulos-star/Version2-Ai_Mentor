-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 063: COGNITION CORE RECOVERY
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PURPOSE: Recover the real cognition engine that was regressed by migration 045.
--
-- Migration 045 replaced the deterministic risk-baseline engine (034) with
-- hardcoded binary toggles (connected → 0.25 / disconnected → 0.6) and
-- introduced stubs that auto-approve checkpoints, write zero-value snapshots,
-- and return static evidence labels instead of querying real data.
--
-- This migration:
--   1. Restores the REAL risk-baseline algorithm under a safe new name
--      (ic_calculate_risk_baseline_deterministic) so it cannot be overwritten again.
--   2. Re-wires ic_calculate_risk_baseline to call the real engine.
--   3. Fixes ic_generate_cognition_contract to prefer deterministic computation
--      and fall back to connection-status estimates only when data is lacking.
--   4. Fixes fn_evaluate_pending_checkpoints to do actual predicted-vs-actual
--      variance analysis instead of auto-approving everything.
--   5. Fixes fn_snapshot_daily_instability to read real computed risk data.
--   6. Fixes fn_assemble_evidence_pack to query real business_core data.
--   7. Creates the missing cognition_telemetry table.
--
-- SAFE: Uses CREATE OR REPLACE / IF NOT EXISTS throughout.
-- ZERO REGRESSION: No tables dropped. No data deleted. Purely additive.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════════
-- §1  cognition_telemetry — referenced by endpoint but missing
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cognition_telemetry (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  event_type  TEXT NOT NULL,
  event_data  JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cog_telem_tenant
  ON cognition_telemetry(tenant_id, created_at DESC);

ALTER TABLE cognition_telemetry ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cognition_telemetry' AND policyname = 'tenant_read_own_telemetry') THEN
    CREATE POLICY "tenant_read_own_telemetry" ON cognition_telemetry FOR SELECT USING (tenant_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cognition_telemetry' AND policyname = 'service_manage_telemetry') THEN
    CREATE POLICY "service_manage_telemetry" ON cognition_telemetry FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT ON cognition_telemetry TO authenticated;
GRANT ALL ON cognition_telemetry TO service_role;


-- ═══════════════════════════════════════════════════════════════════════════════
-- §2  ic_calculate_risk_baseline_deterministic — the REAL risk engine restored
--     Exact algorithm from migration 034, preserved under an un-clobberable name.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ic_calculate_risk_baseline_deterministic(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Snapshot count check (need >= 3 in last 30 days)
  SELECT COUNT(*) INTO v_snapshot_count
  FROM ic_daily_metric_snapshots
  WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

  IF v_snapshot_count < 3 THEN
    RETURN jsonb_build_object(
      'status', 'insufficient_data',
      'snapshots_available', v_snapshot_count,
      'minimum_required', 3
    );
  END IF;

  -- ═══ RESOLVE INDUSTRY-SPECIFIC WEIGHTS ═══
  BEGIN
    SELECT industry INTO v_tenant_industry
    FROM business_profiles
    WHERE user_id = p_tenant_id
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_tenant_industry := NULL;
  END;

  v_industry_code := ic_resolve_industry_code(v_tenant_industry);

  SELECT config_name, model_version,
         weight_rvi, weight_eds, weight_cdr, weight_ads,
         volatility_threshold, cash_deviation_threshold
  INTO   v_config_name, v_config_version,
         w_rvi, w_eds, w_cdr, w_ads,
         v_vol_threshold, v_cash_threshold
  FROM   ic_risk_weight_configs
  WHERE  is_active = true
    AND  (industry_code = v_industry_code OR industry_code IS NULL)
  ORDER BY industry_code NULLS LAST
  LIMIT 1;

  IF w_rvi IS NULL THEN
    w_rvi := 0.35; w_eds := 0.25; w_cdr := 0.25; w_ads := 0.15;
    v_vol_threshold := 0.25; v_cash_threshold := 0.20;
    v_config_name := 'hardcoded_fallback'; v_config_version := 'v0.0.0';
  END IF;

  -- ═══ 1. REVENUE VOLATILITY INDEX (RVI) ═══
  SELECT COALESCE(AVG(deal_velocity), 0),
         COALESCE(STDDEV(deal_velocity), 0)
  INTO   v_rolling_mean, v_rolling_stddev
  FROM   ic_daily_metric_snapshots
  WHERE  tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

  IF v_rolling_mean > 0 THEN
    v_rvi := LEAST((v_rolling_stddev / v_rolling_mean) / v_vol_threshold, 1.0);
  END IF;
  v_rvi := ROUND(v_rvi::NUMERIC, 4);

  -- ═══ 2. ENGAGEMENT DECAY SCORE (EDS) ═══
  SELECT COALESCE(AVG(engagement_score), 0) INTO v_recent_engagement
  FROM   ic_daily_metric_snapshots
  WHERE  tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 7;

  SELECT COALESCE(AVG(engagement_score), 0) INTO v_prior_engagement
  FROM   ic_daily_metric_snapshots
  WHERE  tenant_id = p_tenant_id
    AND  snapshot_date >= CURRENT_DATE - 14
    AND  snapshot_date < CURRENT_DATE - 7;

  IF v_prior_engagement > 0 THEN
    v_eds := GREATEST((v_prior_engagement - v_recent_engagement) / v_prior_engagement, 0);
  END IF;
  v_eds := LEAST(ROUND(v_eds::NUMERIC, 4), 1.0);

  -- ═══ 3. CASH DEVIATION RATIO (CDR) ═══
  SELECT COALESCE(AVG(cash_balance), 0) INTO v_rolling_cash_avg
  FROM   ic_daily_metric_snapshots
  WHERE  tenant_id = p_tenant_id
    AND  snapshot_date >= CURRENT_DATE - 30
    AND  cash_balance IS NOT NULL;

  SELECT COALESCE(cash_balance, 0) INTO v_current_cash
  FROM   ic_daily_metric_snapshots
  WHERE  tenant_id = p_tenant_id AND cash_balance IS NOT NULL
  ORDER BY snapshot_date DESC LIMIT 1;

  IF v_rolling_cash_avg > 0 THEN
    v_cdr := LEAST(ABS(v_current_cash - v_rolling_cash_avg) / v_rolling_cash_avg, 1.0);
  END IF;
  v_cdr := ROUND(v_cdr::NUMERIC, 4);

  -- ═══ 4. ANOMALY DENSITY SCORE (ADS) ═══
  SELECT COALESCE(SUM(anomaly_count), 0) INTO v_anomaly_events
  FROM   ic_daily_metric_snapshots
  WHERE  tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

  SELECT COUNT(*) INTO v_total_events
  FROM   governance_events
  WHERE  workspace_id = p_tenant_id AND signal_timestamp >= NOW() - INTERVAL '30 days';

  IF v_total_events > 0 THEN
    v_ads := LEAST(v_anomaly_events::FLOAT / v_total_events::FLOAT, 1.0);
  END IF;
  v_ads := ROUND(v_ads::NUMERIC, 4);

  -- ═══ COMPOSITE WEIGHTED SCORE ═══
  v_crs := ROUND(
    (w_rvi * v_rvi + w_eds * v_eds + w_cdr * v_cdr + w_ads * v_ads)::NUMERIC, 4
  );

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

GRANT EXECUTE ON FUNCTION ic_calculate_risk_baseline_deterministic(UUID) TO authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════════════════
-- §3  ic_calculate_risk_baseline — public wrapper calls the real engine again
--     Replaces the 045 stub that looped back through ic_generate_cognition_contract.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ic_calculate_risk_baseline(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN ic_calculate_risk_baseline_deterministic(p_tenant_id);
END;
$$;

GRANT EXECUTE ON FUNCTION ic_calculate_risk_baseline(UUID) TO authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════════════════
-- §4  ic_generate_cognition_contract — master cognition contract (fixed)
--     Tries real deterministic computation first; falls back to connection-status
--     estimates only when data is insufficient.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ic_generate_cognition_contract(
  p_tenant_id UUID,
  p_tab TEXT DEFAULT 'overview'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evidence JSONB;
  v_confidence JSONB;
  v_propagation JSONB;
  v_active_risks TEXT[] := '{}';
  v_system_state TEXT := 'STABLE';
  v_composite_risk FLOAT := 0;
  v_instability_indices JSONB;
  v_risk_result JSONB;
  v_crm_connected BOOLEAN := false;
  v_accounting_connected BOOLEAN := false;
  v_email_connected BOOLEAN := false;
  v_tab_data JSONB := '{}';
BEGIN
  -- Resolve integration status
  SELECT EXISTS(
    SELECT 1 FROM integration_health
    WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND provider ILIKE '%crm%'
  ) INTO v_crm_connected;

  SELECT EXISTS(
    SELECT 1 FROM integration_health
    WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND provider ILIKE '%accounting%'
  ) INTO v_accounting_connected;

  SELECT EXISTS(
    SELECT 1 FROM integration_health
    WHERE tenant_id = p_tenant_id AND status = 'CONNECTED'
      AND (provider ILIKE '%email%' OR provider ILIKE '%gmail%' OR provider ILIKE '%outlook%')
  ) INTO v_email_connected;

  -- Assemble supporting data
  v_evidence := fn_assemble_evidence_pack(p_tenant_id, p_tab);
  v_confidence := fn_recalibrate_confidence(p_tenant_id);

  -- Determine active risk domains
  IF NOT v_crm_connected THEN v_active_risks := v_active_risks || ARRAY['revenue']; END IF;
  IF NOT v_accounting_connected THEN v_active_risks := v_active_risks || ARRAY['finance']; END IF;
  IF NOT v_email_connected THEN v_active_risks := v_active_risks || ARRAY['people']; END IF;

  v_propagation := fn_compute_propagation_map(p_tenant_id, v_active_risks);

  -- ═══ INSTABILITY INDICES — try real deterministic computation first ═══
  v_risk_result := NULL;
  BEGIN
    v_risk_result := ic_calculate_risk_baseline_deterministic(p_tenant_id);
  EXCEPTION WHEN OTHERS THEN
    v_risk_result := NULL;
  END;

  IF v_risk_result IS NOT NULL AND (v_risk_result->>'status') = 'computed' THEN
    v_instability_indices := v_risk_result->'indices';
    v_composite_risk := (v_risk_result->'composite'->>'risk_score')::float;

    v_system_state := CASE (v_risk_result->'composite'->>'risk_band')
      WHEN 'HIGH'     THEN 'CRITICAL'
      WHEN 'MODERATE' THEN 'COMPRESSION'
      ELSE 'STABLE'
    END;
  ELSE
    -- Fallback: connection-status estimates with nuanced values
    v_instability_indices := jsonb_build_object(
      'revenue_volatility_index', CASE
        WHEN v_crm_connected THEN 0.18
        ELSE 0.55
      END,
      'engagement_decay_score', CASE
        WHEN v_email_connected AND v_crm_connected THEN 0.12
        WHEN v_email_connected THEN 0.22
        ELSE 0.48
      END,
      'cash_deviation_ratio', CASE
        WHEN v_accounting_connected THEN 0.10
        ELSE 0.52
      END,
      'anomaly_density_score', CASE
        WHEN v_crm_connected AND v_accounting_connected THEN 0.10
        WHEN v_crm_connected OR v_accounting_connected THEN 0.25
        ELSE 0.40
      END
    );

    v_composite_risk := (
      ((v_instability_indices->>'revenue_volatility_index')::float * 0.30) +
      ((v_instability_indices->>'engagement_decay_score')::float * 0.25) +
      ((v_instability_indices->>'cash_deviation_ratio')::float * 0.30) +
      ((v_instability_indices->>'anomaly_density_score')::float * 0.15)
    );

    v_system_state := CASE
      WHEN v_composite_risk > 0.7  THEN 'CRITICAL'
      WHEN v_composite_risk > 0.5  THEN 'COMPRESSION'
      WHEN v_composite_risk > 0.3  THEN 'DRIFT'
      ELSE 'STABLE'
    END;
  END IF;

  -- ═══ TAB-SPECIFIC DATA ═══
  CASE p_tab
    WHEN 'revenue' THEN
      v_tab_data := jsonb_build_object(
        'crm_required', NOT v_crm_connected,
        'pipeline_health', CASE WHEN v_crm_connected THEN 'connected' ELSE 'disconnected' END
      );
    WHEN 'risk' THEN
      v_tab_data := jsonb_build_object(
        'accounting_required', NOT v_accounting_connected,
        'risk_level', CASE
          WHEN v_composite_risk > 0.6 THEN 'high'
          WHEN v_composite_risk > 0.3 THEN 'medium'
          ELSE 'low'
        END
      );
    WHEN 'operations' THEN
      v_tab_data := jsonb_build_object(
        'crm_required', NOT v_crm_connected,
        'operational_load', 'nominal'
      );
    WHEN 'people' THEN
      v_tab_data := jsonb_build_object(
        'email_required', NOT v_email_connected,
        'capacity', CASE WHEN v_email_connected THEN 'available' ELSE 'requires_email' END
      );
    ELSE
      v_tab_data := jsonb_build_object(
        'integrations_connected', (
          CASE WHEN v_crm_connected THEN 1 ELSE 0 END +
          CASE WHEN v_accounting_connected THEN 1 ELSE 0 END +
          CASE WHEN v_email_connected THEN 1 ELSE 0 END
        )
      );
  END CASE;

  RETURN jsonb_build_object(
    'status', 'computed',
    'tab', p_tab,
    'tenant_id', p_tenant_id,
    'system_state', v_system_state,
    'composite_risk_score', v_composite_risk,
    'instability_indices', v_instability_indices,
    'propagation_map', v_propagation,
    'confidence_score', (v_confidence->>'confidence_score')::float,
    'evidence_count', (v_evidence->>'evidence_count')::int,
    'evidence_quality', (v_evidence->>'quality_score')::float,
    'tab_data', v_tab_data,
    'integrations', jsonb_build_object(
      'crm', v_crm_connected,
      'accounting', v_accounting_connected,
      'email', v_email_connected
    ),
    'computed_at', now(),
    'model_version', 'v1.1-recovered'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION ic_generate_cognition_contract(UUID, TEXT) TO authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════════════════
-- §5  fn_evaluate_pending_checkpoints — real predicted-vs-actual comparison
--     Replaces the 045 stub that auto-approved everything with variance_delta = 0.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_evaluate_pending_checkpoints(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evaluated INTEGER := 0;
  v_skipped INTEGER := 0;
  r RECORD;
  v_decision RECORD;
  v_risk_result JSONB;
  v_actual_composite FLOAT;
  v_predicted_composite FLOAT;
  v_snapshot_composite FLOAT;
  v_variance FLOAT;
  v_effective BOOLEAN;
  v_actual_indices JSONB;
BEGIN
  FOR r IN
    SELECT oc.id AS checkpoint_id,
           oc.decision_id,
           oc.predicted_instability
    FROM   outcome_checkpoints oc
    WHERE  oc.tenant_id = p_tenant_id
      AND  oc.status = 'pending'
      AND  oc.scheduled_at <= now()
    LIMIT 20
  LOOP
    -- Fetch the associated decision's predictions
    BEGIN
      SELECT cd.expected_instability_change,
             cd.instability_snapshot_at_time,
             cd.affected_domains
      INTO   v_decision
      FROM   cognition_decisions cd
      WHERE  cd.id = r.decision_id;
    EXCEPTION WHEN OTHERS THEN
      v_decision := NULL;
    END;

    -- Get current actual instability
    v_risk_result := NULL;
    BEGIN
      v_risk_result := ic_calculate_risk_baseline_deterministic(p_tenant_id);
    EXCEPTION WHEN OTHERS THEN
      v_risk_result := NULL;
    END;

    IF v_risk_result IS NOT NULL AND (v_risk_result->>'status') = 'computed' THEN
      v_actual_composite := (v_risk_result->'composite'->>'risk_score')::float;
      v_actual_indices := v_risk_result->'indices';

      -- Extract the snapshot composite that was stored when the decision was created
      v_snapshot_composite := COALESCE(
        (v_decision.instability_snapshot_at_time->>'composite_risk_score')::float,
        v_actual_composite
      );

      -- Extract predicted change magnitude
      v_predicted_composite := COALESCE(
        (v_decision.expected_instability_change->>'predicted_composite_delta')::float,
        0
      );

      -- Variance = how far the actual change deviated from the predicted change
      v_variance := ABS(
        (v_actual_composite - v_snapshot_composite) - v_predicted_composite
      );

      -- Decision is effective if instability actually moved in the predicted direction
      v_effective := (v_actual_composite <= v_snapshot_composite)
        OR (v_variance < 0.15);

      UPDATE outcome_checkpoints
      SET    status = 'evaluated',
             evaluated_at = now(),
             decision_effective = v_effective,
             variance_delta = ROUND(v_variance::NUMERIC, 4),
             actual_instability = jsonb_build_object(
               'composite_risk_score', v_actual_composite,
               'indices', v_actual_indices,
               'evaluated_by', '063_recovery'
             )
      WHERE  id = r.checkpoint_id;

      v_evaluated := v_evaluated + 1;
    ELSE
      -- No actual data available — skip instead of fake-approving
      UPDATE outcome_checkpoints
      SET    status = 'skipped',
             evaluated_at = now(),
             decision_effective = NULL,
             variance_delta = NULL,
             actual_instability = jsonb_build_object(
               'reason', 'insufficient_data_for_evaluation',
               'risk_status', COALESCE(v_risk_result->>'status', 'unavailable'),
               'evaluated_by', '063_recovery'
             )
      WHERE  id = r.checkpoint_id;

      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'evaluated_count', v_evaluated,
    'skipped_count', v_skipped,
    'evaluated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_evaluate_pending_checkpoints(UUID) TO authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════════════════
-- §6  fn_snapshot_daily_instability — reads real computed risk data
--     Replaces the 045 stub that always wrote zeros.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_snapshot_daily_instability(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_risk_result JSONB;
  v_composite FLOAT := 0;
  v_system_state TEXT := 'UNKNOWN';
  v_confidence_result JSONB;
  v_confidence_score FLOAT := 0.5;
  v_evidence_count INT := 0;
  v_rvi FLOAT := 0;
  v_eds FLOAT := 0;
  v_cdr FLOAT := 0;
BEGIN
  -- Try real deterministic risk computation
  BEGIN
    v_risk_result := ic_calculate_risk_baseline_deterministic(p_tenant_id);
  EXCEPTION WHEN OTHERS THEN
    v_risk_result := NULL;
  END;

  IF v_risk_result IS NOT NULL AND (v_risk_result->>'status') = 'computed' THEN
    v_composite := (v_risk_result->'composite'->>'risk_score')::float;
    v_rvi := COALESCE((v_risk_result->'indices'->>'revenue_volatility_index')::float, 0);
    v_eds := COALESCE((v_risk_result->'indices'->>'engagement_decay_score')::float, 0);
    v_cdr := COALESCE((v_risk_result->'indices'->>'cash_deviation_ratio')::float, 0);

    v_system_state := CASE (v_risk_result->'composite'->>'risk_band')
      WHEN 'HIGH'     THEN 'CRITICAL'
      WHEN 'MODERATE' THEN 'ELEVATED'
      ELSE 'STABLE'
    END;
  END IF;

  -- Get confidence from recalibration
  BEGIN
    v_confidence_result := fn_recalibrate_confidence(p_tenant_id);
    v_confidence_score := COALESCE((v_confidence_result->>'confidence_score')::float, 0.5);
  EXCEPTION WHEN OTHERS THEN
    v_confidence_score := 0.5;
  END;

  -- Count recent observation events as evidence
  BEGIN
    SELECT COUNT(*) INTO v_evidence_count
    FROM   observation_events
    WHERE  user_id = p_tenant_id
      AND  observed_at >= NOW() - INTERVAL '7 days';
  EXCEPTION WHEN OTHERS THEN
    v_evidence_count := 0;
  END;

  -- Upsert: ON CONFLICT DO UPDATE so re-runs within the same day refresh the data
  INSERT INTO instability_snapshots (
    tenant_id, snapshot_date,
    composite_risk_score, system_state,
    confidence_score, evidence_count,
    revenue_volatility_index, engagement_decay_score, cash_deviation_ratio
  ) VALUES (
    p_tenant_id, CURRENT_DATE,
    v_composite, v_system_state,
    v_confidence_score, v_evidence_count,
    v_rvi, v_eds, v_cdr
  )
  ON CONFLICT (tenant_id, snapshot_date) DO UPDATE SET
    composite_risk_score     = EXCLUDED.composite_risk_score,
    system_state             = EXCLUDED.system_state,
    confidence_score         = EXCLUDED.confidence_score,
    evidence_count           = EXCLUDED.evidence_count,
    revenue_volatility_index = EXCLUDED.revenue_volatility_index,
    engagement_decay_score   = EXCLUDED.engagement_decay_score,
    cash_deviation_ratio     = EXCLUDED.cash_deviation_ratio;

  RETURN jsonb_build_object(
    'status', 'snapshotted',
    'date', CURRENT_DATE,
    'composite_risk_score', v_composite,
    'system_state', v_system_state,
    'confidence_score', v_confidence_score,
    'evidence_count', v_evidence_count,
    'source', CASE
      WHEN v_risk_result IS NOT NULL AND (v_risk_result->>'status') = 'computed'
      THEN 'deterministic_engine'
      ELSE 'defaults_insufficient_data'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_snapshot_daily_instability(UUID) TO authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════════════════
-- §7  fn_assemble_evidence_pack — queries REAL data from business_core + events
--     Replaces the 045 stub that returned static JSON labels.
--     All business_core queries are wrapped in exception handlers so
--     environments without that schema do not crash.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_assemble_evidence_pack(
  p_tenant_id UUID,
  p_tab TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evidence JSONB := '[]';
  v_count INTEGER := 0;
  v_quality FLOAT := 0.0;
  v_crm_connected BOOLEAN := false;
  v_accounting_connected BOOLEAN := false;
  v_email_connected BOOLEAN := false;

  -- Revenue vars
  v_deal_count INT := 0;
  v_deal_total NUMERIC := 0;
  v_deal_latest TIMESTAMPTZ;
  v_revenue_signals INT := 0;

  -- Risk vars
  v_overdue_invoices INT := 0;
  v_total_invoices INT := 0;
  v_risk_indices JSONB;

  -- Operations vars
  v_task_total INT := 0;
  v_task_overdue INT := 0;
  v_ops_signals INT := 0;

  -- People vars
  v_email_accounts INT := 0;
  v_calendar_signals INT := 0;

  v_data_age_hours FLOAT := 999;
  v_tmp_ts TIMESTAMPTZ;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM integration_health
    WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND provider ILIKE '%crm%'
  ) INTO v_crm_connected;

  SELECT EXISTS(
    SELECT 1 FROM integration_health
    WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND provider ILIKE '%accounting%'
  ) INTO v_accounting_connected;

  SELECT EXISTS(
    SELECT 1 FROM integration_health
    WHERE tenant_id = p_tenant_id AND status = 'CONNECTED'
      AND (provider ILIKE '%email%' OR provider ILIKE '%gmail%' OR provider ILIKE '%outlook%')
  ) INTO v_email_connected;

  CASE p_tab

    -- ═══ REVENUE TAB ═══
    WHEN 'revenue' THEN
      -- Query business_core.deals (may not exist in all environments)
      BEGIN
        SELECT COUNT(*),
               COALESCE(SUM(amount), 0),
               MAX(updated_at)
        INTO   v_deal_count, v_deal_total, v_deal_latest
        FROM   business_core.deals
        WHERE  tenant_id = p_tenant_id
          AND  deleted_at IS NULL
          AND  status != 'lost';
      EXCEPTION WHEN OTHERS THEN
        v_deal_count := 0; v_deal_total := 0; v_deal_latest := NULL;
      END;

      -- Revenue-domain observation events
      BEGIN
        SELECT COUNT(*) INTO v_revenue_signals
        FROM   observation_events
        WHERE  user_id = p_tenant_id
          AND  domain IN ('finance', 'sales')
          AND  observed_at >= NOW() - INTERVAL '14 days';
      EXCEPTION WHEN OTHERS THEN
        v_revenue_signals := 0;
      END;

      v_count := v_deal_count + v_revenue_signals;
      IF v_deal_latest IS NOT NULL THEN
        v_data_age_hours := EXTRACT(EPOCH FROM (now() - v_deal_latest)) / 3600.0;
      END IF;

      v_quality := CASE
        WHEN v_crm_connected AND v_deal_count > 0 AND v_data_age_hours < 48 THEN 0.85
        WHEN v_crm_connected AND v_deal_count > 0 THEN 0.65
        WHEN v_revenue_signals > 0 THEN 0.35
        ELSE 0.10
      END;

      v_evidence := jsonb_build_array(
        jsonb_build_object(
          'type', 'crm_deals',
          'deal_count', v_deal_count,
          'total_pipeline_value', v_deal_total,
          'latest_update', v_deal_latest,
          'weight', 0.8
        ),
        jsonb_build_object(
          'type', 'revenue_signals',
          'signal_count', v_revenue_signals,
          'window', '14 days',
          'weight', 0.6
        )
      );

    -- ═══ RISK TAB ═══
    WHEN 'risk' THEN
      -- Query business_core.invoices for overdue
      BEGIN
        SELECT COUNT(*) FILTER (WHERE due_date < now() AND status NOT IN ('paid', 'voided')),
               COUNT(*)
        INTO   v_overdue_invoices, v_total_invoices
        FROM   business_core.invoices
        WHERE  tenant_id = p_tenant_id
          AND  deleted_at IS NULL;
      EXCEPTION WHEN OTHERS THEN
        v_overdue_invoices := 0; v_total_invoices := 0;
      END;

      -- Get current instability indices if available
      BEGIN
        v_risk_indices := (ic_calculate_risk_baseline_deterministic(p_tenant_id))->'indices';
      EXCEPTION WHEN OTHERS THEN
        v_risk_indices := NULL;
      END;

      v_count := v_total_invoices + CASE WHEN v_risk_indices IS NOT NULL THEN 4 ELSE 0 END;

      v_quality := CASE
        WHEN v_accounting_connected AND v_total_invoices > 0 AND v_risk_indices IS NOT NULL THEN 0.90
        WHEN v_accounting_connected AND v_total_invoices > 0 THEN 0.70
        WHEN v_risk_indices IS NOT NULL THEN 0.50
        ELSE 0.20
      END;

      v_evidence := jsonb_build_array(
        jsonb_build_object(
          'type', 'invoice_health',
          'total_invoices', v_total_invoices,
          'overdue_count', v_overdue_invoices,
          'overdue_ratio', CASE WHEN v_total_invoices > 0
            THEN ROUND((v_overdue_invoices::NUMERIC / v_total_invoices), 4)
            ELSE 0 END,
          'weight', 0.9
        ),
        jsonb_build_object(
          'type', 'instability_indices',
          'indices', COALESCE(v_risk_indices, '{}'::jsonb),
          'computed', v_risk_indices IS NOT NULL,
          'weight', 0.8
        )
      );

    -- ═══ OPERATIONS TAB ═══
    WHEN 'operations' THEN
      -- Query business_core.tasks
      BEGIN
        SELECT COUNT(*),
               COUNT(*) FILTER (WHERE due_date < now() AND status NOT IN ('completed', 'cancelled'))
        INTO   v_task_total, v_task_overdue
        FROM   business_core.tasks
        WHERE  tenant_id = p_tenant_id
          AND  deleted_at IS NULL;
      EXCEPTION WHEN OTHERS THEN
        v_task_total := 0; v_task_overdue := 0;
      END;

      -- Operations-domain observation events
      BEGIN
        SELECT COUNT(*) INTO v_ops_signals
        FROM   observation_events
        WHERE  user_id = p_tenant_id
          AND  domain = 'operations'
          AND  observed_at >= NOW() - INTERVAL '14 days';
      EXCEPTION WHEN OTHERS THEN
        v_ops_signals := 0;
      END;

      v_count := v_task_total + v_ops_signals;

      v_quality := CASE
        WHEN v_crm_connected AND v_task_total > 0 THEN 0.75
        WHEN v_ops_signals > 3 THEN 0.45
        WHEN v_ops_signals > 0 THEN 0.30
        ELSE 0.10
      END;

      v_evidence := jsonb_build_array(
        jsonb_build_object(
          'type', 'task_health',
          'total_tasks', v_task_total,
          'overdue_tasks', v_task_overdue,
          'overdue_ratio', CASE WHEN v_task_total > 0
            THEN ROUND((v_task_overdue::NUMERIC / v_task_total), 4)
            ELSE 0 END,
          'weight', 0.8
        ),
        jsonb_build_object(
          'type', 'ops_signals',
          'signal_count', v_ops_signals,
          'window', '14 days',
          'weight', 0.6
        )
      );

    -- ═══ PEOPLE TAB ═══
    WHEN 'people' THEN
      -- Email connections
      BEGIN
        SELECT COUNT(*) INTO v_email_accounts
        FROM   email_connections
        WHERE  user_id = p_tenant_id
          AND  connected = true;
      EXCEPTION WHEN OTHERS THEN
        v_email_accounts := 0;
      END;

      -- Calendar / team domain observation events
      BEGIN
        SELECT COUNT(*) INTO v_calendar_signals
        FROM   observation_events
        WHERE  user_id = p_tenant_id
          AND  domain = 'team'
          AND  observed_at >= NOW() - INTERVAL '14 days';
      EXCEPTION WHEN OTHERS THEN
        v_calendar_signals := 0;
      END;

      v_count := v_email_accounts + v_calendar_signals;

      v_quality := CASE
        WHEN v_email_connected AND v_email_accounts > 0 AND v_calendar_signals > 0 THEN 0.75
        WHEN v_email_connected AND v_email_accounts > 0 THEN 0.55
        WHEN v_calendar_signals > 0 THEN 0.30
        ELSE 0.05
      END;

      v_evidence := jsonb_build_array(
        jsonb_build_object(
          'type', 'email_status',
          'connected_accounts', v_email_accounts,
          'email_integration', v_email_connected,
          'weight', 0.7
        ),
        jsonb_build_object(
          'type', 'team_signals',
          'signal_count', v_calendar_signals,
          'window', '14 days',
          'weight', 0.6
        )
      );

    -- ═══ DEFAULT / OVERVIEW ═══
    ELSE
      v_quality := 0.5;
      v_count := 1;
      v_evidence := jsonb_build_array(
        jsonb_build_object(
          'type', 'market_calibration',
          'weight', 0.5
        )
      );
  END CASE;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'tab', p_tab,
    'evidence_items', v_evidence,
    'evidence_count', v_count,
    'quality_score', v_quality,
    'assembled_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_assemble_evidence_pack(UUID, TEXT) TO authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════════════════════
-- §8  Verification comment
-- ═══════════════════════════════════════════════════════════════════════════════
-- To verify recovery, run:
--   SELECT ic_calculate_risk_baseline_deterministic('<tenant_uuid>');
--   SELECT ic_calculate_risk_baseline('<tenant_uuid>');
--   SELECT ic_generate_cognition_contract('<tenant_uuid>', 'overview');
--   SELECT fn_snapshot_daily_instability('<tenant_uuid>');
--   SELECT fn_evaluate_pending_checkpoints('<tenant_uuid>');
--   SELECT fn_assemble_evidence_pack('<tenant_uuid>', 'revenue');
-- ═══════════════════════════════════════════════════════════════════════════════
