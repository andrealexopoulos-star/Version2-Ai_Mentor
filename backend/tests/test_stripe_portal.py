"""Unit tests for the Stripe Customer Portal endpoint (Step 11 / P1-10).

Purpose
-------
The billing portal must be reachable by every paying, cancelled, and
free user — cancelled users to view invoice history or reactivate,
free users to add a payment method for the first time. Before this
step, the endpoint only looked up Stripe customers by email, which:
  • Missed customers whose email in Stripe differs from the user row
    (common after an email change).
  • Silently created a duplicate Stripe customer on every free-user
    portal click, polluting the Stripe dashboard.
  • Returned the wrong customer when an email is shared across a test
    and live customer record.

These tests pin the new lookup order:
  1. users.stripe_customer_id (DB cache)
  2. Stripe Customer.list by email (migration fallback)
  3. Create new + cache back (first-time free user)

Plus the error-path handling that tells ops exactly what to fix when
the portal hasn't been configured in the Stripe dashboard yet.
"""
from __future__ import annotations

import asyncio
import sys
import types
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# ─── Fixtures ────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _stub_heavy_imports(monkeypatch):
    """stripe_payments.py imports routes.auth → routes.deps →
    auth_supabase → supabase_client, and supabase_client uses PEP-604
    syntax that fails on Py 3.9. Stub the leaf modules so the real
    `routes` package (on disk) still loads, but its submodules resolve
    to our fakes instead of the real Supabase-backed originals.
    """
    monkeypatch.setenv("STRIPE_API_KEY", "sk_test_unit")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_unit")

    sb_stub = types.ModuleType("supabase_client")
    sb_stub.init_supabase = lambda: None
    sb_stub.get_supabase_client = lambda: None
    monkeypatch.setitem(sys.modules, "supabase_client", sb_stub)

    auth_sb_stub = types.ModuleType("auth_supabase")
    auth_sb_stub.MASTER_ADMIN_EMAIL = "admin@example.com"
    monkeypatch.setitem(sys.modules, "auth_supabase", auth_sb_stub)

    # routes.deps — create_portal_session imports get_sb lazily.
    # Do NOT replace the `routes` package itself — Python must resolve
    # `routes.stripe_payments` via the real on-disk package. Only
    # override the submodules that pull in heavy deps.
    deps_stub = types.ModuleType("routes.deps")
    deps_stub._current_sb = None  # swapped per-test via _install_sb

    def _get_sb():
        return deps_stub._current_sb

    deps_stub.get_sb = _get_sb
    monkeypatch.setitem(sys.modules, "routes.deps", deps_stub)

    # routes.auth provides get_current_user; our tests don't go through
    # the FastAPI dependency system, so just provide a stub.
    auth_stub = types.ModuleType("routes.auth")

    async def _get_current_user():
        return {"id": "stub"}

    auth_stub.get_current_user = _get_current_user
    monkeypatch.setitem(sys.modules, "routes.auth", auth_stub)

    # Force a fresh import of stripe_payments so monkeypatches on the
    # `stripe` attribute (done per-test) take effect.
    if "routes.stripe_payments" in sys.modules:
        del sys.modules["routes.stripe_payments"]


def _install_sb(sb) -> None:
    """Helper — sets the sb that the endpoint will retrieve via get_sb()."""
    import routes.deps as deps_mod
    deps_mod._current_sb = sb


# ─── Fake Supabase client ────────────────────────────────────────

class _FakeSB:
    """Records updates + serves selects on the `users` table."""

    def __init__(self) -> None:
        # keyed by user id
        self._rows: Dict[str, Dict[str, Any]] = {}
        self.updates: List[Dict[str, Any]] = []
        self.lookup_raises = False

    def set_user(self, user_id: str, **fields) -> None:
        self._rows[user_id] = {"id": user_id, **fields}

    def table(self, name: str) -> "_FakeSBTable":
        return _FakeSBTable(self, name)


class _FakeSBTable:
    def __init__(self, sb: _FakeSB, name: str) -> None:
        self._sb = sb
        self._name = name
        self._op: Optional[str] = None
        self._select_cols: Optional[str] = None
        self._eq_filters: Dict[str, Any] = {}
        self._limit_value: Optional[int] = None
        self._update_payload: Optional[Dict[str, Any]] = None

    def select(self, cols: str) -> "_FakeSBTable":
        self._op = "select"
        self._select_cols = cols
        return self

    def update(self, payload: Dict[str, Any]) -> "_FakeSBTable":
        self._op = "update"
        self._update_payload = payload
        return self

    def eq(self, col: str, val: Any) -> "_FakeSBTable":
        self._eq_filters[col] = val
        return self

    def limit(self, n: int) -> "_FakeSBTable":
        self._limit_value = n
        return self

    def execute(self) -> "_FakeResponse":
        if self._op == "update":
            user_id = self._eq_filters.get("id")
            payload = self._update_payload or {}
            self._sb.updates.append({"user_id": user_id, "payload": dict(payload)})
            if user_id in self._sb._rows:
                self._sb._rows[user_id].update(payload)
            return _FakeResponse([payload])
        if self._op == "select":
            if self._sb.lookup_raises:
                raise RuntimeError("simulated DB outage")
            user_id = self._eq_filters.get("id")
            row = self._sb._rows.get(user_id)
            return _FakeResponse([row] if row else [])
        return _FakeResponse([])


