-- Migration: Create user_operator_profile table for Persona Calibration
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_operator_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  agent_persona JSONB DEFAULT NULL,
  agent_instructions TEXT DEFAULT NULL,
  persona_calibration_status TEXT NOT NULL DEFAULT 'incomplete'
    CHECK (persona_calibration_status IN ('incomplete', 'in_progress', 'complete')),
  current_step INT NOT NULL DEFAULT 0,
  prev_response_id TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Row Level Security
ALTER TABLE user_operator_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON user_operator_profile FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_operator_profile FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_operator_profile FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role bypass for Edge Functions
CREATE POLICY "Service role full access"
  ON user_operator_profile FOR ALL
  USING (auth.role() = 'service_role');

-- Index
CREATE INDEX IF NOT EXISTS idx_uop_user_id ON user_operator_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_uop_status ON user_operator_profile(persona_calibration_status);
