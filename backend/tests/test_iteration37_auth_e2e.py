"""
Iteration 37 E2E Test: Auth Crisis Fix Verification
Tests the critical auth bug fix where supabase_admin was None due to Python import binding.
Fix: Changed 'from supabase_client import supabase_admin' to 'from supabase_client import init_supabase; supabase_admin = init_supabase()'
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://intelligence-hub-12.preview.emergentagent.com').rstrip('/')

# Test credentials created by main agent
TEST_EMAIL = "e2e-rca-test@test.com"
TEST_PASSWORD = "Sovereign!Test2026#"


class TestHealthEndpoints:
    """Health check endpoints - no auth required"""
    
    def test_api_health(self):
        """GET /api/health returns 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"


class TestUnauthenticatedAccess:
    """Protected endpoints should return 401 without token"""
    
    def test_calibration_status_requires_auth(self):
        """GET /api/calibration/status returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/calibration/status")
        assert response.status_code in [401, 403]
        
    def test_business_profile_requires_auth(self):
        """GET /api/business-profile returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/business-profile")
        assert response.status_code in [401, 403]
        
    def test_dashboard_stats_requires_auth(self):
        """GET /api/dashboard/stats returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code in [401, 403]


class TestAuthFlow:
    """Authentication flow tests"""
    
    def test_login_success(self):
        """POST /api/auth/supabase/login returns token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "message" in data
        assert data["message"] == "Login successful"
        assert "user" in data
        assert "session" in data
        assert "access_token" in data["session"]
        assert len(data["session"]["access_token"]) > 50  # JWT tokens are long
        
    def test_login_invalid_credentials(self):
        """POST /api/auth/supabase/login with wrong credentials returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json={"email": "wrong@test.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401
        
    def test_oauth_google_url(self):
        """GET /api/auth/supabase/oauth/google returns OAuth URL"""
        response = requests.get(f"{BASE_URL}/api/auth/supabase/oauth/google")
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "provider" in data
        assert data["provider"] == "google"
        assert "supabase.co" in data["url"]


class TestAuthenticatedEndpoints:
    """CRITICAL: Tests for authenticated endpoint access after auth fix"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Get auth token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip("Could not authenticate - skipping authenticated tests")
        self.token = response.json()["session"]["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_calibration_status_with_auth(self):
        """CRITICAL: GET /api/calibration/status with valid token returns 200 (NOT 401)"""
        response = requests.get(
            f"{BASE_URL}/api/calibration/status",
            headers=self.headers
        )
        # This is the critical test - it was returning 401 before the fix
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "status" in data
        
    def test_business_profile_with_auth(self):
        """CRITICAL: GET /api/business-profile with valid token returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/business-profile",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "user_id" in data
        
    def test_dashboard_stats_with_auth(self):
        """CRITICAL: GET /api/dashboard/stats with valid token returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
    def test_soundboard_conversations_with_auth(self):
        """GET /api/soundboard/conversations with valid token returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/soundboard/conversations",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "conversations" in data
        
    def test_onboarding_status_with_auth(self):
        """GET /api/onboarding/status with valid token returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/onboarding/status",
            headers=self.headers
        )
        assert response.status_code == 200
        
    def test_baseline_with_auth(self):
        """GET /api/baseline with valid token returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/baseline",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "baseline" in data
        
    def test_auth_me_endpoint(self):
        """GET /api/auth/supabase/me returns current user"""
        response = requests.get(
            f"{BASE_URL}/api/auth/supabase/me",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
