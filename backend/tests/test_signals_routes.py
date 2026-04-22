"""
Unit tests for backend/routes/signals.py — Sprint B #17 (2026-04-22).

Scope: Pydantic validation + route handler logic via a fake Supabase client.
We do NOT hit the real DB here — the migration's CHECK constraint is already
proved in the post-deploy verification SQL block (see 122_signal_snooze_and_feedback.sql).

This test stubs out `supabase_client` and `routes.auth` at import time via
sys.modules so it runs on Python 3.9+ even though `supabase_client.py` itself
uses Python 3.10+ syntax. CI runs on 3.11 where the full import chain works.

Run: pytest backend/tests/test_signals_routes.py -v
"""
from __future__ import annotations

import sys
import types
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# ─── Stub modules BEFORE the signals router imports them ─────────────────────
# Order matters: we have to stub supabase_client + routes.auth first, then
# `from routes.signals import router` completes cleanly on any Python.

class _FakeTableOp:
    def __init__(self, parent: "_FakeSupabase", table: str):
        self._p = parent
        self._table = table
        self._op: str = ""
        self._payload: Any = None
        self._eq_filters: List[tuple] = []
        self._on_conflict: Optional[str] = None

    def insert(self, payload):
        self._op, self._payload = "insert", payload
        return self

    def upsert(self, payload, on_conflict: Optional[str] = None):
        self._op, self._payload = "upsert", payload
        self._on_conflict = on_conflict
        return self

    def delete(self):
        self._op = "delete"
        return self

    def eq(self, k, v):
        self._eq_filters.append((k, v))
        return self

    def execute(self):
        call = {
            "table": self._table,
            "op": self._op,
            "payload": self._payload,
            "eq": list(self._eq_filters),
            "on_conflict": self._on_conflict,
        }
        self._p.calls.append(call)
        if self._p.raises_on_insert and self._op in ("insert", "upsert"):
            raise self._p.raises_on_insert

        class _Res:
            pass
        r = _Res()
        r.data = [{**(self._payload if isinstance(self._payload, dict) else {}), "id": "fake-id-1"}]
        return r


class _FakeSupabase:
    def __init__(self, raises_on_insert: Optional[Exception] = None):
        self.calls: List[Dict[str, Any]] = []
        self.raises_on_insert = raises_on_insert

    def table(self, name: str):
        return _FakeTableOp(self, name)


_STATE = {"sb": _FakeSupabase()}

# Stub supabase_client
_stub_supabase_client = types.ModuleType("supabase_client")
_stub_supabase_client.get_supabase_admin = lambda: _STATE["sb"]
sys.modules["supabase_client"] = _stub_supabase_client

# Stub routes.auth — provide a dependency function that returns our test user.
TEST_USER = {"id": "00000000-0000-0000-0000-000000000001", "email": "tester@example.com"}

_stub_routes_auth = types.ModuleType("routes.auth")
def _fake_get_current_user():
    return TEST_USER
_stub_routes_auth.get_current_user = _fake_get_current_user
# routes package must exist as a package before we register submodules
_routes_pkg = types.ModuleType("routes")
_routes_pkg.__path__ = [str(ROOT / "routes")]
sys.modules["routes"] = _routes_pkg
sys.modules["routes.auth"] = _stub_routes_auth

# Now we can import the real module.
from routes import signals as signals_module  # noqa: E402

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


# ─── Fixture ─────────────────────────────────────────────────────────────────

@pytest.fixture
def app_with_supabase():
    _STATE["sb"] = _FakeSupabase()
    app = FastAPI()
    app.include_router(signals_module.router)
    yield app, _STATE


# ─── Tests ───────────────────────────────────────────────────────────────────

def test_taxonomy_returns_all_four_keys(app_with_supabase):
    app, _ = app_with_supabase
    client = TestClient(app)
    res = client.get("/signals/feedback/taxonomy")
    assert res.status_code == 200
    keys = [t["key"] for t in res.json()["taxonomy"]]
    assert keys == ["not_relevant", "already_done", "incorrect", "need_more_info"]


def test_taxonomy_includes_priority_weights(app_with_supabase):
    app, _ = app_with_supabase
    client = TestClient(app)
    res = client.get("/signals/feedback/taxonomy").json()
    by_key = {t["key"]: t for t in res["taxonomy"]}
    for key, entry in by_key.items():
        assert "priority_weight" in entry, f"missing weight for {key}"
        assert "label" in entry and entry["label"]
        assert "help" in entry and entry["help"]


