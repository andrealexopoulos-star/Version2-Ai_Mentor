"""
Iteration 127 — Trinity Routing + Deep Scan Enhancements + Proprietary Mode Labels
Tests:
1. Backend /api/health responds
2. LLM router Trinity configuration is correct (OpenAI+Gemini+Anthropic)
3. Calibration enrichment/website endpoint is callable (deep scan)
4. Boardroom endpoints exist and return proper structure
5. Soundboard chat endpoint accepts mode parameter
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://cognition-overhaul.preview.emergentagent.com').rstrip('/')


class TestHealthAndBasics:
    """Health check and basic API tests"""
    
    def test_health_endpoint(self):
        """Backend /api/health responds with healthy status"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"Health check passed: {data}")
    
    def test_api_root_responds(self):
        """API root returns valid response"""
        response = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert response.status_code == 200
        print(f"API root response: {response.json()}")


class TestCalibrationEndpoints:
    """Calibration and enrichment endpoint tests"""
    
    def test_calibration_status_requires_auth(self):
        """Calibration status endpoint exists and requires auth"""
        response = requests.get(f"{BASE_URL}/api/calibration/status", timeout=10)
        # Should return 401 or similar auth error
        assert response.status_code in [401, 403, 422]
        print(f"Calibration status correctly requires auth: {response.status_code}")
    
    def test_enrichment_website_requires_auth(self):
        """Deep scan enrichment/website endpoint exists and requires auth"""
        response = requests.post(
            f"{BASE_URL}/api/enrichment/website",
            json={"url": "https://example.com", "action": "scan"},
            timeout=10
        )
        assert response.status_code in [401, 403, 422]
        print(f"Enrichment website correctly requires auth: {response.status_code}")
    
    def test_calibration_init_requires_auth(self):
        """Calibration init endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/calibration/init", timeout=10)
        assert response.status_code in [401, 403, 422]
        print(f"Calibration init correctly requires auth: {response.status_code}")
    
    def test_lifecycle_state_requires_auth(self):
        """Lifecycle state endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/lifecycle/state", timeout=10)
        assert response.status_code in [401, 403, 422]
        print(f"Lifecycle state correctly requires auth: {response.status_code}")


class TestBoardroomEndpoints:
    """Boardroom endpoint tests - Trinity routing targets"""
    
    def test_boardroom_respond_requires_auth(self):
        """Boardroom respond endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/boardroom/respond",
            json={"message": "test", "history": []},
            timeout=10
        )
        assert response.status_code in [401, 403, 422]
        print(f"Boardroom respond correctly requires auth: {response.status_code}")
    
    def test_boardroom_diagnosis_requires_auth(self):
        """Boardroom diagnosis endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/boardroom/diagnosis",
            json={"focus_area": "revenue_momentum"},
            timeout=10
        )
        assert response.status_code in [401, 403, 422]
        print(f"Boardroom diagnosis correctly requires auth: {response.status_code}")


class TestSoundboardEndpoints:
    """Soundboard endpoint tests"""
    
    def test_soundboard_chat_requires_auth(self):
        """Soundboard chat endpoint exists and requires auth"""
        response = requests.post(
            f"{BASE_URL}/api/soundboard/chat",
            json={"message": "test", "mode": "auto"},
            timeout=10
        )
        assert response.status_code in [401, 403, 422]
        print(f"Soundboard chat correctly requires auth: {response.status_code}")
    
    def test_soundboard_conversations_requires_auth(self):
        """Soundboard conversations endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/soundboard/conversations", timeout=10)
        assert response.status_code in [401, 403, 422]
        print(f"Soundboard conversations correctly requires auth: {response.status_code}")
    
    def test_soundboard_scan_usage_requires_auth(self):
        """Soundboard scan-usage endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/soundboard/scan-usage", timeout=10)
        assert response.status_code in [401, 403, 422]
        print(f"Soundboard scan-usage correctly requires auth: {response.status_code}")


