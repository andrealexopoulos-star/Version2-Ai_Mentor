"""Unit tests for the usage-summary helpers in routes.billing.

Coverage (Step 3 / P1-1):
  - _safe_usage_summary aggregates ai_usage_log rows into per-feature counts.
  - Unlimited tiers emit limit=None (frontend renders as ∞).
  - Legacy flat keys (ai_queries_*, boardroom_*, exports_*) align with the
    rich `features` shape so the shipped BillingPage.js reads real numbers.
  - Tier normalisation (professional → pro) applies the right caps.
  - _month_start_and_reset rolls the year over correctly in December.
  - _safe_user_subscription_state returns a slim row and degrades to {}
    on lookup error rather than 500-ing /billing/overview.

We deliberately avoid booting the FastAPI app — these helpers take `sb`
as a parameter so we can drive them with a recording fake Supabase
client without touching the network or Supabase.
"""
from __future__ import annotations

import importlib
import sys
import types
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# ─── Fake Supabase client (same contract as test_stripe_webhooks) ──

class _FakeExecResult:
    def __init__(self, data: Optional[List[Dict[str, Any]]] = None):
        self.data = data or []


class _FakeQuery:
    def __init__(self, table: "_FakeTable", op: str, payload: Any = None):
        self.table = table
        self.op = op
        self.payload = payload
        self.filters: List[tuple] = []
        self.select_cols: Optional[str] = None
        self.limit_n: Optional[int] = None

    def eq(self, col: str, val: Any) -> "_FakeQuery":
        self.filters.append(("eq", col, val))
        return self

    def gte(self, col: str, val: Any) -> "_FakeQuery":
        self.filters.append(("gte", col, val))
        return self

    def limit(self, n: int) -> "_FakeQuery":
        self.limit_n = n
        return self

    def select(self, cols: str = "*") -> "_FakeQuery":
        self.select_cols = cols
        return self

    def execute(self) -> _FakeExecResult:
        self.table.calls.append({
            "op": self.op,
            "select_cols": self.select_cols,
            "filters": list(self.filters),
            "limit_n": self.limit_n,
        })
        return self.table.return_for(self)


class _FakeTable:
    def __init__(self, name: str, client: "_FakeSupabase"):
        self.name = name
        self.client = client
        self.calls: List[Dict[str, Any]] = []

    def select(self, cols: str = "*") -> _FakeQuery:
        q = _FakeQuery(self, "select")
        q.select_cols = cols
        return q

    def return_for(self, query: _FakeQuery) -> _FakeExecResult:
        handler = self.client.response_handlers.get(self.name)
        if handler:
            return handler(query) or _FakeExecResult()
        return _FakeExecResult()


class _FakeSupabase:
    def __init__(self):
        self._tables: Dict[str, _FakeTable] = {}
        self.response_handlers: Dict[str, Any] = {}

    def table(self, name: str) -> _FakeTable:
        return self._tables.setdefault(name, _FakeTable(name, self))


# ─── Fixtures ──────────────────────────────────────────────────────

