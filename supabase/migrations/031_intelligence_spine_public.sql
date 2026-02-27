-- ═══════════════════════════════════════════════════════════════
-- BIQc INTELLIGENCE SPINE — Public Schema (ic_ prefix)
-- Migration: 031_intelligence_spine_public.sql
-- 
-- Supabase REST API only exposes public schema.
-- All spine tables use ic_ prefix. Zero collision with existing tables.
-- Additive only. No existing tables modified.
-- ═══════════════════════════════════════════════════════════════

-- Feature flag
CREATE TABLE IF NOT EXISTS ic_feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name TEXT UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMP DEFAULT now()
);
INSERT INTO ic_feature_flags (flag_name, enabled, description)
VALUES ('intelligence_spine_enabled', false, 'Master switch for Intelligence Spine')
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

CREATE POLICY "read_flags" ON ic_feature_flags FOR SELECT USING (true);
CREATE POLICY "manage_flags" ON ic_feature_flags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_events" ON ic_intelligence_events FOR SELECT USING (true);
CREATE POLICY "manage_events" ON ic_intelligence_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_snaps" ON ic_daily_metric_snapshots FOR SELECT USING (true);
CREATE POLICY "manage_snaps" ON ic_daily_metric_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_nodes" ON ic_ontology_nodes FOR SELECT USING (true);
CREATE POLICY "manage_nodes" ON ic_ontology_nodes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_edges" ON ic_ontology_edges FOR SELECT USING (true);
CREATE POLICY "manage_edges" ON ic_ontology_edges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_decisions" ON ic_decisions FOR SELECT USING (true);
CREATE POLICY "manage_decisions" ON ic_decisions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_outcomes" ON ic_decision_outcomes FOR SELECT USING (true);
CREATE POLICY "manage_outcomes" ON ic_decision_outcomes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_registry" ON ic_model_registry FOR SELECT USING (true);
CREATE POLICY "manage_registry" ON ic_model_registry FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_executions" ON ic_model_executions FOR SELECT USING (true);
CREATE POLICY "manage_executions" ON ic_model_executions FOR ALL USING (true) WITH CHECK (true);

-- Feature flag check function
CREATE OR REPLACE FUNCTION is_spine_enabled()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT COALESCE((SELECT enabled FROM ic_feature_flags WHERE flag_name = 'intelligence_spine_enabled'), false);
$$;
GRANT EXECUTE ON FUNCTION is_spine_enabled() TO authenticated;

-- Snapshot generator function
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
