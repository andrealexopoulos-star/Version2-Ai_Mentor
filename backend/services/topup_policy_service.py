"""Policy checks for top-up eligibility, caps, and cycle state."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from config.entitlement_constants import (
    ACTIVE_SUBSCRIPTION_STATUSES,
    HARD_STOP_THRESHOLD,
    TIER_TOPUP_CAPS,
    URGENT_WARNING_THRESHOLD,
    WARNING_THRESHOLD,
)
from core.plans import allocation_for, normalize_tier
from services.topup_consent_service import get_effective_consent


def _parse_ts(raw: Any) -> Optional[datetime]:
    if not raw:
        return None
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def resolve_cycle_window(policy: Dict[str, Any], user_state: Dict[str, Any]) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    cycle_start = _parse_ts((policy or {}).get("current_period_start"))
    cycle_end = _parse_ts((policy or {}).get("current_period_end") or (user_state or {}).get("current_period_end"))
    if cycle_end is None:
        # Fallback to month window when lifecycle data is absent.
        cycle_start = cycle_start or datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        if now.month == 12:
            cycle_end = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            cycle_end = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
    if cycle_start is None:
        cycle_start = cycle_end.replace(year=cycle_end.year - 1) if cycle_end.month == 1 else cycle_end.replace(month=cycle_end.month - 1)
    return cycle_start, cycle_end


def resolve_topup_cap_for_tier(*, tier: str, monthly_topup_cap_override: Optional[int]) -> Optional[int]:
    if monthly_topup_cap_override is not None:
        return max(0, int(monthly_topup_cap_override))
    return TIER_TOPUP_CAPS.get(normalize_tier(tier))


def count_cycle_topups(sb, *, account_id: str, cycle_start: datetime, cycle_end: datetime) -> int:
    try:
        res = (
            sb.table("topup_attempts")
            .select("id")
            .eq("account_id", account_id)
            .eq("status", "succeeded")
            .gte("created_at", cycle_start.isoformat())
            .lt("created_at", cycle_end.isoformat())
            .execute()
        )
    except Exception:
        return 0
    return len(res.data or [])


def latest_topup_attempt(sb, *, account_id: str) -> Optional[Dict[str, Any]]:
    try:
        res = (
            sb.table("topup_attempts")
            .select(
                "id,status,trigger_type,threshold_trigger,tokens_grant,price_aud_cents,currency,"
                "stripe_payment_intent_id,stripe_invoice_id,failure_reason,created_at,updated_at"
            )
            .eq("account_id", account_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception:
        return None
    rows = (res.data or []) if res is not None else []
    return (rows[0] or None) if rows else None


def compute_capacity_state(
    *,
    tier: str,
    consumed: int,
    topped_up: int,
) -> Dict[str, Any]:
    allowance = allocation_for(tier)
    if allowance < 0:
        return {
            "allowance": allowance,
            "effective_allowance": -1,
            "percent_consumed": 0.0,
            "warning": False,
            "urgent_warning": False,
            "hard_stop": False,
        }
    effective_allowance = max(0, int(allowance) + int(topped_up))
    percent = 1.0 if effective_allowance <= 0 else min(1.0, int(consumed) / effective_allowance)
    return {
        "allowance": int(allowance),
        "effective_allowance": int(effective_allowance),
        "percent_consumed": round(percent, 4),
        "warning": percent >= WARNING_THRESHOLD,
        "urgent_warning": percent >= URGENT_WARNING_THRESHOLD,
        "hard_stop": percent >= HARD_STOP_THRESHOLD,
    }


def build_eligibility(
    sb,
    *,
    user_state: Dict[str, Any],
    account_policy: Dict[str, Any],
    account_id: str,
    tier: str,
) -> Dict[str, Any]:
    consent_state = get_effective_consent(sb, account_id=account_id)
    cycle_start, cycle_end = resolve_cycle_window(account_policy, user_state)
    cap_limit = resolve_topup_cap_for_tier(
        tier=tier,
        monthly_topup_cap_override=account_policy.get("monthly_topup_cap_override"),
    )
    cap_used = count_cycle_topups(sb, account_id=account_id, cycle_start=cycle_start, cycle_end=cycle_end)
    cap_remaining = None if cap_limit is None else max(0, cap_limit - cap_used)

    subscription_status = str(user_state.get("subscription_status") or "").strip().lower()
    has_customer = bool(user_state.get("stripe_customer_id"))
    has_subscription = bool(user_state.get("stripe_subscription_id"))
    payment_required = bool(account_policy.get("payment_required", user_state.get("payment_required", False)))
    auto_enabled = bool(account_policy.get("auto_topup_enabled", user_state.get("auto_topup_enabled", True)))
    eligible = (
        consent_state["effective"]
        and auto_enabled
        and has_customer
        and has_subscription
        and subscription_status in ACTIVE_SUBSCRIPTION_STATUSES
        and not payment_required
        and (cap_remaining is None or cap_remaining > 0)
    )
    return {
        "eligible": eligible,
        "effective_consent": bool(consent_state["effective"]),
        "consent_event": consent_state.get("latest_event"),
        "cap_limit": cap_limit,
        "cap_used": cap_used,
        "cap_remaining": cap_remaining,
        "cycle_start": cycle_start,
        "cycle_end": cycle_end,
        "payment_required": payment_required,
        "auto_topup_enabled": auto_enabled,
        "subscription_status": subscription_status,
    }

