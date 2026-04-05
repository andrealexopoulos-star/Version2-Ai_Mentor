import asyncio
import json
from pathlib import Path
import sys
import types

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def _install_module_stubs():
    if "fastapi" not in sys.modules:
        fastapi_stub = types.ModuleType("fastapi")

        class _HTTPException(Exception):
            def __init__(self, status_code: int = 500, detail: str = ""):
                super().__init__(detail)
                self.status_code = status_code
                self.detail = detail

        class _APIRouter:
            def get(self, *_args, **_kwargs):
                def _decorator(func):
                    return func

                return _decorator

        fastapi_stub.APIRouter = _APIRouter
        fastapi_stub.Depends = lambda fn: fn
        fastapi_stub.HTTPException = _HTTPException
        sys.modules["fastapi"] = fastapi_stub

    if "fastapi.responses" not in sys.modules:
        responses_stub = types.ModuleType("fastapi.responses")

        class _JSONResponse:
            def __init__(self, status_code: int = 200, content=None):
                self.status_code = status_code
                self.content = content or {}

        responses_stub.JSONResponse = _JSONResponse
        sys.modules["fastapi.responses"] = responses_stub

    if "supabase_client" not in sys.modules:
        sb_stub = types.ModuleType("supabase_client")
        sb_stub.init_supabase = lambda: object()
        sys.modules["supabase_client"] = sb_stub

    if "intelligence_spine" not in sys.modules:
        spine_stub = types.ModuleType("intelligence_spine")
        spine_stub.emit_spine_event = lambda **_kwargs: None
        sys.modules["intelligence_spine"] = spine_stub

    if "routes.auth" not in sys.modules:
        routes_auth_stub = types.ModuleType("routes.auth")
        routes_auth_stub.get_current_user = lambda: {"id": "stub-user"}
        sys.modules["routes.auth"] = routes_auth_stub


_install_module_stubs()

import routes.intelligence_modules as intelligence_modules


def _response_payload(resp):
    if hasattr(resp, "content"):
        return resp.content
    body = getattr(resp, "body", b"{}")
    if isinstance(body, bytes):
        return json.loads(body.decode("utf-8"))
    if isinstance(body, str):
        return json.loads(body)
    return {}


def _response_status(resp) -> int:
    return int(getattr(resp, "status_code", 0))


def test_timeout_returns_503(monkeypatch):
    async def _raise(*_args, **_kwargs):
        raise Exception("rpc timed out")

    monkeypatch.setattr(intelligence_modules, "_rpc_execute", _raise)
    monkeypatch.setattr(intelligence_modules, "emit_spine_event", lambda **_kwargs: None)

    resp = asyncio.run(
        intelligence_modules._rpc_truth_gateway("compute_evidence_freshness", "workspace-1")
    )
    payload = _response_payload(resp)

    assert _response_status(resp) == 503
    assert payload["status"] == "failed"
    assert payload["truth_level"] == "unknown"
    assert payload["error_class"] == "TIMEOUT"
    assert payload["retryable"] is True


def test_auth_failure_returns_503(monkeypatch):
    async def _raise(*_args, **_kwargs):
        raise Exception("permission denied for function")

    monkeypatch.setattr(intelligence_modules, "_rpc_execute", _raise)
    monkeypatch.setattr(intelligence_modules, "emit_spine_event", lambda **_kwargs: None)

    resp = asyncio.run(
        intelligence_modules._rpc_truth_gateway("build_intelligence_summary", "workspace-1")
    )
    payload = _response_payload(resp)

    assert _response_status(resp) == 503
    assert payload["status"] == "failed"
    assert payload["truth_level"] == "unknown"
    assert payload["error_class"] == "AUTH_FAILURE"
    assert payload["retryable"] is False


def test_unknown_exception_returns_503(monkeypatch):
    async def _raise(*_args, **_kwargs):
        raise Exception("unexpected meltdown")

    monkeypatch.setattr(intelligence_modules, "_rpc_execute", _raise)
    monkeypatch.setattr(intelligence_modules, "emit_spine_event", lambda **_kwargs: None)

    resp = asyncio.run(
        intelligence_modules._rpc_truth_gateway("build_intelligence_summary", "workspace-1")
    )
    payload = _response_payload(resp)

    assert _response_status(resp) == 503
    assert payload["status"] == "failed"
    assert payload["truth_level"] == "unknown"
    assert payload["error_class"] == "UNKNOWN_ERROR"
    assert payload["retryable"] is True


