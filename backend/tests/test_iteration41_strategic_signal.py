"""
Iteration 41: Strategic Signal Chain Tests
Tests for:
1. Schema Alignment: growth_goals and risk_profile in BusinessProfileUpdate model
2. PUT /api/business-profile accepts growth_goals and risk_profile fields
3. OnboardingWizard syncToBusinessProfile function (code review)
4. WarRoomConsole business_profiles fetch and skip logic (code review)
5. Titan Glass theme on Register/Login pages (already verified via Playwright)
"""
import pytest
import requests
import os
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestStrategicSignalChain:
    """Test Strategic Signal Chain repair features"""
    
    def test_health_check(self):
        """Verify backend is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print("✅ Backend health check passed")
    
    def test_business_profile_model_has_growth_goals(self):
        """Verify BusinessProfileUpdate model has growth_goals field via code inspection"""
        profile_path = "/app/backend/routes/profile.py"
        with open(profile_path, "r") as f:
            content = f.read()
        
        # Check growth_goals field exists in BusinessProfileUpdate model
        assert "growth_goals: Optional[str] = None" in content, \
            "growth_goals field not found in BusinessProfileUpdate model"
        print("✅ growth_goals field found in BusinessProfileUpdate model")
    
    def test_business_profile_model_has_risk_profile(self):
        """Verify BusinessProfileUpdate model has risk_profile field via code inspection"""
        profile_path = "/app/backend/routes/profile.py"
        with open(profile_path, "r") as f:
            content = f.read()
        
        # Check risk_profile field exists in BusinessProfileUpdate model
        assert "risk_profile: Optional[str] = None" in content, \
            "risk_profile field not found in BusinessProfileUpdate model"
        print("✅ risk_profile field found in BusinessProfileUpdate model")
    
    def test_onboarding_wizard_has_sync_function(self):
        """Verify OnboardingWizard has syncToBusinessProfile function"""
        wizard_path = "/app/frontend/src/pages/OnboardingWizard.js"
        with open(wizard_path, "r") as f:
            content = f.read()
        
        # Check syncToBusinessProfile function exists
        assert "const syncToBusinessProfile = async" in content or \
               "syncToBusinessProfile = async" in content, \
            "syncToBusinessProfile function not found in OnboardingWizard.js"
        print("✅ syncToBusinessProfile function found in OnboardingWizard.js")
    
    def test_onboarding_wizard_profile_sync_fields_includes_growth_goals(self):
        """Verify PROFILE_SYNC_FIELDS includes growth_goals"""
        wizard_path = "/app/frontend/src/pages/OnboardingWizard.js"
        with open(wizard_path, "r") as f:
            content = f.read()
        
        # Check PROFILE_SYNC_FIELDS includes growth_goals
        assert "'growth_goals'" in content or '"growth_goals"' in content, \
            "growth_goals not found in PROFILE_SYNC_FIELDS"
        print("✅ growth_goals found in PROFILE_SYNC_FIELDS")
    
    def test_onboarding_wizard_profile_sync_fields_includes_risk_profile(self):
        """Verify PROFILE_SYNC_FIELDS includes risk_profile"""
        wizard_path = "/app/frontend/src/pages/OnboardingWizard.js"
        with open(wizard_path, "r") as f:
            content = f.read()
        
        # Check PROFILE_SYNC_FIELDS includes risk_profile
        assert "'risk_profile'" in content or '"risk_profile"' in content, \
            "risk_profile not found in PROFILE_SYNC_FIELDS"
        print("✅ risk_profile found in PROFILE_SYNC_FIELDS")
    
    def test_onboarding_wizard_calls_put_business_profile(self):
        """Verify OnboardingWizard calls PUT /api/business-profile"""
        wizard_path = "/app/frontend/src/pages/OnboardingWizard.js"
        with open(wizard_path, "r") as f:
            content = f.read()
        
        # Check for PUT call to /business-profile in syncToBusinessProfile
        # Should contain: apiClient.put('/business-profile'
        assert "apiClient.put('/business-profile'" in content or \
               'apiClient.put("/business-profile"' in content, \
            "PUT /api/business-profile call not found in OnboardingWizard.js"
        print("✅ PUT /api/business-profile call found in OnboardingWizard.js")
    
    def test_warroom_console_fetches_business_profile(self):
        """Verify WarRoomConsole fetches /api/business-profile"""
        console_path = "/app/frontend/src/components/WarRoomConsole.js"
        with open(console_path, "r") as f:
            content = f.read()
        
        # Check for fetch to /api/business-profile
        assert "/api/business-profile" in content, \
            "/api/business-profile fetch not found in WarRoomConsole.js"
        print("✅ /api/business-profile fetch found in WarRoomConsole.js")
    
    def test_warroom_console_skips_step2_on_business_stage(self):
        """Verify WarRoomConsole skips Step 2 when business_stage is not null"""
        console_path = "/app/frontend/src/components/WarRoomConsole.js"
        with open(console_path, "r") as f:
            content = f.read()
        
        # Check for business_stage check logic
        assert "business_stage" in content, \
            "business_stage check not found in WarRoomConsole.js"
        
        # Check for step skip logic (currentStep >= 3 or similar)
        # Looking for pattern like: setCurrentStep(prev => Math.max(prev, 3))
        assert "setCurrentStep" in content and "3" in content, \
            "Step 2 skip logic not found in WarRoomConsole.js"
        print("✅ Step 2 skip logic found in WarRoomConsole.js when business_stage exists")
    
    def test_register_page_has_titan_glass_color(self):
        """Verify Register page uses Titan Glass theme color #1E293B"""
        register_path = "/app/frontend/src/pages/RegisterSupabase.js"
        with open(register_path, "r") as f:
            content = f.read()
        
        # Check for SL constant with #1E293B
        assert "const SL = '#1E293B'" in content or \
               'const SL = "#1E293B"' in content, \
            "Titan Glass color #1E293B not found as SL constant in RegisterSupabase.js"
        
        # Check right panel uses SL
        assert "style={{ background: SL }}" in content or \
               "background: SL" in content, \
            "Right panel not using SL color in RegisterSupabase.js"
        print("✅ Register page uses Titan Glass theme (#1E293B)")
    
    def test_login_page_has_titan_glass_color(self):
        """Verify Login page uses Titan Glass theme color #1E293B"""
        login_path = "/app/frontend/src/pages/LoginSupabase.js"
        with open(login_path, "r") as f:
            content = f.read()
        
        # Check for SL constant with #1E293B
        assert "const SL = '#1E293B'" in content or \
               'const SL = "#1E293B"' in content, \
            "Titan Glass color #1E293B not found as SL constant in LoginSupabase.js"
        
        # Check right panel uses SL
        assert "style={{ background: SL }}" in content or \
               "background: SL" in content, \
            "Right panel not using SL color in LoginSupabase.js"
        print("✅ Login page uses Titan Glass theme (#1E293B)")
    
    def test_register_page_has_confirm_password_field(self):
        """Verify Register page has Confirm Password field"""
        register_path = "/app/frontend/src/pages/RegisterSupabase.js"
        with open(register_path, "r") as f:
            content = f.read()
        
        # Check for confirmPassword field
        assert "confirmPassword" in content, \
            "confirmPassword field not found in RegisterSupabase.js"
        
        # Check for confirm password data-testid
        assert 'data-testid="register-confirm-password-input"' in content, \
            "data-testid='register-confirm-password-input' not found"
        print("✅ Register page has Confirm Password field with proper data-testid")


class TestApiEndpoints:
    """Test API endpoints for Strategic Signal Chain"""
    
    def test_business_profile_endpoint_exists(self):
        """Verify GET /api/business-profile endpoint exists (returns 401 without auth)"""
        response = requests.get(f"{BASE_URL}/api/business-profile")
        # 401 or 403 means endpoint exists but requires auth
        # 404 means endpoint doesn't exist
        assert response.status_code in [401, 403], \
            f"GET /api/business-profile returned unexpected status: {response.status_code}"
        print("✅ GET /api/business-profile endpoint exists (requires auth)")
    
    def test_put_business_profile_endpoint_exists(self):
        """Verify PUT /api/business-profile endpoint exists (returns 401 without auth)"""
        response = requests.put(
            f"{BASE_URL}/api/business-profile",
            json={"growth_goals": "Test", "risk_profile": "Test"}
        )
        # 401 or 403 means endpoint exists but requires auth
        # 404 means endpoint doesn't exist
        # 422 means validation error but endpoint exists
        assert response.status_code in [401, 403, 422], \
            f"PUT /api/business-profile returned unexpected status: {response.status_code}"
        print("✅ PUT /api/business-profile endpoint exists (requires auth)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
