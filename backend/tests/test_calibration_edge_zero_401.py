"""
Marjo P0 / E1 (2026-05-04) — Zero-401 contract for the 8 calibration edge fns.

Background:
    PR #449 merged but did NOT prove zero 401/403 across the 8 URL-scan
    edge functions. The standing rule (memory: feedback_zero_401_tolerance.md,
    2026-04-23) is: "There MUST Never be a 401. ZERO fall-backs."

This test pins the backend's contract for the 8 mission functions:

  1. browse-ai-reviews
  2. calibration-psych           (canonical hyphen slug)
  3. calibration_psych           (legacy underscore alias — must canonicalise)
  4. business-identity-lookup
  5. calibration-business-dna
  6. calibration-sync
  7. deep-web-recon
  8. warm-cognitive-engine
  9. social-enrichment

Pins enforced here:
  A. MISSION_EDGE_FUNCTIONS_ZERO_401 contains all 8 mission slugs (+ both
     forms of the calibration-psych alias).
  B. _surface_edge_non_200 fires logger.error for any non-200 from a mission
     function and is silent for non-mission functions.
  C. _strict_edge_zero_401_enabled honours the env-var contract (off by
     default, enabled by `1` / `true` / `yes` / `on`).
  D. EdgeFunctionNonOk carries the structured fields needed for the outer
     handler to translate to a Contract v2 sanitised response.
  E. _call_edge_function with stubbed HTTP transport returning 200 yields
     `ok: True` — the happy path, repeated per function.
  F. _call_edge_function with stubbed HTTP transport returning 401 yields
     `ok: False` AND triggers the structured ERROR log line.

Test strategy: ast-load the symbols from calibration.py without importing
the full FastAPI module (which pulls in Supabase + httpx + many siblings).
Same pattern as test_incident_h_edge_call_mode.py.

Mocked transport: yes. Live integration is verified separately in production
via Supabase MCP get_logs (saved under evidence/<fn>-logs-24h.txt at the time
of this PR).
"""
from __future__ import annotations

import ast
import asyncio
import logging
import os
import types
from enum import Enum
from pathlib import Path
from typing import Any, Dict, Optional


REPO_ROOT = Path(__file__).resolve().parents[2]
CALIBRATION_SOURCE = REPO_ROOT / "backend" / "routes" / "calibration.py"


THE_8_MISSION_FUNCTIONS = (
    "browse-ai-reviews",
    "calibration-psych",
    "calibration_psych",          # legacy underscore — must also be in the set
    "business-identity-lookup",
    "calibration-business-dna",
    "calibration-sync",
    "deep-web-recon",
    "warm-cognitive-engine",
    "social-enrichment",
)


