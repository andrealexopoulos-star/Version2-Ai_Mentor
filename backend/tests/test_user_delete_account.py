"""
Tests for the confirmed hard-delete endpoint (Sprint C #22).

Covers:
  - DELETE /user/account REQUIRES confirm_phrase = "DELETE MY ACCOUNT" exactly
  - Wrong phrase → 400, no DB writes occur
  - Missing body → 422 (Pydantic)
  - Happy path: writes is_disabled=true + deletion_requested_at, returns hard_delete_after
  - POST /user/account/undo-delete clears deletion_requested_at + is_disabled

Uses sys.modules stubbing (same pattern as test_user_export.py) so tests run
on Python 3.9 locally. CI is 3.11 where the real import chain works.
"""
from __future__ import annotations

import sys
import types
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# ─── Fake Supabase (records all table ops) ──────────────────────────────────

class _FakeTableOp:
    def __init__(self, parent: "_FakeSupabase", table: str):
        self._p = parent
        self._table = table
        self._payload: Any = None
        self._eq: List[tuple] = []

    def update(self, payload):
        self._payload = payload
        return self

    def eq(self, k, v):
        self._eq.append((k, v))
        return self

    def execute(self):
        if self._p.raises_on.get(self._table):
            raise self._p.raises_on[self._table]
        self._p.ops.append({
            "table": self._table,
            "payload": self._payload,
            "eq": list(self._eq),
        })
        class _Res:
            pass
        r = _Res()
        r.data = [{"id": (dict(self._eq).get("id") or dict(self._eq).get("user_id"))}]
        return r


class _FakeSupabase:
    def __init__(self, raises_on: Optional[Dict[str, Exception]] = None):
        self.ops: List[Dict[str, Any]] = []
        self.raises_on = raises_on or {}

    def table(self, name: str):
        return _FakeTableOp(self, name)


TEST_USER = {"id": "00000000-0000-0000-0000-000000000001", "email": "tester@example.com"}
_STATE: Dict[str, Any] = {"sb": _FakeSupabase()}

# Stub supabase_client + routes.deps
_stub_sc = types.ModuleType("supabase_client")
_stub_sc.get_supabase_admin = lambda: _STATE["sb"]
_stub_sc.get_supabase_client = lambda: _STATE["sb"]
_stub_sc.init_supabase = lambda: None
sys.modules["supabase_client"] = _stub_sc

_stub_deps = types.ModuleType("routes.deps")
_stub_deps.get_current_user = lambda: TEST_USER
_stub_deps.get_sb = lambda: _STATE["sb"]
_routes_pkg = types.ModuleType("routes")
_routes_pkg.__path__ = [str(ROOT / "routes")]
sys.modules["routes"] = _routes_pkg
sys.modules["routes.deps"] = _stub_deps

from routes import user_settings as us  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


def _client():
    _STATE["sb"] = _FakeSupabase()
    app = FastAPI()
    app.include_router(us.router)
    return TestClient(app), _STATE["sb"]


# ─── DELETE /user/account ──────────────────────────────────────────────────

def test_delete_requires_confirm_phrase_body():
    client, _ = _client()
    res = client.delete("/user/account")
    assert res.status_code == 422  # Pydantic missing body


def test_delete_rejects_wrong_phrase():
    client, sb = _client()
    res = client.request("DELETE", "/user/account", json={"confirm_phrase": "delete my account"})  # lower
    assert res.status_code == 400
    assert "DELETE MY ACCOUNT" in res.json()["detail"]
    # No DB writes occurred
    assert sb.ops == []


def test_delete_rejects_typo_phrase():
    client, sb = _client()
    res = client.request("DELETE", "/user/account", json={"confirm_phrase": "DELETE MY ACCOUNTS"})  # extra s
    assert res.status_code == 400
    assert sb.ops == []


def test_delete_happy_path():
    client, sb = _client()
    res = client.request("DELETE", "/user/account", json={"confirm_phrase": "DELETE MY ACCOUNT"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "account_scheduled_for_deletion"
    assert body["retention_days"] == 30
    assert "deletion_requested_at" in body
    # hard_delete_after is approx now + 30d
    hda = datetime.fromisoformat(body["hard_delete_after"].replace("Z", "+00:00"))
    delta_days = (hda - datetime.now(timezone.utc)).total_seconds() / 86400
    assert 29.9 < delta_days < 30.1
    # Undo endpoint hint present
    assert body.get("undo_endpoint") == "/user/account/undo-delete"
    # DB writes
    tables_touched = {op["table"] for op in sb.ops}
    assert "users" in tables_touched
    assert "business_profiles" in tables_touched
    assert "merge_integrations" in tables_touched
    # Users update sets the correct flags
    users_op = next(o for o in sb.ops if o["table"] == "users")
    assert users_op["payload"]["is_disabled"] is True
    assert "deletion_requested_at" in users_op["payload"]
    assert ("id", TEST_USER["id"]) in users_op["eq"]


def test_delete_strips_whitespace_around_phrase():
    client, _ = _client()
    res = client.request("DELETE", "/user/account", json={"confirm_phrase": "  DELETE MY ACCOUNT  "})
    assert res.status_code == 200


def test_delete_is_resilient_to_individual_table_failure():
    """If business_profiles update throws, users + merge_integrations still write."""
    _STATE["sb"] = _FakeSupabase(raises_on={"business_profiles": RuntimeError("boom")})
    app = FastAPI()
    app.include_router(us.router)
    client = TestClient(app)
    res = client.request("DELETE", "/user/account", json={"confirm_phrase": "DELETE MY ACCOUNT"})
    assert res.status_code == 200
    # users + merge_integrations still got written
    tables_touched = {op["table"] for op in _STATE["sb"].ops}
    assert "users" in tables_touched
    assert "merge_integrations" in tables_touched
    assert "business_profiles" not in tables_touched  # the one that raised


# ─── POST /user/account/undo-delete ────────────────────────────────────────

def test_undo_delete_clears_flags():
    client, sb = _client()
    res = client.post("/user/account/undo-delete")
    assert res.status_code == 200
    assert res.json()["status"] == "account_restored"
    users_op = next(o for o in sb.ops if o["table"] == "users")
    assert users_op["payload"]["is_disabled"] is False
    assert users_op["payload"]["deletion_requested_at"] is None
    assert ("id", TEST_USER["id"]) in users_op["eq"]


def test_undo_delete_is_idempotent():
    """Even if the account was never marked for deletion, POST returns 200."""
    client, _ = _client()
    for _ in range(3):
        res = client.post("/user/account/undo-delete")
        assert res.status_code == 200