@pytest.fixture
def billing_module(monkeypatch):
    """Import routes.billing with transitive-dep stubs so we don't boot
    the full FastAPI app or require a live Supabase client.

    Why so many stubs: routes.billing → routes.deps → auth_supabase →
    supabase_client (+ core.config). On Python 3.9 some of these fail
    to import at all because of PEP-604 `X | None` syntax. We only
    exercise the two pure helpers here, so we can stub everything
    upstream safely.
    """
    # supabase_client stub — init_supabase AND get_supabase_client.
    sb_stub = types.ModuleType("supabase_client")
    sb_stub.init_supabase = lambda: None
    sb_stub.get_supabase_client = lambda: None
    monkeypatch.setitem(sys.modules, "supabase_client", sb_stub)

    # auth_supabase only needs to provide MASTER_ADMIN_EMAIL for deps.py.
    auth_sb_stub = types.ModuleType("auth_supabase")
    auth_sb_stub.MASTER_ADMIN_EMAIL = "admin@example.com"
    monkeypatch.setitem(sys.modules, "auth_supabase", auth_sb_stub)

    # core.config needs two helpers used by the rate-limit code path.
    core_config_stub = types.ModuleType("core.config")
    core_config_stub._get_rate_limit_redis = lambda: None
    core_config_stub._redis_sliding_window_check = lambda *a, **k: True
    monkeypatch.setitem(sys.modules, "core.config", core_config_stub)

    # routes.auth is imported by some sibling modules even when we only
    # need billing; stub its get_current_user.
    auth_stub = types.ModuleType("routes.auth")
    async def _get_current_user():
        return {"id": "stub", "email": "stub@example.com"}
    auth_stub.get_current_user = _get_current_user
    monkeypatch.setitem(sys.modules, "routes.auth", auth_stub)

    # routes.integrations.get_accounting_summary is imported at module load;
    # the real one pulls Xero/QuickBooks. Stub to an async no-op so billing
    # imports cleanly in unit-test isolation.
    integrations_stub = types.ModuleType("routes.integrations")
    async def _acct_summary(user):
        return {"connected": False, "metrics": {}, "invoices": []}
    integrations_stub.get_accounting_summary = _acct_summary
    monkeypatch.setitem(sys.modules, "routes.integrations", integrations_stub)

    # routes.deps uses PEP-604 `str | None` which blows up on Python 3.9.
    # Stub it with the minimal surface billing.py actually imports so the
    # test exercises billing's own logic without the deps.py file even
    # being parsed. TIER_RATE_LIMIT_DEFAULTS mirrors the real table for
    # the tiers exercised in these tests.
    deps_stub = types.ModuleType("routes.deps")
    deps_stub.TIER_RATE_LIMIT_DEFAULTS = {
        "free": {
            "soundboard_daily": {"monthly_limit": 80},
            "trinity_daily": {"monthly_limit": 0},
            "boardroom_diagnosis": {"monthly_limit": 20},
            "war_room_ask": {"monthly_limit": 40},
        },
        "starter": {
            "soundboard_daily": {"monthly_limit": 900},
            "trinity_daily": {"monthly_limit": 180},
            "boardroom_diagnosis": {"monthly_limit": 320},
            "war_room_ask": {"monthly_limit": 700},
        },
        "pro": {
            "soundboard_daily": {"monthly_limit": 1800},
            "trinity_daily": {"monthly_limit": 360},
            "boardroom_diagnosis": {"monthly_limit": 600},
            "war_room_ask": {"monthly_limit": 1200},
        },
        "business": {
            "soundboard_daily": {"monthly_limit": 3600},
            "trinity_daily": {"monthly_limit": 720},
            "boardroom_diagnosis": {"monthly_limit": 1200},
            "war_room_ask": {"monthly_limit": 2400},
        },
        "enterprise": {
            "soundboard_daily": {"monthly_limit": -1},
            "trinity_daily": {"monthly_limit": -1},
            "boardroom_diagnosis": {"monthly_limit": -1},
            "war_room_ask": {"monthly_limit": -1},
        },
        "super_admin": {
            "soundboard_daily": {"monthly_limit": -1},
            "trinity_daily": {"monthly_limit": -1},
            "boardroom_diagnosis": {"monthly_limit": -1},
            "war_room_ask": {"monthly_limit": -1},
        },
    }

    def _normalize_subscription_tier(tier):
        v = (tier or "free").lower().strip()
        if v in ("superadmin", "super_admin"):
            return "super_admin"
        if v in ("enterprise", "custom", "custom_build"):
            return "enterprise"
        if v == "business":
            return "business"
        if v in ("professional", "pro"):
            return "pro"
        if v in ("foundation", "growth", "starter"):
            return "starter"
        return v if v in deps_stub.TIER_RATE_LIMIT_DEFAULTS else "free"
    deps_stub._normalize_subscription_tier = _normalize_subscription_tier

    async def _deps_get_current_user():
        return {"id": "stub", "email": "stub@example.com"}
    deps_stub.get_current_user = _deps_get_current_user
    deps_stub.get_sb = lambda: None  # real use-sites pass sb as a parameter now
    monkeypatch.setitem(sys.modules, "routes.deps", deps_stub)

    if "routes.billing" in sys.modules:
        del sys.modules["routes.billing"]
    module = importlib.import_module("routes.billing")
    return module


@pytest.fixture
def fake_sb():
    return _FakeSupabase()


# ─── _month_start_and_reset ────────────────────────────────────────

