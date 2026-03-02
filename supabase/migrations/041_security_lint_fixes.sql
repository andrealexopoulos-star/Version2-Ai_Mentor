-- ═══════════════════════════════════════════════════════════════
-- BIQc SUPABASE SECURITY LINT FIXES
-- Migration: 041_security_lint_fixes.sql
--
-- Fixes 3 categories of security issues:
--   1. Views with SECURITY DEFINER → SECURITY INVOKER
--   2. Functions with mutable search_path → set search_path = ''
--   3. RLS policies with unrestricted FOR ALL → scoped to service_role
-- ═══════════════════════════════════════════════════════════════


-- ═══ 1. FIX VIEWS: SECURITY DEFINER → INVOKER ═══

ALTER VIEW IF EXISTS rag_stats SET (security_invoker = on);
ALTER VIEW IF EXISTS ic_risk_industry_separation SET (security_invoker = on);
ALTER VIEW IF EXISTS v_governance_summary SET (security_invoker = on);
ALTER VIEW IF EXISTS v_integration_status SET (security_invoker = on);
ALTER VIEW IF EXISTS ic_risk_distribution_summary SET (security_invoker = on);


-- ═══ 2. FIX FUNCTIONS: Set immutable search_path ═══

ALTER FUNCTION ic_index_dominance_analysis() SET search_path = '';
ALTER FUNCTION get_escalation_summary(UUID) SET search_path = '';
ALTER FUNCTION detect_silence(UUID) SET search_path = '';
ALTER FUNCTION is_spine_enabled() SET search_path = '';
ALTER FUNCTION ic_calculate_all_risk_baselines() SET search_path = '';
ALTER FUNCTION compute_pressure_levels(UUID) SET search_path = '';
ALTER FUNCTION increment_audit_counter(UUID) SET search_path = '';
ALTER FUNCTION ab_experiment_results(TEXT) SET search_path = '';
ALTER FUNCTION ic_resolve_industry_code(TEXT) SET search_path = '';
ALTER FUNCTION compute_data_readiness(UUID) SET search_path = '';
ALTER FUNCTION emergency_delete_governance_event(UUID, TEXT) SET search_path = '';
ALTER FUNCTION build_intelligence_summary(UUID) SET search_path = '';
ALTER FUNCTION trigger_log_integration_change() SET search_path = '';
ALTER FUNCTION ic_calculate_risk_baseline(UUID, UUID) SET search_path = '';
ALTER FUNCTION ab_get_variant(TEXT, UUID) SET search_path = '';
ALTER FUNCTION ic_process_event_queue() SET search_path = '';
ALTER FUNCTION compute_evidence_freshness(UUID) SET search_path = '';
ALTER FUNCTION compute_watchtower_positions(UUID) SET search_path = '';
ALTER FUNCTION detect_contradictions(UUID) SET search_path = '';
ALTER FUNCTION ic_generate_all_snapshots() SET search_path = '';
ALTER FUNCTION ic_generate_daily_snapshot(UUID) SET search_path = '';
ALTER FUNCTION compute_concentration_risk(UUID) SET search_path = '';
ALTER FUNCTION ic_risk_calibration_report() SET search_path = '';
ALTER FUNCTION compute_revenue_scenarios(UUID) SET search_path = '';
ALTER FUNCTION admin_update_subscription(UUID, UUID, TEXT) SET search_path = '';
ALTER FUNCTION admin_toggle_user(UUID, UUID, BOOLEAN) SET search_path = '';
ALTER FUNCTION admin_list_users() SET search_path = '';
ALTER FUNCTION compute_workforce_health(UUID) SET search_path = '';
ALTER FUNCTION compute_insight_scores(UUID) SET search_path = '';
ALTER FUNCTION compute_profile_completeness(UUID) SET search_path = '';
ALTER FUNCTION increment_snapshot_counter(UUID) SET search_path = '';
ALTER FUNCTION emit_governance_event(UUID, TEXT, TEXT, TEXT, NUMERIC) SET search_path = '';
ALTER FUNCTION trigger_update_integration_sync() SET search_path = '';
ALTER FUNCTION trigger_log_report_export() SET search_path = '';
ALTER FUNCTION prevent_governance_update() SET search_path = '';
ALTER FUNCTION ic_prevent_weight_update() SET search_path = '';
ALTER FUNCTION ic_validate_snapshot_correlation(UUID) SET search_path = '';
ALTER FUNCTION rag_search(UUID, vector, INT, TEXT[], FLOAT) SET search_path = '';
ALTER FUNCTION is_spine_enabled_for(UUID) SET search_path = '';
ALTER FUNCTION reset_monthly_counters() SET search_path = '';

-- Handle functions that may have different signatures
DO $$ BEGIN ALTER FUNCTION compute_market_risk_weight() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION calibrate_pressure() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION decay_evidence() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION compute_forensic_score() SET search_path = ''; EXCEPTION WHEN undefined_function THEN NULL; END $$;


-- ═══ 3. FIX RLS: Scope service policies to service_role only ═══
-- Replace "FOR ALL USING (true)" with "FOR ALL TO service_role USING (true)"

