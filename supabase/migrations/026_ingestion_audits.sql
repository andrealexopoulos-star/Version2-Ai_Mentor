-- ═══════════════════════════════════════════════════════════════
-- FORENSIC INGESTION AUDIT TABLE
-- Stores complete audit results for each URL scan
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ingestion_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    target_url TEXT NOT NULL,
    final_url TEXT,
    http_status INT,
    -- Layer 1: Extraction
    extraction_status TEXT, -- 'pass', 'fail_a1'...'fail_a5'
    raw_html_length INT,
    content_length INT,
    noise_ratio NUMERIC,
    fetch_time_ms INT,
    has_structured_data BOOLEAN DEFAULT FALSE,
    redirect_chain JSONB,
    -- Layer 2: Cleaning
    cleaning_status TEXT, -- 'pass', 'fail_b1'...'fail_b4'
    nav_removed BOOLEAN DEFAULT FALSE,
    footer_removed BOOLEAN DEFAULT FALSE,
    cookie_removed BOOLEAN DEFAULT FALSE,
    unique_sentence_ratio NUMERIC,
    core_content_weight NUMERIC,
    sections_detected JSONB,
    -- Layer 3: Synthesis
    synthesis_status TEXT, -- 'pass', 'fail_c1'...'fail_c5'
    hallucinations JSONB DEFAULT '[]'::JSONB,
    lost_signals JSONB DEFAULT '[]'::JSONB,
    prompt_inference_flags JSONB DEFAULT '[]'::JSONB,
    -- Metadata
    copyright_year INT,
    latest_blog_date TEXT,
    freshness_status TEXT,
    -- Verdict
    primary_failure_layer TEXT, -- 'extraction', 'cleaning', 'synthesis', 'none'
    secondary_failure_layer TEXT,
    failure_codes JSONB DEFAULT '[]'::JSONB,
    confidence_score NUMERIC,
    remediation JSONB,
    -- Raw data
    raw_scrape_snapshot TEXT,
    cleaned_content TEXT,
    generated_snapshot JSONB,
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_audits_workspace ON ingestion_audits(workspace_id);
ALTER TABLE ingestion_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own audits" ON ingestion_audits FOR SELECT USING (true);
CREATE POLICY "Service manages audits" ON ingestion_audits FOR ALL USING (true) WITH CHECK (true);
