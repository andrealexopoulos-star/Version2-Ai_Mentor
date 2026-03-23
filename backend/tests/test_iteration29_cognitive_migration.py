"""
Iteration 29 - Cognitive Migration Tests

Key features tested:
- Health: /api/health returns 200
- RBAC: /api/admin/prompts returns 403 without auth (super_admin gated)
- RBAC: /api/admin/prompts/invalidate POST returns 403 without auth
- RBAC: /api/admin/users returns 403 without auth (super_admin gated)
- All 23 protected endpoints return 401/403 without auth
- Extracted generation routes: /api/chat POST, /api/analyses, /api/documents, /api/generate/sop POST, /api/diagnose POST
- Extracted profile routes: /api/business-profile, /api/dashboard/stats, /api/oac/recommendations, /api/notifications/alerts
- Extracted integrations routes: /api/integrations/merge/connected, /api/integrations/crm/contacts, /api/intelligence/cold-read POST

Cognitive migration details:
- All 18 prompts wired to Supabase system_prompts table
- RBAC gates (super_admin, client_admin) applied to admin routes
- server.py at 1,839 lines
- 15 route modules + AI Core fully operational
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://beta.thestrategysquad.com').rstrip('/')


class TestHealthEndpoints:
    """Health endpoints tests"""
    
    def test_api_health_returns_200(self):
        """Test /api/health returns 200 with healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy"
        print("PASS: /api/health returns 200 with status=healthy")


class TestRBACAdminRoutes:
    """RBAC tests - Admin routes require super_admin role"""
    
    def test_admin_prompts_requires_super_admin(self):
        """Test /api/admin/prompts returns auth block without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/prompts")
        assert response.status_code in [401, 403], f"Expected 401/403 (super_admin gated), got {response.status_code}"
        print(f"PASS: /api/admin/prompts returns {response.status_code} without auth (super_admin gated)")
    
    def test_admin_prompts_invalidate_requires_super_admin(self):
        """Test /api/admin/prompts/invalidate POST returns auth block without auth"""
        response = requests.post(f"{BASE_URL}/api/admin/prompts/invalidate")
        assert response.status_code in [401, 403], f"Expected 401/403 (super_admin gated), got {response.status_code}"
        print(f"PASS: /api/admin/prompts/invalidate POST returns {response.status_code} without auth")
    
    def test_admin_users_requires_super_admin(self):
        """Test /api/admin/users returns auth block without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code in [401, 403], f"Expected 401/403 (super_admin gated), got {response.status_code}"
        print(f"PASS: /api/admin/users returns {response.status_code} without auth (super_admin gated)")
    
    def test_admin_stats_requires_super_admin(self):
        """Test /api/admin/stats returns auth block without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code in [401, 403], f"Expected 401/403 (super_admin gated), got {response.status_code}"
        print(f"PASS: /api/admin/stats returns {response.status_code} without auth")


class TestProtectedEndpoints:
    """Test that all protected endpoints require authentication (401/403/422)"""
    
    AUTH_BLOCKED_CODES = [401, 403, 422]
    
    # Generation routes (extracted to routes/generation.py)
    def test_chat_post_requires_auth(self):
        """Test /api/chat POST returns 403 without auth"""
        response = requests.post(f"{BASE_URL}/api/chat", json={"message": "test"})
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/chat POST returns {response.status_code} without auth")
    
    def test_chat_history_requires_auth(self):
        """Test /api/chat/history returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/chat/history")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/chat/history returns {response.status_code} without auth")
    
    def test_analyses_get_requires_auth(self):
        """Test /api/analyses GET returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/analyses")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/analyses GET returns {response.status_code} without auth")
    
    def test_analyses_post_requires_auth(self):
        """Test /api/analyses POST returns 403 without auth"""
        response = requests.post(f"{BASE_URL}/api/analyses", json={})
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/analyses POST returns {response.status_code} without auth")
    
    def test_documents_requires_auth(self):
        """Test /api/documents returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/documents")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/documents returns {response.status_code} without auth")
    
    def test_generate_sop_requires_auth(self):
        """Test /api/generate/sop POST returns 403 without auth"""
        response = requests.post(f"{BASE_URL}/api/generate/sop", json={})
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/generate/sop POST returns {response.status_code} without auth")
    
    def test_diagnose_requires_auth(self):
        """Test /api/diagnose POST returns 403 without auth"""
        response = requests.post(f"{BASE_URL}/api/diagnose", json={})
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/diagnose POST returns {response.status_code} without auth")
    
    # Profile routes (extracted to routes/profile.py)
    def test_business_profile_requires_auth(self):
        """Test /api/business-profile returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/business-profile")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/business-profile returns {response.status_code} without auth")
    
    def test_dashboard_stats_requires_auth(self):
        """Test /api/dashboard/stats returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/dashboard/stats returns {response.status_code} without auth")
    
    def test_oac_recommendations_requires_auth(self):
        """Test /api/oac/recommendations returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/oac/recommendations")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/oac/recommendations returns {response.status_code} without auth")
    
    def test_notifications_alerts_requires_auth(self):
        """Test /api/notifications/alerts returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/notifications/alerts")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/notifications/alerts returns {response.status_code} without auth")
    
    # Integrations routes (extracted to routes/integrations.py)
    def test_merge_connected_requires_auth(self):
        """Test /api/integrations/merge/connected returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/integrations/merge/connected")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/integrations/merge/connected returns {response.status_code} without auth")
    
    def test_crm_contacts_requires_auth(self):
        """Test /api/integrations/crm/contacts returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/integrations/crm/contacts")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/integrations/crm/contacts returns {response.status_code} without auth")
    
    def test_intelligence_cold_read_requires_auth(self):
        """Test /api/intelligence/cold-read POST returns 403 without auth"""
        response = requests.post(f"{BASE_URL}/api/intelligence/cold-read")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/intelligence/cold-read POST returns {response.status_code} without auth")
    
    # Calibration routes
    def test_calibration_status_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/calibration/status")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/calibration/status returns {response.status_code} without auth")
    
    def test_calibration_init_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/calibration/init", json={})
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/calibration/init POST returns {response.status_code} without auth")
    
    def test_calibration_brain_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/calibration/brain", json={})
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/calibration/brain POST returns {response.status_code} without auth")
    
    # Email routes
    def test_outlook_status_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/outlook/status")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/outlook/status returns {response.status_code} without auth")
    
    def test_gmail_status_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/gmail/status")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/gmail/status returns {response.status_code} without auth")
    
    # Soundboard routes
    def test_soundboard_conversations_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/soundboard/conversations")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/soundboard/conversations returns {response.status_code} without auth")
    
    def test_soundboard_chat_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/soundboard/chat", json={})
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/soundboard/chat POST returns {response.status_code} without auth")


