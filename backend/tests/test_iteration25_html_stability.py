"""
Iteration 25: Platform Stability RCA Test
Tests: ALL 6 previously-failing endpoints return JSON (NOT HTML)
Root cause: Stale service workers were intercepting API requests and serving cached HTML

Endpoints under test:
1. /api/calibration/status
2. /api/intelligence/baseline-snapshot
3. /api/outlook/status
4. /api/facts/resolve
5. /api/lifecycle/state
6. /api/intelligence/watchtower?status=active
7. /api/watchtower/positions
8. /api/watchtower/findings
9. /api/boardroom/respond
10. /api/soundboard/chat
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "Biqc#Cert2026!xQ9z"


class TestHtmlVsJsonStability:
    """
    Tests that ALL API endpoints return application/json, NOT text/html.
    This is the core fix validation for the service worker caching issue.
    """

    @pytest.fixture(scope="class")
    def auth_token(self):
        """Authenticate and get Supabase access token"""
        supabase_url = os.environ.get("SUPABASE_URL", os.environ.get("REACT_APP_SUPABASE_URL", ""))
        supabase_key = os.environ.get("SUPABASE_ANON_KEY", "")

        if not supabase_url or not supabase_key:
            pytest.skip("Supabase URL/key unavailable in CI; skipping auth-required stability endpoints")

        try:
            from supabase import create_client
            client = create_client(supabase_url, supabase_key)
            response = client.auth.sign_in_with_password({
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            })
        except Exception as exc:
            pytest.skip(f"Supabase auth unavailable in CI: {exc}")

        if response.session and response.session.access_token:
            return response.session.access_token
        pytest.skip("Authentication failed - cannot get access token")

    def _make_request(self, endpoint, method="GET", auth_token=None, json_data=None):
        """Helper to make requests with cache-busting headers"""
        url = f"{BASE_URL}{endpoint}"
        headers = {
            "Accept": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache"
        }
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"

        if method == "GET":
            return requests.get(url, headers=headers, timeout=30)
        elif method == "POST":
            headers["Content-Type"] = "application/json"
            return requests.post(url, headers=headers, json=json_data, timeout=30)

    def _assert_json_response(self, response, endpoint):
        """Assert response is JSON, not HTML"""
        content_type = response.headers.get('content-type', '')
        
        # Check content-type is application/json
        assert 'application/json' in content_type, \
            f"CRITICAL: {endpoint} returned content-type '{content_type}' instead of 'application/json'. " \
            f"This indicates HTML being served. Response: {response.text[:200]}"
        
        # Verify response body is valid JSON
        try:
            data = response.json()
            return data
        except json.JSONDecodeError:
            pytest.fail(f"CRITICAL: {endpoint} content-type is JSON but body is not valid JSON: {response.text[:200]}")

    # ═══════════════════════════════════════════════════════════════════════════
    # CORE STABILITY TESTS: 6 Originally Failing Endpoints
    # ═══════════════════════════════════════════════════════════════════════════

    def test_01_calibration_status_returns_json(self, auth_token):
        """GET /api/calibration/status returns JSON with status field"""
        response = self._make_request("/api/calibration/status", auth_token=auth_token)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = self._assert_json_response(response, "/api/calibration/status")
        assert "status" in data, f"Response missing 'status' field: {data}"
        print(f"✅ /api/calibration/status → JSON ({data.get('status', 'N/A')})")

    def test_02_intelligence_baseline_snapshot_returns_json(self, auth_token):
        """GET /api/intelligence/baseline-snapshot returns JSON with snapshot data"""
        response = self._make_request("/api/intelligence/baseline-snapshot", auth_token=auth_token)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = self._assert_json_response(response, "/api/intelligence/baseline-snapshot")
        # baseline-snapshot should return object with snapshot data
        assert isinstance(data, dict), f"Expected dict response, got {type(data)}"
        print(f"✅ /api/intelligence/baseline-snapshot → JSON (keys: {list(data.keys())[:5]})")

    def test_03_outlook_status_returns_json(self, auth_token):
        """GET /api/outlook/status returns JSON with connected field"""
        response = self._make_request("/api/outlook/status", auth_token=auth_token)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = self._assert_json_response(response, "/api/outlook/status")
        assert "connected" in data, f"Response missing 'connected' field: {data}"
        print(f"✅ /api/outlook/status → JSON (connected: {data.get('connected')})")

    def test_04_facts_resolve_returns_json(self, auth_token):
        """GET /api/facts/resolve returns JSON with facts data"""
        response = self._make_request("/api/facts/resolve", auth_token=auth_token)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = self._assert_json_response(response, "/api/facts/resolve")
        # facts/resolve should return list or object with facts
        assert isinstance(data, (dict, list)), f"Expected dict/list, got {type(data)}"
        print(f"✅ /api/facts/resolve → JSON (type: {type(data).__name__})")

    def test_05_lifecycle_state_returns_json(self, auth_token):
        """GET /api/lifecycle/state returns JSON with calibration and workspace data"""
        response = self._make_request("/api/lifecycle/state", auth_token=auth_token)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = self._assert_json_response(response, "/api/lifecycle/state")
        assert isinstance(data, dict), f"Expected dict response, got {type(data)}"
        print(f"✅ /api/lifecycle/state → JSON (keys: {list(data.keys())[:5]})")

    def test_06_intelligence_watchtower_active_returns_json(self, auth_token):
        """GET /api/intelligence/watchtower?status=active returns JSON with events array"""
        response = self._make_request("/api/intelligence/watchtower?status=active", auth_token=auth_token)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = self._assert_json_response(response, "/api/intelligence/watchtower?status=active")
        # Should return events array or object containing events
        assert isinstance(data, (dict, list)), f"Expected dict/list, got {type(data)}"
        print(f"✅ /api/intelligence/watchtower?status=active → JSON")

    # ═══════════════════════════════════════════════════════════════════════════
    # ADDITIONAL ENDPOINT TESTS
    # ═══════════════════════════════════════════════════════════════════════════

    def test_07_watchtower_positions_returns_json(self, auth_token):
        """GET /api/watchtower/positions returns JSON with positions object"""
        response = self._make_request("/api/watchtower/positions", auth_token=auth_token)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = self._assert_json_response(response, "/api/watchtower/positions")
        assert isinstance(data, dict), f"Expected dict response, got {type(data)}"
        print(f"✅ /api/watchtower/positions → JSON (keys: {list(data.keys())[:5]})")

    def test_08_watchtower_findings_returns_json(self, auth_token):
        """GET /api/watchtower/findings returns JSON with findings array"""
        response = self._make_request("/api/watchtower/findings", auth_token=auth_token)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = self._assert_json_response(response, "/api/watchtower/findings")
        assert isinstance(data, (dict, list)), f"Expected dict/list, got {type(data)}"
        print(f"✅ /api/watchtower/findings → JSON")

    def test_09_boardroom_respond_returns_json(self, auth_token):
        """POST /api/boardroom/respond returns JSON with response field"""
        payload = {
            "message": "What is the current status of sales?",
            "history": []
        }
        response = self._make_request("/api/boardroom/respond", method="POST", 
                                       auth_token=auth_token, json_data=payload)
        # Allow both 200 and 520 (handled gracefully)
        assert response.status_code in [200, 520], f"Expected 200/520, got {response.status_code}"
        data = self._assert_json_response(response, "/api/boardroom/respond")
        assert isinstance(data, dict), f"Expected dict response, got {type(data)}"
        print(f"✅ /api/boardroom/respond → JSON (status: {response.status_code})")

    def test_10_soundboard_chat_returns_json(self, auth_token):
        """POST /api/soundboard/chat with null conversation_id returns JSON"""
        payload = {
            "message": "Hello, test message",
            "conversation_id": None
        }
        response = self._make_request("/api/soundboard/chat", method="POST",
                                       auth_token=auth_token, json_data=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = self._assert_json_response(response, "/api/soundboard/chat")
        # Should have reply and conversation_id
        assert "reply" in data or "response" in data or "message" in data, \
            f"Response missing reply field: {data}"
        print(f"✅ /api/soundboard/chat → JSON")

    # ═══════════════════════════════════════════════════════════════════════════
    # AUTH ENDPOINT TESTS
    # ═══════════════════════════════════════════════════════════════════════════

    def test_11_auth_me_returns_json(self, auth_token):
        """GET /api/auth/supabase/me returns JSON with user data"""
        response = self._make_request("/api/auth/supabase/me", auth_token=auth_token)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = self._assert_json_response(response, "/api/auth/supabase/me")
        assert "user" in data or "email" in data, f"Response missing user data: {data}"
        print(f"✅ /api/auth/supabase/me → JSON")

    def test_12_onboarding_status_returns_json(self, auth_token):
        """GET /api/onboarding/status returns JSON"""
        response = self._make_request("/api/onboarding/status", auth_token=auth_token)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = self._assert_json_response(response, "/api/onboarding/status")
        assert isinstance(data, dict), f"Expected dict response, got {type(data)}"
        print(f"✅ /api/onboarding/status → JSON")


class TestNoAuthEndpoints:
    """Test endpoints that don't require authentication still return JSON"""

    def test_health_check_returns_json(self):
        """GET /api/health returns JSON"""
        url = f"{BASE_URL}/api/health"
        response = requests.get(url, headers={
            "Accept": "application/json",
            "Cache-Control": "no-cache"
        }, timeout=10)
        assert response.status_code == 200
        content_type = response.headers.get('content-type', '')
        assert 'application/json' in content_type, f"Health check returned {content_type}"
        print(f"✅ /api/health → JSON")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
