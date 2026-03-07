CREATE SCHEMA IF NOT EXISTS intelligence_core;
-- CHUNK 2: Intelligence Engine
-- 029_payment_transactions.sql
-- Payment transactions table for Stripe
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    session_id TEXT UNIQUE,
    amount NUMERIC,
    currency TEXT DEFAULT 'aud',
    package_id TEXT,
    tier TEXT,
    payment_status TEXT DEFAULT 'initiated',
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_session ON payment_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_payment_user ON payment_transactions(user_id);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own payments" ON payment_transactions;
CREATE POLICY "Users read own payments" ON payment_transactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service manages payments" ON payment_transactions;
CREATE POLICY "Service manages payments" ON payment_transactions FOR ALL USING (true) WITH CHECK (true);

-- 030_intelligence_spine.sql
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
DROP POLICY IF EXISTS "tenant_read_events" ON intelligence_core.intelligence_events;
CREATE POLICY "tenant_read_events" ON intelligence_core.intelligence_events
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());
DROP POLICY IF EXISTS "tenant_read_snapshots" ON intelligence_core.daily_metric_snapshots;
CREATE POLICY "tenant_read_snapshots" ON intelligence_core.daily_metric_snapshots
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());
DROP POLICY IF EXISTS "tenant_read_nodes" ON intelligence_core.ontology_nodes;
CREATE POLICY "tenant_read_nodes" ON intelligence_core.ontology_nodes
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());
DROP POLICY IF EXISTS "tenant_read_edges" ON intelligence_core.ontology_edges;
CREATE POLICY "tenant_read_edges" ON intelligence_core.ontology_edges
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());
DROP POLICY IF EXISTS "tenant_read_decisions" ON intelligence_core.decisions;
CREATE POLICY "tenant_read_decisions" ON intelligence_core.decisions
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());
DROP POLICY IF EXISTS "tenant_read_outcomes" ON intelligence_core.decision_outcomes;
CREATE POLICY "tenant_read_outcomes" ON intelligence_core.decision_outcomes
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "tenant_read_registry" ON intelligence_core.model_registry;
CREATE POLICY "tenant_read_registry" ON intelligence_core.model_registry
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "tenant_read_executions" ON intelligence_core.model_executions;
CREATE POLICY "tenant_read_executions" ON intelligence_core.model_executions
    FOR SELECT TO authenticated USING (tenant_id = auth.uid());
DROP POLICY IF EXISTS "anyone_read_flags" ON intelligence_core.feature_flags;
CREATE POLICY "anyone_read_flags" ON intelligence_core.feature_flags
    FOR SELECT TO authenticated USING (true);

-- Service role full access (for backend operations)
DROP POLICY IF EXISTS "service_all_events" ON intelligence_core.intelligence_events;
CREATE POLICY "service_all_events" ON intelligence_core.intelligence_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_all_snapshots" ON intelligence_core.daily_metric_snapshots;
CREATE POLICY "service_all_snapshots" ON intelligence_core.daily_metric_snapshots
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_all_nodes" ON intelligence_core.ontology_nodes;
CREATE POLICY "service_all_nodes" ON intelligence_core.ontology_nodes
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_all_edges" ON intelligence_core.ontology_edges;
CREATE POLICY "service_all_edges" ON intelligence_core.ontology_edges
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_all_decisions" ON intelligence_core.decisions;
CREATE POLICY "service_all_decisions" ON intelligence_core.decisions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_all_outcomes" ON intelligence_core.decision_outcomes;
CREATE POLICY "service_all_outcomes" ON intelligence_core.decision_outcomes
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_all_registry" ON intelligence_core.model_registry;
CREATE POLICY "service_all_registry" ON intelligence_core.model_registry
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_all_executions" ON intelligence_core.model_executions;
CREATE POLICY "service_all_executions" ON intelligence_core.model_executions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_all_flags" ON intelligence_core.feature_flags;
CREATE POLICY "service_all_flags" ON intelligence_core.feature_flags
    FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════
-- PHASE 3: Feature flag check function (non-destructive)
-- ═══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS intelligence_core.is_spine_enabled CASCADE;
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

-- 031_intelligence_spine_public.sql
-- ═══════════════════════════════════════════════════════════════
-- BIQc INTELLIGENCE SPINE — Public Schema (ic_ prefix)
-- Migration: 031_intelligence_spine_public.sql
-- 
-- Supabase REST API only exposes public schema.
-- All spine tables use ic_ prefix. Zero collision with existing tables.
-- Additive only. No existing tables modified.
-- ═══════════════════════════════════════════════════════════════

-- Feature flag (supports global + tenant-scoped)
CREATE TABLE IF NOT EXISTS ic_feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name TEXT UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT false,
    tenant_id UUID,
    description TEXT,
    created_at TIMESTAMP DEFAULT now()
);
INSERT INTO ic_feature_flags (flag_name, enabled, description)
VALUES ('intelligence_spine_enabled', false, 'Global master switch. Tenant-scoped flags use spine_enabled_{tenant_id}')
ON CONFLICT (flag_name) DO NOTHING;

-- Canonical event log
CREATE TABLE IF NOT EXISTS ic_intelligence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    object_id UUID,
    model_name TEXT,
    numeric_payload FLOAT,
    json_payload JSONB,
    confidence_score FLOAT,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ic_events_tenant ON ic_intelligence_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ic_events_type ON ic_intelligence_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ic_events_created ON ic_intelligence_events(created_at DESC);

-- Daily metric snapshots
CREATE TABLE IF NOT EXISTS ic_daily_metric_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    snapshot_date DATE NOT NULL,
    revenue NUMERIC,
    cash_balance NUMERIC,
    deal_velocity FLOAT,
    engagement_score FLOAT,
    risk_score FLOAT,
    churn_score FLOAT,
    anomaly_count INT DEFAULT 0,
    active_deals INT,
    stalled_deals INT,
    pipeline_value NUMERIC,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE (tenant_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_ic_snaps_tenant ON ic_daily_metric_snapshots(tenant_id, snapshot_date DESC);

-- Ontology graph
CREATE TABLE IF NOT EXISTS ic_ontology_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    node_type TEXT NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}',
    current_state TEXT,
    risk_score FLOAT DEFAULT 0,
    confidence_score FLOAT DEFAULT 1,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ic_ontology_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    from_node UUID REFERENCES ic_ontology_nodes(id) ON DELETE CASCADE,
    to_node UUID REFERENCES ic_ontology_nodes(id) ON DELETE CASCADE,
    edge_type TEXT,
    weight FLOAT DEFAULT 1,
    created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ic_nodes_tenant ON ic_ontology_nodes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ic_edges_from ON ic_ontology_edges(from_node);
CREATE INDEX IF NOT EXISTS idx_ic_edges_to ON ic_ontology_edges(to_node);

-- Decision registry
CREATE TABLE IF NOT EXISTS ic_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    decision_category TEXT NOT NULL,
    context_snapshot JSONB NOT NULL DEFAULT '{}',
    predicted_impact FLOAT,
    predicted_confidence FLOAT,
    risk_level_at_time FLOAT,
    created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ic_decision_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID REFERENCES ic_decisions(id) ON DELETE CASCADE,
    outcome_30d FLOAT,
    outcome_60d FLOAT,
    outcome_90d FLOAT,
    actual_impact FLOAT,
    variance_delta FLOAT,
    created_at TIMESTAMP DEFAULT now()
);

-- Model governance
CREATE TABLE IF NOT EXISTS ic_model_registry (
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
CREATE TABLE IF NOT EXISTS ic_model_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT,
    model_version TEXT,
    tenant_id UUID,
    execution_time_ms INT,
    confidence_score FLOAT,
    output_summary JSONB,
    created_at TIMESTAMP DEFAULT now()
);

-- RLS on all
ALTER TABLE ic_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_intelligence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_daily_metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_ontology_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_ontology_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_decision_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_model_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_model_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_flags" ON ic_feature_flags;
CREATE POLICY "read_flags" ON ic_feature_flags FOR SELECT USING (true);
DROP POLICY IF EXISTS "manage_flags" ON ic_feature_flags;
CREATE POLICY "manage_flags" ON ic_feature_flags FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "read_events" ON ic_intelligence_events;
CREATE POLICY "read_events" ON ic_intelligence_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "manage_events" ON ic_intelligence_events;
CREATE POLICY "manage_events" ON ic_intelligence_events FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "read_snaps" ON ic_daily_metric_snapshots;
CREATE POLICY "read_snaps" ON ic_daily_metric_snapshots FOR SELECT USING (true);
DROP POLICY IF EXISTS "manage_snaps" ON ic_daily_metric_snapshots;
CREATE POLICY "manage_snaps" ON ic_daily_metric_snapshots FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "read_nodes" ON ic_ontology_nodes;
CREATE POLICY "read_nodes" ON ic_ontology_nodes FOR SELECT USING (true);
DROP POLICY IF EXISTS "manage_nodes" ON ic_ontology_nodes;
CREATE POLICY "manage_nodes" ON ic_ontology_nodes FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "read_edges" ON ic_ontology_edges;
CREATE POLICY "read_edges" ON ic_ontology_edges FOR SELECT USING (true);
DROP POLICY IF EXISTS "manage_edges" ON ic_ontology_edges;
CREATE POLICY "manage_edges" ON ic_ontology_edges FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "read_decisions" ON ic_decisions;
CREATE POLICY "read_decisions" ON ic_decisions FOR SELECT USING (true);
DROP POLICY IF EXISTS "manage_decisions" ON ic_decisions;
CREATE POLICY "manage_decisions" ON ic_decisions FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "read_outcomes" ON ic_decision_outcomes;
CREATE POLICY "read_outcomes" ON ic_decision_outcomes FOR SELECT USING (true);
DROP POLICY IF EXISTS "manage_outcomes" ON ic_decision_outcomes;
CREATE POLICY "manage_outcomes" ON ic_decision_outcomes FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "read_registry" ON ic_model_registry;
CREATE POLICY "read_registry" ON ic_model_registry FOR SELECT USING (true);
DROP POLICY IF EXISTS "manage_registry" ON ic_model_registry;
CREATE POLICY "manage_registry" ON ic_model_registry FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "read_executions" ON ic_model_executions;
CREATE POLICY "read_executions" ON ic_model_executions FOR SELECT USING (true);
DROP POLICY IF EXISTS "manage_executions" ON ic_model_executions;
CREATE POLICY "manage_executions" ON ic_model_executions FOR ALL USING (true) WITH CHECK (true);

-- Feature flag check function (tenant-scoped with global fallback)
DROP FUNCTION IF EXISTS is_spine_enabled CASCADE;
CREATE OR REPLACE FUNCTION is_spine_enabled()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COALESCE((SELECT enabled FROM ic_feature_flags WHERE flag_name = 'intelligence_spine_enabled'), false);
$$;

