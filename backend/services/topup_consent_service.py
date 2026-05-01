"""Append-only top-up consent events with latest-event-wins resolution."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from config.entitlement_constants import (
    TOPUP_CONSENT_ACTIONS,
    TOPUP_CONSENT_GRANTED,
    TOPUP_CONSENT_REVOKED,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_effective_consent(sb, *, account_id: str) -> Dict[str, Any]:
    """Return latest consent event and effective bool state."""
    try:
        res = (
            sb.table("topup_consent_events")
            .select(
                "id,account_id,user_id,consent_action,consent_version,source,"
                "auto_topup_enabled_after,monthly_topup_cap_after,created_at"
            )
            .eq("account_id", account_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = (res.data or []) if res is not None else []
    except Exception:
        rows = []
    latest = (rows[0] or {}) if rows else {}
    action = str(latest.get("consent_action") or "").strip().lower()
    effective = action == TOPUP_CONSENT_GRANTED
    return {
        "effective": bool(effective),
        "latest_event": latest if latest else None,
    }


def record_consent_event(
    sb,
    *,
    account_id: str,
    user_id: str,
    consent_action: str,
    consent_version: str,
    source: str,
    auto_topup_enabled_after: Optional[bool] = None,
    monthly_topup_cap_after: Optional[int] = None,
) -> Dict[str, Any]:
    action = str(consent_action or "").strip().lower()
    if action not in TOPUP_CONSENT_ACTIONS:
        raise ValueError("Invalid consent action")
    enabled_after = (
        bool(auto_topup_enabled_after)
        if auto_topup_enabled_after is not None
        else action == TOPUP_CONSENT_GRANTED
    )
    payload = {
        "account_id": account_id,
        "user_id": user_id,
        "consent_action": action,
        "consent_version": str(consent_version or "").strip() or "v1",
        "source": str(source or "").strip() or "billing_ui",
        "auto_topup_enabled_after": enabled_after,
        "monthly_topup_cap_after": monthly_topup_cap_after,
        "created_at": _now_iso(),
    }
    result = sb.table("topup_consent_events").insert(payload).execute()
    row = ((result.data or [{}])[0] if result is not None else {}) or payload

    # Keep policy in sync for legacy consumers while consent events remain source-of-truth.
    policy_patch: Dict[str, Any] = {
        "account_id": account_id,
        "auto_topup_enabled": bool(enabled_after),
        "updated_at": _now_iso(),
    }
    if action == TOPUP_CONSENT_REVOKED:
        policy_patch["payment_required"] = False
    if monthly_topup_cap_after is not None:
        policy_patch["monthly_topup_cap_override"] = monthly_topup_cap_after
    sb.table("account_billing_policy").upsert(policy_patch, on_conflict="account_id").execute()

    return row

