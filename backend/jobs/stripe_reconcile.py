"""Nightly Stripe ↔ DB subscription reconciler (Step 10 / P1-5).

Purpose
-------
Every webhook we rely on (checkout.session.completed, customer.subscription.*,
invoice.payment_*) can fail silently — a 5xx from Supabase, a deploy in the
middle of a signature-verified burst, a replay race, or a webhook fired
before the user row existed. When that happens the DB drifts from Stripe
on subscription_status, subscription_tier, or current_period_end, and the
only detector is an angry support ticket.

This module compares Stripe's source of truth against our mirror and
writes one row per observed drift into `stripe_reconcile_log` (see
migration 097). A `run_summary` row is always written at the end so ops
can see "the 3am run checked N subs, found M drifts" without reading the
Azure logs.

Trigger points (all driven by ops — no automatic scheduler here):
    • POST /api/admin/stripe/reconcile — manual, super-admin only
    • Azure Logic App timer → admin endpoint (recommended: nightly 02:00 UTC)
    • pg_cron + edge function (if later moved on-platform)

Design notes
------------
• Pagination — we use `stripe.Subscription.list(...).auto_paging_iter()`
  so the full subscription set streams through even on accounts with
  thousands of subs. Per-page cap stays at Stripe's default (100) —
  larger pages are allowed but give no speedup and risk rate limit.

• Status filter — we pass `status="all"` so the detector sees canceled
  and past_due subs, not just active. A cancelled Stripe sub whose DB row
  still shows active is exactly the drift we must catch.

• Tier inference — stripe subscription.items.data[0].price.unit_amount is
  the cheapest reliable signal (pricing_plans may drift; checkout metadata
  isn't re-derivable). We match it against PLANS in stripe_payments.
  Subs whose price doesn't match any known tier emit an `unknown_price`
  row for manual review.

• Fail-safe — a stripe outage raises at the top of the run and is caught
  by the caller (admin endpoint returns 502). We NEVER swallow a full
  Stripe outage because a silent "0 drifts detected" run would give ops
  false confidence that the mirror is healthy.

• Per-subscription errors — if a single subscription throws (unexpected
  shape, decode error), we log it as a synthetic drift row with
  drift_type='missing_user' and notes='internal_error: ...' so the run
  continues. One broken row must not stop the whole batch.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

logger = logging.getLogger(__name__)


# ─── Helpers ──────────────────────────────────────────────────────

def _attr(obj: Any, key: str, default: Any = None) -> Any:
    """Duck-type getter that works on both dicts and Stripe objects.

    Stripe SDK objects behave like namespace objects (dot access) but the
    tests feed plain dicts, so we try both. Returns `default` if neither
    works — never raises.
    """
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    try:
        return getattr(obj, key, default)
    except Exception:
        return default


def _tier_from_stripe_sub(sub: Any) -> Optional[str]:
    """Infer the canonical BIQc tier from a Stripe subscription.

    Looks at the primary line-item's price.unit_amount and matches against
    PLANS. Returns None when the amount doesn't match anything known —
    caller writes an `unknown_price` drift row so ops can decide whether
    to extend PLANS or fix the subscription.

    We only match on the canonical plan keys (starter/pro/business/
    enterprise/custom_build), not on aliases (foundation/growth/
    professional) — multiple aliases map to the same amount and only the
    canonical key carries the right `tier` field.
    """
    try:
        from routes.stripe_payments import PLANS
    except Exception:  # pragma: no cover — only fires if import graph breaks
        return None

    items = _attr(sub, "items")
    data = _attr(items, "data") or (items.get("data") if isinstance(items, dict) else None)
    if not data:
        return None
    first = data[0]
    price = _attr(first, "price")
    amount = _attr(price, "unit_amount")
    if amount is None:
        return None

    canonical = {"starter", "pro", "business", "enterprise", "custom_build"}
    for plan_key, plan in PLANS.items():
        if plan_key not in canonical:
            continue
        if int(plan.get("amount", -1)) == int(amount):
            return plan.get("tier")
    return None


def _fetch_user_row(sb, customer_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """Return the users row that matches a Stripe customer id, or None.

    Only queries columns the reconciler needs. Treats any Supabase error
    as "no match" — the caller records a missing_user drift row so the
    outage is surfaced via the drift log, not swallowed.
    """
    if not customer_id:
        return None
    try:
        res = (
            sb.table("users")
            .select("id, subscription_tier, subscription_status, current_period_end, stripe_customer_id")
            .eq("stripe_customer_id", customer_id)
            .limit(1)
            .execute()
        )
        rows = (getattr(res, "data", None) or [])
        return rows[0] if rows else None
    except Exception as exc:
        logger.warning("[StripeReconcile] users lookup failed for %s: %s", customer_id, exc)
        return None


def _isoformat_maybe(value: Any) -> Optional[str]:
    """Convert a variety of timestamp shapes to ISO8601. Used so DB and
    Stripe values can be compared as strings in the log."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        # Stripe uses epoch seconds for current_period_end
        try:
            return datetime.fromtimestamp(int(value), tz=timezone.utc).isoformat()
        except (ValueError, OverflowError, OSError):
            return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _timestamps_match(stripe_epoch: Any, db_value: Any, tolerance_seconds: int = 60) -> bool:
    """True if Stripe's epoch timestamp and the DB's TIMESTAMPTZ string
    refer to the same instant within `tolerance_seconds`.

    Why a tolerance — Stripe renewals and our webhook handlers both do
    their own rounding / source-of-truth reads, and a 1-second clock-skew
    difference isn't drift worth logging. 60s is comfortably larger than
    either side's precision and still tight enough to flag a real period
    boundary change.
    """
    if stripe_epoch is None and db_value in (None, ""):
        return True
    if stripe_epoch is None or db_value in (None, ""):
        return False
    try:
        stripe_dt = datetime.fromtimestamp(int(stripe_epoch), tz=timezone.utc)
    except (TypeError, ValueError, OverflowError, OSError):
        return False
    try:
        # Accept ISO strings with or without timezone.
        if isinstance(db_value, datetime):
            db_dt = db_value
        else:
            raw = str(db_value)
            if raw.endswith("Z"):
                raw = raw[:-1] + "+00:00"
            db_dt = datetime.fromisoformat(raw)
        if db_dt.tzinfo is None:
            db_dt = db_dt.replace(tzinfo=timezone.utc)
    except Exception:
        return False
    return abs((stripe_dt - db_dt).total_seconds()) <= tolerance_seconds


