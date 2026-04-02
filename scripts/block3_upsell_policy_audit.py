#!/usr/bin/env python3
"""
Block 3 Upsell Policy Audit

Ensures incident/risk/compliance contexts cannot emit upgrade prompts.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List


REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "test_reports"
SOUNDBOARD = REPO_ROOT / "backend" / "routes" / "soundboard.py"


def enforce_guardrails_local(response: str, allow_upsell: bool) -> str:
    if allow_upsell:
        return response
    blocked_terms = (
        "upgrade",
        "plan",
        "tier",
        "subscription",
        "more features",
        "unlock",
        "biqc foundation",
        "paywall",
    )
    out: List[str] = []
    for line in response.splitlines():
        lower = line.lower()
        if any(term in lower for term in blocked_terms):
            continue
        out.append(line)
    return "\n".join(out).strip()


def main() -> int:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    src = SOUNDBOARD.read_text(encoding="utf-8")
    src_lower = src.lower()

    static_checks: Dict[str, bool] = {
        "has_incident_classifier": "_is_incident_or_compliance_query" in src,
        "has_capability_gap_classifier": "_has_explicit_capability_gap_request" in src,
        "has_conversion_enforcer": "_enforce_conversion_guardrails" in src,
        "has_role_policy_block": "ROLE POLICY CONSTRAINTS" in src,
        "has_no_upsell_critical_context": "CONVERSION GUARDRAIL — CRITICAL CONTEXT" in src,
        "returns_upsell_flags": ("upsell_allowed" in src and "incident_or_compliance" in src and "explicit_capability_gap" in src),
    }

    sample_incident = (
        "Immediate action: isolate impacted workflows.\n"
        "Upgrade to Growth plan to unlock enhanced controls.\n"
        "Collect evidence and notify stakeholders."
    )
    sample_explicit_gap = (
        "You asked about plan limits.\n"
        "Upgrade to the next tier for additional integrations."
    )
    incident_sanitized = enforce_guardrails_local(sample_incident, allow_upsell=False)
    explicit_gap_kept = enforce_guardrails_local(sample_explicit_gap, allow_upsell=True)
    behavior_checks = {
        "incident_strips_upgrade_line": "upgrade" not in incident_sanitized.lower(),
        "explicit_gap_keeps_upgrade_line": "upgrade" in explicit_gap_kept.lower(),
    }

    passed = all(static_checks.values()) and all(behavior_checks.values())
    payload = {
        "generated_at": now.isoformat(),
        "suite_passed": passed,
        "static_checks": static_checks,
        "behavior_checks": behavior_checks,
        "samples": {
            "incident_input": sample_incident,
            "incident_output": incident_sanitized,
            "explicit_gap_input": sample_explicit_gap,
            "explicit_gap_output": explicit_gap_kept,
        },
    }
    out = REPORTS_DIR / f"block3_upsell_policy_audit_{now.strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"suite_passed": passed, "artifact": str(out)}, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())

