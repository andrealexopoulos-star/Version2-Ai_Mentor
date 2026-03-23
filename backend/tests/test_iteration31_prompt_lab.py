"""
Iteration 31: BIQC Sovereign Prompt Lab Tests
----------------------------------------------
Tests for new Prompt Lab admin UI:
- Backend: GET /api/admin/prompts returns 403 without auth (super_admin gated)
- Backend: GET /api/admin/prompts/{prompt_key} returns 403 without auth
- Backend: PUT /api/admin/prompts/{prompt_key} returns 403 without auth
- Backend: POST /api/admin/prompts/{prompt_key}/test returns 403 without auth
- Backend: POST /api/admin/prompts/invalidate returns 403 without auth
- Frontend: Landing page loads at /
- Frontend: Login page loads at /login-supabase
- Frontend: /admin/prompt-lab page exists (returns 200 as HTML)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestPromptLabBackendAuth:
    """Admin Prompt Lab endpoints - super_admin gated (403 without auth)"""
    AUTH_BLOCKED_CODES = [401, 403]

    def test_get_prompts_returns_403_without_auth(self):
        """GET /api/admin/prompts requires super_admin - returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/prompts", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected 401/403, got {response.status_code}: {response.text}"
        # Verify JSON response with detail
        data = response.json()
        assert "detail" in data, "Error response should contain 'detail' field"

    def test_get_prompt_detail_returns_403_without_auth(self):
        """GET /api/admin/prompts/{prompt_key} requires super_admin - returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/prompts/test_prompt_key", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected 401/403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data, "Error response should contain 'detail' field"

    def test_put_prompt_returns_403_without_auth(self):
        """PUT /api/admin/prompts/{prompt_key} requires super_admin - returns 403 without auth"""
        payload = {
            "raw_content": "Test prompt content",
            "description": "Test description",
            "version": "1.0"
        }
        response = requests.put(
            f"{BASE_URL}/api/admin/prompts/test_prompt_key",
            json=payload,
            timeout=10
        )
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected 401/403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data, "Error response should contain 'detail' field"

    def test_post_prompt_test_returns_403_without_auth(self):
        """POST /api/admin/prompts/{prompt_key}/test requires super_admin - returns 403 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/admin/prompts/test_prompt_key/test",
            timeout=10
        )
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected 401/403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data, "Error response should contain 'detail' field"

    def test_post_prompts_invalidate_returns_403_without_auth(self):
        """POST /api/admin/prompts/invalidate requires super_admin - returns 403 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/admin/prompts/invalidate",
            json={},
            timeout=10
        )
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected 401/403, got {response.status_code}: {response.text}"
        data = response.json()
        assert "detail" in data, "Error response should contain 'detail' field"


class TestFrontendPageExistence:
    """Frontend page load tests - verify pages return HTML (200)"""

    def test_landing_page_loads(self):
        """Landing page at / should return 200"""
        response = requests.get(f"{BASE_URL}/", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        # Verify it's HTML (React app)
        assert "text/html" in response.headers.get("Content-Type", ""), "Landing page should return HTML"

    def test_login_page_loads(self):
        """Login page at /login-supabase should return 200"""
        response = requests.get(f"{BASE_URL}/login-supabase", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "text/html" in response.headers.get("Content-Type", ""), "Login page should return HTML"

    def test_prompt_lab_page_exists(self):
        """/admin/prompt-lab route exists (returns 200 as HTML - SPA routing)"""
        response = requests.get(f"{BASE_URL}/admin/prompt-lab", timeout=10)
        # React SPA serves HTML for all routes, auth is handled client-side
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "text/html" in response.headers.get("Content-Type", ""), "Prompt Lab page should return HTML"


class TestAPIHealthCheck:
    """Verify API is accessible"""

    def test_api_health(self):
        """API health endpoint should be accessible"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy", f"Expected status: healthy, got: {data}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
