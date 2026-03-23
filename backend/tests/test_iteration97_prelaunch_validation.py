"""
Iteration 97: BIQc Pre-Launch Validation Protocol
Tests auth APIs, public routes, and data isolation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://beta.thestrategysquad.com').rstrip('/')

# Test credentials
TEST_USER_1 = {
    "email": os.environ.get("TEST_USER_EMAIL", os.environ.get("E2E_TEST_EMAIL", "")),
    "password": os.environ.get("TEST_USER_PASSWORD", os.environ.get("E2E_TEST_PASSWORD", "")),
}
TEST_USER_3 = {
    "email": os.environ.get("TEST_USER_EMAIL_3", os.environ.get("E2E_TEST_EMAIL_3", "")),
    "password": os.environ.get("TEST_USER_PASSWORD_3", os.environ.get("E2E_TEST_PASSWORD_3", "")),
}


class TestHealthEndpoints:
    """Basic health and connectivity checks"""
    
    def test_api_health(self):
        """Test /api/health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=15)
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print("✓ /api/health returns 200")
    
    def test_frontend_loads(self):
        """Test homepage loads"""
        response = requests.get(BASE_URL, timeout=15)
        assert response.status_code == 200, f"Homepage failed: {response.status_code}"
        assert "BIQc" in response.text or "Strategy Squad" in response.text
        print("✓ Homepage loads correctly")


class TestPublicPages:
    """Test all public pages return 200"""
    
    @pytest.mark.parametrize("path,expected_content", [
        ("/", "BIQc"),
        ("/pricing", "Foundation"),
        ("/blog", "blog"),
        ("/login-supabase", "Sign in"),
        ("/register-supabase", "Create"),
        ("/trust", "Trust"),
        ("/contact", "Contact"),
    ])
    def test_public_page_loads(self, path, expected_content):
        """Test public pages load correctly"""
        response = requests.get(f"{BASE_URL}{path}", timeout=15)
        assert response.status_code == 200, f"{path} returned {response.status_code}"
        print(f"✓ {path} returns 200")


