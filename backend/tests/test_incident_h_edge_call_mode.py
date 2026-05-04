"""
Incident H contract tests — EdgeCallMode + _call_edge_function.

These tests pin the backend-orchestration auth contract described in the
CTO directive 2026-04-23 Sections 4-6. They are syntactic + contract
checks that run without live Supabase; the live verification matrix
(V1-V12) runs against a staged user session.

Pins:
  1. EdgeCallMode is an Enum with BACKEND_ORCHESTRATED and USER_PROXIED members.
  2. _call_edge_function signature accepts `mode` and `auth_header` keyword-only.
  3. BACKEND_ORCHESTRATED without user_id/tenant_id raises ValueError.
  4. BACKEND_ORCHESTRATED with user_id is accepted without raising (the HTTP
     call itself is stubbed out — we only verify the contract guard).
  5. USER_PROXIED does not require user_id — backward compatibility.
"""

from __future__ import annotations

import ast
import asyncio
import os
import types
from enum import Enum
from pathlib import Path
from typing import Any, Dict

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
CALIBRATION_SOURCE = REPO_ROOT / "backend" / "routes" / "calibration.py"


def _load_symbols():
    """Extract EdgeCallMode + _call_edge_function from calibration.py without
    importing the full module (which pulls in FastAPI / Supabase / etc).
    """
    tree = ast.parse(CALIBRATION_SOURCE.read_text(encoding="utf-8"))
    wanted_funcs = {
        "_call_edge_function",
        # Marjo P0 / E1 (2026-05-04): _call_edge_function now routes its
        # return through _surface_edge_non_200 — load the helper too.
        "_surface_edge_non_200",
    }
    wanted_classes = {"EdgeCallMode"}
    wanted_assigns = {"MISSION_EDGE_FUNCTIONS_ZERO_401"}
    selected: list = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in wanted_funcs:
            selected.append(node)
        elif isinstance(node, ast.ClassDef) and node.name in wanted_classes:
            selected.append(node)
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in wanted_assigns:
                    selected.append(node)
                    break
    module = ast.Module(body=selected, type_ignores=[])

    class _StubClient:
        async def post(self, *_args, **_kwargs):
            # Should never be reached in contract tests — guards fire first.
            raise AssertionError("HTTP call should not happen in contract tests")

    class _StubResponse:
        status_code = 200

        def json(self):
            return {"ok": True}

    def _get_edge_client_stub():
        return _StubClient()

    class _NoopLogger:
        def error(self, *args, **kwargs):
            pass

        def warning(self, *args, **kwargs):
            pass

        def info(self, *args, **kwargs):
            pass

        def debug(self, *args, **kwargs):
            pass

    # Real-shaped stub for _edge_result_failed used by _surface_edge_non_200.
    def _edge_result_failed_stub(result):
        if not isinstance(result, dict):
            return True
        try:
            status_code = int(result.get("_http_status") or 200)
        except Exception:
            status_code = 200
        return status_code >= 400 or result.get("ok") is False

    namespace: Dict[str, Any] = {
        "Any": Any,
        "Dict": Dict,
        "Enum": Enum,
        "os": os,
        "asyncio": asyncio,
        "httpx": types.SimpleNamespace(TimeoutException=TimeoutError),
        "_get_edge_client": _get_edge_client_stub,
        "_normalize_edge_result": lambda fn, status, data: {"ok": status == 200, **data},
        "_edge_result_failed": _edge_result_failed_stub,
        "logger": _NoopLogger(),
    }
    exec(compile(module, str(CALIBRATION_SOURCE), "exec"), namespace)
    return namespace


def test_edgecallmode_is_enum_with_expected_members():
    ns = _load_symbols()
    mode = ns["EdgeCallMode"]
    assert issubclass(mode, Enum)
    members = {m.name for m in mode}
    assert members == {"BACKEND_ORCHESTRATED", "USER_PROXIED"}


def test_call_edge_function_has_mode_and_auth_header_kwargs():
    ns = _load_symbols()
    import inspect
    sig = inspect.signature(ns["_call_edge_function"])
    assert "mode" in sig.parameters
    assert "auth_header" in sig.parameters
    # Both must be keyword-only per the new contract.
    assert sig.parameters["mode"].kind == inspect.Parameter.KEYWORD_ONLY
    assert sig.parameters["auth_header"].kind == inspect.Parameter.KEYWORD_ONLY


def test_backend_orchestrated_without_user_id_raises():
    ns = _load_symbols()
    os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
    os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test_service_role")
    with pytest.raises(ValueError, match="BACKEND_ORCHESTRATED mode requires user_id or tenant_id"):
        asyncio.run(ns["_call_edge_function"](
            "deep-web-recon",
            {"website": "https://example.com"},
            mode=ns["EdgeCallMode"].BACKEND_ORCHESTRATED,
        ))


def test_backend_orchestrated_with_tenant_id_accepted():
    """tenant_id is a valid substitute for user_id (market-signal-scorer pattern)."""
    ns = _load_symbols()
    os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
    os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test_service_role")

    # Stub the HTTP call so we reach the post but don't execute a real request.
    class _FakeResponse:
        status_code = 200

        def json(self):
            return {"ok": True}

    class _FakeClient:
        async def post(self, *_args, **_kwargs):
            return _FakeResponse()

    ns["_get_edge_client"] = lambda: _FakeClient()
    # Re-bind inside the loaded function's closure by re-execing with new client.
    # Simpler: patch via the namespace directly and accept that the stub is in scope.
    result = asyncio.run(ns["_call_edge_function"](
        "market-signal-scorer",
        {"tenant_id": "u-123"},
        mode=ns["EdgeCallMode"].BACKEND_ORCHESTRATED,
    ))
    assert isinstance(result, dict)
    assert result.get("ok") is True


def test_user_proxied_default_does_not_require_user_id():
    """Backward-compat: USER_PROXIED is the default; no contract guard on payload."""
    ns = _load_symbols()
    os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
    os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test_service_role")

    class _FakeResponse:
        status_code = 200

        def json(self):
            return {"ok": True}

    class _FakeClient:
        async def post(self, *_args, **_kwargs):
            return _FakeResponse()

    ns["_get_edge_client"] = lambda: _FakeClient()
    result = asyncio.run(ns["_call_edge_function"](
        "some-function",
        {"website_url": "https://example.com"},
        auth_header="Bearer user_jwt_here",
    ))
    # No ValueError — the USER_PROXIED path accepts any payload.
    assert isinstance(result, dict)