def test_rpc_missing_returns_degraded_with_exact_completeness(monkeypatch):
    intelligence_modules._cache_snapshot(
        "compute_evidence_freshness",
        "workspace-1",
        {
            "freshness": {
                "crm": {"status": "fresh"},
                "accounting": {"status": "fresh"},
            }
        },
    )

    async def _raise(*_args, **_kwargs):
        raise Exception("function public.compute_evidence_freshness(uuid) does not exist")

    monkeypatch.setattr(intelligence_modules, "_rpc_execute", _raise)
    monkeypatch.setattr(intelligence_modules, "emit_spine_event", lambda **_kwargs: None)

    resp = asyncio.run(
        intelligence_modules._rpc_truth_gateway("compute_evidence_freshness", "workspace-1")
    )
    payload = _response_payload(resp)

    assert _response_status(resp) == 424
    assert payload["status"] == "degraded"
    assert payload["truth_level"] == "bounded"
    assert payload["error_class"] == "RPC_FUNCTION_MISSING"
    assert payload["completeness"] == 2 / 5
    assert payload["confidence"] == 2 / 5
    assert payload["missing_components"] == [
        "freshness.email",
        "freshness.marketing",
        "freshness.scrape",
    ]
    assert "supabase_rpc.compute_evidence_freshness" in payload["broken_dependencies"]
    assert "rpc_definition" in payload["broken_dependencies"]


def test_check_constraint_violation_returns_degraded_schema_mismatch(monkeypatch):
    intelligence_modules._cache_snapshot(
        "compute_evidence_freshness",
        "workspace-1",
        {
            "freshness": {
                "crm": {"status": "fresh"},
            }
        },
    )

    async def _raise(*_args, **_kwargs):
        raise Exception(
            'new row for relation "evidence_freshness" violates check constraint '
            '"evidence_freshness_state_check" (SQLSTATE 23514)'
        )

    monkeypatch.setattr(intelligence_modules, "_rpc_execute", _raise)
    monkeypatch.setattr(intelligence_modules, "emit_spine_event", lambda **_kwargs: None)

    resp = asyncio.run(
        intelligence_modules._rpc_truth_gateway("compute_evidence_freshness", "workspace-1")
    )
    payload = _response_payload(resp)

    assert _response_status(resp) == 424
    assert payload["status"] == "degraded"
    assert payload["truth_level"] == "bounded"
    assert payload["error_class"] == "SCHEMA_MISMATCH"
    assert payload["completeness"] == 1 / 5
    assert payload["confidence"] == 1 / 5
    assert "schema_cache" in payload["broken_dependencies"]


def test_canonical_response_enforces_full_truth_contract(monkeypatch):
    async def _ok(*_args, **_kwargs):
        return {
            "freshness": {
                "crm": {"status": "fresh"},
                "accounting": {"status": "fresh"},
                "email": {"status": "fresh"},
                "marketing": {"status": "fresh"},
                "scrape": {"status": "fresh"},
            }
        }

    captured = {}

    def _capture_emit(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(intelligence_modules, "_rpc_execute", _ok)
    monkeypatch.setattr(intelligence_modules, "emit_spine_event", _capture_emit)

    resp = asyncio.run(
        intelligence_modules._rpc_truth_gateway("compute_evidence_freshness", "workspace-1")
    )
    payload = _response_payload(resp)

    assert _response_status(resp) == 200
    assert payload["status"] == "canonical"
    assert payload["truth_level"] == "verified"
    assert payload["completeness"] == 1.0
    assert payload["confidence"] == 1.0
    assert payload["degradation_flag"] is False
    assert isinstance(payload["trace_id"], str) and payload["trace_id"]
    assert "latency_ms" in payload
    assert captured.get("event_type") == "MODEL_EXECUTED"


def test_observability_failure_escalates_to_503(monkeypatch):
    async def _ok(*_args, **_kwargs):
        return {"modules": {"freshness": {"ok": True}}}

    def _emit_fail(**_kwargs):
        raise RuntimeError("spine down")

    monkeypatch.setattr(intelligence_modules, "_rpc_execute", _ok)
    monkeypatch.setattr(intelligence_modules, "emit_spine_event", _emit_fail)

    resp = asyncio.run(
        intelligence_modules._rpc_truth_gateway("build_intelligence_summary", "workspace-1")
    )
    payload = _response_payload(resp)

    assert _response_status(resp) == 503
    assert payload["status"] == "failed"
    assert payload["truth_level"] == "unknown"
    assert payload["error_class"] == "OBSERVABILITY_FAILURE"
