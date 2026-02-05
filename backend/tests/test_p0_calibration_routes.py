"""
P0 Calibration Routes Backend Tests
Tests for the critical calibration-first auth guard bug fix
- Verifies calibration endpoints behave correctly for authenticated/unauthenticated users
- Tests backend health and basic auth endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthEndpoint:
    """Backend health check tests"""
    
    def test_health_returns_200(self):
        """Health endpoint should return 200 with healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy", f"Expected 'healthy', got {data.get('status')}"
        print(f"✅ Health endpoint: {data}")


class TestCalibrationEndpoint:
    """Calibration status endpoint tests - Critical for P0 fix"""
    
    def test_calibration_status_returns_401_unauthenticated(self):
        """
        CRITICAL P0 TEST: /api/calibration/status must return 401 for unauthenticated requests
        This ensures the frontend redirects to login instead of showing AuthError
        """
        response = requests.get(f"{BASE_URL}/api/calibration/status")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Should have detail message"
        print(f"✅ Calibration status (unauthenticated): 401 with message '{data.get('detail')}'")
    
    def test_calibration_status_never_returns_500(self):
        """Backend should never return 500 for calibration status - any auth scenario"""
        response = requests.get(f"{BASE_URL}/api/calibration/status")
        assert response.status_code != 500, f"Got 500 server error: {response.text}"
        print(f"✅ Calibration status never returns 500, got {response.status_code}")
    
    def test_calibration_status_with_invalid_token(self):
        """Invalid token should return 401, not 500"""
        headers = {"Authorization": "Bearer invalid_token_12345"}
        response = requests.get(f"{BASE_URL}/api/calibration/status", headers=headers)
        assert response.status_code in [401, 403], f"Expected 401/403 for invalid token, got {response.status_code}"
        print(f"✅ Calibration status (invalid token): {response.status_code}")


class TestProtectedRoutes:
    """Tests for protected routes auth behavior"""
    
    def test_advisor_endpoint_requires_auth(self):
        """Any authenticated-only endpoint should return 401 without token"""
        # Test a known protected endpoint - check-profile
        response = requests.get(f"{BASE_URL}/api/auth/check-profile")
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        print(f"✅ Protected endpoint (check-profile): {response.status_code}")
    
    def test_me_endpoint_requires_auth(self):
        """User profile endpoint should return 401/403 without token"""
        response = requests.get(f"{BASE_URL}/api/auth/supabase/me")
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print(f"✅ User me endpoint: {response.status_code}")


class TestAuthEndpoints:
    """Auth endpoint availability tests"""
    
    def test_login_endpoint_exists(self):
        """Login endpoint should exist and return proper error for empty body"""
        response = requests.post(f"{BASE_URL}/api/auth/supabase/login", json={})
        # Should return 422 (validation error) or 400, not 404
        assert response.status_code != 404, "Login endpoint should exist"
        print(f"✅ Login endpoint exists, returns {response.status_code} for empty body")
    
    def test_signup_endpoint_exists(self):
        """Signup endpoint should exist"""
        response = requests.post(f"{BASE_URL}/api/auth/supabase/signup", json={})
        # Should return 422 (validation error) or 400, not 404
        assert response.status_code != 404, "Signup endpoint should exist"
        print(f"✅ Signup endpoint exists, returns {response.status_code} for empty body")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
