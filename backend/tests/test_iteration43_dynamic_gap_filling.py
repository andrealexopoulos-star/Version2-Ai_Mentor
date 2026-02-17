"""
Iteration 43: Dynamic Gap-Filling for the 17-Point Strategic Map Testing

Tests the replacement of total-bypass with Dynamic Gap-Filling architecture:
1. GET /api/calibration/strategic-audit endpoint
2. WarRoomConsole audit-based completion logic
3. fact_resolution.py FACT_SOURCES and ONBOARDING_FIELD_TO_FACT
4. Settings page new fields (business_stage, growth_goals, risk_profile)
5. OnboardingWizard Step 6 growth_goals field
6. Save buttons execute PUT /api/business-profile
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestStrategicAuditEndpoint:
    """Test GET /api/calibration/strategic-audit endpoint"""
    
    def test_strategic_audit_returns_401_without_auth(self):
        """Strategic audit endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/calibration/strategic-audit")
        # Should return 401 (Unauthorized) or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print("PASS: GET /api/calibration/strategic-audit returns 401 without auth")
    
    def test_strategic_audit_endpoint_exists(self):
        """Verify the endpoint exists (doesn't return 404)"""
        response = requests.get(f"{BASE_URL}/api/calibration/strategic-audit")
        # Should NOT be 404 (endpoint exists but requires auth)
        assert response.status_code != 404, "GET /api/calibration/strategic-audit endpoint does not exist"
        print("PASS: GET /api/calibration/strategic-audit endpoint exists")


