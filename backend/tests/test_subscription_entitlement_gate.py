"""Commercial subscription gate contract tests.

Pins launch-critical access behavior:
- paid app access requires active/trialing status + Stripe customer + subscription ids
- unhealthy/missing billing states resolve to internal free (blocked)
- free/internal state is blocked from paid app routes and APIs
"""
from __future__ import annotations

import sys
import types
import importlib


def _user(**overrides):
    base = {
        "id": "u-1",
        "email": "owner@example.com",
        "role": "user",
        "subscription_tier": "starter",
        "subscription_status": "active",
        "stripe_customer_id": "cus_123",
        "stripe_subscription_id": "sub_123",
    }
    base.update(overrides)
    return base


def _tier_resolver():
    auth_stub = types.ModuleType("auth_supabase")
    auth_stub.MASTER_ADMIN_EMAIL = "admin@example.com"
    sys.modules["auth_supabase"] = auth_stub
    if "tier_resolver" in sys.modules:
        del sys.modules["tier_resolver"]
    return importlib.import_module("tier_resolver")


def test_customer_without_subscription_id_is_blocked():
    tr = _tier_resolver()
    user = _user(stripe_subscription_id="")
    assert tr.resolve_tier(user) == "free"


def test_inactive_or_missing_subscription_status_is_blocked():
    tr = _tier_resolver()
    for status in ("", "canceled", "cancelled", "incomplete", "incomplete_expired", "past_due", "unpaid"):
        assert tr.resolve_tier(_user(subscription_status=status)) == "free"


def test_active_subscription_maps_to_paid_tier():
    tr = _tier_resolver()
    assert tr.resolve_tier(_user(subscription_tier="professional", subscription_status="active")) == "pro"
    assert tr.resolve_tier(_user(subscription_tier="business", subscription_status="active")) == "business"


def test_trial_only_gets_paid_access_when_stripe_active_and_linked():
    tr = _tier_resolver()
    assert tr.resolve_tier(_user(subscription_tier="trial", subscription_status="trialing")) == "starter"
    assert tr.resolve_tier(_user(subscription_tier="trial", subscription_status="trialing", stripe_subscription_id="")) == "free"


def test_free_internal_state_blocked_from_paid_routes():
    tr = _tier_resolver()
    free_user = _user(subscription_status="canceled")
    assert tr.resolve_tier(free_user) == "free"

    assert tr.check_route_access("/advisor", free_user)["allowed"] is False
    assert tr.check_route_access("/integrations", free_user)["allowed"] is False
    assert tr.check_route_access("/calibration", free_user)["allowed"] is False


def test_free_internal_state_blocked_from_paid_apis():
    tr = _tier_resolver()
    free_user = _user(subscription_status="incomplete")
    assert tr.resolve_tier(free_user) == "free"

    assert tr.check_api_access("/soundboard", free_user)["allowed"] is False
    assert tr.check_api_access("/cognitive", free_user)["allowed"] is False
    assert tr.check_api_access("/integrations", free_user)["allowed"] is False
    assert tr.check_api_access("/calibration", free_user)["allowed"] is False
