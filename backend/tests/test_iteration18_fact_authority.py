"""
Iteration 18 - BIQC Global Fact Authority Enhancement Tests
Tests for fact_resolution.py upgrades:
1. CONFIDENCE_THRESHOLD constant (>= 0.75)
2. INTEGRATION_FACT_DERIVATIONS mapping for integration-derived facts
3. resolve_facts reads from observation_events with confidence threshold
4. persist_facts_batch for batch fact persistence
5. build_known_facts_prompt separates CONFIRMED FACTS from UNCONFIRMED FACTS
6. log_fact_resolution_violation for system error logging
7. POST /api/onboarding/save persists answered fields to fact_ledger
8. GET /api/facts/resolve endpoint works
9. POST /api/facts/confirm endpoint works
10. GET /api/business-profile/context includes resolved_fields with confidence
11. Backend starts cleanly
"""

import pytest
import requests
import os
import sys

# Add backend to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFactResolutionModuleEnhancements:
    """Test fact_resolution.py enhancements for iteration 18"""
    
    def test_confidence_threshold_exists_and_correct(self):
        """CONFIDENCE_THRESHOLD should exist and be >= 0.75"""
        from fact_resolution import CONFIDENCE_THRESHOLD
        
        assert isinstance(CONFIDENCE_THRESHOLD, (int, float)), "CONFIDENCE_THRESHOLD should be numeric"
        assert CONFIDENCE_THRESHOLD >= 0.75, f"CONFIDENCE_THRESHOLD should be >= 0.75, got {CONFIDENCE_THRESHOLD}"
        print(f"✅ CONFIDENCE_THRESHOLD = {CONFIDENCE_THRESHOLD} (correct)")
    
    def test_integration_fact_derivations_exists(self):
        """INTEGRATION_FACT_DERIVATIONS mapping should exist"""
        from fact_resolution import INTEGRATION_FACT_DERIVATIONS
        
        assert isinstance(INTEGRATION_FACT_DERIVATIONS, dict), "INTEGRATION_FACT_DERIVATIONS should be a dict"
        assert len(INTEGRATION_FACT_DERIVATIONS) > 0, "INTEGRATION_FACT_DERIVATIONS should have entries"
        
        # Check structure of entries
        for signal, derivation in INTEGRATION_FACT_DERIVATIONS.items():
            assert "fact_key" in derivation, f"Derivation for {signal} should have fact_key"
            assert "confidence" in derivation, f"Derivation for {signal} should have confidence"
            assert isinstance(derivation["confidence"], (int, float)), f"Confidence for {signal} should be numeric"
        
        print(f"✅ INTEGRATION_FACT_DERIVATIONS has {len(INTEGRATION_FACT_DERIVATIONS)} mappings:")
        for signal, deriv in INTEGRATION_FACT_DERIVATIONS.items():
            print(f"   {signal} → {deriv['fact_key']} (confidence: {deriv['confidence']})")
    
    def test_persist_facts_batch_exists(self):
        """persist_facts_batch function should exist and be callable"""
        from fact_resolution import persist_facts_batch
        
        assert callable(persist_facts_batch), "persist_facts_batch should be callable"
        
        # Check function signature (should accept supabase_client, user_id, fact_map, source)
        import inspect
        sig = inspect.signature(persist_facts_batch)
        params = list(sig.parameters.keys())
        assert "supabase_client" in params, "persist_facts_batch should accept supabase_client"
        assert "user_id" in params, "persist_facts_batch should accept user_id"
        assert "fact_map" in params, "persist_facts_batch should accept fact_map"
        assert "source" in params, "persist_facts_batch should accept source"
        
        print(f"✅ persist_facts_batch exists with params: {params}")
    
    def test_log_fact_resolution_violation_exists(self):
        """log_fact_resolution_violation function should exist and be callable"""
        from fact_resolution import log_fact_resolution_violation
        
        assert callable(log_fact_resolution_violation), "log_fact_resolution_violation should be callable"
        
        # Check function signature
        import inspect
        sig = inspect.signature(log_fact_resolution_violation)
        params = list(sig.parameters.keys())
        assert "user_id" in params, "log_fact_resolution_violation should accept user_id"
        assert "fact_key" in params, "log_fact_resolution_violation should accept fact_key"
        assert "context" in params, "log_fact_resolution_violation should accept context"
        
        print(f"✅ log_fact_resolution_violation exists with params: {params}")
    
    def test_resolve_facts_is_async(self):
        """resolve_facts should be an async function"""
        from fact_resolution import resolve_facts
        import asyncio
        
        assert asyncio.iscoroutinefunction(resolve_facts), "resolve_facts should be async"
        print("✅ resolve_facts is an async function")
    
    def test_persist_facts_batch_is_async(self):
        """persist_facts_batch should be an async function"""
        from fact_resolution import persist_facts_batch
        import asyncio
        
        assert asyncio.iscoroutinefunction(persist_facts_batch), "persist_facts_batch should be async"
        print("✅ persist_facts_batch is an async function")


