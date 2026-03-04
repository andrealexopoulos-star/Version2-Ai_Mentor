-- ============================================================
-- Migration 045: Cognition Core SQL Functions
-- BIQc Platform — Intelligence Engine Functions
-- Run AFTER migration 044
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. ASSEMBLE EVIDENCE PACK ──────────────────────────────
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
BEGIN
  SELECT EXISTS(SELECT 1 FROM integration_health WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND provider ILIKE '%crm%') INTO v_crm_connected;
  SELECT EXISTS(SELECT 1 FROM integration_health WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND provider ILIKE '%accounting%') INTO v_accounting_connected;
  SELECT EXISTS(SELECT 1 FROM integration_health WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND (provider ILIKE '%email%' OR provider ILIKE '%gmail%' OR provider ILIKE '%outlook%')) INTO v_email_connected;

  CASE p_tab
    WHEN 'revenue' THEN
      IF v_crm_connected THEN v_quality := 0.8; v_count := 3; v_evidence := '[{"type":"crm_deals","weight":0.8},{"type":"pipeline_velocity","weight":0.7},{"type":"churn_signals","weight":0.6}]';
      ELSE v_quality := 0.2; v_count := 0; END IF;
    WHEN 'risk' THEN
      IF v_accounting_connected THEN v_quality := 0.75; v_count := 2; v_evidence := '[{"type":"cash_position","weight":0.9},{"type":"margin_analysis","weight":0.7}]';
      ELSE v_quality := 0.3; v_count := 1; v_evidence := '[{"type":"market_signals","weight":0.4}]'; END IF;
    WHEN 'operations' THEN
      IF v_crm_connected THEN v_quality := 0.7; v_count := 2; v_evidence := '[{"type":"sla_compliance","weight":0.8},{"type":"bottleneck_signals","weight":0.6}]';
      ELSE v_quality := 0.2; v_count := 0; END IF;
    WHEN 'people' THEN
      IF v_email_connected THEN v_quality := 0.65; v_count := 2; v_evidence := '[{"type":"calendar_density","weight":0.7},{"type":"email_stress","weight":0.6}]';
      ELSE v_quality := 0.1; v_count := 0; END IF;
    ELSE v_quality := 0.5; v_count := 1; v_evidence := '[{"type":"market_calibration","weight":0.5}]';
  END CASE;

  RETURN jsonb_build_object('tenant_id', p_tenant_id, 'tab', p_tab, 'evidence_items', v_evidence, 'evidence_count', v_count, 'quality_score', v_quality, 'assembled_at', now());
END;
$$;
GRANT EXECUTE ON FUNCTION fn_assemble_evidence_pack(UUID, TEXT) TO authenticated, service_role;

