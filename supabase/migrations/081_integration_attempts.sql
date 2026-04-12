-- 081_integration_attempts.sql
-- Microsoft admin consent tracking and general integration attempt audit.
-- Records every OAuth connection attempt with outcome for debugging
-- and admin consent flow support.

CREATE TABLE IF NOT EXISTS public.integration_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id TEXT,
    provider TEXT NOT NULL DEFAULT 'microsoft',
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'admin_required', 'timeout')),
    error_code TEXT,
    error_detail TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_attempts_user
    ON public.integration_attempts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_attempts_status
    ON public.integration_attempts(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_attempts_provider
    ON public.integration_attempts(provider, status);

-- RLS: users see own attempts
ALTER TABLE public.integration_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own attempts" ON public.integration_attempts;
CREATE POLICY "Users see own attempts" ON public.integration_attempts
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manage attempts" ON public.integration_attempts;
CREATE POLICY "Service role manage attempts" ON public.integration_attempts
    FOR ALL USING (auth.role() = 'service_role');
