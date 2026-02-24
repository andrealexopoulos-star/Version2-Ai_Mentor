"""
Iteration 67 - P0 Bug Fix: Console State Calibration Flow
Tests the fix for old 9-step calibration appearing during new user signup.

Root Cause: /api/console/state was writing to wrong database fields
(operator_profile.console_state) while /calibration/status reads from 
strategic_console_state.is_complete and user_operator_profile.persona_calibration_status.

Fix: /api/console/state now writes to BOTH tables when status=COMPLETE.
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://uxyqpdfftxpkzeppqtvk.supabase.co')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eXFwZGZmdHhwa3plcHBxdHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzcwNDcsImV4cCI6MjA4NDAxMzA0N30.Xu9Wg5M638qJSgDpJKwFYlr9YZDiYPLv4Igh69KHJ0k')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eXFwZGZmdHhwa3plcHBxdHZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQzNzA0NywiZXhwIjoyMDg0MDEzMDQ3fQ.Of8sBhmza-QMmtlQ-EN7kpqcDuiy512TlY2Gku9YuX4')

# Test user credentials
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "BIQc_Test_2026!"


class TestCalibrationStatusEndpoints:
    """Test calibration and console state endpoints for P0 fix"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for existing test user"""
        # Login via Supabase
        login_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
        resp = requests.post(login_url, json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        }, headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json"
        })
        
        if resp.status_code == 200:
            data = resp.json()
            return data.get("access_token")
        
        pytest.skip(f"Authentication failed: {resp.status_code} - {resp.text[:100]}")
    
    def test_console_state_unauthenticated_returns_401(self):
        """POST /api/console/state returns 401 for unauthenticated requests"""
        resp = requests.post(f"{BASE_URL}/api/console/state", json={
            "current_step": 5,
            "status": "IN_PROGRESS"
        })
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.text}"
        print("PASS: /api/console/state returns 401 for unauthenticated requests")
    
    def test_calibration_status_returns_status_for_existing_user(self, auth_token):
        """GET /api/calibration/status returns valid status for authenticated user"""
        if not auth_token:
            pytest.skip("No auth token")
        
        resp = requests.get(f"{BASE_URL}/api/calibration/status", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "status" in data, f"Response missing 'status' field: {data}"
        assert data["status"] in ["COMPLETE", "IN_PROGRESS", "NEEDS_CALIBRATION"], f"Invalid status: {data['status']}"
        print(f"PASS: /api/calibration/status returns valid status: {data['status']}")
    
    def test_onboarding_status_returns_status_for_existing_user(self, auth_token):
        """GET /api/onboarding/status returns valid status for authenticated user"""
        if not auth_token:
            pytest.skip("No auth token")
        
        resp = requests.get(f"{BASE_URL}/api/onboarding/status", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "completed" in data, f"Response missing 'completed' field: {data}"
        print(f"PASS: /api/onboarding/status returns valid status: completed={data.get('completed')}")
    
    def test_console_state_in_progress_authenticated(self, auth_token):
        """POST /api/console/state with status=IN_PROGRESS works for authenticated users"""
        if not auth_token:
            pytest.skip("No auth token")
        
        resp = requests.post(f"{BASE_URL}/api/console/state", json={
            "current_step": 5,
            "status": "IN_PROGRESS"
        }, headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("ok") == True, f"Response not OK: {data}"
        print("PASS: /api/console/state IN_PROGRESS works for authenticated users")


class TestNewUserCalibrationFlow:
    """Test the new user calibration flow with fresh test users"""
    
    @pytest.fixture
    def temp_test_user(self):
        """Create a temporary test user for new user flow testing"""
        unique_id = uuid.uuid4().hex[:8]
        email = f"test-cal-{unique_id}@biqc-test.com"
        password = "TestPass123!"
        
        # Create user via Supabase admin API
        create_url = f"{SUPABASE_URL}/auth/v1/admin/users"
        resp = requests.post(create_url, json={
            "email": email,
            "password": password,
            "email_confirm": True
        }, headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json"
        })
        
        if resp.status_code not in (200, 201):
            pytest.skip(f"Failed to create test user: {resp.status_code} - {resp.text[:100]}")
        
        user_data = resp.json()
        user_id = user_data.get("id")
        
        # Login to get token
        login_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
        login_resp = requests.post(login_url, json={
            "email": email,
            "password": password
        }, headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json"
        })
        
        if login_resp.status_code != 200:
            # Cleanup user
            requests.delete(f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}", headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"
            })
            pytest.skip(f"Failed to login test user: {login_resp.status_code}")
        
        token = login_resp.json().get("access_token")
        
        yield {"user_id": user_id, "email": email, "token": token}
        
        # Cleanup: Delete test user
        try:
            requests.delete(f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}", headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"
            })
            print(f"Cleaned up test user: {email}")
        except Exception as e:
            print(f"Warning: Failed to cleanup test user: {e}")
    
    def test_new_user_calibration_status_needs_calibration(self, temp_test_user):
        """GET /api/calibration/status returns NEEDS_CALIBRATION for new users with no data"""
        token = temp_test_user["token"]
        
        resp = requests.get(f"{BASE_URL}/api/calibration/status", headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("status") == "NEEDS_CALIBRATION", f"Expected NEEDS_CALIBRATION, got: {data.get('status')}"
        print(f"PASS: New user gets NEEDS_CALIBRATION status")
    
    def test_console_state_complete_marks_both_tables(self, temp_test_user):
        """
        P0 FIX TEST: POST /api/console/state with status=COMPLETE properly marks 
        both strategic_console_state and user_operator_profile.
        """
        token = temp_test_user["token"]
        
        # Step 1: Call console/state with COMPLETE
        resp = requests.post(f"{BASE_URL}/api/console/state", json={
            "current_step": 17,
            "status": "COMPLETE"
        }, headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("ok") == True, f"Response not OK: {data}"
        print("PASS: /api/console/state COMPLETE accepted")
        
        # Give DB a moment to propagate
        time.sleep(0.5)
        
        # Step 2: Verify calibration/status now returns COMPLETE
        resp2 = requests.get(f"{BASE_URL}/api/calibration/status", headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp2.status_code == 200, f"calibration/status: Expected 200, got {resp2.status_code}"
        data2 = resp2.json()
        assert data2.get("status") == "COMPLETE", f"Expected COMPLETE after console/state COMPLETE, got: {data2.get('status')}"
        print(f"PASS: /api/calibration/status returns COMPLETE after console/state COMPLETE")
        
        # Step 3: Verify onboarding/status returns completed=true
        resp3 = requests.get(f"{BASE_URL}/api/onboarding/status", headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp3.status_code == 200, f"onboarding/status: Expected 200, got {resp3.status_code}"
        data3 = resp3.json()
        assert data3.get("completed") == True, f"Expected completed=true after console/state COMPLETE, got: {data3}"
        print(f"PASS: /api/onboarding/status returns completed=true after console/state COMPLETE")
    
    def test_console_state_in_progress_does_not_complete(self, temp_test_user):
        """POST /api/console/state with status=IN_PROGRESS does NOT mark calibration as complete"""
        token = temp_test_user["token"]
        
        # First, ensure user is not complete
        resp = requests.post(f"{BASE_URL}/api/console/state", json={
            "current_step": 5,
            "status": "IN_PROGRESS"
        }, headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        # Verify calibration/status does NOT return COMPLETE
        resp2 = requests.get(f"{BASE_URL}/api/calibration/status", headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp2.status_code == 200
        data = resp2.json()
        # IN_PROGRESS should show as IN_PROGRESS or NEEDS_CALIBRATION, NOT COMPLETE
        assert data.get("status") != "COMPLETE", f"Status should not be COMPLETE after IN_PROGRESS, got: {data.get('status')}"
        print(f"PASS: IN_PROGRESS does not prematurely mark calibration as COMPLETE (status={data.get('status')})")


class TestHealthAndBasicEndpoints:
    """Basic health check tests"""
    
    def test_health_endpoint(self):
        """GET /api/health returns 200"""
        resp = requests.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200, f"Health check failed: {resp.status_code}"
        print("PASS: /api/health returns 200")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
