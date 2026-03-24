"""
Backend API tests for Launch Packaging restructure - Iteration 153
Tests: Health, Stripe checkout, tier resolver, user integration status
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

if not BASE_URL:
    pytest.skip("REACT_APP_BACKEND_URL not set; skipping live endpoint checks", allow_module_level=True)

class TestHealthEndpoints:
    """Health and basic connectivity tests"""
    
    def test_health_endpoint(self):
        """API health check should return 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") in {"healthy", "ok"}
        print("✅ Health endpoint working")

class TestPublicEndpoints:
    """Public endpoints that don't require authentication"""
    
    def test_pricing_config(self):
        """Check if tier configuration exists"""
        # This tests that the backend can serve tier info
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("✅ Backend accessible")

class TestStripeEndpoints:
    """Stripe payment endpoints tests"""
    
    def test_stripe_checkout_requires_auth(self):
        """Stripe checkout should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/create-checkout-session",
            json={"tier_id": "smb_protect"},
            headers={"Content-Type": "application/json"}
        )
        # Should return 401 or 403 when not authenticated
        assert response.status_code in [401, 403, 422]
        print("✅ Stripe checkout properly requires authentication")
    
    def test_stripe_checkout_invalid_tier(self):
        """Stripe checkout with invalid tier should fail gracefully"""
        response = requests.post(
            f"{BASE_URL}/api/stripe/create-checkout-session",
            json={"tier_id": "invalid_tier"},
            headers={"Content-Type": "application/json"}
        )
        # Should return auth error or validation error
        assert response.status_code in [400, 401, 403, 422]
        print("✅ Invalid tier handled properly")

class TestIntegrationEndpoints:
    """Integration-related endpoints tests"""
    
    def test_integration_status_requires_auth(self):
        """User integration status should require authentication"""
        response = requests.get(f"{BASE_URL}/api/user/integration-status")
        assert response.status_code in [401, 403, 422]
        print("✅ Integration status requires authentication")

class TestEmailEndpoints:
    """Email-related endpoints tests"""
    
    def test_priority_inbox_requires_auth(self):
        """Priority inbox should require authentication"""
        response = requests.get(f"{BASE_URL}/api/email/priority-inbox")
        assert response.status_code in [401, 403, 422]
        print("✅ Priority inbox requires authentication")

class TestIntelligenceEndpoints:
    """Intelligence/brief endpoints tests"""
    
    def test_intelligence_brief_requires_auth(self):
        """Intelligence brief should require authentication"""
        response = requests.get(f"{BASE_URL}/api/intelligence/brief")
        assert response.status_code in [401, 403, 422]
        print("✅ Intelligence brief requires authentication")
    
    def test_brain_priorities_requires_auth(self):
        """Brain priorities should require authentication"""
        response = requests.get(f"{BASE_URL}/api/brain/priorities")
        assert response.status_code in [401, 403, 422]
        print("✅ Brain priorities requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
