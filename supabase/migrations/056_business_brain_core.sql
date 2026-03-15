-- Business Brain Core Schema (Additive)
-- Introduces vendor-agnostic canonical model + concern/metric storage.

CREATE SCHEMA IF NOT EXISTS business_core;

-- ──────────────────────────────────────────────────────────────────────────────
-- Source lineage table
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_core.source_runs (
    source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    connector_type TEXT NOT NULL,
    connector_account_id TEXT,
    ingested_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed', 'partial')),
    error_message TEXT,
    run_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_core_source_runs_tenant ON business_core.source_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_core_source_runs_connector ON business_core.source_runs(connector_type);
CREATE INDEX IF NOT EXISTS idx_business_core_source_runs_status ON business_core.source_runs(status);
CREATE INDEX IF NOT EXISTS idx_business_core_source_runs_ingested ON business_core.source_runs(ingested_at DESC);

-- ──────────────────────────────────────────────────────────────────────────────
-- Canonical entities
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_core.owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    external_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_primary_external_id TEXT,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    source_id UUID REFERENCES business_core.source_runs(source_id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, source_primary_external_id)
);

CREATE INDEX IF NOT EXISTS idx_business_core_owners_tenant ON business_core.owners(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_core_owners_email ON business_core.owners(email);

CREATE TABLE IF NOT EXISTS business_core.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    external_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_primary_external_id TEXT,
    name TEXT NOT NULL,
    industry TEXT,
    size TEXT,
    source_id UUID REFERENCES business_core.source_runs(source_id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, source_primary_external_id)
);

CREATE INDEX IF NOT EXISTS idx_business_core_companies_tenant ON business_core.companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_core_companies_name ON business_core.companies(name);

CREATE TABLE IF NOT EXISTS business_core.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    external_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_primary_external_id TEXT,
    name TEXT,
    email TEXT,
    phone TEXT,
    status TEXT,
    company_id UUID REFERENCES business_core.companies(id) ON DELETE SET NULL,
    source_id UUID REFERENCES business_core.source_runs(source_id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, source_primary_external_id)
);

CREATE INDEX IF NOT EXISTS idx_business_core_customers_tenant ON business_core.customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_core_customers_email ON business_core.customers(email);
CREATE INDEX IF NOT EXISTS idx_business_core_customers_company ON business_core.customers(company_id);

CREATE TABLE IF NOT EXISTS business_core.deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    external_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_primary_external_id TEXT,
    customer_id UUID REFERENCES business_core.customers(id) ON DELETE SET NULL,
    company_id UUID REFERENCES business_core.companies(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES business_core.owners(id) ON DELETE SET NULL,
    stage TEXT,
    amount NUMERIC(14, 2),
    currency TEXT,
    open_date TIMESTAMPTZ,
    close_date TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    status TEXT,
    source_id UUID REFERENCES business_core.source_runs(source_id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, source_primary_external_id)
);

CREATE INDEX IF NOT EXISTS idx_business_core_deals_tenant ON business_core.deals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_core_deals_stage ON business_core.deals(stage);
CREATE INDEX IF NOT EXISTS idx_business_core_deals_status ON business_core.deals(status);
CREATE INDEX IF NOT EXISTS idx_business_core_deals_customer ON business_core.deals(customer_id);
CREATE INDEX IF NOT EXISTS idx_business_core_deals_company ON business_core.deals(company_id);
CREATE INDEX IF NOT EXISTS idx_business_core_deals_last_activity ON business_core.deals(last_activity_at DESC);

CREATE TABLE IF NOT EXISTS business_core.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    external_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_primary_external_id TEXT,
    customer_id UUID REFERENCES business_core.customers(id) ON DELETE SET NULL,
    company_id UUID REFERENCES business_core.companies(id) ON DELETE SET NULL,
    issue_date TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    status TEXT,
    invoice_type TEXT,
    amount NUMERIC(14, 2),
    currency TEXT,
    paid_at TIMESTAMPTZ,
    source_id UUID REFERENCES business_core.source_runs(source_id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, source_primary_external_id)
);

