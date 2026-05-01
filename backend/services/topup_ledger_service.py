"""Usage-ledger writer for successful top-up grants."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def grant_topup_tokens_once(
    sb,
    *,
    attempt: Dict[str, Any],
) -> Dict[str, Any]:
    """Write one `usage_ledger(kind='topup')` grant, idempotent by PI id."""
    pi_id = attempt.get("stripe_payment_intent_id")
    if not pi_id:
        raise ValueError("Top-up grant requires stripe_payment_intent_id")

    existing = (
        sb.table("usage_ledger")
        .select("id,created_at")
        .eq("kind", "topup")
        .eq("stripe_payment_intent_id", pi_id)
        .limit(1)
        .execute()
    )
    rows = (existing.data or []) if existing is not None else []
    if rows:
        return {"granted": False, "duplicate": True, "row": rows[0]}

    payload = {
        "user_id": attempt["user_id"],
        "account_id": attempt["account_id"],
        "kind": "topup",
        "tokens": int(attempt["tokens_grant"]),
        "price_aud_cents": int(attempt["price_aud_cents"]),
        "stripe_payment_intent_id": pi_id,
        "stripe_invoice_id": attempt.get("stripe_invoice_id"),
        "metadata": {
            "source": "topup_attempt",
            "topup_attempt_id": attempt.get("id"),
            "trigger_type": attempt.get("trigger_type"),
            "idempotency_key": attempt.get("idempotency_key"),
        },
        "created_at": _now_iso(),
    }
    created = sb.table("usage_ledger").insert(payload).execute()
    row = ((created.data or [{}])[0] if created is not None else {}) or payload
    return {"granted": True, "duplicate": False, "row": row}

