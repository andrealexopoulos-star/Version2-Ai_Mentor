"""Payment lock state writers for account-scoped billing."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from core.plans import allocation_for, normalize_tier


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def set_payment_required(
    sb,
    *,
    account_id: str,
    required: bool,
    reason: Optional[str] = None,
) -> None:
    """Persist account-level payment lock state."""
    payload: Dict[str, Any] = {
        "account_id": account_id,
        "payment_required": bool(required),
        "updated_at": _iso_now(),
    }
    if required and reason:
        payload["topup_warned_at"] = _iso_now()
    sb.table("account_billing_policy").upsert(payload, on_conflict="account_id").execute()


def _sum_tokens(sb, *, account_id: str, kind: str, cycle_start: str, cycle_end: str) -> int:
    try:
        res = (
            sb.table("usage_ledger")
            .select("tokens")
            .eq("account_id", account_id)
            .eq("kind", kind)
            .gte("created_at", cycle_start)
            .lt("created_at", cycle_end)
            .execute()
        )
    except Exception:
        return 0
    return sum(int(row.get("tokens") or 0) for row in (res.data or []))


def capacity_exhausted_for_cycle(
    sb,
    *,
    account_id: str,
    tier: str,
    cycle_start: str,
    cycle_end: str,
) -> bool:
    """Return True when included + successful top-up capacity is fully consumed."""
    normalized = normalize_tier(tier)
    allowance = allocation_for(normalized)
    if allowance < 0:
        return False
    consumed = _sum_tokens(
        sb, account_id=account_id, kind="consume", cycle_start=cycle_start, cycle_end=cycle_end
    )
    topped_up = _sum_tokens(
        sb, account_id=account_id, kind="topup", cycle_start=cycle_start, cycle_end=cycle_end
    )
    return consumed >= max(0, allowance + topped_up)


def apply_failed_or_action_required_outcome(
    sb,
    *,
    account_id: str,
    tier: str,
    cycle_start: str,
    cycle_end: str,
    failure_reason: Optional[str] = None,
) -> bool:
    """Set payment_required only when failure/action-required blocks new AI usage."""
    exhausted = capacity_exhausted_for_cycle(
        sb,
        account_id=account_id,
        tier=tier,
        cycle_start=cycle_start,
        cycle_end=cycle_end,
    )
    set_payment_required(sb, account_id=account_id, required=exhausted, reason=failure_reason)
    return exhausted


def clear_payment_required_on_success(sb, *, account_id: str) -> None:
    set_payment_required(sb, account_id=account_id, required=False)

