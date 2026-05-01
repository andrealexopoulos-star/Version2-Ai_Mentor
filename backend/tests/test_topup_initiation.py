from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import sys
from typing import Any, Dict, List, Optional

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services import topup_service


class _Result:
    def __init__(self, data=None):
        self.data = data or []


class _Query:
    def __init__(self, table: "_Table", op: str, payload: Optional[Dict[str, Any]] = None):
        self.table = table
        self.op = op
        self.payload = payload or {}
        self.filters: List[tuple] = []
        self._order_col = None
        self._order_desc = False
        self._limit = None

    def select(self, _cols="*"):
        return self

    def eq(self, col, val):
        self.filters.append(("eq", col, val))
        return self

    def gte(self, col, val):
        self.filters.append(("gte", col, val))
        return self

    def lte(self, col, val):
        self.filters.append(("lte", col, val))
        return self

    def order(self, col, desc=False):
        self._order_col = col
        self._order_desc = desc
        return self

    def limit(self, n):
        self._limit = n
        return self

    def execute(self):
        rows = self.table.rows
        if self.op == "insert":
            payload = dict(self.payload)
            payload.setdefault("id", f"att-{len(rows)+1}")
            rows.append(payload)
            return _Result([payload])
        if self.op == "update":
            out = []
            for row in rows:
                if _matches(row, self.filters):
                    row.update(self.payload)
                    out.append(dict(row))
            return _Result(out)
        out = [dict(r) for r in rows if _matches(r, self.filters)]
        if self._order_col:
            out.sort(key=lambda r: r.get(self._order_col) or "", reverse=self._order_desc)
        if self._limit is not None:
            out = out[: self._limit]
        return _Result(out)


def _matches(row: Dict[str, Any], filters: List[tuple]) -> bool:
    for op, col, val in filters:
        cur = row.get(col)
        if op == "eq" and cur != val:
            return False
        if op == "gte" and str(cur) < str(val):
            return False
        if op == "lte" and str(cur) > str(val):
            return False
    return True


class _Table:
    def __init__(self):
        self.rows: List[Dict[str, Any]] = []

    def select(self, _cols="*"):
        return _Query(self, "select")

    def insert(self, payload):
        return _Query(self, "insert", payload)

    def update(self, payload):
        return _Query(self, "update", payload)


class _SB:
    def __init__(self):
        self.tables: Dict[str, _Table] = {}

    def table(self, name: str) -> _Table:
        return self.tables.setdefault(name, _Table())


class _PI:
    def __init__(self, pid: str, status: str = "requires_payment_method"):
        self.id = pid
        self.status = status
        self.client_secret = f"{pid}_secret"


def test_manual_topup_reuses_pending_scope(monkeypatch):
    sb = _SB()
    monkeypatch.setattr(topup_service, "_create_payment_intent", lambda **_: _PI("pi_1"))
    start = datetime(2026, 5, 1, tzinfo=timezone.utc)
    end = datetime(2026, 6, 1, tzinfo=timezone.utc)

    first = topup_service.initiate_topup(
        sb,
        account_id="acc-1",
        user_id="user-1",
        tier="starter",
        cycle_start=start,
        cycle_end=end,
        trigger_type="manual",
        attempt_scope="manual",
        stripe_customer_id="cus_1",
        stripe_subscription_id="sub_1",
        off_session=False,
    )
    second = topup_service.initiate_topup(
        sb,
        account_id="acc-1",
        user_id="user-1",
        tier="starter",
        cycle_start=start,
        cycle_end=end,
        trigger_type="manual",
        attempt_scope="manual",
        stripe_customer_id="cus_1",
        stripe_subscription_id="sub_1",
        off_session=False,
    )

    attempts = sb.table("topup_attempts").rows
    assert len(attempts) == 1
    assert first["reused_pending"] is False
    assert second["reused_pending"] is True
    # No success grant is written at initiation time.
    assert sb.table("usage_ledger").rows == []


def test_idempotency_key_is_deterministic():
    key1 = topup_service.build_idempotency_key(
        account_id="acc-1",
        cycle_start="2026-05-01T00:00:00+00:00",
        cycle_end="2026-06-01T00:00:00+00:00",
        trigger_type="manual",
        tokens_grant=250000,
        attempt_scope="manual",
    )
    key2 = topup_service.build_idempotency_key(
        account_id="acc-1",
        cycle_start="2026-05-01T00:00:00+00:00",
        cycle_end="2026-06-01T00:00:00+00:00",
        trigger_type="manual",
        tokens_grant=250000,
        attempt_scope="manual",
    )
    assert key1 == key2