def _load_symbols(http_status_to_return: int = 200,
                  body_to_return: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Extract zero-401 surfacing symbols + _call_edge_function from
    calibration.py without importing the whole module.

    Stubs `_get_edge_client` to return a controlled response and stubs
    `_normalize_edge_result` and `_edge_result_failed` so the test does not
    depend on every helper's exact behaviour.

    Args:
        http_status_to_return: status that the stubbed httpx response carries.
        body_to_return: JSON body the stubbed response yields. When None,
            falls back to {"ok": http_status_to_return == 200, "code": "OK"}.
    """
    tree = ast.parse(CALIBRATION_SOURCE.read_text(encoding="utf-8"))
    wanted_funcs = {
        "_call_edge_function",
        "_strict_edge_zero_401_enabled",
        "_surface_edge_non_200",
    }
    wanted_classes = {"EdgeCallMode", "EdgeFunctionNonOk"}
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

    body = body_to_return if body_to_return is not None else {
        "ok": http_status_to_return == 200,
        "code": "OK" if http_status_to_return == 200 else "EDGE_FUNCTION_HTTP_ERROR",
        "error": None if http_status_to_return == 200 else f"HTTP {http_status_to_return} from edge",
    }

    class _StubResponse:
        def __init__(self, status: int, payload: Dict[str, Any]):
            self.status_code = status
            self._payload = payload
            self.text = ""

        def json(self):
            return self._payload

    class _StubClient:
        async def post(self, *_args, **_kwargs):
            return _StubResponse(http_status_to_return, dict(body))

    def _get_edge_client_stub():
        return _StubClient()

    # Real-shaped _normalize_edge_result + _edge_result_failed (minimal subset)
    def _normalize_edge_result_stub(function_name: str, http_status: int, data: Any) -> Dict[str, Any]:
        payload = data if isinstance(data, dict) else {"data": data}
        payload.setdefault("_http_status", http_status)
        if http_status >= 400 or payload.get("ok") is False:
            payload["ok"] = False
            payload.setdefault("code", "EDGE_FUNCTION_HTTP_ERROR")
            payload.setdefault("error", f"{function_name} returned HTTP {http_status}")
        else:
            payload.setdefault("ok", True)
            payload.setdefault("code", "OK")
        return payload

    def _edge_result_failed_stub(result: Any) -> bool:
        if not isinstance(result, dict):
            return True
        try:
            status_code = int(result.get("_http_status") or 200)
        except Exception:
            status_code = 200
        if status_code >= 400:
            return True
        if result.get("ok") is False:
            return True
        return False

    # Capture loglines emitted by _surface_edge_non_200 for assertions.
    captured_logs: list = []

    class _CapturingLogger:
        def error(self, msg, *args, **kwargs):
            try:
                rendered = msg % args if args else msg
            except Exception:
                rendered = f"{msg} args={args}"
            captured_logs.append(rendered)

        def warning(self, *args, **kwargs):
            pass

        def info(self, *args, **kwargs):
            pass

        def debug(self, *args, **kwargs):
            pass

    # P0 Marjo E2 (2026-05-04) — supply no-op shims for the trace helpers
    # so this AST loader stays trace-table-less while exercising the same
    # control flow as production. Real production wires these to
    # core.enrichment_trace.
    async def _noop_async(*args, **kwargs):
        return None

    def _noop(*args, **kwargs):
        return None

    namespace: Dict[str, Any] = {
        "Any": Any,
        "Dict": Dict,
        "Optional": Optional,
        "Enum": Enum,
        "RuntimeError": RuntimeError,
        "os": os,
        "asyncio": asyncio,
        "httpx": types.SimpleNamespace(TimeoutException=TimeoutError),
        "logger": _CapturingLogger(),
        "_get_edge_client": _get_edge_client_stub,
        "_normalize_edge_result": _normalize_edge_result_stub,
        "_edge_result_failed": _edge_result_failed_stub,
        # E2 trace helpers — no-op so trace rows aren't written from tests.
        "abegin_trace": _noop_async,
        "acomplete_trace": _noop_async,
        "arecord_provider_trace": _noop_async,
        "get_active_scan_id": _noop,
        "get_active_user_id": _noop,
        "EDGE_FUNCTION_TO_PROVIDER": {},
        "_summarise_edge_request": lambda fn, payload: {"edge_function": fn},
        "_summarise_edge_response": lambda fn, status, normalised: {
            "edge_function": fn, "http_status": status,
        },
        "_time": __import__("time"),
        "json": __import__("json"),
    }
    exec(compile(module, str(CALIBRATION_SOURCE), "exec"), namespace)
    namespace["_captured_logs"] = captured_logs
    return namespace


# ─── Pin A: mission set must contain all 8 + alias ───────────────────────

def test_mission_edge_functions_zero_401_contains_all_8_canonical_slugs():
    ns = _load_symbols()
    mission = ns["MISSION_EDGE_FUNCTIONS_ZERO_401"]
    assert isinstance(mission, set), "MISSION_EDGE_FUNCTIONS_ZERO_401 must be a set"
    for slug in THE_8_MISSION_FUNCTIONS:
        assert slug in mission, (
            f"missing mission slug from MISSION_EDGE_FUNCTIONS_ZERO_401: {slug!r} "
            f"(set={sorted(mission)!r})"
        )


def test_mission_set_includes_both_calibration_psych_aliases():
    ns = _load_symbols()
    mission = ns["MISSION_EDGE_FUNCTIONS_ZERO_401"]
    assert "calibration-psych" in mission
    assert "calibration_psych" in mission, (
        "underscore alias is required because routes/integrations.py canonicalises "
        "calibration_psych -> calibration-psych at the proxy boundary"
    )


# ─── Pin C: strict-mode env contract ─────────────────────────────────────

def test_strict_zero_401_default_is_off():
    ns = _load_symbols()
    os.environ.pop("STRICT_EDGE_ZERO_401", None)
    assert ns["_strict_edge_zero_401_enabled"]() is False


def test_strict_zero_401_accepts_truthy_strings():
    ns = _load_symbols()
    for truthy in ("1", "true", "True", "TRUE", "yes", "YES", "on", "ON"):
        os.environ["STRICT_EDGE_ZERO_401"] = truthy
        assert ns["_strict_edge_zero_401_enabled"]() is True, (
            f"_strict_edge_zero_401_enabled should be True when env={truthy!r}"
        )
    os.environ.pop("STRICT_EDGE_ZERO_401", None)


def test_strict_zero_401_rejects_falsy_strings():
    ns = _load_symbols()
    for falsy in ("0", "false", "no", "off", "", "  "):
        os.environ["STRICT_EDGE_ZERO_401"] = falsy
        assert ns["_strict_edge_zero_401_enabled"]() is False, (
            f"_strict_edge_zero_401_enabled should be False when env={falsy!r}"
        )
    os.environ.pop("STRICT_EDGE_ZERO_401", None)


# ─── Pin D: EdgeFunctionNonOk contract ───────────────────────────────────

def test_edge_function_non_ok_carries_structured_fields():
    ns = _load_symbols()
    EdgeFunctionNonOk = ns["EdgeFunctionNonOk"]
    err = EdgeFunctionNonOk(
        function_name="browse-ai-reviews",
        status=401,
        code="EDGE_FUNCTION_HTTP_ERROR",
        error="Invalid token",
    )
    assert err.function_name == "browse-ai-reviews"
    assert err.status == 401
    assert err.code == "EDGE_FUNCTION_HTTP_ERROR"
    assert err.error == "Invalid token"
    assert "browse-ai-reviews" in str(err)
    assert "401" in str(err)


def test_edge_function_non_ok_is_runtimeerror_subclass():
    ns = _load_symbols()
    assert issubclass(ns["EdgeFunctionNonOk"], RuntimeError)


# ─── Pin B: _surface_edge_non_200 logging contract ───────────────────────

def test_surface_non_200_silent_for_non_mission_function():
    ns = _load_symbols()
    ns["_captured_logs"].clear()
    ns["_surface_edge_non_200"](
        "intelligence-snapshot",
        {"_http_status": 401, "ok": False, "code": "X", "error": "fake"},
    )
    assert ns["_captured_logs"] == [], (
        "non-mission functions must NOT trigger the zero-401 ERROR log "
        "(would be log noise — they are tracked separately)"
    )


def test_surface_non_200_silent_on_success_for_mission_function():
    ns = _load_symbols()
    ns["_captured_logs"].clear()
    ns["_surface_edge_non_200"](
        "deep-web-recon",
        {"_http_status": 200, "ok": True, "code": "OK"},
    )
    assert ns["_captured_logs"] == [], (
        "successful mission edge calls must not trigger the ERROR log"
    )


def test_surface_non_200_logs_error_for_each_mission_function_on_401():
    """Per zero-401 standing rule: every non-200 from a mission function MUST
    be surfaced explicitly with structured fields (function, status, code,
    error snippet). This prevents the 2026-04-23 5%-data CMO Report
    incident from recurring silently."""
    ns = _load_symbols()
    for slug in THE_8_MISSION_FUNCTIONS:
        ns["_captured_logs"].clear()
        ns["_surface_edge_non_200"](
            slug,
            {
                "_http_status": 401,
                "ok": False,
                "code": "EDGE_FUNCTION_HTTP_ERROR",
                "error": "Invalid token",
            },
        )
        assert len(ns["_captured_logs"]) == 1, (
            f"{slug}: expected exactly one ERROR log, got {ns['_captured_logs']!r}"
        )
        log_line = ns["_captured_logs"][0]
        assert "[zero-401 P0]" in log_line, (
            f"{slug}: expected '[zero-401 P0]' marker in log, got {log_line!r}"
        )
        assert slug in log_line, (
            f"{slug}: expected slug in log line for grep-ability, got {log_line!r}"
        )
        assert "401" in log_line, (
            f"{slug}: expected status 401 in log line, got {log_line!r}"
        )


def test_surface_non_200_logs_error_for_each_mission_function_on_403():
    ns = _load_symbols()
    for slug in THE_8_MISSION_FUNCTIONS:
        ns["_captured_logs"].clear()
        ns["_surface_edge_non_200"](
            slug,
            {
                "_http_status": 403,
                "ok": False,
                "code": "EDGE_FUNCTION_HTTP_ERROR",
                "error": "user_jwt_rejected",
            },
        )
        assert len(ns["_captured_logs"]) == 1, (
            f"{slug}: expected exactly one ERROR log on 403"
        )
        assert "403" in ns["_captured_logs"][0]


def test_surface_non_200_logs_error_for_each_mission_function_on_5xx():
    ns = _load_symbols()
    for slug in THE_8_MISSION_FUNCTIONS:
        for status in (500, 502, 503, 504):
            ns["_captured_logs"].clear()
            ns["_surface_edge_non_200"](
                slug,
                {
                    "_http_status": status,
                    "ok": False,
                    "code": "EDGE_FUNCTION_UNAVAILABLE",
                    "error": "upstream timeout",
                },
            )
            assert len(ns["_captured_logs"]) == 1, (
                f"{slug} status={status}: expected one ERROR log per 5xx, "
                f"got {ns['_captured_logs']!r}"
            )
            assert str(status) in ns["_captured_logs"][0]


# ─── Pin E: happy path — _call_edge_function returns ok:True per function ─

def _call(ns, function_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Invoke the loaded _call_edge_function with the namespace's stubs."""
    return asyncio.run(ns["_call_edge_function"](
        function_name,
        payload,
        mode=ns["EdgeCallMode"].BACKEND_ORCHESTRATED,
    ))


def test_call_edge_function_returns_ok_for_each_mission_function_on_200():
    """The contract: when the upstream Supabase Edge Function returns 200,
    _call_edge_function returns a normalized envelope with ok:True. This is
    the happy-path assertion for the 8 mission functions."""
    os.environ["SUPABASE_URL"] = "https://test.supabase.co"
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "test_service_role_key"
    for slug in THE_8_MISSION_FUNCTIONS:
        ns = _load_symbols(http_status_to_return=200)
        result = _call(ns, slug, {"user_id": "test-user-uuid", "tenant_id": "test-user-uuid"})
        assert isinstance(result, dict), f"{slug}: expected dict, got {type(result)}"
        assert result.get("ok") is True, (
            f"{slug}: expected ok=True on 200 transport, got {result!r}"
        )
        assert result.get("_http_status") == 200, (
            f"{slug}: expected _http_status=200, got {result!r}"
        )


# ─── Pin F: failure path — 401 yields ok:False AND ERROR log ──────────────

def test_call_edge_function_yields_ok_false_and_logs_error_on_401():
    """When upstream returns 401, _call_edge_function MUST return ok:False
    (no silent fallback) AND _surface_edge_non_200 MUST log an ERROR for any
    mission function (not silent ai_errors capture). This is the central
    zero-401 contract."""
    os.environ["SUPABASE_URL"] = "https://test.supabase.co"
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "test_service_role_key"
    for slug in THE_8_MISSION_FUNCTIONS:
        ns = _load_symbols(
            http_status_to_return=401,
            body_to_return={"error": "Invalid token", "code": "user_jwt_rejected"},
        )
        result = _call(ns, slug, {"user_id": "test-user-uuid", "tenant_id": "test-user-uuid"})
        assert isinstance(result, dict)
        assert result.get("ok") is False, (
            f"{slug}: expected ok=False on 401 transport (zero fall-back to empty success), "
            f"got {result!r}"
        )
        assert result.get("_http_status") == 401
        # ERROR log line must have fired exactly once.
        assert len(ns["_captured_logs"]) == 1, (
            f"{slug}: expected exactly one [zero-401 P0] ERROR log on 401, "
            f"got {ns['_captured_logs']!r}"
        )
        assert "[zero-401 P0]" in ns["_captured_logs"][0]
        assert slug in ns["_captured_logs"][0]


def test_call_edge_function_silent_for_non_mission_function_on_401():
    """Non-mission functions still return ok:False on 401 (the contract is
    universal at that layer), but they do NOT trigger the zero-401 [P0] log
    line — those functions are tracked by other agents/gates and the noise
    would dilute the signal Andreas needs daily."""
    os.environ["SUPABASE_URL"] = "https://test.supabase.co"
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "test_service_role_key"
    ns = _load_symbols(
        http_status_to_return=401,
        body_to_return={"error": "Invalid token"},
    )
    result = _call(ns, "intelligence-snapshot", {"user_id": "test-user-uuid"})
    assert result.get("ok") is False
    assert ns["_captured_logs"] == [], (
        f"non-mission functions must not trigger [zero-401 P0] log, got {ns['_captured_logs']!r}"
    )
