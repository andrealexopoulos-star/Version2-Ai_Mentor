#!/usr/bin/env python3
"""
Block 5 Final Closure Pack

Creates final closure evidence for:
- Full block chain completion
- Continuous ops lock (monitoring + rollback posture)
- Integrity/freshness of latest artifacts
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional


REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "test_reports"
MAX_AGE_MINUTES = 240


def latest(prefix: str) -> Optional[Path]:
    files = sorted(REPORTS_DIR.glob(f"{prefix}_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else None


def load(path: Path) -> Dict:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def age_minutes(ts: str) -> float:
    dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    return (datetime.now(timezone.utc) - dt).total_seconds() / 60.0


def passed(payload: Dict) -> bool:
    for key in ("passed", "suite_passed", "proof_passed", "signoff_passed", "release_ready"):
        if key in payload:
            return bool(payload[key])
    return False


def main() -> int:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)

    refs = {
        "block3_forensic_regression": latest("block3_forensic_regression"),
        "block3_canary_finance_shadow": latest("block3_canary_finance_shadow"),
        "block3_smb_founder_journeys": latest("block3_smb_founder_journeys"),
        "block3_upsell_policy_audit": latest("block3_upsell_policy_audit"),
        "block3_readiness_pack_signoff": latest("block3_readiness_pack_signoff"),
        "block4_post_release_guard": latest("block4_post_release_guard"),
        "release_evidence_index": latest("release_evidence_index"),
    }

    missing = [k for k, v in refs.items() if v is None]
    if missing:
        out = REPORTS_DIR / f"block5_final_closure_pack_{now.strftime('%Y%m%d_%H%M%S')}.json"
        payload = {
            "generated_at": now.isoformat(),
            "closure_passed": False,
            "failure_code": "MISSING_REQUIRED_ARTIFACTS",
            "missing": missing,
        }
        out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(json.dumps({"closure_passed": False, "artifact": str(out), "failure_code": "MISSING_REQUIRED_ARTIFACTS"}, indent=2))
        return 1

    artifacts = {}
    checks = {}
    for name, path in refs.items():
        assert path is not None
        payload = load(path)
        age = age_minutes(str(payload.get("generated_at")))
        artifacts[name] = {
            "path": str(path.relative_to(REPO_ROOT)),
            "sha256": sha256(path),
            "generated_at": payload.get("generated_at"),
            "age_minutes": round(age, 2),
            "fresh": age <= MAX_AGE_MINUTES,
            "passed": passed(payload),
        }
        checks[f"{name}_passed"] = artifacts[name]["passed"]
        checks[f"{name}_fresh"] = artifacts[name]["fresh"]

    checks["continuous_ops_lock"] = (
        checks["block4_post_release_guard_passed"]
        and checks["block4_post_release_guard_fresh"]
        and checks["release_evidence_index_passed"]
    )

    closure_passed = all(bool(v) for v in checks.values())
    failure_codes = [k for k, v in checks.items() if not v]

    out_payload = {
        "generated_at": now.isoformat(),
        "closure_passed": closure_passed,
        "failure_codes": failure_codes,
        "checks": checks,
        "artifacts": artifacts,
        "decision": "FINAL_CLOSURE_READY" if closure_passed else "CLOSURE_BLOCKED",
    }

    out = REPORTS_DIR / f"block5_final_closure_pack_{now.strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(out_payload, indent=2), encoding="utf-8")
    print(json.dumps({"closure_passed": closure_passed, "artifact": str(out), "failure_codes": failure_codes}, indent=2))
    return 0 if closure_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

