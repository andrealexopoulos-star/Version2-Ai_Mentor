"""Business Brain Engine — unified concern evaluation over canonical business_core data.

Design goals:
- Vendor-agnostic canonical analysis (business_core schema)
- Deterministic + probabilistic blended concern scoring
- Intelligence Spine event/model/decision logging
- Tier-aware output shaping (free/paid/custom)
"""

from __future__ import annotations

import os
import re
import uuid
import math
import json
from pathlib import Path
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta, date
from typing import Any, Dict, List, Optional, Tuple

from intelligence_spine import emit_spine_event, log_model_execution


def _metric_catalog_candidates() -> List[str]:
    module_dir = Path(__file__).resolve().parent
    env_override = os.environ.get("BUSINESS_BRAIN_CATALOG_PATH")
    candidates = [
        env_override,
        str(module_dir / "business_brain_top100_catalog.json"),
        str(module_dir / "backend" / "business_brain_top100_catalog.json"),
        "/app/business_brain_top100_catalog.json",
        "/app/backend/business_brain_top100_catalog.json",
        "/home/oai/share/biqc_top100_metrics.md",
        "/app/memory/biqc_top100_metrics.md",
    ]

    deduped: List[str] = []
    for candidate in candidates:
        if candidate and candidate not in deduped:
            deduped.append(candidate)
    return deduped


@dataclass
class MetricDefinition:
    index: int
    name: str
    label: str
    domain: str
    definition: str
    formula: str
    source: str


def _metric_slug(value: str) -> str:
    # Remove parenthetical abbreviations from canonical key generation
    base = re.sub(r"\([^)]*\)", "", value or "")
    base = re.sub(r"[^a-zA-Z0-9]+", "_", base).strip("_").lower()
    return base


CORE_METRICS_FALLBACK: List[MetricDefinition] = [
    MetricDefinition(1, "total_revenue", "Total revenue", "Finance", "total sales before expenses", "sum(paid client invoices)", "Accounting"),
    MetricDefinition(2, "revenue_growth_rate", "Revenue growth rate", "Finance", "percentage change vs prior period", "(rev_t - rev_t-1) / rev_t-1", "Accounting"),
    MetricDefinition(3, "gross_profit_margin", "Gross profit margin", "Finance", "profit after COGS", "(revenue - cogs)/revenue", "Accounting"),
    MetricDefinition(4, "net_profit_margin", "Net profit margin", "Finance", "profit after all expenses", "net_income / revenue", "Accounting"),
    MetricDefinition(7, "average_order_value", "Average order value (AOV)", "Sales", "average revenue per transaction", "total_sales / orders", "CRM/Accounting"),
    MetricDefinition(8, "average_revenue_per_customer", "Average revenue per customer (ARPC)", "Sales", "revenue per customer", "revenue / customers", "CRM/Accounting"),
    MetricDefinition(13, "cash_runway", "Cash runway", "Cash", "months of cash left", "cash_balance / monthly_burn", "Accounting"),
    MetricDefinition(14, "burn_rate", "Burn rate", "Cash", "monthly net cash loss", "monthly_expenses - monthly_revenue", "Accounting"),
    MetricDefinition(19, "accounts_receivable_aging", "Accounts receivable aging", "Liquidity", "days customers take to pay", "aging report", "Accounting"),
    MetricDefinition(20, "accounts_payable_aging", "Accounts payable aging", "Liquidity", "days company takes to pay suppliers", "aging report", "Accounting"),
    MetricDefinition(21, "pipeline_value", "Pipeline value", "Sales", "total value of open deals", "sum(open deal amounts)", "CRM"),
    MetricDefinition(23, "number_of_opportunities", "Number of opportunities", "Sales", "active deals count", "count(open deals)", "CRM"),
    MetricDefinition(24, "average_deal_size", "Average deal size", "Sales", "mean value of deals", "deal_value / deal_count", "CRM"),
    MetricDefinition(25, "win_rate", "Win rate", "Sales", "won opportunities ÷ total opportunities", "won / total", "CRM"),
    MetricDefinition(26, "sales_velocity", "Sales velocity", "Sales", "speed of revenue generation", "(opp * avg_deal * win_rate) / cycle", "CRM"),
    MetricDefinition(27, "average_sales_cycle_length", "Average sales cycle length", "Sales", "days to close", "sum(close-open)/closed", "CRM"),
    MetricDefinition(29, "lead_response_time", "Lead response time", "Sales", "time to follow up", "avg(first_contact - lead_created)", "CRM/Email"),
    MetricDefinition(39, "retention_rate", "Retention rate", "Customer", "customers staying", "((end-new)/start)*100", "CRM"),
    MetricDefinition(40, "churn_rate", "Churn rate", "Customer", "customers leaving", "lost / start", "CRM"),
    MetricDefinition(70, "operating_expense_ratio", "Operating expense ratio (OPEX)", "Operations", "overhead efficiency", "operating_expenses / revenue", "Accounting"),
]