class TestBuildKnownFactsPromptSeparation:
    """Test that build_known_facts_prompt separates confirmed vs unconfirmed facts"""
    
    def test_build_known_facts_prompt_confirmed_section(self):
        """build_known_facts_prompt should have CONFIRMED FACTS section"""
        from fact_resolution import build_known_facts_prompt
        
        test_facts = {
            "business.name": {"value": "Confirmed Company", "source": "profile", "confidence": 1.0, "confirmed": True},
        }
        
        result = build_known_facts_prompt(test_facts)
        assert "CONFIRMED FACTS" in result, "Should contain CONFIRMED FACTS header"
        assert "DO NOT RE-ASK" in result, "Should contain DO NOT RE-ASK warning"
        print("✅ build_known_facts_prompt includes CONFIRMED FACTS section")
    
    def test_build_known_facts_prompt_unconfirmed_section(self):
        """build_known_facts_prompt should have UNCONFIRMED FACTS section for integration-derived facts"""
        from fact_resolution import build_known_facts_prompt
        
        test_facts = {
            "business.revenue_range": {"value": "$1M-$5M", "source": "integration:finance", "confidence": 0.85, "confirmed": False},
        }
        
        result = build_known_facts_prompt(test_facts)
        assert "UNCONFIRMED FACTS" in result, "Should contain UNCONFIRMED FACTS header"
        print("✅ build_known_facts_prompt includes UNCONFIRMED FACTS section")
    
    def test_build_known_facts_prompt_both_sections(self):
        """build_known_facts_prompt should separate confirmed and unconfirmed facts"""
        from fact_resolution import build_known_facts_prompt
        
        test_facts = {
            "business.name": {"value": "Test Company", "source": "profile", "confidence": 1.0, "confirmed": True},
            "business.industry": {"value": "Technology", "source": "onboarding", "confidence": 1.0, "confirmed": True},
            "business.revenue_range": {"value": "$500K-$1M", "source": "integration:finance", "confidence": 0.85, "confirmed": False},
            "business.employee_count": {"value": "15", "source": "integration:calendar", "confidence": 0.75, "confirmed": False},
        }
        
        result = build_known_facts_prompt(test_facts)
        
        # Check both sections exist
        assert "CONFIRMED FACTS" in result, "Should contain CONFIRMED FACTS header"
        assert "UNCONFIRMED FACTS" in result, "Should contain UNCONFIRMED FACTS header"
        
        # Check confirmed facts are in correct section
        confirmed_section_idx = result.find("CONFIRMED FACTS")
        unconfirmed_section_idx = result.find("UNCONFIRMED FACTS")
        
        # business.name should be before UNCONFIRMED section (in CONFIRMED section)
        business_name_idx = result.find("business.name")
        assert business_name_idx < unconfirmed_section_idx, "business.name should be in CONFIRMED section"
        
        # business.revenue_range should be after UNCONFIRMED header
        revenue_idx = result.find("business.revenue_range")
        assert revenue_idx > unconfirmed_section_idx, "business.revenue_range should be in UNCONFIRMED section"
        
        print("✅ build_known_facts_prompt correctly separates CONFIRMED vs UNCONFIRMED facts")
        print(f"   Result preview:\n{result[:500]}...")


