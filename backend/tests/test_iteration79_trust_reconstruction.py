"""
Test Iteration 79: Trust Reconstruction - PDF endpoints and API verification
Tests for BIQc 7-section engineering overhaul
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://biqc-ai-insights.preview.emergentagent.com').rstrip('/')


class TestHealthEndpoints:
    """Health check endpoints"""

    def test_root_health(self):
        """Test /health endpoint"""
        response = requests.get(f"{BASE_URL}/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Root health endpoint working")

    def test_api_health(self):
        """Test /api/health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ API health endpoint working")


class TestPDFEndpoints:
    """Test 3 & 4: PDF generation and download endpoints"""

    def test_generate_pdf_endpoint_exists(self):
        """Test 3: /api/reports/generate-pdf endpoint exists and requires auth"""
        response = requests.post(
            f"{BASE_URL}/api/reports/generate-pdf",
            json={},
            headers={"Content-Type": "application/json"}
        )
        # Should return 401 or 403 without auth, NOT 404
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}: {response.text}"
        print(f"✓ Test 3 - PDF generate endpoint exists (returns {response.status_code} without auth)")

    def test_download_pdf_endpoint_exists(self):
        """Test 4: /api/reports/download/{filename} endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/reports/download/nonexistent.pdf")
        # Should return 404 for non-existent file, NOT 500 or route-not-found
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ Test 4 - PDF download endpoint exists (returns 404 for missing file)")


class TestIntegrationsEndpoint:
    """Integration status endpoints for null state verification"""

    def test_merge_connected_endpoint_without_auth(self):
        """Test integrations connected endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/integrations/merge/connected")
        # Should require auth
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print("✓ Integrations connected endpoint requires authentication")

    def test_crm_deals_endpoint_without_auth(self):
        """Test CRM deals endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/integrations/crm/deals")
        # Should require auth
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print("✓ CRM deals endpoint requires authentication")

    def test_accounting_summary_endpoint_without_auth(self):
        """Test accounting summary endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/integrations/accounting/summary")
        # Should require auth
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print("✓ Accounting summary endpoint requires authentication")


class TestSnapshotEndpoint:
    """Snapshot endpoint for cognitive data"""

    def test_snapshot_latest_requires_auth(self):
        """Test snapshot/latest requires auth"""
        response = requests.get(f"{BASE_URL}/api/snapshot/latest")
        assert response.status_code in [401, 403], f"Expected auth error, got {response.status_code}"
        print("✓ Snapshot endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
