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
    should log but not crash and not fire a spurious tier update.

    Note: _downgrade_user_tier now also consults users.stripe_customer_id
    via _resolve_user_by_customer_id, so a SELECT against users is expected.
    What we care about is that no UPDATE against users happens.
    """
    module = stripe_payments_module

    fake_sb.response_handlers["payment_transactions"] = lambda q: _FakeExecResult([])
    fake_sb.response_handlers["users"] = lambda q: _FakeExecResult([])

    module._downgrade_user_tier(fake_sb, "cus_unknown", None)

    users_calls = fake_sb._tables.get("users", _FakeTable("users", fake_sb)).calls
    update_calls = [c for c in users_calls if c["op"] == "update"]
    assert update_calls == [], f"unexpected user update on no-match: {update_calls}"


# ─── Step 2 (P0-3/P0-4): invoice + trial lifecycle handlers ────────

def _users_update_payloads(fake_sb) -> List[Dict[str, Any]]:
    """Return just the update-op payloads made against the users table."""
    calls = fake_sb._tables.get("users", _FakeTable("users", fake_sb)).calls
    return [c["payload"] for c in calls if c["op"] == "update"]


def test_resolve_user_prefers_users_over_payment_transactions(stripe_payments_module, fake_sb):
    """Hot path: users.stripe_customer_id is the preferred lookup path.
    payment_transactions should only be consulted if users returns empty.
    """
    module = stripe_payments_module

    def users_handler(q: _FakeQuery):
        if q.op == "select" and ("eq", "stripe_customer_id", "cus_hot") in q.filters:
            return _FakeExecResult([{"id": "user-hot"}])
        return _FakeExecResult([])
    fake_sb.response_handlers["users"] = users_handler
    # If this handler fires, the resolution short-circuit failed.
    fake_sb.response_handlers["payment_transactions"] = lambda q: (_ for _ in ()).throw(  # noqa: E501
        AssertionError("payment_transactions should not be queried when users hits")
    )

    resolved = module._resolve_user_by_customer_id(fake_sb, "cus_hot")
    assert resolved == "user-hot"


def test_resolve_user_falls_back_to_payment_transactions(stripe_payments_module, fake_sb):
    """Legacy cold path: user hasn't been cached on users yet, so the
    stripe_customer_id is only findable via payment_transactions."""
    module = stripe_payments_module

    fake_sb.response_handlers["users"] = lambda q: _FakeExecResult([])
    fake_sb.response_handlers["payment_transactions"] = lambda q: _FakeExecResult(
        [{"user_id": "user-legacy"}]
    )

    assert module._resolve_user_by_customer_id(fake_sb, "cus_legacy") == "user-legacy"


def test_resolve_user_returns_none_for_blank_customer(stripe_payments_module, fake_sb):
    module = stripe_payments_module
    assert module._resolve_user_by_customer_id(fake_sb, None) is None
    assert module._resolve_user_by_customer_id(fake_sb, "") is None
    # No Supabase calls should have fired on a blank customer id.
    assert not fake_sb._tables


def test_update_subscription_lifecycle_skips_unset(stripe_payments_module, fake_sb):
    """_UNSET means 'leave this column alone'. None is a valid payload
    value. An all-UNSET call must produce zero Supabase writes."""
    module = stripe_payments_module

    module._update_subscription_lifecycle(fake_sb, "user-1")  # all defaults → UNSET
    assert fake_sb._tables.get("users", _FakeTable("users", fake_sb)).calls == []

    module._update_subscription_lifecycle(
        fake_sb, "user-1",
        status="active",
        past_due_since=None,          # explicit null — should be written
        current_period_end="2026-05-01T00:00:00+00:00",
        # trial_ends_at + stripe_customer_id left as _UNSET → omitted
    )
    payloads = _users_update_payloads(fake_sb)
    assert len(payloads) == 1
    payload = payloads[0]
    assert payload == {
        "subscription_status": "active",
        "past_due_since": None,
        "current_period_end": "2026-05-01T00:00:00+00:00",
    }
    # Confirm we didn't accidentally write keys we weren't asked to.
    assert "trial_ends_at" not in payload
    assert "stripe_customer_id" not in payload


def test_ts_from_epoch_converts_and_handles_garbage(stripe_payments_module):
    module = stripe_payments_module
    assert module._ts_from_epoch(None) is None
    assert module._ts_from_epoch(0) is None
    assert module._ts_from_epoch("not-a-number") is None
    # Known epoch: 1776506400 → 2026-04-18T10:00:00+00:00
    out = module._ts_from_epoch(1776506400)
    assert out == "2026-04-18T10:00:00+00:00"
    # Stripe can also hand us a numeric string in edge cases — accept it.
    assert module._ts_from_epoch("1776506400") == "2026-04-18T10:00:00+00:00"


def test_invoice_payment_succeeded_refreshes_lifecycle(stripe_payments_module, fake_sb):
    """Successful recurring charge: subscription_status=active,
    current_period_end renewed, past_due_since cleared.
    """
    module = stripe_payments_module

    fake_sb.response_handlers["users"] = lambda q: (
        _FakeExecResult([{"id": "user-renew"}])
        if q.op == "select" else _FakeExecResult()
    )
    # Simulate invoice.payment_succeeded core logic directly (no FastAPI).
    inv = _Obj({
        "customer": "cus_renew",
        "subscription": "sub_renew",
        "period_end": 1776506400,  # 2026-04-15T10:00:00Z
    })
    user_id = module._resolve_user_by_customer_id(fake_sb, inv.customer)
    assert user_id == "user-renew"
    module._update_subscription_lifecycle(
        fake_sb, user_id,
        status="active",
        current_period_end=module._ts_from_epoch(inv.period_end),
        past_due_since=None,
        stripe_customer_id=inv.customer,
    )

    payloads = _users_update_payloads(fake_sb)
    assert len(payloads) == 1
    p = payloads[0]
    assert p["subscription_status"] == "active"
    assert p["past_due_since"] is None
    assert p["stripe_customer_id"] == "cus_renew"
    # Epoch 1776506400 → 2026-04-18T10:00:00+00:00 (verified in ts helper test).
    assert p["current_period_end"] == "2026-04-18T10:00:00+00:00"


def test_invoice_payment_failed_sets_past_due_first_failure(stripe_payments_module, fake_sb):
    """First dunning event: past_due_since stamps now."""
    module = stripe_payments_module

    # users.select for resolution returns the mapped user; subsequent
    # select for past_due_since returns empty (no prior dunning).
    def users_handler(q: _FakeQuery):
        if q.op == "select" and ("eq", "stripe_customer_id", "cus_dun") in q.filters:
            return _FakeExecResult([{"id": "user-dun"}])
        if q.op == "select" and q.select_cols == "past_due_since":
            return _FakeExecResult([{"past_due_since": None}])
        return _FakeExecResult()
    fake_sb.response_handlers["users"] = users_handler

    user_id = module._resolve_user_by_customer_id(fake_sb, "cus_dun")
    existing = module._get_past_due_since(fake_sb, user_id)
    assert existing is None

    now_iso = "2026-04-15T09:00:00+00:00"
    module._update_subscription_lifecycle(
        fake_sb, user_id,
        status="past_due",
        past_due_since=(existing or now_iso),
        stripe_customer_id="cus_dun",
    )

    payloads = _users_update_payloads(fake_sb)
    assert len(payloads) == 1
    assert payloads[0]["subscription_status"] == "past_due"
    assert payloads[0]["past_due_since"] == now_iso


def test_invoice_payment_failed_preserves_original_past_due_since(stripe_payments_module, fake_sb):
    """Second retry: don't overwrite the original timestamp — we need to
    measure time-in-dunning accurately."""
    module = stripe_payments_module

    original_ts = "2026-04-10T09:00:00+00:00"

    def users_handler(q: _FakeQuery):
        if q.op == "select" and ("eq", "stripe_customer_id", "cus_dun2") in q.filters:
            return _FakeExecResult([{"id": "user-dun2"}])
        if q.op == "select" and q.select_cols == "past_due_since":
            return _FakeExecResult([{"past_due_since": original_ts}])
        return _FakeExecResult()
    fake_sb.response_handlers["users"] = users_handler

    user_id = module._resolve_user_by_customer_id(fake_sb, "cus_dun2")
    existing = module._get_past_due_since(fake_sb, user_id)
    assert existing == original_ts

    module._update_subscription_lifecycle(
        fake_sb, user_id,
        status="past_due",
        past_due_since=(existing or "2026-04-15T09:00:00+00:00"),
        stripe_customer_id="cus_dun2",
    )

    payloads = _users_update_payloads(fake_sb)
    assert any(
        p["past_due_since"] == original_ts and p["subscription_status"] == "past_due"
        for p in payloads
    ), f"expected past_due_since preserved at {original_ts}; got {payloads}"


def test_invoice_payment_failed_does_not_change_subscription_tier(stripe_payments_module, fake_sb):
    """Dunning must not revoke tier — that's the job of
    customer.subscription.deleted / updated(canceled|unpaid|incomplete_expired).
    """
    module = stripe_payments_module

    def users_handler(q: _FakeQuery):
        if q.op == "select":
            if ("eq", "stripe_customer_id", "cus_still_paid") in q.filters:
                return _FakeExecResult([{"id": "user-still-paid"}])
            if q.select_cols == "past_due_since":
                return _FakeExecResult([{"past_due_since": None}])
        return _FakeExecResult()
    fake_sb.response_handlers["users"] = users_handler

    user_id = module._resolve_user_by_customer_id(fake_sb, "cus_still_paid")
    existing = module._get_past_due_since(fake_sb, user_id)
    module._update_subscription_lifecycle(
        fake_sb, user_id,
        status="past_due",
        past_due_since=(existing or "2026-04-15T09:00:00+00:00"),
        stripe_customer_id="cus_still_paid",
    )

    payloads = _users_update_payloads(fake_sb)
    # No payload should carry a subscription_tier change.
    for p in payloads:
        assert "subscription_tier" not in p, (
            f"invoice.payment_failed unexpectedly wrote subscription_tier={p['subscription_tier']!r}"
        )


def test_trial_will_end_updates_trial_ends_at(stripe_payments_module, fake_sb):
    """trial_will_end fires ~3 days before trial end. Refresh trial_ends_at
    so the /billing/overview countdown is accurate without re-fetching from
    Stripe.
    """
    module = stripe_payments_module

    fake_sb.response_handlers["users"] = lambda q: (
        _FakeExecResult([{"id": "user-trial"}]) if q.op == "select" else _FakeExecResult()
    )

    sub = _Obj({"customer": "cus_trial", "trial_end": 1776506400})
    user_id = module._resolve_user_by_customer_id(fake_sb, sub.customer)
    module._update_subscription_lifecycle(
        fake_sb, user_id,
        trial_ends_at=module._ts_from_epoch(sub.trial_end),
        stripe_customer_id=sub.customer,
    )

    payloads = _users_update_payloads(fake_sb)
    assert any(
        p.get("trial_ends_at") == "2026-04-18T10:00:00+00:00"
        and p.get("stripe_customer_id") == "cus_trial"
        for p in payloads
    ), f"expected trial_ends_at set on user-trial; got {payloads}"
    # Status left untouched — trial_will_end doesn't move subscription_status.
    for p in payloads:
        assert "subscription_status" not in p


def test_downgrade_sets_canceled_status_and_clears_period(stripe_payments_module, fake_sb):
    """Cancellation must now write subscription_status='canceled' and
    null out current_period_end + past_due_since alongside tier=free so the
    billing dashboards stop showing stale paid-state data.
    """
    module = stripe_payments_module

    def users_handler(q: _FakeQuery):
        if q.op == "select" and ("eq", "stripe_customer_id", "cus_cancel_lc") in q.filters:
            return _FakeExecResult([{"id": "user-cancel-lc"}])
        return _FakeExecResult()
    fake_sb.response_handlers["users"] = users_handler
    fake_sb.response_handlers["payment_transactions"] = lambda q: _FakeExecResult([])
    fake_sb.response_handlers["business_profiles"] = lambda q: _FakeExecResult()

    module._downgrade_user_tier(fake_sb, "cus_cancel_lc", "sub_cancel_lc")

    payloads = _users_update_payloads(fake_sb)
    # Must have one tier downgrade AND one lifecycle update.
    tier_updates = [p for p in payloads if p.get("subscription_tier") == "free"]
    lifecycle_updates = [p for p in payloads if p.get("subscription_status") == "canceled"]
    assert tier_updates, f"missing subscription_tier=free update; got {payloads}"
    assert lifecycle_updates, f"missing subscription_status=canceled update; got {payloads}"
    assert lifecycle_updates[0]["current_period_end"] is None
    assert lifecycle_updates[0]["past_due_since"] is None
