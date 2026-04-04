#!/usr/bin/env python3
"""
Block 4 — Ask BIQc retrieval / answer-quality SLO gate (static).

Validates retrieval_contract field presence, per-domain depth wiring,
answer_grade guardrail mapping, freshness metadata plumbing, and
regression anchors. Does not call live APIs.

Machine-readable summary line (stdout, last line):
  ASK_BIQC_RETRIEVAL_SLO_GATE: PASS|FAIL

Also prints a JSON object with passed, failure_codes, checks.
Writes test_reports/block4_ask_biqc_retrieval_quality_<ts>.json when run as main.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple


REPO_ROOT = Path(__file__).resolve().parent.parent
SPEC_PATH = REPO_ROOT / "scripts" / "ask_biqc_retrieval_slo_spec.json"
REPORTS_DIR = REPO_ROOT / "test_reports"


def _load_spec(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _slice_build_retrieval_contract(src: str) -> str:
    start = src.find("def _build_retrieval_contract(")
    if start < 0:
        return ""
    end = src.find("\ndef _build_report_grounding_block", start)
    if end < 0:
        end = src.find("\ndef ", start + 1)
    return src[start:end] if end > 0 else src[start:]


def _slice_retrieval_depth_block(src: str) -> str:
    marker = "retrieval_depth = {"
    start = src.find(marker)
    if start < 0:
        return ""
    return src[start : start + 2500]


def run_gate(
    repo_root: Path | None = None,
    *,
    spec_path: Path | None = None,
    write_report: bool = True,
) -> Tuple[bool, Dict[str, Any]]:
    root = repo_root or REPO_ROOT
    sp = spec_path or (root / "scripts" / "ask_biqc_retrieval_slo_spec.json")
    spec = _load_spec(sp)
    sound_path = root / "backend" / "routes" / "soundboard.py"
    sound_src = sound_path.read_text(encoding="utf-8")
    contract_fn = _slice_build_retrieval_contract(sound_src)
    depth_block = _slice_retrieval_depth_block(sound_src)

    checks: Dict[str, bool] = {}
    failure_codes: List[str] = []

    def add(code: str, ok: bool) -> None:
        checks[code] = ok
        if not ok:
            failure_codes.append(code)

    if not contract_fn:
        add("build_retrieval_contract_fn_present", False)
    else:
        add("build_retrieval_contract_fn_present", True)
        for key in spec["retrieval_contract_keys"]:
            add(f"retrieval_contract_key:{key}", f'"{key}"' in contract_fn)

    for i, sub in enumerate(spec["answer_grade_guardrail_substrings"]):
        add(f"answer_grade_guardrail:{i}", sub in contract_fn)

    for i, sub in enumerate(spec["retrieval_depth_init_substrings"]):
        add(f"retrieval_depth_init:{i}", sub in depth_block)

    for i, sub in enumerate(spec["per_domain_depth_hydration_substrings"]):
        add(f"depth_hydration:{i}", sub in sound_src)

    for i, sub in enumerate(spec["freshness_contract_substrings"]):
        add(f"freshness:{i}", sub in sound_src)

    for i, sub in enumerate(spec["response_wire_substrings"]):
        n = len(re.findall(re.escape(sub), sound_src))
        add(f"retrieval_contract_wire:{i}", n >= 1)

    for i, sub in enumerate(spec["regression_guard_substrings"]):
        add(f"regression_guard:{i}", sub in sound_src)

    for j, surf in enumerate(spec["frontend_surface_checks"]):
        rel = surf["path"]
        fp = root / rel
        if not fp.is_file():
            add(f"frontend_surface_file:{j}", False)
            continue
        text = fp.read_text(encoding="utf-8")
        ok = all(s in text for s in surf["must_contain"])
        add(f"frontend_surface:{j}", ok)

    passed = not failure_codes
    now = datetime.now(timezone.utc)
    payload: Dict[str, Any] = {
        "generated_at": now.isoformat(),
        "spec_version": spec.get("spec_version"),
        "passed": passed,
        "failure_codes": failure_codes,
        "checks": checks,
        "paths": {
            "soundboard_py": str(sound_path.relative_to(root)),
            "spec": str(sp.relative_to(root)),
        },
    }

    if write_report:
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        out = REPORTS_DIR / f"block4_ask_biqc_retrieval_quality_{now.strftime('%Y%m%d_%H%M%S')}.json"
        out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        payload["artifact"] = str(out.relative_to(root))

    return passed, payload


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Ask BIQc retrieval quality SLO static gate")
    parser.add_argument("--repo-root", type=Path, default=None)
    parser.add_argument("--no-report", action="store_true", help="Skip writing test_reports JSON")
    parser.add_argument("--quiet-json", action="store_true", help="Print only final STATUS line")
    args = parser.parse_args(argv)

    passed, payload = run_gate(
        args.repo_root,
        write_report=not args.no_report,
    )
    if not args.quiet_json:
        print(json.dumps({"passed": passed, "failure_codes": payload["failure_codes"], "checks": payload["checks"]}, indent=2))
    status = "PASS" if passed else "FAIL"
    print(f"ASK_BIQC_RETRIEVAL_SLO_GATE: {status}", file=sys.stdout)
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
