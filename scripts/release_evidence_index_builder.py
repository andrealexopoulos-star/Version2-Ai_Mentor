#!/usr/bin/env python3
"""
Release Evidence Index Builder

Aggregates latest ZD-ZR-ZA, CFO golden harness, and gate enforcement artifacts
into a single machine-readable release evidence index JSON.
"""

from __future__ import annotations

import hashlib
import json
import os
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
    telemetry_enforcement = os.environ.get("RELEASE_TELEMETRY_ENFORCEMENT", "advisory").strip().lower()
    telemetry_advisory = telemetry_enforcement != "strict"

    zd_path = latest_report("zd_zr_za_manager")
    cfo_path = latest_report("cfo_golden_harness")
    gate_path = latest_report("gate_enforcement_proof")
    tier_parity_path = latest_report("feature_tier_parity_gate")
    matrix_consistency_path = latest_report("feature_tier_matrix_consistency_gate")
    supplier_path = latest_report("prod_supplier_telemetry_snapshot")
    ephemeral_guard_path = latest_report("ephemeral_artifact_guard")
    if not (
        zd_path
        and cfo_path
        and gate_path
        and tier_parity_path
        and matrix_consistency_path
        and supplier_path
        and ephemeral_guard_path
    ):
        print("Missing required evidence artifacts.")
        return 2

    zd_payload = load_json(zd_path)
    cfo_payload = load_json(cfo_path)
    gate_payload = load_json(gate_path)
    tier_parity_payload = load_json(tier_parity_path)
    matrix_consistency_payload = load_json(matrix_consistency_path)
    supplier_payload = load_json(supplier_path)
    ephemeral_guard_payload = load_json(ephemeral_guard_path)

    artifacts = {
        "zd_zr_za": describe_artifact(zd_path),
        "cfo_golden": describe_artifact(cfo_path),
        "gate_enforcement": describe_artifact(gate_path),
        "feature_tier_parity": describe_artifact(tier_parity_path),
        "feature_tier_matrix_consistency": describe_artifact(matrix_consistency_path),
        "prod_supplier_telemetry": describe_artifact(supplier_path),
        "ephemeral_artifact_guard": describe_artifact(ephemeral_guard_path),
    }

    gate_status = {
        "WL-P0-03": zd_payload.get("summary", {}).get("likely_visible_vendor_leak_hits", 999) == 0,
        "CFO-GOLDEN-TEST-01": bool(cfo_payload.get("suite_passed")),
        "GATE-ENFORCEMENT-01": bool(gate_payload.get("proof_passed")),
        "TIER-PARITY-PROD-01": bool(tier_parity_payload.get("passed")),
        "FEATURE-TIER-MATRIX-CONSISTENCY-01": bool(matrix_consistency_payload.get("passed")),
        "SUPPLIER-TELEMETRY-PROD-01": bool(supplier_payload.get("passed")) if not telemetry_advisory else True,
        "EPHEMERAL-ARTIFACT-GUARD-01": bool(ephemeral_guard_payload.get("passed")),
        "EVIDENCE-FRESHNESS-01": all(item["is_fresh"] for item in artifacts.values()),
        "LINEAGE-COVERAGE-01": zd_payload.get("summary", {}).get("frontend_route_lineage_entries", 0) > 0,
        "BLOCK2-LINEAGE-CLASSIFICATION-01": zd_payload.get("summary", {}).get("lineage_unexpected_unlinked_routes", 1) == 0,
    }

    payload = {
        "generated_at": now_utc().isoformat(),
        "policy": {
            "freshness_max_age_minutes": MAX_AGE_MINUTES,
            "release_invariant": "block_if_any_gate_fails",
            "telemetry_enforcement": "strict" if not telemetry_advisory else "advisory",
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
            "feature_tier_parity": {
                "passed": tier_parity_payload.get("passed"),
                "failure_codes": tier_parity_payload.get("failure_codes", []),
                "counts": tier_parity_payload.get("counts", {}),
            },
            "feature_tier_matrix_consistency": {
                "passed": matrix_consistency_payload.get("passed"),
                "failure_codes": matrix_consistency_payload.get("failure_codes", []),
                "checked_routes": matrix_consistency_payload.get("checked_routes"),
                "mismatch_count": matrix_consistency_payload.get("mismatch_count"),
            },
            "prod_supplier_telemetry": {
                "passed": supplier_payload.get("passed"),
                "failure_codes": supplier_payload.get("failure_codes", []),
                "mode": supplier_payload.get("mode"),
            },
            "ephemeral_artifact_guard": {
                "passed": ephemeral_guard_payload.get("passed"),
                "failure_code": ephemeral_guard_payload.get("failure_code"),
                "tracked_blocked_paths": ephemeral_guard_payload.get("tracked_blocked_paths", []),
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

