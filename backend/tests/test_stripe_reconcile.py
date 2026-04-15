"""Unit tests for the Stripe → DB reconcile job (Step 10 / P1-5).

Purpose
-------
The nightly reconcile job (`backend/jobs/stripe_reconcile.py`) is our
last line of defence against silent webhook failures. If a
subscription.deleted webhook gets lost, the DB keeps thinking the user
is paid. If a tier upgrade webhook is delivered before the user row
exists, the DB keeps the old tier. This job detects those drifts and
writes them to `stripe_reconcile_log` for ops.

Because the job runs unattended and its output drives support work,
every drift type, every failure mode, and every edge case must be
covered by tests. A false negative here means a paying customer gets
lost; a false positive means ops chases a ghost.

These tests use a fake Stripe module (dicts with `data` field) and a
recording Supabase client so we can assert the exact shape of every
row written to `stripe_reconcile_log` without touching a real DB.
"""
from __future__ import annotations

import sys
import types
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# ─── Test fixtures ───────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _stub_heavy_imports(monkeypatch):
    """Stubs imports that pull in Supabase / Stripe at module load so
    the reconcile module can be imported cleanly on Py 3.9 CI boxes.

    The reconciler does `from routes.stripe_payments import PLANS` lazily
    inside `_tier_from_stripe_sub`. Real `routes.stripe_payments` imports
    `routes.auth` → `routes.deps` → `auth_supabase` → `supabase_client`,
    and `supabase_client` uses PEP-604 union syntax which Py 3.9 can't
    parse. So we inject a lightweight stub module that exposes the PLANS
    dict we need — nothing more.
    """
    sb_stub = types.ModuleType("supabase_client")
    sb_stub.init_supabase = lambda: None
    sb_stub.get_supabase_client = lambda: None
    monkeypatch.setitem(sys.modules, "supabase_client", sb_stub)

    # Fake routes.stripe_payments — only PLANS is touched by the
    # reconciler. Must mirror the real amounts so tier inference tests
    # aren't hiding a divergence.
    routes_pkg = sys.modules.get("routes") or types.ModuleType("routes")
    monkeypatch.setitem(sys.modules, "routes", routes_pkg)
    stripe_payments_stub = types.ModuleType("routes.stripe_payments")
    stripe_payments_stub.PLANS = {
        "starter": {"amount": 6900, "tier": "starter"},
        "foundation": {"amount": 6900, "tier": "starter"},
        "growth": {"amount": 6900, "tier": "starter"},
        "professional": {"amount": 19900, "tier": "pro"},
        "pro": {"amount": 19900, "tier": "pro"},
        "business": {"amount": 34900, "tier": "business"},
        "enterprise": {"amount": 0, "tier": "enterprise"},
    }
    routes_pkg.stripe_payments = stripe_payments_stub
    monkeypatch.setitem(sys.modules, "routes.stripe_payments", stripe_payments_stub)

    # Ensure the reconcile module picks up any changes on each test.
    if "jobs.stripe_reconcile" in sys.modules:
        del sys.modules["jobs.stripe_reconcile"]


