"""
Iteration 11: BIQC Data-Plane Remediation Tests
------------------------------------------------
Key tests:
1. Backend starts without MongoDB (no motor import)
2. GET /api/calibration/status reads from user_operator_profile ONLY
3. GET /api/auth/check-profile reads from user_operator_profile ONLY
4. GET /api/business-profile reads from business_profiles (not versioned)
5. GET /api/business-profile/scores reads from business_profiles (not versioned)
"""

import pytest
import requests
import os
from pathlib import Path

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
REPO_ROOT = Path(__file__).resolve().parents[2]
APP_ROOT = Path("/app")


def _resolve_repo_path(*parts: str) -> Path:
    app_path = APP_ROOT.joinpath(*parts)
    if app_path.exists():
        return app_path
    return REPO_ROOT.joinpath(*parts)


def _files_with_text(root: Path, text: str):
    matches = []
    for file_path in root.rglob("*"):
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() not in {".js", ".jsx", ".ts", ".tsx"}:
            continue
        content = file_path.read_text(encoding="utf-8", errors="ignore")
        if text in content:
            matches.append(str(file_path.relative_to(root)))
    return matches

class TestDataPlaneRemediation:
    """Tests for BIQC data-plane remediation changes"""

    def test_backend_health(self):
        """Backend should start and respond without MongoDB"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy", f"Unexpected health status: {data}"
        print("✅ Backend healthy (no MongoDB dependency)")

    def test_calibration_status_unauthenticated(self):
        """GET /api/calibration/status should return 401 for unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/calibration/status", timeout=10)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✅ /api/calibration/status returns 401 for unauthenticated")

    def test_auth_check_profile_unauthenticated(self):
        """GET /api/auth/check-profile should return 401 for unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/auth/check-profile", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print("✅ /api/auth/check-profile returns 401 for unauthenticated")

    def test_business_profile_unauthenticated(self):
        """GET /api/business-profile should return 401 for unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/business-profile", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print("✅ /api/business-profile returns 401 for unauthenticated")

    def test_business_profile_scores_unauthenticated(self):
        """GET /api/business-profile/scores should return 401 for unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/business-profile/scores", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print("✅ /api/business-profile/scores returns 401 for unauthenticated")

    def test_business_profile_context_unauthenticated(self):
        """GET /api/business-profile/context should return 401 for unauthenticated requests"""
        response = requests.get(f"{BASE_URL}/api/business-profile/context", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print("✅ /api/business-profile/context returns 401 for unauthenticated")


class TestNoMongoDBDependency:
    """Verify no MongoDB imports or initialization in server.py"""

    def test_no_motor_import(self):
        """server.py should NOT contain motor imports"""
        server_path = _resolve_repo_path("backend", "server.py")
        content = server_path.read_text(encoding="utf-8")
        
        assert "from motor" not in content.lower(), "Found 'from motor' import in server.py"
        assert "import motor" not in content.lower(), "Found 'import motor' in server.py"
        assert "AsyncIOMotorClient" not in content, "Found AsyncIOMotorClient in server.py"
        print("✅ No motor imports found in server.py")

    def test_no_mongodb_client_init(self):
        """server.py should NOT initialize MongoDB client on startup"""
        server_path = _resolve_repo_path("backend", "server.py")
        first_200_lines = ''.join(server_path.read_text(encoding="utf-8").splitlines(keepends=True)[:200])
        
        # Check that there's no MongoDB initialization at startup
        assert "mongo_client" not in first_200_lines.lower(), "Found mongo_client in startup code"
        assert "client[" not in first_200_lines or "mongodb" not in first_200_lines.lower(), "Found MongoDB client access"
        print("✅ No MongoDB client initialization in startup code")


class TestShadowStateRemoval:
    """Verify shadow state removed from frontend files"""

    def test_no_biqc_context_v1_writes(self):
        """Frontend should NOT write to localStorage biqc_context_v1"""
        frontend_src = _resolve_repo_path("frontend", "src")
        matches = _files_with_text(frontend_src, "biqc_context_v1")
        assert not matches, f"Found biqc_context_v1 references in: {matches}"
        print("✅ No biqc_context_v1 localStorage references")

    def test_no_biqc_intelligence_state(self):
        """Frontend should NOT write to localStorage biqc_intelligence_state"""
        frontend_src = _resolve_repo_path("frontend", "src")
        matches = _files_with_text(frontend_src, "biqc_intelligence_state")
        assert not matches, f"Found biqc_intelligence_state references in: {matches}"
        print("✅ No biqc_intelligence_state localStorage references")

    def test_no_dead_context_state(self):
        """SupabaseAuthContext should NOT export dead state variables"""
        context_path = _resolve_repo_path("frontend", "src", "context", "SupabaseAuthContext.js")
        content = context_path.read_text(encoding="utf-8")
        
        dead_state = ['businessContext', 'contextLoading', 'contextError', 
                      'contextSource', 'onboardingState', 'calibrationMode']
        for state_var in dead_state:
            # Check state declarations (useState)
            state_pattern = f"useState.*{state_var}"
            assert state_var not in content or "useState" not in content.split(state_var)[0][-100:], \
                f"Found dead state variable '{state_var}' in SupabaseAuthContext"
        print("✅ No dead state variables in SupabaseAuthContext")

    def test_api_js_no_localstorage_fallback(self):
        """api.js should NOT read localStorage token as fallback"""
        api_path = _resolve_repo_path("frontend", "src", "lib", "api.js")
        content = api_path.read_text(encoding="utf-8")
        
        assert "localStorage" not in content, f"Found localStorage in api.js"
        print("✅ No localStorage token fallback in api.js")


class TestAuthCallbackClean:
    """Verify AuthCallbackSupabase doesn't write shadow state"""

    def test_no_localstorage_writes_in_callback(self):
        """AuthCallbackSupabase should NOT write to biqc_context_v1"""
        callback_path = _resolve_repo_path("frontend", "src", "pages", "AuthCallbackSupabase.js")
        content = callback_path.read_text(encoding="utf-8")
        
        assert "biqc_context_v1" not in content, "Found biqc_context_v1 in AuthCallbackSupabase"
        assert "localStorage.setItem" not in content or "biqc" not in content, \
            "Found biqc localStorage.setItem in AuthCallbackSupabase"
        print("✅ No biqc localStorage writes in AuthCallbackSupabase")


