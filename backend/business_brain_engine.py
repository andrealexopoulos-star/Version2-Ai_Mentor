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

from intelligence_live_truth import get_connector_truth_summary
from intelligence_spine import emit_spine_event, log_model_execution
from tier_resolver import get_brain_metric_limit, get_brain_plan_label, resolve_tier


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


def _normalize_threshold_number(value: Any) -> Optional[float]:
    try:
        if value in (None, ""):
            return None
        return float(value)
    except Exception:
        return None


def _default_threshold_comparator(metric_key: str, metric_label: str = "") -> str:
    text = f"{metric_key} {metric_label}".lower()
    above_keywords = [
        "burn", "aging", "churn", "drop", "drop_off", "response_time", "resolution_time",
        "cycle", "slippage", "cost", "expense", "bounce", "turnover", "absenteeism",
        "debt", "variance", "credit_utilization", "error", "ratio", "days in inventory",
    ]
    below_keywords = [
        "revenue", "profit", "cash_runway", "pipeline", "win_rate", "retention", "nrr",
        "csat", "nps", "roa", "roe", "coverage", "traffic", "conversion", "engagement",
        "capacity_utilization", "on_time_delivery", "inventory_accuracy", "activation",
        "feature_adoption", "mrr", "arr", "expansion",
    ]
    if any(keyword in text for keyword in above_keywords):
        return "above"
    if any(keyword in text for keyword in below_keywords):
        return "below"
    return "below"


def _threshold_state(value: Any, config: Dict[str, Any]) -> str:
    numeric_value = _normalize_threshold_number(value)
    if numeric_value is None:
        return "no_data"

    enabled = bool(config.get("enabled"))
    warning_value = _normalize_threshold_number(config.get("warning_value"))
    critical_value = _normalize_threshold_number(config.get("critical_value"))
    comparator = str(config.get("comparator") or "below").lower()

    if not enabled or (warning_value is None and critical_value is None):
        return "not_configured"

    if comparator == "above":
        if critical_value is not None and numeric_value >= critical_value:
            return "critical"
        if warning_value is not None and numeric_value >= warning_value:
            return "warning"
        return "normal"

    if critical_value is not None and numeric_value <= critical_value:
        return "critical"
    if warning_value is not None and numeric_value <= warning_value:
        return "warning"
    return "normal"


def _format_aud(value: float) -> str:
    return f"${value:,.0f}"


def _brain_plan_tier(user: Dict[str, Any]) -> str:
    raw_tier = str(user.get("subscription_tier") or "").lower().strip()
    if raw_tier == "custom":
        return "custom"
    return resolve_tier(user)


def _brain_metric_limit_for_plan(plan_tier: str) -> int:
    if plan_tier == "custom":
        return 100
    return get_brain_metric_limit(plan_tier)


def _brain_plan_label_for_tier(plan_tier: str) -> str:
    if plan_tier == "custom":
        return "Custom"
    return get_brain_plan_label(plan_tier)


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
    plan_tier = _brain_plan_tier(user)
    if plan_tier in {"super_admin", "custom"}:
        return "custom"
    if plan_tier in {"starter", "professional", "enterprise"}:
        return "paid"
    return "free"


