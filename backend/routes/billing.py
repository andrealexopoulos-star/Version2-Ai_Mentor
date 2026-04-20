"""Unified billing routes — token allowance overview + charges + supplier obligations.

Track B4 (2026-04-21): /billing/overview rewritten to a token-allowance-centred
shape backed by public.usage_ledger (migration 111) + migration 112 columns.
/billing/charges and /billing/suppliers are unchanged.
"""

from __future__ import annotations

import logging
import os
from calendar import monthrange
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

from core.plans import (
    TIER_ALLOCATIONS,
    TOPUP_PRICE_AUD_CENTS,
    TOPUP_TOKENS,
    allocation_for,
    normalize_tier,
)
from routes.deps import (
    TIER_RATE_LIMIT_DEFAULTS,
    _normalize_subscription_tier,
    get_current_user,
    get_sb,
)
from routes.integrations import get_accounting_summary


router = APIRouter()


# ─── Pydantic models (module-top per FastAPI resolution order) ────────

class AutoTopupPatchBody(BaseModel):
    enabled: bool


# ─── Legacy usage-feature map (still referenced by the old _safe_usage_summary
#     below — dead code post-B4 but kept so the module loads unchanged).
_LEGACY_FEATURE_MAP = {
    "ai_queries": "soundboard_daily",
    "boardroom":  "boardroom_diagnosis",
}


# ─── Preserved helpers (unchanged from prior revision) ─────────────────

def _month_start_and_reset(today: Optional[date] = None) -> tuple[str, str]:
    """(month_start, next_month_start) ISO dates for current calendar month."""
    today = today or datetime.now(timezone.utc).date()
    month_start = today.replace(day=1)
    if today.month == 12:
        next_month = date(today.year + 1, 1, 1)
    else:
        next_month = date(today.year, today.month + 1, 1)
    return month_start.isoformat(), next_month.isoformat()


def _safe_usage_summary(sb, user_id: str, subscription_tier: Optional[str]) -> Dict[str, Any]:
    """DEPRECATED post-B4 (2026-04-21). Kept only so any residual caller still
    compiles. /billing/overview no longer reads this; see new handler below."""
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
    except Exception as exc:
        logger.warning("ai_usage_log aggregation failed for %s: %s", user_id, exc)

    def _feature_entry(feature_key: str) -> Dict[str, Any]:
        limit = int((tier_limits.get(feature_key) or {}).get("monthly_limit") or 0)
        unlimited = limit < 0
        return {
            "used": counts.get(feature_key, 0),
            "limit": None if unlimited else limit,
            "unlimited": unlimited,
        }

    features = {
        "soundboard": _feature_entry("soundboard_daily"),
        "trinity":    _feature_entry("trinity_daily"),
        "boardroom":  _feature_entry("boardroom_diagnosis"),
        "war_room":   _feature_entry("war_room_ask"),
    }
    summary: Dict[str, Any] = {
        "tier": tier,
        "month_start": month_start_iso,
        "period_reset": period_reset_iso,
        "features": features,
        "exports_used": 0,
        "exports_limit": None,
    }
    for legacy_key, feature_key in _LEGACY_FEATURE_MAP.items():
        entry = _feature_entry(feature_key)
        summary[f"{legacy_key}_used"] = entry["used"]
        summary[f"{legacy_key}_limit"] = entry["limit"]
    return summary


def _safe_user_subscription_state(sb, user_id: str) -> Dict[str, Any]:
    """DEPRECATED post-B4. See _safe_user_billing_state for the Track B4 shape."""
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
    except Exception as exc:
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


# ─── New B4 helpers — token-allowance overview ────────────────────────