def test_month_start_and_reset_mid_month(billing_module):
    start, reset = billing_module._month_start_and_reset(date(2026, 4, 15))
    assert start == "2026-04-01"
    assert reset == "2026-05-01"


def test_month_start_and_reset_first_of_month(billing_module):
    start, reset = billing_module._month_start_and_reset(date(2026, 5, 1))
    assert start == "2026-05-01"
    assert reset == "2026-06-01"


def test_month_start_and_reset_december_rolls_year(billing_module):
    """December must roll to January of the NEXT year, not crash."""
    start, reset = billing_module._month_start_and_reset(date(2026, 12, 20))
    assert start == "2026-12-01"
    assert reset == "2027-01-01"


def test_month_start_and_reset_non_leap_february(billing_module):
    start, reset = billing_module._month_start_and_reset(date(2027, 2, 27))
    assert start == "2027-02-01"
    assert reset == "2027-03-01"


# ─── _safe_usage_summary ───────────────────────────────────────────

def _build_ai_usage_handler(rows: List[Dict[str, Any]]):
    def handler(q: _FakeQuery):
        assert q.op == "select"
        # Must filter by user_id (eq) and by month_start (gte).
        ops = {op for op, *_ in q.filters}
        assert "eq" in ops, f"expected eq filter on user_id; got {q.filters}"
        assert "gte" in ops, f"expected gte filter on date; got {q.filters}"
        return _FakeExecResult(rows)
    return handler


def test_usage_summary_aggregates_mixed_feature_rows(billing_module, fake_sb):
    """Free tier user with usage across 3 features → correct per-feature
    counts and correct limits from TIER_RATE_LIMIT_DEFAULTS['free']."""
    fake_sb.response_handlers["ai_usage_log"] = _build_ai_usage_handler([
        {"feature": "soundboard_daily",    "count": 10, "date": "2026-04-01"},
        {"feature": "soundboard_daily",    "count": 5,  "date": "2026-04-03"},
        {"feature": "war_room_ask",        "count": 7,  "date": "2026-04-02"},
        {"feature": "boardroom_diagnosis", "count": 3,  "date": "2026-04-04"},
        # Row for an unrecognised feature should be ignored, not crash.
        {"feature": "mystery_feature",     "count": 99, "date": "2026-04-05"},
    ])

    summary = billing_module._safe_usage_summary(fake_sb, "user-free", "free")

    assert summary["tier"] == "free"
    # features breakdown
    assert summary["features"]["soundboard"]["used"] == 15
    assert summary["features"]["soundboard"]["limit"] == 80
    assert summary["features"]["soundboard"]["unlimited"] is False
    assert summary["features"]["war_room"]["used"] == 7
    assert summary["features"]["war_room"]["limit"] == 40
    assert summary["features"]["boardroom"]["used"] == 3
    assert summary["features"]["boardroom"]["limit"] == 20
    assert summary["features"]["trinity"]["used"] == 0
    # free tier trinity is 0 — legitimately zero, not unlimited.
    assert summary["features"]["trinity"]["limit"] == 0
    assert summary["features"]["trinity"]["unlimited"] is False

    # legacy flat keys the shipped BillingPage reads
    assert summary["ai_queries_used"] == 15
    assert summary["ai_queries_limit"] == 80
    assert summary["boardroom_used"] == 3
    assert summary["boardroom_limit"] == 20
    assert summary["exports_used"] == 0
    assert summary["exports_limit"] is None


def test_usage_summary_empty_log_returns_zeros(billing_module, fake_sb):
    fake_sb.response_handlers["ai_usage_log"] = lambda q: _FakeExecResult([])

    summary = billing_module._safe_usage_summary(fake_sb, "user-fresh", "starter")

    assert summary["tier"] == "starter"
    for feature in ("soundboard", "trinity", "boardroom", "war_room"):
        assert summary["features"][feature]["used"] == 0
    # Starter tier limits (from TIER_RATE_LIMIT_DEFAULTS["starter"]).
    assert summary["features"]["soundboard"]["limit"] == 900
    assert summary["features"]["boardroom"]["limit"] == 320
    assert summary["ai_queries_used"] == 0
    assert summary["ai_queries_limit"] == 900


