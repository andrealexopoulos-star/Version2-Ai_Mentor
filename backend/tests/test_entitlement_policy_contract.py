"""Contract tests for launch entitlement policy.

These tests pin the commercial policy changes required for launch:
- Seat caps by tier (Growth=1, Pro=5, Business=12, Enterprise+=unlimited)
- Integration entitlements are usage-based for paid plans (no paid connector count cap)
"""
from __future__ import annotations

import asyncio
import importlib
import importlib.metadata
import sys
import types
from pathlib import Path

import pytest
from fastapi import HTTPException


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _stub_onboarding_imports() -> None:
    """Provide minimal module stubs so routes.onboarding imports cleanly."""
    importlib.metadata.version = lambda _name: "2.0.0"
    email_validator = types.ModuleType("email_validator")
    email_validator.validate_email = (
        lambda value, **kwargs: types.SimpleNamespace(
            email=value,
            normalized=value,
            local_part=value.split("@", 1)[0],
        )
    )
    class _EmailNotValidError(Exception):
        pass
    email_validator.EmailNotValidError = _EmailNotValidError
    sys.modules["email_validator"] = email_validator

    routes_deps = types.ModuleType("routes.deps")
    routes_deps.get_current_user = lambda: None
    routes_deps.get_sb = lambda: None
    routes_deps.logger = types.SimpleNamespace(error=lambda *a, **k: None)
    routes_deps.require_owner_or_admin = lambda: None
    routes_deps.get_current_account = lambda: None
    sys.modules["routes.deps"] = routes_deps

    supabase_client = types.ModuleType("supabase_client")
    supabase_client.safe_query_single = lambda *a, **k: None
    sys.modules["supabase_client"] = supabase_client

    auth_supabase = types.ModuleType("auth_supabase")
    auth_supabase.get_user_by_id = lambda *a, **k: None
    sys.modules["auth_supabase"] = auth_supabase

    demo_seeder = types.ModuleType("services.demo_seeder")
    demo_seeder.seed_demo_account = lambda *a, **k: {}
    sys.modules["services.demo_seeder"] = demo_seeder

    signal_enricher = types.ModuleType("services.signal_enricher")
    signal_enricher.enrich_insight = lambda *a, **k: {}
    signal_enricher.backfill_unenriched = lambda *a, **k: {}
    sys.modules["services.signal_enricher"] = signal_enricher

    sb_intel = types.ModuleType("supabase_intelligence_helpers")
    sb_intel.get_business_profile_supabase = lambda *a, **k: {}
    sb_intel.update_business_profile_supabase = lambda *a, **k: {}
    sys.modules["supabase_intelligence_helpers"] = sb_intel

    sb_remaining = types.ModuleType("supabase_remaining_helpers")
    sb_remaining.get_onboarding_supabase = lambda *a, **k: {}
    sb_remaining.update_onboarding_supabase = lambda *a, **k: {}
    sb_remaining.create_invite_supabase = lambda *a, **k: {}
    sb_remaining.get_invite_supabase = lambda *a, **k: {}
    sb_remaining.delete_invite_supabase = lambda *a, **k: {}
    sys.modules["supabase_remaining_helpers"] = sb_remaining

    core_helpers = types.ModuleType("core.helpers")
    core_helpers.get_email_domain = lambda *a, **k: ""
    core_helpers.hash_password = lambda value: value
    core_helpers.verify_password = lambda *a, **k: True
    core_helpers.create_token = lambda *a, **k: "token"
    sys.modules["core.helpers"] = core_helpers


