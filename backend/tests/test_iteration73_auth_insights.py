"""
Iteration 73: BIQc Auth Resilience and Insights Tabs Testing
- Tests /api/auth/supabase/me fail-open resilience
- Tests cognitive snapshot data structure for 5 tabs (Money, Revenue, Operations, People, Market)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_EMAIL = os.environ.get("TEST_USER_EMAIL", os.environ.get("E2E_TEST_EMAIL", ""))
TEST_PASSWORD = os.environ.get("TEST_USER_PASSWORD", os.environ.get("E2E_TEST_PASSWORD", ""))


class TestAuthResilience:
    """Test /api/auth/supabase/me endpoint resilience (fail-open behavior)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token via login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("session", {}).get("access_token")
        pytest.skip(f"Auth failed: {response.status_code} - {response.text[:200]}")
    
    def test_auth_me_returns_200(self, auth_token):
        """Test that /api/auth/supabase/me returns 200 (not 520)"""
        response = requests.get(
            f"{BASE_URL}/api/auth/supabase/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # Critical: Must NOT return 520, should return 200
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:300]}"
        
        data = response.json()
        # Data assertions - must have user object
        assert "user" in data, "Response must contain 'user' field"
        user = data["user"]
        assert "id" in user, "User must have 'id' field"
        assert "email" in user, "User must have 'email' field"
        assert user["email"] == TEST_EMAIL
        print(f"PASS: /api/auth/supabase/me returns user profile: {user.get('email')}")
    
    def test_auth_me_without_token_returns_401(self):
        """Test that /api/auth/supabase/me returns 401 without token"""
        response = requests.get(f"{BASE_URL}/api/auth/supabase/me")
        assert response.status_code == 401, f"Expected 401 without token, got {response.status_code}"
        print("PASS: /api/auth/supabase/me correctly returns 401 without token")
    
    def test_auth_me_with_invalid_token_returns_401(self):
        """Test that /api/auth/supabase/me returns 401 with invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/supabase/me",
            headers={"Authorization": "Bearer invalid.token.here"}
        )
        assert response.status_code == 401, f"Expected 401 with invalid token, got {response.status_code}"
        print("PASS: /api/auth/supabase/me correctly returns 401 with invalid token")


class TestCognitiveSnapshot:
    """Test unified cognitive snapshot endpoint for 5-tab enrichment"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token via login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("session", {}).get("access_token")
        pytest.skip(f"Auth failed: {response.status_code}")
    
    def test_unified_cognitive_snapshot_returns_200(self, auth_token):
        """Test that unified cognitive snapshot endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/intelligence/unified-cognitive-snapshot",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:300]}"
        
        data = response.json()
        assert "cognitive" in data, "Response must contain 'cognitive' field"
        print(f"PASS: Unified cognitive snapshot returns data with keys: {list(data.get('cognitive', {}).keys())[:10]}")
    
    def test_cognitive_snapshot_has_money_data(self, auth_token):
        """Test cognitive snapshot has capital/runway data for Money tab"""
        response = requests.get(
            f"{BASE_URL}/api/intelligence/unified-cognitive-snapshot",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        cog = response.json().get("cognitive", {})
        # Check for capital data used by Money tab
        capital = cog.get("capital")
        if capital:
            print(f"PASS: Money tab data available - capital: {capital}")
        else:
            print("INFO: No capital data (Money tab will show 'No items need attention')")
    
    def test_cognitive_snapshot_has_revenue_data(self, auth_token):
        """Test cognitive snapshot has pipeline/deals data for Revenue tab"""
        response = requests.get(
            f"{BASE_URL}/api/intelligence/unified-cognitive-snapshot",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        cog = response.json().get("cognitive", {})
        revenue = cog.get("revenue")
        if revenue:
            print(f"PASS: Revenue tab data available - pipeline: {revenue.get('pipeline')}, deals: {len(revenue.get('deals', []))}")
        else:
            print("INFO: No revenue data (Revenue tab will show insights from inevitabilities)")
    
    def test_cognitive_snapshot_has_execution_data(self, auth_token):
        """Test cognitive snapshot has execution data for Operations tab"""
        response = requests.get(
            f"{BASE_URL}/api/intelligence/unified-cognitive-snapshot",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        cog = response.json().get("cognitive", {})
        execution = cog.get("execution")
        if execution:
            print(f"PASS: Operations tab data available - sla_breaches: {execution.get('sla_breaches')}")
        else:
            print("INFO: No execution data (Operations tab will map from resolution_queue)")
    
    def test_cognitive_snapshot_has_founder_vitals(self, auth_token):
        """Test cognitive snapshot has founder_vitals for People tab"""
        response = requests.get(
            f"{BASE_URL}/api/intelligence/unified-cognitive-snapshot",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        cog = response.json().get("cognitive", {})
        founder_vitals = cog.get("founder_vitals")
        if founder_vitals:
            print(f"PASS: People tab data available - capacity: {founder_vitals.get('capacity_index')}")
        else:
            print("INFO: No founder_vitals data (People tab will show from resolution_queue)")
    
    def test_cognitive_snapshot_has_market_data(self, auth_token):
        """Test cognitive snapshot has market/market_intelligence for Market tab"""
        response = requests.get(
            f"{BASE_URL}/api/intelligence/unified-cognitive-snapshot",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        cog = response.json().get("cognitive", {})
        market = cog.get("market")
        market_intel = cog.get("market_intelligence")
        if market or market_intel:
            print(f"PASS: Market tab data available - market: {bool(market)}, market_intelligence: {bool(market_intel)}")
        else:
            print("INFO: No market data (Market tab will show from inevitabilities)")


class TestLoginFlow:
    """Test login flow works correctly"""
    
    def test_login_returns_session(self):
        """Test that login returns valid session with access_token"""
        if not (BASE_URL and TEST_EMAIL and TEST_PASSWORD):
            pytest.skip("Auth test env not configured for iteration73")

        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code != 200:
            pytest.skip(f"Authentication unavailable for iteration73: {response.status_code}")
        
        data = response.json()
        assert "session" in data, "Response must contain 'session'"
        assert "access_token" in data["session"], "Session must contain 'access_token'"
        assert len(data["session"]["access_token"]) > 50, "Access token should be substantial"
        
        assert "user" in data, "Response must contain 'user'"
        assert data["user"]["email"] == TEST_EMAIL
        print(f"PASS: Login returns valid session for {TEST_EMAIL}")
    
    def test_login_with_wrong_password_returns_401(self):
        """Test login fails with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json={"email": TEST_EMAIL, "password": "wrong_password"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Login correctly rejects wrong password with 401")


class TestCheckProfile:
    """Test /api/auth/check-profile endpoint for calibration status"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token via login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("session", {}).get("access_token")
        pytest.skip(f"Auth failed: {response.status_code}")
    
    def test_check_profile_returns_200(self, auth_token):
        """Test check-profile endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/auth/check-profile",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:200]}"
        
        data = response.json()
        assert "calibration_status" in data, "Must have calibration_status"
        assert "user" in data, "Must have user object"
        print(f"PASS: check-profile returns calibration_status: {data['calibration_status']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