class _RecordingSB:
    """A minimal Supabase client stand-in. Captures every
    `table(...).insert(...).execute()` chain plus the result of
    `select(...).eq(...).limit(...).execute()` / stale-row scans.

    The reconciler only ever calls two table shapes:
      • users          — read (via select + eq + limit)
      • users          — read (via select + in_ + not_.is_)
      • stripe_reconcile_log — write (insert)

    Each `_setup_users_*` helper primes the response for a specific
    query pattern so individual tests stay concise.
    """

    def __init__(self) -> None:
        self.inserts: List[Dict[str, Any]] = []
        # Maps customer_id -> single-row dict (or None for "not found").
        self._users_by_customer: Dict[str, Optional[Dict[str, Any]]] = {}
        # Rows returned by the stale-DB scan.
        self._stale_candidates: List[Dict[str, Any]] = []
        # Flip to True to simulate users-table outages.
        self.users_lookup_raises = False
        self.stale_scan_raises = False
        self.insert_raises = False

    def setup_user(self, customer_id: str, **row) -> None:
        """Register a user row that will be returned when the
        reconciler queries by stripe_customer_id."""
        row.setdefault("stripe_customer_id", customer_id)
        row.setdefault("id", f"user-{customer_id}")
        self._users_by_customer[customer_id] = row

    def setup_missing_user(self, customer_id: str) -> None:
        """Ensure a customer_id has NO matching user row."""
        self._users_by_customer[customer_id] = None

    def setup_stale_candidates(self, rows: List[Dict[str, Any]]) -> None:
        """Rows that the stale-DB scan will yield. Reconciler will emit
        a stale_db_status row for each whose stripe_customer_id is NOT
        in the set of seen customer_ids from the Stripe pass."""
        self._stale_candidates = list(rows)

    def table(self, name: str) -> "_RecordingSBTable":
        return _RecordingSBTable(self, name)


class _RecordingSBTable:
    def __init__(self, sb: _RecordingSB, name: str) -> None:
        self._sb = sb
        self._name = name
        self._op: Optional[str] = None
        self._select_cols: Optional[str] = None
        self._eq_filters: Dict[str, Any] = {}
        self._in_filters: Dict[str, List[Any]] = {}
        self._not_is_filters: Dict[str, Any] = {}
        self._limit_value: Optional[int] = None
        self._insert_row: Optional[Dict[str, Any]] = None

    def select(self, cols: str) -> "_RecordingSBTable":
        self._op = "select"
        self._select_cols = cols
        return self

    def insert(self, row: Dict[str, Any]) -> "_RecordingSBTable":
        self._op = "insert"
        self._insert_row = row
        return self

    def eq(self, col: str, value: Any) -> "_RecordingSBTable":
        self._eq_filters[col] = value
        return self

    def in_(self, col: str, values: List[Any]) -> "_RecordingSBTable":
        self._in_filters[col] = values
        return self

    @property
    def not_(self) -> "_NotProxy":
        return _NotProxy(self)

    def limit(self, n: int) -> "_RecordingSBTable":
        self._limit_value = n
        return self

    def execute(self) -> "_Response":
        if self._op == "insert":
            if self._sb.insert_raises:
                raise RuntimeError("simulated DB outage on insert")
            assert self._insert_row is not None
            # Tag inserts with the table name so tests can assert origin.
            self._sb.inserts.append({"_table": self._name, **self._insert_row})
            return _Response([self._insert_row])

        # SELECT branch — users table only.
        if self._name == "users":
            if self._eq_filters.get("stripe_customer_id") is not None:
                if self._sb.users_lookup_raises:
                    raise RuntimeError("simulated DB outage on users lookup")
                cid = self._eq_filters["stripe_customer_id"]
                row = self._sb._users_by_customer.get(cid)
                return _Response([row] if row else [])
            if self._in_filters.get("subscription_status") is not None:
                if self._sb.stale_scan_raises:
                    raise RuntimeError("simulated DB outage on stale scan")
                return _Response(list(self._sb._stale_candidates))
        return _Response([])


class _NotProxy:
    def __init__(self, table: _RecordingSBTable) -> None:
        self._table = table

    def is_(self, col: str, value: Any) -> _RecordingSBTable:
        self._table._not_is_filters[col] = value
        return self._table


class _Response:
    def __init__(self, data: List[Any]) -> None:
        self.data = data


# ─── Fake Stripe module ──────────────────────────────────────────

class _StripeObject(dict):
    """Dict that also supports attribute access — mimics the Stripe
    SDK's behavior where you can do both sub['id'] and sub.id."""

    def __getattr__(self, item: str) -> Any:
        if item in self:
            return self[item]
        raise AttributeError(item)


