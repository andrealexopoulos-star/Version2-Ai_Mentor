#!/usr/bin/env python3
"""
Block 3 Forensic Regression

Runs core release controls end-to-end and emits an auditable artifact.
"""

from __future__ import annotations

import json
import subprocess
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List


REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "test_reports"


def run(cmd: List[str]) -> Dict[str, object]:
    env = os.environ.copy()
    # Keep release evidence policy consistent across chained block runs.
    if not env.get("RELEASE_TELEMETRY_ENFORCEMENT"):
        env["RELEASE_TELEMETRY_ENFORCEMENT"] = "advisory"
    proc = subprocess.run(cmd, cwd=REPO_ROOT, env=env, capture_output=True, text=True)
    return {
        "command": " ".join(cmd),
        "exit_code": proc.returncode,
        "stdout": proc.stdout[-3000:],
        "stderr": proc.stderr[-3000:],
        "passed": proc.returncode == 0,
    }


def latest(prefix: str) -> Path | None:
    files = sorted(REPORTS_DIR.glob(f"{prefix}_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else None


def main() -> int:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)

    runs = [
        run(["python3", "-m", "py_compile", "backend/routes/soundboard.py"]),
        run(["python3", "-m", "py_compile", "scripts/zd_zr_za_manager.py", "scripts/release_evidence_index_builder.py"]),
        run(["python3", "scripts/zd_zr_za_manager.py"]),
        run(["python3", "scripts/cfo_golden_test_harness.py"]),
        run(["python3", "scripts/gate_enforcement_proof.py"]),
        run(["python3", "scripts/release_evidence_index_builder.py"]),
        run(["git", "diff", "--name-only", "origin/main...HEAD"]),
    ]

    all_commands_ok = all(item["passed"] for item in runs[:-1])  # exclude git diff from return code semantics

    website_pattern_prefixes = (
        "frontend/src/pages/website/",
        "frontend/src/components/website/",
    )
    website_exact = {
        "frontend/src/pages/LoginSupabase.js",
        "frontend/src/pages/RegisterSupabase.js",
        "frontend/src/App.js",
    }
    changed_files = [x.strip() for x in str(runs[-1]["stdout"]).splitlines() if x.strip()]
    protected_website_changes = [
        f for f in changed_files
        if f.startswith(website_pattern_prefixes) or f in website_exact
    ]

    zd = latest("zd_zr_za_manager")
    cfo = latest("cfo_golden_harness")
    gate = latest("gate_enforcement_proof")
    rel = latest("release_evidence_index")
    if not all([zd, cfo, gate, rel]):
        payload = {
            "generated_at": now.isoformat(),
            "passed": False,
            "failure_code": "MISSING_ARTIFACTS",
            "runs": runs,
        }
        out = REPORTS_DIR / f"block3_forensic_regression_{now.strftime('%Y%m%d_%H%M%S')}.json"
        out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(json.dumps({"passed": False, "artifact": str(out), "failure_code": "MISSING_ARTIFACTS"}, indent=2))
        return 1

    zd_data = json.loads(zd.read_text(encoding="utf-8"))
    cfo_data = json.loads(cfo.read_text(encoding="utf-8"))
    gate_data = json.loads(gate.read_text(encoding="utf-8"))
    rel_data = json.loads(rel.read_text(encoding="utf-8"))

    controls = {
        "commands_ok": all_commands_ok,
        "white_label_visible_leaks_zero": zd_data.get("summary", {}).get("likely_visible_vendor_leak_hits", 999) == 0,
        "cfo_suite_passed": bool(cfo_data.get("suite_passed")),
        "gate_proof_passed": bool(gate_data.get("proof_passed")),
        "release_ready": bool(rel_data.get("release_ready")),
        "protected_website_changes": len(protected_website_changes) == 0,
    }
    passed = all(controls.values())
    failure_codes = [k for k, v in controls.items() if not v]

    payload = {
        "generated_at": now.isoformat(),
        "passed": passed,
        "failure_codes": failure_codes,
        "controls": controls,
        "artifact_refs": {
            "zd_zr_za": str(zd.relative_to(REPO_ROOT)),
            "cfo_golden": str(cfo.relative_to(REPO_ROOT)),
            "gate_enforcement": str(gate.relative_to(REPO_ROOT)),
            "release_index": str(rel.relative_to(REPO_ROOT)),
        },
        "protected_website_changed_files": protected_website_changes,
        "runs": runs,
    }
    out = REPORTS_DIR / f"block3_forensic_regression_{now.strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"passed": passed, "artifact": str(out), "failure_codes": failure_codes}, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

