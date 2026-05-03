"""Contract tests for Stripe price mapping + shared trial enforcement."""
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

from core.plans import allocation_for


class _Obj(dict):
    def __getattr__(self, item):
        try:
            return self[item]
        except KeyError as exc:
            raise AttributeError(item) from exc


class _FakeTable:
    def __init__(self, sb: "_FakeSb", name: str):
        self.sb = sb
        self.name = name
        self._eq: Dict[str, Any] = {}
        self._in: Dict[str, List[Any]] = {}
        self._insert_payload = None

    def select(self, *args, **kwargs):
        return self

    def eq(self, key, value):
        self._eq[key] = value
        return self

    def in_(self, key, value):
        self._in[key] = value
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def gte(self, *args, **kwargs):
        return self

    def lt(self, *args, **kwargs):
        return self

    def maybe_single(self):
        return self

    def update(self, *args, **kwargs):
        return self

    def upsert(self, *args, **kwargs):
        return self

    def insert(self, payload):
        self._insert_payload = payload
        self.sb.inserts.append((self.name, payload))
        return self

    def execute(self):
        if self.name == "users":
            if "id" in self._eq:
                if self.sb.fail_users_lookup:
                    raise RuntimeError("users lookup failed")
                return _Obj({"data": [self.sb.user_row] if self.sb.user_row else []})
            if "account_id" in self._eq:
                if self.sb.fail_account_scan:
                    raise RuntimeError("account scan failed")
                return _Obj({"data": self.sb.account_rows})
        if self.name == "payment_transactions":
            if self.sb.fail_payment_lookup:
                raise RuntimeError("payment history lookup failed")
            return _Obj({"data": self.sb.payment_rows})
        return _Obj({"data": []})


class _FakeSb:
    def __init__(self, user_row: Optional[Dict[str, Any]] = None, account_rows: Optional[List[Dict[str, Any]]] = None, payment_rows: Optional[List[Dict[str, Any]]] = None):
        self.user_row = user_row or {}
        self.account_rows = account_rows or []
        self.payment_rows = payment_rows or []
        self.inserts: List[Any] = []
        self.fail_users_lookup = False
        self.fail_account_scan = False
        self.fail_payment_lookup = False

    def table(self, name: str):
        return _FakeTable(self, name)


@pytest.fixture
def stripe_payments_module(monkeypatch):
    monkeypatch.setenv("STRIPE_API_KEY", "sk_test_unit")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_unit")
    monkeypatch.setenv("FRONTEND_URL", "https://biqc.ai")
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("PRODUCTION", raising=False)

    sb_stub = types.ModuleType("supabase_client")
    sb_stub.init_supabase = lambda: _FakeSb()
    monkeypatch.setitem(sys.modules, "supabase_client", sb_stub)

    auth_stub = types.ModuleType("routes.auth")

    async def _get_current_user():
        return {"id": "user-1", "email": "buyer@example.com"}

    auth_stub.get_current_user = _get_current_user
    monkeypatch.setitem(sys.modules, "routes.auth", auth_stub)

    deps_stub = types.ModuleType("routes.deps")
    deps_stub.get_sb = lambda: _FakeSb()
    monkeypatch.setitem(sys.modules, "routes.deps", deps_stub)

    if "routes.stripe_payments" in sys.modules:
        del sys.modules["routes.stripe_payments"]
    return importlib.import_module("routes.stripe_payments")


def _run(coro):
    return asyncio.run(coro)


def test_lite_price_mapping(stripe_payments_module):
    module = stripe_payments_module
    assert module.STRIPE_PRODUCT_IDS["lite"] == "prod_URgYIlMeF24vrN"
    assert module.STRIPE_EXPECTED_MONTHLY_PRICE_IDS["lite"] == "price_1TSnBMRoX8RKDDG5akGL7RkT"


def test_growth_price_mapping(stripe_payments_module):
    module = stripe_payments_module
    assert module.STRIPE_PRODUCT_IDS["growth"] == "prod_U8D8vKuXXK7qhO"
    assert module.STRIPE_EXPECTED_MONTHLY_PRICE_IDS["growth"] == "price_1T9wiVRoX8RKDDG5AOSi8Cu6"


def test_pro_price_mapping(stripe_payments_module):
    module = stripe_payments_module
    assert module.STRIPE_PRODUCT_IDS["pro"] == "prod_ULf4KFDh0UKpeR"
    assert module.STRIPE_EXPECTED_MONTHLY_PRICE_IDS["pro"] == "price_1TMxjtRoX8RKDDG5btgRBrRu"


