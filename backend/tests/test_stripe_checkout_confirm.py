"""Unit tests for the read-only checkout confirmation endpoint
(Step 4 / P0-6).

What this guards:
  - /upgrade/success used to fire GA4 `purchase` events purely from the URL
    session_id. This endpoint lets the frontend require the server to
    confirm the session is paid and owned before tagging a conversion.
  - These tests exercise the handler directly (bypassing FastAPI's
    Depends wiring) so we can assert on return shape + HTTPException
    codes without booting the full app.

Stripe is never called over the wire — we monkeypatch
stripe.checkout.Session.retrieve on the module. Same pattern as
test_stripe_webhooks.py.
"""
from __future__ import annotations

import asyncio
import importlib
import sys
import types
from pathlib import Path
from typing import Any, Dict, Optional

import pytest


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# ─── Fake Stripe primitives ────────────────────────────────────────

class _Obj(dict):
    """dict that also exposes attribute access — mirrors Stripe SDK objects."""

    def __getattr__(self, item):
        try:
            return self[item]
        except KeyError as exc:
            raise AttributeError(item) from exc


def _make_session(
    session_id: str,
    *,
    payment_status: str = "paid",
    status: str = "complete",
    metadata: Optional[Dict[str, Any]] = None,
    amount_total: Optional[int] = 6900,
    currency: Optional[str] = "aud",
) -> _Obj:
    return _Obj({
        "id": session_id,
        "payment_status": payment_status,
        "status": status,
        "metadata": dict(metadata or {}),
        "amount_total": amount_total,
        "currency": currency,
    })


# ─── Module import fixture ─────────────────────────────────────────

@pytest.fixture
def stripe_payments_module(monkeypatch):
    """Re-import routes.stripe_payments with STRIPE_API_KEY set, stubbing
    the few transitive modules that would otherwise fail on Python 3.9
    or require live infra."""
    monkeypatch.setenv("STRIPE_API_KEY", "sk_test_unit")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_unit")

    sb_stub = types.ModuleType("supabase_client")
    sb_stub.init_supabase = lambda: None
    monkeypatch.setitem(sys.modules, "supabase_client", sb_stub)

    auth_stub = types.ModuleType("routes.auth")
    async def _get_current_user():
        return {"id": "stub", "email": "stub@example.com"}
    auth_stub.get_current_user = _get_current_user
    monkeypatch.setitem(sys.modules, "routes.auth", auth_stub)

    deps_stub = types.ModuleType("routes.deps")
    deps_stub.get_sb = lambda: None
    monkeypatch.setitem(sys.modules, "routes.deps", deps_stub)

    if "routes.stripe_payments" in sys.modules:
        del sys.modules["routes.stripe_payments"]
    module = importlib.import_module("routes.stripe_payments")
    return module


# ─── Helpers ──────────────────────────────────────────────────────

def _run(coro):
    """asyncio.run() wrapper that works on 3.9/3.10+ without a
    running loop assumption."""
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


def _call_confirm(module, session_id: str, current_user: Dict[str, Any]):
    """Invoke the handler directly, bypassing FastAPI's Depends resolver."""
    return _run(
        module.confirm_checkout_session(session_id=session_id, current_user=current_user)
    )


# ─── Tests ────────────────────────────────────────────────────────

def test_confirm_returns_true_for_paid_session(stripe_payments_module, monkeypatch):
    """Happy path — Stripe says 'paid' and metadata.user_id matches
    current_user.id. Returns confirmed=true with the stable shape."""
    module = stripe_payments_module

    session = _make_session(
        "cs_test_paid",
        payment_status="paid",
        status="complete",
        metadata={
            "user_id": "user-1",
            "tier": "starter",
        },
        amount_total=6900,
        currency="aud",
    )
    monkeypatch.setattr(
        module.stripe.checkout.Session, "retrieve", lambda sid: session
    )

    result = _call_confirm(module, "cs_test_paid", {"id": "user-1"})

    assert result["confirmed"] is True
    assert result["session_id"] == "cs_test_paid"
    assert result["payment_status"] == "paid"
    assert result["status"] == "complete"
    assert result["amount_total"] == 6900
    assert result["currency"] == "aud"
    assert result["tier"] == "starter"
    # PLANS["starter"].name = "BIQc Growth"
    assert result["plan_name"] == "BIQc Growth"


def test_confirm_returns_true_for_no_payment_required(stripe_payments_module, monkeypatch):
    """100%-off trials/coupons resolve as `no_payment_required`; the
    session is still complete and deserves a conversion fire."""
    module = stripe_payments_module

    session = _make_session(
        "cs_test_trial",
        payment_status="no_payment_required",
        status="complete",
        metadata={"user_id": "user-1", "tier": "pro"},
        amount_total=0,
        currency="aud",
    )
    monkeypatch.setattr(
        module.stripe.checkout.Session, "retrieve", lambda sid: session
    )

    result = _call_confirm(module, "cs_test_trial", {"id": "user-1"})

    assert result["confirmed"] is True
    assert result["payment_status"] == "no_payment_required"
    assert result["tier"] == "pro"
    assert result["plan_name"] == "BIQc Professional"


