"""Entitlement contract tests.

Seat model lock: Growth=1, Pro=5, Business=12.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import importlib
from pathlib import Path
import sys
import types
from typing import Any, Dict, List, Optional

import pytest


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from config.entitlement_constants import (
    BUSINESS_SEATS,
    BUSINESS_TOKENS,
    BUSINESS_TOPUP_CAP,
    HARD_STOP_THRESHOLD,
    PRO_SEATS,
    PRO_TOKENS,
    PRO_TOPUP_CAP,
    STARTER_SEATS,
    STARTER_TOKENS,
    STARTER_TOPUP_CAP,
    TOPUP_PRICE_AUD_CENTS,
    TOPUP_TOKENS,
    URGENT_WARNING_THRESHOLD,
    WARNING_THRESHOLD,
)
from core import plans


class _Result:
    def __init__(self, data=None):
        self.data = data or []


class _Query:
    def __init__(self, rows: List[Dict[str, Any]]):
        self._rows = rows
        self._filters: List[tuple] = []

    def select(self, _cols: str = "*") -> "_Query":
        return self

    def eq(self, col: str, val: Any) -> "_Query":
        self._filters.append(("eq", col, val))
        return self

    def execute(self) -> _Result:
        filtered = []
        for row in self._rows:
            ok = True
            for op, col, val in self._filters:
                if op == "eq" and row.get(col) != val:
                    ok = False
                    break
            if ok:
                filtered.append(dict(row))
        return _Result(filtered)


class _Table:
    def __init__(self, rows: List[Dict[str, Any]]):
        self.rows = rows

    def select(self, _cols: str = "*") -> _Query:
        return _Query(self.rows)


class _FakeSB:
    def __init__(self, users: List[Dict[str, Any]], invites: List[Dict[str, Any]]):
        self._users = _Table(users)
        self._invites = _Table(invites)

    def table(self, name: str) -> _Table:
        if name == "users":
            return self._users
        if name == "invites":
            return self._invites
        return _Table([])


@pytest.fixture
def onboarding_module(monkeypatch):
    deps_stub = types.ModuleType("routes.deps")
    deps_stub.get_current_user = lambda: {"id": "stub"}
    deps_stub.get_sb = lambda: None
    deps_stub.require_owner_or_admin = lambda: {"id": "stub"}
    deps_stub.get_current_account = lambda: {"id": "acc-1", "subscription_tier": "starter"}

    class _Logger:
        def warning(self, *args, **kwargs):
            return None

        def error(self, *args, **kwargs):
            return None

        def info(self, *args, **kwargs):
            return None

    deps_stub.logger = _Logger()
    monkeypatch.setitem(sys.modules, "routes.deps", deps_stub)

    supabase_client_stub = types.ModuleType("supabase_client")
    supabase_client_stub.safe_query_single = lambda *a, **k: None
    monkeypatch.setitem(sys.modules, "supabase_client", supabase_client_stub)

    auth_supabase_stub = types.ModuleType("auth_supabase")
    auth_supabase_stub.get_user_by_id = lambda *a, **k: None
    monkeypatch.setitem(sys.modules, "auth_supabase", auth_supabase_stub)

    demo_seeder_stub = types.ModuleType("services.demo_seeder")
    demo_seeder_stub.seed_demo_account = lambda *a, **k: None
    monkeypatch.setitem(sys.modules, "services.demo_seeder", demo_seeder_stub)

    signal_enricher_stub = types.ModuleType("services.signal_enricher")
    signal_enricher_stub.enrich_insight = lambda *a, **k: None
    signal_enricher_stub.backfill_unenriched = lambda *a, **k: None
    monkeypatch.setitem(sys.modules, "services.signal_enricher", signal_enricher_stub)

    int_helpers_stub = types.ModuleType("supabase_intelligence_helpers")
    int_helpers_stub.get_business_profile_supabase = lambda *a, **k: {}
    int_helpers_stub.update_business_profile_supabase = lambda *a, **k: {}
    monkeypatch.setitem(sys.modules, "supabase_intelligence_helpers", int_helpers_stub)

    rem_helpers_stub = types.ModuleType("supabase_remaining_helpers")
    rem_helpers_stub.get_onboarding_supabase = lambda *a, **k: {}
    rem_helpers_stub.update_onboarding_supabase = lambda *a, **k: {}
    rem_helpers_stub.create_invite_supabase = lambda *a, **k: {}
    rem_helpers_stub.get_invite_supabase = lambda *a, **k: {}
    rem_helpers_stub.delete_invite_supabase = lambda *a, **k: {}
    monkeypatch.setitem(sys.modules, "supabase_remaining_helpers", rem_helpers_stub)

    core_helpers_stub = types.ModuleType("core.helpers")
    core_helpers_stub.get_email_domain = lambda email: (email or "").split("@")[-1] if email else ""
    core_helpers_stub.hash_password = lambda s: f"hash:{s}"
    core_helpers_stub.verify_password = lambda raw, hashed: hashed == f"hash:{raw}"
    core_helpers_stub.create_token = lambda *a, **k: "token"
    monkeypatch.setitem(sys.modules, "core.helpers", core_helpers_stub)

    onboarding_progress_stub = types.ModuleType("services.onboarding_progress")
    onboarding_progress_stub.evaluate_onboarding_progress = lambda *a, **k: {}
    monkeypatch.setitem(sys.modules, "services.onboarding_progress", onboarding_progress_stub)

    if "routes.onboarding" in sys.modules:
        del sys.modules["routes.onboarding"]
    return importlib.import_module("routes.onboarding")


def _snapshot(tier: str, *, users: int, pending_invites: int) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    account_id = "acc-1"
    user_rows = [{"id": f"u-{i}", "account_id": account_id} for i in range(users)]
    invite_rows = []
    for i in range(pending_invites):
        invite_rows.append(
            {
                "id": f"inv-{i}",
                "account_id": account_id,
                "expires_at": (now + timedelta(days=1)).isoformat(),
            }
        )
    sb = _FakeSB(user_rows, invite_rows)
    return {
        "sb": sb,
        "account": {"id": account_id, "subscription_tier": tier},
        "now": now,
    }


def _evaluate(module, tier: str, *, users: int, pending_invites: int) -> Dict[str, Any]:
    payload = _snapshot(tier, users=users, pending_invites=pending_invites)
    return module.seat_usage_snapshot(
        payload["sb"],
        payload["account"],
        now=payload["now"],
    )


def test_growth_starter_blocks_second_user(onboarding_module):
    snap = _evaluate(onboarding_module, "growth", users=1, pending_invites=0)
    assert snap["seat_limit"] == 1
    assert snap["can_invite"] is False


def test_pro_professional_allows_up_to_five_users(onboarding_module):
    snap_pro = _evaluate(onboarding_module, "pro", users=4, pending_invites=0)
    snap_professional = _evaluate(onboarding_module, "professional", users=4, pending_invites=0)
    assert snap_pro["seat_limit"] == 5
    assert snap_professional["seat_limit"] == 5
    assert snap_pro["can_invite"] is True
    assert snap_professional["can_invite"] is True


def test_pro_professional_blocks_sixth_user(onboarding_module):
    snap = _evaluate(onboarding_module, "professional", users=5, pending_invites=0)
    assert snap["seat_limit"] == 5
    assert snap["can_invite"] is False


def test_business_allows_up_to_twelve_users(onboarding_module):
    snap = _evaluate(onboarding_module, "business", users=11, pending_invites=0)
    assert snap["seat_limit"] == 12
    assert snap["can_invite"] is True


def test_business_blocks_thirteenth_user(onboarding_module):
    snap = _evaluate(onboarding_module, "business", users=12, pending_invites=0)
    assert snap["seat_limit"] == 12
    assert snap["can_invite"] is False


def test_pending_invites_count_toward_cap(onboarding_module):
    # Pro cap=5. 4 active + 1 pending => block additional invite.
    snap = _evaluate(onboarding_module, "pro", users=4, pending_invites=1)
    assert snap["seat_limit"] == 5
    assert snap["pending_invites"] == 1
    assert snap["committed_seats"] == 5
    assert snap["can_invite"] is False


def test_enterprise_custom_build_super_admin_unlimited(onboarding_module):
    for tier in ("enterprise", "custom_build", "super_admin"):
        snap = _evaluate(onboarding_module, tier, users=1000, pending_invites=1000)
        assert snap["seat_limit"] is None
        assert snap["can_invite"] is True


def test_contract_locked_seats_tokens_and_topup_values():
    assert STARTER_SEATS == 1
    assert PRO_SEATS == 5
    assert BUSINESS_SEATS == 12

    assert STARTER_TOKENS == 1_000_000
    assert PRO_TOKENS == 5_000_000
    assert BUSINESS_TOKENS == 20_000_000

    assert TOPUP_TOKENS == 250_000
    assert TOPUP_PRICE_AUD_CENTS == 1900
    assert STARTER_TOPUP_CAP == 3
    assert PRO_TOPUP_CAP == 5
    assert BUSINESS_TOPUP_CAP == 10

    assert WARNING_THRESHOLD == 0.80
    assert URGENT_WARNING_THRESHOLD == 0.95
    assert HARD_STOP_THRESHOLD == 1.00


def test_core_plans_uses_canonical_topup_values():
    assert plans.TOPUP_TOKENS == TOPUP_TOKENS
    assert plans.TOPUP_PRICE_AUD_CENTS == TOPUP_PRICE_AUD_CENTS

