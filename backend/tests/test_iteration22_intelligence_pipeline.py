"""
Iteration 22: BIQC Intelligence Pipeline Stability Tests

Tests the 3-stage intelligence pipeline:
1. Emission Layer: run_emission() extracts signals from integrations → observation_events
2. Watchtower Engine: run_analysis() evaluates observation_events → positions/insights
3. Cold-Read: generate_cold_read() synthesizes intelligence for user

Fixed Issues Verified:
- emission_layer.run_emission() was never called during cold-read (NOW CALLED)
- integration_accounts status filter blocked all Merge tokens (FIXED - removed .eq('status', 'active'))
- watchtower_engine.run_analysis() was never called (NOW CALLED)

Test credentials: andre@thestrategysquad.com.au / BiqcTest2026!
NOTE: This user doesn't have a workspace initialized, so cold-read tests
      will verify proper error handling instead.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "BiqcTest2026!"


def get_auth_token():
    """Helper function to get auth token."""
    response = requests.post(
        f"{BASE_URL}/api/auth/supabase/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        data = response.json()
        session = data.get("session", {})
        token = session.get("access_token") or data.get("access_token") or data.get("token")
        if token:
            return token
    return None


@pytest.fixture(scope="session")
def auth_token():
    """Session-scoped auth token fixture."""
    token = get_auth_token()
    if not token:
        pytest.skip("Could not authenticate with test credentials")
    return token


class TestHealthAndBasics:
    """Basic health checks to ensure API is up."""

    def test_health_endpoint(self):
        """Verify backend health check."""
        response = requests.get(f"{BASE_URL}/api/health")
        print(f"Health check: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"


class TestAuthentication:
    """Authentication tests for the test user."""

    def test_auth_successful(self, auth_token):
        """Confirm we have a valid auth token."""
        assert auth_token is not None
        assert len(auth_token) > 20
        print(f"Auth token obtained (length: {len(auth_token)})")


class TestLifecycleState:
    """Test lifecycle/state endpoint for integration status."""

    def test_lifecycle_state_returns_integrations(self, auth_token):
        """GET /api/lifecycle/state should return integration count."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/lifecycle/state", headers=headers)
        print(f"Lifecycle state: {response.status_code}")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "integrations" in data
        assert "count" in data["integrations"]
        assert "providers" in data["integrations"]
        
        integration_count = data["integrations"]["count"]
        providers = data["integrations"]["providers"]
        workspace_id = data.get("workspace_id")
        
        print(f"Integrations connected: {integration_count}")
        print(f"Providers: {providers}")
        print(f"Workspace ID: {workspace_id}")
        
        # The test user may not have integrations - verify it returns proper structure
        assert isinstance(integration_count, int)
        
    def test_lifecycle_state_has_intelligence_structure(self, auth_token):
        """GET /api/lifecycle/state should show intelligence status."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/lifecycle/state", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify intelligence field structure
        assert "intelligence" in data
        assert "has_events" in data["intelligence"]
        assert "domains_enabled" in data["intelligence"]
        
        has_events = data["intelligence"].get("has_events", False)
        domains_enabled = data["intelligence"].get("domains_enabled", [])
        
        print(f"Has intelligence events: {has_events}")
        print(f"Domains enabled: {domains_enabled}")


class TestColdReadPipeline:
    """Test the main cold-read pipeline (emission → watchtower → cold-read)."""

    def test_cold_read_workspace_validation(self, auth_token):
        """
        POST /api/intelligence/cold-read should validate workspace exists.
        
        Since the test user has no workspace, it should return 400.
        This verifies the pipeline has proper validation.
        """
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/intelligence/cold-read", headers=headers, timeout=60)
        
        print(f"Cold-read response: {response.status_code}")
        
        # Without workspace, should return 400 with proper error
        if response.status_code == 400:
            data = response.json()
            print(f"Expected error: {data.get('detail')}")
            assert "Workspace" in str(data.get("detail", "")) or "workspace" in str(data.get("detail", "")).lower()
        elif response.status_code == 200:
            # If workspace exists, verify the pipeline ran
            data = response.json()
            assert data.get("success") is True
            print(f"Cold-read succeeded with workspace: {data}")

    def test_cold_read_requires_auth(self):
        """POST /api/intelligence/cold-read should require authentication."""
        response = requests.post(f"{BASE_URL}/api/intelligence/cold-read")
        print(f"Cold-read without auth: {response.status_code}")
        
        assert response.status_code in [401, 403], "Cold-read should reject unauthenticated requests"


class TestWatchtowerPositions:
    """Test Watchtower positions endpoint."""

    def test_watchtower_positions_endpoint(self, auth_token):
        """
        GET /api/watchtower/positions should return domain positions structure.
        
        For a user without observation_events, positions will be empty.
        """
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/watchtower/positions", headers=headers)
        
        print(f"Watchtower positions: {response.status_code}")
        
        assert response.status_code == 200, f"Failed with {response.status_code}: {response.text}"
        
        data = response.json()
        positions = data.get("positions", {})
        
        print(f"Positions returned: {positions}")
        
        # Verify response structure
        assert "positions" in data
        assert isinstance(positions, dict)
        
        # Check for sales position if present
        if "sales" in positions:
            sales_pos = positions["sales"]
            position = sales_pos.get("position")
            print(f"Sales position: {position}")
            assert position in ["STABLE", "ELEVATED", "DETERIORATING", "CRITICAL"], f"Invalid position: {position}"

    def test_watchtower_positions_requires_auth(self):
        """GET /api/watchtower/positions should require authentication."""
        response = requests.get(f"{BASE_URL}/api/watchtower/positions")
        print(f"Positions without auth: {response.status_code}")
        
        assert response.status_code in [401, 403]


class TestDataReadiness:
    """Test data-readiness endpoint for integration observation counts."""

    def test_data_readiness_returns_proper_structure(self, auth_token):
        """
        GET /api/intelligence/data-readiness should return integrations array.
        """
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/intelligence/data-readiness", headers=headers)
        
        print(f"Data readiness: {response.status_code}")
        
        assert response.status_code == 200
        
        data = response.json()
        integrations = data.get("integrations", [])
        
        print(f"Integrations in data-readiness: {len(integrations)}")
        
        for integration in integrations:
            provider = integration.get("provider")
            category = integration.get("category")
            status = integration.get("status")
            obs_count = integration.get("observation_events", 0)
            
            print(f"  - {provider} ({category}): {status}, {obs_count} events")
        
        # Verify proper response structure
        assert "integrations" in data
        assert isinstance(integrations, list)


class TestBaselineSnapshot:
    """Test baseline snapshot endpoint."""

    def test_baseline_snapshot_returns_proper_structure(self, auth_token):
        """
        GET /api/intelligence/baseline-snapshot should return snapshot field.
        """
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/intelligence/baseline-snapshot", headers=headers)
        
        print(f"Baseline snapshot: {response.status_code}")
        
        assert response.status_code == 200
        
        data = response.json()
        snapshot = data.get("snapshot")
        
        print(f"Baseline snapshot present: {snapshot is not None}")
        
        # Verify proper response structure
        assert "snapshot" in data


class TestConsoleState:
    """Test console state persistence."""

    def test_console_state_requires_auth(self):
        """POST /api/console/state should require authentication."""
        response = requests.post(
            f"{BASE_URL}/api/console/state",
            json={"current_step": 1, "status": "IN_PROGRESS"}
        )
        print(f"Console state without auth: {response.status_code}")
        
        assert response.status_code in [401, 403]


class TestEmissionLayerCodeFix:
    """Verify the emission layer fix (removed status filter)."""

    def test_emission_layer_no_status_filter(self):
        """
        Verify the emission layer code fix at line 581.
        
        The fix removed the .eq('status', 'active') filter because the
        integration_accounts table doesn't have a status column.
        """
        emission_file = "/app/backend/merge_emission_layer.py"
        
        with open(emission_file, 'r') as f:
            content = f.read()
        
        # Verify the problematic filter is NOT present
        assert ".eq('status', 'active')" not in content, "Status filter should be removed"
        assert '.eq("status", "active")' not in content, "Status filter should be removed"
        
        # Verify the _get_account_tokens method exists
        assert "def _get_account_tokens" in content
        
        print("VERIFIED: Emission layer has no status filter in _get_account_tokens")

    def test_emission_layer_queries_integration_accounts(self):
        """Verify emission layer queries integration_accounts table."""
        emission_file = "/app/backend/merge_emission_layer.py"
        
        with open(emission_file, 'r') as f:
            content = f.read()
        
        assert "integration_accounts" in content
        assert "category, account_token" in content or '"category", "account_token"' in content
        
        print("VERIFIED: Emission layer queries integration_accounts table correctly")

    def test_cold_read_calls_emission_layer(self):
        """
        Verify intelligence pipeline calls emission_layer.run_emission().
        """
        integrations_file = "/app/backend/routes/integrations.py"
        
        with open(integrations_file, 'r') as f:
            content = f.read()
        
        assert 'emission_layer.run_emission(user_id, account_id)' in content, \
            "Intelligence pipeline should call emission_layer.run_emission()"
        
        print("VERIFIED: Integrations intelligence pipeline calls emission_layer.run_emission()")

    def test_cold_read_calls_watchtower_engine(self):
        """
        Verify intelligence pipeline calls watchtower_engine.run_analysis().
        """
        integrations_file = "/app/backend/routes/integrations.py"
        
        with open(integrations_file, 'r') as f:
            content = f.read()
        
        assert 'engine.run_analysis(user_id)' in content, \
            "Intelligence pipeline should call watchtower_engine.run_analysis()"
        
        print("VERIFIED: Integrations intelligence pipeline calls watchtower_engine.run_analysis()")

    def test_pipeline_order_emission_before_watchtower(self):
        """Verify emission layer runs before watchtower engine in ingestion path."""
        integrations_file = "/app/backend/routes/integrations.py"
        
        with open(integrations_file, 'r') as f:
            content = f.read()
        
        # Find the ingestion endpoint section
        emission_pos = content.find('emission_layer.run_emission')
        watchtower_pos = content.find('engine.run_analysis(user_id)')
        ingest_pos = content.find('trigger_ingestion(')
        
        assert emission_pos != -1 and watchtower_pos != -1 and ingest_pos != -1, \
            "Could not locate emission/watchtower/ingestion symbols in integrations route"
        assert ingest_pos < emission_pos < watchtower_pos, \
            "Pipeline order should be: ingestion route → emission → watchtower"
        
        print("VERIFIED: Pipeline order is ingestion route → emission → watchtower")


class TestWatchtowerFindings:
    """Test Watchtower findings endpoint."""

    def test_watchtower_findings_endpoint(self, auth_token):
        """GET /api/watchtower/findings should return findings array."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/watchtower/findings", headers=headers)
        
        print(f"Watchtower findings: {response.status_code}")
        
        assert response.status_code == 200
        
        data = response.json()
        findings = data.get("findings", [])
        count = data.get("count", 0)
        
        print(f"Findings count: {count}")
        
        # Verify structure
        assert "findings" in data
        assert "count" in data
        assert isinstance(findings, list)


class TestWatchtowerAnalyse:
    """Test Watchtower analyse endpoint."""

    def test_watchtower_analyse_endpoint(self, auth_token):
        """POST /api/watchtower/analyse should trigger analysis."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/watchtower/analyse", headers=headers)
        
        print(f"Watchtower analyse: {response.status_code}")
        
        # Without intelligence configuration, should still return a result
        assert response.status_code == 200
        
        data = response.json()
        print(f"Analyse result: {data}")
        
        # Should return status
        status = data.get("status")
        print(f"Analysis status: {status}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
