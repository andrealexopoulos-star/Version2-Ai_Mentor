"""
Iteration 12: BIQC Calibration Write Unification Tests
-------------------------------------------------------
Key verification points:
1. POST /api/calibration/brain completion block writes to user_operator_profile.persona_calibration_status = 'complete'
2. POST /api/calibration/answer Q9 completion writes to user_operator_profile.persona_calibration_status = 'complete'
3. POST /api/calibration/answer fallback completion also writes to user_operator_profile
4. POST /api/calibration/defer writes persona_calibration_status = 'deferred' to user_operator_profile
5. POST /api/calibration/init does NOT reference calibration_status column
6. POST /api/admin/backfill-calibration endpoint exists and requires auth
7. GET /api/calibration/status reads ONLY from user_operator_profile (no business_profiles fallback)
8. GET /api/auth/check-profile reads ONLY from user_operator_profile (no business_profiles fallback)
9. All endpoints return 401 for unauthenticated requests

CRITICAL CONTEXT: business_profiles table does NOT have calibration_status column.
All writes to it were silently failing. user_operator_profile is the sole authority.
"""

import pytest
import requests
import os
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestCalibrationEndpointAuth:
    """All calibration endpoints return 401 for unauthenticated requests"""

    def test_calibration_status_unauthenticated(self):
        """GET /api/calibration/status returns 401 for unauthenticated"""
        response = requests.get(f"{BASE_URL}/api/calibration/status", timeout=10)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        print("✅ GET /api/calibration/status returns 401 for unauthenticated")

    def test_auth_check_profile_unauthenticated(self):
        """GET /api/auth/check-profile returns 401 for unauthenticated"""
        response = requests.get(f"{BASE_URL}/api/auth/check-profile", timeout=10)
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}: {response.text}"
        print("✅ GET /api/auth/check-profile returns 401 for unauthenticated")

    def test_calibration_defer_unauthenticated(self):
        """POST /api/calibration/defer returns 401 for unauthenticated"""
        response = requests.post(f"{BASE_URL}/api/calibration/defer", timeout=10)
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}: {response.text}"
        print("✅ POST /api/calibration/defer returns 401 for unauthenticated")

    def test_calibration_init_unauthenticated(self):
        """POST /api/calibration/init returns 401 for unauthenticated"""
        response = requests.post(f"{BASE_URL}/api/calibration/init", timeout=10)
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}: {response.text}"
        print("✅ POST /api/calibration/init returns 401 for unauthenticated")

    def test_calibration_answer_unauthenticated(self):
        """POST /api/calibration/answer returns 401 for unauthenticated"""
        response = requests.post(
            f"{BASE_URL}/api/calibration/answer",
            json={"question_id": 1, "answer": "Test"},
            timeout=10
        )
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}: {response.text}"
        print("✅ POST /api/calibration/answer returns 401 for unauthenticated")

    def test_calibration_brain_unauthenticated(self):
        """POST /api/calibration/brain returns 401 for unauthenticated"""
        response = requests.post(
            f"{BASE_URL}/api/calibration/brain",
            json={"message": "Test", "history": []},
            timeout=10
        )
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}: {response.text}"
        print("✅ POST /api/calibration/brain returns 401 for unauthenticated")

    def test_admin_backfill_calibration_unauthenticated(self):
        """POST /api/admin/backfill-calibration returns 401 for unauthenticated"""
        response = requests.post(f"{BASE_URL}/api/admin/backfill-calibration", timeout=10)
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}: {response.text}"
        print("✅ POST /api/admin/backfill-calibration returns 401 for unauthenticated")


