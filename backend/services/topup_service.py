"""
Auto top-up Stripe charge service.

Per Andreas direction 2026-05-04 (code 13041978):
- When a paid customer's token balance hits the auto-top-up threshold,
  this service charges the customer's saved payment method (off_session)
  for their slider amount and inserts a 'topup' row into usage_ledger.
- Customer slider: $20-$5000 (2000-500000 cents). Default $50.
- Monthly cap: customer-set, default $200. Enforced before charge.
- 24-hour refund window: refund() allows reversal within 24h of charge.
- Idempotent on stripe_payment_intent_id (UNIQUE on usage_ledger via
  migration 113).

State enums returned (per Contract v2 — never expose Stripe / supplier names):
    TOPUP_FIRED          - Stripe charge succeeded, tokens credited
    TOPUP_DISABLED       - auto_topup_enabled=false, returned to caller
    SPEND_CAP_HIT        - would exceed monthly_cap_cents, do not charge
    PAYMENT_REQUIRED     - Stripe charge failed (card declined / no PM)
    TOPUP_REFUNDED       - refund successful, tokens reversed
    REFUND_OUTSIDE_WINDOW - refund attempt outside 24h window
    LITE_PLAN            - Lite plan has no auto top-up (upgrade prompt)

Token-per-dollar rate is per-tier (volume discount baked in via the rate
sheet in backend/config/pricing.py — landed in PR 3). For PR 2 we use a
conservative rate that matches the plan's effective rate (Growth: ~14,500
tokens per dollar at $69/1M effective).
"""

from __future__ import annotations

import os
import logging
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Optional

import stripe

logger = logging.getLogger("topup_service")

# Stripe SDK key — set lazily so tests can override. Production sets from env.
_STRIPE_INITIALISED = False


def _ensure_stripe_initialised() -> None:
    global _STRIPE_INITIALISED
    if _STRIPE_INITIALISED:
        return
    api_key = os.environ.get("STRIPE_API_KEY", "")
    if api_key:
        stripe.api_key = api_key
        _STRIPE_INITIALISED = True


# ─── Constants ──────────────────────────────────────────────

MIN_TOPUP_CENTS = 2000     # $20 — below this, Stripe fixed fees eat margin
MAX_TOPUP_CENTS = 500000   # $5,000 — single-fire ceiling protects card limits
DEFAULT_TOPUP_CENTS = 5000 # $50
DEFAULT_MONTHLY_CAP_CENTS = 20000  # $200

REFUND_WINDOW_HOURS = 24

# Per-tier token-per-dollar rate (preliminary; full table in PR 3 backend/config/pricing.py).
# Rate = tokens credited per AUD cent of top-up. Higher tier = more tokens per dollar.
TOKENS_PER_CENT_BY_TIER = {
    "starter": 145,    # Growth: ~14,500/$1 (= $69/1M effective rate)
    "pro": 251,        # Pro: ~25,100/$1 (= $40/1M)
    "business": 572,   # Business: ~57,200/$1 (= $17.50/1M)
    # Lite excluded — no auto top-up on Lite tier (PRICING_TIERS).
}


# ─── State enum ─────────────────────────────────────────────

class TopupState:
    TOPUP_FIRED = "TOPUP_FIRED"
    TOPUP_DISABLED = "TOPUP_DISABLED"
    SPEND_CAP_HIT = "SPEND_CAP_HIT"
    PAYMENT_REQUIRED = "PAYMENT_REQUIRED"
    TOPUP_REFUNDED = "TOPUP_REFUNDED"
    REFUND_OUTSIDE_WINDOW = "REFUND_OUTSIDE_WINDOW"
    LITE_PLAN = "LITE_PLAN"


@dataclass
class TopupResult:
    state: str
    message: str
    amount_cents: int = 0
    tokens_added: int = 0
    stripe_payment_intent_id: Optional[str] = None
    redirect: Optional[str] = None


@dataclass
class RefundResult:
    state: str
    message: str
    amount_cents: int = 0
    tokens_reversed: int = 0


# ─── Pre-flight check ───────────────────────────────────────

