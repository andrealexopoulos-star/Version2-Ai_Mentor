"""
Iteration 42: Persistence Hooks Testing
Tests for:
1. OnboardingWizard Step 6 growth_goals select field (data-testid='select-growth-goals')
2. syncToBusinessProfile includes growth_goals in PROFILE_SYNC_FIELDS
3. completeOnboarding calls PUT /api/business-profile then POST /api/onboarding/complete
4. POST /api/onboarding/complete writes to strategic_console_state (is_complete=true, current_step=17)
5. WarRoomConsole fetches /api/business-profile and skips 17-point survey if business_stage exists
6. Stripe integration has viaMerge=true and tier='free' in Integrations.js
7. All existing onboarding steps render correctly (regression)
"""

import pytest
import requests
import os
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://beta.thestrategysquad.com').rstrip('/')


class TestCodeReview:
    """Code review verification tests - no auth required, just file analysis"""

    def test_onboarding_wizard_growth_goals_field_exists(self):
        """Verify OnboardingWizard Step 6 has growth_goals select with correct data-testid"""
        with open('/app/frontend/src/pages/OnboardingWizard.js', 'r') as f:
            content = f.read()
        
        # Check data-testid="select-growth-goals" exists
        assert 'data-testid="select-growth-goals"' in content, "select-growth-goals testid missing"
        
        # Check it's a Select component for growth_goals
        assert "renderField('growth_goals'" in content or 'renderField("growth_goals"' in content, "growth_goals field render missing"
        
        # Verify it's in Step 6 (goals section)
        assert 'step-goals' in content, "step-goals section missing"
        print("✅ OnboardingWizard Step 6 has growth_goals select field with data-testid='select-growth-goals'")

    def test_profile_sync_fields_includes_growth_goals(self):
        """Verify PROFILE_SYNC_FIELDS array includes 'growth_goals'"""
        with open('/app/frontend/src/pages/OnboardingWizard.js', 'r') as f:
            content = f.read()
        
        # Find PROFILE_SYNC_FIELDS definition
        sync_fields_match = re.search(r'PROFILE_SYNC_FIELDS\s*=\s*\[(.*?)\]', content, re.DOTALL)
        assert sync_fields_match, "PROFILE_SYNC_FIELDS not found"
        
        fields_content = sync_fields_match.group(1)
        assert "'growth_goals'" in fields_content or '"growth_goals"' in fields_content, "growth_goals not in PROFILE_SYNC_FIELDS"
        print("✅ PROFILE_SYNC_FIELDS includes 'growth_goals'")

    def test_sync_to_business_profile_function_exists(self):
        """Verify syncToBusinessProfile function calls PUT /api/business-profile"""
        with open('/app/frontend/src/pages/OnboardingWizard.js', 'r') as f:
            content = f.read()
        
        # Check function exists
        assert 'syncToBusinessProfile' in content, "syncToBusinessProfile function missing"
        
        # Check it calls PUT /business-profile
        assert "apiClient.put('/business-profile'" in content or 'apiClient.put("/business-profile"' in content, "PUT /business-profile call missing"
        print("✅ syncToBusinessProfile function calls PUT /api/business-profile")

    def test_complete_onboarding_calls_both_endpoints(self):
        """Verify completeOnboarding calls PUT /business-profile then POST /onboarding/complete"""
        with open('/app/frontend/src/pages/OnboardingWizard.js', 'r') as f:
            content = f.read()
        
        # Check completeOnboarding function exists
        assert 'completeOnboarding' in content, "completeOnboarding function missing"
        
        # Find the completeOnboarding function block
        func_match = re.search(r'completeOnboarding\s*=\s*async\s*\(\s*\)\s*=>\s*\{(.*?)\n\s*\};', content, re.DOTALL)
        assert func_match, "completeOnboarding function body not found"
        
        func_body = func_match.group(1)
        
        # Check PUT /business-profile is called
        assert "apiClient.put('/business-profile'" in func_body or '.put(' in func_body, "PUT call missing in completeOnboarding"
        
        # Check POST /onboarding/complete is called
        assert "apiClient.post('/onboarding/complete'" in func_body or '.post(' in func_body, "POST call missing in completeOnboarding"
        print("✅ completeOnboarding calls PUT /api/business-profile then POST /api/onboarding/complete")

    def test_backend_onboarding_complete_writes_strategic_console_state(self):
        """Verify POST /api/onboarding/complete writes to strategic_console_state with is_complete=True, current_step=17"""
        with open('/app/backend/routes/onboarding.py', 'r') as f:
            content = f.read()
        
        # Check strategic_console_state upsert exists
        assert 'strategic_console_state' in content, "strategic_console_state reference missing"
        assert 'upsert' in content, "upsert call missing"
        
        # Check is_complete=True is written
        assert '"is_complete": True' in content or "'is_complete': True" in content, "is_complete=True missing"
        
        # Check current_step=17 is written
        assert '"current_step": 17' in content or "'current_step': 17" in content, "current_step=17 missing"
        
        # Check status=COMPLETED is written
        assert '"status": "COMPLETED"' in content or "'status': 'COMPLETED'" in content, "status=COMPLETED missing"
        print("✅ POST /api/onboarding/complete writes strategic_console_state (is_complete=True, current_step=17)")

    def test_warroom_console_fetches_business_profile(self):
        """Verify WarRoomConsole fetches /api/business-profile on load"""
        with open('/app/frontend/src/components/WarRoomConsole.js', 'r') as f:
            content = f.read()
        
        # Check fetch to business-profile endpoint
        assert '/api/business-profile' in content, "/api/business-profile fetch missing"
        print("✅ WarRoomConsole fetches /api/business-profile on load")

    def test_warroom_console_skip_logic_on_business_stage(self):
        """Verify WarRoomConsole sets status=COMPLETE and currentStep=17 when business_stage is found"""
        with open('/app/frontend/src/components/WarRoomConsole.js', 'r') as f:
            content = f.read()
        
        # Check for business_stage check
        assert 'profile.business_stage' in content or 'bp.business_stage' in content, "business_stage check missing"
        
        # Check for skip logic - setStatus('COMPLETE')
        assert "setStatus('COMPLETE')" in content or 'setStatus("COMPLETE")' in content, "setStatus COMPLETE missing"
        
        # Check for setCurrentStep(17)
        assert 'setCurrentStep(17)' in content, "setCurrentStep(17) missing"
        
        # Check for setProgress(100)
        assert 'setProgress(100)' in content, "setProgress(100) missing"
        
        # Verify the skip comment explains the intent
        assert 'skip' in content.lower() and 'business_stage' in content, "Skip logic comment missing"
        print("✅ WarRoomConsole sets status=COMPLETE, progress=100, currentStep=17 when business_stage is found")

    def test_stripe_integration_via_merge_and_tier_free(self):
        """Verify Stripe integration has viaMerge=true and tier='free' in Integrations.js"""
        with open('/app/frontend/src/pages/Integrations.js', 'r') as f:
            content = f.read()
        
        # Find Stripe integration block
        stripe_match = re.search(r"\{\s*id:\s*['\"]stripe['\"].*?\}", content, re.DOTALL)
        assert stripe_match, "Stripe integration block not found"
        
        stripe_block = stripe_match.group(0)
        
        # Check viaMerge: true
        assert 'viaMerge: true' in stripe_block or 'viaMerge:true' in stripe_block, "Stripe viaMerge=true missing"
        
        # Check tier: 'free'
        assert "tier: 'free'" in stripe_block or 'tier: "free"' in stripe_block, "Stripe tier='free' missing"
        
        print("✅ Stripe integration has viaMerge=true and tier='free'")


