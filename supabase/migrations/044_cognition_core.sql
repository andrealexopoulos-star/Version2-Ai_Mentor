-- ═══════════════════════════════════════════════════════════════
-- BIQc COGNITION CORE — Migration 044
-- Evidence Engine + Propagation + Decision Consequence + Automation
--
-- ZERO FRONTEND LOGIC. ALL COMPUTATION IN SQL.
-- EVIDENCE-GATED. DETERMINISTIC. APPEND-ONLY DECISIONS.
-- ═══════════════════════════════════════════════════════════════


-- ═══ 1. INTEGRATION HEALTH MONITOR ═══

CREATE TABLE IF NOT EXISTS integration_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    provider TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    last_successful_sync TIMESTAMPTZ,
    data_freshness_minutes INT,
    last_error_message TEXT,
    required_user_action TEXT,
    checked_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_ih_tenant ON integration_health(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ih_status ON integration_health(tenant_id, status);

ALTER TABLE integration_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ih_tenant_read" ON integration_health FOR SELECT TO authenticated
    USING (tenant_id = auth.uid());
CREATE POLICY "ih_service_all" ON integration_health FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- ═══ 2. EVIDENCE PACKS ═══

CREATE TABLE IF NOT EXISTS evidence_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE,
    assembled_at TIMESTAMPTZ DEFAULT now(),
    ttl_seconds INT DEFAULT 300,
    evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
    integrity_score FLOAT DEFAULT 0,
    missing_sources TEXT[] DEFAULT '{}',
    source_count INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ep_tenant ON evidence_packs(tenant_id);

ALTER TABLE evidence_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ep_tenant_read" ON evidence_packs FOR SELECT TO authenticated
    USING (tenant_id = auth.uid());
CREATE POLICY "ep_service_all" ON evidence_packs FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- ═══ 3. COGNITION DECISIONS (APPEND-ONLY) ═══

CREATE TABLE IF NOT EXISTS cognition_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    decision_category TEXT NOT NULL,
    decision_statement TEXT NOT NULL,
    affected_domains TEXT[] NOT NULL DEFAULT '{}',
    expected_instability_change JSONB DEFAULT '{}'::JSONB,
    expected_time_horizon INT DEFAULT 30,
    confidence_at_time FLOAT DEFAULT 0.5,
    evidence_refs TEXT[] DEFAULT '{}',
    instability_snapshot_at_time JSONB DEFAULT '{}'::JSONB,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cd_tenant ON cognition_decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cd_status ON cognition_decisions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_cd_created ON cognition_decisions(tenant_id, created_at DESC);

ALTER TABLE cognition_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cd_tenant_read" ON cognition_decisions FOR SELECT TO authenticated
    USING (tenant_id = auth.uid());
CREATE POLICY "cd_tenant_insert" ON cognition_decisions FOR INSERT TO authenticated
    WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "cd_service_all" ON cognition_decisions FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Append-only: prevent UPDATE except status field
CREATE OR REPLACE FUNCTION fn_decisions_append_only()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.decision_statement != NEW.decision_statement
       OR OLD.decision_category != NEW.decision_category
       OR OLD.affected_domains != NEW.affected_domains
       OR OLD.expected_instability_change != NEW.expected_instability_change
       OR OLD.confidence_at_time != NEW.confidence_at_time THEN
        RAISE EXCEPTION 'Cognition decisions are append-only. Only status can be changed.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decisions_append_only ON cognition_decisions;
CREATE TRIGGER trg_decisions_append_only
    BEFORE UPDATE ON cognition_decisions
    FOR EACH ROW
    EXECUTE FUNCTION fn_decisions_append_only();


-- ═══ 4. OUTCOME CHECKPOINTS ═══

CREATE TABLE IF NOT EXISTS outcome_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_id UUID NOT NULL REFERENCES cognition_decisions(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    checkpoint_day INT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    evaluated_at TIMESTAMPTZ,
    actual_instability JSONB,
    predicted_instability JSONB,
    variance_delta JSONB,
    decision_effective BOOLEAN,
    confidence_adjustment FLOAT DEFAULT 0,
    status TEXT DEFAULT 'pending',
    UNIQUE(decision_id, checkpoint_day)
);

CREATE INDEX IF NOT EXISTS idx_oc_tenant ON outcome_checkpoints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oc_pending ON outcome_checkpoints(status, scheduled_at)
    WHERE status = 'pending';

ALTER TABLE outcome_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oc_tenant_read" ON outcome_checkpoints FOR SELECT TO authenticated
    USING (tenant_id = auth.uid());
CREATE POLICY "oc_service_all" ON outcome_checkpoints FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- ═══ 5. PROPAGATION RULES (GLOBAL CONFIG) ═══

CREATE TABLE IF NOT EXISTS propagation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_domain TEXT NOT NULL,
    target_domain TEXT NOT NULL,
    mechanism TEXT NOT NULL,
    base_probability FLOAT NOT NULL,
    severity TEXT NOT NULL,
    time_horizon TEXT NOT NULL,
    trigger_threshold FLOAT NOT NULL DEFAULT 0.4,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(source_domain, target_domain, mechanism)
);