def _make_sub(
    sub_id: str,
    customer_id: str,
    status: str,
    unit_amount: Optional[int] = 6900,
    current_period_end: Optional[int] = 1800000000,
) -> _StripeObject:
    """Build a _StripeObject shaped like a Stripe subscription. Only
    fills the fields the reconciler actually reads; everything else
    would be noise."""
    items = _StripeObject(
        data=[
            _StripeObject(
                price=_StripeObject(unit_amount=unit_amount) if unit_amount is not None else _StripeObject()
            )
        ]
    )
    return _StripeObject(
        id=sub_id,
        customer=customer_id,
        status=status,
        current_period_end=current_period_end,
        items=items,
    )


class _FakeStripeListing:
    """Shape returned by stripe.Subscription.list. Only exposes
    auto_paging_iter when `use_auto_pager=True` so the fallback-iter
    branch of `_iter_stripe_subscriptions` can also be exercised."""

    def __init__(self, subs: List[Any], use_auto_pager: bool = True) -> None:
        self._subs = subs
        if use_auto_pager:
            # Attach the method only when the test wants it — the
            # reconciler uses getattr(listing, "auto_paging_iter", None)
            # so "no attribute" is the right signal for the fallback.
            self.auto_paging_iter = lambda: iter(self._subs)

    @property
    def data(self) -> List[Any]:
        # Used by the fallback path in _iter_stripe_subscriptions.
        return self._subs


class _FakeSubscriptionNS:
    def __init__(self, subs: List[Any], use_auto_pager: bool = True, raise_exc: Optional[Exception] = None) -> None:
        self._subs = subs
        self._use_auto_pager = use_auto_pager
        self._raise_exc = raise_exc

    def list(self, **kwargs):  # noqa: A003 — mirrors Stripe SDK naming
        if self._raise_exc is not None:
            raise self._raise_exc
        # Sanity check: the reconciler must ask for status="all" so
        # cancelled subs are included.
        assert kwargs.get("status") == "all"
        return _FakeStripeListing(self._subs, use_auto_pager=self._use_auto_pager)


class _FakeStripe:
    def __init__(self, subs: List[Any], use_auto_pager: bool = True, raise_exc: Optional[Exception] = None) -> None:
        self.Subscription = _FakeSubscriptionNS(subs, use_auto_pager=use_auto_pager, raise_exc=raise_exc)


# ─── Helpers to inspect drift rows ───────────────────────────────

def _drift_rows(sb: _RecordingSB) -> List[Dict[str, Any]]:
    return [r for r in sb.inserts if r.get("_table") == "stripe_reconcile_log"]


def _rows_by_type(sb: _RecordingSB, drift_type: str) -> List[Dict[str, Any]]:
    return [r for r in _drift_rows(sb) if r.get("drift_type") == drift_type]


def _summary_row(sb: _RecordingSB) -> Dict[str, Any]:
    rows = _rows_by_type(sb, "run_summary")
    assert len(rows) == 1, f"expected exactly 1 run_summary row, got {len(rows)}"
    return rows[0]


# ─── Happy path ──────────────────────────────────────────────────

def test_happy_path_zero_drift():
    """Subscription matches the DB mirror exactly — no drift rows
    except the run_summary bookkeeping row."""
    from jobs.stripe_reconcile import run_stripe_reconcile

    sb = _RecordingSB()
    sb.setup_user(
        "cus_1",
        id="user-1",
        subscription_tier="starter",
        subscription_status="active",
        current_period_end="2027-01-01T00:00:00+00:00",
    )
    stripe = _FakeStripe([
        _make_sub("sub_1", "cus_1", "active", unit_amount=6900, current_period_end=int(__import__("datetime").datetime(2027, 1, 1, tzinfo=__import__("datetime").timezone.utc).timestamp())),
    ])

    summary = run_stripe_reconcile(sb, stripe_module=stripe)

    # Only the run_summary row — every other drift type is zero.
    assert summary["checked_subscriptions"] == 1
    assert summary["total_drift"] == 0
    assert summary["drift_counts"]["status_mismatch"] == 0
    assert summary["drift_counts"]["tier_mismatch"] == 0
    assert summary["drift_counts"]["period_end_mismatch"] == 0
    assert summary["drift_counts"]["missing_user"] == 0
    assert summary["drift_counts"]["unknown_price"] == 0
    assert summary["drift_counts"]["stale_db_status"] == 0
    assert summary["errors"] == []

    # Single row — the summary — nothing else.
    assert len(_drift_rows(sb)) == 1
    assert _summary_row(sb)["run_id"] == summary["run_id"]