def load_metric_catalog() -> List[MetricDefinition]:
    """Loads top100 metric catalog from markdown path; falls back to core definitions."""
    for path in _metric_catalog_candidates():
        if not os.path.exists(path):
            continue
        try:
            if path.endswith(".json"):
                raw = json.loads(open(path, "r", encoding="utf-8").read())
                parsed_json: List[MetricDefinition] = []
                for row in raw:
                    metric_label = str(row.get("metric") or "").strip()
                    parsed_json.append(
                        MetricDefinition(
                            index=int(row.get("id") or 0),
                            name=_metric_slug(metric_label),
                            label=metric_label,
                            domain=str(row.get("category") or "General"),
                            definition=str(row.get("description") or ""),
                            formula=str(row.get("formula") or ""),
                            source=str(row.get("source") or ""),
                        )
                    )
                if parsed_json:
                    return sorted(parsed_json, key=lambda m: m.index)

            parsed: List[MetricDefinition] = []
            with open(path, "r", encoding="utf-8") as f:
                for raw in f:
                    line = raw.strip()
                    if not line or not re.match(r"^\d+\s", line):
                        continue

                    parts = re.split(r"\t+", line)
                    if len(parts) < 6:
                        parts = re.split(r"\s{2,}", line)

                    if len(parts) >= 6 and parts[0].isdigit():
                        parsed.append(
                            MetricDefinition(
                                index=int(parts[0]),
                                name=_metric_slug(parts[1].strip()),
                                label=parts[1].strip(),
                                domain=parts[2].strip(),
                                definition=parts[3].strip(),
                                formula=parts[4].strip(),
                                source=parts[5].strip(),
                            )
                        )

            if parsed:
                return parsed
        except Exception:
            continue

    return CORE_METRICS_FALLBACK


def metric_catalog_diagnostics() -> Dict[str, Any]:
    diagnostics: Dict[str, Any] = {
        "candidates": [],
        "resolved_source": "fallback_core_metrics",
        "resolved_count": len(CORE_METRICS_FALLBACK),
    }

    for path in _metric_catalog_candidates():
        entry: Dict[str, Any] = {
            "path": path,
            "exists": os.path.exists(path),
            "parsed_count": 0,
            "format": "json" if path.endswith(".json") else "markdown",
            "error": None,
        }
        if not entry["exists"]:
            diagnostics["candidates"].append(entry)
            continue

        try:
            if path.endswith(".json"):
                raw = json.loads(open(path, "r", encoding="utf-8").read())
                entry["parsed_count"] = len(raw) if isinstance(raw, list) else 0
            else:
                parsed_count = 0
                with open(path, "r", encoding="utf-8") as f:
                    for raw_line in f:
                        line = raw_line.strip()
                        if not line or not re.match(r"^\d+\s", line):
                            continue
                        parts = re.split(r"\t+", line)
                        if len(parts) < 6:
                            parts = re.split(r"\s{2,}", line)
                        if len(parts) >= 6 and parts[0].isdigit():
                            parsed_count += 1
                entry["parsed_count"] = parsed_count

            if entry["parsed_count"] > 0 and diagnostics["resolved_source"] == "fallback_core_metrics":
                diagnostics["resolved_source"] = path
                diagnostics["resolved_count"] = entry["parsed_count"]
        except Exception as e:
            entry["error"] = str(e)

        diagnostics["candidates"].append(entry)

    return diagnostics


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except Exception:
        return default


