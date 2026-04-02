#!/usr/bin/env python3
"""
Block 3 Readiness Pack Signoff

Builds a final signoff artifact from Block 3 evidence outputs.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict


REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "test_reports"


def latest(prefix: str) -> Path | None:
    files = sorted(REPORTS_DIR.glob(f"{prefix}_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else None


def load(path: Path) -> Dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def to_bool(payload: Dict) -> bool:
    if "passed" in payload:
        return bool(payload.get("passed"))
    if "suite_passed" in payload:
        return bool(payload.get("suite_passed"))
    if "proof_passed" in payload:
        return bool(payload.get("proof_passed"))
    if "release_ready" in payload:
        return bool(payload.get("release_ready"))
    return False


def main() -> int:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)

    refs = {
        "forensic_regression": latest("block3_forensic_regression"),
        "canary_finance_shadow": latest("block3_canary_finance_shadow"),
        "smb_founder_journeys": latest("block3_smb_founder_journeys"),
        "upsell_policy_audit": latest("block3_upsell_policy_audit"),
        "release_evidence_index": latest("release_evidence_index"),
    }
    if not all(refs.values()):
        missing = [k for k, v in refs.items() if v is None]
        out = REPORTS_DIR / f"block3_readiness_pack_signoff_{now.strftime('%Y%m%d_%H%M%S')}.json"
        payload = {
            "generated_at": now.isoformat(),
            "signoff_passed": False,
            "failure_code": "MISSING_REQUIRED_ARTIFACTS",
            "missing": missing,
        }
        out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(json.dumps({"signoff_passed": False, "artifact": str(out), "failure_code": "MISSING_REQUIRED_ARTIFACTS"}, indent=2))
        return 1

    checks = {}
    artifacts = {}
    for key, path in refs.items():
        assert path is not None
        payload = load(path)
        checks[key] = to_bool(payload)
        artifacts[key] = {
            "path": str(path.relative_to(REPO_ROOT)),
            "sha256": sha256(path),
            "generated_at": payload.get("generated_at"),
        }

    signoff_passed = all(checks.values())
    out_payload = {
        "generated_at": now.isoformat(),
        "signoff_passed": signoff_passed,
        "checks": checks,
        "artifacts": artifacts,
        "decision": "READY_FOR_CONDITIONAL_FINAL_APPROVAL" if signoff_passed else "BLOCKED",
    }
    out = REPORTS_DIR / f"block3_readiness_pack_signoff_{now.strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(out_payload, indent=2), encoding="utf-8")
    print(json.dumps({"signoff_passed": signoff_passed, "artifact": str(out)}, indent=2))
    return 0 if signoff_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

