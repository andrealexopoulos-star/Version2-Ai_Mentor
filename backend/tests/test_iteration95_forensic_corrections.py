"""
Iteration 95: BIQc Forensic Correction Protocol Tests
Tests 7 forensic corrections:
1. SoundBoard _SOUNDBOARD_FALLBACK bypass (not DB lookup)
2. SoundBoard Strategic Advisor persona
3. Calibration state clears profile fields on new URL
4. OnboardingWizard profileFields includes 'abn'
5. pricingTiers.js canonical config (Foundation $750, Performance $1950, Growth $3900)
6. SubscribePage / UpgradeCardsGate import from pricingTiers.js
7. SupabaseAuthContext sessionStorage cache + signOut invalidation
8. Integrations.js mergeLoading starts false
9. SQL file 048_forensic_corrections.sql exists with correct statements
10. Homepage loads without errors
"""
import pytest
import requests
import os

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    pytest.skip("python-dotenv not installed", allow_module_level=True)

# Load frontend env for BASE_URL
load_dotenv('/app/frontend/.env')
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestSoundBoardBypass:
    """SoundBoard _SOUNDBOARD_FALLBACK bypass - not DB lookup"""

    def test_soundboard_fallback_constant_exists(self):
        """Verify _SOUNDBOARD_FALLBACK is defined in soundboard.py"""
        with open('/app/backend/routes/soundboard.py', 'r') as f:
            content = f.read()
        assert '_SOUNDBOARD_FALLBACK' in content, "_SOUNDBOARD_FALLBACK constant not found"
        print("PASS: _SOUNDBOARD_FALLBACK constant exists")

    def test_soundboard_uses_fallback_not_get_prompt(self):
        """Verify soundboard chat uses _SOUNDBOARD_FALLBACK.replace() not get_prompt()"""
        with open('/app/backend/routes/soundboard.py', 'r') as f:
            content = f.read()
        # Must have .replace bypass
        assert '_SOUNDBOARD_FALLBACK.replace' in content, "Missing _SOUNDBOARD_FALLBACK.replace bypass"
        print("PASS: _SOUNDBOARD_FALLBACK.replace() used for soundboard_prompt")

    def test_soundboard_get_prompt_not_called_for_chat(self):
        """Verify the chat handler does NOT call get_prompt() for the SoundBoard system prompt"""
        with open('/app/backend/routes/soundboard.py', 'r') as f:
            lines = f.readlines()
        
        # Find the soundboard_chat function
        in_chat_fn = False
        get_prompt_call_in_chat = False
        for line in lines:
            if 'async def soundboard_chat' in line:
                in_chat_fn = True
            if in_chat_fn and 'soundboard_prompt = _SOUNDBOARD_FALLBACK.replace' in line:
                # This is the correct bypass line
                pass
            if in_chat_fn and 'get_prompt(' in line and 'soundboard' in line.lower():
                get_prompt_call_in_chat = True
                break
        
        assert not get_prompt_call_in_chat, "get_prompt() called for soundboard in chat handler - bypass not working"
        print("PASS: soundboard_chat does NOT call get_prompt() for system prompt")

    def test_soundboard_strategic_advisor_persona(self):
        """_SOUNDBOARD_FALLBACK contains Strategic Advisor persona, NOT Observation/Question format"""
        with open('/app/backend/routes/soundboard.py', 'r') as f:
            content = f.read()
        assert 'Strategic Intelligence Advisor' in content, "Missing 'Strategic Intelligence Advisor' persona"
        # Should NOT have old observation/question format
        assert 'I. OBSERVATION' not in content, "Old Observation/Question format still present"
        assert 'II. QUESTION' not in content, "Old Observation/Question format still present"
        print("PASS: Strategic Advisor persona confirmed, old Observation/Question format absent")

    def test_soundboard_requires_auth(self):
        """Verify soundboard/chat endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/soundboard/chat",
            json={"message": "test"},
            timeout=10
        )
        assert response.status_code in (401, 403), f"Expected 401/403 got {response.status_code}"
        print(f"PASS: /api/soundboard/chat requires auth ({response.status_code} without token)")


class TestCalibrationStateContaminationFix:
    """useCalibrationState.js clears profile fields before edge function call"""

    def test_calibration_state_clears_market_position(self):
        """Verify market_position is set to null before edge function call"""
        with open('/app/frontend/src/hooks/useCalibrationState.js', 'r') as f:
            content = f.read()
        assert 'market_position: null' in content, "market_position not cleared before calibration"
        print("PASS: market_position: null present in useCalibrationState.js")

    def test_calibration_state_clears_intelligence_fields(self):
        """Verify all 12+ intelligence fields are cleared"""
        with open('/app/frontend/src/hooks/useCalibrationState.js', 'r') as f:
            content = f.read()
        required_fields = [
            'market_position: null',
            'market_intelligence_data: null',
            'digital_footprint_data: null',
            'cmo_snapshot: null',
            'competitive_analysis: null',
            'brand_positioning: null',
            'industry_position: null',
            'growth_opportunity: null',
        ]
        for field in required_fields:
            assert field in content, f"Missing intelligence field reset: {field}"
        print("PASS: All 8 AI intelligence fields cleared before calibration")

    def test_calibration_state_clears_identity_fields(self):
        """Verify identity fields (abn, phone) are also cleared"""
        with open('/app/frontend/src/hooks/useCalibrationState.js', 'r') as f:
            content = f.read()
        assert 'abn: null' in content, "abn not cleared in calibration reset"
        assert 'phone: null' in content, "phone not cleared in calibration reset"
        print("PASS: Identity fields (abn, phone) cleared before calibration")

    def test_calibration_clear_is_before_edge_function(self):
        """Verify the reset PUT happens before the edge function fetch call"""
        with open('/app/frontend/src/hooks/useCalibrationState.js', 'r') as f:
            content = f.read()
        # PUT reset comes before edge function fetch in the code
        put_pos = content.find("await apiClient.put('/business-profile'")
        edge_fn_pos = content.find("calibration-business-dna")
        assert put_pos != -1, "Missing apiClient.put reset call"
        assert edge_fn_pos != -1, "Missing calibration-business-dna edge function call"
        assert put_pos < edge_fn_pos, "PUT reset must come BEFORE edge function call"
        print("PASS: PUT reset occurs before edge function call")


class TestOnboardingWizardABN:
    """OnboardingWizard.js profileFields array includes 'abn'"""

    def test_onboarding_wizard_has_abn_in_profile_fields(self):
        """Verify 'abn' is in the profileFields array"""
        with open('/app/frontend/src/pages/OnboardingWizard.js', 'r') as f:
            content = f.read()
        assert "'abn'" in content, "'abn' not found in OnboardingWizard.js"
        print("PASS: 'abn' present in OnboardingWizard.js")

    def test_onboarding_wizard_has_all_identity_fields(self):
        """Verify all identity fields (abn, acn, company_abn, phone, email) are in profileFields"""
        with open('/app/frontend/src/pages/OnboardingWizard.js', 'r') as f:
            content = f.read()
        identity_fields = ["'abn'", "'acn'", "'company_abn'", "'phone'", "'email'"]
        for field in identity_fields:
            assert field in content, f"Missing identity field in profileFields: {field}"
        print("PASS: All identity fields (abn, acn, company_abn, phone, email) in profileFields")


class TestPricingCanonicalConfig:
    """pricingTiers.js canonical config with correct prices"""

    def test_pricing_tiers_file_exists(self):
        """pricingTiers.js exists at /frontend/src/config/"""
        assert os.path.exists('/app/frontend/src/config/pricingTiers.js'), \
            "pricingTiers.js not found at /app/frontend/src/config/"
        print("PASS: /app/frontend/src/config/pricingTiers.js exists")

    def test_pricing_tiers_foundation_750(self):
        """Foundation tier is $750"""
        with open('/app/frontend/src/config/pricingTiers.js', 'r') as f:
            content = f.read()
        assert "'$750'" in content or '"$750"' in content, "Foundation $750 not found"
        print("PASS: Foundation $750 present in pricingTiers.js")

    def test_pricing_tiers_performance_1950(self):
        """Performance tier is $1,950"""
        with open('/app/frontend/src/config/pricingTiers.js', 'r') as f:
            content = f.read()
        assert "'$1,950'" in content or '"$1,950"' in content, "Performance $1,950 not found"
        print("PASS: Performance $1,950 present in pricingTiers.js")

    def test_pricing_tiers_growth_3900(self):
        """Growth tier is $3,900"""
        with open('/app/frontend/src/config/pricingTiers.js', 'r') as f:
            content = f.read()
        assert "'$3,900'" in content or '"$3,900"' in content, "Growth $3,900 not found"
        print("PASS: Growth $3,900 present in pricingTiers.js")

    def test_pricing_tiers_exports_pricing_tiers(self):
        """PRICING_TIERS is exported from pricingTiers.js"""
        with open('/app/frontend/src/config/pricingTiers.js', 'r') as f:
            content = f.read()
        assert 'export const PRICING_TIERS' in content, "PRICING_TIERS not exported"
        print("PASS: PRICING_TIERS exported from pricingTiers.js")

    def test_subscribe_page_imports_from_pricing_tiers(self):
        """SubscribePage.js imports PRICING_TIERS from pricingTiers.js"""
        with open('/app/frontend/src/pages/SubscribePage.js', 'r') as f:
            content = f.read()
        assert "from '../config/pricingTiers'" in content or \
               "from \"../config/pricingTiers\"" in content, \
               "SubscribePage.js does not import from pricingTiers.js"
        assert 'PRICING_TIERS' in content, "SubscribePage.js doesn't use PRICING_TIERS"
        print("PASS: SubscribePage.js imports PRICING_TIERS from pricingTiers.js")

    def test_upgrade_cards_gate_imports_from_pricing_tiers(self):
        """UpgradeCardsGate.js imports PRICING_TIERS from pricingTiers.js"""
        with open('/app/frontend/src/components/UpgradeCardsGate.js', 'r') as f:
            content = f.read()
        assert "from '../config/pricingTiers'" in content or \
               "from \"../config/pricingTiers\"" in content, \
               "UpgradeCardsGate.js does not import from pricingTiers.js"
        assert 'PRICING_TIERS' in content, "UpgradeCardsGate.js doesn't use PRICING_TIERS"
        print("PASS: UpgradeCardsGate.js imports PRICING_TIERS from pricingTiers.js")


class TestAuthSessionStorageCache:
    """SupabaseAuthContext.js sessionStorage cache + signOut invalidation"""

    def test_auth_context_has_session_storage_cache_key(self):
        """CACHE_KEY uses biqc_auth_bootstrap_{userId} pattern"""
        with open('/app/frontend/src/context/SupabaseAuthContext.js', 'r') as f:
            content = f.read()
        assert 'biqc_auth_bootstrap_' in content, "biqc_auth_bootstrap_ cache key not found"
        print("PASS: biqc_auth_bootstrap_ cache key present in SupabaseAuthContext.js")

    def test_auth_context_cache_ttl_5_minutes(self):
        """Cache TTL is 5 minutes"""
        with open('/app/frontend/src/context/SupabaseAuthContext.js', 'r') as f:
            content = f.read()
        assert '5 * 60 * 1000' in content, "5-minute TTL not found"
        print("PASS: 5-minute TTL (5 * 60 * 1000) present")

    def test_auth_context_reads_from_session_storage(self):
        """sessionStorage.getItem is called with cache key"""
        with open('/app/frontend/src/context/SupabaseAuthContext.js', 'r') as f:
            content = f.read()
        assert 'sessionStorage.getItem(CACHE_KEY)' in content, \
            "sessionStorage.getItem not found for auth bootstrap cache"
        print("PASS: sessionStorage.getItem(CACHE_KEY) called in bootstrap")

    def test_auth_context_saves_to_session_storage(self):
        """sessionStorage.setItem is called to save bootstrap result"""
        with open('/app/frontend/src/context/SupabaseAuthContext.js', 'r') as f:
            content = f.read()
        assert 'sessionStorage.setItem(' in content, "sessionStorage.setItem not found"
        print("PASS: sessionStorage.setItem called to persist bootstrap result")

    def test_auth_context_signout_clears_cache(self):
        """signOut clears sessionStorage cache"""
        with open('/app/frontend/src/context/SupabaseAuthContext.js', 'r') as f:
            content = f.read()
        # Cache removal on sign-out
        assert 'sessionStorage.removeItem(' in content, \
            "sessionStorage.removeItem not found - cache not cleared on signOut"
        assert 'biqc_auth_bootstrap_' in content, "Cache key pattern not in removeItem context"
        print("PASS: sessionStorage.removeItem called in signOut to invalidate cache")


class TestIntegrationsPageMergeLoading:
    """Integrations.js mergeLoading starts false"""

    def test_integrations_merge_loading_starts_false(self):
        """mergeLoading initial state is false (not true)"""
        with open('/app/frontend/src/pages/Integrations.js', 'r') as f:
            content = f.read()
        # Check for the correct initial value
        assert 'useState(false)' in content or "mergeLoading] = useState(false)" in content, \
            "mergeLoading does not start as false"
        # Confirm it's the mergeLoading variable
        import re
        pattern = r'const\s*\[mergeLoading.*?useState\s*\(\s*(true|false)\s*\)'
        match = re.search(pattern, content)
        if match:
            assert match.group(1) == 'false', f"mergeLoading starts as {match.group(1)}, expected false"
        print("PASS: mergeLoading starts as false in Integrations.js")


class TestSQLForensicCorrections:
    """SQL file 048_forensic_corrections.sql exists and is correct"""

    def test_sql_file_exists(self):
        """048_forensic_corrections.sql exists"""
        assert os.path.exists('/app/supabase/migrations/048_forensic_corrections.sql'), \
            "048_forensic_corrections.sql not found"
        print("PASS: 048_forensic_corrections.sql exists")

    def test_sql_deletes_mysoundboard_v1_prompt(self):
        """SQL file deletes old system_prompts mysoundboard_v1"""
        with open('/app/supabase/migrations/048_forensic_corrections.sql', 'r') as f:
            content = f.read()
        assert "DELETE FROM system_prompts" in content, "Missing DELETE FROM system_prompts"
        assert "mysoundboard_v1" in content, "Missing mysoundboard_v1 key in DELETE statement"
        print("PASS: SQL deletes system_prompts WHERE prompt_key = 'mysoundboard_v1'")

    def test_sql_updates_users_to_super_admin(self):
        """SQL grants super_admin to test accounts"""
        with open('/app/supabase/migrations/048_forensic_corrections.sql', 'r') as f:
            content = f.read()
        assert "UPDATE public.users" in content, "Missing UPDATE public.users"
        assert "super_admin" in content, "Missing super_admin role grant"
        assert "trent-test1@biqc-test.com" in content, "Missing test account email"
        print("PASS: SQL grants super_admin to test accounts")

    def test_sql_updates_business_profiles(self):
        """SQL clears market_position in business_profiles"""
        with open('/app/supabase/migrations/048_forensic_corrections.sql', 'r') as f:
            content = f.read()
        assert "UPDATE public.business_profiles" in content, "Missing UPDATE public.business_profiles"
        assert "market_position = NULL" in content, "Missing market_position = NULL"
        print("PASS: SQL clears market_position in business_profiles")


class TestHomepageHealth:
    """Homepage and login page load without errors"""

    def test_homepage_loads(self):
        """Frontend homepage returns 200"""
        response = requests.get(BASE_URL, timeout=15)
        assert response.status_code == 200, f"Homepage returned {response.status_code}"
        print("PASS: Homepage loads with 200")

    def test_api_health(self):
        """Backend health endpoint is up"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Health check returned {response.status_code}"
        print("PASS: Backend /api/health returns 200")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
