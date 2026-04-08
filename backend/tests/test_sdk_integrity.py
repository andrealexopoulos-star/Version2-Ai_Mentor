"""
SDK Integrity & Calibration Status Tests

Tests:
1. Supabase client has `maybe_single` method (not camelCase `maybeSingle`)
2. `safe_query_single` wrapper raises RuntimeError on AttributeError
3. Calibration status endpoint returns COMPLETE for calibrated user
4. Calibration status endpoint returns NEEDS_CALIBRATION for unknown user
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    pytest.skip("python-dotenv not installed", allow_module_level=True)

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))


class TestSDKIntegrity:
    """Verify the Supabase Python SDK has the expected API surface."""

    def test_maybe_single_exists(self):
        """maybe_single (snake_case) must exist on query builders."""
        from supabase_client import init_supabase
        client = init_supabase()
        assert client is not None, "Supabase client failed to initialize"
        
        builder = client.table("users").select("id").limit(0)
        assert hasattr(builder, 'maybe_single'), (
            "SDK missing 'maybe_single'. Got methods: " + 
            str([m for m in dir(builder) if not m.startswith('_') and 'single' in m.lower()])
        )

    def test_maybeSingle_does_NOT_exist(self):
        """maybeSingle (camelCase) must NOT exist — prevents regression."""
        from supabase_client import init_supabase
        client = init_supabase()
        assert client is not None
        
        builder = client.table("users").select("id").limit(0)
        assert not hasattr(builder, 'maybeSingle'), (
            "SDK has camelCase 'maybeSingle' — this means the SDK was upgraded. "
            "Update all .maybe_single() calls to .maybeSingle() or pin the SDK version."
        )

    def test_safe_query_single_raises_on_attribute_error(self):
        """safe_query_single must raise RuntimeError, not return None silently."""
        from supabase_client import safe_query_single
        
        class FakeQuery:
            """Simulates a query builder WITHOUT maybe_single (SDK mismatch)."""
            pass
        
        with pytest.raises(RuntimeError, match="SDK method mismatch"):
            safe_query_single(FakeQuery())

    def test_safe_query_single_works_with_real_client(self):
        """safe_query_single must work with the real Supabase client."""
        from supabase_client import init_supabase, safe_query_single
        client = init_supabase()
        assert client is not None
        
        # Query for non-existent user — should not raise
        safe_query_single(
            client.table("users").select("id").eq("id", "00000000-0000-0000-0000-000000000000")
        )
        # maybe_single returns None when no row found — this is valid SDK behavior
        # The key assertion: no AttributeError or RuntimeError was raised


class TestCalibrationStatus:
    """Verify calibration status returns correctly from the database."""

    def test_calibrated_user_returns_complete(self):
        """User 361086fe... has persona_calibration_status='complete' in DB."""
        from supabase_client import init_supabase, safe_query_single
        client = init_supabase()
        assert client is not None
        
        uid = "361086fe-8a9b-43bf-ab3d-8793541a47fd"
        result = safe_query_single(
            client.table("user_operator_profile").select(
                "persona_calibration_status"
            ).eq("user_id", uid)
        )
        
        assert result.data is not None, f"No user_operator_profile row for {uid}"
        assert result.data.get("persona_calibration_status") == "complete", (
            f"Expected 'complete', got '{result.data.get('persona_calibration_status')}'"
        )

    def test_unknown_user_returns_none(self):
        """A non-existent user should return None/empty, not crash."""
        from supabase_client import init_supabase, safe_query_single
        client = init_supabase()
        assert client is not None
        
        result = safe_query_single(
            client.table("user_operator_profile").select(
                "persona_calibration_status"
            ).eq("user_id", "00000000-0000-0000-0000-000000000000")
        )
        
        # maybe_single returns None when no row found
        # Key assertion: no exception raised, and data is None or absent
        if result is not None:
            assert result.data is None, "Expected None data for non-existent user"

    def test_no_maybeSingle_in_server_py(self):
        """server.py must not contain camelCase maybeSingle anywhere."""
        server_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'server.py')
        with open(server_path, 'r') as f:
            content = f.read()
        
        occurrences = content.count('maybeSingle')
        assert occurrences == 0, (
            f"Found {occurrences} occurrence(s) of 'maybeSingle' in server.py. "
            f"Must use 'maybe_single' (snake_case) for supabase>=2.x"
        )

    def test_no_maybeSingle_in_fact_resolution(self):
        """fact_resolution.py must not contain camelCase maybeSingle."""
        fr_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'fact_resolution.py')
        with open(fr_path, 'r') as f:
            content = f.read()
        
        occurrences = content.count('maybeSingle')
        assert occurrences == 0, (
            f"Found {occurrences} occurrence(s) of 'maybeSingle' in fact_resolution.py"
        )
