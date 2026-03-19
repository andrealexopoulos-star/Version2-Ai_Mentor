-- Merge webhook event journal + freshness query optimization

CREATE TABLE IF NOT EXISTS business_core.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    provider TEXT NOT NULL,
    category TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_id TEXT,
    entity_type TEXT,
    event_timestamp TIMESTAMPTZ,
    idempotency_key TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'received',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    next_retry_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    dead_letter_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT webhook_events_status_check CHECK (status IN ('received', 'validated', 'queued', 'processed', 'failed', 'dead_letter'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_core_webhook_events_idempotency
    ON business_core.webhook_events(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_business_core_webhook_events_tenant_status
    ON business_core.webhook_events(tenant_id, status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_core_webhook_events_retry
    ON business_core.webhook_events(status, next_retry_at)
    WHERE status IN ('received', 'failed', 'validated');

CREATE INDEX IF NOT EXISTS idx_business_core_webhook_events_provider_category
    ON business_core.webhook_events(provider, category, event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_business_core_source_runs_tenant_connector_ingested
    ON business_core.source_runs(tenant_id, connector_type, ingested_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_core_source_runs_tenant_status_ingested
    ON business_core.source_runs(tenant_id, status, ingested_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_business_core_webhook_events_touch') THEN
        CREATE TRIGGER trg_business_core_webhook_events_touch BEFORE UPDATE ON business_core.webhook_events
        FOR EACH ROW EXECUTE FUNCTION business_core.touch_updated_at();
    END IF;
END $$;

ALTER TABLE business_core.webhook_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'business_core' AND tablename = 'webhook_events' AND policyname = 'tenant_rw_webhook_events'
    ) THEN
        CREATE POLICY tenant_rw_webhook_events ON business_core.webhook_events FOR ALL TO authenticated
        USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'business_core' AND tablename = 'webhook_events' AND policyname = 'service_all_webhook_events'
    ) THEN
        CREATE POLICY service_all_webhook_events ON business_core.webhook_events FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION business_core.prune_webhook_events(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    DELETE FROM business_core.webhook_events
    WHERE received_at < (now() - make_interval(days => GREATEST(retention_days, 1)));
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;
