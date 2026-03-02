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
CREATE POLICY "read_experiments" ON ab_experiments FOR SELECT USING (true);
CREATE POLICY "manage_experiments" ON ab_experiments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_assignments" ON ab_assignments FOR SELECT USING (true);
CREATE POLICY "manage_assignments" ON ab_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "read_metrics" ON ab_metrics FOR SELECT USING (true);
CREATE POLICY "manage_metrics" ON ab_metrics FOR ALL USING (true) WITH CHECK (true);

GRANT EXECUTE ON FUNCTION ab_get_variant(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ab_experiment_results(TEXT) TO authenticated;

-- Seed initial experiments
INSERT INTO ab_experiments (experiment_name, description, variant_a, variant_b, traffic_pct_b, status) VALUES
    ('rag_chat_v1', 'Compare RAG-augmented SoundBoard vs original', 'original', 'rag_augmented', 0.5, 'draft'),
    ('onboarding_flow_v2', 'New onboarding vs legacy calibration', 'legacy', 'streamlined', 0.3, 'draft'),
    ('marketing_tab_exposure', 'Show Marketing Intelligence tab to subset', 'hidden', 'visible', 0.5, 'draft')
ON CONFLICT (experiment_name) DO NOTHING;
