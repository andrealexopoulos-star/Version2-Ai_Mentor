-- BIQC Fact Resolution Ledger Schema
-- Run this in Supabase SQL Editor to create a dedicated fact resolution table.
-- Currently, facts are stored in user_operator_profile.operator_profile.fact_ledger (JSONB).
-- This table is for future migration to a normalized schema when needed.

CREATE TABLE IF NOT EXISTS fact_resolution_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    fact_key TEXT NOT NULL,
    fact_value JSONB,
    source TEXT DEFAULT 'user_confirmed',
    confidence NUMERIC DEFAULT 1.0,
    confirmed BOOLEAN DEFAULT FALSE,
    first_seen_at TIMESTAMPTZ DEFAULT now(),
    last_verified_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, fact_key)
);

-- Enable RLS
ALTER TABLE fact_resolution_ledger ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own facts
CREATE POLICY "Users can view own facts" ON fact_resolution_ledger
    FOR SELECT USING (auth.uid() = user_id);

-- Allow service role full access
CREATE POLICY "Service role full access" ON fact_resolution_ledger
    FOR ALL USING (auth.role() = 'service_role');

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_fact_ledger_user ON fact_resolution_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_fact_ledger_key ON fact_resolution_ledger(user_id, fact_key);