def test_business_price_mapping(stripe_payments_module):
    module = stripe_payments_module
    assert module.STRIPE_PRODUCT_IDS["business"] == "prod_ULfA7QJoT3Ontk"
    assert module.STRIPE_EXPECTED_MONTHLY_PRICE_IDS["business"] == "price_1TMxplRoX8RKDDG59IaUg7aV"


def test_trial_applied_for_eligible_new_user(stripe_payments_module, monkeypatch):
    module = stripe_payments_module
    sb = _FakeSb(user_row={"id": "user-1", "subscription_status": None, "subscription_tier": "trial", "account_id": "acct-1"})
    monkeypatch.setattr(module, "_get_service_supabase", lambda: sb)
    monkeypatch.setattr(module, "_resolve_governed_plan", lambda *_: None)
    monkeypatch.setattr(module, "_resolve_active_monthly_price", lambda *_: {"id": "price_growth", "product_id": "prod_growth"})

    captured = {}

    def _fake_checkout_create(**kwargs):
        captured.update(kwargs)
        return _Obj({"id": "cs_123", "url": "https://stripe.example/checkout", "customer": None, "subscription": None})

    monkeypatch.setattr(module.stripe.checkout.Session, "create", _fake_checkout_create)

    req = module.CheckoutRequest(tier="starter")
    _run(module.create_checkout(req=req, request=None, current_user={"id": "user-1", "email": "buyer@example.com"}))
    assert captured["subscription_data"]["trial_period_days"] == 14


def test_trial_not_applied_after_trial_already_used(stripe_payments_module):
    module = stripe_payments_module
    sb = _FakeSb(
        user_row={"id": "user-1", "subscription_status": "canceled", "subscription_tier": "starter", "account_id": "acct-1"},
        payment_rows=[{"id": "tx-1"}],
    )
    assert module._trial_days_for_user(sb, "user-1", account_id="acct-1") == 0


def test_trial_not_applied_for_existing_subscription(stripe_payments_module):
    module = stripe_payments_module
    sb = _FakeSb(user_row={"id": "user-1", "subscription_status": "active", "subscription_tier": "starter", "account_id": "acct-1"})
    assert module._trial_days_for_user(sb, "user-1", account_id="acct-1") == 0


def test_shared_trial_logic_across_checkout_paths(stripe_payments_module, monkeypatch):
    module = stripe_payments_module
    sb = _FakeSb(
        user_row={
            "id": "user-1",
            "subscription_status": None,
            "subscription_tier": "trial",
            "trial_ends_at": None,
            "account_id": "acct-1",
            "email": "buyer@example.com",
            "full_name": "Buyer One",
            "email_verified_by_user": False,
        }
    )
    monkeypatch.setattr(module, "_get_service_supabase", lambda: sb)
    monkeypatch.setattr(module, "_resolve_governed_plan", lambda *_: None)
    monkeypatch.setattr(module, "_resolve_active_monthly_price", lambda *_: {"id": "price_growth", "product_id": "prod_growth"})
    monkeypatch.setattr(module, "_apply_tier_upgrade", lambda *args, **kwargs: None)
    monkeypatch.setattr(module, "_update_subscription_lifecycle", lambda *args, **kwargs: None)

    checkout_captured = {}
    sub_captured = {}

    monkeypatch.setattr(
        module.stripe.checkout.Session,
        "create",
        lambda **kwargs: checkout_captured.update(kwargs) or _Obj({"id": "cs_123", "url": "https://stripe.example/checkout", "customer": None, "subscription": None}),
    )
    monkeypatch.setattr(module.stripe.Customer, "retrieve", lambda _cid: _Obj({"metadata": {"user_id": "user-1"}}))
    monkeypatch.setattr(module.stripe.Customer, "modify", lambda *args, **kwargs: _Obj({}))
    monkeypatch.setattr(
        module.stripe.Subscription,
        "create",
        lambda **kwargs: sub_captured.update(kwargs) or _Obj({"id": "sub_123", "status": "trialing", "trial_end": None, "current_period_end": None}),
    )

    req_checkout = module.CheckoutRequest(tier="starter")
    _run(module.create_checkout(req=req_checkout, request=None, current_user={"id": "user-1", "email": "buyer@example.com"}))
    req_signup = module.ConfirmTrialSignupRequest(customer_id="cus_123", payment_method_id="pm_12345678", plan="starter")
    _run(module.confirm_trial_signup(req=req_signup, current_user={"id": "user-1", "email": "buyer@example.com"}))

    assert checkout_captured["subscription_data"]["trial_period_days"] == 14
    assert sub_captured["trial_period_days"] == 14


def test_lite_entitlement_allocation(stripe_payments_module):
    module = stripe_payments_module
    # Lite is currently catalog-mapped but safely disabled from active checkout;
    # entitlement fallback must remain predictable.
    assert allocation_for("lite") == allocation_for("free")
    assert "lite" not in module.PLANS


