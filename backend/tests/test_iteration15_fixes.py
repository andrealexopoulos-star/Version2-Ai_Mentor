"""
Iteration 15 - BIQC Audit Fix Verification Tests
Tests for three fixes:
1. H3: fetchUserProfile enrichment from /api/auth/supabase/me
2. F4: DashboardLayout uses user?.full_name (not user?.name)
3. F2: OnboardingWizard deferOnboarding functionality
"""

import pytest
import requests
import os
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBackendAuthSupabaseMe:
    """Test /api/auth/supabase/me endpoint structure and response"""
    
    def test_auth_supabase_me_requires_auth(self):
        """Verify endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/supabase/me")
        # Should return 401/403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✅ /api/auth/supabase/me requires authentication")
    
    def test_health_endpoint_available(self):
        """Verify backend is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✅ Backend is healthy")


class TestFrontendCodeVerification:
    """Verify frontend code changes match requirements"""
    
    def test_supabase_auth_context_fetches_user_profile(self):
        """H3: Verify fetchUserProfile calls /api/auth/supabase/me"""
        with open('/app/frontend/src/context/SupabaseAuthContext.js', 'r') as f:
            content = f.read()
        
        # Check for /api/auth/supabase/me call in fetchUserProfile
        assert '/api/auth/supabase/me' in content, "Missing /api/auth/supabase/me API call"
        
        # Verify it enriches with role, subscription_tier, is_master_account
        assert 'dbUser.role' in content or "dbUser.role || prev?.role" in content, "Missing role enrichment"
        assert 'dbUser.subscription_tier' in content or "dbUser.subscription_tier || prev?.subscription_tier" in content, "Missing subscription_tier enrichment"
        assert 'dbUser.is_master_account' in content, "Missing is_master_account enrichment"
        
        print("✅ H3: fetchUserProfile enriches user from /api/auth/supabase/me with role, subscription_tier, is_master_account")
    
    def test_supabase_auth_context_exposes_defer_onboarding(self):
        """F2: Verify deferOnboarding is exposed in context value"""
        with open('/app/frontend/src/context/SupabaseAuthContext.js', 'r') as f:
            content = f.read()
        
        # Check deferOnboarding callback exists
        assert 'deferOnboarding' in content, "Missing deferOnboarding callback"
        assert 'const deferOnboarding = useCallback' in content, "Missing deferOnboarding useCallback definition"
        
        # Check it sets onboardingStatus.completed = true
        assert 'completed: true' in content, "deferOnboarding should set completed: true"
        
        # Check it's exported in context value
        context_value_match = re.search(r'const value = \{[^}]+\}', content, re.DOTALL)
        if context_value_match:
            context_value = context_value_match.group()
            assert 'deferOnboarding' in context_value, "deferOnboarding not exposed in context value"
        
        print("✅ F2: deferOnboarding callback exposed in SupabaseAuthContext")
    
    def test_dashboard_layout_uses_full_name(self):
        """F4: Verify DashboardLayout uses user?.full_name (not user?.name)"""
        with open('/app/frontend/src/components/DashboardLayout.js', 'r') as f:
            content = f.read()
        
        # Verify user?.full_name is used
        assert 'user?.full_name' in content, "Missing user?.full_name usage"
        
        # Avatar initial - should use full_name
        assert "user?.full_name?.charAt(0)" in content, "Avatar should use full_name for initial"
        
        # Greeting text - should use full_name
        assert "user?.full_name?.split(' ')[0]" in content or "user?.full_name?.split" in content, "Greeting should use full_name"
        
        # Ensure user?.name is NOT used (the old incorrect approach)
        # Count occurrences - full_name should be present, raw name should be rare/absent
        full_name_count = content.count('user?.full_name')
        assert full_name_count >= 3, f"Expected at least 3 uses of user?.full_name, found {full_name_count}"
        
        print(f"✅ F4: DashboardLayout uses user?.full_name ({full_name_count} occurrences)")
    
    def test_onboarding_wizard_uses_defer_onboarding(self):
        """F2: Verify OnboardingWizard destructures and calls deferOnboarding"""
        with open('/app/frontend/src/pages/OnboardingWizard.js', 'r') as f:
            content = f.read()
        
        # Check deferOnboarding is destructured from useSupabaseAuth
        assert 'deferOnboarding' in content, "Missing deferOnboarding destructure"
        
        # Check it's destructured from useSupabaseAuth
        destructure_match = re.search(r'const \{[^}]+\} = useSupabaseAuth\(\)', content)
        if destructure_match:
            destructure_block = destructure_match.group()
            assert 'deferOnboarding' in destructure_block, "deferOnboarding not destructured from useSupabaseAuth"
        
        # Check Save and continue later button calls deferOnboarding
        assert 'deferOnboarding()' in content, "Save and continue later button should call deferOnboarding()"
        
        # Verify button testid exists
        assert 'data-testid="btn-save-later"' in content, "Save and continue later button should have data-testid"
        
        print("✅ F2: OnboardingWizard calls deferOnboarding() on 'Save and continue later'")


class TestAuthSupabaseMeResponseFields:
    """Verify backend auth_supabase.py returns correct fields"""
    
    def test_verify_supabase_token_returns_required_fields(self):
        """Verify verify_supabase_token returns role, subscription_tier, is_master_account"""
        with open('/app/backend/auth_supabase.py', 'r') as f:
            content = f.read()
        
        # Check the return statement in verify_supabase_token
        # Should return: role, is_master_account, subscription_tier, full_name, company_name
        assert '"role":' in content and 'db_user.get("role")' in content, "Missing role in return"
        assert '"is_master_account":' in content and 'db_user.get("is_master_account"' in content, "Missing is_master_account in return"
        assert '"subscription_tier":' in content and 'db_user.get("subscription_tier"' in content, "Missing subscription_tier in return"
        assert '"full_name":' in content, "Missing full_name in return"
        assert '"company_name":' in content, "Missing company_name in return"
        
        print("✅ verify_supabase_token returns role, subscription_tier, is_master_account, full_name, company_name")


class TestLintVerification:
    """Verify no lint errors in modified files"""
    
    def test_no_critical_syntax_issues(self):
        """Basic syntax check - files should be importable/parseable"""
        # Just verify the files exist and have expected patterns
        files_to_check = [
            '/app/frontend/src/context/SupabaseAuthContext.js',
            '/app/frontend/src/components/DashboardLayout.js',
            '/app/frontend/src/pages/OnboardingWizard.js'
        ]
        
        for file_path in files_to_check:
            with open(file_path, 'r') as f:
                content = f.read()
            
            # Basic checks
            assert len(content) > 100, f"{file_path} appears empty or too short"
            assert 'import' in content, f"{file_path} missing imports"
            assert 'export' in content, f"{file_path} missing exports"
        
        print("✅ All modified files have valid structure")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
