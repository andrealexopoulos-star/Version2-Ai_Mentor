-- ═══════════════════════════════════════════════════════════════
-- BIQc INTELLIGENCE SPINE — Additive Schema Deployment
-- Migration: 030_intelligence_spine.sql
--
-- MODE: Additive only. Zero modifications to public schema.
-- All structures in intelligence_core schema.
-- Dormant until intelligence_spine_enabled = TRUE.
-- ═══════════════════════════════════════════════════════════════


-- ═══ PHASE 1: SCHEMA ═══
CREATE SCHEMA IF NOT EXISTS intelligence_core;


-- ═══ 1. CANONICAL EVENT TYPE ═══
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'intelligence_core')) THEN
        CREATE TYPE intelligence_core.event_type AS ENUM (
            'OBJECT_CREATED',
            'OBJECT_UPDATED',
            'STATE_TRANSITION',
            'METRIC_CHANGE',
            'FORECAST_RUN',
            'ANOMALY_DETECTED',
            'CHURN_SCORE_UPDATED',
            'DECISION_CREATED',
            'DECISION_OUTCOME_RECORDED',
            'MODEL_EXECUTED'
        );
    END IF;
END $$;


-- ═══ 2. CANONICAL EVENT LOG ═══
CREATE TABLE IF NOT EXISTS intelligence_core.intelligence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    event_type intelligence_core.event_type NOT NULL,
    object_id UUID,
    model_name TEXT,
    numeric_payload FLOAT,
    json_payload JSONB,
    confidence_score FLOAT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_events_tenant ON intelligence_core.intelligence_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ic_events_type ON intelligence_core.intelligence_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ic_events_created ON intelligence_core.intelligence_events(created_at DESC);


-- ═══ 3. DAILY METRIC SNAPSHOTS ═══
CREATE TABLE IF NOT EXISTS intelligence_core.daily_metric_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    snapshot_date DATE NOT NULL,
    revenue NUMERIC,
    cash_balance NUMERIC,
    deal_velocity FLOAT,
    engagement_score FLOAT,
    risk_score FLOAT,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE (tenant_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_ic_snapshots_tenant_date ON intelligence_core.daily_metric_snapshots(tenant_id, snapshot_date DESC);


-- ═══ 4. ONTOLOGY GRAPH ═══
CREATE TABLE IF NOT EXISTS intelligence_core.ontology_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    node_type TEXT NOT NULL,
    attributes JSONB NOT NULL,
    current_state TEXT,
    risk_score FLOAT DEFAULT 0,
    confidence_score FLOAT DEFAULT 1,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intelligence_core.ontology_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    from_node UUID REFERENCES intelligence_core.ontology_nodes(id) ON DELETE CASCADE,
    to_node UUID REFERENCES intelligence_core.ontology_nodes(id) ON DELETE CASCADE,
    edge_type TEXT,
    weight FLOAT DEFAULT 1,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_nodes_tenant ON intelligence_core.ontology_nodes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ic_nodes_type ON intelligence_core.ontology_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_ic_edges_from ON intelligence_core.ontology_edges(from_node);
CREATE INDEX IF NOT EXISTS idx_ic_edges_to ON intelligence_core.ontology_edges(to_node);
CREATE INDEX IF NOT EXISTS idx_ic_edges_tenant ON intelligence_core.ontology_edges(tenant_id);


-- ═══ 5. DECISION REGISTRY ═══
CREATE TABLE IF NOT EXISTS intelligence_core.decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    decision_category TEXT NOT NULL,
    context_snapshot JSONB NOT NULL,
    predicted_impact FLOAT,
    predicted_confidence FLOAT,
    risk_level_at_time FLOAT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intelligence_core.decision_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID REFERENCES intelligence_core.decisions(id) ON DELETE CASCADE,
    outcome_30d FLOAT,
    outcome_60d FLOAT,
    outcome_90d FLOAT,
    actual_impact FLOAT,
    variance_delta FLOAT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_decisions_tenant ON intelligence_core.decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ic_outcomes_decision ON intelligence_core.decision_outcomes(decision_id);


-- ═══ 6. MODEL GOVERNANCE ═══
CREATE TABLE IF NOT EXISTS intelligence_core.model_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    feature_schema_version TEXT,
    training_data_start DATE,
    training_data_end DATE,
    accuracy_metric FLOAT,
    drift_score FLOAT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intelligence_core.model_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT,
    model_version TEXT,
    tenant_id UUID,
    execution_time_ms INT,
    confidence_score FLOAT,
    output_summary JSONB,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_registry_name ON intelligence_core.model_registry(model_name);
CREATE INDEX IF NOT EXISTS idx_ic_executions_tenant ON intelligence_core.model_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ic_executions_model ON intelligence_core.model_executions(model_name);


-- ═══ 7. FEATURE FLAG ═══
CREATE TABLE IF NOT EXISTS intelligence_core.feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name TEXT UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMP DEFAULT now()
);

INSERT INTO intelligence_core.feature_flags (flag_name, enabled, description)
VALUES ('intelligence_spine_enabled', false, 'Master switch for Intelligence Spine. When FALSE, all modelling engines are dormant.')
ON CONFLICT (flag_name) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════
-- PHASE 2: RLS — Tenant isolation on all tables
-- Mirrors existing public schema pattern
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE intelligence_core.intelligence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_core.daily_metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_core.ontology_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_core.ontology_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_core.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_core.decision_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_core.model_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_core.model_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_core.feature_flags ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped read policies (authenticated users read own tenant data)
CREATE POLICY "tenant_read_events" ON intelligence_core.intelligence_events
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "tenant_read_snapshots" ON intelligence_core.daily_metric_snapshots
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "tenant_read_nodes" ON intelligence_core.ontology_nodes
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "tenant_read_edges" ON intelligence_core.ontology_edges
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "tenant_read_decisions" ON intelligence_core.decisions
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "tenant_read_outcomes" ON intelligence_core.decision_outcomes
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "tenant_read_registry" ON intelligence_core.model_registry
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "tenant_read_executions" ON intelligence_core.model_executions
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "anyone_read_flags" ON intelligence_core.feature_flags
    FOR SELECT TO authenticated USING (true);

-- Service role full access (for backend operations)
CREATE POLICY "service_all_events" ON intelligence_core.intelligence_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_snapshots" ON intelligence_core.daily_metric_snapshots
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_nodes" ON intelligence_core.ontology_nodes
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_edges" ON intelligence_core.ontology_edges
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_decisions" ON intelligence_core.decisions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_outcomes" ON intelligence_core.decision_outcomes
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_registry" ON intelligence_core.model_registry
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_executions" ON intelligence_core.model_executions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_flags" ON intelligence_core.feature_flags
    FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════
-- PHASE 3: Feature flag check function (non-destructive)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION intelligence_core.is_spine_enabled()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
        (SELECT enabled FROM intelligence_core.feature_flags WHERE flag_name = 'intelligence_spine_enabled'),
        false
    );
$$;

GRANT USAGE ON SCHEMA intelligence_core TO authenticated;
GRANT USAGE ON SCHEMA intelligence_core TO service_role;
GRANT EXECUTE ON FUNCTION intelligence_core.is_spine_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION intelligence_core.is_spine_enabled() TO service_role;
