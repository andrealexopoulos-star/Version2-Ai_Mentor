-- ═══════════════════════════════════════════════════════════════
-- OBSERVATION_EVENTS — Schema Extension for Integration Emission
-- ═══════════════════════════════════════════════════════════════
-- Adds columns required by Merge emission layer.
-- Existing columns (payload, severity) remain for backward compat.
-- Run in Supabase SQL Editor.

ALTER TABLE observation_events ADD COLUMN IF NOT EXISTS signal_name TEXT;
ALTER TABLE observation_events ADD COLUMN IF NOT EXISTS entity JSONB DEFAULT '{}';
ALTER TABLE observation_events ADD COLUMN IF NOT EXISTS metric JSONB DEFAULT '{}';
ALTER TABLE observation_events ADD COLUMN IF NOT EXISTS confidence NUMERIC(4,3) DEFAULT 0.500;

CREATE INDEX IF NOT EXISTS idx_obs_events_signal ON observation_events (user_id, signal_name, observed_at DESC);