def test_summary_always_written_even_if_no_subscriptions():
    """Stripe returns zero subs — the summary row must still be
    recorded so ops can filter by run_id."""
    from jobs.stripe_reconcile import run_stripe_reconcile

    sb = _RecordingSB()
    stripe = _FakeStripe([])

    summary = run_stripe_reconcile(sb, stripe_module=stripe)

    assert summary["checked_subscriptions"] == 0
    assert summary["total_drift"] == 0
    assert len(_drift_rows(sb)) == 1  # only run_summary


# ─── Drift detection ─────────────────────────────────────────────

def test_status_mismatch_logged():
    """Stripe says canceled, DB still says active — must be flagged."""
    from jobs.stripe_reconcile import run_stripe_reconcile

    sb = _RecordingSB()
    sb.setup_user(
        "cus_1",
        id="user-1",
        subscription_tier="starter",
        subscription_status="active",
        current_period_end=None,
    )
    stripe = _FakeStripe([
        _make_sub("sub_1", "cus_1", "canceled", unit_amount=6900, current_period_end=None),
    ])

    summary = run_stripe_reconcile(sb, stripe_module=stripe)

    rows = _rows_by_type(sb, "status_mismatch")
    assert summary["drift_counts"]["status_mismatch"] == 1
    assert len(rows) == 1
    assert rows[0]["stripe_value"] == "canceled"
    assert rows[0]["db_value"] == "active"
    assert rows[0]["stripe_subscription_id"] == "sub_1"
    assert rows[0]["stripe_customer_id"] == "cus_1"
    assert rows[0]["user_id"] == "user-1"


def test_tier_mismatch_logged():
    """Stripe has unit_amount=19900 (pro) but DB still says starter."""
    from jobs.stripe_reconcile import run_stripe_reconcile

    sb = _RecordingSB()
    sb.setup_user(
        "cus_1",
        id="user-1",
        subscription_tier="starter",
        subscription_status="active",
        current_period_end=None,
    )
    stripe = _FakeStripe([
        _make_sub("sub_1", "cus_1", "active", unit_amount=19900, current_period_end=None),
    ])

    summary = run_stripe_reconcile(sb, stripe_module=stripe)

    rows = _rows_by_type(sb, "tier_mismatch")
    assert summary["drift_counts"]["tier_mismatch"] == 1
    assert len(rows) == 1
    assert rows[0]["stripe_value"] == "pro"
    assert rows[0]["db_value"] == "starter"


def test_period_end_mismatch_logged():
    """DB period_end differs from Stripe by more than the tolerance."""
    from jobs.stripe_reconcile import run_stripe_reconcile
    from datetime import datetime, timezone

    sb = _RecordingSB()
    sb.setup_user(
        "cus_1",
        id="user-1",
        subscription_tier="starter",
        subscription_status="active",
        current_period_end="2027-06-01T00:00:00+00:00",
    )
    stripe_epoch = int(datetime(2027, 1, 1, tzinfo=timezone.utc).timestamp())
    stripe = _FakeStripe([
        _make_sub("sub_1", "cus_1", "active", unit_amount=6900, current_period_end=stripe_epoch),
    ])

    summary = run_stripe_reconcile(sb, stripe_module=stripe)

    rows = _rows_by_type(sb, "period_end_mismatch")
    assert summary["drift_counts"]["period_end_mismatch"] == 1
    assert len(rows) == 1
    assert "2027-01-01" in (rows[0]["stripe_value"] or "")
    assert "2027-06-01" in (rows[0]["db_value"] or "")


