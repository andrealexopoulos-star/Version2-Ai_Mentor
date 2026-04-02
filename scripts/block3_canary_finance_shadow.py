#!/usr/bin/env python3
"""
Block 3 Canary Finance Shadow

Simulates finance-card canary comparisons and verifies release/block behavior.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List


REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "test_reports"


@dataclass
class Threshold:
    pct: float
    abs_aud: float | None = None
    count_delta: int | None = None


THRESHOLDS: Dict[str, Threshold] = {
    "revenue_pipeline": Threshold(pct=0.5, abs_aud=500),
    "overdue_invoice": Threshold(pct=0.25, count_delta=1),
    "supplier_payables": Threshold(pct=0.5, abs_aud=500),
    "cash_flow": Threshold(pct=1.0, abs_aud=1000),
}


def pct_delta(source: float, card: float) -> float:
    return abs(source - card) / max(abs(source), 1.0) * 100.0


def check_metric(metric: str, source: float, card: float, source_count: int | None = None, card_count: int | None = None) -> Dict[str, object]:
    policy = THRESHOLDS[metric]
    p = pct_delta(source, card)
    a = abs(source - card)
    count_delta = abs(source_count - card_count) if (source_count is not None and card_count is not None) else None
    pct_ok = p <= policy.pct
    abs_ok = True if policy.abs_aud is None else a <= policy.abs_aud
    count_ok = True if policy.count_delta is None else (count_delta is not None and count_delta <= policy.count_delta)
    passed = pct_ok and abs_ok and count_ok
    return {
        "metric": metric,
        "pct_delta": round(p, 4),
        "abs_delta_aud": round(a, 2),
        "count_delta": count_delta,
        "passed": passed,
    }


def classify_shadow(metrics: List[Dict[str, object]], unresolved_drift_hours: float) -> str:
    failed = [m for m in metrics if not m["passed"]]
    if failed or unresolved_drift_hours > 4:
        return "P0_BLOCK"
    if unresolved_drift_hours > 0:
        return "P1_DEGRADE"
    return "PASS"


def main() -> int:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)

    scenarios = [
        {
            "id": "canary-pass",
            "metrics": [
                check_metric("revenue_pipeline", 100000, 100300),
                check_metric("overdue_invoice", 50000, 50060, 42, 42),
                check_metric("supplier_payables", 70000, 70200),
                check_metric("cash_flow", 180000, 180900),
            ],
            "drift_hours": 0.0,
            "expected": "PASS",
        },
        {
            "id": "canary-p1-degrade",
            "metrics": [
                check_metric("revenue_pipeline", 120000, 120450),
                check_metric("supplier_payables", 60000, 60200),
            ],
            "drift_hours": 1.5,
            "expected": "P1_DEGRADE",
        },
        {
            "id": "canary-p0-block",
            "metrics": [
                check_metric("revenue_pipeline", 100000, 102500),
                check_metric("overdue_invoice", 40000, 40400, 35, 39),
            ],
            "drift_hours": 0.5,
            "expected": "P0_BLOCK",
        },
    ]

    results: List[Dict[str, object]] = []
    suite_passed = True
    for s in scenarios:
        actual = classify_shadow(s["metrics"], s["drift_hours"])
        ok = actual == s["expected"]
        suite_passed = suite_passed and ok
        results.append(
            {
                "id": s["id"],
                "expected": s["expected"],
                "actual": actual,
                "passed": ok,
                "drift_hours": s["drift_hours"],
                "metrics": s["metrics"],
            }
        )

    payload = {
        "generated_at": now.isoformat(),
        "suite_passed": suite_passed,
        "scenarios_total": len(results),
        "scenarios_passed": sum(1 for r in results if r["passed"]),
        "results": results,
    }
    out = REPORTS_DIR / f"block3_canary_finance_shadow_{now.strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"suite_passed": suite_passed, "artifact": str(out)}, indent=2))
    return 0 if suite_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

