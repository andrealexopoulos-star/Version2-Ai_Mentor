"""
Tests for the synchronous data-export endpoint (Sprint C #21).

Verifies:
  - Content-Disposition attachment + correct filename pattern
  - Schema: schema_version, generated_at, user_id, email, tables dict
  - Row cap: >_USER_EXPORT_ROW_CAP rows returned → table entry in truncated_tables
  - Missing table raises inside the SB client → caught, added to skipped_tables,
    no 500 leaked

Uses sys.modules stubbing (same pattern as test_signals_routes.py) to avoid
importing modules that use Python 3.10+ syntax. Local Python is 3.9; CI is 3.11.
"""
from __future__ import annotations

import json
import sys
import types
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# ─── Stub supabase_client + routes.deps before importing the route module ───

class _FakeTableOp:
    def __init__(self, parent: "_FakeSupabase", table: str):
        self._p = parent
        self._table = table
        self._eq_filters: List[tuple] = []
        self._limit: Optional[int] = None

    def select(self, *_a):
        return self

    def eq(self, k, v):
        self._eq_filters.append((k, v))
        return self

    def limit(self, n):
        self._limit = n
        return self

    def execute(self):
        if self._p.raises_on.get(self._table):
            raise self._p.raises_on[self._table]
        rows = self._p.data.get(self._table, [])
        # Respect the +1 limit pattern so we can test truncation
        if self._limit and len(rows) > self._limit:
            rows = rows[: self._limit]

        class _Res:
            pass
        r = _Res()
        r.data = rows
        return r


class _FakeSupabase:
    def __init__(self, data: Optional[Dict[str, List[Dict[str, Any]]]] = None,
                 raises_on: Optional[Dict[str, Exception]] = None):
        self.data = data or {}
        self.raises_on = raises_on or {}

    def table(self, name: str):
        return _FakeTableOp(self, name)


TEST_USER = {"id": "00000000-0000-0000-0000-000000000001", "email": "tester@example.com"}
_STATE: Dict[str, Any] = {"sb": _FakeSupabase()}

# Stub supabase_client (imported transitively by routes.deps)
_stub_supabase_client = types.ModuleType("supabase_client")
_stub_supabase_client.get_supabase_admin = lambda: _STATE["sb"]
_stub_supabase_client.get_supabase_client = lambda: _STATE["sb"]
_stub_supabase_client.init_supabase = lambda: None
sys.modules["supabase_client"] = _stub_supabase_client

# Stub routes.deps with JUST the two symbols user_settings imports.
_stub_routes_deps = types.ModuleType("routes.deps")
_stub_routes_deps.get_current_user = lambda: TEST_USER
_stub_routes_deps.get_sb = lambda: _STATE["sb"]
# Make `routes` a package-like module so submodule imports resolve.
_routes_pkg = types.ModuleType("routes")
_routes_pkg.__path__ = [str(ROOT / "routes")]
sys.modules["routes"] = _routes_pkg
sys.modules["routes.deps"] = _stub_routes_deps

# Now load the real module.
from routes import user_settings as us_module  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


def _make_client(data=None, raises_on=None):
    _STATE["sb"] = _FakeSupabase(data=data or {}, raises_on=raises_on or {})
    app = FastAPI()
    app.include_router(us_module.router)
    return TestClient(app)


# ─── Tests ───────────────────────────────────────────────────────────────────

def test_export_returns_json_with_correct_headers():
    client = _make_client(data={"business_profiles": [{"user_id": TEST_USER["id"], "industry": "retail"}]})
    res = client.get("/user/export/download-now")
    assert res.status_code == 200
    # Content-Disposition present + filename pattern
    cd = res.headers.get("content-disposition", "")
    assert "attachment" in cd.lower()
    assert 'filename="biqc_export_' in cd
    assert cd.endswith('.json"')
    # Cache-Control should prevent caching of personal data
    assert res.headers.get("cache-control") == "no-store"


def test_export_body_shape():
    client = _make_client(data={
        "business_profiles": [{"user_id": TEST_USER["id"], "industry": "retail"}],
        "signal_feedback": [
            {"user_id": TEST_USER["id"], "feedback_key": "not_relevant", "event_id": "evt-1"},
        ],
    })
    payload = client.get("/user/export/download-now").json()
    # Top-level keys
    assert payload["schema_version"] == "1"
    assert payload["user_id"] == TEST_USER["id"]
    assert payload["email"] == TEST_USER["email"]
    assert "generated_at" in payload
    # Parse generated_at — it must be a valid ISO8601 UTC timestamp
    dt = datetime.fromisoformat(payload["generated_at"].replace("Z", "+00:00"))
    assert dt.tzinfo is not None
    # Tables dict has every entry from _USER_EXPORT_TABLES, even empty ones
    tables = payload["tables"]
    for t in us_module._USER_EXPORT_TABLES:
        assert t in tables, f"missing {t} in tables"
    # Data we seeded flows through
    assert tables["business_profiles"][0]["industry"] == "retail"
    assert tables["signal_feedback"][0]["feedback_key"] == "not_relevant"


def test_export_truncates_oversized_table():
    """If a table has more than _USER_EXPORT_ROW_CAP rows, the extras are
    dropped and the table is listed in truncated_tables."""
    cap = us_module._USER_EXPORT_ROW_CAP
    huge = [{"user_id": TEST_USER["id"], "i": i} for i in range(cap + 25)]
    client = _make_client(data={"usage_ledger": huge})
    payload = client.get("/user/export/download-now").json()
    assert len(payload["tables"]["usage_ledger"]) == cap
    assert "usage_ledger" in payload["truncated_tables"]


def test_export_skipped_tables_on_sb_error():
    """A table that throws (e.g. missing in staging) must not 500 the request —
    it lands in skipped_tables with a trimmed error string."""
    client = _make_client(
        data={"business_profiles": [{"user_id": TEST_USER["id"], "ok": True}]},
        raises_on={"signal_feedback": RuntimeError("relation does not exist")},
    )
    res = client.get("/user/export/download-now")
    assert res.status_code == 200
    payload = res.json()
    assert "signal_feedback" in payload["skipped_tables"]
    # Regular tables still exported
    assert payload["tables"]["business_profiles"][0]["ok"] is True


def test_export_lists_feedback_and_snooze_tables():
    """Sprint B #17 tables MUST be covered — retention trust requires users to
    get their feedback history back."""
    tables = us_module._USER_EXPORT_TABLES
    assert "signal_snoozes" in tables
    assert "signal_feedback" in tables
    # And the usage ledger so they can reconcile billing
    assert "usage_ledger" in tables
    assert "payment_transactions" in tables
