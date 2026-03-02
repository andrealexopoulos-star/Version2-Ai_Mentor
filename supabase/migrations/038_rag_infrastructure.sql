-- ═══════════════════════════════════════════════════════════════
-- BIQc RAG INFRASTRUCTURE — pgvector + Embeddings + Retrieval
-- Migration: 038_rag_infrastructure.sql
--
-- Enables pgvector, creates embedding tables, retrieval functions.
-- Feature-flagged: rag_chat_enabled, graphrag_enabled
-- Zero modification to existing tables.
-- ═══════════════════════════════════════════════════════════════

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ═══ 1. DOCUMENT EMBEDDINGS ═══
CREATE TABLE IF NOT EXISTS rag_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    embedding vector(1536),
    source_type TEXT NOT NULL CHECK (source_type IN ('website','profile','snapshot','conversation','document','competitor','benchmark')),
    source_id TEXT,
    source_url TEXT,
    metadata JSONB DEFAULT '{}',
    chunk_index INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_rag_tenant ON rag_embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rag_source ON rag_embeddings(source_type);

-- HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_rag_embedding ON rag_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ═══ 2. SIMILARITY SEARCH FUNCTION ═══
CREATE OR REPLACE FUNCTION rag_search(
    p_tenant_id UUID,
    p_query_embedding vector(1536),
    p_limit INT DEFAULT 5,
    p_source_types TEXT[] DEFAULT NULL,
    p_similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE(
    id UUID,
    content TEXT,
    source_type TEXT,
    source_url TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.content,
        e.source_type,
        e.source_url,
        e.metadata,
        1 - (e.embedding <=> p_query_embedding) AS similarity
    FROM rag_embeddings e
    WHERE e.tenant_id = p_tenant_id
    AND (p_source_types IS NULL OR e.source_type = ANY(p_source_types))
    AND 1 - (e.embedding <=> p_query_embedding) >= p_similarity_threshold
    ORDER BY e.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$;

-- ═══ 3. EMBEDDING STATS VIEW ═══
CREATE OR REPLACE VIEW rag_stats AS
SELECT
    tenant_id,
    source_type,
    COUNT(*) AS chunk_count,
    MAX(created_at) AS latest_embedding
FROM rag_embeddings
GROUP BY tenant_id, source_type;

-- ═══ RLS ═══
ALTER TABLE rag_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_read_embeddings" ON rag_embeddings FOR SELECT USING (true);
CREATE POLICY "service_manage_embeddings" ON rag_embeddings FOR ALL USING (true) WITH CHECK (true);

GRANT EXECUTE ON FUNCTION rag_search(UUID, vector, INT, TEXT[], FLOAT) TO authenticated;
GRANT SELECT ON rag_stats TO authenticated;
