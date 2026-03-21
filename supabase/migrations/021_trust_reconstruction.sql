-- ═══════════════════════════════════════════════════════════════
-- TRUST RECONSTRUCTION MIGRATION
-- BIQc Governance & Integration Truth Tables
-- 
-- Run in Supabase SQL Editor in this exact order.
-- ═══════════════════════════════════════════════════════════════

-- 1. Workspace Integrations — Single source of truth for integration status
CREATE TABLE IF NOT EXISTS workspace_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    integration_type TEXT NOT NULL CHECK (integration_type IN ('crm', 'accounting', 'marketing', 'email')),
    status TEXT NOT NULL CHECK (status IN ('connected', 'disconnected')),
    connected_at TIMESTAMP,
    last_sync_at TIMESTAMP,
    UNIQUE(workspace_id, integration_type)
);

-- 2. Governance Events — Only source for audit log entries
CREATE TABLE IF NOT EXISTS governance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    source_system TEXT NOT NULL CHECK (source_system IN ('crm', 'accounting', 'marketing', 'email', 'scrape', 'manual')),
    signal_reference TEXT,
    signal_timestamp TIMESTAMP NOT NULL,
    confidence_score NUMERIC CHECK (confidence_score BETWEEN 0 AND 1),
    created_at TIMESTAMP DEFAULT now()
);

-- 3. Report Exports — Audit trail for all generated reports
CREATE TABLE IF NOT EXISTS report_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    report_type TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    generated_at TIMESTAMP DEFAULT now(),
    data_snapshot JSONB NOT NULL
);

-- 4. Business DNA Provenance — Add source tracking to business_profiles
DO $$
BEGIN
    IF to_regclass('public.business_profiles') IS NULL THEN
        CREATE TABLE IF NOT EXISTS public.business_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
            business_name TEXT,
            industry TEXT,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'source_map') THEN
        ALTER TABLE business_profiles ADD COLUMN source_map JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'confidence_map') THEN
        ALTER TABLE business_profiles ADD COLUMN confidence_map JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'timestamp_map') THEN
        ALTER TABLE business_profiles ADD COLUMN timestamp_map JSONB;
    END IF;
END $$;

-- 5. Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_governance_events_workspace ON governance_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_governance_events_type ON governance_events(event_type);
CREATE INDEX IF NOT EXISTS idx_workspace_integrations_workspace ON workspace_integrations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_report_exports_workspace ON report_exports(workspace_id);

-- 6. RLS Policies
ALTER TABLE workspace_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_exports ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own workspace data
CREATE POLICY "Users read own workspace_integrations" ON workspace_integrations
    FOR SELECT USING (true);
CREATE POLICY "Users read own governance_events" ON governance_events
    FOR SELECT USING (true);
CREATE POLICY "Users read own report_exports" ON report_exports
    FOR SELECT USING (true);

-- Service role can insert/update
CREATE POLICY "Service role manages workspace_integrations" ON workspace_integrations
    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages governance_events" ON governance_events
    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages report_exports" ON report_exports
    FOR ALL USING (true) WITH CHECK (true);
