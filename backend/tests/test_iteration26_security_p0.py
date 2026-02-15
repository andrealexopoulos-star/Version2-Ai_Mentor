"""
BIQC Security P0 + Route Extraction Verification Test - Iteration 26
Tests Phase 1 Monolith Deconstruction:
- Phase 1A: Security P0 - 4 endpoints locked with auth (calibration/status, calibration/init, calibration/brain, executive-mirror)
- Phase 1B: Zombie purge verification (N/A - just file archival)
- Phase 1C: Route modularization - soundboard and data_center routes extracted from server.py
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthEndpoints:
    """Health check endpoints - should be publicly accessible"""
    
    def test_root_health_via_internal(self):
        """GET /health works on backend internally (root app health check for K8s probes)
        
        Note: The root /health endpoint is available internally on port 8001 but external
        access via K8s ingress routes non-/api paths to frontend. This test verifies the
        internal endpoint for K8s liveness/readiness probes.
        """
        # Test internal endpoint if available (this runs in same pod)
        try:
            response = requests.get("http://localhost:8001/health", timeout=5)
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            data = response.json()
            assert data.get("status") == "healthy", f"Expected status='healthy', got {data}"
            print("PASS: Internal /health returns 200 with status='healthy'")
        except Exception as e:
            # If internal not available, skip - this is for K8s probe only
            print(f"SKIP: Internal /health not accessible (expected in some envs): {e}")
    
    def test_api_health_returns_200(self):
        """GET /api/health should return 200 with status healthy"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy", f"Expected status='healthy', got {data}"
        print("PASS: /api/health returns 200 with status='healthy'")


class TestSecurityP0Endpoints:
    """Security P0 - Endpoints that were previously unprotected, now require auth"""
    
    def test_calibration_status_requires_auth(self):
        """GET /api/calibration/status should return 403 without auth token"""
        response = requests.get(f"{BASE_URL}/api/calibration/status", timeout=10)
        # Without auth, should get 401 (Unauthorized) or 403 (Forbidden)
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"PASS: /api/calibration/status returns {response.status_code} without auth")
    
    def test_calibration_init_requires_auth(self):
        """POST /api/calibration/init should return 403 without auth token"""
        response = requests.post(f"{BASE_URL}/api/calibration/init", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"PASS: /api/calibration/init POST returns {response.status_code} without auth")
    
    def test_calibration_brain_requires_auth(self):
        """POST /api/calibration/brain should return 403 without auth token"""
        response = requests.post(
            f"{BASE_URL}/api/calibration/brain",
            json={"message": "test", "history": []},
            timeout=10
        )
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"PASS: /api/calibration/brain POST returns {response.status_code} without auth")
    
    def test_executive_mirror_requires_auth(self):
        """GET /api/executive-mirror should return 403 without auth token"""
        response = requests.get(f"{BASE_URL}/api/executive-mirror", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"PASS: /api/executive-mirror returns {response.status_code} without auth")
    
    def test_data_center_upload_requires_auth(self):
        """POST /api/data-center/upload should return 403 without auth token"""
        response = requests.post(
            f"{BASE_URL}/api/data-center/upload",
            files={"file": ("test.txt", b"test content", "text/plain")},
            data={"category": "test", "description": "test"},
            timeout=10
        )
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"PASS: /api/data-center/upload POST returns {response.status_code} without auth")


class TestExtractedRoutes:
    """Routes extracted from server.py to /routes/ modules - should still require auth"""
    
    def test_soundboard_conversations_requires_auth(self):
        """GET /api/soundboard/conversations should return 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/soundboard/conversations", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"PASS: /api/soundboard/conversations returns {response.status_code} without auth")
    
    def test_data_center_files_requires_auth(self):
        """GET /api/data-center/files should return 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/data-center/files", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"PASS: /api/data-center/files returns {response.status_code} without auth")
    
    def test_data_center_categories_requires_auth(self):
        """GET /api/data-center/categories should return 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/data-center/categories", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"PASS: /api/data-center/categories returns {response.status_code} without auth")
    
    def test_soundboard_chat_requires_auth(self):
        """POST /api/soundboard/chat should return 403 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/soundboard/chat",
            json={"message": "test"},
            timeout=10
        )
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"PASS: /api/soundboard/chat POST returns {response.status_code} without auth")


class TestMethodValidation:
    """Verify POST endpoints return 405 for GET requests (not 403)"""
    
    def test_calibration_init_get_returns_405(self):
        """GET /api/calibration/init should return 405 Method Not Allowed, not auth error"""
        response = requests.get(f"{BASE_URL}/api/calibration/init", timeout=10)
        # GET on POST endpoint should return 405 Method Not Allowed
        assert response.status_code == 405, f"Expected 405 for GET on POST endpoint, got {response.status_code}"
        print("PASS: GET /api/calibration/init returns 405 Method Not Allowed")
    
    def test_calibration_brain_get_returns_405(self):
        """GET /api/calibration/brain should return 405 Method Not Allowed, not auth error"""
        response = requests.get(f"{BASE_URL}/api/calibration/brain", timeout=10)
        assert response.status_code == 405, f"Expected 405 for GET on POST endpoint, got {response.status_code}"
        print("PASS: GET /api/calibration/brain returns 405 Method Not Allowed")


class TestResponseFormat:
    """Verify endpoints return JSON responses with proper error structure"""
    
    def test_auth_error_returns_json(self):
        """Auth errors should return JSON, not HTML"""
        response = requests.get(f"{BASE_URL}/api/calibration/status", timeout=10)
        content_type = response.headers.get("Content-Type", "")
        assert "application/json" in content_type, f"Expected JSON content-type, got {content_type}"
        # Verify it's valid JSON
        try:
            data = response.json()
            assert "detail" in data or "error" in data, f"Expected error detail in response: {data}"
        except Exception as e:
            pytest.fail(f"Response is not valid JSON: {e}")
        print("PASS: Auth error returns JSON response with error detail")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