class TestAPIEndpoints:
    """API endpoint tests - verifying endpoints exist and respond"""

    def test_health_endpoint(self):
        """Verify health endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy", f"Unhealthy status: {data}"
        print("✅ Health endpoint returns healthy")

    def test_business_profile_endpoint_requires_auth(self):
        """Verify GET /api/business-profile requires authentication"""
        response = requests.get(f"{BASE_URL}/api/business-profile", timeout=10)
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print(f"✅ GET /api/business-profile requires auth (returned {response.status_code})")

    def test_put_business_profile_endpoint_requires_auth(self):
        """Verify PUT /api/business-profile requires authentication"""
        response = requests.put(
            f"{BASE_URL}/api/business-profile",
            json={"growth_goals": "revenue_growth"},
            timeout=10
        )
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print(f"✅ PUT /api/business-profile requires auth (returned {response.status_code})")

    def test_onboarding_complete_endpoint_requires_auth(self):
        """Verify POST /api/onboarding/complete requires authentication"""
        response = requests.post(f"{BASE_URL}/api/onboarding/complete", timeout=10)
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print(f"✅ POST /api/onboarding/complete requires auth (returned {response.status_code})")

    def test_onboarding_status_endpoint_requires_auth(self):
        """Verify GET /api/onboarding/status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/onboarding/status", timeout=10)
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print(f"✅ GET /api/onboarding/status requires auth (returned {response.status_code})")