def test_period_end_within_tolerance_does_not_flag():
    """If the timestamps differ by a few seconds, that's clock skew,
    not drift — must NOT produce a row."""
    from jobs.stripe_reconcile import run_stripe_reconcile
    from datetime import datetime, timezone

    sb = _RecordingSB()
    stripe_epoch = int(datetime(2027, 1, 1, 0, 0, 0, tzinfo=timezone.utc).timestamp())
    # DB 30 seconds ahead — within the 60s tolerance.
    db_str = "2027-01-01T00:00:30+00:00"
    sb.setup_user(
        "cus_1",
        id="user-1",
        subscription_tier="starter",
        subscription_status="active",
        current_period_end=db_str,
    )
    stripe = _FakeStripe([
        _make_sub("sub_1", "cus_1", "active", unit_amount=6900, current_period_end=stripe_epoch),
    ])

    summary = run_stripe_reconcile(sb, stripe_module=stripe)

    assert summary["drift_counts"]["period_end_mismatch"] == 0


def test_period_end_not_checked_for_cancelled_subs():
    """Cancelled subs have a meaningless current_period_end on Stripe's
    side — skipping the check avoids noise from terminated customers."""
    from jobs.stripe_reconcile import run_stripe_reconcile

    sb = _RecordingSB()
    sb.setup_user(
        "cus_1",
        id="user-1",
        subscription_tier="starter",
        subscription_status="canceled",
        current_period_end="2019-01-01T00:00:00+00:00",
    )
    stripe = _FakeStripe([
        _make_sub("sub_1", "cus_1", "canceled", unit_amount=6900, current_period_end=9999999999),
    ])

    summary = run_stripe_reconcile(sb, stripe_module=stripe)

    # Status matches, so no status_mismatch; period_end skipped; total = 0.
    assert summary["total_drift"] == 0


def test_missing_user_logged():
    """Stripe has the sub but no user row is linked to the customer id."""
    from jobs.stripe_reconcile import run_stripe_reconcile

    sb = _RecordingSB()
    sb.setup_missing_user("cus_orphan")
    stripe = _FakeStripe([
        _make_sub("sub_1", "cus_orphan", "active", unit_amount=6900),
    ])

    summary = run_stripe_reconcile(sb, stripe_module=stripe)

    rows = _rows_by_type(sb, "missing_user")
    assert summary["drift_counts"]["missing_user"] == 1
    assert len(rows) == 1
    assert rows[0]["stripe_subscription_id"] == "sub_1"
    assert rows[0]["stripe_customer_id"] == "cus_orphan"
    assert rows[0]["user_id"] is None


def test_unknown_price_logged():
    """Subscription unit_amount doesn't match any PLANS entry — needs a
    row so ops can decide whether to extend PLANS or fix the sub."""
    from jobs.stripe_reconcile import run_stripe_reconcile

    sb = _RecordingSB()
    sb.setup_user(
        "cus_1",
        id="user-1",
        subscription_tier="free",
        subscription_status="active",
        current_period_end=None,
    )
    stripe = _FakeStripe([
        _make_sub("sub_1", "cus_1", "active", unit_amount=12345, current_period_end=None),
    ])

    summary = run_stripe_reconcile(sb, stripe_module=stripe)

    rows = _rows_by_type(sb, "unknown_price")
    assert summary["drift_counts"]["unknown_price"] == 1
    assert len(rows) == 1
    assert rows[0]["stripe_subscription_id"] == "sub_1"
    assert "12345" in (rows[0]["stripe_value"] or "") or rows[0]["notes"]


