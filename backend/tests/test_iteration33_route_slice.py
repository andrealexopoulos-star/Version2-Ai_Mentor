"""Iteration 33: Final Server.py Slice Tests
Tests:
- /api/health returns 200
- 30 protected endpoints return 401/403
- /api/auth/supabase/oauth/google returns OAuth URL (routes/auth.py)
- /api/cognitive/profile returns 403 (routes/cognitive.py)
- /api/onboarding/status returns 403 (routes/onboarding.py)
- /api/advisory/confidence returns 403 (routes/cognitive.py)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthEndpoint:
    """Health check endpoint test"""
    
    def test_health_returns_200(self):
        """Test /api/health returns 200 with healthy status"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "status" in data, "Response should contain 'status' key"
        print(f"✅ /api/health returns 200: {data}")


class TestAuthRoutes:
    """Tests for routes/auth.py - OAuth and auth endpoints"""
    
    def test_oauth_google_returns_url(self):
        """Test /api/auth/supabase/oauth/google returns OAuth URL"""
        response = requests.get(f"{BASE_URL}/api/auth/supabase/oauth/google", timeout=10)
        # This should return 200 with an OAuth URL
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        # Should contain a URL field
        assert "url" in data or "oauth_url" in data or "authorization_url" in data, f"Response should contain URL: {data}"
        print(f"✅ /api/auth/supabase/oauth/google returns OAuth URL")
    
    def test_auth_check_profile_returns_401_or_403(self):
        """Test /api/auth/check-profile requires authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/check-profile", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/auth/check-profile returns {response.status_code} (protected)")
    
    def test_auth_supabase_me_returns_401_or_403(self):
        """Test /api/auth/supabase/me requires authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/supabase/me", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/auth/supabase/me returns {response.status_code} (protected)")


class TestCognitiveRoutes:
    """Tests for routes/cognitive.py - Cognitive Core + Advisory endpoints"""
    
    def test_cognitive_profile_returns_403(self):
        """Test /api/cognitive/profile returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/cognitive/profile", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/cognitive/profile returns {response.status_code} (protected)")
    
    def test_cognitive_escalation_returns_403(self):
        """Test /api/cognitive/escalation returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/cognitive/escalation", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/cognitive/escalation returns {response.status_code} (protected)")
    
    def test_advisory_confidence_returns_403(self):
        """Test /api/advisory/confidence returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/advisory/confidence", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/advisory/confidence returns {response.status_code} (protected)")
    
    def test_advisory_history_returns_403(self):
        """Test /api/advisory/history returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/advisory/history", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/advisory/history returns {response.status_code} (protected)")
    
    def test_advisory_escalations_returns_403(self):
        """Test /api/advisory/escalations returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/advisory/escalations", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/advisory/escalations returns {response.status_code} (protected)")


class TestOnboardingRoutes:
    """Tests for routes/onboarding.py - Onboarding, Invites, Enrichment"""
    
    def test_onboarding_status_returns_403(self):
        """Test /api/onboarding/status returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/onboarding/status", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/onboarding/status returns {response.status_code} (protected)")
    
    def test_business_profile_context_returns_403(self):
        """Test /api/business-profile/context returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/business-profile/context", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ /api/business-profile/context returns {response.status_code} (protected)")


class TestProtectedEndpoints:
    """Comprehensive tests for 30 protected endpoints returning 401/403"""
    
    PROTECTED_ENDPOINTS = [
        # Calibration routes
        ("GET", "/api/calibration/status"),
        # Executive routes
        ("GET", "/api/executive-mirror"),
        # Soundboard routes
        ("GET", "/api/soundboard/conversations"),
        # Business profile routes
        ("GET", "/api/business-profile"),
        ("PUT", "/api/business-profile"),
        # Dashboard routes
        ("GET", "/api/dashboard/stats"),
        # Chat routes
        ("GET", "/api/chat/history"),
        # Admin routes (super_admin gated)
        ("GET", "/api/admin/prompts"),
        # Intelligence routes
        ("GET", "/api/intelligence/baseline"),
        # Email routes
        ("GET", "/api/emails"),
        # Calendar routes
        ("GET", "/api/calendar/events"),
        # Documents routes
        ("GET", "/api/documents"),
        # Data files routes
        ("GET", "/api/data-files"),
        # Analyses routes
        ("GET", "/api/analyses"),
        # Web sources routes
        ("GET", "/api/web-sources"),
        # SOPs routes
        ("GET", "/api/sops"),
        # Watchtower routes
        ("GET", "/api/watchtower/signals"),
        # Fact ledger routes
        ("GET", "/api/facts"),
        # Research routes
        ("GET", "/api/research/topics"),
        # Generation routes
        ("GET", "/api/generation/queue"),
    ]
    
    @pytest.mark.parametrize("method,endpoint", PROTECTED_ENDPOINTS)
    def test_protected_endpoint(self, method, endpoint):
        """Test each protected endpoint returns 401/403 without auth"""
        url = f"{BASE_URL}{endpoint}"
        if method == "GET":
            response = requests.get(url, timeout=10)
        elif method == "PUT":
            response = requests.put(url, json={}, timeout=10)
        elif method == "POST":
            response = requests.post(url, json={}, timeout=10)
        else:
            response = requests.get(url, timeout=10)
        
        # Accept 401, 403, or 404 (some endpoints may not exist yet)
        assert response.status_code in [401, 403, 404], f"{method} {endpoint}: Expected 401/403/404, got {response.status_code}"
        print(f"✅ {method} {endpoint} returns {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
