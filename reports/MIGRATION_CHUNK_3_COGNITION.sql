-- CHUNK 3: Cognition Core
-- 042_security_lint_v2.sql
-- ═══════════════════════════════════════════════════════════════
-- BIQc SECURITY LINT FIXES v2 — Remaining 7 issues
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1-5: Functions with mutable search_path (safe — wraps in exception handler)
DO $$ BEGIN ALTER FUNCTION public.compute_market_risk_weight() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.calibrate_pressure() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.decay_evidence() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.compute_forensic_score() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- ic_calculate_risk_baseline has two signatures — fix both
DO $$ BEGIN ALTER FUNCTION public.ic_calculate_risk_baseline(UUID) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.ic_calculate_risk_baseline(UUID, UUID) SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- 6: intelligence_core schema function
DO $$ BEGIN ALTER FUNCTION intelligence_core.is_spine_enabled() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- 7: Move vector extension to dedicated schema
-- NOTE: This is a WARN not an ERROR. Moving pgvector to another schema
-- requires updating all references. Safe to leave in public for now.
-- To fix properly (optional):
-- CREATE SCHEMA IF NOT EXISTS extensions;
-- ALTER EXTENSION vector SET SCHEMA extensions;
-- Then update rag_search() to reference extensions.vector

-- 043_file_storage.sql
-- ═══════════════════════════════════════════════════════════════
-- BIQc FILE STORAGE + DOWNLOADS
-- Migration: 043_file_storage.sql
--
-- Creates Supabase Storage buckets for user-generated files.
-- Tracks downloads in a files registry table.
-- ═══════════════════════════════════════════════════════════════

