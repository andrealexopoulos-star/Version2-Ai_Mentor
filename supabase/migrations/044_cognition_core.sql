-- ============================================================
-- Migration 044: Cognition Core Tables + Seed Data
-- BIQc Platform — Instability Engine Tables
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. INTEGRATION HEALTH ──────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_health (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'DISCONNECTED',
  last_synced_at  TIMESTAMPTZ,
  error_message   TEXT,
  data_freshness  INTERVAL,
  records_count   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, provider)
);

CREATE TABLE IF NOT EXISTS integration_health_history (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  old_status    TEXT,
  new_status    TEXT NOT NULL,
  changed_at    TIMESTAMPTZ DEFAULT now(),
  reason        TEXT
);

-- ── 2. EVIDENCE PACKS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS evidence_packs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tab             TEXT NOT NULL,
  evidence_items  JSONB DEFAULT '[]',
  assembled_at    TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),
  evidence_count  INTEGER DEFAULT 0,
  quality_score   FLOAT DEFAULT 0.5
);

CREATE INDEX IF NOT EXISTS idx_evidence_packs_tenant_tab ON evidence_packs(tenant_id, tab);

-- ── 3. COGNITION DECISIONS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS cognition_decisions (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_category           TEXT NOT NULL,
  decision_statement          TEXT NOT NULL,
  affected_domains            TEXT[] DEFAULT '{}',
  expected_instability_change JSONB DEFAULT '{}',
  expected_time_horizon       INTEGER DEFAULT 30,
  confidence_at_time          FLOAT DEFAULT 0.5,
  evidence_refs               TEXT[] DEFAULT '{}',
  instability_snapshot_at_time JSONB DEFAULT '{}',
  status                      TEXT DEFAULT 'pending',
  model_version               TEXT DEFAULT 'v1',
  created_at                  TIMESTAMPTZ DEFAULT now(),
  updated_at                  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cognition_decisions_tenant ON cognition_decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cognition_decisions_created ON cognition_decisions(created_at DESC);

-- ── 4. OUTCOME CHECKPOINTS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS outcome_checkpoints (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  decision_id           UUID NOT NULL REFERENCES cognition_decisions(id) ON DELETE CASCADE,
  tenant_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkpoint_day        INTEGER NOT NULL,
  scheduled_at          TIMESTAMPTZ NOT NULL,
  evaluated_at          TIMESTAMPTZ,
  status                TEXT DEFAULT 'pending',
  decision_effective    BOOLEAN,
  variance_delta        FLOAT,
  normalized_variance   FLOAT,
  false_positive        BOOLEAN,
  predicted_instability JSONB DEFAULT '{}',
  actual_instability    JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_outcome_checkpoints_decision ON outcome_checkpoints(decision_id);
CREATE INDEX IF NOT EXISTS idx_outcome_checkpoints_tenant ON outcome_checkpoints(tenant_id);

-- ── 5. PROPAGATION RULES (14 deterministic rules) ──────────
CREATE TABLE IF NOT EXISTS propagation_rules (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_domain   TEXT NOT NULL,
  target_domain   TEXT NOT NULL,
  probability     FLOAT NOT NULL DEFAULT 0.7,
  lag_days        INTEGER DEFAULT 14,
  description     TEXT,
  is_active       BOOLEAN DEFAULT true,
  UNIQUE(source_domain, target_domain)
);

INSERT INTO propagation_rules (source_domain, target_domain, probability, lag_days, description) VALUES
  ('finance', 'operations', 0.82, 14, 'Cash constraint reduces operational capacity'),
  ('finance', 'people', 0.75, 21, 'Financial stress leads to talent attrition'),
  ('operations', 'people', 0.68, 7, 'Bottlenecks increase team burnout risk'),
  ('operations', 'revenue', 0.79, 14, 'Delivery failures erode client retention'),
  ('market', 'revenue', 0.71, 30, 'Competitive shift reduces win rate'),
  ('market', 'people', 0.55, 45, 'Market pressure increases workload'),
  ('revenue', 'cash', 0.88, 7, 'Pipeline shrink triggers cash shortfall'),
  ('revenue', 'operations', 0.65, 14, 'Revenue loss forces operational cuts'),
  ('cash', 'delivery', 0.77, 14, 'Cash constraint delays project delivery'),
  ('cash', 'people', 0.72, 21, 'Cash pressure leads to headcount freeze'),
  ('delivery', 'revenue', 0.80, 14, 'Late delivery triggers churn and lost upsell'),
  ('delivery', 'people', 0.60, 7, 'Delivery pressure increases team fatigue'),
  ('people', 'operations', 0.73, 14, 'Key person loss creates operational gap'),
  ('people', 'revenue', 0.69, 21, 'Team fatigue reduces sales output')
ON CONFLICT (source_domain, target_domain) DO NOTHING;

-- ── 6. AUTOMATION ACTIONS (10 actions) ─────────────────────
CREATE TABLE IF NOT EXISTS automation_actions (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type          TEXT NOT NULL UNIQUE,
  action_label         TEXT NOT NULL,
  description          TEXT,
  integration_required TEXT,
  is_active            BOOLEAN DEFAULT true,
  rollback_guidance    TEXT,
  created_at           TIMESTAMPTZ DEFAULT now()
);

INSERT INTO automation_actions (action_type, action_label, description, integration_required) VALUES
  ('send_invoice_reminder', 'Send Invoice Reminder', 'Automated follow-up for overdue invoices', 'accounting'),
  ('trigger_re_engagement', 'Trigger Re-engagement', 'Automated outreach for at-risk deals', 'crm'),
  ('generate_diversification_playbook', 'Generate Diversification Playbook', 'AI-generated playbook to reduce revenue concentration', NULL),
  ('generate_cash_preservation', 'Generate Cash Preservation Plan', 'AI plan to extend runway during compression', NULL),
  ('propose_load_reallocation', 'Propose Load Reallocation', 'Redistribute workload to reduce burnout risk', NULL),
  ('create_collection_sequence', 'Create Collection Sequence', 'Multi-step collection workflow for overdue payments', 'accounting'),
  ('flag_deal_for_review', 'Flag Deal for Review', 'Mark stalled or at-risk deals for immediate attention', 'crm'),
  ('generate_retention_plan', 'Generate Retention Plan', 'AI-generated client retention strategy', NULL),
  ('escalate_sla_breach', 'Escalate SLA Breach', 'Alert owner and schedule recovery call for SLA violations', 'crm'),
  ('generate_competitive_response', 'Generate Competitive Response', 'AI brief on competitive positioning adjustment', NULL)
ON CONFLICT (action_type) DO NOTHING;

-- ── 7. AUTOMATION EXECUTIONS ───────────────────────────────
CREATE TABLE IF NOT EXISTS automation_executions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id         UUID REFERENCES automation_actions(id),
  action_type       TEXT NOT NULL,
  insight_ref       TEXT DEFAULT '',
  evidence_refs     TEXT[] DEFAULT '{}',
  status            TEXT DEFAULT 'pending',
  confirmed_at      TIMESTAMPTZ,
  executed_at       TIMESTAMPTZ,
  failed_at         TIMESTAMPTZ,
  failure_reason    TEXT,
  result            JSONB DEFAULT '{}',
  rollback_executed BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_executions_tenant ON automation_executions(tenant_id);

-- ── 8. INSTABILITY SNAPSHOTS ───────────────────────────────
CREATE TABLE IF NOT EXISTS instability_snapshots (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date               DATE NOT NULL DEFAULT CURRENT_DATE,
  revenue_volatility_index    FLOAT DEFAULT 0,
  engagement_decay_score      FLOAT DEFAULT 0,
  cash_deviation_ratio        FLOAT DEFAULT 0,
  anomaly_density_score       FLOAT DEFAULT 0,
  composite_risk_score        FLOAT DEFAULT 0,
  system_state                TEXT DEFAULT 'STABLE',
  confidence_score            FLOAT DEFAULT 0.5,
  evidence_count              INTEGER DEFAULT 0,
  created_at                  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_instability_snapshots_tenant ON instability_snapshots(tenant_id, snapshot_date DESC);

-- ── 9. CONFIDENCE RECALIBRATIONS ───────────────────────────
CREATE TABLE IF NOT EXISTS confidence_recalibrations (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_id         UUID REFERENCES cognition_decisions(id),
  old_confidence      FLOAT,
  new_confidence      FLOAT,
  reason              TEXT,
  checkpoint_day      INTEGER,
  recalibrated_at     TIMESTAMPTZ DEFAULT now()
);

-- ── ROW LEVEL SECURITY ─────────────────────────────────────
ALTER TABLE integration_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_health_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cognition_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE instability_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE confidence_recalibrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own integration_health" ON integration_health FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own integration_health_history" ON integration_health_history FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own evidence_packs" ON evidence_packs FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own cognition_decisions" ON cognition_decisions FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own outcome_checkpoints" ON outcome_checkpoints FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own automation_executions" ON automation_executions FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own instability_snapshots" ON instability_snapshots FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own confidence_recalibrations" ON confidence_recalibrations FOR ALL USING (auth.uid() = tenant_id);
