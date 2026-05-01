from __future__ import annotations

from pathlib import Path
import sys
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.payment_state_service import (
    apply_failed_or_action_required_outcome,
    clear_payment_required_on_success,
)


class _Result:
    def __init__(self, data=None):
        self.data = data or []


class _Query:
    def __init__(self, table: "_Table", op: str, payload: Optional[Dict[str, Any]] = None):
        self.table = table
        self.op = op
        self.payload = payload or {}
        self.filters: List[tuple] = []

    def select(self, _cols="*"):
        return self

    def eq(self, col, val):
        self.filters.append(("eq", col, val))
        return self

    def gte(self, col, val):
        self.filters.append(("gte", col, val))
        return self

    def lt(self, col, val):
        self.filters.append(("lt", col, val))
        return self

    def execute(self):
        rows = self.table.rows
        if self.op == "upsert":
            for row in rows:
                if row.get("account_id") == self.payload.get("account_id"):
                    row.update(self.payload)
                    return _Result([row])
            rows.append(dict(self.payload))
            return _Result([self.payload])

        out = []
        for row in rows:
            if _matches(row, self.filters):
                out.append(dict(row))
        return _Result(out)


def _matches(row: Dict[str, Any], filters: List[tuple]) -> bool:
    for op, col, val in filters:
        cur = row.get(col)
        if op == "eq" and cur != val:
            return False
        if op == "gte" and str(cur) < str(val):
            return False
        if op == "lt" and str(cur) >= str(val):
            return False
    return True


class _Table:
    def __init__(self):
        self.rows: List[Dict[str, Any]] = []

    def select(self, _cols="*"):
        return _Query(self, "select")

    def upsert(self, payload, on_conflict=None):  # noqa: ARG002
        return _Query(self, "upsert", payload)


class _SB:
    def __init__(self):
        self.tables: Dict[str, _Table] = {}

    def table(self, name: str):
        return self.tables.setdefault(name, _Table())


def test_payment_required_set_on_blocking_failure_and_cleared_on_success():
    sb = _SB()
    sb.table("usage_ledger").rows.append(
        {
            "account_id": "acc-1",
            "kind": "consume",
            "tokens": 1_000_000,
            "created_at": "2026-05-10T00:00:00+00:00",
        }
    )

    exhausted = apply_failed_or_action_required_outcome(
        sb,
        account_id="acc-1",
        tier="starter",
        cycle_start="2026-05-01T00:00:00+00:00",
        cycle_end="2026-06-01T00:00:00+00:00",
        failure_reason="payment_failed",
    )
    assert exhausted is True
    assert sb.table("account_billing_policy").rows[0]["payment_required"] is True

    clear_payment_required_on_success(sb, account_id="acc-1")
    assert sb.table("account_billing_policy").rows[0]["payment_required"] is False


def test_payment_required_not_set_for_non_blocking_historical_requires_action():
    sb = _SB()
    sb.table("usage_ledger").rows.append(
        {
            "account_id": "acc-2",
            "kind": "consume",
            "tokens": 50_000,
            "created_at": "2026-05-10T00:00:00+00:00",
        }
    )

    exhausted = apply_failed_or_action_required_outcome(
        sb,
        account_id="acc-2",
        tier="starter",
        cycle_start="2026-05-01T00:00:00+00:00",
        cycle_end="2026-06-01T00:00:00+00:00",
        failure_reason="requires_action",
    )
    assert exhausted is False
    assert sb.table("account_billing_policy").rows[0]["payment_required"] is False

