-- Metric registry for authoritative Top100 KPI catalog

CREATE TABLE IF NOT EXISTS business_core.metric_definitions (
    metric_id INT PRIMARY KEY,
    metric_key TEXT NOT NULL UNIQUE,
    metric_name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    formula TEXT,
    primary_source TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_core_metric_definitions_category ON business_core.metric_definitions(category);
CREATE INDEX IF NOT EXISTS idx_business_core_metric_definitions_active ON business_core.metric_definitions(active);

ALTER TABLE business_core.metric_definitions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'metric_definitions' AND policyname = 'tenant_read_metric_definitions') THEN
        CREATE POLICY tenant_read_metric_definitions
        ON business_core.metric_definitions FOR SELECT TO authenticated
        USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'metric_definitions' AND policyname = 'service_all_metric_definitions') THEN
        CREATE POLICY service_all_metric_definitions
        ON business_core.metric_definitions FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_business_core_metric_definitions_touch') THEN
        CREATE TRIGGER trg_business_core_metric_definitions_touch
        BEFORE UPDATE ON business_core.metric_definitions
        FOR EACH ROW EXECUTE FUNCTION business_core.touch_updated_at();
    END IF;
END $$;
