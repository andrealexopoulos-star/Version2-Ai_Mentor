"""Top-up orchestration service for manual and request-time auto flows."""

from __future__ import annotations

import hashlib
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import stripe
from fastapi import HTTPException

from config.entitlement_constants import (
    TOPUP_PRICE_AUD_CENTS,
    TOPUP_TOKENS,
    TOPUP_TRIGGER_AUTO_REQUEST_TIME,
    TOPUP_TRIGGER_MANUAL,
)
from services.payment_state_service import apply_failed_or_action_required_outcome
from services.topup_policy_service import build_eligibility


stripe.api_key = os.environ.get("STRIPE_API_KEY", "")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_ts(raw: Any) -> str:
    if isinstance(raw, datetime):
        return raw.astimezone(timezone.utc).isoformat()
    return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()


def build_idempotency_key(
    *,
    account_id: str,
    cycle_start: str,
    cycle_end: str,
    trigger_type: str,
    tokens_grant: int,
    attempt_scope: str,
) -> str:
    material = "|".join(
        [
            str(account_id),
            str(cycle_start),
            str(cycle_end),
            str(trigger_type),
            str(tokens_grant),
            str(attempt_scope),
        ]
    )
    digest = hashlib.sha256(material.encode("utf-8")).hexdigest()
    return f"biqc-topup-{digest}"


def _find_attempt_by_idempotency(sb, *, idempotency_key: str) -> Optional[Dict[str, Any]]:
    res = (
        sb.table("topup_attempts")
        .select("*")
        .eq("idempotency_key", idempotency_key)
        .limit(1)
        .execute()
    )
    rows = (res.data or []) if res is not None else []
    return (rows[0] or None) if rows else None