class _FakeResponse:
    def __init__(self, data: List[Any]) -> None:
        self.data = data


# ─── Fake Stripe module ──────────────────────────────────────────

class _FakeCustomerListing:
    def __init__(self, customers: List[Any]) -> None:
        self.data = customers


class _FakeCustomer:
    def __init__(self, cid: str) -> None:
        self.id = cid


class _FakePortalSession:
    def __init__(self, url: str) -> None:
        self.url = url


class _FakeStripeErrors:
    """Namespace for Stripe error classes. Matches the real
    `stripe.error.InvalidRequestError` shape."""

    class InvalidRequestError(Exception):
        pass

    class APIConnectionError(Exception):
        pass


class _StripeState:
    """Captures every call made on the fake stripe module so tests
    can make exact assertions on call ordering and arguments."""

    def __init__(self) -> None:
        self.customer_list_calls: List[Dict[str, Any]] = []
        self.customer_create_calls: List[Dict[str, Any]] = []
        self.portal_session_calls: List[Dict[str, Any]] = []
        self.customers_by_email: Dict[str, List[_FakeCustomer]] = {}
        self.portal_raises: Optional[Exception] = None
        self.customer_list_raises: Optional[Exception] = None
        self.new_customer_id = "cus_new"
        self.portal_url = "https://billing.stripe.com/session_xyz"


def _make_fake_stripe(state: _StripeState):
    module = types.SimpleNamespace()
    module.api_key = ""
    module.error = _FakeStripeErrors

    # stripe.Customer.list / .create
    customer_ns = types.SimpleNamespace()

    def _list(**kwargs):
        state.customer_list_calls.append(dict(kwargs))
        if state.customer_list_raises is not None:
            raise state.customer_list_raises
        email = kwargs.get("email")
        customers = state.customers_by_email.get(email or "", [])
        return _FakeCustomerListing(customers)

    def _create(**kwargs):
        state.customer_create_calls.append(dict(kwargs))
        return _FakeCustomer(state.new_customer_id)

    customer_ns.list = _list
    customer_ns.create = _create
    module.Customer = customer_ns

    # stripe.billing_portal.Session.create
    portal_session_ns = types.SimpleNamespace()

    def _portal_create(**kwargs):
        state.portal_session_calls.append(dict(kwargs))
        if state.portal_raises is not None:
            raise state.portal_raises
        return _FakePortalSession(state.portal_url)

    portal_session_ns.create = _portal_create
    module.billing_portal = types.SimpleNamespace(Session=portal_session_ns)

    return module


def _call_portal(monkeypatch, current_user: Dict[str, Any], stripe_state: _StripeState):
    """Helper: load stripe_payments with our fake stripe, then invoke
    the portal endpoint coroutine. Returns the raw response dict or
    raises HTTPException."""
    # Shim stripe_payments.STRIPE_KEY and its stripe reference.
    import routes.stripe_payments as sp
    fake_stripe = _make_fake_stripe(stripe_state)
    monkeypatch.setattr(sp, "stripe", fake_stripe)
    monkeypatch.setattr(sp, "STRIPE_KEY", "sk_test_fake")

    # The endpoint uses `stripe.error.InvalidRequestError` via the
    # bound `stripe` module we just swapped — that reference is shared.
    request = None  # endpoint doesn't use Request for logic.
    return asyncio.run(sp.create_portal_session(request, current_user))


# ─── Tests ───────────────────────────────────────────────────────

def test_db_cached_customer_id_is_preferred():
    """Users with an existing users.stripe_customer_id should hit the
    portal directly — no Customer.list, no Customer.create."""
    import pytest as _pt
    mp = _pt.MonkeyPatch()
    try:
        sb = _FakeSB()
        sb.set_user("user-1", stripe_customer_id="cus_cached", email="user@example.com")
        _install_sb(sb)

        state = _StripeState()
        result = _call_portal(mp, {"id": "user-1", "email": "user@example.com"}, state)

        assert result == {"url": state.portal_url}
        # Only one call — the portal session creation.
        assert state.portal_session_calls == [{"customer": "cus_cached", "return_url": "https://biqc.ai/billing"}]
        assert state.customer_list_calls == []  # DB short-circuited Stripe email lookup
        assert state.customer_create_calls == []
    finally:
        mp.undo()


