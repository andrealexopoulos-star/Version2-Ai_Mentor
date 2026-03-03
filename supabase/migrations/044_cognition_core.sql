-- ═══════════════════════════════════════════════════════════════
-- BIQc COGNITION CORE v2 — Migration 044
-- ENTERPRISE SCHEMA: Tables + Telemetry + Health History + Lifecycle
--
-- ZERO FRONTEND LOGIC. ALL COMPUTATION IN SQL.
-- EVIDENCE-GATED. DETERMINISTIC. APPEND-ONLY DECISIONS.
-- MULTI-TENANT ISOLATED. PERFORMANCE INSTRUMENTED.
-- ═══════════════════════════════════════════════════════════════


-- ═══ 1. INTEGRATION HEALTH MONITOR (ENTERPRISE) ═══

CREATE TABLE IF NOT EXISTS integration_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    provider TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'NOT_CONNECTED'
        CHECK (status IN ('CONNECTED','TOKEN_EXPIRED','PERMISSION_CHANGED','SYNC_FAILED','NOT_CONNECTED','DEGRADED')),
    last_successful_sync TIMESTAMPTZ,
    data_freshness_minutes INT,
    last_error_message TEXT,
    required_user_action TEXT,
    latency_ms INT DEFAULT 0,
    sla_breached BOOLEAN DEFAULT false,
    retry_count INT DEFAULT 0,
    last_retry_at TIMESTAMPTZ,
    consecutive_failures INT DEFAULT 0,
    checked_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_ih_tenant ON integration_health(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ih_status ON integration_health(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ih_sla ON integration_health(sla_breached) WHERE sla_breached = true;

ALTER TABLE integration_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ih_tenant_read" ON integration_health FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "ih_service_all" ON integration_health FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Integration degradation history
CREATE TABLE IF NOT EXISTS integration_health_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    provider TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    error_message TEXT,
    latency_ms INT,
    changed_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ihh_tenant ON integration_health_history(tenant_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ihh_provider ON integration_health_history(tenant_id, provider);

ALTER TABLE integration_health_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ihh_tenant_read" ON integration_health_history FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "ihh_service_all" ON integration_health_history FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═══ 2. EVIDENCE PACKS ═══

CREATE TABLE IF NOT EXISTS evidence_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE,
    assembled_at TIMESTAMPTZ DEFAULT now(),
    ttl_seconds INT DEFAULT 300,
    evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
    integrity_score FLOAT DEFAULT 0,
    freshness_score FLOAT DEFAULT 0,
    missing_sources TEXT[] DEFAULT '{}',
    stale_sources TEXT[] DEFAULT '{}',
    source_count INT DEFAULT 0,
    assembly_ms INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ep_tenant ON evidence_packs(tenant_id);

ALTER TABLE evidence_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ep_tenant_read" ON evidence_packs FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "ep_service_all" ON evidence_packs FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═══ 3. COGNITION DECISIONS (APPEND-ONLY, LIFECYCLE) ═══

CREATE TABLE IF NOT EXISTS cognition_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    decision_category TEXT NOT NULL
        CHECK (decision_category IN ('revenue','operations','people','finance','market','delivery','cash')),
    decision_statement TEXT NOT NULL,
    affected_domains TEXT[] NOT NULL DEFAULT '{}',
    expected_instability_change JSONB DEFAULT '{}'::JSONB,
    expected_time_horizon INT DEFAULT 30 CHECK (expected_time_horizon IN (30, 60, 90)),
    confidence_at_time FLOAT DEFAULT 0.5 CHECK (confidence_at_time >= 0 AND confidence_at_time <= 1),
    evidence_refs TEXT[] DEFAULT '{}',
    instability_snapshot_at_time JSONB DEFAULT '{}'::JSONB,
    model_version TEXT DEFAULT 'v1.0.0',
    status TEXT DEFAULT 'active'
        CHECK (status IN ('draft','active','superseded','withdrawn')),
    superseded_by UUID REFERENCES cognition_decisions(id),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cd_tenant ON cognition_decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cd_status ON cognition_decisions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_cd_created ON cognition_decisions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cd_category ON cognition_decisions(tenant_id, decision_category);

ALTER TABLE cognition_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cd_tenant_read" ON cognition_decisions FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "cd_tenant_insert" ON cognition_decisions FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "cd_service_all" ON cognition_decisions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Append-only: only status + superseded_by can change
CREATE OR REPLACE FUNCTION fn_decisions_append_only()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.decision_statement IS DISTINCT FROM NEW.decision_statement
       OR OLD.decision_category IS DISTINCT FROM NEW.decision_category
       OR OLD.affected_domains IS DISTINCT FROM NEW.affected_domains
       OR OLD.expected_instability_change IS DISTINCT FROM NEW.expected_instability_change
       OR OLD.confidence_at_time IS DISTINCT FROM NEW.confidence_at_time
       OR OLD.evidence_refs IS DISTINCT FROM NEW.evidence_refs THEN
        RAISE EXCEPTION 'Cognition decisions are append-only. Only status and superseded_by can change.';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_decisions_append_only ON cognition_decisions;
CREATE TRIGGER trg_decisions_append_only BEFORE UPDATE ON cognition_decisions
    FOR EACH ROW EXECUTE FUNCTION fn_decisions_append_only();


-- ═══ 4. OUTCOME CHECKPOINTS ═══

CREATE TABLE IF NOT EXISTS outcome_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID NOT NULL REFERENCES cognition_decisions(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    checkpoint_day INT NOT NULL CHECK (checkpoint_day IN (30, 60, 90)),
    scheduled_at TIMESTAMPTZ NOT NULL,
    evaluated_at TIMESTAMPTZ,
    actual_instability JSONB,
    predicted_instability JSONB,
    variance_delta JSONB,
    normalized_variance FLOAT,
    decision_effective BOOLEAN,
    confidence_adjustment FLOAT DEFAULT 0,
    false_positive BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','evaluated','skipped','expired')),
    UNIQUE(decision_id, checkpoint_day)
);
CREATE INDEX IF NOT EXISTS idx_oc_tenant ON outcome_checkpoints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oc_pending ON outcome_checkpoints(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_oc_decision ON outcome_checkpoints(decision_id);

ALTER TABLE outcome_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oc_tenant_read" ON outcome_checkpoints FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "oc_service_all" ON outcome_checkpoints FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═══ 5. PROPAGATION RULES (VERSIONED) ═══

CREATE TABLE IF NOT EXISTS propagation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_domain TEXT NOT NULL,
    target_domain TEXT NOT NULL,
    mechanism TEXT NOT NULL,
    base_probability FLOAT NOT NULL CHECK (base_probability >= 0 AND base_probability <= 1),
    severity TEXT NOT NULL CHECK (severity IN ('high','medium','low')),
    time_horizon TEXT NOT NULL,
    trigger_threshold FLOAT NOT NULL DEFAULT 0.4 CHECK (trigger_threshold >= 0 AND trigger_threshold <= 1),
    amplification_factor FLOAT DEFAULT 1.0,
    dampening_factor FLOAT DEFAULT 0.0,
    rule_version TEXT DEFAULT 'v1.0.0',
    industry_override TEXT,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(source_domain, target_domain, mechanism)
);

-- Seed 14 deterministic propagation rules
INSERT INTO propagation_rules (source_domain, target_domain, mechanism, base_probability, severity, time_horizon, trigger_threshold, amplification_factor) VALUES
('finance', 'operations', 'Cash pressure reduces capacity to deliver projects on time and invest in tools', 0.75, 'high', '1-4 weeks', 0.4, 1.2),
('finance', 'people', 'Cash strain forces delayed hiring, salary freezes, or layoffs', 0.60, 'high', '1-3 months', 0.5, 1.1),
('operations', 'people', 'Delivery bottlenecks cause overtime, burnout, and increased error rates', 0.70, 'high', '1-4 weeks', 0.4, 1.3),
('operations', 'revenue', 'Delivery delays erode client trust and reduce repeat business', 0.55, 'medium', '1-3 months', 0.4, 1.0),
('market', 'revenue', 'Competitive positioning loss leads to fewer inbound leads and price pressure', 0.65, 'high', '1-3 months', 0.3, 1.1),
('market', 'people', 'Market uncertainty causes talent flight to more stable competitors', 0.35, 'medium', '3-6 months', 0.5, 1.0),
('revenue', 'cash', 'Revenue decline directly reduces cash reserves and extends payment cycles', 0.85, 'high', 'immediate', 0.3, 1.5),
('revenue', 'operations', 'Revenue loss forces scope cuts, reduced investment in delivery quality', 0.50, 'medium', '1-4 weeks', 0.4, 1.0),
('cash', 'delivery', 'Insufficient cash prevents purchasing materials, tools, or contractor support', 0.80, 'high', 'immediate', 0.4, 1.4),
('cash', 'people', 'Cash flow crisis forces immediate cost cuts starting with headcount', 0.70, 'high', '1-4 weeks', 0.5, 1.2),
('delivery', 'revenue', 'Failed or late delivery triggers refunds, contract penalties, and lost renewals', 0.65, 'high', '1-4 weeks', 0.4, 1.1),
('delivery', 'people', 'Chronic delivery failures cause team demoralisation and key-person exits', 0.45, 'medium', '1-3 months', 0.5, 1.0),
('people', 'operations', 'Key-person exits create knowledge gaps and capacity drops', 0.75, 'high', 'immediate', 0.3, 1.3),
('people', 'revenue', 'Talent loss reduces sales capability and client relationship quality', 0.50, 'medium', '1-3 months', 0.4, 1.0)
ON CONFLICT (source_domain, target_domain, mechanism) DO NOTHING;


-- ═══ 6. AUTOMATION REGISTRY ═══

CREATE TABLE IF NOT EXISTS automation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL UNIQUE,
    insight_category TEXT NOT NULL,
    integration_required TEXT,
    action_label TEXT NOT NULL,
    secondary_action_label TEXT,
    requires_confirmation BOOLEAN DEFAULT true,
    risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low','medium','high')),
    rollback_guidance TEXT,
    is_active BOOLEAN DEFAULT true
);

INSERT INTO automation_actions (action_type, insight_category, integration_required, action_label, secondary_action_label, risk_level, rollback_guidance) VALUES
('send_invoice_reminder', 'overdue_invoice', 'xero', 'Send Payment Reminder', 'Review Invoice Details', 'low', 'No rollback needed — reminder is informational'),
('trigger_re_engagement', 'stalled_deal', 'hubspot', 'Send Re-engagement Email', 'Review Deal History', 'low', 'Cancel follow-up sequence in HubSpot'),
('generate_diversification_playbook', 'concentration_risk', NULL, 'Generate Diversification Plan', 'Simulate Client Loss', 'low', NULL),
('generate_cash_preservation', 'cash_strain', NULL, 'Generate Cash Preservation Actions', 'Adjust Forecast', 'medium', NULL),
('propose_load_reallocation', 'fatigue_risk', NULL, 'Propose Workload Redistribution', 'Review Calendar Blocks', 'low', 'Revert calendar changes manually'),
('create_collection_sequence', 'overdue_invoice', 'xero', 'Start Collection Sequence', 'Review Payment Terms', 'medium', 'Cancel collection sequence in Xero'),
('flag_deal_for_review', 'stalled_deal', 'hubspot', 'Flag Deal for Manager Review', 'View Activity Timeline', 'low', 'Remove flag in HubSpot'),
('generate_retention_plan', 'churn_risk', NULL, 'Generate Retention Strategy', 'Review Client Health Score', 'low', NULL),
('escalate_sla_breach', 'sla_breach', NULL, 'Escalate to Operations Lead', 'Review Breach Details', 'medium', NULL),
('generate_competitive_response', 'market_threat', NULL, 'Generate Competitive Response Plan', 'Analyse Competitor Moves', 'low', NULL)
ON CONFLICT (action_type) DO NOTHING;


CREATE TABLE IF NOT EXISTS automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    action_id UUID REFERENCES automation_actions(id),
    action_type TEXT NOT NULL,
    insight_ref TEXT,
    evidence_refs TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending','confirmed','executing','executed','failed','rolled_back','cancelled')),
    confirmed_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,
    result JSONB,
    rollback_executed BOOLEAN DEFAULT false,
    governance_event_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ae_tenant ON automation_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ae_status ON automation_executions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ae_action ON automation_executions(action_type);

ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ae_tenant_read" ON automation_executions FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "ae_tenant_insert" ON automation_executions FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "ae_service_all" ON automation_executions FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═══ 7. INSTABILITY SNAPSHOTS ═══

CREATE TABLE IF NOT EXISTS instability_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    rvi FLOAT, eds FLOAT, cdr FLOAT, ads FLOAT,
    composite FLOAT,
    risk_band TEXT,
    config_name TEXT,
    industry_code TEXT,
    evidence_integrity FLOAT,
    propagation_count INT DEFAULT 0,
    active_decisions INT DEFAULT 0,
    model_version TEXT DEFAULT 'v1.0.0',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_is_tenant ON instability_snapshots(tenant_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_is_composite ON instability_snapshots(tenant_id, composite);
CREATE INDEX IF NOT EXISTS idx_is_date ON instability_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_is_tenant_date_composite ON instability_snapshots(tenant_id, snapshot_date, composite);

ALTER TABLE instability_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "is_tenant_read" ON instability_snapshots FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "is_service_all" ON instability_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═══ 8. CONFIDENCE RECALIBRATION LOG ═══

CREATE TABLE IF NOT EXISTS confidence_recalibrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    previous_confidence FLOAT,
    new_confidence FLOAT,
    adjustment_reason TEXT,
    decisions_evaluated INT,
    accuracy_rate FLOAT,
    false_positive_rate FLOAT,
    decay_applied BOOLEAN DEFAULT false,
    minimum_threshold_met BOOLEAN DEFAULT true,
    recalibrated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cr_tenant ON confidence_recalibrations(tenant_id, recalibrated_at DESC);

ALTER TABLE confidence_recalibrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cr_tenant_read" ON confidence_recalibrations FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "cr_service_all" ON confidence_recalibrations FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═══ 9. COGNITION TELEMETRY ═══

CREATE TABLE IF NOT EXISTS cognition_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    function_name TEXT NOT NULL,
    execution_ms INT NOT NULL,
    input_params JSONB DEFAULT '{}'::JSONB,
    output_status TEXT,
    error_message TEXT,
    row_count INT DEFAULT 0,
    executed_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ct_tenant ON cognition_telemetry(tenant_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ct_function ON cognition_telemetry(function_name, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ct_slow ON cognition_telemetry(execution_ms DESC) WHERE execution_ms > 500;

-- No RLS on telemetry — service_role only
ALTER TABLE cognition_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ct_service_all" ON cognition_telemetry FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═══ 10. DRIFT DETECTION LOG ═══

CREATE TABLE IF NOT EXISTS drift_detection_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    metric_name TEXT NOT NULL,
    expected_range_low FLOAT,
    expected_range_high FLOAT,
    actual_value FLOAT,
    drift_magnitude FLOAT,
    drift_direction TEXT CHECK (drift_direction IN ('up','down','stable')),
    is_anomalous BOOLEAN DEFAULT false,
    detected_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dd_tenant ON drift_detection_log(tenant_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_dd_anomalous ON drift_detection_log(is_anomalous) WHERE is_anomalous = true;

ALTER TABLE drift_detection_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dd_tenant_read" ON drift_detection_log FOR SELECT TO authenticated USING (tenant_id = auth.uid());
CREATE POLICY "dd_service_all" ON drift_detection_log FOR ALL TO service_role USING (true) WITH CHECK (true);



-- ═══ 11. COGNITION CONFIG (Dynamic, not hardcoded) ═══

CREATE TABLE IF NOT EXISTS cognition_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed dynamic config (replaces hardcoded values in functions)
INSERT INTO cognition_config (config_key, config_value, description) VALUES
('evidence_total_possible', '8', 'Total possible evidence sources for integrity scoring'),
('evidence_integrity_threshold', '0.25', 'Minimum integrity score to generate intelligence'),
('evidence_fresh_hours', '24', 'Hours before a source is considered no longer fresh'),
('evidence_stale_hours', '72', 'Hours before a source is considered stale'),
('integration_sla_minutes', '240', 'Minutes of data staleness before SLA breach'),
('confidence_min_checkpoints', '3', 'Minimum evaluated checkpoints before confidence recalibration'),
('confidence_decay_days', '30', 'Days without evaluation before confidence decays'),
('confidence_decay_rate', '0.05', 'Confidence decay per decay period'),
('confidence_bounds_low', '0.1', 'Minimum allowed confidence score'),
('confidence_bounds_high', '0.95', 'Maximum allowed confidence score'),
('drift_anomaly_threshold', '2.0', 'Standard deviations for anomaly detection'),
('propagation_min_chain_prob', '0.1', 'Minimum compound probability to report a chain')
ON CONFLICT (config_key) DO NOTHING;

-- No RLS — config is global
ALTER TABLE cognition_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc_read" ON cognition_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "cc_service_all" ON cognition_config FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═══ 12. EVIDENCE SOURCE REGISTRY ═══

CREATE TABLE IF NOT EXISTS evidence_source_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key TEXT NOT NULL UNIQUE,
    source_label TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('integration','internal','user_input','computed')),
    freshness_weight FLOAT DEFAULT 1.0,
    is_required BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true
);

INSERT INTO evidence_source_registry (source_key, source_label, source_type, freshness_weight, is_required) VALUES
('business_profile', 'Business Profile', 'user_input', 0.6, true),
('cognitive_snapshot', 'Cognitive Snapshot', 'computed', 1.0, true),
('crm', 'CRM (HubSpot/Salesforce)', 'integration', 0.9, false),
('accounting', 'Accounting (Xero/QuickBooks)', 'integration', 0.9, false),
('email', 'Email (Gmail/Outlook)', 'integration', 0.7, false),
('marketing', 'Marketing Benchmarks', 'computed', 0.6, false),
('decisions', 'Decision Registry', 'internal', 0.8, false),
('daily_metrics', 'Daily Metric Snapshots', 'computed', 1.0, false)
ON CONFLICT (source_key) DO NOTHING;

ALTER TABLE evidence_source_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esr_read" ON evidence_source_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "esr_service_all" ON evidence_source_registry FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ═══ 13. DATA RETENTION POLICY ═══

CREATE TABLE IF NOT EXISTS data_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL UNIQUE,
    retention_days INT NOT NULL,
    cleanup_column TEXT NOT NULL DEFAULT 'created_at',
    is_active BOOLEAN DEFAULT true
);

INSERT INTO data_retention_policies (table_name, retention_days, cleanup_column) VALUES
('cognition_telemetry', 90, 'executed_at'),
('drift_detection_log', 180, 'detected_at'),
('integration_health_history', 365, 'changed_at'),
('automation_executions', 365, 'created_at'),
('confidence_recalibrations', 365, 'recalibrated_at'),
('instability_snapshots', 730, 'created_at')
ON CONFLICT (table_name) DO NOTHING;

-- pg_cron: Weekly data cleanup (run once in SQL Editor)
-- SELECT cron.schedule('cognition-retention-cleanup', '0 3 * * 0', $$
-- DELETE FROM cognition_telemetry WHERE executed_at < now() - INTERVAL '90 days';
-- DELETE FROM drift_detection_log WHERE detected_at < now() - INTERVAL '180 days';
-- DELETE FROM integration_health_history WHERE changed_at < now() - INTERVAL '365 days';
-- $$);
