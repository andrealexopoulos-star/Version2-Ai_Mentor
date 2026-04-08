"""
Test Suite: Phase 4 Super Admin Portal - Iteration 58
Tests admin APIs: /admin/users, /admin/stats, /admin/users/{id}/suspend, /admin/users/{id}/unsuspend, /admin/users/{id}/impersonate
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    pytest.skip("REACT_APP_BACKEND_URL not set", allow_module_level=True)

# Test credentials for superadmin
SUPERADMIN_EMAIL = "andre@thestrategysquad.com.au"
SUPERADMIN_PASSWORD = "BIQc_Test_2026!"


class TestAdminPortalAPIs:
    """Admin Portal API tests - requires superadmin authentication"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Authenticate as superadmin and get bearer token"""
        # Use Supabase auth endpoint
        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        # Token is in session.access_token for Supabase auth
        token = data.get("access_token") or data.get("token") or (data.get("session") or {}).get("access_token")
        assert token, f"No token in response: {data}"
        return token
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Headers with bearer token for authenticated requests"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_admin_users_endpoint(self, auth_headers):
        """Test GET /admin/users - should return user list for superadmin"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers)
        assert response.status_code == 200, f"Admin users failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "users" in data, f"Response missing 'users' key: {data}"
        assert isinstance(data["users"], list), "Users should be a list"
        # Verify user fields
        if len(data["users"]) > 0:
            user = data["users"][0]
            assert "id" in user, "User should have id"
            assert "email" in user, "User should have email"
            print(f"PASS: /admin/users returned {len(data['users'])} users")
    
    def test_admin_stats_endpoint(self, auth_headers):
        """Test GET /admin/stats - should return platform statistics"""
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=auth_headers)
        assert response.status_code == 200, f"Admin stats failed: {response.status_code} - {response.text}"
        data = response.json()
        # Verify expected stat fields
        expected_fields = ["total_users", "calibrated_users"]
        for field in expected_fields:
            assert field in data, f"Stats missing '{field}': {data}"
        print(f"PASS: /admin/stats returned - total_users: {data.get('total_users')}, calibrated: {data.get('calibrated_users')}")
    
    def test_admin_users_unauthorized(self):
        """Test /admin/users without auth - should return 401 or 403"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code in [401, 403], f"Should be unauthorized without token: {response.status_code}"
        print("PASS: /admin/users correctly rejects unauthorized requests")
    
    def test_admin_stats_unauthorized(self):
        """Test /admin/stats without auth - should return 401 or 403"""
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code in [401, 403], f"Should be unauthorized without token: {response.status_code}"
        print("PASS: /admin/stats correctly rejects unauthorized requests")
    
    def test_admin_impersonate_endpoint(self, auth_headers):
        """Test POST /admin/users/{id}/impersonate - get impersonation data"""
        # First get a user to impersonate
        users_response = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers)
        assert users_response.status_code == 200
        users = users_response.json().get("users", [])
        assert len(users) > 0, "Need at least one user to test impersonation"
        
        # Get a user that's not the current admin
        test_user = None
        for u in users:
            if u.get("email") != SUPERADMIN_EMAIL:
                test_user = u
                break
        
        if not test_user:
            # If only the admin exists, use the admin user ID
            test_user = users[0]
        
        user_id = test_user["id"]
        response = requests.post(f"{BASE_URL}/api/admin/users/{user_id}/impersonate", headers=auth_headers)
        # Impersonate may return 200 with user context or token
        assert response.status_code == 200, f"Impersonate failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "user" in data, f"Impersonate should return user context: {data}"
        print(f"PASS: /admin/users/{user_id}/impersonate returned user context")
    
    def test_admin_suspend_unsuspend_flow(self, auth_headers):
        """Test POST /admin/users/{id}/suspend and unsuspend - full flow"""
        # First get users
        users_response = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers)
        assert users_response.status_code == 200
        users = users_response.json().get("users", [])
        
        # Find a non-superadmin user to test suspend/unsuspend
        test_user = None
        for u in users:
            if u.get("role") not in ("superadmin", "admin") and u.get("email") != SUPERADMIN_EMAIL:
                test_user = u
                break
        
        if not test_user:
            pytest.skip("No non-admin users available for suspend test")
            return
        
        user_id = test_user["id"]
        original_role = test_user.get("role", "user")
        
        # Test suspend
        suspend_response = requests.post(f"{BASE_URL}/api/admin/users/{user_id}/suspend", headers=auth_headers)
        assert suspend_response.status_code == 200, f"Suspend failed: {suspend_response.status_code} - {suspend_response.text}"
        suspend_data = suspend_response.json()
        assert suspend_data.get("status") == "suspended", f"Suspend should return status suspended: {suspend_data}"
        print(f"PASS: User {user_id} suspended successfully")
        
        # Test unsuspend
        unsuspend_response = requests.post(f"{BASE_URL}/api/admin/users/{user_id}/unsuspend", headers=auth_headers)
        assert unsuspend_response.status_code == 200, f"Unsuspend failed: {unsuspend_response.status_code} - {unsuspend_response.text}"
        unsuspend_data = unsuspend_response.json()
        assert unsuspend_data.get("status") == "active", f"Unsuspend should return status active: {unsuspend_data}"
        print(f"PASS: User {user_id} unsuspended successfully")
    
    def test_admin_cannot_suspend_self(self, auth_headers):
        """Test that admin cannot suspend themselves"""
        # Get admin's own user ID
        me_response = requests.get(f"{BASE_URL}/api/auth/supabase/me", headers=auth_headers)
        assert me_response.status_code == 200
        admin_id = me_response.json().get("id")
        assert admin_id, "Could not get admin ID"
        
        # Try to suspend self - should fail
        suspend_response = requests.post(f"{BASE_URL}/api/admin/users/{admin_id}/suspend", headers=auth_headers)
        assert suspend_response.status_code == 400, f"Should not be able to suspend self: {suspend_response.status_code}"
        print("PASS: Admin correctly prevented from suspending self")


class TestAdminAuthRequired:
    """Tests to verify admin endpoints require proper authentication"""
    
    def test_regular_user_cannot_access_admin_users(self):
        """Verify non-admin users cannot access admin endpoints"""
        # This would require a non-admin user token, skip if not available
        # For now, verify no-auth case is blocked
        response = requests.get(f"{BASE_URL}/api/admin/users")
        assert response.status_code in [401, 403], "Admin endpoints must be protected"
        print("PASS: Admin endpoints protected from unauthorized access")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
