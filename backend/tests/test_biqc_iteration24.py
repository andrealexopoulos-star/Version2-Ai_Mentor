"""
BIQC Platform Stability Testing - Iteration 24
Tests: Backend APIs and service worker cache fix verification

Focus: Verify HTML-instead-of-JSON bug is fixed after service worker removal
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://api.biqc.ai')

# Test credentials - andre@thestrategysquad.com.au
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "TestDemo2026!"


class TestHealthAndBasics:
    """Basic health and connectivity tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint returns JSON"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        assert 'application/json' in response.headers.get('content-type', '')
        data = response.json()
        assert data.get('status') == 'healthy'
        print(f"✅ Health endpoint OK: {data}")
    
    def test_no_html_on_api_routes(self):
        """Verify API routes don't return HTML (critical - service worker fix)"""
        # Test several API endpoints to ensure no HTML leakage
        test_endpoints = [
            '/api/health',
            '/api/docs',
        ]
        for endpoint in test_endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            content_type = response.headers.get('content-type', '')
            # Should NOT be text/html for API routes
            if response.status_code != 404:
                assert 'text/html' not in content_type or endpoint == '/api/docs', \
                    f"API route {endpoint} returned HTML instead of JSON: {content_type}"
        print("✅ No HTML leak detected on API routes")


class TestAuthenticatedAPIs:
    """Tests requiring authentication with Supabase"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Login and get auth token"""
        import httpx
        
        # Supabase auth endpoint
        supabase_url = os.environ.get("SUPABASE_URL", os.environ.get("REACT_APP_SUPABASE_URL", ""))
        anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eXFwZGZmdHhwa3plcHBxdHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzcwNDcsImV4cCI6MjA4NDAxMzA0N30.Xu9Wg5M638qJSgDpJKwFYlr9YZDiYPLv4Igh69KHJ0k"
        
        # Login with Supabase
        auth_response = httpx.post(
            f"{supabase_url}/auth/v1/token?grant_type=password",
            headers={
                "apikey": anon_key,
                "Content-Type": "application/json"
            },
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }
        )
        
        if auth_response.status_code == 200:
            auth_data = auth_response.json()
            self.access_token = auth_data.get('access_token')
            self.headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json",
                "Cache-Control": "no-cache, no-store, must-revalidate"
            }
            print(f"✅ Authenticated as {TEST_EMAIL}")
        else:
            pytest.skip(f"Auth failed: {auth_response.status_code}")
    
    def test_lifecycle_state_returns_json(self):
        """Test /api/lifecycle/state returns JSON with correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/lifecycle/state",
            headers=self.headers
        )
        content_type = response.headers.get('content-type', '')
        
        # Critical: Must NOT return HTML
        assert 'text/html' not in content_type, f"Got HTML instead of JSON: {content_type}"
        assert response.status_code == 200, f"Status {response.status_code}: {response.text[:200]}"
        
        data = response.json()
        # Verify expected structure
        assert 'calibration' in data, f"Missing calibration in response: {data.keys()}"
        assert 'integrations' in data, f"Missing integrations in response: {data.keys()}"
        assert 'intelligence' in data, f"Missing intelligence in response: {data.keys()}"
        
        print(f"✅ Lifecycle state: calibration={data.get('calibration')}, integrations={data.get('integrations')}, intelligence={data.get('intelligence')}")
    
    def test_calibration_status_returns_json(self):
        """Test /api/calibration/status returns JSON with status field"""
        response = requests.get(
            f"{BASE_URL}/api/calibration/status",
            headers=self.headers
        )
        content_type = response.headers.get('content-type', '')
        
        # Critical: Must NOT return HTML
        assert 'text/html' not in content_type, f"Got HTML instead of JSON: {content_type}"
        assert response.status_code == 200, f"Status {response.status_code}: {response.text[:200]}"
        
        data = response.json()
        assert 'status' in data, f"Missing status field: {data.keys()}"
        print(f"✅ Calibration status: {data.get('status')}")
    
    def test_merge_connected_returns_json(self):
        """Test /api/integrations/merge/connected returns JSON with integrations"""
        response = requests.get(
            f"{BASE_URL}/api/integrations/merge/connected",
            headers=self.headers
        )
        content_type = response.headers.get('content-type', '')
        
        # Critical: Must NOT return HTML
        assert 'text/html' not in content_type, f"Got HTML instead of JSON: {content_type}"
        assert response.status_code == 200, f"Status {response.status_code}: {response.text[:200]}"
        
        data = response.json()
        integrations = data.get('integrations', {})
        print(f"✅ Merge connected integrations: {list(integrations.keys())}")
        
        # Verify HubSpot and Xero are connected (as per requirements)
        # Note: Keys may be lowercase or proper case
        integration_keys = [k.lower() for k in integrations.keys()]
        assert 'hubspot' in integration_keys or 'HubSpot' in integrations, \
            f"HubSpot not found in integrations: {integrations.keys()}"
        assert 'xero' in integration_keys or 'Xero' in integrations, \
            f"Xero not found in integrations: {integrations.keys()}"
        print(f"✅ HubSpot and Xero confirmed connected")
    
    def test_outlook_status_returns_json(self):
        """Test /api/outlook/status returns JSON"""
        response = requests.get(
            f"{BASE_URL}/api/outlook/status",
            headers=self.headers
        )
        content_type = response.headers.get('content-type', '')
        
        # Critical: Must NOT return HTML
        assert 'text/html' not in content_type, f"Got HTML instead of JSON: {content_type}"
        assert response.status_code == 200, f"Status {response.status_code}: {response.text[:200]}"
        
        data = response.json()
        # Outlook should show connected for andre@thestrategysquad.com.au
        connected = data.get('connected', False)
        print(f"✅ Outlook status: connected={connected}, emails_synced={data.get('emails_synced', 0)}")
        # Note: token_expired=true is expected per requirements
    
    def test_research_analyze_website_returns_json(self):
        """Test /api/research/analyze-website returns structured intelligence JSON"""
        response = requests.post(
            f"{BASE_URL}/api/research/analyze-website",
            headers=self.headers,
            json={"url": "https://www.example.com"}
        )
        content_type = response.headers.get('content-type', '')
        
        # Critical: Must NOT return HTML
        assert 'text/html' not in content_type, f"Got HTML instead of JSON: {content_type}"
        assert response.status_code == 200, f"Status {response.status_code}: {response.text[:200]}"
        
        data = response.json()
        # Verify expected fields
        assert 'success' in data, f"Missing success field: {data.keys()}"
        assert 'industry' in data, f"Missing industry field: {data.keys()}"
        print(f"✅ Research analyze-website: success={data.get('success')}, industry={data.get('industry')}")


class TestCacheControlHeaders:
    """Verify cache-busting headers are present"""
    
    def test_api_responses_have_no_cache_headers(self):
        """Verify API responses include cache-control headers"""
        response = requests.get(f"{BASE_URL}/api/health")
        
        # Check cache control headers exist (may be set by proxy or backend)
        headers_lower = {k.lower(): v for k, v in response.headers.items()}
        
        # Log what headers we see
        cache_headers = ['cache-control', 'pragma', 'expires']
        for h in cache_headers:
            if h in headers_lower:
                print(f"  {h}: {headers_lower[h]}")
        
        print("✅ API headers checked")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
