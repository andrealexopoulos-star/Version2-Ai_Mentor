"""Admin scope checkpoint feed from docs/operations/SCOPE_EXECUTION_CHECKPOINTS.md."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List
import re

from fastapi import APIRouter, Depends

from routes.deps import get_super_admin

router = APIRouter()

REPO_ROOT = Path(__file__).resolve().parents[2]
CHECKPOINTS_FILE = REPO_ROOT / "docs" / "operations" / "SCOPE_EXECUTION_CHECKPOINTS.md"

ENTRY_PATTERN = re.compile(
    r"^-\s+(PASS|FAIL)\s+·\s+`([^`]+)`\s+·\s+`([^`]*)`\s+·\s+`([^`]+)`\s*$"
)


def _parse_checkpoints() -> List[Dict[str, str]]:
    if not CHECKPOINTS_FILE.exists():
        return []
    entries: List[Dict[str, str]] = []
    for raw_line in CHECKPOINTS_FILE.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        match = ENTRY_PATTERN.match(line)
        if not match:
            continue
        status, gate_id, failure_code, artifact = match.groups()
        entries.append(
            {
                "status": status,
                "gate_id": gate_id,
                "failure_code": failure_code if failure_code and failure_code != "-" else "",
                "artifact": artifact,
            }
        )
    return entries


@router.get("/admin/scope-checkpoints")
async def admin_scope_checkpoints(admin: dict = Depends(get_super_admin)):
    entries = _parse_checkpoints()
    latest_by_gate: Dict[str, Dict[str, str]] = {}
    for entry in entries:
        latest_by_gate[entry["gate_id"]] = entry

    latest_entries = list(latest_by_gate.values())
    open_failures = [entry for entry in latest_entries if entry["status"] == "FAIL"]
    return {
        "source": str(CHECKPOINTS_FILE.relative_to(REPO_ROOT)),
        "entry_count": len(entries),
        "unique_gate_count": len(latest_entries),
        "open_failure_count": len(open_failures),
        "latest_by_gate": latest_entries,
        "open_failures": open_failures,
    }
