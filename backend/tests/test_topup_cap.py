from __future__ import annotations

from pathlib import Path
import sys
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.topup_policy_service import build_eligibility, resolve_topup_cap_for_tier


class _Result:
    def __init__(self, data=None):
        self.data = data or []


class _Query:
    def __init__(self, table: "_Table"):
        self.table = table
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

    def lt(self, col, val):
        self.filters.append(("lt", col, val))
        return self

    def order(self, col, desc=False):
        self._order_col = col
        self._order_desc = desc
        return self

    def limit(self, n):
        self._limit = n
        return self

    def execute(self):
        rows = [dict(r) for r in self.table.rows if _matches(r, self.filters)]
        if self._order_col:
            rows.sort(key=lambda r: r.get(self._order_col) or "", reverse=self._order_desc)
        if self._limit is not None:
            rows = rows[: self._limit]
        return _Result(rows)


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
        return _Query(self)


class _SB:
    def __init__(self):
        self.tables: Dict[str, _Table] = {}

    def table(self, name: str):
        return self.tables.setdefault(name, _Table())


def test_cap_resolution_uses_override_then_plan_default():
    assert resolve_topup_cap_for_tier(tier="starter", monthly_topup_cap_override=None) == 3
    assert resolve_topup_cap_for_tier(tier="pro", monthly_topup_cap_override=None) == 5
    assert resolve_topup_cap_for_tier(tier="business", monthly_topup_cap_override=None) == 10
    assert resolve_topup_cap_for_tier(tier="starter", monthly_topup_cap_override=1) == 1


def test_latest_consent_wins_and_revocation_disables_auto_topup():
    sb = _SB()
    sb.table("topup_consent_events").rows.extend(
        [
            {
                "account_id": "acc-1",
                "consent_action": "granted",
                "created_at": "2026-05-01T00:00:00+00:00",
            },
            {
                "account_id": "acc-1",
                "consent_action": "revoked",
                "created_at": "2026-05-10T00:00:00+00:00",
            },
        ]
    )
    sb.table("topup_attempts").rows.extend(
        [
            {
                "account_id": "acc-1",
                "status": "succeeded",
                "created_at": "2026-05-02T00:00:00+00:00",
            },
            {
                "account_id": "acc-1",
                "status": "succeeded",
                "created_at": "2026-05-03T00:00:00+00:00",
            },
            {
                "account_id": "acc-1",
                "status": "succeeded",
                "created_at": "2026-05-04T00:00:00+00:00",
            },
        ]
    )

    eligibility = build_eligibility(
        sb,
        user_state={
            "id": "user-1",
            "subscription_status": "active",
            "stripe_customer_id": "cus_1",
            "stripe_subscription_id": "sub_1",
            "auto_topup_enabled": True,
        },
        account_policy={
            "current_period_start": "2026-05-01T00:00:00+00:00",
            "current_period_end": "2026-06-01T00:00:00+00:00",
            "auto_topup_enabled": True,
            "payment_required": False,
        },
        account_id="acc-1",
        tier="starter",
    )

    assert eligibility["effective_consent"] is False
    assert eligibility["eligible"] is False
    assert eligibility["cap_limit"] == 3
    assert eligibility["cap_used"] == 3
    assert eligibility["cap_remaining"] == 0

