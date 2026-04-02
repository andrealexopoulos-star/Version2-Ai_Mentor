#!/usr/bin/env python3
"""
Block 4 Post-release guard monitor.

Verifies monitoring continuity and auto-rollback readiness from the
latest release evidence chain.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional


REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "test_reports"
WORKFLOW_FILE = REPO_ROOT / ".github" / "workflows" / "deploy.yml"
BLUEPRINT_FILE = REPO_ROOT / "docs" / "operations" / "UNIFIED_PLATFORM_AUDIT_EXECUTION_BLUEPRINT.md"
MAX_AGE_MINUTES = 180


def latest(prefix: str) -> Optional[Path]:
    files = sorted(REPORTS_DIR.glob(f"{prefix}_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else None


def load_json(path: Path) -> Dict:
    return json.loads(path.read_text(encoding="utf-8"))


def age_minutes(iso_ts: str) -> float:
    dt = datetime.fromisoformat(str(iso_ts).replace("Z", "+00:00"))
    return (datetime.now(timezone.utc) - dt).total_seconds() / 60.0


def main() -> int:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)

    forensic = latest("block3_forensic_regression")
    canary = latest("block3_canary_finance_shadow")
    signoff = latest("block3_readiness_pack_signoff")
    release_idx = latest("release_evidence_index")

    if not all([forensic, canary, signoff, release_idx]):
        out = REPORTS_DIR / f"block4_post_release_guard_{now.strftime('%Y%m%d_%H%M%S')}.json"
        payload = {
            "generated_at": now.isoformat(),
            "passed": False,
            "failure_code": "MISSING_PRIOR_ARTIFACTS",
            "required": {
                "block3_forensic_regression": bool(forensic),
                "block3_canary_finance_shadow": bool(canary),
                "block3_readiness_pack_signoff": bool(signoff),
                "release_evidence_index": bool(release_idx),
            },
        }
        out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(json.dumps({"passed": False, "artifact": str(out), "failure_code": "MISSING_PRIOR_ARTIFACTS"}, indent=2))
        return 1

    forensic_data = load_json(forensic)  # type: ignore[arg-type]
    canary_data = load_json(canary)  # type: ignore[arg-type]
    signoff_data = load_json(signoff)  # type: ignore[arg-type]
    release_data = load_json(release_idx)  # type: ignore[arg-type]
    workflow_src = WORKFLOW_FILE.read_text(encoding="utf-8")
    blueprint_src = BLUEPRINT_FILE.read_text(encoding="utf-8")

    checks = {
        "forensic_regression_passed": bool(forensic_data.get("passed")),
        "canary_shadow_passed": bool(canary_data.get("suite_passed")),
        "readiness_signoff_passed": bool(signoff_data.get("signoff_passed")),
        "release_index_ready": bool(release_data.get("release_ready")),
        "forensic_fresh": age_minutes(forensic_data.get("generated_at")) <= MAX_AGE_MINUTES,
        "canary_fresh": age_minutes(canary_data.get("generated_at")) <= MAX_AGE_MINUTES,
        "signoff_fresh": age_minutes(signoff_data.get("generated_at")) <= MAX_AGE_MINUTES,
        "website_change_gate_present": "Website Change Gate" in workflow_src,
        "preprod_forensic_gate_present": "Pre-Prod Forensic Gate" in workflow_src,
        "post_release_guard_documented": "post-release guard window" in blueprint_src.lower(),
        "rollback_documented": "rollback" in blueprint_src.lower(),
    }

    passed = all(checks.values())
    failure_codes = [k for k, v in checks.items() if not v]

    payload = {
        "generated_at": now.isoformat(),
        "passed": passed,
        "failure_codes": failure_codes,
        "checks": checks,
        "artifact_refs": {
            "forensic": str(forensic.relative_to(REPO_ROOT)),  # type: ignore[union-attr]
            "canary": str(canary.relative_to(REPO_ROOT)),  # type: ignore[union-attr]
            "signoff": str(signoff.relative_to(REPO_ROOT)),  # type: ignore[union-attr]
            "release_index": str(release_idx.relative_to(REPO_ROOT)),  # type: ignore[union-attr]
        },
        "policy": {
            "max_age_minutes": MAX_AGE_MINUTES,
            "guard_mode": "monitoring_and_auto_rollback_must_remain_active",
        },
    }
    out = REPORTS_DIR / f"block4_post_release_guard_{now.strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"passed": passed, "artifact": str(out), "failure_codes": failure_codes}, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

