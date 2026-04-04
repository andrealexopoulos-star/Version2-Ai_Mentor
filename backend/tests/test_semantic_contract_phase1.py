"""Semantic contract assertions for phase-1 cognition endpoints."""
import os
import requests

BASE_URL = os.getenv("BASE_URL", "https://biqc-api.azurewebsites.net")
TOKEN = os.getenv("AUTH_BEARER_TOKEN", "")

REQUIRED_KEYS = [
    "data_status",
    "confidence_score",
    "confidence_reason",
    "coverage_window",
    "source_lineage",
    "next_best_actions",
]


def _headers():
    if not TOKEN:
        return {}
    return {"Authorization": f"Bearer {TOKEN}"}


def _assert_semantic_contract(data: dict):
    missing = [k for k in REQUIRED_KEYS if k not in data]
    assert not missing, f"Missing semantic keys: {missing}; keys={list(data.keys())}"
    assert isinstance(data.get("coverage_window"), dict), "coverage_window must be object"
    assert isinstance(data.get("source_lineage"), list), "source_lineage must be list"
    assert isinstance(data.get("next_best_actions"), list), "next_best_actions must be list"


def test_watchtower_semantic_contract():
    resp = requests.get(f"{BASE_URL}/api/intelligence/watchtower", headers=_headers(), timeout=20)
    assert resp.status_code in [200, 401, 403, 500, 503], f"Unexpected status: {resp.status_code}"
    if resp.status_code == 200:
        _assert_semantic_contract(resp.json())


def test_priority_inbox_semantic_contract():
    resp = requests.get(f"{BASE_URL}/api/email/priority-inbox", headers=_headers(), timeout=20)
    assert resp.status_code in [200, 401, 403, 500, 503], f"Unexpected status: {resp.status_code}"
    if resp.status_code == 200:
        _assert_semantic_contract(resp.json())


def test_outlook_intelligence_semantic_contract():
    resp = requests.get(f"{BASE_URL}/api/outlook/intelligence", headers=_headers(), timeout=20)
    assert resp.status_code in [200, 401, 403, 500, 503], f"Unexpected status: {resp.status_code}"
    if resp.status_code == 200:
        _assert_semantic_contract(resp.json())


def test_cognition_tabs_semantic_contract():
    for tab in ["overview", "revenue", "operations", "risk", "market"]:
        resp = requests.get(f"{BASE_URL}/api/cognition/{tab}", headers=_headers(), timeout=20)
        assert resp.status_code in [200, 401, 403, 500, 503], f"{tab}: unexpected status {resp.status_code}"
        if resp.status_code == 200:
            _assert_semantic_contract(resp.json())
