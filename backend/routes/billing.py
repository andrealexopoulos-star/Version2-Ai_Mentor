"""Unified billing routes for charges + supplier obligations."""

from __future__ import annotations

import logging
import os
from calendar import monthrange
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException

logger = logging.getLogger(__name__)

from routes.deps import (
    TIER_RATE_LIMIT_DEFAULTS,
    _normalize_subscription_tier,
    get_current_user,
    get_sb,
)
from routes.integrations import get_accounting_summary


router = APIRouter()


# ─── Usage summary for /billing/overview ───────────────────────────
#
# Maps the four internal rate-limit features to the three meters the
# current BillingPage.js UI renders. We keep both the rich `features`
# breakdown (so a future UI can show all four features separately) and
# the legacy flat keys (ai_queries_*, boardroom_*, exports_*) so the
# shipped frontend renders real numbers without a frontend deploy.
#
# `exports` has no matching rate-limit feature yet. Until we instrument
# snapshot / report exports we report used=0 and limit=None; the
# frontend treats limit=None as "no cap" (see BillingPage.js change).
_LEGACY_FEATURE_MAP = {
    "ai_queries": "soundboard_daily",
    "boardroom":  "boardroom_diagnosis",
}


def _month_start_and_reset(today: Optional[date] = None) -> tuple[str, str]:
    """Return (month_start_iso_date, period_reset_iso_date) for today.

    month_start is the first day of the current calendar month — the
    ai_usage_log aggregation window. period_reset is midnight on the
    first day of the NEXT month, which is when the monthly counters
    naturally reset (independent of subscription renewal date).
    """
    today = today or datetime.now(timezone.utc).date()
    month_start = today.replace(day=1)
    if today.month == 12:
        next_month = date(today.year + 1, 1, 1)
    else:
        next_month = date(today.year, today.month + 1, 1)
    return month_start.isoformat(), next_month.isoformat()


def _safe_usage_summary(sb, user_id: str, subscription_tier: Optional[str]) -> Dict[str, Any]:
    """Aggregate ai_usage_log counts for the current month and pair them
    with the tier-level monthly limits from TIER_RATE_LIMIT_DEFAULTS.

    Returns a dict with BOTH the rich `features` shape (used by future
    UIs) and flat legacy keys the shipped BillingPage reads today.

    Wrapped in a try/except so a Supabase hiccup degrades to `null`-ish
    numbers rather than breaking the whole /billing/overview response —
    usage is supplementary, not load-bearing.
    """
    tier = _normalize_subscription_tier(subscription_tier)
    tier_limits = TIER_RATE_LIMIT_DEFAULTS.get(tier) or TIER_RATE_LIMIT_DEFAULTS["free"]

    month_start_iso, period_reset_iso = _month_start_and_reset()

    counts: Dict[str, int] = {feature: 0 for feature in tier_limits.keys()}
    try:
        res = (
            sb.table("ai_usage_log")
            .select("feature,count,date")
            .eq("user_id", user_id)
            .gte("date", month_start_iso)
            .execute()
        )
        for row in (res.data or []):
            feature = row.get("feature")
            if feature in counts:
                counts[feature] += int(row.get("count") or 0)
    except Exception as exc:  # pragma: no cover — best-effort counter
        logger.warning("ai_usage_log aggregation failed for %s: %s", user_id, exc)

    def _feature_entry(feature_key: str) -> Dict[str, Any]:
        limit = int((tier_limits.get(feature_key) or {}).get("monthly_limit") or 0)
        unlimited = limit < 0
        return {
            "used": counts.get(feature_key, 0),
            # Frontend can render null as "∞"; -1 is only an internal marker.
            "limit": None if unlimited else limit,
            "unlimited": unlimited,
        }

    features = {
        "soundboard": _feature_entry("soundboard_daily"),
        "trinity":    _feature_entry("trinity_daily"),
        "boardroom":  _feature_entry("boardroom_diagnosis"),
        "war_room":   _feature_entry("war_room_ask"),
    }

    # Legacy flat keys so the shipped BillingPage.js works without deploy.
    summary: Dict[str, Any] = {
        "tier": tier,
        "month_start": month_start_iso,
        "period_reset": period_reset_iso,
        "features": features,
        "exports_used": 0,     # not yet instrumented; see _LEGACY_FEATURE_MAP docstring
        "exports_limit": None,
    }
    for legacy_key, feature_key in _LEGACY_FEATURE_MAP.items():
        entry = _feature_entry(feature_key)
        summary[f"{legacy_key}_used"] = entry["used"]
        summary[f"{legacy_key}_limit"] = entry["limit"]
    return summary


