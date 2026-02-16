"""
Iteration 38 Tests: Titan Glass Theme & Health Monitoring
- Tests new health monitoring endpoints
- Verifies backend health module integration
- Tests API health responses
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthEndpoints:
    """Tests for new health monitoring endpoints added in iteration 38"""
    
    def test_basic_health(self):
        """Test GET /api/health returns healthy"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("PASS: /api/health returns healthy status")
    
    def test_detailed_health(self):
        """Test GET /api/health/detailed returns JSON with all status fields"""
        response = requests.get(f"{BASE_URL}/api/health/detailed", timeout=15)
        assert response.status_code == 200
        data = response.json()
        
        # Verify all required fields exist
        assert "timestamp" in data, "Missing timestamp field"
        assert "api" in data, "Missing api field"
        assert "supabase" in data, "Missing supabase field"
        assert "workers" in data, "Missing workers field"
        assert "integrations" in data, "Missing integrations field"
        assert "overall" in data, "Missing overall field"
        
        # Verify API status
        assert data["api"].get("status") == "healthy", "API should be healthy"
        
        # Verify supabase structure
        assert "status" in data["supabase"], "Supabase should have status"
        assert "reachable" in data["supabase"], "Supabase should have reachable flag"
        
        # Verify workers structure
        assert "email_sync" in data["workers"], "Missing email_sync worker"
        assert "intelligence" in data["workers"], "Missing intelligence worker"
        
        # Verify integrations structure
        assert "openai" in data["integrations"], "Missing openai integration"
        assert "supabase_url" in data["integrations"], "Missing supabase_url integration"
        assert "serper" in data["integrations"], "Missing serper integration"
        
        print(f"PASS: /api/health/detailed returns all fields, overall: {data['overall']}")
    
    def test_workers_health(self):
        """Test GET /api/health/workers returns worker status"""
        response = requests.get(f"{BASE_URL}/api/health/workers", timeout=10)
        assert response.status_code == 200
        data = response.json()
        
        # Verify worker fields
        assert "email_sync" in data, "Missing email_sync worker"
        assert "intelligence" in data, "Missing intelligence worker"
        assert "timestamp" in data, "Missing timestamp"
        
        # Each worker should have status and detail
        for worker in ["email_sync", "intelligence"]:
            assert "status" in data[worker], f"{worker} should have status"
            assert "detail" in data[worker] or "error" in data[worker], f"{worker} should have detail or error"
        
        print("PASS: /api/health/workers returns worker statuses")


class TestRefactoredAICore:
    """Tests to verify ai_core.py refactoring didn't break anything"""
    
    def test_api_root(self):
        """Test GET /api/ returns version info"""
        response = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "version" in data or "message" in data
        print("PASS: /api/ returns API info")
    
    def test_calibration_status_unauthenticated(self):
        """Test GET /api/calibration/status returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/calibration/status", timeout=10)
        assert response.status_code == 401
        print("PASS: /api/calibration/status returns 401 without auth")


class TestAuthEndpointsExist:
    """Verify auth endpoints exist and respond correctly"""
    
    def test_login_endpoint_exists(self):
        """Test POST /api/auth/supabase/login returns 4xx (not 404)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json={"email": "invalid@test.com", "password": "invalid"},
            timeout=10
        )
        # Should return 400 or 401, not 404
        assert response.status_code != 404, "Login endpoint should exist"
        assert response.status_code in [400, 401, 422]
        print(f"PASS: /api/auth/supabase/login exists (returns {response.status_code})")
    
    def test_register_endpoint_exists(self):
        """Test POST /api/auth/supabase/register returns 4xx (not 404)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/register",
            json={
                "email": f"TEST_fake_{os.urandom(4).hex()}@test.com",
                "password": "TestPass123!",
                "full_name": "TEST User"
            },
            timeout=10
        )
        # Should return validation error or success, not 404
        assert response.status_code != 404, "Register endpoint should exist"
        print(f"PASS: /api/auth/supabase/register exists (returns {response.status_code})")
    
    def test_oauth_google_url_endpoint_exists(self):
        """Test GET /api/auth/supabase/oauth/google returns URL"""
        response = requests.get(f"{BASE_URL}/api/auth/supabase/oauth/google", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert "url" in data, "Should return OAuth URL"
        print("PASS: /api/auth/supabase/oauth/google returns URL")


class TestAuthenticatedEndpoints:
    """Test authenticated endpoints with real credentials"""
    
    @pytest.fixture
    def auth_token(self):
        """Login and get valid token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json={
                "email": "e2e-rca-test@test.com",
                "password": "Sovereign!Test2026#"
            },
            timeout=15
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token")
        pytest.skip("Could not authenticate - skipping authenticated tests")
    
    def test_calibration_status_authenticated(self, auth_token):
        """Test GET /api/calibration/status returns 200 with auth"""
        response = requests.get(
            f"{BASE_URL}/api/calibration/status",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        print(f"PASS: /api/calibration/status returns {data.get('status')} with auth")
    
    def test_business_profile_authenticated(self, auth_token):
        """Test GET /api/business-profile returns 200 with auth"""
        response = requests.get(
            f"{BASE_URL}/api/business-profile",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        assert response.status_code == 200
        print("PASS: /api/business-profile returns 200 with auth")
    
    def test_auth_me_authenticated(self, auth_token):
        """Test GET /api/auth/supabase/me returns user"""
        response = requests.get(
            f"{BASE_URL}/api/auth/supabase/me",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        print(f"PASS: /api/auth/supabase/me returns user email: {data.get('email')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