-- Seed deterministic propagation rules
INSERT INTO propagation_rules (source_domain, target_domain, mechanism, base_probability, severity, time_horizon, trigger_threshold) VALUES
('finance', 'operations', 'Cash pressure reduces capacity to deliver projects on time and invest in tools', 0.75, 'high', '1-4 weeks', 0.4),
('finance', 'people', 'Cash strain forces delayed hiring, salary freezes, or layoffs', 0.60, 'high', '1-3 months', 0.5),
('operations', 'people', 'Delivery bottlenecks cause overtime, burnout, and increased error rates', 0.70, 'high', '1-4 weeks', 0.4),
('operations', 'revenue', 'Delivery delays erode client trust and reduce repeat business', 0.55, 'medium', '1-3 months', 0.4),
('market', 'revenue', 'Competitive positioning loss leads to fewer inbound leads and price pressure', 0.65, 'high', '1-3 months', 0.3),
('market', 'people', 'Market uncertainty causes talent flight to more stable competitors', 0.35, 'medium', '3-6 months', 0.5),
('revenue', 'cash', 'Revenue decline directly reduces cash reserves and extends payment cycles', 0.85, 'high', 'immediate', 0.3),
('revenue', 'operations', 'Revenue loss forces scope cuts, reduced investment in delivery quality', 0.50, 'medium', '1-4 weeks', 0.4),
('cash', 'delivery', 'Insufficient cash prevents purchasing materials, tools, or contractor support', 0.80, 'high', 'immediate', 0.4),
('cash', 'people', 'Cash flow crisis forces immediate cost cuts starting with headcount', 0.70, 'high', '1-4 weeks', 0.5),
('delivery', 'revenue', 'Failed or late delivery triggers refunds, contract penalties, and lost renewals', 0.65, 'high', '1-4 weeks', 0.4),
('delivery', 'people', 'Chronic delivery failures cause team demoralisation and key-person exits', 0.45, 'medium', '1-3 months', 0.5),
('people', 'operations', 'Key-person exits create knowledge gaps and capacity drops', 0.75, 'high', 'immediate', 0.3),
('people', 'revenue', 'Talent loss reduces sales capability and client relationship quality', 0.50, 'medium', '1-3 months', 0.4)
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
    risk_level TEXT DEFAULT 'low',
    is_active BOOLEAN DEFAULT true
);

-- Seed automation actions
INSERT INTO automation_actions (action_type, insight_category, integration_required, action_label, secondary_action_label, risk_level) VALUES
('send_invoice_reminder', 'overdue_invoice', 'xero', 'Send Payment Reminder', 'Review Invoice Details', 'low'),
('trigger_re_engagement', 'stalled_deal', 'hubspot', 'Send Re-engagement Email', 'Review Deal History', 'low'),
('generate_diversification_playbook', 'concentration_risk', NULL, 'Generate Diversification Plan', 'Simulate Client Loss', 'low'),
('generate_cash_preservation', 'cash_strain', NULL, 'Generate Cash Preservation Actions', 'Adjust Forecast', 'medium'),
('propose_load_reallocation', 'fatigue_risk', NULL, 'Propose Workload Redistribution', 'Review Calendar Blocks', 'low'),
('create_collection_sequence', 'overdue_invoice', 'xero', 'Start Collection Sequence', 'Review Payment Terms', 'medium'),
('flag_deal_for_review', 'stalled_deal', 'hubspot', 'Flag Deal for Manager Review', 'View Activity Timeline', 'low'),
('generate_retention_plan', 'churn_risk', NULL, 'Generate Retention Strategy', 'Review Client Health Score', 'low'),
('escalate_sla_breach', 'sla_breach', NULL, 'Escalate to Operations Lead', 'Review Breach Details', 'medium'),
('generate_competitive_response', 'market_threat', NULL, 'Generate Competitive Response Plan', 'Analyse Competitor Moves', 'low')
ON CONFLICT (action_type) DO NOTHING;


CREATE TABLE IF NOT EXISTS automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    action_id UUID REFERENCES automation_actions(id),
    action_type TEXT NOT NULL,
    insight_ref TEXT,
    evidence_refs TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'pending',
    confirmed_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    result JSONB,
    governance_event_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ae_tenant ON automation_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ae_status ON automation_executions(tenant_id, status);

ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ae_tenant_read" ON automation_executions FOR SELECT TO authenticated
    USING (tenant_id = auth.uid());
CREATE POLICY "ae_tenant_insert" ON automation_executions FOR INSERT TO authenticated
    WITH CHECK (tenant_id = auth.uid());
CREATE POLICY "ae_service_all" ON automation_executions FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- ═══ 7. INSTABILITY HISTORY ═══

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
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_is_tenant ON instability_snapshots(tenant_id, snapshot_date DESC);

ALTER TABLE instability_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "is_tenant_read" ON instability_snapshots FOR SELECT TO authenticated
    USING (tenant_id = auth.uid());
CREATE POLICY "is_service_all" ON instability_snapshots FOR ALL TO service_role
    USING (true) WITH CHECK (true);


-- ═══ 8. CONFIDENCE RECALIBRATION LOG ═══

CREATE TABLE IF NOT EXISTS confidence_recalibrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    previous_confidence FLOAT,
    new_confidence FLOAT,
    adjustment_reason TEXT,
    decisions_evaluated INT,
    accuracy_rate FLOAT,
    recalibrated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cr_tenant ON confidence_recalibrations(tenant_id, recalibrated_at DESC);

ALTER TABLE confidence_recalibrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cr_tenant_read" ON confidence_recalibrations FOR SELECT TO authenticated
    USING (tenant_id = auth.uid());
CREATE POLICY "cr_service_all" ON confidence_recalibrations FOR ALL TO service_role
    USING (true) WITH CHECK (true);
