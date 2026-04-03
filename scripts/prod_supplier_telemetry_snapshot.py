#!/usr/bin/env python3
"""
Prod Supplier Telemetry Snapshot

Collects production-only telemetry for Supabase and Azure, applies threshold
checks, and writes a machine-readable artifact to test_reports/.
"""

from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "test_reports"

SUPABASE_PROD_PROJECT_REF = os.environ.get("SUPABASE_PROD_PROJECT_REF", "vwwandhoydemcybltoxz").strip()

THRESHOLDS = {
    # Supabase MAU (free plan documented upper envelope around 50k).
    "supabase_mau_warn": int(os.environ.get("SUPABASE_MAU_WARN", "40000")),
    "supabase_mau_hard": int(os.environ.get("SUPABASE_MAU_HARD", "50000")),
    # Storage objects in bytes (policy defaults; override by env if needed).
    "supabase_storage_warn_bytes": int(os.environ.get("SUPABASE_STORAGE_WARN_BYTES", str(8 * 1024**3))),
    "supabase_storage_hard_bytes": int(os.environ.get("SUPABASE_STORAGE_HARD_BYTES", str(10 * 1024**3))),
    # DB size in bytes (policy defaults; override by env if needed).
    "supabase_db_warn_bytes": int(os.environ.get("SUPABASE_DB_WARN_BYTES", str(1 * 1024**3))),
    "supabase_db_hard_bytes": int(os.environ.get("SUPABASE_DB_HARD_BYTES", str(2 * 1024**3))),
}


@dataclass
class CmdResult:
    ok: bool
    command: str
    stdout: str
    stderr: str
    exit_code: int
    error: Optional[str] = None


def run_cmd(command: List[str]) -> CmdResult:
    try:
        proc = subprocess.run(command, capture_output=True, text=True, check=False)
        return CmdResult(
            ok=proc.returncode == 0,
            command=" ".join(command),
            stdout=proc.stdout or "",
            stderr=proc.stderr or "",
            exit_code=proc.returncode,
        )
    except Exception as exc:  # pragma: no cover
        return CmdResult(
            ok=False,
            command=" ".join(command),
            stdout="",
            stderr="",
            exit_code=1,
            error=str(exc),
        )


def extract_json_blob(raw: str) -> Any:
    start_candidates = [idx for idx in [raw.find("{"), raw.find("[")] if idx >= 0]
    if not start_candidates:
        raise ValueError("no json payload in command output")
    start = min(start_candidates)
    return json.loads(raw[start:])


def classify_metric(value: float, warn: float, hard: float) -> str:
    if value >= hard:
        return "hard_breach"
    if value >= warn:
        return "warning"
    return "ok"


def supabase_query(sql: str) -> Dict[str, Any]:
    res = run_cmd(["supabase", "db", "query", sql, "--linked", "-o", "json"])
    if not res.ok:
        raise RuntimeError(f"supabase query failed: {res.stderr.strip() or res.error or 'unknown error'}")
    payload = extract_json_blob(res.stdout)
    rows = payload.get("rows") or []
    if not rows:
        raise RuntimeError("supabase query returned no rows")
    return rows[0]


def collect_supabase_prod() -> Dict[str, Any]:
    link = run_cmd(["supabase", "link", "--project-ref", SUPABASE_PROD_PROJECT_REF])
    if not link.ok:
        raise RuntimeError(f"supabase link failed: {link.stderr.strip() or link.error or 'unknown error'}")

    db_row = supabase_query("select pg_database_size(current_database()) as bytes;")
    mau_row = supabase_query(
        "select count(*)::int as total_users, "
        "count(*) filter (where last_sign_in_at >= date_trunc('month', now()))::int as mau_current_month "
        "from auth.users;"
    )
    storage_row = supabase_query(
        "select coalesce(sum((metadata->>'size')::bigint),0) as storage_object_bytes, "
        "count(*)::int as object_count from storage.objects;"
    )

    db_bytes = int(db_row.get("bytes") or 0)
    mau = int(mau_row.get("mau_current_month") or 0)
    storage_bytes = int(storage_row.get("storage_object_bytes") or 0)

    checks = {
        "mau": {
            "value": mau,
            "warn": THRESHOLDS["supabase_mau_warn"],
            "hard": THRESHOLDS["supabase_mau_hard"],
            "status": classify_metric(mau, THRESHOLDS["supabase_mau_warn"], THRESHOLDS["supabase_mau_hard"]),
        },
        "db_size_bytes": {
            "value": db_bytes,
            "warn": THRESHOLDS["supabase_db_warn_bytes"],
            "hard": THRESHOLDS["supabase_db_hard_bytes"],
            "status": classify_metric(
                db_bytes, THRESHOLDS["supabase_db_warn_bytes"], THRESHOLDS["supabase_db_hard_bytes"]
            ),
        },
        "storage_object_bytes": {
            "value": storage_bytes,
            "warn": THRESHOLDS["supabase_storage_warn_bytes"],
            "hard": THRESHOLDS["supabase_storage_hard_bytes"],
            "status": classify_metric(
                storage_bytes, THRESHOLDS["supabase_storage_warn_bytes"], THRESHOLDS["supabase_storage_hard_bytes"]
            ),
        },
    }

    return {
        "project_ref": SUPABASE_PROD_PROJECT_REF,
        "database_size_bytes": db_bytes,
        "mau_current_month": mau,
        "total_users": int(mau_row.get("total_users") or 0),
        "storage_object_bytes": storage_bytes,
        "storage_object_count": int(storage_row.get("object_count") or 0),
        "threshold_checks": checks,
        "notes": [
            "Egress and billing overage line items require Supabase billing export/dashboard integration.",
        ],
    }


