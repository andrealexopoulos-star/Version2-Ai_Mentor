"""
Iteration 14: BIQC Onboarding State Handling Tests

Test requirements:
1. Backend GET /api/onboarding/status has NO auto-complete logic based on company_name
2. Backend GET /api/onboarding/status returns completed=false when no onboarding record exists
3. OnboardingWizard loads existing data from GET /api/business-profile/context
4. ProtectedRoute reads onboardingStatus from context (NOT from API call)
5. ProtectedRoute has NO useEffect that calls GET /api/onboarding/status
"""

import pytest
import requests
import os
from pathlib import Path

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
REPO_ROOT = Path(__file__).resolve().parents[2]


def repo_file(*parts: str) -> Path:
    """Resolve a repository-relative file path for CI portability."""
    return REPO_ROOT.joinpath(*parts)

class TestOnboardingStatusEndpoint:
    """Test GET /api/onboarding/status endpoint behavior"""
    
    def test_onboarding_status_endpoint_exists(self):
        """Test that the onboarding status endpoint exists"""
        # Without auth, should get 403
        response = requests.get(f"{BASE_URL}/api/onboarding/status")
        assert response.status_code in [403, 401], f"Expected 401/403, got {response.status_code}"
        print("✅ GET /api/onboarding/status endpoint exists (returns 401/403 without auth)")
    
    def test_onboarding_save_endpoint_exists(self):
        """Test that the onboarding save endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/onboarding/save", json={})
        assert response.status_code in [403, 401, 422], f"Expected 401/403/422, got {response.status_code}"
        print("✅ POST /api/onboarding/save endpoint exists")
    
    def test_onboarding_complete_endpoint_exists(self):
        """Test that the onboarding complete endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/onboarding/complete")
        assert response.status_code in [403, 401], f"Expected 401/403, got {response.status_code}"
        print("✅ POST /api/onboarding/complete endpoint exists")
    
    def test_business_profile_context_endpoint_exists(self):
        """Test that the business profile context endpoint exists (for OnboardingWizard)"""
        response = requests.get(f"{BASE_URL}/api/business-profile/context")
        assert response.status_code in [403, 401], f"Expected 401/403, got {response.status_code}"
        print("✅ GET /api/business-profile/context endpoint exists (for OnboardingWizard)")


