#!/usr/bin/env python3
"""
Feature Tier Parity Gate

Validates route-tier parity between frontend and backend policy maps.
Outputs a machine-readable artifact in test_reports/.
"""

from __future__ import annotations

import ast
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Tuple


REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "test_reports"
FRONTEND_FILE = REPO_ROOT / "frontend" / "src" / "config" / "routeAccessConfig.js"
BACKEND_FILE = REPO_ROOT / "backend" / "tier_resolver.py"

# Expected intentional differences.
EXPECTED_FRONTEND_ONLY = {
    "/ab-testing",  # currently frontend waitlist/admin surface split
}
EXPECTED_BACKEND_ONLY = {
    "/prompt-lab",  # backend/admin-only route not exposed in standard frontend map
}


def load_frontend_routes() -> Dict[str, str]:
    src = FRONTEND_FILE.read_text(encoding="utf-8")
    pattern = re.compile(r"['\"](?P<route>/[^'\"]*)['\"]\s*:\s*\{\s*minTier:\s*['\"](?P<tier>[^'\"]+)['\"]")
    result: Dict[str, str] = {}
    for m in pattern.finditer(src):
        route = m.group("route").strip()
        tier = m.group("tier").strip()
        result[route] = tier
    return result


def load_backend_routes() -> Dict[str, str]:
    src = BACKEND_FILE.read_text(encoding="utf-8")
    tree = ast.parse(src)
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "ROUTE_ACCESS":
                    value = ast.literal_eval(node.value)
                    if not isinstance(value, dict):
                        raise ValueError("ROUTE_ACCESS is not a dict")
                    return {str(k): str(v) for k, v in value.items()}
    raise ValueError("ROUTE_ACCESS not found in backend tier resolver")


def classify(frontend: Dict[str, str], backend: Dict[str, str]) -> Tuple[Dict[str, str], Dict[str, str], Dict[str, Dict[str, str]]]:
    frontend_keys = set(frontend)
    backend_keys = set(backend)

    unexpected_frontend_only = {
        k: frontend[k]
        for k in sorted(frontend_keys - backend_keys)
        if k not in EXPECTED_FRONTEND_ONLY
    }
    unexpected_backend_only = {
        k: backend[k]
        for k in sorted(backend_keys - frontend_keys)
        if k not in EXPECTED_BACKEND_ONLY
    }

    tier_mismatches: Dict[str, Dict[str, str]] = {}
    for route in sorted(frontend_keys & backend_keys):
        if frontend[route] != backend[route]:
            tier_mismatches[route] = {
                "frontend": frontend[route],
                "backend": backend[route],
            }
    return unexpected_frontend_only, unexpected_backend_only, tier_mismatches


def main() -> int:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)

    frontend = load_frontend_routes()
    backend = load_backend_routes()
    unexpected_frontend_only, unexpected_backend_only, tier_mismatches = classify(frontend, backend)

    passed = not unexpected_frontend_only and not unexpected_backend_only and not tier_mismatches
    failure_codes = []
    if unexpected_frontend_only:
        failure_codes.append("UNEXPECTED_FRONTEND_ONLY_ROUTES")
    if unexpected_backend_only:
        failure_codes.append("UNEXPECTED_BACKEND_ONLY_ROUTES")
    if tier_mismatches:
        failure_codes.append("ROUTE_TIER_MISMATCH")

    payload = {
        "generated_at": now.isoformat(),
        "passed": passed,
        "failure_codes": failure_codes,
        "counts": {
            "frontend_routes": len(frontend),
            "backend_routes": len(backend),
            "unexpected_frontend_only": len(unexpected_frontend_only),
            "unexpected_backend_only": len(unexpected_backend_only),
            "tier_mismatches": len(tier_mismatches),
        },
        "unexpected_frontend_only": unexpected_frontend_only,
        "unexpected_backend_only": unexpected_backend_only,
        "tier_mismatches": tier_mismatches,
        "expected_exemptions": {
            "frontend_only": sorted(EXPECTED_FRONTEND_ONLY),
            "backend_only": sorted(EXPECTED_BACKEND_ONLY),
        },
    }

    out = REPORTS_DIR / f"feature_tier_parity_gate_{now.strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"passed": passed, "artifact": str(out), "failure_codes": failure_codes}, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