def test_confirm_returns_false_for_unpaid_session(stripe_payments_module, monkeypatch):
    """Session exists, owned by user, but Stripe reports unpaid — must
    return confirmed=false so the frontend skips the GA4 purchase fire."""
    module = stripe_payments_module

    session = _make_session(
        "cs_test_unpaid",
        payment_status="unpaid",
        status="open",
        metadata={"user_id": "user-1", "tier": "starter"},
    )
    monkeypatch.setattr(
        module.stripe.checkout.Session, "retrieve", lambda sid: session
    )

    result = _call_confirm(module, "cs_test_unpaid", {"id": "user-1"})

    assert result["confirmed"] is False
    assert result["payment_status"] == "unpaid"
    assert result["status"] == "open"


def test_confirm_rejects_cross_user_session(stripe_payments_module, monkeypatch):
    """Session belongs to user-2 but current_user is user-1 → 403.
    This is the core injection-defence assertion: a hostile client
    cannot forge a conversion for someone else's session."""
    module = stripe_payments_module

    session = _make_session(
        "cs_test_foreign",
        metadata={"user_id": "user-2", "tier": "starter"},
    )
    monkeypatch.setattr(
        module.stripe.checkout.Session, "retrieve", lambda sid: session
    )

    with pytest.raises(module.HTTPException) as excinfo:
        _call_confirm(module, "cs_test_foreign", {"id": "user-1"})

    assert excinfo.value.status_code == 403


def test_confirm_rejects_session_with_no_user_id_metadata(stripe_payments_module, monkeypatch):
    """Session has no user_id in metadata — same 403 response as
    foreign-ownership, so we never leak whether the session exists."""
    module = stripe_payments_module

    session = _make_session(
        "cs_test_anon",
        metadata={"tier": "starter"},  # no user_id
    )
    monkeypatch.setattr(
        module.stripe.checkout.Session, "retrieve", lambda sid: session
    )

    with pytest.raises(module.HTTPException) as excinfo:
        _call_confirm(module, "cs_test_anon", {"id": "user-1"})

    assert excinfo.value.status_code == 403


def test_confirm_404_when_stripe_session_missing(stripe_payments_module, monkeypatch):
    """Stripe's InvalidRequestError → 404 (session not found)."""
    module = stripe_payments_module

    def _raise(sid):
        raise module.stripe.error.InvalidRequestError(
            "No such checkout session", "id"
        )
    monkeypatch.setattr(module.stripe.checkout.Session, "retrieve", _raise)

    with pytest.raises(module.HTTPException) as excinfo:
        _call_confirm(module, "cs_missing", {"id": "user-1"})

    assert excinfo.value.status_code == 404


def test_confirm_502_when_stripe_generic_error(stripe_payments_module, monkeypatch):
    """Generic StripeError (network/auth/etc) → 502. We never let Stripe
    noise leak to the client as a 500 from the FastAPI app."""
    module = stripe_payments_module

    def _raise(sid):
        raise module.stripe.error.APIConnectionError("Network down")
    monkeypatch.setattr(module.stripe.checkout.Session, "retrieve", _raise)

    with pytest.raises(module.HTTPException) as excinfo:
        _call_confirm(module, "cs_net", {"id": "user-1"})

    assert excinfo.value.status_code == 502


def test_confirm_503_when_stripe_not_configured(stripe_payments_module, monkeypatch):
    """Endpoint must refuse to speak when STRIPE_API_KEY is absent —
    prevents unsafe responses on dev/test instances without credentials."""
    module = stripe_payments_module
    monkeypatch.setattr(module, "STRIPE_KEY", "")

    with pytest.raises(module.HTTPException) as excinfo:
        _call_confirm(module, "cs_anything", {"id": "user-1"})

    assert excinfo.value.status_code == 503


def test_confirm_resolves_plan_name_via_pricing_plan_key(stripe_payments_module, monkeypatch):
    """When metadata.tier isn't a direct PLANS key but pricing_plan_key
    is, plan_name still resolves. Covers governed-plan case where the
    tier column may hold the canonical short tier and plan_key holds
    the raw plan id."""
    module = stripe_payments_module

    # 'foundation' is a PLANS alias — use an intentionally off key for
    # tier and a real plan_key to force the fallback path.
    session = _make_session(
        "cs_plan_fallback",
        metadata={
            "user_id": "user-1",
            "tier": "mystery-tier-not-in-plans",
            "pricing_plan_key": "foundation",
        },
    )
    monkeypatch.setattr(
        module.stripe.checkout.Session, "retrieve", lambda sid: session
    )

    result = _call_confirm(module, "cs_plan_fallback", {"id": "user-1"})

    assert result["confirmed"] is True
    # tier echoes what was in metadata, but plan_name resolved via
    # pricing_plan_key fallback.
    assert result["tier"] == "mystery-tier-not-in-plans"
    assert result["plan_name"] == "BIQc Growth"  # foundation → Growth


def test_confirm_handles_session_with_no_metadata(stripe_payments_module, monkeypatch):
    """Session with metadata=None (empty dict) — the user_id check
    still fires, returning 403 without crashing on the None access."""
    module = stripe_payments_module

    # getattr returns None when metadata is explicitly None on the stripe obj
    session = _Obj({
        "id": "cs_no_meta",
        "payment_status": "paid",
        "status": "complete",
        "metadata": None,
        "amount_total": 6900,
        "currency": "aud",
    })
    monkeypatch.setattr(
        module.stripe.checkout.Session, "retrieve", lambda sid: session
    )

    with pytest.raises(module.HTTPException) as excinfo:
        _call_confirm(module, "cs_no_meta", {"id": "user-1"})

    assert excinfo.value.status_code == 403
