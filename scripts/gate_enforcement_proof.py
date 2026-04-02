#!/usr/bin/env python3
"""
Gate enforcement proof across PR, pre-merge, pre-deploy, post-deploy.
Includes evidence freshness and artifact integrity checks.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List


REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "test_reports"
DEPLOY_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "deploy.yml"
MAX_EVIDENCE_AGE_MINUTES = 120


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def latest_report(prefix: str) -> Path | None:
    files = sorted(REPORTS_DIR.glob(f"{prefix}_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else None


def load_json(path: Path) -> Dict:
    return json.loads(path.read_text(encoding="utf-8"))


def evidence_record(path: Path) -> Dict[str, object]:
    payload = load_json(path)
    generated_at = payload.get("generated_at")
    generated_dt = datetime.fromisoformat(str(generated_at).replace("Z", "+00:00"))
    age_minutes = (now_utc() - generated_dt).total_seconds() / 60.0
    return {
        "path": str(path.relative_to(REPO_ROOT)),
        "generated_at": generated_dt.isoformat(),
        "age_minutes": round(age_minutes, 2),
        "is_fresh": age_minutes <= MAX_EVIDENCE_AGE_MINUTES,
        "sha256": sha256_file(path),
        "size_bytes": path.stat().st_size,
    }


def main() -> int:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    zd_report = latest_report("zd_zr_za_manager")
    cfo_report = latest_report("cfo_golden_harness")
    if not zd_report or not cfo_report:
        raise SystemExit("Required evidence artifacts missing.")

    zd = load_json(zd_report)
    cfo = load_json(cfo_report)
    deploy_src = DEPLOY_WORKFLOW.read_text(encoding="utf-8")

    zd_evidence = evidence_record(zd_report)
    cfo_evidence = evidence_record(cfo_report)

    pr_gate_ok = (
        bool(zd.get("summary", {}).get("website_change_gate_present"))
        and "Website Change Gate" in deploy_src
    )
    premerge_gate_ok = (
        bool(zd.get("summary", {}).get("preprod_forensic_gate_present"))
        and "Pre-Prod Forensic Gate" in deploy_src
    )
    predeploy_gate_ok = (
        bool(zd.get("summary", {}).get("forensic_gate_version"))
        and zd.get("summary", {}).get("likely_visible_vendor_leak_hits", 999) == 0
        and bool(cfo.get("suite_passed"))
    )
    postdeploy_gate_ok = (
        zd_evidence["is_fresh"]
        and cfo_evidence["is_fresh"]
        and zd_evidence["size_bytes"] > 0
        and cfo_evidence["size_bytes"] > 0
    )

    stage_checks: List[Dict[str, object]] = [
        {"stage": "PR", "gate": "website_change_gate", "passed": bool(pr_gate_ok)},
        {"stage": "PRE_MERGE", "gate": "preprod_forensic_gate", "passed": bool(premerge_gate_ok)},
        {"stage": "PRE_DEPLOY", "gate": "finance_and_white_label_invariant", "passed": bool(predeploy_gate_ok)},
        {"stage": "POST_DEPLOY", "gate": "evidence_freshness_integrity", "passed": bool(postdeploy_gate_ok)},
    ]

    proof_passed = all(item["passed"] for item in stage_checks)
    payload = {
        "generated_at": now_utc().isoformat(),
        "max_evidence_age_minutes": MAX_EVIDENCE_AGE_MINUTES,
        "proof_passed": proof_passed,
        "stage_checks": stage_checks,
        "evidence": {
            "zd_zr_za": zd_evidence,
            "cfo_golden": cfo_evidence,
        },
    }

    out = REPORTS_DIR / f"gate_enforcement_proof_{now_utc().strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"proof_passed": proof_passed, "artifact": str(out)}, indent=2))
    return 0 if proof_passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

