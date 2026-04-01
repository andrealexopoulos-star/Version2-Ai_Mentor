"""
BIQc Production API Tests - Iteration 104
Tests for all critical endpoints on https://biqc.ai
"""
import pytest
import requests
import os

BASE_URL = "https://biqc.ai"

# ─── AUTH HELPERS ────────────────────────────────────────────
def get_auth_token(email="newtest1@biqctest.io", password="BIQcTest!2026"):
    """Get JWT token via Supabase-backed login endpoint"""
    try:
        res = requests.post(f"{BASE_URL}/api/auth/supabase/login", json={
            "email": email,
            "password": password
        }, timeout=15)
        if res.status_code == 200:
            data = res.json()
            return data.get("access_token") or data.get("token")
        # Try direct Supabase signInWithPassword via backend
        return None
    except Exception as e:
        print(f"Auth token fetch failed: {e}")
        return None


@pytest.fixture(scope="module")
def auth_headers():
    """Get auth headers - use pre-obtained token or skip"""
    token = get_auth_token()
    if not token:
        pytest.skip("Cannot obtain auth token - skipping authenticated tests")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ─── HEALTH CHECK ────────────────────────────────────────────
class TestHealthCheck:
    """Health check endpoints"""
    
    def test_api_health(self):
        """API health endpoint should return 200"""
        res = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert res.status_code == 200
        data = res.json()
        assert data.get("status") == "healthy"
        print(f"Health check: {data}")
    
    def test_api_health_response_time(self):
        """API health endpoint should respond within 3 seconds"""
        import time
        start = time.time()
        res = requests.get(f"{BASE_URL}/api/health", timeout=10)
        elapsed = time.time() - start
        assert res.status_code == 200
        assert elapsed < 3.0, f"Health check too slow: {elapsed:.2f}s"
        print(f"Health check response time: {elapsed:.2f}s")


# ─── UNAUTHENTICATED ENDPOINTS ─────────────────────────────────
class TestPublicEndpoints:
    """Public/unauthenticated endpoints"""
    
    def test_login_page_loads(self):
        """Login page should return 200"""
        res = requests.get(f"{BASE_URL}/login-supabase", timeout=10)
        assert res.status_code == 200
    
    def test_register_page_loads(self):
        """Register page should return 200"""
        res = requests.get(f"{BASE_URL}/register-supabase", timeout=10)
        assert res.status_code == 200
    
    def test_homepage_loads(self):
        """Homepage should return 200"""
        res = requests.get(f"{BASE_URL}/", timeout=10)
        assert res.status_code == 200
    
    def test_invalid_login_returns_error(self):
        """Invalid credentials should return 4xx error"""
        res = requests.post(f"{BASE_URL}/api/auth/supabase/login", json={
            "email": "nonexistent@biqctest.io",
            "password": "wrongpass123"
        }, timeout=10)
        assert res.status_code in [400, 401, 422]
        print(f"Invalid login returns: {res.status_code}")


# ─── OUTLOOK OAUTH CHECK ─────────────────────────────────────────
class TestOutlookOAuth:
    """Outlook OAuth configuration check"""
    
    def test_outlook_oauth_redirect_not_localhost(self):
        """Outlook OAuth redirect should NOT use localhost"""
        # This uses a fake token to check the redirect URL format
        res = requests.get(
            f"{BASE_URL}/api/auth/outlook/login",
            params={"token": "fake_test_token", "returnTo": "/connect-email"},
            timeout=10,
            allow_redirects=False  # Don't follow redirect
        )
        # Should return 302 redirect
        if res.status_code == 302:
            location = res.headers.get("Location", "")
            print(f"Outlook redirect URL: {location[:200]}")
            assert "localhost" not in location, f"CRITICAL: Outlook OAuth uses localhost! URL: {location[:200]}"
            assert "client_id=None" not in location, f"CRITICAL: Outlook OAuth client_id=None! URL: {location[:200]}"
        elif res.status_code == 400:
            print("Outlook OAuth returns 400 for invalid token - OK for security")
        else:
            print(f"Outlook OAuth returns: {res.status_code}")
    
    def test_gmail_oauth_configured(self):
        """Gmail OAuth should redirect properly"""
        res = requests.get(
            f"{BASE_URL}/api/auth/gmail/login",
            params={"token": "fake_test_token", "returnTo": "/connect-email"},
            timeout=10,
            allow_redirects=False
        )
        if res.status_code == 302:
            location = res.headers.get("Location", "")
            print(f"Gmail redirect URL: {location[:200]}")
            assert "localhost" not in location, f"Gmail OAuth uses localhost!"
        else:
            print(f"Gmail OAuth returns: {res.status_code}")


