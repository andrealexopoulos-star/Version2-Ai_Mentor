#!/usr/bin/env python3
"""
Block 3 SMB Founder Journeys

Validates 4 founder personas, decision-job coverage, and coverage-window visibility.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List


REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "test_reports"
SOUNDBOARD_BACKEND = REPO_ROOT / "backend" / "routes" / "soundboard.py"
SOUNDBOARD_PANEL = REPO_ROOT / "frontend" / "src" / "components" / "SoundboardPanel.js"
MYSOUNDBOARD_PAGE = REPO_ROOT / "frontend" / "src" / "pages" / "MySoundBoard.js"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def infer_domain(job: str) -> str:
    text = job.lower()
    if any(k in text for k in ("cash", "invoice", "margin", "runway", "profit")):
        return "finance"
    if any(k in text for k in ("pipeline", "deal", "lead", "close")):
        return "sales"
    if any(k in text for k in ("campaign", "seo", "brand", "market")):
        return "marketing"
    if any(k in text for k in ("risk", "compliance", "incident", "audit")):
        return "risk"
    if any(k in text for k in ("team", "staff", "hiring", "capacity")):
        return "hr"
    if any(k in text for k in ("process", "workflow", "ops", "delivery")):
        return "operations"
    return "planning"


def main() -> int:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)

    personas: List[Dict[str, object]] = [
        {
            "persona": "Consulting founder",
            "jobs": ["protect cash runway", "stabilize pipeline conversion", "forecast next-quarter staffing"],
        },
        {
            "persona": "Agency owner",
            "jobs": ["optimize campaign ROI", "reduce client churn risk", "sequence weekly operating priorities"],
        },
        {
            "persona": "Retail operator",
            "jobs": ["watch payable pressure", "identify demand shifts", "handle compliance incidents quickly"],
        },
        {
            "persona": "SaaS founder",
            "jobs": ["improve MRR quality", "diagnose revenue leakage", "prioritize strategic bets with confidence"],
        },
    ]

    backend_src = read(SOUNDBOARD_BACKEND).lower()
    panel_src = read(SOUNDBOARD_PANEL)
    board_src = read(MYSOUNDBOARD_PAGE)

    domain_checks = []
    for p in personas:
        jobs = p["jobs"]  # type: ignore[index]
        mapped = [infer_domain(j) for j in jobs]  # type: ignore[arg-type]
        covered = all((d in backend_src) for d in mapped)
        domain_checks.append(
            {
                "persona": p["persona"],
                "jobs": jobs,
                "mapped_domains": mapped,
                "covered": covered,
            }
        )

    coverage_window_visible = all(
        needle in panel_src for needle in ("coverage_window", "Coverage window", "last sync")
    ) and all(
        needle in board_src for needle in ("coverage_window", "Coverage window", "last sync")
    )

    decision_job_coverage = all(item["covered"] for item in domain_checks)
    suite_passed = decision_job_coverage and coverage_window_visible

    payload = {
        "generated_at": now.isoformat(),
        "suite_passed": suite_passed,
        "personas_total": len(personas),
        "decision_job_coverage_passed": decision_job_coverage,
        "coverage_window_visible": coverage_window_visible,
        "persona_checks": domain_checks,
        "ui_evidence": {
            "panel_has_coverage_window": bool(re.search(r"Coverage window", panel_src)),
            "board_has_coverage_window": bool(re.search(r"Coverage window", board_src)),
        },
    }
    out = REPORTS_DIR / f"block3_smb_founder_journeys_{now.strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"suite_passed": suite_passed, "artifact": str(out)}, indent=2))
    return 0 if suite_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