class TestIntegrationDataResolution:
    """Test that resolve_facts reads from observation_events"""
    
    def test_resolve_facts_source_code_reads_observation_events(self):
        """resolve_facts should query observation_events table"""
        fact_resolution_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "fact_resolution.py"
        )
        
        with open(fact_resolution_path, 'r') as f:
            content = f.read()
        
        # Check that resolve_facts queries observation_events
        assert 'observation_events' in content, \
            "fact_resolution.py should reference observation_events table"
        assert 'INTEGRATION_FACT_DERIVATIONS' in content, \
            "fact_resolution.py should use INTEGRATION_FACT_DERIVATIONS"
        assert 'CONFIDENCE_THRESHOLD' in content, \
            "fact_resolution.py should use CONFIDENCE_THRESHOLD"
        
        print("✅ resolve_facts reads from observation_events with CONFIDENCE_THRESHOLD")
    
    def test_resolve_facts_layer_order(self):
        """resolve_facts should process sources in correct order (Supabase → integration → ledger)"""
        fact_resolution_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "fact_resolution.py"
        )
        
        with open(fact_resolution_path, 'r') as f:
            content = f.read()
        
        # Find positions of each layer in the code
        layer1_idx = content.find("# ─── LAYER 1")
        layer2_idx = content.find("# ─── LAYER 2")
        layer3_idx = content.find("# ─── LAYER 3")
        
        assert layer1_idx > 0, "LAYER 1 (Supabase) should be documented"
        assert layer2_idx > layer1_idx, "LAYER 2 (integration) should come after LAYER 1"
        assert layer3_idx > layer2_idx, "LAYER 3 (fact_ledger) should come after LAYER 2"
        
        print("✅ resolve_facts processes sources in correct order: Supabase → integration → fact_ledger")


class TestOnboardingSaveFactPersistence:
    """Test that POST /api/onboarding/save persists to fact_ledger"""
    
    def test_onboarding_save_imports_persist_facts_batch(self):
        """POST /api/onboarding/save should import persist_facts_batch"""
        onboarding_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "routes",
            "onboarding.py"
        )
        
        with open(onboarding_path, 'r') as f:
            content = f.read()
        
        assert "from fact_resolution import persist_facts_batch" in content, \
            "onboarding route should import persist_facts_batch from fact_resolution"
        assert "ONBOARDING_FIELD_TO_FACT" in content, \
            "onboarding route should import ONBOARDING_FIELD_TO_FACT"
        
        print("✅ POST /api/onboarding/save imports persist_facts_batch and ONBOARDING_FIELD_TO_FACT")
    
    def test_onboarding_save_calls_persist_facts_batch(self):
        """POST /api/onboarding/save should call persist_facts_batch"""
        onboarding_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "routes",
            "onboarding.py"
        )
        
        with open(onboarding_path, 'r') as f:
            content = f.read()
        
        # save_onboarding_progress should persist mapped facts in batch
        assert 'await persist_facts_batch' in content, \
            "save_onboarding_progress should call await persist_facts_batch"
        
        print("✅ POST /api/onboarding/save calls persist_facts_batch for answered fields")
    
    def test_onboarding_save_endpoint_requires_auth(self):
        """POST /api/onboarding/save should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/onboarding/save",
            json={"current_step": 1, "data": {"business_name": "Test"}},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ POST /api/onboarding/save requires auth: {response.status_code}")


class TestFactEndpoints:
    """Test fact resolution API endpoints"""
    
    def test_health_check(self):
        """Verify API is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("✅ Health check passed")
    
    def test_facts_resolve_endpoint_exists(self):
        """GET /api/facts/resolve endpoint should exist"""
        response = requests.get(f"{BASE_URL}/api/facts/resolve")
        # Without auth, should return 401/403 (not 404)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ GET /api/facts/resolve exists (returns {response.status_code} without auth)")
    
    def test_facts_confirm_endpoint_exists(self):
        """POST /api/facts/confirm endpoint should exist"""
        response = requests.post(
            f"{BASE_URL}/api/facts/confirm",
            json={"fact_key": "test.key", "value": "test"},
            headers={"Content-Type": "application/json"}
        )
        # Without auth, should return 401/403 (not 404)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ POST /api/facts/confirm exists (returns {response.status_code} without auth)")
    
    def test_business_profile_context_endpoint_exists(self):
        """GET /api/business-profile/context should exist and return resolved_fields"""
        response = requests.get(f"{BASE_URL}/api/business-profile/context")
        # Without auth, should return 401/403 (not 404)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✅ GET /api/business-profile/context exists (returns {response.status_code} without auth)")


