-- ============================================================
-- Migration 044 FIX: Cognition Core Tables + Seed Data
-- Fixed for: "column tab does not exist" (idempotent version)
-- Handles tables that may already exist without all columns
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. INTEGRATION HEALTH ──────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_health (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'DISCONNECTED',
  last_synced_at  TIMESTAMPTZ,
  error_message   TEXT,
  data_freshness  INTERVAL,
  records_count   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE integration_health ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT '';
ALTER TABLE integration_health ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'DISCONNECTED';
ALTER TABLE integration_health ADD COLUMN IF NOT EXISTS records_count INTEGER DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'integration_health_tenant_id_provider_key') THEN
    ALTER TABLE integration_health ADD CONSTRAINT integration_health_tenant_id_provider_key UNIQUE(tenant_id, provider);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS integration_health_history (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL DEFAULT '',
  old_status    TEXT,
  new_status    TEXT NOT NULL DEFAULT 'DISCONNECTED',
  changed_at    TIMESTAMPTZ DEFAULT now(),
  reason        TEXT
);

-- ── 2. EVIDENCE PACKS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS evidence_packs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  intelligence_tab TEXT NOT NULL DEFAULT 'overview',
  evidence_items  JSONB DEFAULT '[]',
  assembled_at    TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),
  evidence_count  INTEGER DEFAULT 0,
  quality_score   FLOAT DEFAULT 0.5
);
-- Defensive: add columns if they were missing from a previous partial run
ALTER TABLE evidence_packs ADD COLUMN IF NOT EXISTS intelligence_tab TEXT NOT NULL DEFAULT 'overview';
ALTER TABLE evidence_packs ADD COLUMN IF NOT EXISTS evidence_items JSONB DEFAULT '[]';
ALTER TABLE evidence_packs ADD COLUMN IF NOT EXISTS evidence_count INTEGER DEFAULT 0;
ALTER TABLE evidence_packs ADD COLUMN IF NOT EXISTS quality_score FLOAT DEFAULT 0.5;

CREATE INDEX IF NOT EXISTS idx_evidence_packs_tenant ON evidence_packs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_evidence_packs_tenant_tab ON evidence_packs(tenant_id, intelligence_tab);

-- ── 3. COGNITION DECISIONS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS cognition_decisions (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_category           TEXT NOT NULL DEFAULT '',
  decision_statement          TEXT NOT NULL DEFAULT '',
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
ALTER TABLE cognition_decisions ADD COLUMN IF NOT EXISTS decision_category TEXT NOT NULL DEFAULT '';
ALTER TABLE cognition_decisions ADD COLUMN IF NOT EXISTS decision_statement TEXT NOT NULL DEFAULT '';
ALTER TABLE cognition_decisions ADD COLUMN IF NOT EXISTS affected_domains TEXT[] DEFAULT '{}';
ALTER TABLE cognition_decisions ADD COLUMN IF NOT EXISTS model_version TEXT DEFAULT 'v1';

CREATE INDEX IF NOT EXISTS idx_cognition_decisions_tenant ON cognition_decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cognition_decisions_created ON cognition_decisions(created_at DESC);

-- ── 4. OUTCOME CHECKPOINTS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS outcome_checkpoints (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  decision_id           UUID NOT NULL REFERENCES cognition_decisions(id) ON DELETE CASCADE,
  tenant_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkpoint_day        INTEGER NOT NULL DEFAULT 30,
  scheduled_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  evaluated_at          TIMESTAMPTZ,
  status                TEXT DEFAULT 'pending',
  decision_effective    BOOLEAN,
  variance_delta        FLOAT,
  normalized_variance   FLOAT,
  false_positive        BOOLEAN,
  predicted_instability JSONB DEFAULT '{}',
  actual_instability    JSONB DEFAULT '{}'
);
ALTER TABLE outcome_checkpoints ADD COLUMN IF NOT EXISTS checkpoint_day INTEGER NOT NULL DEFAULT 30;
ALTER TABLE outcome_checkpoints ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_outcome_checkpoints_decision ON outcome_checkpoints(decision_id);
CREATE INDEX IF NOT EXISTS idx_outcome_checkpoints_tenant ON outcome_checkpoints(tenant_id);

-- ── 5. PROPAGATION RULES (14 deterministic rules) ──────────
CREATE TABLE IF NOT EXISTS propagation_rules (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_domain   TEXT NOT NULL DEFAULT '',
  target_domain   TEXT NOT NULL DEFAULT '',
  probability     FLOAT NOT NULL DEFAULT 0.7,
  lag_days        INTEGER DEFAULT 14,
  description     TEXT,
  is_active       BOOLEAN DEFAULT true
);
ALTER TABLE propagation_rules ADD COLUMN IF NOT EXISTS source_domain TEXT NOT NULL DEFAULT '';
ALTER TABLE propagation_rules ADD COLUMN IF NOT EXISTS target_domain TEXT NOT NULL DEFAULT '';
ALTER TABLE propagation_rules ADD COLUMN IF NOT EXISTS probability FLOAT NOT NULL DEFAULT 0.7;
ALTER TABLE propagation_rules ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'propagation_rules_source_domain_target_domain_key') THEN
    ALTER TABLE propagation_rules ADD CONSTRAINT propagation_rules_source_domain_target_domain_key UNIQUE(source_domain, target_domain);
  END IF;
