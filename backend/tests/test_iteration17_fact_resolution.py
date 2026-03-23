"""
Iteration 17 - BIQC Global Fact Authority Tests
Tests for fact_resolution.py module and related API endpoints:
1. GET /api/facts/resolve returns 401 for unauthenticated requests
2. POST /api/facts/confirm returns 401 for unauthenticated requests
3. fact_resolution.py module structure
4. GET /api/business-profile/context includes resolved_fields
5. build_advisor_context uses fact_resolution module
"""

import pytest
import requests
import os
import sys

# Add backend to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFactResolutionEndpointsUnauthenticated:
    """Test that fact resolution endpoints properly require authentication"""
    
    def test_health_check(self):
        """Verify API is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("✅ Health check passed")
    
    def test_facts_resolve_returns_401_unauthenticated(self):
        """GET /api/facts/resolve should return 401 for unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/facts/resolve")
        # Accept both 401 (Not authenticated) and 403 (Forbidden)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"✅ GET /api/facts/resolve returns {response.status_code}: {data['detail']}")
    
    def test_facts_confirm_returns_401_unauthenticated(self):
        """POST /api/facts/confirm should return 401 for unauthenticated requests"""
        response = requests.post(
            f"{BASE_URL}/api/facts/confirm",
            json={"fact_key": "test.key", "value": "test_value"},
            headers={"Content-Type": "application/json"}
        )
        # Accept both 401 (Not authenticated) and 403 (Forbidden)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"✅ POST /api/facts/confirm returns {response.status_code}: {data['detail']}")
    
    def test_business_profile_context_returns_401_unauthenticated(self):
        """GET /api/business-profile/context should return 401 for unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/business-profile/context")
        # Accept both 401 (Not authenticated) and 403 (Forbidden)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"✅ GET /api/business-profile/context returns {response.status_code}: {data['detail']}")


class TestFactResolutionModuleStructure:
    """Test that fact_resolution.py module has correct structure"""
    
    def test_fact_resolution_module_exists(self):
        """fact_resolution.py should exist in backend"""
        fact_resolution_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "fact_resolution.py"
        )
        assert os.path.exists(fact_resolution_path), f"fact_resolution.py not found at {fact_resolution_path}"
        print(f"✅ fact_resolution.py exists at {fact_resolution_path}")
    
    def test_fact_resolution_has_required_functions(self):
        """fact_resolution.py should have resolve_facts, persist_fact, build_known_facts_prompt, resolve_onboarding_fields"""
        from fact_resolution import (
            resolve_facts,
            persist_fact,
            build_known_facts_prompt,
            resolve_onboarding_fields
        )
        
        # Check each function is callable
        assert callable(resolve_facts), "resolve_facts should be callable"
        assert callable(persist_fact), "persist_fact should be callable"
        assert callable(build_known_facts_prompt), "build_known_facts_prompt should be callable"
        assert callable(resolve_onboarding_fields), "resolve_onboarding_fields should be callable"
        print("✅ All required functions exist: resolve_facts, persist_fact, build_known_facts_prompt, resolve_onboarding_fields")
    
    def test_fact_sources_mapping_covers_business_profiles_and_users(self):
        """FACT_SOURCES mapping should cover business_profiles and users tables"""
        from fact_resolution import FACT_SOURCES
        
        assert isinstance(FACT_SOURCES, dict), "FACT_SOURCES should be a dict"
        
        # Check business_profiles coverage
        business_profile_sources = [k for k, (table, _) in FACT_SOURCES.items() if table == "business_profiles"]
        assert len(business_profile_sources) > 0, "FACT_SOURCES should have entries for business_profiles"
        print(f"✅ FACT_SOURCES has {len(business_profile_sources)} business_profiles mappings")
        
        # Check users coverage
        users_sources = [k for k, (table, _) in FACT_SOURCES.items() if table == "users"]
        assert len(users_sources) > 0, "FACT_SOURCES should have entries for users"
        print(f"✅ FACT_SOURCES has {len(users_sources)} users mappings")
        
        # Print all mappings
        print(f"✅ Total FACT_SOURCES mappings: {len(FACT_SOURCES)}")
    
    def test_onboarding_field_to_fact_mapping_exists(self):
        """ONBOARDING_FIELD_TO_FACT mapping should cover onboarding form fields"""
        from fact_resolution import ONBOARDING_FIELD_TO_FACT
        
        assert isinstance(ONBOARDING_FIELD_TO_FACT, dict), "ONBOARDING_FIELD_TO_FACT should be a dict"
        assert len(ONBOARDING_FIELD_TO_FACT) > 0, "ONBOARDING_FIELD_TO_FACT should have entries"
        
        # Check key onboarding fields are mapped
        expected_fields = [
            "business_name", "industry", "business_type", "business_stage",
            "website", "location", "target_market"
        ]
        for field in expected_fields:
            assert field in ONBOARDING_FIELD_TO_FACT, f"ONBOARDING_FIELD_TO_FACT should map {field}"
        
        print(f"✅ ONBOARDING_FIELD_TO_FACT has {len(ONBOARDING_FIELD_TO_FACT)} mappings")


class TestFactResolutionFunctionality:
    """Test fact_resolution.py function behavior"""
    
    def test_build_known_facts_prompt_empty(self):
        """build_known_facts_prompt should return empty string for empty facts"""
        from fact_resolution import build_known_facts_prompt
        
        result = build_known_facts_prompt({})
        assert result == "", "Empty facts should return empty string"
        print("✅ build_known_facts_prompt({}) returns empty string")
    
    def test_build_known_facts_prompt_with_facts(self):
        """build_known_facts_prompt should format facts correctly"""
        from fact_resolution import build_known_facts_prompt
        
        test_facts = {
            "business.name": {"value": "Test Company", "source": "profile"},
            "business.industry": {"value": "Technology", "source": "user_confirmed"},
        }
        
        result = build_known_facts_prompt(test_facts)
        assert (
            "KNOWN FACTS" in result
            or "CONFIRMED FACTS" in result
            or "UNCONFIRMED FACTS" in result
        ), "Should contain a facts header"
        assert "business.name" in result, "Should contain fact key"
        assert "Test Company" in result, "Should contain fact value"
        print("✅ build_known_facts_prompt correctly formats facts")
    
    def test_resolve_onboarding_fields_empty(self):
        """resolve_onboarding_fields should return empty dict for empty facts"""
        from fact_resolution import resolve_onboarding_fields
        
        result = resolve_onboarding_fields({})
        assert result == {}, "Empty facts should return empty dict"
        print("✅ resolve_onboarding_fields({}) returns empty dict")
    
    def test_resolve_onboarding_fields_with_facts(self):
        """resolve_onboarding_fields should map facts to onboarding fields"""
        from fact_resolution import resolve_onboarding_fields
        
        test_facts = {
            "business.name": {"value": "Test Company", "source": "profile", "confirmed": True},
            "business.industry": {"value": "Technology", "source": "profile", "confirmed": True},
        }
        
        result = resolve_onboarding_fields(test_facts)
        assert "business_name" in result, "Should map business.name to business_name"
        assert result["business_name"]["value"] == "Test Company"
        assert "industry" in result, "Should map business.industry to industry"
        print("✅ resolve_onboarding_fields correctly maps facts to onboarding fields")


class TestServerIntegration:
    """Test that server.py properly integrates fact_resolution module"""
    
    def test_server_imports_fact_resolution_in_build_advisor_context(self):
        """build_advisor_context should import from fact_resolution"""
        server_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "server.py"
        )
        
        with open(server_path, 'r') as f:
            content = f.read()
        
        # Check that build_advisor_context imports from fact_resolution
        # The import is inside the function
        assert "from fact_resolution import resolve_facts" in content, \
            "server.py should import resolve_facts from fact_resolution"
        assert "from fact_resolution import" in content and "build_known_facts_prompt" in content, \
            "server.py should import build_known_facts_prompt from fact_resolution"
        print("✅ server.py imports resolve_facts and build_known_facts_prompt from fact_resolution")
    
    def test_build_advisor_context_returns_known_facts_prompt(self):
        """Verify build_advisor_context includes known_facts_prompt in return"""
        server_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "server.py"
        )
        
        with open(server_path, 'r') as f:
            content = f.read()
        
        # Find the build_advisor_context function and check its return
        assert '"known_facts_prompt": facts_prompt' in content or "'known_facts_prompt': facts_prompt" in content, \
            "build_advisor_context should return known_facts_prompt"
        print("✅ build_advisor_context returns known_facts_prompt in its output")
    
    def test_business_profile_context_returns_resolved_fields(self):
        """Verify GET /api/business-profile/context includes resolved_fields"""
        server_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "server.py"
        )
        
        with open(server_path, 'r') as f:
            content = f.read()
        
        # Check that the endpoint returns resolved_fields
        assert '"resolved_fields": resolved_fields' in content or "'resolved_fields': resolved_fields" in content, \
            "GET /api/business-profile/context should return resolved_fields"
        print("✅ GET /api/business-profile/context returns resolved_fields")


class TestOnboardingWizardIntegration:
    """Test that OnboardingWizard.js uses resolved_fields"""
    
    def test_onboarding_wizard_uses_resolved_fields(self):
        """OnboardingWizard.js should use ctx.resolved_fields to pre-populate form"""
        frontend_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "frontend", "src", "pages", "OnboardingWizard.js"
        )
        
        with open(frontend_path, 'r') as f:
            content = f.read()
        
        # Check that loadExistingData uses resolved_fields
        assert "resolved_fields" in content, \
            "OnboardingWizard.js should reference resolved_fields"
        assert "ctx.resolved_fields" in content or "resolvedFields" in content, \
            "OnboardingWizard.js should use resolved_fields from context"
        
        # Check that it applies resolved facts to form
        assert "for (const [field, factData] of Object.entries(resolvedFields))" in content or \
               "Object.entries(resolvedFields)" in content or \
               "for (const [field, factData] of Object.entries(resolved_fields))" in content, \
            "OnboardingWizard.js should iterate over resolved_fields"
        
        print("✅ OnboardingWizard.js uses resolved_fields to pre-populate form")


class TestBackendStartup:
    """Test that backend starts cleanly with fact_resolution module"""
    
    def test_backend_is_running(self):
        """Backend should be running and responding to health checks"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Backend not healthy: {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy", f"Backend status: {data}"
        print("✅ Backend is running and healthy with fact_resolution module")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
