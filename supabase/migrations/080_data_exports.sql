-- 080_data_exports.sql
-- Settings danger zone: self-service data export tracking.
-- Users can request a full export of their data, which is queued
-- as a background job and stored temporarily for download.

CREATE TABLE IF NOT EXISTS public.data_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'ready', 'expired', 'failed')),
    file_path TEXT,
    file_size_bytes BIGINT,
    error_detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_data_exports_user
    ON public.data_exports(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_exports_status
    ON public.data_exports(status) WHERE status IN ('queued', 'processing');

-- RLS: users see own exports only
ALTER TABLE public.data_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own exports" ON public.data_exports;
CREATE POLICY "Users see own exports" ON public.data_exports
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manage exports" ON public.data_exports;
CREATE POLICY "Service role manage exports" ON public.data_exports
    FOR ALL USING (auth.role() = 'service_role');