def test_lite_disabled_from_active_checkout(stripe_payments_module):
    module = stripe_payments_module
    req = module.CheckoutRequest(tier="lite")
    with pytest.raises(HTTPException) as exc:
        _run(module.create_checkout(req=req, request=None, current_user={"id": "user-1", "email": "buyer@example.com"}))
    assert exc.value.status_code == 400


def test_trial_lookup_failure_does_not_apply_trial_checkout(stripe_payments_module, monkeypatch):
    module = stripe_payments_module
    sb = _FakeSb(user_row={"id": "user-1", "account_id": "acct-1"})
    sb.fail_users_lookup = True
    monkeypatch.setattr(module, "_get_service_supabase", lambda: sb)
    monkeypatch.setattr(module, "_resolve_governed_plan", lambda *_: None)
    monkeypatch.setattr(module, "_resolve_active_monthly_price", lambda *_: {"id": "price_growth", "product_id": "prod_growth"})
    captured = {}
    monkeypatch.setattr(
        module.stripe.checkout.Session,
        "create",
        lambda **kwargs: captured.update(kwargs) or _Obj({"id": "cs_123", "url": "https://stripe.example/checkout", "customer": None, "subscription": None}),
    )
    req = module.CheckoutRequest(tier="starter")
    _run(module.create_checkout(req=req, request=None, current_user={"id": "user-1", "email": "buyer@example.com"}))
    assert "subscription_data" not in captured
    assert captured["metadata"]["trial_applied"] == "0"


def test_checkout_metadata_marks_trial_not_applied_when_unverified(stripe_payments_module, monkeypatch):
    module = stripe_payments_module
    sb = _FakeSb(user_row={"id": "user-1", "account_id": "acct-1"})
    sb.fail_users_lookup = True
    monkeypatch.setattr(module, "_get_service_supabase", lambda: sb)
    monkeypatch.setattr(module, "_resolve_governed_plan", lambda *_: None)
    monkeypatch.setattr(module, "_resolve_active_monthly_price", lambda *_: {"id": "price_growth", "product_id": "prod_growth"})
    captured = {}
    monkeypatch.setattr(
        module.stripe.checkout.Session,
        "create",
        lambda **kwargs: captured.update(kwargs) or _Obj({"id": "cs_123", "url": "https://stripe.example/checkout", "customer": None, "subscription": None}),
    )
    req = module.CheckoutRequest(tier="starter")
    _run(module.create_checkout(req=req, request=None, current_user={"id": "user-1", "email": "buyer@example.com"}))
    assert captured["metadata"]["trial_reason"] == "trial_eligibility_unverified"
    assert captured["metadata"]["trial_days"] == "0"


def test_trial_lookup_failure_blocks_confirm_trial_signup_or_sets_trial_zero(stripe_payments_module, monkeypatch):
    module = stripe_payments_module
    sb = _FakeSb(user_row={"id": "user-1", "subscription_status": None, "subscription_tier": "trial", "trial_ends_at": None, "account_id": "acct-1"})
    sb.fail_users_lookup = True
    monkeypatch.setattr(module, "_get_service_supabase", lambda: sb)
    monkeypatch.setattr(module.stripe.Customer, "retrieve", lambda _cid: _Obj({"metadata": {"user_id": "user-1"}}))
    req = module.ConfirmTrialSignupRequest(customer_id="cus_123", payment_method_id="pm_12345678", plan="starter")
    with pytest.raises(HTTPException) as exc:
        _run(module.confirm_trial_signup(req=req, current_user={"id": "user-1", "email": "buyer@example.com"}))
    assert exc.value.status_code == 503


def test_trial_lookup_failure_is_fail_closed_for_account_scan(stripe_payments_module):
    module = stripe_payments_module
    sb = _FakeSb(
        user_row={"id": "user-1", "subscription_status": None, "subscription_tier": "trial", "account_id": "acct-1"},
        account_rows=[],
        payment_rows=[],
    )
    sb.fail_account_scan = True
    decision = module._trial_decision_for_user(sb, "user-1", account_id="acct-1")
    assert decision["trial_days"] == 0
    assert decision["reason"] == "trial_eligibility_unverified"


def test_success_redirect_not_subscribe_loop():
    app_js = (ROOT.parent / "frontend" / "src" / "App.js").read_text(encoding="utf-8")
    assert "buildLegacyUpgradeSuccessRedirectPath" in app_js
    assert "return `/advisor?" in app_js
    assert "return <Navigate to={buildLegacyUpgradeSuccessRedirectPath(location.search)} replace />;" in app_js