# ─── Drift row insertion ──────────────────────────────────────────

def _insert_drift(
    sb,
    *,
    run_id: str,
    drift_type: str,
    stripe_subscription_id: Optional[str] = None,
    stripe_customer_id: Optional[str] = None,
    user_id: Optional[str] = None,
    stripe_value: Optional[str] = None,
    db_value: Optional[str] = None,
    notes: Optional[str] = None,
) -> None:
    """Best-effort single-row insert into stripe_reconcile_log.

    If the DB is unavailable we log and continue — the caller keeps
    processing other subscriptions rather than aborting the whole run.
    """
    row = {
        "run_id": run_id,
        "drift_type": drift_type,
        "stripe_subscription_id": stripe_subscription_id,
        "stripe_customer_id": stripe_customer_id,
        "user_id": user_id,
        "stripe_value": stripe_value,
        "db_value": db_value,
        "notes": notes,
    }
    try:
        sb.table("stripe_reconcile_log").insert(row).execute()
    except Exception as exc:
        logger.error(
            "[StripeReconcile] failed to insert drift row (type=%s, sub=%s): %s",
            drift_type, stripe_subscription_id, exc,
        )


# ─── Per-subscription reconciler ──────────────────────────────────

def _reconcile_single_subscription(
    sb,
    sub: Any,
    run_id: str,
    seen_customer_ids: set,
) -> Dict[str, int]:
    """Compare one Stripe subscription to the DB mirror and insert a
    drift row per observed delta. Returns a small counts dict for the
    caller to aggregate into the run summary."""
    counts = {
        "status_mismatch": 0,
        "tier_mismatch": 0,
        "period_end_mismatch": 0,
        "missing_user": 0,
        "unknown_price": 0,
    }
    subscription_id = _attr(sub, "id")
    customer_id = _attr(sub, "customer")
    if customer_id:
        seen_customer_ids.add(customer_id)

    stripe_status = _attr(sub, "status")
    stripe_period_end = _attr(sub, "current_period_end")
    stripe_period_end_iso = _isoformat_maybe(stripe_period_end)

    inferred_tier = _tier_from_stripe_sub(sub)
    if inferred_tier is None:
        _insert_drift(
            sb,
            run_id=run_id,
            drift_type="unknown_price",
            stripe_subscription_id=subscription_id,
            stripe_customer_id=customer_id,
            stripe_value=str(_attr(_attr(_attr(sub, "items"), "data", [None])[0] if _attr(sub, "items") else None, "price", {})),
            notes="Subscription price does not match any known PLANS entry",
        )
        counts["unknown_price"] += 1

    user_row = _fetch_user_row(sb, customer_id)
    if not user_row:
        _insert_drift(
            sb,
            run_id=run_id,
            drift_type="missing_user",
            stripe_subscription_id=subscription_id,
            stripe_customer_id=customer_id,
            stripe_value=str(stripe_status or ""),
            notes="Stripe has subscription but no users row matches stripe_customer_id",
        )
        counts["missing_user"] += 1
        return counts

    user_id = user_row.get("id")

    # Status mismatch
    db_status = user_row.get("subscription_status")
    if (stripe_status or None) != (db_status or None):
        _insert_drift(
            sb,
            run_id=run_id,
            drift_type="status_mismatch",
            stripe_subscription_id=subscription_id,
            stripe_customer_id=customer_id,
            user_id=user_id,
            stripe_value=str(stripe_status or ""),
            db_value=str(db_status or ""),
        )
        counts["status_mismatch"] += 1

    # Tier mismatch — only flag when we could infer a tier.
    if inferred_tier is not None:
        db_tier = user_row.get("subscription_tier")
        if inferred_tier != db_tier:
            _insert_drift(
                sb,
                run_id=run_id,
                drift_type="tier_mismatch",
                stripe_subscription_id=subscription_id,
                stripe_customer_id=customer_id,
                user_id=user_id,
                stripe_value=str(inferred_tier),
                db_value=str(db_tier or ""),
            )
            counts["tier_mismatch"] += 1

    # Period end mismatch — only meaningful for non-cancelled subs.
    if stripe_status not in {"canceled", "incomplete_expired"}:
        db_period_end = user_row.get("current_period_end")
        if not _timestamps_match(stripe_period_end, db_period_end):
            _insert_drift(
                sb,
                run_id=run_id,
                drift_type="period_end_mismatch",
                stripe_subscription_id=subscription_id,
                stripe_customer_id=customer_id,
                user_id=user_id,
                stripe_value=stripe_period_end_iso or "",
                db_value=_isoformat_maybe(db_period_end) or "",
            )
            counts["period_end_mismatch"] += 1

    return counts


