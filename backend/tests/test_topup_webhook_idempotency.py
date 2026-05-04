from __future__ import annotations

from pathlib import Path
import sys
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.topup_ledger_service import grant_topup_tokens_once


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
        if self.op == "insert":
            row = dict(self.payload)
            row.setdefault("id", f"led-{len(self.table.rows)+1}")
            self.table.rows.append(row)
            return _Result([row])
        out = []
        for row in self.table.rows:
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


class _SB:
    def __init__(self):
        self.tables: Dict[str, _Table] = {}

    def table(self, name: str) -> _Table:
        return self.tables.setdefault(name, _Table())


def test_duplicate_webhook_replay_cannot_double_grant_topup_tokens():
    sb = _SB()
    attempt = {
        "id": "att-1",
        "account_id": "acc-1",
        "user_id": "user-1",
        "trigger_type": "manual",
        "tokens_grant": 250000,
        "price_aud_cents": 1900,
        "stripe_payment_intent_id": "pi_dup_1",
        "stripe_invoice_id": "in_1",
        "idempotency_key": "idem-1",
    }
    first = grant_topup_tokens_once(sb, attempt=attempt)
    second = grant_topup_tokens_once(sb, attempt=attempt)

    assert first["granted"] is True
    assert second["granted"] is False
    assert second["duplicate"] is True
    assert len(sb.table("usage_ledger").rows) == 1
    assert sb.table("usage_ledger").rows[0]["stripe_payment_intent_id"] == "pi_dup_1"

