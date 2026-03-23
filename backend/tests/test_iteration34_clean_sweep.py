"""
Iteration 34 Tests: Clean Sweep Refactoring Verification
Tests the refactored code structure after extracting logic from server.py and CalibrationAdvisor.js

Tests:
1. Backend health endpoints
2. Auth protection on protected endpoints
3. OAuth endpoint functionality
4. Core module imports (models.py, helpers.py, config.py)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBackendHealth:
    """Health check endpoints"""
    
    def test_api_health_returns_200(self):
        """GET /api/health should return 200 with status: healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_api_root_returns_info(self):
        """GET /api/ should return API info"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "Strategic Advisor API" in data.get("message", "")


class TestAuthProtection:
    """Verify all protected endpoints return 403 without token"""
    AUTH_BLOCKED_CODES = [401, 403]
    
    def test_calibration_status_requires_auth(self):
        """GET /api/calibration/status returns 403 without token"""
        response = requests.get(f"{BASE_URL}/api/calibration/status")
        assert response.status_code in self.AUTH_BLOCKED_CODES
        data = response.json()
        assert "Not authenticated" in data.get("detail", "")
    
    def test_admin_prompts_requires_auth(self):
        """GET /api/admin/prompts returns 403 without token"""
        response = requests.get(f"{BASE_URL}/api/admin/prompts")
        assert response.status_code in self.AUTH_BLOCKED_CODES
        data = response.json()
        assert "Not authenticated" in data.get("detail", "")
    
    def test_business_profile_requires_auth(self):
        """GET /api/business-profile returns 403 without token"""
        response = requests.get(f"{BASE_URL}/api/business-profile")
        assert response.status_code in self.AUTH_BLOCKED_CODES
        data = response.json()
        assert "Not authenticated" in data.get("detail", "")
    
    def test_soundboard_conversations_requires_auth(self):
        """GET /api/soundboard/conversations returns 403 without token"""
        response = requests.get(f"{BASE_URL}/api/soundboard/conversations")
        assert response.status_code in self.AUTH_BLOCKED_CODES
        data = response.json()
        assert "Not authenticated" in data.get("detail", "")
    
    def test_cognitive_profile_requires_auth(self):
        """GET /api/cognitive/profile returns 403 without token"""
        response = requests.get(f"{BASE_URL}/api/cognitive/profile")
        assert response.status_code in self.AUTH_BLOCKED_CODES
        data = response.json()
        assert "Not authenticated" in data.get("detail", "")
    
    def test_executive_mirror_requires_auth(self):
        """GET /api/executive-mirror returns 403 without token"""
        response = requests.get(f"{BASE_URL}/api/executive-mirror")
        assert response.status_code in self.AUTH_BLOCKED_CODES
        data = response.json()
        assert "Not authenticated" in data.get("detail", "")
    
    def test_dashboard_stats_requires_auth(self):
        """GET /api/dashboard/stats returns 403 without token"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code in self.AUTH_BLOCKED_CODES
        data = response.json()
        assert "Not authenticated" in data.get("detail", "")
    
    def test_chat_history_requires_auth(self):
        """GET /api/chat/history returns 403 without token"""
        response = requests.get(f"{BASE_URL}/api/chat/history")
        assert response.status_code in self.AUTH_BLOCKED_CODES
        data = response.json()
        assert "Not authenticated" in data.get("detail", "")
    
    def test_data_center_files_requires_auth(self):
        """GET /api/data-center/files requires auth"""
        response = requests.get(f"{BASE_URL}/api/data-center/files")
        assert response.status_code in self.AUTH_BLOCKED_CODES
    
    def test_onboarding_status_requires_auth(self):
        """GET /api/onboarding/status requires auth"""
        response = requests.get(f"{BASE_URL}/api/onboarding/status")
        assert response.status_code in self.AUTH_BLOCKED_CODES


class TestOAuthEndpoints:
    """Test OAuth endpoint functionality"""
    
    def test_google_oauth_returns_auth_url(self):
        """GET /api/auth/supabase/oauth/google returns 200 with auth_url"""
        response = requests.get(f"{BASE_URL}/api/auth/supabase/oauth/google")
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "supabase.co" in data["url"]
        assert "google" in data["url"]
        assert data.get("provider") == "google"


class TestCoreModuleIntegrity:
    """Verify core modules can be imported (tested via server startup)"""
    
    def test_server_is_running_with_all_imports(self):
        """Server running means all core modules imported successfully"""
        # If server is up, core/models.py, core/helpers.py, core/config.py all loaded
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
    
    def test_main_route_modules_loaded(self):
        """Verify key route modules loaded by checking various endpoints"""
        # auth router
        r1 = requests.get(f"{BASE_URL}/api/auth/supabase/oauth/google")
        assert r1.status_code == 200
        
        # calibration router
        r2 = requests.get(f"{BASE_URL}/api/calibration/status")
        assert r2.status_code in [401, 403]  # auth required but route exists
        
        # profile router
        r3 = requests.get(f"{BASE_URL}/api/business-profile")
        assert r3.status_code in [401, 403]  # auth required but route exists
        
        # admin router
        r4 = requests.get(f"{BASE_URL}/api/admin/prompts")
        assert r4.status_code in [401, 403]  # auth required but route exists
        
        # soundboard router
        r5 = requests.get(f"{BASE_URL}/api/soundboard/conversations")
        assert r5.status_code in [401, 403]  # auth required but route exists
        
        # cognitive router
        r6 = requests.get(f"{BASE_URL}/api/cognitive/profile")
        assert r6.status_code in [401, 403]  # auth required but route exists
        
        # data_center router
        r7 = requests.get(f"{BASE_URL}/api/data-center/files")
        assert r7.status_code in [401, 403]  # auth required but route exists
        
        # onboarding router
        r8 = requests.get(f"{BASE_URL}/api/onboarding/status")
        assert r8.status_code in [401, 403]  # auth required but route exists


class TestAPIVersionEndpoint:
    """Test API root endpoint"""
    
    def test_api_root_returns_version_info(self):
        """GET /api/ returns API version info"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "Strategic Advisor API" in data["message"]
        assert "version" in data