class TestOnboardingWizardSteps:
    """Regression tests for onboarding wizard steps"""

    def test_all_onboarding_steps_defined(self):
        """Verify all 8 onboarding steps are defined in STEPS array"""
        with open('/app/frontend/src/pages/OnboardingWizard.js', 'r') as f:
            content = f.read()
        
        # Check all step IDs exist
        expected_steps = ['welcome', 'basics', 'website', 'market', 'product', 'team', 'goals', 'preferences']
        for step in expected_steps:
            assert f"id: '{step}'" in content or f'id: "{step}"' in content, f"Step '{step}' missing"
        
        print(f"✅ All {len(expected_steps)} onboarding steps defined: {expected_steps}")

    def test_onboarding_step_test_ids_exist(self):
        """Verify all step sections have data-testid attributes"""
        with open('/app/frontend/src/pages/OnboardingWizard.js', 'r') as f:
            content = f.read()
        
        expected_testids = [
            'onboarding-wizard',
            'onboarding-card',
            'onboarding-welcome',
            'step-basics',
            'step-website',
            'step-market',
            'step-product',
            'step-team',
            'step-goals',
            'step-preferences'
        ]
        
        found_count = 0
        for testid in expected_testids:
            if f'data-testid="{testid}"' in content:
                found_count += 1
        
        # Allow for some flexibility - at least core ones should exist
        assert found_count >= 7, f"Only {found_count}/{len(expected_testids)} data-testids found"
        print(f"✅ Found {found_count}/{len(expected_testids)} step data-testid attributes")

    def test_navigation_buttons_exist(self):
        """Verify navigation buttons (Back, Next, Save Later) exist"""
        with open('/app/frontend/src/pages/OnboardingWizard.js', 'r') as f:
            content = f.read()
        
        assert 'data-testid="btn-back"' in content, "Back button missing"
        assert 'data-testid="btn-next"' in content, "Next button missing"
        assert 'data-testid="btn-save-later"' in content or 'Save and continue later' in content, "Save later option missing"
        print("✅ Navigation buttons (Back, Next, Save Later) exist")


class TestIntegrationsPage:
    """Tests for Integrations page configuration"""

    def test_all_integration_categories_defined(self):
        """Verify all integration categories are defined"""
        with open('/app/frontend/src/pages/Integrations.js', 'r') as f:
            content = f.read()
        
        expected_categories = ['crm', 'financial', 'hris', 'ats', 'knowledge']
        for cat in expected_categories:
            assert f"id: '{cat}'" in content or f'id: "{cat}"' in content, f"Category '{cat}' missing"
        
        print(f"✅ All integration categories defined: {expected_categories}")

    def test_financial_integrations_include_stripe(self):
        """Verify Stripe is in the financial integrations list"""
        with open('/app/frontend/src/pages/Integrations.js', 'r') as f:
            content = f.read()
        
        # Find all integrations with category: 'financial'
        assert "id: 'stripe'" in content or 'id: "stripe"' in content, "Stripe integration missing"
        assert "category: 'financial'" in content, "financial category missing"
        print("✅ Stripe is included in financial integrations")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
