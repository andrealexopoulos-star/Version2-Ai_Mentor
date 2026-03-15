"""
Iteration 103: Production Forensic Backend Tests
Tests backend API at https://advisor-engine.preview.emergentagent.com
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    pytest.skip("REACT_APP_BACKEND_URL not set", allow_module_level=True)

class TestHealth:
    """Health and core endpoint checks"""
    
    def test_health_endpoint(self):
        res = requests.get(f"{BASE_URL}/api/health", timeout=15)
        assert res.status_code == 200
        print(f"Health: {res.json()}")
    
    def test_calibration_status_unauthenticated(self):
        """Calibration status endpoint - requires auth"""
        res = requests.get(f"{BASE_URL}/api/calibration/status", timeout=10)
        assert res.status_code in [401, 403, 422]
        print(f"Calibration status unauth: {res.status_code}")
    
    def test_console_state_get_unauthenticated(self):
        """Console state endpoint - test with correct method"""
        # Try GET
        res_get = requests.get(f"{BASE_URL}/api/console/state", timeout=10)
        # Try POST
        res_post = requests.post(f"{BASE_URL}/api/console/state", json={}, timeout=10)
        print(f"Console state GET: {res_get.status_code}, POST: {res_post.status_code}")
        # Either should require auth (401/403) or not exist (404)
        assert res_get.status_code in [401, 403, 404, 405, 422]
        assert res_post.status_code in [401, 403, 404, 405, 422]

class TestAuthEndpoints:
    """Auth API tests - verify Supabase auth is working"""
    
    def test_auth_me_unauthenticated(self):
        res = requests.get(f"{BASE_URL}/api/auth/supabase/me", timeout=10)
        assert res.status_code in [401, 403, 422]
        print(f"Auth me unauth: {res.status_code}")
    
    def test_auth_me_invalid_token(self):
        res = requests.get(
            f"{BASE_URL}/api/auth/supabase/me",
            headers={"Authorization": "Bearer invalid_token_xyz"},
            timeout=10
        )
        assert res.status_code in [401, 403]

class TestBusinessProfileEndpoints:
    
    def test_business_profile_unauthenticated(self):
        res = requests.get(f"{BASE_URL}/api/business-profile", timeout=10)
        assert res.status_code in [401, 403, 422]
        print(f"Business profile GET unauth: {res.status_code}")
    
    def test_business_profile_put_unauthenticated(self):
        res = requests.put(f"{BASE_URL}/api/business-profile", json={"business_name": "test"}, timeout=10)
        assert res.status_code in [401, 403, 422]

class TestIntelligenceEndpoints:
    """Intelligence API endpoints"""
    
    def test_market_intelligence_endpoint(self):
        """Check market intelligence endpoint"""
        # Try common market endpoints
        for path in ['/api/intelligence/market', '/api/market', '/api/market-analysis']:
            res = requests.get(f"{BASE_URL}{path}", timeout=10)
            print(f"Market {path}: {res.status_code}")
            if res.status_code != 404:
                assert res.status_code in [401, 403, 200, 422]
    
    def test_watchtower_endpoint(self):
        """Check watchtower endpoint"""
        for path in ['/api/watchtower', '/api/watchtower/events', '/api/alerts']:
            res = requests.get(f"{BASE_URL}{path}", timeout=10)
            print(f"Watchtower {path}: {res.status_code}")
            if res.status_code != 404:
                assert res.status_code in [401, 403, 200, 422]
    
    def test_advisor_endpoint(self):
        """Check advisor/soundboard endpoint"""
        for path in ['/api/soundboard', '/api/advisor', '/api/soundboard/message']:
            res = requests.post(f"{BASE_URL}{path}", json={"message": "hello"}, timeout=10)
            print(f"Soundboard {path}: {res.status_code}")

class TestDecisionsEndpoints:
    
    def test_decisions_get(self):
        res = requests.get(f"{BASE_URL}/api/decisions", timeout=10)
        print(f"Decisions GET: {res.status_code}")
        assert res.status_code in [401, 403, 404, 422]
    
    def test_decisions_post_unauthenticated(self):
        res = requests.post(f"{BASE_URL}/api/decisions", json={"title": "test"}, timeout=10)
        print(f"Decisions POST: {res.status_code}")
        assert res.status_code in [401, 403, 404, 405, 422]

class TestOnboardingEndpoints:
    
    def test_onboarding_status_unauthenticated(self):
        res = requests.get(f"{BASE_URL}/api/onboarding/status", timeout=10)
        assert res.status_code in [401, 403, 422]
        print(f"Onboarding status: {res.status_code}")

class TestIntegrationsEndpoints:
    
    def test_integrations_list_unauthenticated(self):
        res = requests.get(f"{BASE_URL}/api/integrations", timeout=10)
        print(f"Integrations: {res.status_code}")
        assert res.status_code in [401, 403, 404, 422]
    
    def test_outlook_connect_unauthenticated(self):
        for path in ['/api/integrations/outlook/connect', '/api/email/outlook/connect']:
            res = requests.get(f"{BASE_URL}{path}", timeout=10)
            print(f"Outlook {path}: {res.status_code}")
    
    def test_gmail_connect_unauthenticated(self):
        for path in ['/api/integrations/gmail/connect', '/api/email/gmail/connect']:
            res = requests.get(f"{BASE_URL}{path}", timeout=10)
            print(f"Gmail {path}: {res.status_code}")

class TestRevenueEndpoints:
    
    def test_revenue_endpoint(self):
        for path in ['/api/revenue', '/api/revenue/summary']:
            res = requests.get(f"{BASE_URL}{path}", timeout=10)
            print(f"Revenue {path}: {res.status_code}")

class TestSettingsEndpoints:
    
    def test_settings_profile_unauthenticated(self):
        for path in ['/api/profile', '/api/settings', '/api/auth/supabase/me']:
            res = requests.get(f"{BASE_URL}{path}", timeout=10)
            print(f"Settings {path}: {res.status_code}")
            if path == '/api/auth/supabase/me':
                assert res.status_code in [401, 403, 422]