-- ab_assignments
DROP POLICY IF EXISTS "manage_assignments" ON ab_assignments;
CREATE POLICY "manage_assignments" ON ab_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ab_experiments
DROP POLICY IF EXISTS "manage_experiments" ON ab_experiments;
CREATE POLICY "manage_experiments" ON ab_experiments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ab_metrics
DROP POLICY IF EXISTS "manage_metrics" ON ab_metrics;
CREATE POLICY "manage_metrics" ON ab_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);

-- action_log
DROP POLICY IF EXISTS "service_all" ON action_log;
CREATE POLICY "service_all" ON action_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- admin_actions
DROP POLICY IF EXISTS "service_manage" ON admin_actions;
CREATE POLICY "service_manage" ON admin_actions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- context_summaries
DROP POLICY IF EXISTS "service_all" ON context_summaries;
CREATE POLICY "service_all" ON context_summaries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- episodic_memory
DROP POLICY IF EXISTS "service_all" ON episodic_memory;
CREATE POLICY "service_all" ON episodic_memory FOR ALL TO service_role USING (true) WITH CHECK (true);

-- escalation_history
DROP POLICY IF EXISTS "Service manages escalation_history" ON escalation_history;
CREATE POLICY "service_manage_escalation" ON escalation_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_daily_metric_snapshots
DROP POLICY IF EXISTS "manage_snaps" ON ic_daily_metric_snapshots;
CREATE POLICY "manage_snaps" ON ic_daily_metric_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_decision_outcomes
DROP POLICY IF EXISTS "manage_outcomes" ON ic_decision_outcomes;
CREATE POLICY "manage_outcomes" ON ic_decision_outcomes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_decisions
DROP POLICY IF EXISTS "manage_decisions" ON ic_decisions;
CREATE POLICY "manage_decisions" ON ic_decisions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_feature_flags
DROP POLICY IF EXISTS "manage_flags" ON ic_feature_flags;
CREATE POLICY "manage_flags" ON ic_feature_flags FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_intelligence_events
DROP POLICY IF EXISTS "manage_events" ON ic_intelligence_events;
CREATE POLICY "manage_events" ON ic_intelligence_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_model_executions
DROP POLICY IF EXISTS "manage_executions" ON ic_model_executions;
CREATE POLICY "manage_executions" ON ic_model_executions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_model_registry
DROP POLICY IF EXISTS "manage_registry" ON ic_model_registry;
CREATE POLICY "manage_registry" ON ic_model_registry FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_ontology_edges
DROP POLICY IF EXISTS "manage_edges" ON ic_ontology_edges;
CREATE POLICY "manage_edges" ON ic_ontology_edges FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ic_ontology_nodes
DROP POLICY IF EXISTS "manage_nodes" ON ic_ontology_nodes;
CREATE POLICY "manage_nodes" ON ic_ontology_nodes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ingestion_audits
DROP POLICY IF EXISTS "Service manages audits" ON ingestion_audits;
CREATE POLICY "service_manage_audits" ON ingestion_audits FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ingestion_cleaned
DROP POLICY IF EXISTS "Service manages cleaned" ON ingestion_cleaned;
CREATE POLICY "service_manage_cleaned" ON ingestion_cleaned FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ingestion_pages
DROP POLICY IF EXISTS "Service manages pages" ON ingestion_pages;
CREATE POLICY "service_manage_pages" ON ingestion_pages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ingestion_sessions
DROP POLICY IF EXISTS "Service manages sessions" ON ingestion_sessions;
CREATE POLICY "service_manage_sessions" ON ingestion_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- insight_outcomes
DROP POLICY IF EXISTS "Service role can insert outcomes" ON insight_outcomes;
DROP POLICY IF EXISTS "Service role can update outcomes" ON insight_outcomes;
CREATE POLICY "service_manage_outcomes" ON insight_outcomes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- llm_call_log
DROP POLICY IF EXISTS "service_all" ON llm_call_log;
CREATE POLICY "service_all" ON llm_call_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- marketing_benchmarks
DROP POLICY IF EXISTS "service_all" ON marketing_benchmarks;
CREATE POLICY "service_all" ON marketing_benchmarks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- rag_embeddings
DROP POLICY IF EXISTS "service_manage_embeddings" ON rag_embeddings;
CREATE POLICY "service_manage_embeddings" ON rag_embeddings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- report_exports
DROP POLICY IF EXISTS "Service role manages report_exports" ON report_exports;
CREATE POLICY "service_manage_reports" ON report_exports FOR ALL TO service_role USING (true) WITH CHECK (true);

-- semantic_memory
DROP POLICY IF EXISTS "service_all" ON semantic_memory;
CREATE POLICY "service_all" ON semantic_memory FOR ALL TO service_role USING (true) WITH CHECK (true);

-- workspace_integrations
DROP POLICY IF EXISTS "Service role manages workspace_integrations" ON workspace_integrations;
CREATE POLICY "service_manage_integrations" ON workspace_integrations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- governance_events (keep insert-only for service role - already hardened)
DROP POLICY IF EXISTS "service_insert_governance_events" ON governance_events;
CREATE POLICY "service_insert_governance_events" ON governance_events FOR INSERT TO service_role WITH CHECK (true);
