-- 075_deferred_integrations_tracker.sql
-- Tracks deferred integrations (e.g., Xero/BrowseAI/Firecrawl) with sequencing.

CREATE TABLE IF NOT EXISTS public.deferred_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_key TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'deferred',
    priority INTEGER NOT NULL DEFAULT 100,
    blocked_by TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    auth_scope TEXT,
    ingestion_scope TEXT,
    pricing_impact TEXT,
    owner_user_id UUID,
    target_wave TEXT,
    target_date TIMESTAMPTZ,
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deferred_integrations_status ON public.deferred_integrations(status, priority);
CREATE INDEX IF NOT EXISTS idx_deferred_integrations_wave ON public.deferred_integrations(target_wave, target_date);

ALTER TABLE public.deferred_integrations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'deferred_integrations' AND policyname = 'service_manage_deferred_integrations'
    ) THEN
        CREATE POLICY service_manage_deferred_integrations ON public.deferred_integrations
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

INSERT INTO public.deferred_integrations (
    integration_key,
    display_name,
    status,
    priority,
    blocked_by,
    auth_scope,
    ingestion_scope,
    pricing_impact,
    target_wave,
    notes
) VALUES
(
    'xero',
    'Xero Direct Connector',
    'deferred',
    10,
    ARRAY['branch_sync', 'tier_parity', 'supplier_telemetry'],
    'OAuth2 tenant-scoped tokens',
    'Invoices, payments, contacts, chart_of_accounts',
    'Finance module uplift + overage watch on sync depth',
    'wave-e',
    'Activate after core controls remain green.'
),
(
    'browseai',
    'BrowseAI Deep Enrichment',
    'deferred',
    20,
    ARRAY['endpoint_contract_validation', 'supplier_telemetry'],
    'API key + task token',
    'Task runs and scrape deltas',
    'Crawl credit consumption needs budget controls',
    'wave-e',
    'Pending stable health endpoint contract.'
),
(
    'firecrawl',
    'Firecrawl Contracted Crawl',
    'deferred',
    30,
    ARRAY['endpoint_contract_validation', 'supplier_telemetry'],
    'API key',
    'Crawl results for enrichment and citations',
    'Token/crawl spend controls required',
    'wave-e',
    'Pending endpoint normalization and quota alarms.'
)
ON CONFLICT (integration_key) DO NOTHING;
