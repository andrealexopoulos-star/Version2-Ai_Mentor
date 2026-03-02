-- ═══════════════════════════════════════════════════════════════
-- BIQc FILE STORAGE + DOWNLOADS
-- Migration: 043_file_storage.sql
--
-- Creates Supabase Storage buckets for user-generated files.
-- Tracks downloads in a files registry table.
-- ═══════════════════════════════════════════════════════════════

-- 1. Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('user-files', 'user-files', false, 52428800, ARRAY['image/png','image/jpeg','image/svg+xml','image/webp','application/pdf','text/plain','text/csv','text/html','application/json','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    ('reports', 'reports', false, 52428800, ARRAY['application/pdf','text/html','text/plain','application/json'])
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS policies
CREATE POLICY "Users read own files" ON storage.objects FOR SELECT USING (
    bucket_id IN ('user-files', 'reports') AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users upload own files" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id IN ('user-files', 'reports') AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Service manages all files" ON storage.objects FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. File registry table (tracks all generated files)
CREATE TABLE IF NOT EXISTS generated_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    bucket TEXT NOT NULL DEFAULT 'user-files',
    size_bytes INT,
    generated_by TEXT,
    source_conversation_id TEXT,
    metadata JSONB DEFAULT '{}',
    download_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_tenant ON generated_files(tenant_id, created_at DESC);

ALTER TABLE generated_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_read_files" ON generated_files FOR SELECT USING (true);
CREATE POLICY "service_manage_files" ON generated_files FOR ALL TO service_role USING (true) WITH CHECK (true);
