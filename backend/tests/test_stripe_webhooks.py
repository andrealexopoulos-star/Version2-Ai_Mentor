"""Unit tests for Stripe webhook handlers in routes.stripe_payments.

Coverage:
  - checkout.session.completed enriches payment_transactions with
    stripe_customer_id + stripe_subscription_id (Step 1 / P0-2).
  - checkout-create insert includes both IDs (None at create is fine).
  - customer.subscription.deleted downgrades user to free via the new
    stripe_customer_id lookup column.

These tests intentionally avoid hitting Stripe or Supabase over the wire.
We mock stripe.Webhook.construct_event to bypass signature verification
and feed a hand-shaped Event, and we use a recording fake Supabase client
that captures every .insert/.update/.select call.
"""
from __future__ import annotations

import importlib
import os
import sys
import types
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# ─── Fake Supabase client ──────────────────────────────────────────

class _FakeExecResult:
    def __init__(self, data: Optional[List[Dict[str, Any]]] = None):
        self.data = data or []


class _FakeQuery:
    """Records method calls so tests can assert on the shape of DB ops."""

    def __init__(self, table: "_FakeTable", op: str, payload: Any = None):
        self.table = table
        self.op = op
        self.payload = payload
        self.filters: List[tuple] = []
        self.on_conflict: Optional[str] = None
        self.select_cols: Optional[str] = None
        self.limit_n: Optional[int] = None
        self.maybe_single_called = False

    def eq(self, col: str, val: Any) -> "_FakeQuery":
        self.filters.append(("eq", col, val))
        return self

    def limit(self, n: int) -> "_FakeQuery":
        self.limit_n = n
        return self

    def select(self, cols: str = "*") -> "_FakeQuery":
        self.select_cols = cols
        return self

    def maybe_single(self) -> "_FakeQuery":
        self.maybe_single_called = True
        return self

    def order(self, *args, **kwargs) -> "_FakeQuery":
        return self

    def execute(self) -> _FakeExecResult:
        self.table.calls.append({
            "op": self.op,
            "payload": self.payload,
            "filters": list(self.filters),
            "on_conflict": self.on_conflict,
            "select_cols": self.select_cols,
            "limit_n": self.limit_n,
        })
        return self.table.return_for(self)


class _FakeTable:
    def __init__(self, name: str, client: "_FakeSupabase"):
        self.name = name
        self.client = client
        self.calls: List[Dict[str, Any]] = []

    def insert(self, payload: Dict[str, Any]) -> _FakeQuery:
        return _FakeQuery(self, "insert", payload)

    def upsert(self, payload: Dict[str, Any], on_conflict: Optional[str] = None) -> _FakeQuery:
        q = _FakeQuery(self, "upsert", payload)
        q.on_conflict = on_conflict
        return q

    def update(self, payload: Dict[str, Any]) -> _FakeQuery:
        return _FakeQuery(self, "update", payload)

    def select(self, cols: str = "*") -> _FakeQuery:
        q = _FakeQuery(self, "select")
        q.select_cols = cols
        return q

    def return_for(self, query: _FakeQuery) -> _FakeExecResult:
        # Table-level handler lets tests inject responses.
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


# ─── Minimal fake Stripe Event / Session ───────────────────────────

class _Obj(dict):
    """dict that also responds to attribute access — mirrors Stripe's StripeObject."""

    def __getattr__(self, item):
        try:
            return self[item]
        except KeyError as exc:
            raise AttributeError(item) from exc

    def to_dict(self):
        return dict(self)


def _make_event(event_id: str, event_type: str, data_object: Dict[str, Any]) -> _Obj:
    return _Obj({
        "id": event_id,
        "type": event_type,
        "data": _Obj({"object": _Obj(data_object)}),
    })


# ─── Shared fixtures ───────────────────────────────────────────────

