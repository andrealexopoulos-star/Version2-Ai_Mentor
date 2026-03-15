"""
Iteration 139 - Brain 100 KPI Metrics and Advisor UI State Tests
Tests for:
1. /api/brain/runtime-check returns catalog_metric_count=100
2. /api/brain/metrics?include_coverage=true returns total_metrics=100
3. Catalog file exists with 100 metrics
"""
import os
import json
import pytest
import requests
from pathlib import Path

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://advisor-engine.preview.emergentagent.com').rstrip('/')


# ============================================
# Catalog File Tests (No Auth Required)
# ============================================

class TestBusinessBrainCatalogFile:
    """Test that the top 100 KPI metrics catalog file exists and is valid."""
    
    def test_catalog_file_exists_at_expected_location(self):
        """Verify the catalog JSON file exists in backend directory."""
        catalog_path = Path(__file__).resolve().parents[1] / "business_brain_top100_catalog.json"
        assert catalog_path.exists(), f"Catalog file not found at {catalog_path}"
    
    def test_catalog_has_100_metrics(self):
        """Verify catalog contains exactly 100 metrics."""
        catalog_path = Path(__file__).resolve().parents[1] / "business_brain_top100_catalog.json"
        data = json.loads(catalog_path.read_text())
        assert isinstance(data, list), "Catalog should be a JSON array"
        assert len(data) == 100, f"Expected 100 metrics, found {len(data)}"
    
    def test_catalog_metrics_have_unique_ids(self):
        """Verify all metric IDs are unique and span 1-100."""
        catalog_path = Path(__file__).resolve().parents[1] / "business_brain_top100_catalog.json"
        data = json.loads(catalog_path.read_text())
        ids = [row.get("id") for row in data]
        assert len(set(ids)) == 100, "All 100 metric IDs should be unique"
        assert min(ids) == 1, "Minimum ID should be 1"
        assert max(ids) == 100, "Maximum ID should be 100"


# ============================================
# API Tests (Auth Required)
# ============================================

@pytest.fixture(scope="module")
def auth_token():
    """Login and get authentication token."""
    response = requests.post(
        f"{BASE_URL}/api/auth/supabase/login",
        json={
            "email": "andre@thestrategysquad.com.au",
            "password": "MasterMind2025*"
        },
        timeout=15
    )
    if response.status_code != 200:
        pytest.skip(f"Login failed: {response.status_code}")
    
    data = response.json()
    token = data.get("session", {}).get("access_token")
    if not token:
        pytest.skip("No access token in login response")
    return token


class TestBrainRuntimeCheck:
    """Test /api/brain/runtime-check endpoint for 100 metrics."""
    
    def test_runtime_check_returns_100_metrics(self, auth_token):
        """Verify runtime-check endpoint reports 100 metrics from catalog."""
        response = requests.get(
            f"{BASE_URL}/api/brain/runtime-check",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Key assertions for 100 metrics fix
        assert data.get("catalog_metric_count") == 100, \
            f"Expected catalog_metric_count=100, got {data.get('catalog_metric_count')}"
        
        # Verify catalog source is resolved (not fallback)
        catalog_source = data.get("catalog_source_resolved", "")
        assert "fallback" not in catalog_source.lower(), \
            f"Catalog should not use fallback, got: {catalog_source}"
        
        # Verify diagnostics show 100 parsed
        diagnostics = data.get("catalog_diagnostics", {})
        assert diagnostics.get("resolved_count") == 100, \
            f"Expected resolved_count=100 in diagnostics, got {diagnostics.get('resolved_count')}"
    
    def test_runtime_check_catalog_source_is_json(self, auth_token):
        """Verify catalog source is the JSON file not markdown fallback."""
        response = requests.get(
            f"{BASE_URL}/api/brain/runtime-check",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200
        
        data = response.json()
        catalog_source = data.get("catalog_source_resolved", "")
        
        # Should resolve to JSON file
        assert catalog_source.endswith(".json"), \
            f"Catalog should be JSON file, got: {catalog_source}"
        assert "top100" in catalog_source.lower() or "business_brain" in catalog_source.lower(), \
            f"Catalog should be the business brain top 100 file, got: {catalog_source}"


class TestBrainMetricsWithCoverage:
    """Test /api/brain/metrics endpoint with include_coverage=true."""
    
    def test_metrics_coverage_shows_100_total(self, auth_token):
        """Verify metrics endpoint reports total_metrics=100."""
        response = requests.get(
            f"{BASE_URL}/api/brain/metrics",
            params={"include_coverage": "true"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Key assertion for 100 metrics fix
        assert data.get("total_metrics") == 100, \
            f"Expected total_metrics=100, got {data.get('total_metrics')}"
        
        # Also verify runtime catalog count
        assert data.get("runtime_catalog_metric_count") == 100, \
            f"Expected runtime_catalog_metric_count=100, got {data.get('runtime_catalog_metric_count')}"
    
    def test_metrics_coverage_has_metrics_list(self, auth_token):
        """Verify metrics list is returned with coverage info."""
        response = requests.get(
            f"{BASE_URL}/api/brain/metrics",
            params={"include_coverage": "true"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30
        )
        assert response.status_code == 200
        
        data = response.json()
        metrics = data.get("metrics", [])
        
        # Should have 100 metric entries
        assert len(metrics) == 100, f"Expected 100 metrics in list, got {len(metrics)}"
        
        # Verify each metric has required fields
        for metric in metrics[:5]:  # Sample check
            assert "metric_id" in metric
            assert "metric_name" in metric
            assert "category" in metric
            assert "status" in metric


class TestBrainPrioritiesEndpoint:
    """Test /api/brain/priorities endpoint for basic functionality."""
    
    def test_priorities_returns_valid_response(self, auth_token):
        """Verify priorities endpoint returns valid structure."""
        response = requests.get(
            f"{BASE_URL}/api/brain/priorities",
            params={"recompute": "false"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=45
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Required fields
        assert "tenant_id" in data
        assert "concerns" in data
        assert isinstance(data.get("concerns"), list)


# ============================================
# Health Check Test (No Auth)
# ============================================

class TestHealthCheck:
    """Basic health check test."""
    
    def test_health_endpoint(self):
        """Verify /api/health returns healthy status."""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
