"""
Iteration 150 — Forensic Truth Gate regression checks.

Validates that Business Brain no longer emits false zero-value claims when source truth is
stale or unverified, and that truth metadata is exposed for the UI.
"""

import os
import requests
import pytest


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://biqc.ai").rstrip("/")
SUPABASE_URL = "https://vwwandhoydemcybltoxz.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3d2FuZGhveWRlbWN5Ymx0b3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjU4MzEsImV4cCI6MjA4ODQwMTgzMX0.KzFEpKDiHtDx6EjsZscdvwY9vyakitlUJ4SOMekWEys"
TEST_EMAIL = "andre@thestrategysquad.com.au"
TEST_PASSWORD = "MasterMind2025*"


def _auth_headers():
    email = os.environ.get("FORENSIC_TEST_EMAIL", TEST_EMAIL)
    password = os.environ.get("FORENSIC_TEST_PASSWORD", TEST_PASSWORD)
    try:
        response = requests.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
            json={"email": email, "password": password},
            timeout=30,
        )
    except requests.RequestException as exc:
        pytest.skip(f"Skipping forensic truth-gate tests: auth endpoint unavailable ({exc})")

    # CI should not fail when shared test credentials are rotated/disabled.
    if response.status_code in {400, 401, 403, 404, 422}:
        pytest.skip(
            f"Skipping forensic truth-gate tests: auth credentials unavailable (HTTP {response.status_code})"
        )

    response.raise_for_status()
    token = (response.json() or {}).get("access_token")
    if not token:
        pytest.skip("Skipping forensic truth-gate tests: no access_token returned")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_brain_priorities_expose_truth_gate_metadata():
    response = requests.get(f"{BASE_URL}/api/brain/priorities", headers=_auth_headers(), timeout=60)
    assert response.status_code == 200, response.text[:500]
    data = response.json()

    assert "integrity_alerts" in data, "Business Brain must expose integrity alerts"
    assert "truth_summary" in data, "Business Brain must expose truth summary"


def test_brain_priorities_do_not_emit_false_zero_cycle_or_margin_claims_when_unverified():
    response = requests.get(f"{BASE_URL}/api/brain/priorities", headers=_auth_headers(), timeout=60)
    assert response.status_code == 200, response.text[:500]
    data = response.json()

    forbidden_phrases = {
        "average cycle of 0 days",
        "operating expense pressure is running at 0% while revenue growth is $0",
        "lead response time has stretched to 0.0 hours",
    }

    for concern in data.get("concerns", []):
        issue_brief = str(concern.get("issue_brief") or "").lower()
        assert all(phrase not in issue_brief for phrase in forbidden_phrases), issue_brief


def test_merge_connected_exposes_connector_truth_states():
    response = requests.get(f"{BASE_URL}/api/integrations/merge/connected", headers=_auth_headers(), timeout=60)
    assert response.status_code == 200, response.text[:500]
    data = response.json()
    canonical_truth = data.get("canonical_truth") or {}

    assert "crm_state" in canonical_truth, canonical_truth
    assert "accounting_state" in canonical_truth, canonical_truth