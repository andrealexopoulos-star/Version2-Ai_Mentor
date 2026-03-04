"""
Iteration 93: Test SoundBoard scan-usage & record-scan endpoints
Tests:
- GET /soundboard/scan-usage returns correct fields (calibration_complete, is_paid, exposure_scan, etc.)
- POST /soundboard/record-scan validates correctly without auth
- Migration 046_user_feature_usage.sql exists with correct schema
- MySoundBoard.js syntax: imports before const declarations
- SoundboardPanel.js uses server-side welcome (convs.length === 0 check)
- SoundboardPanel.js: calibration button only shown when not calibration_complete
- Scan button label is 'Forensic Market Exposure'
"""
import pytest
import requests
import os
import ast

def _get_base_url():
    url = os.environ.get('REACT_APP_BACKEND_URL', '')
    if not url:
        # Try reading from .env file
        env_path = '/app/frontend/.env'
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        url = line.split('=', 1)[1].strip()
                        break
    return url.rstrip('/')

BASE_URL = _get_base_url()


@pytest.fixture
def client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# ───────────────────────────────────────────────────────────────
# Auth-protected endpoint checks (no auth → 401/403/422)
# ───────────────────────────────────────────────────────────────
class TestScanUsageNoAuth:
    """Verify scan-usage and record-scan require authentication"""

    def test_scan_usage_without_auth(self, client):
        resp = client.get(f"{BASE_URL}/api/soundboard/scan-usage")
        assert resp.status_code in [401, 403, 422], \
            f"Expected auth error for scan-usage, got: {resp.status_code} - {resp.text}"
        print(f"[PASS] GET /soundboard/scan-usage without auth returns {resp.status_code}")

    def test_record_scan_without_auth(self, client):
        resp = client.post(f"{BASE_URL}/api/soundboard/record-scan", json={"feature_name": "exposure_scan"})
        assert resp.status_code in [401, 403, 422], \
            f"Expected auth error for record-scan, got: {resp.status_code} - {resp.text}"
        print(f"[PASS] POST /soundboard/record-scan without auth returns {resp.status_code}")

    def test_record_scan_invalid_feature_without_auth(self, client):
        """Invalid feature_name should get auth error first (before validation)"""
        resp = client.post(f"{BASE_URL}/api/soundboard/record-scan", json={"feature_name": "invalid_feature"})
        assert resp.status_code in [400, 401, 403, 422], \
            f"Expected auth or validation error, got: {resp.status_code}"
        print(f"[PASS] POST /soundboard/record-scan with invalid feature returns {resp.status_code}")

    def test_record_scan_missing_body_without_auth(self, client):
        """Missing body should return auth error or validation error"""
        resp = client.post(f"{BASE_URL}/api/soundboard/record-scan", json={})
        assert resp.status_code in [401, 403, 422], \
            f"Expected auth/validation error, got: {resp.status_code}"
        print(f"[PASS] POST /soundboard/record-scan with empty body returns {resp.status_code}")


# ───────────────────────────────────────────────────────────────
# Migration file verification
# ───────────────────────────────────────────────────────────────
class TestMigration046:
    """Verify SQL migration file 046 exists and has correct schema"""

    def test_migration_046_exists(self):
        sql_path = "/app/supabase/migrations/046_user_feature_usage.sql"
        assert os.path.exists(sql_path), f"Migration 046 not found at {sql_path}"
        print("[PASS] Migration 046 file exists")

    def test_migration_046_has_table_creation(self):
        sql_path = "/app/supabase/migrations/046_user_feature_usage.sql"
        with open(sql_path) as f:
            content = f.read()
        assert "CREATE TABLE" in content.upper(), "CREATE TABLE not found in migration 046"
        assert "user_feature_usage" in content, "user_feature_usage table not found in migration 046"
        print("[PASS] Migration 046 has CREATE TABLE user_feature_usage")

    def test_migration_046_has_required_columns(self):
        sql_path = "/app/supabase/migrations/046_user_feature_usage.sql"
        with open(sql_path) as f:
            content = f.read()
        required_cols = ["user_id", "feature_name", "last_used_at", "use_count"]
        for col in required_cols:
            assert col in content, f"Column '{col}' not found in migration 046"
        print(f"[PASS] Migration 046 has all required columns: {required_cols}")

    def test_migration_046_has_rls(self):
        sql_path = "/app/supabase/migrations/046_user_feature_usage.sql"
        with open(sql_path) as f:
            content = f.read()
        assert "ROW LEVEL SECURITY" in content.upper() or "ENABLE ROW LEVEL SECURITY" in content, \
            "RLS not enabled in migration 046"
        print("[PASS] Migration 046 has RLS enabled")

    def test_migration_046_has_unique_constraint(self):
        sql_path = "/app/supabase/migrations/046_user_feature_usage.sql"
        with open(sql_path) as f:
            content = f.read()
        assert "UNIQUE" in content, "UNIQUE constraint not found (needed for upsert)"
        print("[PASS] Migration 046 has UNIQUE constraint for user_id + feature_name")


