"""
BIQC Final Beta Launch Clearance - Iteration 32
Tests all specified endpoints for proper auth gating (403) and health check (200)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthEndpoint:
    """Health check endpoint - should return 200"""
    
    def test_health_returns_200_healthy(self):
        """GET /api/health returns 200 {status: healthy}"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy", f"Expected status=healthy, got {data}"
        print(f"✓ /api/health: {data}")


class TestAdminEndpoints:
    """Admin endpoints - super_admin gated, should return 403 without auth"""
    AUTH_BLOCKED_CODES = [401, 403]
    
    def test_admin_prompts_returns_403(self):
        """GET /api/admin/prompts returns 403 (super_admin gated)"""
        response = requests.get(f"{BASE_URL}/api/admin/prompts")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/admin/prompts: {response.status_code} (correctly gated)")
    
    def test_admin_prompts_key_test_returns_403(self):
        """POST /api/admin/prompts/{key}/test returns 403 (super_admin gated)"""
        response = requests.post(f"{BASE_URL}/api/admin/prompts/test_key/test")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/admin/prompts/{{key}}/test: {response.status_code} (correctly gated)")


class TestAuthRequiredEndpoints:
    """Auth-required endpoints - should return 403 without authentication"""
    
    def test_calibration_status_returns_403(self):
        """GET /api/calibration/status returns 403 (auth required)"""
        response = requests.get(f"{BASE_URL}/api/calibration/status")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/calibration/status: {response.status_code} (correctly protected)")
    
    def test_executive_mirror_returns_403(self):
        """GET /api/executive-mirror returns 403 (auth required)"""
        response = requests.get(f"{BASE_URL}/api/executive-mirror")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/executive-mirror: {response.status_code} (correctly protected)")
    
    def test_soundboard_conversations_returns_403(self):
        """GET /api/soundboard/conversations returns 403 (auth required)"""
        response = requests.get(f"{BASE_URL}/api/soundboard/conversations")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/soundboard/conversations: {response.status_code} (correctly protected)")
    
    def test_business_profile_returns_403(self):
        """GET /api/business-profile returns 403 (auth required)"""
        response = requests.get(f"{BASE_URL}/api/business-profile")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/business-profile: {response.status_code} (correctly protected)")
    
    def test_dashboard_stats_returns_403(self):
        """GET /api/dashboard/stats returns 403 (auth required)"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/dashboard/stats: {response.status_code} (correctly protected)")
    
    def test_chat_history_returns_403(self):
        """GET /api/chat/history returns 403 (auth required)"""
        response = requests.get(f"{BASE_URL}/api/chat/history")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ /api/chat/history: {response.status_code} (correctly protected)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
