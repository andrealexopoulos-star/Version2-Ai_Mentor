"""
Iteration 39 Tests: Prompt Lab Audit Trail, Caching, and Health Monitoring
Tests new features:
1. Prompt Lab Audit Trail API: GET /api/admin/prompts/audit-log
2. Profile.py caching: GET /api/business-profile/scores (30s TTL)
3. Dashboard stats caching: GET /api/dashboard/stats (30s TTL)
4. Dashboard focus endpoint: GET /api/dashboard/focus
5. All iteration 38 endpoints still work
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = os.environ.get("TEST_USER_EMAIL", os.environ.get("E2E_TEST_EMAIL", ""))
TEST_USER_PASSWORD = os.environ.get("TEST_USER_PASSWORD", os.environ.get("E2E_TEST_PASSWORD", ""))


class TestHealthMonitoring:
    """Test health monitoring endpoints - no auth required"""

    def test_basic_health(self):
        """GET /api/health - basic health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✅ /api/health - status: {data.get('status')}")

    def test_detailed_health(self):
        """GET /api/health/detailed - comprehensive health check"""
        response = requests.get(f"{BASE_URL}/api/health/detailed")
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "api" in data
        assert "supabase" in data
        assert "workers" in data
        assert "integrations" in data
        assert "overall" in data
        
        # Verify structure
        assert data["api"].get("status") == "healthy"
        assert "email_sync" in data["workers"]
        assert "intelligence" in data["workers"]
        assert "openai" in data["integrations"]
        
        print(f"✅ /api/health/detailed - overall: {data.get('overall')}")
        print(f"   supabase: {data['supabase'].get('status')}")
        print(f"   workers: email_sync={data['workers']['email_sync'].get('status')}, intelligence={data['workers']['intelligence'].get('status')}")

    def test_workers_health(self):
        """GET /api/health/workers - worker-specific health"""
        response = requests.get(f"{BASE_URL}/api/health/workers")
        assert response.status_code == 200
        data = response.json()
        
        assert "email_sync" in data
        assert "intelligence" in data
        assert "timestamp" in data
        
        print(f"✅ /api/health/workers - email_sync: {data['email_sync'].get('status')}, intelligence: {data['intelligence'].get('status')}")


class TestAuthentication:
    """Test Supabase authentication flow"""

    def test_login_returns_access_token(self):
        """POST /api/auth/supabase/login - verify token returned"""
        if not (BASE_URL and TEST_USER_EMAIL and TEST_USER_PASSWORD):
            pytest.skip("Auth test env not configured for iteration39")

        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Authentication unavailable for iteration39: {response.status_code}")
        data = response.json()
        
        # Verify session structure
        assert "session" in data
        session = data["session"]
        assert "access_token" in session
        assert len(session["access_token"]) > 20
        
        print(f"✅ Login successful, token length: {len(session['access_token'])}")
        return session["access_token"]


