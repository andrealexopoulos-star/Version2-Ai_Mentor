-- ═══════════════════════════════════════════════════════════════
-- BIQc FULL DATA PURGE — Fresh Testing Reset
-- 
-- WARNING: This deletes ALL user data across ALL tables.
-- Run in Supabase SQL Editor.
-- Back up your database first if you want to preserve anything.
--
-- Order matters: child tables first, then parent tables, then auth.
-- ═══════════════════════════════════════════════════════════════

-- ═══ STEP 1: Intelligence Spine tables ═══
TRUNCATE TABLE ic_event_queue CASCADE;
TRUNCATE TABLE ic_model_executions CASCADE;
TRUNCATE TABLE ic_intelligence_events CASCADE;
TRUNCATE TABLE ic_daily_metric_snapshots CASCADE;
TRUNCATE TABLE ic_decision_outcomes CASCADE;
TRUNCATE TABLE ic_decisions CASCADE;
TRUNCATE TABLE ic_ontology_edges CASCADE;
TRUNCATE TABLE ic_ontology_nodes CASCADE;

-- ═══ STEP 2: Ingestion tables ═══
TRUNCATE TABLE ingestion_cleaned CASCADE;
TRUNCATE TABLE ingestion_pages CASCADE;
TRUNCATE TABLE ingestion_sessions CASCADE;
TRUNCATE TABLE ingestion_audits CASCADE;

-- ═══ STEP 3: Governance & reporting ═══
TRUNCATE TABLE governance_events CASCADE;
TRUNCATE TABLE report_exports CASCADE;
TRUNCATE TABLE escalation_history CASCADE;
TRUNCATE TABLE insight_outcomes CASCADE;

-- ═══ STEP 4: Integration data ═══
TRUNCATE TABLE workspace_integrations CASCADE;
TRUNCATE TABLE integration_accounts CASCADE;
TRUNCATE TABLE email_connections CASCADE;
TRUNCATE TABLE observation_events CASCADE;

-- ═══ STEP 5: Intelligence & snapshots ═══
TRUNCATE TABLE intelligence_snapshots CASCADE;
TRUNCATE TABLE soundboard_conversations CASCADE;
TRUNCATE TABLE documents CASCADE;

-- ═══ STEP 6: Calibration & console ═══
TRUNCATE TABLE strategic_console_state CASCADE;

-- ═══ STEP 7: Business profiles (before users) ═══
TRUNCATE TABLE business_profiles CASCADE;

-- ═══ STEP 8: Users table ═══
TRUNCATE TABLE users CASCADE;

-- ═══ STEP 9: Payment transactions ═══
-- (only if table exists)
DO $$ BEGIN
    EXECUTE 'TRUNCATE TABLE payment_transactions CASCADE';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ═══ STEP 10: Memory tables (if deployed) ═══
DO $$ BEGIN EXECUTE 'TRUNCATE TABLE context_summaries CASCADE'; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'TRUNCATE TABLE semantic_memory CASCADE'; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'TRUNCATE TABLE episodic_memory CASCADE'; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'TRUNCATE TABLE marketing_benchmarks CASCADE'; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'TRUNCATE TABLE action_log CASCADE'; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'TRUNCATE TABLE llm_call_log CASCADE'; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ═══ STEP 11: Delete ALL auth users from Supabase Auth ═══
-- This removes users from auth.users (the actual login accounts)
DELETE FROM auth.users;

-- ═══ STEP 12: Reset feature flags to defaults ═══
UPDATE ic_feature_flags SET enabled = false;

-- ═══ STEP 13: Reset model registry counters ═══
-- Keep model definitions but clear execution history
-- (model_registry rows preserved — they define the system, not user data)

-- ═══ STEP 14: Reset risk weight configs ═══
-- Keep weight configs (they're system config, not user data)
-- Only reset if you want fresh industry configs:
-- TRUNCATE TABLE ic_risk_weight_configs CASCADE;

-- ═══ VERIFICATION ═══
SELECT 'PURGE COMPLETE' AS status,
    (SELECT COUNT(*) FROM auth.users) AS auth_users,
    (SELECT COUNT(*) FROM users) AS app_users,
    (SELECT COUNT(*) FROM business_profiles) AS profiles,
    (SELECT COUNT(*) FROM intelligence_snapshots) AS snapshots,
    (SELECT COUNT(*) FROM governance_events) AS events;
