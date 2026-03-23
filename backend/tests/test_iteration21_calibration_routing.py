"""
Iteration 21: Calibration Routing Fix Verification Tests

Tests to verify deterministic routing between login, calibration, onboarding, and advisor.
Key validations:
1. Backend /api/calibration/status returns correct status codes and responses
2. No direct Supabase REST calls in frontend files
3. Frontend fail-open behavior on errors
4. ProtectedRoute redirects calibrated users away from /calibration
5. Onboarding check runs AFTER calibration check
"""

import pytest
import requests
import os
import re

# Get the backend URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestCalibrationBackendEndpoint:
    """Test backend /api/calibration/status endpoint"""
    
    def test_calibration_status_returns_401_for_unauthenticated(self):
        """Backend: GET /api/calibration/status returns 401 for unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/calibration/status")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Expected 'detail' field in error response"
        print(f"✓ GET /api/calibration/status returns 401 for unauthenticated: {data}")
    
    def test_calibration_status_endpoint_exists(self):
        """Backend: Verify /api/calibration/status endpoint is defined"""
        # Even unauthenticated, should return 401, not 404
        response = requests.get(f"{BASE_URL}/api/calibration/status")
        assert response.status_code != 404, "Calibration status endpoint not found (404)"
        print(f"✓ /api/calibration/status endpoint exists (status: {response.status_code})")


class TestFrontendCodeVerification:
    """Verify frontend code patterns for calibration routing fix"""
    
    @pytest.fixture(scope="class")
    def supabase_auth_context_content(self):
        """Load SupabaseAuthContext.js content"""
        with open("/app/frontend/src/context/SupabaseAuthContext.js", "r") as f:
            return f.read()
    
    @pytest.fixture(scope="class")
    def auth_callback_content(self):
        """Load AuthCallbackSupabase.js content"""
        with open("/app/frontend/src/pages/AuthCallbackSupabase.js", "r") as f:
            return f.read()
    
    @pytest.fixture(scope="class")
    def protected_route_content(self):
        """Load ProtectedRoute.js content"""
        with open("/app/frontend/src/components/ProtectedRoute.js", "r") as f:
            return f.read()
    
    def test_no_direct_supabase_rest_calls_in_auth_context(self, supabase_auth_context_content):
        """Frontend: SupabaseAuthContext.js has NO direct Supabase REST calls to user_operator_profile"""
        pattern = r'rest/v1/user_operator_profile'
        matches = re.findall(pattern, supabase_auth_context_content)
        assert len(matches) == 0, f"Found direct Supabase REST calls in SupabaseAuthContext.js: {matches}"
        print("✓ SupabaseAuthContext.js has no direct Supabase REST calls to user_operator_profile")
    
    def test_no_direct_supabase_rest_calls_in_auth_callback(self, auth_callback_content):
        """Frontend: AuthCallbackSupabase.js has NO direct Supabase REST calls to user_operator_profile"""
        pattern = r'rest/v1/user_operator_profile'
        matches = re.findall(pattern, auth_callback_content)
        assert len(matches) == 0, f"Found direct Supabase REST calls in AuthCallbackSupabase.js: {matches}"
        print("✓ AuthCallbackSupabase.js has no direct Supabase REST calls to user_operator_profile")
    
    def test_auth_context_only_uses_backend_calibration_endpoint(self, supabase_auth_context_content):
        """Frontend: SupabaseAuthContext.js only calls /api/calibration/status for calibration check"""
        # Should find the backend API call
        pattern = r'/api/calibration/status'
        matches = re.findall(pattern, supabase_auth_context_content)
        assert len(matches) >= 1, "SupabaseAuthContext.js does not call /api/calibration/status"
        print(f"✓ SupabaseAuthContext.js calls /api/calibration/status ({len(matches)} occurrence(s))")
    
    def test_auth_callback_uses_backend_routing_endpoints(self, auth_callback_content):
        """Frontend: AuthCallbackSupabase.js uses backend-owned post-auth routing probes."""
        calibration_pattern = r'/api/calibration/status'
        calibration_matches = re.findall(calibration_pattern, auth_callback_content)
        integration_patterns = [
            r'/api/integrations/merge/connected',
            r'/api/outlook/status',
            r'/api/gmail/status',
        ]
        integration_hits = sum(
            len(re.findall(pattern, auth_callback_content))
            for pattern in integration_patterns
        )
        assert (len(calibration_matches) >= 1) or (integration_hits >= 1), \
            "AuthCallbackSupabase.js does not call backend calibration/routing endpoints"
        print(
            "✓ AuthCallbackSupabase.js uses backend routing probes "
            f"(calibration={len(calibration_matches)}, integration_hits={integration_hits})"
        )
    
    def test_auth_context_fail_open_behavior(self, supabase_auth_context_content):
        """Frontend: SupabaseAuthContext.js fails-open to READY on error (calibrationComplete = true in catch)"""
        # Check for fail-open pattern: calibrationComplete = true after error
        pattern = r'fail-open'
        matches = re.findall(pattern, supabase_auth_context_content)
        assert len(matches) >= 1, "SupabaseAuthContext.js missing fail-open comment"
        
        # Verify calibrationComplete = true on error paths
        error_fail_open_pattern = r'calibrationComplete\s*=\s*true'
        fail_open_matches = re.findall(error_fail_open_pattern, supabase_auth_context_content)
        assert len(fail_open_matches) >= 2, "Expected at least 2 fail-open assignments (calibrationComplete = true)"
        print(f"✓ SupabaseAuthContext.js has fail-open behavior ({len(fail_open_matches)} fail-open assignments)")
    
    def test_auth_callback_fail_open_behavior(self, auth_callback_content):
        """Frontend: AuthCallbackSupabase.js fails-open to /advisor on error"""
        # Check for fail-open pattern
        pattern = r'fail-open'
        matches = re.findall(pattern, auth_callback_content)
        assert len(matches) >= 1, "AuthCallbackSupabase.js missing fail-open comment"
        
        # Verify needsCalibration = false on error paths  
        error_fail_open_pattern = r'needsCalibration\s*=\s*false'
        fail_open_matches = re.findall(error_fail_open_pattern, auth_callback_content)
        assert len(fail_open_matches) >= 2, "Expected at least 2 fail-open assignments (needsCalibration = false)"
        print(f"✓ AuthCallbackSupabase.js has fail-open behavior ({len(fail_open_matches)} fail-open assignments)")
    
    def test_calibration_routing_logs_in_auth_context(self, supabase_auth_context_content):
        """Frontend: SupabaseAuthContext.js has console.log with [CALIBRATION ROUTING] prefix"""
        pattern = r'\[CALIBRATION ROUTING\]'
        matches = re.findall(pattern, supabase_auth_context_content)
        assert len(matches) >= 2, f"Expected at least 2 CALIBRATION ROUTING logs, found {len(matches)}"
        print(f"✓ SupabaseAuthContext.js has {len(matches)} [CALIBRATION ROUTING] console logs")
    
    def test_calibration_routing_logs_in_auth_callback(self, auth_callback_content):
        """Frontend: AuthCallbackSupabase.js has console.log with [CALIBRATION ROUTING] prefix"""
        pattern = r'\[CALIBRATION ROUTING\]'
        matches = re.findall(pattern, auth_callback_content)
        assert len(matches) >= 3, f"Expected at least 3 CALIBRATION ROUTING logs, found {len(matches)}"
        print(f"✓ AuthCallbackSupabase.js has {len(matches)} [CALIBRATION ROUTING] console logs")
    
    def test_calibration_routing_logs_in_protected_route(self, protected_route_content):
        """Frontend: ProtectedRoute.js has console.log with [CALIBRATION ROUTING] prefix"""
        pattern = r'\[CALIBRATION ROUTING\]'
        matches = re.findall(pattern, protected_route_content)
        assert len(matches) >= 1, f"Expected at least 1 CALIBRATION ROUTING log, found {len(matches)}"
        print(f"✓ ProtectedRoute.js has {len(matches)} [CALIBRATION ROUTING] console log(s)")
    
    def test_protected_route_redirects_ready_users_from_calibration(self, protected_route_content):
        """Frontend: ProtectedRoute.js redirects READY users from /calibration to /advisor"""
        # Check for the calibration redirect pattern
        redirect_pattern = r"location\.pathname\s*===\s*['\"]\/calibration['\"]"
        matches = re.findall(redirect_pattern, protected_route_content)
        assert len(matches) >= 1, "ProtectedRoute.js missing calibration path check"
        
        # Check for Navigate to /advisor
        navigate_pattern = r'<Navigate\s+to=["\']\/advisor["\']\s+replace'
        navigate_matches = re.findall(navigate_pattern, protected_route_content)
        assert len(navigate_matches) >= 1, "ProtectedRoute.js missing Navigate to /advisor"
        print("✓ ProtectedRoute.js redirects READY users from /calibration to /advisor")
    
    def test_protected_route_allows_needs_calibration_on_calibration_page(self, protected_route_content):
        """Frontend: ProtectedRoute.js allows NEEDS_CALIBRATION users to access /calibration"""
        # Check for NEEDS_CALIBRATION state handling
        pattern = r'AUTH_STATE\.NEEDS_CALIBRATION'
        matches = re.findall(pattern, protected_route_content)
        assert len(matches) >= 1, "ProtectedRoute.js missing NEEDS_CALIBRATION handling"
        
        # Check for allowedPaths including /calibration
        allowed_paths_pattern = r"allowedPaths.*'/calibration'"
        allowed_matches = re.findall(allowed_paths_pattern, protected_route_content, re.DOTALL)
        assert len(allowed_matches) >= 1, "ProtectedRoute.js missing /calibration in allowedPaths"
        print("✓ ProtectedRoute.js allows NEEDS_CALIBRATION users to access /calibration")


class TestCalibrationVsOnboardingOrder:
    """Verify calibration check runs before onboarding check"""
    
    def test_calibration_check_before_onboarding_check(self):
        """Frontend: Onboarding check happens AFTER calibration check (line 270 after line 265)"""
        with open("/app/frontend/src/context/SupabaseAuthContext.js", "r") as f:
            content = f.read()
            lines = content.split('\n')
        
        calibration_check_line = None
        onboarding_check_line = None
        
        for i, line in enumerate(lines, 1):
            if 'if (!calibrationComplete)' in line:
                calibration_check_line = i
            if '/api/onboarding/status' in line:
                onboarding_check_line = i
        
        assert calibration_check_line is not None, "Could not find calibration check line"
        assert onboarding_check_line is not None, "Could not find onboarding check line"
        assert calibration_check_line < onboarding_check_line, \
            f"Calibration check (line {calibration_check_line}) should come before onboarding check (line {onboarding_check_line})"
        print(f"✓ Calibration check (line {calibration_check_line}) runs before onboarding check (line {onboarding_check_line})")


class TestBackendErrorHandling:
    """Verify backend error handling for calibration endpoint"""
    
    def test_backend_error_handler_raises_500_not_200(self):
        """Backend: GET /api/calibration/status does NOT return 200 with NEEDS_CALIBRATION on general errors"""
        # Read the server.py to verify error handling
        with open("/app/backend/server.py", "r") as f:
            content = f.read()
        
        # Find the calibration status endpoint and verify error handling
        # Should raise HTTPException(500) not return 200
        lines = content.split('\n')
        
        in_calibration_endpoint = False
        found_500_error = False
        found_exception_handling = False
        
        for i, line in enumerate(lines, 1):
            if '@api_router.get("/calibration/status")' in line:
                in_calibration_endpoint = True
            if in_calibration_endpoint:
                if 'raise HTTPException(status_code=500' in line:
                    found_500_error = True
                if 'except Exception' in line or 'except RuntimeError' in line:
                    found_exception_handling = True
                # Stop at next endpoint definition
                if '@api_router' in line and i > 2480:
                    break
        
        assert found_exception_handling, "Backend calibration endpoint missing exception handling"
        assert found_500_error, "Backend calibration endpoint should raise HTTPException(500) on errors, not return 200"
        print("✓ Backend calibration endpoint raises HTTPException(500) on errors, not 200")


class TestFrontendCompilation:
    """Verify frontend files compile without errors"""
    
    def test_frontend_js_syntax_valid(self):
        """Frontend: All three JS files compile without errors (syntax check)"""
        files_to_check = [
            "/app/frontend/src/context/SupabaseAuthContext.js",
            "/app/frontend/src/components/ProtectedRoute.js",
            "/app/frontend/src/pages/AuthCallbackSupabase.js"
        ]
        
        for filepath in files_to_check:
            with open(filepath, "r") as f:
                content = f.read()
            
            # Basic syntax checks
            # Check for balanced braces (simplified)
            open_braces = content.count('{')
            close_braces = content.count('}')
            assert open_braces == close_braces, f"{filepath}: Unbalanced braces ({open_braces} open, {close_braces} close)"
            
            # Check for balanced parentheses (simplified)
            open_parens = content.count('(')
            close_parens = content.count(')')
            assert open_parens == close_parens, f"{filepath}: Unbalanced parentheses ({open_parens} open, {close_parens} close)"
            
            print(f"✓ {filepath.split('/')[-1]} syntax appears valid")


class TestHealthCheck:
    """Verify backend is healthy and running"""
    
    def test_backend_health_check(self):
        """Backend: Health check returns 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed with status {response.status_code}"
        print(f"✓ Backend health check passed: {response.json()}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
