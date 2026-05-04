"""Route-level regression tests for /billing/topup hydration."""

from __future__ import annotations

import asyncio
import importlib
import sys
import types
from pathlib import Path

import pytest
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


class _FakeResult:
    def __init__(self, data=None):
        self.data = data or []


class _FakeQuery:
    def __init__(self, table: "_FakeTable"):
        self.table = table
        self.filters = []

    def select(self, _cols="*"):
        return self

    def eq(self, col, val):
        self.filters.append(("eq", col, val))
        return self

    def limit(self, _n):
        return self

    def execute(self):
        rows = list(self.table.rows)
        for op, col, val in self.filters:
            if op == "eq":
                rows = [r for r in rows if r.get(col) == val]
        return _FakeResult(rows)


class _FakeTable:
    def __init__(self, rows=None):
        self.rows = rows or []

    def select(self, _cols="*"):
        return _FakeQuery(self)


class _FakeSB:
    def __init__(self, users_rows, policy_rows):
        self._users = _FakeTable(users_rows)
        self._policy = _FakeTable(policy_rows)

    def table(self, name: str):
        if name == "users":
            return self._users
        if name == "account_billing_policy":
            return self._policy
        return _FakeTable([])


@pytest.fixture
def billing_module(monkeypatch):
    sb_stub = types.ModuleType("supabase_client")
    sb_stub.init_supabase = lambda: None
    sb_stub.get_supabase_client = lambda: None
    monkeypatch.setitem(sys.modules, "supabase_client", sb_stub)

    auth_sb_stub = types.ModuleType("auth_supabase")
    auth_sb_stub.MASTER_ADMIN_EMAIL = "admin@example.com"
    monkeypatch.setitem(sys.modules, "auth_supabase", auth_sb_stub)

    core_config_stub = types.ModuleType("core.config")
    core_config_stub._get_rate_limit_redis = lambda: None
    core_config_stub._redis_sliding_window_check = lambda *a, **k: True
    monkeypatch.setitem(sys.modules, "core.config", core_config_stub)

    auth_stub = types.ModuleType("routes.auth")

    async def _get_current_user():
        return {"id": "user-1", "email": "u@example.com"}

    auth_stub.get_current_user = _get_current_user
    monkeypatch.setitem(sys.modules, "routes.auth", auth_stub)

    integrations_stub = types.ModuleType("routes.integrations")

    async def _acct_summary(_user):
        return {"connected": False, "metrics": {}, "invoices": []}

    integrations_stub.get_accounting_summary = _acct_summary
    monkeypatch.setitem(sys.modules, "routes.integrations", integrations_stub)

    deps_stub = types.ModuleType("routes.deps")
    deps_stub.TIER_RATE_LIMIT_DEFAULTS = {"starter": {}, "free": {}}
    deps_stub._normalize_subscription_tier = lambda tier: (tier or "free").strip().lower()

    async def _deps_get_current_user():
        return {"id": "user-1", "email": "u@example.com"}

    deps_stub.get_current_user = _deps_get_current_user
    deps_stub.get_sb = lambda: None
    monkeypatch.setitem(sys.modules, "routes.deps", deps_stub)

    policy_stub = types.ModuleType("services.topup_policy_service")
    policy_stub.build_eligibility = lambda *a, **k: {"cap_limit": 3, "cap_used": 0, "cap_remaining": 3}
    policy_stub.latest_topup_attempt = lambda *a, **k: None
    monkeypatch.setitem(sys.modules, "services.topup_policy_service", policy_stub)

    consent_stub = types.ModuleType("services.topup_consent_service")
    consent_stub.get_effective_consent = lambda *a, **k: {"effective": True, "latest_event": None}
    consent_stub.record_consent_event = lambda *a, **k: {"id": "evt-1"}
    monkeypatch.setitem(sys.modules, "services.topup_consent_service", consent_stub)

    topup_stub = types.ModuleType("services.topup_service")
    topup_stub.manual_topup = lambda *a, **k: {"attempt": {"id": "att-1", "status": "pending"}, "reused_pending": False}
    monkeypatch.setitem(sys.modules, "services.topup_service", topup_stub)

    if "routes.billing" in sys.modules:
        del sys.modules["routes.billing"]
    return importlib.import_module("routes.billing")


def _sb_for_user(*, stripe_customer_id, stripe_subscription_id):
    users = [
        {
            "id": "user-1",
            "subscription_tier": "starter",
            "subscription_status": "active",
            "current_period_end": "2026-06-01T00:00:00+00:00",
            "past_due_since": None,
            "trial_ends_at": None,
            "stripe_customer_id": stripe_customer_id,
            "stripe_subscription_id": stripe_subscription_id,
            "auto_topup_enabled": True,
            "payment_required": False,
            "topup_warned_at": None,
            "account_id": "acc-1",
        }
    ]
    policy = [{"account_id": "acc-1", "effective_tier": "starter"}]
    return _FakeSB(users, policy)


def test_post_manual_topup_hydrates_subscription_id_and_forwards_to_service(
    billing_module, monkeypatch
):
    captured = {}

    def _manual_topup(_sb, *, user_state, account_policy):
        captured["user_state"] = dict(user_state)
        captured["account_policy"] = dict(account_policy)
        return {
            "attempt": {"id": "att-1", "status": "pending", "stripe_payment_intent_id": "pi_1"},
            "payment_intent_client_secret": "pi_1_secret",
            "reused_pending": False,
        }

    monkeypatch.setattr(billing_module, "manual_topup", _manual_topup)
    monkeypatch.setattr(
        billing_module,
        "get_sb",
        lambda: _sb_for_user(
            stripe_customer_id="cus_test",
            stripe_subscription_id="sub_test",
        ),
    )

    body = billing_module.ManualTopupBody(trigger_type="manual")
    out = asyncio.run(
        billing_module.post_manual_topup(body, {"id": "user-1", "email": "u@example.com"})
    )

    assert out["ok"] is True
    assert out["status"] == "pending"
    assert captured["user_state"]["id"] == "user-1"
    assert captured["user_state"]["account_id"] == "acc-1"
    assert captured["user_state"]["stripe_customer_id"] == "cus_test"
    assert captured["user_state"]["stripe_subscription_id"] == "sub_test"


def test_post_manual_topup_missing_subscription_id_still_returns_402(
    billing_module, monkeypatch
):
    def _manual_topup(_sb, *, user_state, account_policy):
        if not user_state.get("stripe_customer_id") or not user_state.get("stripe_subscription_id"):
            raise HTTPException(status_code=402, detail="Billing linkage is incomplete")
        return {"attempt": {"id": "att-x", "status": "pending"}, "reused_pending": False}

    monkeypatch.setattr(billing_module, "manual_topup", _manual_topup)
    monkeypatch.setattr(
        billing_module,
        "get_sb",
        lambda: _sb_for_user(
            stripe_customer_id="cus_test",
            stripe_subscription_id=None,
        ),
    )

    body = billing_module.ManualTopupBody(trigger_type="manual")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            billing_module.post_manual_topup(body, {"id": "user-1", "email": "u@example.com"})
        )
    assert exc.value.status_code == 402
    assert exc.value.detail == "Billing linkage is incomplete"
