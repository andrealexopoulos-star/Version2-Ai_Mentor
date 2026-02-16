-- SUPABASE SCHEMA: Documents Storage
-- Purpose: Replace MongoDB documents collection

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    document_type TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_documents_created ON documents(created_at DESC);
CREATE INDEX idx_documents_type ON documents(document_type);

-- Enable Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Users can only access their own documents
CREATE POLICY documents_user_policy ON documents
    FOR ALL USING (auth.uid() = user_id);
