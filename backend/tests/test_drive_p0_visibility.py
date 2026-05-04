import asyncio
import importlib
import os
import sys
import types


BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


class _Resp:
    def __init__(self, data=None, count=None):
        self.data = data if data is not None else []
        self.count = count


class _TableQuery:
    def __init__(self, db, table_name, op):
        self.db = db
        self.table_name = table_name
        self.op = op
        self.filters = []
        self.payload = None
        self._limit = None

    def select(self, *_args, **_kwargs):
        self.op = "select"
        return self

    def eq(self, key, value):
        self.filters.append(("eq", key, value))
        return self

    def in_(self, key, values):
        self.filters.append(("in", key, set(values)))
        return self

    def limit(self, value):
        self._limit = value
        return self

    def order(self, *_args, **_kwargs):
        return self

    def not_(self, key, op, value):
        self.filters.append(("not", key, op, value))
        return self

    def update(self, payload):
        self.op = "update"
        self.payload = payload
        return self

    def delete(self):
        self.op = "delete"
        return self

    def upsert(self, payload, **_kwargs):
        self.op = "upsert"
        self.payload = payload
        return self

    def _matches(self, row):
        for flt in self.filters:
            kind = flt[0]
            if kind == "eq":
                _, key, value = flt
                if row.get(key) != value:
                    return False
            elif kind == "in":
                _, key, values = flt
                if row.get(key) not in values:
                    return False
            elif kind == "not":
                _, key, op, value = flt
                if op == "is" and value == "null" and row.get(key) is None:
                    return False
        return True

    def execute(self):
        rows = self.db.tables.setdefault(self.table_name, [])
        if self.op == "select":
            data = [dict(r) for r in rows if self._matches(r)]
            if self._limit is not None:
                data = data[: self._limit]
            return _Resp(data=data, count=len(data))
        if self.op == "delete":
            kept = []
            deleted = []
            for row in rows:
                if self._matches(row):
                    deleted.append(dict(row))
                else:
                    kept.append(row)
            self.db.tables[self.table_name] = kept
            self.db.operations.append(("delete", self.table_name, dict(self.payload or {}), list(self.filters)))
            return _Resp(data=deleted)
        if self.op == "update":
            updated = []
            for row in rows:
                if self._matches(row):
                    row.update(self.payload or {})
                    updated.append(dict(row))
            self.db.operations.append(("update", self.table_name, dict(self.payload or {}), list(self.filters)))
            return _Resp(data=updated)
        if self.op == "upsert":
            payload = self.payload or {}
            if isinstance(payload, list):
                self.db.tables[self.table_name].extend([dict(p) for p in payload])
                data = [dict(p) for p in payload]
            else:
                self.db.tables[self.table_name].append(dict(payload))
                data = [dict(payload)]
            self.db.operations.append(("upsert", self.table_name, dict(payload) if isinstance(payload, dict) else {}, list(self.filters)))
            return _Resp(data=data)
        return _Resp(data=[])


class _FakeSB:
    def __init__(self, tables=None):
        self.tables = tables or {}
        self.operations = []

    def table(self, table_name):
        return _TableQuery(self, table_name, "select")


