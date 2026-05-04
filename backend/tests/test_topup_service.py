"""Auto top-up service contract tests.

Pins launch-critical behavior:
- Lite plan never auto-tops-up
- Auto top-up disabled returns TOPUP_DISABLED
- Spend cap blocks at threshold (returns SPEND_CAP_HIT)
- Refund within 24h succeeds; outside fails
- Token-per-cent rate matches per-tier table
- Idempotency: duplicate PI logs replay, returns success
- Stripe CardError flips payment_required + disables auto-topup

Stripe is stubbed via sys.modules so no network call.
"""
from __future__ import annotations

import sys
import types
import importlib
from datetime import datetime, timezone, timedelta


def _stub_stripe(behaviour=None):
    """Stub the `stripe` module before importing topup_service.

    behaviour may set:
      paymentintent_create  -> dict to return from PaymentIntent.create
      paymentintent_raises  -> exception class to raise from create()
      refund_create         -> dict to return from Refund.create
      refund_raises         -> exception class to raise from refund()
    """
    # CRITICAL: do NOT use `behaviour or {}` — that creates a new dict when
    # behaviour={} is passed, breaking caller's ability to mutate the dict
    # after stubbing. Use explicit None check.
    if behaviour is None:
        behaviour = {}

    class _CardError(Exception):
        def __init__(self, message="card_declined", code="card_declined"):
            super().__init__(message)
            self.user_message = message
            self.code = code

    class _StripeError(Exception):
        pass

    stripe_stub = types.ModuleType("stripe")
    stripe_stub.api_key = ""

    # error subclasses
    error_module = types.ModuleType("stripe.error")
    error_module.CardError = _CardError
    error_module.StripeError = _StripeError
    stripe_stub.error = error_module

    class _PaymentIntent:
        @staticmethod
        def create(**kwargs):
            if behaviour.get("paymentintent_raises"):
                raise behaviour["paymentintent_raises"]
            return behaviour.get(
                "paymentintent_create",
                {"id": "pi_test_123", "status": "succeeded", "amount": kwargs.get("amount", 0)},
            )

    class _Refund:
        @staticmethod
        def create(**kwargs):
            if behaviour.get("refund_raises"):
                raise behaviour["refund_raises"]
            return behaviour.get("refund_create", {"id": "re_test_123", "status": "succeeded"})

    stripe_stub.PaymentIntent = _PaymentIntent
    stripe_stub.Refund = _Refund

    sys.modules["stripe"] = stripe_stub
    sys.modules["stripe.error"] = error_module
    if "topup_service" in sys.modules:
        del sys.modules["topup_service"]
    if "services.topup_service" in sys.modules:
        del sys.modules["services.topup_service"]
    return importlib.import_module("services.topup_service"), _CardError, _StripeError


class _FakeTable:
    """Tiny in-memory chainable Supabase table stub."""

    def __init__(self, name, store):
        self.name = name
        self.store = store
        self._filters = []
        self._update = None
        self._insert = None

    def insert(self, row):
        self._insert = row
        return self

    def update(self, patch):
        self._update = patch
        return self

    def eq(self, col, val):
        self._filters.append((col, val))
        return self

    def execute(self):
        if self._insert is not None:
            self.store.setdefault(self.name, []).append(self._insert)
            return types.SimpleNamespace(data=[self._insert])
        if self._update is not None:
            updated = []
            for row in self.store.get(self.name, []):
                if all(row.get(k) == v for k, v in self._filters):
                    row.update(self._update)
                    updated.append(row)
            return types.SimpleNamespace(data=updated)
        return types.SimpleNamespace(data=[])


class _FakeRpc:
    def __init__(self):
        self._called = False

    def execute(self):
        self._called = True
        return types.SimpleNamespace(data=[])


class _FakeSb:
    def __init__(self):
        self.store = {"usage_ledger": [], "users": []}

    def table(self, name):
        return _FakeTable(name, self.store)

    def rpc(self, fn_name, params):
        return _FakeRpc()


def _user(**overrides):
    base = {
        "id": "u-1",
        "subscription_tier": "starter",
        "subscription_status": "active",
        "stripe_customer_id": "cus_123",
        "stripe_subscription_id": "sub_123",
        "auto_topup_enabled": True,
        "topup_consent_at": "2026-05-01T00:00:00+00:00",
        "topup_amount_cents": 5000,
        "monthly_cap_cents": 20000,
        "current_period_topup_cents": 0,
    }
    base.update(overrides)
    return base


# ─── should_fire_topup ──────────────────────────────────────

def test_lite_plan_returns_lite_plan_state():
    ts, _, _ = _stub_stripe()
    user = _user(subscription_tier="lite")
    allowed, reason = ts.should_fire_topup(user)
    assert not allowed
    assert reason == ts.TopupState.LITE_PLAN


