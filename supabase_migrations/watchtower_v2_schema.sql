-- ═══════════════════════════════════════════════════════════════
-- WATCHTOWER V2 — CONTINUOUS BUSINESS INTELLIGENCE SCHEMA
-- ═══════════════════════════════════════════════════════════════
-- Run in Supabase SQL Editor. All operations are additive.
-- No existing tables are modified (except one ALTER on business_profiles).
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. observation_events ───────────────────────────────────
-- Raw, factual signals emitted by integrations.
-- The engine reads these; integrations write them.
-- Each row is a single observed fact, not an interpretation.

CREATE TABLE IF NOT EXISTS observation_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  source TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT observation_events_domain_check 
    CHECK (domain IN ('finance', 'sales', 'operations', 'team', 'market')),
  CONSTRAINT observation_events_severity_check 
    CHECK (severity IN ('info', 'warning', 'critical'))
);

-- Primary query pattern: "all events for user X in domain Y within the last N hours"
CREATE INDEX IF NOT EXISTS idx_obs_events_user_domain_time
  ON observation_events (user_id, domain, observed_at DESC);

-- Secondary: "all events for user X since timestamp T" (cross-domain scans)
CREATE INDEX IF NOT EXISTS idx_obs_events_user_time
  ON observation_events (user_id, observed_at DESC);


-- ─── 2. watchtower_insights ─────────────────────────────────
-- Persisted domain positions and material findings.
-- Append-only. Do NOT overwrite or update rows.
-- This is the Watchtower's record of judgement over time.

CREATE TABLE IF NOT EXISTS watchtower_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  position TEXT NOT NULL,
  previous_position TEXT,
  finding TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.000,
  source_event_ids UUID[] DEFAULT '{}',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT watchtower_insights_domain_check 
    CHECK (domain IN ('finance', 'sales', 'operations', 'team', 'market')),
  CONSTRAINT watchtower_insights_position_check 
    CHECK (position IN ('STABLE', 'ELEVATED', 'DETERIORATING', 'CRITICAL')),
  CONSTRAINT watchtower_insights_confidence_check 
    CHECK (confidence >= 0 AND confidence <= 1)
);

-- Primary query pattern: "latest position for user X, domain Y"
CREATE INDEX IF NOT EXISTS idx_wt_insights_latest
  ON watchtower_insights (user_id, domain, detected_at DESC);


-- ─── 3. intelligence_configuration on business_profiles ─────
-- Defines what domains the Watchtower monitors and escalation tolerances.
-- If empty or null, the Watchtower does nothing (silence is valid).

ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS intelligence_configuration JSONB DEFAULT '{}';

-- Example value (DO NOT run — for reference only):
-- UPDATE business_profiles SET intelligence_configuration = '{
--   "domains": {
--     "finance":    {"enabled": true,  "escalation_threshold": 0.70, "window_hours": 168, "min_events": 3},
--     "sales":      {"enabled": true,  "escalation_threshold": 0.70, "window_hours": 168, "min_events": 3},
--     "operations": {"enabled": true,  "escalation_threshold": 0.60, "window_hours": 168, "min_events": 2},
--     "team":       {"enabled": false, "escalation_threshold": 0.80, "window_hours": 336, "min_events": 5},
--     "market":     {"enabled": false, "escalation_threshold": 0.80, "window_hours": 336, "min_events": 5}
--   }
-- }' WHERE user_id = '<uuid>';


-- ─── 4. RLS ─────────────────────────────────────────────────
-- Both tables: service_role full access (engine runs server-side).
-- User-scoped read policies can be added later for Board Room UI.

ALTER TABLE observation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchtower_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on observation_events"
  ON observation_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on watchtower_insights"
  ON watchtower_insights FOR ALL TO service_role USING (true) WITH CHECK (true);

-- User read-only access (for future Board Room UI)
CREATE POLICY "Users can read own observation_events"
  ON observation_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read own watchtower_insights"
  ON watchtower_insights FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
