#!/usr/bin/env python3
"""
Feature Tier Matrix Consistency Gate

Validates the canonical feature-tier CSV against frontend and backend route maps.
"""

from __future__ import annotations

import ast
import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List


REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "test_reports"
MATRIX_FILE = REPO_ROOT / "reports" / "BIQC_FEATURE_TIER_MATRIX_2026-04-01.csv"
FRONTEND_FILE = REPO_ROOT / "frontend" / "src" / "config" / "routeAccessConfig.js"
BACKEND_FILE = REPO_ROOT / "backend" / "tier_resolver.py"


def frontend_routes() -> Dict[str, str]:
    src = FRONTEND_FILE.read_text(encoding="utf-8")
    pat = re.compile(r"['\"](?P<route>/[^'\"]*)['\"]\s*:\s*\{\s*minTier:\s*['\"](?P<tier>[^'\"]+)['\"]")
    out: Dict[str, str] = {}
    for m in pat.finditer(src):
        out[m.group("route").strip()] = m.group("tier").strip()
    return out


def backend_routes() -> Dict[str, str]:
    src = BACKEND_FILE.read_text(encoding="utf-8")
    tree = ast.parse(src)
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for tgt in node.targets:
                if isinstance(tgt, ast.Name) and tgt.id == "ROUTE_ACCESS":
                    val = ast.literal_eval(node.value)
                    return {str(k): str(v) for k, v in val.items()}
    raise RuntimeError("ROUTE_ACCESS not found")


def load_matrix() -> List[Dict[str, str]]:
    with MATRIX_FILE.open("r", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main() -> int:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)

    fe = frontend_routes()
    be = backend_routes()
    rows = load_matrix()

    mismatches: List[Dict[str, str]] = []
    checked = 0

    for row in rows:
        route = (row.get("route_or_surface") or "").strip()
        access = (row.get("current_access_class") or "").strip().lower()
        min_tier = (row.get("min_tier") or "").strip().lower()

        # Only validate real route entries in active tiers.
        if not route.startswith("/"):
            continue
        if access in {"deferred"}:
            continue
        if route not in fe or route not in be:
            # Waitlist/deprecated routes should still exist in maps if intended.
            mismatches.append(
                {
                    "route": route,
                    "code": "ROUTE_MISSING_FROM_POLICY_MAP",
                    "csv_min_tier": min_tier,
                    "frontend_min_tier": fe.get(route, "<missing>"),
                    "backend_min_tier": be.get(route, "<missing>"),
                }
            )
            continue

        checked += 1
        if fe[route] != min_tier or be[route] != min_tier:
            mismatches.append(
                {
                    "route": route,
                    "code": "CSV_POLICY_TIER_MISMATCH",
                    "csv_min_tier": min_tier,
                    "frontend_min_tier": fe[route],
                    "backend_min_tier": be[route],
                }
            )

    passed = len(mismatches) == 0
    failure_codes = [] if passed else ["FEATURE_TIER_MATRIX_MISMATCH"]
    payload = {
        "generated_at": now.isoformat(),
        "passed": passed,
        "failure_codes": failure_codes,
        "checked_routes": checked,
        "mismatch_count": len(mismatches),
        "mismatches": mismatches[:200],
        "matrix_file": str(MATRIX_FILE.relative_to(REPO_ROOT)),
    }

    out = REPORTS_DIR / f"feature_tier_matrix_consistency_gate_{now.strftime('%Y%m%d_%H%M%S')}.json"
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"passed": passed, "artifact": str(out), "failure_codes": failure_codes}, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