def get_attempt_by_payment_intent(sb, *, payment_intent_id: str) -> Optional[Dict[str, Any]]:
    res = (
        sb.table("topup_attempts")
        .select("*")
        .eq("stripe_payment_intent_id", payment_intent_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = (res.data or []) if res is not None else []
    return (rows[0] or None) if rows else None


def mark_attempt_status(
    sb,
    *,
    attempt_id: str,
    status: str,
    failure_reason: Optional[str] = None,
    stripe_invoice_id: Optional[str] = None,
) -> None:
    payload: Dict[str, Any] = {"status": status, "updated_at": _now_iso()}
    if failure_reason is not None:
        payload["failure_reason"] = failure_reason
    if stripe_invoice_id:
        payload["stripe_invoice_id"] = stripe_invoice_id
    if status == "succeeded":
        payload["succeeded_at"] = _now_iso()
    if status in {"failed", "requires_action"}:
        payload["failed_at"] = _now_iso()
    sb.table("topup_attempts").update(payload).eq("id", attempt_id).execute()


def _find_pending_attempt(
    sb,
    *,
    account_id: str,
    cycle_start: str,
    cycle_end: str,
    trigger_type: str,
    tokens_grant: int,
    price_aud_cents: int,
) -> Optional[Dict[str, Any]]:
    res = (
        sb.table("topup_attempts")
        .select("*")
        .eq("account_id", account_id)
        .eq("status", "pending")
        .eq("trigger_type", trigger_type)
        .eq("tokens_grant", tokens_grant)
        .eq("price_aud_cents", price_aud_cents)
        .gte("cycle_start", cycle_start)
        .lte("cycle_end", cycle_end)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = (res.data or []) if res is not None else []
    return (rows[0] or None) if rows else None


def _create_payment_intent(
    *,
    account_id: str,
    user_id: str,
    stripe_customer_id: str,
    amount_cents: int,
    idempotency_key: str,
    trigger_type: str,
    tokens_grant: int,
    cycle_start: str,
    cycle_end: str,
    attempt_id: str,
    threshold_trigger: Optional[float],
    off_session: bool,
) -> Any:
    if not stripe.api_key:
        raise HTTPException(status_code=503, detail="Billing payment service is not configured")
    metadata = {
        "account_id": account_id,
        "user_id": user_id,
        "trigger_type": trigger_type,
        "tokens_grant": str(tokens_grant),
        "cycle_start": cycle_start,
        "cycle_end": cycle_end,
        "topup_attempt_id": attempt_id,
        "topup_idempotency_key": idempotency_key,
        "billing_scope": "account",
    }
    if threshold_trigger is not None:
        metadata["threshold_trigger"] = str(threshold_trigger)

    kwargs: Dict[str, Any] = {
        "amount": int(amount_cents),
        "currency": "aud",
        "customer": stripe_customer_id,
        "metadata": metadata,
    }
    if off_session:
        kwargs["confirm"] = True
        kwargs["off_session"] = True
        kwargs["automatic_payment_methods"] = {"enabled": True, "allow_redirects": "never"}
    else:
        kwargs["automatic_payment_methods"] = {"enabled": True}
    return stripe.PaymentIntent.create(idempotency_key=idempotency_key, **kwargs)


def _insert_attempt(
    sb,
    *,
    account_id: str,
    user_id: str,
    tier: str,
    status: str,
    trigger_type: str,
    threshold_trigger: Optional[float],
    cycle_start: str,
    cycle_end: str,
    tokens_grant: int,
    price_aud_cents: int,
    stripe_customer_id: Optional[str],
    stripe_subscription_id: Optional[str],
    idempotency_key: str,
    failure_reason: Optional[str] = None,
) -> Dict[str, Any]:
    payload = {
        "account_id": account_id,
        "user_id": user_id,
        "tier": tier,
        "status": status,
        "trigger_type": trigger_type,
        "threshold_trigger": threshold_trigger,
        "cycle_start": cycle_start,
        "cycle_end": cycle_end,
        "tokens_grant": int(tokens_grant),
        "price_aud_cents": int(price_aud_cents),
        "currency": "aud",
        "stripe_customer_id": stripe_customer_id,
        "stripe_subscription_id": stripe_subscription_id,
        "idempotency_key": idempotency_key,
        "failure_reason": failure_reason,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    created = sb.table("topup_attempts").insert(payload).execute()
    return ((created.data or [{}])[0] if created is not None else {}) or payload


def initiate_topup(
    sb,
    *,
    account_id: str,
    user_id: str,
    tier: str,
    cycle_start: datetime,
    cycle_end: datetime,
    trigger_type: str,
    attempt_scope: str,
    stripe_customer_id: str,
    stripe_subscription_id: str,
    threshold_trigger: Optional[float] = None,
    off_session: bool = False,
    tokens_grant: int = TOPUP_TOKENS,
    price_aud_cents: int = TOPUP_PRICE_AUD_CENTS,
) -> Dict[str, Any]:
    cycle_start_iso = cycle_start.astimezone(timezone.utc).isoformat()
    cycle_end_iso = cycle_end.astimezone(timezone.utc).isoformat()
    idem = build_idempotency_key(
        account_id=account_id,
        cycle_start=cycle_start_iso,
        cycle_end=cycle_end_iso,
        trigger_type=trigger_type,
        tokens_grant=tokens_grant,
        attempt_scope=attempt_scope,
    )

    existing = _find_attempt_by_idempotency(sb, idempotency_key=idem)
    if existing and str(existing.get("status")).lower() == "pending":
        return {
            "attempt": existing,
            "reused_pending": True,
            "payment_intent_client_secret": existing.get("payment_intent_client_secret"),
        }

    pending = _find_pending_attempt(
        sb,
        account_id=account_id,
        cycle_start=cycle_start_iso,
        cycle_end=cycle_end_iso,
        trigger_type=trigger_type,
        tokens_grant=tokens_grant,
        price_aud_cents=price_aud_cents,
    )
    if pending:
        return {
            "attempt": pending,
            "reused_pending": True,
            "payment_intent_client_secret": pending.get("payment_intent_client_secret"),
        }

    attempt = _insert_attempt(
        sb,
        account_id=account_id,
        user_id=user_id,
        tier=tier,
        status="pending",
        trigger_type=trigger_type,
        threshold_trigger=threshold_trigger,
        cycle_start=cycle_start_iso,
        cycle_end=cycle_end_iso,
        tokens_grant=tokens_grant,
        price_aud_cents=price_aud_cents,
        stripe_customer_id=stripe_customer_id,
        stripe_subscription_id=stripe_subscription_id,
        idempotency_key=idem,
    )

    try:
        pi = _create_payment_intent(
            account_id=account_id,
            user_id=user_id,
            stripe_customer_id=stripe_customer_id,
            amount_cents=price_aud_cents,
            idempotency_key=idem,
            trigger_type=trigger_type,
            tokens_grant=tokens_grant,
            cycle_start=cycle_start_iso,
            cycle_end=cycle_end_iso,
            attempt_id=str(attempt.get("id")),
            threshold_trigger=threshold_trigger,
            off_session=off_session,
        )
        next_status = "pending"
        if str(getattr(pi, "status", "")).lower() == "requires_action":
            next_status = "requires_action"
        sb.table("topup_attempts").update(
            {
                "stripe_payment_intent_id": getattr(pi, "id", None),
                "status": next_status,
                "updated_at": _now_iso(),
            }
        ).eq("id", attempt["id"]).execute()
        attempt["stripe_payment_intent_id"] = getattr(pi, "id", None)
        attempt["status"] = next_status
        return {
            "attempt": attempt,
            "reused_pending": False,
            "payment_intent_client_secret": getattr(pi, "client_secret", None),
            "payment_intent_status": getattr(pi, "status", None),
        }
    except stripe.error.CardError as exc:
        failure_reason = getattr(exc, "code", None) or "card_error"
        status = "requires_action" if failure_reason in {"authentication_required"} else "failed"
        sb.table("topup_attempts").update(
            {
                "status": status,
                "failure_reason": failure_reason,
                "failed_at": _now_iso(),
                "updated_at": _now_iso(),
            }
        ).eq("id", attempt["id"]).execute()
        attempt["status"] = status
        attempt["failure_reason"] = failure_reason
        return {
            "attempt": attempt,
            "reused_pending": False,
            "payment_intent_client_secret": None,
            "payment_intent_status": status,
        }
    except stripe.error.StripeError as exc:
        sb.table("topup_attempts").update(
            {
                "status": "failed",
                "failure_reason": "stripe_error",
                "failed_at": _now_iso(),
                "updated_at": _now_iso(),
            }
        ).eq("id", attempt["id"]).execute()
        raise HTTPException(status_code=502, detail="Top-up payment could not be initiated") from exc


def maybe_trigger_request_time_auto_topup(
    sb,
    *,
    user_state: Dict[str, Any],
    account_policy: Dict[str, Any],
    consumed: int,
    topped_up: int,
    threshold_trigger: Optional[float],
) -> Dict[str, Any]:
    """Request-time auto top-up foundation used by metering and billing overview paths."""
    account_id = user_state.get("account_id")
    if not account_id:
        return {"triggered": False, "reason": "missing_account"}

    tier = str((account_policy.get("effective_tier") if account_policy else None) or user_state.get("subscription_tier") or "free")
    eligibility = build_eligibility(
        sb,
        user_state=user_state,
        account_policy=account_policy or {},
        account_id=account_id,
        tier=tier,
    )
    if not eligibility.get("eligible"):
        return {"triggered": False, "reason": "ineligible", "eligibility": eligibility}

    cycle_start = eligibility["cycle_start"]
    cycle_end = eligibility["cycle_end"]
    out = initiate_topup(
        sb,
        account_id=account_id,
        user_id=user_state["id"],
        tier=tier,
        cycle_start=cycle_start,
        cycle_end=cycle_end,
        trigger_type=TOPUP_TRIGGER_AUTO_REQUEST_TIME,
        attempt_scope=f"threshold:{threshold_trigger if threshold_trigger is not None else 'hard_stop'}",
        stripe_customer_id=str(user_state.get("stripe_customer_id") or ""),
        stripe_subscription_id=str(user_state.get("stripe_subscription_id") or ""),
        threshold_trigger=threshold_trigger,
        off_session=True,
    )

    status = str((out.get("attempt") or {}).get("status") or "").lower()
    if status in {"failed", "requires_action"}:
        apply_failed_or_action_required_outcome(
            sb,
            account_id=account_id,
            tier=tier,
            cycle_start=cycle_start.isoformat(),
            cycle_end=cycle_end.isoformat(),
            failure_reason=(out.get("attempt") or {}).get("failure_reason"),
        )
    return {"triggered": True, "attempt": out.get("attempt"), "result": out}


def manual_topup(
    sb,
    *,
    user_state: Dict[str, Any],
    account_policy: Dict[str, Any],
) -> Dict[str, Any]:
    account_id = user_state.get("account_id")
    if not account_id:
        raise HTTPException(status_code=409, detail="Account billing scope is not configured")
    if not user_state.get("stripe_customer_id") or not user_state.get("stripe_subscription_id"):
        raise HTTPException(status_code=402, detail="Billing linkage is incomplete")

    tier = str((account_policy.get("effective_tier") if account_policy else None) or user_state.get("subscription_tier") or "free")
    eligibility = build_eligibility(
        sb,
        user_state=user_state,
        account_policy=account_policy or {},
        account_id=account_id,
        tier=tier,
    )
    if eligibility.get("cap_remaining") is not None and int(eligibility["cap_remaining"]) <= 0:
        raise HTTPException(status_code=409, detail="Monthly top-up cap reached")

    return initiate_topup(
        sb,
        account_id=account_id,
        user_id=user_state["id"],
        tier=tier,
        cycle_start=eligibility["cycle_start"],
        cycle_end=eligibility["cycle_end"],
        trigger_type=TOPUP_TRIGGER_MANUAL,
        attempt_scope="manual",
        stripe_customer_id=str(user_state.get("stripe_customer_id")),
        stripe_subscription_id=str(user_state.get("stripe_subscription_id")),
        off_session=False,
    )