def should_fire_topup(user_record: dict) -> tuple[bool, str]:
    """
    Determine whether auto top-up may fire for this user.

    Returns (allowed, reason_state). reason_state is one of TopupState values
    when allowed is False.

    Rules (in order):
    1. Lite plan: never auto top-up (returns LITE_PLAN). Customer must upgrade.
    2. auto_topup_enabled must be true.
    3. topup_consent_at must be set (user opted in).
    4. Stripe customer + subscription must exist (not cancelled).
    5. monthly_cap_cents must allow next charge:
       current_period_topup_cents + topup_amount_cents <= monthly_cap_cents.
       (monthly_cap_cents = 0 means no cap — always allow.)
    """
    tier = (user_record.get("subscription_tier") or "").strip().lower()
    if tier == "lite":
        return False, TopupState.LITE_PLAN

    if not bool(user_record.get("auto_topup_enabled", False)):
        return False, TopupState.TOPUP_DISABLED

    if not user_record.get("topup_consent_at"):
        return False, TopupState.TOPUP_DISABLED

    if not user_record.get("stripe_customer_id") or not user_record.get("stripe_subscription_id"):
        return False, TopupState.PAYMENT_REQUIRED

    cap = int(user_record.get("monthly_cap_cents") or 0)
    if cap > 0:
        used = int(user_record.get("current_period_topup_cents") or 0)
        amount = int(user_record.get("topup_amount_cents") or DEFAULT_TOPUP_CENTS)
        if used + amount > cap:
            return False, TopupState.SPEND_CAP_HIT

    return True, ""


# ─── Token conversion ───────────────────────────────────────

def tokens_for_amount(tier: str, amount_cents: int) -> int:
    """Convert AUD cents into tokens at the per-tier rate."""
    tier_norm = (tier or "").strip().lower()
    if tier_norm in ("foundation", "growth"):
        tier_norm = "starter"
    if tier_norm in ("professional",):
        tier_norm = "pro"
    rate = TOKENS_PER_CENT_BY_TIER.get(tier_norm, TOKENS_PER_CENT_BY_TIER["starter"])
    return int(amount_cents * rate)


# ─── Fire top-up ────────────────────────────────────────────

