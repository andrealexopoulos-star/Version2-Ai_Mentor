import ast
import asyncio
import os
from enum import Enum
from pathlib import Path
from typing import Any, Dict
import types


REPO_ROOT = Path(__file__).resolve().parents[2]
CALIBRATION_SOURCE = REPO_ROOT / "backend" / "routes" / "calibration.py"


def _load_edge_helpers():
    tree = ast.parse(CALIBRATION_SOURCE.read_text(encoding="utf-8"))
    wanted_funcs = {"_edge_result_failed", "_normalize_edge_result", "_call_edge_function"}
    # Incident H (2026-04-23): EdgeCallMode must be in scope when _call_edge_function
    # is compiled — its signature default references EdgeCallMode.USER_PROXIED.
    wanted_classes = {"EdgeCallMode"}
    selected = [
        node
        for node in tree.body
        if (
            (isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in wanted_funcs)
            or (isinstance(node, ast.ClassDef) and node.name in wanted_classes)
        )
    ]
    module = ast.Module(body=selected, type_ignores=[])
    namespace = {
        "Any": Any,
        "Dict": Dict,
        "Enum": Enum,
        "os": os,
        "asyncio": asyncio,
        "httpx": types.SimpleNamespace(TimeoutException=TimeoutError),
    }
    exec(compile(module, str(CALIBRATION_SOURCE), "exec"), namespace)
    return namespace


EDGE_HELPERS = _load_edge_helpers()


class _FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload
        self.text = str(payload)

    def json(self):
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


class _FakeClient:
    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = 0

    async def post(self, endpoint, json=None, headers=None):
        self.calls += 1
        if not self._responses:
            raise RuntimeError("no fake response configured")
        return self._responses.pop(0)


def _run(coro):
    return asyncio.run(coro)


def test_normalize_edge_result_marks_http_failure():
    result = EDGE_HELPERS["_normalize_edge_result"](
        "deep-web-recon",
        502,
        {"detail": "upstream unavailable"},
    )
    assert result["ok"] is False
    assert result["_http_status"] == 502
    assert result["error"] == "upstream unavailable"
    assert result["code"] == "EDGE_FUNCTION_HTTP_ERROR"


def test_normalize_edge_result_marks_payload_failure_even_on_200():
    result = EDGE_HELPERS["_normalize_edge_result"](
        "semrush-domain-intel",
        200,
        {"ok": False, "error": "SEMRUSH_API_KEY missing"},
    )
    assert result["ok"] is False
    assert result["_http_status"] == 200
    assert result["error"] == "SEMRUSH_API_KEY missing"
    assert result["code"] == "EDGE_FUNCTION_FAILED"


def test_normalize_edge_result_preserves_success_shape():
    result = EDGE_HELPERS["_normalize_edge_result"](
        "social-enrichment",
        200,
        {"social_handles": {"linkedin": "https://linkedin.com/company/test"}},
    )
    assert result["ok"] is True
    assert result["_http_status"] == 200
    assert result["code"] == "OK"


def test_edge_result_failed_contract_covers_all_failure_modes():
    edge_result_failed = EDGE_HELPERS["_edge_result_failed"]
    assert edge_result_failed({"ok": False, "_http_status": 200}) is True
    assert edge_result_failed({"status": "error", "_http_status": 200}) is True
    assert edge_result_failed({"error_code": "SCAN_FAILED", "_http_status": 200}) is True
    assert edge_result_failed({"ok": True, "_http_status": 500}) is True
    assert edge_result_failed({"ok": True, "_http_status": 200}) is False


def test_call_edge_function_retries_once_on_5xx(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")

    async def _fast_sleep(_seconds):
        return None

    monkeypatch.setattr(EDGE_HELPERS["asyncio"], "sleep", _fast_sleep)
    fake_client = _FakeClient(
        [
            _FakeResponse(500, {"error": "temporary"}),
            _FakeResponse(200, {"ok": True, "result": "recovered"}),
        ]
    )
    EDGE_HELPERS["_get_edge_client"] = lambda: fake_client

    result = _run(EDGE_HELPERS["_call_edge_function"]("deep-web-recon", {"website": "https://example.com"}))
    assert fake_client.calls == 2
    assert result["ok"] is True
    assert result["_http_status"] == 200


def test_call_edge_function_returns_normalized_non_2xx(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key")
    fake_client = _FakeClient([_FakeResponse(404, {"detail": "not found"})])
    EDGE_HELPERS["_get_edge_client"] = lambda: fake_client

    result = _run(EDGE_HELPERS["_call_edge_function"]("missing-fn", {}))
    assert result["ok"] is False
    assert result["_http_status"] == 404
    assert result["error"] == "not found"


def test_normalize_edge_result_rejects_raw_non_json_200():
    result = EDGE_HELPERS["_normalize_edge_result"](
        "market-analysis-ai",
        200,
        {"raw": "<html>upstream proxy timeout page</html>"},
    )
    assert result["ok"] is False
    assert result["code"] == "EDGE_INVALID_PAYLOAD"
    assert "non-JSON" in result["error"]


def test_edge_result_failed_rejects_raw_non_json_payload():
    edge_result_failed = EDGE_HELPERS["_edge_result_failed"]
    assert edge_result_failed({"_http_status": 200, "raw": "<html>bad gateway</html>"}) is True