class TestCognitiveEndpoints:
    """Cognitive Core endpoints tests"""
    AUTH_BLOCKED_CODES = [401, 403, 422]
    
    def test_cognitive_profile_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/cognitive/profile")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/cognitive/profile returns {response.status_code} without auth")
    
    def test_cognitive_escalation_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/cognitive/escalation")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/cognitive/escalation returns {response.status_code} without auth")
    
    def test_advisory_confidence_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/advisory/confidence")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/advisory/confidence returns {response.status_code} without auth")


class TestOnboardingEndpoints:
    """Onboarding routes tests"""
    AUTH_BLOCKED_CODES = [401, 403, 422]
    
    def test_onboarding_status_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/onboarding/status")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/onboarding/status returns {response.status_code} without auth")
    
    def test_onboarding_save_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/onboarding/save", json={})
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"PASS: /api/onboarding/save POST returns {response.status_code} without auth")


class TestMethodValidation:
    """Test that endpoints reject wrong HTTP methods"""
    
    def test_calibration_init_rejects_get(self):
        response = requests.get(f"{BASE_URL}/api/calibration/init")
        assert response.status_code == 405, f"Expected 405, got {response.status_code}"
        print("PASS: /api/calibration/init GET returns 405 Method Not Allowed")
    
    def test_chat_rejects_get(self):
        response = requests.get(f"{BASE_URL}/api/chat")
        assert response.status_code == 405, f"Expected 405, got {response.status_code}"
        print("PASS: /api/chat GET returns 405 Method Not Allowed")


class TestAuthEndpointsPublic:
    """Auth endpoints that should be publicly accessible"""
    
    def test_supabase_oauth_google_returns_200(self):
        response = requests.get(f"{BASE_URL}/api/auth/supabase/oauth/google")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "url" in data or "data" in data, "OAuth endpoint should return URL data"
        print("PASS: /api/auth/supabase/oauth/google returns OAuth URL")


class TestResponseFormat:
    """Test that auth errors return JSON"""
    
    def test_auth_errors_return_json(self):
        response = requests.get(f"{BASE_URL}/api/calibration/status")
        content_type = response.headers.get("content-type", "")
        assert "application/json" in content_type, f"Expected JSON content-type, got {content_type}"
        data = response.json()
        assert "detail" in data, "Auth error should have 'detail' field"
        print("PASS: Auth errors return JSON with 'detail' field")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
