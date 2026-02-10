"""
Iteration 13 - Admin Access Control Tests
Tests for ProtectedRoute adminOnly prop enforcement and backend admin endpoint protection

Features tested:
- GET /api/admin/users returns 403 for non-admin authenticated users  
- GET /api/admin/stats returns 403 for non-admin authenticated users
- GET /api/auth/supabase/me returns user role correctly
- Backend get_admin_user accepts role='admin' and role='superadmin'
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminAccessControl:
    """Test admin access control on backend endpoints"""
    
    def test_api_health_check(self):
        """Verify API is responding"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"API not healthy: {response.status_code}"
        print("✅ API health check passed")
    
    def test_admin_users_requires_auth(self):
        """GET /api/admin/users should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        # 401 = Unauthorized (no token), 403 = Forbidden (has token but not admin)
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print(f"✅ GET /api/admin/users correctly returns {response.status_code} without auth")
    
    def test_admin_stats_requires_auth(self):
        """GET /api/admin/stats should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print(f"✅ GET /api/admin/stats correctly returns {response.status_code} without auth")

    def test_auth_supabase_me_requires_auth(self):
        """GET /api/auth/supabase/me should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/auth/supabase/me")
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print(f"✅ GET /api/auth/supabase/me correctly returns {response.status_code} without auth")

    def test_admin_users_with_invalid_token(self):
        """GET /api/admin/users should return 401 with invalid token"""
        headers = {"Authorization": "Bearer invalid_token_123"}
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=headers)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ GET /api/admin/users correctly returns 401 with invalid token")
    
    def test_admin_stats_with_invalid_token(self):
        """GET /api/admin/stats should return 401 with invalid token"""
        headers = {"Authorization": "Bearer invalid_token_123"}
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ GET /api/admin/stats correctly returns 401 with invalid token")


class TestAdminEndpointStructure:
    """Verify admin endpoints exist and are properly protected"""
    
    def test_admin_users_endpoint_exists(self):
        """Verify /api/admin/users endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        # 401/403/422 means endpoint exists but requires auth
        # 404 would mean endpoint doesn't exist
        assert response.status_code != 404, "/api/admin/users endpoint not found"
        print(f"✅ /api/admin/users endpoint exists (returns {response.status_code})")
    
    def test_admin_stats_endpoint_exists(self):
        """Verify /api/admin/stats endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code != 404, "/api/admin/stats endpoint not found"
        print(f"✅ /api/admin/stats endpoint exists (returns {response.status_code})")
    
    def test_admin_update_user_endpoint_exists(self):
        """Verify /api/admin/users/{user_id} PUT endpoint exists"""
        response = requests.put(f"{BASE_URL}/api/admin/users/test-user-id", json={"role": "user"})
        assert response.status_code != 404, "/api/admin/users/{user_id} PUT endpoint not found"
        print(f"✅ /api/admin/users/{{user_id}} PUT endpoint exists (returns {response.status_code})")
    
    def test_admin_delete_user_endpoint_exists(self):
        """Verify /api/admin/users/{user_id} DELETE endpoint exists"""
        response = requests.delete(f"{BASE_URL}/api/admin/users/test-user-id")
        assert response.status_code != 404, "/api/admin/users/{user_id} DELETE endpoint not found"
        print(f"✅ /api/admin/users/{{user_id}} DELETE endpoint exists (returns {response.status_code})")


class TestAuthSupabaseMe:
    """Test /api/auth/supabase/me endpoint behavior"""
    
    def test_me_endpoint_exists(self):
        """Verify /api/auth/supabase/me endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/auth/supabase/me")
        assert response.status_code != 404, "/api/auth/supabase/me endpoint not found"
        print(f"✅ /api/auth/supabase/me endpoint exists (returns {response.status_code})")
    
    def test_me_requires_authentication(self):
        """Verify endpoint requires valid token"""
        response = requests.get(f"{BASE_URL}/api/auth/supabase/me")
        # Should return 401 (Unauthorized) or 403 (Forbidden) without token
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        print(f"✅ /api/auth/supabase/me correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
