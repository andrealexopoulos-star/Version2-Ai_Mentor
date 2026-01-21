-- SUPABASE SCHEMA: Advisory Log Table
-- Critical for Cognitive Core recommendation tracking

CREATE TABLE IF NOT EXISTS advisory_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent TEXT NOT NULL,
    situation TEXT NOT NULL,
    recommendation TEXT NOT NULL,
    reason TEXT NOT NULL,
    expected_outcome TEXT NOT NULL,
    topic_tags TEXT[] DEFAULT '{}',
    urgency TEXT DEFAULT 'normal',
    confidence TEXT DEFAULT 'medium',
    confidence_factors TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'pending',
    times_repeated INTEGER DEFAULT 0,
    escalation_level INTEGER DEFAULT 0,
    actual_outcome TEXT,
    outcome_recorded_at TIMESTAMPTZ,
    follow_up_dates TIMESTAMPTZ[],
    user_acknowledged BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_advisory_log_user ON advisory_log(user_id);
CREATE INDEX idx_advisory_log_status ON advisory_log(status);
CREATE INDEX idx_advisory_log_created ON advisory_log(created_at DESC);
CREATE INDEX idx_advisory_log_recommendation_id ON advisory_log(recommendation_id);

ALTER TABLE advisory_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY advisory_log_user_policy ON advisory_log
    FOR ALL USING (auth.uid() = user_id);