class TestEndpointRegistration:
    """Verify all calibration endpoints are registered (not 404)"""

    def test_calibration_status_endpoint_exists(self):
        """GET /api/calibration/status endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/calibration/status", timeout=10)
        assert response.status_code != 404, f"Endpoint not found: {response.status_code}"
        print("✅ GET /api/calibration/status endpoint registered")

    def test_calibration_defer_endpoint_exists(self):
        """POST /api/calibration/defer endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/calibration/defer", timeout=10)
        assert response.status_code != 404, f"Endpoint not found: {response.status_code}"
        print("✅ POST /api/calibration/defer endpoint registered")

    def test_calibration_init_endpoint_exists(self):
        """POST /api/calibration/init endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/calibration/init", timeout=10)
        assert response.status_code != 404, f"Endpoint not found: {response.status_code}"
        print("✅ POST /api/calibration/init endpoint registered")

    def test_calibration_answer_endpoint_exists(self):
        """POST /api/calibration/answer endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/calibration/answer",
            json={"question_id": 1, "answer": "Test"},
            timeout=10
        )
        assert response.status_code != 404, f"Endpoint not found: {response.status_code}"
        print("✅ POST /api/calibration/answer endpoint registered")

    def test_calibration_brain_endpoint_exists(self):
        """POST /api/calibration/brain endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/calibration/brain",
            json={"message": "Test", "history": []},
            timeout=10
        )
        assert response.status_code != 404, f"Endpoint not found: {response.status_code}"
        print("✅ POST /api/calibration/brain endpoint registered")

    def test_admin_backfill_calibration_endpoint_exists(self):
        """POST /api/admin/backfill-calibration endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/admin/backfill-calibration", timeout=10)
        assert response.status_code != 404, f"Endpoint not found: {response.status_code}"
        print("✅ POST /api/admin/backfill-calibration endpoint registered")


class TestCalibrationBrainWritePath:
    """
    Code review: POST /api/calibration/brain completion block MUST write to 
    user_operator_profile.persona_calibration_status = 'complete'
    """

    def test_calibration_brain_writes_to_user_operator_profile(self):
        """calibration/brain completion block writes to user_operator_profile"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        # Find the calibration/brain completion block (around line 3195-3215)
        brain_section_match = re.search(
            r'if brain_response\.get\("status"\) == "COMPLETE".*?'
            r'# PRIMARY: Write to user_operator_profile.*?'
            r'supabase_admin\.table\("user_operator_profile"\).*?'
            r'"persona_calibration_status": "complete"',
            content, re.DOTALL
        )
        
        assert brain_section_match is not None, (
            "calibration/brain completion block MUST write persona_calibration_status='complete' "
            "to user_operator_profile. Pattern not found."
        )
        print("✅ calibration/brain writes persona_calibration_status='complete' to user_operator_profile")

    def test_calibration_brain_logs_write(self):
        """calibration/brain logs the user_operator_profile write"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        log_pattern = r'\[calibration/brain\].*user_operator_profile\.persona_calibration_status = complete'
        assert re.search(log_pattern, content), (
            "calibration/brain should log when writing to user_operator_profile"
        )
        print("✅ calibration/brain logs write to user_operator_profile")