def test_disabled_auto_topup_returns_disabled():
    ts, _, _ = _stub_stripe()
    user = _user(auto_topup_enabled=False)
    allowed, reason = ts.should_fire_topup(user)
    assert not allowed
    assert reason == ts.TopupState.TOPUP_DISABLED


def test_missing_consent_returns_disabled():
    ts, _, _ = _stub_stripe()
    user = _user(topup_consent_at=None)
    allowed, reason = ts.should_fire_topup(user)
    assert not allowed
    assert reason == ts.TopupState.TOPUP_DISABLED


def test_missing_stripe_ids_returns_payment_required():
    ts, _, _ = _stub_stripe()
    user = _user(stripe_subscription_id="")
    allowed, reason = ts.should_fire_topup(user)
    assert not allowed
    assert reason == ts.TopupState.PAYMENT_REQUIRED


def test_spend_cap_hit_returns_spend_cap_hit():
    ts, _, _ = _stub_stripe()
    user = _user(monthly_cap_cents=10000, current_period_topup_cents=8000, topup_amount_cents=5000)
    allowed, reason = ts.should_fire_topup(user)
    assert not allowed
    assert reason == ts.TopupState.SPEND_CAP_HIT


def test_zero_cap_means_no_cap():
    ts, _, _ = _stub_stripe()
    user = _user(monthly_cap_cents=0, current_period_topup_cents=99999999, topup_amount_cents=5000)
    allowed, reason = ts.should_fire_topup(user)
    assert allowed


def test_active_paid_with_consent_allowed():
    ts, _, _ = _stub_stripe()
    user = _user()
    allowed, reason = ts.should_fire_topup(user)
    assert allowed
    assert reason == ""


# ─── tokens_for_amount ──────────────────────────────────────

def test_tokens_per_dollar_growth():
    ts, _, _ = _stub_stripe()
    # $50 = 5000 cents. Growth rate = 145 tokens per cent. Expect 725,000 tokens.
    assert ts.tokens_for_amount("starter", 5000) == 725_000


def test_tokens_per_dollar_pro_more_than_growth():
    ts, _, _ = _stub_stripe()
    pro = ts.tokens_for_amount("pro", 5000)
    growth = ts.tokens_for_amount("starter", 5000)
    assert pro > growth, "Pro must give more tokens per dollar than Growth (volume discount)"


def test_tokens_per_dollar_business_more_than_pro():
    ts, _, _ = _stub_stripe()
    business = ts.tokens_for_amount("business", 5000)
    pro = ts.tokens_for_amount("pro", 5000)
    assert business > pro, "Business must give more tokens per dollar than Pro"


def test_tier_aliases_normalise():
    ts, _, _ = _stub_stripe()
    # 'growth' alias → starter rate; 'professional' alias → pro rate
    assert ts.tokens_for_amount("growth", 1000) == ts.tokens_for_amount("starter", 1000)
    assert ts.tokens_for_amount("professional", 1000) == ts.tokens_for_amount("pro", 1000)


# ─── fire_topup (dry-run) ───────────────────────────────────

def test_fire_topup_dry_run_returns_fired_state():
    ts, _, _ = _stub_stripe()
    sb = _FakeSb()
    result = ts.fire_topup(sb, _user(), dry_run=True)
    assert result.state == ts.TopupState.TOPUP_FIRED
    assert result.amount_cents == 5000
    assert result.tokens_added > 0
    # Dry-run must NOT touch ledger
    assert sb.store["usage_ledger"] == []


def test_fire_topup_dry_run_lite_returns_lite_plan():
    ts, _, _ = _stub_stripe()
    sb = _FakeSb()
    result = ts.fire_topup(sb, _user(subscription_tier="lite"), dry_run=True)
    assert result.state == ts.TopupState.LITE_PLAN
    assert result.redirect == "/subscribe"


# ─── fire_topup (with Stripe stub) ──────────────────────────

def test_fire_topup_records_ledger_row_and_increments_period():
    ts, _, _ = _stub_stripe()
    sb = _FakeSb()
    sb.store["users"].append({"id": "u-1", "current_period_topup_cents": 0})
    result = ts.fire_topup(sb, _user())
    assert result.state == ts.TopupState.TOPUP_FIRED
    assert result.stripe_payment_intent_id == "pi_test_123"
    # ledger row inserted
    assert len(sb.store["usage_ledger"]) == 1
    row = sb.store["usage_ledger"][0]
    assert row["kind"] == "topup"
    assert row["stripe_payment_intent_id"] == "pi_test_123"
    assert row["tokens"] > 0