def test_unknown_price_still_records_status_and_missing_user_logic():
    """When tier is unknown we still compare status and look for the
    user — `unknown_price` is in addition to, not instead of, those."""
    from jobs.stripe_reconcile import run_stripe_reconcile

    sb = _RecordingSB()
    sb.setup_missing_user("cus_1")
    stripe = _FakeStripe([
        _make_sub("sub_1", "cus_1", "active", unit_amount=12345),
    ])

    summary = run_stripe_reconcile(sb, stripe_module=stripe)

    # Both drift types fire for the same sub.
    assert summary["drift_counts"]["unknown_price"] == 1
    assert summary["drift_counts"]["missing_user"] == 1


# ─── Stale DB pass ──────────────────────────────────────────────

def test_stale_db_row_flagged_when_not_in_stripe_listing():
    """DB says user is active with a stripe_customer_id, but Stripe's
    subscription list didn't return any sub for that customer — classic
    missed-cancel-webhook drift."""
    from jobs.stripe_reconcile import run_stripe_reconcile

    sb = _RecordingSB()
    # Stripe returns ZERO subs, so the seen-customer set will be empty.
    sb.setup_stale_candidates([
        {"id": "user-ghost", "stripe_customer_id": "cus_ghost", "subscription_status": "active", "subscription_tier": "starter"},
    ])
    stripe = _FakeStripe([])

    summary = run_stripe_reconcile(sb, stripe_module=stripe)

    rows = _rows_by_type(sb, "stale_db_status")
    assert summary["drift_counts"]["stale_db_status"] == 1
    assert len(rows) == 1
    assert rows[0]["stripe_customer_id"] == "cus_ghost"
    assert rows[0]["user_id"] == "user-ghost"
    assert rows[0]["db_value"] == "active"


def test_stale_db_row_skipped_when_stripe_returned_the_customer():
    """If Stripe DID return a subscription for this customer (even if
    the subscription itself drifts for other reasons), the stale-DB
    pass must not double-count it."""
    from jobs.stripe_reconcile import run_stripe_reconcile

    sb = _RecordingSB()
    sb.setup_user(
        "cus_1",
        id="user-1",
        subscription_tier="starter",
        subscription_status="active",
        current_period_end=None,
    )
    sb.setup_stale_candidates([
        {"id": "user-1", "stripe_customer_id": "cus_1", "subscription_status": "active", "subscription_tier": "starter"},
    ])
    stripe = _FakeStripe([
        _make_sub("sub_1", "cus_1", "active", unit_amount=6900, current_period_end=None),
    ])

    summary = run_stripe_reconcile(sb, stripe_module=stripe)

    assert summary["drift_counts"]["stale_db_status"] == 0


# ─── Exception handling ─────────────────────────────────────────

def test_top_level_stripe_api_error_reraises():
    """A Stripe API outage must propagate — a silent "0 drifts" would
    give ops a false green light."""
    from jobs.stripe_reconcile import run_stripe_reconcile

    sb = _RecordingSB()
    stripe = _FakeStripe([], raise_exc=RuntimeError("Stripe API is down"))

    with pytest.raises(RuntimeError, match="Stripe API is down"):
        run_stripe_reconcile(sb, stripe_module=stripe)


