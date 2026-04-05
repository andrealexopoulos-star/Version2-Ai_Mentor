from pathlib import Path
import sys
import types

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def _install_module_stubs():
    fastapi_stub = sys.modules.get("fastapi")
    if fastapi_stub is None:
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

        def post(self, *_args, **_kwargs):
            def _decorator(func):
                return func

            return _decorator

        def patch(self, *_args, **_kwargs):
            def _decorator(func):
                return func

            return _decorator

        def put(self, *_args, **_kwargs):
            def _decorator(func):
                return func

            return _decorator

        def delete(self, *_args, **_kwargs):
            def _decorator(func):
                return func

            return _decorator

    fastapi_stub.APIRouter = _APIRouter
    fastapi_stub.Depends = getattr(fastapi_stub, "Depends", (lambda fn: fn))
    fastapi_stub.HTTPException = getattr(fastapi_stub, "HTTPException", _HTTPException)
    fastapi_stub.Request = getattr(fastapi_stub, "Request", object)
    fastapi_stub.Form = getattr(fastapi_stub, "Form", (lambda default=None: default))
    fastapi_stub.Query = getattr(fastapi_stub, "Query", (lambda default=None, **_kwargs: default))
    sys.modules["fastapi"] = fastapi_stub

    if "fastapi.responses" not in sys.modules:
        responses_stub = types.ModuleType("fastapi.responses")

        class _JSONResponse:
            def __init__(self, status_code: int = 200, content=None):
                self.status_code = status_code
                self.content = content or {}

        responses_stub.JSONResponse = _JSONResponse
        sys.modules["fastapi.responses"] = responses_stub

    if "pydantic" not in sys.modules:
        pydantic_stub = types.ModuleType("pydantic")

        class _BaseModel:
            pass

        pydantic_stub.BaseModel = _BaseModel
        sys.modules["pydantic"] = pydantic_stub

    if "httpx" not in sys.modules:
        sys.modules["httpx"] = types.ModuleType("httpx")

    if "routes.deps" not in sys.modules:
        deps_stub = types.ModuleType("routes.deps")
        deps_stub.get_current_user = lambda: {"id": "stub-user"}
        deps_stub.get_current_user_from_request = lambda *_a, **_k: {"id": "stub-user"}
        deps_stub.get_sb = lambda: object()
        deps_stub.OPENAI_KEY = ""
        deps_stub.AI_MODEL = "stub"
        deps_stub.cognitive_core = None
        deps_stub.logger = types.SimpleNamespace(info=lambda *_a, **_k: None, warning=lambda *_a, **_k: None, error=lambda *_a, **_k: None)
        sys.modules["routes.deps"] = deps_stub

    sb_stub = sys.modules.get("supabase_client")
    if sb_stub is None:
        sb_stub = types.ModuleType("supabase_client")
    if not hasattr(sb_stub, "safe_query_single"):
        sb_stub.safe_query_single = lambda query: query
    if not hasattr(sb_stub, "init_supabase"):
        sb_stub.init_supabase = lambda: object()
    sys.modules["supabase_client"] = sb_stub

    if "auth_supabase" not in sys.modules:
        auth_stub = types.ModuleType("auth_supabase")
        auth_stub.get_user_by_id = lambda *_a, **_k: {}
        sys.modules["auth_supabase"] = auth_stub

    if "supabase_intelligence_helpers" not in sys.modules:
        helpers_stub = types.ModuleType("supabase_intelligence_helpers")
        helpers_stub.get_business_profile_supabase = lambda *_a, **_k: {}
        sys.modules["supabase_intelligence_helpers"] = helpers_stub

    truth_stub = sys.modules.get("intelligence_live_truth")
    if truth_stub is None:
        truth_stub = types.ModuleType("intelligence_live_truth")
    if not hasattr(truth_stub, "email_row_is_connected"):
        truth_stub.email_row_is_connected = lambda *_a, **_k: True
    if not hasattr(truth_stub, "get_connector_truth_summary"):
        truth_stub.get_connector_truth_summary = lambda *_a, **_k: {}
    if not hasattr(truth_stub, "get_live_integration_truth"):
        truth_stub.get_live_integration_truth = lambda *_a, **_k: {}
    if not hasattr(truth_stub, "get_recent_observation_events"):
        truth_stub.get_recent_observation_events = lambda *_a, **_k: {"events": []}
    if not hasattr(truth_stub, "build_watchtower_events"):
        truth_stub.build_watchtower_events = lambda events, limit=10: list(events or [])[:limit]
    if not hasattr(truth_stub, "merge_row_is_connected"):
        truth_stub.merge_row_is_connected = lambda *_a, **_k: True
    if not hasattr(truth_stub, "normalize_category"):
        truth_stub.normalize_category = lambda *_a, **_k: "unknown"
    sys.modules["intelligence_live_truth"] = truth_stub

    if "supabase_drive_helpers" not in sys.modules:
        drive_stub = types.ModuleType("supabase_drive_helpers")
        drive_stub.store_merge_integration = lambda *_a, **_k: {}
        drive_stub.get_user_merge_integrations = lambda *_a, **_k: []
        drive_stub.get_merge_integration_by_token = lambda *_a, **_k: {}
        drive_stub.update_merge_integration_sync = lambda *_a, **_k: {}
        drive_stub.store_drive_file = lambda *_a, **_k: {}
        drive_stub.store_drive_files_batch = lambda *_a, **_k: {}
        drive_stub.get_user_drive_files = lambda *_a, **_k: []
        drive_stub.count_user_drive_files = lambda *_a, **_k: 0
        sys.modules["supabase_drive_helpers"] = drive_stub

    if "biqc_jobs" not in sys.modules:
        jobs_stub = types.ModuleType("biqc_jobs")
        jobs_stub.enqueue_job = lambda *_a, **_k: {"queued": False}
        sys.modules["biqc_jobs"] = jobs_stub

    if "integration_status_cache" not in sys.modules:
        cache_stub = types.ModuleType("integration_status_cache")
        cache_stub.get_cached_integration_status = lambda *_a, **_k: None
        cache_stub.set_cached_integration_status = lambda *_a, **_k: None
        cache_stub.invalidate_cached_integration_status = lambda *_a, **_k: None
        sys.modules["integration_status_cache"] = cache_stub

    if "tier_resolver" not in sys.modules:
        tier_stub = types.ModuleType("tier_resolver")
        tier_stub.resolve_tier = lambda *_a, **_k: "free"
        sys.modules["tier_resolver"] = tier_stub


_install_module_stubs()

import routes.integrations as integrations


def test_classify_rpc_failure_missing():
    code = integrations._classify_rpc_failure(Exception("function public.compute_watchtower_positions(uuid) does not exist"))
    assert code == "RPC_MISSING"


def test_watchtower_degraded_payload_contract():
    payload = integrations._watchtower_degraded_payload(
        user_id="workspace-1",
        rpc_reason_code="RPC_MISSING",
        rpc_error=Exception("function missing"),
        events=[{"id": "evt-1", "severity": "high", "created_at": "2026-04-05T00:00:00+00:00"}],
    )
    assert payload["status"] == "degraded"
    assert payload["canonical_available"] is False
    assert payload["degraded_reason_code"] == "RPC_MISSING"
    assert payload["degraded_contract_version"] == "watchtower-degraded-v2"
    assert payload["has_data"] is True
    assert payload["count"] == 1
    assert "lineage" in payload
    assert "recovery_actions" in payload