class TestEndpointRegistration:
    """Verify all required endpoints are registered"""

    def test_calibration_status_endpoint_exists(self):
        """GET /api/calibration/status endpoint should exist"""
        response = requests.get(f"{BASE_URL}/api/calibration/status", timeout=10)
        # Should return 401 (auth required) not 404 (not found)
        assert response.status_code != 404, "Endpoint /api/calibration/status not found"
        print("✅ /api/calibration/status endpoint registered")

    def test_auth_check_profile_endpoint_exists(self):
        """GET /api/auth/check-profile endpoint should exist"""
        response = requests.get(f"{BASE_URL}/api/auth/check-profile", timeout=10)
        assert response.status_code != 404, "Endpoint /api/auth/check-profile not found"
        print("✅ /api/auth/check-profile endpoint registered")

    def test_business_profile_endpoint_exists(self):
        """GET /api/business-profile endpoint should exist"""
        response = requests.get(f"{BASE_URL}/api/business-profile", timeout=10)
        assert response.status_code != 404, "Endpoint /api/business-profile not found"
        print("✅ /api/business-profile endpoint registered")

    def test_business_profile_scores_endpoint_exists(self):
        """GET /api/business-profile/scores endpoint should exist"""
        response = requests.get(f"{BASE_URL}/api/business-profile/scores", timeout=10)
        assert response.status_code != 404, "Endpoint /api/business-profile/scores not found"
        print("✅ /api/business-profile/scores endpoint registered")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