def test_per_sub_exception_becomes_synthetic_drift_row():
    """A single misshapen subscription must not abort the whole run —
    it gets logged as missing_user with an internal_error note and the
    run keeps going.

    To force the exception, we use a subscription whose `items.data` is
    a tuple-like object that raises on indexing. `_tier_from_stripe_sub`
    reaches `data[0]` without a guard, so the error propagates out of
    `_reconcile_single_subscription` into the caller's per-sub try/except.
    """
    from jobs.stripe_reconcile import run_stripe_reconcile

    sb = _RecordingSB()
    sb.setup_user(
        "cus_1",
        id="user-1",
        subscription_tier="starter",
        subscription_status="active",
        current_period_end=None,
    )

    class _RaiseOnIndex:
        """Truthy (len > 0) so `if not data` passes, but raises on [0]."""

        def __len__(self) -> int:
            return 1

        def __bool__(self) -> bool:
            return True

        def __getitem__(self, idx):
            raise RuntimeError("corrupt Stripe payload")

    broken = _StripeObject(
        id="sub_broken",
        customer="cus_broken",
        status="active",
        current_period_end=None,
        items=_StripeObject(data=_RaiseOnIndex()),
    )
    good = _make_sub("sub_ok", "cus_1", "active", unit_amount=6900, current_period_end=None)

    stripe = _FakeStripe([broken, good])
    summary = run_stripe_reconcile(sb, stripe_module=stripe)

    # The run still completed and processed the good sub.
    assert summary["checked_subscriptions"] == 2
    # The broken sub became an error entry + a synthetic missing_user row.
    assert len(summary["errors"]) == 1
    assert "sub_broken" in summary["errors"][0]

    synth = [r for r in _rows_by_type(sb, "missing_user") if r.get("stripe_subscription_id") == "sub_broken"]
    assert len(synth) == 1
    assert "internal_error" in (synth[0].get("notes") or "")


def test_users_lookup_failure_records_missing_user():
    """If the users-table lookup itself fails (DB outage), the reconciler
    treats it as 'no user row' and keeps going."""
    from jobs.stripe_reconcile import run_stripe_reconcile

    sb = _RecordingSB()
    sb.users_lookup_raises = True
    stripe = _FakeStripe([
        _make_sub("sub_1", "cus_1", "active", unit_amount=6900),
    ])

    summary = run_stripe_reconcile(sb, stripe_module=stripe)

    # Lookup raised → treated as missing user.
    assert summary["drift_counts"]["missing_user"] >= 1


def test_insert_failure_does_not_abort_run():
    """Supabase insert failure for one drift row must not prevent
    subsequent rows from being attempted, and must not blow up the
    run summary."""
    from jobs.stripe_reconcile import run_stripe_reconcile

    sb = _RecordingSB()
    sb.insert_raises = True  # every insert will raise
    sb.setup_missing_user("cus_1")
    stripe = _FakeStripe([
        _make_sub("sub_1", "cus_1", "active", unit_amount=6900),
    ])

    # Should not raise — insert failures are logged and swallowed.
    summary = run_stripe_reconcile(sb, stripe_module=stripe)

    assert summary["checked_subscriptions"] == 1
    # drift was DETECTED even though insertion failed:
    assert summary["drift_counts"]["missing_user"] == 1


# ─── Pagination fallback ────────────────────────────────────────

def test_pagination_fallback_when_auto_paging_iter_missing():
    """Some SDK mock / fake clients return a bare list; the reconciler
    must handle that by iterating .data instead of auto_paging_iter."""
    from jobs.stripe_reconcile import run_stripe_reconcile

    sb = _RecordingSB()
    sb.setup_user(
        "cus_1",
        id="user-1",
        subscription_tier="starter",
        subscription_status="active",
        current_period_end=None,
    )
    stripe = _FakeStripe(
        [_make_sub("sub_1", "cus_1", "active", unit_amount=6900, current_period_end=None)],
        use_auto_pager=False,
    )

    summary = run_stripe_reconcile(sb, stripe_module=stripe)

    assert summary["checked_subscriptions"] == 1


# ─── Summary shape ──────────────────────────────────────────────

def test_summary_row_contains_run_id_and_counts():
    """The run_summary row's notes field should list every count so a
    dashboard can read the one row even if the individual drift rows
    were truncated."""
    from jobs.stripe_reconcile import run_stripe_reconcile

    sb = _RecordingSB()
    sb.setup_missing_user("cus_1")
    stripe = _FakeStripe([
        _make_sub("sub_1", "cus_1", "active", unit_amount=6900),
    ])

    summary = run_stripe_reconcile(sb, stripe_module=stripe)
    row = _summary_row(sb)

    assert row["run_id"] == summary["run_id"]
    notes = row["notes"] or ""
    assert "checked=1" in notes
    assert "missing=1" in notes
    assert "duration_ms=" in notes


