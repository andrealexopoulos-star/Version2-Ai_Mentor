"""Tests for the hard-delete worker (Sprint C #22 Phase 2).

Covers:
  (a) users with deletion_requested_at < 30 days old are SKIPPED
      (never appear in the candidate filter),
  (b) users older than 30 days with is_disabled=true are PURGED across
      every table in _USER_PURGE_TABLES, plus public.users + auth.users,
  (c) FK / RLS errors on one sub-table do NOT abort the whole purge —
      other tables still get deleted, errors are recorded,
  (d) audit rows are written to admin_actions for each purged user,
  (e) the 10% safety rail aborts the run when the candidate set exceeds
      10% of active users — no deletions, abort audit row is written,
  (f) the sweep handles the no-candidates case with a clean summary.

Uses sys.modules stubbing (same pattern as test_user_delete_account.py
and test_stripe_reconcile.py) so these tests run on Python 3.9 locally;
CI is 3.11 where real imports resolve.
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


# ─── Heavy-import stubs (matches other test files) ─────────────────────

@pytest.fixture(autouse=True)
def _stub_heavy_imports(monkeypatch):
    """supabase_client + routes.deps + services.email_service.

    The worker imports `routes.deps.get_sb` lazily and
    `supabase_client.init_supabase` lazily. We stub both so the module
    imports cleanly on Py 3.9 (real supabase_client uses PEP-604 unions
    in type hints).
    """
    sb_stub = types.ModuleType("supabase_client")
    sb_stub.init_supabase = lambda: None
    sb_stub.get_supabase_admin = lambda: None
    sb_stub.get_supabase_client = lambda: None
    monkeypatch.setitem(sys.modules, "supabase_client", sb_stub)

    deps_stub = types.ModuleType("routes.deps")
    # get_sb default returns None — tests inject their own SB via the
    # run_hard_delete_sweep(sb=...) argument so this fallback rarely fires.
    deps_stub.get_sb = lambda: None
    routes_pkg = sys.modules.get("routes") or types.ModuleType("routes")
    routes_pkg.__path__ = [str(ROOT / "routes")]
    monkeypatch.setitem(sys.modules, "routes", routes_pkg)
    monkeypatch.setitem(sys.modules, "routes.deps", deps_stub)

    # Ensure hard_delete_worker picks up fresh stubs across tests.
    for mod in list(sys.modules.keys()):
        if mod.startswith("jobs.hard_delete_worker") or mod == "jobs.hard_delete_worker":
            del sys.modules[mod]


# ─── Fake Supabase client ──────────────────────────────────────────────

class _AuthAdmin:
    """Stand-in for sb.auth.admin with delete_user()."""

    def __init__(self, parent: "_FakeSupabase"):
        self._p = parent

    def delete_user(self, user_id: str) -> None:
        if self._p.auth_raises_for_user.get(user_id):
            raise self._p.auth_raises_for_user[user_id]
        self._p.auth_deleted_user_ids.append(user_id)


class _AuthNamespace:
    def __init__(self, parent: "_FakeSupabase"):
        self.admin = _AuthAdmin(parent)


class _FakeTableOp:
    """Fluent chain recorder. Captures select/update/delete/insert + filters."""

    def __init__(self, parent: "_FakeSupabase", table: str):
        self._p = parent
        self._table = table
        self._mode: Optional[str] = None       # 'select' | 'update' | 'delete' | 'insert'
        self._payload: Any = None
        self._filters: List[tuple] = []        # list of ('eq'|'lt'|'is_null_not', key, value)
        self._count_mode: Optional[str] = None

    def select(self, *_args, count: Optional[str] = None):
        self._mode = "select"
        self._count_mode = count
        return self

    def insert(self, payload):
        self._mode = "insert"
        self._payload = payload
        return self

    def update(self, payload):
        self._mode = "update"
        self._payload = payload
        return self

    def delete(self):
        self._mode = "delete"
        return self

    def eq(self, k, v):
        self._filters.append(("eq", k, v))
        return self

    def lt(self, k, v):
        self._filters.append(("lt", k, v))
        return self

    # supabase-py `.not_.is_(col, 'null')` — emulate the attr chain.
    @property
    def not_(self):
        outer = self

        class _NotStub:
            def is_(self, col, value):
                outer._filters.append(("not_is", col, value))
                return outer
        return _NotStub()

    def execute(self):
        # Record the op for assertions.
        self._p.ops.append({
            "table": self._table,
            "mode": self._mode,
            "payload": self._payload,
            "filters": list(self._filters),
        })

        # Simulate per-table raises BEFORE returning.
        key = (self._table, self._mode)
        raiser = self._p.raises_on.get(key) or self._p.raises_on.get(self._table)
        if raiser:
            raise raiser

        class _Res:
            pass
        r = _Res()
        r.data = None
        r.count = None

        # select on `users` may serve: candidate fetch (not_is deletion_requested_at null + lt cutoff + eq is_disabled true)
        #                              OR active user count (eq is_disabled False, count='exact')
        if self._table == "users" and self._mode == "select":
            filter_keys = {(op, k): v for op, k, v in self._filters}
            is_candidate_fetch = any(
                op == "not_is" and k == "deletion_requested_at"
                for op, k, v in self._filters
            )
            if is_candidate_fetch:
                r.data = list(self._p.candidate_rows)
                return r
            # Active user count
            r.count = self._p.active_user_count
            r.data = []
            return r

        r.data = []
        return r


class _FakeSupabase:
    def __init__(
        self,
        *,
        candidate_rows: Optional[List[Dict[str, Any]]] = None,
        active_user_count: int = 1000,
        raises_on: Optional[Dict[Any, Exception]] = None,
        auth_raises_for_user: Optional[Dict[str, Exception]] = None,
    ):
        self.candidate_rows = list(candidate_rows or [])
        self.active_user_count = active_user_count
        self.raises_on: Dict[Any, Exception] = raises_on or {}
        self.auth_raises_for_user: Dict[str, Exception] = auth_raises_for_user or {}
        self.ops: List[Dict[str, Any]] = []
        self.auth_deleted_user_ids: List[str] = []
        self.auth = _AuthNamespace(self)

    def table(self, name: str) -> _FakeTableOp:
        return _FakeTableOp(self, name)


# ─── Helpers ───────────────────────────────────────────────────────────

def _old_candidate(user_id: str, email: str = "", days_old: int = 31) -> Dict[str, Any]:
    """Return a row with deletion_requested_at `days_old` days ago."""
    ts = (datetime.now(timezone.utc) - timedelta(days=days_old)).isoformat()
    return {
        "id": user_id,
        "email": email or f"{user_id}@example.com",
        "deletion_requested_at": ts,
        "is_disabled": True,
    }


def _import_worker():
    """Import the worker fresh so each test picks up new stubs."""
    from jobs import hard_delete_worker as hdw  # type: ignore[attr-defined]
    return hdw


# ─── Test: no candidates ───────────────────────────────────────────────

def test_sweep_with_no_candidates_returns_clean_summary():
    import asyncio
    hdw = _import_worker()
    sb = _FakeSupabase(candidate_rows=[], active_user_count=100)

    summary = asyncio.run(hdw.run_hard_delete_sweep(sb=sb))

    assert summary["users_purged"] == 0
    assert summary["users_considered"] == 0
    assert summary["aborted"] is False
    assert summary["errors"] == []
    # Only the candidate select should have run — no deletes, no inserts.
    deletes = [o for o in sb.ops if o["mode"] == "delete"]
    inserts = [o for o in sb.ops if o["mode"] == "insert"]
    assert deletes == []
    assert inserts == []


# ─── Test: candidate < 30 days never appears (filter enforced by SB) ───

def test_filter_sql_excludes_sub_30_day_candidates():
    """The worker relies on the SQL filter to exclude fresh requests.
    This test asserts the filter shape: `not_is(deletion_requested_at,null)
    + lt(deletion_requested_at, cutoff) + eq(is_disabled, True)`. If the
    filter ever relaxes, candidates younger than 30 days could be
    purged — guard against regression.
    """
    import asyncio
    hdw = _import_worker()
    # Zero candidates returned; the assertion is on the filter SHAPE.
    sb = _FakeSupabase(candidate_rows=[], active_user_count=100)

    asyncio.run(hdw.run_hard_delete_sweep(sb=sb))

    select_ops = [o for o in sb.ops if o["table"] == "users" and o["mode"] == "select"]
    assert select_ops, "candidate fetch never ran"
    candidate_op = select_ops[0]
    filter_shape = {(op, k) for op, k, v in candidate_op["filters"]}
    assert ("not_is", "deletion_requested_at") in filter_shape
    assert ("lt", "deletion_requested_at") in filter_shape
    assert ("eq", "is_disabled") in filter_shape
    # Cutoff value must be ~30 days in the past.
    lt_entry = next(
        (v for op, k, v in candidate_op["filters"] if op == "lt" and k == "deletion_requested_at"),
        None,
    )
    assert lt_entry is not None
    cutoff = datetime.fromisoformat(lt_entry.replace("Z", "+00:00"))
    delta = (datetime.now(timezone.utc) - cutoff).total_seconds() / 86400.0
    assert 29.9 < delta < 30.1, f"cutoff not ~30d ago: delta={delta}"


# ─── Test: happy path purge ────────────────────────────────────────────

def test_old_candidate_is_purged_across_tables_and_audited():
    """User 40 days old with is_disabled=true should be purged from
    every table in _USER_PURGE_TABLES, plus public.users + auth.users,
    plus an admin_actions audit row."""
    import asyncio
    hdw = _import_worker()

    user = _old_candidate("user-abc", email="alice@example.com", days_old=40)
    sb = _FakeSupabase(candidate_rows=[user], active_user_count=1000)

    summary = asyncio.run(hdw.run_hard_delete_sweep(sb=sb))

    assert summary["users_purged"] == 1
    assert summary["users_considered"] == 1
    assert summary["aborted"] is False
    assert summary["errors"] == []

    # Every _USER_PURGE_TABLES entry should have a delete op
    # for user_id=user-abc.
    deletes_by_table: Dict[str, Dict[str, Any]] = {}
    for op in sb.ops:
        if op["mode"] == "delete":
            deletes_by_table.setdefault(op["table"], op)
    for table in hdw._USER_PURGE_TABLES:
        assert table in deletes_by_table, f"missing delete for {table}"
        f = deletes_by_table[table]["filters"]
        assert ("eq", "user_id", "user-abc") in f

    # public.users deleted with id=user-abc
    assert "users" in deletes_by_table
    users_filters = deletes_by_table["users"]["filters"]
    assert ("eq", "id", "user-abc") in users_filters

    # auth.users.delete_user called
    assert sb.auth_deleted_user_ids == ["user-abc"]

    # admin_actions audit row written with action_type='hard_delete_completed'
    inserts = [o for o in sb.ops if o["mode"] == "insert" and o["table"] == "admin_actions"]
    assert len(inserts) == 1
    payload = inserts[0]["payload"]
    assert payload["action_type"] == "hard_delete_completed"
    assert payload["target_user_id"] == "user-abc"
    # Table list inside new_value
    assert "users" not in payload["new_value"]["tables_purged"]  # users is deleted separately
    assert "business_profiles" in payload["new_value"]["tables_purged"]
    assert payload["new_value"]["email"] == "alice@example.com"
    assert payload["new_value"]["auth_users_error"] is None


# ─── Test: FK error on one sub-table does not abort the purge ──────────

def test_fk_error_on_one_table_does_not_stop_the_purge():
    """If a FK constraint blocks delete on one table, the worker logs it
    in tables_skipped but continues to purge other tables + public.users
    + auth.users. The audit row reflects the partial state."""
    import asyncio
    hdw = _import_worker()

    user = _old_candidate("user-def", days_old=45)
    sb = _FakeSupabase(
        candidate_rows=[user],
        active_user_count=1000,
        # FK error on documents.delete
        raises_on={("documents", "delete"): RuntimeError("FK violation: workspaces_user_fk")},
    )

    summary = asyncio.run(hdw.run_hard_delete_sweep(sb=sb))

    assert summary["users_purged"] == 1
    assert summary["users_considered"] == 1
    # Top-level errors only surface public/auth failures. A sub-table
    # skip is not a top-level error.
    assert summary["errors"] == []

    # documents should NOT be in tables_affected
    assert "documents" not in summary["tables_affected"]
    # But e.g. business_profiles should
    assert "business_profiles" in summary["tables_affected"]

    # auth.users still deleted
    assert sb.auth_deleted_user_ids == ["user-def"]

    # Audit row captures the skip
    inserts = [o for o in sb.ops if o["mode"] == "insert" and o["table"] == "admin_actions"]
    audit_payload = inserts[0]["payload"]
    assert "documents" in audit_payload["new_value"]["tables_skipped"]
    assert "FK violation" in audit_payload["new_value"]["tables_skipped"]["documents"]


# ─── Test: auth.users delete failure is surfaced in top-level errors ───

def test_auth_delete_failure_is_surfaced_as_orphan_risk():
    """An auth.users failure is the single error class we escalate to the
    top-level `errors` list — because an orphaned auth row blocks a future
    signup with the same email (prior session bug). public.users is
    already deleted at this point so the row is forever stranded until
    ops cleans it manually."""
    import asyncio
    hdw = _import_worker()

    user = _old_candidate("user-ghi", days_old=32)
    sb = _FakeSupabase(
        candidate_rows=[user],
        active_user_count=1000,
        auth_raises_for_user={"user-ghi": RuntimeError("admin API: 500 server error")},
    )

    summary = asyncio.run(hdw.run_hard_delete_sweep(sb=sb))

    # public.users still deleted
    assert summary["users_purged"] == 1
    # But the auth failure made it into errors
    assert any("auth.users" in e for e in summary["errors"]), summary["errors"]

    # Audit row records auth_users_error string
    inserts = [o for o in sb.ops if o["mode"] == "insert" and o["table"] == "admin_actions"]
    audit_payload = inserts[0]["payload"]
    assert audit_payload["new_value"]["auth_users_error"] is not None
    assert "admin API" in audit_payload["new_value"]["auth_users_error"]


# ─── Test: 10% safety rail aborts without touching rows ────────────────

def test_safety_rail_aborts_when_candidates_exceed_10_percent():
    """If the candidate set is > 10% of active users the worker must
    abort the entire sweep. No deletes should run, no audit row should
    be written per-user. A single abort audit row is recorded for ops."""
    import asyncio
    hdw = _import_worker()

    # 50 candidates, 100 active users → 50% → safety trips.
    candidates = [_old_candidate(f"user-{i}") for i in range(50)]
    sb = _FakeSupabase(candidate_rows=candidates, active_user_count=100)

    summary = asyncio.run(hdw.run_hard_delete_sweep(sb=sb))

    assert summary["aborted"] is True
    assert summary["users_purged"] == 0
    assert summary["users_considered"] == 50
    assert summary["abort_reason"]
    assert "10" in summary["abort_reason"] or "%" in summary["abort_reason"]

    # NO deletes should have run
    deletes = [o for o in sb.ops if o["mode"] == "delete"]
    assert deletes == []
    # No auth deletions either
    assert sb.auth_deleted_user_ids == []

    # A single abort audit row was inserted
    inserts = [o for o in sb.ops if o["mode"] == "insert" and o["table"] == "admin_actions"]
    assert len(inserts) == 1
    assert inserts[0]["payload"]["action_type"] == "hard_delete_aborted"
    assert "reason" in inserts[0]["payload"]["new_value"]


# ─── Test: safety rail at exactly 10% does NOT trip (strict >) ─────────

def test_safety_rail_at_exactly_10_percent_does_not_abort():
    """Business logic: abort when pct > 10%. At exactly 10% we proceed
    because the rail is meant to catch catastrophic runaway, not a
    bulk-churn event that legitimately hits the threshold."""
    import asyncio
    hdw = _import_worker()

    # 10 candidates, 100 active → 10.0% → should NOT abort
    candidates = [_old_candidate(f"user-{i}") for i in range(10)]
    sb = _FakeSupabase(candidate_rows=candidates, active_user_count=100)

    summary = asyncio.run(hdw.run_hard_delete_sweep(sb=sb))

    assert summary["aborted"] is False
    assert summary["users_considered"] == 10
    assert summary["users_purged"] == 10


# ─── Test: multiple candidates all get purged independently ────────────

def test_multiple_candidates_each_purge_and_audit():
    """Verify that a batch of several candidates produces one audit row
    per user and doesn't confuse table routing between them."""
    import asyncio
    hdw = _import_worker()

    candidates = [
        _old_candidate("user-a", days_old=31),
        _old_candidate("user-b", days_old=40),
        _old_candidate("user-c", days_old=90),
    ]
    sb = _FakeSupabase(candidate_rows=candidates, active_user_count=10_000)

    summary = asyncio.run(hdw.run_hard_delete_sweep(sb=sb))

    assert summary["users_purged"] == 3
    assert summary["users_considered"] == 3
    assert set(sb.auth_deleted_user_ids) == {"user-a", "user-b", "user-c"}

    # Three audit rows, one per user.
    audit_inserts = [
        o for o in sb.ops
        if o["mode"] == "insert"
        and o["table"] == "admin_actions"
        and o["payload"]["action_type"] == "hard_delete_completed"
    ]
    assert len(audit_inserts) == 3
    assert {o["payload"]["target_user_id"] for o in audit_inserts} == {"user-a", "user-b", "user-c"}