class BusinessBrainEngine:
    def __init__(self, sb, tenant_id: str, user: Dict[str, Any]):
        self.sb = sb
        self.tenant_id = tenant_id
        self.user = user
        self.plan_tier = _brain_plan_tier(user)
        self.plan_label = _brain_plan_label_for_tier(self.plan_tier)
        self.visible_metric_limit = _brain_metric_limit_for_plan(self.plan_tier)
        self.tier_mode = normalize_tier_mode(user)
        self.catalog_diagnostics = metric_catalog_diagnostics()
        self.catalog_source = self.catalog_diagnostics.get("resolved_source", "fallback_core_metrics")
        self.catalog = load_metric_catalog()
        self.kpi_preferences = self._load_kpi_preferences()
        self.selected_metric_keys = self._load_selected_metric_keys()
        self.kpi_thresholds = self._load_kpi_thresholds()
        self.business_core_ready = self._detect_business_core_schema()
        self._connector_truth_cache: Optional[Dict[str, Dict[str, Any]]] = None
        self._sync_metric_catalog()

    def _load_kpi_preferences(self) -> Dict[str, Any]:
        try:
            result = self.sb.table("business_profiles").select("intelligence_configuration").eq("user_id", self.tenant_id).limit(1).execute()
            row = (result.data or [None])[0] or {}
            config = row.get("intelligence_configuration") or {}
            return config if isinstance(config, dict) else {}
        except Exception:
            return {}

    def _load_kpi_thresholds(self) -> Dict[str, Dict[str, Any]]:
        section = self.kpi_preferences.get("brain_kpis") or {}
        thresholds = section.get("thresholds") or {}
        return thresholds if isinstance(thresholds, dict) else {}

    def _load_selected_metric_keys(self) -> List[str]:
        section = self.kpi_preferences.get("brain_kpis") or {}
        selected = section.get("selected_metric_keys") or []
        if not isinstance(selected, list):
            return []

        allowed = {metric.name for metric in self.catalog}
        normalized: List[str] = []
        seen = set()
        for item in selected:
            key = str(item or "").strip().lower()
            if not key or key in seen or key not in allowed:
                continue
            normalized.append(key)
            seen.add(key)
        return normalized

    def _visible_catalog(self) -> List[MetricDefinition]:
        ordered_catalog = sorted(self.catalog, key=lambda x: x.index)
        if not self.selected_metric_keys:
            return ordered_catalog[: self.visible_metric_limit]

        selected_lookup = {metric.name: metric for metric in ordered_catalog}
        selected = [selected_lookup[key] for key in self.selected_metric_keys if key in selected_lookup]
        return selected[: self.visible_metric_limit]

    def _catalog_metric_payload(self, metric: MetricDefinition) -> Dict[str, Any]:
        selected_set = set(self.selected_metric_keys)
        selected_count = len(selected_set)
        is_selected = metric.name in selected_set
        limit_reached = selected_count >= self.visible_metric_limit
        return {
            "metric_id": metric.index,
            "metric_name": metric.label,
            "metric_key": metric.name,
            "category": metric.domain,
            "description": metric.definition,
            "formula": metric.formula,
            "primary_source": metric.source,
            "selected": is_selected,
            "selection_disabled": bool(not is_selected and limit_reached),
            "threshold_config": self._threshold_config_for_metric(metric),
        }

    def _threshold_config_for_metric(self, metric: MetricDefinition) -> Dict[str, Any]:
        saved = self.kpi_thresholds.get(metric.name) or {}
        warning_value = _normalize_threshold_number(saved.get("warning_value"))
        critical_value = _normalize_threshold_number(saved.get("critical_value"))
        enabled = bool(saved.get("enabled")) and (warning_value is not None or critical_value is not None)
        return {
            "enabled": enabled,
            "comparator": str(saved.get("comparator") or _default_threshold_comparator(metric.name, metric.label)).lower(),
            "warning_value": warning_value,
            "critical_value": critical_value,
            "note": str(saved.get("note") or "").strip(),
            "updated_at": saved.get("updated_at"),
        }

    def _active_thresholds_count(self) -> int:
        count = 0
        for metric in self._visible_catalog():
            config = self._threshold_config_for_metric(metric)
            if config.get("enabled"):
                count += 1
        return count

    def _threshold_hits_for_signals(self, metrics: Dict[str, Dict[str, Any]], signal_names: List[str]) -> List[Dict[str, Any]]:
        catalog_by_key = {metric.name: metric for metric in self.catalog}
        hits: List[Dict[str, Any]] = []
        for signal_name in signal_names:
            metric_row = metrics.get(signal_name)
            metric_def = catalog_by_key.get(signal_name)
            if not metric_row or not metric_def:
                continue
            threshold_config = self._threshold_config_for_metric(metric_def)
            threshold_state = _threshold_state(metric_row.get("value"), threshold_config)
            if threshold_state not in {"warning", "critical"}:
                continue
            hits.append({
                "metric_key": signal_name,
                "metric_label": metric_def.label,
                "metric_value": metric_row.get("value"),
                "threshold_state": threshold_state,
                "threshold_config": threshold_config,
            })
        return hits

    def _format_metric_value(self, metric_key: str, value: Any) -> str:
        numeric = _safe_float(value, 0.0)
        key = str(metric_key or "").lower()
        if any(token in key for token in ["revenue", "amount", "pipeline", "burn", "cash", "mrr", "arr"]):
            return _format_aud(numeric)
        if "runway" in key:
            return f"{numeric:.1f} months"
        if any(token in key for token in ["rate", "ratio", "margin", "retention", "churn", "win_"]):
            pct = numeric * 100 if numeric <= 1.0 else numeric
            return f"{pct:.0f}%"
        if any(token in key for token in ["cycle", "aging"]):
            return f"{numeric:.0f} days"
        if "response_time" in key:
            return f"{numeric:.1f} hours"
        return f"{numeric:,.0f}"

    def _connector_truth(self) -> Dict[str, Dict[str, Any]]:
        if self._connector_truth_cache is None:
            self._connector_truth_cache = get_connector_truth_summary(self.sb, self.tenant_id)
        return self._connector_truth_cache

    def _concern_source_keys(self, concern_id: str) -> List[str]:
        mapping = {
            "cashflow_risk": ["accounting"],
            "margin_compression": ["accounting"],
            "pipeline_stagnation": ["crm"],
            "revenue_leakage": ["crm"],
            "client_response_risk": ["email"],
            "concentration_risk": ["crm", "accounting"],
            "operations_bottlenecks": ["operations"],
        }
        return mapping.get(concern_id, [])

    def _metric_truth_state(self, metric_key: str, row: Optional[Dict[str, Any]], source_states: List[str]) -> Dict[str, Any]:
        if not row:
            return {"verified": False, "state": "missing", "reason": "This metric doesn't have enough data yet."}

        if any(state in {"error", "stale", "unverified"} for state in source_states):
            return {"verified": False, "state": "source_not_live", "reason": "The data source for this metric needs to be refreshed."}

        details = row.get("calculation_details") or {}
        sample_size = int(_safe_float(details.get("sample_size"), 0.0))

        if metric_key in {"lead_response_time", "average_sales_cycle_length", "accounts_receivable_aging", "accounts_payable_aging"} and sample_size <= 0:
            return {"verified": False, "state": "insufficient_sample", "reason": "Not enough historical data to calculate this reliably yet."}

        if metric_key == "task_overdue_rate" and int(_safe_float(details.get("total_tasks"), 0.0)) <= 0:
            return {"verified": False, "state": "no_task_sample", "reason": "No task management data is connected yet."}

        if metric_key == "cash_runway_months":
            monthly_burn = _safe_float(details.get("monthly_burn"), 0.0)
            metric_value = _safe_float(row.get("value"), 0.0)
            if monthly_burn <= 0 or metric_value >= 999.0:
                return {"verified": False, "state": "sentinel_runway", "reason": "Cash runway can't be calculated because monthly expenses aren't available yet."}

        if metric_key == "operating_expense_ratio" and details.get("supplier_overdue_as_proxy"):
            return {"verified": False, "state": "proxy_only", "reason": "This is an estimate based on limited data — not a confirmed figure."}

        if metric_key == "win_rate" and (int(_safe_float(details.get("won"), 0.0)) + int(_safe_float(details.get("lost"), 0.0))) <= 0:
            return {"verified": False, "state": "insufficient_sample", "reason": "No closed deals in the system yet to calculate win rate."}

        return {"verified": True, "state": "verified", "reason": "This metric is backed by current, verified data."}

    def _build_truth_context(self, concern_id: str, required: List[str], metrics: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        connector_truth = self._connector_truth()
        source_keys = self._concern_source_keys(concern_id)
        source_items: List[Dict[str, Any]] = []
        source_states: List[str] = []
        for key in source_keys:
            item = dict((connector_truth.get(key) or {"category": key, "truth_state": "unverified", "truth_reason": f"{key.title()} truth is not verified."}))
            source_items.append(item)
            source_states.append(str(item.get("truth_state") or "unverified"))

        metric_truth: Dict[str, Dict[str, Any]] = {}
        verified_metric_names: List[str] = []
        blocked_metric_names: List[str] = []
        for signal_name in required:
            truth = self._metric_truth_state(signal_name, metrics.get(signal_name), source_states)
            metric_truth[signal_name] = truth
            if truth.get("verified"):
                verified_metric_names.append(signal_name)
            else:
                blocked_metric_names.append(signal_name)

        availability = (len(verified_metric_names) / max(1, len(required))) if required else 1.0
        truth_state = "verified"
        if blocked_metric_names and not verified_metric_names:
            truth_state = "blocked"
        elif blocked_metric_names:
            truth_state = "needs_verification"

        if any(state in {"error", "stale", "unverified"} for state in source_states):
            truth_state = "blocked" if not verified_metric_names else "needs_verification"

        if source_items:
            source_summary = "; ".join(
                f"{item.get('category', 'source').title()}: {item.get('truth_reason')}"
                for item in source_items
            )
        elif blocked_metric_names:
            source_summary = "Some of the data needed for this recommendation is missing or incomplete."
        else:
            source_summary = "All required data is verified and up to date."

        return {
            "truth_state": truth_state,
            "availability": availability,
            "source_truth": source_items,
            "source_states": source_states,
            "metric_truth": metric_truth,
            "verified_metric_names": verified_metric_names,
            "blocked_metric_names": blocked_metric_names,
            "reason": source_summary,
        }

    def _build_integrity_alert(self, concern: Dict[str, Any], truth_context: Dict[str, Any]) -> Dict[str, Any]:
        concern_id = str(concern.get("concern_id") or "unknown")
        concern_name = str(concern.get("name") or concern_id.replace("_", " ").title())
        source_items = truth_context.get("source_truth") or []
        source_label = ", ".join(item.get("category", "source").title() for item in source_items) or "Data source"
        latest_verified = next((item.get("last_verified_at") for item in source_items if item.get("last_verified_at")), None)
        next_expected = next((item.get("next_expected_update") for item in source_items if item.get("next_expected_update")), None)
        blocked_metrics = truth_context.get("blocked_metric_names") or []

        return {
            "id": f"truth-gap-{concern_id}",
            "concern_id": concern_id,
            "severity": "high" if source_items else "medium",
            "title": f"{source_label} data is out of date — {concern_name.lower()} recommendations are paused",
            "detail": truth_context.get("reason") or f"BIQc can't give you reliable {concern_name.lower()} advice until the data is refreshed.",
            "action": "Go to Integrations, reconnect or resync the affected tool, then come back to see updated recommendations.",
            "truth_state": truth_context.get("truth_state", "blocked"),
            "blocked_metrics": blocked_metrics,
            "last_verified_at": latest_verified,
            "next_expected_update": next_expected,
            "source_truth": source_items,
            "concern_name": concern_name,
        }

    def _latest_seen_timestamp(self, metrics: Dict[str, Dict[str, Any]], signal_names: List[str]) -> Optional[str]:
        latest_ts: Optional[datetime] = None
        latest_raw: Optional[str] = None
        for signal_name in signal_names:
            row = metrics.get(signal_name) or {}
            raw = row.get("calculated_at")
            parsed = _parse_dt(raw)
            if parsed and (latest_ts is None or parsed > latest_ts):
                latest_ts = parsed
                latest_raw = raw
        return latest_raw

    def _source_summary(self, signal_names: List[str]) -> str:
        catalog_by_key = {metric.name: metric for metric in self.catalog}
        sources: List[str] = []
        for signal_name in signal_names:
            metric_def = catalog_by_key.get(signal_name)
            source = str(metric_def.source or "") if metric_def else ""
            if source and source not in sources:
                sources.append(source)
        if not sources:
            return "BIQc synthesized evidence from the current intelligence layer."
        if len(sources) == 1:
            return f"Source signals came from {sources[0]}."
        return f"Source signals came from {', '.join(sources[:2])}."

    def _recommended_action_for_concern(self, concern_id: str) -> str:
        action_map = {
            "cashflow_risk": "action.collections.escalate",
            "revenue_leakage": "action.revenue.recover-leakage",
            "pipeline_stagnation": "action.pipeline.unblock-stalled",
            "client_response_risk": "action.client-response.sla-reset",
            "concentration_risk": "action.revenue.diversify-concentration",
            "margin_compression": "action.finance.margin-protection",
            "operations_bottlenecks": "action.ops.queue-reset",
        }
        return action_map.get(concern_id, f"action.brain.{concern_id}")

    def _freshness_from_last_seen(self, last_seen: Optional[str]) -> str:
        parsed = _parse_dt(last_seen)
        if not parsed:
            return "unknown"
        mins = int(max(0, (datetime.now(timezone.utc) - parsed).total_seconds() // 60))
        if mins < 60:
            return f"{mins}m"
        return f"{mins // 60}h"

    def _fact_points(self, concern_id: str, metrics: Dict[str, Dict[str, Any]], threshold_hits: List[Dict[str, Any]]) -> List[str]:
        points: List[str] = []

        def mv(key: str) -> float:
            return _safe_float((metrics.get(key) or {}).get("value"), 0.0)

        if concern_id == "cashflow_risk":
            overdue_count = mv("overdue_ar_count")
            overdue_amount = mv("overdue_ar_amount")
            runway = mv("cash_runway_months")
            if overdue_count:
                points.append(f"{int(round(overdue_count))} overdue client invoices")
            if overdue_amount:
                points.append(f"{_format_aud(overdue_amount)} overdue receivables")
            if runway:
                points.append(f"Runway {runway:.1f} months")
        elif concern_id in {"pipeline_stagnation", "revenue_leakage"}:
            opp = mv("number_of_opportunities")
            pipeline = mv("pipeline_value")
            cycle = mv("average_sales_cycle_length")
            if opp:
                points.append(f"{int(round(opp))} open opportunities")
            if pipeline:
                points.append(f"{_format_aud(pipeline)} pipeline value")
            if cycle:
                points.append(f"Average cycle {cycle:.0f} days")
        elif concern_id == "client_response_risk":
            resp = mv("lead_response_time")
            churn = mv("churn_rate")
            if resp:
                points.append(f"Lead response time {resp:.1f}h")
            if churn:
                points.append(f"Churn {churn * 100:.0f}%")
        elif concern_id == "concentration_risk":
            arpc = mv("average_revenue_per_customer")
            revenue = mv("total_revenue")
            if arpc:
                points.append(f"Average revenue per customer {_format_aud(arpc)}")
            if revenue:
                points.append(f"Total revenue {_format_aud(revenue)}")
        elif concern_id == "margin_compression":
            op_exp_ratio = mv("operating_expense_ratio")
            growth = mv("revenue_growth_rate")
            points.append(f"Operating expense ratio {self._format_metric_value('operating_expense_ratio', op_exp_ratio)}")
            points.append(f"Revenue growth {self._format_metric_value('revenue_growth_rate', growth)}")
        else:
            overdue_tasks = mv("task_overdue_rate")
            if overdue_tasks:
                points.append(f"Task overdue rate {(overdue_tasks * 100):.0f}%")

        for hit in threshold_hits[:2]:
            points.append(f"Threshold hit: {hit['metric_label']} ({hit['threshold_state']})")
        return points[:4]

    def _structured_brief(
        self,
        concern_id: str,
        metrics: Dict[str, Dict[str, Any]],
        threshold_hits: List[Dict[str, Any]],
        truth_context: Dict[str, Any],
        availability: float,
        impact: float,
        urgency: float,
        confidence: float,
        recommendation: str,
        explanation: str,
        evidence: List[Dict[str, Any]],
    ) -> Dict[str, Any]:

        def mv(key: str, default: float = 0.0) -> float:
            return _safe_float((metrics.get(key) or {}).get("value"), default)

        fact_points = self._fact_points(concern_id, metrics, threshold_hits)
        source_summary = self._source_summary([entry.get("metric_name") for entry in evidence])
        repeat_count = max(1, len([entry for entry in evidence if entry.get("metric_value") not in (None, 0, 0.0)]) + len(threshold_hits))
        last_seen = self._latest_seen_timestamp(metrics, [entry.get("metric_name") for entry in evidence])
        escalation_state = "critical" if threshold_hits and any(hit["threshold_state"] == "critical" for hit in threshold_hits) else "elevated" if impact >= 8 or urgency >= 8 else "monitoring"
        source_truth_items = truth_context.get("source_truth") or []
        source_truth_reason = truth_context.get("reason") or ""
        metric_truth = truth_context.get("metric_truth") or {}

        if source_truth_items:
            source_summary = "Source truth: " + "; ".join(
                f"{item.get('category', 'source').title()}={item.get('truth_state', 'unknown')}"
                for item in source_truth_items
            )

        if concern_id == "cashflow_risk":
            if truth_context.get("truth_state") == "blocked":
                issue_brief = f"Your accounting data is out of date. Last known revenue was {self._format_metric_value('total_revenue', mv('total_revenue'))}, but we can't confirm your current cash position until the data is refreshed."
                why_now_brief = source_truth_reason
                action_brief = "Reconnect your accounting tool (e.g. Xero, QuickBooks) so BIQc can give you accurate cash guidance."
                if_ignored_brief = "You might make cash decisions based on old numbers that no longer match your bank or ledger."
                decision_label = "Refresh your accounting data before making cash decisions"
            else:
                issue_brief = f"{int(round(mv('overdue_ar_count')))} invoices totalling {self._format_metric_value('overdue_ar_amount', mv('overdue_ar_amount'))} are overdue. Your cash runway is {mv('cash_runway_months', 999.0):.1f} months."
                why_now_brief = "Overdue invoices are squeezing your cash flow and limiting your options for the next few weeks."
                action_brief = "Chase overdue invoices today and plan your next 30 days of cash flow with someone accountable."
                if_ignored_brief = "Cash gets tighter — affecting payroll timing, supplier payments, and your ability to invest in growth."
                decision_label = "Cash flow needs your attention in the next 48 hours"
        elif concern_id in {"pipeline_stagnation", "revenue_leakage"}:
            if truth_context.get("truth_state") == "blocked":
                issue_brief = f"Your CRM data is out of date. Last snapshot shows {int(round(mv('number_of_opportunities')))} open opportunities worth {self._format_metric_value('pipeline_value', mv('pipeline_value'))}, but BIQc can't confirm deal movement until the data is refreshed."
                why_now_brief = source_truth_reason
                action_brief = "Reconnect your CRM (e.g. HubSpot, Salesforce) so BIQc can track your pipeline accurately."
                if_ignored_brief = "You might make revenue forecasts based on stale deal data instead of what's actually happening."
                decision_label = "Refresh your CRM data before making pipeline decisions"
            elif not metric_truth.get("average_sales_cycle_length", {}).get("verified"):
                issue_brief = f"{int(round(mv('number_of_opportunities')))} open opportunities worth {self._format_metric_value('pipeline_value', mv('pipeline_value'))} are in your pipeline, but BIQc can't measure deal speed because there aren't enough closed deals to compare against."
                why_now_brief = "Your pipeline value is real, but without closed-deal history, BIQc can't tell you if deals are moving fast enough."
                action_brief = "Focus on the open pipeline for now. As more deals close, BIQc will automatically start measuring velocity."
                if_ignored_brief = "You might overestimate how quickly pipeline will convert without real close-rate data."
                decision_label = "Pipeline visible, but deal speed can't be measured yet"
            else:
                issue_brief = f"{int(round(mv('number_of_opportunities')))} open opportunities worth {self._format_metric_value('pipeline_value', mv('pipeline_value'))} are moving slower than expected — average deal takes {mv('average_sales_cycle_length'):.0f} days."
                why_now_brief = "Deals are taking too long to close, which puts your revenue forecast at risk."
                action_brief = "Follow up on your highest-value stalled deals today and tighten your sales follow-up process."
                if_ignored_brief = "Expected revenue will likely slip to next month, making it harder to hit your targets."
                decision_label = "Deals are stalling — revenue is at risk"
        elif concern_id == "client_response_risk":
            if truth_context.get("truth_state") == "blocked":
                issue_brief = "BIQc doesn't have enough email data yet to measure your response times. Check your Priority Inbox for any urgent threads while the data builds up."
                why_now_brief = source_truth_reason or "Your email connection needs to sync more data before BIQc can measure response speed."
                action_brief = "Check your Priority Inbox for urgent threads. BIQc will start measuring response times automatically as more data syncs."
                if_ignored_brief = "You might assume response times are fine when clients could actually be waiting too long."
                decision_label = "Email response data still building up"
            else:
                issue_brief = f"Your average response time has grown to {self._format_metric_value('lead_response_time', mv('lead_response_time'))}, and churn risk is at {self._format_metric_value('churn_rate', mv('churn_rate'))}."
                why_now_brief = "Slow responses are hurting both customer retention and new deal conversion at the same time."
                action_brief = "Reply to priority conversations today and set a same-day first-response standard for your team."
                if_ignored_brief = "Customers lose confidence, renewals drop, and new leads go cold."
                decision_label = "Customer response times need fixing this week"
        elif concern_id == "concentration_risk":
            if truth_context.get("truth_state") == "blocked":
                issue_brief = "BIQc can't verify your revenue concentration until both CRM and accounting data are current."
                why_now_brief = source_truth_reason
                action_brief = "Reconnect your CRM and accounting tools so BIQc can assess concentration risk."
                if_ignored_brief = "You might be more dependent on a single client than you realise, or less than you fear."
                decision_label = "Need fresh CRM + accounting data to assess concentration"
            else:
                issue_brief = f"Your revenue is heavily concentrated in a few accounts, with average customer value at {self._format_metric_value('average_revenue_per_customer', mv('average_revenue_per_customer'))}."
                why_now_brief = "Losing even one key account could significantly impact your revenue."
                action_brief = "Diversify your pipeline and reduce reliance on your biggest accounts."
                if_ignored_brief = "One lost or delayed account could create a serious revenue gap."
                decision_label = "Too much revenue depends on too few clients"
        elif concern_id == "margin_compression":
            if truth_context.get("truth_state") == "blocked":
                issue_brief = f"Your accounting data isn't fresh enough for BIQc to assess margins. Last known revenue was {self._format_metric_value('total_revenue', mv('total_revenue'))}, but costs and profitability can't be verified right now."
                why_now_brief = source_truth_reason
                action_brief = "Reconnect your accounting tool so BIQc can give you accurate margin advice."
                if_ignored_brief = "You might be making pricing or hiring decisions without knowing your true profit margins."
                decision_label = "Refresh accounting data before making margin decisions"
            else:
                issue_brief = f"Your costs are running at {self._format_metric_value('operating_expense_ratio', mv('operating_expense_ratio'))} of revenue while growth is at {self._format_metric_value('revenue_growth_rate', mv('revenue_growth_rate'))}."
                why_now_brief = "Costs are growing faster than revenue — your margins are getting squeezed."
                action_brief = "Review your biggest costs and protect margins on upcoming deals."
                if_ignored_brief = "Shrinking margins limit your ability to hire, invest, and handle surprises."
                decision_label = "Margins are getting squeezed"
        else:
            if truth_context.get("truth_state") == "blocked":
                issue_brief = "BIQc doesn't have access to your task or project management data yet, so it can't assess operational bottlenecks."
                why_now_brief = source_truth_reason or "Connect your task management tool so BIQc can spot operational delays."
                action_brief = "Connect your task management tool (e.g. Asana, Monday, Jira) in Integrations."
                if_ignored_brief = "Operational issues might be growing without you seeing them until they affect clients or revenue."
                decision_label = "Connect your task tool to see operations health"
            else:
                issue_brief = f"Your task overdue rate is at {self._format_metric_value('task_overdue_rate', mv('task_overdue_rate'))} — work is falling behind."
                why_now_brief = "This isn't a one-off miss — overdue work is becoming a pattern that affects delivery quality."
                action_brief = "Clear the overdue backlog, reassign stuck tasks, and tighten your weekly check-in process."
                if_ignored_brief = "Delivery delays will start affecting client satisfaction, response times, and revenue."
                decision_label = "Execution friction needs a system fix"

        if threshold_hits:
            threshold_summary = ", ".join(f"{hit['metric_label']} ({hit['threshold_state']})" for hit in threshold_hits[:2])
            why_now_brief = f"{why_now_brief} Threshold policy is also triggered on {threshold_summary}."

        if availability < 0.5:
            why_now_brief = f"{why_now_brief} Some required signals are still inferred because only {availability * 100:.0f}% of the ideal evidence set is currently live."

        confidence_note = f"Confidence {confidence * 100:.0f}% from {max(1, int(round(availability * 100)))}% signal availability and current evidence quality."

        ignored_30 = min(99, max(18, int(round((impact * 4.2) + (urgency * 3.1) + (confidence * 10) + repeat_count))))
        ignored_60 = min(99, ignored_30 + 11)
        ignored_90 = min(99, ignored_60 + 9)
        actioned_30 = max(6, ignored_30 - 14)
        actioned_60 = max(8, ignored_60 - 18)
        actioned_90 = max(10, ignored_90 - 22)

        return {
            "issue_brief": issue_brief,
            "why_now_brief": why_now_brief,
            "action_brief": action_brief,
            "if_ignored_brief": if_ignored_brief,
            "fact_points": fact_points,
            "source_summary": source_summary,
            "confidence_note": confidence_note,
            "outlook_30_60_90": {
                "ignored": [ignored_30, ignored_60, ignored_90],
                "actioned": [actioned_30, actioned_60, actioned_90],
                "meaning": "Projected risk path over 30, 60, and 90 days if ignored versus actioned now.",
            },
            "repeat_count": repeat_count,
            "last_seen": last_seen,
            "escalation_state": escalation_state,
            "decision_label": decision_label,
        }

    def brain_policy(self) -> Dict[str, Any]:
        return {
            "plan_tier": self.plan_tier,
            "plan_label": self.plan_label,
            "visible_metric_limit": self.visible_metric_limit,
            "catalog_total_metrics": len(self.catalog),
            "custom_thresholds_active": self._active_thresholds_count(),
        }

    def get_kpi_configuration(self) -> Dict[str, Any]:
        visible_metrics = [self._catalog_metric_payload(metric) for metric in self._visible_catalog()]
        catalog_metrics = [self._catalog_metric_payload(metric) for metric in sorted(self.catalog, key=lambda x: x.index)]
        selected_keys = [metric["metric_key"] for metric in catalog_metrics if metric["selected"]]
        return {
            **self.brain_policy(),
            "selected_metric_keys": selected_keys,
            "selected_count": len(selected_keys),
            "selection_limit_reached": len(selected_keys) >= self.visible_metric_limit,
            "selection_upgrade_prompt": f"Free tier includes {self.visible_metric_limit} active KPIs. Upgrade to track more metrics." if self.plan_tier == "free" else None,
            "metrics": visible_metrics,
            "catalog_metrics": catalog_metrics,
        }

    def save_kpi_thresholds(self, thresholds: List[Dict[str, Any]], selected_metric_keys: Optional[List[str]] = None) -> Dict[str, Any]:
        ordered_catalog = sorted(self.catalog, key=lambda x: x.index)
        allowed_catalog_keys = [metric.name for metric in ordered_catalog]
        allowed_catalog_key_set = set(allowed_catalog_keys)
        existing_config = dict(self.kpi_preferences or {})
        brain_kpis = dict(existing_config.get("brain_kpis") or {})
        stored_thresholds = dict(brain_kpis.get("thresholds") or {})
        now = datetime.now(timezone.utc).isoformat()

        if selected_metric_keys is not None:
            sanitized_selection: List[str] = []
            seen = set()
            for item in selected_metric_keys:
                key = str(item or "").strip().lower()
                if not key or key in seen or key not in allowed_catalog_key_set:
                    continue
                sanitized_selection.append(key)
                seen.add(key)
            if sanitized_selection:
                sanitized_selection = sanitized_selection[: self.visible_metric_limit]
            brain_kpis["selected_metric_keys"] = sanitized_selection
            self.selected_metric_keys = sanitized_selection

        allowed_metric_keys = {metric.name for metric in self._visible_catalog()}

        for threshold in thresholds:
            metric_key = str(threshold.get("metric_key") or "").strip().lower()
            if not metric_key or metric_key not in allowed_metric_keys:
                continue

            warning_value = _normalize_threshold_number(threshold.get("warning_value"))
            critical_value = _normalize_threshold_number(threshold.get("critical_value"))
            comparator = str(threshold.get("comparator") or "below").lower()
            enabled = bool(threshold.get("enabled")) and (warning_value is not None or critical_value is not None)
            note = str(threshold.get("note") or "").strip()

            if not enabled and warning_value is None and critical_value is None and not note:
                stored_thresholds.pop(metric_key, None)
                continue

            stored_thresholds[metric_key] = {
                "enabled": enabled,
                "comparator": comparator if comparator in {"above", "below"} else "below",
                "warning_value": warning_value,
                "critical_value": critical_value,
                "note": note,
                "updated_at": now,
            }

        brain_kpis["thresholds"] = stored_thresholds
        brain_kpis["updated_at"] = now
        existing_config["brain_kpis"] = brain_kpis

        self.sb.table("business_profiles").upsert({
            "user_id": self.tenant_id,
            "intelligence_configuration": existing_config,
            "updated_at": now,
        }, on_conflict="user_id").execute()

        self.kpi_preferences = existing_config
        self.kpi_thresholds = stored_thresholds
        return self.get_kpi_configuration()

    def _detect_business_core_schema(self) -> bool:
        try:
            self.sb.schema("business_core").table("source_runs").select("source_id").limit(1).execute()
            return True
        except Exception as exc:
            logger.warning(f"[brain] business_core schema not accessible for tenant {self.tenant_id[:8]}...: {exc}")
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
        integrity_alerts: List[Dict[str, Any]] = []

        def mv(name: str, default: float = 0.0) -> float:
            row = metrics.get(name) or {}
            return _safe_float(row.get("value"), default)

        for concern in concerns:
            concern_id = concern.get("concern_id")
            required = concern.get("required_signals") or []
            truth_context = self._build_truth_context(concern_id, required, metrics)

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

            threshold_hits = self._threshold_hits_for_signals(metrics, required)
            if threshold_hits:
                critical_hits = [hit for hit in threshold_hits if hit["threshold_state"] == "critical"]
                warning_hits = [hit for hit in threshold_hits if hit["threshold_state"] == "warning"]
                impact = min(10.0, impact + (1.2 * len(critical_hits)) + (0.5 * len(warning_hits)))
                urgency = min(10.0, urgency + (1.0 * len(critical_hits)) + (0.35 * len(warning_hits)))
                confidence = min(0.99, confidence + (0.05 if critical_hits else 0.03))

            formula = concern.get("effective_priority_formula") or {}
            priority_score = self._score(impact, urgency, confidence, effort, formula)

            if truth_context.get("truth_state") == "blocked":
                integrity_alerts.append(self._build_integrity_alert(concern, truth_context))
                continue

            if truth_context.get("truth_state") == "needs_verification":
                confidence = min(confidence, 0.49)
                priority_score = round(priority_score * 0.6, 4)

            evidence = []
            for signal_name in required:
                m = metrics.get(signal_name)
                if m:
                    evidence.append({
                        "metric_name": signal_name,
                        "metric_value": m.get("value"),
                        "metric_confidence": m.get("confidence_score"),
                        "evidence_ids": m.get("evidence_ids") or [],
                        "threshold_state": next((hit["threshold_state"] for hit in threshold_hits if hit["metric_key"] == signal_name), "not_configured"),
                    })

            if threshold_hits:
                threshold_summary = ", ".join(
                    f"{hit['metric_label']} ({hit['threshold_state']})"
                    for hit in threshold_hits[:3]
                )
                recommendation = f"{recommendation} Threshold policy triggered on {threshold_summary}."
                explanation = f"{explanation} Threshold policy triggered on {threshold_summary}."

            structured_brief = self._structured_brief(
                concern_id=concern_id,
                metrics=metrics,
                threshold_hits=threshold_hits,
                truth_context=truth_context,
                availability=availability,
                impact=impact,
                urgency=urgency,
                confidence=confidence,
                recommendation=recommendation,
                explanation=explanation,
                evidence=evidence,
            )

            row = {
                "tenant_id": self.tenant_id,
                "concern_id": concern_id,
                "impact": round(impact, 4),
                "urgency": round(urgency, 4),
                "confidence": round(confidence, 4),
                "confidence_score": round(confidence, 4),
                "effort": round(effort, 4),
                "priority_score": priority_score,
                "recommendation": recommendation,
                "explanation": explanation,
                "evidence": evidence,
                "data_sources_count": max(1, len([entry for entry in evidence if entry.get("metric_value") not in (None, "", 0, 0.0)])),
                "data_freshness": self._freshness_from_last_seen(structured_brief.get("last_seen")),
                "evidence_lineage": {
                    "metrics_used": [entry.get("metric_name") for entry in evidence if entry.get("metric_name")],
                    "threshold_hits": [hit.get("metric_key") for hit in threshold_hits if hit.get("metric_key")],
                    "model_used": concern.get("probabilistic_model") or "business_brain_priority_engine",
                    "deterministic_rule": concern.get("deterministic_rule"),
                },
                "recommended_action_id": self._recommended_action_for_concern(concern_id),
                "threshold_hits": threshold_hits,
                "truth_state": truth_context.get("truth_state", "verified"),
                "conflict_eligible": truth_context.get("truth_state") == "verified",
                "source_truth": truth_context.get("source_truth") or [],
                "signal_availability": round(truth_context.get("availability", 0.0), 4),
                **structured_brief,
                "evaluated_at": datetime.now(timezone.utc).isoformat(),
            }
            try:
                self._t("concern_evaluations").insert(row).execute()
            except Exception:
                # Backward compatibility for environments without hardening migration.
                base_row = {
                    "tenant_id": row["tenant_id"],
                    "concern_id": row["concern_id"],
                    "impact": row["impact"],
                    "urgency": row["urgency"],
                    "confidence": row["confidence"],
                    "effort": row["effort"],
                    "priority_score": row["priority_score"],
                    "recommendation": row["recommendation"],
                    "explanation": row["explanation"],
                    "evidence": row["evidence"],
                    "evaluated_at": row["evaluated_at"],
                }
                self._t("concern_evaluations").insert(base_row).execute()

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
                "data_sources_count": max(1, len([entry for entry in evidence if entry.get("metric_value") not in (None, "", 0, 0.0)])),
                "data_freshness": self._freshness_from_last_seen(structured_brief.get("last_seen")),
                "confidence_score": round(confidence, 4),
                "evidence_lineage": {
                    "metrics_used": [entry.get("metric_name") for entry in evidence if entry.get("metric_name")],
                    "threshold_hits": [hit.get("metric_key") for hit in threshold_hits if hit.get("metric_key")],
                    "model_used": concern.get("probabilistic_model") or "business_brain_priority_engine",
                },
                "recommended_action_id": self._recommended_action_for_concern(concern_id),
                "threshold_hits": threshold_hits,
                "truth_state": truth_context.get("truth_state", "verified"),
                "conflict_eligible": truth_context.get("truth_state") == "verified",
                "source_truth": truth_context.get("source_truth") or [],
                "signal_availability": round(truth_context.get("availability", 0.0), 4),
                "explanation": explanation,
                **structured_brief,
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
            "integrity_alerts": integrity_alerts,
            "truth_summary": {
                "verified_concerns": len(evaluations),
                "blocked_concerns": len(integrity_alerts),
                "connector_truth": self._connector_truth(),
            },
            "all_clear": not evaluations and not integrity_alerts,
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
                    "confidence_score": item.get("confidence_score", item["confidence"]),
                    "effort": item["effort"],
                    "tier": "free",
                    "explanation": item["explanation"],
                    "data_sources_count": item.get("data_sources_count", 0),
                    "data_freshness": item.get("data_freshness"),
                    "evidence_lineage": item.get("evidence_lineage") or {},
                    "recommended_action_id": item.get("recommended_action_id"),
                    "issue_brief": item.get("issue_brief"),
                    "why_now_brief": item.get("why_now_brief"),
                    "action_brief": item.get("action_brief"),
                    "if_ignored_brief": item.get("if_ignored_brief"),
                    "fact_points": item.get("fact_points") or [],
                    "source_summary": item.get("source_summary"),
                    "confidence_note": item.get("confidence_note"),
                    "outlook_30_60_90": item.get("outlook_30_60_90") or {},
                    "repeat_count": item.get("repeat_count", 1),
                    "last_seen": item.get("last_seen"),
                    "escalation_state": item.get("escalation_state"),
                    "decision_label": item.get("decision_label"),
                    "truth_state": item.get("truth_state"),
                    "conflict_eligible": item.get("conflict_eligible", False),
                    "source_truth": item.get("source_truth") or [],
                    "signal_availability": item.get("signal_availability"),
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

        output["integrity_alerts"] = output.get("integrity_alerts") or []
        output["truth_summary"] = output.get("truth_summary") or {
            "verified_concerns": len(output["concerns"] or []),
            "blocked_concerns": 0,
            "connector_truth": self._connector_truth(),
        }
        output["brain_policy"] = self.brain_policy()
        return output

    def get_metrics(self, metric_name: Optional[str] = None, period: Optional[str] = None) -> List[Dict[str, Any]]:
        if not self.business_core_ready:
            return []
        q = self._t("business_metrics").select("*").eq("tenant_id", self.tenant_id).order("calculated_at", desc=True).limit(500)
        if metric_name:
            q = q.eq("metric_name", metric_name)
        if period:
            q = q.eq("period", period)
        rows = q.execute().data or []
        allowed_metric_keys = {metric.name for metric in self._visible_catalog()}
        return [row for row in rows if str(row.get("metric_name") or "") in allowed_metric_keys]

    def get_metric_coverage(self, period: Optional[str] = None) -> Dict[str, Any]:
        visible_catalog = self._visible_catalog()
        if not self.business_core_ready:
            return {
                **self.brain_policy(),
                "total_metrics": len(visible_catalog),
                "computed_metrics": 0,
                "pending_source_metrics": 0,
                "pending_implementation_metrics": 0,
                "pending_schema_metrics": len(visible_catalog),
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
                        "threshold_config": self._threshold_config_for_metric(m),
                        "threshold_state": "no_data",
                    }
                    for m in visible_catalog
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

        for m in visible_catalog:
            metric_key = m.name
            computed_row = latest_by_name.get(metric_key) or latest_by_name.get(alias_map.get(metric_key, ""))
            source_ready = self._catalog_source_ready(m.source, availability)
            threshold_config = self._threshold_config_for_metric(m)

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
                "threshold_config": threshold_config,
                "threshold_state": _threshold_state(computed_row.get("value") if computed_row else None, threshold_config),
            })

        return {
            **self.brain_policy(),
            "total_metrics": len(visible_catalog),
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