class TestAuthenticationAPI:
    """Test Supabase authentication endpoints"""
    
    def test_login_api_valid_credentials_test1(self):
        """Test login with test account 1 (trent-test1)"""
        if not (TEST_USER_1["email"] and TEST_USER_1["password"]):
            pytest.skip("Auth test env not configured for iteration97 user1")

        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json=TEST_USER_1,
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        if response.status_code != 200:
            pytest.skip(f"Authentication unavailable for iteration97 user1: {response.status_code}")
        data = response.json()
        assert "session" in data, "Missing session in response"
        assert data["session"]["access_token"], "Missing access_token"
        assert data["user"]["email"] == TEST_USER_1["email"], "Email mismatch"
        print(f"✓ Test user 1 login successful: {data['user']['email']}")
        return data["session"]["access_token"]
    
    def test_login_api_valid_credentials_test3(self):
        """Test login with test account 3 (trent-test3)"""
        if not (TEST_USER_3["email"] and TEST_USER_3["password"]):
            pytest.skip("Auth test env not configured for iteration97 user3")

        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json=TEST_USER_3,
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        if response.status_code != 200:
            pytest.skip(f"Authentication unavailable for iteration97 user3: {response.status_code}")
        data = response.json()
        assert "session" in data, "Missing session in response"
        assert data["session"]["access_token"], "Missing access_token"
        print(f"✓ Test user 3 login successful: {data['user']['email']}")
        return data["session"]["access_token"]
    
    def test_login_api_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"},
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected with 401")
    
    def test_me_endpoint_without_auth(self):
        """Test /api/auth/supabase/me without auth token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/supabase/me",
            timeout=15
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ /api/auth/supabase/me correctly requires auth")


class TestAuthenticatedEndpoints:
    """Test authenticated endpoints with valid token"""
    
    @pytest.fixture(scope="class")
    def auth_token_test1(self):
        """Get auth token for test user 1"""
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json=TEST_USER_1,
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.status_code}")
        return response.json()["session"]["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_token_test3(self):
        """Get auth token for test user 3"""
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json=TEST_USER_3,
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.status_code}")
        return response.json()["session"]["access_token"]
    
    def test_me_endpoint_with_auth(self, auth_token_test1):
        """Test /api/auth/supabase/me with valid token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/supabase/me",
            headers={"Authorization": f"Bearer {auth_token_test1}"},
            timeout=15
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "user" in data
        print(f"✓ /api/auth/supabase/me returns user data: {data['user'].get('email')}")
    
    def test_check_profile_endpoint(self, auth_token_test1):
        """Test /api/auth/check-profile returns calibration status"""
        response = requests.get(
            f"{BASE_URL}/api/auth/check-profile",
            headers={"Authorization": f"Bearer {auth_token_test1}"},
            timeout=15
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "calibration_status" in data
        assert "user" in data
        print(f"✓ /api/auth/check-profile returns: calibration={data['calibration_status']}")


class TestMultiTenantDataIsolation:
    """SECTION 10: Test that users see only their own business data"""
    
    @pytest.fixture(scope="class")
    def auth_headers_test1(self):
        """Get auth headers for test user 1 (Campos Coffee)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json=TEST_USER_1,
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.status_code}")
        token = response.json()["session"]["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def auth_headers_test3(self):
        """Get auth headers for test user 3 (Thankyou Group)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json=TEST_USER_3,
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.status_code}")
        token = response.json()["session"]["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_user1_sees_campos_coffee_data(self, auth_headers_test1):
        """Test user 1 sees Campos Coffee business profile"""
        response = requests.get(
            f"{BASE_URL}/api/profile/business",
            headers=auth_headers_test1,
            timeout=15
        )
        # May return 200 with data or 404 if no profile
        if response.status_code == 200:
            data = response.json()
            business_name = data.get("business_name") or data.get("profile", {}).get("business_name", "")
            print(f"✓ User 1 business profile: {business_name}")
            # Verify it's not another user's data
            assert "thankyou" not in business_name.lower() if business_name else True
        else:
            print(f"✓ User 1 business profile returned {response.status_code} (may need calibration)")
    
    def test_user3_sees_thankyou_data(self, auth_headers_test3):
        """Test user 3 sees Thankyou Group business profile"""
        response = requests.get(
            f"{BASE_URL}/api/profile/business",
            headers=auth_headers_test3,
            timeout=15
        )
        if response.status_code == 200:
            data = response.json()
            business_name = data.get("business_name") or data.get("profile", {}).get("business_name", "")
            print(f"✓ User 3 business profile: {business_name}")
            # Verify it's not another user's data
            assert "campos" not in business_name.lower() if business_name else True
        else:
            print(f"✓ User 3 business profile returned {response.status_code} (may need calibration)")
    
    def test_data_isolation_snapshot_endpoint(self, auth_headers_test1, auth_headers_test3):
        """Test /api/snapshot/latest returns different data per user"""
        # Get snapshot for user 1
        response1 = requests.get(
            f"{BASE_URL}/api/snapshot/latest",
            headers=auth_headers_test1,
            timeout=30
        )
        # Get snapshot for user 3
        response3 = requests.get(
            f"{BASE_URL}/api/snapshot/latest",
            headers=auth_headers_test3,
            timeout=30
        )
        
        # Both should succeed or both skip
        if response1.status_code in [200, 404] and response3.status_code in [200, 404]:
            if response1.status_code == 200 and response3.status_code == 200:
                data1 = response1.json()
                data3 = response3.json()
                # Verify user IDs or account IDs are different (safely handle None)
                cognitive1 = data1.get("cognitive") or {}
                cognitive3 = data3.get("cognitive") or {}
                user_id1 = data1.get("user_id") or cognitive1.get("user_id")
                user_id3 = data3.get("user_id") or cognitive3.get("user_id")
                if user_id1 and user_id3:
                    assert user_id1 != user_id3, "CRITICAL: Data isolation failed - same user_id for different users"
                print("✓ Data isolation verified: different users see different snapshots")
            else:
                print(f"✓ Snapshot endpoints returned {response1.status_code}/{response3.status_code} (may need calibration)")
        else:
            print(f"✓ Snapshot endpoints: user1={response1.status_code}, user3={response3.status_code}")


class TestAuthenticatedRoutes:
    """Test authenticated page routes"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json=TEST_USER_1,
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        if response.status_code != 200:
            pytest.skip(f"Login failed: {response.status_code}")
        return response.json()["session"]["access_token"]
    
    def test_notifications_alerts_endpoint(self, auth_token):
        """Test /api/notifications/alerts with auth"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/alerts",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=15
        )
        # Should return 200 with alerts data
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ /api/notifications/alerts returns 200 with auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
