-- ═══════════════════════════════════════════════════════════════
-- calibrate_pressure(user_id) — SQL Function
-- Replaces: backend/pressure_calibration.py (300 lines Python)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS decision_pressure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  pressure_level TEXT NOT NULL CHECK (pressure_level IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')),
  window_days INT,
  first_applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  basis JSONB NOT NULL DEFAULT '{}'::JSONB,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_pressure_user_active
  ON decision_pressure(user_id, active, domain);

CREATE UNIQUE INDEX IF NOT EXISTS uq_decision_pressure_user_domain_active
  ON decision_pressure(user_id, domain)
  WHERE active = true;

ALTER TABLE decision_pressure ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'decision_pressure' AND policyname = 'Service role full access on decision_pressure') THEN
    CREATE POLICY "Service role full access on decision_pressure"
      ON decision_pressure FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'decision_pressure' AND policyname = 'Users read own decision_pressure') THEN
    CREATE POLICY "Users read own decision_pressure"
      ON decision_pressure FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION calibrate_pressure(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_domain TEXT;
  v_domains TEXT[] := ARRAY['finance', 'sales', 'operations', 'team', 'market'];
  v_results JSON[];
  v_score INT;
  v_target_level TEXT;
  v_current RECORD;
  v_position TEXT;
  v_esc_times INT;
  v_esc_action TEXT;
  v_contra_count INT;
  v_risk_posture TEXT;
  v_now TIMESTAMPTZ := now();
  v_window_days INT;
  v_changes INT := 0;
BEGIN
  v_results := ARRAY[]::JSON[];
  SELECT COALESCE((operator_profile->>'risk_posture'),(operator_profile->'forensic_calibration'->>'risk_profile'),'moderate') INTO v_risk_posture FROM user_operator_profile WHERE user_id = p_user_id;
  v_risk_posture := LOWER(COALESCE(v_risk_posture, 'moderate'));

  FOREACH v_domain IN ARRAY v_domains LOOP
    v_score := 0;
    SELECT position INTO v_position FROM watchtower_insights WHERE user_id = p_user_id AND domain = v_domain ORDER BY detected_at DESC LIMIT 1;
    v_position := COALESCE(v_position, 'STABLE');
    v_score := v_score + CASE v_position WHEN 'ELEVATED' THEN 1 WHEN 'DETERIORATING' THEN 2 WHEN 'CRITICAL' THEN 3 ELSE 0 END;

    SELECT COALESCE(times_detected, 0), COALESCE(last_user_action, 'unknown') INTO v_esc_times, v_esc_action FROM escalation_memory WHERE user_id = p_user_id AND domain = v_domain AND active = true LIMIT 1;
    v_esc_times := COALESCE(v_esc_times, 0); v_esc_action := COALESCE(v_esc_action, 'unknown');
    IF v_esc_times >= 5 THEN v_score := v_score + 2; ELSIF v_esc_times >= 3 THEN v_score := v_score + 1; END IF;
    IF v_esc_action IN ('ignored', 'deferred') THEN v_score := v_score + 1; END IF;

    SELECT COUNT(*) INTO v_contra_count FROM contradiction_memory WHERE user_id = p_user_id AND domain = v_domain AND active = true;
    IF v_contra_count >= 3 THEN v_score := v_score + 2; ELSIF v_contra_count >= 1 THEN v_score := v_score + 1; END IF;

    IF v_risk_posture IN ('aggressive', 'high') THEN v_score := GREATEST(v_score - 1, 0); END IF;

    v_target_level := CASE WHEN v_score >= 6 THEN 'CRITICAL' WHEN v_score >= 4 THEN 'HIGH' WHEN v_score >= 2 THEN 'MODERATE' ELSE 'LOW' END;
    v_window_days := CASE v_target_level WHEN 'CRITICAL' THEN 3 WHEN 'HIGH' THEN 7 WHEN 'MODERATE' THEN 14 ELSE NULL END;

    SELECT * INTO v_current FROM decision_pressure WHERE user_id = p_user_id AND domain = v_domain AND active = true LIMIT 1;

    IF v_position = 'STABLE' AND v_current.id IS NOT NULL THEN
      UPDATE decision_pressure SET active = false, last_updated_at = v_now WHERE id = v_current.id;
      v_results := array_append(v_results, json_build_object('domain', v_domain, 'action', 'decayed', 'from', v_current.pressure_level, 'to', 'INACTIVE'));
      v_changes := v_changes + 1; CONTINUE;
    END IF;

    IF v_target_level = 'LOW' AND v_current.id IS NULL THEN CONTINUE; END IF;

    IF v_current.id IS NOT NULL THEN
      DECLARE
        v_current_idx INT := array_position(ARRAY['LOW','MODERATE','HIGH','CRITICAL'], v_current.pressure_level);
        v_target_idx INT := array_position(ARRAY['LOW','MODERATE','HIGH','CRITICAL'], v_target_level);
      BEGIN
        IF v_target_idx <= v_current_idx THEN CONTINUE; END IF;
        UPDATE decision_pressure SET pressure_level = v_target_level,
          window_days = CASE WHEN v_current.window_days IS NOT NULL AND v_current.window_days < v_window_days THEN v_current.window_days ELSE v_window_days END,
          last_updated_at = v_now,
          basis = COALESCE(v_current.basis, '{}'::JSONB) || jsonb_build_object('updated_at', v_now::TEXT, 'from', v_current.pressure_level, 'to', v_target_level, 'score', v_score)
        WHERE id = v_current.id;
        v_results := array_append(v_results, json_build_object('domain', v_domain, 'action', 'increased', 'from', v_current.pressure_level, 'to', v_target_level, 'score', v_score));
        v_changes := v_changes + 1;
      END;
    ELSE
      IF v_target_level != 'LOW' THEN
        INSERT INTO decision_pressure (id, user_id, domain, pressure_level, window_days, first_applied_at, last_updated_at, basis, active)
        VALUES (gen_random_uuid(), p_user_id, v_domain, v_target_level, v_window_days, v_now, v_now, jsonb_build_object('created_at', v_now::TEXT, 'initial_score', v_score, 'position', v_position), true);
        v_results := array_append(v_results, json_build_object('domain', v_domain, 'action', 'created', 'level', v_target_level, 'score', v_score));
        v_changes := v_changes + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN json_build_object('changes', v_changes, 'results', to_json(v_results), 'calibrated_at', v_now::TEXT, 'risk_posture', v_risk_posture, 'domains_checked', array_length(v_domains, 1));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