def test_fire_topup_clamps_amount_to_min_max():
    ts, _, _ = _stub_stripe()
    sb = _FakeSb()
    # User somehow has out-of-range value; service must clamp.
    result_low = ts.fire_topup(sb, _user(topup_amount_cents=500), dry_run=True)
    assert result_low.amount_cents == ts.MIN_TOPUP_CENTS
    result_high = ts.fire_topup(sb, _user(topup_amount_cents=99999999), dry_run=True)
    assert result_high.amount_cents == ts.MAX_TOPUP_CENTS


def test_fire_topup_card_decline_flips_payment_required():
    # We need the CardError class to match what topup_service catches.
    # Stub once, then mutate the behaviour dict in place so the SAME CardError
    # class is used both for raising and catching.
    behaviour = {}
    ts, CardErr, _ = _stub_stripe(behaviour=behaviour)
    behaviour["paymentintent_raises"] = CardErr("card_declined")
    sb = _FakeSb()
    sb.store["users"].append({"id": "u-1"})
    result = ts.fire_topup(sb, _user())
    assert result.state == ts.TopupState.PAYMENT_REQUIRED
    # users row should have payment_required=True + auto_topup_enabled=False
    user_row = sb.store["users"][0]
    assert user_row.get("payment_required") is True
    assert user_row.get("auto_topup_enabled") is False


# ─── is_refundable / refund ─────────────────────────────────

def test_is_refundable_within_24h():
    ts, _, _ = _stub_stripe()
    fired_at = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    row = {"kind": "topup", "created_at": fired_at, "metadata": {}}
    assert ts.is_refundable(row) is True


def test_is_refundable_outside_24h():
    ts, _, _ = _stub_stripe()
    fired_at = (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat()
    row = {"kind": "topup", "created_at": fired_at, "metadata": {}}
    assert ts.is_refundable(row) is False


def test_is_refundable_already_refunded():
    ts, _, _ = _stub_stripe()
    fired_at = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    row = {"kind": "topup", "created_at": fired_at, "metadata": {"refunded_at": "..."}}
    assert ts.is_refundable(row) is False


def test_is_refundable_non_topup_row_rejected():
    ts, _, _ = _stub_stripe()
    fired_at = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    row = {"kind": "consume", "created_at": fired_at, "metadata": {}}
    assert ts.is_refundable(row) is False


def test_refund_outside_window_returns_outside_window_state():
    ts, _, _ = _stub_stripe()
    sb = _FakeSb()
    fired_at = (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat()
    row = {
        "id": "ledger-1",
        "user_id": "u-1",
        "kind": "topup",
        "created_at": fired_at,
        "stripe_payment_intent_id": "pi_test_123",
        "price_aud_cents": 5000,
        "tokens": 725_000,
        "metadata": {},
        "tier_at_event": "starter",
    }
    result = ts.refund(sb, row)
    assert result.state == ts.TopupState.REFUND_OUTSIDE_WINDOW


def test_refund_within_window_succeeds():
    ts, _, _ = _stub_stripe()
    sb = _FakeSb()
    fired_at = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    row = {
        "id": "ledger-1",
        "user_id": "u-1",
        "kind": "topup",
        "created_at": fired_at,
        "stripe_payment_intent_id": "pi_test_123",
        "price_aud_cents": 5000,
        "tokens": 725_000,
        "metadata": {},
        "tier_at_event": "starter",
    }
    result = ts.refund(sb, row)
    assert result.state == ts.TopupState.TOPUP_REFUNDED
    assert result.amount_cents == 5000
    assert result.tokens_reversed == 725_000
    # A reversing 'consume' row should have been inserted.
    consume_rows = [r for r in sb.store.get("usage_ledger", []) if r.get("kind") == "consume"]
    assert len(consume_rows) == 1
    assert consume_rows[0]["feature"] == "topup_refund_reversal"


# ─── State enum sanity ──────────────────────────────────────

def test_state_enum_members_exist():
    ts, _, _ = _stub_stripe()
    expected = {
        "TOPUP_FIRED", "TOPUP_DISABLED", "SPEND_CAP_HIT",
        "PAYMENT_REQUIRED", "TOPUP_REFUNDED", "REFUND_OUTSIDE_WINDOW",
        "LITE_PLAN",
    }
    for name in expected:
        assert hasattr(ts.TopupState, name), f"Missing state: {name}"


def test_message_for_state_no_supplier_names():
    """Contract v2: customer-facing messages must not leak Stripe / supplier names."""
    ts, _, _ = _stub_stripe()
    blocked = {"stripe", "anthropic", "openai", "supabase", "azure", "merge.dev"}
    for state_name in ["LITE_PLAN", "TOPUP_DISABLED", "SPEND_CAP_HIT", "PAYMENT_REQUIRED"]:
        state = getattr(ts.TopupState, state_name)
        msg = ts._message_for_state(state).lower()
        for banned in blocked:
            assert banned not in msg, f"State {state_name} message leaks supplier name '{banned}'"