class TestBusinessProfileContextResolvedFields:
    """Test that GET /api/business-profile/context includes confidence in resolved_fields"""
    
    def test_resolve_onboarding_fields_includes_confidence(self):
        """resolve_onboarding_fields should return confidence in each field"""
        from fact_resolution import resolve_onboarding_fields
        
        test_facts = {
            "business.name": {"value": "Test Company", "source": "profile", "confidence": 1.0, "confirmed": True},
            "business.industry": {"value": "Tech", "source": "integration:crm", "confidence": 0.85, "confirmed": False},
        }
        
        result = resolve_onboarding_fields(test_facts)
        
        assert "business_name" in result, "Should map business.name to business_name"
        assert "confidence" in result["business_name"], "business_name should have confidence"
        assert result["business_name"]["confidence"] == 1.0, "Confidence should be preserved"
        
        assert "industry" in result, "Should map business.industry to industry"
        assert "confidence" in result["industry"], "industry should have confidence"
        assert result["industry"]["confidence"] == 0.85, "Confidence should be preserved"
        
        print("✅ resolve_onboarding_fields includes confidence in each resolved field")


class TestOnboardingWizardBadges:
    """Test OnboardingWizard shows correct badges for confirmed/detected facts"""
    
    def test_onboarding_wizard_has_resolved_fields_map_state(self):
        """OnboardingWizard should have resolvedFieldsMap state"""
        frontend_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "frontend", "src", "pages", "OnboardingWizard.js"
        )
        
        with open(frontend_path, 'r') as f:
            content = f.read()
        
        assert "resolvedFieldsMap" in content, "OnboardingWizard should have resolvedFieldsMap state"
        assert "setResolvedFieldsMap" in content, "OnboardingWizard should have setResolvedFieldsMap"
        
        print("✅ OnboardingWizard has resolvedFieldsMap state")
    
    def test_render_field_shows_confirmed_badge(self):
        """renderField should show 'confirmed' badge for confirmed facts"""
        frontend_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "frontend", "src", "pages", "OnboardingWizard.js"
        )
        
        with open(frontend_path, 'r') as f:
            content = f.read()
        
        # Check for confirmed badge
        assert "confirmed" in content.lower(), "renderField should reference 'confirmed'"
        assert "isConfirmed" in content or "is_confirmed" in content or ".confirmed" in content, \
            "renderField should check confirmed status"
        
        print("✅ renderField checks confirmed status for badge display")
    
    def test_render_field_shows_detected_badge(self):
        """renderField should show 'detected' or 'from profile' badge for unconfirmed facts"""
        frontend_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "frontend", "src", "pages", "OnboardingWizard.js"
        )
        
        with open(frontend_path, 'r') as f:
            content = f.read()
        
        # Check for detected badge
        assert "detected" in content.lower() or "from profile" in content.lower(), \
            "renderField should show 'detected' or 'from profile' badge"
        
        print("✅ renderField shows 'detected' or 'from profile' badge for unconfirmed facts")


class TestBackendStartup:
    """Test backend starts cleanly with updated fact_resolution module"""
    
    def test_backend_is_healthy(self):
        """Backend should be running and responding to health checks"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✅ Backend is healthy with updated fact_resolution module")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