def _install_import_stubs(monkeypatch):
    # fastapi + pydantic stubs so tests do not require optional runtime deps.
    fastapi_mod = types.ModuleType("fastapi")

    class _HTTPException(Exception):
        def __init__(self, status_code=500, detail=None, headers=None):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail
            self.headers = headers or {}

    class _APIRouter:
        def _decorator(self, *_args, **_kwargs):
            def wrapped(fn):
                return fn

            return wrapped

        get = post = put = patch = delete = _decorator

    fastapi_mod.APIRouter = _APIRouter
    fastapi_mod.Depends = lambda x=None: x
    fastapi_mod.HTTPException = _HTTPException
    fastapi_mod.Request = object
    fastapi_mod.Form = lambda default=None: default
    fastapi_mod.Query = lambda default=None, **_kwargs: default
    monkeypatch.setitem(sys.modules, "fastapi", fastapi_mod)

    fastapi_responses_mod = types.ModuleType("fastapi.responses")

    class _JSONResponse(dict):
        def __init__(self, content=None, status_code=200):
            super().__init__(content or {})
            self.status_code = status_code

    fastapi_responses_mod.JSONResponse = _JSONResponse
    monkeypatch.setitem(sys.modules, "fastapi.responses", fastapi_responses_mod)

    pydantic_mod = types.ModuleType("pydantic")

    class _BaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)

    pydantic_mod.BaseModel = _BaseModel
    monkeypatch.setitem(sys.modules, "pydantic", pydantic_mod)

    deps_mod = types.ModuleType("routes.deps")
    deps_mod.get_current_user = lambda: {"id": "u-1"}
    deps_mod.get_current_user_from_request = lambda *_a, **_k: {"id": "u-1"}
    deps_mod.get_sb = lambda: None
    deps_mod.OPENAI_KEY = ""
    deps_mod.AI_MODEL = ""
    deps_mod.cognitive_core = types.SimpleNamespace(get_context_for_agent=lambda *_a, **_k: {}, observe=lambda *_a, **_k: None)
    deps_mod.logger = types.SimpleNamespace(info=lambda *_a, **_k: None, warning=lambda *_a, **_k: None, error=lambda *_a, **_k: None)
    monkeypatch.setitem(sys.modules, "routes.deps", deps_mod)

    supabase_client_mod = types.ModuleType("supabase_client")
    supabase_client_mod.safe_query_single = lambda *_a, **_k: types.SimpleNamespace(data=None)
    monkeypatch.setitem(sys.modules, "supabase_client", supabase_client_mod)

    auth_supabase_mod = types.ModuleType("auth_supabase")
    auth_supabase_mod.get_user_by_id = lambda *_a, **_k: {}
    monkeypatch.setitem(sys.modules, "auth_supabase", auth_supabase_mod)

    supabase_intel_mod = types.ModuleType("supabase_intelligence_helpers")
    supabase_intel_mod.get_business_profile_supabase = lambda *_a, **_k: {}
    monkeypatch.setitem(sys.modules, "supabase_intelligence_helpers", supabase_intel_mod)

    intel_truth_mod = types.ModuleType("intelligence_live_truth")
    intel_truth_mod.email_row_is_connected = lambda *_a, **_k: False
    intel_truth_mod.get_connector_truth_summary = lambda *_a, **_k: {}
    intel_truth_mod.get_live_integration_truth = lambda *_a, **_k: {"integrations": [], "connector_truth": {}, "canonical_truth": {}}
    intel_truth_mod.get_recent_observation_events = lambda *_a, **_k: {"count": 0, "last_signal_at": None, "events": []}
    intel_truth_mod.build_watchtower_events = lambda *_a, **_k: []
    intel_truth_mod.merge_row_is_connected = lambda row: bool(row.get("account_token"))
    intel_truth_mod.normalize_category = lambda c, *_a, **_k: c or "crm"
    monkeypatch.setitem(sys.modules, "intelligence_live_truth", intel_truth_mod)

    drive_mod = types.ModuleType("supabase_drive_helpers")
    drive_mod.store_merge_integration = lambda *_a, **_k: True
    drive_mod.get_user_merge_integrations = lambda *_a, **_k: []
    drive_mod.get_merge_integration_by_token = lambda *_a, **_k: None
    drive_mod.update_merge_integration_sync = lambda *_a, **_k: True
    drive_mod.store_drive_file = lambda *_a, **_k: True
    drive_mod.store_drive_files_batch = lambda *_a, **_k: 0
    drive_mod.get_user_drive_files = lambda *_a, **_k: []
    drive_mod.count_user_drive_files = lambda *_a, **_k: 0
    drive_mod.get_drive_scope_policy = lambda *_a, **_k: {"allow_all_files": True, "folder_ids": []}
    drive_mod.upsert_drive_scope_policy = lambda *_a, **_k: True
    monkeypatch.setitem(sys.modules, "supabase_drive_helpers", drive_mod)

    jobs_mod = types.ModuleType("biqc_jobs")
    jobs_mod.enqueue_job = lambda *_a, **_k: {"queued": False}
    monkeypatch.setitem(sys.modules, "biqc_jobs", jobs_mod)

    cache_mod = types.ModuleType("integration_status_cache")
    cache_mod.get_cached_integration_status = lambda *_a, **_k: None
    cache_mod.set_cached_integration_status = lambda *_a, **_k: None

    async def _async_noop(*_a, **_k):
        return None

    cache_mod.invalidate_cached_integration_status = _async_noop
    monkeypatch.setitem(sys.modules, "integration_status_cache", cache_mod)

    tier_mod = types.ModuleType("tier_resolver")
    tier_mod.resolve_tier = lambda *_a, **_k: "starter"
    monkeypatch.setitem(sys.modules, "tier_resolver", tier_mod)


def _import_integrations(monkeypatch):
    _install_import_stubs(monkeypatch)
    if "routes.integrations" in sys.modules:
        del sys.modules["routes.integrations"]
    return importlib.import_module("routes.integrations")


def test_drive_disconnect_no_missing_column_500(monkeypatch):
    integrations = _import_integrations(monkeypatch)
    fake_sb = _FakeSB(
        tables={
            "merge_integrations": [],
            "google_drive_files": [],
            "data_files": [],
        }
    )
    monkeypatch.setattr(integrations, "get_sb", lambda: fake_sb)

    out = asyncio.run(integrations.google_drive_disconnect(current_user={"id": "u-1"}))
    assert out["ok"] is True
    touched_tables = [entry[1] for entry in fake_sb.operations]
    assert "integration_accounts" not in touched_tables
    assert "data_files" not in touched_tables