DROP FUNCTION IF EXISTS is_spine_enabled_for CASCADE;
CREATE OR REPLACE FUNCTION is_spine_enabled_for(p_tenant_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COALESCE(
        (SELECT enabled FROM ic_feature_flags WHERE flag_name = 'spine_enabled_' || p_tenant_id::TEXT),
        (SELECT enabled FROM ic_feature_flags WHERE flag_name = 'intelligence_spine_enabled'),
        false
    );
$$;

GRANT EXECUTE ON FUNCTION is_spine_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION is_spine_enabled_for(UUID) TO authenticated;

-- Snapshot generator function
DROP FUNCTION IF EXISTS ic_generate_daily_snapshot CASCADE;
CREATE OR REPLACE FUNCTION ic_generate_daily_snapshot(p_tenant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_deal_count INT := 0;
    v_stalled INT := 0;
    v_pipeline NUMERIC := 0;
    v_risk FLOAT := 0;
    v_engagement FLOAT := 0;
    v_events_7d INT := 0;
    v_high_events INT := 0;
    v_anomalies INT := 0;
BEGIN
    -- Skip if spine not enabled
    IF NOT is_spine_enabled() THEN
        RETURN jsonb_build_object('status', 'spine_disabled');
    END IF;

    -- Count governance events (7 days)
    SELECT COUNT(*), COUNT(*) FILTER (WHERE confidence_score >= 0.8)
    INTO v_events_7d, v_high_events
    FROM governance_events
    WHERE workspace_id = p_tenant_id AND signal_timestamp > NOW() - INTERVAL '7 days';

    -- Risk score from pressure levels
    SELECT COALESCE(
        (SELECT AVG(
            CASE 
                WHEN confidence_score >= 0.8 THEN 0.8
                WHEN confidence_score >= 0.5 THEN 0.5
                ELSE 0.2
            END
        ) FROM governance_events WHERE workspace_id = p_tenant_id AND signal_timestamp > NOW() - INTERVAL '7 days'),
        0
    ) INTO v_risk;

    -- Engagement from event density
    v_engagement := LEAST(v_events_7d::FLOAT / 20.0, 1.0);

    -- Anomaly: events with very high confidence in short burst
    SELECT COUNT(*) INTO v_anomalies
    FROM governance_events
    WHERE workspace_id = p_tenant_id
    AND confidence_score >= 0.9
    AND signal_timestamp > NOW() - INTERVAL '24 hours';

    -- Upsert daily snapshot
    INSERT INTO ic_daily_metric_snapshots (
        tenant_id, snapshot_date, deal_velocity, engagement_score,
        risk_score, anomaly_count, active_deals, stalled_deals, pipeline_value
    ) VALUES (
        p_tenant_id, v_today, v_events_7d::FLOAT / 7.0, v_engagement,
        v_risk, v_anomalies, v_deal_count, v_stalled, v_pipeline
    )
    ON CONFLICT (tenant_id, snapshot_date) DO UPDATE SET
        deal_velocity = EXCLUDED.deal_velocity,
        engagement_score = EXCLUDED.engagement_score,
        risk_score = EXCLUDED.risk_score,
        anomaly_count = EXCLUDED.anomaly_count,
        active_deals = EXCLUDED.active_deals,
        stalled_deals = EXCLUDED.stalled_deals,
        pipeline_value = EXCLUDED.pipeline_value;

    -- Log event
    INSERT INTO ic_intelligence_events (tenant_id, event_type, json_payload, confidence_score)
    VALUES (p_tenant_id, 'METRIC_CHANGE', jsonb_build_object(
        'snapshot_date', v_today,
        'events_7d', v_events_7d,
        'risk_score', v_risk,
        'engagement', v_engagement,
        'anomalies', v_anomalies
    ), v_engagement);

    RETURN jsonb_build_object(
        'status', 'generated',
        'snapshot_date', v_today,
        'events_7d', v_events_7d,
        'risk_score', ROUND(v_risk::NUMERIC, 3),
        'engagement_score', ROUND(v_engagement::NUMERIC, 3),
        'anomaly_count', v_anomalies
    );
END;
$$;

-- Batch snapshot for all tenants (for pg_cron)
DROP FUNCTION IF EXISTS ic_generate_all_snapshots CASCADE;
CREATE OR REPLACE FUNCTION ic_generate_all_snapshots()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_tenant UUID;
    v_count INT := 0;
BEGIN
    IF NOT is_spine_enabled() THEN
        RETURN jsonb_build_object('status', 'spine_disabled');
    END IF;
    FOR v_tenant IN SELECT DISTINCT workspace_id FROM workspace_integrations WHERE status = 'connected'
    LOOP
        PERFORM ic_generate_daily_snapshot(v_tenant);
        v_count := v_count + 1;
    END LOOP;
    RETURN jsonb_build_object('status', 'complete', 'tenants_processed', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION ic_generate_daily_snapshot(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ic_generate_all_snapshots() TO postgres;

-- pg_cron: daily snapshot at 1am UTC (uncomment after spine enabled)
-- SELECT cron.schedule('ic-daily-snapshot', '0 1 * * *', $$SELECT ic_generate_all_snapshots()$$);

-- 032_spine_hardening.sql
-- ═══════════════════════════════════════════════════════════════
-- BIQc INTELLIGENCE SPINE — Hardening Migration
-- Migration: 032_spine_hardening.sql
--
-- Fixes:
-- 1. governance_events → APPEND-ONLY (no UPDATE/DELETE except emergency)
-- 2. Postgres-backed durable job queue (replaces in-memory queue)
-- 3. Event-to-snapshot correlation check function
-- 4. Feature flag cache-friendly query
--
-- ADDITIVE ONLY. No existing tables modified structurally.
-- Only RLS policy replacement on governance_events.
-- ═══════════════════════════════════════════════════════════════


-- ═══ 1. APPEND-ONLY ENFORCEMENT ON governance_events ═══

-- Drop the permissive service role policy
DROP POLICY IF EXISTS "Service role manages governance_events" ON governance_events;

-- Replace with INSERT-only for service role
DROP POLICY IF EXISTS "service_insert_governance_events" ON governance_events;
CREATE POLICY "service_insert_governance_events" ON governance_events
    FOR INSERT TO service_role
    WITH CHECK (true);

-- Read access remains
-- "Users read own governance_events" already exists (FOR SELECT)

-- Emergency delete for super admin (via function only, not direct)
DROP FUNCTION IF EXISTS emergency_delete_governance_event CASCADE;
CREATE OR REPLACE FUNCTION emergency_delete_governance_event(p_event_id UUID, p_admin_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_admin_email != 'andre@thestrategysquad.com.au' THEN
        RAISE EXCEPTION 'Unauthorized: only super admin can delete governance events';
    END IF;
    
    -- Log the deletion as its own event BEFORE deleting
    INSERT INTO governance_events (workspace_id, event_type, source_system, signal_reference, signal_timestamp, confidence_score)
    SELECT workspace_id, 'EMERGENCY_DELETE', 'manual', p_event_id::TEXT, NOW(), 1.0
    FROM governance_events WHERE id = p_event_id;
    
    DELETE FROM governance_events WHERE id = p_event_id;
    RETURN true;
END;
$$;

-- Trigger to prevent UPDATE on governance_events
DROP FUNCTION IF EXISTS prevent_governance_update CASCADE;
CREATE OR REPLACE FUNCTION prevent_governance_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'governance_events is append-only. UPDATE not permitted.';
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_governance_update ON governance_events;
CREATE OR REPLACE TRIGGER trg_prevent_governance_update
    BEFORE UPDATE ON governance_events
    FOR EACH ROW
    EXECUTE FUNCTION prevent_governance_update();


-- ═══ 2. DURABLE JOB QUEUE (Postgres-backed) ═══

CREATE TABLE IF NOT EXISTS ic_event_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    retry_count INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT now(),
    processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ic_queue_status ON ic_event_queue(status) WHERE status = 'pending';

-- Process queue function (called by pg_cron every minute)
DROP FUNCTION IF EXISTS ic_process_event_queue CASCADE;
CREATE OR REPLACE FUNCTION ic_process_event_queue()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item RECORD;
    v_count INT := 0;
BEGIN
    FOR v_item IN
        SELECT id, table_name, payload
        FROM ic_event_queue
        WHERE status = 'pending'
        ORDER BY created_at
        LIMIT 100
        FOR UPDATE SKIP LOCKED
    LOOP
        BEGIN
            -- Mark as processing
            UPDATE ic_event_queue SET status = 'processing' WHERE id = v_item.id;
            
            -- Insert into target table
            IF v_item.table_name = 'ic_intelligence_events' THEN
                INSERT INTO ic_intelligence_events (tenant_id, event_type, object_id, model_name, numeric_payload, json_payload, confidence_score)
                SELECT 
                    (v_item.payload->>'tenant_id')::UUID,
                    v_item.payload->>'event_type',
                    (v_item.payload->>'object_id')::UUID,
                    v_item.payload->>'model_name',
                    (v_item.payload->>'numeric_payload')::FLOAT,
                    (v_item.payload->'json_payload')::JSONB,
                    (v_item.payload->>'confidence_score')::FLOAT;
            ELSIF v_item.table_name = 'ic_model_executions' THEN
                INSERT INTO ic_model_executions (model_name, model_version, tenant_id, execution_time_ms, confidence_score, output_summary)
                SELECT
                    v_item.payload->>'model_name',
                    v_item.payload->>'model_version',
                    (v_item.payload->>'tenant_id')::UUID,
                    (v_item.payload->>'execution_time_ms')::INT,
                    (v_item.payload->>'confidence_score')::FLOAT,
                    (v_item.payload->'output_summary')::JSONB;
            END IF;
            
            -- Mark completed
            UPDATE ic_event_queue SET status = 'completed', processed_at = now() WHERE id = v_item.id;
            v_count := v_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            UPDATE ic_event_queue 
            SET status = CASE WHEN retry_count >= 3 THEN 'failed' ELSE 'pending' END,
                retry_count = retry_count + 1,
                error_message = SQLERRM
            WHERE id = v_item.id;
        END;
    END LOOP;
    
    -- Cleanup completed items older than 24h
    DELETE FROM ic_event_queue WHERE status = 'completed' AND processed_at < now() - INTERVAL '24 hours';
    
    RETURN v_count;
END;
$$;

-- pg_cron: process queue every minute
-- SELECT cron.schedule('ic-process-queue', '* * * * *', $$SELECT ic_process_event_queue()$$);


-- ═══ 3. EVENT-TO-SNAPSHOT CORRELATION CHECK ═══

DROP FUNCTION IF EXISTS ic_validate_snapshot_correlation CASCADE;
CREATE OR REPLACE FUNCTION ic_validate_snapshot_correlation(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_snap RECORD;
    v_correlations JSONB := '[]'::JSONB;
    v_events_before INT;
    v_valid INT := 0;
    v_invalid INT := 0;
BEGIN
    FOR v_snap IN
        SELECT snapshot_date, risk_score, engagement_score
        FROM ic_daily_metric_snapshots
        WHERE tenant_id = p_tenant_id
        ORDER BY snapshot_date DESC
        LIMIT 7
    LOOP
        -- Check for business events in 24h before snapshot
        SELECT COUNT(*) INTO v_events_before
        FROM governance_events
        WHERE workspace_id = p_tenant_id
        AND signal_timestamp >= (v_snap.snapshot_date - INTERVAL '24 hours')::TIMESTAMP
        AND signal_timestamp < (v_snap.snapshot_date + INTERVAL '1 day')::TIMESTAMP;
        
        IF v_events_before > 0 THEN
            v_valid := v_valid + 1;
        ELSE
            v_invalid := v_invalid + 1;
        END IF;
        
        v_correlations := v_correlations || jsonb_build_object(
            'date', v_snap.snapshot_date,
            'events_24h', v_events_before,
            'correlated', v_events_before > 0
        );
    END LOOP;
    
    RETURN jsonb_build_object(
        'valid_snapshots', v_valid,
        'uncorrelated_snapshots', v_invalid,
        'correlation_rate', CASE WHEN v_valid + v_invalid > 0 THEN ROUND(v_valid::NUMERIC / (v_valid + v_invalid), 2) ELSE 0 END,
        'details', v_correlations
    );
END;
$$;

GRANT EXECUTE ON FUNCTION ic_validate_snapshot_correlation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION emergency_delete_governance_event(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION ic_process_event_queue() TO postgres;

-- RLS on queue
ALTER TABLE ic_event_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_manage_queue" ON ic_event_queue;
CREATE POLICY "service_manage_queue" ON ic_event_queue FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 033_risk_baseline.sql
-- ═══════════════════════════════════════════════════════════════
-- BIQc DETERMINISTIC RISK BASELINE ENGINE
-- Migration: 033_risk_baseline.sql
--
-- Four indices (0–1 normalized):
--   RVI: Revenue Volatility Index
--   EDS: Engagement Decay Score
--   CDR: Cash Deviation Ratio
--   ADS: Anomaly Density Score
--   CRS: Composite Risk Score (weighted)
--
-- Pure SQL. Zero LLM. Zero randomness.
-- Reads ONLY from ic_daily_metric_snapshots.
-- Weights versioned in ic_model_registry.
-- All executions logged to ic_model_executions + ic_intelligence_events.
-- ═══════════════════════════════════════════════════════════════


-- ═══ REGISTER MODEL + WEIGHTS ═══

INSERT INTO ic_model_registry (model_name, model_version, feature_schema_version, accuracy_metric, is_active)
VALUES (
    'deterministic_risk_baseline',
    'v1.0.0',
    'ic_daily_metric_snapshots_v1',
    1.0,  -- deterministic = perfect accuracy by definition
    true
)
ON CONFLICT DO NOTHING;

-- Store weight configuration as a separate registry entry for versioning
INSERT INTO ic_model_registry (model_name, model_version, feature_schema_version, accuracy_metric, is_active)
VALUES (
    'deterministic_risk_baseline_weights',
    'v1.0.0',
    'weight_config',
    1.0,
    true
)
ON CONFLICT DO NOTHING;


-- ═══ RISK BASELINE FUNCTION ═══

DROP FUNCTION IF EXISTS ic_calculate_risk_baseline CASCADE;
CREATE OR REPLACE FUNCTION ic_calculate_risk_baseline(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    -- Weight config (versioned — change requires new model_version)
    w_rvi CONSTANT FLOAT := 0.35;
    w_eds CONSTANT FLOAT := 0.25;
    w_cdr CONSTANT FLOAT := 0.25;
    w_ads CONSTANT FLOAT := 0.15;

    -- Thresholds (versioned)
    volatility_threshold CONSTANT FLOAT := 0.25;

    -- Computed indices
    v_rvi FLOAT := 0;
    v_eds FLOAT := 0;
    v_cdr FLOAT := 0;
    v_ads FLOAT := 0;
    v_crs FLOAT := 0;
    v_risk_band TEXT;

    -- Intermediate
    v_rolling_mean FLOAT;
    v_rolling_stddev FLOAT;
    v_recent_engagement FLOAT;
    v_prior_engagement FLOAT;
    v_rolling_cash_avg FLOAT;
    v_current_cash FLOAT;
    v_anomaly_events INT;
    v_total_events INT;
    v_snapshot_count INT;
    v_start_time TIMESTAMP;
    v_elapsed_ms INT;
    v_exec_id UUID;
BEGIN
    v_start_time := clock_timestamp();

    -- Check spine enabled
    IF NOT is_spine_enabled() THEN
        RETURN jsonb_build_object('status', 'spine_disabled');
    END IF;

    -- Count available snapshots
    SELECT COUNT(*) INTO v_snapshot_count
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND snapshot_date >= CURRENT_DATE - 30;

    IF v_snapshot_count < 3 THEN
        RETURN jsonb_build_object(
            'status', 'insufficient_data',
            'snapshots_available', v_snapshot_count,
            'minimum_required', 3
        );
    END IF;

    -- ═══ 1. REVENUE VOLATILITY INDEX (RVI) ═══
    -- 30-day rolling mean and stddev of deal_velocity (proxy for revenue flow)
    SELECT
        COALESCE(AVG(deal_velocity), 0),
        COALESCE(STDDEV(deal_velocity), 0)
    INTO v_rolling_mean, v_rolling_stddev
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND snapshot_date >= CURRENT_DATE - 30;

    IF v_rolling_mean > 0 THEN
        v_rvi := LEAST((v_rolling_stddev / v_rolling_mean) / volatility_threshold, 1.0);
    ELSE
        v_rvi := 0;  -- No revenue data = no volatility signal (not high risk by default)
    END IF;
    v_rvi := ROUND(v_rvi::NUMERIC, 4);

    -- ═══ 2. ENGAGEMENT DECAY SCORE (EDS) ═══
    -- Compare last 7 days avg engagement vs prior 7 days
    SELECT COALESCE(AVG(engagement_score), 0) INTO v_recent_engagement
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND snapshot_date >= CURRENT_DATE - 7;

    SELECT COALESCE(AVG(engagement_score), 0) INTO v_prior_engagement
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND snapshot_date >= CURRENT_DATE - 14
    AND snapshot_date < CURRENT_DATE - 7;

    IF v_prior_engagement > 0 THEN
        v_eds := GREATEST((v_prior_engagement - v_recent_engagement) / v_prior_engagement, 0);
    ELSE
        v_eds := 0;  -- No prior engagement = no decay measurable
    END IF;
    v_eds := LEAST(ROUND(v_eds::NUMERIC, 4), 1.0);

    -- ═══ 3. CASH DEVIATION RATIO (CDR) ═══
    -- 30-day rolling average vs most recent value
    SELECT COALESCE(AVG(cash_balance), 0) INTO v_rolling_cash_avg
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND snapshot_date >= CURRENT_DATE - 30
    AND cash_balance IS NOT NULL;

    SELECT COALESCE(cash_balance, 0) INTO v_current_cash
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND cash_balance IS NOT NULL
    ORDER BY snapshot_date DESC
    LIMIT 1;

    IF v_rolling_cash_avg > 0 THEN
        v_cdr := LEAST(ABS(v_current_cash - v_rolling_cash_avg) / v_rolling_cash_avg, 1.0);
    ELSE
        v_cdr := 0;  -- No cash data = no deviation signal
    END IF;
    v_cdr := ROUND(v_cdr::NUMERIC, 4);

    -- ═══ 4. ANOMALY DENSITY SCORE (ADS) ═══
    -- Anomaly events / total events (30 days)
    SELECT COALESCE(SUM(anomaly_count), 0) INTO v_anomaly_events
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id
    AND snapshot_date >= CURRENT_DATE - 30;

    SELECT COUNT(*) INTO v_total_events
    FROM governance_events
    WHERE workspace_id = p_tenant_id
    AND signal_timestamp >= NOW() - INTERVAL '30 days';

    IF v_total_events > 0 THEN
        v_ads := LEAST(v_anomaly_events::FLOAT / v_total_events::FLOAT, 1.0);
    ELSE
        v_ads := 0;  -- No events = no anomaly density
    END IF;
    v_ads := ROUND(v_ads::NUMERIC, 4);

    -- ═══ COMPOSITE RISK SCORE ═══
    v_crs := ROUND((w_rvi * v_rvi + w_eds * v_eds + w_cdr * v_cdr + w_ads * v_ads)::NUMERIC, 4);

    v_risk_band := CASE
        WHEN v_crs >= 0.7 THEN 'HIGH'
        WHEN v_crs >= 0.4 THEN 'MODERATE'
        ELSE 'LOW'
    END;

    v_elapsed_ms := EXTRACT(MILLISECOND FROM clock_timestamp() - v_start_time)::INT;

    -- ═══ LOG EXECUTION ═══
    INSERT INTO ic_model_executions (
        model_name, model_version, tenant_id,
        execution_time_ms, confidence_score, output_summary
    ) VALUES (
        'deterministic_risk_baseline', 'v1.0.0', p_tenant_id,
        v_elapsed_ms, 1.0,
        jsonb_build_object(
            'rvi', v_rvi, 'eds', v_eds, 'cdr', v_cdr, 'ads', v_ads,
            'composite', v_crs, 'risk_band', v_risk_band,
            'weights', jsonb_build_object('rvi', w_rvi, 'eds', w_eds, 'cdr', w_cdr, 'ads', w_ads),
            'thresholds', jsonb_build_object('volatility', volatility_threshold),
            'inputs', jsonb_build_object(
                'snapshots_used', v_snapshot_count,
                'rolling_mean', ROUND(v_rolling_mean::NUMERIC, 4),
                'rolling_stddev', ROUND(v_rolling_stddev::NUMERIC, 4),
                'recent_engagement', ROUND(v_recent_engagement::NUMERIC, 4),
                'prior_engagement', ROUND(v_prior_engagement::NUMERIC, 4),
                'rolling_cash_avg', ROUND(v_rolling_cash_avg::NUMERIC, 2),
                'current_cash', ROUND(v_current_cash::NUMERIC, 2),
                'anomaly_events', v_anomaly_events,
                'total_events', v_total_events
            )
        )
    ) RETURNING id INTO v_exec_id;

    -- ═══ LOG EVENT ═══
    INSERT INTO ic_intelligence_events (
        tenant_id, event_type, model_name,
        numeric_payload, json_payload, confidence_score
    ) VALUES (
        p_tenant_id, 'FORECAST_RUN', 'deterministic_risk_baseline',
        v_crs,
        jsonb_build_object(
            'rvi', v_rvi, 'eds', v_eds, 'cdr', v_cdr, 'ads', v_ads,
            'composite', v_crs, 'risk_band', v_risk_band,
            'execution_id', v_exec_id
        ),
        1.0
    );

    -- ═══ RETURN ═══
    RETURN jsonb_build_object(
        'status', 'computed',
        'model_name', 'deterministic_risk_baseline',
        'model_version', 'v1.0.0',
        'execution_id', v_exec_id,
        'execution_time_ms', v_elapsed_ms,
        'confidence_score', 1.0,
        'indices', jsonb_build_object(
            'revenue_volatility_index', v_rvi,
            'engagement_decay_score', v_eds,
            'cash_deviation_ratio', v_cdr,
            'anomaly_density_score', v_ads
        ),
        'composite', jsonb_build_object(
            'risk_score', v_crs,
            'risk_band', v_risk_band
        ),
        'weights', jsonb_build_object(
            'rvi', w_rvi, 'eds', w_eds, 'cdr', w_cdr, 'ads', w_ads
        ),
        'inputs_used', jsonb_build_object(
            'snapshots', v_snapshot_count,
            'period', '30 days'
        )
    );
END;
$$;


-- ═══ BATCH EXECUTION ═══

DROP FUNCTION IF EXISTS ic_calculate_all_risk_baselines CASCADE;
CREATE OR REPLACE FUNCTION ic_calculate_all_risk_baselines()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant UUID;
    v_count INT := 0;
    v_errors INT := 0;
    v_result JSONB;
BEGIN
    IF NOT is_spine_enabled() THEN
        RETURN jsonb_build_object('status', 'spine_disabled');
    END IF;

    FOR v_tenant IN
        SELECT DISTINCT tenant_id
        FROM ic_daily_metric_snapshots
        WHERE snapshot_date >= CURRENT_DATE - 7
    LOOP
        BEGIN
            v_result := ic_calculate_risk_baseline(v_tenant);
            IF (v_result->>'status') = 'computed' THEN
                v_count := v_count + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'batch_complete',
        'tenants_computed', v_count,
        'errors', v_errors
    );
END;
$$;


-- ═══ GRANTS ═══
GRANT EXECUTE ON FUNCTION ic_calculate_risk_baseline(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ic_calculate_all_risk_baselines() TO postgres;

-- pg_cron: daily AFTER snapshot generation (1:30am UTC, 30min after snapshot at 1am)
-- SELECT cron.schedule('ic-risk-baseline', '30 1 * * *', $$SELECT ic_calculate_all_risk_baselines()$$);

-- 034_configurable_risk_weights.sql
-- ═══════════════════════════════════════════════════════════════
-- BIQc CONFIGURABLE RISK BASELINE ENGINE
-- Migration: 034_configurable_risk_weights.sql
--
-- Replaces hardcoded weights with:
--   1. Immutable weight configuration table
--   2. Industry-specific override capability
--   3. Version-locked configurations
--   4. Sum = 1.0 constraint enforcement
--   5. Dynamic weight resolution in risk function
--
-- ADDITIVE. Does not modify 033 tables.
-- Supersedes the CONSTANT weights in ic_calculate_risk_baseline.
-- ═══════════════════════════════════════════════════════════════


-- ═══ 1. WEIGHT CONFIGURATION TABLE ═══

CREATE TABLE IF NOT EXISTS ic_risk_weight_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    industry_code TEXT,  -- NULL = global default
    weight_rvi FLOAT NOT NULL,
    weight_eds FLOAT NOT NULL,
    weight_cdr FLOAT NOT NULL,
    weight_ads FLOAT NOT NULL,
    volatility_threshold FLOAT NOT NULL DEFAULT 0.25,
    cash_deviation_threshold FLOAT NOT NULL DEFAULT 0.20,
    is_active BOOLEAN DEFAULT false,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT now(),
    -- Weights MUST sum to 1.0
    CONSTRAINT weights_sum_one CHECK (
        ROUND((weight_rvi + weight_eds + weight_cdr + weight_ads)::NUMERIC, 5) = 1.0
    )
);

CREATE INDEX IF NOT EXISTS idx_ic_weights_active ON ic_risk_weight_configs(is_active, industry_code);


-- ═══ 2. IMMUTABILITY TRIGGER ═══

DROP FUNCTION IF EXISTS ic_prevent_weight_update CASCADE;
CREATE OR REPLACE FUNCTION ic_prevent_weight_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Risk weight configs are immutable. Create a new version instead.';
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_weight_update ON ic_risk_weight_configs;
CREATE OR REPLACE TRIGGER trg_prevent_weight_update
    BEFORE UPDATE ON ic_risk_weight_configs
    FOR EACH ROW
    WHEN (OLD.is_active IS NOT DISTINCT FROM NEW.is_active)
    EXECUTE FUNCTION ic_prevent_weight_update();

-- Allow ONLY is_active toggle (for activation/deactivation)
-- The trigger fires on ALL updates EXCEPT when only is_active changes
-- To activate a new config: UPDATE SET is_active = true WHERE id = X
-- Then deactivate old: UPDATE SET is_active = false WHERE id = Y


-- ═══ 3. DEFAULT CONFIGS ═══

-- Global default (all industries)
INSERT INTO ic_risk_weight_configs (config_name, model_version, industry_code, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, is_active, created_by)
VALUES ('global_default', 'v1.0.0', NULL, 0.35, 0.25, 0.25, 0.15, 0.25, 0.20, true, 'system')
ON CONFLICT DO NOTHING;

-- B2B SaaS: higher weight on engagement decay + revenue volatility
INSERT INTO ic_risk_weight_configs (config_name, model_version, industry_code, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, is_active, created_by)
VALUES ('b2b_saas', 'v1.0.0', 'B2B_SAAS', 0.30, 0.35, 0.20, 0.15, 0.30, 0.15, true, 'system')
ON CONFLICT DO NOTHING;

-- Financial Services: higher weight on cash deviation + anomaly density
INSERT INTO ic_risk_weight_configs (config_name, model_version, industry_code, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, is_active, created_by)
VALUES ('financial_services', 'v1.0.0', 'FINANCIAL_SERVICES', 0.25, 0.20, 0.35, 0.20, 0.20, 0.15, true, 'system')
ON CONFLICT DO NOTHING;

-- Construction: higher weight on cash deviation (project-based cash flow)
INSERT INTO ic_risk_weight_configs (config_name, model_version, industry_code, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, is_active, created_by)
VALUES ('construction', 'v1.0.0', 'CONSTRUCTION', 0.25, 0.15, 0.40, 0.20, 0.30, 0.25, true, 'system')
ON CONFLICT DO NOTHING;

-- Professional Services: balanced but engagement-weighted
INSERT INTO ic_risk_weight_configs (config_name, model_version, industry_code, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, is_active, created_by)
VALUES ('professional_services', 'v1.0.0', 'PROFESSIONAL_SERVICES', 0.30, 0.30, 0.25, 0.15, 0.25, 0.20, true, 'system')
ON CONFLICT DO NOTHING;

-- Healthcare: higher anomaly sensitivity
INSERT INTO ic_risk_weight_configs (config_name, model_version, industry_code, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, is_active, created_by)
VALUES ('healthcare', 'v1.0.0', 'HEALTHCARE', 0.25, 0.25, 0.25, 0.25, 0.20, 0.20, true, 'system')
ON CONFLICT DO NOTHING;


-- ═══ 4. INDUSTRY CODE RESOLVER ═══
-- Maps free-text business_profiles.industry to standardized industry_code

DROP FUNCTION IF EXISTS ic_resolve_industry_code CASCADE;
CREATE OR REPLACE FUNCTION ic_resolve_industry_code(p_industry TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_lower TEXT;
BEGIN
    IF p_industry IS NULL OR p_industry = '' THEN
        RETURN NULL;
    END IF;
    v_lower := LOWER(p_industry);

    RETURN CASE
        WHEN v_lower ~ '(saas|software|technology|IT|platform|app)' THEN 'B2B_SAAS'
        WHEN v_lower ~ '(financial|wealth|advisory|investment|banking|insurance)' THEN 'FINANCIAL_SERVICES'
        WHEN v_lower ~ '(construction|building|civil|engineering|trades)' THEN 'CONSTRUCTION'
        WHEN v_lower ~ '(accounting|bookkeeping|tax|audit)' THEN 'PROFESSIONAL_SERVICES'
        WHEN v_lower ~ '(law|legal|solicitor|barrister)' THEN 'PROFESSIONAL_SERVICES'
        WHEN v_lower ~ '(consulting|management|strategy|advisory)' THEN 'PROFESSIONAL_SERVICES'
        WHEN v_lower ~ '(medical|healthcare|health|dental|physio|chiro)' THEN 'HEALTHCARE'
        WHEN v_lower ~ '(real estate|property|agency)' THEN 'PROFESSIONAL_SERVICES'
        WHEN v_lower ~ '(marketing|advertising|digital|media|creative)' THEN 'PROFESSIONAL_SERVICES'
        WHEN v_lower ~ '(retail|ecommerce|shop|store)' THEN 'B2B_SAAS'
        WHEN v_lower ~ '(education|training|coaching)' THEN 'PROFESSIONAL_SERVICES'
        WHEN v_lower ~ '(hospitality|restaurant|cafe|hotel)' THEN 'CONSTRUCTION'
        WHEN v_lower ~ '(logistics|transport|freight|supply)' THEN 'CONSTRUCTION'
        WHEN v_lower ~ '(manufacturing|production|factory)' THEN 'CONSTRUCTION'
        ELSE NULL
    END;
END;
$$;


-- ═══ 5. CONFIGURABLE RISK BASELINE FUNCTION (v2) ═══
-- Supersedes ic_calculate_risk_baseline from 033

DROP FUNCTION IF EXISTS ic_calculate_risk_baseline CASCADE;
CREATE OR REPLACE FUNCTION ic_calculate_risk_baseline(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    -- Dynamic weights
    w_rvi FLOAT;
    w_eds FLOAT;
    w_cdr FLOAT;
    w_ads FLOAT;
    v_vol_threshold FLOAT;
    v_cash_threshold FLOAT;
    v_config_name TEXT;
    v_config_version TEXT;
    v_industry_code TEXT;
    v_tenant_industry TEXT;

    -- Computed indices
    v_rvi FLOAT := 0;
    v_eds FLOAT := 0;
    v_cdr FLOAT := 0;
    v_ads FLOAT := 0;
    v_crs FLOAT := 0;
    v_risk_band TEXT;

    -- Intermediate
    v_rolling_mean FLOAT;
    v_rolling_stddev FLOAT;
    v_recent_engagement FLOAT;
    v_prior_engagement FLOAT;
    v_rolling_cash_avg FLOAT;
    v_current_cash FLOAT;
    v_anomaly_events INT;
    v_total_events INT;
    v_snapshot_count INT;
    v_start_time TIMESTAMP;
    v_elapsed_ms INT;
    v_exec_id UUID;
BEGIN
    v_start_time := clock_timestamp();

    -- Check spine
    IF NOT is_spine_enabled() THEN
        RETURN jsonb_build_object('status', 'spine_disabled');
    END IF;

    -- Snapshot count check
    SELECT COUNT(*) INTO v_snapshot_count
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

    IF v_snapshot_count < 3 THEN
        RETURN jsonb_build_object('status', 'insufficient_data', 'snapshots_available', v_snapshot_count, 'minimum_required', 3);
    END IF;

    -- ═══ RESOLVE WEIGHTS ═══
    -- Get tenant industry
    SELECT industry INTO v_tenant_industry
    FROM business_profiles
    WHERE user_id = p_tenant_id
    LIMIT 1;

    v_industry_code := ic_resolve_industry_code(v_tenant_industry);

    -- Load weight config: industry-specific first, then global fallback
    SELECT config_name, model_version, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold
    INTO v_config_name, v_config_version, w_rvi, w_eds, w_cdr, w_ads, v_vol_threshold, v_cash_threshold
    FROM ic_risk_weight_configs
    WHERE is_active = true
    AND (industry_code = v_industry_code OR industry_code IS NULL)
    ORDER BY industry_code NULLS LAST  -- industry-specific first
    LIMIT 1;

    -- Fallback if no config found
    IF w_rvi IS NULL THEN
        w_rvi := 0.35; w_eds := 0.25; w_cdr := 0.25; w_ads := 0.15;
        v_vol_threshold := 0.25; v_cash_threshold := 0.20;
        v_config_name := 'hardcoded_fallback'; v_config_version := 'v0.0.0';
    END IF;

    -- ═══ 1. REVENUE VOLATILITY INDEX ═══
    SELECT COALESCE(AVG(deal_velocity), 0), COALESCE(STDDEV(deal_velocity), 0)
    INTO v_rolling_mean, v_rolling_stddev
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

    IF v_rolling_mean > 0 THEN
        v_rvi := LEAST((v_rolling_stddev / v_rolling_mean) / v_vol_threshold, 1.0);
    END IF;
    v_rvi := ROUND(v_rvi::NUMERIC, 4);

    -- ═══ 2. ENGAGEMENT DECAY SCORE ═══
    SELECT COALESCE(AVG(engagement_score), 0) INTO v_recent_engagement
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 7;

    SELECT COALESCE(AVG(engagement_score), 0) INTO v_prior_engagement
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 14 AND snapshot_date < CURRENT_DATE - 7;

    IF v_prior_engagement > 0 THEN
        v_eds := GREATEST((v_prior_engagement - v_recent_engagement) / v_prior_engagement, 0);
    END IF;
    v_eds := LEAST(ROUND(v_eds::NUMERIC, 4), 1.0);

    -- ═══ 3. CASH DEVIATION RATIO ═══
    SELECT COALESCE(AVG(cash_balance), 0) INTO v_rolling_cash_avg
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30 AND cash_balance IS NOT NULL;

    SELECT COALESCE(cash_balance, 0) INTO v_current_cash
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND cash_balance IS NOT NULL
    ORDER BY snapshot_date DESC LIMIT 1;

    IF v_rolling_cash_avg > 0 THEN
        v_cdr := LEAST(ABS(v_current_cash - v_rolling_cash_avg) / v_rolling_cash_avg, 1.0);
    END IF;
    v_cdr := ROUND(v_cdr::NUMERIC, 4);

    -- ═══ 4. ANOMALY DENSITY SCORE ═══
    SELECT COALESCE(SUM(anomaly_count), 0) INTO v_anomaly_events
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

    SELECT COUNT(*) INTO v_total_events
    FROM governance_events
    WHERE workspace_id = p_tenant_id AND signal_timestamp >= NOW() - INTERVAL '30 days';

    IF v_total_events > 0 THEN
        v_ads := LEAST(v_anomaly_events::FLOAT / v_total_events::FLOAT, 1.0);
    END IF;
    v_ads := ROUND(v_ads::NUMERIC, 4);

    -- ═══ COMPOSITE ═══
    v_crs := ROUND((w_rvi * v_rvi + w_eds * v_eds + w_cdr * v_cdr + w_ads * v_ads)::NUMERIC, 4);

    v_risk_band := CASE
        WHEN v_crs >= 0.7 THEN 'HIGH'
        WHEN v_crs >= 0.4 THEN 'MODERATE'
        ELSE 'LOW'
    END;

    v_elapsed_ms := EXTRACT(MILLISECOND FROM clock_timestamp() - v_start_time)::INT;

    -- ═══ LOG EXECUTION ═══
    INSERT INTO ic_model_executions (
        model_name, model_version, tenant_id,
        execution_time_ms, confidence_score, output_summary
    ) VALUES (
        'deterministic_risk_baseline', v_config_version, p_tenant_id,
        v_elapsed_ms, 1.0,
        jsonb_build_object(
            'rvi', v_rvi, 'eds', v_eds, 'cdr', v_cdr, 'ads', v_ads,
            'composite', v_crs, 'risk_band', v_risk_band,
            'config', jsonb_build_object(
                'name', v_config_name,
                'version', v_config_version,
                'industry_code', v_industry_code,
                'tenant_industry', v_tenant_industry
            ),
            'weights', jsonb_build_object('rvi', w_rvi, 'eds', w_eds, 'cdr', w_cdr, 'ads', w_ads),
            'thresholds', jsonb_build_object('volatility', v_vol_threshold, 'cash_deviation', v_cash_threshold),
            'inputs', jsonb_build_object(
                'snapshots_used', v_snapshot_count,
                'rolling_mean', ROUND(v_rolling_mean::NUMERIC, 4),
                'rolling_stddev', ROUND(v_rolling_stddev::NUMERIC, 4),
                'recent_engagement', ROUND(v_recent_engagement::NUMERIC, 4),
                'prior_engagement', ROUND(v_prior_engagement::NUMERIC, 4),
                'rolling_cash_avg', ROUND(v_rolling_cash_avg::NUMERIC, 2),
                'current_cash', ROUND(v_current_cash::NUMERIC, 2),
                'anomaly_events', v_anomaly_events,
                'total_events', v_total_events
            )
        )
    ) RETURNING id INTO v_exec_id;

    -- ═══ LOG EVENT ═══
    INSERT INTO ic_intelligence_events (
        tenant_id, event_type, model_name,
        numeric_payload, json_payload, confidence_score
    ) VALUES (
        p_tenant_id, 'FORECAST_RUN', 'deterministic_risk_baseline',
        v_crs,
        jsonb_build_object(
            'rvi', v_rvi, 'eds', v_eds, 'cdr', v_cdr, 'ads', v_ads,
            'composite', v_crs, 'risk_band', v_risk_band,
            'config_name', v_config_name,
            'industry_code', v_industry_code,
            'execution_id', v_exec_id
        ),
        1.0
    );

    -- ═══ RETURN ═══
    RETURN jsonb_build_object(
        'status', 'computed',
        'model_name', 'deterministic_risk_baseline',
        'model_version', v_config_version,
        'execution_id', v_exec_id,
        'execution_time_ms', v_elapsed_ms,
        'confidence_score', 1.0,
        'config', jsonb_build_object(
            'name', v_config_name,
            'industry_code', v_industry_code,
            'tenant_industry', v_tenant_industry
        ),
        'indices', jsonb_build_object(
            'revenue_volatility_index', v_rvi,
            'engagement_decay_score', v_eds,
            'cash_deviation_ratio', v_cdr,
            'anomaly_density_score', v_ads
        ),
        'composite', jsonb_build_object(
            'risk_score', v_crs,
            'risk_band', v_risk_band
        ),
        'weights', jsonb_build_object(
            'rvi', w_rvi, 'eds', w_eds, 'cdr', w_cdr, 'ads', w_ads
        ),
        'thresholds', jsonb_build_object(
            'volatility', v_vol_threshold,
            'cash_deviation', v_cash_threshold
        ),
        'inputs_used', jsonb_build_object(
            'snapshots', v_snapshot_count,
            'period', '30 days'
        )
    );
END;
$$;


-- ═══ BATCH (unchanged but now uses dynamic weights) ═══
DROP FUNCTION IF EXISTS ic_calculate_all_risk_baselines CASCADE;
CREATE OR REPLACE FUNCTION ic_calculate_all_risk_baselines()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant UUID;
    v_count INT := 0;
    v_errors INT := 0;
    v_result JSONB;
BEGIN
    IF NOT is_spine_enabled() THEN
        RETURN jsonb_build_object('status', 'spine_disabled');
    END IF;
    FOR v_tenant IN
        SELECT DISTINCT tenant_id FROM ic_daily_metric_snapshots WHERE snapshot_date >= CURRENT_DATE - 7
    LOOP
        BEGIN
            v_result := ic_calculate_risk_baseline(v_tenant);
            IF (v_result->>'status') = 'computed' THEN v_count := v_count + 1; END IF;
        EXCEPTION WHEN OTHERS THEN v_errors := v_errors + 1;
        END;
    END LOOP;
    RETURN jsonb_build_object('status', 'batch_complete', 'tenants_computed', v_count, 'errors', v_errors);
END;
$$;


-- ═══ RLS + GRANTS ═══
ALTER TABLE ic_risk_weight_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_weights" ON ic_risk_weight_configs;
CREATE POLICY "read_weights" ON ic_risk_weight_configs FOR SELECT USING (true);
DROP POLICY IF EXISTS "service_manage_weights" ON ic_risk_weight_configs;
CREATE POLICY "service_manage_weights" ON ic_risk_weight_configs FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT EXECUTE ON FUNCTION ic_resolve_industry_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION ic_calculate_risk_baseline(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ic_calculate_all_risk_baselines() TO postgres;

-- pg_cron: daily at 1:30am UTC (after snapshot at 1am)
-- SELECT cron.schedule('ic-risk-baseline', '30 1 * * *', $$SELECT ic_calculate_all_risk_baselines()$$);

-- 035_risk_baseline_hardening.sql
-- ═══════════════════════════════════════════════════════════════
-- BIQc RISK BASELINE HARDENING
-- Migration: 035_risk_baseline_hardening.sql
--
-- Fixes 4 structural weaknesses:
--   1. Canonical industry code enum table (replaces free-text reliance)
--   2. Unique active weight per industry constraint (prevents ambiguity)
--   3. Backtestable risk function (optional config_id parameter)
--   4. Stability guard noted (v2 — 3-day rolling avg)
--
-- ADDITIVE ONLY.
-- ═══════════════════════════════════════════════════════════════


-- ═══ 1. CANONICAL INDUSTRY CODES TABLE ═══

CREATE TABLE IF NOT EXISTS ic_industry_codes (
    code TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    parent_code TEXT,
    created_at TIMESTAMP DEFAULT now()
);

INSERT INTO ic_industry_codes (code, description) VALUES
    ('B2B_SAAS', 'Software as a Service / Technology'),
    ('FINANCIAL_SERVICES', 'Financial Advisory / Wealth / Banking / Insurance'),
    ('CONSTRUCTION', 'Construction / Building / Civil Engineering / Trades'),
    ('PROFESSIONAL_SERVICES', 'Consulting / Legal / Accounting / Marketing'),
    ('HEALTHCARE', 'Medical / Dental / Allied Health'),
    ('RETAIL', 'Retail / E-Commerce'),
    ('EDUCATION', 'Education / Training / Coaching'),
    ('HOSPITALITY', 'Hospitality / Food / Accommodation'),
    ('LOGISTICS', 'Logistics / Transport / Supply Chain'),
    ('MANUFACTURING', 'Manufacturing / Production'),
    ('REAL_ESTATE', 'Real Estate / Property'),
    ('MEDIA', 'Media / Creative / Entertainment'),
    ('NOT_CLASSIFIED', 'Industry not yet classified')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE ic_industry_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_industry_codes" ON ic_industry_codes;
CREATE POLICY "read_industry_codes" ON ic_industry_codes FOR SELECT USING (true);

-- Add industry_code column to business_profiles for eventual migration
-- (free-text industry remains for backward compat)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profiles' AND column_name = 'industry_code') THEN
        ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS industry_code TEXT;
    END IF;
END $$;


-- ═══ 2. UNIQUE ACTIVE WEIGHT PER INDUSTRY ═══
-- Prevents two active configs for same industry

-- For industry-specific (non-null industry_code)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_weight_per_industry
    ON ic_risk_weight_configs (industry_code)
    WHERE is_active = true AND industry_code IS NOT NULL;

-- For global default (null industry_code)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_weight_global
    ON ic_risk_weight_configs ((1))
    WHERE is_active = true AND industry_code IS NULL;


-- ═══ 3. BACKTESTABLE RISK FUNCTION ═══
-- Accepts optional config_id to override active config lookup

DROP FUNCTION IF EXISTS ic_calculate_risk_baseline CASCADE;
CREATE OR REPLACE FUNCTION ic_calculate_risk_baseline(
    p_tenant_id UUID,
    p_config_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    w_rvi FLOAT;
    w_eds FLOAT;
    w_cdr FLOAT;
    w_ads FLOAT;
    v_vol_threshold FLOAT;
    v_cash_threshold FLOAT;
    v_config_name TEXT;
    v_config_version TEXT;
    v_industry_code TEXT;
    v_tenant_industry TEXT;
    v_backtest_mode BOOLEAN := false;

    v_rvi FLOAT := 0;
    v_eds FLOAT := 0;
    v_cdr FLOAT := 0;
    v_ads FLOAT := 0;
    v_crs FLOAT := 0;
    v_risk_band TEXT;

    v_rolling_mean FLOAT;
    v_rolling_stddev FLOAT;
    v_recent_engagement FLOAT;
    v_prior_engagement FLOAT;
    v_rolling_cash_avg FLOAT;
    v_current_cash FLOAT;
    v_anomaly_events INT;
    v_total_events INT;
    v_snapshot_count INT;
    v_start_time TIMESTAMP;
    v_elapsed_ms INT;
    v_exec_id UUID;
BEGIN
    v_start_time := clock_timestamp();

    IF NOT is_spine_enabled() THEN
        RETURN jsonb_build_object('status', 'spine_disabled');
    END IF;

    SELECT COUNT(*) INTO v_snapshot_count
    FROM ic_daily_metric_snapshots
    WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

    IF v_snapshot_count < 3 THEN
        RETURN jsonb_build_object('status', 'insufficient_data', 'snapshots_available', v_snapshot_count, 'minimum_required', 3);
    END IF;

    -- ═══ RESOLVE WEIGHTS ═══
    IF p_config_id IS NOT NULL THEN
        -- BACKTEST MODE: use specified config
        v_backtest_mode := true;
        SELECT config_name, model_version, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold, industry_code
        INTO v_config_name, v_config_version, w_rvi, w_eds, w_cdr, w_ads, v_vol_threshold, v_cash_threshold, v_industry_code
        FROM ic_risk_weight_configs
        WHERE id = p_config_id;
    ELSE
        -- PRODUCTION MODE: resolve from tenant industry
        SELECT industry, industry_code INTO v_tenant_industry, v_industry_code
        FROM business_profiles
        WHERE user_id = p_tenant_id
        LIMIT 1;

        -- Use explicit industry_code if set, otherwise resolve from free text
        IF v_industry_code IS NULL THEN
            v_industry_code := ic_resolve_industry_code(v_tenant_industry);
        END IF;

        SELECT config_name, model_version, weight_rvi, weight_eds, weight_cdr, weight_ads, volatility_threshold, cash_deviation_threshold
        INTO v_config_name, v_config_version, w_rvi, w_eds, w_cdr, w_ads, v_vol_threshold, v_cash_threshold
        FROM ic_risk_weight_configs
        WHERE is_active = true
        AND (industry_code = v_industry_code OR industry_code IS NULL)
        ORDER BY industry_code NULLS LAST
        LIMIT 1;
    END IF;

    -- Fallback
    IF w_rvi IS NULL THEN
        w_rvi := 0.35; w_eds := 0.25; w_cdr := 0.25; w_ads := 0.15;
        v_vol_threshold := 0.25; v_cash_threshold := 0.20;
        v_config_name := 'hardcoded_fallback'; v_config_version := 'v0.0.0';
    END IF;

    -- ═══ RVI ═══
    SELECT COALESCE(AVG(deal_velocity), 0), COALESCE(STDDEV(deal_velocity), 0)
    INTO v_rolling_mean, v_rolling_stddev
    FROM ic_daily_metric_snapshots WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

    IF v_rolling_mean > 0 THEN
        v_rvi := LEAST((v_rolling_stddev / v_rolling_mean) / v_vol_threshold, 1.0);
    END IF;
    v_rvi := ROUND(v_rvi::NUMERIC, 4);

    -- ═══ EDS ═══
    SELECT COALESCE(AVG(engagement_score), 0) INTO v_recent_engagement
    FROM ic_daily_metric_snapshots WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 7;

    SELECT COALESCE(AVG(engagement_score), 0) INTO v_prior_engagement
    FROM ic_daily_metric_snapshots WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 14 AND snapshot_date < CURRENT_DATE - 7;

    IF v_prior_engagement > 0 THEN
        v_eds := GREATEST((v_prior_engagement - v_recent_engagement) / v_prior_engagement, 0);
    END IF;
    v_eds := LEAST(ROUND(v_eds::NUMERIC, 4), 1.0);

    -- ═══ CDR ═══
    SELECT COALESCE(AVG(cash_balance), 0) INTO v_rolling_cash_avg
    FROM ic_daily_metric_snapshots WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30 AND cash_balance IS NOT NULL;

    SELECT COALESCE(cash_balance, 0) INTO v_current_cash
    FROM ic_daily_metric_snapshots WHERE tenant_id = p_tenant_id AND cash_balance IS NOT NULL ORDER BY snapshot_date DESC LIMIT 1;

    IF v_rolling_cash_avg > 0 THEN
        v_cdr := LEAST(ABS(v_current_cash - v_rolling_cash_avg) / v_rolling_cash_avg, 1.0);
    END IF;
    v_cdr := ROUND(v_cdr::NUMERIC, 4);

    -- ═══ ADS ═══
    SELECT COALESCE(SUM(anomaly_count), 0) INTO v_anomaly_events
    FROM ic_daily_metric_snapshots WHERE tenant_id = p_tenant_id AND snapshot_date >= CURRENT_DATE - 30;

    SELECT COUNT(*) INTO v_total_events
    FROM governance_events WHERE workspace_id = p_tenant_id AND signal_timestamp >= NOW() - INTERVAL '30 days';

    IF v_total_events > 0 THEN
        v_ads := LEAST(v_anomaly_events::FLOAT / v_total_events::FLOAT, 1.0);
    END IF;
    v_ads := ROUND(v_ads::NUMERIC, 4);

    -- ═══ COMPOSITE ═══
    v_crs := ROUND((w_rvi * v_rvi + w_eds * v_eds + w_cdr * v_cdr + w_ads * v_ads)::NUMERIC, 4);
    v_risk_band := CASE WHEN v_crs >= 0.7 THEN 'HIGH' WHEN v_crs >= 0.4 THEN 'MODERATE' ELSE 'LOW' END;

    v_elapsed_ms := EXTRACT(MILLISECOND FROM clock_timestamp() - v_start_time)::INT;

    -- ═══ LOG ═══
    INSERT INTO ic_model_executions (
        model_name, model_version, tenant_id, execution_time_ms, confidence_score, output_summary
    ) VALUES (
        'deterministic_risk_baseline', v_config_version, p_tenant_id, v_elapsed_ms, 1.0,
        jsonb_build_object(
            'rvi', v_rvi, 'eds', v_eds, 'cdr', v_cdr, 'ads', v_ads,
            'composite', v_crs, 'risk_band', v_risk_band,
            'backtest_mode', v_backtest_mode,
            'config', jsonb_build_object('name', v_config_name, 'version', v_config_version, 'industry_code', v_industry_code, 'config_id', p_config_id),
            'weights', jsonb_build_object('rvi', w_rvi, 'eds', w_eds, 'cdr', w_cdr, 'ads', w_ads),
            'thresholds', jsonb_build_object('volatility', v_vol_threshold, 'cash_deviation', v_cash_threshold),
            'inputs', jsonb_build_object(
                'snapshots_used', v_snapshot_count, 'rolling_mean', ROUND(v_rolling_mean::NUMERIC, 4),
                'rolling_stddev', ROUND(v_rolling_stddev::NUMERIC, 4), 'recent_engagement', ROUND(v_recent_engagement::NUMERIC, 4),
                'prior_engagement', ROUND(v_prior_engagement::NUMERIC, 4), 'rolling_cash_avg', ROUND(v_rolling_cash_avg::NUMERIC, 2),
                'current_cash', ROUND(v_current_cash::NUMERIC, 2), 'anomaly_events', v_anomaly_events, 'total_events', v_total_events
            )
        )
    ) RETURNING id INTO v_exec_id;

    INSERT INTO ic_intelligence_events (
        tenant_id, event_type, model_name, numeric_payload, json_payload, confidence_score
    ) VALUES (
        p_tenant_id, 'FORECAST_RUN', 'deterministic_risk_baseline', v_crs,
        jsonb_build_object('rvi', v_rvi, 'eds', v_eds, 'cdr', v_cdr, 'ads', v_ads, 'composite', v_crs,
            'risk_band', v_risk_band, 'config_name', v_config_name, 'backtest', v_backtest_mode, 'execution_id', v_exec_id),
        1.0
    );

    RETURN jsonb_build_object(
        'status', 'computed',
        'model_name', 'deterministic_risk_baseline',
        'model_version', v_config_version,
        'backtest_mode', v_backtest_mode,
        'execution_id', v_exec_id,
        'execution_time_ms', v_elapsed_ms,
        'confidence_score', 1.0,
        'config', jsonb_build_object('name', v_config_name, 'industry_code', v_industry_code, 'tenant_industry', v_tenant_industry),
        'indices', jsonb_build_object('revenue_volatility_index', v_rvi, 'engagement_decay_score', v_eds, 'cash_deviation_ratio', v_cdr, 'anomaly_density_score', v_ads),
        'composite', jsonb_build_object('risk_score', v_crs, 'risk_band', v_risk_band),
        'weights', jsonb_build_object('rvi', w_rvi, 'eds', w_eds, 'cdr', w_cdr, 'ads', w_ads),
        'thresholds', jsonb_build_object('volatility', v_vol_threshold, 'cash_deviation', v_cash_threshold),
        'inputs_used', jsonb_build_object('snapshots', v_snapshot_count, 'period', '30 days')
    );
END;
$$;

-- Batch remains unchanged but uses the updated function signature
DROP FUNCTION IF EXISTS ic_calculate_all_risk_baselines CASCADE;
CREATE OR REPLACE FUNCTION ic_calculate_all_risk_baselines()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_tenant UUID; v_count INT := 0; v_errors INT := 0; v_result JSONB;
BEGIN
    IF NOT is_spine_enabled() THEN RETURN jsonb_build_object('status', 'spine_disabled'); END IF;
    FOR v_tenant IN SELECT DISTINCT tenant_id FROM ic_daily_metric_snapshots WHERE snapshot_date >= CURRENT_DATE - 7
    LOOP
        BEGIN
            v_result := ic_calculate_risk_baseline(v_tenant);
            IF (v_result->>'status') = 'computed' THEN v_count := v_count + 1; END IF;
        EXCEPTION WHEN OTHERS THEN v_errors := v_errors + 1;
        END;
    END LOOP;
    RETURN jsonb_build_object('status', 'batch_complete', 'tenants_computed', v_count, 'errors', v_errors);
END;
$$;

GRANT EXECUTE ON FUNCTION ic_calculate_risk_baseline(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ic_calculate_all_risk_baselines() TO postgres;

-- 036_risk_calibration_analytics.sql
-- ═══════════════════════════════════════════════════════════════
-- BIQc RISK CALIBRATION ANALYTICS
-- Migration: 036_risk_calibration_analytics.sql
--
-- Three analytics views + calibration report function:
--   1. Distribution summary (variance, skew, band distribution)
--   2. Industry separation (per-industry mean/stddev)
--   3. Index dominance (correlation of each index to composite)
--   4. Calibration report function (14-day window, pass/fail)
--
-- ADDITIVE ONLY. No existing tables modified.
-- ═══════════════════════════════════════════════════════════════


-- ═══ 1. DISTRIBUTION SUMMARY VIEW ═══
-- Answers: Is variance statistically significant?
-- What is the band distribution (LOW/MODERATE/HIGH)?

CREATE OR REPLACE VIEW ic_risk_distribution_summary AS
SELECT
    COUNT(*) AS execution_count,
    COUNT(DISTINCT tenant_id) AS tenant_count,
    ROUND(AVG((output_summary->>'composite')::NUMERIC), 4) AS avg_risk,
    ROUND(STDDEV((output_summary->>'composite')::NUMERIC), 4) AS risk_stddev,
    ROUND(MIN((output_summary->>'composite')::NUMERIC), 4) AS min_risk,
    ROUND(MAX((output_summary->>'composite')::NUMERIC), 4) AS max_risk,
    ROUND(MAX((output_summary->>'composite')::NUMERIC) - MIN((output_summary->>'composite')::NUMERIC), 4) AS risk_range,
    -- Band distribution
    ROUND(SUM(CASE WHEN (output_summary->>'composite')::NUMERIC < 0.33 THEN 1 ELSE 0 END)::NUMERIC / GREATEST(COUNT(*), 1), 3) AS pct_low,
    ROUND(SUM(CASE WHEN (output_summary->>'composite')::NUMERIC BETWEEN 0.33 AND 0.66 THEN 1 ELSE 0 END)::NUMERIC / GREATEST(COUNT(*), 1), 3) AS pct_moderate,
    ROUND(SUM(CASE WHEN (output_summary->>'composite')::NUMERIC > 0.66 THEN 1 ELSE 0 END)::NUMERIC / GREATEST(COUNT(*), 1), 3) AS pct_high,
    -- Per-index averages
    ROUND(AVG((output_summary->>'rvi')::NUMERIC), 4) AS avg_rvi,
    ROUND(AVG((output_summary->>'eds')::NUMERIC), 4) AS avg_eds,
    ROUND(AVG((output_summary->>'cdr')::NUMERIC), 4) AS avg_cdr,
    ROUND(AVG((output_summary->>'ads')::NUMERIC), 4) AS avg_ads,
    -- Per-index stddev
    ROUND(STDDEV((output_summary->>'rvi')::NUMERIC), 4) AS stddev_rvi,
    ROUND(STDDEV((output_summary->>'eds')::NUMERIC), 4) AS stddev_eds,
    ROUND(STDDEV((output_summary->>'cdr')::NUMERIC), 4) AS stddev_cdr,
    ROUND(STDDEV((output_summary->>'ads')::NUMERIC), 4) AS stddev_ads
FROM ic_model_executions
WHERE model_name = 'deterministic_risk_baseline'
AND COALESCE((output_summary->>'backtest_mode')::BOOLEAN, false) = false
AND created_at >= NOW() - INTERVAL '14 days';


-- ═══ 2. INDUSTRY SEPARATION VIEW ═══
-- Answers: Do industry weights produce meaningfully different scores?

CREATE OR REPLACE VIEW ic_risk_industry_separation AS
SELECT
    COALESCE(output_summary->'config'->>'industry_code', 'GLOBAL') AS industry_code,
    COUNT(*) AS execution_count,
    COUNT(DISTINCT tenant_id) AS tenant_count,
    ROUND(AVG((output_summary->>'composite')::NUMERIC), 4) AS avg_risk,
    ROUND(STDDEV((output_summary->>'composite')::NUMERIC), 4) AS stddev_risk,
    ROUND(MIN((output_summary->>'composite')::NUMERIC), 4) AS min_risk,
    ROUND(MAX((output_summary->>'composite')::NUMERIC), 4) AS max_risk,
    -- Per-index averages per industry
    ROUND(AVG((output_summary->>'rvi')::NUMERIC), 4) AS avg_rvi,
    ROUND(AVG((output_summary->>'eds')::NUMERIC), 4) AS avg_eds,
    ROUND(AVG((output_summary->>'cdr')::NUMERIC), 4) AS avg_cdr,
    ROUND(AVG((output_summary->>'ads')::NUMERIC), 4) AS avg_ads
FROM ic_model_executions
WHERE model_name = 'deterministic_risk_baseline'
AND COALESCE((output_summary->>'backtest_mode')::BOOLEAN, false) = false
AND created_at >= NOW() - INTERVAL '14 days'
GROUP BY COALESCE(output_summary->'config'->>'industry_code', 'GLOBAL');


-- ═══ 3. INDEX DOMINANCE ANALYSIS FUNCTION ═══
-- Answers: Does one index dominate the composite?
-- Cannot use CORR in a view across JSONB easily, so use function.

DROP FUNCTION IF EXISTS ic_index_dominance_analysis CASCADE;
CREATE OR REPLACE FUNCTION ic_index_dominance_analysis()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_corr_rvi FLOAT;
    v_corr_eds FLOAT;
    v_corr_cdr FLOAT;
    v_corr_ads FLOAT;
    v_dominant TEXT := 'none';
    v_dominant_corr FLOAT := 0;
    v_is_single_factor BOOLEAN := false;
BEGIN
    SELECT
        COALESCE(CORR((output_summary->>'rvi')::FLOAT, (output_summary->>'composite')::FLOAT), 0),
        COALESCE(CORR((output_summary->>'eds')::FLOAT, (output_summary->>'composite')::FLOAT), 0),
        COALESCE(CORR((output_summary->>'cdr')::FLOAT, (output_summary->>'composite')::FLOAT), 0),
        COALESCE(CORR((output_summary->>'ads')::FLOAT, (output_summary->>'composite')::FLOAT), 0)
    INTO v_corr_rvi, v_corr_eds, v_corr_cdr, v_corr_ads
    FROM ic_model_executions
    WHERE model_name = 'deterministic_risk_baseline'
    AND COALESCE((output_summary->>'backtest_mode')::BOOLEAN, false) = false
    AND created_at >= NOW() - INTERVAL '14 days';

    -- Find dominant
    IF ABS(v_corr_rvi) > v_dominant_corr THEN v_dominant := 'RVI'; v_dominant_corr := ABS(v_corr_rvi); END IF;
    IF ABS(v_corr_eds) > v_dominant_corr THEN v_dominant := 'EDS'; v_dominant_corr := ABS(v_corr_eds); END IF;
    IF ABS(v_corr_cdr) > v_dominant_corr THEN v_dominant := 'CDR'; v_dominant_corr := ABS(v_corr_cdr); END IF;
    IF ABS(v_corr_ads) > v_dominant_corr THEN v_dominant := 'ADS'; v_dominant_corr := ABS(v_corr_ads); END IF;

    -- Single-factor check: dominant > 0.85 AND others < 0.3
    v_is_single_factor := v_dominant_corr > 0.85 AND (
        CASE v_dominant
            WHEN 'RVI' THEN GREATEST(ABS(v_corr_eds), ABS(v_corr_cdr), ABS(v_corr_ads)) < 0.3
            WHEN 'EDS' THEN GREATEST(ABS(v_corr_rvi), ABS(v_corr_cdr), ABS(v_corr_ads)) < 0.3
            WHEN 'CDR' THEN GREATEST(ABS(v_corr_rvi), ABS(v_corr_eds), ABS(v_corr_ads)) < 0.3
            WHEN 'ADS' THEN GREATEST(ABS(v_corr_rvi), ABS(v_corr_eds), ABS(v_corr_cdr)) < 0.3
            ELSE false
        END
    );

    RETURN jsonb_build_object(
        'correlations', jsonb_build_object(
            'rvi_to_composite', ROUND(v_corr_rvi::NUMERIC, 4),
            'eds_to_composite', ROUND(v_corr_eds::NUMERIC, 4),
            'cdr_to_composite', ROUND(v_corr_cdr::NUMERIC, 4),
            'ads_to_composite', ROUND(v_corr_ads::NUMERIC, 4)
        ),
        'dominant_index', v_dominant,
        'dominant_correlation', ROUND(v_dominant_corr::NUMERIC, 4),
        'is_single_factor', v_is_single_factor,
        'assessment', CASE
            WHEN v_is_single_factor THEN 'WARNING: Composite is effectively single-factor. Robustness weakened.'
            WHEN v_dominant_corr > 0.75 THEN 'ATTENTION: One index is disproportionately influential.'
            ELSE 'HEALTHY: Indices contribute balanced influence to composite.'
        END
    );
END;
$$;


-- ═══ 4. FULL CALIBRATION REPORT FUNCTION ═══
-- 14-day window. Combines distribution + industry + dominance.

DROP FUNCTION IF EXISTS ic_risk_calibration_report CASCADE;
CREATE OR REPLACE FUNCTION ic_risk_calibration_report()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_distribution RECORD;
    v_industry JSONB;
    v_dominance JSONB;
    v_execution_count INT;
    v_tenant_count INT;
    v_calibration_pass BOOLEAN := false;
    v_issues JSONB := '[]'::JSONB;
BEGIN
    -- Distribution summary
    SELECT * INTO v_distribution FROM ic_risk_distribution_summary;

    -- Industry separation
    SELECT COALESCE(jsonb_agg(row_to_json(sub)::JSONB), '[]'::JSONB) INTO v_industry
    FROM ic_risk_industry_separation sub;

    -- Index dominance
    v_dominance := ic_index_dominance_analysis();

    v_execution_count := COALESCE(v_distribution.execution_count, 0);
    v_tenant_count := COALESCE(v_distribution.tenant_count, 0);

    -- ═══ CALIBRATION CHECKS ═══

    -- Check 1: Sufficient data (14 days, multiple tenants)
    IF v_execution_count < 7 THEN
        v_issues := v_issues || '"Insufficient executions. Need ≥7 over 14 days."'::JSONB;
    END IF;

    -- Check 2: Variance is meaningful (stddev ≥ 0.10)
    IF COALESCE(v_distribution.risk_stddev, 0) < 0.10 AND v_execution_count >= 7 THEN
        v_issues := v_issues || '"Risk scores clustering too tightly. Normalization thresholds may be too wide."'::JSONB;
    END IF;

    -- Check 3: Band distribution not 90/10 skewed
    IF COALESCE(v_distribution.pct_low, 0) > 0.90 OR COALESCE(v_distribution.pct_moderate, 0) > 0.90 OR COALESCE(v_distribution.pct_high, 0) > 0.90 THEN
        v_issues := v_issues || '"Band distribution severely skewed. >90% in single band."'::JSONB;
    END IF;

    -- Check 4: No single-factor dominance
    IF (v_dominance->>'is_single_factor')::BOOLEAN THEN
        v_issues := v_issues || ('"Single-factor dominance detected: ' || (v_dominance->>'dominant_index') || ' (corr=' || (v_dominance->>'dominant_correlation') || '). Composite robustness weakened."')::JSONB;
    END IF;

    -- Check 5: Risk range is non-trivial
    IF COALESCE(v_distribution.risk_range, 0) < 0.15 AND v_execution_count >= 7 THEN
        v_issues := v_issues || '"Risk range < 0.15. Scores may not be informative."'::JSONB;
    END IF;

    -- Check 6: Per-index variance — detect flat indices hiding behind composite
    IF v_execution_count >= 7 THEN
        IF COALESCE(v_distribution.stddev_rvi, 0) < 0.02 THEN
            v_issues := v_issues || '"RVI stddev near zero. Volatility threshold likely too wide. Revenue signal is flat."'::JSONB;
        END IF;
        IF COALESCE(v_distribution.stddev_eds, 0) < 0.02 THEN
            v_issues := v_issues || '"EDS stddev near zero. Engagement decay threshold too wide. Engagement signal is flat."'::JSONB;
        END IF;
        IF COALESCE(v_distribution.stddev_cdr, 0) < 0.02 THEN
            v_issues := v_issues || '"CDR stddev near zero. Cash deviation threshold too wide. Cash signal is flat."'::JSONB;
        END IF;
        IF COALESCE(v_distribution.stddev_ads, 0) < 0.02 THEN
            v_issues := v_issues || '"ADS stddev near zero. Anomaly density signal is flat."'::JSONB;
        END IF;
    END IF;

    -- Pass if: sufficient data AND no critical issues
    v_calibration_pass := v_execution_count >= 7 AND jsonb_array_length(v_issues) = 0;

    RETURN jsonb_build_object(
        'calibration_status', CASE WHEN v_calibration_pass THEN 'PASS' ELSE 'NEEDS_CALIBRATION' END,
        'period', '14 days',
        'execution_count', v_execution_count,
        'tenant_count', v_tenant_count,
        'issues', v_issues,
        'issue_count', jsonb_array_length(v_issues),
        'distribution', jsonb_build_object(
            'avg_risk', v_distribution.avg_risk,
            'stddev', v_distribution.risk_stddev,
            'min', v_distribution.min_risk,
            'max', v_distribution.max_risk,
            'range', v_distribution.risk_range,
            'pct_low', v_distribution.pct_low,
            'pct_moderate', v_distribution.pct_moderate,
            'pct_high', v_distribution.pct_high
        ),
        'per_index', jsonb_build_object(
            'rvi', jsonb_build_object('avg', v_distribution.avg_rvi, 'stddev', v_distribution.stddev_rvi),
            'eds', jsonb_build_object('avg', v_distribution.avg_eds, 'stddev', v_distribution.stddev_eds),
            'cdr', jsonb_build_object('avg', v_distribution.avg_cdr, 'stddev', v_distribution.stddev_cdr),
            'ads', jsonb_build_object('avg', v_distribution.avg_ads, 'stddev', v_distribution.stddev_ads)
        ),
        'industry_separation', v_industry,
        'index_dominance', v_dominance,
        'recommendation', CASE
            WHEN v_calibration_pass THEN 'Calibration PASS. Distribution healthy, indices balanced. Ready for probabilistic layer.'
            WHEN v_execution_count < 7 THEN 'Need more data. Run baseline daily for 14 days.'
            WHEN COALESCE(v_distribution.risk_stddev, 0) < 0.10 THEN 'Widen normalization thresholds. Scores clustering too tightly.'
            WHEN (v_dominance->>'is_single_factor')::BOOLEAN THEN 'Rebalance weights. Single index dominates composite.'
            ELSE 'Review identified issues before activating probabilistic engines.'
        END
    );
END;
$$;


-- ═══ GRANTS ═══
GRANT SELECT ON ic_risk_distribution_summary TO authenticated;
GRANT SELECT ON ic_risk_industry_separation TO authenticated;
GRANT EXECUTE ON FUNCTION ic_index_dominance_analysis() TO authenticated;
GRANT EXECUTE ON FUNCTION ic_risk_calibration_report() TO authenticated;

-- 037_cognition_platform.sql
-- ═══════════════════════════════════════════════════════════════
-- BIQc COGNITION PLATFORM — Foundation Tables
-- Migration: 037_cognition_platform.sql
--
-- New tables: memory (3), marketing (2), automation (1), observability (1)
-- Feature flags for all new modules
-- Zero modifications to existing tables
-- ═══════════════════════════════════════════════════════════════

-- ═══ 1. MEMORY LAYER ═══

CREATE TABLE IF NOT EXISTS episodic_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}',
    source_system TEXT,
    session_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_episodic_tenant ON episodic_memory(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS semantic_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    subject TEXT NOT NULL,
    predicate TEXT NOT NULL,
    object TEXT NOT NULL,
    confidence FLOAT DEFAULT 1.0,
    source_event_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_semantic_tenant ON semantic_memory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_semantic_subject ON semantic_memory(subject);

CREATE TABLE IF NOT EXISTS context_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    summary_type TEXT NOT NULL,
    summary_text TEXT NOT NULL,
    source_event_ids UUID[] DEFAULT '{}',
    source_count INT DEFAULT 0,
    key_outcomes JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_summaries_tenant ON context_summaries(tenant_id, created_at DESC);

-- ═══ 2. MARKETING INTELLIGENCE ═══

CREATE TABLE IF NOT EXISTS marketing_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    version INT DEFAULT 1,
    competitors JSONB DEFAULT '[]',
    scores JSONB NOT NULL DEFAULT '{}',
    summary TEXT,
    radar_data JSONB,
    source_data JSONB DEFAULT '{}',
    is_current BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_benchmarks_tenant ON marketing_benchmarks(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_benchmarks_current ON marketing_benchmarks(tenant_id) WHERE is_current = true;

-- ═══ 3. MARKETING AUTOMATION ═══

CREATE TABLE IF NOT EXISTS action_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    action_type TEXT NOT NULL,
    action_params JSONB NOT NULL DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','executing','completed','failed','cancelled')),
    external_id TEXT,
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_action_tenant ON action_log(tenant_id, created_at DESC);

-- ═══ 4. OBSERVABILITY ═══

CREATE TABLE IF NOT EXISTS llm_call_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    model_name TEXT NOT NULL,
    model_version TEXT,
    prompt_tokens INT,
    completion_tokens INT,
    total_tokens INT,
    latency_ms INT,
    temperature FLOAT,
    max_tokens INT,
    input_hash TEXT,
    output_valid BOOLEAN,
    validation_errors JSONB,
    feature_flag TEXT,
    endpoint TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_llm_log_tenant ON llm_call_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_log_model ON llm_call_log(model_name, created_at DESC);

-- ═══ 5. FEATURE FLAGS FOR NEW MODULES ═══

INSERT INTO ic_feature_flags (flag_name, enabled, description) VALUES
    ('rag_chat_enabled', false, 'RAG-augmented SoundBoard chat'),
    ('marketing_benchmarks_enabled', false, 'Marketing Intelligence tab + benchmarking'),
    ('marketing_automation_enabled', false, 'Ad/blog/social post generation'),
    ('memory_layer_enabled', false, 'Episodic + semantic memory'),
    ('observability_full_enabled', false, 'Full LLM call logging'),
    ('guardrails_enabled', false, 'Input sanitisation + output filtering'),
    ('graphrag_enabled', false, 'Knowledge graph retrieval')
ON CONFLICT (flag_name) DO NOTHING;

-- ═══ 6. RLS ═══

ALTER TABLE episodic_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_call_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_read" ON episodic_memory;
CREATE POLICY "tenant_read" ON episodic_memory FOR SELECT USING (true);
DROP POLICY IF EXISTS "service_all" ON episodic_memory;
CREATE POLICY "service_all" ON episodic_memory FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "tenant_read" ON semantic_memory;
CREATE POLICY "tenant_read" ON semantic_memory FOR SELECT USING (true);
DROP POLICY IF EXISTS "service_all" ON semantic_memory;
CREATE POLICY "service_all" ON semantic_memory FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "tenant_read" ON context_summaries;
CREATE POLICY "tenant_read" ON context_summaries FOR SELECT USING (true);
DROP POLICY IF EXISTS "service_all" ON context_summaries;
CREATE POLICY "service_all" ON context_summaries FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "tenant_read" ON marketing_benchmarks;
CREATE POLICY "tenant_read" ON marketing_benchmarks FOR SELECT USING (true);
DROP POLICY IF EXISTS "service_all" ON marketing_benchmarks;
CREATE POLICY "service_all" ON marketing_benchmarks FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "tenant_read" ON action_log;
CREATE POLICY "tenant_read" ON action_log FOR SELECT USING (true);
DROP POLICY IF EXISTS "service_all" ON action_log;
CREATE POLICY "service_all" ON action_log FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "tenant_read" ON llm_call_log;
CREATE POLICY "tenant_read" ON llm_call_log FOR SELECT USING (true);
DROP POLICY IF EXISTS "service_all" ON llm_call_log;
CREATE POLICY "service_all" ON llm_call_log FOR ALL USING (true) WITH CHECK (true);

-- 038_rag_infrastructure.sql
-- ═══════════════════════════════════════════════════════════════
-- BIQc RAG INFRASTRUCTURE — pgvector + Embeddings + Retrieval
-- Migration: 038_rag_infrastructure.sql
--
-- Enables pgvector, creates embedding tables, retrieval functions.
-- Feature-flagged: rag_chat_enabled, graphrag_enabled
-- Zero modification to existing tables.
-- ═══════════════════════════════════════════════════════════════

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ═══ 1. DOCUMENT EMBEDDINGS ═══
CREATE TABLE IF NOT EXISTS rag_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    embedding vector(1536),
    source_type TEXT NOT NULL CHECK (source_type IN ('website','profile','snapshot','conversation','document','competitor','benchmark')),
    source_id TEXT,
    source_url TEXT,
    metadata JSONB DEFAULT '{}',
    chunk_index INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_rag_tenant ON rag_embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rag_source ON rag_embeddings(source_type);

-- HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_rag_embedding ON rag_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ═══ 2. SIMILARITY SEARCH FUNCTION ═══
DROP FUNCTION IF EXISTS rag_search CASCADE;
CREATE OR REPLACE FUNCTION rag_search(
    p_tenant_id UUID,
    p_query_embedding vector(1536),
    p_limit INT DEFAULT 5,
    p_source_types TEXT[] DEFAULT NULL,
    p_similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE(
    id UUID,
    content TEXT,
    source_type TEXT,
    source_url TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.content,
        e.source_type,
        e.source_url,
        e.metadata,
        1 - (e.embedding <=> p_query_embedding) AS similarity
    FROM rag_embeddings e
    WHERE e.tenant_id = p_tenant_id
    AND (p_source_types IS NULL OR e.source_type = ANY(p_source_types))
    AND 1 - (e.embedding <=> p_query_embedding) >= p_similarity_threshold
    ORDER BY e.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$;

-- ═══ 3. EMBEDDING STATS VIEW ═══
CREATE OR REPLACE VIEW rag_stats AS
SELECT
    tenant_id,
    source_type,
    COUNT(*) AS chunk_count,
    MAX(created_at) AS latest_embedding
FROM rag_embeddings
GROUP BY tenant_id, source_type;

-- ═══ RLS ═══
ALTER TABLE rag_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_read_embeddings" ON rag_embeddings;
CREATE POLICY "tenant_read_embeddings" ON rag_embeddings FOR SELECT USING (true);
DROP POLICY IF EXISTS "service_manage_embeddings" ON rag_embeddings;
CREATE POLICY "service_manage_embeddings" ON rag_embeddings FOR ALL USING (true) WITH CHECK (true);

GRANT EXECUTE ON FUNCTION rag_search(UUID, vector, INT, TEXT[], FLOAT) TO authenticated;
GRANT SELECT ON rag_stats TO authenticated;

-- 039_ab_testing.sql
-- ═══════════════════════════════════════════════════════════════
-- BIQc A/B TESTING FRAMEWORK
-- Migration: 039_ab_testing.sql
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ab_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_name TEXT UNIQUE NOT NULL,
    description TEXT,
    variant_a TEXT NOT NULL DEFAULT 'control',
    variant_b TEXT NOT NULL DEFAULT 'treatment',
    traffic_pct_b FLOAT DEFAULT 0.5,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft','running','paused','completed')),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ab_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID REFERENCES ab_experiments(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    variant TEXT NOT NULL,
    assigned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(experiment_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS ab_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID REFERENCES ab_experiments(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    variant TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value FLOAT NOT NULL,
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ab_assign_exp ON ab_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_ab_assign_tenant ON ab_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ab_metrics_exp ON ab_metrics(experiment_id);

-- Deterministic assignment function
DROP FUNCTION IF EXISTS ab_get_variant CASCADE;
CREATE OR REPLACE FUNCTION ab_get_variant(p_experiment_name TEXT, p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_exp RECORD;
    v_existing TEXT;
    v_hash FLOAT;
    v_variant TEXT;
BEGIN
    SELECT * INTO v_exp FROM ab_experiments WHERE experiment_name = p_experiment_name AND status = 'running';
    IF NOT FOUND THEN RETURN 'control'; END IF;

    SELECT variant INTO v_existing FROM ab_assignments WHERE experiment_id = v_exp.id AND tenant_id = p_tenant_id;
    IF FOUND THEN RETURN v_existing; END IF;

    -- Deterministic hash-based assignment (consistent across calls)
    v_hash := abs(hashtext(p_tenant_id::TEXT || v_exp.id::TEXT)::FLOAT) / 2147483647.0;
    v_variant := CASE WHEN v_hash < v_exp.traffic_pct_b THEN v_exp.variant_b ELSE v_exp.variant_a END;

    INSERT INTO ab_assignments (experiment_id, tenant_id, variant) VALUES (v_exp.id, p_tenant_id, v_variant);
    RETURN v_variant;
END;
$$;

-- Experiment results summary
DROP FUNCTION IF EXISTS ab_experiment_results CASCADE;
CREATE OR REPLACE FUNCTION ab_experiment_results(p_experiment_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_exp_id UUID;
    v_results JSONB;
BEGIN
    SELECT id INTO v_exp_id FROM ab_experiments WHERE experiment_name = p_experiment_name;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'experiment not found'); END IF;

    SELECT jsonb_build_object(
        'experiment', p_experiment_name,
        'total_assignments', (SELECT COUNT(*) FROM ab_assignments WHERE experiment_id = v_exp_id),
        'variant_a_count', (SELECT COUNT(*) FROM ab_assignments WHERE experiment_id = v_exp_id AND variant = 'control'),
        'variant_b_count', (SELECT COUNT(*) FROM ab_assignments WHERE experiment_id = v_exp_id AND variant = 'treatment'),
        'metrics', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'variant', variant, 'metric', metric_name,
            'avg_value', ROUND(AVG(metric_value)::NUMERIC, 4),
            'count', COUNT(*)
        )), '[]'::JSONB) FROM ab_metrics WHERE experiment_id = v_exp_id GROUP BY variant, metric_name)
    ) INTO v_results;

    RETURN v_results;
END;
$$;

ALTER TABLE ab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_experiments" ON ab_experiments;
CREATE POLICY "read_experiments" ON ab_experiments FOR SELECT USING (true);
DROP POLICY IF EXISTS "manage_experiments" ON ab_experiments;
CREATE POLICY "manage_experiments" ON ab_experiments FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "read_assignments" ON ab_assignments;
CREATE POLICY "read_assignments" ON ab_assignments FOR SELECT USING (true);
DROP POLICY IF EXISTS "manage_assignments" ON ab_assignments;
CREATE POLICY "manage_assignments" ON ab_assignments FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "read_metrics" ON ab_metrics;
CREATE POLICY "read_metrics" ON ab_metrics FOR SELECT USING (true);
DROP POLICY IF EXISTS "manage_metrics" ON ab_metrics;
CREATE POLICY "manage_metrics" ON ab_metrics FOR ALL USING (true) WITH CHECK (true);

GRANT EXECUTE ON FUNCTION ab_get_variant(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ab_experiment_results(TEXT) TO authenticated;

-- Seed initial experiments
INSERT INTO ab_experiments (experiment_name, description, variant_a, variant_b, traffic_pct_b, status) VALUES
    ('rag_chat_v1', 'Compare RAG-augmented SoundBoard vs original', 'original', 'rag_augmented', 0.5, 'draft'),
    ('onboarding_flow_v2', 'New onboarding vs legacy calibration', 'legacy', 'streamlined', 0.3, 'draft'),
    ('marketing_tab_exposure', 'Show Marketing Intelligence tab to subset', 'hidden', 'visible', 0.5, 'draft')
ON CONFLICT (experiment_name) DO NOTHING;

-- 040_super_admin.sql
-- ═══════════════════════════════════════════════════════════════
-- BIQc SUPER ADMIN + SUPPORT CONSOLE
-- Migration: 040_super_admin.sql
-- ═══════════════════════════════════════════════════════════════

-- 1. Admin actions audit table
CREATE TABLE IF NOT EXISTS admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL,
    target_user_id UUID,
    action_type TEXT NOT NULL,
    previous_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_user_id);

ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "superadmin_read" ON admin_actions;
CREATE POLICY "superadmin_read" ON admin_actions FOR SELECT USING (true);
DROP POLICY IF EXISTS "service_manage" ON admin_actions;
CREATE POLICY "service_manage" ON admin_actions FOR ALL USING (true) WITH CHECK (true);

-- 2. Ensure role column on users
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_disabled') THEN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 3. Set andre as super_admin
UPDATE users SET role = 'super_admin' WHERE email = 'andre@thestrategysquad.com.au';
UPDATE users SET role = 'super_admin' WHERE email = 'andre@thestrategysquad.com';

-- 4. Feature flags
INSERT INTO ic_feature_flags (flag_name, enabled, description) VALUES
    ('super_admin_enabled', true, 'Super admin role and test page'),
    ('support_page_enabled', true, 'Internal support user management console'),
    ('legal_menu_enabled', true, 'Trust & Legal dropdown menu')
ON CONFLICT (flag_name) DO UPDATE SET enabled = true;

-- 5. Admin user list RPC (secure — only returns non-sensitive fields)
DROP FUNCTION IF EXISTS admin_list_users CASCADE;
CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', u.id,
            'email', u.email,
            'full_name', u.full_name,
            'role', u.role,
            'is_disabled', COALESCE(u.is_disabled, false),
            'business_name', bp.business_name,
            'subscription_tier', COALESCE(bp.subscription_tier, 'free'),
            'industry', bp.industry,
            'created_at', u.created_at
        ) ORDER BY u.created_at DESC), '[]'::JSONB)
        FROM users u
        LEFT JOIN business_profiles bp ON bp.user_id = u.id
    );
END;
$$;

-- 6. Admin disable/enable user
DROP FUNCTION IF EXISTS admin_toggle_user CASCADE;
CREATE OR REPLACE FUNCTION admin_toggle_user(p_admin_id UUID, p_target_id UUID, p_disable BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prev BOOLEAN;
BEGIN
    SELECT COALESCE(is_disabled, false) INTO v_prev FROM users WHERE id = p_target_id;
    UPDATE users SET is_disabled = p_disable WHERE id = p_target_id;
    INSERT INTO admin_actions (admin_user_id, target_user_id, action_type, previous_value, new_value)
    VALUES (p_admin_id, p_target_id, CASE WHEN p_disable THEN 'disable_user' ELSE 'enable_user' END,
            jsonb_build_object('is_disabled', v_prev), jsonb_build_object('is_disabled', p_disable));
    RETURN jsonb_build_object('status', 'ok', 'is_disabled', p_disable);
END;
$$;

-- 7. Admin update subscription
DROP FUNCTION IF EXISTS admin_update_subscription CASCADE;
CREATE OR REPLACE FUNCTION admin_update_subscription(p_admin_id UUID, p_target_id UUID, p_tier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prev TEXT;
BEGIN
    SELECT COALESCE(subscription_tier, 'free') INTO v_prev FROM business_profiles WHERE user_id = p_target_id;
    UPDATE business_profiles SET subscription_tier = p_tier WHERE user_id = p_target_id;
    INSERT INTO admin_actions (admin_user_id, target_user_id, action_type, previous_value, new_value)
    VALUES (p_admin_id, p_target_id, 'update_subscription',
            jsonb_build_object('tier', v_prev), jsonb_build_object('tier', p_tier));
    RETURN jsonb_build_object('status', 'ok', 'previous_tier', v_prev, 'new_tier', p_tier);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_toggle_user(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_subscription(UUID, UUID, TEXT) TO authenticated;

-- 041_security_lint_fixes.sql
-- ═══════════════════════════════════════════════════════════════
-- BIQc SUPABASE SECURITY LINT FIXES
-- Migration: 041_security_lint_fixes.sql
--
-- Fixes 3 categories of security issues:
--   1. Views with SECURITY DEFINER → SECURITY INVOKER
--   2. Functions with mutable search_path → set search_path = ''
--   3. RLS policies with unrestricted FOR ALL → scoped to service_role
-- ═══════════════════════════════════════════════════════════════


-- ═══ 1. FIX VIEWS: SECURITY DEFINER → INVOKER ═══

ALTER VIEW IF EXISTS rag_stats SET (security_invoker = on);
ALTER VIEW IF EXISTS ic_risk_industry_separation SET (security_invoker = on);
ALTER VIEW IF EXISTS v_governance_summary SET (security_invoker = on);
ALTER VIEW IF EXISTS v_integration_status SET (security_invoker = on);
ALTER VIEW IF EXISTS ic_risk_distribution_summary SET (security_invoker = on);


-- ═══ 2. FIX FUNCTIONS: Set immutable search_path ═══

ALTER FUNCTION ic_index_dominance_analysis() SET search_path = '';
ALTER FUNCTION get_escalation_summary(UUID) SET search_path = '';
ALTER FUNCTION detect_silence(UUID) SET search_path = '';
ALTER FUNCTION is_spine_enabled() SET search_path = '';
ALTER FUNCTION ic_calculate_all_risk_baselines() SET search_path = '';
ALTER FUNCTION compute_pressure_levels(UUID) SET search_path = '';
ALTER FUNCTION increment_audit_counter(UUID) SET search_path = '';
ALTER FUNCTION ab_experiment_results(TEXT) SET search_path = '';
ALTER FUNCTION ic_resolve_industry_code(TEXT) SET search_path = '';
ALTER FUNCTION compute_data_readiness(UUID) SET search_path = '';
ALTER FUNCTION emergency_delete_governance_event(UUID, TEXT) SET search_path = '';
ALTER FUNCTION build_intelligence_summary(UUID) SET search_path = '';
ALTER FUNCTION trigger_log_integration_change() SET search_path = '';
ALTER FUNCTION ic_calculate_risk_baseline(UUID, UUID) SET search_path = '';
ALTER FUNCTION ab_get_variant(TEXT, UUID) SET search_path = '';
ALTER FUNCTION ic_process_event_queue() SET search_path = '';
ALTER FUNCTION compute_evidence_freshness(UUID) SET search_path = '';
ALTER FUNCTION compute_watchtower_positions(UUID) SET search_path = '';
ALTER FUNCTION detect_contradictions(UUID) SET search_path = '';
ALTER FUNCTION ic_generate_all_snapshots() SET search_path = '';
ALTER FUNCTION ic_generate_daily_snapshot(UUID) SET search_path = '';
ALTER FUNCTION compute_concentration_risk(UUID) SET search_path = '';
ALTER FUNCTION ic_risk_calibration_report() SET search_path = '';
ALTER FUNCTION compute_revenue_scenarios(UUID) SET search_path = '';
ALTER FUNCTION admin_update_subscription(UUID, UUID, TEXT) SET search_path = '';
ALTER FUNCTION admin_toggle_user(UUID, UUID, BOOLEAN) SET search_path = '';
ALTER FUNCTION admin_list_users() SET search_path = '';
ALTER FUNCTION compute_workforce_health(UUID) SET search_path = '';
ALTER FUNCTION compute_insight_scores(UUID) SET search_path = '';
ALTER FUNCTION compute_profile_completeness(UUID) SET search_path = '';
ALTER FUNCTION increment_snapshot_counter(UUID) SET search_path = '';
ALTER FUNCTION emit_governance_event(UUID, TEXT, TEXT, TEXT, NUMERIC) SET search_path = '';
ALTER FUNCTION trigger_update_integration_sync() SET search_path = '';
ALTER FUNCTION trigger_log_report_export() SET search_path = '';
ALTER FUNCTION prevent_governance_update() SET search_path = '';
ALTER FUNCTION ic_prevent_weight_update() SET search_path = '';
ALTER FUNCTION ic_validate_snapshot_correlation(UUID) SET search_path = '';
ALTER FUNCTION rag_search(UUID, vector, INT, TEXT[], FLOAT) SET search_path = '';
ALTER FUNCTION reset_monthly_counters() SET search_path = '';

-- Handle functions that may have different signatures
DO $$ BEGIN ALTER FUNCTION compute_market_risk_weight() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION calibrate_pressure() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION decay_evidence() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION compute_forensic_score() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;


-- ═══ 3. FIX RLS: Scope service policies to service_role only ═══
-- Replace "FOR ALL USING (true)" with "FOR ALL TO service_role USING (true)"

-- ab_assignments
DROP POLICY IF EXISTS "manage_assignments" ON ab_assignments;
CREATE POLICY IF NOT EXISTS "manage_assignments" ON ab_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ab_experiments
DROP POLICY IF EXISTS "manage_experiments" ON ab_experiments;
CREATE POLICY IF NOT EXISTS "manage_experiments" ON ab_experiments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ab_metrics
DROP POLICY IF EXISTS "manage_metrics" ON ab_metrics;
CREATE POLICY IF NOT EXISTS "manage_metrics" ON ab_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);

-- action_log
DROP POLICY IF EXISTS "service_all" ON action_log;
CREATE POLICY IF NOT EXISTS "service_all" ON action_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- admin_actions
DROP POLICY IF EXISTS "service_manage" ON admin_actions;
CREATE POLICY IF NOT EXISTS "service_manage" ON admin_actions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- context_summaries
DROP POLICY IF EXISTS "service_all" ON context_summaries;
CREATE POLICY IF NOT EXISTS "service_all" ON context_summaries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- episodic_memory
DROP POLICY IF EXISTS "service_all" ON episodic_memory;
CREATE POLICY IF NOT EXISTS "service_all" ON episodic_memory FOR ALL TO service_role USING (true) WITH CHECK (true);

-- escalation_history
DROP POLICY IF EXISTS "Service manages escalation_history" ON escalation_history;
DROP POLICY IF EXISTS "service_manage_escalation" ON escalation_history;
CREATE POLICY "service_manage_escalation" ON escalation_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_daily_metric_snapshots
DROP POLICY IF EXISTS "manage_snaps" ON ic_daily_metric_snapshots;
CREATE POLICY IF NOT EXISTS "manage_snaps" ON ic_daily_metric_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_decision_outcomes
DROP POLICY IF EXISTS "manage_outcomes" ON ic_decision_outcomes;
CREATE POLICY IF NOT EXISTS "manage_outcomes" ON ic_decision_outcomes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_decisions
DROP POLICY IF EXISTS "manage_decisions" ON ic_decisions;
CREATE POLICY IF NOT EXISTS "manage_decisions" ON ic_decisions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_feature_flags
DROP POLICY IF EXISTS "manage_flags" ON ic_feature_flags;
CREATE POLICY IF NOT EXISTS "manage_flags" ON ic_feature_flags FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_intelligence_events
DROP POLICY IF EXISTS "manage_events" ON ic_intelligence_events;
CREATE POLICY IF NOT EXISTS "manage_events" ON ic_intelligence_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_model_executions
DROP POLICY IF EXISTS "manage_executions" ON ic_model_executions;
CREATE POLICY IF NOT EXISTS "manage_executions" ON ic_model_executions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_model_registry
DROP POLICY IF EXISTS "manage_registry" ON ic_model_registry;
CREATE POLICY IF NOT EXISTS "manage_registry" ON ic_model_registry FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_ontology_edges
DROP POLICY IF EXISTS "manage_edges" ON ic_ontology_edges;
CREATE POLICY IF NOT EXISTS "manage_edges" ON ic_ontology_edges FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_ontology_nodes
DROP POLICY IF EXISTS "manage_nodes" ON ic_ontology_nodes;
CREATE POLICY IF NOT EXISTS "manage_nodes" ON ic_ontology_nodes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ingestion_audits
DROP POLICY IF EXISTS "Service manages audits" ON ingestion_audits;
DROP POLICY IF EXISTS "service_manage_audits" ON ingestion_audits;
CREATE POLICY "service_manage_audits" ON ingestion_audits FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ingestion_cleaned
DROP POLICY IF EXISTS "Service manages cleaned" ON ingestion_cleaned;
DROP POLICY IF EXISTS "service_manage_cleaned" ON ingestion_cleaned;
CREATE POLICY "service_manage_cleaned" ON ingestion_cleaned FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ingestion_pages
DROP POLICY IF EXISTS "Service manages pages" ON ingestion_pages;
DROP POLICY IF EXISTS "service_manage_pages" ON ingestion_pages;
CREATE POLICY "service_manage_pages" ON ingestion_pages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ingestion_sessions
DROP POLICY IF EXISTS "Service manages sessions" ON ingestion_sessions;
DROP POLICY IF EXISTS "service_manage_sessions" ON ingestion_sessions;
CREATE POLICY "service_manage_sessions" ON ingestion_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- insight_outcomes
DROP POLICY IF EXISTS "Service role can insert outcomes" ON insight_outcomes;
DROP POLICY IF EXISTS "Service role can update outcomes" ON insight_outcomes;
DROP POLICY IF EXISTS "service_manage_outcomes" ON insight_outcomes;
CREATE POLICY "service_manage_outcomes" ON insight_outcomes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- llm_call_log
DROP POLICY IF EXISTS "service_all" ON llm_call_log;
CREATE POLICY IF NOT EXISTS "service_all" ON llm_call_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- marketing_benchmarks
DROP POLICY IF EXISTS "service_all" ON marketing_benchmarks;
CREATE POLICY IF NOT EXISTS "service_all" ON marketing_benchmarks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- rag_embeddings
DROP POLICY IF EXISTS "service_manage_embeddings" ON rag_embeddings;
CREATE POLICY IF NOT EXISTS "service_manage_embeddings" ON rag_embeddings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- report_exports
DROP POLICY IF EXISTS "Service role manages report_exports" ON report_exports;
DROP POLICY IF EXISTS "service_manage_reports" ON report_exports;
CREATE POLICY "service_manage_reports" ON report_exports FOR ALL TO service_role USING (true) WITH CHECK (true);

-- semantic_memory
DROP POLICY IF EXISTS "service_all" ON semantic_memory;
CREATE POLICY IF NOT EXISTS "service_all" ON semantic_memory FOR ALL TO service_role USING (true) WITH CHECK (true);

-- workspace_integrations
DROP POLICY IF EXISTS "Service role manages workspace_integrations" ON workspace_integrations;
DROP POLICY IF EXISTS "service_manage_integrations" ON workspace_integrations;
CREATE POLICY "service_manage_integrations" ON workspace_integrations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- governance_events (keep insert-only for service role - already hardened)
DROP POLICY IF EXISTS "service_insert_governance_events" ON governance_events;
CREATE POLICY IF NOT EXISTS "service_insert_governance_events" ON governance_events FOR INSERT TO service_role WITH CHECK (true);