CREATE INDEX IF NOT EXISTS idx_business_core_invoices_tenant ON business_core.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_core_invoices_status ON business_core.invoices(status);
CREATE INDEX IF NOT EXISTS idx_business_core_invoices_type ON business_core.invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_business_core_invoices_due ON business_core.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_business_core_invoices_customer ON business_core.invoices(customer_id);

CREATE TABLE IF NOT EXISTS business_core.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    external_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_primary_external_id TEXT,
    invoice_id UUID REFERENCES business_core.invoices(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES business_core.customers(id) ON DELETE SET NULL,
    company_id UUID REFERENCES business_core.companies(id) ON DELETE SET NULL,
    payment_date TIMESTAMPTZ,
    method TEXT,
    amount NUMERIC(14, 2),
    currency TEXT,
    source_id UUID REFERENCES business_core.source_runs(source_id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, source_primary_external_id)
);

CREATE INDEX IF NOT EXISTS idx_business_core_payments_tenant ON business_core.payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_core_payments_invoice ON business_core.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_business_core_payments_date ON business_core.payments(payment_date DESC);

CREATE TABLE IF NOT EXISTS business_core.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    external_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_primary_external_id TEXT,
    deal_id UUID REFERENCES business_core.deals(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES business_core.customers(id) ON DELETE SET NULL,
    type TEXT,
    subject TEXT,
    body TEXT,
    activity_date TIMESTAMPTZ,
    owner_id UUID REFERENCES business_core.owners(id) ON DELETE SET NULL,
    source_id UUID REFERENCES business_core.source_runs(source_id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, source_primary_external_id)
);

CREATE INDEX IF NOT EXISTS idx_business_core_activities_tenant ON business_core.activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_core_activities_type ON business_core.activities(type);
CREATE INDEX IF NOT EXISTS idx_business_core_activities_date ON business_core.activities(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_business_core_activities_deal ON business_core.activities(deal_id);

CREATE TABLE IF NOT EXISTS business_core.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    external_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_primary_external_id TEXT,
    owner_id UUID REFERENCES business_core.owners(id) ON DELETE SET NULL,
    subject TEXT,
    status TEXT,
    due_date TIMESTAMPTZ,
    related_entity_type TEXT,
    related_entity_id UUID,
    source_id UUID REFERENCES business_core.source_runs(source_id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, source_primary_external_id)
);

CREATE INDEX IF NOT EXISTS idx_business_core_tasks_tenant ON business_core.tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_core_tasks_owner ON business_core.tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_business_core_tasks_status ON business_core.tasks(status);
CREATE INDEX IF NOT EXISTS idx_business_core_tasks_due ON business_core.tasks(due_date);

-- ──────────────────────────────────────────────────────────────────────────────
-- Concern + metrics
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_core.concern_registry (
    concern_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    required_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'paid', 'custom')),
    priority_formula JSONB NOT NULL DEFAULT '{}'::jsonb,
    deterministic_rule TEXT,
    probabilistic_model TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_core.concern_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    concern_id TEXT NOT NULL REFERENCES business_core.concern_registry(concern_id) ON DELETE CASCADE,
    priority_formula JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, concern_id)
);

CREATE INDEX IF NOT EXISTS idx_business_core_concern_overrides_tenant ON business_core.concern_overrides(tenant_id);

CREATE TABLE IF NOT EXISTS business_core.business_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    metric_name TEXT NOT NULL,
    metric_group TEXT,
    value NUMERIC,
    period TEXT NOT NULL DEFAULT 'daily',
    period_start DATE,
    period_end DATE,
    calculation_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence_score NUMERIC(6, 4) DEFAULT 1,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, metric_name, period, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_business_core_metrics_tenant ON business_core.business_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_core_metrics_name ON business_core.business_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_business_core_metrics_period ON business_core.business_metrics(period_start DESC, period_end DESC);

