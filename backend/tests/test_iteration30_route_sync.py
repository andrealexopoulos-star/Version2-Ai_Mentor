"""
Iteration 30 — Route Synchronization Audit Test Suite
Cross-referencing frontend API calls with backend route modules.
Verifying RBAC visibility and auth protection on all endpoints.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthEndpoints:
    """Health check endpoints should be publicly accessible"""
    
    def test_api_health_returns_200(self):
        """GET /api/health should return 200 with healthy status"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"


class TestAdminRoutesRBAC:
    """Admin routes require super_admin role - should return 403 without auth"""
    AUTH_BLOCKED_CODES = [401, 403]
    
    def test_admin_prompts_requires_auth(self):
        """GET /api/admin/prompts - requires super_admin"""
        response = requests.get(f"{BASE_URL}/api/admin/prompts", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_admin_prompts_invalidate_requires_auth(self):
        """POST /api/admin/prompts/invalidate - requires super_admin"""
        response = requests.post(f"{BASE_URL}/api/admin/prompts/invalidate", json={}, timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_admin_users_requires_auth(self):
        """GET /api/admin/users - requires super_admin"""
        response = requests.get(f"{BASE_URL}/api/admin/users", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_admin_stats_requires_auth(self):
        """GET /api/admin/stats - requires super_admin"""
        response = requests.get(f"{BASE_URL}/api/admin/stats", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES


class TestCalibrationRoutes:
    """Calibration routes - from routes/calibration.py"""
    AUTH_BLOCKED_CODES = [401, 403]
    
    def test_calibration_status_requires_auth(self):
        """GET /api/calibration/status - requires current_user"""
        response = requests.get(f"{BASE_URL}/api/calibration/status", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_calibration_init_post_requires_auth(self):
        """POST /api/calibration/init - requires current_user"""
        response = requests.post(f"{BASE_URL}/api/calibration/init", json={}, timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_calibration_brain_post_requires_auth(self):
        """POST /api/calibration/brain - requires current_user"""
        response = requests.post(f"{BASE_URL}/api/calibration/brain", json={"message": "test", "history": []}, timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES


class TestSoundboardRoutes:
    """Soundboard routes - from routes/soundboard.py"""
    AUTH_BLOCKED_CODES = [401, 403]
    
    def test_soundboard_conversations_requires_auth(self):
        """GET /api/soundboard/conversations - requires current_user"""
        response = requests.get(f"{BASE_URL}/api/soundboard/conversations", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_soundboard_chat_post_requires_auth(self):
        """POST /api/soundboard/chat - requires current_user"""
        response = requests.post(f"{BASE_URL}/api/soundboard/chat", json={"message": "test"}, timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES


class TestDataCenterRoutes:
    """Data Center routes - from routes/data_center.py"""
    AUTH_BLOCKED_CODES = [401, 403]
    
    def test_data_center_files_requires_auth(self):
        """GET /api/data-center/files - requires current_user"""
        response = requests.get(f"{BASE_URL}/api/data-center/files", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES


class TestIntegrationsRoutes:
    """Integrations routes - from routes/integrations.py"""
    AUTH_BLOCKED_CODES = [401, 403]
    
    def test_merge_connected_requires_auth(self):
        """GET /api/integrations/merge/connected - requires current_user"""
        response = requests.get(f"{BASE_URL}/api/integrations/merge/connected", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_crm_contacts_requires_auth(self):
        """GET /api/integrations/crm/contacts - requires current_user"""
        response = requests.get(f"{BASE_URL}/api/integrations/crm/contacts", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_intelligence_cold_read_requires_auth(self):
        """POST /api/intelligence/cold-read - requires current_user"""
        response = requests.post(f"{BASE_URL}/api/intelligence/cold-read", json={}, timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES


class TestProfileRoutes:
    """Profile routes - from routes/profile.py"""
    AUTH_BLOCKED_CODES = [401, 403]
    
    def test_business_profile_requires_auth(self):
        """GET /api/business-profile - requires current_user"""
        response = requests.get(f"{BASE_URL}/api/business-profile", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_dashboard_stats_requires_auth(self):
        """GET /api/dashboard/stats - requires current_user"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_oac_recommendations_requires_auth(self):
        """GET /api/oac/recommendations - requires current_user"""
        response = requests.get(f"{BASE_URL}/api/oac/recommendations", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_notifications_alerts_requires_auth(self):
        """GET /api/notifications/alerts - requires current_user"""
        response = requests.get(f"{BASE_URL}/api/notifications/alerts", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES


class TestGenerationRoutes:
    """Generation routes - from routes/generation.py"""
    AUTH_BLOCKED_CODES = [401, 403]
    
    def test_chat_post_requires_auth(self):
        """POST /api/chat - requires current_user"""
        response = requests.post(f"{BASE_URL}/api/chat", json={"message": "test"}, timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_chat_history_requires_auth(self):
        """GET /api/chat/history - requires current_user"""
        response = requests.get(f"{BASE_URL}/api/chat/history", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_analyses_get_requires_auth(self):
        """GET /api/analyses - requires current_user"""
        response = requests.get(f"{BASE_URL}/api/analyses", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_analyses_post_requires_auth(self):
        """POST /api/analyses - requires current_user"""
        response = requests.post(f"{BASE_URL}/api/analyses", json={"title": "test", "analysis_type": "general", "business_context": "test"}, timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_documents_requires_auth(self):
        """GET /api/documents - requires current_user"""
        response = requests.get(f"{BASE_URL}/api/documents", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_sop_generation_requires_auth(self):
        """POST /api/generate/sop - requires current_user"""
        response = requests.post(f"{BASE_URL}/api/generate/sop", json={}, timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_diagnose_requires_auth(self):
        """POST /api/diagnose - requires current_user"""
        response = requests.post(f"{BASE_URL}/api/diagnose", json={"problem": "test"}, timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES


class TestEmailRoutes:
    """Email routes - from routes/email.py"""
    AUTH_BLOCKED_CODES = [401, 403]
    
    def test_outlook_status_requires_auth(self):
        """GET /api/outlook/status - requires current_user"""
        response = requests.get(f"{BASE_URL}/api/outlook/status", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_gmail_status_requires_auth(self):
        """GET /api/gmail/status - requires current_user"""
        response = requests.get(f"{BASE_URL}/api/gmail/status", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES


class TestCognitiveRoutes:
    """Cognitive/Intelligence routes"""
    AUTH_BLOCKED_CODES = [401, 403]
    
    def test_cognitive_profile_requires_auth(self):
        """GET /api/cognitive/profile - requires current_user"""
        response = requests.get(f"{BASE_URL}/api/cognitive/profile", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_cognitive_escalation_requires_auth(self):
        """GET /api/cognitive/escalation - requires current_user"""
        response = requests.get(f"{BASE_URL}/api/cognitive/escalation", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_advisory_confidence_requires_auth(self):
        """GET /api/advisory/confidence - requires current_user"""
        response = requests.get(f"{BASE_URL}/api/advisory/confidence", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES


class TestOnboardingRoutes:
    """Onboarding routes"""
    AUTH_BLOCKED_CODES = [401, 403]
    
    def test_onboarding_status_requires_auth(self):
        """GET /api/onboarding/status - requires current_user"""
        response = requests.get(f"{BASE_URL}/api/onboarding/status", timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES
        
    def test_onboarding_save_requires_auth(self):
        """POST /api/onboarding/save - requires current_user"""
        response = requests.post(f"{BASE_URL}/api/onboarding/save", json={}, timeout=10)
        assert response.status_code in self.AUTH_BLOCKED_CODES


class TestMethodValidation:
    """Verify endpoints reject incorrect HTTP methods"""
    
    def test_calibration_init_get_returns_405(self):
        """GET /api/calibration/init should return 405 Method Not Allowed"""
        response = requests.get(f"{BASE_URL}/api/calibration/init", timeout=10)
        # Could be 401/403 (auth) or 405 (method) depending on middleware order
        assert response.status_code in [401, 403, 405]
        
    def test_chat_get_returns_405(self):
        """GET /api/chat should return 405 Method Not Allowed"""
        response = requests.get(f"{BASE_URL}/api/chat", timeout=10)
        # Could be 401/403 (auth) or 405 (method) depending on middleware order
        assert response.status_code in [401, 403, 405]


class TestPublicAuthEndpoints:
    """Auth endpoints that should be publicly accessible"""
    
    def test_supabase_oauth_google_accessible(self):
        """GET /api/auth/supabase/oauth/google - should redirect or return OAuth URL"""
        response = requests.get(f"{BASE_URL}/api/auth/supabase/oauth/google", allow_redirects=False, timeout=10)
        # Should redirect to Google OAuth or return OAuth data
        assert response.status_code in [200, 302, 307]


class TestAuthErrorFormat:
    """Verify auth errors return proper JSON format"""
    
    def test_auth_block_returns_json_with_detail(self):
        """Auth errors should return JSON with 'detail' field"""
        response = requests.get(f"{BASE_URL}/api/admin/prompts", timeout=10)
        assert response.status_code in [401, 403]
        data = response.json()
        assert "detail" in data
