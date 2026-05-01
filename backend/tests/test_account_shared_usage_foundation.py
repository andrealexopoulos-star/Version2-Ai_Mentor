"""PR-2 account-shared usage foundation tests.

Locks account/business-scoped allowance behavior:
- usage is shared across users on the same account_id
- user_id attribution is preserved for audit
- hard-stop behavior still blocks exhausted paid accounts (402)
- account isolation holds across different account_id values
"""
from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.plans import allocation_for
from core import token_meter
from middleware import token_metering


class _Result:
    def __init__(self, data: Any):
        self.data = data


class _Query:
    def __init__(self, db: "_FakeSupabase", table: str, op: str):
        self.db = db
        self.table = table
        self.op = op
        self.filters: List[tuple[str, str, Any]] = []
        self._limit: Optional[int] = None
        self._maybe_single = False
        self._payload: Optional[Dict[str, Any]] = None
        self._on_conflict: Optional[str] = None
        self._order: Optional[tuple[str, bool]] = None

    def select(self, _cols: str = "*") -> "_Query":
        return self

    def eq(self, col: str, val: Any) -> "_Query":
        self.filters.append(("eq", col, val))
        return self

    def gte(self, col: str, val: Any) -> "_Query":
        self.filters.append(("gte", col, val))
        return self

    def lt(self, col: str, val: Any) -> "_Query":
        self.filters.append(("lt", col, val))
        return self

    def in_(self, col: str, vals: List[Any]) -> "_Query":
        self.filters.append(("in", col, list(vals)))
        return self

    def maybe_single(self) -> "_Query":
        self._maybe_single = True
        return self

    def limit(self, n: int) -> "_Query":
        self._limit = n
        return self

    def order(self, col: str, desc: bool = False) -> "_Query":
        self._order = (col, bool(desc))
        return self

    def upsert(self, payload: Dict[str, Any], on_conflict: Optional[str] = None) -> "_Query":
        self.op = "upsert"
        self._payload = dict(payload)
        self._on_conflict = on_conflict
        return self

    def update(self, payload: Dict[str, Any]) -> "_Query":
        self.op = "update"
        self._payload = dict(payload)
        return self

    def execute(self) -> _Result:
        rows = self.db.tables.setdefault(self.table, [])

        if self.op == "upsert":
            payload = dict(self._payload or {})
            conflict_cols = [c.strip() for c in (self._on_conflict or "").split(",") if c.strip()]
            existing = None
            if conflict_cols:
                for row in rows:
                    if all(row.get(col) == payload.get(col) for col in conflict_cols):
                        existing = row
                        break
            if existing is not None:
                existing.update(payload)
                return _Result([dict(existing)])
            created = dict(payload)
            created.setdefault("id", f"{self.table}-{len(rows) + 1}")
            rows.append(created)
            return _Result([dict(created)])

        if self.op == "update":
            patched: List[Dict[str, Any]] = []
            for row in rows:
                if _match_filters(row, self.filters):
                    row.update(self._payload or {})
                    patched.append(dict(row))
            return _Result(patched)

        selected = [dict(row) for row in rows if _match_filters(row, self.filters)]
        if self._order:
            col, desc = self._order
            selected.sort(key=lambda r: r.get(col), reverse=desc)
        if self._limit is not None:
            selected = selected[: self._limit]
        if self._maybe_single:
            return _Result(selected[0] if selected else None)
        return _Result(selected)


def _match_filters(row: Dict[str, Any], filters: List[tuple[str, str, Any]]) -> bool:
    for op, col, value in filters:
        rv = row.get(col)
        if op == "eq" and rv != value:
            return False
        if op == "gte" and (rv is None or rv < value):
            return False
        if op == "lt" and (rv is None or rv >= value):
            return False
        if op == "in" and rv not in value:
            return False
    return True


class _FakeSupabase:
    def __init__(self):
        self.tables: Dict[str, List[Dict[str, Any]]] = {}

    def table(self, name: str) -> _Query:
        return _Query(self, name, "select")


def _seed_user(sb: _FakeSupabase, *, user_id: str, account_id: str, tier: str = "starter") -> None:
    sb.tables.setdefault("users", []).append(
        {
            "id": user_id,
            "account_id": account_id,
            "subscription_tier": tier,
            "subscription_status": "active",
            "current_period_end": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "stripe_customer_id": "cus_test",
            "stripe_subscription_id": "sub_test",
            "payment_required": False,
            "auto_topup_enabled": False,
        }
    )


def _seed_account_policy(sb: _FakeSupabase, *, account_id: str, tier: str = "starter") -> None:
    now = datetime.now(timezone.utc)
    sb.tables.setdefault("account_billing_policy", []).append(
        {
            "account_id": account_id,
            "effective_tier": tier,
            "payment_required": False,
            "auto_topup_enabled": False,
            "current_period_start": (now - timedelta(days=1)).isoformat(),
            "current_period_end": (now + timedelta(days=29)).isoformat(),
        }
    )


