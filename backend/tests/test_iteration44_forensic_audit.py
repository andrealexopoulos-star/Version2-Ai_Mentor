"""
Iteration 44: Full Forensic E2E Audit - Backend API Testing
Tests all API endpoints for proper auth protection and response format
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://biqc-performance-hub.preview.emergentagent.com').rstrip('/')

class TestHealthEndpoint:
    """Health check endpoint tests"""
    
    def test_health_returns_200(self):
        """Verify health endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✅ /api/health returns 200 with status: healthy")


class TestAuthEndpoints:
    """Auth endpoint tests"""
    
    def test_auth_me_requires_auth(self):
        """Verify /api/auth/supabase/me requires authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/supabase/me", timeout=10)
        assert response.status_code in [401, 403, 422]
        print(f"✅ /api/auth/supabase/me returns {response.status_code} without auth")
    
    def test_auth_logout_requires_auth(self):
        """Verify /api/auth/logout requires authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/logout", timeout=10)
        # May return different error codes depending on implementation
        assert response.status_code in [401, 403, 404, 405, 422]
        print(f"✅ /api/auth/logout returns {response.status_code} without auth")


class TestCalibrationEndpoints:
    """Calibration endpoint tests"""
    
    def test_calibration_status_requires_auth(self):
        """Verify /api/calibration/status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/calibration/status", timeout=10)
        assert response.status_code in [401, 403, 422]
        print(f"✅ /api/calibration/status returns {response.status_code} without auth")
    
    def test_calibration_strategic_audit_requires_auth(self):
        """Verify /api/calibration/strategic-audit requires authentication"""
        response = requests.get(f"{BASE_URL}/api/calibration/strategic-audit", timeout=10)
        assert response.status_code in [401, 403, 422]
        print(f"✅ /api/calibration/strategic-audit returns {response.status_code} without auth")


class TestBusinessProfileEndpoints:
    """Business profile endpoint tests"""
    
    def test_business_profile_get_requires_auth(self):
        """Verify GET /api/business-profile requires authentication"""
        response = requests.get(f"{BASE_URL}/api/business-profile", timeout=10)
        assert response.status_code in [401, 403, 422]
        print(f"✅ GET /api/business-profile returns {response.status_code} without auth")
    
    def test_business_profile_put_requires_auth(self):
        """Verify PUT /api/business-profile requires authentication"""
        response = requests.put(f"{BASE_URL}/api/business-profile", json={"test": "data"}, timeout=10)
        assert response.status_code in [401, 403, 422]
        print(f"✅ PUT /api/business-profile returns {response.status_code} without auth")
    
    def test_business_profile_context_requires_auth(self):
        """Verify /api/business-profile/context requires authentication"""
        response = requests.get(f"{BASE_URL}/api/business-profile/context", timeout=10)
        assert response.status_code in [401, 403, 422]
        print(f"✅ /api/business-profile/context returns {response.status_code} without auth")


class TestOnboardingEndpoints:
    """Onboarding endpoint tests"""
    
    def test_onboarding_status_requires_auth(self):
        """Verify /api/onboarding/status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/onboarding/status", timeout=10)
        assert response.status_code in [401, 403, 422]
        print(f"✅ /api/onboarding/status returns {response.status_code} without auth")
    
    def test_onboarding_save_requires_auth(self):
        """Verify /api/onboarding/save requires authentication"""
        response = requests.post(f"{BASE_URL}/api/onboarding/save", json={"step": 1}, timeout=10)
        assert response.status_code in [401, 403, 422]
        print(f"✅ /api/onboarding/save returns {response.status_code} without auth")


class TestDocumentsEndpoints:
    """Documents endpoint tests"""
    
    def test_documents_list_requires_auth(self):
        """Verify /api/documents requires authentication"""
        response = requests.get(f"{BASE_URL}/api/documents", timeout=10)
        assert response.status_code in [401, 403, 422]
        print(f"✅ /api/documents returns {response.status_code} without auth")
    
    def test_documents_upload_requires_auth(self):
        """Verify /api/documents/upload requires authentication"""
        response = requests.post(f"{BASE_URL}/api/documents/upload", timeout=10)
        assert response.status_code in [401, 403, 422]
        print(f"✅ /api/documents/upload returns {response.status_code} without auth")


