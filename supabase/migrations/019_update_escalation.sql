-- ═══════════════════════════════════════════════════════════════
-- update_escalation(user_id) — SQL Function
-- Replaces: backend/escalation_memory.py (186 lines Python)
-- Purpose: Track risk persistence, recurrence, and user action
-- Reads: watchtower_insights, escalation_memory
-- Writes: escalation_memory
--
-- Called by biqc-insights-cognitive AFTER detect_contradictions
-- and BEFORE calibrate_pressure (pressure depends on escalation data)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE escalation_memory ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'escalation_memory' AND policyname = 'Service role full access on escalation_memory') THEN
    CREATE POLICY "Service role full access on escalation_memory"
      ON escalation_memory FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'escalation_memory' AND policyname = 'Users read own escalation_memory') THEN
    CREATE POLICY "Users read own escalation_memory"
      ON escalation_memory FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_escalation(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_domain TEXT;
  v_domains TEXT[] := ARRAY['finance', 'sales', 'operations', 'team', 'market'];
  v_results JSON[];
  v_changes INT := 0;
  v_now TIMESTAMPTZ := now();
  v_position TEXT;
  v_existing RECORD;
BEGIN
  v_results := ARRAY[]::JSON[];

  FOREACH v_domain IN ARRAY v_domains LOOP
    -- Get latest watchtower position
    SELECT position INTO v_position
    FROM watchtower_insights
    WHERE user_id = p_user_id AND domain = v_domain
    ORDER BY detected_at DESC LIMIT 1;

    v_position := COALESCE(v_position, 'STABLE');

    -- Get active escalation for this domain
    SELECT * INTO v_existing
    FROM escalation_memory
    WHERE user_id = p_user_id AND domain = v_domain AND active = true
    LIMIT 1;

    IF v_position = 'STABLE' THEN
      -- Recovery: mark escalation resolved
      IF v_existing.id IS NOT NULL THEN
        UPDATE escalation_memory SET
          active = false,
          resolved_at = v_now,
          position = 'STABLE'
        WHERE id = v_existing.id;

        v_results := array_append(v_results, json_build_object(
          'domain', v_domain, 'action', 'resolved',
          'was_position', v_existing.position,
          'times_detected', v_existing.times_detected
        ));
        v_changes := v_changes + 1;
      END IF;
    ELSE
      -- Elevated position: create or increment escalation
      IF v_existing.id IS NOT NULL THEN
        UPDATE escalation_memory SET
          position = v_position,
          last_detected_at = v_now,
          times_detected = COALESCE(v_existing.times_detected, 0) + 1,
          pressure_level = CASE
            WHEN COALESCE(v_existing.times_detected, 0) >= 4 THEN 'critical'
            WHEN COALESCE(v_existing.times_detected, 0) >= 2 THEN 'high'
            ELSE 'medium'
          END
        WHERE id = v_existing.id;

        v_results := array_append(v_results, json_build_object(
          'domain', v_domain, 'action', 'incremented',
          'position', v_position,
          'times_detected', COALESCE(v_existing.times_detected, 0) + 1,
          'has_contradiction', v_existing.has_contradiction
        ));
        v_changes := v_changes + 1;
      ELSE
        INSERT INTO escalation_memory (
          id, user_id, domain, position, first_detected_at, last_detected_at,
          times_detected, last_user_action, pressure_level, active
        ) VALUES (
          gen_random_uuid(), p_user_id, v_domain, v_position, v_now, v_now,
          1, 'unknown', 'medium', true
        );

        v_results := array_append(v_results, json_build_object(
          'domain', v_domain, 'action', 'created',
          'position', v_position,
          'times_detected', 1
        ));
        v_changes := v_changes + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'changes', v_changes,
    'results', to_json(v_results),
    'updated_at', v_now::TEXT,
    'domains_checked', array_length(v_domains, 1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
