"""
P0 Auth Loop Bug Tests - Iteration 7
Tests the fail-open behavior on /api/calibration/status endpoint

Key fix: Backend now has fail-open behavior on /api/calibration/status
- Malformed Bearer token should return 200 with NEEDS_CALIBRATION
- No auth header should return 401
- JWT-format token (invalid sig) should return 200 NEEDS_CALIBRATION
"""
import pytest
import requests
import os
import base64
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test requirements from the review request:
# 1. Backend /api/calibration/status with malformed Bearer token -> 200 NEEDS_CALIBRATION
# 2. Backend /api/calibration/status with no auth header -> 401
# 3. Backend /api/calibration/status with JWT-format token (invalid sig) -> 200 NEEDS_CALIBRATION
# 4. Backend /api/health returns 200


class TestHealthEndpoint:
    """Test /api/health endpoint"""
    
    def test_health_endpoint_returns_200(self):
        """Test 4: Backend /api/health returns 200"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        # Health endpoint should have some status indication
        print(f"Health response: {data}")
        assert 'status' in data or isinstance(data, dict), "Health endpoint should return valid JSON"


class TestCalibrationStatusFailOpen:
    """Test the fail-open behavior on /api/calibration/status"""
    
    def test_no_auth_header_returns_401(self):
        """Test 2: No auth header should return 401"""
        response = requests.get(f"{BASE_URL}/api/calibration/status", timeout=10)
        assert response.status_code == 401, f"Expected 401 for no auth header, got {response.status_code}"
        print(f"✅ No auth header correctly returns 401")
    
    def test_malformed_bearer_token_returns_200_needs_calibration(self):
        """Test 1: Malformed Bearer token should return 200 with NEEDS_CALIBRATION (fail-open)"""
        headers = {
            "Authorization": "Bearer malformed_token_12345"
        }
        response = requests.get(f"{BASE_URL}/api/calibration/status", headers=headers, timeout=10)
        
        # Fail-open: should return 200, not 401
        assert response.status_code == 200, f"Expected 200 (fail-open), got {response.status_code}"
        
        data = response.json()
        assert data.get("status") == "NEEDS_CALIBRATION", f"Expected NEEDS_CALIBRATION, got {data}"
        print(f"✅ Malformed token correctly returns 200 with NEEDS_CALIBRATION")
    
    def test_jwt_format_invalid_signature_returns_200_needs_calibration(self):
        """Test 3: JWT-format token with invalid signature should return 200 NEEDS_CALIBRATION"""
        # Create a JWT-like token (header.payload.signature format)
        # This simulates a token that looks like JWT but has invalid/expired signature
        
        # Valid base64-encoded header
        header = base64.urlsafe_b64encode(json.dumps({
            "alg": "HS256",
            "typ": "JWT"
        }).encode()).decode().rstrip("=")
        
        # Valid base64-encoded payload with a fake user_id
        payload = base64.urlsafe_b64encode(json.dumps({
            "sub": "fake-user-id-12345",
            "email": "test@example.com",
            "exp": 9999999999  # Far future
        }).encode()).decode().rstrip("=")
        
        # Invalid signature (just random base64)
        signature = "invalid_signature_here"
        
        fake_jwt = f"{header}.{payload}.{signature}"
        
        headers = {
            "Authorization": f"Bearer {fake_jwt}"
        }
        response = requests.get(f"{BASE_URL}/api/calibration/status", headers=headers, timeout=10)
        
        # Fail-open: JWT format but invalid sig should return 200 with NEEDS_CALIBRATION
        assert response.status_code == 200, f"Expected 200 (fail-open), got {response.status_code}"
        
        data = response.json()
        assert data.get("status") == "NEEDS_CALIBRATION", f"Expected NEEDS_CALIBRATION, got {data}"
        print(f"✅ JWT-format token with invalid sig correctly returns 200 with NEEDS_CALIBRATION")
    
    def test_empty_bearer_token_returns_401(self):
        """Empty Bearer token (just "Bearer ") should return 401"""
        headers = {
            "Authorization": "Bearer "
        }
        response = requests.get(f"{BASE_URL}/api/calibration/status", headers=headers, timeout=10)
        
        # Empty token after Bearer should be treated as not authenticated
        assert response.status_code == 401, f"Expected 401 for empty Bearer token, got {response.status_code}"
        print(f"✅ Empty Bearer token correctly returns 401")
    
    def test_non_bearer_auth_returns_401(self):
        """Non-Bearer auth format should return 401"""
        headers = {
            "Authorization": "Basic dXNlcjpwYXNz"  # Basic auth format
        }
        response = requests.get(f"{BASE_URL}/api/calibration/status", headers=headers, timeout=10)
        
        assert response.status_code == 401, f"Expected 401 for non-Bearer auth, got {response.status_code}"
        print(f"✅ Non-Bearer auth correctly returns 401")


class TestOtherProtectedEndpoints:
    """Test other protected endpoints for proper auth behavior"""
    
    def test_auth_check_profile_no_auth_returns_401(self):
        """Backend: /api/auth/check-profile returns 401 for unauthenticated"""
        response = requests.get(f"{BASE_URL}/api/auth/check-profile", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/auth/check-profile correctly returns {response.status_code} for unauthenticated")
    
    def test_business_profile_no_auth_returns_401(self):
        """Backend: /api/business-profile returns 401 for unauthenticated"""
        response = requests.get(f"{BASE_URL}/api/business-profile", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/business-profile correctly returns {response.status_code} for unauthenticated")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