def test_usage_summary_unlimited_tier_emits_null_limit(billing_module, fake_sb):
    """super_admin and enterprise tiers have monthly_limit=-1. Expose
    that as limit=None + unlimited=True so the frontend can render ∞."""
    fake_sb.response_handlers["ai_usage_log"] = lambda q: _FakeExecResult([
        {"feature": "soundboard_daily", "count": 500, "date": "2026-04-01"},
    ])

    summary = billing_module._safe_usage_summary(fake_sb, "user-admin", "super_admin")

    assert summary["tier"] == "super_admin"
    assert summary["features"]["soundboard"]["used"] == 500
    assert summary["features"]["soundboard"]["limit"] is None
    assert summary["features"]["soundboard"]["unlimited"] is True
    # Legacy key must also be None so BillingPage renders ∞.
    assert summary["ai_queries_limit"] is None


def test_usage_summary_tier_normalization_applies_correct_limits(billing_module, fake_sb):
    """DB stores `subscription_tier='professional'`; we must normalise to
    'pro' so the pro-tier limits apply (not free-tier defaults)."""
    fake_sb.response_handlers["ai_usage_log"] = lambda q: _FakeExecResult([])

    summary = billing_module._safe_usage_summary(fake_sb, "user-pro", "professional")

    assert summary["tier"] == "pro"
    assert summary["features"]["soundboard"]["limit"] == 1800
    assert summary["features"]["boardroom"]["limit"] == 600
    assert summary["ai_queries_limit"] == 1800


def test_usage_summary_filters_by_month_start(billing_module, fake_sb):
    """The helper must constrain the ai_usage_log read to the current
    month with a gte filter on `date`. Verify the filter was applied."""
    captured_queries: List[_FakeQuery] = []

    def handler(q: _FakeQuery):
        captured_queries.append(q)
        return _FakeExecResult([])
    fake_sb.response_handlers["ai_usage_log"] = handler

    billing_module._safe_usage_summary(fake_sb, "user-1", "free")

    assert len(captured_queries) == 1
    q = captured_queries[0]
    # month_start is today.replace(day=1) — so the filter value is YYYY-MM-01.
    gte_filters = [f for f in q.filters if f[0] == "gte" and f[1] == "date"]
    assert gte_filters, f"expected gte filter on date; got {q.filters}"
    month_filter_val = gte_filters[0][2]
    assert isinstance(month_filter_val, str) and month_filter_val.endswith("-01")


def test_usage_summary_degrades_cleanly_on_db_error(billing_module, fake_sb):
    """Supabase down must NOT break /billing/overview — the helper returns
    zeros (shape preserved), never raises."""
    def boom(q):
        raise RuntimeError("simulated supabase outage")
    fake_sb.response_handlers["ai_usage_log"] = boom

    summary = billing_module._safe_usage_summary(fake_sb, "user-bust", "free")

    # Shape preserved; counts are 0; limits still come from the tier config.
    assert summary["tier"] == "free"
    assert summary["features"]["soundboard"]["used"] == 0
    assert summary["features"]["soundboard"]["limit"] == 80
    assert summary["ai_queries_used"] == 0
    assert summary["ai_queries_limit"] == 80


# ─── _safe_user_subscription_state ────────────────────────────────

def test_user_state_returns_slim_row(billing_module, fake_sb):
    fake_sb.response_handlers["users"] = lambda q: _FakeExecResult([{
        "subscription_tier": "pro",
        "subscription_status": "active",
        "current_period_end": "2026-05-15T00:00:00+00:00",
        "past_due_since": None,
        "trial_ends_at": None,
        "stripe_customer_id": "cus_abc",
    }])

    state = billing_module._safe_user_subscription_state(fake_sb, "user-pro")
    assert state["subscription_tier"] == "pro"
    assert state["subscription_status"] == "active"
    assert state["current_period_end"] == "2026-05-15T00:00:00+00:00"
    assert state["stripe_customer_id"] == "cus_abc"


def test_user_state_empty_on_missing_row(billing_module, fake_sb):
    fake_sb.response_handlers["users"] = lambda q: _FakeExecResult([])
    assert billing_module._safe_user_subscription_state(fake_sb, "user-missing") == {}


def test_user_state_degrades_to_empty_dict_on_error(billing_module, fake_sb):
    def boom(q):
        raise RuntimeError("DB unreachable")
    fake_sb.response_handlers["users"] = boom
    assert billing_module._safe_user_subscription_state(fake_sb, "user-err") == {}
