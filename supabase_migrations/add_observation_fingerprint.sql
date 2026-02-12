-- Migration: Add fingerprint column and unique index for emission idempotency
-- Date: 2026-02-12

-- Add fingerprint column (nullable for existing rows)
ALTER TABLE observation_events ADD COLUMN IF NOT EXISTS fingerprint TEXT;

-- Create unique index for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_observation_events_user_fingerprint 
ON observation_events (user_id, fingerprint) 
WHERE fingerprint IS NOT NULL;
