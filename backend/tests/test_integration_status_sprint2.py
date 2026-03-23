"""
Sprint 2: Integration Status Endpoint Tests
Tests for /api/user/integration-status and /api/user/integration-status/sync
"""
import pytest
import httpx
import os

BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or os.environ.get("BACKEND_URL")
    or os.environ.get("BACKEND_BASE_URL")
    or "http://localhost:8001"
).rstrip("/")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://vwwandhoydemcybltoxz.supabase.co")


def get_auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestIntegrationStatusEndpoint:
    """Tests for the unified integration status endpoint."""
    
    def test_endpoint_requires_auth(self):
        """GET /api/user/integration-status should return 403 without auth."""
        response = httpx.get(f"{BASE_URL}/api/user/integration-status")
        assert response.status_code in (401, 403), f"Expected auth error, got {response.status_code}"

    def test_sync_endpoint_requires_auth(self):
        """POST /api/user/integration-status/sync should return 403 without auth."""
        response = httpx.post(f"{BASE_URL}/api/user/integration-status/sync")
        assert response.status_code in (401, 403), f"Expected auth error, got {response.status_code}"

    def test_endpoint_response_shape(self, auth_token: str = None):
        """With valid auth, response should have 'integrations' and 'canonical_truth' keys."""
        if not auth_token:
            pytest.skip("No auth token provided")
        
        response = httpx.get(
            f"{BASE_URL}/api/user/integration-status",
            headers=get_auth_headers(auth_token)
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "integrations" in data, "Response should have 'integrations' key"
        assert "canonical_truth" in data, "Response should have 'canonical_truth' key"
        
        canonical = data["canonical_truth"]
        assert "crm_connected" in canonical
        assert "accounting_connected" in canonical
        assert "email_connected" in canonical
        assert "total_connected" in canonical

    def test_integration_items_shape(self, auth_token: str = None):
        """Each integration item should have required fields."""
        if not auth_token:
            pytest.skip("No auth token provided")
        
        response = httpx.get(
            f"{BASE_URL}/api/user/integration-status",
            headers=get_auth_headers(auth_token)
        )
        assert response.status_code == 200
        data = response.json()
        
        for item in data["integrations"]:
            assert "integration_name" in item
            assert "category" in item
            assert "connected" in item
            assert "records_count" in item
            # connected items must have a provider
            if item["connected"]:
                assert item.get("provider") is not None

    def test_not_connected_placeholders_present(self, auth_token: str = None):
        """Unconnected core categories should appear as placeholders."""
        if not auth_token:
            pytest.skip("No auth token provided")
        
        response = httpx.get(
            f"{BASE_URL}/api/user/integration-status",
            headers=get_auth_headers(auth_token)
        )
        assert response.status_code == 200
        data = response.json()
        
        categories = {i["category"] for i in data["integrations"]}
        # Core categories should always be present
        for cat in ["crm", "accounting", "email"]:
            assert cat in categories, f"Category '{cat}' should always be in response"


if __name__ == "__main__":
    # Quick smoke test
    import sys
    BASE_URL = "http://localhost:8001"
    
    print("Testing /api/user/integration-status (no auth)...")
    r = httpx.get(f"{BASE_URL}/api/user/integration-status")
    print(f"  Status: {r.status_code} (expected 403)")
    assert r.status_code in (401, 403), f"FAIL: got {r.status_code}"
    
    print("Testing /api/user/integration-status/sync (no auth)...")
    r = httpx.post(f"{BASE_URL}/api/user/integration-status/sync")
    print(f"  Status: {r.status_code} (expected 403)")
    assert r.status_code in (401, 403), f"FAIL: got {r.status_code}"
    
    print("✅ All auth checks passed!")