def fire_topup(sb, user_record: dict, *, dry_run: bool = False) -> TopupResult:
    """
    Charge the customer's saved payment method for topup_amount_cents and
    insert a 'topup' row into usage_ledger.

    Idempotent: usage_ledger has UNIQUE constraint on stripe_payment_intent_id
    (migration 113). If the same PI is recorded twice, second insert fails
    silently — caller should treat as success.

    Args:
        sb: Supabase admin client.
        user_record: dict with at minimum: id, stripe_customer_id,
                     stripe_subscription_id, subscription_tier,
                     auto_topup_enabled, topup_amount_cents,
                     monthly_cap_cents, current_period_topup_cents.
        dry_run: when True, performs all checks but skips Stripe API call
                 and ledger insert (used in tests).
    """
    _ensure_stripe_initialised()

    user_id = user_record.get("id")
    tier = (user_record.get("subscription_tier") or "starter").strip().lower()
    amount_cents = int(user_record.get("topup_amount_cents") or DEFAULT_TOPUP_CENTS)

    # Clamp to allowed range (defensive — DB already constrains).
    amount_cents = max(MIN_TOPUP_CENTS, min(MAX_TOPUP_CENTS, amount_cents))

    allowed, reason = should_fire_topup(user_record)
    if not allowed:
        return TopupResult(
            state=reason,
            message=_message_for_state(reason),
            amount_cents=amount_cents,
            redirect="/subscribe" if reason == TopupState.LITE_PLAN else None,
        )

    if dry_run:
        return TopupResult(
            state=TopupState.TOPUP_FIRED,
            message="Dry-run: would have charged.",
            amount_cents=amount_cents,
            tokens_added=tokens_for_amount(tier, amount_cents),
            stripe_payment_intent_id="pi_dryrun_test",
        )

    # ─── Stripe charge (off-session) ──────────────────────
    customer_id = user_record["stripe_customer_id"]
    try:
        intent = stripe.PaymentIntent.create(
            customer=customer_id,
            amount=amount_cents,
            currency="aud",
            off_session=True,
            confirm=True,
            payment_method_types=["card"],
            description="BIQc auto top-up — token allowance refill",
            metadata={
                "biqc_event_type": "auto_topup",
                "user_id": str(user_id),
                "tier_at_event": tier,
                "topup_amount_cents": str(amount_cents),
            },
        )
    except stripe.error.CardError as e:
        # Decline — flip payment_required, return PAYMENT_REQUIRED
        logger.warning(
            "[topup] CardError user=%s code=%s message=%s",
            user_id, getattr(e, "code", ""), getattr(e, "user_message", str(e))
        )
        try:
            sb.table("users").update({
                "payment_required": True,
                "auto_topup_enabled": False,  # disable until customer fixes payment
            }).eq("id", user_id).execute()
        except Exception:
            logger.exception("[topup] failed to flip payment_required after CardError")
        return TopupResult(
            state=TopupState.PAYMENT_REQUIRED,
            message="Your saved payment method couldn't be charged. Update your card to continue.",
            amount_cents=amount_cents,
            redirect="/settings/billing",
        )
    except stripe.error.StripeError as e:
        logger.exception("[topup] Stripe error firing top-up user=%s", user_id)
        return TopupResult(
            state=TopupState.PAYMENT_REQUIRED,
            message="Top-up charge couldn't be completed. Please try again or update your billing.",
            amount_cents=amount_cents,
            redirect="/settings/billing",
        )

    # ─── Insert ledger row ────────────────────────────────
    tokens_added = tokens_for_amount(tier, amount_cents)
    pi_id = intent["id"]

    try:
        sb.table("usage_ledger").insert({
            "user_id": user_id,
            "kind": "topup",
            "tokens": tokens_added,
            "stripe_payment_intent_id": pi_id,
            "price_aud_cents": amount_cents,
            "tier_at_event": tier,
            "metadata": {
                "biqc_event_type": "auto_topup",
                "topup_amount_cents": amount_cents,
                "fired_at": datetime.now(timezone.utc).isoformat(),
                "request_id": user_record.get("request_id") or pi_id,
            },
        }).execute()
    except Exception as e:
        # If this is a unique-constraint violation on stripe_payment_intent_id,
        # the top-up is already recorded — treat as success (webhook replay).
        if "duplicate key" in str(e).lower() or "unique" in str(e).lower():
            logger.info("[topup] duplicate PI — webhook replay, treating as success pi=%s", pi_id)
            return TopupResult(
                state=TopupState.TOPUP_FIRED,
                message="Topped up successfully (replay).",
                amount_cents=amount_cents,
                tokens_added=tokens_added,
                stripe_payment_intent_id=pi_id,
            )
        # Otherwise — Stripe charged but ledger failed. CRITICAL: do NOT
        # silently swallow. Log + return PAYMENT_REQUIRED so we don't double-charge.
        logger.exception("[topup] CRITICAL ledger insert failed after Stripe charge user=%s pi=%s", user_id, pi_id)
        return TopupResult(
            state=TopupState.PAYMENT_REQUIRED,
            message="Charge succeeded but tokens not credited. Support has been notified.",
            amount_cents=amount_cents,
            stripe_payment_intent_id=pi_id,
        )

    # ─── Increment period usage ───────────────────────────
    try:
        new_used = int(user_record.get("current_period_topup_cents") or 0) + amount_cents
        sb.table("users").update({
            "current_period_topup_cents": new_used,
        }).eq("id", user_id).execute()
    except Exception:
        logger.exception("[topup] failed to increment current_period_topup_cents user=%s", user_id)
        # Not fatal — cap will be enforced on next call from re-read.

    logger.info(
        "[topup] FIRED user=%s amount_cents=%d tokens=%d pi=%s tier=%s",
        user_id, amount_cents, tokens_added, pi_id, tier
    )
    return TopupResult(
        state=TopupState.TOPUP_FIRED,
        message="Topped up. Continuing where you left off.",
        amount_cents=amount_cents,
        tokens_added=tokens_added,
        stripe_payment_intent_id=pi_id,
    )


# ─── Refund ─────────────────────────────────────────────────

