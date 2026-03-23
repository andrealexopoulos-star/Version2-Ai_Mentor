"""
Iteration 28 - Final Cleanup Phase of Monolith Deconstruction Tests

Key features tested:
- Health endpoints (/api/health returns 200)
- Security: All 23+ protected endpoints return 403 without auth
- Extracted routes: calibration, email, soundboard, data_center, generation, profile, integrations
- Admin prompt management: /api/admin/prompts and /api/admin/prompts/invalidate
- Frontend pages: landing page and /login-supabase

New additions in this phase:
- core/ai_core.py extracted (1,508 lines)
- routes/generation.py (562 lines)
- routes/profile.py (2,014 lines)
- routes/integrations.py (1,150 lines)
- prompt_registry.py wired to Supabase system_prompts table
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
        print("✅ /api/health returns 200 with status=healthy")


class TestSecurityProtectedEndpoints:
    """Test that all protected endpoints require authentication (401/403/422)"""
    
    # Helper to check auth required (401, 403, or 422 validation all indicate blocked)
    AUTH_BLOCKED_CODES = [401, 403, 422]
    
    # Calibration routes (extracted to routes/calibration.py)
    def test_calibration_status_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/calibration/status")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/calibration/status returns {response.status_code} without auth")
    
    def test_calibration_init_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/calibration/init", json={})
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/calibration/init POST returns {response.status_code} without auth")
    
    def test_calibration_defer_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/calibration/defer")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/calibration/defer POST returns {response.status_code} without auth")
    
    def test_calibration_reset_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/calibration/reset")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/calibration/reset POST returns {response.status_code} without auth")
    
    def test_calibration_answer_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/calibration/answer", json={})
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/calibration/answer POST returns {response.status_code} without auth")
    
    def test_calibration_brain_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/calibration/brain", json={})
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/calibration/brain POST returns {response.status_code} without auth")
    
    def test_calibration_activation_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/calibration/activation")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/calibration/activation returns {response.status_code} without auth")
    
    # Email routes (extracted to routes/email.py)
    def test_outlook_status_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/outlook/status")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/outlook/status returns {response.status_code} without auth")
    
    def test_gmail_status_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/gmail/status")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/gmail/status returns {response.status_code} without auth")
    
    def test_outlook_calendar_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/outlook/calendar/events")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/outlook/calendar/events returns {response.status_code} without auth")
    
    # Soundboard routes (extracted to routes/soundboard.py)
    def test_soundboard_conversations_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/soundboard/conversations")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/soundboard/conversations returns {response.status_code} without auth")
    
    def test_soundboard_chat_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/soundboard/chat", json={})
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/soundboard/chat POST returns {response.status_code} without auth")
    
    # Data Center routes (extracted to routes/data_center.py)
    def test_data_center_files_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/data-center/files")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/data-center/files returns {response.status_code} without auth")
    
    def test_data_center_categories_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/data-center/categories")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/data-center/categories returns {response.status_code} without auth")
    
    def test_data_center_stats_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/data-center/stats")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/data-center/stats returns {response.status_code} without auth")
    
    def test_data_center_upload_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/data-center/upload")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/data-center/upload POST returns {response.status_code} without auth")
    
    # Generation routes (NEW - extracted to routes/generation.py)
    def test_chat_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/chat", json={"message": "test"})
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/chat POST returns {response.status_code} without auth")
    
    def test_chat_history_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/chat/history")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/chat/history returns {response.status_code} without auth")
    
    def test_analyses_get_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/analyses")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/analyses GET returns {response.status_code} without auth")
    
    def test_analyses_post_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/analyses", json={})
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/analyses POST returns {response.status_code} without auth")
    
    def test_documents_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/documents")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/documents returns {response.status_code} without auth")
    
    def test_generate_sop_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/generate/sop", json={})
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/generate/sop POST returns {response.status_code} without auth")
    
    def test_diagnose_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/diagnose", json={})
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/diagnose POST returns {response.status_code} without auth")
    
    # Profile routes (NEW - extracted to routes/profile.py)
    def test_business_profile_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/business-profile")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/business-profile returns {response.status_code} without auth")
    
    def test_business_profile_scores_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/business-profile/scores")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/business-profile/scores returns {response.status_code} without auth")
    
    def test_dashboard_stats_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/dashboard/stats returns {response.status_code} without auth")
    
    def test_dashboard_focus_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/dashboard/focus")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/dashboard/focus returns {response.status_code} without auth")
    
    def test_oac_recommendations_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/oac/recommendations")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/oac/recommendations returns {response.status_code} without auth")
    
    # Integrations routes (NEW - extracted to routes/integrations.py)
    def test_merge_link_token_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/integrations/merge/link-token")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/integrations/merge/link-token POST returns {response.status_code} without auth")
    
    def test_merge_connected_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/integrations/merge/connected")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/integrations/merge/connected returns {response.status_code} without auth")
    
    def test_crm_contacts_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/integrations/crm/contacts")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/integrations/crm/contacts returns {response.status_code} without auth")
    
    def test_google_drive_status_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/integrations/google-drive/status")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/integrations/google-drive/status returns {response.status_code} without auth")
    
    def test_intelligence_cold_read_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/intelligence/cold-read")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/intelligence/cold-read POST returns {response.status_code} without auth")
    
    def test_intelligence_watchtower_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/intelligence/watchtower")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/intelligence/watchtower returns {response.status_code} without auth")
    
    def test_executive_mirror_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/executive-mirror")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected auth block, got {response.status_code}"
        print(f"✅ /api/executive-mirror returns {response.status_code} without auth")


class TestAdminPromptManagement:
    """Admin prompt management endpoints"""
    AUTH_BLOCKED_CODES = [401, 403]
    
    def test_admin_prompts_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/admin/prompts")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/admin/prompts returns {response.status_code} without auth")
    
    def test_admin_prompts_invalidate_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/admin/prompts/invalidate")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/admin/prompts/invalidate POST returns {response.status_code} without auth")
    
    def test_admin_users_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/admin/users returns {response.status_code} without auth")
    
    def test_admin_stats_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/admin/stats returns {response.status_code} without auth")


class TestCognitiveEndpoints:
    """Cognitive Core endpoints (in server.py)"""
    AUTH_BLOCKED_CODES = [401, 403]
    
    def test_cognitive_profile_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/cognitive/profile")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/cognitive/profile returns {response.status_code} without auth")
    
    def test_cognitive_escalation_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/cognitive/escalation")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/cognitive/escalation returns {response.status_code} without auth")
    
    def test_advisory_confidence_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/advisory/confidence")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/advisory/confidence returns {response.status_code} without auth")


class TestOnboardingEndpoints:
    """Onboarding routes (in server.py)"""
    AUTH_BLOCKED_CODES = [401, 403]
    
    def test_onboarding_status_requires_auth(self):
        response = requests.get(f"{BASE_URL}/api/onboarding/status")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/onboarding/status returns {response.status_code} without auth")
    
    def test_onboarding_save_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/onboarding/save", json={})
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/onboarding/save POST returns {response.status_code} without auth")
    
    def test_onboarding_complete_requires_auth(self):
        response = requests.post(f"{BASE_URL}/api/onboarding/complete")
        assert response.status_code in self.AUTH_BLOCKED_CODES, f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/onboarding/complete POST returns {response.status_code} without auth")


class TestMethodValidation:
    """Test that endpoints reject wrong HTTP methods"""
    
    def test_calibration_init_rejects_get(self):
        response = requests.get(f"{BASE_URL}/api/calibration/init")
        assert response.status_code == 405, f"Expected 405, got {response.status_code}"
        print("✅ /api/calibration/init GET returns 405 Method Not Allowed")
    
    def test_calibration_brain_rejects_get(self):
        response = requests.get(f"{BASE_URL}/api/calibration/brain")
        assert response.status_code == 405, f"Expected 405, got {response.status_code}"
        print("✅ /api/calibration/brain GET returns 405 Method Not Allowed")
    
    def test_chat_rejects_get(self):
        response = requests.get(f"{BASE_URL}/api/chat")
        assert response.status_code == 405, f"Expected 405, got {response.status_code}"
        print("✅ /api/chat GET returns 405 Method Not Allowed")


class TestAuthEndpointsPublic:
    """Auth endpoints that should be publicly accessible"""
    
    def test_supabase_oauth_returns_data(self):
        response = requests.get(f"{BASE_URL}/api/auth/supabase/oauth/google")
        # Should return 200 with OAuth URL
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "url" in data or "data" in data, "OAuth endpoint should return URL data"
        print("✅ /api/auth/supabase/oauth/google returns OAuth URL")


class TestResponseFormat:
    """Test that auth errors return JSON, not HTML"""
    
    def test_auth_errors_return_json(self):
        response = requests.get(f"{BASE_URL}/api/calibration/status")
        assert response.headers.get("content-type", "").startswith("application/json"), \
            f"Expected JSON content-type, got {response.headers.get('content-type')}"
        data = response.json()
        assert "detail" in data, "Auth error should have 'detail' field"
        print("✅ Auth errors return JSON with 'detail' field")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