def test_run_id_is_unique_per_run():
    """Two consecutive runs must produce distinct run_ids so the run_id
    index can cleanly group rows."""
    from jobs.stripe_reconcile import run_stripe_reconcile

    sb = _RecordingSB()
    stripe = _FakeStripe([])

    first = run_stripe_reconcile(sb, stripe_module=stripe)
    second = run_stripe_reconcile(sb, stripe_module=stripe)

    assert first["run_id"] != second["run_id"]


def test_summary_returns_iso_timestamps():
    """started_at / finished_at must be ISO strings for JSON
    serialisation — the admin endpoint returns this dict directly."""
    from jobs.stripe_reconcile import run_stripe_reconcile

    sb = _RecordingSB()
    stripe = _FakeStripe([])
    summary = run_stripe_reconcile(sb, stripe_module=stripe)

    # Just assert they parse as ISO — any stricter and we'd couple to format.
    from datetime import datetime
    datetime.fromisoformat(summary["started_at"])
    datetime.fromisoformat(summary["finished_at"])


# ─── Tier inference matrix ──────────────────────────────────────

@pytest.mark.parametrize(
    "unit_amount,expected_tier",
    [
        (6900, "starter"),
        (19900, "pro"),
        (34900, "business"),
        # 0 matches enterprise (enterprise amount is 0 in PLANS).
        (0, "enterprise"),
    ],
)
def test_tier_inference_from_unit_amount(unit_amount, expected_tier):
    """Verify the amount → canonical tier mapping agrees with PLANS."""
    from jobs.stripe_reconcile import _tier_from_stripe_sub

    sub = _make_sub("sub_1", "cus_1", "active", unit_amount=unit_amount)
    assert _tier_from_stripe_sub(sub) == expected_tier


def test_tier_inference_returns_none_for_unknown_amount():
    from jobs.stripe_reconcile import _tier_from_stripe_sub

    sub = _make_sub("sub_1", "cus_1", "active", unit_amount=54321)
    assert _tier_from_stripe_sub(sub) is None


def test_tier_inference_returns_none_when_no_items():
    from jobs.stripe_reconcile import _tier_from_stripe_sub

    sub = _StripeObject(id="sub_1", customer="cus_1", status="active", items=_StripeObject(data=[]))
    assert _tier_from_stripe_sub(sub) is None


# ─── Timestamp helper ───────────────────────────────────────────

def test_timestamps_match_both_none_is_true():
    from jobs.stripe_reconcile import _timestamps_match
    assert _timestamps_match(None, None) is True


def test_timestamps_match_one_none_is_false():
    from jobs.stripe_reconcile import _timestamps_match
    assert _timestamps_match(1800000000, None) is False
    assert _timestamps_match(None, "2027-01-01T00:00:00+00:00") is False


def test_timestamps_match_with_z_suffix():
    """DB values sometimes come back with Z instead of +00:00; both
    must parse to the same instant."""
    from jobs.stripe_reconcile import _timestamps_match
    from datetime import datetime, timezone
    epoch = int(datetime(2027, 1, 1, tzinfo=timezone.utc).timestamp())
    assert _timestamps_match(epoch, "2027-01-01T00:00:00Z") is True


def test_timestamps_match_naive_string_treated_as_utc():
    """If the DB returns a naive ISO string, assume UTC rather than
    flagging every row as drift."""
    from jobs.stripe_reconcile import _timestamps_match
    from datetime import datetime, timezone
    epoch = int(datetime(2027, 1, 1, tzinfo=timezone.utc).timestamp())
    assert _timestamps_match(epoch, "2027-01-01T00:00:00") is True
