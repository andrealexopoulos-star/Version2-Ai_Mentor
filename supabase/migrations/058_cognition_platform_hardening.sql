-- Cognition Platform Hardening
-- Adds: integration snapshot cache, calibration RPC, lineage/confidence fields,
-- and compatibility views expected by the Business Brain rollout.

CREATE SCHEMA IF NOT EXISTS business_core;

CREATE TABLE IF NOT EXISTS business_core.integration_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    source_key TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    data_sources_count INTEGER NOT NULL DEFAULT 0,
    confidence_score NUMERIC(6, 4) NOT NULL DEFAULT 0,
    data_freshness TEXT,
    lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    UNIQUE (tenant_id, source_key)
);

CREATE INDEX IF NOT EXISTS idx_business_core_integration_snapshots_tenant
    ON business_core.integration_snapshots(tenant_id, generated_at DESC);

ALTER TABLE business_core.concern_evaluations
    ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(6, 4),
    ADD COLUMN IF NOT EXISTS data_sources_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS data_freshness TEXT,
    ADD COLUMN IF NOT EXISTS evidence_lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS recommended_action_id TEXT,
    ADD COLUMN IF NOT EXISTS threshold_hits JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS issue_brief TEXT,
    ADD COLUMN IF NOT EXISTS why_now_brief TEXT,
    ADD COLUMN IF NOT EXISTS action_brief TEXT,
    ADD COLUMN IF NOT EXISTS if_ignored_brief TEXT,
    ADD COLUMN IF NOT EXISTS fact_points JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS source_summary TEXT,
    ADD COLUMN IF NOT EXISTS confidence_note TEXT,
    ADD COLUMN IF NOT EXISTS outlook_30_60_90 JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS repeat_count INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS escalation_state TEXT,
    ADD COLUMN IF NOT EXISTS decision_label TEXT;

UPDATE business_core.concern_evaluations
SET confidence_score = COALESCE(confidence_score, confidence)
WHERE confidence_score IS NULL;

CREATE OR REPLACE VIEW business_core.brain_concerns AS
SELECT
    concern_id,
    name,
    description,
    required_signals,
    tier,
    priority_formula,
    deterministic_rule,
    probabilistic_model,
    active,
    created_at,
    updated_at
FROM business_core.concern_registry;

CREATE OR REPLACE VIEW business_core.brain_evaluations AS
SELECT
    id,
    tenant_id,
    concern_id,
    priority_score,
    impact,
    urgency,
    COALESCE(confidence_score, confidence) AS confidence_score,
    effort,
    recommendation,
    explanation,
    evidence,
    data_sources_count,
    data_freshness,
    evidence_lineage,
    recommended_action_id,
    evaluated_at
FROM business_core.concern_evaluations;

CREATE OR REPLACE FUNCTION business_core.brain_initial_calibration(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_top_concerns JSONB := '[]'::jsonb;
    v_confidence NUMERIC := 0;
    v_data_coverage NUMERIC := 0;
    v_sources INTEGER := 0;
BEGIN
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'concern_id', concern_id,
                'priority_score', priority_score,
                'recommendation', recommendation,
                'issue_brief', issue_brief,
                'why_now_brief', why_now_brief,
                'action_brief', action_brief,
                'if_ignored_brief', if_ignored_brief,
                'confidence_score', COALESCE(confidence_score, confidence),
                'data_sources_count', COALESCE(data_sources_count, 0),
                'data_freshness', data_freshness,
                'lineage', COALESCE(evidence_lineage, '{}'::jsonb),
                'evaluated_at', evaluated_at
            )
        ),
        '[]'::jsonb
    )
    INTO v_top_concerns
    FROM (
        SELECT *
        FROM business_core.concern_evaluations
        WHERE tenant_id = p_tenant_id
        ORDER BY evaluated_at DESC, priority_score DESC
        LIMIT 5
    ) t;

    SELECT COALESCE(AVG(COALESCE(confidence_score, confidence)), 0)
    INTO v_confidence
    FROM business_core.concern_evaluations
    WHERE tenant_id = p_tenant_id
      AND evaluated_at > now() - interval '30 days';

    SELECT COUNT(*)
    INTO v_sources
    FROM integration_accounts
    WHERE user_id = p_tenant_id
      AND status = 'connected';

    SELECT CASE
        WHEN total_metrics = 0 THEN 0
        ELSE ROUND((computed_metrics::numeric / total_metrics::numeric), 4)
    END
    INTO v_data_coverage
    FROM (
        SELECT
            COUNT(*) AS total_metrics,
            COUNT(*) FILTER (WHERE value IS NOT NULL) AS computed_metrics
        FROM business_core.business_metrics
        WHERE tenant_id = p_tenant_id
          AND calculated_at > now() - interval '45 days'
    ) stats;

    RETURN jsonb_build_object(
        'tenant_id', p_tenant_id,
        'top_5_concerns', v_top_concerns,
        'confidence_score', COALESCE(v_confidence, 0),
        'data_coverage', COALESCE(v_data_coverage, 0),
        'data_sources_count', COALESCE(v_sources, 0),
        'generated_at', now()
    );
END;
$$;

GRANT USAGE ON SCHEMA business_core TO authenticated;
GRANT USAGE ON SCHEMA business_core TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE business_core.integration_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE business_core.integration_snapshots TO service_role;
GRANT SELECT ON TABLE business_core.brain_concerns TO authenticated;
GRANT SELECT ON TABLE business_core.brain_concerns TO service_role;
GRANT SELECT ON TABLE business_core.brain_evaluations TO authenticated;
GRANT SELECT ON TABLE business_core.brain_evaluations TO service_role;
GRANT EXECUTE ON FUNCTION business_core.brain_initial_calibration(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION business_core.brain_initial_calibration(UUID) TO service_role;

ALTER TABLE business_core.integration_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'business_core'
          AND tablename = 'integration_snapshots'
          AND policyname = 'tenant_rw_integration_snapshots'
    ) THEN
        CREATE POLICY tenant_rw_integration_snapshots
            ON business_core.integration_snapshots
            FOR ALL TO authenticated
            USING (tenant_id = auth.uid())
            WITH CHECK (tenant_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'business_core'
          AND tablename = 'integration_snapshots'
          AND policyname = 'service_all_integration_snapshots'
    ) THEN
        CREATE POLICY service_all_integration_snapshots
            ON business_core.integration_snapshots
            FOR ALL TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;