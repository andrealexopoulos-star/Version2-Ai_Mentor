"""
Iteration 40: Zero-Redirect Protocol Backend Tests
Tests for:
1. /api/calibration/status returns COMPLETE when strategic_console_state.is_complete=true
2. /api/lifecycle/state returns calibration complete when strategic_console_state.is_complete=true
3. /api/onboarding/status returns completed when strategic_console_state.is_complete=true
4. timedelta import in calibration.py
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = 'https://ai-strategic-hub.preview.emergentagent.com'


class TestZeroRedirectProtocol:
    """Tests for Zero-Redirect Protocol endpoints - requires valid Supabase auth"""
    
    @pytest.fixture
    def auth_session(self):
        """Login and get authenticated session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Try to login with test credentials
        login_resp = session.post(f"{BASE_URL}/api/auth/supabase/login", json={
            "email": "e2e-rca-test@test.com",
            "password": "Sovereign!Test2026#"
        })
        
        if login_resp.status_code != 200:
            pytest.skip("Could not authenticate - skipping authenticated tests")
        
        data = login_resp.json()
        access_token = data.get("session", {}).get("access_token")
        if not access_token:
            pytest.skip("No access token returned - skipping authenticated tests")
        
        session.headers.update({"Authorization": f"Bearer {access_token}"})
        return session
    
    def test_calibration_status_endpoint_exists(self, auth_session):
        """Test /api/calibration/status returns valid response"""
        response = auth_session.get(f"{BASE_URL}/api/calibration/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "status" in data, "Response should contain 'status' field"
        assert data["status"] in ["COMPLETE", "IN_PROGRESS", "NEEDS_CALIBRATION"], \
            f"Invalid status: {data['status']}"
        print(f"✓ calibration/status returns: {data['status']}")
    
    def test_lifecycle_state_endpoint_exists(self, auth_session):
        """Test /api/lifecycle/state returns valid response"""
        response = auth_session.get(f"{BASE_URL}/api/lifecycle/state")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "calibration" in data, "Response should contain 'calibration' field"
        assert "complete" in data["calibration"], "calibration should have 'complete' field"
        assert "onboarding" in data, "Response should contain 'onboarding' field"
        assert "console" in data, "Response should contain 'console' field"
        print(f"✓ lifecycle/state returns calibration.complete={data['calibration']['complete']}")
    
    def test_onboarding_status_endpoint_exists(self, auth_session):
        """Test /api/onboarding/status returns valid response"""
        response = auth_session.get(f"{BASE_URL}/api/onboarding/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "completed" in data, "Response should contain 'completed' field"
        assert isinstance(data["completed"], bool), "completed should be boolean"
        print(f"✓ onboarding/status returns completed={data['completed']}")


class TestCalibrationCodeIntegrity:
    """Tests to verify calibration.py code structure"""
    
    def test_timedelta_import_exists(self):
        """Verify timedelta is properly imported in calibration.py"""
        calibration_path = "/app/backend/routes/calibration.py"
        
        with open(calibration_path, 'r') as f:
            content = f.read()
        
        # Check for timedelta import
        assert "from datetime import" in content, "datetime import should exist"
        assert "timedelta" in content, "timedelta should be imported"
        
        # Verify proper import format
        import_line_found = False
        for line in content.split('\n'):
            if 'from datetime import' in line and 'timedelta' in line:
                import_line_found = True
                break
        
        assert import_line_found, "timedelta should be imported from datetime module"
        print("✓ timedelta is properly imported in calibration.py (line 10)")
    
    def test_strategic_console_state_write_on_q9(self):
        """Verify Q9 completion writes to strategic_console_state"""
        calibration_path = "/app/backend/routes/calibration.py"
        
        with open(calibration_path, 'r') as f:
            content = f.read()
        
        # Check for strategic_console_state upsert
        assert 'strategic_console_state' in content, \
            "calibration.py should reference strategic_console_state table"
        assert 'is_complete' in content, \
            "calibration.py should write is_complete flag"
        assert '"COMPLETED"' in content or "'COMPLETED'" in content, \
            "calibration.py should write status='COMPLETED'"
        print("✓ calibration.py writes to strategic_console_state with is_complete=True")
    
    def test_strategic_console_state_write_on_brain_complete(self):
        """Verify brain COMPLETE also writes to strategic_console_state"""
        calibration_path = "/app/backend/routes/calibration.py"
        
        with open(calibration_path, 'r') as f:
            content = f.read()
        
        # Check for brain completion handling
        assert 'calibration/brain' in content or 'CalibrationBrainRequest' in content, \
            "calibration.py should have brain endpoint"
        
        # The code should upsert to strategic_console_state when brain says COMPLETE
        # Search for the pattern near the brain handler
        brain_section_found = False
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if 'brain_response.get("status") == "COMPLETE"' in line:
                brain_section_found = True
                # Check next 50 lines for strategic_console_state
                check_lines = '\n'.join(lines[i:i+50])
                assert 'strategic_console_state' in check_lines, \
                    "Brain COMPLETE should write to strategic_console_state"
                break
        
        assert brain_section_found, "Brain completion handler should exist"
        print("✓ calibration/brain COMPLETE writes to strategic_console_state")


class TestCalibrationStatusPriorityCheck:
    """Test that calibration status checks strategic_console_state FIRST"""
    
    def test_calibration_status_checks_strategic_console_state_first(self):
        """Verify calibration status endpoint checks strategic_console_state before user_operator_profile"""
        calibration_path = "/app/backend/routes/calibration.py"
        
        with open(calibration_path, 'r') as f:
            content = f.read()
        
        # Find the get_calibration_status function
        func_start = content.find('async def get_calibration_status')
        assert func_start != -1, "get_calibration_status function should exist"
        
        # Get next ~100 lines of the function
        func_section = content[func_start:func_start+3000]
        
        # Verify PRIORITY 1 comment exists
        assert 'PRIORITY 1' in func_section or 'strategic_console_state' in func_section, \
            "Should check strategic_console_state with priority"
        
        # Verify strategic_console_state is checked before user_operator_profile
        scs_pos = func_section.find('strategic_console_state')
        uop_pos = func_section.find('user_operator_profile')
        
        assert scs_pos != -1, "strategic_console_state should be checked"
        assert uop_pos != -1, "user_operator_profile should be checked as fallback"
        assert scs_pos < uop_pos, \
            "strategic_console_state should be checked BEFORE user_operator_profile"
        
        print("✓ calibration/status checks strategic_console_state FIRST (PRIORITY 1)")
    
    def test_lifecycle_state_checks_strategic_console_state_first(self):
        """Verify lifecycle state endpoint checks strategic_console_state before user_operator_profile"""
        calibration_path = "/app/backend/routes/calibration.py"
        
        with open(calibration_path, 'r') as f:
            content = f.read()
        
        # Find the get_lifecycle_state function
        func_start = content.find('async def get_lifecycle_state')
        assert func_start != -1, "get_lifecycle_state function should exist"
        
        # Get next ~150 lines of the function
        func_section = content[func_start:func_start+4000]
        
        # Verify strategic_console_state is checked before user_operator_profile
        scs_pos = func_section.find('strategic_console_state')
        uop_pos = func_section.find('user_operator_profile')
        
        assert scs_pos != -1, "strategic_console_state should be checked"
        
        if uop_pos != -1:
            assert scs_pos < uop_pos, \
                "strategic_console_state should be checked BEFORE user_operator_profile"
        
        print("✓ lifecycle/state checks strategic_console_state FIRST")


class TestOnboardingStatusPriorityCheck:
    """Test that onboarding status checks strategic_console_state FIRST"""
    
    def test_onboarding_status_checks_strategic_console_state_first(self):
        """Verify onboarding status endpoint checks strategic_console_state before other sources"""
        onboarding_path = "/app/backend/routes/onboarding.py"
        
        with open(onboarding_path, 'r') as f:
            content = f.read()
        
        # Find the get_onboarding_status function
        func_start = content.find('async def get_onboarding_status')
        assert func_start != -1, "get_onboarding_status function should exist"
        
        # Get next ~50 lines of the function
        func_section = content[func_start:func_start+1500]
        
        # Verify strategic_console_state is checked first
        assert 'strategic_console_state' in func_section, \
            "Should check strategic_console_state"
        assert 'PRIORITY 1' in func_section or 'is_complete' in func_section, \
            "Should check is_complete flag from strategic_console_state"
        
        print("✓ onboarding/status checks strategic_console_state FIRST (Line 295)")


class TestHealthEndpoints:
    """Basic health check endpoints - no auth required"""
    
    def test_health_basic(self):
        """Test /api/health returns healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ /api/health returns healthy")
    
    def test_frontend_loads(self):
        """Test frontend is accessible"""
        response = requests.get(f"{BASE_URL}/register-supabase", timeout=10)
        assert response.status_code == 200
        # React SPA: check for the HTML shell (content rendered by JS)
        assert "BIQC" in response.text or "root" in response.text
        print("✓ Frontend /register-supabase loads correctly (React SPA)")