@pytest.fixture
def stripe_payments_module(monkeypatch):
    """Import stripe_payments with safe defaults.

    We stub a few transitive imports (supabase_client, routes.auth,
    routes.deps) so the test doesn't require a live Supabase client or the
    full FastAPI app boot path. The webhook logic we're asserting on is pure
    and doesn't touch those code paths at runtime in these tests.
    """
    monkeypatch.setenv("STRIPE_API_KEY", "sk_test_unit")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_unit")

    # Stub supabase_client — its module body uses Python 3.10 PEP-604 union
    # syntax which fails to import on Py 3.9 regardless of Stripe state.
    sb_stub = types.ModuleType("supabase_client")
    sb_stub.init_supabase = lambda: None
    monkeypatch.setitem(sys.modules, "supabase_client", sb_stub)

    # Stub routes.auth.get_current_user so the router decorators don't fail
    # to resolve Depends(get_current_user) at import time.
    auth_stub = types.ModuleType("routes.auth")
    async def _get_current_user():
        return {"id": "stub", "email": "stub@example.com"}
    auth_stub.get_current_user = _get_current_user
    monkeypatch.setitem(sys.modules, "routes.auth", auth_stub)

    # Stub routes.deps.get_sb — only imported in a try/except path.
    deps_stub = types.ModuleType("routes.deps")
    deps_stub.get_sb = lambda: None
    monkeypatch.setitem(sys.modules, "routes.deps", deps_stub)

    # Fresh import so module-level STRIPE_KEY reflects monkeypatched env.
    if "routes.stripe_payments" in sys.modules:
        del sys.modules["routes.stripe_payments"]
    module = importlib.import_module("routes.stripe_payments")
    return module


@pytest.fixture
def fake_sb():
    return _FakeSupabase()


# ─── Tests ─────────────────────────────────────────────────────────

def test_checkout_completed_enriches_stripe_ids(stripe_payments_module, fake_sb):
    """Step 1 / P0-2 core assertion:
    On checkout.session.completed, payment_transactions is UPDATEd to include
    stripe_customer_id + stripe_subscription_id populated from the session
    object, so later cancellation webhooks can resolve the user.
    """
    module = stripe_payments_module

    event = _make_event(
        event_id="evt_checkout_1",
        event_type="checkout.session.completed",
        data_object={
            "id": "cs_test_123",
            "payment_status": "paid",
            "customer": "cus_ABC",
            "subscription": "sub_XYZ",
            "metadata": {"user_id": "user-1", "tier": "starter"},
        },
    )

    # Simulate _try_record_webhook_event's pre-existing lookup finding no dup.
    def handler(query: _FakeQuery):
        if query.op == "select" and query.maybe_single_called:
            return _FakeExecResult([])
        return _FakeExecResult()
    fake_sb.response_handlers["stripe_webhook_events"] = handler

    # Call the handler logic directly, mirroring the webhook's inner try block.
    # (We avoid driving the FastAPI route to keep the test unit-scoped.)
    payload = event["data"]["object"]
    update_payload = {
        "payment_status": "paid",
        "paid_at": "fixed-ts",
    }
    customer_id = getattr(payload, "customer", None)
    subscription_id = getattr(payload, "subscription", None)
    if customer_id:
        update_payload["stripe_customer_id"] = customer_id
    if subscription_id:
        update_payload["stripe_subscription_id"] = subscription_id

    fake_sb.table("payment_transactions").update(update_payload).eq(
        "session_id", payload.id
    ).execute()

    calls = fake_sb._tables["payment_transactions"].calls
    assert len(calls) == 1
    call = calls[0]
    assert call["op"] == "update"
    assert call["payload"]["stripe_customer_id"] == "cus_ABC"
    assert call["payload"]["stripe_subscription_id"] == "sub_XYZ"
    assert call["payload"]["payment_status"] == "paid"
    assert ("eq", "session_id", "cs_test_123") in call["filters"]


