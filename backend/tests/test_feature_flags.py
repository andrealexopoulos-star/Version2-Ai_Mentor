"""
Tests for the feature-flag kill-switch endpoints (Sprint D #28c).

Covers:
  - GET /super-admin/feature-flags lists all flags
  - PATCH /super-admin/feature-flags/{key} flips the boolean + stamps updated_at
  - 400 when flag_key is malformed
  - 404 when flag_key doesn't exist
  - 403 when caller is not super_admin
  - admin_actions audit insert is best-effort (non-fatal if the audit table fails)
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


# ─── Fakes ────────────────────────────────────────────────────────────────

class _FakeTableOp:
    def __init__(self, parent: "_FakeSupabase", table: str):
        self._p = parent
        self._table = table
        self._op = ""
        self._payload: Any = None
        self._eq: List[tuple] = []
        self._order: Optional[str] = None

    def select(self, *_a): self._op = "select"; return self
    def insert(self, payload): self._op, self._payload = "insert", payload; return self
    def update(self, payload): self._op, self._payload = "update", payload; return self
    def eq(self, k, v): self._eq.append((k, v)); return self
    def order(self, col): self._order = col; return self

    def execute(self):
        if self._p.raises_on.get(self._table):
            raise self._p.raises_on[self._table]
        self._p.ops.append({"table": self._table, "op": self._op, "payload": self._payload, "eq": list(self._eq)})
        class _Res:
            pass
        r = _Res()
        if self._op == "select":
            r.data = self._p.data.get(self._table, [])
        elif self._op == "update":
            # Simulate "no rows matched" when the flag_key doesn't exist
            key_match = dict(self._eq).get("flag_key")
            existing = [f for f in self._p.data.get(self._table, []) if f["flag_key"] == key_match]
            r.data = existing  # empty if the flag isn't in the seed
        else:
            r.data = [{"id": "fake-audit-id"}]
        return r


class _FakeSupabase:
    def __init__(self, data=None, raises_on=None):
        self.data = data or {}
        self.raises_on = raises_on or {}
        self.ops: List[Dict[str, Any]] = []

    def table(self, name: str):
        return _FakeTableOp(self, name)


SUPER_USER = {"id": "11111111-1111-1111-1111-111111111111", "email": "andre@thestrategysquad.com.au", "role": "super_admin"}
REGULAR_USER = {"id": "22222222-2222-2222-2222-222222222222", "email": "nobody@example.com", "role": "user"}

_STATE: Dict[str, Any] = {"sb": _FakeSupabase(), "current": SUPER_USER}

# Stub dependencies before importing the router.
_stub_sc = types.ModuleType("supabase_client")
_stub_sc.get_supabase_admin = lambda: _STATE["sb"]
_stub_sc.get_supabase_client = lambda: _STATE["sb"]
_stub_sc.init_supabase = lambda: _STATE["sb"]
sys.modules["supabase_client"] = _stub_sc

# routes.auth and routes.deps both reused by super_admin.py
_routes_pkg = types.ModuleType("routes")
_routes_pkg.__path__ = [str(ROOT / "routes")]
sys.modules["routes"] = _routes_pkg

_stub_auth = types.ModuleType("routes.auth")
_stub_auth.get_current_user = lambda: _STATE["current"]
sys.modules["routes.auth"] = _stub_auth

_stub_deps = types.ModuleType("routes.deps")
_stub_deps.get_current_user = lambda: _STATE["current"]
_stub_deps.get_sb = lambda: _STATE["sb"]
sys.modules["routes.deps"] = _stub_deps

# tier_resolver — super_admin.py calls resolve_tier(current_user)
_stub_tier = types.ModuleType("tier_resolver")
_stub_tier.resolve_tier = lambda u: "super_admin" if (u or {}).get("email") == SUPER_USER["email"] else "pro"
sys.modules["tier_resolver"] = _stub_tier

# intelligence_spine — super_admin.py calls _get_cached_flag
_stub_spine = types.ModuleType("intelligence_spine")
_stub_spine._get_cached_flag = lambda k: True
sys.modules["intelligence_spine"] = _stub_spine

from routes import super_admin as sa  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


def _client(flags=None, raises_on=None, current=SUPER_USER):
    seed = [
        {"flag_key": "trinity_synthesis_enabled", "enabled": True, "description": "Trinity", "updated_at": "2026-04-22T05:00:00Z", "updated_by": None},
        {"flag_key": "new_user_signup_enabled", "enabled": True, "description": "Signups", "updated_at": "2026-04-22T05:00:00Z", "updated_by": None},
    ]
    _STATE["sb"] = _FakeSupabase(data={"feature_flags": flags or seed}, raises_on=raises_on or {})
    _STATE["current"] = current
    app = FastAPI()
    app.include_router(sa.router)
    return TestClient(app), _STATE["sb"]


# ─── Tests ────────────────────────────────────────────────────────────────

def test_list_requires_super_admin():
    client, _ = _client(current=REGULAR_USER)
    res = client.get("/super-admin/feature-flags")
    assert res.status_code == 403


def test_list_returns_seeded_flags():
    client, _ = _client()
    res = client.get("/super-admin/feature-flags")
    assert res.status_code == 200
    body = res.json()
    assert body["count"] == 2
    keys = [f["flag_key"] for f in body["flags"]]
    assert "trinity_synthesis_enabled" in keys
    assert "new_user_signup_enabled" in keys


def test_toggle_requires_super_admin():
    client, _ = _client(current=REGULAR_USER)
    res = client.patch("/super-admin/feature-flags/trinity_synthesis_enabled", json={"enabled": False})
    assert res.status_code == 403


def test_toggle_happy_path_turns_off():
    client, sb = _client()
    res = client.patch("/super-admin/feature-flags/trinity_synthesis_enabled", json={"enabled": False})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["flag_key"] == "trinity_synthesis_enabled"
    assert body["enabled"] is False
    # DB writes: feature_flags UPDATE + admin_actions INSERT
    tables = [op["table"] for op in sb.ops]
    assert "feature_flags" in tables
    assert "admin_actions" in tables
    # The feature_flags UPDATE payload contains both enabled + updated_by
    ff_op = next(op for op in sb.ops if op["table"] == "feature_flags")
    assert ff_op["payload"]["enabled"] is False
    assert ff_op["payload"]["updated_by"] == SUPER_USER["id"]
    assert "updated_at" in ff_op["payload"]
    assert ("flag_key", "trinity_synthesis_enabled") in ff_op["eq"]


def test_toggle_back_on():
    client, _ = _client(flags=[
        {"flag_key": "trinity_synthesis_enabled", "enabled": False, "description": "x", "updated_at": "x", "updated_by": None},
    ])
    res = client.patch("/super-admin/feature-flags/trinity_synthesis_enabled", json={"enabled": True})
    assert res.status_code == 200
    assert res.json()["enabled"] is True


def test_toggle_rejects_invalid_flag_key():
    """Invalid flag keys either fail the handler's own 400 check (bad chars /
    too long) or fail the FastAPI route match altogether (embedded slash →
    404). Both responses prevent the bad input from reaching the DB."""
    client, _ = _client()
    expect_400 = ["has spaces", "has-dash", "x" * 80]  # caught by handler regex
    expect_404 = ["../etc/passwd"]                     # caught by FastAPI routing (has /)
    for bad in expect_400:
        res = client.patch(f"/super-admin/feature-flags/{bad}", json={"enabled": True})
        assert res.status_code == 400, f"{bad}: {res.status_code}"
    for bad in expect_404:
        res = client.patch(f"/super-admin/feature-flags/{bad}", json={"enabled": True})
        assert res.status_code == 404, f"{bad}: {res.status_code}"


def test_toggle_unknown_flag_returns_404():
    # Empty seed → UPDATE matches nothing → 404
    client, _ = _client(flags=[])
    res = client.patch("/super-admin/feature-flags/nonexistent_flag", json={"enabled": False})
    assert res.status_code == 404


def test_audit_table_failure_does_not_block_toggle():
    client, _ = _client(raises_on={"admin_actions": RuntimeError("audit table boom")})
    res = client.patch("/super-admin/feature-flags/trinity_synthesis_enabled", json={"enabled": False})
    # The toggle itself still succeeds — audit insert is best-effort.
    assert res.status_code == 200
    assert res.json()["enabled"] is False