# ───────────────────────────────────────────────────────────────
# Backend soundboard.py code review
# ───────────────────────────────────────────────────────────────
class TestSoundboardBackendCode:
    """Verify soundboard.py has the correct scan-usage and record-scan endpoints"""

    def test_soundboard_py_has_scan_usage_endpoint(self):
        path = "/app/backend/routes/soundboard.py"
        assert os.path.exists(path), "soundboard.py not found"
        with open(path) as f:
            content = f.read()
        assert '@router.get("/soundboard/scan-usage")' in content, \
            "GET /soundboard/scan-usage endpoint not found"
        print("[PASS] soundboard.py has GET /soundboard/scan-usage")

    def test_soundboard_py_has_record_scan_endpoint(self):
        path = "/app/backend/routes/soundboard.py"
        with open(path) as f:
            content = f.read()
        assert '@router.post("/soundboard/record-scan")' in content, \
            "POST /soundboard/record-scan endpoint not found"
        print("[PASS] soundboard.py has POST /soundboard/record-scan")

    def test_soundboard_py_scan_usage_returns_calibration_complete(self):
        path = "/app/backend/routes/soundboard.py"
        with open(path) as f:
            content = f.read()
        assert '"calibration_complete"' in content or "'calibration_complete'" in content, \
            "calibration_complete field not in scan-usage response"
        print("[PASS] soundboard.py scan-usage returns calibration_complete")

    def test_soundboard_py_scan_usage_returns_is_paid(self):
        path = "/app/backend/routes/soundboard.py"
        with open(path) as f:
            content = f.read()
        assert '"is_paid"' in content or "'is_paid'" in content, \
            "is_paid field not in scan-usage response"
        print("[PASS] soundboard.py scan-usage returns is_paid")

    def test_soundboard_py_scan_usage_returns_exposure_scan(self):
        path = "/app/backend/routes/soundboard.py"
        with open(path) as f:
            content = f.read()
        assert '"exposure_scan"' in content or "'exposure_scan'" in content, \
            "exposure_scan field not in scan-usage response"
        print("[PASS] soundboard.py scan-usage returns exposure_scan")

    def test_soundboard_py_feature_usage_table(self):
        path = "/app/backend/routes/soundboard.py"
        with open(path) as f:
            content = f.read()
        assert '"user_feature_usage"' in content or "'user_feature_usage'" in content, \
            "user_feature_usage table not referenced in soundboard.py"
        print("[PASS] soundboard.py references user_feature_usage table")

    def test_soundboard_py_scan_cooldown_days_30(self):
        path = "/app/backend/routes/soundboard.py"
        with open(path) as f:
            content = f.read()
        assert "SCAN_COOLDOWN_DAYS = 30" in content, \
            "SCAN_COOLDOWN_DAYS = 30 not found — 30-day timer not configured"
        print("[PASS] soundboard.py has SCAN_COOLDOWN_DAYS = 30")

    def test_soundboard_py_record_scan_upsert_logic(self):
        path = "/app/backend/routes/soundboard.py"
        with open(path) as f:
            content = f.read()
        # Should have both insert and update logic (upsert pattern)
        assert "insert" in content and "update" in content, \
            "Upsert pattern (insert + update) not found in record_scan"
        print("[PASS] soundboard.py record_scan has upsert logic")

    def test_soundboard_py_feature_validation(self):
        path = "/app/backend/routes/soundboard.py"
        with open(path) as f:
            content = f.read()
        # Feature validation: only allow exposure_scan and forensic_calibration
        assert "exposure_scan" in content and "forensic_calibration" in content, \
            "Feature names validation not found in soundboard.py"
        print("[PASS] soundboard.py validates feature names")