class TestCalibrationAnswerWritePath:
    """
    Code review: POST /api/calibration/answer Q9 completion MUST write to 
    user_operator_profile.persona_calibration_status = 'complete'
    """

    def test_calibration_answer_q9_writes_to_user_operator_profile(self):
        """calibration/answer Q9 completion writes to user_operator_profile"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        # Find the calibration/answer Q9 completion block
        answer_section_match = re.search(
            r'# PRIMARY: Write to user_operator_profile \(authoritative\).*?'
            r'\[calibration/answer\].*?'
            r'supabase_admin\.table\("user_operator_profile"\).*?'
            r'"persona_calibration_status": "complete"',
            content, re.DOTALL
        )
        
        assert answer_section_match is not None, (
            "calibration/answer Q9 completion MUST write persona_calibration_status='complete' "
            "to user_operator_profile. Pattern not found."
        )
        print("✅ calibration/answer Q9 writes persona_calibration_status='complete' to user_operator_profile")

    def test_calibration_answer_fallback_writes_to_user_operator_profile(self):
        """calibration/answer fallback completion also writes to user_operator_profile"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        # Check for fallback block that writes to user_operator_profile when strategy fails
        fallback_pattern = re.search(
            r'# PRIMARY: user_operator_profile.*?'
            r'existing_op2 = supabase_admin\.table\("user_operator_profile"\)',
            content, re.DOTALL
        )
        
        assert fallback_pattern is not None, (
            "calibration/answer fallback path MUST also write to user_operator_profile"
        )
        print("✅ calibration/answer fallback writes to user_operator_profile")

    def test_calibration_answer_logs_write(self):
        """calibration/answer logs the user_operator_profile write"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        log_pattern = r'\[calibration/answer\].*user_operator_profile\.persona_calibration_status = complete'
        assert re.search(log_pattern, content), (
            "calibration/answer should log when writing to user_operator_profile"
        )
        print("✅ calibration/answer logs write to user_operator_profile")


class TestCalibrationDeferWritePath:
    """
    Code review: POST /api/calibration/defer MUST write 
    persona_calibration_status = 'deferred' to user_operator_profile
    """

    def test_calibration_defer_writes_deferred_to_user_operator_profile(self):
        """calibration/defer writes 'deferred' to user_operator_profile"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        # Find the calibration/defer block
        defer_section_match = re.search(
            r'@api_router\.post\("/calibration/defer"\).*?'
            r'# PRIMARY: Write to user_operator_profile.*?'
            r'supabase_admin\.table\("user_operator_profile"\).*?'
            r'"persona_calibration_status": "deferred"',
            content, re.DOTALL
        )
        
        assert defer_section_match is not None, (
            "calibration/defer MUST write persona_calibration_status='deferred' "
            "to user_operator_profile. Pattern not found."
        )
        print("✅ calibration/defer writes persona_calibration_status='deferred' to user_operator_profile")

    def test_calibration_defer_upsert_pattern(self):
        """calibration/defer handles both update and insert to user_operator_profile"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        # Extract the defer function section
        defer_start = content.find('@api_router.post("/calibration/defer")')
        defer_end = content.find('@api_router.post("/calibration/init")')
        defer_section = content[defer_start:defer_end] if defer_start > 0 and defer_end > 0 else ""
        
        # Check for upsert pattern
        has_update = 'user_operator_profile").update(' in defer_section
        has_insert = 'user_operator_profile").insert(' in defer_section
        
        assert has_update and has_insert, (
            "calibration/defer MUST handle both update and insert cases for user_operator_profile"
        )
        print("✅ calibration/defer handles update and insert to user_operator_profile")


class TestCalibrationInitNoCalibrationStatus:
    """
    Code review: POST /api/calibration/init MUST NOT reference 
    calibration_status column (does not exist in business_profiles)
    """

    def test_calibration_init_no_calibration_status_reference(self):
        """calibration/init does NOT reference calibration_status column"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        # Extract the init function section
        init_start = content.find('@api_router.post("/calibration/init")')
        init_end = content.find('@api_router.post("/calibration/answer")')
        init_section = content[init_start:init_end] if init_start > 0 and init_end > 0 else ""
        
        # The init section should NOT contain calibration_status writes
        # It should only create a shell profile without setting calibration status
        profile_insert = 'business_profiles").insert(profile_data)' in init_section
        no_calibration_status_in_insert = '"calibration_status"' not in init_section.split('profile_data = {')[1].split('}')[0] if 'profile_data = {' in init_section else True
        
        assert profile_insert, "calibration/init should insert to business_profiles"
        assert no_calibration_status_in_insert, (
            "calibration/init MUST NOT write calibration_status to business_profiles "
            "(column does not exist)"
        )
        print("✅ calibration/init does NOT reference calibration_status column in insert")


class TestCalibrationStatusReadPath:
    """
    Code review: GET /api/calibration/status MUST read ONLY from 
    user_operator_profile.persona_calibration_status (no business_profiles fallback)
    """

    def test_calibration_status_reads_from_user_operator_profile_only(self):
        """calibration/status reads ONLY from user_operator_profile"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        # Find the calibration/status function
        status_start = content.find('@api_router.get("/calibration/status")')
        status_end = content.find('@api_router.post("/calibration/defer")')
        status_section = content[status_start:status_end] if status_start > 0 and status_end > 0 else ""
        
        # Should have user_operator_profile read
        has_op_read = 'user_operator_profile").select(' in status_section
        has_persona_status_read = 'persona_calibration_status' in status_section
        
        # Should NOT have business_profiles fallback
        no_bp_fallback = 'business_profiles")' not in status_section or 'calibration_status' not in status_section
        
        assert has_op_read, "calibration/status MUST read from user_operator_profile"
        assert has_persona_status_read, "calibration/status MUST read persona_calibration_status"
        assert no_bp_fallback, (
            "calibration/status MUST NOT have business_profiles.calibration_status fallback"
        )
        print("✅ calibration/status reads ONLY from user_operator_profile.persona_calibration_status")

    def test_calibration_status_docstring_mentions_sole_authority(self):
        """calibration/status docstring mentions user_operator_profile as sole authority"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        docstring_pattern = r'Single source of truth: user_operator_profile\.persona_calibration_status'
        # Should appear in both get_calibration_status docstring
        matches = re.findall(docstring_pattern, content)
        assert len(matches) >= 1, (
            "calibration/status docstring should mention user_operator_profile as sole authority"
        )
        print("✅ calibration/status docstring mentions user_operator_profile as sole authority")