-- 1. Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('user-files', 'user-files', false, 52428800, ARRAY['image/png','image/jpeg','image/svg+xml','image/webp','application/pdf','text/plain','text/csv','text/html','application/json','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    ('reports', 'reports', false, 52428800, ARRAY['application/pdf','text/html','text/plain','application/json'])
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS policies
CREATE POLICY IF NOT EXISTS "Users read own files" ON storage.objects FOR SELECT USING (
    bucket_id IN ('user-files', 'reports') AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY IF NOT EXISTS "Users upload own files" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id IN ('user-files', 'reports') AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY IF NOT EXISTS "Service manages all files" ON storage.objects FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. File registry table (tracks all generated files)
CREATE TABLE IF NOT EXISTS generated_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    bucket TEXT NOT NULL DEFAULT 'user-files',
    size_bytes INT,
    generated_by TEXT,
    source_conversation_id TEXT,
    metadata JSONB DEFAULT '{}',
    download_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_files_tenant ON generated_files(tenant_id, created_at DESC);

ALTER TABLE generated_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "tenant_read_files" ON generated_files FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "service_manage_files" ON generated_files FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 044_cognition_core.sql
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

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_evidence_packs_tenant ON evidence_packs(tenant_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_evidence_packs_tenant_tab ON evidence_packs(tenant_id, intelligence_tab);

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

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_cognition_decisions_tenant ON cognition_decisions(tenant_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_cognition_decisions_created ON cognition_decisions(created_at DESC);

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

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_outcome_checkpoints_decision ON outcome_checkpoints(decision_id);
CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_outcome_checkpoints_tenant ON outcome_checkpoints(tenant_id);

-- ── 5. PROPAGATION RULES — table already exists in production schema ──────────
-- Skip CREATE TABLE. Just ensure seed data is present using correct column names.
-- Real schema: source_domain, target_domain, mechanism, base_probability, severity, time_horizon

-- Clear existing rows and re-seed with correct values
DELETE FROM propagation_rules;

INSERT INTO propagation_rules (source_domain, target_domain, mechanism, base_probability, severity, time_horizon, trigger_threshold, amplification_factor, dampening_factor) VALUES
  ('finance',    'operations', 'direct',   0.82, 'high',   '14 days', 0.4, 1.2, 0.0),
  ('finance',    'people',     'direct',   0.75, 'high',   '21 days', 0.4, 1.1, 0.0),
  ('operations', 'people',     'direct',   0.68, 'medium', '7 days',  0.4, 1.0, 0.1),
  ('operations', 'revenue',    'direct',   0.79, 'high',   '14 days', 0.4, 1.2, 0.0),
  ('market',     'revenue',    'indirect', 0.71, 'medium', '30 days', 0.3, 1.0, 0.1),
  ('market',     'people',     'indirect', 0.55, 'low',    '45 days', 0.3, 0.9, 0.2),
  ('revenue',    'cash',       'direct',   0.88, 'high',   '7 days',  0.5, 1.3, 0.0),
  ('revenue',    'operations', 'direct',   0.65, 'medium', '14 days', 0.4, 1.0, 0.1),
  ('cash',       'delivery',   'direct',   0.77, 'high',   '14 days', 0.4, 1.1, 0.0),
  ('cash',       'people',     'direct',   0.72, 'medium', '21 days', 0.4, 1.0, 0.1),
  ('delivery',   'revenue',    'direct',   0.80, 'high',   '14 days', 0.4, 1.2, 0.0),
  ('delivery',   'people',     'indirect', 0.60, 'medium', '7 days',  0.3, 1.0, 0.1),
  ('people',     'operations', 'direct',   0.73, 'medium', '14 days', 0.4, 1.0, 0.0),
  ('people',     'revenue',    'indirect', 0.69, 'medium', '21 days', 0.3, 0.9, 0.1);

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
ALTER TABLE automation_actions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE automation_actions ADD COLUMN IF NOT EXISTS integration_required TEXT;
ALTER TABLE automation_actions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE automation_actions ADD COLUMN IF NOT EXISTS rollback_guidance TEXT;
-- Add insight_category if missing (real schema requires it NOT NULL)
ALTER TABLE automation_actions ADD COLUMN IF NOT EXISTS insight_category TEXT;
UPDATE automation_actions SET insight_category = 'general' WHERE insight_category IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automation_actions_action_type_key') THEN
    ALTER TABLE automation_actions ADD CONSTRAINT automation_actions_action_type_key UNIQUE(action_type);
  END IF;
END $$;

INSERT INTO automation_actions (action_type, insight_category, action_label, description, integration_required) VALUES
  ('send_invoice_reminder',            'finance',    'Send Invoice Reminder',              'Automated follow-up for overdue invoices',                      'accounting'),
  ('trigger_re_engagement',            'revenue',    'Trigger Re-engagement',              'Automated outreach for at-risk deals',                          'crm'),
  ('generate_diversification_playbook','revenue',    'Generate Diversification Playbook',  'AI-generated playbook to reduce revenue concentration',         NULL),
  ('generate_cash_preservation',       'finance',    'Generate Cash Preservation Plan',    'AI plan to extend runway during compression',                   NULL),
  ('propose_load_reallocation',        'operations', 'Propose Load Reallocation',          'Redistribute workload to reduce burnout risk',                  NULL),
  ('create_collection_sequence',       'finance',    'Create Collection Sequence',         'Multi-step collection workflow for overdue payments',            'accounting'),
  ('flag_deal_for_review',             'revenue',    'Flag Deal for Review',               'Mark stalled or at-risk deals for immediate attention',         'crm'),
  ('generate_retention_plan',          'revenue',    'Generate Retention Plan',            'AI-generated client retention strategy',                        NULL),
  ('escalate_sla_breach',              'operations', 'Escalate SLA Breach',                'Alert owner and schedule recovery call for SLA violations',     'crm'),
  ('generate_competitive_response',    'market',     'Generate Competitive Response',      'AI brief on competitive positioning adjustment',                NULL)
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
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS insight_ref TEXT DEFAULT '';
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS evidence_refs TEXT[] DEFAULT '{}';
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS result JSONB DEFAULT '{}';
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS rollback_executed BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_automation_executions_tenant ON automation_executions(tenant_id);

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

CREATE INDEX IF NOT EXISTS IF NOT EXISTS idx_instability_snapshots_tenant ON instability_snapshots(tenant_id, snapshot_date DESC);

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

CREATE POLICY IF NOT EXISTS "Users see own integration_health" ON integration_health FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY IF NOT EXISTS "Users see own integration_health_history" ON integration_health_history FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY IF NOT EXISTS "Users see own evidence_packs" ON evidence_packs FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY IF NOT EXISTS "Users see own cognition_decisions" ON cognition_decisions FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY IF NOT EXISTS "Users see own outcome_checkpoints" ON outcome_checkpoints FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY IF NOT EXISTS "Users see own automation_executions" ON automation_executions FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY IF NOT EXISTS "Users see own instability_snapshots" ON instability_snapshots FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY IF NOT EXISTS "Users see own confidence_recalibrations" ON confidence_recalibrations FOR ALL USING (auth.uid() = tenant_id);
CREATE POLICY IF NOT EXISTS "Anyone can submit enterprise_contact_requests" ON enterprise_contact_requests FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Admins see all enterprise_contact_requests" ON enterprise_contact_requests FOR SELECT USING (auth.uid() IS NOT NULL);

-- 045_cognition_core_functions.sql
-- ============================================================
-- Migration 045: Cognition Core SQL Functions
-- BIQc Platform — Intelligence Engine Functions
-- Run AFTER migration 044
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. ASSEMBLE EVIDENCE PACK ──────────────────────────────
CREATE OR REPLACE FUNCTION fn_assemble_evidence_pack(
  p_tenant_id UUID,
  p_tab TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evidence JSONB := '[]';
  v_count INTEGER := 0;
  v_quality FLOAT := 0.0;
  v_crm_connected BOOLEAN := false;
  v_accounting_connected BOOLEAN := false;
  v_email_connected BOOLEAN := false;
BEGIN
  SELECT EXISTS(SELECT 1 FROM integration_health WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND provider ILIKE '%crm%') INTO v_crm_connected;
  SELECT EXISTS(SELECT 1 FROM integration_health WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND provider ILIKE '%accounting%') INTO v_accounting_connected;
  SELECT EXISTS(SELECT 1 FROM integration_health WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND (provider ILIKE '%email%' OR provider ILIKE '%gmail%' OR provider ILIKE '%outlook%')) INTO v_email_connected;

  CASE p_tab
    WHEN 'revenue' THEN
      IF v_crm_connected THEN v_quality := 0.8; v_count := 3; v_evidence := '[{"type":"crm_deals","weight":0.8},{"type":"pipeline_velocity","weight":0.7},{"type":"churn_signals","weight":0.6}]';
      ELSE v_quality := 0.2; v_count := 0; END IF;
    WHEN 'risk' THEN
      IF v_accounting_connected THEN v_quality := 0.75; v_count := 2; v_evidence := '[{"type":"cash_position","weight":0.9},{"type":"margin_analysis","weight":0.7}]';
      ELSE v_quality := 0.3; v_count := 1; v_evidence := '[{"type":"market_signals","weight":0.4}]'; END IF;
    WHEN 'operations' THEN
      IF v_crm_connected THEN v_quality := 0.7; v_count := 2; v_evidence := '[{"type":"sla_compliance","weight":0.8},{"type":"bottleneck_signals","weight":0.6}]';
      ELSE v_quality := 0.2; v_count := 0; END IF;
    WHEN 'people' THEN
      IF v_email_connected THEN v_quality := 0.65; v_count := 2; v_evidence := '[{"type":"calendar_density","weight":0.7},{"type":"email_stress","weight":0.6}]';
      ELSE v_quality := 0.1; v_count := 0; END IF;
    ELSE v_quality := 0.5; v_count := 1; v_evidence := '[{"type":"market_calibration","weight":0.5}]';
  END CASE;

  RETURN jsonb_build_object('tenant_id', p_tenant_id, 'tab', p_tab, 'evidence_items', v_evidence, 'evidence_count', v_count, 'quality_score', v_quality, 'assembled_at', now());
END;
$$;
GRANT EXECUTE ON FUNCTION fn_assemble_evidence_pack(UUID, TEXT) TO authenticated, service_role;

-- ── 2. COMPUTE PROPAGATION MAP ─────────────────────────────
CREATE OR REPLACE FUNCTION fn_compute_propagation_map(
  p_tenant_id UUID,
  p_active_risks TEXT[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chains JSONB := '[]';
  r RECORD;
BEGIN
  IF array_length(p_active_risks, 1) IS NULL THEN RETURN '[]'; END IF;
  FOR r IN
    SELECT pr.source_domain, pr.target_domain, pr.base_probability, pr.time_horizon, pr.mechanism
    FROM propagation_rules pr
    WHERE pr.source_domain = ANY(p_active_risks) AND pr.is_active = true
    ORDER BY pr.base_probability DESC LIMIT 5
  LOOP
    v_chains := v_chains || jsonb_build_object('source', r.source_domain, 'target', r.target_domain, 'probability', r.base_probability, 'window', r.time_horizon || ' days', 'description', r.mechanism, 'chain', jsonb_build_array(r.source_domain, r.target_domain));
  END LOOP;
  RETURN v_chains;
END;
$$;
GRANT EXECUTE ON FUNCTION fn_compute_propagation_map(UUID, TEXT[]) TO authenticated, service_role;

-- ── 3. EVALUATE PENDING CHECKPOINTS ────────────────────────
CREATE OR REPLACE FUNCTION fn_evaluate_pending_checkpoints(p_tenant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_evaluated INTEGER := 0; r RECORD;
BEGIN
  FOR r IN SELECT oc.id FROM outcome_checkpoints oc WHERE oc.tenant_id = p_tenant_id AND oc.status = 'pending' AND oc.scheduled_at <= now() LIMIT 10
  LOOP
    UPDATE outcome_checkpoints SET status = 'evaluated', evaluated_at = now(), decision_effective = true, variance_delta = 0 WHERE id = r.id;
    v_evaluated := v_evaluated + 1;
  END LOOP;
  RETURN jsonb_build_object('evaluated_count', v_evaluated, 'evaluated_at', now());
END;
$$;
GRANT EXECUTE ON FUNCTION fn_evaluate_pending_checkpoints(UUID) TO authenticated, service_role;

-- ── 4. RECALIBRATE CONFIDENCE ──────────────────────────────
CREATE OR REPLACE FUNCTION fn_recalibrate_confidence(p_tenant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_decision_count INTEGER; v_evaluated_count INTEGER; v_accuracy FLOAT := 0.5; v_new_confidence FLOAT;
BEGIN
  SELECT COUNT(*) INTO v_decision_count FROM cognition_decisions WHERE tenant_id = p_tenant_id AND status != 'dismissed';
  SELECT COUNT(*) INTO v_evaluated_count FROM outcome_checkpoints oc JOIN cognition_decisions cd ON oc.decision_id = cd.id WHERE cd.tenant_id = p_tenant_id AND oc.status = 'evaluated';
  IF v_evaluated_count >= 3 THEN
    SELECT COALESCE(AVG(CASE WHEN decision_effective THEN 1.0 ELSE 0.0 END), 0.5) INTO v_accuracy FROM outcome_checkpoints oc JOIN cognition_decisions cd ON oc.decision_id = cd.id WHERE cd.tenant_id = p_tenant_id AND oc.status = 'evaluated';
    v_new_confidence := 0.4 + (v_accuracy * 0.5) + (LEAST(v_evaluated_count, 10) * 0.01);
  ELSE
    v_new_confidence := 0.5 + (v_decision_count * 0.02);
  END IF;
  v_new_confidence := GREATEST(0.1, LEAST(0.99, v_new_confidence));
  RETURN jsonb_build_object('confidence_score', v_new_confidence, 'decision_count', v_decision_count, 'evaluated_count', v_evaluated_count, 'accuracy', v_accuracy);
END;
$$;
GRANT EXECUTE ON FUNCTION fn_recalibrate_confidence(UUID) TO authenticated, service_role;

-- ── 5. CHECK INTEGRATION HEALTH ────────────────────────────
CREATE OR REPLACE FUNCTION fn_check_integration_health(p_tenant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_integrations JSONB := '[]'; v_total INTEGER := 0; v_connected INTEGER := 0; r RECORD;
BEGIN
  FOR r IN SELECT provider, status, last_synced_at, error_message, records_count FROM integration_health WHERE tenant_id = p_tenant_id ORDER BY provider
  LOOP
    v_integrations := v_integrations || jsonb_build_object('provider', r.provider, 'status', r.status, 'last_synced_at', r.last_synced_at, 'error_message', r.error_message, 'records_count', r.records_count);
    v_total := v_total + 1;
    IF r.status = 'CONNECTED' THEN v_connected := v_connected + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('integrations', v_integrations, 'total', v_total, 'connected', v_connected, 'health_score', CASE WHEN v_total > 0 THEN (v_connected::float / v_total) ELSE 0 END);
END;
$$;
GRANT EXECUTE ON FUNCTION fn_check_integration_health(UUID) TO authenticated, service_role;

-- ── 6. SNAPSHOT DAILY INSTABILITY ──────────────────────────
CREATE OR REPLACE FUNCTION fn_snapshot_daily_instability(p_tenant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO instability_snapshots (tenant_id, snapshot_date, composite_risk_score, system_state, confidence_score, evidence_count)
  VALUES (p_tenant_id, CURRENT_DATE, 0, 'STABLE', 0.5, 0)
  ON CONFLICT (tenant_id, snapshot_date) DO NOTHING;
  RETURN jsonb_build_object('status', 'snapshotted', 'date', CURRENT_DATE);
END;
$$;
GRANT EXECUTE ON FUNCTION fn_snapshot_daily_instability(UUID) TO authenticated, service_role;

-- ── 7. DETECT DRIFT ────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_detect_drift(p_tenant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_recent RECORD; v_prior_score FLOAT; v_delta FLOAT := 0; v_drift_detected BOOLEAN := false;
BEGIN
  SELECT composite_risk_score, system_state INTO v_recent FROM instability_snapshots WHERE tenant_id = p_tenant_id ORDER BY snapshot_date DESC LIMIT 1;
  SELECT composite_risk_score INTO v_prior_score FROM instability_snapshots WHERE tenant_id = p_tenant_id ORDER BY snapshot_date DESC LIMIT 1 OFFSET 1;
  IF v_recent IS NOT NULL AND v_prior_score IS NOT NULL THEN
    v_delta := v_recent.composite_risk_score - v_prior_score;
    v_drift_detected := ABS(v_delta) > 0.15;
  END IF;
  RETURN jsonb_build_object('drift_detected', v_drift_detected, 'delta', v_delta, 'current_state', COALESCE(v_recent.system_state, 'STABLE'), 'checked_at', now());
END;
$$;
GRANT EXECUTE ON FUNCTION fn_detect_drift(UUID) TO authenticated, service_role;

-- ── 8. MASTER COGNITION CONTRACT ───────────────────────────
CREATE OR REPLACE FUNCTION ic_generate_cognition_contract(
  p_tenant_id UUID,
  p_tab TEXT DEFAULT 'overview'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evidence JSONB;
  v_confidence JSONB;
  v_propagation JSONB;
  v_active_risks TEXT[] := '{}';
  v_system_state TEXT := 'STABLE';
  v_composite_risk FLOAT := 0;
  v_instability_indices JSONB;
  v_crm_connected BOOLEAN := false;
  v_accounting_connected BOOLEAN := false;
  v_email_connected BOOLEAN := false;
  v_tab_data JSONB := '{}';
BEGIN
  SELECT EXISTS(SELECT 1 FROM integration_health WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND provider ILIKE '%crm%') INTO v_crm_connected;
  SELECT EXISTS(SELECT 1 FROM integration_health WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND provider ILIKE '%accounting%') INTO v_accounting_connected;
  SELECT EXISTS(SELECT 1 FROM integration_health WHERE tenant_id = p_tenant_id AND status = 'CONNECTED' AND (provider ILIKE '%email%' OR provider ILIKE '%gmail%' OR provider ILIKE '%outlook%')) INTO v_email_connected;

  v_evidence := fn_assemble_evidence_pack(p_tenant_id, p_tab);
  v_confidence := fn_recalibrate_confidence(p_tenant_id);

  IF NOT v_crm_connected THEN v_active_risks := v_active_risks || ARRAY['revenue']; END IF;
  IF NOT v_accounting_connected THEN v_active_risks := v_active_risks || ARRAY['finance']; END IF;
  IF NOT v_email_connected THEN v_active_risks := v_active_risks || ARRAY['people']; END IF;

  v_propagation := fn_compute_propagation_map(p_tenant_id, v_active_risks);

  v_instability_indices := jsonb_build_object(
    'revenue_volatility_index', CASE WHEN v_crm_connected THEN 0.25 ELSE 0.6 END,
    'engagement_decay_score', CASE WHEN v_email_connected THEN 0.2 ELSE 0.5 END,
    'cash_deviation_ratio', CASE WHEN v_accounting_connected THEN 0.15 ELSE 0.55 END,
    'anomaly_density_score', 0.2
  );

  v_composite_risk := (
    ((v_instability_indices->>'revenue_volatility_index')::float * 0.3) +
    ((v_instability_indices->>'engagement_decay_score')::float * 0.25) +
    ((v_instability_indices->>'cash_deviation_ratio')::float * 0.3) +
    ((v_instability_indices->>'anomaly_density_score')::float * 0.15)
  );

  v_system_state := CASE
    WHEN v_composite_risk > 0.7 THEN 'CRITICAL'
    WHEN v_composite_risk > 0.5 THEN 'COMPRESSION'
    WHEN v_composite_risk > 0.3 THEN 'DRIFT'
    ELSE 'STABLE'
  END;

  CASE p_tab
    WHEN 'revenue' THEN v_tab_data := jsonb_build_object('crm_required', NOT v_crm_connected, 'pipeline_health', CASE WHEN v_crm_connected THEN 'connected' ELSE 'disconnected' END);
    WHEN 'risk' THEN v_tab_data := jsonb_build_object('accounting_required', NOT v_accounting_connected, 'risk_level', CASE WHEN v_composite_risk > 0.6 THEN 'high' WHEN v_composite_risk > 0.3 THEN 'medium' ELSE 'low' END);
    WHEN 'operations' THEN v_tab_data := jsonb_build_object('crm_required', NOT v_crm_connected, 'operational_load', 'nominal');
    WHEN 'people' THEN v_tab_data := jsonb_build_object('email_required', NOT v_email_connected, 'capacity', CASE WHEN v_email_connected THEN 'available' ELSE 'requires_email' END);
    ELSE v_tab_data := jsonb_build_object('integrations_connected', (CASE WHEN v_crm_connected THEN 1 ELSE 0 END + CASE WHEN v_accounting_connected THEN 1 ELSE 0 END + CASE WHEN v_email_connected THEN 1 ELSE 0 END));
  END CASE;

  RETURN jsonb_build_object(
    'status', 'computed',
    'tab', p_tab,
    'tenant_id', p_tenant_id,
    'system_state', v_system_state,
    'composite_risk_score', v_composite_risk,
    'instability_indices', v_instability_indices,
    'propagation_map', v_propagation,
    'confidence_score', (v_confidence->>'confidence_score')::float,
    'evidence_count', (v_evidence->>'evidence_count')::int,
    'evidence_quality', (v_evidence->>'quality_score')::float,
    'tab_data', v_tab_data,
    'integrations', jsonb_build_object('crm', v_crm_connected, 'accounting', v_accounting_connected, 'email', v_email_connected),
    'computed_at', now(),
    'model_version', 'v1.0'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION ic_generate_cognition_contract(UUID, TEXT) TO authenticated, service_role;

-- ── 9. CALCULATE RISK BASELINE ─────────────────────────────
CREATE OR REPLACE FUNCTION ic_calculate_risk_baseline(p_tenant_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT ic_generate_cognition_contract(p_tenant_id, 'overview') INTO v_result;
  RETURN jsonb_build_object('status', 'computed', 'composite', jsonb_build_object('risk_score', (v_result->>'composite_risk_score')::float, 'system_state', v_result->>'system_state'), 'indices', v_result->'instability_indices', 'computed_at', now());
END;
$$;
GRANT EXECUTE ON FUNCTION ic_calculate_risk_baseline(UUID) TO authenticated, service_role;

-- 046_user_feature_usage.sql
-- ============================================================
-- Supabase: user_feature_usage
-- Server-side tracking of scan usage per user
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS user_feature_usage (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_name    TEXT NOT NULL,
  last_used_at    TIMESTAMPTZ DEFAULT now(),
  use_count       INTEGER DEFAULT 1,
  UNIQUE(user_id, feature_name)
);

ALTER TABLE user_feature_usage ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE user_feature_usage ADD COLUMN IF NOT EXISTS use_count INTEGER DEFAULT 1;

ALTER TABLE user_feature_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users manage own feature usage" ON user_feature_usage;
END $$;

CREATE POLICY IF NOT EXISTS "Users manage own feature usage"
  ON user_feature_usage FOR ALL
  USING (auth.uid() = user_id);

-- 047_grant_test_super_admin.sql
-- ============================================================
-- Grant Super Admin to 3 Test Accounts
-- Run in Supabase SQL Editor
-- ============================================================

UPDATE public.users
SET subscription_tier = 'super_admin', role = 'super_admin'
WHERE email IN (
  'trent-test1@biqc-test.com',
  'trent-test2@biqc-test.com',
  'trent-test3@biqc-test.com'
);

-- Also set calibration complete for test1 (Campos Coffee — already calibrated)
UPDATE public.user_operator_profile
SET persona_calibration_status = 'complete'
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN ('trent-test1@biqc-test.com','trent-test2@biqc-test.com','trent-test3@biqc-test.com')
);

-- Verify
SELECT au.email, u.subscription_tier, u.role, op.persona_calibration_status
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
LEFT JOIN public.user_operator_profile op ON op.user_id = au.id
WHERE au.email IN ('trent-test1@biqc-test.com','trent-test2@biqc-test.com','trent-test3@biqc-test.com');

-- 048_forensic_corrections.sql
-- ============================================================
-- FORENSIC CORRECTIONS 048 — CORRECTED (uses real columns)
-- Run in Supabase SQL Editor
-- ============================================================

-- PROTOCOL 1: Delete old SoundBoard prompt
DELETE FROM system_prompts WHERE prompt_key = 'mysoundboard_v1';

-- PROTOCOL 7: Grant super_admin to test accounts
UPDATE public.users
SET subscription_tier = 'super_admin', role = 'super_admin'
WHERE email IN (
  'trent-test1@biqc-test.com',
  'trent-test2@biqc-test.com',
  'trent-test3@biqc-test.com'
);

-- Set calibration complete for test accounts
UPDATE public.user_operator_profile
SET persona_calibration_status = 'complete'
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'trent-test1@biqc-test.com',
    'trent-test2@biqc-test.com',
    'trent-test3@biqc-test.com'
  )
);

-- PROTOCOL 2: Clear contaminated intelligence fields (verified real columns)
UPDATE public.business_profiles
SET
  market_position           = NULL,
  main_products_services    = NULL,
  unique_value_proposition  = NULL,
  competitive_advantages    = NULL,
  target_market             = NULL,
  ideal_customer_profile    = NULL,
  geographic_focus          = NULL,
  abn                       = NULL,
  competitor_scan_result    = NULL,
  cached_market_intel       = NULL,
  competitor_scan_last      = NULL,
  last_market_scraped_at    = NULL,
  updated_at                = now()
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'trent-test1@biqc-test.com',
    'trent-test2@biqc-test.com',
    'trent-test3@biqc-test.com'
  )
);

-- Verify everything
SELECT
  au.email,
  u.subscription_tier,
  u.role,
  op.persona_calibration_status,
  bp.business_name,
  bp.abn,
  bp.market_position
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
LEFT JOIN public.user_operator_profile op ON op.user_id = au.id
LEFT JOIN public.business_profiles bp ON bp.user_id = au.id
WHERE au.email IN (
  'trent-test1@biqc-test.com',
  'trent-test2@biqc-test.com',
  'trent-test3@biqc-test.com'
);

-- 049_fix_propagation_map_columns.sql
-- Migration 049: Fix fn_compute_propagation_map column references
-- The function was referencing pr.probability and pr.lag_days which don't exist
-- Actual columns: pr.base_probability, pr.time_horizon, pr.mechanism
-- Run this in Supabase SQL Editor to fix the cognition/overview 500 error

CREATE OR REPLACE FUNCTION fn_compute_propagation_map(p_tenant_id UUID, p_active_risks TEXT[]) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_chains JSONB := '[]';
  r RECORD;
BEGIN
  IF array_length(p_active_risks, 1) IS NULL THEN RETURN '[]'; END IF;
  FOR r IN
    SELECT pr.source_domain, pr.target_domain, pr.base_probability, pr.time_horizon, pr.mechanism
    FROM propagation_rules pr
    WHERE pr.source_domain = ANY(p_active_risks) AND pr.is_active = true
    ORDER BY pr.base_probability DESC LIMIT 5
  LOOP
    v_chains := v_chains || jsonb_build_object(
      'source', r.source_domain,
      'target', r.target_domain,
      'probability', r.base_probability,
      'window', r.time_horizon || ' days',
      'description', r.mechanism,
      'chain', jsonb_build_array(r.source_domain, r.target_domain)
    );
  END LOOP;
  RETURN v_chains;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_compute_propagation_map(UUID, TEXT[]) TO authenticated, service_role;

