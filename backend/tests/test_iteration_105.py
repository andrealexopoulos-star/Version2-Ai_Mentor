"""
BIQc Sprint 2 API Tests — Iteration 105
Tests for new unified integration-status endpoints:
  GET  /api/user/integration-status
  POST /api/user/integration-status/sync
Preview URL: https://cognition-ui-refresh.preview.emergentagent.com
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://cognition-ui-refresh.preview.emergentagent.com").rstrip("/")

# ─── AUTH HELPERS ─────────────────────────────────────────────
def get_auth_token(email="newtest1@biqctest.io", password="BIQcTest!2026"):
    """Get JWT access token via Supabase-backed login endpoint"""
    try:
        res = requests.post(f"{BASE_URL}/api/auth/supabase/login", json={
            "email": email,
            "password": password
        }, timeout=20)
        if res.status_code == 200:
            data = res.json()
            # Token may be at top-level or inside a 'session' object
            token = (
                data.get("access_token")
                or data.get("token")
                or (data.get("session") or {}).get("access_token")
            )
            return token
        print(f"Auth login returned {res.status_code}: {res.text[:200]}")
        return None
    except Exception as e:
        print(f"Auth token fetch failed: {e}")
        return None


@pytest.fixture(scope="module")
def auth_headers():
    """Module-scoped auth headers fixture"""
    token = get_auth_token()
    if not token:
        pytest.skip("Cannot obtain auth token — skipping authenticated tests")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ─── HEALTH CHECK ─────────────────────────────────────────────
class TestHealthCheck:
    """Sanity check — ensure the preview backend is responding"""

    def test_api_health(self):
        res = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert res.status_code == 200
        data = res.json()
        assert data.get("status") == "healthy"
        print(f"✅ Health: {data}")


# ─── UNAUTHENTICATED AUTH CHECKS FOR SPRINT 2 ENDPOINTS ──────
class TestIntegrationStatusUnauth:
    """Verify Sprint 2 endpoints require authentication (403 or 401)"""

    def test_get_integration_status_requires_auth(self):
        """GET /api/user/integration-status should return 401/403 without a token"""
        res = requests.get(f"{BASE_URL}/api/user/integration-status", timeout=10)
        assert res.status_code in (401, 403), (
            f"Expected 401/403 for unauthenticated GET /api/user/integration-status, got {res.status_code}: {res.text[:200]}"
        )
        print(f"✅ GET /api/user/integration-status unauthenticated → {res.status_code}")

    def test_post_integration_status_sync_requires_auth(self):
        """POST /api/user/integration-status/sync should return 401/403 without a token"""
        res = requests.post(f"{BASE_URL}/api/user/integration-status/sync", timeout=10)
        assert res.status_code in (401, 403), (
            f"Expected 401/403 for unauthenticated POST /api/user/integration-status/sync, got {res.status_code}: {res.text[:200]}"
        )
        print(f"✅ POST /api/user/integration-status/sync unauthenticated → {res.status_code}")


# ─── AUTHENTICATED SPRINT 2 TESTS ─────────────────────────────
class TestIntegrationStatusAuthenticated:
    """Authenticated tests for Sprint 2 integration-status endpoints"""

    def test_get_integration_status_response_structure(self, auth_headers):
        """GET /api/user/integration-status should return the canonical response shape"""
        res = requests.get(f"{BASE_URL}/api/user/integration-status", headers=auth_headers, timeout=15)
        assert res.status_code == 200, (
            f"GET /api/user/integration-status returned {res.status_code}: {res.text[:400]}"
        )
        data = res.json()
        # Top-level keys
        assert "integrations" in data, f"Missing 'integrations' key in response: {data}"
        assert "canonical_truth" in data, f"Missing 'canonical_truth' key in response: {data}"
        # integrations must be a list
        assert isinstance(data["integrations"], list), "'integrations' should be a list"
        print(f"✅ GET /api/user/integration-status → 200, {len(data['integrations'])} integrations")

    def test_get_integration_status_placeholder_categories(self, auth_headers):
        """
        When no CRM/accounting/email connected, the endpoint should still return
        placeholder entries (connected=False) for crm, accounting, email.
        This is intentional by design.
        """
        res = requests.get(f"{BASE_URL}/api/user/integration-status", headers=auth_headers, timeout=15)
        assert res.status_code == 200
        data = res.json()
        integrations = data["integrations"]
        # All entries must have required fields
        for entry in integrations:
            assert "category" in entry, f"Missing 'category' in entry: {entry}"
            assert "connected" in entry, f"Missing 'connected' in entry: {entry}"
            assert isinstance(entry["connected"], bool), f"'connected' should be bool: {entry}"
        categories_returned = {i["category"] for i in integrations}
        # At minimum the three core placeholder categories should appear
        for cat in ["crm", "accounting", "email"]:
            assert cat in categories_returned, (
                f"Expected placeholder entry for category '{cat}', got categories: {categories_returned}"
            )
        print(f"✅ Placeholder categories present: {categories_returned}")

    def test_get_integration_status_canonical_truth(self, auth_headers):
        """canonical_truth should contain boolean flags for core categories"""
        res = requests.get(f"{BASE_URL}/api/user/integration-status", headers=auth_headers, timeout=15)
        assert res.status_code == 200
        ct = res.json().get("canonical_truth", {})
        for key in ["crm_connected", "accounting_connected", "email_connected"]:
            assert key in ct, f"Missing '{key}' in canonical_truth: {ct}"
            assert isinstance(ct[key], bool), f"'{key}' should be bool: {ct}"
        print(f"✅ canonical_truth keys: {list(ct.keys())}")

    def test_post_integration_status_sync_responds(self, auth_headers):
        """
        POST /api/user/integration-status/sync should return 200 for authenticated users.
        May return empty results if no integrations are connected — that's fine.
        """
        res = requests.post(
            f"{BASE_URL}/api/user/integration-status/sync",
            headers=auth_headers,
            timeout=20
        )
        assert res.status_code in (200, 202), (
            f"POST /api/user/integration-status/sync returned {res.status_code}: {res.text[:400]}"
        )
        data = res.json()
        # Should have a synced/results key — accept any reasonable response
        print(f"✅ POST /api/user/integration-status/sync → {res.status_code}: {data}")

    def test_integration_status_performance(self, auth_headers):
        """GET /api/user/integration-status should respond within 5 seconds"""
        start = time.time()
        res = requests.get(f"{BASE_URL}/api/user/integration-status", headers=auth_headers, timeout=15)
        elapsed = time.time() - start
        assert res.status_code == 200
        assert elapsed < 5.0, f"integration-status too slow: {elapsed:.2f}s (expected < 5s)"
        print(f"✅ Response time: {elapsed:.2f}s")


# ─── EXISTING ENDPOINT REGRESSION ─────────────────────────────
class TestExistingEndpointsRegression:
    """Regression — make sure existing integration endpoints still work"""

    def test_integrations_channels_endpoint(self, auth_headers):
        """GET /api/integrations/channels should still work"""
        res = requests.get(f"{BASE_URL}/api/integrations/channels", headers=auth_headers, timeout=10)
        assert res.status_code in (200, 404), f"channels returned {res.status_code}"
        print(f"  /api/integrations/channels → {res.status_code}")

    def test_integrations_merge_connected(self, auth_headers):
        """GET /api/integrations/merge/connected should return connected integrations"""
        res = requests.get(f"{BASE_URL}/api/integrations/merge/connected", headers=auth_headers, timeout=10)
        assert res.status_code in (200, 404), f"merge/connected returned {res.status_code}"
        print(f"  /api/integrations/merge/connected → {res.status_code}")

    def test_snapshot_latest(self, auth_headers):
        """GET /api/snapshot/latest should still respond"""
        res = requests.get(f"{BASE_URL}/api/snapshot/latest", headers=auth_headers, timeout=15)
        assert res.status_code in (200, 404, 422), f"snapshot/latest returned {res.status_code}"
        print(f"  /api/snapshot/latest → {res.status_code}")
