-- ═══════════════════════════════════════════════════════════════
-- detect_contradictions(user_id) — SQL Function
-- Replaces: backend/contradiction_engine.py (251 lines Python)
-- Purpose: Detect misalignment between declared intent and observed behaviour
-- Called by: biqc-insights-cognitive Edge Function via RPC
-- Writes to: contradiction_memory table
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION detect_contradictions(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_contradictions JSON[];
  v_result JSON;
  v_count INT := 0;
  v_priority_record RECORD;
  v_escalation_record RECORD;
  v_action_record RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  v_contradictions := ARRAY[]::JSON[];

  -- ═══ CHECK 1: Priority Mismatch ═══
  -- User says domain X is priority but no action taken in 14+ days
  FOR v_priority_record IN
    SELECT dp.domain, dp.pressure_level, dp.window_days,
           COALESCE(
             (SELECT MAX(oe.observed_at) FROM observation_events oe
              WHERE oe.user_id = p_user_id AND oe.domain = dp.domain
              AND oe.observed_at > v_now - INTERVAL '14 days'),
             v_now - INTERVAL '30 days'
           ) AS last_activity
    FROM decision_pressure dp
    WHERE dp.user_id = p_user_id AND dp.active = true
      AND dp.pressure_level IN ('high', 'critical')
  LOOP
    IF v_priority_record.last_activity < v_now - INTERVAL '14 days' THEN
      v_contradictions := array_append(v_contradictions, json_build_object(
        'type', 'priority_mismatch',
        'domain', v_priority_record.domain,
        'observed_state', 'No action in ' || EXTRACT(DAY FROM v_now - v_priority_record.last_activity)::INT || ' days',
        'expected_state', v_priority_record.pressure_level || ' priority — should have action within ' || v_priority_record.window_days || ' days',
        'severity', CASE WHEN v_priority_record.pressure_level = 'critical' THEN 'high' ELSE 'medium' END,
        'times_detected', 1
      ));
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- ═══ CHECK 2: Repeated Ignore ═══
  -- Risk raised 3+ times but no resolution action taken
  FOR v_escalation_record IN
    SELECT em.domain, em.position, em.times_detected, em.pressure_level
    FROM escalation_memory em
    WHERE em.user_id = p_user_id AND em.active = true
      AND em.times_detected >= 3
      AND em.last_action_at IS NULL
  LOOP
    v_contradictions := array_append(v_contradictions, json_build_object(
      'type', 'repeated_ignore',
      'domain', v_escalation_record.domain,
      'observed_state', 'Risk raised ' || v_escalation_record.times_detected || ' times — no action taken',
      'expected_state', 'Acknowledged or resolved after first escalation',
      'severity', CASE WHEN v_escalation_record.times_detected >= 5 THEN 'high' ELSE 'medium' END,
      'times_detected', v_escalation_record.times_detected
    ));
    v_count := v_count + 1;
  END LOOP;

  -- ═══ CHECK 3: Action-Inaction Gap ═══
  -- User completed calibration declaring growth intent but pipeline is declining
  FOR v_action_record IN
    SELECT
      bp.growth_strategy,
      (SELECT COUNT(*) FROM observation_events oe
       WHERE oe.user_id = p_user_id AND oe.signal_name = 'pipeline_decay'
       AND oe.observed_at > v_now - INTERVAL '30 days') AS decay_signals
    FROM business_profiles bp
    WHERE bp.user_id = p_user_id
      AND bp.growth_strategy IS NOT NULL
      AND bp.growth_strategy != ''
    LIMIT 1
  LOOP
    IF v_action_record.decay_signals > 0 THEN
      v_contradictions := array_append(v_contradictions, json_build_object(
        'type', 'action_inaction',
        'domain', 'revenue',
        'observed_state', 'Pipeline declining — ' || v_action_record.decay_signals || ' decay signals in 30 days',
        'expected_state', 'Growth strategy declared: ' || LEFT(v_action_record.growth_strategy, 100),
        'severity', CASE WHEN v_action_record.decay_signals >= 3 THEN 'high' ELSE 'medium' END,
        'times_detected', v_action_record.decay_signals
      ));
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- ═══ PERSIST active contradictions ═══
  IF v_count > 0 THEN
    FOR i IN 1..array_length(v_contradictions, 1) LOOP
      INSERT INTO contradiction_memory (
        id, user_id, domain, observed_state, expected_state, times_detected, active, detected_at
      )
      VALUES (
        gen_random_uuid(),
        p_user_id,
        (v_contradictions[i]->>'domain'),
        (v_contradictions[i]->>'observed_state'),
        (v_contradictions[i]->>'expected_state'),
        COALESCE((v_contradictions[i]->>'times_detected')::INT, 1),
        true,
        v_now
      )
      ON CONFLICT (user_id, domain) WHERE active = true
      DO UPDATE SET
        observed_state = EXCLUDED.observed_state,
        expected_state = EXCLUDED.expected_state,
        times_detected = contradiction_memory.times_detected + 1,
        detected_at = v_now;
    END LOOP;
  END IF;

  v_result := json_build_object(
    'contradiction_count', v_count,
    'contradictions', to_json(v_contradictions),
    'checked_at', v_now::TEXT,
    'checks_performed', json_build_array('priority_mismatch', 'repeated_ignore', 'action_inaction')
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
