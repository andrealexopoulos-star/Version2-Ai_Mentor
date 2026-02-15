"""
P0 Auth Routing Tests - Iteration 6
Tests for the auth loop fix: protected routes redirect, no auth errors for unauthenticated users
"""
import pytest
import requests
import os

# Use the preview endpoint URL for testing
BASE_URL = os.environ.get('preview_endpoint', 'https://executive-reveal.preview.emergentagent.com')


class TestBackendHealthAndCalibration:
    """Backend API endpoint tests"""
    
    def test_health_endpoint_returns_200(self):
        """Health check should always return 200"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✅ /api/health returns 200 with healthy status")
    
    def test_calibration_status_unauthenticated_returns_401(self):
        """Calibration status should return 401 for unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/calibration/status", timeout=10)
        # Should return 401 or 403 for unauthenticated
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/calibration/status returns {response.status_code} for unauthenticated")
    
    def test_calibration_status_invalid_token_returns_401(self):
        """Calibration status should return 401 for invalid token"""
        headers = {"Authorization": "Bearer invalid_token_12345"}
        response = requests.get(f"{BASE_URL}/api/calibration/status", headers=headers, timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/calibration/status returns {response.status_code} for invalid token")
    
    def test_calibration_status_never_500(self):
        """Calibration status should never return 500"""
        response = requests.get(f"{BASE_URL}/api/calibration/status", timeout=10)
        assert response.status_code != 500, "Calibration status should never return 500"
        print("✅ /api/calibration/status doesn't return 500")


class TestProtectedEndpoints:
    """Tests for protected API endpoints"""
    
    def test_auth_check_profile_unauthenticated(self):
        """Check-profile should return 401/403 for unauthenticated"""
        response = requests.get(f"{BASE_URL}/api/auth/check-profile", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/auth/check-profile returns {response.status_code} for unauthenticated")
    
    def test_business_profile_unauthenticated(self):
        """Business profile should return 401/403 for unauthenticated"""
        response = requests.get(f"{BASE_URL}/api/business-profile", timeout=10)
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print(f"✅ /api/business-profile returns {response.status_code} for unauthenticated")


class TestPublicEndpoints:
    """Tests for public endpoints that should work without auth"""
    
    def test_root_accessible(self):
        """Root path should be accessible"""
        response = requests.get(BASE_URL, timeout=10)
        assert response.status_code == 200
        print("✅ Root path is accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