END $$;

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
  action_type          TEXT NOT NULL DEFAULT '' UNIQUE,
  action_label         TEXT NOT NULL DEFAULT '',
  description          TEXT,
  integration_required TEXT,
  is_active            BOOLEAN DEFAULT true,
  rollback_guidance    TEXT,
  created_at           TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE automation_actions ADD COLUMN IF NOT EXISTS action_type TEXT NOT NULL DEFAULT '';
ALTER TABLE automation_actions ADD COLUMN IF NOT EXISTS action_label TEXT NOT NULL DEFAULT '';
ALTER TABLE automation_actions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automation_actions_action_type_key') THEN
    ALTER TABLE automation_actions ADD CONSTRAINT automation_actions_action_type_key UNIQUE(action_type);
  END IF;
END $$;

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
  action_type       TEXT NOT NULL DEFAULT '',
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
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS action_type TEXT NOT NULL DEFAULT '';
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

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
  created_at                  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE instability_snapshots ADD COLUMN IF NOT EXISTS revenue_volatility_index FLOAT DEFAULT 0;
ALTER TABLE instability_snapshots ADD COLUMN IF NOT EXISTS engagement_decay_score FLOAT DEFAULT 0;
ALTER TABLE instability_snapshots ADD COLUMN IF NOT EXISTS cash_deviation_ratio FLOAT DEFAULT 0;
ALTER TABLE instability_snapshots ADD COLUMN IF NOT EXISTS composite_risk_score FLOAT DEFAULT 0;
ALTER TABLE instability_snapshots ADD COLUMN IF NOT EXISTS system_state TEXT DEFAULT 'STABLE';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instability_snapshots_tenant_id_snapshot_date_key') THEN
    ALTER TABLE instability_snapshots ADD CONSTRAINT instability_snapshots_tenant_id_snapshot_date_key UNIQUE(tenant_id, snapshot_date);
  END IF;
END $$;

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

-- ── 10. ENTERPRISE CONTACT REQUESTS ───────────────────────
CREATE TABLE IF NOT EXISTS enterprise_contact_requests (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name            TEXT NOT NULL DEFAULT '',
  business_name   TEXT DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  phone           TEXT DEFAULT '',
  callback_date   TEXT DEFAULT '',
  callback_time   TEXT DEFAULT '',
  description     TEXT DEFAULT '',
  feature_requested TEXT DEFAULT '',
  current_tier    TEXT DEFAULT 'free',
  status          TEXT DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE enterprise_contact_requests ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE enterprise_contact_requests ADD COLUMN IF NOT EXISTS feature_requested TEXT DEFAULT '';
ALTER TABLE enterprise_contact_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- ── ROW LEVEL SECURITY ─────────────────────────────────────
ALTER TABLE integration_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_health_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cognition_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE instability_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE confidence_recalibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_contact_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid "already exists" errors, then recreate
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users see own integration_health" ON integration_health;
  DROP POLICY IF EXISTS "Users see own integration_health_history" ON integration_health_history;
  DROP POLICY IF EXISTS "Users see own evidence_packs" ON evidence_packs;
  DROP POLICY IF EXISTS "Users see own cognition_decisions" ON cognition_decisions;
  DROP POLICY IF EXISTS "Users see own outcome_checkpoints" ON outcome_checkpoints;
  DROP POLICY IF EXISTS "Users see own automation_executions" ON automation_executions;
  DROP POLICY IF EXISTS "Users see own instability_snapshots" ON instability_snapshots;
  DROP POLICY IF EXISTS "Users see own confidence_recalibrations" ON confidence_recalibrations;
  DROP POLICY IF EXISTS "Users see own enterprise_contact_requests" ON enterprise_contact_requests;
END $$;

CREATE POLICY "Users see own integration_health" ON integration_health FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own integration_health_history" ON integration_health_history FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own evidence_packs" ON evidence_packs FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own cognition_decisions" ON cognition_decisions FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own outcome_checkpoints" ON outcome_checkpoints FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own automation_executions" ON automation_executions FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own instability_snapshots" ON instability_snapshots FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Users see own confidence_recalibrations" ON confidence_recalibrations FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY "Anyone can submit enterprise_contact_requests" ON enterprise_contact_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins see all enterprise_contact_requests" ON enterprise_contact_requests FOR SELECT USING (auth.uid() IS NOT NULL);