# ─── Reverse pass: stale DB rows with no Stripe sub ───────────────

def _find_stale_db_rows(sb, seen_customer_ids: set, run_id: str) -> int:
    """Find users with paid-status in the DB whose stripe_customer_id is
    NOT present in the set of Stripe customers we just iterated.

    Those are rows where Stripe has no subscription but the DB thinks the
    user is still active — classic "webhook for cancel never fired" drift.
    """
    count = 0
    try:
        res = (
            sb.table("users")
            .select("id, stripe_customer_id, subscription_status, subscription_tier")
            .in_("subscription_status", ["active", "trialing", "past_due"])
            .not_.is_("stripe_customer_id", "null")
            .execute()
        )
    except Exception as exc:
        logger.warning("[StripeReconcile] stale-DB scan failed: %s", exc)
        return 0

    rows = getattr(res, "data", None) or []
    for row in rows:
        customer_id = row.get("stripe_customer_id")
        if customer_id and customer_id not in seen_customer_ids:
            _insert_drift(
                sb,
                run_id=run_id,
                drift_type="stale_db_status",
                stripe_customer_id=customer_id,
                user_id=row.get("id"),
                db_value=str(row.get("subscription_status") or ""),
                notes=(
                    "User row has paid subscription_status but no matching Stripe "
                    "subscription was found in this run (likely missed cancel webhook)."
                ),
            )
            count += 1
    return count


