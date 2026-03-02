-- ═══════════════════════════════════════════════════════════════
-- BIQc COGNITION PLATFORM — Foundation Tables
-- Migration: 037_cognition_platform.sql
--
-- New tables: memory (3), marketing (2), automation (1), observability (1)
-- Feature flags for all new modules
-- Zero modifications to existing tables
-- ═══════════════════════════════════════════════════════════════

-- ═══ 1. MEMORY LAYER ═══

CREATE TABLE IF NOT EXISTS episodic_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}',
    source_system TEXT,
    session_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_episodic_tenant ON episodic_memory(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS semantic_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    subject TEXT NOT NULL,
    predicate TEXT NOT NULL,
    object TEXT NOT NULL,
    confidence FLOAT DEFAULT 1.0,
    source_event_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_semantic_tenant ON semantic_memory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_semantic_subject ON semantic_memory(subject);

CREATE TABLE IF NOT EXISTS context_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    summary_type TEXT NOT NULL,
    summary_text TEXT NOT NULL,
    source_event_ids UUID[] DEFAULT '{}',
    source_count INT DEFAULT 0,
    key_outcomes JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_summaries_tenant ON context_summaries(tenant_id, created_at DESC);

-- ═══ 2. MARKETING INTELLIGENCE ═══

CREATE TABLE IF NOT EXISTS marketing_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    version INT DEFAULT 1,
    competitors JSONB DEFAULT '[]',
    scores JSONB NOT NULL DEFAULT '{}',
    summary TEXT,
    radar_data JSONB,
    source_data JSONB DEFAULT '{}',
    is_current BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_benchmarks_tenant ON marketing_benchmarks(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_benchmarks_current ON marketing_benchmarks(tenant_id) WHERE is_current = true;

-- ═══ 3. MARKETING AUTOMATION ═══

CREATE TABLE IF NOT EXISTS action_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    action_type TEXT NOT NULL,
    action_params JSONB NOT NULL DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','executing','completed','failed','cancelled')),
    external_id TEXT,
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_action_tenant ON action_log(tenant_id, created_at DESC);

-- ═══ 4. OBSERVABILITY ═══

CREATE TABLE IF NOT EXISTS llm_call_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    model_name TEXT NOT NULL,
    model_version TEXT,
    prompt_tokens INT,
    completion_tokens INT,
    total_tokens INT,
    latency_ms INT,
    temperature FLOAT,
    max_tokens INT,
    input_hash TEXT,
    output_valid BOOLEAN,
    validation_errors JSONB,
    feature_flag TEXT,
    endpoint TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_llm_log_tenant ON llm_call_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_log_model ON llm_call_log(model_name, created_at DESC);

-- ═══ 5. FEATURE FLAGS FOR NEW MODULES ═══

INSERT INTO ic_feature_flags (flag_name, enabled, description) VALUES
    ('rag_chat_enabled', false, 'RAG-augmented SoundBoard chat'),
    ('marketing_benchmarks_enabled', false, 'Marketing Intelligence tab + benchmarking'),
    ('marketing_automation_enabled', false, 'Ad/blog/social post generation'),
    ('memory_layer_enabled', false, 'Episodic + semantic memory'),
    ('observability_full_enabled', false, 'Full LLM call logging'),
    ('guardrails_enabled', false, 'Input sanitisation + output filtering'),
    ('graphrag_enabled', false, 'Knowledge graph retrieval')
ON CONFLICT (flag_name) DO NOTHING;

-- ═══ 6. RLS ═══

ALTER TABLE episodic_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_call_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read" ON episodic_memory FOR SELECT USING (true);
CREATE POLICY "service_all" ON episodic_memory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tenant_read" ON semantic_memory FOR SELECT USING (true);
CREATE POLICY "service_all" ON semantic_memory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tenant_read" ON context_summaries FOR SELECT USING (true);
CREATE POLICY "service_all" ON context_summaries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tenant_read" ON marketing_benchmarks FOR SELECT USING (true);
CREATE POLICY "service_all" ON marketing_benchmarks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tenant_read" ON action_log FOR SELECT USING (true);
CREATE POLICY "service_all" ON action_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "tenant_read" ON llm_call_log FOR SELECT USING (true);
CREATE POLICY "service_all" ON llm_call_log FOR ALL USING (true) WITH CHECK (true);