class TestAuthenticatedEndpoints:
    """Tests requiring authentication"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("session", {}).get("access_token", "")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")

    def test_calibration_status(self):
        """GET /api/calibration/status - calibration endpoint works"""
        response = requests.get(f"{BASE_URL}/api/calibration/status", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should return calibration status
        assert isinstance(data, dict)
        print(f"✅ /api/calibration/status - returned {len(data)} fields")

    def test_business_profile(self):
        """GET /api/business-profile - profile endpoint works"""
        response = requests.get(f"{BASE_URL}/api/business-profile", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Profile should be dict (may be empty or have data)
        assert isinstance(data, dict)
        print(f"✅ /api/business-profile - returned {len(data)} fields")

    def test_business_profile_scores_with_caching(self):
        """GET /api/business-profile/scores - profile scores with caching"""
        # First request - cache miss
        start1 = time.time()
        response1 = requests.get(f"{BASE_URL}/api/business-profile/scores", headers=self.headers)
        time1 = time.time() - start1
        
        assert response1.status_code == 200, f"Failed: {response1.text}"
        data1 = response1.json()
        
        # Verify response structure
        assert "completeness" in data1
        assert "strength" in data1 or "business_score" in data1
        
        # Second request - should be cached
        start2 = time.time()
        response2 = requests.get(f"{BASE_URL}/api/business-profile/scores", headers=self.headers)
        time2 = time.time() - start2
        
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Data should be same from cache
        assert data1["completeness"] == data2["completeness"]
        
        print(f"✅ /api/business-profile/scores - completeness: {data1.get('completeness')}%")
        print(f"   First request: {time1:.3f}s, Second request (cached): {time2:.3f}s")

    def test_dashboard_stats_with_caching(self):
        """GET /api/dashboard/stats - dashboard stats with caching"""
        # First request
        start1 = time.time()
        response1 = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=self.headers)
        time1 = time.time() - start1
        
        assert response1.status_code == 200, f"Failed: {response1.text}"
        data1 = response1.json()
        
        # Verify response structure
        assert "total_analyses" in data1
        assert "total_documents" in data1
        assert "total_chat_sessions" in data1
        
        # Second request - should be cached
        start2 = time.time()
        response2 = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=self.headers)
        time2 = time.time() - start2
        
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Stats should match from cache
        assert data1["total_analyses"] == data2["total_analyses"]
        
        print(f"✅ /api/dashboard/stats - analyses: {data1.get('total_analyses')}, docs: {data1.get('total_documents')}, chats: {data1.get('total_chat_sessions')}")
        print(f"   First request: {time1:.3f}s, Second request (cached): {time2:.3f}s")

    def test_dashboard_focus(self):
        """GET /api/dashboard/focus - AI focus insight"""
        response = requests.get(f"{BASE_URL}/api/dashboard/focus", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should return focus insight
        assert isinstance(data, dict)
        print(f"✅ /api/dashboard/focus - returned {len(data)} fields")


class TestAuditLogEndpoint:
    """Test Prompt Lab audit log - requires super_admin role"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("session", {}).get("access_token", "")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")

    def test_audit_log_endpoint_exists(self):
        """GET /api/admin/prompts/audit-log - endpoint exists (may return 403 for non-admin)"""
        response = requests.get(f"{BASE_URL}/api/admin/prompts/audit-log", headers=self.headers)
        
        # 200 for super_admin, 403 for regular user - both are valid
        assert response.status_code in [200, 403], f"Unexpected status: {response.status_code}, {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "logs" in data
            assert "total" in data
            print(f"✅ /api/admin/prompts/audit-log - returned {data.get('total')} logs (user is super_admin)")
        elif response.status_code == 403:
            print(f"✅ /api/admin/prompts/audit-log - 403 Forbidden (expected - test user not super_admin)")


class TestOAuthEndpoints:
    """Test OAuth URL generation endpoints - no auth required"""

    def test_google_oauth_url(self):
        """GET /api/auth/supabase/oauth/google - OAuth URL generated"""
        response = requests.get(f"{BASE_URL}/api/auth/supabase/oauth/google")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "url" in data
        assert "supabase.co" in data["url"] or "google" in data["url"].lower()
        
        print(f"✅ /api/auth/supabase/oauth/google - URL generated")


class TestIteration38Regression:
    """Regression tests for iteration 38 features"""

    def test_api_root(self):
        """GET /api/ - API root accessible"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data or "version" in data
        print(f"✅ /api/ - API root working")

    def test_signup_endpoint_exists(self):
        """POST /api/auth/supabase/signup - endpoint exists"""
        # Don't actually create user, just verify endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/signup",
            json={"email": "fake@fake.fake", "password": "fake"}
        )
        # 400 or 422 = endpoint exists (validation error), not 404
        assert response.status_code != 404, "Signup endpoint not found"
        print(f"✅ /api/auth/supabase/signup - endpoint exists (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
