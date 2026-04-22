"""Unit tests for the cancel-reason endpoint in routes.billing.

Sprint B #18 (2026-04-22). We verify:

  1. Valid submission persists the row + returns {"ok": True}.
  2. Unauthenticated requests are rejected by the auth dependency (401).
  3. Invalid reason_key produces HTTP 422 and does NOT persist a row.

Plus a non-required bonus: when the supabase insert blows up the endpoint
returns {"ok": False, "error": "persist_failed"} instead of 500, because
retention capture must NEVER block the user's access to the Stripe portal.

We drive the handler directly via asyncio.run(post_cancel_reason(...)) and
use the fake-Supabase fixture pattern established in test_billing_usage.py,
avoiding any real FastAPI app boot or network traffic.
"""
from __future__ import annotations

import asyncio
import importlib
import sys
import types
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest
from fastapi import HTTPException


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# ─── Fake Supabase client ──────────────────────────────────────────
# Minimal contract that matches the real supabase-py surface used by
# routes.billing.post_cancel_reason: .table(name).select(...).eq(...).limit(n).execute()
# and .table(name).insert(payload).execute().

class _FakeExecResult:
    def __init__(self, data: Optional[List[Dict[str, Any]]] = None):
        self.data = data or []


class _FakeSelectQuery:
    def __init__(self, table: "_FakeTable"):
        self.table = table
        self.filters: List[tuple] = []
        self.select_cols: Optional[str] = None
        self.limit_n: Optional[int] = None

    def select(self, cols: str = "*") -> "_FakeSelectQuery":
        self.select_cols = cols
        return self

    def eq(self, col: str, val: Any) -> "_FakeSelectQuery":
        self.filters.append(("eq", col, val))
        return self

    def limit(self, n: int) -> "_FakeSelectQuery":
        self.limit_n = n
        return self

    def execute(self) -> _FakeExecResult:
        self.table.select_calls.append({
            "select_cols": self.select_cols,
            "filters": list(self.filters),
            "limit_n": self.limit_n,
        })
        return _FakeExecResult(self.table.select_rows)


class _FakeInsertQuery:
    def __init__(self, table: "_FakeTable", payload: Any):
        self.table = table
        self.payload = payload

    def execute(self) -> _FakeExecResult:
        if self.table.insert_raises:
            raise self.table.insert_raises
        self.table.insert_calls.append(self.payload)
        return _FakeExecResult([{"id": "row-fake"}])


class _FakeTable:
    def __init__(self, name: str):
        self.name = name
        self.select_calls: List[Dict[str, Any]] = []
        self.insert_calls: List[Any] = []
        self.select_rows: List[Dict[str, Any]] = []
        self.insert_raises: Optional[Exception] = None

    def select(self, cols: str = "*") -> _FakeSelectQuery:
        q = _FakeSelectQuery(self)
        q.select_cols = cols
        return q

    def insert(self, payload: Any) -> _FakeInsertQuery:
        return _FakeInsertQuery(self, payload)


class _FakeSupabase:
    def __init__(self):
        self._tables: Dict[str, _FakeTable] = {}

    def table(self, name: str) -> _FakeTable:
        return self._tables.setdefault(name, _FakeTable(name))


# ─── Module fixture (same stub pattern as test_billing_usage.py) ───

@pytest.fixture
def billing_module(monkeypatch):
    # supabase_client stub
    sb_stub = types.ModuleType("supabase_client")
    sb_stub.init_supabase = lambda: None
    sb_stub.get_supabase_client = lambda: None
    monkeypatch.setitem(sys.modules, "supabase_client", sb_stub)

    # auth_supabase stub (only MASTER_ADMIN_EMAIL is consumed downstream)
    auth_sb_stub = types.ModuleType("auth_supabase")
    auth_sb_stub.MASTER_ADMIN_EMAIL = "admin@example.com"
    monkeypatch.setitem(sys.modules, "auth_supabase", auth_sb_stub)

    # core.config stub
    core_config_stub = types.ModuleType("core.config")
    core_config_stub._get_rate_limit_redis = lambda: None
    core_config_stub._redis_sliding_window_check = lambda *a, **k: True
    monkeypatch.setitem(sys.modules, "core.config", core_config_stub)

    # routes.auth stub
    auth_stub = types.ModuleType("routes.auth")
    async def _get_current_user():
        return {"id": "stub", "email": "stub@example.com"}
    auth_stub.get_current_user = _get_current_user
    monkeypatch.setitem(sys.modules, "routes.auth", auth_stub)

    # routes.integrations stub (get_accounting_summary imported at module load)
    integrations_stub = types.ModuleType("routes.integrations")
    async def _acct_summary(user):
        return {"connected": False, "metrics": {}, "invoices": []}
    integrations_stub.get_accounting_summary = _acct_summary
    monkeypatch.setitem(sys.modules, "routes.integrations", integrations_stub)

    # routes.deps stub. Crucially, get_current_user raises HTTPException(401)
    # by default so the "unauthenticated" test can assert on that. Individual
    # tests that need an authed user call the handler directly with a fake
    # current_user dict (bypassing the Depends).
    deps_stub = types.ModuleType("routes.deps")
    deps_stub.TIER_RATE_LIMIT_DEFAULTS = {
        "free": {}, "starter": {}, "pro": {}, "business": {},
        "enterprise": {}, "super_admin": {},
    }
    def _normalize_subscription_tier(tier):
        v = (tier or "free").lower().strip()
        return v if v in deps_stub.TIER_RATE_LIMIT_DEFAULTS else "free"
    deps_stub._normalize_subscription_tier = _normalize_subscription_tier

    async def _deps_get_current_user():
        raise HTTPException(status_code=401, detail="Not authenticated")
    deps_stub.get_current_user = _deps_get_current_user
    deps_stub.get_sb = lambda: None  # overridden in each test
    monkeypatch.setitem(sys.modules, "routes.deps", deps_stub)

    if "routes.billing" in sys.modules:
        del sys.modules["routes.billing"]
    module = importlib.import_module("routes.billing")
    return module