CREATE TABLE IF NOT EXISTS business_core.concern_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    concern_id TEXT NOT NULL REFERENCES business_core.concern_registry(concern_id) ON DELETE CASCADE,
    impact NUMERIC(6, 4) NOT NULL,
    urgency NUMERIC(6, 4) NOT NULL,
    confidence NUMERIC(6, 4) NOT NULL,
    effort NUMERIC(6, 4) NOT NULL,
    priority_score NUMERIC(10, 4) NOT NULL,
    recommendation TEXT,
    explanation TEXT,
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_core_concern_eval_tenant ON business_core.concern_evaluations(tenant_id, evaluated_at DESC);

-- ──────────────────────────────────────────────────────────────────────────────
-- Seed concern registry
-- ──────────────────────────────────────────────────────────────────────────────
INSERT INTO business_core.concern_registry (
    concern_id, name, description, required_signals, tier, priority_formula, deterministic_rule, probabilistic_model, active
) VALUES
(
    'cashflow_risk',
    'Cashflow Risk',
    'Detects near-term cash pressure from overdue receivables and burn imbalance.',
    '["overdue_ar_amount","burn_rate","cash_runway_months"]'::jsonb,
    'free',
    '{"impact_weight": 1.0, "urgency_weight": 1.0, "confidence_weight": 1.0, "effort_divisor": 1.0}'::jsonb,
    'overdue receivables > threshold OR runway < threshold',
    'cashflow_risk_model_v1',
    true
),
(
    'revenue_leakage',
    'Revenue Leakage',
    'Identifies leakage via stalled high-value deals and unresolved overdue accounts.',
    '["stalled_deal_value","overdue_ar_count","win_rate"]'::jsonb,
    'free',
    '{"impact_weight": 1.0, "urgency_weight": 1.0, "confidence_weight": 0.9, "effort_divisor": 1.0}'::jsonb,
    'stalled pipeline ratio above threshold',
    'revenue_leakage_model_v1',
    true
),
(
    'pipeline_stagnation',
    'Pipeline Stagnation',
    'Flags opportunities not progressing or inactive too long.',
    '["pipeline_value","stalled_deals_72h","sales_cycle_days"]'::jsonb,
    'free',
    '{"impact_weight": 0.9, "urgency_weight": 1.0, "confidence_weight": 0.9, "effort_divisor": 1.0}'::jsonb,
    'stalled deals proportion > threshold',
    'pipeline_stagnation_model_v1',
    true
),
(
    'client_response_risk',
    'Client Response Risk',
    'Tracks delayed client communications and priority inbox inactivity.',
    '["priority_threads","response_delay_events","lead_response_time"]'::jsonb,
    'paid',
    '{"impact_weight": 0.8, "urgency_weight": 1.0, "confidence_weight": 0.85, "effort_divisor": 1.0}'::jsonb,
    'high-priority threads unanswered > threshold',
    'response_risk_model_v1',
    true
),
(
    'concentration_risk',
    'Concentration Risk',
    'Identifies over-reliance on few customers or channels.',
    '["top_customer_share","top_channel_share"]'::jsonb,
    'paid',
    '{"impact_weight": 0.95, "urgency_weight": 0.75, "confidence_weight": 0.85, "effort_divisor": 1.0}'::jsonb,
    'top customer revenue share > threshold',
    'concentration_risk_model_v1',
    true
),
(
    'margin_compression',
    'Margin Compression',
    'Monitors gross/net margin erosion and cost pressure trends.',
    '["gross_profit_margin","net_profit_margin","opex_ratio"]'::jsonb,
    'paid',
    '{"impact_weight": 1.0, "urgency_weight": 0.8, "confidence_weight": 0.9, "effort_divisor": 1.0}'::jsonb,
    'margin declines over period windows',
    'margin_compression_model_v1',
    true
),
(
    'operations_bottlenecks',
    'Operations Bottlenecks',
    'Surfaces operational delays affecting fulfillment and delivery.',
    '["task_overdue_rate","fulfillment_time","on_time_delivery_rate"]'::jsonb,
    'custom',
    '{"impact_weight": 0.85, "urgency_weight": 0.85, "confidence_weight": 0.85, "effort_divisor": 1.0}'::jsonb,
    'overdue task ratio and service delays exceed threshold',
    'operations_bottleneck_model_v1',
    true
)
ON CONFLICT (concern_id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────────
-- Updated-at trigger helper
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION business_core.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_business_core_source_runs_touch') THEN
        CREATE TRIGGER trg_business_core_source_runs_touch BEFORE UPDATE ON business_core.source_runs
        FOR EACH ROW EXECUTE FUNCTION business_core.touch_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_business_core_owners_touch') THEN
        CREATE TRIGGER trg_business_core_owners_touch BEFORE UPDATE ON business_core.owners
        FOR EACH ROW EXECUTE FUNCTION business_core.touch_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_business_core_companies_touch') THEN
        CREATE TRIGGER trg_business_core_companies_touch BEFORE UPDATE ON business_core.companies
        FOR EACH ROW EXECUTE FUNCTION business_core.touch_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_business_core_customers_touch') THEN
        CREATE TRIGGER trg_business_core_customers_touch BEFORE UPDATE ON business_core.customers
        FOR EACH ROW EXECUTE FUNCTION business_core.touch_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_business_core_deals_touch') THEN
        CREATE TRIGGER trg_business_core_deals_touch BEFORE UPDATE ON business_core.deals
        FOR EACH ROW EXECUTE FUNCTION business_core.touch_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_business_core_invoices_touch') THEN
        CREATE TRIGGER trg_business_core_invoices_touch BEFORE UPDATE ON business_core.invoices
        FOR EACH ROW EXECUTE FUNCTION business_core.touch_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_business_core_payments_touch') THEN
        CREATE TRIGGER trg_business_core_payments_touch BEFORE UPDATE ON business_core.payments
        FOR EACH ROW EXECUTE FUNCTION business_core.touch_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_business_core_activities_touch') THEN
        CREATE TRIGGER trg_business_core_activities_touch BEFORE UPDATE ON business_core.activities
        FOR EACH ROW EXECUTE FUNCTION business_core.touch_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_business_core_tasks_touch') THEN
        CREATE TRIGGER trg_business_core_tasks_touch BEFORE UPDATE ON business_core.tasks
        FOR EACH ROW EXECUTE FUNCTION business_core.touch_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_business_core_concern_registry_touch') THEN
        CREATE TRIGGER trg_business_core_concern_registry_touch BEFORE UPDATE ON business_core.concern_registry
        FOR EACH ROW EXECUTE FUNCTION business_core.touch_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_business_core_concern_overrides_touch') THEN
        CREATE TRIGGER trg_business_core_concern_overrides_touch BEFORE UPDATE ON business_core.concern_overrides
        FOR EACH ROW EXECUTE FUNCTION business_core.touch_updated_at();
    END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE business_core.source_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_core.owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_core.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_core.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_core.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_core.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_core.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_core.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_core.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_core.concern_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_core.concern_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_core.business_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_core.concern_evaluations ENABLE ROW LEVEL SECURITY;

-- Authenticated tenant-scoped access
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'source_runs' AND policyname = 'tenant_rw_source_runs') THEN
        CREATE POLICY tenant_rw_source_runs ON business_core.source_runs FOR ALL TO authenticated
        USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'owners' AND policyname = 'tenant_rw_owners') THEN
        CREATE POLICY tenant_rw_owners ON business_core.owners FOR ALL TO authenticated
        USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'companies' AND policyname = 'tenant_rw_companies') THEN
        CREATE POLICY tenant_rw_companies ON business_core.companies FOR ALL TO authenticated
        USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'customers' AND policyname = 'tenant_rw_customers') THEN
        CREATE POLICY tenant_rw_customers ON business_core.customers FOR ALL TO authenticated
        USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'deals' AND policyname = 'tenant_rw_deals') THEN
        CREATE POLICY tenant_rw_deals ON business_core.deals FOR ALL TO authenticated
        USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'invoices' AND policyname = 'tenant_rw_invoices') THEN
        CREATE POLICY tenant_rw_invoices ON business_core.invoices FOR ALL TO authenticated
        USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'payments' AND policyname = 'tenant_rw_payments') THEN
        CREATE POLICY tenant_rw_payments ON business_core.payments FOR ALL TO authenticated
        USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'activities' AND policyname = 'tenant_rw_activities') THEN
        CREATE POLICY tenant_rw_activities ON business_core.activities FOR ALL TO authenticated
        USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'tasks' AND policyname = 'tenant_rw_tasks') THEN
        CREATE POLICY tenant_rw_tasks ON business_core.tasks FOR ALL TO authenticated
        USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'concern_overrides' AND policyname = 'tenant_rw_concern_overrides') THEN
        CREATE POLICY tenant_rw_concern_overrides ON business_core.concern_overrides FOR ALL TO authenticated
        USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'business_metrics' AND policyname = 'tenant_rw_business_metrics') THEN
        CREATE POLICY tenant_rw_business_metrics ON business_core.business_metrics FOR ALL TO authenticated
        USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'concern_evaluations' AND policyname = 'tenant_rw_concern_evaluations') THEN
        CREATE POLICY tenant_rw_concern_evaluations ON business_core.concern_evaluations FOR ALL TO authenticated
        USING (tenant_id = auth.uid()) WITH CHECK (tenant_id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'concern_registry' AND policyname = 'tenant_read_concern_registry') THEN
        CREATE POLICY tenant_read_concern_registry ON business_core.concern_registry FOR SELECT TO authenticated
        USING (true);
    END IF;
