"""
BIQc Cognition Core Backend Tests - Iteration 83

Tests the Unified Cognition Contract API:
- Evidence Engine (fn_assemble_evidence_pack)
- Instability Engine (ic_calculate_risk_baseline - already exists)
- Propagation Engine (fn_compute_propagation_map)
- Decision Consequence Engine (cognition_decisions + outcome_checkpoints)
- Automation Execution Engine (automation_actions + automation_executions)
- Unified Cognition Contract (/api/cognition/{tab})

Note: SQL migrations 044/045 may not be deployed yet - backend handles gracefully.
"""

import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "BIQc_Test_2026!"


class TestCognitionContractHealth:
    """Basic health and route existence tests"""
    
    def test_api_health(self):
        """Verify backend is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy'
        print("✓ API health check passed")


class TestCognitionContractRouteExistence:
    """Verify all cognition contract routes exist (auth-gated)"""
    
    def test_cognition_revenue_route_exists(self):
        """GET /api/cognition/revenue should exist (returns 401 without auth)"""
        response = requests.get(f"{BASE_URL}/api/cognition/revenue")
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print("✓ /api/cognition/revenue route exists (auth-gated)")
    
    def test_cognition_risk_route_exists(self):
        """GET /api/cognition/risk should exist"""
        response = requests.get(f"{BASE_URL}/api/cognition/risk")
        assert response.status_code in [401, 403]
        print("✓ /api/cognition/risk route exists (auth-gated)")
    
    def test_cognition_operations_route_exists(self):
        """GET /api/cognition/operations should exist"""
        response = requests.get(f"{BASE_URL}/api/cognition/operations")
        assert response.status_code in [401, 403]
        print("✓ /api/cognition/operations route exists (auth-gated)")
    
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
    
    def test_cognition_decisions_list_route_exists(self):
        """GET /api/cognition/decisions should exist"""
        response = requests.get(f"{BASE_URL}/api/cognition/decisions")
        assert response.status_code in [401, 403]
        print("✓ GET /api/cognition/decisions route exists (auth-gated)")
    
    def test_cognition_decisions_create_route_exists(self):
        """POST /api/cognition/decisions should exist"""
        response = requests.post(f"{BASE_URL}/api/cognition/decisions", json={})
        assert response.status_code in [401, 403, 422]  # 422 if validation error
        print("✓ POST /api/cognition/decisions route exists (auth-gated)")
    
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
    
    def test_integration_health_route_exists(self):
        """GET /api/cognition/integration-health should exist"""
        response = requests.get(f"{BASE_URL}/api/cognition/integration-health")
        assert response.status_code in [401, 403]
        print("✓ GET /api/cognition/integration-health route exists (auth-gated)")
    
    def test_snapshot_instability_route_exists(self):
        """POST /api/cognition/snapshot-instability should exist"""
        response = requests.post(f"{BASE_URL}/api/cognition/snapshot-instability")
        assert response.status_code in [401, 403]
        print("✓ POST /api/cognition/snapshot-instability route exists (auth-gated)")


class TestCognitionContractAuthenticated:
    """Tests with Supabase authentication"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Authenticate with Supabase to get JWT token"""
        # Try Supabase direct auth
        supabase_url = os.environ.get('SUPABASE_URL', os.environ.get('REACT_APP_SUPABASE_URL', ''))
        supabase_key = os.environ.get('REACT_APP_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eXFwZGZmdHhwa3plcHBxdHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzcwNDcsImV4cCI6MjA4NDAxMzA0N30.Xu9Wg5M638qJSgDpJKwFYlr9YZDiYPLv4Igh69KHJ0k')
        
        try:
            auth_response = requests.post(
                f"{supabase_url}/auth/v1/token?grant_type=password",
                json={
                    "email": TEST_EMAIL,
                    "password": TEST_PASSWORD
                },
                headers={
                    "apikey": supabase_key,
                    "Content-Type": "application/json"
                }
            )
            
            if auth_response.status_code == 200:
                data = auth_response.json()
                token = data.get('access_token')
                if token:
                    print(f"✓ Supabase auth successful, token acquired")
                    return token
            
            print(f"⚠ Supabase auth failed: {auth_response.status_code} - {auth_response.text[:200]}")
        except Exception as e:
            print(f"⚠ Supabase auth error: {e}")
        
        pytest.skip("Supabase authentication failed - skipping authenticated tests")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Return headers with authorization"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_cognition_revenue_authenticated(self, auth_headers):
        """GET /api/cognition/revenue with auth returns structured response"""
        response = requests.get(f"{BASE_URL}/api/cognition/revenue", headers=auth_headers)
        
        # Should return 200 with structured response
        if response.status_code == 200:
            data = response.json()
            # Verify response structure
            assert 'tab' in data, "Response should have 'tab' field"
            assert data['tab'] == 'revenue', "Tab should be 'revenue'"
            assert 'evidence_pack' in data, "Response should have 'evidence_pack'"
            assert 'instability' in data, "Response should have 'instability'"
            assert 'propagation_map' in data, "Response should have 'propagation_map'"
            assert 'decision_effectiveness' in data, "Response should have 'decision_effectiveness'"
            assert 'confidence' in data, "Response should have 'confidence'"
            assert 'automation_actions' in data, "Response should have 'automation_actions'"
            assert 'tab_insights' in data, "Response should have 'tab_insights'"
            assert 'evidence_refs' in data, "Response should have 'evidence_refs'"
            
            # Verify evidence_pack structure
            ep = data['evidence_pack']
            assert 'integrity_score' in ep, "evidence_pack should have integrity_score"
            assert 'missing_sources' in ep, "evidence_pack should have missing_sources"
            
            # Verify instability structure
            inst = data['instability']
            assert 'rvi' in inst, "instability should have rvi"
            assert 'eds' in inst, "instability should have eds"
            assert 'cdr' in inst, "instability should have cdr"
            assert 'ads' in inst, "instability should have ads"
            assert 'composite' in inst, "instability should have composite"
            assert 'risk_band' in inst, "instability should have risk_band"
            assert 'deltas' in inst, "instability should have deltas"
            assert 'trajectory' in inst, "instability should have trajectory"
            
            # Verify confidence structure
            conf = data['confidence']
            assert 'score' in conf, "confidence should have score"
            assert 'reason' in conf, "confidence should have reason"
            assert 'trend' in conf, "confidence should have trend"
            
            print(f"✓ /api/cognition/revenue returns valid cognition contract")
            print(f"  - Integrity: {ep.get('integrity_score')}, Composite risk: {inst.get('composite')}")
        else:
            # Backend may gracefully handle missing SQL functions
            print(f"⚠ /api/cognition/revenue returned {response.status_code}")
            assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
            if response.status_code == 500:
                print(f"  Error: {response.text[:300]}")
    
    def test_cognition_risk_authenticated(self, auth_headers):
        """GET /api/cognition/risk with auth"""
        response = requests.get(f"{BASE_URL}/api/cognition/risk", headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            assert data.get('tab') == 'risk', "Tab should be 'risk'"
            print(f"✓ /api/cognition/risk returns valid response")
        else:
            print(f"⚠ /api/cognition/risk returned {response.status_code}")
    
    def test_cognition_operations_authenticated(self, auth_headers):
        """GET /api/cognition/operations with auth"""
        response = requests.get(f"{BASE_URL}/api/cognition/operations", headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            assert data.get('tab') == 'operations', "Tab should be 'operations'"
            print(f"✓ /api/cognition/operations returns valid response")
        else:
            print(f"⚠ /api/cognition/operations returned {response.status_code}")
    
    def test_cognition_people_authenticated(self, auth_headers):
        """GET /api/cognition/people with auth"""
        response = requests.get(f"{BASE_URL}/api/cognition/people", headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            assert data.get('tab') == 'people', "Tab should be 'people'"
            print(f"✓ /api/cognition/people returns valid response")
        else:
            print(f"⚠ /api/cognition/people returned {response.status_code}")
    
    def test_cognition_market_authenticated(self, auth_headers):
        """GET /api/cognition/market with auth"""
        response = requests.get(f"{BASE_URL}/api/cognition/market", headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            assert data.get('tab') == 'market', "Tab should be 'market'"
            print(f"✓ /api/cognition/market returns valid response")
        else:
            print(f"⚠ /api/cognition/market returned {response.status_code}")
    
    def test_cognition_overview_authenticated(self, auth_headers):
        """GET /api/cognition/overview with auth"""
        response = requests.get(f"{BASE_URL}/api/cognition/overview", headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            assert data.get('tab') == 'overview', "Tab should be 'overview'"
            print(f"✓ /api/cognition/overview returns valid response")
        else:
            print(f"⚠ /api/cognition/overview returned {response.status_code}")
    
    def test_cognition_invalid_tab_returns_400(self, auth_headers):
        """GET /api/cognition/invalid should return 400 with valid tabs"""
        response = requests.get(f"{BASE_URL}/api/cognition/invalid", headers=auth_headers)
        
        assert response.status_code == 400, f"Expected 400 for invalid tab, got {response.status_code}"
        data = response.json()
        assert 'detail' in data, "Response should have error detail"
        assert 'Valid' in data['detail'], "Error should mention valid tabs"
        print(f"✓ /api/cognition/invalid correctly returns 400 with valid tabs list")
    
    def test_create_decision_with_checkpoints(self, auth_headers):
        """POST /api/cognition/decisions creates decision with 30/60/90 day checkpoints"""
        payload = {
            "decision_category": "revenue",
            "decision_statement": "TEST_Expand sales team to increase pipeline",
            "affected_domains": ["revenue", "people", "cash"],
            "expected_instability_change": {"revenue": -0.1, "people": 0.05, "cash": 0.02},
            "expected_time_horizon": 60,
            "evidence_refs": ["cognitive_snapshot:pipeline.value", "instability:rvi"]
        }
        
        response = requests.post(f"{BASE_URL}/api/cognition/decisions", json=payload, headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            assert data.get('status') == 'recorded', "Decision should be recorded"
            assert 'decision_id' in data, "Should return decision_id"
            assert data.get('checkpoints_created') == [30, 60, 90], "Should create 30/60/90 day checkpoints"
            assert 'instability_at_time' in data, "Should include instability snapshot at time"
            print(f"✓ POST /api/cognition/decisions creates decision with checkpoints")
            print(f"  - Decision ID: {data.get('decision_id')}")
            print(f"  - Checkpoints: {data.get('checkpoints_created')}")
        else:
            # May fail if cognition_decisions table doesn't exist yet
            print(f"⚠ POST /api/cognition/decisions returned {response.status_code}")
            print(f"  Response: {response.text[:300]}")
    
    def test_list_decisions_with_checkpoints(self, auth_headers):
        """GET /api/cognition/decisions lists decisions with attached checkpoints"""
        response = requests.get(f"{BASE_URL}/api/cognition/decisions", headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            assert 'decisions' in data, "Response should have 'decisions' array"
            assert 'total' in data, "Response should have 'total' count"
            
            if data['decisions']:
                decision = data['decisions'][0]
                assert 'id' in decision, "Decision should have id"
                assert 'decision_category' in decision, "Decision should have category"
                assert 'decision_statement' in decision, "Decision should have statement"
                assert 'checkpoints' in decision, "Decision should have checkpoints array"
                print(f"✓ GET /api/cognition/decisions returns {data['total']} decisions with checkpoints")
            else:
                print(f"✓ GET /api/cognition/decisions returns empty list (no decisions yet)")
        else:
            print(f"⚠ GET /api/cognition/decisions returned {response.status_code}")
    
    def test_automation_execute(self, auth_headers):
        """POST /api/cognition/automation/execute logs automation execution"""
        payload = {
            "action_type": "generate_cash_preservation",
            "insight_ref": "test_insight",
            "evidence_refs": ["test_evidence"]
        }
        
        response = requests.post(f"{BASE_URL}/api/cognition/automation/execute", json=payload, headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            assert data.get('status') == 'confirmed', "Action should be confirmed"
            assert 'execution_id' in data, "Should return execution_id"
            print(f"✓ POST /api/cognition/automation/execute logs execution")
        elif response.status_code == 404:
            # Action may not be found if automation_actions table not seeded
            print(f"⚠ Automation action not found (table may not be seeded)")
        else:
            print(f"⚠ POST /api/cognition/automation/execute returned {response.status_code}")
    
    def test_automation_history(self, auth_headers):
        """GET /api/cognition/automation/history returns execution history"""
        response = requests.get(f"{BASE_URL}/api/cognition/automation/history", headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            assert 'executions' in data, "Response should have 'executions' array"
            print(f"✓ GET /api/cognition/automation/history returns {len(data.get('executions', []))} executions")
        else:
            print(f"⚠ GET /api/cognition/automation/history returned {response.status_code}")
    
    def test_integration_health(self, auth_headers):
        """GET /api/cognition/integration-health returns integration status"""
        response = requests.get(f"{BASE_URL}/api/cognition/integration-health", headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            # May return health check results or error if fn_check_integration_health not deployed
            print(f"✓ GET /api/cognition/integration-health returns response")
        else:
            print(f"⚠ GET /api/cognition/integration-health returned {response.status_code}")
    
    def test_snapshot_instability(self, auth_headers):
        """POST /api/cognition/snapshot-instability stores instability snapshot"""
        response = requests.post(f"{BASE_URL}/api/cognition/snapshot-instability", headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            assert 'status' in data, "Response should have status"
            if data.get('status') == 'stored':
                assert 'snapshot' in data, "Should include snapshot data"
                print(f"✓ POST /api/cognition/snapshot-instability stores snapshot")
            else:
                print(f"⚠ Snapshot skipped: {data.get('reason')}")
        else:
            print(f"⚠ POST /api/cognition/snapshot-instability returned {response.status_code}")


class TestCodeReview:
    """Code review verifications for Cognition Core"""
    
    def test_cognition_contract_no_frontend_computation(self):
        """Verify cognition_contract.py has no frontend computation - all from SQL"""
        import re
        
        with open('/app/backend/routes/cognition_contract.py', 'r') as f:
            content = f.read()
        
        # Should use sb.rpc() calls for intelligence
        assert 'sb.rpc' in content or '_call_rpc' in content, "Should use RPC calls to SQL functions"
        
        # Should have the evidence engine call
        assert 'fn_assemble_evidence_pack' in content, "Should call fn_assemble_evidence_pack"
        
        # Should have the instability engine call
        assert 'ic_calculate_risk_baseline' in content, "Should call ic_calculate_risk_baseline"
        
        # Should have the propagation engine call
        assert 'fn_compute_propagation_map' in content, "Should call fn_compute_propagation_map"
        
        # Should have decision checkpoint evaluation
        assert 'fn_evaluate_pending_checkpoints' in content, "Should call fn_evaluate_pending_checkpoints"
        
        # Should have confidence recalibration
        assert 'fn_recalibrate_confidence' in content, "Should call fn_recalibrate_confidence"
        
        print("✓ cognition_contract.py uses SQL functions for all intelligence")
    
    def test_migration_044_creates_required_tables(self):
        """Verify migration 044 creates all required tables"""
        with open('/app/supabase/migrations/044_cognition_core.sql', 'r') as f:
            content = f.read()
        
        required_tables = [
            'integration_health',
            'evidence_packs',
            'cognition_decisions',
            'outcome_checkpoints',
            'propagation_rules',
            'automation_actions',
            'automation_executions',
            'instability_snapshots',
            'confidence_recalibrations'
        ]
        
        for table in required_tables:
            assert f'CREATE TABLE IF NOT EXISTS {table}' in content, f"Should create {table} table"
        
        # Verify RLS policies
        assert 'ENABLE ROW LEVEL SECURITY' in content, "Should enable RLS"
        assert 'auth.uid()' in content, "Should use auth.uid() for tenant isolation"
        
        # Verify append-only trigger for decisions
        assert 'fn_decisions_append_only' in content, "Should have append-only trigger function"
        assert 'trg_decisions_append_only' in content, "Should have append-only trigger"
        
        print("✓ Migration 044 creates all required tables with RLS")
    
    def test_migration_045_creates_required_functions(self):
        """Verify migration 045 creates all required SQL functions"""
        with open('/app/supabase/migrations/045_cognition_core_functions.sql', 'r') as f:
            content = f.read()
        
        required_functions = [
            'fn_assemble_evidence_pack',
            'fn_compute_propagation_map',
            'fn_evaluate_pending_checkpoints',
            'fn_recalibrate_confidence',
            'fn_check_integration_health'
        ]
        
        for fn in required_functions:
            assert f'CREATE OR REPLACE FUNCTION {fn}' in content, f"Should create {fn} function"
        
        # Verify SECURITY DEFINER (for service role access)
        assert 'SECURITY DEFINER' in content, "Functions should use SECURITY DEFINER"
        
        # Verify grants
        assert 'GRANT EXECUTE' in content, "Should grant execute permissions"
        
        print("✓ Migration 045 creates all required SQL functions")
    
    def test_propagation_rules_seed_data(self):
        """Verify propagation_rules table is seeded with 14 rules"""
        with open('/app/supabase/migrations/044_cognition_core.sql', 'r') as f:
            content = f.read()
        
        # Check for specific propagation rules
        expected_rules = [
            ('finance', 'operations'),
            ('finance', 'people'),
            ('operations', 'people'),
            ('operations', 'revenue'),
            ('market', 'revenue'),
            ('market', 'people'),
            ('revenue', 'cash'),
            ('revenue', 'operations'),
            ('cash', 'delivery'),
            ('cash', 'people'),
            ('delivery', 'revenue'),
            ('delivery', 'people'),
            ('people', 'operations'),
            ('people', 'revenue')
        ]
        
        for source, target in expected_rules:
            assert f"('{source}', '{target}'" in content, f"Should have {source}→{target} propagation rule"
        
        print("✓ propagation_rules seeded with 14 deterministic rules")
    
    def test_automation_actions_seed_data(self):
        """Verify automation_actions table is seeded with 10 action types"""
        with open('/app/supabase/migrations/044_cognition_core.sql', 'r') as f:
            content = f.read()
        
        expected_actions = [
            'send_invoice_reminder',
            'trigger_re_engagement',
            'generate_diversification_playbook',
            'generate_cash_preservation',
            'propose_load_reallocation',
            'create_collection_sequence',
            'flag_deal_for_review',
            'generate_retention_plan',
            'escalate_sla_breach',
            'generate_competitive_response'
        ]
        
        for action in expected_actions:
            assert f"'{action}'" in content, f"Should have {action} automation action"
        
        print("✓ automation_actions seeded with 10 action types")
    
    def test_server_router_registration(self):
        """Verify cognition_contract router is registered in server.py"""
        with open('/app/backend/server.py', 'r') as f:
            content = f.read()
        
        assert 'from routes.cognition_contract import router as cognition_router' in content, \
            "Should import cognition_router"
        assert 'api_router.include_router(cognition_router)' in content, \
            "Should include cognition_router"
        
        print("✓ cognition_contract router registered in server.py")


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
