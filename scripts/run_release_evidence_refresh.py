#!/usr/bin/env python3
"""
Release Evidence Refresh Runner

Runs the core evidence producers in sequence, then rebuilds the release
evidence index so freshness gates are satisfied in one command.
"""

from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import List


REPO_ROOT = Path(__file__).resolve().parent.parent


@dataclass
class StepResult:
    name: str
    command: List[str]
    exit_code: int
    stdout: str
    stderr: str


def run_step(name: str, command: List[str]) -> StepResult:
    proc = subprocess.run(command, cwd=REPO_ROOT, capture_output=True, text=True, check=False)
    return StepResult(
        name=name,
        command=command,
        exit_code=proc.returncode,
        stdout=proc.stdout or "",
        stderr=proc.stderr or "",
    )


def main() -> int:
    steps = [
        ("zd_zr_za_manager", [sys.executable, "scripts/zd_zr_za_manager.py"]),
        ("cfo_golden_harness", [sys.executable, "scripts/cfo_golden_test_harness.py"]),
        ("gate_enforcement_proof", [sys.executable, "scripts/gate_enforcement_proof.py"]),
        ("feature_tier_parity_gate", [sys.executable, "scripts/feature_tier_parity_gate.py"]),
        ("feature_tier_matrix_consistency_gate", [sys.executable, "scripts/feature_tier_matrix_consistency_gate.py"]),
        ("prod_supplier_telemetry_snapshot", [sys.executable, "scripts/prod_supplier_telemetry_snapshot.py"]),
        ("ephemeral_artifact_guard", [sys.executable, "scripts/ephemeral_artifact_guard.py"]),
        ("release_evidence_index_builder", [sys.executable, "scripts/release_evidence_index_builder.py"]),
    ]

    results: List[StepResult] = []
    for name, cmd in steps:
        res = run_step(name, cmd)
        results.append(res)
        if res.exit_code != 0:
            payload = {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "passed": False,
                "failure_code": "EVIDENCE_STEP_FAILED",
                "failed_step": name,
                "failed_command": cmd,
                "step_results": [
                    {
                        "name": r.name,
                        "exit_code": r.exit_code,
                        "command": r.command,
                    }
                    for r in results
                ],
                "stdout": res.stdout[-4000:],
                "stderr": res.stderr[-4000:],
            }
            print(json.dumps(payload, indent=2))
            return 1

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "passed": True,
        "failure_code": None,
        "step_results": [
            {
                "name": r.name,
                "exit_code": r.exit_code,
                "command": r.command,
            }
            for r in results
        ],
    }
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