def test_email_fallback_caches_customer_id_back_to_db():
    """If the DB has no cached customer_id but Stripe has one for the
    email, we must cache it back so the next call hits the fast path."""
    import pytest as _pt
    mp = _pt.MonkeyPatch()
    try:
        sb = _FakeSB()
        sb.set_user("user-1", stripe_customer_id=None, email="user@example.com")
        _install_sb(sb)

        state = _StripeState()
        state.customers_by_email["user@example.com"] = [_FakeCustomer("cus_found")]

        result = _call_portal(mp, {"id": "user-1", "email": "user@example.com"}, state)

        assert result == {"url": state.portal_url}
        assert state.customer_list_calls == [{"email": "user@example.com", "limit": 1}]
        assert state.customer_create_calls == []  # didn't create a duplicate
        # Cache was written — update went to users.stripe_customer_id
        assert any(u["payload"].get("stripe_customer_id") == "cus_found" for u in sb.updates)
        assert state.portal_session_calls[0]["customer"] == "cus_found"
    finally:
        mp.undo()


def test_first_time_free_user_creates_and_caches_customer():
    """A brand-new free user has no DB cache and no Stripe customer.
    We create one and cache back, so the next call won't duplicate."""
    import pytest as _pt
    mp = _pt.MonkeyPatch()
    try:
        sb = _FakeSB()
        sb.set_user("user-1", stripe_customer_id=None, email="user@example.com")
        _install_sb(sb)

        state = _StripeState()
        state.new_customer_id = "cus_brand_new"

        result = _call_portal(mp, {"id": "user-1", "email": "user@example.com"}, state)

        assert result == {"url": state.portal_url}
        # Create was called with biqc_user_id metadata.
        assert len(state.customer_create_calls) == 1
        assert state.customer_create_calls[0]["email"] == "user@example.com"
        assert state.customer_create_calls[0]["metadata"]["biqc_user_id"] == "user-1"
        # Cache was written back.
        assert any(u["payload"].get("stripe_customer_id") == "cus_brand_new" for u in sb.updates)
    finally:
        mp.undo()


def test_missing_email_returns_400():
    """Users without an email cannot open the portal (nothing to link
    a Stripe customer to). Return a clear 400 instead of creating a
    mystery customer keyed on the empty string."""
    import pytest as _pt
    from fastapi import HTTPException
    mp = _pt.MonkeyPatch()
    try:
        sb = _FakeSB()
        sb.set_user("user-1", stripe_customer_id=None, email=None)
        _install_sb(sb)

        state = _StripeState()

        with pytest.raises(HTTPException) as exc_info:
            _call_portal(mp, {"id": "user-1", "email": ""}, state)
        assert exc_info.value.status_code == 400
        assert "email" in str(exc_info.value.detail).lower()
    finally:
        mp.undo()


def test_cancelled_user_with_cached_id_reaches_portal():
    """A user who cancelled still has users.stripe_customer_id set —
    they must reach the portal to view past invoices or reactivate."""
    import pytest as _pt
    mp = _pt.MonkeyPatch()
    try:
        sb = _FakeSB()
        sb.set_user(
            "user-cancelled",
            stripe_customer_id="cus_cancelled_history",
            email="ex@example.com",
            subscription_status="canceled",
            subscription_tier="free",
        )
        _install_sb(sb)

        state = _StripeState()
        result = _call_portal(mp, {"id": "user-cancelled", "email": "ex@example.com"}, state)

        assert result["url"] == state.portal_url
        assert state.portal_session_calls[0]["customer"] == "cus_cancelled_history"
        # No duplicate customer was created — we found the cached one.
        assert state.customer_create_calls == []
    finally:
        mp.undo()


def test_portal_misconfigured_returns_400_with_actionable_message():
    """If the Stripe Customer Portal hasn't been configured in the
    dashboard, Stripe throws InvalidRequestError. The endpoint must
    surface an ops-actionable message rather than a generic 400."""
    import pytest as _pt
    from fastapi import HTTPException
    mp = _pt.MonkeyPatch()
    try:
        sb = _FakeSB()
        sb.set_user("user-1", stripe_customer_id="cus_1", email="user@example.com")
        _install_sb(sb)

        state = _StripeState()
        state.portal_raises = _FakeStripeErrors.InvalidRequestError(
            "No configuration provided and your test mode default configuration has not been created."
        )

        with pytest.raises(HTTPException) as exc_info:
            _call_portal(mp, {"id": "user-1", "email": "user@example.com"}, state)
        assert exc_info.value.status_code == 400
        detail = str(exc_info.value.detail).lower()
        assert "portal" in detail
        assert "configure" in detail or "not available" in detail
    finally:
        mp.undo()


