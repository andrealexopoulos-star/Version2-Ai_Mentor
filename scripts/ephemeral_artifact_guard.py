#!/usr/bin/env python3
"""
Ephemeral Artifact Guard

Fails when machine/session artifacts are tracked in git.
Writes a machine-readable artifact to test_reports/.
"""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import List


REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "test_reports"
BLOCKED_PREFIXES = [
    "supabase/.temp/",
]
BLOCKED_EXACT = [
    "SERPAPI",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def git_tracked_files() -> List[str]:
    proc = subprocess.run(
        ["git", "ls-files"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"git ls-files failed: {proc.stderr.strip()}")
    return [line.strip() for line in (proc.stdout or "").splitlines() if line.strip()]


def is_blocked(path: str) -> bool:
    if path in BLOCKED_EXACT:
        return True
    return any(path.startswith(prefix) for prefix in BLOCKED_PREFIXES)


def write_artifact(payload: dict) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out = REPORTS_DIR / f"ephemeral_artifact_guard_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return out


def main() -> int:
    try:
        tracked = git_tracked_files()
    except Exception as exc:
        payload = {
            "generated_at": now_iso(),
            "passed": False,
            "failure_code": "GIT_TRACKED_SCAN_FAILED",
            "error": str(exc),
            "blocked_prefixes": BLOCKED_PREFIXES,
            "blocked_exact": BLOCKED_EXACT,
        }
        out = write_artifact(payload)
        print(json.dumps({"passed": False, "artifact": str(out), "failure_code": payload["failure_code"]}, indent=2))
        return 2

    tracked_blocked = sorted([path for path in tracked if is_blocked(path)])

    payload = {
        "generated_at": now_iso(),
        "passed": len(tracked_blocked) == 0,
        "failure_code": None if len(tracked_blocked) == 0 else "TRACKED_EPHEMERAL_ARTIFACTS_FOUND",
        "tracked_files_scanned": len(tracked),
        "blocked_prefixes": BLOCKED_PREFIXES,
        "blocked_exact": BLOCKED_EXACT,
        "tracked_blocked_paths": tracked_blocked,
    }
    out = write_artifact(payload)
    print(json.dumps({"passed": payload["passed"], "artifact": str(out), "failure_code": payload["failure_code"]}, indent=2))
    return 0 if payload["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

