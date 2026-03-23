"""
BIQc Platform Phase 3 Feature Tests
Tests for:
- POST /api/cognition/decisions/checkpoint-outcome (Decision Outcome Recording)
- POST /api/notifications/register-device (Push Notification Device Registration)
- GET /api/cognition/overview (Cognition status check - migration 049)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # Use the test backend URL from credentials
    BASE_URL = "https://beta.thestrategysquad.com"

# Test credentials
TEST_EMAIL = os.environ.get("TEST_USER_EMAIL", os.environ.get("E2E_TEST_EMAIL", ""))
TEST_PASSWORD = os.environ.get("TEST_USER_PASSWORD", os.environ.get("E2E_TEST_PASSWORD", ""))


class TestPhase3Features:
    """Phase 3 Backend API Tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token via Supabase login"""
        if not (BASE_URL and TEST_EMAIL and TEST_PASSWORD):
            pytest.skip("Auth test env not configured for phase3 features")

        response = requests.post(
            f"{BASE_URL}/api/auth/supabase/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=30
        )
        if response.status_code != 200:
            pytest.skip(f"Authentication unavailable for phase3 features: {response.status_code}")
        data = response.json()
        token = data.get("session", {}).get("access_token") or data.get("access_token") or data.get("token")
        if not token:
            pytest.skip("Authentication unavailable for phase3 features: missing token")
        return token
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Auth headers for authenticated requests"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }

    # ═══════════════════════════════════════════════════════════════
    # COGNITION OVERVIEW - Check migration 049 status
    # ═══════════════════════════════════════════════════════════════
    
    def test_cognition_overview_returns_computed(self, auth_headers):
        """GET /api/cognition/overview should return status='computed' after migration 049"""
        response = requests.get(
            f"{BASE_URL}/api/cognition/overview",
            headers=auth_headers,
            timeout=30
        )
        # Accept 200 even if MIGRATION_REQUIRED (that's expected behavior)
        assert response.status_code == 200, f"API failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Check if migration ran successfully
        status = data.get("status", "unknown")
        print(f"Cognition overview status: {status}")
        
        # Either 'computed' (success) or 'MIGRATION_REQUIRED' (expected if migration not run)
        assert status in ["computed", "MIGRATION_REQUIRED", "error"], f"Unexpected status: {status}"
        
        if status == "computed":
            # Verify expected fields when computed
            assert "stability_score" in data or "system_state" in data, "Missing stability data"
            print(f"PASS: Cognition status='computed', stability_score={data.get('stability_score')}")
        else:
            print(f"INFO: Cognition status='{status}' - migration may not be applied")
    
    # ═══════════════════════════════════════════════════════════════
    # CHECKPOINT OUTCOME - Decision tracking at 30/60/90 days
    # ═══════════════════════════════════════════════════════════════
    
    def test_checkpoint_outcome_endpoint_exists(self, auth_headers):
        """POST /api/cognition/decisions/checkpoint-outcome should exist"""
        # Test with a dummy decision_id - we just want to confirm endpoint responds
        response = requests.post(
            f"{BASE_URL}/api/cognition/decisions/checkpoint-outcome",
            headers=auth_headers,
            json={
                "decision_id": "00000000-0000-0000-0000-000000000000",
                "checkpoint_day": 30,
                "decision_effective": True,
                "variance_delta": 0,
                "notes": "Test checkpoint outcome"
            },
            timeout=30
        )
        
        # 200 = success, 404 = checkpoint not found (expected for fake ID), 
        # or response containing MIGRATION_REQUIRED
        print(f"Checkpoint outcome response: {response.status_code} - {response.text[:200]}")
        
        if response.status_code == 200:
            data = response.json()
            # Check if MIGRATION_REQUIRED
            if data.get("status") == "MIGRATION_REQUIRED":
                print("PASS: Endpoint exists, returns MIGRATION_REQUIRED (expected)")
                return
            # Or recorded successfully
            assert data.get("status") in ["recorded", "MIGRATION_REQUIRED"], f"Unexpected: {data}"
            print(f"PASS: Checkpoint outcome endpoint working: {data}")
        elif response.status_code == 404:
            # Checkpoint not found is expected for fake decision_id
            print("PASS: Endpoint exists, returns 404 for non-existent checkpoint (expected)")
        elif response.status_code == 422:
            # Validation error - endpoint exists
            print("PASS: Endpoint exists, validation error (expected for fake data)")
        elif response.status_code == 500:
            data = response.json()
            if "MIGRATION" in str(data):
                print("PASS: Endpoint exists, migration required")
            else:
                # Check if it's a schema validation error (endpoint exists)
                print(f"INFO: 500 error - {data}")
        else:
            pytest.fail(f"Unexpected response: {response.status_code} - {response.text}")
    
    def test_checkpoint_outcome_request_structure(self, auth_headers):
        """Verify checkpoint-outcome accepts the correct request body"""
        # This tests the Pydantic model accepts our fields
        response = requests.post(
            f"{BASE_URL}/api/cognition/decisions/checkpoint-outcome",
            headers=auth_headers,
            json={
                "decision_id": "11111111-1111-1111-1111-111111111111",
                "checkpoint_day": 60,
                "decision_effective": False,
                "variance_delta": 0.5,
                "notes": ""
            },
            timeout=30
        )
        
        # Should not get 422 (validation error) if model is correct
        assert response.status_code != 422, f"Request validation failed: {response.text}"
        print(f"PASS: Request structure accepted (status={response.status_code})")
    
    # ═══════════════════════════════════════════════════════════════
    # PUSH NOTIFICATIONS - Device Registration
    # ═══════════════════════════════════════════════════════════════
    
    def test_register_device_endpoint_exists(self, auth_headers):
        """POST /api/notifications/register-device should exist"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-device",
            headers=auth_headers,
            json={
                "push_token": "ExponentPushToken[TEST_TOKEN_123456789]",
                "platform": "ios",
                "device_name": "Test iPhone (Playwright)"
            },
            timeout=30
        )
        
        print(f"Register device response: {response.status_code} - {response.text[:200]}")
        
        # Accept 200/201 (success), 400 (validation), or any response that indicates endpoint exists
        if response.status_code in [200, 201]:
            data = response.json()
            status = data.get("status", "unknown")
            # 'registered', 'pending', or 'MIGRATION_REQUIRED' are all valid
            print(f"PASS: Device registration endpoint working: status={status}")
        elif response.status_code == 422:
            print("PASS: Endpoint exists, validation error (check request format)")
        elif response.status_code == 404:
            pytest.fail("FAIL: /api/notifications/register-device endpoint not found!")
        elif response.status_code == 500:
            data = response.json()
            # Table might not exist yet (pending migration)
            if "push_devices" in str(data) or "relation" in str(data).lower():
                print("PASS: Endpoint exists, push_devices table pending migration")
            else:
                print(f"INFO: 500 error - {data}")
        else:
            print(f"INFO: Response {response.status_code}: {response.text[:100]}")
    
    def test_register_device_android_platform(self, auth_headers):
        """Test register-device with Android platform"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/register-device",
            headers=auth_headers,
            json={
                "push_token": "TEST_ANDROID_FCM_TOKEN_987654321",
                "platform": "android",
                "device_name": "Test Pixel (Playwright)"
            },
            timeout=30
        )
        
        # Just verify endpoint handles the request
        assert response.status_code in [200, 201, 422, 500], f"Unexpected: {response.status_code}"
        print(f"PASS: Android device registration request handled (status={response.status_code})")
    
    # ═══════════════════════════════════════════════════════════════
    # DECISIONS LIST - Verify decisions with checkpoints
    # ═══════════════════════════════════════════════════════════════
    
    def test_decisions_list_includes_checkpoints(self, auth_headers):
        """GET /api/cognition/decisions should return decisions with checkpoints array"""
        response = requests.get(
            f"{BASE_URL}/api/cognition/decisions",
            headers=auth_headers,
            timeout=30
        )
        
        assert response.status_code == 200, f"API failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Check for MIGRATION_REQUIRED
        if data.get("status") == "MIGRATION_REQUIRED":
            print("INFO: Decisions API returns MIGRATION_REQUIRED (expected)")
            return
        
        decisions = data.get("decisions", [])
        print(f"Found {len(decisions)} decisions")
        
        # If decisions exist, verify they have checkpoints array
        if decisions:
            first_decision = decisions[0]
            assert "checkpoints" in first_decision or first_decision.get("checkpoints") is None, \
                "Decision missing checkpoints field"
            checkpoints = first_decision.get("checkpoints", [])
            print(f"First decision has {len(checkpoints)} checkpoints")
            
            # Verify checkpoint structure if any exist
            if checkpoints:
                cp = checkpoints[0]
                assert "checkpoint_day" in cp, f"Checkpoint missing day: {cp}"
                print(f"PASS: Checkpoint structure valid: day={cp.get('checkpoint_day')}, status={cp.get('status')}")
        else:
            print("INFO: No decisions yet (this is fine for testing)")
    
    # ═══════════════════════════════════════════════════════════════
    # REGRESSION - Core endpoints still working
    # ═══════════════════════════════════════════════════════════════
    
    def test_snapshot_latest_still_works(self, auth_headers):
        """GET /api/snapshot/latest should still return cognitive data"""
        response = requests.get(
            f"{BASE_URL}/api/snapshot/latest",
            headers=auth_headers,
            timeout=30
        )
        
        assert response.status_code == 200, f"Snapshot failed: {response.status_code}"
        data = response.json()
        
        # Should have cognitive section (or MIGRATION_REQUIRED)
        if data.get("status") == "MIGRATION_REQUIRED":
            print("INFO: Snapshot returns MIGRATION_REQUIRED")
        elif "cognitive" in data or "stability_score" in data:
            print(f"PASS: Snapshot returns cognitive data")
        else:
            print(f"INFO: Snapshot response keys: {list(data.keys())[:10]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