class TestCalibrationStatusEndpoint:
    """Test /api/calibration/status endpoint"""
    
    def test_calibration_status_returns_401_without_auth(self):
        """Calibration status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/calibration/status")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: GET /api/calibration/status returns 401 without auth")


class TestBusinessProfileEndpoint:
    """Test PUT /api/business-profile endpoint (used by Settings save buttons)"""
    
    def test_business_profile_put_returns_401_without_auth(self):
        """Business profile PUT requires authentication"""
        response = requests.put(
            f"{BASE_URL}/api/business-profile",
            json={"business_name": "Test"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: PUT /api/business-profile returns 401 without auth")
    
    def test_business_profile_context_returns_401_without_auth(self):
        """Business profile context requires authentication"""
        response = requests.get(f"{BASE_URL}/api/business-profile/context")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: GET /api/business-profile/context returns 401 without auth")


class TestBackendCodeReview:
    """Code review verification for backend files"""
    
    def test_strategic_dimensions_list_has_17_items(self):
        """Verify STRATEGIC_DIMENSIONS has 17 items in calibration.py"""
        # Read calibration.py
        with open('/app/backend/routes/calibration.py', 'r') as f:
            content = f.read()
        
        # Find STRATEGIC_DIMENSIONS definition
        assert 'STRATEGIC_DIMENSIONS = [' in content, "STRATEGIC_DIMENSIONS list not found"
        
        # Count items - each has an 'id' key
        import re
        dimension_matches = re.findall(r'\{"id":\s*\d+', content)
        assert len(dimension_matches) == 17, f"Expected 17 dimensions, found {len(dimension_matches)}"
        print("PASS: STRATEGIC_DIMENSIONS has 17 items")
    
    def test_strategic_audit_endpoint_returns_correct_structure(self):
        """Verify strategic audit endpoint returns expected structure in code"""
        with open('/app/backend/routes/calibration.py', 'r') as f:
            content = f.read()
        
        # Check for expected return fields
        expected_fields = ['total', 'known_count', 'gap_count', 'completion_pct', 'known', 'gaps', 'auto_advance_to_step']
        for field in expected_fields:
            assert f'"{field}"' in content, f"Expected field '{field}' not found in strategic-audit response"
        print("PASS: Strategic audit endpoint returns all expected fields")
    
    def test_strategic_dimensions_includes_growth_goals(self):
        """Verify growth_goals is in STRATEGIC_DIMENSIONS"""
        with open('/app/backend/routes/calibration.py', 'r') as f:
            content = f.read()
        
        assert '"key": "growth_goals"' in content, "growth_goals not found in STRATEGIC_DIMENSIONS"
        print("PASS: STRATEGIC_DIMENSIONS includes growth_goals")
    
    def test_strategic_dimensions_includes_risk_profile(self):
        """Verify risk_profile is in STRATEGIC_DIMENSIONS"""
        with open('/app/backend/routes/calibration.py', 'r') as f:
            content = f.read()
        
        assert '"key": "risk_profile"' in content, "risk_profile not found in STRATEGIC_DIMENSIONS"
        print("PASS: STRATEGIC_DIMENSIONS includes risk_profile")
    
    def test_strategic_dimensions_includes_competitive_advantages(self):
        """Verify competitive_advantages is in STRATEGIC_DIMENSIONS"""
        with open('/app/backend/routes/calibration.py', 'r') as f:
            content = f.read()
        
        assert '"key": "competitive_advantages"' in content, "competitive_advantages not found in STRATEGIC_DIMENSIONS"
        print("PASS: STRATEGIC_DIMENSIONS includes competitive_advantages")
    
    def test_strategic_dimensions_includes_products_services(self):
        """Verify products_services is in STRATEGIC_DIMENSIONS"""
        with open('/app/backend/routes/calibration.py', 'r') as f:
            content = f.read()
        
        assert '"key": "products_services"' in content, "products_services not found in STRATEGIC_DIMENSIONS"
        print("PASS: STRATEGIC_DIMENSIONS includes products_services")
    
    def test_strategic_dimensions_includes_team_size(self):
        """Verify team_size is in STRATEGIC_DIMENSIONS"""
        with open('/app/backend/routes/calibration.py', 'r') as f:
            content = f.read()
        
        assert '"key": "team_size"' in content, "team_size not found in STRATEGIC_DIMENSIONS"
        print("PASS: STRATEGIC_DIMENSIONS includes team_size")
    
    def test_strategic_dimensions_includes_years_operating(self):
        """Verify years_operating is in STRATEGIC_DIMENSIONS"""
        with open('/app/backend/routes/calibration.py', 'r') as f:
            content = f.read()
        
        assert '"key": "years_operating"' in content, "years_operating not found in STRATEGIC_DIMENSIONS"
        print("PASS: STRATEGIC_DIMENSIONS includes years_operating")


class TestFactResolutionCodeReview:
    """Code review for fact_resolution.py"""
    
    def test_fact_sources_includes_growth_goals(self):
        """Verify growth_goals is in FACT_SOURCES"""
        with open('/app/backend/fact_resolution.py', 'r') as f:
            content = f.read()
        
        assert '"business.growth_goals"' in content, "growth_goals not found in FACT_SOURCES"
        assert '("business_profiles", "growth_goals")' in content, "growth_goals mapping not found"
        print("PASS: FACT_SOURCES includes growth_goals")
    
    def test_fact_sources_includes_risk_profile(self):
        """Verify risk_profile is in FACT_SOURCES"""
        with open('/app/backend/fact_resolution.py', 'r') as f:
            content = f.read()
        
        assert '"business.risk_profile"' in content, "risk_profile not found in FACT_SOURCES"
        assert '("business_profiles", "risk_profile")' in content, "risk_profile mapping not found"
        print("PASS: FACT_SOURCES includes risk_profile")
    
    def test_fact_sources_includes_competitive_advantages(self):
        """Verify competitive_advantages is in FACT_SOURCES"""
        with open('/app/backend/fact_resolution.py', 'r') as f:
            content = f.read()
        
        assert '"business.competitive_advantages"' in content, "competitive_advantages not found in FACT_SOURCES"
        print("PASS: FACT_SOURCES includes competitive_advantages")
    
    def test_fact_sources_includes_products_services(self):
        """Verify products_services is in FACT_SOURCES"""
        with open('/app/backend/fact_resolution.py', 'r') as f:
            content = f.read()
        
        assert '"business.products_services"' in content, "products_services not found in FACT_SOURCES"
        print("PASS: FACT_SOURCES includes products_services")
    
    def test_fact_sources_includes_team_size(self):
        """Verify team_size is in FACT_SOURCES"""
        with open('/app/backend/fact_resolution.py', 'r') as f:
            content = f.read()
        
        assert '"business.team_size"' in content, "team_size not found in FACT_SOURCES"
        print("PASS: FACT_SOURCES includes team_size")
    
    def test_fact_sources_includes_years_operating(self):
        """Verify years_operating is in FACT_SOURCES"""
        with open('/app/backend/fact_resolution.py', 'r') as f:
            content = f.read()
        
        assert '"business.years_operating"' in content, "years_operating not found in FACT_SOURCES"
        print("PASS: FACT_SOURCES includes years_operating")
    
    def test_onboarding_field_to_fact_includes_growth_goals(self):
        """Verify growth_goals is in ONBOARDING_FIELD_TO_FACT"""
        with open('/app/backend/fact_resolution.py', 'r') as f:
            content = f.read()
        
        assert '"growth_goals":' in content, "growth_goals not found in ONBOARDING_FIELD_TO_FACT"
        print("PASS: ONBOARDING_FIELD_TO_FACT includes growth_goals")
    
    def test_onboarding_field_to_fact_includes_risk_profile(self):
        """Verify risk_profile is in ONBOARDING_FIELD_TO_FACT"""
        with open('/app/backend/fact_resolution.py', 'r') as f:
            content = f.read()
        
        assert '"risk_profile":' in content, "risk_profile not found in ONBOARDING_FIELD_TO_FACT"
        print("PASS: ONBOARDING_FIELD_TO_FACT includes risk_profile")


class TestWarRoomConsoleCodeReview:
    """Code review for WarRoomConsole.js"""
    
    def test_warroomconsole_fetches_strategic_audit(self):
        """Verify WarRoomConsole fetches /api/calibration/strategic-audit"""
        with open('/app/frontend/src/components/WarRoomConsole.js', 'r') as f:
            content = f.read()
        
        assert '/api/calibration/strategic-audit' in content, "WarRoomConsole does not fetch /api/calibration/strategic-audit"
        print("PASS: WarRoomConsole fetches /api/calibration/strategic-audit")
    
    def test_warroomconsole_checks_gap_count_for_complete(self):
        """Verify WarRoomConsole sets COMPLETE when gap_count===0"""
        with open('/app/frontend/src/components/WarRoomConsole.js', 'r') as f:
            content = f.read()
        
        assert 'gap_count === 0' in content or 'audit.gap_count === 0' in content, "WarRoomConsole does not check gap_count === 0"
        print("PASS: WarRoomConsole checks gap_count === 0 for COMPLETE status")
    
    def test_warroomconsole_auto_advances_step(self):
        """Verify WarRoomConsole auto-advances based on known_count"""
        with open('/app/frontend/src/components/WarRoomConsole.js', 'r') as f:
            content = f.read()
        
        assert 'auto_advance_to_step' in content, "WarRoomConsole does not use auto_advance_to_step"
        print("PASS: WarRoomConsole uses auto_advance_to_step for step counter")
    
    def test_warroomconsole_sets_progress_from_audit(self):
        """Verify WarRoomConsole sets progress from completion_pct"""
        with open('/app/frontend/src/components/WarRoomConsole.js', 'r') as f:
            content = f.read()
        
        assert 'completion_pct' in content, "WarRoomConsole does not use completion_pct"
        print("PASS: WarRoomConsole uses completion_pct from audit")


class TestSettingsPageCodeReview:
    """Code review for Settings.js"""
    
    def test_settings_has_business_stage_select(self):
        """Verify Settings has business_stage select with data-testid"""
        with open('/app/frontend/src/pages/Settings.js', 'r') as f:
            content = f.read()
        
        assert 'data-testid="settings-select-stage"' in content, "Settings missing data-testid='settings-select-stage'"
        print("PASS: Settings has business_stage select with data-testid='settings-select-stage'")
    
    def test_settings_has_growth_goals_select(self):
        """Verify Settings has growth_goals select with data-testid"""
        with open('/app/frontend/src/pages/Settings.js', 'r') as f:
            content = f.read()
        
        assert 'data-testid="settings-select-growth-goals"' in content, "Settings missing data-testid='settings-select-growth-goals'"
        print("PASS: Settings has growth_goals select with data-testid='settings-select-growth-goals'")
    
    def test_settings_has_risk_profile_select(self):
        """Verify Settings has risk_profile select with data-testid"""
        with open('/app/frontend/src/pages/Settings.js', 'r') as f:
            content = f.read()
        
        assert 'data-testid="settings-select-risk-profile"' in content, "Settings missing data-testid='settings-select-risk-profile'"
        print("PASS: Settings has risk_profile select with data-testid='settings-select-risk-profile'")
    
    def test_settings_save_buttons_call_handleSaveProfile(self):
        """Verify all Save buttons call handleSaveProfile"""
        with open('/app/frontend/src/pages/Settings.js', 'r') as f:
            content = f.read()
        
        # Count handleSaveProfile references in onClick handlers
        import re
        save_calls = re.findall(r'onClick=\{handleSaveProfile\}', content)
        assert len(save_calls) >= 3, f"Expected at least 3 Save buttons calling handleSaveProfile, found {len(save_calls)}"
        print(f"PASS: Settings has {len(save_calls)} Save buttons calling handleSaveProfile")
    
    def test_settings_handleSaveProfile_calls_put_business_profile(self):
        """Verify handleSaveProfile calls PUT /api/business-profile"""
        with open('/app/frontend/src/pages/Settings.js', 'r') as f:
            content = f.read()
        
        assert "apiClient.put('/business-profile'" in content, "handleSaveProfile does not call PUT /api/business-profile"
        print("PASS: handleSaveProfile calls PUT /api/business-profile")


class TestOnboardingWizardCodeReview:
    """Code review for OnboardingWizard.js"""
    
    def test_onboarding_step6_has_growth_goals_select(self):
        """Verify OnboardingWizard Step 6 has growth_goals select"""
        with open('/app/frontend/src/pages/OnboardingWizard.js', 'r') as f:
            content = f.read()
        
        assert 'data-testid="select-growth-goals"' in content, "OnboardingWizard missing data-testid='select-growth-goals'"
        print("PASS: OnboardingWizard has growth_goals select with data-testid='select-growth-goals'")
    
    def test_onboarding_profile_sync_fields_includes_growth_goals(self):
        """Verify PROFILE_SYNC_FIELDS includes growth_goals"""
        with open('/app/frontend/src/pages/OnboardingWizard.js', 'r') as f:
            content = f.read()
        
        assert "'growth_goals'" in content or '"growth_goals"' in content, "PROFILE_SYNC_FIELDS missing growth_goals"
        print("PASS: PROFILE_SYNC_FIELDS includes growth_goals")
    
    def test_onboarding_sync_to_business_profile_function_exists(self):
        """Verify syncToBusinessProfile function exists"""
        with open('/app/frontend/src/pages/OnboardingWizard.js', 'r') as f:
            content = f.read()
        
        assert 'syncToBusinessProfile' in content, "syncToBusinessProfile function not found"
        print("PASS: syncToBusinessProfile function exists")
    
    def test_onboarding_sync_calls_put_business_profile(self):
        """Verify syncToBusinessProfile calls PUT /api/business-profile"""
        with open('/app/frontend/src/pages/OnboardingWizard.js', 'r') as f:
            content = f.read()
        
        assert "apiClient.put('/business-profile'" in content, "syncToBusinessProfile does not call PUT /api/business-profile"
        print("PASS: syncToBusinessProfile calls PUT /api/business-profile")


class TestHealthEndpoint:
    """Test health endpoint"""
    
    def test_health_endpoint_returns_200(self):
        """Health endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health endpoint returned {response.status_code}"
        print("PASS: /api/health returns 200")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