def _iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_iso_ts(raw: Any) -> Optional[datetime]:
    if not raw:
        return None
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    try:
        parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _safe_user_billing_state(sb, user_id: str) -> Dict[str, Any]:
    """Slim users row with tier + lifecycle + trust-layer fields (migration 112)."""
    try:
        res = (
            sb.table("users")
            .select(
                "subscription_tier,subscription_status,current_period_end,"
                "past_due_since,trial_ends_at,stripe_customer_id,"
                "auto_topup_enabled,payment_required,topup_warned_at"
            )
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        rows = (res.data or []) if res is not None else []
        return (rows[0] or {}) if rows else {}
    except Exception as exc:
        logger.warning("users billing lookup failed for %s: %s", user_id, exc)
        return {}


def _latest_ledger_reset_ts(sb, user_id: str) -> Optional[datetime]:
    """Most recent kind='reset' row in usage_ledger (authoritative period start)."""
    try:
        res = (
            sb.table("usage_ledger")
            .select("created_at,period_start")
            .eq("user_id", user_id)
            .eq("kind", "reset")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = (res.data or []) if res is not None else []
        if not rows:
            return None
        return _parse_iso_ts(rows[0].get("period_start")) or _parse_iso_ts(rows[0].get("created_at"))
    except Exception as exc:
        logger.warning("usage_ledger reset lookup failed for %s: %s", user_id, exc)
        return None


def _resolve_period_start(user_state: Dict[str, Any]) -> datetime:
    """Fallback when no reset row exists: (current_period_end - 1 month) or first-of-UTC-month."""
    now = datetime.now(timezone.utc)
    cpe = _parse_iso_ts(user_state.get("current_period_end"))
    if cpe:
        y, m = cpe.year, cpe.month - 1
        if m == 0:
            m, y = 12, y - 1
        d = min(cpe.day, monthrange(y, m)[1])
        return datetime(y, m, d, cpe.hour, cpe.minute, cpe.second, tzinfo=timezone.utc)
    return datetime(now.year, now.month, 1, tzinfo=timezone.utc)


def _sum_ledger_by_kind(sb, user_id: str, since: datetime) -> Dict[str, int]:
    """Sum usage_ledger tokens since `since`, split by kind (consume + topup only)."""
    out = {"consume": 0, "topup": 0}
    try:
        res = (
            sb.table("usage_ledger")
            .select("kind,tokens")
            .eq("user_id", user_id)
            .gte("created_at", _iso(since))
            .in_("kind", ["consume", "topup"])
            .execute()
        )
        for row in (res.data or []):
            k = row.get("kind")
            if k in out:
                out[k] += int(row.get("tokens") or 0)
    except Exception as exc:
        logger.warning("usage_ledger sum failed for %s: %s", user_id, exc)
    return out


def _recent_topups(sb, user_id: str, limit: int = 5) -> List[Dict[str, Any]]:
    try:
        res = (
            sb.table("usage_ledger")
            .select("created_at,tokens,price_aud_cents,stripe_payment_intent_id,stripe_invoice_id")
            .eq("user_id", user_id)
            .eq("kind", "topup")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return [
            {
                "date": row.get("created_at"),
                "tokens": int(row.get("tokens") or 0),
                "price_aud_cents": int(row.get("price_aud_cents") or 0),
                "stripe_ref": row.get("stripe_payment_intent_id") or row.get("stripe_invoice_id"),
            }
            for row in (res.data or [])
        ]
    except Exception as exc:
        logger.warning("usage_ledger topup list failed for %s: %s", user_id, exc)
        return []


def _recent_invoices(payment_rows: List[Dict[str, Any]], limit: int = 5) -> List[Dict[str, Any]]:
    """Map payment_transactions rows to the invoice shape the new UI reads.
    hosted_invoice_url not yet persisted; follow-up webhook will add it."""
    out: List[Dict[str, Any]] = []
    for row in payment_rows[:limit]:
        amount = _to_float(row.get("amount"))
        cents = int(round(amount * 100))
        out.append({
            "date": row.get("paid_at") or row.get("created_at"),
            "amount_aud_cents": cents,
            "status": str(row.get("payment_status") or "unknown").lower(),
            "hosted_invoice_url": None,
        })
    return out


# Tier prices in AUD cents. Matches Stripe products (verified 2026-04-21 against
# acct_1T8sPaRoX8RKDDG5): Growth prod_U8D8vKuXXK7qhO=$69, Pro prod_ULf4KFDh0UKpeR=$199,
# Business prod_ULfA7QJoT3Ontk=$349.
_TIER_PRICE_AUD_CENTS = {
    "trial":        0,
    "free":         0,
    "starter":      6900,   # $69
    "pro":         19900,   # $199
    "business":    34900,   # $349
    "enterprise":      0,   # contract billing
    "custom_build":    0,
    "super_admin":     0,
}


def _next_charge(user_state: Dict[str, Any], tier: str) -> Optional[Dict[str, Any]]:
    """Synthesise {date, amount_aud_cents} from users.current_period_end + tier price."""
    cpe = user_state.get("current_period_end")
    if not cpe:
        return None
    return {
        "date": _iso(_parse_iso_ts(cpe)),
        "amount_aud_cents": _TIER_PRICE_AUD_CENTS.get(normalize_tier(tier), 0),
    }


# ─── Endpoint: GET /billing/overview (Track B4 replacement) ───────────

@router.get("/billing/overview")
async def get_billing_overview(current_user: dict = Depends(get_current_user)):
    """Token-allowance-centred overview. Replaces the prior accounting-summary
    shape (dropped per Andreas lock 6b — BillingPage.js + Settings.js updated
    in same PR). See _next_charge for tier-price source-of-truth."""
    try:
        user_id = current_user["id"]
        sb = get_sb()

        user_state = _safe_user_billing_state(sb, user_id)
        tier = normalize_tier(user_state.get("subscription_tier"))
        allowance = allocation_for(tier)
        unmetered = allowance < 0

        period_start = _latest_ledger_reset_ts(sb, user_id) or _resolve_period_start(user_state)

        totals = _sum_ledger_by_kind(sb, user_id, period_start)
        consumed = totals["consume"]
        topped_up = totals["topup"]

        if unmetered:
            net_remaining = -1
            percent_consumed = 0.0
        else:
            effective_allowance = max(0, allowance + topped_up)
            net_remaining = max(0, effective_allowance - consumed)
            percent_consumed = 0.0
            if effective_allowance > 0:
                percent_consumed = round(min(1.0, consumed / effective_allowance), 4)

        payment_rows = _safe_payment_rows(user_id)

        return {
            "ok": True,
            "plan": {
                "tier": tier,
                "monthly_allowance": allowance if not unmetered else -1,
                "unmetered": unmetered,
            },
            "consumed_this_period": consumed,
            "topped_up_this_period": topped_up,
            "net_remaining": net_remaining,
            "percent_consumed": percent_consumed,
            "next_charge": _next_charge(user_state, tier),
            "auto_topup_enabled": bool(user_state.get("auto_topup_enabled", True)),
            "payment_required": bool(user_state.get("payment_required", False)),
            "recent_topups": _recent_topups(sb, user_id, limit=5),
            "recent_invoices": _recent_invoices(payment_rows, limit=5),
            "period_start": _iso(period_start),
            "subscription_status": user_state.get("subscription_status"),
            "trial_ends_at": user_state.get("trial_ends_at"),
            "topup_pack": {
                "tokens": TOPUP_TOKENS,
                "price_aud_cents": TOPUP_PRICE_AUD_CENTS,
            },
            "generated_at": _iso(datetime.now(timezone.utc)),
        }
    except Exception as e:
        logger.error(f"[billing-overview] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/billing/auto-topup")
async def patch_auto_topup(
    body: AutoTopupPatchBody,
    current_user: dict = Depends(get_current_user),
):
    """Toggle users.auto_topup_enabled for the authenticated user."""
    user_id = current_user["id"]
    sb = get_sb()
    try:
        res = (
            sb.table("users")
            .update({"auto_topup_enabled": bool(body.enabled)})
            .eq("id", user_id)
            .execute()
        )
        if not (res.data or []):
            raise HTTPException(status_code=404, detail="User not found")
        logger.info(
            "[billing-auto-topup] user=%s auto_topup_enabled=%s",
            user_id, bool(body.enabled),
        )
        return {"ok": True, "auto_topup_enabled": bool(body.enabled)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[billing-auto-topup] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ─── Preserved endpoints (unchanged) ──────────────────────────────────

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
            supplier_invoices.append({
                "invoice_id": inv.get("id") or inv.get("invoice_number") or inv.get("number"),
                "supplier": inv.get("contact_name")
                or inv.get("vendor_name")
                or inv.get("supplier_name")
                or "Unknown supplier",
                "amount": round(_to_float(inv.get("total_amount") or inv.get("amount")), 2),
                "status": status,
                "due_date": inv.get("due_date"),
                "is_overdue": bool(due_date and due_date < today and not is_closed),
            })

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