def test_drive_disconnect_removes_canonical_rows(monkeypatch):
    integrations = _import_integrations(monkeypatch)
    fake_sb = _FakeSB(
        tables={
            "merge_integrations": [
                {"id": "m1", "user_id": "u-1", "integration_category": "file_storage", "integration_slug": "google_drive", "account_id": "a1", "account_token": "tok-1"},
            ],
            "google_drive_files": [
                {"id": "f1", "user_id": "u-1", "account_id": "a1"},
            ],
            "data_files": [],
        }
    )
    monkeypatch.setattr(integrations, "get_sb", lambda: fake_sb)

    out = asyncio.run(integrations.google_drive_disconnect(current_user={"id": "u-1"}))
    assert out["ok"] is True
    assert fake_sb.tables["merge_integrations"] == []
    assert fake_sb.tables["google_drive_files"] == []
    assert fake_sb.tables["data_files"] == []


def test_drive_status_endpoint_shape(monkeypatch):
    integrations = _import_integrations(monkeypatch)
    fake_sb = _FakeSB()
    monkeypatch.setattr(integrations, "get_sb", lambda: fake_sb)

    async def _fake_get_integrations(_sb, _user_id, integration_category=None):
        assert integration_category == "file_storage"
        return [
            {
                "integration_slug": "google_drive",
                "integration_name": "Google Drive",
                "connected_at": "2026-05-04T00:00:00+00:00",
                "last_sync_at": "2026-05-04T01:00:00+00:00",
                "status": "needs_reconnect",
                "sync_status": "token_expired",
                "error_message": "401 bad api key from provider",
                "end_user_email": "owner@example.com",
            }
        ]

    async def _fake_count(_sb, _uid):
        return 7

    monkeypatch.setitem(sys.modules, "supabase_drive_helpers", types.SimpleNamespace(
        get_user_merge_integrations=_fake_get_integrations,
        count_user_drive_files=_fake_count,
    ))

    out = asyncio.run(integrations.google_drive_status(current_user={"id": "u-1"}))
    assert out["connected"] is True
    for key in ("status", "sync_status", "last_sync_at", "connected_at", "files_count", "reconnect_required", "error_message", "account_label"):
        assert key in out
    assert "401" not in str(out.get("error_message", ""))


def test_file_storage_health_check_uses_filestorage_endpoint(monkeypatch):
    import jobs.merge_health_check as health

    calls = []

    class _FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

        async def get(self, url, headers=None):
            calls.append(url)
            return types.SimpleNamespace(status_code=200)

    fake_sb = _FakeSB(
        tables={
            "integration_accounts": [
                {"id": "i1", "user_id": "u-1", "provider": "x", "category": "file_storage", "account_token": "tok"},
            ],
            "merge_integrations": [],
        }
    )

    monkeypatch.setitem(sys.modules, "httpx", types.SimpleNamespace(AsyncClient=lambda **_kwargs: _FakeClient()))
    result = asyncio.run(health.run_merge_health_check(fake_sb, merge_api_key="k"))
    assert result["checked"] == 1
    assert any("/filestorage/v1/files?page_size=1" in url for url in calls)


def test_drive_sync_failure_persists_safe_failed_state(monkeypatch):
    integrations = _import_integrations(monkeypatch)

    updates = []

    async def _fake_update(_sb, _token, payload):
        updates.append(payload)
        return True

    async def _fake_scope(_sb, _uid):
        return {"allow_all_files": True, "folder_ids": []}

    async def _fake_store(*_a, **_k):
        return 0

    class _MergeClient:
        async def get_files(self, _token):
            raise RuntimeError("google 401 bad api key")

    monkeypatch.setitem(sys.modules, "merge_client", types.SimpleNamespace(get_merge_client=lambda: _MergeClient()))
    monkeypatch.setitem(
        sys.modules,
        "supabase_drive_helpers",
        types.SimpleNamespace(
            update_merge_integration_sync=_fake_update,
            get_drive_scope_policy=_fake_scope,
            store_drive_files_batch=_fake_store,
        ),
    )
    monkeypatch.setattr(integrations, "get_sb", lambda: _FakeSB())

    asyncio.run(integrations.sync_google_drive_files("u-1", "a-1", "tok"))
    assert updates, "expected sync state updates"
    failure_payloads = [u for u in updates if u.get("status") == "failed"]
    assert failure_payloads, "expected failed payload"
    msg = failure_payloads[-1].get("error_message", "")
    assert "401" not in msg.lower()
    assert "google" not in msg.lower()


def test_soundboard_source_includes_file_storage_presence():
    soundboard_path = os.path.join(BACKEND_DIR, "routes", "soundboard.py")
    with open(soundboard_path, "r", encoding="utf-8") as fh:
        content = fh.read()
    assert '"file_storage": has_file_storage' in content
    assert '("file_storage", has_file_storage)' in content