class TestLLMRouterConfig:
    """Code-level verification of Trinity routing configuration"""
    
    def test_llm_router_route_table_exists(self):
        """Verify llm_router has correct route table"""
        # Import and check the router config
        import sys
        sys.path.insert(0, '/app/backend')
        
        from core.llm_router import ROUTE_TABLE, get_router_config
        
        # Verify key routes exist
        assert 'soundboard_strategy' in ROUTE_TABLE
        assert 'boardroom' in ROUTE_TABLE
        assert 'calibration' in ROUTE_TABLE
        assert 'default' in ROUTE_TABLE
        
        # Verify boardroom uses anthropic
        assert ROUTE_TABLE['boardroom']['provider'] == 'anthropic'
        
        # Verify config function works
        config = get_router_config()
        assert 'providers' in config
        assert 'routes' in config
        
        print(f"LLM Router config verified: {len(ROUTE_TABLE)} routes defined")
        print(f"Providers configured: {config['providers']}")
    
    def test_trinity_function_exists(self):
        """Verify llm_trinity_chat function exists and is callable"""
        import sys
        sys.path.insert(0, '/app/backend')
        
        from core.llm_router import llm_trinity_chat
        
        # Verify it's an async function
        import asyncio
        assert asyncio.iscoroutinefunction(llm_trinity_chat)
        print("llm_trinity_chat function exists and is async")
    
    def test_provider_model_detection(self):
        """Verify _provider_for_model correctly identifies providers"""
        import sys
        sys.path.insert(0, '/app/backend')
        
        from core.llm_router import _provider_for_model
        
        # Test provider detection
        assert _provider_for_model('claude-opus-4') == 'anthropic'
        assert _provider_for_model('claude-sonnet-4') == 'anthropic'
        assert _provider_for_model('gemini-3-pro') == 'google'
        assert _provider_for_model('gpt-5') == 'openai'
        assert _provider_for_model('gpt-4o') == 'openai'
        
        print("Provider detection working correctly for all providers")


class TestCalibrationEnrichmentCode:
    """Code-level verification of deep scan enhancements"""
    
    def test_website_enrichment_endpoint_exists(self):
        """Verify enrichment/website endpoint is defined in calibration routes"""
        import sys
        sys.path.insert(0, '/app/backend')
        
        from routes.calibration import router
        
        # Check that the router has the enrichment/website route
        routes = [r.path for r in router.routes]
        
        assert '/enrichment/website' in routes or any('/enrichment/website' in str(r) for r in router.routes)
        print(f"Website enrichment endpoint found in calibration routes")
    
    def test_deep_scan_uses_trinity(self):
        """Verify deep scan calls force_trinity in metadata"""
        import sys
        sys.path.insert(0, '/app/backend')
        
        # Read the calibration.py file and check for force_trinity usage
        with open('/app/backend/routes/calibration.py', 'r') as f:
            content = f.read()
        
        # Check that deep scan uses force_trinity
        assert 'force_trinity' in content
        assert 'onboarding_deep_scan' in content
        
        print("Deep scan enrichment uses force_trinity for Trinity routing")


class TestBIQcModeLabelVerification:
    """Verify proprietary BIQc mode labels in frontend code"""
    
    def test_soundboard_modes_use_biqc_labels(self):
        """Verify MySoundBoard.js uses BIQc proprietary labels"""
        with open('/app/frontend/src/pages/MySoundBoard.js', 'r') as f:
            content = f.read()
        
        # Check for BIQc mode labels
        assert 'BIQc Auto' in content
        assert 'BIQc Trinity' in content
        
        # Verify no raw provider names in mode labels
        forbidden = ['ChatGPT', 'Gemini AI', 'Claude AI']
        for term in forbidden:
            assert term not in content, f"Found forbidden term '{term}' in MySoundBoard.js"
        
        print("MySoundBoard.js uses proprietary BIQc mode labels (no ChatGPT/Gemini/Claude)")
    
    def test_soundboard_panel_modes_use_biqc_labels(self):
        """Verify SoundboardPanel.js uses BIQc proprietary labels"""
        with open('/app/frontend/src/components/SoundboardPanel.js', 'r') as f:
            content = f.read()
        
        # Check for BIQc mode labels
        assert 'BIQc Auto' in content
        assert 'BIQc Trinity' in content
        
        # Check descriptions use BIQc terminology
        assert 'BIQc cognition pathways' in content
        assert 'BIQc model pathways' in content
        
        print("SoundboardPanel.js uses proprietary BIQc terminology")


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
