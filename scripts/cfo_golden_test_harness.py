#!/usr/bin/env python3
"""
CFO Golden Test Harness

Validates finance release invariants against the policy defined in
docs/operations/UNIFIED_PLATFORM_AUDIT_EXECUTION_BLUEPRINT.md.
Produces an auditable JSON artifact under test_reports/.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, List


REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "test_reports"


@dataclass
class ThresholdPolicy:
    pct: float
    abs_aud: float | None = None
    count_delta: int | None = None


THRESHOLDS: Dict[str, ThresholdPolicy] = {
    "revenue_pipeline": ThresholdPolicy(pct=0.5, abs_aud=500),
    "overdue_invoice": ThresholdPolicy(pct=0.25, count_delta=1),
    "supplier_payables": ThresholdPolicy(pct=0.5, abs_aud=500),
    "cash_flow": ThresholdPolicy(pct=1.0, abs_aud=1000),
}

DRIFT_SLA_HOURS = {"P0": 4, "P1": 24, "P2": 120}


def pct_variance(a: float, b: float) -> float:
    baseline = max(abs(a), 1.0)
    return abs(a - b) / baseline * 100.0


def check_metric(metric: str, source: float, card: float, source_count: int | None = None, card_count: int | None = None) -> Dict[str, object]:
    policy = THRESHOLDS[metric]
    pct = pct_variance(source, card)
    pct_ok = pct <= policy.pct
    abs_delta = abs(source - card)
    abs_ok = True if policy.abs_aud is None else abs_delta <= policy.abs_aud
    count_ok = True
    count_delta = None
    if policy.count_delta is not None and source_count is not None and card_count is not None:
        count_delta = abs(source_count - card_count)
        count_ok = count_delta <= policy.count_delta

    passed = pct_ok and abs_ok and count_ok
    return {
        "metric": metric,
        "source": source,
        "card": card,
        "pct_variance": round(pct, 4),
        "abs_delta_aud": round(abs_delta, 2),
        "count_delta": count_delta,
        "passed": passed,
    }


def release_blocked(metric_checks: List[Dict[str, object]], unresolved_drift_hours: float, severity: str, evidence_complete: bool, evidence_age_hours: float) -> bool:
    if not evidence_complete:
        return True
    if evidence_age_hours > 24:
        return True
    if any(not c["passed"] for c in metric_checks):
        return True
    if unresolved_drift_hours > DRIFT_SLA_HOURS[severity]:
        return True
    return False


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)

    scenarios = [
        {
            "id": "golden-pass-001",
            "severity": "P0",
            "evidence_complete": True,
            "evidence_age_hours": 1.2,
            "unresolved_drift_hours": 1.0,
            "metrics": [
                check_metric("revenue_pipeline", source=100000, card=100250),
                check_metric("overdue_invoice", source=40000, card=40080, source_count=34, card_count=34),
                check_metric("supplier_payables", source=50000, card=50100),
                check_metric("cash_flow", source=250000, card=250900),
            ],
            "expected_blocked": False,
        },
        {
            "id": "golden-drift-breach-002",
            "severity": "P0",
            "evidence_complete": True,
            "evidence_age_hours": 2.0,
            "unresolved_drift_hours": 5.2,
            "metrics": [
                check_metric("revenue_pipeline", source=100000, card=100300),
            ],
            "expected_blocked": True,
        },
        {
            "id": "golden-reconciliation-breach-003",
            "severity": "P0",
            "evidence_complete": True,
            "evidence_age_hours": 0.8,
            "unresolved_drift_hours": 1.0,
            "metrics": [
                check_metric("revenue_pipeline", source=100000, card=102000),
            ],
            "expected_blocked": True,
        },
        {
            "id": "golden-evidence-integrity-004",
            "severity": "P1",
            "evidence_complete": False,
            "evidence_age_hours": 26.5,
            "unresolved_drift_hours": 1.0,
            "metrics": [
                check_metric("supplier_payables", source=45000, card=45100),
            ],
            "expected_blocked": True,
        },
    ]

    results = []
    suite_passed = True
    for sc in scenarios:
        blocked = release_blocked(
            metric_checks=sc["metrics"],
            unresolved_drift_hours=sc["unresolved_drift_hours"],
            severity=sc["severity"],
            evidence_complete=sc["evidence_complete"],
            evidence_age_hours=sc["evidence_age_hours"],
        )
        ok = blocked == sc["expected_blocked"]
        suite_passed = suite_passed and ok
        results.append(
            {
                "id": sc["id"],
                "severity": sc["severity"],
                "expected_blocked": sc["expected_blocked"],
                "actual_blocked": blocked,
                "passed": ok,
                "evidence_complete": sc["evidence_complete"],
                "evidence_age_hours": sc["evidence_age_hours"],
                "unresolved_drift_hours": sc["unresolved_drift_hours"],
                "metrics": sc["metrics"],
            }
        )

    payload = {
        "generated_at": now.isoformat(),
        "policy_reference": "docs/operations/UNIFIED_PLATFORM_AUDIT_EXECUTION_BLUEPRINT.md",
        "thresholds": {k: asdict(v) for k, v in THRESHOLDS.items()},
        "drift_sla_hours": DRIFT_SLA_HOURS,
        "suite_passed": suite_passed,
        "tests_total": len(results),
        "tests_passed": sum(1 for r in results if r["passed"]),
        "results": results,
    }

    out = OUTPUT_DIR / f"cfo_golden_harness_{now.strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"suite_passed": suite_passed, "artifact": str(out)}, indent=2))
    return 0 if suite_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