def _safe_user_subscription_state(sb, user_id: str) -> Dict[str, Any]:
    """Return a slim users row with tier + lifecycle fields or {} on error.

    Gives /billing/overview a single source of truth for tier naming and
    subscription status without re-reading ai_usage_log for tier.
    """
    try:
        res = (
            sb.table("users")
            .select(
                "subscription_tier,subscription_status,current_period_end,"
                "past_due_since,trial_ends_at,stripe_customer_id"
            )
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        rows = (res.data or []) if res is not None else []
        return (rows[0] or {}) if rows else {}
    except Exception as exc:  # pragma: no cover — lifecycle columns shipped in migration 096
        logger.warning("users lifecycle lookup failed for %s: %s", user_id, exc)
        return {}


def _parse_due_date(raw_value: Any):
    if not raw_value:
        return None
    raw = str(raw_value)
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
    except Exception:
        try:
            return datetime.strptime(raw[:10], "%Y-%m-%d").date()
        except Exception:
            return None


def _invoice_bucket(inv: Dict[str, Any]) -> str:
    raw_type = str(
        inv.get("type")
        or inv.get("invoice_type")
        or inv.get("document_type")
        or inv.get("transaction_type")
        or ""
    ).upper()
    if any(token in raw_type for token in ("RECEIVABLE", "CUSTOMER", "AR", "SALES")):
        return "client"
    if any(token in raw_type for token in ("PAYABLE", "VENDOR", "SUPPLIER", "BILL", "AP")):
        return "supplier"
    return "unknown"


def _to_float(value: Any) -> float:
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def _safe_payment_rows(user_id: str) -> List[Dict[str, Any]]:
    try:
        res = (
            get_sb()
            .table("payment_transactions")
            .select("session_id,amount,currency,payment_status,tier,created_at,paid_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(100)
            .execute()
        )
        return list(res.data or [])
    except Exception:
        return []


def _safe_integration_rows(user_id: str) -> List[Dict[str, Any]]:
    try:
        res = (
            get_sb()
            .table("integration_accounts")
            .select("provider,category,connected_at,last_sync_at")
            .eq("user_id", user_id)
            .execute()
        )
        return list(res.data or [])
    except Exception:
        return []


@router.get("/billing/overview")
async def get_billing_overview(current_user: dict = Depends(get_current_user)):
    try:
        user_id = current_user["id"]

        integrations = _safe_integration_rows(user_id)
        accounting_integrations = [
            row for row in integrations if str(row.get("category", "")).strip().lower() == "accounting"
        ]
        stripe_integrations = [
            row for row in integrations if "stripe" in str(row.get("provider", "")).strip().lower()
        ]

        accounting_data = await get_accounting_summary(current_user)
        metrics = accounting_data.get("metrics") or {}

        payment_rows = _safe_payment_rows(user_id)
        paid_rows = [row for row in payment_rows if str(row.get("payment_status", "")).lower() == "paid"]
        initiated_rows = [
            row for row in payment_rows if str(row.get("payment_status", "")).lower() not in ("paid", "failed")
        ]

        total_paid = round(sum(_to_float(row.get("amount")) for row in paid_rows), 2)
        total_initiated = round(sum(_to_float(row.get("amount")) for row in initiated_rows), 2)

        supplier_summary = {
            "total_outstanding_supplier": round(_to_float(metrics.get("total_outstanding_supplier")), 2),
            "total_overdue_supplier": round(_to_float(metrics.get("total_overdue_supplier")), 2),
            "overdue_count_supplier": int(metrics.get("overdue_count_supplier") or 0),
            "total_supplier_invoices": int(metrics.get("total_supplier_invoices") or 0),
        }

        billing_connectors = {
            "xero_or_accounting_connected": bool(accounting_data.get("connected")),
            "xero_detected": any(
                "xero" in str(row.get("provider", "")).strip().lower() for row in accounting_integrations
            ),
            "stripe_connected": bool(stripe_integrations)
            or bool(os.environ.get("STRIPE_API_KEY"))
            or bool(payment_rows),
            "accounting_providers": [row.get("provider") for row in accounting_integrations if row.get("provider")],
            "stripe_providers": [row.get("provider") for row in stripe_integrations if row.get("provider")],
        }

        # Real usage + subscription lifecycle (Step 3 / P1-1). The usage
        # summary feeds the three progress meters on BillingPage.js that
        # were shipped rendering "-- / --" because the endpoint never
        # populated an `usage` key.
        sb = get_sb()
        user_state = _safe_user_subscription_state(sb, user_id)
        usage_summary = _safe_usage_summary(sb, user_id, user_state.get("subscription_tier"))
        subscription_block = {
            "tier": usage_summary["tier"],
            "status": user_state.get("subscription_status"),
            "current_period_end": user_state.get("current_period_end"),
            "past_due_since": user_state.get("past_due_since"),
            "trial_ends_at": user_state.get("trial_ends_at"),
        }

        return {
            "ok": True,
            "billing_connectors": billing_connectors,
            "charges_summary": {
                "total_paid": total_paid,
                "total_initiated": total_initiated,
                "paid_count": len(paid_rows),
                "initiated_count": len(initiated_rows),
                "currency": (paid_rows[0].get("currency") if paid_rows else "aud"),
            },
            "supplier_summary": supplier_summary,
            "subscription": subscription_block,
            "usage": usage_summary,
            "recent_charges": payment_rows[:10],
            "recent_supplier_invoices": (
                [
                    {
                        "invoice_id": inv.get("id") or inv.get("invoice_number") or inv.get("number"),
                        "supplier": inv.get("contact_name")
                        or inv.get("vendor_name")
                        or inv.get("supplier_name")
                        or "Unknown supplier",
                        "amount": round(_to_float(inv.get("total_amount") or inv.get("amount")), 2),
                        "status": inv.get("status") or "UNKNOWN",
                        "due_date": inv.get("due_date"),
                    }
                    for inv in (accounting_data.get("invoices") or [])
                    if _invoice_bucket(inv) == "supplier"
                ][:10]
            ),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"[billing-overview] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/billing/charges")
async def get_billing_charges(current_user: dict = Depends(get_current_user)):
    try:
        rows = _safe_payment_rows(current_user["id"])
        paid_rows = [row for row in rows if str(row.get("payment_status", "")).lower() == "paid"]
        return {
            "ok": True,
            "charges": rows,
            "summary": {
                "total_count": len(rows),
                "paid_count": len(paid_rows),
                "paid_total": round(sum(_to_float(row.get("amount")) for row in paid_rows), 2),
                "currency": (paid_rows[0].get("currency") if paid_rows else "aud"),
            },
        }
    except Exception as e:
        logger.error(f"[billing-charges] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/billing/suppliers")
async def get_billing_suppliers(current_user: dict = Depends(get_current_user)):
    try:
        accounting_data = await get_accounting_summary(current_user)
        invoices = accounting_data.get("invoices") or []
        today = datetime.now(timezone.utc).date()

        supplier_invoices = []
        for inv in invoices:
            if _invoice_bucket(inv) != "supplier":
                continue
            due_date = _parse_due_date(inv.get("due_date"))
            status = str(inv.get("status") or "UNKNOWN").upper()
            is_closed = status in {"PAID", "VOID", "DELETED", "CANCELLED", "CANCELED", "CREDITED"}
            supplier_invoices.append(
                {
                    "invoice_id": inv.get("id") or inv.get("invoice_number") or inv.get("number"),
                    "supplier": inv.get("contact_name")
                    or inv.get("vendor_name")
                    or inv.get("supplier_name")
                    or "Unknown supplier",
                    "amount": round(_to_float(inv.get("total_amount") or inv.get("amount")), 2),
                    "status": status,
                    "due_date": inv.get("due_date"),
                    "is_overdue": bool(due_date and due_date < today and not is_closed),
                }
            )

        supplier_invoices.sort(key=lambda row: row.get("due_date") or "", reverse=True)

        return {
            "ok": True,
            "connected": bool(accounting_data.get("connected")),
            "provider": accounting_data.get("provider"),
            "suppliers": supplier_invoices[:100],
            "summary": {
                "count": len(supplier_invoices),
                "overdue_count": sum(1 for row in supplier_invoices if row.get("is_overdue")),
                "total_amount": round(sum(_to_float(row.get("amount")) for row in supplier_invoices), 2),
                "total_overdue_amount": round(
                    sum(_to_float(row.get("amount")) for row in supplier_invoices if row.get("is_overdue")), 2
                ),
            },
        }
    except Exception as e:
        logger.error(f"[billing-suppliers] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

