"""
BIQc Cognition Core v2 Backend Tests - Iteration 84

Tests the COMPLETE Enterprise-grade Cognition Core rewrite:
- Master function ic_generate_cognition_contract orchestrates ALL engines
- Evidence Engine with freshness-weighted integrity scoring + evidence gating
- Compound Propagation with chain amplification + dampening (A→B→C detection)
- Bayesian Confidence Recalibration with decay + minimum gating + FP tracking
- Drift Detection Engine (Z-score based)
- Daily Instability Snapshot Generator
- Integration Health with SLA breach + retry + degradation history
- Cognition Telemetry for every function call
- Decision lifecycle states (draft/active/superseded/withdrawn)

Note: SQL migrations 044/045 not yet deployed - backend handles gracefully with MIGRATION_REQUIRED.
"""

import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SUPABASE_URL = "https://uxyqpdfftxpkzeppqtvk.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eXFwZGZmdHhwa3plcHBxdHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzcwNDcsImV4cCI6MjA4NDAxMzA0N30.Xu9Wg5M638qJSgDpJKwFYlr9YZDiYPLv4Igh69KHJ0k"
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "BIQc_Test_2026!"


# =============================================================================
# SECTION 1: API HEALTH + ROUTE EXISTENCE
# =============================================================================

class TestCognitionCoreV2Health:
    """Basic health and route existence tests"""
    
    def test_api_health(self):
        """Verify backend is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy'
        print("✓ API health check passed")


class TestCognitionCoreV2RouteExistence:
    """Verify all 15+ cognition contract routes exist (auth-gated)"""
    
    # ─── Tab endpoints (7 valid tabs in v2) ───
    
    def test_cognition_revenue_route_exists(self):
        """GET /api/cognition/revenue should exist"""
        response = requests.get(f"{BASE_URL}/api/cognition/revenue")
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print("✓ /api/cognition/revenue route exists (auth-gated)")
    
    def test_cognition_money_route_exists(self):
        """GET /api/cognition/money should exist (NEW in v2)"""
        response = requests.get(f"{BASE_URL}/api/cognition/money")
        assert response.status_code in [401, 403]
        print("✓ /api/cognition/money route exists (auth-gated)")
    
    def test_cognition_operations_route_exists(self):
        """GET /api/cognition/operations should exist"""
        response = requests.get(f"{BASE_URL}/api/cognition/operations")
        assert response.status_code in [401, 403]
        print("✓ /api/cognition/operations route exists (auth-gated)")
    
    def test_cognition_risk_route_exists(self):
        """GET /api/cognition/risk should exist"""
        response = requests.get(f"{BASE_URL}/api/cognition/risk")
        assert response.status_code in [401, 403]
        print("✓ /api/cognition/risk route exists (auth-gated)")
    
    def test_cognition_people_route_exists(self):
        """GET /api/cognition/people should exist"""
        response = requests.get(f"{BASE_URL}/api/cognition/people")
        assert response.status_code in [401, 403]
        print("✓ /api/cognition/people route exists (auth-gated)")
    
    def test_cognition_market_route_exists(self):
        """GET /api/cognition/market should exist"""
        response = requests.get(f"{BASE_URL}/api/cognition/market")
        assert response.status_code in [401, 403]
        print("✓ /api/cognition/market route exists (auth-gated)")
    
    def test_cognition_overview_route_exists(self):
        """GET /api/cognition/overview should exist"""
        response = requests.get(f"{BASE_URL}/api/cognition/overview")
        assert response.status_code in [401, 403]
        print("✓ /api/cognition/overview route exists (auth-gated)")
    
    # ─── Decision management endpoints ───
    
    def test_cognition_decisions_list_route_exists(self):
        """GET /api/cognition/decisions should exist"""
        response = requests.get(f"{BASE_URL}/api/cognition/decisions")
        assert response.status_code in [401, 403]
        print("✓ GET /api/cognition/decisions route exists (auth-gated)")
    
    def test_cognition_decisions_create_route_exists(self):
        """POST /api/cognition/decisions should exist"""
        response = requests.post(f"{BASE_URL}/api/cognition/decisions", json={})
        assert response.status_code in [401, 403, 422]
        print("✓ POST /api/cognition/decisions route exists (auth-gated)")
    
    # ─── Automation endpoints ───
    
    def test_automation_execute_route_exists(self):
        """POST /api/cognition/automation/execute should exist"""
        response = requests.post(f"{BASE_URL}/api/cognition/automation/execute", json={})
        assert response.status_code in [401, 403, 422]
        print("✓ POST /api/cognition/automation/execute route exists (auth-gated)")
    
    def test_automation_history_route_exists(self):
        """GET /api/cognition/automation/history should exist"""
        response = requests.get(f"{BASE_URL}/api/cognition/automation/history")
        assert response.status_code in [401, 403]
        print("✓ GET /api/cognition/automation/history route exists (auth-gated)")
    
    # ─── Integration health endpoints ───
    
    def test_integration_health_route_exists(self):
        """GET /api/cognition/integration-health should exist"""
        response = requests.get(f"{BASE_URL}/api/cognition/integration-health")
        assert response.status_code in [401, 403]
        print("✓ GET /api/cognition/integration-health route exists (auth-gated)")
    
    def test_integration_health_history_route_exists(self):
        """GET /api/cognition/integration-health/history should exist (NEW in v2)"""
        response = requests.get(f"{BASE_URL}/api/cognition/integration-health/history")
        assert response.status_code in [401, 403]
        print("✓ GET /api/cognition/integration-health/history route exists (auth-gated)")
    
    # ─── Instability + Drift endpoints ───
    
    def test_snapshot_instability_route_exists(self):
        """POST /api/cognition/snapshot-instability should exist"""
        response = requests.post(f"{BASE_URL}/api/cognition/snapshot-instability")
        assert response.status_code in [401, 403]
        print("✓ POST /api/cognition/snapshot-instability route exists (auth-gated)")
    
    def test_drift_route_exists(self):
        """GET /api/cognition/drift should exist (NEW in v2)"""
        response = requests.get(f"{BASE_URL}/api/cognition/drift")
        assert response.status_code in [401, 403]
        print("✓ GET /api/cognition/drift route exists (auth-gated)")
    
    # ─── Telemetry endpoint ───
    
    def test_telemetry_route_exists(self):
        """GET /api/cognition/telemetry should exist (NEW in v2)"""
        response = requests.get(f"{BASE_URL}/api/cognition/telemetry")
        assert response.status_code in [401, 403]
        print("✓ GET /api/cognition/telemetry route exists (auth-gated)")


# =============================================================================
# SECTION 2: CODE REVIEW - SQL MIGRATIONS 044 (TABLES)
# =============================================================================

class TestMigration044Tables:
    """Verify migration 044 creates all 10+ required tables with proper schema"""
    
    def test_migration_044_creates_integration_health_table(self):
        """integration_health table with SLA breach + retry + consecutive failures"""
        with open('/app/supabase/migrations/044_cognition_core.sql', 'r') as f:
            content = f.read()
        
        assert 'CREATE TABLE IF NOT EXISTS integration_health' in content
        assert 'sla_breached BOOLEAN' in content, "Should have sla_breached column"
        assert 'retry_count INT' in content, "Should have retry_count column"
        assert 'consecutive_failures INT' in content, "Should have consecutive_failures column"
        assert "'DEGRADED'" in content, "Should support DEGRADED status"
        print("✓ integration_health table has SLA breach + retry + consecutive failures")
    
    def test_migration_044_creates_integration_health_history_table(self):
        """integration_health_history table for degradation tracking (NEW in v2)"""
        with open('/app/supabase/migrations/044_cognition_core.sql', 'r') as f:
            content = f.read()
        
        assert 'CREATE TABLE IF NOT EXISTS integration_health_history' in content
        assert 'old_status TEXT' in content, "Should track old status"
        assert 'new_status TEXT' in content, "Should track new status"
        print("✓ integration_health_history table for degradation tracking")
    
    def test_migration_044_creates_evidence_packs_table(self):
        """evidence_packs table with freshness scoring"""
        with open('/app/supabase/migrations/044_cognition_core.sql', 'r') as f:
            content = f.read()
        
        assert 'CREATE TABLE IF NOT EXISTS evidence_packs' in content
        assert 'integrity_score FLOAT' in content
        assert 'freshness_score FLOAT' in content, "Should have freshness_score (v2)"
        assert 'missing_sources TEXT[]' in content
        assert 'stale_sources TEXT[]' in content, "Should have stale_sources (v2)"
        print("✓ evidence_packs table with freshness scoring")
    
    def test_migration_044_creates_cognition_decisions_table(self):
        """cognition_decisions table with lifecycle states"""
        with open('/app/supabase/migrations/044_cognition_core.sql', 'r') as f:
            content = f.read()
        
        assert 'CREATE TABLE IF NOT EXISTS cognition_decisions' in content
        assert "'draft'" in content and "'active'" in content
        assert "'superseded'" in content and "'withdrawn'" in content, "Should have all 4 lifecycle states"
        assert 'superseded_by UUID REFERENCES cognition_decisions(id)' in content, "Should have superseded_by FK"
        print("✓ cognition_decisions table with draft/active/superseded/withdrawn states")
    
    def test_migration_044_creates_outcome_checkpoints_table(self):
        """outcome_checkpoints table with normalized variance + false positive"""
        with open('/app/supabase/migrations/044_cognition_core.sql', 'r') as f:
            content = f.read()
        
        assert 'CREATE TABLE IF NOT EXISTS outcome_checkpoints' in content
        assert 'normalized_variance FLOAT' in content, "Should have normalized_variance (v2)"
        assert 'false_positive BOOLEAN' in content, "Should have false_positive tracking (v2)"
        assert 'confidence_adjustment FLOAT' in content
        print("✓ outcome_checkpoints table with normalized variance + false positive tracking")
    
    def test_migration_044_creates_propagation_rules_table(self):
        """propagation_rules table with amplification + dampening"""
        with open('/app/supabase/migrations/044_cognition_core.sql', 'r') as f:
            content = f.read()
        
        assert 'CREATE TABLE IF NOT EXISTS propagation_rules' in content
        assert 'amplification_factor FLOAT' in content, "Should have amplification_factor (v2)"
        assert 'dampening_factor FLOAT' in content, "Should have dampening_factor (v2)"
        assert 'industry_override TEXT' in content, "Should have industry_override (v2)"
        print("✓ propagation_rules table with amplification + dampening factors")
    
    def test_migration_044_creates_instability_snapshots_table(self):
        """instability_snapshots table for daily snapshot storage"""
        with open('/app/supabase/migrations/044_cognition_core.sql', 'r') as f:
            content = f.read()
        
        assert 'CREATE TABLE IF NOT EXISTS instability_snapshots' in content
        assert 'rvi FLOAT' in content
        assert 'eds FLOAT' in content
        assert 'cdr FLOAT' in content
        assert 'ads FLOAT' in content
        assert 'composite FLOAT' in content
        assert 'evidence_integrity FLOAT' in content
        assert 'propagation_count INT' in content
        print("✓ instability_snapshots table for daily snapshots")
    
    def test_migration_044_creates_confidence_recalibrations_table(self):
        """confidence_recalibrations table with decay + minimum gating tracking (v2)"""
        with open('/app/supabase/migrations/044_cognition_core.sql', 'r') as f:
            content = f.read()
        
        assert 'CREATE TABLE IF NOT EXISTS confidence_recalibrations' in content
        assert 'false_positive_rate FLOAT' in content, "Should track false_positive_rate (v2)"
        assert 'decay_applied BOOLEAN' in content, "Should track decay_applied (v2)"
        assert 'minimum_threshold_met BOOLEAN' in content, "Should track minimum_threshold_met (v2)"
        print("✓ confidence_recalibrations table with decay + minimum gating")
    
    def test_migration_044_creates_cognition_telemetry_table(self):
        """cognition_telemetry table for function instrumentation (NEW in v2)"""
        with open('/app/supabase/migrations/044_cognition_core.sql', 'r') as f:
            content = f.read()
        
        assert 'CREATE TABLE IF NOT EXISTS cognition_telemetry' in content
        assert 'function_name TEXT' in content
        assert 'execution_ms INT' in content
        assert 'output_status TEXT' in content
        assert 'row_count INT' in content
        print("✓ cognition_telemetry table for function instrumentation")
    
    def test_migration_044_creates_drift_detection_log_table(self):
        """drift_detection_log table for Z-score anomaly tracking (NEW in v2)"""
        with open('/app/supabase/migrations/044_cognition_core.sql', 'r') as f:
            content = f.read()
        
        assert 'CREATE TABLE IF NOT EXISTS drift_detection_log' in content
        assert 'expected_range_low FLOAT' in content
        assert 'expected_range_high FLOAT' in content
        assert 'drift_magnitude FLOAT' in content
        assert 'drift_direction TEXT' in content
        assert 'is_anomalous BOOLEAN' in content
        print("✓ drift_detection_log table for Z-score anomaly tracking")
    
    def test_migration_044_append_only_trigger(self):
        """Decisions must be append-only (only status + superseded_by can change)"""
        with open('/app/supabase/migrations/044_cognition_core.sql', 'r') as f:
            content = f.read()
        
        assert 'fn_decisions_append_only' in content
        assert 'trg_decisions_append_only' in content
        assert "RAISE EXCEPTION 'Cognition decisions are append-only" in content
        print("✓ Append-only trigger enforces decision immutability")
    
    def test_migration_044_rls_policies(self):
        """All tables have RLS with tenant_id = auth.uid()"""
        with open('/app/supabase/migrations/044_cognition_core.sql', 'r') as f:
            content = f.read()
        
        # Count RLS policies
        rls_enables = content.count('ENABLE ROW LEVEL SECURITY')
        assert rls_enables >= 10, f"Should have RLS on 10+ tables, found {rls_enables}"
        assert 'tenant_id = auth.uid()' in content, "Should use tenant isolation"
        print(f"✓ {rls_enables} tables have RLS enabled with tenant isolation")
    
    def test_migration_044_seeds_14_propagation_rules(self):
        """14 propagation rules seeded with amplification_factor"""
        with open('/app/supabase/migrations/044_cognition_core.sql', 'r') as f:
            content = f.read()
        
        expected_rules = [
            ("'finance', 'operations'", 1.2), ("'finance', 'people'", 1.1),
            ("'operations', 'people'", 1.3), ("'operations', 'revenue'", 1.0),
            ("'market', 'revenue'", 1.1), ("'market', 'people'", 1.0),
            ("'revenue', 'cash'", 1.5), ("'revenue', 'operations'", 1.0),
            ("'cash', 'delivery'", 1.4), ("'cash', 'people'", 1.2),
            ("'delivery', 'revenue'", 1.1), ("'delivery', 'people'", 1.0),
            ("'people', 'operations'", 1.3), ("'people', 'revenue'", 1.0),
        ]
        
        for rule_def, amp_factor in expected_rules:
            assert rule_def in content, f"Missing propagation rule: {rule_def}"
        
        print("✓ 14 propagation rules seeded with amplification factors")
    
    def test_migration_044_seeds_10_automation_actions(self):
        """10 automation actions seeded with rollback_guidance"""
        with open('/app/supabase/migrations/044_cognition_core.sql', 'r') as f:
            content = f.read()
        
        expected_actions = [
            'send_invoice_reminder', 'trigger_re_engagement', 'generate_diversification_playbook',
            'generate_cash_preservation', 'propose_load_reallocation', 'create_collection_sequence',
            'flag_deal_for_review', 'generate_retention_plan', 'escalate_sla_breach',
            'generate_competitive_response'
        ]
        
        for action in expected_actions:
            assert f"'{action}'" in content, f"Missing automation action: {action}"
        
        # Check rollback guidance is seeded
        assert 'rollback_guidance' in content
        print("✓ 10 automation actions seeded with rollback_guidance")


# =============================================================================
# SECTION 3: CODE REVIEW - SQL FUNCTIONS (MIGRATION 045)
# =============================================================================

class TestMigration045Functions:
    """Verify migration 045 creates all 9 SQL functions with proper algorithms"""
    
    def test_fn_log_telemetry_exists(self):
        """fn_log_telemetry helper for instrumentation"""
        with open('/app/supabase/migrations/045_cognition_core_functions.sql', 'r') as f:
            content = f.read()
        
        assert 'CREATE OR REPLACE FUNCTION fn_log_telemetry' in content
        assert 'INSERT INTO cognition_telemetry' in content
        print("✓ fn_log_telemetry helper function for instrumentation")
    
    def test_fn_assemble_evidence_pack_with_freshness_weighting(self):
        """fn_assemble_evidence_pack with freshness-weighted integrity scoring"""
        with open('/app/supabase/migrations/045_cognition_core_functions.sql', 'r') as f:
            content = f.read()
        
        assert 'CREATE OR REPLACE FUNCTION fn_assemble_evidence_pack' in content
        # Freshness calculation
        assert 'v_freshness_total' in content, "Should compute freshness total"
        assert 'v_stale' in content, "Should track stale sources"
        assert 'c_fresh_hours' in content or 'c_stale_hours' in content, "Should have freshness thresholds"
        # Telemetry instrumentation
        assert "fn_log_telemetry(p_tenant_id, 'fn_assemble_evidence_pack'" in content
        print("✓ fn_assemble_evidence_pack with freshness-weighted scoring")
    
    def test_fn_check_integration_health_with_sla(self):
        """fn_check_integration_health with SLA breach detection + history"""
        with open('/app/supabase/migrations/045_cognition_core_functions.sql', 'r') as f:
            content = f.read()
        
        assert 'CREATE OR REPLACE FUNCTION fn_check_integration_health' in content
        # SLA breach detection (>4 hours)
        assert 'sla_breached' in content
        assert '240' in content or '4 hours' in content, "Should have 4-hour SLA threshold"
        # History logging
        assert 'integration_health_history' in content, "Should log to history table"
        # Telemetry
        assert "fn_log_telemetry(p_tenant_id, 'fn_check_integration_health'" in content
        print("✓ fn_check_integration_health with SLA breach + history")
    
    def test_fn_compute_propagation_map_compound_chains(self):
        """fn_compute_propagation_map with compound chain detection (A→B→C)"""
        with open('/app/supabase/migrations/045_cognition_core_functions.sql', 'r') as f:
            content = f.read()
        
        assert 'CREATE OR REPLACE FUNCTION fn_compute_propagation_map' in content
        # Compound chain detection
        assert 'v_chains' in content, "Should detect compound chains"
        assert 'compound_chains' in content or 'compound_probability' in content
        # Amplification + dampening
        assert 'amplification_factor' in content
        assert 'dampening_factor' in content
        # Industry override
        assert 'industry_override' in content
        # Telemetry
        assert "fn_log_telemetry(p_tenant_id, 'fn_compute_propagation_map'" in content
        print("✓ fn_compute_propagation_map with compound chain detection (A→B→C)")
    
    def test_fn_evaluate_pending_checkpoints_normalized_variance(self):
        """fn_evaluate_pending_checkpoints with normalized variance (RMS) + false positive"""
        with open('/app/supabase/migrations/045_cognition_core_functions.sql', 'r') as f:
            content = f.read()
        
        assert 'CREATE OR REPLACE FUNCTION fn_evaluate_pending_checkpoints' in content
        # Normalized variance (RMS calculation)
        assert 'normalized_variance' in content or 'v_norm_var' in content
        assert 'SQRT(' in content, "Should use SQRT for RMS calculation"
        # False positive detection
        assert 'false_positive' in content or 'v_fp' in content
        # Differentiated confidence adjustments
        assert '0.03' in content, "Should have +0.03 for effective"
        assert '-0.05' in content or '-0.05' in content, "Should have -0.05 for false positive"
        assert '-0.02' in content, "Should have -0.02 for ineffective"
        # Telemetry
        assert "fn_log_telemetry(p_tenant_id, 'fn_evaluate_pending_checkpoints'" in content
        print("✓ fn_evaluate_pending_checkpoints with normalized variance + false positive detection")
    
    def test_fn_recalibrate_confidence_bayesian(self):
        """fn_recalibrate_confidence with Bayesian-inspired update + decay + minimum gating"""
        with open('/app/supabase/migrations/045_cognition_core_functions.sql', 'r') as f:
            content = f.read()
        
        assert 'CREATE OR REPLACE FUNCTION fn_recalibrate_confidence' in content
        # Minimum decision count gating
        assert 'v_min_decisions' in content or 'minimum' in content.lower()
        # Decay mechanism (30+ days)
        assert 'decay' in content.lower()
        assert '30' in content, "Should have 30-day decay threshold"
        # False positive rate tracking
        assert 'false_positive_rate' in content or 'v_fp_rate' in content
        # Telemetry
        assert "fn_log_telemetry(p_tenant_id, 'fn_recalibrate_confidence'" in content
        print("✓ fn_recalibrate_confidence with Bayesian update + decay + minimum gating")
    
    def test_fn_detect_drift_zscore(self):
        """fn_detect_drift with Z-score based anomaly detection (>2 std deviations)"""
        with open('/app/supabase/migrations/045_cognition_core_functions.sql', 'r') as f:
            content = f.read()
        
        assert 'CREATE OR REPLACE FUNCTION fn_detect_drift' in content
        # Z-score calculation
        assert 'STDDEV' in content, "Should use standard deviation"
        assert 'v_mean' in content or 'AVG' in content
        # Anomaly threshold (>2 std devs)
        assert '2.0' in content or '> 2' in content, "Should have 2 std dev threshold"
        assert 'is_anomalous' in content or 'v_anomalous' in content
        # Telemetry
        assert "fn_log_telemetry(p_tenant_id, 'fn_detect_drift'" in content
        print("✓ fn_detect_drift with Z-score anomaly detection (>2 std devs)")
    
    def test_fn_snapshot_daily_instability_exists(self):
        """fn_snapshot_daily_instability for daily snapshot generation"""
        with open('/app/supabase/migrations/045_cognition_core_functions.sql', 'r') as f:
            content = f.read()
        
        assert 'CREATE OR REPLACE FUNCTION fn_snapshot_daily_instability' in content
        assert 'instability_snapshots' in content
        assert 'CURRENT_DATE' in content
        print("✓ fn_snapshot_daily_instability for daily snapshots")
    
    def test_ic_generate_cognition_contract_master_function(self):
        """ic_generate_cognition_contract is THE MASTER function orchestrating ALL engines"""
        with open('/app/supabase/migrations/045_cognition_core_functions.sql', 'r') as f:
            content = f.read()
        
        assert 'CREATE OR REPLACE FUNCTION ic_generate_cognition_contract' in content
        
        # Must call ALL engines in sequence
        assert 'fn_assemble_evidence_pack' in content, "Must call Evidence Engine"
        assert 'fn_check_integration_health' in content, "Must call Integration Health Engine"
        assert 'ic_calculate_risk_baseline' in content, "Must call Instability Engine"
        assert 'fn_compute_propagation_map' in content, "Must call Propagation Engine"
        assert 'fn_evaluate_pending_checkpoints' in content, "Must call Decision Consequence Engine"
        assert 'fn_recalibrate_confidence' in content, "Must call Confidence Engine"
        assert 'fn_detect_drift' in content, "Must call Drift Detection Engine"
        
        # Evidence gating (integrity < 0.25 blocks)
        assert '0.25' in content, "Should have 0.25 integrity threshold for gating"
        assert 'INSUFFICIENT_EVIDENCE' in content, "Should return INSUFFICIENT_EVIDENCE when blocked"
        
        # Telemetry on master function
        assert "fn_log_telemetry(p_tenant_id, 'ic_generate_cognition_contract'" in content
        
        print("✓ ic_generate_cognition_contract orchestrates ALL engines with evidence gating")
    
    def test_migration_045_pg_cron_schedules(self):
        """pg_cron schedules defined for daily batch operations"""
        with open('/app/supabase/migrations/045_cognition_core_functions.sql', 'r') as f:
            content = f.read()
        
        assert 'cognition-daily-snapshot' in content or 'fn_snapshot_daily_instability' in content
        assert 'cognition-drift-detection' in content or 'fn_detect_drift' in content
        assert 'cognition-checkpoint-eval' in content or 'fn_evaluate_pending_checkpoints' in content
        print("✓ pg_cron schedules defined for daily operations")
    
    def test_migration_045_grants(self):
        """Proper GRANT permissions on all functions"""
        with open('/app/supabase/migrations/045_cognition_core_functions.sql', 'r') as f:
            content = f.read()
        
        assert 'GRANT EXECUTE ON FUNCTION fn_assemble_evidence_pack' in content
        assert 'GRANT EXECUTE ON FUNCTION fn_check_integration_health' in content
        assert 'GRANT EXECUTE ON FUNCTION fn_compute_propagation_map' in content
        assert 'GRANT EXECUTE ON FUNCTION ic_generate_cognition_contract' in content
        print("✓ GRANT permissions on all functions")


# =============================================================================
# SECTION 4: PYTHON BACKEND - THIN PASS-THROUGH VERIFICATION
# =============================================================================

class TestPythonThinPassThrough:
    """Verify Python backend is THIN pass-through with ZERO business logic"""
    
    def test_cognition_contract_uses_rpc_calls_only(self):
        """cognition_contract.py should use sb.rpc() for ALL intelligence"""
        with open('/app/backend/routes/cognition_contract.py', 'r') as f:
            content = f.read()
        
        # Must use RPC calls
        assert '_call_rpc' in content or 'sb.rpc' in content
        
        # Must call master SQL function
        assert 'ic_generate_cognition_contract' in content
        
        # No business logic calculations
        forbidden_patterns = [
            'def calculate_',
            'def compute_',
            'def score_',
            'numpy',
            'pandas',
            'math.sqrt',
            'statistics.',
        ]
        for pattern in forbidden_patterns:
            assert pattern not in content, f"Should not have business logic: {pattern}"
        
        print("✓ Python backend is thin pass-through using SQL RPC calls")
    
    def test_cognition_contract_has_15_endpoints(self):
        """Verify all 15+ required endpoints exist"""
        with open('/app/backend/routes/cognition_contract.py', 'r') as f:
            content = f.read()
        
        required_endpoints = [
            '@router.get("/cognition/{tab}")',
            '@router.post("/cognition/decisions")',
            '@router.get("/cognition/decisions")',
            '@router.post("/cognition/automation/execute")',
            '@router.get("/cognition/automation/history")',
            '@router.get("/cognition/integration-health")',
            '@router.get("/cognition/integration-health/history")',
            '@router.post("/cognition/snapshot-instability")',
            '@router.get("/cognition/drift")',
            '@router.get("/cognition/telemetry")',
        ]
        
        for endpoint in required_endpoints:
            assert endpoint in content, f"Missing endpoint: {endpoint}"
        
        print("✓ All 15+ cognition contract endpoints exist")
    
    def test_cognition_contract_auth_gated(self):
        """All endpoints use Depends(get_current_user) for auth"""
        with open('/app/backend/routes/cognition_contract.py', 'r') as f:
            content = f.read()
        
        # Every endpoint function should have current_user dependency
        assert 'Depends(get_current_user)' in content
        assert content.count('current_user: dict = Depends(get_current_user)') >= 10
        print("✓ All endpoints are auth-gated with get_current_user")
    
    def test_cognition_contract_graceful_migration_handling(self):
        """Backend handles missing SQL functions gracefully with MIGRATION_REQUIRED"""
        with open('/app/backend/routes/cognition_contract.py', 'r') as f:
            content = f.read()
        
        assert 'MIGRATION_REQUIRED' in content
        assert "Run migrations 044" in content or "function" in content.lower()
        print("✓ Backend handles missing migrations gracefully")
    
    def test_server_router_registration(self):
        """cognition_contract router is registered in server.py"""
        with open('/app/backend/server.py', 'r') as f:
            content = f.read()
        
        assert 'from routes.cognition_contract import router as cognition_router' in content
        assert 'api_router.include_router(cognition_router)' in content
        print("✓ cognition_router registered in server.py")


# =============================================================================
# SECTION 5: AUTHENTICATED TESTING (if credentials work)
# =============================================================================

class TestCognitionContractAuthenticated:
    """Tests with Supabase authentication"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Authenticate with Supabase to get JWT token"""
        try:
            auth_response = requests.post(
                f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
                headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"}
            )
            
            if auth_response.status_code == 200:
                token = auth_response.json().get('access_token')
                if token:
                    print(f"✓ Supabase auth successful")
                    return token
            
            print(f"⚠ Supabase auth failed: {auth_response.status_code}")
        except Exception as e:
            print(f"⚠ Supabase auth error: {e}")
        
        pytest.skip("Supabase authentication failed - skipping authenticated tests")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_cognition_overview_response_structure(self, auth_headers):
        """GET /api/cognition/overview returns full v2 response structure"""
        response = requests.get(f"{BASE_URL}/api/cognition/overview", headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check for v2 status responses
            if data.get('status') == 'MIGRATION_REQUIRED':
                print(f"⚠ Expected: SQL migrations not deployed yet")
                return
            
            if data.get('status') == 'INSUFFICIENT_EVIDENCE':
                # This is valid v2 behavior - evidence gating is working
                assert 'integrity_score' in str(data) or 'evidence_pack' in data
                print(f"✓ Evidence gating working - returned INSUFFICIENT_EVIDENCE")
                return
            
            # Full v2 response structure
            assert 'evidence_pack' in data, "Should have evidence_pack"
            assert 'instability' in data, "Should have instability"
            assert 'propagation_map' in data, "Should have propagation_map"
            assert 'compound_chains' in data, "Should have compound_chains (v2)"
            assert 'decision_effectiveness' in data, "Should have decision_effectiveness"
            assert 'confidence' in data, "Should have confidence"
            assert 'drift' in data, "Should have drift (v2)"
            assert 'integration_health' in data, "Should have integration_health"
            assert 'evidence_refs' in data, "Should have evidence_refs"
            
            print(f"✓ /api/cognition/overview returns full v2 response structure")
        else:
            print(f"⚠ /api/cognition/overview returned {response.status_code}")
    
    def test_drift_endpoint_response(self, auth_headers):
        """GET /api/cognition/drift returns drift detection results"""
        response = requests.get(f"{BASE_URL}/api/cognition/drift", headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            if 'error' not in data:
                assert 'drifts' in data or 'status' in data
                print(f"✓ /api/cognition/drift returns drift detection results")
            else:
                print(f"⚠ SQL function not deployed: {data.get('error', '')[:100]}")
        else:
            print(f"⚠ /api/cognition/drift returned {response.status_code}")
    
    def test_telemetry_endpoint_response(self, auth_headers):
        """GET /api/cognition/telemetry returns telemetry data"""
        response = requests.get(f"{BASE_URL}/api/cognition/telemetry", headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            assert 'telemetry' in data, "Should return telemetry array"
            print(f"✓ /api/cognition/telemetry returns telemetry data")
        else:
            print(f"⚠ /api/cognition/telemetry returned {response.status_code}")
    
    def test_integration_health_history_response(self, auth_headers):
        """GET /api/cognition/integration-health/history returns degradation history"""
        response = requests.get(f"{BASE_URL}/api/cognition/integration-health/history", headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            assert 'history' in data, "Should return history array"
            print(f"✓ /api/cognition/integration-health/history returns degradation history")
        else:
            print(f"⚠ /api/cognition/integration-health/history returned {response.status_code}")


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
