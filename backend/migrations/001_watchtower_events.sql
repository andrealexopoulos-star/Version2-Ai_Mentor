-- WATCHTOWER EVENTS TABLE
-- Single source of truth for all BIQc intelligence statements
-- Stores conclusions, not raw data

CREATE TABLE IF NOT EXISTS public.watchtower_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    
    -- Classification
    domain TEXT NOT NULL CHECK (domain IN (
        'communications',
        'pipeline',
        'financial',
        'operations',
        'calendar',
        'marketing'
    )),
    type TEXT NOT NULL CHECK (type IN (
        'risk',
        'drift',
        'opportunity',
        'anomaly'
    )),
    severity TEXT NOT NULL CHECK (severity IN (
        'low',
        'medium',
        'high',
        'critical'
    )),
    
    -- The Truth
    headline TEXT NOT NULL,
    statement TEXT NOT NULL,
    
    -- Evidence (minimal, factual)
    evidence_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Temporal context
    consequence_window TEXT,
    
    -- Source attribution
    source TEXT NOT NULL,
    
    -- Deduplication
    fingerprint TEXT NOT NULL,
    
    -- Lifecycle
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active',
        'handled',
        'resolved',
        'suppressed'
    )),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    handled_at TIMESTAMPTZ,
    handled_by_user_id UUID REFERENCES auth.users(id),
    
    -- Workspace isolation
    CONSTRAINT unique_event_per_workspace UNIQUE (account_id, fingerprint)
);

-- Indexes for performance
CREATE INDEX idx_watchtower_account_status ON public.watchtower_events(account_id, status);
CREATE INDEX idx_watchtower_domain ON public.watchtower_events(domain);
CREATE INDEX idx_watchtower_severity ON public.watchtower_events(severity);
CREATE INDEX idx_watchtower_created ON public.watchtower_events(created_at DESC);

-- RLS Policies
ALTER TABLE public.watchtower_events ENABLE ROW LEVEL SECURITY;

-- Users can read their workspace's events
CREATE POLICY "Users can read workspace watchtower events"
    ON public.watchtower_events
    FOR SELECT
    USING (
        account_id IN (
            SELECT account_id FROM public.users WHERE id = auth.uid()
        )
    );

-- Service role can do anything
CREATE POLICY "Service role full access"
    ON public.watchtower_events
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_watchtower_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER watchtower_updated_at
    BEFORE UPDATE ON public.watchtower_events
    FOR EACH ROW
    EXECUTE FUNCTION update_watchtower_updated_at();

COMMENT ON TABLE public.watchtower_events IS 'Authoritative intelligence events - conclusions only, not raw data';