# ───────────────────────────────────────────────────────────────
# SoundboardPanel.js code review
# ───────────────────────────────────────────────────────────────
class TestSoundboardPanelCode:
    """Test SoundboardPanel.js has the correct server-side features"""

    def test_soundboard_panel_fetchscanusage_on_mount(self):
        path = "/app/frontend/src/components/SoundboardPanel.js"
        assert os.path.exists(path), "SoundboardPanel.js not found"
        with open(path) as f:
            content = f.read()
        assert 'fetchScanUsage' in content, "fetchScanUsage function not found"
        # Should be called in useEffect
        assert 'fetchScanUsage()' in content, "fetchScanUsage() not called (should be in useEffect)"
        print("[PASS] SoundboardPanel.js has fetchScanUsage called on mount")

    def test_soundboard_panel_uses_scan_usage_api(self):
        path = "/app/frontend/src/components/SoundboardPanel.js"
        with open(path) as f:
            content = f.read()
        assert "'/soundboard/scan-usage'" in content or '"/soundboard/scan-usage"' in content or \
               "/soundboard/scan-usage" in content, \
            "SoundboardPanel.js does not call /soundboard/scan-usage"
        print("[PASS] SoundboardPanel.js calls /soundboard/scan-usage API")

    def test_soundboard_panel_welcome_no_localstorage(self):
        path = "/app/frontend/src/components/SoundboardPanel.js"
        with open(path) as f:
            content = f.read()
        # Welcome message should check conversations.length === 0 from server
        assert "convs.length === 0" in content or "conversations.length === 0" in content, \
            "Welcome message check convs.length === 0 not found"
        # Should NOT use localStorage for welcome check
        assert "isFirstVisit" not in content and "localStorage.getItem" not in content, \
            "SoundboardPanel.js still uses localStorage for welcome message (should use server)"
        print("[PASS] SoundboardPanel.js welcome message uses server-side check (no localStorage)")

    def test_soundboard_panel_calibration_btn_conditional(self):
        path = "/app/frontend/src/components/SoundboardPanel.js"
        with open(path) as f:
            content = f.read()
        # Calibration button only shown when scanUsage.calibration_complete === false
        assert "!scanUsage.calibration_complete" in content or \
               "scanUsage && !scanUsage.calibration_complete" in content, \
            "Calibration button should only show when calibration_complete is false"
        print("[PASS] SoundboardPanel.js calibration button only shown when not calibrated")

    def test_soundboard_panel_forensic_market_exposure_label(self):
        path = "/app/frontend/src/components/SoundboardPanel.js"
        with open(path) as f:
            content = f.read()
        assert "Forensic Market Exposure" in content, \
            "Button label 'Forensic Market Exposure' not found in SoundboardPanel.js"
        # Should NOT use the old label
        assert "Run Exposure Scan" not in content, \
            "Old label 'Run Exposure Scan' still found in SoundboardPanel.js"
        print("[PASS] SoundboardPanel.js uses 'Forensic Market Exposure' label (not 'Run Exposure Scan')")

    def test_soundboard_panel_record_scan_on_click(self):
        path = "/app/frontend/src/components/SoundboardPanel.js"
        with open(path) as f:
            content = f.read()
        assert "'/soundboard/record-scan'" in content or '"/soundboard/record-scan"' in content or \
               "/soundboard/record-scan" in content, \
            "SoundboardPanel.js does not call /soundboard/record-scan on click"
        print("[PASS] SoundboardPanel.js calls /soundboard/record-scan POST on click")