def _parse_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _days_between(a: Optional[datetime], b: Optional[datetime]) -> Optional[int]:
    if not a or not b:
        return None
    return int((b - a).total_seconds() // 86400)


def normalize_tier_mode(user: Dict[str, Any]) -> str:
    tier = str(user.get("subscription_tier") or "free").lower().strip()
    role = str(user.get("role") or "").lower().strip()
    if role in {"superadmin", "super_admin"}:
        return "custom"
    if tier in {"custom", "enterprise", "super_admin"}:
        return "custom"
    if tier in {"starter", "professional", "growth", "foundation"}:
        return "paid"
    return "free"


class BusinessBrainEngine:
    def __init__(self, sb, tenant_id: str, user: Dict[str, Any]):
        self.sb = sb
        self.tenant_id = tenant_id
        self.user = user
        self.tier_mode = normalize_tier_mode(user)
        self.catalog_diagnostics = metric_catalog_diagnostics()
        self.catalog_source = self.catalog_diagnostics.get("resolved_source", "fallback_core_metrics")
        self.catalog = load_metric_catalog()
        self.business_core_ready = self._detect_business_core_schema()
        self._sync_metric_catalog()

    def _detect_business_core_schema(self) -> bool:
        try:
            self.sb.schema("business_core").table("source_runs").select("source_id").limit(1).execute()
            return True
        except Exception:
            return False

    def _t(self, table: str):
        return self.sb.schema("business_core").table(table)

    def _sync_metric_catalog(self) -> None:
        if not self.business_core_ready:
            return
        rows = []
        for m in self.catalog:
            rows.append({
                "metric_id": m.index,
                "metric_key": m.name,
                "metric_name": m.label,
                "category": m.domain,
                "description": m.definition,
                "formula": m.formula,
                "primary_source": m.source,
                "active": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
        try:
            self._t("metric_definitions").upsert(rows, on_conflict="metric_id").execute()
        except Exception:
            # Registry sync is best-effort until migration is applied.
            pass

    def _fetch_all(self, table: str, columns: str = "*", filters: Optional[List[Tuple[str, str, Any]]] = None, batch: int = 1000) -> List[Dict[str, Any]]:
        start = 0
        all_rows: List[Dict[str, Any]] = []
        filters = filters or []
        while True:
            q = self._t(table).select(columns).eq("tenant_id", self.tenant_id).range(start, start + batch - 1)
            for op, key, value in filters:
                if op == "eq":
                    q = q.eq(key, value)
                elif op == "neq":
                    q = q.neq(key, value)
                elif op == "gte":
                    q = q.gte(key, value)
                elif op == "lte":
                    q = q.lte(key, value)
            res = q.execute()
            rows = res.data or []
            all_rows.extend(rows)
            if len(rows) < batch:
                break
            start += batch
        return all_rows

    def _source_availability(self) -> Dict[str, bool]:
        availability = {
            "accounting": False,
            "crm": False,
            "marketing": False,
            "email": False,
            "calendar": False,
            "support": False,
            "survey": False,
            "hr": False,
            "operations": False,
            "billing": False,
            "product_analytics": False,
            "web_analytics": False,
            "seo": False,
            "social": False,
        }
        try:
            runs = self._t("source_runs").select("connector_type,status").eq("tenant_id", self.tenant_id).execute().data or []
            for r in runs:
                if str(r.get("status") or "") not in {"completed", "partial"}:
                    continue
                connector_type = str(r.get("connector_type") or "").lower()
                if "accounting" in connector_type:
                    availability["accounting"] = True
                if "crm" in connector_type:
                    availability["crm"] = True
                if "marketing" in connector_type:
                    availability["marketing"] = True
                if "email" in connector_type or "outlook" in connector_type or "gmail" in connector_type:
                    availability["email"] = True
                if "calendar" in connector_type:
                    availability["calendar"] = True
                if "hr" in connector_type:
                    availability["hr"] = True
                if "billing" in connector_type:
                    availability["billing"] = True
                if "analytics" in connector_type:
                    availability["product_analytics"] = True
                    availability["web_analytics"] = True
        except Exception:
            pass

        try:
            invoice_count = self._t("invoices").select("id", count="exact").eq("tenant_id", self.tenant_id).limit(1).execute().count or 0
            deal_count = self._t("deals").select("id", count="exact").eq("tenant_id", self.tenant_id).limit(1).execute().count or 0
            activity_count = self._t("activities").select("id", count="exact").eq("tenant_id", self.tenant_id).limit(1).execute().count or 0
            task_count = self._t("tasks").select("id", count="exact").eq("tenant_id", self.tenant_id).limit(1).execute().count or 0
            payment_count = self._t("payments").select("id", count="exact").eq("tenant_id", self.tenant_id).limit(1).execute().count or 0

            if invoice_count > 0 or payment_count > 0:
                availability["accounting"] = True
                availability["billing"] = availability["billing"] or True
            if deal_count > 0:
                availability["crm"] = True
            if activity_count > 0:
                availability["email"] = availability["email"] or True
                availability["marketing"] = availability["marketing"] or True
            if task_count > 0:
                availability["operations"] = True
        except Exception:
            pass

        return availability

    def _catalog_source_ready(self, source: str, availability: Dict[str, bool]) -> bool:
        source_norm = str(source or "").lower()
        if not source_norm:
            return False

        aliases = {
            "accounting": "accounting",
            "crm": "crm",
            "marketing": "marketing",
            "email": "email",
            "email platform": "email",
            "calendar": "calendar",
            "support": "support",
            "survey": "survey",
            "hr": "hr",
            "operations": "operations",
            "billing": "billing",
            "product analytics": "product_analytics",
            "web analytics": "web_analytics",
            "seo tools": "seo",
            "social platforms": "social",
        }

        parts = [p.strip() for p in re.split(r"[/,]", source_norm) if p.strip()]
        if not parts:
            return False

        # For mixed sources, consider ready if at least one required source is available.
        for part in parts:
            key = aliases.get(part)
            if key and availability.get(key):
                return True
            # fuzzy fallback
            for alias, mapped in aliases.items():
                if alias in part and availability.get(mapped):
                    return True
        return False

    def _upsert_metric(self, metric_name: str, metric_group: str, value: Optional[float], period_start: date, period_end: date, details: Dict[str, Any], evidence_ids: List[str], confidence: float = 1.0) -> None:
        row = {
            "tenant_id": self.tenant_id,
            "metric_name": metric_name,
            "metric_group": metric_group,
            "value": value,
            "period": "daily",
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "calculation_details": details,
            "evidence_ids": evidence_ids,
            "confidence_score": round(max(0.0, min(1.0, confidence)), 4),
            "calculated_at": datetime.now(timezone.utc).isoformat(),
        }
        self._t("business_metrics").upsert(
            row,
            on_conflict="tenant_id,metric_name,period,period_start,period_end",
        ).execute()

    def _insert_spine_event(self, event_type: str, json_payload: Dict[str, Any], confidence: float = 1.0, object_id: Optional[str] = None) -> Optional[str]:
        payload = {
            "tenant_id": self.tenant_id,
            "event_type": event_type,
            "json_payload": json_payload,
            "confidence_score": confidence,
        }
        if object_id:
            payload["object_id"] = object_id

        try:
            result = self.sb.table("ic_intelligence_events").insert(payload).execute()
            if result.data:
                return str(result.data[0].get("id"))
        except Exception:
            pass

        try:
            emit_spine_event(
                tenant_id=self.tenant_id,
                event_type=event_type,
                object_id=object_id,
                json_payload=json_payload,
                confidence_score=confidence,
            )
        except Exception:
            pass
        return None

    def _insert_model_execution(self, model_name: str, output_summary: Dict[str, Any], confidence: float, execution_time_ms: int = 1) -> Optional[str]:
        payload = {
            "model_name": model_name,
            "model_version": "1.0",
            "tenant_id": self.tenant_id,
            "execution_time_ms": execution_time_ms,
            "confidence_score": confidence,
            "output_summary": output_summary,
        }
        try:
            result = self.sb.table("ic_model_executions").insert(payload).execute()
            if result.data:
                return str(result.data[0].get("id"))
        except Exception:
            pass

        try:
            log_model_execution(
                tenant_id=self.tenant_id,
                model_name=model_name,
                model_version="1.0",
                execution_time_ms=execution_time_ms,
                confidence_score=confidence,
                output_summary=output_summary,
            )
        except Exception:
            pass
        return None

    def _ensure_model_registry(self, model_name: str, model_type: str = "hybrid_inference") -> None:
        payload = {
            "model_name": model_name,
            "model_version": "1.0",
            "model_type": model_type,
            "tenant_scope": self.tenant_id,
            "hyperparameters": {
                "priority_formula": "impact*urgency*confidence/max(1,effort)",
                "engine": "business_brain_priority_engine",
            },
            "input_features": {
                "metrics": [
                    "pipeline_value",
                    "overdue_ar_amount",
                    "sales_velocity",
                    "lead_response_time",
                    "task_overdue_rate",
                ]
            },
        }
        try:
            self.sb.table("ic_model_registry").upsert(
                payload,
                on_conflict="model_name,model_version",
            ).execute()
        except Exception:
            pass

    def compute_metrics(self) -> Dict[str, Any]:
        if not self.business_core_ready:
            return {
                "period_start": None,
                "period_end": None,
                "metrics_count": 0,
                "event_id": None,
                "business_core_ready": False,
                "message": "business_core schema not yet exposed; apply migrations and expose schema in Supabase API settings.",
            }

        now = datetime.now(timezone.utc)
        today = now.date()
        period_start = today - timedelta(days=30)

        deals = self._fetch_all("deals")
        invoices = self._fetch_all("invoices")
        payments = self._fetch_all("payments")
        customers = self._fetch_all("customers")
        activities = self._fetch_all("activities")
        tasks = self._fetch_all("tasks")

        paid_status = {"paid", "closed_paid", "settled"}
        closed_invoice_status = paid_status | {"void", "deleted", "cancelled", "canceled", "credited"}
        open_invoice_status = {"open", "authorized", "submitted", "partially_paid", "sent", "approved", "overdue"}

        def is_client_invoice(inv: Dict[str, Any]) -> bool:
            raw = str(inv.get("invoice_type") or "").lower()
            if not raw:
                return True
            if any(tok in raw for tok in ["payable", "supplier", "vendor", "bill", "ap"]):
                return False
            return True

        total_revenue = 0.0
        overdue_ar_amount = 0.0
        overdue_ar_count = 0
        overdue_ap_amount = 0.0
        overdue_ap_count = 0
        ar_aging_days: List[int] = []
        ap_aging_days: List[int] = []
        paid_invoice_count = 0

        for inv in invoices:
            status = str(inv.get("status") or "").lower()
            amount = _safe_float(inv.get("amount"))
            due = _parse_dt(inv.get("due_date"))
            client_invoice = is_client_invoice(inv)

            if client_invoice and status in paid_status:
                total_revenue += amount
                paid_invoice_count += 1

            is_overdue = (
                status not in closed_invoice_status
                and (
                    status == "overdue"
                    or (status in open_invoice_status and due is not None and due.date() < today)
                )
            )

            if is_overdue and client_invoice:
                overdue_ar_amount += amount
                overdue_ar_count += 1
                if due:
                    ar_aging_days.append(max(0, (today - due.date()).days))
            elif is_overdue and not client_invoice:
                overdue_ap_amount += amount
                overdue_ap_count += 1
                if due:
                    ap_aging_days.append(max(0, (today - due.date()).days))

        open_deals = [
            d for d in deals
            if str(d.get("status") or "").lower() not in {"won", "lost", "closed"}
        ]
        won_deals = [d for d in deals if str(d.get("status") or "").lower() in {"won", "closed_won"}]
        lost_deals = [d for d in deals if str(d.get("status") or "").lower() in {"lost", "closed_lost"}]
        stalled_deals = []

        for d in open_deals:
            last_activity = _parse_dt(d.get("last_activity_at"))
            if last_activity and (now - last_activity).days >= 10:
                stalled_deals.append(d)

        pipeline_value = sum(_safe_float(d.get("amount")) for d in open_deals)
        avg_deal_size = (pipeline_value / len(open_deals)) if open_deals else 0.0
        total_closed_deals = len(won_deals) + len(lost_deals)
        win_rate = (len(won_deals) / total_closed_deals) if total_closed_deals else 0.0

        cycle_days = []
        for d in (won_deals + lost_deals):
            open_dt = _parse_dt(d.get("open_date")) or _parse_dt(d.get("created_at"))
            close_dt = _parse_dt(d.get("close_date")) or _parse_dt(d.get("updated_at"))
            span = _days_between(open_dt, close_dt)
            if span is not None and span >= 0:
                cycle_days.append(span)
        avg_sales_cycle = (sum(cycle_days) / len(cycle_days)) if cycle_days else 0.0
        sales_velocity = ((len(open_deals) * avg_deal_size * win_rate) / max(1.0, avg_sales_cycle)) if open_deals else 0.0

        active_customers = [c for c in customers if str(c.get("status") or "").lower() not in {"lost", "churned", "inactive"}]
        churned_customers = [c for c in customers if str(c.get("status") or "").lower() in {"lost", "churned"}]
        customer_base = len(customers) if customers else 1
        churn_rate = len(churned_customers) / customer_base
        retention_rate = max(0.0, 1.0 - churn_rate)

        task_overdue_count = 0
        for t in tasks:
            due = _parse_dt(t.get("due_date"))
            status = str(t.get("status") or "").lower()
            if due and due.date() < today and status not in {"done", "closed", "completed"}:
                task_overdue_count += 1
        task_overdue_rate = task_overdue_count / max(1, len(tasks))

        # Lead response time proxy: activity lag (created_at -> activity_date)
        response_lags_hours: List[float] = []
        for a in activities:
            created = _parse_dt(a.get("created_at"))
            activity_date = _parse_dt(a.get("activity_date"))
            if created and activity_date and activity_date >= created:
                response_lags_hours.append((activity_date - created).total_seconds() / 3600.0)
        lead_response_time_hours = (sum(response_lags_hours) / len(response_lags_hours)) if response_lags_hours else 0.0

        monthly_revenue = total_revenue
        monthly_burn = max(0.0, overdue_ap_amount - monthly_revenue)
        cash_balance_proxy = monthly_revenue + sum(_safe_float(p.get("amount")) for p in payments)
        cash_runway_months = (cash_balance_proxy / monthly_burn) if monthly_burn > 0 else 999.0

        metric_map: Dict[str, Tuple[str, float, Dict[str, Any], List[str], float]] = {
            "total_revenue": ("Finance", total_revenue, {"period_days": 30, "paid_invoice_count": paid_invoice_count}, [str(i.get("id")) for i in invoices[:100]], 0.95),
            "average_order_value": ("Sales", (total_revenue / paid_invoice_count) if paid_invoice_count else 0.0, {"paid_invoice_count": paid_invoice_count}, [str(i.get("id")) for i in invoices[:100]], 0.9),
            "average_revenue_per_customer": ("Sales", (total_revenue / max(1, len(active_customers))), {"active_customers": len(active_customers)}, [str(c.get("id")) for c in active_customers[:100]], 0.85),
            "pipeline_value": ("Sales", pipeline_value, {"open_deals": len(open_deals)}, [str(d.get("id")) for d in open_deals[:100]], 0.95),
            "number_of_opportunities": ("Sales", float(len(open_deals)), {"open_deals": len(open_deals)}, [str(d.get("id")) for d in open_deals[:100]], 0.95),
            "average_deal_size": ("Sales", avg_deal_size, {"open_deals": len(open_deals)}, [str(d.get("id")) for d in open_deals[:100]], 0.9),
            "win_rate": ("Sales", win_rate, {"won": len(won_deals), "lost": len(lost_deals)}, [str(d.get("id")) for d in (won_deals + lost_deals)[:100]], 0.85),
            "sales_velocity": ("Sales", sales_velocity, {"opportunities": len(open_deals), "avg_deal_size": avg_deal_size, "win_rate": win_rate, "sales_cycle_days": avg_sales_cycle}, [str(d.get("id")) for d in open_deals[:100]], 0.8),
            "average_sales_cycle_length": ("Sales", avg_sales_cycle, {"sample_size": len(cycle_days)}, [str(d.get("id")) for d in (won_deals + lost_deals)[:100]], 0.8),
            "overdue_ar_count": ("Liquidity", float(overdue_ar_count), {"client_invoices_only": True}, [str(i.get("id")) for i in invoices[:100]], 0.95),
            "overdue_ar_amount": ("Liquidity", overdue_ar_amount, {"client_invoices_only": True}, [str(i.get("id")) for i in invoices[:100]], 0.95),
            "overdue_ap_count": ("Liquidity", float(overdue_ap_count), {"supplier_invoices_only": True}, [str(i.get("id")) for i in invoices[:100]], 0.95),
            "overdue_ap_amount": ("Liquidity", overdue_ap_amount, {"supplier_invoices_only": True}, [str(i.get("id")) for i in invoices[:100]], 0.95),
            "accounts_receivable_aging": ("Liquidity", (sum(ar_aging_days) / len(ar_aging_days)) if ar_aging_days else 0.0, {"sample_size": len(ar_aging_days), "client_invoices_only": True}, [str(i.get("id")) for i in invoices[:100]], 0.9),
            "accounts_payable_aging": ("Liquidity", (sum(ap_aging_days) / len(ap_aging_days)) if ap_aging_days else 0.0, {"sample_size": len(ap_aging_days), "supplier_invoices_only": True}, [str(i.get("id")) for i in invoices[:100]], 0.9),
            "lead_response_time": ("Sales", lead_response_time_hours, {"unit": "hours", "sample_size": len(response_lags_hours)}, [str(a.get("id")) for a in activities[:100]], 0.75),
            "retention_rate": ("Customer", retention_rate, {"customers": len(customers), "churned": len(churned_customers)}, [str(c.get("id")) for c in customers[:100]], 0.8),
            "churn_rate": ("Customer", churn_rate, {"customers": len(customers), "churned": len(churned_customers)}, [str(c.get("id")) for c in customers[:100]], 0.8),
            "task_overdue_rate": ("Operations", task_overdue_rate, {"overdue": task_overdue_count, "total_tasks": len(tasks)}, [str(t.get("id")) for t in tasks[:100]], 0.8),
            "burn_rate": ("Cash", monthly_burn, {"monthly_revenue": monthly_revenue, "monthly_supplier_overdue": overdue_ap_amount}, [str(i.get("id")) for i in invoices[:100]], 0.7),
            "cash_runway_months": ("Cash", cash_runway_months, {"cash_balance_proxy": cash_balance_proxy, "monthly_burn": monthly_burn}, [str(p.get("id")) for p in payments[:100]], 0.65),
            "operating_expense_ratio": ("Operations", (overdue_ap_amount / max(1.0, monthly_revenue)) if monthly_revenue else 0.0, {"supplier_overdue_as_proxy": True}, [str(i.get("id")) for i in invoices[:100]], 0.55),
        }

        # Revenue growth from previous 30-day metric snapshot value
        prev_rows = self._t("business_metrics").select("value,period_start,period_end").eq("tenant_id", self.tenant_id).eq("metric_name", "total_revenue").order("period_end", desc=True).limit(2).execute().data or []
        prev_value = _safe_float(prev_rows[1].get("value")) if len(prev_rows) > 1 else 0.0
        growth = ((total_revenue - prev_value) / prev_value) if prev_value > 0 else 0.0
        metric_map["revenue_growth_rate"] = (
            "Finance",
            growth,
            {"current_revenue": total_revenue, "previous_revenue": prev_value},
            [str(i.get("id")) for i in invoices[:100]],
            0.7 if prev_value > 0 else 0.4,
        )

        for metric_name, (group, value, details, evidence, confidence) in metric_map.items():
            self._upsert_metric(
                metric_name=metric_name,
                metric_group=group,
                value=value,
                period_start=period_start,
                period_end=today,
                details=details,
                evidence_ids=evidence,
                confidence=confidence,
            )

        # Mirror into intelligence spine daily snapshot aggregate.
        try:
            self.sb.table("ic_daily_metric_snapshots").upsert(
                {
                    "tenant_id": self.tenant_id,
                    "snapshot_date": today.isoformat(),
                    "revenue": total_revenue,
                    "cash_balance": cash_balance_proxy,
                    "deal_velocity": sales_velocity,
                    "engagement_score": max(0.0, min(1.0, 1.0 - task_overdue_rate)),
                    "risk_score": max(0.0, min(1.0, (overdue_ar_amount / max(1.0, total_revenue + 1.0)))),
                    "active_deals": len(open_deals),
                    "stalled_deals": len(stalled_deals),
                    "pipeline_value": pipeline_value,
                },
                on_conflict="tenant_id,snapshot_date",
            ).execute()
        except Exception:
            pass

        event_id = self._insert_spine_event(
            event_type="METRIC_CHANGE",
            json_payload={
                "metrics_computed": list(metric_map.keys()),
                "catalog_size": len(self.catalog),
                "period_start": period_start.isoformat(),
                "period_end": today.isoformat(),
            },
            confidence=0.9,
        )

        return {
            "period_start": period_start.isoformat(),
            "period_end": today.isoformat(),
            "metrics_count": len(metric_map),
            "event_id": event_id,
        }

    def _latest_metrics_map(self) -> Dict[str, Dict[str, Any]]:
        if not self.business_core_ready:
            return {}
        rows = self._t("business_metrics").select("metric_name,value,metric_group,calculation_details,evidence_ids,confidence_score,calculated_at").eq("tenant_id", self.tenant_id).order("calculated_at", desc=True).limit(500).execute().data or []
        latest: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            name = row.get("metric_name")
            if name and name not in latest:
                latest[name] = row
        return latest

    def _effective_concerns(self) -> List[Dict[str, Any]]:
        if not self.business_core_ready:
            return [
                {
                    "concern_id": "cashflow_risk",
                    "name": "Cashflow Risk",
                    "description": "Detects near-term cash pressure.",
                    "required_signals": ["overdue_ar_amount", "burn_rate", "cash_runway"],
                    "tier": "free",
                    "effective_priority_formula": {"impact_weight": 1.0, "urgency_weight": 1.0, "confidence_weight": 1.0, "effort_divisor": 1.0},
                    "deterministic_rule": "overdue receivables > threshold OR runway < threshold",
                    "probabilistic_model": "cashflow_risk_model_v1",
                    "active": True,
                },
                {
                    "concern_id": "pipeline_stagnation",
                    "name": "Pipeline Stagnation",
                    "description": "Flags opportunities not progressing.",
                    "required_signals": ["pipeline_value", "sales_velocity", "average_sales_cycle_length"],
                    "tier": "free",
                    "effective_priority_formula": {"impact_weight": 1.0, "urgency_weight": 1.0, "confidence_weight": 1.0, "effort_divisor": 1.0},
                    "deterministic_rule": "stalled deals proportion > threshold",
                    "probabilistic_model": "pipeline_stagnation_model_v1",
                    "active": True,
                },
            ]

        concerns = self._t("concern_registry").select("*").eq("active", True).execute().data or []
        overrides = self._t("concern_overrides").select("*").eq("tenant_id", self.tenant_id).eq("enabled", True).execute().data or []
        by_id = {r.get("concern_id"): r for r in overrides}

        output = []
        for c in concerns:
            override = by_id.get(c.get("concern_id"))
            formula = override.get("priority_formula") if override else c.get("priority_formula")
            row = {**c, "effective_priority_formula": formula or c.get("priority_formula") or {}}
            output.append(row)
        return output

    def _score(self, impact: float, urgency: float, confidence: float, effort: float, formula: Dict[str, Any]) -> float:
        iw = _safe_float((formula or {}).get("impact_weight"), 1.0)
        uw = _safe_float((formula or {}).get("urgency_weight"), 1.0)
        cw = _safe_float((formula or {}).get("confidence_weight"), 1.0)
        ed = _safe_float((formula or {}).get("effort_divisor"), 1.0)

        weighted = (impact * iw) * (urgency * uw) * (confidence * cw)
        denom = max(1.0, effort * max(ed, 0.1))
        return round(weighted / denom, 4)

    def evaluate_concerns(self) -> Dict[str, Any]:
        started = datetime.now(timezone.utc)
        if not self.business_core_ready:
            lightweight = []
            for c in self._effective_concerns():
                lightweight.append({
                    "concern_id": c.get("concern_id"),
                    "name": c.get("name"),
                    "priority_score": 0.0,
                    "impact": 0.0,
                    "urgency": 0.0,
                    "confidence": 0.0,
                    "effort": 1.0,
                    "recommendation": "Enable business_core schema to activate concern scoring.",
                    "tier": c.get("tier", "free"),
                    "evidence": [],
                    "explanation": "Concern registry loaded, but canonical data schema is not active yet.",
                    "source": {"event_id": None},
                    "time_window": {
                        "period": "n/a",
                        "evaluated_at": datetime.now(timezone.utc).isoformat(),
                    },
                    "deterministic_rule": c.get("deterministic_rule"),
                    "probabilistic_model": c.get("probabilistic_model"),
                    "priority_formula": c.get("effective_priority_formula") or {},
                })
            return {
                "tier_mode": self.tier_mode,
                "concerns": lightweight,
                "model_execution_id": None,
                "source_event_ids": [],
            }

        self._ensure_model_registry("business_brain_priority_engine")
        metrics = self._latest_metrics_map()
        concerns = self._effective_concerns()
        evaluations: List[Dict[str, Any]] = []
        event_ids: List[str] = []

        def mv(name: str, default: float = 0.0) -> float:
            row = metrics.get(name) or {}
            return _safe_float(row.get("value"), default)

        for concern in concerns:
            concern_id = concern.get("concern_id")
            required = concern.get("required_signals") or []

            if concern_id == "cashflow_risk":
                overdue = mv("overdue_ar_amount")
                runway = mv("cash_runway_months", 999.0)
                burn = mv("burn_rate")
                impact = min(10.0, 2.0 + (overdue / 10000.0) + (burn / 10000.0))
                urgency = 9.5 if runway < 3 else 7.0 if runway < 6 else 5.0
                confidence = 0.9 if "overdue_ar_amount" in metrics else 0.6
                effort = 3.0
                recommendation = "Trigger collections actions and cashflow review in 24h."
                explanation = f"Overdue client receivables are {overdue:,.0f}; runway is {runway:.1f} months."
            elif concern_id == "revenue_leakage":
                stalled_value = mv("pipeline_value") * 0.25
                win = mv("win_rate")
                impact = min(10.0, 2.0 + (stalled_value / 20000.0))
                urgency = 8.0 if win < 0.25 else 6.5
                confidence = 0.85 if "pipeline_value" in metrics else 0.55
                effort = 4.0
                recommendation = "Prioritize stalled high-value opportunities and enforce owner follow-up cadence."
                explanation = f"Pipeline exposure indicates potential leakage; win rate at {win * 100:.1f}%."
            elif concern_id == "pipeline_stagnation":
                opp = mv("number_of_opportunities")
                velocity = mv("sales_velocity")
                cycle = mv("average_sales_cycle_length")
                impact = min(10.0, 3.0 + (opp / 25.0))
                urgency = 8.5 if cycle > 60 else 6.0
                confidence = 0.85 if "sales_velocity" in metrics else 0.6
                effort = 3.0
                recommendation = "Re-sequence deal stages and unblock stalled opportunities this week."
                explanation = f"Sales velocity is {velocity:.2f} with average cycle {cycle:.1f} days."
            elif concern_id == "client_response_risk":
                resp_hours = mv("lead_response_time")
                churn = mv("churn_rate")
                impact = min(10.0, 2.5 + (resp_hours / 8.0) + (churn * 10.0))
                urgency = 8.5 if resp_hours > 24 else 6.5
                confidence = 0.8 if "lead_response_time" in metrics else 0.5
                effort = 2.0
                recommendation = "Triage priority inbox and enforce first-response SLA immediately."
                explanation = f"Lead response time is {resp_hours:.1f}h; churn is {churn * 100:.1f}%."
            elif concern_id == "concentration_risk":
                arpc = mv("average_revenue_per_customer")
                revenue = mv("total_revenue")
                proxy_share = min(1.0, arpc / max(1.0, revenue)) if revenue > 0 else 0.0
                impact = min(10.0, 2.0 + proxy_share * 10.0)
                urgency = 7.0 if proxy_share > 0.25 else 5.5
                confidence = 0.65
                effort = 4.0
                recommendation = "Diversify revenue concentration and create fallback account plan."
                explanation = f"Top-customer revenue concentration proxy is {proxy_share * 100:.1f}%."
            elif concern_id == "margin_compression":
                op_exp_ratio = mv("operating_expense_ratio")
                growth = mv("revenue_growth_rate")
                impact = min(10.0, 2.0 + (op_exp_ratio * 10.0) + max(0.0, -growth * 4.0))
                urgency = 8.0 if op_exp_ratio > 0.7 else 6.0
                confidence = 0.65
                effort = 5.0
                recommendation = "Audit cost drivers and protect gross margin on active deals."
                explanation = f"Operating expense ratio proxy is {op_exp_ratio:.2f}; growth is {growth * 100:.1f}%."
            else:  # operations_bottlenecks + custom classes default path
                overdue_tasks = mv("task_overdue_rate")
                impact = min(10.0, 2.0 + overdue_tasks * 10.0)
                urgency = 8.0 if overdue_tasks > 0.3 else 5.5
                confidence = 0.7
                effort = 3.5
                recommendation = "Reduce operational queue latency and clear overdue tasks."
                explanation = f"Task overdue rate is {overdue_tasks * 100:.1f}% based on latest task feed."

            availability = 0.0
            if required:
                availability = sum(1 for s in required if s in metrics) / max(1, len(required))
                confidence = max(0.35, min(0.99, confidence * (0.6 + 0.4 * availability)))

            formula = concern.get("effective_priority_formula") or {}
            priority_score = self._score(impact, urgency, confidence, effort, formula)

            evidence = []
            for signal_name in required:
                m = metrics.get(signal_name)
                if m:
                    evidence.append({
                        "metric_name": signal_name,
                        "metric_value": m.get("value"),
                        "metric_confidence": m.get("confidence_score"),
                        "evidence_ids": m.get("evidence_ids") or [],
                    })

            row = {
                "tenant_id": self.tenant_id,
                "concern_id": concern_id,
                "impact": round(impact, 4),
                "urgency": round(urgency, 4),
                "confidence": round(confidence, 4),
                "effort": round(effort, 4),
                "priority_score": priority_score,
                "recommendation": recommendation,
                "explanation": explanation,
                "evidence": evidence,
                "evaluated_at": datetime.now(timezone.utc).isoformat(),
            }
            self._t("concern_evaluations").insert(row).execute()

            event_id = self._insert_spine_event(
                event_type="MODEL_EXECUTED",
                json_payload={
                    "concern_id": concern_id,
                    "priority_score": priority_score,
                    "impact": impact,
                    "urgency": urgency,
                    "confidence": confidence,
                    "effort": effort,
                    "required_signals": required,
                    "availability": availability,
                },
                confidence=confidence,
            )
            if event_id:
                event_ids.append(event_id)

            # Decision registry linkage for high-impact concerns.
            if priority_score >= 20:
                try:
                    self.sb.table("ic_decisions").insert({
                        "tenant_id": self.tenant_id,
                        "decision_category": concern_id,
                        "context_snapshot": {
                            "priority_score": priority_score,
                            "explanation": explanation,
                            "evidence": evidence,
                        },
                        "predicted_impact": impact,
                        "predicted_confidence": confidence,
                        "risk_level_at_time": min(1.0, priority_score / 50.0),
                    }).execute()
                except Exception:
                    pass

            evaluations.append({
                "concern_id": concern_id,
                "name": concern.get("name"),
                "priority_score": priority_score,
                "impact": round(impact, 4),
                "urgency": round(urgency, 4),
                "confidence": round(confidence, 4),
                "effort": round(effort, 4),
                "recommendation": recommendation,
                "tier": concern.get("tier", "free"),
                "evidence": evidence,
                "explanation": explanation,
                "source": {"event_id": event_id},
                "time_window": {
                    "period": "rolling_30d",
                    "evaluated_at": row["evaluated_at"],
                },
                "deterministic_rule": concern.get("deterministic_rule"),
                "probabilistic_model": concern.get("probabilistic_model"),
                "priority_formula": formula,
            })

        evaluations.sort(key=lambda x: x["priority_score"], reverse=True)

        elapsed_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
        execution_id = self._insert_model_execution(
            model_name="business_brain_priority_engine",
            output_summary={
                "concern_count": len(evaluations),
                "top_concern": evaluations[0]["concern_id"] if evaluations else None,
                "tier_mode": self.tier_mode,
                "source_event_ids": event_ids,
            },
            confidence=0.85,
            execution_time_ms=max(1, elapsed_ms),
        )

        return {
            "tier_mode": self.tier_mode,
            "concerns": evaluations,
            "model_execution_id": execution_id,
            "source_event_ids": event_ids,
        }

    def get_priorities(self, recompute_metrics: bool = False) -> Dict[str, Any]:
        if recompute_metrics:
            self.compute_metrics()

        output = self.evaluate_concerns()
        concerns = output.get("concerns") or []

        if self.tier_mode == "free":
            trimmed = []
            for item in concerns[:3]:
                trimmed.append({
                    "concern_id": item["concern_id"],
                    "priority_score": item["priority_score"],
                    "impact": item["impact"],
                    "urgency": item["urgency"],
                    "confidence": item["confidence"],
                    "effort": item["effort"],
                    "tier": "free",
                    "explanation": item["explanation"],
                    "source": item["source"],
                    "time_window": item["time_window"],
                })
            output["concerns"] = trimmed
        elif self.tier_mode == "paid":
            # Paid gets full concerns + recommended actions.
            output["concerns"] = concerns
        else:
            # Custom/enterprise includes policy details.
            output["concerns"] = concerns

        return output

    def get_metrics(self, metric_name: Optional[str] = None, period: Optional[str] = None) -> List[Dict[str, Any]]:
        if not self.business_core_ready:
            return []
        q = self._t("business_metrics").select("*").eq("tenant_id", self.tenant_id).order("calculated_at", desc=True).limit(500)
        if metric_name:
            q = q.eq("metric_name", metric_name)
        if period:
            q = q.eq("period", period)
        return q.execute().data or []

    def get_metric_coverage(self, period: Optional[str] = None) -> Dict[str, Any]:
        if not self.business_core_ready:
            return {
                "total_metrics": len(self.catalog),
                "computed_metrics": 0,
                "pending_source_metrics": 0,
                "pending_implementation_metrics": 0,
                "pending_schema_metrics": len(self.catalog),
                "source_availability": {},
                "business_core_ready": False,
                "message": "business_core schema not yet exposed; run migrations and expose schema in Supabase PostgREST.",
                "metrics": [
                    {
                        "metric_id": m.index,
                        "metric_name": m.label,
                        "metric_key": m.name,
                        "category": m.domain,
                        "description": m.definition,
                        "formula": m.formula,
                        "primary_source": m.source,
                        "status": "pending_schema_activation",
                        "value": None,
                        "calculated_at": None,
                        "confidence_score": None,
                    }
                    for m in sorted(self.catalog, key=lambda x: x.index)
                ],
            }

        latest_metrics = self.get_metrics(period=period)
        latest_by_name: Dict[str, Dict[str, Any]] = {}
        for row in latest_metrics:
            key = str(row.get("metric_name") or "")
            if key and key not in latest_by_name:
                latest_by_name[key] = row

        # Alias fallback for computed keys that differ from canonical naming.
        alias_map = {
            "cash_runway": "cash_runway_months",
            "average_revenue_per_user": "average_revenue_per_customer",
        }

        availability = self._source_availability()
        coverage_rows: List[Dict[str, Any]] = []
        computed_count = 0
        pending_source = 0
        pending_implementation = 0

        for m in sorted(self.catalog, key=lambda x: x.index):
            metric_key = m.name
            computed_row = latest_by_name.get(metric_key) or latest_by_name.get(alias_map.get(metric_key, ""))
            source_ready = self._catalog_source_ready(m.source, availability)

            if computed_row:
                status = "computed"
                computed_count += 1
            elif source_ready:
                status = "pending_implementation"
                pending_implementation += 1
            else:
                status = "pending_source"
                pending_source += 1

            coverage_rows.append({
                "metric_id": m.index,
                "metric_name": m.label,
                "metric_key": metric_key,
                "category": m.domain,
                "description": m.definition,
                "formula": m.formula,
                "primary_source": m.source,
                "status": status,
                "value": computed_row.get("value") if computed_row else None,
                "calculated_at": computed_row.get("calculated_at") if computed_row else None,
                "confidence_score": computed_row.get("confidence_score") if computed_row else None,
            })

        return {
            "total_metrics": len(self.catalog),
            "computed_metrics": computed_count,
            "pending_source_metrics": pending_source,
            "pending_implementation_metrics": pending_implementation,
            "source_availability": availability,
            "metrics": coverage_rows,
        }

    def list_concerns(self) -> Dict[str, Any]:
        concerns = self._effective_concerns()
        return {
            "tier_mode": self.tier_mode,
            "concerns": concerns,
        }
