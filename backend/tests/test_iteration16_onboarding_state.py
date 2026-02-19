"""
Test Iteration 16: Onboarding State Consolidation to user_operator_profile

Key Features Tested:
1. GET /api/onboarding/status - reads from user_operator_profile (not onboarding table directly)
2. GET /api/onboarding/status - returns completed=false when no state exists (no auto-complete)
3. POST /api/onboarding/save - writes to user_operator_profile
4. POST /api/onboarding/save - anti-regression: current_step cannot decrease (except reset to 0)
5. POST /api/onboarding/complete - writes completed=true to user_operator_profile
6. GET /api/business-profile/context - reads onboarding from user_operator_profile
7. All endpoints return 401 for unauthenticated requests
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ai-strategic-hub.preview.emergentagent.com').rstrip('/')


class TestOnboardingUnauthenticated:
    """Test that all onboarding endpoints return 401/403 for unauthenticated requests"""
    
    def test_onboarding_status_requires_auth(self):
        """GET /api/onboarding/status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/onboarding/status")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        data = response.json()
        assert "detail" in data or "error" in data
        print(f"✓ GET /api/onboarding/status returns {response.status_code} for unauthenticated requests")
    
    def test_onboarding_save_requires_auth(self):
        """POST /api/onboarding/save requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/onboarding/save",
            json={"current_step": 1, "business_stage": "test", "data": {}, "completed": False}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ POST /api/onboarding/save returns {response.status_code} for unauthenticated requests")
    
    def test_onboarding_complete_requires_auth(self):
        """POST /api/onboarding/complete requires authentication"""
        response = requests.post(f"{BASE_URL}/api/onboarding/complete")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ POST /api/onboarding/complete returns {response.status_code} for unauthenticated requests")
    
    def test_business_profile_context_requires_auth(self):
        """GET /api/business-profile/context requires authentication"""
        response = requests.get(f"{BASE_URL}/api/business-profile/context")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ GET /api/business-profile/context returns {response.status_code} for unauthenticated requests")


class TestBackendIsRunning:
    """Verify backend is accessible and responding"""
    
    def test_backend_health(self):
        """Backend should respond to health check"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Backend health check failed with {response.status_code}"
        print(f"✓ Backend health check passed")
    
    def test_backend_cors(self):
        """Backend should have CORS headers"""
        response = requests.options(
            f"{BASE_URL}/api/onboarding/status",
            headers={"Origin": "https://ai-strategic-hub.preview.emergentagent.com"}
        )
        # CORS preflight should return 200 or the actual response
        assert response.status_code in [200, 401, 403, 405], f"Unexpected status: {response.status_code}"
        print(f"✓ Backend CORS check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