# ───────────────────────────────────────────────────────────────
# MySoundBoard.js code review
# ───────────────────────────────────────────────────────────────
class TestMySoundBoardCode:
    """Test MySoundBoard.js has correct imports, scan-usage and welcome message"""

    def test_mysoundboard_imports_before_consts(self):
        """All imports must come before const declarations (JS syntax requirement)"""
        path = "/app/frontend/src/pages/MySoundBoard.js"
        assert os.path.exists(path), "MySoundBoard.js not found"
        with open(path) as f:
            lines = f.readlines()

        import_lines = []
        const_lines = []
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("import "):
                import_lines.append(i)
            elif stripped.startswith("const ") and not stripped.startswith("const MONO") and not stripped.startswith("const BODY"):
                # First const declaration that's not font consts
                pass
            # Track any const that's before imports would be a problem
            if stripped.startswith("const "):
                const_lines.append(i)

        if import_lines and const_lines:
            last_import = max(import_lines)
            first_const = min(const_lines)
            # All imports must come before first const
            # Check: no import after first const
            imports_after_const = [l for l in import_lines if l > first_const]
            assert len(imports_after_const) == 0, \
                f"Import statements found after const declarations at lines: {imports_after_const}"
        print(f"[PASS] MySoundBoard.js: all {len(import_lines)} imports are before const declarations")

    def test_mysoundboard_fetchscanusage_on_mount(self):
        path = "/app/frontend/src/pages/MySoundBoard.js"
        with open(path) as f:
            content = f.read()
        assert 'fetchScanUsage' in content, "fetchScanUsage not found in MySoundBoard.js"
        assert 'fetchScanUsage()' in content, "fetchScanUsage() not called in MySoundBoard.js"
        print("[PASS] MySoundBoard.js has fetchScanUsage called on mount")

    def test_mysoundboard_fetchscanusage_calls_api(self):
        path = "/app/frontend/src/pages/MySoundBoard.js"
        with open(path) as f:
            content = f.read()
        assert "/soundboard/scan-usage" in content, \
            "MySoundBoard.js does not call /soundboard/scan-usage API"
        print("[PASS] MySoundBoard.js fetchScanUsage calls /soundboard/scan-usage")

    def test_mysoundboard_welcome_server_based(self):
        path = "/app/frontend/src/pages/MySoundBoard.js"
        with open(path) as f:
            content = f.read()
        # Welcome message check based on server conversations
        assert "convs.length === 0" in content, \
            "MySoundBoard.js should check convs.length === 0 for welcome message (server truth)"
        print("[PASS] MySoundBoard.js welcome message is based on server-side conversation count")

    def test_mysoundboard_calibration_btn_in_header(self):
        path = "/app/frontend/src/pages/MySoundBoard.js"
        with open(path) as f:
            content = f.read()
        assert "mysb-calibration-btn" in content, \
            "data-testid='mysb-calibration-btn' not found in MySoundBoard.js header"
        assert "Complete Calibration" in content, \
            "'Complete Calibration' button text not found in MySoundBoard.js"
        print("[PASS] MySoundBoard.js has calibration button in header")

    def test_mysoundboard_exposure_scan_btn_label(self):
        path = "/app/frontend/src/pages/MySoundBoard.js"
        with open(path) as f:
            content = f.read()
        assert "Forensic Market Exposure" in content, \
            "Button label 'Forensic Market Exposure' not found in MySoundBoard.js"
        assert "mysb-exposure-scan-btn" in content, \
            "data-testid='mysb-exposure-scan-btn' not found in MySoundBoard.js"
        print("[PASS] MySoundBoard.js has 'Forensic Market Exposure' button with correct testid")

    def test_mysoundboard_calibration_btn_conditional(self):
        path = "/app/frontend/src/pages/MySoundBoard.js"
        with open(path) as f:
            content = f.read()
        # Should check scanUsage.calibration_complete to conditionally render
        assert "!scanUsage.calibration_complete" in content, \
            "MySoundBoard.js calibration button should be conditional on !calibration_complete"
        print("[PASS] MySoundBoard.js calibration button is conditional on calibration_complete")

    def test_mysoundboard_record_scan_on_click(self):
        path = "/app/frontend/src/pages/MySoundBoard.js"
        with open(path) as f:
            content = f.read()
        assert "/soundboard/record-scan" in content, \
            "MySoundBoard.js does not call /soundboard/record-scan"
        print("[PASS] MySoundBoard.js calls /soundboard/record-scan on exposure scan click")

    def test_mysoundboard_no_localstorage_for_scan_tracking(self):
        path = "/app/frontend/src/pages/MySoundBoard.js"
        with open(path) as f:
            content = f.read()
        # Should not use localStorage for scan tracking
        # Check for localStorage usage related to scan
        scan_localstorage_patterns = [
            "localStorage.getItem('biqc_exposure",
            "localStorage.setItem('biqc_exposure",
            "biqc_exposure_scan_cache",
        ]
        for pattern in scan_localstorage_patterns:
            assert pattern not in content, \
                f"MySoundBoard.js still uses localStorage for scan tracking: '{pattern}'"
        print("[PASS] MySoundBoard.js does not use localStorage for scan tracking")