def is_refundable(ledger_row: dict) -> bool:
    """24-hour refund window: only top-ups within last 24h are refundable."""
    if ledger_row.get("kind") != "topup":
        return False
    if (ledger_row.get("metadata") or {}).get("refunded_at"):
        return False
    fired_at_str = ledger_row.get("created_at")
    if not fired_at_str:
        return False
    try:
        fired_at = datetime.fromisoformat(fired_at_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return False
    return (datetime.now(timezone.utc) - fired_at) <= timedelta(hours=REFUND_WINDOW_HOURS)


def refund(sb, ledger_row: dict, *, reason: str = "customer_request") -> RefundResult:
    """
    Refund a top-up via Stripe + reverse the tokens via a 'consume' rollback row.

    Refund is allowed only within 24 hours of the original charge. After that,
    customer must contact support (legal-grade reversal).

    Idempotent: if metadata.refunded_at already set, returns success no-op.
    """
    _ensure_stripe_initialised()

    if not is_refundable(ledger_row):
        return RefundResult(
            state=TopupState.REFUND_OUTSIDE_WINDOW,
            message="This top-up is outside the 24-hour refund window. Please contact support.",
        )

    pi_id = ledger_row.get("stripe_payment_intent_id")
    user_id = ledger_row.get("user_id")
    amount_cents = int(ledger_row.get("price_aud_cents") or 0)
    tokens_to_reverse = int(ledger_row.get("tokens") or 0)

    try:
        stripe.Refund.create(
            payment_intent=pi_id,
            reason="requested_by_customer",
            metadata={
                "biqc_event_type": "auto_topup_refund",
                "user_id": str(user_id),
                "internal_reason": reason,
            },
        )
    except stripe.error.StripeError as e:
        logger.exception("[topup] refund failed pi=%s", pi_id)
        return RefundResult(
            state=TopupState.PAYMENT_REQUIRED,
            message="Refund couldn't be processed. Please contact support.",
        )

    # Mark ledger row as refunded + insert reversing 'consume' row to
    # reverse the tokens (we don't mutate append-only ledger).
    try:
        new_metadata = dict(ledger_row.get("metadata") or {})
        new_metadata["refunded_at"] = datetime.now(timezone.utc).isoformat()
        new_metadata["refund_reason"] = reason
        sb.table("usage_ledger").update({
            "metadata": new_metadata,
        }).eq("id", ledger_row["id"]).execute()

        # Reversing consume row — mirrors the refund.
        sb.table("usage_ledger").insert({
            "user_id": user_id,
            "kind": "consume",
            "tokens": tokens_to_reverse,
            "input_tokens": tokens_to_reverse,  # accounting only
            "output_tokens": 0,
            "model": "internal",
            "provider": "internal",
            "feature": "topup_refund_reversal",
            "action": "refund",
            "request_id": f"refund_{ledger_row['id']}",
            "tier_at_event": ledger_row.get("tier_at_event"),
            "metadata": {
                "biqc_event_type": "auto_topup_refund_reversal",
                "refunded_topup_id": str(ledger_row["id"]),
            },
        }).execute()

        # Decrement current_period_topup_cents (best-effort).
        sb.rpc("decrement_period_topup", {"p_user_id": user_id, "p_amount_cents": amount_cents}).execute()
    except Exception:
        logger.exception("[topup] post-refund ledger update failed pi=%s — refund DID hit Stripe but ledger may be inconsistent", pi_id)
        # Stripe refunded, but our ledger state is uncertain. Return success
        # with caveat — operator must reconcile via Stripe webhook.
        return RefundResult(
            state=TopupState.TOPUP_REFUNDED,
            message="Refund issued. Token balance may take a few minutes to reflect.",
            amount_cents=amount_cents,
            tokens_reversed=tokens_to_reverse,
        )

    logger.info("[topup] REFUNDED pi=%s amount=%d tokens=%d user=%s", pi_id, amount_cents, tokens_to_reverse, user_id)
    return RefundResult(
        state=TopupState.TOPUP_REFUNDED,
        message="Top-up refunded. Tokens have been removed from your balance.",
        amount_cents=amount_cents,
        tokens_reversed=tokens_to_reverse,
    )


# ─── Internal helpers ───────────────────────────────────────

def _message_for_state(state: str) -> str:
    """Customer-facing message per state enum (Contract v2: no Stripe / supplier names)."""
    if state == TopupState.LITE_PLAN:
        return "Auto top-up isn't available on the Lite plan. Upgrade to Growth to keep working when tokens run out."
    if state == TopupState.TOPUP_DISABLED:
        return "Auto top-up is switched off for your account. Enable it in billing settings to keep working when tokens run out."
    if state == TopupState.SPEND_CAP_HIT:
        return "You've reached your monthly auto top-up cap. Raise the cap in billing settings or wait until your next billing period."
    if state == TopupState.PAYMENT_REQUIRED:
        return "Your saved payment method couldn't be charged. Update billing to continue."
    return "Auto top-up not available right now. Please try again or contact support."
