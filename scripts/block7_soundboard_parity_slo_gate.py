#!/usr/bin/env python3
"""
Block 7 Soundboard parity + SLO gate.

Checks streaming endpoint, edit/regenerate controls, coverage/citation visibility,
and latency/reliability guard constants.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict


REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "test_reports"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def extract_timeout_ms(src: str) -> int | None:
    m = re.search(r"SOUNDBOARD_CHAT_TIMEOUT_MS\s*=\s*(\d+)", src)
    return int(m.group(1)) if m else None


def main() -> int:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)

    backend = read(REPO_ROOT / "backend" / "routes" / "soundboard.py")
    page = read(REPO_ROOT / "frontend" / "src" / "pages" / "MySoundBoard.js")
    panel = read(REPO_ROOT / "frontend" / "src" / "components" / "SoundboardPanel.js")

    timeout_ms = extract_timeout_ms(page) or 999999
    checks: Dict[str, bool] = {
        "streaming_endpoint_present": '"/soundboard/chat/stream"' in backend and "StreamingResponse" in backend,
        "streaming_ui_present": "streamSoundboardChat" in page and "type === 'delta'" in page,
        "edit_and_regenerate_controls_present": "Edit & resend" in page and "Regenerate" in page,
        "traceable_response_versions_present": "response_version" in page and "trace_root_id" in page,
        "coverage_window_visible": ("Coverage window" in page and "Coverage window" in panel),
        "source_citations_visible": ("evidence_pack?.sources" in page and "evidence_pack?.sources" in panel),
        "latency_budget_timeout_le_120s": timeout_ms <= 120000,
        "reliability_retry_copy_present": ("retry" in page.lower() and "timeout" in page.lower()),
        "guardrails_still_present": ("_enforce_conversion_guardrails" in backend and "ROLE POLICY CONSTRAINTS" in backend),
    }

    passed = all(checks.values())
    payload = {
        "generated_at": now.isoformat(),
        "passed": passed,
        "failure_codes": [k for k, v in checks.items() if not v],
        "checks": checks,
        "slo": {
            "timeout_ms": timeout_ms,
            "target_timeout_ms_max": 120000,
        },
    }
    out = REPORTS_DIR / f"block7_soundboard_parity_slo_{now.strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"passed": passed, "artifact": str(out), "failure_codes": payload["failure_codes"]}, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