def test_stripe_api_connection_error_returns_502():
    """Transient Stripe outage should surface 502 so the client can
    retry rather than showing the user "500 internal server error"."""
    import pytest as _pt
    from fastapi import HTTPException
    mp = _pt.MonkeyPatch()
    try:
        sb = _FakeSB()
        sb.set_user("user-1", stripe_customer_id="cus_1", email="user@example.com")
        _install_sb(sb)

        state = _StripeState()
        state.portal_raises = _FakeStripeErrors.APIConnectionError("connection refused")

        with pytest.raises(HTTPException) as exc_info:
            _call_portal(mp, {"id": "user-1", "email": "user@example.com"}, state)
        assert exc_info.value.status_code == 502
        assert "try again" in str(exc_info.value.detail).lower()
    finally:
        mp.undo()


def test_no_stripe_key_returns_503():
    """When STRIPE_API_KEY isn't set, the endpoint must fail fast with
    503 rather than attempt a Stripe call with a blank key."""
    import pytest as _pt
    from fastapi import HTTPException
    mp = _pt.MonkeyPatch()
    try:
        sb = _FakeSB()
        sb.set_user("user-1", stripe_customer_id="cus_1", email="user@example.com")
        _install_sb(sb)

        # Load stripe_payments but override STRIPE_KEY to empty.
        import routes.stripe_payments as sp
        fake_stripe = _make_fake_stripe(_StripeState())
        mp.setattr(sp, "stripe", fake_stripe)
        mp.setattr(sp, "STRIPE_KEY", "")

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(sp.create_portal_session(None, {"id": "user-1", "email": "user@example.com"}))
        assert exc_info.value.status_code == 503
    finally:
        mp.undo()


def test_email_lookup_failure_falls_through_to_create():
    """Stripe.Customer.list transient failure must not block the user
    from opening the portal — we fall through to creating a new one."""
    import pytest as _pt
    mp = _pt.MonkeyPatch()
    try:
        sb = _FakeSB()
        sb.set_user("user-1", stripe_customer_id=None, email="user@example.com")
        _install_sb(sb)

        state = _StripeState()
        state.customer_list_raises = RuntimeError("Stripe read timeout")
        state.new_customer_id = "cus_after_list_failed"

        result = _call_portal(mp, {"id": "user-1", "email": "user@example.com"}, state)

        assert result["url"] == state.portal_url
        # list failed, so create was the next step.
        assert len(state.customer_create_calls) == 1
    finally:
        mp.undo()


def test_db_outage_still_lets_free_user_open_portal():
    """If the users-table lookup fails entirely (Supabase down), we
    must still be able to resolve through Stripe + create. The portal
    endpoint is a read path for billing help; DB outages can't lock
    users out of their own invoices."""
    import pytest as _pt
    mp = _pt.MonkeyPatch()
    try:
        sb = _FakeSB()
        sb.lookup_raises = True
        _install_sb(sb)

        state = _StripeState()
        state.customers_by_email["user@example.com"] = [_FakeCustomer("cus_from_stripe")]

        result = _call_portal(mp, {"id": "user-1", "email": "user@example.com"}, state)

        # Email fallback worked, got us "cus_from_stripe" — no new create.
        assert result["url"] == state.portal_url
        assert state.portal_session_calls[0]["customer"] == "cus_from_stripe"
    finally:
        mp.undo()


def test_return_url_respects_frontend_url_env(monkeypatch):
    """When FRONTEND_URL env var is set, the return URL must use it so
    staging + preview deployments bounce the user back correctly."""
    sb = _FakeSB()
    sb.set_user("user-1", stripe_customer_id="cus_1", email="user@example.com")
    _install_sb(sb)

    monkeypatch.setenv("FRONTEND_URL", "https://staging.biqc.ai")

    state = _StripeState()
    _call_portal(monkeypatch, {"id": "user-1", "email": "user@example.com"}, state)

    assert state.portal_session_calls[0]["return_url"] == "https://staging.biqc.ai/billing"


def test_default_return_url_when_frontend_url_missing(monkeypatch):
    """Absent FRONTEND_URL, we must default to production to avoid
    bouncing the user to a local-dev URL from a live session."""
    sb = _FakeSB()
    sb.set_user("user-1", stripe_customer_id="cus_1", email="user@example.com")
    _install_sb(sb)

    monkeypatch.delenv("FRONTEND_URL", raising=False)

    state = _StripeState()
    _call_portal(monkeypatch, {"id": "user-1", "email": "user@example.com"}, state)

    assert state.portal_session_calls[0]["return_url"] == "https://biqc.ai/billing"
