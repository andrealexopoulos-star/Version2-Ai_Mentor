-- 079_sync_log.sql
-- Data Health page: unified sync log across all integration connectors.
-- Tracks every sync operation with status, duration, and record counts.

CREATE TABLE IF NOT EXISTS public.sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connector TEXT NOT NULL,
    sync_type TEXT NOT NULL DEFAULT 'incremental',
    records_processed INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'partial', 'error', 'timeout')),
    error_detail TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_user_created
    ON public.sync_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_log_connector
    ON public.sync_log(connector, created_at DESC);

-- RLS: users see own sync logs
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own sync logs" ON public.sync_log;
CREATE POLICY "Users see own sync logs" ON public.sync_log
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert (backend writes sync results)
DROP POLICY IF EXISTS "Service role manage sync logs" ON public.sync_log;
CREATE POLICY "Service role manage sync logs" ON public.sync_log
    FOR ALL USING (auth.role() = 'service_role');