END $$;

-- Service role full access
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'source_runs' AND policyname = 'service_all_source_runs') THEN
        CREATE POLICY service_all_source_runs ON business_core.source_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'owners' AND policyname = 'service_all_owners') THEN
        CREATE POLICY service_all_owners ON business_core.owners FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'companies' AND policyname = 'service_all_companies') THEN
        CREATE POLICY service_all_companies ON business_core.companies FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'customers' AND policyname = 'service_all_customers') THEN
        CREATE POLICY service_all_customers ON business_core.customers FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'deals' AND policyname = 'service_all_deals') THEN
        CREATE POLICY service_all_deals ON business_core.deals FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'invoices' AND policyname = 'service_all_invoices') THEN
        CREATE POLICY service_all_invoices ON business_core.invoices FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'payments' AND policyname = 'service_all_payments') THEN
        CREATE POLICY service_all_payments ON business_core.payments FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'activities' AND policyname = 'service_all_activities') THEN
        CREATE POLICY service_all_activities ON business_core.activities FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'tasks' AND policyname = 'service_all_tasks') THEN
        CREATE POLICY service_all_tasks ON business_core.tasks FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'concern_registry' AND policyname = 'service_all_concern_registry') THEN
        CREATE POLICY service_all_concern_registry ON business_core.concern_registry FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'concern_overrides' AND policyname = 'service_all_concern_overrides') THEN
        CREATE POLICY service_all_concern_overrides ON business_core.concern_overrides FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'business_metrics' AND policyname = 'service_all_business_metrics') THEN
        CREATE POLICY service_all_business_metrics ON business_core.business_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'business_core' AND tablename = 'concern_evaluations' AND policyname = 'service_all_concern_evaluations') THEN
        CREATE POLICY service_all_concern_evaluations ON business_core.concern_evaluations FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

GRANT USAGE ON SCHEMA business_core TO authenticated;
GRANT USAGE ON SCHEMA business_core TO service_role;
