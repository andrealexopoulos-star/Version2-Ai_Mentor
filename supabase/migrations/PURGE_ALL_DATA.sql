-- ═══════════════════════════════════════════════════════════════
-- BIQc FULL DATA PURGE v2 — Fixed Missing Tables
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ═══ SAFE TRUNCATE HELPER ═══
CREATE OR REPLACE FUNCTION safe_truncate(tbl TEXT) RETURNS void AS $$
BEGIN EXECUTE format('TRUNCATE TABLE %I CASCADE', tbl);
EXCEPTION WHEN undefined_table THEN NULL; END;
$$ LANGUAGE plpgsql;

-- ═══ PURGE ALL TABLES (child → parent order) ═══

-- Intelligence Spine
SELECT safe_truncate('ic_event_queue');
SELECT safe_truncate('ic_model_executions');
SELECT safe_truncate('ic_intelligence_events');
SELECT safe_truncate('ic_daily_metric_snapshots');
SELECT safe_truncate('ic_decision_outcomes');
SELECT safe_truncate('ic_decisions');
SELECT safe_truncate('ic_ontology_edges');
SELECT safe_truncate('ic_ontology_nodes');

-- Ingestion
SELECT safe_truncate('ingestion_cleaned');
SELECT safe_truncate('ingestion_pages');
SELECT safe_truncate('ingestion_sessions');
SELECT safe_truncate('ingestion_audits');

-- Governance
SELECT safe_truncate('governance_events');
SELECT safe_truncate('report_exports');
SELECT safe_truncate('escalation_history');
SELECT safe_truncate('insight_outcomes');

-- Integrations
SELECT safe_truncate('workspace_integrations');
SELECT safe_truncate('integration_accounts');
SELECT safe_truncate('email_connections');
SELECT safe_truncate('observation_events');

-- Intelligence
SELECT safe_truncate('intelligence_snapshots');
SELECT safe_truncate('soundboard_conversations');
SELECT safe_truncate('documents');

-- Calibration
SELECT safe_truncate('strategic_console_state');

-- Memory + Marketing + Observability
SELECT safe_truncate('context_summaries');
SELECT safe_truncate('semantic_memory');
SELECT safe_truncate('episodic_memory');
SELECT safe_truncate('marketing_benchmarks');
SELECT safe_truncate('action_log');
SELECT safe_truncate('llm_call_log');
SELECT safe_truncate('payment_transactions');

-- ═══ MISSING TABLES (caused the FK error) ═══
SELECT safe_truncate('usage_tracking');
SELECT safe_truncate('user_preferences');
SELECT safe_truncate('accounts');

-- Business profiles (before users)
SELECT safe_truncate('business_profiles');

-- Users
SELECT safe_truncate('users');

-- Auth users
DELETE FROM auth.users;

-- Reset flags
UPDATE ic_feature_flags SET enabled = false;

-- Cleanup helper
DROP FUNCTION safe_truncate(TEXT);

-- Verify
SELECT 'PURGE COMPLETE' AS status,
    (SELECT COUNT(*) FROM auth.users) AS auth_users,
    (SELECT COUNT(*) FROM users) AS app_users;
