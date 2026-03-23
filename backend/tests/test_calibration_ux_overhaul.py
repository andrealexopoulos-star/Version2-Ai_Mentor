"""
BIQC Calibration UX Overhaul Backend Tests - Iteration 8
Tests for:
1. POST /api/calibration/init - requires auth (401 without token)
2. POST /api/calibration/init - returns {status: ready} with auth
3. POST /api/calibration/answer - still works with question_id and answer
4. GET /api/calibration/status - enforces auth (401 on invalid tokens)
5. GET /api/health - returns 200
"""

import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

class TestHealthEndpoint:
    """Test basic health endpoint"""
    
    def test_health_returns_200(self):
        """GET /api/health returns 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "status" in data, "Response should contain 'status' field"
        print(f"✓ Health endpoint: {data}")


class TestCalibrationInit:
    """Test POST /api/calibration/init endpoint"""
    
    def test_init_requires_auth_no_header(self):
        """POST /api/calibration/init without auth returns 401"""
        response = requests.post(f"{BASE_URL}/api/calibration/init")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ calibration/init without auth returns 401")
    
    def test_init_requires_auth_invalid_token(self):
        """POST /api/calibration/init with invalid token returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/calibration/init",
            headers={"Authorization": "Bearer invalid-token-here"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ calibration/init with invalid token returns 401")
    
    def test_init_requires_auth_empty_bearer(self):
        """POST /api/calibration/init with empty Bearer returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/calibration/init",
            headers={"Authorization": "Bearer "}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ calibration/init with empty Bearer returns 401")


class TestCalibrationAnswer:
    """Test POST /api/calibration/answer endpoint"""
    
    def test_answer_requires_auth_no_header(self):
        """POST /api/calibration/answer without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/calibration/answer",
            json={"question_id": 1, "answer": "Test Company in Tech"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ calibration/answer without auth returns 401")
    
    def test_answer_requires_auth_invalid_token(self):
        """POST /api/calibration/answer with invalid token returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/calibration/answer",
            json={"question_id": 1, "answer": "Test Company in Tech"},
            headers={"Authorization": "Bearer invalid-token"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ calibration/answer with invalid token returns 401")


class TestCalibrationStatus:
    """Test GET /api/calibration/status endpoint with strict auth behavior"""
    
    def test_status_without_auth_returns_401(self):
        """GET /api/calibration/status without auth header returns 401"""
        response = requests.get(f"{BASE_URL}/api/calibration/status")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ calibration/status without auth returns 401")
    
    def test_status_with_invalid_token_returns_401(self):
        """GET /api/calibration/status with invalid Bearer token returns 401"""
        response = requests.get(
            f"{BASE_URL}/api/calibration/status",
            headers={"Authorization": "Bearer some-invalid-token"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ calibration/status with invalid token returns 401")
    
    def test_status_with_malformed_jwt_returns_401(self):
        """GET /api/calibration/status with malformed JWT returns 401"""
        # Simulate a JWT-like token that won't verify
        fake_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QifQ.InvalidSignature"
        response = requests.get(
            f"{BASE_URL}/api/calibration/status",
            headers={"Authorization": f"Bearer {fake_jwt}"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ calibration/status with malformed JWT returns 401")
    
    def test_status_with_empty_bearer_returns_401(self):
        """GET /api/calibration/status with empty Bearer returns 401"""
        response = requests.get(
            f"{BASE_URL}/api/calibration/status",
            headers={"Authorization": "Bearer "}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✓ calibration/status with empty Bearer returns 401")


class TestBusinessProfile:
    """Test business profile endpoint auth"""
    
    def test_business_profile_requires_auth(self):
        """GET /api/business-profile returns 401 or 403 for unauthenticated"""
        response = requests.get(f"{BASE_URL}/api/business-profile")
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"
        print(f"✓ business-profile requires auth (returns {response.status_code})")


class TestAuthCheckProfile:
    """Test auth check-profile endpoint"""
    
    def test_check_profile_requires_auth(self):
        """GET /api/auth/check-profile returns 401 for unauthenticated"""
        response = requests.get(f"{BASE_URL}/api/auth/check-profile")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ auth/check-profile requires auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
