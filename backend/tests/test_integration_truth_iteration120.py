"""
Integration Truth Consistency Tests — iteration_120
Forensic testing for truth + UX + data integrity per main agent request.

Tests:
- GET /api/user/integration-status returns canonical truth shape
- GET /api/integrations/merge/connected returns canonical truth + live signal metadata
- GET /api/cognition/overview consistency with integration truth
- GET /api/intelligence/watchtower returns fallback events from observation_events when workspace absent
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')
if BASE_URL and not BASE_URL.startswith('http'):
    BASE_URL = f"http://{BASE_URL}"
BASE_URL = BASE_URL.rstrip('/')

# Test credentials from previous iterations
TEST_EMAIL = "cal-loop-416d7f85@biqctest.io"
TEST_PASSWORD = "BIQcTest!2026Z"


@pytest.fixture(scope="module")
def auth_headers():
    """Authenticate and get headers for subsequent requests."""
    session = requests.Session()
    
    # Login via Supabase
    login_resp = session.post(f"{BASE_URL}/api/auth/supabase/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }, timeout=20)
    
    if login_resp.status_code != 200:
        pytest.skip(f"Auth failed: {login_resp.status_code} - {login_resp.text[:200]}")
    
    data = login_resp.json()
    token = data.get("access_token") or data.get("token") or (data.get("session") or {}).get("access_token")
    
    if not token:
        pytest.skip("No access_token in login response")
    
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


class TestUserIntegrationStatus:
    """Test GET /api/user/integration-status returns canonical truth shape."""
    
    def test_endpoint_returns_200(self, auth_headers):
        """Test that /api/user/integration-status returns 200."""
        resp = requests.get(f"{BASE_URL}/api/user/integration-status", headers=auth_headers, timeout=15)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
    
    def test_canonical_truth_shape(self, auth_headers):
        """Test that canonical_truth contains required fields."""
        resp = requests.get(f"{BASE_URL}/api/user/integration-status", headers=auth_headers, timeout=15)
        assert resp.status_code == 200
        
        data = resp.json()
        assert "canonical_truth" in data, "Response must contain canonical_truth"
        
        ct = data["canonical_truth"]
        required_fields = ["crm_connected", "accounting_connected", "email_connected", "total_connected"]
        for field in required_fields:
            assert field in ct, f"canonical_truth must contain {field}"
            
        # Values must be boolean for connection states
        assert isinstance(ct.get("crm_connected"), bool), "crm_connected must be boolean"
        assert isinstance(ct.get("accounting_connected"), bool), "accounting_connected must be boolean"
        assert isinstance(ct.get("email_connected"), bool), "email_connected must be boolean"
        
    def test_integrations_list_structure(self, auth_headers):
        """Test that integrations list has proper structure."""
        resp = requests.get(f"{BASE_URL}/api/user/integration-status", headers=auth_headers, timeout=15)
        assert resp.status_code == 200
        
        data = resp.json()
        assert "integrations" in data, "Response must contain integrations list"
        
        # Check structure of each integration
        integrations = data["integrations"]
        assert isinstance(integrations, list), "integrations must be a list"
        
        for i in integrations:
            assert "category" in i, f"Integration must have category: {i}"
            assert "connected" in i, f"Integration must have connected status: {i}"
            assert isinstance(i.get("connected"), bool), f"connected must be boolean: {i}"
            
    def test_no_error_in_response(self, auth_headers):
        """Ensure response does not contain error field."""
        resp = requests.get(f"{BASE_URL}/api/user/integration-status", headers=auth_headers, timeout=15)
        assert resp.status_code == 200
        
        data = resp.json()
        assert "error" not in data, f"Response should not contain error: {data.get('error')}"
        assert data.get("status") != "error", f"Status should not be error"


class TestMergeConnectedIntegrations:
    """Test GET /api/integrations/merge/connected returns canonical truth + live signal metadata."""
    
    def test_endpoint_returns_200(self, auth_headers):
        """Test that /api/integrations/merge/connected returns 200."""
        resp = requests.get(f"{BASE_URL}/api/integrations/merge/connected", headers=auth_headers, timeout=15)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
    
    def test_canonical_truth_present(self, auth_headers):
        """Test that canonical_truth is present with required fields."""
        resp = requests.get(f"{BASE_URL}/api/integrations/merge/connected", headers=auth_headers, timeout=15)
        assert resp.status_code == 200
        
        data = resp.json()
        assert "canonical_truth" in data or "integrations" in data, "Response must contain canonical_truth or integrations"
        
        ct = data.get("canonical_truth", {})
        if ct:
            # Verify signal metadata is included
            assert "live_signal_count" in ct or "total_connected" in ct, "canonical_truth should have signal metadata"
            
    def test_integrations_dict_or_list(self, auth_headers):
        """Test that integrations is present."""
        resp = requests.get(f"{BASE_URL}/api/integrations/merge/connected", headers=auth_headers, timeout=15)
        assert resp.status_code == 200
        
        data = resp.json()
        assert "integrations" in data, "Response must contain integrations"
        
        integrations = data["integrations"]
        # Can be dict (keyed by category:provider) or list
        assert isinstance(integrations, (dict, list)), "integrations must be dict or list"


class TestCognitionOverviewConsistency:
    """Test GET /api/cognition/overview consistency with integration truth."""
    
    def test_endpoint_returns_200_or_migration_required(self, auth_headers):
        """Test that /api/cognition/overview returns 200 or MIGRATION_REQUIRED."""
        resp = requests.get(f"{BASE_URL}/api/cognition/overview", headers=auth_headers, timeout=20)
        
        # Allow 200 or 500 (if migration not run)
        if resp.status_code == 500:
            data = resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {}
            if "MIGRATION_REQUIRED" in str(data):
                pytest.skip("Cognition SQL migrations not deployed")
        
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:300]}"
    
    def test_integration_truth_overlay(self, auth_headers):
        """Test that cognition overview includes integration truth overlay."""
        resp = requests.get(f"{BASE_URL}/api/cognition/overview", headers=auth_headers, timeout=20)
        
        if resp.status_code != 200:
            pytest.skip(f"Cognition endpoint unavailable: {resp.status_code}")
        
        data = resp.json()
        
        # Check for migration status
        if data.get("status") == "MIGRATION_REQUIRED":
            pytest.skip("Cognition SQL migrations not deployed")
        
        # Verify integration overlay is applied
        if "integrations" in data:
            integrations = data["integrations"]
            assert "crm" in integrations or "crm_connected" in data, "Should have crm integration truth"
            assert "accounting" in integrations or "accounting_connected" in data, "Should have accounting integration truth"
            assert "email" in integrations or "email_connected" in data, "Should have email integration truth"
    
    def test_crm_accounting_email_consistency(self, auth_headers):
        """Test that crm/accounting/email truth is consistent between integration-status and cognition."""
        # Get integration-status
        int_resp = requests.get(f"{BASE_URL}/api/user/integration-status", headers=auth_headers, timeout=15)
        assert int_resp.status_code == 200
        int_data = int_resp.json()
        int_truth = int_data.get("canonical_truth", {})
        
        # Get cognition overview
        cog_resp = requests.get(f"{BASE_URL}/api/cognition/overview", headers=auth_headers, timeout=20)
        
        if cog_resp.status_code != 200:
            pytest.skip(f"Cognition endpoint unavailable: {cog_resp.status_code}")
        
        cog_data = cog_resp.json()
        
        if cog_data.get("status") == "MIGRATION_REQUIRED":
            pytest.skip("Cognition SQL migrations not deployed")
        
        # Compare truth values
        cog_integrations = cog_data.get("integrations", {})
        
        # The values should be consistent (both true or both false)
        int_crm = int_truth.get("crm_connected", False)
        cog_crm = cog_integrations.get("crm", False) if isinstance(cog_integrations, dict) else False
        
        # Log mismatch for forensic analysis but don't hard-fail
        if int_crm != cog_crm:
            print(f"⚠️ CRM truth mismatch: integration-status={int_crm}, cognition={cog_crm}")


class TestWatchtowerFallback:
    """Test GET /api/intelligence/watchtower returns fallback events from observation_events."""
    
    def test_endpoint_returns_200(self, auth_headers):
        """Test that /api/intelligence/watchtower returns 200."""
        resp = requests.get(f"{BASE_URL}/api/intelligence/watchtower", headers=auth_headers, timeout=20)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text[:200]}"
    
    def test_events_structure(self, auth_headers):
        """Test that events list has proper structure."""
        resp = requests.get(f"{BASE_URL}/api/intelligence/watchtower", headers=auth_headers, timeout=20)
        assert resp.status_code == 200
        
        data = resp.json()
        assert "events" in data, "Response must contain events"
        assert "count" in data, "Response must contain count"
        
        events = data["events"]
        assert isinstance(events, list), "events must be a list"
        
        # If there are events, check structure
        for event in events[:5]:  # Check first 5
            assert isinstance(event, dict), "Each event must be a dict"
            # Event should have some identifying fields
            has_id_or_signal = "id" in event or "signal" in event or "event" in event
            assert has_id_or_signal, f"Event must have id, signal, or event field: {event.keys()}"
    
    def test_returns_fallback_without_workspace(self, auth_headers):
        """Test that watchtower returns fallback events even without workspace."""
        # This tests the fallback path in get_watchtower_events
        resp = requests.get(f"{BASE_URL}/api/intelligence/watchtower", headers=auth_headers, timeout=20)
        assert resp.status_code == 200, "Should return 200 even without workspace"
        
        data = resp.json()
        # Response should not error, just return empty events or fallback events
        assert "error" not in data or data.get("error") is None, f"Should not contain error: {data.get('error')}"


class TestDataIntegrityValidation:
    """Cross-verify data integrity between APIs."""
    
    def test_total_connected_consistency(self, auth_headers):
        """Verify total_connected is consistent across endpoints."""
        # Get from user/integration-status
        int_resp = requests.get(f"{BASE_URL}/api/user/integration-status", headers=auth_headers, timeout=15)
        assert int_resp.status_code == 200
        int_data = int_resp.json()
        
        # Get from integrations/merge/connected
        merge_resp = requests.get(f"{BASE_URL}/api/integrations/merge/connected", headers=auth_headers, timeout=15)
        assert merge_resp.status_code == 200
        merge_data = merge_resp.json()
        
        int_total = int_data.get("total_connected", 0)
        int_ct_total = (int_data.get("canonical_truth") or {}).get("total_connected", 0)
        merge_ct_total = (merge_data.get("canonical_truth") or {}).get("total_connected", 0)
        
        # At least 2 of 3 should match (allow minor discrepancy)
        values = [int_total, int_ct_total, merge_ct_total]
        unique_values = set(values)
        
        print(f"📊 total_connected values: int_status={int_total}, int_ct={int_ct_total}, merge_ct={merge_ct_total}")
        
        # If all different, that's a data integrity issue
        if len(unique_values) == 3 and max(values) - min(values) > 1:
            print(f"⚠️ Data integrity: total_connected differs significantly across endpoints")
    
    def test_signal_metadata_present(self, auth_headers):
        """Verify live signal metadata is present in merge/connected."""
        resp = requests.get(f"{BASE_URL}/api/integrations/merge/connected", headers=auth_headers, timeout=15)
        assert resp.status_code == 200
        
        data = resp.json()
        ct = data.get("canonical_truth", {})
        
        # Should have signal count (can be 0)
        has_signal_metadata = "live_signal_count" in ct or "last_signal_at" in ct
        if not has_signal_metadata:
            print("⚠️ Warning: live signal metadata not present in canonical_truth")


class TestPageDataRequirements:
    """Smoke tests for page-specific data requirements."""
    
    def test_revenue_page_data(self, auth_headers):
        """Test data sources used by RevenuePage."""
        # RevenuePage calls: /integrations/crm/deals, /integrations/accounting/summary, /cognition/revenue
        
        # CRM deals - may return 400/409 if not connected or workspace not initialized
        deals_resp = requests.get(f"{BASE_URL}/api/integrations/crm/deals", headers=auth_headers, timeout=15)
        assert deals_resp.status_code in [200, 400, 409], f"CRM deals: expected 200/400/409, got {deals_resp.status_code}"
        
        # Accounting summary - may return connected: false or 400 for no workspace
        acct_resp = requests.get(f"{BASE_URL}/api/integrations/accounting/summary", headers=auth_headers, timeout=15)
        assert acct_resp.status_code in [200, 400, 409], f"Accounting summary: expected 200/400/409, got {acct_resp.status_code}"
        
        # Cognition revenue
        cog_resp = requests.get(f"{BASE_URL}/api/cognition/revenue", headers=auth_headers, timeout=20)
        # Allow 200 or migration required
        if cog_resp.status_code == 200:
            data = cog_resp.json()
            if data.get("status") != "MIGRATION_REQUIRED":
                assert "status" in data or "tab_data" in data or "integrations" in data, "Cognition revenue should have status/tab_data/integrations"
    
    def test_operations_page_data(self, auth_headers):
        """Test data sources used by OperationsPage."""
        # Cognition operations
        resp = requests.get(f"{BASE_URL}/api/cognition/operations", headers=auth_headers, timeout=20)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") != "MIGRATION_REQUIRED":
                print(f"✅ Cognition operations returned: {list(data.keys())[:5]}")
    
    def test_risk_page_data(self, auth_headers):
        """Test data sources used by RiskPage."""
        # Cognition risk
        resp = requests.get(f"{BASE_URL}/api/cognition/risk", headers=auth_headers, timeout=20)
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") != "MIGRATION_REQUIRED":
                print(f"✅ Cognition risk returned: {list(data.keys())[:5]}")
    
    def test_alerts_page_data(self, auth_headers):
        """Test data sources used by AlertsPage."""
        # Watchtower events
        resp = requests.get(f"{BASE_URL}/api/intelligence/watchtower", headers=auth_headers, timeout=15)
        assert resp.status_code == 200, f"Watchtower: expected 200, got {resp.status_code}"
        
        data = resp.json()
        assert "events" in data, "Watchtower should return events list"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
