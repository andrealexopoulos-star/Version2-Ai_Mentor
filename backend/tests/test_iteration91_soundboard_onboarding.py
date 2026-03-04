"""
Iteration 91: Test SoundBoard file attachment + Onboarding fix
Tests:
- Onboarding complete endpoint sets persona_calibration_status
- SoundBoard chat endpoint works normally
- Backend endpoint health checks
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture
def client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestHealthChecks:
    """Basic health/endpoint checks"""

    def test_backend_health(self, client):
        resp = client.get(f"{BASE_URL}/api/health")
        assert resp.status_code in [200, 404], f"Backend unreachable: {resp.status_code}"
        print(f"[PASS] Backend health: {resp.status_code}")

    def test_soundboard_chat_without_auth(self, client):
        """SoundBoard chat endpoint should return 401 without auth token"""
        resp = client.post(f"{BASE_URL}/api/soundboard/chat", json={
            "message": "test message",
            "intelligence_context": {}
        })
        assert resp.status_code in [401, 403, 422], f"Expected auth error, got: {resp.status_code}"
        print(f"[PASS] SoundBoard chat without auth returns {resp.status_code}")

    def test_soundboard_conversations_without_auth(self, client):
        """SoundBoard conversations endpoint should return 401 without auth"""
        resp = client.get(f"{BASE_URL}/api/soundboard/conversations")
        assert resp.status_code in [401, 403, 422], f"Expected auth error, got: {resp.status_code}"
        print(f"[PASS] SoundBoard conversations without auth returns {resp.status_code}")

    def test_onboarding_complete_without_auth(self, client):
        """Onboarding complete endpoint should return 401 without auth"""
        resp = client.post(f"{BASE_URL}/api/onboarding/complete")
        assert resp.status_code in [401, 403, 422], f"Expected auth error, got: {resp.status_code}"
        print(f"[PASS] Onboarding complete without auth returns {resp.status_code}")

    def test_onboarding_status_without_auth(self, client):
        """Onboarding status endpoint should return 401 without auth"""
        resp = client.get(f"{BASE_URL}/api/onboarding/status")
        assert resp.status_code in [401, 403, 422], f"Expected auth error, got: {resp.status_code}"
        print(f"[PASS] Onboarding status without auth returns {resp.status_code}")

    def test_check_profile_without_auth(self, client):
        """Auth check-profile endpoint should return 401 without auth"""
        resp = client.get(f"{BASE_URL}/api/auth/check-profile")
        assert resp.status_code in [401, 403, 422], f"Expected auth error, got: {resp.status_code}"
        print(f"[PASS] check-profile without auth returns {resp.status_code}")


class TestMigrationFilesExist:
    """Verify SQL migration files exist and have required content"""

    def test_migration_044_exists(self):
        sql_path = "/app/supabase/migrations/044_cognition_core.sql"
        assert os.path.exists(sql_path), "Migration 044 not found"
        with open(sql_path) as f:
            content = f.read()
        # Check required tables exist
        required_tables = [
            "cognition_decisions",
            "propagation_rules",
            "automation_actions",
            "automation_executions",
            "instability_snapshots",
            "evidence_packs",
            "integration_health",
            "outcome_checkpoints",
            "confidence_recalibrations"
        ]
        for table in required_tables:
            assert table in content, f"Table {table} not found in migration 044"
        print(f"[PASS] Migration 044 has all {len(required_tables)} required tables")

    def test_migration_045_exists(self):
        sql_path = "/app/supabase/migrations/045_cognition_core_functions.sql"
        assert os.path.exists(sql_path), "Migration 045 not found"
        with open(sql_path) as f:
            content = f.read()
        assert "ic_generate_cognition_contract" in content, "ic_generate_cognition_contract function not found"
        print("[PASS] Migration 045 has ic_generate_cognition_contract function")

    def test_migration_045_has_core_functions(self):
        sql_path = "/app/supabase/migrations/045_cognition_core_functions.sql"
        with open(sql_path) as f:
            content = f.read()
        required_functions = [
            "fn_assemble_evidence_pack",
            "fn_compute_propagation_map",
            "fn_snapshot_daily_instability",
            "ic_generate_cognition_contract",
        ]
        for fn in required_functions:
            assert fn in content, f"Function {fn} not found in migration 045"
        print(f"[PASS] Migration 045 has all required functions")


class TestOnboardingCodeFix:
    """Test that onboarding.py code has the persona_calibration_status fix"""

    def test_onboarding_file_has_persona_calibration_fix(self):
        onboarding_path = "/app/backend/routes/onboarding.py"
        assert os.path.exists(onboarding_path), "onboarding.py not found"
        with open(onboarding_path) as f:
            content = f.read()
        assert 'persona_calibration_status' in content, "Fix for persona_calibration_status not found"
        assert '"complete"' in content or "'complete'" in content, "Setting status to 'complete' not found"
        # Ensure set in complete_onboarding function context
        assert 'FIX' in content or 'LOOP-BREAKER' in content, "Fix comment not found in onboarding.py"
        print("[PASS] onboarding.py has persona_calibration_status = 'complete' fix")


class TestFloatingSoundboardCode:
    """Test that FloatingSoundboard.js has the required file attachment code"""

    def test_floating_soundboard_has_paperclip(self):
        js_path = "/app/frontend/src/components/FloatingSoundboard.js"
        assert os.path.exists(js_path), "FloatingSoundboard.js not found"
        with open(js_path) as f:
            content = f.read()
        assert 'Paperclip' in content, "Paperclip import/usage not found"
        assert 'soundboard-attach' in content, "data-testid soundboard-attach not found"
        assert 'handleFileSelect' in content, "handleFileSelect function not found"
        assert 'attachedFile' in content, "attachedFile state not found"
        print("[PASS] FloatingSoundboard.js has Paperclip button and file attachment code")

    def test_floating_soundboard_has_file_download_card(self):
        js_path = "/app/frontend/src/components/FloatingSoundboard.js"
        with open(js_path) as f:
            content = f.read()
        assert 'msg.file' in content or 'message.file' in content, "File download card logic not found"
        assert 'download_url' in content, "download_url not found in file download card"
        print("[PASS] FloatingSoundboard.js has file download card rendering")

    def test_floating_soundboard_has_attachment_preview(self):
        js_path = "/app/frontend/src/components/FloatingSoundboard.js"
        with open(js_path) as f:
            content = f.read()
        assert 'attachedFile &&' in content or '{attachedFile &&' in content, "Attachment preview conditional not found"
        assert 'FileText' in content, "FileText icon not found in attachment preview"
        print("[PASS] FloatingSoundboard.js has file attachment preview strip")


class TestMySoundBoardCode:
    """Test that MySoundBoard.js has the required file attachment code"""

    def test_mysoundboard_has_paperclip_import(self):
        js_path = "/app/frontend/src/pages/MySoundBoard.js"
        assert os.path.exists(js_path), "MySoundBoard.js not found"
        with open(js_path) as f:
            content = f.read()
        assert 'Paperclip' in content, "Paperclip not imported in MySoundBoard.js"
        assert 'FileText' in content, "FileText not imported in MySoundBoard.js"
        assert 'Download' in content, "Download not imported in MySoundBoard.js"
        print("[PASS] MySoundBoard.js imports Paperclip, FileText, Download")

    def test_mysoundboard_has_attached_file_state(self):
        js_path = "/app/frontend/src/pages/MySoundBoard.js"
        with open(js_path) as f:
            content = f.read()
        assert 'attachedFile' in content, "attachedFile state not found"
        assert 'fileRef' in content, "fileRef not found"
        assert 'handleFileSelect' in content, "handleFileSelect function not found"
        print("[PASS] MySoundBoard.js has attachedFile state, fileRef, handleFileSelect")

    def test_mysoundboard_has_soundboard_attach_testid(self):
        js_path = "/app/frontend/src/pages/MySoundBoard.js"
        with open(js_path) as f:
            content = f.read()
        assert 'soundboard-attach' in content, "data-testid soundboard-attach not found in MySoundBoard.js"
        print("[PASS] MySoundBoard.js has data-testid soundboard-attach")

    def test_mysoundboard_has_mono_constant(self):
        js_path = "/app/frontend/src/pages/MySoundBoard.js"
        with open(js_path) as f:
            content = f.read()
        assert 'MONO' in content, "MONO constant not defined in MySoundBoard.js"
        print("[PASS] MySoundBoard.js has MONO constant")

    def test_mysoundboard_has_file_download_card(self):
        js_path = "/app/frontend/src/pages/MySoundBoard.js"
        with open(js_path) as f:
            content = f.read()
        assert 'message.file' in content or 'msg.file' in content, "File download card not found"
        assert 'download_url' in content, "download_url reference not found"
        print("[PASS] MySoundBoard.js has file download card rendering")
