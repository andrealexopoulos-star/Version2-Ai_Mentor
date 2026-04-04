#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
TEST_REPORTS = REPO_ROOT / "test_reports"
BACKEND_BASE = os.environ.get("BACKEND_BASE_URL", "https://biqc-api.azurewebsites.net").rstrip("/")
TOKEN = (os.environ.get("AUTH_BEARER_TOKEN") or "").strip()

REQUIRED_KEYS = [
    "data_status",
    "confidence_score",
    "confidence_reason",
    "coverage_window",
    "lookback_days_target",
    "lookback_days_effective",
    "backfill_state",
    "missing_periods",
    "source_lineage",
    "next_best_actions",
]

TARGET_ENDPOINTS = [
    "/api/intelligence/watchtower",
    "/api/email/priority-inbox",
    "/api/outlook/intelligence",
    "/api/cognition/overview",
    "/api/cognition/revenue",
    "/api/cognition/operations",
    "/api/cognition/risk",
    "/api/cognition/market",
    "/api/outlook/calendar/events",
]


def request_json(url: str) -> Tuple[int, Dict]:
    req = urllib.request.Request(url=url, method="GET")
    if TOKEN:
        req.add_header("Authorization", f"Bearer {TOKEN}")
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            body = (resp.read() or b"").decode("utf-8", errors="ignore")
            return int(resp.status), json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        body = (exc.read() or b"").decode("utf-8", errors="ignore")
        try:
            parsed = json.loads(body) if body else {}
        except Exception:
            parsed = {"raw": body[:400]}
        return int(exc.code), parsed
    except Exception as exc:  # noqa: BLE001
        return 0, {"error": str(exc)}


def validate_payload(endpoint: str, payload: Dict) -> List[str]:
    missing = [k for k in REQUIRED_KEYS if k not in payload]
    if "coverage_window" in payload and not isinstance(payload.get("coverage_window"), dict):
        missing.append("coverage_window(dict)")
    if "source_lineage" in payload and not isinstance(payload.get("source_lineage"), list):
        missing.append("source_lineage(list)")
    if "next_best_actions" in payload and not isinstance(payload.get("next_best_actions"), list):
        missing.append("next_best_actions(list)")
    if "missing_periods" in payload and not isinstance(payload.get("missing_periods"), list):
        missing.append("missing_periods(list)")
    if "lookback_days_target" in payload:
        target = payload.get("lookback_days_target")
        if not isinstance(target, int):
            missing.append("lookback_days_target(int)")
        elif target < 365:
            missing.append("lookback_days_target(<365)")
    return missing


def main() -> int:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    TEST_REPORTS.mkdir(parents=True, exist_ok=True)
    results = []
    overall_pass = True
    if not TOKEN:
        overall_pass = False
    for ep in TARGET_ENDPOINTS:
        url = f"{BACKEND_BASE}{ep}"
        status, payload = request_json(url)
        row = {
            "endpoint": ep,
            "status": status,
            "missing_keys": [],
            "passed": False,
        }
        if status == 200 and isinstance(payload, dict):
            missing = validate_payload(ep, payload)
            row["missing_keys"] = missing
            row["passed"] = len(missing) == 0
        else:
            row["missing_keys"] = ["status_not_200_or_non_json"]
            row["passed"] = False
        if not row["passed"]:
            overall_pass = False
        results.append(row)

    artifact = TEST_REPORTS / f"semantic_contract_validator_{ts}.json"
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "backend_base_url": BACKEND_BASE,
        "token_supplied": bool(TOKEN),
        "required_keys": REQUIRED_KEYS,
        "passed": overall_pass,
        "summary": {
            "total": len(results),
            "pass": sum(1 for r in results if r["passed"]),
            "fail": sum(1 for r in results if not r["passed"]),
        },
        "results": results,
    }
    artifact.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"passed": overall_pass, "artifact": str(artifact), "summary": payload["summary"]}, indent=2))
    return 0 if overall_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())