def test_same_account_two_users_share_allowance_and_no_fresh_quota():
    sb = _FakeSupabase()
    _seed_user(sb, user_id="u-a", account_id="acc-1", tier="starter")
    _seed_user(sb, user_id="u-b", account_id="acc-1", tier="starter")

    ok = token_metering.record_token_usage(
        sb,
        user_id="u-a",
        model="gpt-5.3",
        input_tokens=200_000,
        output_tokens=50_000,
        feature="llm_call",
        tier="starter",
    )
    assert ok is True

    budget_a = token_metering.check_token_budget(sb, user_id="u-a", tier="starter")
    budget_b = token_metering.check_token_budget(sb, user_id="u-b", tier="starter")
    assert budget_a["input_used"] == budget_b["input_used"]
    assert budget_a["output_used"] == budget_b["output_used"]
    assert budget_b["input_used"] > 0 or budget_b["output_used"] > 0

    alloc_rows = sb.tables.get("token_allocations", [])
    assert len(alloc_rows) == 1
    assert alloc_rows[0]["account_id"] == "acc-1"


def test_user_b_blocked_when_user_a_exhausts_shared_account_allowance():
    sb = _FakeSupabase()
    _seed_user(sb, user_id="u-a", account_id="acc-1", tier="starter")
    _seed_user(sb, user_id="u-b", account_id="acc-1", tier="starter")
    _seed_account_policy(sb, account_id="acc-1", tier="starter")
    sb.tables.setdefault("usage_ledger", []).append(
        {
            "id": "ul-1",
            "user_id": "u-a",
            "account_id": "acc-1",
            "kind": "consume",
            "tokens": allocation_for("starter"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    with pytest.raises(HTTPException) as exc:
        token_metering.enforce_free_tier_budget(sb, user_id="u-b", tier="starter")
    assert exc.value.status_code == 402
    assert exc.value.detail["error"] == "tier_capacity_exhausted"


def test_different_accounts_do_not_affect_each_other():
    sb = _FakeSupabase()
    _seed_user(sb, user_id="u-a", account_id="acc-1", tier="starter")
    _seed_user(sb, user_id="u-c", account_id="acc-2", tier="starter")
    _seed_account_policy(sb, account_id="acc-1", tier="starter")
    _seed_account_policy(sb, account_id="acc-2", tier="starter")
    sb.tables.setdefault("usage_ledger", []).append(
        {
            "id": "ul-1",
            "user_id": "u-a",
            "account_id": "acc-1",
            "kind": "consume",
            "tokens": allocation_for("starter"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    # Account 2 should remain unaffected.
    assert token_metering.enforce_free_tier_budget(sb, user_id="u-c", tier="starter") is None


def test_usage_rows_preserve_user_id_and_account_scope():
    sb = _FakeSupabase()
    _seed_user(sb, user_id="u-a", account_id="acc-1", tier="pro")

    ok = token_metering.record_token_usage(
        sb,
        user_id="u-a",
        model="gpt-5.3",
        input_tokens=1_000,
        output_tokens=500,
        tier="pro",
    )
    assert ok is True

    usage_rows = sb.tables.get("ai_usage_log", [])
    assert usage_rows, "ai_usage_log should have a usage row"
    assert usage_rows[0]["user_id"] == "u-a"

    alloc_rows = sb.tables.get("token_allocations", [])
    assert alloc_rows, "token_allocations should be created"
    assert alloc_rows[0]["account_id"] == "acc-1"
    assert alloc_rows[0]["user_id"] == "u-a"


def test_emit_consume_writes_account_scope_and_user_audit(monkeypatch):
    captured: List[Dict[str, Any]] = []

    def _fake_insert(_sb, row):
        captured.append(dict(row))

    monkeypatch.setattr(token_meter, "_insert_sync", _fake_insert)

    async def _run():
        await token_meter.emit_consume(
            sb=None,
            user_id="u-a",
            account_id="acc-1",
            model="gpt-5.3",
            input_tokens=100,
            output_tokens=25,
            tier_at_event="starter",
        )
        await asyncio.sleep(0.05)

    asyncio.run(_run())
    assert captured, "usage_ledger consume row was not inserted"
    assert captured[0]["user_id"] == "u-a"
    assert captured[0]["account_id"] == "acc-1"


def test_plan_allowance_values_are_contract_locked():
    assert allocation_for("growth") == 1_000_000
    assert allocation_for("professional") == 5_000_000
    assert allocation_for("business") == 20_000_000


def test_super_admin_exemption_unchanged():
    sb = _FakeSupabase()
    _seed_user(sb, user_id="u-sa", account_id="acc-sa", tier="super_admin")
    _seed_account_policy(sb, account_id="acc-sa", tier="super_admin")
    sb.tables.setdefault("usage_ledger", []).append(
        {
            "id": "ul-sa",
            "user_id": "u-sa",
            "account_id": "acc-sa",
            "kind": "consume",
            "tokens": 999_999_999,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    assert token_metering.enforce_free_tier_budget(sb, user_id="u-sa", tier="super_admin") is None
