-- ═══════════════════════════════════════════════════════════════
-- BIQc FORENSIC INGESTION ENGINE — Complete Schema
-- Migration: 027_ingestion_engine.sql
--
-- Tables: ingestion_sessions, ingestion_pages, ingestion_cleaned
-- Alters: business_profiles (adds dna_trace)
-- ═══════════════════════════════════════════════════════════════

-- 1. Ingestion Sessions — one per scrape run
CREATE TABLE IF NOT EXISTS ingestion_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID,
    target_url TEXT NOT NULL,
    canonical_url TEXT,
    pages_crawled INTEGER DEFAULT 0,
    total_html_length INTEGER DEFAULT 0,
    noise_ratio NUMERIC,
    hallucination_score NUMERIC,
    quality_score NUMERIC,
    confidence_level TEXT,
    failure_layer TEXT,
    failure_codes JSONB DEFAULT '[]'::JSONB,
    llm_prompt TEXT,
    llm_output JSONB,
    dna_trace JSONB,
    redirect_chain JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Ingestion Pages — raw HTML per page
CREATE TABLE IF NOT EXISTS ingestion_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES ingestion_sessions(id) ON DELETE CASCADE,
    page_url TEXT NOT NULL,
    page_priority INTEGER,
    html_length INTEGER DEFAULT 0,
    raw_html TEXT,
    fetch_time_ms INTEGER,
    http_status INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Ingestion Cleaned — cleaned text per session
CREATE TABLE IF NOT EXISTS ingestion_cleaned (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES ingestion_sessions(id) ON DELETE CASCADE,
    cleaned_text TEXT,
    cleaned_length INTEGER DEFAULT 0,
    noise_ratio NUMERIC,
    sections_detected JSONB,
    core_content_weight NUMERIC,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Business DNA trace column
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

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'dna_trace') THEN
        ALTER TABLE business_profiles ADD COLUMN dna_trace JSONB;
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ingestion_sessions_workspace ON ingestion_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_pages_session ON ingestion_pages(session_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_cleaned_session ON ingestion_cleaned(session_id);

-- RLS
ALTER TABLE ingestion_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_cleaned ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own sessions" ON ingestion_sessions FOR SELECT USING (true);
CREATE POLICY "Service manages sessions" ON ingestion_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users read own pages" ON ingestion_pages FOR SELECT USING (true);
CREATE POLICY "Service manages pages" ON ingestion_pages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users read own cleaned" ON ingestion_cleaned FOR SELECT USING (true);
CREATE POLICY "Service manages cleaned" ON ingestion_cleaned FOR ALL USING (true) WITH CHECK (true);