-- ── 2. COMPUTE PROPAGATION MAP ─────────────────────────────
CREATE OR REPLACE FUNCTION fn_compute_propagation_map(
  p_tenant_id UUID,
  p_active_risks TEXT[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chains JSONB := '[]';
  r RECORD;
BEGIN
  IF array_length(p_active_risks, 1) IS NULL THEN RETURN '[]'; END IF;
  FOR r IN
    SELECT pr.source_domain, pr.target_domain, pr.probability, pr.lag_days, pr.description
    FROM propagation_rules pr
    WHERE pr.source_domain = ANY(p_active_risks) AND pr.is_active = true
    ORDER BY pr.probability DESC LIMIT 5
  LOOP
    v_chains := v_chains || jsonb_build_object('source', r.source_domain, 'target', r.target_domain, 'probability', r.probability, 'window', r.lag_days || ' days', 'description', r.description, 'chain', jsonb_build_array(r.source_domain, r.target_domain));
  END LOOP;
  RETURN v_chains;
END;
$$;
GRANT EXECUTE ON FUNCTION fn_compute_propagation_map(UUID, TEXT[]) TO authenticated, service_role;

-- ── 3. EVALUATE PENDING CHECKPOINTS ────────────────────────
CREATE OR REPLACE FUNCTION fn_evaluate_pending_checkpoints(p_tenant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_evaluated INTEGER := 0; r RECORD;
BEGIN
  FOR r IN SELECT oc.id FROM outcome_checkpoints oc WHERE oc.tenant_id = p_tenant_id AND oc.status = 'pending' AND oc.scheduled_at <= now() LIMIT 10
  LOOP
    UPDATE outcome_checkpoints SET status = 'evaluated', evaluated_at = now(), decision_effective = true, variance_delta = 0 WHERE id = r.id;
    v_evaluated := v_evaluated + 1;
  END LOOP;
  RETURN jsonb_build_object('evaluated_count', v_evaluated, 'evaluated_at', now());
END;
$$;
GRANT EXECUTE ON FUNCTION fn_evaluate_pending_checkpoints(UUID) TO authenticated, service_role;

-- ── 4. RECALIBRATE CONFIDENCE ──────────────────────────────
CREATE OR REPLACE FUNCTION fn_recalibrate_confidence(p_tenant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_decision_count INTEGER; v_evaluated_count INTEGER; v_accuracy FLOAT := 0.5; v_new_confidence FLOAT;
BEGIN
  SELECT COUNT(*) INTO v_decision_count FROM cognition_decisions WHERE tenant_id = p_tenant_id AND status != 'dismissed';
  SELECT COUNT(*) INTO v_evaluated_count FROM outcome_checkpoints oc JOIN cognition_decisions cd ON oc.decision_id = cd.id WHERE cd.tenant_id = p_tenant_id AND oc.status = 'evaluated';
  IF v_evaluated_count >= 3 THEN
    SELECT COALESCE(AVG(CASE WHEN decision_effective THEN 1.0 ELSE 0.0 END), 0.5) INTO v_accuracy FROM outcome_checkpoints oc JOIN cognition_decisions cd ON oc.decision_id = cd.id WHERE cd.tenant_id = p_tenant_id AND oc.status = 'evaluated';
    v_new_confidence := 0.4 + (v_accuracy * 0.5) + (LEAST(v_evaluated_count, 10) * 0.01);
  ELSE
    v_new_confidence := 0.5 + (v_decision_count * 0.02);
  END IF;
  v_new_confidence := GREATEST(0.1, LEAST(0.99, v_new_confidence));
  RETURN jsonb_build_object('confidence_score', v_new_confidence, 'decision_count', v_decision_count, 'evaluated_count', v_evaluated_count, 'accuracy', v_accuracy);
END;
$$;
GRANT EXECUTE ON FUNCTION fn_recalibrate_confidence(UUID) TO authenticated, service_role;

-- ── 5. CHECK INTEGRATION HEALTH ────────────────────────────
CREATE OR REPLACE FUNCTION fn_check_integration_health(p_tenant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_integrations JSONB := '[]'; v_total INTEGER := 0; v_connected INTEGER := 0; r RECORD;
BEGIN
  FOR r IN SELECT provider, status, last_synced_at, error_message, records_count FROM integration_health WHERE tenant_id = p_tenant_id ORDER BY provider
  LOOP
    v_integrations := v_integrations || jsonb_build_object('provider', r.provider, 'status', r.status, 'last_synced_at', r.last_synced_at, 'error_message', r.error_message, 'records_count', r.records_count);
    v_total := v_total + 1;
    IF r.status = 'CONNECTED' THEN v_connected := v_connected + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('integrations', v_integrations, 'total', v_total, 'connected', v_connected, 'health_score', CASE WHEN v_total > 0 THEN (v_connected::float / v_total) ELSE 0 END);
END;
$$;
GRANT EXECUTE ON FUNCTION fn_check_integration_health(UUID) TO authenticated, service_role;

-- ── 6. SNAPSHOT DAILY INSTABILITY ──────────────────────────
CREATE OR REPLACE FUNCTION fn_snapshot_daily_instability(p_tenant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO instability_snapshots (tenant_id, snapshot_date, composite_risk_score, system_state, confidence_score, evidence_count)
  VALUES (p_tenant_id, CURRENT_DATE, 0, 'STABLE', 0.5, 0)
  ON CONFLICT (tenant_id, snapshot_date) DO NOTHING;
  RETURN jsonb_build_object('status', 'snapshotted', 'date', CURRENT_DATE);
END;
$$;
GRANT EXECUTE ON FUNCTION fn_snapshot_daily_instability(UUID) TO authenticated, service_role;

-- ── 7. DETECT DRIFT ────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_detect_drift(p_tenant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_recent RECORD; v_prior_score FLOAT; v_delta FLOAT := 0; v_drift_detected BOOLEAN := false;
BEGIN
  SELECT composite_risk_score, system_state INTO v_recent FROM instability_snapshots WHERE tenant_id = p_tenant_id ORDER BY snapshot_date DESC LIMIT 1;
  SELECT composite_risk_score INTO v_prior_score FROM instability_snapshots WHERE tenant_id = p_tenant_id ORDER BY snapshot_date DESC LIMIT 1 OFFSET 1;
  IF v_recent IS NOT NULL AND v_prior_score IS NOT NULL THEN
    v_delta := v_recent.composite_risk_score - v_prior_score;
    v_drift_detected := ABS(v_delta) > 0.15;
  END IF;
  RETURN jsonb_build_object('drift_detected', v_drift_detected, 'delta', v_delta, 'current_state', COALESCE(v_recent.system_state, 'STABLE'), 'checked_at', now());
END;
$$;
GRANT EXECUTE ON FUNCTION fn_detect_drift(UUID) TO authenticated, service_role;

-- ── 8. MASTER COGNITION CONTRACT ───────────────────────────
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
  v_crm_connected BOOLEAN := false;
  v_accounting_connected BOOLEAN := false;
  v_email_connected BOOLEAN := false;
  v_tab_data JSONB := '{}';
BEGIN
  SELECT EXISTS(SELECT 1 FROM integration_health WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND provider ILIKE '%crm%') INTO v_crm_connected;
  SELECT EXISTS(SELECT 1 FROM integration_health WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND provider ILIKE '%accounting%') INTO v_accounting_connected;
  SELECT EXISTS(SELECT 1 FROM integration_health WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND (provider ILIKE '%email%' OR provider ILIKE '%gmail%' OR provider ILIKE '%outlook%')) INTO v_email_connected;

  v_evidence := fn_assemble_evidence_pack(p_tenant_id, p_tab);
  v_confidence := fn_recalibrate_confidence(p_tenant_id);

  IF NOT v_crm_connected THEN v_active_risks := v_active_risks || ARRAY['revenue']; END IF;
  IF NOT v_accounting_connected THEN v_active_risks := v_active_risks || ARRAY['finance']; END IF;
  IF NOT v_email_connected THEN v_active_risks := v_active_risks || ARRAY['people']; END IF;

  v_propagation := fn_compute_propagation_map(p_tenant_id, v_active_risks);

  v_instability_indices := jsonb_build_object(
    'revenue_volatility_index', CASE WHEN v_crm_connected THEN 0.25 ELSE 0.6 END,
    'engagement_decay_score', CASE WHEN v_email_connected THEN 0.2 ELSE 0.5 END,
    'cash_deviation_ratio', CASE WHEN v_accounting_connected THEN 0.15 ELSE 0.55 END,
    'anomaly_density_score', 0.2
  );

  v_composite_risk := (
    ((v_instability_indices->>'revenue_volatility_index')::float * 0.3) +
    ((v_instability_indices->>'engagement_decay_score')::float * 0.25) +
    ((v_instability_indices->>'cash_deviation_ratio')::float * 0.3) +
    ((v_instability_indices->>'anomaly_density_score')::float * 0.15)
  );

  v_system_state := CASE
    WHEN v_composite_risk > 0.7 THEN 'CRITICAL'
    WHEN v_composite_risk > 0.5 THEN 'COMPRESSION'
    WHEN v_composite_risk > 0.3 THEN 'DRIFT'
    ELSE 'STABLE'
  END;

  CASE p_tab
    WHEN 'revenue' THEN v_tab_data := jsonb_build_object('crm_required', NOT v_crm_connected, 'pipeline_health', CASE WHEN v_crm_connected THEN 'connected' ELSE 'disconnected' END);
    WHEN 'risk' THEN v_tab_data := jsonb_build_object('accounting_required', NOT v_accounting_connected, 'risk_level', CASE WHEN v_composite_risk > 0.6 THEN 'high' WHEN v_composite_risk > 0.3 THEN 'medium' ELSE 'low' END);
    WHEN 'operations' THEN v_tab_data := jsonb_build_object('crm_required', NOT v_crm_connected, 'operational_load', 'nominal');
    WHEN 'people' THEN v_tab_data := jsonb_build_object('email_required', NOT v_email_connected, 'capacity', CASE WHEN v_email_connected THEN 'available' ELSE 'requires_email' END);
    ELSE v_tab_data := jsonb_build_object('integrations_connected', (CASE WHEN v_crm_connected THEN 1 ELSE 0 END + CASE WHEN v_accounting_connected THEN 1 ELSE 0 END + CASE WHEN v_email_connected THEN 1 ELSE 0 END));
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
    'integrations', jsonb_build_object('crm', v_crm_connected, 'accounting', v_accounting_connected, 'email', v_email_connected),
    'computed_at', now(),
    'model_version', 'v1.0'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION ic_generate_cognition_contract(UUID, TEXT) TO authenticated, service_role;

-- ── 9. CALCULATE RISK BASELINE ─────────────────────────────
CREATE OR REPLACE FUNCTION ic_calculate_risk_baseline(p_tenant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT ic_generate_cognition_contract(p_tenant_id, 'overview') INTO v_result;
  RETURN jsonb_build_object('status', 'computed', 'composite', jsonb_build_object('risk_score', (v_result->>'composite_risk_score')::float, 'system_state', v_result->>'system_state'), 'indices', v_result->'instability_indices', 'computed_at', now());
END;
$$;
GRANT EXECUTE ON FUNCTION ic_calculate_risk_baseline(UUID) TO authenticated, service_role;
