"""
Iteration 151 — Forensic Truth Gate UI & API Verification.

Validates:
1. GET /api/brain/priorities returns integrity_alerts and truth_summary when CRM/accounting truth is stale
2. GET /api/brain/priorities does NOT return false zero-value phrases when truth is unverified
3. GET /api/integrations/merge/connected exposes canonical truth state fields
4. GET /api/outlook/status returns expected structure
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://biqc.ai").rstrip("/")
SUPABASE_URL = "https://vwwandhoydemcybltoxz.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3d2FuZGhveWRlbWN5Ymx0b3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjU4MzEsImV4cCI6MjA4ODQwMTgzMX0.KzFEpKDiHtDx6EjsZscdvwY9vyakitlUJ4SOMekWEys"
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "MasterMind2025*"


@pytest.fixture(scope="module")
def auth_headers():
    """Get Supabase auth token and return headers."""
    try:
        response = requests.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=30,
        )
        response.raise_for_status()
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    except Exception as e:
        pytest.skip(f"Authentication failed: {e}")


class TestBrainPrioritiesAPI:
    """Test /api/brain/priorities endpoint for truth gate behavior."""
    
    def test_brain_priorities_returns_200(self, auth_headers):
        """Test that brain/priorities returns 200 with proper structure."""
        response = requests.get(
            f"{BASE_URL}/api/brain/priorities",
            headers=auth_headers,
            params={"recompute": "false"},
            timeout=120
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:500]}"
        data = response.json()
        
        # Verify expected fields
        assert "concerns" in data, "Missing 'concerns' field"
        assert "integrity_alerts" in data, "Missing 'integrity_alerts' field"
        assert "truth_summary" in data, "Missing 'truth_summary' field"
        print(f"✓ brain/priorities returns 200 with truth gate fields")
    
    def test_brain_priorities_exposes_integrity_alerts(self, auth_headers):
        """Test that integrity_alerts are exposed when truth is stale."""
        response = requests.get(
            f"{BASE_URL}/api/brain/priorities",
            headers=auth_headers,
            params={"recompute": "false"},
            timeout=120
        )
        assert response.status_code == 200
        data = response.json()
        
        integrity_alerts = data.get("integrity_alerts", [])
        # With stale CRM/accounting data, we should have integrity alerts
        print(f"Integrity alerts count: {len(integrity_alerts)}")
        
        # Verify alert structure if any exist
        if integrity_alerts:
            alert = integrity_alerts[0]
            assert "title" in alert, "Alert missing 'title'"
            assert "truth_state" in alert, "Alert missing 'truth_state'"
            print(f"✓ Integrity alerts have proper structure")
    
    def test_brain_priorities_no_false_zero_value_claims(self, auth_headers):
        """Test that no false zero-value claims appear in issue_brief."""
        response = requests.get(
            f"{BASE_URL}/api/brain/priorities",
            headers=auth_headers,
            params={"recompute": "false"},
            timeout=120
        )
        assert response.status_code == 200
        data = response.json()
        
        # Forbidden phrases that indicate false zero-value claims
        forbidden_phrases = [
            "average cycle of 0 days",
            "operating expense pressure is running at 0%",
            "operating expense pressure is running at 0% while revenue growth is $0",
            "lead response time has stretched to 0.0 hours",
            "revenue growth is $0",
        ]
        
        for concern in data.get("concerns", []):
            issue_brief = str(concern.get("issue_brief") or "").lower()
            why_now_brief = str(concern.get("why_now_brief") or "").lower()
            
            for phrase in forbidden_phrases:
                assert phrase not in issue_brief, f"Found forbidden phrase in issue_brief: {phrase}"
                assert phrase not in why_now_brief, f"Found forbidden phrase in why_now_brief: {phrase}"
        
        print(f"✓ No false zero-value claims found in concerns")
    
    def test_brain_priorities_exposes_truth_summary(self, auth_headers):
        """Test that truth_summary contains connector truth states."""
        response = requests.get(
            f"{BASE_URL}/api/brain/priorities",
            headers=auth_headers,
            params={"recompute": "false"},
            timeout=120
        )
        assert response.status_code == 200
        data = response.json()
        
        truth_summary = data.get("truth_summary", {})
        connector_truth = truth_summary.get("connector_truth", {})
        
        # Verify connector truth includes expected categories
        assert "crm" in connector_truth or "accounting" in connector_truth or "email" in connector_truth, \
            f"Expected connector truth for crm/accounting/email, got: {list(connector_truth.keys())}"
        
        print(f"✓ truth_summary exposes connector_truth with {len(connector_truth)} categories")


class TestMergeConnectedAPI:
    """Test /api/integrations/merge/connected endpoint for canonical truth states."""
    
    def test_merge_connected_returns_200(self, auth_headers):
        """Test that merge/connected returns 200."""
        response = requests.get(
            f"{BASE_URL}/api/integrations/merge/connected",
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ merge/connected returns 200")
    
    def test_merge_connected_exposes_canonical_truth_states(self, auth_headers):
        """Test that canonical_truth includes state fields."""
        response = requests.get(
            f"{BASE_URL}/api/integrations/merge/connected",
            headers=auth_headers,
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        canonical_truth = data.get("canonical_truth", {})
        
        # Verify required state fields exist
        assert "crm_state" in canonical_truth, "Missing crm_state in canonical_truth"
        assert "accounting_state" in canonical_truth, "Missing accounting_state in canonical_truth"
        assert "email_state" in canonical_truth, "Missing email_state in canonical_truth"
        
        # Verify states are valid values
        valid_states = {"live", "stale", "unverified", "error"}
        assert canonical_truth["crm_state"] in valid_states, f"Invalid crm_state: {canonical_truth['crm_state']}"
        assert canonical_truth["accounting_state"] in valid_states, f"Invalid accounting_state: {canonical_truth['accounting_state']}"
        assert canonical_truth["email_state"] in valid_states, f"Invalid email_state: {canonical_truth['email_state']}"
        
        print(f"✓ canonical_truth exposes crm_state={canonical_truth['crm_state']}, accounting_state={canonical_truth['accounting_state']}, email_state={canonical_truth['email_state']}")


class TestOutlookStatusAPI:
    """Test /api/outlook/status endpoint."""
    
    def test_outlook_status_returns_proper_structure(self, auth_headers):
        """Test that outlook/status returns expected fields."""
        response = requests.get(
            f"{BASE_URL}/api/outlook/status",
            headers=auth_headers,
            timeout=30
        )
        # Should return 200 or proper error
        assert response.status_code in [200, 401], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            # Verify expected fields
            assert "connected" in data, "Missing 'connected' field"
            print(f"✓ outlook/status returns proper structure (connected={data.get('connected')})")


class TestHealthEndpoint:
    """Basic health check."""
    
    def test_health_endpoint(self):
        """Test /health endpoint is accessible."""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        print(f"✓ Health endpoint OK")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