def collect_azure_prod() -> Dict[str, Any]:
    functionapps_res = run_cmd(
        ["az", "functionapp", "list", "--query", "[].{name:name,rg:resourceGroup,state:state}", "-o", "json"]
    )
    if not functionapps_res.ok:
        raise RuntimeError(f"az functionapp list failed: {functionapps_res.stderr.strip() or functionapps_res.error}")
    functionapps = extract_json_blob(functionapps_res.stdout)

    plans_res = run_cmd(
        [
            "az",
            "appservice",
            "plan",
            "list",
            "--query",
            "[].{name:name,rg:resourceGroup,sku:sku.name,tier:sku.tier,workers:sku.capacity}",
            "-o",
            "json",
        ]
    )
    if not plans_res.ok:
        raise RuntimeError(f"az appservice plan list failed: {plans_res.stderr.strip() or plans_res.error}")
    plans = extract_json_blob(plans_res.stdout)

    month_start = datetime.now(timezone.utc).strftime("%Y-%m-01")
    usage_res = run_cmd(
        [
            "az",
            "consumption",
            "usage",
            "list",
            "--start-date",
            month_start,
            "--top",
            "500",
            "--output",
            "json",
        ]
    )
    usage_records: List[Dict[str, Any]] = []
    if usage_res.ok:
        usage_records = extract_json_blob(usage_res.stdout)

    non_null_cost = 0
    for row in usage_records:
        val = row.get("pretaxCost")
        if val not in (None, "None", ""):
            non_null_cost += 1

    return {
        "function_apps": functionapps,
        "app_service_plans": plans,
        "consumption_usage_records_count": len(usage_records),
        "consumption_cost_rows_with_values": non_null_cost,
        "cold_start_assessment": (
            "not_applicable_no_function_apps"
            if len(functionapps) == 0
            else "evaluate_functionapp_plan_for_cold_start_and_runtime_limits"
        ),
        "notes": [
            "Consumption usage API in this subscription currently returns usage rows without materialized pretaxCost values.",
        ],
    }


def main() -> int:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)

    payload: Dict[str, Any] = {
        "generated_at": now.isoformat(),
        "mode": "prod_only",
        "thresholds": THRESHOLDS,
        "supabase": {},
        "azure": {},
        "passed": False,
        "failure_codes": [],
    }

    try:
        payload["supabase"] = collect_supabase_prod()
    except Exception as exc:
        payload["failure_codes"].append("SUPABASE_TELEMETRY_COLLECTION_FAILED")
        payload["supabase_error"] = str(exc)

    try:
        payload["azure"] = collect_azure_prod()
    except Exception as exc:
        payload["failure_codes"].append("AZURE_TELEMETRY_COLLECTION_FAILED")
        payload["azure_error"] = str(exc)

    supa_checks = (((payload.get("supabase") or {}).get("threshold_checks")) or {})
    hard_breaches = [
        key
        for key, val in supa_checks.items()
        if isinstance(val, dict) and val.get("status") == "hard_breach"
    ]
    if hard_breaches:
        payload["failure_codes"].append("SUPABASE_HARD_THRESHOLD_BREACH")
        payload["hard_breaches"] = hard_breaches

    payload["passed"] = len(payload["failure_codes"]) == 0

    out = REPORTS_DIR / f"prod_supplier_telemetry_snapshot_{now.strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"passed": payload["passed"], "artifact": str(out), "failure_codes": payload["failure_codes"]}, indent=2))
    return 0 if payload["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