# ─── Public entrypoint ────────────────────────────────────────────

def _iter_stripe_subscriptions(stripe_module) -> Iterable[Any]:
    """Yield every Stripe subscription with auto-pagination.

    Accepts a stripe module-like object so tests can inject a fake with a
    `.Subscription.list(...)` method that returns an iterable. Real runs
    get the full Stripe SDK.
    """
    listing = stripe_module.Subscription.list(status="all", limit=100)
    iterator = getattr(listing, "auto_paging_iter", None)
    if callable(iterator):
        yield from iterator()
    else:
        # Fallback: listing is already iterable (fake clients in tests).
        for sub in getattr(listing, "data", None) or listing:
            yield sub


def run_stripe_reconcile(sb, stripe_module=None) -> Dict[str, Any]:
    """Execute one reconcile pass and return a summary dict.

    Parameters
    ----------
    sb : Supabase service-role client
    stripe_module : module-like object exposing Subscription.list. When
        None, the real `stripe` package is imported.

    Returns
    -------
    dict with: run_id, started_at, finished_at, checked_subscriptions,
    drift_counts (keyed by drift_type), total_drift, stale_db_count,
    errors (list of per-sub exception strings).

    Raises
    ------
    Re-raises the exception from stripe.Subscription.list(...) so the
    admin endpoint can surface a 502 when Stripe is unreachable. Once
    iteration is under way, per-sub errors are converted to drift rows
    and do NOT abort the run.
    """
    run_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)

    if stripe_module is None:
        import stripe as _stripe  # imported lazily so tests don't need the package
        stripe_module = _stripe

    totals = {
        "status_mismatch": 0,
        "tier_mismatch": 0,
        "period_end_mismatch": 0,
        "missing_user": 0,
        "unknown_price": 0,
    }
    errors: List[str] = []
    seen_customer_ids: set = set()
    checked = 0

    # The Stripe iteration itself may raise (auth failure, network). Let
    # it propagate — a silent "0 drifts found" run would give ops a false
    # green light that the mirror is healthy.
    for sub in _iter_stripe_subscriptions(stripe_module):
        checked += 1
        try:
            per_sub = _reconcile_single_subscription(sb, sub, run_id, seen_customer_ids)
            for key, val in per_sub.items():
                totals[key] += val
        except Exception as exc:
            # Record the failure as metadata; keep scanning the rest.
            sub_id = _attr(sub, "id", "<unknown>")
            err_msg = f"{sub_id}: {type(exc).__name__}: {exc}"
            errors.append(err_msg)
            _insert_drift(
                sb,
                run_id=run_id,
                drift_type="missing_user",
                stripe_subscription_id=_attr(sub, "id"),
                stripe_customer_id=_attr(sub, "customer"),
                notes=f"internal_error: {err_msg}",
            )
            totals["missing_user"] += 1
            logger.warning("[StripeReconcile] per-sub error: %s", err_msg)

    stale_db_count = _find_stale_db_rows(sb, seen_customer_ids, run_id)

    finished_at = datetime.now(timezone.utc)
    total_drift = sum(totals.values()) + stale_db_count

    # Summary row — always written so ops can filter by run_id and
    # instantly see counts even if the individual drift rows were
    # truncated by a logging dashboard.
    _insert_drift(
        sb,
        run_id=run_id,
        drift_type="run_summary",
        notes=(
            f"checked={checked} total_drift={total_drift} "
            f"status={totals['status_mismatch']} tier={totals['tier_mismatch']} "
            f"period={totals['period_end_mismatch']} missing={totals['missing_user']} "
            f"unknown_price={totals['unknown_price']} stale_db={stale_db_count} "
            f"duration_ms={int((finished_at - started_at).total_seconds() * 1000)}"
        ),
    )

    return {
        "run_id": run_id,
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "checked_subscriptions": checked,
        "drift_counts": {**totals, "stale_db_status": stale_db_count},
        "total_drift": total_drift,
        "errors": errors,
    }