def test_snooze_happy_path(app_with_supabase):
    app, state = app_with_supabase
    client = TestClient(app)
    until = (datetime.now(timezone.utc) + timedelta(hours=4)).isoformat()
    res = client.post(
        f"/signals/{TEST_USER['id']}/snooze",
        json={"until": until, "source_surface": "advisor"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["ok"] is True
    calls = state["sb"].calls
    assert len(calls) == 1
    assert calls[0]["table"] == "signal_snoozes"
    assert calls[0]["op"] == "upsert"
    assert calls[0]["on_conflict"] == "user_id,event_id"
    assert calls[0]["payload"]["user_id"] == TEST_USER["id"]
    assert calls[0]["payload"]["source_surface"] == "advisor"


def test_snooze_rejects_past_timestamp(app_with_supabase):
    app, _ = app_with_supabase
    client = TestClient(app)
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    res = client.post(
        f"/signals/{TEST_USER['id']}/snooze",
        json={"until": past},
    )
    assert res.status_code == 422, res.text
    assert "future" in res.text.lower()


def test_snooze_rejects_missing_until(app_with_supabase):
    app, _ = app_with_supabase
    client = TestClient(app)
    res = client.post(f"/signals/{TEST_USER['id']}/snooze", json={})
    assert res.status_code == 422


def test_snooze_fk_violation_returns_404(app_with_supabase):
    app, state = app_with_supabase
    state["sb"].raises_on_insert = Exception("violates foreign key constraint on observation_events")
    client = TestClient(app)
    until = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    res = client.post(f"/signals/non-existent-event/snooze", json={"until": until})
    assert res.status_code == 404
    assert "observation event" in res.json()["detail"].lower()


def test_unsnooze_sends_delete(app_with_supabase):
    app, state = app_with_supabase
    client = TestClient(app)
    res = client.delete(f"/signals/abc123/snooze")
    assert res.status_code == 200
    call = state["sb"].calls[0]
    assert call["op"] == "delete"
    assert call["table"] == "signal_snoozes"
    assert ("user_id", TEST_USER["id"]) in call["eq"]
    assert ("event_id", "abc123") in call["eq"]


def test_feedback_happy_path_all_four_keys(app_with_supabase):
    app, state = app_with_supabase
    client = TestClient(app)
    for key in ["not_relevant", "already_done", "incorrect", "need_more_info"]:
        state["sb"].calls.clear()
        res = client.post(
            f"/signals/evt-1/feedback",
            json={"feedback_key": key, "note": f"via {key}"},
        )
        assert res.status_code == 200, f"{key} failed: {res.text}"
        assert state["sb"].calls[0]["payload"]["feedback_key"] == key


def test_feedback_rejects_unknown_key_via_pydantic(app_with_supabase):
    app, _ = app_with_supabase
    client = TestClient(app)
    res = client.post(
        "/signals/evt-1/feedback",
        json={"feedback_key": "made_up_bucket"},
    )
    assert res.status_code == 422
    assert "feedback_key" in res.text


def test_feedback_rejects_oversized_note(app_with_supabase):
    app, _ = app_with_supabase
    client = TestClient(app)
    res = client.post(
        "/signals/evt-1/feedback",
        json={"feedback_key": "not_relevant", "note": "x" * 1001},
    )
    assert res.status_code == 422


def test_feedback_fk_violation_returns_404(app_with_supabase):
    app, state = app_with_supabase
    state["sb"].raises_on_insert = Exception("violates foreign key constraint")
    client = TestClient(app)
    res = client.post(
        "/signals/evt-missing/feedback",
        json={"feedback_key": "not_relevant"},
    )
    assert res.status_code == 404


def test_feedback_db_check_violation_returns_400(app_with_supabase):
    app, state = app_with_supabase
    state["sb"].raises_on_insert = Exception(
        "new row violates check constraint signal_feedback_key_allowed"
    )
    client = TestClient(app)
    res = client.post(
        "/signals/evt-1/feedback",
        json={"feedback_key": "not_relevant"},
    )
    assert res.status_code == 400
    assert "unsupported feedback_key" in res.json()["detail"].lower()
