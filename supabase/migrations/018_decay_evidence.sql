-- ═══════════════════════════════════════════════════════════════
-- decay_evidence(user_id) — SQL Function
-- Replaces: backend/evidence_freshness.py (279 lines Python)
-- Purpose: Confidence decay when evidence becomes stale
-- Reads: evidence_freshness, observation_events
-- Writes: evidence_freshness
--
-- States: FRESH (<48h) → AGING (48-168h) → STALE (>168h/7d)
-- Decay rate: 0.002 confidence units per hour while AGING
-- STALE: confidence halved (floor 0.05)
-- FRESH: confidence restored to watchtower level
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS evidence_freshness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  domain TEXT NOT NULL CHECK (domain IN ('finance', 'sales', 'operations', 'team', 'market')),
  current_confidence NUMERIC NOT NULL DEFAULT 0.5 CHECK (current_confidence >= 0 AND current_confidence <= 1),
  last_evidence_at TIMESTAMPTZ,
  decay_rate NUMERIC NOT NULL DEFAULT 0.002,
  confidence_state TEXT NOT NULL DEFAULT 'FRESH' CHECK (confidence_state IN ('FRESH', 'AGING', 'STALE')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, domain, active)
);

CREATE INDEX IF NOT EXISTS idx_evidence_freshness_user_domain_active
  ON evidence_freshness(user_id, domain, active);

CREATE INDEX IF NOT EXISTS idx_evidence_freshness_last_evidence
  ON evidence_freshness(last_evidence_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON evidence_freshness TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON evidence_freshness TO service_role;

ALTER TABLE evidence_freshness ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'evidence_freshness' AND policyname = 'Service role full access on evidence_freshness') THEN
    CREATE POLICY "Service role full access on evidence_freshness"
      ON evidence_freshness FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'evidence_freshness' AND policyname = 'Users read own evidence_freshness') THEN
    CREATE POLICY "Users read own evidence_freshness"
      ON evidence_freshness FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION touch_evidence_freshness_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_evidence_freshness_touch ON evidence_freshness;
CREATE TRIGGER trg_evidence_freshness_touch
BEFORE UPDATE ON evidence_freshness
FOR EACH ROW
EXECUTE FUNCTION touch_evidence_freshness_updated_at();

CREATE OR REPLACE FUNCTION decay_evidence(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_domain TEXT;
  v_domains TEXT[] := ARRAY['finance', 'sales', 'operations', 'team', 'market'];
  v_results JSON[];
  v_changes INT := 0;
  v_now TIMESTAMPTZ := now();
  v_latest_evidence TIMESTAMPTZ;
  v_hours_since NUMERIC;
  v_new_state TEXT;
  v_new_confidence NUMERIC;
  v_existing RECORD;
  v_wt_confidence NUMERIC;
  v_decay_rate NUMERIC := 0.002;
  v_aging_threshold NUMERIC := 48;
  v_stale_threshold NUMERIC := 168;
BEGIN
  v_results := ARRAY[]::JSON[];

  FOREACH v_domain IN ARRAY v_domains LOOP
    -- Find latest evidence (observation event) for this domain
    SELECT MAX(observed_at) INTO v_latest_evidence
    FROM observation_events
    WHERE user_id = p_user_id AND domain = v_domain
      AND observed_at > v_now - INTERVAL '30 days';

    -- If no evidence at all, use 30 days ago as baseline
    v_latest_evidence := COALESCE(v_latest_evidence, v_now - INTERVAL '30 days');

    v_hours_since := EXTRACT(EPOCH FROM (v_now - v_latest_evidence)) / 3600.0;

    -- Get watchtower confidence for this domain
    SELECT COALESCE(confidence, 0.5) INTO v_wt_confidence
    FROM watchtower_insights
    WHERE user_id = p_user_id AND domain = v_domain
    ORDER BY detected_at DESC LIMIT 1;

    v_wt_confidence := COALESCE(v_wt_confidence, 0.5);

    -- Determine state and confidence
    IF v_hours_since < v_aging_threshold THEN
      v_new_state := 'FRESH';
      v_new_confidence := v_wt_confidence;
    ELSIF v_hours_since < v_stale_threshold THEN
      v_new_state := 'AGING';
      v_new_confidence := GREATEST(v_wt_confidence - ((v_hours_since - v_aging_threshold) * v_decay_rate), 0.1);
    ELSE
      v_new_state := 'STALE';
      v_new_confidence := GREATEST(v_wt_confidence * 0.5, 0.05);
    END IF;

    v_new_confidence := ROUND(LEAST(GREATEST(v_new_confidence, 0.0), 1.0)::NUMERIC, 3);

    -- Get existing record
    SELECT * INTO v_existing
    FROM evidence_freshness
    WHERE user_id = p_user_id AND domain = v_domain AND active = true
    LIMIT 1;

    IF v_existing.id IS NOT NULL THEN
      -- Check if anything changed
      IF v_existing.confidence_state = v_new_state AND ABS(v_existing.current_confidence - v_new_confidence) < 0.005 THEN
        CONTINUE; -- No change
      END IF;

      UPDATE evidence_freshness SET
        current_confidence = v_new_confidence,
        confidence_state = v_new_state,
        last_evidence_at = v_latest_evidence,
        decay_rate = v_decay_rate
      WHERE id = v_existing.id;

      v_results := array_append(v_results, json_build_object(
        'domain', v_domain,
        'action', 'updated',
        'from_state', v_existing.confidence_state,
        'to_state', v_new_state,
        'from_confidence', v_existing.current_confidence,
        'to_confidence', v_new_confidence,
        'hours_since_evidence', ROUND(v_hours_since::NUMERIC, 1)
      ));
      v_changes := v_changes + 1;
    ELSE
      -- Create new record
      INSERT INTO evidence_freshness (id, user_id, domain, current_confidence, last_evidence_at, decay_rate, confidence_state, active)
      VALUES (gen_random_uuid(), p_user_id, v_domain, v_new_confidence, v_latest_evidence, v_decay_rate, v_new_state, true);

      v_results := array_append(v_results, json_build_object(
        'domain', v_domain,
        'action', 'created',
        'state', v_new_state,
        'confidence', v_new_confidence,
        'hours_since_evidence', ROUND(v_hours_since::NUMERIC, 1)
      ));
      v_changes := v_changes + 1;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'changes', v_changes,
    'results', to_json(v_results),
    'checked_at', v_now::TEXT,
    'thresholds', json_build_object('aging_hours', v_aging_threshold, 'stale_hours', v_stale_threshold, 'decay_rate_per_hour', v_decay_rate)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
