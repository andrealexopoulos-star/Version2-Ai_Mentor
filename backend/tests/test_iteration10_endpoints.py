"""
Test iteration 10 - New Onboarding & Data Coherence Endpoints
Tests for:
1. GET /api/calibration/status - calibration status check
2. POST /api/website/enrich - website metadata extraction  
3. GET /api/business-profile/context - profile + onboarding + intelligence baseline
4. POST /api/onboarding/save - save onboarding progress with business_profiles persistence
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://beta.thestrategysquad.com')

class TestCalibrationStatus:
    """Test GET /api/calibration/status endpoint - requires auth but should return 401 if not authenticated"""
    
    def test_calibration_status_returns_401_without_auth(self):
        """Endpoint should return 401 without valid auth token"""
        response = requests.get(f"{BASE_URL}/api/calibration/status")
        # Endpoint exists and requires auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✓ GET /api/calibration/status returns {response.status_code} without auth (expected)")
    
    def test_calibration_status_endpoint_exists(self):
        """Verify endpoint is registered (returns 401 not 404)"""
        response = requests.get(f"{BASE_URL}/api/calibration/status")
        assert response.status_code != 404, "Endpoint not found - not registered"
        print(f"✓ GET /api/calibration/status is registered (returns {response.status_code})")


class TestWebsiteEnrich:
    """Test POST /api/website/enrich endpoint - requires auth"""
    
    def test_website_enrich_returns_401_without_auth(self):
        """Endpoint should return 401 without valid auth token"""
        response = requests.post(
            f"{BASE_URL}/api/website/enrich",
            json={"url": "https://example.com"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✓ POST /api/website/enrich returns {response.status_code} without auth (expected)")
    
    def test_website_enrich_endpoint_exists(self):
        """Verify endpoint is registered (returns 401 not 404)"""
        response = requests.post(
            f"{BASE_URL}/api/website/enrich",
            json={"url": "https://example.com"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code != 404, "Endpoint not found - not registered"
        print(f"✓ POST /api/website/enrich is registered (returns {response.status_code})")


class TestBusinessProfileContext:
    """Test GET /api/business-profile/context endpoint - requires auth"""
    
    def test_business_context_returns_401_without_auth(self):
        """Endpoint should return 401 without valid auth token"""
        response = requests.get(f"{BASE_URL}/api/business-profile/context")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✓ GET /api/business-profile/context returns {response.status_code} without auth (expected)")
    
    def test_business_context_endpoint_exists(self):
        """Verify endpoint is registered (returns 401 not 404)"""
        response = requests.get(f"{BASE_URL}/api/business-profile/context")
        assert response.status_code != 404, "Endpoint not found - not registered"
        print(f"✓ GET /api/business-profile/context is registered (returns {response.status_code})")


class TestOnboardingSave:
    """Test POST /api/onboarding/save endpoint - requires auth"""
    
    def test_onboarding_save_returns_401_without_auth(self):
        """Endpoint should return 401 without valid auth token"""
        response = requests.post(
            f"{BASE_URL}/api/onboarding/save",
            json={
                "current_step": 1,
                "business_stage": "startup",
                "data": {"business_name": "Test Co"},
                "completed": False
            },
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✓ POST /api/onboarding/save returns {response.status_code} without auth (expected)")
    
    def test_onboarding_save_endpoint_exists(self):
        """Verify endpoint is registered (returns 401 not 404)"""
        response = requests.post(
            f"{BASE_URL}/api/onboarding/save",
            json={
                "current_step": 1,
                "business_stage": "startup",
                "data": {},
                "completed": False
            },
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code != 404, "Endpoint not found - not registered"
        print(f"✓ POST /api/onboarding/save is registered (returns {response.status_code})")


class TestOnboardingStatus:
    """Test GET /api/onboarding/status endpoint - requires auth"""
    
    def test_onboarding_status_returns_401_without_auth(self):
        """Endpoint should return 401 without valid auth token"""
        response = requests.get(f"{BASE_URL}/api/onboarding/status")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print(f"✓ GET /api/onboarding/status returns {response.status_code} without auth (expected)")
    
    def test_onboarding_status_endpoint_exists(self):
        """Verify endpoint is registered (returns 401 not 404)"""
        response = requests.get(f"{BASE_URL}/api/onboarding/status")
        assert response.status_code != 404, "Endpoint not found - not registered"
        print(f"✓ GET /api/onboarding/status is registered (returns {response.status_code})")


class TestBusinessProfile:
    """Test /api/business-profile endpoint - requires auth"""
    
    def test_business_profile_get_returns_401_without_auth(self):
        """GET /api/business-profile should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/business-profile")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ GET /api/business-profile returns {response.status_code} without auth (expected)")
    
    def test_business_profile_put_returns_401_without_auth(self):
        """PUT /api/business-profile should return 401 without auth"""
        response = requests.put(
            f"{BASE_URL}/api/business-profile",
            json={"business_name": "Test"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ PUT /api/business-profile returns {response.status_code} without auth (expected)")


class TestHealthAndAPIAccess:
    """Test basic API access and health checks"""
    
    def test_api_is_accessible(self):
        """Verify the API is accessible"""
        try:
            response = requests.get(f"{BASE_URL}/api/health", timeout=10)
            # Health endpoint may or may not exist, but server should respond
            assert response.status_code < 500, f"Server error: {response.status_code}"
            print(f"✓ API is accessible (GET /api/health returned {response.status_code})")
        except requests.exceptions.RequestException as e:
            pytest.fail(f"API not accessible: {e}")
    
    def test_api_cors_headers(self):
        """Verify CORS middleware behavior for cross-origin requests."""
        response = requests.get(
            f"{BASE_URL}/api/calibration/status",
            headers={
                "Origin": "https://beta.thestrategysquad.com",
            },
            timeout=10,
        )
        cors_allow_origin = response.headers.get("access-control-allow-origin", "")
        vary_header = response.headers.get("vary", "")
        expose_header = response.headers.get("access-control-expose-headers", "")
        has_vary_origin = "origin" in vary_header.lower()
        has_cors_expose = bool(expose_header.strip())

        # In production, auth can return 401/403; CORS indicators should still be present.
        assert response.status_code in [401, 403], f"Unexpected status for CORS probe: {response.status_code}"

        # Some gateway/proxy paths may suppress allow-origin, but should still preserve CORS middleware indicators.
        assert (
            cors_allow_origin in ("*", "https://beta.thestrategysquad.com")
            or has_vary_origin
            or has_cors_expose
        ), f"Missing CORS indicators. allow-origin={cors_allow_origin!r}, vary={vary_header!r}, expose={expose_header!r}"
        print(
            "✓ CORS behavior present "
            f"(allow-origin={cors_allow_origin!r}, vary={vary_header!r}, expose={expose_header!r})"
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
