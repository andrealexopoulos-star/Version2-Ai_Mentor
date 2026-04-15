"""Unit tests for Stripe Tax / GST / ABN gating in checkout creation
(Step 7 / P1-2).

What this guards:
  - When STRIPE_TAX_ENABLED is unset/false, automatic_tax and
    tax_id_collection must NOT be passed to stripe.checkout.Session.create,
    because flipping them on without the Stripe Tax dashboard registration
    causes Stripe to reject the request.
  - When STRIPE_TAX_ENABLED is truthy, the full tax collection tuple
    (automatic_tax, tax_id_collection, billing_address_collection,
    customer_update, line_items[0].price_data.tax_behavior=inclusive)
    must all be set together — they are a coupled set.
  - The session metadata always tags tax_enabled so downstream tooling
    (reconciliation, accounting exports) can tell tax-inclusive sessions
    apart.
"""
from __future__ import annotations

import asyncio
import importlib
import sys
import types
from pathlib import Path
from typing import Any, Dict

import pytest


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


class _Obj(dict):
    def __getattr__(self, item):
        try:
            return self[item]
        except KeyError as exc:
            raise AttributeError(item) from exc


class _NoopSb:
    """Swallows every .table(x).insert/update/select(...).execute() call."""

    def table(self, name: str):
        return self

    def insert(self, payload: Any):
        return self

    def update(self, payload: Any):
        return self

    def select(self, *args, **kwargs):
        return self

    def eq(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def maybe_single(self):
        return self

    def execute(self):
        return _Obj({"data": []})


@pytest.fixture
def stripe_payments_module(monkeypatch):
    monkeypatch.setenv("STRIPE_API_KEY", "sk_test_unit")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_unit")
    # Allowlist biqc.ai for the checkout origin check — without this the
    # handler 400s before reaching the stripe.checkout.Session.create call.
    monkeypatch.setenv("FRONTEND_URL", "https://biqc.ai")
    monkeypatch.delenv("STRIPE_TAX_ENABLED", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.delenv("PRODUCTION", raising=False)

    sb_stub = types.ModuleType("supabase_client")
    sb_stub.init_supabase = lambda: _NoopSb()
    monkeypatch.setitem(sys.modules, "supabase_client", sb_stub)

    auth_stub = types.ModuleType("routes.auth")
    async def _get_current_user():
        return {"id": "stub", "email": "stub@example.com"}
    auth_stub.get_current_user = _get_current_user
    monkeypatch.setitem(sys.modules, "routes.auth", auth_stub)

    deps_stub = types.ModuleType("routes.deps")
    deps_stub.get_sb = lambda: _NoopSb()
    monkeypatch.setitem(sys.modules, "routes.deps", deps_stub)

    if "routes.stripe_payments" in sys.modules:
        del sys.modules["routes.stripe_payments"]
    module = importlib.import_module("routes.stripe_payments")
    return module


def _capture_create(module, monkeypatch):
    """Patch stripe.checkout.Session.create to record its kwargs instead
    of calling Stripe. Returns the dict that tests can assert on after
    exercising the handler."""
    captured: Dict[str, Any] = {}

    def _fake_create(**kwargs):
        captured.clear()
        captured.update(kwargs)
        return _Obj({
            "id": "cs_test_captured",
            "url": "https://stripe-mock/x",
            "customer": None,
            "subscription": None,
        })

    monkeypatch.setattr(module.stripe.checkout.Session, "create", _fake_create)
    # Governed plan lookup requires DB — force the static fallback.
    monkeypatch.setattr(module, "_resolve_governed_plan", lambda sb, plan_id: None)
    return captured


def _run(coro):
    return asyncio.run(coro)


def _exercise(module, tier: str = "starter"):
    req = module.CheckoutRequest(tier=tier)
    return _run(
        module.create_checkout(
            req=req,
            request=None,  # handler doesn't use it
            current_user={"id": "user-1", "email": "buyer@example.com"},
        )
    )


# ─── Tests ────────────────────────────────────────────────────────

def test_stripe_tax_flag_default_false(stripe_payments_module):
    """Sanity: the feature flag defaults to False when env var is unset."""
    assert stripe_payments_module._stripe_tax_enabled() is False


@pytest.mark.parametrize("value", ["1", "true", "TRUE", "yes", "on"])
def test_stripe_tax_flag_truthy_values(stripe_payments_module, monkeypatch, value):
    monkeypatch.setenv("STRIPE_TAX_ENABLED", value)
    assert stripe_payments_module._stripe_tax_enabled() is True


@pytest.mark.parametrize("value", ["0", "false", "", "no", "off", "definitely_not"])
def test_stripe_tax_flag_falsy_values(stripe_payments_module, monkeypatch, value):
    monkeypatch.setenv("STRIPE_TAX_ENABLED", value)
    assert stripe_payments_module._stripe_tax_enabled() is False


def test_checkout_omits_tax_params_when_flag_off(stripe_payments_module, monkeypatch):
    """Guard against accidental enablement: if the env flag is unset,
    the Stripe call must NOT include tax params. Live-tax params against
    an un-registered account return a 400 from Stripe and would block
    all checkouts."""
    module = stripe_payments_module
    captured = _capture_create(module, monkeypatch)

    _exercise(module)

    assert "automatic_tax" not in captured
    assert "tax_id_collection" not in captured
    assert "billing_address_collection" not in captured
    assert "customer_update" not in captured
    assert "tax_behavior" not in captured["line_items"][0]["price_data"]
    # Metadata still tags the state so accounting tooling can filter.
    assert captured["metadata"]["tax_enabled"] == "0"


def test_checkout_includes_all_tax_params_when_flag_on(stripe_payments_module, monkeypatch):
    """When Stripe Tax is activated, all five settings must ship together
    as a coupled unit. Missing even one (e.g. tax_behavior) produces
    invoices with the wrong tax arithmetic."""
    monkeypatch.setenv("STRIPE_TAX_ENABLED", "1")
    module = stripe_payments_module
    captured = _capture_create(module, monkeypatch)

    _exercise(module)

    assert captured["automatic_tax"] == {"enabled": True}
    assert captured["tax_id_collection"] == {"enabled": True}
    assert captured["billing_address_collection"] == "required"
    assert captured["customer_update"] == {"address": "auto", "name": "auto"}
    # AU convention — advertised price is GST-inclusive, Stripe must
    # subtract GST from the displayed amount rather than adding on top.
    assert captured["line_items"][0]["price_data"]["tax_behavior"] == "inclusive"
    assert captured["metadata"]["tax_enabled"] == "1"


def test_checkout_metadata_preserves_existing_fields_when_tax_on(stripe_payments_module, monkeypatch):
    """Regression guard: flipping the tax flag on must not drop the other
    metadata fields (user_id, tier, pricing_source, etc) that the
    webhook pipeline relies on."""
    monkeypatch.setenv("STRIPE_TAX_ENABLED", "1")
    module = stripe_payments_module
    captured = _capture_create(module, monkeypatch)

    _exercise(module, tier="pro")

    meta = captured["metadata"]
    for required_key in (
        "user_id",
        "user_email",
        "tier",
        "source",
        "pricing_source",
        "pricing_plan_key",
        "pricing_plan_version",
        "tax_enabled",
    ):
        assert required_key in meta, f"metadata missing {required_key}"
    assert meta["tier"] == "pro"
    assert meta["user_id"] == "user-1"


def test_checkout_tax_behavior_only_on_line_item_when_enabled(stripe_payments_module, monkeypatch):
    """Subtle Stripe behaviour: tax_behavior is a PER-PRICE setting, not
    a session-level one. It must live inside line_items[0].price_data,
    never at the top level."""
    monkeypatch.setenv("STRIPE_TAX_ENABLED", "1")
    module = stripe_payments_module
    captured = _capture_create(module, monkeypatch)

    _exercise(module)

    assert "tax_behavior" not in captured  # never top-level
    assert captured["line_items"][0]["price_data"]["tax_behavior"] == "inclusive"


def test_company_abn_and_legal_name_defaults(stripe_payments_module, monkeypatch):
    """Legal-entity defaults should fall back to BIQc's registered name
    when BIQC_COMPANY_LEGAL_NAME env var is unset, and ABN stays empty
    until Andreas sets BIQC_COMPANY_ABN post-registration."""
    monkeypatch.delenv("BIQC_COMPANY_ABN", raising=False)
    monkeypatch.delenv("BIQC_COMPANY_LEGAL_NAME", raising=False)

    # Re-import to re-read envs.
    if "routes.stripe_payments" in sys.modules:
        del sys.modules["routes.stripe_payments"]
    module = importlib.import_module("routes.stripe_payments")

    assert module.BIQC_COMPANY_ABN == ""
    assert module.BIQC_COMPANY_LEGAL_NAME == (
        "Business Intelligence Quotient Centre Pty Ltd"
    )


def test_company_abn_and_legal_name_from_env(stripe_payments_module, monkeypatch):
    monkeypatch.setenv("BIQC_COMPANY_ABN", "12 345 678 901")
    monkeypatch.setenv("BIQC_COMPANY_LEGAL_NAME", "BIQc Pty Ltd")

    if "routes.stripe_payments" in sys.modules:
        del sys.modules["routes.stripe_payments"]
    module = importlib.import_module("routes.stripe_payments")

    assert module.BIQC_COMPANY_ABN == "12 345 678 901"
    assert module.BIQC_COMPANY_LEGAL_NAME == "BIQc Pty Ltd"