def _import_onboarding():
    _stub_onboarding_imports()
    if "routes.onboarding" in sys.modules:
        del sys.modules["routes.onboarding"]
    return importlib.import_module("routes.onboarding")


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, table_name: str, state: dict):
        self.table_name = table_name
        self.state = state
        self.filters = {}

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def execute(self):
        if self.table_name == "users" and "account_id" in self.filters:
            count = int(self.state.get("users_count", 0))
            return _FakeResult([{"id": f"user-{idx}"} for idx in range(count)])
        if self.table_name == "invites" and "account_id" in self.filters:
            count = int(self.state.get("invites_count", 0))
            return _FakeResult([{"id": f"invite-{idx}"} for idx in range(count)])
        if self.table_name == "users" and "email" in self.filters:
            return _FakeResult([])
        return _FakeResult([])


class _FakeSB:
    def __init__(self, state: dict):
        self.state = state

    def table(self, name: str):
        return _FakeQuery(name, self.state)


def _run_invite(onboarding, *, tier: str, users_count: int, invites_count: int):
    state = {"users_count": users_count, "invites_count": invites_count}
    onboarding.get_sb = lambda: _FakeSB(state)

    async def _fake_create_invite(_sb, _invite):
        return {}

    onboarding.create_invite_supabase = _fake_create_invite

    req = onboarding.InviteCreateRequest(email="new.member@acme.com", name="New Member", role="member")
    current_user = {"id": "owner-1", "role": "owner"}
    account = {"id": "acct-1", "subscription_tier": tier, "email": "owner@acme.com"}
    return asyncio.run(onboarding.invite_user(req, current_user, account))


def test_seat_limits_by_plan_contract():
    onboarding = _import_onboarding()

    assert onboarding.seat_limit_for_tier("growth") == 1
    assert onboarding.seat_limit_for_tier("starter") == 1
    assert onboarding.seat_limit_for_tier("pro") == 5
    assert onboarding.seat_limit_for_tier("professional") == 5
    assert onboarding.seat_limit_for_tier("business") == 12
    assert onboarding.seat_limit_for_tier("enterprise") is None
    assert onboarding.seat_limit_for_tier("custom_build") is None
    assert onboarding.seat_limit_for_tier("super_admin") is None


def test_growth_blocks_second_user():
    onboarding = _import_onboarding()
    with pytest.raises(HTTPException) as exc:
        _run_invite(onboarding, tier="starter", users_count=1, invites_count=0)
    assert exc.value.status_code == 403


def test_pro_allows_up_to_five_users():
    onboarding = _import_onboarding()
    result = _run_invite(onboarding, tier="pro", users_count=4, invites_count=0)
    assert result.invite_link.startswith("/invite/accept?token=")


def test_pro_blocks_sixth_user():
    onboarding = _import_onboarding()
    with pytest.raises(HTTPException) as exc:
        _run_invite(onboarding, tier="pro", users_count=5, invites_count=0)
    assert exc.value.status_code == 403
    assert "Seat limit reached" in str(exc.value.detail)


def test_business_allows_up_to_twelve_users():
    onboarding = _import_onboarding()
    result = _run_invite(onboarding, tier="business", users_count=11, invites_count=0)
    assert result.invite_link.startswith("/invite/accept?token=")


def test_business_blocks_thirteenth_user():
    onboarding = _import_onboarding()
    with pytest.raises(HTTPException) as exc:
        _run_invite(onboarding, tier="business", users_count=12, invites_count=0)
    assert exc.value.status_code == 403
    assert "Seat limit reached" in str(exc.value.detail)


def test_pending_invites_count_toward_cap():
    onboarding = _import_onboarding()
    with pytest.raises(HTTPException) as exc:
        _run_invite(onboarding, tier="pro", users_count=4, invites_count=1)
    assert exc.value.status_code == 403
    assert "Seat limit reached" in str(exc.value.detail)


def test_integration_policy_no_paid_connector_count_cap():
    integrations_src = (ROOT / "routes" / "integrations.py").read_text(encoding="utf-8")
    email_src = (ROOT / "routes" / "email.py").read_text(encoding="utf-8")

    assert "if tier == 'free':\n        return 1\n    return None" in integrations_src
    assert "if tier == 'free':\n        return 1\n    return None" in email_src
