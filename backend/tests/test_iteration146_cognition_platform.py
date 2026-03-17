"""
Iteration 146: Cognition Platform Hardening Tests
Tests:
- GET /api/unified/revenue: confidence_score, data_sources_count, data_freshness, lineage
- GET /api/brain/priorities: concern-level recommended_action_id + confidence/data fields
- GET /api/brain/initial-calibration: RPC or fallback path
- GET /api/services/cognition-platform-audit: matrix sections
- POST /api/soundboard/chat: fallback behavior when provider keys missing
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "MasterMind2025*"


@pytest.fixture(scope="module")
def auth_token():
    """Authenticate and return JWT token."""
    login_url = f"{BASE_URL}/api/auth/supabase/login"
    response = requests.post(login_url, json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    if response.status_code == 200:
        data = response.json()
        session = data.get("session", {})
        token = session.get("access_token")
        if token:
            return token
    pytest.skip(f"Auth failed: {response.status_code} - {response.text[:200]}")


@pytest.fixture
def auth_headers(auth_token):
    """Return headers with auth token."""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestUnifiedRevenueEndpoint:
    """Tests for GET /api/unified/revenue endpoint with data contract fields."""

    def test_unified_revenue_returns_200(self, auth_headers):
        """Verify endpoint returns 200 OK."""
        response = requests.get(f"{BASE_URL}/api/unified/revenue", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:300]}"

    def test_unified_revenue_has_confidence_score(self, auth_headers):
        """Verify response contains confidence_score field."""
        response = requests.get(f"{BASE_URL}/api/unified/revenue", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "confidence_score" in data, f"Missing confidence_score. Keys: {list(data.keys())}"
        assert isinstance(data["confidence_score"], (int, float)), "confidence_score should be numeric"
        assert 0 <= data["confidence_score"] <= 1, f"confidence_score should be 0-1, got {data['confidence_score']}"

    def test_unified_revenue_has_data_sources_count(self, auth_headers):
        """Verify response contains data_sources_count field."""
        response = requests.get(f"{BASE_URL}/api/unified/revenue", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "data_sources_count" in data, f"Missing data_sources_count. Keys: {list(data.keys())}"
        assert isinstance(data["data_sources_count"], int), "data_sources_count should be an integer"

    def test_unified_revenue_has_data_freshness(self, auth_headers):
        """Verify response contains data_freshness field."""
        response = requests.get(f"{BASE_URL}/api/unified/revenue", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "data_freshness" in data, f"Missing data_freshness. Keys: {list(data.keys())}"
        assert isinstance(data["data_freshness"], str), "data_freshness should be a string"

    def test_unified_revenue_has_lineage(self, auth_headers):
        """Verify response contains lineage object with engine/page/connected_sources."""
        response = requests.get(f"{BASE_URL}/api/unified/revenue", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "lineage" in data, f"Missing lineage. Keys: {list(data.keys())}"
        assert isinstance(data["lineage"], dict), "lineage should be an object"
        lineage = data["lineage"]
        assert "engine" in lineage, f"Lineage missing 'engine'. Keys: {list(lineage.keys())}"


class TestBrainPrioritiesEndpoint:
    """Tests for GET /api/brain/priorities endpoint with concern contract fields."""

    def test_brain_priorities_returns_200(self, auth_headers):
        """Verify endpoint returns 200 OK."""
        response = requests.get(f"{BASE_URL}/api/brain/priorities", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:300]}"

    def test_brain_priorities_top_level_confidence_contract(self, auth_headers):
        """Verify top-level response has confidence_score, data_sources_count, data_freshness, lineage."""
        response = requests.get(f"{BASE_URL}/api/brain/priorities", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Top-level contract fields
        assert "confidence_score" in data, f"Missing top-level confidence_score. Keys: {list(data.keys())}"
        assert "data_sources_count" in data, f"Missing top-level data_sources_count. Keys: {list(data.keys())}"
        assert "data_freshness" in data, f"Missing top-level data_freshness. Keys: {list(data.keys())}"
        assert "lineage" in data, f"Missing top-level lineage. Keys: {list(data.keys())}"

    def test_brain_priorities_concerns_have_recommended_action_id(self, auth_headers):
        """Verify each concern has recommended_action_id field."""
        response = requests.get(f"{BASE_URL}/api/brain/priorities", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        concerns = data.get("concerns", [])
        # Test only if there are concerns
        if concerns:
            for i, concern in enumerate(concerns[:3]):
                assert "recommended_action_id" in concern, f"Concern {i} missing recommended_action_id. Keys: {list(concern.keys())}"
                assert isinstance(concern["recommended_action_id"], str), f"Concern {i} recommended_action_id should be string"

    def test_brain_priorities_concerns_have_confidence_data_fields(self, auth_headers):
        """Verify each concern has confidence_score, data_sources_count, data_freshness."""
        response = requests.get(f"{BASE_URL}/api/brain/priorities", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        concerns = data.get("concerns", [])
        if concerns:
            for i, concern in enumerate(concerns[:3]):
                assert "confidence_score" in concern or "confidence" in concern, f"Concern {i} missing confidence field"
                assert "data_sources_count" in concern, f"Concern {i} missing data_sources_count. Keys: {list(concern.keys())}"
                assert "data_freshness" in concern, f"Concern {i} missing data_freshness. Keys: {list(concern.keys())}"


class TestBrainInitialCalibrationEndpoint:
    """Tests for GET /api/brain/initial-calibration endpoint."""

    def test_brain_initial_calibration_returns_200(self, auth_headers):
        """Verify endpoint returns 200 OK."""
        response = requests.get(f"{BASE_URL}/api/brain/initial-calibration", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:300]}"

    def test_brain_initial_calibration_has_status(self, auth_headers):
        """Verify response contains status field (ok or fallback)."""
        response = requests.get(f"{BASE_URL}/api/brain/initial-calibration", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "status" in data, f"Missing status field. Keys: {list(data.keys())}"
        assert data["status"] in ("ok", "fallback"), f"Status should be 'ok' or 'fallback', got {data['status']}"

    def test_brain_initial_calibration_has_tenant_id(self, auth_headers):
        """Verify response contains tenant_id."""
        response = requests.get(f"{BASE_URL}/api/brain/initial-calibration", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "tenant_id" in data, f"Missing tenant_id. Keys: {list(data.keys())}"

    def test_brain_initial_calibration_has_top_concerns(self, auth_headers):
        """Verify response contains top_5_concerns list."""
        response = requests.get(f"{BASE_URL}/api/brain/initial-calibration", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "top_5_concerns" in data, f"Missing top_5_concerns. Keys: {list(data.keys())}"
        assert isinstance(data["top_5_concerns"], list), "top_5_concerns should be a list"

    def test_brain_initial_calibration_has_confidence_and_coverage(self, auth_headers):
        """Verify response has confidence_score and data_coverage."""
        response = requests.get(f"{BASE_URL}/api/brain/initial-calibration", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "confidence_score" in data, f"Missing confidence_score. Keys: {list(data.keys())}"
        assert "data_coverage" in data or "data_sources_count" in data, f"Missing data_coverage. Keys: {list(data.keys())}"


class TestCognitionPlatformAuditEndpoint:
    """Tests for GET /api/services/cognition-platform-audit endpoint."""

    def test_cognition_platform_audit_returns_200(self, auth_headers):
        """Verify endpoint returns 200 OK."""
        response = requests.get(f"{BASE_URL}/api/services/cognition-platform-audit", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:300]}"

    def test_cognition_platform_audit_has_summary(self, auth_headers):
        """Verify response contains summary with working/partial/missing counts."""
        response = requests.get(f"{BASE_URL}/api/services/cognition-platform-audit", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data, f"Missing summary. Keys: {list(data.keys())}"
        summary = data["summary"]
        assert isinstance(summary, dict), "summary should be an object"
        assert "working" in summary, f"Summary missing 'working'. Keys: {list(summary.keys())}"
        assert "partial" in summary, f"Summary missing 'partial'. Keys: {list(summary.keys())}"
        assert "missing" in summary, f"Summary missing 'missing'. Keys: {list(summary.keys())}"
        assert "readiness_score" in summary, f"Summary missing 'readiness_score'. Keys: {list(summary.keys())}"

    def test_cognition_platform_audit_has_sql_schema_and_tables(self, auth_headers):
        """Verify response contains sql_schema_and_tables matrix section."""
        response = requests.get(f"{BASE_URL}/api/services/cognition-platform-audit", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "sql_schema_and_tables" in data, f"Missing sql_schema_and_tables. Keys: {list(data.keys())}"
        assert isinstance(data["sql_schema_and_tables"], list), "sql_schema_and_tables should be a list"

    def test_cognition_platform_audit_has_sql_functions(self, auth_headers):
        """Verify response contains sql_functions matrix section."""
        response = requests.get(f"{BASE_URL}/api/services/cognition-platform-audit", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "sql_functions" in data, f"Missing sql_functions. Keys: {list(data.keys())}"
        assert isinstance(data["sql_functions"], list), "sql_functions should be a list"

    def test_cognition_platform_audit_has_edge_functions(self, auth_headers):
        """Verify response contains edge_functions matrix section."""
        response = requests.get(f"{BASE_URL}/api/services/cognition-platform-audit", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "edge_functions" in data, f"Missing edge_functions. Keys: {list(data.keys())}"
        assert isinstance(data["edge_functions"], list), "edge_functions should be a list"

    def test_cognition_platform_audit_has_webhooks(self, auth_headers):
        """Verify response contains webhooks matrix section."""
        response = requests.get(f"{BASE_URL}/api/services/cognition-platform-audit", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "webhooks" in data, f"Missing webhooks. Keys: {list(data.keys())}"
        assert isinstance(data["webhooks"], list), "webhooks should be a list"

    def test_cognition_platform_audit_has_serving_map(self, auth_headers):
        """Verify response contains serving_map matrix section."""
        response = requests.get(f"{BASE_URL}/api/services/cognition-platform-audit", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "serving_map" in data, f"Missing serving_map. Keys: {list(data.keys())}"
        assert isinstance(data["serving_map"], list), "serving_map should be a list"


class TestSoundboardChatFallback:
    """Tests for POST /api/soundboard/chat fallback behavior when provider keys missing."""

    def test_soundboard_chat_returns_200_or_fallback(self, auth_headers):
        """Verify soundboard chat does not hard-fail (500) even when provider keys missing.
        Should return 200 with a reply (possibly fallback) or guardrail block."""
        response = requests.post(
            f"{BASE_URL}/api/soundboard/chat",
            headers=auth_headers,
            json={"message": "What is my current pipeline status?"}
        )
        # Should NOT return 500 - expect 200 (success or fallback) or possibly 400/422 for guardrail
        assert response.status_code != 500, f"Soundboard chat hard-failed with 500: {response.text[:500]}"
        assert response.status_code in (200, 400, 422), f"Unexpected status {response.status_code}: {response.text[:300]}"

    def test_soundboard_chat_returns_reply_or_guardrail(self, auth_headers):
        """Verify response contains either 'reply' or 'guardrail' field."""
        response = requests.post(
            f"{BASE_URL}/api/soundboard/chat",
            headers=auth_headers,
            json={"message": "Summarize my business risks"}
        )
        if response.status_code == 200:
            data = response.json()
            has_reply = "reply" in data and data["reply"]
            has_guardrail = "guardrail" in data
            assert has_reply or has_guardrail, f"Response should have 'reply' or 'guardrail'. Keys: {list(data.keys())}"

    def test_soundboard_chat_response_has_contract_fields_when_successful(self, auth_headers):
        """When soundboard succeeds, verify response has confidence/data contract fields."""
        response = requests.post(
            f"{BASE_URL}/api/soundboard/chat",
            headers=auth_headers,
            json={"message": "What is my revenue trend?", "mode": "auto"}
        )
        if response.status_code == 200:
            data = response.json()
            if "reply" in data and data.get("guardrail") != "BLOCKED":
                # Check for contract fields
                assert "confidence_score" in data or data.get("guardrail"), f"Missing confidence_score. Keys: {list(data.keys())}"
                assert "data_sources_count" in data or data.get("guardrail"), f"Missing data_sources_count. Keys: {list(data.keys())}"
                assert "data_freshness" in data or data.get("guardrail"), f"Missing data_freshness. Keys: {list(data.keys())}"


class TestAdditionalEndpoints:
    """Additional endpoints for comprehensive coverage."""

    def test_unified_advisor_has_data_contract(self, auth_headers):
        """Verify /api/unified/advisor has confidence/data contract fields."""
        response = requests.get(f"{BASE_URL}/api/unified/advisor", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "confidence_score" in data, f"Missing confidence_score. Keys: {list(data.keys())}"
        assert "data_sources_count" in data, f"Missing data_sources_count"
        assert "lineage" in data, f"Missing lineage"

    def test_unified_risk_has_data_contract(self, auth_headers):
        """Verify /api/unified/risk has confidence/data contract fields."""
        response = requests.get(f"{BASE_URL}/api/unified/risk", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "confidence_score" in data, f"Missing confidence_score. Keys: {list(data.keys())}"
        assert "data_sources_count" in data, f"Missing data_sources_count"

    def test_unified_operations_has_data_contract(self, auth_headers):
        """Verify /api/unified/operations has confidence/data contract fields."""
        response = requests.get(f"{BASE_URL}/api/unified/operations", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "confidence_score" in data, f"Missing confidence_score. Keys: {list(data.keys())}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
