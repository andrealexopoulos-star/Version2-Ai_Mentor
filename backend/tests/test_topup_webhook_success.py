from __future__ import annotations

from pathlib import Path
import sys
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.payment_state_service import clear_payment_required_on_success
from services.topup_ledger_service import grant_topup_tokens_once
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

    def limit(self, _n):
        return self

    def execute(self):
        rows = self.table.rows
        if self.op == "insert":
            payload = dict(self.payload)
            payload.setdefault("id", f"row-{len(rows)+1}")
            rows.append(payload)
            return _Result([payload])
        if self.op == "update":
            out = []
            for row in rows:
                if all(row.get(c) == v for _, c, v in self.filters):
                    row.update(self.payload)
                    out.append(dict(row))
            return _Result(out)
        out = []
        for row in rows:
            if all(row.get(c) == v for _, c, v in self.filters):
                out.append(dict(row))
        return _Result(out)


class _Table:
    def __init__(self):
        self.rows: List[Dict[str, Any]] = []

    def select(self, _cols="*"):
        return _Query(self, "select")

    def insert(self, payload):
        return _Query(self, "insert", payload)

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


def test_webhook_success_marks_succeeded_grants_tokens_and_clears_lock():
    sb = _SB()
    sb.table("topup_attempts").rows.append(
        {
            "id": "att-1",
            "account_id": "acc-1",
            "user_id": "user-1",
            "tier": "starter",
            "status": "pending",
            "trigger_type": "manual",
            "tokens_grant": 250000,
            "price_aud_cents": 1900,
            "stripe_payment_intent_id": "pi_1",
            "idempotency_key": "idem-1",
        }
    )
    sb.table("account_billing_policy").rows.append(
        {"account_id": "acc-1", "payment_required": True}
    )

    mark_attempt_status(sb, attempt_id="att-1", status="succeeded")
    attempt = sb.table("topup_attempts").rows[0]
    out = grant_topup_tokens_once(sb, attempt=attempt)
    clear_payment_required_on_success(sb, account_id="acc-1")

    assert out["granted"] is True
    assert sb.table("usage_ledger").rows[0]["kind"] == "topup"
    assert sb.table("usage_ledger").rows[0]["tokens"] == 250000
    assert sb.table("topup_attempts").rows[0]["status"] == "succeeded"
    assert sb.table("account_billing_policy").rows[0]["payment_required"] is False

