#!/usr/bin/env python3
"""
Block 7 closure pack: live truth + compliance + soundboard parity.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict


REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "test_reports"


def latest(prefix: str) -> Path | None:
    files = sorted(REPORTS_DIR.glob(f"{prefix}_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else None


def load(path: Path | None) -> Dict:
    if not path:
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    live_p = latest("block7_live_200_verification")
    sec_p = latest("block7_security_compliance_matrix")
    slo_p = latest("block7_soundboard_parity_slo")
    b6_p = latest("block6_ci_truthfulness_strict")

    live = load(live_p)
    sec = load(sec_p)
    slo = load(slo_p)
    b6 = load(b6_p)

    b6_strict = bool(b6.get("passed")) and bool(b6.get("strict_gate_enabled")) and bool(b6.get("normal_run_passed_after_restore"))
    live_pass = bool(live.get("passed"))
    checks = {
        "block7_live_200_passed": live_pass,
        "block7_security_matrix_passed": bool(sec.get("passed")),
        "block7_soundboard_slo_passed": bool(slo.get("passed")),
        "block6_ci_truthfulness_strict": b6_strict,
    }
    passed = all(checks.values())
    payload = {
        "generated_at": now.isoformat(),
        "passed": passed,
        "failure_codes": [k for k, v in checks.items() if not v],
        "checks": checks,
        "block6_ci_truthfulness_strict": "PASS" if b6_strict else "FAIL",
        "block7_live_200_passed": "PASS" if live_pass else "FAIL",
        "closure_passed": passed,
        "artifacts": {
            "block7_live_200_verification": str(live_p.relative_to(REPO_ROOT)) if live_p else None,
            "block7_security_compliance_matrix": str(sec_p.relative_to(REPO_ROOT)) if sec_p else None,
            "block7_soundboard_parity_slo": str(slo_p.relative_to(REPO_ROOT)) if slo_p else None,
            "block6_ci_truthfulness_strict": str(b6_p.relative_to(REPO_ROOT)) if b6_p else None,
        },
    }
    out = REPORTS_DIR / f"block7_live_truth_compliance_closure_{now.strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"passed": passed, "artifact": str(out), "failure_codes": payload["failure_codes"]}, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

