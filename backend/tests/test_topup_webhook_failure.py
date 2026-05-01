from __future__ import annotations

from pathlib import Path
import sys
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.payment_state_service import apply_failed_or_action_required_outcome
from services.topup_service import mark_attempt_status


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
        if self.op == "update":
            out = []
            for row in rows:
                if _matches(row, self.filters):
                    row.update(self.payload)
                    out.append(dict(row))
            return _Result(out)
        out = [dict(r) for r in rows if _matches(r, self.filters)]
        return _Result(out)


def _matches(row: Dict[str, Any], filters: List[tuple]) -> bool:
    for op, col, val in filters:
        if op == "eq" and row.get(col) != val:
            return False
        if op == "gte" and str(row.get(col)) < str(val):
            return False
        if op == "lt" and str(row.get(col)) >= str(val):
            return False
    return True


class _Table:
    def __init__(self):
        self.rows: List[Dict[str, Any]] = []

    def select(self, _cols="*"):
        return _Query(self, "select")

    def update(self, payload):
        return _Query(self, "update", payload)

    def upsert(self, payload, on_conflict=None):  # noqa: ARG002
        for row in self.rows:
            if row.get("account_id") == payload.get("account_id"):
                row.update(payload)
                return _Query(self, "select")
        self.rows.append(dict(payload))
        return _Query(self, "select")


class _SB:
    def __init__(self):
        self.tables: Dict[str, _Table] = {}

    def table(self, name: str) -> _Table:
        return self.tables.setdefault(name, _Table())


def test_failed_or_requires_action_sets_payment_required_when_capacity_exhausted():
    sb = _SB()
    sb.table("topup_attempts").rows.append({"id": "att-1", "status": "pending"})
    sb.table("usage_ledger").rows.extend(
        [
            {
                "account_id": "acc-1",
                "kind": "consume",
                "tokens": 1_000_000,
                "created_at": "2026-05-10T00:00:00+00:00",
            },
        ]
    )
    sb.table("account_billing_policy").rows.append({"account_id": "acc-1", "payment_required": False})

    mark_attempt_status(sb, attempt_id="att-1", status="failed", failure_reason="payment_failed")
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


def test_historical_failure_does_not_set_payment_required_when_capacity_remains():
    sb = _SB()
    sb.table("usage_ledger").rows.append(
        {
            "account_id": "acc-2",
            "kind": "consume",
            "tokens": 100,
            "created_at": "2026-05-10T00:00:00+00:00",
        }
    )
    sb.table("account_billing_policy").rows.append({"account_id": "acc-2", "payment_required": True})

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

