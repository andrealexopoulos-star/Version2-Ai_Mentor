#!/usr/bin/env python3
"""
Release Evidence Index Builder

Aggregates latest ZD-ZR-ZA, CFO golden harness, and gate enforcement artifacts
into a single machine-readable release evidence index JSON.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional


REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "test_reports"
MAX_AGE_MINUTES = 180


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def latest_report(prefix: str) -> Optional[Path]:
    files = sorted(
        REPORTS_DIR.glob(f"{prefix}_*.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    return files[0] if files else None


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def load_json(path: Path) -> Dict:
    return json.loads(path.read_text(encoding="utf-8"))


def describe_artifact(path: Path) -> Dict:
    payload = load_json(path)
    generated_at = datetime.fromisoformat(str(payload.get("generated_at")).replace("Z", "+00:00"))
    age_minutes = (now_utc() - generated_at).total_seconds() / 60.0
    return {
        "path": str(path.relative_to(REPO_ROOT)),
        "generated_at": generated_at.isoformat(),
        "sha256": sha256(path),
        "size_bytes": path.stat().st_size,
        "age_minutes": round(age_minutes, 2),
        "is_fresh": age_minutes <= MAX_AGE_MINUTES,
    }


def main() -> int:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    zd_path = latest_report("zd_zr_za_manager")
    cfo_path = latest_report("cfo_golden_harness")
    gate_path = latest_report("gate_enforcement_proof")
    if not (zd_path and cfo_path and gate_path):
        print("Missing required evidence artifacts.")
        return 2

    zd_payload = load_json(zd_path)
    cfo_payload = load_json(cfo_path)
    gate_payload = load_json(gate_path)

    artifacts = {
        "zd_zr_za": describe_artifact(zd_path),
        "cfo_golden": describe_artifact(cfo_path),
        "gate_enforcement": describe_artifact(gate_path),
    }

    gate_status = {
        "WL-P0-03": zd_payload.get("summary", {}).get("likely_visible_vendor_leak_hits", 999) == 0,
        "CFO-GOLDEN-TEST-01": bool(cfo_payload.get("suite_passed")),
        "GATE-ENFORCEMENT-01": bool(gate_payload.get("proof_passed")),
        "EVIDENCE-FRESHNESS-01": all(item["is_fresh"] for item in artifacts.values()),
        "LINEAGE-COVERAGE-01": zd_payload.get("summary", {}).get("frontend_route_lineage_entries", 0) > 0,
        "BLOCK2-LINEAGE-CLASSIFICATION-01": zd_payload.get("summary", {}).get("lineage_unexpected_unlinked_routes", 1) == 0,
    }

    payload = {
        "generated_at": now_utc().isoformat(),
        "policy": {
            "freshness_max_age_minutes": MAX_AGE_MINUTES,
            "release_invariant": "block_if_any_gate_fails",
        },
        "gates": gate_status,
        "artifacts": artifacts,
        "source_summaries": {
            "zd_zr_za": zd_payload.get("summary", {}),
            "cfo_golden": {
                "suite_passed": cfo_payload.get("suite_passed"),
                "tests_total": cfo_payload.get("tests_total"),
                "tests_passed": cfo_payload.get("tests_passed"),
            },
            "gate_enforcement": {
                "proof_passed": gate_payload.get("proof_passed"),
                "stage_checks": gate_payload.get("stage_checks", []),
            },
        },
        "release_ready": all(gate_status.values()),
    }

    out = REPORTS_DIR / f"release_evidence_index_{now_utc().strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"release_ready": payload["release_ready"], "artifact": str(out)}, indent=2))
    return 0 if payload["release_ready"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