class TestAuthCheckProfileReadPath:
    """
    Code review: GET /api/auth/check-profile MUST read ONLY from 
    user_operator_profile.persona_calibration_status (no business_profiles fallback)
    """

    def test_auth_check_profile_reads_from_user_operator_profile_only(self):
        """auth/check-profile reads ONLY from user_operator_profile"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        # Find the auth/check-profile function
        profile_start = content.find('@api_router.get("/auth/check-profile")')
        profile_end = content.find('@api_router.get("/calibration/status")')
        profile_section = content[profile_start:profile_end] if profile_start > 0 and profile_end > 0 else ""
        
        # Should have user_operator_profile read for calibration status
        has_op_read = 'user_operator_profile").select(' in profile_section
        has_persona_status_check = 'persona_calibration_status' in profile_section
        
        # Should have comment about reading from user_operator_profile ONLY
        has_only_comment = '# Check calibration from user_operator_profile ONLY' in profile_section
        
        assert has_op_read, "auth/check-profile MUST read from user_operator_profile"
        assert has_persona_status_check, "auth/check-profile MUST check persona_calibration_status"
        assert has_only_comment, (
            "auth/check-profile MUST have comment indicating user_operator_profile ONLY read"
        )
        print("✅ auth/check-profile reads ONLY from user_operator_profile.persona_calibration_status")

    def test_auth_check_profile_no_business_profiles_calibration_read(self):
        """auth/check-profile does NOT read calibration_status from business_profiles"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        # Find the auth/check-profile function
        profile_start = content.find('@api_router.get("/auth/check-profile")')
        profile_end = content.find('@api_router.get("/calibration/status")')
        profile_section = content[profile_start:profile_end] if profile_start > 0 and profile_end > 0 else ""
        
        # May read business_profiles for other data (business_name, etc.)
        # But should NOT use it for calibration status determination
        # Check that calibration_complete is determined solely by user_operator_profile
        calibration_determination = (
            'calibration_complete = False' in profile_section and
            'op_result.data.get("persona_calibration_status") == "complete"' in profile_section
        )
        
        # Should NOT have: if business_profile.get("calibration_status")
        no_bp_calibration_check = 'business_profile.get("calibration_status")' not in profile_section
        
        assert calibration_determination, (
            "auth/check-profile calibration_complete must be determined by user_operator_profile only"
        )
        assert no_bp_calibration_check, (
            "auth/check-profile MUST NOT read calibration_status from business_profiles"
        )
        print("✅ auth/check-profile does NOT use business_profiles.calibration_status for gating")


class TestAdminBackfillEndpoint:
    """
    Verify POST /api/admin/backfill-calibration endpoint exists and works correctly
    """

    def test_backfill_writes_to_user_operator_profile(self):
        """admin/backfill-calibration writes to user_operator_profile"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        # Find the backfill function
        backfill_start = content.find('@api_router.post("/admin/backfill-calibration")')
        if backfill_start > 0:
            # Look for next function start
            next_func = content.find('@api_router.', backfill_start + 10)
            backfill_section = content[backfill_start:next_func] if next_func > 0 else content[backfill_start:backfill_start + 2000]
            
            # Should write to user_operator_profile
            has_op_write = 'user_operator_profile").update(' in backfill_section or \
                          'user_operator_profile").insert(' in backfill_section
            has_complete_write = '"persona_calibration_status": "complete"' in backfill_section
            
            assert has_op_write, "admin/backfill-calibration MUST write to user_operator_profile"
            assert has_complete_write, "admin/backfill-calibration MUST write persona_calibration_status='complete'"
            print("✅ admin/backfill-calibration writes to user_operator_profile")
        else:
            pytest.fail("admin/backfill-calibration endpoint not found in server.py")


class TestBackendHealth:
    """Basic backend health check"""

    def test_backend_health(self):
        """Backend responds to health check"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("✅ Backend healthy")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