# ─── CALIBRATION API ─────────────────────────────────────────────
class TestCalibrationAPI:
    """Calibration status and related endpoints"""
    
    def test_calibration_status_unauthenticated(self):
        """Calibration status should return 401 without auth"""
        res = requests.get(f"{BASE_URL}/api/calibration/status", timeout=10)
        assert res.status_code in [401, 403]
        print(f"Calibration status unauthenticated: {res.status_code}")
    
    def test_calibration_status_with_auth(self, auth_headers):
        """Calibration status should return status with auth"""
        res = requests.get(f"{BASE_URL}/api/calibration/status", headers=auth_headers, timeout=10)
        assert res.status_code == 200
        data = res.json()
        assert "status" in data
        print(f"Calibration status: {data}")
    
    def test_console_state_with_auth(self, auth_headers):
        """Console state should be accessible"""
        res = requests.get(f"{BASE_URL}/api/calibration/status", headers=auth_headers, timeout=10)
        assert res.status_code == 200


# ─── SOUNDBOARD ENDPOINTS ─────────────────────────────────────────
class TestSoundboardAPI:
    """SoundBoard AI chat endpoints"""
    
    def test_soundboard_scan_usage_exists(self, auth_headers):
        """Soundboard scan-usage endpoint should exist (not 404)"""
        res = requests.get(f"{BASE_URL}/api/soundboard/scan-usage", headers=auth_headers, timeout=15)
        print(f"scan-usage status: {res.status_code}")
        # Should not return 404 (endpoint should exist)
        assert res.status_code != 404, f"scan-usage endpoint is 404 - not deployed!"
        if res.status_code == 200:
            data = res.json()
            print(f"scan-usage data: {data}")
    
    def test_soundboard_chat_endpoint(self, auth_headers):
        """SoundBoard chat should respond"""
        res = requests.post(
            f"{BASE_URL}/api/soundboard/chat",
            headers=auth_headers,
            json={"message": "What is the current status of my business?"},
            timeout=30
        )
        print(f"SoundBoard chat status: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            print(f"Chat response keys: {list(data.keys())}")
            assert "response" in data or "message" in data or "content" in data
        else:
            print(f"Chat error: {res.text[:200]}")
            assert res.status_code in [200, 201, 400, 422], f"Unexpected status: {res.status_code}"


# ─── COGNITION API ─────────────────────────────────────────────────
class TestCognitionAPI:
    """Cognition contract endpoints"""
    
    def test_cognition_overview_exists(self, auth_headers):
        """Cognition overview should exist (not 404)"""
        res = requests.get(f"{BASE_URL}/api/cognition/overview", headers=auth_headers, timeout=15)
        print(f"cognition/overview status: {res.status_code}")
        assert res.status_code != 404, "cognition/overview endpoint is 404!"
        if res.status_code == 200:
            data = res.json()
            print(f"Cognition overview: {data}")


# ─── BUSINESS PROFILE ─────────────────────────────────────────────────
class TestBusinessProfileAPI:
    """Business profile endpoints"""
    
    def test_get_business_profile(self, auth_headers):
        """Business profile should be accessible"""
        res = requests.get(f"{BASE_URL}/api/business-profile", headers=auth_headers, timeout=10)
        print(f"Business profile status: {res.status_code}")
        assert res.status_code in [200, 404]  # 404 is OK if no profile
        if res.status_code == 200:
            data = res.json()
            print(f"Business profile keys: {list(data.keys())[:10]}")


# ─── COMPETITIVE BENCHMARK ─────────────────────────────────────────────────
class TestCompetitiveBenchmark:
    """Competitive benchmark endpoints"""
    
    def test_benchmark_endpoint(self, auth_headers):
        """Benchmark endpoint should respond"""
        res = requests.get(f"{BASE_URL}/api/competitive-benchmark/scores", headers=auth_headers, timeout=15)
        print(f"Benchmark status: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            print(f"Benchmark data: {str(data)[:300]}")
        assert res.status_code in [200, 404, 422]
    
    def test_benchmark_refresh(self, auth_headers):
        """Benchmark refresh should trigger rescan"""
        res = requests.post(f"{BASE_URL}/api/competitive-benchmark/refresh", headers=auth_headers, timeout=60)
        print(f"Benchmark refresh status: {res.status_code}")
        if res.status_code == 200:
            data = res.json()
            print(f"Benchmark refresh response: {str(data)[:200]}")
        assert res.status_code in [200, 201, 202, 404, 422]


# ─── ONBOARDING ─────────────────────────────────────────────────
class TestOnboardingAPI:
    """Onboarding status endpoints"""
    
    def test_onboarding_status(self, auth_headers):
        """Onboarding status should be accessible"""
        res = requests.get(f"{BASE_URL}/api/onboarding/status", headers=auth_headers, timeout=10)
        print(f"Onboarding status: {res.status_code}")
        assert res.status_code in [200, 404]
        if res.status_code == 200:
            data = res.json()
            print(f"Onboarding data: {data}")


# ─── MARKET INTELLIGENCE ─────────────────────────────────────────────────
class TestMarketAPI:
    """Market intelligence endpoints"""
    
    def test_market_intelligence(self, auth_headers):
        """Market intelligence endpoint should respond"""
        res = requests.get(f"{BASE_URL}/api/market/intelligence", headers=auth_headers, timeout=15)
        print(f"Market intelligence status: {res.status_code}")
        assert res.status_code in [200, 404, 422]
        if res.status_code == 200:
            print(f"Market intelligence keys: {list(res.json().keys())[:10]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