class TestCodeReviewVerification:
    """Code review verification tests - these verify the code structure is correct"""
    
    def test_server_onboarding_status_no_auto_complete(self):
        """Verify onboarding status endpoint keeps explicit incomplete fallback."""
        # Endpoint implementation now lives in routes/onboarding.py (server.py is router orchestrator).
        onboarding_path = repo_file("backend", "routes", "onboarding.py")
        with open(onboarding_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        start_marker = '@router.get("/onboarding/status", response_model=OnboardingStatusResponse)'
        end_marker = '@router.post("/onboarding/save")'
        start = content.find(start_marker)
        end = content.find(end_marker, start + 1)
        endpoint_lines = content[start:end] if start != -1 and end != -1 else ""
        
        # Verify NO auto-complete logic based on company_name
        assert "company_name" not in endpoint_lines, "GET /api/onboarding/status should NOT contain company_name check"
        assert "auto_complete" not in endpoint_lines.lower(), "GET /api/onboarding/status should NOT have auto-complete logic"
        
        # Verify it returns completed=False when no record
        assert "completed=False" in endpoint_lines, "Should return completed=False when no onboarding record"
        
        print("✅ VERIFIED: GET /api/onboarding/status has NO auto-complete logic based on company_name")
        print("✅ VERIFIED: Returns completed=false when no onboarding record exists")
    
    def test_protectedroute_no_onboarding_api_call(self):
        """Verify ProtectedRoute.js has NO API call for onboarding status"""
        protected_route_path = repo_file("frontend", "src", "components", "ProtectedRoute.js")
        with open(protected_route_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        count = content.count("onboarding/status")
        assert count == 0, "ProtectedRoute.js should NOT contain 'onboarding/status' API call"
        
        print("✅ VERIFIED: ProtectedRoute.js has NO API call to GET /api/onboarding/status")
    
    def test_protectedroute_reads_from_context(self):
        """Verify ProtectedRoute.js reads onboardingStatus from context"""
        with open(repo_file("frontend", "src", "components", "ProtectedRoute.js"), 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Should use useSupabaseAuth() to get onboardingStatus
        assert "useSupabaseAuth" in content, "ProtectedRoute should use useSupabaseAuth()"
        assert "onboardingStatus" in content, "ProtectedRoute should use onboardingStatus from context"
        
        # Check specific destructuring
        assert "const { authState, user, session, onboardingStatus } = useSupabaseAuth()" in content, \
            "ProtectedRoute should destructure onboardingStatus from useSupabaseAuth()"
        
        print("✅ VERIFIED: ProtectedRoute reads onboardingStatus from useSupabaseAuth() context")
    
    def test_supbase_auth_context_has_onboarding_state(self):
        """Verify SupabaseAuthContext has onboardingStatus state"""
        with open(repo_file("frontend", "src", "context", "SupabaseAuthContext.js"), 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Check for onboardingStatus state
        assert "const [onboardingStatus, setOnboardingStatus]" in content, \
            "SupabaseAuthContext should have onboardingStatus state"
        
        # Check for markOnboardingComplete callback
        assert "markOnboardingComplete" in content, \
            "SupabaseAuthContext should have markOnboardingComplete callback"
        
        # Check that it's exposed in context value
        assert "onboardingStatus," in content and "markOnboardingComplete," in content, \
            "onboardingStatus and markOnboardingComplete should be in context value"
        
        print("✅ VERIFIED: SupabaseAuthContext has onboardingStatus state and markOnboardingComplete callback")
    
    def test_supabase_auth_context_fetches_once(self):
        """Verify SupabaseAuthContext fetches onboarding status ONCE during bootstrap"""
        with open(repo_file("frontend", "src", "context", "SupabaseAuthContext.js"), 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Check for the fetch in bootstrap useEffect (after calibration)
        assert "/api/onboarding/status" in content, \
            "SupabaseAuthContext should fetch /api/onboarding/status"
        
        # Check it's in the bootstrap useEffect (after calibration complete)
        assert "Calibration complete — now fetch onboarding status ONCE" in content, \
            "SupabaseAuthContext should fetch onboarding ONCE after calibration"
        
        print("✅ VERIFIED: SupabaseAuthContext fetches onboarding status ONCE during bootstrap (after calibration)")
    
    def test_onboarding_wizard_uses_mark_complete(self):
        """Verify OnboardingWizard calls markOnboardingComplete from context"""
        with open(repo_file("frontend", "src", "pages", "OnboardingWizard.js"), 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Check destructuring
        assert "markOnboardingComplete" in content, \
            "OnboardingWizard should use markOnboardingComplete"
        
        # Check it's called
        assert "markOnboardingComplete()" in content, \
            "OnboardingWizard should call markOnboardingComplete()"
        
        print("✅ VERIFIED: OnboardingWizard calls markOnboardingComplete() from context")
    
    def test_onboarding_wizard_loads_from_context(self):
        """Verify OnboardingWizard loads existing data from /api/business-profile/context"""
        with open(repo_file("frontend", "src", "pages", "OnboardingWizard.js"), 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Check for the API call
        assert "/business-profile/context" in content, \
            "OnboardingWizard should load data from /api/business-profile/context"
        
        # Check it resumes from last step
        assert "onboarding.current_step" in content, \
            "OnboardingWizard should resume from current_step"
        
        print("✅ VERIFIED: OnboardingWizard loads data from /api/business-profile/context and resumes from last step")


class TestHealthAndBasics:
    """Basic health checks"""
    
    def test_backend_health(self):
        """Test backend is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Backend health check failed: {response.status_code}"
        print("✅ Backend is healthy")
    
    def test_frontend_loads(self):
        """Test frontend is accessible"""
        response = requests.get(BASE_URL, allow_redirects=True)
        assert response.status_code == 200, f"Frontend failed to load: {response.status_code}"
        print("✅ Frontend is accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
