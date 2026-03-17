-- ═══════════════════════════════════════════════════════════════
-- detect_contradictions(user_id) — SQL Function
-- Replaces: backend/contradiction_engine.py (251 lines Python)
-- Purpose: Detect misalignment between declared intent and observed behaviour
-- Called by: biqc-insights-cognitive Edge Function via RPC
-- Writes to: contradiction_memory table
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS observation_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL CHECK (domain IN ('finance', 'sales', 'operations', 'team', 'market')),
  event_type TEXT NOT NULL,
  signal_name TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  source TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  confidence NUMERIC(6,4),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obs_events_user_domain_time
  ON observation_events (user_id, domain, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_events_user_time
  ON observation_events (user_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS watchtower_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL CHECK (domain IN ('finance', 'sales', 'operations', 'team', 'market')),
  position TEXT NOT NULL CHECK (position IN ('STABLE', 'ELEVATED', 'DETERIORATING', 'CRITICAL')),
  previous_position TEXT,
  finding TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.000 CHECK (confidence >= 0 AND confidence <= 1),
  source_event_ids UUID[] DEFAULT '{}',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wt_insights_latest
  ON watchtower_insights (user_id, domain, detected_at DESC);

CREATE TABLE IF NOT EXISTS escalation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL CHECK (domain IN ('finance', 'sales', 'operations', 'team', 'market')),
  position TEXT NOT NULL DEFAULT 'STABLE' CHECK (position IN ('STABLE', 'ELEVATED', 'DETERIORATING', 'CRITICAL')),
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  times_detected INT NOT NULL DEFAULT 1,
  last_user_action TEXT DEFAULT 'unknown',
  last_action_at TIMESTAMPTZ,
  pressure_level TEXT DEFAULT 'medium' CHECK (pressure_level IN ('low', 'medium', 'high', 'critical', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL')),
  has_contradiction BOOLEAN NOT NULL DEFAULT false,
  last_boardroom_exposed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_escalation_memory_user_domain_active
  ON escalation_memory(user_id, domain)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_escalation_memory_user_active
  ON escalation_memory(user_id, active, domain);

CREATE TABLE IF NOT EXISTS contradiction_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL CHECK (domain IN ('finance', 'sales', 'operations', 'team', 'market', 'revenue')),
  declared_priority TEXT,
  observed_state TEXT,
  expected_state TEXT,
  contradiction_type TEXT NOT NULL CHECK (contradiction_type IN ('priority_mismatch', 'action_inaction', 'repeated_ignore')),
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  times_detected INT NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contradiction_memory_user_domain_active
  ON contradiction_memory(user_id, domain)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_contradiction_memory_user_active
  ON contradiction_memory(user_id, active, domain, contradiction_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON observation_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON observation_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON watchtower_insights TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON watchtower_insights TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON escalation_memory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON escalation_memory TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON contradiction_memory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON contradiction_memory TO service_role;

ALTER TABLE observation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchtower_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE contradiction_memory ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'observation_events' AND policyname = 'Service role full access on observation_events') THEN
    CREATE POLICY "Service role full access on observation_events"
      ON observation_events FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'observation_events' AND policyname = 'Users can read own observation_events') THEN
    CREATE POLICY "Users can read own observation_events"
      ON observation_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'watchtower_insights' AND policyname = 'Service role full access on watchtower_insights') THEN
    CREATE POLICY "Service role full access on watchtower_insights"
      ON watchtower_insights FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'watchtower_insights' AND policyname = 'Users can read own watchtower_insights') THEN
    CREATE POLICY "Users can read own watchtower_insights"
      ON watchtower_insights FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'escalation_memory' AND policyname = 'Service role full access on escalation_memory') THEN
    CREATE POLICY "Service role full access on escalation_memory"
      ON escalation_memory FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'escalation_memory' AND policyname = 'Users read own escalation_memory') THEN
    CREATE POLICY "Users read own escalation_memory"
      ON escalation_memory FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contradiction_memory' AND policyname = 'Service role full access on contradiction_memory') THEN
    CREATE POLICY "Service role full access on contradiction_memory"
      ON contradiction_memory FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contradiction_memory' AND policyname = 'Users read own contradiction_memory') THEN
    CREATE POLICY "Users read own contradiction_memory"
      ON contradiction_memory FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION touch_escalation_memory_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_escalation_memory_touch ON escalation_memory;
CREATE TRIGGER trg_escalation_memory_touch
BEFORE UPDATE ON escalation_memory
FOR EACH ROW
EXECUTE FUNCTION touch_escalation_memory_updated_at();

CREATE OR REPLACE FUNCTION touch_contradiction_memory_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contradiction_memory_touch ON contradiction_memory;
CREATE TRIGGER trg_contradiction_memory_touch
BEFORE UPDATE ON contradiction_memory
FOR EACH ROW
EXECUTE FUNCTION touch_contradiction_memory_updated_at();

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