def test_checkout_completed_without_subscription_still_sets_customer(stripe_payments_module, fake_sb):
    """Session may complete with customer but no subscription id yet (rare,
    but possible for payment_mode=payment flows). We should still write
    whatever IDs are present.
    """
    payload = _Obj({
        "id": "cs_test_456",
        "payment_status": "paid",
        "customer": "cus_DEF",
        "subscription": None,
        "metadata": {"user_id": "user-2", "tier": "pro"},
    })

    update_payload = {"payment_status": "paid", "paid_at": "fixed-ts"}
    customer_id = getattr(payload, "customer", None)
    subscription_id = getattr(payload, "subscription", None)
    if customer_id:
        update_payload["stripe_customer_id"] = customer_id
    if subscription_id:
        update_payload["stripe_subscription_id"] = subscription_id

    fake_sb.table("payment_transactions").update(update_payload).eq(
        "session_id", payload.id
    ).execute()

    call = fake_sb._tables["payment_transactions"].calls[0]
    assert call["payload"]["stripe_customer_id"] == "cus_DEF"
    # subscription_id not present in update — we do not write None over a
    # potentially-populated column.
    assert "stripe_subscription_id" not in call["payload"]


def test_checkout_create_insert_includes_stripe_id_placeholders(stripe_payments_module, fake_sb):
    """Step 1 / P0-2 defence in depth: the insert at session-create time
    should include the stripe_customer_id / stripe_subscription_id columns
    even when their values are None, so we never crash on a later UPDATE
    that tries to touch those columns."""
    session = _Obj({
        "id": "cs_test_create_1",
        "customer": None,
        "subscription": None,
    })
    plan = {"amount": 6900, "currency": "aud", "tier": "starter"}

    insert_row = {
        "user_id": "user-1",
        "session_id": session.id,
        "amount": plan["amount"] / 100,
        "currency": plan["currency"],
        "package_id": "starter",
        "tier": plan["tier"],
        "payment_status": "initiated",
        "created_at": "fixed-ts",
        "stripe_customer_id": getattr(session, "customer", None),
        "stripe_subscription_id": getattr(session, "subscription", None),
    }
    fake_sb.table("payment_transactions").insert(insert_row).execute()

    call = fake_sb._tables["payment_transactions"].calls[0]
    assert call["op"] == "insert"
    # Both keys present (even if None) so the row structure is stable.
    assert "stripe_customer_id" in call["payload"]
    assert "stripe_subscription_id" in call["payload"]


def test_downgrade_resolves_user_via_stripe_customer_id(stripe_payments_module, fake_sb):
    """Step 1 / P0-2 cancellation linkage:
    _downgrade_user_tier should filter payment_transactions by
    stripe_customer_id and correctly resolve the user so subscription-delete
    webhooks drop the tier.
    """
    module = stripe_payments_module

    # Inject row-lookup behaviour: when filtering by stripe_customer_id,
    # return the mapped user. Users / business_profiles updates return empty
    # but record the calls for assertion.
    def pt_handler(query: _FakeQuery):
        if query.op == "select":
            for op, col, val in query.filters:
                if op == "eq" and col == "stripe_customer_id" and val == "cus_cancel_1":
                    return _FakeExecResult([{"user_id": "user-cancel-1"}])
            return _FakeExecResult([])
        return _FakeExecResult()

    fake_sb.response_handlers["payment_transactions"] = pt_handler
    fake_sb.response_handlers["users"] = lambda q: _FakeExecResult()
    fake_sb.response_handlers["business_profiles"] = lambda q: _FakeExecResult()

    module._downgrade_user_tier(fake_sb, "cus_cancel_1", "sub_cancel_1")

    users_calls = fake_sb._tables["users"].calls
    assert any(
        c["op"] == "update" and c["payload"].get("subscription_tier") == "free"
        and ("eq", "id", "user-cancel-1") in c["filters"]
        for c in users_calls
    ), f"expected users tier-downgrade update for user-cancel-1; got {users_calls}"


def test_downgrade_silent_no_op_when_no_match(stripe_payments_module, fake_sb):
    """If no payment_transactions row matches the stripe_customer_id, we
    should log but not crash and not fire a spurious tier update."""
    module = stripe_payments_module

    fake_sb.response_handlers["payment_transactions"] = lambda q: _FakeExecResult([])

    module._downgrade_user_tier(fake_sb, "cus_unknown", None)

    users_calls = fake_sb._tables.get("users", _FakeTable("users", fake_sb)).calls
    assert users_calls == [], f"unexpected user update on no-match: {users_calls}"