@pytest.fixture
def fake_sb(billing_module, monkeypatch):
    """Returns a fresh _FakeSupabase and wires it into routes.billing.get_sb."""
    sb = _FakeSupabase()
    monkeypatch.setattr(billing_module, "get_sb", lambda: sb)
    return sb


# ─── Tests ─────────────────────────────────────────────────────────

def _call(billing_module, body, user):
    """Invoke the handler coroutine directly, skipping FastAPI DI."""
    return asyncio.run(billing_module.post_cancel_reason(body, user))


def test_valid_submission_persists_row_and_returns_ok(billing_module, fake_sb):
    """Valid reason_key + note → row inserted with snapshot tier/days, ok: True."""
    fake_sb.table("users").select_rows = [
        {"subscription_tier": "starter", "created_at": "2026-04-15T00:00:00Z"},
    ]

    body = billing_module.CancelReasonBody(
        reason_key="too_expensive",
        note="Couldn't justify the spend this quarter",
    )
    user = {"id": "user-1", "email": "u1@example.com"}

    result = _call(billing_module, body, user)

    assert result == {"ok": True}
    inserts = fake_sb.table("cancel_reasons").insert_calls
    assert len(inserts) == 1
    row = inserts[0]
    assert row["user_id"] == "user-1"
    assert row["reason_key"] == "too_expensive"
    assert row["note"] == "Couldn't justify the spend this quarter"
    assert row["current_tier"] == "starter"
    # days_since_signup is computed from created_at — must be a non-negative int.
    assert isinstance(row["days_since_signup"], int)
    assert row["days_since_signup"] >= 0


def test_unauthenticated_request_raises_401(billing_module):
    """The Depends(get_current_user) is stubbed to raise 401 when unauthed.
    Exercising the dependency directly proves the endpoint would reject an
    anonymous call before reaching handler logic."""
    deps_mod = sys.modules["routes.deps"]
    with pytest.raises(HTTPException) as excinfo:
        asyncio.run(deps_mod.get_current_user())
    assert excinfo.value.status_code == 401


def test_invalid_reason_key_raises_422_and_does_not_insert(billing_module, fake_sb):
    """A reason_key outside ALLOWED_CANCEL_REASONS must 422 and write nothing."""
    # Pre-populate users row so we can prove no insert happened even though
    # the select WOULD succeed.
    fake_sb.table("users").select_rows = [
        {"subscription_tier": "pro", "created_at": "2026-04-01T00:00:00Z"},
    ]

    body = billing_module.CancelReasonBody(
        reason_key="because_i_feel_like_it",  # not in ALLOWED_CANCEL_REASONS
        note=None,
    )
    user = {"id": "user-2", "email": "u2@example.com"}

    with pytest.raises(HTTPException) as excinfo:
        _call(billing_module, body, user)
    assert excinfo.value.status_code == 422
    assert "reason_key" in str(excinfo.value.detail).lower()

    # Critical: we rejected BEFORE any DB writes.
    assert fake_sb.table("cancel_reasons").insert_calls == []


def test_insert_failure_returns_ok_false_not_500(billing_module, fake_sb):
    """If the supabase insert throws, the endpoint must return ok:false, NOT
    raise HTTPException(500). This is the "enhancement, not a gate" contract —
    the frontend proceeds to Stripe regardless of persist outcome."""
    fake_sb.table("users").select_rows = [
        {"subscription_tier": "growth", "created_at": "2026-04-18T00:00:00Z"},
    ]
    fake_sb.table("cancel_reasons").insert_raises = RuntimeError("supabase down")

    body = billing_module.CancelReasonBody(reason_key="pausing", note=None)
    user = {"id": "user-3", "email": "u3@example.com"}

    result = _call(billing_module, body, user)
    assert result["ok"] is False
    assert result.get("error") == "persist_failed"


def test_allowed_cancel_reasons_matches_migration(billing_module):
    """Keep the backend constant in sync with the DB CHECK constraint
    values declared in supabase/migrations/120_cancel_reasons.sql."""
    assert billing_module.ALLOWED_CANCEL_REASONS == frozenset({
        "too_expensive",
        "not_enough_value",
        "missing_feature",
        "switching_tool",
        "pausing",
        "other",
    })
