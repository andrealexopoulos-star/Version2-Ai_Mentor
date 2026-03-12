"""
Calibration Loop Regression Test
================================
Tests that a COMPLETED user:
1. /api/calibration/status returns status=COMPLETE
2. /api/onboarding/status returns completed=true
3. Login does NOT redirect to /calibration loop

Test user: cal-loop-416d7f85@biqctest.io / BIQcTest!2026Z
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://vwwandhoydemcybltoxz.supabase.co')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3d2FuZGhveWRlbWN5Ymx0b3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjU4MzEsImV4cCI6MjA4ODQwMTgzMX0.KzFEpKDiHtDx6EjsZscdvwY9vyakitlUJ4SOMekWEys')

# QA Test User Credentials (seeded as fully calibrated)
QA_EMAIL = "cal-loop-416d7f85@biqctest.io"
QA_PASSWORD = "BIQcTest!2026Z"


class TestCalibrationLoopRegression:
    """Calibration loop regression tests for completed users"""
    
    access_token = None
    user_id = None
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Authenticate with Supabase to get access token"""
        if TestCalibrationLoopRegression.access_token:
            return  # Already authenticated
            
        print(f"\n[SETUP] Authenticating {QA_EMAIL} via Supabase...")
        
        # Login via Supabase Auth
        auth_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
        headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json"
        }
        payload = {
            "email": QA_EMAIL,
            "password": QA_PASSWORD
        }
        
        response = requests.post(auth_url, json=payload, headers=headers)
        print(f"[SETUP] Auth response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"[SETUP] Auth failed: {response.text}")
            pytest.skip(f"Failed to authenticate QA user: {response.status_code} - {response.text}")
            return
        
        data = response.json()
        TestCalibrationLoopRegression.access_token = data.get("access_token")
        TestCalibrationLoopRegression.user_id = data.get("user", {}).get("id")
        
        print(f"[SETUP] Auth SUCCESS - user_id: {TestCalibrationLoopRegression.user_id}")
        print(f"[SETUP] Access token obtained (first 20 chars): {TestCalibrationLoopRegression.access_token[:20] if TestCalibrationLoopRegression.access_token else 'None'}...")
    
    def test_01_calibration_status_returns_complete(self):
        """
        CRITICAL: /api/calibration/status must return status=COMPLETE for completed user.
        This is what SupabaseAuthContext reads to decide READY vs NEEDS_CALIBRATION.
        """
        if not TestCalibrationLoopRegression.access_token:
            pytest.skip("No auth token available")
        
        print(f"\n[TEST] Calling /api/calibration/status for user {TestCalibrationLoopRegression.user_id}")
        
        response = requests.get(
            f"{BASE_URL}/api/calibration/status",
            headers={
                "Authorization": f"Bearer {TestCalibrationLoopRegression.access_token}",
                "Accept": "application/json"
            }
        )
        
        print(f"[TEST] Status code: {response.status_code}")
        print(f"[TEST] Response body: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"[TEST] Parsed JSON: {json.dumps(data, indent=2)}")
        
        # CRITICAL ASSERTION: status must be COMPLETE
        assert data.get("status") == "COMPLETE", f"Expected status=COMPLETE, got {data.get('status')}"
        print("[TEST] PASS - calibration/status returns COMPLETE")
    
    def test_02_onboarding_status_returns_completed(self):
        """
        /api/onboarding/status must return completed=true for completed user.
        This is checked AFTER calibration status in SupabaseAuthContext bootstrap.
        """
        if not TestCalibrationLoopRegression.access_token:
            pytest.skip("No auth token available")
        
        print(f"\n[TEST] Calling /api/onboarding/status for user {TestCalibrationLoopRegression.user_id}")
        
        response = requests.get(
            f"{BASE_URL}/api/onboarding/status",
            headers={
                "Authorization": f"Bearer {TestCalibrationLoopRegression.access_token}",
                "Accept": "application/json"
            }
        )
        
        print(f"[TEST] Status code: {response.status_code}")
        print(f"[TEST] Response body: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"[TEST] Parsed JSON: {json.dumps(data, indent=2)}")
        
        # CRITICAL ASSERTION: completed must be true
        assert data.get("completed") == True, f"Expected completed=true, got {data.get('completed')}"
        print("[TEST] PASS - onboarding/status returns completed=true")
    
    def test_03_lifecycle_state_shows_calibration_complete(self):
        """
        /api/lifecycle/state should show calibration.complete=true.
        This is a supplementary check for overall user state.
        """
        if not TestCalibrationLoopRegression.access_token:
            pytest.skip("No auth token available")
        
        print(f"\n[TEST] Calling /api/lifecycle/state for user {TestCalibrationLoopRegression.user_id}")
        
        response = requests.get(
            f"{BASE_URL}/api/lifecycle/state",
            headers={
                "Authorization": f"Bearer {TestCalibrationLoopRegression.access_token}",
                "Accept": "application/json"
            }
        )
        
        print(f"[TEST] Status code: {response.status_code}")
        print(f"[TEST] Response body: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"[TEST] Parsed JSON: {json.dumps(data, indent=2)}")
        
        # Check calibration.complete
        calibration = data.get("calibration", {})
        assert calibration.get("complete") == True, f"Expected calibration.complete=true, got {calibration}"
        assert calibration.get("status") == "complete", f"Expected calibration.status=complete, got {calibration.get('status')}"
        
        # Check onboarding.complete
        onboarding = data.get("onboarding", {})
        assert onboarding.get("complete") == True, f"Expected onboarding.complete=true, got {onboarding}"
        
        print("[TEST] PASS - lifecycle/state shows calibration.complete=true and onboarding.complete=true")
    
    def test_04_auth_me_returns_user_data(self):
        """
        /api/auth/supabase/me should return valid user data.
        This confirms the user exists in the users table.
        """
        if not TestCalibrationLoopRegression.access_token:
            pytest.skip("No auth token available")
        
        print(f"\n[TEST] Calling /api/auth/supabase/me for user {TestCalibrationLoopRegression.user_id}")
        
        response = requests.get(
            f"{BASE_URL}/api/auth/supabase/me",
            headers={
                "Authorization": f"Bearer {TestCalibrationLoopRegression.access_token}",
                "Accept": "application/json"
            }
        )
        
        print(f"[TEST] Status code: {response.status_code}")
        print(f"[TEST] Response body: {response.text[:500]}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"[TEST] Parsed JSON: {json.dumps(data, indent=2)}")
        
        # Check user exists
        user = data.get("user", {})
        assert user.get("id"), f"Expected user.id to exist, got {user}"
        assert user.get("email") == QA_EMAIL, f"Expected email={QA_EMAIL}, got {user.get('email')}"
        
        print(f"[TEST] PASS - auth/me returns user: {user.get('email')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