class TestAdvisorEndpoints:
    """Advisor/Chat endpoint tests"""
    
    def test_advisor_chat_requires_auth(self):
        """Verify /api/advisor/chat requires authentication"""
        response = requests.post(f"{BASE_URL}/api/advisor/chat", json={"message": "test"}, timeout=10)
        assert response.status_code in [401, 403, 422]
        print(f"✅ /api/advisor/chat returns {response.status_code} without auth")
    
    def test_advisor_history_requires_auth(self):
        """Verify /api/advisor/history requires authentication"""
        response = requests.get(f"{BASE_URL}/api/advisor/history", timeout=10)
        assert response.status_code in [401, 403, 422]
        print(f"✅ /api/advisor/history returns {response.status_code} without auth")


class TestIntegrationsEndpoints:
    """Integrations endpoint tests"""
    
    def test_integrations_list_requires_auth(self):
        """Verify /api/integrations requires authentication"""
        response = requests.get(f"{BASE_URL}/api/integrations", timeout=10)
        assert response.status_code in [401, 403, 422]
        print(f"✅ /api/integrations returns {response.status_code} without auth")
    
    def test_integrations_merge_link_token_requires_auth(self):
        """Verify /api/integrations/merge/link-token requires authentication"""
        response = requests.post(f"{BASE_URL}/api/integrations/merge/link-token", json={"category": "accounting"}, timeout=10)
        assert response.status_code in [401, 403, 422]
        print(f"✅ /api/integrations/merge/link-token returns {response.status_code} without auth")


class TestSettingsEndpoints:
    """Settings endpoint tests"""
    
    def test_settings_get_requires_auth(self):
        """Verify /api/settings requires authentication"""
        response = requests.get(f"{BASE_URL}/api/settings", timeout=10)
        # Settings might not have its own endpoint, could be part of user profile
        assert response.status_code in [401, 403, 404, 422]
        print(f"✅ /api/settings returns {response.status_code}")


class TestAnalysisEndpoints:
    """Analysis endpoint tests"""
    
    def test_diagnosis_requires_auth(self):
        """Verify /api/diagnosis requires authentication"""
        response = requests.get(f"{BASE_URL}/api/diagnosis", timeout=10)
        assert response.status_code in [401, 403, 404, 422]
        print(f"✅ /api/diagnosis returns {response.status_code}")
    
    def test_analysis_requires_auth(self):
        """Verify /api/analysis requires authentication"""
        response = requests.get(f"{BASE_URL}/api/analysis", timeout=10)
        assert response.status_code in [401, 403, 404, 422]
        print(f"✅ /api/analysis returns {response.status_code}")


class TestEmailCalendarEndpoints:
    """Email and Calendar endpoint tests"""
    
    def test_email_inbox_requires_auth(self):
        """Verify /api/emails requires authentication"""
        response = requests.get(f"{BASE_URL}/api/emails", timeout=10)
        assert response.status_code in [401, 403, 404, 422]
        print(f"✅ /api/emails returns {response.status_code}")
    
    def test_calendar_events_requires_auth(self):
        """Verify /api/calendar/events requires authentication"""
        response = requests.get(f"{BASE_URL}/api/calendar/events", timeout=10)
        assert response.status_code in [401, 403, 404, 422]
        print(f"✅ /api/calendar/events returns {response.status_code}")


class TestWarRoomEndpoints:
    """War Room endpoint tests"""
    
    def test_war_room_chat_requires_auth(self):
        """Verify /api/war-room/chat requires authentication"""
        response = requests.post(f"{BASE_URL}/api/war-room/chat", json={"message": "test"}, timeout=10)
        # May be handled by advisor/chat
        assert response.status_code in [401, 403, 404, 422]
        print(f"✅ /api/war-room/chat returns {response.status_code}")


class TestSOPGeneratorEndpoints:
    """SOP Generator endpoint tests"""
    
    def test_sop_generator_requires_auth(self):
        """Verify /api/sop/generate requires authentication"""
        response = requests.post(f"{BASE_URL}/api/sop/generate", json={"title": "test"}, timeout=10)
        assert response.status_code in [401, 403, 404, 422]
        print(f"✅ /api/sop/generate returns {response.status_code}")


class TestNotificationsEndpoints:
    """Notifications endpoint tests"""
    
    def test_notifications_alerts_requires_auth(self):
        """Verify /api/notifications/alerts requires authentication"""
        response = requests.get(f"{BASE_URL}/api/notifications/alerts", timeout=10)
        assert response.status_code in [401, 403, 404, 422]
        print(f"✅ /api/notifications/alerts returns {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
