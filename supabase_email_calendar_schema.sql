-- SUPABASE SCHEMA: Email & Calendar Storage
-- Purpose: Replace MongoDB collections with PostgreSQL tables

-- =============================================
-- TABLE 1: outlook_emails
-- Stores synced email data from Microsoft Graph
-- =============================================
CREATE TABLE IF NOT EXISTS outlook_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    graph_message_id TEXT NOT NULL,
    subject TEXT,
    from_address TEXT,
    from_name TEXT,
    received_date TIMESTAMPTZ,
    body_preview TEXT,
    body_content TEXT,
    is_read BOOLEAN DEFAULT false,
    importance TEXT,
    categories TEXT[],
    has_attachments BOOLEAN DEFAULT false,
    folder TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for performance
    UNIQUE(user_id, graph_message_id)
);

CREATE INDEX idx_outlook_emails_user ON outlook_emails(user_id);
CREATE INDEX idx_outlook_emails_received ON outlook_emails(received_date DESC);

-- =============================================
-- TABLE 2: outlook_sync_jobs
-- Tracks email sync job status and progress
-- =============================================
CREATE TABLE IF NOT EXISTS outlook_sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'running', -- running, completed, failed
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    progress JSONB DEFAULT '{"folders_processed": 0, "emails_processed": 0, "insights_generated": 0}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outlook_sync_jobs_user ON outlook_sync_jobs(user_id);
CREATE INDEX idx_outlook_sync_jobs_status ON outlook_sync_jobs(status);

-- =============================================
-- TABLE 3: outlook_calendar_events  
-- Stores calendar events from Microsoft Graph
-- =============================================
CREATE TABLE IF NOT EXISTS outlook_calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    graph_event_id TEXT NOT NULL,
    subject TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    location TEXT,
    attendees JSONB,
    is_all_day BOOLEAN DEFAULT false,
    is_cancelled BOOLEAN DEFAULT false,
    organizer_email TEXT,
    organizer_name TEXT,
    body_preview TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, graph_event_id)
);

CREATE INDEX idx_outlook_calendar_user ON outlook_calendar_events(user_id);
CREATE INDEX idx_outlook_calendar_start ON outlook_calendar_events(start_time);

-- =============================================
-- RLS POLICIES
-- Enable Row Level Security
-- =============================================

ALTER TABLE outlook_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlook_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlook_calendar_events ENABLE ROW LEVEL SECURITY;

-- Users can only access their own emails
CREATE POLICY outlook_emails_user_policy ON outlook_emails
    FOR ALL USING (auth.uid() = user_id);

-- Users can only access their own sync jobs
CREATE POLICY outlook_sync_jobs_user_policy ON outlook_sync_jobs
    FOR ALL USING (auth.uid() = user_id);

-- Users can only access their own calendar events
CREATE POLICY outlook_calendar_user_policy ON outlook_calendar_events
    FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- NOTES
-- =============================================
-- This schema mirrors MongoDB collections:
-- - outlook_emails (was MongoDB collection)
-- - outlook_sync_jobs (was MongoDB collection)
-- - outlook_calendar_events (new, structured)
--
-- All tables have RLS enabled for security
-- Foreign keys ensure data integrity
-- Indexes optimize query performance
